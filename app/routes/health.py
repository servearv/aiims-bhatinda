import logging
import json
from datetime import datetime
import psycopg2
import psycopg2.extras
from flask import Blueprint, request, jsonify, current_app

from app.db import get_db_conn
from app.helpers import rows_to_list
from app.services.audit import log_audit

logger = logging.getLogger('aiims.health')
bp = Blueprint('health', __name__)

@bp.route("/api/health-records", methods=["POST"])
def api_create_health_record():
    data = request.get_json(force=True)
    student_id = data.get("student_id")
    event_id = data.get("event_id", data.get("camp_id", 1))
    doctor_id = data.get("doctor_id")
    category = data.get("category")
    json_data = data.get("json_data")
    ts = datetime.utcnow().isoformat()
    
    with get_db_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO Health_Records "
            "(student_id, event_id, doctor_id, category, json_data, timestamp) "
            "VALUES (%s,%s,%s,%s,%s,%s)",
            (student_id, event_id, doctor_id, category, json_data, ts),
        )
        conn.commit()
        
    log_audit(doctor_id, f"INSERT_{category.upper()}",
              f"Added record for student {student_id}")
    return jsonify({"success": True})


@bp.route("/api/health-records/exam", methods=["POST"])
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

    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cur.execute(
            "SELECT role FROM Users WHERE username = %s", (doctor_id,)
        )
        user_row = cur.fetchone()
        
        if user_row and specialist_category != "FullExam":
            user_role = user_row["role"]
            if user_role != specialist_category and user_role != "Admin":
                return jsonify({
                    "success": False,
                    "message": f"Access denied: your role ({user_role}) cannot "
                               f"save {specialist_category} records."
                }), 403

        try:
            cur.execute(
                "SELECT record_id FROM Health_Records "
                "WHERE student_id = %s AND event_id = %s AND category = %s",
                (student_id, event_id, specialist_category),
            )
            existing = cur.fetchone()

            if existing:
                cur.execute(
                    "UPDATE Health_Records SET json_data = %s, timestamp = %s, doctor_id = %s "
                    "WHERE record_id = %s",
                    (json_str, ts, doctor_id, existing["record_id"]),
                )
                record_id = existing["record_id"]
            else:
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
            logger.warning(
                f"Exam save conflict for student={student_id}, "
                f"event={event_id}, category={specialist_category}: {exc}"
            )
            try:
                cur.execute(
                    "SELECT record_id FROM Health_Records "
                    "WHERE student_id = %s AND event_id = %s AND category = %s",
                    (student_id, event_id, specialist_category),
                )
                existing = cur.fetchone()
                if existing:
                    cur.execute(
                        "UPDATE Health_Records SET json_data = %s, timestamp = %s, doctor_id = %s "
                        "WHERE record_id = %s",
                        (json_str, ts, doctor_id, existing["record_id"]),
                    )
                    record_id = existing["record_id"]
                    conn.commit()
                else:
                    logger.error(f"Exam save failed after retry for student {student_id}")
                    return jsonify({"success": False, "message": "Save failed, please retry"}), 500
            except Exception as retry_exc:
                logger.error(f"Exam save retry failed: {retry_exc}")
                return jsonify({"success": False, "message": "Save failed, please retry"}), 500

    log_audit(doctor_id, "SAVE_EXAM",
              f"Saved {specialist_category} exam for student {student_id}")

    socketio = current_app.extensions.get('socketio')
    if socketio:
        socketio.emit("exam_saved", {
            "student_id": student_id,
            "event_id": event_id,
            "category": specialist_category,
            "doctor_id": doctor_id,
        })

    return jsonify({"success": True, "record_id": record_id})


@bp.route("/api/health-records/<int:student_id>")
def api_get_health_records(student_id):
    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT category, json_data, timestamp, doctor_id "
            "FROM Health_Records WHERE student_id = %s ORDER BY timestamp DESC",
            (student_id,),
        )
        rows = cur.fetchall()
    return jsonify(rows_to_list(rows))
