import sqlite3

conn = sqlite3.connect('data/netsim.db')
cur = conn.cursor()
count = cur.execute("SELECT count(*) FROM users").fetchone()[0]
print("Total users in netsim.db:", count)
classes = cur.execute("SELECT DISTINCT class_group FROM users WHERE role='student'").fetchall()
print("Classes:", [c[0] for c in classes])
