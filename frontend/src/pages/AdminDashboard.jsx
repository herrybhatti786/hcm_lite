import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import {
  Users,
  TrendingDown,
  CreditCard,
  Briefcase,
  Sparkles,
  History,
  Building,
  Filter,
  CheckCircle,
  RefreshCw
} from 'lucide-react';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState([]);
  const [summarizing, setSummarizing] = useState(false);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const depts = await api.getDepartments();
      setDepartments(depts);
      const res = await api.getAdminDashboard(selectedDept ? `?department=${selectedDept}` : '');
      setData(res);
    } catch (err) {
      console.error('Error fetching admin dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
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

  const kpis = data?.kpis || { headcount: 0, attritionRate: '0%', payrollCost: 0, avgSalary: 0 };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Company Executive Overview
          </h2>
          <p className="text-xs text-slate-500">
            Real-time human capital analytics, department distribution, and financial liabilities
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
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{summarizing ? 'Analyzing...' : 'AI Summary'}</span>
          </button>
        </div>
      </div>

      {/* AI Summary Bullets Card (if generated) */}
      {aiSummary.length > 0 && (
        <div className="gsap-card p-4 rounded-2xl bg-indigo-500/10 dark:bg-indigo-950/30 border border-indigo-500/30 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-4 h-4" />
            <span>AI Executive Insights (Database Grounded)</span>
          </div>
          <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
            {aiSummary.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-indigo-500 font-bold">•</span>
                <span dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Headcount"
          value={kpis.headcount}
          icon={Users}
          color="indigo"
          subtitle="Full-time & probation"
        />
        <StatCard
          title="Attrition Rate YTD"
          value={kpis.attritionRate}
          icon={TrendingDown}
          color="amber"
          subtitle="Exits / Avg headcount"
        />
        <StatCard
          title="Monthly Payroll Cost"
          value={kpis.payrollCost}
          prefix="Rs. "
          icon={CreditCard}
          color="emerald"
          subtitle="Gross employee compensation"
        />
        <StatCard
          title="Average Salary"
          value={kpis.avgSalary}
          prefix="Rs. "
          icon={Briefcase}
          color="purple"
          subtitle="Mean gross per employee"
        />
      </div>

      {/* Grid: Charts & Analytics Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Headcount by Department */}
        <div className="gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Building className="w-4 h-4 text-indigo-500" />
              <span>Headcount by Department</span>
            </h3>
            <span className="text-xs text-slate-400">Active staffing</span>
          </div>

          <div className="space-y-3">
            {(!data?.headcountByDept || data.headcountByDept.length === 0) ? (
              <p className="text-xs text-slate-400 py-6 text-center">No departments or employees created yet.</p>
            ) : (
              data.headcountByDept.map(dept => {
                const total = kpis.headcount || 1;
                const pct = Math.round((dept.headcount / total) * 100);
                return (
                  <div key={dept.id} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span>{dept.name}</span>
                      <span>{dept.headcount} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-linear-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Payroll Cost by Department */}
        <div className="gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              <span>Payroll Cost by Department</span>
            </h3>
            <span className="text-xs text-slate-400">Total gross budget</span>
          </div>

          <div className="space-y-3">
            {(!data?.payrollByDept || data.payrollByDept.length === 0) ? (
              <p className="text-xs text-slate-400 py-6 text-center">No payroll data available yet.</p>
            ) : (
              data.payrollByDept.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{p.name}</span>
                    <span className="block text-[11px] text-slate-500">Avg: Rs. {Math.round(p.avg_payroll || 0).toLocaleString()}</span>
                  </div>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    Rs. {Number(p.total_payroll || 0).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Tenure & Live Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tenure & Gender */}
        <div className="gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Tenure & Demographics
          </h3>

          <div className="space-y-3 text-xs">
            <span className="text-slate-400 uppercase text-[10px] font-bold block">Tenure Breakdown</span>
            {Object.entries(data?.tenureDistribution || {}).map(([band, count]) => (
              <div key={band} className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">{band}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{count} employee(s)</span>
              </div>
            ))}

            <span className="text-slate-400 uppercase text-[10px] font-bold block pt-2">Gender Diversity</span>
            {(data?.genderDistribution || []).map(g => (
              <div key={g.gender} className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">{g.gender}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{g.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live Audit Log Feed (Admin only) */}
        <div className="lg:col-span-2 gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-purple-500" />
              <span>Live Audit Trail Feed</span>
            </h3>
            <span className="text-xs text-slate-400">Security & compliance log</span>
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {(!data?.recentAudit || data.recentAudit.length === 0) ? (
              <p className="text-xs text-slate-400 py-6 text-center">No audit records logged yet.</p>
            ) : (
              data.recentAudit.map(log => (
                <div key={log.id} className="py-2.5 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      <span className="text-indigo-600 dark:text-indigo-400 font-mono">[{log.action}]</span> {log.entity} #{log.entity_id || ''}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      By {log.actor_email} ({log.actor_role})
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
