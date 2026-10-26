const assert = require('node:assert/strict');
module.exports = async (browser, base) => {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const errors = [];
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    try {
        const a = await context.newPage(), b = await context.newPage();
        for (const p of [a, b]) p.on('pageerror', error => errors.push(error.message));
        await Promise.all([a.goto(base + '/about.html'), b.goto(base + '/about.html')]);
        await a.evaluate(() => {
            hayyizApplyFocusHistoryPayload({});
            hayyizStorage.setItem('hayyiz-subjects', JSON.stringify([{ id: 'math', name: 'رياضيات' }]));
            hayyizStorage.setItem('hayyiz-todos', JSON.stringify([{ id: 'study', text: 'مذاكرة', subjectId: 'math', minutes: 60, completed: false }]));
            hayyizSaveFocusState({ mode: 'focus', status: 'running', sessionId: 'concurrent-completion', totalDuration: 1500,
                endTime: Date.now() - 1000, startedAt: new Date(Date.now() - 1501000).toISOString(),
                context: { type: 'task', id: 'study', title: 'مذاكرة', subjectId: 'math', workspaceTaskId: 'shared-task', workspaceId: 'shared-space' } });
            window.__gateReady = false;
            window.__gate = navigator.locks.request('hayyiz-focus-completion:' + hayyizStorage.scope, () => {
                window.__gateReady = true;
                return new Promise(resolve => { window.__releaseFocusGate = resolve; });
            });
        });
        await a.waitForFunction(() => window.__gateReady);
        for (const p of [a, b]) await p.evaluate(() => {
            window.__oldTimer = JSON.parse(hayyizStorage.getItem('hayyiz-pomodoro-state'));
            hayyizGetFocusState();
            window.__focusDone = hayyizReconcilePomodoroStateAsync();
        });
        assert.equal(await b.evaluate(() => hayyizGetFocusSessions().length), 0, 'Completion cannot bypass another document lock');
        await a.evaluate(() => window.__releaseFocusGate());
        await Promise.all([a.evaluate(() => window.__focusDone), b.evaluate(() => window.__focusDone)]);
        const result = await a.evaluate(() => ({
            minutes: hayyizStorage.getItem('hayyiz-focus-minutes-today'),
            sessions: hayyizStorage.getItem('hayyiz-sessions-today'),
            log: hayyizGetFocusSessions().map(entry => entry.id),
            task: hayyizGetTaskById('study').focusDone,
            cycle: hayyizStorage.getItem('hayyiz-session-in-cycle'),
            subject: JSON.parse(hayyizStorage.getItem('hayyiz-subject-progress')),
            outbox: Object.keys(JSON.parse(hayyizStorage.getItem('hayyiz-workspace-focus-outbox')))
        }));
        assert.equal(result.minutes, '25'); assert.equal(result.sessions, '1');
        assert.deepEqual(result.log, ['concurrent-completion']); assert.equal(result.cycle, '1'); assert.equal(result.task, 25);
        assert.deepEqual(result.outbox, ['concurrent-completion']);
        assert.equal(Object.values(result.subject.math).reduce((sum, minutes) => sum + minutes, 0), 25);
        await b.evaluate(async () => { hayyizSaveFocusState(window.__oldTimer); await hayyizReconcilePomodoroStateAsync(); });
        assert.equal(await a.evaluate(() => hayyizStorage.getItem('hayyiz-focus-minutes-today')), '25');
        // Exercise the production IndexedDB coordinator with Web Locks absent.
        for (const p of [a, b]) await p.evaluate(() => Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true }));
        await a.evaluate(() => hayyizSaveFocusState({ ...window.__oldTimer, sessionId: 'idb-completion' }));
        await Promise.all([a.evaluate(() => hayyizReconcilePomodoroStateAsync()), b.evaluate(() => hayyizReconcilePomodoroStateAsync())]);
        assert.equal(await a.evaluate(() => hayyizStorage.getItem('hayyiz-focus-minutes-today')), '50');
        assert.equal(await a.evaluate(() => hayyizGetFocusSessions().filter(entry => entry.id === 'idb-completion').length), 1);
        assert.deepEqual(errors, []);
        console.log('Cross-tab focus completion PASSED: real Web Lock contention, one log/counter/progress/outbox entry, stale-state rejection.');
    } finally { await context.close(); }
};
