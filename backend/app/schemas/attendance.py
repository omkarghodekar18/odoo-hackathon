from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


# ---------------------------------------------------------------------------
# Session schemas
# ---------------------------------------------------------------------------

class AttendanceSessionResponse(BaseModel):
    id: int
    login_time: Optional[datetime] = None
    logout_time: Optional[datetime] = None
    duration_minutes: Optional[float] = None
    is_auto_closed: bool = False
    date: date

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Daily summary schemas
# ---------------------------------------------------------------------------

class AttendanceSummaryResponse(BaseModel):
    id: int
    date: date
    total_hours: float = 0.0
    status: str

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Today-status response
# ---------------------------------------------------------------------------

class TodayStatusResponse(BaseModel):
    is_logged_in: bool
    active_session_id: Optional[int] = None
    active_login_time: Optional[str] = None
    sessions: List[AttendanceSessionResponse] = []
    summary: Optional[AttendanceSummaryResponse] = None


# ---------------------------------------------------------------------------
# Admin / HR: full record with employee info
# ---------------------------------------------------------------------------

class AttendanceAdminResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    emp_code: str
    date: date
    total_hours: float = 0.0
    status: str
    sessions: List[AttendanceSessionResponse] = []

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Monthly summary schema
# ---------------------------------------------------------------------------

class AttendanceMonthly(BaseModel):
    month: int
    year: int
    total_days: int
    present: int
    absent: int
    half_days: int
    on_leave: int
    total_hours: float = 0.0
