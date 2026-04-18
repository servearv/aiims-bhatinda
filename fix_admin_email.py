import os
import psycopg2

db_url = os.environ.get("DATABASE_URL", "postgresql://aiims:aiims_pass@localhost:5432/aiims_db")
email = "nachiketavachat@gmail.com"

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    # Check if admin11 exists
    cur.execute("SELECT username FROM Users WHERE username = 'admin11'")
    if cur.fetchone():
        cur.execute("UPDATE Users SET email = %s WHERE username = 'admin11'", (email,))
        print(f"Updated admin11 with email {email}")
    else:
        # Check if Admin exists
        cur.execute("SELECT username FROM Users WHERE username = 'Admin'")
        if cur.fetchone():
            cur.execute("UPDATE Users SET email = %s WHERE username = 'Admin'", (email,))
            print(f"Updated Admin with email {email}")
        else:
            print("No admin user found to update.")
    
    conn.commit()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
