"""
Session-based attendance service.

Flow:
  login  → create AttendanceSession(login_time=now)
  logout → set logout_time, compute duration_minutes, recompute daily summary

Rules for daily status (based on total_hours):
  ≥ 8 hrs  → PRESENT
  4–8 hrs  → HALF_DAY
  < 4 hrs  → ABSENT
  approved leave covering the date → ON_LEAVE  (checked first)

Edge cases handled:
  - Missing logout: auto-close previous open session at midnight (23:59:59)
    before opening a new one, or on demand via close_open_sessions_for_date().
  - Multiple logins per day: all sessions for the date are summed.
  - Cross-day sessions: the session is attributed to login_time.date(),
    and if logout_time.date() > login_time.date() the duration is capped
    at midnight so only hours in the start-day count toward that day's total.
"""

from sqlalchemy.orm import Session as DBSession
from datetime import date, datetime, timedelta, timezone
from typing import Optional, Tuple

from app.models.attendance import Attendance, AttendanceSession, AttendanceStatus
from app.models.leave import LeaveRequest, LeaveStatus


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _utcnow() -> datetime:
    return datetime.utcnow()


def _to_local(dt: Optional[datetime]) -> Optional[datetime]:
    """Return datetime as-is (stored in UTC; frontend formats as needed)."""
    return dt


def _compute_duration_minutes(login: datetime, logout: datetime) -> float:
    """
    Compute the session duration in minutes capped to the login date.
    If the session crosses midnight, only count hours up to 23:59:59 of the login day.
    """
    # Cap logout to end of login day (23:59:59.999999) if cross-day
    end_of_day = datetime(
        login.year, login.month, login.day, 23, 59, 59, 999999
    )
    effective_logout = min(logout, end_of_day)
    delta = effective_logout - login
    return max(delta.total_seconds() / 60.0, 0.0)


def _has_approved_leave(db: DBSession, employee_id: int, target_date: date) -> bool:
    """Check if employee has an approved leave request covering target_date."""
    from app.models.leave import LeaveRequest, LeaveStatus
    leave = db.query(LeaveRequest).filter(
        LeaveRequest.employee_id == employee_id,
        LeaveRequest.status == LeaveStatus.APPROVED,
        LeaveRequest.start_date <= target_date,
        LeaveRequest.end_date >= target_date,
    ).first()
    return leave is not None


def _compute_status(total_hours: float, on_leave: bool) -> AttendanceStatus:
    """Determine attendance status from total hours and leave flag."""
    if on_leave:
        return AttendanceStatus.ON_LEAVE
    if total_hours >= 8:
        return AttendanceStatus.PRESENT
    if total_hours >= 4:
        return AttendanceStatus.HALF_DAY
    return AttendanceStatus.ABSENT


def _recompute_daily_summary(db: DBSession, employee_id: int, target_date: date) -> Attendance:
    """
    Recalculate the Attendance daily summary for employee on target_date
    from all completed (logout_time set) sessions for that date.
    """
    sessions = db.query(AttendanceSession).filter(
        AttendanceSession.employee_id == employee_id,
        AttendanceSession.date == target_date,
        AttendanceSession.logout_time.isnot(None),
    ).all()

    total_minutes = sum(s.duration_minutes or 0.0 for s in sessions)
    total_hours = total_minutes / 60.0

    on_leave = _has_approved_leave(db, employee_id, target_date)
    status = _compute_status(total_hours, on_leave)

    record = db.query(Attendance).filter(
        Attendance.employee_id == employee_id,
        Attendance.date == target_date,
    ).first()

    if record is None:
        record = Attendance(
            employee_id=employee_id,
            date=target_date,
            total_hours=total_hours,
            status=status,
        )
        db.add(record)
    else:
        record.total_hours = total_hours
        record.status = status
        record.updated_at = _utcnow()

    db.commit()
    db.refresh(record)
    return record


# ---------------------------------------------------------------------------
# Auto-close helpers
# ---------------------------------------------------------------------------

def close_open_sessions_for_date(
    db: DBSession, employee_id: int, target_date: date
) -> None:
    """
    Auto-close any sessions started on target_date that have no logout_time.
    Sets logout_time to 23:59:59 of login day and marks is_auto_closed=True.
    """
    open_sessions = db.query(AttendanceSession).filter(
        AttendanceSession.employee_id == employee_id,
        AttendanceSession.date == target_date,
        AttendanceSession.logout_time.is_(None),
    ).all()

    for s in open_sessions:
        end_of_day = datetime(
            s.login_time.year, s.login_time.month, s.login_time.day,
            23, 59, 59
        )
        s.logout_time = end_of_day
        s.duration_minutes = _compute_duration_minutes(s.login_time, end_of_day)
        s.is_auto_closed = True

    if open_sessions:
        db.commit()
        _recompute_daily_summary(db, employee_id, target_date)


def auto_close_all_open_sessions(db: DBSession) -> int:
    """
    Background/admin task: close all open sessions from PREVIOUS dates.
    Returns count of sessions closed.
    """
    today = date.today()
    open_sessions = db.query(AttendanceSession).filter(
        AttendanceSession.logout_time.is_(None),
        AttendanceSession.date < today,
    ).all()

    closed = 0
    affected = set()
    for s in open_sessions:
        end_of_day = datetime(
            s.login_time.year, s.login_time.month, s.login_time.day,
            23, 59, 59
        )
        s.logout_time = end_of_day
        s.duration_minutes = _compute_duration_minutes(s.login_time, end_of_day)
        s.is_auto_closed = True
        affected.add((s.employee_id, s.date))
        closed += 1

    if open_sessions:
        db.commit()
        for emp_id, d in affected:
            _recompute_daily_summary(db, emp_id, d)

    return closed


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def login_session(
    db: DBSession, employee_id: int
) -> Tuple[AttendanceSession, Optional[str]]:
    """
    Create a new attendance session on login.
    Before creating, auto-close any dangling sessions from previous dates.
    Multiple logins per day are allowed (no restriction).
    Returns (session, error_message_or_None).
    """
    now = _utcnow()
    today = now.date()

    # Auto-close sessions from previous dates
    prev_open = db.query(AttendanceSession).filter(
        AttendanceSession.employee_id == employee_id,
        AttendanceSession.logout_time.is_(None),
        AttendanceSession.date < today,
    ).all()
    for s in prev_open:
        end_of_day = datetime(
            s.login_time.year, s.login_time.month, s.login_time.day,
            23, 59, 59
        )
        s.logout_time = end_of_day
        s.duration_minutes = _compute_duration_minutes(s.login_time, end_of_day)
        s.is_auto_closed = True
    if prev_open:
        db.commit()
        for s in prev_open:
            _recompute_daily_summary(db, employee_id, s.date)

    # Check if there's already an open session for TODAY
    current_open = db.query(AttendanceSession).filter(
        AttendanceSession.employee_id == employee_id,
        AttendanceSession.date == today,
        AttendanceSession.logout_time.is_(None),
    ).first()

    if current_open:
        # Return the existing open session — employee is already logged in
        return current_open, "Already have an active session. Please logout first."

    # Create new session
    session = AttendanceSession(
        employee_id=employee_id,
        login_time=now,
        date=today,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Ensure daily summary row exists
    _recompute_daily_summary(db, employee_id, today)

    return session, None


def logout_session(
    db: DBSession, employee_id: int
) -> Tuple[Optional[AttendanceSession], Optional[str]]:
    """
    Close the current open session on logout, compute duration, update daily summary.
    Returns (session, error_message_or_None).
    """
    now = _utcnow()
    today = now.date()

    # Find the most recent open session (may span today or be cross-day)
    open_session = db.query(AttendanceSession).filter(
        AttendanceSession.employee_id == employee_id,
        AttendanceSession.logout_time.is_(None),
    ).order_by(AttendanceSession.login_time.desc()).first()

    if not open_session:
        return None, "No active session found. Please login first."

    open_session.logout_time = now
    open_session.duration_minutes = _compute_duration_minutes(
        open_session.login_time, now
    )
    db.commit()
    db.refresh(open_session)

    # Recompute daily summary for the session's date
    _recompute_daily_summary(db, employee_id, open_session.date)

    return open_session, None


def get_today_status(db: DBSession, employee_id: int) -> dict:
    """
    Returns the employee's attendance state for today:
      - sessions list
      - daily summary (total_hours, status)
      - is_logged_in flag
    """
    today = date.today()
    sessions = db.query(AttendanceSession).filter(
        AttendanceSession.employee_id == employee_id,
        AttendanceSession.date == today,
    ).order_by(AttendanceSession.login_time).all()

    summary = db.query(Attendance).filter(
        Attendance.employee_id == employee_id,
        Attendance.date == today,
    ).first()

    open_session = next((s for s in sessions if s.logout_time is None), None)

    return {
        "is_logged_in": open_session is not None,
        "active_session_id": open_session.id if open_session else None,
        "active_login_time": open_session.login_time.isoformat() if open_session else None,
        "sessions": [_session_to_dict(s) for s in sessions],
        "summary": _summary_to_dict(summary) if summary else None,
    }


def get_employee_attendance(
    db: DBSession, employee_id: int, month: Optional[int] = None, year: Optional[int] = None
) -> list:
    """Return daily Attendance summaries for an employee, optionally filtered by month/year."""
    from sqlalchemy import func
    query = db.query(Attendance).filter(Attendance.employee_id == employee_id)
    if month:
        query = query.filter(func.strftime('%m', Attendance.date) == f"{month:02d}")
    if year:
        query = query.filter(func.strftime('%Y', Attendance.date) == str(year))
    records = query.order_by(Attendance.date.desc()).all()
    return [_summary_to_dict(r) for r in records]


def get_sessions_for_date(
    db: DBSession, employee_id: int, target_date: date
) -> list:
    """Return all sessions for an employee on a specific date."""
    sessions = db.query(AttendanceSession).filter(
        AttendanceSession.employee_id == employee_id,
        AttendanceSession.date == target_date,
    ).order_by(AttendanceSession.login_time).all()
    return [_session_to_dict(s) for s in sessions]


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------

def _session_to_dict(s: AttendanceSession) -> dict:
    return {
        "id": s.id,
        "login_time": s.login_time.isoformat() if s.login_time else None,
        "logout_time": s.logout_time.isoformat() if s.logout_time else None,
        "duration_minutes": round(s.duration_minutes, 2) if s.duration_minutes is not None else None,
        "is_auto_closed": s.is_auto_closed,
        "date": str(s.date),
    }


def _summary_to_dict(r: Attendance) -> dict:
    return {
        "id": r.id,
        "date": str(r.date),
        "total_hours": round(r.total_hours, 2) if r.total_hours is not None else 0.0,
        "status": r.status.value,
    }
