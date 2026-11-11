const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/status', authController.getStatus);
router.post('/first-run', authController.firstRunSetup);
router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.getMe);
router.post('/change-password', authenticateToken, authController.changePassword);
router.put('/profile', authenticateToken, authController.updateSelfProfile);

module.exports = router;
