import logging
import json
import csv
import io
import string
import random
import re
from datetime import datetime, date

from flask import Blueprint, request, jsonify, Response, current_app
import psycopg2
import psycopg2.extras

from app.db import get_db_conn
from app.helpers import row_to_dict, rows_to_list, normalize_date
from app.services.audit import log_audit

logger = logging.getLogger('aiims.students')
bp = Blueprint('students', __name__)


@bp.route("/api/students", methods=["POST"])
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
    registration_number = data.get("registration_number", "").strip()

    if not name:
        return jsonify({"success": False, "message": "Name is required"}), 400

    qr_hash = "".join(random.choices(string.ascii_lowercase + string.digits, k=13))
    
    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """INSERT INTO Students
               (event_id, name, age, dob, gender, student_class, section,
                blood_group, father_name, phone, qr_code_hash, added_by, status,
                mother_name, mother_occupation, father_occupation, address, pincode,
                registration_number)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING student_id""",
            (event_id, name, age, dob, gender, student_class, section,
             blood_group, father_name, phone, qr_hash, added_by, status,
             mother_name, mother_occupation, father_occupation, address, pincode,
             registration_number),
        )
        new_id = cur.fetchone()["student_id"]
        conn.commit()

        cur.execute("SELECT * FROM Students WHERE student_id = %s", (new_id,))
        student = cur.fetchone()

    log_audit(user_id or "doctor", "CREATE_STUDENT",
              f"Created student {name} (ID {new_id})")

    socketio = current_app.extensions.get('socketio')
    if socketio:
        socketio.emit("student_created", {
            "student_id": new_id, "event_id": event_id, "name": name,
        })

    return jsonify({"success": True, "student": row_to_dict(student)})


@bp.route("/api/students/bulk", methods=["POST"])
def api_bulk_create_students():
    """Bulk create students from a list. Returns success/error arrays."""
    data = request.get_json(force=True)
    students_data = data.get("students", [])
    event_id = data.get("event_id", 1)
    added_by = data.get("added_by", "")

    success_list = []
    error_list = []

    SYMPTOM_KEYS = [
        "symptom_rubs_eyes", "symptom_cannot_see_board", "symptom_pokes_ear",
        "symptom_breathes_mouth", "symptom_black_teeth", "symptom_bad_breath",
        "symptom_cracks_mouth", "symptom_scratches_head", "symptom_white_patches",
        "symptom_bites_nails", "symptom_headaches", "symptom_fainting",
        "symptom_breathlessness", "symptom_limping", "symptom_stammers",
        "symptom_urination", "symptom_diarrhea", "symptom_vomiting",
        "symptom_blood_stools"
    ]

    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

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
                dob = normalize_date(dob)
                try:
                    dt = date.fromisoformat(dob)
                    today = date.today()
                    age = today.year - dt.year - ((today.month, today.day) < (dt.month, dt.day))
                except (ValueError, TypeError):
                    row_errors.append({"column": "dob", "reason": "Invalid date format (use DD-MM-YYYY or YYYY-MM-DD)"})

            phone = str(row.get("phone", "")).strip()
            if phone and not re.match(r'^[+]?[\d\s\-()]{7,15}$', phone):
                row_errors.append({"column": "phone", "reason": "Invalid phone number"})

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

            reg_num = str(row.get("registration_number", "")).strip()

            qr_hash = "".join(random.choices(string.ascii_lowercase + string.digits, k=13))
            
            symptoms_checked = []
            for sym_key in SYMPTOM_KEYS:
                val = str(row.get(sym_key, "")).strip().lower()
                if val in ("yes", "y", "true", "1"):
                    readable = sym_key.replace("symptom_", "").replace("_", " ").capitalize()
                    symptoms_checked.append(readable)

            try:
                cur.execute(
                    """INSERT INTO Students
                       (event_id, name, age, dob, gender, student_class, section,
                        blood_group, father_name, mother_name, father_occupation,
                        mother_occupation, address, pincode, phone, qr_code_hash,
                        added_by, status, registration_number)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING student_id""",
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
                        reg_num,
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

    log_audit(added_by or "school", "BULK_CREATE_STUDENTS",
              f"Bulk uploaded {len(success_list)} students for event {event_id}")

    socketio = current_app.extensions.get('socketio')
    if socketio and success_list:
        socketio.emit("students_bulk_created", {
            "event_id": event_id, "count": len(success_list),
        })

    return jsonify({
        "success": True, "inserted": success_list, "errors": error_list
    })


@bp.route("/api/students/csv-template")
def api_csv_template():
    """Return a CSV template for bulk student upload."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "registration_number", "name", "dob", "gender", "student_class", "section", "blood_group",
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
        "2024-001", "John Doe", "2012-05-15", "M", "8", "A", "O+",
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


@bp.route("/api/students/search")
def api_students_search():
    query = request.args.get("query", "").strip()
    student_class = request.args.get("class", "").strip()
    section = request.args.get("section", "").strip()
    gender = request.args.get("gender", "").strip()
    examined = request.args.get("examined", "")   # '1' or '0'
    referred = request.args.get("referred", "")   # '1'
    assessment = request.args.get("assessment", "") # 'N', 'O', 'R'
    event_id = request.args.get("event_id", "").strip()

    conditions = []
    params = []

    if event_id:
        conditions.append("s.event_id = %s")
        params.append(int(event_id))

    if query:
        try:
            sid_val = int(query)
            conditions.append(
                "(s.name ILIKE %s OR s.student_id = %s OR s.phone ILIKE %s "
                "OR s.student_class ILIKE %s OR s.section ILIKE %s OR s.registration_number ILIKE %s)"
            )
            params.extend([f"%{query}%", sid_val, f"%{query}%",
                            f"%{query}%", f"%{query}%", f"%{query}%"])
        except ValueError:
            conditions.append(
                "(s.name ILIKE %s OR s.phone ILIKE %s "
                "OR s.student_class ILIKE %s OR s.section ILIKE %s OR s.registration_number ILIKE %s)"
            )
            params.extend([f"%{query}%", f"%{query}%",
                            f"%{query}%", f"%{query}%", f"%{query}%"])

    if student_class:
        conditions.append("s.student_class = %s")
        params.append(student_class)

    if section:
        conditions.append("s.section = %s")
        params.append(section)

    if gender:
        conditions.append("s.gender = %s")
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

    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql, params)
        rows = cur.fetchall()

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

    return jsonify(results)


@bp.route("/api/students/<int:student_id>/status", methods=["PUT"])
def api_update_student_status(student_id):
    """Update student basic status (like marking them absent)."""
    data = request.get_json(force=True)
    new_status = data.get("status", "Pending Examination")
    with get_db_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE Students SET status = %s WHERE student_id = %s",
            (new_status, student_id)
        )
        conn.commit()
    return jsonify({"success": True})


@bp.route("/api/students/<int:student_id>")
def api_student_by_id(student_id):
    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM Students WHERE student_id = %s", (student_id,))
        student = cur.fetchone()
    return jsonify(row_to_dict(student))


@bp.route("/api/students/<int:student_id>", methods=["PUT"])
def api_update_student(student_id):
    """Update student demographics (used by teacher/admin for general info autosave)."""
    data = request.get_json(force=True)
    allowed = [
        "name", "age", "dob", "gender", "student_class", "section",
        "blood_group", "father_name", "phone", "mother_name",
        "mother_occupation", "father_occupation", "address", "pincode",
        "registration_number",
    ]
    fields = []
    params = []
    for field in allowed:
        if field in data:
            fields.append(f"{field} = %s")
            params.append(data[field])
    if not fields:
        return jsonify({"success": False, "message": "No fields"}), 400
    params.append(student_id)

    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            f"UPDATE Students SET {', '.join(fields)} WHERE student_id = %s",
            params,
        )
        conn.commit()
        cur.execute("SELECT * FROM Students WHERE student_id = %s", (student_id,))
        student = cur.fetchone()

    log_audit(data.get("user_id", "teacher"), "UPDATE_STUDENT",
              f"Updated student {student_id}")
    return jsonify({"success": True, "student": row_to_dict(student)})


@bp.route("/api/students/<int:student_id>/general-info", methods=["PUT"])
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

    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT id FROM Student_General_Info "
            "WHERE student_id = %s AND event_id = %s",
            (student_id, event_id),
        )
        existing = cur.fetchone()

        if existing:
            cur.execute(
                "UPDATE Student_General_Info "
                "SET height=%s, weight=%s, bmi=%s, symptoms_json=%s, filled_by=%s, updated_at=%s "
                "WHERE id = %s",
                (height, weight, bmi, symptoms_json, filled_by, ts, existing["id"]),
            )
        else:
            cur.execute(
                "INSERT INTO Student_General_Info "
                "(student_id, event_id, height, weight, bmi, symptoms_json, filled_by, updated_at) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                (student_id, event_id, height, weight, bmi, symptoms_json, filled_by, ts),
            )
        conn.commit()

    log_audit(filled_by, "UPDATE_GENERAL_INFO",
              f"Updated general info for student {student_id}")
    return jsonify({"success": True})


@bp.route("/api/students/<int:student_id>/general-info")
def api_get_general_info(student_id):
    """Get vitals + symptoms for a student."""
    event_id = request.args.get("event_id", "1")
    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT * FROM Student_General_Info "
            "WHERE student_id = %s AND event_id = %s",
            (student_id, int(event_id)),
        )
        row = cur.fetchone()

    if row:
        d = row_to_dict(row)
        try:
            d["symptoms"] = json.loads(d.get("symptoms_json", "[]"))
        except Exception:
            d["symptoms"] = []
        return jsonify(d)
    return jsonify({"height": "", "weight": "", "bmi": "", "symptoms": []})


@bp.route("/api/students/<int:student_id>/all-records")
def api_student_all_records(student_id):
    """Get all specialist records + general info for a student (cross-view)."""
    event_id = request.args.get("event_id", "1")
    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cur.execute("SELECT * FROM Students WHERE student_id = %s", (student_id,))
        student = cur.fetchone()

        cur.execute(
            "SELECT * FROM Student_General_Info "
            "WHERE student_id = %s AND event_id = %s",
            (student_id, int(event_id)),
        )
        gen = cur.fetchone()

        cur.execute(
            "SELECT category, json_data, timestamp, doctor_id "
            "FROM Health_Records WHERE student_id = %s AND event_id = %s "
            "ORDER BY timestamp DESC",
            (student_id, int(event_id)),
        )
        records = cur.fetchall()

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


# ---- Previous Records (cross-camp) ----
@bp.route("/api/students/previous-records")
def api_student_previous_records():
    """Get health records from OTHER camps for a student identified by school_id + registration_number.

    This allows doctors and school POCs to see a student's examination history across
    different camp events at the same school.
    """
    school_id = request.args.get("school_id", "").strip()
    registration_number = request.args.get("registration_number", "").strip()
    current_event_id = request.args.get("current_event_id", "").strip()

    if not school_id or not registration_number:
        return jsonify({"records": [], "message": "school_id and registration_number are required"})

    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Find all student rows with the same registration_number in events linked to the same school
        exclude_event = int(current_event_id) if current_event_id else 0
        cur.execute("""
            SELECT s.student_id, s.name, s.event_id, s.student_class, s.section,
                   s.age, s.gender, s.registration_number,
                   e.school_name, e.start_date, e.end_date
            FROM Students s
            JOIN Events e ON s.event_id = e.event_id
            WHERE s.registration_number = %s
              AND e.school_id = %s
              AND (%s = 0 OR s.event_id != %s)
            ORDER BY e.start_date DESC
        """, (registration_number, int(school_id), exclude_event, exclude_event))
        matching_students = cur.fetchall()

    if not matching_students:
        return jsonify({"records": [], "events": []})

    events_seen = {}
    all_records = []

    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        for stu in matching_students:
            stu_dict = row_to_dict(stu)
            sid = stu_dict["student_id"]
            eid = stu_dict["event_id"]

            if eid not in events_seen:
                events_seen[eid] = {
                    "event_id": eid,
                    "school_name": stu_dict.get("school_name", ""),
                    "start_date": stu_dict.get("start_date", ""),
                    "end_date": stu_dict.get("end_date", ""),
                    "student_class": stu_dict.get("student_class", ""),
                    "section": stu_dict.get("section", ""),
                }

            # Get health records for this student
            cur.execute("""
                SELECT hr.record_id, hr.category, hr.json_data, hr.timestamp, hr.doctor_id,
                       hr.event_id
                FROM Health_Records hr
                WHERE hr.student_id = %s
                ORDER BY hr.timestamp DESC
            """, (sid,))
            records = cur.fetchall()

            for r in records:
                rd = row_to_dict(r)
                try:
                    rd["parsed_data"] = json.loads(rd.get("json_data", "{}"))
                except Exception:
                    rd["parsed_data"] = {}
                rd["event_school_name"] = stu_dict.get("school_name", "")
                rd["event_start_date"] = stu_dict.get("start_date", "")
                rd["student_name"] = stu_dict.get("name", "")
                rd["student_class"] = stu_dict.get("student_class", "")
                all_records.append(rd)

            # Also get general info for this student
            cur.execute("""
                SELECT * FROM Student_General_Info
                WHERE student_id = %s
            """, (sid,))
            gen = cur.fetchone()
            if gen:
                gen_dict = row_to_dict(gen)
                try:
                    gen_dict["symptoms"] = json.loads(gen_dict.get("symptoms_json", "[]"))
                except Exception:
                    gen_dict["symptoms"] = []
                events_seen[eid]["general_info"] = gen_dict

    return jsonify({
        "records": all_records,
        "events": list(events_seen.values()),
    })
