import sqlite3
conn = sqlite3.connect('database.db')
conn.execute("INSERT OR IGNORE INTO Users (username, password, role, name) VALUES ('doctor', 'doc', 'Medical Staff', 'Dr. Smith')")
conn.commit()
conn.close()
print('Doctor account created!')
