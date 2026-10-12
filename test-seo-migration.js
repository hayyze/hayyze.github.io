/* test-seo-migration.js - Automated SEO Domain Migration Audit Suite */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== RUNNING AUTOMATED SEO DOMAIN MIGRATION AUDIT SUITE ===\n');

const DOMAIN = 'https://hayyze.hayyze.workers.dev';
const OLD_DOMAIN = 'https://hayyze.github.io';

const htmlFiles = fs.readdirSync('.').filter(file => file.endsWith('.html') && !file.startsWith('google'));

console.log(`Found ${htmlFiles.length} HTML files in root directory to audit.`);

let totalAuditedPages = 0;

htmlFiles.forEach(file => {
    totalAuditedPages++;
    const content = fs.readFileSync(file, 'utf8');

    // 1. Verify zero legacy domain references in HTML
    assert(!content.includes(OLD_DOMAIN), `[${file}] Contains legacy domain: ${OLD_DOMAIN}`);

    // Normalized content without line breaks or multi-space formatting for tag checking
    const normalizedContent = content.replace(/\s+/g, ' ');

    // 2. Canonical URL validation
    const expectedCanonicalPath = file === 'index.html' ? '/' : `/${file}`;
    const canonicalMatch = normalizedContent.match(/<link\s+rel="canonical"\s+href="([^"]+)"\s*\/?>/i) ||
                           normalizedContent.match(/<link\s+href="([^"]+)"\s+rel="canonical"\s*\/?>/i);
    assert(canonicalMatch, `[${file}] Missing canonical tag.`);
    assert.strictEqual(canonicalMatch[1], `${DOMAIN}${expectedCanonicalPath}`, `[${file}] Canonical tag mismatch. Found: ${canonicalMatch[1]}`);

    // 3. OpenGraph og:url validation
    const ogUrlMatch = normalizedContent.match(/<meta\s+property="og:url"\s+content="([^"]+)"\s*\/?>/i) ||
                       normalizedContent.match(/<meta\s+content="([^"]+)"\s+property="og:url"\s*\/?>/i);
    assert(ogUrlMatch, `[${file}] Missing og:url meta tag.`);
    assert.strictEqual(ogUrlMatch[1], `${DOMAIN}${expectedCanonicalPath}`, `[${file}] og:url mismatch. Found: ${ogUrlMatch[1]}`);

    // 4. og:image & twitter:image validation
    const ogImageMatches = content.match(/<meta\s+(?:property="og:image"|name="twitter:image")\s+content="([^"]+)"/g) || [];
    ogImageMatches.forEach(tag => {
        const urlMatch = tag.match(/content="([^"]+)"/);
        if (urlMatch && urlMatch[1]) {
            const imgUrl = urlMatch[1];
            assert(imgUrl.startsWith(DOMAIN), `[${file}] Image meta URL does not start with new domain: ${imgUrl}`);

            // Check that image asset file exists locally
            const localPath = imgUrl.replace(`${DOMAIN}/`, '');
            assert(fs.existsSync(localPath), `[${file}] Referenced image asset file does not exist locally: ${localPath}`);
        }
    });

    // 5. JSON-LD Structured Data domain check
    const jsonLdScripts = content.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || [];
    jsonLdScripts.forEach(scriptTag => {
        assert(!scriptTag.includes(OLD_DOMAIN), `[${file}] JSON-LD contains legacy domain: ${OLD_DOMAIN}`);
    });
});

console.log(`✅ PASS: All ${totalAuditedPages} HTML pages verified for canonical, og:url, images, and JSON-LD structure.`);

// 6. Sitemap.xml & robots.txt Validation
console.log('Auditing sitemap.xml and robots.txt...');

assert(fs.existsSync('sitemap.xml'), 'sitemap.xml must exist');
assert(fs.existsSync('robots.txt'), 'robots.txt must exist');

const sitemapContent = fs.readFileSync('sitemap.xml', 'utf8');
const robotsContent = fs.readFileSync('robots.txt', 'utf8');

// Ensure no old domain references in sitemap or robots
assert(!sitemapContent.includes(OLD_DOMAIN), 'sitemap.xml contains legacy domain references');
assert(!robotsContent.includes(OLD_DOMAIN), 'robots.txt contains legacy domain references');

// Verify sitemap directive in robots.txt
assert(robotsContent.includes(`Sitemap: ${DOMAIN}/sitemap.xml`), 'robots.txt must point to Cloudflare sitemap.xml URL');

// Verify all <loc> entries in sitemap.xml
const locMatches = sitemapContent.match(/<loc>(.*?)<\/loc>/g) || [];
assert(locMatches.length > 0, 'sitemap.xml must contain at least one <loc> entry');

locMatches.forEach(locTag => {
    const url = locTag.replace('<loc>', '').replace('</loc>', '');
    assert(url.startsWith(DOMAIN), `Sitemap <loc> URL does not use new domain: ${url}`);

    // Extract local file path and confirm file existence
    let relativePath = url.replace(`${DOMAIN}/`, '').replace(`${DOMAIN}`, '');
    if (relativePath === '' || relativePath === '/') {
        relativePath = 'index.html';
    }
    assert(fs.existsSync(relativePath), `Sitemap <loc> points to non-existent file: ${relativePath}`);
});

console.log(`✅ PASS: sitemap.xml contains ${locMatches.length} valid URLs pointing to existing files, and robots.txt correctly references sitemap.`);

console.log('\n===================================');
console.log('SEO DOMAIN MIGRATION AUDIT RESULTS: ALL PASSED');
console.log('===================================\n');
