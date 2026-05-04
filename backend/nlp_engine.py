import re
import spacy
import subprocess
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from collections import defaultdict

# --- Model Loading ---
def load_spacy_model(model_name="en_core_web_sm"):
    try:
        return spacy.load(model_name)
    except OSError:
        subprocess.run(["python", "-m", "spacy", "download", model_name], check=True)
        return spacy.load(model_name)

nlp = load_spacy_model()

# --- Skill Aliases (normalize variants to canonical name) ---
SKILL_ALIASES = {
    "js": "javascript",
    "nodejs": "node.js",
    "node": "node.js",
    "ts": "typescript",
    "py": "python",
    "ml": "machine learning",
    "dl": "deep learning",
    "nlp": "natural language processing",
    "cv": "computer vision",
    "k8s": "kubernetes",
    "tf": "tensorflow",
    "scikit": "scikit-learn",
    "sklearn": "scikit-learn",
    "postgres": "postgresql",
}

# --- Expanded Skill Graph ---
SKILL_GRAPH = {
    "python": ["pandas", "numpy", "flask", "fastapi", "django", "scikit-learn", "pytest"],
    "javascript": ["node.js", "react", "vue", "typescript", "webpack", "jest"],
    "react": ["redux", "context api", "tailwind", "next.js", "typescript", "react query"],
    "machine learning": ["scikit-learn", "tensorflow", "pytorch", "pandas", "numpy", "mlops"],
    "data science": ["machine learning", "statistics", "sql", "matplotlib", "seaborn", "jupyter"],
    "backend": ["sql", "api design", "docker", "authentication", "redis", "message queues"],
    "devops": ["docker", "kubernetes", "ci/cd", "terraform", "aws", "linux"],
    "sql": ["postgresql", "mysql", "query optimization", "indexing"],
    "typescript": ["javascript", "react", "node.js", "angular"],
}

# --- Resume Section Headers ---
SECTION_HEADERS = {
    "skills": r"(skills|technical skills|core competencies|technologies)",
    "experience": r"(experience|work history|employment|projects)",
    "education": r"(education|qualifications|academic)",
}

# --- Skill Normalizer (internal helper) ---
class _SkillNormalizer:
    @staticmethod
    def normalize(skill: str) -> str:
        cleaned = skill.strip().lower()
        return SKILL_ALIASES.get(cleaned, cleaned)

    @staticmethod
    def normalize_list(skills: list) -> list:
        seen = set()
        result = []
        for s in skills:
            norm = _SkillNormalizer.normalize(s)
            if norm not in seen:
                seen.add(norm)
                result.append(norm)
        return result


class CustomParser:
    def __init__(self, text: str):
        if not isinstance(text, str):
            raise TypeError("Input must be a string.")
        self.raw_text = text
        self.text = text.lower()
        self.doc = nlp(self.text)

    # --- Contact Info ---
    def extract_contact_info(self) -> dict:
        email_pattern = r'[a-z0-9.\-+_]+@[a-z0-9.\-+_]+\.[a-z]+'
        phone_pattern = r'(\+?\d[\d\s\-().]{7,}\d)'
        emails = re.findall(email_pattern, self.text)
        phones = re.findall(phone_pattern, self.text)
        return {
            "email": emails[0] if emails else None,
            "phone": phones[0].strip() if phones else None,
        }

    # --- Section Splitter ---
    def extract_sections(self) -> dict:
        """Split resume into labeled sections (skills, experience, education, general)."""
        sections = defaultdict(str)
        current_section = "general"
        for line in self.raw_text.splitlines():
            matched = False
            for section_name, pattern in SECTION_HEADERS.items():
                if re.search(pattern, line, re.IGNORECASE):
                    current_section = section_name
                    matched = True
                    break
            if not matched:
                sections[current_section] += " " + line
        return dict(sections)

    # --- Skill Extraction ---
    def extract_skills(self, skill_list: list) -> dict:
        """
        Extract and normalize skills per resume section.
        Returns:
            {
                "skills": [...],      # found in Skills section
                "experience": [...],  # found in Experience section
                "all": [...]          # deduplicated union of all sections
            }
        """
        sections = self.extract_sections()
        result = {}
        all_found = set()

        for section, content in sections.items():
            found = []
            for skill in skill_list:
                norm_skill = _SkillNormalizer.normalize(skill)
                pattern = r'\b' + re.escape(norm_skill) + r'\b'
                if re.search(pattern, content.lower()):
                    found.append(norm_skill)
                    all_found.add(norm_skill)
            if found:
                result[section] = found

        result["all"] = list(all_found)
        return result

    # --- Missing Skills from JD ---
    def get_missing_skills(self, resume_skills: list, jd_skills: list) -> dict:
        """
        Direct JD vs resume gap analysis.
        Returns matched, missing, and extra skills with a coverage score.
        """
        resume_set = set(_SkillNormalizer.normalize_list(resume_skills))
        jd_set = set(_SkillNormalizer.normalize_list(jd_skills))
        matched = sorted(resume_set & jd_set)
        missing = sorted(jd_set - resume_set)
        extra = sorted(resume_set - jd_set)
        score = round(len(matched) / len(jd_set) * 100, 2) if jd_set else 0.0
        return {
            "matched": matched,
            "missing": missing,
            "extra_in_resume": extra,
            "match_score_percent": score
        }

    # --- Graph-based Suggestions ---
    def infer_missing_related_skills(self, found_skills: list) -> list:
        """Suggest related skills from SKILL_GRAPH not already in resume."""
        found_set = set(_SkillNormalizer.normalize_list(found_skills))
        suggestions = set()
        for skill in found_set:
            for related in SKILL_GRAPH.get(skill, []):
                norm = _SkillNormalizer.normalize(related)
                if norm not in found_set:
                    suggestions.add(norm)
        return sorted(suggestions)

    # --- Years of Experience Heuristic ---
    def extract_years_of_experience(self) -> int:
        """Estimate experience by scanning year mentions in resume text."""
        years = re.findall(r'\b(19|20)\d{2}\b', self.text)
        unique_years = set(int(y) for y in years)
        if len(unique_years) >= 2:
            return max(unique_years) - min(unique_years)
        return 0


# --- TF-IDF Similarity Scorer ---
# Vectorizer kept at module level — created once, reused across calls
_vectorizer = TfidfVectorizer(
    stop_words='english',
    max_features=100,
    ngram_range=(1, 2)  # captures "machine learning", "data science" as single tokens
)

def get_local_score(resume_text: str, jd_text: str) -> tuple:
    """
    Returns (similarity_score_percent, top_keywords).
    Uses TF-IDF cosine similarity with bigram support.
    """
    if not resume_text or not jd_text:
        return 0.0, []
    try:
        tfidf_matrix = _vectorizer.fit_transform([resume_text, jd_text])
        feature_names = _vectorizer.get_feature_names_out()
        jd_vector = tfidf_matrix.toarray()[1]
        top_keywords = [feature_names[i] for i in jd_vector.argsort()[-10:][::-1]]
        similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
        return round(float(similarity) * 100), top_keywords
    except Exception as e:
        print(f"[get_local_score] Error: {e}")
        return 0.0, []