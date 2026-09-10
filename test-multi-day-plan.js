const fs = require('fs');

// Load common.js and dependencies in simulated Node environment
const commonJs = fs.readFileSync('./common.js', 'utf8');

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

console.log('=== RIGOROUS MULTI-DAY STUDY PLAN REFINEMENT TEST SUITE ===\n');

const getOffsetDateStr = (offsetDays) => {
    const base = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
    const parts = base.split('-').map(Number);
    const dt = new Date(parts[0], parts[1] - 1, parts[2] + offsetDays);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

// Scenario A: 180 min task / 120 min daily capacity across multiple days (Work Splitting)
{
    localStorage.clear();
    const targetDate = getOffsetDateStr(3); // Days 0, 1, 2, 3 (Day 2 is Buffer D-1, Day 3 is Exam D)
    const examId = 'ex_scen_a';

    const longTask = { id: 't_long_180', text: 'اختبار الشامل: 180 دقيقة', minutes: 180, priority: 'high', eventId: examId, completed: false };
    hayyizSaveTodos([longTask]);

    const plan = hayyizComputeMultiDayPlan({
        targetId: examId,
        targetName: 'اختبار الشامل',
        targetDate: targetDate,
        dailyCapacityMinutes: 120
    });

    assert(plan !== null, 'Scenario A: Multi-day plan generated for 180 min task');
    assert(plan.dailyCapacityMinutes === 120, 'Scenario A: Configured daily capacity is 120 mins');

    const day0 = plan.schedule[0];
    const day1 = plan.schedule[1];

    assert(day0.plannedMinutes === 120, 'Scenario A: Day 0 allocated exactly 120 minutes (does not exceed 120 mins)');
    assert(day1.plannedMinutes === 60, 'Scenario A: Day 1 allocated remaining 60 minutes');

    let totalAllocated = 0;
    plan.schedule.forEach(s => totalAllocated += s.plannedMinutes);
    assert(totalAllocated === 180, 'Scenario A: Total allocated minutes equals required 180 minutes');

    const scheduledTaskPieces = [];
    plan.schedule.forEach(s => s.tasks.forEach(t => {
        if (t.taskId === 't_long_180') scheduledTaskPieces.push(t);
    }));
    assert(scheduledTaskPieces.length === 2, 'Scenario A: Task work split into 2 daily portions without task cloning in LocalStorage');

    const todosInStorage = hayyizGetTodos();
    assert(todosInStorage.length === 1 && todosInStorage[0].id === 't_long_180', 'Scenario A: LocalStorage contains exactly 1 task (taskId preserved)');
}

// Scenario B: Two tasks of same subject, but one is linked to a DIFFERENT exam
{
    localStorage.clear();
    const targetDate = getOffsetDateStr(4);
    const examAId = 'ex_chem_a';
    const examBId = 'ex_chem_b';
    const subChem = hayyizAddSubject('كيمياء');

    const tasks = [
        { id: 't_chem_for_a', text: 'مراجعة كيمياء لاختبار أ', subjectId: subChem.id, eventId: examAId, minutes: 45, completed: false },
        { id: 't_chem_for_b', text: 'مراجعة كيمياء لاختبار ب الآخر', subjectId: subChem.id, eventId: examBId, minutes: 45, completed: false }
    ];
    hayyizSaveTodos(tasks);

    const planA = hayyizComputeMultiDayPlan({
        targetId: examAId,
        targetName: 'اختبار الكيمياء أ',
        targetDate: targetDate,
        subjectId: subChem.id
    });

    assert(planA.openTasksCount === 1, 'Scenario B: Only 1 task linked to Exam A is included');
    assert(planA.schedule.some(s => s.tasks.some(t => t.taskId === 't_chem_for_a')), 'Scenario B: Task for Exam A is present in plan');
    assert(!planA.schedule.some(s => s.tasks.some(t => t.taskId === 't_chem_for_b')), 'Scenario B: Task for Exam B is strictly EXCLUDED despite matching subjectId');
}

// Scenario C: Goal/Exam in 5 days (Buffer Day on D-1, Target Date D is NOT Buffer Day)
{
    localStorage.clear();
    const targetDate = getOffsetDateStr(5); // Days 0, 1, 2, 3, 4, 5
    const examId = 'ex_5days';

    const task = { id: 't_5days', text: 'مراجعة عامة', minutes: 60, eventId: examId, completed: false };
    hayyizSaveTodos([task]);

    const plan = hayyizComputeMultiDayPlan({
        targetId: examId,
        targetName: 'اختبار بعد 5 أيام',
        targetDate: targetDate
    });

    const dayD = plan.schedule[5]; // Day 5 (targetDate)
    const dayDMinus1 = plan.schedule[4]; // Day 4 (D-1)

    assert(dayD.isTargetDay === true && dayD.isBufferDay === false, 'Scenario C: Day D (targetDate) is Target Day and NOT Buffer Day');
    assert(dayDMinus1.isBufferDay === true, 'Scenario C: Day D-1 is Buffer/Review Day');
    assert(dayD.plannedMinutes === 0, 'Scenario C: Day D (Exam day) has 0 regular study tasks scheduled');
}

// Scenario D: Goal/Exam Tomorrow (1 day remaining: Day 0 is today, Day 1 is Exam Day D)
{
    localStorage.clear();
    const targetDate = getOffsetDateStr(1);
    const examId = 'ex_tomorrow';

    const task = { id: 't_tomorrow', text: 'استعداد لاختبار غداً', minutes: 40, eventId: examId, completed: false };
    hayyizSaveTodos([task]);

    const plan = hayyizComputeMultiDayPlan({
        targetId: examId,
        targetName: 'اختبار غداً',
        targetDate: targetDate
    });

    assert(plan.daysRemaining === 1, 'Scenario D: 1 day remaining until target');
    assert(plan.hasBufferDay === false, 'Scenario D: No fake buffer day generated for 1-day remaining target');
    assert(plan.schedule[0].isToday === true && plan.schedule[0].plannedMinutes === 40, 'Scenario D: Work scheduled for today (Day 0)');
    assert(plan.schedule[1].isTargetDay === true && plan.schedule[1].isBufferDay === false, 'Scenario D: Tomorrow (Day 1) is Exam Day D');
}

// Scenario E: Goal/Exam Today (0 days remaining)
{
    localStorage.clear();
    const targetDate = getOffsetDateStr(0);
    const examId = 'ex_today';

    const task = { id: 't_today', text: 'مراجعة دقيقة اليوم', minutes: 30, eventId: examId, completed: false };
    hayyizSaveTodos([task]);

    const plan = hayyizComputeMultiDayPlan({
        targetId: examId,
        targetName: 'اختبار اليوم',
        targetDate: targetDate
    });

    assert(plan.daysRemaining === 0, 'Scenario E: 0 days remaining (Target is today)');
    assert(plan.schedule.length === 1, 'Scenario E: Schedule contains exactly 1 day (today)');
    assert(plan.schedule[0].plannedMinutes === 30, 'Scenario E: Work scheduled for today');
}

// Scenario F: Re-planning after Task Completion
{
    localStorage.clear();
    const targetDate = getOffsetDateStr(3);
    const examId = 'ex_replan_comp';

    const tasks = [
        { id: 't_rc_1', text: 'مهمة 1 للاستكمال', minutes: 50, priority: 'high', eventId: examId, completed: false },
        { id: 't_rc_2', text: 'مهمة 2 للاستكمال', minutes: 50, priority: 'medium', eventId: examId, completed: false }
    ];
    hayyizSaveTodos(tasks);

    hayyizComputeMultiDayPlan({
        targetId: examId,
        targetName: 'اختبار إعادة التخطيط',
        targetDate: targetDate
    });

    // Complete task 1
    hayyizCompleteTask('t_rc_1', 'مهمة 1 للاستكمال');
    const freshPlan = hayyizReevaluateMultiDayPlan(examId);

    assert(freshPlan.openTasksCount === 1, 'Scenario F: Open tasks count updated to 1');
    assert(freshPlan.completedTasksCount === 1, 'Scenario F: Completed tasks count updated to 1');
    assert(!freshPlan.schedule.some(s => s.tasks.some(t => t.taskId === 't_rc_1')), 'Scenario F: Completed task does not return to schedule');
}

// Scenario G: Re-planning after Task Addition
{
    localStorage.clear();
    const targetDate = getOffsetDateStr(4);
    const examId = 'ex_replan_add';

    const initialTasks = [
        { id: 't_ra_1', text: 'مهمة أصلية 1', minutes: 40, priority: 'high', eventId: examId, completed: false }
    ];
    hayyizSaveTodos(initialTasks);

    hayyizComputeMultiDayPlan({
        targetId: examId,
        targetName: 'اختبار إضافة مهمة',
        targetDate: targetDate
    });

    // Add new task
    const currentTodos = hayyizGetTodos();
    currentTodos.push({ id: 't_ra_2', text: 'مهمة جديدة مضافة', minutes: 50, priority: 'medium', eventId: examId, completed: false });
    hayyizSaveTodos(currentTodos);

    const updatedPlan = hayyizReevaluateMultiDayPlan(examId);

    assert(updatedPlan.openTasksCount === 2, 'Scenario G: New task included in re-planned schedule');
    assert(hayyizGetTodos().length === 2, 'Scenario G: Existing tasks are not cloned');
}

// Scenario H: Preservation of taskId
{
    localStorage.clear();
    const targetDate = getOffsetDateStr(3);
    const examId = 'ex_task_id_preservation';

    const task = { id: 't_unique_id_99', text: 'مهمة المعرف الفريد', minutes: 60, eventId: examId, completed: false };
    hayyizSaveTodos([task]);

    const plan = hayyizComputeMultiDayPlan({
        targetId: examId,
        targetName: 'اختبار المعرف الفريد',
        targetDate: targetDate
    });

    const scheduled = plan.schedule[0].tasks.find(t => t.taskId === 't_unique_id_99');
    assert(scheduled !== undefined && scheduled.taskId === 't_unique_id_99', 'Scenario H: taskId (t_unique_id_99) strictly preserved');
}

// Scenario I: Total Allocated Minutes = Actual Remaining Required Minutes
{
    localStorage.clear();
    const targetDate = getOffsetDateStr(3);
    const examId = 'ex_exact_sum';

    const tasks = [
        { id: 't_sum_1', text: 'مهمة 1', minutes: 45, focusDone: 15, eventId: examId, completed: false }, // 30 remaining
        { id: 't_sum_2', text: 'مهمة 2', minutes: 60, focusDone: 0, eventId: examId, completed: false }   // 60 remaining
    ];
    hayyizSaveTodos(tasks);

    const plan = hayyizComputeMultiDayPlan({
        targetId: examId,
        targetName: 'اختبار المجموع',
        targetDate: targetDate
    });

    let totalAllocatedMinutes = 0;
    plan.schedule.forEach(s => totalAllocatedMinutes += s.plannedMinutes);

    assert(plan.totalRequiredMinutes === 90, 'Scenario I: Total required remaining minutes calculated as 90 (30 + 60)');
    assert(totalAllocatedMinutes === 90, 'Scenario I: Total allocated minutes strictly equals required remaining minutes (90)');
}

// Scenario J: Integration with hayyizBuildDailyPlan
{
    localStorage.clear();
    const targetDate = getOffsetDateStr(2);
    const examId = 'ex_daily_integration';

    const task = { id: 't_daily_integ', text: 'مهمة التكامل اليومي', minutes: 30, priority: 'high', eventId: examId, completed: false };
    hayyizSaveTodos([task]);

    hayyizComputeMultiDayPlan({
        targetId: examId,
        targetName: 'اختبار اليومي',
        targetDate: targetDate
    });

    const dailyPlan = hayyizGenerateDailyPlan();
    assert(Array.isArray(dailyPlan) && dailyPlan.length > 0, 'Scenario J: Daily Plan generated successfully');
    assert(dailyPlan.some(p => p.task && p.task.id === 't_daily_integ'), 'Scenario J: Daily Plan contains the active multi-day task');
}

// Scenario K: Integration with Pomodoro
{
    localStorage.clear();
    const realDateNow = Date.now;
    let mockTime = 2500000000000;
    Date.now = () => mockTime;

    const targetDate = getOffsetDateStr(2);
    const examId = 'ex_pomo_integ';

    const task = { id: 't_pomo_integ', text: 'مهمة بومودورو الجارية', minutes: 50, focusDone: 0, priority: 'high', eventId: examId, completed: false };
    hayyizSaveTodos([task]);

    hayyizComputeMultiDayPlan({
        targetId: examId,
        targetName: 'اختبار البومودورو',
        targetDate: targetDate
    });

    // Apply focus result
    hayyizApplyFocusResult({ workMin: 25, taskId: 't_pomo_integ', taskText: 'مهمة بومودورو الجارية' });

    const updatedTask = hayyizGetTaskById('t_pomo_integ');
    assert(updatedTask.focusDone === 25, 'Scenario K: Pomodoro focus logged cleanly (25 mins)');

    const reevaluated = hayyizReevaluateMultiDayPlan(examId);
    assert(reevaluated.completedMinutes === 25, 'Scenario K: Multi-day plan re-evaluated with updated focus done');

    Date.now = realDateNow;
}

// Scenario L: Multiple Plans in LocalStorage + Contextual Linking
{
    localStorage.clear();

    const plan1 = hayyizComputeMultiDayPlan({
        targetId: 'ex_plan_1',
        targetName: 'الخطة الأولى كيمياء',
        targetDate: getOffsetDateStr(3)
    });

    const plan2 = hayyizComputeMultiDayPlan({
        targetId: 'ex_plan_2',
        targetName: 'الخطة الثانية فيزياء',
        targetDate: getOffsetDateStr(5)
    });

    const allPlans = hayyizGetMultiDayPlans();
    assert(Object.keys(allPlans).length === 2, 'Scenario L: LocalStorage holds 2 distinct multi-day plans');
    assert(allPlans['ex_plan_1'].targetName === 'الخطة الأولى كيمياء', 'Scenario L: Plan 1 retrieved accurately by targetId');
    assert(allPlans['ex_plan_2'].targetName === 'الخطة الثانية فيزياء', 'Scenario L: Plan 2 retrieved accurately by targetId');
}

// Scenario M: Point 1 - Strict Data Linking (Excluding Fuzzy/Text Matching)
{
    localStorage.clear();
    const examA = 'ex_A';
    const examB = 'ex_B';

    const tasks = [
        { id: 't_link_1', text: 'دراسة كيمياء لاختبار A', eventId: examA, minutes: 30, completed: false },
        { id: 't_link_2', text: 'دراسة فيزياء لاختبار B', eventId: examB, minutes: 40, completed: false },
        { id: 't_link_3', text: 'ملاحظات حول اختبار A العامة', minutes: 50, completed: false } // Mentioning 'اختبار A' in text but NO eventId
    ];
    hayyizSaveTodos(tasks);

    const planA = hayyizComputeMultiDayPlan({
        targetId: examA,
        targetName: 'اختبار A',
        targetDate: getOffsetDateStr(3)
    });

    assert(planA.totalTasksCount === 1, 'Point 1: Strict Linking includes only 1 task explicitly linked via eventId');
    assert(planA.schedule.some(s => s.tasks.some(t => t.taskId === 't_link_1')), 'Point 1: Task linked to eventId ex_A is included');
    assert(!planA.schedule.some(s => s.tasks.some(t => t.taskId === 't_link_2')), 'Point 1: Task linked to eventId ex_B is excluded');
    assert(!planA.schedule.some(s => s.tasks.some(t => t.taskId === 't_link_3')), 'Point 1: Task mentioning targetName in text without explicit eventId/goalId is strictly EXCLUDED');
}

// Scenario N: Point 2 - Replanning Boundaries Preserve Past Schedule History
{
    localStorage.clear();
    const targetId = 'ex_past_preserve';
    const todayStr = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
    const pastDate = getOffsetDateStr(-2); // 2 days in the past
    const targetDate = getOffsetDateStr(3);

    // Save initial plan with an item in the past
    const initialPlan = {
        targetId,
        targetName: 'اختبار الحفظ التاريخي',
        targetDate,
        dailyCapacityMinutes: 120,
        status: 'active',
        daysRemaining: 3,
        totalTasksCount: 2,
        openTasksCount: 1,
        completedTasksCount: 1,
        totalRequiredMinutes: 60,
        completedMinutes: 60,
        schedule: [
            {
                date: pastDate,
                isToday: false,
                isTargetDay: false,
                isBufferDay: false,
                plannedMinutes: 60,
                capacityMinutes: 120,
                tasksCount: 1,
                tasks: [{ taskId: 't_past_done', text: 'مهمة منجزة في الماضي', remainingMinutes: 60, completed: true }],
                dayStatus: 'balanced',
                dayStatusLabel: 'متوازن'
            }
        ]
    };
    const plansObj = {};
    plansObj[targetId] = initialPlan;
    hayyizSaveMultiDayPlans(plansObj);

    // Add a new open task for the future
    const futureTask = { id: 't_future_open', text: 'مهمة مستقبلية جديدة', eventId: targetId, minutes: 90, completed: false };
    hayyizSaveTodos([futureTask]);

    // Reevaluate multi-day plan
    const replanned = hayyizReevaluateMultiDayPlan(targetId);

    const pastItemInReplanned = replanned.schedule.find(s => s.date === pastDate);
    assert(pastItemInReplanned !== undefined, 'Point 2: Past schedule date (-2 days) exists in re-planned schedule');
    assert(pastItemInReplanned.plannedMinutes === 60, 'Point 2: Past schedule planned minutes remain exactly 60');
    assert(pastItemInReplanned.tasks[0].taskId === 't_past_done', 'Point 2: Past scheduled task identity is preserved');

    const todayOrFutureItem = replanned.schedule.find(s => s.date >= todayStr && s.tasks.some(t => t.taskId === 't_future_open'));
    assert(todayOrFutureItem !== undefined, 'Point 2: Future task scheduled strictly in today or future days');
}

// Scenario O: Point 3 - Capacity Single Source of Truth & Re-Opening
{
    localStorage.clear();
    const targetId = 'ex_capacity_ssot';
    const targetDate = getOffsetDateStr(4);
    const task = { id: 't_cap_180', text: 'مهمة 180 دقيقة سعة', eventId: targetId, minutes: 180, completed: false };
    hayyizSaveTodos([task]);

    // 1. Create plan with 120 mins capacity
    const plan120 = hayyizComputeMultiDayPlan({
        targetId,
        targetName: 'اختبار السعة الموحدة',
        targetDate,
        dailyCapacityMinutes: 120
    });
    assert(plan120.dailyCapacityMinutes === 120, 'Point 3: Initial plan has dailyCapacityMinutes === 120');
    assert(plan120.schedule[0].plannedMinutes === 120, 'Point 3: Day 0 allocated 120 mins under 120 capacity');

    // 2. Change capacity to 180 mins
    const plan180 = hayyizComputeMultiDayPlan({
        targetId,
        targetName: 'اختبار السعة الموحدة',
        targetDate,
        dailyCapacityMinutes: 180
    });
    assert(plan180.dailyCapacityMinutes === 180, 'Point 3: Updated plan has dailyCapacityMinutes === 180');
    assert(plan180.schedule[0].plannedMinutes === 180, 'Point 3: Day 0 allocated full 180 mins under 180 capacity');

    // 3. Re-open plan without passing config capacity and ensure it preserves 180
    const reopened = hayyizGetMultiDayPlan(targetId);
    assert(reopened.dailyCapacityMinutes === 180, 'Point 3: Re-opened plan maintains 180 capacity as Single Source of Truth');
}

// Test A: 120 min/day + 180 min work + 2 allocatable days
{
    localStorage.clear();
    const targetId = 'ex_test_a';
    const targetDate = getOffsetDateStr(3); // Days 0, 1 allocatable, Day 2 Buffer, Day 3 Target
    const task = { id: 't_a_180', text: 'عمل 180 دقيقة', eventId: targetId, minutes: 180, completed: false };
    hayyizSaveTodos([task]);

    const plan = hayyizComputeMultiDayPlan({
        targetId,
        targetName: 'Test A',
        targetDate,
        dailyCapacityMinutes: 120
    });

    assert(plan.schedule.every(s => s.plannedMinutes <= 120), 'Test A: No day plannedMinutes exceeds 120');
    assert(plan.totalPlannedMinutes === 180, 'Test A: totalPlannedMinutes === 180');
    assert(plan.totalUnallocatedMinutes === 0, 'Test A: totalUnallocatedMinutes === 0');
}

// Test B: 120 min/day + 300 min work + 2 allocatable days
{
    localStorage.clear();
    const targetId = 'ex_test_b';
    const targetDate = getOffsetDateStr(3); // Days 0, 1 allocatable (240 total capacity)
    const task = { id: 't_b_300', text: 'عمل 300 دقيقة', eventId: targetId, minutes: 300, completed: false };
    hayyizSaveTodos([task]);

    const plan = hayyizComputeMultiDayPlan({
        targetId,
        targetName: 'Test B',
        targetDate,
        dailyCapacityMinutes: 120
    });

    assert(plan.schedule.every(s => s.plannedMinutes <= 120), 'Test B: No day plannedMinutes exceeds 120');
    assert(plan.totalPlannedMinutes === 240, 'Test B: totalPlannedMinutes === 240');
    assert(plan.totalUnallocatedMinutes === 60, 'Test B: totalUnallocatedMinutes === 60');
}

// Test C: 120 min/day + 360 min work + 2 allocatable days
{
    localStorage.clear();
    const targetId = 'ex_test_c';
    const targetDate = getOffsetDateStr(3); // Days 0, 1 allocatable (240 total capacity)
    const task = { id: 't_c_360', text: 'عمل 360 دقيقة', eventId: targetId, minutes: 360, completed: false };
    hayyizSaveTodos([task]);

    const plan = hayyizComputeMultiDayPlan({
        targetId,
        targetName: 'Test C',
        targetDate,
        dailyCapacityMinutes: 120
    });

    assert(plan.schedule.every(s => s.plannedMinutes <= 120), 'Test C: No day plannedMinutes exceeds 120');
    assert(plan.totalPlannedMinutes === 240, 'Test C: totalPlannedMinutes === 240');
    assert(plan.totalUnallocatedMinutes === 120, 'Test C: totalUnallocatedMinutes === 120');
}

// Test D: Task splitting preserving single task entity and taskId
{
    localStorage.clear();
    const targetId = 'ex_test_d';
    const targetDate = getOffsetDateStr(3);
    const task = { id: 't_d_split', text: 'مهمة واحدة تنقسم', eventId: targetId, minutes: 180, completed: false };
    hayyizSaveTodos([task]);

    hayyizComputeMultiDayPlan({
        targetId,
        targetName: 'Test D',
        targetDate,
        dailyCapacityMinutes: 120
    });

    const todos = hayyizGetTodos();
    assert(todos.length === 1 && todos[0].id === 't_d_split', 'Test D: Single task entity preserved in LocalStorage without cloning');
}

// Test E: Mathematical Identity: totalRequiredMinutes === totalPlannedMinutes + totalUnallocatedMinutes
{
    localStorage.clear();
    const targetId = 'ex_test_e';
    const targetDate = getOffsetDateStr(3);
    const tasks = [
        { id: 't_e_1', text: 'مهمة 100د', eventId: targetId, minutes: 100, completed: false },
        { id: 't_e_2', text: 'مهمة 250د', eventId: targetId, minutes: 250, completed: false }
    ];
    hayyizSaveTodos(tasks);

    const plan = hayyizComputeMultiDayPlan({
        targetId,
        targetName: 'Test E',
        targetDate,
        dailyCapacityMinutes: 120
    });

    assert(plan.totalRequiredMinutes === plan.totalPlannedMinutes + plan.totalUnallocatedMinutes, 'Test E: totalRequiredMinutes === totalPlannedMinutes + totalUnallocatedMinutes strictly holds');
}

// Test F: Overloaded status corresponds to totalUnallocatedMinutes > 0
{
    localStorage.clear();
    const targetId = 'ex_test_f';
    const targetDate = getOffsetDateStr(3);
    const task = { id: 't_f_overload', text: 'عمل 400 دقيقة', eventId: targetId, minutes: 400, completed: false };
    hayyizSaveTodos([task]);

    const plan = hayyizComputeMultiDayPlan({
        targetId,
        targetName: 'Test F',
        targetDate,
        dailyCapacityMinutes: 120
    });

    assert(plan.status === 'overloaded', 'Test F: Plan status is overloaded');
    assert(plan.isCapacityExceeded === true, 'Test F: isCapacityExceeded is true');
    assert(plan.totalUnallocatedMinutes > 0, 'Test F: totalUnallocatedMinutes is greater than 0');
}

console.log(`\n===================================`);
console.log(`RIGOROUS MULTI-DAY PLAN TEST SUITE SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log(`===================================\n`);

if (failed > 0) process.exit(1);
