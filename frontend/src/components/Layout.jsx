import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import AIAssistantWidget from './AIAssistantWidget';
import ChangePasswordModal from './ChangePasswordModal';
import { useAuth } from '../context/AuthContext';
import { animateCardStagger } from '../animations/gsapUtils';
import { Sparkles } from 'lucide-react';

export default function Layout({ currentTab, setCurrentTab, children }) {
  const { user } = useAuth();
  const [aiWidgetOpen, setAiWidgetOpen] = useState(false);

  // Trigger GSAP cards animation whenever current tab changes
  useEffect(() => {
    const timer = setTimeout(() => {
      animateCardStagger('.dashboard-content', '.gsap-card');
    }, 50);
    return () => clearTimeout(timer);
  }, [currentTab]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Navbar onOpenAIWidget={() => setAiWidgetOpen(true)} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 dashboard-content">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>

      {/* Floating AI Assistant Trigger Button */}
      <button
        onClick={() => setAiWidgetOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-linear-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white font-bold text-xs shadow-2xl shadow-indigo-600/40 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
      >
        <Sparkles className="w-4 h-4 animate-spin-slow group-hover:rotate-12 transition-transform" />
        <span className="hidden sm:inline">HCM AI Assistant</span>
        <span className="sm:hidden">AI</span>
      </button>

      {/* AI Assistant Modal */}
      <AIAssistantWidget isOpen={aiWidgetOpen} onClose={() => setAiWidgetOpen(false)} />

      {/* Mandatory Password Change Modal for new employees */}
      <ChangePasswordModal isOpen={!!user?.must_change_password} />
    </div>
  );
}
