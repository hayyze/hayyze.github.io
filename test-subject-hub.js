const fs = require('fs');

// 1. Load scripts
const commonJs = fs.readFileSync('./common.js', 'utf8');
const subjectJs = fs.readFileSync('./subject.js', 'utf8');
const subjectHtml = fs.readFileSync('./subject.html', 'utf8');
const pomodoroJs = fs.readFileSync('./pomodoro.js', 'utf8');
const todoJs = fs.readFileSync('./todo.js', 'utf8');

// Mock DOM & Storage
global.window = global;
global.document = {
    readyState: 'complete',
    body: { classList: { toggle: () => {}, add: () => {}, remove: () => {} }, appendChild: () => {} },
    documentElement: { classList: { toggle: () => {}, contains: () => false, add: () => {} } },
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener: () => {}
};
global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
};

eval(commonJs);
eval(subjectJs);

let passed = 0;
let failed = 0;

function testAssert(cond, msg) {
    if (cond) {
        console.log(`✅ PASS: ${msg}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${msg}`);
        failed++;
    }
}

console.log('=== HAYYIZ SUBJECT HUB INTEGRATION & CSP AUDIT SUITE ===\n');

function resetEnv() {
    localStorage.clear();
}

// TEST 1: Pure Function getSubjectHubData - Valid subject and Attention Item
resetEnv();
const subMath = hayyizAddSubject('الرياضيات');
const subPhys = hayyizAddSubject('الفيزياء');

const todayStr = getTodayLocal();

const sampleTodos = [
    { id: 't1', text: 'حل واجب الرياضيات', subjectId: subMath.id, priority: 'high', completed: false },
    { id: 't2', text: 'تمارين الفيزياء', subjectId: subPhys.id, completed: false }
];

const sampleExams = [
    { id: 'exNear', name: 'اختبار نصف الفصل', subjectId: subMath.id, date: todayStr }
];

const hubData = getSubjectHubData(subMath.id, {
    subjects: [subMath, subPhys],
    todos: sampleTodos,
    exams: sampleExams,
    focusSessions: [],
    notes: [],
    goals: []
});

testAssert(hubData && hubData.subject.id === subMath.id, 'Req 1: getSubjectHubData returns correct subject data structure');
testAssert(hubData.attentionItem && hubData.attentionItem.type === 'exam' && hubData.attentionItem.exam.id === 'exNear', 'Req 1b: Attention item correctly identifies urgent exam today');

// TEST 2: Invalid subjectId in getSubjectHubData
const nullData = getSubjectHubData('invalid_id_999', {
    subjects: [subMath],
    todos: [],
    exams: [],
    focusSessions: [],
    notes: [],
    goals: []
});
testAssert(nullData === null, 'Req 2: getSubjectHubData returns null safely on invalid subjectId');

// TEST 3: Upcoming vs Past Exams logic
const pastDate = '2020-01-01';
const futureDate1 = '2026-12-01';
const futureDate2 = '2026-12-15';

const sampleExams3 = [
    { id: 'exPast', name: 'اختبار قديم', subjectId: subMath.id, date: pastDate },
    { id: 'exFut2', name: 'اختبار نهائي', subjectId: subMath.id, date: futureDate2 },
    { id: 'exFut1', name: 'اختبار منتصف', subjectId: subMath.id, date: futureDate1 }
];

const hubDataExams = getSubjectHubData(subMath.id, {
    subjects: [subMath],
    todos: [],
    exams: sampleExams3,
    focusSessions: [],
    notes: [],
    goals: []
});

testAssert(hubDataExams.pastExams.length === 1 && hubDataExams.pastExams[0].id === 'exPast', 'Req 3a: Past exams are separated from upcoming exams');
testAssert(hubDataExams.upcomingExams.length === 2, 'Req 3b: Upcoming exams list contains active/future exams');
testAssert(hubDataExams.nearestExam && hubDataExams.nearestExam.id === 'exFut1', 'Req 3c: Nearest exam excludes past exams and selects earliest upcoming exam sorted ascending');

// TEST 4: Notes matching via subjectId and relatedTaskId without title string cross-match
const subTask1 = { id: 'tSub1', text: 'واجب كيمياء', subjectId: subMath.id };
const subTask2 = { id: 'tSub2', text: 'واجب كيمياء', subjectId: subPhys.id }; // Same task text, different subject

const sampleNotes = [
    { id: 'n1', title: 'ملاحظة رياضيات', relatedTaskId: 'tSub1' },
    { id: 'n2', title: 'ملاحظة فيزياء', relatedTaskId: 'tSub2' }
];

const hubDataNotes = getSubjectHubData(subMath.id, {
    subjects: [subMath, subPhys],
    todos: [subTask1, subTask2],
    exams: [],
    focusSessions: [],
    notes: sampleNotes,
    goals: []
});

testAssert(hubDataNotes.notes.length === 1 && hubDataNotes.notes[0].id === 'n1', 'Req 4: Notes matched strictly by relatedTaskId and subjectId without title string cross-matching');

// TEST 5: Subject Goals matching without goal.id === subject.id
const sampleGoals = [
    { id: 'g1', subjectId: subMath.id, target: 95 },
    { id: subPhys.id, name: 'الفيزياء', target: 90 } // goal.id equals physics subject id, but for physics
];

const hubDataGoals = getSubjectHubData(subMath.id, {
    subjects: [subMath, subPhys],
    todos: [],
    exams: [],
    focusSessions: [],
    notes: [],
    goals: sampleGoals
});

testAssert(hubDataGoals.goal && hubDataGoals.goal.target === 95, 'Req 5: Subject goal matched cleanly via subjectId without comparing goal.id to subject.id');

// TEST 6: Focus Sessions Deduplication (Single Source of Truth)
const duplicateSessions = [
    { id: 'sDup1', durationMinutes: 25, timestamp: '2026-03-01T10:00:00Z', subjectId: subMath.id, contextSnapshot: { subjectId: subMath.id } },
    { id: 'sDup1', durationMinutes: 25, timestamp: '2026-03-01T10:00:00Z', subjectId: subMath.id, contextSnapshot: { subjectId: subMath.id } }, // Duplicate entry
    { id: 'sUnique2', durationMinutes: 30, timestamp: '2026-03-02T10:00:00Z', contextSnapshot: { type: 'task', id: 't1', subjectId: subMath.id } }
];

const hubDataDeduplicated = getSubjectHubData(subMath.id, {
    subjects: [subMath],
    todos: sampleTodos,
    exams: [],
    focusSessions: duplicateSessions,
    notes: [],
    goals: []
});

testAssert(hubDataDeduplicated.focusSessionsCount === 2, 'Req 6a: Duplicate session entries are deduplicated by ID');
testAssert(hubDataDeduplicated.focusMinutes === 55, 'Req 6b: Focus minutes accurately calculated as 55 (25+30) without double counting');

// TEST 7: CSP Verification for BOTH script-src AND script-src-elem
const cspMetaMatch = subjectHtml.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=["']([\s\S]*?)["']/i);
testAssert(cspMetaMatch !== null, 'Req 7a: Content-Security-Policy meta tag exists in subject.html');

if (cspMetaMatch) {
    const cspContent = cspMetaMatch[1];

    // Extract script-src directive
    const scriptSrcMatch = cspContent.match(/script-src\s+([^;]+)/i);
    const scriptSrcElemMatch = cspContent.match(/script-src-elem\s+([^;]+)/i);

    const scriptSrcDirectives = (scriptSrcMatch ? scriptSrcMatch[1] : '') + ' ' + (scriptSrcElemMatch ? scriptSrcElemMatch[1] : '');

    testAssert(!scriptSrcDirectives.includes("'unsafe-inline'"), 'Req 7b: Neither script-src nor script-src-elem contains unsafe-inline');
}

const scriptTagMatches = subjectHtml.match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi) || [];
const inlineScripts = scriptTagMatches.filter(tag => !tag.includes('src=') && !tag.includes('application/ld+json'));
testAssert(inlineScripts.length === 0, 'Req 7c: subject.html contains zero inline script blocks');

// TEST 8: Calendar Exam & Subject Linkage Regression
resetEnv();
const subBio = hayyizAddSubject('أحياء');
const examObj = {
    id: 'ex_bio_1',
    name: 'اختبار أحياء',
    type: 'exam',
    date: todayStr,
    subjectId: subBio.id,
    subject: subBio.name,
    updated: Date.now()
};
localStorage.setItem('hayyiz-student-exams', JSON.stringify([examObj]));

const allCalEvents = hayyizGetAllCalendarEvents();
const retrievedExam = allCalEvents.find(e => e.id === 'ex_bio_1');
testAssert(retrievedExam && retrievedExam.subjectId === subBio.id, 'Req 8a: Student calendar event preserves subjectId on load');

const hubBio = getSubjectHubData(subBio.id, {
    subjects: [subBio],
    todos: [],
    exams: hayyizGetExams(),
    focusSessions: [],
    notes: [],
    goals: []
});
testAssert(hubBio && hubBio.upcomingExams.length === 1 && hubBio.upcomingExams[0].id === 'ex_bio_1', 'Req 8b: Subject Hub links calendar exam cleanly via subjectId');

console.log(`===================================`);
console.log(`SUBJECT HUB AUDIT RESULTS: ${passed} Passed, ${failed} Failed`);
console.log(`===================================\n`);

if (failed > 0) {
    process.exit(1);
}
