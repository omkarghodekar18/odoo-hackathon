from sqlalchemy.orm import Session
from datetime import date, time
from app.models.attendance import Attendance, AttendanceStatus
from app.models.employee import Employee


def get_or_create_today_attendance(db: Session, employee_id: int):
    """Get or create attendance record for today."""
    today = date.today()
    record = db.query(Attendance).filter(
        Attendance.employee_id == employee_id,
        Attendance.date == today
    ).first()
    return record


def check_in(db: Session, employee_id: int):
    """Mark check-in for employee."""
    today = date.today()
    existing = db.query(Attendance).filter(
        Attendance.employee_id == employee_id,
        Attendance.date == today
    ).first()

    if existing:
        return existing, "Already checked in today"

    from datetime import datetime
    now = datetime.now().time()
    record = Attendance(
        employee_id=employee_id,
        date=today,
        check_in=now,
        status=AttendanceStatus.PRESENT
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record, None


def check_out(db: Session, employee_id: int):
    """Mark check-out for employee."""
    today = date.today()
    record = db.query(Attendance).filter(
        Attendance.employee_id == employee_id,
        Attendance.date == today
    ).first()

    if not record:
        return None, "No check-in found for today"

    if record.check_out:
        return record, "Already checked out today"

    from datetime import datetime
    record.check_out = datetime.now().time()

    # Check if half day (less than 4 hours)
    if record.check_in:
        check_in_minutes = record.check_in.hour * 60 + record.check_in.minute
        check_out_minutes = record.check_out.hour * 60 + record.check_out.minute
        if (check_out_minutes - check_in_minutes) < 240:  # 4 hours
            record.status = AttendanceStatus.HALF_DAY

    db.commit()
    db.refresh(record)
    return record, None
