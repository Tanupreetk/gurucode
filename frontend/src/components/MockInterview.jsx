import React, { useState } from 'react';
import { MessageSquare, Send, Loader2, User, Bot, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { getMockInterviewQuestions, evaluateInterviewAnswer } from '../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';

export default function MockInterview({ resumeText, jdText }) {
  const [messages, setMessages] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);

  const startInterview = async () => {
    setLoading(true);
    try {
      const qs = await getMockInterviewQuestions(resumeText, jdText);
      setQuestions(qs);
      setMessages([{ 
        role: 'bot', 
        content: `Hello! I've analyzed the JD and your resume. Let's start the mock interview. Question 1: ${qs[0]}` 
      }]);
      setStarted(true);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const evaluation = await evaluateInterviewAnswer(questions[currentQuestionIndex], userMsg);
      
      // Update the last user message with the evaluation received from Gemini
      setMessages(prev => prev.map((m, i) => 
        i === prev.length - 1 ? { ...m, evaluation } : m
      ));

      if (currentQuestionIndex < questions.length - 1) {
        const nextIdx = currentQuestionIndex + 1;
        setCurrentQuestionIndex(nextIdx);
        setMessages(prev => [...prev, { 
          role: 'bot', 
          content: `Good effort. Next question: ${questions[nextIdx]}` 
        }]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'bot', 
          content: "That concludes our mock interview! You can review your performance above." 
        }]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 h-[calc(100vh-120px)] flex flex-col">
      <header className="border-b border-black pb-4 mb-6">
        <h2 className="col-header">Agentic Mock Interviewer</h2>
        <p className="text-xs font-mono opacity-60">
          Session ID: {Math.random().toString(36).substring(7).toUpperCase()}
        </p>
      </header>

      {(!resumeText || !jdText) ? (
        <div className="flex-1 flex flex-col items-center justify-center opacity-40 border border-black/10 rounded-lg p-12 text-center">
          <AlertCircle className="w-12 h-12 mb-4" />
          <p className="text-sm font-mono italic">
            Please complete a Resume Audit first to enable the Mock Interviewer.
          </p>
        </div>
      ) : !started ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <div className="p-8 bg-white/40 border border-black/10 rounded-2xl text-center max-w-md">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-bold mb-2">Ready to practice?</h3>
            <p className="text-sm opacity-70 mb-6">
              I'll ask you 5 technical questions based on the role and your background. 
              Each answer will be evaluated in real-time.
            </p>
            <button 
              onClick={startInterview}
              disabled={loading}
              className="px-8 py-3 bg-black text-white font-bold rounded-lg hover:bg-black/80 disabled:opacity-50 flex items-center gap-2 mx-auto"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'START INTERVIEW'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto space-y-6 pr-4 custom-scrollbar">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === 'user' ? 'bg-black text-white' : 'bg-white border border-black'
                  }`}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className="space-y-3 max-w-[80%]">
                    <div className={`p-4 rounded-2xl text-sm ${
                      msg.role === 'user' ? 'bg-black text-white' : 'bg-white border border-black/10 shadow-sm'
                    }`}>
                      {msg.content}
                    </div>
                    {msg.evaluation && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Evaluation</span>
                          <span className="text-xs font-mono font-bold text-emerald-700">{msg.evaluation.score}/10</span>
                        </div>
                        <p className="text-xs text-emerald-900">{msg.evaluation.feedback}</p>
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-emerald-200">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-emerald-600">Key Points Covered</span>
                            <ul className="text-[10px] space-y-1 mt-1">
                              {msg.evaluation.correctPoints.map((p, j) => (
                                <li key={j} className="flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> {p}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase font-bold text-red-600">Missing Points</span>
                            <ul className="text-[10px] space-y-1 mt-1">
                              {msg.evaluation.missingPoints.map((p, j) => (
                                <li key={j} className="flex items-center gap-1 text-red-700">
                                  <XCircle className="w-3 h-3" /> {p}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-white border border-black flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="p-4 bg-white border border-black/10 rounded-2xl">
                    <Loader2 className="w-4 h-4 animate-spin opacity-40" />
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 flex gap-2">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your answer..."
              className="flex-1 p-4 bg-white border border-black rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
              disabled={loading}
            />
            <button 
              type="submit"
              disabled={loading || !input.trim()}
              className="p-4 bg-black text-white rounded-xl hover:bg-black/80 disabled:opacity-50 transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}