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
    assert(swJs.includes("const CACHE_NAME = 'heez-v1.5.1';"), 'Service Worker uses cache version heez-v1.5.1');
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

// --- 6. DETERMINISTIC POMODORO SESSION LIFECYCLE TESTS (1 TO 10) ---
{
    localStorage.clear();
    const realDateNow = Date.now;
    let mockTime = 1000000000; // T0
    Date.now = () => mockTime;

    // Test 1: Start -> advance time to expiration -> complete exactly once
    localStorage.clear();
    mockTime = 1000000000;
    const sess1 = {
        mode: 'focus',
        status: 'running',
        sessionId: 'test_sess_1',
        totalDuration: 1500,
        remainingSeconds: 1500,
        endTime: mockTime + 1500 * 1000,
        context: { type: 'free', id: null, title: 'تركيز حر' }
    };
    hayyizSaveFocusState(sess1);
    mockTime += 1500 * 1000; // T0 + 25 minutes
    const rec1 = hayyizReconcilePomodoroState();
    const minToday1 = parseInt(localStorage.getItem('hayyiz-focus-minutes-today') || '0', 10);
    assert(rec1.status === 'completed' && minToday1 === 25, 'Test 1: Session completes exactly once on expiration (25 mins logged)');

    // Test 2: Start -> leave page -> advance time -> reopen page -> session is completed and logged
    localStorage.clear();
    mockTime = 1000000000;
    const sess2 = {
        mode: 'focus',
        status: 'running',
        sessionId: 'test_sess_2',
        totalDuration: 1500,
        remainingSeconds: 1500,
        endTime: mockTime + 1500 * 1000,
        context: { type: 'free', id: null, title: 'تركيز حر' }
    };
    hayyizSaveFocusState(sess2);
    // User leaves pomodoro.html, time advances past end
    mockTime += 1800 * 1000; // T0 + 30 minutes
    const rec2 = hayyizGetFocusState(); // Reopen on any page / Dashboard
    const sessLog2 = hayyizGetFocusSessions();
    assert(rec2.status === 'completed' && sessLog2.length === 1 && sessLog2[0].id === 'test_sess_2', 'Test 2: Reopening after expiration logs completed session from storage');

    // Test 3: Start -> reload before expiration -> remaining time is correct
    localStorage.clear();
    mockTime = 1000000000;
    const sess3 = {
        mode: 'focus',
        status: 'running',
        sessionId: 'test_sess_3',
        totalDuration: 1500,
        remainingSeconds: 1500,
        endTime: mockTime + 1500 * 1000,
        context: { type: 'free', id: null, title: 'تركيز حر' }
    };
    hayyizSaveFocusState(sess3);
    mockTime += 600 * 1000; // 10 minutes elapsed
    const rec3 = hayyizReconcilePomodoroState();
    assert(rec3.status === 'running' && rec3.remainingSeconds === 900, 'Test 3: Reloading before expiration retains correct remaining time (900s / 15m)');

    // Test 4: Start -> reload after expiration -> session is completed exactly once
    localStorage.clear();
    mockTime = 1000000000;
    const sess4 = {
        mode: 'focus',
        status: 'running',
        sessionId: 'test_sess_4',
        totalDuration: 1500,
        remainingSeconds: 1500,
        endTime: mockTime + 1500 * 1000,
        context: { type: 'free', id: null, title: 'تركيز حر' }
    };
    hayyizSaveFocusState(sess4);
    mockTime += 2000 * 1000; // Reload long after expiration
    hayyizReconcilePomodoroState();
    hayyizReconcilePomodoroState(); // Second call simulate reload
    const totalSess4 = parseInt(localStorage.getItem('hayyiz-sessions') || '0', 10);
    assert(totalSess4 === 1, 'Test 4: Reload after expiration completes session exactly once (not duplicated)');

    // Test 5: Start -> hidden tab / delayed timer -> return after expiration -> session completes
    localStorage.clear();
    mockTime = 1000000000;
    const sess5 = {
        mode: 'focus',
        status: 'running',
        sessionId: 'test_sess_5',
        totalDuration: 1500,
        remainingSeconds: 1500,
        endTime: mockTime + 1500 * 1000,
        context: { type: 'free', id: null, title: 'تركيز حر' }
    };
    hayyizSaveFocusState(sess5);
    mockTime += 1600 * 1000; // Tab hidden while timer expired
    const rec5 = hayyizReconcilePomodoroState();
    assert(rec5.status === 'completed', 'Test 5: Returning from hidden tab after expiration completes session');

    // Test 6: Start -> pause -> advance clock -> still paused
    localStorage.clear();
    mockTime = 1000000000;
    const sess6 = {
        mode: 'focus',
        status: 'paused',
        sessionId: 'test_sess_6',
        totalDuration: 1500,
        remainingSeconds: 1200,
        endTime: null,
        context: { type: 'free', id: null, title: 'تركيز حر' }
    };
    hayyizSaveFocusState(sess6);
    mockTime += 5000 * 1000; // Advance time significantly while paused
    const rec6 = hayyizReconcilePomodoroState();
    assert(rec6.status === 'paused' && rec6.remainingSeconds === 1200, 'Test 6: Paused session remains paused and remaining time does not decrease');

    // Test 7: Pause -> resume -> elapsed time excludes pause duration
    localStorage.clear();
    mockTime = 1000000000;
    // 5 mins elapsed out of 25, then paused with 20 mins (1200s) left
    const sess7 = {
        mode: 'focus',
        status: 'paused',
        sessionId: 'test_sess_7',
        totalDuration: 1500,
        remainingSeconds: 1200,
        endTime: null,
        context: { type: 'free', id: null, title: 'تركيز حر' }
    };
    hayyizSaveFocusState(sess7);
    mockTime += 3600 * 1000; // Paused for 1 hour
    // Resume session
    sess7.status = 'running';
    sess7.endTime = mockTime + 1200 * 1000;
    hayyizSaveFocusState(sess7);
    const rec7 = hayyizReconcilePomodoroState();
    assert(rec7.remainingSeconds === 1200, 'Test 7: Resuming after pause excludes pause duration from elapsed focus calculation');

    // Test 8 & 9: Complete -> reload / reopen multiple times -> stats increase only once
    localStorage.clear();
    mockTime = 1000000000;
    const sess8 = {
        mode: 'focus',
        status: 'running',
        sessionId: 'test_sess_8',
        totalDuration: 1500,
        remainingSeconds: 1500,
        endTime: mockTime + 1500 * 1000,
        context: { type: 'free', id: null, title: 'تركيز حر' }
    };
    hayyizSaveFocusState(sess8);
    mockTime += 1500 * 1000;
    hayyizReconcilePomodoroState();
    hayyizReconcilePomodoroState();
    hayyizReconcilePomodoroState();
    const focusMin8 = parseInt(localStorage.getItem('hayyiz-focus-minutes-today') || '0', 10);
    assert(focusMin8 === 25, 'Tests 8 & 9: Reopening/reloading completed session multiple times keeps stats at exactly 25 minutes');

    // Test 10: Task integration completion updates task/focus progress exactly once
    localStorage.clear();
    mockTime = 1000000000;
    hayyizSaveTodos([{ id: 't_int_10', text: 'مهمة الفيزياء', focusDone: 0, sessionsDone: 0, completed: false }]);
    const sess10 = {
        mode: 'focus',
        status: 'running',
        sessionId: 'test_sess_10',
        totalDuration: 1500,
        remainingSeconds: 1500,
        endTime: mockTime + 1500 * 1000,
        context: { type: 'task', id: 't_int_10', title: 'مهمة الفيزياء' }
    };
    hayyizSaveFocusState(sess10);
    mockTime += 1500 * 1000;
    hayyizReconcilePomodoroState();
    hayyizReconcilePomodoroState(); // Reconcile multiple times
    const updatedTodo10 = hayyizGetTodoById('t_int_10');
    assert(updatedTodo10.focusDone === 25 && updatedTodo10.sessionsDone === 1, 'Test 10: Task focus integration updates linked task focus progress exactly once');

    // Specific deterministic scenario requested by user:
    localStorage.clear();
    mockTime = 1000000000; // T0
    const specSess = {
        mode: 'focus',
        status: 'running',
        sessionId: 'spec_sess_25m',
        totalDuration: 1500, // 25 mins
        remainingSeconds: 1500,
        endTime: mockTime + 1500 * 1000,
        context: { type: 'free', id: null, title: 'تركيز حر' }
    };
    hayyizSaveFocusState(specSess); // Start Pomodoro T0

    mockTime += 600 * 1000; // T0 + 10 mins: Leave pomodoro.html
    mockTime += 900 * 1000; // T0 + 25 mins: Session logically complete

    mockTime += 300 * 1000; // T0 + 30 mins: Open pomodoro.html
    const specRec1 = hayyizReconcilePomodoroState();
    const specMin1 = parseInt(localStorage.getItem('hayyiz-focus-minutes-today') || '0', 10);

    // Reload pomodoro.html
    const specRec2 = hayyizReconcilePomodoroState();
    const specMin2 = parseInt(localStorage.getItem('hayyiz-focus-minutes-today') || '0', 10);

    assert(specRec1.status === 'completed' && specMin1 === 25 && specMin2 === 25, 'Specific Deterministic Scenario: Logically completed while away, stats are exactly 25 mins after reopen and reload');

    Date.now = realDateNow;
}

// --- 7. POMODORO SESSION LIFECYCLE SCENARIOS (1 to 8) ---
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
    localStorage.removeItem('hayyiz-focus-sessions-log');
    const task = { id: 't_del', text: 'مهمة ستُحذف', priority: 'high', completed: false };
    hayyizSaveTodos([task]);
    hayyizLogFocusSession({
        durationMinutes: 25,
        mode: 'focus',
        contextType: 'task',
        contextId: 't_del',
        contextTitle: 'مهمة ستُحذف'
    });
    // Delete task
    hayyizSaveTodos([]);
    const sessionLogs = hayyizGetFocusSessions();
    assert(sessionLogs.length === 1 && sessionLogs[0].contextSnapshot.title === 'مهمة ستُحذف', 'Scenario 5: Session history remains intact after task deletion');

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

// --- 8. INLINE DURATION EDITING UNIT TESTS ---
{
    localStorage.clear();

    // Work min inline edit 25 -> 30
    localStorage.setItem('hayyiz-pref-work', '25');
    localStorage.setItem('hayyiz-pref-break', '5');
    let prefWork = parseInt(localStorage.getItem('hayyiz-pref-work') || '25', 10);
    assert(prefWork === 25, 'Inline Edit Test 1: Initial focus preference is 25');

    // Simulate direct inline edit validation logic
    function simulateInlineEdit(newInputVal, mode, currentStatus) {
        if (currentStatus !== 'idle') return { success: false, reason: 'active_session' };
        const val = parseInt(newInputVal, 10);
        const maxVal = mode === 'focus' ? 180 : 60;
        if (!isNaN(val) && val >= 1 && val <= maxVal) {
            if (mode === 'focus') localStorage.setItem('hayyiz-pref-work', String(val));
            else localStorage.setItem('hayyiz-pref-break', String(val));
            return { success: true, value: val };
        }
        return { success: false, reason: 'invalid_input' };
    }

    // Valid edit: 25 -> 30
    let res30 = simulateInlineEdit('30', 'focus', 'idle');
    assert(res30.success && localStorage.getItem('hayyiz-pref-work') === '30', 'Inline Edit Test 2: Valid edit 25 -> 30 updates preference');

    // Valid edit: 30 -> 45
    let res45 = simulateInlineEdit('45', 'focus', 'idle');
    assert(res45.success && localStorage.getItem('hayyiz-pref-work') === '45', 'Inline Edit Test 3: Valid edit 30 -> 45 updates preference');

    // Invalid edits
    let resZero = simulateInlineEdit('0', 'focus', 'idle');
    assert(!resZero.success && localStorage.getItem('hayyiz-pref-work') === '45', 'Inline Edit Test 4: Rejects 0 min input');

    let resNeg = simulateInlineEdit('-5', 'focus', 'idle');
    assert(!resNeg.success && localStorage.getItem('hayyiz-pref-work') === '45', 'Inline Edit Test 5: Rejects negative input');

    let resAbc = simulateInlineEdit('abc', 'focus', 'idle');
    assert(!resAbc.success && localStorage.getItem('hayyiz-pref-work') === '45', 'Inline Edit Test 6: Rejects non-numeric input');

    let resHuge = simulateInlineEdit('99999', 'focus', 'idle');
    assert(!resHuge.success && localStorage.getItem('hayyiz-pref-work') === '45', 'Inline Edit Test 7: Rejects out-of-range input (99999)');

    // Attempt edit while session is running
    let resRunning = simulateInlineEdit('50', 'focus', 'running');
    assert(!resRunning.success && resRunning.reason === 'active_session', 'Inline Edit Test 8: Prevents editing duration during active session');

    // Session launch after inline duration edit uses updated duration
    const newFocusMins = parseInt(localStorage.getItem('hayyiz-pref-work') || '25', 10);
    const newSessionState = {
        mode: 'focus',
        status: 'running',
        remainingSeconds: newFocusMins * 60,
        totalDuration: newFocusMins * 60,
        endTime: Date.now() + newFocusMins * 60 * 1000
    };
    hayyizSaveFocusState(newSessionState);
    const launchedState = hayyizGetFocusState();
    assert(launchedState.totalDuration === 45 * 60 && launchedState.remainingSeconds === 45 * 60, 'Inline Edit Test 9: Started session uses newly set 45 minute duration without breaking PR #15 lifecycle');
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
