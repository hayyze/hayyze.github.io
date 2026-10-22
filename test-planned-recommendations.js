const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-10-22T12:00:00Z'])); }
    static now() { return new Date('2026-10-22T12:00:00Z').getTime(); }
}
function device(minutes = 10) {
    const c = vm.createContext({ console, Date: FixedDate, setTimeout, clearTimeout, URLSearchParams,
        document: { addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; } },
        navigator: {}, location: { search: '', href: '' },
        localStorage: { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = String(v); }, removeItem(k) { delete this.data[k]; } }
    });
    c.window = c;
    vm.runInContext(fs.readFileSync('common.js', 'utf8'), c);
    c.localStorage.setItem('hayyiz-pref-daily-capacity', String(minutes));
    c.hayyizSaveTodos([
        { id: 'urgent', text: 'واجب اليوم', date: '2026-10-22', minutes: 30, priority: 'medium', completed: false },
        { id: 'later', text: 'مراجعة مؤجلة', date: '2026-10-27', minutes: 120, focusDone: 30, priority: 'high', completed: false }
    ]);
    return c;
}
let failed = 0;
function check(name, run) {
    try { run(); console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.message); }
}
check('Dashboard and compatibility recommendations use the same allocated task and its metadata', () => {
    const c = device(), state = c.hayyizComputeStudentDecisionState(), rec = c.hayyizRecommendNext(1);
    assert.equal(state.nextTask.id, 'urgent');
    assert.equal(rec.next.id, state.nextTask.id);
    assert.equal(state.recommendation.next.id, state.nextTask.id);
    assert.equal(rec.plannedMinutes, 10);
    assert.equal(rec.ranked[0].plannedMinutes, 10);
    assert.equal(state.nextReason, rec.reason);
    assert.equal(state.isInProgress, false);
    assert.equal(rec.isInProgress, false);
    assert(!state.nextReason.includes('أكمل ما بدأت'));
    assert.equal(c.hayyizEvaluateStudentState().task.id, 'urgent');
    assert.equal(c.hayyizGenerateDailyPlan().find(item => item.task).task.id, rec.next.id);
});
check('Zero budget returns no task recommendation without hiding active work', () => {
    const c = device(0), state = c.hayyizComputeStudentDecisionState(), rec = c.hayyizRecommendNext();
    assert.equal(state.nextTask, null);
    assert.equal(state.nextReason, '');
    assert.equal(state.isInProgress, false);
    assert.equal(rec.next, null);
    assert.equal(rec.ranked.length, 0);
    assert.equal(rec.plannedMinutes, 0);
    assert.equal(rec.allActive.length, 2);
    assert.equal(c.hayyizEvaluateStudentState(), null);
});
check('Recommendation limits retain plan order and include only positive allocations', () => {
    const c = device(45), state = c.hayyizComputeStudentDecisionState(), rec = c.hayyizRecommendNext(2);
    const planned = state.dailyPlan.filter(item => item.task);
    assert.deepEqual(Array.from(rec.ranked, row => row.task.id), Array.from(planned, item => item.task.id));
    assert.equal(rec.ranked.reduce((sum, row) => sum + row.plannedMinutes, 0), 45);
    assert.equal(c.hayyizRecommendNext(1).ranked.length, 1);
    assert.equal(c.hayyizRecommendNext(0).next, null);
});
check('Recommended launch rechecks a reduced budget and passes it without changing preferences', () => {
    const c = device(); c.hayyizRecommendNext();
    c.hayyizSetTodayRemainingMinutes(5);
    assert.equal(c.hayyizLaunchPlannedTask('urgent'), true);
    assert.equal(new URLSearchParams(c.location.href.split('?')[1]).get('sessionMinutes'), '5');
    assert.equal(c.localStorage.getItem('hayyiz-pref-work'), null);
    assert.equal(c.localStorage.getItem('hayyiz-current-task-id'), 'urgent');
});
check('Stale recommendations cannot launch after time is exhausted or the task is completed', () => {
    const c = device(); c.hayyizRecommendNext(); c.hayyizSetTodayRemainingMinutes(0);
    assert.equal(c.hayyizLaunchPlannedTask('urgent'), false);
    assert.equal(c.location.href, '');
    assert.equal(c.localStorage.getItem('hayyiz-current-task-id'), null);
    c.hayyizSetTodayRemainingMinutes(10); c.hayyizUpdateTask('urgent', { completed: true });
    assert.equal(c.hayyizLaunchPlannedTask('urgent'), false);
    assert.equal(c.location.href, '');
});
check('Deferred tasks require manual selection and remain available there', () => {
    const c = device();
    assert.equal(c.hayyizLaunchPlannedTask('later'), false);
    assert.equal(c.location.href, '');
    c.hayyizLaunchPomodoro(c.hayyizGetTaskById('later'));
    assert.equal(new URLSearchParams(c.location.href.split('?')[1]).get('taskId'), 'later');
    assert.equal(c.hayyizGetTodos().length, 2);
});
check('Completing focus reduces the next suggested session to the remaining daily budget', () => {
    const c = device();
    c.hayyizApplyFocusResult({ taskId: 'urgent', workMin: 8 });
    c.hayyizSaveJSON('hayyiz-focus-history', { '2026-10-22': 8 });
    const rec = c.hayyizRecommendNext();
    assert.equal(rec.next.id, 'urgent'); assert.equal(rec.plannedMinutes, 2); assert.equal(rec.isInProgress, true);
    assert.equal(c.hayyizLaunchPlannedTask(rec.next.id), true);
    assert.equal(new URLSearchParams(c.location.href.split('?')[1]).get('sessionMinutes'), '2');
});
check('Recommended launch resumes a running or paused timer without replacing its context', () => {
    for (const status of ['running', 'paused']) {
        const c = device();
        c.hayyizSaveFocusState({ mode: 'focus', status, remainingSeconds: 300, totalDuration: 1500,
            endTime: status === 'running' ? FixedDate.now() + 300000 : null,
            context: { type: 'task', id: 'later', title: 'مراجعة مؤجلة' } });
        c.localStorage.setItem('hayyiz-current-task-id', 'later');
        c.hayyizGetFocusState(); // Normalize the persisted state as the UI does before rendering.
        const before = c.localStorage.getItem('hayyiz-pomodoro-state');
        assert.equal(c.hayyizLaunchPlannedTask('urgent'), true);
        assert.equal(c.location.href, 'pomodoro.html');
        assert.equal(c.localStorage.getItem('hayyiz-current-task-id'), 'later');
        assert.equal(c.localStorage.getItem('hayyiz-pomodoro-state'), before);
    }
});
process.exitCode = failed ? 1 : 0;
