import sqlite3
import json
from datetime import datetime
from schema import MedicalForm
from typing import List

DB_NAME = "medical_forms.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS forms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_name TEXT,
            form_data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def save_form(form_data: MedicalForm):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    student_name = form_data.personal_details.name or "Unknown"
    json_data = form_data.model_dump_json()
    
    c.execute('''
        INSERT INTO forms (student_name, form_data)
        VALUES (?, ?)
    ''', (student_name, json_data))
    
    conn.commit()
    conn.close()

def save_forms_bulk(forms: List[MedicalForm]) -> int:
    """Save multiple forms in a single transaction. Returns count of saved records."""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    count = 0
    try:
        for form in forms:
            student_name = form.personal_details.name or "Unknown"
            json_data = form.model_dump_json()
            c.execute('INSERT INTO forms (student_name, form_data) VALUES (?, ?)', (student_name, json_data))
            count += 1
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return count

def get_all_forms():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM forms ORDER BY created_at DESC')
    rows = c.fetchall()
    conn.close()
    return rows

def search_forms(query: str):
    """Search forms by student name."""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM forms WHERE student_name LIKE ? ORDER BY created_at DESC', (f'%{query}%',))
    rows = c.fetchall()
    conn.close()
    return rows

def get_form_by_id(form_id):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM forms WHERE id = ?', (form_id,))
    row = c.fetchone()
    conn.close()
    return row

def delete_form(form_id: int):
    """Delete a form by its ID."""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('DELETE FROM forms WHERE id = ?', (form_id,))
    conn.commit()
    conn.close()
