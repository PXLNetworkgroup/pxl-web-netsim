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

def seed_course_labs():
    """Populates all Network Essentials course labs and presets into the SQLite exams table."""
    conn = get_db()
    cursor = conn.cursor()
    labs_dir = os.path.join(DB_DIR, 'course_labs')
    if os.path.isdir(labs_dir):
        for fname in sorted(os.listdir(labs_dir)):
            if fname.lower().endswith('.json'):
                fpath = os.path.join(labs_dir, fname)
                try:
                    with open(fpath, 'r', encoding='utf-8') as f:
                        lab_data = json.load(f)
                    lab_id = lab_data.get('id') or lab_data.get('code')
                    if not lab_id:
                        continue
                    code = lab_data.get('code', '')
                    title = lab_data.get('title') or code or lab_id
                    if code and not title.startswith(code):
                        display_title = f"{code}: {title}"
                    else:
                        display_title = title
                    instr = lab_data.get('instructions', '')
                    time_limit = lab_data.get('timeLimitMinutes', 45)
                    topo = lab_data.get('initialTopology', {})
                    rubric = lab_data.get('rubric', [])

                    cursor.execute("""
                        INSERT INTO exams (id, title, instructions, topology_json, rubric_json, time_limit_minutes, is_active, category, created_by)
                        VALUES (?, ?, ?, ?, ?, ?, 1, 'course_lab', 'Gert Van Waeyenberg')
                        ON CONFLICT(id) DO UPDATE SET
                            title = excluded.title,
                            instructions = excluded.instructions,
                            topology_json = excluded.topology_json,
                            rubric_json = excluded.rubric_json,
                            time_limit_minutes = excluded.time_limit_minutes,
                            category = 'course_lab';
                    """, (lab_id, display_title, instr, json.dumps(topo), json.dumps(rubric), time_limit))
                except Exception as e:
                    print(f"Error seeding course lab {fname}: {e}")

    # Also seed standard preset exams if not exist
    presets = [
        ('01_pxl_standard', 'PXL SNE - Praktijkproef: Netwerken 1 Routing & Switching Basis',
         'Configureer de router en switch volgens het adresseringsschema. Zorg dat PC1 en PC2 kunnen pingen.',
         80, 'PXL SNE Team'),
        ('02_cabling_scratch', 'PXL SNE - Praktijkproef: Zelfstandig Bekabelen & Basisconfiguratie',
         'Plaats een Router (4331), een Switch (2960) en een PC. Verbind via correcte kabels en configureer IP.',
         60, 'PXL SNE Team'),
        ('03_wireless_lan', 'PXL SNE - Wireless LAN (WLAN) Setup met Access Point & WPA2-PSK',
         'Verbind AP met de switch, configureer SSID PXL-Guest en verbind de laptop draadloos.',
         45, 'PXL SNE Team')
    ]
    for pid, ptitle, pinstr, ptime, pauthor in presets:
        cursor.execute("SELECT id FROM exams WHERE id = ?", (pid,))
        if not cursor.fetchone():
            cursor.execute("""
                INSERT INTO exams (id, title, instructions, topology_json, rubric_json, time_limit_minutes, is_active, category, created_by)
                VALUES (?, ?, ?, '{}', '[]', ?, 1, 'preset', ?)
            """, (pid, ptitle, pinstr, ptime, pauthor))

    conn.commit()
    conn.close()

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

    # Ensure running_config_json & rubric_evaluation_json column exist
    _add_column_if_not_exists(cursor, 'student_saves', 'running_config_json', "TEXT DEFAULT '{}'")
    _add_column_if_not_exists(cursor, 'student_saves', 'rubric_evaluation_json', "TEXT DEFAULT '[]'")

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
        category TEXT DEFAULT 'custom', -- 'course_lab', 'pka_import', 'preset', 'custom'
        created_by TEXT DEFAULT 'teacher',
        kind TEXT DEFAULT 'lab', -- 'lab' or 'test'
        test_password TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    _add_column_if_not_exists(cursor, 'exams', 'is_active', "INTEGER DEFAULT 1")
    _add_column_if_not_exists(cursor, 'exams', 'category', "TEXT DEFAULT 'custom'")
    _add_column_if_not_exists(cursor, 'exams', 'created_by', "TEXT DEFAULT 'teacher'")
    _add_column_if_not_exists(cursor, 'exams', 'kind', "TEXT DEFAULT 'lab'")
    _add_column_if_not_exists(cursor, 'exams', 'test_password', "TEXT DEFAULT ''")

    # Exam assignments table: open exams for classes or students with time limit
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS exam_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        target_type TEXT NOT NULL, -- 'class', 'student', or 'all'
        target_value TEXT NOT NULL, -- e.g. '1SNEb', '12603952', '*'
        target_class TEXT DEFAULT '', -- e.g. '1SNEb' when target_type='student'
        time_limit_minutes INTEGER DEFAULT 80,
        is_active INTEGER DEFAULT 1,
        assignment_type TEXT DEFAULT 'lab', -- 'lab' or 'test'
        test_password TEXT DEFAULT '',
        is_started INTEGER DEFAULT 1, -- For tests: teacher toggles Start Test live!
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (exam_id, target_type, target_value)
    );
    """)

    _add_column_if_not_exists(cursor, 'exam_assignments', 'target_class', "TEXT DEFAULT ''")
    _add_column_if_not_exists(cursor, 'exam_assignments', 'assignment_type', "TEXT DEFAULT 'lab'")
    _add_column_if_not_exists(cursor, 'exam_assignments', 'test_password', "TEXT DEFAULT ''")
    _add_column_if_not_exists(cursor, 'exam_assignments', 'is_started', "INTEGER DEFAULT 1")

    # Toevoeg-wachtrij table: audit queue of all added student accounts with their class name
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS import_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        full_name TEXT NOT NULL,
        class_group TEXT NOT NULL,
        program TEXT DEFAULT '',
        academic_year TEXT DEFAULT '2026-27',
        source TEXT DEFAULT 'manual', -- 'manual', 'blackboard_csv', 'seed'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Bug reports table: diagnostics, full running configs, topology snapshot and resolution status
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bug_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bug_code TEXT UNIQUE NOT NULL,
        reporter_username TEXT NOT NULL,
        reporter_name TEXT NOT NULL,
        reporter_role TEXT NOT NULL DEFAULT 'student',
        reporter_class TEXT DEFAULT '',
        exam_id TEXT DEFAULT '',
        exam_title TEXT DEFAULT '',
        category TEXT DEFAULT 'general',
        user_description TEXT NOT NULL,
        topology_json TEXT NOT NULL DEFAULT '{}',
        device_configs_json TEXT NOT NULL DEFAULT '{}',
        browser_info_json TEXT DEFAULT '{}',
        status TEXT DEFAULT 'open', -- 'open' (🔴 Open) or 'resolved' (🟢 Resolved)
        resolution_notes TEXT DEFAULT '',
        resolved_by TEXT DEFAULT '',
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    _add_column_if_not_exists(cursor, 'bug_reports', 'category', "TEXT DEFAULT 'general'")
    _add_column_if_not_exists(cursor, 'bug_reports', 'status', "TEXT DEFAULT 'open'")
    _add_column_if_not_exists(cursor, 'bug_reports', 'resolution_notes', "TEXT DEFAULT ''")
    _add_column_if_not_exists(cursor, 'bug_reports', 'resolved_by', "TEXT DEFAULT ''")
    _add_column_if_not_exists(cursor, 'bug_reports', 'resolved_at', "TIMESTAMP")

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

    # Auto-seed from data/seeds/*.csv if database has fewer than 10 students
    cursor.execute("SELECT count(*) FROM users WHERE role = 'student'")
    st_count = cursor.fetchone()[0]
    if st_count < 10:
        seeds_dir = os.path.join(DB_DIR, 'seeds')
        if os.path.isdir(seeds_dir):
            for fname in sorted(os.listdir(seeds_dir)):
                if fname.lower().endswith('.csv'):
                    cpath = os.path.join(seeds_dir, fname)
                    try:
                        with open(cpath, 'r', encoding='utf-8-sig', errors='replace') as f:
                            import_blackboard_csv(f.read(), default_password='PXL2026!')
                    except Exception as e:
                        print(f"Error auto-seeding {fname}: {e}")

    # Backfill import_queue with existing students if empty
    cursor.execute("SELECT count(*) FROM import_queue")
    iq_cnt = cursor.fetchone()[0]
    if iq_cnt == 0:
        cursor.execute("SELECT username, full_name, class_group, program, academic_year, created_at FROM users WHERE role = 'student'")
        all_students = cursor.fetchall()
        for s in all_students:
            cursor.execute("""
                INSERT INTO import_queue (username, full_name, class_group, program, academic_year, source, created_at)
                VALUES (?, ?, ?, ?, ?, 'seed', ?)
            """, (s['username'], s['full_name'], s['class_group'] or '', s['program'] or '', s['academic_year'] or '2026-27', s['created_at']))
        conn.commit()

    conn.close()

    # Seed all Network Essentials course labs into SQLite exams table
    try:
        seed_course_labs()
    except Exception as e:
        print(f"Error seeding course labs: {e}")

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

    if role == 'student':
        cursor.execute("""
            INSERT INTO import_queue (username, full_name, class_group, program, academic_year, source, created_at)
            VALUES (?, ?, ?, ?, ?, 'manual', CURRENT_TIMESTAMP)
        """, (username.strip(), full_name.strip(), class_group.strip(), program.strip(), academic_year.strip()))

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
    bracket_match = re.match(r'^(.*?)\s*\((.*?)\)$', raw_last.strip())
    if bracket_match:
        last_name = bracket_match.group(1).strip()
        bracket_content = bracket_match.group(2).strip()
        if 'uitgeschreven' in bracket_content.lower():
            acad_year = '2026-27'
            program = 'Uitgeschreven'
            class_grp = 'Uitgeschreven'
        else:
            bracket_parts = [p.strip() for p in bracket_content.split(' - ')]
            acad_year = bracket_parts[0] if len(bracket_parts) > 0 else '2026-27'
            program = bracket_parts[1] if len(bracket_parts) > 1 else ''
            class_grp = bracket_parts[-1] if len(bracket_parts) >= 3 else 'Geen Klas'
    else:
        last_name = raw_last.strip()
        acad_year = '2026-27'
        program = ''
        class_grp = 'Geen Klas'

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

                # Record in import_queue
                cursor.execute("""
                    INSERT INTO import_queue (username, full_name, class_group, program, academic_year, source, created_at)
                    VALUES (?, ?, ?, ?, ?, 'blackboard_csv', CURRENT_TIMESTAMP)
                """, (parsed['username'], parsed['full_name'], parsed['class_group'], parsed['program'], parsed['academic_year']))
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

                # Record in import_queue
                cursor.execute("""
                    INSERT INTO import_queue (username, full_name, class_group, program, academic_year, source, created_at)
                    VALUES (?, ?, ?, '', '2026-27', 'blackboard_csv', CURRENT_TIMESTAMP)
                """, (uname, fname, cgroup))
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

def save_student_progress(user_id, exam_id, topology_dict, score=0, max_score=100, percentage=0.0, running_config=None, rubric_eval=None):
    conn = get_db()
    cursor = conn.cursor()
    topology_str = json.dumps(topology_dict)
    run_cfg_str = json.dumps(running_config or {})
    rubric_str = json.dumps(rubric_eval or [])

    cursor.execute("""
        INSERT INTO student_saves (user_id, exam_id, topology_json, running_config_json, rubric_evaluation_json, score, max_score, percentage, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, exam_id) DO UPDATE SET
            topology_json = excluded.topology_json,
            running_config_json = excluded.running_config_json,
            rubric_evaluation_json = excluded.rubric_evaluation_json,
            score = excluded.score,
            max_score = excluded.max_score,
            percentage = excluded.percentage,
            updated_at = CURRENT_TIMESTAMP;
    """, (user_id, exam_id, topology_str, run_cfg_str, rubric_str, score, max_score, percentage))

    conn.commit()
    conn.close()
    return True

def get_student_progress(user_id, exam_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT topology_json, running_config_json, rubric_evaluation_json, score, max_score, percentage, updated_at
        FROM student_saves
        WHERE user_id = ? AND exam_id = ?
    """, (user_id, exam_id))
    row = cursor.fetchone()
    conn.close()

    if row:
        rubric_eval = []
        try:
            rubric_eval = json.loads(row['rubric_evaluation_json'] or '[]')
        except Exception:
            rubric_eval = []
        return {
            'topology': json.loads(row['topology_json']),
            'running_config': json.loads(row['running_config_json'] or '{}'),
            'rubric_evaluation': rubric_eval,
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
def assign_exam(exam_id, title, target_type, target_value, target_class='', time_limit_minutes=80, is_active=1, assignment_type='lab', test_password='', is_started=None):
    if is_started is None:
        is_started = 1 if assignment_type == 'lab' else 0
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO exam_assignments (exam_id, title, target_type, target_value, target_class, time_limit_minutes, is_active, assignment_type, test_password, is_started, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(exam_id, target_type, target_value) DO UPDATE SET
            title = excluded.title,
            target_class = excluded.target_class,
            time_limit_minutes = excluded.time_limit_minutes,
            is_active = excluded.is_active,
            assignment_type = excluded.assignment_type,
            test_password = excluded.test_password,
            is_started = excluded.is_started;
    """, (exam_id, title, target_type, target_value, target_class, time_limit_minutes, is_active, assignment_type, test_password, 1 if is_started else 0))
    conn.commit()
    conn.close()
    return True

def assign_exam_batch(exam_id, title, targets, time_limit_minutes=80, is_active=1, assignment_type='lab', test_password='', is_started=None):
    """
    Assigns exam to multiple targets at once.
    targets is a list of dicts: [{'type': 'class', 'value': '1SNEb', 'class': '1SNEb'}, ...]
    """
    if not targets:
        return 0
    if is_started is None:
        is_started = 1 if assignment_type == 'lab' else 0

    conn = get_db()
    cursor = conn.cursor()
    count = 0
    for t in targets:
        if isinstance(t, str):
            if t.startswith('class:'):
                ttype = 'class'
                tval = t.split(':', 1)[1].strip()
                tcls = tval
            elif t.startswith('student:'):
                ttype = 'student'
                tval = t.split(':', 1)[1].strip()
                tcls = ''
            elif t == '*':
                ttype = 'all'
                tval = '*'
                tcls = ''
            else:
                ttype = 'class'
                tval = t.strip()
                tcls = tval
        elif isinstance(t, dict):
            ttype = t.get('type', 'class')
            tval = t.get('value', '').strip()
            tcls = t.get('class', '').strip()
        else:
            continue
        if not tval:
            continue
        cursor.execute("""
            INSERT INTO exam_assignments (exam_id, title, target_type, target_value, target_class, time_limit_minutes, is_active, assignment_type, test_password, is_started, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(exam_id, target_type, target_value) DO UPDATE SET
                title = excluded.title,
                target_class = excluded.target_class,
                time_limit_minutes = excluded.time_limit_minutes,
                is_active = excluded.is_active,
                assignment_type = excluded.assignment_type,
                test_password = excluded.test_password,
                is_started = excluded.is_started;
        """, (exam_id, title, ttype, tval, tcls, time_limit_minutes, is_active, assignment_type, test_password, 1 if is_started else 0))
        count += 1
    conn.commit()
    conn.close()
    return count

# --- EXAMS MANAGEMENT & PERSISTENCE ---
def save_exam(exam_id, title, instructions='', topology=None, rubric=None, time_limit_minutes=80, is_active=1, category='custom', created_by='teacher', kind='lab', test_password=''):
    if not title or not title.strip():
        raise ValueError("Examen/opdracht naam is verplicht")
    if not exam_id or not exam_id.strip():
        clean_name = re.sub(r'[^a-zA-Z0-9_]', '_', title.lower().strip())[:30]
        exam_id = f"{clean_name}_{int(datetime.now().timestamp())}"

    conn = get_db()
    cursor = conn.cursor()
    topo_str = json.dumps(topology) if isinstance(topology, (dict, list)) else (topology or '{}')
    rubric_str = json.dumps(rubric) if isinstance(rubric, list) else (rubric or '[]')

    cursor.execute("""
        INSERT INTO exams (id, title, instructions, topology_json, rubric_json, time_limit_minutes, is_active, category, created_by, kind, test_password, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            instructions = excluded.instructions,
            topology_json = excluded.topology_json,
            rubric_json = excluded.rubric_json,
            time_limit_minutes = excluded.time_limit_minutes,
            is_active = excluded.is_active,
            category = excluded.category,
            created_by = excluded.created_by,
            kind = excluded.kind,
            test_password = excluded.test_password;
    """, (exam_id.strip(), title.strip(), instructions or '', topo_str, rubric_str, time_limit_minutes, is_active, category, created_by, kind, test_password))
    conn.commit()
    conn.close()
    return exam_id.strip()

def list_exams():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT e.id, e.title, e.instructions, e.time_limit_minutes, e.is_active, e.category, e.created_by, e.created_at,
               LENGTH(e.rubric_json) as rubric_len,
               COUNT(s.id) as total_saves,
               COUNT(CASE WHEN s.score > 0 THEN 1 END) as scored_count,
               MAX(s.score) as max_student_score
        FROM exams e
        LEFT JOIN student_saves s ON e.id = s.exam_id
        GROUP BY e.id
        ORDER BY CASE e.category WHEN 'pka_import' THEN 1 WHEN 'custom' THEN 2 WHEN 'course_lab' THEN 3 ELSE 4 END, e.title ASC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_exam_by_id(exam_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM exams WHERE id = ?", (exam_id.strip(),))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    try:
        topo = json.loads(row['topology_json'] or '{}')
    except Exception:
        topo = {}
    try:
        rubric = json.loads(row['rubric_json'] or '[]')
    except Exception:
        rubric = []
    return {
        'id': row['id'],
        'title': row['title'],
        'instructions': row['instructions'] or '',
        'topology': topo,
        'initialTopology': topo,
        'rubric': rubric,
        'time_limit_minutes': row['time_limit_minutes'] or 80,
        'timeLimitMinutes': row['time_limit_minutes'] or 80,
        'is_active': bool(row['is_active']),
        'category': row['category'] or 'custom',
        'created_by': row['created_by'] or 'teacher',
        'created_at': row['created_at']
    }

def delete_exam(exam_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM student_saves WHERE exam_id = ?", (exam_id.strip(),))
    cursor.execute("DELETE FROM exam_assignments WHERE exam_id = ?", (exam_id.strip(),))
    cursor.execute("DELETE FROM exams WHERE id = ?", (exam_id.strip(),))
    cnt = cursor.rowcount
    conn.commit()
    conn.close()
    return cnt > 0

def delete_exams_bulk(exam_ids):
    if not exam_ids:
        return 0
    clean_ids = [str(e).strip() for e in exam_ids if str(e).strip()]
    if not clean_ids:
        return 0
    conn = get_db()
    cursor = conn.cursor()
    placeholders = ','.join('?' for _ in clean_ids)
    cursor.execute(f"DELETE FROM student_saves WHERE exam_id IN ({placeholders})", clean_ids)
    cursor.execute(f"DELETE FROM exam_assignments WHERE exam_id IN ({placeholders})", clean_ids)
    cursor.execute(f"DELETE FROM exams WHERE id IN ({placeholders})", clean_ids)
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    return deleted

def list_all_student_scores(class_groups=None, search=None):
    """Retrieves all scores across all exams and tests taken by students."""
    conn = get_db()
    cursor = conn.cursor()
    query = """
        SELECT u.id as user_id, u.username, u.full_name, u.first_name, u.last_name,
               u.academic_year, u.program, u.class_group, u.raw_display_name,
               s.exam_id, COALESCE(e.title, s.exam_id) as exam_title, e.category as exam_category,
               s.score, s.max_score, s.percentage, s.updated_at as last_saved
        FROM users u
        INNER JOIN student_saves s ON u.id = s.user_id
        LEFT JOIN exams e ON s.exam_id = e.id
        WHERE u.role = 'student'
    """
    params = []
    if class_groups:
        placeholders = ','.join('?' for _ in class_groups)
        query += f" AND u.class_group IN ({placeholders})"
        params.extend(class_groups)
    if search:
        s = f"%{search.strip()}%"
        query += " AND (u.username LIKE ? OR u.full_name LIKE ? OR e.title LIKE ? OR s.exam_id LIKE ?)"
        params.extend([s, s, s, s])
    query += " ORDER BY u.class_group ASC, u.last_name ASC, u.first_name ASC, s.updated_at DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_scores_for_student(user_id):
    """Retrieves all test scores for a single student."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT s.exam_id, COALESCE(e.title, s.exam_id) as title, e.category,
               s.score, s.max_score, s.percentage, s.updated_at
        FROM student_saves s
        LEFT JOIN exams e ON s.exam_id = e.id
        WHERE s.user_id = ?
        ORDER BY s.updated_at DESC
    """, (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# --- TOEVOEG WACHTRIJ (AUDIT QUEUE) ---
def add_to_import_queue(username, full_name, class_group, program='', academic_year='2026-27', source='manual'):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO import_queue (username, full_name, class_group, program, academic_year, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    """, (username.strip(), full_name.strip(), class_group.strip(), program.strip(), academic_year.strip(), source))
    conn.commit()
    conn.close()

def get_import_queue(limit=500):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, username, full_name, class_group, program, academic_year, source, created_at
        FROM import_queue
        ORDER BY id DESC
        LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def clear_import_queue():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM import_queue")
    conn.commit()
    conn.close()
    return True

# --- HIERARCHICAL STUDENTS BY CLASS ---
def get_students_grouped_by_class():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, username, full_name, first_name, last_name, academic_year, program, class_group
        FROM users
        WHERE role = 'student'
        ORDER BY class_group ASC, last_name ASC, first_name ASC
    """)
    rows = cursor.fetchall()
    conn.close()

    groups = {}
    for r in rows:
        cg = r['class_group'] or 'Algemeen'
        if cg not in groups:
            groups[cg] = {
                'class_name': cg,
                'program': r['program'] or '',
                'academic_year': r['academic_year'] or '2026-27',
                'students': []
            }
        groups[cg]['students'].append({
            'id': r['id'],
            'username': r['username'],
            'full_name': r['full_name'],
            'first_name': r['first_name'] or '',
            'last_name': r['last_name'] or '',
            'program': r['program'] or '',
            'class_group': cg
        })
    return list(groups.values())

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

def toggle_assignment_test_started(assignment_id, is_started):
    """Teacher toggles the started status of an assigned test (start/pause test)."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE exam_assignments SET is_started = ? WHERE id = ?", (1 if is_started else 0, assignment_id))
    cnt = cursor.rowcount
    conn.commit()
    conn.close()
    return cnt > 0

def get_all_assigned_exams_for_student(user_id_or_username):
    """Finds all active assigned labs and tests for this student, including scores and rubric evaluations."""
    conn = get_db()
    cursor = conn.cursor()
    if isinstance(user_id_or_username, int) or str(user_id_or_username).isdigit():
        cursor.execute("SELECT * FROM users WHERE id = ? OR username = ?", (user_id_or_username, str(user_id_or_username)))
    else:
        cursor.execute("SELECT * FROM users WHERE username = ?", (str(user_id_or_username).strip(),))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return []

    user_id = user['id']
    username = user['username']
    class_group = user['class_group'] or ''

    cursor.execute("""
        SELECT a.id as assignment_id, a.exam_id, a.title as assignment_title, a.assignment_type,
               a.test_password as assignment_password, a.is_started, a.time_limit_minutes as assignment_time_limit,
               e.title as exam_title, e.category as exam_category, e.kind as exam_kind,
               e.test_password as exam_password, e.time_limit_minutes as exam_time_limit
        FROM exam_assignments a
        LEFT JOIN exams e ON a.exam_id = e.id
        WHERE a.is_active = 1 AND (
            (a.target_type = 'student' AND a.target_value = ?) OR
            (a.target_type = 'class' AND a.target_value = ?) OR
            (a.target_type = 'all' OR a.target_value = '*')
        )
        ORDER BY CASE a.target_type WHEN 'student' THEN 1 WHEN 'class' THEN 2 ELSE 3 END, a.id DESC
    """, (username, class_group))
    assignment_rows = cursor.fetchall()

    cursor.execute("""
        SELECT exam_id, score, max_score, percentage, rubric_evaluation_json, updated_at
        FROM student_saves
        WHERE user_id = ?
    """, (user_id,))
    saves = {r['exam_id']: dict(r) for r in cursor.fetchall()}
    conn.close()

    results = []
    seen_exam_ids = set()
    for row in assignment_rows:
        eid = row['exam_id']
        if eid in seen_exam_ids:
            continue
        seen_exam_ids.add(eid)

        kind = (row['assignment_type'] or row['exam_kind'] or 'lab').lower()
        title = row['assignment_title'] or row['exam_title'] or eid
        time_limit = row['assignment_time_limit'] or row['exam_time_limit'] or 80
        test_pw = (row['assignment_password'] or row['exam_password'] or '').strip()
        is_started = bool(row['is_started']) if kind == 'test' else True
        save = saves.get(eid)

        rubric_eval = []
        if save and save.get('rubric_evaluation_json'):
            try:
                rubric_eval = json.loads(save['rubric_evaluation_json'])
            except Exception:
                rubric_eval = []

        results.append({
            'assignment_id': row['assignment_id'],
            'exam_id': eid,
            'title': title,
            'category': row['exam_category'] or 'custom',
            'kind': kind,
            'assignment_type': kind,
            'time_limit_minutes': time_limit,
            'is_started': is_started,
            'has_password': bool(test_pw),
            'score': save['score'] if save else None,
            'max_score': save['max_score'] if save else None,
            'percentage': save['percentage'] if save else None,
            'last_saved': save['updated_at'] if save else None,
            'rubric_evaluation': rubric_eval
        })
    return results

def verify_test_access(user_id_or_username, exam_id, password=''):
    """Verifies whether a student can open and start a specific test."""
    conn = get_db()
    cursor = conn.cursor()
    if isinstance(user_id_or_username, int) or str(user_id_or_username).isdigit():
        cursor.execute("SELECT * FROM users WHERE id = ? OR username = ?", (user_id_or_username, str(user_id_or_username)))
    else:
        cursor.execute("SELECT * FROM users WHERE username = ?", (str(user_id_or_username).strip(),))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return {'ok': False, 'error': 'Gebruiker niet gevonden.'}

    if user['role'] in ('teacher', 'admin'):
        conn.close()
        return {'ok': True, 'role': user['role']}

    username = user['username']
    class_group = user['class_group'] or ''

    cursor.execute("""
        SELECT a.*, e.kind as exam_kind, e.test_password as exam_password
        FROM exam_assignments a
        LEFT JOIN exams e ON a.exam_id = e.id
        WHERE a.exam_id = ? AND a.is_active = 1 AND (
            (a.target_type = 'student' AND a.target_value = ?) OR
            (a.target_type = 'class' AND a.target_value = ?) OR
            (a.target_type = 'all' OR a.target_value = '*')
        )
        ORDER BY CASE a.target_type WHEN 'student' THEN 1 WHEN 'class' THEN 2 ELSE 3 END
        LIMIT 1
    """, (exam_id, username, class_group))
    row = cursor.fetchone()
    conn.close()

    if not row:
        conn = get_db()
        c2 = conn.cursor()
        c2.execute("SELECT kind, test_password FROM exams WHERE id = ?", (exam_id,))
        erow = c2.fetchone()
        conn.close()
        if erow and erow['kind'] == 'test':
            return {'ok': False, 'error': 'Deze test is niet aan jou of jouw klas toegewezen.'}
        return {'ok': True}

    kind = (row['assignment_type'] or row['exam_kind'] or 'lab').lower()
    if kind != 'test':
        return {'ok': True}

    if not bool(row['is_started']):
        return {'ok': False, 'error': 'De test is nog niet gestart door de docent voor jouw groep.'}

    expected_pw = (row['test_password'] or row['exam_password'] or '').strip()
    if expected_pw:
        if not password or password.strip() != expected_pw:
            return {'ok': False, 'error': 'Onjuist test wachtwoord.'}

    return {'ok': True}

def reset_student_lab(user_id_or_username, exam_id):
    """Students can reset practice labs themselves, but are blocked from resetting official tests."""
    conn = get_db()
    cursor = conn.cursor()
    if isinstance(user_id_or_username, int) or str(user_id_or_username).isdigit():
        cursor.execute("SELECT * FROM users WHERE id = ? OR username = ?", (user_id_or_username, str(user_id_or_username)))
    else:
        cursor.execute("SELECT * FROM users WHERE username = ?", (str(user_id_or_username).strip(),))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return {'ok': False, 'error': 'Gebruiker niet gevonden.'}

    user_id = user['id']

    # Check assignment/exam kind
    cursor.execute("""
        SELECT a.assignment_type, e.kind
        FROM exams e
        LEFT JOIN exam_assignments a ON e.id = a.exam_id
        WHERE e.id = ?
    """, (exam_id,))
    row = cursor.fetchone()

    is_test = False
    if row:
        if (row['assignment_type'] and row['assignment_type'].lower() == 'test') or (row['kind'] and row['kind'].lower() == 'test'):
            is_test = True

    if is_test:
        conn.close()
        return {'ok': False, 'error': 'Een officiële test kan enkel door een docent gereset worden.'}

    cursor.execute("DELETE FROM student_saves WHERE user_id = ? AND exam_id = ?", (user_id, exam_id))
    cnt = cursor.rowcount
    conn.commit()
    conn.close()
    return {'ok': True, 'message': f"Lab '{exam_id}' is gereset."}

def reset_student_exam_by_teacher(user_id, exam_id):
    """Allows teacher to reset any test or lab for a specific student."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM student_saves WHERE user_id = ? AND exam_id = ?", (user_id, exam_id))
    cnt = cursor.rowcount
    conn.commit()
    conn.close()
    return {'ok': True, 'message': f"Voortgang voor examen '{exam_id}' is gewist voor student #{user_id}."}

def change_user_password(user_id_or_username, old_password, new_password):
    """Allows student or teacher to change their own password."""
    if not new_password or len(str(new_password).strip()) < 4:
        return {'ok': False, 'error': 'Het nieuwe wachtwoord moet minimaal 4 tekens bevatten.'}

    conn = get_db()
    cursor = conn.cursor()
    if isinstance(user_id_or_username, int) or str(user_id_or_username).isdigit():
        cursor.execute("SELECT * FROM users WHERE id = ? OR username = ?", (user_id_or_username, str(user_id_or_username)))
    else:
        cursor.execute("SELECT * FROM users WHERE username = ?", (str(user_id_or_username).strip(),))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return {'ok': False, 'error': 'Gebruiker niet gevonden.'}

    if not verify_password(old_password, user['password_hash']):
        conn.close()
        return {'ok': False, 'error': 'Huidig wachtwoord is onjuist.'}

    new_hash = hash_password(str(new_password).strip())
    cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user['id']))
    conn.commit()
    conn.close()
    return {'ok': True, 'message': 'Wachtwoord succesvol gewijzigd.'}


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


# --- BUG REPORTS MANAGEMENT ---

def generate_bug_code() -> str:
    """Generates a human-friendly unique bug code like BUG-20261112-A3F8."""
    import secrets
    date_str = datetime.now().strftime('%Y%m%d')
    rand_hex = secrets.token_hex(2).upper()
    return f"BUG-{date_str}-{rand_hex}"

def create_bug_report(data: dict) -> dict:
    """
    Creates and stores a comprehensive bug snapshot in the database.
    Includes topology, running configurations, device tables, user description, and reporter metadata.
    """
    conn = get_db()
    cursor = conn.cursor()

    bug_code = data.get('bug_code') or generate_bug_code()
    reporter_username = data.get('reporter_username', 'anonymous')
    reporter_name = data.get('reporter_name', 'Onbekende Gebruiker')
    reporter_role = data.get('reporter_role', 'student')
    reporter_class = data.get('reporter_class', '')
    exam_id = data.get('exam_id', '')
    exam_title = data.get('exam_title', '')
    category = data.get('category', 'general')
    user_description = (data.get('user_description') or '').strip()
    if not user_description:
        user_description = "(Geen toelichting ingevoerd door melder)"

    topology_json = json.dumps(data.get('topology', {}))
    device_configs_json = json.dumps(data.get('device_configs', {}))
    browser_info_json = json.dumps(data.get('browser_info', {}))

    cursor.execute("""
        INSERT INTO bug_reports (
            bug_code, reporter_username, reporter_name, reporter_role, reporter_class,
            exam_id, exam_title, category, user_description,
            topology_json, device_configs_json, browser_info_json,
            status, resolution_notes, resolved_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', '', '')
    """, (
        bug_code, reporter_username, reporter_name, reporter_role, reporter_class,
        exam_id, exam_title, category, user_description,
        topology_json, device_configs_json, browser_info_json
    ))
    conn.commit()

    cursor.execute("SELECT * FROM bug_reports WHERE bug_code = ?", (bug_code,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else {'bug_code': bug_code}

def list_bug_reports(reporter_username: str = None, status_filter: str = None) -> list:
    """Returns a list of bug reports, optionally filtered by user or status."""
    conn = get_db()
    cursor = conn.cursor()

    query = "SELECT id, bug_code, reporter_username, reporter_name, reporter_role, reporter_class, exam_id, exam_title, category, user_description, status, resolution_notes, resolved_by, resolved_at, created_at FROM bug_reports WHERE 1=1"
    params = []

    if reporter_username:
        query += " AND reporter_username = ?"
        params.append(reporter_username)

    if status_filter and status_filter.lower() != 'all':
        query += " AND status = ?"
        params.append(status_filter.lower())

    query += " ORDER BY id DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_bug_report(bug_code: str) -> dict:
    """Returns the complete bug report including topology and device configurations."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM bug_reports WHERE bug_code = ? OR id = ?", (bug_code, str(bug_code)))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    try:
        d['topology'] = json.loads(d['topology_json'])
    except Exception:
        d['topology'] = {}
    try:
        d['device_configs'] = json.loads(d['device_configs_json'])
    except Exception:
        d['device_configs'] = {}
    try:
        d['browser_info'] = json.loads(d['browser_info_json'])
    except Exception:
        d['browser_info'] = {}
    return d

def update_bug_report_status(bug_code: str, status: str, resolution_notes: str = None, resolved_by: str = None) -> dict:
    """Marks a bug report as 'resolved' or 'open', with optional resolution explanation."""
    conn = get_db()
    cursor = conn.cursor()

    now_str = datetime.now().isoformat() if status == 'resolved' else None

    if resolution_notes is not None and resolved_by is not None:
        cursor.execute("""
            UPDATE bug_reports
            SET status = ?, resolution_notes = ?, resolved_by = ?, resolved_at = ?
            WHERE bug_code = ? OR id = ?
        """, (status, resolution_notes, resolved_by, now_str, bug_code, str(bug_code)))
    else:
        cursor.execute("""
            UPDATE bug_reports
            SET status = ?, resolved_at = COALESCE(?, resolved_at)
            WHERE bug_code = ? OR id = ?
        """, (status, now_str, bug_code, str(bug_code)))

    cnt = cursor.rowcount
    conn.commit()
    conn.close()
    return {'ok': cnt > 0, 'bug_code': bug_code, 'status': status}

def apply_bug_solution(solution_data: dict) -> dict:
    """
    Applies an AI or teacher-provided solution JSON back to the database.
    Updates status to 'resolved' and records the explanation and test instructions.
    """
    bug_code = solution_data.get('bug_code')
    if not bug_code:
        return {'ok': False, 'error': 'Geen bug_code gevonden in oplossing JSON.'}

    status = solution_data.get('status', 'resolved')
    resolution_notes = solution_data.get('resolution_notes') or solution_data.get('explanation') or solution_data.get('message', '')
    test_instr = solution_data.get('test_instructions', '')
    if test_instr:
        resolution_notes += f"\n\n[Test Instructie]: {test_instr}"

    resolved_by = solution_data.get('resolved_by', 'AI Assistant')
    return update_bug_report_status(bug_code, status, resolution_notes, resolved_by)

def delete_bug_report(bug_code: str) -> dict:
    """Deletes a bug report."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM bug_reports WHERE bug_code = ? OR id = ?", (bug_code, str(bug_code)))
    cnt = cursor.rowcount
    conn.commit()
    conn.close()
    return {'ok': cnt > 0, 'bug_code': bug_code}

