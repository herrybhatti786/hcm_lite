const bcrypt = require('bcryptjs');
const { getDatabase } = require('../db/database');
const { logAuditAction } = require('../middleware/auditMiddleware');

// Settings
async function getSettings(req, res) {
  try {
    const db = await getDatabase();
    const settings = db.queryOne("SELECT * FROM settings LIMIT 1");
    res.json(settings || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateSettings(req, res) {
  try {
    const db = await getDatabase();
    const {
      company_name,
      office_start,
      grace_time_minutes,
      half_day_hours,
      weekend_days,
      office_lat,
      office_lng,
      office_radius_meters,
      late_penalty_enabled
    } = req.body;

    const before = db.queryOne("SELECT * FROM settings LIMIT 1");

    if (before) {
      db.run(
        `UPDATE settings SET
          company_name = ?, office_start = ?, grace_time_minutes = ?, half_day_hours = ?,
          weekend_days = ?, office_lat = ?, office_lng = ?, office_radius_meters = ?,
          late_penalty_enabled = ?
         WHERE id = ?`,
        [
          company_name || before.company_name,
          office_start || before.office_start,
          Number(grace_time_minutes) || before.grace_time_minutes,
          Number(half_day_hours) || before.half_day_hours,
          weekend_days || before.weekend_days,
          Number(office_lat) || before.office_lat,
          Number(office_lng) || before.office_lng,
          Number(office_radius_meters) || before.office_radius_meters,
          late_penalty_enabled !== undefined ? (late_penalty_enabled ? 1 : 0) : before.late_penalty_enabled,
          before.id
        ]
      );
    } else {
      db.run(
        `INSERT INTO settings (company_name, office_start, grace_time_minutes, half_day_hours, weekend_days, office_lat, office_lng, office_radius_meters, late_penalty_enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          company_name || 'My Company',
          office_start || '09:00',
          Number(grace_time_minutes) || 15,
          Number(half_day_hours) || 5.0,
          weekend_days || 'Saturday,Sunday',
          Number(office_lat) || 24.8607,
          Number(office_lng) || 67.0011,
          Number(office_radius_meters) || 150.0,
          late_penalty_enabled ? 1 : 0
        ]
      );
    }

    const after = db.queryOne("SELECT * FROM settings LIMIT 1");

    await logAuditAction({
      req,
      action: 'UPDATE_SETTINGS',
      entity: 'settings',
      entity_id: after ? after.id : '1',
      before_json: before,
      after_json: after
    });

    res.json({ message: 'Settings updated successfully.', settings: after });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Departments
async function getDepartments(req, res) {
  try {
    const db = await getDatabase();
    const rows = db.query(`
      SELECT d.*, 
        (SELECT COUNT(*) FROM employees e WHERE e.department_id = d.id AND e.status != 'exited') as employee_count
      FROM departments d 
      ORDER BY d.name ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createDepartment(req, res) {
  try {
    const { name, code, description } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Department name and code are required.' });
    }

    const db = await getDatabase();
    const existing = db.queryOne("SELECT id FROM departments WHERE name = ? OR code = ?", [name.trim(), code.trim()]);
    if (existing) {
      return res.status(400).json({ error: 'A department with this name or code already exists.' });
    }

    const result = db.run(
      "INSERT INTO departments (name, code, description) VALUES (?, ?, ?)",
      [name.trim(), code.trim().toUpperCase(), description || '']
    );

    const newDept = db.queryOne("SELECT * FROM departments WHERE id = ?", [result.lastInsertRowid]);

    await logAuditAction({
      req,
      action: 'CREATE_DEPARTMENT',
      entity: 'departments',
      entity_id: newDept.id,
      after_json: newDept
    });

    res.status(201).json(newDept);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateDepartment(req, res) {
  try {
    const { id } = req.params;
    const { name, code, description } = req.body;
    const db = await getDatabase();

    const before = db.queryOne("SELECT * FROM departments WHERE id = ?", [id]);
    if (!before) return res.status(404).json({ error: 'Department not found.' });

    db.run(
      "UPDATE departments SET name = ?, code = ?, description = ? WHERE id = ?",
      [name || before.name, code ? code.toUpperCase() : before.code, description !== undefined ? description : before.description, id]
    );

    const after = db.queryOne("SELECT * FROM departments WHERE id = ?", [id]);

    await logAuditAction({
      req,
      action: 'UPDATE_DEPARTMENT',
      entity: 'departments',
      entity_id: id,
      before_json: before,
      after_json: after
    });

    res.json(after);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteDepartment(req, res) {
  try {
    const { id } = req.params;
    const db = await getDatabase();

    const before = db.queryOne("SELECT * FROM departments WHERE id = ?", [id]);
    if (!before) return res.status(404).json({ error: 'Department not found.' });

    db.run("DELETE FROM departments WHERE id = ?", [id]);

    await logAuditAction({
      req,
      action: 'DELETE_DEPARTMENT',
      entity: 'departments',
      entity_id: id,
      before_json: before
    });

    res.json({ message: 'Department deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Designations
async function getDesignations(req, res) {
  try {
    const db = await getDatabase();
    const rows = db.query(`
      SELECT des.*, d.name as department_name 
      FROM designations des 
      LEFT JOIN departments d ON des.department_id = d.id 
      ORDER BY des.title ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createDesignation(req, res) {
  try {
    const { department_id, title } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Designation title is required.' });
    }

    const db = await getDatabase();
    let validDeptId = null;
    if (department_id) {
      const dept = db.queryOne("SELECT id FROM departments WHERE id = ?", [department_id]);
      if (dept) validDeptId = department_id;
    }

    const result = db.run(
      "INSERT INTO designations (department_id, title) VALUES (?, ?)",
      [validDeptId, title.trim()]
    );

    const newDes = db.queryOne("SELECT * FROM designations WHERE id = ?", [result.lastInsertRowid]);

    await logAuditAction({
      req,
      action: 'CREATE_DESIGNATION',
      entity: 'designations',
      entity_id: newDes.id,
      after_json: newDes
    });

    res.status(201).json(newDes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Leave Types & Quotas
async function getLeaveTypes(req, res) {
  try {
    const db = await getDatabase();
    const rows = db.query("SELECT * FROM leave_types ORDER BY id ASC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateLeaveType(req, res) {
  try {
    const { id } = req.params;
    const { yearly_quota, name } = req.body;
    const db = await getDatabase();

    const before = db.queryOne("SELECT * FROM leave_types WHERE id = ?", [id]);
    if (!before) return res.status(404).json({ error: 'Leave type not found.' });

    db.run(
      "UPDATE leave_types SET yearly_quota = ?, name = ? WHERE id = ?",
      [yearly_quota !== undefined ? Number(yearly_quota) : before.yearly_quota, name || before.name, id]
    );

    const after = db.queryOne("SELECT * FROM leave_types WHERE id = ?", [id]);

    await logAuditAction({
      req,
      action: 'UPDATE_LEAVE_TYPE',
      entity: 'leave_types',
      entity_id: id,
      before_json: before,
      after_json: after
    });

    res.json(after);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Holidays
async function getHolidays(req, res) {
  try {
    const db = await getDatabase();
    const rows = db.query("SELECT * FROM holidays ORDER BY date ASC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createHoliday(req, res) {
  try {
    const { name, date } = req.body;
    if (!name || !date) return res.status(400).json({ error: 'Holiday name and date are required.' });

    const year = Number(date.split('-')[0]);
    const db = await getDatabase();

    const result = db.run(
      "INSERT INTO holidays (name, date, year) VALUES (?, ?, ?)",
      [name.trim(), date.trim(), year]
    );

    const newHol = db.queryOne("SELECT * FROM holidays WHERE id = ?", [result.lastInsertRowid]);

    await logAuditAction({
      req,
      action: 'CREATE_HOLIDAY',
      entity: 'holidays',
      entity_id: newHol.id,
      after_json: newHol
    });

    res.status(201).json(newHol);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteHoliday(req, res) {
  try {
    const { id } = req.params;
    const db = await getDatabase();
    const before = db.queryOne("SELECT * FROM holidays WHERE id = ?", [id]);
    if (!before) return res.status(404).json({ error: 'Holiday not found.' });

    db.run("DELETE FROM holidays WHERE id = ?", [id]);

    await logAuditAction({
      req,
      action: 'DELETE_HOLIDAY',
      entity: 'holidays',
      entity_id: id,
      before_json: before
    });

    res.json({ message: 'Holiday deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// User Management (Admin creates HR logins, deactivates, or resets passwords)
async function getUsers(req, res) {
  try {
    const db = await getDatabase();
    const rows = db.query(`
      SELECT u.id, u.email, u.role, u.employee_id, u.must_change_password, u.is_active, u.created_at,
             e.first_name, e.last_name, e.employee_code
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      ORDER BY u.id DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createHRUser(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const db = await getDatabase();
    const existing = db.queryOne("SELECT id FROM users WHERE email = ?", [email.trim().toLowerCase()]);
    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    const result = db.run(
      "INSERT INTO users (email, password_hash, role, must_change_password) VALUES (?, ?, 'HR', 0)",
      [email.trim().toLowerCase(), hash]
    );

    const newUser = db.queryOne("SELECT id, email, role, is_active, created_at FROM users WHERE id = ?", [result.lastInsertRowid]);

    await logAuditAction({
      req,
      action: 'CREATE_HR_USER',
      entity: 'users',
      entity_id: newUser.id,
      after_json: { email: newUser.email, role: newUser.role }
    });

    res.status(201).json(newUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function toggleUserStatus(req, res) {
  try {
    const { id } = req.params;
    const db = await getDatabase();

    const user = db.queryOne("SELECT id, email, is_active, role FROM users WHERE id = ?", [id]);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }

    const newStatus = user.is_active === 1 ? 0 : 1;
    db.run("UPDATE users SET is_active = ? WHERE id = ?", [newStatus, id]);

    await logAuditAction({
      req,
      action: newStatus === 1 ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      entity: 'users',
      entity_id: id,
      before_json: user,
      after_json: { is_active: newStatus }
    });

    res.json({ message: `User ${newStatus === 1 ? 'activated' : 'deactivated'} successfully.`, is_active: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function resetUserPassword(req, res) {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const db = await getDatabase();
    const user = db.queryOne("SELECT id, email, role FROM users WHERE id = ?", [id]);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(newPassword, salt);

    db.run("UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?", [hash, id]);

    await logAuditAction({
      req,
      action: 'ADMIN_RESET_PASSWORD',
      entity: 'users',
      entity_id: id,
      after_json: { email: user.email, must_change_password: 1 }
    });

    res.json({ message: 'Password reset successfully. User will be prompted to change password upon sign-in.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getSettings,
  updateSettings,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDesignations,
  createDesignation,
  getLeaveTypes,
  updateLeaveType,
  getHolidays,
  createHoliday,
  deleteHoliday,
  getUsers,
  createHRUser,
  toggleUserStatus,
  resetUserPassword
};
