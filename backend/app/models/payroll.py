from sqlalchemy import Column, Integer, Float, String, ForeignKey, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class PayrunStatus(str, enum.Enum):
    DRAFT = "draft"
    PROCESSED = "processed"
    PAID = "paid"


class Payrun(Base):
    __tablename__ = "payruns"

    id = Column(Integer, primary_key=True, index=True)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    status = Column(SQLEnum(PayrunStatus), default=PayrunStatus.DRAFT)
    total_amount = Column(Float, default=0.0)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    payslips = relationship("Payslip", back_populates="payrun")


class Payslip(Base):
    __tablename__ = "payslips"

    id = Column(Integer, primary_key=True, index=True)
    payrun_id = Column(Integer, ForeignKey("payruns.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)

    # Earnings
    basic_salary = Column(Float, default=0.0)
    hra = Column(Float, default=0.0)          # House Rent Allowance (40% of basic)
    conveyance = Column(Float, default=1600.0)
    medical = Column(Float, default=1250.0)
    special_allowance = Column(Float, default=0.0)
    gross_salary = Column(Float, default=0.0)

    # Deductions
    pf_deduction = Column(Float, default=0.0)       # 12% of basic
    professional_tax = Column(Float, default=0.0)    # Slab-based
    income_tax = Column(Float, default=0.0)
    other_deductions = Column(Float, default=0.0)
    total_deductions = Column(Float, default=0.0)

    # Net
    net_pay = Column(Float, default=0.0)

    # Attendance info
    working_days = Column(Integer, default=0)
    days_present = Column(Integer, default=0)
    leave_days = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    payrun = relationship("Payrun", back_populates="payslips")
    employee = relationship("Employee", back_populates="payslips")
