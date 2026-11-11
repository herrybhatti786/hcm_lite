const { getDatabase } = require('../db/database');
const { calculateWorkingDaysInMonth } = require('../utils/dateUtils');

function getTodayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function getAdminDashboard(req, res) {
  try {
    const { department = '', startDate = '', endDate = '' } = req.query;
    const db = await getDatabase();
    const today = getTodayString();
    const currentMonth = today.slice(0, 7);

    // Active headcount
    let empFilter = "WHERE e.status != 'exited'";
    const empParams = [];
    if (department) {
      empFilter += " AND e.department_id = ?";
      empParams.push(department);
    }

    const headcountRow = db.queryOne(`SELECT COUNT(*) as count FROM employees e ${empFilter}`, empParams);
    const activeHeadcount = headcountRow ? headcountRow.count : 0;

    // Exits YTD
    const currentYear = today.split('-')[0];
    const exitsRow = db.queryOne(`
      SELECT COUNT(*) as count FROM employees e 
      WHERE e.status = 'exited' AND e.exit_date >= ?
      ${department ? 'AND e.department_id = ?' : ''}
    `, department ? [`${currentYear}-01-01`, department] : [`${currentYear}-01-01`]);
    const exitsYTD = exitsRow ? exitsRow.count : 0;

    // Attrition rate formula: exits / average headcount * 100
    const avgHeadcount = activeHeadcount + (exitsYTD / 2) || 1;
    const attritionRate = Math.round((exitsYTD / avgHeadcount) * 1000) / 10;

    // Payroll cost & Average salary
    const payrollStats = db.queryOne(`
      SELECT 
        COALESCE(SUM(ps.gross_salary), 0) as total_gross,
        COALESCE(SUM(ps.net_pay), 0) as total_net,
        COALESCE(AVG(ps.gross_salary), 0) as avg_gross
      FROM payslips ps
      JOIN employees e ON ps.employee_id = e.id
      WHERE ps.month_year = ? ${department ? 'AND e.department_id = ?' : ''}
    `, department ? [currentMonth, department] : [currentMonth]);

    // Fallback to active employees' base gross if no payslip generated yet for this month
    let payrollCost = payrollStats ? payrollStats.total_gross : 0;
    let avgSalary = payrollStats ? Math.round(payrollStats.avg_gross) : 0;

    if (payrollCost === 0 && activeHeadcount > 0) {
      const fallbackGross = db.queryOne(`
        SELECT SUM(gross_salary) as total, AVG(gross_salary) as avg 
        FROM employees e ${empFilter}
      `, empParams);
      payrollCost = fallbackGross ? (fallbackGross.total || 0) : 0;
      avgSalary = fallbackGross ? Math.round(fallbackGross.avg || 0) : 0;
    }

    // Headcount by department
    const deptHeadcounts = db.query(`
      SELECT d.id, d.name, COUNT(e.id) as headcount
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id AND e.status != 'exited'
      GROUP BY d.id, d.name
      ORDER BY headcount DESC
    `);

    // Payroll cost by department
    const deptPayroll = db.query(`
      SELECT d.name, COALESCE(SUM(e.gross_salary), 0) as total_payroll, AVG(e.gross_salary) as avg_payroll
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id AND e.status != 'exited'
      GROUP BY d.id, d.name
      ORDER BY total_payroll DESC
    `);

    // Gender breakdown
    const genderDist = db.query(`
      SELECT gender, COUNT(*) as count 
      FROM employees e
      ${empFilter}
      GROUP BY gender
    `, empParams);

    // Tenure distribution
    const employeesAll = db.query(`SELECT joining_date FROM employees e ${empFilter}`, empParams);
    const tenureDist = { '< 1 year': 0, '1 - 3 years': 0, '3+ years': 0 };
    const nowMs = Date.now();
    employeesAll.forEach(e => {
      const joinMs = new Date(e.joining_date).getTime();
      const years = (nowMs - joinMs) / (1000 * 60 * 60 * 24 * 365.25);
      if (years < 1) tenureDist['< 1 year']++;
      else if (years <= 3) tenureDist['1 - 3 years']++;
      else tenureDist['3+ years']++;
    });

    // Recent Audit Logs Feed
    const recentAudit = db.query(`
      SELECT id, actor_email, actor_role, action, entity, entity_id, created_at
      FROM audit_logs
      ORDER BY id DESC LIMIT 10
    `);

    // Announcements
    const announcements = db.query(`SELECT * FROM announcements ORDER BY id DESC LIMIT 5`);

    res.json({
      kpis: {
        headcount: activeHeadcount,
        attritionRate: `${attritionRate}%`,
        payrollCost: payrollCost,
        avgSalary: avgSalary
      },
      headcountByDept: deptHeadcounts,
      payrollByDept: deptPayroll,
      genderDistribution: genderDist,
      tenureDistribution: tenureDist,
      recentAudit,
      announcements
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getHRDashboard(req, res) {
  try {
    const { department = '', date = getTodayString() } = req.query;
    const db = await getDatabase();
    const today = date;

    // Headcount
    let empFilter = "WHERE e.status != 'exited'";
    const empParams = [];
    if (department) {
      empFilter += " AND e.department_id = ?";
      empParams.push(department);
    }
    const headcountRow = db.queryOne(`SELECT COUNT(*) as count FROM employees e ${empFilter}`, empParams);
    const headcount = headcountRow ? headcountRow.count : 0;

    // Today's attendance
    const attendanceToday = db.query(`
      SELECT a.status, a.work_hours, e.department_id, e.id as emp_id
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.date = ? ${department ? 'AND e.department_id = ?' : ''}
    `, department ? [today, department] : [today]);

    let presentToday = 0;
    let lateToday = 0;
    let halfDayToday = 0;

    attendanceToday.forEach(a => {
      if (a.status === 'present') presentToday++;
      else if (a.status === 'late') { presentToday++; lateToday++; }
      else if (a.status === 'half_day') halfDayToday++;
    });

    // On leave today
    const leavesToday = db.queryOne(`
      SELECT COUNT(*) as count 
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE lr.status = 'approved' AND ? BETWEEN lr.start_date AND lr.end_date
      ${department ? 'AND e.department_id = ?' : ''}
    `, department ? [today, department] : [today]);
    const onLeaveToday = leavesToday ? leavesToday.count : 0;

    // Pending approvals (leaves + attendance corrections)
    const pendingLeaves = db.queryOne("SELECT COUNT(*) as count FROM leave_requests WHERE status = 'pending'");
    const pendingCorrections = db.queryOne("SELECT COUNT(*) as count FROM attendance_corrections WHERE status = 'pending'");
    const pendingApprovals = (pendingLeaves ? pendingLeaves.count : 0) + (pendingCorrections ? pendingCorrections.count : 0);

    // Attendance Trend (Last 7 days)
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const dayStats = db.queryOne(`
        SELECT 
          COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) as present_count,
          COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count
        FROM attendance a
        JOIN employees e ON a.employee_id = e.id
        WHERE a.date = ? ${department ? 'AND e.department_id = ?' : ''}
      `, department ? [dStr, department] : [dStr]);

      trend.push({
        date: dStr,
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        present: dayStats ? dayStats.present_count : 0,
        late: dayStats ? dayStats.late_count : 0
      });
    }

    // Top 5 Late Comers this month
    const monthPrefix = today.slice(0, 7);
    const topLateComers = db.query(`
      SELECT e.id, e.employee_code, e.first_name, e.last_name, d.name as department_name,
             COUNT(*) as late_count
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE a.date LIKE ? AND a.status = 'late'
      ${department ? 'AND e.department_id = ?' : ''}
      GROUP BY e.id
      ORDER BY late_count DESC
      LIMIT 5
    `, department ? [`${monthPrefix}%`, department] : [`${monthPrefix}%`]);

    // Leave utilization by type
    const leaveTypes = db.query("SELECT * FROM leave_types WHERE is_unpaid = 0");
    const leaveByType = leaveTypes.map(lt => {
      const approvedRow = db.queryOne(`
        SELECT COALESCE(SUM(lr.days_count), 0) as total_approved
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        WHERE lr.leave_type_id = ? AND lr.status = 'approved' AND lr.start_date LIKE ?
        ${department ? 'AND e.department_id = ?' : ''}
      `, department ? [lt.id, `${monthPrefix}%`, department] : [lt.id, `${monthPrefix}%`]);

      const approvedDays = approvedRow ? approvedRow.total_approved : 0;
      return {
        type: lt.name,
        approvedDays,
        quota: lt.yearly_quota
      };
    });

    // Absenteeism by department formula: absent days / expected working days
    const deptAbsenteeism = db.query(`
      SELECT d.name as department_name,
        COUNT(DISTINCT e.id) as emp_count,
        (SELECT COUNT(*) FROM attendance a2 JOIN employees e2 ON a2.employee_id = e2.id WHERE e2.department_id = d.id AND a2.date LIKE ? AND a2.status = 'late') as late_count
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id AND e.status != 'exited'
      GROUP BY d.id, d.name
    `, [`${monthPrefix}%`]);

    res.json({
      kpis: {
        headcount,
        presentToday,
        onLeaveToday,
        lateToday,
        pendingApprovals
      },
      attendanceTrend: trend,
      topLateComers,
      leaveByType,
      deptAbsenteeism
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getEmployeeDashboard(req, res) {
  try {
    const employeeId = req.user.employee_id;
    if (!employeeId) return res.status(400).json({ error: 'No employee record associated with this account.' });

    const db = await getDatabase();
    const today = getTodayString();
    const monthPrefix = today.slice(0, 7);

    // Today's record
    const todayAttendance = db.queryOne("SELECT * FROM attendance WHERE employee_id = ? AND date = ?", [employeeId, today]);

    // Hours this week
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); // Monday
    const startOfWeekStr = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;

    const weekRows = db.query(`
      SELECT COALESCE(SUM(work_hours), 0) as total_hours 
      FROM attendance 
      WHERE employee_id = ? AND date >= ?
    `, [employeeId, startOfWeekStr]);
    const weeklyHours = weekRows ? Math.round(weekRows[0].total_hours * 10) / 10 : 0;

    // Late count this month
    const lateRow = db.queryOne(`
      SELECT COUNT(*) as count 
      FROM attendance 
      WHERE employee_id = ? AND date LIKE ? AND status = 'late'
    `, [employeeId, `${monthPrefix}%`]);
    const lateCount = lateRow ? lateRow.count : 0;

    // Leave balances
    const leaveTypes = db.query("SELECT * FROM leave_types ORDER BY id ASC");
    const leaveBalances = leaveTypes.map(lt => {
      const usedRow = db.queryOne(`
        SELECT COALESCE(SUM(days_count), 0) as used
        FROM leave_requests
        WHERE employee_id = ? AND leave_type_id = ? AND status = 'approved'
      `, [employeeId, lt.id]);
      const used = usedRow ? usedRow.used : 0;
      return {
        id: lt.id,
        name: lt.name,
        quota: lt.yearly_quota,
        used,
        remaining: lt.is_unpaid ? 'Unlimited' : Math.max(0, lt.yearly_quota - used)
      };
    });

    // Last finalized payslip
    const lastPayslip = db.queryOne(`
      SELECT ps.*, pr.status as run_status
      FROM payslips ps
      JOIN payroll_runs pr ON ps.payroll_run_id = pr.id
      WHERE ps.employee_id = ? AND pr.status = 'finalized'
      ORDER BY ps.month_year DESC LIMIT 1
    `, [employeeId]);

    // Announcements
    const announcements = db.query(`SELECT * FROM announcements ORDER BY id DESC LIMIT 5`);

    res.json({
      todayAttendance,
      weeklyHours,
      targetHours: 40,
      lateCount,
      leaveBalances,
      lastPayslip,
      announcements
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAdminDashboard,
  getHRDashboard,
  getEmployeeDashboard
};
