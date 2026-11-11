const fs = require('fs');
const path = require('path');
const { getDatabase, closeDatabase, DB_PATH } = require('./database');
const { initSchema } = require('./initSchema');

async function resetDb() {
  console.log('🔄 Resetting HCM Lite database to blank state...');
  closeDatabase();
  
  // Remove existing sqlite database files
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log(`   Removed ${DB_PATH}`);
  }

  const legacyDb = path.join(__dirname, '..', '..', 'hcm_lite.sqlite');
  if (fs.existsSync(legacyDb)) {
    fs.unlinkSync(legacyDb);
    console.log(`   Removed redundant ${legacyDb}`);
  }

  // Initialize fresh schema with empty tables
  const db = await getDatabase();
  await initSchema(db);

  const usersCount = db.queryOne("SELECT COUNT(*) as count FROM users");
  const settingsCount = db.queryOne("SELECT COUNT(*) as count FROM settings");
  const leaveTypes = db.queryOne("SELECT COUNT(*) as count FROM leave_types");

  console.log(`✅ Database reset complete:`);
  console.log(`   - Users: ${usersCount ? usersCount.count : 0} (Blank)`);
  console.log(`   - Settings: ${settingsCount ? settingsCount.count : 0} (Blank)`);
  console.log(`   - Leave Types: ${leaveTypes ? leaveTypes.count : 0} (Default Annual, Sick, Casual, Unpaid)`);
  console.log(`   - Ready for First-Run Setup Wizard!`);
}

if (require.main === module) {
  resetDb().catch(err => {
    console.error('Failed to reset database:', err);
    process.exit(1);
  });
}

module.exports = { resetDb };
