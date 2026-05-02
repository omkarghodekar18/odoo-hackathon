from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.user import UserCreate, UserLogin, UserResponse, UserUpdate, Token
from app.models.user import User
from app.services.auth_service import register_user, authenticate_user
from app.utils.security import get_current_user, get_password_hash

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    user, error = register_user(
        db, user_data.email, user_data.password, user_data.full_name, user_data.role
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    return user


@router.post("/login")
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """Login and get access token."""
    user, token = authenticate_user(db, user_data.email, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
        }
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
