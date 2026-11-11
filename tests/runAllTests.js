// Unified Test Runner for HCM Lite
const { spawnSync } = require('child_process');
const path = require('path');

console.log('===============================================================');
console.log('🚀 RUNNING HCM LITE COMPLETE TEST SUITE');
console.log('===============================================================\n');

const testFiles = [
  path.join(__dirname, 'test_hcm_flows.js'),
  path.join(__dirname, 'test_backend_fixes.js')
];

let allPassed = true;

for (const testFile of testFiles) {
  const result = spawnSync('node', [testFile], { stdio: 'inherit' });
  if (result.status !== 0) {
    allPassed = false;
    console.error(`\n❌ Test failed: ${path.basename(testFile)} (exit code ${result.status})`);
    break;
  }
}

if (!allPassed) {
  process.exit(1);
} else {
  console.log('\n===============================================================');
  console.log('🏆 ALL SUITES PASSED: 100% SUCCESS');
  console.log('===============================================================');
  process.exit(0);
}
