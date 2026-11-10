"""
server.py - Lightweight Backend Server & PKA Converter API for PXL Web NetSim
Serves the web application and provides Cisco Packet Tracer file decoding,
SQLite user authentication, 1-minute auto-save, and teacher student management.
Part of PXL Web NetSim (Hogeschool PXL)
© Parren, Van Waeyenberg, Frissaer, Jean, Hombroeks
"""

import os
import sys
import json
import time
from flask import Flask, request, jsonify, send_from_directory, session
from backend.pka_parser import convert_pka_to_netsim
from backend.database import (
    init_db,
    authenticate_user,
    create_or_update_user,
    save_student_progress,
    get_student_progress,
    list_students_with_progress,
    bulk_import_students,
    get_db
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


# --- STUDENT PROGRESS & 1-MINUTE AUTOSAVE ---
@app.route("/api/student/save", methods=["POST"])
def student_save():
    data = request.get_json(force=True) or {}
    exam_id = data.get("exam_id", "01_pxl_standard")
    topology = data.get("topology", {})
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

    save_student_progress(user_id, exam_id, topology, score, max_score, percentage)
    return jsonify({
        "success": True,
        "saved_at": time.strftime("%H:%M:%S"),
        "message": "Voortgang automatisch opgeslagen in database"
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


# --- TEACHER APIS & STUDENT IMPORT ---
@app.route("/api/teacher/students", methods=["GET"])
def teacher_students():
    role = session.get("role")
    # For kiosk testing, if not logged in or teacher, check auth
    exam_id = request.args.get("exam_id", "01_pxl_standard")
    students = list_students_with_progress(exam_id)
    return jsonify({"students": students})


@app.route("/api/teacher/import-students", methods=["POST"])
def teacher_import_students():
    data = request.get_json(force=True) or {}
    csv_text = data.get("csv_text", "")
    if not csv_text.strip():
        return jsonify({"error": "Geen CSV gegevens ontvangen"}), 400

    result = bulk_import_students(csv_text)
    return jsonify({
        "success": True,
        "created": result["created"],
        "updated": result["updated"],
        "errors": result["errors"],
        "message": f"{result['created']} nieuwe accounts aangemaakt, {result['updated']} bijgewerkt"
    })


# --- PKA IMPORT & SUBMISSION ---
@app.route("/api/convert-pka", methods=["POST"])
def convert_pka_endpoint():
    """
    Receives an uploaded .pka or .pkt file, decrypts Twofish, and returns WebNetSim exam JSON.
    """
    if "file" not in request.files:
        return jsonify({"error": "Geen bestand meegestuurd"}), 400

    uploaded_file = request.files["file"]
    if not uploaded_file.filename:
        return jsonify({"error": "Bestandsnaam ontbreekt"}), 400

    try:
        content = uploaded_file.read()
        exam_json = convert_pka_to_netsim(content, uploaded_file.filename)
        return jsonify(exam_json)
    except Exception as e:
        return jsonify({"error": f"Fout bij verwerken van Packet Tracer bestand: {str(e)}"}), 500


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
            save_student_progress(session["user_id"], exam_id, topology, score, max_score, percentage)

        return jsonify({
            "status": "success",
            "message": "Inzending succesvol opgeslagen op de server en in database",
            "filename": filename
        })
    except Exception as e:
        return jsonify({"error": f"Kon inzending niet opslaan: {str(e)}"}), 500


@app.route("/<path:path>")
def static_proxy(path):
    return send_from_directory(STATIC_DIR, path)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"============================================================")
    print(f"  PXL Web NetSim • Cisco IOS Lab & Exam Platform (v2.1)")
    print(f"  © Parren, Van Waeyenberg, Frissaer, Jean, Hombroeks")
    print(f"  Hogeschool PXL (Toegepaste Informatica / SNE)")
    print(f"============================================================")
    print(f"  Live Server actief op: http://localhost:{port}")
    print(f"  SQLite Database & Accounts gereed in data/netsim.db")
    print(f"  Geschikt voor Schoolyear Kiosk Lockdown (1 URL)")
    print(f"============================================================")
    app.run(host="0.0.0.0", port=port, debug=False)
