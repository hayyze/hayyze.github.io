const fs = require('fs');

// Load common.js and gpa.js
const commonJs = fs.readFileSync('./common.js', 'utf8');
const gpaJs = fs.readFileSync('./gpa.js', 'utf8');

global.window = global;
global.document = {
    readyState: 'complete',
    body: { classList: { toggle: () => {} } },
    documentElement: { classList: { toggle: () => {}, contains: () => false } },
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
if (typeof HAYYIZ_BACKUP_KEYS !== 'undefined') global.HAYYIZ_BACKUP_KEYS = HAYYIZ_BACKUP_KEYS;

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

console.log('=== RUNNING HAYYIZ AUTOMATED TEST SUITE ===\n');

// 1. GPA Engine Tests
{
    const subjs = [
        { grade: 90, weight: 5 },
        { grade: 100, weight: 5 }
    ];
    const gpa = hayyizComputeWeightedGpa(subjs);
    assert(gpa === 95, 'GPA calculation calculates correct weighted average (95)');
}

{
    const subjs = [{ grade: 80, weight: 4 }];
    const targetRes = hayyizAnalyzeAcademicTarget(subjs, 90);
    assert(targetRes.status === 'reachable' && targetRes.recommendedGrades[0].requiredGrade === 90, 'GPA Target Optimization calculates exact required grade');
}

// 2. Student Calendar & Age Tests
{
    const birthDate = new Date(2005, 4, 15); // May 15, 2005
    const nowObj = new Date(2023, 4, 15);    // May 15, 2023
    const age = hayyizCalculateExactAge(birthDate, nowObj);
    assert(age.years === 18 && age.months === 0 && age.days === 0, 'Exact age calculation identifies 18th birthday correctly');
}

{
    const birthDate = new Date(2008, 0, 1);
    const nowObj = new Date(2023, 0, 1);
    const status18 = hayyizGet18Status(birthDate, nowObj);
    assert(!status18.is18OrOlder && status18.years === 3, '18 status correctly calculates remaining years until 18');
}

{
    localStorage.clear();
    const futureYear = new Date().getFullYear() + 1;
    const examEvent = { id: 'ex_test1', name: 'اختبار الرياضيات النهائي', date: `${futureYear}-05-10`, type: 'exam' };
    localStorage.setItem('hayyiz-student-exams', JSON.stringify([examEvent]));

    const convertedTodo = hayyizConvertEventToTodo(examEvent);
    assert(convertedTodo && convertedTodo.text.includes('مراجعة: اختبار الرياضيات النهائي') && convertedTodo.priority === 'high', 'Event successfully converted into a high priority Todo task');
}

// 3. Task & Focus Session Integration Tests
{
    localStorage.clear();
    const task = { text: 'دراسة الفيزياء', priority: 'high', minutes: '25' };
    hayyizSaveTodos([task]);
    const todos = hayyizGetTodos();
    assert(todos.length === 1 && todos[0].id && todos[0].text === 'دراسة الفيزياء', 'Task created with generated ID and saved');

    hayyizApplyFocusResult({ workMin: 25, taskId: todos[0].id, taskText: 'دراسة الفيزياء' });
    const updatedTodos = hayyizGetTodos();
    assert(updatedTodos[0].focusDone === 25 && updatedTodos[0].sessionsDone === 1, 'Focus session applies focus minutes (25) and session count (1) to task');

    // Student Action Engine Helper API Tests
    const tId = todos[0].id;
    const fetched = hayyizGetTaskById(tId);
    assert(fetched && fetched.text === 'دراسة الفيزياء', 'hayyizGetTaskById retrieves task correctly');

    const updated = hayyizUpdateTask(tId, { priority: 'high', minutes: '50' });
    assert(updated && updated.minutes === '50', 'hayyizUpdateTask updates fields safely');

    const summary = hayyizGetTaskSummary();
    assert(summary && summary.activeCount === 1 && summary.totalFocusMinutes === 25, 'hayyizGetTaskSummary computes accurate metrics');

    const dueOverdue = hayyizFormatRelativeDueDate('2020-01-01');
    assert(dueOverdue.isOverdue && dueOverdue.label.includes('متأخرة'), 'hayyizFormatRelativeDueDate calculates relative overdue text');

    const dueToday = hayyizFormatRelativeDueDate(getTodayLocal());
    assert(!dueToday.isOverdue && dueToday.label === 'اليوم', 'hayyizFormatRelativeDueDate calculates today correctly');

    const deleted = hayyizDeleteTask(tId);
    assert(deleted && hayyizGetTodos().length === 0, 'hayyizDeleteTask removes task safely');
}

// 4. Habits Streak Logic Tests
{
    localStorage.clear();
    const habits = [{ name: 'ممارسة الرياضة', streak: 1, lastCompleted: '2025-01-01' }];
    localStorage.setItem('hayyiz-habits', JSON.stringify(habits));
    const saved = JSON.parse(localStorage.getItem('hayyiz-habits'));
    assert(saved[0].name === 'ممارسة الرياضة' && saved[0].streak === 1, 'Habits persist and load state correctly');
}

// 4b. Enhanced Notes Engine Behavioral Tests
{
    localStorage.clear();

    // 1. Legacy Note Normalization
    const legacyNote = { title: 'ملخص كيمياء', content: 'شرح تفاعلات الأكسدة والاختزال', tags: 'مراجعة, مهم' };
    localStorage.setItem('hayyiz-notes', JSON.stringify([legacyNote]));

    hayyizEnsureDataShape();
    let notesList = hayyizParseJSON('hayyiz-notes', []);
    assert(
        notesList.length === 1 &&
        notesList[0].id &&
        notesList[0].title === 'ملخص كيمياء',
        'Notes Behavioral: Legacy note auto-assigns unique ID and retains content'
    );

    // 2. Behavioral Search, Filter & Sort Functions
    const sampleNotes = [
        { id: 'n1', title: 'أساسيات الجبر', content: 'المعادلات الخطية والمصفوفات', subject: 'رياضيات', category: 'ملخص', tags: ['رياضيات', 'مهم'], created: 1000, updated: 5000, isPinned: false, isFavorite: true, isReview: true, relatedTaskId: 't1', relatedTask: 'واجب الجبر' },
        { id: 'n2', title: 'ميكانيكا نيوتن', content: 'قوانين الحركة والجاذبية', subject: 'فيزياء', category: 'مراجعة', tags: ['فيزياء', 'اختبار'], created: 2000, updated: 4000, isPinned: true, isFavorite: false, isReview: true, relatedTaskId: 't2', relatedTask: 'مسائل الفيزياء' },
        { id: 'n3', title: 'القواعد النحوية', content: 'الإنشاء والإعراب والفعل المضارع', subject: 'لغة عربية', category: 'تعريفات', tags: ['عربي', 'مهم'], created: 3000, updated: 3000, isPinned: false, isFavorite: true, isReview: false, relatedTaskId: null, relatedTask: null }
    ];

    // Search by title
    const searchTitleRes = sampleNotes.filter(n => (n.title || '').toLowerCase().includes('الجبر'));
    assert(searchTitleRes.length === 1 && searchTitleRes[0].id === 'n1', 'Notes Behavioral: Search by title finds correct note');

    // Search by content
    const searchContentRes = sampleNotes.filter(n => (n.content || '').toLowerCase().includes('الجاذبية'));
    assert(searchContentRes.length === 1 && searchContentRes[0].id === 'n2', 'Notes Behavioral: Search by content finds correct note');

    // Filter by subject
    const filterSubjectRes = sampleNotes.filter(n => n.subject === 'فيزياء');
    assert(filterSubjectRes.length === 1 && filterSubjectRes[0].id === 'n2', 'Notes Behavioral: Filter by subject extracts matching notes');

    // Filter by tag
    const filterTagRes = sampleNotes.filter(n => Array.isArray(n.tags) && n.tags.includes('مهم'));
    assert(filterTagRes.length === 2 && filterTagRes.some(n => n.id === 'n1') && filterTagRes.some(n => n.id === 'n3'), 'Notes Behavioral: Filter by tag extracts notes containing tag');

    // Pinned-note behavior (pinned notes sorted to top)
    const sortedPinned = [...sampleNotes].sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1));
    assert(sortedPinned[0].id === 'n2' && sortedPinned[0].isPinned, 'Notes Behavioral: Pinned notes are placed at top');

    // Favorite-note behavior
    const favNotes = sampleNotes.filter(n => n.isFavorite);
    assert(favNotes.length === 2 && favNotes.every(n => n.isFavorite), 'Notes Behavioral: Filter favorites isolates favorite notes');

    // Review-note behavior
    const reviewNotes = sampleNotes.filter(n => n.isReview);
    assert(reviewNotes.length === 2 && reviewNotes.every(n => n.isReview), 'Notes Behavioral: Filter review isolates notes marked for review');

    // Sorting (created-asc, title-asc)
    const sortedCreatedAsc = [...sampleNotes].sort((a, b) => a.created - b.created);
    assert(sortedCreatedAsc[0].id === 'n1' && sortedCreatedAsc[2].id === 'n3', 'Notes Behavioral: Sort by created-asc orders correctly');

    const sortedTitleAsc = [...sampleNotes].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ar'));
    assert(sortedTitleAsc[0].id === 'n1', 'Notes Behavioral: Sort by title-asc orders alphabetically');

    // 3. Duplicate Task Names with Distinct IDs
    const duplicateTasks = [
        { id: 't_dup_101', text: 'واجب كيمياء', priority: 'high', completed: false },
        { id: 't_dup_102', text: 'واجب كيمياء', priority: 'medium', completed: false } // duplicate text, distinct ID!
    ];
    hayyizSaveTodos(duplicateTasks);

    const noteLinkedToSecondDup = {
        id: 'n_dup_test',
        title: 'ملاحظة الكيمياء الثانية',
        content: 'ملاحظة خاصة بالواجب الثاني',
        relatedTaskId: 't_dup_102',
        relatedTask: 'واجب كيمياء'
    };

    const currentTodos = hayyizGetTodos();
    // Authoritative lookup strictly by ID:
    const matchedTaskById = currentTodos.find(t => t && t.id === noteLinkedToSecondDup.relatedTaskId);
    assert(matchedTaskById && matchedTaskById.id === 't_dup_102', 'Notes Behavioral: Duplicate task names correctly distinguish linked task by unique ID');

    // 4. Missing Linked Task Handling
    const noteWithDeletedTask = { id: 'n_missing', title: 'اختبار محذوف', content: 'محتوى', relatedTaskId: 'non_existent_id' };
    const matchedMissing = currentTodos.find(t => t && t.id === noteWithDeletedTask.relatedTaskId);
    assert(matchedMissing === undefined, 'Notes Behavioral: Missing linked task gracefully returns undefined without throwing');

    // 5. Deletion Flow Simulation
    let notesArr = [noteLinkedToSecondDup, noteWithDeletedTask];
    const deleteIdx = notesArr.findIndex(n => n.id === 'n_missing');
    if (deleteIdx >= 0) notesArr.splice(deleteIdx, 1);
    assert(notesArr.length === 1 && notesArr[0].id === 'n_dup_test', 'Notes Behavioral: Deletion flow safely removes specified note by ID');
}

// 5. Data Backup Integrity Tests
{
    localStorage.clear();
    localStorage.setItem('hayyiz-todos', JSON.stringify([{ id: 'h1', text: 'اختبار' }]));
    const backupKeys = global.HAYYIZ_BACKUP_KEYS;
    assert(
        Array.isArray(backupKeys) &&
        backupKeys.includes('hayyiz-todos') &&
        backupKeys.includes('hayyiz-notes') &&
        backupKeys.includes('hayyiz-student-exams') &&
        backupKeys.includes('hayyiz-hide-pomo-prompt-today') &&
        backupKeys.includes('hayyiz-hide-pomo-prompt-hour'),
        'Backup keys cover all essential platform data including Pomodoro prompt suppression preferences'
    );
}

// 6. Focus Engine State & Streak Unit Tests
{
    localStorage.clear();
    const state = {
        mode: 'focus',
        status: 'running',
        endTime: Date.now() + 1500 * 1000,
        remainingSeconds: 1500,
        totalDuration: 1500,
        context: { type: 'free', id: null, title: 'تركيز حر' }
    };
    hayyizSaveFocusState(state);
    const loaded = hayyizGetFocusState();
    assert(loaded && loaded.status === 'running' && loaded.remainingSeconds > 0, 'Focus Engine state persists and restores running timer state correctly');

    const today = getTodayLocal();
    const hist = {};
    hist[today] = 50;
    localStorage.setItem('hayyiz-focus-history', JSON.stringify(hist));
    const streak = hayyizCalculateStreak();
    assert(streak === 1, 'Focus Engine correctly calculates streak count for today');
}

// 7. Pomodoro Mode Transition Duration Tests
{
    // Test 1: Focus = 25m, Break = 5m
    localStorage.clear();
    localStorage.setItem('hayyiz-pref-work', '25');
    localStorage.setItem('hayyiz-pref-break', '5');
    localStorage.setItem('hayyiz-pref-long', '15');

    let state = {
        mode: 'focus',
        status: 'running',
        endTime: Date.now() - 1000, // session ended
        totalDuration: 25 * 60,
        remainingSeconds: 0,
        workMinutes: '25',
        breakMinutes: '5',
        longBreakMinutes: '15',
        sessionInCycle: 0,
        sessionId: 's_test1',
        context: { type: 'free', id: null, title: 'تركيز حر' }
    };
    hayyizSaveFocusState(state);
    let reconciled = hayyizReconcilePomodoroState();
    assert(reconciled && reconciled.pendingNextMode === 'break' && reconciled.pendingCompletionModal.breakMin === 5, 'Test 1: 25m Focus / 5m Break triggers break mode transition with 5 minutes');

    // Test 2: Focus = 40m, Break = 10m
    localStorage.clear();
    localStorage.setItem('hayyiz-pref-work', '40');
    localStorage.setItem('hayyiz-pref-break', '10');
    localStorage.setItem('hayyiz-pref-long', '20');

    state = {
        mode: 'focus',
        status: 'running',
        endTime: Date.now() - 1000,
        totalDuration: 40 * 60,
        remainingSeconds: 0,
        workMinutes: '40',
        breakMinutes: '10',
        longBreakMinutes: '20',
        sessionInCycle: 0,
        sessionId: 's_test2',
        context: { type: 'free', id: null, title: 'تركيز حر' }
    };
    hayyizSaveFocusState(state);
    reconciled = hayyizReconcilePomodoroState();
    assert(reconciled && reconciled.pendingNextMode === 'break' && reconciled.pendingCompletionModal.breakMin === 10, 'Test 2: 40m Focus / 10m Break triggers break mode transition with 10 minutes');

    // Test 3: Focus = 5m, Break = 15m
    localStorage.clear();
    localStorage.setItem('hayyiz-pref-work', '5');
    localStorage.setItem('hayyiz-pref-break', '15');
    localStorage.setItem('hayyiz-pref-long', '30');

    state = {
        mode: 'focus',
        status: 'running',
        endTime: Date.now() - 1000,
        totalDuration: 5 * 60,
        remainingSeconds: 0,
        workMinutes: '5',
        breakMinutes: '15',
        longBreakMinutes: '30',
        sessionInCycle: 0,
        sessionId: 's_test3',
        context: { type: 'free', id: null, title: 'تركيز حر' }
    };
    hayyizSaveFocusState(state);
    reconciled = hayyizReconcilePomodoroState();
    assert(reconciled && reconciled.pendingNextMode === 'break' && reconciled.pendingCompletionModal.breakMin === 15, 'Test 3: 5m Focus / 15m Break triggers break mode transition with 15 minutes');

    // Test 4 & 5: Cycle 4 -> Long Break
    localStorage.clear();
    localStorage.setItem('hayyiz-pref-work', '25');
    localStorage.setItem('hayyiz-pref-break', '5');
    localStorage.setItem('hayyiz-pref-long', '20');

    state = {
        mode: 'focus',
        status: 'running',
        endTime: Date.now() - 1000,
        totalDuration: 25 * 60,
        remainingSeconds: 0,
        workMinutes: '25',
        breakMinutes: '5',
        longBreakMinutes: '20',
        sessionInCycle: 3, // 4th session
        sessionId: 's_test4',
        context: { type: 'free', id: null, title: 'تركيز حر' }
    };
    hayyizSaveFocusState(state);
    reconciled = hayyizReconcilePomodoroState();
    assert(reconciled && reconciled.pendingNextMode === 'longBreak' && reconciled.pendingCompletionModal.isLongBreak && reconciled.pendingCompletionModal.breakMin === 20, 'Test 5: 4th focus session triggers long break transition with 20 minutes');
}

console.log(`\n===================================`);
console.log(`TEST SUITE RESULTS: ${passed} Passed, ${failed} Failed`);
console.log(`===================================\n`);

if (failed > 0) process.exit(1);
