import calendar
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from app.models.employee import Employee
from app.models.payroll import Payrun, Payslip, PayrunStatus, PayslipStatus
from app.models.salary_structure import SalaryStructure


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


def _get_or_create_salary_structure(db: Session, employee_id: int) -> SalaryStructure:
    """Fetch salary structure for employee, or create one with defaults."""
    structure = db.query(SalaryStructure).filter(
        SalaryStructure.employee_id == employee_id
    ).first()
    if not structure:
        structure = SalaryStructure(employee_id=employee_id)
        db.add(structure)
        db.commit()
        db.refresh(structure)
    return structure


def calculate_payslip(db: Session, employee: Employee, month: int, year: int) -> dict:
    """Calculate payslip for an employee for a given month/year.

    Uses the employee's full monthly salary (basic_salary = monthly CTC)
    with SalaryStructure percentages applied to break down into components.
    No attendance or leave proration — plain full salary.
    """

    monthly_ctc = employee.basic_salary or 0

    # Get salary structure percentages
    structure = _get_or_create_salary_structure(db, employee.id)

    # Get working days in the month (weekdays only) — for display purposes
    _, total_days = calendar.monthrange(year, month)
    working_days = 0
    for day in range(1, total_days + 1):
        d = date(year, month, day)
        if d.weekday() < 5:  # Monday to Friday
            working_days += 1

    # Full salary — no attendance/leave proration
    basic = round(monthly_ctc * (structure.basic_pct / 100), 2)
    hra = round(monthly_ctc * (structure.hra_pct / 100), 2)
    standard_allowance = round(monthly_ctc * (structure.standard_allowance_pct / 100), 2)
    performance_bonus = round(monthly_ctc * (structure.performance_bonus_pct / 100), 2)
    lta = round(monthly_ctc * (structure.lta_pct / 100), 2)
    fixed_allowance = round(monthly_ctc * (structure.fixed_allowance_pct / 100), 2)

    gross = round(basic + hra + standard_allowance + performance_bonus + lta + fixed_allowance, 2)

    # Calculate deductions
    pf_employee = round(basic * (structure.employee_pf_pct / 100), 2)
    pf_employer = round(basic * (structure.employer_pf_pct / 100), 2)
    prof_tax = get_professional_tax(gross)
    total_deductions = round(pf_employee + prof_tax, 2)
    net_pay = round(gross - total_deductions, 2)

    # Employer cost = gross + employer PF contribution
    employer_cost = round(gross + pf_employer, 2)

    return {
        "basic_salary": basic,
        "hra": hra,
        "standard_allowance": standard_allowance,
        "performance_bonus": performance_bonus,
        "lta": lta,
        "fixed_allowance": fixed_allowance,
        "gross_salary": gross,
        "employer_cost": employer_cost,
        "pf_employee": pf_employee,
        "pf_employer": pf_employer,
        "professional_tax": prof_tax,
        "income_tax": 0,
        "other_deductions": 0,
        "total_deductions": total_deductions,
        "net_pay": net_pay,
        "working_days": working_days,
        "days_present": working_days,
        "leave_days": 0,
        "paid_leave_days": 0,
        "unpaid_leave_days": 0,
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


def create_single_payslip(db: Session, payrun_id: int, employee_id: int):
    """Create a single payslip for a specific employee within an existing payrun."""

    payrun = db.query(Payrun).filter(Payrun.id == payrun_id).first()
    if not payrun:
        return None, "Payrun not found"

    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        return None, "Employee not found"

    # Check if payslip already exists
    existing = db.query(Payslip).filter(
        Payslip.payrun_id == payrun_id,
        Payslip.employee_id == employee_id,
    ).first()
    if existing:
        return None, "Payslip already exists for this employee in this payrun"

    calc = calculate_payslip(db, employee, payrun.month, payrun.year)
    payslip = Payslip(
        payrun_id=payrun.id,
        employee_id=employee.id,
        status=PayslipStatus.DRAFT,
        **calc
    )
    db.add(payslip)
    db.commit()
    db.refresh(payslip)

    # Recalculate payrun totals
    _recalculate_payrun_total(db, payrun)

    return payslip, None


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
