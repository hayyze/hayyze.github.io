/**
 * sync.js — طبقة المزامنة السحابية لملاحظات حيز عبر Supabase
 * للملاحظات فقط، دون المساس بالمستخدم غير المسجل أو الأدوات الأخرى.
 */

(function (global) {
    'use strict';

    let isSyncing = false;
    let syncCallback = null;
    let authListenerRegistered = false;

    /**
     * تسجيل دالة تنبيه يتم استدعاؤها عند تحديث الملاحظات من السحابة
     */
    function hayyizRegisterNotesSyncCallback(fn) {
        if (typeof fn === 'function') {
            syncCallback = fn;
        }
    }

    /**
     * الحصول على المستخدم الحسابي المعتمد بأمان بدون رفع أخطاء
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
     * قراءة الملاحظات المحلية بأمان
     */
    function getLocalNotes() {
        try {
            const raw = localStorage.getItem('hayyiz-notes');
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    /**
     * حفظ الملاحظات محلياً بأمان
     */
    function setLocalNotes(notes) {
        try {
            localStorage.setItem('hayyiz-notes', JSON.stringify(notes));
        } catch (e) {
            console.warn('[Sync] Failed to set local notes:', e);
        }
    }

    /**
     * جلب السجلات البعيدة الخاصة بالملاحظات من Supabase
     */
    async function loadRemoteNotes(user) {
        if (!user || !supabaseClient) return [];
        try {
            const { data, error } = await supabaseClient
                .from('sync_items')
                .select('*')
                .eq('tool', 'notes');

            if (error) {
                console.warn('[Sync] Fetch remote notes error:', error.message);
                return null; // إرجاع null لتمييز خطأ الشبكة عن النتيجة الفارغة
            }
            return data || [];
        } catch (e) {
            console.warn('[Sync] Load remote exception:', e);
            return null;
        }
    }

    /**
     * دمج ذكي ومحدد بين الملاحظات المحلية وسجلات Supabase
     */
    function mergeLocalAndRemoteNotes(localNotes, remoteRows) {
        const remoteMap = new Map();
        if (Array.isArray(remoteRows)) {
            remoteRows.forEach(row => {
                if (row && row.item_id) {
                    remoteMap.set(row.item_id, row);
                }
            });
        }

        const localMap = new Map();
        (localNotes || []).forEach(note => {
            if (note && note.id) {
                localMap.set(note.id, note);
            }
        });

        const mergedMap = new Map();
        const uploads = [];

        // 1. معالجة العناصر المحلية
        localMap.forEach((localNote, id) => {
            const remoteRow = remoteMap.get(id);

            if (!remoteRow) {
                // الملاحظة موجودة محلياً وغير موجودة في السحابة -> نحتفظ بها ونرفعها
                mergedMap.set(id, localNote);
                uploads.push(localNote);
            } else {
                const localTime = Number(localNote.updated || localNote.created || 0);

                if (remoteRow.deleted_at) {
                    // الملاحظة محذوفة في السحابة
                    const remoteDeletedTime = new Date(remoteRow.deleted_at).getTime() || 0;
                    if (localTime > remoteDeletedTime) {
                        // التعديل المحلي أحدث من تاريخ الحذف السحابي -> إعادة إحياء الملاحظة وتحديث السحابة
                        mergedMap.set(id, localNote);
                        uploads.push(localNote);
                    } else {
                        // الحذف السحابي أحدث أو مساوٍ -> تحذف محلياً (لا تضاف إلى mergedMap)
                    }
                } else {
                    // الملاحظة موجودة محلياً وسحابياً
                    const remoteData = remoteRow.data;
                    if (!remoteData || typeof remoteData !== 'object') {
                        mergedMap.set(id, localNote);
                        uploads.push(localNote);
                        return;
                    }

                    const remoteTime = Number(
                        remoteData.updated || remoteData.created || (remoteRow.updated_at ? new Date(remoteRow.updated_at).getTime() : 0)
                    );

                    if (localTime > remoteTime) {
                        // النسخة المحلية أحدث -> نعتمد المحلية ونرفعها
                        mergedMap.set(id, localNote);
                        uploads.push(localNote);
                    } else if (remoteTime > localTime) {
                        // النسخة السحابية أحدث -> نعتمد السحابية
                        mergedMap.set(id, remoteData);
                    } else {
                        // النسختان متطابقتان في التاريخ -> نعتمد المحلية بدون رفع إضافي
                        mergedMap.set(id, localNote);
                    }
                }
            }
        });

        // 2. معالجة العناصر السحابية التي ليست موجودة محلياً
        remoteMap.forEach((remoteRow, itemId) => {
            if (!localMap.has(itemId)) {
                if (!remoteRow.deleted_at && remoteRow.data && typeof remoteRow.data === 'object') {
                    // ملاحظة أنشئت على جهاز آخر ولم تحذف -> نعتمدها
                    mergedMap.set(itemId, remoteRow.data);
                }
            }
        });

        const mergedNotes = Array.from(mergedMap.values());

        // فرز الملاحظات حسب الأحدث تعديلاً/إنشاءً
        mergedNotes.sort((a, b) => {
            const timeA = Number(a.updated || a.created || 0);
            const timeB = Number(b.updated || b.created || 0);
            return timeB - timeA;
        });

        return { mergedNotes, uploads };
    }

    /**
     * رفع ملاحظة واحدة إلى Supabase (Non-blocking)
     */
    async function hayyizUploadNote(note) {
        if (!note || !note.id) return;
        const user = await getAuthenticatedUser();
        if (!user) return;

        const timestamp = new Date(note.updated || note.created || Date.now()).toISOString();

        try {
            const payload = {
                user_id: user.id,
                tool: 'notes',
                item_id: note.id,
                data: note,
                updated_at: timestamp,
                deleted_at: null
            };

            const { error } = await supabaseClient
                .from('sync_items')
                .upsert(payload, { onConflict: 'user_id,tool,item_id' });

            if (error) {
                console.warn('[Sync] Upload note failed silently:', error.message);
            }
        } catch (e) {
            console.warn('[Sync] Upload note exception:', e);
        }
    }

    /**
     * تسجيل حذف ملاحظة في Supabase باستخدام deleted_at (Tombstone)
     */
    async function hayyizDeleteRemoteNote(noteId) {
        if (!noteId) return;
        const user = await getAuthenticatedUser();
        if (!user) return;

        const nowIso = new Date().toISOString();

        try {
            const payload = {
                user_id: user.id,
                tool: 'notes',
                item_id: String(noteId),
                updated_at: nowIso,
                deleted_at: nowIso
            };

            const { error } = await supabaseClient
                .from('sync_items')
                .upsert(payload, { onConflict: 'user_id,tool,item_id' });

            if (error) {
                console.warn('[Sync] Delete remote note failed silently:', error.message);
            }
        } catch (e) {
            console.warn('[Sync] Delete remote note exception:', e);
        }
    }

    /**
     * المزامنة الخلفية الشاملة
     */
    async function hayyizSyncNotes() {
        if (isSyncing) return;

        const user = await getAuthenticatedUser();
        if (!user) return; // المستخدم غير مسجل -> لا نستدعي Supabase ولا نغير السلوك

        isSyncing = true;

        try {
            const localNotes = getLocalNotes();

            // خذ نسخة احتياطية من hayyiz-notes قبل الدمج لحماية البيانات
            let localBackup = null;
            try {
                localBackup = localStorage.getItem('hayyiz-notes');
            } catch (e) {}

            const remoteRows = await loadRemoteNotes(user);

            // في حالة انقطاع الشبكة أو تعثر Supabase (إرجاع null)، نحتفظ بالبيانات المحلية كلياً دون تغيير
            if (remoteRows === null) {
                isSyncing = false;
                return;
            }

            const { mergedNotes, uploads } = mergeLocalAndRemoteNotes(localNotes, remoteRows);

            // تحقق مما إذا كانت الملاحظات المدمجة تختلف عن المحتوى المحلي الحالي
            const localJson = JSON.stringify(localNotes);
            const mergedJson = JSON.stringify(mergedNotes);
            const hasDataChanged = localJson !== mergedJson;

            if (hasDataChanged) {
                setLocalNotes(mergedNotes);
            }

            // رفع العناصر التي تحتاج رفعاً بشكل مجمع/متوازي
            if (uploads.length > 0) {
                const uploadPayloads = uploads.map(n => ({
                    user_id: user.id,
                    tool: 'notes',
                    item_id: n.id,
                    data: n,
                    updated_at: new Date(n.updated || n.created || Date.now()).toISOString(),
                    deleted_at: null
                }));

                try {
                    await supabaseClient
                        .from('sync_items')
                        .upsert(uploadPayloads, { onConflict: 'user_id,tool,item_id' });
                } catch (errUpload) {
                    console.warn('[Sync] Batch upload failed silently:', errUpload);
                }
            }

            // إشعار الواجهة بالإنعاش إذا تغيرت البيانات
            if (hasDataChanged && typeof syncCallback === 'function') {
                try {
                    syncCallback(mergedNotes);
                } catch (e) {
                    console.warn('[Sync] Callback execution error:', e);
                }
            }
        } catch (e) {
            console.warn('[Sync] hayyizSyncNotes root exception:', e);
        } finally {
            isSyncing = false;
        }
    }

    /**
     * تسجيل مستمع حالة التوثيق للمرة الأولى فقط
     */
    function initAuthListener() {
        if (authListenerRegistered) return;
        if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.auth) {
            authListenerRegistered = true;
            try {
                supabaseClient.auth.onAuthStateChange((event, session) => {
                    if (session && session.user) {
                        hayyizSyncNotes();
                    }
                });
            } catch (e) {
                console.warn('[Sync] Auth state change listener error:', e);
            }
        }
    }

    // مستمع لإعادة الاتصال بالإنترنت
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('online', () => {
            hayyizSyncNotes();
        });
    }

    // تصدير الدوال للاستخدام العام
    global.hayyizRegisterNotesSyncCallback = hayyizRegisterNotesSyncCallback;
    global.hayyizSyncNotes = hayyizSyncNotes;
    global.hayyizUploadNote = hayyizUploadNote;
    global.hayyizDeleteRemoteNote = hayyizDeleteRemoteNote;
    global.hayyizMergeLocalAndRemoteNotes = mergeLocalAndRemoteNotes;
    global.initAuthListener = initAuthListener;

})(typeof window !== 'undefined' ? window : global);
