from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.employee import Employee
from app.models.leave import LeaveType, LeaveBalance, LeaveRequest, LeaveStatus
from app.models.attendance import Attendance, AttendanceStatus
from app.schemas.leave import (
    LeaveTypeCreate, LeaveTypeUpdate, LeaveTypeResponse,
    LeaveBalanceResponse, LeaveAllocationCreate,
    LeaveRequestCreate, LeaveRequestResponse,
)
from app.utils.security import get_current_user
from app.utils.permissions import require_roles
from datetime import date, timedelta
from typing import Optional

router = APIRouter(prefix="/leave", tags=["Leave"])


# ──────────────────────────────────────────────
# Leave Types — CRUD (admin / hr_officer only for write)
# ──────────────────────────────────────────────

@router.get("/types")
def list_leave_types(db: Session = Depends(get_db)):
    """Public — anyone authenticated can list leave types."""
    return [
        {"id": lt.id, "name": lt.name, "max_days_per_year": lt.max_days_per_year, "description": lt.description}
        for lt in db.query(LeaveType).all()
    ]


@router.post("/types")
def create_leave_type(
    data: LeaveTypeCreate,
    current_user: User = Depends(require_roles("admin", "hr_officer")),
    db: Session = Depends(get_db),
):
    existing = db.query(LeaveType).filter(LeaveType.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Leave type already exists")
    lt = LeaveType(**data.model_dump())
    db.add(lt)
    db.commit()
    db.refresh(lt)
    return {"id": lt.id, "name": lt.name, "max_days_per_year": lt.max_days_per_year, "description": lt.description}


@router.put("/types/{type_id}")
def update_leave_type(
    type_id: int,
    data: LeaveTypeUpdate,
    current_user: User = Depends(require_roles("admin", "hr_officer")),
    db: Session = Depends(get_db),
):
    lt = db.query(LeaveType).filter(LeaveType.id == type_id).first()
    if not lt:
        raise HTTPException(status_code=404, detail="Leave type not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(lt, key, value)
    db.commit()
    db.refresh(lt)
    return {"id": lt.id, "name": lt.name, "max_days_per_year": lt.max_days_per_year, "description": lt.description}


@router.delete("/types/{type_id}")
def delete_leave_type(
    type_id: int,
    current_user: User = Depends(require_roles("admin", "hr_officer")),
    db: Session = Depends(get_db),
):
    lt = db.query(LeaveType).filter(LeaveType.id == type_id).first()
    if not lt:
        raise HTTPException(status_code=404, detail="Leave type not found")
    # Check for existing requests using this type
    has_requests = db.query(LeaveRequest).filter(LeaveRequest.leave_type_id == type_id).first()
    if has_requests:
        raise HTTPException(status_code=400, detail="Cannot delete — leave type has existing requests")
    db.query(LeaveBalance).filter(LeaveBalance.leave_type_id == type_id).delete()
    db.delete(lt)
    db.commit()
    return {"message": "Leave type deleted"}


# ──────────────────────────────────────────────
# Leave Balance
# ──────────────────────────────────────────────

@router.get("/balance")
def get_my_leave_balance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the logged-in employee's own leave balance."""
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found")
    balances = db.query(LeaveBalance).filter(LeaveBalance.employee_id == emp.id).all()
    result = []
    for b in balances:
        lt = db.query(LeaveType).filter(LeaveType.id == b.leave_type_id).first()
        result.append({
            "id": b.id, "employee_id": b.employee_id,
            "leave_type_id": b.leave_type_id,
            "leave_type_name": lt.name if lt else "",
            "allocated": b.allocated, "used": b.used, "remaining": b.remaining,
        })
    return result


@router.get("/balance/{employee_id}")
def get_employee_leave_balance(
    employee_id: int,
    current_user: User = Depends(require_roles("admin", "hr_officer")),
    db: Session = Depends(get_db),
):
    """Admin/HR can view any employee's balance (within same company)."""
    emp = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.company_id == current_user.company_id,
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found in your company")
    balances = db.query(LeaveBalance).filter(LeaveBalance.employee_id == employee_id).all()
    result = []
    for b in balances:
        lt = db.query(LeaveType).filter(LeaveType.id == b.leave_type_id).first()
        result.append({
            "id": b.id, "employee_id": b.employee_id,
            "employee_name": f"{emp.first_name} {emp.last_name}",
            "leave_type_id": b.leave_type_id,
            "leave_type_name": lt.name if lt else "",
            "allocated": b.allocated, "used": b.used, "remaining": b.remaining,
        })
    return result


@router.get("/balance-all")
def get_all_leave_balances(
    current_user: User = Depends(require_roles("admin", "hr_officer")),
    db: Session = Depends(get_db),
):
    """Admin/HR — get all employees' leave balances for the dashboard panel."""
    company_emps = db.query(Employee).filter(Employee.company_id == current_user.company_id).all()
    result = []
    for emp in company_emps:
        balances = db.query(LeaveBalance).filter(LeaveBalance.employee_id == emp.id).all()
        for b in balances:
            lt = db.query(LeaveType).filter(LeaveType.id == b.leave_type_id).first()
            result.append({
                "id": b.id, "employee_id": emp.id,
                "employee_name": f"{emp.first_name} {emp.last_name}",
                "leave_type_id": b.leave_type_id,
                "leave_type_name": lt.name if lt else "",
                "allocated": b.allocated, "used": b.used, "remaining": b.remaining,
            })
    return result


@router.post("/allocate")
def allocate_leave(
    data: LeaveAllocationCreate,
    current_user: User = Depends(require_roles("admin", "hr_officer")),
    db: Session = Depends(get_db),
):
    """Admin/HR — allocate leave balance for an employee."""
    emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    lt = db.query(LeaveType).filter(LeaveType.id == data.leave_type_id).first()
    if not lt:
        raise HTTPException(status_code=404, detail="Leave type not found")
    if data.allocated > lt.max_days_per_year:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot allocate more than {lt.max_days_per_year} days for {lt.name}",
        )
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.employee_id == data.employee_id,
        LeaveBalance.leave_type_id == data.leave_type_id,
    ).first()
    if balance:
        balance.allocated = data.allocated
        balance.remaining = data.allocated - balance.used
    else:
        balance = LeaveBalance(
            employee_id=data.employee_id,
            leave_type_id=data.leave_type_id,
            allocated=data.allocated,
            used=0,
            remaining=data.allocated,
        )
        db.add(balance)
    db.commit()
    return {"message": f"Allocated {data.allocated} days of {lt.name}"}


# ──────────────────────────────────────────────
# Employees list (for filter dropdowns)
# ──────────────────────────────────────────────

@router.get("/employees")
def list_employees_for_leave(
    current_user: User = Depends(require_roles("admin", "hr_officer")),
    db: Session = Depends(get_db),
):
    """Admin/HR — list employees for filter dropdown."""
    employees = db.query(Employee).filter(Employee.company_id == current_user.company_id).all()
    return [
        {"id": e.id, "name": f"{e.first_name} {e.last_name}", "emp_code": e.emp_code, "department": e.department}
        for e in employees
    ]


# ──────────────────────────────────────────────
# Apply for leave (any authenticated user)
# ──────────────────────────────────────────────

@router.post("/apply")
def apply_leave(
    data: LeaveRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found")
    if data.end_date < data.start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")
    days = (data.end_date - data.start_date).days + 1
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.employee_id == emp.id,
        LeaveBalance.leave_type_id == data.leave_type_id,
    ).first()
    if balance and balance.remaining < days:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient leave balance. Available: {balance.remaining}, Requested: {days}",
        )
    request = LeaveRequest(
        employee_id=emp.id, leave_type_id=data.leave_type_id,
        start_date=data.start_date, end_date=data.end_date,
        reason=data.reason, status=LeaveStatus.PENDING,
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return {"message": "Leave application submitted", "id": request.id}


# ──────────────────────────────────────────────
# List leave requests (RBAC scoped)
# ──────────────────────────────────────────────

@router.get("/requests")
def list_leave_requests(
    status_filter: Optional[str] = None,
    employee_id: Optional[int] = None,
    leave_type_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Employee → only their own requests.
    Admin / HR Officer → all company requests, with optional filters.
    """
    if current_user.role.value == "employee":
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp:
            return []
        query = db.query(LeaveRequest).filter(LeaveRequest.employee_id == emp.id)
    else:
        # Admin / HR Officer: scope to company
        company_emp_ids = [
            e.id for e in
            db.query(Employee.id).filter(Employee.company_id == current_user.company_id).all()
        ]
        if company_emp_ids:
            query = db.query(LeaveRequest).filter(LeaveRequest.employee_id.in_(company_emp_ids))
        else:
            query = db.query(LeaveRequest).filter(False)

        # Optional employee filter
        if employee_id:
            query = query.filter(LeaveRequest.employee_id == employee_id)

    # Common filters
    if status_filter:
        query = query.filter(LeaveRequest.status == status_filter)
    if leave_type_id:
        query = query.filter(LeaveRequest.leave_type_id == leave_type_id)

    requests = query.order_by(LeaveRequest.created_at.desc()).all()
    result = []
    for r in requests:
        emp = db.query(Employee).filter(Employee.id == r.employee_id).first()
        lt = db.query(LeaveType).filter(LeaveType.id == r.leave_type_id).first()
        result.append({
            "id": r.id, "employee_id": r.employee_id,
            "employee_name": f"{emp.first_name} {emp.last_name}" if emp else "",
            "leave_type_id": r.leave_type_id,
            "leave_type_name": lt.name if lt else "",
            "start_date": str(r.start_date), "end_date": str(r.end_date),
            "reason": r.reason, "status": r.status.value,
            "approved_by": r.approved_by,
            "created_at": str(r.created_at),
        })
    return result


# ──────────────────────────────────────────────
# Approve / Reject  —  ADMIN + HR_OFFICER ONLY
# ──────────────────────────────────────────────

@router.put("/requests/{request_id}/approve")
def approve_leave(
    request_id: int,
    current_user: User = Depends(require_roles("admin", "hr_officer")),
    db: Session = Depends(get_db),
):
    req = db.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if req.status != LeaveStatus.PENDING:
        raise HTTPException(status_code=400, detail="Leave request is not pending")

    days = (req.end_date - req.start_date).days + 1
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.employee_id == req.employee_id,
        LeaveBalance.leave_type_id == req.leave_type_id,
    ).first()
    if balance:
        balance.used += days
        balance.remaining -= days

    req.status = LeaveStatus.APPROVED
    req.approved_by = current_user.id

    # Mark attendance as on_leave for approved date range
    current = req.start_date
    while current <= req.end_date:
        existing = db.query(Attendance).filter(
            Attendance.employee_id == req.employee_id,
            Attendance.date == current,
        ).first()
        if not existing:
            att = Attendance(employee_id=req.employee_id, date=current, status=AttendanceStatus.ON_LEAVE)
            db.add(att)
        else:
            existing.status = AttendanceStatus.ON_LEAVE
        current += timedelta(days=1)

    db.commit()
    return {"message": "Leave approved"}


@router.put("/requests/{request_id}/reject")
def reject_leave(
    request_id: int,
    current_user: User = Depends(require_roles("admin", "hr_officer")),
    db: Session = Depends(get_db),
):
    req = db.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if req.status != LeaveStatus.PENDING:
        raise HTTPException(status_code=400, detail="Leave request is not pending")
    req.status = LeaveStatus.REJECTED
    req.approved_by = current_user.id
    db.commit()
    return {"message": "Leave rejected"}
