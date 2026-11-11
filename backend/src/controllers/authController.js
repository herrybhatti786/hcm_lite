const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../db/database');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { logAuditAction } = require('../middleware/auditMiddleware');

async function getStatus(req, res) {
  try {
    const db = await getDatabase();
    const adminUser = db.queryOne("SELECT id FROM users WHERE role = 'Admin' LIMIT 1");
    const settings = db.queryOne("SELECT * FROM settings LIMIT 1");

    res.json({
      initialized: !!(adminUser && settings),
      companyName: settings ? settings.company_name : null,
      settings: settings || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function firstRunSetup(req, res) {
  try {
    const { companyName, adminEmail, adminPassword, officeStart, graceMinutes, halfDayHours, weekendDays, officeLat, officeLng, officeRadius } = req.body;

    if (!companyName || !adminEmail || !adminPassword) {
      return res.status(400).json({ error: 'Company name, admin email, and admin password are required.' });
    }

    const db = await getDatabase();
    const existingAdmin = db.queryOne("SELECT id FROM users WHERE role = 'Admin' LIMIT 1");
    if (existingAdmin) {
      return res.status(400).json({ error: 'System is already initialized with an Admin account.' });
    }

    // Hash password
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(adminPassword, salt);

    // Save admin user
    const userRes = db.run(
      "INSERT INTO users (email, password_hash, role, must_change_password) VALUES (?, ?, 'Admin', 0)",
      [adminEmail.trim().toLowerCase(), hash]
    );

    // Save company settings
    db.run(
      `INSERT INTO settings (company_name, office_start, grace_time_minutes, half_day_hours, weekend_days, office_lat, office_lng, office_radius_meters)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyName.trim(),
        officeStart || '09:00',
        Number(graceMinutes) || 15,
        Number(halfDayHours) || 5.0,
        weekendDays || 'Saturday,Sunday',
        Number(officeLat) || 24.8607,
        Number(officeLng) || 67.0011,
        Number(officeRadius) || 150.0
      ]
    );

    const newAdmin = db.queryOne("SELECT id, email, role FROM users WHERE id = ?", [userRes.lastInsertRowid]);

    await logAuditAction({
      actor: newAdmin,
      action: 'FIRST_RUN_INITIALIZE',
      entity: 'settings',
      entity_id: '1',
      after_json: { companyName, adminEmail },
      req
    });

    const token = jwt.sign(
      { id: newAdmin.id, email: newAdmin.email, role: newAdmin.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Company initialized successfully.',
      token,
      user: newAdmin
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const db = await getDatabase();
    const user = db.queryOne(
      "SELECT id, email, password_hash, role, employee_id, must_change_password, is_active FROM users WHERE email = ?",
      [email.trim().toLowerCase()]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.is_active === 0) {
      return res.status(403).json({ error: 'Account has been deactivated. Please contact your Admin.' });
    }

    if (user.employee_id) {
      const emp = db.queryOne("SELECT status FROM employees WHERE id = ?", [user.employee_id]);
      if (emp && emp.status === 'exited') {
        return res.status(403).json({ error: 'Account is deactivated as this employee has exited the organization.' });
      }
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const settings = db.queryOne("SELECT * FROM settings LIMIT 1");
    let employeeData = null;
    if (user.employee_id) {
      employeeData = db.queryOne(
        `SELECT e.*, d.name as department_name, des.title as designation_title 
         FROM employees e 
         LEFT JOIN departments d ON e.department_id = d.id 
         LEFT JOIN designations des ON e.designation_id = des.id 
         WHERE e.id = ?`,
        [user.employee_id]
      );
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, employee_id: user.employee_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        employee_id: user.employee_id,
        must_change_password: !!user.must_change_password
      },
      employee: employeeData,
      company: settings
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getMe(req, res) {
  try {
    const db = await getDatabase();
    const user = db.queryOne(
      "SELECT id, email, role, employee_id, must_change_password, is_active FROM users WHERE id = ?",
      [req.user.id]
    );

    let employeeData = null;
    if (user.employee_id) {
      employeeData = db.queryOne(
        `SELECT e.*, d.name as department_name, des.title as designation_title 
         FROM employees e 
         LEFT JOIN departments d ON e.department_id = d.id 
         LEFT JOIN designations des ON e.designation_id = des.id 
         WHERE e.id = ?`,
        [user.employee_id]
      );
    }

    const settings = db.queryOne("SELECT * FROM settings LIMIT 1");

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        employee_id: user.employee_id,
        must_change_password: !!user.must_change_password
      },
      employee: employeeData,
      company: settings
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const db = await getDatabase();
    const user = db.queryOne("SELECT id, password_hash, must_change_password FROM users WHERE id = ?", [req.user.id]);

    // If not first sign-in forced reset, verify current password
    if (!user.must_change_password) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to set a new password.' });
      }
      const match = bcrypt.compareSync(currentPassword, user.password_hash);
      if (!match) {
        return res.status(400).json({ error: 'Current password does not match.' });
      }
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(newPassword, salt);

    db.run(
      "UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?",
      [newHash, req.user.id]
    );

    await logAuditAction({
      req,
      action: 'CHANGE_PASSWORD',
      entity: 'users',
      entity_id: req.user.id
    });

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateSelfProfile(req, res) {
  try {
    if (!req.user.employee_id) {
      return res.status(400).json({ error: 'User is not linked to an employee profile.' });
    }

    const { phone, address } = req.body;
    const db = await getDatabase();

    const before = db.queryOne("SELECT phone, address FROM employees WHERE id = ?", [req.user.employee_id]);

    const updatedPhone = phone !== undefined ? phone : (before ? before.phone : '');
    const updatedAddress = address !== undefined ? address : (before ? before.address : '');

    db.run(
      "UPDATE employees SET phone = ?, address = ? WHERE id = ?",
      [updatedPhone, updatedAddress, req.user.employee_id]
    );

    await logAuditAction({
      req,
      action: 'UPDATE_OWN_PROFILE',
      entity: 'employees',
      entity_id: req.user.employee_id,
      before_json: before,
      after_json: { phone: updatedPhone, address: updatedAddress }
    });

    res.json({ message: 'Profile updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getStatus,
  firstRunSetup,
  login,
  getMe,
  changePassword,
  updateSelfProfile
};
