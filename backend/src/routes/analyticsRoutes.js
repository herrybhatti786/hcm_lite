const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.get('/admin', authenticateToken, requireRole(['Admin']), analyticsController.getAdminDashboard);
router.get('/hr', authenticateToken, requireRole(['Admin', 'HR']), analyticsController.getHRDashboard);
router.get('/employee', authenticateToken, analyticsController.getEmployeeDashboard);

module.exports = router;
