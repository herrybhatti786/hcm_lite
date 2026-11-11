const { getDatabase } = require('../db/database');

async function logAuditAction({
  req,
  actor,
  action,
  entity,
  entity_id,
  before_json = null,
  after_json = null
}) {
  try {
    const db = await getDatabase();
    const actorId = actor ? actor.id : (req && req.user ? req.user.id : null);
    const actorEmail = actor ? actor.email : (req && req.user ? req.user.email : 'system');
    const actorRole = actor ? actor.role : (req && req.user ? req.user.role : 'System');
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') : '';

    db.run(
      `INSERT INTO audit_logs (actor_id, actor_email, actor_role, action, entity, entity_id, before_json, after_json, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        actorId,
        actorEmail,
        actorRole,
        action,
        entity,
        entity_id ? String(entity_id) : null,
        before_json ? JSON.stringify(before_json) : null,
        after_json ? JSON.stringify(after_json) : null,
        String(ip)
      ]
    );
  } catch (err) {
    console.error('Failed to write audit log entry:', err);
  }
}

module.exports = { logAuditAction };
