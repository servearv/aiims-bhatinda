
import os
import json
import google.generativeai as genai
from dotenv import load_dotenv
from PIL import Image

load_dotenv()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

def analyze_form():
    model = genai.GenerativeModel('gemini-flash-latest')

    try:
        front_img = Image.open("images/form1.jpeg")
        back_img = Image.open("images/form2.jpeg")
    except FileNotFoundError as e:
        print(f"Error loading images: {e}")
        return

    prompt = """
    Analyze these two images of a medical form (front and back).
    Identify all the data fields present in the form.
    Create a JSON schema that represents the structure of this data.
    The schema should be flat or nested as appropriate to logically group the information (e.g., Patient Information, Parental Information, Medical History, Vaccination Status).
    
    Use clear, descriptive keys for the fields.
    For checkboxes (like "Yes/No" or "Class/Sec"), suggest how to represent them (e.g., boolean or string enum).
    
    Output ONLY the JSON structure, valid JSON, no markdown formatting.
    """

    response = model.generate_content([prompt, front_img, back_img])
    
    # Strip markdown if present
    text = response.text
    if text.startswith("```json"):
        text = text[7:]
    if text.endswith("```"):
        text = text[:-3]
        
    try:
        schema = json.loads(text)
        print(json.dumps(schema, indent=4))
    except json.JSONDecodeError:
        print("Failed to decode JSON from response:")
        print(response.text)

if __name__ == "__main__":
    analyze_form()
