import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, Form, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.user import UserCreate, UserLogin, UserResponse, UserUpdate, Token
from app.models.user import User
from app.models.company import Company
from app.services.auth_service import register_company, authenticate_user
from app.utils.security import get_current_user, get_password_hash

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register")
def register(
    company_name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    confirm_password: str = Form(...),
    phone: str = Form(None),
    logo: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    """Register a new company."""
    if password != confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    logo_path = None
    if logo:
        # Save logo to uploads
        upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        # Create a unique filename
        filename = f"{email.replace('@', '_').replace('.', '_')}_{logo.filename}"
        file_path = os.path.join(upload_dir, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(logo.file, buffer)
        logo_path = f"/uploads/{filename}"

    company, user, error = register_company(
        db, company_name, email, password, phone, logo_path
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
        
    return {
        "message": "Company registered successfully",
        "company": {"id": company.id, "name": company.name},
        "admin_user": {"id": user.id, "email": user.email}
    }


@router.post("/login")
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """Login and get access token."""
    user, token = authenticate_user(db, user_data.email, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
        
    company_data = None
    if user.company_id:
        company = db.query(Company).filter(Company.id == user.company_id).first()
        if company:
            company_data = {
                "id": company.id,
                "name": company.name,
                "logo": company.logo
            }
            
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
            "company_id": user.company_id,
        },
        "company": company_data
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get current logged-in user."""
    return current_user


@router.put("/profile", response_model=UserResponse)
def update_profile(
    updates: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's profile."""
    if updates.full_name:
        current_user.full_name = updates.full_name
    if updates.email:
        existing = db.query(User).filter(User.email == updates.email, User.id != current_user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already taken")
        current_user.email = updates.email
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/users", response_model=list[UserResponse])
def list_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all users (Admin only)."""
    if current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return db.query(User).all()


@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    role: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user role (Admin only)."""
    if current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    valid_roles = ["admin", "employee", "hr_officer", "payroll_officer"]
    if role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")

    user.role = role
    db.commit()
    return {"message": f"User role updated to {role}"}
