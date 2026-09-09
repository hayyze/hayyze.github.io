/**
 * test-next-step-execution-cycle.js
 *
 * Automated Regression Test Suite verifying the full Next Action Execution Cycle:
 * Student Decision -> Next Action -> Pomodoro Execution -> Result Persistence -> Decision Re-evaluation.
 */

const fs = require('fs');
const path = require('path');

// Mock LocalStorage environment
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

// Load common.js in global context
const commonCode = fs.readFileSync(path.join(__dirname, 'common.js'), 'utf8');
eval(commonCode);

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✅ PASS: ${message}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${message}`);
        failed++;
    }
}

console.log('=== RUNNING NEXT STEP EXECUTION CYCLE REGRESSION SUITE ===\n');

// -------------------------------------------------------------
// Test 1: New task (focusDone = 0) -> Primary decision provides startable task
// -------------------------------------------------------------
localStorage.clear();
hayyizEnsureDataShape();
const newTask = {
    id: 't_new_1',
    text: 'مراجعة الرياضيات',
    priority: 'high',
    minutes: 50,
    focusDone: 0,
    completed: false
};
hayyizSaveTodos([newTask]);

const state1 = hayyizComputeStudentDecisionState();
assert(state1.primaryDecision !== null, 'Test 1: Primary decision generated for new task');
assert(state1.primaryDecision.task && state1.primaryDecision.task.id === 't_new_1', 'Test 1: Correct task selected as primary decision');
assert(state1.primaryDecision.actionLabel === 'ابدأ جلسة تركيز', 'Test 1: Action label for new task is "ابدأ جلسة تركيز"');

// -------------------------------------------------------------
// Test 2: Task with focusDone = 25, minutes = 50 -> Partial progress formatting
// -------------------------------------------------------------
localStorage.clear();
hayyizEnsureDataShape();
const inProgTask = {
    id: 't_prog_2',
    text: 'مراجعة الفيزياء',
    priority: 'high',
    minutes: 50,
    focusDone: 25,
    completed: false
};
hayyizSaveTodos([inProgTask]);

const state2 = hayyizComputeStudentDecisionState();
assert(state2.primaryDecision !== null, 'Test 2: Primary decision generated for in-progress task');
assert(state2.primaryDecision.actionLabel === 'استكمال التركيز', 'Test 2: Action label for in-progress task is "استكمال التركيز"');
assert(state2.primaryDecision.taskProgress !== null, 'Test 2: Task progress object generated');
assert(state2.primaryDecision.taskProgress.progressText === 'أُنجز 25 من 50 دقيقة (50%)', 'Test 2: Progress formatted as "أُنجز 25 من 50 دقيقة (50%)"');

// -------------------------------------------------------------
// Test 3: Launching task focus session -> Correct taskId and metadata saved
// -------------------------------------------------------------
localStorage.clear();
hayyizEnsureDataShape();
const launchTask = {
    id: 't_launch_3',
    text: 'حل مسائل الكيمياء',
    priority: 'medium',
    minutes: 50,
    focusDone: 0,
    completed: false
};
hayyizSaveTodos([launchTask]);

let redirectUrl = '';
global.window = {
    location: {
        set href(url) {
            redirectUrl = url;
        }
    }
};

hayyizLaunchPomodoro(launchTask, 0);

assert(localStorage.getItem('hayyiz-current-task') === 'حل مسائل الكيمياء', 'Test 3: Task text stored in hayyiz-current-task');
assert(localStorage.getItem('hayyiz-current-task-id') === 't_launch_3', 'Test 3: Correct taskId stored in hayyiz-current-task-id');
const sessionPlan = JSON.parse(localStorage.getItem('hayyiz-task-session') || '{}');
assert(sessionPlan.id === 't_launch_3', 'Test 3: Task ID present in hayyiz-task-session payload');
assert(sessionPlan.totalMinutes === 50, 'Test 3: Total minutes stored accurately in hayyiz-task-session');
assert(redirectUrl.includes('taskId=t_launch_3'), 'Test 3: Launch URL contains taskId parameter');

// -------------------------------------------------------------
// Test 4: One completed focus session -> focusDone increased exactly once (0 -> 25)
// -------------------------------------------------------------
localStorage.clear();
hayyizEnsureDataShape();
const singleTask = {
    id: 't_single_4',
    text: 'قراءة الأحياء',
    priority: 'medium',
    minutes: 50,
    focusDone: 0,
    completed: false
};
hayyizSaveTodos([singleTask]);

hayyizApplyFocusResult({ workMin: 25, taskId: 't_single_4', taskText: 'قراءة الأحياء' });

const updatedSingle = hayyizGetTaskById('t_single_4');
assert(updatedSingle.focusDone === 25, 'Test 4: Task focusDone increased from 0 to 25 exactly once');
assert(updatedSingle.sessionsDone === 1, 'Test 4: Task sessionsDone set to 1');
assert(updatedSingle.completed === false, 'Test 4: Task remains incomplete after partial session');

// -------------------------------------------------------------
// Test 5: Two consecutive focus sessions completed -> focusDone increased accurately (25 -> 50), no doubling
// -------------------------------------------------------------
hayyizApplyFocusResult({ workMin: 25, taskId: 't_single_4', taskText: 'قراءة الأحياء' });

const doubleUpdated = hayyizGetTaskById('t_single_4');
assert(doubleUpdated.focusDone === 50, 'Test 5: Task focusDone increased from 25 to 50 cleanly');
assert(doubleUpdated.sessionsDone === 2, 'Test 5: Task sessionsDone set to 2');
assert(doubleUpdated.completed === false, 'Test 5: Task focus completion does not automatically set completed=true unless user explicitly marks it');

// -------------------------------------------------------------
// Test 6: Marking task completed -> Excluded from active recommendations and daily plan
// -------------------------------------------------------------
hayyizCompleteTask('t_single_4', 'قراءة الأحياء');

const completedTaskObj = hayyizGetTaskById('t_single_4');
assert(completedTaskObj.completed === true, 'Test 6: Task marked completed');

const state6 = hayyizComputeStudentDecisionState();
assert(!state6.activeTodos.some(t => t.id === 't_single_4'), 'Test 6: Completed task excluded from active todos');
assert(!state6.dailyPlan.some(item => item.task && item.task.id === 't_single_4'), 'Test 6: Completed task excluded from daily plan');
assert(state6.primaryDecision === null || (state6.primaryDecision.task && state6.primaryDecision.task.id !== 't_single_4'), 'Test 6: Completed task not suggested as primary decision');

// -------------------------------------------------------------
// Test 7: After task completion -> Next decision automatically transitions to remaining active data
// -------------------------------------------------------------
const nextTaskObj = {
    id: 't_next_7',
    text: 'المهمة المتبقية التالية',
    priority: 'high',
    minutes: 30,
    focusDone: 0,
    completed: false
};
hayyizSaveTodos([completedTaskObj, nextTaskObj]);

const state7 = hayyizComputeStudentDecisionState();
assert(state7.primaryDecision !== null, 'Test 7: Primary decision generated after previous task completed');
assert(state7.primaryDecision.task && state7.primaryDecision.task.id === 't_next_7', 'Test 7: Automatically transitioned to remaining active task');

// -------------------------------------------------------------
// Test 8: Active running Pomodoro session -> Primary decision yields running-focus ("متابعة الجلسة")
// -------------------------------------------------------------
localStorage.clear();
hayyizEnsureDataShape();
hayyizSaveTodos([{ id: 't_bg_8', text: 'مهمة خلفية', priority: 'high', completed: false }]);

hayyizSaveFocusState({
    mode: 'focus',
    status: 'running',
    remainingSeconds: 600,
    totalDuration: 1500,
    endTime: Date.now() + 600000,
    context: { type: 'task', id: 't_bg_8', title: 'مهمة خلفية' }
});

const state8 = hayyizComputeStudentDecisionState();
assert(state8.primaryDecision !== null, 'Test 8: Primary decision generated during active session');
assert(state8.primaryDecision.id === 'running-focus', 'Test 8: Active session takes top priority (id: running-focus)');
assert(state8.primaryDecision.actionLabel === 'متابعة الجلسة', 'Test 8: Action label is "متابعة الجلسة" preventing duplicate launches');

// -------------------------------------------------------------
// Test 9: Task without total duration (minutes = null/0) -> Safe progress text without NaN/Infinity
// -------------------------------------------------------------
localStorage.clear();
hayyizEnsureDataShape();
const noMinTask = {
    id: 't_nomin_9',
    text: 'مهمة بدون وقت كلي',
    priority: 'medium',
    minutes: null,
    focusDone: 25,
    completed: false
};
hayyizSaveTodos([noMinTask]);

const prog9 = hayyizFormatTaskProgress(noMinTask);
assert(prog9.hasProgress === true, 'Test 9: Recognizes progress for task without total duration');
assert(prog9.percent === null, 'Test 9: Percent is null (prevents NaN)');
assert(prog9.progressText === 'أُنجز 25 دقيقة تركيز', 'Test 9: Progress text formatted safely without Infinity');

const state9 = hayyizComputeStudentDecisionState();
assert(state9.primaryDecision !== null && state9.primaryDecision.task.id === 't_nomin_9', 'Test 9: Primary decision evaluates task without total duration smoothly');

// -------------------------------------------------------------
// Test 10: Two distinct tasks -> Focus sessions update respective task focusDone without data bleeding
// -------------------------------------------------------------
localStorage.clear();
hayyizEnsureDataShape();
const taskA = { id: 't_dist_A', text: 'مهمة أ', priority: 'high', minutes: 50, focusDone: 0, completed: false };
const taskB = { id: 't_dist_B', text: 'مهمة ب', priority: 'medium', minutes: 50, focusDone: 0, completed: false };
hayyizSaveTodos([taskA, taskB]);

hayyizApplyFocusResult({ workMin: 25, taskId: 't_dist_A', taskText: 'مهمة أ' });

const taskAFresh = hayyizGetTaskById('t_dist_A');
const taskBFresh = hayyizGetTaskById('t_dist_B');

assert(taskAFresh.focusDone === 25, 'Test 10: Task A focusDone updated to 25');
assert(taskBFresh.focusDone === 0, 'Test 10: Task B focusDone strictly unchanged (0)');

// -------------------------------------------------------------
// Test 11: Task ID precedence when task text is duplicate or index differs
// -------------------------------------------------------------
localStorage.clear();
hayyizEnsureDataShape();
const taskDup1 = { id: 't_dup_1', text: 'مراجعة الباب الأول', priority: 'high', focusDone: 0, completed: false };
const taskDup2 = { id: 't_dup_2', text: 'مراجعة الباب الأول', priority: 'medium', focusDone: 0, completed: false };
hayyizSaveTodos([taskDup1, taskDup2]);

// Launch via taskId for the second task (index 1)
hayyizLaunchPomodoro(taskDup2, 0); // passing indexHint 0 intentionally to test that taskId takes precedence over index
assert(localStorage.getItem('hayyiz-current-task-id') === 't_dup_2', 'Test 11: taskId t_dup_2 takes priority over indexHint');

// Apply result via taskId
hayyizApplyFocusResult({ workMin: 25, taskId: 't_dup_2', taskText: 'مراجعة الباب الأول' });
assert(hayyizGetTaskById('t_dup_1').focusDone === 0, 'Test 11: Duplicate task t_dup_1 remains 0');
assert(hayyizGetTaskById('t_dup_2').focusDone === 25, 'Test 11: Exact target task t_dup_2 receives 25 mins focus');

// -------------------------------------------------------------
// Test 12: End-to-End Integration Flow: Launch URL -> Pomodoro context init -> Focus completion -> Student Decision Re-evaluation
// -------------------------------------------------------------
localStorage.clear();
hayyizEnsureDataShape();
const e2eTask = { id: 't_e2e_12', text: 'مذاكرة الفلسفة الأخيرة', priority: 'high', minutes: 50, focusDone: 0, completed: false };
hayyizSaveTodos([e2eTask]);

// Step 1: Decision evaluation recommends e2eTask
const e2eState1 = hayyizComputeStudentDecisionState();
assert(e2eState1.primaryDecision.task.id === 't_e2e_12', 'Test 12 Step 1: Decision selects e2eTask');
assert(e2eState1.primaryDecision.actionLabel === 'ابدأ جلسة تركيز', 'Test 12 Step 1: Action label is "ابدأ جلسة تركيز"');

// Step 2: User clicks action -> hayyizLaunchPomodoro generates URL with &taskId=t_e2e_12
hayyizLaunchPomodoro(e2eTask, 0);

// Simulate Pomodoro page receiving URL parameter ?taskId=t_e2e_12
const urlTaskId = 't_e2e_12';
const foundInPomodoro = hayyizGetTaskById(urlTaskId);
assert(foundInPomodoro && foundInPomodoro.text === 'مذاكرة الفلسفة الأخيرة', 'Test 12 Step 2: Pomodoro resolves exact task via URL taskId');

// Step 3: Session completes -> hayyizApplyFocusResult applies focus session
hayyizApplyFocusResult({ workMin: 25, taskId: foundInPomodoro.id, taskText: foundInPomodoro.text });

// Step 4: Re-evaluate Student Decision State upon return to Dashboard
const e2eState2 = hayyizComputeStudentDecisionState();
assert(e2eState2.primaryDecision.task.id === 't_e2e_12', 'Test 12 Step 4: e2eTask remains primary decision as it is in-progress');
assert(e2eState2.primaryDecision.actionLabel === 'استكمال التركيز', 'Test 12 Step 4: Action label updated to "استكمال التركيز"');
assert(e2eState2.primaryDecision.taskProgress.progressText === 'أُنجز 25 من 50 دقيقة (50%)', 'Test 12 Step 4: Dashboard reflects 50% partial progress');

// Step 5: Complete second session and mark complete
hayyizApplyFocusResult({ workMin: 25, taskId: foundInPomodoro.id, taskText: foundInPomodoro.text });
hayyizCompleteTask(foundInPomodoro.id, foundInPomodoro.text);

// Step 6: Re-evaluate Decision State after task completion
const e2eState3 = hayyizComputeStudentDecisionState();
assert(e2eState3.primaryDecision === null || (e2eState3.primaryDecision.task && e2eState3.primaryDecision.task.id !== 't_e2e_12'), 'Test 12 Step 6: Completed task strictly removed from Next Action decision');

console.log(`\n===================================`);
console.log(`EXECUTION CYCLE SUITE SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log(`===================================\n`);

if (failed > 0) process.exit(1);
