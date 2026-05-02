import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

# Load .env variables manually in case the server has been running since before the file was created
def _load_env():
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if '=' in line and not line.strip().startswith('#'):
                    k, v = line.strip().split('=', 1)
                    if k not in os.environ:
                        os.environ[k] = v

_load_env()

def send_credentials_email(to_email: str, name: str, emp_code: str, password: str):
    """
    Sends an actual email to the employee with their credentials.
    Requires SMTP_EMAIL and SMTP_PASSWORD environment variables to be set.
    """
    sender_email = os.getenv("SMTP_EMAIL")
    sender_password = os.getenv("SMTP_PASSWORD")
    
    if not sender_email or not sender_password:
        raise Exception("SMTP_EMAIL and SMTP_PASSWORD environment variables must be set to send actual emails.")

    # We use Gmail SMTP by default as it's the most common for personal/test setups
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))

    message = MIMEMultipart("alternative")
    message["Subject"] = "Welcome to EmPay HRMS - Your Login Credentials"
    message["From"] = f"EmPay HRMS <{sender_email}>"
    message["To"] = to_email

    text = f"""\
Hello {name},

Welcome to EmPay HRMS! Your account has been successfully created.

Here are your login credentials:
Employee ID: {emp_code}
Email: {to_email}
Password: {password}

Please log in and change your password as soon as possible.

Best regards,
EmPay HRMS Team
"""

    html = f"""\
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #0d9488;">Welcome to EmPay HRMS!</h2>
        <p>Hello <strong>{name}</strong>,</p>
        <p>Your account has been successfully created. Here are your login credentials:</p>
        <div style="background: #f1f5f9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #0d9488;">
            <p style="margin: 5px 0;"><strong>Employee ID:</strong> {emp_code}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> {to_email}</p>
            <p style="margin: 5px 0;"><strong>Password:</strong> <span style="background: #e2e8f0; padding: 2px 6px; border-radius: 3px;">{password}</span></p>
        </div>
        <p>Please log in and change your password as soon as possible.</p>
        <br>
        <p>Best regards,<br><strong>EmPay HRMS Team</strong></p>
      </body>
    </html>
    """

    part1 = MIMEText(text, "plain")
    part2 = MIMEText(html, "html")

    message.attach(part1)
    message.attach(part2)

    try:
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.ehlo()
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, to_email, message.as_string())
        server.close()
    except Exception as e:
        print(f"Failed to send email: {e}")
        raise Exception(f"Failed to send email: {str(e)}")
