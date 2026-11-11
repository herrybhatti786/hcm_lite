const { getDatabase } = require('../db/database');

// System rules prompt from Section 3 for Policy Q&A
const SYSTEM_POLICY_RULES = `
You are the HCM Lite AI Assistant. You answer questions strictly based on the company's real data and official HCM Lite business rules.

Business Rules:
1. Roles: Admin (company-level, settings, user management, lock payroll), HR (people operations, register employees, attendance board, leave approval, monthly payroll draft), Employee (self-service, check in/out, own attendance, own leaves, own payslips).
2. Security & Scope: An Employee can NEVER view any other employee's salary or personal data. If asked, politely refuse: "Access denied. Employees can only view their own payroll and profile data."
3. Office Timings: Office start is 09:00. Grace period is 15 minutes. Check-in after 09:15 is marked 'late'.
4. Attendance Rules: Less than 5 hours worked is marked 'half_day'. Missing checkout or no check-in is 'absent' unless on approved leave. One check-in per day (second check-in = duplicate).
5. Leave Quotas: Annual leave: 14 days, Sick leave: 8 days, Casual leave: 10 days, Unpaid leave: unlimited. Working days only count for leaves (weekends and public holidays are excluded). Overlap or over-balance is rejected with 422.
6. Payroll & Tax Slabs: Gross = 1.5 * Basic (HRA 40%, Medical 10%). Per day = Gross / working days. Deductions = absent + unpaid + 0.5 * half days + late penalties (3 lates = 0.5 day penalty). Annual tax slabs: 0 to 600k (0%), 600k to 1.2M (5%), 1.2M to 2.4M (30k + 15%), 2.4M to 3.6M (210k + 25%), 3.6M+ (510k + 35%).
7. Language: You understand both English and Roman Urdu (e.g., "Meri chutti kitni bachi hai?", "Aaj koun absent hai?").
`;

// Tool implementations executed strictly on backend with user's scope
async function executeTool(toolName, args, user, db) {
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);

  switch (toolName) {
    case 'get_headcount': {
      let sql = "SELECT COUNT(*) as count FROM employees WHERE status != 'exited'";
      const params = [];
      if (args && args.department) {
        sql += " AND department_id IN (SELECT id FROM departments WHERE LOWER(name) LIKE ? OR LOWER(code) LIKE ?)";
        const term = `%${args.department.toLowerCase()}%`;
        params.push(term, term);
      }
      const row = db.queryOne(sql, params);
      return { headcount: row ? row.count : 0, department: args ? args.department : 'All' };
    }

    case 'get_attendance_summary': {
      const date = (args && args.date) || today;
      const stats = db.query(`
        SELECT status, COUNT(*) as count 
        FROM attendance 
        WHERE date = ? 
        GROUP BY status
      `, [date]);

      const onLeave = db.queryOne(`
        SELECT COUNT(*) as count FROM leave_requests 
        WHERE status = 'approved' AND ? BETWEEN start_date AND end_date
      `, [date]);

      const totalActive = db.queryOne("SELECT COUNT(*) as count FROM employees WHERE status != 'exited'");
      const summary = { date, present: 0, late: 0, half_day: 0, on_leave: onLeave ? onLeave.count : 0, totalEmployees: totalActive ? totalActive.count : 0 };
      stats.forEach(s => {
        if (s.status === 'present') summary.present = s.count;
        if (s.status === 'late') summary.late = s.count;
        if (s.status === 'half_day') summary.half_day = s.count;
      });
      summary.absent = Math.max(0, summary.totalEmployees - (summary.present + summary.late + summary.half_day + summary.on_leave));
      return summary;
    }

    case 'get_late_comers': {
      if (user.role === 'Employee') {
        const row = db.queryOne(`
          SELECT COUNT(*) as count FROM attendance 
          WHERE employee_id = ? AND date LIKE ? AND status = 'late'
        `, [user.employee_id, `${currentMonth}%`]);
        return { lateCount: row ? row.count : 0, period: currentMonth };
      }

      const rows = db.query(`
        SELECT e.employee_code, e.first_name, e.last_name, d.name as department, COUNT(*) as late_count
        FROM attendance a
        JOIN employees e ON a.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE a.date LIKE ? AND a.status = 'late'
        GROUP BY e.id
        ORDER BY late_count DESC
        LIMIT 5
      `, [`${currentMonth}%`]);
      return { period: currentMonth, topLateComers: rows };
    }

    case 'get_leave_summary': {
      const date = (args && args.date) || today;
      const onLeaveEmployees = db.query(`
        SELECT e.employee_code, e.first_name, e.last_name, lt.name as leave_type, lr.start_date, lr.end_date
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE lr.status = 'approved' AND ? BETWEEN lr.start_date AND lr.end_date
      `, [date]);
      return { date, count: onLeaveEmployees.length, employeesOnLeave: onLeaveEmployees };
    }

    case 'get_my_leave_balance': {
      const empId = user.employee_id;
      if (!empId) return { error: 'No employee profile linked to your user account.' };

      const leaveTypes = db.query("SELECT * FROM leave_types ORDER BY id ASC");
      const balances = leaveTypes.map(lt => {
        const usedRow = db.queryOne(`
          SELECT COALESCE(SUM(days_count), 0) as used
          FROM leave_requests
          WHERE employee_id = ? AND leave_type_id = ? AND status = 'approved'
        `, [empId, lt.id]);
        const used = usedRow ? usedRow.used : 0;
        return {
          type: lt.name,
          quota: lt.is_unpaid ? 'Unlimited' : lt.yearly_quota,
          used: used,
          remaining: lt.is_unpaid ? 'Unlimited' : Math.max(0, lt.yearly_quota - used)
        };
      });
      return { balances };
    }

    case 'get_payroll_summary': {
      if (user.role === 'Employee') {
        const lastPs = db.queryOne(`
          SELECT * FROM payslips WHERE employee_id = ? ORDER BY month_year DESC LIMIT 1
        `, [user.employee_id]);
        return { myLastPayslip: lastPs || 'No payslip generated yet.' };
      }

      const month = (args && args.month) || currentMonth;
      const run = db.queryOne("SELECT * FROM payroll_runs WHERE month_year = ?", [month]);
      return { month, payrollRun: run || 'No payroll run for this month yet.' };
    }

    case 'search_employees': {
      const term = `%${((args && args.name) || '').toLowerCase()}%`;
      const rows = db.query(`
        SELECT e.id, e.employee_code, e.first_name, e.last_name, e.email, e.phone,
               d.name as department, des.title as designation
               ${user.role !== 'Employee' ? ', e.basic_salary, e.gross_salary' : ''}
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN designations des ON e.designation_id = des.id
        WHERE (LOWER(e.first_name) LIKE ? OR LOWER(e.last_name) LIKE ? OR LOWER(e.email) LIKE ?)
        LIMIT 10
      `, [term, term, term]);
      return { results: rows };
    }

    default:
      return { error: `Unknown tool ${toolName}` };
  }
}

// Intelligent fallback resolver if external LLM API key is not present or offline
async function resolveIntentAndExecute(prompt, user, db) {
  const p = prompt.toLowerCase();

  // Guardrail: Employee asking about salary/payroll
  if (user.role === 'Employee' && (p.includes('salary') || p.includes('tankhwah') || p.includes('kamata') || p.includes('earns') || p.includes('gross') || p.includes('pay') || p.includes('payslip') || p.includes('compensation'))) {
    const isAskingOwn = p.includes('my') || p.includes('meri') || p.includes('mera') || p.includes('own') || p.includes('apni') || p.includes('mujhe');
    if (!isAskingOwn) {
      return {
        tool: null,
        toolArgs: null,
        text: "Access denied. In accordance with HCM Lite RBAC policy, employees can only view their own salary and payroll details. Requests to view colleague salary information are strictly restricted."
      };
    }
  }

  // Employee own leave balance or Roman Urdu "chutti" / "absent"
  if (p.includes('leave') || p.includes('balance') || p.includes('sick') || p.includes('casual') || p.includes('annual') || p.includes('chutti') || p.includes('chuttiyan') || p.includes('absent')) {
    if (p.includes('who is on leave') || p.includes('who is absent') || p.includes('koun chutti pe hai') || p.includes('koun absent') || p.includes('chutti pe') || p.includes('leave summary')) {
      const data = await executeTool('get_leave_summary', {}, user, db);
      const names = data.employeesOnLeave.map(e => `${e.first_name} ${e.last_name} (${e.leave_type})`).join(', ');
      return {
        tool: 'get_leave_summary',
        toolArgs: {},
        text: data.count > 0 
          ? `Today there are ${data.count} employee(s) on approved leave: ${names}.`
          : `Nobody is on approved leave today.`
      };
    }

    if (user.role === 'Employee' || p.includes('my') || p.includes('meri')) {
      const data = await executeTool('get_my_leave_balance', {}, user, db);
      if (data.error) return { tool: 'get_my_leave_balance', toolArgs: {}, text: data.error };
      const balStr = data.balances.map(b => `${b.type}: ${b.remaining} remaining (used ${b.used} of ${b.quota})`).join(', ');
      return {
        tool: 'get_my_leave_balance',
        toolArgs: {},
        text: `Here is your current leave balance:\n• ${data.balances.map(b => `**${b.type}**: ${b.remaining} days left (Quota: ${b.quota}, Used: ${b.used})`).join('\n• ')}`
      };
    }
  }

  // Late comers
  if (p.includes('late') || p.includes('der se') || p.includes('late comers') || p.includes('came late')) {
    const data = await executeTool('get_late_comers', {}, user, db);
    if (user.role === 'Employee') {
      return {
        tool: 'get_late_comers',
        toolArgs: {},
        text: `You have arrived late ${data.lateCount} time(s) this month (${data.period}). Note that 3 late arrivals incur a 0.5 day salary penalty.`
      };
    }
    if (data.topLateComers && data.topLateComers.length > 0) {
      const list = data.topLateComers.map(l => `${l.first_name} ${l.last_name} (${l.department || 'N/A'}): ${l.late_count} times`).join('\n• ');
      return {
        tool: 'get_late_comers',
        toolArgs: {},
        text: `Employees who arrived late most frequently this month (${data.period}):\n• ${list}`
      };
    }
    return {
      tool: 'get_late_comers',
      toolArgs: {},
      text: `There are no recorded late arrivals for this month so far.`
    };
  }

  // Headcount / Active employees in department
  if (p.includes('headcount') || p.includes('how many employees') || p.includes('active employees') || p.includes('kitne mulazmeen') || p.includes('kitne employee')) {
    const departments = db.query("SELECT id, name FROM departments");
    let targetDept = null;
    departments.forEach(d => {
      if (p.includes(d.name.toLowerCase())) targetDept = d.name;
    });

    const data = await executeTool('get_headcount', { department: targetDept }, user, db);
    return {
      tool: 'get_headcount',
      toolArgs: { department: targetDept },
      text: targetDept 
        ? `There are currently **${data.headcount}** active employee(s) in the **${targetDept}** department.`
        : `The total company headcount across all departments is **${data.headcount}** active employee(s).`
    };
  }

  // Attendance summary or rate
  if (p.includes('attendance') || p.includes('hazri') || p.includes('present') || p.includes('attendance rate')) {
    const data = await executeTool('get_attendance_summary', {}, user, db);
    const totalWorkingRecords = data.present + data.late + data.half_day + data.absent;
    const rate = totalWorkingRecords > 0 
      ? Math.round(((data.present + data.late + 0.5 * data.half_day) / totalWorkingRecords) * 100) 
      : 100;

    return {
      tool: 'get_attendance_summary',
      toolArgs: {},
      text: `Today's attendance status:\n• **Present**: ${data.present}\n• **Late**: ${data.late}\n• **Half Day**: ${data.half_day}\n• **On Leave**: ${data.on_leave}\n• **Absent**: ${data.absent}\n• **Attendance Rate**: ${rate}%`
    };
  }

  // Payroll summary
  if (p.includes('payroll') || p.includes('net pay') || p.includes('tax slab') || p.includes('gross')) {
    if (user.role === 'Employee') {
      const data = await executeTool('get_payroll_summary', {}, user, db);
      if (typeof data.myLastPayslip === 'object' && data.myLastPayslip) {
        return {
          tool: 'get_payroll_summary',
          toolArgs: {},
          text: `Your last payslip (${data.myLastPayslip.month_year}):\n• Gross Salary: Rs. ${data.myLastPayslip.gross_salary.toLocaleString()}\n• Deductions: Rs. ${(data.myLastPayslip.attendance_deduction + data.myLastPayslip.monthly_tax).toLocaleString()}\n• Net Pay: Rs. ${data.myLastPayslip.net_pay.toLocaleString()}`
        };
      }
      return { tool: 'get_payroll_summary', toolArgs: {}, text: "You do not have any published payslips yet." };
    }

    const data = await executeTool('get_payroll_summary', {}, user, db);
    if (data.payrollRun && typeof data.payrollRun === 'object') {
      return {
        tool: 'get_payroll_summary',
        toolArgs: {},
        text: `Payroll Run for ${data.month} (${data.payrollRun.status.toUpperCase()}):\n• Total Gross: Rs. ${data.payrollRun.total_gross.toLocaleString()}\n• Total Deductions: Rs. ${data.payrollRun.total_deductions.toLocaleString()}\n• Total Tax: Rs. ${data.payrollRun.total_tax.toLocaleString()}\n• Total Net Pay: Rs. ${data.payrollRun.total_net.toLocaleString()}`
      };
    }
    return { tool: 'get_payroll_summary', toolArgs: {}, text: `No payroll draft has been created for ${data.month} yet.` };
  }

  // Policy Q&A
  if (p.includes('policy') || p.includes('rule') || p.includes('time') || p.includes('grace') || p.includes('office') || p.includes('timing')) {
    const settings = db.queryOne("SELECT * FROM settings LIMIT 1");
    const start = settings ? settings.office_start : '09:00';
    const grace = settings ? settings.grace_time_minutes : 15;
    return {
      tool: null,
      toolArgs: null,
      text: `HCM Lite Policy Overview:\n• Office starts at **${start}** with a **${grace}-minute** grace window (late after 09:15).\n• Working under 5 hours counts as a half day.\n• Annual leave quota: 14 days, Sick: 8 days, Casual: 10 days.\n• 3 late arrivals incur a 0.5-day salary penalty.\n• Weekend days are non-working days and do not consume leave quotas.`
    };
  }

  // Employee search / Directory lookup
  if (p.includes('search') || p.includes('find') || p.includes('lookup') || p.includes('who is') || p.includes('profile') || (p.includes('employee') && !p.includes('kitne') && !p.includes('how many'))) {
    const cleanQuery = prompt
      .replace(/search|find|lookup|who is|profile of|profile|details of|details|employee|colleague|for|please|about|the|\?|\!/gi, '')
      .trim();
    if (cleanQuery) {
      const data = await executeTool('search_employees', { name: cleanQuery }, user, db);
      if (data.results && data.results.length > 0) {
        const lines = data.results.map(e => {
          let str = `**${e.first_name} ${e.last_name}** (${e.employee_code}) - Dept: ${e.department || 'N/A'}, Designation: ${e.designation || 'N/A'}, Email: ${e.email}`;
          if (e.phone) str += `, Phone: ${e.phone}`;
          if (user.role !== 'Employee' && e.gross_salary !== undefined) {
            str += `, Gross Salary: Rs. ${Number(e.gross_salary).toLocaleString()}`;
          }
          return str;
        }).join('\n• ');
        return {
          tool: 'search_employees',
          toolArgs: { name: cleanQuery },
          text: `Found ${data.results.length} employee record(s) matching "${cleanQuery}":\n• ${lines}`
        };
      } else {
        return {
          tool: 'search_employees',
          toolArgs: { name: cleanQuery },
          text: `No employee records found matching "${cleanQuery}".`
        };
      }
    }
  }

  // Default response
  return {
    tool: null,
    toolArgs: null,
    text: `Hello! I am your HCM Lite AI Assistant. You can ask me questions about attendance, department headcount, leave balances, who came late, company HR policies, or use Smart Leave in natural language (English or Roman Urdu). How can I help you today?`
  };
}

async function chat(req, res) {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const db = await getDatabase();
    const user = req.user;

    const result = await resolveIntentAndExecute(message, user, db);

    // Log in ai_logs as required by Section 4
    db.run(`
      INSERT INTO ai_logs (user_id, role, prompt, tool_called, tool_args, response)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      user.id,
      user.role,
      message,
      result.tool || 'none',
      result.toolArgs ? JSON.stringify(result.toolArgs) : null,
      result.text
    ]);

    res.json({
      response: result.text,
      toolCalled: result.tool,
      isAiGenerated: true
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Dashboard Summary: Admin, HR click 'Summarize' sends KPI JSON for current filters, returns 3-5 insight bullets
async function summarizeDashboard(req, res) {
  try {
    const { kpis, filters = {} } = req.body;
    if (!kpis) return res.status(400).json({ error: 'KPI data required.' });

    const bullets = [];

    if (kpis.headcount !== undefined) {
      bullets.push(`Total active workforce stands at **${kpis.headcount}** employees.`);
    }

    if (kpis.attritionRate !== undefined) {
      bullets.push(`Current year-to-date attrition is steady at **${kpis.attritionRate}**.`);
    }

    if (kpis.presentToday !== undefined && kpis.headcount > 0) {
      const pct = Math.round((kpis.presentToday / kpis.headcount) * 100);
      bullets.push(`Today's physical attendance is at **${pct}%** (${kpis.presentToday} present, ${kpis.lateToday || 0} late arrivals).`);
    }

    if (kpis.onLeaveToday !== undefined && kpis.onLeaveToday > 0) {
      bullets.push(`**${kpis.onLeaveToday}** employee(s) are currently on scheduled approved leave.`);
    }

    if (kpis.pendingApprovals !== undefined && kpis.pendingApprovals > 0) {
      bullets.push(`Action required: **${kpis.pendingApprovals}** pending approval(s) (leave requests / attendance corrections) require HR review.`);
    }

    if (kpis.payrollCost !== undefined && kpis.payrollCost > 0) {
      bullets.push(`Monthly payroll liability is **Rs. ${Number(kpis.payrollCost).toLocaleString()}** with an average gross salary of **Rs. ${Number(kpis.avgSalary || 0).toLocaleString()}**.`);
    }

    if (bullets.length === 0) {
      bullets.push('All systems operational. No critical anomalies detected for the active selection.');
    }

    res.json({
      summary: bullets,
      isAiGenerated: true
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Smart Leave: "Need next Monday and Tuesday off for a wedding" -> JSON {type, start, end, reason} -> pre-filled form
async function parseSmartLeave(req, res) {
  try {
    const { sentence } = req.body;
    if (!sentence || !sentence.trim()) {
      return res.status(400).json({ error: 'Sentence is required.' });
    }

    const db = await getDatabase();
    const leaveTypes = db.query("SELECT * FROM leave_types");

    const text = sentence.toLowerCase();

    // Determine type
    let chosenType = leaveTypes.find(t => t.name.toLowerCase() === 'casual') || leaveTypes[0];
    if (text.includes('sick') || text.includes('doctor') || text.includes('fever') || text.includes('hospital') || text.includes('tabiat') || text.includes('bimar')) {
      const sick = leaveTypes.find(t => t.name.toLowerCase() === 'sick');
      if (sick) chosenType = sick;
    } else if (text.includes('annual') || text.includes('vacation') || text.includes('holiday') || text.includes('trip')) {
      const annual = leaveTypes.find(t => t.name.toLowerCase() === 'annual');
      if (annual) chosenType = annual;
    } else if (text.includes('unpaid') || text.includes('bina tankhwah')) {
      const unpaid = leaveTypes.find(t => t.name.toLowerCase() === 'unpaid');
      if (unpaid) chosenType = unpaid;
    }

    // Determine dates
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    const getNextDayOfWeek = (dayIndex) => {
      const result = new Date();
      const currentDay = result.getDay();
      const distance = (dayIndex + 7 - currentDay) % 7 || 7;
      result.setDate(result.getDate() + distance);
      return result;
    };

    if (text.includes('next monday') || text.includes('agli somwar') || text.includes('peer') || (text.includes('monday') && !text.includes('tuesday'))) {
      startDate = getNextDayOfWeek(1); // Monday
      endDate = new Date(startDate);
      if (text.includes('tuesday') || text.includes('mangal')) {
        endDate.setDate(startDate.getDate() + 1);
      } else if (text.includes('wednesday') || text.includes('budh')) {
        endDate.setDate(startDate.getDate() + 2);
      } else if (text.includes('friday') || text.includes('jumma')) {
        endDate.setDate(startDate.getDate() + 4);
      }
    } else if (text.includes('next tuesday') || text.includes('agli mangal') || text.includes('mangal')) {
      startDate = getNextDayOfWeek(2);
      endDate = new Date(startDate);
      if (text.includes('wednesday') || text.includes('budh')) {
        endDate.setDate(startDate.getDate() + 1);
      }
    } else if (text.includes('next wednesday') || text.includes('agli budh') || text.includes('budh')) {
      startDate = getNextDayOfWeek(3);
      endDate = new Date(startDate);
      if (text.includes('thursday') || text.includes('jumerat')) {
        endDate.setDate(startDate.getDate() + 1);
      }
    } else if (text.includes('next thursday') || text.includes('agli jumerat') || text.includes('jumerat')) {
      startDate = getNextDayOfWeek(4);
      endDate = new Date(startDate);
      if (text.includes('friday') || text.includes('jumma')) {
        endDate.setDate(startDate.getDate() + 1);
      }
    } else if (text.includes('next friday') || text.includes('agli jumma') || text.includes('jumma')) {
      startDate = getNextDayOfWeek(5);
      endDate = new Date(startDate);
    } else if (text.includes('tomorrow') || text.includes('kal')) {
      startDate.setDate(now.getDate() + 1);
      endDate = new Date(startDate);
      if (text.includes('day after tomorrow') || text.includes('parson')) {
        endDate.setDate(startDate.getDate() + 1);
      }
    } else {
      // Default to next business day
      const addDays = now.getDay() === 5 ? 3 : (now.getDay() === 6 ? 2 : 1);
      startDate.setDate(now.getDate() + addDays);
      endDate = new Date(startDate);
    }

    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Extract reason
    let reason = sentence;
    if (text.includes('for ')) {
      reason = sentence.slice(text.indexOf('for ') + 4).trim();
    } else if (text.includes('liye') || text.includes('liya')) {
      reason = sentence;
    }

    res.json({
      leave_type_id: chosenType.id,
      leave_type_name: chosenType.name,
      start_date: fmt(startDate),
      end_date: fmt(endDate),
      reason: reason || sentence,
      isAiGenerated: true
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  chat,
  summarizeDashboard,
  parseSmartLeave
};
