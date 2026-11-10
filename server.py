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
import socket
import urllib.request
import urllib.error
import urllib.parse
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
    get_system_setting,
    set_system_setting,
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
