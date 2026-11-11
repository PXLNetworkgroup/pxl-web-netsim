import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.database import init_db, import_blackboard_csv, get_db

init_db()

grsne_path = r'C:\Users\PXL\Downloads\gc_2627-GRSNE-41SNE1010_columns_2026-11-11-11-53-46.csv'
pbtin_path = r'C:\Users\PXL\Downloads\gc_2627-PBTIN-41TIN1230_columns_2026-11-11-11-52-24.csv'

print("=== Importing GRSNE CSV ===")
with open(grsne_path, 'r', encoding='utf-8-sig') as f:
    res1 = import_blackboard_csv(f.read())
print(f"GRSNE Results -> Created: {res1['created']}, Updated: {res1['updated']}, Errors: {len(res1['errors'])}")
if res1['errors']:
    print("Errors:", res1['errors'][:5])

print("\n=== Importing PBTIN CSV ===")
with open(pbtin_path, 'r', encoding='utf-8-sig') as f:
    res2 = import_blackboard_csv(f.read())
print(f"PBTIN Results -> Created: {res2['created']}, Updated: {res2['updated']}, Errors: {len(res2['errors'])}")
if res2['errors']:
    print("Errors:", res2['errors'][:5])

conn = get_db()
cur = conn.cursor()
cur.execute("SELECT count(*) as cnt FROM users WHERE role = 'student'")
total_students = cur.fetchone()['cnt']

cur.execute("SELECT DISTINCT class_group, count(*) as c FROM users WHERE role = 'student' GROUP BY class_group ORDER BY class_group")
class_counts = cur.fetchall()

print(f"\nTotal students in database: {total_students}")
print("Class breakdown:")
for r in class_counts:
    print(f"  Klas '{r['class_group']}': {r['c']} studenten")

# Test user lookup for Abbiusi and Ait El Fassi
cur.execute("SELECT * FROM users WHERE username IN ('12603952', '12603594')")
for r in cur.fetchall():
    print("\nVerified Student:", dict(r))

conn.close()
