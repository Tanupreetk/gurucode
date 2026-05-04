import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, FileText, CheckCircle, AlertCircle, ArrowRight, 
  Loader2, RefreshCcw, Sparkles, Target, Zap, ChevronLeft,
  Clock, History, Send, X, MessageSquare, Video, Mic, StopCircle, Play, VideoOff, Activity, Gauge
} from 'lucide-react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', { 
  transports: ['websocket', 'polling'] 
});

export default function Dashboard({ onAnalysisComplete }) {
  const [resumeFile, setResumeFile] = useState(null);
  const [jdText, setJdText] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [sprint, setSprint] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const [resumeTextState, setResumeTextState] = useState('');
  const [view, setView] = useState('input');
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Mock Interview States
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');

  //Video Auditor States
  const [isRecording, setIsRecording] = useState(false);
  const [videoBlob, setVideoBlob] = useState(null);
  const [commResults, setCommResults] = useState(null);
  const [isCommLoading, setIsCommLoading] = useState(false);
  const mediaRecorderRef = useRef(null); // Add useRef to your react imports
  const streamRef = useRef(null);

  useEffect(() => {
    fetchHistory();

    // Listen for AI interview messages
    socket.on('ai_message', (data) => {
      setMessages(prev => [...prev, { role: 'ai', content: data.content }]);
    });

    return () => socket.off('ai_message');
  }, []);

  const fetchHistory = async () => {
     try {
    const res = await fetch('http://localhost:5000/api/history');
    const data = await res.json();
    setHistory(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error("History error:", err);
    setHistory([]); 
  }
  };

  const handleUpload = async () => {
    if (!resumeFile || !jdText) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('resume', resumeFile);
      const uploadRes = await fetch('http://localhost:5000/api/upload-resume', {
        method: 'POST',
        body: formData,
      });
      const { id, text: resumeText } = await uploadRes.json();
      setProfileId(id);
      setResumeTextState(resumeText);

      const analysisRes = await fetch('http://localhost:5000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText, jdText }),
      });
      const data = await analysisRes.json();
      
      setReport(data.gapReport);
      setSprint(data.roadmap);
      
      await fetch('http://localhost:5000/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: id, jdText, gapReport: data.gapReport, roadmap: data.roadmap }),
      });

      fetchHistory();
      setView('results');
    } catch (error) {
      alert("Error processing request.");
    } finally {
      setLoading(false);
    }
  };

  // --- INTERVIEW HANDLERS ---
  const startInterview = () => {
    setShowChat(true);
    setMessages([]);
    socket.emit('start_interview', { 
      profileId, 
      missingSkills: report?.missingSkills || [], 
      jdText 
    });
  };

  const sendMessage = () => {
    if (!inputMessage.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: inputMessage }]);
    socket.emit('user_message', { 
      profileId, 
      message: inputMessage,
      missingSkills: report?.missingSkills || [],
      jdText 
    });
    setInputMessage('');
  };

  const loadFromHistory = (item) => {
    setProfileId(item.profileId);
    setReport(item.gapReport);
    setSprint(item.roadmap);
    setJdText(item.jdText || '');
    setView('results');
    setShowHistory(false);
  };
const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    streamRef.current = stream;
    mediaRecorderRef.current = new MediaRecorder(stream);
    const chunks = [];
    
    mediaRecorderRef.current.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      setVideoBlob(blob);
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);
  } catch (err) {
    alert("Camera access denied or not found.");
  }
};

const stopRecording = () => {
  if (mediaRecorderRef.current) {
    mediaRecorderRef.current.stop();
    streamRef.current.getTracks().forEach(track => track.stop());
    setIsRecording(false);
  }
};

const handleCommAudit = async () => {
  if (!videoBlob) return;
  setIsCommLoading(true);
  const formData = new FormData();
  formData.append('video', videoBlob);

  try {
    const res = await fetch('http://localhost:5000/api/audit-video', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    setCommResults(data);
  } catch (error) {
    console.error(error);
    alert("Video audit failed. Ensure FFmpeg is installed on backend.");
  } finally {
    setIsCommLoading(false);
  }
};
  // --- CHAT WINDOW COMPONENT ---
  const ChatWindow = () => (
    <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] z-[100] flex flex-col">
      <div className="bg-black text-white p-4 flex justify-between items-center font-bold uppercase italic text-sm">
        <span>Technical Mock Interview</span>
        <button onClick={() => setShowChat(false)}><X size={20}/></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-emerald-50/30">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 text-xs font-bold border-2 border-black ${m.role === 'user' ? 'bg-white' : 'bg-emerald-200'}`}>
              {m.content}
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t-4 border-black flex gap-2">
        <input 
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Answer here..."
          className="flex-1 text-xs font-bold outline-none uppercase p-2"
        />
        <button onClick={sendMessage} className="bg-black text-white p-2 hover:bg-emerald-600 transition-colors"><Send size={18}/></button>
      </div>
    </div>
  );

  // --- VIEWS ---
  const InputView = () => (
    <div className="max-w-2xl mx-auto space-y-8 py-12">
      <div className="text-center space-y-2">
        <h1 className="text-5xl font-black tracking-tighter uppercase italic">Placement Auditor</h1>
        <p className="text-sm font-mono opacity-70 italic text-emerald-600">Hybrid NLP Scorer // Vector Similarity Engine</p>
      </div>

      <div className="bg-white border-2 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-6 text-black">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest">01. Resume (PDF)</label>
          <div 
            className="border-2 border-dashed border-black/20 p-12 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-50 transition-colors"
            onClick={() => document.getElementById('resume-input')?.click()}
          >
            <Upload className="w-10 h-10 mb-2" />
            <span className="text-sm font-bold uppercase">{resumeFile ? resumeFile.name : 'Drop Resume Here'}</span>
            <input id="resume-input" type="file" accept=".pdf" className="hidden" onChange={(e) => setResumeFile(e.target.files?.[0] || null)}/>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest">02. Job Description</label>
          <textarea 
            className="w-full h-40 p-4 border-2 border-black outline-none text-sm font-mono"
            placeholder="Paste JD requirements here..."
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
          />
        </div>

        <button 
          onClick={handleUpload}
          disabled={loading || !resumeFile || !jdText}
          className="w-full py-4 bg-black text-white font-bold text-lg hover:bg-emerald-600 flex items-center justify-center gap-3 transition-colors"
        >
          {loading ? <Loader2 className="animate-spin" /> : <><Zap className="w-5 h-5"/> INITIALIZE AUDIT</>}
        </button>
      </div>
    </div>
  );

  const ResultsView = () => (
    <div className="max-w-6xl mx-auto py-8 space-y-8 text-black">
      <div className="flex justify-between items-end border-b-4 border-black pb-4">
        <div>
          <button onClick={() => setView('input')} className="flex items-center gap-1 text-xs font-bold uppercase opacity-50 hover:opacity-100 mb-2">
            <ChevronLeft className="w-4 h-4" /> Back to Upload
          </button>
          <h2 className="text-4xl font-black uppercase italic">Audit Report</h2>
          <p className="font-mono text-xs opacity-60">ID: {profileId?.split('-')[0]}</p>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold uppercase opacity-50">Local Match Score</div>
          <div className="text-5xl font-black text-emerald-600">
            {report?.localAnalysis?.score || 0}%
          </div>
        </div>
      </div>

      {/* Engineering Trace Card */}
      <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="text-xl font-black uppercase italic mb-4 flex items-center gap-2">
          <Zap className="text-emerald-500 w-5 h-5" /> Engineering Trace (Custom Logic)
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-3 bg-gray-100 border-2 border-black">
            <span className="text-[10px] font-bold block opacity-50 uppercase">Extracted Email</span>
            <p className="text-xs font-mono font-bold">{report?.localAnalysis?.contact?.email || 'Not Found'}</p>
          </div>
          <div className="p-3 bg-gray-100 border-2 border-black">
            <span className="text-[10px] font-bold block opacity-50 uppercase">TF-IDF Keywords</span>
            <p className="text-[10px] font-mono leading-none mt-1 uppercase">
              {report?.localAnalysis?.keywords?.join(', ') || 'N/A'}
            </p>
          </div>
          <div className="p-3 bg-emerald-50 border-2 border-emerald-600">
            <span className="text-[10px] font-bold block uppercase text-emerald-700">Taxonomy Inference</span>
            <p className="text-[10px] font-bold mt-1 uppercase italic">
              Needs: {report?.localAnalysis?.inferred?.join(', ') || 'Optimized'}
            </p>
          </div>
        </div>
      </div>
{/* --- COMMUNICATION AUDITOR SECTION --- */}
<div className="bg-white border-4 border-black p-5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4">
  <div className="flex justify-between items-center">
    <h3 className="text-lg font-black uppercase italic flex items-center gap-2">
      <Video className="text-emerald-500" size={18}/> Video Resume Analysis
    </h3>
    {isRecording && (
      <span className="animate-pulse flex items-center gap-1 text-red-600 font-black text-[10px]">
        <div className="w-2 h-2 bg-red-600 rounded-full" /> LIVE
      </span>
    )}
  </div>

  {!commResults ? (
    <div className="space-y-3">
      {/* Preview Area */}
      <div className="aspect-video bg-gray-100 border-2 border-black relative overflow-hidden flex items-center justify-center">
        {isRecording ? (
          <video autoPlay muted className="absolute inset-0 w-full h-full object-cover"
                 ref={(video) => { if (video) video.srcObject = streamRef.current; }} />
        ) : videoBlob ? (
          <video src={URL.createObjectURL(videoBlob)} controls className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 opacity-30">
            <VideoOff className="w-8 h-8" />
            <span className="text-[10px] font-bold uppercase">No Video</span>
          </div>
        )}
      </div>

      {/* Action Buttons Row */}
      <div className="grid grid-cols-2 gap-2">
        {/* Record / Stop */}
        {!isRecording ? (
          <button onClick={startRecording}
            className="py-2 bg-black text-white text-[11px] font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-1">
            <Video size={13}/> {videoBlob ? "RE-RECORD" : "RECORD"}
          </button>
        ) : (
          <button onClick={stopRecording}
            className="py-2 bg-red-600 text-white text-[11px] font-bold flex items-center justify-center gap-1">
            <StopCircle size={13}/> STOP
          </button>
        )}

        {/* Upload Video */}
        <label className="py-2 bg-white border-2 border-black text-[11px] font-bold hover:bg-gray-100 transition-colors flex items-center justify-center gap-1 cursor-pointer">
          <Upload size={13}/> UPLOAD VIDEO
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const blob = new Blob([file], { type: file.type });
                setVideoBlob(blob);
              }
            }}
          />
        </label>
      </div>

      {/* Analyze Button — only when video is ready */}
      {videoBlob && !isRecording && (
        <button onClick={handleCommAudit} disabled={isCommLoading}
          className="w-full py-2 bg-emerald-500 text-black text-[11px] font-black hover:bg-emerald-400 disabled:opacity-50 flex items-center justify-center gap-1 transition-colors">
          {isCommLoading
            ? <Loader2 size={13} className="animate-spin"/>
            : <><Activity size={13}/> ANALYZE VOICE</>}
        </button>
      )}
    </div>
  ) : (
    <div className="space-y-3 animate-in fade-in duration-500">
      {/* WPM + Fillers */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 bg-emerald-50 border-2 border-black">
          <div className="flex items-center gap-1 text-[9px] font-bold opacity-50 uppercase mb-1">
            <Gauge size={11}/> Pace (WPM)
          </div>
          <div className="text-2xl font-black">{commResults.wpm}</div>
          <div className="text-[9px] font-bold text-emerald-700 uppercase">{commResults.paceFeedback}</div>
        </div>
        <div className="p-3 bg-gray-50 border-2 border-black">
          <div className="flex items-center gap-1 text-[9px] font-bold opacity-50 uppercase mb-1">
            <Activity size={11}/> Fillers
          </div>
          <div className="text-2xl font-black">{commResults.fillerCount}</div>
          <div className="text-[9px] font-bold uppercase opacity-60 italic">"Um, Uh, Like"</div>
        </div>
      </div>

      {/* Transcript */}
      <div className="p-3 bg-black text-white border-2 border-black">
        <div className="text-[9px] font-bold opacity-50 uppercase mb-1">Transcript</div>
        <p className="text-[11px] italic leading-relaxed line-clamp-3">"{commResults.transcript}"</p>
      </div>

      {/* Tone + Confidence */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 border-2 border-black flex flex-col items-center justify-center">
          <span className="text-[9px] font-bold opacity-50 uppercase">Tone</span>
          <span className="font-black uppercase text-emerald-600 text-sm">{commResults.tone}</span>
        </div>
        <div className="p-2 border-2 border-black flex flex-col items-center justify-center">
          <span className="text-[9px] font-bold opacity-50 uppercase">Confidence</span>
          <span className="font-black uppercase text-sm">{commResults.confidenceScore}%</span>
        </div>
      </div>

      <button onClick={() => setCommResults(null)}
        className="w-full py-2 border-2 border-black text-[10px] font-bold uppercase hover:bg-black hover:text-white transition-colors">
        Reset Lab
      </button>
    </div>
  )}
</div>
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-emerald-50 border-2 border-emerald-600 p-6">
              <h3 className="font-bold uppercase text-emerald-800 flex items-center gap-2 mb-4"><CheckCircle className="w-5 h-5" /> Matching</h3>
              <div className="flex flex-wrap gap-2">
                {report?.matchingSkills?.map((s, i) => (
                  <span key={i} className="bg-emerald-200 text-emerald-900 px-2 py-1 text-[10px] font-bold rounded uppercase">{s}</span>
                ))}
              </div>
            </div>
            <div className="bg-red-50 border-2 border-red-600 p-6">
              <h3 className="font-bold uppercase text-red-800 flex items-center gap-2 mb-4"><AlertCircle className="w-5 h-5" /> Missing</h3>
              <div className="flex flex-wrap gap-2">
                {report?.missingSkills?.map((s, i) => (
                  <span key={i} className="bg-red-200 text-red-900 px-2 py-1 text-[10px] font-bold rounded uppercase">{s}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-emerald-600 text-white p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-2xl font-black uppercase italic mb-6 flex items-center gap-2"><Zap className="w-6 h-6" /> 7-Day Sprint Roadmap</h3>
            <div className="grid gap-4">
              {sprint?.map((day) => (
                <div key={day.day} className="bg-white/10 p-4 border-l-4 border-white">
                  <div className="text-[10px] font-mono uppercase opacity-70">Day 0{day.day}</div>
                  <div className="text-sm font-bold uppercase">{day.title}</div>
                  <div className="text-[11px] opacity-80 mt-1 italic">{day.tasks?.join(' • ')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* <div className="space-y-6">
          <div className="bg-black text-white p-6 shadow-[4px_4px_0px_0px_rgba(16,185,129,1)]">
            <h3 className="font-bold uppercase italic mb-2">Practice Session</h3>
            <p className="text-[10px] opacity-70 mb-4 leading-relaxed">
              Targeted mock interview focusing on your identified skill gaps.
            </p>
            <button 
              onClick={startInterview}
              className="w-full py-3 bg-emerald-500 text-black font-black uppercase text-xs hover:bg-emerald-400 transition-colors"
            >
              Start Mock Interview
            </button>
          </div>
        </div> */}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fafafa] text-black px-6">
      <div className="max-w-6xl mx-auto pt-6 flex justify-between items-center">
        <div className="font-black italic text-xl uppercase tracking-tighter">Gurucode.AI</div>
        <button onClick={() => setShowHistory(true)} className="flex items-center gap-2 font-bold uppercase text-xs border-2 border-black px-4 py-2 hover:bg-black hover:text-white transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <History className="w-4 h-4" /> History
        </button>
      </div>

      {showHistory && (
        <div className="fixed right-0 top-0 h-full w-80 bg-white border-l-4 border-black z-[110] p-6 shadow-xl overflow-y-auto">
          <div className="flex justify-between items-center mb-8 border-b-2 border-black pb-2">
            <h3 className="font-black uppercase italic text-xl">History</h3>
            <button onClick={() => setShowHistory(false)}><X /></button>
          </div>
          {(Array.isArray(history) ? history : []).map((item) => (
  <div 
    key={item._id} 
    onClick={() => loadFromHistory(item)} 
    className="p-4 border-2 border-black mb-4 hover:bg-emerald-50 cursor-pointer"
  >
    <div className="text-[10px] font-mono opacity-50 mb-1">{item.createdAt}</div>
    <div className="font-bold text-xs uppercase truncate">{item.jdText?.substring(0, 30)}...</div>
  </div>
))}
        </div>
      )}

      {showChat && <ChatWindow />}
      {view === 'input' ? <InputView /> : <ResultsView />}
    </div>
  );
}