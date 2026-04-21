"""baseline_schema

Revision ID: 07eb4733d3d3
Revises: 
Create Date: 2026-04-21 13:06:32.235567

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '07eb4733d3d3'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
        CREATE TABLE IF NOT EXISTS Users (
            username TEXT PRIMARY KEY,
            password TEXT,
            role TEXT,
            name TEXT,
            designation TEXT DEFAULT '',
            specialization TEXT DEFAULT '',
            email TEXT,
            otp_code TEXT,
            otp_expires TEXT
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON Users(email) WHERE email IS NOT NULL;

        CREATE TABLE IF NOT EXISTS Schools (
            school_id SERIAL PRIMARY KEY,
            school_name TEXT NOT NULL,
            school_address TEXT DEFAULT '',
            poc_username TEXT,
            poc_name TEXT DEFAULT '',
            poc_designation TEXT DEFAULT '',
            poc_phone TEXT DEFAULT '',
            poc_email TEXT DEFAULT '',
            created_at TEXT,
            FOREIGN KEY(poc_username) REFERENCES Users(username)
        );

        CREATE TABLE IF NOT EXISTS Events (
            event_id SERIAL PRIMARY KEY,
            school_name TEXT NOT NULL,
            school_address TEXT DEFAULT '',
            poc_name TEXT DEFAULT '',
            poc_designation TEXT DEFAULT '',
            poc_phone TEXT DEFAULT '',
            poc_email TEXT DEFAULT '',
            school_id INTEGER,
            start_date TEXT NOT NULL,
            end_date TEXT DEFAULT '',
            operational_hours TEXT DEFAULT '',
            tag TEXT DEFAULT 'Upcoming',
            created_at TEXT,
            created_by TEXT,
            FOREIGN KEY(created_by) REFERENCES Users(username),
            FOREIGN KEY(school_id) REFERENCES Schools(school_id)
        );

        CREATE TABLE IF NOT EXISTS Event_Volunteers (
            event_id INTEGER,
            username TEXT,
            category TEXT,
            joined_at TEXT,
            active INTEGER DEFAULT 1,
            PRIMARY KEY (event_id, username),
            FOREIGN KEY(event_id) REFERENCES Events(event_id),
            FOREIGN KEY(username) REFERENCES Users(username)
        );

        CREATE TABLE IF NOT EXISTS Students (
            student_id SERIAL PRIMARY KEY,
            event_id INTEGER,
            name TEXT,
            age INTEGER,
            dob TEXT,
            gender TEXT,
            student_class TEXT,
            section TEXT,
            blood_group TEXT,
            father_name TEXT,
            phone TEXT,
            qr_code_hash TEXT,
            added_by TEXT DEFAULT '',
            status TEXT DEFAULT 'Pending Examination',
            mother_name TEXT DEFAULT '',
            mother_occupation TEXT DEFAULT '',
            father_occupation TEXT DEFAULT '',
            address TEXT DEFAULT '',
            pincode TEXT DEFAULT '',
            FOREIGN KEY(event_id) REFERENCES Events(event_id)
        );

        CREATE TABLE IF NOT EXISTS Health_Records (
            record_id SERIAL PRIMARY KEY,
            student_id INTEGER,
            event_id INTEGER,
            doctor_id TEXT,
            category TEXT,
            json_data TEXT,
            timestamp TEXT,
            FOREIGN KEY(student_id) REFERENCES Students(student_id),
            FOREIGN KEY(event_id) REFERENCES Events(event_id),
            FOREIGN KEY(doctor_id) REFERENCES Users(username)
        );

        CREATE TABLE IF NOT EXISTS Audit_Logs (
            log_id SERIAL PRIMARY KEY,
            timestamp TEXT,
            user_id TEXT,
            action TEXT,
            details TEXT,
            FOREIGN KEY(user_id) REFERENCES Users(username)
        );

        CREATE TABLE IF NOT EXISTS Student_General_Info (
            id SERIAL PRIMARY KEY,
            student_id INTEGER NOT NULL,
            event_id INTEGER NOT NULL,
            height TEXT DEFAULT '',
            weight TEXT DEFAULT '',
            bmi TEXT DEFAULT '',
            symptoms_json TEXT DEFAULT '[]',
            filled_by TEXT DEFAULT '',
            updated_at TEXT,
            FOREIGN KEY(student_id) REFERENCES Students(student_id),
            FOREIGN KEY(event_id) REFERENCES Events(event_id),
            UNIQUE(student_id, event_id)
        );

        CREATE TABLE IF NOT EXISTS Camp_Requests (
            request_id SERIAL PRIMARY KEY,
            school_id INTEGER,
            school_name TEXT NOT NULL,
            preferred_date TEXT NOT NULL,
            end_date TEXT DEFAULT '',
            student_count INTEGER DEFAULT 0,
            classes TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            status TEXT DEFAULT 'Pending',
            created_at TEXT,
            reviewed_at TEXT,
            reviewed_by TEXT,
            FOREIGN KEY(school_id) REFERENCES Schools(school_id)
        );
    """)

    # Seed Admin User if missing
    op.execute("""
        INSERT INTO Users (username,password,role,name,designation,specialization,email)
        SELECT 'Admin', 'admin', 'Admin', 'Admin', '', '', 'nachiketavachat@gmail.com'
        WHERE NOT EXISTS (SELECT 1 FROM Users WHERE username='Admin');
    """)


def downgrade() -> None:
    """Downgrade schema."""
    pass
