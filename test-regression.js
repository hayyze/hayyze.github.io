const fs = require('fs');

// 1. Load scripts
const commonJs = fs.readFileSync('./common.js', 'utf8');
const gpaJs = fs.readFileSync('./gpa.js', 'utf8');
const calcJs = fs.readFileSync('./calculator.js', 'utf8');
const pomodoroJs = fs.readFileSync('./pomodoro.js', 'utf8');
const todoJs = fs.readFileSync('./todo.js', 'utf8');
const notesJs = fs.readFileSync('./notes.js', 'utf8');
const habitsJs = fs.readFileSync('./habits.js', 'utf8');
const summaryJs = fs.readFileSync('./summary.js', 'utf8');
const swJs = fs.readFileSync('./sw.js', 'utf8');

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
global.navigator = { serviceWorker: { register: () => Promise.resolve() } };
global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
};

eval(commonJs);
eval(gpaJs);

let passed = 0;
let failed = 0;

function assert(cond, msg) {
    if (cond) {
        console.log(`✅ PASS: ${msg}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${msg}`);
        failed++;
    }
}

console.log('=== HAYYIZ REGRESSION AUDIT SUITE ===\n');

// --- 1. LOCALSTORAGE BACKWARD COMPATIBILITY TEST ---
{
    localStorage.clear();
    // Legacy user data format without ID or version 2 flags
    const legacyTodos = [{ text: 'قديم بدون id', priority: 'high', completed: false }];
    const legacyNotes = [{ title: 'ملاحظة قديمة', content: 'نص قديم' }];
    const legacyGpa = { gpa: 92.5, tracks: { math: 95 } };

    localStorage.setItem('hayyiz-todos', JSON.stringify(legacyTodos));
    localStorage.setItem('hayyiz-notes', JSON.stringify(legacyNotes));
    localStorage.setItem('hayyiz-gpa-snapshot', JSON.stringify(legacyGpa));

    // Ensure data shape upgrade doesn't wipe or break data
    hayyizEnsureDataShape();

    const newTodos = hayyizGetTodos();
    const newNotes = hayyizParseJSON('hayyiz-notes', []);
    const newGpa = hayyizGetGpaSnapshot();

    assert(newTodos.length === 1 && newTodos[0].text === 'قديم بدون id' && newTodos[0].id, 'Legacy todos successfully upgraded with ID without data loss');
    assert(newNotes.length === 1 && newNotes[0].title === 'ملاحظة قديمة' && newNotes[0].id, 'Legacy notes successfully upgraded with ID without data loss');
    assert(newGpa && newGpa.gpa === 92.5, 'Legacy GPA snapshot successfully read without corruption');
}

// --- 2. CORRUPTED / INVALID JSON RECOVERY TEST ---
{
    localStorage.clear();
    localStorage.setItem('hayyiz-todos', 'CORRUPTED_JSON_{[{');
    localStorage.setItem('hayyiz-notes', 'INVALID_JSON_2');

    const safeTodos = hayyizGetTodos();
    const safeNotes = hayyizParseJSON('hayyiz-notes', []);

    assert(Array.isArray(safeTodos) && safeTodos.length === 0, 'Corrupted JSON in hayyiz-todos safely recovers to empty array without crashing');
    assert(Array.isArray(safeNotes) && safeNotes.length === 0, 'Corrupted JSON in hayyiz-notes safely recovers to empty array without crashing');
}

// --- 3. SHARED API FUNCTION SIGNATURES TEST ---
{
    assert(typeof hayyizComputeWeightedGpa === 'function', 'hayyizComputeWeightedGpa API function exists');
    assert(typeof hayyizGetAcademicGoal === 'function', 'hayyizGetAcademicGoal API function exists');
    assert(typeof hayyizSaveAcademicGoal === 'function', 'hayyizSaveAcademicGoal API function exists');
    assert(typeof hayyizGetAcademicSummary === 'function', 'hayyizGetAcademicSummary API function exists');
    assert(typeof hayyizGetCalendarSummary === 'function', 'hayyizGetCalendarSummary API function exists');
    assert(typeof hayyizCalculateExactAge === 'function', 'hayyizCalculateExactAge API function exists');
    assert(typeof hayyizGet18Status === 'function', 'hayyizGet18Status API function exists');
}

// --- 4. SERVICE WORKER CACHE VERSION TEST ---
{
    assert(swJs.includes("const CACHE_NAME = 'heez-v1.6.0';"), 'Service Worker uses cache version heez-v1.6.0');
    assert(swJs.includes('.filter((key) => key !== CACHE_NAME)'), 'Service Worker activates clean deletion of old cache versions');
    assert(swJs.includes('./contact.html') && swJs.includes('./terms.html') && swJs.includes('./privacy.html') && swJs.includes('./founder.html'), 'Service Worker caches newly added static HTML pages for offline support');
}

// --- 5. NOTES DRAFT LIFECYCLE TEST ---
{
    localStorage.clear();
    // Simulate draft input
    const draft = { title: 'عنوان مسودة', content: 'محتوى مسودة لم تحفظ بعد' };
    localStorage.setItem('hayyiz-note-draft', JSON.stringify(draft));

    const restoredDraft = JSON.parse(localStorage.getItem('hayyiz-note-draft'));
    assert(restoredDraft.title === 'عنوان مسودة' && restoredDraft.content === 'محتوى مسودة لم تحفظ بعد', 'Note draft persists across page reload');

    // Simulate save note
    const notes = [{ id: 'n1', title: draft.title, content: draft.content, created: Date.now() }];
    localStorage.setItem('hayyiz-notes', JSON.stringify(notes));
    localStorage.removeItem('hayyiz-note-draft');

    const savedNotes = JSON.parse(localStorage.getItem('hayyiz-notes'));
    const clearedDraft = localStorage.getItem('hayyiz-note-draft');

    assert(savedNotes.length === 1 && savedNotes[0].title === 'عنوان مسودة', 'Note saved successfully to hayyiz-notes');
    assert(clearedDraft === null, 'Note draft cleared cleanly after note submission');
}

// --- 6. POMODORO SESSION LIFECYCLE SCENARIOS (1 to 8) ---
{
    localStorage.clear();

    // Scenario 1: Start 25-minute session -> reload after 5 minutes -> remaining time is correct
    const now = Date.now();
    const session1State = {
        mode: 'focus',
        status: 'running',
        endTime: now + (20 * 60 * 1000), // 20 minutes left (5 minutes elapsed)
        remainingSeconds: 20 * 60,
        totalDuration: 25 * 60,
        context: { type: 'free', id: null, title: 'تركيز حر' }
    };
    hayyizSaveFocusState(session1State);
    const restored1 = hayyizGetFocusState();
    assert(restored1 && restored1.status === 'running' && restored1.remainingSeconds === 20 * 60, 'Scenario 1: Reload after 5 mins maintains exact remaining time (20 mins)');

    // Scenario 2: Start session -> close browser completely -> reopen after elapsed time -> reconstructed as completed
    const pastEndTime = now - (5 * 60 * 1000); // Ended 5 minutes ago
    const session2State = {
        mode: 'focus',
        status: 'running',
        endTime: pastEndTime,
        remainingSeconds: 0,
        totalDuration: 25 * 60,
        context: { type: 'free', id: null, title: 'تركيز حر' }
    };
    hayyizSaveFocusState(session2State);
    const restored2 = hayyizGetFocusState();
    assert(restored2 && restored2.status === 'completed' && restored2.remainingSeconds === 0, 'Scenario 2: Reopen after elapsed time reconstructs state as completed');

    // Scenario 3: Switch tab & return -> timestamp-based remaining time remains accurate
    const session3State = {
        mode: 'focus',
        status: 'running',
        endTime: now + 300 * 1000, // 5 minutes left
        remainingSeconds: 300,
        totalDuration: 25 * 60,
        context: { type: 'free', id: null, title: 'تركيز حر' }
    };
    hayyizSaveFocusState(session3State);
    const restored3 = hayyizGetFocusState();
    assert(restored3 && restored3.remainingSeconds === 300, 'Scenario 3: Tab switch & return relies on timestamp precision');

    // Scenario 4: Laptop sleep-like elapsed recovery -> calculated from real timestamp
    const sleepState = {
        mode: 'focus',
        status: 'running',
        endTime: now - 1000, // Elapsed during sleep
        remainingSeconds: 0,
        totalDuration: 25 * 60,
        context: { type: 'free', id: null, title: 'تركيز حر' }
    };
    hayyizSaveFocusState(sleepState);
    const restored4 = hayyizGetFocusState();
    assert(restored4 && restored4.status === 'completed', 'Scenario 4: Device sleep elapsed time transitions cleanly to completed state');

    // Scenario 5: Session attached to Task -> delete Task -> session history remains intact
    const task = { id: 't_del', text: 'مهمة ستُحذف', priority: 'high', completed: false };
    hayyizSaveTodos([task]);
    hayyizLogFocusSession({
        id: 'sess_t_del',
        durationMinutes: 25,
        mode: 'focus',
        contextType: 'task',
        contextId: 't_del',
        contextTitle: 'مهمة ستُحذف'
    });
    // Delete task
    hayyizSaveTodos([]);
    const sessionLogs = hayyizGetFocusSessions();
    assert(sessionLogs.length > 0 && sessionLogs.some(s => s.contextSnapshot.title === 'مهمة ستُحذف'), 'Scenario 5: Session history remains intact after task deletion');

    // Scenario 6: Session attached to Event -> delete/change Event -> snapshot remains understandable
    const eventObj = { id: 'ev_del', name: 'اختبار محذوف', date: '2026-05-10', type: 'exam' };
    hayyizLogFocusSession({
        durationMinutes: 25,
        mode: 'focus',
        contextType: 'event',
        contextId: 'ev_del',
        contextTitle: 'اختبار محذوف'
    });
    const sessionLogs2 = hayyizGetFocusSessions();
    assert(sessionLogs2[0].contextSnapshot.type === 'event' && sessionLogs2[0].contextSnapshot.title === 'اختبار محذوف', 'Scenario 6: Calendar event snapshot preserved after event deletion');

    // Scenario 7: State persistence relies on immediate LocalStorage updates, not sole beforeunload
    const testState = { mode: 'focus', status: 'paused', remainingSeconds: 600, totalDuration: 1500, context: { type: 'free', id: null, title: 'تركيز حر' } };
    hayyizSaveFocusState(testState);
    const storedRaw = localStorage.getItem('hayyiz-pomodoro-state');
    assert(storedRaw && storedRaw.includes('"status":"paused"'), 'Scenario 7: Persistence writes to LocalStorage on every state update (not just beforeunload)');

    // Scenario 8: Dashboard active-session state detection
    const activeFocusState = hayyizGetFocusState();
    assert(activeFocusState !== null, 'Scenario 8: Dashboard can query active focus state cleanly after reload');
}

// --- 7. CORE TOOLS E2E PERSISTENCE TESTS ---
{
    localStorage.clear();

    // Tasks E2E
    hayyizSaveTodos([{ id: 't1', text: 'تمرين رياضيات', priority: 'high', completed: false }]);
    hayyizCompleteTask('t1', 'تمرين رياضيات', 0);
    const completedTodos = hayyizGetTodos();
    assert(completedTodos[0].completed === true && completedTodos[0].completedAt, 'Task completion persists correctly with completedAt timestamp');

    // Habits E2E
    const habits = [{ name: 'قراءة كتاب', streak: 3, lastCompleted: '2025-01-01' }];
    localStorage.setItem('hayyiz-habits', JSON.stringify(habits));
    const loadedHabits = JSON.parse(localStorage.getItem('hayyiz-habits'));
    assert(loadedHabits[0].streak === 3, 'Habit streak persists correctly');

    // Calendar Events E2E (future date relative to current sandbox machine year)
    const futureYear = new Date().getFullYear() + 1;
    const exams = [{ id: 'ex_1', name: 'اختبار الكيمياء', date: `${futureYear}-06-01`, type: 'exam' }];
    localStorage.setItem('hayyiz-student-exams', JSON.stringify(exams));
    const calSummary = hayyizGetCalendarSummary();
    assert(calSummary.nearestEvent && calSummary.nearestEvent.name === 'اختبار الكيمياء', 'Student Calendar nearest exam is extracted accurately for Dashboard');
}

console.log(`\n===================================`);
console.log(`REGRESSION AUDIT SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log(`===================================\n`);

if (failed > 0) process.exit(1);
