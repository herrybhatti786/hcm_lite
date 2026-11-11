const express = require('express');
const router = express.Router();
const orgController = require('../controllers/orgController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// Settings
router.get('/settings', authenticateToken, orgController.getSettings);
router.put('/settings', authenticateToken, requireRole(['Admin']), orgController.updateSettings);

// Departments
router.get('/departments', authenticateToken, orgController.getDepartments);
router.post('/departments', authenticateToken, requireRole(['Admin']), orgController.createDepartment);
router.put('/departments/:id', authenticateToken, requireRole(['Admin']), orgController.updateDepartment);
router.delete('/departments/:id', authenticateToken, requireRole(['Admin']), orgController.deleteDepartment);

// Designations
router.get('/designations', authenticateToken, orgController.getDesignations);
router.post('/designations', authenticateToken, requireRole(['Admin']), orgController.createDesignation);

// Leave Types
router.get('/leave-types', authenticateToken, orgController.getLeaveTypes);
router.put('/leave-types/:id', authenticateToken, requireRole(['Admin']), orgController.updateLeaveType);

// Holidays
router.get('/holidays', authenticateToken, orgController.getHolidays);
router.post('/holidays', authenticateToken, requireRole(['Admin']), orgController.createHoliday);
router.delete('/holidays/:id', authenticateToken, requireRole(['Admin']), orgController.deleteHoliday);

// User Management (Admin only)
router.get('/users', authenticateToken, requireRole(['Admin']), orgController.getUsers);
router.post('/users/hr', authenticateToken, requireRole(['Admin']), orgController.createHRUser);
router.patch('/users/:id/toggle-status', authenticateToken, requireRole(['Admin']), orgController.toggleUserStatus);
router.post('/users/:id/reset-password', authenticateToken, requireRole(['Admin']), orgController.resetUserPassword);

module.exports = router;
