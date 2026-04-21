import uuid
import time
import logging
from flask import g, request, jsonify

logger = logging.getLogger('aiims.http')

def register_middleware(app):
    @app.before_request
    def _log_request_start():
        g.request_id = str(uuid.uuid4())
        request._start_time = time.time()

    @app.after_request
    def _log_request_end(response):
        duration = time.time() - getattr(request, '_start_time', time.time())
        if request.path.startswith('/api/'):
            logger.info(
                f"{request.method} {request.path} → {response.status_code} "
                f"({duration * 1000:.0f}ms)"
            )
        return response

    @app.errorhandler(Exception)
    def handle_exception(e):
        # pass through HTTP errors
        if hasattr(e, 'code') and getattr(e, 'code') >= 400 and getattr(e, 'code') < 500:
            return e
        
        logger.exception("Unhandled Exception")
        return jsonify({"success": False, "message": "An unexpected error occurred"}), 500
