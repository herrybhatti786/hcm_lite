const { getDatabase } = require('../db/database');
const { calculateLeaveDays } = require('../utils/dateUtils');
const { logAuditAction } = require('../middleware/auditMiddleware');
const { createNotification } = require('../utils/notificationService');

async function getLeaveBalances(req, res) {
  try {
    const employeeId = req.user.role === 'Employee' ? req.user.employee_id : (req.params.employeeId || req.query.employeeId || req.user.employee_id);

    if (!employeeId) return res.status(400).json({ error: 'Employee ID required.' });

    const db = await getDatabase();
    const leaveTypes = db.query("SELECT * FROM leave_types ORDER BY id ASC");

    const balances = leaveTypes.map(lt => {
      const usedRow = db.queryOne(`
        SELECT COALESCE(SUM(days_count), 0) as used
        FROM leave_requests
        WHERE employee_id = ? AND leave_type_id = ? AND status = 'approved'
      `, [employeeId, lt.id]);

      const pendingRow = db.queryOne(`
        SELECT COALESCE(SUM(days_count), 0) as pending
        FROM leave_requests
        WHERE employee_id = ? AND leave_type_id = ? AND status = 'pending'
      `, [employeeId, lt.id]);

      const used = usedRow ? usedRow.used : 0;
      const pending = pendingRow ? pendingRow.pending : 0;
      const quota = lt.yearly_quota;
      const isUnpaid = !!lt.is_unpaid;
      const remaining = isUnpaid ? 999999 : Math.max(0, quota - used);

      return {
        id: lt.id,
        name: lt.name,
        is_unpaid: isUnpaid,
        quota: isUnpaid ? 'Unlimited' : quota,
        used,
        pending,
        remaining: isUnpaid ? 'Unlimited' : remaining
      };
    });

    res.json(balances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function applyLeave(req, res) {
  try {
    const employeeId = req.user.role === 'Employee' ? req.user.employee_id : (req.body.employee_id || req.user.employee_id);
    if (!employeeId) return res.status(400).json({ error: 'No employee record linked.' });

    const { leave_type_id, start_date, end_date, reason } = req.body;
    if (!leave_type_id || !start_date || !end_date || !reason) {
      return res.status(400).json({ error: 'Leave type, start date, end date, and reason are required.' });
    }

    const db = await getDatabase();

    // Check dates validity and calculate working days (skipping weekends & holidays)
    const leaveCalc = await calculateLeaveDays(db, start_date, end_date);
    if (leaveCalc.error) {
      return res.status(400).json({ error: leaveCalc.error });
    }

    if (leaveCalc.daysCount <= 0) {
      return res.status(400).json({
        error: 'The selected date range contains 0 working days (all days are either weekends or holidays).'
      });
    }

    const daysCount = leaveCalc.daysCount;

    // Check overlap: Overlap = 422
    const overlap = db.queryOne(`
      SELECT id FROM leave_requests
      WHERE employee_id = ? 
        AND status IN ('pending', 'approved')
        AND NOT (end_date < ? OR start_date > ?)
      LIMIT 1
    `, [employeeId, start_date, end_date]);

    if (overlap) {
      return res.status(422).json({
        error: 'Overlap detected: You already have a pending or approved leave request covering these dates.'
      });
    }

    // Check quota / balance: Over-balance = 422
    const leaveType = db.queryOne("SELECT * FROM leave_types WHERE id = ?", [leave_type_id]);
    if (!leaveType) return res.status(404).json({ error: 'Invalid leave type.' });

    if (!leaveType.is_unpaid) {
      const usedRow = db.queryOne(`
        SELECT COALESCE(SUM(days_count), 0) as used
        FROM leave_requests
        WHERE employee_id = ? AND leave_type_id = ? AND status = 'approved'
      `, [employeeId, leave_type_id]);

      const currentUsed = usedRow ? usedRow.used : 0;
      const remainingQuota = leaveType.yearly_quota - currentUsed;

      if (daysCount > remainingQuota) {
        return res.status(422).json({
          error: `Over-balance: You requested ${daysCount} working days, but only have ${remainingQuota} ${leaveType.name} days remaining (quota: ${leaveType.yearly_quota}, used: ${currentUsed}).`
        });
      }
    }

    // Insert leave request
    const result = db.run(`
      INSERT INTO leave_requests (
        employee_id, leave_type_id, start_date, end_date, days_count, reason, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `, [employeeId, leave_type_id, start_date, end_date, daysCount, reason.trim()]);

    const createdLeave = db.queryOne("SELECT * FROM leave_requests WHERE id = ?", [result.lastInsertRowid]);

    await logAuditAction({
      req,
      action: 'APPLY_LEAVE',
      entity: 'leave_requests',
      entity_id: createdLeave.id,
      after_json: createdLeave
    });

    res.status(201).json({
      message: `Leave application for ${daysCount} working day(s) submitted for approval.`,
      leave: createdLeave
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getLeaves(req, res) {
  try {
    const db = await getDatabase();
    let sql = `
      SELECT lr.*, lt.name as leave_type_name, lt.is_unpaid,
             e.employee_code, e.first_name, e.last_name, d.name as department_name,
             u.email as reviewed_by_email
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN users u ON lr.reviewed_by = u.id
    `;
    const params = [];

    // Scope check: If Employee, only see own leaves
    if (req.user.role === 'Employee') {
      sql += ` WHERE lr.employee_id = ?`;
      params.push(req.user.employee_id);
    } else if (req.query.employee_id) {
      sql += ` WHERE lr.employee_id = ?`;
      params.push(req.query.employee_id);
    }

    sql += ` ORDER BY lr.id DESC`;

    const rows = db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function cancelLeave(req, res) {
  try {
    const { id } = req.params;
    const db = await getDatabase();

    const leave = db.queryOne("SELECT * FROM leave_requests WHERE id = ?", [id]);
    if (!leave) return res.status(404).json({ error: 'Leave request not found.' });

    // Scope guard: Employee can only cancel own leave
    if (req.user.role === 'Employee' && Number(req.user.employee_id) !== Number(leave.employee_id)) {
      return res.status(403).json({ error: 'You can only cancel your own leave requests.' });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending leave requests can be cancelled.' });
    }

    db.run("UPDATE leave_requests SET status = 'cancelled' WHERE id = ?", [id]);

    await logAuditAction({
      req,
      action: 'CANCEL_LEAVE',
      entity: 'leave_requests',
      entity_id: id,
      before_json: leave,
      after_json: { status: 'cancelled' }
    });

    res.json({ message: 'Leave request cancelled successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function reviewLeave(req, res) {
  try {
    const { id } = req.params;
    const { status, review_comment } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected.' });
    }

    const db = await getDatabase();
    const leave = db.queryOne("SELECT * FROM leave_requests WHERE id = ?", [id]);
    if (!leave) return res.status(404).json({ error: 'Leave request not found.' });

    if (leave.status !== 'pending') {
      return res.status(400).json({ error: 'This leave request has already been reviewed.' });
    }

    // If approving, verify quota is not exceeded
    if (status === 'approved') {
      const leaveType = db.queryOne("SELECT * FROM leave_types WHERE id = ?", [leave.leave_type_id]);
      if (leaveType && !leaveType.is_unpaid) {
        const usedRow = db.queryOne(`
          SELECT COALESCE(SUM(days_count), 0) as used
          FROM leave_requests
          WHERE employee_id = ? AND leave_type_id = ? AND status = 'approved' AND id != ?
        `, [leave.employee_id, leave.leave_type_id, id]);

        const currentUsed = usedRow ? usedRow.used : 0;
        const remaining = leaveType.yearly_quota - currentUsed;

        if (leave.days_count > remaining) {
          return res.status(422).json({
            error: `Cannot approve leave: Exceeds quota. Employee only has ${remaining} day(s) remaining for ${leaveType.name} leave (requested: ${leave.days_count}).`
          });
        }
      }
    }

    db.run(`
      UPDATE leave_requests SET
        status = ?,
        reviewed_by = ?,
        review_comment = ?,
        reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, req.user.id, review_comment || '', id]);

    // Send in-app notification to the employee
    const empUser = db.queryOne("SELECT id FROM users WHERE employee_id = ?", [leave.employee_id]);
    if (empUser) {
      await createNotification(
        empUser.id,
        `Leave Request ${status.toUpperCase()}`,
        `Your leave request from ${leave.start_date} to ${leave.end_date} has been ${status}.${review_comment ? ' Comment: ' + review_comment : ''}`,
        'leave'
      );
    }

    await logAuditAction({
      req,
      action: `REVIEW_LEAVE_${status.toUpperCase()}`,
      entity: 'leave_requests',
      entity_id: id,
      before_json: leave,
      after_json: { status, review_comment }
    });

    res.json({ message: `Leave request ${status}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getLeaveBalances,
  applyLeave,
  getLeaves,
  cancelLeave,
  reviewLeave
};
