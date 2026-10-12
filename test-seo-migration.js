/* test-seo-migration.js - Automated SEO Domain Migration Audit Suite */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== RUNNING AUTOMATED SEO DOMAIN MIGRATION AUDIT SUITE ===\n');

const DOMAIN = 'https://hayyze.pages.dev';
const OLD_DOMAINS = ['https://hayyze.github.io', 'https://hayyze.hayyze.workers.dev'];

const htmlFiles = fs.readdirSync('.').filter(file => file.endsWith('.html') && !file.startsWith('google'));

console.log(`Found ${htmlFiles.length} HTML files in root directory to audit.`);

let totalAuditedPages = 0;

htmlFiles.forEach(file => {
    totalAuditedPages++;
    const content = fs.readFileSync(file, 'utf8');

    // 1. Verify zero legacy domain references in HTML SEO blocks
    OLD_DOMAINS.forEach(oldDomain => {
        assert(!content.includes(oldDomain), `[${file}] Contains legacy domain: ${oldDomain}`);
    });

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

    // 4. Strict og:image & twitter:image validation
    const ogImageMatch = normalizedContent.match(/<meta\s+property="og:image"\s+content="([^"]+)"\s*\/?>/i) ||
                         normalizedContent.match(/<meta\s+content="([^"]+)"\s+property="og:image"\s*\/?>/i);
    assert(ogImageMatch, `[${file}] Missing required og:image meta tag.`);

    const ogImageUrl = ogImageMatch[1];
    assert(ogImageUrl.startsWith(DOMAIN), `[${file}] og:image URL does not start with target domain: ${ogImageUrl}`);
    const localImgPath = ogImageUrl.replace(`${DOMAIN}/`, '');
    assert(fs.existsSync(localImgPath), `[${file}] Referenced og:image asset file does not exist locally: ${localImgPath}`);

    const twitterImageMatch = normalizedContent.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"\s*\/?>/i) ||
                              normalizedContent.match(/<meta\s+content="([^"]+)"\s+name="twitter:image"\s*\/?>/i);
    if (twitterImageMatch) {
        const twitterImageUrl = twitterImageMatch[1];
        assert(twitterImageUrl.startsWith(DOMAIN), `[${file}] twitter:image URL does not start with target domain: ${twitterImageUrl}`);
        const localTwitterImgPath = twitterImageUrl.replace(`${DOMAIN}/`, '');
        assert(fs.existsSync(localTwitterImgPath), `[${file}] Referenced twitter:image asset file does not exist locally: ${localTwitterImgPath}`);
    }

    // 5. JSON-LD Structured Data domain check
    const jsonLdScripts = content.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || [];
    jsonLdScripts.forEach(scriptTag => {
        OLD_DOMAINS.forEach(oldDomain => {
            assert(!scriptTag.includes(oldDomain), `[${file}] JSON-LD contains legacy domain: ${oldDomain}`);
        });
    });
});

console.log(`✅ PASS: All ${totalAuditedPages} HTML pages strictly verified for canonical, og:url, og:image, and JSON-LD structure.`);

// 6. Sitemap.xml & robots.txt Validation
console.log('Auditing sitemap.xml and robots.txt...');

assert(fs.existsSync('sitemap.xml'), 'sitemap.xml must exist');
assert(fs.existsSync('robots.txt'), 'robots.txt must exist');

const sitemapContent = fs.readFileSync('sitemap.xml', 'utf8');
const robotsContent = fs.readFileSync('robots.txt', 'utf8');

// Ensure no old domain references in sitemap or robots
OLD_DOMAINS.forEach(oldDomain => {
    assert(!sitemapContent.includes(oldDomain), `sitemap.xml contains legacy domain reference: ${oldDomain}`);
    assert(!robotsContent.includes(oldDomain), `robots.txt contains legacy domain reference: ${oldDomain}`);
});

// Verify sitemap directive in robots.txt
assert(robotsContent.includes(`Sitemap: ${DOMAIN}/sitemap.xml`), 'robots.txt must point to Cloudflare sitemap.xml URL');

// Verify all <loc> entries in sitemap.xml
const locMatches = sitemapContent.match(/<loc>(.*?)<\/loc>/g) || [];
assert(locMatches.length > 0, 'sitemap.xml must contain at least one <loc> entry');

locMatches.forEach(locTag => {
    const url = locTag.replace('<loc>', '').replace('</loc>', '');
    assert(url.startsWith(DOMAIN), `Sitemap <loc> URL does not use target domain: ${url}`);

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
