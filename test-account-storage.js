const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('account-storage.js', 'utf8');
const authKey = 'sb-dzfdbjnqtgltuguqqdkz-auth-token';
const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const accountKey = (id, key) => 'hayyiz-account:' + encodeURIComponent(id) + ':' + key;

class NativeStorage {
    constructor(initial = {}) { this.data = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)])); }
    getItem(key) { return this.data.get(String(key)) ?? null; }
    setItem(key, value) { this.data.set(String(key), String(value)); }
    removeItem(key) { this.data.delete(String(key)); }
    key(index) { return Array.from(this.data.keys())[index] ?? null; }
    get length() { return this.data.size; }
    clear() { this.data.clear(); }
}

function session(id, extra = {}) { return { access_token: 'test-only', user: { id }, ...extra }; }
function setUser(storage, id) {
    if (id === null) storage.removeItem(authKey);
    else storage.setItem(authKey, JSON.stringify(session(id)));
}
function tab(native) {
    const listeners = new Map(), events = [];
    let reloads = 0;
    const context = vm.createContext({
        localStorage: native, console,
        crypto: { randomUUID: () => 'device-on-this-browser' },
        Event: class { constructor(type) { this.type = type; } },
        location: { reload() { reloads++; } },
        addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(callback); },
        dispatchEvent(event) {
            events.push(event.type);
            for (const callback of listeners.get(event.type) || []) callback(event);
            return true;
        }
    });
    context.window = context;
    vm.runInContext(source, context, { filename: 'account-storage.js' });
    const storage = context.hayyizStorage;
    return {
        context, storage, events, get reloads() { return reloads; },
        storageEvent(key) { context.dispatchEvent({ type: 'storage', key }); },
        keys() { return Array.from({ length: storage.length }, (_, index) => storage.key(index)); }
    };
}

let failures = 0;
function check(name, run) {
    try { run(); console.log('PASS ' + name); }
    catch (error) { failures++; console.error('FAIL ' + name); console.error(error); }
}

check('existing guest keys remain intact and are never assigned automatically to a login', () => {
    const initial = {
        'hayyiz-todos': '[{"id":"legacy-task","text":"private legacy work"}]',
        'hayyiz-notes': '[{"id":"legacy-note","content":"private legacy note"}]',
        'hayyiz-birthdate': '2008-01-31',
        'hayyiz-focus-history': '{"2026-10-22":25}',
        'hayyiz-sync-last-time-notes': '2026-10-22T09:00:00.000Z',
        'hayyiz-theme': 'dark'
    };
    const native = new NativeStorage(initial), guest = tab(native);
    assert.equal(guest.storage.accountId, null);
    assert.equal(guest.storage.scope, 'guest');
    for (const [key, value] of Object.entries(initial)) {
        assert.equal(native.getItem(key), value);
        assert.equal(guest.storage.getItem(key), value);
    }
    setUser(native, userA);
    const a = tab(native);
    for (const [key, value] of Object.entries(initial)) {
        assert.equal(native.getItem(key), value);
        assert.equal(a.storage.getItem(key), key === 'hayyiz-theme' ? value : null);
    }
    assert.equal(a.storage.guestSnapshot()['hayyiz-todos'], initial['hayyiz-todos']);
    assert.equal(native.getItem(accountKey(userA, 'hayyiz-todos')), null);
    setUser(native, userB);
    const b = tab(native);
    assert.equal(b.storage.getItem('hayyiz-notes'), null);
    assert.equal(native.getItem('hayyiz-notes'), initial['hayyiz-notes']);
});

check('two documents keep tasks, birthdate, pending uploads and sync cursors in separate accounts', () => {
    const native = new NativeStorage();
    setUser(native, userA); const a = tab(native);
    setUser(native, userB); const b = tab(native);
    const privateKeys = ['hayyiz-todos', 'hayyiz-notes', 'hayyiz-birthdate', 'hayyiz-deleted-items',
        'hayyiz-focus-history-state', 'hayyiz-workspace-focus-outbox', 'hayyiz-sync-last-time-notes',
        'hayyiz-pomodoro-state', 'hayyiz-planner-draft', 'hayyiz-free-spaces-v1', 'hayyiz-note-draft'];
    for (const key of privateKeys) {
        a.storage.setItem(key, 'private A: ' + key);
        b.storage.setItem(key, 'private B: ' + key);
        assert.equal(a.storage.getItem(key), 'private A: ' + key);
        assert.equal(b.storage.getItem(key), 'private B: ' + key);
        assert.equal(native.getItem(key), null);
        assert.equal(native.getItem(accountKey(userA, key)), 'private A: ' + key);
        assert.equal(native.getItem(accountKey(userB, key)), 'private B: ' + key);
    }
    a.storage.removeItem('hayyiz-birthdate');
    assert.equal(a.storage.getItem('hayyiz-birthdate'), null);
    assert.equal(b.storage.getItem('hayyiz-birthdate'), 'private B: hayyiz-birthdate');
    setUser(native, userA);
    const restored = tab(native);
    assert.equal(restored.storage.getItem('hayyiz-workspace-focus-outbox'), 'private A: hayyiz-workspace-focus-outbox');
});

check('theme, device identity and game high score remain shared without sharing private data', () => {
    const native = new NativeStorage();
    const guest = tab(native);
    guest.storage.setItem('hayyiz-theme', 'dark');
    guest.storage.setItem('hayyiz-highscore', 100);
    const device = guest.storage.deviceId();
    setUser(native, userA); const a = tab(native);
    setUser(native, userB); const b = tab(native);
    assert.equal(a.storage.getItem('hayyiz-theme'), 'dark');
    assert.equal(b.storage.getItem('hayyiz-highscore'), '100');
    assert.equal(a.storage.deviceId(), device); assert.equal(b.storage.deviceId(), device);
    b.storage.setItem('hayyiz-theme', 'light');
    assert.equal(a.storage.getItem('hayyiz-theme'), 'light');
    assert.equal(native.getItem(accountKey(userA, 'hayyiz-theme')), null);
    assert.equal(native.getItem(accountKey(userB, 'hayyiz-device-id')), null);
});

check('key enumeration and length expose only the current private area plus shared keys', () => {
    const native = new NativeStorage({
        'hayyiz-notes': 'guest note', 'hayyiz-theme': 'dark', 'third-party-setting': 'unchanged',
        [accountKey(userB, 'hayyiz-notes')]: 'B note'
    });
    setUser(native, userA); const a = tab(native);
    a.storage.setItem('hayyiz-todos', 'A task');
    const keys = a.keys();
    assert(keys.includes('hayyiz-todos'));
    assert(keys.includes('hayyiz-theme'));
    assert(!keys.includes('hayyiz-notes'));
    assert(!keys.some(key => key.startsWith('hayyiz-account:')));
    assert.equal(a.storage.length, keys.length);
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(a.storage.key(-1), null);
    assert.equal(a.storage.key(a.storage.length), null);
    a.storage.clear();
    assert.equal(a.storage.getItem('hayyiz-todos'), null);
    assert.equal(native.getItem('hayyiz-notes'), 'guest note');
    assert.equal(native.getItem(accountKey(userB, 'hayyiz-notes')), 'B note');
    assert.equal(native.getItem('hayyiz-theme'), 'dark');
    assert.equal(native.getItem('third-party-setting'), 'unchanged');
    assert.equal(JSON.parse(native.getItem(authKey)).user.id, userA);
});

check('guest clear cannot delete an account, its SDK session or shared preferences', () => {
    const native = new NativeStorage({
        'hayyiz-todos': 'guest task', 'hayyiz-theme': 'dark', 'hayyiz-highscore': '80',
        'hayyiz-device-id': 'stable-device', [accountKey(userA, 'hayyiz-todos')]: 'A task'
    });
    const guest = tab(native);
    setUser(native, userA);
    guest.storage.clear();
    assert.equal(native.getItem('hayyiz-todos'), null);
    assert.equal(native.getItem(accountKey(userA, 'hayyiz-todos')), 'A task');
    assert.equal(native.getItem('hayyiz-theme'), 'dark');
    assert.equal(native.getItem('hayyiz-highscore'), '80');
    assert.equal(native.getItem('hayyiz-device-id'), 'stable-device');
    assert.equal(JSON.parse(native.getItem(authKey)).user.id, userA);
});

check('guestSnapshot contains only unscoped personal data and never private account names', () => {
    const native = new NativeStorage({
        'hayyiz-notes': 'legacy note', 'hayyiz-birthdate': '2008-01-31',
        'hayyiz-theme': 'dark', 'hayyiz-device-id': 'device',
        [accountKey(userA, 'hayyiz-notes')]: 'A note', [accountKey(userB, 'hayyiz-notes')]: 'B note',
        'unrelated-native-key': 'unrelated'
    });
    setUser(native, userA); const a = tab(native);
    const snapshot = a.storage.guestSnapshot();
    assert.deepEqual(Object.keys(snapshot).sort(), ['hayyiz-birthdate', 'hayyiz-notes']);
    assert.equal(snapshot['hayyiz-notes'], 'legacy note');
    assert.equal(Object.getPrototypeOf(snapshot), null);
    snapshot['hayyiz-notes'] = 'changed copy';
    assert.equal(native.getItem('hayyiz-notes'), 'legacy note');
});

check('reserved physical names cannot bypass the logical facade to access another account', () => {
    const physicalB = accountKey(userB, 'hayyiz-notes');
    const native = new NativeStorage({ [physicalB]: 'B private' });
    setUser(native, userA); const a = tab(native);
    for (const operation of [
        () => a.storage.getItem(physicalB),
        () => a.storage.setItem(physicalB, 'overwrite'),
        () => a.storage.removeItem(physicalB)
    ]) assert.throws(operation, error => error.name === 'TypeError');
    assert.equal(native.getItem(physicalB), 'B private');
    setUser(native, null); const guest = tab(native);
    assert.throws(() => guest.storage.getItem(physicalB), error => error.name === 'TypeError');
    assert.throws(() => guest.storage.removeItem(physicalB), error => error.name === 'TypeError');
    assert.equal(native.getItem(physicalB), 'B private');
});

check('PDF database names isolate accounts while preserving the original guest database', () => {
    const native = new NativeStorage(); const guest = tab(native);
    setUser(native, userA); const a = tab(native);
    setUser(native, userB); const b = tab(native);
    assert.equal(guest.storage.databaseName('hayyiz-pdf-db'), 'hayyiz-pdf-db');
    assert.equal(a.storage.databaseName('hayyiz-pdf-db'), 'hayyiz-pdf-db--' + userA);
    assert.notEqual(a.storage.databaseName('hayyiz-pdf-db'), b.storage.databaseName('hayyiz-pdf-db'));
});

check('an account transition reloads once and leaves unload writers bound to the original account', () => {
    const native = new NativeStorage(); setUser(native, userA); const a = tab(native);
    a.storage.setItem('hayyiz-pomodoro-state', 'old running A');
    assert.equal(a.storage.transitionTo(userA), false); assert.equal(a.reloads, 0);
    assert(a.storage.isCurrentUser(userA)); assert(a.storage.isCurrentScope('user:' + userA));
    setUser(native, userB); const b = tab(native);
    b.storage.setItem('hayyiz-pomodoro-state', 'running B');
    assert.equal(a.storage.transitionTo(userB), true);
    assert.equal(a.storage.transitionTo(userB), true);
    assert.equal(a.storage.transitionTo(null), true);
    assert.equal(a.reloads, 1);
    assert.equal(a.events.filter(type => type === 'hayyiz:account-changing').length, 1);
    assert.equal(a.storage.accountId, userA);
    assert.equal(a.storage.scope, 'user:' + userA);
    assert(!a.storage.isCurrentUser(userA)); assert(!a.storage.isCurrentScope('user:' + userA));
    a.storage.setItem('hayyiz-pomodoro-state', 'last unload state A');
    assert.equal(native.getItem(accountKey(userA, 'hayyiz-pomodoro-state')), 'last unload state A');
    assert.equal(b.storage.getItem('hayyiz-pomodoro-state'), 'running B');
    assert.equal(Object.isFrozen(a.storage), true);
});

check('a guest signing in reloads without moving legacy data into that account', () => {
    const native = new NativeStorage({ 'hayyiz-notes': 'guest secret' }); const guest = tab(native);
    setUser(native, userA); guest.storageEvent(authKey);
    assert.equal(guest.reloads, 1);
    assert(!guest.storage.isCurrentUser(null));
    guest.storage.setItem('hayyiz-note-draft', 'guest unload draft');
    const a = tab(native);
    assert.equal(a.storage.getItem('hayyiz-notes'), null);
    assert.equal(a.storage.getItem('hayyiz-note-draft'), null);
    assert.equal(native.getItem('hayyiz-note-draft'), 'guest unload draft');
});

check('cross-tab signals ignore token refresh and unrelated keys, but react to another user', () => {
    const native = new NativeStorage(); setUser(native, userA); const a = tab(native);
    native.setItem(authKey, JSON.stringify(session(userA, { access_token: 'refreshed-token' })));
    a.storageEvent(authKey); a.storageEvent('hayyiz-theme');
    native.setItem('sb-another-project-auth-token', JSON.stringify(session(userB)));
    a.storageEvent('sb-another-project-auth-token');
    assert.equal(a.reloads, 0); assert(a.storage.isCurrentUser(userA));
    setUser(native, userB); a.storageEvent(authKey); a.storageEvent(authKey);
    assert.equal(a.reloads, 1); assert(!a.storage.isCurrentUser(userA));
});

check('a native clear/logout signal invalidates outstanding work and reloads to the guest area', () => {
    const native = new NativeStorage(); setUser(native, userA); const a = tab(native);
    native.clear(); a.storageEvent(null);
    assert.equal(a.reloads, 1); assert(!a.storage.isCurrentScope('user:' + userA));
    a.storage.setItem('hayyiz-todos', 'A unload only');
    const guest = tab(native);
    assert.equal(guest.storage.accountId, null);
    assert.equal(guest.storage.getItem('hayyiz-todos'), null);
    assert.equal(native.getItem(accountKey(userA, 'hayyiz-todos')), 'A unload only');
});

check('only a valid id in the expected SDK session selects an account', () => {
    const malformed = ['{broken', 'null', '[]', '"text"',
        JSON.stringify({ access_token: 'fake-jwt', user_metadata: { id: userA } }),
        ...[undefined, null, 15, {}, [], '', 'user with spaces', 'user:admin', '../user', 'a'.repeat(129)].map(id => JSON.stringify({ user: { id } }))];
    for (const raw of malformed) {
        const native = new NativeStorage({ [authKey]: raw, 'hayyiz-account-id': userA,
            'hayyiz-account-scope': 'user:' + userA,
            'sb-another-project-auth-token': JSON.stringify(session(userA)), 'hayyiz-notes': 'guest data' });
        const fixture = tab(native);
        assert.equal(fixture.storage.accountId, null, raw);
        assert.equal(fixture.storage.scope, 'guest', raw);
        assert.equal(fixture.storage.getItem('hayyiz-notes'), 'guest data', raw);
    }
    const native = new NativeStorage(); setUser(native, userA);
    assert.equal(tab(native).storage.accountId, userA);
});

check('initializing the script twice cannot rebind an already loaded document to a new account', () => {
    const native = new NativeStorage(); setUser(native, userA); const a = tab(native);
    setUser(native, userB);
    vm.runInContext(source, a.context, { filename: 'account-storage.js' });
    assert.equal(a.context.hayyizStorage, a.storage);
    assert.equal(a.storage.accountId, userA);
    a.storageEvent(authKey); assert.equal(a.reloads, 1);
});

process.exitCode = failures ? 1 : 0;
