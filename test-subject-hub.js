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

// TEST 9: Comprehensive Form Logic Simulation & Storage Validation
resetEnv();
const subChem = hayyizAddSubject('كيمياء');

// Load calculator.js into mock environment
const calculatorJs = fs.readFileSync('./calculator.js', 'utf8');

// Set up mock DOM elements required for calculator.js
const mockDomElements = {
    'event-name-input': { value: '' },
    'event-type-input': { value: 'exam', addEventListener: () => {} },
    'event-date-input': { value: '' },
    'event-time-input': { value: '' },
    'event-subject-input': { value: '', innerHTML: '', appendChild: () => {} },
    'event-subject-group': { style: { display: 'none' } },
    'event-edit-id': { value: '' },
    'event-storage-key': { value: '' },
    'form-card-title': { innerHTML: '' },
    'save-btn-text': { textContent: '' },
    'event-form-card': { style: { display: 'none' }, scrollIntoView: () => {} },
    'add-event-form': { reset: () => {}, addEventListener: () => {} },
    'birthdate-input': { value: '' },
    'birthdate-btn-lbl': { textContent: '' },
    'hero-age-val': { textContent: '' },
    'hero-age-sub': { textContent: '' },
    'hero-nearest-val': { textContent: '' },
    'hero-nearest-sub': { textContent: '' },
    'hero-countdown-val': { textContent: '' },
    'hero-countdown-sub': { textContent: '' },
    'hero-week-val': { textContent: '' },
    'hero-18-sub': { textContent: '' },
    'past-btn-lbl': { textContent: '' },
    'events-empty': { style: { display: 'none' } },
    'group-today-tomorrow': { style: { display: 'none' } },
    'group-this-week': { style: { display: 'none' } },
    'group-future': { style: { display: 'none' } },
    'group-past': { style: { display: 'none' } },
    'cards-today-tomorrow': { innerHTML: '', appendChild: () => {} },
    'cards-this-week': { innerHTML: '', appendChild: () => {} },
    'cards-future': { innerHTML: '', appendChild: () => {} },
    'cards-past': { innerHTML: '', appendChild: () => {} }
};

global.document.getElementById = (id) => mockDomElements[id] || null;
global.document.querySelectorAll = () => [];
global.document.createTextNode = (txt) => txt;
global.document.createElement = (tag) => {
    const el = {
        value: '',
        textContent: '',
        style: {},
        classList: { add: () => {}, remove: () => {} },
        appendChild: (c) => el.children.push(c),
        addEventListener: () => {},
        children: [],
        querySelector: (sel) => {
            return {
                textContent: '',
                appendChild: () => {},
                addEventListener: () => {}
            };
        }
    };
    return el;
};

eval(calculatorJs);

const testForm = window._hayyizTestCalendarForm;

// 9a. Direct Form Save: Exam with Subject
mockDomElements['event-edit-id'].value = '';
mockDomElements['event-storage-key'].value = '';
mockDomElements['event-name-input'].value = 'اختبار كيمياء';
mockDomElements['event-type-input'].value = 'exam';
mockDomElements['event-date-input'].value = '2026-10-10';
mockDomElements['event-subject-input'].value = subChem.id;

testForm.saveEventFromForm();

const savedExams1 = JSON.parse(localStorage.getItem('hayyiz-student-exams') || '[]');
testAssert(savedExams1.length === 1 && savedExams1[0].subjectId === subChem.id, 'Test 9a: Form saveEventFromForm() saves exam with subjectId correctly');

// 9b. Direct Form Save: Exam without Subject
mockDomElements['event-edit-id'].value = '';
mockDomElements['event-storage-key'].value = '';
mockDomElements['event-name-input'].value = 'اختبار عام';
mockDomElements['event-type-input'].value = 'exam';
mockDomElements['event-date-input'].value = '2026-10-12';
mockDomElements['event-subject-input'].value = '';

testForm.saveEventFromForm();

const savedExams2 = JSON.parse(localStorage.getItem('hayyiz-student-exams') || '[]');
const genExam = savedExams2.find(e => e.name === 'اختبار عام');
testAssert(genExam && genExam.subjectId === null, 'Test 9b: Form saveEventFromForm() saves exam without subject with subjectId: null');

// 9c. Direct Form Edit: Convert Exam to Assignment -> Removes subjectId and moves storage key
mockDomElements['event-edit-id'].value = savedExams1[0].id;
mockDomElements['event-storage-key'].value = 'hayyiz-student-exams';
mockDomElements['event-name-input'].value = 'تسليم مشروع كيمياء';
mockDomElements['event-type-input'].value = 'assignment';
mockDomElements['event-date-input'].value = '2026-10-10';
mockDomElements['event-subject-input'].value = subChem.id; // leftover select value

testForm.saveEventFromForm();

const updatedExams = JSON.parse(localStorage.getItem('hayyiz-student-exams') || '[]');
const newEvents = JSON.parse(localStorage.getItem('hayyiz-custom-events') || '[]');
const convertedEv = newEvents.find(e => e.id === savedExams1[0].id);

testAssert(!updatedExams.some(e => e.id === savedExams1[0].id), 'Test 9c-1: Converted event removed from student-exams');
testAssert(convertedEv && convertedEv.subjectId === null && convertedEv.type === 'assignment', 'Test 9c-2: Converted event saved in custom-events with subjectId: null');

// 9d. Direct Form Edit: Edit Exam and Change Subject
mockDomElements['event-edit-id'].value = genExam.id;
mockDomElements['event-storage-key'].value = 'hayyiz-student-exams';
mockDomElements['event-name-input'].value = 'اختبار أحياء';
mockDomElements['event-type-input'].value = 'exam';
mockDomElements['event-date-input'].value = '2026-10-12';
mockDomElements['event-subject-input'].value = subBio.id;

testForm.saveEventFromForm();

const finalExams = JSON.parse(localStorage.getItem('hayyiz-student-exams') || '[]');
const edited = finalExams.find(e => e.id === genExam.id);
testAssert(edited && edited.subjectId === subBio.id, 'Test 9d: Editing exam and setting new subject updates subjectId correctly');

// TEST 10: Explicit Scenarios 1 to 8 Regression
resetEnv();

// Scenario 1: Subject 1 + 3 linked tasks
const s1 = hayyizAddSubject('التاريخ');
const s1Tasks = [
    { id: 'st1_1', text: 'مراجعة الفصل الأول', subjectId: s1.id, completed: false },
    { id: 'st1_2', text: 'مراجعة الفصل الثاني', subjectId: s1.id, completed: false },
    { id: 'st1_3', text: 'تلخيص الفصل الثالث', subjectId: s1.id, completed: false }
];
const dataSc1 = getSubjectHubData(s1.id, {
    subjects: [s1],
    todos: s1Tasks,
    exams: [],
    focusSessions: [],
    notes: [],
    goals: []
});
testAssert(dataSc1 && dataSc1.openTasks.length === 3, 'Scenario 1: Subject with 3 linked tasks correctly evaluates openTasks count = 3');

// Scenario 2: Subject 2 + overdue task
const s2 = hayyizAddSubject('الجغرافيا');
const overdueTask = { id: 'st2_1', text: 'حل الخريطة', subjectId: s2.id, date: '2020-01-01', completed: false };
const dataSc2 = getSubjectHubData(s2.id, {
    subjects: [s2],
    todos: [overdueTask],
    exams: [],
    focusSessions: [],
    notes: [],
    goals: []
});
testAssert(dataSc2 && dataSc2.overdueTasks.length === 1 && dataSc2.statusKey === 'needs_attention', 'Scenario 2: Subject with overdue task yields needs_attention status');

// Scenario 3: Subject 3 + near exam
const s3 = hayyizAddSubject('اللغة العربية');
const nearExam = { id: 'ex3_1', name: 'اختبار نحو', subjectId: s3.id, date: todayStr };
const dataSc3 = getSubjectHubData(s3.id, {
    subjects: [s3],
    todos: [],
    exams: [nearExam],
    focusSessions: [],
    notes: [],
    goals: []
});
testAssert(dataSc3 && dataSc3.nearestExam && dataSc3.nearestExam.id === 'ex3_1' && dataSc3.statusKey === 'near_exam', 'Scenario 3: Subject with near exam yields near_exam status');

// Scenario 4: Two subjects with different tasks/exams, verifying no cross-contamination
const s4a = hayyizAddSubject('الحاسب');
const s4b = hayyizAddSubject('الإنجليزية');
const task4a = { id: 't4a', text: 'برمجة مشروع', subjectId: s4a.id, completed: false };
const task4b = { id: 't4b', text: 'English Homework', subjectId: s4b.id, completed: false };
const exam4a = { id: 'ex4a', name: 'اختبار عملي حاسب', subjectId: s4a.id, date: '2026-11-01' };

const dataSc4a = getSubjectHubData(s4a.id, { subjects: [s4a, s4b], todos: [task4a, task4b], exams: [exam4a], focusSessions: [], notes: [], goals: [] });
const dataSc4b = getSubjectHubData(s4b.id, { subjects: [s4a, s4b], todos: [task4a, task4b], exams: [exam4a], focusSessions: [], notes: [], goals: [] });

testAssert(dataSc4a.openTasks.length === 1 && dataSc4a.openTasks[0].id === 't4a' && dataSc4a.nearestExam.id === 'ex4a', 'Scenario 4a: Subject A tasks and exams remain isolated');
testAssert(dataSc4b.openTasks.length === 1 && dataSc4b.openTasks[0].id === 't4b' && dataSc4b.nearestExam === null, 'Scenario 4b: Subject B contains zero items from Subject A');

// Scenario 5: Task with focusDone > 0 shows progress for the correct subject
const s5 = hayyizAddSubject('العلوم');
const taskWithFocus = { id: 't5', text: 'تجربة المختبر', subjectId: s5.id, focusDone: 25, completed: false };
const dataSc5 = getSubjectHubData(s5.id, { subjects: [s5], todos: [taskWithFocus], exams: [], focusSessions: [], notes: [], goals: [] });
testAssert(dataSc5 && dataSc5.focusMinutes === 25 && dataSc5.statusKey === 'has_progress', 'Scenario 5: Task with focusDone > 0 correctly attributes focus time and has_progress status to subject');

// Scenario 6: Subject without tasks
const s6 = hayyizAddSubject('الحديث');
const dataSc6 = getSubjectHubData(s6.id, { subjects: [s6], todos: [], exams: [], focusSessions: [], notes: [], goals: [] });
testAssert(dataSc6 && dataSc6.openTasks.length === 0 && dataSc6.statusKey === 'no_active_tasks', 'Scenario 6: Subject without tasks handles empty task list cleanly');

// Scenario 7: Subject without exams
const s7 = hayyizAddSubject('الفقه');
const task7 = { id: 't7', text: 'قراءة الدرس', subjectId: s7.id, completed: false };
const dataSc7 = getSubjectHubData(s7.id, { subjects: [s7], todos: [task7], exams: [], focusSessions: [], notes: [], goals: [] });
testAssert(dataSc7 && dataSc7.nearestExam === null && dataSc7.statusKey === 'active_tasks', 'Scenario 7: Subject without exams handles null nearestExam gracefully');

// Scenario 8: No subjects at all in system
const dataSc8 = getSubjectHubData('non_existent', { subjects: [], todos: [], exams: [], focusSessions: [], notes: [], goals: [] });
testAssert(dataSc8 === null, 'Scenario 8: System with zero subjects returns null safely without throwing errors');

// TEST 11: Render & Display Integration Tests (UI-1 through UI-4)
resetEnv();

// Test UI-1: Pre-calculated properties ready for direct rendering
const subUi1 = hayyizAddSubject('التوحيد');
const taskUi1Overdue = { id: 'tUi1_1', text: 'حفظ المتن', subjectId: subUi1.id, date: '2020-01-01', completed: false };
const examUi1Near = { id: 'exUi1_1', name: 'اختبار توحيد', subjectId: subUi1.id, date: todayStr };

const dataUi1 = getSubjectHubData(subUi1.id, {
    subjects: [subUi1],
    todos: [taskUi1Overdue],
    exams: [examUi1Near],
    focusSessions: [],
    notes: [],
    goals: []
});

testAssert(dataUi1.statusLabel === 'تحتاج انتباهًا', 'Test UI-1a: getSubjectHubData produces ready-to-render statusLabel directly');
testAssert(dataUi1.openTasks.length === 1 && dataUi1.overdueTasks.length === 1, 'Test UI-1b: getSubjectHubData calculates openTasks and overdueTasks directly');
testAssert(typeof dataUi1.focusMinutes === 'number' && dataUi1.nearestExam.id === 'exUi1_1', 'Test UI-1c: focusMinutes and nearestExam ready without view recalculation');

// Test UI-2: Progress formatting without NaN/Infinity
const subUi2 = hayyizAddSubject('الفلسفة');
const taskUi2 = { id: 'tUi2', text: 'قراءة الفصل', subjectId: subUi2.id, focusDone: 25, minutes: 50, completed: false };
const dataUi2 = getSubjectHubData(subUi2.id, {
    subjects: [subUi2],
    todos: [taskUi2],
    exams: [],
    focusSessions: [],
    notes: [],
    goals: []
});

const progFormatted = hayyizFormatTaskProgress(taskUi2);
testAssert(dataUi2.focusMinutes === 25, 'Test UI-2a: Subject hub focusMinutes matches task focusDone = 25');
testAssert(progFormatted && progFormatted.percent === 50 && Number.isFinite(progFormatted.percent), 'Test UI-2b: Progress percentage is a valid finite number (50%)');
testAssert(progFormatted.progressText.includes('25 من 50 دقيقة') && !progFormatted.progressText.includes('NaN'), 'Test UI-2c: Progress text formatted cleanly without NaN or Infinity');

// Test UI-3: Isolation of task focus progress between subjects
const subUi3a = hayyizAddSubject('مادة أ');
const subUi3b = hayyizAddSubject('مادة ب');
const taskUi3a = { id: 't3a', text: 'مهمة مادة أ', subjectId: subUi3a.id, focusDone: 30, completed: false };

const dataUi3a = getSubjectHubData(subUi3a.id, { subjects: [subUi3a, subUi3b], todos: [taskUi3a], exams: [], focusSessions: [], notes: [], goals: [] });
const dataUi3b = getSubjectHubData(subUi3b.id, { subjects: [subUi3a, subUi3b], todos: [taskUi3a], exams: [], focusSessions: [], notes: [], goals: [] });

testAssert(dataUi3a.focusMinutes === 30, 'Test UI-3a: Subject A correctly reflects 30 focus minutes');
testAssert(dataUi3b.focusMinutes === 0, 'Test UI-3b: Subject B focus minutes remain 0 without leaking progress from Subject A');

// Test UI-4: Single Source of Truth for Focus Time & Double Counting Prevention
const subUi4 = hayyizAddSubject('الكيمياء العضوية');
const taskUi4 = { id: 't4', text: 'تفاعلات الألكينات', subjectId: subUi4.id, focusDone: 25, completed: false };

// Session recorded in focusSessions AND focusDone updated on task
const loggedSession = {
    id: 's_ui4_1',
    durationMinutes: 25,
    timestamp: new Date().toISOString(),
    contextSnapshot: { type: 'task', id: 't4', subjectId: subUi4.id }
};

const dataUi4 = getSubjectHubData(subUi4.id, {
    subjects: [subUi4],
    todos: [taskUi4],
    exams: [],
    focusSessions: [loggedSession],
    notes: [],
    goals: []
});

testAssert(dataUi4.focusMinutes === 25, 'Test UI-4a: Focus time does NOT double-count when session is in both focusSessions and task.focusDone (remains 25)');

// Legacy fallback test
const subUi4Legacy = { id: 'sub_leg', name: 'مادة قديمة', focusMinutes: 40, sessions: 1 };
const dataUi4Legacy = getSubjectHubData('sub_leg', {
    subjects: [subUi4Legacy],
    todos: [],
    exams: [],
    focusSessions: [],
    notes: [],
    goals: []
});

testAssert(dataUi4Legacy && dataUi4Legacy.focusMinutes === 40, 'Test UI-4b: Legacy subject data with focusMinutes fallback renders 40 minutes correctly without NaN');

// TEST 12: Enhanced Specific Integration & Rendering Verification (Goal 4 & 5)
resetEnv();

// Test 1: Sessions are counted correctly (2 sessions = 50 mins, 2 sessions)
const subG1 = hayyizAddSubject('الحاسب الآلي');
const sessG1_1 = { id: 'sg1_1', durationMinutes: 25, timestamp: '2026-03-01T10:00:00Z', contextSnapshot: { subjectId: subG1.id } };
const sessG1_2 = { id: 'sg1_2', durationMinutes: 25, timestamp: '2026-03-01T11:00:00Z', contextSnapshot: { subjectId: subG1.id } };
const dataG1 = getSubjectHubData(subG1.id, { subjects: [subG1], todos: [], exams: [], focusSessions: [sessG1_1, sessG1_2], notes: [], goals: [] });
testAssert(dataG1.focusMinutes === 50 && dataG1.focusSessionsCount === 2, 'Goal 4 Test 1: 2 sessions of 25m yield totalMinutes = 50 and totalSessions = 2 without inflating to 4 or 100');

// Test 2: Task progress does not double-count logged sessions (focusDone = 50, 2 logged sessions of 25 = 50 total)
const subG2 = hayyizAddSubject('الفيزياء النواة');
const taskG2 = { id: 'tg2', text: 'حل المسائل', subjectId: subG2.id, focusDone: 50, completed: false };
const sessG2_1 = { id: 'sg2_1', durationMinutes: 25, timestamp: '2026-03-01T10:00:00Z', contextSnapshot: { type: 'task', id: 'tg2', subjectId: subG2.id } };
const sessG2_2 = { id: 'sg2_2', durationMinutes: 25, timestamp: '2026-03-01T11:00:00Z', contextSnapshot: { type: 'task', id: 'tg2', subjectId: subG2.id } };
const dataG2 = getSubjectHubData(subG2.id, { subjects: [subG2], todos: [taskG2], exams: [], focusSessions: [sessG2_1, sessG2_2], notes: [], goals: [] });
testAssert(dataG2.focusMinutes === 50, 'Goal 4 Test 2: Task focusDone = 50 matching 50m logged sessions yields totalMinutes = 50 (not 100)');

// Test 3: Legacy fallback
const subG3Legacy = { id: 'sub_g3_leg', name: 'لغة إنجليزية قديمة', focusMinutes: 60, sessions: 3 };
const dataG3 = getSubjectHubData('sub_g3_leg', { subjects: [subG3Legacy], todos: [], exams: [], focusSessions: [], notes: [], goals: [] });
testAssert(dataG3.focusMinutes === 60 && dataG3.focusSessionsCount === 3, 'Goal 4 Test 3: Legacy subject fallback correctly returns stored focusMinutes (60) and sessions (3)');

// Test 4: Unlogged task focus (focusDone = 50, logged sessions = 25 -> totalMinutes = 50)
const subG4 = hayyizAddSubject('الرياضيات المتقدمة');
const taskG4 = { id: 'tg4', text: 'التفاضل والتكامل', subjectId: subG4.id, focusDone: 50, completed: false };
const sessG4 = { id: 'sg4_1', durationMinutes: 25, timestamp: '2026-03-01T10:00:00Z', contextSnapshot: { type: 'task', id: 'tg4', subjectId: subG4.id } };
const dataG4 = getSubjectHubData(subG4.id, { subjects: [subG4], todos: [taskG4], exams: [], focusSessions: [sessG4], notes: [], goals: [] });
testAssert(dataG4.focusMinutes === 50, 'Goal 4 Test 4: Task focusDone = 50 with only 25m logged sessions adds only unlogged difference (25m) yielding 50 totalMinutes (not 75)');

// Test 5: Different subjects remain isolated
const subG5a = hayyizAddSubject('مادة س');
const subG5b = hayyizAddSubject('مادة ص');
const sessG5a = { id: 'sg5a', durationMinutes: 25, timestamp: '2026-03-01T10:00:00Z', contextSnapshot: { subjectId: subG5a.id } };
const sessG5b = { id: 'sg5b', durationMinutes: 40, timestamp: '2026-03-01T10:00:00Z', contextSnapshot: { subjectId: subG5b.id } };
const dataG5a = getSubjectHubData(subG5a.id, { subjects: [subG5a, subG5b], todos: [], exams: [], focusSessions: [sessG5a, sessG5b], notes: [], goals: [] });
const dataG5b = getSubjectHubData(subG5b.id, { subjects: [subG5a, subG5b], todos: [], exams: [], focusSessions: [sessG5a, sessG5b], notes: [], goals: [] });
testAssert(dataG5a.focusMinutes === 25 && dataG5b.focusMinutes === 40, 'Goal 4 Test 5: Subject X gets 25m and Subject Y gets 40m without cross-contamination');

// Test 6: Status priority precedence
const subP1 = hayyizAddSubject('مادة أولوية 1');
const overdueP1 = { id: 'tp1', text: 'مهمة متأخرة', subjectId: subP1.id, date: '2020-01-01', completed: false };
const nearExamP1 = { id: 'exp1', name: 'اختبار', subjectId: subP1.id, date: todayStr };
const dataP1 = getSubjectHubData(subP1.id, { subjects: [subP1], todos: [overdueP1], exams: [nearExamP1], focusSessions: [], notes: [], goals: [] });

const subP2 = hayyizAddSubject('مادة أولوية 2');
const nearExamP2 = { id: 'exp2', name: 'اختبار مادة 2', subjectId: subP2.id, date: todayStr };
const dataP2 = getSubjectHubData(subP2.id, { subjects: [subP2], todos: [], exams: [nearExamP2], focusSessions: [], notes: [], goals: [] });

testAssert(dataP1.statusKey === 'needs_attention', 'Goal 4 Test 6a: Overdue task + near exam yields needs_attention status');
testAssert(dataP2.statusKey === 'near_exam', 'Goal 4 Test 6b: Near exam without overdue yields near_exam status');

// Test 7: Safe progress formatting (focusDone = 25, minutes = 0)
const taskZeroMin = { id: 'tz', text: 'مهمة بدون وقت كلي', focusDone: 25, minutes: 0 };
const progZero = hayyizFormatTaskProgress(taskZeroMin);
testAssert(progZero && progZero.progressText === 'أُنجز 25 دقيقة تركيز' && progZero.percent === null, 'Goal 4 Test 7: Task with focusDone = 25 and minutes = 0 outputs clean text without NaN or Infinity');

// DOM Rendering Test Simulation (Goal 5)
const mockListContainer = {
    children: [],
    textContent: '',
    appendChild(child) { this.children.push(child); }
};

mockDomElements['general-subjects-list'] = mockListContainer;
mockDomElements['subjects-general-view'] = { style: {} };
mockDomElements['subject-content'] = { style: {} };
mockDomElements['subject-not-found'] = { style: {} };

renderGeneralSubjectsView([subG1], [], [], [sessG1_1, sessG1_2], [], []);
testAssert(mockListContainer.children.length === 1, 'Goal 5 DOM Test: renderGeneralSubjectsView populates card into list container');

console.log(`===================================`);
console.log(`SUBJECT HUB AUDIT RESULTS: ${passed} Passed, ${failed} Failed`);
console.log(`===================================\n`);

if (failed > 0) {
    process.exit(1);
}
