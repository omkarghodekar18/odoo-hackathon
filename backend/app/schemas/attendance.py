from pydantic import BaseModel
from typing import Optional
from datetime import date, time, datetime


class AttendanceCreate(BaseModel):
    pass  # Auto-filled from current user and time


class AttendanceResponse(BaseModel):
    id: int
    employee_id: int
    date: date
    check_in: Optional[time] = None
    check_out: Optional[time] = None
    status: str
    employee_name: Optional[str] = None

    class Config:
        from_attributes = True


class AttendanceMonthly(BaseModel):
    month: int
    year: int
    total_days: int
    present: int
    absent: int
    half_days: int
    on_leave: int
