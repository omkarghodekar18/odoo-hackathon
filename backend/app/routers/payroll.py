from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.employee import Employee
from app.models.payroll import Payrun, Payslip, PayrunStatus
from app.schemas.payroll import PayrunCreate, PayslipUpdate
from app.utils.security import get_current_user
from app.utils.permissions import require_roles
from app.services.payroll_service import create_payrun

router = APIRouter(prefix="/payroll", tags=["Payroll"])


@router.post("/payrun")
def new_payrun(data: PayrunCreate, current_user: User = Depends(require_roles("admin", "payroll_officer")), db: Session = Depends(get_db)):
    payrun, error = create_payrun(db, data.month, data.year, current_user.id, company_id=current_user.company_id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"message": "Payrun created", "id": payrun.id, "total_amount": payrun.total_amount}


@router.get("/payruns")
def list_payruns(current_user: User = Depends(require_roles("admin", "payroll_officer")), db: Session = Depends(get_db)):
    company_users = [u.id for u in db.query(User.id).filter(User.company_id == current_user.company_id).all()]
    payruns = db.query(Payrun).filter(Payrun.created_by.in_(company_users)).order_by(Payrun.created_at.desc()).all()
    return [{"id": p.id, "month": p.month, "year": p.year, "status": p.status.value, "total_amount": p.total_amount, "created_at": str(p.created_at)} for p in payruns]


@router.get("/payrun/{payrun_id}")
def get_payrun_detail(payrun_id: int, current_user: User = Depends(require_roles("admin", "payroll_officer")), db: Session = Depends(get_db)):
    payrun = db.query(Payrun).filter(Payrun.id == payrun_id).first()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found")
    payslips = db.query(Payslip).filter(Payslip.payrun_id == payrun_id).all()
    slip_data = []
    for s in payslips:
        emp = db.query(Employee).filter(Employee.id == s.employee_id).first()
        slip_data.append({"id": s.id, "payrun_id": s.payrun_id, "employee_id": s.employee_id, "employee_name": f"{emp.first_name} {emp.last_name}" if emp else "", "emp_code": emp.emp_code if emp else "", "basic_salary": s.basic_salary, "hra": s.hra, "conveyance": s.conveyance, "medical": s.medical, "special_allowance": s.special_allowance, "gross_salary": s.gross_salary, "pf_deduction": s.pf_deduction, "professional_tax": s.professional_tax, "income_tax": s.income_tax, "other_deductions": s.other_deductions, "total_deductions": s.total_deductions, "net_pay": s.net_pay, "working_days": s.working_days, "days_present": s.days_present, "leave_days": s.leave_days})
    return {"id": payrun.id, "month": payrun.month, "year": payrun.year, "status": payrun.status.value, "total_amount": payrun.total_amount, "created_at": str(payrun.created_at), "payslips": slip_data}


@router.put("/payrun/{payrun_id}/process")
def process_payrun(payrun_id: int, current_user: User = Depends(require_roles("admin", "payroll_officer")), db: Session = Depends(get_db)):
    payrun = db.query(Payrun).filter(Payrun.id == payrun_id).first()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found")
    payrun.status = PayrunStatus.PROCESSED
    db.commit()
    return {"message": "Payrun processed"}


@router.put("/payrun/{payrun_id}/pay")
def mark_payrun_paid(payrun_id: int, current_user: User = Depends(require_roles("admin", "payroll_officer")), db: Session = Depends(get_db)):
    payrun = db.query(Payrun).filter(Payrun.id == payrun_id).first()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found")
    payrun.status = PayrunStatus.PAID
    db.commit()
    return {"message": "Payrun marked as paid"}


@router.put("/payslip/{payslip_id}")
def update_payslip(payslip_id: int, data: PayslipUpdate, current_user: User = Depends(require_roles("admin", "payroll_officer")), db: Session = Depends(get_db)):
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
    db.commit()
    return {"message": "Payslip updated", "net_pay": slip.net_pay}


@router.get("/my-payslips")
def get_my_payslips(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found")
    payslips = db.query(Payslip).filter(Payslip.employee_id == emp.id).all()
    result = []
    for s in payslips:
        payrun = db.query(Payrun).filter(Payrun.id == s.payrun_id).first()
        result.append({"id": s.id, "month": payrun.month if payrun else 0, "year": payrun.year if payrun else 0, "status": payrun.status.value if payrun else "", "basic_salary": s.basic_salary, "hra": s.hra, "conveyance": s.conveyance, "medical": s.medical, "special_allowance": s.special_allowance, "gross_salary": s.gross_salary, "pf_deduction": s.pf_deduction, "professional_tax": s.professional_tax, "income_tax": s.income_tax, "other_deductions": s.other_deductions, "total_deductions": s.total_deductions, "net_pay": s.net_pay, "working_days": s.working_days, "days_present": s.days_present, "leave_days": s.leave_days})
    return result
