from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import uuid
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
from bson import ObjectId

# Import the logic functions from your utils.py
from utils import extract_text_from_pdf, analyze_placement, generate_sprint,rewrite_resume_star

# 1. Setup Environment and App
load_dotenv()
app = Flask(__name__)
CORS(app)  # This allows your React app to talk to this server

# 2. Folder for uploaded PDFs
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# 3. MongoDB Connection
# It will try to use the .env URI, otherwise it defaults to local MongoDB
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URI)
db = client['placement_auditor']
audits_collection = db['audits']

# --- ROUTES ---

@app.route('/api/upload-resume', methods=['POST'])
def upload_resume():
    """Step 1: Receive PDF, save it, and extract text."""
    if 'resume' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['resume']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # Generate a unique filename and ID
    profile_id = str(uuid.uuid4())
    filename = f"{profile_id}_{file.filename}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    
    try:
        file.save(filepath)
        # Use our utility to get text
        resume_text = extract_text_from_pdf(filepath)
        
        return jsonify({
            "id": profile_id,
            "text": resume_text
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/analyze', methods=['POST'])
def analyze_resume_vs_jd():
    """Step 2: Take Resume + JD text and run Gemini AI analysis."""
    data = request.json
    resume_text = data.get('resumeText')
    jd_text = data.get('jdText')

    if not resume_text or not jd_text:
        return jsonify({"error": "Missing resume or job description text"}), 400

    try:
        # Run Gap Analysis
        gap_report = analyze_placement(resume_text, jd_text)
        
        # Run Roadmap Generation
        roadmap = generate_sprint(gap_report)

        return jsonify({
            "gapReport": gap_report,
            "roadmap": roadmap
        }), 200
    except Exception as e:
        print(f"Analysis failed: {e}")
        return jsonify({"error": "AI Analysis failed"}), 500

@app.route('/api/audit', methods=['POST'])
def save_audit():
    """Step 3: Save the final results to MongoDB."""
    try:
        data = request.json
        audit_entry = {
            "profileId": data.get('profileId'),
            "jdText": data.get('jdText'),
            "gapReport": data.get('gapReport'),
            "roadmap": data.get('roadmap'),
            "createdAt": datetime.utcnow()
        }
        
        result = audits_collection.insert_one(audit_entry)
        return jsonify({
            "status": "success", 
            "db_id": str(result.inserted_id)
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route('/api/rewrite', methods=['POST'])
def rewrite_resume():
    data = request.json
    resume_text = data.get('resumeText')
    jd_text = data.get('jdText')

    if not resume_text or not jd_text:
        return jsonify({"error": "Missing data"}), 400

    try:
        rewritten_content = rewrite_resume_star(resume_text, jd_text)
        return jsonify(rewritten_content), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route('/api/history', methods=['GET'])
def get_history():
    """Fetch the last 10 audits from MongoDB."""
    try:
        # Find all audits, sort by newest first, limit to 10
        history = list(audits_collection.find().sort("createdAt", -1).limit(10))
        
        # Convert MongoDB ObjectIds to strings so JSON can handle them
        for item in history:
            item['_id'] = str(item['_id'])
            # Ensure dates are strings
            if 'createdAt' in item:
                item['createdAt'] = item['createdAt'].strftime("%b %d, %Y %H:%M")
        
        return jsonify(history), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
if __name__ == '__main__':
    print("Server starting on http://localhost:5000...")
    app.run(debug=True, port=5000)