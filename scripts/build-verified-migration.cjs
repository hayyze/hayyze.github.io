// Emit one atomic migration whose synthetic verification rows are always rolled back.
const fs = require('node:fs');
const path = require('node:path');
const migrationPath = process.argv[2];
if (!migrationPath) throw new Error('Pass the targeted migration SQL path.');
const migration = fs.readFileSync(migrationPath, 'utf8');
const tests = fs.readFileSync(path.join(__dirname, 'test-database-security.sql'), 'utf8');
const begin = tests.indexOf('\nBEGIN;');
const end = tests.lastIndexOf('\nROLLBACK;');
if (begin < 0 || end <= begin || tests.slice(end + '\nROLLBACK;'.length).trim()) {
    throw new Error('Expected one explicitly wrapped verification script.');
}
const checks = tests.slice(begin + '\nBEGIN;'.length, end);
const marker = '$hayyiz_transactional_checks$';
if (checks.includes(marker)) throw new Error('Verification delimiter collision.');
process.stdout.write(migration + `
-- Assert real roles/RLS/RPCs before committing the DDL. Roll back only fixtures
-- on success; every unexpected assertion error aborts the entire migration.
DO $hayyiz_atomic_verification$
BEGIN
    BEGIN
        EXECUTE ${marker}${checks}${marker};
        RAISE EXCEPTION USING ERRCODE = 'ZX001', MESSAGE = 'Hayyiz verification passed; discard fixtures';
    EXCEPTION WHEN SQLSTATE 'ZX001' THEN
        NULL;
    END;
END;
$hayyiz_atomic_verification$;
`);
