
import streamlit as st
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image
from gemini_client import extract_data_from_images as gemini_extract
from schema import MedicalForm, PersonalDetails, ContactDetails, MedicalHistory, VaccinationStatus, HealthCheckup
from db import init_db, save_form, save_forms_bulk, get_all_forms, search_forms, delete_form
from excel_handler import generate_template, validate_file, dataframe_to_forms
from typing import Optional

# Initialize DB
init_db()

st.set_page_config(page_title="MedDigitizer", layout="wide", page_icon="🏥")

# ── Global CSS ──────────────────────────────────────────────────────────────────
st.markdown("""
<style>
    .block-container { padding-top: 1.5rem; padding-bottom: 1rem; max-width: 1200px; }
    [data-testid="stSidebar"] { background: #1a1f2e; }
    [data-testid="stSidebar"] * { color: #e0e4ec !important; }
    [data-testid="stSidebar"] hr { border-color: #2d3548; }

    .info-card {
        background: #ffffff; border-radius: 12px; padding: 1.2rem;
        box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #eef0f4;
        margin-bottom: 0.8rem;
    }
    .info-card h4 { margin: 0 0 0.3rem 0; color: #1a1f2e; font-size: 0.95rem; }

    .stButton>button {
        border-radius: 8px; font-weight: 600; border: none;
        transition: transform 0.1s, box-shadow 0.2s;
    }
    .stButton>button:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(74,108,247,0.25); }

    .stDownloadButton>button { border-radius: 8px; font-weight: 600; border: none; }

    .stTabs [data-baseweb="tab-list"] { gap: 0.5rem; }
    .stTabs [data-baseweb="tab"] {
        border-radius: 8px 8px 0 0; padding: 0.5rem 1.2rem;
        font-weight: 600; font-size: 0.9rem;
    }

    .section-label {
        font-size: 0.78rem; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.06em; color: #8892a4; margin: 1rem 0 0.4rem 0;
    }

    /* ── Record Dashboard Table Styles ── */
    .rec-section {
        margin: 0.8rem 0 0.3rem 0; padding: 0.35rem 0.6rem;
        background: #f1f3f8; border-radius: 6px;
        font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.07em; color: #4a6cf7;
    }
    .rec-table {
        width: 100%; border-collapse: collapse; margin-bottom: 0.5rem; table-layout: fixed;
    }
    .rec-table td {
        padding: 0.4rem 0.6rem; font-size: 0.9rem; color: #2c3040;
        vertical-align: top; border-bottom: 1px solid #f0f1f5;
    }
    .rec-table .lbl {
        width: 20%; color: #6b7a90; font-weight: 600; font-size: 0.85rem;
    }
    .rec-table .val { width: 30%; }
    .rec-notes {
        background: #fafbfd; border-left: 3px solid #4a6cf7;
        padding: 0.6rem 0.8rem; margin: 0.3rem 0 1rem 0; border-radius: 0 6px 6px 0;
        font-size: 0.9rem; color: #2c3040; white-space: pre-wrap;
    }
    .rec-notes-label {
        font-size: 0.78rem; font-weight: 700; color: #6b7a90;
        text-transform: uppercase; margin-bottom: 0.2rem;
    }

    #MainMenu, footer { visibility: hidden; }
</style>
""", unsafe_allow_html=True)

# ── Sidebar ─────────────────────────────────────────────────────────────────────
st.sidebar.markdown("## 🏥 MedDigitizer")
st.sidebar.markdown("---")
page = st.sidebar.radio("Navigate", ["📝 Fill Forms", "📋 View Records", "📊 Presentation"], label_visibility="collapsed")


def run_extraction(front_img: Image.Image, back_img: Image.Image) -> Optional[MedicalForm]:
    """Run extraction using Gemini."""
    return gemini_extract(front_img, back_img)


# ═════════════════════════════════════════════════════════════════════════════════
#  HELPER: Render the editable form (reused in Form Entry and Manual Transcription)
# ═════════════════════════════════════════════════════════════════════════════════
def _clean(val) -> str:
    """Sanitize a value for display in a text input. Converts None and the literal string 'null' to empty string."""
    if val is None:
        return ""
    s = str(val).strip()
    if s.lower() in ("null", "none", "n/a", "na", "—"):
        return ""
    return s

def render_form(form_data: MedicalForm, form_key: str, submit_label: str = "💾 Save Record"):
    """Render the editable medical form. Returns True if submitted."""
    with st.form(form_key):
        tab1, tab2, tab3 = st.tabs(["👤 Personal & Contact", "🩺 Medical History", "📋 Health Checkup"])

        with tab1:
            st.markdown('<p class="section-label">Personal Details</p>', unsafe_allow_html=True)
            c1, c2 = st.columns(2)
            form_data.personal_details.name = c1.text_input("Name", value=_clean(form_data.personal_details.name), key=f"{form_key}_name")
            form_data.personal_details.age_sex = c2.text_input("Age/Sex", value=_clean(form_data.personal_details.age_sex), key=f"{form_key}_age")
            form_data.personal_details.class_sec = c1.text_input("Class/Sec", value=_clean(form_data.personal_details.class_sec), key=f"{form_key}_class")
            form_data.personal_details.dob = c2.text_input("DOB", value=_clean(form_data.personal_details.dob), key=f"{form_key}_dob")
            form_data.personal_details.blood_group = c1.text_input("Blood Group", value=_clean(form_data.personal_details.blood_group), key=f"{form_key}_bg")

            st.markdown('<p class="section-label">Guardian Info</p>', unsafe_allow_html=True)
            g1, g2 = st.columns(2)
            form_data.personal_details.father_name = g1.text_input("Father's Name", value=_clean(form_data.personal_details.father_name), key=f"{form_key}_fn")
            form_data.personal_details.mother_name = g2.text_input("Mother's Name", value=_clean(form_data.personal_details.mother_name), key=f"{form_key}_mn")
            form_data.personal_details.occupation_father = g1.text_input("Father's Occupation", value=_clean(form_data.personal_details.occupation_father), key=f"{form_key}_fo")
            form_data.personal_details.occupation_mother = g2.text_input("Mother's Occupation", value=_clean(form_data.personal_details.occupation_mother), key=f"{form_key}_mo")

            st.markdown('<p class="section-label">Contact Details</p>', unsafe_allow_html=True)
            form_data.contact_details.address = st.text_area("Address", value=_clean(form_data.contact_details.address), height=80, key=f"{form_key}_addr")
            ct1, ct2 = st.columns(2)
            form_data.contact_details.pin_code = ct1.text_input("Pin Code", value=_clean(form_data.contact_details.pin_code), key=f"{form_key}_pin")
            form_data.contact_details.phone = ct2.text_input("Phone", value=_clean(form_data.contact_details.phone), key=f"{form_key}_ph")
            form_data.contact_details.mobile = ct1.text_input("Mobile", value=_clean(form_data.contact_details.mobile), key=f"{form_key}_mob")
            form_data.contact_details.family_physician = ct2.text_input("Family Physician", value=_clean(form_data.contact_details.family_physician), key=f"{form_key}_fp")
            form_data.contact_details.physician_phone = ct1.text_input("Physician Phone", value=_clean(form_data.contact_details.physician_phone), key=f"{form_key}_pp")

        with tab2:
            st.markdown('<p class="section-label">Medical History</p>', unsafe_allow_html=True)
            m1, m2 = st.columns(2)
            form_data.medical_history.past_history = m1.text_area("Past History", value=_clean(form_data.medical_history.past_history), height=80, key=f"{form_key}_past")
            form_data.medical_history.jaundice = m2.text_input("Jaundice History", value=_clean(form_data.medical_history.jaundice), key=f"{form_key}_jaun")
            form_data.medical_history.allergies = m1.text_input("Allergies", value=_clean(form_data.medical_history.allergies), key=f"{form_key}_allg")
            form_data.medical_history.blood_transfusion = m2.text_input("Blood Transfusion", value=_clean(form_data.medical_history.blood_transfusion), key=f"{form_key}_bt")
            form_data.medical_history.major_illness_operation = m1.text_input("Major Illness/Operation", value=_clean(form_data.medical_history.major_illness_operation), key=f"{form_key}_mi")
            form_data.medical_history.implants_accessories = m2.text_input("Implants/Accessories", value=_clean(form_data.medical_history.implants_accessories), key=f"{form_key}_imp")

            st.markdown('<p class="section-label">Vaccination Status</p>', unsafe_allow_html=True)
            v1, v2 = st.columns(2)
            form_data.vaccination_status.hepatitis_b = v1.text_input("Hepatitis B", value=_clean(form_data.vaccination_status.hepatitis_b), key=f"{form_key}_hb")
            form_data.vaccination_status.typhoid = v2.text_input("Typhoid", value=_clean(form_data.vaccination_status.typhoid), key=f"{form_key}_typh")
            form_data.vaccination_status.dt_polio = v1.text_input("D.T. & Polio Booster", value=_clean(form_data.vaccination_status.dt_polio), key=f"{form_key}_dtp")
            form_data.vaccination_status.tentanu = v2.text_input("Tentanu", value=_clean(form_data.vaccination_status.tentanu), key=f"{form_key}_tet")
            form_data.vaccination_status.other_info = v1.text_area("Other Info", value=_clean(form_data.vaccination_status.other_info), height=68, key=f"{form_key}_oi")
            form_data.vaccination_status.current_medication = v2.text_area("Current Medication", value=_clean(form_data.vaccination_status.current_medication), height=68, key=f"{form_key}_cm")

        with tab3:
            st.markdown('<p class="section-label">Health Check-up</p>', unsafe_allow_html=True)
            h1, h2 = st.columns(2)
            form_data.health_checkup.date_exam = h1.text_input("Date of Exam", value=_clean(form_data.health_checkup.date_exam), key=f"{form_key}_de")
            form_data.health_checkup.height_weight = h2.text_input("Height & Weight", value=_clean(form_data.health_checkup.height_weight), key=f"{form_key}_hw")
            form_data.health_checkup.general_cleanliness = h1.text_input("General Cleanliness", value=_clean(form_data.health_checkup.general_cleanliness), key=f"{form_key}_gc")
            form_data.health_checkup.eyes_vision = h2.text_input("Eyes (Vision)", value=_clean(form_data.health_checkup.eyes_vision), key=f"{form_key}_ev")
            form_data.health_checkup.ears = h1.text_input("Ears", value=_clean(form_data.health_checkup.ears), key=f"{form_key}_ears")
            form_data.health_checkup.nose_throat = h2.text_input("Nose & Throat", value=_clean(form_data.health_checkup.nose_throat), key=f"{form_key}_nt")
            form_data.health_checkup.teeth_gums = h1.text_input("Teeth & Gums", value=_clean(form_data.health_checkup.teeth_gums), key=f"{form_key}_tg")
            form_data.health_checkup.systemic_exam = st.text_area("Systemic Exam", value=_clean(form_data.health_checkup.systemic_exam), key=f"{form_key}_se")
            form_data.health_checkup.remarks = st.text_area("Doctor's Remarks", value=_clean(form_data.health_checkup.remarks), key=f"{form_key}_rem")
            form_data.health_checkup.additional_notes = st.text_area("Additional Notes", value=_clean(form_data.health_checkup.additional_notes), height=120, key=f"{form_key}_an")

            st.markdown('<p class="section-label">Signatures</p>', unsafe_allow_html=True)
            s1, s2, s3 = st.columns(3)
            form_data.health_checkup.teacher_sign = s1.text_input("Teacher's Sign", value=_clean(form_data.health_checkup.teacher_sign), key=f"{form_key}_ts")
            form_data.health_checkup.principal_sign = s2.text_input("Principal's Sign", value=_clean(form_data.health_checkup.principal_sign), key=f"{form_key}_ps")
            form_data.health_checkup.parent_sign = s3.text_input("Parent's Sign", value=_clean(form_data.health_checkup.parent_sign), key=f"{form_key}_prs")

        return st.form_submit_button(submit_label, type="primary", use_container_width=True)


# ═════════════════════════════════════════════════════════════════════════════════
#  FILL FORMS PAGE (Combines Single Entry and Bulk Import)
# ═════════════════════════════════════════════════════════════════════════════════
if page == "📝 Fill Forms":
    st.markdown("## 📝 Fill Patient Forms")

    tab_single, tab_excel, tab_images = st.tabs(["📄 Single Form", "📊 Bulk Excel / CSV", "🖼️ Bulk Images"])

    # ── Single Form ─────────────────────────────────────────────────────────────
    with tab_single:
        # Image upload area
        st.markdown('<p class="section-label">Upload form images (optional — enables AI auto-fill)</p>', unsafe_allow_html=True)
        img_col1, img_col2 = st.columns(2)
        with img_col1:
            front_file = st.file_uploader("Front image", type=["jpg", "jpeg", "png"], key="single_front", label_visibility="collapsed")
        with img_col2:
            back_file = st.file_uploader("Back image", type=["jpg", "jpeg", "png"], key="single_back", label_visibility="collapsed")

        # AI Digitize button (only when both images uploaded)
        if front_file and back_file:
            if st.button("✨ Digitize with AI", type="primary", use_container_width=True):
                with st.spinner("Analyzing form with Gemini…"):
                    try:
                        front_img = Image.open(front_file)
                        back_img = Image.open(back_file)
                        extracted = run_extraction(front_img, back_img)
                        if extracted:
                            st.session_state['form_data'] = extracted
                            st.session_state['ref_front'] = front_file
                            st.session_state['ref_back'] = back_file
                            st.success("✅ Digitized! Review and edit below.")
                            st.rerun()
                        else:
                            st.error("Failed to extract data. Try again or fill manually.")
                    except Exception as e:
                        st.error(f"Error: {e}")
        elif front_file or back_file:
            st.caption("Upload both front & back images to enable AI digitization.")

        # Always show form (no blank form button needed)
        if 'form_data' not in st.session_state:
            st.session_state['form_data'] = MedicalForm()

        form_data: MedicalForm = st.session_state['form_data']
        st.markdown("---")

        # Layout: reference images on left (if available), form on right
        has_ref = front_file or back_file or 'ref_front' in st.session_state
        if has_ref:
            ref_col, form_col = st.columns([1, 2])
        else:
            ref_col = None
            form_col = st.container()

        if ref_col:
            with ref_col:
                st.markdown('<p class="section-label">Reference Images</p>', unsafe_allow_html=True)
                ref_f = st.session_state.get('ref_front') or front_file
                ref_b = st.session_state.get('ref_back') or back_file
                if ref_f:
                    st.image(ref_f, caption="Front", use_container_width=True)
                if ref_b:
                    st.image(ref_b, caption="Back", use_container_width=True)

        with form_col:
            submitted = render_form(form_data, "entry_form", "💾 Save Record")
            if submitted:
                try:
                    save_form(form_data)
                    st.success("✅ Record saved!")
                    st.session_state['form_data'] = MedicalForm()
                    st.session_state.pop('ref_front', None)
                    st.session_state.pop('ref_back', None)
                    st.rerun()
                except Exception as e:
                    st.error(f"Error saving: {e}")

    # ── Bulk Excel / CSV ────────────────────────────────────────────────────────
    with tab_excel:
        st.markdown('<p class="section-label">Step 1: Get the template</p>', unsafe_allow_html=True)
        template_bytes = generate_template()
        
        tc1, tc2 = st.columns(2)
        with tc1:
            st.download_button(
                "⬇️ Download Excel Template",
                data=template_bytes,
                file_name="medical_form_template.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True
            )
        with tc2:
            if st.button("🚀 Open Template Directly", use_container_width=True):
                import os
                try:
                    with open("medical_form_template.xlsx", "wb") as f:
                        f.write(template_bytes)
                    os.startfile(os.path.abspath("medical_form_template.xlsx"))
                    st.success("✅ Opening Excel template...")
                except Exception as e:
                    st.error(f"Could not open file: {e}")
                    
        st.markdown('<p class="section-label">Step 2: Upload filled file</p>', unsafe_allow_html=True)
        uploaded = st.file_uploader("Upload Excel or CSV", type=["xlsx", "xls", "csv"], key="excel_upload", label_visibility="collapsed")
        if uploaded:
            is_valid, msg, df = validate_file(uploaded)
            if is_valid and df is not None:
                st.success(msg)
                st.markdown('<p class="section-label">Preview</p>', unsafe_allow_html=True)
                st.dataframe(df.head(20), use_container_width=True, height=300)
                forms = dataframe_to_forms(df)
                if len(forms) < len(df):
                    st.warning(f"⚠️ {len(df) - len(forms)} row(s) had errors and will be skipped.")
                if forms:
                    if st.button(f"💾 Save All {len(forms)} Records", type="primary", use_container_width=True):
                        try:
                            count = save_forms_bulk(forms)
                            st.success(f"✅ Saved {count} records!")
                            st.balloons()
                        except Exception as e:
                            st.error(f"Error: {e}")
                else:
                    st.error("No valid records found.")
            else:
                st.error(msg)

    # ── Bulk Images (AI Scan & Manual Transcription) ────────────────────────────
    with tab_images:
        img_tab_auto, img_tab_manual = st.tabs(["🤖 Auto AI Scan", "✍️ Manual Transcription"])
        
        with img_tab_auto:
            st.markdown("""
            <div class="info-card">
                <h4>Batch AI Processing</h4>
                <p style="margin:0; color:#5a6275; font-size:0.88rem;">
                    Upload front-page images and back-page images separately.
                    Files with the <strong>same name</strong> are automatically paired (e.g. <code>001.jpg</code> in both folders).
                </p>
            </div>
            """, unsafe_allow_html=True)

            fcol, bcol = st.columns(2)
            with fcol:
                st.markdown('<p class="section-label">📄 Front Pages</p>', unsafe_allow_html=True)
                front_files = st.file_uploader("Upload front images", type=["jpg", "jpeg", "png"],
                                               accept_multiple_files=True, key="bulk_fronts", label_visibility="collapsed")
            with bcol:
                st.markdown('<p class="section-label">📄 Back Pages</p>', unsafe_allow_html=True)
                back_files = st.file_uploader("Upload back images", type=["jpg", "jpeg", "png"],
                                              accept_multiple_files=True, key="bulk_backs", label_visibility="collapsed")

            if front_files and back_files:
                import os
                # Build lookup by filename stem (without extension)
                front_by_name = {}
                for f in front_files:
                    stem = os.path.splitext(f.name)[0].strip().lower()
                    front_by_name[stem] = f

                back_by_name = {}
                for b in back_files:
                    stem = os.path.splitext(b.name)[0].strip().lower()
                    back_by_name[stem] = b

                # Find matches
                matched_names = sorted(set(front_by_name.keys()) & set(back_by_name.keys()))
                unmatched_fronts = sorted(set(front_by_name.keys()) - set(back_by_name.keys()))
                unmatched_backs = sorted(set(back_by_name.keys()) - set(front_by_name.keys()))

                if matched_names:
                    pairs = [(front_by_name[n], back_by_name[n]) for n in matched_names]
                    st.success(f"✅ Matched **{len(pairs)}** pair(s) by filename.")

                    if unmatched_fronts:
                        st.warning(f"⚠️ {len(unmatched_fronts)} front image(s) had no matching back: {', '.join(unmatched_fronts)}")
                    if unmatched_backs:
                        st.warning(f"⚠️ {len(unmatched_backs)} back image(s) had no matching front: {', '.join(unmatched_backs)}")

                    with st.expander(f"Preview {len(pairs)} matched pairs", expanded=False):
                        for idx, (front, back) in enumerate(pairs):
                            c1, c2 = st.columns(2)
                            c1.caption(f"Pair {idx+1} — Front: {front.name}")
                            c1.image(front, use_container_width=True)
                            c2.caption(f"Pair {idx+1} — Back: {back.name}")
                            c2.image(back, use_container_width=True)

                    if st.button(f"✨ Digitize All {len(pairs)} Pairs", type="primary", use_container_width=True):
                        results = [None] * len(pairs)
                        errors = []
                        progress = st.progress(0, text="Processing…")
                        completed = 0

                        def _extract_pair(idx_pair):
                            idx, (front, back) = idx_pair
                            return idx, run_extraction(Image.open(front), Image.open(back))

                        max_workers = min(4, len(pairs))
                        with ThreadPoolExecutor(max_workers=max_workers) as executor:
                            futures = {executor.submit(_extract_pair, (idx, pair)): idx for idx, pair in enumerate(pairs)}
                            for future in as_completed(futures):
                                completed += 1
                                progress.progress(completed / len(pairs), text=f"Processed {completed}/{len(pairs)} pairs…")
                                try:
                                    idx, extracted = future.result()
                                    if extracted:
                                        results[idx] = extracted
                                    else:
                                        errors.append(f"Pair {idx+1}: extraction returned empty")
                                except Exception as e:
                                    idx = futures[future]
                                    errors.append(f"Pair {idx+1}: {e}")

                        progress.progress(1.0, text="Done!")
                        results = [r for r in results if r is not None]
                        if errors:
                            st.warning(f"⚠️ {len(errors)} pair(s) failed:")
                            for err in errors:
                                st.caption(f"• {err}")
                        if results:
                            try:
                                count = save_forms_bulk(results)
                                st.success(f"✅ Digitized and saved {count} record(s)!")
                                st.balloons()
                            except Exception as e:
                                st.error(f"Extraction succeeded but save failed: {e}")
                else:
                    st.error("No matching filenames found between front and back uploads. Make sure files share the same name (e.g. `001.jpg` in both).")
            elif front_files or back_files:
                st.info("Upload both front and back page images to start pairing.")

        # ── Manual Transcription ─────────────────────────────────────────────────────
        with img_tab_manual:
            st.markdown("""
            <div class="info-card">
                <h4>Manual Transcription from Image Folders</h4>
                <p style="margin:0; color:#5a6275; font-size:0.88rem;">
                    Upload front images and back images separately. Files with the same name
                    are paired automatically. Browse through each person's form images and
                    type the data into the form on the right.
                </p>
            </div>
            """, unsafe_allow_html=True)

            tcol1, tcol2 = st.columns(2)
            with tcol1:
                front_files = st.file_uploader("📂 Front images folder", type=["jpg", "jpeg", "png"],
                                               accept_multiple_files=True, key="trans_front")
            with tcol2:
                back_files = st.file_uploader("📂 Back images folder", type=["jpg", "jpeg", "png"],
                                              accept_multiple_files=True, key="trans_back")

            if front_files and back_files:
                # Match by filename
                front_map = {f.name: f for f in front_files}
                back_map = {f.name: f for f in back_files}
                matched_names = sorted(set(front_map.keys()) & set(back_map.keys()))
                front_only = sorted(set(front_map.keys()) - set(back_map.keys()))
                back_only = sorted(set(back_map.keys()) - set(front_map.keys()))

                if front_only:
                    st.warning(f"⚠️ {len(front_only)} front image(s) have no matching back: {', '.join(front_only[:5])}")
                if back_only:
                    st.warning(f"⚠️ {len(back_only)} back image(s) have no matching front: {', '.join(back_only[:5])}")

                if not matched_names:
                    st.error("No matching filenames found between front and back uploads. Make sure the file names match.")
                else:
                    st.success(f"✅ Matched {len(matched_names)} pairs by filename.")

                    # Initialize transcription state
                    if 'trans_index' not in st.session_state:
                        st.session_state['trans_index'] = 0
                    if 'trans_forms' not in st.session_state:
                        st.session_state['trans_forms'] = {}  # filename -> MedicalForm
                    if 'trans_saved' not in st.session_state:
                        st.session_state['trans_saved'] = set()  # filenames that have been saved to DB

                    idx = st.session_state['trans_index']
                    idx = max(0, min(idx, len(matched_names) - 1))
                    st.session_state['trans_index'] = idx
                    current_file = matched_names[idx]

                    # Progress info
                    saved_count = len(st.session_state['trans_saved'])
                    is_saved = current_file in st.session_state['trans_saved']
                    status_text = "✅ Saved" if is_saved else "⏳ Pending"

                    st.markdown(f"""
                    <div style="display:flex; justify-content:space-between; align-items:center; margin: 0.5rem 0;">
                        <span style="font-weight:700; font-size:1rem;">
                            📄 {current_file} &nbsp;
                            <span style="font-size:0.8rem; color: {'#22c55e' if is_saved else '#f59e0b'};">{status_text}</span>
                        </span>
                        <span style="color:#8892a4; font-size:0.85rem;">
                            {idx + 1} / {len(matched_names)} &nbsp;·&nbsp; {saved_count} saved
                        </span>
                    </div>
                    """, unsafe_allow_html=True)

                    # Navigation buttons
                    nav_c1, nav_c2, nav_c3, nav_c4 = st.columns(4)
                    with nav_c1:
                        if st.button("⬅️ Previous", use_container_width=True, disabled=(idx == 0)):
                            st.session_state['trans_index'] = idx - 1
                            st.rerun()
                    with nav_c2:
                        if st.button("Next ➡️", use_container_width=True, disabled=(idx >= len(matched_names) - 1)):
                            st.session_state['trans_index'] = idx + 1
                            st.rerun()
                    with nav_c3:
                        # Jump to specific index
                        jump = st.number_input("Go to #", min_value=1, max_value=len(matched_names),
                                               value=idx + 1, key="trans_jump", label_visibility="collapsed")
                        if jump - 1 != idx:
                            st.session_state['trans_index'] = jump - 1
                            st.rerun()
                    with nav_c4:
                        if st.button("⏭️ Next Unsaved", use_container_width=True):
                            # Find next unsaved
                            for i in range(idx + 1, len(matched_names)):
                                if matched_names[i] not in st.session_state['trans_saved']:
                                    st.session_state['trans_index'] = i
                                    st.rerun()
                            for i in range(0, idx):
                                if matched_names[i] not in st.session_state['trans_saved']:
                                    st.session_state['trans_index'] = i
                                    st.rerun()
                            st.info("All records are saved!")

                    st.markdown("---")

                    # Load or create form for current file
                    if current_file not in st.session_state['trans_forms']:
                        st.session_state['trans_forms'][current_file] = MedicalForm()
                    current_form = st.session_state['trans_forms'][current_file]

                    # Layout: images left, form right
                    img_panel, form_panel = st.columns([1, 2])

                    with img_panel:
                        st.markdown('<p class="section-label">Front</p>', unsafe_allow_html=True)
                        st.image(front_map[current_file], use_container_width=True)
                        st.markdown('<p class="section-label">Back</p>', unsafe_allow_html=True)
                        st.image(back_map[current_file], use_container_width=True)

                    with form_panel:
                        submitted = render_form(current_form, f"trans_form_{idx}",
                                                submit_label="💾 Save & Next" if idx < len(matched_names) - 1 else "💾 Save")
                        if submitted:
                            try:
                                save_form(current_form)
                                st.session_state['trans_saved'].add(current_file)
                                st.success(f"✅ Saved {current_form.personal_details.name or current_file}!")
                                # Auto-advance to next unsaved
                                if idx < len(matched_names) - 1:
                                    st.session_state['trans_index'] = idx + 1
                                st.rerun()
                            except Exception as e:
                                st.error(f"Error: {e}")

                        # Update button (for already-saved records)
                        if is_saved:
                            st.caption("This record is already saved. Submitting again will create a duplicate. Use this if you want to re-save with corrections.")


# ═════════════════════════════════════════════════════════════════════════════════
#  VIEW RECORDS PAGE — Full dashboard with clean table layout
# ═════════════════════════════════════════════════════════════════════════════════
elif page == "📋 View Records":
    st.markdown("## 📋 Patient Records")

    search_query = st.text_input("🔍 Search by name", placeholder="Type a name…", label_visibility="collapsed")
    records = search_forms(search_query) if search_query else get_all_forms()

    if not records:
        st.info("No records found." if search_query else "No records yet. Create one from **➕ New Entry**.")
    else:
        st.caption(f"Showing {len(records)} record(s)")

        for record in records:
            data = json.loads(record['form_data'])
            pd_d = data.get('personal_details', {})
            cd_d = data.get('contact_details', {})
            mh_d = data.get('medical_history', {})
            vs_d = data.get('vaccination_status', {})
            hc_d = data.get('health_checkup', {})

            name = pd_d.get('name', 'Unknown')
            age_sex = pd_d.get('age_sex', '')
            class_sec = pd_d.get('class_sec', '')
            created = record['created_at']

            def _v(val):
                """Format a value for display — show dash for empty/None."""
                if val is None or str(val).strip() == '' or val == 'None':
                    return '—'
                return str(val)

            with st.expander(f"**{name}**  ·  {age_sex}  ·  Class {class_sec}  ·  _{created}_"):

                # Build the entire record as a single HTML block for clean rendering
                html = '<div style="max-width:900px;">'

                # ── Personal Details ─────────────────────────────────
                html += '<div class="rec-section">👤 Personal Details</div>'
                html += '<table class="rec-table"><tbody>'
                html += f'<tr><td class="lbl">Name</td><td class="val">{_v(pd_d.get("name"))}</td>'
                html += f'    <td class="lbl">Age / Sex</td><td class="val">{_v(pd_d.get("age_sex"))}</td></tr>'
                html += f'<tr><td class="lbl">Class / Section</td><td class="val">{_v(pd_d.get("class_sec"))}</td>'
                html += f'    <td class="lbl">Date of Birth</td><td class="val">{_v(pd_d.get("dob"))}</td></tr>'
                html += f'<tr><td class="lbl">Blood Group</td><td class="val">{_v(pd_d.get("blood_group"))}</td>'
                html += f'    <td class="lbl"></td><td class="val"></td></tr>'
                html += f'<tr><td class="lbl">Father\'s Name</td><td class="val">{_v(pd_d.get("father_name"))}</td>'
                html += f'    <td class="lbl">Father\'s Occupation</td><td class="val">{_v(pd_d.get("occupation_father"))}</td></tr>'
                html += f'<tr><td class="lbl">Mother\'s Name</td><td class="val">{_v(pd_d.get("mother_name"))}</td>'
                html += f'    <td class="lbl">Mother\'s Occupation</td><td class="val">{_v(pd_d.get("occupation_mother"))}</td></tr>'
                html += '</tbody></table>'

                # ── Contact Details ──────────────────────────────────
                html += '<div class="rec-section">📞 Contact Details</div>'
                html += '<table class="rec-table"><tbody>'
                html += f'<tr><td class="lbl">Address</td><td class="val" colspan="3">{_v(cd_d.get("address"))}</td></tr>'
                html += f'<tr><td class="lbl">Pin Code</td><td class="val">{_v(cd_d.get("pin_code"))}</td>'
                html += f'    <td class="lbl">Phone</td><td class="val">{_v(cd_d.get("phone"))}</td></tr>'
                html += f'<tr><td class="lbl">Mobile</td><td class="val">{_v(cd_d.get("mobile"))}</td>'
                html += f'    <td class="lbl">Family Physician</td><td class="val">{_v(cd_d.get("family_physician"))}</td></tr>'
                html += f'<tr><td class="lbl">Physician Phone</td><td class="val">{_v(cd_d.get("physician_phone"))}</td>'
                html += f'    <td class="lbl"></td><td class="val"></td></tr>'
                html += '</tbody></table>'

                # ── Medical History ──────────────────────────────────
                html += '<div class="rec-section">🩺 Medical History</div>'
                html += '<table class="rec-table"><tbody>'
                html += f'<tr><td class="lbl">Past History</td><td class="val">{_v(mh_d.get("past_history"))}</td>'
                html += f'    <td class="lbl">Jaundice</td><td class="val">{_v(mh_d.get("jaundice"))}</td></tr>'
                html += f'<tr><td class="lbl">Allergies</td><td class="val">{_v(mh_d.get("allergies"))}</td>'
                html += f'    <td class="lbl">Blood Transfusion</td><td class="val">{_v(mh_d.get("blood_transfusion"))}</td></tr>'
                html += f'<tr><td class="lbl">Major Illness/Op</td><td class="val">{_v(mh_d.get("major_illness_operation"))}</td>'
                html += f'    <td class="lbl">Implants/Accessories</td><td class="val">{_v(mh_d.get("implants_accessories"))}</td></tr>'
                html += '</tbody></table>'

                # ── Vaccination Status ───────────────────────────────
                html += '<div class="rec-section">💉 Vaccination Status</div>'
                html += '<table class="rec-table"><tbody>'
                html += f'<tr><td class="lbl">Hepatitis B</td><td class="val">{_v(vs_d.get("hepatitis_b"))}</td>'
                html += f'    <td class="lbl">Typhoid</td><td class="val">{_v(vs_d.get("typhoid"))}</td></tr>'
                html += f'<tr><td class="lbl">D.T. & Polio</td><td class="val">{_v(vs_d.get("dt_polio"))}</td>'
                html += f'    <td class="lbl">Tentanu</td><td class="val">{_v(vs_d.get("tentanu"))}</td></tr>'
                html += f'<tr><td class="lbl">Other Info</td><td class="val">{_v(vs_d.get("other_info"))}</td>'
                html += f'    <td class="lbl">Current Medication</td><td class="val">{_v(vs_d.get("current_medication"))}</td></tr>'
                html += '</tbody></table>'

                # ── Health Check-up ──────────────────────────────────
                html += '<div class="rec-section">📋 Health Check-up</div>'
                html += '<table class="rec-table"><tbody>'
                html += f'<tr><td class="lbl">Date of Exam</td><td class="val">{_v(hc_d.get("date_exam"))}</td>'
                html += f'    <td class="lbl">Height & Weight</td><td class="val">{_v(hc_d.get("height_weight"))}</td></tr>'
                html += f'<tr><td class="lbl">General Cleanliness</td><td class="val">{_v(hc_d.get("general_cleanliness"))}</td>'
                html += f'    <td class="lbl">Eyes (Vision)</td><td class="val">{_v(hc_d.get("eyes_vision"))}</td></tr>'
                html += f'<tr><td class="lbl">Ears</td><td class="val">{_v(hc_d.get("ears"))}</td>'
                html += f'    <td class="lbl">Nose & Throat</td><td class="val">{_v(hc_d.get("nose_throat"))}</td></tr>'
                html += f'<tr><td class="lbl">Teeth & Gums</td><td class="val">{_v(hc_d.get("teeth_gums"))}</td>'
                html += f'    <td class="lbl">Systemic Exam</td><td class="val">{_v(hc_d.get("systemic_exam"))}</td></tr>'
                html += '</tbody></table>'

                # Remarks & notes — full-width blocks
                remarks = _v(hc_d.get('remarks'))
                notes = _v(hc_d.get('additional_notes'))
                if remarks != '—':
                    html += f'<div class="rec-notes-label">Doctor\'s Remarks</div>'
                    html += f'<div class="rec-notes">{remarks}</div>'
                if notes != '—':
                    html += f'<div class="rec-notes-label">Additional Notes</div>'
                    html += f'<div class="rec-notes">{notes}</div>'

                # Signatures
                html += '<table class="rec-table" style="margin-top:0.5rem;"><tbody>'
                html += f'<tr><td class="lbl">Teacher</td><td class="val">{_v(hc_d.get("teacher_sign"))}</td>'
                html += f'    <td class="lbl">Principal</td><td class="val">{_v(hc_d.get("principal_sign"))}</td></tr>'
                html += f'<tr><td class="lbl">Parent</td><td class="val">{_v(hc_d.get("parent_sign"))}</td>'
                html += f'    <td class="lbl"></td><td class="val"></td></tr>'
                html += '</tbody></table>'

                html += '</div>'
                st.markdown(html, unsafe_allow_html=True)

                # Delete
                if st.button("🗑️ Delete Record", key=f"del_{record['id']}", type="secondary"):
                    delete_form(record['id'])
                    st.rerun()

# ═════════════════════════════════════════════════════════════════════════════════
#  PRESENTATION PAGE
# ═════════════════════════════════════════════════════════════════════════════════
elif page == "📊 Presentation":
    st.markdown("## 📊 Project Presentation")
    st.markdown("View or open the **MedDigitizer** PowerPoint presentation.")
    
    st.markdown("---")
    
    col1, col2 = st.columns(2)
    with col1:
        st.info("⬇️ **Download a copy** of the presentation to your device.")
        try:
            with open("MedDigitizer.pptx", "rb") as f:
                st.download_button(
                    "📥 Download Presentation", 
                    data=f, 
                    file_name="MedDigitizer.pptx", 
                    mime="application/vnd.openxmlformats-officedocument.presentationml.presentation",
                    use_container_width=True
                )
        except FileNotFoundError:
            st.error("MedDigitizer.pptx not found in the directory.")
            
    with col2:
        st.info("🖥️ **Open directly** (Works only when running locally on Windows).")
        if st.button("🚀 Open Presentation Locally", type="primary", use_container_width=True):
            import os
            try:
                os.startfile(os.path.abspath("MedDigitizer.pptx"))
                st.success("✅ Opening presentation...")
            except Exception as e:
                st.error(f"Could not open file: {e}")

