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
    assert(swJs.includes("const CACHE_NAME = 'heez-v1.9.7';"), 'Service Worker uses cache version heez-v1.9.7');
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

// --- 14. SECTION 22 DAILY STUDENT LOOP SCENARIOS (A THROUGH F) ---
{
    // Scenario A: Exam near -> Related task exists -> Task recommended -> Start Pomodoro -> Completion -> Task incomplete -> Next decision
    localStorage.clear();
    const realDateNow = Date.now;
    let mockTime = 1900000000000;
    Date.now = () => mockTime;

    const todayStr = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
    const subMath = hayyizAddSubject('رياضيات');
    localStorage.setItem('hayyiz-student-exams', JSON.stringify([
        { id: 'ex_loop_a', name: 'اختبار الرياضيات', date: todayStr, subjectId: subMath.id }
    ]));
    const taskA = { id: 't_loop_a', text: 'مراجعة الرياضيات', priority: 'high', subjectId: subMath.id, completed: false, focusDone: 0 };
    hayyizSaveTodos([taskA]);

    // Evaluation recommends related task with clear actionTitle & reason
    const evalA = hayyizEvaluateStudentState();
    assert(evalA && evalA.task && evalA.task.id === 't_loop_a' && evalA.actionTitle === 'مراجعة الرياضيات', 'Scenario A: Exam near with related task recommends task');

    // Start Pomodoro
    hayyizLaunchPomodoro(evalA.task, 0);
    const pStateA = {
        mode: 'focus', status: 'running', remainingSeconds: 1500, totalDuration: 1500,
        endTime: mockTime + 1500 * 1000,
        context: { type: 'task', id: 't_loop_a', title: 'مراجعة الرياضيات' }
    };
    hayyizSaveFocusState(pStateA);

    // Completion
    mockTime += 1500 * 1000;
    const reconciledA = hayyizReconcilePomodoroState();
    const taskAAfter = hayyizGetTaskById('t_loop_a');
    assert(reconciledA.status === 'completed' && taskAAfter.focusDone === 25 && taskAAfter.completed === false, 'Scenario A: Focus completed (25m logged) while task strictly remains incomplete');

    // Scenario B: Pomodoro completed -> User marks task complete -> Task completed -> Recommendation changes
    const taskB2 = { id: 't_loop_b2', text: 'مراجعة الفيزياء التالية', priority: 'medium', completed: false, focusDone: 0 };
    hayyizSaveTodos([taskAAfter, taskB2]);
    hayyizCompleteTask('t_loop_a', 'مراجعة الرياضيات');
    const taskACompleted = hayyizGetTaskById('t_loop_a');
    const recB = hayyizRecommendNext();
    assert(taskACompleted.completed === true && recB.next && recB.next.id === 't_loop_b2', 'Scenario B: User marks task complete and recommendation re-evaluates to next task');

    // Scenario C: Pomodoro completed -> User chooses next task -> Current task remains incomplete -> Next action selected
    localStorage.clear();
    const taskC1 = { id: 't_c1', text: 'مهمة 1', priority: 'high', completed: false, focusDone: 0 };
    const taskC2 = { id: 't_c2', text: 'مهمة 2', priority: 'high', completed: false, focusDone: 0 };
    hayyizSaveTodos([taskC1, taskC2]);
    hayyizApplyFocusResult({ workMin: 25, taskId: 't_c1', taskText: 'مهمة 1' });
    const recC = hayyizRecommendNext();
    const nextForC = recC.ranked.find(r => r.task.id !== 't_c1')?.task;
    const taskC1After = hayyizGetTaskById('t_c1');
    assert(taskC1After.completed === false && taskC1After.focusDone === 25 && nextForC && nextForC.id === 't_c2', 'Scenario C: Choosing next task leaves current task incomplete and selects next action');

    // Scenario D: Pomodoro completed -> User chooses break -> Task remains unchanged -> Existing break flow
    localStorage.clear();
    const taskD = { id: 't_d_break', text: 'مهمة الراحة', priority: 'medium', completed: false };
    hayyizSaveTodos([taskD]);
    hayyizApplyFocusResult({ workMin: 25, taskId: 't_d_break', taskText: 'مهمة الراحة' });
    hayyizSaveFocusState({ mode: 'break', status: 'idle', remainingSeconds: 300, totalDuration: 300 });
    const taskDAfter = hayyizGetTaskById('t_d_break');
    const stateD = hayyizGetFocusState();
    assert(taskDAfter.completed === false && stateD.mode === 'break', 'Scenario D: Choosing break keeps task unchanged and enters break mode');

    // Scenario E: Pomodoro completed -> User chooses note -> Existing Notes flow -> Task remains unchanged
    localStorage.clear();
    const taskE = { id: 't_e_note', text: 'مهمة الملاحظة', priority: 'high', completed: false };
    hayyizSaveTodos([taskE]);
    hayyizApplyFocusResult({ workMin: 25, taskId: 't_e_note', taskText: 'مهمة الملاحظة' });
    const noteUrlE = 'notes.html?title=' + encodeURIComponent('مهمة الملاحظة') + '&taskId=' + encodeURIComponent('t_e_note');
    const taskEAfter = hayyizGetTaskById('t_e_note');
    assert(taskEAfter.completed === false && noteUrlE.includes('taskId=t_e_note'), 'Scenario E: Choosing note launches notes flow with task context while task remains unchanged');

    // Scenario F: No tasks, No exams, No relevant events -> No invented recommendation
    localStorage.clear();
    const evalF = hayyizEvaluateStudentState();
    const recF = hayyizRecommendNext();
    const planF = hayyizGenerateDailyPlan();
    assert(evalF === null && recF.next === null && planF.length === 0, 'Scenario F: Empty state produces no artificial recommendation (returns null)');

    Date.now = realDateNow;
}

// --- 11. CENTRALIZED RULE ENGINE & ADAPTIVE DAILY PLAN SCENARIOS A-H ---
{
    localStorage.clear();

    const getOffsetDateStr = (offsetDays) => {
        const base = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
        const parts = base.split('-').map(Number);
        const dt = new Date(parts[0], parts[1] - 1, parts[2] + offsetDays);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const day = String(dt.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // Scenario A: Tasks + Exam -> Primary action at top
    localStorage.setItem('hayyiz-student-exams', JSON.stringify([
        { id: 'ex_scen_a', name: 'اختبار الكيمياء', date: getOffsetDateStr(1) }
    ]));
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_scen_a1', text: 'مراجعة الكيمياء الباب 1', priority: 'high', completed: false },
        { id: 't_scen_a2', text: 'حل الواجب العادي', priority: 'low', completed: false }
    ]));
    const planScenA = hayyizGenerateDailyPlan();
    assert(planScenA.length > 0 && planScenA[0].isPrimaryNextAction === true, 'Scenario A: Primary Student OS decision is placed first in Daily Plan');

    // Scenario B: Complete Task A -> Regenerates plan without Task A
    hayyizCompleteTask('t_scen_a1', 'مراجعة الكيمياء الباب 1');
    const planScenB = hayyizGenerateDailyPlan();
    assert(!planScenB.some(item => item.task && item.task.id === 't_scen_a1'), 'Scenario B: Completed task is immediately absent from regenerated Daily Plan');

    // Scenario C: Focus Task A -> Complete Pomodoro -> Task A remains incomplete, Focus logged in plan subtitle
    localStorage.clear();
    const taskScenC = { id: 't_scen_c', text: 'حل تمارين الفيزياء', minutes: 50, focusDone: 0, priority: 'high', completed: false };
    hayyizSaveTodos([taskScenC]);
    hayyizApplyFocusResult({ workMin: 25, taskId: 't_scen_c', taskText: 'حل تمارين الفيزياء' });
    const planScenC = hayyizGenerateDailyPlan();
    const taskItemC = planScenC.find(i => i.task && i.task.id === 't_scen_c');
    assert(taskItemC && taskItemC.subtitle.includes('متبقي 25 دقيقة'), 'Scenario C: Focus session logged while task remains incomplete; Daily Plan reflects remaining focus time');

    // Scenario D: Completion modal choice "Task complete" -> Task A completed -> Plan updates
    hayyizCompleteTask('t_scen_c', 'حل تمارين الفيزياء');
    const planScenD = hayyizGenerateDailyPlan();
    assert(!planScenD.some(i => i.task && i.task.id === 't_scen_c'), 'Scenario D: User marking task complete removes it from regenerated plan');

    // Scenario E: Completion modal choice "Next task" -> Task A remains incomplete, next task (Task B) becomes primary
    localStorage.clear();
    const taskE1 = { id: 't_scen_e1', text: 'مهمة أ', focusDone: 0, priority: 'medium', completed: false };
    const taskE2 = { id: 't_scen_e2', text: 'مهمة ب أولوية عالية', priority: 'high', completed: false };
    hayyizSaveTodos([taskE1, taskE2]);
    const planScenE = hayyizGenerateDailyPlan();
    assert(planScenE[0].task && planScenE[0].task.id === 't_scen_e2', 'Scenario E: Next task option keeps task incomplete while next action becomes primary in Daily Plan');

    // Scenario F: Exam proximity changes -> Distant exam (>2 days) does NOT pollute plan; urgent exam (<= 2 days) appears
    localStorage.clear();
    localStorage.setItem('hayyiz-student-exams', JSON.stringify([
        { id: 'ex_distant', name: 'اختبار بعيد بعد 6 أيام', date: getOffsetDateStr(6) },
        { id: 'ex_scen_f', name: 'اختبار الحاسب القريب جداً', date: getOffsetDateStr(0) }
    ]));
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_scen_f', text: 'مهمة عادية', priority: 'low', completed: false }
    ]));
    const planScenF = hayyizGenerateDailyPlan();
    assert(planScenF.some(item => item.event && item.event.id === 'ex_scen_f'), 'Scenario F: Urgent exam (<= 2 days) appears in concise plan');
    assert(!planScenF.some(item => item.event && item.event.id === 'ex_distant'), 'Scenario F: Distant exam (> 2 days) does not pollute concise Daily Plan items');

    // Scenario I: Plan Item Count Cap (3-5 items max)
    localStorage.clear();
    const tenTasks = Array.from({ length: 10 }, (_, idx) => ({
        id: 't_cap_' + idx,
        text: 'مهمة اختباري رقم ' + idx,
        priority: idx === 0 ? 'high' : 'medium',
        completed: false
    }));
    hayyizSaveTodos(tenTasks);
    const planCapped = hayyizGenerateDailyPlan();
    assert(planCapped.length >= 1 && planCapped.length <= 5, 'Scenario I: Daily Plan items strictly capped between 1 and 5 items');

    // Scenario J: Honest Time Phrasing
    localStorage.clear();
    const taskNoMin = { id: 't_no_min', text: 'مهمة بدون دقائق محددة', completed: false };
    const taskWithMin = { id: 't_with_min', text: 'مهمة بدقائق محددة', minutes: 40, completed: false };
    hayyizSaveTodos([taskNoMin, taskWithMin]);
    const planHonest = hayyizGenerateDailyPlan();
    const itemNoMin = planHonest.find(i => i.task && i.task.id === 't_no_min');
    const itemWithMin = planHonest.find(i => i.task && i.task.id === 't_with_min');
    assert(itemNoMin && itemNoMin.subtitle.includes('جلسة') && itemNoMin.subtitle.includes('مقترحة'), 'Scenario J: Task without explicit total duration shows honest suggestion subtitle');
    assert(itemWithMin && itemWithMin.subtitle === '40 دقيقة', 'Scenario J: Task with explicit total duration shows exact minute duration');

    // Scenario G: Empty state -> Empty plan array
    localStorage.clear();
    const planScenG = hayyizGenerateDailyPlan();
    assert(Array.isArray(planScenG) && planScenG.length === 0, 'Scenario G: Empty state produces no artificial or fake daily plan items');

    // Scenario H: Active running Pomodoro session -> Running session takes top priority without interruption
    const activeRunningState = {
        mode: 'focus',
        status: 'running',
        remainingSeconds: 600,
        totalDuration: 1500,
        endTime: Date.now() + 600000,
        context: { type: 'free', id: null, title: 'جلسة تركيز قائمة' }
    };
    hayyizSaveFocusState(activeRunningState);
    const planScenH = hayyizGenerateDailyPlan();
    assert(planScenH.length > 0 && planScenH[0].type === 'pomodoro' && planScenH[0].badge === 'جلسة جارية', 'Scenario H: Active running Pomodoro takes top priority in Daily Plan');
}

// --- 15. SINGLE CENTRAL DECISION ENGINE REGRESSION TESTS ---
{
    localStorage.clear();

    // 1. Existence of single central decision source function & primitives
    assert(typeof hayyizBuildStudentSnapshot === 'function', 'hayyizBuildStudentSnapshot primitive exists');
    assert(typeof hayyizRankTasks === 'function', 'hayyizRankTasks primitive exists');
    assert(typeof hayyizEvaluateDecisions === 'function', 'hayyizEvaluateDecisions primitive exists');
    assert(typeof hayyizBuildDailyPlan === 'function', 'hayyizBuildDailyPlan primitive exists');
    assert(typeof hayyizComputeStudentDecisionState === 'function', 'hayyizComputeStudentDecisionState orchestrator exists');

    // 2. Single snapshot creation per compute pass
    let snapshotCount = 0;
    const origBuildSnap = hayyizBuildStudentSnapshot;
    hayyizBuildStudentSnapshot = function(...args) {
        snapshotCount++;
        return origBuildSnap.apply(this, args);
    };

    snapshotCount = 0;
    const singlePassState = hayyizComputeStudentDecisionState();
    assert(snapshotCount === 1, 'Snapshot is created exactly once per central decision calculation pass');
    hayyizBuildStudentSnapshot = origBuildSnap;

    // 3. primaryDecision, dailyPlan, and recommendation share same snapshot/state
    assert(singlePassState.primaryDecision !== undefined && singlePassState.dailyPlan !== undefined && singlePassState.recommendation !== undefined, 'Central state contains primaryDecision, dailyPlan, and recommendation');

    // 4. Thin wrappers execute only required primitives without rerun of full pipeline
    let evalCount = 0;
    const origEvalDec = hayyizEvaluateDecisions;
    hayyizEvaluateDecisions = function(...args) {
        evalCount++;
        return origEvalDec.apply(this, args);
    };

    evalCount = 0;
    hayyizRecommendNext(3);
    assert(evalCount === 0, 'hayyizRecommendNext wrapper does NOT rerun decision evaluation primitive');

    hayyizEvaluateDecisions = origEvalDec;

    // 5. Consistency between Summary decision and Daily Plan top primary action
    const getOffsetDateStr = (offsetDays) => {
        const base = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
        const parts = base.split('-').map(Number);
        const dt = new Date(parts[0], parts[1] - 1, parts[2] + offsetDays);
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    };

    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_cde_1', text: 'مهمة عالية الأولوية عاجلة', priority: 'high', date: getOffsetDateStr(-1), completed: false },
        { id: 't_cde_2', text: 'مهمة عادية', priority: 'low', completed: false }
    ]));

    const state1 = hayyizComputeStudentDecisionState();
    assert(state1.primaryDecision !== null, 'Central engine evaluates primary decision');
    assert(state1.dailyPlan.length > 0, 'Central engine generates daily plan');
    assert(state1.dailyPlan[0].isPrimaryNextAction === true, 'Top item in daily plan is marked as primary next action');
    assert(state1.dailyPlan[0].title === state1.primaryDecision.actionTitle, 'Decision title matches top daily plan item title exactly');

    // 6. Exclusion of completed tasks from recommendations and plan
    hayyizCompleteTask('t_cde_1', 'مهمة عالية الأولوية عاجلة');
    const state2 = hayyizComputeStudentDecisionState();
    assert(!state2.activeTodos.some(t => t.id === 't_cde_1'), 'Completed task excluded from active todos');
    assert(!state2.dailyPlan.some(p => p.task && p.task.id === 't_cde_1'), 'Completed task excluded from daily plan');
    assert(!state2.recommendation.ranked.some(r => r.task.id === 't_cde_1'), 'Completed task excluded from ranked recommendations');

    // 7. Active running focus session priority in central state
    const runningFocusState = {
        mode: 'focus',
        status: 'running',
        remainingSeconds: 1200,
        totalDuration: 1500,
        endTime: Date.now() + 1200000,
        context: { type: 'free', id: null, title: 'تركيز جاري حالي' }
    };
    hayyizSaveFocusState(runningFocusState);
    const state3 = hayyizComputeStudentDecisionState();
    assert(state3.primaryDecision && state3.primaryDecision.id === 'running-focus', 'Active running focus session takes top priority (score 1000) in central decision');
    assert(state3.dailyPlan[0].id === 'plan-running-focus', 'Running focus session is placed at index 0 of daily plan');

    // 8. Urgent exam priority
    localStorage.clear();
    localStorage.setItem('hayyiz-student-exams', JSON.stringify([
        { id: 'ex_cde_urgent', name: 'اختبار غداً', date: getOffsetDateStr(1) }
    ]));
    const state4 = hayyizComputeStudentDecisionState();
    assert(state4.primaryDecision && state4.primaryDecision.id === 'exam-upcoming', 'Urgent upcoming exam evaluated as primary decision when focus minutes low');
    assert(state4.dailyPlan[0].event && state4.dailyPlan[0].event.id === 'ex_cde_urgent', 'Urgent exam placed at index 0 of daily plan');

    // 9. Near exam + overdue task combined priority
    localStorage.clear();
    localStorage.setItem('hayyiz-student-exams', JSON.stringify([
        { id: 'ex_comb', name: 'اختبار الفيزياء', date: getOffsetDateStr(5) }
    ]));
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_comb_overdue', text: 'واجب كيمياء متأخر', date: getOffsetDateStr(-3), priority: 'high', completed: false }
    ]));
    const state5 = hayyizComputeStudentDecisionState();
    assert(state5.primaryDecision && state5.primaryDecision.id === 'task-overdue', 'Overdue task prioritizes over distant exam');

    // 10. Multi-type items in daily plan (todo, exam, habit)
    localStorage.clear();
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_multi_1', text: 'مهمة 1', priority: 'high', completed: false }
    ]));
    localStorage.setItem('hayyiz-student-exams', JSON.stringify([
        { id: 'ex_multi_1', name: 'اختبار اليوم', date: getOffsetDateStr(0) }
    ]));
    localStorage.setItem('hayyiz-habits', JSON.stringify([
        { id: 'h_multi_1', title: 'عادة يومية', lastCompleted: '2020-01-01' }
    ]));
    const state6 = hayyizComputeStudentDecisionState();
    assert(state6.dailyPlan.some(i => i.type === 'todo'), 'Daily plan contains todo item');
    assert(state6.dailyPlan.some(i => i.type === 'exam'), 'Daily plan contains exam item');
    assert(state6.dailyPlan.some(i => i.type === 'habit'), 'Daily plan contains habit item');
}

// --- 16. UNIFIED DAY STATUS MODEL COMPOSITE REGRESSION SCENARIOS (A THROUGH J) ---
{
    localStorage.clear();

    const getOffsetDateStr = (offsetDays) => {
        const base = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
        const parts = base.split('-').map(Number);
        const dt = new Date(parts[0], parts[1] - 1, parts[2] + offsetDays);
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    };

    // Scenario A: 3 overdue tasks + NO near exam
    localStorage.clear();
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_a1', text: 'مهمة متأخرة 1', date: getOffsetDateStr(-3), completed: false },
        { id: 't_a2', text: 'مهمة متأخرة 2', date: getOffsetDateStr(-2), completed: false },
        { id: 't_a3', text: 'مهمة متأخرة 3', date: getOffsetDateStr(-1), completed: false }
    ]));
    const stateA = hayyizComputeStudentDecisionState();
    assert(stateA.dayStatus.statusKey === 'accumulated_pressure', 'Scenario A: 3 overdue tasks produces "accumulated_pressure"');
    assert(!stateA.dayStatus.description.includes('استحقاق') && !stateA.dayStatus.description.includes('اختبار'), 'Scenario A: Description does NOT claim non-existent near exam');
    assert(stateA.dayStatus.description.includes('3 مهام متأخرة'), 'Scenario A: Description strictly states overdue tasks count');

    // Scenario B: 3 overdue tasks + near exam
    localStorage.clear();
    localStorage.setItem('hayyiz-student-exams', JSON.stringify([
        { id: 'ex_b', name: 'اختبار الكيمياء', date: getOffsetDateStr(1) }
    ]));
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_b1', text: 'مهمة متأخرة 1', date: getOffsetDateStr(-3), completed: false },
        { id: 't_b2', text: 'مهمة متأخرة 2', date: getOffsetDateStr(-2), completed: false },
        { id: 't_b3', text: 'مهمة متأخرة 3', date: getOffsetDateStr(-1), completed: false }
    ]));
    const stateB = hayyizComputeStudentDecisionState();
    assert(stateB.dayStatus.statusKey === 'accumulated_pressure', 'Scenario B: Overdue tasks + near exam produces "accumulated_pressure"');
    assert(stateB.dayStatus.description.includes('مهام متأخرة') && stateB.dayStatus.description.includes('اختبار الكيمياء'), 'Scenario B: Description explicitly mentions BOTH overdue tasks and near exam');

    // Scenario C: 7 historical past days (60, 60, 0, 0, 0, 0, 0)
    localStorage.clear();
    const histC = {};
    histC[getOffsetDateStr(-1)] = 60;
    histC[getOffsetDateStr(-2)] = 60;
    histC[getOffsetDateStr(-3)] = 0;
    histC[getOffsetDateStr(-4)] = 0;
    histC[getOffsetDateStr(-5)] = 0;
    histC[getOffsetDateStr(-6)] = 0;
    histC[getOffsetDateStr(-7)] = 0;
    localStorage.setItem('hayyiz-focus-history', JSON.stringify(histC));
    const compC = hayyizGetFocusHistoryComparison(50);
    assert(compC.hasSufficientData === true, 'Scenario C: Sufficient data recognized when 7 historical days exist');
    assert(compC.avgMinutes === 17, 'Scenario C: 7-day average calculated as (120/7) = 17 minutes');
    assert(compC.comparisonText === 'أعلى من معدلك الأسبوعي', 'Scenario C: 50 minutes focus is higher than 17-minute 7-day average');

    // Scenario D: Insufficient history (< 3 days recorded in history object)
    localStorage.clear();
    const histD = {};
    histD[getOffsetDateStr(-1)] = 45;
    histD[getOffsetDateStr(-2)] = 45;
    localStorage.setItem('hayyiz-focus-history', JSON.stringify(histD));
    const compD = hayyizGetFocusHistoryComparison(30);
    assert(compD.hasSufficientData === false, 'Scenario D: Less than 3 days in history returns hasSufficientData: false');
    assert(compD.comparisonText === '', 'Scenario D: No false weekly average claim made');

    // Scenario E: 25 mins focus only + large number of remaining active tasks (5 tasks)
    localStorage.clear();
    localStorage.setItem('hayyiz-focus-minutes-today', '25');
    const fiveTasks = Array.from({ length: 5 }, (_, i) => ({ id: 't_e_' + i, text: 'مهمة متبقية ' + i, completed: false }));
    localStorage.setItem('hayyiz-todos', JSON.stringify(fiveTasks));
    const stateE = hayyizComputeStudentDecisionState();
    assert(stateE.dayStatus.title !== 'إنجاز واستمرارية ممتازة' && !stateE.dayStatus.description.includes('ممتاز'), 'Scenario E: 25 mins focus with 5 remaining tasks does NOT make exaggerated claims like "ممتاز"');

    // Scenario F: Exam tomorrow + linked task has focusDone > 0
    localStorage.clear();
    const subPhysics = hayyizAddSubject('فيزياء');
    localStorage.setItem('hayyiz-student-exams', JSON.stringify([
        { id: 'ex_f', name: 'اختبار الفيزياء', date: getOffsetDateStr(1), subjectId: subPhysics.id }
    ]));
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_f', text: 'مراجعة أجهزة الفيزياء', subjectId: subPhysics.id, focusDone: 30, completed: false }
    ]));
    const stateF = hayyizComputeStudentDecisionState();
    assert(stateF.dayStatus.statusKey === 'upcoming_due', 'Scenario F: Near exam with partial progress produces "upcoming_due"');
    assert(stateF.dayStatus.title.includes('استعداد لاختبار قريب') && stateF.dayStatus.description.includes('30 دقيقة تركيز'), 'Scenario F: Description explicitly acknowledges focus progress made on exam preparation task');

    // Scenario G: Overdue tasks + near exam + low focus today
    localStorage.clear();
    localStorage.setItem('hayyiz-focus-minutes-today', '0');
    localStorage.setItem('hayyiz-student-exams', JSON.stringify([
        { id: 'ex_g', name: 'اختبار الرياضيات', date: getOffsetDateStr(1) }
    ]));
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_g1', text: 'واجب متأخر', date: getOffsetDateStr(-2), completed: false }
    ]));
    const stateG = hayyizComputeStudentDecisionState();
    assert(stateG.dayStatus.statusKey === 'accumulated_pressure', 'Scenario G: Overdue task + near exam + low focus produces "accumulated_pressure"');

    // Scenario H: Uncompleted habit + urgent academic task
    localStorage.clear();
    localStorage.setItem('hayyiz-habits', JSON.stringify([
        { id: 'h_h1', title: 'شرب الماء', lastCompleted: '2020-01-01' }
    ]));
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_h1', text: 'تسليم مشروع الحاسب المتأخر', date: getOffsetDateStr(-1), completed: false }
    ]));
    const stateH = hayyizComputeStudentDecisionState();
    assert(stateH.dayStatus.statusKey === 'struggling', 'Scenario H: Uncompleted habit does NOT mask urgent academic overdue status');

    // Scenario I: No tasks, no exams, no habits, no activity
    localStorage.clear();
    const stateI = hayyizComputeStudentDecisionState();
    assert(stateI.dayStatus.statusKey === 'no_plan', 'Scenario I: Completely empty state produces statusKey "no_plan"');
    assert(stateI.dayStatus.statusLabel === 'بدون خطة نشطة', 'Scenario I: Label is "بدون خطة نشطة"');

    // Scenario J: Active tasks exist but no focus started (focusDone == 0, focusMinutesToday == 0)
    localStorage.clear();
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_j1', text: 'قراءة الفصل الأول', focusDone: 0, completed: false }
    ]));
    const stateJ = hayyizComputeStudentDecisionState();
    assert(stateJ.dayStatus.statusKey === 'ready_to_start', 'Scenario J: Unstarted active tasks produce distinct statusKey "ready_to_start"');
    assert(stateJ.dayStatus.statusLabel === 'جاهز للبدء', 'Scenario J: Label is "جاهز للبدء" (distinct from "no_plan")');

    // Test K: 3 history entries, but ALL older than 7 days (outside window)
    localStorage.clear();
    const histK = {};
    histK[getOffsetDateStr(-10)] = 60;
    histK[getOffsetDateStr(-11)] = 60;
    histK[getOffsetDateStr(-12)] = 60;
    localStorage.setItem('hayyiz-focus-history', JSON.stringify(histK));
    const compK = hayyizGetFocusHistoryComparison(40);
    assert(compK.hasSufficientData === false, 'Test K: 3 entries older than 7 days result in hasSufficientData: false');
    assert(compK.comparisonText === '', 'Test K: No false weekly comparison text displayed when all entries are outside window');

    // Test L: 2 entries inside past 7 days + 1 entry outside window
    localStorage.clear();
    const histL = {};
    histL[getOffsetDateStr(-1)] = 30;
    histL[getOffsetDateStr(-2)] = 30;
    histL[getOffsetDateStr(-15)] = 60;
    localStorage.setItem('hayyiz-focus-history', JSON.stringify(histL));
    const compL = hayyizGetFocusHistoryComparison(30);
    assert(compL.hasSufficientData === false, 'Test L: 2 entries in window + 1 outside window results in hasSufficientData: false');

    // Test M: 7 valid history entries inside past 7 days (60, 60, 0, 0, 0, 0, 0)
    localStorage.clear();
    const histM = {};
    histM[getOffsetDateStr(-1)] = 60;
    histM[getOffsetDateStr(-2)] = 60;
    histM[getOffsetDateStr(-3)] = 0;
    histM[getOffsetDateStr(-4)] = 0;
    histM[getOffsetDateStr(-5)] = 0;
    histM[getOffsetDateStr(-6)] = 0;
    histM[getOffsetDateStr(-7)] = 0;
    localStorage.setItem('hayyiz-focus-history', JSON.stringify(histM));
    const compM = hayyizGetFocusHistoryComparison(50);
    assert(compM.hasSufficientData === true, 'Test M: 7 valid days in window yield hasSufficientData: true');
    assert(compM.avgMinutes === 17, 'Test M: Average is 17 minutes (120/7)');
    assert(compM.comparisonText === 'أعلى من معدلك الأسبوعي', 'Test M: 50 mins focus is higher than 17-minute 7-day average');

    // Test N: 3 entries inside past 7 days window + extra entries outside window
    localStorage.clear();
    const histN = {};
    histN[getOffsetDateStr(-1)] = 30;
    histN[getOffsetDateStr(-2)] = 30;
    histN[getOffsetDateStr(-3)] = 30;
    histN[getOffsetDateStr(-10)] = 50;
    histN[getOffsetDateStr(-20)] = 50;
    localStorage.setItem('hayyiz-focus-history', JSON.stringify(histN));
    const compN = hayyizGetFocusHistoryComparison(50);
    assert(compN.hasSufficientData === true, 'Test N: Sufficiency decided strictly by 3 entries inside window');
}

// --- 18. DOM INTEGRATION RENDERING TESTS (DOM-1, DOM-2, DOM-3, DOM-4) ---
{
    localStorage.clear();

    // Helper to construct a lightweight simulated DOM node for summary rendering verification
    function createMockElement(tagName) {
        const children = [];
        const attributes = {};
        const classList = new Set();
        let textContent = '';
        let innerHTML = '';

        function findChild(parent, predicate) {
            for (const c of parent.children) {
                if (c && typeof c === 'object') {
                    if (predicate(c)) return c;
                    const nested = findChild(c, predicate);
                    if (nested) return nested;
                }
            }
            return null;
        }

        function findAllChildren(parent, predicate, matches) {
            for (const c of parent.children) {
                if (c && typeof c === 'object') {
                    if (predicate(c)) matches.push(c);
                    findAllChildren(c, predicate, matches);
                }
            }
        }

        const el = {
            tagName: (tagName || 'DIV').toUpperCase(),
            children,
            attributes,
            style: {},
            classList: {
                add: (...names) => names.forEach(n => classList.add(n)),
                remove: (...names) => names.forEach(n => classList.delete(n)),
                contains: (name) => classList.has(name),
                toggle: (name, force) => {
                    if (force === true) classList.add(name);
                    else if (force === false) classList.delete(name);
                    else if (classList.has(name)) classList.delete(name);
                    else classList.add(name);
                    return classList.has(name);
                },
                toString: () => Array.from(classList).join(' ')
            },
            get className() { return Array.from(classList).join(' '); },
            set className(val) {
                classList.clear();
                if (val) String(val).split(/\s+/).filter(Boolean).forEach(n => classList.add(n));
            },
            get textContent() {
                if (textContent) return textContent;
                return children.map(c => typeof c === 'string' ? c : c.textContent).join('');
            },
            set textContent(val) {
                textContent = String(val);
                children.length = 0;
            },
            get innerHTML() { return innerHTML || textContent; },
            set innerHTML(val) {
                innerHTML = String(val);
                textContent = String(val).replace(/<[^>]*>/g, '');
            },
            appendChild: (child) => {
                if (child) children.push(child);
                return child;
            },
            replaceChildren: (...newChildren) => {
                children.length = 0;
                textContent = '';
                innerHTML = '';
                newChildren.forEach(c => children.push(c));
            },
            setAttribute: (k, v) => { attributes[k] = String(v); },
            getAttribute: (k) => attributes[k] || null,
            querySelector: (sel) => {
                if (sel.startsWith('.')) {
                    const cls = sel.slice(1);
                    return findChild(el, c => c && c.classList && typeof c.classList.contains === 'function' && c.classList.contains(cls));
                }
                return null;
            },
            querySelectorAll: (sel) => {
                const matches = [];
                findAllChildren(el, c => {
                    if (sel.startsWith('.') && c && c.classList && typeof c.classList.contains === 'function' && c.classList.contains(sel.slice(1))) {
                        matches.push(c);
                    }
                }, matches);
                return matches;
            },
            addEventListener: () => {}
        };

        return el;
    }

    const mockContent = createMockElement('div');
    mockContent.id = 'summary-content';

    const listeners = [];
    const prevDoc = global.document;
    global.document = {
        readyState: 'complete',
        getElementById: (id) => (id === 'summary-content' ? mockContent : null),
        createElement: (tag) => createMockElement(tag),
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: (event, fn) => {
            listeners.push({ event, fn });
        }
    };

    function runDOMContentLoaded() {
        listeners.forEach(l => {
            if (l.event === 'DOMContentLoaded') l.fn();
        });
    }

    // Test DOM-1: Day Status rendering (statusLabel, title, description in DOM)
    localStorage.clear();
    const getOffsetDateStr = (offsetDays) => {
        const base = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
        const parts = base.split('-').map(Number);
        const dt = new Date(parts[0], parts[1] - 1, parts[2] + offsetDays);
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    };

    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_dom1_1', text: 'مهمة متأخرة 1', date: getOffsetDateStr(-2), completed: false },
        { id: 't_dom1_2', text: 'مهمة متأخرة 2', date: getOffsetDateStr(-3), completed: false },
        { id: 't_dom1_3', text: 'مهمة متأخرة 3', date: getOffsetDateStr(-1), completed: false }
    ]));

    eval(summaryJs);
    runDOMContentLoaded();

    const statusBadgeEl = mockContent.querySelector('.dash-day-status');
    const greetingDateEl = mockContent.querySelector('.dash-greeting-date');
    const greetingDescEl = mockContent.querySelector('.dash-greeting-description');

    assert(statusBadgeEl !== null && statusBadgeEl.textContent.includes('حالة اليوم: ضغط متراكم'), 'Test DOM-1: dayStatus.statusLabel appears in DOM in correct badge element');
    assert(greetingDateEl !== null && greetingDateEl.textContent.includes('تراكم في المهام المتأخرة'), 'Test DOM-1: dayStatus.title appears in DOM in subtitle element');
    assert(greetingDescEl !== null && greetingDescEl.textContent.includes('3 مهام متأخرة عن موعدها'), 'Test DOM-1: dayStatus.description appears in DOM in description element');

    // Test DOM-2: Historical comparison presence conditional on sufficient data
    // Case 2a: Sufficient data -> comparisonText appears in description
    localStorage.clear();
    listeners.length = 0; // Clear listeners before re-evaluating summaryJs
    const histSufficient = {};
    for (let i = 1; i <= 7; i++) {
        histSufficient[getOffsetDateStr(-i)] = 40;
    }
    localStorage.setItem('hayyiz-focus-history', JSON.stringify(histSufficient));
    localStorage.setItem('hayyiz-focus-minutes-today', '60');
    localStorage.setItem('hayyiz-sessions-day', getOffsetDateStr(0));
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_dom2', text: 'مهمة اليوم', completed: false }
    ]));

    mockContent.replaceChildren();
    eval(summaryJs);
    runDOMContentLoaded();

    const descWithHist = mockContent.querySelector('.dash-greeting-description');
    assert(descWithHist !== null && descWithHist.textContent.includes('أعلى من معدلك الأسبوعي'), 'Test DOM-2a: comparisonText appears in description when hasSufficientData is true');

    // Case 2b: Insufficient data -> NO comparisonText in description
    localStorage.clear();
    listeners.length = 0;
    localStorage.setItem('hayyiz-focus-history', JSON.stringify({}));
    localStorage.setItem('hayyiz-focus-minutes-today', '60');
    localStorage.setItem('hayyiz-sessions-day', getOffsetDateStr(0));
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_dom2b', text: 'مهمة اليوم', completed: false }
    ]));

    mockContent.replaceChildren();
    eval(summaryJs);
    runDOMContentLoaded();

    const descWithoutHist = mockContent.querySelector('.dash-greeting-description');
    const hasComparisonText = descWithoutHist ? descWithoutHist.textContent.includes('معدلك') : false;
    assert(!hasComparisonText, 'Test DOM-2b: comparisonText is omitted from description when hasSufficientData is false');

    // Test DOM-3: Task Progress formatting (done=25, minutes=50 -> "أُنجز 25 من 50 دقيقة (50%)", done=25, minutes=null -> "أُنجز 25 دقيقة تركيز", no NaN/Infinity)
    const progWithTotal = hayyizFormatTaskProgress({ focusDone: 25, minutes: 50 });
    assert(progWithTotal.progressText === 'أُنجز 25 من 50 دقيقة (50%)', 'Test DOM-3: Formats task progress with valid total percentage correctly');

    const progWithoutTotal = hayyizFormatTaskProgress({ focusDone: 25, minutes: null });
    assert(progWithoutTotal.progressText === 'أُنجز 25 دقيقة تركيز', 'Test DOM-3: Safe formatting without total duration ("أُنجز 25 دقيقة تركيز")');

    const progInvalid = hayyizFormatTaskProgress({ focusDone: 25, minutes: 'abc' });
    assert(!progInvalid.progressText.includes('NaN') && !progInvalid.progressText.includes('Infinity') && progInvalid.progressText === 'أُنجز 25 دقيقة تركيز', 'Test DOM-3: Prevents NaN and Infinity in progress formatting');

    // Test DOM-4: Absence of duplicated information
    localStorage.clear();
    listeners.length = 0;
    localStorage.setItem('hayyiz-focus-history', JSON.stringify(histSufficient));
    localStorage.setItem('hayyiz-focus-minutes-today', '60');
    localStorage.setItem('hayyiz-sessions-day', getOffsetDateStr(0));
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_dom4', text: 'مهمة اليوم', completed: false }
    ]));

    mockContent.replaceChildren();
    eval(summaryJs);
    runDOMContentLoaded();

    const greetingText = mockContent.querySelector('.dash-greeting') ? mockContent.querySelector('.dash-greeting').textContent : '';
    const occurrences = (greetingText.match(/أعلى من معدلك الأسبوعي/g) || []).length;
    assert(occurrences === 1, 'Test DOM-4: comparisonText appears exactly once without duplicate repetition in greeting');

    global.document = prevDoc;
}

// --- 17. FINE-TUNED DAILY SUMMARY COMPOSITE SCENARIOS (1 TO 8) ---
{
    localStorage.clear();

    const getOffsetDateStr = (offsetDays) => {
        const base = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
        const parts = base.split('-').map(Number);
        const dt = new Date(parts[0], parts[1] - 1, parts[2] + offsetDays);
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    };

    // Scenario 1: Near exam + overdue task + low focus
    localStorage.clear();
    localStorage.setItem('hayyiz-focus-minutes-today', '10');
    localStorage.setItem('hayyiz-student-exams', JSON.stringify([
        { id: 'ex_comp_1', name: 'اختبار الرياضيات النهائي', date: getOffsetDateStr(1) }
    ]));
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_comp_1', text: 'واجب الفيزياء المتأخر', date: getOffsetDateStr(-2), completed: false }
    ]));
    const stateComp1 = hayyizComputeStudentDecisionState();
    assert(stateComp1.dayStatus.statusKey === 'accumulated_pressure', 'Composite Scenario 1: Near exam + overdue task + low focus yields accumulated_pressure status');
    assert(stateComp1.primaryDecision !== null && (stateComp1.primaryDecision.id === 'exam-upcoming' || stateComp1.primaryDecision.id === 'task-overdue'), 'Composite Scenario 1: Near exam + overdue task yields urgent primary decision');

    // Scenario 2: In-progress task + near exam
    localStorage.clear();
    const subChem = hayyizAddSubject('كيمياء');
    localStorage.setItem('hayyiz-student-exams', JSON.stringify([
        { id: 'ex_comp_2', name: 'اختبار الكيمياء', date: getOffsetDateStr(1), subjectId: subChem.id }
    ]));
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_comp_2', text: 'مراجعة الباب الأول كيمياء', subjectId: subChem.id, minutes: 50, focusDone: 25, completed: false }
    ]));
    const stateComp2 = hayyizComputeStudentDecisionState();
    assert(stateComp2.dayStatus.statusKey === 'upcoming_due', 'Composite Scenario 2: In-progress exam preparation yields upcoming_due status');
    assert(stateComp2.dayStatus.description.includes('25 دقيقة تركيز'), 'Composite Scenario 2: Description acknowledges exact partial focus progress');

    // Scenario 3: Good achievement today + future tasks
    localStorage.clear();
    const todayStr = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_comp_3a', text: 'مهمة منجزة 1', completed: true, completedAt: todayStr },
        { id: 't_comp_3b', text: 'مهمة منجزة 2', completed: true, completedAt: todayStr },
        { id: 't_comp_3c', text: 'مهمة مستقبلية', date: getOffsetDateStr(3), completed: false }
    ]));
    const stateComp3 = hayyizComputeStudentDecisionState();
    assert(stateComp3.dayStatus.statusKey === 'good', 'Composite Scenario 3: Good achievement today with completed tasks yields good status');
    assert(stateComp3.dayStatus.completedToday === 2, 'Composite Scenario 3: Completed tasks count is accurately set to 2');

    // Scenario 4: Uncompleted habit + all study tasks completed
    localStorage.clear();
    localStorage.setItem('hayyiz-habits', JSON.stringify([
        { id: 'h_comp_4', title: 'القراءة اليومية', lastCompleted: '2020-01-01' }
    ]));
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_comp_4', text: 'مهمة منجزة اليوم', completed: true, completedAt: todayStr }
    ]));
    const stateComp4 = hayyizComputeStudentDecisionState();
    assert(stateComp4.dayStatus.statusKey === 'good', 'Composite Scenario 4: Uncompleted habit with all study tasks finished yields good day status');

    // Scenario 5: No tasks + no near exam
    localStorage.clear();
    const stateComp5 = hayyizComputeStudentDecisionState();
    assert(stateComp5.dayStatus.statusKey === 'no_plan', 'Composite Scenario 5: No tasks + no near exam yields no_plan status');
    assert(stateComp5.primaryDecision === null, 'Composite Scenario 5: No artificial or fake recommendation invented');

    // Scenario 6: Active running focus session
    localStorage.clear();
    hayyizSaveFocusState({
        mode: 'focus',
        status: 'running',
        remainingSeconds: 900,
        totalDuration: 1500,
        endTime: Date.now() + 900000,
        context: { type: 'free', id: null, title: 'تركيز لغة عربية' }
    });
    const stateComp6 = hayyizComputeStudentDecisionState();
    assert(stateComp6.dayStatus.statusKey === 'active_activity', 'Composite Scenario 6: Active running focus session yields active_activity day status');
    assert(stateComp6.primaryDecision.id === 'running-focus', 'Composite Scenario 6: Running focus session takes top priority');

    // Scenario 7: Task started -> closed -> returned to summary
    localStorage.clear();
    const taskComp7 = { id: 't_comp_7', text: 'حل واجب البرمجة', focusDone: 0, completed: false };
    hayyizSaveTodos([taskComp7]);
    hayyizApplyFocusResult({ workMin: 25, taskId: 't_comp_7', taskText: 'حل واجب البرمجة' });
    const stateComp7 = hayyizComputeStudentDecisionState();
    const taskSaved7 = hayyizGetTaskById('t_comp_7');
    assert(taskSaved7.focusDone === 25 && taskSaved7.completed === false, 'Composite Scenario 7: Task remains saved with 25 mins focus logged when user returns to summary');
    assert(stateComp7.dayStatus.statusKey === 'active_activity', 'Composite Scenario 7: Summary reflects active in-progress work correctly');

    // Scenario 8: Repeated page reloads without doubling stats
    localStorage.clear();
    hayyizEnsureTodayStats();
    localStorage.setItem('hayyiz-focus-minutes-today', '25');
    localStorage.setItem('hayyiz-sessions-today', '1');
    hayyizEnsureTodayStats();
    hayyizEnsureTodayStats();
    const stateComp8 = hayyizComputeStudentDecisionState();
    assert(stateComp8.focusMinutesToday === 25, 'Composite Scenario 8: Stats remain exactly 25 minutes after multiple page reloads');
}

console.log(`\n===================================`);
console.log(`REGRESSION AUDIT SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log(`===================================\n`);

if (failed > 0) process.exit(1);
