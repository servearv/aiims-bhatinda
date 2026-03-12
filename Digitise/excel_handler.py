"""
Excel/CSV handler for bulk medical form import.
Provides template generation, file validation, and DataFrame-to-MedicalForm conversion.
"""

import io
import pandas as pd
from typing import Tuple, Optional, List
from schema import MedicalForm, PersonalDetails, ContactDetails, MedicalHistory, VaccinationStatus, HealthCheckup

# Mapping: (sub_model_name, field_name) for every field in MedicalForm
# Order matters — this defines the column order in the template
FIELD_MAP = [
    # Personal Details
    ("personal_details", "name"),
    ("personal_details", "age_sex"),
    ("personal_details", "class_sec"),
    ("personal_details", "dob"),
    ("personal_details", "blood_group"),
    ("personal_details", "father_name"),
    ("personal_details", "mother_name"),
    ("personal_details", "occupation_father"),
    ("personal_details", "occupation_mother"),
    # Contact Details
    ("contact_details", "address"),
    ("contact_details", "pin_code"),
    ("contact_details", "phone"),
    ("contact_details", "mobile"),
    ("contact_details", "family_physician"),
    ("contact_details", "physician_phone"),
    # Medical History
    ("medical_history", "past_history"),
    ("medical_history", "jaundice"),
    ("medical_history", "allergies"),
    ("medical_history", "blood_transfusion"),
    ("medical_history", "major_illness_operation"),
    ("medical_history", "implants_accessories"),
    # Vaccination Status
    ("vaccination_status", "hepatitis_b"),
    ("vaccination_status", "typhoid"),
    ("vaccination_status", "dt_polio"),
    ("vaccination_status", "tentanu"),
    ("vaccination_status", "other_info"),
    ("vaccination_status", "current_medication"),
    # Health Checkup
    ("health_checkup", "date_exam"),
    ("health_checkup", "general_cleanliness"),
    ("health_checkup", "height_weight"),
    ("health_checkup", "eyes_vision"),
    ("health_checkup", "ears"),
    ("health_checkup", "nose_throat"),
    ("health_checkup", "teeth_gums"),
    ("health_checkup", "systemic_exam"),
    ("health_checkup", "remarks"),
    ("health_checkup", "teacher_sign"),
    ("health_checkup", "principal_sign"),
    ("health_checkup", "parent_sign"),
    ("health_checkup", "additional_notes"),
]

ALL_COLUMNS = [field for _, field in FIELD_MAP]

# Human-readable column labels for the template header
COLUMN_LABELS = {
    "name": "Name",
    "age_sex": "Age/Sex",
    "class_sec": "Class/Section",
    "dob": "Date of Birth",
    "blood_group": "Blood Group",
    "father_name": "Father's Name",
    "mother_name": "Mother's Name",
    "occupation_father": "Father's Occupation",
    "occupation_mother": "Mother's Occupation",
    "address": "Address",
    "pin_code": "Pin Code",
    "phone": "Phone",
    "mobile": "Mobile",
    "family_physician": "Family Physician",
    "physician_phone": "Physician Phone",
    "past_history": "Past History",
    "jaundice": "Jaundice History",
    "allergies": "Allergies",
    "blood_transfusion": "Blood Transfusion",
    "major_illness_operation": "Major Illness/Operation",
    "implants_accessories": "Implants/Accessories",
    "hepatitis_b": "Hepatitis B",
    "typhoid": "Typhoid",
    "dt_polio": "D.T. & Polio Booster",
    "tentanu": "Tentanu",
    "other_info": "Other Info",
    "current_medication": "Current Medication",
    "date_exam": "Date of Exam",
    "general_cleanliness": "General Cleanliness",
    "height_weight": "Height & Weight",
    "eyes_vision": "Eyes (Vision)",
    "ears": "Ears",
    "nose_throat": "Nose & Throat",
    "teeth_gums": "Teeth & Gums",
    "systemic_exam": "Systemic Exam",
    "remarks": "Remarks",
    "teacher_sign": "Teacher's Sign",
    "principal_sign": "Principal's Sign",
    "parent_sign": "Parent's Sign",
    "additional_notes": "Additional Notes",
}


def generate_template() -> bytes:
    """Generate an Excel template with all columns. Returns bytes of the .xlsx file."""
    df = pd.DataFrame(columns=[COLUMN_LABELS.get(c, c) for c in ALL_COLUMNS])
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Medical Forms")
        # Auto-size columns
        worksheet = writer.sheets["Medical Forms"]
        for i, col_name in enumerate(df.columns):
            worksheet.column_dimensions[chr(65 + i) if i < 26 else f"A{chr(65 + i - 26)}"].width = max(len(col_name) + 4, 15)
    buf.seek(0)
    return buf.getvalue()


def validate_file(uploaded_file) -> Tuple[bool, str, Optional[pd.DataFrame]]:
    """
    Validate an uploaded Excel or CSV file.
    Returns (is_valid, message, dataframe_or_None).
    """
    filename = uploaded_file.name.lower()

    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(uploaded_file)
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(uploaded_file, engine="openpyxl")
        else:
            return False, f"Unsupported file format: '{filename.split('.')[-1]}'. Please upload .xlsx, .xls, or .csv files.", None
    except Exception as e:
        return False, f"Could not read the file: {e}", None

    if df.empty:
        return False, "The file is empty. Please add at least one row of data.", None

    # Normalize uploaded columns: strip whitespace, lowercase
    df.columns = df.columns.str.strip()

    # Build reverse lookup: label -> field_name
    label_to_field = {v.lower(): k for k, v in COLUMN_LABELS.items()}

    # Try to map uploaded column names to field names
    mapped_columns = {}
    unrecognized = []
    for col in df.columns:
        col_lower = col.lower()
        if col_lower in [c.lower() for c in ALL_COLUMNS]:
            # Direct field name match
            mapped_columns[col] = col_lower
        elif col_lower in label_to_field:
            # Human-readable label match
            mapped_columns[col] = label_to_field[col_lower]
        else:
            unrecognized.append(col)

    # Check for required minimum: at least 'name' column
    mapped_fields = set(mapped_columns.values())
    if "name" not in mapped_fields:
        return False, "The file must have at least a 'Name' column. Please use the provided template.", None

    # Rename columns to field names
    df = df.rename(columns=mapped_columns)

    # Drop unrecognized columns
    if unrecognized:
        df = df.drop(columns=unrecognized)

    # Fill NaN with None
    df = df.where(pd.notnull(df), None)

    # Convert all values to string (or None)
    for col in df.columns:
        df[col] = df[col].apply(lambda x: str(x).strip() if x is not None else None)

    missing = [COLUMN_LABELS.get(c, c) for c in ALL_COLUMNS if c not in df.columns]

    msg = f"✅ File validated successfully. Found {len(df)} record(s)."
    if missing:
        msg += f"\n⚠️ Missing columns (will be empty): {', '.join(missing[:10])}"
        if len(missing) > 10:
            msg += f" and {len(missing) - 10} more"
    if unrecognized:
        msg += f"\n⚠️ Ignored unrecognized columns: {', '.join(unrecognized[:5])}"

    return True, msg, df


def dataframe_to_forms(df: pd.DataFrame) -> List[MedicalForm]:
    """Convert a validated DataFrame into a list of MedicalForm objects."""
    forms = []
    for _, row in df.iterrows():
        section_data = {
            "personal_details": {},
            "contact_details": {},
            "medical_history": {},
            "vaccination_status": {},
            "health_checkup": {},
        }
        for section, field in FIELD_MAP:
            if field in row.index and row[field] is not None:
                section_data[section][field] = row[field]

        try:
            form = MedicalForm(
                personal_details=PersonalDetails(**section_data["personal_details"]),
                contact_details=ContactDetails(**section_data["contact_details"]),
                medical_history=MedicalHistory(**section_data["medical_history"]),
                vaccination_status=VaccinationStatus(**section_data["vaccination_status"]),
                health_checkup=HealthCheckup(**section_data["health_checkup"]),
            )
            forms.append(form)
        except Exception:
            # Skip rows that can't be parsed — caller should handle count mismatch
            continue

    return forms
