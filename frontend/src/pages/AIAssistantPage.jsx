import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Bot,
  Send,
  Sparkles,
  Shield,
  Languages,
  CheckCircle,
  RefreshCw,
  Terminal,
  HelpCircle
} from 'lucide-react';

export default function AIAssistantPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: `Hello ${user ? user.email.split('@')[0] : ''}! I am your HCM Lite AI Assistant. Every response is strictly scoped to your role (${user?.role}) and fetched directly from real company database records.

Try asking:
• "Who is on leave today?"
• "How many active employees are in the company?"
• "Who came late most often this month?"
• "How many sick leaves do I have left?" (or "Meri chutti kitni bachi hai?")
• "What is my colleague's salary?" (Protected by RBAC!)
• "What are the office start and grace rules?"`,
      tool: null,
      isAiGenerated: true
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    setInput('');
    setMessages(prev => [...prev, { sender: 'user', text: query }]);
    setLoading(true);

    try {
      const res = await api.chatAI(query);
      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: res.response,
          tool: res.toolCalled,
          isAiGenerated: true
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: `⚠️ Request failed: ${err.message}`,
          tool: null,
          isAiGenerated: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sampleQuestions = [
    'How many active employees are in the company?',
    'Who is on leave today?',
    'Who came late most often this month?',
    'What is my colleague\'s salary?',
    'Meri sick leave kitni bachi hai?',
    'Office start timing and grace rules'
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-linear-to-r from-indigo-900 via-purple-900 to-indigo-950 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20">
              Module 8: AI Assistant
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/30 flex items-center gap-1">
              <Languages className="w-3.5 h-3.5" /> Roman Urdu Supported
            </span>
          </div>
          <h2 className="text-2xl font-black">
            Intelligent HR Copilot
          </h2>
          <p className="text-xs text-indigo-200">
            Backed by deterministic tool calling, zero hallucination database guardrails, and role scoping ({user?.role})
          </p>
        </div>

        <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 text-xs space-y-1">
          <span className="font-bold flex items-center gap-1.5 text-indigo-300">
            <Shield className="w-3.5 h-3.5" />
            <span>Strict Role Guardrails</span>
          </span>
          <p className="text-[11px] text-white/80">
            Employees can never query colleague salaries. AI answers strictly from database tools.
          </p>
        </div>
      </div>

      {/* Main Chat Box */}
      <div className="gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs flex flex-col h-[520px]">
        {/* Messages scroll */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/40 dark:bg-slate-950/20">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-3xl p-4 text-xs leading-relaxed shadow-xs ${
                  m.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 rounded-bl-xs'
                }`}
              >
                <p className="whitespace-pre-line">{m.text}</p>

                {m.tool && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/50 flex items-center gap-1.5 text-[11px] text-indigo-500 font-semibold font-mono">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Tool Called: {m.tool}()</span>
                  </div>
                )}
              </div>

              {m.isAiGenerated && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 px-2">
                  AI-generated • Database verified
                </span>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-fit">
              <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />
              <span className="text-xs text-slate-500">Executing database service tool...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        <div className="px-4 py-2 bg-slate-100/60 dark:bg-slate-800/40 border-t border-slate-200/50 dark:border-slate-800 flex gap-2 overflow-x-auto no-scrollbar">
          {sampleQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="text-xs whitespace-nowrap bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question in English or Roman Urdu..."
            className="flex-1 text-xs px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-2xl transition-colors cursor-pointer shadow-md shadow-indigo-600/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
