import os
import io
import csv
import json
import random
import string
import subprocess
import sys
import re
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, date, timedelta
from urllib.parse import urlparse

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
    """)

    conn.commit()

    # Idempotent migrations: add columns if missing
    user_cols = ["designation TEXT DEFAULT ''", "specialization TEXT DEFAULT ''",
                 "email TEXT", "otp_code TEXT", "otp_expires TEXT"]
    for col_def in user_cols:
        try:
            cur.execute(f"ALTER TABLE Users ADD COLUMN {col_def}")
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
            cur.execute(f"ALTER TABLE Students ADD COLUMN {col_def}")
            conn.commit()
        except Exception:
            conn.rollback()

    try:
        cur.execute("ALTER TABLE Events ADD COLUMN school_id INTEGER")
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
            "INSERT INTO Users (username,password,role,name,designation,specialization) "
            "VALUES (%s,%s,%s,%s,%s,%s)",
            ("Admin", "admin", "Admin", "Admin", "", ""),
        )

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
    """Generate a username from a name: 'Dr. Anil Kumar' → 'anil.kumar.x7k'."""
    # Strip titles
    clean = re.sub(r'^(dr\.?|mr\.?|mrs\.?|ms\.?|prof\.?)\s*', '', name.strip(), flags=re.IGNORECASE)
    parts = re.sub(r'[^a-zA-Z\s]', '', clean).lower().split()
    base = '.'.join(parts[:3]) if parts else 'user'
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=3))
    return f"{base}.{suffix}"


def send_email(to_email: str, subject: str, body_html: str):
    """Send an email via Gmail SMTP. Requires SMTP_PASSWORD env var."""
    smtp_pass = os.environ.get('SMTP_PASSWORD', '')
    sender = os.environ.get('SMTP_EMAIL', '')
    if not smtp_pass or not sender:
        print(f"[EMAIL SKIPPED] No SMTP_PASSWORD set. Would send to {to_email}: {subject}")
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
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")
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
    # Update username in all related tables
    conn.execute("UPDATE Users SET username = ? WHERE username = ?", (new_username, old_username))
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
    return jsonify(rows_to_list(events))


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
        WHERE e.tag IN ('Upcoming', 'Ongoing')
        ORDER BY e.start_date DESC
    """).fetchall()
    conn.close()
    return jsonify(rows_to_list(events))


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
    """Admin registers a new user. No password — user sets it on first login via OTP."""
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

    # Auto-generate username from name
    username = generate_username(name)
    # Ensure uniqueness
    while conn.execute("SELECT username FROM Users WHERE username = ?", (username,)).fetchone():
        username = generate_username(name)

    conn.execute(
        "INSERT INTO Users (username, password, email, role, name, designation, specialization) "
        "VALUES (?,?,?,?,?,?,?)",
        (username, None, email, role, name, designation, specialization),
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
    result = {"success": True, "username": username, "email": email}
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
    total_students = conn.execute(
        "SELECT COUNT(*) AS c FROM Students WHERE event_id = ?",
        (event_id,),
    ).fetchone()["c"]

    # Count distinct students with ANY health record
    screened = conn.execute(
        "SELECT COUNT(DISTINCT student_id) AS c FROM Health_Records "
        "WHERE event_id = ?",
        (event_id,),
    ).fetchone()["c"]

    # Count assessments (check both FullExam and specialist-category records)
    normal = 0
    observation = 0
    referred = 0
    records = conn.execute(
        "SELECT json_data FROM Health_Records WHERE event_id = ?",
        (event_id,),
    ).fetchall()
    for r in records:
        try:
            d = json.loads(r["json_data"])
            a = d.get("assessment", "")
            if a == "N":
                normal += 1
            elif a == "O":
                observation += 1
            elif a == "R":
                referred += 1
        except Exception:
            pass

    # Get individual health records
    hr_rows = conn.execute("""
        SELECT hr.record_id, hr.student_id, s.name AS student_name,
               hr.doctor_id, hr.category, hr.json_data, hr.timestamp
        FROM Health_Records hr
        JOIN Students s ON hr.student_id = s.student_id
        WHERE hr.event_id = ?
        ORDER BY hr.timestamp DESC
    """, (event_id,)).fetchall()

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
    return jsonify(rows_to_list(events))


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
        if dob:
            try:
                date.fromisoformat(dob)
            except (ValueError, TypeError):
                row_errors.append({"column": "dob",
                                   "reason": "Invalid date format (use YYYY-MM-DD)"})

        phone = str(row.get("phone", "")).strip()
        if phone and not re.match(r'^[+]?[\d\s\-()]{7,15}$', phone):
            row_errors.append({"column": "phone",
                               "reason": "Invalid phone number"})

        if row_errors:
            error_list.append({
                "row": row_num, "data": row, "errors": row_errors
            })
            continue

        age = row.get("age")
        if age is not None:
            try:
                age = int(age)
            except (ValueError, TypeError):
                age = None

        qr_hash = "".join(
            random.choices(string.ascii_lowercase + string.digits, k=13)
        )
        try:
            cur.execute(
                """INSERT INTO Students
                   (event_id, name, age, dob, gender, student_class, section,
                    blood_group, father_name, phone, qr_code_hash,
                    added_by, status)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING student_id""",
                (
                    event_id, name, age, dob, gender,
                    str(row.get("student_class", "")).strip(),
                    str(row.get("section", "")).strip(),
                    str(row.get("blood_group", "")).strip(),
                    str(row.get("father_name", "")).strip(),
                    phone, qr_hash, added_by, "Pending Examination",
                ),
            )
            success_list.append({
                "row": row_num, "student_id": cur.fetchone()["student_id"], "name": name
            })
            conn.commit()
        except Exception as exc:
            conn.rollback()
            error_list.append({
                "row": row_num, "data": row,
                "errors": [{"column": "db", "reason": str(exc)}],
            })

    conn.commit()
    conn.close()
    log_audit(added_by or "school", "BULK_CREATE_STUDENTS",
              f"Bulk uploaded {len(success_list)} students for event {event_id}")
    return jsonify({
        "success": True, "inserted": success_list, "errors": error_list
    })


# ---- CSV Template Download ----
@app.route("/api/students/csv-template")
def api_csv_template():
    """Return a CSV template for bulk student upload."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["name", "gender", "dob", "age", "student_class",
                     "section", "blood_group", "father_name", "phone"])
    writer.writerow(["John Doe", "M", "2012-05-15", "13", "8", "A",
                     "B+", "James Doe", "9876543210"])
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

    # Per-category exam status: which specialist categories have records
    sql = f"""
        SELECT s.*,
               CASE WHEN hr.hr_count > 0 THEN 1 ELSE 0 END AS is_examined,
               hr.examined_categories
        FROM Students s
        LEFT JOIN (
            SELECT student_id,
                   COUNT(*) AS hr_count,
                   STRING_AGG(DISTINCT category, ',') AS examined_categories
            FROM Health_Records
            GROUP BY student_id
        ) hr ON s.student_id = hr.student_id
        WHERE 1=1 {where}
        ORDER BY s.name
        LIMIT 100
    """

    rows = conn.execute(sql, params).fetchall()
    results = rows_to_list(rows)

    # Post-filter for examined / referred
    if examined == '1':
        results = [r for r in results if r.get('is_examined')]
    elif examined == '0':
        results = [r for r in results if not r.get('is_examined')]

    if referred == '1':
        # Need to check json_data for any record with assessment='R'
        filtered = []
        for r in results:
            sid = r.get('student_id')
            recs = conn.execute(
                "SELECT json_data FROM Health_Records WHERE student_id = ?",
                (sid,),
            ).fetchall()
            for rec in recs:
                try:
                    d = json.loads(rec['json_data'] or '{}')
                    if d.get('assessment') == 'R':
                        filtered.append(r)
                        break
                except Exception:
                    pass
        results = filtered

    conn.close()
    return jsonify(results)


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
            gen_dict["symptoms"] = json.loads(gen_dict.get("symptoms_json", "[]"))
        except Exception:
            gen_dict["symptoms"] = []

    records_list = []
    for r in records:
        rd = row_to_dict(r)
        try:
            rd["parsed_data"] = json.loads(rd.get("json_data", "{}"))
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
digitise_process = None


@app.route("/api/digitise/launch", methods=["POST"])
def api_digitise_launch():
    global digitise_process
    DIGITISE_PORT = 8501

    if digitise_process is not None and digitise_process.poll() is None:
        return jsonify({
            "success": True,
            "url": f"http://localhost:{DIGITISE_PORT}",
            "message": "MedDigitizer is already running.",
        })

    digitise_path = os.path.join(BASE_DIR, "Digitise")
    try:
        digitise_process = subprocess.Popen(
            [
                sys.executable, "-m", "streamlit", "run", "app.py",
                "--server.port", str(DIGITISE_PORT),
                "--server.headless", "true",
            ],
            cwd=digitise_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        data = request.get_json(force=True) if request.is_json else {}
        log_audit(data.get("user_id", "system"), "LAUNCH_DIGITISE",
                  "Launched MedDigitizer Streamlit app")
        return jsonify({
            "success": True,
            "url": f"http://localhost:{DIGITISE_PORT}",
            "message": "MedDigitizer is starting...",
        })
    except Exception as exc:
        return jsonify({
            "success": False,
            "message": f"Failed to launch MedDigitizer: {exc}"
        }), 500


# ---------------------------------------------------------------------------
# Socket.IO event handlers
# ---------------------------------------------------------------------------
if HAS_SOCKETIO and socketio:
    @socketio.on("connect")
    def handle_connect():
        print(f"[socket.io] Client connected")

    @socketio.on("disconnect")
    def handle_disconnect():
        print(f"[socket.io] Client disconnected")


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
        return send_from_directory(DIST_DIR, path)

    return send_from_directory(DIST_DIR, "index.html")


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------

try:
    init_db()
    print("Database initialized successfully.")
except Exception as e:
    print(f"Error initializing database: {e}")

if __name__ == "__main__":
    print(f"")
    print(f"  AIIMS Bathinda - Flask Server")
    print(f"  =============================")
    print(f"  Server running on: http://localhost:{PORT}")
    print(f"  Database:          {DB_PATH}")
    print(f"  Frontend (dist/):  {'FOUND' if os.path.isdir(DIST_DIR) else 'NOT BUILT - run: npm run build'}")
    print(f"  Socket.IO:         {'ENABLED' if HAS_SOCKETIO else 'DISABLED (pip install flask-socketio)'}")
    print(f"")

    if HAS_SOCKETIO and socketio:
        socketio.run(app, host="0.0.0.0", port=PORT, debug=False,
                     allow_unsafe_werkzeug=True)
    else:
        app.run(host="0.0.0.0", port=PORT, debug=False)
