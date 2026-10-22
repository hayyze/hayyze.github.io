const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
let failed = false;
for (const file of fs.readdirSync('.').filter(file => /^test-.*\.js$/.test(file)).sort()) {
    const result = spawnSync(process.execPath, [file], { encoding: 'utf8', timeout: 60000 });
    const output = (result.stdout || '') + (result.stderr || '');
    // Older suites report failures in their own summary without a nonzero exit.
    const bad = result.status !== 0 || /❌|\b[1-9]\d* Failed\b/.test(output);
    console.log(`${bad ? 'FAIL' : 'PASS'} ${file}`);
    if (bad) { console.log(output); if (result.error) console.log(result.error.message); failed = true; }
}
process.exitCode = failed ? 1 : 0;
