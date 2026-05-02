from sqlalchemy import Column, Integer, String, Date, ForeignKey, DateTime, Enum as SQLEnum, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class LeaveStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class LeaveType(Base):
    __tablename__ = "leave_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    max_days_per_year = Column(Integer, nullable=False)
    description = Column(String, nullable=True)

    # Relationships
    balances = relationship("LeaveBalance", back_populates="leave_type")
    requests = relationship("LeaveRequest", back_populates="leave_type")


class LeaveBalance(Base):
    __tablename__ = "leave_balances"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id"), nullable=False)
    allocated = Column(Integer, default=0)
    used = Column(Integer, default=0)
    remaining = Column(Integer, default=0)

    # Relationships
    employee = relationship("Employee", back_populates="leave_balances")
    leave_type = relationship("LeaveType", back_populates="balances")


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(SQLEnum(LeaveStatus), default=LeaveStatus.PENDING)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    employee = relationship("Employee", back_populates="leave_requests")
    leave_type = relationship("LeaveType", back_populates="requests")
