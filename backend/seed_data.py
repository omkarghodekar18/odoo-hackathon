"""Seed script to populate initial data for EmPay HRMS."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import date, time, datetime, timedelta
import random
from app.database import SessionLocal, engine, Base
from app.models.company import Company
from app.models.user import User, UserRole
from app.models.employee import Employee
from app.models.attendance import Attendance, AttendanceStatus
from app.models.leave import LeaveType, LeaveBalance, LeaveRequest, LeaveStatus
from app.utils.security import get_password_hash

# Create tables
Base.metadata.create_all(bind=engine)

db = SessionLocal()

def seed():
    # Check if already seeded
    if db.query(User).count() > 0:
        print("Database already seeded. Skipping.")
        return

    print("Seeding database...")

    # 1. Create Demo Company
    company = Company(
        name="Acme Corp",
        email="admin@acmecorp.com",
        phone="+91 9876543210",
        logo=None,
    )
    db.add(company)
    db.flush()

    print(f"  Created company: {company.name} (ID: {company.id})")

    # 2. Create Users (all linked to the demo company)
    users_data = [
        {"email": "admin@acmecorp.com", "full_name": "Acme Corp Admin", "role": UserRole.ADMIN, "password": "admin123"},
        {"email": "hr@acmecorp.com", "full_name": "Sarah Johnson", "role": UserRole.HR_OFFICER, "password": "hr123"},
        {"email": "payroll@acmecorp.com", "full_name": "Mike Wilson", "role": UserRole.PAYROLL_OFFICER, "password": "payroll123"},
        {"email": "john.doe@acmecorp.com", "full_name": "John Doe", "role": UserRole.EMPLOYEE, "password": "emp123"},
    ]

    users = []
    for u in users_data:
        user = User(
            email=u["email"],
            full_name=u["full_name"],
            role=u["role"],
            hashed_password=get_password_hash(u["password"]),
            company_id=company.id,
        )
        db.add(user)
        db.flush()
        users.append(user)

    # 3. Create Employees (linked to company)
    employees_data = [
        {"user": users[1], "emp_code": "EMP001", "first_name": "Sarah", "last_name": "Johnson", "dept": "HR", "desg": "HR Executive", "salary": 55000},
        {"user": users[2], "emp_code": "EMP002", "first_name": "Mike", "last_name": "Wilson", "dept": "Finance", "desg": "Financial Analyst", "salary": 60000},
        {"user": users[3], "emp_code": "EMP003", "first_name": "John", "last_name": "Doe", "dept": "Engineering", "desg": "Software Engineer", "salary": 65000},
    ]

    employees = []
    for e in employees_data:
        emp = Employee(
            user_id=e["user"].id,
            company_id=company.id,
            emp_code=e["emp_code"],
            first_name=e["first_name"],
            last_name=e["last_name"],
            department=e["dept"],
            designation=e["desg"],
            date_of_joining=date(2024, 1, 15),
            basic_salary=e["salary"],
            phone=f"+91 98765{random.randint(10000, 99999)}",
        )
        db.add(emp)
        db.flush()
        employees.append(emp)

    # 4. Create Leave Types
    leave_types_data = [
        {"name": "Casual Leave", "max_days": 12, "desc": "For personal matters"},
        {"name": "Sick Leave", "max_days": 10, "desc": "For medical reasons"},
        {"name": "Earned Leave", "max_days": 15, "desc": "Accumulated paid leave"},
    ]

    leave_types = []
    for lt in leave_types_data:
        leave_type = LeaveType(name=lt["name"], max_days_per_year=lt["max_days"], description=lt["desc"])
        db.add(leave_type)
        db.flush()
        leave_types.append(leave_type)

    # 5. Create Leave Balances
    for emp in employees:
        for lt in leave_types:
            balance = LeaveBalance(employee_id=emp.id, leave_type_id=lt.id, allocated=lt.max_days_per_year, used=0, remaining=lt.max_days_per_year)
            db.add(balance)

    db.commit()
    print("Database seeded successfully!")
    print("\nLogin credentials:")
    print("  Admin:    admin@acmecorp.com / admin123")
    print("  HR:       hr@acmecorp.com / hr123")
    print("  Payroll:  payroll@acmecorp.com / payroll123")
    print("  Employee: john.doe@acmecorp.com / emp123")

if __name__ == "__main__":
    seed()
    db.close()
