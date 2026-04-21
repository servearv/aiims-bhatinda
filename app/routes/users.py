import logging
from flask import Blueprint, request, jsonify, session
from datetime import datetime
import psycopg2
import psycopg2.extras

from app.db import get_db_conn
from app.config import Config
from app.helpers import row_to_dict, rows_to_list, generate_username, generate_password, user_public
from app.services.audit import log_audit
from app.services.email import send_email_async

logger = logging.getLogger('aiims.users')
bp = Blueprint('users', __name__)


@bp.route("/api/users/profile/display-name", methods=["POST"])
def api_change_display_name():
    """Change the user's display username."""
    sess_user = session.get("user")
    if not sess_user:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    data = request.get_json(force=True)
    new_username = data.get("new_username", "").strip()
    if not new_username or len(new_username) < 3:
        return jsonify({"success": False, "message": "Username must be at least 3 characters"}), 400

    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT username FROM Users WHERE username = %s", (new_username,)
        )
        existing = cur.fetchone()
        if existing:
            return jsonify({"success": False, "message": "This username is already taken"}), 409

        old_username = sess_user['username']

        # Retrieve existing user stats to migrate
        cur.execute("SELECT * FROM Users WHERE username = %s", (old_username,))
        old_user = cur.fetchone()
        if old_user:
            u_dict = row_to_dict(old_user)
            # 1. Insert new user record
            cur.execute(
                "INSERT INTO Users (username, password, name, role, designation, specialization) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (new_username, u_dict.get('password'), u_dict.get('name'),
                 u_dict.get('role'), u_dict.get('designation', ''),
                 u_dict.get('specialization', ''))
            )

        # 2. Update username references in all related tables
        for table, col in [
            ("Event_Volunteers", "username"), ("Event_Staff", "username"),
            ("Audit_Logs", "user_id"), ("Health_Records", "doctor_id"),
            ("Schools", "poc_username"), ("Events", "created_by"),
            ("Students", "added_by"),
        ]:
            try:
                cur.execute(
                    f"UPDATE {table} SET {col} = %s WHERE {col} = %s",
                    (new_username, old_username),
                )
            except Exception:
                logger.exception(f"Failed to update {table}.{col} during username change")

        # 3. Safely delete the old username record
        if old_user:
            cur.execute("DELETE FROM Users WHERE username = %s", (old_username,))

        conn.commit()

    # Update session
    sess_user['username'] = new_username
    session['user'] = sess_user

    log_audit(new_username, "CHANGE_USERNAME", f"Changed from {old_username} to {new_username}")
    return jsonify({"success": True, "username": new_username})


@bp.route("/api/users/check-username")
def api_check_username():
    """Real-time uniqueness check for usernames."""
    q = request.args.get("q", "").strip()
    if not q or len(q) < 3:
        return jsonify({"available": False})
    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT username FROM Users WHERE username = %s", (q,))
        existing = cur.fetchone()
    return jsonify({"available": existing is None})


@bp.route("/api/users/register", methods=["POST"])
def api_register_user():
    """Admin registers a new user. Generates temp user_id and password, emails them."""
    data = request.get_json(force=True)
    email = data.get("email", "").strip().lower()
    name = data.get("name", "").strip()
    role = data.get("role", "Other")
    designation = data.get("designation", "").strip()
    specialization = data.get("specialization", "").strip()
    admin_user = data.get("admin_user", "admin")

    if not email or not name:
        return jsonify({
            "success": False,
            "message": "Email and name are required"
        }), 400

    # Basic email format check
    if '@' not in email or '.' not in email.split('@')[-1]:
        return jsonify({
            "success": False,
            "message": "Please enter a valid email address"
        }), 400

    if role not in Config.ALL_ROLES:
        return jsonify({
            "success": False,
            "message": f"Role must be one of: {', '.join(Config.ALL_ROLES)}"
        }), 400

    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Check email uniqueness
        cur.execute(
            "SELECT username FROM Users WHERE email = %s", (email,)
        )
        existing = cur.fetchone()
        if existing:
            return jsonify({"success": False, "message": "An account with this email already exists"}), 409

        # Auto-generate username (≤15 chars) and temp password (≤10 chars)
        username = generate_username(name)
        # Ensure uniqueness
        cur.execute("SELECT username FROM Users WHERE username = %s", (username,))
        while cur.fetchone():
            username = generate_username(name)
            cur.execute("SELECT username FROM Users WHERE username = %s", (username,))

        temp_password = generate_password(10)

        cur.execute(
            "INSERT INTO Users (username, password, email, role, name, designation, specialization) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (username, temp_password, email, role, name, designation, specialization),
        )

        # If School POC, auto-create a School record linked to this user
        school_id = None
        if role == "School POC":
            school_name = data.get("school_name", "").strip()
            school_address = data.get("school_address", "").strip()
            poc_designation = data.get("poc_designation", "").strip()
            poc_phone = data.get("poc_phone", "").strip()
            poc_email = email
            now = datetime.utcnow().isoformat()
            cur.execute(
                """INSERT INTO Schools (school_name, school_address, poc_username,
                   poc_name, poc_designation, poc_phone, poc_email, created_at)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING school_id""",
                (school_name, school_address, username, name,
                 poc_designation, poc_phone, poc_email, now),
            )
            school_id = cur.fetchone()["school_id"]

        conn.commit()

    log_audit(admin_user, "REGISTER_USER",
              f"Registered {role} user: {username} ({name}, {email})")

    # Send welcome email with credentials (async)
    role_display = role.replace('_', ' ')
    send_email_async(
        email,
        'Welcome to AIIMS Bathinda Health Portal',
        f'<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;'
        f'background:#0f172a;color:#e2e8f0;border-radius:16px">'
        f'<div style="text-align:center;margin-bottom:24px">'
        f'<h1 style="color:#22d3ee;margin:0">AIIMS Bathinda</h1>'
        f'<p style="color:#94a3b8;font-size:14px;margin:4px 0 0">Health Screening Portal</p>'
        f'</div>'
        f'<p style="color:#e2e8f0">Hi <strong>{name}</strong>,</p>'
        f'<p style="color:#cbd5e1">You have been registered as '
        f'<strong style="color:#22d3ee">{role_display}</strong> on the AIIMS Bathinda portal.</p>'
        f'<p style="color:#cbd5e1">Here are your login credentials:</p>'
        f'<div style="background:#1e293b;padding:20px;border-radius:12px;margin:16px 0;'
        f'border:1px solid #334155">'
        f'<table style="width:100%;border-collapse:collapse">'
        f'<tr><td style="color:#94a3b8;padding:6px 0;font-size:13px">Email</td>'
        f'<td style="color:#f1f5f9;font-weight:bold;padding:6px 0">{email}</td></tr>'
        f'<tr><td style="color:#94a3b8;padding:6px 0;font-size:13px">User ID</td>'
        f'<td style="color:#22d3ee;font-weight:bold;font-family:monospace;padding:6px 0">{username}</td></tr>'
        f'<tr><td style="color:#94a3b8;padding:6px 0;font-size:13px">Password</td>'
        f'<td style="color:#fbbf24;font-weight:bold;font-family:monospace;padding:6px 0">{temp_password}</td></tr>'
        f'</table></div>'
        f'<p style="color:#cbd5e1;font-size:14px">You can log in using:</p>'
        f'<ul style="color:#cbd5e1;font-size:14px;padding-left:20px">'
        f'<li><strong>Email + OTP</strong> (a code will be sent to this email)</li>'
        f'<li><strong>Email + Password</strong> (use the password above)</li>'
        f'</ul>'
        f'<p style="color:#64748b;font-size:12px;margin-top:24px;border-top:1px solid #334155;'
        f'padding-top:16px">'
        f'You can change your User ID and password after logging in from Profile Settings.</p>'
        f'</div>',
    )

    result = {
        "success": True,
        "username": username,
        "password": temp_password,
        "email": email,
        "email_sent": True,  # async, so we assume success
    }
    if school_id:
        result["school_id"] = school_id
    return jsonify(result)
