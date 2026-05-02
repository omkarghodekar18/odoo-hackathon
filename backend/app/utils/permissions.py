from functools import wraps
from fastapi import HTTPException, status, Depends
from app.models.user import User, UserRole
from app.utils.security import get_current_user


def require_roles(*roles):
    """Dependency to check if current user has one of the allowed roles."""
    def role_checker(current_user: User = Depends(get_current_user)):
        if not current_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated",
            )
        if current_user.role.value not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this resource"
            )
        return current_user
    return role_checker


def require_admin():
    """Shorthand: only admin."""
    return require_roles("admin")


def require_admin_or_hr():
    """Shorthand: admin or hr_officer."""
    return require_roles("admin", "hr_officer")
