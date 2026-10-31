const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function localStore(initial = {}) {
    const data = new Map(Object.entries(initial));
    return { data, failOnceKey: null,
        getItem(key) { return data.has(key) ? data.get(key) : null; },
        setItem(key, value) {
            if (this.failOnceKey === key) { this.failOnceKey = null; throw new Error('Local quota exceeded'); }
            data.set(key, String(value));
        },
        removeItem(key) { data.delete(key); }, key(index) { return Array.from(data.keys())[index] ?? null; },
        get length() { return data.size; }
    };
}
function memoryIndexedDb() {
    const databases = new Map(), opened = [];
    const controls = { failNextPut: false, failCommit: false };
    function dbStore(name) {
        if (!databases.has(name)) databases.set(name, new Map());
        return databases.get(name);
    }
    return { databases, opened, controls,
        seed(name, record) { dbStore(name).set(record.spaceId, structuredClone(record)); },
        open(name) {
            opened.push(name);
            const request = {};
            queueMicrotask(() => {
                const existing = databases.has(name);
                const data = dbStore(name);
                request.result = {
                    objectStoreNames: { contains() { return true; } }, createObjectStore() {}, close() {},
                    transaction(storeName, mode) {
                        assert.equal(storeName, 'pdf_blobs');
                        const staged = new Map(Array.from(data, ([key, value]) => [key, structuredClone(value)]));
                        let pending = 0, aborted = false, completed = false;
                        const transaction = { error: null,
                            abort() {
                                if (aborted || completed) return;
                                aborted = true;
                                queueMicrotask(() => transaction.onabort?.());
                            },
                            objectStore() {
                                function operation(run) {
                                    const item = {};
                                    pending++;
                                    queueMicrotask(() => {
                                        if (aborted) return;
                                        try { item.result = run(); item.onsuccess?.({ target: item }); }
                                        catch (error) { transaction.error = error; transaction.abort(); }
                                        pending--;
                                        queueMicrotask(() => {
                                            if (pending || aborted || completed) return;
                                            if (controls.failCommit && mode === 'readwrite') {
                                                controls.failCommit = false; transaction.error = new Error('IndexedDB commit failed'); transaction.abort(); return;
                                            }
                                            completed = true;
                                            if (mode === 'readwrite') {
                                                data.clear(); staged.forEach((value, key) => data.set(key, value));
                                            }
                                            transaction.oncomplete?.();
                                        });
                                    });
                                    return item;
                                }
                                return {
                                    get(key) { return operation(() => staged.has(key) ? structuredClone(staged.get(key)) : undefined); },
                                    put(record) { return operation(() => {
                                        if (controls.failNextPut) { controls.failNextPut = false; throw new Error('IndexedDB quota exceeded'); }
                                        staged.set(record.spaceId, structuredClone(record)); return record.spaceId;
                                    }); }
                                };
                            }
                        };
                        return transaction;
                    }
                };
                if (!existing) request.onupgradeneeded?.({ target: request });
                request.onsuccess?.({ target: request });
            });
            return request;
        }
    };
}
function device(initial = {}) {
    const storage = localStore(initial), indexedDB = memoryIndexedDb();
    const context = vm.createContext({ console, localStorage: storage, indexedDB, ArrayBuffer, Uint8Array,
        document: { addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; } },
        navigator: {}, btoa: text => Buffer.from(text, 'binary').toString('base64'),
        atob: text => Buffer.from(text, 'base64').toString('binary'), setTimeout, clearTimeout, URL, Blob });
    context.window = context;
    vm.runInContext(fs.readFileSync('common.js', 'utf8'), context);
    vm.runInContext(fs.readFileSync('backup.js', 'utf8'), context);
    return { context, storage, indexedDB };
}
function drawing(id = 'space-a', hasPdf = true) {
    return JSON.stringify({ spaces: [{ id, name: 'شرح الدرس', updated: 1, pageIndex: 0, bgStyle: 'plain',
        metadata: hasPdf ? { pdf: { fileName: 'lesson.pdf', pageCount: 1 } } : {},
        pages: [{ strokes: [{ tool: 'pen', color: '#000000', size: 2, points: [{ x: 0, y: 2, pressure: 0.5 }] }],
            texts: [{ id: 'text-a', text: 'فكرة مهمة', x: 3, y: 4, size: 18 }] }] }] });
}
function pdf(text = 'lesson') { return Uint8Array.from(Buffer.from('%PDF-1.7\n' + text)).buffer; }
function json(value) { return JSON.parse(JSON.stringify(value)); }
let checks = 0;
async function check(name, run) { await run(); checks++; console.log('PASS ' + name); }

(async () => {
    await check('A complete v3 backup round-trips drawing geometry, text and PDF bytes', async () => {
        const source = device({ 'hayyiz-todos': JSON.stringify([{ id: 'todo-a', text: 'اقرأ الدرس' }]),
            'hayyiz-free-spaces-v1': drawing(), 'hayyiz-draw-prefs': JSON.stringify({ penSize: 3, inputMode: 'pen-only' }) });
        source.indexedDB.seed('hayyiz-pdf-db', { spaceId: 'space-a', fileName: 'lesson.pdf', data: pdf(), updated: 1 });
        const archive = await source.context.hayyizCreateBackup();
        assert.equal(archive.version, 3); assert.equal(archive.pdfFiles.length, 1);
        const target = device();
        const result = await target.context.hayyizRestoreBackup(json(archive));
        assert.equal(result.pdfCount, 1);
        assert.equal(target.storage.getItem('hayyiz-free-spaces-v1'), source.storage.getItem('hayyiz-free-spaces-v1'));
        assert.equal(target.storage.getItem('hayyiz-draw-prefs'), source.storage.getItem('hayyiz-draw-prefs'));
        const saved = target.indexedDB.databases.get('hayyiz-pdf-db').get('space-a');
        assert.deepEqual(Buffer.from(saved.data), Buffer.from(pdf()));
    });
    await check('Legacy v2 backups restore without IndexedDB and omit auth, identity and account queues', async () => {
        const target = device(); target.context.indexedDB = undefined;
        target.context.HAYYIZ_ALLOWED_BACKUP_KEYS.push('hayyiz-workspace-focus-outbox');
        const restoredAfter = Date.now();
        await target.context.hayyizRestoreBackup({ version: 2, keys: {
            'hayyiz-notes': JSON.stringify([{ id: 'n', content: 'درس', user_id: 'wrong-user', admin: true }]),
            'sb-project-auth-token': 'PRIVATE_TOKEN', 'hayyiz-workspace-focus-outbox': '[{"userId":"other-account"}]',
            'hayyiz-account:other:hayyiz-notes': 'PRIVATE_NOTE'
        } });
        const notes = JSON.parse(target.storage.getItem('hayyiz-notes'));
        assert(notes[0].updated >= restoredAfter, 'Restoration is a new edit for cloud conflict resolution');
        assert.deepEqual(notes.map(({ updated, ...note }) => note), [{ id: 'n', content: 'درس' }]);
        assert.equal(target.storage.getItem('sb-project-auth-token'), null);
        assert.equal(target.storage.getItem('hayyiz-workspace-focus-outbox'), null);
        const archive = await target.context.hayyizCreateBackup();
        assert(!Object.keys(archive.keys).some(key => key.includes('auth-token') || key.includes('outbox') || key.includes('other')));
    });
    await check('Active-account backups use its storage facade and its PDF database', async () => {
        const d = device({ 'hayyiz-notes': '[{"id":"guest","content":"guest-only"}]' });
        const account = localStore({ 'hayyiz-notes': '[{"id":"mine","content":"my-only"}]', 'hayyiz-free-spaces-v1': drawing() });
        account.databaseName = name => name + '--user-a'; d.context.hayyizStorage = account;
        d.indexedDB.seed('hayyiz-pdf-db', { spaceId: 'space-a', fileName: 'guest.pdf', data: pdf('guest'), updated: 1 });
        d.indexedDB.seed('hayyiz-pdf-db--user-a', { spaceId: 'space-a', fileName: 'mine.pdf', data: pdf('mine'), updated: 1 });
        const archive = await d.context.hayyizCreateBackup();
        assert(archive.keys['hayyiz-notes'].includes('my-only')); assert(!JSON.stringify(archive).includes('guest-only'));
        assert.equal(archive.pdfFiles[0].fileName, 'mine.pdf');
        assert.deepEqual(d.indexedDB.opened, ['hayyiz-pdf-db--user-a']);
        const guest = await d.context.hayyizCreateBackupFromStorage(d.storage, 'hayyiz-pdf-db');
        assert(guest.keys['hayyiz-notes'].includes('guest-only'));
    });
    await check('A missing source PDF is reported without discarding the saved drawing', async () => {
        const d = device({ 'hayyiz-free-spaces-v1': drawing() });
        const archive = await d.context.hayyizCreateBackup();
        assert.deepEqual(Array.from(archive.missingPdfIds), ['space-a']);
        const info = d.context.hayyizValidateBackup(json(archive));
        assert.deepEqual(Array.from(info.missingPdfIds), ['space-a']);
        assert.equal(archive.keys['hayyiz-free-spaces-v1'], drawing());
    });
    await check('Restoring an incomplete archive keeps annotations without attaching an unrelated local PDF', async () => {
        const target = device();
        target.indexedDB.seed('hayyiz-pdf-db', { spaceId: 'space-a', fileName: 'unrelated.pdf', data: pdf('unrelated'), updated: 1 });
        const result = await target.context.hayyizRestoreBackup({ version: 3, keys: { 'hayyiz-free-spaces-v1': drawing() }, pdfFiles: [] });
        const restored = JSON.parse(target.storage.getItem('hayyiz-free-spaces-v1')).spaces[0];
        assert.equal(restored.metadata.pdf, undefined);
        assert.equal(restored.pages[0].texts[0].text, 'فكرة مهمة');
        assert.equal(restored.pages[0].strokes[0].points[0].y, 2);
        assert.equal(target.indexedDB.databases.get('hayyiz-pdf-db').get('space-a').fileName, 'unrelated.pdf');
        assert.deepEqual(Array.from(result.missingPdfIds), ['space-a']);
    });
    await check('Import rejects oversized drawing strokes before restoring a hostile backup', async () => {
        const d = device();
        const value = JSON.parse(drawing());
        value.spaces[0].pages[0].strokes[0].points =
            Array.from({ length: 20001 }, (_, i) => ({ x: i, y: i, pressure: 0.5 }));
        const archive = { version: 3, keys: { 'hayyiz-free-spaces-v1': JSON.stringify(value) }, pdfFiles: [] };
        assert.throws(() => d.context.hayyizValidateBackup(archive), /عدد نقاط يتجاوز الحد الآمن/);
    });
    await check('Import rejects out-of-range coordinates and invalid stylus pressure', async () => {
        const d = device();
        const value = JSON.parse(drawing());
        value.spaces[0].pages[0].strokes[0].points[0] = { x: 1e20, y: 0, pressure: 2 };
        const archive = { version: 3, keys: { 'hayyiz-free-spaces-v1': JSON.stringify(value) }, pdfFiles: [] };
        assert.throws(() => d.context.hayyizValidateBackup(archive), /إحداثيات أو ضغط قلم غير صالح/);
    });
    await check('Strict import geometry limits do not block export of existing local drawings', async () => {
        const value = JSON.parse(drawing());
        value.spaces[0].pages[0].strokes[0].points =
            Array.from({ length: 20001 }, (_, i) => ({ x: i, y: i, pressure: 0.5 }));
        const d = device({ 'hayyiz-free-spaces-v1': JSON.stringify(value) });
        const archive = await d.context.hayyizCreateBackup();
        assert.equal(JSON.parse(archive.keys['hayyiz-free-spaces-v1']).spaces[0].pages[0].strokes[0].points.length, 20001);
    });
    await check('An export cannot exceed the local-data limit accepted by its importer', async () => {
        const large = 'x'.repeat(4 * 1024 * 1024 + 1);
        const d = device({ 'hayyiz-current-task': large, 'hayyiz-birthdate': large });
        await assert.rejects(d.context.hayyizCreateBackup(), /حجم البيانات المحلية/);
        assert.equal(d.storage.getItem('hayyiz-current-task'), large);
    });
    await check('A blocked database request closes its abandoned connection if it later succeeds', async () => {
        const d = device({ 'hayyiz-free-spaces-v1': drawing() });
        let closed = false;
        d.context.indexedDB = { open() {
            const request = { result: { close() { closed = true; } } };
            queueMicrotask(() => { request.onblocked(); queueMicrotask(() => request.onsuccess()); });
            return request;
        } };
        await assert.rejects(d.context.hayyizCreateBackup(), /أغلق مساحة الكتابة/);
        assert.equal(closed, true);
    });
    await check('Older drawing data is exported compatibly without deleting its source', async () => {
        const old = JSON.stringify({ pages: [{ strokes: [{ tool: 'pen', size: 2, color: '#000', points: [{ x: 1, y: 2 }] }],
            texts: [{ text: 'قديم', x: 5, y: 6 }] }], pageIndex: 0 });
        const source = device({ 'hayyiz-free-notes-v2': old });
        const archive = await source.context.hayyizCreateBackup();
        assert.equal(source.storage.getItem('hayyiz-free-notes-v2'), old);
        assert.equal(source.storage.getItem('hayyiz-free-spaces-v1'), null);
        const restored = JSON.parse(archive.keys['hayyiz-free-spaces-v1']);
        assert.equal(restored.spaces[0].pages[0].texts[0].text, 'قديم');
        assert.equal(restored.spaces[0].pages[0].strokes[0].points[0].x, 1);
        const target = device(); await target.context.hayyizRestoreBackup(json(archive));
        assert.equal(target.storage.getItem('hayyiz-free-spaces-v1'), archive.keys['hayyiz-free-spaces-v1']);
    });
    await check('Invalid PDF bytes, foreign PDF IDs and malformed drawing shapes reject before any write', async () => {
        for (const modify of [
            archive => { archive.pdfFiles[0].data = Buffer.from('not a PDF').toString('base64'); },
            archive => { archive.pdfFiles[0].id = 'foreign-space'; },
            archive => { archive.keys['hayyiz-free-spaces-v1'] = '{"spaces":[{"id":"broken","name":"x","pages":null}]}'; },
            archive => { archive.pdfFiles[0].data = 'A'.repeat(Math.ceil((25 * 1024 * 1024) / 3) * 4 + 4); }
        ]) {
            const d = device({ 'hayyiz-notes': '[{"id":"keep","content":"unchanged"}]' });
            const archive = { version: 3, keys: { 'hayyiz-notes': '[{"id":"new","content":"new"}]', 'hayyiz-free-spaces-v1': drawing() },
                pdfFiles: [{ id: 'space-a', fileName: 'lesson.pdf', data: Buffer.from(pdf()).toString('base64') }] };
            modify(archive); await assert.rejects(d.context.hayyizRestoreBackup(archive));
            assert.equal(d.storage.getItem('hayyiz-notes'), '[{"id":"keep","content":"unchanged"}]');
            assert.equal(d.indexedDB.opened.length, 0);
        }
    });
    await check('Dangerous nested fields are stripped and excessive nesting fails safely', async () => {
        const d = device();
        const malicious = '[{"id":"n","content":"safe","__proto__":{"polluted":true},"constructor":{"admin":true},"metadata":{"roles":["owner"]}}]';
        await d.context.hayyizRestoreBackup({ version: 2, keys: { 'hayyiz-notes': malicious } });
        const restored = JSON.parse(d.storage.getItem('hayyiz-notes'));
        assert.equal(restored[0].__proto__.polluted, undefined); assert.equal(restored[0].metadata.roles, undefined);
        const deep = '{"x":'.repeat(45) + '{}' + '}'.repeat(45);
        await assert.rejects(d.context.hayyizRestoreBackup({ version: 2, keys: { 'hayyiz-planning-preferences': deep } }));
    });
    await check('LocalStorage failure aborts PDF changes and restores all previously stored values', async () => {
        const d = device({ 'hayyiz-notes': '[{"id":"old","content":"old"}]', 'hayyiz-free-spaces-v1': drawing('old-space', false) });
        const before = Object.fromEntries(d.storage.data);
        d.indexedDB.seed('hayyiz-pdf-db', { spaceId: 'space-a', fileName: 'old.pdf', data: pdf('old-file'), updated: 1 });
        d.storage.failOnceKey = 'hayyiz-free-spaces-v1';
        await assert.rejects(d.context.hayyizRestoreBackup({ version: 3,
            keys: { 'hayyiz-notes': '[{"id":"new","content":"new"}]', 'hayyiz-free-spaces-v1': drawing() },
            pdfFiles: [{ id: 'space-a', fileName: 'new.pdf', data: Buffer.from(pdf('new-file')).toString('base64') }] }));
        assert.deepEqual(Object.fromEntries(d.storage.data), before);
        assert.equal(d.indexedDB.databases.get('hayyiz-pdf-db').get('space-a').fileName, 'old.pdf');
    });
    await check('A PDF transaction failure rolls back local values, including commit failures', async () => {
        for (const failure of ['failNextPut', 'failCommit']) {
            const d = device({ 'hayyiz-notes': '[{"id":"old","content":"old"}]',
                'hayyiz-sync-last-time-notes': '2026-10-21T12:00:00.000Z',
                'hayyiz-deleted-items': '{"notes:previous-deletion":{"timestamp":100}}' });
            const before = Object.fromEntries(d.storage.data);
            d.indexedDB.controls[failure] = true;
            await assert.rejects(d.context.hayyizRestoreBackup({ version: 3,
                keys: { 'hayyiz-notes': '[{"id":"new","content":"new"}]', 'hayyiz-free-spaces-v1': drawing() },
                pdfFiles: [{ id: 'space-a', fileName: 'new.pdf', data: Buffer.from(pdf()).toString('base64') }] }));
            assert.deepEqual(Object.fromEntries(d.storage.data), before, 'The same rollback includes sync cursors and generated tombstones');
            assert.equal(d.storage.getItem('hayyiz-free-spaces-v1'), null);
            assert.equal(d.indexedDB.databases.get('hayyiz-pdf-db').size, 0);
        }
    });
    await check('v2 local-only imports also roll back a partial quota failure', async () => {
        const d = device({ 'hayyiz-notes': '[{"id":"old","content":"old"}]', 'hayyiz-habits': '[{"id":"h","name":"read"}]' });
        const before = Object.fromEntries(d.storage.data); d.storage.failOnceKey = 'hayyiz-habits';
        await assert.rejects(d.context.hayyizRestoreBackup({ version: 2, keys: {
            'hayyiz-notes': '[{"id":"new","content":"new"}]', 'hayyiz-habits': '[{"id":"new-habit","name":"new"}]'
        } }));
        assert.deepEqual(Object.fromEntries(d.storage.data), before);
    });
    await check('A restored value wins over its older cloud row while omitted current rows stay deleted', async () => {
        const cloudTime = Date.now() - 10000;
        const d = device({ 'hayyiz-notes': JSON.stringify([
            { id: 'restored', content: 'current before restore', updated: cloudTime }, { id: 'omitted', content: 'omit this', updated: cloudTime }
        ]), 'hayyiz-sync-last-time-notes': new Date(cloudTime).toISOString(),
            'hayyiz-deleted-items': JSON.stringify({ 'notes:restored': { timestamp: cloudTime } }) });
        const timestamp = '2021-06-01T12:00:00.000Z', before = Date.now();
        await d.context.hayyizRestoreBackup({ version: 2, keys: {
            'hayyiz-notes': JSON.stringify([{ id: 'restored', content: 'chosen backup content', updated: 100 }]),
            'hayyiz-focus-sessions-log': JSON.stringify([{ id: 'old-session', date: '2021-06-01', timestamp, durationMinutes: 25, mode: 'focus' }])
        } });
        const notes = JSON.parse(d.storage.getItem('hayyiz-notes')), session = JSON.parse(d.storage.getItem('hayyiz-focus-sessions-log'))[0];
        assert(notes[0].updated >= before);assert(session.updated >= before);
        assert.equal(session.timestamp, timestamp, 'A sync edit clock cannot change the actual session date');
        assert.equal(session.date, '2021-06-01');assert.equal(d.storage.getItem('hayyiz-sync-last-time-notes'), '');
        d.context.addEventListener = () => {};
        vm.runInContext(fs.readFileSync('sync.js', 'utf8'), d.context, { filename: 'sync.js' });
        const result = d.context.hayyizMergeLocalAndRemoteNotes(notes, [
            { item_id: 'restored', data: { id: 'restored', content: 'old cloud content', updated: cloudTime }, updated_at: new Date(cloudTime).toISOString() },
            { item_id: 'omitted', data: { id: 'omitted', content: 'old cloud omitted row', updated: cloudTime }, updated_at: new Date(cloudTime).toISOString() }
        ]);
        assert.deepEqual(json(result.mergedList).map(note => note.content), ['chosen backup content']);
        assert.equal(result.uploads[0].id, 'restored');assert.equal(result.tombstonesToPush[0].id, 'omitted');
    });
    await check('Restoring singleton tools clears their previous deletion markers', async () => {
        const tombstones = {
            'gpa-snapshot:snapshot': 100, 'academic-goal:goal': 100, 'daily-goal:goal': 100,
            'planning-preferences:preferences': 100, 'multi-day-plans:plans': 100, 'day-reviews:reviews': 100,
            'birthdate:birthdate': 100, 'pomodoro-prefs:prefs': 100, 'focus-history:history': 100,
            'notes:unrelated': 100
        };
        const d = device({ 'hayyiz-deleted-items': JSON.stringify(tombstones) });
        await d.context.hayyizRestoreBackup({ version: 3, keys: {
            'hayyiz-gpa-snapshot': '{"value":4}', 'hayyiz-academic-goal': '{"target":90}', 'hayyiz-daily-goal': '{"minutes":60}',
            'hayyiz-planning-preferences': '{"defaultMinutes":90}', 'hayyiz-multi-day-plans': '{}', 'hayyiz-day-reviews': '{}',
            'hayyiz-birthdate': '2007-01-01', 'hayyiz-pref-work': '45', 'hayyiz-focus-history': '{"2026-10-22":25}'
        } });
        assert.deepEqual(JSON.parse(d.storage.getItem('hayyiz-deleted-items')), { 'notes:unrelated': 100 });
    });
    await check('A late local quota failure rolls back restored data and every prepared sync metadata key', async () => {
        const d = device({ 'hayyiz-notes': '[{"id":"old","content":"old"}]', 'hayyiz-birthdate': '2006-01-01',
            'hayyiz-birthdate-updated': '123', 'hayyiz-pref-work': '25', 'hayyiz-pomodoro-prefs-updated': '456',
            'hayyiz-focus-history': '{"2026-10-22":10}', 'hayyiz-focus-history-updated': '789',
            'hayyiz-sync-last-time-notes': '2026-10-21T12:00:00.000Z', 'hayyiz-sync-last-time-birthdate': '2026-10-21T12:00:00.000Z',
            'hayyiz-deleted-items': '{"notes:existing-deletion":100}' });
        const before = Object.fromEntries(d.storage.data);d.storage.failOnceKey = 'hayyiz-deleted-items';
        await assert.rejects(d.context.hayyizRestoreBackup({ version: 3, keys: {
            'hayyiz-notes': '[{"id":"new","content":"new"}]', 'hayyiz-birthdate': '2008-02-02', 'hayyiz-pref-work': '45',
            'hayyiz-focus-history': '{"2026-10-22":25}'
        } }));
        assert.deepEqual(Object.fromEntries(d.storage.data), before);
    });

    await check('Actual service worker serves known shell aliases and query routes offline without caching private URLs', async () => {
        const handlers = {}, entries = new Map(), writes = [], waits = [];
        const origin = 'https://hayyze.pages.dev';
        let offline = true;
        function key(request) { return new URL(typeof request === 'string' ? request : request.url, origin + '/').href; }
        const cache = {
            async addAll(assets) {
                assets.forEach(asset => entries.set(key(asset), { text: '<main>' + key(asset) + '</main>', redirected: asset.endsWith('.html') }));
            },
            async put(request, response) { writes.push(key(request)); entries.set(key(request), { text: await response.text(), redirected: false }); }
        };
        const context = vm.createContext({ console: { log() {} }, URL, Response,
            self: { location: { href: origin + '/sw.js' }, addEventListener(name, fn) { handlers[name] = fn; }, async skipWaiting() {}, clients: { async claim() {} } },
            caches: { async open() { return cache; }, async keys() { return ['heez-v1.11.0']; }, async delete() {},
                async match(request) {
                    const entry = entries.get(key(request)); if (!entry) return undefined;
                    const response = new Response(entry.text, { headers: { 'Content-Security-Policy': "default-src 'self'" } });
                    if (entry.redirected) Object.defineProperty(response, 'redirected', { value: true });
                    return response;
                }
            },
            async fetch(request) { if (offline) throw new Error('offline'); return new Response('<main>fresh</main>'); }
        });
        vm.runInContext(fs.readFileSync('sw.js', 'utf8'), context);
        let installation; handlers.install({ waitUntil(promise) { installation = promise; } }); await installation;
        async function navigate(path, destination = 'document') {
            let promise;
            handlers.fetch({ request: { method: 'GET', destination, url: origin + path, headers: { get() { return 'text/html'; } } },
                respondWith(value) { promise = value; }, waitUntil(value) { waits.push(value); } });
            return promise ? await promise : null;
        }
        for (const [path, canonical] of [
            ['/pomodoro.html?task=PRIVATE&taskId=a', '/pomodoro.html'], ['/pomodoro?task=PRIVATE', '/pomodoro.html'],
            ['/subject.html?id=subject-a', '/subject.html'], ['/notes?title=PRIVATE', '/notes.html'],
            ['/index?return=PRIVATE', '/index.html'], ['/', '/index.html']
        ]) {
            const response = await navigate(path); assert.equal(response.status, 200); assert.equal(response.redirected, false);
            assert.equal(response.headers.get('Content-Security-Policy'), "default-src 'self'");
            assert.equal(await response.text(), '<main>' + origin + canonical + '</main>');
        }
        entries.set(origin + '/unknown?private=yes', { text: 'old unrelated cached data' });
        assert.equal((await navigate('/unknown?private=yes')).status, 503);
        assert.equal(await navigate('/rest/v1/sync_items?tool=notes', ''), null);
        assert.equal(await navigate('/api/private', ''), null);
        assert.equal(writes.length, 0);
        offline = false;
        await navigate('/pomodoro?task=PRIVATE'); await Promise.all(waits);
        assert.deepEqual(writes, [origin + '/pomodoro.html']);
        assert(!Array.from(entries.keys()).some(url => url.includes('task=PRIVATE')));
    });
    console.log(checks + ' offline and backup integrity checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
