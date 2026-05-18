import logging
from flask import Blueprint, request, jsonify, session
import psycopg2
import psycopg2.extras

from app.db import get_db_conn
from app.helpers import rows_to_list
from app.services.audit import log_audit

logger = logging.getLogger('aiims.admin')
bp = Blueprint('admin', __name__)

@bp.route("/api/admin/users", methods=["GET"])
def api_admin_list_users():
    sess_user = session.get("user")
    if not sess_user or sess_user.get("role") != "Admin":
        return jsonify({"error": "Unauthorized"}), 403

    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT username, email, name, role, designation, specialization "
            "FROM Users ORDER BY username"
        )
        rows = cur.fetchall()
        
    return jsonify(rows_to_list(rows))

@bp.route("/api/admin/users/<username>", methods=["DELETE"])
def api_admin_delete_user(username):
    sess_user = session.get("user")
    if not sess_user or sess_user.get("role") != "Admin":
        return jsonify({"error": "Unauthorized"}), 403

    if sess_user['username'] == username:
        return jsonify({"success": False, "message": "Cannot delete yourself"}), 400

    try:
        with get_db_conn() as conn:
            cur = conn.cursor()
            
            cur.execute("DELETE FROM Event_Volunteers WHERE username = %s", (username,))
            cur.execute("UPDATE Schools SET poc_username = NULL WHERE poc_username = %s", (username,))
            cur.execute("UPDATE Events SET created_by = NULL WHERE created_by = %s", (username,))
            cur.execute("UPDATE Health_Records SET doctor_id = NULL WHERE doctor_id = %s", (username,))
            cur.execute("UPDATE Audit_Logs SET user_id = NULL WHERE user_id = %s", (username,))
            
            cur.execute("DELETE FROM Users WHERE username = %s", (username,))
            conn.commit()
            
            log_audit(sess_user['username'], "DELETE_USER", f"Deleted user {username}")
            
        return jsonify({"success": True})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": "Failed to delete user due to associated records or DB error"}), 500

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
