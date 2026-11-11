const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.post('/chat', authenticateToken, aiController.chat);
router.post('/summarize', authenticateToken, requireRole(['Admin', 'HR']), aiController.summarizeDashboard);
router.post('/smart-leave', authenticateToken, aiController.parseSmartLeave);

module.exports = router;
