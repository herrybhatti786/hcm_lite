const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.get('/runs', authenticateToken, requireRole(['Admin', 'HR']), payrollController.getPayrollRuns);
router.get('/runs/:id', authenticateToken, payrollController.getPayrollRunDetails);
router.post('/draft', authenticateToken, requireRole(['HR']), payrollController.createPayrollDraft);
router.post('/runs/:id/finalize', authenticateToken, requireRole(['Admin']), payrollController.finalizePayroll);
router.get('/my-payslips', authenticateToken, payrollController.getMyPayslips);
router.get('/payslips/:id', authenticateToken, payrollController.getPayslip);

module.exports = router;
