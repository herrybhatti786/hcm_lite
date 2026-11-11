const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const wasmPath = path.join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const dbPath = path.join(root, 'backend', 'data', 'hcm_lite.sqlite');

console.log('Reading wasm from:', wasmPath);
const wasmBuf = fs.readFileSync(wasmPath);
const wasmOut = path.join(root, 'backend', 'src', 'db', 'sqlWasmBinary.js');
fs.writeFileSync(wasmOut, `// Auto-generated self-contained WebAssembly binary for Vercel/serverless environments
module.exports = Buffer.from('${wasmBuf.toString('base64')}', 'base64');
`);
console.log('Generated sqlWasmBinary.js (Bytes:', fs.statSync(wasmOut).size, ')');

console.log('Reading seed db from:', dbPath);
const dbBuf = fs.readFileSync(dbPath);
const dbOut = path.join(root, 'backend', 'src', 'db', 'seedDbBinary.js');
fs.writeFileSync(dbOut, `// Auto-generated self-contained seed database for Vercel/serverless environments
module.exports = Buffer.from('${dbBuf.toString('base64')}', 'base64');
`);
console.log('Generated seedDbBinary.js (Bytes:', fs.statSync(dbOut).size, ')');
