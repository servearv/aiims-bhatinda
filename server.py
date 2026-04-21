import os
import logging
from app import create_app, socketio

app = create_app()
logger = logging.getLogger('aiims.server')

def init_db():
    """Initializes the database by running Alembic migrations."""
    import alembic.config
    import alembic.command
    
    logger.info("Initializing database (running migrations)...")
    try:
        # Load the Alembic configuration from alembic.ini
        alembic_cfg = alembic.config.Config("alembic.ini")
        
        # Override the sqlalchemy.url with the environment variable if present
        db_url = os.environ.get("DATABASE_URL")
        if db_url:
            # Reformat postgres:// to postgresql:// for SQLAlchemy/Alembic if needed
            if db_url.startswith("postgres://"):
                db_url = db_url.replace("postgres://", "postgresql://", 1)
            alembic_cfg.set_main_option("sqlalchemy.url", db_url)
        
        # Run migrations to the latest version ('head')
        alembic.command.upgrade(alembic_cfg, "head")
        logger.info("Database migrations completed successfully.")
    except Exception as e:
        logger.error(f"Failed to run database migrations: {e}")
        # We continue to let the server start, but it might fail on first query
        # if the schema is not ready.


if __name__ == "__main__":
    PORT = int(os.environ.get("PORT", 3000))
    
    db_display = os.environ.get("DATABASE_URL", "(not set)")[:40] + "..."
    logger.info("")
    logger.info("  AIIMS Bathinda - Flask Server (Production Ready)")
    logger.info("  =================================================")
    logger.info(f"  Server running on: http://0.0.0.0:{PORT}")
    logger.info(f"  Database:          {db_display}")
    
    if socketio:
        logger.info(f"  Socket.IO:         ENABLED")
        socketio.run(app, host="0.0.0.0", port=PORT, debug=False,
                     allow_unsafe_werkzeug=True)
    else:
        logger.info(f"  Socket.IO:         DISABLED")
        app.run(host="0.0.0.0", port=PORT, debug=False)
