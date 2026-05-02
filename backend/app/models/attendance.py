from sqlalchemy import Column, Integer, String, Date, Time, ForeignKey, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    ABSENT = "absent"
    HALF_DAY = "half_day"
    ON_LEAVE = "on_leave"


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    date = Column(Date, nullable=False)
    check_in = Column(Time, nullable=True)
    check_out = Column(Time, nullable=True)
    status = Column(SQLEnum(AttendanceStatus), default=AttendanceStatus.PRESENT)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    employee = relationship("Employee", back_populates="attendance_records")
