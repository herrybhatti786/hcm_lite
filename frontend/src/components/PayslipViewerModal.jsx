import React, { useRef } from 'react';
import jsPDF from 'jspdf';
import { animateModalOpen } from '../animations/gsapUtils';
import {
  FileText,
  Download,
  X,
  Building2,
  Calendar,
  DollarSign,
  ShieldCheck
} from 'lucide-react';

export default function PayslipViewerModal({ payslip, onClose }) {
  const modalRef = useRef(null);

  if (!payslip) return null;

  const handleDownloadPDF = () => {
    const doc = new jsPDF();

    // Company Header
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    doc.text(payslip.company_name || 'Acme Global HCM', 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('CONFIDENTIAL EMPLOYEE SALARY SLIP', 105, 27, { align: 'center' });
    doc.text(`Pay Period: ${payslip.month_year}`, 105, 33, { align: 'center' });

    doc.setDrawColor(226, 232, 240);
    doc.line(15, 38, 195, 38);

    // Employee Info Section
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text(`Employee Name: ${payslip.first_name} ${payslip.last_name}`, 15, 48);
    doc.text(`Employee Code: ${payslip.employee_code}`, 15, 55);
    doc.text(`Department: ${payslip.department_name || 'N/A'}`, 15, 62);
    doc.text(`Designation: ${payslip.designation_title || 'N/A'}`, 15, 69);

    doc.text(`Working Days: ${payslip.working_days_in_month}`, 120, 48);
    doc.text(`Payable Days: ${payslip.payable_days}`, 120, 55);
    doc.text(`Absent / Unpaid: ${payslip.absent_days + payslip.unpaid_leave_days} days`, 120, 62);
    doc.text(`Late Arrivals: ${payslip.late_days || 0}`, 120, 69);

    doc.line(15, 75, 195, 75);

    // Earnings & Deductions Tables
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('EARNINGS', 15, 85);
    doc.text('DEDUCTIONS', 120, 85);

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);

    let y = 95;
    doc.text('Basic Salary:', 15, y);
    doc.text(`Rs. ${Number(payslip.basic_salary).toLocaleString()}`, 90, y, { align: 'right' });
    doc.text('Attendance Deductions:', 120, y);
    doc.text(`Rs. ${Number(payslip.attendance_deduction).toLocaleString()}`, 195, y, { align: 'right' });

    y += 8;
    doc.text('House Rent Allowance (HRA 40%):', 15, y);
    doc.text(`Rs. ${Number(payslip.hra).toLocaleString()}`, 90, y, { align: 'right' });
    doc.text('Late Arrival Penalties:', 120, y);
    doc.text(`Rs. ${Number(payslip.late_penalty_deduction || 0).toLocaleString()}`, 195, y, { align: 'right' });

    y += 8;
    doc.text('Medical Allowance (10%):', 15, y);
    doc.text(`Rs. ${Number(payslip.medical_allowance).toLocaleString()}`, 90, y, { align: 'right' });
    doc.text('Income Tax (Monthly Slab):', 120, y);
    doc.text(`Rs. ${Number(payslip.monthly_tax).toLocaleString()}`, 195, y, { align: 'right' });

    y += 12;
    doc.line(15, y, 90, y);
    doc.line(120, y, 195, y);

    y += 7;
    doc.setFont(undefined, 'bold');
    doc.text('Total Gross Salary:', 15, y);
    doc.text(`Rs. ${Number(payslip.gross_salary).toLocaleString()}`, 90, y, { align: 'right' });

    const totalDeductions = (Number(payslip.attendance_deduction) + Number(payslip.monthly_tax));
    doc.text('Total Deductions:', 120, y);
    doc.text(`Rs. ${totalDeductions.toLocaleString()}`, 195, y, { align: 'right' });

    // Net Pay Box
    y += 20;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(15, y, 180, 22, 3, 3, 'F');

    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('NET SALARY PAYABLE:', 25, y + 14);
    doc.setTextColor(16, 185, 129);
    doc.text(`Rs. ${Number(payslip.net_pay).toLocaleString()}`, 185, y + 14, { align: 'right' });

    // Footer
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('This is a system generated document from HCM Lite. No physical signature required.', 105, 280, { align: 'center' });

    doc.save(`Payslip_${payslip.employee_code}_${payslip.month_year}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        ref={modalRef}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 bg-linear-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-bold text-base">Monthly Payslip</h3>
              <p className="text-xs text-slate-300">Period: {payslip.month_year}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Payslip Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Employee summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Employee</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {payslip.first_name} {payslip.last_name}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Code</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {payslip.employee_code}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Department</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {payslip.department_name || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Payable Days</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {payslip.payable_days} / {payslip.working_days_in_month}
              </span>
            </div>
          </div>

          {/* Side by side: Earnings & Deductions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Earnings */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-3">
                Earnings (Gross = 1.5 × Basic)
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Basic Salary</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    Rs. {Number(payslip.basic_salary).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">HRA (40%)</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    Rs. {Number(payslip.hra).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Medical Allowance (10%)</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    Rs. {Number(payslip.medical_allowance).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between pt-2 font-bold text-slate-900 dark:text-white">
                  <span>Gross Salary</span>
                  <span>Rs. {Number(payslip.gross_salary).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Deductions */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-3">
                Deductions
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Attendance Deductions</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    Rs. {Number(payslip.attendance_deduction).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Late Penalty (3 lates = 0.5 d)</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    Rs. {Number(payslip.late_penalty_deduction || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Income Tax (Monthly)</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    Rs. {Number(payslip.monthly_tax).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between pt-2 font-bold text-rose-600 dark:text-rose-400">
                  <span>Total Deductions</span>
                  <span>Rs. {(Number(payslip.attendance_deduction) + Number(payslip.monthly_tax)).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Pay Highlight */}
          <div className="p-4 rounded-2xl bg-linear-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/20 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                Net Disbursed Salary
              </span>
              <span className="text-xs text-slate-500">Gross minus deductions and taxes</span>
            </div>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              Rs. {Number(payslip.net_pay).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handleDownloadPDF}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF Payslip</span>
          </button>
        </div>
      </div>
    </div>
  );
}
