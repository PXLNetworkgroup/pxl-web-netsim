"""
database.py - SQLite Persistence & Authentication Engine for PXL Web NetSim
Part of PXL Web NetSim (Hogeschool PXL)
© Parren, Van Waeyenberg, Frissaer, Jean, Hombroeks
"""

import os
import sqlite3
import hashlib
import json
from datetime import datetime

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
DB_PATH = os.path.join(DB_DIR, 'netsim.db')

def get_db():
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password: str) -> str:
    salt = "pxl_netsim_secure_salt_2026"
    return hashlib.sha256((salt + password).encode('utf-8')).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Users table (teachers & students)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student', -- 'teacher' or 'student'
        class_group TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Student saves table (1-minute auto-save per user per exam)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS student_saves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        exam_id TEXT NOT NULL,
        topology_json TEXT NOT NULL,
        score INTEGER DEFAULT 0,
        max_score INTEGER DEFAULT 100,
        percentage REAL DEFAULT 0.0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE (user_id, exam_id)
    );
    """)

    # Custom teacher exams table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS exams (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        instructions TEXT,
        topology_json TEXT,
        rubric_json TEXT,
        time_limit_minutes INTEGER DEFAULT 80,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Seed default teacher accounts if not exists
    default_teachers = [
        ('teacher', 'SinterklaasOp6December', 'Docent PXL (Gert & David)', 'teacher', 'PXL-SNE'),
        ('david', 'PXL_Teacher2026!', 'David Parren', 'teacher', 'PXL-SNE')
    ]
    for u, p, name, role, grp in default_teachers:
        cursor.execute("SELECT id FROM users WHERE username = ?", (u,))
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO users (username, password_hash, full_name, role, class_group) VALUES (?, ?, ?, ?, ?)",
                (u, hash_password(p), name, role, grp)
            )

    # Seed default student accounts for testing
    default_students = [
        ('student1', 'PXL2026!', 'Test Student 1', 'student', '1TIN-A'),
        ('student2', 'PXL2026!', 'Test Student 2', 'student', '1TIN-B')
    ]
    for u, p, name, role, grp in default_students:
        cursor.execute("SELECT id FROM users WHERE username = ?", (u,))
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO users (username, password_hash, full_name, role, class_group) VALUES (?, ?, ?, ?, ?)",
                (u, hash_password(p), name, role, grp)
            )

    conn.commit()
    conn.close()

def authenticate_user(username, password):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username.strip(),))
    row = cursor.fetchone()
    conn.close()

    if row and verify_password(password, row['password_hash']):
        return {
            'id': row['id'],
            'username': row['username'],
            'full_name': row['full_name'],
            'role': row['role'],
            'class_group': row['class_group']
        }
    return None

def create_or_update_user(username, password, full_name, role='student', class_group=''):
    conn = get_db()
    cursor = conn.cursor()
    p_hash = hash_password(password)

    cursor.execute("SELECT id FROM users WHERE username = ?", (username.strip(),))
    existing = cursor.fetchone()
    if existing:
        cursor.execute("""
            UPDATE users SET password_hash = ?, full_name = ?, role = ?, class_group = ?
            WHERE id = ?
        """, (p_hash, full_name.strip(), role, class_group.strip(), existing['id']))
        user_id = existing['id']
    else:
        cursor.execute("""
            INSERT INTO users (username, password_hash, full_name, role, class_group)
            VALUES (?, ?, ?, ?, ?)
        """, (username.strip(), p_hash, full_name.strip(), role, class_group.strip()))
        user_id = cursor.lastrowid

    conn.commit()
    conn.close()
    return user_id

def bulk_import_students(csv_text):
    """
    Accepts CSV content with semicolon or comma delimiters:
    username;password;full_name;class
    e.g.
    jparren;Welkom2026!;Jonas Parren;1TIN-A
    """
    lines = csv_text.strip().splitlines()
    created = 0
    updated = 0
    errors = []

    for idx, line in enumerate(lines, start=1):
        clean = line.strip()
        if not clean or clean.startswith('#') or clean.lower().startswith('username'):
            continue
        delimiter = ';' if ';' in clean else ','
        parts = [p.strip() for p in clean.split(delimiter)]
        if len(parts) < 2:
            errors.append(f"Regel {idx}: Minimaal username en wachtwoord vereist ('{clean}')")
            continue

        username = parts[0]
        password = parts[1]
        full_name = parts[2] if len(parts) > 2 and parts[2] else username
        class_group = parts[3] if len(parts) > 3 and parts[3] else 'Algemeen'

        try:
            conn = get_db()
            cur = conn.cursor()
            cur.execute("SELECT id FROM users WHERE username = ?", (username,))
            is_exist = cur.fetchone()
            conn.close()

            create_or_update_user(username, password, full_name, role='student', class_group=class_group)
            if is_exist:
                updated += 1
            else:
                created += 1
        except Exception as e:
            errors.append(f"Regel {idx} ({username}): {str(e)}")

    return {
        'created': created,
        'updated': updated,
        'errors': errors
    }

def save_student_progress(user_id, exam_id, topology_dict, score=0, max_score=100, percentage=0.0):
    conn = get_db()
    cursor = conn.cursor()
    topology_str = json.dumps(topology_dict)

    cursor.execute("""
        INSERT INTO student_saves (user_id, exam_id, topology_json, score, max_score, percentage, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, exam_id) DO UPDATE SET
            topology_json = excluded.topology_json,
            score = excluded.score,
            max_score = excluded.max_score,
            percentage = excluded.percentage,
            updated_at = CURRENT_TIMESTAMP;
    """, (user_id, exam_id, topology_str, score, max_score, percentage))

    conn.commit()
    conn.close()
    return True

def get_student_progress(user_id, exam_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT topology_json, score, max_score, percentage, updated_at
        FROM student_saves
        WHERE user_id = ? AND exam_id = ?
    """, (user_id, exam_id))
    row = cursor.fetchone()
    conn.close()

    if row:
        return {
            'topology': json.loads(row['topology_json']),
            'score': row['score'],
            'max_score': row['max_score'],
            'percentage': row['percentage'],
            'updated_at': row['updated_at']
        }
    return None

def list_students_with_progress(exam_id='01_pxl_standard'):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.username, u.full_name, u.class_group, u.created_at,
               s.score, s.max_score, s.percentage, s.updated_at as last_saved
        FROM users u
        LEFT JOIN student_saves s ON u.id = s.user_id AND s.exam_id = ?
        WHERE u.role = 'student'
        ORDER BY u.class_group, u.full_name
    """, (exam_id,))
    rows = cursor.fetchall()
    conn.close()

    students = []
    for r in rows:
        students.append({
            'id': r['id'],
            'username': r['username'],
            'full_name': r['full_name'],
            'class_group': r['class_group'],
            'score': r['score'] if r['score'] is not None else 0,
            'max_score': r['max_score'] if r['max_score'] is not None else 100,
            'percentage': round(r['percentage'], 1) if r['percentage'] is not None else 0.0,
            'last_saved': r['last_saved'] or '-'
        })
    return students

