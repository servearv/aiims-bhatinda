import os
import psycopg2
from psycopg2.extras import RealDictCursor

db_url = os.environ.get("DATABASE_URL")
if not db_url:
    print("DATABASE_URL not set")
    exit(1)

conn = psycopg2.connect(db_url)
cur = conn.cursor(cursor_factory=RealDictCursor)

cur.execute("SELECT username, email, role, password FROM Users WHERE role = 'Admin'")
users = cur.fetchall()

print("Admin Users in DB:")
for u in users:
    print(u)

conn.close()
