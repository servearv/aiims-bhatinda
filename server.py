import os
import json
import random
import string
import sqlite3
import subprocess
import sys
from datetime import datetime

from flask import Flask, request, jsonify, send_from_directory, Response

# ---------------------------------------------------------------------------
# App & Config
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, "dist")

app = Flask(__name__, static_folder=None)   # we handle static files ourselves
app.config["JSON_SORT_KEYS"] = False

PORT = 3000
DB_PATH = os.path.join(BASE_DIR, "database.db")

# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def get_db():
    """Return a new connection (with row-factory) for the current request."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Create the schema and seed initial data (idempotent)."""
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

        CREATE TABLE IF NOT EXISTS Events (
            event_id INTEGER PRIMARY KEY AUTOINCREMENT,
            school_name TEXT NOT NULL,
            school_address TEXT DEFAULT '',
            poc_name TEXT DEFAULT '',
            poc_designation TEXT DEFAULT '',
            poc_phone TEXT DEFAULT '',
            poc_email TEXT DEFAULT '',
            start_date TEXT NOT NULL,
            end_date TEXT DEFAULT '',
            operational_hours TEXT DEFAULT '',
            tag TEXT DEFAULT 'Upcoming',
            created_at TEXT,
            created_by TEXT,
            FOREIGN KEY(created_by) REFERENCES Users(username)
        );

        CREATE TABLE IF NOT EXISTS Event_Staff (
            event_id INTEGER,
            username TEXT,
            assigned_at TEXT,
            PRIMARY KEY (event_id, username),
            FOREIGN KEY(event_id) REFERENCES Events(event_id),
            FOREIGN KEY(username) REFERENCES Users(username)
        );

        CREATE TABLE IF NOT EXISTS Students (
            student_id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            FOREIGN KEY(event_id) REFERENCES Events(event_id)
        );

        CREATE TABLE IF NOT EXISTS Health_Records (
            record_id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            user_id TEXT,
            action TEXT,
            details TEXT,
            FOREIGN KEY(user_id) REFERENCES Users(username)
        );
    """)

    # Idempotent migration: add designation column to Users if missing
    try:
        cur.execute("ALTER TABLE Users ADD COLUMN designation TEXT DEFAULT ''")
    except Exception:
        pass

    # Idempotent migration: add specialization column to Users if missing
    try:
        cur.execute("ALTER TABLE Users ADD COLUMN specialization TEXT DEFAULT ''")
    except Exception:
        pass

    # Idempotent migration: add new columns to Students if they don't exist
    student_cols = ["dob TEXT", "student_class TEXT", "section TEXT",
                    "blood_group TEXT", "father_name TEXT", "phone TEXT",
                    "event_id INTEGER"]
    for col_def in student_cols:
        try:
            cur.execute(f"ALTER TABLE Students ADD COLUMN {col_def}")
        except Exception:
            pass

    # Idempotent migration: rename school_id to event_id alias in Students (keep backward compat)
    # We keep the column if exists; new inserts use event_id

    # Seed only when Users table is empty
    row = cur.execute("SELECT COUNT(*) AS count FROM Users").fetchone()
    if row["count"] == 0:
        cur.execute("INSERT INTO Users (username,password,role,name,designation,specialization) VALUES (?,?,?,?,?,?)",
                   ("Admin", "admin", "Admin", "Admin", "", ""))

    conn.commit()
    conn.close()


def log_audit(user_id: str, action: str, details: str):
    conn = get_db()
    conn.execute(
        "INSERT INTO Audit_Logs (timestamp, user_id, action, details) VALUES (?,?,?,?)",
        (datetime.utcnow().isoformat(), user_id, action, details),
    )
    conn.commit()
    conn.close()


def row_to_dict(row):
    """Convert a sqlite3.Row to a plain dict."""
    if row is None:
        return None
    return dict(row)


def rows_to_list(rows):
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

# ---- Auth ----
@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(force=True)
    username = data.get("username", "")
    password = data.get("password", "")
    conn = get_db()
    user = conn.execute(
        "SELECT username, role, name, designation FROM Users WHERE username = ? AND password = ?",
        (username, password),
    ).fetchone()
    conn.close()
    if user:
        log_audit(username, "LOGIN", "User logged in successfully")
        return jsonify({"success": True, "user": row_to_dict(user)})
    return jsonify({"success": False, "message": "Invalid credentials"}), 401


# ---- Events ----
@app.route("/api/events", methods=["GET"])
def api_list_events():
    conn = get_db()
    events = conn.execute("""
        SELECT e.*,
               (SELECT COUNT(*) FROM Event_Staff es WHERE es.event_id = e.event_id) AS staff_count,
               (SELECT COUNT(*) FROM Students s WHERE s.event_id = e.event_id) AS student_count,
               (SELECT COUNT(*) FROM Health_Records hr WHERE hr.event_id = e.event_id AND hr.category = 'FullExam') AS screened_count
        FROM Events e
        ORDER BY e.start_date DESC
    """).fetchall()
    conn.close()
    return jsonify(rows_to_list(events))


@app.route("/api/events/<int:event_id>", methods=["GET"])
def api_get_event(event_id):
    conn = get_db()
    event = conn.execute("SELECT * FROM Events WHERE event_id = ?", (event_id,)).fetchone()
    if not event:
        conn.close()
        return jsonify({"error": "Event not found"}), 404

    staff = conn.execute("""
        SELECT u.username, u.name, u.designation, u.specialization, es.assigned_at
        FROM Event_Staff es
        JOIN Users u ON es.username = u.username
        WHERE es.event_id = ?
    """, (event_id,)).fetchall()

    conn.close()
    result = row_to_dict(event)
    result["staff"] = rows_to_list(staff)
    return jsonify(result)


@app.route("/api/events", methods=["POST"])
def api_create_event():
    data = request.get_json(force=True)
    now = datetime.utcnow().isoformat()
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO Events (school_name, school_address, poc_name, poc_designation, poc_phone, poc_email,
                            start_date, end_date, operational_hours, tag, created_at, created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        data.get("school_name", ""),
        data.get("school_address", ""),
        data.get("poc_name", ""),
        data.get("poc_designation", ""),
        data.get("poc_phone", ""),
        data.get("poc_email", ""),
        data.get("start_date", ""),
        data.get("end_date", ""),
        data.get("operational_hours", ""),
        data.get("tag", "Upcoming"),
        now,
        data.get("created_by", "admin"),
    ))
    new_id = cur.lastrowid
    conn.commit()
    conn.close()
    log_audit(data.get("created_by", "admin"), "CREATE_EVENT", f"Created event {new_id}: {data.get('school_name')}")
    return jsonify({"success": True, "event_id": new_id})


@app.route("/api/events/<int:event_id>", methods=["PUT"])
def api_update_event(event_id):
    data = request.get_json(force=True)
    conn = get_db()

    # Build dynamic update
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
    conn.execute(f"UPDATE Events SET {', '.join(fields)} WHERE event_id = ?", params)
    conn.commit()
    conn.close()
    log_audit(data.get("user_id", "admin"), "UPDATE_EVENT", f"Updated event {event_id}")
    return jsonify({"success": True})


# ---- Event Staff (Roster) ----
@app.route("/api/events/<int:event_id>/staff", methods=["POST"])
def api_assign_staff(event_id):
    data = request.get_json(force=True)
    username = data.get("username", "")
    now = datetime.utcnow().isoformat()
    conn = get_db()
    try:
        conn.execute("INSERT INTO Event_Staff (event_id, username, assigned_at) VALUES (?,?,?)",
                     (event_id, username, now))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"success": False, "message": "Staff already assigned"}), 409
    conn.close()
    log_audit(data.get("user_id", "admin"), "ASSIGN_STAFF", f"Assigned {username} to event {event_id}")
    return jsonify({"success": True})


@app.route("/api/events/<int:event_id>/staff/<username>", methods=["DELETE"])
def api_remove_staff(event_id, username):
    conn = get_db()
    conn.execute("DELETE FROM Event_Staff WHERE event_id = ? AND username = ?", (event_id, username))
    conn.commit()
    conn.close()
    user_id = request.args.get("user_id", "admin")
    log_audit(user_id, "REMOVE_STAFF", f"Removed {username} from event {event_id}")
    return jsonify({"success": True})


# ---- Staff Search ----
@app.route("/api/staff/search")
def api_staff_search():
    q = request.args.get("q", "").strip()
    conn = get_db()
    if q:
        rows = conn.execute(
            "SELECT username, name, designation, specialization FROM Users WHERE role = 'Medical Staff' AND (name LIKE ? OR designation LIKE ? OR username LIKE ? OR specialization LIKE ?)",
            (f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%"),
        ).fetchall()
    else:
        rows = conn.execute("SELECT username, name, designation, specialization FROM Users WHERE role = 'Medical Staff'").fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


# ---- User Registration ----
@app.route("/api/users/register", methods=["POST"])
def api_register_user():
    data = request.get_json(force=True)
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    name = data.get("name", "").strip()
    role = data.get("role", "Medical Staff")
    designation = data.get("designation", "").strip()
    specialization = data.get("specialization", "").strip()
    admin_user = data.get("admin_user", "admin")

    if not username or not password or not name:
        return jsonify({"success": False, "message": "Username, password, and name are required"}), 400

    if role not in ("Admin", "Medical Staff"):
        return jsonify({"success": False, "message": "Role must be Admin or Medical Staff"}), 400

    conn = get_db()
    existing = conn.execute("SELECT username FROM Users WHERE username = ?", (username,)).fetchone()
    if existing:
        conn.close()
        return jsonify({"success": False, "message": "Username already exists"}), 409

    conn.execute("INSERT INTO Users (username, password, role, name, designation, specialization) VALUES (?,?,?,?,?,?)",
                 (username, password, role, name, designation, specialization))
    conn.commit()
    conn.close()
    log_audit(admin_user, "REGISTER_USER", f"Registered {role} user: {username} ({name})")
    return jsonify({"success": True})


# ---- Event Stats ----
@app.route("/api/events/<int:event_id>/stats")
def api_event_stats(event_id):
    conn = get_db()
    total_students = conn.execute("SELECT COUNT(*) AS c FROM Students WHERE event_id = ?", (event_id,)).fetchone()["c"]
    screened = conn.execute("SELECT COUNT(*) AS c FROM Health_Records WHERE event_id = ? AND category = 'FullExam'", (event_id,)).fetchone()["c"]

    # Count assessments
    normal = 0
    observation = 0
    referred = 0
    records = conn.execute("SELECT json_data FROM Health_Records WHERE event_id = ? AND category = 'FullExam'", (event_id,)).fetchall()
    for r in records:
        try:
            d = json.loads(r["json_data"])
            a = d.get("assessment", "N")
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
        SELECT hr.record_id, hr.student_id, s.name AS student_name, hr.doctor_id, hr.category,
               hr.json_data, hr.timestamp
        FROM Health_Records hr
        JOIN Students s ON hr.student_id = s.student_id
        WHERE hr.event_id = ?
        ORDER BY hr.timestamp DESC
    """, (event_id,)).fetchall()

    staff = conn.execute("""
        SELECT u.username, u.name, u.designation, u.specialization
        FROM Event_Staff es
        JOIN Users u ON es.username = u.username
        WHERE es.event_id = ?
    """, (event_id,)).fetchall()

    conn.close()
    return jsonify({
        "total_students": total_students,
        "screened": screened,
        "normal": normal,
        "observation": observation,
        "referred": referred,
        "records": rows_to_list(hr_rows),
        "staff": rows_to_list(staff),
    })


# ---- My Events (for Medical Staff camp selection) ----
@app.route("/api/events/my")
def api_my_events():
    username = request.args.get("username", "")
    conn = get_db()
    events = conn.execute("""
        SELECT e.*
        FROM Events e
        JOIN Event_Staff es ON e.event_id = es.event_id
        WHERE es.username = ?
        ORDER BY e.start_date DESC
    """, (username,)).fetchall()
    conn.close()
    return jsonify(rows_to_list(events))


# ---- Students (kept for DoctorWorkflow compatibility) ----
@app.route("/api/students", methods=["POST"])
def api_create_student():
    """Create a single student (used by doctor workflow)."""
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

    if not name:
        return jsonify({"success": False, "message": "Name is required"}), 400

    qr_hash = "".join(random.choices(string.ascii_lowercase + string.digits, k=13))
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO Students
           (event_id, name, age, dob, gender, student_class, section, blood_group, father_name, phone, qr_code_hash)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (event_id, name, age, dob, gender, student_class, section, blood_group, father_name, phone, qr_hash),
    )
    new_id = cur.lastrowid
    conn.commit()

    student = conn.execute("SELECT * FROM Students WHERE student_id = ?", (new_id,)).fetchone()
    conn.close()
    log_audit(user_id or "doctor", "CREATE_STUDENT", f"Created student {name} (ID {new_id})")
    return jsonify({"success": True, "student": row_to_dict(student)})


@app.route("/api/students/search")
def api_students_search():
    query = request.args.get("query", "").strip()
    student_class = request.args.get("class", "").strip()
    section = request.args.get("section", "").strip()
    examined = request.args.get("examined", "")  # '1' or '0'
    referred = request.args.get("referred", "")  # '1'

    event_id = request.args.get("event_id", "").strip()

    conn = get_db()

    # Build dynamic query
    conditions = []
    params = []

    if event_id:
        conditions.append("s.event_id = ?")
        params.append(int(event_id))

    if query:
        conditions.append("(s.name LIKE ? OR s.student_id = ? OR s.phone LIKE ? OR s.student_class LIKE ? OR s.section LIKE ?)")
        params.extend([f"%{query}%", query, f"%{query}%", f"%{query}%", f"%{query}%"])

    if student_class:
        conditions.append("s.student_class = ?")
        params.append(student_class)

    if section:
        conditions.append("s.section = ?")
        params.append(section)

    where = (" AND " + " AND ".join(conditions)) if conditions else ""

    sql = f"""
        SELECT s.*,
               CASE WHEN hr.record_id IS NOT NULL THEN 1 ELSE 0 END AS is_examined,
               hr.json_data AS last_exam_data
        FROM Students s
        LEFT JOIN (
            SELECT student_id, record_id, json_data
            FROM Health_Records
            WHERE category = 'FullExam'
            GROUP BY student_id
            HAVING record_id = MAX(record_id)
        ) hr ON s.student_id = hr.student_id
        WHERE 1=1 {where}
    """

    rows = conn.execute(sql, params).fetchall()
    results = rows_to_list(rows)

    # Post-filter for examined / referred
    if examined == '1':
        results = [r for r in results if r.get('is_examined')]
    elif examined == '0':
        results = [r for r in results if not r.get('is_examined')]

    if referred == '1':
        filtered = []
        for r in results:
            try:
                exam = json.loads(r.get('last_exam_data') or '{}')
                if exam.get('assessment') == 'R':
                    filtered.append(r)
            except Exception:
                pass
        results = filtered

    conn.close()
    return jsonify(results)


@app.route("/api/students/<int:student_id>")
def api_student_by_id(student_id):
    conn = get_db()
    student = conn.execute("SELECT * FROM Students WHERE student_id = ?", (student_id,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(student))


# ---- Health Records (kept for DoctorWorkflow compatibility) ----
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
        "INSERT INTO Health_Records (student_id, event_id, doctor_id, category, json_data, timestamp) VALUES (?,?,?,?,?,?)",
        (student_id, event_id, doctor_id, category, json_data, ts),
    )
    conn.commit()
    conn.close()
    log_audit(doctor_id, f"INSERT_{category.upper()}", f"Added record for student {student_id}")
    return jsonify({"success": True})


@app.route("/api/health-records/exam", methods=["POST"])
def api_save_full_exam():
    """Save a complete medical examination (upsert by student + event)."""
    data = request.get_json(force=True)
    student_id = data.get("student_id")
    event_id = data.get("event_id", data.get("camp_id", 1))
    doctor_id = data.get("doctor_id", "doctor")
    exam_data = data.get("exam_data", {})
    ts = datetime.utcnow().isoformat()
    json_str = json.dumps(exam_data) if isinstance(exam_data, dict) else str(exam_data)

    conn = get_db()
    # Check for existing record
    existing = conn.execute(
        "SELECT record_id FROM Health_Records WHERE student_id = ? AND event_id = ? AND category = 'FullExam'",
        (student_id, event_id),
    ).fetchone()

    if existing:
        conn.execute(
            "UPDATE Health_Records SET json_data = ?, timestamp = ?, doctor_id = ? WHERE record_id = ?",
            (json_str, ts, doctor_id, existing["record_id"]),
        )
        record_id = existing["record_id"]
    else:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO Health_Records (student_id, event_id, doctor_id, category, json_data, timestamp) VALUES (?,?,?,?,?,?)",
            (student_id, event_id, doctor_id, "FullExam", json_str, ts),
        )
        record_id = cur.lastrowid

    conn.commit()
    conn.close()
    log_audit(doctor_id, "SAVE_EXAM", f"Saved full exam for student {student_id}")
    return jsonify({"success": True, "record_id": record_id})


@app.route("/api/health-records/<int:student_id>")
def api_get_health_records(student_id):
    conn = get_db()
    rows = conn.execute(
        "SELECT category, json_data, timestamp, doctor_id FROM Health_Records WHERE student_id = ? ORDER BY timestamp DESC",
        (student_id,),
    ).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


# ---- Audit Logs ----
@app.route("/api/admin/audit-logs")
def api_admin_audit_logs():
    conn = get_db()
    logs = conn.execute("SELECT * FROM Audit_Logs ORDER BY timestamp DESC LIMIT 50").fetchall()
    conn.close()
    return jsonify(rows_to_list(logs))


# ---- Digitise (MedDigitizer Streamlit launcher) ----
digitise_process = None

@app.route("/api/digitise/launch", methods=["POST"])
def api_digitise_launch():
    global digitise_process
    DIGITISE_PORT = 8501

    # Check if already running
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
        log_audit(data.get("user_id", "system"), "LAUNCH_DIGITISE", "Launched MedDigitizer Streamlit app")
        return jsonify({
            "success": True,
            "url": f"http://localhost:{DIGITISE_PORT}",
            "message": "MedDigitizer is starting...",
        })
    except Exception as exc:
        return jsonify({"success": False, "message": f"Failed to launch MedDigitizer: {exc}"}), 500


# ---------------------------------------------------------------------------
# Serve React SPA from dist/ (built by Vite)
# ---------------------------------------------------------------------------
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path):
    # If dist/ does not exist, show a helpful message
    if not os.path.isdir(DIST_DIR):
        return Response(
            "<html><body style='font-family:sans-serif;padding:40px;background:#0f172a;color:#e2e8f0;'>"
            "<h1 style='color:#22d3ee'>AIIMS Bathinda - Backend Running &#10004;</h1>"
            "<p>The Flask API server is running, but the React frontend has not been built yet.</p>"
            "<p>Run this command to build the frontend:</p>"
            "<pre style='background:#1e293b;padding:16px;border-radius:8px;color:#38bdf8'>npm run build</pre>"
            "<p>Then refresh this page.</p>"
            "<hr style='border-color:#334155'>"
            "<p style='color:#94a3b8'>API endpoints are already available at <code>/api/*</code></p>"
            "</body></html>",
            content_type="text/html",
        )

    # Serve the file if it exists in dist/
    full_path = os.path.join(DIST_DIR, path)
    if path and os.path.isfile(full_path):
        return send_from_directory(DIST_DIR, path)

    # Fallback to index.html for SPA routing
    return send_from_directory(DIST_DIR, "index.html")


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    init_db()
    print(f"")
    print(f"  AIIMS Bathinda - Flask Server")
    print(f"  =============================")
    print(f"  Server running on: http://localhost:{PORT}")
    print(f"  Database:          {DB_PATH}")
    print(f"  Frontend (dist/):  {'FOUND' if os.path.isdir(DIST_DIR) else 'NOT BUILT - run: npm run build'}")
    print(f"")
    app.run(host="0.0.0.0", port=PORT, debug=False)
