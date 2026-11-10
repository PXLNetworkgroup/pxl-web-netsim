"""
server.py - Lightweight Backend Server & PKA Converter API for PXL Web NetSim
Serves the web application and provides Cisco Packet Tracer file decoding.
Part of PXL Web NetSim (Hogeschool PXL)
"""

import os
import sys
import json
import time
from flask import Flask, request, jsonify, send_from_directory
from backend.pka_parser import convert_pka_to_netsim

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
SUBMISSIONS_DIR = os.path.join(BASE_DIR, "submissions")
os.makedirs(SUBMISSIONS_DIR, exist_ok=True)

app = Flask(__name__, static_folder=STATIC_DIR)


@app.route("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


@app.route("/<path:path>")
def static_proxy(path):
    return send_from_directory(STATIC_DIR, path)


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "online",
        "service": "PXL Web NetSim (CiscoExa NextGen)",
        "version": "2.0.0",
        "institution": "Hogeschool PXL - SNE"
    })


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

        return jsonify({
            "status": "success",
            "message": "Inzending succesvol opgeslagen op de server",
            "filename": filename
        })
    except Exception as e:
        return jsonify({"error": f"Kon inzending niet opslaan: {str(e)}"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"============================================================")
    print(f"  PXL Web NetSim • Cisco IOS Lab & Exam Platform (v2.0)")
    print(f"  © Parren, Van Waeyenberg, Frissaer, Jean, Hombroeks")
    print(f"  Hogeschool PXL (Toegepaste Informatica / SNE)")
    print(f"============================================================")
    print(f"  Live Server actief op: http://localhost:{port}")
    print(f"  Geschikt voor Schoolyear Kiosk Lockdown (1 URL)")
    print(f"============================================================")
    app.run(host="0.0.0.0", port=port, debug=False)

