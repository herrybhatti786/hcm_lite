import React, { useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';
import {
  Building2,
  ShieldCheck,
  Clock,
  MapPin,
  Calendar,
  Sparkles,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';

export default function FirstRunSetup() {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    companyName: 'Saylani Tech Ventures',
    adminEmail: 'admin@company.com',
    adminPassword: 'AdminPassword123!',
    officeStart: '09:00',
    graceMinutes: 15,
    halfDayHours: 5.0,
    weekendDays: 'Saturday,Sunday',
    officeLat: 24.8607,
    officeLng: 67.0011,
    officeRadius: 150
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await api.firstRunSetup(formData);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      // Log in immediately
      login(res.token, res.user, { company_name: formData.companyName });
    } catch (err) {
      setErrorMsg(err.message || 'Setup initialization failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-950 text-slate-100">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
        {/* Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Welcome to HCM Lite
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
            Zero pre-loaded dummy data. Initialize your company profile, attendance geofence, and root Admin account to begin.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-950/50 border border-rose-900/60 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Company & Root Admin */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Company & Admin Credentials</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  required
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Admin Email
                </label>
                <input
                  type="email"
                  required
                  name="adminEmail"
                  value={formData.adminEmail}
                  onChange={handleChange}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Admin Password
                </label>
                <input
                  type="password"
                  required
                  name="adminPassword"
                  value={formData.adminPassword}
                  onChange={handleChange}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Attendance & Timing Rules */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Office Timing & Business Rules</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Office Start
                </label>
                <input
                  type="time"
                  name="officeStart"
                  value={formData.officeStart}
                  onChange={handleChange}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Grace (Min)
                </label>
                <input
                  type="number"
                  name="graceMinutes"
                  value={formData.graceMinutes}
                  onChange={handleChange}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Half Day (&lt; Hours)
                </label>
                <input
                  type="number"
                  step="0.5"
                  name="halfDayHours"
                  value={formData.halfDayHours}
                  onChange={handleChange}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Weekend Days
                </label>
                <input
                  type="text"
                  name="weekendDays"
                  value={formData.weekendDays}
                  onChange={handleChange}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Geofence Location */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>Camera & Mobile Geofence (Haversine)</span>
            </h3>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Office Latitude
                </label>
                <input
                  type="number"
                  step="0.0001"
                  name="officeLat"
                  value={formData.officeLat}
                  onChange={handleChange}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Office Longitude
                </label>
                <input
                  type="number"
                  step="0.0001"
                  name="officeLng"
                  value={formData.officeLng}
                  onChange={handleChange}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Radius (Meters)
                </label>
                <input
                  type="number"
                  name="officeRadius"
                  value={formData.officeRadius}
                  onChange={handleChange}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl shadow-xl shadow-indigo-600/25 text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span>Initializing Company...</span>
            ) : (
              <>
                <span>Complete First-Run Setup</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
