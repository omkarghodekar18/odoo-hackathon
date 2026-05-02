"""
Full seed script for EmPay HRMS.
Creates:
  - 1 company
  - 4 staff users  (admin, hr, payroll, one employee-user)
  - 20 employees   (diverse departments, salaries, joining dates)
  - 3 leave types  + leave balances
  - 12 months of attendance records (Jan-Dec 2024)
  - Leave requests (mix of paid/sick/unpaid, approved/pending)
  - 12 payruns + payslips (VALIDATED, fully linked to attendance & leaves)
"""

import sys
import os
import calendar
import random
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine, Base
from app.models.company import Company
from app.models.user import User, UserRole
from app.models.employee import Employee
from app.models.attendance import Attendance, AttendanceStatus
from app.models.leave import LeaveType, LeaveBalance, LeaveRequest, LeaveStatus
from app.models.payroll import Payrun, Payslip, PayrunStatus, PayslipStatus
from app.models.salary_structure import SalaryStructure
from app.utils.security import get_password_hash

random.seed(42)          # reproducible results
Base.metadata.create_all(bind=engine)


# ─── helpers ────────────────────────────────────────────────────────────────

def get_professional_tax(gross: float) -> float:
    if gross <= 10_000: return 0
    if gross <= 15_000: return 150
    if gross <= 25_000: return 180
    return 200


def working_days_in_month(year: int, month: int):
    """Return list of weekday dates (Mon–Fri) in the month."""
    _, total = calendar.monthrange(year, month)
    return [date(year, month, d) for d in range(1, total + 1) if date(year, month, d).weekday() < 5]


def calculate_payslip_dict(employee, structure, attendance_records,
                            approved_leaves, leave_balances_remaining,
                            year, month):
    """Mirror the payroll_service logic — pure Python, no DB access."""
    monthly_ctc = employee.basic_salary or 0
    wdays = working_days_in_month(year, month)
    working_days = len(wdays)

    days_present = sum(1 for a in attendance_records if a.status == AttendanceStatus.PRESENT)
    half_days    = sum(1 for a in attendance_records if a.status == AttendanceStatus.HALF_DAY)
    days_present += half_days * 0.5

    total_leave_days = 0
    for leave in approved_leaves:
        total_leave_days += (leave.end_date - leave.start_date).days + 1

    paid_leave_days   = min(total_leave_days, max(leave_balances_remaining, 0))
    unpaid_leave_days = max(total_leave_days - paid_leave_days, 0)

    payable_days = min(days_present + paid_leave_days, working_days)
    ratio = payable_days / working_days if working_days > 0 else 0

    basic       = round(monthly_ctc * (structure.basic_pct / 100) * ratio, 2)
    hra         = round(monthly_ctc * (structure.hra_pct / 100) * ratio, 2)
    std_allow   = round(monthly_ctc * (structure.standard_allowance_pct / 100) * ratio, 2)
    perf_bonus  = round(monthly_ctc * (structure.performance_bonus_pct / 100) * ratio, 2)
    lta         = round(monthly_ctc * (structure.lta_pct / 100) * ratio, 2)
    fixed_allow = round(monthly_ctc * (structure.fixed_allowance_pct / 100) * ratio, 2)

    gross        = round(basic + hra + std_allow + perf_bonus + lta + fixed_allow, 2)
    pf_employee  = round(basic * (structure.employee_pf_pct / 100), 2)
    pf_employer  = round(basic * (structure.employer_pf_pct / 100), 2)
    prof_tax     = get_professional_tax(gross)
    total_deductions = round(pf_employee + prof_tax, 2)
    net_pay      = round(gross - total_deductions, 2)
    employer_cost = round(gross + pf_employer, 2)

    return dict(
        basic_salary=basic, hra=hra, standard_allowance=std_allow,
        performance_bonus=perf_bonus, lta=lta, fixed_allowance=fixed_allow,
        gross_salary=gross, employer_cost=employer_cost,
        pf_employee=pf_employee, pf_employer=pf_employer,
        professional_tax=prof_tax, income_tax=0, other_deductions=0,
        total_deductions=total_deductions, net_pay=net_pay,
        working_days=working_days, days_present=days_present,
        leave_days=total_leave_days, paid_leave_days=paid_leave_days,
        unpaid_leave_days=unpaid_leave_days,
    )


# ─── employee master data ───────────────────────────────────────────────────

EMPLOYEE_DATA = [
    # first, last, dept, designation, ctc/month, joining_date, bank
    ("Arjun",    "Sharma",    "Engineering",   "Senior Software Engineer",  95000, date(2022, 3, 1),  "HDFC Bank",    "50100123456789", "HDFC0001234", "Mumbai Main"),
    ("Priya",    "Patel",     "Engineering",   "Software Engineer",          70000, date(2023, 1, 15), "SBI",          "30123456789012", "SBIN0001001", "Pune Branch"),
    ("Rohit",    "Gupta",     "Engineering",   "DevOps Engineer",            80000, date(2022, 7, 1),  "ICICI Bank",   "06789012345678", "ICIC0002345", "Bangalore"),
    ("Sneha",    "Verma",     "Engineering",   "QA Engineer",                65000, date(2023, 4, 10), "Axis Bank",    "91500012345678", "UTIB0003456", "Chennai"),
    ("Kiran",    "Reddy",     "Engineering",   "Frontend Developer",         72000, date(2022, 9, 1),  "Kotak Bank",   "72100098765432", "KKBK0004567", "Hyderabad"),
    ("Amit",     "Singh",     "HR",            "HR Manager",                 75000, date(2021, 6, 1),  "HDFC Bank",    "50100987654321", "HDFC0005678", "Delhi"),
    ("Pooja",    "Mehta",     "HR",            "HR Executive",               52000, date(2023, 2, 1),  "SBI",          "30987654321098", "SBIN0002002", "Mumbai"),
    ("Vikram",   "Nair",      "Finance",       "Senior Accountant",          68000, date(2021, 11, 1), "Union Bank",   "05100234567890", "UBIN0006789", "Kochi"),
    ("Anita",    "Joshi",     "Finance",       "Financial Analyst",          60000, date(2022, 5, 15), "Bank of Baroda","06870123456789","BARB0007890", "Ahmedabad"),
    ("Suresh",   "Kumar",     "Finance",       "Accounts Executive",         48000, date(2023, 7, 1),  "PNB",          "05201234567890", "PUNB0008901", "Lucknow"),
    ("Meera",    "Iyer",      "Marketing",     "Marketing Manager",          82000, date(2021, 3, 15), "ICICI Bank",   "06700123456789", "ICIC0009012", "Mumbai"),
    ("Rajesh",   "Pillai",    "Marketing",     "Digital Marketing Lead",     70000, date(2022, 8, 1),  "Axis Bank",    "91500098765432", "UTIB0010123", "Trivandrum"),
    ("Divya",    "Krishnan",  "Marketing",     "Content Strategist",         55000, date(2023, 3, 1),  "Kotak Bank",   "72100012345678", "KKBK0011234", "Bangalore"),
    ("Arun",     "Menon",     "Operations",    "Operations Manager",         90000, date(2020, 12, 1), "HDFC Bank",    "50100345678901", "HDFC0012345", "Chennai"),
    ("Lakshmi",  "Nambiar",   "Operations",    "Supply Chain Analyst",       62000, date(2022, 4, 1),  "SBI",          "30234567890123", "SBIN0003003", "Coimbatore"),
    ("Ganesh",   "Rao",       "Operations",    "Logistics Coordinator",      52000, date(2023, 6, 1),  "Canara Bank",  "08000123456789", "CNRB0013456", "Bangalore"),
    ("Sunita",   "Pandey",    "Sales",         "Sales Manager",              85000, date(2021, 9, 1),  "HDFC Bank",    "50100456789012", "HDFC0014567", "Delhi"),
    ("Manoj",    "Tiwari",    "Sales",         "Senior Sales Executive",     65000, date(2022, 2, 15), "SBI",          "30345678901234", "SBIN0004004", "Jaipur"),
    ("Neha",     "Agarwal",   "Sales",         "Sales Executive",            52000, date(2023, 5, 1),  "Axis Bank",    "91500034567890", "UTIB0015678", "Pune"),
    ("Deepak",   "Mishra",    "Support",       "Customer Success Lead",      58000, date(2022, 10, 1), "ICICI Bank",   "06700234567890", "ICIC0016789", "Hyderabad"),
]


# ─── main seed ──────────────────────────────────────────────────────────────

def seed():
    db = SessionLocal()
    try:
        if db.query(User).count() > 3:
            print("Database already has users. Skipping full seed.")
            return

        print("=" * 60)
        print("  EmPay HRMS - Full Seed (20 employees + 12-month payroll)")
        print("=" * 60)

        # Use existing company (whatever is registered), or create Acme Corp
        company = db.query(Company).first()
        if not company:
            company = Company(name="Acme Corp", email="admin@acmecorp.com",
                              phone="+91 9876543210")
            db.add(company)
            db.flush()
        print(f"\n[1/7] Company: {company.name} (id={company.id})")

        # derive email domain from existing company email or fallback
        domain = company.email.split('@')[-1] if company.email and '@' in company.email else 'acmecorp.com'

        # ── 2. Staff users ───────────────────────────────────────────────
        admin_user = db.query(User).filter(User.role == UserRole.ADMIN, User.company_id == company.id).first()
        if not admin_user:
            admin_user = User(email=f"admin@{domain}", full_name="Acme Admin",
                              role=UserRole.ADMIN,
                              hashed_password=get_password_hash("admin123"),
                              company_id=company.id)
            db.add(admin_user)

        hr_user = db.query(User).filter(User.role == UserRole.HR_OFFICER, User.company_id == company.id).first()
        if not hr_user:
            hr_user = User(email=f"hr@{domain}", full_name="HR Officer",
                           role=UserRole.HR_OFFICER,
                           hashed_password=get_password_hash("hr123"),
                           company_id=company.id)
            db.add(hr_user)

        pay_user = db.query(User).filter(User.role == UserRole.PAYROLL_OFFICER, User.company_id == company.id).first()
        if not pay_user:
            pay_user = User(email=f"payroll@{domain}", full_name="Payroll Officer",
                            role=UserRole.PAYROLL_OFFICER,
                            hashed_password=get_password_hash("payroll123"),
                            company_id=company.id)
            db.add(pay_user)

        db.flush()
        print("[2/7] Staff users created (admin / hr / payroll)")

        # ── 3. Leave types ───────────────────────────────────────────────
        lt_data = [
            ("Paid Time Off",  25, "Paid time off for personal matters"),
            ("Sick Leave",     12, "Leave for medical / health reasons"),
            ("Unpaid Leave",   30, "Leave without pay"),
        ]
        leave_types = []
        for name, days, desc in lt_data:
            lt = db.query(LeaveType).filter(LeaveType.name == name).first()
            if not lt:
                lt = LeaveType(name=name, max_days_per_year=days, description=desc)
                db.add(lt)
                db.flush()
            leave_types.append(lt)
        pto_type, sick_type, unpaid_type = leave_types
        print("[3/7] Leave types created")

        # ── 4. Employees ─────────────────────────────────────────────────
        print("[4/7] Creating 20 employees ...")
        employees = []
        for i, (first, last, dept, desg, ctc, joining, bank, acct, ifsc, branch) in enumerate(EMPLOYEE_DATA):
            email = f"{first.lower()}.{last.lower()}@{domain}"
            # deduplicate
            existing_user = db.query(User).filter(User.email == email).first()
            if existing_user:
                emp = db.query(Employee).filter(Employee.user_id == existing_user.id).first()
                if emp:
                    employees.append(emp)
                    continue

            emp_user = User(
                email=email,
                full_name=f"{first} {last}",
                role=UserRole.EMPLOYEE,
                hashed_password=get_password_hash("emp123"),
                company_id=company.id,
            )
            db.add(emp_user)
            db.flush()

            # emp_code format: company_initials + name_initials + year + serial
            co_abbrev = "AC"
            name_part = (first[:2] + last[:2]).upper()
            year_part = str(joining.year)
            serial    = str(i + 1).zfill(4)
            emp_code  = f"{co_abbrev}{name_part}{year_part}{serial}"

            emp = Employee(
                user_id=emp_user.id,
                company_id=company.id,
                emp_code=emp_code,
                first_name=first,
                last_name=last,
                department=dept,
                designation=desg,
                date_of_joining=joining,
                basic_salary=ctc,
                phone=f"+91 9{random.randint(100000000, 999999999)}",
                address=f"{random.randint(1,100)}, {dept} Nagar, India",
                bio=f"{first} is a seasoned {desg} with {2024 - joining.year + 1}+ years of experience in {dept}.",
                bank_name=bank,
                bank_account_number=acct,
                bank_ifsc_code=ifsc,
                bank_branch=branch,
            )
            db.add(emp)
            db.flush()
            employees.append(emp)

            # Salary structure (use defaults; slight variation per dept)
            ss = SalaryStructure(employee_id=emp.id)
            db.add(ss)
            db.flush()

            # Leave balances
            for lt in leave_types:
                lb = LeaveBalance(employee_id=emp.id, leave_type_id=lt.id,
                                  allocated=lt.max_days_per_year, used=0,
                                  remaining=lt.max_days_per_year)
                db.add(lb)

        db.flush()
        print(f"    -> {len(employees)} employees ready")

        # ── 5. Attendance + Leave requests (Jan–Dec 2024) ────────────────
        YEAR = 2024
        print(f"[5/7] Generating attendance & leave requests for {YEAR} ...")

        # Track leave usage per employee
        leave_used: dict[int, dict[int, int]] = {
            emp.id: {lt.id: 0 for lt in leave_types} for emp in employees
        }

        # Per employee, pick a few random leave windows across the year
        leave_requests_created = []
        for emp in employees:
            # 2–5 leave events spread across the year
            n_leaves = random.randint(2, 5)
            months_used = set()
            for _ in range(n_leaves):
                m = random.randint(1, 12)
                if m in months_used:
                    continue
                months_used.add(m)
                wdays = working_days_in_month(YEAR, m)
                if not wdays:
                    continue
                start_day = random.choice(wdays[:len(wdays)//2])   # first half of month
                duration  = random.choice([1, 2, 3])
                end_day   = start_day + timedelta(days=duration - 1)
                if end_day.month != m:
                    end_day = wdays[-1]

                # choose leave type: mostly PTO/Sick, rarely Unpaid
                lt_choice = random.choices(
                    leave_types,
                    weights=[50, 35, 15],
                    k=1
                )[0]

                remaining = lt_choice.max_days_per_year - leave_used[emp.id][lt_choice.id]
                actual_days = (end_day - start_day).days + 1
                if remaining < actual_days:
                    actual_days = remaining
                    if actual_days <= 0:
                        continue
                    end_day = start_day + timedelta(days=actual_days - 1)

                lr = LeaveRequest(
                    employee_id=emp.id,
                    leave_type_id=lt_choice.id,
                    start_date=start_day,
                    end_date=end_day,
                    reason=f"Personal reasons ({lt_choice.name})",
                    status=LeaveStatus.APPROVED,
                    approved_by=admin_user.id,
                )
                db.add(lr)
                leave_requests_created.append(lr)
                leave_used[emp.id][lt_choice.id] += actual_days

                # Update leave balance used/remaining
                lb = db.query(LeaveBalance).filter(
                    LeaveBalance.employee_id == emp.id,
                    LeaveBalance.leave_type_id == lt_choice.id,
                ).first()
                if lb:
                    lb.used      = leave_used[emp.id][lt_choice.id]
                    lb.remaining = max(0, lb.allocated - lb.used)

        db.flush()
        print(f"    -> {len(leave_requests_created)} leave requests created")

        # Build leave lookup: emp_id -> list of (start, end, leave_type_id)
        leave_lookup: dict[int, list] = {emp.id: [] for emp in employees}
        for lr in leave_requests_created:
            leave_lookup[lr.employee_id].append((lr.start_date, lr.end_date, lr.leave_type_id))

        def is_leave_day(emp_id, d):
            for start, end, _ in leave_lookup[emp_id]:
                if start <= d <= end:
                    return True
            return False

        # Create attendance records for every working day
        att_count = 0
        for emp in employees:
            for month in range(1, 13):
                wdays = working_days_in_month(YEAR, month)
                # employees hired after YEAR don't have records
                if emp.date_of_joining.year > YEAR:
                    continue
                for d in wdays:
                    if d < emp.date_of_joining:
                        continue
                    if is_leave_day(emp.id, d):
                        status = AttendanceStatus.ON_LEAVE
                    else:
                        # ~88% present, 5% half-day, 7% absent
                        r = random.random()
                        if r < 0.88:
                            status = AttendanceStatus.PRESENT
                        elif r < 0.93:
                            status = AttendanceStatus.HALF_DAY
                        else:
                            status = AttendanceStatus.ABSENT

                    att = Attendance(
                        employee_id=emp.id,
                        date=d,
                        status=status,
                        total_hours=8.0 if status == AttendanceStatus.PRESENT
                                    else (4.0 if status == AttendanceStatus.HALF_DAY else 0.0),
                    )
                    db.add(att)
                    att_count += 1

        db.flush()
        print(f"    -> {att_count} attendance records created")

        # ── 6. Payruns + Payslips (12 months) ────────────────────────────
        print("[6/7] Creating 12 payruns + payslips ...")

        total_payslips = 0
        for month in range(1, 13):
            payrun = Payrun(
                company_id=company.id,
                month=month,
                year=YEAR,
                status=PayrunStatus.VALIDATED,
                created_by=admin_user.id,
            )
            db.add(payrun)
            db.flush()

            run_total = 0
            run_count = 0

            for emp in employees:
                # skip employees who hadn't joined yet
                if emp.date_of_joining.year > YEAR:
                    continue
                if emp.date_of_joining.year == YEAR and emp.date_of_joining.month > month:
                    continue

                ss = db.query(SalaryStructure).filter(SalaryStructure.employee_id == emp.id).first()
                if not ss:
                    ss = SalaryStructure(employee_id=emp.id)
                    db.add(ss)
                    db.flush()

                # Attendance records this month
                att_recs = db.query(Attendance).filter(
                    Attendance.employee_id == emp.id,
                    Attendance.date >= date(YEAR, month, 1),
                    Attendance.date <= date(YEAR, month, calendar.monthrange(YEAR, month)[1]),
                ).all()

                # Approved leaves this month
                _, last_day = calendar.monthrange(YEAR, month)
                approved_lvs = [
                    lr for lr in leave_requests_created
                    if lr.employee_id == emp.id
                    and lr.status == LeaveStatus.APPROVED
                    and lr.start_date <= date(YEAR, month, last_day)
                    and lr.end_date >= date(YEAR, month, 1)
                ]

                lb_remaining = sum(
                    lb.remaining for lb in db.query(LeaveBalance).filter(
                        LeaveBalance.employee_id == emp.id).all()
                )

                calc = calculate_payslip_dict(emp, ss, att_recs, approved_lvs,
                                              lb_remaining, YEAR, month)

                payslip = Payslip(
                    payrun_id=payrun.id,
                    employee_id=emp.id,
                    status=PayslipStatus.DONE,
                    **calc,
                )
                db.add(payslip)
                run_total += calc["net_pay"]
                run_count += 1
                total_payslips += 1

            payrun.total_amount  = round(run_total, 2)
            payrun.employee_count = run_count
            db.flush()

        print(f"    -> 12 payruns, {total_payslips} payslips created")

        # ── 7. Commit ────────────────────────────────────────────────────
        db.commit()
        print("\n[7/7] OK - Database committed successfully!\n")

        print("=" * 60)
        print("  LOGIN CREDENTIALS")
        print("=" * 60)
        print("  Admin:   admin@acmecorp.com   / admin123")
        print("  HR:      hr@acmecorp.com      / hr123")
        print("  Payroll: payroll@acmecorp.com / payroll123")
        print("  Employees: <first>.<last>@<domain> / emp123")
        print("  Example: arjun.sharma@acmecorp.com / emp123")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        print(f"\nFAILED - Seed failed: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
