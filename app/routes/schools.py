import logging
from flask import Blueprint, request, jsonify, session
from datetime import datetime
import psycopg2
import psycopg2.extras

from app.db import get_db_conn
from app.helpers import row_to_dict, rows_to_list, normalize_date, compute_event_status
from app.services.audit import log_audit
from app.services.email import send_email_async

logger = logging.getLogger('aiims.schools')
bp = Blueprint('schools', __name__)

@bp.route("/api/schools")
def api_list_schools():
    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM Schools ORDER BY school_name")
        rows = cur.fetchall()
    return jsonify(rows_to_list(rows))


@bp.route("/api/schools/search")
def api_search_schools():
    q = request.args.get("q", "").strip()
    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        if q:
            cur.execute(
                "SELECT * FROM Schools WHERE school_name ILIKE %s OR poc_name ILIKE %s "
                "ORDER BY school_name",
                (f"%{q}%", f"%{q}%"),
            )
        else:
            cur.execute("SELECT * FROM Schools ORDER BY school_name")
        rows = cur.fetchall()
    return jsonify(rows_to_list(rows))


@bp.route("/api/camp-requests", methods=["POST"])
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

    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT school_id, school_name FROM Schools WHERE poc_username = %s",
            (username,),
        )
        school = cur.fetchone()
        if not school:
            return jsonify({"success": False, "message": "No school found for this user"}), 404

        s = row_to_dict(school)
        now = datetime.utcnow().isoformat()
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

    log_audit(username, "CREATE_CAMP_REQUEST",
              f"Camp request {new_id} submitted for {s['school_name']}")
    return jsonify({"success": True, "request_id": new_id})


@bp.route("/api/camp-requests", methods=["GET"])
def api_list_camp_requests():
    """Admin: list all camp requests (optionally filter by status)."""
    status_filter = request.args.get("status", "").strip()
    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        if status_filter:
            cur.execute(
                "SELECT * FROM Camp_Requests WHERE status = %s ORDER BY created_at DESC",
                (status_filter,),
            )
        else:
            cur.execute("SELECT * FROM Camp_Requests ORDER BY created_at DESC")
        rows = cur.fetchall()
    return jsonify(rows_to_list(rows))


@bp.route("/api/camp-requests/school")
def api_school_camp_requests():
    """School POC: list their own camp requests."""
    username = request.args.get("username", "").strip()
    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT school_id FROM Schools WHERE poc_username = %s",
            (username,),
        )
        school = cur.fetchone()
        if not school:
            return jsonify([])
        school_id = school["school_id"]
        cur.execute(
            "SELECT * FROM Camp_Requests WHERE school_id = %s ORDER BY created_at DESC",
            (school_id,),
        )
        rows = cur.fetchall()
    return jsonify(rows_to_list(rows))


@bp.route("/api/camp-requests/count")
def api_camp_requests_count():
    """Return count of pending camp requests (for admin badge)."""
    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT COUNT(*) AS c FROM Camp_Requests WHERE status = 'Pending'"
        )
        row = cur.fetchone()
    return jsonify({"pending": row["c"] if row else 0})


@bp.route("/api/camp-requests/<int:request_id>/approve", methods=["POST"])
def api_approve_camp_request(request_id):
    """Admin approves a camp request and creates a real Event."""
    sess_user = session.get("user")
    reviewer = sess_user["username"] if sess_user else "admin"
    data = request.get_json(force=True) or {}

    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT * FROM Camp_Requests WHERE request_id = %s", (request_id,)
        )
        req = cur.fetchone()
        if not req:
            return jsonify({"success": False, "message": "Request not found"}), 404

        r = row_to_dict(req)
        if r["status"] != "Pending":
            return jsonify({"success": False, "message": "Request is not pending"}), 409

        # Fetch school details to populate the event properly
        school_id = r["school_id"]
        school_row = None
        if school_id:
            cur.execute(
                "SELECT * FROM Schools WHERE school_id = %s", (school_id,)
            )
            school_row = cur.fetchone()

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

        computed_tag = compute_event_status(r["preferred_date"], "")
        now = datetime.utcnow().isoformat()
        
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
        cur.execute(
            "UPDATE Camp_Requests SET status='Approved', reviewed_at=%s, reviewed_by=%s WHERE request_id=%s",
            (now, reviewer, request_id),
        )
        conn.commit()

    log_audit(reviewer, "APPROVE_CAMP_REQUEST",
              f"Approved request {request_id} -> Event {new_event_id}: {school_name}")

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
                <p style="margin:0 0 8px 0;font-size:14px;color:#475569;"><strong>Scheduled Start Date:</strong> {normalize_date(r["preferred_date"])}</p>
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
        send_email_async(poc_email, subject, body_html)

    return jsonify({"success": True, "event_id": new_event_id, "email_sent": bool(poc_email)})


@bp.route("/api/camp-requests/<int:request_id>/reject", methods=["POST"])
def api_reject_camp_request(request_id):
    """Admin rejects a camp request."""
    sess_user = session.get("user")
    reviewer = sess_user["username"] if sess_user else "admin"

    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT * FROM Camp_Requests WHERE request_id = %s", (request_id,)
        )
        req = cur.fetchone()
        if not req:
            return jsonify({"success": False, "message": "Request not found"}), 404

        if row_to_dict(req)["status"] != "Pending":
            return jsonify({"success": False, "message": "Request is not pending"}), 409

        now = datetime.utcnow().isoformat()
        cur.execute(
            "UPDATE Camp_Requests SET status='Rejected', reviewed_at=%s, reviewed_by=%s WHERE request_id=%s",
            (now, reviewer, request_id),
        )
        conn.commit()

    log_audit(reviewer, "REJECT_CAMP_REQUEST", f"Rejected camp request {request_id}")
    return jsonify({"success": True})
