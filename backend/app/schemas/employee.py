from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class EmployeeBase(BaseModel):
    emp_code: str
    first_name: str
    last_name: str
    department: str
    designation: str
    date_of_joining: date
    basic_salary: float = 0.0
    phone: Optional[str] = None
    address: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    user_id: int


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    basic_salary: Optional[float] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class EmployeeResponse(EmployeeBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class EmployeeWithUser(EmployeeResponse):
    user_email: Optional[str] = None
    user_role: Optional[str] = None
    is_active: Optional[bool] = None
