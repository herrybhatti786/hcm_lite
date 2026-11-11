import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { animateModalOpen } from '../animations/gsapUtils';
import {
  Bot,
  X,
  Send,
  Sparkles,
  ShieldAlert,
  Calendar,
  Languages,
  Check,
  RefreshCw,
  Clock
} from 'lucide-react';

export default function AIAssistantWidget({ isOpen, onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: `Hello ${user ? user.email.split('@')[0] : ''}! I am your HCM Lite AI Assistant. You can ask me questions about attendance, department headcount, leave balances, who came late, HR policies, or speak to me in Roman Urdu. How can I help?`,
      tool: null,
      isAiGenerated: true
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const modalRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      animateModalOpen(modalRef.current);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!isOpen) return null;

  const handleSend = async (messageText) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || loading) return;

    setInput('');
    setMessages(prev => [...prev, { sender: 'user', text: textToSend }]);
    setLoading(true);

    try {
      const res = await api.chatAI(textToSend);
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
          text: `⚠️ Request failed: ${err.message}. Please check your connection.`,
          tool: null,
          isAiGenerated: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = user?.role === 'Employee' ? [
    'How many sick leaves do I have left this year?',
    'What is my colleague\'s salary?',
    'Meri kitni chutti bachi hai?',
    'What is the office start and grace timing?',
    'I need next Monday and Tuesday off for my sister\'s wedding'
  ] : [
    'How many active employees are in the company?',
    'Who is on leave today?',
    'Who came late most often this month?',
    'What is this month\'s attendance summary?',
    'Office start timings and late penalty rules'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end p-4 sm:p-6 bg-black/40 backdrop-blur-xs pointer-events-auto">
      <div
        ref={modalRef}
        className="w-full sm:w-[450px] h-[600px] max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 bg-linear-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm">HCM Lite AI Assistant</h3>
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-medium">
                  {user?.role} Scope
                </span>
              </div>
              <p className="text-[11px] text-white/80 flex items-center gap-1">
                <Languages className="w-3 h-3" /> Supports English & Roman Urdu
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50 dark:bg-slate-950/30">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-xs ${
                  m.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 rounded-bl-xs'
                }`}
              >
                <p className="whitespace-pre-line">{m.text}</p>

                {m.tool && (
                  <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-700/50 flex items-center gap-1.5 text-[10px] text-indigo-500 font-medium">
                    <Sparkles className="w-3 h-3" />
                    <span>Executed tool: {m.tool}</span>
                  </div>
                )}
              </div>

              {m.isAiGenerated && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 px-1">
                  AI-generated • Database verified
                </span>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-fit">
              <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
              <span className="text-xs text-slate-500">Querying HCM Lite database tools...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompt suggestions */}
        <div className="px-3 py-2 bg-slate-100/70 dark:bg-slate-800/40 border-t border-slate-200/50 dark:border-slate-800 flex gap-1.5 overflow-x-auto no-scrollbar">
          {quickPrompts.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="text-[11px] whitespace-nowrap bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Chat input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={user?.role === 'Employee' ? 'Ask about your leaves, attendance, or policy...' : 'Ask about headcount, late comers, payroll...'}
            className="flex-1 text-xs px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl transition-colors cursor-pointer shadow-md shadow-indigo-600/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
