import eventlet
eventlet.monkey_patch()
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import os
import uuid
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
import traceback # Added for debugging

from nlp_engine import CustomParser, get_local_score
from utils import extract_text_from_pdf, analyze_placement, generate_sprint, rewrite_resume_star, get_interview_response
from video_auditor import CommunicationModel
load_dotenv()
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv("FLASK_SECRET_KEY", "dev_secret")
CORS(app)
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
# --- SOCKET SETUP ---
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# --- DB SETUP ---
try:
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/")
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    db = client['placement_auditor']
    audits_collection = db['audits']
    client.admin.command('ping')
    print("✅ DATABASE CONNECTED: Successfully linked to MongoDB at 127.0.0.1")
except Exception as e:
    print(f"❌ DATABASE ERROR: {e}")
    audits_collection = None
TECH_SKILLS_DB = ["python", "javascript", "react", "node.js", "sql", "aws", "docker", "pandas", "java", "fastapi", "flask", "mongodb"]

@app.route('/api/upload-resume', methods=['POST'])
def upload_resume():
    try:
        file = request.files['resume']
        profile_id = str(uuid.uuid4())
        filepath = os.path.join('uploads', f"{profile_id}_{file.filename}")
        os.makedirs('uploads', exist_ok=True)
        file.save(filepath)
        text = extract_text_from_pdf(filepath)
        return jsonify({"id": profile_id, "text": text}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/analyze', methods=['POST'])
def analyze_full_pipeline():
    data = request.json
    resume_text = data.get('resumeText')
    jd_text = data.get('jdText')

    print("--- STARTING ANALYSIS PIPELINE ---")
    try:
        # 1. Local NLP Extraction
        print("Running Custom Parser...")
        parser = CustomParser(resume_text)
        contact = parser.extract_contact_info()
        found_skills = parser.extract_skills(TECH_SKILLS_DB)
        inferred = parser.infer_missing_related_skills(found_skills)

        # 2. Local Math Scoring
        print("Running TF-IDF Scorer...")
        math_score, top_keywords = get_local_score(resume_text, jd_text)

        local_data = {
            "score": math_score,
            "found_skills": found_skills,
            "keywords": top_keywords,
            "inferred": inferred,
            "contact": contact
        }

        # 3. Gemini Reasoning
        print("Calling Gemini API...")
        gap_report = analyze_placement(resume_text, jd_text, local_data)
        gap_report['localAnalysis'] = local_data

        print("Generating Roadmap...")
        roadmap = generate_sprint(gap_report)

        print("--- PIPELINE SUCCESS ---")
        return jsonify({"gapReport": gap_report, "roadmap": roadmap}), 200

    except Exception as e:
        print("!!! PIPELINE ERROR !!!")
        traceback.print_exc() # This will show you exactly which line failed in your terminal
        return jsonify({"error": str(e)}), 500

# (Keep /api/audit, /api/history, /api/rewrite routes as they were)
@app.route('/api/history', methods=['GET'])
def get_history():
    try:
        # Check if DB is connected
        if audits_collection is None:
            return jsonify([]), 200

        # Fetch data
        raw_data = list(audits_collection.find().sort("createdAt", -1).limit(10))
        
        history_list = []
        for item in raw_data:
            # Safely convert MongoDB ID and Date
            history_list.append({
                "_id": str(item.get('_id')),
                "profileId": str(item.get('profileId', '')),
                "jdText": item.get('jdText', 'No Title'),
                "gapReport": item.get('gapReport', {}),
                "roadmap": item.get('roadmap', []),
                "createdAt": item.get('createdAt').strftime("%b %d, %H:%M") if item.get('createdAt') else "N/A"
            })
        
        return jsonify(history_list), 200 # Always returns a list []
    except Exception as e:
        print(f"DATABASE ERROR: {e}")
        return jsonify([]), 200 # Return empty list on error to prevent frontend crash

@app.route('/api/audit', methods=['POST'])
def save_audit():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data"}), 400

        audit_entry = {
            "profileId": data.get('profileId'),
            "jdText": data.get('jdText'),
            "gapReport": data.get('gapReport'),
            "roadmap": data.get('roadmap'),
            "createdAt": datetime.utcnow()
        }
        audits_collection.insert_one(audit_entry)
        return jsonify({"status": "success"}), 201
    except Exception as e:
        print(f"SAVE ERROR: {e}")
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/audit-video', methods=['POST'])
def audit_video():
    if 'video' not in request.files:
        return jsonify({"error": "No video"}), 400
    
    video = request.files['video']
    p_id = str(uuid.uuid4())
    path = os.path.join(UPLOAD_FOLDER, f"{p_id}.webm")
    video.save(path)

    try:
        model = CommunicationModel(path)
        report = model.get_audit_report()
        return jsonify(report), 200
    except Exception as e:
        print(e)
        return jsonify({"error": str(e)}), 500
# --- SOCKET EVENTS ---
@socketio.on('start_interview')
def handle_start(data):
    emit('ai_message', {"content": "I'm ready to test your skills. Let's begin."})

@socketio.on('user_message')
def handle_message(data):
    # (Existing chat logic)
    response = get_interview_response([], data.get('missingSkills', []), data.get('jdText', ''))
    emit('ai_message', {"content": response})

if __name__ == '__main__':
    # CRITICAL: Use socketio.run, NOT app.run
    print("Server starting on http://localhost:5000...")
    socketio.run(app, debug=True, port=5000)