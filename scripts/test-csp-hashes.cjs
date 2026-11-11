'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const htmlFiles = fs.readdirSync(root).filter(file => file.toLowerCase().endsWith('.html'));
let checkedPages = 0;
let checkedInlineScripts = 0;

for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    const meta = /<meta\b[^>]*http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*>/i.exec(html);
    if (!meta) continue;

    checkedPages += 1;
    const content = /\bcontent\s*=\s*(["'])([\s\S]*?)\1/i.exec(meta[0]);
    assert.ok(content, `${file}: CSP meta tag must have a content attribute`);

    const directives = new Map();
    for (const raw of content[2].split(';')) {
        const tokens = raw.trim().split(/\s+/).filter(Boolean);
        if (tokens.length) directives.set(tokens[0], tokens.slice(1));
    }

    const scriptSrc = directives.get('script-src') || directives.get('default-src') || [];
    const scriptElem = directives.get('script-src-elem') || scriptSrc;
    assert.ok(!scriptSrc.includes("'unsafe-inline'"), `${file}: script-src must not allow unsafe-inline`);
    assert.ok(!scriptElem.includes("'unsafe-inline'"), `${file}: script-src-elem must not allow unsafe-inline`);
    assert.ok(
        (directives.get('script-src-attr') || []).includes("'none'"),
        `${file}: inline event-handler attributes must be blocked`
    );

    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
        if (/\bsrc\s*=/i.test(match[1]) || !match[2].trim()) continue;
        const digest = crypto.createHash('sha256').update(match[2], 'utf8').digest('base64');
        const token = `'sha256-${digest}'`;
        assert.ok(scriptSrc.includes(token), `${file}: inline script hash missing from script-src (${digest})`);
        assert.ok(scriptElem.includes(token), `${file}: inline script hash missing from script-src-elem (${digest})`);
        checkedInlineScripts += 1;
    }

    if (file === 'workspaces.html') {
        assert.ok(
            !html.toLowerCase().includes('onclick='),
            'workspaces.html: the guest login button must not use an inline click handler'
        );
    }
}

assert.ok(checkedPages > 0, 'No HTML pages with CSP were checked');
assert.ok(checkedInlineScripts > 0, 'No inline script hashes were checked');
console.log(`CSP hash checks passed: ${checkedPages} pages, ${checkedInlineScripts} inline scripts.`);
