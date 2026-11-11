const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const wasmBinary = require('./sqlWasmBinary');
const seedDbBinary = require('./seedDbBinary');

const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION);
const LOCAL_DB_PATH = path.join(__dirname, '..', '..', 'data', 'hcm_lite.sqlite');
const VERCEL_DB_PATH = path.join('/tmp', 'hcm_lite.sqlite');

const DB_PATH = isVercel ? VERCEL_DB_PATH : LOCAL_DB_PATH;

let dbInstance = null;

// Ensure data folder exists
try {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch (err) {
  // Ignore read-only or container errors
}

async function getDatabase() {
  if (dbInstance) return dbInstance;

  // Initialize SQL.js with self-contained in-memory WASM binary
  const SQL = await initSqlJs({ wasmBinary });
  let rawDb;

  // Check if a saved database exists on disk (e.g. in /tmp on Vercel or locally)
  if (fs.existsSync(DB_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_PATH);
      rawDb = new SQL.Database(fileBuffer);
    } catch (err) {
      console.warn('Could not read DB_PATH from disk, falling back to embedded seed DB:', err.message);
      rawDb = new SQL.Database(seedDbBinary);
    }
  } else {
    // If not on disk yet, initialize with the embedded seed DB
    rawDb = new SQL.Database(seedDbBinary);
    try {
      fs.writeFileSync(DB_PATH, Buffer.from(rawDb.export()));
    } catch (err) {
      // Ignore if write fails
    }
  }

  rawDb.run("PRAGMA foreign_keys = ON;");

  // Save helper
  const save = () => {
    try {
      const data = rawDb.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (err) {
      console.error('Error saving SQLite database file:', err.message);
    }
  };

  const executeRun = (sql, params = []) => {
    rawDb.run(sql, params);
    const res = rawDb.exec("SELECT last_insert_rowid() AS id;");
    const lastId = (res && res[0] && res[0].values && res[0].values[0]) ? res[0].values[0][0] : null;
    save();
    return { lastInsertRowid: lastId };
  };

  const queryAll = (sql, params = []) => {
    const stmt = rawDb.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  };

  const queryOne = (sql, params = []) => {
    const rows = queryAll(sql, params);
    return rows.length > 0 ? rows[0] : null;
  };

  dbInstance = {
    rawDb: rawDb,
    run: executeRun,
    query: queryAll,
    queryOne: queryOne,
    save: save,
    exec: (sql) => {
      rawDb.exec(sql);
      save();
    }
  };

  return dbInstance;
}

function closeDatabase() {
  dbInstance = null;
}

module.exports = { getDatabase, closeDatabase, DB_PATH };
