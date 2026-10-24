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
assert(htmlContent.includes('<link rel="canonical" href="https://hayyze.pages.dev/study-planner.html">'), 'Canonical URL tag must point to study-planner.html');
console.log('✅ PASS: Canonical tag correctly set to https://hayyze.pages.dev/study-planner.html.');

// Check CSS Import
assert(htmlContent.includes('study-planner.css'), 'study-planner.html must import study-planner.css');
assert(htmlContent.includes('href="style.css"') && htmlContent.includes('id="nav-links"'), 'Planner must reuse the existing accessible site navigation and styles');
console.log('✅ PASS: study-planner.html imports the shared navigation styles and preserves study-planner.css.');

// Check Restricted JS File Imports in study-planner.html
assert(htmlContent.includes('common.js'), 'study-planner.html must reuse the shared planning engine');
assert(!htmlContent.includes('sw.js'), 'study-planner.html must NOT import sw.js');
assert(!htmlContent.includes('supabase.js'), 'study-planner.html must NOT import supabase.js');
assert(!htmlContent.includes('sync.js'), 'study-planner.html must NOT import sync.js');
console.log('✅ PASS: study-planner.html reuses common.js without loading standalone cloud dependencies.');

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

// 4. Adoption uses the real task engine while retaining the standalone layout.
const planner = fs.readFileSync('study-planner.js', 'utf8');
assert(htmlContent.includes('sp-adopt-plan'), 'Planner exposes explicit adoption action');
assert(planner.includes('hayyizAdoptStudyPlan'), 'Adoption reuses the shared task/subject/plan data layer');
assert(planner.includes('hayyiz-planner-draft'), 'Planner inputs survive reload');
console.log('STUDY PLANNER VALIDATION RESULTS: ALL PASSED');
