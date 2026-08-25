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

    currentUser = { id: 'user_dev_1' };
    mockDb = [];
    localStorage.clear();

    // SCENARIO 1: Notes Delete -> Refresh -> Remains Deleted
    console.log('--- SCENARIO 1: Notes Delete -> Refresh ---');
    const note1 = { id: 'n1', title: 'ملاحظة 1', content: 'محتوى 1', created: 1000, updated: 1000 };
    localStorage.setItem('hayyiz-notes', JSON.stringify([note1]));
    await hayyizUploadNote(note1);

    // User deletes note1 locally
    localStorage.setItem('hayyiz-notes', JSON.stringify([]));
    await hayyizDeleteRemoteNote('n1', note1);

    // Verify remote tombstone payload has non-null data and deleted_at
    const tombstoneRow1 = mockDb.find(r => r.tool === 'notes' && r.item_id === 'n1');
    assert(tombstoneRow1 && tombstoneRow1.data !== null && typeof tombstoneRow1.data === 'object' && tombstoneRow1.deleted_at !== null, 'Scenario 1: Tombstone payload contains data != null and deleted_at != null');

    // Refresh / Sync simulation
    await hayyizSyncNotes();
    const notesAfterRefresh = JSON.parse(localStorage.getItem('hayyiz-notes') || '[]');
    assert(notesAfterRefresh.length === 0, 'Scenario 1: Deleted note does NOT return on refresh');

    // SCENARIO 2: Notes Cross-Device Delete
    console.log('\n--- SCENARIO 2: Notes Cross-Device Delete ---');
    // Device A creates N2
    const note2 = { id: 'n2', title: 'ملاحظة 2', content: 'محتوى 2', created: 2000, updated: 2000 };
    localStorage.setItem('hayyiz-notes', JSON.stringify([note2]));
    await hayyizUploadNote(note2);

    // Device B syncs and receives N2
    localStorage.clear();
    await hayyizSyncNotes();
    let notesB = JSON.parse(localStorage.getItem('hayyiz-notes') || '[]');
    assert(notesB.length === 1 && notesB[0].id === 'n2', 'Scenario 2: Device B receives Note 2');

    // Device A deletes N2
    await hayyizDeleteRemoteNote('n2');

    // Device B syncs
    await hayyizSyncNotes();
    notesB = JSON.parse(localStorage.getItem('hayyiz-notes') || '[]');
    assert(notesB.length === 0, 'Scenario 2: Device B removes Note 2 after Device A deletes it');

    // SCENARIO 3: Todo Complete & Uncomplete Cross-Device
    console.log('\n--- SCENARIO 3: Todo Complete & Uncomplete Cross-Device ---');
    const task1 = { id: 't1', text: 'مهمة 1', completed: false, priority: 'high', created: 1000, updated: 1000 };
    localStorage.setItem('hayyiz-todos', JSON.stringify([task1]));
    await hayyizUploadItem('todos', 't1', task1);

    // Device B syncs
    localStorage.clear();
    await hayyizSyncTool('todos');
    let todosB = JSON.parse(localStorage.getItem('hayyiz-todos') || '[]');
    assert(todosB.length === 1 && todosB[0].completed === false, 'Scenario 3: Device B receives uncompleted Task 1');

    // Device A completes Task 1
    const task1Completed = { ...task1, completed: true, updated: 3000 };
    await hayyizUploadItem('todos', 't1', task1Completed);

    // Device B syncs
    await hayyizSyncTool('todos');
    todosB = JSON.parse(localStorage.getItem('hayyiz-todos') || '[]');
    assert(todosB[0].completed === true, 'Scenario 3: Device B sees completed status after Device A completes Task 1');

    // Device B uncompletes Task 1
    const task1Uncompleted = { ...todosB[0], completed: false, updated: 5000 };
    localStorage.setItem('hayyiz-todos', JSON.stringify([task1Uncompleted]));
    await hayyizUploadItem('todos', 't1', task1Uncompleted);

    // Device A syncs
    await hayyizSyncTool('todos');
    const todosA = JSON.parse(localStorage.getItem('hayyiz-todos') || '[]');
    assert(todosA[0].completed === false, 'Scenario 3: Device A sees uncompleted status after Device B uncompletes Task 1');

    // SCENARIO 4: Habits Cross-Device Sync
    console.log('\n--- SCENARIO 4: Habits Cross-Device Sync ---');
    const habit1 = { id: 'hb1', name: 'قراءة كتاب', streak: 3, lastCompleted: '2026-05-10', created: 1000, updated: 1000 };
    localStorage.setItem('hayyiz-habits', JSON.stringify([habit1]));
    await hayyizUploadItem('habits', 'hb1', habit1);

    localStorage.clear();
    await hayyizSyncTool('habits');
    const habitsB = JSON.parse(localStorage.getItem('hayyiz-habits') || '[]');
    assert(habitsB.length === 1 && habitsB[0].streak === 3, 'Scenario 4: Habits sync correctly to Device B');

    // SCENARIO 5: Calendar Add / Edit / Delete
    console.log('\n--- SCENARIO 5: Calendar Add / Edit / Delete ---');
    const exam1 = { id: 'ex1', name: 'اختبار الفيزياء', date: '2026-06-10', type: 'exam', updated: 1000 };
    localStorage.setItem('hayyiz-student-exams', JSON.stringify([exam1]));
    await hayyizUploadItem('student-exams', 'ex1', exam1);

    localStorage.clear();
    await hayyizSyncTool('student-exams');
    let examsB = JSON.parse(localStorage.getItem('hayyiz-student-exams') || '[]');
    assert(examsB.length === 1 && examsB[0].name === 'اختبار الفيزياء', 'Scenario 5: Calendar exam syncs to Device B');

    // Edit exam
    const exam1Edited = { ...exam1, name: 'اختبار الفيزياء المتقدم', updated: 4000 };
    await hayyizUploadItem('student-exams', 'ex1', exam1Edited);
    await hayyizSyncTool('student-exams');
    examsB = JSON.parse(localStorage.getItem('hayyiz-student-exams') || '[]');
    assert(examsB[0].name === 'اختبار الفيزياء المتقدم', 'Scenario 5: Calendar exam edit syncs to Device B');

    // Delete exam
    await hayyizDeleteRemoteItem('student-exams', 'ex1');
    await hayyizSyncTool('student-exams');
    examsB = JSON.parse(localStorage.getItem('hayyiz-student-exams') || '[]');
    assert(examsB.length === 0, 'Scenario 5: Calendar exam deletion syncs tombstone to Device B');

    // SCENARIO 6: Pomodoro Preferences Sync & Stable Timestamp
    console.log('\n--- SCENARIO 6: Pomodoro Preferences & Stable Timestamps ---');
    localStorage.setItem('hayyiz-pref-work', '40');
    localStorage.setItem('hayyiz-pref-break', '8');
    localStorage.setItem('hayyiz-pref-long', '20');
    localStorage.setItem('hayyiz-pomodoro-prefs-updated', '123456');
    await hayyizUploadItem('pomodoro-prefs', 'prefs', { work: '40', break: '8', long: '20' });

    localStorage.clear();
    await hayyizSyncTool('pomodoro-prefs');
    assert(localStorage.getItem('hayyiz-pref-work') === '40', 'Scenario 6: Pomodoro prefs work duration synced');

    const tsBefore = localStorage.getItem('hayyiz-pomodoro-prefs-updated');
    await hayyizSyncTool('pomodoro-prefs');
    const tsAfter = localStorage.getItem('hayyiz-pomodoro-prefs-updated');
    assert(tsBefore === tsAfter, 'Scenario 6: Page refresh / sync does NOT mutate stable metadata timestamp');

    // SCENARIO 7: Offline Deletion -> Reconnect -> Sync
    console.log('\n--- SCENARIO 7: Offline Deletion -> Reconnect -> Sync ---');
    // Device A goes offline
    const noteOffline = { id: 'n_off', title: 'أوفلاين', content: 'محتوى أوفلاين', created: 1000, updated: 1000 };
    localStorage.setItem('hayyiz-notes', JSON.stringify([noteOffline]));
    await hayyizUploadNote(noteOffline);

    // Simulate network disconnect
    let networkDbBackup = mockDb;
    mockDb = null; // network down

    // Delete offline with previous note data
    localStorage.setItem('hayyiz-notes', JSON.stringify([]));
    hayyizRecordLocalDelete('notes', 'n_off', 5000, noteOffline);

    // Reconnect network
    mockDb = networkDbBackup;

    // Run sync on Device A
    await hayyizSyncNotes();

    // Verify tombstone sent on reconnect has non-null data
    const tombstoneOffline = mockDb.find(r => r.tool === 'notes' && r.item_id === 'n_off');
    assert(tombstoneOffline && tombstoneOffline.data !== null && tombstoneOffline.deleted_at !== null, 'Scenario 7: Reconnected tombstone has non-null data and deleted_at');

    // Device B syncs
    localStorage.clear();
    await hayyizSyncNotes();
    const notesBOffline = JSON.parse(localStorage.getItem('hayyiz-notes') || '[]');
    assert(notesBOffline.length === 0, 'Scenario 7: Offline deletion pushes tombstone on reconnect and removes item on Device B');

    // SCENARIO 8: First Login Merge
    console.log('\n--- SCENARIO 8: First Login Merge ---');
    mockDb = [
        { user_id: 'user_dev_1', tool: 'todos', item_id: 't_remote', data: { id: 't_remote', text: 'مهمة سحابية', created: 1000, updated: 1000 }, updated_at: '2026-01-01T00:00:00Z', deleted_at: null }
    ];

    // Local unauthenticated data before login
    localStorage.setItem('hayyiz-todos', JSON.stringify([
        { id: 't_local', text: 'مهمة محلية', created: 2000, updated: 2000 }
    ]));

    // User logs in and runs sync
    await hayyizSyncTool('todos');
    const todosMerged = JSON.parse(localStorage.getItem('hayyiz-todos') || '[]');
    assert(todosMerged.length === 2 && todosMerged.some(t => t.id === 't_local') && todosMerged.some(t => t.id === 't_remote'), 'Scenario 8: First login merges local and remote data without data loss');

    // SCENARIO 9: Stale-State Audit Verification
    console.log('\n--- SCENARIO 9: Stale-State Audit Verification ---');
    const taskNewState = { id: 't_audit', text: 'النص الحديث جداً', completed: true, updated: 999999 };
    localStorage.setItem('hayyiz-todos', JSON.stringify([taskNewState]));
    await hayyizUploadItem('todos', 't_audit', taskNewState);

    const remoteRow = mockDb.find(r => r.tool === 'todos' && r.item_id === 't_audit');
    assert(remoteRow && remoteRow.data.text === 'النص الحديث جداً' && remoteRow.data.completed === true, 'Scenario 9: Payload sent to Supabase equals exact final local state');

    console.log(`\n===================================`);
    console.log(`TEST SUITE RESULTS: ${passed} Passed, ${failed} Failed`);
    console.log(`===================================\n`);

    if (failed > 0) process.exit(1);
}

runTests();
