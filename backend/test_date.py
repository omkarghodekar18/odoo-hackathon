from datetime import date, timedelta

def working_days(start, end):
    days = 0
    current = start
    while current <= end:
        if current.weekday() < 5:
            days += 1
        current += timedelta(days=1)
    return days

print("62 calendar days:", working_days(date(2026, 5, 5), date(2026, 7, 5)))
print("3 calendar days:", working_days(date(2026, 5, 5), date(2026, 5, 7)))
