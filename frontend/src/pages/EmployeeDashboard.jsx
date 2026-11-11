import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import CameraCheckInModal from '../components/CameraCheckInModal';
import PayslipViewerModal from '../components/PayslipViewerModal';
import {
  Clock,
  CalendarCheck,
  CheckCircle,
  CalendarDays,
  CreditCard,
  Camera,
  AlertTriangle,
  Megaphone,
  Sparkles,
  ArrowRight,
  RefreshCw,
  LogOut
} from 'lucide-react';

export default function EmployeeDashboard({ onNavigateToLeave }) {
  const { user, employee } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [smartLeaveInput, setSmartLeaveInput] = useState('');
  const [smartLeaveLoading, setSmartLeaveLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const fetchDashboard = async () => {
    try {
      const data = await api.getEmployeeDashboard();
      setDashboard(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleWebCheckIn = async () => {
    setActionLoading(true);
    setActionMsg('');
    try {
      await api.checkIn({ source: 'web' });
      await fetchDashboard();
      setActionMsg('Checked in successfully!');
    } catch (err) {
      setActionMsg(err.message || 'Check-in failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    setActionMsg('');
    try {
      await api.checkOut();
      await fetchDashboard();
      setActionMsg('Checked out successfully!');
    } catch (err) {
      setActionMsg(err.message || 'Check-out failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSmartLeaveSubmit = async (e) => {
    e.preventDefault();
    if (!smartLeaveInput.trim()) return;

    setSmartLeaveLoading(true);
    try {
      const parsed = await api.parseSmartLeave(smartLeaveInput);
      if (onNavigateToLeave) {
        onNavigateToLeave(parsed);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSmartLeaveLoading(false);
    }
  };

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const todayRecord = dashboard?.todayAttendance;
  const isCheckedIn = !!todayRecord?.check_in;
  const isCheckedOut = !!todayRecord?.check_out;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 rounded-3xl bg-linear-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/20 text-indigo-200">
            Self-Service Portal
          </span>
          <h2 className="text-2xl font-black">
            Welcome back, {employee?.first_name || user?.email.split('@')[0]}!
          </h2>
          <p className="text-xs text-indigo-200">
            {employee?.designation_title || 'Team Member'} • {employee?.department_name || 'Acme Global'} • Code: {employee?.employee_code}
          </p>
        </div>

        {/* Check-In Action Card */}
        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 flex flex-col gap-2 min-w-[220px]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">
            Today's Punch Status
          </span>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isCheckedOut ? 'bg-slate-400' : isCheckedIn ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-sm font-bold">
              {isCheckedOut ? 'Checked Out' : isCheckedIn ? `Checked In (${todayRecord.status.toUpperCase()})` : 'Not Checked In'}
            </span>
          </div>

          <div className="flex gap-2 pt-1">
            {!isCheckedIn ? (
              <>
                <button
                  onClick={handleWebCheckIn}
                  disabled={actionLoading}
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl text-xs text-white transition-colors cursor-pointer shadow-sm"
                >
                  Web Punch
                </button>
                <button
                  onClick={() => setCameraModalOpen(true)}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white transition-colors cursor-pointer"
                  title="Camera + Face Check-in"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </>
            ) : !isCheckedOut ? (
              <button
                onClick={handleCheckOut}
                disabled={actionLoading}
                className="w-full py-2 bg-rose-500 hover:bg-rose-600 font-bold rounded-xl text-xs text-white transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Check Out</span>
              </button>
            ) : (
              <span className="text-[11px] text-indigo-200 py-1">
                Completed today ({todayRecord.work_hours} hrs)
              </span>
            )}
          </div>

          {actionMsg && (
            <p className="text-[10px] text-amber-200">{actionMsg}</p>
          )}
        </div>
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Hours Worked This Week"
          value={dashboard?.weeklyHours || 0}
          suffix=" / 40 hrs"
          icon={Clock}
          color="indigo"
          subtitle="Target: 40 hours weekly"
        />
        <StatCard
          title="Late Count (This Month)"
          value={dashboard?.lateCount || 0}
          icon={AlertTriangle}
          color="amber"
          subtitle="3 lates = 0.5 day penalty"
        />
        <StatCard
          title="Annual Leave Remaining"
          value={dashboard?.leaveBalances?.find(b => b.name === 'Annual')?.remaining || 14}
          suffix=" days"
          icon={CalendarDays}
          color="emerald"
          subtitle="Out of 14 yearly quota"
        />
        <StatCard
          title="Sick Leave Remaining"
          value={dashboard?.leaveBalances?.find(b => b.name === 'Sick')?.remaining || 8}
          suffix=" days"
          icon={CalendarCheck}
          color="sky"
          subtitle="Out of 8 yearly quota"
        />
      </div>

      {/* Smart Leave Natural Language Input Card */}
      <div className="gsap-card bg-linear-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 rounded-3xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
          <Sparkles className="w-4 h-4" />
          <span>Smart Leave Assistant (Natural Language & Roman Urdu)</span>
        </div>
        <form onSubmit={handleSmartLeaveSubmit} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={smartLeaveInput}
            onChange={(e) => setSmartLeaveInput(e.target.value)}
            placeholder="e.g. Need next Monday and Tuesday off for my sister's wedding (or Agli somwar aur mangal ko chutti chahiye)"
            className="flex-1 text-xs px-4 py-3 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={smartLeaveLoading || !smartLeaveInput.trim()}
            className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-indigo-600/20 shrink-0"
          >
            {smartLeaveLoading ? 'Parsing...' : 'Pre-Fill Leave'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Grid: Last Payslip & Company Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Last Payslip Widget */}
        <div className="gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              <span>Latest Payslip</span>
            </h3>
            <span className="text-xs text-slate-400">Published by Admin</span>
          </div>

          {!dashboard?.lastPayslip ? (
            <p className="text-xs text-slate-400 py-6 text-center">No finalized payslips available yet.</p>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Month: {dashboard.lastPayslip.month_year}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  Finalized
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Gross Salary</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Rs. {Number(dashboard.lastPayslip.gross_salary).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Net Disbursed</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    Rs. {Number(dashboard.lastPayslip.net_pay).toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedPayslip(dashboard.lastPayslip)}
                className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                View Detailed Slip & PDF
              </button>
            </div>
          )}
        </div>

        {/* Company Announcements */}
        <div className="gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-purple-500" />
              <span>Company Announcements</span>
            </h3>
            <span className="text-xs text-slate-400">Notice board</span>
          </div>

          <div className="space-y-3 max-h-56 overflow-y-auto">
            {(!dashboard?.announcements || dashboard.announcements.length === 0) ? (
              <p className="text-xs text-slate-400 py-6 text-center">No announcements posted yet.</p>
            ) : (
              dashboard.announcements.map((a) => (
                <div key={a.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{a.title}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">{a.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Camera Check-in Modal */}
      <CameraCheckInModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onSuccess={() => fetchDashboard()}
      />

      {/* Payslip Viewer Modal */}
      <PayslipViewerModal
        payslip={selectedPayslip}
        onClose={() => setSelectedPayslip(null)}
      />
    </div>
  );
}
