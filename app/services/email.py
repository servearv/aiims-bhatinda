import smtplib
import os
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger('aiims.email')
executor = ThreadPoolExecutor(max_workers=2)

def _send_email_sync(to_email: str, subject: str, body_html: str):
    """"Synchronous email send using SMTP_PASSWORD env var."""
    smtp_pass = os.environ.get('SMTP_PASSWORD', '')
    sender = os.environ.get('SMTP_EMAIL', '')
    if not smtp_pass or not sender:
        logger.warning(f"Email skipped (no SMTP credentials). To: {to_email}, Subject: {subject}")
        return False
        
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = sender
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body_html, 'html'))
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(sender, smtp_pass)
            server.send_message(msg)
        logger.info(f"Email sent to {to_email}: {subject}")
        return True
    except Exception:
        logger.exception(f"Email sending failed to {to_email}")
        return False

def send_email_async(to_email: str, subject: str, body_html: str):
    """Sends email in background thread."""
    executor.submit(_send_email_sync, to_email, subject, body_html)
