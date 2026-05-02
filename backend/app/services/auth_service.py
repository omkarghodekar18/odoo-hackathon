from sqlalchemy.orm import Session
from app.models.user import User
from app.models.employee import Employee
from app.utils.security import get_password_hash, verify_password, create_access_token


from app.models.company import Company

def register_company(db: Session, company_name: str, email: str, password: str, phone: str = None, logo: str = None):
    """Register a new company and its initial admin user."""
    # Check email exists
    if db.query(User).filter(User.email == email).first():
        return None, None, "Email already registered"

    # Create Company
    company = Company(
        name=company_name,
        email=email,
        phone=phone,
        logo=logo,
    )
    db.add(company)
    db.flush()

    # Create Admin User
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name="Admin",
        role="admin",
        company_id=company.id,
    )
    db.add(user)
    db.commit()
    db.refresh(company)
    db.refresh(user)
    return company, user, None

def register_user(db: Session, email: str, password: str, full_name: str, role: str = "employee", company_id: int = None):
    """Register a new user."""
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        return None, "Email already registered"

    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name=full_name,
        role=role,
        company_id=company_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user, None


def authenticate_user(db: Session, email_or_id: str, password: str):
    """Authenticate user and return token. Supports email or Employee Login ID."""
    user = db.query(User).filter(User.email == email_or_id).first()
    
    if not user:
        employee = db.query(Employee).filter(Employee.emp_code == email_or_id).first()
        if employee:
            user = db.query(User).filter(User.id == employee.user_id).first()

    if not user or not verify_password(password, user.hashed_password):
        return None, None

    token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    return user, token
