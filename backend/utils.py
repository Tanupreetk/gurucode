import PyPDF2
import google.generativeai as genai
import os
import json
import re
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-2.5-flash')

def extract_text_from_pdf(pdf_path):
    """Extracts text from PDF."""
    text = ""
    try:
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text: text += page_text + "\n"
        return text.strip()
    except Exception as e:
        print(f"Error extracting PDF: {e}")
        return ""

def clean_json_response(raw_text):
    """Cleans Gemini markdown and parses JSON."""
    clean_text = re.sub(r'```json|```', '', raw_text).strip()
    try:
        return json.loads(clean_text)
    except:
        # Fallback if AI output is messy
        return {"matchingSkills": [], "missingSkills": [], "contextualGaps": ["Analysis error"]}

def analyze_placement(resume_text, jd_text, local_data):
    """
    Stage 3: AI Interpretation.
    Uses the local math results to provide a reasoned analysis.
    """
    prompt = f"""
    You are an ATS Expert. I have already performed a local NLP analysis:
    - Math Match Score: {local_data['score']}%
    - Locally Detected Skills: {local_data['found_skills']}
    - Statistical JD Keywords: {local_data['keywords']}
    - Inferred Gaps: {local_data['inferred']}

    RESUME TEXT: {resume_text}
    JD TEXT: {jd_text}

    Based on the Math Score of {local_data['score']}%, explain the specific gaps.
    Return ONLY a JSON object:
    {{
      "matchingSkills": [list],
      "missingSkills": [list],
      "contextualGaps": [list of brief explanations]
    }}
    """
    response = model.generate_content(prompt)
    return clean_json_response(response.text)

def generate_sprint(gap_report):
    """Generates 7-day learning roadmap."""
    prompt = f"Based on these gaps: {gap_report}, generate a 7-day intensive learning sprint in JSON format (list of 7 objects with day, title, tasks)."
    response = model.generate_content(prompt)
    return clean_json_response(response.text)

def rewrite_resume_star(resume_text, jd_text):
    """STAR Method Rewriter."""
    prompt = f"Rewrite achievements from this resume: {resume_text} to match this JD: {jd_text} using STAR method. Return JSON: {{ 'roles': [ {{ 'title': '', 'rewrittenPoints': [] }} ] }}"
    response = model.generate_content(prompt)
    return clean_json_response(response.text)

# --- NEW: INTERVIEW CHAT LOGIC ---

def get_interview_response(chat_history, missing_skills, jd_text):
    """
    Acts as a technical interviewer focusing on missing skills.
    """
    prompt = f"""
    You are a Technical Interviewer for this role: {jd_text}.
    The candidate is weak in: {missing_skills}.
    
    Current Chat History: {chat_history}
    
    TASK: 
    1. Ask ONE sharp technical question. 
    2. If they answer correctly, move to the next topic. 
    3. If they finish 3 questions, give a 'Readiness Score' out of 100.
    Keep responses brief and professional.
    """
    response = model.generate_content(prompt)
    return response.text