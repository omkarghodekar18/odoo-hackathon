from sqlalchemy import Column, Integer, Float, String, ForeignKey, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class PayrunStatus(str, enum.Enum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    VALIDATED = "validated"
    PAID = "paid"


class PayslipStatus(str, enum.Enum):
    DRAFT = "draft"
    COMPUTED = "computed"
    DONE = "done"
    CANCELLED = "cancelled"


class Payrun(Base):
    __tablename__ = "payruns"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    status = Column(SQLEnum(PayrunStatus), default=PayrunStatus.DRAFT)
    total_amount = Column(Float, default=0.0)
    employee_count = Column(Integer, default=0)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    payslips = relationship("Payslip", back_populates="payrun")
    company = relationship("Company")


class Payslip(Base):
    __tablename__ = "payslips"

    id = Column(Integer, primary_key=True, index=True)
    payrun_id = Column(Integer, ForeignKey("payruns.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    status = Column(SQLEnum(PayslipStatus), default=PayslipStatus.DRAFT)

    # Earnings
    basic_salary = Column(Float, default=0.0)
    hra = Column(Float, default=0.0)          # House Rent Allowance (40% of basic)
    conveyance = Column(Float, default=1600.0)
    medical = Column(Float, default=1250.0)
    special_allowance = Column(Float, default=0.0)
    gross_salary = Column(Float, default=0.0)

    # Employer cost (gross + employer PF)
    employer_cost = Column(Float, default=0.0)

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
    days_present = Column(Float, default=0)
    leave_days = Column(Integer, default=0)
    paid_leave_days = Column(Float, default=0.0)
    unpaid_leave_days = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    payrun = relationship("Payrun", back_populates="payslips")
    employee = relationship("Employee", back_populates="payslips")
