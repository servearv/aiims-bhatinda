import urllib.request
import urllib.parse
import json
import http.cookiejar

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

# 1. Login
data = json.dumps({"username": "harsh.5y8", "password": "123"}).encode("utf-8")
req = urllib.request.Request("http://localhost:8080/api/login", data=data, headers={"Content-Type": "application/json"})
res = opener.open(req)
print("login:", res.status, res.read().decode())

# 2. Change password
try:
    data2 = json.dumps({"old_password": "123", "new_password": "123"}).encode("utf-8")
    req2 = urllib.request.Request("http://localhost:8080/api/users/profile/password", data=data2, headers={"Content-Type": "application/json"})
    res2 = opener.open(req2)
    print("password:", res2.status, res2.read().decode())
except Exception as e:
    print("password error:", e)
    if hasattr(e, 'read'):
        print(e.read().decode())

# 3. Change username
try:
    data3 = json.dumps({"new_username": "harsh.5y8new"}).encode("utf-8")
    req3 = urllib.request.Request("http://localhost:8080/api/users/profile/display-name", data=data3, headers={"Content-Type": "application/json"})
    res3 = opener.open(req3)
    print("username:", res3.status, res3.read().decode())
except Exception as e:
    print("username error:", e)
    if hasattr(e, 'read'):
        print(e.read().decode())
