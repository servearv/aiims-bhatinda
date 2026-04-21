import logging
import json
from flask import Blueprint, request, jsonify, current_app
from datetime import datetime
import psycopg2
import psycopg2.extras

from app.db import get_db_conn
from app.helpers import row_to_dict, rows_to_list, enrich_events_with_status
from app.services.audit import log_audit

logger = logging.getLogger('aiims.events')
bp = Blueprint('events', __name__)


@bp.route("/api/events", methods=["GET"])
def api_list_events():
    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT e.*,
                   (SELECT COUNT(*) FROM Event_Volunteers ev
                    WHERE ev.event_id = e.event_id AND ev.active = 1) AS staff_count,
                   (SELECT COUNT(*) FROM Students s WHERE s.event_id = e.event_id) AS student_count,
                   (SELECT COUNT(DISTINCT hr.student_id) FROM Health_Records hr
                    WHERE hr.event_id = e.event_id) AS screened_count
            FROM Events e
            ORDER BY e.start_date DESC
        """)
        events = cur.fetchall()
        
    result = rows_to_list(events)
    enrich_events_with_status(result)
    return jsonify(result)


@bp.route("/api/events/<int:event_id>", methods=["GET"])
def api_get_event(event_id):
    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM Events WHERE event_id = %s", (event_id,))
        event = cur.fetchone()
        
        if not event:
            return jsonify({"error": "Event not found"}), 404

        cur.execute("""
            SELECT u.username, u.name, u.designation, u.role AS specialization,
                   ev.joined_at, ev.category, ev.active
            FROM Event_Volunteers ev
            JOIN Users u ON ev.username = u.username
            WHERE ev.event_id = %s AND ev.active = 1
        """, (event_id,))
        volunteers = cur.fetchall()

    result = row_to_dict(event)
    result["staff"] = rows_to_list(volunteers)   # keep key name for compat
    return jsonify(result)


@bp.route("/api/events", methods=["POST"])
def api_create_event():
    data = request.get_json(force=True)
    now = datetime.utcnow().isoformat()
    
    school_id = data.get("school_id")
    school_name = data.get("school_name", "")
    school_address = data.get("school_address", "")
    poc_name = data.get("poc_name", "")
    poc_designation = data.get("poc_designation", "")
    poc_phone = data.get("poc_phone", "")
    poc_email = data.get("poc_email", "")

    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        if school_id:
            cur.execute("SELECT * FROM Schools WHERE school_id = %s", (school_id,))
            school_row = cur.fetchone()
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
        
    log_audit(data.get("created_by", "admin"), "CREATE_EVENT",
              f"Created event {new_id}: {school_name}")
    return jsonify({"success": True, "event_id": new_id})


@bp.route("/api/events/<int:event_id>", methods=["PUT"])
def api_update_event(event_id):
    data = request.get_json(force=True)
    
    fields = []
    params = []
    allowed = ["school_name", "school_address", "poc_name", "poc_designation",
               "poc_phone", "poc_email", "start_date", "end_date",
               "operational_hours", "tag"]
               
    for field in allowed:
        if field in data:
            fields.append(f"{field} = %s")
            params.append(data[field])
            
    if not fields:
        return jsonify({"success": False, "message": "No fields to update"}), 400
        
    params.append(event_id)
    
    with get_db_conn() as conn:
        cur = conn.cursor()
        cur.execute(f"UPDATE Events SET {', '.join(fields)} WHERE event_id = %s", params)
        conn.commit()
        
    log_audit(data.get("user_id", "admin"), "UPDATE_EVENT",
              f"Updated event {event_id}")
    return jsonify({"success": True})


@bp.route("/api/events/active")
def api_active_events():
    """Return events that are Upcoming or Ongoing (not Completed or Cancelled)."""
    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
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
        """)
        events = cur.fetchall()

    result = rows_to_list(events)
    enrich_events_with_status(result)

    # Only return active camps (Upcoming or Ongoing)
    active = [e for e in result if e.get('computed_status') in ('Upcoming', 'Ongoing')]
    return jsonify(active)


@bp.route("/api/events/<int:event_id>/volunteer", methods=["POST"])
def api_volunteer_join(event_id):
    data = request.get_json(force=True)
    username = data.get("username", "")
    category = data.get("category", "")
    now = datetime.utcnow().isoformat()
    
    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        try:
            # Upsert: if previously left, reactivate
            cur.execute(
                "SELECT * FROM Event_Volunteers WHERE event_id = %s AND username = %s",
                (event_id, username),
            )
            existing = cur.fetchone()
            
            if existing:
                cur.execute(
                    "UPDATE Event_Volunteers SET active = 1, joined_at = %s, category = %s "
                    "WHERE event_id = %s AND username = %s",
                    (now, category, event_id, username),
                )
            else:
                cur.execute(
                    "INSERT INTO Event_Volunteers (event_id, username, category, joined_at, active) "
                    "VALUES (%s,%s,%s,%s,1)",
                    (event_id, username, category, now),
                )
            conn.commit()
        except psycopg2.IntegrityError:
            conn.rollback()
            return jsonify({"success": False, "message": "Already volunteering"}), 409
            
    log_audit(username, "VOLUNTEER_JOIN",
              f"Volunteered for event {event_id} as {category}")

    # Real-time notification
    socketio = current_app.extensions.get('socketio')
    if socketio:
        socketio.emit("volunteer_joined", {
            "event_id": event_id, "username": username, "category": category
        })

    return jsonify({"success": True})


@bp.route("/api/events/<int:event_id>/volunteer", methods=["DELETE"])
def api_volunteer_leave(event_id):
    data = request.get_json(force=True)
    username = data.get("username", "")
    
    with get_db_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE Event_Volunteers SET active = 0 "
            "WHERE event_id = %s AND username = %s",
            (event_id, username),
        )
        conn.commit()

    log_audit(username, "VOLUNTEER_LEAVE", f"Left event {event_id}")

    socketio = current_app.extensions.get('socketio')
    if socketio:
        socketio.emit("volunteer_left", {
            "event_id": event_id, "username": username
        })

    return jsonify({"success": True})


@bp.route("/api/events/<int:event_id>/volunteers")
def api_event_volunteers(event_id):
    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT u.username, u.name, u.designation, ev.category,
                   ev.joined_at, ev.active
            FROM Event_Volunteers ev
            JOIN Users u ON ev.username = u.username
            WHERE ev.event_id = %s AND ev.active = 1
        """, (event_id,))
        rows = cur.fetchall()
        
    return jsonify(rows_to_list(rows))


@bp.route("/api/events/<int:event_id>/stats")
def api_event_stats(event_id):
    # Optional filters
    student_class = request.args.get("student_class", "").strip()
    section = request.args.get("section", "").strip()
    gender = request.args.get("gender", "").strip()

    student_conditions = ["s.event_id = %s"]
    student_params = [event_id]
    if student_class:
        student_conditions.append("s.student_class = %s")
        student_params.append(student_class)
    if section:
        student_conditions.append("s.section = %s")
        student_params.append(section)
    if gender:
        student_conditions.append("s.gender = %s")
        student_params.append(gender)

    student_where = " AND ".join(student_conditions)

    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cur.execute(
            f"SELECT COUNT(*) AS c FROM Students s WHERE {student_where}",
            student_params,
        )
        total_students = cur.fetchone()["c"]

        cur.execute(
            f"SELECT COUNT(*) AS c FROM Students s WHERE {student_where} AND s.status = 'Absent'",
            student_params,
        )
        absent = cur.fetchone()["c"]

        # Count distinct students with ANY health record (filtered)
        hr_join_where = student_where.replace("s.", "st.")
        cur.execute(
            f"SELECT COUNT(DISTINCT hr.student_id) AS c FROM Health_Records hr "
            f"JOIN Students st ON hr.student_id = st.student_id "
            f"WHERE hr.event_id = %s AND {hr_join_where}",
            [event_id] + student_params,
        )
        screened = cur.fetchone()["c"]

        # Count assessments + per-department breakdown
        normal = 0
        observation = 0
        referred = 0
        dept_breakdown = {}  

        cur.execute(
            f"SELECT hr.json_data, hr.category FROM Health_Records hr "
            f"JOIN Students st ON hr.student_id = st.student_id "
            f"WHERE hr.event_id = %s AND {hr_join_where}",
            [event_id] + student_params,
        )
        records = cur.fetchall()
        
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
        cur.execute(f"""
            SELECT hr.record_id, hr.student_id, st.name AS student_name,
                   hr.doctor_id, hr.category, hr.json_data, hr.timestamp
            FROM Health_Records hr
            JOIN Students st ON hr.student_id = st.student_id
            WHERE hr.event_id = %s AND {hr_join_where}
            ORDER BY hr.timestamp DESC
        """, [event_id] + student_params)
        hr_rows = cur.fetchall()

        # Get active volunteers
        cur.execute("""
            SELECT u.username, u.name, u.designation, ev.category
            FROM Event_Volunteers ev
            JOIN Users u ON ev.username = u.username
            WHERE ev.event_id = %s AND ev.active = 1
        """, (event_id,))
        volunteers = cur.fetchall()

    return jsonify({
        "total_students": total_students,
        "screened": screened,
        "normal": normal,
        "observation": observation,
        "referred": referred,
        "absent": absent,
        "dept_breakdown": dept_breakdown,
        "records": rows_to_list(hr_rows),
        "staff": rows_to_list(volunteers),
    })


@bp.route("/api/events/my")
def api_my_events():
    username = request.args.get("username", "")
    with get_db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT e.*
            FROM Events e
            JOIN Event_Volunteers ev ON e.event_id = ev.event_id
            WHERE ev.username = %s AND ev.active = 1
            ORDER BY e.start_date DESC
        """, (username,))
        events = cur.fetchall()
        
    return jsonify(rows_to_list(events))


@bp.route("/api/events/school")
def api_school_events():
    username = request.args.get("username", "")
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
        cur.execute("""
            SELECT e.*,
                   (SELECT COUNT(*) FROM Students s
                    WHERE s.event_id = e.event_id) AS student_count,
                   (SELECT COUNT(DISTINCT hr.student_id) FROM Health_Records hr
                    WHERE hr.event_id = e.event_id) AS screened_count
            FROM Events e
            WHERE e.school_id = %s
            ORDER BY e.start_date DESC
        """, (school_id,))
        events = cur.fetchall()
        
    result = rows_to_list(events)
    enrich_events_with_status(result)
    return jsonify(result)
