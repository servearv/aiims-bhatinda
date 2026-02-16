from pydantic import BaseModel, Field
from typing import Optional, List, Dict

class PersonalDetails(BaseModel):
    name: Optional[str] = Field(None, description="Name of the student")
    age_sex: Optional[str] = Field(None, description="Age and Sex")
    class_sec: Optional[str] = Field(None, description="Class and Section")
    dob: Optional[str] = Field(None, description="Date of Birth (DD-MM-YYYY)")
    blood_group: Optional[str] = Field(None, description="Blood Group")
    father_name: Optional[str] = Field(None, description="Father's Name")
    mother_name: Optional[str] = Field(None, description="Mother's Name")
    occupation_father: Optional[str] = Field(None, description="Father's Occupation")
    occupation_mother: Optional[str] = Field(None, description="Mother's Occupation")

class ContactDetails(BaseModel):
    address: Optional[str] = Field(None, description="Mailing Address")
    pin_code: Optional[str] = Field(None, description="Pin Code")
    phone: Optional[str] = Field(None, description="Phone Number")
    mobile: Optional[str] = Field(None, description="Mobile Number")
    family_physician: Optional[str] = Field(None, description="Name & Address of Family Physician")
    physician_phone: Optional[str] = Field(None, description="Physician Phone")

class MedicalHistory(BaseModel):
    past_history: Optional[str] = Field(None, description="Past History")
    jaundice: Optional[str] = Field(None, description="History of Jaundice")
    allergies: Optional[str] = Field(None, description="Allergies")
    blood_transfusion: Optional[str] = Field(None, description="Blood Transfusion history")
    major_illness_operation: Optional[str] = Field(None, description="Any Major illness or operation in past")
    implants_accessories: Optional[str] = Field(None, description="Dental Implant, Braces, Spectacles/Lenses details")

class VaccinationStatus(BaseModel):
    hepatitis_b: Optional[str] = Field(None, description="Hepatitis - B details")
    typhoid: Optional[str] = Field(None, description="Typhoid details")
    dt_polio: Optional[str] = Field(None, description="D. T. & Polio Booster details")
    tentanu: Optional[str] = Field(None, description="Tentanu details") # Sic: Form says Tentanu
    other_info: Optional[str] = Field(None, description="Any other information")
    current_medication: Optional[str] = Field(None, description="Current Medication")

class HealthCheckup(BaseModel):
    date_exam: Optional[str] = Field(None, description="Date of Examination")
    general_cleanliness: Optional[str] = Field(None, description="General Cleanliness / Hygiene")
    height_weight: Optional[str] = Field(None, description="Height and Weight")
    eyes_vision: Optional[str] = Field(None, description="Eyes (Vision) details")
    ears: Optional[str] = Field(None, description="Ears details")
    nose_throat: Optional[str] = Field(None, description="Nose and Throat details")
    teeth_gums: Optional[str] = Field(None, description="Teeth & Gums")
    systemic_exam: Optional[str] = Field(None, description="Systemic Examination details")
    remarks: Optional[str] = Field(None, description="Doctor's Remarks")
    teacher_sign: Optional[str] = Field(None, description="Class teacher's Sign")
    principal_sign: Optional[str] = Field(None, description="Principal's Sign")
    parent_sign: Optional[str] = Field(None, description="Parent's Sign")

class MedicalForm(BaseModel):
    personal_details: PersonalDetails = Field(default_factory=PersonalDetails)
    contact_details: ContactDetails = Field(default_factory=ContactDetails)
    medical_history: MedicalHistory = Field(default_factory=MedicalHistory)
    vaccination_status: VaccinationStatus = Field(default_factory=VaccinationStatus)
    health_checkup: HealthCheckup = Field(default_factory=HealthCheckup)
