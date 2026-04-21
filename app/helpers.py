"""Shared utility functions used across blueprints."""
import re
import random
import string
import json
import logging
from datetime import date

logger = logging.getLogger('aiims')

# Map old specialization values → new specialist roles (for migration)
SPEC_TO_ROLE = {
    'General Medicine': 'Community_Medicine',
    'Pediatrics': 'Community_Medicine',
    'Ophthalmology': 'Eye_Specialist',
    'ENT': 'ENT',
    'Dentistry': 'Dental',
    'Dermatology': 'Skin_Specialist',
    'Orthopedics': 'Other',
    'Cardiology': 'Other',
    'Psychiatry': 'Other',
    'Nursing': 'Other',
    'Emergency Medicine': 'Other',
    'Other': 'Other',
}


def row_to_dict(row):
    """Convert a psycopg2 RealDictRow to a plain dict."""
    if row is None:
        return None
    return dict(row)


def rows_to_list(rows):
    return [dict(r) for r in rows]


def generate_username(name: str) -> str:
    """Generate a username from a name: 'Dr. Anil Kumar' → 'anil.kum.x7k' (max 15 chars)."""
    # Strip titles
    clean = re.sub(r'^(dr\.?|mr\.?|mrs\.?|ms\.?|prof\.?)\s*', '', name.strip(), flags=re.IGNORECASE)
    parts = re.sub(r'[^a-zA-Z\s]', '', clean).lower().split()
    base = '.'.join(parts[:2]) if parts else 'user'
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=3))
    result = f"{base}.{suffix}"
    # Cap at 15 characters
    if len(result) > 15:
        result = result[:11] + '.' + suffix
    return result[:15]


def generate_password(length: int = 10) -> str:
    """Generate a random alphanumeric password (max 10 chars)."""
    chars = string.ascii_letters + string.digits
    return ''.join(random.choices(chars, k=min(length, 10)))


def user_public(u: dict) -> dict:
    """Return only the public fields of a user dict (no password/otp)."""
    return {
        'username': u.get('username'),
        'email': u.get('email'),
        'role': u.get('role'),
        'name': u.get('name'),
        'designation': u.get('designation', ''),
        'specialization': u.get('specialization', ''),
    }


def normalize_date(raw: str) -> str:
    """Convert dd-mm-yyyy or mm-dd-yyyy to yyyy-mm-dd; pass through if already iso."""
    raw = raw.strip()
    if not raw:
        return raw
    for sep in ('-', '/'):
        parts = raw.split(sep)
        if len(parts) == 3:
            a, b, c = parts
            # If first two parts are 1-2 digits and last is 4 digits
            if len(a) <= 2 and len(b) <= 2 and len(c) == 4:
                try:
                    num_b = int(b)
                    # If middle part > 12, it MUST be the day -> MM/DD/YYYY format
                    if num_b > 12:
                        return f"{c}-{a.zfill(2)}-{b.zfill(2)}"
                    # Otherwise assume DD/MM/YYYY format as standard
                    return f"{c}-{b.zfill(2)}-{a.zfill(2)}"
                except ValueError:
                    pass
    # Already yyyy-mm-dd or unrecognized — return as-is
    return raw


def compute_event_status(start_date_str: str, end_date_str: str) -> str:
    """Compute camp status dynamically from start/end dates vs today.

    Returns 'Upcoming', 'Ongoing', or 'Completed'.
    """
    today = date.today()

    # Parse start_date
    start = None
    if start_date_str:
        try:
            start = date.fromisoformat(normalize_date(start_date_str))
        except (ValueError, TypeError):
            logger.warning(f"Could not parse start_date: {start_date_str!r}")

    # Parse end_date
    end = None
    if end_date_str:
        try:
            end = date.fromisoformat(normalize_date(end_date_str))
        except (ValueError, TypeError):
            logger.warning(f"Could not parse end_date: {end_date_str!r}")

    if start and start > today:
        return 'Upcoming'
    if end and end < today:
        return 'Completed'
    # start_date is today or in the past, and end_date is today/future or not set
    return 'Ongoing'


def enrich_events_with_status(events: list) -> list:
    """Add 'computed_status' to each event dict based on date logic."""
    for ev in events:
        raw_tag = ev.get('tag', '')
        # If event was manually cancelled, keep that
        if raw_tag == 'Cancelled':
            ev['computed_status'] = 'Cancelled'
        else:
            ev['computed_status'] = compute_event_status(
                ev.get('start_date', ''),
                ev.get('end_date', ''),
            )
    return events
