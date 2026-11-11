const express = require('express');
const router = express.Router();
const commsController = require('../controllers/commsController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// Announcements
router.get('/announcements', authenticateToken, commsController.getAnnouncements);
router.post('/announcements', authenticateToken, requireRole(['Admin', 'HR']), commsController.createAnnouncement);

// Notifications
router.get('/notifications', authenticateToken, commsController.getNotifications);
router.patch('/notifications/mark-read', authenticateToken, commsController.markNotificationsRead);

// Audit Logs (Admin only)
router.get('/audit-logs', authenticateToken, requireRole(['Admin']), commsController.getAuditLogs);

module.exports = router;
