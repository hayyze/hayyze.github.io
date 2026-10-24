var hayyizStorage = (typeof window !== 'undefined' && window.hayyizStorage) || (typeof localStorage !== 'undefined' ? localStorage : undefined);
/**
 * sync.js — محرك المزامنة السحابية العام لمنصة حيز عبر Supabase
 * يوفر مزامنة سحابية غير معطلة لكافة أدوات حيز للمستخدمين المصادق عليهم.
 * مُحسَّن للمزامنة التزايدية (Incremental Sync) والأمان مع تقليل استهلاك البيانات والـ Egress.
 */

(function (global) {
    'use strict';

    const TOMBSTONE_MAX_AGE_DAYS = 30;
    const TOMBSTONE_RETENTION_MS = TOMBSTONE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const RECENT_TIMESTAMP_THRESHOLD_MS = 1577836800000; // Jan 1, 2020

    let isSyncingAll = false;
    const syncingTools = new Set();
    const inFlightToolPromises = new Map();
    const syncCallbacks = new Map(); // tool -> Array<Function>
    let authListenerRegistered = false;
    let authEpoch = 0;
    let authUserId;
    const remoteWriteQueues = new Map();
    let focusOutboxPromise = null;

    function currentRequest(user, epoch, scope) {
        return epoch === authEpoch && (authUserId === undefined || authUserId === user.id) &&
            (!hayyizStorage.isCurrentUser || hayyizStorage.isCurrentUser(user.id)) &&
            (!hayyizStorage.isCurrentScope || hayyizStorage.isCurrentScope(scope));
    }

    function writeRemoteRows(tool, rows, user, epoch, scope) {
        const key = (scope || user.id) + ':' + tool;
        const copy = JSON.parse(JSON.stringify(rows));
        const previous = remoteWriteQueues.get(key) || Promise.resolve();
        const write = previous.catch(() => {}).then(async () => {
            if (!currentRequest(user, epoch, scope)) return { error: { message: 'Account changed' } };
            return executeWithBackoff(() => currentRequest(user, epoch, scope)
                ? supabaseClient.from('sync_items').upsert(copy, { onConflict: 'user_id,tool,item_id' })
                : Promise.resolve({ error: { message: 'Account changed' } }));
        });
        remoteWriteQueues.set(key, write);
        return write.finally(() => { if (remoteWriteQueues.get(key) === write) remoteWriteQueues.delete(key); });
    }

    function safeIsoTimestamp(ts) {
        if (ts === null || ts === undefined || ts === 0) {
            return new Date().toISOString();
        }
        if (typeof ts === 'string') {
            const parsedMs = Date.parse(ts);
            if (!isNaN(parsedMs) && parsedMs > RECENT_TIMESTAMP_THRESHOLD_MS) {
                return new Date(parsedMs).toISOString();
            }
        }
        const num = Number(ts);
        if (!isNaN(num) && num > RECENT_TIMESTAMP_THRESHOLD_MS) {
            return new Date(num).toISOString();
        }
        return new Date().toISOString();
    }

    /**
     * تسجيل دالة تنبيه عند استلام تحديثات سحابية لأداة معينة
     */
    function hayyizRegisterSyncCallback(tool, fn) {
        if (!tool || typeof fn !== 'function') return;
        if (!syncCallbacks.has(tool)) {
            syncCallbacks.set(tool, []);
        }
        syncCallbacks.get(tool).push(fn);
    }

    /**
     * التوافق مع الملاحظات
     */
    function hayyizRegisterNotesSyncCallback(fn) {
        hayyizRegisterSyncCallback('notes', fn);
    }

    /**
     * الحصول على المستخدم الحالي بأمان
     */
    async function getAuthenticatedUser() {
        const epoch = authEpoch;
        let client = typeof supabaseClient !== 'undefined' ? supabaseClient : null;
        if (!client && typeof ensureSupabaseLoaded === 'function') {
            try { client = await ensureSupabaseLoaded(); } catch(e){}
        }
        if (!client || !client.auth) return null;
        try {
            const { data, error } = await client.auth.getUser();
            if (error || !data || !data.user) return null;
            if (epoch !== authEpoch) return null;
            if (hayyizStorage.isCurrentUser && !hayyizStorage.isCurrentUser(data.user.id)) {
                hayyizStorage.transitionTo(data.user.id);
                return null;
            }
            if (authUserId !== undefined && authUserId !== data.user.id) authEpoch++;
            authUserId = data.user.id;
            return data.user;
        } catch (e) {
            return null;
        }
    }

    /**
     * قراءة عنصر من LocalStorage بأمان
     */
    function getLocalStorageItem(key, fallback = null) {
        try {
            const val = hayyizStorage.getItem(key);
            if (val === null || val === undefined) return fallback;
            return JSON.parse(val);
        } catch (e) {
            return fallback;
        }
    }

    /**
     * كتابة عنصر في LocalStorage بأمان
     */
    function setLocalStorageItem(key, val) {
        try {
            if (val === null || val === undefined) {
                hayyizStorage.removeItem(key);
            } else {
                hayyizStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
            }
        } catch (e) {
            console.warn('[Sync Engine] LocalStorage write failed:', e);
        }
    }

    /* =========================================================
     * سجل الشواهد والحذف المحلي وتنظيف الشواهد القديمة
     * ========================================================= */
    function getDeletedItemsRegistry() {
        return getLocalStorageItem('hayyiz-deleted-items', {}) || {};
    }

    function hayyizCleanupOldLocalTombstones() {
        const registry = getDeletedItemsRegistry();
        const now = Date.now();
        let changed = false;
        Object.keys(registry).forEach(key => {
            const entry = registry[key];
            const ts = entry && typeof entry === 'object' ? Number(entry.timestamp || 0) : Number(entry || 0);
            if (ts > 0 && (now - ts) > TOMBSTONE_RETENTION_MS) {
                delete registry[key];
                changed = true;
            }
        });
        if (changed) {
            setLocalStorageItem('hayyiz-deleted-items', registry);
        }
    }

    function hayyizRecordLocalDelete(tool, itemId, timestamp, previousData) {
        if (!tool || !itemId) return;
        const registry = getDeletedItemsRegistry();
        const key = String(tool) + ':' + String(itemId);
        let ts = Number(timestamp || Date.now());
        if (ts < RECENT_TIMESTAMP_THRESHOLD_MS) {
            ts = Date.now();
        }
        if (previousData && typeof previousData === 'object') {
            registry[key] = { timestamp: ts, data: previousData };
        } else if (registry[key] && typeof registry[key] === 'object' && registry[key].data) {
            registry[key] = { timestamp: ts, data: registry[key].data };
        } else {
            registry[key] = ts;
        }
        setLocalStorageItem('hayyiz-deleted-items', registry);
        hayyizCleanupOldLocalTombstones();
    }

    function hayyizClearLocalDelete(tool, itemId) {
        if (!tool || !itemId) return;
        const registry = getDeletedItemsRegistry();
        const key = String(tool) + ':' + String(itemId);
        if (registry[key]) {
            delete registry[key];
            setLocalStorageItem('hayyiz-deleted-items', registry);
        }
    }

    function getLocalDeleteTime(tool, itemId) {
        if (!tool || !itemId) return 0;
        const registry = getDeletedItemsRegistry();
        const key = String(tool) + ':' + String(itemId);
        const entry = registry[key];
        if (entry && typeof entry === 'object') {
            return Number(entry.timestamp || 0);
        }
        return Number(entry || 0);
    }

    function getLocalDeleteData(tool, itemId) {
        if (!tool || !itemId) return null;
        const registry = getDeletedItemsRegistry();
        const key = String(tool) + ':' + String(itemId);
        const entry = registry[key];
        if (entry && typeof entry === 'object' && entry.data) {
            return entry.data;
        }
        return null;
    }

    /* =========================================================
     * طوابع زمنية للمزامنة التزايدية (Incremental Sync Timestamps)
     * ========================================================= */
    function getLastSyncTime(toolName) {
        return hayyizStorage.getItem('hayyiz-sync-last-time-' + toolName) || null;
    }

    function setLastSyncTime(toolName, isoTimestamp) {
        if (isoTimestamp) {
            hayyizStorage.setItem('hayyiz-sync-last-time-' + toolName, isoTimestamp);
        }
    }

    /* =========================================================
     * Exponential Backoff & Retry Control
     * ========================================================= */
    async function executeWithBackoff(fn, maxRetries = 2) {
        let delay = 1000;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const res = await fn();
                if (res && res.error) {
                    const msg = (res.error.message || '').toLowerCase();
                    const status = res.error.status || (msg.includes('429') ? 429 : 0);
                    if (status === 429 || msg.includes('rate limit') || msg.includes('fetch') || msg.includes('network')) {
                        if (attempt < maxRetries) {
                            await new Promise(r => setTimeout(r, delay));
                            delay *= 2;
                            continue;
                        }
                    }
                }
                return res;
            } catch (e) {
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, delay));
                    delay *= 2;
                    continue;
                }
                return { error: e };
            }
        }
    }

    /* =========================================================
     * سجل محولات الأدوات (Tool Adapters Registry)
     * ========================================================= */
    const TOOL_ADAPTERS = {
        'notes': {
            tool: 'notes',
            type: 'collection',
            storageKey: 'hayyiz-notes',
            getId: item => item && item.id,
            getTimestamp: item => Number(item && (item.updated || item.created || 0))
        },
        'todos': {
            tool: 'todos',
            type: 'collection',
            storageKey: 'hayyiz-todos',
            getId: item => item && item.id,
            getTimestamp: item => Number(item && (item.updated || item.created || 0))
        },
        'habits': {
            tool: 'habits',
            type: 'collection',
            storageKey: 'hayyiz-habits',
            getId: item => item && item.id,
            getTimestamp: item => Number(item && (item.updated || item.created || 0))
        },
        'student-exams': {
            tool: 'student-exams',
            type: 'collection',
            storageKey: 'hayyiz-student-exams',
            getId: item => item && item.id,
            getTimestamp: item => Number(item && (item.updated || item.created || 0))
        },
        'custom-events': {
            tool: 'custom-events',
            type: 'collection',
            storageKey: 'hayyiz-custom-events',
            getId: item => item && item.id,
            getTimestamp: item => Number(item && (item.updated || item.created || 0))
        },
        'subjects': {
            tool: 'subjects',
            type: 'collection',
            storageKey: 'hayyiz-subjects',
            getId: item => item && item.id,
            getTimestamp: item => Number(item && (item.updated || item.created || 0))
        },
        'focus-log': {
            tool: 'focus-log',
            type: 'collection',
            storageKey: 'hayyiz-focus-sessions-log',
            getId: item => item && item.id,
            getTimestamp: item => Number(item && (item.updated || (item.timestamp ? new Date(item.timestamp).getTime() : (item.created || 0))))
        },
        'gpa-snapshot': {
            tool: 'gpa-snapshot',
            type: 'single',
            storageKey: 'hayyiz-gpa-snapshot',
            itemId: 'snapshot',
            getTimestamp: item => Number(item && (item.updatedAt || item.created || 0))
        },
        'academic-goal': {
            tool: 'academic-goal',
            type: 'single',
            storageKey: 'hayyiz-academic-goal',
            itemId: 'goal',
            getTimestamp: item => Number(item && (item.updatedAt || item.created || 0))
        },
        'subject-goals': {
            tool: 'subject-goals',
            type: 'collection',
            storageKey: 'hayyiz-subject-goals',
            getId: item => item && (item.id || item.name),
            getTimestamp: item => Number(item && (item.updated || item.created || 0))
        },
        'daily-goal': {
            tool: 'daily-goal',
            type: 'single',
            storageKey: 'hayyiz-daily-goal',
            itemId: 'goal',
            getTimestamp: item => Number(item && (item.updated || item.created || 0))
        },
        'birthdate': {
            tool: 'birthdate',
            type: 'single',
            storageKey: 'hayyiz-birthdate',
            itemId: 'birthdate',
            getLocalStorage: () => {
                const raw = hayyizStorage.getItem('hayyiz-birthdate');
                if (raw === null) return null;
                try { return JSON.parse(raw); } catch (_) { return raw; }
            },
            getTimestamp: () => Number(hayyizStorage.getItem('hayyiz-birthdate-updated') || 0)
        },
        'focus-history': {
            tool: 'focus-history',
            type: 'single',
            storageKey: 'hayyiz-focus-history',
            itemId: 'history',
            mergeHistory: true,
            getLocalStorage: () => typeof hayyizReadFocusHistoryPayload === 'function' ? hayyizReadFocusHistoryPayload() : getLocalStorageItem('hayyiz-focus-history', {}),
            setLocalStorage: data => {
                if (typeof hayyizApplyFocusHistoryPayload === 'function' && data) hayyizApplyFocusHistoryPayload(data);
                else setLocalStorageItem('hayyiz-focus-history', data);
            },
            getTimestamp: () => Number(hayyizStorage.getItem('hayyiz-focus-history-updated') || 0)
        },
        'multi-day-plans': {
            tool: 'multi-day-plans', type: 'single', storageKey: 'hayyiz-multi-day-plans', itemId: 'plans',
            mergeMap: true,
            getLocalStorage: () => typeof hayyizGetPlanSyncData === 'function' ? hayyizGetPlanSyncData(getLocalStorageItem('hayyiz-multi-day-plans', {})) : getLocalStorageItem('hayyiz-multi-day-plans', {}),
            setLocalStorage: data => {
                const existing = getLocalStorageItem('hayyiz-multi-day-plans', {}) || {};
                const merged = {};
                Object.keys(data || {}).filter(key => !['__proto__', 'constructor', 'prototype'].includes(key)).forEach(key => {
                    merged[key] = Object.assign({}, existing[key] || {}, data[key]);
                });
                setLocalStorageItem('hayyiz-multi-day-plans', merged);
            },
            getTimestamp: item => Math.max(0, ...Object.values(item || {}).map(p => Number(p && p.updatedAt) || 0))
        },
        'planning-preferences': {
            tool: 'planning-preferences', type: 'single', storageKey: 'hayyiz-planning-preferences', itemId: 'preferences',
            getTimestamp: item => Number(item && item.updatedAt) || 0
        },
        'day-reviews': {
            tool: 'day-reviews', type: 'single', storageKey: 'hayyiz-day-reviews', itemId: 'reviews', mergeMap: true,
            getTimestamp: item => Math.max(0, ...Object.values(item || {}).map(p => Number(p && p.updatedAt) || 0))
        },
        'pomodoro-prefs': {
            tool: 'pomodoro-prefs',
            type: 'single',
            itemId: 'prefs',
            getLocalStorage: () => ({
                work: hayyizStorage.getItem('hayyiz-pref-work') || '25',
                break: hayyizStorage.getItem('hayyiz-pref-break') || '5',
                long: hayyizStorage.getItem('hayyiz-pref-long') || '15'
            }),
            setLocalStorage: (data) => {
                if (data && typeof data === 'object') {
                    if (data.work) hayyizStorage.setItem('hayyiz-pref-work', String(data.work));
                    if (data.break) hayyizStorage.setItem('hayyiz-pref-break', String(data.break));
                    if (data.long) hayyizStorage.setItem('hayyiz-pref-long', String(data.long));
                }
            },
            getTimestamp: () => Number(hayyizStorage.getItem('hayyiz-pomodoro-prefs-updated') || 0)
        }
    };

    /**
     * جلب السجلات السحابية لأداة معينة من Supabase باختيار الأعمدة المطلوبة والدعم التزايدي
     */
    async function loadRemoteToolRows(user, toolName) {
        if (!user || !supabaseClient) return null;

        // إذا كان هناك عمليات حذف محلي لم تُرفع بعد، قم بجلب كامل السجلات لضمان عدم حجب أي صف بالخطأ عبر GT
        const deletedRegistry = getDeletedItemsRegistry();
        const hasPendingLocalDeletes = Object.keys(deletedRegistry).some(k => k.startsWith(toolName + ':'));
        const sinceIso = hasPendingLocalDeletes || (TOOL_ADAPTERS[toolName] && (TOOL_ADAPTERS[toolName].mergeMap || TOOL_ADAPTERS[toolName].mergeHistory)) ? null : getLastSyncTime(toolName);

        const fetchOperation = async () => {
            const rows = [];
            let offset = 0;
            while (true) {
                let query = supabaseClient
                    .from('sync_items')
                    .select('tool, item_id, data, updated_at, deleted_at')
                    .eq('user_id', user.id)
                    .eq('tool', toolName);

                if (sinceIso) {
                    const sinceMs = new Date(sinceIso).getTime();
                    if (!isNaN(sinceMs) && sinceMs > 0) {
                        const overlapIso = new Date(Math.max(0, sinceMs - 1000)).toISOString();
                        query = query.gt('updated_at', overlapIso);
                    }
                }

                const paginated = typeof query.order === 'function' && typeof query.range === 'function';
                if (paginated) query = query.order('item_id', { ascending: true }).range(offset, offset + 499);
                const result = await query;
                if (!result || result.error) return result;
                rows.push(...(result.data || []));
                if (!paginated || !result.data || result.data.length < 500) return { data: rows, error: null };
                offset += 500;
            }
        };

        const res = await executeWithBackoff(fetchOperation);
        if (!res || res.error) {
            console.warn(`[Sync Engine] Fetch remote error for tool ${toolName}:`, res ? res.error : 'Network error');
            return null;
        }

        return res.data || [];
    }

    /**
     * دمج مصفوفات العناصر المجمعة (Collections)
     */
    function mergeCollectionTool(adapter, localItems, remoteRows) {
        const localList = Array.isArray(localItems) ? localItems : [];
        const remoteMap = new Map();

        if (Array.isArray(remoteRows)) {
            remoteRows.forEach(row => {
                if (row && row.item_id) {
                    remoteMap.set(String(row.item_id), row);
                }
            });
        }

        const localMap = new Map();
        localList.forEach(item => {
            const id = adapter.getId(item);
            if (id) {
                localMap.set(String(id), item);
            }
        });

        const mergedMap = new Map();
        const uploads = [];
        const tombstonesToPush = [];

        const toolName = adapter.tool;
        const deletedRegistry = getDeletedItemsRegistry();
        const lastSyncIso = getLastSyncTime(toolName);
        const lastSyncMs = lastSyncIso ? new Date(lastSyncIso).getTime() : 0;

        // 1. معالجة العناصر المحلية
        localMap.forEach((localItem, id) => {
            const localDelTime = getLocalDeleteTime(toolName, id);
            const localDelData = getLocalDeleteData(toolName, id);
            const localTime = adapter.getTimestamp(localItem);

            // إذا كان هناك سجل حذف محلي أحدث من أو يساوي آخر تعديل للمستند
            if (localDelTime > 0 && localDelTime >= localTime) {
                const remoteRow = remoteMap.get(id);
                const tombData = localDelData || localItem || (remoteRow && remoteRow.data) || { id: String(id) };
                if (!remoteRow) {
                    tombstonesToPush.push({ id, timestamp: localDelTime, data: tombData });
                } else {
                    const remoteTime = remoteRow.updated_at ? new Date(remoteRow.updated_at).getTime() : 0;
                    if (remoteRow.deleted_at) {
                        // كلاهما محذوف -> احترام الحذف
                    } else if (remoteTime > localDelTime) {
                        // التعديل البعيد أحدث من الحذف المحلي -> قبول التعديل البعيد
                        hayyizClearLocalDelete(toolName, id);
                        mergedMap.set(id, remoteRow.data);
                    } else {
                        // الحذف المحلي أحدث من التعديل البعيد -> احترام الحذف ورفع Tombstone
                        tombstonesToPush.push({ id, timestamp: localDelTime, data: tombData });
                    }
                }
                return;
            }

            // العنصر سليم محلياً
            const remoteRow = remoteMap.get(id);

            if (!remoteRow) {
                mergedMap.set(id, localItem);
                // رفع العنصر المحلي إذا لم يتم الجلب الكامل المسبق، أو إذا تم إنشاؤه/تعديله بعد آخر مزامنة
                if (!lastSyncMs || localTime > lastSyncMs) {
                    uploads.push(localItem);
                }
            } else {
                if (remoteRow.deleted_at) {
                    const remoteDeletedTime = new Date(remoteRow.deleted_at).getTime() || 0;
                    if (localTime > remoteDeletedTime) {
                        hayyizClearLocalDelete(toolName, id);
                        mergedMap.set(id, localItem);
                        uploads.push(localItem);
                    } else {
                        // الحذف البعيد أحدث أو يطابق المحلي -> تسجيل الحذف محلياً وعدم إعادته
                        hayyizRecordLocalDelete(toolName, id, remoteDeletedTime, remoteRow.data);
                    }
                } else {
                    const remoteData = remoteRow.data;
                    if (!remoteData || typeof remoteData !== 'object') {
                        mergedMap.set(id, localItem);
                        uploads.push(localItem);
                        return;
                    }

                    const remoteTime = Number(
                        adapter.getTimestamp(remoteData) || (remoteRow.updated_at ? new Date(remoteRow.updated_at).getTime() : 0)
                    );

                    if (localTime > remoteTime) {
                        mergedMap.set(id, localItem);
                        uploads.push(localItem);
                    } else if (remoteTime > localTime) {
                        hayyizClearLocalDelete(toolName, id);
                        mergedMap.set(id, remoteData);
                    } else {
                        mergedMap.set(id, localItem);
                    }
                }
            }
        });

        // 2. معالجة العناصر السحابية التي ليست محلياً
        remoteMap.forEach((remoteRow, itemId) => {
            if (!localMap.has(itemId)) {
                const localDelTime = getLocalDeleteTime(toolName, itemId);
                const localDelData = getLocalDeleteData(toolName, itemId);

                if (remoteRow.deleted_at) {
                    hayyizRecordLocalDelete(toolName, itemId, new Date(remoteRow.deleted_at).getTime() || Date.now(), remoteRow.data);
                } else if (localDelTime > 0) {
                    const remoteTime = Number(
                        adapter.getTimestamp(remoteRow.data) || (remoteRow.updated_at ? new Date(remoteRow.updated_at).getTime() : 0)
                    );
                    if (localDelTime >= remoteTime) {
                        const tombData = localDelData || remoteRow.data || { id: String(itemId) };
                        tombstonesToPush.push({ id: itemId, timestamp: localDelTime, data: tombData });
                    } else {
                        hayyizClearLocalDelete(toolName, itemId);
                        if (remoteRow.data) {
                            mergedMap.set(itemId, remoteRow.data);
                        }
                    }
                } else {
                    if (remoteRow.data) {
                        mergedMap.set(itemId, remoteRow.data);
                    }
                }
            }
        });

        // 3. معالجة عمليات الحذف المحفوظة محلياً والتي لم ترفع للسحابة بعد (Offline deletions)
        const prefix = toolName + ':';
        Object.keys(deletedRegistry).forEach(key => {
            if (key.startsWith(prefix)) {
                const itemId = key.slice(prefix.length);
                if (!localMap.has(itemId) && !remoteMap.has(itemId)) {
                    const entry = deletedRegistry[key];
                    const ts = entry && typeof entry === 'object' ? Number(entry.timestamp || Date.now()) : Number(entry || Date.now());
                    const data = (entry && typeof entry === 'object' && entry.data) || { id: String(itemId) };
                    tombstonesToPush.push({ id: itemId, timestamp: ts, data: data });
                }
            }
        });

        const mergedList = Array.from(mergedMap.values());

        // فرز العناصر حسب الأحدث إن أمكن
        mergedList.sort((a, b) => {
            const tA = adapter.getTimestamp(a);
            const tB = adapter.getTimestamp(b);
            return tB - tA;
        });

        return { mergedList, uploads, tombstonesToPush };
    }

    /**
     * دمج العناصر الفردية (Single Tools)
     */
    function mergeSingleTool(adapter, localData, remoteRows) {
        const remoteRow = Array.isArray(remoteRows) && remoteRows.length > 0 ? remoteRows[0] : null;
        let finalData = localData;
        let needsUpload = false;
        let tombstoneToPush = null;

        const toolName = adapter.tool;
        const itemId = adapter.itemId || 'single';
        const localDelTime = getLocalDeleteTime(toolName, itemId);
        const localDelData = getLocalDeleteData(toolName, itemId);
        const lastSyncIso = getLastSyncTime(toolName);
        const lastSyncMs = lastSyncIso ? new Date(lastSyncIso).getTime() : 0;

        if (!remoteRow) {
            if (localDelTime > 0) {
                finalData = null;
                tombstoneToPush = { id: itemId, timestamp: localDelTime, data: localDelData || localData || { id: String(itemId) } };
            } else if (localData !== null && localData !== undefined) {
                const localTime = adapter.getTimestamp(localData);
                if (!lastSyncMs || localTime > lastSyncMs) {
                    needsUpload = true;
                }
            }
        } else if (remoteRow.deleted_at) {
            const remoteDelTime = new Date(remoteRow.deleted_at).getTime() || 0;
            const localTime = adapter.getTimestamp(localData);

            if (localTime > remoteDelTime) {
                finalData = localData;
                needsUpload = true;
            } else {
                finalData = null;
                hayyizRecordLocalDelete(toolName, itemId, remoteDelTime, remoteRow.data);
            }
        } else {
            const remoteData = remoteRow.data;
            const remoteTime = remoteRow.updated_at ? new Date(remoteRow.updated_at).getTime() : 0;
            const localTime = adapter.getTimestamp(localData);

            if (localDelTime > 0 && localDelTime >= localTime && localDelTime >= remoteTime) {
                finalData = null;
                tombstoneToPush = { id: itemId, timestamp: localDelTime, data: localDelData || remoteData || localData || { id: String(itemId) } };
            } else if (localData === null || localData === undefined) {
                finalData = remoteData;
                hayyizClearLocalDelete(toolName, itemId);
            } else if (remoteTime > localTime) {
                finalData = remoteData;
                hayyizClearLocalDelete(toolName, itemId);
            } else if (localTime > remoteTime) {
                finalData = localData;
                needsUpload = true;
                hayyizClearLocalDelete(toolName, itemId);
            } else {
                finalData = localData;
            }
        }

        if (adapter.mergeMap && remoteRow && !remoteRow.deleted_at && !localDelTime) {
            const localMap = localData && typeof localData === 'object' ? localData : {};
            const remoteMap = remoteRow.data && typeof remoteRow.data === 'object' ? remoteRow.data : {};
            const merged = Object.create(null);
            Object.keys(remoteMap).filter(key => !['__proto__', 'constructor', 'prototype'].includes(key)).forEach(key => { merged[key] = remoteMap[key]; });
            Object.keys(localMap).filter(key => !['__proto__', 'constructor', 'prototype'].includes(key)).forEach(key => {
                if (!merged[key] || Number(localMap[key] && localMap[key].updatedAt) > Number(merged[key] && merged[key].updatedAt || 0)) {
                    merged[key] = localMap[key];
                }
            });
            finalData = merged;
            needsUpload = JSON.stringify(merged) !== JSON.stringify(remoteMap);
        }

        if (adapter.mergeHistory && remoteRow && !remoteRow.deleted_at && !localDelTime) {
            if (typeof hayyizMergeFocusHistoryPayload === 'function') {
                finalData = hayyizMergeFocusHistoryPayload(localData, remoteRow.data);
            } else {
                finalData = Object.create(null);
                [remoteRow.data, localData].forEach(map => Object.entries(map || {}).filter(([day]) => /^\d{4}-\d{2}-\d{2}$/.test(day)).forEach(([day, minutes]) => {
                    finalData[day] = Math.max(Number(finalData[day]) || 0, Number(minutes) || 0);
                }));
            }
            needsUpload = JSON.stringify(finalData) !== JSON.stringify(remoteRow.data);
        }

        return { finalData, needsUpload, tombstoneToPush };
    }

    /**
     * رفع عنصر فردي أو مجمع إلى Supabase (Non-blocking)
     */
    async function hayyizUploadItem(toolName, itemId, data) {
        if (!toolName || !itemId) return;
        if (toolName === 'focus-history') return hayyizSyncTool(toolName);
        const copy = JSON.parse(JSON.stringify(data));
        const scope = hayyizStorage.scope;
        hayyizClearLocalDelete(toolName, itemId);

        const user = await getAuthenticatedUser();
        if (!user) return;
        const epoch = authEpoch;

        const adapter = TOOL_ADAPTERS[toolName];
        const rawTs = adapter ? adapter.getTimestamp(copy) : 0;
        const nowIso = safeIsoTimestamp(rawTs);

        try {
            const payload = {
                user_id: user.id,
                tool: toolName,
                item_id: String(itemId),
                data: copy,
                updated_at: nowIso,
                deleted_at: null
            };

            const res = await writeRemoteRows(toolName, payload, user, epoch, scope);

            if (res && res.error) {
                console.warn(`[Sync Engine] Upload item failed for tool ${toolName}:`, res.error.message);
            }
            return res;
        } catch (e) {
            console.warn(`[Sync Engine] Upload item exception for tool ${toolName}:`, e);
        }
    }

    /**
     * تسجيل حذف عنصر في Supabase باستعمال Tombstone
     */
    async function hayyizDeleteRemoteItem(toolName, itemId, previousData) {
        if (!toolName || !itemId) return;
        const scope = hayyizStorage.scope;
        const nowMs = Date.now();

        let itemData = previousData;
        if (!itemData || typeof itemData !== 'object') {
            itemData = getLocalDeleteData(toolName, itemId);
        }
        if (!itemData || typeof itemData !== 'object') {
            const adapter = TOOL_ADAPTERS[toolName];
            if (adapter) {
                if (adapter.type === 'collection') {
                    const localItems = getLocalStorageItem(adapter.storageKey, []);
                    if (Array.isArray(localItems)) {
                        itemData = localItems.find(item => String(adapter.getId(item)) === String(itemId)) || null;
                    }
                } else if (adapter.type === 'single') {
                    if (typeof adapter.getLocalStorage === 'function') {
                        itemData = adapter.getLocalStorage();
                    } else {
                        itemData = getLocalStorageItem(adapter.storageKey, null);
                    }
                }
            }
        }
        if (!itemData || typeof itemData !== 'object') {
            itemData = { id: String(itemId) };
        }

        hayyizRecordLocalDelete(toolName, itemId, nowMs, itemData);

        const user = await getAuthenticatedUser();
        if (!user) return;
        const epoch = authEpoch;

        const nowIso = safeIsoTimestamp(nowMs);

        try {
            const payload = {
                user_id: user.id,
                tool: toolName,
                item_id: String(itemId),
                data: itemData,
                updated_at: nowIso,
                deleted_at: nowIso
            };

            const res = await writeRemoteRows(toolName, payload, user, epoch, scope);

            if (res && res.error) {
                console.warn(`[Sync Engine] Delete remote item failed for tool ${toolName}:`, res.error.message);
            } else if (currentRequest(user, epoch, scope)) {
                setLastSyncTime(toolName, nowIso);
            }
            return res;
        } catch (e) {
            console.warn(`[Sync Engine] Delete remote item exception for tool ${toolName}:`, e);
            return { error: e };
        }
    }

    /**
     * مزامنة أداة واحدة مع منع الطلبات المتوازية المكررة (Mutexing)
     */
    async function hayyizSyncTool(toolName) {
        const adapter = TOOL_ADAPTERS[toolName];
        if (!adapter) return;
        if (inFlightToolPromises.has(toolName)) return await inFlightToolPromises.get(toolName);
        const fingerprint = () => JSON.stringify(typeof adapter.getLocalStorage === 'function'
            ? adapter.getLocalStorage() : getLocalStorageItem(adapter.storageKey, null));
        const syncPromise = (async () => {
            let before;
            do {
                before = fingerprint();
                // A failed round leaves local changes for the next explicit retry; do not spin offline.
                if (!await syncRound()) break;
            } while (before !== fingerprint());
        })();
        inFlightToolPromises.set(toolName, syncPromise);
        try { return await syncPromise; }
        finally { inFlightToolPromises.delete(toolName); }

        async function syncRound() {
            const user = await getAuthenticatedUser();
            if (!user) return;
            const epoch = authEpoch;
            const scope = hayyizStorage.scope;

            syncingTools.add(toolName);
            const syncStartTimeIso = new Date().toISOString();

            try {
                hayyizCleanupOldLocalTombstones();

                const remoteRows = await loadRemoteToolRows(user, toolName);
                if (remoteRows === null || !currentRequest(user, epoch, scope)) {
                    return; // فشل الشبكة -> نحتفظ بالمحلي كلياً
                }

                if (adapter.type === 'collection') {
                    const localItems = getLocalStorageItem(adapter.storageKey, []);
                    const { mergedList, uploads, tombstonesToPush } = mergeCollectionTool(adapter, localItems, remoteRows);

                    const localJson = JSON.stringify(localItems);
                    const mergedJson = JSON.stringify(mergedList);
                    const hasChanged = localJson !== mergedJson;

                    if (hasChanged) {
                        setLocalStorageItem(adapter.storageKey, mergedList);
                    }

                    if (uploads.length > 0) {
                        const payloads = uploads.map(item => {
                            const rawTs = adapter.getTimestamp(item);
                            return {
                                user_id: user.id,
                                tool: toolName,
                                item_id: String(adapter.getId(item)),
                                data: item,
                                updated_at: safeIsoTimestamp(rawTs),
                                deleted_at: null
                            };
                        });

                        const uploadResult = await writeRemoteRows(toolName, payloads, user, epoch, scope);
                        if (!uploadResult || uploadResult.error) throw new Error('Collection upload not saved');
                    }

                    if (tombstonesToPush && tombstonesToPush.length > 0) {
                        const tombstonePayloads = tombstonesToPush.map(t => ({
                            user_id: user.id,
                            tool: toolName,
                            item_id: String(t.id),
                            data: t.data || { id: String(t.id) },
                            updated_at: safeIsoTimestamp(t.timestamp),
                            deleted_at: safeIsoTimestamp(t.timestamp)
                        }));

                        const tombRes = await writeRemoteRows(toolName, tombstonePayloads, user, epoch, scope);

                        if (tombRes && !tombRes.error) {
                            tombstonesToPush.forEach(t => {
                                hayyizClearLocalDelete(toolName, t.id);
                            });
                        } else { throw new Error('Deletion upload not saved'); }
                    }

                    if (!currentRequest(user, epoch, scope)) return false;
                    setLastSyncTime(toolName, syncStartTimeIso);

                    if (hasChanged && syncCallbacks.has(toolName)) {
                        syncCallbacks.get(toolName).forEach(cb => {
                            try { cb(mergedList); } catch(e){}
                        });
                    }
                } else if (adapter.type === 'single') {
                    let localData = null;
                    if (typeof adapter.getLocalStorage === 'function') {
                        localData = adapter.getLocalStorage();
                    } else {
                        localData = getLocalStorageItem(adapter.storageKey, null);
                    }

                    const { finalData, needsUpload, tombstoneToPush } = mergeSingleTool(adapter, localData, remoteRows);

                    const localJson = JSON.stringify(localData);
                    const finalJson = JSON.stringify(finalData);
                    const hasChanged = localJson !== finalJson;

                    if (hasChanged) {
                        if (typeof adapter.setLocalStorage === 'function') {
                            adapter.setLocalStorage(finalData);
                        } else {
                            setLocalStorageItem(adapter.storageKey, finalData);
                        }
                    }

                    if (tombstoneToPush) {
                        const result = await hayyizDeleteRemoteItem(toolName, tombstoneToPush.id, tombstoneToPush.data);
                        if (!result || result.error) throw new Error('Deletion upload not saved');
                    } else if (needsUpload && finalData !== null && finalData !== undefined) {
                        const result = await writeRemoteRows(toolName, {
                            user_id: user.id, tool: toolName, item_id: adapter.itemId,
                            data: finalData, updated_at: safeIsoTimestamp(adapter.getTimestamp(finalData)), deleted_at: null
                        }, user, epoch, scope);
                        if (!result || result.error) throw new Error('Planning upload not saved');
                    }

                    if (!currentRequest(user, epoch, scope)) return false;
                    setLastSyncTime(toolName, syncStartTimeIso);

                    if (hasChanged && syncCallbacks.has(toolName)) {
                        syncCallbacks.get(toolName).forEach(cb => {
                            try { cb(finalData); } catch(e){}
                        });
                    }
                }
                return true;
            } catch (e) {
                console.warn(`[Sync Engine] Error syncing tool ${toolName}:`, e);
                return false;
            } finally {
                syncingTools.delete(toolName);
            }
        }
    }

    /**
     * مزامنة جميع بيانات المستخدم عبر السحابة
     */
    async function hayyizSyncAllUserData() {
        if (isSyncingAll) return;
        const user = await getAuthenticatedUser();
        if (!user) return;

        isSyncingAll = true;

        try {
            // ضمان المعرفات المحلية وتأكيد بنية البيانات أولاً
            if (typeof hayyizEnsureDataShape === 'function') {
                hayyizEnsureDataShape();
            }

            const toolKeys = Object.keys(TOOL_ADAPTERS);
            await Promise.all(toolKeys.filter(t => t !== 'multi-day-plans').map(t => hayyizSyncTool(t)));
            await hayyizSyncTool('multi-day-plans');
            await hayyizFlushWorkspaceFocusSessions();
            if (typeof hayyizReevaluateMultiDayPlan === 'function') hayyizReevaluateMultiDayPlan();
            if (typeof hayyizNotifyPlanningChanged === 'function') hayyizNotifyPlanningChanged();
        } catch (e) {
            console.warn('[Sync Engine] hayyizSyncAllUserData exception:', e);
        } finally {
            isSyncingAll = false;
        }
    }

    /**
     * التوافق مع الملاحظات
     */
    async function hayyizSyncNotes() {
        return await hayyizSyncTool('notes');
    }

    async function hayyizUploadNote(note) {
        if (!note || !note.id) return;
        return await hayyizUploadItem('notes', note.id, note);
    }

    async function hayyizDeleteRemoteNote(noteId, previousData) {
        if (!noteId) return;
        return await hayyizDeleteRemoteItem('notes', noteId, previousData);
    }

    // Keep completed workspace sessions until the server acknowledges their stable
    // client ID. Retrying after a lost response cannot create a duplicate session.
    function hayyizFlushWorkspaceFocusSessions() {
        if (focusOutboxPromise) return focusOutboxPromise;
        focusOutboxPromise = (async () => {
            const user = await getAuthenticatedUser();
            if (!user) return false;
            const epoch = authEpoch, scope = hayyizStorage.scope;
            const attempted = new Set();
            while (currentRequest(user, epoch, scope)) {
                const queue = getLocalStorageItem('hayyiz-workspace-focus-outbox', {});
                const id = Object.keys(queue).find(key => !attempted.has(key));
                if (!id) return true;
                attempted.add(id);
                const entry = queue[id];
                if (!entry || entry.id !== id || !entry.taskId) continue;
                const result = await executeWithBackoff(() => currentRequest(user, epoch, scope)
                    ? supabaseClient.rpc('record_focus_session', {
                        p_client_session_id: id, p_task_id: entry.taskId,
                        p_workspace_id: entry.workspaceId || null, p_started_at: entry.startedAt,
                        p_ended_at: entry.endedAt, p_duration_seconds: entry.durationSeconds
                    }) : Promise.resolve({ error: { message: 'Account changed' } }));
                if (!currentRequest(user, epoch, scope)) return false;
                if (!result || result.error || !result.data || result.data.success !== true) return false;
                const latest = getLocalStorageItem('hayyiz-workspace-focus-outbox', {});
                delete latest[id];
                setLocalStorageItem('hayyiz-workspace-focus-outbox', latest);
            }
            return false;
        })().catch(error => { console.warn('[Sync Engine] Focus session pending:', error); return false; })
            .finally(() => { focusOutboxPromise = null; });
        return focusOutboxPromise;
    }

    /**
     * تسجيل مستمع التوثيق العام
     */
    function initAuthListener() {
        if (authListenerRegistered) return;

        const attachListener = (client) => {
            if (authListenerRegistered || !client || !client.auth) return;
            authListenerRegistered = true;
            try {
                client.auth.onAuthStateChange((event, session) => {
                    const nextId = session && session.user ? session.user.id : null;
                    if (authUserId !== nextId) { authUserId = nextId; authEpoch++; }
                    if (hayyizStorage.isCurrentUser && !hayyizStorage.isCurrentUser(nextId)) {
                        hayyizStorage.transitionTo(nextId);
                        return;
                    }
                    // Supabase auth callbacks must not await another auth call.
                    if (nextId) setTimeout(() => hayyizSyncAllUserData(), 0);
                });
            } catch (e) {
                console.warn('[Sync Engine] Auth state listener error:', e);
            }
        };

        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            window.addEventListener('hayyiz:supabase-ready', event => attachListener(event.detail));
        }

        if (typeof hasSavedSupabaseSession === 'function' && hasSavedSupabaseSession()) {
            if (typeof ensureSupabaseLoaded === 'function') {
                ensureSupabaseLoaded().then(attachListener).catch(() => {});
            }
        } else if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.auth) {
            attachListener(supabaseClient);
        }
    }

    // مستمع إعادة الاتصال بالإنترنت
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('online', () => {
            hayyizSyncAllUserData();
        });
    }

    // تصدير واجهات API العامة للمزامنة
    global.TOMBSTONE_MAX_AGE_DAYS = TOMBSTONE_MAX_AGE_DAYS;
    global.hayyizCleanupOldLocalTombstones = hayyizCleanupOldLocalTombstones;
    global.hayyizRegisterSyncCallback = hayyizRegisterSyncCallback;
    global.hayyizSyncTool = hayyizSyncTool;
    global.hayyizSyncAllUserData = hayyizSyncAllUserData;
    global.hayyizUploadItem = hayyizUploadItem;
    global.hayyizDeleteRemoteItem = hayyizDeleteRemoteItem;
    global.hayyizFlushWorkspaceFocusSessions = hayyizFlushWorkspaceFocusSessions;
    global.hayyizRecordLocalDelete = hayyizRecordLocalDelete;
    global.hayyizClearLocalDelete = hayyizClearLocalDelete;
    global.initAuthListener = initAuthListener;

    // توافقية مسبقة مع الملاحظات
    global.hayyizRegisterNotesSyncCallback = hayyizRegisterNotesSyncCallback;
    global.hayyizSyncNotes = hayyizSyncNotes;
    global.hayyizUploadNote = hayyizUploadNote;
    global.hayyizDeleteRemoteNote = hayyizDeleteRemoteNote;
    global.hayyizMergeLocalAndRemoteNotes = (localNotes, remoteRows) => {
        return mergeCollectionTool(TOOL_ADAPTERS['notes'], localNotes, remoteRows);
    };

})(typeof window !== 'undefined' ? window : global);
