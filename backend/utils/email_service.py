"""
Common Email Service for HRMS
All emails must go through this service only.
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List
import re

# Email Configuration (Common)
EMAIL_FROM = "hrms@brihaspathi.com"
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
EMAIL_PASSWORD = "aakbcohigtogpyrl"  # 12-digit App Password
BTL_LOGO_URL = "https://www.brihaspathi.com/highbtlogo%20white-%20tm.png"


def send_email(
    to_email: str,
    subject: str,
    body: str,
    html_body: Optional[str] = None
) -> bool:
    """
    Send email using SMTP with common configuration.
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        body: Plain text body (will be converted to HTML if html_body not provided)
        html_body: Optional HTML body (if provided, body is ignored)
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = EMAIL_FROM
        msg['To'] = to_email
        msg['Subject'] = subject
        
        # If HTML body provided, use it; otherwise convert plain text to HTML
        if html_body:
            final_html = html_body
        else:
            # Escape HTML special characters
            body_html = body.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            # Convert line breaks to HTML
            body_html = body_html.replace('\n', '<br>')
            
            final_html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.8;
            color: #1f2937;
            background-color: #f3f4f6;
            padding: 20px;
        }}
        .email-wrapper {{
            max-width: 800px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        .email-header {{
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            padding: 30px 40px;
            text-align: center;
        }}
        .logo-container {{
            margin-bottom: 20px;
        }}
        .logo-container img {{
            max-width: 250px;
            height: auto;
        }}
        .email-body {{
            padding: 40px;
        }}
        .email-content {{
            font-size: 15px;
            line-height: 1.9;
            color: #1f2937;
            white-space: pre-wrap;
            word-wrap: break-word;
        }}
        .email-footer {{
            background-color: #f9fafb;
            padding: 25px 40px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 13px;
            color: #6b7280;
        }}
        .footer-text {{
            margin-bottom: 8px;
        }}
        .footer-company {{
            font-weight: 600;
            color: #3b82f6;
        }}
        @media only screen and (max-width: 600px) {{
            .email-body {{
                padding: 25px 20px;
            }}
            .email-header {{
                padding: 20px;
            }}
            .email-footer {{
                padding: 20px;
            }}
        }}
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-header">
            <div class="logo-container">
                <img src="{BTL_LOGO_URL}" alt="Brihaspathi Technologies Limited" />
            </div>
        </div>
        <div class="email-body">
            <div class="email-content">{body_html}</div>
        </div>
        <div class="email-footer">
            <div class="footer-text">This is an automated email from</div>
            <div class="footer-company">Brihaspathi Technologies Limited</div>
            <div class="footer-text" style="margin-top: 8px;">Please do not reply to this email</div>
        </div>
    </div>
</body>
</html>
"""
        
        msg.attach(MIMEText(final_html, 'html'))
        
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(EMAIL_FROM, EMAIL_PASSWORD)
        server.sendmail(EMAIL_FROM, to_email, msg.as_string())
        server.quit()
        
        return True
    except Exception as e:
        print(f"Error sending email to {to_email}: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def send_leave_email_to_manager(
    manager_email: str,
    manager_name: str,
    employee_name: str,
    employee_empid: str,
    from_date: str,
    to_date: str,
    leave_type: str,
    reason: str,
    duration: int
) -> bool:
    """Send leave application email to reporting manager"""
    subject = f"Leave Application - {employee_name} ({employee_empid})"
    
    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #f3f4f6;
            padding: 20px;
        }}
        .email-wrapper {{
            max-width: 700px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        .email-header {{
            background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
            padding: 40px 30px;
            text-align: center;
        }}
        .logo-container img {{
            max-width: 200px;
            height: auto;
        }}
        .email-body {{
            padding: 40px 30px;
        }}
        .greeting {{
            font-size: 18px;
            color: #1f2937;
            margin-bottom: 25px;
            font-weight: 600;
        }}
        .content-section {{
            margin-bottom: 25px;
        }}
        .section-title {{
            font-size: 16px;
            font-weight: 600;
            color: #2563eb;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e5e7eb;
        }}
        .info-row {{
            display: flex;
            padding: 10px 0;
            border-bottom: 1px solid #f3f4f6;
        }}
        .info-label {{
            font-weight: 600;
            color: #4b5563;
            min-width: 140px;
        }}
        .info-value {{
            color: #1f2937;
            flex: 1;
        }}
        .reason-box {{
            background-color: #f9fafb;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #2563eb;
            margin-top: 10px;
        }}
        .cta-button {{
            display: inline-block;
            margin-top: 25px;
            padding: 12px 30px;
            background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
        }}
        .email-footer {{
            background-color: #f9fafb;
            padding: 25px 30px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 13px;
            color: #6b7280;
        }}
        .footer-company {{
            font-weight: 600;
            color: #2563eb;
            margin-top: 5px;
        }}
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-header">
            <div class="logo-container">
                <img src="{BTL_LOGO_URL}" alt="Brihaspathi Technologies Limited" />
            </div>
        </div>
        <div class="email-body">
            <div class="greeting">Dear {manager_name},</div>
            
            <p style="margin-bottom: 25px; color: #4b5563;">
                A leave application has been submitted by one of your team members.
            </p>
            
            <div class="content-section">
                <div class="section-title">Employee Details</div>
                <div class="info-row">
                    <span class="info-label">Name:</span>
                    <span class="info-value">{employee_name}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Employee ID:</span>
                    <span class="info-value">{employee_empid}</span>
                </div>
            </div>
            
            <div class="content-section">
                <div class="section-title">Leave Details</div>
                <div class="info-row">
                    <span class="info-label">Leave Type:</span>
                    <span class="info-value">{leave_type}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">From Date:</span>
                    <span class="info-value">{from_date}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">To Date:</span>
                    <span class="info-value">{to_date}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Duration:</span>
                    <span class="info-value">{duration} day(s)</span>
                </div>
                <div class="reason-box">
                    <strong>Reason:</strong><br>
                    {reason}
                </div>
            </div>
            
            <p style="margin-top: 25px; color: #4b5563;">
                Please review and approve/reject this leave application in the HRMS system.
            </p>
        </div>
        <div class="email-footer">
            <div>This is an automated email from</div>
            <div class="footer-company">Brihaspathi Technologies Limited</div>
            <div style="margin-top: 8px;">Please do not reply to this email</div>
        </div>
    </div>
</body>
</html>
"""
    
    return send_email(manager_email, subject, "", html_body)


def send_request_email_to_manager(
    manager_email: str,
    manager_name: str,
    employee_name: str,
    employee_empid: str,
    request_type: str,
    subject_text: str,
    description: str,
    intime: Optional[str] = None,
    outtime: Optional[str] = None
) -> bool:
    """Send request application email to reporting manager"""
    subject = f"Request Application - {employee_name} ({employee_empid})"
    
    time_info_html = ""
    if intime or outtime:
        time_info_html = '<div class="content-section"><div class="section-title">Time Details</div>'
        if intime:
            time_info_html += f'<div class="info-row"><span class="info-label">In Time:</span><span class="info-value">{intime}</span></div>'
        if outtime:
            time_info_html += f'<div class="info-row"><span class="info-label">Out Time:</span><span class="info-value">{outtime}</span></div>'
        time_info_html += '</div>'
    
    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #f3f4f6;
            padding: 20px;
        }}
        .email-wrapper {{
            max-width: 700px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        .email-header {{
            background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
            padding: 40px 30px;
            text-align: center;
        }}
        .logo-container img {{
            max-width: 200px;
            height: auto;
        }}
        .email-body {{
            padding: 40px 30px;
        }}
        .greeting {{
            font-size: 18px;
            color: #1f2937;
            margin-bottom: 25px;
            font-weight: 600;
        }}
        .content-section {{
            margin-bottom: 25px;
        }}
        .section-title {{
            font-size: 16px;
            font-weight: 600;
            color: #2563eb;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e5e7eb;
        }}
        .info-row {{
            display: flex;
            padding: 10px 0;
            border-bottom: 1px solid #f3f4f6;
        }}
        .info-label {{
            font-weight: 600;
            color: #4b5563;
            min-width: 140px;
        }}
        .info-value {{
            color: #1f2937;
            flex: 1;
        }}
        .description-box {{
            background-color: #f9fafb;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #2563eb;
            margin-top: 10px;
        }}
        .email-footer {{
            background-color: #f9fafb;
            padding: 25px 30px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 13px;
            color: #6b7280;
        }}
        .footer-company {{
            font-weight: 600;
            color: #2563eb;
            margin-top: 5px;
        }}
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-header">
            <div class="logo-container">
                <img src="{BTL_LOGO_URL}" alt="Brihaspathi Technologies Limited" />
            </div>
        </div>
        <div class="email-body">
            <div class="greeting">Dear {manager_name},</div>
            
            <p style="margin-bottom: 25px; color: #4b5563;">
                A request has been submitted by one of your team members.
            </p>
            
            <div class="content-section">
                <div class="section-title">Employee Details</div>
                <div class="info-row">
                    <span class="info-label">Name:</span>
                    <span class="info-value">{employee_name}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Employee ID:</span>
                    <span class="info-value">{employee_empid}</span>
                </div>
            </div>
            
            <div class="content-section">
                <div class="section-title">Request Details</div>
                <div class="info-row">
                    <span class="info-label">Request Type:</span>
                    <span class="info-value">{request_type}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Subject:</span>
                    <span class="info-value">{subject_text}</span>
                </div>
                {time_info_html}
                <div class="description-box">
                    <strong>Description:</strong><br>
                    {description}
                </div>
            </div>
            
            <p style="margin-top: 25px; color: #4b5563;">
                Please review and approve/reject this request in the HRMS system.
            </p>
        </div>
        <div class="email-footer">
            <div>This is an automated email from</div>
            <div class="footer-company">Brihaspathi Technologies Limited</div>
            <div style="margin-top: 8px;">Please do not reply to this email</div>
        </div>
    </div>
</body>
</html>
"""
    
    return send_email(manager_email, subject, "", html_body)


def send_permission_email_to_manager(
    manager_email: str,
    manager_name: str,
    employee_name: str,
    employee_empid: str,
    permission_type: str,
    from_datetime: str,
    to_datetime: str,
    reason: Optional[str] = None
) -> bool:
    """Send permission application email to reporting manager"""
    subject = f"Permission Application - {employee_name} ({employee_empid})"
    
    reason_html = ""
    if reason:
        reason_html = f'''
                <div class="reason-box">
                    <strong>Reason:</strong><br>
                    {reason}
                </div>'''
    
    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #f3f4f6;
            padding: 20px;
        }}
        .email-wrapper {{
            max-width: 700px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        .email-header {{
            background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
            padding: 40px 30px;
            text-align: center;
        }}
        .logo-container img {{
            max-width: 200px;
            height: auto;
        }}
        .email-body {{
            padding: 40px 30px;
        }}
        .greeting {{
            font-size: 18px;
            color: #1f2937;
            margin-bottom: 25px;
            font-weight: 600;
        }}
        .content-section {{
            margin-bottom: 25px;
        }}
        .section-title {{
            font-size: 16px;
            font-weight: 600;
            color: #2563eb;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e5e7eb;
        }}
        .info-row {{
            display: flex;
            padding: 10px 0;
            border-bottom: 1px solid #f3f4f6;
        }}
        .info-label {{
            font-weight: 600;
            color: #4b5563;
            min-width: 140px;
        }}
        .info-value {{
            color: #1f2937;
            flex: 1;
        }}
        .reason-box {{
            background-color: #f9fafb;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #2563eb;
            margin-top: 10px;
        }}
        .email-footer {{
            background-color: #f9fafb;
            padding: 25px 30px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 13px;
            color: #6b7280;
        }}
        .footer-company {{
            font-weight: 600;
            color: #2563eb;
            margin-top: 5px;
        }}
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-header">
            <div class="logo-container">
                <img src="{BTL_LOGO_URL}" alt="Brihaspathi Technologies Limited" />
            </div>
        </div>
        <div class="email-body">
            <div class="greeting">Dear {manager_name},</div>
            
            <p style="margin-bottom: 25px; color: #4b5563;">
                A permission request has been submitted by one of your team members.
            </p>
            
            <div class="content-section">
                <div class="section-title">Employee Details</div>
                <div class="info-row">
                    <span class="info-label">Name:</span>
                    <span class="info-value">{employee_name}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Employee ID:</span>
                    <span class="info-value">{employee_empid}</span>
                </div>
            </div>
            
            <div class="content-section">
                <div class="section-title">Permission Details</div>
                <div class="info-row">
                    <span class="info-label">Permission Type:</span>
                    <span class="info-value">{permission_type}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">From Date & Time:</span>
                    <span class="info-value">{from_datetime}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">To Date & Time:</span>
                    <span class="info-value">{to_datetime}</span>
                </div>
                {reason_html}
            </div>
            
            <p style="margin-top: 25px; color: #4b5563;">
                Please review and approve/reject this permission request in the HRMS system.
            </p>
        </div>
        <div class="email-footer">
            <div>This is an automated email from</div>
            <div class="footer-company">Brihaspathi Technologies Limited</div>
            <div style="margin-top: 8px;">Please do not reply to this email</div>
        </div>
    </div>
</body>
</html>
"""
    
    return send_email(manager_email, subject, "", html_body)


def send_birthday_email(
    employee_email: str,
    employee_name: str
) -> bool:
    """Send birthday email to employee"""
    subject = f"Happy Birthday {employee_name}! 🎉"
    
    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #f3f4f6;
            padding: 20px;
        }}
        .email-wrapper {{
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        .email-header {{
            background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
            padding: 50px 30px;
            text-align: center;
        }}
        .logo-container img {{
            max-width: 200px;
            height: auto;
        }}
        .email-body {{
            padding: 50px 40px;
            text-align: center;
        }}
        .emoji {{
            font-size: 60px;
            margin-bottom: 20px;
        }}
        .greeting {{
            font-size: 24px;
            color: #1f2937;
            margin-bottom: 20px;
            font-weight: 600;
        }}
        .message {{
            font-size: 16px;
            color: #4b5563;
            line-height: 1.8;
            margin-bottom: 30px;
        }}
        .email-footer {{
            background-color: #f9fafb;
            padding: 25px 30px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 13px;
            color: #6b7280;
        }}
        .footer-company {{
            font-weight: 600;
            color: #2563eb;
            margin-top: 5px;
        }}
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-header">
            <div class="logo-container">
                <img src="{BTL_LOGO_URL}" alt="Brihaspathi Technologies Limited" />
            </div>
        </div>
        <div class="email-body">
            <div class="emoji">🎉🎂🎈</div>
            <div class="greeting">Happy Birthday {employee_name}!</div>
            <div class="message">
                Wishing you a very Happy Birthday!<br><br>
                May this special day bring you joy, happiness, and success in all your endeavors. 
                We are grateful to have you as part of the Brihaspathi Technologies Limited family.<br><br>
                Enjoy your special day!
            </div>
        </div>
        <div class="email-footer">
            <div>This is an automated email from</div>
            <div class="footer-company">Brihaspathi Technologies Limited</div>
            <div style="margin-top: 8px;">Please do not reply to this email</div>
        </div>
    </div>
</body>
</html>
"""
    
    return send_email(employee_email, subject, "", html_body)


def send_anniversary_email(
    employee_email: str,
    employee_name: str,
    years: int
) -> bool:
    """Send work anniversary email to employee"""
    subject = f"Work Anniversary - {years} Year(s) at Brihaspathi Technologies! 🎊"
    
    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #f3f4f6;
            padding: 20px;
        }}
        .email-wrapper {{
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        .email-header {{
            background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
            padding: 50px 30px;
            text-align: center;
        }}
        .logo-container img {{
            max-width: 200px;
            height: auto;
        }}
        .email-body {{
            padding: 50px 40px;
            text-align: center;
        }}
        .emoji {{
            font-size: 60px;
            margin-bottom: 20px;
        }}
        .greeting {{
            font-size: 24px;
            color: #1f2937;
            margin-bottom: 15px;
            font-weight: 600;
        }}
        .years-badge {{
            display: inline-block;
            background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
            color: #ffffff;
            padding: 10px 25px;
            border-radius: 25px;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 25px;
        }}
        .message {{
            font-size: 16px;
            color: #4b5563;
            line-height: 1.8;
            margin-bottom: 30px;
        }}
        .email-footer {{
            background-color: #f9fafb;
            padding: 25px 30px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 13px;
            color: #6b7280;
        }}
        .footer-company {{
            font-weight: 600;
            color: #2563eb;
            margin-top: 5px;
        }}
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-header">
            <div class="logo-container">
                <img src="{BTL_LOGO_URL}" alt="Brihaspathi Technologies Limited" />
            </div>
        </div>
        <div class="email-body">
            <div class="emoji">🎊🎉</div>
            <div class="greeting">Congratulations {employee_name}!</div>
            <div class="years-badge">{years} Year{'s' if years > 1 else ''} of Excellence</div>
            <div class="message">
                Congratulations on completing {years} year{'s' if years > 1 else ''} with Brihaspathi Technologies Limited!<br><br>
                Your dedication, hard work, and commitment have been invaluable to our organization. 
                We appreciate your contributions and look forward to many more successful years together.<br><br>
                Thank you for being an integral part of our team!
            </div>
        </div>
        <div class="email-footer">
            <div>This is an automated email from</div>
            <div class="footer-company">Brihaspathi Technologies Limited</div>
            <div style="margin-top: 8px;">Please do not reply to this email</div>
        </div>
    </div>
</body>
</html>
"""
    
    return send_email(employee_email, subject, "", html_body)


def send_weekly_attendance_email(
    employee_email: str,
    employee_name: str,
    attendance_data: List[dict]
) -> bool:
    """Send weekly attendance reminder email to employee"""
    subject = f"Weekly Attendance Reminder - {employee_name}"
    
    # Generate table rows
    table_rows = ""
    for record in attendance_data:
        date = record.get('date', 'N/A')
        status = record.get('status', 'N/A')
        in_time = record.get('in_time', 'N/A')
        out_time = record.get('out_time', 'N/A')
        hours = record.get('hours', 0)
        
        # Format date for display (DD-MM-YYYY)
        try:
            from datetime import datetime
            date_obj = datetime.fromisoformat(date).date()
            date_display = date_obj.strftime('%d-%m-%Y')
            day_name = date_obj.strftime('%A')
        except:
            date_display = date
            day_name = ""
        
        # Status badge color
        status_color = "#6b7280"  # Default gray
        if status.upper() in ['P', 'PRESENT']:
            status_color = "#10b981"  # Green
        elif status.upper() in ['H/D', 'HALF DAY', 'HD']:
            status_color = "#f59e0b"  # Orange
        elif status.upper() in ['ABS', 'ABSENT', 'A']:
            status_color = "#ef4444"  # Red
        elif status.upper() in ['WO', 'WEEK OFF']:
            status_color = "#8b5cf6"  # Purple
        elif status.upper() in ['HOLIDAY', 'H']:
            status_color = "#3b82f6"  # Blue
        elif status.upper() in ['SICK', 'CASUAL', 'ANNUAL', 'EMERGENCY', 'OTHER', 'SL', 'CL', 'AL']:
            status_color = "#6366f1"  # Indigo
        
        hours_display = f"{hours:.2f}h" if hours > 0 else "-"
        
        table_rows += f"""
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                        <div style="font-weight: 600; color: #1f2937;">{date_display}</div>
                        <div style="font-size: 12px; color: #6b7280;">{day_name}</div>
                    </td>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
                        <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-weight: 600; font-size: 12px; background-color: {status_color}20; color: {status_color};">
                            {status}
                        </span>
                    </td>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-family: 'Courier New', monospace;">
                        {in_time}
                    </td>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-family: 'Courier New', monospace;">
                        {out_time}
                    </td>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #4b5563;">
                        {hours_display}
                    </td>
                </tr>"""
    
    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #f3f4f6;
            padding: 20px;
        }}
        .email-wrapper {{
            max-width: 800px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        .email-header {{
            background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
            padding: 40px 30px;
            text-align: center;
        }}
        .logo-container img {{
            max-width: 200px;
            height: auto;
        }}
        .email-body {{
            padding: 40px 30px;
        }}
        .greeting {{
            font-size: 18px;
            color: #1f2937;
            margin-bottom: 20px;
            font-weight: 600;
        }}
        .intro-text {{
            color: #4b5563;
            margin-bottom: 30px;
        }}
        .attendance-table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }}
        .attendance-table thead {{
            background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
            color: #ffffff;
        }}
        .attendance-table th {{
            padding: 14px 12px;
            text-align: left;
            font-weight: 600;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .attendance-table th:not(:first-child) {{
            text-align: center;
        }}
        .attendance-table tbody tr:hover {{
            background-color: #f9fafb;
        }}
        .email-footer {{
            background-color: #f9fafb;
            padding: 25px 30px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 13px;
            color: #6b7280;
        }}
        .footer-company {{
            font-weight: 600;
            color: #2563eb;
            margin-top: 5px;
        }}
        .note-box {{
            background-color: #eff6ff;
            border-left: 4px solid #2563eb;
            padding: 15px;
            border-radius: 6px;
            margin-top: 25px;
        }}
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-header">
            <div class="logo-container">
                <img src="{BTL_LOGO_URL}" alt="Brihaspathi Technologies Limited" />
            </div>
        </div>
        <div class="email-body">
            <div class="greeting">Dear {employee_name},</div>
            
            <p class="intro-text">
                This is your weekly attendance reminder for the past 7 days. Please review your attendance summary below.
            </p>
            
            <table class="attendance-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Status</th>
                        <th>In Time</th>
                        <th>Out Time</th>
                        <th>Hours</th>
                    </tr>
                </thead>
                <tbody>
                    {table_rows}
                </tbody>
            </table>
            
            <div class="note-box">
                <strong style="color: #2563eb;">Note:</strong> If you notice any discrepancies in your attendance, please contact HR immediately.
            </div>
        </div>
        <div class="email-footer">
            <div>This is an automated email from</div>
            <div class="footer-company">Brihaspathi Technologies Limited</div>
            <div style="margin-top: 8px;">Please do not reply to this email</div>
        </div>
    </div>
</body>
</html>
"""
    
    return send_email(employee_email, subject, "", html_body)


def send_forgot_password_email(
    to_email: str,
    user_name: str,
    greeting: str = "Mr/Mrs",
    new_password: str = ""
) -> bool:
    """Send forgot password email with new password"""
    subject = "Password Reset - Your New Password"
    
    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #f3f4f6;
            padding: 20px;
        }}
        .email-wrapper {{
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        .email-header {{
            background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
            padding: 40px 30px;
            text-align: center;
        }}
        .logo-container img {{
            max-width: 200px;
            height: auto;
        }}
        .email-body {{
            padding: 40px 30px;
        }}
        .greeting {{
            font-size: 18px;
            color: #1f2937;
            margin-bottom: 25px;
            font-weight: 600;
        }}
        .message {{
            font-size: 15px;
            color: #4b5563;
            line-height: 1.8;
            margin-bottom: 25px;
        }}
        .password-box {{
            background-color: #f9fafb;
            border: 2px solid #2563eb;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
            text-align: center;
        }}
        .password-label {{
            font-size: 13px;
            color: #6b7280;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
        }}
        .password-value {{
            font-size: 24px;
            font-weight: 700;
            color: #2563eb;
            font-family: 'Courier New', monospace;
            letter-spacing: 2px;
            word-break: break-all;
        }}
        .warning-box {{
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            border-radius: 6px;
            margin-top: 25px;
        }}
        .warning-text {{
            font-size: 14px;
            color: #92400e;
            line-height: 1.6;
        }}
        .email-footer {{
            background-color: #f9fafb;
            padding: 25px 30px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 13px;
            color: #6b7280;
        }}
        .footer-company {{
            font-weight: 600;
            color: #2563eb;
            margin-top: 5px;
        }}
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-header">
            <div class="logo-container">
                <img src="{BTL_LOGO_URL}" alt="Brihaspathi Technologies Limited" />
            </div>
        </div>
        <div class="email-body">
            <div class="greeting">Hello {greeting} {user_name},</div>
            
            <div class="message">
                Your password has been reset successfully. Please use the new password provided below to login to your account.
            </div>
            
            <div class="password-box">
                <div class="password-label">Your New Password</div>
                <div class="password-value">{new_password}</div>
            </div>
            
            <div class="warning-box">
                <div class="warning-text">
                    <strong>⚠️ Security Notice:</strong><br>
                    For your security, please change this password immediately after logging in. 
                    Do not share this password with anyone.
                </div>
            </div>
            
            <div class="message" style="margin-top: 25px;">
                If you did not request this password reset, please contact your system administrator immediately.
            </div>
        </div>
        <div class="email-footer">
            <div>This is an automated email from</div>
            <div class="footer-company">Brihaspathi Technologies Limited</div>
            <div style="margin-top: 8px;">Please do not reply to this email</div>
            </div>
    </div>
</body>
</html>
"""
    
    return send_email(to_email, subject, "", html_body)

