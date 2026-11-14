"""
server.py - Lightweight Backend Server & PKA Converter API for PXL Web NetSim
Serves the web application and provides Cisco Packet Tracer file decoding,
SQLite user authentication, 1-minute auto-save, and teacher student management.
Part of PXL Web NetSim (Hogeschool PXL)
© David Parren (owner), Gert Van Waeyenberg, Jeroen Jean, Guido Frissaer en Kathleen Hombroeks
"""

import os
import sys
import json
import time
import socket
import urllib.request
import urllib.error
import urllib.parse
from flask import Flask, request, jsonify, send_from_directory, session, Response
from backend.pka_parser import convert_pka_to_netsim
from backend.database import (
    init_db,
    authenticate_user,
    create_or_update_user,
    delete_user,
    delete_users_bulk,
    move_users_to_class,
    get_distinct_classes,
    get_distinct_programs,
    list_students,
    save_student_progress,
    get_student_progress,
    list_students_with_progress,
    bulk_import_students,
    import_blackboard_csv,
    reset_student_exam,
    assign_exam,
    get_exam_assignments,
    delete_exam_assignment,
    toggle_exam_assignment,
    get_assigned_exam_for_student,
    get_system_setting,
    set_system_setting,
    get_db,
    save_exam,
    list_exams,
    get_exam_by_id,
    delete_exam,
    delete_exams_bulk,
    list_all_student_scores,
    get_scores_for_student,
    assign_exam_batch,
    get_import_queue,
    clear_import_queue,
    get_students_grouped_by_class,
    toggle_assignment_test_started,
    get_all_assigned_exams_for_student,
    verify_test_access,
    reset_student_lab,
    reset_student_exam_by_teacher,
    change_user_password,
    create_bug_report,
    list_bug_reports,
    get_bug_report,
    update_bug_report_status,
    apply_bug_solution,
    delete_bug_report,
    list_teachers,
    create_teacher,
    delete_teacher,
    list_labs_catalog,
    save_custom_project,
    list_custom_projects,
    get_custom_project,
    rename_custom_project,
    delete_custom_project
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
SUBMISSIONS_DIR = os.path.join(BASE_DIR, "submissions")
os.makedirs(SUBMISSIONS_DIR, exist_ok=True)

# Initialize database tables & default accounts
init_db()

app = Flask(__name__, static_folder=STATIC_DIR)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "pxl_netsim_super_secret_session_key_2026")


@app.route("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "online",
        "service": "PXL Web NetSim (CiscoExa NextGen)",
        "version": "2.1.0",
        "institution": "Hogeschool PXL - SNE",
        "auth_enabled": True
    })


# --- AUTHENTICATION APIS ---
@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json(force=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Gebruikersnaam en wachtwoord vereist"}), 400

    user = authenticate_user(username, password)
    if not user:
        return jsonify({"error": "Ongeldige gebruikersnaam of wachtwoord"}), 401

    session["user_id"] = user["id"]
    session["username"] = user["username"]
    session["role"] = user["role"]

    return jsonify({
        "success": True,
        "user": user,
        "message": f"Succesvol ingelogd als {user['full_name']}"
    })


@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    session.clear()
    return jsonify({"success": True, "message": "Succesvol uitgelogd"})


@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"authenticated": False, "user": None})

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, full_name, role, class_group FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        session.clear()
        return jsonify({"authenticated": False, "user": None})

    return jsonify({
        "authenticated": True,
        "user": {
            "id": row["id"],
            "username": row["username"],
            "full_name": row["full_name"],
            "role": row["role"],
            "class_group": row["class_group"]
        }
    })


# --- STUDENT PROGRESS & 10-SECOND AUTOSAVE & RUNNING CONFIG ---
@app.route("/api/student/save", methods=["POST"])
def student_save():
    data = request.get_json(force=True) or {}
    exam_id = data.get("exam_id", "01_pxl_standard")
    topology = data.get("topology", {})
    running_config = data.get("running_config", {})
    rubric_evaluation = data.get("rubric_evaluation", [])
    score = data.get("score", 0)
    max_score = data.get("max_score", 100)
    percentage = data.get("percentage", 0.0)

    user_id = session.get("user_id")
    # If not logged in via session, allow username fallback
    if not user_id and "username" in data:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE username = ?", (data["username"].strip(),))
        row = cur.fetchone()
        conn.close()
        if row:
            user_id = row["id"]

    if not user_id:
        return jsonify({"error": "Niet ingelogd. Log in om je voortgang op te slaan."}), 401

    save_student_progress(user_id, exam_id, topology, score, max_score, percentage, running_config, rubric_eval=rubric_evaluation)
    return jsonify({
        "success": True,
        "saved_at": time.strftime("%H:%M:%S"),
        "message": "Voortgang & Running Config automatisch opgeslagen in database"
    })


@app.route("/api/student/load", methods=["GET"])
def student_load():
    exam_id = request.args.get("exam_id", "01_pxl_standard")
    user_id = session.get("user_id")

    if not user_id and "username" in request.args:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE username = ?", (request.args["username"].strip(),))
        row = cur.fetchone()
        conn.close()
        if row:
            user_id = row["id"]

    if not user_id:
        return jsonify({"error": "Niet ingelogd"}), 401

    progress = get_student_progress(user_id, exam_id)
    if not progress:
        return jsonify({"found": False, "message": "Geen eerdere opslag gevonden voor dit examen"})

    return jsonify({"found": True, "progress": progress})


@app.route("/api/student/assigned-exam", methods=["GET"])
def student_assigned_exam():
    """Returns the open exam assigned to the currently logged in student or their class."""
    user_id = session.get("user_id")
    if not user_id and "username" in request.args:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE username = ?", (request.args["username"].strip(),))
        row = cur.fetchone()
        conn.close()
        if row:
            user_id = row["id"]

    if not user_id:
        return jsonify({"assigned": False, "assignment": None})

    assignment = get_assigned_exam_for_student(user_id)
    if not assignment:
        return jsonify({"assigned": False, "assignment": None})

    return jsonify({"assigned": True, "assignment": assignment})


@app.route("/api/student/assigned-exams", methods=["GET"])
def student_assigned_exams():
    """Returns all active assigned labs and tests for the student's dropdown and Student Studio."""
    user_id = session.get("user_id")
    if not user_id and "username" in request.args:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE username = ?", (request.args["username"].strip(),))
        row = cur.fetchone()
        conn.close()
        if row:
            user_id = row["id"]

    if not user_id:
        return jsonify({"status": "unauthenticated", "exams": [], "total": 0})

    assigned = get_all_assigned_exams_for_student(user_id)
    return jsonify({"status": "success", "exams": assigned, "total": len(assigned)})


@app.route("/api/student/verify-test-password", methods=["POST"])
def student_verify_test_pw():
    """Checks whether the student can enter a test (checks if started and validates password)."""
    data = request.get_json(force=True) or {}
    exam_id = data.get("exam_id", "").strip()
    password = data.get("password", "")

    user_id = session.get("user_id")
    if not user_id and "username" in data:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE username = ?", (data["username"].strip(),))
        row = cur.fetchone()
        conn.close()
        if row:
            user_id = row["id"]

    if not user_id:
        return jsonify({"ok": False, "error": "Niet ingelogd."}), 401

    res = verify_test_access(user_id, exam_id, password)
    return jsonify(res)


@app.route("/api/student/reset-lab", methods=["POST"])
def student_reset_lab():
    """Student can reset practice labs only (tests are protected)."""
    data = request.get_json(force=True) or {}
    exam_id = data.get("exam_id", "").strip()

    user_id = session.get("user_id")
    if not user_id and "username" in data:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE username = ?", (data["username"].strip(),))
        row = cur.fetchone()
        conn.close()
        if row:
            user_id = row["id"]

    if not user_id:
        return jsonify({"ok": False, "error": "Niet ingelogd."}), 401

    res = reset_student_lab(user_id, exam_id)
    status_code = 200 if res.get("ok") else 400
    return jsonify(res), status_code


@app.route("/api/student/change-password", methods=["POST"])
def student_change_pw():
    """Student or user changes their own password."""
    data = request.get_json(force=True) or {}
    old_pw = data.get("old_password", "")
    new_pw = data.get("new_password", "")

    user_id = session.get("user_id")
    if not user_id and "username" in data:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE username = ?", (data["username"].strip(),))
        row = cur.fetchone()
        conn.close()
        if row:
            user_id = row["id"]

    if not user_id:
        return jsonify({"ok": False, "error": "Niet ingelogd."}), 401

    res = change_user_password(user_id, old_pw, new_pw)
    status_code = 200 if res.get("ok") else 400
    return jsonify(res), status_code


@app.route("/api/student/scores", methods=["GET"])
def student_scores_endpoint():
    """Returns all test and exam scores for the currently logged-in student."""
    user_id = session.get("user_id")
    if not user_id and "username" in request.args:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE username = ?", (request.args["username"].strip(),))
        row = cur.fetchone()
        conn.close()
        if row:
            user_id = row["id"]

    if not user_id:
        return jsonify({"scores": [], "message": "Niet ingelogd als student"}), 401

    scores = get_scores_for_student(user_id)
    return jsonify({"scores": scores, "total": len(scores)})



# --- TEACHER APIS: USERS, CLASSES, DROPDOWN MOVES & MANAGEMENT ---
@app.route("/api/teacher/classes", methods=["GET"])
def teacher_classes():
    return jsonify({
        "classes": get_distinct_classes(),
        "programs": get_distinct_programs()
    })


@app.route("/api/teacher/students", methods=["GET"])
def teacher_students():
    exam_id = request.args.get("exam_id", "01_pxl_standard")
    classes_param = request.args.get("classes", "")
    search = request.args.get("search", "")

    class_list = [c.strip() for c in classes_param.split(",") if c.strip()] if classes_param else None
    students = list_students_with_progress(exam_id=exam_id, class_groups=class_list, search=search)
    return jsonify({"students": students})


@app.route("/api/teacher/student/create", methods=["POST"])
def teacher_create_student():
    data = request.get_json(force=True) or {}
    username = data.get("username", "").strip()
    if not username:
        return jsonify({"error": "Gebruikersnaam / Studentnummer verplicht"}), 400

    first_name = data.get("first_name", "").strip()
    last_name = data.get("last_name", "").strip()
    full_name = data.get("full_name", "").strip() or f"{first_name} {last_name}".strip() or username
    academic_year = data.get("academic_year", "2026-27").strip()
    program = data.get("program", "").strip()
    class_group = data.get("class_group", "Algemeen").strip()
    password = data.get("password", "PXL2026!").strip() or "PXL2026!"
    raw_display = f"{last_name} ({academic_year} - {program} - {class_group}), {first_name}"

    uid = create_or_update_user(
        username=username,
        password=password,
        full_name=full_name,
        role='student',
        class_group=class_group,
        first_name=first_name,
        last_name=last_name,
        academic_year=academic_year,
        program=program,
        raw_display_name=raw_display
    )
    return jsonify({"success": True, "user_id": uid, "message": f"Student {full_name} succesvol opgeslagen."})


@app.route("/api/teacher/student/delete", methods=["POST"])
def teacher_delete_student():
    data = request.get_json(force=True) or {}
    user_id = data.get("user_id")
    user_ids = data.get("user_ids", [])

    if user_id:
        delete_user(user_id)
        return jsonify({"success": True, "message": "Student succesvol verwijderd."})

    if user_ids:
        cnt = delete_users_bulk(user_ids)
        return jsonify({"success": True, "count": cnt, "message": f"{cnt} student(en) verwijderd."})

    return jsonify({"error": "Geen student ID(s) opgegeven"}), 400


@app.route("/api/teacher/students/move-class", methods=["POST"])
def teacher_move_students():
    data = request.get_json(force=True) or {}
    user_ids = data.get("user_ids", [])
    new_class = data.get("new_class_group", "").strip()

    if not user_ids or not new_class:
        return jsonify({"error": "Selecteer studenten en een doelklas"}), 400

    updated = move_users_to_class(user_ids, new_class)
    return jsonify({
        "success": True,
        "count": updated,
        "message": f"{updated} student(en) verplaatst naar klas {new_class}."
    })


@app.route("/api/teacher/import-students", methods=["POST"])
def teacher_import_students():
    data = request.get_json(force=True) or {}
    csv_text = data.get("csv_text", "")
    if not csv_text.strip():
        return jsonify({"error": "Geen CSV gegevens ontvangen"}), 400

    result = import_blackboard_csv(csv_text)
    return jsonify({
        "success": True,
        "created": result["created"],
        "updated": result["updated"],
        "errors": result["errors"],
        "message": f"{result['created']} nieuwe studenten aangemaakt, {result['updated']} bijgewerkt"
    })


# --- TEACHER ACCOUNTS MANAGEMENT ---
@app.route("/api/teacher/teachers", methods=["GET"])
def teacher_list_teachers():
    """Lists all teacher accounts."""
    teachers = list_teachers()
    return jsonify({"status": "success", "count": len(teachers), "teachers": teachers})


@app.route("/api/teacher/teacher/create", methods=["POST"])
def teacher_create_teacher():
    """Creates a new teacher account."""
    data = request.json or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    full_name = data.get("full_name", "").strip()
    department = data.get("department", "PXL-SNE").strip()

    if not username or not password or not full_name:
        return jsonify({"status": "error", "error": "Gebruikersnaam, wachtwoord en volledige naam zijn verplicht"}), 400

    try:
        teacher_id = create_teacher(username, password, full_name, department)
        return jsonify({
            "status": "success",
            "message": f"Docent '{full_name}' succesvol opgeslagen.",
            "teacher_id": teacher_id
        })
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 400


@app.route("/api/teacher/teacher/delete", methods=["POST"])
def teacher_delete_teacher():
    """Deletes a teacher account."""
    data = request.json or {}
    teacher_id = data.get("teacher_id")
    if not teacher_id:
        return jsonify({"status": "error", "error": "Geen docent ID opgegeven"}), 400

    requesting_id = session.get("user_id")
    try:
        deleted = delete_teacher(teacher_id, requesting_user_id=requesting_id)
        if deleted:
            return jsonify({"status": "success", "message": "Docent succesvol verwijderd."})
        return jsonify({"status": "error", "error": "Docent kon niet worden gevonden of verwijderd."}), 404
    except ValueError as ve:
        return jsonify({"status": "error", "error": str(ve)}), 400
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


# --- LABS & RUBRICS CATALOG ---
@app.route("/api/teacher/labs-catalog", methods=["GET"])
def teacher_labs_catalog():
    """Returns all labs with parsed rubrics and instructions for teacher review."""
    catalog = list_labs_catalog()
    return jsonify({"status": "success", "count": len(catalog), "labs": catalog})



# --- TEACHER TAB 2: SCORES OVERVIEW & BLACKBOARD / EXCEL EXPORT ---
@app.route("/api/teacher/scores", methods=["GET"])
def teacher_scores():
    exam_id = request.args.get("exam_id", "01_pxl_standard")
    classes_param = request.args.get("classes", "")
    search = request.args.get("search", "")

    class_list = [c.strip() for c in classes_param.split(",") if c.strip()] if classes_param else None
    if exam_id == "all":
        students = list_all_student_scores(class_groups=class_list, search=search)
    else:
        students = list_students_with_progress(exam_id=exam_id, class_groups=class_list, search=search)
    return jsonify({"status": "success", "success": True, "exam_id": exam_id, "scores": students})


@app.route("/api/teacher/scores/export", methods=["GET"])
def teacher_scores_export():
    exam_id = request.args.get("exam_id", "01_pxl_standard")
    classes_param = request.args.get("classes", "")
    class_list = [c.strip() for c in classes_param.split(",") if c.strip()] if classes_param else None

    if exam_id == "all":
        students = list_all_student_scores(class_groups=class_list)
        csv_lines = ["\ufeffAchternaam;Voornaam;Gebruikersnaam;Richting;Klas;ExamenId;ExamenTitel;Categorie;Score;MaxScore;Percentage;LaatsteOpslag"]
        for s in students:
            title_clean = str(s.get('exam_title') or s.get('exam_id') or '').replace(';', ',').replace('"', "'")
            csv_lines.append(
                f"{s.get('last_name','')};{s.get('first_name','')};{s.get('username','')};{s.get('program','')};{s.get('class_group','')};"
                f"{s.get('exam_id','')};{title_clean};{s.get('exam_category','')};{s.get('score',0)};{s.get('max_score',100)};{s.get('percentage',0)};{s.get('last_saved','')}"
            )
        filename = f"PXL_NetSim_Alle_Scores_{time.strftime('%Y%m%d_%H%M%S')}.csv"
    else:
        students = list_students_with_progress(exam_id=exam_id, class_groups=class_list)
        csv_lines = ["\ufeffAchternaam;Voornaam;Gebruikersnaam;Richting;Klas;Examen;Score;MaxScore;Percentage;LaatsteOpslag"]
        for s in students:
            csv_lines.append(
                f"{s.get('last_name','')};{s.get('first_name','')};{s.get('username','')};{s.get('program','')};{s.get('class_group','')};"
                f"{exam_id};{s.get('score',0)};{s.get('max_score',100)};{s.get('percentage',0)};{s.get('last_saved','')}"
            )
        filename = f"PXL_NetSim_Scores_{exam_id}_{time.strftime('%Y%m%d_%H%M%S')}.csv"

    csv_data = "\r\n".join(csv_lines)
    return Response(
        csv_data.encode("utf-8-sig"),
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment;filename={filename}"}
    )


# --- TEACHER TAB 3: TEST & ASSIGNMENT MANAGEMENT, BATCH TARGETING & RESET ---
@app.route("/api/teacher/exams", methods=["GET"])
def teacher_list_exams():
    """Lists all available exams in SQLite database (course labs, PKA imports, presets, custom)."""
    exams = list_exams()
    return jsonify({"status": "success", "count": len(exams), "exams": exams})


@app.route("/api/exam/<exam_id>", methods=["GET"])
def get_exam_endpoint(exam_id):
    """Retrieves full JSON configuration for any exam in the database."""
    exam = get_exam_by_id(exam_id)
    if not exam:
        return jsonify({"error": f"Examen '{exam_id}' niet gevonden in database"}), 404
    return jsonify({"status": "success", "exam": exam})


@app.route("/api/teacher/exam/save", methods=["POST"])
def teacher_save_exam():
    """Saves or updates an exam in SQLite database, enforcing mandatory title."""
    data = request.get_json(force=True) or {}
    title = data.get("title", "").strip()
    if not title:
        return jsonify({"error": "Examen / opdracht naam is verplicht!"}), 400

    exam_id = data.get("id", "").strip()
    instructions = data.get("instructions", "")
    topology = data.get("topology") or data.get("initialTopology") or {}
    rubric = data.get("rubric") or []
    time_limit = int(data.get("time_limit_minutes") or data.get("timeLimitMinutes") or 80)
    category = data.get("category", "custom")
    created_by = session.get("username", "teacher")
    kind = (data.get("kind") or "lab").lower()
    test_password = (data.get("test_password") or "").strip()

    try:
        saved_id = save_exam(
            exam_id=exam_id,
            title=title,
            instructions=instructions,
            topology=topology,
            rubric=rubric,
            time_limit_minutes=time_limit,
            category=category,
            created_by=created_by,
            kind=kind,
            test_password=test_password
        )
        return jsonify({
            "success": True,
            "exam_id": saved_id,
            "title": title,
            "kind": kind,
            "message": f"Examen '{title}' succesvol opgeslagen in database."
        })
    except Exception as e:
        return jsonify({"error": f"Fout bij opslaan in database: {str(e)}"}), 500


@app.route("/api/teacher/exam/delete", methods=["POST"])
def teacher_delete_exam():
    data = request.get_json(force=True) or {}
    exam_id = data.get("id", "").strip()
    if not exam_id:
        return jsonify({"error": "Examen ID ontbreekt"}), 400
    success = delete_exam(exam_id)
    return jsonify({"success": success})


@app.route("/api/teacher/exam/delete-bulk", methods=["POST"])
def teacher_delete_exams_bulk():
    data = request.get_json(force=True) or {}
    ids = data.get("ids", [])
    if not ids:
        return jsonify({"error": "Geen examen ID's opgegeven"}), 400
    deleted = delete_exams_bulk(ids)
    return jsonify({"success": True, "count": deleted, "message": f"{deleted} examen(s) succesvol verwijderd."})


@app.route("/api/teacher/students-by-class", methods=["GET"])
def teacher_students_by_class():
    """Returns all students grouped by class for hierarchical tree checkboxes in assignments tab."""
    classes = get_students_grouped_by_class()
    return jsonify({"status": "success", "count": len(classes), "classes": classes})


@app.route("/api/teacher/exam/assign-targets", methods=["POST"])
def teacher_assign_targets():
    """Batch-assigns an exam to student groups (classes) and/or individual students."""
    data = request.get_json(force=True) or {}
    exam_id = data.get("exam_id", "").strip()
    title = data.get("title", "").strip() or exam_id
    targets = data.get("targets", [])
    time_limit = int(data.get("time_limit_minutes", 80))
    is_active = 1 if data.get("is_active", True) else 0
    assignment_type = (data.get("assignment_type") or "lab").lower()
    test_password = (data.get("test_password") or "").strip()
    is_started = data.get("is_started")

    if not exam_id:
        return jsonify({"error": "Examen ID is verplicht"}), 400
    if not targets:
        return jsonify({"error": "Selecteer minstens één klas of student"}), 400

    cnt = assign_exam_batch(
        exam_id,
        title,
        targets,
        time_limit_minutes=time_limit,
        is_active=is_active,
        assignment_type=assignment_type,
        test_password=test_password,
        is_started=is_started
    )
    type_label = "Test" if assignment_type == "test" else "Lab"
    return jsonify({
        "success": True,
        "count": cnt,
        "message": f"{type_label} '{title}' succesvol opengezet voor {cnt} doelgroep(en)/student(en) met {time_limit} min tijdslimiet."
    })


@app.route("/api/teacher/exam/assignments", methods=["GET", "POST"])
def teacher_exam_assignments():
    if request.method == "POST":
        data = request.get_json(force=True) or {}
        exam_id = data.get("exam_id", "").strip()
        title = data.get("title", "").strip() or exam_id
        target_type = data.get("target_type", "class")  # 'class', 'student', 'all'
        target_values = data.get("target_values", [])  # list of classes or usernames
        target_class = data.get("target_class", "")
        time_limit = int(data.get("time_limit_minutes", 80))
        is_active = 1 if data.get("is_active", True) else 0
        assignment_type = (data.get("assignment_type") or "lab").lower()
        test_password = (data.get("test_password") or "").strip()
        is_started = data.get("is_started")

        if not exam_id:
            return jsonify({"error": "Examen ID is verplicht"}), 400

        if target_type == 'all' or not target_values:
            assign_exam(exam_id, title, 'all', '*', '', time_limit, is_active, assignment_type=assignment_type, test_password=test_password, is_started=is_started)
        else:
            for val in target_values:
                if str(val).strip():
                    assign_exam(exam_id, title, target_type, str(val).strip(), target_class, time_limit, is_active, assignment_type=assignment_type, test_password=test_password, is_started=is_started)

        type_label = "Test" if assignment_type == "test" else "Lab"
        return jsonify({"success": True, "message": f"{type_label} '{title}' succesvol toegewezen met tijdslimiet van {time_limit} min."})
    else:
        assignments = get_exam_assignments()
        return jsonify({"assignments": assignments})


@app.route("/api/teacher/exam/assignment/toggle", methods=["POST"])
def teacher_toggle_assignment():
    data = request.get_json(force=True) or {}
    assignment_id = data.get("id")
    is_active = data.get("is_active", True)
    if not assignment_id:
        return jsonify({"error": "Toewijzing ID ontbreekt"}), 400
    toggle_exam_assignment(assignment_id, is_active)
    return jsonify({"success": True})


@app.route("/api/teacher/exam/assignment/toggle-start", methods=["POST"])
def teacher_toggle_assignment_start():
    data = request.get_json(force=True) or {}
    assignment_id = data.get("id")
    is_started = bool(data.get("is_started", True))
    if not assignment_id:
        return jsonify({"error": "Toewijzing ID ontbreekt"}), 400
    toggle_assignment_test_started(assignment_id, is_started)
    return jsonify({"success": True, "is_started": is_started})


@app.route("/api/teacher/exam/assignment/delete", methods=["POST"])
def teacher_delete_assignment():
    data = request.get_json(force=True) or {}
    assignment_id = data.get("id")
    if not assignment_id:
        return jsonify({"error": "Toewijzing ID ontbreekt"}), 400
    delete_exam_assignment(assignment_id)
    return jsonify({"success": True})


@app.route("/api/teacher/student/reset-exam", methods=["POST"])
def teacher_reset_student_exam_endpoint():
    """Allows teacher to reset a specific exam or test for a student."""
    data = request.get_json(force=True) or {}
    user_id = data.get("user_id")
    exam_id = data.get("exam_id", "").strip()
    if not user_id or not exam_id:
        return jsonify({"error": "Student en Examen ID zijn verplicht"}), 400
    res = reset_student_exam_by_teacher(user_id, exam_id)
    return jsonify(res)


@app.route("/api/teacher/exam/reset", methods=["POST"])
def teacher_reset_exam():
    data = request.get_json(force=True) or {}
    user_ids = data.get("user_ids", [])
    exam_id = data.get("exam_id")

    if not user_ids:
        return jsonify({"error": "Selecteer minstens één student om te resetten"}), 400

    deleted = reset_student_exam(user_ids, exam_id)
    return jsonify({
        "success": True,
        "count": deleted,
        "message": f"Examenopslag voor {len(user_ids)} student(en) gewist. Studenten starten met een schone lei."
    })


# --- TOEVOEG WACHTRIJ APIS ---
@app.route("/api/teacher/import-queue", methods=["GET"])
def teacher_import_queue():
    queue = get_import_queue()
    return jsonify({"queue": queue, "total": len(queue)})


@app.route("/api/teacher/import-queue/clear", methods=["POST"])
def teacher_import_queue_clear():
    clear_import_queue()
    return jsonify({"success": True, "message": "Toevoeg-wachtrij leeggemaakt."})


# --- PKA IMPORT & SUBMISSION ---
@app.route("/api/convert-pka", methods=["POST"])
def convert_pka_endpoint():
    """
    Receives an uploaded .pka or .pkt file, decrypts Twofish, and returns WebNetSim exam JSON.
    If 'title' is provided and 'save_to_db' is true, immediately saves to SQLite exams table.
    """
    if "file" not in request.files:
        return jsonify({"error": "Geen bestand meegestuurd"}), 400

    uploaded_file = request.files["file"]
    if not uploaded_file.filename:
        return jsonify({"error": "Bestandsnaam ontbreekt"}), 400

    title = request.form.get("title", "").strip()
    save_to_db = str(request.form.get("save_to_db", "false")).lower() == "true"

    try:
        content = uploaded_file.read()
        exam_json = convert_pka_to_netsim(content, uploaded_file.filename)

        if title:
            exam_json["title"] = title

        if save_to_db:
            if not title:
                return jsonify({"error": "Examen / opdracht naam is verplicht bij opslaan in database!"}), 400

            save_exam(
                exam_id=exam_json.get("id"),
                title=title,
                instructions=exam_json.get("instructions", ""),
                topology=exam_json.get("topology") or exam_json.get("initialTopology"),
                rubric=exam_json.get("rubric", []),
                time_limit_minutes=exam_json.get("timeLimitMinutes", 80),
                category="pka_import",
                created_by=session.get("username", "teacher")
            )
            exam_json["saved_in_db"] = True

        return jsonify(exam_json)
    except Exception as e:
        return jsonify({"error": f"Fout bij verwerken van Packet Tracer bestand: {str(e)}"}), 500


@app.route("/api/pka/analyze", methods=["POST"])
def pka_analyze_endpoint():
    """
    Receives an uploaded .pka or .pkt file, analyzes finished running-configs and settings,
    and returns a structured list of configurable items for interactive rubric generation.
    """
    if "file" not in request.files:
        return jsonify({"error": "Geen bestand meegestuurd"}), 400
    uploaded_file = request.files["file"]
    if not uploaded_file.filename:
        return jsonify({"error": "Bestandsnaam ontbreekt"}), 400

    try:
        content = uploaded_file.read()
        from backend.pka_generator import analyze_pka_finished_configs
        result = analyze_pka_finished_configs(content, uploaded_file.filename)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": f"Fout bij analyseren Packet Tracer bestand: {str(e)}"}), 500


@app.route("/api/pka/generate-exam", methods=["POST"])
def pka_generate_exam_endpoint():
    """
    Generates a new Lab or Test based on teacher's checked settings:
    - Checked items become rubric criteria with points.
    - Checked items are stripped from the student initial topology.
    - Unchecked items stay pre-configured for the student.
    - Automatically saves to SQLite database.
    """
    try:
        data = request.get_json(force=True)
        analysis = data.get("analysis", {})
        selected_ids = data.get("selected_item_ids", [])
        custom_points = data.get("custom_points", {})
        assignment_type = data.get("assignment_type", "lab")
        test_password = data.get("test_password", "")
        time_limit = int(data.get("time_limit_minutes", 80))
        title = data.get("title", "").strip()
        custom_instr = data.get("custom_instructions", "")

        if not title:
            title = analysis.get("title", "Cisco Lab")

        from backend.pka_generator import generate_exam_from_pka_selection
        exam = generate_exam_from_pka_selection(
            analyzed_data=analysis,
            selected_item_ids=selected_ids,
            custom_points=custom_points,
            assignment_type=assignment_type,
            test_password=test_password,
            time_limit_minutes=time_limit,
            title=title,
            custom_instructions=custom_instr
        )

        from backend.database import save_exam
        saved_id = save_exam(
            exam_id=exam.get("id"),
            title=exam.get("title"),
            instructions=exam.get("instructions", ""),
            topology=exam.get("initialTopology"),
            rubric=exam.get("rubric", []),
            time_limit_minutes=exam.get("timeLimitMinutes", 80),
            category="pka_import",
            created_by=session.get("username", "teacher"),
            kind=assignment_type,
            test_password=test_password
        )
        exam["id"] = saved_id

        return jsonify({"success": True, "exam": exam})
    except Exception as e:
        return jsonify({"error": f"Fout bij genereren van opdracht: {str(e)}"}), 500


@app.route("/api/submit", methods=["POST"])
def submit_exam_endpoint():
    """
    Stores student submission package on server for teacher review.
    """
    try:
        data = request.get_json(force=True)
        student_id = data.get("student", {}).get("studentNumber", "unknown")
        student_name = data.get("student", {}).get("name", "student").replace(" ", "_")
        timestamp = int(time.time())

        filename = f"Inzending_{student_name}_{student_id}_{timestamp}.pxlexam"
        filepath = os.path.join(SUBMISSIONS_DIR, filename)

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        # Also store to student_saves if user_id in session
        if "user_id" in session:
            exam_id = data.get("examId", "01_pxl_standard")
            score = data.get("score", {}).get("score", 0)
            max_score = data.get("score", {}).get("maxScore", 100)
            percentage = data.get("score", {}).get("percentage", 0.0)
            topology = data.get("topology", {})
            rubric_eval = data.get("score", {}).get("rubricBreakdown", []) or data.get("rubricBreakdown", [])
            save_student_progress(session["user_id"], exam_id, topology, score, max_score, percentage, rubric_eval=rubric_eval)

        return jsonify({
            "status": "success",
            "message": "Inzending succesvol opgeslagen op de server en in database",
            "filename": filename
        })
    except Exception as e:
        return jsonify({"error": f"Kon inzending niet opslaan: {str(e)}"}), 500


@app.route("/api/course-labs", methods=["GET"])
def get_course_labs():
    """Returns all available PXL course labs from the curriculum repository."""
    labs_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "course_labs")
    labs = []
    if os.path.exists(labs_dir):
        for fname in sorted(os.listdir(labs_dir)):
            if fname.endswith(".json"):
                try:
                    with open(os.path.join(labs_dir, fname), "r", encoding="utf-8") as f:
                        labs.append(json.load(f))
                except Exception:
                    pass
    return jsonify({"status": "success", "count": len(labs), "labs": labs})


@app.route("/api/course-labs/<lab_id>", methods=["GET"])
def get_course_lab_by_id(lab_id):
    """Returns a specific course lab by its ID or code."""
    labs_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "course_labs")
    if os.path.exists(labs_dir):
        for fname in os.listdir(labs_dir):
            if fname.endswith(".json"):
                try:
                    with open(os.path.join(labs_dir, fname), "r", encoding="utf-8") as f:
                        data = json.load(f)
                        if data.get("id") == lab_id or data.get("code") == lab_id:
                            return jsonify({"status": "success", "lab": data})
                except Exception:
                    pass
    return jsonify({"error": "Lab niet gevonden"}), 404


# --- REAL-WORLD LIVE INTERNET NAT GATEWAY ---
@app.route("/api/settings/live-internet", methods=["GET", "POST"])
def live_internet_settings():
    if request.method == "POST":
        data = request.get_json(force=True) or {}
        enabled = str(data.get("enabled", False)).lower() == "true"
        set_system_setting("live_internet_enabled", "true" if enabled else "false")
        return jsonify({
            "success": True,
            "live_internet_enabled": enabled,
            "message": f"Live Internet NAT Gateway is nu {'actief (NAT verbonden met fysieke adapter)' if enabled else 'inactief (gesimuleerde modus)'}"
        })
    else:
        is_enabled = get_system_setting("live_internet_enabled", "false") == "true"
        return jsonify({
            "live_internet_enabled": is_enabled
        })


@app.route("/api/gateway/proxy", methods=["GET", "POST"])
def gateway_proxy():
    """
    Acts as a NAT proxy gateway forwarding HTTP/HTTPS traffic from simulated
    PC Desktop Web Browser directly out through the physical instance adapter (Cloud Run / Host).
    """
    if request.method == "POST":
        data = request.get_json(force=True) or {}
        target_url = data.get("url", "")
    else:
        target_url = request.args.get("url", "")

    if not target_url:
        return jsonify({"success": False, "reason": "Geen doel URL opgegeven"}), 400

    target_url = target_url.strip()
    if not (target_url.startswith("http://") or target_url.startswith("https://")):
        target_url = "http://" + target_url

    try:
        req = urllib.request.Request(
            target_url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PXL-WebNetSim-NAT-Gateway/2.1 (Hogeschool PXL SNE)"
            }
        )
        with urllib.request.urlopen(req, timeout=8.0) as response:
            content_type = response.headers.get("Content-Type", "")
            raw_body = response.read()

            charset = "utf-8"
            if "charset=" in content_type:
                charset = content_type.split("charset=")[-1].split(";")[0].strip()

            try:
                html_body = raw_body.decode(charset, errors="replace")
            except Exception:
                html_body = raw_body.decode("utf-8", errors="replace")

            final_url = response.geturl()

            parsed_url = urllib.parse.urlparse(final_url)
            base_href = f"{parsed_url.scheme}://{parsed_url.netloc}/"
            banner = f"""
            <div style="background: #065f46; color: #ecfdf5; padding: 10px 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #10b981; box-sizing: border-box; width: 100%; position: sticky; top: 0; z-index: 999999;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 16px;">🌐</span>
                    <span><strong>LIVE INTERNET NAT VERBINDING</strong> &bull; Fysieke Instance Adapter (Google Cloud / Host)</span>
                </div>
                <span style="font-weight: bold; background: #047857; padding: 3px 10px; border-radius: 12px; font-size: 12px;">{final_url}</span>
            </div>
            """

            if "<head>" in html_body:
                html_body = html_body.replace("<head>", f"<head><base href=\"{base_href}\">", 1)
            elif "<html>" in html_body:
                html_body = html_body.replace("<html>", f"<html><head><base href=\"{base_href}\"></head>", 1)

            if "<body>" in html_body:
                html_body = html_body.replace("<body>", f"<body>{banner}", 1)
            else:
                html_body = banner + html_body

            return jsonify({
                "success": True,
                "html": html_body,
                "final_url": final_url,
                "status_code": response.getcode()
            })
    except urllib.error.HTTPError as e:
        return jsonify({
            "success": False,
            "status_code": e.code,
            "reason": f"HTTP Fout {e.code}: {e.reason} bij openen van {target_url}"
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "reason": f"NAT Gateway Fout bij bereiken van {target_url}: {str(e)}"
        }), 200


@app.route("/api/gateway/probe", methods=["POST"])
def gateway_probe():
    """
    Performs real live TCP/DNS probe out of physical adapter to test actual reachability & latency.
    """
    data = request.get_json(force=True) or {}
    target = data.get("target", "").strip()
    if not target:
        return jsonify({"success": False, "reason": "Target ontbreekt"}), 400

    target = target.replace("http://", "").replace("https://", "").split("/")[0].split(":")[0]

    start_t = time.time()
    try:
        resolved_ip = socket.gethostbyname(target)
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2.5)
        port = 443 if not target.startswith("8.8.") and not target.startswith("1.1.") else 53
        try:
            sock.connect((resolved_ip, port))
            sock.close()
        except Exception:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(2.5)
                sock.connect((resolved_ip, 80))
                sock.close()
            except Exception:
                pass

        elapsed_ms = round((time.time() - start_t) * 1000, 1)
        return jsonify({
            "success": True,
            "target": target,
            "resolved_ip": resolved_ip,
            "latency_ms": max(elapsed_ms, 1.2)
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "target": target,
            "reason": f"Bestemming onbereikbaar via fysieke adapter: {str(e)}"
        })


# --- BUG REPORT & DIAGNOSTICS APIS ---

@app.route("/api/bug-report/create", methods=["POST"])
def api_create_bug_report():
    data = request.get_json(force=True) or {}
    try:
        res = create_bug_report(data)
        return jsonify({
            "success": True,
            "bug_code": res.get("bug_code"),
            "message": f"Bugmelding {res.get('bug_code')} succesvol geregistreerd in het Bug Center!"
        })
    except Exception as e:
        return jsonify({"success": False, "error": f"Fout bij opslaan bugmelding: {str(e)}"}), 500


@app.route("/api/bug-report/list", methods=["GET"])
def api_list_bug_reports():
    reporter = request.args.get("reporter_username")
    status_filter = request.args.get("status")
    try:
        bugs = list_bug_reports(reporter_username=reporter, status_filter=status_filter)
        return jsonify({"success": True, "count": len(bugs), "bugs": bugs})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/bug-report/<bug_code>", methods=["GET"])
def api_get_bug_report(bug_code):
    bug = get_bug_report(bug_code)
    if not bug:
        return jsonify({"success": False, "error": f"Bug {bug_code} niet gevonden"}), 404
    return jsonify({"success": True, "bug": bug})


@app.route("/api/bug-report/<bug_code>/export", methods=["GET"])
def api_export_bug_report(bug_code):
    bug = get_bug_report(bug_code)
    if not bug:
        return jsonify({"success": False, "error": f"Bug {bug_code} niet gevonden"}), 404

    # Structure complete diagnostic payload for AI and teacher analysis
    export_payload = {
        "bug_code": bug.get("bug_code"),
        "created_at": bug.get("created_at"),
        "status": bug.get("status", "open"),
        "reporter": {
            "username": bug.get("reporter_username"),
            "name": bug.get("reporter_name"),
            "role": bug.get("reporter_role"),
            "class": bug.get("reporter_class")
        },
        "lab_info": {
            "exam_id": bug.get("exam_id"),
            "title": bug.get("exam_title"),
            "category": bug.get("category")
        },
        "user_description": bug.get("user_description"),
        "resolution_notes": bug.get("resolution_notes", ""),
        "resolved_by": bug.get("resolved_by", ""),
        "resolved_at": bug.get("resolved_at"),
        "browser_info": bug.get("browser_info", {}),
        "topology": bug.get("topology", {}),
        "device_configs": bug.get("device_configs", {}),
        "solution_template": {
            "bug_code": bug.get("bug_code"),
            "status": "resolved",
            "resolution_notes": "Toelichting van de bugfix en oorzaak...",
            "resolved_by": "Antigravity AI / Docent",
            "test_instructions": "Stappen voor de gebruiker om de fix te testen..."
        }
    }

    dumped = json.dumps(export_payload, indent=2, ensure_ascii=False)
    resp = Response(dumped, mimetype="application/json")
    resp.headers["Content-Disposition"] = f"attachment; filename={bug_code}.json"
    return resp


@app.route("/api/bug-report/resolve", methods=["POST"])
def api_resolve_bug_report():
    data = request.get_json(force=True) or {}
    bug_code = data.get("bug_code")
    if not bug_code:
        return jsonify({"success": False, "error": "bug_code verplicht"}), 400

    status = data.get("status", "resolved")
    resolution_notes = data.get("resolution_notes", "")
    resolved_by = data.get("resolved_by") or session.get("username", "docent")

    res = update_bug_report_status(bug_code, status, resolution_notes, resolved_by)
    return jsonify({"success": res.get("ok", False), "status": status, "bug_code": bug_code})


@app.route("/api/bug-report/apply-solution", methods=["POST"])
def api_apply_bug_solution():
    data = request.get_json(force=True) or {}
    res = apply_bug_solution(data)
    return jsonify(res)


@app.route("/api/bug-report/delete", methods=["POST"])
def api_delete_bug_report():
    data = request.get_json(force=True) or {}
    bug_code = data.get("bug_code")
    if not bug_code:
        return jsonify({"success": False, "error": "bug_code verplicht"}), 400
    res = delete_bug_report(bug_code)
    return jsonify({"success": res.get("ok", False)})


# --- CUSTOM USER NETWORKS / PROJECTS APIS ---
@app.route("/api/projects", methods=["GET"])
def api_list_projects():
    user_id = request.args.get("user_id") or session.get("user_id") or "gast"
    projects = list_custom_projects(user_id)
    return jsonify({"success": True, "projects": projects})


@app.route("/api/projects/save", methods=["POST"])
def api_save_project():
    data = request.get_json(force=True) or {}
    user_id = data.get("user_id") or session.get("user_id") or "gast"

    project_id = str(data.get("project_id") or "").strip()
    name = (data.get("name") or "").strip()
    topology = data.get("topology") or {}

    res = save_custom_project(user_id, project_id, name, topology)
    return jsonify({"success": res.get("ok", False), "project": res.get("project")})


@app.route("/api/projects/<project_id>", methods=["GET"])
def api_get_project(project_id):
    user_id = request.args.get("user_id") or session.get("user_id") or "gast"
    res = get_custom_project(user_id, project_id)
    if not res.get("ok"):
        return jsonify({"success": False, "error": res.get("error", "Project niet gevonden")}), 404
    return jsonify({"success": True, "project": res.get("project")})


@app.route("/api/projects/<project_id>/rename", methods=["POST"])
def api_rename_project(project_id):
    data = request.get_json(force=True) or {}
    user_id = data.get("user_id") or session.get("user_id") or "gast"

    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"success": False, "error": "Naam mag niet leeg zijn"}), 400

    res = rename_custom_project(user_id, project_id, name)
    return jsonify({"success": res.get("ok", False), "name": name, "id": project_id})


@app.route("/api/projects/<project_id>", methods=["DELETE"])
def api_delete_project(project_id):
    user_id = request.args.get("user_id") or session.get("user_id")
    if not user_id:
        try:
            data = request.get_json(silent=True) or {}
            user_id = data.get("user_id")
        except Exception:
            pass
    user_id = user_id or "gast"

    res = delete_custom_project(user_id, project_id)
    return jsonify({"success": res.get("ok", False), "id": project_id})



@app.route("/<path:path>")
def static_proxy(path):
    return send_from_directory(STATIC_DIR, path)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"============================================================")
    print(f"  PXL Web NetSim • Cisco IOS Lab & Exam Platform (v2.1)")
    print(f"  © David Parren (owner), Gert Van Waeyenberg, Jeroen Jean, Guido Frissaer en Kathleen Hombroeks")
    print(f"  Hogeschool PXL (Toegepaste Informatica / SNE)")
    print(f"============================================================")
    print(f"  Live Server actief op: http://localhost:{port}")
    print(f"  SQLite Database & Accounts gereed in data/netsim.db")
    print(f"  Geschikt voor Schoolyear Kiosk Lockdown (1 URL)")
    print(f"============================================================")
    app.run(host="0.0.0.0", port=port, debug=False)
