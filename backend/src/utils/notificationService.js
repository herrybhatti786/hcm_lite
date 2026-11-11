const { getDatabase } = require('../db/database');

async function createNotification(userId, title, message, type = 'info') {
  try {
    const db = await getDatabase();
    db.run(
      "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)",
      [userId, title, message, type]
    );
  } catch (err) {
    console.error('Error creating notification:', err);
  }
}

async function notifyRole(role, title, message, type = 'info') {
  try {
    const db = await getDatabase();
    const users = db.query("SELECT id FROM users WHERE role = ?", [role]);
    for (const u of users) {
      await createNotification(u.id, title, message, type);
    }
  } catch (err) {
    console.error('Error notifying role:', err);
  }
}

module.exports = {
  createNotification,
  notifyRole
};
