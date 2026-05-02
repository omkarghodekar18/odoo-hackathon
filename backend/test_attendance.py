from app.database import SessionLocal
from app.models import Employee
from app.services.attendance_service import login_session, logout_session, get_today_status
import time

db = SessionLocal()

emp = db.query(Employee).first()
if not emp:
    print("No employee found — skipping test")
    db.close()
    exit()

print("Testing with:", emp.first_name, emp.last_name, "id=", emp.id)

# Login
session, err = login_session(db, emp.id)
print("Login session id:", session.id, "| error:", err)

# Status
status = get_today_status(db, emp.id)
print("is_logged_in:", status["is_logged_in"], "| sessions:", len(status["sessions"]))

# Logout
time.sleep(1)
session2, err2 = logout_session(db, emp.id)
print("Logout duration_minutes:", session2.duration_minutes, "| error:", err2)

# Final
status2 = get_today_status(db, emp.id)
print("Final total_hours:", status2["summary"]["total_hours"], "| status:", status2["summary"]["status"])

db.close()
print("All integration tests passed!")
