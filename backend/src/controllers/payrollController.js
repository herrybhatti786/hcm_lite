const { getDatabase } = require('../db/database');
const { calculateSalaryBreakdown, calculateAnnualTax } = require('../utils/taxCalculator');
const { calculateWorkingDaysInMonth, parseDate, formatDate, isWeekend, getHolidaysSet } = require('../utils/dateUtils');
const { logAuditAction } = require('../middleware/auditMiddleware');
const { createNotification } = require('../utils/notificationService');

async function getPayrollRuns(req, res) {
  try {
    const db = await getDatabase();
    const runs = db.query(`
      SELECT pr.*, 
             u1.email as prepared_by_email,
             u2.email as finalized_by_email,
             (SELECT COUNT(*) FROM payslips ps WHERE ps.payroll_run_id = pr.id) as employee_count
      FROM payroll_runs pr
      LEFT JOIN users u1 ON pr.prepared_by = u1.id
      LEFT JOIN users u2 ON pr.finalized_by = u2.id
      ORDER BY pr.month_year DESC
    `);
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getPayrollRunDetails(req, res) {
  try {
    const { id } = req.params;
    const db = await getDatabase();

    const run = db.queryOne(`
      SELECT pr.*, 
             u1.email as prepared_by_email,
             u2.email as finalized_by_email
      FROM payroll_runs pr
      LEFT JOIN users u1 ON pr.prepared_by = u1.id
      LEFT JOIN users u2 ON pr.finalized_by = u2.id
      WHERE pr.id = ?
    `, [id]);

    if (!run) return res.status(404).json({ error: 'Payroll run not found.' });

    // Data-scope: Employee can only see finalized runs
    if (req.user.role === 'Employee' && run.status !== 'finalized') {
      return res.status(403).json({ error: 'Payroll run is currently in draft. Payslips are only visible once finalized by Admin.' });
    }

    let sql = `
      SELECT ps.*, e.employee_code, e.first_name, e.last_name, e.email,
             d.name as department_name, des.title as designation_title
      FROM payslips ps
      JOIN employees e ON ps.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE ps.payroll_run_id = ?
    `;
    const params = [id];

    // Data-scope: Employee can only see own payslip
    if (req.user.role === 'Employee') {
      sql += ` AND ps.employee_id = ?`;
      params.push(req.user.employee_id);
    }

    sql += ` ORDER BY e.employee_code ASC`;
    const payslips = db.query(sql, params);

    res.json({ run, payslips });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createPayrollDraft(req, res) {
  try {
    const { month_year } = req.body; // 'YYYY-MM'
    if (!month_year || !/^\d{4}-\d{2}$/.test(month_year)) {
      return res.status(400).json({ error: 'Month/Year is required in YYYY-MM format.' });
    }

    const [year, month] = month_year.split('-').map(Number);
    const db = await getDatabase();

    // Check if payroll run already finalized
    const existing = db.queryOne("SELECT * FROM payroll_runs WHERE month_year = ?", [month_year]);
    if (existing && existing.status === 'finalized') {
      return res.status(400).json({ error: `Payroll for ${month_year} is finalized and locked. It cannot be recalculated.` });
    }

    // Calculate total working days in this month
    const { workingDays } = await calculateWorkingDaysInMonth(db, year, month);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const monthStartStr = `${month_year}-01`;
    const monthEndStr = `${month_year}-${String(daysInMonth).padStart(2, '0')}`;

    // Get active/probation employees or those who exited in this month
    const employees = db.query(`
      SELECT * FROM employees 
      WHERE joining_date <= ? AND (exit_date IS NULL OR exit_date >= ?)
      ORDER BY id ASC
    `, [monthEndStr, monthStartStr]);

    if (employees.length === 0) {
      return res.status(400).json({ error: 'No active employees found for this month.' });
    }

    // Settings for late penalty
    const settings = db.queryOne("SELECT late_penalty_enabled FROM settings LIMIT 1");
    const latePenaltyEnabled = settings ? !!settings.late_penalty_enabled : true;

    // Create or update payroll_run
    let runId;
    if (existing) {
      runId = existing.id;
      // Delete old payslips draft
      db.run("DELETE FROM payslips WHERE payroll_run_id = ?", [runId]);
    } else {
      const insertRun = db.run(`
        INSERT INTO payroll_runs (month_year, status, prepared_by)
        VALUES (?, 'draft', ?)
      `, [month_year, req.user.id]);
      runId = insertRun.lastInsertRowid;
    }

    let runTotalGross = 0;
    let runTotalDeductions = 0;
    let runTotalTax = 0;
    let runTotalNet = 0;

    for (const emp of employees) {
      const basic = emp.basic_salary;
      const salaryInfo = calculateSalaryBreakdown(basic);
      const gross = salaryInfo.gross;
      const perDayGross = gross / (workingDays || 22);

      // Attendance records in this month
      const attendanceRecords = db.query(`
        SELECT status FROM attendance
        WHERE employee_id = ? AND date BETWEEN ? AND ?
      `, [emp.id, monthStartStr, monthEndStr]);

      let presentDays = 0;
      let lateDays = 0;
      let halfDays = 0;

      attendanceRecords.forEach(a => {
        if (a.status === 'present') presentDays++;
        else if (a.status === 'late') { presentDays++; lateDays++; }
        else if (a.status === 'half_day') halfDays++;
      });

      // Settings and holidays for working day calculations
      const settingsRow = db.queryOne("SELECT weekend_days FROM settings LIMIT 1");
      const weekendConfig = settingsRow ? settingsRow.weekend_days : 'Saturday,Sunday';
      const holidays = await getHolidaysSet(db);

      // Approved leaves overlapping this month (calculate only days falling strictly within this month)
      const approvedLeaves = db.query(`
        SELECT lr.start_date, lr.end_date, lt.is_unpaid
        FROM leave_requests lr
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE lr.employee_id = ? AND lr.status = 'approved'
          AND lr.start_date <= ? AND lr.end_date >= ?
      `, [emp.id, monthEndStr, monthStartStr]);

      let unpaidLeaveDays = 0;
      let paidLeaveDays = 0;

      for (const lv of approvedLeaves) {
        const effStart = lv.start_date > monthStartStr ? lv.start_date : monthStartStr;
        const effEnd = lv.end_date < monthEndStr ? lv.end_date : monthEndStr;
        const curD = parseDate(effStart);
        const endD = parseDate(effEnd);

        while (curD <= endD) {
          const s = formatDate(curD);
          if (!isWeekend(curD, weekendConfig) && !holidays.has(s)) {
            if (lv.is_unpaid) {
              unpaidLeaveDays++;
            } else {
              paidLeaveDays++;
            }
          }
          curD.setUTCDate(curD.getUTCDate() + 1);
        }
      }

      // Expected working days for this employee in this month (prorated for mid-month joiners or exits)
      const empStart = emp.joining_date > monthStartStr ? emp.joining_date : monthStartStr;
      const empEnd = (emp.exit_date && emp.exit_date < monthEndStr) ? emp.exit_date : monthEndStr;

      let expectedWorkingDaysForEmp = 0;
      const curEmp = parseDate(empStart);
      const endEmp = parseDate(empEnd);
      while (curEmp <= endEmp) {
        const s = formatDate(curEmp);
        if (!isWeekend(curEmp, weekendConfig) && !holidays.has(s)) {
          expectedWorkingDaysForEmp++;
        }
        curEmp.setUTCDate(curEmp.getUTCDate() + 1);
      }
      expectedWorkingDaysForEmp = Math.min(workingDays, expectedWorkingDaysForEmp);

      // Unworked days outside employment contract within this month
      const unworkedDays = Math.max(0, workingDays - expectedWorkingDaysForEmp);

      const absentDays = Math.max(0, expectedWorkingDaysForEmp - (presentDays + halfDays + paidLeaveDays + unpaidLeaveDays));

      // Late penalty: 3 lates = 0.5 day deduction
      let latePenaltyDays = 0;
      if (latePenaltyEnabled && lateDays >= 3) {
        latePenaltyDays = Math.floor(lateDays / 3) * 0.5;
      }

      // Total days to deduct from gross salary (unworked + absent + unpaid + 0.5 * half days + late penalty)
      const deductionDays = unworkedDays + absentDays + unpaidLeaveDays + (0.5 * halfDays) + latePenaltyDays;
      const attendanceDeduction = Math.round((deductionDays * perDayGross) * 100) / 100;
      const latePenaltyDeduction = Math.round((latePenaltyDays * perDayGross) * 100) / 100;

      // Actual payable days
      const payableDays = Math.max(0, Math.round((workingDays - deductionDays) * 10) / 10);

      // Tax calculation
      const annualGross = gross * 12;
      const annualTax = calculateAnnualTax(annualGross);
      const monthlyTax = Math.round((annualTax / 12) * 100) / 100;

      const totalDeductions = attendanceDeduction + monthlyTax;
      const netPay = Math.max(0, Math.round((gross - totalDeductions) * 100) / 100);

      db.run(`
        INSERT INTO payslips (
          payroll_run_id, employee_id, month_year, basic_salary, hra, medical_allowance, gross_salary,
          working_days_in_month, payable_days, absent_days, half_days, unpaid_leave_days, late_days,
          late_penalty_deduction, attendance_deduction, annual_gross, annual_tax, monthly_tax, net_pay
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        runId, emp.id, month_year, salaryInfo.basic, salaryInfo.hra, salaryInfo.medical, gross,
        workingDays, payableDays, absentDays, halfDays, unpaidLeaveDays, lateDays,
        latePenaltyDeduction, attendanceDeduction, annualGross, annualTax, monthlyTax, netPay
      ]);

      runTotalGross += gross;
      runTotalDeductions += attendanceDeduction;
      runTotalTax += monthlyTax;
      runTotalNet += netPay;
    }

    db.run(`
      UPDATE payroll_runs SET
        total_gross = ?,
        total_deductions = ?,
        total_tax = ?,
        total_net = ?,
        prepared_by = ?
      WHERE id = ?
    `, [
      Math.round(runTotalGross * 100) / 100,
      Math.round(runTotalDeductions * 100) / 100,
      Math.round(runTotalTax * 100) / 100,
      Math.round(runTotalNet * 100) / 100,
      req.user.id,
      runId
    ]);

    const updatedRun = db.queryOne("SELECT * FROM payroll_runs WHERE id = ?", [runId]);

    await logAuditAction({
      req,
      action: 'GENERATE_PAYROLL_DRAFT',
      entity: 'payroll_runs',
      entity_id: runId,
      after_json: updatedRun
    });

    res.status(201).json({
      message: `Payroll draft for ${month_year} generated for ${employees.length} employees.`,
      run: updatedRun
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function finalizePayroll(req, res) {
  try {
    const { id } = req.params;
    const db = await getDatabase();

    const run = db.queryOne("SELECT * FROM payroll_runs WHERE id = ?", [id]);
    if (!run) return res.status(404).json({ error: 'Payroll run not found.' });

    if (run.status === 'finalized') {
      return res.status(400).json({ error: 'This payroll run is already finalized and locked.' });
    }

    db.run(`
      UPDATE payroll_runs SET
        status = 'finalized',
        finalized_by = ?,
        finalized_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.user.id, id]);

    // Send notifications to all employees that payslips are ready
    const payslips = db.query("SELECT employee_id, net_pay, month_year FROM payslips WHERE payroll_run_id = ?", [id]);
    for (const p of payslips) {
      const empUser = db.queryOne("SELECT id FROM users WHERE employee_id = ?", [p.employee_id]);
      if (empUser) {
        await createNotification(
          empUser.id,
          'Payslip Published',
          `Your payslip for ${p.month_year} is available. Net pay: Rs. ${p.net_pay.toLocaleString()}`,
          'payroll'
        );
      }
    }

    await logAuditAction({
      req,
      action: 'FINALIZE_PAYROLL',
      entity: 'payroll_runs',
      entity_id: id,
      before_json: run,
      after_json: { status: 'finalized', finalized_by: req.user.id }
    });

    res.json({ message: 'Payroll run finalized and locked successfully. Payslips published to all employees.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getPayslip(req, res) {
  try {
    const { id } = req.params;
    const db = await getDatabase();

    const payslip = db.queryOne(`
      SELECT ps.*, 
             e.employee_code, e.first_name, e.last_name, e.email, e.phone, e.joining_date,
             d.name as department_name, des.title as designation_title,
             s.company_name, s.office_start
      FROM payslips ps
      JOIN employees e ON ps.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN (SELECT * FROM settings LIMIT 1) s ON 1=1
      WHERE ps.id = ?
    `, [id]);

    if (!payslip) return res.status(404).json({ error: 'Payslip not found.' });

    // Scope check: Employee can only view own payslip
    if (req.user.role === 'Employee' && Number(req.user.employee_id) !== Number(payslip.employee_id)) {
      return res.status(403).json({ error: 'Access denied. You cannot view other employees\' payslips.' });
    }

    res.json(payslip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getMyPayslips(req, res) {
  try {
    if (!req.user.employee_id) {
      return res.status(400).json({ error: 'No employee record linked.' });
    }

    const db = await getDatabase();
    const rows = db.query(`
      SELECT ps.*, pr.status as run_status
      FROM payslips ps
      JOIN payroll_runs pr ON ps.payroll_run_id = pr.id
      WHERE ps.employee_id = ?
      ORDER BY ps.month_year DESC
    `, [req.user.employee_id]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getPayrollRuns,
  getPayrollRunDetails,
  createPayrollDraft,
  finalizePayroll,
  getPayslip,
  getMyPayslips
};
