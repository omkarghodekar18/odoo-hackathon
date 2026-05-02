from sqlalchemy import Column, Integer, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class SalaryStructure(Base):
    __tablename__ = "salary_structures"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), unique=True, nullable=False)

    # Component percentages (of monthly CTC)
    basic_pct = Column(Float, default=50.0)
    hra_pct = Column(Float, default=20.0)
    standard_allowance_pct = Column(Float, default=5.67)
    performance_bonus_pct = Column(Float, default=8.33)
    lta_pct = Column(Float, default=8.33)
    fixed_allowance_pct = Column(Float, default=7.67)

    # PF percentages (of basic)
    employee_pf_pct = Column(Float, default=12.0)
    employer_pf_pct = Column(Float, default=12.0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    employee = relationship("Employee", backref="salary_structure")
