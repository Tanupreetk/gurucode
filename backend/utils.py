import PyPDF2
import google.generativeai as genai
import os
import json
import re
from dotenv import load_dotenv

# 1. Load environment variables
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("WARNING: GEMINI_API_KEY not found in .env file!")

genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-2.5-flash')

def extract_text_from_pdf(pdf_path):
    """
    Extracts all text from a PDF file.
    """
    text = ""
    try:
        if not os.path.exists(pdf_path):
            return "File not found."
            
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text.strip()
    except Exception as e:
        print(f"Error extracting PDF: {str(e)}")
        return ""

def clean_json_response(raw_text):
    """
    Helper function to remove markdown code blocks (```json ... ```) 
    that Gemini often includes in its response.
    """
    # Remove markdown formatting if present
    clean_text = re.sub(r'```json|```', '', raw_text).strip()
    try:
        return json.loads(clean_text)
    except Exception as e:
        print(f"JSON Parsing Error: {e}")
        # Return a fallback object so the app doesn't crash
        return {"error": "Failed to parse AI response"}

def analyze_placement(resume_text, jd_text):
    """
    Compares Resume text with Job Description text using Gemini.
    """
    prompt = f"""
    You are an expert ATS (Applicant Tracking System) and Career Coach. 
    Compare the following Resume with the Job Description.

    RESUME:
    {resume_text}

    JOB DESCRIPTION:
    {jd_text}

    Task: Perform a deep gap analysis.
    Return ONLY a JSON object with exactly these keys:
    - matchingSkills: [list of strings]
    - missingSkills: [list of strings]
    - contextualGaps: [list of strings explaining why the candidate might struggle]
    """

    try:
        response = model.generate_content(prompt)
        return clean_json_response(response.text)
    except Exception as e:
        print(f"Gemini Analysis Error: {e}")
        return {
            "matchingSkills": [],
            "missingSkills": ["Error connecting to AI"],
            "contextualGaps": [str(e)]
        }

def generate_sprint(gap_report):
    """
    Creates a 7-day learning roadmap based on the gap report.
    """
    prompt = f"""
    Based on the following skill gaps identified between a candidate and a job:
    {json.dumps(gap_report)}

    Create a 7-day intensive learning sprint to bridge these gaps.
    Return ONLY a JSON array of 7 objects. Each object must have:
    - day: (integer 1 to 7)
    - title: (short string goal for the day)
    - tasks: (list of 2 specific actionable study tasks or projects)
    """

    try:
        response = model.generate_content(prompt)
        return clean_json_response(response.text)
    except Exception as e:
        print(f"Gemini Sprint Error: {e}")
        return [] # Return empty list as fallback
def rewrite_resume_star(resume_text, jd_text):
    """
    Takes resume and JD, identifies experiences, and rewrites them in STAR format.
    """
    prompt = f"""
    You are a professional Resume Writer. 
    Using the Resume and Job Description below, identify the professional experience sections.
    
    RESUME: {resume_text}
    JD: {jd_text}
    
    TASK:
    Rewrite the key achievement bullet points for each role using the STAR method (Situation, Task, Action, Result).
    - Focus on integrating keywords from the Job Description.
    - Ensure each point is impactful and metrics-driven where possible.
    
    RETURN ONLY A JSON OBJECT with this structure:
    {{
      "roles": [
        {{
          "title": "Job Title/Company Name",
          "rewrittenPoints": ["STAR point 1", "STAR point 2"]
        }}
      ]
    }}
    """
    try:
        response = model.generate_content(prompt)
        # We reuse the cleaning function we wrote earlier
        return clean_json_response(response.text)
    except Exception as e:
        print(f"Rewrite Error: {e}")
        return {"roles": []}