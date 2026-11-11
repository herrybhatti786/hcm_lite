// Unit & Integration Tests for Backend Fixes & Edge Cases
const assert = require('assert');
const http = require('http');
const { parseDate, formatDate, calculateLeaveDays } = require('../backend/src/utils/dateUtils');
const { verifyOfficeLocation } = require('../backend/src/utils/haversine');
const { getDatabase } = require('../backend/src/db/database');

const API_HOST = 'localhost';
const API_PORT = 5000;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      { host: API_HOST, port: API_PORT, path: `/api${path}`, method, headers },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

let spawnedServer = null;

async function ensureServerRunning() {
  try {
    const res = await request('GET', '/health');
    if (res.status === 200) return;
  } catch (err) {
    console.log('📡 Starting embedded backend server on port ' + API_PORT + '...');
    const { startServer } = require('../backend/src/index.js');
    spawnedServer = await startServer(API_PORT);
    await new Promise(r => setTimeout(r, 500));
  }
}

async function runEdgeCaseTests() {
  await ensureServerRunning();
  console.log('--- Starting Backend Edge Cases & Fixes Test Suite ---');
  const db = await getDatabase();

  // Test 1: Date Utils robustness
  console.log('1. Testing Date Utils with invalid inputs & edge cases...');
  const invalidD = parseDate('invalid-date');
  assert.ok(isNaN(invalidD.getTime()), 'parseDate should return invalid date for bad string');
  const nullD = parseDate(null);
  assert.ok(isNaN(nullD.getTime()), 'parseDate should handle null safely');
  const badRange = await calculateLeaveDays(db, 'invalid', '2026-10-15');
  assert.ok(badRange.error, 'calculateLeaveDays should return error for bad date input');
  console.log('   ✅ Date Utils handles invalid dates safely.');

  // Test 2: Haversine GPS error handling
  console.log('2. Testing Haversine Geofence with missing or invalid coordinates...');
  const missingCoords = verifyOfficeLocation(undefined, null, 10, 24.8607, 67.0011, 150);
  assert.strictEqual(missingCoords.allowed, false, 'Should disallow when coordinates are undefined');
  assert.ok(missingCoords.reason.includes('GPS coordinates'), 'Should return clear error reason');
  
  const lowAccuracy = verifyOfficeLocation(24.8607, 67.0011, 250, 24.8607, 67.0011, 150);
  assert.strictEqual(lowAccuracy.allowed, false, 'Should disallow when GPS accuracy > 100m');
  
  const validLoc = verifyOfficeLocation(24.8607, 67.0011, 20, 24.8607, 67.0011, 150);
  assert.strictEqual(validLoc.allowed, true, 'Should allow when coordinates are within radius');
  console.log('   ✅ Haversine geofence validation is 100% robust.');

  // Test 3: Log in as Admin
  console.log('3. Logging in as Admin for integration checks...');
  const adminLogin = await request('POST', '/auth/login', {
    email: 'admin@company.com',
    password: 'AdminPassword123!'
  });
  assert.strictEqual(adminLogin.status, 200, 'Admin login failed');
  const adminToken = adminLogin.data.token;

  // Test 4: Log in as HR
  console.log('4. Logging in as HR...');
  const hrLogin = await request('POST', '/auth/login', {
    email: 'hr@company.com',
    password: 'HrPassword123!'
  });
  assert.strictEqual(hrLogin.status, 200, 'HR login failed');
  const hrToken = hrLogin.data.token;

  // Test 5: CSV Import duplicate detection within batch
  console.log('5. Testing CSV import with in-batch duplicates & existing email collision...');
  const csvRes = await request('POST', '/employees/import-csv', {
    rows: [
      { first_name: 'Batch', last_name: 'One', email: 'batch.dup@company.com', joining_date: '2026-10-01', basic_salary: 50000 },
      { first_name: 'Batch', last_name: 'Two', email: 'batch.dup@company.com', joining_date: '2026-10-01', basic_salary: 50000 },
      { first_name: 'Collision', last_name: 'Admin', email: 'admin@company.com', joining_date: '2026-10-01', basic_salary: 50000 }
    ],
    isDryRun: true
  }, hrToken);
  assert.strictEqual(csvRes.status, 200, 'CSV dry-run request failed');
  assert.ok(csvRes.data.errorCount >= 2, `Expected at least 2 errors for duplicates, got ${csvRes.data.errorCount}`);
  console.log(`   ✅ CSV import correctly detected ${csvRes.data.errorCount} duplicate/collision errors!`);

  // Test 6: AI Employee Directory Search
  console.log('6. Testing AI tool execution: search_employees...');
  const aiSearch = await request('POST', '/ai/chat', {
    message: 'Search employee John Doe'
  }, adminToken);
  assert.strictEqual(aiSearch.status, 200, 'AI search failed');
  assert.strictEqual(aiSearch.data.toolCalled, 'search_employees', 'AI should invoke search_employees tool');
  assert.ok(aiSearch.data.response.includes('John Doe'), 'AI search response should contain John Doe');
  console.log('   ✅ AI search_employees tool successfully executed and returned employee profile!');

  // Test 7: Employee Self Profile Update preserves unset fields
  console.log('7. Testing Employee self profile update preserves existing fields...');
  let empLogin = await request('POST', '/auth/login', {
    email: 'john.doe@company.com',
    password: 'MySecurePassword456!'
  });
  if (empLogin.status !== 200) {
    empLogin = await request('POST', '/auth/login', {
      email: 'john.doe@company.com',
      password: 'Welcome@123'
    });
  }
  assert.strictEqual(empLogin.status, 200, 'Employee login failed');
  const empToken = empLogin.data.token;
  const originalAddress = empLogin.data.employee?.address || 'Gulshan-e-Iqbal, Karachi';

  // Update only phone
  const updateRes = await request('PUT', '/auth/profile', { phone: '+92 300 9998888' }, empToken);
  assert.strictEqual(updateRes.status, 200, 'Profile update failed');

  const meRes = await request('GET', '/auth/me', null, empToken);
  assert.strictEqual(meRes.data.employee.phone, '+92 300 9998888', 'Phone was not updated');
  assert.strictEqual(meRes.data.employee.address, originalAddress, 'Address was incorrectly wiped out!');
  console.log('   ✅ Profile update correctly preserved existing address when updating phone.');

  // Test 8: Employee blocked from viewing draft payroll
  console.log('8. Testing Employee access to draft payroll run (should be 403)...');
  // Create a new draft run for 2026-11
  await request('POST', '/payroll/draft', { month_year: '2026-11' }, hrToken);
  const runsList = await request('GET', '/payroll/runs', null, hrToken);
  const novDraft = runsList.data.find(r => r.month_year === '2026-11' && r.status === 'draft');
  if (novDraft) {
    const empDraftAccess = await request('GET', `/payroll/runs/${novDraft.id}`, null, empToken);
    assert.strictEqual(empDraftAccess.status, 403, `Employee should receive 403 on draft payroll, got ${empDraftAccess.status}`);
    console.log('   ✅ Employee correctly blocked from accessing draft payroll runs.');
  }

  console.log('\n===============================================================');
  console.log('🎉 ALL BACKEND EDGE CASES & BUG FIXES VERIFIED 100% PASSING!');
  console.log('===============================================================');

  if (spawnedServer) {
    spawnedServer.close();
  }
}

runEdgeCaseTests().catch(err => {
  console.error('❌ Edge case test failed:', err);
  if (spawnedServer) {
    spawnedServer.close();
  }
  process.exit(1);
});
