/**
 * test-security-audit.js — Comprehensive Automated Security & Rate Limiting Audit Suite
 * Validates RLS rules, server-side rate limits, payload limits, auth safety, and secret isolation.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== RUNNING HAYYIZ SECURITY & AUDIT TEST SUITE ===\n');

let passedTests = 0;

function runTest(name, fn) {
    try {
        fn();
        console.log(`✅ PASS: ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`❌ FAIL: ${name}`);
        console.error(err);
        process.exit(1);
    }
}

// 1. Audit SQL Migration File for Security Standards
runTest('SQL Security: db-pre-request function set_config response.status 429 with session scope', () => {
    const sql = fs.readFileSync(path.join(__dirname, 'supabase-schema-and-security.sql'), 'utf8');
    assert.ok(sql.includes("PERFORM set_config('response.status', '429', FALSE);"),
        'db-pre-request must set HTTP status 429 with is_local=FALSE for PostgREST exception retention');
    assert.ok(sql.includes("pgrst.db_pre_request = 'private.pre_request'"),
        'PostgREST db-pre-request setting must register private.pre_request');
    assert.ok(sql.includes("GRANT EXECUTE ON FUNCTION private.pre_request() TO authenticator;"),
        'private.pre_request must grant EXECUTE to authenticator role');
});

runTest('SQL Security: Trigger returns OLD on DELETE operations', () => {
    const sql = fs.readFileSync(path.join(__dirname, 'supabase-schema-and-security.sql'), 'utf8');
    assert.ok(sql.includes("IF TG_OP = 'DELETE' THEN"), 'Trigger missing TG_OP = DELETE handling');
    assert.ok(sql.includes("RETURN OLD;"), 'Trigger must return OLD on DELETE');
});

runTest('SQL Security: private.check_rate_limit uses row locking FOR UPDATE', () => {
    const sql = fs.readFileSync(path.join(__dirname, 'supabase-schema-and-security.sql'), 'utf8');
    assert.ok(sql.includes('SELECT * INTO rec FROM private.rate_limits WHERE key = p_key FOR UPDATE;'),
        'Rate limit check must lock row with FOR UPDATE to prevent race conditions');
});

runTest('SQL Security: All SECURITY DEFINER functions set search_path = \'\'', () => {
    const sql = fs.readFileSync(path.join(__dirname, 'supabase-schema-and-security.sql'), 'utf8');
    const matches = sql.match(/SECURITY DEFINER/g) || [];
    const searchPathMatches = sql.match(/SET search_path = ''/g) || [];
    assert.strictEqual(matches.length, searchPathMatches.length,
        'All SECURITY DEFINER functions must set search_path = \'\'');
});

runTest('SQL Security: RLS policies strictly enforce auth.uid() = user_id', () => {
    const sql = fs.readFileSync(path.join(__dirname, 'supabase-schema-and-security.sql'), 'utf8');
    assert.ok(sql.includes('auth.uid() = user_id'), 'RLS policies must check auth.uid() = user_id');
});

runTest('SQL Security: Private schema permissions revoked from public, anon, and authenticated', () => {
    const sql = fs.readFileSync(path.join(__dirname, 'supabase-schema-and-security.sql'), 'utf8');
    assert.ok(sql.includes('REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated;'),
        'Private tables must be revoked from public');
    assert.ok(sql.includes('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;'),
        'Private functions must be revoked from public');
});

runTest('SQL Security: cleanup_old_tombstones revoked from authenticated and granted to service_role', () => {
    const sql = fs.readFileSync(path.join(__dirname, 'supabase-schema-and-security.sql'), 'utf8');
    assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.cleanup_old_tombstones(INT) FROM PUBLIC, anon, authenticated;'),
        'cleanup_old_tombstones must be revoked from public/anon/authenticated');
    assert.ok(sql.includes('GRANT EXECUTE ON FUNCTION public.cleanup_old_tombstones(INT) TO service_role;'),
        'cleanup_old_tombstones must be granted only to service_role');
});

// 2. Client Code Base Secret Leak Audit
runTest('Secret Audit: No service_role key present in client JavaScript files', () => {
    const jsFiles = ['supabase.js', 'sync.js', 'auth-ui.js', 'common.js'];
    jsFiles.forEach(file => {
        const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
        assert.ok(!content.includes('service_role'), `File ${file} contains reference to service_role!`);
        assert.ok(!content.includes('secret'), `File ${file} contains reference to secret!`);
    });
});

runTest('Client IP Audit: No reliance on client-supplied IP headers (x-forwarded-for / cf-connecting-ip)', () => {
    const jsFiles = ['supabase.js', 'sync.js', 'auth-ui.js'];
    jsFiles.forEach(file => {
        const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
        assert.ok(!content.includes('x-forwarded-for'), `File ${file} relies on x-forwarded-for header!`);
        assert.ok(!content.includes('cf-connecting-ip'), `File ${file} relies on cf-connecting-ip header!`);
    });
});

// 3. Auth UI & Error Handling Simulation
runTest('Auth UI: Rate limit HTTP 429 returns friendly Arabic error message', () => {
    const authUiJs = fs.readFileSync(path.join(__dirname, 'auth-ui.js'), 'utf8');
    assert.ok(authUiJs.includes("status === 429 || msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('over_email_send_rate_limit')"),
        'auth-ui.js must detect status 429 and rate limit codes');
    assert.ok(authUiJs.includes('تم تجاوز حد الطلبات المسموح به'),
        'auth-ui.js must translate rate limits to Arabic message');
});

console.log(`\n===================================`);
console.log(`SECURITY AUDIT RESULTS: ${passedTests} Passed, 0 Failed`);
console.log(`===================================\n`);
