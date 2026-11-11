const bcrypt = require('bcryptjs');
const { getDatabase } = require('../db/database');
const { logAuditAction } = require('../middleware/auditMiddleware');
const { calculateSalaryBreakdown } = require('../utils/taxCalculator');
const { createNotification } = require('../utils/notificationService');

async function getEmployees(req, res) {
  try {
    const db = await getDatabase();
    const { search = '', department = '', status = '', page = 1, limit = 50 } = req.query;

    // Scope check: If Employee, they can only request their own profile
    if (req.user.role === 'Employee') {
      const row = db.queryOne(`
        SELECT e.*, d.name as department_name, des.title as designation_title,
               u.email as user_email, u.is_active as user_active
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN designations des ON e.designation_id = des.id
        LEFT JOIN users u ON u.employee_id = e.id
        WHERE e.id = ?
      `, [req.user.employee_id]);
      return res.json({ employees: row ? [row] : [], total: row ? 1 : 0 });
    }

    let sql = `
      SELECT e.*, d.name as department_name, des.title as designation_title,
             u.id as user_id, u.email as user_email, u.is_active as user_active
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN users u ON u.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];

    if (search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      sql += ` AND (LOWER(e.first_name) LIKE ? OR LOWER(e.last_name) LIKE ? OR LOWER(e.email) LIKE ? OR LOWER(e.employee_code) LIKE ?)`;
      params.push(q, q, q, q);
    }

    if (department) {
      sql += ` AND e.department_id = ?`;
      params.push(department);
    }

    if (status) {
      sql += ` AND e.status = ?`;
      params.push(status);
    }

    // Get count
    const countSql = `SELECT COUNT(*) as count FROM (${sql})`;
    const countRes = db.queryOne(countSql, params);
    const total = countRes ? countRes.count : 0;

    sql += ` ORDER BY e.id DESC LIMIT ? OFFSET ?`;
    const offset = (Number(page) - 1) * Number(limit);
    params.push(Number(limit), Number(offset));

    const rows = db.query(sql, params);
    res.json({ employees: rows, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getEmployeeById(req, res) {
  try {
    const { id } = req.params;
    const db = await getDatabase();

    // Data-scope guard: Employee can only see own record
    if (req.user.role === 'Employee' && Number(req.user.employee_id) !== Number(id)) {
      return res.status(403).json({ error: 'Access denied. You cannot view other employees\' profiles.' });
    }

    const emp = db.queryOne(`
      SELECT e.*, d.name as department_name, des.title as designation_title,
             u.id as user_id, u.email as user_email, u.is_active as user_active
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN users u ON u.employee_id = e.id
      WHERE e.id = ?
    `, [id]);

    if (!emp) return res.status(404).json({ error: 'Employee not found.' });

    // Include 360 overview: leave balances, recent attendance, recent payslips
    const leaveTypes = db.query("SELECT * FROM leave_types");
    const leaveBalances = leaveTypes.map(lt => {
      const usedRow = db.queryOne(`
        SELECT COALESCE(SUM(days_count), 0) as used
        FROM leave_requests
        WHERE employee_id = ? AND leave_type_id = ? AND status = 'approved'
      `, [id, lt.id]);
      const used = usedRow ? usedRow.used : 0;
      return {
        id: lt.id,
        name: lt.name,
        quota: lt.yearly_quota,
        used: used,
        remaining: lt.is_unpaid ? 'Unlimited' : Math.max(0, lt.yearly_quota - used)
      };
    });

    const recentAttendance = db.query(`
      SELECT * FROM attendance WHERE employee_id = ? ORDER BY date DESC LIMIT 15
    `, [id]);

    const recentLeaves = db.query(`
      SELECT lr.*, lt.name as leave_type_name
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.employee_id = ?
      ORDER BY lr.start_date DESC LIMIT 10
    `, [id]);

    let payslips = [];
    // Only return salary/payslips to Admin, HR, or the employee himself!
    if (req.user.role !== 'Employee' || Number(req.user.employee_id) === Number(id)) {
      payslips = db.query(`
        SELECT * FROM payslips WHERE employee_id = ? ORDER BY month_year DESC
      `, [id]);
    }

    res.json({
      employee: emp,
      leaveBalances,
      recentAttendance,
      recentLeaves,
      payslips
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function registerEmployee(req, res) {
  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      address,
      gender,
      department_id,
      designation_id,
      joining_date,
      basic_salary,
      temporary_password
    } = req.body;

    if (!first_name || !last_name || !email || !joining_date || !basic_salary) {
      return res.status(400).json({ error: 'First name, last name, email, joining date, and basic salary are required.' });
    }

    const basic = Number(basic_salary);
    if (isNaN(basic) || basic <= 0) {
      return res.status(400).json({ error: 'Basic salary must be greater than 0.' });
    }

    const db = await getDatabase();

    // Check unique email in employees and users
    const existingEmp = db.queryOne("SELECT id FROM employees WHERE email = ?", [email.trim().toLowerCase()]);
    const existingUser = db.queryOne("SELECT id FROM users WHERE email = ?", [email.trim().toLowerCase()]);
    if (existingEmp || existingUser) {
      return res.status(400).json({ error: 'An employee or user with this email already exists.' });
    }

    // Auto-generate employee code (e.g. EMP-001, EMP-002)
    const lastEmp = db.queryOne("SELECT id FROM employees ORDER BY id DESC LIMIT 1");
    let nextNum = (lastEmp ? lastEmp.id : 0) + 1;
    let employee_code = `EMP-${String(nextNum).padStart(3, '0')}`;
    while (db.queryOne("SELECT id FROM employees WHERE employee_code = ?", [employee_code])) {
      nextNum++;
      employee_code = `EMP-${String(nextNum).padStart(3, '0')}`;
    }

    // Validate foreign keys safely for serverless / multi-instance cold starts
    let validDeptId = null;
    if (department_id) {
      const deptExists = db.queryOne("SELECT id FROM departments WHERE id = ?", [department_id]);
      if (deptExists) validDeptId = department_id;
    }

    let validDesigId = null;
    if (designation_id) {
      const desigExists = db.queryOne("SELECT id FROM designations WHERE id = ?", [designation_id]);
      if (desigExists) validDesigId = designation_id;
    }

    // Calculate salary components: Gross = 1.5 * basic (HRA 40%, Medical 10%)
    const salaryInfo = calculateSalaryBreakdown(basic);

    // Insert employee
    const empRes = db.run(`
      INSERT INTO employees (
        employee_code, first_name, last_name, email, phone, address, gender,
        department_id, designation_id, joining_date, status,
        basic_salary, hra, medical_allowance, gross_salary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
    `, [
      employee_code,
      first_name.trim(),
      last_name.trim(),
      email.trim().toLowerCase(),
      phone || '',
      address || '',
      gender || 'Other',
      validDeptId,
      validDesigId,
      joining_date,
      salaryInfo.basic,
      salaryInfo.hra,
      salaryInfo.medical,
      salaryInfo.gross
    ]);

    const employeeId = empRes.lastInsertRowid;

    // Create user login with temporary password (must change on first sign-in)
    const tempPassword = temporary_password || 'Welcome@123';
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(tempPassword, salt);

    const userRes = db.run(`
      INSERT INTO users (email, password_hash, role, employee_id, must_change_password, is_active)
      VALUES (?, ?, 'Employee', ?, 1, 1)
    `, [email.trim().toLowerCase(), hash, employeeId]);

    const createdEmp = db.queryOne("SELECT * FROM employees WHERE id = ?", [employeeId]);

    await logAuditAction({
      req,
      action: 'REGISTER_EMPLOYEE',
      entity: 'employees',
      entity_id: employeeId,
      after_json: createdEmp
    });

    await createNotification(
      userRes.lastInsertRowid,
      'Welcome to the Team!',
      `Your account has been registered. Please change your temporary password upon first login.`,
      'info'
    );

    res.status(201).json({
      message: 'Employee registered successfully and login created.',
      employee: createdEmp,
      temporaryPassword: tempPassword
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateEmployee(req, res) {
  try {
    const { id } = req.params;
    const {
      first_name,
      last_name,
      phone,
      address,
      gender,
      department_id,
      designation_id,
      joining_date,
      exit_date,
      status,
      basic_salary
    } = req.body;

    const db = await getDatabase();
    const before = db.queryOne("SELECT * FROM employees WHERE id = ?", [id]);
    if (!before) return res.status(404).json({ error: 'Employee not found.' });

    let basic = before.basic_salary;
    let hra = before.hra;
    let medical = before.medical_allowance;
    let gross = before.gross_salary;

    if (basic_salary !== undefined && Number(basic_salary) > 0) {
      const salaryInfo = calculateSalaryBreakdown(Number(basic_salary));
      basic = salaryInfo.basic;
      hra = salaryInfo.hra;
      medical = salaryInfo.medical;
      gross = salaryInfo.gross;
    }

    const newStatus = status || before.status;
    let newExitDate = exit_date !== undefined ? exit_date : before.exit_date;
    if (newStatus === 'exited' && !newExitDate) {
      newExitDate = new Date().toISOString().slice(0, 10);
    } else if (newStatus === 'active' && before.status === 'exited') {
      newExitDate = null;
    }

    let validDeptId = before.department_id;
    if (department_id !== undefined) {
      if (department_id === null || department_id === '') {
        validDeptId = null;
      } else {
        const deptExists = db.queryOne("SELECT id FROM departments WHERE id = ?", [department_id]);
        validDeptId = deptExists ? department_id : null;
      }
    }

    let validDesigId = before.designation_id;
    if (designation_id !== undefined) {
      if (designation_id === null || designation_id === '') {
        validDesigId = null;
      } else {
        const desigExists = db.queryOne("SELECT id FROM designations WHERE id = ?", [designation_id]);
        validDesigId = desigExists ? designation_id : null;
      }
    }

    db.run(`
      UPDATE employees SET
        first_name = ?, last_name = ?, phone = ?, address = ?, gender = ?,
        department_id = ?, designation_id = ?, joining_date = ?, exit_date = ?, status = ?,
        basic_salary = ?, hra = ?, medical_allowance = ?, gross_salary = ?
      WHERE id = ?
    `, [
      first_name || before.first_name,
      last_name || before.last_name,
      phone !== undefined ? phone : before.phone,
      address !== undefined ? address : before.address,
      gender || before.gender,
      validDeptId,
      validDesigId,
      joining_date || before.joining_date,
      newExitDate,
      newStatus,
      basic, hra, medical, gross,
      id
    ]);

    // Keep users table in sync if employee status transitions to or from 'exited'
    if (newStatus === 'exited') {
      db.run("UPDATE users SET is_active = 0 WHERE employee_id = ?", [id]);
    } else if (newStatus === 'active' && before.status === 'exited') {
      db.run("UPDATE users SET is_active = 1 WHERE employee_id = ?", [id]);
    }

    const after = db.queryOne("SELECT * FROM employees WHERE id = ?", [id]);

    await logAuditAction({
      req,
      action: 'UPDATE_EMPLOYEE',
      entity: 'employees',
      entity_id: id,
      before_json: before,
      after_json: after
    });

    res.json(after);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// CSV Dry-Run and Import
async function csvImport(req, res) {
  try {
    const { rows = [], isDryRun = true } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No data rows provided.' });
    }

    const db = await getDatabase();
    const departments = db.query("SELECT id, LOWER(name) as name, LOWER(code) as code FROM departments");
    const deptMap = {};
    departments.forEach(d => {
      deptMap[d.name] = d.id;
      deptMap[d.code] = d.id;
    });

    const existingEmails = new Set([
      ...db.query("SELECT email FROM employees").map(e => (e.email || '').toLowerCase()),
      ...db.query("SELECT email FROM users").map(u => (u.email || '').toLowerCase())
    ]);
    const existingCodes = new Set(db.query("SELECT employee_code FROM employees").map(e => (e.employee_code || '').toLowerCase()));

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

    const errors = [];
    const validRows = [];
    const batchEmails = new Set();
    const batchCodes = new Set();

    rows.forEach((row, index) => {
      const rowNum = index + 1;
      const firstName = (row.first_name || '').trim();
      const lastName = (row.last_name || '').trim();
      const email = (row.email || '').trim().toLowerCase();
      const code = (row.employee_code || '').trim().toUpperCase();
      const deptName = (row.department || '').trim().toLowerCase();
      const joiningDate = (row.joining_date || '').trim();
      const salary = Number(row.basic_salary);

      if (!firstName) errors.push({ row: rowNum, field: 'first_name', reason: 'First name is required.' });
      if (!lastName) errors.push({ row: rowNum, field: 'last_name', reason: 'Last name is required.' });

      if (!email) {
        errors.push({ row: rowNum, field: 'email', reason: 'Email is required.' });
      } else if (!emailRegex.test(email)) {
        errors.push({ row: rowNum, field: 'email', reason: 'Invalid email format.' });
      } else if (existingEmails.has(email)) {
        errors.push({ row: rowNum, field: 'email', reason: 'Email already exists in system.' });
      } else if (batchEmails.has(email)) {
        errors.push({ row: rowNum, field: 'email', reason: 'Duplicate email within uploaded batch.' });
      } else {
        batchEmails.add(email);
      }

      if (code) {
        if (existingCodes.has(code.toLowerCase())) {
          errors.push({ row: rowNum, field: 'employee_code', reason: 'Employee code already exists.' });
        } else if (batchCodes.has(code.toLowerCase())) {
          errors.push({ row: rowNum, field: 'employee_code', reason: 'Duplicate employee code within uploaded batch.' });
        } else {
          batchCodes.add(code.toLowerCase());
        }
      }

      if (deptName && !deptMap[deptName]) {
        errors.push({ row: rowNum, field: 'department', reason: `Unknown department '${deptName}'.` });
      }

      if (!joiningDate) {
        errors.push({ row: rowNum, field: 'joining_date', reason: 'Joining date is required.' });
      } else if (!isoDateRegex.test(joiningDate)) {
        errors.push({ row: rowNum, field: 'joining_date', reason: 'Date must be ISO format YYYY-MM-DD.' });
      }

      if (isNaN(salary) || salary <= 0) {
        errors.push({ row: rowNum, field: 'basic_salary', reason: 'Basic salary must be a positive number.' });
      }

      if (errors.filter(e => e.row === rowNum).length === 0) {
        validRows.push({
          firstName,
          lastName,
          email,
          code,
          departmentId: deptMap[deptName] || null,
          joiningDate,
          salary,
          phone: row.phone || '',
          gender: row.gender || 'Other'
        });
      }
    });

    if (isDryRun) {
      return res.json({
        isDryRun: true,
        totalRows: rows.length,
        validCount: validRows.length,
        errorCount: errors.length,
        errors: errors
      });
    }

    // Execute actual import
    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation errors found. Fix errors before importing.',
        errors
      });
    }

    const inserted = [];
    for (const r of validRows) {
      let code = r.code;
      if (!code) {
        const lastEmp = db.queryOne("SELECT id FROM employees ORDER BY id DESC LIMIT 1");
        const nextNum = (lastEmp ? lastEmp.id : 0) + 1;
        code = `EMP-${String(nextNum).padStart(3, '0')}`;
      }

      const salaryInfo = calculateSalaryBreakdown(r.salary);

      const empRes = db.run(`
        INSERT INTO employees (
          employee_code, first_name, last_name, email, phone, gender,
          department_id, joining_date, status, basic_salary, hra, medical_allowance, gross_salary
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
      `, [
        code, r.firstName, r.lastName, r.email, r.phone, r.gender,
        r.departmentId, r.joiningDate, salaryInfo.basic, salaryInfo.hra, salaryInfo.medical, salaryInfo.gross
      ]);

      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync('Welcome@123', salt);
      db.run(`
        INSERT INTO users (email, password_hash, role, employee_id, must_change_password, is_active)
        VALUES (?, ?, 'Employee', ?, 1, 1)
      `, [r.email, hash, empRes.lastInsertRowid]);

      inserted.push({ id: empRes.lastInsertRowid, email: r.email, code });
    }

    await logAuditAction({
      req,
      action: 'CSV_IMPORT_EMPLOYEES',
      entity: 'employees',
      after_json: { count: inserted.length }
    });

    res.json({
      message: `Successfully imported ${inserted.length} employees.`,
      importedCount: inserted.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// CSV Export
async function csvExport(req, res) {
  try {
    const db = await getDatabase();
    const rows = db.query(`
      SELECT e.employee_code, e.first_name, e.last_name, e.email, e.phone, e.gender,
             d.name as department, des.title as designation, e.joining_date, e.status,
             e.basic_salary, e.hra, e.medical_allowance, e.gross_salary
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      ORDER BY e.id ASC
    `);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getEmployees,
  getEmployeeById,
  registerEmployee,
  updateEmployee,
  csvImport,
  csvExport
};
