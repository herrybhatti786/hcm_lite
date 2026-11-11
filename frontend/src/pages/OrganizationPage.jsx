import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  Users,
  Calendar,
  Clock,
  Shield,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  KeyRound,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

export default function OrganizationPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  const [activeTab, setActiveTab] = useState('departments');
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [settings, setSettings] = useState(null);
  const [hrUsers, setHrUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals & form state
  const [deptModal, setDeptModal] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '' });
  const [desigModal, setDesigModal] = useState(false);
  const [desigForm, setDesigForm] = useState({ department_id: '', title: '' });
  const [holidayModal, setHolidayModal] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ name: '', date: '' });
  const [hrModal, setHrModal] = useState(false);
  const [hrForm, setHrForm] = useState({ email: '', password: '' });
  const [msg, setMsg] = useState('');

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [deptRes, desRes, ltRes, holRes, setRes] = await Promise.all([
        api.getDepartments().catch(err => { console.error('Failed to get departments:', err); return null; }),
        api.getDesignations().catch(err => { console.error('Failed to get designations:', err); return null; }),
        api.getLeaveTypes().catch(err => { console.error('Failed to get leave types:', err); return null; }),
        api.getHolidays().catch(err => { console.error('Failed to get holidays:', err); return null; }),
        api.getSettings().catch(err => { console.error('Failed to get settings:', err); return null; })
      ]);
      if (Array.isArray(deptRes)) setDepartments(deptRes);
      if (Array.isArray(desRes)) setDesignations(desRes);
      if (Array.isArray(ltRes)) setLeaveTypes(ltRes);
      if (Array.isArray(holRes)) setHolidays(holRes);
      if (setRes && typeof setRes === 'object') setSettings(setRes);

      if (isAdmin) {
        try {
          const usersRes = await api.getUsers();
          if (Array.isArray(usersRes)) {
            setHrUsers(usersRes.filter(u => u.role === 'HR'));
          }
        } catch (err) {
          console.error('Failed to get users:', err);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
  }, []);

  const handleCreateDept = async (e) => {
    e.preventDefault();
    try {
      const newDept = await api.createDepartment(deptForm);
      setDeptModal(false);
      setDeptForm({ name: '', code: '', description: '' });
      if (newDept && (newDept.id || newDept.name)) {
        setDepartments(prev => {
          const item = { ...newDept, employee_count: 0 };
          const filtered = prev.filter(d => String(d.id) !== String(item.id) && d.name.toLowerCase() !== item.name.toLowerCase());
          return [...filtered, item];
        });
      }
      setMsg('Department created successfully!');
      loadData(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateDesig = async (e) => {
    e.preventDefault();
    try {
      const newDes = await api.createDesignation(desigForm);
      const targetDeptId = desigForm.department_id;
      setDesigModal(false);
      setDesigForm({ department_id: '', title: '' });
      if (newDes && (newDes.id || newDes.title)) {
        const dept = departments.find(d => String(d.id) === String(targetDeptId));
        const desWithDept = { ...newDes, department_name: dept ? dept.name : 'General' };
        setDesignations(prev => {
          const filtered = prev.filter(d => String(d.id) !== String(newDes.id) && !(d.title.toLowerCase() === newDes.title.toLowerCase() && String(d.department_id) === String(newDes.department_id)));
          return [...filtered, desWithDept];
        });
      }
      setMsg('Designation created successfully!');
      loadData(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateHoliday = async (e) => {
    e.preventDefault();
    try {
      const newHol = await api.createHoliday(holidayForm);
      setHolidayModal(false);
      setHolidayForm({ name: '', date: '' });
      if (newHol && newHol.id) {
        setHolidays(prev => [...prev.filter(h => h.id !== newHol.id), newHol]);
      }
      setMsg('Holiday added successfully!');
      loadData(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteHoliday = async (id) => {
    if (!confirm('Are you sure you want to delete this holiday?')) return;
    try {
      await api.deleteHoliday(id);
      setHolidays(prev => prev.filter(h => h.id !== id));
      loadData(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateHR = async (e) => {
    e.preventDefault();
    try {
      const newHR = await api.createHRUser(hrForm);
      setHrModal(false);
      setHrForm({ email: '', password: '' });
      if (newHR && newHR.id) {
        setHrUsers(prev => [newHR, ...prev.filter(u => u.id !== newHR.id)]);
      }
      await loadData();
      setMsg('HR login created successfully!');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleUser = async (id) => {
    try {
      await api.toggleUserStatus(id);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    try {
      await api.updateSettings(settings);
      setMsg('Settings updated successfully!');
      await loadData();
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
            Organization Structure & Parameters
          </h2>
          <p className="text-xs text-slate-500">
            Departments, designations, leave quotas, holidays, geofence, and HR executive logins
          </p>
        </div>

        {/* Tab Switchers */}
        <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs overflow-x-auto">
          {['departments', 'designations', 'leave-quotas', 'holidays', 'settings', ...(isAdmin ? ['hr-logins'] : [])].map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 rounded-xl font-semibold capitalize whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === t
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>{msg}</span>
          </div>
          <button onClick={() => setMsg('')} className="cursor-pointer">&times;</button>
        </div>
      )}

      {/* Tab 1: Departments */}
      {activeTab === 'departments' && (
        <div className="gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Company Departments</h3>
              <p className="text-xs text-slate-400">Total {departments.length} departments active</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setDeptModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Department</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {departments.length === 0 ? (
              <p className="text-xs text-slate-400 col-span-3 py-8 text-center">No departments created yet.</p>
            ) : (
              departments.map(d => (
                <div key={d.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      {d.code}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {d.employee_count || 0} employees
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">{d.name}</h4>
                  <p className="text-xs text-slate-500 line-clamp-2">{d.description || 'No description provided.'}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Designations */}
      {activeTab === 'designations' && (
        <div className="gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Designations & Job Titles</h3>
              <p className="text-xs text-slate-400">Mapped across operational departments</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setDesigModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Designation</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {designations.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No designations created yet.</p>
            ) : (
              designations.map(des => (
                <div key={des.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">{des.title}</span>
                    <span className="text-slate-500 text-[11px]">Department: {des.department_name || 'General'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Leave Quotas */}
      {activeTab === 'leave-quotas' && (
        <div className="gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Annual Leave Quotas (Section 3 Rules)</h3>
              <p className="text-xs text-slate-400">Configured policy quotas per employee per calendar year</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {leaveTypes.map(lt => (
              <div key={lt.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  {lt.is_unpaid ? 'Unpaid Category' : 'Paid Quota'}
                </span>
                <h4 className="font-bold text-base text-slate-800 dark:text-slate-200">{lt.name} Leave</h4>
                <div className="flex items-baseline gap-1 text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  <span>{lt.is_unpaid ? 'Unlimited' : lt.yearly_quota}</span>
                  {!lt.is_unpaid && <span className="text-xs font-normal text-slate-400">days/year</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Holidays */}
      {activeTab === 'holidays' && (
        <div className="gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Public Holidays Calendar</h3>
              <p className="text-xs text-slate-400">Holidays are automatically deducted from leave day consumption</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setHolidayModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Holiday</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {holidays.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No holidays declared yet.</p>
            ) : (
              holidays.map(h => (
                <div key={h.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">{h.name}</span>
                    <span className="text-slate-500 text-[11px]">{h.date}</span>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteHoliday(h.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Settings */}
      {activeTab === 'settings' && settings && (
        <div className="gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-6">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Company & Geofence Settings</h3>

          <form onSubmit={handleUpdateSettings} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Company Name</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={settings.company_name}
                  onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Office Start Time</label>
                <input
                  type="time"
                  disabled={!isAdmin}
                  value={settings.office_start}
                  onChange={(e) => setSettings({ ...settings, office_start: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Grace Period (Minutes)</label>
                <input
                  type="number"
                  disabled={!isAdmin}
                  value={settings.grace_time_minutes}
                  onChange={(e) => setSettings({ ...settings, grace_time_minutes: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Weekend Days</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={settings.weekend_days}
                  onChange={(e) => setSettings({ ...settings, weekend_days: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Office Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  disabled={!isAdmin}
                  value={settings.office_lat}
                  onChange={(e) => setSettings({ ...settings, office_lat: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Office Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  disabled={!isAdmin}
                  value={settings.office_lng}
                  onChange={(e) => setSettings({ ...settings, office_lng: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {isAdmin && (
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Save Settings
              </button>
            )}
          </form>
        </div>
      )}

      {/* Tab 6: HR Logins (Admin Only) */}
      {activeTab === 'hr-logins' && isAdmin && (
        <div className="gsap-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">HR Executive Logins (Section 2 & 8)</h3>
              <p className="text-xs text-slate-400">Admin manages and provisions HR operational accounts</p>
            </div>
            <button
              onClick={() => setHrModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create HR Executive</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {hrUsers.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No HR accounts created yet.</p>
            ) : (
              hrUsers.map(u => (
                <div key={u.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">{u.email}</span>
                    <span className="text-slate-500 text-[11px]">Role: HR Executive • Status: {u.is_active ? 'Active' : 'Deactivated'}</span>
                  </div>
                  <button
                    onClick={() => handleToggleUser(u.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold cursor-pointer ${
                      u.is_active
                        ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40'
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40'
                    }`}
                  >
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Department Modal */}
      {deptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Add New Department</h3>
            <form onSubmit={handleCreateDept} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Department Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engineering"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Department Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ENG"
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 uppercase"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Description</label>
                <textarea
                  rows="2"
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeptModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold cursor-pointer"
                >
                  Save Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Designation Modal */}
      {desigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Add Designation</h3>
            <form onSubmit={handleCreateDesig} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Department</label>
                <select
                  required
                  value={desigForm.department_id}
                  onChange={(e) => setDesigForm({ ...desigForm, department_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer"
                >
                  <option value="">Select Department</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Designation Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Software Engineer"
                  value={desigForm.title}
                  onChange={(e) => setDesigForm({ ...desigForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDesigModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold cursor-pointer"
                >
                  Save Designation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Holiday Modal */}
      {holidayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Add Public Holiday</h3>
            <form onSubmit={handleCreateHoliday} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Holiday Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Independence Day"
                  value={holidayForm.name}
                  onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={holidayForm.date}
                  onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setHolidayModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold cursor-pointer"
                >
                  Add Holiday
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HR User Modal */}
      {hrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Provision HR Executive Account</h3>
            <form onSubmit={handleCreateHR} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">HR Email</label>
                <input
                  type="email"
                  required
                  placeholder="hr@company.com"
                  value={hrForm.email}
                  onChange={(e) => setHrForm({ ...hrForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={hrForm.password}
                  onChange={(e) => setHrForm({ ...hrForm, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setHrModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold cursor-pointer"
                >
                  Create HR Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
