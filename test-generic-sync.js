const fs = require('fs');

// Mock browser environment for Node.js
global.window = global;
global.document = {
    readyState: 'complete',
    body: { classList: { toggle: () => {} } },
    documentElement: { classList: { toggle: () => {}, contains: () => false } },
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener: () => {}
};

global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
};

// Mock Supabase client & sync database
let currentUser = null;
let mockDb = [];

global.supabaseClient = {
    auth: {
        async getUser() {
            if (!currentUser) return { data: { user: null }, error: null };
            return { data: { user: currentUser }, error: null };
        },
        onAuthStateChange(cb) {
            this._authCb = cb;
        }
    },
    from(table) {
        return {
            _toolFilter: null,
            select() { return this; },
            eq(col, val) {
                if (col === 'tool') this._toolFilter = val;
                return this;
            },
            then(resolve) {
                if (mockDb === null) {
                    resolve({ data: null, error: { message: 'Network Error' } });
                    return;
                }
                let res = mockDb;
                if (this._toolFilter) {
                    res = res.filter(row => row.tool === this._toolFilter);
                }
                resolve({ data: JSON.parse(JSON.stringify(res)), error: null });
            },
            async upsert(payloads, options) {
                if (mockDb === null) return { error: { message: 'Network Error' } };
                const list = Array.isArray(payloads) ? payloads : [payloads];
                list.forEach(payload => {
                    const idx = mockDb.findIndex(r => r.user_id === payload.user_id && r.tool === payload.tool && r.item_id === payload.item_id);
                    if (idx >= 0) {
                        mockDb[idx] = JSON.parse(JSON.stringify(payload));
                    } else {
                        mockDb.push(JSON.parse(JSON.stringify(payload)));
                    }
                });
                return { error: null };
            }
        };
    }
};

// Load common.js and sync.js
const commonJs = fs.readFileSync('./common.js', 'utf8');
eval(commonJs);

const syncJs = fs.readFileSync('./sync.js', 'utf8');
eval(syncJs);

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

async function runTests() {
    console.log('=== RUNNING VERIFICATION TEST SUITE ===\n');

    // Test 1: Device A Calendar Item -> Supabase -> Device B
    currentUser = { id: 'user_dev_1' };
    mockDb = [];
    localStorage.clear();

    const calendarEventA = { id: 'ex_a1', name: 'اختبار الرياضيات', date: '2026-06-01', type: 'exam', updated: 1000 };
    localStorage.setItem('hayyiz-student-exams', JSON.stringify([calendarEventA]));

    await hayyizSyncAllUserData();
    assert(mockDb.some(r => r.tool === 'student-exams' && r.item_id === 'ex_a1'), 'Test 1: Device A calendar event uploads to Supabase');

    // Simulate Device B
    localStorage.clear();
    await hayyizSyncAllUserData();
    const examsB = JSON.parse(localStorage.getItem('hayyiz-student-exams') || '[]');
    assert(examsB.length === 1 && examsB[0].name === 'اختبار الرياضيات', 'Test 1: Device B receives calendar event on sync');

    // Test 2: Edit Calendar Event on Device A -> reaches Device B
    const editedExamA = { id: 'ex_a1', name: 'اختبار الرياضيات النهائي', date: '2026-06-05', type: 'exam', updated: 5000 };
    await hayyizUploadItem('student-exams', 'ex_a1', editedExamA);

    await hayyizSyncTool('student-exams');
    const examsBEdited = JSON.parse(localStorage.getItem('hayyiz-student-exams') || '[]');
    assert(examsBEdited[0].name === 'اختبار الرياضيات النهائي', 'Test 2: Device B updates calendar event upon sync');

    // Test 3: Delete Calendar Event on Device A -> tombstone -> deleted on Device B
    await hayyizDeleteRemoteItem('student-exams', 'ex_a1');
    assert(mockDb.some(r => r.tool === 'student-exams' && r.item_id === 'ex_a1' && r.deleted_at !== null), 'Test 3: Deleting calendar event sets tombstone');

    await hayyizSyncTool('student-exams');
    const examsBDeleted = JSON.parse(localStorage.getItem('hayyiz-student-exams') || '[]');
    assert(examsBDeleted.length === 0, 'Test 3: Tombstone deletes calendar event on Device B');

    // Test 4: Pomodoro Preferences Device A -> Device B
    localStorage.setItem('hayyiz-pref-work', '30');
    localStorage.setItem('hayyiz-pref-break', '6');
    localStorage.setItem('hayyiz-pref-long', '20');
    localStorage.setItem('hayyiz-pomodoro-prefs-updated', '1000');
    await hayyizUploadItem('pomodoro-prefs', 'prefs', { work: '30', break: '6', long: '20' });

    localStorage.clear();
    await hayyizSyncTool('pomodoro-prefs');
    assert(localStorage.getItem('hayyiz-pref-work') === '30' && localStorage.getItem('hayyiz-pref-break') === '6', 'Test 4: Pomodoro preferences sync to Device B');

    // Test 5: Stable timestamps - Opening page does NOT change pomodoro-prefs timestamp
    const tsBefore = localStorage.getItem('hayyiz-pomodoro-prefs-updated');
    await hayyizSyncTool('pomodoro-prefs');
    const tsAfter = localStorage.getItem('hayyiz-pomodoro-prefs-updated');
    assert(tsBefore === tsAfter, 'Test 5: Opening page / running sync does not mutate stable metadata timestamp');

    console.log(`\n===================================`);
    console.log(`TEST SUITE RESULTS: ${passed} Passed, ${failed} Failed`);
    console.log(`===================================\n`);

    if (failed > 0) process.exit(1);
}

runTests();
