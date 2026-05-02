import calendar
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from app.models.employee import Employee
from app.models.attendance import Attendance, AttendanceStatus
from app.models.leave import LeaveRequest, LeaveStatus, LeaveType, LeaveBalance
from app.models.payroll import Payrun, Payslip, PayrunStatus, PayslipStatus


def get_professional_tax(gross_salary: float) -> float:
    """Calculate professional tax based on salary slab."""
    if gross_salary <= 10000:
        return 0
    elif gross_salary <= 15000:
        return 150
    elif gross_salary <= 25000:
        return 180
    else:
        return 200


def calculate_payslip(db: Session, employee: Employee, month: int, year: int) -> dict:
    """Calculate payslip for an employee for a given month/year.
    
    Salary is calculated based on monthly attendance:
    - Paid leaves are included in total payable days
    - Unpaid leaves are deducted from salary
    """

    # Get working days in the month (weekdays only)
    _, total_days = calendar.monthrange(year, month)
    working_days = 0
    for day in range(1, total_days + 1):
        d = date(year, month, day)
        if d.weekday() < 5:  # Monday to Friday
            working_days += 1

    # Count attendance
    attendance_records = db.query(Attendance).filter(
        Attendance.employee_id == employee.id,
        func.extract('month', Attendance.date) == month,
        func.extract('year', Attendance.date) == year,
    ).all()

    days_present = sum(1 for a in attendance_records if a.status == AttendanceStatus.PRESENT)
    half_days = sum(1 for a in attendance_records if a.status == AttendanceStatus.HALF_DAY)
    days_present += half_days * 0.5

    # Count approved leaves in this month
    approved_leaves = db.query(LeaveRequest).filter(
        LeaveRequest.employee_id == employee.id,
        LeaveRequest.status == LeaveStatus.APPROVED,
        func.extract('month', LeaveRequest.start_date) == month,
        func.extract('year', LeaveRequest.start_date) == year,
    ).all()

    total_leave_days = 0
    for leave in approved_leaves:
        delta = (leave.end_date - leave.start_date).days + 1
        total_leave_days += delta

    # Determine paid vs unpaid leaves
    # Check leave balances - if employee has remaining balance, leaves are paid
    leave_balances = db.query(LeaveBalance).filter(
        LeaveBalance.employee_id == employee.id
    ).all()
    total_remaining_balance = sum(lb.remaining for lb in leave_balances)

    # Paid leaves = min(total_leave_days, remaining balance)
    paid_leave_days = min(total_leave_days, max(total_remaining_balance, 0))
    unpaid_leave_days = max(total_leave_days - paid_leave_days, 0)

    # Payable days = attendance days + paid leave days
    payable_days = min(days_present + paid_leave_days, working_days)

    # Calculate earnings (pro-rated based on payable days)
    ratio = payable_days / working_days if working_days > 0 else 0
    basic = round(employee.basic_salary * ratio, 2)
    hra = round(basic * 0.4, 2)          # 40% of basic
    conveyance = round(1600 * ratio, 2)
    medical = round(1250 * ratio, 2)
    gross = round(basic + hra + conveyance + medical, 2)

    # Calculate deductions
    pf = round(basic * 0.12, 2)          # 12% of basic (employee contribution)
    employer_pf = round(basic * 0.12, 2) # 12% of basic (employer contribution)
    prof_tax = get_professional_tax(gross)
    total_deductions = round(pf + prof_tax, 2)
    net_pay = round(gross - total_deductions, 2)

    # Employer cost = gross + employer PF contribution
    employer_cost = round(gross + employer_pf, 2)

    return {
        "basic_salary": basic,
        "hra": hra,
        "conveyance": conveyance,
        "medical": medical,
        "special_allowance": 0,
        "gross_salary": gross,
        "employer_cost": employer_cost,
        "pf_deduction": pf,
        "professional_tax": prof_tax,
        "income_tax": 0,
        "other_deductions": 0,
        "total_deductions": total_deductions,
        "net_pay": net_pay,
        "working_days": working_days,
        "days_present": days_present,
        "leave_days": total_leave_days,
        "paid_leave_days": paid_leave_days,
        "unpaid_leave_days": unpaid_leave_days,
    }


def create_payrun(db: Session, month: int, year: int, created_by: int, company_id: int = None):
    """Create a payrun and generate payslips for company employees."""

    # Check if payrun already exists for this company/month/year
    existing_query = db.query(Payrun).filter(
        Payrun.month == month,
        Payrun.year == year,
    )
    if company_id:
        existing_query = existing_query.filter(Payrun.company_id == company_id)
    else:
        existing_query = existing_query.filter(Payrun.created_by == created_by)

    if existing_query.first():
        return None, "Payrun already exists for this month/year"

    # Create payrun
    payrun = Payrun(
        month=month,
        year=year,
        status=PayrunStatus.DRAFT,
        created_by=created_by,
        company_id=company_id,
    )
    db.add(payrun)
    db.commit()
    db.refresh(payrun)

    # Generate payslips for company employees
    query = db.query(Employee)
    if company_id:
        query = query.filter(Employee.company_id == company_id)
    employees = query.all()
    total_amount = 0
    employee_count = 0

    for emp in employees:
        calc = calculate_payslip(db, emp, month, year)
        payslip = Payslip(
            payrun_id=payrun.id,
            employee_id=emp.id,
            status=PayslipStatus.DRAFT,
            **calc
        )
        db.add(payslip)
        total_amount += calc["net_pay"]
        employee_count += 1

    payrun.total_amount = round(total_amount, 2)
    payrun.employee_count = employee_count
    db.commit()
    db.refresh(payrun)

    return payrun, None


def compute_payslip(db: Session, payslip: Payslip):
    """Recompute a single payslip based on current attendance data."""
    employee = db.query(Employee).filter(Employee.id == payslip.employee_id).first()
    if not employee:
        return None, "Employee not found"

    payrun = db.query(Payrun).filter(Payrun.id == payslip.payrun_id).first()
    if not payrun:
        return None, "Payrun not found"

    calc = calculate_payslip(db, employee, payrun.month, payrun.year)
    for key, value in calc.items():
        setattr(payslip, key, value)

    payslip.status = PayslipStatus.COMPUTED
    db.commit()
    db.refresh(payslip)

    # Recalculate payrun total
    _recalculate_payrun_total(db, payrun)

    return payslip, None


def validate_payslip(db: Session, payslip: Payslip):
    """Validate a payslip (mark as Done)."""
    if payslip.status == PayslipStatus.CANCELLED:
        return None, "Cannot validate a cancelled payslip"
    payslip.status = PayslipStatus.DONE
    db.commit()
    db.refresh(payslip)
    return payslip, None


def cancel_payslip(db: Session, payslip: Payslip):
    """Cancel a payslip."""
    if payslip.status == PayslipStatus.DONE:
        return None, "Cannot cancel a validated payslip. Reset to draft first."
    payslip.status = PayslipStatus.CANCELLED
    db.commit()
    db.refresh(payslip)
    return payslip, None


def reset_payslip_to_draft(db: Session, payslip: Payslip):
    """Reset a payslip back to draft."""
    payslip.status = PayslipStatus.DRAFT
    db.commit()
    db.refresh(payslip)
    return payslip, None


def validate_payrun(db: Session, payrun: Payrun):
    """Validate all payslips in a payrun."""
    payslips = db.query(Payslip).filter(
        Payslip.payrun_id == payrun.id,
        Payslip.status != PayslipStatus.CANCELLED
    ).all()
    for slip in payslips:
        slip.status = PayslipStatus.DONE
    payrun.status = PayrunStatus.VALIDATED
    db.commit()
    db.refresh(payrun)
    return payrun, None


def _recalculate_payrun_total(db: Session, payrun: Payrun):
    """Recalculate the total amount for a payrun."""
    total = db.query(func.sum(Payslip.net_pay)).filter(
        Payslip.payrun_id == payrun.id,
        Payslip.status != PayslipStatus.CANCELLED
    ).scalar() or 0
    payrun.total_amount = round(total, 2)
    count = db.query(Payslip).filter(
        Payslip.payrun_id == payrun.id,
        Payslip.status != PayslipStatus.CANCELLED
    ).count()
    payrun.employee_count = count
    db.commit()
