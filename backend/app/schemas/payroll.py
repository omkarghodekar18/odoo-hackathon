from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class PayrunCreate(BaseModel):
    month: int
    year: int


class PayrunResponse(BaseModel):
    id: int
    month: int
    year: int
    status: str
    total_amount: float
    created_by: int
    created_at: datetime

    class Config:
        from_attributes = True


class PayslipResponse(BaseModel):
    id: int
    payrun_id: int
    employee_id: int
    employee_name: Optional[str] = None
    emp_code: Optional[str] = None

    # Earnings
    basic_salary: float
    hra: float
    conveyance: float
    medical: float
    special_allowance: float
    gross_salary: float

    # Deductions
    pf_deduction: float
    professional_tax: float
    income_tax: float
    other_deductions: float
    total_deductions: float

    # Net
    net_pay: float

    # Attendance
    working_days: int
    days_present: int
    leave_days: int

    class Config:
        from_attributes = True


class PayslipUpdate(BaseModel):
    special_allowance: Optional[float] = None
    other_deductions: Optional[float] = None
    income_tax: Optional[float] = None


class PayrunDetailResponse(PayrunResponse):
    payslips: List[PayslipResponse] = []
