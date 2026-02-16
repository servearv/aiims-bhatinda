
import streamlit as st
import json
from PIL import Image
from gemini_client import extract_data_from_images
from schema import MedicalForm, PersonalDetails, ContactDetails, MedicalHistory, VaccinationStatus, HealthCheckup
from db import init_db, save_form, get_all_forms, get_form_by_id

# Initialize DB
init_db()

st.set_page_config(page_title="Medical Form Digitizer", layout="wide", page_icon="🏥")

# Custom CSS for styling
st.markdown("""
<style>
    .main {
        background-color: #f8f9fa;
    }
    h1 {
        color: #2c3e50;
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    }
    h2, h3 {
        color: #34495e;
    }
    .stButton>button {
        background-color: #0068c9;
        color: white;
        border-radius: 8px;
        padding: 0.5rem 1rem;
        font-weight: 600;
        border: none;
    }
    .stButton>button:hover {
        background-color: #0056b3;
    }
    .reportview-container .main .block-container {
        padding-top: 2rem;
        padding-bottom: 2rem;
        max-width: 1200px;
    }
    .stTextInput>div>div>input {
        border-radius: 6px;
        border: 1px solid #ced4da;
    }
    .stTextArea>div>div>textarea {
        border-radius: 6px;
        border: 1px solid #ced4da;
    }
    div[data-testid="stExpander"] {
        background-color: white;
        border-radius: 10px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        border: 1px solid #e9ecef;
    }
    .card {
        background-color: white;
        padding: 1.5rem;
        border-radius: 10px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        margin-bottom: 1rem;
    }
</style>
""", unsafe_allow_html=True)

# Sidebar for navigation
st.sidebar.markdown("# 🏥 MedDigitizer")
st.sidebar.markdown("---")
page = st.sidebar.radio("Navigate", ["New Entry", "View Records"], index=0)

if page == "New Entry":
    st.title("New Medical Record")
    st.markdown("Digitize patient forms efficiently using AI or manual entry.")
    
    # Mode selection
    with st.container():
        st.write("### Choose Input Method")
        entry_mode = st.radio("", ["Upload & Digitize (Recommended)", "Fill Manually"], horizontal=True, label_visibility="collapsed")

    extracted_data = None
    
    if entry_mode == "Upload & Digitize (Recommended)":
        with st.container():
            st.info("Upload the front and back images of the form. AI will extract the data for you to review.")
            col1, col2 = st.columns(2)
            with col1:
                st.markdown("#### Front Side")
                front_file = st.file_uploader("Upload Front Image", type=["jpg", "jpeg", "png"], key="front")
                if front_file:
                    st.image(front_file, use_container_width=True)

            with col2:
                st.markdown("#### Back Side")
                back_file = st.file_uploader("Upload Back Image", type=["jpg", "jpeg", "png"], key="back")
                if back_file:
                    st.image(back_file, use_container_width=True)

            if front_file and back_file:
                if st.button("✨ Digitize Form", type="primary"):
                    with st.spinner("Analyzing form with Gemini (this may take a moment)..."):
                        front_img = Image.open(front_file)
                        back_img = Image.open(back_file)
                        
                        try:
                            extracted_data = extract_data_from_images(front_img, back_img)
                            if extracted_data:
                                st.session_state['form_data'] = extracted_data
                                st.success("Form digitized successfully! Please review and edit below.")
                            else:
                                st.error("Failed to extract data. Please try again.")
                        except Exception as e:
                            st.error(f"An error occurred: {e}")
    
    elif entry_mode == "Fill Manually":
        if st.button("📝 Start Blank Form"):
             st.session_state['form_data'] = MedicalForm()

    # Display form for editing if data exists in session state (either from upload or manual start)
    if 'form_data' in st.session_state:
        form_data: MedicalForm = st.session_state['form_data']
        
        st.markdown("---")
        st.header("Patient Record Details")
        with st.form("edit_form"):
            
            # Using Tabs for better organization
            tab1, tab2, tab3 = st.tabs(["Personal & Contact", "Medical History", "Health Checkup"])
            
            with tab1:
                col1, col2 = st.columns(2)
                with col1:
                    st.subheader("Personal Details")
                    form_data.personal_details.name = st.text_input("Name", value=form_data.personal_details.name or "")
                    form_data.personal_details.age_sex = st.text_input("Age/Sex", value=form_data.personal_details.age_sex or "")
                    form_data.personal_details.class_sec = st.text_input("Class/Sec", value=form_data.personal_details.class_sec or "")
                    form_data.personal_details.dob = st.text_input("DOB", value=form_data.personal_details.dob or "")
                    form_data.personal_details.blood_group = st.text_input("Blood Group", value=form_data.personal_details.blood_group or "")
                
                with col2:
                    st.subheader("Guardian Info")
                    form_data.personal_details.father_name = st.text_input("Father's Name", value=form_data.personal_details.father_name or "")
                    form_data.personal_details.mother_name = st.text_input("Mother's Name", value=form_data.personal_details.mother_name or "")
                    form_data.personal_details.occupation_father = st.text_input("Father's Occupation", value=form_data.personal_details.occupation_father or "")
                    form_data.personal_details.occupation_mother = st.text_input("Mother's Occupation", value=form_data.personal_details.occupation_mother or "")

                st.markdown("#### Contact Information")
                c1, c2 = st.columns(2)
                form_data.contact_details.address = st.text_area("Address", value=form_data.contact_details.address or "", height=100)
                with c1:
                    form_data.contact_details.pin_code = st.text_input("Pin Code", value=form_data.contact_details.pin_code or "")
                    form_data.contact_details.phone = st.text_input("Phone", value=form_data.contact_details.phone or "")
                with c2:
                    form_data.contact_details.mobile = st.text_input("Mobile", value=form_data.contact_details.mobile or "")
                    form_data.contact_details.family_physician = st.text_input("Family Physician", value=form_data.contact_details.family_physician or "")
                    form_data.contact_details.physician_phone = st.text_input("Physician Phone", value=form_data.contact_details.physician_phone or "")

            with tab2:
                col_mh1, col_mh2 = st.columns(2)
                with col_mh1:
                    st.subheader("Medical History")
                    form_data.medical_history.past_history = st.text_area("Past History", value=form_data.medical_history.past_history or "")
                    form_data.medical_history.jaundice = st.text_input("History of Jaundice", value=form_data.medical_history.jaundice or "")
                    form_data.medical_history.allergies = st.text_input("Allergies", value=form_data.medical_history.allergies or "")
                
                with col_mh2:
                    form_data.medical_history.blood_transfusion = st.text_input("Blood Transfusion", value=form_data.medical_history.blood_transfusion or "")
                    form_data.medical_history.major_illness_operation = st.text_input("Major Illness/Operation", value=form_data.medical_history.major_illness_operation or "")
                    form_data.medical_history.implants_accessories = st.text_input("Implants/Accessories", value=form_data.medical_history.implants_accessories or "")

                st.markdown("#### Vaccination Status")
                col_vs1, col_vs2 = st.columns(2)
                with col_vs1:
                    form_data.vaccination_status.hepatitis_b = st.text_input("Hepatitis B", value=form_data.vaccination_status.hepatitis_b or "")
                    form_data.vaccination_status.typhoid = st.text_input("Typhoid", value=form_data.vaccination_status.typhoid or "")
                    form_data.vaccination_status.dt_polio = st.text_input("D.T. & Polio Booster", value=form_data.vaccination_status.dt_polio or "")
                with col_vs2:
                    form_data.vaccination_status.tentanu = st.text_input("Tentanu", value=form_data.vaccination_status.tentanu or "")
                    form_data.vaccination_status.other_info = st.text_area("Other Information", value=form_data.vaccination_status.other_info or "", height=68)
                    form_data.vaccination_status.current_medication = st.text_area("Current Medication", value=form_data.vaccination_status.current_medication or "", height=68)

            with tab3:
                st.subheader("Health Check-up Results")
                col_hc1, col_hc2 = st.columns(2)
                with col_hc1:
                    form_data.health_checkup.date_exam = st.text_input("Date of Exam", value=form_data.health_checkup.date_exam or "")
                    form_data.health_checkup.height_weight = st.text_input("Height & Weight", value=form_data.health_checkup.height_weight or "")
                    form_data.health_checkup.ears = st.text_input("Ears", value=form_data.health_checkup.ears or "")
                    form_data.health_checkup.teeth_gums = st.text_input("Teeth & Gums", value=form_data.health_checkup.teeth_gums or "")
                
                with col_hc2:
                    form_data.health_checkup.general_cleanliness = st.text_input("General Cleanliness", value=form_data.health_checkup.general_cleanliness or "")
                    form_data.health_checkup.eyes_vision = st.text_input("Eyes (Vision)", value=form_data.health_checkup.eyes_vision or "")
                    form_data.health_checkup.nose_throat = st.text_input("Nose & Throat", value=form_data.health_checkup.nose_throat or "")
                
                form_data.health_checkup.systemic_exam = st.text_area("Systemic Exam", value=form_data.health_checkup.systemic_exam or "")
                form_data.health_checkup.remarks = st.text_area("Doctor's Remarks", value=form_data.health_checkup.remarks or "")
                
                st.markdown("#### Signatures")
                col_sig1, col_sig2, col_sig3 = st.columns(3)
                form_data.health_checkup.teacher_sign = col_sig1.text_input("Teacher's Sign", value=form_data.health_checkup.teacher_sign or "")
                form_data.health_checkup.principal_sign = col_sig2.text_input("Principal's Sign", value=form_data.health_checkup.principal_sign or "")
                form_data.health_checkup.parent_sign = col_sig3.text_input("Parent's Sign", value=form_data.health_checkup.parent_sign or "")

            st.write("")
            submitted = st.form_submit_button("💾 Save to Database", type="primary", use_container_width=True)
            
            if submitted:
                try:
                    save_form(form_data)
                    st.success("Record saved successfully!")
                    del st.session_state['form_data'] 
                    st.rerun()
                except Exception as e:
                    st.error(f"Error saving to database: {e}")

elif page == "View Records":
    st.title("Patient Records")
    
    records = get_all_forms()
    
    if not records:
        st.info("No records found. Create a new entry to get started.")
    else:
        for record in records:
            with st.expander(f"📄 {record['student_name']} - {record['created_at']}", expanded=False):
                data = json.loads(record['form_data'])
                
                # Display using tabs same as entry
                t1, t2, t3 = st.tabs(["Details", "History", "Checkup"])
                
                with t1:
                     pd = data.get('personal_details', {})
                     cd = data.get('contact_details', {})
                     c1, c2 = st.columns(2)
                     c1.markdown(f"**Name:** {pd.get('name', 'N/A')}")
                     c1.markdown(f"**DOB:** {pd.get('dob', 'N/A')}")
                     c1.markdown(f"**Class:** {pd.get('class_sec', 'N/A')}")
                     c2.markdown(f"**Father:** {pd.get('father_name', 'N/A')}")
                     c2.markdown(f"**Mother:** {pd.get('mother_name', 'N/A')}")
                     c2.markdown(f"**Mobile:** {cd.get('mobile', 'N/A')}")
                     st.markdown(f"**Address:** {cd.get('address', 'N/A')}")
                
                with t2:
                    mh = data.get('medical_history', {})
                    st.info(f"**Major Illness:** {mh.get('major_illness_operation', 'None')}")
                    st.markdown(f"**Allergies:** {mh.get('allergies', 'None')}")
                    st.markdown(f"**Past History:** {mh.get('past_history', 'None')}")

                with t3:
                    hc = data.get('health_checkup', {})
                    st.success(f"**Doctor's Remarks:** {hc.get('remarks', 'None')}")
                    col_h1, col_h2 = st.columns(2)
                    col_h1.markdown(f"**Height/Weight:** {hc.get('height_weight', 'N/A')}")
                    col_h2.markdown(f"**Vision:** {hc.get('eyes_vision', 'N/A')}")

