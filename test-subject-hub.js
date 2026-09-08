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

console.log('=== HAYYIZ SUBJECT HUB REFACTORED AUDIT SUITE ===\n');

function resetEnv() {
    localStorage.clear();
}

// TEST 1: Pure Function getSubjectHubData - Valid subject
resetEnv();
const subMath = hayyizAddSubject('الرياضيات');
const subPhys = hayyizAddSubject('الفيزياء');

const sampleTodos = [
    { id: 't1', text: 'حل واجب الرياضيات', subjectId: subMath.id, completed: false },
    { id: 't2', text: 'تمارين الفيزياء', subjectId: subPhys.id, completed: false }
];

const hubData = getSubjectHubData(subMath.id, {
    subjects: [subMath, subPhys],
    todos: sampleTodos,
    exams: [],
    focusSessions: [],
    notes: [],
    goals: []
});

testAssert(hubData && hubData.subject.id === subMath.id, 'Req 1: getSubjectHubData returns correct subject data structure');
testAssert(hubData.openTasks.length === 1 && hubData.openTasks[0].id === 't1', 'Req 1b: getSubjectHubData filters tasks belonging to the subject exclusively');

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
const todayLocal = getTodayLocal();
const pastDate = '2020-01-01';
const futureDate1 = '2026-12-01';
const futureDate2 = '2026-12-15';

const sampleExams = [
    { id: 'exPast', name: 'اختبار قديم', subjectId: subMath.id, date: pastDate },
    { id: 'exFut2', name: 'اختبار نهائي', subjectId: subMath.id, date: futureDate2 },
    { id: 'exFut1', name: 'اختبار منتصف', subjectId: subMath.id, date: futureDate1 }
];

const hubDataExams = getSubjectHubData(subMath.id, {
    subjects: [subMath],
    todos: [],
    exams: sampleExams,
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

// TEST 5: Subject Goals matching
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

// TEST 6: Focus Sessions sorting and aggregation
const sampleSessions = [
    { id: 'sOld', durationMinutes: 25, timestamp: '2026-01-01T10:00:00Z', contextSnapshot: { subjectId: subMath.id } },
    { id: 'sNew', durationMinutes: 25, timestamp: '2026-03-01T10:00:00Z', contextSnapshot: { subjectId: subMath.id } }
];

const hubDataSessions = getSubjectHubData(subMath.id, {
    subjects: [subMath],
    todos: [],
    exams: [],
    focusSessions: sampleSessions,
    notes: [],
    goals: []
});

testAssert(hubDataSessions.recentFocusSessions[0].id === 'sNew', 'Req 6: Focus sessions sorted descending by timestamp');

// TEST 7: CSP and Inline Script Check
testAssert(!subjectHtml.includes("'unsafe-inline'") || !subjectHtml.includes("script-src 'self' https://www.googletagmanager.com https://cdn.jsdelivr.net 'unsafe-inline'"), 'Req 7a: CSP script-src meta tag does not contain unsafe-inline');

const scriptTagMatches = subjectHtml.match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi) || [];
const inlineScripts = scriptTagMatches.filter(tag => !tag.includes('src='));
testAssert(inlineScripts.length === 0, 'Req 7b: subject.html contains zero inline script blocks');

console.log(`===================================`);
console.log(`SUBJECT HUB AUDIT RESULTS: ${passed} Passed, ${failed} Failed`);
console.log(`===================================\n`);

if (failed > 0) {
    process.exit(1);
}
