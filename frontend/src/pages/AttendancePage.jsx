import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import CameraCheckInModal from '../components/CameraCheckInModal';
import {
  CalendarCheck,
  Clock,
  Camera,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  Send
} from 'lucide-react';

export default function AttendancePage() {
  const { user, employee } = useAuth();
  const isEmployee = user?.role === 'Employee';
  const isHR = user?.role === 'HR';
  const isAdmin = user?.role === 'Admin';

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedDept, setSelectedDept] = useState('');
  const [departments, setDepartments] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // Corrections
  const [corrections, setCorrections] = useState([]);
  const [correctionModal, setCorrectionModal] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    requested_check_in: '',
    requested_check_out: '',
    reason: ''
  });
  const [activeTab, setActiveTab] = useState('board');
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [feedback, setFeedback] = useState('');

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      let query = `?date=${date}`;
      if (selectedDept) query += `&department=${selectedDept}`;
      const res = await api.getAttendanceBoard(query);
      setAttendanceRecords(res.records || []);

      const corrs = await api.getCorrections();
      setCorrections(corrs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
    api.getDepartments().then(setDepartments).catch(console.error);
  }, [date, selectedDept]);

  const handleRequestCorrection = async (e) => {
    e.preventDefault();
    try {
      await api.requestCorrection(correctionForm);
      setCorrectionModal(false);
      setCorrectionForm({ date: new Date().toISOString().slice(0, 10), requested_check_in: '', requested_check_out: '', reason: '' });
      setFeedback('Correction request submitted for HR approval.');
      fetchAttendance();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReviewCorrection = async (id, status) => {
    const comment = prompt(`Enter review comment for ${status}:`, 'Verified');
    if (comment === null) return;

    try {
      await api.reviewCorrection(id, { status, review_comment: comment });
      setFeedback(`Correction ${status}!`);
      fetchAttendance();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Daily Attendance & Biometrics
          </h2>
          <p className="text-xs text-slate-500">
            Real-time web check-in, geofence face detection, daily attendance board, and correction workflows
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Switcher */}
          <div className="flex items-center p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs">
            <button
              onClick={() => setActiveTab('board')}
              className={`px-3 py-1.5 rounded-xl font-semibold cursor-pointer ${activeTab === 'board' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}
            >
              {isEmployee ? 'My Punches' : 'Daily Board'}
            </button>
            <button
              onClick={() => setActiveTab('corrections')}
              className={`px-3 py-1.5 rounded-xl font-semibold cursor-pointer ${activeTab === 'corrections' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}
            >
              Corrections ({corrections.filter(c => c.status === 'pending').length})
            </button>
          </div>

          {isEmployee && (
            <button
              onClick={() => setCorrectionModal(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Request Correction</span>
            </button>
          )}
        </div>
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

      {/* Board View */}
      {activeTab === 'board' && (
        <div className="space-y-4">
          {/* Controls */}
          {!isEmployee && (
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
              />
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="px-3 py-2 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white cursor-pointer"
              >
                <option value="">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Table */}
          <div className="gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3.5 px-4">{isEmployee ? 'Date' : 'Employee'}</th>
                    {!isEmployee && <th className="py-3.5 px-4">Department</th>}
                    <th className="py-3.5 px-4">Check In</th>
                    <th className="py-3.5 px-4">Check Out</th>
                    <th className="py-3.5 px-4">Work Hours</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 mx-auto animate-spin" />
                      </td>
                    </tr>
                  ) : attendanceRecords.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-400">
                        No records found for the selected date.
                      </td>
                    </tr>
                  ) : (
                    attendanceRecords.map((r, idx) => {
                      const status = r.calculated_status || r.status;
                      const statusBadge = {
                        present: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
                        late: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
                        half_day: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
                        absent: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
                        on_leave: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                      }[status] || 'bg-slate-100 text-slate-700';

                      return (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                            {isEmployee ? r.date : `${r.first_name} ${r.last_name} (${r.employee_code})`}
                          </td>
                          {!isEmployee && <td className="py-3 px-4 text-slate-500">{r.department_name || 'N/A'}</td>}
                          <td className="py-3 px-4 font-mono text-[11px]">
                            {r.check_in ? new Date(r.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px]">
                            {r.check_out ? new Date(r.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="py-3 px-4 font-semibold">
                            {r.work_hours ? `${r.work_hours} hrs` : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusBadge}`}>
                              {status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 capitalize">
                            {r.source || 'web'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Corrections View */}
      {activeTab === 'corrections' && (
        <div className="gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Attendance Corrections Requests</h3>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {corrections.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No correction requests logged.</p>
            ) : (
              corrections.map(c => (
                <div key={c.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {c.first_name ? `${c.first_name} ${c.last_name} (${c.employee_code})` : 'Self'}
                      </span>
                      <span className="text-slate-400">• For Date: {c.date}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                      Reason: <span className="font-medium text-slate-800 dark:text-slate-200">{c.reason}</span>
                    </p>
                    {c.review_comment && (
                      <p className="text-[11px] text-indigo-500 mt-0.5">
                        HR Comment: {c.review_comment}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      c.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : c.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {c.status}
                    </span>

                    {isHR && c.status === 'pending' && (
                      <div className="flex items-center gap-1.5 ml-2">
                        <button
                          onClick={() => handleReviewCorrection(c.id, 'approved')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReviewCorrection(c.id, 'rejected')}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Correction Request Modal */}
      {correctionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Request Attendance Correction</h3>
            <form onSubmit={handleRequestCorrection} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={correctionForm.date}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Requested Check-In</label>
                  <input
                    type="time"
                    value={correctionForm.requested_check_in}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, requested_check_in: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Requested Check-Out</label>
                  <input
                    type="time"
                    value={correctionForm.requested_check_out}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, requested_check_out: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Reason for Missed / Incorrect Punch</label>
                <textarea
                  rows="3"
                  required
                  placeholder="e.g. Card scanner hardware failure at main gate"
                  value={correctionForm.reason}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCorrectionModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold cursor-pointer"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
