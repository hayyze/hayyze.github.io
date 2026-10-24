const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function store(initial = {}) {
    const data = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
    const writes = [];
    return { data, writes,
        getItem(key) { return data.get(key) ?? null; },
        setItem(key, value) { writes.push(key); data.set(key, String(value)); },
        removeItem(key) { writes.push(key); data.delete(key); },
        key(index) { return Array.from(data.keys())[index] ?? null; },
        get length() { return data.size; }
    };
}
function keys(values) {
    return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));
}
function harness(current = {}, guest = {}) {
    const storage = store(keys(current)), guestStorage = store(keys(guest));
    const listeners = [], elements = new Map();
    let confirms = false, reloads = 0, syncs = 0;
    for (const id of ['hayyiz-device-data-controls', 'hayyiz-claim-device-data', 'hayyiz-claim-status']) {
        elements.set(id, { hidden: true, disabled: false, textContent: '', handlers: {},
            addEventListener(type, run) { this.handlers[type] = run; } });
    }
    Object.assign(storage, { accountId: 'account-a', scope: 'user:account-a',
        guestSnapshot() { return Object.fromEntries(guestStorage.data); },
        isCurrentScope(scope) { return scope === this.scope; },
        databaseName(name) { return name + '--account-a'; }
    });
    const context = vm.createContext({
        console, hayyizStorage: storage, localStorage: storage, navigator: {},
        document: { addEventListener(type, run) { listeners.push({ type, run }); },
            getElementById(id) { return elements.get(id) || null; }, querySelectorAll() { return []; } },
        ArrayBuffer, Uint8Array, URL, Blob, setTimeout, clearTimeout,
        btoa: value => Buffer.from(value, 'binary').toString('base64'),
        atob: value => Buffer.from(value, 'base64').toString('binary'),
        confirm() { return confirms; }, location: { reload() { reloads++; } },
        async hayyizSyncAllUserData() { syncs++; }
    });
    context.window = context;
    for (const file of ['common.js', 'focus-history.js', 'backup.js', 'account-import.js']) {
        vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
    }
    return { context, storage, guestStorage, elements,
        initializeClaim() { listeners.filter(item => item.type === 'DOMContentLoaded').at(-1).run(); },
        confirm(value) { confirms = value; }, get reloads() { return reloads; }, get syncs() { return syncs; }
    };
}
function backup(context, values, pdfFiles = []) {
    const archive = { version: 3, keys: keys(values), pdfFiles };
    // Exercise the same production validation boundary as the explicit UI flow.
    const validated = context.hayyizValidateBackup(archive);
    return { ...archive, keys: validated.keys };
}
function merge(context, current, incoming) {
    const before = JSON.stringify([current, incoming]);
    const result = context.hayyizMergeDeviceBackups(current, incoming);
    assert.equal(JSON.stringify([current, incoming]), before, 'Merge must not mutate either source archive');
    context.hayyizValidateBackup(result);
    return JSON.parse(JSON.stringify(result));
}
function read(archive, key) { return JSON.parse(archive.keys[key]); }
function drawing(id, updated, text, fileName) {
    return { id, updated, name: text, pageIndex: 0, bgStyle: 'plain', metadata: fileName ? { pdf: { fileName, pageCount: 1 } } : {},
        pages: [{ strokes: [{ tool: 'pen', color: '#000000', size: 2, points: [{ x: updated, y: 4, pressure: 0.5 }] }],
            texts: [{ id: id + '-text', text, x: 1, y: 2, size: 18 }] }] };
}
function pdfFile(id, source) {
    return { id, fileName: source + '.pdf', data: Buffer.from('%PDF-1.7\n' + source).toString('base64') };
}
function today() {
    const date = new Date();
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
let passed = 0, failed = 0;
async function check(name, run) {
    try { await run(); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name); console.error(error); }
}

(async () => {
    await check('Claiming device data requires an explicit confirmation and retains the guest source', async () => {
        const h = harness({ 'hayyiz-notes': [{ id: 'account-note', content: 'الحساب' }], 'hayyiz-pref-work': '45' },
            { 'hayyiz-notes': [{ id: 'guest-note', content: 'الجهاز' }], 'hayyiz-pref-work': '25' });
        const guestBefore = Object.fromEntries(h.guestStorage.data);
        const writesBefore = h.storage.writes.length;
        h.initializeClaim();
        assert.equal(h.elements.get('hayyiz-device-data-controls').hidden, false);
        assert.equal(h.storage.writes.length, writesBefore, 'Merely opening the page cannot claim device data');
        const click = h.elements.get('hayyiz-claim-device-data').handlers.click;
        await click();
        assert.equal(h.storage.writes.length, writesBefore, 'Declining confirmation cannot write data');
        h.confirm(true); await click();
        assert.deepEqual(JSON.parse(h.storage.getItem('hayyiz-notes')).map(row => row.id).sort(), ['account-note', 'guest-note']);
        assert.equal(h.storage.getItem('hayyiz-pref-work'), '45');
        assert.deepEqual(Object.fromEntries(h.guestStorage.data), guestBefore);
        assert.equal(h.syncs, 1); assert.equal(h.reloads, 1);
        assert.equal(h.elements.get('hayyiz-claim-device-data').disabled, false);
    });
    await check('Current preferences win while absent preferences are copied and active timer context is never imported', () => {
        const { context } = harness();
        const current = backup(context, { 'hayyiz-pref-work': '45', 'hayyiz-planning-preferences': { defaultMinutes: 90 },
            'hayyiz-pomodoro-state': { status: 'running', endTime: 1234, context: { id: 'current-task' } },
            'hayyiz-current-task-id': 'current-task' });
        const incoming = backup(context, { 'hayyiz-pref-work': '20', 'hayyiz-pref-long': '15',
            'hayyiz-planning-preferences': { defaultMinutes: 240 }, 'hayyiz-pomodoro-state': { status: 'paused', context: { id: 'guest-task' } },
            'hayyiz-current-task-id': 'guest-task', 'hayyiz-current-task': 'جلسة الزائر',
            'hayyiz-task-session': { id: 'guest-task' }, 'hayyiz-current-event': { id: 'guest-event' }, 'hayyiz-session-in-cycle': '3' });
        const result = merge(context, current, incoming);
        assert.equal(result.keys['hayyiz-pref-work'], '45');assert.equal(result.keys['hayyiz-pref-long'], '15');
        assert.equal(read(result, 'hayyiz-planning-preferences').defaultMinutes, 90);
        assert.equal(result.keys['hayyiz-pomodoro-state'], current.keys['hayyiz-pomodoro-state']);
        assert.equal(result.keys['hayyiz-current-task-id'], 'current-task');
        for (const key of ['hayyiz-current-task', 'hayyiz-task-session', 'hayyiz-current-event', 'hayyiz-session-in-cycle']) {
            assert.equal(result.keys[key], undefined, key + ' must not be copied from the guest');
        }
    });
    await check('Current tombstones prevent old device rows from reappearing without importing guest tombstones', () => {
        const { context } = harness();
        const current = backup(context, { 'hayyiz-todos': [{ id: 'kept', text: 'موجودة', updated: 200 }],
            'hayyiz-deleted-items': { 'todos:deleted': { timestamp: 300 }, 'notes:guest-deleted': 500 } });
        const incoming = backup(context, { 'hayyiz-todos': [
            { id: 'deleted', text: 'قديمة محذوفة', updated: 100 }, { id: 'kept', text: 'نسخة أقدم', updated: 100 }, { id: 'new', text: 'جديدة', updated: 400 }
        ], 'hayyiz-deleted-items': { 'todos:kept': 999 } });
        const result = merge(context, current, incoming);
        assert.deepEqual(read(result, 'hayyiz-todos').map(row => row.id), ['kept', 'new']);
        assert.equal(read(result, 'hayyiz-todos')[0].text, 'موجودة');
        assert.equal(result.keys['hayyiz-deleted-items'], current.keys['hayyiz-deleted-items']);
    });
    await check('Focus-log tombstones use the sync tool name and the historical session timestamp', () => {
        const { context } = harness();
        const deletedAt = Date.parse('2026-10-20T12:00:00.000Z');
        const current = backup(context, { 'hayyiz-focus-sessions-log': [],
            'hayyiz-deleted-items': { 'focus-log:deleted-log': { timestamp: deletedAt }, 'focus-log:newer-log': deletedAt } });
        const incoming = backup(context, { 'hayyiz-focus-sessions-log': [
            { id: 'deleted-log', date: '2026-10-19', timestamp: '2026-10-19T12:00:00.000Z', durationMinutes: 25, mode: 'focus' },
            { id: 'newer-log', date: '2026-10-21', timestamp: '2026-10-21T12:00:00.000Z', durationMinutes: 30, mode: 'focus' }
        ] });
        assert.deepEqual(read(merge(context, current, incoming), 'hayyiz-focus-sessions-log').map(row => row.id), ['newer-log']);
    });
    await check('Repeated imports assign stable IDs to legacy rows and cannot copy workspace-owned tasks', () => {
        const { context } = harness();
        const current = backup(context, { 'hayyiz-notes': [], 'hayyiz-todos': [] });
        const incoming = backup(context, { 'hayyiz-notes': [{ content: 'ملاحظة قديمة', created: 10 }, { content: 'ملاحظة أخرى', created: 20 }],
            'hayyiz-todos': [{ text: 'مهمة شخصية قديمة', created: 5 },
                { id: 'workspace-task', text: 'مهمة مساحة عمل', workspaceTaskId: 'shared-id' },
                { id: 'workspace-task-2', text: 'مهمة مساحة عمل ثانية', workspace_task_id: 'shared-id-2' }] });
        const once = merge(context, current, incoming), twice = merge(context, once, incoming);
        assert.deepEqual(read(twice, 'hayyiz-notes'), read(once, 'hayyiz-notes'));
        assert.equal(read(twice, 'hayyiz-notes').length, 2);
        assert(read(twice, 'hayyiz-notes').every(row => typeof row.id === 'string' && row.id.startsWith('device_')));
        assert.deepEqual(read(twice, 'hayyiz-todos'), read(once, 'hayyiz-todos'));
        assert.equal(read(twice, 'hayyiz-todos').length, 1);
    });
    await check('Drawing collisions select geometry and PDF bytes from the same source, including ties and missing files', () => {
        const { context } = harness();
        const current = backup(context, { 'hayyiz-free-spaces-v1': { spaces: [
            drawing('account-newer', 20, 'رسم الحساب', 'account.pdf'), drawing('guest-newer', 10, 'رسم أقدم', 'old.pdf'),
            drawing('equal', 20, 'رسم الحساب المتساوي', 'equal-account.pdf'), drawing('missing', 10, 'رسم مع ملف قديم', 'old.pdf')
        ] } }, [pdfFile('account-newer', 'account'), pdfFile('guest-newer', 'old'), pdfFile('equal', 'equal-account'), pdfFile('missing', 'old')]);
        const incoming = backup(context, { 'hayyiz-free-spaces-v1': { spaces: [
            drawing('account-newer', 10, 'رسم الزائر الأقدم', 'guest.pdf'), drawing('guest-newer', 30, 'رسم الزائر', 'guest.pdf'),
            drawing('equal', 20, 'رسم الزائر المتساوي', 'equal-guest.pdf'), drawing('missing', 40, 'رسم جديد بلا ملف', 'missing.pdf')
        ] } }, [pdfFile('account-newer', 'guest'), pdfFile('guest-newer', 'guest'), pdfFile('equal', 'equal-guest')]);
        const result = merge(context, current, incoming), spaces = new Map(read(result, 'hayyiz-free-spaces-v1').spaces.map(space => [space.id, space]));
        const files = new Map(result.pdfFiles.map(file => [file.id, file]));
        assert.equal(spaces.get('account-newer').name, 'رسم الحساب');assert.equal(files.get('account-newer').data, pdfFile('account-newer', 'account').data);
        assert.equal(spaces.get('guest-newer').pages[0].strokes[0].points[0].x, 30);assert.equal(files.get('guest-newer').data, pdfFile('guest-newer', 'guest').data);
        assert.equal(spaces.get('equal').name, 'رسم الحساب المتساوي');assert.equal(files.get('equal').data, pdfFile('equal', 'equal-account').data);
        assert.equal(spaces.get('missing').pages[0].texts[0].text, 'رسم جديد بلا ملف');assert.equal(files.has('missing'), false);
        assert.deepEqual(Array.from(context.hayyizValidateBackup(result).missingPdfIds), ['missing']);
    });
    await check('Focus state merges per-device counters once and preserves baseline session counts', () => {
        const { context, storage } = harness(), day = today();
        const current = backup(context, { 'hayyiz-focus-history': { [day]: 50 }, 'hayyiz-focus-history-state': {
            baseline: { [day]: { minutes: 25, sessions: 1 } }, devices: { laptop: { [day]: { minutes: 25, sessions: 1 } } }, totalBaseline: 5
        } });
        const incoming = backup(context, { 'hayyiz-focus-history': { [day]: 90 }, 'hayyiz-focus-history-state': {
            baseline: { [day]: { minutes: 30, sessions: 2 } }, devices: {
                laptop: { [day]: { minutes: 30, sessions: 1 } }, tablet: { [day]: { minutes: 30, sessions: 2 } }
            }, totalBaseline: 7
        } });
        const once = merge(context, current, incoming), twice = merge(context, once, incoming);
        assert.deepEqual(read(twice, 'hayyiz-focus-history'), { [day]: 90 });
        assert.deepEqual(read(twice, 'hayyiz-focus-history-state'), read(once, 'hayyiz-focus-history-state'));
        for (const key of ['hayyiz-focus-history', 'hayyiz-focus-history-state']) storage.setItem(key, twice.keys[key]);
        context.hayyizRefreshFocusStats();
        assert.equal(storage.getItem('hayyiz-focus-minutes-today'), '90');
        assert.equal(storage.getItem('hayyiz-sessions-today'), '5');
        assert.equal(storage.getItem('hayyiz-sessions'), '10');
    });
    await check('Legacy focus counters and logs become a baseline rather than being reset by explicit import', () => {
        const { context, storage } = harness(), day = today();
        const current = backup(context, { 'hayyiz-notes': [] });
        const incoming = backup(context, { 'hayyiz-focus-history': { [day]: 20 }, 'hayyiz-sessions': '2', 'hayyiz-sessions-day': day,
            'hayyiz-focus-minutes-today': '45', 'hayyiz-sessions-today': '3', 'hayyiz-focus-sessions-log': [
                { id: 'focus-1', date: day, mode: 'focus', durationMinutes: 15 }, { id: 'focus-2', date: day, mode: 'focus', durationMinutes: 15 },
                { id: 'break', date: day, mode: 'break', durationMinutes: 5 }
            ] });
        const merged = merge(context, current, incoming), state = read(merged, 'hayyiz-focus-history-state');
        assert.deepEqual(state.baseline[day], { minutes: 45, sessions: 3 });
        for (const key of ['hayyiz-focus-history', 'hayyiz-focus-history-state']) storage.setItem(key, merged.keys[key]);
        context.hayyizRefreshFocusStats();
        assert.equal(storage.getItem('hayyiz-sessions'), '3','All-time count must include the known baseline day count');
        assert.equal(storage.getItem('hayyiz-sessions-today'), '3');assert.equal(storage.getItem('hayyiz-focus-minutes-today'), '45');
    });
    await check('Owner-bound pending sessions, credentials and sync cursors are excluded at the production backup boundary', () => {
        const h = harness(), { context } = h;
        context.HAYYIZ_ALLOWED_BACKUP_KEYS.push('hayyiz-workspace-focus-outbox');
        h.storage.setItem('hayyiz-workspace-focus-outbox','[{"userId":"account-a","sessionId":"own-pending"}]');
        const before = h.storage.getItem('hayyiz-workspace-focus-outbox');
        const current = backup(context, { 'hayyiz-notes': [], 'hayyiz-workspace-focus-outbox': [{ userId: 'account-a' }] });
        const incoming = backup(context, { 'hayyiz-notes': [{ id: 'safe', content: 'ملاحظة شخصية' }],
            'hayyiz-workspace-focus-outbox': [{ userId: 'another-account', sessionId: 'foreign-pending' }],
            'sb-project-auth-token': 'private-token', 'hayyiz-account:other:hayyiz-notes': '[{"content":"private"}]',
            'hayyiz-sync-last-time-notes': '2026-10-22T00:00:00.000Z' });
        const result = merge(context, current, incoming);
        assert(!Object.keys(result.keys).some(key => key.includes('outbox') || key.includes('auth-token') || key.includes('hayyiz-account:') || key.includes('sync-last-time')));
        assert.equal(h.storage.getItem('hayyiz-workspace-focus-outbox'),before,'Merging archives cannot alter the current owner queue');
    });
    console.log(passed + ' account-import checks passed; ' + failed + ' failed.');
    if (failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
