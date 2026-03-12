from gemini_client import extract_data_from_images
from PIL import Image

try:
    # We will try to pass two small dummy images just to see what the API returns.
    img1 = Image.new('RGB', (100, 100), color='white')
    img2 = Image.new('RGB', (100, 100), color='white')
    
    print("Sending dummy images to Gemini...")
    result = extract_data_from_images(img1, img2)
    print("Result:", result)
except Exception as e:
    print(f"Exception: {e}")
