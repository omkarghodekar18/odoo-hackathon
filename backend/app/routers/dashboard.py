from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime, timedelta
from app.database import get_db
from app.models.user import User
from app.models.employee import Employee
from app.models.attendance import Attendance, AttendanceStatus, AttendanceSession
from app.models.leave import LeaveRequest, LeaveStatus, LeaveBalance
from app.models.payroll import Payrun, Payslip
from app.utils.security import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


def _company_employees(db, company_id):
    """Get employee IDs for a company."""
    return [e.id for e in db.query(Employee.id).filter(Employee.company_id == company_id).all()]


@router.get("/stats")
def get_dashboard_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = date.today()
    emp_ids = _company_employees(db, current_user.company_id)

    total_employees = len(emp_ids)
    today_present = db.query(Attendance).filter(Attendance.date == today, Attendance.status == AttendanceStatus.PRESENT, Attendance.employee_id.in_(emp_ids)).count() if emp_ids else 0
    pending_leaves = db.query(LeaveRequest).filter(LeaveRequest.status == LeaveStatus.PENDING, LeaveRequest.employee_id.in_(emp_ids)).count() if emp_ids else 0
    total_payroll = db.query(func.sum(Payslip.net_pay)).filter(Payslip.employee_id.in_(emp_ids)).scalar() or 0 if emp_ids else 0

    if current_user.role.value == "employee":
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        my_attendance_this_month = 0
        if emp:
            my_attendance_this_month = db.query(Attendance).filter(
                Attendance.employee_id == emp.id,
                func.strftime('%m', Attendance.date) == f"{today.month:02d}",
                func.strftime('%Y', Attendance.date) == str(today.year),
                Attendance.status == AttendanceStatus.PRESENT
            ).count()
        my_pending_leaves = db.query(LeaveRequest).filter(LeaveRequest.employee_id == emp.id, LeaveRequest.status == LeaveStatus.PENDING).count() if emp else 0
        return {"total_employees": total_employees, "today_present": today_present, "my_attendance_this_month": my_attendance_this_month, "my_pending_leaves": my_pending_leaves, "role": "employee"}

    return {"total_employees": total_employees, "today_present": today_present, "today_attendance_pct": round((today_present / total_employees * 100), 1) if total_employees > 0 else 0, "pending_leaves": pending_leaves, "total_payroll": round(total_payroll, 2), "role": current_user.role.value}


@router.get("/analytics")
def get_full_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Comprehensive dashboard analytics for admin/hr overview."""
    today = date.today()
    company_id = current_user.company_id
    emp_ids = _company_employees(db, company_id)
    total_employees = len(emp_ids)

    # ── KPI Stats ──
    today_present = 0
    today_on_leave = 0
    today_absent = 0
    if emp_ids:
        today_present = db.query(Attendance).filter(
            Attendance.date == today,
            Attendance.status == AttendanceStatus.PRESENT,
            Attendance.employee_id.in_(emp_ids)
        ).count()
        today_on_leave = db.query(LeaveRequest).filter(
            LeaveRequest.status == LeaveStatus.APPROVED,
            LeaveRequest.start_date <= today,
            LeaveRequest.end_date >= today,
            LeaveRequest.employee_id.in_(emp_ids)
        ).count()
        # Also check attendance sessions today
        today_checked_in = db.query(AttendanceSession).filter(
            AttendanceSession.date == today,
            AttendanceSession.employee_id.in_(emp_ids)
        ).with_entities(AttendanceSession.employee_id).distinct().count()
        today_present = max(today_present, today_checked_in)
        today_absent = max(0, total_employees - today_present - today_on_leave)

    pending_leaves = db.query(LeaveRequest).filter(
        LeaveRequest.status == LeaveStatus.PENDING,
        LeaveRequest.employee_id.in_(emp_ids)
    ).count() if emp_ids else 0

    # ── Department Distribution ──
    departments = db.query(
        Employee.department, func.count(Employee.id)
    ).filter(Employee.company_id == company_id).group_by(Employee.department).all()
    dept_colors = ['#0d9488', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']
    department_data = [
        {"name": d[0], "value": d[1], "color": dept_colors[i % len(dept_colors)]}
        for i, d in enumerate(departments)
    ]

    # ── Monthly Attendance Trend (last 6 months) ──
    attendance_trend = []
    for i in range(5, -1, -1):
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        label = f"{MONTH_NAMES[m-1]} '{str(y)[2:]}"
        present_count = 0
        absent_count = 0
        if emp_ids:
            present_count = db.query(Attendance).filter(
                func.strftime('%m', Attendance.date) == f"{m:02d}",
                func.strftime('%Y', Attendance.date) == str(y),
                Attendance.status == AttendanceStatus.PRESENT,
                Attendance.employee_id.in_(emp_ids)
            ).count()
            total_att = db.query(Attendance).filter(
                func.strftime('%m', Attendance.date) == f"{m:02d}",
                func.strftime('%Y', Attendance.date) == str(y),
                Attendance.employee_id.in_(emp_ids)
            ).count()
            absent_count = max(0, total_att - present_count)
        attendance_trend.append({"label": label, "present": present_count, "absent": absent_count})

    # ── Leave Stats ──
    leave_approved = 0
    leave_rejected = 0
    leave_pending = 0
    if emp_ids:
        leave_approved = db.query(LeaveRequest).filter(
            LeaveRequest.status == LeaveStatus.APPROVED,
            LeaveRequest.employee_id.in_(emp_ids)
        ).count()
        leave_rejected = db.query(LeaveRequest).filter(
            LeaveRequest.status == LeaveStatus.REJECTED,
            LeaveRequest.employee_id.in_(emp_ids)
        ).count()
        leave_pending = pending_leaves
    leave_chart = [
        {"name": "Approved", "value": leave_approved, "color": "#10b981"},
        {"name": "Rejected", "value": leave_rejected, "color": "#f43f5e"},
        {"name": "Pending", "value": leave_pending, "color": "#f59e0b"},
    ]

    # ── Payroll Monthly Trend (last 6 months) ──
    payroll_trend = []
    for i in range(5, -1, -1):
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        label = f"{MONTH_NAMES[m-1]} '{str(y)[2:]}"
        payrun = db.query(Payrun).filter(
            Payrun.company_id == company_id,
            Payrun.month == m, Payrun.year == y,
        ).first()
        payroll_trend.append({
            "label": label,
            "total_cost": round(payrun.total_amount, 2) if payrun else 0,
            "employee_count": payrun.employee_count if payrun else 0,
        })

    # ── Total payroll cost this year ──
    total_payroll_year = db.query(func.sum(Payrun.total_amount)).filter(
        Payrun.company_id == company_id,
        Payrun.year == today.year,
    ).scalar() or 0

    # ── Average salary ──
    avg_salary = 0
    if total_employees > 0:
        total_salary = db.query(func.sum(Employee.basic_salary)).filter(
            Employee.company_id == company_id
        ).scalar() or 0
        avg_salary = round(total_salary / total_employees, 2)

    # ── Recent Hires (last 5) ──
    recent_hires = db.query(Employee).filter(
        Employee.company_id == company_id
    ).order_by(Employee.date_of_joining.desc()).limit(5).all()
    recent_hires_data = [
        {
            "id": e.id,
            "name": f"{e.first_name} {e.last_name}",
            "department": e.department,
            "designation": e.designation,
            "date_of_joining": str(e.date_of_joining),
        }
        for e in recent_hires
    ]

    # ── Top Earners (top 5 by salary) ──
    top_earners = db.query(Employee).filter(
        Employee.company_id == company_id
    ).order_by(Employee.basic_salary.desc()).limit(5).all()
    top_earners_data = [
        {
            "id": e.id,
            "name": f"{e.first_name} {e.last_name}",
            "department": e.department,
            "salary": e.basic_salary or 0,
        }
        for e in top_earners
    ]

    return {
        "kpi": {
            "total_employees": total_employees,
            "today_present": today_present,
            "today_on_leave": today_on_leave,
            "today_absent": today_absent,
            "pending_leaves": pending_leaves,
            "avg_salary": avg_salary,
            "total_payroll_year": round(total_payroll_year, 2),
            "attendance_pct": round((today_present / total_employees * 100), 1) if total_employees > 0 else 0,
        },
        "department_distribution": department_data,
        "attendance_trend": attendance_trend,
        "leave_chart": leave_chart,
        "payroll_trend": payroll_trend,
        "recent_hires": recent_hires_data,
        "top_earners": top_earners_data,
    }


@router.get("/attendance-chart")
def get_attendance_chart(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = date.today()
    emp_ids = _company_employees(db, current_user.company_id)
    data = []
    months_labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    for m in range(1, 13):
        if emp_ids:
            base = db.query(Attendance).filter(
                func.strftime('%m', Attendance.date) == f"{m:02d}",
                func.strftime('%Y', Attendance.date) == str(today.year),
                Attendance.employee_id.in_(emp_ids)
            )
            present = base.filter(Attendance.status == AttendanceStatus.PRESENT).count()
            absent = base.filter(Attendance.status == AttendanceStatus.ABSENT).count()
            on_leave = base.filter(Attendance.status == AttendanceStatus.ON_LEAVE).count()
        else:
            present = absent = on_leave = 0
        data.append({"month": months_labels[m-1], "present": present, "absent": absent, "on_leave": on_leave})
    return data


@router.get("/leave-chart")
def get_leave_chart(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    emp_ids = _company_employees(db, current_user.company_id)
    if emp_ids:
        approved = db.query(LeaveRequest).filter(LeaveRequest.status == LeaveStatus.APPROVED, LeaveRequest.employee_id.in_(emp_ids)).count()
        rejected = db.query(LeaveRequest).filter(LeaveRequest.status == LeaveStatus.REJECTED, LeaveRequest.employee_id.in_(emp_ids)).count()
        pending = db.query(LeaveRequest).filter(LeaveRequest.status == LeaveStatus.PENDING, LeaveRequest.employee_id.in_(emp_ids)).count()
    else:
        approved = rejected = pending = 0
    return [{"name": "Approved", "value": approved, "color": "#10b981"}, {"name": "Rejected", "value": rejected, "color": "#f43f5e"}, {"name": "Pending", "value": pending, "color": "#f59e0b"}]


@router.get("/payroll-summary")
def get_payroll_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role.value not in ["admin", "payroll_officer"]:
        raise HTTPException(status_code=403, detail="Access denied")
    payruns = db.query(Payrun).filter(Payrun.created_by.in_(
        [u.id for u in db.query(User.id).filter(User.company_id == current_user.company_id).all()]
    )).order_by(Payrun.year.desc(), Payrun.month.desc()).limit(12).all()
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return [{"month": months[p.month-1], "year": p.year, "total": p.total_amount, "status": p.status.value} for p in payruns]


@router.get("/department-stats")
def get_department_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    departments = db.query(Employee.department, func.count(Employee.id)).filter(Employee.company_id == current_user.company_id).group_by(Employee.department).all()
    return [{"department": d[0], "count": d[1]} for d in departments]
