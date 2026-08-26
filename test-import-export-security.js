const fs = require('fs');

// Load common.js and sync.js
const commonJs = fs.readFileSync('./common.js', 'utf8');

global.window = global;
global.document = {
    readyState: 'complete',
    body: {
        classList: { toggle: () => {} },
        appendChild: () => {},
        removeChild: () => {}
    },
    documentElement: { classList: { toggle: () => {}, contains: () => false } },
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener: () => {},
    createElement: (tag) => {
        return {
            href: '',
            download: '',
            click: () => {},
            remove: () => {}
        };
    }
};

global.URL = {
    createObjectURL: () => 'blob:mock-url',
    revokeObjectURL: () => {}
};

global.Blob = class Blob {
    constructor(contentArray, options) {
        this.content = contentArray.join('');
        this.type = options ? options.type : '';
    }
};

global.FileReader = class FileReader {
    readAsText(file) {
        setTimeout(() => {
            if (this.onload) {
                this.result = file._content;
                this.onload();
            }
        }, 0);
    }
};

global.confirm = () => true;
global.alert = (msg) => { console.log('ALERT:', msg); };

global.navigator = { serviceWorker: { register: () => Promise.resolve() } };
global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
};

eval(commonJs);

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

console.log('=== RUNNING IMPORT/EXPORT SECURITY VERIFICATION TESTS ===\n');

// 1. Export Test: Exporting data produces clean JSON without user identity or forbidden fields
{
    localStorage.clear();
    localStorage.setItem('hayyiz-todos', JSON.stringify([{ id: 't1', text: 'مذاكرة الرياضيات', priority: 'high' }]));
    localStorage.setItem('hayyiz-theme', 'dark');

    let exportedBlobContent = null;
    const originalBlob = global.Blob;
    global.Blob = class MockBlob {
        constructor(contentArray) {
            exportedBlobContent = contentArray[0];
        }
    };

    exportHayyizData();

    global.Blob = originalBlob;

    assert(exportedBlobContent !== null, 'Export generates a JSON payload blob');
    const exportedObj = JSON.parse(exportedBlobContent);
    assert(exportedObj.app === 'حيز' && exportedObj.version === 2, 'Export header contains correct app signature and version');
    assert(exportedObj.keys['hayyiz-todos'] && exportedObj.keys['hayyiz-theme'] === 'dark', 'Export contains allowed personal data keys');

    // Verify no user_id or forbidden system fields exist in export
    const rawExportText = JSON.stringify(exportedObj);
    assert(!rawExportText.includes('"user_id"'), 'Export does NOT include user_id');
    assert(!rawExportText.includes('"points"'), 'Export does NOT include points');
    assert(!rawExportText.includes('"premium"'), 'Export does NOT include premium');
}

// 2. Import Test: Valid file imports and restores personal data cleanly
{
    localStorage.clear();
    const validBackup = {
        version: 2,
        app: 'حيز',
        keys: {
            'hayyiz-todos': JSON.stringify([{ id: 't100', text: 'مهمة مستوردة', completed: false }]),
            'hayyiz-notes': JSON.stringify([{ id: 'n100', title: 'ملاحظة مستوردة', content: 'محتوى الملاحظة' }]),
            'hayyiz-theme': 'dark'
        }
    };

    const file = { _content: JSON.stringify(validBackup) };

    // Simulate page reload avoidance in test environment
    const origReload = global.window.location ? global.window.location.reload : null;
    global.window.location = { reload: () => {} };

    importHayyizData(file);

    setTimeout(() => {
        const todos = JSON.parse(localStorage.getItem('hayyiz-todos'));
        const notes = JSON.parse(localStorage.getItem('hayyiz-notes'));
        const theme = localStorage.getItem('hayyiz-theme');

        assert(Array.isArray(todos) && todos[0].id === 't100', 'Valid Import restores todos correctly');
        assert(Array.isArray(notes) && notes[0].id === 'n100', 'Valid Import restores notes correctly');
        assert(theme === 'dark', 'Valid Import restores tool settings correctly');

        // 3. Import Test: File with tampered points, premium, focus_sessions, badges, role
        testTamperedPrivileges();
    }, 10);
}

function testTamperedPrivileges() {
    localStorage.clear();
    const tamperedBackup = {
        version: 2,
        app: 'حيز',
        keys: {
            'hayyiz-todos': JSON.stringify([
                { id: 't200', text: 'مهمة ملغومة', points: 9999, premium: true, role: 'admin', badges: ['VIP'] }
            ]),
            'hayyiz-pomodoro-state': JSON.stringify({
                mode: 'focus',
                granted_focus_sessions: 500,
                is_premium: true,
                credits: 1000
            }),
            'hayyiz-points': '99999', // Disallowed top-level key
            'hayyiz-premium': 'true',  // Disallowed top-level key
            'hayyiz-theme': 'light'
        }
    };

    const file = { _content: JSON.stringify(tamperedBackup) };
    importHayyizData(file);

    setTimeout(() => {
        const todos = JSON.parse(localStorage.getItem('hayyiz-todos'));
        const pomodoroState = JSON.parse(localStorage.getItem('hayyiz-pomodoro-state'));

        assert(localStorage.getItem('hayyiz-points') === null, 'Import ignores disallowed top-level key hayyiz-points');
        assert(localStorage.getItem('hayyiz-premium') === null, 'Import ignores disallowed top-level key hayyiz-premium');

        assert(todos[0].text === 'مهمة ملغومة', 'Import preserves legitimate task text');
        assert(todos[0].points === undefined, 'Import recursively strips points property from task');
        assert(todos[0].premium === undefined, 'Import recursively strips premium property from task');
        assert(todos[0].role === undefined, 'Import recursively strips role property from task');
        assert(todos[0].badges === undefined, 'Import recursively strips badges property from task');

        assert(pomodoroState.mode === 'focus', 'Import preserves valid pomodoro mode');
        assert(pomodoroState.granted_focus_sessions === undefined, 'Import recursively strips granted_focus_sessions');
        assert(pomodoroState.is_premium === undefined, 'Import recursively strips is_premium');
        assert(pomodoroState.credits === undefined, 'Import recursively strips credits');

        testTamperedUserId();
    }, 10);
}

function testTamperedUserId() {
    localStorage.clear();
    const tamperedUserIdBackup = {
        version: 2,
        app: 'حيز',
        keys: {
            'hayyiz-todos': JSON.stringify([
                { id: 't300', text: 'مهمة مستخدم آخر', user_id: 'malicious_user_999', owner_id: 'victim_user_123' }
            ]),
            'hayyiz-user_id': 'malicious_user_999'
        }
    };

    const file = { _content: JSON.stringify(tamperedUserIdBackup) };
    importHayyizData(file);

    setTimeout(() => {
        const todos = JSON.parse(localStorage.getItem('hayyiz-todos'));

        assert(localStorage.getItem('hayyiz-user_id') === null, 'Import rejects top-level key hayyiz-user_id');
        assert(todos[0].id === 't300', 'Import keeps valid item ID');
        assert(todos[0].user_id === undefined, 'Import strips user_id property from item payload');
        assert(todos[0].owner_id === undefined, 'Import strips owner_id property from item payload');

        testPrototypePollutionAndNonFiniteNumbers();
    }, 10);
}

function testPrototypePollutionAndNonFiniteNumbers() {
    localStorage.clear();

    // 1. Prototype Pollution Payload
    const protoPollutionPayload = {
        version: 2,
        app: 'حيز',
        keys: {
            'hayyiz-todos': JSON.stringify([
                {
                    id: 't_proto_1',
                    text: 'مهمة اختبار الـ pollution',
                    "__proto__": { "isAdmin": true },
                    "constructor": { "prototype": { "isAdmin": true } },
                    "prototype": { "isAdmin": true }
                }
            ]),
            'hayyiz-pref-work': '25',
            'hayyiz-sessions': '0',
            'hayyiz-sessions-today': '120',
            'hayyiz-focus-minutes-today': 'Infinity',
            'hayyiz-pref-break': '-Infinity',
            'hayyiz-pref-long': 'NaN'
        }
    };

    const file = { _content: JSON.stringify(protoPollutionPayload) };
    importHayyizData(file);

    setTimeout(() => {
        const todos = JSON.parse(localStorage.getItem('hayyiz-todos'));

        // Verify Prototype Pollution Prevention
        assert(todos[0].id === 't_proto_1' && todos[0].text === 'مهمة اختبار الـ pollution', 'Import restores valid item data cleanly');
        assert(({}).isAdmin === undefined, 'Import does NOT cause prototype pollution via Object.prototype');
        assert(todos[0].__proto__ === undefined || Object.getPrototypeOf(todos[0]) === Object.prototype, 'Object prototype remains standard and unpolluted');
        assert(todos[0].constructor === undefined || todos[0].constructor === Object, 'Constructor property pollution prevented');
        assert(todos[0].prototype === undefined, 'Prototype property pollution stripped');

        // Verify Strict Finite Number Checking
        assert(localStorage.getItem('hayyiz-pref-work') === '25', 'Valid numeric value 25 imported successfully');
        assert(localStorage.getItem('hayyiz-sessions') === '0', 'Valid numeric value 0 imported successfully');
        assert(localStorage.getItem('hayyiz-sessions-today') === '120', 'Valid numeric value 120 imported successfully');

        assert(localStorage.getItem('hayyiz-focus-minutes-today') === null, 'Non-finite numeric value Infinity rejected');
        assert(localStorage.getItem('hayyiz-pref-break') === null, 'Non-finite numeric value -Infinity rejected');
        assert(localStorage.getItem('hayyiz-pref-long') === null, 'Non-finite numeric value NaN rejected');

        console.log(`\n===================================`);
        console.log(`SECURITY TEST SUITE RESULTS: ${passed} Passed, ${failed} Failed`);
        console.log(`===================================\n`);

        if (failed > 0) process.exit(1);
    }, 10);
}
