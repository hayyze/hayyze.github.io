const fs = require('fs');

// Mock browser environment for Node.js
global.window = global;

const mockListeners = [];
let mockUser = null;

const elementsMap = new Map();

function createMockElement(tag) {
    const el = {
        tagName: tag.toUpperCase(),
        children: [],
        className: '',
        _id: '',
        _innerHTML: '',
        type: '',
        textContent: '',
        value: '',
        disabled: false,
        attributes: {},
        listeners: {},
        get id() { return this._id; },
        set id(val) {
            if (this._id) elementsMap.delete(this._id);
            this._id = val;
            if (val) elementsMap.set(val, this);
        },
        get innerHTML() { return this._innerHTML; },
        set innerHTML(val) {
            this._innerHTML = val;
            parseHTMLToTree(this, val);
        },
        setAttribute(k, v) { this.attributes[k] = v; },
        getAttribute(k) { return this.attributes[k] || null; },
        addEventListener(evt, fn) {
            if (!this.listeners[evt]) this.listeners[evt] = [];
            this.listeners[evt].push(fn);
        },
        removeEventListener(evt, fn) {},
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        insertBefore(child, ref) {
            this.children.push(child);
            return child;
        },
        querySelector(sel) {
            return findInTree(this, sel);
        },
        querySelectorAll(sel) {
            return findAllInTree(this, sel);
        },
        remove() {
            if (this._id) elementsMap.delete(this._id);
            const idx = document._children.indexOf(this);
            if (idx >= 0) document._children.splice(idx, 1);
        },
        reset() {}
    };
    return el;
}

function parseHTMLToTree(parent, htmlStr) {
    parent.children = [];

    // Extract close button
    if (htmlStr.includes('close-modal')) {
        const btn = createMockElement('button');
        btn.className = 'close-modal';
        parent.children.push(btn);
    }

    // Extract auth-email
    if (htmlStr.includes('id="auth-email"')) {
        const inp = createMockElement('input');
        inp.id = 'auth-email';
        parent.children.push(inp);
    }

    // Extract auth-password
    if (htmlStr.includes('id="auth-password"')) {
        const inp = createMockElement('input');
        inp.id = 'auth-password';
        parent.children.push(inp);
    }

    // Extract auth-confirm-password
    if (htmlStr.includes('id="auth-confirm-password"')) {
        const inp = createMockElement('input');
        inp.id = 'auth-confirm-password';
        parent.children.push(inp);
    }

    // Extract auth-alert
    if (htmlStr.includes('id="auth-alert"')) {
        const alertEl = createMockElement('div');
        alertEl.id = 'auth-alert';
        parent.children.push(alertEl);
    }

    // Extract auth-submit-btn
    if (htmlStr.includes('id="auth-submit-btn"')) {
        const submitBtn = createMockElement('button');
        submitBtn.id = 'auth-submit-btn';
        submitBtn.type = 'submit';
        parent.children.push(submitBtn);
    }

    // Extract auth-logout-btn
    if (htmlStr.includes('id="auth-logout-btn"')) {
        const logoutBtn = createMockElement('button');
        logoutBtn.id = 'auth-logout-btn';
        parent.children.push(logoutBtn);
    }

    // Extract switch links
    if (htmlStr.includes('id="switch-to-login"')) {
        const sw = createMockElement('button');
        sw.id = 'switch-to-login';
        parent.children.push(sw);
    }
    if (htmlStr.includes('id="switch-to-signup"')) {
        const sw = createMockElement('button');
        sw.id = 'switch-to-signup';
        parent.children.push(sw);
    }

    // Extract email display
    if (htmlStr.includes('auth-email-display')) {
        const disp = createMockElement('div');
        disp.className = 'auth-email-display';
        const match = htmlStr.match(/<div class="auth-email-display">([^<]+)<\/div>/);
        if (match) disp.textContent = match[1];
        parent.children.push(disp);
    }

    // Extract auth-form
    if (htmlStr.includes('id="auth-form"')) {
        const form = createMockElement('form');
        form.id = 'auth-form';
        form.children = parent.children.filter(c => c.id !== 'switch-to-login' && c.id !== 'switch-to-signup' && c.className !== 'close-modal');
        parent.children.push(form);
    }
}

global.document = {
    readyState: 'complete',
    body: {
        classList: { toggle: () => {} },
        appendChild: (child) => {
            if (!document._children.includes(child)) {
                document._children.push(child);
            }
            return child;
        }
    },
    documentElement: { classList: { toggle: () => {}, contains: () => false } },
    _children: [],
    querySelector: (sel) => {
        if (sel === '.nav-actions') return document._navActions;
        if (sel === '#hayyiz-auth-modal') return elementsMap.get('hayyiz-auth-modal') || null;
        return null;
    },
    querySelectorAll: () => [],
    getElementById: (id) => {
        return elementsMap.get(id) || null;
    },
    createElement: (tag) => {
        return createMockElement(tag);
    },
    addEventListener: (evt, fn) => {
        if (evt === 'DOMContentLoaded') fn();
    }
};

document._navActions = createMockElement('div');
document._navActions.className = 'nav-actions';

function findInTree(node, sel) {
    if (!node) return null;
    if (sel.startsWith('#') && node.id === sel.slice(1)) return node;
    if (sel.startsWith('.') && node.className && node.className.includes(sel.slice(1))) return node;
    if (sel === node.tagName.toLowerCase()) return node;
    if (!node.children) return null;

    for (const child of node.children) {
        const sub = findInTree(child, sel);
        if (sub) return sub;
    }
    return null;
}

function findAllInTree(node, sel) {
    let res = [];
    if (!node) return res;
    if (sel.startsWith('#') && node.id === sel.slice(1)) res.push(node);
    if (sel.startsWith('.') && node.className && node.className.includes(sel.slice(1))) res.push(node);
    if (sel === node.tagName.toLowerCase()) res.push(node);
    if (!node.children) return res;

    for (const child of node.children) {
        res = res.concat(findAllInTree(child, sel));
    }
    return res;
}

// Mock LocalStorage
global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
};

// Mock Supabase
global.supabaseClient = {
    auth: {
        async getUser() {
            if (!mockUser) return { data: { user: null }, error: { message: 'No user' } };
            return { data: { user: mockUser }, error: null };
        },
        async signUp({ email, password }) {
            if (email === 'existing@example.com') {
                return { data: { user: null, session: null }, error: { message: 'User already registered', code: 'user_already_exists' } };
            }
            if (email === 'confirm@example.com') {
                return { data: { user: { id: 'u_confirm', email }, session: null }, error: null };
            }
            const user = { id: 'u_new', email };
            const session = { access_token: 'tok_123', user };
            mockUser = user;
            return { data: { user, session }, error: null };
        },
        async signInWithPassword({ email, password }) {
            if (password === 'wrongpass') {
                return { data: { user: null, session: null }, error: { message: 'Invalid login credentials', code: 'invalid_credentials' } };
            }
            const user = { id: 'u_login', email };
            const session = { access_token: 'tok_456', user };
            mockUser = user;
            return { data: { user, session }, error: null };
        },
        async signOut() {
            mockUser = null;
            return { error: null };
        },
        onAuthStateChange(cb) {
            mockListeners.push(cb);
            return { data: { subscription: { unsubscribe: () => {} } } };
        }
    }
};

global.window.supabase = {
    createClient: () => global.supabaseClient
};

let syncAllCalledCount = 0;
global.hayyizSyncAllUserData = async function() {
    syncAllCalledCount++;
};

// Evaluate scripts
const supabaseJs = fs.readFileSync('./supabase.js', 'utf8');
eval(supabaseJs);

const authUiJs = fs.readFileSync('./auth-ui.js', 'utf8');
eval(authUiJs);

let passed = 0;
let failed = 0;

function assert(cond, msg) {
    if (cond) {
        console.log(`✅ PASS: ${msg}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${msg}`);
        failed++;
    }
}

async function runAuthTests() {
    console.log('=== RUNNING AUTH UI TEST SUITE ===\n');

    // Test 1: Initial Auth Button rendered
    const navBtn = document.getElementById('nav-auth-btn');
    assert(navBtn !== null && navBtn.innerHTML.includes('تسجيل الدخول'), 'Test 1: Unauthenticated nav button renders correctly');

    // Test 2: Click nav button opens Auth Modal in login mode
    navBtn.listeners['click'][0]();
    const modal = document.getElementById('hayyiz-auth-modal');
    assert(modal !== null, 'Test 2: Clicking nav button opens modal overlay');

    // Test 3: Password mismatch validation in signup mode
    hayyizOpenAuthModal('signup');
    const signupForm = document.getElementById('hayyiz-auth-modal').querySelector('#auth-form');
    signupForm.querySelector('#auth-email').value = 'test@example.com';
    signupForm.querySelector('#auth-password').value = '123456';
    signupForm.querySelector('#auth-confirm-password').value = '654321';

    // Trigger submit listener
    const submitEvt = { preventDefault: () => {} };
    await signupForm.listeners['submit'][0](submitEvt);
    const alertEl = document.getElementById('hayyiz-auth-modal').querySelector('#auth-alert');
    assert(alertEl.textContent === 'كلمات المرور غير متطابقة.', 'Test 3: Password mismatch error message is displayed in Arabic');

    // Test 4: Email confirmation required notice on successful signup without immediate session
    signupForm.querySelector('#auth-email').value = 'confirm@example.com';
    signupForm.querySelector('#auth-password').value = '123456';
    signupForm.querySelector('#auth-confirm-password').value = '123456';
    await signupForm.listeners['submit'][0](submitEvt);
    const alertConfirm = document.getElementById('hayyiz-auth-modal').querySelector('#auth-alert');
    assert(alertConfirm.textContent === 'تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيد الحساب.', 'Test 4: Confirmation email message displayed as success notice');

    // Test 5: Login with wrong password shows translated Arabic error
    hayyizOpenAuthModal('login');
    const loginForm = document.getElementById('hayyiz-auth-modal').querySelector('#auth-form');
    loginForm.querySelector('#auth-email').value = 'user@example.com';
    loginForm.querySelector('#auth-password').value = 'wrongpass';
    await loginForm.listeners['submit'][0](submitEvt);
    const alertWrong = document.getElementById('hayyiz-auth-modal').querySelector('#auth-alert');
    assert(alertWrong.textContent === 'البريد الإلكتروني أو كلمة المرور غير صحيحة.', 'Test 5: Wrong password produces friendly Arabic error message');

    // Test 6: Successful login closes modal and triggers hayyizSyncAllUserData()
    const syncBefore = syncAllCalledCount;
    loginForm.querySelector('#auth-email').value = 'student@example.com';
    loginForm.querySelector('#auth-password').value = 'valid123';
    await loginForm.listeners['submit'][0](submitEvt);
    assert(document.getElementById('hayyiz-auth-modal') === null, 'Test 6a: Successful login closes modal');
    assert(syncAllCalledCount > syncBefore, 'Test 6b: Successful login triggers hayyizSyncAllUserData()');

    // Test 7: Nav button updates to logged-in state ("حسابي")
    hayyizUpdateNavAuthButton(mockUser);
    const loggedInBtn = document.getElementById('nav-auth-btn');
    assert(loggedInBtn.innerHTML.includes('حسابي'), 'Test 7: Logged-in nav button displays "حسابي"');

    // Test 8: Opening modal while logged in opens profile mode displaying email
    hayyizOpenAuthModal();
    const profileModal = document.getElementById('hayyiz-auth-modal');
    const emailDisplay = profileModal.querySelector('.auth-email-display');
    assert(emailDisplay && emailDisplay.textContent === 'student@example.com', 'Test 8: Profile mode shows logged-in user email');

    // Test 9: Sign out clears user, closes modal, and preserves LocalStorage data
    localStorage.setItem('hayyiz-notes', JSON.stringify([{ id: 'n1', title: 'ملاحظة' }]));
    const logoutBtn = profileModal.querySelector('#auth-logout-btn');
    await logoutBtn.listeners['click'][0]();
    assert(mockUser === null, 'Test 9a: Sign out clears current auth user');
    assert(localStorage.getItem('hayyiz-notes') !== null, 'Test 9b: LocalStorage user data preserved after logout');

    console.log(`\n===================================`);
    console.log(`AUTH TEST SUITE RESULTS: ${passed} Passed, ${failed} Failed`);
    console.log(`===================================\n`);

    if (failed > 0) process.exit(1);
}

runAuthTests();
