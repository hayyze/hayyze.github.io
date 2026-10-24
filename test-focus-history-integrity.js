const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const accountSource = fs.readFileSync('account-storage.js', 'utf8');
const historySource = fs.readFileSync('focus-history.js', 'utf8');
const authKey = 'sb-dzfdbjnqtgltuguqqdkz-auth-token';
const userId = '11111111-1111-4111-8111-111111111111';
const metadataKey = '__hayyiz_focus_v2';
const today = '2026-10-23';
const yesterday = '2026-10-22';
const earlier = '2026-10-21';
const clone = value => JSON.parse(JSON.stringify(value));

class NativeStorage {
    constructor() { this.data = new Map(); }
    getItem(key) { return this.data.get(String(key)) ?? null; }
    setItem(key, value) { this.data.set(String(key), String(value)); }
    removeItem(key) { this.data.delete(String(key)); }
    key(index) { return Array.from(this.data.keys())[index] ?? null; }
    get length() { return this.data.size; }
    clear() { this.data.clear(); }
}

function browser(deviceId, initial = {}) {
    const native = new NativeStorage();
    native.setItem(authKey, JSON.stringify({ user: { id: userId } }));
    native.setItem('hayyiz-device-id', deviceId);
    const clock = { now: new Date(2026, 9, 23, 12, 0, 0).getTime() };
    class ClockDate extends Date {
        constructor(...args) { super(...(args.length ? args : [clock.now])); }
        static now() { return clock.now; }
    }
    const context = vm.createContext({
        localStorage: native, Date: ClockDate, console,
        crypto: { randomUUID: () => deviceId },
        addEventListener() {}, location: { reload() {} }
    });
    context.window = context;
    vm.runInContext(accountSource, context, { filename: 'account-storage.js' });
    for (const [key, value] of Object.entries(initial)) context.hayyizStorage.setItem(key, value);
    vm.runInContext(historySource, context, { filename: 'focus-history.js' });
    return {
        context, native, clock, storage: context.hayyizStorage,
        read: () => clone(context.hayyizReadFocusHistoryPayload()),
        record: (date, minutes) => context.hayyizRecordFocusMinutes(date, minutes),
        merge: (a, b) => clone(context.hayyizMergeFocusHistoryPayload(a, b)),
        apply: value => clone(context.hayyizApplyFocusHistoryPayload(value)),
        refresh: () => context.hayyizRefreshFocusStats(),
        sync(value) { return this.apply(this.merge(this.read(), value)); }
    };
}

function legacy(minutes = 25, date = today) {
    return {
        'hayyiz-focus-history': JSON.stringify({ [date]: minutes }),
        'hayyiz-sessions': '1',
        'hayyiz-sessions-day': date,
        'hayyiz-focus-minutes-today': String(minutes),
        'hayyiz-sessions-today': '1'
    };
}

function storedHistory(tab) { return JSON.parse(tab.storage.getItem('hayyiz-focus-history') || '{}'); }
function daySessions(payload, day) {
    const metadata = payload[metadataKey];
    return (metadata.baseline[day]?.sessions || 0) + Object.values(metadata.devices).reduce((count, map) => count + (map[day]?.sessions || 0), 0);
}
function checkStats(tab, minutes, sessions, total) {
    assert.equal(tab.storage.getItem('hayyiz-sessions-day'), today);
    assert.equal(tab.storage.getItem('hayyiz-focus-minutes-today'), String(minutes));
    assert.equal(tab.storage.getItem('hayyiz-sessions-today'), String(sessions));
    assert.equal(tab.storage.getItem('hayyiz-sessions'), String(total));
    assert.equal(storedHistory(tab)[today] || 0, minutes);
}

let failures = 0;
function check(name, run) {
    try { run(); console.log('PASS ' + name); }
    catch (error) { failures++; console.error('FAIL ' + name); console.error(error); }
}

check('two devices of one account retain both same-day sessions, 25 + 30 = 55', () => {
    const a = browser('device_A'), b = browser('device_B');
    assert.equal(a.storage.accountId, b.storage.accountId);
    assert.notEqual(a.storage.deviceId(), b.storage.deviceId());
    a.record(today, 25); b.record(today, 30);
    const merged = a.merge(a.read(), b.read());
    assert.equal(merged[today], 55);
    assert.equal(daySessions(merged, today), 2);
    assert.deepEqual(merged[metadataKey].devices.device_A[today], { minutes: 25, sessions: 1 });
    assert.deepEqual(merged[metadataKey].devices.device_B[today], { minutes: 30, sessions: 1 });
    a.apply(merged); b.apply(merged);
    checkStats(a, 55, 2, 2); checkStats(b, 55, 2, 2);
    assert.equal(a.native.getItem('hayyiz-focus-history'), null);
    assert.equal(b.native.getItem('hayyiz-focus-history'), null);
});

check('a newer counter from the same device replaces its old snapshot without counting it twice', () => {
    const a = browser('device_A');
    a.record(today, 25); const old = a.read();
    a.record(today, 30); const current = a.read();
    const merged = a.merge(old, current);
    assert.equal(merged[today], 55); assert.equal(daySessions(merged, today), 2);
    assert.deepEqual(a.merge(current, old), merged);
    assert.deepEqual(a.merge(merged, old), merged);
    assert.deepEqual(a.merge(merged, current), merged);
});

check('the shared legacy 25-minute baseline is counted once before independent additions of 10 and 20', () => {
    const a = browser('device_A', legacy()), b = browser('device_B', legacy());
    a.record(today, 10); b.record(today, 20);
    const result = a.merge(a.read(), b.read());
    assert.equal(result[today], 55);
    assert.deepEqual(result[metadataKey].baseline[today], { minutes: 25, sessions: 1 });
    assert.equal(daySessions(result, today), 3);
    a.apply(result); b.apply(result);
    checkStats(a, 55, 3, 3); checkStats(b, 55, 3, 3);
});

check('merges are commutative, associative, idempotent and stable across arrival order', () => {
    const tabs = ['device_A', 'device_B', 'device_C'].map(id => browser(id, legacy()));
    [10, 20, 15].forEach((minutes, index) => tabs[index].record(today, minutes));
    tabs[0].record(yesterday, 8); tabs[1].record(earlier, 12);
    const [a, b, c] = tabs.map(tab => tab.read()), merge = tabs[0].merge;
    assert.deepEqual(merge(a, b), merge(b, a));
    const result = merge(merge(a, b), c);
    assert.deepEqual(merge(a, merge(b, c)), result);
    assert.deepEqual(merge(result, result), result);
    for (const order of [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]]) {
        assert.deepEqual(order.reduce((combined, next) => merge(combined, next), {}), result);
    }
    assert.equal(result[today], 70); assert.equal(daySessions(result, today), 4);
    assert.equal(result[yesterday], 8); assert.equal(result[earlier], 12);
    tabs.forEach(tab => { tab.sync(result); assert.deepEqual(tab.read(), result); checkStats(tab, 70, 4, 6); });
});

check('legacy histories on different days survive migration and bidirectional merging', () => {
    const a = browser('device_A', legacy(25, yesterday));
    const b = browser('device_B', legacy(30, earlier));
    const result = a.merge(a.read(), b.read());
    assert.equal(result[yesterday], 25); assert.equal(result[earlier], 30);
    a.apply(result); b.sync(a.read());
    assert.equal(storedHistory(b)[yesterday], 25); assert.equal(storedHistory(b)[earlier], 30);
    assert.deepEqual(a.read(), b.read());
    checkStats(a, 0, 0, 2); checkStats(b, 0, 0, 2);
});

check('a legacy flat-map increment beside old metadata adds only its missing residual once', () => {
    const a = browser('device_A', legacy()), b = browser('device_B', legacy());
    a.record(today, 10); b.record(today, 20);
    const oldClient = a.read();
    oldClient[today] += 5;
    const repaired = a.merge({}, oldClient);
    assert.equal(repaired[today], 40);
    assert.equal(repaired[metadataKey].baseline[today].minutes, 30);
    assert.equal(repaired[metadataKey].devices.device_A[today].minutes, 10);
    const result = a.merge(repaired, b.read());
    assert.equal(result[today], 60);
    assert.deepEqual(a.merge(result, oldClient), result);
    assert.deepEqual(a.merge(oldClient, result), result);
    assert.deepEqual(a.merge(result, repaired), result);
    a.apply(result);
    assert.deepEqual(a.read(), result);
    assert.deepEqual(a.sync(oldClient), result);
    const staleFlat = clone(result); staleFlat[today] = 1;
    assert.deepEqual(a.merge(result, staleFlat), result);
});

check('synced today counters and stored daily history are refreshed from the same merged totals', () => {
    const a = browser('device_A', legacy(25, yesterday)), b = browser('device_B');
    a.record(today, 10); b.record(today, 20);
    b.record(yesterday, 15);
    const result = a.sync(b.read()); b.apply(result);
    checkStats(a, 30, 2, 4); checkStats(b, 30, 2, 4);
    a.storage.setItem('hayyiz-focus-minutes-today', '999');
    a.storage.setItem('hayyiz-sessions-today', '999');
    a.refresh();
    checkStats(a, 30, 2, 4);
    const timestamp = a.storage.getItem('hayyiz-focus-history-updated');
    a.clock.now += 1000;
    a.apply(result);
    assert.equal(a.storage.getItem('hayyiz-focus-history-updated'), timestamp);
});

check('a session recorded for a previous day does not become a session completed today', () => {
    const a = browser('device_A');
    a.record(yesterday, 25);
    assert.equal(storedHistory(a)[yesterday], 25);
    checkStats(a, 0, 0, 1);
    a.record(today, 30);
    checkStats(a, 30, 1, 2);
});

check('legacy session logs infer per-day focus counts without counting breaks or losing the global baseline', () => {
    const a = browser('device_A', {
        'hayyiz-focus-history': JSON.stringify({ [yesterday]: 25, [today]: 50 }),
        'hayyiz-sessions': '7',
        'hayyiz-focus-sessions-log': JSON.stringify([
            { date: yesterday, mode: 'focus' }, { date: today, mode: 'focus' },
            { date: today, mode: 'focus' }, { date: today, mode: 'break' },
            { date: '2026-02-30', mode: 'focus' }, null
        ])
    });
    const initial = a.read();
    assert.equal(daySessions(initial, yesterday), 1); assert.equal(daySessions(initial, today), 2);
    a.apply(initial); checkStats(a, 50, 2, 7);
    a.record(today, 10); checkStats(a, 60, 3, 8);
});

check('invalid dates and nonpositive or malformed recording inputs leave counters untouched', () => {
    const a = browser('device_A');
    a.record(today, 25);
    const before = a.read(), writes = Array.from(a.native.data);
    for (const [date, minutes] of [
        ['2026-02-30', 25], ['2026-2-03', 25], ['not-a-date', 25], [null, 25],
        [today, 0], [today, -1], [today, NaN], [today, Infinity], [today, 1.5],
        [today, '25'], [today, Number.MAX_SAFE_INTEGER + 1]
    ]) assert.equal(a.record(date, minutes), undefined);
    assert.deepEqual(a.read(), before); assert.deepEqual(Array.from(a.native.data), writes);
});

check('malformed metadata ignores forbidden device names, invalid dates and invalid counters', () => {
    const a = browser('device_A');
    const hostile = JSON.parse('{"2026-10-23":5,"2026-02-30":99,"__hayyiz_focus_v2":{"baseline":{"2026-10-23":{"minutes":-1,"sessions":-2}},"devices":{"__proto__":{"2026-10-23":{"minutes":500,"sessions":50}},"constructor":{"2026-10-23":{"minutes":500,"sessions":50}},"prototype":{"2026-10-23":{"minutes":500,"sessions":50}},"invalid/name":{"2026-10-23":{"minutes":500,"sessions":50}},"good_device":{"2026-10-23":{"minutes":5,"sessions":1},"2026-02-30":{"minutes":99,"sessions":99},"2026-10-22":{"minutes":-3,"sessions":1.5}}},"totalBaseline":-1}}');
    const result = a.apply(hostile);
    assert.equal(result[today], 5); assert.equal(daySessions(result, today), 1);
    assert.deepEqual(Object.keys(result[metadataKey].devices), ['good_device']);
    assert.equal(Object.hasOwn(result, '2026-02-30'), false);
    assert.equal(result[yesterday], 0);
    assert.deepEqual(result[metadataKey].devices.good_device[yesterday], { minutes: 0, sessions: 0 });
    assert.equal(vm.runInContext('({}).polluted', a.context), undefined);
    assert.equal({}.polluted, undefined);
    checkStats(a, 5, 1, 1);
    assert.doesNotThrow(() => a.apply({ [metadataKey]: { baseline: [], devices: [], totalBaseline: null } }));
});

check('malformed object-valued counters fail safely while preserving valid days', () => {
    const a = browser('device_A');
    const hostile = JSON.parse('{"2026-10-22":12,"2026-10-23":{"toString":false,"valueOf":false},"__hayyiz_focus_v2":{"baseline":{"2026-10-21":{"minutes":{"toString":false,"valueOf":false},"sessions":-1}},"devices":{},"totalBaseline":{"toString":false,"valueOf":false}}}');
    const result = a.apply(hostile);
    assert.equal(result[yesterday], 12);
    assert.equal(result[today] || 0, 0);
    assert.equal(result[metadataKey].totalBaseline, 0);
    assert.equal(vm.runInContext('({}).polluted', a.context), undefined);
});

check('a __proto__ key in legacy JSON cannot inject inherited focus metadata during local migration', () => {
    const malicious = JSON.stringify({
        [today]: 25,
        ['__proto__']: { [metadataKey]: { baseline: { [today]: { minutes: 500, sessions: 50 } }, devices: {}, totalBaseline: 50 } }
    });
    const a = browser('device_A', { 'hayyiz-focus-history': malicious });
    const result = a.read();
    assert.equal(result[today], 25);
    assert.equal(daySessions(result, today), 0);
    assert.equal(result[metadataKey].totalBaseline, 0);
    assert.equal(vm.runInContext('({}).polluted', a.context), undefined);
});

check('broken JSON metadata falls back to existing legacy data without erasing valid history', () => {
    const a = browser('device_A', {
        ...legacy(), 'hayyiz-focus-history-state': '{broken JSON',
        'hayyiz-focus-sessions-log': '{broken log'
    });
    assert.equal(a.read()[today], 25);
    a.record(today, 10); checkStats(a, 35, 2, 2);
    const b = browser('device_B', { 'hayyiz-focus-history': '[1,2]', 'hayyiz-focus-history-state': 'null' });
    assert.doesNotThrow(() => b.refresh());
    b.record(today, 5); checkStats(b, 5, 1, 1);
});

if (failures) process.exitCode = 1;
else console.log('All focus history integrity tests passed.');
