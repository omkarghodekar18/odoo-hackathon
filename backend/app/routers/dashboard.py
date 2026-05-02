from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime
from app.database import get_db
from app.models.user import User
from app.models.employee import Employee
from app.models.attendance import Attendance, AttendanceStatus
from app.models.leave import LeaveRequest, LeaveStatus
from app.models.payroll import Payrun, Payslip
from app.utils.security import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_dashboard_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = date.today()
    total_employees = db.query(Employee).count()
    today_present = db.query(Attendance).filter(Attendance.date == today, Attendance.status == AttendanceStatus.PRESENT).count()
    pending_leaves = db.query(LeaveRequest).filter(LeaveRequest.status == LeaveStatus.PENDING).count()
    total_payroll = db.query(func.sum(Payslip.net_pay)).scalar() or 0

    if current_user.role.value == "employee":
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        my_attendance_this_month = 0
        if emp:
            my_attendance_this_month = db.query(Attendance).filter(Attendance.employee_id == emp.id, func.extract('month', Attendance.date) == today.month, func.extract('year', Attendance.date) == today.year, Attendance.status == AttendanceStatus.PRESENT).count()
        my_pending_leaves = db.query(LeaveRequest).filter(LeaveRequest.employee_id == emp.id, LeaveRequest.status == LeaveStatus.PENDING).count() if emp else 0
        return {"total_employees": total_employees, "today_present": today_present, "my_attendance_this_month": my_attendance_this_month, "my_pending_leaves": my_pending_leaves, "role": "employee"}

    return {"total_employees": total_employees, "today_present": today_present, "today_attendance_pct": round((today_present / total_employees * 100), 1) if total_employees > 0 else 0, "pending_leaves": pending_leaves, "total_payroll": round(total_payroll, 2), "role": current_user.role.value}


@router.get("/attendance-chart")
def get_attendance_chart(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = date.today()
    data = []
    for m in range(1, 13):
        present = db.query(Attendance).filter(func.extract('month', Attendance.date) == m, func.extract('year', Attendance.date) == today.year, Attendance.status == AttendanceStatus.PRESENT).count()
        absent = db.query(Attendance).filter(func.extract('month', Attendance.date) == m, func.extract('year', Attendance.date) == today.year, Attendance.status == AttendanceStatus.ABSENT).count()
        on_leave = db.query(Attendance).filter(func.extract('month', Attendance.date) == m, func.extract('year', Attendance.date) == today.year, Attendance.status == AttendanceStatus.ON_LEAVE).count()
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        data.append({"month": months[m-1], "present": present, "absent": absent, "on_leave": on_leave})
    return data


@router.get("/leave-chart")
def get_leave_chart(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    approved = db.query(LeaveRequest).filter(LeaveRequest.status == LeaveStatus.APPROVED).count()
    rejected = db.query(LeaveRequest).filter(LeaveRequest.status == LeaveStatus.REJECTED).count()
    pending = db.query(LeaveRequest).filter(LeaveRequest.status == LeaveStatus.PENDING).count()
    return [{"name": "Approved", "value": approved, "color": "#10b981"}, {"name": "Rejected", "value": rejected, "color": "#f43f5e"}, {"name": "Pending", "value": pending, "color": "#f59e0b"}]


@router.get("/payroll-summary")
def get_payroll_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role.value not in ["admin", "payroll_officer"]:
        raise HTTPException(status_code=403, detail="Access denied")
    payruns = db.query(Payrun).order_by(Payrun.year.desc(), Payrun.month.desc()).limit(12).all()
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return [{"month": months[p.month-1], "year": p.year, "total": p.total_amount, "status": p.status.value} for p in payruns]


@router.get("/department-stats")
def get_department_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    departments = db.query(Employee.department, func.count(Employee.id)).group_by(Employee.department).all()
    return [{"department": d[0], "count": d[1]} for d in departments]
