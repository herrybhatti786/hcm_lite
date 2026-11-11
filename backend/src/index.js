process.env.TZ = process.env.TZ || 'Asia/Karachi';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDatabase } = require('./db/database');
const { initSchema } = require('./db/initSchema');

const authRoutes = require('./routes/authRoutes');
const orgRoutes = require('./routes/orgRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const aiRoutes = require('./routes/aiRoutes');
const commsRoutes = require('./routes/commsRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable robust CORS & JSON parsing
const rawOrigins = process.env.ALLOWED_ORIGINS;
let corsOrigin = '*';
if (rawOrigins && rawOrigins.trim() !== '*') {
  const list = rawOrigins.split(',').map(o => o.trim()).filter(Boolean);
  if (list.length > 0 && !list.includes('*')) {
    corsOrigin = list;
  }
}

app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Prevent browser and CDN caching of dynamic API responses
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Lazy DB Schema Initializer (supports both persistent servers and Vercel serverless functions)
let dbInitPromise = null;
async function ensureDbInitialized() {
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      const db = await getDatabase();
      await initSchema(db);
      return db;
    })();
  }
  return dbInitPromise;
}

// Middleware ensuring schema is loaded before any route handler runs
app.use((req, res, next) => {
  ensureDbInitialized()
    .then(() => next())
    .catch((err) => {
      console.error('Database initialization error:', err);
      res.status(500).json({ error: 'Database initialization failed: ' + err.message });
    });
});

// Register API Routes (mounted under both /api and root to guarantee 100% compatibility with Vercel rewrites)
function registerRoutes(prefix = '') {
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/org`, orgRoutes);
  app.use(`${prefix}/employees`, employeeRoutes);
  app.use(`${prefix}/attendance`, attendanceRoutes);
  app.use(`${prefix}/leave`, leaveRoutes);
  app.use(`${prefix}/payroll`, payrollRoutes);
  app.use(`${prefix}/analytics`, analyticsRoutes);
  app.use(`${prefix}/ai`, aiRoutes);
  app.use(`${prefix}/comms`, commsRoutes);
}

registerRoutes('/api');
registerRoutes('');

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), system: 'HCM Lite' });
});
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), system: 'HCM Lite' });
});

// Serve frontend build if exists
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  const indexPath = path.join(frontendDist, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ message: 'HCM Lite Backend API is running on port ' + PORT });
  }
});

// Start server after DB initialization
async function startServer(port = PORT) {
  try {
    await ensureDbInitialized();
    console.log('✅ SQLite Database & Schema initialized successfully.');

    return new Promise((resolve) => {
      const server = app.listen(port, '0.0.0.0', () => {
        console.log(`🚀 HCM Lite Backend running at http://0.0.0.0:${port}`);
        resolve(server);
      });
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, ensureDbInitialized };
