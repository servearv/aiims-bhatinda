import logging
from flask import Blueprint, request, jsonify, session
from datetime import datetime, timedelta
import random
import string
import psycopg2

from app.db import get_db_conn
from app.helpers import row_to_dict, user_public
from app.services.audit import log_audit
from app.services.email import send_email_async

logger = logging.getLogger('aiims.auth')
bp = Blueprint('auth', __name__)


@bp.route("/api/auth/identify", methods=["POST"])
def api_auth_identify():
    """Step 1 of login: identify user by email or username."""
    data = request.get_json(force=True)
    identifier = data.get("identifier", "").strip()
    if not identifier:
        return jsonify({"found": False})

    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT username, email, role, name, password FROM Users WHERE email = %s OR username = %s",
            (identifier, identifier),
        )
        user = cur.fetchone()

    if not user:
        return jsonify({"found": False})

    u = row_to_dict(user)
    return jsonify({
        "found": True,
        "name": u['name'],
        "role": u['role'],
        "has_password": u['password'] is not None and u['password'] != '',
    })


@bp.route("/api/auth/send-otp", methods=["POST"])
def api_auth_send_otp():
    """Generate a 6-digit OTP and email it."""
    data = request.get_json(force=True)
    identifier = data.get("identifier", "").strip()

    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT username, email, name FROM Users WHERE email = %s OR username = %s",
            (identifier, identifier),
        )
        user = cur.fetchone()

        if not user:
            return jsonify({"success": False, "message": "No account found"}), 404

        u = row_to_dict(user)
        email = u.get('email')
        if not email:
            return jsonify({"success": False, "message": "No email on this account. Use password login."}), 400

        otp = ''.join(random.choices(string.digits, k=6))
        expires = (datetime.utcnow() + timedelta(minutes=5)).isoformat()

        cur.execute(
            "UPDATE Users SET otp_code = %s, otp_expires = %s WHERE username = %s",
            (otp, expires, u['username']),
        )
        conn.commit()

    # Send the OTP email (async — does not block the worker)
    send_email_async(
        email,
        'Your AIIMS Bathinda Login Code',
        f'<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px">'
        f'<h2 style="color:#0891b2">AIIMS Bathinda</h2>'
        f'<p>Hi {u["name"]},</p>'
        f'<p>Your one-time login code is:</p>'
        f'<div style="font-size:32px;font-weight:bold;letter-spacing:8px;'
        f'text-align:center;background:#f1f5f9;padding:16px;border-radius:12px;'
        f'margin:16px 0">{otp}</div>'
        f'<p style="color:#64748b;font-size:13px">This code expires in 5 minutes.</p>'
        f'</div>',
    )

    return jsonify({"success": True, "message": "OTP sent to your email"})


@bp.route("/api/auth/verify-otp", methods=["POST"])
def api_auth_verify_otp():
    """Verify OTP and log the user in."""
    data = request.get_json(force=True)
    identifier = data.get("identifier", "").strip()
    otp = data.get("otp", "").strip()

    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT username, email, role, name, password, designation, specialization, "
            "otp_code, otp_expires FROM Users WHERE email = %s OR username = %s",
            (identifier, identifier),
        )
        user = cur.fetchone()

        if not user:
            return jsonify({"success": False, "message": "Account not found"}), 404

        u = row_to_dict(user)

        if not u.get('otp_code') or u['otp_code'] != otp:
            return jsonify({"success": False, "message": "Incorrect code"}), 401

        # Check expiry
        try:
            expires = datetime.fromisoformat(u['otp_expires'])
            if datetime.utcnow() > expires:
                return jsonify({"success": False, "message": "Code expired. Request a new one."}), 401
        except Exception:
            return jsonify({"success": False, "message": "Code expired"}), 401

        # Clear OTP
        cur.execute(
            "UPDATE Users SET otp_code = NULL, otp_expires = NULL WHERE username = %s",
            (u['username'],),
        )
        conn.commit()

    pub = user_public(u)
    needs_password = u['password'] is None or u['password'] == ''

    session.permanent = True
    session["user"] = pub

    log_audit(u['username'], "LOGIN_OTP", "User logged in via OTP")
    return jsonify({"success": True, "user": pub, "needs_password_setup": needs_password})


@bp.route("/api/login", methods=["POST"])
def api_login():
    """Password-based login. Accepts email or username as identifier."""
    data = request.get_json(force=True)
    identifier = data.get("identifier", "").strip()
    password = data.get("password", "")

    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT username, email, role, name, password, designation, specialization "
            "FROM Users WHERE (email = %s OR username = %s) AND password = %s",
            (identifier, identifier, password),
        )
        user = cur.fetchone()

    if not user:
        return jsonify({"success": False, "message": "Invalid email or password"}), 401

    u = row_to_dict(user)
    pub = user_public(u)

    session.permanent = True
    session["user"] = pub

    log_audit(u['username'], "LOGIN", "User logged in with password")
    return jsonify({"success": True, "user": pub})


@bp.route("/api/users/set-password", methods=["POST"])
def api_set_password():
    """First-time password setup (user has no password yet). Requires active session."""
    sess_user = session.get("user")
    if not sess_user:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    data = request.get_json(force=True)
    new_password = data.get("new_password", "").strip()
    if len(new_password) < 4:
        return jsonify({"success": False, "message": "Password must be at least 4 characters"}), 400

    with get_db_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE Users SET password = %s WHERE username = %s",
            (new_password, sess_user['username']),
        )
        conn.commit()

    log_audit(sess_user['username'], "SET_PASSWORD", "User set their password for the first time")
    return jsonify({"success": True})


@bp.route("/api/users/profile/password", methods=["POST"])
def api_change_password():
    """Change password for a user who already has one."""
    sess_user = session.get("user")
    if not sess_user:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    data = request.get_json(force=True)
    old_password = data.get("old_password", "")
    new_password = data.get("new_password", "").strip()

    if len(new_password) < 4:
        return jsonify({"success": False, "message": "Password must be at least 4 characters"}), 400

    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT password FROM Users WHERE username = %s",
            (sess_user['username'],),
        )
        user = cur.fetchone()

        if not user or row_to_dict(user).get('password') != old_password:
            return jsonify({"success": False, "message": "Current password is incorrect"}), 401

        cur.execute(
            "UPDATE Users SET password = %s WHERE username = %s",
            (new_password, sess_user['username']),
        )
        conn.commit()

    log_audit(sess_user['username'], "CHANGE_PASSWORD", "User changed their password")
    return jsonify({"success": True})


@bp.route("/api/session", methods=["GET"])
def api_session():
    """Return current session user (survives page refresh)."""
    user = session.get("user")
    if user:
        return jsonify({"success": True, "user": user})
    return jsonify({"success": False}), 401


@bp.route("/api/logout", methods=["POST"])
def api_logout():
    """Clear the session."""
    username = session.get("user", {}).get("username", "unknown")
    session.clear()
    log_audit(username, "LOGOUT", "User logged out")
    return jsonify({"success": True})
