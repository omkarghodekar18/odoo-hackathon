from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import User, Employee, Attendance, AttendanceSession
engine = create_engine('sqlite:///empay.db')
Session = sessionmaker(bind=engine)
session = Session()

emps = session.query(Employee).all()
for emp in emps:
    sessions = session.query(AttendanceSession).filter_by(employee_id=emp.id).all()
    print(f"Emp: {emp.first_name}")
    for s in sessions:
        print(f"  Session ID {s.id} | Date {s.date} | Login {s.login_time} | Logout {s.logout_time}")
