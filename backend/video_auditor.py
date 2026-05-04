import whisper
import librosa
import numpy as np
import re
from moviepy import VideoFileClip
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import os
import warnings

# Suppress unnecessary warnings
warnings.filterwarnings("ignore")

# Load the "Tiny" Whisper model
# We use tiny for speed. 'fp16=False' ensures it works on CPUs without a dedicated GPU.
print("--- Loading Local AI Models (Whisper & VADER) ---")
asr_model = whisper.load_model("tiny")
sentiment_model = SentimentIntensityAnalyzer()

FILLER_WORDS = ["um", "uh", "like", "actually", "basically", "you know", "so", "mean"]

class CommunicationModel:
    def __init__(self, video_path):
        self.video_path = video_path
        # Use .wav as it's more stable for Librosa analysis
        self.audio_path = video_path.replace(".webm", ".wav").replace(".mp4", ".wav")
        self.text = ""
        self.duration = 0

    def extract_audio(self):
        """Extracts audio stream from video using MoviePy"""
        print(f"Step 1: Extracting audio from {self.video_path}...")
        try:
            clip = VideoFileClip(self.video_path)
            self.duration = clip.duration
            
            # Check if clip has audio
            if clip.audio is None:
                raise Exception("The uploaded video has no audio track.")

            # Simplified for MoviePy 2.0 compatibility
            clip.audio.write_audiofile(self.audio_path)
            clip.close()
            print(f"Success: Audio extracted. Duration: {self.duration}s")
        except Exception as e:
            print(f"Error in Audio Extraction: {e}")
            raise e

    def analyze_audio_signals(self):
        """Calculates Energy (Volume) and Confidence using Librosa"""
        print("Step 2: Analyzing audio signals (Energy & Pitch)...")
        try:
            y, sr = librosa.load(self.audio_path)
            
            if len(y) == 0:
                return 0, 0

            # Calculate RMS Energy (Loudness)
            rms = librosa.feature.rms(y=y)[0]
            avg_energy = np.mean(rms)
            energy_std = np.std(rms) 

            # Confidence Logic: 
            # If the speaker has a steady volume (low std) but decent energy, they sound confident.
            # We normalize this to a 0-100 scale.
            confidence_score = 100 - (energy_std * 500) 
            confidence_score = max(min(confidence_score, 100), 0) # Keep between 0-100

            return round(float(avg_energy) * 1000, 2), round(float(confidence_score), 1)
        except Exception as e:
            print(f"Error in Signal Analysis: {e}")
            return 0, 0

    def analyze_linguistics(self):
        """Transcribes speech to text and analyzes word patterns"""
        print("Step 3: Transcribing Speech to Text (this may take a moment)...")
        try:
            # fp16=False is crucial for running on most laptops without high-end GPUs
            result = asr_model.transcribe(self.audio_path, fp16=False)
            self.text = result.get('text', "").strip()
            
            if not self.text:
                print("Warning: No speech detected in audio.")
                return 0, 0, 0

            print(f"Transcript: {self.text}")

            # Count Filler Words
            filler_count = 0
            found_fillers = []
            for word in FILLER_WORDS:
                matches = re.findall(r'\b' + word + r'\b', self.text.lower())
                filler_count += len(matches)
                if matches:
                    found_fillers.append(word)

            # Calculate Words Per Minute (WPM)
            words = len(self.text.split())
            wpm = (words / self.duration) * 60 if self.duration > 0 else 0

            # Sentiment (Tone)
            sent = sentiment_model.polarity_scores(self.text)

            return round(wpm, 1), filler_count, sent['compound']
        except Exception as e:
            print(f"Error in Transcription: {e}")
            return 0, 0, 0

    def get_audit_report(self):
        """Orchestrates the entire audit process"""
        try:
            self.extract_audio()
            
            if not os.path.exists(self.audio_path):
                return {"error": "Audio file generation failed"}

            energy, confidence = self.analyze_audio_signals()
            wpm, fillers, tone = self.analyze_linguistics()
            
            # Final Clean-up: Delete the temporary wav file
            if os.path.exists(self.audio_path):
                os.remove(self.audio_path)

            return {
                "transcript": self.text if self.text else "No speech detected.",
                "wpm": wpm,
                "fillerCount": fillers,
                "confidenceScore": confidence,
                "energyLevel": energy,
                "tone": "Positive" if tone > 0.1 else "Neutral" if tone > -0.1 else "Negative",
                "paceFeedback": "Great" if 110 < wpm < 160 else "Too Fast" if wpm >= 160 else "Too Slow"
            }
        except Exception as e:
            return {"error": str(e)}