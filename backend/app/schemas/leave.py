from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class LeaveTypeBase(BaseModel):
    name: str
    max_days_per_year: int
    description: Optional[str] = None


class LeaveTypeCreate(LeaveTypeBase):
    pass


class LeaveTypeUpdate(BaseModel):
    name: Optional[str] = None
    max_days_per_year: Optional[int] = None
    description: Optional[str] = None


class LeaveTypeResponse(LeaveTypeBase):
    id: int

    class Config:
        from_attributes = True


class LeaveBalanceResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    leave_type_id: int
    leave_type_name: Optional[str] = None
    allocated: int
    used: int
    remaining: int

    class Config:
        from_attributes = True


class LeaveAllocationCreate(BaseModel):
    employee_id: int
    leave_type_id: int
    allocated: int


class LeaveRequestCreate(BaseModel):
    leave_type_id: int
    start_date: date
    end_date: date
    reason: Optional[str] = None


class LeaveRequestResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    leave_type_id: int
    leave_type_name: Optional[str] = None
    start_date: date
    end_date: date
    reason: Optional[str] = None
    status: str
    approved_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
