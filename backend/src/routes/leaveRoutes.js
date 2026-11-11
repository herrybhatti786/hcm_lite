const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.get('/balances', authenticateToken, leaveController.getLeaveBalances);
router.post('/apply', authenticateToken, leaveController.applyLeave);
router.get('/', authenticateToken, leaveController.getLeaves);
router.patch('/:id/cancel', authenticateToken, leaveController.cancelLeave);
router.patch('/:id/review', authenticateToken, requireRole(['HR']), leaveController.reviewLeave);

module.exports = router;
