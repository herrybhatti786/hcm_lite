import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import {
  Users,
  UserCheck,
  CalendarDays,
  Clock,
  AlertCircle,
  Sparkles,
  TrendingUp,
  Filter,
  RefreshCw,
  Award
} from 'lucide-react';

export default function HRDashboard() {
  const [data, setData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState([]);
  const [summarizing, setSummarizing] = useState(false);

  const fetchHRDashboard = async () => {
    setLoading(true);
    try {
      const depts = await api.getDepartments();
      setDepartments(depts);
      const res = await api.getHRDashboard(selectedDept ? `?department=${selectedDept}` : '');
      setData(res);
    } catch (err) {
      console.error('Error fetching HR dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHRDashboard();
  }, [selectedDept]);

  const handleSummarize = async () => {
    if (!data?.kpis) return;
    setSummarizing(true);
    try {
      const res = await api.summarizeKPIs(data.kpis, { department: selectedDept });
      setAiSummary(res.summary || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSummarizing(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const kpis = data?.kpis || { headcount: 0, presentToday: 0, onLeaveToday: 0, lateToday: 0, pendingApprovals: 0 };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            HR Operations & Daily Pulse
          </h2>
          <p className="text-xs text-slate-500">
            Real-time daily attendance, pending requests, late arrivals, and leave tracking
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Department Filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-hidden cursor-pointer"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* AI Summarize Button */}
          <button
            onClick={handleSummarize}
            disabled={summarizing}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{summarizing ? 'Analyzing...' : 'AI Summary'}</span>
          </button>
        </div>
      </div>

      {/* AI Summary Bullets */}
      {aiSummary.length > 0 && (
        <div className="gsap-card p-4 rounded-2xl bg-blue-500/10 dark:bg-blue-950/30 border border-blue-500/30 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
            <Sparkles className="w-4 h-4" />
            <span>AI Operations Insights (Grounded in Daily Data)</span>
          </div>
          <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
            {aiSummary.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-blue-500 font-bold">•</span>
                <span dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 5 KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <StatCard
          title="Headcount"
          value={kpis.headcount}
          icon={Users}
          color="indigo"
        />
        <StatCard
          title="Present Today"
          value={kpis.presentToday}
          icon={UserCheck}
          color="emerald"
        />
        <StatCard
          title="On Leave"
          value={kpis.onLeaveToday}
          icon={CalendarDays}
          color="sky"
        />
        <StatCard
          title="Late Today"
          value={kpis.lateToday}
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Pending Approvals"
          value={kpis.pendingApprovals}
          icon={AlertCircle}
          color="rose"
        />
      </div>

      {/* Grid: 7-Day Attendance Trend & Top Late Comers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Trend Chart */}
        <div className="lg:col-span-2 gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              <span>7-Day Attendance Trend</span>
            </h3>
            <span className="text-xs text-slate-400">Present vs Late arrivals</span>
          </div>

          <div className="h-44 flex items-end justify-between gap-3 pt-4 px-2">
            {(data?.attendanceTrend || []).map((t, idx) => {
              const maxVal = Math.max(kpis.headcount, 5);
              const presentHeight = Math.max(10, Math.round((t.present / maxVal) * 100));
              const lateHeight = Math.max(5, Math.round((t.late / maxVal) * 100));
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <div className="w-full flex items-end justify-center gap-1 h-32">
                    <div
                      className="w-1/2 bg-emerald-500/80 rounded-t-lg transition-all duration-500 hover:bg-emerald-600"
                      style={{ height: `${presentHeight}%` }}
                      title={`${t.present} Present`}
                    />
                    <div
                      className="w-1/2 bg-amber-500/80 rounded-t-lg transition-all duration-500 hover:bg-amber-600"
                      style={{ height: `${lateHeight}%` }}
                      title={`${t.late} Late`}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">{t.day}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-6 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-slate-600 dark:text-slate-400">Present</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-slate-600 dark:text-slate-400">Late Arrivals</span>
            </div>
          </div>
        </div>

        {/* Top 5 Late Comers this month */}
        <div className="gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Top Late Comers</span>
            </h3>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10">
              3 lates = 0.5 d penalty
            </span>
          </div>

          <div className="space-y-3">
            {(!data?.topLateComers || data.topLateComers.length === 0) ? (
              <p className="text-xs text-slate-400 py-6 text-center">No late arrivals recorded this month.</p>
            ) : (
              data.topLateComers.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                      {emp.first_name} {emp.last_name}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {emp.employee_code} • {emp.department_name || 'N/A'}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {emp.late_count} Late
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Leave Utilization by Type */}
      <div className="gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-indigo-500" />
          <span>Leave Utilization by Quota</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(data?.leaveByType || []).map((lt) => {
            const pct = Math.min(100, Math.round((lt.approvedDays / (lt.quota || 1)) * 100));
            return (
              <div key={lt.type} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{lt.type} Leave</span>
                  <span className="text-slate-500">{lt.approvedDays} / {lt.quota} days</span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
