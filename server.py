import os
import io
import csv
import json
import logging
import random
import string
import subprocess
import sys
import re
import smtplib
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, date, timedelta
from urllib.parse import urlparse

# ---------------------------------------------------------------------------
# Logging Configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('aiims')

try:
    import psycopg2
    import psycopg2.extras
    from psycopg2 import sql
except ImportError:
    pass

from flask import Flask, request, jsonify, send_from_directory, Response, session

# Optional: flask-socketio for real-time updates
try:
    from flask_socketio import SocketIO, emit
    HAS_SOCKETIO = True
except ImportError:
    HAS_SOCKETIO = False

# ---------------------------------------------------------------------------
# App & Config
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, "dist")
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

app = Flask(__name__, static_folder=None)   # we handle static files ourselves
app.config["JSON_SORT_KEYS"] = False
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "aiims-bathinda-secret-dev")

# Session config — server-side filesystem sessions
SESSION_DIR = os.path.join(DATA_DIR, "flask_sessions")
os.makedirs(SESSION_DIR, exist_ok=True)
app.config["SESSION_TYPE"] = "filesystem"
app.config["SESSION_FILE_DIR"] = SESSION_DIR
app.config["SESSION_PERMANENT"] = True
app.config["PERMANENT_SESSION_LIFETIME"] = 86400 * 7  # 7 days

try:
    from flask_session import Session
    Session(app)
except ImportError:
    # flask-session not installed; use default cookie-based sessions
    pass

if HAS_SOCKETIO:
    socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")
else:
    socketio = None

PORT = int(os.environ.get("PORT", 3000))
DB_PATH = os.environ.get("DATABASE_PATH", os.path.join(DATA_DIR, "database.db"))

# Valid specialist roles (replaces the old "Medical Staff" role)
SPECIALIST_ROLES = [
    'Community_Medicine', 'Dental', 'ENT',
    'Eye_Specialist', 'Skin_Specialist', 'Other'
]
ALL_ROLES = ['Admin', 'School POC'] + SPECIALIST_ROLES

# Map old specialization values → new specialist roles (for migration)
SPEC_TO_ROLE = {
    'General Medicine': 'Community_Medicine',
    'Pediatrics': 'Community_Medicine',
    'Ophthalmology': 'Eye_Specialist',
    'ENT': 'ENT',
    'Dentistry': 'Dental',
    'Dermatology': 'Skin_Specialist',
    'Orthopedics': 'Other',
    'Cardiology': 'Other',
    'Psychiatry': 'Other',
    'Nursing': 'Other',
    'Emergency Medicine': 'Other',
    'Other': 'Other',
}


# ---------------------------------------------------------------------------
# Database helpers (PostgreSQL Wrapper)
# ---------------------------------------------------------------------------

class DBCursorWrapper:
    """Wraps psycopg2 cursor to convert SQLite '?' to Postgres '%s' and mimic sqlite3.Row dict access."""
    def __init__(self, cur):
        self.cur = cur

    def _convert_sql(self, sql_str):
        if '?' in sql_str:
            return sql_str.replace('?', '%s')
        return sql_str

    def execute(self, sql_str, params=None):
        pg_sql = self._convert_sql(sql_str)
        if params is not None:
            self.cur.execute(pg_sql, params)
        else:
            self.cur.execute(pg_sql)
        return self

    def fetchone(self):
        return self.cur.fetchone()

    def fetchall(self):
        return self.cur.fetchall()

    def executescript(self, sql_str):
        self.cur.execute(sql_str)
        return self

class DBConnectionWrapper:
    """Wraps psycopg2 connection to mimic sqlite3."""
    def __init__(self, conn):
        self.conn = conn

    def cursor(self):
        return DBCursorWrapper(self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor))

    def execute(self, sql_str, params=None):
        cur = self.cursor()
        return cur.execute(sql_str, params)

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def close(self):
        self.conn.close()

def get_db():
    """Return a new PostgreSQL connection (with dict-like rows) for the current request."""
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL environment variable is required for PostgreSQL connection.")
    
    conn = psycopg2.connect(db_url)
    return DBConnectionWrapper(conn)


def init_db():
    """Create the schema and seed initial data (idempotent for PostgreSQL)."""
    conn = get_db()
    cur = conn.cursor()

    cur.executescript("""
        CREATE TABLE IF NOT EXISTS Users (
            username TEXT PRIMARY KEY,
            password TEXT,
            role TEXT,
            name TEXT,
            designation TEXT DEFAULT '',
            specialization TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS Schools (
            school_id SERIAL PRIMARY KEY,
            school_name TEXT NOT NULL,
            school_address TEXT DEFAULT '',
            poc_username TEXT,
            poc_name TEXT DEFAULT '',
            poc_designation TEXT DEFAULT '',
            poc_phone TEXT DEFAULT '',
            poc_email TEXT DEFAULT '',
            created_at TEXT,
            FOREIGN KEY(poc_username) REFERENCES Users(username)
        );

        CREATE TABLE IF NOT EXISTS Events (
            event_id SERIAL PRIMARY KEY,
            school_name TEXT NOT NULL,
            school_address TEXT DEFAULT '',
            poc_name TEXT DEFAULT '',
            poc_designation TEXT DEFAULT '',
            poc_phone TEXT DEFAULT '',
            poc_email TEXT DEFAULT '',
            school_id INTEGER,
            start_date TEXT NOT NULL,
            end_date TEXT DEFAULT '',
            operational_hours TEXT DEFAULT '',
            tag TEXT DEFAULT 'Upcoming',
            created_at TEXT,
            created_by TEXT,
            FOREIGN KEY(created_by) REFERENCES Users(username),
            FOREIGN KEY(school_id) REFERENCES Schools(school_id)
        );

        CREATE TABLE IF NOT EXISTS Event_Staff (
            event_id INTEGER,
            username TEXT,
            assigned_at TEXT,
            PRIMARY KEY (event_id, username),
            FOREIGN KEY(event_id) REFERENCES Events(event_id),
            FOREIGN KEY(username) REFERENCES Users(username)
        );

        CREATE TABLE IF NOT EXISTS Event_Volunteers (
            event_id INTEGER,
            username TEXT,
            category TEXT,
            joined_at TEXT,
            active INTEGER DEFAULT 1,
            PRIMARY KEY (event_id, username),
            FOREIGN KEY(event_id) REFERENCES Events(event_id),
            FOREIGN KEY(username) REFERENCES Users(username)
        );

        CREATE TABLE IF NOT EXISTS Students (
            student_id SERIAL PRIMARY KEY,
            event_id INTEGER,
            name TEXT,
            age INTEGER,
            dob TEXT,
            gender TEXT,
            student_class TEXT,
            section TEXT,
            blood_group TEXT,
            father_name TEXT,
            phone TEXT,
            qr_code_hash TEXT,
            added_by TEXT DEFAULT '',
            status TEXT DEFAULT 'Pending Examination',
            FOREIGN KEY(event_id) REFERENCES Events(event_id)
        );

        CREATE TABLE IF NOT EXISTS Health_Records (
            record_id SERIAL PRIMARY KEY,
            student_id INTEGER,
            event_id INTEGER,
            doctor_id TEXT,
            category TEXT,
            json_data TEXT,
            timestamp TEXT,
            FOREIGN KEY(student_id) REFERENCES Students(student_id),
            FOREIGN KEY(event_id) REFERENCES Events(event_id),
            FOREIGN KEY(doctor_id) REFERENCES Users(username)
        );

        CREATE TABLE IF NOT EXISTS Audit_Logs (
            log_id SERIAL PRIMARY KEY,
            timestamp TEXT,
            user_id TEXT,
            action TEXT,
            details TEXT,
            FOREIGN KEY(user_id) REFERENCES Users(username)
        );

        CREATE TABLE IF NOT EXISTS Student_General_Info (
            id SERIAL PRIMARY KEY,
            student_id INTEGER NOT NULL,
            event_id INTEGER NOT NULL,
            height TEXT DEFAULT '',
            weight TEXT DEFAULT '',
            bmi TEXT DEFAULT '',
            symptoms_json TEXT DEFAULT '[]',
            filled_by TEXT DEFAULT '',
            updated_at TEXT,
            FOREIGN KEY(student_id) REFERENCES Students(student_id),
            FOREIGN KEY(event_id) REFERENCES Events(event_id),
            UNIQUE(student_id, event_id)
        );

        CREATE TABLE IF NOT EXISTS Camp_Requests (
            request_id SERIAL PRIMARY KEY,
            school_id INTEGER,
            school_name TEXT NOT NULL,
            preferred_date TEXT NOT NULL,
            end_date TEXT DEFAULT '',
            student_count INTEGER DEFAULT 0,
            classes TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            status TEXT DEFAULT 'Pending',
            created_at TEXT,
            reviewed_at TEXT,
            reviewed_by TEXT,
            FOREIGN KEY(school_id) REFERENCES Schools(school_id)
        );
    """)

    conn.commit()

    # Idempotent migrations: add columns if missing
    user_cols = ["designation TEXT DEFAULT ''", "specialization TEXT DEFAULT ''",
                 "email TEXT", "otp_code TEXT", "otp_expires TEXT"]
    for col_def in user_cols:
        try:
            cur.execute(f"ALTER TABLE Users ADD COLUMN IF NOT EXISTS {col_def}")
            conn.commit()
        except Exception:
            conn.rollback()

    # Add unique constraint on email (ignore if already exists)
    try:
        cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON Users(email) WHERE email IS NOT NULL")
        conn.commit()
    except Exception:
        conn.rollback()

    student_cols = ["dob TEXT", "student_class TEXT", "section TEXT",
                    "blood_group TEXT", "father_name TEXT", "phone TEXT",
                    "event_id INTEGER", "added_by TEXT DEFAULT ''",
                    "status TEXT DEFAULT 'Pending Examination'",
                    "mother_name TEXT DEFAULT ''",
                    "mother_occupation TEXT DEFAULT ''",
                    "father_occupation TEXT DEFAULT ''",
                    "address TEXT DEFAULT ''",
                    "pincode TEXT DEFAULT ''"]
    for col_def in student_cols:
        try:
            cur.execute(f"ALTER TABLE Students ADD COLUMN IF NOT EXISTS {col_def}")
            conn.commit()
        except Exception:
            conn.rollback()

    try:
        cur.execute("ALTER TABLE Events ADD COLUMN IF NOT EXISTS school_id INTEGER")
        conn.commit()
    except Exception:
        conn.rollback()

    try:
        cur.execute("ALTER TABLE Camp_Requests RENAME COLUMN alternate_date TO end_date")
        conn.commit()
    except Exception:
        conn.rollback()

    # --- Migration: Medical Staff → Specialist roles ---
    try:
        staff_users = cur.execute(
            "SELECT username, specialization FROM Users WHERE role = 'Medical Staff'"
        ).fetchall()
        for u in staff_users:
            new_role = SPEC_TO_ROLE.get(u['specialization'], 'Other')
            cur.execute("UPDATE Users SET role = %s WHERE username = %s",
                        (new_role, u['username']))
        conn.commit()
    except Exception:
        conn.rollback()

    # --- Migration: Copy Event_Staff → Event_Volunteers ---
    try:
        existing = cur.execute(
            "SELECT es.event_id, es.username, es.assigned_at, u.role "
            "FROM Event_Staff es JOIN Users u ON es.username = u.username"
        ).fetchall()
        for row in existing:
            try:
                cur.execute(
                    "INSERT INTO Event_Volunteers "
                    "(event_id, username, category, joined_at, active) "
                    "VALUES (%s,%s,%s,%s,1)",
                    (row['event_id'], row['username'], row['role'],
                     row['assigned_at']),
                )
                conn.commit()
            except psycopg2.IntegrityError:
                conn.rollback()
            except Exception:
                conn.rollback()
    except Exception:
        conn.rollback()

    # Seed only when Users table is empty
    row = cur.execute("SELECT COUNT(*) AS count FROM Users").fetchone()
    if row and row["count"] == 0:
        cur.execute(
            "INSERT INTO Users (username,password,role,name,designation,specialization,email) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s)",
            ("Admin", "admin", "Admin", "Admin", "", "", "nachiketavachat@gmail.com"),
        )

    # Migration: update existing admin email from old to new, ensuring Admin/admin11 can login
    try:
        cur.execute(
            """UPDATE Users SET email = %s 
               WHERE (username = %s OR username = %s) 
               AND (email IS NULL OR email = %s OR email = %s)""",
            ("nachiketavachat@gmail.com", "Admin", "admin11", "", "atharvam1580@gmail.com"),
        )
        conn.commit()
    except Exception:
        conn.rollback()

    conn.commit()
    conn.close()


def log_audit(user_id: str, action: str, details: str):
    conn = get_db()
    conn.execute(
        "INSERT INTO Audit_Logs (timestamp, user_id, action, details) VALUES (%s,%s,%s,%s)",
        (datetime.utcnow().isoformat(), user_id, action, details),
    )
    conn.commit()
    conn.close()


def row_to_dict(row):
    """Convert a psycopg2 RealDictRow to a plain dict."""
    if row is None:
        return None
    return dict(row)


def rows_to_list(rows):
    return [dict(r) for r in rows]


def generate_username(name: str) -> str:
    """Generate a username from a name: 'Dr. Anil Kumar' → 'anil.kum.x7k' (max 15 chars)."""
    # Strip titles
    clean = re.sub(r'^(dr\.?|mr\.?|mrs\.?|ms\.?|prof\.?)\s*', '', name.strip(), flags=re.IGNORECASE)
    parts = re.sub(r'[^a-zA-Z\s]', '', clean).lower().split()
    base = '.'.join(parts[:2]) if parts else 'user'
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=3))
    result = f"{base}.{suffix}"
    # Cap at 15 characters
    if len(result) > 15:
        result = result[:11] + '.' + suffix
    return result[:15]


def generate_password(length: int = 10) -> str:
    """Generate a random alphanumeric password (max 10 chars)."""
    chars = string.ascii_letters + string.digits
    return ''.join(random.choices(chars, k=min(length, 10)))


def send_email(to_email: str, subject: str, body_html: str):
    """Send an email via Gmail SMTP. Requires SMTP_PASSWORD env var."""
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
    except Exception as e:
        logger.error(f"Email sending failed to {to_email}: {e}")
        return False


def _user_public(u: dict) -> dict:
    """Return only the public fields of a user dict (no password/otp)."""
    return {
        'username': u.get('username'),
        'email': u.get('email'),
        'role': u.get('role'),
        'name': u.get('name'),
        'designation': u.get('designation', ''),
        'specialization': u.get('specialization', ''),
    }


# ---------------------------------------------------------------------------
# Date helper: smartly accept dd-mm-yyyy, mm/dd/yyyy, and yyyy-mm-dd
# ---------------------------------------------------------------------------
def _normalize_date(raw: str) -> str:
    """Convert dd-mm-yyyy or mm-dd-yyyy to yyyy-mm-dd; pass through if already iso."""
    raw = raw.strip()
    if not raw:
        return raw
    for sep in ('-', '/'):
        parts = raw.split(sep)
        if len(parts) == 3:
            a, b, c = parts
            # If first two parts are 1-2 digits and last is 4 digits
            if len(a) <= 2 and len(b) <= 2 and len(c) == 4:
                try:
                    num_a = int(a)
                    num_b = int(b)
                    # If middle part > 12, it MUST be the day -> MM/DD/YYYY format
                    if num_b > 12:
                        return f"{c}-{a.zfill(2)}-{b.zfill(2)}"
                    # Otherwise assume DD/MM/YYYY format as standard
                    return f"{c}-{b.zfill(2)}-{a.zfill(2)}"
                except ValueError:
                    pass
    # Already yyyy-mm-dd or unrecognized — return as-is
    return raw


# ---------------------------------------------------------------------------
# Dynamic camp status computation
# ---------------------------------------------------------------------------
def _compute_event_status(start_date_str: str, end_date_str: str) -> str:
    """Compute camp status dynamically from start/end dates vs today.

    Returns 'Upcoming', 'Ongoing', or 'Completed'.
    """
    today = date.today()

    # Parse start_date
    start = None
    if start_date_str:
        try:
            start = date.fromisoformat(_normalize_date(start_date_str))
        except (ValueError, TypeError):
            logger.warning(f"Could not parse start_date: {start_date_str!r}")

    # Parse end_date
    end = None
    if end_date_str:
        try:
            end = date.fromisoformat(_normalize_date(end_date_str))
        except (ValueError, TypeError):
            logger.warning(f"Could not parse end_date: {end_date_str!r}")

    if start and start > today:
        return 'Upcoming'
    if end and end < today:
        return 'Completed'
    # start_date is today or in the past, and end_date is today/future or not set
    return 'Ongoing'


def _enrich_events_with_status(events: list) -> list:
    """Add 'computed_status' to each event dict based on date logic."""
    for ev in events:
        raw_tag = ev.get('tag', '')
        # If event was manually cancelled, keep that
        if raw_tag == 'Cancelled':
            ev['computed_status'] = 'Cancelled'
        else:
            ev['computed_status'] = _compute_event_status(
                ev.get('start_date', ''),
                ev.get('end_date', ''),
            )
    return events


# ---------------------------------------------------------------------------
# Request logging middleware
# ---------------------------------------------------------------------------
@app.before_request
def _log_request_start():
    request._start_time = time.time()


@app.after_request
def _log_request_end(response):
    duration = time.time() - getattr(request, '_start_time', time.time())
    if request.path.startswith('/api/'):
        logger.info(
            f"{request.method} {request.path} → {response.status_code} "
            f"({duration * 1000:.0f}ms)"
        )
    return response


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

# ---- Auth ----

@app.route("/api/auth/identify", methods=["POST"])
def api_auth_identify():
    """Step 1 of login: identify user by email or username."""
    data = request.get_json(force=True)
    identifier = data.get("identifier", "").strip()
    if not identifier:
        return jsonify({"found": False})

    conn = get_db()
    user = conn.execute(
        "SELECT username, email, role, name, password FROM Users WHERE email = ? OR username = ?",
        (identifier, identifier),
    ).fetchone()
    conn.close()

    if not user:
        return jsonify({"found": False})

    u = row_to_dict(user)
    return jsonify({
        "found": True,
        "name": u['name'],
        "role": u['role'],
        "has_password": u['password'] is not None and u['password'] != '',
    })


@app.route("/api/auth/send-otp", methods=["POST"])
def api_auth_send_otp():
    """Generate a 6-digit OTP and email it."""
    data = request.get_json(force=True)
    identifier = data.get("identifier", "").strip()

    conn = get_db()
    user = conn.execute(
        "SELECT username, email, name FROM Users WHERE email = ? OR username = ?",
        (identifier, identifier),
    ).fetchone()

    if not user:
        conn.close()
        return jsonify({"success": False, "message": "No account found"}), 404

    u = row_to_dict(user)
    email = u.get('email')
    if not email:
        conn.close()
        return jsonify({"success": False, "message": "No email on this account. Use password login."}), 400

    otp = ''.join(random.choices(string.digits, k=6))
    expires = (datetime.utcnow() + timedelta(minutes=5)).isoformat()

    conn.execute(
        "UPDATE Users SET otp_code = ?, otp_expires = ? WHERE username = ?",
        (otp, expires, u['username']),
    )
    conn.commit()
    conn.close()

    # Send the OTP email
    send_email(
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


@app.route("/api/auth/verify-otp", methods=["POST"])
def api_auth_verify_otp():
    """Verify OTP and log the user in."""
    data = request.get_json(force=True)
    identifier = data.get("identifier", "").strip()
    otp = data.get("otp", "").strip()

    conn = get_db()
    user = conn.execute(
        "SELECT username, email, role, name, password, designation, specialization, "
        "otp_code, otp_expires FROM Users WHERE email = ? OR username = ?",
        (identifier, identifier),
    ).fetchone()

    if not user:
        conn.close()
        return jsonify({"success": False, "message": "Account not found"}), 404

    u = row_to_dict(user)

    if not u.get('otp_code') or u['otp_code'] != otp:
        conn.close()
        return jsonify({"success": False, "message": "Incorrect code"}), 401

    # Check expiry
    try:
        expires = datetime.fromisoformat(u['otp_expires'])
        if datetime.utcnow() > expires:
            conn.close()
            return jsonify({"success": False, "message": "Code expired. Request a new one."}), 401
    except Exception:
        conn.close()
        return jsonify({"success": False, "message": "Code expired"}), 401

    # Clear OTP
    conn.execute(
        "UPDATE Users SET otp_code = NULL, otp_expires = NULL WHERE username = ?",
        (u['username'],),
    )
    conn.commit()
    conn.close()

    pub = _user_public(u)
    needs_password = u['password'] is None or u['password'] == ''

    session.permanent = True
    session["user"] = pub

    log_audit(u['username'], "LOGIN_OTP", "User logged in via OTP")
    return jsonify({"success": True, "user": pub, "needs_password_setup": needs_password})


@app.route("/api/login", methods=["POST"])
def api_login():
    """Password-based login. Accepts email or username as identifier."""
    data = request.get_json(force=True)
    identifier = data.get("identifier", "").strip()
    password = data.get("password", "")

    conn = get_db()
    user = conn.execute(
        "SELECT username, email, role, name, password, designation, specialization "
        "FROM Users WHERE (email = ? OR username = ?) AND password = ?",
        (identifier, identifier, password),
    ).fetchone()
    conn.close()

    if not user:
        return jsonify({"success": False, "message": "Invalid email or password"}), 401

    u = row_to_dict(user)
    pub = _user_public(u)

    session.permanent = True
    session["user"] = pub

    log_audit(u['username'], "LOGIN", "User logged in with password")
    return jsonify({"success": True, "user": pub})


@app.route("/api/users/set-password", methods=["POST"])
def api_set_password():
    """First-time password setup (user has no password yet). Requires active session."""
    sess_user = session.get("user")
    if not sess_user:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    data = request.get_json(force=True)
    new_password = data.get("new_password", "").strip()
    if len(new_password) < 4:
        return jsonify({"success": False, "message": "Password must be at least 4 characters"}), 400

    conn = get_db()
    conn.execute(
        "UPDATE Users SET password = ? WHERE username = ?",
        (new_password, sess_user['username']),
    )
    conn.commit()
    conn.close()

    log_audit(sess_user['username'], "SET_PASSWORD", "User set their password for the first time")
    return jsonify({"success": True})


@app.route("/api/users/profile/password", methods=["POST"])
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

    conn = get_db()
    user = conn.execute(
        "SELECT password FROM Users WHERE username = ?",
        (sess_user['username'],),
    ).fetchone()

    if not user or row_to_dict(user).get('password') != old_password:
        conn.close()
        return jsonify({"success": False, "message": "Current password is incorrect"}), 401

    conn.execute(
        "UPDATE Users SET password = ? WHERE username = ?",
        (new_password, sess_user['username']),
    )
    conn.commit()
    conn.close()

    log_audit(sess_user['username'], "CHANGE_PASSWORD", "User changed their password")
    return jsonify({"success": True})


@app.route("/api/users/profile/display-name", methods=["POST"])
def api_change_display_name():
    """Change the user's display username."""
    sess_user = session.get("user")
    if not sess_user:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    data = request.get_json(force=True)
    new_username = data.get("new_username", "").strip()
    if not new_username or len(new_username) < 3:
        return jsonify({"success": False, "message": "Username must be at least 3 characters"}), 400

    conn = get_db()
    existing = conn.execute(
        "SELECT username FROM Users WHERE username = ?", (new_username,)
    ).fetchone()
    if existing:
        conn.close()
        return jsonify({"success": False, "message": "This username is already taken"}), 409

    old_username = sess_user['username']
    
    # Retrieve existing user stats to migrate
    old_user = conn.execute("SELECT * FROM Users WHERE username = ?", (old_username,)).fetchone()
    if old_user:
        u_dict = row_to_dict(old_user)
        # 1. Insert new user record
        conn.execute(
            "INSERT INTO Users (username, password, name, role, designation, specialization) VALUES (?, ?, ?, ?, ?, ?)",
            (new_username, u_dict.get('password'), u_dict.get('name'), u_dict.get('role'), u_dict.get('designation', ''), u_dict.get('specialization', ''))
        )
    
    # 2. Update username references in all related tables
    for table_col in [
        ("Event_Volunteers", "username"), ("Event_Staff", "username"),
        ("Audit_Logs", "user_id"), ("Health_Records", "doctor_id"),
        ("Schools", "poc_username"), ("Events", "created_by"),
        ("Students", "added_by"),
    ]:
        try:
            conn.execute(
                f"UPDATE {table_col[0]} SET {table_col[1]} = ? WHERE {table_col[1]} = ?",
                (new_username, old_username),
            )
        except Exception:
            pass  # table/column might not exist
            
    # 3. Safely delete the old username record now that foreign keys point to the new one
    if old_user:
        conn.execute("DELETE FROM Users WHERE username = ?", (old_username,))
        
    conn.commit()
    conn.close()

    # Update session
    sess_user['username'] = new_username
    session['user'] = sess_user

    log_audit(new_username, "CHANGE_USERNAME", f"Changed from {old_username} to {new_username}")
    return jsonify({"success": True, "username": new_username})


@app.route("/api/users/check-username")
def api_check_username():
    """Real-time uniqueness check for usernames."""
    q = request.args.get("q", "").strip()
    if not q or len(q) < 3:
        return jsonify({"available": False})
    conn = get_db()
    existing = conn.execute("SELECT username FROM Users WHERE username = ?", (q,)).fetchone()
    conn.close()
    return jsonify({"available": existing is None})


@app.route("/api/session", methods=["GET"])
def api_session():
    """Return current session user (survives page refresh)."""
    user = session.get("user")
    if user:
        return jsonify({"success": True, "user": user})
    return jsonify({"success": False}), 401


@app.route("/api/logout", methods=["POST"])
def api_logout():
    """Clear the session."""
    username = session.get("user", {}).get("username", "unknown")
    session.clear()
    log_audit(username, "LOGOUT", "User logged out")
    return jsonify({"success": True})


# ---- Events ----
@app.route("/api/events", methods=["GET"])
def api_list_events():
    conn = get_db()
    events = conn.execute("""
        SELECT e.*,
               (SELECT COUNT(*) FROM Event_Volunteers ev
                WHERE ev.event_id = e.event_id AND ev.active = 1) AS staff_count,
               (SELECT COUNT(*) FROM Students s WHERE s.event_id = e.event_id) AS student_count,
               (SELECT COUNT(DISTINCT hr.student_id) FROM Health_Records hr
                WHERE hr.event_id = e.event_id) AS screened_count
        FROM Events e
        ORDER BY e.start_date DESC
    """).fetchall()
    conn.close()
    result = rows_to_list(events)
    _enrich_events_with_status(result)
    return jsonify(result)


@app.route("/api/events/<int:event_id>", methods=["GET"])
def api_get_event(event_id):
    conn = get_db()
    event = conn.execute("SELECT * FROM Events WHERE event_id = ?",
                         (event_id,)).fetchone()
    if not event:
        conn.close()
        return jsonify({"error": "Event not found"}), 404

    volunteers = conn.execute("""
        SELECT u.username, u.name, u.designation, u.role AS specialization,
               ev.joined_at, ev.category, ev.active
        FROM Event_Volunteers ev
        JOIN Users u ON ev.username = u.username
        WHERE ev.event_id = ? AND ev.active = 1
    """, (event_id,)).fetchall()

    conn.close()
    result = row_to_dict(event)
    result["staff"] = rows_to_list(volunteers)   # keep key name for compat
    return jsonify(result)


@app.route("/api/events", methods=["POST"])
def api_create_event():
    data = request.get_json(force=True)
    now = datetime.utcnow().isoformat()
    conn = get_db()
    cur = conn.cursor()

    school_id = data.get("school_id")
    school_name = data.get("school_name", "")
    school_address = data.get("school_address", "")
    poc_name = data.get("poc_name", "")
    poc_designation = data.get("poc_designation", "")
    poc_phone = data.get("poc_phone", "")
    poc_email = data.get("poc_email", "")

    if school_id:
        school_row = conn.execute(
            "SELECT * FROM Schools WHERE school_id = ?", (school_id,)
        ).fetchone()
        if school_row:
            school_name = school_row["school_name"]
            school_address = school_row["school_address"]
            poc_name = school_row["poc_name"]
            poc_designation = school_row["poc_designation"]
            poc_phone = school_row["poc_phone"]
            poc_email = school_row["poc_email"]

    cur.execute("""
        INSERT INTO Events (school_name, school_address, poc_name,
                            poc_designation, poc_phone, poc_email,
                            school_id, start_date, end_date,
                            operational_hours, tag, created_at, created_by)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING event_id
    """, (
        school_name, school_address, poc_name, poc_designation,
        poc_phone, poc_email, school_id,
        data.get("start_date", ""), data.get("end_date", ""),
        data.get("operational_hours", ""),
        data.get("tag", "Upcoming"), now,
        data.get("created_by", "admin"),
    ))
    new_id = cur.fetchone()["event_id"]
    conn.commit()
    conn.close()
    log_audit(data.get("created_by", "admin"), "CREATE_EVENT",
              f"Created event {new_id}: {school_name}")
    return jsonify({"success": True, "event_id": new_id})


@app.route("/api/events/<int:event_id>", methods=["PUT"])
def api_update_event(event_id):
    data = request.get_json(force=True)
    conn = get_db()
    fields = []
    params = []
    allowed = ["school_name", "school_address", "poc_name", "poc_designation",
               "poc_phone", "poc_email", "start_date", "end_date",
               "operational_hours", "tag"]
    for field in allowed:
        if field in data:
            fields.append(f"{field} = ?")
            params.append(data[field])
    if not fields:
        conn.close()
        return jsonify({"success": False, "message": "No fields to update"}), 400
    params.append(event_id)
    conn.execute(f"UPDATE Events SET {', '.join(fields)} WHERE event_id = ?",
                 params)
    conn.commit()
    conn.close()
    log_audit(data.get("user_id", "admin"), "UPDATE_EVENT",
              f"Updated event {event_id}")
    return jsonify({"success": True})


# ---- Active Events (for specialist volunteer discovery) ----
@app.route("/api/events/active")
def api_active_events():
    """Return events that are Upcoming or Ongoing (not Completed or Cancelled).

    Status is computed dynamically from start_date/end_date vs today.
    """
    conn = get_db()
    events = conn.execute("""
        SELECT e.*,
               (SELECT COUNT(*) FROM Event_Volunteers ev
                WHERE ev.event_id = e.event_id AND ev.active = 1) AS volunteer_count,
               (SELECT COUNT(*) FROM Students s
                WHERE s.event_id = e.event_id) AS student_count,
               (SELECT COUNT(DISTINCT hr.student_id) FROM Health_Records hr
                WHERE hr.event_id = e.event_id) AS screened_count
        FROM Events e
        WHERE (e.tag IS NULL OR e.tag != 'Cancelled')
        ORDER BY e.start_date DESC
    """).fetchall()
    conn.close()

    result = rows_to_list(events)
    _enrich_events_with_status(result)

    # Only return active camps (Upcoming or Ongoing)
    active = [e for e in result if e.get('computed_status') in ('Upcoming', 'Ongoing')]
    logger.info(f"Active events query: {len(result)} total, {len(active)} active")
    return jsonify(active)


# ---- Volunteer Management (replaces old staff assignment) ----
@app.route("/api/events/<int:event_id>/volunteer", methods=["POST"])
def api_volunteer_join(event_id):
    data = request.get_json(force=True)
    username = data.get("username", "")
    category = data.get("category", "")
    now = datetime.utcnow().isoformat()
    conn = get_db()
    try:
        # Upsert: if previously left, reactivate
        existing = conn.execute(
            "SELECT * FROM Event_Volunteers WHERE event_id = ? AND username = ?",
            (event_id, username),
        ).fetchone()
        if existing:
            conn.execute(
                "UPDATE Event_Volunteers SET active = 1, joined_at = ?, category = ? "
                "WHERE event_id = ? AND username = ?",
                (now, category, event_id, username),
            )
        else:
            conn.execute(
                "INSERT INTO Event_Volunteers (event_id, username, category, joined_at, active) "
                "VALUES (?,?,?,?,1)",
                (event_id, username, category, now),
            )
        conn.commit()
    except psycopg2.IntegrityError:
        conn.rollback()
        conn.close()
        return jsonify({"success": False, "message": "Already volunteering"}), 409
    conn.close()
    log_audit(username, "VOLUNTEER_JOIN",
              f"Volunteered for event {event_id} as {category}")

    # Real-time notification
    if socketio:
        socketio.emit("volunteer_joined", {
            "event_id": event_id, "username": username, "category": category
        })

    return jsonify({"success": True})


@app.route("/api/events/<int:event_id>/volunteer", methods=["DELETE"])
def api_volunteer_leave(event_id):
    data = request.get_json(force=True)
    username = data.get("username", "")
    conn = get_db()
    conn.execute(
        "UPDATE Event_Volunteers SET active = 0 "
        "WHERE event_id = ? AND username = ?",
        (event_id, username),
    )
    conn.commit()
    conn.close()
    log_audit(username, "VOLUNTEER_LEAVE", f"Left event {event_id}")

    if socketio:
        socketio.emit("volunteer_left", {
            "event_id": event_id, "username": username
        })

    return jsonify({"success": True})


@app.route("/api/events/<int:event_id>/volunteers")
def api_event_volunteers(event_id):
    conn = get_db()
    rows = conn.execute("""
        SELECT u.username, u.name, u.designation, ev.category,
               ev.joined_at, ev.active
        FROM Event_Volunteers ev
        JOIN Users u ON ev.username = u.username
        WHERE ev.event_id = ? AND ev.active = 1
    """, (event_id,)).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


# ---- User Registration ----
@app.route("/api/users/register", methods=["POST"])
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

    if role not in ALL_ROLES:
        return jsonify({
            "success": False,
            "message": f"Role must be one of: {', '.join(ALL_ROLES)}"
        }), 400

    conn = get_db()

    # Check email uniqueness
    existing = conn.execute(
        "SELECT username FROM Users WHERE email = ?", (email,)
    ).fetchone()
    if existing:
        conn.close()
        return jsonify({"success": False, "message": "An account with this email already exists"}), 409

    # Auto-generate username (≤15 chars) and temp password (≤10 chars)
    username = generate_username(name)
    # Ensure uniqueness
    while conn.execute("SELECT username FROM Users WHERE username = ?", (username,)).fetchone():
        username = generate_username(name)

    temp_password = generate_password(10)

    conn.execute(
        "INSERT INTO Users (username, password, email, role, name, designation, specialization) "
        "VALUES (?,?,?,?,?,?,?)",
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
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO Schools (school_name, school_address, poc_username,
               poc_name, poc_designation, poc_phone, poc_email, created_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING school_id""",
            (school_name, school_address, username, name,
             poc_designation, poc_phone, poc_email, now),
        )
        school_id = cur.fetchone()["school_id"]

    conn.commit()
    conn.close()
    log_audit(admin_user, "REGISTER_USER",
              f"Registered {role} user: {username} ({name}, {email})")

    # Send welcome email with credentials
    role_display = role.replace('_', ' ')
    email_sent = send_email(
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
        "email_sent": email_sent,
    }
    if school_id:
        result["school_id"] = school_id
    return jsonify(result)


# ---- Schools ----
@app.route("/api/schools")
def api_list_schools():
    conn = get_db()
    rows = conn.execute("SELECT * FROM Schools ORDER BY school_name").fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@app.route("/api/schools/search")
def api_search_schools():
    q = request.args.get("q", "").strip()
    conn = get_db()
    if q:
        rows = conn.execute(
            "SELECT * FROM Schools WHERE school_name LIKE ? OR poc_name LIKE ? "
            "ORDER BY school_name",
            (f"%{q}%", f"%{q}%"),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM Schools ORDER BY school_name"
        ).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


# ---- Event Stats ----
@app.route("/api/events/<int:event_id>/stats")
def api_event_stats(event_id):
    conn = get_db()

    # Optional filters
    student_class = request.args.get("student_class", "").strip()
    section = request.args.get("section", "").strip()
    gender = request.args.get("gender", "").strip()

    student_conditions = ["s.event_id = ?"]
    student_params = [event_id]
    if student_class:
        student_conditions.append("s.student_class = ?")
        student_params.append(student_class)
    if section:
        student_conditions.append("s.section = ?")
        student_params.append(section)
    if gender:
        student_conditions.append("s.gender = ?")
        student_params.append(gender)

    student_where = " AND ".join(student_conditions)

    total_students = conn.execute(
        f"SELECT COUNT(*) AS c FROM Students s WHERE {student_where}",
        student_params,
    ).fetchone()["c"]

    absent = conn.execute(
        f"SELECT COUNT(*) AS c FROM Students s WHERE {student_where} AND s.status = 'Absent'",
        student_params,
    ).fetchone()["c"]

    # Count distinct students with ANY health record (filtered)
    hr_join_where = student_where.replace("s.", "st.")
    screened = conn.execute(
        f"SELECT COUNT(DISTINCT hr.student_id) AS c FROM Health_Records hr "
        f"JOIN Students st ON hr.student_id = st.student_id "
        f"WHERE hr.event_id = ? AND {hr_join_where}",
        [event_id] + student_params,
    ).fetchone()["c"]

    # Count assessments + per-department breakdown
    normal = 0
    observation = 0
    referred = 0
    dept_breakdown = {}  # { category: { N: count, O: count, R: count } }

    records = conn.execute(
        f"SELECT hr.json_data, hr.category FROM Health_Records hr "
        f"JOIN Students st ON hr.student_id = st.student_id "
        f"WHERE hr.event_id = ? AND {hr_join_where}",
        [event_id] + student_params,
    ).fetchall()
    for r in records:
        try:
            d = json.loads(r["json_data"])
            a = d.get("status", d.get("assessment", ""))
            cat = r["category"] or "Other"
            if cat not in dept_breakdown:
                dept_breakdown[cat] = {"N": 0, "O": 0, "R": 0}
            if a == "N":
                normal += 1
                dept_breakdown[cat]["N"] += 1
            elif a == "O":
                observation += 1
                dept_breakdown[cat]["O"] += 1
            elif a == "R":
                referred += 1
                dept_breakdown[cat]["R"] += 1
        except Exception:
            pass

    # Get individual health records (filtered)
    hr_rows = conn.execute(f"""
        SELECT hr.record_id, hr.student_id, st.name AS student_name,
               hr.doctor_id, hr.category, hr.json_data, hr.timestamp
        FROM Health_Records hr
        JOIN Students st ON hr.student_id = st.student_id
        WHERE hr.event_id = ? AND {hr_join_where}
        ORDER BY hr.timestamp DESC
    """, [event_id] + student_params).fetchall()

    # Get active volunteers (replaces old staff query)
    volunteers = conn.execute("""
        SELECT u.username, u.name, u.designation, ev.category
        FROM Event_Volunteers ev
        JOIN Users u ON ev.username = u.username
        WHERE ev.event_id = ? AND ev.active = 1
    """, (event_id,)).fetchall()

    conn.close()
    return jsonify({
        "total_students": total_students,
        "screened": screened,
        "normal": normal,
        "observation": observation,
        "referred": referred,
        "absent": absent,
        "dept_breakdown": dept_breakdown,
        "records": rows_to_list(hr_rows),
        "staff": rows_to_list(volunteers),   # keep key for frontend compat
    })


# ---- My Events (for specialists - now via Event_Volunteers) ----
@app.route("/api/events/my")
def api_my_events():
    username = request.args.get("username", "")
    conn = get_db()
    events = conn.execute("""
        SELECT e.*
        FROM Events e
        JOIN Event_Volunteers ev ON e.event_id = ev.event_id
        WHERE ev.username = ? AND ev.active = 1
        ORDER BY e.start_date DESC
    """, (username,)).fetchall()
    conn.close()
    return jsonify(rows_to_list(events))


# ---- School Events (for School POC dashboard) ----
@app.route("/api/events/school")
def api_school_events():
    username = request.args.get("username", "")
    conn = get_db()
    school = conn.execute(
        "SELECT school_id FROM Schools WHERE poc_username = ?",
        (username,),
    ).fetchone()
    if not school:
        conn.close()
        return jsonify([])
    school_id = school["school_id"]
    events = conn.execute("""
        SELECT e.*,
               (SELECT COUNT(*) FROM Students s
                WHERE s.event_id = e.event_id) AS student_count,
               (SELECT COUNT(DISTINCT hr.student_id) FROM Health_Records hr
                WHERE hr.event_id = e.event_id) AS screened_count
        FROM Events e
        WHERE e.school_id = ?
        ORDER BY e.start_date DESC
    """, (school_id,)).fetchall()
    conn.close()
    result = rows_to_list(events)
    _enrich_events_with_status(result)
    return jsonify(result)

# ---- Camp Requests ----

@app.route("/api/camp-requests", methods=["POST"])
def api_create_camp_request():
    """School POC submits a camp request."""
    data = request.get_json(force=True)
    username = data.get("username", "").strip()
    preferred_date = data.get("preferred_date", "").strip()
    if not preferred_date:
        return jsonify({"success": False, "message": "Preferred date is required"}), 400
    student_count = data.get("student_count", 0)
    try:
        student_count = int(student_count)
        if student_count <= 0:
            return jsonify({"success": False, "message": "Student count must be a positive number"}), 400
    except (ValueError, TypeError):
        return jsonify({"success": False, "message": "Student count must be a valid number"}), 400

    conn = get_db()
    school = conn.execute(
        "SELECT school_id, school_name FROM Schools WHERE poc_username = ?",
        (username,),
    ).fetchone()
    if not school:
        conn.close()
        return jsonify({"success": False, "message": "No school found for this user"}), 404

    s = row_to_dict(school)
    now = datetime.utcnow().isoformat()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO Camp_Requests
           (school_id, school_name, preferred_date, end_date,
            student_count, classes, notes, status, created_at)
           VALUES (%s,%s,%s,%s,%s,%s,%s,'Pending',%s) RETURNING request_id""",
        (
            s["school_id"], s["school_name"],
            preferred_date,
            data.get("end_date", ""),
            student_count,
            data.get("classes", ""),
            data.get("notes", ""),
            now,
        ),
    )
    new_id = cur.fetchone()["request_id"]
    conn.commit()
    conn.close()
    log_audit(username, "CREATE_CAMP_REQUEST",
              f"Camp request {new_id} submitted for {s['school_name']}")
    return jsonify({"success": True, "request_id": new_id})


@app.route("/api/camp-requests", methods=["GET"])
def api_list_camp_requests():
    """Admin: list all camp requests (optionally filter by status)."""
    status_filter = request.args.get("status", "").strip()
    conn = get_db()
    if status_filter:
        rows = conn.execute(
            "SELECT * FROM Camp_Requests WHERE status = ? ORDER BY created_at DESC",
            (status_filter,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM Camp_Requests ORDER BY created_at DESC"
        ).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@app.route("/api/camp-requests/school")
def api_school_camp_requests():
    """School POC: list their own camp requests."""
    username = request.args.get("username", "").strip()
    conn = get_db()
    school = conn.execute(
        "SELECT school_id FROM Schools WHERE poc_username = ?",
        (username,),
    ).fetchone()
    if not school:
        conn.close()
        return jsonify([])
    school_id = school["school_id"]
    rows = conn.execute(
        "SELECT * FROM Camp_Requests WHERE school_id = ? ORDER BY created_at DESC",
        (school_id,),
    ).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@app.route("/api/camp-requests/count")
def api_camp_requests_count():
    """Return count of pending camp requests (for admin badge)."""
    conn = get_db()
    row = conn.execute(
        "SELECT COUNT(*) AS c FROM Camp_Requests WHERE status = 'Pending'"
    ).fetchone()
    conn.close()
    return jsonify({"pending": row["c"] if row else 0})


@app.route("/api/camp-requests/<int:request_id>/approve", methods=["POST"])
def api_approve_camp_request(request_id):
    """Admin approves a camp request and creates a real Event."""
    sess_user = session.get("user")
    reviewer = sess_user["username"] if sess_user else "admin"
    data = request.get_json(force=True) or {}

    conn = get_db()
    req = conn.execute(
        "SELECT * FROM Camp_Requests WHERE request_id = ?", (request_id,)
    ).fetchone()
    if not req:
        conn.close()
        return jsonify({"success": False, "message": "Request not found"}), 404

    r = row_to_dict(req)
    if r["status"] != "Pending":
        conn.close()
        return jsonify({"success": False, "message": "Request is not pending"}), 409

    # Fetch school details to populate the event properly
    school_id = r["school_id"]
    school_row = None
    if school_id:
        school_row = conn.execute(
            "SELECT * FROM Schools WHERE school_id = ?", (school_id,)
        ).fetchone()

    school_name = r["school_name"]
    school_address = ""
    poc_name = ""
    poc_designation = ""
    poc_phone = ""
    poc_email = ""
    if school_row:
        sd = row_to_dict(school_row)
        school_address = sd.get("school_address", "")
        poc_name = sd.get("poc_name", "")
        poc_designation = sd.get("poc_designation", "")
        poc_phone = sd.get("poc_phone", "")
        poc_email = sd.get("poc_email", "")

    # Compute tag using existing server logic
    computed_tag = _compute_event_status(r["preferred_date"], "")

    now = datetime.utcnow().isoformat()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO Events
           (school_name, school_address, poc_name, poc_designation,
            poc_phone, poc_email, school_id, start_date, end_date,
            operational_hours, tag, created_at, created_by)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING event_id""",
        (
            school_name, school_address, poc_name, poc_designation,
            poc_phone, poc_email, school_id,
            r["preferred_date"], "",
            data.get("operational_hours", ""),
            computed_tag, now, reviewer,
        ),
    )
    new_event_id = cur.fetchone()["event_id"]

    # Mark request as Approved
    conn.execute(
        "UPDATE Camp_Requests SET status='Approved', reviewed_at=?, reviewed_by=? WHERE request_id=?",
        (now, reviewer, request_id),
    )
    conn.commit()
    conn.close()

    log_audit(reviewer, "APPROVE_CAMP_REQUEST",
              f"Approved request {request_id} -> Event {new_event_id}: {school_name}")

    email_sent = False
    if poc_email:
        subject = f"Camp Request Approved - {school_name}"
        body_html = f"""
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e2e8f0;border-radius:12px;">
            <h2 style="color:#059669;margin-top:0;">Camp Request Approved</h2>
            <p style="color:#334155;font-size:16px;">Dear {poc_name or 'School Representative'},</p>
            <p style="color:#334155;font-size:15px;line-height:1.6;">
                We are pleased to inform you that your screening camp request for <strong>{school_name}</strong> has been approved.
            </p>
            <div style="background-color:#f8fafc;padding:16px;border-radius:8px;margin:20px 0;">
                <p style="margin:0 0 8px 0;font-size:14px;color:#475569;"><strong>Scheduled Start Date:</strong> {_normalize_date(r["preferred_date"])}</p>
                <p style="margin:0 0 8px 0;font-size:14px;color:#475569;"><strong>Expected Students:</strong> {r["student_count"]}</p>
                <p style="margin:0;font-size:14px;color:#475569;"><strong>Medical Staff:</strong> AIIMS Bathinda Specialist Team</p>
            </div>
            <p style="color:#334155;font-size:15px;line-height:1.6;">
                Our team will be in touch shortly to coordinate logistics. You can log into your School POC dashboard for further details.
            </p>
            <p style="color:#64748b;font-size:14px;margin-top:30px;">
                Warm Regards,<br/>
                <strong>AIIMS Bathinda Administration</strong>
            </p>
        </div>
        """
        email_sent = send_email(poc_email, subject, body_html)

    return jsonify({"success": True, "event_id": new_event_id, "email_sent": email_sent})


@app.route("/api/camp-requests/<int:request_id>/reject", methods=["POST"])
def api_reject_camp_request(request_id):
    """Admin rejects a camp request."""
    sess_user = session.get("user")
    reviewer = sess_user["username"] if sess_user else "admin"

    conn = get_db()
    req = conn.execute(
        "SELECT * FROM Camp_Requests WHERE request_id = ?", (request_id,)
    ).fetchone()
    if not req:
        conn.close()
        return jsonify({"success": False, "message": "Request not found"}), 404

    if row_to_dict(req)["status"] != "Pending":
        conn.close()
        return jsonify({"success": False, "message": "Request is not pending"}), 409

    now = datetime.utcnow().isoformat()
    conn.execute(
        "UPDATE Camp_Requests SET status='Rejected', reviewed_at=?, reviewed_by=? WHERE request_id=?",
        (now, reviewer, request_id),
    )
    conn.commit()
    conn.close()
    log_audit(reviewer, "REJECT_CAMP_REQUEST", f"Rejected camp request {request_id}")
    return jsonify({"success": True})


# ---- Students ----
@app.route("/api/students", methods=["POST"])
def api_create_student():
    """Create a single student (used by doctor workflow and school dashboard)."""
    data = request.get_json(force=True)
    name = data.get("name", "").strip()
    age = data.get("age")
    dob = data.get("dob", "")
    gender = data.get("gender", "")
    student_class = data.get("student_class", "")
    section = data.get("section", "")
    blood_group = data.get("blood_group", "")
    father_name = data.get("father_name", "")
    phone = data.get("phone", "")
    user_id = data.get("user_id", "")
    event_id = data.get("event_id", 1)
    added_by = data.get("added_by", user_id or "")
    status = data.get("status", "Pending Examination")
    mother_name = data.get("mother_name", "")
    mother_occupation = data.get("mother_occupation", "")
    father_occupation = data.get("father_occupation", "")
    address = data.get("address", "")
    pincode = data.get("pincode", "")

    if not name:
        return jsonify({"success": False, "message": "Name is required"}), 400

    qr_hash = "".join(random.choices(string.ascii_lowercase + string.digits, k=13))
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO Students
           (event_id, name, age, dob, gender, student_class, section,
            blood_group, father_name, phone, qr_code_hash, added_by, status,
            mother_name, mother_occupation, father_occupation, address, pincode)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING student_id""",
        (event_id, name, age, dob, gender, student_class, section,
         blood_group, father_name, phone, qr_hash, added_by, status,
         mother_name, mother_occupation, father_occupation, address, pincode),
    )
    new_id = cur.fetchone()["student_id"]
    conn.commit()

    student = conn.execute(
        "SELECT * FROM Students WHERE student_id = ?", (new_id,)
    ).fetchone()
    conn.close()
    log_audit(user_id or "doctor", "CREATE_STUDENT",
              f"Created student {name} (ID {new_id})")

    # Real-time: notify all clients about the new student
    if socketio:
        socketio.emit("student_created", {
            "student_id": new_id, "event_id": event_id, "name": name,
        })

    return jsonify({"success": True, "student": row_to_dict(student)})


# ---- Bulk Student Upload ----
@app.route("/api/students/bulk", methods=["POST"])
def api_bulk_create_students():
    """Bulk create students from a list. Returns success/error arrays."""
    data = request.get_json(force=True)
    students_data = data.get("students", [])
    event_id = data.get("event_id", 1)
    added_by = data.get("added_by", "")

    success_list = []
    error_list = []

    conn = get_db()
    cur = conn.cursor()

    SYMPTOM_KEYS = [
        "symptom_rubs_eyes", "symptom_cannot_see_board", "symptom_pokes_ear",
        "symptom_breathes_mouth", "symptom_black_teeth", "symptom_bad_breath",
        "symptom_cracks_mouth", "symptom_scratches_head", "symptom_white_patches",
        "symptom_bites_nails", "symptom_headaches", "symptom_fainting",
        "symptom_breathlessness", "symptom_limping", "symptom_stammers",
        "symptom_urination", "symptom_diarrhea", "symptom_vomiting",
        "symptom_blood_stools"
    ]

    for idx, row in enumerate(students_data):
        row_num = idx + 1
        row_errors = []

        name = str(row.get("name", "")).strip()
        if not name:
            row_errors.append({"column": "name", "reason": "Name is required"})

        gender = str(row.get("gender", "")).strip().upper()
        if gender and gender not in ("M", "F"):
            row_errors.append({"column": "gender", "reason": "Must be M or F"})

        dob = str(row.get("dob", "")).strip()
        age = None
        if dob:
            dob = _normalize_date(dob)
            try:
                dt = date.fromisoformat(dob)
                today = date.today()
                age = today.year - dt.year - ((today.month, today.day) < (dt.month, dt.day))
            except (ValueError, TypeError):
                row_errors.append({"column": "dob", "reason": "Invalid date format (use DD-MM-YYYY or YYYY-MM-DD)"})

        phone = str(row.get("phone", "")).strip()
        if phone and not re.match(r'^[+]?[\d\s\-()]{7,15}$', phone):
            row_errors.append({"column": "phone", "reason": "Invalid phone number"})

        # Calculate BMI if height/weight exist
        height = str(row.get("height", "")).strip()
        weight = str(row.get("weight", "")).strip()
        bmi = ""
        if height and weight:
            try:
                h = float(height)
                w = float(weight)
                if h > 0:
                    bmi_val = w / ((h / 100) ** 2)
                    bmi = f"{bmi_val:.1f}"
            except ValueError:
                row_errors.append({"column": "vitals", "reason": "Height/Weight must be numbers"})

        if row_errors:
            error_list.append({"row": row_num, "data": row, "errors": row_errors})
            continue

        qr_hash = "".join(random.choices(string.ascii_lowercase + string.digits, k=13))
        
        # Symptoms list parsing
        symptoms_checked = []
        for sym_key in SYMPTOM_KEYS:
            val = str(row.get(sym_key, "")).strip().lower()
            if val in ("yes", "y", "true", "1"):
                # converting to human readable feature: e.g. symptom_rubs_eyes -> Rubs Eyes
                readable = sym_key.replace("symptom_", "").replace("_", " ").capitalize()
                symptoms_checked.append(readable)

        try:
            cur.execute(
                """INSERT INTO Students
                   (event_id, name, age, dob, gender, student_class, section,
                    blood_group, father_name, mother_name, father_occupation,
                    mother_occupation, address, pincode, phone, qr_code_hash,
                    added_by, status)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING student_id""",
                (
                    event_id, name, age, dob, gender,
                    str(row.get("student_class", "")).strip(),
                    str(row.get("section", "")).strip(),
                    str(row.get("blood_group", "")).strip(),
                    str(row.get("father_name", "")).strip(),
                    str(row.get("mother_name", "")).strip(),
                    str(row.get("father_occupation", "")).strip(),
                    str(row.get("mother_occupation", "")).strip(),
                    str(row.get("address", "")).strip(),
                    str(row.get("pincode", "")).strip(),
                    phone, qr_hash, added_by, "Pending Examination",
                ),
            )
            student_id = cur.fetchone()["student_id"]
            
            ts = datetime.utcnow().isoformat()
            symptoms_json = json.dumps(symptoms_checked)
            cur.execute(
                """INSERT INTO Student_General_Info
                   (student_id, event_id, height, weight, bmi, symptoms_json, filled_by, updated_at)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (student_id, event_id, height, weight, bmi, symptoms_json, added_by, ts)
            )

            success_list.append({"row": row_num, "student_id": student_id, "name": name})
            conn.commit()
        except Exception as exc:
            conn.rollback()
            error_list.append({"row": row_num, "data": row, "errors": [{"column": "db", "reason": str(exc)}]})

    conn.commit()
    conn.close()
    log_audit(added_by or "school", "BULK_CREATE_STUDENTS",
              f"Bulk uploaded {len(success_list)} students for event {event_id}")

    # Real-time: notify all clients about the bulk upload
    if socketio and success_list:
        socketio.emit("students_bulk_created", {
            "event_id": event_id, "count": len(success_list),
        })

    return jsonify({
        "success": True, "inserted": success_list, "errors": error_list
    })


# ---- CSV Template Download ----
@app.route("/api/students/csv-template")
def api_csv_template():
    """Return a CSV template for bulk student upload."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "name", "dob", "gender", "student_class", "section", "blood_group",
        "father_name", "father_occupation", "mother_name", "mother_occupation",
        "address", "pincode", "phone", "height", "weight",
        "symptom_rubs_eyes", "symptom_cannot_see_board", "symptom_pokes_ear",
        "symptom_breathes_mouth", "symptom_black_teeth", "symptom_bad_breath",
        "symptom_cracks_mouth", "symptom_scratches_head", "symptom_white_patches",
        "symptom_bites_nails", "symptom_headaches", "symptom_fainting",
        "symptom_breathlessness", "symptom_limping", "symptom_stammers",
        "symptom_urination", "symptom_diarrhea", "symptom_vomiting",
        "symptom_blood_stools"
    ])
    writer.writerow([
        "John Doe", "2012-05-15", "M", "8", "A", "O+",
        "James Doe", "Engineer", "Jane Doe", "Teacher",
        "123 Street", "110001", "9876543210", "150", "45",
        "No", "No", "No", "No", "No", "No", "No", "No", "No",
        "No", "No", "No", "No", "No", "No", "No", "No", "No", "No"
    ])
    csv_content = output.getvalue()
    return Response(
        csv_content,
        mimetype="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=student_upload_template.csv"
        },
    )


@app.route("/api/students/search")
def api_students_search():
    query = request.args.get("query", "").strip()
    student_class = request.args.get("class", "").strip()
    section = request.args.get("section", "").strip()
    gender = request.args.get("gender", "").strip()
    examined = request.args.get("examined", "")   # '1' or '0'
    referred = request.args.get("referred", "")   # '1'
    assessment = request.args.get("assessment", "") # 'N', 'O', 'R'
    event_id = request.args.get("event_id", "").strip()

    conn = get_db()

    conditions = []
    params = []

    if event_id:
        conditions.append("s.event_id = ?")
        params.append(int(event_id))

    if query:
        # Try to parse as int for student_id match, otherwise skip
        try:
            sid_val = int(query)
            conditions.append(
                "(s.name ILIKE ? OR s.student_id = ? OR s.phone ILIKE ? "
                "OR s.student_class ILIKE ? OR s.section ILIKE ?)"
            )
            params.extend([f"%{query}%", sid_val, f"%{query}%",
                            f"%{query}%", f"%{query}%"])
        except ValueError:
            conditions.append(
                "(s.name ILIKE ? OR s.phone ILIKE ? "
                "OR s.student_class ILIKE ? OR s.section ILIKE ?)"
            )
            params.extend([f"%{query}%", f"%{query}%",
                            f"%{query}%", f"%{query}%"])

    if student_class:
        conditions.append("s.student_class = ?")
        params.append(student_class)

    if section:
        conditions.append("s.section = ?")
        params.append(section)

    if gender:
        conditions.append("s.gender = ?")
        params.append(gender)

    where = (" AND " + " AND ".join(conditions)) if conditions else ""

    sql = f"""
        SELECT s.*,
               CASE WHEN hr.hr_count > 0 THEN 1 ELSE 0 END AS is_examined,
               hr.examined_categories,
               hr.latest_record_json
        FROM Students s
        LEFT JOIN (
            SELECT student_id,
                   COUNT(*) AS hr_count,
                   STRING_AGG(DISTINCT category, ',') AS examined_categories,
                   (
                       SELECT json_data
                       FROM Health_Records hr2
                       WHERE hr2.student_id = Health_Records.student_id
                       ORDER BY timestamp DESC LIMIT 1
                   ) AS latest_record_json
            FROM Health_Records
            GROUP BY student_id
        ) hr ON s.student_id = hr.student_id
        WHERE 1=1 {where}
        ORDER BY s.name
    """

    rows = conn.execute(sql, params).fetchall()
    results = rows_to_list(rows)

    # Post-process for assessment parsing
    for r in results:
        r['assessment'] = ''
        json_str = r.get('latest_record_json') or r.get('latest_assessment')
        if json_str:
            try:
                d = json.loads(json_str)
                r['assessment'] = d.get('status', '') or d.get('assessment', '')
            except Exception:
                pass

    # Post-filter
    if examined == '1':
        results = [r for r in results if r.get('is_examined')]
    elif examined == '0':
        results = [r for r in results if not r.get('is_examined')]

    if referred == '1':
        results = [r for r in results if r.get('assessment') == 'R']

    if assessment:
        results = [r for r in results if r.get('assessment') == assessment]

    conn.close()
    return jsonify(results)


@app.route("/api/students/<int:student_id>/status", methods=["PUT"])
def api_update_student_status(student_id):
    """Update student basic status (like marking them absent)."""
    data = request.get_json(force=True)
    new_status = data.get("status", "Pending Examination")
    conn = get_db()
    conn.execute(
        "UPDATE Students SET status = ? WHERE student_id = ?",
        (new_status, student_id)
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@app.route("/api/students/<int:student_id>")
def api_student_by_id(student_id):
    conn = get_db()
    student = conn.execute(
        "SELECT * FROM Students WHERE student_id = ?", (student_id,)
    ).fetchone()
    conn.close()
    return jsonify(row_to_dict(student))


@app.route("/api/students/<int:student_id>", methods=["PUT"])
def api_update_student(student_id):
    """Update student demographics (used by teacher/admin for general info autosave)."""
    data = request.get_json(force=True)
    conn = get_db()
    allowed = [
        "name", "age", "dob", "gender", "student_class", "section",
        "blood_group", "father_name", "phone", "mother_name",
        "mother_occupation", "father_occupation", "address", "pincode",
    ]
    fields = []
    params = []
    for field in allowed:
        if field in data:
            fields.append(f"{field} = ?")
            params.append(data[field])
    if not fields:
        conn.close()
        return jsonify({"success": False, "message": "No fields"}), 400
    params.append(student_id)
    conn.execute(
        f"UPDATE Students SET {', '.join(fields)} WHERE student_id = ?",
        params,
    )
    conn.commit()
    student = conn.execute(
        "SELECT * FROM Students WHERE student_id = ?", (student_id,)
    ).fetchone()
    conn.close()
    log_audit(data.get("user_id", "teacher"), "UPDATE_STUDENT",
              f"Updated student {student_id}")
    return jsonify({"success": True, "student": row_to_dict(student)})


@app.route("/api/students/<int:student_id>/general-info", methods=["PUT"])
def api_upsert_general_info(student_id):
    """Upsert vitals + symptoms for a student (autosave endpoint)."""
    data = request.get_json(force=True)
    event_id = data.get("event_id", 1)
    height = data.get("height", "")
    weight = data.get("weight", "")
    bmi = data.get("bmi", "")
    symptoms_json = json.dumps(data.get("symptoms", []))
    filled_by = data.get("filled_by", "")
    ts = datetime.utcnow().isoformat()

    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM Student_General_Info "
        "WHERE student_id = ? AND event_id = ?",
        (student_id, event_id),
    ).fetchone()

    if existing:
        conn.execute(
            "UPDATE Student_General_Info "
            "SET height=?, weight=?, bmi=?, symptoms_json=?, filled_by=?, updated_at=? "
            "WHERE id = ?",
            (height, weight, bmi, symptoms_json, filled_by, ts, existing["id"]),
        )
    else:
        conn.execute(
            "INSERT INTO Student_General_Info "
            "(student_id, event_id, height, weight, bmi, symptoms_json, filled_by, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (student_id, event_id, height, weight, bmi, symptoms_json, filled_by, ts),
        )

    conn.commit()
    conn.close()
    log_audit(filled_by, "UPDATE_GENERAL_INFO",
              f"Updated general info for student {student_id}")
    return jsonify({"success": True})


@app.route("/api/students/<int:student_id>/general-info")
def api_get_general_info(student_id):
    """Get vitals + symptoms for a student."""
    event_id = request.args.get("event_id", "1")
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM Student_General_Info "
        "WHERE student_id = ? AND event_id = ?",
        (student_id, int(event_id)),
    ).fetchone()
    conn.close()
    if row:
        d = row_to_dict(row)
        try:
            d["symptoms"] = json.loads(d.get("symptoms_json", "[]"))
        except Exception:
            d["symptoms"] = []
        return jsonify(d)
    return jsonify({"height": "", "weight": "", "bmi": "", "symptoms": []})


@app.route("/api/students/<int:student_id>/all-records")
def api_student_all_records(student_id):
    """Get all specialist records + general info for a student (cross-view)."""
    event_id = request.args.get("event_id", "1")
    conn = get_db()

    # Student demographics
    student = conn.execute(
        "SELECT * FROM Students WHERE student_id = ?", (student_id,)
    ).fetchone()

    # General info
    gen = conn.execute(
        "SELECT * FROM Student_General_Info "
        "WHERE student_id = ? AND event_id = ?",
        (student_id, int(event_id)),
    ).fetchone()

    # All health records
    records = conn.execute(
        "SELECT category, json_data, timestamp, doctor_id "
        "FROM Health_Records WHERE student_id = ? AND event_id = ? "
        "ORDER BY timestamp DESC",
        (student_id, int(event_id)),
    ).fetchall()
    conn.close()

    gen_dict = row_to_dict(gen) if gen else {}
    if gen_dict:
        try:
            raw_sym = json.loads(gen_dict.get("symptoms_json", "[]"))
            clean_sym = []
            if isinstance(raw_sym, list):
                for item in raw_sym:
                    if isinstance(item, dict) and "name" in item:
                        clean_sym.append(item["name"])
                    elif isinstance(item, str):
                        clean_sym.append(item)
            gen_dict["symptoms"] = clean_sym
        except Exception:
            gen_dict["symptoms"] = []

    records_list = []
    for r in records:
        rd = row_to_dict(r)
        try:
            parsed = json.loads(rd.get("json_data", "{}"))
            rd["parsed_data"] = parsed
        except Exception:
            rd["parsed_data"] = {}
            
        records_list.append(rd)

    return jsonify({
        "student": row_to_dict(student),
        "general_info": gen_dict,
        "records": records_list,
    })


# ---- Health Records ----
@app.route("/api/health-records", methods=["POST"])
def api_create_health_record():
    data = request.get_json(force=True)
    student_id = data.get("student_id")
    event_id = data.get("event_id", data.get("camp_id", 1))
    doctor_id = data.get("doctor_id")
    category = data.get("category")
    json_data = data.get("json_data")
    ts = datetime.utcnow().isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO Health_Records "
        "(student_id, event_id, doctor_id, category, json_data, timestamp) "
        "VALUES (?,?,?,?,?,?)",
        (student_id, event_id, doctor_id, category, json_data, ts),
    )
    conn.commit()
    conn.close()
    log_audit(doctor_id, f"INSERT_{category.upper()}",
              f"Added record for student {student_id}")
    return jsonify({"success": True})


@app.route("/api/health-records/exam", methods=["POST"])
def api_save_full_exam():
    """Save a specialist examination (upsert by student + event + category).
    Enforces role-based ownership: the doctor's role must match specialist_category.
    """
    data = request.get_json(force=True)
    student_id = data.get("student_id")
    event_id = data.get("event_id", data.get("camp_id", 1))
    doctor_id = data.get("doctor_id", "doctor")
    specialist_category = data.get("specialist_category", "FullExam")
    exam_data = data.get("exam_data", {})
    ts = datetime.utcnow().isoformat()
    json_str = json.dumps(exam_data) if isinstance(exam_data, dict) else str(exam_data)

    # Enforce role-based ownership: doctor's role must match specialist_category
    conn = get_db()
    user_row = conn.execute(
        "SELECT role FROM Users WHERE username = ?", (doctor_id,)
    ).fetchone()
    if user_row and specialist_category != "FullExam":
        user_role = user_row["role"]
        if user_role != specialist_category and user_role != "Admin":
            conn.close()
            return jsonify({
                "success": False,
                "message": f"Access denied: your role ({user_role}) cannot "
                           f"save {specialist_category} records."
            }), 403

    # Upsert by student + event + specialist category
    # Use try/except for concurrency safety — two doctors of the same
    # specialty could race on the same student record.
    try:
        existing = conn.execute(
            "SELECT record_id FROM Health_Records "
            "WHERE student_id = ? AND event_id = ? AND category = ?",
            (student_id, event_id, specialist_category),
        ).fetchone()

        if existing:
            conn.execute(
                "UPDATE Health_Records SET json_data = ?, timestamp = ?, doctor_id = ? "
                "WHERE record_id = ?",
                (json_str, ts, doctor_id, existing["record_id"]),
            )
            record_id = existing["record_id"]
        else:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO Health_Records "
                "(student_id, event_id, doctor_id, category, json_data, timestamp) "
                "VALUES (%s,%s,%s,%s,%s,%s) RETURNING record_id",
                (student_id, event_id, doctor_id, specialist_category, json_str, ts),
            )
            record_id = cur.fetchone()["record_id"]

        conn.commit()
    except Exception as exc:
        conn.rollback()
        # On concurrent insert conflict, retry as update
        logger.warning(
            f"Exam save conflict for student={student_id}, "
            f"event={event_id}, category={specialist_category}: {exc}"
        )
        try:
            existing = conn.execute(
                "SELECT record_id FROM Health_Records "
                "WHERE student_id = ? AND event_id = ? AND category = ?",
                (student_id, event_id, specialist_category),
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE Health_Records SET json_data = ?, timestamp = ?, doctor_id = ? "
                    "WHERE record_id = ?",
                    (json_str, ts, doctor_id, existing["record_id"]),
                )
                record_id = existing["record_id"]
                conn.commit()
            else:
                conn.close()
                logger.error(f"Exam save failed after retry for student {student_id}")
                return jsonify({"success": False, "message": "Save failed, please retry"}), 500
        except Exception as retry_exc:
            conn.close()
            logger.error(f"Exam save retry failed: {retry_exc}")
            return jsonify({"success": False, "message": "Save failed, please retry"}), 500

    conn.close()
    log_audit(doctor_id, "SAVE_EXAM",
              f"Saved {specialist_category} exam for student {student_id}")

    # Real-time: notify other specialists
    if socketio:
        socketio.emit("exam_saved", {
            "student_id": student_id,
            "event_id": event_id,
            "category": specialist_category,
            "doctor_id": doctor_id,
        })

    return jsonify({"success": True, "record_id": record_id})


@app.route("/api/health-records/<int:student_id>")
def api_get_health_records(student_id):
    conn = get_db()
    rows = conn.execute(
        "SELECT category, json_data, timestamp, doctor_id "
        "FROM Health_Records WHERE student_id = ? ORDER BY timestamp DESC",
        (student_id,),
    ).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


# ---- Audit Logs ----
@app.route("/api/admin/audit-logs")
def api_admin_audit_logs():
    conn = get_db()
    logs = conn.execute(
        "SELECT * FROM Audit_Logs ORDER BY timestamp DESC LIMIT 50"
    ).fetchall()
    conn.close()
    return jsonify(rows_to_list(logs))


# ---- Digitise (MedDigitizer Streamlit launcher) ----
# Removed: MedDigitizer integration has been deleted


# ---------------------------------------------------------------------------
# Socket.IO event handlers
# ---------------------------------------------------------------------------
if HAS_SOCKETIO and socketio:
    @socketio.on("connect")
    def handle_connect():
        logger.info("[socket.io] Client connected")

    @socketio.on("disconnect")
    def handle_disconnect():
        logger.info("[socket.io] Client disconnected")



# ---------------------------------------------------------------------------
# Admin Logs API
# ---------------------------------------------------------------------------
@app.route("/api/admin/logs", methods=["GET"])
def api_admin_logs():
    """Return audit log entries — Admin only."""
    sess_user = session.get("user")
    if not sess_user or sess_user.get("role") != "Admin":
        return jsonify({"error": "Unauthorized"}), 403

    limit = min(int(request.args.get("limit", 200)), 500)
    action_filter = request.args.get("action", "").strip()
    user_filter = request.args.get("user_id", "").strip()

    conn = get_db()
    conditions = []
    params: list = []

    if action_filter:
        conditions.append("action = %s")
        params.append(action_filter)
    if user_filter:
        conditions.append("user_id ILIKE %s")
        params.append(f"%{user_filter}%")

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    params.append(limit)

    rows = conn.execute(
        f"SELECT log_id, timestamp, user_id, action, details "
        f"FROM Audit_Logs {where_clause} ORDER BY timestamp DESC LIMIT %s",
        params,
    ).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


# ---------------------------------------------------------------------------
# Serve React SPA from dist/ (built by Vite)
# ---------------------------------------------------------------------------
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path):
    if not os.path.isdir(DIST_DIR):
        return Response(
            "<html><body style='font-family:sans-serif;padding:40px;"
            "background:#0f172a;color:#e2e8f0;'>"
            "<h1 style='color:#22d3ee'>AIIMS Bathinda - Backend Running &#10004;</h1>"
            "<p>The Flask API server is running, but the React frontend has "
            "not been built yet.</p>"
            "<p>Run this command to build the frontend:</p>"
            "<pre style='background:#1e293b;padding:16px;border-radius:8px;"
            "color:#38bdf8'>npm run build</pre>"
            "<p>Then refresh this page.</p>"
            "<hr style='border-color:#334155'>"
            "<p style='color:#94a3b8'>API endpoints are already available at "
            "<code>/api/*</code></p>"
            "</body></html>",
            content_type="text/html",
        )

    full_path = os.path.join(DIST_DIR, path)
    if path and os.path.isfile(full_path):
        if path == "sw.js" or path.endswith("sw.js"):
            response = send_from_directory(DIST_DIR, path)
            response.headers["Service-Worker-Allowed"] = "/"
            response.headers["Content-Type"] = "application/javascript"
            return response
        if path == "manifest.json" or path.endswith(".webmanifest"):
            return send_from_directory(DIST_DIR, path, mimetype="application/manifest+json")
        return send_from_directory(DIST_DIR, path)

    return send_from_directory(DIST_DIR, "index.html")


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    try:
        init_db()
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")

    logger.info(f"")
    logger.info(f"  AIIMS Bathinda - Flask Server")
    logger.info(f"  =============================")
    logger.info(f"  Server running on: http://localhost:{PORT}")
    logger.info(f"  Database:          {DB_PATH}")
    logger.info(f"  Frontend (dist/):  {'FOUND' if os.path.isdir(DIST_DIR) else 'NOT BUILT - run: npm run build'}")
    logger.info(f"  Socket.IO:         {'ENABLED' if HAS_SOCKETIO else 'DISABLED (pip install flask-socketio)'}")
    logger.info(f"")

    if HAS_SOCKETIO and socketio:
        socketio.run(app, host="0.0.0.0", port=PORT, debug=False,
                     allow_unsafe_werkzeug=True)
    else:
        app.run(host="0.0.0.0", port=PORT, debug=False)
