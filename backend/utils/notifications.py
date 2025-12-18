"""Notification utilities for WhatsApp and Email"""
import requests
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# WhatsApp API Configuration
WHATSAPP_API_URL = "https://backend.api-wa.co/campaign/smartping/api/v2"
WHATSAPP_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY0OWMxMDI0YTMzMGUyMGJkYTcwMzMwMyIsIm5hbWUiOiJCUklIQVNQQVRISSBURUNITk9MT0dJRVMgUFJJVkFURSBMSU1JVEVEIiwiYXBwTmFtZSI6IkFpU2Vuc3kiLCJjbGllbnRJZCI6IjY0OWMxMDIzY2FkODQ1MGI0Nzg1YzA1YyIsImFjdGl2ZVBsYW4iOiJOT05FIiwiaWF0IjoxNjg3OTQ5MzQ4fQ.oDl73wKoFu9jj-nKdzsOqaY8InWdw3RIaYy4EUZaEto"
WHATSAPP_CAMPAIGN = "vms_emp_notification"

# Email Configuration
EMAIL_FROM = "hrms@brihaspathi.com"
EMAIL_PASSWORD = "aakbcohigtogpyrl"
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587

def send_whatsapp_notification(employee_name: str, visitor_name: str, purpose: str, phone: str):
    """Send WhatsApp notification to employee about visitor"""
    try:
        # Format phone number (remove + and spaces)
        phone_clean = phone.replace("+", "").replace(" ", "").replace("-", "")
        
        payload = {
            "campaign": WHATSAPP_CAMPAIGN,
            "phone": phone_clean,
            "params": [
                employee_name,  # Param 1: Selected name (employee)
                visitor_name,   # Param 2: Visitor name
                purpose         # Param 3: Purpose
            ]
        }
        
        headers = {
            "Authorization": f"Bearer {WHATSAPP_API_KEY}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(WHATSAPP_API_URL, json=payload, headers=headers, timeout=10)
        
        if response.status_code == 200:
            print(f"WhatsApp notification sent successfully to {phone}")
            return True
        else:
            print(f"WhatsApp notification failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"Error sending WhatsApp notification: {str(e)}")
        return False

def send_email_notification(
    employee_name: str,
    employee_email: str,
    visitor_name: str,
    purpose: str,
    visitor_phone: str,
    visitor_email: str
):
    """Send email notification to employee about visitor"""
    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = EMAIL_FROM
        msg['To'] = employee_email
        msg['Subject'] = f"Visitor Alert: {visitor_name} is here to meet you"
        
        # Email body
        body = f"""
        Dear {employee_name},
        
        You have a visitor at the reception:
        
        Visitor Details:
        - Name: {visitor_name}
        - Purpose: {purpose}
        - Phone: {visitor_phone}
        - Email: {visitor_email}
        
        Please proceed to the reception to meet your visitor.
        
        Best regards,
        HRMS System
        """
        
        msg.attach(MIMEText(body, 'plain'))
        
        # Send email
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(EMAIL_FROM, EMAIL_PASSWORD)
        text = msg.as_string()
        server.sendmail(EMAIL_FROM, employee_email, text)
        server.quit()
        
        print(f"Email notification sent successfully to {employee_email}")
        return True
    except Exception as e:
        print(f"Error sending email notification: {str(e)}")
        return False
