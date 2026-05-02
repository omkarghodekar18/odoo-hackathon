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
    employee_count: int = 0
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
    status: str = "draft"

    # Earnings
    basic_salary: float
    hra: float
    standard_allowance: float = 0.0
    performance_bonus: float = 0.0
    lta: float = 0.0
    fixed_allowance: float = 0.0
    gross_salary: float
    employer_cost: float = 0.0

    # Deductions
    pf_employee: float = 0.0
    pf_employer: float = 0.0
    professional_tax: float
    income_tax: float
    other_deductions: float
    total_deductions: float

    # Net
    net_pay: float

    # Attendance
    working_days: int
    days_present: float = 0
    leave_days: int
    paid_leave_days: float = 0.0
    unpaid_leave_days: float = 0.0

    class Config:
        from_attributes = True


class PayslipUpdate(BaseModel):
    other_deductions: Optional[float] = None
    income_tax: Optional[float] = None


class PayslipCreate(BaseModel):
    """For creating an individual payslip within an existing payrun."""
    payrun_id: int
    employee_id: int


class PayrunDetailResponse(PayrunResponse):
    payslips: List[PayslipResponse] = []


# ── Payslip detail with worked-days breakdown and salary computation lines ──

class WorkedDayLine(BaseModel):
    name: str
    days: float
    amount: float


class SalaryComputationLine(BaseModel):
    name: str
    rate_pct: float = 100
    amount: float
    is_deduction: bool = False


class PayslipDetailFull(BaseModel):
    id: int
    payrun_id: int
    employee_id: int
    employee_name: str
    emp_code: str
    status: str
    payrun_ref: str       # e.g. "Payrun Oct 2025"
    salary_structure: str  # "Regular Pay"
    period: str           # "01 Oct to 31 Oct"
    month: int
    year: int

    # Financials
    basic_salary: float
    gross_salary: float
    employer_cost: float
    net_pay: float
    total_deductions: float

    # Attendance
    working_days: int
    days_present: float
    paid_leave_days: float
    unpaid_leave_days: float

    worked_days: List[WorkedDayLine] = []
    salary_computation: List[SalaryComputationLine] = []


# ── Payroll Dashboard ──

class PayrollWarning(BaseModel):
    type: str
    message: str
    count: int


class PendingPayrun(BaseModel):
    month: int
    year: int
    employee_count: int
    label: str   # "Payrun for Oct 2025 (5 People)"


class PayrollChartPoint(BaseModel):
    label: str
    value: float


class PayrollDashboardResponse(BaseModel):
    warnings: List[PayrollWarning] = []
    pending_payruns: List[PendingPayrun] = []
    cost_chart_monthly: List[PayrollChartPoint] = []
    cost_chart_annual: List[PayrollChartPoint] = []
    count_chart_monthly: List[PayrollChartPoint] = []
    count_chart_annual: List[PayrollChartPoint] = []
