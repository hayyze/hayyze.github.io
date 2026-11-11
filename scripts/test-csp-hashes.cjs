'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const htmlFiles = fs.readdirSync(root).filter(file => file.toLowerCase().endsWith('.html'));
let checkedPages = 0;
let checkedInlineScripts = 0;


function findTagEnd(source, start) {
    let quote = '';
    for (let index = start; index < source.length; index += 1) {
        const character = source[index];
        if (quote) {
            if (character === quote) quote = '';
        } else if (character === '"' || character === "'") {
            quote = character;
        } else if (character === '>') {
            return index;
        }
    }
    return -1;
}

function hasAttribute(attributes, wantedName) {
    let index = 0;
    while (index < attributes.length) {
        while (index < attributes.length && (attributes[index] === ' ' ||
            attributes[index] === '\t' || attributes[index] === '\n' ||
            attributes[index] === '\r' || attributes[index] === '/' )) {
            index += 1;
        }
        const nameStart = index;
        while (index < attributes.length && attributes[index] !== ' ' &&
            attributes[index] !== '\t' && attributes[index] !== '\n' &&
            attributes[index] !== '\r' && attributes[index] !== '=' &&
            attributes[index] !== '/') {
            index += 1;
        }
        if (index === nameStart) {
            index += 1;
            continue;
        }
        const name = attributes.slice(nameStart, index).toLowerCase();
        while (index < attributes.length && (attributes[index] === ' ' ||
            attributes[index] === '\t' || attributes[index] === '\n' ||
            attributes[index] === '\r')) {
            index += 1;
        }
        if (attributes[index] === '=') {
            index += 1;
            while (index < attributes.length && (attributes[index] === ' ' ||
                attributes[index] === '\t' || attributes[index] === '\n' ||
                attributes[index] === '\r')) {
                index += 1;
            }
            const quote = attributes[index] === '"' || attributes[index] === "'"
                ? attributes[index++]
                : '';
            if (quote) {
                while (index < attributes.length && attributes[index] !== quote) index += 1;
                if (index < attributes.length) index += 1;
            } else {
                while (index < attributes.length && attributes[index] !== ' ' &&
                    attributes[index] !== '\t' && attributes[index] !== '\n' &&
                    attributes[index] !== '\r') {
                    index += 1;
                }
            }
        }
        if (name === wantedName) return true;
    }
    return false;
}

function readInlineScriptBodies(source) {
    const lower = source.toLowerCase();
    const bodies = [];
    let cursor = 0;
    while (cursor < source.length) {
        const openingStart = lower.indexOf('<script', cursor);
        if (openingStart < 0) break;

        const openingNameEnd = openingStart + 7;
        const following = lower[openingNameEnd];
        if (following && following !== '>' && following !== '/' &&
            following !== ' ' && following !== '\t' &&
            following !== '\n' && following !== '\r') {
            cursor = openingNameEnd;
            continue;
        }

        const openingEnd = findTagEnd(source, openingNameEnd);
        if (openingEnd < 0) break;
        const attributes = source.slice(openingNameEnd, openingEnd);
        const bodyStart = openingEnd + 1;

        let closingStart = lower.indexOf('</script', bodyStart);
        while (closingStart >= 0) {
            const closingFollowing = lower[closingStart + 8];
            if (!closingFollowing || closingFollowing === '>' ||
                closingFollowing === ' ' || closingFollowing === '\t' ||
                closingFollowing === '\n' || closingFollowing === '\r') {
                break;
            }
            closingStart = lower.indexOf('</script', closingStart + 8);
        }
        if (closingStart < 0) break;

        const closingEnd = findTagEnd(source, closingStart + 8);
        if (closingEnd < 0) break;
        const body = source.slice(bodyStart, closingStart);
        if (!hasAttribute(attributes, 'src') && body.trim()) bodies.push(body);
        cursor = closingEnd + 1;
    }
    return bodies;
}

for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    const meta = /<meta\b[^>]*http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*>/i.exec(html);
    if (!meta) continue;

    checkedPages += 1;
    const firstScript = html.search(/<script\b/i);
    assert.ok(firstScript === -1 || meta.index < firstScript, file + ': CSP meta must precede every script');

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

    for (const body of readInlineScriptBodies(html)) {
        const digest = crypto.createHash('sha256').update(body, 'utf8').digest('base64');
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
