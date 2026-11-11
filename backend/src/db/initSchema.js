const bcrypt = require('bcryptjs');

async function initSchema(db) {
  // Execute table creation statements
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      office_start TEXT DEFAULT '09:00',
      grace_time_minutes INTEGER DEFAULT 15,
      half_day_hours REAL DEFAULT 5.0,
      weekend_days TEXT DEFAULT 'Saturday,Sunday',
      office_lat REAL DEFAULT 24.8607,
      office_lng REAL DEFAULT 67.0011,
      office_radius_meters REAL DEFAULT 150.0,
      late_penalty_enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL, -- 'Admin', 'HR', 'Employee'
      employee_id INTEGER,
      must_change_password INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS designations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER,
      title TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(department_id) REFERENCES departments(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_code TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      address TEXT,
      gender TEXT,
      department_id INTEGER,
      designation_id INTEGER,
      joining_date TEXT NOT NULL,
      exit_date TEXT,
      status TEXT DEFAULT 'active', -- 'active', 'probation', 'exited'
      basic_salary REAL NOT NULL,
      hra REAL NOT NULL,
      medical_allowance REAL NOT NULL,
      gross_salary REAL NOT NULL,
      avatar_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(department_id) REFERENCES departments(id) ON DELETE SET NULL,
      FOREIGN KEY(designation_id) REFERENCES designations(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS leave_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      yearly_quota INTEGER NOT NULL,
      is_unpaid INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      year INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      check_in TEXT,
      check_out TEXT,
      status TEXT NOT NULL, -- 'present', 'late', 'half_day', 'absent', 'missing_checkout', 'on_leave'
      work_hours REAL DEFAULT 0.0,
      source TEXT DEFAULT 'web', -- 'web', 'camera', 'correction'
      lat REAL,
      lng REAL,
      distance_meters REAL,
      face_detected INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(employee_id, date),
      FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attendance_corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attendance_id INTEGER,
      employee_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      requested_check_in TEXT,
      requested_check_out TEXT,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
      reviewed_by INTEGER,
      review_comment TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TEXT,
      FOREIGN KEY(attendance_id) REFERENCES attendance(id) ON DELETE SET NULL,
      FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      leave_type_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days_count INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'
      reviewed_by INTEGER,
      review_comment TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TEXT,
      FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY(leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT,
      FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS payroll_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month_year TEXT UNIQUE NOT NULL, -- 'YYYY-MM'
      status TEXT DEFAULT 'draft', -- 'draft', 'finalized'
      total_gross REAL DEFAULT 0,
      total_deductions REAL DEFAULT 0,
      total_tax REAL DEFAULT 0,
      total_net REAL DEFAULT 0,
      prepared_by INTEGER,
      finalized_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      finalized_at TEXT,
      FOREIGN KEY(prepared_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(finalized_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS payslips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payroll_run_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      month_year TEXT NOT NULL,
      basic_salary REAL NOT NULL,
      hra REAL NOT NULL,
      medical_allowance REAL NOT NULL,
      gross_salary REAL NOT NULL,
      working_days_in_month INTEGER NOT NULL,
      payable_days REAL NOT NULL,
      absent_days INTEGER DEFAULT 0,
      half_days INTEGER DEFAULT 0,
      unpaid_leave_days INTEGER DEFAULT 0,
      late_days INTEGER DEFAULT 0,
      late_penalty_deduction REAL DEFAULT 0,
      attendance_deduction REAL DEFAULT 0,
      annual_gross REAL NOT NULL,
      annual_tax REAL NOT NULL,
      monthly_tax REAL NOT NULL,
      net_pay REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
      FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      UNIQUE(payroll_run_id, employee_id)
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      priority TEXT DEFAULT 'normal', -- 'normal', 'important', 'urgent'
      posted_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(posted_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER,
      actor_email TEXT,
      actor_role TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      before_json TEXT,
      after_json TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      role TEXT,
      prompt TEXT,
      tool_called TEXT,
      tool_args TEXT,
      response TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure default leave types exist as mandated in business rules (M5 Leave: Quotas annual 14, sick 8, casual 10; unpaid unlimited)
  const existingTypes = db.query("SELECT COUNT(*) as count FROM leave_types");
  if (!existingTypes || existingTypes[0].count === 0) {
    db.run("INSERT INTO leave_types (name, yearly_quota, is_unpaid) VALUES ('Annual', 14, 0)");
    db.run("INSERT INTO leave_types (name, yearly_quota, is_unpaid) VALUES ('Sick', 8, 0)");
    db.run("INSERT INTO leave_types (name, yearly_quota, is_unpaid) VALUES ('Casual', 10, 0)");
    db.run("INSERT INTO leave_types (name, yearly_quota, is_unpaid) VALUES ('Unpaid', 999999, 1)");
  }

  // Check if .env has ADMIN_EMAIL and ADMIN_PASSWORD for zero-touch auto-init if desired
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const companyName = process.env.COMPANY_NAME || 'Acme Global HCM';

  const userCount = db.queryOne("SELECT COUNT(*) as count FROM users WHERE role = 'Admin'");
  if (userCount && userCount.count === 0 && adminEmail && adminPassword) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(adminPassword, salt);
    db.run("INSERT INTO users (email, password_hash, role, must_change_password) VALUES (?, ?, 'Admin', 0)", [adminEmail, hash]);

    const settingsCount = db.queryOne("SELECT COUNT(*) as count FROM settings");
    if (!settingsCount || settingsCount.count === 0) {
      db.run("INSERT INTO settings (company_name) VALUES (?)", [companyName]);
    }
  }
}

module.exports = { initSchema };
