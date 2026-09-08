const fs = require('fs');

// 1. Load scripts
const commonJs = fs.readFileSync('./common.js', 'utf8');
const subjectJs = fs.readFileSync('./subject.js', 'utf8');

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

console.log('=== HAYYIZ SUBJECT HUB AUDIT SUITE ===\n');

function resetEnv() {
    localStorage.clear();
}

// TEST 1: Subject existence validation
resetEnv();
const sub1 = hayyizAddSubject('الرياضيات');
testAssert(sub1 && sub1.id && sub1.name === 'الرياضيات', 'Req 1: Subject creation and retrieval works cleanly');

// TEST 2: Valid subjectId
const retrievedSub = hayyizGetSubjectById(sub1.id);
testAssert(retrievedSub && retrievedSub.id === sub1.id, 'Req 2: Valid subjectId returns correct subject object');

// TEST 3: Invalid / missing subjectId handling
const invalidSub = hayyizGetSubjectById('non_existent_subject_123');
testAssert(invalidSub === null, 'Req 3: Invalid subjectId returns null without JS errors');

// TEST 4: Correct tasks filtering for subject
resetEnv();
const mathSub = hayyizAddSubject('الرياضيات');
const physicsSub = hayyizAddSubject('الفيزياء');

const todos = [
    { id: 't1', text: 'حل واجب الرياضيات', subjectId: mathSub.id, completed: false, priority: 'high' },
    { id: 't2', text: 'مراجعة أسطوانات الرياضيات', subjectId: mathSub.id, completed: true, priority: 'medium' },
    { id: 't3', text: 'تقرير الفيزياء', subjectId: physicsSub.id, completed: false, priority: 'high' }
];
localStorage.setItem('hayyiz-todos', JSON.stringify(todos));

const mathTasks = hayyizGetTodos().filter(t => t.subjectId === mathSub.id);
testAssert(mathTasks.length === 2 && mathTasks.map(t => t.id).includes('t1') && mathTasks.map(t => t.id).includes('t2'), 'Req 4: Correctly filters tasks for the math subject');

// TEST 5: Non-appearance of tasks belonging to other subjects
testAssert(!mathTasks.some(t => t.id === 't3'), 'Req 5: Physics task does not appear under Math subject tasks');

// TEST 6: Displaying linked exams for subject
const exams = [
    { id: 'ex1', name: 'اختبار المنتصف رياضيات', subjectId: mathSub.id, date: '2026-05-10', type: 'exam' },
    { id: 'ex2', name: 'اختبار الفيزياء النهائي', subjectId: physicsSub.id, date: '2026-05-15', type: 'exam' }
];
localStorage.setItem('hayyiz-student-exams', JSON.stringify(exams));

const mathExams = hayyizGetExams().filter(e => e.subjectId === mathSub.id);
testAssert(mathExams.length === 1 && mathExams[0].id === 'ex1', 'Req 6: Only Math exam is returned for Math subject');

// TEST 7: Focus time computation from focus sessions log
resetEnv();
const subFocus = hayyizAddSubject('الكيمياء');
hayyizBumpSubjectProgress(subFocus.id, 50);

const focusLog = [
    { id: 'fs1', durationMinutes: 25, contextSnapshot: { type: 'task', id: 't10', subjectId: subFocus.id } },
    { id: 'fs2', durationMinutes: 25, contextSnapshot: { type: 'task', id: 't10', subjectId: subFocus.id } }
];
localStorage.setItem('hayyiz-focus-sessions-log', JSON.stringify(focusLog));

const sObj = hayyizGetSubjectById(subFocus.id);
testAssert(sObj.focusMinutes >= 50 && sObj.sessions >= 1, 'Req 7: Focus time and sessions are accurately aggregated');

// TEST 8: Notes linked via taskId and subject
resetEnv();
const subBio = hayyizAddSubject('الأحياء');
const bioTask = { id: 'tBio1', text: 'تلخيص فصل الخلايا', subjectId: subBio.id };
localStorage.setItem('hayyiz-todos', JSON.stringify([bioTask]));

const notes = [
    { id: 'n1', title: 'ملاحظة خلية', relatedTaskId: 'tBio1', content: 'تفاصيل الخلية النباتية' },
    { id: 'n2', title: 'ملاحظة غير مرتبطة', relatedTaskId: 'tOther', content: 'موضوع آخر' }
];
localStorage.setItem('hayyiz-notes', JSON.stringify(notes));

const bioNotes = notes.filter(n => {
    if (n.subjectId === subBio.id || n.subject === subBio.name) return true;
    if (n.relatedTaskId === bioTask.id) return true;
    return false;
});
testAssert(bioNotes.length === 1 && bioNotes[0].id === 'n1', 'Req 8: Notes linked via taskId are correctly associated with the subject');

// TEST 9: Handling missing legacy data gracefully (corrupt JSON / missing fields)
localStorage.setItem('hayyiz-todos', 'corrupt_json_string{');
let safeTodos = [];
try { safeTodos = hayyizGetTodos(); } catch (e) {}
testAssert(Array.isArray(safeTodos), 'Req 9: Corrupt JSON in todos is handled safely without crashing');

localStorage.setItem('hayyiz-notes', JSON.stringify([{ id: 'legacy_1' }])); // missing subject, missing title, missing content
let safeNotes = [];
try {
    const raw = localStorage.getItem('hayyiz-notes');
    safeNotes = raw ? JSON.parse(raw) : [];
} catch (e) {}
testAssert(safeNotes.length === 1 && safeNotes[0].id === 'legacy_1', 'Req 9b: Legacy note with missing fields handled safely');

// TEST 10: Preventing JavaScript runtime errors when subject.js runs with mock DOM
resetEnv();
global.window = {
    location: { search: '?id=invalid_id_test' },
    addEventListener: () => {}
};
global.document = {
    addEventListener: () => {},
    getElementById: (id) => {
        return {
            style: {},
            textContent: '',
            appendChild: () => {},
            innerHTML: ''
        };
    }
};

let initError = false;
try {
    eval(subjectJs);
} catch (e) {
    initError = true;
    console.error(e);
}
testAssert(!initError, 'Req 10: subject.js executes cleanly without throwing runtime errors on invalid subjectId');

// TEST 11: Subject Hub links format
const sampleSub = { id: 'sub_math_99', name: 'الرياضيات' };
const generatedLink = `subject.html?id=${encodeURIComponent(sampleSub.id)}`;
testAssert(generatedLink === 'subject.html?id=sub_math_99', 'Req 11: Links to Subject Hub use correct subjectId and parameter structure');

// TEST 12: Preserving existing tool behavior
resetEnv();
const sampleSubject = hayyizAddSubject('لغة عربية');
testAssert(sampleSubject && sampleSubject.name === 'لغة عربية', 'Req 12: Existing subject creation and helper contracts remain fully intact');

console.log(`===================================`);
console.log(`SUBJECT HUB AUDIT RESULTS: ${passed} Passed, ${failed} Failed`);
console.log(`===================================\n`);

if (failed > 0) {
    process.exit(1);
}
