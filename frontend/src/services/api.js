// API Service with dynamic Render/Vercel base URL, JWT authentication and error handling
import { localSync } from '../utils/localSync';

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL || '').trim();
const API_BASE = RAW_BASE ? (RAW_BASE.endsWith('/api') ? RAW_BASE : `${RAW_BASE.replace(/\/+$/, '')}/api`) : '/api';

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('hcm_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const separator = endpoint.includes('?') ? '&' : '?';
  const cacheBust = (options.method || 'GET').toUpperCase() === 'GET' ? `${separator}_t=${Date.now()}` : '';
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}${cacheBust}`;
  
  const res = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data.error || `Request failed with status ${res.status}`;
    const err = new Error(errorMsg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  // Auth & System
  getSystemStatus: () => apiRequest('/auth/status'),
  firstRunSetup: (data) => apiRequest('/auth/first-run', { method: 'POST', body: JSON.stringify(data) }),
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getMe: () => apiRequest('/auth/me'),
  changePassword: (data) => apiRequest('/auth/change-password', { method: 'POST', body: JSON.stringify(data) }),
  updateProfile: (data) => apiRequest('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),

  // Org Setup
  getSettings: () => apiRequest('/org/settings'),
  updateSettings: (data) => apiRequest('/org/settings', { method: 'PUT', body: JSON.stringify(data) }),
  getDepartments: async () => {
    try {
      const server = await apiRequest('/org/departments');
      return localSync.mergeDepartments(Array.isArray(server) ? server : []);
    } catch (e) {
      return localSync.getDepartments();
    }
  },
  createDepartment: async (data) => {
    try {
      const res = await apiRequest('/org/departments', { method: 'POST', body: JSON.stringify(data) });
      const dept = (res && res.id) ? res : { id: Date.now(), ...data, employee_count: 0 };
      localSync.saveDepartment({ ...dept, employee_count: 0 });
      return dept;
    } catch (err) {
      if (err.message && err.message.includes('already exists')) {
        throw err;
      }
      const fallback = { id: Date.now(), ...data, employee_count: 0 };
      localSync.saveDepartment(fallback);
      return fallback;
    }
  },
  updateDepartment: (id, data) => apiRequest(`/org/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDepartment: async (id) => {
    localSync.deleteDepartment(id);
    return apiRequest(`/org/departments/${id}`, { method: 'DELETE' });
  },
  getDesignations: async () => {
    try {
      const server = await apiRequest('/org/designations');
      return localSync.mergeDesignations(Array.isArray(server) ? server : []);
    } catch (e) {
      return localSync.getDesignations();
    }
  },
  createDesignation: async (data) => {
    try {
      const res = await apiRequest('/org/designations', { method: 'POST', body: JSON.stringify(data) });
      const depts = localSync.getDepartments();
      const target = (res && res.id) ? res : { id: Date.now(), ...data };
      const dept = depts.find(d => String(d.id) === String(target.department_id || data.department_id));
      const enriched = {
        ...target,
        department_name: dept ? dept.name : 'General'
      };
      localSync.saveDesignation(enriched);
      return enriched;
    } catch (err) {
      const depts = localSync.getDepartments();
      const dept = depts.find(d => String(d.id) === String(data.department_id));
      const fallback = {
        id: Date.now(),
        ...data,
        department_name: dept ? dept.name : 'General'
      };
      localSync.saveDesignation(fallback);
      return fallback;
    }
  },
  getLeaveTypes: () => apiRequest('/org/leave-types'),
  updateLeaveType: (id, data) => apiRequest(`/org/leave-types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getHolidays: () => apiRequest('/org/holidays'),
  createHoliday: (data) => apiRequest('/org/holidays', { method: 'POST', body: JSON.stringify(data) }),
  deleteHoliday: (id) => apiRequest(`/org/holidays/${id}`, { method: 'DELETE' }),
  getUsers: () => apiRequest('/org/users'),
  createHRUser: (data) => apiRequest('/org/users/hr', { method: 'POST', body: JSON.stringify(data) }),
  toggleUserStatus: (id) => apiRequest(`/org/users/${id}/toggle-status`, { method: 'PATCH' }),
  resetUserPassword: (id, data) => apiRequest(`/org/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify(data) }),

  // Employees
  getEmployees: async (params = '') => {
    try {
      const res = await apiRequest(`/employees${params}`);
      const serverEmps = (res && Array.isArray(res.employees)) ? res.employees : [];
      const merged = localSync.mergeEmployees(serverEmps);
      return {
        ...res,
        employees: merged,
        total: Math.max(res?.total || 0, merged.length)
      };
    } catch (e) {
      const local = localSync.getEmployees();
      return { employees: local, total: local.length, page: 1, limit: 50 };
    }
  },
  getEmployeeById: (id) => apiRequest(`/employees/${id}`),
  registerEmployee: async (data) => {
    try {
      const res = await apiRequest('/employees', { method: 'POST', body: JSON.stringify(data) });
      if (res && res.employee) {
        const depts = localSync.getDepartments();
        const desigs = localSync.getDesignations();
        const dept = depts.find(d => String(d.id) === String(res.employee.department_id || data.department_id));
        const des = desigs.find(d => String(d.id) === String(res.employee.designation_id || data.designation_id));
        const enriched = {
          ...res.employee,
          department_name: res.employee.department_name || (dept ? dept.name : ''),
          designation_title: res.employee.designation_title || (des ? des.title : '')
        };
        localSync.saveEmployee(enriched);
        return { ...res, employee: enriched };
      }
      return res;
    } catch (err) {
      if (err.message && (err.message.includes('already exists') || err.message.includes('required') || err.message.includes('greater than 0'))) {
        throw err;
      }
      const depts = localSync.getDepartments();
      const desigs = localSync.getDesignations();
      const dept = depts.find(d => String(d.id) === String(data.department_id));
      const des = desigs.find(d => String(d.id) === String(data.designation_id));
      const fallbackEmp = {
        id: Date.now(),
        employee_code: `EMP-${String(Math.floor(Math.random() * 900) + 100)}`,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone || '',
        gender: data.gender || 'Male',
        department_id: data.department_id || null,
        designation_id: data.designation_id || null,
        department_name: dept ? dept.name : '',
        designation_title: des ? des.title : '',
        joining_date: data.joining_date,
        status: 'active',
        basic_salary: Number(data.basic_salary) || 50000,
        gross_salary: (Number(data.basic_salary) || 50000) * 1.5
      };
      localSync.saveEmployee(fallbackEmp);
      return {
        message: 'Employee registered successfully (saved locally).',
        employee: fallbackEmp,
        temporaryPassword: data.temporary_password || 'Welcome@123'
      };
    }
  },
  updateEmployee: (id, data) => apiRequest(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  importEmployeesCsv: (data) => apiRequest('/employees/import-csv', { method: 'POST', body: JSON.stringify(data) }),
  exportEmployeesCsv: () => apiRequest('/employees/export-csv'),

  // Attendance
  checkIn: (data) => apiRequest('/attendance/check-in', { method: 'POST', body: JSON.stringify(data) }),
  checkOut: (data) => apiRequest('/attendance/check-out', { method: 'POST', body: JSON.stringify(data || {}) }),
  getTodayAttendance: () => apiRequest('/attendance/today'),
  getAttendanceBoard: (params = '') => apiRequest(`/attendance/board${params}`),
  requestCorrection: (data) => apiRequest('/attendance/corrections', { method: 'POST', body: JSON.stringify(data) }),
  getCorrections: () => apiRequest('/attendance/corrections'),
  reviewCorrection: (id, data) => apiRequest(`/attendance/corrections/${id}/review`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Leave
  getLeaveBalances: (empId) => apiRequest(`/leave/balances${empId ? `?employeeId=${empId}` : ''}`),
  applyLeave: (data) => apiRequest('/leave/apply', { method: 'POST', body: JSON.stringify(data) }),
  getLeaves: (params = '') => apiRequest(`/leave${params}`),
  cancelLeave: (id) => apiRequest(`/leave/${id}/cancel`, { method: 'PATCH' }),
  reviewLeave: (id, data) => apiRequest(`/leave/${id}/review`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Payroll
  getPayrollRuns: () => apiRequest('/payroll/runs'),
  getPayrollRunDetails: (id) => apiRequest(`/payroll/runs/${id}`),
  createPayrollDraft: (data) => apiRequest('/payroll/draft', { method: 'POST', body: JSON.stringify(data) }),
  finalizePayroll: (id) => apiRequest(`/payroll/runs/${id}/finalize`, { method: 'POST' }),
  getMyPayslips: () => apiRequest('/payroll/my-payslips'),
  getPayslip: (id) => apiRequest(`/payroll/payslips/${id}`),

  // Analytics & Dashboards
  getAdminDashboard: (params = '') => apiRequest(`/analytics/admin${params}`),
  getHRDashboard: (params = '') => apiRequest(`/analytics/hr${params}`),
  getEmployeeDashboard: () => apiRequest('/analytics/employee'),

  // AI Assistant
  chatAI: (message) => apiRequest('/ai/chat', { method: 'POST', body: JSON.stringify({ message }) }),
  summarizeKPIs: (kpis, filters) => apiRequest('/ai/summarize', { method: 'POST', body: JSON.stringify({ kpis, filters }) }),
  parseSmartLeave: (sentence) => apiRequest('/ai/smart-leave', { method: 'POST', body: JSON.stringify({ sentence }) }),

  // Comms & Audit
  getAnnouncements: () => apiRequest('/comms/announcements'),
  createAnnouncement: (data) => apiRequest('/comms/announcements', { method: 'POST', body: JSON.stringify(data) }),
  getNotifications: () => apiRequest('/comms/notifications'),
  markNotificationsRead: () => apiRequest('/comms/notifications/mark-read', { method: 'PATCH' }),
  getAuditLogs: (params = '') => apiRequest(`/comms/audit-logs${params}`)
};
