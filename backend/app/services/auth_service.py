from sqlalchemy.orm import Session
from app.models.user import User
from app.models.employee import Employee
from app.utils.security import get_password_hash, verify_password, create_access_token


def register_user(db: Session, email: str, password: str, full_name: str, role: str = "employee"):
    """Register a new user."""
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        return None, "Email already registered"

    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name=full_name,
        role=role,
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
