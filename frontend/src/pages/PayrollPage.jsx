import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PayslipViewerModal from '../components/PayslipViewerModal';
import confetti from 'canvas-confetti';
import {
  CreditCard,
  Lock,
  FileText,
  DollarSign,
  Calendar,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  Eye,
  Plus
} from 'lucide-react';

export default function PayrollPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const isHR = user?.role === 'HR';
  const isEmployee = user?.role === 'Employee';

  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [runDetails, setRunDetails] = useState(null);
  const [myPayslips, setMyPayslips] = useState([]);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [draftMonth, setDraftMonth] = useState(new Date().toISOString().slice(0, 7));
  const [draftModal, setDraftModal] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadPayrollData = async () => {
    setLoading(true);
    try {
      if (isEmployee) {
        const ps = await api.getMyPayslips();
        setMyPayslips(ps);
      } else {
        const r = await api.getPayrollRuns();
        setRuns(r);
        if (r.length > 0 && !selectedRun) {
          setSelectedRun(r[0]);
          const details = await api.getPayrollRunDetails(r[0].id);
          setRunDetails(details);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayrollData();
  }, []);

  const handleSelectRun = async (run) => {
    setSelectedRun(run);
    try {
      const details = await api.getPayrollRunDetails(run.id);
      setRunDetails(details);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateDraft = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await api.createPayrollDraft({ month_year: draftMonth });
      setDraftModal(false);
      setFeedback(res.message);
      const r = await api.getPayrollRuns();
      setRuns(r);
      const created = r.find(item => item.month_year === draftMonth) || r[0];
      if (created) handleSelectRun(created);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalize = async (id) => {
    if (!confirm('Are you sure you want to finalize and LOCK this payroll run? Once finalized, no modifications can be made.')) return;
    setActionLoading(true);
    try {
      const res = await api.finalizePayroll(id);
      confetti({ particleCount: 80, spread: 60 });
      setFeedback(res.message);
      loadPayrollData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Payroll Processing & Payslips
          </h2>
          <p className="text-xs text-slate-500">
            Automated formula execution (Gross = 1.5×Basic, HRA 40%, Medical 10%), attendance deductions, tax slabs, and month finalization
          </p>
        </div>

        {isHR && (
          <button
            onClick={() => setDraftModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Monthly Draft</span>
          </button>
        )}
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

      {/* Employee View: My Payslips */}
      {isEmployee ? (
        <div className="gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-500" />
            <span>My Official Payslips</span>
          </h3>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {myPayslips.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No payslips generated for your account yet.</p>
            ) : (
              myPayslips.map(ps => (
                <div key={ps.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white block">
                      Pay Period: {ps.month_year}
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Gross: Rs. {Number(ps.gross_salary).toLocaleString()} • Payable Days: {ps.payable_days}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase">Net Disbursed</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        Rs. {Number(ps.net_pay).toLocaleString()}
                      </span>
                    </div>

                    <button
                      onClick={() => setSelectedPayslip(ps)}
                      className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>View & PDF</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Admin / HR View: Payroll Runs & Selected Run Details */
        <div className="space-y-6">
          {/* Payroll Runs Carousel / List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {runs.length === 0 ? (
              <p className="text-xs text-slate-400 col-span-3 py-8 text-center">
                No payroll runs created yet. HR can generate a monthly draft above.
              </p>
            ) : (
              runs.map(r => {
                const isSelected = selectedRun?.id === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => handleSelectRun(r)}
                    className={`gsap-card p-5 rounded-3xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 shadow-md'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {r.month_year}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        r.status === 'finalized' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {r.status}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-500">
                        <span>Total Gross:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          Rs. {Number(r.total_gross).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Total Net:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          Rs. {Number(r.total_net).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400 text-[11px]">
                        <span>Staff: {r.employee_count} employees</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Selected Run Details */}
          {selectedRun && runDetails && (
            <div className="gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs space-y-4 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      Payroll Run for {selectedRun.month_year}
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      selectedRun.status === 'finalized' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {selectedRun.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Prepared by {selectedRun.prepared_by_email || 'HR'} {selectedRun.finalized_at && `• Locked by ${selectedRun.finalized_by_email}`}
                  </p>
                </div>

                {/* Finalize Button (Admin only) */}
                {isAdmin && selectedRun.status === 'draft' && (
                  <button
                    onClick={() => handleFinalize(selectedRun.id)}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Finalize & Lock Payroll</span>
                  </button>
                )}
              </div>

              {/* Payslips Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Basic</th>
                      <th className="py-3 px-4">HRA (40%)</th>
                      <th className="py-3 px-4">Gross (1.5x)</th>
                      <th className="py-3 px-4">Payable / Working</th>
                      <th className="py-3 px-4">Deductions</th>
                      <th className="py-3 px-4">Net Salary</th>
                      <th className="py-3 px-4 text-right">Payslip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {(runDetails.payslips || []).map(ps => (
                      <tr key={ps.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                          {ps.first_name} {ps.last_name} ({ps.employee_code})
                        </td>
                        <td className="py-3 px-4">Rs. {Number(ps.basic_salary).toLocaleString()}</td>
                        <td className="py-3 px-4">Rs. {Number(ps.hra).toLocaleString()}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                          Rs. {Number(ps.gross_salary).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                          {ps.payable_days} / {ps.working_days_in_month} d
                        </td>
                        <td className="py-3 px-4 text-rose-600 dark:text-rose-400 font-semibold">
                          Rs. {(Number(ps.attendance_deduction) + Number(ps.monthly_tax)).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-black text-emerald-600 dark:text-emerald-400">
                          Rs. {Number(ps.net_pay).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedPayslip(ps)}
                            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            PDF Slip
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Draft Creation Modal */}
      {draftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Generate Monthly Payroll Draft</h3>
            <p className="text-xs text-slate-500">
              Calculates payable days, applies late arrival rules (3 lates = 0.5d), absent/unpaid deductions, and monthly tax slabs.
            </p>

            <form onSubmit={handleCreateDraft} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Target Month (YYYY-MM)</label>
                <input
                  type="month"
                  required
                  value={draftMonth}
                  onChange={(e) => setDraftMonth(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDraftModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  {actionLoading ? 'Calculating...' : 'Run Calculations'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payslip Modal */}
      <PayslipViewerModal
        payslip={selectedPayslip}
        onClose={() => setSelectedPayslip(null)}
      />
    </div>
  );
}
