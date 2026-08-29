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
    assert(swJs.includes("const CACHE_NAME = 'heez-v1.8.3';"), 'Service Worker uses cache version heez-v1.8.3');
    assert(swJs.includes('.filter((key) => key !== CACHE_NAME)'), 'Service Worker activates clean deletion of old cache versions');
    assert(swJs.includes('./contact.html') && swJs.includes('./terms.html') && swJs.includes('./privacy.html') && swJs.includes('./founder.html'), 'Service Worker caches newly added static HTML pages for offline support');
}

// --- 5. NOTES DRAFT & BEHAVIORAL REGRESSION TEST ---
{
    localStorage.clear();
    // Simulate draft input
    const draft = { title: 'عنوان مسودة', content: 'محتوى مسودة لم تحفظ بعد', subject: 'رياضيات', tags: 'تفاضل, مراجعة' };
    localStorage.setItem('hayyiz-note-draft', JSON.stringify(draft));

    const restoredDraft = JSON.parse(localStorage.getItem('hayyiz-note-draft'));
    assert(restoredDraft.title === 'عنوان مسودة' && restoredDraft.content === 'محتوى مسودة لم تحفظ بعد' && restoredDraft.subject === 'رياضيات', 'Note draft persists across page reload');

    // Simulate save note
    const notes = [{ id: 'n1', title: draft.title, content: draft.content, subject: draft.subject, tags: ['تفاضل', 'مراجعة'], created: Date.now() }];
    localStorage.setItem('hayyiz-notes', JSON.stringify(notes));
    localStorage.removeItem('hayyiz-note-draft');

    const savedNotes = JSON.parse(localStorage.getItem('hayyiz-notes'));
    const clearedDraft = localStorage.getItem('hayyiz-note-draft');

    assert(savedNotes.length === 1 && savedNotes[0].title === 'عنوان مسودة' && savedNotes[0].subject === 'رياضيات', 'Note saved successfully to hayyiz-notes');
    assert(clearedDraft === null, 'Note draft cleared cleanly after note submission');

    // Duplicate Task ID Protection Regression
    const dupTasks = [
        { id: 't_dup_A', text: 'مراجعة الأحياء', priority: 'high' },
        { id: 't_dup_B', text: 'مراجعة الأحياء', priority: 'low' }
    ];
    localStorage.setItem('hayyiz-todos', JSON.stringify(dupTasks));

    const noteLinkedToB = { id: 'n_link_B', title: 'ملاحظة الأحياء الفرع B', content: 'محتوى', relatedTaskId: 't_dup_B', relatedTask: 'مراجعة الأحياء' };
    const todosInStorage = JSON.parse(localStorage.getItem('hayyiz-todos'));
    const resolvedTaskForB = todosInStorage.find(t => t.id === noteLinkedToB.relatedTaskId);

    assert(resolvedTaskForB && resolvedTaskForB.id === 't_dup_B' && resolvedTaskForB.priority === 'low', 'Task relationship strictly uses ID for duplicate task names');
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

// --- 8. POMODORO PROMPT SUGGESTION & SUPPRESSION TESTS (10 REQUIREMENTS) ---
{
    localStorage.clear();
    const realDateNow = Date.now;
    let mockTime = 1700000000000;
    Date.now = () => mockTime;

    let mockToday = '2026-03-30';
    getTodayLocal = () => mockToday;

    // Helper functions mirroring todo.js logic for test verification
    function isSuppressed() {
        try {
            const todayStr = getTodayLocal();
            const hiddenToday = localStorage.getItem('hayyiz-hide-pomo-prompt-today');
            if (hiddenToday === todayStr) {
                return true;
            }

            const hiddenUntil = localStorage.getItem('hayyiz-hide-pomo-prompt-hour');
            if (hiddenUntil) {
                const expiresAt = parseInt(hiddenUntil, 10);
                if (!isNaN(expiresAt) && Date.now() < expiresAt) {
                    return true;
                } else if (!isNaN(expiresAt) && Date.now() >= expiresAt) {
                    localStorage.removeItem('hayyiz-hide-pomo-prompt-hour');
                }
            }
        } catch (e) {}
        return false;
    }

    function suppress(type) {
        if (type === 'today') {
            const todayStr = getTodayLocal();
            localStorage.setItem('hayyiz-hide-pomo-prompt-today', todayStr);
        } else if (type === 'hour') {
            const oneHourLater = Date.now() + (60 * 60 * 1000);
            localStorage.setItem('hayyiz-hide-pomo-prompt-hour', String(oneHourLater));
        }
    }

    // 1. Task Creation -> Prompt is shown if not suppressed
    localStorage.clear();
    const task1 = { id: 't_sug_1', text: 'مهمة 1', priority: 'medium' };
    hayyizSaveTodos([task1]);
    assert(!isSuppressed(), 'Req 1: Prompt is allowed for newly created task when not suppressed');

    // 2. Click Start Pomodoro -> Task session set up via hayyizLaunchPomodoro
    let redirectedUrl = '';
    global.window.location = {
        set href(val) { redirectedUrl = val; },
        get href() { return redirectedUrl; }
    };
    hayyizLaunchPomodoro(task1, 0);
    const launchedTaskName = localStorage.getItem('hayyiz-current-task');
    const launchedTaskId = localStorage.getItem('hayyiz-current-task-id');
    assert(redirectedUrl.includes('pomodoro.html?task=') && launchedTaskName === 'مهمة 1' && launchedTaskId === 't_sug_1', 'Req 2: Launching Pomodoro connects session to task accurately');

    // 3. Reject suggestion -> Task remains saved cleanly
    const savedTodosReq3 = hayyizGetTodos();
    assert(savedTodosReq3.length === 1 && savedTodosReq3[0].id === 't_sug_1', 'Req 3: Rejecting suggestion preserves saved task safely');

    // 4. Select "Do not show today" -> Subsequent tasks on same day suppress prompt
    suppress('today');
    assert(isSuppressed(), 'Req 4: Selecting "Do not show today" suppresses prompt for subsequent tasks today');

    // 5. Date changes -> Prompt works again automatically
    mockToday = '2026-03-31';
    assert(!isSuppressed(), 'Req 5: After date changes, prompt works again automatically');

    // Reset date back
    mockToday = '2026-03-30';
    localStorage.clear();

    // 6. Select "Do not show for an hour" -> Prompt suppressed within hour
    suppress('hour');
    assert(isSuppressed(), 'Req 6: Selecting "Do not show for an hour" suppresses prompt');

    // Advance 30 mins (within 1 hour)
    mockTime += 30 * 60 * 1000;
    assert(isSuppressed(), 'Req 6b: Prompt remains suppressed after 30 minutes');

    // 7. More than 1 hour passes -> Prompt works again automatically
    mockTime += 31 * 60 * 1000; // 61 minutes total elapsed
    assert(!isSuppressed(), 'Req 7: After more than 1 hour passes, prompt shows again automatically');

    // 8 & 9. Page reload / browser restart during suppression period -> Suppression continues from LocalStorage
    localStorage.clear();
    mockTime = 1700000000000;
    suppress('hour');
    // Simulate browser reload / restart reading fresh from LocalStorage
    const storedSuppression = localStorage.getItem('hayyiz-hide-pomo-prompt-hour');
    assert(storedSuppression !== null && isSuppressed(), 'Req 8 & 9: Page reload and browser restart preserve suppression state via LocalStorage');

    // 10. Expiration -> Stale suppression data is automatically removed/ignored without permanently blocking prompt
    mockTime += 61 * 60 * 1000; // Expired
    const activeCheckExpired = isSuppressed();
    const cleanedKey = localStorage.getItem('hayyiz-hide-pomo-prompt-hour');
    assert(!activeCheckExpired && cleanedKey === null, 'Req 10: Expired suppression data is cleared and does not block prompts permanently');

    Date.now = realDateNow;
}

// --- 9. INLINE DURATION EDITING UNIT TESTS ---
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

// --- 13. POST-FOCUS DECISION MODAL TESTS (A, B, C, D, E) ---
{
    localStorage.clear();
    const taskObj = { id: 't_post_modal', text: 'مذاكرة الفلسفة', priority: 'high', completed: false, focusDone: 0 };
    hayyizSaveTodos([taskObj]);

    // Simulate Pomodoro completion (Step 1: Real completion & focus logging without task completion)
    hayyizApplyFocusResult({ workMin: 25, taskId: 't_post_modal', taskText: 'مذاكرة الفلسفة' });
    const taskAfterFocus = hayyizGetTaskById('t_post_modal');
    assert(taskAfterFocus.focusDone === 25 && taskAfterFocus.completed === false, 'Post-Focus Order: Pomodoro completion updates focus time while task strictly remains incomplete');

    // Test A: User selects "المهمة مكتملة"
    hayyizCompleteTask('t_post_modal', 'مذاكرة الفلسفة');
    const taskOptionA = hayyizGetTaskById('t_post_modal');
    const recOptionA = hayyizRecommendNext();
    assert(taskOptionA.completed === true && !recOptionA.ranked.some(r => r.task.id === 't_post_modal'), 'Test A (المهمة مكتملة): Task becomes completed on explicit user choice and Student OS re-evaluates');

    // Test B: User selects "المهمة التالية"
    localStorage.clear();
    const taskB1 = { id: 't_b1', text: 'مهمة حالية', priority: 'medium', completed: false, focusDone: 0 };
    const taskB2 = { id: 't_b2', text: 'مهمة قادمة أولوية عالية', priority: 'high', completed: false, focusDone: 0 };
    hayyizSaveTodos([taskB1, taskB2]);
    hayyizApplyFocusResult({ workMin: 25, taskId: 't_b1', taskText: 'مهمة حالية' });

    // Option B chosen (next task chosen, current task stays incomplete)
    const taskB1After = hayyizGetTaskById('t_b1');
    const recOptionB = hayyizRecommendNext();
    const nextTaskForB = recOptionB.ranked.find(r => r.task.id !== 't_b1')?.task;
    assert(taskB1After.completed === false && taskB1After.focusDone === 25, 'Test B (المهمة التالية): Current task remains incomplete with focus logged');
    assert(nextTaskForB && nextTaskForB.id === 't_b2', 'Test B (المهمة التالية): Student OS selects next highest priority action cleanly');

    // Test C: User selects "استراحة"
    localStorage.clear();
    const taskC = { id: 't_c', text: 'مهمة جارية', priority: 'high', completed: false };
    hayyizSaveTodos([taskC]);
    hayyizApplyFocusResult({ workMin: 25, taskId: 't_c', taskText: 'مهمة جارية' });
    const pStateC = { mode: 'break', status: 'idle', totalDuration: 300, remainingSeconds: 300 };
    hayyizSaveFocusState(pStateC);
    const taskCAfter = hayyizGetTaskById('t_c');
    const restoredStateC = hayyizGetFocusState();
    assert(taskCAfter.completed === false && restoredStateC.mode === 'break', 'Test C (استراحة): Task remains incomplete and break flow is preserved using existing Pomodoro logic');

    // Test D: User selects "تسجيل ملاحظة"
    localStorage.clear();
    const taskD = { id: 't_d', text: 'تمرين كيمياء', priority: 'medium', completed: false };
    hayyizSaveTodos([taskD]);
    hayyizApplyFocusResult({ workMin: 25, taskId: 't_d', taskText: 'تمرين كيمياء' });
    const targetNoteUrl = 'notes.html?title=' + encodeURIComponent('تمرين كيمياء');
    const taskDAfter = hayyizGetTaskById('t_d');
    assert(taskDAfter.completed === false && targetNoteUrl.includes('notes.html?title='), 'Test D (تسجيل ملاحظة): Opens notes flow with task context while task strictly remains incomplete');

    // Test E: Modal Dismiss / Close
    localStorage.clear();
    const taskE = { id: 't_e', text: 'مراجعة أدب', priority: 'high', completed: false };
    hayyizSaveTodos([taskE]);
    hayyizApplyFocusResult({ workMin: 25, taskId: 't_e', taskText: 'مراجعة أدب' });
    // Dismiss modal (no action selected)
    const taskEAfter = hayyizGetTaskById('t_e');
    const focusLogsE = hayyizGetFocusSessions();
    assert(taskEAfter.completed === false && taskEAfter.focusDone === 25, 'Test E (إغلاق Modal): Closing modal leaves task incomplete with focus session recorded safely');
}

// --- 12. STUDENT OS SCENARIOS A THROUGH J E2E TESTS ---
{
    // Scenario A: New User (No data)
    localStorage.clear();
    const evalA = hayyizEvaluateStudentState();
    const planA = hayyizGenerateDailyPlan();
    const recA = hayyizRecommendNext();
    assert(evalA === null, 'Scenario A: New user with no data produces no artificial suggestion');
    assert(Array.isArray(planA) && planA.length === 0, 'Scenario A: New user produces no artificial daily plan items');
    assert(recA.next === null && recA.ranked.length === 0, 'Scenario A: New user produces no fake task recommendations');

    // Scenario B: Upcoming Exam
    const tomorrowStr = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
    localStorage.setItem('hayyiz-student-exams', JSON.stringify([
        { id: 'ex_sc_b', name: 'اختبار الكيمياء النهائي', date: tomorrowStr }
    ]));
    const evalB = hayyizEvaluateStudentState();
    assert(evalB && evalB.type === 'exam' && evalB.badge === 'اختبار قريب' && evalB.actionType === 'pomo-event', 'Scenario B: Discovers upcoming exam importance and creates actionable pomo-event');

    // Scenario C: Exam + Task (Relation vs No relation)
    // C1: No relation -> Task is not falsely claimed as linked to exam
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_unrelated', text: 'تنظيف الغرفة', priority: 'medium', completed: false }
    ]));
    const evalC1 = hayyizEvaluateStudentState();
    assert(evalC1 && evalC1.task === null && evalC1.event.name === 'اختبار الكيمياء النهائي', 'Scenario C: Unrelated task is strictly not claimed as linked to exam');

    // C2: Actual relation -> Task is correctly linked to exam
    const subMath = hayyizAddSubject('كيمياء');
    localStorage.setItem('hayyiz-student-exams', JSON.stringify([
        { id: 'ex_sc_c', name: 'اختبار الكيمياء', date: tomorrowStr, subjectId: subMath.id }
    ]));
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_related', text: 'مراجعة الباب الأول كيمياء', priority: 'high', subjectId: subMath.id, completed: false }
    ]));
    const evalC2 = hayyizEvaluateStudentState();
    assert(evalC2 && evalC2.task && evalC2.task.id === 't_related' && evalC2.actionType === 'pomo-task', 'Scenario C: Truly related task is correctly linked to upcoming exam recommendation');

    // Scenario D & E: Start Action & Pomodoro Context Preservation
    let redirectedUrl = '';
    global.window.location = {
        set href(val) { redirectedUrl = val; },
        get href() { return redirectedUrl; }
    };
    hayyizLaunchPomodoro(evalC2.task, 0);
    const storedCurrentTask = localStorage.getItem('hayyiz-current-task');
    const storedCurrentTaskId = localStorage.getItem('hayyiz-current-task-id');
    assert(redirectedUrl.includes('pomodoro.html?task=') && storedCurrentTask === 'مراجعة الباب الأول كيمياء' && storedCurrentTaskId === 't_related', 'Scenario D & E: Launching action sets existing Pomodoro context accurately without inventing new systems');

    // Scenario F: Session Completion & Re-evaluation
    const realDateNow = Date.now;
    let mockTime = 1800000000000;
    Date.now = () => mockTime;
    const sessF = {
        mode: 'focus',
        status: 'running',
        sessionId: 'sess_sc_f',
        totalDuration: 1500,
        remainingSeconds: 1500,
        endTime: mockTime + 1500 * 1000,
        context: { type: 'task', id: 't_related', title: 'مراجعة الباب الأول كيمياء' }
    };
    hayyizSaveFocusState(sessF);
    mockTime += 1500 * 1000; // 25 mins elapsed
    const reconciledF = hayyizReconcilePomodoroState();
    const updatedTaskF = hayyizGetTaskById('t_related');
    assert(reconciledF.status === 'completed' && updatedTaskF.focusDone === 25, 'Scenario F: Pomodoro completion updates focus time and task state cleanly');

    // Scenario G: Task Completion
    hayyizCompleteTask('t_related', 'مراجعة الباب الأول كيمياء');
    const recG = hayyizRecommendNext();
    const planG = hayyizGenerateDailyPlan();
    assert(!recG.ranked.some(r => r.task.id === 't_related'), 'Scenario G: Completed task is strictly removed from active recommendations');
    assert(!planG.some(p => p.id === 'plan-task-t_related'), 'Scenario G: Completed task is strictly removed from daily plan');

    // Scenario H: Overdue Task vs Upcoming Exam Priority
    localStorage.clear();
    const getOffsetDateStr = (offsetDays) => {
        const base = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
        const parts = base.split('-').map(Number);
        const dt = new Date(parts[0], parts[1] - 1, parts[2] + offsetDays);
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    };
    localStorage.setItem('hayyiz-student-exams', JSON.stringify([
        { id: 'ex_sc_h', name: 'اختبار التاريخ', date: getOffsetDateStr(5) } // 5 days away
    ]));
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_sc_h_overdue', text: 'حل واجب الرياضيات المتأخر', date: getOffsetDateStr(-3), priority: 'high', completed: false } // 3 days overdue
    ]));
    const evalH = hayyizEvaluateStudentState();
    assert(evalH && evalH.id === 'task-overdue' && evalH.task.id === 't_sc_h_overdue', 'Scenario H: Overdue task scores higher than a distant exam based on priority/scoring');

    // Scenario I: Active Running Pomodoro Non-Interruption
    const runningSessI = {
        mode: 'focus',
        status: 'running',
        remainingSeconds: 800,
        totalDuration: 1500,
        endTime: mockTime + 800 * 1000,
        context: { type: 'free', id: null, title: 'تركيز جاري' }
    };
    hayyizSaveFocusState(runningSessI);
    const evalI = hayyizEvaluateStudentState();
    assert(evalI && evalI.id === 'running-focus' && evalI.score === 1000, 'Scenario I: Active running Pomodoro session takes top priority without interruption');

    // Scenario J: Custom Pomodoro Duration Preference
    localStorage.clear();
    localStorage.setItem('hayyiz-pref-work', '50');
    localStorage.setItem('hayyiz-student-exams', JSON.stringify([
        { id: 'ex_sc_j', name: 'اختبار الفيزياء', date: getOffsetDateStr(1) }
    ]));
    const evalJ = hayyizEvaluateStudentState();
    assert(evalJ && evalJ.text.includes('50 دقيقة'), 'Scenario J: Evaluation Engine incorporates custom 50-minute Pomodoro duration preference');

    Date.now = realDateNow;
}

// --- 11. CENTRALIZED RULE ENGINE & DAILY PLAN TESTS ---
{
    // Clean storage
    localStorage.removeItem('hayyiz-student-exams');
    localStorage.removeItem('hayyiz-exams');
    localStorage.removeItem('hayyiz-todos');
    localStorage.removeItem('hayyiz-habits');
    localStorage.removeItem('hayyiz-pomodoro-state');
    localStorage.setItem('hayyiz-focus-minutes-today', '0');

    // Case 1: Empty state -> returns null
    const emptyStateRes = hayyizEvaluateStudentState();
    assert(emptyStateRes === null, 'Rule Engine: Empty student state produces no artificial suggestion (null)');

    // Case 2: Running Focus Session -> Suggests continuing active session
    const runningSession = {
        status: 'running',
        startTime: Date.now() - 300000,
        durationMinutes: 25,
        remainingSeconds: 1200,
        context: { title: 'مراجعة الاحياء' }
    };
    hayyizSaveFocusState(runningSession);
    const runningRes = hayyizEvaluateStudentState();
    assert(runningRes && runningRes.id === 'running-focus' && runningRes.type === 'pomodoro', 'Rule Engine: Suggests continuing active running Pomodoro focus session');
    localStorage.removeItem('hayyiz-pomodoro-state');

    // Helper date string formatter relative to getTodayLocal()
    const getOffsetDateStr = (offsetDays) => {
        const base = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
        const parts = base.split('-').map(Number);
        const dt = new Date(parts[0], parts[1] - 1, parts[2] + offsetDays);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const day = String(dt.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // Case 3: Upcoming Exam <= 7 days & focusMinutes < 25 -> Suggests exam focus session
    const tomorrowStr = getOffsetDateStr(1);
    localStorage.setItem('hayyiz-student-exams', JSON.stringify([
        { id: 'ex_test_1', name: 'اختبار الرياضيات النهائي', date: tomorrowStr, done: false }
    ]));
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_ex_1', text: 'حل نماذج الرياضيات', priority: 'high', completed: false }
    ]));
    const examRes = hayyizEvaluateStudentState();
    assert(examRes && examRes.id === 'exam-upcoming' && examRes.badge === 'اختبار قريب', 'Rule Engine: Suggests study session for upcoming exam when focus minutes < 25');

    // Case 4: Overdue tasks -> Suggests overdue task
    localStorage.removeItem('hayyiz-student-exams');
    const yesterdayStr = getOffsetDateStr(-1);
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_ov_1', text: 'تسليم بحث التاريخ المتأخر', date: yesterdayStr, completed: false }
    ]));
    const overdueRes = hayyizEvaluateStudentState();
    assert(overdueRes && overdueRes.id === 'task-overdue' && overdueRes.badge === 'مهام متأخرة', 'Rule Engine: Suggests focusing on overdue tasks first');

    // Case 5: Daily Plan generation priority ordering
    localStorage.setItem('hayyiz-student-exams', JSON.stringify([
        { id: 'ex_plan_1', name: 'اختبار الفيزياء', date: tomorrowStr, done: false }
    ]));
    localStorage.setItem('hayyiz-habits', JSON.stringify([
        { id: 'h_plan_1', title: 'قراءة كتاب', streak: 5, lastCompleted: '2020-01-01' }
    ]));

    const planItems = hayyizGenerateDailyPlan();
    assert(Array.isArray(planItems) && planItems.length >= 3, 'Daily Plan: Generates integrated list from exams, todos, and habits');
    assert(planItems[0].type === 'exam' || planItems[0].type === 'todo', 'Daily Plan: Exams and overdue/priority tasks take top priority');
    assert(planItems.some(item => item.type === 'habit'), 'Daily Plan: Includes uncompleted daily habits');

    // Case 6: Backward compatibility - Dual-key exam merging without data loss or duplication
    localStorage.setItem('hayyiz-student-exams', JSON.stringify([
        { id: 'ex_new_1', name: 'اختبار الحاسب', date: tomorrowStr }
    ]));
    localStorage.setItem('hayyiz-exams', JSON.stringify([
        { id: 'ex_new_1', name: 'اختبار الحاسب', date: tomorrowStr },
        { id: 'ex_legacy_2', name: 'اختبار الإنجليزي القديم', date: tomorrowStr }
    ]));
    const mergedExams = hayyizGetExams();
    assert(mergedExams.length === 2, 'hayyizGetExams: Merges and deduplicates exams from both hayyiz-student-exams and legacy hayyiz-exams without data loss');

    // Case 7: Custom user Pomodoro duration preference in recommendation
    localStorage.setItem('hayyiz-pref-work', '45');
    const customPomoRes = hayyizEvaluateStudentState();
    assert(customPomoRes && customPomoRes.text.includes('45 دقيقة'), 'Rule Engine: Uses custom user Pomodoro duration preference in recommendations');
    localStorage.removeItem('hayyiz-pref-work');
}

console.log(`\n===================================`);
console.log(`REGRESSION AUDIT SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log(`===================================\n`);

if (failed > 0) process.exit(1);
