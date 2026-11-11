import sqlite3

db_path = r"C:\Users\PXL\AppData\Roaming\gcloud\credentials.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()
for table in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall():
    tname = table[0]
    print("Table:", tname)
    rows = cur.execute(f"SELECT * FROM {tname}").fetchall()
    print(" Rows:", rows)
