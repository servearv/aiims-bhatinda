import os

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "aiims-bathinda-secret-dev")
    DATABASE_URL = os.environ.get("DATABASE_URL")
    
    # Session
    SESSION_TYPE = "redis" if os.environ.get("REDIS_URL") else "filesystem"
    if SESSION_TYPE == "filesystem":
        SESSION_FILE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "flask_sessions")
        os.makedirs(SESSION_FILE_DIR, exist_ok=True)
    else:
        import redis
        SESSION_REDIS = redis.from_url(os.environ.get("REDIS_URL"))
    
    SESSION_PERMANENT = True
    PERMANENT_SESSION_LIFETIME = 86400 * 7  # 7 days

    # App specific
    SPECIALIST_ROLES = [
        'Community_Medicine', 'Dental', 'ENT',
        'Eye_Specialist', 'Skin_Specialist', 'Other'
    ]
    ALL_ROLES = ['Admin', 'School POC'] + SPECIALIST_ROLES
