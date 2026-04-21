import psycopg2
import psycopg2.pool
import psycopg2.extras
import os
import logging
from contextlib import contextmanager

logger = logging.getLogger('aiims.db')
_pool = None

def init_pool(database_url_val=None, minconn=2, maxconn=10):
    global _pool
    db_url = database_url_val or os.environ.get("DATABASE_URL")
    if not db_url:
        logger.warning("DATABASE_URL not set. DB Pool not initialized.")
        return
    _pool = psycopg2.pool.ThreadedConnectionPool(minconn, maxconn, db_url)
    logger.info(f"DB connection pool initialized (min={minconn}, max={maxconn}).")

def get_conn():
    if not _pool:
        raise RuntimeError("DB Pool not initialized")
    return _pool.getconn()

def put_conn(conn):
    if _pool:
        _pool.putconn(conn)

@contextmanager
def get_db_conn():
    """Provides a connection from the pool. You must commit and close cursor manually if needed."""
    conn = get_conn()
    try:
        yield conn
    finally:
        put_conn(conn)

@contextmanager
def get_db_cursor(commit=False):
    """Provides a RealDictCursor. Optionally commits on successful exit."""
    conn = get_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        yield cur
        if commit:
            conn.commit()
        cur.close()
    except Exception:
        conn.rollback()
        raise
    finally:
        put_conn(conn)
