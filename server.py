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
            name TEXT
        );

        CREATE TABLE IF NOT EXISTS Schools (
            school_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            district TEXT,
            total_students INTEGER
        );

        CREATE TABLE IF NOT EXISTS Camps (
            camp_id INTEGER PRIMARY KEY AUTOINCREMENT,
            school_id INTEGER,
            date TEXT,
            status TEXT,
            assigned_doctors TEXT,
            FOREIGN KEY(school_id) REFERENCES Schools(school_id)
        );

        CREATE TABLE IF NOT EXISTS Students (
            student_id INTEGER PRIMARY KEY AUTOINCREMENT,
            school_id INTEGER,
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
            FOREIGN KEY(school_id) REFERENCES Schools(school_id)
        );

        CREATE TABLE IF NOT EXISTS Health_Records (
            record_id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER,
            camp_id INTEGER,
            doctor_id TEXT,
            category TEXT,
            json_data TEXT,
            timestamp TEXT,
            FOREIGN KEY(student_id) REFERENCES Students(student_id),
            FOREIGN KEY(camp_id) REFERENCES Camps(camp_id),
            FOREIGN KEY(doctor_id) REFERENCES Users(username)
        );

        CREATE TABLE IF NOT EXISTS Inventory (
            item_id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_name TEXT,
            stock_count INTEGER,
            camp_allocated INTEGER
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

    # Idempotent migration: add new columns to Students if they don't exist
    new_cols = ["dob TEXT", "student_class TEXT", "section TEXT",
                "blood_group TEXT", "father_name TEXT", "phone TEXT"]
    for col_def in new_cols:
        try:
            cur.execute(f"ALTER TABLE Students ADD COLUMN {col_def}")
        except Exception:
            pass  # column already exists

    # Seed only when Users table is empty
    row = cur.execute("SELECT COUNT(*) AS count FROM Users").fetchone()
    if row["count"] == 0:
        cur.execute("INSERT INTO Users VALUES (?,?,?,?)", ("admin", "admin", "Super Admin", "Dr. Sharma (HOD)"))
        cur.execute("INSERT INTO Users VALUES (?,?,?,?)", ("coord", "coord", "Camp Admin", "Rahul (Coordinator)"))
        cur.execute("INSERT INTO Users VALUES (?,?,?,?)", ("school", "school", "School PoC", "Principal Singh"))
        cur.execute("INSERT INTO Users VALUES (?,?,?,?)", ("doctor", "doc", "Medical Staff", "Dr. Verma"))
        cur.execute("INSERT INTO Users VALUES (?,?,?,?)", ("parent", "parent", "Parent", "Beneficiary"))

        cur.execute("INSERT INTO Schools (name, district, total_students) VALUES (?,?,?)",
                    ("Govt High School", "Bathinda", 500))

        cur.execute("INSERT INTO Camps (school_id, date, status, assigned_doctors) VALUES (?,?,?,?)",
                    (1, "2026-04-10", "Scheduled", "Dr. Verma"))

        cur.execute("INSERT INTO Inventory (item_name, stock_count, camp_allocated) VALUES (?,?,?)",
                    ("Iron-Folic Acid Tablets", 1000, 200))
        cur.execute("INSERT INTO Inventory (item_name, stock_count, camp_allocated) VALUES (?,?,?)",
                    ("Dental Kits", 50, 40))
        cur.execute("INSERT INTO Inventory (item_name, stock_count, camp_allocated) VALUES (?,?,?)",
                    ("Vision Charts", 10, 2))
        cur.execute("INSERT INTO Inventory (item_name, stock_count, camp_allocated) VALUES (?,?,?)",
                    ("Vitamins", 500, 100))

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
        "SELECT username, role, name FROM Users WHERE username = ? AND password = ?",
        (username, password),
    ).fetchone()
    conn.close()
    if user:
        log_audit(username, "LOGIN", "User logged in successfully")
        return jsonify({"success": True, "user": row_to_dict(user)})
    return jsonify({"success": False, "message": "Invalid credentials"}), 401


# ---- Super Admin ----
@app.route("/api/admin/metrics")
def api_admin_metrics():
    conn = get_db()
    students = conn.execute("SELECT COUNT(*) AS count FROM Students").fetchone()["count"]
    camps = conn.execute("SELECT COUNT(*) AS count FROM Camps").fetchone()["count"]
    referrals = conn.execute(
        "SELECT COUNT(*) AS count FROM Health_Records WHERE json_data LIKE '%Referral%'"
    ).fetchone()["count"]
    conn.close()
    return jsonify({"students": students, "camps": 39 + camps, "referrals": referrals})


@app.route("/api/admin/heatmap")
def api_admin_heatmap():
    conn = get_db()
    camps = conn.execute("SELECT COUNT(*) AS count FROM Camps").fetchone()["count"]
    conn.close()
    extra = camps - 1 if camps > 0 else 0
    return jsonify([
        {"district": "Bathinda", "camp_count": 15 + extra},
        {"district": "Mansa", "camp_count": 8},
        {"district": "Muktsar", "camp_count": 12},
        {"district": "Faridkot", "camp_count": 5},
    ])


@app.route("/api/admin/audit-logs")
def api_admin_audit_logs():
    conn = get_db()
    logs = conn.execute("SELECT * FROM Audit_Logs ORDER BY timestamp DESC LIMIT 50").fetchall()
    conn.close()
    return jsonify(rows_to_list(logs))


# ---- Inventory ----
@app.route("/api/inventory")
def api_inventory():
    conn = get_db()
    items = conn.execute("SELECT * FROM Inventory").fetchall()
    conn.close()
    return jsonify(rows_to_list(items))


# ---- Camps ----
@app.route("/api/camps", methods=["POST"])
def api_create_camp():
    data = request.get_json(force=True)
    school_id = data.get("school_id")
    date = data.get("date")
    assigned_doctors = data.get("assigned_doctors", "")
    user_id = data.get("user_id", "")
    conn = get_db()
    conn.execute(
        "INSERT INTO Camps (school_id, date, status, assigned_doctors) VALUES (?,?,'Scheduled',?)",
        (school_id, date, assigned_doctors),
    )
    conn.commit()
    conn.close()
    log_audit(user_id, "CREATE_CAMP", f"Scheduled camp for school {school_id} on {date}")
    return jsonify({"success": True})


@app.route("/api/camps/pending")
def api_camps_pending():
    conn = get_db()
    rows = conn.execute("""
        SELECT c.*, s.name AS school_name, s.district
        FROM Camps c
        JOIN Schools s ON c.school_id = s.school_id
        WHERE c.status = 'Requested'
    """).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@app.route("/api/camps/request", methods=["POST"])
def api_camps_request():
    data = request.get_json(force=True)
    school_id = data.get("school_id")
    date = data.get("date")
    user_id = data.get("user_id", "")
    conn = get_db()
    conn.execute(
        "INSERT INTO Camps (school_id, date, status, assigned_doctors) VALUES (?,?,'Requested','')",
        (school_id, date),
    )
    conn.commit()
    conn.close()
    log_audit(user_id, "REQUEST_CAMP", f"Requested camp for school {school_id} on {date}")
    return jsonify({"success": True})


@app.route("/api/camps/<int:camp_id>/approve", methods=["PUT"])
def api_camps_approve(camp_id):
    data = request.get_json(force=True)
    assigned_doctors = data.get("assigned_doctors", "")
    user_id = data.get("user_id", "")
    conn = get_db()
    conn.execute(
        "UPDATE Camps SET status = 'Scheduled', assigned_doctors = ? WHERE camp_id = ?",
        (assigned_doctors, camp_id),
    )
    conn.commit()
    conn.close()
    log_audit(user_id, "APPROVE_CAMP", f"Approved camp {camp_id}")
    return jsonify({"success": True})


# ---- Schools ----
@app.route("/api/schools")
def api_schools():
    conn = get_db()
    schools = conn.execute("SELECT * FROM Schools").fetchall()
    conn.close()
    return jsonify(rows_to_list(schools))


# ---- Students ----
@app.route("/api/students/bulk", methods=["POST"])
def api_students_bulk():
    data = request.get_json(force=True)
    students = data.get("students", [])
    user_id = data.get("user_id", "")
    conn = get_db()
    for s in students:
        qr_hash = "".join(random.choices(string.ascii_lowercase + string.digits, k=13))
        conn.execute(
            "INSERT INTO Students (school_id, name, age, gender, qr_code_hash) VALUES (?,?,?,?,?)",
            (1, s.get("name"), s.get("age"), s.get("gender"), qr_hash),
        )
    conn.commit()
    conn.close()
    log_audit(user_id, "UPLOAD_ROSTER", f"Uploaded {len(students)} students")
    return jsonify({"success": True, "count": len(students)})


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

    if not name:
        return jsonify({"success": False, "message": "Name is required"}), 400

    qr_hash = "".join(random.choices(string.ascii_lowercase + string.digits, k=13))
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO Students
           (school_id, name, age, dob, gender, student_class, section, blood_group, father_name, phone, qr_code_hash)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (1, name, age, dob, gender, student_class, section, blood_group, father_name, phone, qr_hash),
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

    conn = get_db()

    # Build dynamic query
    conditions = []
    params = []

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


# ---- Health Records ----
@app.route("/api/health-records", methods=["POST"])
def api_create_health_record():
    data = request.get_json(force=True)
    student_id = data.get("student_id")
    camp_id = data.get("camp_id")
    doctor_id = data.get("doctor_id")
    category = data.get("category")
    json_data = data.get("json_data")
    ts = datetime.utcnow().isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO Health_Records (student_id, camp_id, doctor_id, category, json_data, timestamp) VALUES (?,?,?,?,?,?)",
        (student_id, camp_id, doctor_id, category, json_data, ts),
    )
    conn.commit()
    conn.close()
    log_audit(doctor_id, f"INSERT_{category.upper()}", f"Added record for student {student_id}")
    return jsonify({"success": True})


@app.route("/api/health-records/exam", methods=["POST"])
def api_save_full_exam():
    """Save a complete medical examination (upsert by student + camp)."""
    data = request.get_json(force=True)
    student_id = data.get("student_id")
    camp_id = data.get("camp_id", 1)
    doctor_id = data.get("doctor_id", "doctor")
    exam_data = data.get("exam_data", {})
    ts = datetime.utcnow().isoformat()
    json_str = json.dumps(exam_data) if isinstance(exam_data, dict) else str(exam_data)

    conn = get_db()
    # Check for existing record
    existing = conn.execute(
        "SELECT record_id FROM Health_Records WHERE student_id = ? AND camp_id = ? AND category = 'FullExam'",
        (student_id, camp_id),
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
            "INSERT INTO Health_Records (student_id, camp_id, doctor_id, category, json_data, timestamp) VALUES (?,?,?,?,?,?)",
            (student_id, camp_id, doctor_id, "FullExam", json_str, ts),
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
