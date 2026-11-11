import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  FileSpreadsheet,
  Download,
  Upload,
  Eye,
  Edit,
  X,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  DollarSign,
  Calendar,
  Briefcase
} from 'lucide-react';

export default function EmployeesPage() {
  const { user } = useAuth();
  const isHR = user?.role === 'HR';
  const isAdmin = user?.role === 'Admin';
  const canManage = isHR || isAdmin;

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [loading, setLoading] = useState(true);

  // Registration Modal
  const [registerModal, setRegisterModal] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    gender: 'Male',
    department_id: '',
    designation_id: '',
    joining_date: new Date().toISOString().slice(0, 10),
    basic_salary: 80000,
    temporary_password: 'Welcome@123'
  });

  // 360 Profile Drawer
  const [selectedEmp360, setSelectedEmp360] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // CSV Import Modal with Dry Run
  const [csvModal, setCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [dryRunReport, setDryRunReport] = useState(null);
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState('');

  const fetchEmployees = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      let query = `?search=${encodeURIComponent(search)}`;
      if (selectedDept) query += `&department=${selectedDept}`;
      const res = await api.getEmployees(query);
      setEmployees(res.employees || []);
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees(true);
  }, [search, selectedDept]);

  const refreshMetadata = () => {
    api.getDepartments().then(setDepartments).catch(console.error);
    api.getDesignations().then(setDesignations).catch(console.error);
  };

  useEffect(() => {
    refreshMetadata();
  }, []);

  const handleOpenRegister = () => {
    refreshMetadata();
    setRegisterModal(true);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await api.registerEmployee(formData);
      setRegisterModal(false);
      setFeedback(`Employee registered! Temporary password: ${res.temporaryPassword}`);
      
      // Optimistically add to employee state so it renders immediately
      if (res && res.employee) {
        const dept = departments.find(d => String(d.id) === String(formData.department_id));
        const des = designations.find(d => String(d.id) === String(formData.designation_id));
        const empWithDetails = {
          ...res.employee,
          department_name: dept ? dept.name : (res.employee.department_name || 'N/A'),
          designation_title: des ? des.title : (res.employee.designation_title || 'N/A')
        };
        setEmployees(prev => [empWithDetails, ...prev.filter(e => String(e.id) !== String(res.employee.id))]);
      }

      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        address: '',
        gender: 'Male',
        department_id: '',
        designation_id: '',
        joining_date: new Date().toISOString().slice(0, 10),
        basic_salary: 80000,
        temporary_password: 'Welcome@123'
      });
      fetchEmployees(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleView360 = async (id) => {
    setDrawerLoading(true);
    try {
      const data = await api.getEmployeeById(id);
      setSelectedEmp360(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setDrawerLoading(false);
    }
  };

  // CSV parsing & Dry-Run
  const parseCsvRaw = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.trim());
      if (vals.length < headers.length) continue;
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = vals[idx];
      });
      rows.push(obj);
    }
    return rows;
  };

  const handleDryRun = async () => {
    const rows = parseCsvRaw(csvText);
    if (rows.length === 0) {
      alert('Please paste valid CSV content with a header row.');
      return;
    }
    setImporting(true);
    try {
      const res = await api.importEmployeesCsv({ rows, isDryRun: true });
      setDryRunReport(res);
    } catch (err) {
      alert(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleCommitImport = async () => {
    const rows = parseCsvRaw(csvText);
    setImporting(true);
    try {
      const res = await api.importEmployeesCsv({ rows, isDryRun: false });
      setCsvModal(false);
      setCsvText('');
      setDryRunReport(null);
      setFeedback(res.message);
      fetchEmployees();
    } catch (err) {
      alert(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const data = await api.exportEmployeesCsv();
      if (!data || data.length === 0) {
        alert('No employee records to export.');
        return;
      }
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(r => Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const csvBlob = new Blob([`${headers}\n${rows}`], { type: 'text/csv' });
      const url = URL.createObjectURL(csvBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HCM_Employees_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
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
            Employee Directory & 360 Profiles
          </h2>
          <p className="text-xs text-slate-500">
            Search, register new hires, view salary structures, and manage CSV bulk operations
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <button
                onClick={handleExportCsv}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Export CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              {isHR && (
                <button
                  onClick={() => setCsvModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="CSV Import with Dry Run"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import CSV</span>
                </button>
              )}

              <button
                onClick={handleOpenRegister}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>Register Employee</span>
              </button>
            </>
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

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, employee code (EMP-001), or email..."
            className="w-full text-xs pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs sm:w-60">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full bg-transparent text-slate-800 dark:text-slate-200 focus:outline-hidden cursor-pointer"
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Employee Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 flex justify-center py-12">
            <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
          </div>
        ) : employees.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-slate-400 text-xs">
            No employees found matching the criteria.
          </div>
        ) : (
          employees.map(emp => (
            <div
              key={emp.id}
              className="gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-3 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-sm">
                    {emp.first_name[0]}{emp.last_name[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {emp.first_name} {emp.last_name}
                    </h3>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {emp.employee_code}
                    </span>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 capitalize">
                  {emp.status}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2.5">
                <div className="flex justify-between">
                  <span>Department:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{emp.department_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Designation:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{emp.designation_title || 'N/A'}</span>
                </div>
                {canManage && (
                  <div className="flex justify-between">
                    <span>Gross Salary:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      Rs. {Number(emp.gross_salary || 0).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => handleView360(emp.id)}
                  className="w-full py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/60 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Employee 360 View</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 360 Profile Drawer / Modal */}
      {selectedEmp360 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-6 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-bold flex items-center justify-center text-lg shadow-md shadow-indigo-600/20">
                  {selectedEmp360.employee.first_name[0]}{selectedEmp360.employee.last_name[0]}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {selectedEmp360.employee.first_name} {selectedEmp360.employee.last_name}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedEmp360.employee.employee_code} • Joined: {selectedEmp360.employee.joining_date}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEmp360(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Salary Structure (Gross = 1.5 * Basic) */}
            {canManage && (
              <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/40 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Salary Structure (Section 3 & 6 Rules)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Basic Salary</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Rs. {Number(selectedEmp360.employee.basic_salary).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">HRA (40%)</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Rs. {Number(selectedEmp360.employee.hra).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Medical (10%)</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Rs. {Number(selectedEmp360.employee.medical_allowance).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Gross Salary (1.5x)</span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400">
                      Rs. {Number(selectedEmp360.employee.gross_salary).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Leave Balances Breakdown */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Leave Balances & History
              </h4>
              <div className="grid grid-cols-3 gap-3">
                {selectedEmp360.leaveBalances.map(lb => (
                  <div key={lb.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-xs text-center border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-400 text-[10px] block uppercase">{lb.name}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                      {lb.remaining} / {lb.quota}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Attendance */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Recent Attendance Punches
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {selectedEmp360.recentAttendance.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3">No attendance punches recorded yet.</p>
                ) : (
                  selectedEmp360.recentAttendance.slice(0, 5).map(a => (
                    <div key={a.id} className="py-2 flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{a.date}</span>
                        <span className="text-[10px] text-slate-400 block">{a.source} punch</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${a.status === 'present' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {a.status} ({a.work_hours} hrs)
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register Employee Modal */}
      {registerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Register New Employee</h3>
            <p className="text-xs text-slate-500">
              Creates employee profile and user login with temporary password.
            </p>

            <form onSubmit={handleRegister} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Department</label>
                  <select
                    value={formData.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer"
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Designation</label>
                  <select
                    value={formData.designation_id}
                    onChange={(e) => setFormData({ ...formData, designation_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer"
                  >
                    <option value="">Select Designation</option>
                    {designations.map(des => (
                      <option key={des.id} value={des.id}>{des.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Joining Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.joining_date}
                    onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Basic Salary (PKR) *</label>
                  <input
                    type="number"
                    required
                    value={formData.basic_salary}
                    onChange={(e) => setFormData({ ...formData, basic_salary: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-xs space-y-1">
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Auto Computed Gross</span>
                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                  Rs. {((Number(formData.basic_salary) || 0) * 1.5).toLocaleString()} (Basic + 40% HRA + 10% Medical)
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRegisterModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold cursor-pointer"
                >
                  Register & Provision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal with Dry Run */}
      {csvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">CSV Bulk Employee Import</h3>
            <p className="text-xs text-slate-500">
              CSV Format: <code>first_name,last_name,email,basic_salary,joining_date,department</code>
            </p>

            <textarea
              rows="6"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="first_name,last_name,email,basic_salary,joining_date,department&#10;Alice,Smith,alice@company.com,90000,2026-10-01,Engineering&#10;Bob,Jones,bob@company.com,75000,2026-10-01,Marketing"
              className="w-full font-mono text-xs p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />

            {dryRunReport && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                <div className="flex justify-between font-bold">
                  <span>Dry Run Results:</span>
                  <span>{dryRunReport.validCount} Valid / {dryRunReport.errorCount} Errors</span>
                </div>
                {dryRunReport.errors.length > 0 && (
                  <div className="max-h-36 overflow-y-auto text-rose-600 dark:text-rose-400 space-y-1">
                    {dryRunReport.errors.map((err, idx) => (
                      <p key={idx}>Row {err.row}: [{err.field}] {err.reason}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCsvModal(false)}
                className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleDryRun}
                disabled={importing || !csvText.trim()}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold cursor-pointer"
              >
                {importing ? 'Validating...' : 'Validate (Dry Run)'}
              </button>
              {dryRunReport && dryRunReport.errorCount === 0 && (
                <button
                  type="button"
                  onClick={handleCommitImport}
                  disabled={importing}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold cursor-pointer"
                >
                  Import {dryRunReport.validCount} Employees
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
