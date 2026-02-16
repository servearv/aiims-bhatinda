import google.generativeai as genai
import os
import json
from dotenv import load_dotenv
from typing import Optional
from PIL import Image
from schema import MedicalForm

load_dotenv()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# Use a stable model
MODEL_NAME = 'gemini-flash-latest'

def extract_data_from_images(front_img: Image.Image, back_img: Image.Image) -> Optional[MedicalForm]:
    model = genai.GenerativeModel(MODEL_NAME)
    
    # Get the JSON schema from the Pydantic model
    schema_json = json.dumps(MedicalForm.model_json_schema())

    prompt = f"""
    You are an expert data entry assistant.
    Analyze these two images of a medical form (front and back).
    Extract all the handwritten and printed information into a structured JSON format.
    
    The output must strictly follow this JSON schema:
    {schema_json}
    
    If a field is illegible or missing, return null (None) for that field.
    Do not invent information.
    
    Output ONLY valid JSON.
    """

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
        print(f"Error extracting data: {e}")
        return None
