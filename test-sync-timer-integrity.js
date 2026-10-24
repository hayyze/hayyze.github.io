const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const sources = Object.fromEntries(['account-storage.js', 'focus-history.js', 'common.js', 'sync.js', 'pomodoro.js']
    .map(file => [file, fs.readFileSync(file, 'utf8')]));
const authKey = 'sb-dzfdbjnqtgltuguqqdkz-auth-token';
const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const clone = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

class NativeStorage {
    constructor() { this.data = new Map(); }
    getItem(key) { return this.data.get(String(key)) ?? null; }
    setItem(key, value) { this.data.set(String(key), String(value)); }
    removeItem(key) { this.data.delete(String(key)); }
    key(index) { return Array.from(this.data.keys())[index] ?? null; }
    get length() { return this.data.size; }
    clear() { this.data.clear(); }
}

class Element {
    constructor(tag = 'div') {
        this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null;
        this.listeners = new Map(); this.attributes = {}; this.style = {}; this.dataset = {};
        this.className = ''; this.textContent = ''; this.innerHTML = ''; this.value = ''; this.disabled = false;
        this.classList = {
            add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
            remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
            contains: name => this.className.split(/\s+/).includes(name),
            toggle: (name, force) => { const add = force === undefined ? !this.classList.contains(name) : force; this.classList[add ? 'add' : 'remove'](name); return add; }
        };
    }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    addEventListener(type, handler) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(handler); }
    dispatch(type, extra = {}) {
        const event = { type, target: this, preventDefault() {}, stopPropagation() {}, ...extra };
        return Promise.all((this.listeners.get(type) || []).map(handler => handler(event)));
    }
    click() { return this.disabled ? Promise.resolve() : this.dispatch('click'); }
    querySelectorAll(selector) {
        return this.children.flatMap(child => [
            ...(selector.startsWith('.') ? child.classList.contains(selector.slice(1)) : child.tagName.toLowerCase() === selector) ? [child] : [],
            ...child.querySelectorAll(selector)
        ]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    focus() {}
}

function transport() {
    const api = {
        userId: userA, rows: [], writes: [], reads: [], rpcs: [], authCallbacks: [],
        readGates: new Map(), writeGates: [], rpcHandlers: new Map(), activeWrites: 0, maxActiveWrites: 0,
        auth: {
            async getUser() { return { data: { user: api.userId ? { id: api.userId } : null }, error: null }; },
            onAuthStateChange(callback) { api.authCallbacks.push(callback); return { data: { subscription: { unsubscribe() {} } } }; }
        },
        emitAuth(event, id) { api.userId = id; for (const callback of api.authCallbacks) callback(event, id ? { user: { id } } : null); },
        from(table) {
            assert.equal(table, 'sync_items');
            const filters = {};
            const query = {
                select() { return query; }, eq(key, value) { filters[key] = value; return query; },
                gt(key, value) { filters.since = value; return query; },
                then(resolve, reject) {
                    api.reads.push(clone(filters));
                    const gate = api.readGates.get(filters.tool);
                    if (gate) { api.readGates.delete(filters.tool); return gate.promise.then(resolve, reject); }
                    const rows = api.rows.filter(row => row.user_id === filters.user_id && row.tool === filters.tool && (!filters.since || row.updated_at > filters.since));
                    return Promise.resolve({ data: clone(rows), error: null }).then(resolve, reject);
                },
                async upsert(value, options) {
                    assert.equal(options.onConflict, 'user_id,tool,item_id');
                    const rows = clone(Array.isArray(value) ? value : [value]);
                    api.writes.push(rows); api.activeWrites++;
                    api.maxActiveWrites = Math.max(api.maxActiveWrites, api.activeWrites);
                    try {
                        const gate = api.writeGates.shift();
                        const result = gate ? await gate.promise : { error: null };
                        if (!result.error) for (const row of rows) {
                            const index = api.rows.findIndex(old => old.user_id === row.user_id && old.tool === row.tool && old.item_id === row.item_id);
                            if (index < 0) api.rows.push(row); else api.rows[index] = row;
                        }
                        return result;
                    } finally { api.activeWrites--; }
                }
            };
            return query;
        },
        async rpc(name, parameters) {
            api.rpcs.push({ name, parameters: clone(parameters) });
            const handler = api.rpcHandlers.get(name);
            return handler ? handler(clone(parameters)) : { data: { success: true }, error: null };
        }
    };
    return api;
}

function browser({ sync = false, timer = false, search = '', initial = {}, now, native, server } = {}) {
    native ||= new NativeStorage(); server ||= transport();
    native.setItem(authKey, JSON.stringify({ user: { id: userA } }));
    const clock = { now: now ?? new Date(2026, 9, 23, 12).getTime() };
    class ClockDate extends Date {
        constructor(...args) { super(...(args.length ? args : [clock.now])); }
        static now() { return clock.now; }
    }
    const intervals = new Map(), timeouts = new Map(), windowListeners = new Map(), domReady = [];
    let nextTimer = 1, reloads = 0;
    const body = new Element('body'), elements = new Map();
    for (const id of ['timer-display', 'timer-progress-bar', 'timer-start-btn', 'timer-pause-btn', 'timer-reset-btn',
        'work-minutes', 'break-minutes', 'long-break-minutes', 'mode-work', 'mode-break', 'completed-sessions-count',
        'sr-timer-announcer', 'focus-minutes-today', 'focus-sessions-today']) {
        const element = new Element(id.endsWith('minutes') ? 'input' : 'button'); element.id = id;
        elements.set(id, element); body.appendChild(element);
    }
    elements.get('work-minutes').value = '25'; elements.get('break-minutes').value = '5'; elements.get('long-break-minutes').value = '15';
    const document = {
        body, documentElement: new Element('html'), title: '', visibilityState: 'visible',
        addEventListener(type, callback) { if (type === 'DOMContentLoaded') domReady.push(callback); },
        getElementById(id) { return elements.get(id) || null; },
        createElement(tag) { return new Element(tag); },
        querySelector(selector) { return body.querySelector(selector); },
        querySelectorAll(selector) { return body.querySelectorAll(selector); }
    };
    const location = { href: 'https://hayyiz.example/pomodoro.html' + search, search, reload() { reloads++; } };
    const warnings = [];
    const context = vm.createContext({
        Date: ClockDate, localStorage: native, document, navigator: {}, location, URL, URLSearchParams,
        console: { log() {}, warn(...args) { warnings.push(args); }, error: console.error },
        setInterval(callback) { const id = nextTimer++; intervals.set(id, callback); return id; }, clearInterval(id) { intervals.delete(id); },
        setTimeout(callback) { const id = nextTimer++; timeouts.set(id, callback); return id; }, clearTimeout(id) { timeouts.delete(id); },
        Event: class { constructor(type) { this.type = type; } },
        crypto: { randomUUID: () => 'device_A' },
        history: { replaceState(state, title, value) { const url = new URL(value, location.href); location.href = url.href; location.search = url.search; } },
        addEventListener(type, callback) { if (!windowListeners.has(type)) windowListeners.set(type, []); windowListeners.get(type).push(callback); },
        dispatchEvent(event) { for (const callback of windowListeners.get(event.type) || []) callback(event); return true; },
        supabaseClient: server, ensureSupabaseLoaded: async () => server
    });
    context.window = context; context.global = context;
    const load = file => vm.runInContext(sources[file], context, { filename: file });
    load('account-storage.js');
    for (const [key, value] of Object.entries(initial)) context.hayyizStorage.setItem(key, value);
    load('focus-history.js'); load('common.js');
    if (sync) { load('sync.js'); context.initAuthListener(); }
    if (timer) {
        const before = domReady.length; load('pomodoro.js');
        domReady.slice(before).forEach(callback => callback());
    }
    return {
        context, storage: context.hayyizStorage, native, server, clock, elements, document, warnings,
        get reloads() { return reloads; },
        state() { return JSON.parse(this.storage.getItem('hayyiz-pomodoro-state')); },
        click(id) { return elements.get(id).click(); },
        completeTimer(lateAt) {
            const state = this.state(); assert.equal(state.status, 'running');
            clock.now = lateAt ?? state.endTime;
            const callbacks = Array.from(intervals.values()); assert(callbacks.length > 0, 'The production interval must be active');
            callbacks.forEach(callback => callback());
        },
        changeAuth(id) {
            if (id) native.setItem(authKey, JSON.stringify({ user: { id } })); else native.removeItem(authKey);
            server.emitAuth(id ? 'SIGNED_IN' : 'SIGNED_OUT', id);
        }
    };
}

async function until(condition, message) {
    for (let round = 0; round < 80; round++) { if (condition()) return; await Promise.resolve(); }
    assert(condition(), message || 'Expected asynchronous production operation to start');
}
const entry = (id = 'session_A') => ({ id, taskId: 'workspace-task-A', workspaceId: 'workspace-A',
    startedAt: '2026-10-23T10:00:00.000Z', endedAt: '2026-10-23T10:25:00.000Z', durationSeconds: 1500 });
let failures = 0;
let finished = false;
process.once('beforeExit', () => {
    if (!finished) { console.error('FAIL sync/timer suite stopped with an unresolved production operation'); process.exitCode = 1; }
});
async function check(name, run) {
    try { await run(); console.log('PASS ' + name); }
    catch (error) { failures++; console.error('FAIL ' + name); console.error(error); }
}

(async () => {
    await check('direct uploads are immutable snapshots and serialize old/new writes to one tool', async () => {
        const b = browser({ sync: true }), gate = deferred(); b.server.writeGates.push(gate);
        const note = { id: 'n', content: 'old', updated: b.clock.now };
        const first = b.context.hayyizUploadItem('notes', 'n', note);
        note.content = 'mutation after enqueue';
        await until(() => b.server.writes.length === 1);
        const second = b.context.hayyizUploadItem('notes', 'n', { id: 'n', content: 'new', updated: b.clock.now + 1 });
        for (let round = 0; round < 15; round++) await Promise.resolve();
        assert.equal(b.server.writes.length, 1); assert.equal(b.server.writes[0][0].data.content, 'old');
        gate.resolve({ error: null }); await Promise.all([first, second]);
        assert.equal(b.server.writes.length, 2); assert.equal(b.server.maxActiveWrites, 1);
        assert.equal(b.server.rows[0].data.content, 'new'); assert.equal(b.server.rows[0].user_id, userA);
    });

    await check('a local edit made during an in-flight sync is drained before the shared sync promise finishes', async () => {
        const b = browser({ sync: true, initial: { 'hayyiz-notes': JSON.stringify([{ id: 'n', content: 'old', updated: new Date(2026, 9, 23, 12).getTime() }]) } });
        const gate = deferred(); b.server.writeGates.push(gate);
        const first = b.context.hayyizSyncTool('notes');
        await until(() => b.server.writes.length === 1);
        b.clock.now += 1000;
        b.storage.setItem('hayyiz-notes', JSON.stringify([{ id: 'n', content: 'edited while saving', updated: b.clock.now }]));
        const second = b.context.hayyizSyncTool('notes');
        gate.resolve({ error: null }); await Promise.all([first, second]);
        assert.equal(b.server.rows[0].data.content, 'edited while saving');
        assert.equal(JSON.parse(b.storage.getItem('hayyiz-notes'))[0].content, 'edited while saving');
        assert.equal(b.server.maxActiveWrites, 1); assert.equal(b.server.writes.length, 2);
        assert(b.storage.getItem('hayyiz-sync-last-time-notes'));
    });

    await check('sign-out invalidates an outstanding read before it can change cache, callbacks or cursor', async () => {
        const cursor = '2026-10-22T09:00:00.000Z';
        const b = browser({ sync: true, initial: { 'hayyiz-notes': '[]', 'hayyiz-sync-last-time-notes': cursor } });
        const gate = deferred(); b.server.readGates.set('notes', gate);
        let callbacks = 0; b.context.hayyizRegisterSyncCallback('notes', () => { callbacks++; });
        const saving = b.context.hayyizSyncTool('notes'); await until(() => b.server.reads.length === 1);
        b.changeAuth(null);
        gate.resolve({ data: [{ user_id: userA, tool: 'notes', item_id: 'remote', data: { id: 'remote', content: 'private remote' }, updated_at: new Date(b.clock.now).toISOString() }], error: null });
        await saving;
        assert.equal(b.storage.getItem('hayyiz-notes'), '[]'); assert.equal(b.storage.getItem('hayyiz-sync-last-time-notes'), cursor);
        assert.equal(callbacks, 0); assert.equal(b.server.writes.length, 0); assert.equal(b.reloads, 1);
        assert.equal(b.storage.isCurrentUser(userA), false);
    });

    await check('changing accounts cancels queued writes while an earlier request is already in flight', async () => {
        const b = browser({ sync: true }), gate = deferred(); b.server.writeGates.push(gate);
        const first = b.context.hayyizUploadItem('notes', 'n', { id: 'n', content: 'A first' });
        await until(() => b.server.writes.length === 1);
        const second = b.context.hayyizUploadItem('notes', 'n', { id: 'n', content: 'A queued' });
        for (let round = 0; round < 15; round++) await Promise.resolve();
        b.changeAuth(userB); gate.resolve({ error: null }); await Promise.all([first, second]);
        assert.equal(b.server.writes.length, 1); assert.equal(b.server.rows[0].user_id, userA);
        assert.equal(b.reloads, 1); assert.equal(b.storage.accountId, userA);
        assert.equal(b.native.getItem('hayyiz-account:' + userB + ':hayyiz-notes'), null);
    });

    await check('the raw birthday string uploads and restores through the actual single-value adapter', async () => {
        const a = browser({ sync: true, initial: { 'hayyiz-birthdate': '2008-01-31', 'hayyiz-birthdate-updated': String(new Date(2026, 9, 23, 12).getTime()) } });
        await a.context.hayyizSyncTool('birthdate');
        const remote = a.server.rows.find(row => row.tool === 'birthdate');
        assert.equal(remote.data, '2008-01-31');
        const b = browser({ sync: true, server: a.server });
        await b.context.hayyizSyncTool('birthdate');
        assert.equal(b.storage.getItem('hayyiz-birthdate'), '2008-01-31');
        assert.equal(b.native.getItem('hayyiz-birthdate'), null);
        const quoted = browser({ sync: true, initial: { 'hayyiz-birthdate': '"2007-02-03"', 'hayyiz-birthdate-updated': String(a.clock.now + 1000) } });
        await quoted.context.hayyizSyncTool('birthdate');
        assert.equal(quoted.server.rows.find(row => row.tool === 'birthdate').data, '2007-02-03');
    });

    await check('workspace focus outbox uses the exact RPC contract, keeps failed entries and serializes flushes', async () => {
        const one = entry(), two = entry('session_B');
        const b = browser({ sync: true, initial: { 'hayyiz-workspace-focus-outbox': JSON.stringify({ [one.id]: one, [two.id]: two }) } });
        const gate = deferred(); let attempt = 0;
        b.server.rpcHandlers.set('record_focus_session', () => ++attempt === 1 ? gate.promise : { data: { success: false, message: 'not saved' }, error: null });
        const first = b.context.hayyizFlushWorkspaceFocusSessions(), second = b.context.hayyizFlushWorkspaceFocusSessions();
        assert.equal(first, second); await until(() => b.server.rpcs.length === 1);
        assert.deepEqual(b.server.rpcs[0], { name: 'record_focus_session', parameters: {
            p_client_session_id: one.id, p_task_id: one.taskId, p_workspace_id: one.workspaceId,
            p_started_at: one.startedAt, p_ended_at: one.endedAt, p_duration_seconds: one.durationSeconds
        } });
        gate.resolve({ data: { success: true }, error: null });
        assert.equal(await first, false); assert.equal(await second, false);
        assert.deepEqual(JSON.parse(b.storage.getItem('hayyiz-workspace-focus-outbox')), { [two.id]: two });
        b.server.rpcHandlers.set('record_focus_session', () => ({ data: { success: true }, error: null }));
        assert.equal(await b.context.hayyizFlushWorkspaceFocusSessions(), true);
        assert.deepEqual(JSON.parse(b.storage.getItem('hayyiz-workspace-focus-outbox')), {});
        assert.deepEqual(b.server.rpcs.map(call => call.parameters.p_client_session_id), [one.id, two.id, two.id]);
    });

    await check('a failed focus upload survives document reload and keeps its original client session id', async () => {
        const one = entry();
        const a = browser({ sync: true, initial: { 'hayyiz-workspace-focus-outbox': JSON.stringify({ [one.id]: one }) } });
        a.server.rpcHandlers.set('record_focus_session', () => ({ data: null, error: { message: 'permission temporarily unavailable' } }));
        assert.equal(await a.context.hayyizFlushWorkspaceFocusSessions(), false);
        assert(JSON.parse(a.storage.getItem('hayyiz-workspace-focus-outbox'))[one.id]);
        a.server.rpcHandlers.delete('record_focus_session');
        const reloaded = browser({ sync: true, native: a.native, server: a.server });
        assert.equal(await reloaded.context.hayyizFlushWorkspaceFocusSessions(), true);
        assert.deepEqual(a.server.rpcs.map(call => call.parameters.p_client_session_id), [one.id, one.id]);
        assert.deepEqual(JSON.parse(reloaded.storage.getItem('hayyiz-workspace-focus-outbox')), {});
    });

    await check('a late RPC result after an account change cannot acknowledge or delete the old outbox entry', async () => {
        const one = entry(), b = browser({ sync: true, initial: { 'hayyiz-workspace-focus-outbox': JSON.stringify({ [one.id]: one }) } });
        const gate = deferred(); b.server.rpcHandlers.set('record_focus_session', () => gate.promise);
        const flush = b.context.hayyizFlushWorkspaceFocusSessions(); await until(() => b.server.rpcs.length === 1);
        b.changeAuth(userB); gate.resolve({ data: { success: true }, error: null });
        assert.equal(await flush, false);
        assert.deepEqual(JSON.parse(b.storage.getItem('hayyiz-workspace-focus-outbox')), { [one.id]: one });
        assert.equal(b.native.getItem('hayyiz-account:' + userB + ':hayyiz-workspace-focus-outbox'), null);
        assert.equal(b.server.rpcs.length, 1);
    });

    await check('actual timer intervals preserve all four focus cycles and select the long break', async () => {
        const b = browser({ timer: true });
        for (let cycle = 1; cycle <= 4; cycle++) {
            assert.equal(b.state().mode, 'focus'); await b.click('timer-start-btn'); b.completeTimer();
            const state = b.state();
            assert.equal(state.mode, cycle === 4 ? 'longBreak' : 'break');
            assert.equal(state.sessionInCycle, cycle === 4 ? 0 : cycle);
            assert.equal(state.totalDuration, (cycle === 4 ? 15 : 5) * 60);
            assert.equal(b.context.hayyizGetFocusSessions().length, cycle);
            await b.click('timer-start-btn'); b.completeTimer();
            assert.equal(b.state().mode, 'focus'); assert.equal(b.state().totalDuration, 25 * 60);
        }
        assert.equal(b.storage.getItem('hayyiz-sessions'), '4');
        assert.equal(b.storage.getItem('hayyiz-focus-minutes-today'), '100');
        assert.equal(b.context.hayyizGetFocusSessions().length, 4);
    });

    await check('a planned five-minute session is consumed once and the next manual focus uses the saved 25 minutes', async () => {
        const b = browser({ timer: true, search: '?sessionMinutes=5', initial: { 'hayyiz-pref-work': '25' } });
        assert.equal(b.state().totalDuration, 5 * 60);
        assert.equal(new URL(b.context.location.href).searchParams.has('sessionMinutes'), false);
        await b.click('timer-start-btn'); b.completeTimer();
        assert.equal(b.state().mode, 'break');
        await b.click('mode-work');
        assert.equal(b.state().totalDuration, 25 * 60);
        assert.equal(b.elements.get('work-minutes').value, '25');
        assert.equal(b.storage.getItem('hayyiz-pref-work'), '25');
        await b.click('timer-start-btn');
        assert.equal(b.state().endTime - b.clock.now, 25 * 60000);
        assert.equal(b.context.hayyizGetFocusSessions()[0].durationMinutes, 5);
    });

    await check('a timer reconciled after midnight records its real end date in history, log, task and subject', async () => {
        const start = new Date(2026, 9, 22, 23, 0).getTime();
        const b = browser({ timer: true, now: start, search: '?taskId=t', initial: {
            'hayyiz-todos': JSON.stringify([{ id: 't', text: 'Study', minutes: 90, subjectId: 'math', completed: false }]),
            'hayyiz-subjects': JSON.stringify([{ id: 'math', name: 'Math' }])
        } });
        await b.click('timer-start-btn'); const realEnd = b.state().endTime;
        b.completeTimer(new Date(2026, 9, 23, 0, 10).getTime());
        const log = clone(b.context.hayyizGetFocusSessions());
        assert.equal(log[0].date, '2026-10-22'); assert.equal(log[0].timestamp, new Date(realEnd).toISOString());
        assert.equal(JSON.parse(b.storage.getItem('hayyiz-focus-history'))['2026-10-22'], 25);
        assert.equal(b.storage.getItem('hayyiz-focus-minutes-today'), '0'); assert.equal(b.storage.getItem('hayyiz-sessions-today'), '0');
        assert.equal(b.context.hayyizGetTaskById('t').lastFocused, '2026-10-22');
        assert.equal(b.context.hayyizGetSubjectById('math').lastFocused, '2026-10-22');
        assert.equal(JSON.parse(b.storage.getItem('hayyiz-subject-progress')).math['2026-10-22'], 25);
        b.context.hayyizReconcilePomodoroState();
        assert.equal(b.context.hayyizGetFocusSessions().length, 1); assert.equal(b.storage.getItem('hayyiz-sessions'), '1');
    });

    await check('the real completion modal waits for workspace RPC success and retains the task on failure', async () => {
        const b = browser({ timer: true, sync: true, search: '?taskId=t', initial: {
            'hayyiz-todos': JSON.stringify([{ id: 't', text: 'Shared study', minutes: 60, workspaceTaskId: 'workspace-task-A', workspaceId: 'workspace-A', completed: false }])
        } });
        await until(() => b.server.reads.some(call => call.tool === 'pomodoro-prefs'));
        for (let round = 0; round < 40; round++) await Promise.resolve();
        await b.click('timer-start-btn'); b.completeTimer();
        const overlay = b.document.querySelector('.session-end-overlay'); assert(overlay);
        const button = overlay.querySelectorAll('button').find(element => element.innerHTML.includes('المهمة مكتملة'));
        assert(button);
        const gate = deferred(); b.server.rpcHandlers.set('set_task_progress_and_recalculate', () => gate.promise);
        const clicking = button.click();
        await until(() => b.server.rpcs.some(call => call.name === 'set_task_progress_and_recalculate'));
        assert.equal(button.disabled, true); assert.equal(b.context.hayyizGetTaskById('t').completed, false);
        assert.equal(b.document.querySelector('.session-end-overlay'), overlay);
        gate.resolve({ data: { success: false, message: 'رفض حفظ الإنجاز' }, error: null }); await clicking;
        assert.equal(button.disabled, false); assert.equal(b.context.hayyizGetTaskById('t').completed, false);
        assert.equal(b.document.querySelector('.session-end-overlay'), overlay);
        assert(overlay.querySelector('p').textContent.includes('رفض حفظ الإنجاز'));
        b.server.rpcHandlers.set('set_task_progress_and_recalculate', () => ({ data: { success: true }, error: null }));
        await button.click();
        assert.equal(b.context.hayyizGetTaskById('t').completed, true);
        assert.equal(b.document.querySelector('.session-end-overlay'), null);
        assert.equal(b.storage.getItem('hayyiz-current-task-id'), null);
        const call = b.server.rpcs.find(item => item.name === 'set_task_progress_and_recalculate');
        assert.deepEqual(call.parameters, { p_task_id: 'workspace-task-A', p_completed: true });
        const focusCall = b.server.rpcs.find(item => item.name === 'record_focus_session'); assert(focusCall);
        assert.equal(focusCall.parameters.p_duration_seconds, 1500);
        assert.equal(focusCall.parameters.p_client_session_id, b.context.hayyizGetFocusSessions()[0].id);
    });

    finished = true;
    if (failures) process.exitCode = 1;
    else console.log('All sync and timer integrity tests passed.');
})().catch(error => { finished = true; console.error(error); process.exitCode = 1; });
