const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, employeeController.getEmployees);
router.get('/export-csv', authenticateToken, requireRole(['Admin', 'HR']), employeeController.csvExport);
router.get('/:id', authenticateToken, employeeController.getEmployeeById);
router.post('/', authenticateToken, requireRole(['Admin', 'HR']), employeeController.registerEmployee);
router.put('/:id', authenticateToken, requireRole(['Admin', 'HR']), employeeController.updateEmployee);
router.post('/import-csv', authenticateToken, requireRole(['HR']), employeeController.csvImport);

module.exports = router;
