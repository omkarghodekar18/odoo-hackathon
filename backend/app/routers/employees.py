import random
import string
import re
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User, UserRole
from app.models.employee import Employee
from app.models.company import Company
from app.models.leave import LeaveType, LeaveBalance, LeaveRequest, LeaveStatus
from app.models.attendance import AttendanceSession
from app.schemas.employee import (
    EmployeeCreate, EmployeeUpdate, EmployeeResponse,
    EmployeeWithUser, EmployeeCreatedResponse, EmployeeSelfUpdate
)
from app.utils.security import get_current_user
from app.utils.permissions import require_roles
from app.services.auth_service import register_user

router = APIRouter(prefix="/employees", tags=["Employees"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _company_abbrev(name: str, length: int = 2) -> str:
    """Return uppercase initials of first `length` meaningful words in company name."""
    words = re.findall(r"[A-Za-z]+", name)
    abbrev = "".join(w[0].upper() for w in words[:length])
    return abbrev.ljust(length, "X")[:length]  # pad / truncate to exactly `length`


def _name_initials(first: str, last: str) -> str:
    """Return first 2 letters of first name + first 2 letters of last name (uppercase)."""
    f = re.sub(r"[^A-Za-z]", "", first).upper()
    l = re.sub(r"[^A-Za-z]", "", last).upper()
    return (f[:2].ljust(2, "X") + l[:2].ljust(2, "X"))


def generate_emp_code(db: Session, company: Company, first_name: str, last_name: str, year: int) -> str:
    """
    Generate employee code in the format:
        <company_abbrev(2)> + <name_initials(4)> + <year(4)> + <serial(4)>
    Example: OIJODO20220001
    """
    co_abbrev = _company_abbrev(company.name)          # e.g. "OJ"
    name_part  = _name_initials(first_name, last_name) # e.g. "IODO"
    prefix = f"{co_abbrev}{name_part}{year}"            # e.g. "OIJODO2022"

    # Serial is yearly per company (joining sequence for that year).
    year_start = date(year, 1, 1)
    year_end = date(year + 1, 1, 1)
    existing = db.query(Employee).filter(
        Employee.company_id == company.id,
        Employee.date_of_joining >= year_start,
        Employee.date_of_joining < year_end,
    ).count()
    serial = str(existing + 1).zfill(4)               # e.g. "0001"
    return f"{prefix}{serial}"


def generate_password(length: int = 10) -> str:
    """Generate a secure random password."""
    alphabet = string.ascii_letters + string.digits + "!@#$"
    while True:
        pwd = "".join(random.choices(alphabet, k=length))
        # Ensure at least one digit, one uppercase, one lowercase, one special
        if (any(c.isupper() for c in pwd)
                and any(c.islower() for c in pwd)
                and any(c.isdigit() for c in pwd)
                and any(c in "!@#$" for c in pwd)):
            return pwd


# ─── Self-service (must be BEFORE /{employee_id} to avoid route conflicts) ───

@router.get("/me/profile", response_model=EmployeeWithUser)
def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's employee profile."""
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found")

    return EmployeeWithUser(
        id=emp.id,
        user_id=emp.user_id,
        emp_code=emp.emp_code,
        first_name=emp.first_name,
        last_name=emp.last_name,
        department=emp.department,
        designation=emp.designation,
        date_of_joining=emp.date_of_joining,
        basic_salary=emp.basic_salary,
        phone=emp.phone,
        address=emp.address,
        bio=emp.bio,
        resume=emp.resume,
        bank_name=emp.bank_name,
        bank_account_number=emp.bank_account_number,
        bank_ifsc_code=emp.bank_ifsc_code,
        bank_branch=emp.bank_branch,
        created_at=emp.created_at,
        user_email=current_user.email,
        user_role=current_user.role.value,
        is_active=current_user.is_active,
    )


@router.put("/me/profile", response_model=EmployeeResponse)
def update_my_profile(
    emp_data: EmployeeSelfUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's employee profile (bio, resume, phone, address)."""
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found")

    update_data = emp_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(emp, key, value)

    db.commit()
    db.refresh(emp)
    return emp


# ─── List & Status ────────────────────────────────────────────────────────────

@router.get("/", response_model=List[EmployeeWithUser])
def list_employees(
    department: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all employees in the same company. All roles can view (read-only)."""
    query = db.query(Employee).filter(Employee.company_id == current_user.company_id)
    if department:
        query = query.filter(Employee.department == department)
    employees = query.all()

    result = []
    for emp in employees:
        user = db.query(User).filter(User.id == emp.user_id).first()
        result.append(EmployeeWithUser(
            id=emp.id,
            user_id=emp.user_id,
            emp_code=emp.emp_code,
            first_name=emp.first_name,
            last_name=emp.last_name,
            department=emp.department,
            designation=emp.designation,
            date_of_joining=emp.date_of_joining,
            basic_salary=emp.basic_salary,
            phone=emp.phone,
            address=emp.address,
            bio=emp.bio,
            resume=emp.resume,
            bank_name=emp.bank_name,
            bank_account_number=emp.bank_account_number,
            bank_ifsc_code=emp.bank_ifsc_code,
            bank_branch=emp.bank_branch,
            created_at=emp.created_at,
            user_email=user.email if user else None,
            user_role=user.role.value if user else None,
            is_active=user.is_active if user else None,
        ))
    return result


@router.get("/status/all")
def get_all_employee_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all employees with their current attendance status for today.
    Returns: present (active session / checked-in), on_leave (approved leave), absent (neither).
    """
    today = date.today()
    employees = db.query(Employee).filter(Employee.company_id == current_user.company_id).all()

    result = []
    for emp in employees:
        user = db.query(User).filter(User.id == emp.user_id).first()

        # Check if employee has an active (open) session today
        active_session = db.query(AttendanceSession).filter(
            AttendanceSession.employee_id == emp.id,
            AttendanceSession.date == today,
            AttendanceSession.logout_time.is_(None),
        ).first()

        # Check if employee has any session today (even closed)
        any_session_today = db.query(AttendanceSession).filter(
            AttendanceSession.employee_id == emp.id,
            AttendanceSession.date == today,
        ).first()

        # Check if employee is on approved leave today
        on_leave = db.query(LeaveRequest).filter(
            LeaveRequest.employee_id == emp.id,
            LeaveRequest.status == LeaveStatus.APPROVED,
            LeaveRequest.start_date <= today,
            LeaveRequest.end_date >= today,
        ).first()

        if active_session or any_session_today:
            attendance_status = "present"
        elif on_leave:
            attendance_status = "on_leave"
        else:
            attendance_status = "absent"

        result.append({
            "id": emp.id,
            "user_id": emp.user_id,
            "emp_code": emp.emp_code,
            "first_name": emp.first_name,
            "last_name": emp.last_name,
            "department": emp.department,
            "designation": emp.designation,
            "date_of_joining": str(emp.date_of_joining),
            "basic_salary": emp.basic_salary,
            "phone": emp.phone,
            "address": emp.address,
            "bio": emp.bio,
            "resume": emp.resume,
            "bank_name": emp.bank_name,
            "bank_account_number": emp.bank_account_number,
            "bank_ifsc_code": emp.bank_ifsc_code,
            "bank_branch": emp.bank_branch,
            "user_email": user.email if user else None,
            "user_role": user.role.value if user else None,
            "is_active": user.is_active if user else None,
            "attendance_status": attendance_status,
        })
    return result


# ─── Salary Info (admin + payroll_officer only) ──────────────────────────────

@router.get("/{employee_id}/salary-info")
def get_employee_salary_info(
    employee_id: int,
    current_user: User = Depends(require_roles("admin", "payroll_officer")),
    db: Session = Depends(get_db),
):
    """
    Get detailed salary breakdown for an employee.
    Uses SalaryStructure if available, otherwise defaults.
    basic_salary field is treated as Monthly CTC.
    """
    from app.services.payroll_service import get_professional_tax
    from app.models.salary_structure import SalaryStructure

    emp = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.company_id == current_user.company_id,
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    ctc = emp.basic_salary or 0  # basic_salary = monthly CTC

    # Get custom structure or defaults
    struct = db.query(SalaryStructure).filter(SalaryStructure.employee_id == emp.id).first()
    basic_pct = struct.basic_pct if struct else 50.0
    hra_pct = struct.hra_pct if struct else 20.0
    sa_pct = struct.standard_allowance_pct if struct else 5.67
    pb_pct = struct.performance_bonus_pct if struct else 8.33
    lta_pct = struct.lta_pct if struct else 8.33
    fa_pct = struct.fixed_allowance_pct if struct else 7.67
    emp_pf_pct = struct.employee_pf_pct if struct else 12.0
    empr_pf_pct = struct.employer_pf_pct if struct else 12.0

    # Compute amounts from CTC
    basic = round(ctc * basic_pct / 100, 2)
    hra = round(ctc * hra_pct / 100, 2)
    standard_allowance = round(ctc * sa_pct / 100, 2)
    performance_bonus = round(ctc * pb_pct / 100, 2)
    leave_travel_allowance = round(ctc * lta_pct / 100, 2)
    fixed_allowance = round(ctc * fa_pct / 100, 2)
    month_wage = ctc

    # PF (based on basic component)
    employee_pf = round(basic * emp_pf_pct / 100, 2)
    employer_pf = round(basic * empr_pf_pct / 100, 2)

    # Tax
    professional_tax = get_professional_tax(month_wage)

    return {
        "employee_id": emp.id,
        "employee_name": f"{emp.first_name} {emp.last_name}",
        "monthly_ctc": ctc,
        "month_wage": month_wage,
        "yearly_wage": round(month_wage * 12, 2),
        "working_days_per_week": 5,
        "break_time_hours": 1,
        "salary_components": [
            {"key": "basic", "name": "Basic Salary", "amount": basic, "percentage": basic_pct,
             "description": "Define Basic salary from company cost compute it based on monthly wages."},
            {"key": "hra", "name": "House Rent Allowance", "amount": hra, "percentage": hra_pct,
             "description": "HRA provided to employees 50% of the basic salary."},
            {"key": "standard_allowance", "name": "Standard Allowance", "amount": standard_allowance, "percentage": sa_pct,
             "description": "A standard allowance is a predetermined, fixed amount provided to employee as part of their salary."},
            {"key": "performance_bonus", "name": "Performance Bonus", "amount": performance_bonus, "percentage": pb_pct,
             "description": "Variable amount paid during payroll. The value defined by the company and calculated as a % of the basic salary."},
            {"key": "lta", "name": "Leave Travel Allowance", "amount": leave_travel_allowance, "percentage": lta_pct,
             "description": "LTA is paid by the company to employees to cover their travel expenses, and calculated as a % of the basic salary."},
            {"key": "fixed_allowance", "name": "Fixed Allowance", "amount": fixed_allowance, "percentage": fa_pct,
             "description": "Fixed allowance portion of wages is determined after calculating all salary components."},
        ],
        "pf_contribution": {
            "employee": {"amount": employee_pf, "percentage": emp_pf_pct,
                         "description": "PF is calculated based on the basic salary."},
            "employer": {"amount": employer_pf, "percentage": empr_pf_pct,
                         "description": "PF is calculated based on the basic salary."},
        },
        "tax_deductions": {
            "professional_tax": {"amount": professional_tax,
                                 "description": "Professional Tax deducted from the Gross salary."},
        },
    }


@router.put("/{employee_id}/salary-info")
def update_employee_salary_info(
    employee_id: int,
    payload: dict,
    current_user: User = Depends(require_roles("admin", "payroll_officer")),
    db: Session = Depends(get_db),
):
    """
    Update employee CTC and/or salary structure percentages.
    Accepts: monthly_ctc, basic_pct, hra_pct, standard_allowance_pct,
    performance_bonus_pct, lta_pct, fixed_allowance_pct, employee_pf_pct, employer_pf_pct
    """
    from app.models.salary_structure import SalaryStructure

    emp = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.company_id == current_user.company_id,
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Update CTC if provided
    if "monthly_ctc" in payload and payload["monthly_ctc"] is not None:
        emp.basic_salary = float(payload["monthly_ctc"])

    # Get or create structure
    struct = db.query(SalaryStructure).filter(SalaryStructure.employee_id == emp.id).first()
    if not struct:
        struct = SalaryStructure(employee_id=emp.id)
        db.add(struct)

    # Update percentages
    pct_fields = [
        "basic_pct", "hra_pct", "standard_allowance_pct",
        "performance_bonus_pct", "lta_pct", "fixed_allowance_pct",
        "employee_pf_pct", "employer_pf_pct",
    ]
    for field in pct_fields:
        if field in payload and payload[field] is not None:
            setattr(struct, field, float(payload[field]))

    db.commit()
    return {"message": "Salary structure updated successfully"}


# ─── Employee Detail (single) ────────────────────────────────────────────────

@router.get("/{employee_id}")
def get_employee_detail(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single employee's full detail. Must be in same company."""
    emp = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.company_id == current_user.company_id,
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    user = db.query(User).filter(User.id == emp.user_id).first()
    return {
        "id": emp.id,
        "user_id": emp.user_id,
        "emp_code": emp.emp_code,
        "first_name": emp.first_name,
        "last_name": emp.last_name,
        "department": emp.department,
        "designation": emp.designation,
        "date_of_joining": str(emp.date_of_joining),
        "basic_salary": emp.basic_salary,
        "phone": emp.phone,
        "address": emp.address,
        "bio": emp.bio,
        "resume": emp.resume,
        "bank_name": emp.bank_name,
        "bank_account_number": emp.bank_account_number,
        "bank_ifsc_code": emp.bank_ifsc_code,
        "bank_branch": emp.bank_branch,
        "user_email": user.email if user else None,
        "user_role": user.role.value if user else None,
        "is_active": user.is_active if user else None,
    }


# ─── Create Employee (admin + hr_officer only) ───────────────────────────────

@router.post("/", response_model=EmployeeCreatedResponse)
def create_employee(
    emp_data: EmployeeCreate,
    current_user: User = Depends(require_roles("admin", "hr_officer")),
    db: Session = Depends(get_db)

):
    """
    Create employee profile. Admin/HR only.
    - emp_code is auto-generated in format <CO><INIT><YEAR><SERIAL>
    - password is auto-generated and returned once in the response
    """
    company = db.query(Company).filter(Company.id == current_user.company_id).first()
    if not company:
        raise HTTPException(status_code=400, detail="Company not found")

    # ── Auto-generate employee code ──────────────────────────────────────────
    year = emp_data.date_of_joining.year
    emp_code = generate_emp_code(db, company, emp_data.first_name, emp_data.last_name, year)

    # ── Auto-generate company email ─────────────────────────────────────────
    domain = current_user.email.split("@")[-1] if "@" in current_user.email else "company.com"
    base_email = f"{emp_data.first_name.lower()}.{emp_data.last_name.lower()}@{domain}"
    company_email = base_email
    counter = 1
    while db.query(User).filter(User.email == company_email).first():
        company_email = f"{emp_data.first_name.lower()}.{emp_data.last_name.lower()}{counter}@{domain}"
        counter += 1

    # ── Auto-generate password ───────────────────────────────────────────────
    plain_password = generate_password()

    # ── Create user account ──────────────────────────────────────────────────
    user, error = register_user(
        db,
        email=company_email,
        password=plain_password,
        full_name=f"{emp_data.first_name} {emp_data.last_name}",
        role="employee",
        company_id=current_user.company_id,
    )
    if error:
        raise HTTPException(status_code=400, detail=error)

    emp_dict = emp_data.model_dump(exclude={"email"})
    employee = Employee(**emp_dict, emp_code=emp_code, user_id=user.id, company_id=current_user.company_id)
    db.add(employee)
    db.commit()
    db.refresh(employee)

    # ── Auto-allocate leave balances ─────────────────────────────────────────
    leave_types = db.query(LeaveType).all()
    for lt in leave_types:
        balance = LeaveBalance(
            employee_id=employee.id,
            leave_type_id=lt.id,
            allocated=lt.max_days_per_year,
            used=0,
            remaining=lt.max_days_per_year,
        )
        db.add(balance)
    db.commit()

    return EmployeeCreatedResponse(
        id=employee.id,
        user_id=employee.user_id,
        emp_code=employee.emp_code,
        first_name=employee.first_name,
        last_name=employee.last_name,
        department=employee.department,
        designation=employee.designation,
        date_of_joining=employee.date_of_joining,
        basic_salary=employee.basic_salary,
        phone=employee.phone,
        address=employee.address,
        bio=employee.bio,
        resume=employee.resume,
        bank_name=employee.bank_name,
        bank_account_number=employee.bank_account_number,
        bank_ifsc_code=employee.bank_ifsc_code,
        bank_branch=employee.bank_branch,
        created_at=employee.created_at,
        user_email=company_email,
        user_role="employee",
        is_active=True,
        generated_password=plain_password,
    )


# ─── Update Employee (admin + hr_officer only) ──────────────────────────────

@router.put("/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: int,
    emp_data: EmployeeUpdate,
    current_user: User = Depends(require_roles("admin", "hr_officer")),
    db: Session = Depends(get_db)
):
    """Update employee. Admin/HR only. Scoped to company."""
    emp = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.company_id == current_user.company_id
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    update_data = emp_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(emp, key, value)

    db.commit()
    db.refresh(emp)
    return emp


# ─── Delete Employee (admin only) ────────────────────────────────────────────

@router.delete("/{employee_id}")
def delete_employee(
    employee_id: int,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db)
):
    """Delete employee and all related records. Admin only. Scoped to company."""
    from app.models.payroll import Payslip
    from app.models.salary_structure import SalaryStructure

    emp = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.company_id == current_user.company_id
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Cascade-delete all related records
    db.query(AttendanceSession).filter(AttendanceSession.employee_id == emp.id).delete()
    from app.models.attendance import Attendance
    db.query(Attendance).filter(Attendance.employee_id == emp.id).delete()
    db.query(LeaveBalance).filter(LeaveBalance.employee_id == emp.id).delete()
    db.query(LeaveRequest).filter(LeaveRequest.employee_id == emp.id).delete()
    db.query(Payslip).filter(Payslip.employee_id == emp.id).delete()
    db.query(SalaryStructure).filter(SalaryStructure.employee_id == emp.id).delete()

    # Delete the user account
    user = db.query(User).filter(User.id == emp.user_id).first()

    db.delete(emp)
    if user:
        db.delete(user)

    db.commit()
    return {"message": "Employee deleted"}

# ─── Email Credentials (admin + hr_officer only) ─────────────────────────────

from pydantic import BaseModel

class CredentialsPayload(BaseModel):
    name: str
    email: str
    login_email: str = None
    emp_code: str
    password: str

from app.utils.email_service import send_credentials_email

@router.post("/send-credentials")
def send_credentials(
    payload: CredentialsPayload,
    current_user: User = Depends(require_roles("admin", "hr_officer")),
):
    """
    Endpoint to send actual credentials via email using SMTP.
    """
    try:
        print("credentials payload",payload)
        send_credentials_email(
            to_email=payload.email,
            name=payload.name,
            emp_code=payload.emp_code,
            password=payload.password,
            login_email=payload.login_email
        )
        return {"message": "Credentials sent to email successfully"}
    except Exception as e:
        # If SMTP is not configured, fallback to console log for testing
        print(f"\n{'='*50}")
        print(f"📧 FALLBACK: MOCK EMAIL TO: {payload.email}")
        print(f"Reason: {str(e)}")
        print(f"Employee ID: {payload.emp_code}")
        print(f"Password: {payload.password}")
        print(f"{'='*50}\n")
        # Return 200 so the frontend doesn't show an error toast, but indicate it was mocked
        return {"message": "Credentials logged to console (SMTP not configured)"}
