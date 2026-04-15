import React, { useState, useEffect } from 'react';
import { 
  Upload, FileText, CheckCircle, AlertCircle, ArrowRight, 
  Loader2, RefreshCcw, Sparkles, Target, Zap, ChevronLeft,
  Clock, History
} from 'lucide-react';

export default function Dashboard({ onAnalysisComplete }) {
  const [resumeFile, setResumeFile] = useState(null);
  const [jdText, setJdText] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [sprint, setSprint] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const [rewrittenContent, setRewrittenContent] = useState(null);
  const [isRewriting, setIsRewriting] = useState(false);
  const [resumeTextState, setResumeTextState] = useState('');
  const [view, setView] = useState('input');
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/history');
      const data = await res.json();
      setHistory(data);
    } catch (err) { console.error(err); }
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
      const { gapReport, roadmap } = await analysisRes.json();
      
      setReport(gapReport);
      setSprint(roadmap);
      
      await fetch('http://localhost:5000/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: id, jdText, gapReport, roadmap }),
      });

      fetchHistory();
      setView('results');
    } catch (error) {
      alert("Error processing request.");
    } finally {
      setLoading(false);
    }
  };

  const loadFromHistory = (item) => {
    setProfileId(item.profileId);
    setReport(item.gapReport);
    setSprint(item.roadmap);
    setJdText(item.jdText || '');
    setView('results');
    setShowHistory(false);
  };

  const handleRewrite = async () => {
    setIsRewriting(true);
    try {
      const res = await fetch('http://localhost:5000/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText: resumeTextState, jdText }),
      });
      const data = await res.json();
      setRewrittenContent(data);
    } catch (error) { console.error(error); }
    finally { setIsRewriting(false); }
  };

  // --- STATIC INPUT VIEW ---
  const InputView = () => (
    <div className="max-w-2xl mx-auto space-y-8 py-12">
      <div className="text-center space-y-2">
        <h1 className="text-5xl font-black tracking-tighter uppercase italic">Placement Auditor</h1>
        <p className="text-sm font-mono opacity-70">Upload your resume and paste the job description to get started</p>
      </div>

      <div className="bg-white border-2 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-6">
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

  // --- STATIC RESULTS VIEW ---
  const ResultsView = () => (
    <div className="max-w-6xl mx-auto py-8 space-y-8">
      <div className="flex justify-between items-end border-b-4 border-black pb-4">
        <div>
          <button onClick={() => setView('input')} className="flex items-center gap-1 text-xs font-bold uppercase opacity-50 hover:opacity-100 mb-2">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <h2 className="text-4xl font-black uppercase italic">Audit Report</h2>
          <p className="font-mono text-xs opacity-60">ID: {profileId?.split('-')[0]}</p>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold uppercase opacity-50">Match Strength</div>
          <div className="text-5xl font-black text-emerald-600">84%</div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-emerald-50 border-2 border-emerald-600 p-6">
              <h3 className="font-bold uppercase text-emerald-800 flex items-center gap-2 mb-4"><CheckCircle className="w-5 h-5" /> Matching</h3>
              <div className="flex flex-wrap gap-2">
                {report.matchingSkills.map((s, i) => <span key={i} className="bg-emerald-200 text-emerald-900 px-2 py-1 text-xs font-bold rounded">{s}</span>)}
              </div>
            </div>
            <div className="bg-red-50 border-2 border-red-600 p-6">
              <h3 className="font-bold uppercase text-red-800 flex items-center gap-2 mb-4"><AlertCircle className="w-5 h-5" /> Missing</h3>
              <div className="flex flex-wrap gap-2">
                {report.missingSkills.map((s, i) => <span key={i} className="bg-red-200 text-red-900 px-2 py-1 text-xs font-bold rounded">{s}</span>)}
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-black p-6">
            <h3 className="font-bold uppercase flex items-center gap-2 mb-4"><Target className="w-5 h-5"/> Gaps</h3>
            <ul className="space-y-3">
              {report.contextualGaps.map((g, i) => (
                <li key={i} className="text-sm italic border-b border-black/5 pb-2">0{i+1}. {g}</li>
              ))}
            </ul>
          </div>

          <div className="bg-black text-white p-8 rounded-xl">
             <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="w-6 h-6 text-emerald-400" /> STAR Lab</h3>
              <button onClick={handleRewrite} disabled={isRewriting} className="px-6 py-2 bg-emerald-500 text-black font-bold rounded-full disabled:opacity-50">
                {isRewriting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'REWRITE BULLETS'}
              </button>
            </div>
            {rewrittenContent?.roles.map((role, i) => (
              <div key={i} className="bg-white/10 p-4 rounded-lg mb-4">
                <h4 className="text-emerald-400 font-bold uppercase text-xs mb-2">{role.title}</h4>
                {role.rewrittenPoints.map((p, j) => <p key={j} className="text-sm italic mb-2 border-l border-emerald-500/50 pl-3">"{p}"</p>)}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-emerald-600 text-white p-6 h-fit shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="text-xl font-black uppercase italic mb-4 flex items-center gap-2"><Zap className="w-5 h-5" /> Sprint</h3>
          {sprint.map((day) => (
            <div key={day.day} className="mb-6 last:mb-0">
              <div className="text-[10px] font-mono opacity-70">DAY 0{day.day}</div>
              <div className="text-sm font-bold uppercase mb-2">{day.title}</div>
              {day.tasks.map((t, i) => <div key={i} className="text-[11px] opacity-90 mb-1 flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-0.5"/> {t}</div>)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fafafa] text-black px-6">
      <div className="max-w-6xl mx-auto pt-6 flex justify-between items-center">
        <div className="font-black italic text-xl uppercase tracking-tighter">Gurucode</div>
        <button onClick={() => setShowHistory(true)} className="flex items-center gap-2 font-bold uppercase text-xs border-2 border-black px-4 py-2 hover:bg-black hover:text-white transition-colors">
          <History className="w-4 h-4" /> History
        </button>
      </div>

      {/* History Sidebar - Still using simple layout for zero-lag */}
      {showHistory && (
        <div className="fixed right-0 top-0 h-full w-80 bg-white border-l-4 border-black z-50 p-6 shadow-xl overflow-y-auto">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-black uppercase italic text-xl">History</h3>
            <button onClick={() => setShowHistory(false)} className="text-xs font-bold border-2 border-black px-2 py-1">CLOSE</button>
          </div>
          {history.map((item) => (
            <div key={item._id} onClick={() => loadFromHistory(item)} className="p-4 border-2 border-black mb-4 hover:bg-emerald-50 cursor-pointer">
              <div className="text-[10px] font-mono opacity-50 mb-1">{item.createdAt}</div>
              <div className="font-bold text-xs uppercase truncate">{item.jdText?.substring(0, 30)}...</div>
            </div>
          ))}
        </div>
      )}

      {view === 'input' ? <InputView /> : <ResultsView />}
    </div>
  );
}