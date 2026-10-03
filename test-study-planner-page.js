/* test-study-planner-page.js - Validation script for Study Planner page */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== RUNNING STUDY PLANNER PAGE VALIDATION SUITE ===\n');

// 1. Verify File Existence
assert(fs.existsSync('study-planner.html'), 'study-planner.html must exist');
assert(fs.existsSync('study-planner.css'), 'study-planner.css must exist');
assert(fs.existsSync('study-planner.js'), 'study-planner.js must exist');
console.log('✅ PASS: study-planner.html, study-planner.css, and study-planner.js exist.');

// 2. Read study-planner.html Content
const htmlContent = fs.readFileSync('study-planner.html', 'utf8');

// Check H1 Count
const h1Matches = htmlContent.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi);
assert(h1Matches && h1Matches.length === 1, `Expected exactly 1 <h1> tag, found ${h1Matches ? h1Matches.length : 0}`);
console.log('✅ PASS: Exactly 1 <h1> heading present in study-planner.html.');

// Check Canonical Tag
assert(htmlContent.includes('<link rel="canonical" href="https://hayyze.github.io/study-planner.html">'), 'Canonical URL tag must point to study-planner.html');
console.log('✅ PASS: Canonical tag correctly set to https://hayyze.github.io/study-planner.html.');

// Check CSS Import
assert(htmlContent.includes('study-planner.css'), 'study-planner.html must import study-planner.css');
assert(!htmlContent.includes('href="style.css"'), 'study-planner.html must NOT import style.css');
console.log('✅ PASS: study-planner.html imports study-planner.css and excludes style.css.');

// Check Restricted JS File Imports in study-planner.html
assert(!htmlContent.includes('common.js'), 'study-planner.html must NOT import common.js');
assert(!htmlContent.includes('sw.js'), 'study-planner.html must NOT import sw.js');
assert(!htmlContent.includes('supabase.js'), 'study-planner.html must NOT import supabase.js');
assert(!htmlContent.includes('sync.js'), 'study-planner.html must NOT import sync.js');
console.log('✅ PASS: study-planner.html excludes common.js, sw.js, supabase.js, and sync.js.');

// Check All 9 Required Content Sections Presence in Static HTML
const requiredPhrases = [
    'منظم المذاكرة قبل الاختبار', // Intro Title
    '1. ابدأ من وضعك الحالي', // Planner Input
    '2. النتيجة: خطة مذاكرتك', // Results Section
    'منهجية التخطيط: كيف يعمل هذا المنظم؟', // Methodology
    'لماذا لا نوزع الوقت بالتساوي؟',
    'أمثلة وسيناريوهات واقعية', // Real Practical Examples
    'طالب أمامه 14 يومًا',
    'طالب أمامه 5 أيام فقط',
    'طالب أمامه 21 يومًا',
    'أخطاء شائعة في تخطيط المذاكرة', // Common Errors
    'متى لا تكون هذه الأداة مناسبة لك؟', // Anti-fit / Transparency
    'أسئلة شائعة حول استخدام الخطة', // FAQ
    'الخطوة التالية: كيف تبدأ الآن؟' // Conclusion
];

requiredPhrases.forEach(phrase => {
    assert(htmlContent.includes(phrase), `study-planner.html must contain static HTML phrase: "${phrase}"`);
});
console.log('✅ PASS: All 9 required content sections are present in static HTML.');

// 3. Verify Internal Link in index.html
const indexContent = fs.readFileSync('index.html', 'utf8');
assert(indexContent.includes('study-planner.html'), 'index.html must contain an internal link to study-planner.html');
console.log('✅ PASS: index.html contains internal link to study-planner.html.');

// 4. Verify Restricted Files Unmodified
const gitStatusOutput = require('child_process').execSync('git status --porcelain', { encoding: 'utf8' });
const modifiedFiles = gitStatusOutput.split('\n').map(line => line.trim().split(' ').pop()).filter(Boolean);

const allowedModifiedOrCreated = ['study-planner.html', 'study-planner.css', 'study-planner.js', 'index.html', 'test-study-planner-page.js'];
modifiedFiles.forEach(file => {
    assert(allowedModifiedOrCreated.includes(file), `Restricted file was modified: ${file}`);
});
console.log('✅ PASS: No restricted core files were modified.');

console.log('\n===================================');
console.log('STUDY PLANNER VALIDATION RESULTS: ALL PASSED');
console.log('===================================\n');
