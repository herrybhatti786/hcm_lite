import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Building,
  Users,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  FileText,
  Megaphone,
  History,
  Bot,
  UserCheck,
  ShieldAlert
} from 'lucide-react';

export default function Sidebar({ currentTab, setCurrentTab }) {
  const { user } = useAuth();
  if (!user) return null;

  const role = user.role;

  const adminNav = [
    { id: 'dashboard', label: 'Company Overview', icon: LayoutDashboard },
    { id: 'organization', label: 'Organization Setup', icon: Building },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'attendance', label: 'Attendance Board', icon: CalendarCheck },
    { id: 'leave', label: 'Leave Requests', icon: CalendarDays },
    { id: 'payroll', label: 'Payroll & Finalize', icon: CreditCard },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'audit', label: 'Audit Trail', icon: History },
    { id: 'ai', label: 'AI Assistant', icon: Bot },
  ];

  const hrNav = [
    { id: 'dashboard', label: 'HR Dashboard', icon: LayoutDashboard },
    { id: 'employees', label: 'Employees & Register', icon: Users },
    { id: 'attendance', label: 'Daily Attendance', icon: CalendarCheck },
    { id: 'leave', label: 'Leave Approvals', icon: CalendarDays },
    { id: 'payroll', label: 'Monthly Payroll Draft', icon: CreditCard },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'ai', label: 'AI Assistant', icon: Bot },
  ];

  const employeeNav = [
    { id: 'dashboard', label: 'My Dashboard', icon: LayoutDashboard },
    { id: 'attendance', label: 'My Attendance', icon: CalendarCheck },
    { id: 'leave', label: 'Apply Leave', icon: CalendarDays },
    { id: 'payroll', label: 'My Payslips', icon: FileText },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'ai', label: 'Ask My Assistant', icon: Bot },
  ];

  const navItems = role === 'Admin' ? adminNav : (role === 'HR' ? hrNav : employeeNav);

  return (
    <aside className="w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between hidden md:flex min-h-[calc(100vh-4rem)]">
      <div className="p-4 space-y-1">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Navigation ({role})
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 translate-x-0.5'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Role Notice in bottom of sidebar */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800">
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/50">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <UserCheck className="w-4 h-4 text-indigo-500" />
            <span>Role Scope</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {role === 'Admin' && 'Full company privileges. Can lock payroll & view audit.'}
            {role === 'HR' && 'People operations, register employees, attendance & payroll draft.'}
            {role === 'Employee' && 'Self-service only. Protected from accessing peer data.'}
          </p>
        </div>
      </div>
    </aside>
  );
}
