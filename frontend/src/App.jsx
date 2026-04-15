import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
// import MockInterview from './components/MockInterview';
// import History from './components/History';
import { LayoutDashboard, MessageSquare, History as HistoryIcon } from 'lucide-react';

export default function App() {
  // Removed the TypeScript Union type definition
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Shared state for interview
  const [resumeText, setResumeText] = useState('');
  const [jdText, setJdText] = useState('');

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 overflow-y-auto pb-24">
        {activeTab === 'dashboard' && (
          <Dashboard 
            onAnalysisComplete={(resume, jd) => {
              setResumeText(resume);
              setJdText(jd);
            }} 
          />
        )}
        {/* {activeTab === 'interview' && (
          <MockInterview resumeText={resumeText} jdText={jdText} />
        )} */}
        {activeTab === 'history' && <History />}
      </main>

      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 glass-card rounded-full px-6 py-3 flex items-center gap-8 shadow-2xl z-50">
        {/* <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'dashboard' ? 'text-black' : 'text-black/40 hover:text-black/60'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Audit</span>
        </button> */}
        
        {/* <button 
          onClick={() => setActiveTab('interview')}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'interview' ? 'text-black' : 'text-black/40 hover:text-black/60'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Mock</span>
        </button> */}
        
        {/* <button 
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'history' ? 'text-black' : 'text-black/40 hover:text-black/60'
          }`}
        >
          <HistoryIcon className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">History</span>
        </button> */}
      </nav>
    </div>
  );
}