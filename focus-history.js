/* Merge per-device, per-day focus counters without counting a session twice. */
(function (global) {
    'use strict';
    const storage = global.hayyizStorage || global.localStorage;
    const metadataKey = '__hayyiz_focus_v2';
    const stateKey = 'hayyiz-focus-history-state';
    const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
    function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
    function read(key, fallback) { try { return JSON.parse(storage.getItem(key) || 'null') || fallback; } catch (_) { return fallback; } }
    function number(value) { const n = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN; return Number.isSafeInteger(n) && n >= 0 ? n : 0; }
    function dateKey(date) {
        if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
        const d = new Date(date + 'T12:00:00');
        return !isNaN(d.getTime()) && d.getFullYear() === Number(date.slice(0, 4)) && d.getMonth() + 1 === Number(date.slice(5, 7)) && d.getDate() === Number(date.slice(8, 10));
    }
    function today() {
        const d = new Date();
        return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
    }
    function days(map) {
        const result = Object.create(null);
        Object.keys(object(map)).filter(dateKey).sort().forEach(date => {
            const row = object(map[date]);
            result[date] = { minutes: number(row.minutes), sessions: number(row.sessions) };
        });
        return result;
    }
    function totals(state) {
        const result = days(state.baseline);
        Object.values(state.devices).forEach(map => Object.keys(map).forEach(date => {
            const current = result[date] || { minutes: 0, sessions: 0 };
            result[date] = { minutes: current.minutes + map[date].minutes, sessions: current.sessions + map[date].sessions };
        }));
        return days(result);
    }
    function normalize(payload) {
        payload = object(payload);
        const meta = object(Object.prototype.hasOwnProperty.call(payload, metadataKey) ? payload[metadataKey] : null);
        const state = { baseline: days(meta.baseline), devices: Object.create(null), totalBaseline: number(meta.totalBaseline) };
        Object.keys(object(meta.devices)).filter(id => !forbidden.has(id) && /^[\w-]{1,128}$/.test(id)).sort().forEach(id => { state.devices[id] = days(meta.devices[id]); });
        const existing = totals(state);
        Object.keys(payload).filter(dateKey).sort().forEach(date => {
            const minutes = number(payload[date]);
            // Flat maps from old versions are a shared baseline, never a new
            // device contribution. Preserve their highest known value.
            const missing = Math.max(0, minutes - (existing[date]?.minutes || 0));
            if (missing) {
                const row = state.baseline[date] || { minutes: 0, sessions: 0 };
                state.baseline[date] = { minutes: row.minutes + missing, sessions: row.sessions };
            }
        });
        return state;
    }
    function payload(state) {
        const result = Object.create(null);
        Object.entries(totals(state)).forEach(([date, row]) => { result[date] = row.minutes; });
        const devices = Object.create(null);
        Object.keys(state.devices).sort().forEach(id => { devices[id] = days(state.devices[id]); });
        result[metadataKey] = { baseline: days(state.baseline), devices, totalBaseline: number(state.totalBaseline) };
        return result;
    }
    function localPayload() {
        const history = object(read('hayyiz-focus-history', {}));
        const stored = read(stateKey, null);
        const combined = Object.assign(Object.create(null), history);
        if (stored) combined[metadataKey] = stored;
        const state = normalize(combined);
        if (!stored) {
            state.totalBaseline = number(storage.getItem('hayyiz-sessions'));
            const counts = Object.create(null);
            const log = read('hayyiz-focus-sessions-log', []);
            (Array.isArray(log) ? log : []).filter(entry => entry && dateKey(entry.date) && entry.mode !== 'break').forEach(entry => { counts[entry.date] = (counts[entry.date] || 0) + 1; });
            const day = storage.getItem('hayyiz-sessions-day');
            if (dateKey(day)) {
                const row = state.baseline[day] || { minutes: 0, sessions: 0 };
                state.baseline[day] = { minutes: Math.max(row.minutes, number(storage.getItem('hayyiz-focus-minutes-today'))), sessions: Math.max(row.sessions, number(storage.getItem('hayyiz-sessions-today'))) };
            }
            Object.entries(counts).forEach(([date, count]) => {
                const row = state.baseline[date] || { minutes: 0, sessions: 0 };
                state.baseline[date] = { minutes: row.minutes, sessions: Math.max(row.sessions, count) };
            });
        }
        return payload(state);
    }
    function merge(local, remote) {
        const a = normalize(local), b = normalize(remote);
        function maxDays(x, y) {
            const result = Object.create(null);
            [...new Set([...Object.keys(x), ...Object.keys(y)])].sort().forEach(date => {
                result[date] = { minutes: Math.max(x[date]?.minutes || 0, y[date]?.minutes || 0), sessions: Math.max(x[date]?.sessions || 0, y[date]?.sessions || 0) };
            });
            return result;
        }
        const result = { baseline: maxDays(a.baseline, b.baseline), devices: Object.create(null), totalBaseline: Math.max(a.totalBaseline, b.totalBaseline) };
        [...new Set([...Object.keys(a.devices), ...Object.keys(b.devices)])].sort().forEach(id => { result.devices[id] = maxDays(a.devices[id] || {}, b.devices[id] || {}); });
        return payload(result);
    }
    function refresh(value) {
        const state = normalize(value || localPayload()), sum = totals(state), day = today();
        const row = sum[day] || { minutes: 0, sessions: 0 };
        storage.setItem('hayyiz-sessions-day', day);
        storage.setItem('hayyiz-focus-minutes-today', String(row.minutes));
        storage.setItem('hayyiz-sessions-today', String(row.sessions));
        const contributed = Object.values(state.devices).reduce((total, map) => total + Object.values(map).reduce((n, item) => n + item.sessions, 0), 0);
        storage.setItem('hayyiz-sessions', String(Math.max(state.totalBaseline, Object.values(state.baseline).reduce((n, row) => n + row.sessions, 0)) + contributed));
    }
    function apply(value) {
        const next = payload(normalize(value));
        const history = Object.fromEntries(Object.entries(next).filter(([date]) => dateKey(date)));
        const changed = JSON.stringify(read(stateKey, null)) !== JSON.stringify(next[metadataKey]) || JSON.stringify(read('hayyiz-focus-history', {})) !== JSON.stringify(history);
        storage.setItem(stateKey, JSON.stringify(next[metadataKey]));
        storage.setItem('hayyiz-focus-history', JSON.stringify(history));
        if (changed) storage.setItem('hayyiz-focus-history-updated', String(Math.max(Date.now(), number(storage.getItem('hayyiz-focus-history-updated')) + 1)));
        refresh(next);
        return next;
    }
    function record(date, minutes) {
        if (!dateKey(date) || !Number.isSafeInteger(minutes) || minutes <= 0) return;
        const state = normalize(localPayload());
        let id = storage.getItem('hayyiz-focus-writer-id') || (storage.deviceId ? storage.deviceId() : storage.getItem('hayyiz-device-id'));
        if (!id) { id = 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2); storage.setItem('hayyiz-device-id', id); }
        const map = state.devices[id] || (state.devices[id] = Object.create(null));
        const current = map[date] || { minutes: 0, sessions: 0 };
        map[date] = { minutes: current.minutes + minutes, sessions: current.sessions + 1 };
        return apply(payload(state));
    }
    global.hayyizReadFocusHistoryPayload = localPayload;
    global.hayyizMergeFocusHistoryPayload = merge;
    global.hayyizApplyFocusHistoryPayload = apply;
    global.hayyizRefreshFocusStats = refresh;
    global.hayyizRecordFocusMinutes = record;
})(typeof window !== 'undefined' ? window : globalThis);
