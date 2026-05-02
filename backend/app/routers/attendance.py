from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
import calendar
from app.database import get_db
from app.models.user import User
from app.models.employee import Employee
from app.models.attendance import Attendance, AttendanceSession, AttendanceStatus
from app.utils.security import get_current_user
from app.utils.permissions import require_roles
from app.services.attendance_service import (
    login_session,
    logout_session,
    get_today_status,
    get_employee_attendance,
    get_sessions_for_date,
    auto_close_all_open_sessions,
    close_open_sessions_for_date,
    _recompute_daily_summary,
)

router = APIRouter(prefix="/attendance", tags=["Attendance"])


# ─────────────────────────────────────────────
# Employee: Login / Logout (session-based)
# ─────────────────────────────────────────────

@router.post("/login")
def attendance_login(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new attendance session (called on user login)."""
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found")

    session, error = login_session(db, emp.id)
    if error and "Already have" in error:
        # Return the existing open session with the advisory message instead of 400
        return {
            "message": error,
            "session": {
                "id": session.id,
                "login_time": session.login_time.isoformat(),
                "logout_time": None,
                "date": str(session.date),
                "is_auto_closed": session.is_auto_closed,
            },
        }

    return {
        "message": "Session started",
        "session": {
            "id": session.id,
            "login_time": session.login_time.isoformat(),
            "logout_time": None,
            "date": str(session.date),
            "is_auto_closed": session.is_auto_closed,
        },
    }


@router.post("/logout")
def attendance_logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Close the active attendance session (called on user logout)."""
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found")

    session, error = logout_session(db, emp.id)
    if error:
        raise HTTPException(status_code=400, detail=error)

    return {
        "message": "Session closed",
        "session": {
            "id": session.id,
            "login_time": session.login_time.isoformat(),
            "logout_time": session.logout_time.isoformat(),
            "duration_minutes": round(session.duration_minutes, 2) if session.duration_minutes else 0,
            "date": str(session.date),
            "is_auto_closed": session.is_auto_closed,
        },
    }


# Keep legacy check-in / check-out as aliases for backward compatibility
@router.post("/check-in")
def mark_check_in(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return attendance_login(current_user=current_user, db=db)


@router.post("/check-out")
def mark_check_out(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return attendance_logout(current_user=current_user, db=db)


# ─────────────────────────────────────────────
# Employee: Today's status
# ─────────────────────────────────────────────

@router.get("/today")
def get_today_attendance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found")
    return get_today_status(db, emp.id)


# ─────────────────────────────────────────────
# Employee: My attendance history (daily summaries)
# ─────────────────────────────────────────────

@router.get("/my")
def get_my_attendance(
    month: int = None,
    year: int = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found")
    return get_employee_attendance(db, emp.id, month, year)


# ─────────────────────────────────────────────
# Employee: Sessions for a specific date
# ─────────────────────────────────────────────

@router.get("/my/sessions")
def get_my_sessions(
    target_date: date = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found")
    d = target_date or date.today()
    return get_sessions_for_date(db, emp.id, d)


# ─────────────────────────────────────────────
# Admin / HR: All attendance (daily summaries)
# ─────────────────────────────────────────────

@router.get("/all")
def get_all_attendance(
    month: int = None,
    year: int = None,
    current_user: User = Depends(require_roles("admin", "hr_officer", "payroll_officer")),
    db: Session = Depends(get_db),
):
    company_emp_ids = [
        e.id for e in db.query(Employee.id).filter(Employee.company_id == current_user.company_id).all()
    ]
    if not company_emp_ids:
        return []

    query = db.query(Attendance).filter(Attendance.employee_id.in_(company_emp_ids))
    if month:
        query = query.filter(func.strftime('%m', Attendance.date) == f"{month:02d}")
    if year:
        query = query.filter(func.strftime('%Y', Attendance.date) == str(year))

    records = query.order_by(Attendance.date.desc()).all()
    result = []
    for r in records:
        emp = db.query(Employee).filter(Employee.id == r.employee_id).first()
        sessions = get_sessions_for_date(db, r.employee_id, r.date)
        result.append({
            "id": r.id,
            "employee_id": r.employee_id,
            "employee_name": f"{emp.first_name} {emp.last_name}" if emp else "Unknown",
            "emp_code": emp.emp_code if emp else "",
            "date": str(r.date),
            "total_hours": round(r.total_hours, 2) if r.total_hours else 0.0,
            "status": r.status.value,
            "sessions": sessions,
        })
    return result


# ─────────────────────────────────────────────
# Admin / HR: Sessions for a specific employee+date
# ─────────────────────────────────────────────

@router.get("/sessions/{employee_id}")
def get_employee_sessions(
    employee_id: int,
    target_date: date = None,
    current_user: User = Depends(require_roles("admin", "hr_officer", "payroll_officer")),
    db: Session = Depends(get_db),
):
    d = target_date or date.today()
    return get_sessions_for_date(db, employee_id, d)


# ─────────────────────────────────────────────
# Admin: Monthly summary
# ─────────────────────────────────────────────

@router.get("/monthly-summary/{employee_id}")
def get_monthly_summary(
    employee_id: int,
    month: int,
    year: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Employees can only view their own summary
    if current_user.role.value == "employee":
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp or emp.id != employee_id:
            raise HTTPException(status_code=403, detail="You can only view your own attendance summary")
    else:
        # Admin/HR/Payroll: verify employee belongs to same company
        emp = db.query(Employee).filter(
            Employee.id == employee_id,
            Employee.company_id == current_user.company_id,
        ).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

    records = db.query(Attendance).filter(
        Attendance.employee_id == employee_id,
        func.strftime('%m', Attendance.date) == f"{month:02d}",
        func.strftime('%Y', Attendance.date) == str(year),
    ).all()

    present = sum(1 for r in records if r.status == AttendanceStatus.PRESENT)
    absent = sum(1 for r in records if r.status == AttendanceStatus.ABSENT)
    half_days = sum(1 for r in records if r.status == AttendanceStatus.HALF_DAY)
    on_leave = sum(1 for r in records if r.status == AttendanceStatus.ON_LEAVE)
    total_hours = sum(r.total_hours or 0.0 for r in records)
    _, total_days = calendar.monthrange(year, month)

    return {
        "month": month,
        "year": year,
        "total_days": total_days,
        "present": present,
        "absent": absent,
        "half_days": half_days,
        "on_leave": on_leave,
        "total_hours": round(total_hours, 2),
    }


# ─────────────────────────────────────────────
# Admin: Auto-close all dangling sessions
# ─────────────────────────────────────────────

@router.post("/admin/auto-close-sessions")
def admin_auto_close_sessions(
    current_user: User = Depends(require_roles("admin", "hr_officer")),
    db: Session = Depends(get_db),
):
    """Close all open sessions from previous dates for the entire company."""
    count = auto_close_all_open_sessions(db)
    return {"message": f"Auto-closed {count} session(s)"}


# ─────────────────────────────────────────────
# Admin: Recompute a specific employee's day summary
# ─────────────────────────────────────────────

@router.post("/admin/recompute/{employee_id}")
def admin_recompute_summary(
    employee_id: int,
    target_date: date,
    current_user: User = Depends(require_roles("admin", "hr_officer")),
    db: Session = Depends(get_db),
):
    """Force-recompute the daily attendance summary for an employee on a date."""
    summary = _recompute_daily_summary(db, employee_id, target_date)
    return {
        "message": "Recomputed",
        "date": str(summary.date),
        "total_hours": summary.total_hours,
        "status": summary.status.value,
    }
