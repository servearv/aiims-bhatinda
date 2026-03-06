import google.generativeai as genai
import os
import json
import time
from dotenv import load_dotenv
from typing import Optional
from PIL import Image
from schema import MedicalForm

load_dotenv()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# Use a stable model
MODEL_NAME = 'gemini-3.1-flash-lite-preview'

MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 5

def extract_data_from_images(front_img: Image.Image, back_img: Image.Image) -> Optional[MedicalForm]:
    model = genai.GenerativeModel(MODEL_NAME)
    
    # Get the JSON schema from the Pydantic model
    schema_json = json.dumps(MedicalForm.model_json_schema())

    prompt = f"""
    You are an expert data entry assistant.
    Analyze these two images of a medical form (front and back).
    Extract all the handwritten and printed information into a structured JSON format.
    
    IMPORTANT: If there is an additional prescription or note written on a separate paper or side-by-side with the form (usually in the second image), transcribe it fully into the 'additional_notes' field within the 'health_checkup' section.
    
    The output must strictly follow this JSON schema:
    {schema_json}
    
    If a field is illegible or missing, return null (None) for that field.
    Do not invent information.
    
    Output ONLY valid JSON.
    """

    last_exception = None
    for attempt in range(MAX_RETRIES):
        try:
            response = model.generate_content(
                [prompt, front_img, back_img],
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json"
                )
            )
            
            if response.text:
                text = response.text
                 # Cleanup if needed (though response_mime_type usually handles it)
                if text.startswith("```json"):
                    text = text[7:]
                if text.endswith("```"):
                    text = text[:-3]
                    
                data = json.loads(text)
                return MedicalForm(**data)
            else:
                print("Empty response from Gemini")
                return None

        except Exception as e:
            last_exception = e
            error_str = str(e)
            
            # Check for rate-limit / quota errors
            if "429" in error_str or "ResourceExhausted" in error_str or "quota" in error_str.lower():
                if attempt < MAX_RETRIES - 1:
                    wait_time = RETRY_DELAY_SECONDS * (attempt + 1)
                    print(f"Rate limited (attempt {attempt + 1}/{MAX_RETRIES}). Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                else:
                    # Final attempt failed — raise a clear error
                    raise RuntimeError(
                        f"⚠️ Gemini API quota exceeded. Your free-tier daily limit for '{MODEL_NAME}' has been reached. "
                        f"Please wait a few minutes and try again, or use a different API key."
                    ) from e
            else:
                # Non-retriable error
                print(f"Error extracting data: {e}")
                raise
    
    return None

