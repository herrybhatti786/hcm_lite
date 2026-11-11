const { getDatabase } = require('../db/database');
const { verifyOfficeLocation } = require('../utils/haversine');
const { logAuditAction } = require('../middleware/auditMiddleware');
const { createNotification } = require('../utils/notificationService');

// Helper to get today's date in YYYY-MM-DD
function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function checkIn(req, res) {
  try {
    const employeeId = req.user.role === 'Employee' ? req.user.employee_id : (req.body.employee_id || req.user.employee_id);

    if (!employeeId) {
      return res.status(400).json({ error: 'No employee record associated with this account.' });
    }

    const db = await getDatabase();
    const today = getTodayString();

    // Check if record already exists for today -> second check-in = 409 Conflict
    const existing = db.queryOne("SELECT * FROM attendance WHERE employee_id = ? AND date = ?", [employeeId, today]);
    if (existing) {
      return res.status(409).json({ error: 'You have already checked in today. Duplicate check-in is not allowed.' });
    }

    const settings = db.queryOne("SELECT * FROM settings LIMIT 1");
    const officeStart = (settings && settings.office_start) || '09:00';
    const graceMinutes = (settings && settings.grace_time_minutes) !== undefined ? settings.grace_time_minutes : 15;

    // Optional camera + location verification
    const { source = 'web', lat, lng, accuracy, face_detected, face_count } = req.body;
    let distanceMeters = null;

    if (source === 'camera' || (lat && lng)) {
      if (face_count !== undefined && face_count !== 1) {
        return res.status(400).json({
          error: face_count === 0 ? 'No face detected in camera view.' : 'Multiple faces detected. Exactly one face must be in frame.'
        });
      }

      if (settings && settings.office_lat && settings.office_lng) {
        const geoCheck = verifyOfficeLocation(
          lat, lng, accuracy,
          settings.office_lat, settings.office_lng, settings.office_radius_meters || 150
        );
        distanceMeters = geoCheck.distance;

        if (!geoCheck.allowed) {
          return res.status(400).json({
            error: geoCheck.reason
          });
        }
      }
    }

    // Determine status (present or late)
    const now = new Date();
    const checkInTimeISO = now.toISOString();

    const [startH, startM] = officeStart.split(':').map(Number);
    const lateThresholdMinutes = (startH * 60 + startM) + graceMinutes;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const status = currentMinutes > lateThresholdMinutes ? 'late' : 'present';

    const result = db.run(`
      INSERT INTO attendance (
        employee_id, date, check_in, status, source, lat, lng, distance_meters, face_detected
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      employeeId,
      today,
      checkInTimeISO,
      status,
      source,
      lat || null,
      lng || null,
      distanceMeters,
      face_detected ? 1 : 0
    ]);

    const record = db.queryOne("SELECT * FROM attendance WHERE id = ?", [result.lastInsertRowid]);

    await logAuditAction({
      req,
      action: 'CHECK_IN',
      entity: 'attendance',
      entity_id: record.id,
      after_json: record
    });

    res.status(201).json({
      message: `Checked in successfully as ${status.toUpperCase()}.`,
      record
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function checkOut(req, res) {
  try {
    const employeeId = req.user.role === 'Employee' ? req.user.employee_id : (req.body.employee_id || req.user.employee_id);
    if (!employeeId) return res.status(400).json({ error: 'No employee record associated with this account.' });

    const db = await getDatabase();
    const today = getTodayString();

    const record = db.queryOne("SELECT * FROM attendance WHERE employee_id = ? AND date = ?", [employeeId, today]);
    if (!record) {
      return res.status(400).json({ error: 'Cannot check out without checking in first.' });
    }

    if (record.check_out) {
      return res.status(400).json({ error: 'You have already checked out today.' });
    }

    const checkOutTime = new Date();
    const checkInTime = new Date(record.check_in);
    const diffMs = checkOutTime - checkInTime;
    const workHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

    const settings = db.queryOne("SELECT half_day_hours FROM settings LIMIT 1");
    const halfDayThreshold = (settings && settings.half_day_hours) || 5.0;

    // Status rule: half_day under 5 hours (even if checked in on time)
    let newStatus = record.status;
    if (workHours < halfDayThreshold) {
      newStatus = 'half_day';
    }

    db.run(`
      UPDATE attendance SET
        check_out = ?,
        work_hours = ?,
        status = ?
      WHERE id = ?
    `, [checkOutTime.toISOString(), workHours, newStatus, record.id]);

    const updated = db.queryOne("SELECT * FROM attendance WHERE id = ?", [record.id]);

    await logAuditAction({
      req,
      action: 'CHECK_OUT',
      entity: 'attendance',
      entity_id: record.id,
      before_json: record,
      after_json: updated
    });

    res.json({
      message: 'Checked out successfully.',
      record: updated
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getTodayStatus(req, res) {
  try {
    const employeeId = req.user.role === 'Employee' ? req.user.employee_id : (req.query.employee_id || req.user.employee_id);
    if (!employeeId) return res.json({ record: null, onLeave: null });

    const db = await getDatabase();
    const today = getTodayString();
    const record = db.queryOne("SELECT * FROM attendance WHERE employee_id = ? AND date = ?", [employeeId, today]);

    const onLeave = db.queryOne(`
      SELECT lr.*, lt.name as leave_type_name
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.employee_id = ? AND lr.status = 'approved' AND ? BETWEEN lr.start_date AND lr.end_date
      LIMIT 1
    `, [employeeId, today]);

    res.json({ record: record || null, onLeave: onLeave || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getAttendanceBoard(req, res) {
  try {
    const { date = getTodayString(), department = '' } = req.query;
    const db = await getDatabase();

    // Data scope guard: Employee only sees their own
    if (req.user.role === 'Employee') {
      const records = db.query(`
        SELECT a.*, e.employee_code, e.first_name, e.last_name, d.name as department_name
        FROM attendance a
        JOIN employees e ON a.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE a.employee_id = ?
        ORDER BY a.date DESC LIMIT 31
      `, [req.user.employee_id]);
      return res.json({ records });
    }

    // For Admin / HR: Get daily board for the given date across all active employees
    let sql = `
      SELECT e.id as employee_id, e.employee_code, e.first_name, e.last_name,
             d.name as department_name, des.title as designation_title,
             a.id as attendance_id, a.check_in, a.check_out, a.work_hours, a.source,
             COALESCE(a.status, 
               CASE 
                 WHEN lr.id IS NOT NULL THEN 'on_leave'
                 ELSE 'absent'
               END
             ) as calculated_status
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN attendance a ON a.employee_id = e.id AND a.date = ?
      LEFT JOIN leave_requests lr ON lr.employee_id = e.id AND lr.status = 'approved' AND ? BETWEEN lr.start_date AND lr.end_date
      WHERE e.status != 'exited'
    `;
    const params = [date, date];

    if (department) {
      sql += ` AND e.department_id = ?`;
      params.push(department);
    }

    sql += ` ORDER BY e.employee_code ASC`;

    const records = db.query(sql, params);
    res.json({ date, records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function requestCorrection(req, res) {
  try {
    const employeeId = req.user.employee_id;
    if (!employeeId) return res.status(400).json({ error: 'No employee record linked.' });

    const { date, requested_check_in, requested_check_out, reason } = req.body;
    if (!date || !reason) {
      return res.status(400).json({ error: 'Date and reason are required.' });
    }

    const db = await getDatabase();
    const existingAtt = db.queryOne("SELECT id FROM attendance WHERE employee_id = ? AND date = ?", [employeeId, date]);

    const result = db.run(`
      INSERT INTO attendance_corrections (
        attendance_id, employee_id, date, requested_check_in, requested_check_out, reason, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `, [
      existingAtt ? existingAtt.id : null,
      employeeId,
      date,
      requested_check_in || null,
      requested_check_out || null,
      reason.trim()
    ]);

    const newCorrection = db.queryOne("SELECT * FROM attendance_corrections WHERE id = ?", [result.lastInsertRowid]);

    await logAuditAction({
      req,
      action: 'REQUEST_ATTENDANCE_CORRECTION',
      entity: 'attendance_corrections',
      entity_id: newCorrection.id,
      after_json: newCorrection
    });

    res.status(201).json(newCorrection);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getCorrections(req, res) {
  try {
    const db = await getDatabase();
    let sql = `
      SELECT ac.*, e.employee_code, e.first_name, e.last_name, d.name as department_name,
             u.email as reviewed_by_email
      FROM attendance_corrections ac
      JOIN employees e ON ac.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN users u ON ac.reviewed_by = u.id
    `;
    const params = [];

    if (req.user.role === 'Employee') {
      sql += ` WHERE ac.employee_id = ?`;
      params.push(req.user.employee_id);
    }

    sql += ` ORDER BY ac.id DESC`;

    const rows = db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function reviewCorrection(req, res) {
  try {
    const { id } = req.params;
    const { status, review_comment } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected.' });
    }

    const db = await getDatabase();
    const corr = db.queryOne("SELECT * FROM attendance_corrections WHERE id = ?", [id]);
    if (!corr) return res.status(404).json({ error: 'Correction request not found.' });

    if (corr.status !== 'pending') {
      return res.status(400).json({ error: 'Correction has already been reviewed.' });
    }

    // Update correction
    db.run(`
      UPDATE attendance_corrections SET
        status = ?,
        reviewed_by = ?,
        review_comment = ?,
        reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, req.user.id, review_comment || '', id]);

    // If approved, update or insert attendance record
    if (status === 'approved') {
      const settings = db.queryOne("SELECT office_start FROM settings LIMIT 1");
      const defaultStart = (settings && settings.office_start) || '09:00';
      
      const formatTimeISO = (tStr, defaultTime) => {
        if (!tStr && !defaultTime) return null;
        const val = (tStr || defaultTime).trim();
        if (val.includes('T') || val.includes('Z')) {
          const d = new Date(val);
          return isNaN(d.getTime()) ? null : d.toISOString();
        }
        const timeParts = val.split(':');
        const hh = String(timeParts[0] || '09').padStart(2, '0');
        const mm = String(timeParts[1] || '00').padStart(2, '0');
        const ss = String(timeParts[2] || '00').padStart(2, '0');
        const d = new Date(`${corr.date}T${hh}:${mm}:${ss}`);
        return isNaN(d.getTime()) ? null : d.toISOString();
      };

      const checkInISO = formatTimeISO(corr.requested_check_in, defaultStart);
      const checkOutISO = formatTimeISO(corr.requested_check_out, '17:00');

      let workHours = 8.0; // standard corrected day
      if (checkInISO && checkOutISO) {
        const diffMs = new Date(checkOutISO) - new Date(checkInISO);
        workHours = Math.max(0, Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100);
      }

      const existing = db.queryOne("SELECT id FROM attendance WHERE employee_id = ? AND date = ?", [corr.employee_id, corr.date]);
      if (existing) {
        db.run(`
          UPDATE attendance SET
            check_in = COALESCE(?, check_in),
            check_out = COALESCE(?, check_out),
            work_hours = ?,
            status = 'present',
            source = 'correction'
          WHERE id = ?
        `, [checkInISO, checkOutISO, workHours, existing.id]);
      } else {
        db.run(`
          INSERT INTO attendance (
            employee_id, date, check_in, check_out, work_hours, status, source
          ) VALUES (?, ?, ?, ?, ?, 'present', 'correction')
        `, [corr.employee_id, corr.date, checkInISO, checkOutISO, workHours]);
      }
    }

    // Notify employee
    const empUser = db.queryOne("SELECT id FROM users WHERE employee_id = ?", [corr.employee_id]);
    if (empUser) {
      await createNotification(
        empUser.id,
        `Attendance Correction ${status.toUpperCase()}`,
        `Your correction for ${corr.date} was ${status}.${review_comment ? ' Note: ' + review_comment : ''}`,
        'attendance'
      );
    }

    await logAuditAction({
      req,
      action: `REVIEW_CORRECTION_${status.toUpperCase()}`,
      entity: 'attendance_corrections',
      entity_id: id,
      after_json: { status, review_comment }
    });

    res.json({ message: `Correction ${status}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  checkIn,
  checkOut,
  getTodayStatus,
  getAttendanceBoard,
  requestCorrection,
  getCorrections,
  reviewCorrection
};
