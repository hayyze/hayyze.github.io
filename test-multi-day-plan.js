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

console.log('=== MULTI-DAY STUDY PLAN ENGINE TEST SUITE ===\n');

const getOffsetDateStr = (offsetDays) => {
    const base = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
    const parts = base.split('-').map(Number);
    const dt = new Date(parts[0], parts[1] - 1, parts[2] + offsetDays);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

// 1. Far exam with tasks distributed across multiple days
{
    localStorage.clear();
    const targetDate = getOffsetDateStr(5); // 5 days remaining (6 total days in schedule: Day 0 to 5)
    const examId = 'ex_far_1';
    const examObj = { id: examId, name: 'اختبار الكيمياء النهائي', date: targetDate, type: 'exam' };
    localStorage.setItem('hayyiz-student-exams', JSON.stringify([examObj]));

    const tasks = [
        { id: 't_m1', text: 'اختبار الكيمياء النهائي: فصل 1', minutes: 60, priority: 'high', eventId: examId, completed: false },
        { id: 't_m2', text: 'اختبار الكيمياء النهائي: فصل 2', minutes: 60, priority: 'high', eventId: examId, completed: false },
        { id: 't_m3', text: 'اختبار الكيمياء النهائي: فصل 3', minutes: 60, priority: 'medium', eventId: examId, completed: false },
        { id: 't_m4', text: 'اختبار الكيمياء النهائي: تمارين', minutes: 60, priority: 'medium', eventId: examId, completed: false }
    ];
    hayyizSaveTodos(tasks);

    const plan = hayyizComputeMultiDayPlan({
        targetId: examId,
        targetName: 'اختبار الكيمياء النهائي',
        targetDate: targetDate
    });

    assert(plan !== null && plan.daysRemaining === 5, 'Test 1: Plan created for far exam (5 days remaining)');
    assert(plan.schedule.length === 6, 'Test 1: Schedule contains 6 days (0 to 5)');
    assert(plan.schedule[5].isBufferDay === true, 'Test 1: Final day before exam is designated as review buffer day');
    assert(plan.openTasksCount === 4, 'Test 1: Identifies 4 open tasks linked to exam');

    // Total planned minutes across allocatable days should equal total required minutes (240)
    let totalScheduledMinutes = 0;
    plan.schedule.forEach(s => totalScheduledMinutes += s.plannedMinutes);
    assert(totalScheduledMinutes === 240, 'Test 1: All 240 minutes of work distributed across available days');
    assert(plan.schedule[0].plannedMinutes < 240, 'Test 1: Workload is distributed across days and not dumped on a single day');
}

// 2. Near exam with heavy load
{
    localStorage.clear();
    const targetDate = getOffsetDateStr(1); // Exam tomorrow (2 total days: Day 0 and Day 1)
    const examId = 'ex_near_2';

    const heavyTasks = [
        { id: 't_h1', text: 'اختبار قريب مكثف: باب 1', minutes: 120, priority: 'high', eventId: examId, completed: false },
        { id: 't_h2', text: 'اختبار قريب مكثف: باب 2', minutes: 120, priority: 'high', eventId: examId, completed: false },
        { id: 't_h3', text: 'اختبار قريب مكثف: باب 3', minutes: 120, priority: 'high', eventId: examId, completed: false }
    ];
    hayyizSaveTodos(heavyTasks);

    const plan = hayyizComputeMultiDayPlan({
        targetId: examId,
        targetName: 'اختبار قريب مكثف',
        targetDate: targetDate,
        dailyCapacityMinutes: 120 // 120 mins capacity
    });

    assert(plan !== null && plan.daysRemaining === 1, 'Test 2: Plan created for near exam (1 day remaining)');
    assert(plan.totalRequiredMinutes === 360, 'Test 2: Total required minutes calculated as 360');
    assert(plan.status === 'overloaded' || plan.status === 'active', 'Test 2: Correctly flags overload or active heavy load');
    assert(plan.schedule[0].plannedMinutes > 0, 'Test 2: Day 0 receives heavy load distribution');
}

// 3. Target with no open tasks
{
    localStorage.clear();
    const targetDate = getOffsetDateStr(3);
    const examId = 'ex_empty_3';

    const plan = hayyizComputeMultiDayPlan({
        targetId: examId,
        targetName: 'اختبار فارغ بدون مهام',
        targetDate: targetDate
    });

    assert(plan !== null && plan.openTasksCount === 0, 'Test 3: Handles target with no open tasks');
    assert(plan.status === 'no_tasks', 'Test 3: Plan status is "no_tasks"');
    assert(plan.schedule.every(s => s.plannedMinutes === 0), 'Test 3: All days have 0 planned minutes');
}

// 4. Completed tasks excluded from redistribution
{
    localStorage.clear();
    const targetDate = getOffsetDateStr(4);
    const examId = 'ex_comp_4';

    const tasks = [
        { id: 't_c4_1', text: 'اختبار 4: مهمة مفتوحة', minutes: 60, priority: 'high', eventId: examId, completed: false },
        { id: 't_c4_2', text: 'اختبار 4: مهمة مكتملة', minutes: 60, priority: 'medium', eventId: examId, completed: true }
    ];
    hayyizSaveTodos(tasks);

    const plan = hayyizComputeMultiDayPlan({
        targetId: examId,
        targetName: 'اختبار 4',
        targetDate: targetDate
    });

    assert(plan.openTasksCount === 1, 'Test 4: Open tasks count is 1');
    assert(plan.completedTasksCount === 1, 'Test 4: Completed tasks count is 1');
    assert(plan.totalRequiredMinutes === 60, 'Test 4: Completed task (60m) excluded from required minutes to schedule');
}

// 5. Overdue task handling in multi-day plan
{
    localStorage.clear();
    const targetDate = getOffsetDateStr(3);
    const examId = 'ex_overdue_5';

    const tasks = [
        { id: 't_od_5', text: 'مهمة متأخرة مرتبطة بالاختبار', date: getOffsetDateStr(-2), minutes: 45, priority: 'high', eventId: examId, completed: false }
    ];
    hayyizSaveTodos(tasks);

    const plan = hayyizComputeMultiDayPlan({
        targetId: examId,
        targetName: 'اختبار 5',
        targetDate: targetDate
    });

    assert(plan.openTasksCount === 1, 'Test 5: Identifies overdue task');
    assert(plan.schedule[0].tasks.some(t => t.taskId === 't_od_5'), 'Test 5: Overdue high-priority task scheduled starting from today');
}

// 6. Adding a new task after plan creation and triggering re-plan
{
    localStorage.clear();
    const targetDate = getOffsetDateStr(4);
    const examId = 'ex_add_6';

    const initialTasks = [
        { id: 't_add_1', text: 'اختبار 6: مهمة أولى', minutes: 60, priority: 'high', eventId: examId, completed: false }
    ];
    hayyizSaveTodos(initialTasks);

    const plan1 = hayyizComputeMultiDayPlan({
        targetId: examId,
        targetName: 'اختبار 6',
        targetDate: targetDate
    });

    assert(plan1.totalRequiredMinutes === 60, 'Test 6: Initial plan has 60 required minutes');

    // Add new task
    const currentTodos = hayyizGetTodos();
    currentTodos.push({ id: 't_add_2', text: 'اختبار 6: مهمة مضافة لاحقاً', minutes: 45, priority: 'medium', eventId: examId, completed: false });
    hayyizSaveTodos(currentTodos);

    const plan2 = hayyizReevaluateMultiDayPlan(examId);

    assert(plan2.openTasksCount === 2, 'Test 6: Re-evaluated plan contains 2 open tasks');
    assert(plan2.totalRequiredMinutes === 105, 'Test 6: Total required minutes updated to 105 (60 + 45)');
}

// 7. Completing a task from the plan and adaptive re-distribution
{
    localStorage.clear();
    const targetDate = getOffsetDateStr(3);
    const examId = 'ex_comp_7';

    const tasks = [
        { id: 't_comp_7_1', text: 'اختبار 7: مهمة 1', minutes: 60, priority: 'high', eventId: examId, completed: false },
        { id: 't_comp_7_2', text: 'اختبار 7: مهمة 2', minutes: 60, priority: 'medium', eventId: examId, completed: false }
    ];
    hayyizSaveTodos(tasks);

    hayyizComputeMultiDayPlan({
        targetId: examId,
        targetName: 'اختبار 7',
        targetDate: targetDate
    });

    // Complete task 1
    hayyizCompleteTask('t_comp_7_1', 'اختبار 7: مهمة 1');
    const planAfterComp = hayyizReevaluateMultiDayPlan(examId);

    assert(planAfterComp.completedTasksCount === 1, 'Test 7: Completed tasks count updated to 1');
    assert(planAfterComp.openTasksCount === 1, 'Test 7: Open tasks count updated to 1');
    assert(planAfterComp.totalRequiredMinutes === 60, 'Test 7: Total required minutes updated to 60');
}

// 8. Re-planning without altering past days or completed tasks
{
    localStorage.clear();
    const targetDate = getOffsetDateStr(4);
    const examId = 'ex_no_past_8';

    const tasks = [
        { id: 't_np_8_1', text: 'مهمة مكتملة بالأمس', minutes: 50, priority: 'high', eventId: examId, completed: true, completedAt: getOffsetDateStr(-1) },
        { id: 't_np_8_2', text: 'مهمة مفتوحة حالية', minutes: 50, priority: 'medium', eventId: examId, completed: false }
    ];
    hayyizSaveTodos(tasks);

    const plan = hayyizComputeMultiDayPlan({
        targetId: examId,
        targetName: 'اختبار 8',
        targetDate: targetDate
    });

    const completedInTodos = hayyizGetTodoById('t_np_8_1');
    assert(completedInTodos.completed === true, 'Test 8: Completed task remains completed in LocalStorage');
    assert(!plan.schedule.some(s => s.tasks.some(t => t.taskId === 't_np_8_1')), 'Test 8: Completed task is not re-scheduled in future open days');
}

// 9. No duplicate tasks or task cloning
{
    localStorage.clear();
    const targetDate = getOffsetDateStr(3);
    const examId = 'ex_nodup_9';

    const tasks = [
        { id: 't_uniq_9', text: 'مهمة فريدة واحدة فقط', minutes: 30, priority: 'medium', eventId: examId, completed: false }
    ];
    hayyizSaveTodos(tasks);

    const plan = hayyizComputeMultiDayPlan({
        targetId: examId,
        targetName: 'اختبار 9',
        targetDate: targetDate
    });

    let occurrencesInSchedule = 0;
    plan.schedule.forEach(s => {
        s.tasks.forEach(t => {
            if (t.taskId === 't_uniq_9') occurrencesInSchedule++;
        });
    });

    const todosInStorage = hayyizGetTodos();
    assert(todosInStorage.length === 1, 'Test 9: Tasks in LocalStorage remain exactly 1 (no task cloning)');
    assert(occurrencesInSchedule === 1, 'Test 9: Task scheduled exactly once across multi-day schedule');
}

// 10. Preservation of taskId
{
    localStorage.clear();
    const targetDate = getOffsetDateStr(2);
    const examId = 'ex_id_10';

    const taskOriginal = { id: 't_orig_id_10', text: 'مهمة تجربة المعرف', minutes: 40, priority: 'high', eventId: examId, completed: false };
    hayyizSaveTodos([taskOriginal]);

    const plan = hayyizComputeMultiDayPlan({
        targetId: examId,
        targetName: 'اختبار 10',
        targetDate: targetDate
    });

    const scheduledTask = plan.schedule[0].tasks.find(t => t.taskId === 't_orig_id_10');
    assert(scheduledTask !== undefined, 'Test 10: Scheduled task preserves exact original taskId (t_orig_id_10)');
}

// 11. Zero negative impact on current daily plan (hayyizBuildDailyPlan)
{
    localStorage.clear();
    const targetDate = getOffsetDateStr(3);
    const examId = 'ex_daily_11';

    const tasks = [
        { id: 't_daily_11', text: 'مهمة واضحة للخطة اليومية', minutes: 30, priority: 'high', eventId: examId, completed: false }
    ];
    hayyizSaveTodos(tasks);

    hayyizComputeMultiDayPlan({
        targetId: examId,
        targetName: 'اختبار 11',
        targetDate: targetDate
    });

    const dailyPlan = hayyizGenerateDailyPlan();
    assert(Array.isArray(dailyPlan) && dailyPlan.length > 0, 'Test 11: hayyizBuildDailyPlan executes cleanly alongside multi-day plans');
    assert(dailyPlan.some(p => p.task && p.task.id === 't_daily_11'), 'Test 11: Daily plan contains the active task');
}

// 12. Zero negative impact on Pomodoro integration
{
    localStorage.clear();
    const realDateNow = Date.now;
    let mockTime = 2000000000000;
    Date.now = () => mockTime;

    const targetDate = getOffsetDateStr(2);
    const examId = 'ex_pomo_12';

    const taskPomo = { id: 't_pomo_12', text: 'مهمة مؤقت البومودورو', minutes: 50, focusDone: 0, priority: 'high', eventId: examId, completed: false };
    hayyizSaveTodos([taskPomo]);

    hayyizComputeMultiDayPlan({
        targetId: examId,
        targetName: 'اختبار 12',
        targetDate: targetDate
    });

    // Simulate Pomodoro focus session completion
    hayyizApplyFocusResult({ workMin: 25, taskId: 't_pomo_12', taskText: 'مهمة مؤقت البومودورو' });

    const updatedTaskPomo = hayyizGetTaskById('t_pomo_12');
    assert(updatedTaskPomo.focusDone === 25, 'Test 12: Focus result correctly applied to task (25 mins logged)');

    const planAfterPomo = hayyizReevaluateMultiDayPlan(examId);
    assert(planAfterPomo.completedMinutes === 25, 'Test 12: Multi-day plan reflects focus completion without breaking state');

    Date.now = realDateNow;
}

// 13. Resilience to legacy or missing data
{
    localStorage.clear();

    // Legacy plan data with missing fields or corrupt JSON
    localStorage.setItem('hayyiz-multi-day-plans', 'CORRUPT_JSON_{');
    const plansSafe = hayyizGetMultiDayPlans();
    assert(typeof plansSafe === 'object' && !Array.isArray(plansSafe), 'Test 13: Corrupt plans in LocalStorage recover to empty object');

    const planMissingConfig = hayyizComputeMultiDayPlan(null);
    assert(planMissingConfig === null, 'Test 13: Handles null config gracefully');
}

// 14. Graceful handling of impossible plan scenarios (e.g. 0 days remaining / past date)
{
    localStorage.clear();

    // Past date (daysRemaining < 0)
    const planPast = hayyizComputeMultiDayPlan({
        targetId: 'ex_past',
        targetName: 'اختبار قديم منتهي',
        targetDate: getOffsetDateStr(-2)
    });

    assert(planPast !== null && planPast.status === 'impossible', 'Test 14: Past target date produces "impossible" status');

    // 0 days remaining (same day exam)
    const planSameDay = hayyizComputeMultiDayPlan({
        targetId: 'ex_same_day',
        targetName: 'اختبار اليوم',
        targetDate: getOffsetDateStr(0)
    });

    assert(planSameDay !== null && planSameDay.daysRemaining === 0, 'Test 14: Target today handles 0 days remaining correctly');
    assert(planSameDay.schedule.length === 1, 'Test 14: Schedule contains 1 day (today)');
}

console.log(`\n===================================`);
console.log(`MULTI-DAY PLAN TEST SUITE SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log(`===================================\n`);

if (failed > 0) process.exit(1);
