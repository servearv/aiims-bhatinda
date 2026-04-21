import logging
from flask import Blueprint, request, jsonify, session
import psycopg2
import psycopg2.extras

from app.db import get_db_conn
from app.helpers import rows_to_list

logger = logging.getLogger('aiims.admin')
bp = Blueprint('admin', __name__)

@bp.route("/api/admin/audit-logs")
def api_admin_audit_logs():
    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT * FROM Audit_Logs ORDER BY timestamp DESC LIMIT 50"
        )
        logs = cur.fetchall()
    return jsonify(rows_to_list(logs))

@bp.route("/api/admin/logs", methods=["GET"])
def api_admin_logs():
    """Return audit log entries — Admin only."""
    sess_user = session.get("user")
    if not sess_user or sess_user.get("role") != "Admin":
        return jsonify({"error": "Unauthorized"}), 403

    limit = min(int(request.args.get("limit", 200)), 500)
    action_filter = request.args.get("action", "").strip()
    user_filter = request.args.get("user_id", "").strip()

    conditions = []
    params = []

    if action_filter:
        conditions.append("action = %s")
        params.append(action_filter)
    if user_filter:
        conditions.append("user_id ILIKE %s")
        params.append(f"%{user_filter}%")

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    params.append(limit)

    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            f"SELECT log_id, timestamp, user_id, action, details "
            f"FROM Audit_Logs {where_clause} ORDER BY timestamp DESC LIMIT %s",
            params,
        )
        rows = cur.fetchall()
        
    return jsonify(rows_to_list(rows))
