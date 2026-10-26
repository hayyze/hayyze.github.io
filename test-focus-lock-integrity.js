const fs = require('node:fs');
const assert = require('node:assert/strict');
const helper = { exports: {} };
new Function('require', 'module', fs.readFileSync('test-sync-timer-integrity.js', 'utf8').split('let failures = 0;')[0] + '\nmodule.exports={browser};')(require, helper);
const { browser } = helper.exports;
(async () => {
    const a = browser(), b = browser({ native: a.native });
    const queues = new Map();
    const locks = { request(name, run) {
        const pending = (queues.get(name) || Promise.resolve()).then(() => run({ name }));
        queues.set(name, pending.catch(() => {}));
        return pending;
    } };
    a.context.navigator.locks = b.context.navigator.locks = locks;
    a.context.hayyizApplyFocusHistoryPayload({});
    const ended = { mode: 'focus', status: 'running', sessionId: 'same-session', totalDuration: 1500,
        endTime: a.clock.now - 1000, context: { type: 'free', title: 'Study' } };
    a.context.hayyizSaveFocusState(ended);
    let release;
    const gate = locks.request('hayyiz-focus-completion:' + a.storage.scope, () => new Promise(resolve => { release = resolve; }));
    await Promise.resolve();
    // Both synchronous readers see an expired timer while another document holds
    // the lock. Neither may mutate it, and both queue behind the same lock.
    assert.equal(a.context.hayyizGetFocusState().remainingSeconds, 0);
    assert.equal(b.context.hayyizGetFocusState().status, 'running');
    assert.equal(a.context.hayyizGetFocusSessions().length, 0);
    const pending = [a.context.hayyizReconcilePomodoroStateAsync(), b.context.hayyizReconcilePomodoroStateAsync()];
    release(); await gate; await Promise.all(pending);
    assert.equal(a.storage.getItem('hayyiz-focus-minutes-today'), '25');
    assert.equal(a.storage.getItem('hayyiz-sessions-today'), '1');
    assert.equal(a.context.hayyizGetFocusSessions().length, 1);
    a.context.hayyizSaveFocusState(ended);
    assert.equal(a.state().status, 'completed', 'Stale running tabs cannot resurrect completion');
    await Promise.all([a.context.hayyizReconcilePomodoroStateAsync(), b.context.hayyizReconcilePomodoroStateAsync()]);
    assert.equal(a.storage.getItem('hayyiz-focus-minutes-today'), '25');
    console.log('PASS cross-document focus lock, read-only getters and stale-state guard');
})().catch(error => { console.error(error); process.exitCode = 1; });
