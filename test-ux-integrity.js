const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
    const values = new Map();
    const state = { reads: 0, writes: [], fail: false, rows: [], quota: false };
    const storage = {
        getItem: key => values.get(key) ?? null,
        setItem(key, value) { if (state.quota && key === 'hayyiz-notes') throw new Error('QuotaExceededError'); values.set(key, String(value)); },
        removeItem: key => values.delete(key)
    };
    const context = vm.createContext({ console: { log() {}, warn() {} }, localStorage: storage, navigator: {},
        document: { addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; } },
        location: { href: '', search: '' }, addEventListener() {}, setTimeout, clearTimeout,
        supabaseClient: {
            auth: { async getUser() { return { data: { user: { id: 'synthetic-account' } } }; } },
            from() {
                const query = {
                    select() { return this; }, eq() { return this; }, gt() { return this; },
                    then(resolve) { state.reads++; resolve(state.fail ? { error: { message: 'offline' } } : { data: state.rows, error: null }); },
                    async upsert(rows) { state.writes.push(rows); return state.fail ? { error: { message: 'offline' } } : { error: null }; }
                };
                return query;
            }
        }
    });
    context.window = context;
    return { context, values, state, load(file) { vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file }); } };
}

(async () => {
    const p = fixture(); p.load('common.js');
    const subject = p.context.hayyizAddSubject('الرياضيات');
    const event = { id: 'exam-one', name: 'اختبار الفصل الأول', date: '2026-11-12', type: 'exam', subjectId: subject.id };
    const task = p.context.hayyizConvertEventToTodo(event);
    assert.equal(task.subjectId, subject.id); assert.equal(task.taskType, 'review'); assert.equal(task.eventId, event.id);
    assert.equal(p.context.hayyizConvertEventToTodo({ ...event, name: 'اسم جديد', date: '2026-11-13' }).id, task.id);
    assert.notEqual(p.context.hayyizConvertEventToTodo({ ...event, id: 'exam-two' }).id, task.id);
    const assignment = p.context.hayyizConvertEventToTodo({ ...event, id: 'assignment-one', type: 'assignment' });
    assert.equal(assignment.taskType, 'assignment'); assert.equal(assignment.subjectId, subject.id);
    console.log('PASS calendar conversion keeps stable event/material identity without merging different events');

    const s = fixture(); s.load('sync.js');
    for (const tool of ['pdf', 'pdf-files', 'drawing', 'hayyiz-free-spaces-v1', '__proto__', 'constructor']) {
        await s.context.hayyizUploadItem(tool, 'file', { data: '%PDF-test-only' });
        await s.context.hayyizDeleteRemoteItem(tool, 'file', { data: '%PDF-test-only' });
    }
    assert.equal(s.state.reads, 0); assert.equal(s.state.writes.length, 0);
    console.log('PASS PDF/drawing/unknown tools never enter the cloud transport');
    s.values.set('hayyiz-notes', JSON.stringify([{ id: 'note', title: 'محلي', content: 'نص', updated: Date.now() }]));
    assert.equal(s.context.hayyizGetSyncStatus('notes').state, 'local');
    await s.context.hayyizSyncTool('notes');
    assert.equal(s.context.hayyizGetSyncStatus('notes').state, 'synced');
    s.state.fail = true; await s.context.hayyizSyncTool('notes');
    assert.equal(s.context.hayyizGetSyncStatus('notes').state, 'error');
    assert.equal(JSON.parse(s.values.get('hayyiz-notes'))[0].content, 'نص');
    console.log('PASS synchronization reports server failure while retaining the local note');
    s.state.fail = false;
    const cursor = s.values.get('hayyiz-sync-last-time-notes');
    s.state.rows = [{ item_id: 'note', data: { id: 'note', content: 'سحابي أحدث', updated: Date.now() + 1000 }, updated_at: new Date(Date.now() + 1000).toISOString() }];
    s.state.quota = true; await s.context.hayyizSyncTool('notes');
    assert.equal(s.context.hayyizGetSyncStatus('notes').state, 'error');
    assert.equal(s.values.get('hayyiz-sync-last-time-notes'), cursor, 'A failed local write cannot advance the download cursor');
    assert.equal(JSON.parse(s.values.get('hayyiz-notes'))[0].content, 'نص');
    console.log('PASS local quota failure preserves the prior value and sync cursor');
})().catch(error => { console.error(error); process.exitCode = 1; });
