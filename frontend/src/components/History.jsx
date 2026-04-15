import React, { useState, useEffect } from 'react';
import { History as HistoryIcon, Calendar, ArrowRight, ChevronRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAudit, setSelectedAudit] = useState(null);

  useEffect(() => {
    // Note: Ensure your backend endpoint is correctly set up for this fetch
    fetch('/api/history/anonymous@example.com')
      .then(res => res.json())
      .then(data => {
        setHistory(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin opacity-20" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <header className="border-b border-black pb-4">
        <h2 className="col-header">Audit History</h2>
        <p className="text-xs font-mono opacity-60">Past comparisons and roadmaps</p>
      </header>

      {history.length === 0 ? (
        <div className="text-center opacity-40 py-20">
          <HistoryIcon className="w-12 h-12 mx-auto mb-4" />
          <p className="font-mono italic">No audits found yet.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {history.map((audit) => (
            <div 
              key={audit.id}
              className="glass-card p-4 hover:bg-white/60 transition-colors cursor-pointer group"
              onClick={() => setSelectedAudit(audit)}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded bg-black/5 flex items-center justify-center">
                    <Calendar className="w-5 h-5 opacity-40" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold truncate max-w-md">
                      {audit.jd_text.substring(0, 60)}...
                    </h3>
                    <p className="text-[10px] font-mono opacity-50">
                      {new Date(audit.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 opacity-20 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selectedAudit && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
            onClick={() => setSelectedAudit(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#E4E3E0] border border-black w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8 rounded-2xl space-y-8"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-start">
                <h2 className="text-2xl font-serif italic font-bold">Audit Details</h2>
                <button 
                  onClick={() => setSelectedAudit(null)} 
                  className="text-xs font-mono uppercase hover:underline"
                >
                  Close
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="col-header">Job Description</h3>
                    <div className="p-4 bg-white/40 border border-black/10 rounded-lg text-xs h-40 overflow-y-auto whitespace-pre-wrap">
                      {selectedAudit.jd_text}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="col-header">Gap Report</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold uppercase text-emerald-700">Matching</span>
                        {selectedAudit.gap_report.matchingSkills.map((s, i) => (
                          <div key={i} className="text-[10px] border-l border-emerald-500 pl-2">{s}</div>
                        ))}
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold uppercase text-red-700">Missing</span>
                        {selectedAudit.gap_report.missingSkills.map((s, i) => (
                          <div key={i} className="text-[10px] border-l border-red-500 pl-2">{s}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="col-header">7-Day Sprint</h3>
                  <div className="space-y-3">
                    {selectedAudit.roadmap.map((day) => (
                      <div key={day.day} className="border-b border-black/5 pb-2 last:border-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[9px] font-mono bg-black text-white px-1.5 py-0.5 rounded">
                            D{day.day}
                          </span>
                          <span className="text-[11px] font-bold">{day.title}</span>
                        </div>
                        <ul className="space-y-0.5">
                          {day.tasks.map((t, i) => (
                            <li key={i} className="text-[10px] flex items-start gap-1">
                              <ArrowRight className="w-2 h-2 mt-1 shrink-0" />
                              <span>{t}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}