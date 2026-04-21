from datetime import datetime
from app.db import get_db_cursor
import logging

logger = logging.getLogger('aiims.audit')

def log_audit(user_id: str, action: str, details: str):
    try:
        with get_db_cursor(commit=True) as cur:
            cur.execute(
                "INSERT INTO Audit_Logs (timestamp, user_id, action, details) VALUES (%s,%s,%s,%s)",
                (datetime.utcnow().isoformat(), user_id, action, details)
            )
    except Exception:
        logger.exception(f"Failed to write audit log: {user_id} - {action} - {details}")
