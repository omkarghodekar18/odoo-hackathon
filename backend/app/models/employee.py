from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    emp_code = Column(String, unique=True, index=True, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    department = Column(String, nullable=False)
    designation = Column(String, nullable=False)
    date_of_joining = Column(Date, nullable=False)
    basic_salary = Column(Float, default=0.0)
    phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="employee")
    company = relationship("Company", back_populates="employees")
    attendance_records = relationship("Attendance", back_populates="employee")
    attendance_sessions = relationship("AttendanceSession", back_populates="employee")
    leave_balances = relationship("LeaveBalance", back_populates="employee")
    leave_requests = relationship("LeaveRequest", back_populates="employee")
    payslips = relationship("Payslip", back_populates="employee")
