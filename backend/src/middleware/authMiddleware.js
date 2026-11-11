const jwt = require('jsonwebtoken');
const { getDatabase } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'hcm_lite_jwt_super_secret_key_2026';

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = await getDatabase();
    
    // Look up fresh user details
    const user = db.queryOne("SELECT id, email, role, employee_id, must_change_password, is_active FROM users WHERE id = ?", [decoded.id]);
    if (!user || user.is_active === 0) {
      return res.status(401).json({ error: 'User account is inactive or not found.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired session token.' });
  }
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Role '${req.user.role}' is not authorized to access this resource.`
      });
    }

    next();
  };
}

// Scope guard to ensure Employee only accesses their own employee record
function enforceEmployeeScope(paramName = 'employeeId') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (req.user.role === 'Employee') {
      const requestedId = req.params[paramName] || req.body[paramName] || req.query[paramName];
      if (requestedId && Number(requestedId) !== Number(req.user.employee_id)) {
        return res.status(403).json({
          error: 'Access denied. You can only view or manage your own employee data.'
        });
      }
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  enforceEmployeeScope,
  JWT_SECRET
};
