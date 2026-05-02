import calendar
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from app.models.employee import Employee
from app.models.attendance import Attendance, AttendanceStatus
from app.models.leave import LeaveRequest, LeaveStatus
from app.models.payroll import Payrun, Payslip, PayrunStatus


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
    """Calculate payslip for an employee for a given month/year."""

    # Get working days in the month
    _, total_days = calendar.monthrange(year, month)
    # Approximate working days (exclude weekends)
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

    # Count approved leaves
    approved_leaves = db.query(LeaveRequest).filter(
        LeaveRequest.employee_id == employee.id,
        LeaveRequest.status == LeaveStatus.APPROVED,
        func.extract('month', LeaveRequest.start_date) == month,
        func.extract('year', LeaveRequest.start_date) == year,
    ).all()

    leave_days = 0
    for leave in approved_leaves:
        delta = (leave.end_date - leave.start_date).days + 1
        leave_days += delta

    # Effective days = present + approved leaves
    effective_days = min(days_present + leave_days, working_days)

    # Calculate earnings (pro-rated)
    ratio = effective_days / working_days if working_days > 0 else 0
    basic = round(employee.basic_salary * ratio, 2)
    hra = round(basic * 0.4, 2)          # 40% of basic
    conveyance = round(1600 * ratio, 2)
    medical = round(1250 * ratio, 2)
    gross = round(basic + hra + conveyance + medical, 2)

    # Calculate deductions
    pf = round(basic * 0.12, 2)          # 12% of basic
    prof_tax = get_professional_tax(gross)
    total_deductions = round(pf + prof_tax, 2)
    net_pay = round(gross - total_deductions, 2)

    return {
        "basic_salary": basic,
        "hra": hra,
        "conveyance": conveyance,
        "medical": medical,
        "special_allowance": 0,
        "gross_salary": gross,
        "pf_deduction": pf,
        "professional_tax": prof_tax,
        "income_tax": 0,
        "other_deductions": 0,
        "total_deductions": total_deductions,
        "net_pay": net_pay,
        "working_days": working_days,
        "days_present": int(days_present),
        "leave_days": leave_days,
    }


def create_payrun(db: Session, month: int, year: int, created_by: int, company_id: int = None):
    """Create a payrun and generate payslips for company employees."""

    # Check if payrun already exists
    existing_query = db.query(Payrun).filter(
        Payrun.month == month,
        Payrun.year == year,
        Payrun.created_by == created_by,
    )
    if existing_query.first():
        return None, "Payrun already exists for this month/year"

    # Create payrun
    payrun = Payrun(
        month=month,
        year=year,
        status=PayrunStatus.DRAFT,
        created_by=created_by,
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

    for emp in employees:
        calc = calculate_payslip(db, emp, month, year)
        payslip = Payslip(
            payrun_id=payrun.id,
            employee_id=emp.id,
            **calc
        )
        db.add(payslip)
        total_amount += calc["net_pay"]

    payrun.total_amount = round(total_amount, 2)
    db.commit()
    db.refresh(payrun)

    return payrun, None
