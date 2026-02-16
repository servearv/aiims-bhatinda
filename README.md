# Medical Form Digitizer

A Streamlit-based application designed to digitize handwritten and printed medical forms using Google Gemini AI. This tool extracts data from front and back images of medical forms and presents it in a structured, editable format, saving the records to a local SQLite database.

## Features

- **Document Processing**: Supports uploading front and back images of medical forms.
- **AI-Powered Extraction**: Utilizes Google Gemini to automatically transcribe handwritten and printed text into structured data.
- **Manual Data Entry**: Provides a manual entry mode for creating records from scratch.
- **Structured Data Management**: Organizes complex medical data into logical sections (Personal Details, Medical History, Health Checkup).
- **Persistent Storage**: Automatically saves all digitized records to a local SQLite database.
- **Record Viewer**: Includes a dedicated interface to view and review historically saved records.

## Prerequisites

- Python 3.8 or higher
- A Google Cloud Project with the Gemini API enabled
- A valid Google API Key

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd aiims-bhatinda
   ```

2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure your API Key:
   - Create a `.env` file in the root directory.
   - Add your Google API Key:
     ```
     GOOGLE_API_KEY=your_api_key_here
     ```

## Usage

To start the application, run the following command from the project root:

```bash
streamlit run app.py
```

The application will launch in your default web browser.

### Creating a New Record

1. Navigate to the "New Entry" section.
2. Select "Upload & Digitize" to use AI extraction or "Fill Manually" for manual input.
3. If uploading, select the front and back images of the form and click "Digitize Form".
4. Review the extracted information in the form fields.
5. Make any necessary corrections and click "Save to Database".

### Viewing Saved Records

1. Navigate to the "View Records" section.
2. Expand any record to view its full details in a read-only format.

## Project Structure

- `app.py`: Main Streamlit application entry point.
- `gemini_client.py`: Handles interactions with the Google Gemini API.
- `db.py`: Manages SQLite database connections and operations.
- `schema.py`: Defines the data models for the medical forms.
- `analyze_form_schema.py`: Utility script for initial schema analysis.
- `requirements.txt`: List of Python dependencies.

## License

[License Information]