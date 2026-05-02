from sqlalchemy import Column, Integer, String, Date, Float, ForeignKey, DateTime, Enum as SQLEnum, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    ABSENT = "absent"
    HALF_DAY = "half_day"
    ON_LEAVE = "on_leave"


class AttendanceSession(Base):
    """
    Logs every individual login/logout pair.
    Multiple sessions can exist per employee per day.
    """
    __tablename__ = "attendance_sessions"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    login_time = Column(DateTime, nullable=False, default=datetime.utcnow)
    logout_time = Column(DateTime, nullable=True)
    duration_minutes = Column(Float, nullable=True)   # filled on logout / auto-close
    is_auto_closed = Column(Boolean, default=False)   # True if auto-closed (missing logout)
    date = Column(Date, nullable=False)               # date the session started (for cross-day grouping)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    employee = relationship("Employee", back_populates="attendance_sessions")


class Attendance(Base):
    """
    Daily summary record — computed from sessions.
    One row per employee per day.
    """
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    date = Column(Date, nullable=False)
    total_hours = Column(Float, default=0.0)          # sum of all session durations for the day
    status = Column(SQLEnum(AttendanceStatus), default=AttendanceStatus.ABSENT)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    employee = relationship("Employee", back_populates="attendance_records")
