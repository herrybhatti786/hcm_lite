const { getDatabase } = require('../db/database');
const { logAuditAction } = require('../middleware/auditMiddleware');
const { notifyRole } = require('../utils/notificationService');

// Announcements
async function getAnnouncements(req, res) {
  try {
    const db = await getDatabase();
    const rows = db.query(`
      SELECT a.*, u.email as author_email, u.role as author_role
      FROM announcements a
      LEFT JOIN users u ON a.posted_by = u.id
      ORDER BY a.id DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createAnnouncement(req, res) {
  try {
    const { title, content, priority = 'normal' } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required.' });
    }

    const db = await getDatabase();
    const result = db.run(`
      INSERT INTO announcements (title, content, priority, posted_by)
      VALUES (?, ?, ?, ?)
    `, [title.trim(), content.trim(), priority, req.user.id]);

    const created = db.queryOne("SELECT * FROM announcements WHERE id = ?", [result.lastInsertRowid]);

    // Send notifications to everyone
    const allUsers = db.query("SELECT id FROM users WHERE id != ?", [req.user.id]);
    for (const u of allUsers) {
      db.run(
        "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'announcement')",
        [u.id, `New Announcement: ${title.trim()}`, content.slice(0, 100) + '...']
      );
    }

    await logAuditAction({
      req,
      action: 'CREATE_ANNOUNCEMENT',
      entity: 'announcements',
      entity_id: created.id,
      after_json: created
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Notifications
async function getNotifications(req, res) {
  try {
    const db = await getDatabase();
    const rows = db.query(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY id DESC LIMIT 30
    `, [req.user.id]);

    const unreadCount = db.queryOne(`
      SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0
    `, [req.user.id]);

    res.json({
      notifications: rows,
      unreadCount: unreadCount ? unreadCount.count : 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function markNotificationsRead(req, res) {
  try {
    const db = await getDatabase();
    db.run("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [req.user.id]);
    res.json({ message: 'Notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Audit Logs (Admin only)
async function getAuditLogs(req, res) {
  try {
    const db = await getDatabase();
    const { action = '', entity = '', limit = 100 } = req.query;

    let sql = "SELECT * FROM audit_logs WHERE 1=1";
    const params = [];

    if (action) {
      sql += " AND action = ?";
      params.push(action);
    }

    if (entity) {
      sql += " AND entity = ?";
      params.push(entity);
    }

    sql += " ORDER BY id DESC LIMIT ?";
    params.push(Number(limit));

    const rows = db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAnnouncements,
  createAnnouncement,
  getNotifications,
  markNotificationsRead,
  getAuditLogs
};
