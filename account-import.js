/* Explicitly copy unowned device data into the signed-in account. */
(function (global) {
    'use strict';
    const skipped = new Set(['hayyiz-pomodoro-state', 'hayyiz-current-task', 'hayyiz-current-task-id',
        'hayyiz-current-task-index', 'hayyiz-task-session', 'hayyiz-current-event', 'hayyiz-session-in-cycle',
        'hayyiz-deleted-items', 'hayyiz-focus-history', 'hayyiz-focus-history-state', 'hayyiz-sessions',
        'hayyiz-sessions-today', 'hayyiz-sessions-day', 'hayyiz-focus-minutes-today']);
    const maps = new Set(['hayyiz-subject-progress', 'hayyiz-multi-day-plans', 'hayyiz-day-reviews']);
    function parse(raw, fallback) { try { return JSON.parse(raw) || fallback; } catch (_) { return fallback; } }
    function stamp(row) {
        const value = row && (row.updated || row.updatedAt || row.lastUpdated || row.created || row.timestamp);
        return Number(value) || (typeof value === 'string' ? Date.parse(value) : 0) || 0;
    }
    function identity(row, index) {
        if (row.id) return String(row.id);
        // Stable IDs make a second explicit import safe for very old records.
        const text = JSON.stringify(row); let hash = 2166136261;
        for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
        return 'device_' + (hash >>> 0).toString(36) + '_' + index;
    }
    function mergeRows(current, incoming, deleted, tool) {
        const rows = new Map();
        current.forEach((row, index) => rows.set(identity(row, index), row));
        incoming.filter(row => row && !row.workspaceTaskId && !row.workspace_task_id).forEach((row, index) => {
            const id = identity(row, index), old = rows.get(id), tombstone = deleted[tool + ':' + id];
            const deletedAt = Number(tombstone && typeof tombstone === 'object' ? tombstone.timestamp : tombstone) || 0;
            if (!old && deletedAt >= stamp(row) && deletedAt > 0) return;
            if (!old || stamp(row) > stamp(old)) rows.set(id, Object.assign({}, row, { id }));
        });
        return [...rows.values()];
    }
    function focusPayload(keys) {
        const result = Object.assign(Object.create(null), parse(keys['hayyiz-focus-history'], {}));
        let state = parse(keys['hayyiz-focus-history-state'], null);
        if (!state) {
            const baseline = Object.create(null);
            Object.keys(result).filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day)).forEach(day => {
                baseline[day] = { minutes: Number(result[day]) || 0, sessions: 0 };
            });
            const log = parse(keys['hayyiz-focus-sessions-log'], []);
            if (Array.isArray(log)) log.filter(row => row && row.mode !== 'break' && /^\d{4}-\d{2}-\d{2}$/.test(row.date)).forEach(row => {
                const day = baseline[row.date] || (baseline[row.date] = { minutes: 0, sessions: 0 });
                day.sessions++;
            });
            const day = keys['hayyiz-sessions-day'];
            if (/^\d{4}-\d{2}-\d{2}$/.test(day || '')) {
                baseline[day] = { minutes: Math.max(baseline[day]?.minutes || 0, Number(keys['hayyiz-focus-minutes-today']) || 0),
                    sessions: Math.max(baseline[day]?.sessions || 0, Number(keys['hayyiz-sessions-today']) || 0) };
            }
            state = { baseline, devices: {}, totalBaseline: Number(keys['hayyiz-sessions']) || 0 };
        }
        result.__hayyiz_focus_v2 = state;
        return result;
    }
    function mergeBackups(current, incoming) {
        // Both inputs have already passed the full backup validator, including
        // drawing geometry. Do not send drawing points through a generic sanitizer.
        const keys = Object.assign(Object.create(null), current.keys);
        const deleted = parse(keys['hayyiz-deleted-items'], {});
        Object.entries(incoming.keys).forEach(([key, raw]) => {
            if (skipped.has(key) || key === 'hayyiz-free-spaces-v1') return;
            const before = parse(keys[key], null), after = parse(raw, null);
            if (Array.isArray(after)) {
                const tool = key === 'hayyiz-focus-sessions-log' ? 'focus-log' : key.replace('hayyiz-', '');
                keys[key] = JSON.stringify(mergeRows(Array.isArray(before) ? before : [], after, deleted, tool));
            } else if (maps.has(key) && after && typeof after === 'object') {
                // Retain existing account values for overlapping map entries.
                const merged = Object.assign(Object.create(null), after, before || {});
                if (key === 'hayyiz-subject-progress') Object.keys(after).forEach(id => {
                    merged[id] = Object.assign(Object.create(null), after[id], before && before[id] || {});
                });
                keys[key] = JSON.stringify(merged);
            } else if (keys[key] === undefined) keys[key] = raw;
        });
        const drawingKey = 'hayyiz-free-spaces-v1';
        const before = parse(keys[drawingKey], { spaces: [] }), after = parse(incoming.keys[drawingKey], { spaces: [] });
        const drawings = new Map((before.spaces || []).map(space => [space.id, { space, source: current }]));
        (after.spaces || []).forEach(space => {
            const old = drawings.get(space.id);
            if (!old || stamp(space) > stamp(old.space)) drawings.set(space.id, { space, source: incoming });
        });
        if (drawings.size) keys[drawingKey] = JSON.stringify({ spaces: [...drawings.values()].map(row => row.space) });
        const pdfFiles = [];
        drawings.forEach(({ space, source }) => {
            const file = (source.pdfFiles || []).find(file => file.id === space.id);
            if (file) pdfFiles.push(file);
        });
        const focus = global.hayyizMergeFocusHistoryPayload(focusPayload(current.keys), focusPayload(incoming.keys));
        keys['hayyiz-focus-history-state'] = JSON.stringify(focus.__hayyiz_focus_v2);
        keys['hayyiz-focus-history'] = JSON.stringify(Object.fromEntries(Object.entries(focus).filter(([key]) => /^\d{4}-\d{2}-\d{2}$/.test(key))));
        return { version: 3, app: 'حيز', exportedAt: new Date().toISOString(), keys, pdfFiles };
    }
    global.hayyizMergeDeviceBackups = mergeBackups;
    document.addEventListener('DOMContentLoaded', () => {
        const storage = global.hayyizStorage, wrapper = document.getElementById('hayyiz-device-data-controls');
        const button = document.getElementById('hayyiz-claim-device-data'), status = document.getElementById('hayyiz-claim-status');
        if (!storage || !storage.accountId || !wrapper || !button) return;
        const snapshot = storage.guestSnapshot();
        if (!Object.keys(snapshot).some(key => !skipped.has(key) && snapshot[key] && !['[]', '{}', 'null', '0'].includes(snapshot[key]))) return;
        wrapper.hidden = false;
        button.addEventListener('click', async () => {
            if (!confirm('ستُضاف بيانات الزائر المحفوظة على هذا الجهاز إلى حسابك الحالي. تبقى نسخة الزائر على الجهاز؛ وتُحفظ بيانات الحساب عند تعارض إعداداته. هل تريد المتابعة؟')) return;
            button.disabled = true;
            if (status) status.textContent = 'جارٍ فحص البيانات ودمجها…';
            try {
                const source = { getItem(key) { return snapshot[key] === undefined ? null : snapshot[key]; } };
                const incoming = await global.hayyizCreateBackupFromStorage(source, 'hayyiz-pdf-db');
                const current = await global.hayyizCreateBackup();
                const merged = mergeBackups(current, incoming), validated = global.hayyizValidateBackup(merged);
                if (validated.missingPdfIds.length && !confirm('توجد ملفات PDF غير متاحة ضمن بيانات الجهاز. هل تريد إضافة الرسومات دون خلفيات هذه الملفات؟')) return;
                if (!storage.isCurrentScope(storage.scope)) throw new Error('تغيّر الحساب. أعد فتح الصفحة.');
                await global.hayyizRestoreBackup(merged);
                global.hayyizRefreshFocusStats();
                if (status) status.textContent = 'أُضيفت البيانات إلى حسابك. ستستمر مزامنتها عند توفر الاتصال.';
                if (typeof global.hayyizSyncAllUserData === 'function') await global.hayyizSyncAllUserData();
                global.location.reload();
            } catch (error) { if (status) status.textContent = error.message || 'تعذرت إضافة البيانات. احتُفظ بالنسختين.'; }
            finally { button.disabled = false; }
        });
    });
})(window);
