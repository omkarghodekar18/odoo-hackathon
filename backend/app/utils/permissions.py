from functools import wraps
from fastapi import HTTPException, status, Depends
from app.models.user import User, UserRole
from app.utils.security import get_current_user


class RoleChecker:
    """Dependency class to check user roles."""

    def __init__(self, allowed_roles: list):
        self.allowed_roles = allowed_roles

    def __call__(self, user: User = Depends(get_current_user)):
        if user.role.value not in [r.value if isinstance(r, UserRole) else r for r in self.allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this resource"
            )
        return user


# Pre-built role checkers
allow_admin = RoleChecker([UserRole.ADMIN])
allow_admin_hr = RoleChecker([UserRole.ADMIN, UserRole.HR_OFFICER])
allow_admin_payroll = RoleChecker([UserRole.ADMIN, UserRole.PAYROLL_OFFICER])
allow_admin_hr_payroll = RoleChecker([UserRole.ADMIN, UserRole.HR_OFFICER, UserRole.PAYROLL_OFFICER])
allow_all = RoleChecker([UserRole.ADMIN, UserRole.HR_OFFICER, UserRole.PAYROLL_OFFICER, UserRole.EMPLOYEE])
