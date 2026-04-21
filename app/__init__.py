import os
from flask import Flask, send_from_directory, Response
from flask_cors import CORS

from app.config import Config
from app.db import init_pool
from app.logging_config import configure_logging
from app.middleware import register_middleware

from app.routes.auth import bp as auth_bp
from app.routes.users import bp as users_bp
from app.routes.events import bp as events_bp
from app.routes.schools import bp as schools_bp
from app.routes.students import bp as students_bp
from app.routes.health import bp as health_bp
from app.routes.admin import bp as admin_bp

import logging
logger = logging.getLogger('aiims.app')

# Optional: flask-socketio for real-time updates
try:
    from flask_socketio import SocketIO
    HAS_SOCKETIO = True
except ImportError:
    HAS_SOCKETIO = False
    SocketIO = None

socketio = None

def create_app():
    # Configure JSON logging first
    configure_logging()
    
    app = Flask(__name__, static_folder=None)
    app.config.from_object(Config)
    app.config["JSON_SORT_KEYS"] = False
    CORS(app)
    
    # Initialize DB connection pool
    init_pool(app.config["DATABASE_URL"])
    
    # Setup session
    try:
        from flask_session import Session
        Session(app)
    except ImportError:
        pass

    global socketio
    if HAS_SOCKETIO:
        redis_url = os.environ.get("REDIS_URL")
        # Initialize with Redis message queue if available for distributed scaling
        if redis_url:
            socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet", message_queue=redis_url)
        else:
            socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")
        
        # Attach to app context so blueprints can use current_app.extensions
        app.extensions['socketio'] = socketio

        @socketio.on("connect")
        def handle_connect():
            logger.info("[socket.io] Client connected")

        @socketio.on("disconnect")
        def handle_disconnect():
            logger.info("[socket.io] Client disconnected")

    # Register all middleware & error handlers
    register_middleware(app)
    
    # Register all blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(events_bp)
    app.register_blueprint(schools_bp)
    app.register_blueprint(students_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(admin_bp)

    # Setup SPA routing
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DIST_DIR = os.path.join(BASE_DIR, "dist")

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_spa(path):
        if not os.path.isdir(DIST_DIR):
            return Response(
                "<html><body style='font-family:sans-serif;padding:40px;background:#0f172a;color:#e2e8f0;'>"
                "<h1 style='color:#22d3ee'>AIIMS Bathinda - Backend Running &#10004;</h1>"
                "<p>The Flask API server is running, but the React frontend has not been built yet.</p>"
                "<p>Run this command to build the frontend:</p>"
                "<pre style='background:#1e293b;padding:16px;border-radius:8px;color:#38bdf8'>npm run build</pre>"
                "<p>Then refresh this page.</p><hr style='border-color:#334155'>"
                "<p style='color:#94a3b8'>API endpoints are already available at <code>/api/*</code></p>"
                "</body></html>",
                content_type="text/html",
            )

        full_path = os.path.join(DIST_DIR, path)
        if path and os.path.isfile(full_path):
            if path == "sw.js" or path.endswith("sw.js"):
                response = send_from_directory(DIST_DIR, path)
                response.headers["Service-Worker-Allowed"] = "/"
                response.headers["Content-Type"] = "application/javascript"
                return response
            if path == "manifest.json" or path.endswith(".webmanifest"):
                return send_from_directory(DIST_DIR, path, mimetype="application/manifest+json")
            return send_from_directory(DIST_DIR, path)

        return send_from_directory(DIST_DIR, "index.html")

    return app
