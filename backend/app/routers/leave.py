from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.employee import Employee
from app.models.leave import LeaveType, LeaveBalance, LeaveRequest, LeaveStatus
from app.models.attendance import Attendance, AttendanceStatus
from app.schemas.leave import LeaveTypeCreate, LeaveTypeResponse, LeaveBalanceResponse, LeaveRequestCreate, LeaveRequestResponse
from app.utils.security import get_current_user
from app.utils.permissions import require_roles
from datetime import date

router = APIRouter(prefix="/leave", tags=["Leave"])


@router.get("/types")
def list_leave_types(db: Session = Depends(get_db)):
    return [{"id": lt.id, "name": lt.name, "max_days_per_year": lt.max_days_per_year, "description": lt.description} for lt in db.query(LeaveType).all()]


@router.post("/types")
def create_leave_type(data: LeaveTypeCreate, current_user: User = Depends(require_roles("admin", "hr_officer")), db: Session = Depends(get_db)):
    lt = LeaveType(**data.model_dump())
    db.add(lt)
    db.commit()
    db.refresh(lt)
    return {"id": lt.id, "name": lt.name, "max_days_per_year": lt.max_days_per_year}


@router.get("/balance")
def get_my_leave_balance(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found")
    balances = db.query(LeaveBalance).filter(LeaveBalance.employee_id == emp.id).all()
    result = []
    for b in balances:
        lt = db.query(LeaveType).filter(LeaveType.id == b.leave_type_id).first()
        result.append({"id": b.id, "employee_id": b.employee_id, "leave_type_id": b.leave_type_id, "leave_type_name": lt.name if lt else "", "allocated": b.allocated, "used": b.used, "remaining": b.remaining})
    return result


@router.get("/balance/{employee_id}")
def get_employee_leave_balance(employee_id: int, current_user: User = Depends(require_roles("admin", "hr_officer", "payroll_officer")), db: Session = Depends(get_db)):
    balances = db.query(LeaveBalance).filter(LeaveBalance.employee_id == employee_id).all()
    result = []
    for b in balances:
        lt = db.query(LeaveType).filter(LeaveType.id == b.leave_type_id).first()
        result.append({"id": b.id, "employee_id": b.employee_id, "leave_type_id": b.leave_type_id, "leave_type_name": lt.name if lt else "", "allocated": b.allocated, "used": b.used, "remaining": b.remaining})
    return result


@router.post("/apply")
def apply_leave(data: LeaveRequestCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found")
    if data.end_date < data.start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")
    days = (data.end_date - data.start_date).days + 1
    balance = db.query(LeaveBalance).filter(LeaveBalance.employee_id == emp.id, LeaveBalance.leave_type_id == data.leave_type_id).first()
    if balance and balance.remaining < days:
        raise HTTPException(status_code=400, detail=f"Insufficient leave balance. Available: {balance.remaining}, Requested: {days}")
    request = LeaveRequest(employee_id=emp.id, leave_type_id=data.leave_type_id, start_date=data.start_date, end_date=data.end_date, reason=data.reason, status=LeaveStatus.PENDING)
    db.add(request)
    db.commit()
    db.refresh(request)
    return {"message": "Leave application submitted", "id": request.id}


@router.get("/requests")
def list_leave_requests(status_filter: str = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role.value == "employee":
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp:
            return []
        query = db.query(LeaveRequest).filter(LeaveRequest.employee_id == emp.id)
    else:
        # Scope to company employees
        company_emp_ids = [e.id for e in db.query(Employee.id).filter(Employee.company_id == current_user.company_id).all()]
        query = db.query(LeaveRequest).filter(LeaveRequest.employee_id.in_(company_emp_ids)) if company_emp_ids else db.query(LeaveRequest).filter(False)
    if status_filter:
        query = query.filter(LeaveRequest.status == status_filter)
    requests = query.order_by(LeaveRequest.created_at.desc()).all()
    result = []
    for r in requests:
        emp = db.query(Employee).filter(Employee.id == r.employee_id).first()
        lt = db.query(LeaveType).filter(LeaveType.id == r.leave_type_id).first()
        result.append({"id": r.id, "employee_id": r.employee_id, "employee_name": f"{emp.first_name} {emp.last_name}" if emp else "", "leave_type_id": r.leave_type_id, "leave_type_name": lt.name if lt else "", "start_date": str(r.start_date), "end_date": str(r.end_date), "reason": r.reason, "status": r.status.value, "approved_by": r.approved_by, "created_at": str(r.created_at)})
    return result


@router.put("/requests/{request_id}/approve")
def approve_leave(request_id: int, current_user: User = Depends(require_roles("admin", "hr_officer", "payroll_officer")), db: Session = Depends(get_db)):
    req = db.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if req.status != LeaveStatus.PENDING:
        raise HTTPException(status_code=400, detail="Leave request is not pending")
    days = (req.end_date - req.start_date).days + 1
    balance = db.query(LeaveBalance).filter(LeaveBalance.employee_id == req.employee_id, LeaveBalance.leave_type_id == req.leave_type_id).first()
    if balance:
        balance.used += days
        balance.remaining -= days
    req.status = LeaveStatus.APPROVED
    req.approved_by = current_user.id
    # Mark attendance as on_leave
    current = req.start_date
    from datetime import timedelta
    while current <= req.end_date:
        existing = db.query(Attendance).filter(Attendance.employee_id == req.employee_id, Attendance.date == current).first()
        if not existing:
            att = Attendance(employee_id=req.employee_id, date=current, status=AttendanceStatus.ON_LEAVE)
            db.add(att)
        else:
            existing.status = AttendanceStatus.ON_LEAVE
        current += timedelta(days=1)
    db.commit()
    return {"message": "Leave approved"}


@router.put("/requests/{request_id}/reject")
def reject_leave(request_id: int, current_user: User = Depends(require_roles("admin", "hr_officer", "payroll_officer")), db: Session = Depends(get_db)):
    req = db.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    req.status = LeaveStatus.REJECTED
    req.approved_by = current_user.id
    db.commit()
    return {"message": "Leave rejected"}
