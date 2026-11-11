import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  CalendarDays,
  CheckCircle,
  XCircle,
  Plus,
  Sparkles,
  AlertTriangle,
  Clock,
  Send,
  RefreshCw,
  X
} from 'lucide-react';

export default function LeavePage({ prefillData }) {
  const { user } = useAuth();
  const isHR = user?.role === 'HR';
  const isAdmin = user?.role === 'Admin';
  const isEmployee = user?.role === 'Employee';

  const [balances, setBalances] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  // Apply Modal
  const [applyModal, setApplyModal] = useState(false);
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    reason: ''
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [feedback, setFeedback] = useState('');

  // Auto-apply prefillData if navigated from Smart Leave
  useEffect(() => {
    if (prefillData) {
      setFormData({
        leave_type_id: prefillData.leave_type_id || '',
        start_date: prefillData.start_date || new Date().toISOString().slice(0, 10),
        end_date: prefillData.end_date || new Date().toISOString().slice(0, 10),
        reason: prefillData.reason || ''
      });
      setApplyModal(true);
    }
  }, [prefillData]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [balRes, leavesRes] = await Promise.all([
        api.getLeaveBalances(),
        api.getLeaves()
      ]);
      setBalances(balRes);
      setLeaves(leavesRes);
      if (balRes.length > 0 && !formData.leave_type_id) {
        setFormData(prev => ({ ...prev, leave_type_id: balRes[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApply = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await api.applyLeave(formData);
      setApplyModal(false);
      setFeedback(res.message);
      loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit leave request');
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('Are you sure you want to cancel this pending leave?')) return;
    try {
      await api.cancelLeave(id);
      setFeedback('Leave request cancelled.');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReview = async (id, status) => {
    const comment = prompt(`Enter review comment for ${status}:`, 'Approved');
    if (comment === null) return;

    try {
      await api.reviewLeave(id, { status, review_comment: comment });
      setFeedback(`Leave request ${status}!`);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Leave Management & Entitlements
          </h2>
          <p className="text-xs text-slate-500">
            Working-day validation (skips weekends and holidays), strict quota guardrails, and HR approval inbox
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg('');
            setApplyModal(true);
          }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Apply for Leave</span>
        </button>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback('')} className="cursor-pointer">&times;</button>
        </div>
      )}

      {/* Quota meters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {balances.map(b => (
          <div
            key={b.id}
            className="gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-3"
          >
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-900 dark:text-white">{b.name} Leave</span>
              <span className="text-[11px] font-semibold text-slate-400">
                Quota: {b.quota}
              </span>
            </div>

            <div className="flex items-baseline gap-1 text-2xl font-black text-indigo-600 dark:text-indigo-400">
              <span>{b.remaining}</span>
              <span className="text-xs font-semibold text-slate-400">remaining</span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Used: {b.used}</span>
                {b.pending > 0 && <span className="text-amber-500">Pending: {b.pending}</span>}
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full"
                  style={{ width: `${Math.min(100, (b.used / (typeof b.quota === 'number' ? b.quota : 1)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Leave Requests Table */}
      <div className="gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-indigo-500" />
            <span>{isHR ? 'Leave Approvals Inbox & History' : 'My Leave Requests'}</span>
          </h3>
          <span className="text-xs text-slate-400">{leaves.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                {(!isEmployee || isAdmin) && <th className="py-3 px-4">Employee</th>}
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Dates</th>
                <th className="py-3 px-4">Working Days</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin" />
                  </td>
                </tr>
              ) : leaves.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    No leave requests found.
                  </td>
                </tr>
              ) : (
                leaves.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    {(!isEmployee || isAdmin) && (
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {l.first_name} {l.last_name} ({l.employee_code})
                      </td>
                    )}
                    <td className="py-3 px-4 font-semibold text-indigo-600 dark:text-indigo-400">
                      {l.leave_type_name}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      {l.start_date} → {l.end_date}
                    </td>
                    <td className="py-3 px-4 font-bold">
                      {l.days_count} day(s)
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate" title={l.reason}>
                      {l.reason}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        l.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : l.status === 'rejected' ? 'bg-rose-100 text-rose-700' : l.status === 'cancelled' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isHR && l.status === 'pending' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleReview(l.id, 'approved')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReview(l.id, 'rejected')}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                          >
                            Reject
                          </button>
                        </div>
                      )}

                      {isEmployee && l.status === 'pending' && (
                        <button
                          onClick={() => handleCancel(l.id)}
                          className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Leave Modal */}
      {applyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Apply for Leave</h3>
              <button onClick={() => setApplyModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleApply} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Leave Category</label>
                <select
                  required
                  value={formData.leave_type_id}
                  onChange={(e) => setFormData({ ...formData, leave_type_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer"
                >
                  {balances.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.remaining} remaining)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Reason for Leave</label>
                <textarea
                  rows="3"
                  required
                  placeholder="e.g. Attending sister's wedding ceremony in Islamabad"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-[11px] text-slate-600 dark:text-slate-400">
                Weekends and configured public holidays are automatically excluded from leave deductions.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setApplyModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
