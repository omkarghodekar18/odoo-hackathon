from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CompanyRegister(BaseModel):
    company_name: str
    email: str
    phone: Optional[str] = None
    password: str
    confirm_password: str


class CompanyResponse(BaseModel):
    id: int
    name: str
    logo: Optional[str] = None
    email: str
    phone: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
