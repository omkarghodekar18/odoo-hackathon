import calendar
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from app.database import get_db
from app.models.user import User
from app.models.employee import Employee
from app.models.payroll import Payrun, Payslip, PayrunStatus, PayslipStatus
from app.schemas.payroll import PayrunCreate, PayslipUpdate
from app.utils.security import get_current_user
from app.utils.permissions import require_roles
from app.services.payroll_service import (
    create_payrun, compute_payslip, validate_payslip,
    cancel_payslip, reset_payslip_to_draft, validate_payrun,
)

router = APIRouter(prefix="/payroll", tags=["Payroll"])

MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


def _company_employee_ids(db, company_id):
    return [e.id for e in db.query(Employee.id).filter(Employee.company_id == company_id).all()]


# ── Payroll Dashboard ──────────────────────────────────────────────────────────

@router.get("/dashboard")
def get_payroll_dashboard(
    current_user: User = Depends(require_roles("admin", "payroll_officer")),
    db: Session = Depends(get_db),
):
    company_id = current_user.company_id
    emp_ids = _company_employee_ids(db, company_id)
    total_employees = len(emp_ids)

    # ── Warnings ──
    warnings = []
    # Employees without bank account (placeholder — field doesn't exist yet)
    warnings.append({
        "type": "bank_account",
        "message": "Employee without Bank A/C",
        "count": 0,
    })
    # Employees without manager (placeholder)
    warnings.append({
        "type": "manager",
        "message": "Employee without Manager",
        "count": 0,
    })

    # ── Pending payruns (months without a payrun this year) ──
    today = date.today()
    company_users = [u.id for u in db.query(User.id).filter(User.company_id == company_id).all()]
    existing_payruns = db.query(Payrun).filter(
        Payrun.company_id == company_id,
        Payrun.year == today.year,
    ).all()
    existing_months = {p.month for p in existing_payruns}

    pending_payruns = []
    for m in range(today.month, 0, -1):
        if m not in existing_months and total_employees > 0:
            label = f"Payrun for {MONTH_NAMES[m-1]} {today.year} ({total_employees} People)"
            pending_payruns.append({
                "month": m,
                "year": today.year,
                "employee_count": total_employees,
                "label": label,
            })

    # ── Cost chart (monthly — last 5 months) ──
    cost_chart_monthly = []
    count_chart_monthly = []
    for i in range(4, -1, -1):
        m = today.month - i
        y = today.year
        if m <= 0:
            m += 12
            y -= 1
        payrun = db.query(Payrun).filter(
            Payrun.company_id == company_id,
            Payrun.month == m, Payrun.year == y
        ).first()
        label = f"{MONTH_NAMES[m-1]} {y}"
        cost_chart_monthly.append({
            "label": label,
            "value": round(payrun.total_amount, 2) if payrun else 0,
        })
        count_chart_monthly.append({
            "label": label,
            "value": payrun.employee_count if payrun else 0,
        })

    # ── Annual chart (last 3 years) ──
    cost_chart_annual = []
    count_chart_annual = []
    for yr in range(today.year - 2, today.year + 1):
        total_cost = db.query(func.sum(Payrun.total_amount)).filter(
            Payrun.company_id == company_id, Payrun.year == yr
        ).scalar() or 0
        total_count = db.query(func.sum(Payrun.employee_count)).filter(
            Payrun.company_id == company_id, Payrun.year == yr
        ).scalar() or 0
        cost_chart_annual.append({"label": str(yr), "value": round(total_cost, 2)})
        count_chart_annual.append({"label": str(yr), "value": int(total_count)})

    return {
        "warnings": warnings,
        "pending_payruns": pending_payruns,
        "cost_chart_monthly": cost_chart_monthly,
        "cost_chart_annual": cost_chart_annual,
        "count_chart_monthly": count_chart_monthly,
        "count_chart_annual": count_chart_annual,
    }


# ── Payrun CRUD ────────────────────────────────────────────────────────────────

@router.post("/payrun")
def new_payrun(
    data: PayrunCreate,
    current_user: User = Depends(require_roles("admin", "payroll_officer")),
    db: Session = Depends(get_db),
):
    payrun, error = create_payrun(db, data.month, data.year, current_user.id, company_id=current_user.company_id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {
        "message": "Payrun created",
        "id": payrun.id,
        "total_amount": payrun.total_amount,
        "employee_count": payrun.employee_count,
    }


@router.get("/payruns")
def list_payruns(
    current_user: User = Depends(require_roles("admin", "payroll_officer")),
    db: Session = Depends(get_db),
):
    payruns = db.query(Payrun).filter(
        Payrun.company_id == current_user.company_id
    ).order_by(Payrun.year.desc(), Payrun.month.desc()).all()

    result = []
    for p in payruns:
        # Count payslips per payrun
        slip_count = db.query(Payslip).filter(Payslip.payrun_id == p.id).count()
        result.append({
            "id": p.id,
            "month": p.month,
            "year": p.year,
            "status": p.status.value,
            "total_amount": p.total_amount,
            "employee_count": p.employee_count or slip_count,
            "created_at": str(p.created_at),
        })
    return result


@router.get("/payrun/{payrun_id}")
def get_payrun_detail(
    payrun_id: int,
    current_user: User = Depends(require_roles("admin", "payroll_officer")),
    db: Session = Depends(get_db),
):
    payrun = db.query(Payrun).filter(Payrun.id == payrun_id).first()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found")

    payslips = db.query(Payslip).filter(Payslip.payrun_id == payrun_id).all()
    slip_data = []
    for s in payslips:
        emp = db.query(Employee).filter(Employee.id == s.employee_id).first()
        slip_data.append({
            "id": s.id,
            "payrun_id": s.payrun_id,
            "employee_id": s.employee_id,
            "employee_name": f"{emp.first_name} {emp.last_name}" if emp else "",
            "emp_code": emp.emp_code if emp else "",
            "status": s.status.value if s.status else "draft",
            "basic_salary": s.basic_salary,
            "hra": s.hra,
            "conveyance": s.conveyance,
            "medical": s.medical,
            "special_allowance": s.special_allowance,
            "gross_salary": s.gross_salary,
            "employer_cost": s.employer_cost or 0,
            "pf_deduction": s.pf_deduction,
            "professional_tax": s.professional_tax,
            "income_tax": s.income_tax,
            "other_deductions": s.other_deductions,
            "total_deductions": s.total_deductions,
            "net_pay": s.net_pay,
            "working_days": s.working_days,
            "days_present": s.days_present or 0,
            "leave_days": s.leave_days,
            "paid_leave_days": s.paid_leave_days or 0,
            "unpaid_leave_days": s.unpaid_leave_days or 0,
        })

    return {
        "id": payrun.id,
        "month": payrun.month,
        "year": payrun.year,
        "status": payrun.status.value,
        "total_amount": payrun.total_amount,
        "employee_count": payrun.employee_count or len(slip_data),
        "created_at": str(payrun.created_at),
        "payslips": slip_data,
    }


# ── Payrun status transitions ─────────────────────────────────────────────────

@router.put("/payrun/{payrun_id}/process")
def process_payrun(
    payrun_id: int,
    current_user: User = Depends(require_roles("admin", "payroll_officer")),
    db: Session = Depends(get_db),
):
    payrun = db.query(Payrun).filter(Payrun.id == payrun_id).first()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found")
    payrun.status = PayrunStatus.CONFIRMED
    db.commit()
    return {"message": "Payrun processed"}


@router.put("/payrun/{payrun_id}/validate")
def validate_payrun_endpoint(
    payrun_id: int,
    current_user: User = Depends(require_roles("admin", "payroll_officer")),
    db: Session = Depends(get_db),
):
    payrun = db.query(Payrun).filter(Payrun.id == payrun_id).first()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found")
    result, error = validate_payrun(db, payrun)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"message": "All payslips validated"}


@router.put("/payrun/{payrun_id}/pay")
def mark_payrun_paid(
    payrun_id: int,
    current_user: User = Depends(require_roles("admin", "payroll_officer")),
    db: Session = Depends(get_db),
):
    payrun = db.query(Payrun).filter(Payrun.id == payrun_id).first()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found")
    payrun.status = PayrunStatus.PAID
    db.commit()
    return {"message": "Payrun marked as paid"}


# ── Individual Payslip operations ──────────────────────────────────────────────

@router.get("/payslip/{payslip_id}")
def get_payslip_detail(
    payslip_id: int,
    current_user: User = Depends(require_roles("admin", "payroll_officer")),
    db: Session = Depends(get_db),
):
    slip = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not slip:
        raise HTTPException(status_code=404, detail="Payslip not found")

    emp = db.query(Employee).filter(Employee.id == slip.employee_id).first()
    payrun = db.query(Payrun).filter(Payrun.id == slip.payrun_id).first()

    # Build period string
    _, last_day = calendar.monthrange(payrun.year, payrun.month)
    period = f"01 {MONTH_NAMES[payrun.month-1]} to {last_day} {MONTH_NAMES[payrun.month-1]}"

    # Worked days breakdown
    worked_days = []
    attendance_amount = round((slip.days_present or 0) / slip.working_days * emp.basic_salary, 2) if slip.working_days > 0 else 0
    worked_days.append({
        "name": "Attendance",
        "days": slip.days_present or 0,
        "amount": attendance_amount,
    })
    if (slip.paid_leave_days or 0) > 0:
        leave_amount = round(slip.paid_leave_days / slip.working_days * emp.basic_salary, 2) if slip.working_days > 0 else 0
        worked_days.append({
            "name": "Paid Time Off",
            "days": slip.paid_leave_days,
            "amount": leave_amount,
        })
    if (slip.unpaid_leave_days or 0) > 0:
        worked_days.append({
            "name": "Unpaid Leave",
            "days": slip.unpaid_leave_days,
            "amount": 0,
        })

    # Salary computation lines
    salary_computation = [
        {"name": "Basic Salary", "amount": slip.basic_salary, "is_deduction": False},
        {"name": "House Rent Allowance (HRA)", "amount": slip.hra, "is_deduction": False},
        {"name": "Conveyance Allowance", "amount": slip.conveyance, "is_deduction": False},
        {"name": "Medical Allowance", "amount": slip.medical, "is_deduction": False},
    ]
    if slip.special_allowance > 0:
        salary_computation.append({"name": "Special Allowance", "amount": slip.special_allowance, "is_deduction": False})
    salary_computation.append({"name": "Gross Salary", "amount": slip.gross_salary, "is_deduction": False})
    salary_computation.append({"name": "Provident Fund (12%)", "amount": slip.pf_deduction, "is_deduction": True})
    if slip.professional_tax > 0:
        salary_computation.append({"name": "Professional Tax", "amount": slip.professional_tax, "is_deduction": True})
    if slip.income_tax > 0:
        salary_computation.append({"name": "Income Tax", "amount": slip.income_tax, "is_deduction": True})
    if slip.other_deductions > 0:
        salary_computation.append({"name": "Other Deductions", "amount": slip.other_deductions, "is_deduction": True})

    return {
        "id": slip.id,
        "payrun_id": slip.payrun_id,
        "employee_id": slip.employee_id,
        "employee_name": f"{emp.first_name} {emp.last_name}" if emp else "",
        "emp_code": emp.emp_code if emp else "",
        "status": slip.status.value if slip.status else "draft",
        "payrun_ref": f"Payrun {MONTH_NAMES[payrun.month-1]} {payrun.year}",
        "salary_structure": "Regular Pay",
        "period": period,
        "month": payrun.month,
        "year": payrun.year,
        "basic_salary": slip.basic_salary,
        "gross_salary": slip.gross_salary,
        "employer_cost": slip.employer_cost or 0,
        "net_pay": slip.net_pay,
        "total_deductions": slip.total_deductions,
        "working_days": slip.working_days,
        "days_present": slip.days_present or 0,
        "paid_leave_days": slip.paid_leave_days or 0,
        "unpaid_leave_days": slip.unpaid_leave_days or 0,
        "worked_days": worked_days,
        "salary_computation": salary_computation,
    }


@router.put("/payslip/{payslip_id}/compute")
def compute_payslip_endpoint(
    payslip_id: int,
    current_user: User = Depends(require_roles("admin", "payroll_officer")),
    db: Session = Depends(get_db),
):
    slip = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not slip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    result, error = compute_payslip(db, slip)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"message": "Payslip computed", "status": result.status.value}


@router.put("/payslip/{payslip_id}/validate")
def validate_payslip_endpoint(
    payslip_id: int,
    current_user: User = Depends(require_roles("admin", "payroll_officer")),
    db: Session = Depends(get_db),
):
    slip = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not slip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    result, error = validate_payslip(db, slip)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"message": "Payslip validated", "status": result.status.value}


@router.put("/payslip/{payslip_id}/cancel")
def cancel_payslip_endpoint(
    payslip_id: int,
    current_user: User = Depends(require_roles("admin", "payroll_officer")),
    db: Session = Depends(get_db),
):
    slip = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not slip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    result, error = cancel_payslip(db, slip)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"message": "Payslip cancelled", "status": result.status.value}


@router.put("/payslip/{payslip_id}/draft")
def reset_payslip_draft(
    payslip_id: int,
    current_user: User = Depends(require_roles("admin", "payroll_officer")),
    db: Session = Depends(get_db),
):
    slip = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not slip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    result, error = reset_payslip_to_draft(db, slip)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"message": "Payslip reset to draft", "status": result.status.value}


@router.put("/payslip/{payslip_id}")
def update_payslip(
    payslip_id: int,
    data: PayslipUpdate,
    current_user: User = Depends(require_roles("admin", "payroll_officer")),
    db: Session = Depends(get_db),
):
    slip = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not slip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    if data.special_allowance is not None:
        slip.special_allowance = data.special_allowance
        slip.gross_salary = slip.basic_salary + slip.hra + slip.conveyance + slip.medical + data.special_allowance
    if data.other_deductions is not None:
        slip.other_deductions = data.other_deductions
    if data.income_tax is not None:
        slip.income_tax = data.income_tax
    slip.total_deductions = slip.pf_deduction + slip.professional_tax + slip.income_tax + slip.other_deductions
    slip.net_pay = slip.gross_salary - slip.total_deductions
    slip.employer_cost = slip.gross_salary + round(slip.basic_salary * 0.12, 2)
    db.commit()
    return {"message": "Payslip updated", "net_pay": slip.net_pay}


# ── Employee's own payslips ────────────────────────────────────────────────────

@router.get("/my-payslips")
def get_my_payslips(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found")
    payslips = db.query(Payslip).filter(Payslip.employee_id == emp.id).all()
    result = []
    for s in payslips:
        payrun = db.query(Payrun).filter(Payrun.id == s.payrun_id).first()
        result.append({
            "id": s.id,
            "month": payrun.month if payrun else 0,
            "year": payrun.year if payrun else 0,
            "status": s.status.value if s.status else (payrun.status.value if payrun else ""),
            "basic_salary": s.basic_salary,
            "hra": s.hra,
            "conveyance": s.conveyance,
            "medical": s.medical,
            "special_allowance": s.special_allowance,
            "gross_salary": s.gross_salary,
            "employer_cost": s.employer_cost or 0,
            "pf_deduction": s.pf_deduction,
            "professional_tax": s.professional_tax,
            "income_tax": s.income_tax,
            "other_deductions": s.other_deductions,
            "total_deductions": s.total_deductions,
            "net_pay": s.net_pay,
            "working_days": s.working_days,
            "days_present": s.days_present or 0,
            "leave_days": s.leave_days,
            "paid_leave_days": s.paid_leave_days or 0,
            "unpaid_leave_days": s.unpaid_leave_days or 0,
        })
    return result
