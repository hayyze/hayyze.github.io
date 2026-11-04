const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('./password-recovery.js', 'utf8');

class MemoryStorage {
    constructor() { this.values = new Map(); }
    getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
    setItem(key, value) { this.values.set(key, String(value)); }
    removeItem(key) { this.values.delete(key); }
}

class MockElement {
    constructor(id) {
        this.id = id;
        this.value = '';
        this.textContent = '';
        this.hidden = false;
        this.disabled = false;
        this.type = 'text';
        this.attributes = {};
        this.listeners = new Map();
        this.children = [];
        this.className = '';
        this.validity = { typeMismatch: false };
    }
    addEventListener(type, callback) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(callback);
    }
    async dispatch(type) {
        const event = { preventDefault() {}, target: this };
        for (const callback of this.listeners.get(type) || []) await callback(event);
    }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] || null; }
    focus() { this.focused = true; }
    querySelectorAll(selector) {
        if (selector === '[data-password-target]') return this.children.filter(child => child.getAttribute('data-password-target'));
        return [];
    }
    set innerHTML(value) { this._innerHTML = value; }
    get innerHTML() { return this._innerHTML || ''; }
}

function buildEnvironment(page, options) {
    const ids = page === 'request'
        ? ['password-recovery-request-form', 'password-recovery-email', 'password-recovery-request-status', 'password-recovery-request-button']
        : ['password-recovery-checking', 'password-recovery-invalid', 'password-recovery-success',
            'password-recovery-reset-status', 'password-recovery-reset-form',
            'password-recovery-new-password', 'password-recovery-confirm-password', 'password-recovery-save-button'];
    const elements = new Map(ids.map(id => [id, new MockElement(id)]));
    const document = {
        title: 'حيز',
        readyState: 'complete',
        getElementById(id) { return elements.get(id) || null; }
    };
    const storage = new MemoryStorage();
    const calls = { reset: [], update: [], signOut: [], exchange: [], getUser: 0 };
    const client = {
        auth: {
            async resetPasswordForEmail(email, opts) {
                calls.reset.push({ email, opts });
                return options && options.resetError ? { error: options.resetError } : { data: {}, error: null };
            },
            onAuthStateChange(callback) {
                client.auth.callback = callback;
                return { data: { subscription: { unsubscribe() {} } } };
            },
            async exchangeCodeForSession(code) {
                calls.exchange.push(code);
                return options && options.exchangeError
                    ? { data: { session: null }, error: options.exchangeError }
                    : { data: { session: { user: { id: 'student-1' } } }, error: null };
            },
            async getUser() {
                calls.getUser++;
                return options && options.getUserError
                    ? { data: { user: null }, error: options.getUserError }
                    : { data: { user: { id: 'student-1' } }, error: null };
            },
            async updateUser(attributes) {
                calls.update.push(attributes);
                return options && options.updateError ? { error: options.updateError } : { data: { user: { id: 'student-1' } }, error: null };
            },
            async signOut(opts) {
                calls.signOut.push(opts);
                if (options && options.globalSignOutError && opts && opts.scope === 'global') {
                    return { error: options.globalSignOutError };
                }
                if (client.auth.callback) client.auth.callback('SIGNED_OUT', null);
                return { error: null };
            }
        }
    };
    const timers = new Map();
    let timerId = 0;
    const location = {
        href: options && options.href || (page === 'request'
            ? 'https://hayyze.pages.dev/forgot-password.html'
            : 'https://hayyze.pages.dev/reset-password.html') + (options && options.search || '') + (options && options.hash || ''),
        pathname: page === 'request' ? '/forgot-password.html' : '/reset-password.html',
        search: options && options.search || '',
        hash: options && options.hash || ''
    };
    const context = {
        document,
        location,
        history: { replaceState(_state, _title, url) {
            const next = new URL(url, location.href);
            location.href = next.href;
            location.pathname = next.pathname;
            location.search = next.search;
            location.hash = next.hash;
        } },
        URL,
        URLSearchParams,
        Date,
        sessionStorage: storage,
        ensureSupabaseLoaded: async () => client,
        setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; },
        clearTimeout(id) { timers.delete(id); },
        addEventListener() {},
        console
    };
    context.window = context;
    vm.runInNewContext(source, context, { filename: 'password-recovery.js' });
    return { context, elements, storage, calls, client, timers, location };
}

async function tick() {
    // The page bootstrap awaits client initialization and may then await Auth;
    // flush enough microtasks for both promise chains to settle deterministically.
    for (let i = 0; i < 8; i++) await Promise.resolve();
}

(async () => {
    {
        const env = buildEnvironment('request');
        const email = env.elements.get('password-recovery-email');
        email.value = ' Student@Example.com ';
        await env.elements.get('password-recovery-request-form').dispatch('submit');
        await tick();
        assert.equal(env.calls.reset.length, 1);
        assert.equal(env.calls.reset[0].email, 'student@example.com');
        assert.equal(env.calls.reset[0].opts.redirectTo, 'https://hayyze.pages.dev/reset-password.html');
        assert.match(env.elements.get('password-recovery-request-status').textContent, /إذا كان هذا البريد مرتبطًا بحساب/);
        assert.equal(env.elements.get('password-recovery-request-status').textContent.includes('student@example.com'), false);
        console.log('PASS reset request normalizes email, uses fixed redirect, and avoids account enumeration');
    }

    {
        const env = buildEnvironment('request');
        env.elements.get('password-recovery-email').value = 'not-an-email';
        await env.elements.get('password-recovery-request-form').dispatch('submit');
        assert.equal(env.calls.reset.length, 0);
        assert.equal(env.elements.get('password-recovery-email').attributes['aria-invalid'], 'true');
        console.log('PASS invalid email never reaches Supabase');
    }

    {
        const env = buildEnvironment('reset');
        await tick();
        assert.equal(env.elements.get('password-recovery-reset-form').hidden, true);
        assert.equal(env.elements.get('password-recovery-invalid').hidden, false);
        assert.equal(env.elements.get('password-recovery-reset-form').listeners.get('submit').length, 1);
        await env.elements.get('password-recovery-reset-form').dispatch('submit');
        assert.equal(env.calls.update.length, 0);
        console.log('PASS direct visits cannot access the password update action');
    }

    {
        const env = buildEnvironment('reset', { hash: '#type=recovery' });
        await tick();
        env.client.auth.callback('PASSWORD_RECOVERY', { user: { id: 'student-1' } });
        assert.equal(env.elements.get('password-recovery-reset-form').hidden, false);
        assert.equal(env.elements.get('password-recovery-invalid').hidden, true);
        assert.equal(env.location.hash, '');
        assert.equal(JSON.parse(env.storage.getItem('hayyiz-password-recovery-session-v1')).userId, 'student-1');

        const password = env.elements.get('password-recovery-new-password');
        const confirm = env.elements.get('password-recovery-confirm-password');
        const form = env.elements.get('password-recovery-reset-form');
        password.value = 'short7';
        confirm.value = 'short7';
        await form.dispatch('submit');
        assert.equal(env.calls.update.length, 0);

        password.value = 'new-strong-passphrase';
        confirm.value = 'different-passphrase';
        await form.dispatch('submit');
        assert.equal(env.calls.update.length, 0);

        confirm.value = 'new-strong-passphrase';
        await form.dispatch('submit');
        await tick();
        assert.equal(env.calls.update.length, 1);
        assert.equal(env.calls.update[0].password, 'new-strong-passphrase');
        assert.equal(env.calls.signOut[0].scope, 'global');
        assert.equal(env.elements.get('password-recovery-success').hidden, false);
        assert.equal(env.elements.get('password-recovery-reset-form').hidden, true);
        console.log('PASS recovery event gates password update, validates input, and revokes refresh-token sessions');
    }

    {
        const env = buildEnvironment('reset', { search: '?code=single-use-code' });
        await tick();
        assert.deepEqual(env.calls.exchange, ['single-use-code']);
        assert.equal(env.elements.get('password-recovery-reset-form').hidden, false);
        assert.equal(env.location.search, '');
        console.log('PASS PKCE callback exchanges the one-time code before enabling password update');
    }

    {
        const env = buildEnvironment('reset', { hash: '#type=recovery', getUserError: new Error('invalid session') });
        env.storage.setItem('hayyiz-password-recovery-session-v1', JSON.stringify({
            userId: 'student-1',
            expiresAt: Date.now() + 60000
        }));
        await tick();
        assert.equal(env.elements.get('password-recovery-reset-form').hidden, true);
        assert.equal(env.elements.get('password-recovery-invalid').hidden, false);
        console.log('PASS stale recovery marker without a verified server session is rejected');
    }

    {
        const env = buildEnvironment('reset', { hash: '#type=recovery' });
        env.storage.setItem('hayyiz-password-recovery-session-v1', JSON.stringify({
            userId: 'student-1',
            expiresAt: Date.now() + 60000
        }));
        await tick();
        assert.equal(env.calls.getUser, 0);
        assert.equal(env.elements.get('password-recovery-reset-form').hidden, true);
        env.client.auth.callback('PASSWORD_RECOVERY', { user: { id: 'student-2' } });
        assert.equal(env.elements.get('password-recovery-reset-form').hidden, false);
        assert.equal(JSON.parse(env.storage.getItem('hayyiz-password-recovery-session-v1')).userId, 'student-2');
        console.log('PASS a fresh recovery link takes precedence over a stale marker from another account');
    }

    {
        const env = buildEnvironment('reset', {
            hash: '#type=recovery',
            globalSignOutError: new Error('global sign out unavailable')
        });
        await tick();
        env.client.auth.callback('PASSWORD_RECOVERY', { user: { id: 'student-1' } });
        const password = env.elements.get('password-recovery-new-password');
        const confirm = env.elements.get('password-recovery-confirm-password');
        password.value = 'another-strong-passphrase';
        confirm.value = 'another-strong-passphrase';
        await env.elements.get('password-recovery-reset-form').dispatch('submit');
        await tick();
        assert.deepEqual(env.calls.signOut.map(item => item.scope), ['global', 'local']);
        assert.match(env.elements.get('password-recovery-success').textContent, /تعذر إنهاء الجلسات الأخرى/);
        console.log('PASS failed global session revocation falls back to local sign-out and warns the user');
    }

    {
        const forgotHtml = fs.readFileSync('./forgot-password.html', 'utf8');
        const resetHtml = fs.readFileSync('./reset-password.html', 'utf8');
        const headers = fs.readFileSync('./_headers', 'utf8');
        const sw = fs.readFileSync('./sw.js', 'utf8');
        for (const html of [forgotHtml, resetHtml]) {
            assert.doesNotMatch(html, /unsafe-inline/);
            assert.match(html, /password-recovery-theme\.js/);
        }
        assert.match(headers, /Cache-Control: no-store/);
        assert.match(headers, /Referrer-Policy: no-referrer/);
        assert.match(headers, /X-Robots-Tag: noindex, nofollow, noarchive/);
        assert.doesNotMatch(sw, /\.\/forgot-password\.html/);
        assert.doesNotMatch(sw, /\.\/reset-password\.html/);
        assert.match(sw, /\.\/password-recovery-theme\.js/);
        console.log('PASS recovery pages use strict CSP, no-store response headers, and remain outside the HTML service-worker cache');
    }

    console.log('Password recovery tests completed successfully.');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
