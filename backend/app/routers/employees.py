from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User, UserRole
from app.models.employee import Employee
from app.models.leave import LeaveType, LeaveBalance
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse, EmployeeWithUser
from app.utils.security import get_current_user
from app.utils.permissions import require_roles
from app.services.auth_service import register_user

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get("/", response_model=List[EmployeeWithUser])
def list_employees(
    department: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all employees in the same company."""
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
            created_at=emp.created_at,
            user_email=user.email if user else None,
            user_role=user.role.value if user else None,
            is_active=user.is_active if user else None,
        ))
    return result


@router.post("/", response_model=EmployeeResponse)
def create_employee(
    emp_data: EmployeeCreate,
    current_user: User = Depends(require_roles("admin", "hr_officer")),
    db: Session = Depends(get_db)
):
    """Create employee profile. Admin/HR only. Employee is scoped to admin's company."""
    existing = db.query(Employee).filter(Employee.emp_code == emp_data.emp_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Employee code already exists")

    # Generate email if not provided
    email = emp_data.email
    if not email:
        domain = current_user.email.split("@")[-1] if "@" in current_user.email else "company.com"
        base_email = f"{emp_data.first_name.lower()}.{emp_data.last_name.lower()}@{domain}"
        email = base_email
        counter = 1
        # ensure unique email
        while db.query(User).filter(User.email == email).first():
            email = f"{emp_data.first_name.lower()}.{emp_data.last_name.lower()}{counter}@{domain}"
            counter += 1

    # Create the user account first, linked to admin's company
    user, error = register_user(
        db, 
        email=email, 
        password=emp_data.password, 
        full_name=f"{emp_data.first_name} {emp_data.last_name}",
        role="employee",
        company_id=current_user.company_id,
    )
    if error:
        raise HTTPException(status_code=400, detail=error)

    emp_dict = emp_data.model_dump(exclude={"email", "password"})
    employee = Employee(**emp_dict, user_id=user.id, company_id=current_user.company_id)
    db.add(employee)
    db.commit()
    db.refresh(employee)

    # Auto-allocate leave balances
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

    return employee


@router.get("/{employee_id}", response_model=EmployeeWithUser)
def get_employee(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get employee details (must be in same company)."""
    emp = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.company_id == current_user.company_id
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    user = db.query(User).filter(User.id == emp.user_id).first()
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
        created_at=emp.created_at,
        user_email=user.email if user else None,
        user_role=user.role.value if user else None,
        is_active=user.is_active if user else None,
    )


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


@router.delete("/{employee_id}")
def delete_employee(
    employee_id: int,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db)
):
    """Delete employee. Admin only. Scoped to company."""
    emp = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.company_id == current_user.company_id
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    db.delete(emp)
    db.commit()
    return {"message": "Employee deleted"}


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
        created_at=emp.created_at,
        user_email=current_user.email,
        user_role=current_user.role.value,
        is_active=current_user.is_active,
    )
