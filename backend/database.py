"""
database.py - SQLite Persistence & Authentication Engine for PXL Web NetSim
Part of PXL Web NetSim (Hogeschool PXL)
© Parren, Van Waeyenberg, Frissaer, Jean, Hombroeks
"""

import os
import sqlite3
import hashlib
import json
import csv
import re
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

def _add_column_if_not_exists(cursor, table_name, column_name, col_type):
    cursor.execute(f"PRAGMA table_info({table_name});")
    cols = [r[1].lower() for r in cursor.fetchall()]
    if column_name.lower() not in cols:
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {col_type};")

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
        first_name TEXT DEFAULT '',
        last_name TEXT DEFAULT '',
        academic_year TEXT DEFAULT '2026-27',
        program TEXT DEFAULT '',
        class_group TEXT DEFAULT '',
        raw_display_name TEXT DEFAULT '',
        role TEXT NOT NULL DEFAULT 'student', -- 'teacher' or 'student'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Ensure all columns exist in users table
    _add_column_if_not_exists(cursor, 'users', 'first_name', "TEXT DEFAULT ''")
    _add_column_if_not_exists(cursor, 'users', 'last_name', "TEXT DEFAULT ''")
    _add_column_if_not_exists(cursor, 'users', 'academic_year', "TEXT DEFAULT '2026-27'")
    _add_column_if_not_exists(cursor, 'users', 'program', "TEXT DEFAULT ''")
    _add_column_if_not_exists(cursor, 'users', 'raw_display_name', "TEXT DEFAULT ''")

    # Student saves table (auto-save per user per exam)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS student_saves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        exam_id TEXT NOT NULL,
        topology_json TEXT NOT NULL,
        running_config_json TEXT DEFAULT '{}',
        score INTEGER DEFAULT 0,
        max_score INTEGER DEFAULT 100,
        percentage REAL DEFAULT 0.0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE (user_id, exam_id)
    );
    """)

    # Ensure running_config_json column exists
    _add_column_if_not_exists(cursor, 'student_saves', 'running_config_json', "TEXT DEFAULT '{}'")

    # Custom teacher exams table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS exams (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        instructions TEXT,
        topology_json TEXT,
        rubric_json TEXT,
        time_limit_minutes INTEGER DEFAULT 80,
        is_active INTEGER DEFAULT 1,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Exam assignments table: open exams for classes or students with time limit
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS exam_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        target_type TEXT NOT NULL, -- 'class', 'student', or 'all'
        target_value TEXT NOT NULL, -- e.g. '1SNEb', '12603952', '*'
        time_limit_minutes INTEGER DEFAULT 80,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (exam_id, target_type, target_value)
    );
    """)

    # System settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
                """INSERT INTO users (username, password_hash, full_name, first_name, last_name, role, class_group)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (u, hash_password(p), name, name.split()[0], name.split()[-1], role, grp)
            )

    # Seed default student accounts for quick testing
    default_students = [
        ('student1', 'PXL2026!', 'Test Student 1', 'student', '1TIN-A'),
        ('student2', 'PXL2026!', 'Test Student 2', 'student', '1TIN-B')
    ]
    for u, p, name, role, grp in default_students:
        cursor.execute("SELECT id FROM users WHERE username = ?", (u,))
        if not cursor.fetchone():
            cursor.execute(
                """INSERT INTO users (username, password_hash, full_name, first_name, last_name, role, class_group)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (u, hash_password(p), name, 'Test', 'Student', role, grp)
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
            'first_name': row['first_name'] or '',
            'last_name': row['last_name'] or '',
            'role': row['role'],
            'class_group': row['class_group'] or '',
            'program': row['program'] or '',
            'academic_year': row['academic_year'] or '2026-27'
        }
    return None

def create_or_update_user(username, password, full_name, role='student', class_group='',
                          first_name='', last_name='', academic_year='2026-27', program='', raw_display_name=''):
    conn = get_db()
    cursor = conn.cursor()
    p_hash = hash_password(password)

    if not first_name and not last_name and ' ' in full_name:
        parts = full_name.strip().split(' ', 1)
        first_name = parts[0]
        last_name = parts[1]

    cursor.execute("SELECT id FROM users WHERE username = ?", (username.strip(),))
    existing = cursor.fetchone()
    if existing:
        cursor.execute("""
            UPDATE users SET password_hash = ?, full_name = ?, role = ?, class_group = ?,
                             first_name = ?, last_name = ?, academic_year = ?, program = ?, raw_display_name = ?
            WHERE id = ?
        """, (p_hash, full_name.strip(), role, class_group.strip(),
              first_name.strip(), last_name.strip(), academic_year.strip(), program.strip(), raw_display_name.strip(),
              existing['id']))
        user_id = existing['id']
    else:
        cursor.execute("""
            INSERT INTO users (username, password_hash, full_name, role, class_group,
                               first_name, last_name, academic_year, program, raw_display_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (username.strip(), p_hash, full_name.strip(), role, class_group.strip(),
              first_name.strip(), last_name.strip(), academic_year.strip(), program.strip(), raw_display_name.strip()))
        user_id = cursor.lastrowid

    conn.commit()
    conn.close()
    return user_id

def delete_user(user_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM student_saves WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return True

def delete_users_bulk(user_ids):
    if not user_ids:
        return 0
    conn = get_db()
    cursor = conn.cursor()
    placeholders = ','.join('?' for _ in user_ids)
    cursor.execute(f"DELETE FROM student_saves WHERE user_id IN ({placeholders})", user_ids)
    cursor.execute(f"DELETE FROM users WHERE id IN ({placeholders}) AND role != 'teacher'", user_ids)
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    return deleted

def move_users_to_class(user_ids, new_class_group):
    if not user_ids:
        return 0
    conn = get_db()
    cursor = conn.cursor()
    placeholders = ','.join('?' for _ in user_ids)
    cursor.execute(
        f"UPDATE users SET class_group = ? WHERE id IN ({placeholders})",
        [new_class_group.strip()] + list(user_ids)
    )
    updated = cursor.rowcount
    conn.commit()
    conn.close()
    return updated

def parse_blackboard_student_row(raw_last, first, uname, default_password='PXL2026!'):
    """
    Parses Blackboard format:
    Achternaam: Abbiusi (2026-27 - GRSNE - 1SNEb) or Awaja (2026-27 - PBTIN - SNB - 1TINf)
    Voornaam: Matteo
    Gebruikersnaam: 12603952
    """
    m = re.match(r'^(.*?)\s*\((.*?)\)$', raw_last.strip())
    if m:
        last_name = m.group(1).strip()
        bracket_content = m.group(2).strip()
        bracket_parts = [p.strip() for p in bracket_content.split(' - ')]
        acad_year = bracket_parts[0] if len(bracket_parts) > 0 else '2026-27'
        program = bracket_parts[1] if len(bracket_parts) > 1 else ''
        class_grp = bracket_parts[-1] if len(bracket_parts) > 2 else ''
    else:
        last_name = raw_last.strip()
        acad_year = '2026-27'
        program = ''
        class_grp = 'Algemeen'

    first_name = first.strip()
    full_name = f"{first_name} {last_name}".strip()
    raw_display = f"{raw_last.strip()}, {first_name}"
    return {
        'username': uname.strip(),
        'password': default_password,
        'full_name': full_name,
        'first_name': first_name,
        'last_name': last_name,
        'academic_year': acad_year,
        'program': program,
        'class_group': class_grp,
        'raw_display_name': raw_display
    }

def import_blackboard_csv(csv_text, default_password='PXL2026!'):
    lines = csv_text.strip().splitlines()
    created = 0
    updated = 0
    errors = []

    # Detect delimiter
    first_non_empty = next((l for l in lines if l.strip()), '')
    delimiter = ';' if ';' in first_non_empty else ','

    reader = csv.reader(lines, delimiter=delimiter)
    header = next(reader, None)

    conn = get_db()
    cursor = conn.cursor()

    for idx, row in enumerate(reader, start=2):
        if not row or len(row) < 2:
            continue

        # Check if Blackboard format (Achternaam, Voornaam, Gebruikersnaam)
        if len(row) >= 3 and not row[0].lower().startswith('username') and not row[0].lower().startswith('achternaam'):
            raw_last = row[0].strip()
            first = row[1].strip()
            uname = row[2].strip()

            if not uname:
                continue

            parsed = parse_blackboard_student_row(raw_last, first, uname, default_password)
            try:
                p_hash = hash_password(parsed['password'])
                cursor.execute("SELECT id FROM users WHERE username = ?", (parsed['username'],))
                is_exist = cursor.fetchone()

                if is_exist:
                    cursor.execute("""
                        UPDATE users SET password_hash = ?, full_name = ?, role = 'student', class_group = ?,
                                         first_name = ?, last_name = ?, academic_year = ?, program = ?, raw_display_name = ?
                        WHERE id = ?
                    """, (p_hash, parsed['full_name'], parsed['class_group'],
                          parsed['first_name'], parsed['last_name'], parsed['academic_year'], parsed['program'], parsed['raw_display_name'],
                          is_exist['id']))
                    updated += 1
                else:
                    cursor.execute("""
                        INSERT INTO users (username, password_hash, full_name, role, class_group,
                                           first_name, last_name, academic_year, program, raw_display_name)
                        VALUES (?, ?, ?, 'student', ?, ?, ?, ?, ?, ?)
                    """, (parsed['username'], p_hash, parsed['full_name'], parsed['class_group'],
                          parsed['first_name'], parsed['last_name'], parsed['academic_year'], parsed['program'], parsed['raw_display_name']))
                    created += 1
            except Exception as e:
                errors.append(f"Regel {idx} ({parsed['username']}): {str(e)}")

        # Fallback standard format: username;password;full_name;class
        elif len(row) >= 2:
            clean_parts = [p.strip() for p in row]
            uname = clean_parts[0]
            pwd = clean_parts[1] if len(clean_parts) > 1 and clean_parts[1] else default_password
            fname = clean_parts[2] if len(clean_parts) > 2 and clean_parts[2] else uname
            cgroup = clean_parts[3] if len(clean_parts) > 3 and clean_parts[3] else 'Algemeen'
            try:
                p_hash = hash_password(pwd)
                cursor.execute("SELECT id FROM users WHERE username = ?", (uname,))
                is_exist = cursor.fetchone()

                if is_exist:
                    cursor.execute("""
                        UPDATE users SET password_hash = ?, full_name = ?, class_group = ?
                        WHERE id = ?
                    """, (p_hash, fname, cgroup, is_exist['id']))
                    updated += 1
                else:
                    cursor.execute("""
                        INSERT INTO users (username, password_hash, full_name, role, class_group)
                        VALUES (?, ?, ?, 'student', ?)
                    """, (uname, p_hash, fname, cgroup))
                    created += 1
            except Exception as e:
                errors.append(f"Regel {idx} ({uname}): {str(e)}")

    conn.commit()
    conn.close()

    return {
        'created': created,
        'updated': updated,
        'errors': errors
    }

def bulk_import_students(csv_text):
    return import_blackboard_csv(csv_text, default_password='PXL2026!')

def get_distinct_classes():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT class_group
        FROM users
        WHERE role = 'student' AND class_group IS NOT NULL AND class_group != ''
        ORDER BY class_group
    """)
    rows = cursor.fetchall()
    conn.close()
    return [r['class_group'] for r in rows]

def get_distinct_programs():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT program
        FROM users
        WHERE role = 'student' AND program IS NOT NULL AND program != ''
        ORDER BY program
    """)
    rows = cursor.fetchall()
    conn.close()
    return [r['program'] for r in rows]

def list_students(class_groups=None, search=None):
    conn = get_db()
    cursor = conn.cursor()

    query = """
        SELECT id, username, full_name, first_name, last_name, academic_year,
               program, class_group, raw_display_name, role, created_at
        FROM users
        WHERE role = 'student'
    """
    params = []

    if class_groups:
        placeholders = ','.join('?' for _ in class_groups)
        query += f" AND class_group IN ({placeholders})"
        params.extend(class_groups)

    if search:
        s = f"%{search.strip()}%"
        query += " AND (username LIKE ? OR full_name LIKE ? OR raw_display_name LIKE ?)"
        params.extend([s, s, s])

    query += " ORDER BY class_group, last_name, first_name"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return [dict(r) for r in rows]

def save_student_progress(user_id, exam_id, topology_dict, score=0, max_score=100, percentage=0.0, running_config=None):
    conn = get_db()
    cursor = conn.cursor()
    topology_str = json.dumps(topology_dict)
    run_cfg_str = json.dumps(running_config or {})

    cursor.execute("""
        INSERT INTO student_saves (user_id, exam_id, topology_json, running_config_json, score, max_score, percentage, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, exam_id) DO UPDATE SET
            topology_json = excluded.topology_json,
            running_config_json = excluded.running_config_json,
            score = excluded.score,
            max_score = excluded.max_score,
            percentage = excluded.percentage,
            updated_at = CURRENT_TIMESTAMP;
    """, (user_id, exam_id, topology_str, run_cfg_str, score, max_score, percentage))

    conn.commit()
    conn.close()
    return True

def get_student_progress(user_id, exam_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT topology_json, running_config_json, score, max_score, percentage, updated_at
        FROM student_saves
        WHERE user_id = ? AND exam_id = ?
    """, (user_id, exam_id))
    row = cursor.fetchone()
    conn.close()

    if row:
        return {
            'topology': json.loads(row['topology_json']),
            'running_config': json.loads(row['running_config_json'] or '{}'),
            'score': row['score'],
            'max_score': row['max_score'],
            'percentage': row['percentage'],
            'updated_at': row['updated_at']
        }
    return None

def reset_student_exam(user_ids, exam_id=None):
    """Clears saved topology, scores and running configs for given users and exam so they can restart fresh."""
    if not user_ids:
        return 0
    conn = get_db()
    cursor = conn.cursor()
    placeholders = ','.join('?' for _ in user_ids)

    if exam_id:
        cursor.execute(
            f"DELETE FROM student_saves WHERE user_id IN ({placeholders}) AND exam_id = ?",
            list(user_ids) + [exam_id]
        )
    else:
        cursor.execute(
            f"DELETE FROM student_saves WHERE user_id IN ({placeholders})",
            list(user_ids)
        )
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    return deleted

def list_students_with_progress(exam_id='01_pxl_standard', class_groups=None, search=None):
    conn = get_db()
    cursor = conn.cursor()

    query = """
        SELECT u.id, u.username, u.full_name, u.first_name, u.last_name,
               u.academic_year, u.program, u.class_group, u.raw_display_name, u.created_at,
               s.score, s.max_score, s.percentage, s.updated_at as last_saved
        FROM users u
        LEFT JOIN student_saves s ON u.id = s.user_id AND s.exam_id = ?
        WHERE u.role = 'student'
    """
    params = [exam_id]

    if class_groups:
        placeholders = ','.join('?' for _ in class_groups)
        query += f" AND u.class_group IN ({placeholders})"
        params.extend(class_groups)

    if search:
        s = f"%{search.strip()}%"
        query += " AND (u.username LIKE ? OR u.full_name LIKE ? OR u.raw_display_name LIKE ?)"
        params.extend([s, s, s])

    query += " ORDER BY u.class_group, u.last_name, u.first_name"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    students = []
    for r in rows:
        students.append({
            'id': r['id'],
            'username': r['username'],
            'full_name': r['full_name'],
            'first_name': r['first_name'] or '',
            'last_name': r['last_name'] or '',
            'academic_year': r['academic_year'] or '2026-27',
            'program': r['program'] or '',
            'class_group': r['class_group'] or '',
            'raw_display_name': r['raw_display_name'] or '',
            'score': r['score'] if r['score'] is not None else 0,
            'max_score': r['max_score'] if r['max_score'] is not None else 100,
            'percentage': round(r['percentage'], 1) if r['percentage'] is not None else 0.0,
            'last_saved': r['last_saved'] or '-'
        })
    return students

# --- EXAM ASSIGNMENT MANAGEMENT ---
def assign_exam(exam_id, title, target_type, target_value, time_limit_minutes=80, is_active=1):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO exam_assignments (exam_id, title, target_type, target_value, time_limit_minutes, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(exam_id, target_type, target_value) DO UPDATE SET
            title = excluded.title,
            time_limit_minutes = excluded.time_limit_minutes,
            is_active = excluded.is_active;
    """, (exam_id, title, target_type, target_value, time_limit_minutes, is_active))
    conn.commit()
    conn.close()
    return True

def get_exam_assignments(exam_id=None):
    conn = get_db()
    cursor = conn.cursor()
    if exam_id:
        cursor.execute("SELECT * FROM exam_assignments WHERE exam_id = ? ORDER BY created_at DESC", (exam_id,))
    else:
        cursor.execute("SELECT * FROM exam_assignments ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_exam_assignment(assignment_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM exam_assignments WHERE id = ?", (assignment_id,))
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    return deleted > 0

def toggle_exam_assignment(assignment_id, is_active):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE exam_assignments SET is_active = ? WHERE id = ?", (1 if is_active else 0, assignment_id))
    conn.commit()
    conn.close()
    return True

def get_assigned_exam_for_student(user_id_or_username):
    """Finds if an exam is specifically assigned/open for this student or student's class."""
    conn = get_db()
    cursor = conn.cursor()

    if isinstance(user_id_or_username, int) or str(user_id_or_username).isdigit():
        cursor.execute("SELECT * FROM users WHERE id = ? OR username = ?", (user_id_or_username, str(user_id_or_username)))
    else:
        cursor.execute("SELECT * FROM users WHERE username = ?", (str(user_id_or_username).strip(),))
    user = cursor.fetchone()

    if not user:
        conn.close()
        return None

    username = user['username']
    class_group = user['class_group'] or ''

    # Check direct user assignment first, then class assignment, then all ('*')
    cursor.execute("""
        SELECT * FROM exam_assignments
        WHERE is_active = 1 AND (
            (target_type = 'student' AND target_value = ?) OR
            (target_type = 'class' AND target_value = ?) OR
            (target_type = 'all' OR target_value = '*')
        )
        ORDER BY CASE target_type WHEN 'student' THEN 1 WHEN 'class' THEN 2 ELSE 3 END
        LIMIT 1
    """, (username, class_group))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

# --- SYSTEM SETTINGS ---
def get_system_setting(key: str, default: str = None) -> str:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM system_settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    return row['value'] if row else default

def set_system_setting(key: str, value: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    """, (key, str(value)))
    conn.commit()
    conn.close()
