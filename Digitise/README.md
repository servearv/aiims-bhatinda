# MedDigitizer

A Streamlit-based tool for digitizing handwritten medical health cards from Indian schools. It uses Google's Gemini vision model to extract structured data from scanned form images and stores the results in a local SQLite database.

Built for [AIIMS Bathinda](https://aiimsbathinda.edu.in/) to streamline the digitization of student health records.

## Features

- **AI-powered extraction** — Upload front and back images of a health card; Gemini reads the handwriting and fills in a structured form automatically.
- **Batch processing** — Upload entire folders of front-page and back-page images. Files with matching names are paired and processed concurrently (up to 4 parallel API calls).
- **Manual entry** — Fill forms manually through a clean, tabbed interface covering personal details, medical history, vaccinations, and health checkup data.
- **Bulk Excel/CSV import** — Download a pre-formatted template, fill it in a spreadsheet, and upload to import many records at once.
- **Manual transcription from images** — Browse through uploaded form images side-by-side with an editable form for manual data entry.
- **Record management** — Search, view, and delete stored records through a dashboard with structured card-style display.
- **SQLite storage** — All records are persisted locally in `medical_forms.db`.

## Project Structure

```
.
├── app.py               # Main Streamlit application (UI, routing, all tabs)
├── gemini_client.py     # Gemini API client for image-to-JSON extraction
├── schema.py            # Pydantic models (MedicalForm and sub-models)
├── db.py                # SQLite database operations (CRUD)
├── excel_handler.py     # Excel/CSV template generation and import
├── requirements.txt     # Python dependencies
├── .env.example         # Environment variable template
└── medical_forms.db     # SQLite database (created on first run)
```

## Setup

### Prerequisites

- Python 3.10+
- A [Google AI Studio](https://aistudio.google.com/) API key with access to Gemini

### Installation

```bash
git clone <repo-url>
cd aiims-bhatinda

pip install -r requirements.txt

cp .env.example .env
# Edit .env and add your Google API key
```

### Running

```bash
streamlit run app.py
```

The app will open at `http://localhost:8501`.

## Usage

### Single Form Entry

1. Navigate to **Fill Forms > Single Form**.
2. Upload front and back images of the health card.
3. Click **Digitize with AI** — Gemini extracts all fields.
4. Review and correct any misread values in the form.
5. Click **Save Record**.

### Batch Processing

1. Navigate to **Fill Forms > Bulk Images > Auto AI Scan**.
2. Upload all front-page images in the left uploader and all back-page images in the right uploader.
3. Files are matched by name — `001.jpg` in fronts pairs with `001.jpg` (or `001.png`) in backs.
4. Review the matched pairs in the preview expander.
5. Click **Digitize All Pairs** — extraction runs concurrently and records are saved automatically.

### Excel/CSV Import

1. Navigate to **Fill Forms > Bulk Excel / CSV**.
2. Download the template, fill it in any spreadsheet editor.
3. Upload the completed file — records are validated and can be saved in bulk.

## Schema

The form schema covers five sections, defined in `schema.py`:

| Section | Fields |
|---|---|
| Personal Details | Name, age/sex, class, DOB, blood group, parents' names and occupations |
| Contact Details | Address, pin code, phone, mobile, family physician |
| Medical History | Past history, jaundice, allergies, blood transfusion, surgeries, implants |
| Vaccination Status | Hepatitis B, typhoid, DT & polio, tetanus, current medication |
| Health Checkup | Date, height/weight, vision, ears, dental, systemic exam, doctor remarks |

## Configuration

The only required environment variable is:

```
GOOGLE_API_KEY=your_key_here
```

The Gemini model is configured in `gemini_client.py` (default: `gemini-3.1-flash-lite-preview`). Change the `MODEL_NAME` constant to use a different model.

## License

This project was developed for internal use at AIIMS Bathinda.
