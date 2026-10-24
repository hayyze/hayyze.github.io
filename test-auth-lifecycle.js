const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = Object.fromEntries(['account-storage.js', 'supabase.js', 'common.js', 'sync.js', 'auth-ui.js', 'spaces.js']
    .map(file => [file, fs.readFileSync(file, 'utf8')]));
const authKey = 'sb-dzfdbjnqtgltuguqqdkz-auth-token';
const userA = { id: '11111111-1111-4111-8111-111111111111', email: 'student@example.test' };
const userB = { id: '22222222-2222-4222-8222-222222222222', email: 'other@example.test' };
const copy = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

class NativeStorage {
    constructor() { this.data = new Map(); }
    getItem(key) { return this.data.get(String(key)) ?? null; }
    setItem(key, value) { this.data.set(String(key), String(value)); }
    removeItem(key) { this.data.delete(String(key)); }
    key(index) { return Array.from(this.data.keys())[index] ?? null; }
    get length() { return this.data.size; }
}

// The fixture parses the existing modal markup so the real login/logout handlers run.
class Element {
    constructor(tag = 'div') {
        this.tagName = tag.toLowerCase(); this.children = []; this.parentNode = null;
        this.listeners = new Map(); this.attributes = {}; this.style = {}; this.dataset = {};
        this.className = ''; this.id = ''; this.value = ''; this.disabled = false; this._text = ''; this._html = '';
        this.classList = {
            contains: name => this.className.split(/\s+/).includes(name),
            add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
            remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
            toggle: (name, force) => { const add = force === undefined ? !this.classList.contains(name) : force; this.classList[add ? 'add' : 'remove'](name); return add; }
        };
    }
    appendChild(child) { child.remove(); child.parentNode = this; this.children.push(child); return child; }
    insertBefore(child, before) { child.remove(); child.parentNode = this; const at = this.children.indexOf(before); this.children.splice(at < 0 ? this.children.length : at, 0, child); return child; }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; }
    setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name === 'id') this.id = String(value);
        else if (name === 'class') this.className = String(value);
        else if (name === 'value' || name === 'type') this[name] = String(value);
        else if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
    }
    getAttribute(name) { return this.attributes[name] ?? null; }
    addEventListener(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(callback); }
    dispatch(type) {
        const event = { type, target: this, preventDefault() {}, stopPropagation() {} };
        return Promise.all((this.listeners.get(type) || []).map(callback => callback(event)));
    }
    click() { return this.disabled ? Promise.resolve() : this.dispatch('click'); }
    reset() { this.querySelectorAll('input').forEach(input => { input.value = ''; }); }
    matches(selector) {
        if (selector.startsWith('#')) return this.id === selector.slice(1);
        if (selector.startsWith('.')) return selector.slice(1).split('.').every(name => this.classList.contains(name));
        return this.tagName === selector;
    }
    querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this.children = []; this._text = String(value); this._html = ''; }
    get innerHTML() { return this._html; }
    set innerHTML(value) {
        this.children = []; this._text = ''; this._html = String(value);
        const stack = [this], tokens = this._html.match(/<[^>]+>|[^<]+/g) || [];
        for (const token of tokens) {
            if (!token.startsWith('<')) { stack[stack.length - 1]._text += token; continue; }
            if (/^<\//.test(token)) { if (stack.length > 1) stack.pop(); continue; }
            const match = /^<([\w-]+)\s*([^>]*)>/.exec(token); if (!match) continue;
            const node = new Element(match[1]);
            for (const attr of match[2].matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
                node.setAttribute(attr[1], attr[2] ?? attr[3] ?? attr[4] ?? '');
            }
            stack[stack.length - 1].appendChild(node);
            if (!['input', 'br', 'hr', 'img', 'meta', 'link'].includes(node.tagName) && !/\/>$/.test(token)) stack.push(node);
        }
    }
}

function sdk(native, initialUser = null) {
    const client = {
        user: initialUser, callbacks: [], getUserGates: [], signIns: [], signOuts: 0,
        reads: [], writes: [], channels: [], removed: [], tables: {},
        emit(event, user) {
            client.user = user;
            if (user) native.setItem(authKey, JSON.stringify({ access_token: 'test-only', user })); else native.removeItem(authKey);
            client.callbacks.slice().forEach(callback => callback(event, user ? { user } : null));
        },
        auth: {
            async getUser() {
                const gate = client.getUserGates.shift();
                return gate ? gate.promise : { data: { user: client.user }, error: null };
            },
            onAuthStateChange(callback) { client.callbacks.push(callback); return { data: { subscription: { unsubscribe() {} } } }; },
            async signInWithPassword(credentials) { client.signIns.push(copy(credentials)); client.emit('SIGNED_IN', userA); return { data: { user: userA, session: { user: userA } }, error: null }; },
            async signOut() { client.signOuts++; client.emit('SIGNED_OUT', null); return { error: null }; }
        },
        from(table) {
            const filters = {};
            const query = {
                select() { return query; }, eq(key, value) { filters[key] = value; return query; },
                order() { return query; }, in() { return query; }, gte() { return query; }, gt() { return query; },
                then(resolve, reject) {
                    client.reads.push({ table, filters: copy(filters) });
                    const rows = table === 'sync_items' ? [] : client.tables[table] || [];
                    return Promise.resolve({ data: copy(rows), error: null }).then(resolve, reject);
                },
                async upsert(rows) { client.writes.push(copy(rows)); return { error: null }; }
            };
            return query;
        },
        channel(name) {
            const channel = { name, on() { return channel; }, subscribe() { client.channels.push(channel); return channel; } };
            return channel;
        },
        removeChannel(channel) { client.removed.push(channel); return Promise.resolve(); }
    };
    return client;
}

function browser({ facade = false, user = null, savedUser = user, preloadSDK = false, withUI = false, withSync = false, workspaceUI = false } = {}) {
    const native = new NativeStorage(), scripts = [], events = [], ready = [], timers = new Map(), errors = [];
    if (savedUser) native.setItem(authKey, JSON.stringify({ access_token: 'test-only', user: savedUser }));
    let nextTimer = 1, reloads = 0, creations = 0;
    const listeners = new Map(), html = new Element('html'), head = new Element('head'), body = new Element('body');
    html.appendChild(head); html.appendChild(body);
    const nav = new Element('div'); nav.className = 'nav-actions'; body.appendChild(nav);
    const theme = new Element('button'); theme.id = 'theme-toggle'; nav.appendChild(theme);
    const elements = new Map();
    if (workspaceUI) for (const id of ['workspace-guest-banner', 'workspace-tabs-container', 'tasks-list-container', 'tasks-empty-state',
        'stat-today-focus', 'stat-week-focus', 'stat-workspace-focus', 'stat-top-task']) {
        const node = new Element('div'); node.id = id; body.appendChild(node); elements.set(id, node);
    }
    const appendHead = head.appendChild.bind(head);
    head.appendChild = node => { if (node.tagName === 'script') scripts.push(node); return appendHead(node); };
    const document = {
        readyState: 'complete', head, body, documentElement: html,
        createElement: tag => new Element(tag),
        getElementById: id => html.querySelector('#' + id),
        querySelector: selector => html.querySelector(selector), querySelectorAll: selector => html.querySelectorAll(selector),
        addEventListener(type, callback) { if (type === 'DOMContentLoaded') ready.push(callback); }
    };
    const client = sdk(native, user);
    const factory = { createClient(url, key) { assert.equal(url, 'https://dzfdbjnqtgltuguqqdkz.supabase.co'); assert(key.startsWith('sb_publishable_')); creations++; return client; } };
    const context = vm.createContext({
        document, localStorage: native, navigator: {}, location: { reload() { reloads++; } },
        URLSearchParams, console: { log() {}, warn() {}, error(...args) { errors.push(args); } },
        Event: class { constructor(type) { this.type = type; } },
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
        setTimeout(callback) { const id = nextTimer++; timers.set(id, callback); return id; }, clearTimeout(id) { timers.delete(id); },
        setInterval(callback) { const id = nextTimer++; timers.set(id, callback); return id; }, clearInterval(id) { timers.delete(id); },
        addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(callback); },
        dispatchEvent(event) { events.push(event); for (const callback of listeners.get(event.type) || []) callback(event); return true; }
    });
    context.window = context; context.global = context;
    const load = file => vm.runInContext(source[file], context, { filename: file });
    if (facade) load('account-storage.js');
    if (preloadSDK) context.supabase = factory;
    load('supabase.js'); load('common.js');
    if (withSync) load('sync.js');
    if (withUI) load('auth-ui.js');
    return {
        context, native, client, scripts, events, nav, elements, errors,
        get reloads() { return reloads; }, get creations() { return creations; },
        loadSDK() { context.supabase = factory; const script = scripts[scripts.length - 1]; assert(script && typeof script.onload === 'function'); script.onload(); },
        async initializeSpaces() {
            document.readyState = 'loading'; const before = ready.length; load('spaces.js');
            document.readyState = 'complete'; assert.equal(ready.length, before + 1);
            return ready[before]();
        },
        flushTimers() { const current = Array.from(timers); timers.clear(); current.forEach(([, callback]) => callback()); }
    };
}

async function until(condition, message) {
    for (let count = 0; count < 160; count++) { if (condition()) return; await Promise.resolve(); }
    assert(condition(), message || 'Expected production lifecycle operation to finish');
}
let failures = 0, finished = false;
process.once('beforeExit', () => { if (!finished) { console.error('FAIL auth lifecycle suite stopped with an unresolved operation'); process.exitCode = 1; } });
async function check(name, run) {
    try { await run(); console.log('PASS ' + name); }
    catch (error) { failures++; console.error('FAIL ' + name); console.error(error); }
}

(async () => {
    await check('cold SDK requests share one loader and publish the actual client once', async () => {
        const b = browser();
        assert.equal(b.scripts.length, 0); assert.equal(b.creations, 0);
        const first = b.context.ensureSupabaseLoaded(), second = b.context.ensureSupabaseLoaded();
        assert.equal(first, second); assert.equal(b.scripts.length, 1);
        assert(b.scripts[0].src.includes('@supabase/supabase-js@2'));
        b.loadSDK();
        assert.equal(await first, b.client); assert.equal(await second, b.client);
        assert.equal(b.context.supabaseClient, b.client); assert.equal(b.creations, 1);
        await b.context.ensureSupabaseLoaded(); b.context.hayyizPublishSupabaseReady(b.client);
        const readiness = b.events.filter(event => event.type === 'hayyiz:supabase-ready');
        assert.equal(readiness.length, 1); assert.equal(readiness[0].detail, b.client);
    });

    await check('a failed virtual SDK script can be retried without a stuck loading promise', async () => {
        const b = browser(), first = b.context.ensureSupabaseLoaded();
        b.scripts[0].onerror(new Error('simulated script failure'));
        await assert.rejects(first, /simulated script failure/);
        const second = b.context.ensureSupabaseLoaded(); assert.equal(b.scripts.length, 2);
        b.loadSDK(); assert.equal(await second, b.client); assert.equal(b.creations, 1);
    });

    await check('cold home UI stays lazy, then login and logout update the nav through actual auth handlers', async () => {
        const b = browser({ withUI: true, withSync: true });
        const nav = b.context.document.getElementById('nav-auth-btn');
        assert(nav.classList.contains('logged-out')); assert.equal(b.scripts.length, 0); assert.equal(b.client.callbacks.length, 0);
        assert.equal(b.nav.children[0], nav);
        await nav.click(); assert.equal(b.scripts.length, 1); b.loadSDK();
        await until(() => b.client.callbacks.length >= 2);
        const form = b.context.document.getElementById('auth-form'); assert(form);
        form.querySelector('#auth-email').value = ' student@example.test ';
        form.querySelector('#auth-password').value = 'test-password';
        await form.dispatch('submit');
        assert.deepEqual(b.client.signIns, [{ email: 'student@example.test', password: 'test-password' }]);
        assert(nav.classList.contains('logged-in')); assert.equal(nav.getAttribute('aria-label'), 'حسابي');
        assert.equal(b.context.document.getElementById('hayyiz-auth-modal'), null);
        await nav.click();
        const logout = b.context.document.getElementById('auth-logout-btn'); assert(logout);
        await logout.click();
        assert.equal(b.client.signOuts, 1); assert(nav.classList.contains('logged-out'));
        assert.equal(nav.getAttribute('aria-label'), 'تسجيل الدخول');
        assert.equal(b.context.document.getElementById('hayyiz-auth-modal'), null);
        assert.equal(b.context.document.querySelectorAll('#nav-auth-btn').length, 1);
        assert.equal(b.creations, 1); assert.equal(b.errors.length, 0);
    });

    await check('home Auth UI registers the real sync listener before a client exists and it attaches on readiness', async () => {
        const b = browser({ facade: true, withUI: true, withSync: true });
        b.native.setItem('hayyiz-todos', '[{"id":"guest","text":"guest work"}]');
        const loading = b.context.ensureSupabaseLoaded(); b.loadSDK(); await loading;
        assert.equal(b.client.callbacks.length, 3, 'Publisher, sync and Auth UI must each subscribe once');
        b.client.emit('SIGNED_IN', userA);
        // The publisher defers its transition; an immediate reload proves setupAuth attached sync's listener.
        assert.equal(b.reloads, 1); assert.equal(b.context.hayyizStorage.isCurrentScope('guest'), false);
        b.flushTimers();
        assert.equal(b.reloads, 1); assert.equal(b.native.getItem('hayyiz-account:' + userA.id + ':hayyiz-todos'), null);
        assert.equal(b.native.getItem('hayyiz-todos'), '[{"id":"guest","text":"guest work"}]');
        await b.context.ensureSupabaseLoaded(); assert.equal(b.client.callbacks.length, 3);
    });

    await check('the SDK publisher alone transitions a signed-in facade on logout and reloads only once', async () => {
        const b = browser({ facade: true, user: userA, preloadSDK: true });
        assert.equal(b.client.callbacks.length, 1);
        b.client.emit('SIGNED_OUT', null); assert.equal(b.reloads, 0); b.flushTimers();
        assert.equal(b.reloads, 1); assert.equal(b.context.hayyizStorage.isCurrentUser(userA.id), false);
        b.client.emit('SIGNED_OUT', null); b.flushTimers(); assert.equal(b.reloads, 1);
    });

    await check('the SDK publisher tolerates the native-storage fallback without a transition API', async () => {
        const b = browser(), loading = b.context.ensureSupabaseLoaded(); b.loadSDK(); await loading;
        b.client.emit('SIGNED_IN', userA);
        assert.doesNotThrow(() => b.flushTimers());
        assert.equal(b.reloads, 0);
    });

    await check('spaces subscribes while still a guest and loads the first login in the same document without a facade', async () => {
        const b = browser({ workspaceUI: true, preloadSDK: true });
        b.client.tables.workspaces = [{ id: 'workspace_A', name: 'Math team', created_by: userA.id }];
        b.client.tables.tasks = [{ id: 'workspace_task_A', workspace_id: 'workspace_A', title: 'Study together', creator_id: userA.id, scope: 'workspace', completion_mode: 'independent' }];
        await b.initializeSpaces();
        assert.equal(b.client.callbacks.length, 1); assert.equal(b.client.reads.length, 0);
        assert.equal(b.elements.get('workspace-guest-banner').classList.contains('hidden'), false);
        b.client.emit('SIGNED_IN', userA);
        await until(() => b.context.hayyizGetTodos().some(todo => todo.workspaceTaskId === 'workspace_task_A'));
        assert(b.elements.get('workspace-guest-banner').classList.contains('hidden'));
        assert.equal(b.context.hayyizGetTodos().filter(todo => todo.workspaceTaskId === 'workspace_task_A').length, 1);
        assert(b.elements.get('workspace-tabs-container').textContent.includes('Math team'));
        assert.equal(b.elements.get('tasks-list-container').children.length, 1);
        await until(() => b.client.channels.length === 1);
        const reads = b.client.reads.length;
        b.client.emit('TOKEN_REFRESHED', userA);
        for (let round = 0; round < 20; round++) await Promise.resolve();
        assert.equal(b.client.reads.length, reads); assert.equal(b.client.channels.length, 1);
        b.client.emit('SIGNED_OUT', null);
        await until(() => b.client.removed.length === 1);
        assert.equal(b.elements.get('tasks-list-container').children.length, 0);
        assert.equal(b.elements.get('workspace-guest-banner').classList.contains('hidden'), false);
        assert.equal(b.errors.length, 0);
    });

    await check('spaces with a guest facade transitions on login before fetching or populating account caches', async () => {
        const b = browser({ facade: true, workspaceUI: true });
        const guest = '[{"id":"guest","text":"private guest task"}]'; b.native.setItem('hayyiz-todos', guest);
        const initializing = b.initializeSpaces();
        await until(() => b.scripts.length === 1); b.loadSDK(); await initializing;
        assert.equal(b.client.callbacks.length, 2);
        b.client.emit('SIGNED_IN', userA); b.flushTimers();
        for (let round = 0; round < 20; round++) await Promise.resolve();
        assert.equal(b.reloads, 1); assert.equal(b.client.reads.length, 0); assert.equal(b.client.channels.length, 0);
        assert.equal(b.native.getItem('hayyiz-todos'), guest);
        assert.equal(b.native.getItem('hayyiz-account:' + userA.id + ':hayyiz-todos'), null);
    });

    await check('spaces rejects a startup SDK user that does not match the immutable storage account', async () => {
        const b = browser({ facade: true, workspaceUI: true, preloadSDK: true, user: userA, savedUser: userB });
        b.context.hayyizStorage.setItem('hayyiz-todos', '[{"id":"B-private"}]');
        await b.initializeSpaces();
        assert.equal(b.reloads, 1); assert.equal(b.client.reads.length, 0);
        assert.equal(b.context.hayyizStorage.accountId, userB.id);
        assert.equal(b.context.hayyizStorage.getItem('hayyiz-todos'), '[{"id":"B-private"}]');
        assert.equal(b.native.getItem('hayyiz-account:' + userA.id + ':hayyiz-todos'), null);
    });

    await check('a delayed initial getUser response cannot restore a logged-in nav after SIGNED_OUT', async () => {
        const b = browser({ preloadSDK: true, user: userA }), gate = deferred();
        b.client.getUserGates.push(gate);
        vm.runInContext(source['auth-ui.js'], b.context, { filename: 'auth-ui.js' });
        await until(() => b.client.getUserGates.length === 0 && b.client.callbacks.length > 0);
        b.client.emit('SIGNED_OUT', null);
        gate.resolve({ data: { user: userA }, error: null });
        for (let round = 0; round < 20; round++) await Promise.resolve();
        assert(b.context.document.getElementById('nav-auth-btn').classList.contains('logged-out'));
    });

    await check('a delayed empty initial getUser response cannot erase a subsequent SIGNED_IN nav', async () => {
        const b = browser({ preloadSDK: true }), gate = deferred();
        b.client.getUserGates.push(gate);
        vm.runInContext(source['auth-ui.js'], b.context, { filename: 'auth-ui.js' });
        await until(() => b.client.getUserGates.length === 0 && b.client.callbacks.length > 0);
        b.client.emit('SIGNED_IN', userA);
        gate.resolve({ data: { user: null }, error: null });
        for (let round = 0; round < 20; round++) await Promise.resolve();
        assert(b.context.document.getElementById('nav-auth-btn').classList.contains('logged-in'));
    });

    finished = true;
    if (failures) process.exitCode = 1;
    else console.log('All auth lifecycle tests passed without network access.');
})().catch(error => { finished = true; console.error(error); process.exitCode = 1; });
