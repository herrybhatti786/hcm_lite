const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.post('/check-in', authenticateToken, attendanceController.checkIn);
router.post('/check-out', authenticateToken, attendanceController.checkOut);
router.get('/today', authenticateToken, attendanceController.getTodayStatus);
router.get('/board', authenticateToken, attendanceController.getAttendanceBoard);

// Attendance corrections
router.post('/corrections', authenticateToken, attendanceController.requestCorrection);
router.get('/corrections', authenticateToken, attendanceController.getCorrections);
router.patch('/corrections/:id/review', authenticateToken, requireRole(['HR']), attendanceController.reviewCorrection);

module.exports = router;
