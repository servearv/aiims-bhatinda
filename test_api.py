import requests

s = requests.Session()
r = s.post("http://localhost:5000/api/login", json={"username": "harsh.5y8", "password": "123"})
print("login:", r.status_code, r.text)

r2 = s.post("http://localhost:5000/api/users/profile/password", json={"old_password": "123", "new_password": "123"})
print("password:", r2.status_code, r2.text)

r3 = s.post("http://localhost:5000/api/users/profile/display-name", json={"new_username": "harsh.5y8new"})
print("username:", r3.status_code, r3.text)
