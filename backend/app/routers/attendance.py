from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
import calendar
from app.database import get_db
from app.models.user import User
from app.models.employee import Employee
from app.models.attendance import Attendance, AttendanceStatus
from app.utils.security import get_current_user
from app.utils.permissions import require_roles
from app.services.attendance_service import check_in, check_out

router = APIRouter(prefix="/attendance", tags=["Attendance"])


@router.post("/check-in")
def mark_check_in(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found")
    record, error = check_in(db, emp.id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"message": "Checked in successfully", "record": {"id": record.id, "date": str(record.date), "check_in": str(record.check_in) if record.check_in else None, "status": record.status.value}}


@router.post("/check-out")
def mark_check_out(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found")
    record, error = check_out(db, emp.id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"message": "Checked out successfully", "record": {"id": record.id, "date": str(record.date), "check_in": str(record.check_in) if record.check_in else None, "check_out": str(record.check_out) if record.check_out else None, "status": record.status.value}}


@router.get("/today")
def get_today_attendance(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found")
    today = date.today()
    record = db.query(Attendance).filter(Attendance.employee_id == emp.id, Attendance.date == today).first()
    if not record:
        return {"checked_in": False, "record": None}
    return {"checked_in": True, "checked_out": record.check_out is not None, "record": {"id": record.id, "date": str(record.date), "check_in": str(record.check_in) if record.check_in else None, "check_out": str(record.check_out) if record.check_out else None, "status": record.status.value}}


@router.get("/my")
def get_my_attendance(month: int = None, year: int = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found")
    query = db.query(Attendance).filter(Attendance.employee_id == emp.id)
    if month:
        query = query.filter(func.extract('month', Attendance.date) == month)
    if year:
        query = query.filter(func.extract('year', Attendance.date) == year)
    records = query.order_by(Attendance.date.desc()).all()
    return [{"id": r.id, "date": str(r.date), "check_in": str(r.check_in) if r.check_in else None, "check_out": str(r.check_out) if r.check_out else None, "status": r.status.value} for r in records]


@router.get("/all")
def get_all_attendance(month: int = None, year: int = None, current_user: User = Depends(require_roles("admin", "hr_officer", "payroll_officer")), db: Session = Depends(get_db)):
    # Scope to company employees
    company_emp_ids = [e.id for e in db.query(Employee.id).filter(Employee.company_id == current_user.company_id).all()]
    query = db.query(Attendance).filter(Attendance.employee_id.in_(company_emp_ids)) if company_emp_ids else db.query(Attendance).filter(False)
    if month:
        query = query.filter(func.extract('month', Attendance.date) == month)
    if year:
        query = query.filter(func.extract('year', Attendance.date) == year)
    records = query.order_by(Attendance.date.desc()).all()
    result = []
    for r in records:
        emp = db.query(Employee).filter(Employee.id == r.employee_id).first()
        result.append({"id": r.id, "employee_id": r.employee_id, "employee_name": f"{emp.first_name} {emp.last_name}" if emp else "Unknown", "emp_code": emp.emp_code if emp else "", "date": str(r.date), "check_in": str(r.check_in) if r.check_in else None, "check_out": str(r.check_out) if r.check_out else None, "status": r.status.value})
    return result


@router.get("/monthly-summary/{employee_id}")
def get_monthly_summary(employee_id: int, month: int, year: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.query(Attendance).filter(Attendance.employee_id == employee_id, func.extract('month', Attendance.date) == month, func.extract('year', Attendance.date) == year).all()
    present = sum(1 for r in records if r.status == AttendanceStatus.PRESENT)
    absent = sum(1 for r in records if r.status == AttendanceStatus.ABSENT)
    half_days = sum(1 for r in records if r.status == AttendanceStatus.HALF_DAY)
    on_leave = sum(1 for r in records if r.status == AttendanceStatus.ON_LEAVE)
    _, total_days = calendar.monthrange(year, month)
    return {"month": month, "year": year, "total_days": total_days, "present": present, "absent": absent, "half_days": half_days, "on_leave": on_leave}
