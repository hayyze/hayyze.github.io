/**
 * sync.js — محرك المزامنة السحابية العام لمنصة حيز عبر Supabase
 * يوفر مزامنة سحابية غير معطلة لكافة أدوات حيز للمستخدمين المصادق عليهم.
 */

(function (global) {
    'use strict';

    let isSyncingAll = false;
    const syncingTools = new Set();
    const syncCallbacks = new Map(); // tool -> Array<Function>
    let authListenerRegistered = false;

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
        if (typeof supabaseClient === 'undefined' || !supabaseClient || !supabaseClient.auth) {
            return null;
        }
        try {
            const { data, error } = await supabaseClient.auth.getUser();
            if (error || !data || !data.user) {
                return null;
            }
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
            const val = localStorage.getItem(key);
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
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
            }
        } catch (e) {
            console.warn('[Sync Engine] LocalStorage write failed:', e);
        }
    }

    /* =========================================================
     * سجل الشواهد والحذف المحلي (Local Deletion Queue & Registry)
     * ========================================================= */
    function getDeletedItemsRegistry() {
        return getLocalStorageItem('hayyiz-deleted-items', {}) || {};
    }

    function hayyizRecordLocalDelete(tool, itemId, timestamp, previousData) {
        if (!tool || !itemId) return;
        const registry = getDeletedItemsRegistry();
        const key = String(tool) + ':' + String(itemId);
        const ts = Number(timestamp || Date.now());
        if (previousData && typeof previousData === 'object') {
            registry[key] = { timestamp: ts, data: previousData };
        } else if (registry[key] && typeof registry[key] === 'object' && registry[key].data) {
            registry[key] = { timestamp: ts, data: registry[key].data };
        } else {
            registry[key] = ts;
        }
        setLocalStorageItem('hayyiz-deleted-items', registry);
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
            getTimestamp: item => Number(item && (item.timestamp ? new Date(item.timestamp).getTime() : (item.created || 0)))
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
            getTimestamp: () => Number(localStorage.getItem('hayyiz-birthdate-updated') || 0)
        },
        'focus-history': {
            tool: 'focus-history',
            type: 'single',
            storageKey: 'hayyiz-focus-history',
            itemId: 'history',
            getTimestamp: () => Number(localStorage.getItem('hayyiz-focus-history-updated') || 0)
        },
        'pomodoro-prefs': {
            tool: 'pomodoro-prefs',
            type: 'single',
            itemId: 'prefs',
            getLocalStorage: () => ({
                work: localStorage.getItem('hayyiz-pref-work') || '25',
                break: localStorage.getItem('hayyiz-pref-break') || '5',
                long: localStorage.getItem('hayyiz-pref-long') || '15'
            }),
            setLocalStorage: (data) => {
                if (data && typeof data === 'object') {
                    if (data.work) localStorage.setItem('hayyiz-pref-work', String(data.work));
                    if (data.break) localStorage.setItem('hayyiz-pref-break', String(data.break));
                    if (data.long) localStorage.setItem('hayyiz-pref-long', String(data.long));
                }
            },
            getTimestamp: () => Number(localStorage.getItem('hayyiz-pomodoro-prefs-updated') || 0)
        }
    };

    /**
     * جلب السجلات السحابية لأداة معينة من Supabase
     */
    async function loadRemoteToolRows(user, toolName) {
        if (!user || !supabaseClient) return null;
        try {
            const { data, error } = await supabaseClient
                .from('sync_items')
                .select('*')
                .eq('tool', toolName);

            if (error) {
                console.warn(`[Sync Engine] Fetch remote error for tool ${toolName}:`, error.message);
                return null;
            }
            return data || [];
        } catch (e) {
            console.warn(`[Sync Engine] Fetch remote exception for tool ${toolName}:`, e);
            return null;
        }
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
                uploads.push(localItem);
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

        if (!remoteRow) {
            if (localDelTime > 0) {
                finalData = null;
                tombstoneToPush = { id: itemId, timestamp: localDelTime, data: localDelData || localData || { id: String(itemId) } };
            } else if (localData !== null && localData !== undefined) {
                needsUpload = true;
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

        return { finalData, needsUpload, tombstoneToPush };
    }

    /**
     * رفع عنصر فردي أو مجمع إلى Supabase (Non-blocking)
     */
    async function hayyizUploadItem(toolName, itemId, data) {
        if (!toolName || !itemId) return;
        hayyizClearLocalDelete(toolName, itemId);

        const user = await getAuthenticatedUser();
        if (!user) return;

        const adapter = TOOL_ADAPTERS[toolName];
        const rawTs = adapter ? adapter.getTimestamp(data) : 0;
        const timestamp = new Date(rawTs && rawTs > 0 ? rawTs : Date.now()).toISOString();

        try {
            const payload = {
                user_id: user.id,
                tool: toolName,
                item_id: String(itemId),
                data: data,
                updated_at: timestamp,
                deleted_at: null
            };

            const { error } = await supabaseClient
                .from('sync_items')
                .upsert(payload, { onConflict: 'user_id,tool,item_id' });

            if (error) {
                console.warn(`[Sync Engine] Upload item failed for tool ${toolName}:`, error.message);
            }
        } catch (e) {
            console.warn(`[Sync Engine] Upload item exception for tool ${toolName}:`, e);
        }
    }

    /**
     * تسجيل حذف عنصر في Supabase باستعمال Tombstone
     */
    async function hayyizDeleteRemoteItem(toolName, itemId, previousData) {
        if (!toolName || !itemId) return;
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

        const nowIso = new Date(nowMs).toISOString();

        try {
            const payload = {
                user_id: user.id,
                tool: toolName,
                item_id: String(itemId),
                data: itemData,
                updated_at: nowIso,
                deleted_at: nowIso
            };

            const { error } = await supabaseClient
                .from('sync_items')
                .upsert(payload, { onConflict: 'user_id,tool,item_id' });

            if (error) {
                console.warn(`[Sync Engine] Delete remote item failed for tool ${toolName}:`, error.message);
            }
        } catch (e) {
            console.warn(`[Sync Engine] Delete remote item exception for tool ${toolName}:`, e);
        }
    }

    /**
     * مزامنة أداة واحدة
     */
    async function hayyizSyncTool(toolName) {
        const adapter = TOOL_ADAPTERS[toolName];
        if (!adapter || syncingTools.has(toolName)) return;

        const user = await getAuthenticatedUser();
        if (!user) return;

        syncingTools.add(toolName);

        try {
            const remoteRows = await loadRemoteToolRows(user, toolName);
            if (remoteRows === null) {
                syncingTools.delete(toolName);
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
                            updated_at: new Date(rawTs && rawTs > 0 ? rawTs : Date.now()).toISOString(),
                            deleted_at: null
                        };
                    });

                    try {
                        await supabaseClient
                            .from('sync_items')
                            .upsert(payloads, { onConflict: 'user_id,tool,item_id' });
                    } catch (eUpload) {
                        console.warn(`[Sync Engine] Batch upload failed for ${toolName}:`, eUpload);
                    }
                }

                if (tombstonesToPush && tombstonesToPush.length > 0) {
                    const tombstonePayloads = tombstonesToPush.map(t => ({
                        user_id: user.id,
                        tool: toolName,
                        item_id: String(t.id),
                        data: t.data || { id: String(t.id) },
                        updated_at: new Date(t.timestamp || Date.now()).toISOString(),
                        deleted_at: new Date(t.timestamp || Date.now()).toISOString()
                    }));

                    try {
                        await supabaseClient
                            .from('sync_items')
                            .upsert(tombstonePayloads, { onConflict: 'user_id,tool,item_id' });
                    } catch (eTomb) {
                        console.warn(`[Sync Engine] Batch tombstone upload failed for ${toolName}:`, eTomb);
                    }
                }

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
                    await hayyizDeleteRemoteItem(toolName, tombstoneToPush.id, tombstoneToPush.data);
                } else if (needsUpload && finalData !== null && finalData !== undefined) {
                    await hayyizUploadItem(toolName, adapter.itemId, finalData);
                }

                if (hasChanged && syncCallbacks.has(toolName)) {
                    syncCallbacks.get(toolName).forEach(cb => {
                        try { cb(finalData); } catch(e){}
                    });
                }
            }
        } catch (e) {
            console.warn(`[Sync Engine] Error syncing tool ${toolName}:`, e);
        } finally {
            syncingTools.delete(toolName);
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
            await Promise.all(toolKeys.map(t => hayyizSyncTool(t)));
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

    /**
     * تسجيل مستمع التوثيق العام
     */
    function initAuthListener() {
        if (authListenerRegistered) return;
        if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.auth) {
            authListenerRegistered = true;
            try {
                supabaseClient.auth.onAuthStateChange((event, session) => {
                    if (session && session.user) {
                        hayyizSyncAllUserData();
                    }
                });
            } catch (e) {
                console.warn('[Sync Engine] Auth state listener error:', e);
            }
        }
    }

    // مستمع إعادة الاتصال بالإنترنت
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('online', () => {
            hayyizSyncAllUserData();
        });
    }

    // تصدير واجهات API العامة للمزامنة
    global.hayyizRegisterSyncCallback = hayyizRegisterSyncCallback;
    global.hayyizSyncTool = hayyizSyncTool;
    global.hayyizSyncAllUserData = hayyizSyncAllUserData;
    global.hayyizUploadItem = hayyizUploadItem;
    global.hayyizDeleteRemoteItem = hayyizDeleteRemoteItem;
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
