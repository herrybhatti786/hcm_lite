import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import FirstRunSetup from './pages/FirstRunSetup';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import HRDashboard from './pages/HRDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import OrganizationPage from './pages/OrganizationPage';
import EmployeesPage from './pages/EmployeesPage';
import AttendancePage from './pages/AttendancePage';
import LeavePage from './pages/LeavePage';
import PayrollPage from './pages/PayrollPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import AuditLogPage from './pages/AuditLogPage';
import AIAssistantPage from './pages/AIAssistantPage';
import { RefreshCw } from 'lucide-react';

export default function App() {
  const { user, isInitialized, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [smartLeavePrefill, setSmartLeavePrefill] = useState(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
          <span className="text-xs font-semibold text-slate-400">Loading HCM Lite...</span>
        </div>
      </div>
    );
  }

  // 1. If not initialized, show First Run Setup Wizard
  if (!isInitialized) {
    return <FirstRunSetup />;
  }

  // 2. If not logged in, show Login Screen
  if (!user) {
    return <Login />;
  }

  // Helper when employee triggers smart leave from Dashboard
  const handleNavigateToLeave = (parsedData) => {
    setSmartLeavePrefill(parsedData);
    setCurrentTab('leave');
  };

  // Render current active tab
  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        if (user.role === 'Admin') return <AdminDashboard />;
        if (user.role === 'HR') return <HRDashboard />;
        return <EmployeeDashboard onNavigateToLeave={handleNavigateToLeave} />;

      case 'organization':
        return <OrganizationPage />;

      case 'employees':
        return <EmployeesPage />;

      case 'attendance':
        return <AttendancePage />;

      case 'leave':
        return <LeavePage prefillData={smartLeavePrefill} />;

      case 'payroll':
        return <PayrollPage />;

      case 'announcements':
        return <AnnouncementsPage />;

      case 'audit':
        return <AuditLogPage />;

      case 'ai':
        return <AIAssistantPage />;

      default:
        return <AdminDashboard />;
    }
  };

  return (
    <Layout currentTab={currentTab} setCurrentTab={setCurrentTab}>
      {renderContent()}
    </Layout>
  );
}
