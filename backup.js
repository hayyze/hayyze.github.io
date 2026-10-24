/* Local backups include the whiteboard and its PDF files in the active account. */
(function (global) {
    'use strict';

    const DRAW_KEY = 'hayyiz-free-spaces-v1';
    const DRAW_PREFS_KEY = 'hayyiz-draw-prefs';
    const PDF_STORE = 'pdf_blobs';
    const MAX_PDF_BYTES = 25 * 1024 * 1024;
    const MAX_TOTAL_PDF_BYTES = 100 * 1024 * 1024;
    const MAX_KEY_CHARACTERS = 8 * 1024 * 1024;
    const MAX_FILE_BYTES = 192 * 1024 * 1024;
    const unsafe = new Set(['__proto__', 'constructor', 'prototype', 'user_id', 'owner_id', 'user', 'account', 'auth_id',
        'role', 'roles', 'permissions', 'permission', 'admin', 'is_admin', 'points', 'score_points', 'premium',
        'is_premium', 'subscription', 'subscription_status', 'granted_focus_sessions', 'granted_sessions',
        'credits', 'limits', 'badges', 'badge']);
    let busy = false;

    function storage() { return global.hayyizStorage || global.localStorage; }
    function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
    function fail(message) { throw new Error(message); }
    function status(message, working) {
        if (!global.document) return;
        const text = document.getElementById('hayyiz-backup-status');
        if (text) text.textContent = message;
        ['hayyiz-export-btn', 'hayyiz-import-btn'].forEach(id => {
            const button = document.getElementById(id);
            if (button) button.disabled = working;
        });
    }
    async function operation(message, run) {
        if (busy) fail('انتظر اكتمال عملية النسخ أو الاستعادة الحالية.');
        busy = true;
        status(message, true);
        try { return await run(); }
        catch (error) { status(error.message || 'تعذرت عملية النسخ الاحتياطي.', false); throw error; }
        finally { busy = false; ['hayyiz-export-btn', 'hayyiz-import-btn'].forEach(id => {
            const button = global.document && document.getElementById(id);
            if (button) button.disabled = false;
        }); }
    }
    function cleanTree(value, depth, geometry) {
        if (depth > 40) fail('بنية ملف النسخة الاحتياطية غير صالحة.');
        if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
        if (typeof value === 'number') {
            if (!Number.isFinite(value)) fail('تحتوي النسخة على قيمة عددية غير صالحة.');
            return value;
        }
        if (Array.isArray(value)) return value.map(item => cleanTree(item, depth + 1, geometry));
        if (!object(value)) fail('بنية ملف النسخة الاحتياطية غير صالحة.');
        const result = Object.create(null);
        Object.keys(value).forEach(key => {
            if ((!unsafe.has(key.toLowerCase()) || (geometry && key === 'points')) && !key.toLowerCase().startsWith('_storagekey')) {
                result[key] = cleanTree(value[key], depth + 1, geometry);
            }
        });
        return result;
    }
    function parseStructured(raw, geometry) {
        try { return cleanTree(JSON.parse(raw), 0, geometry); }
        catch (error) { fail('تحتوي النسخة على بيانات محفوظة غير صالحة: ' + error.message); }
    }
    function validateDrawing(value) {
        if (!object(value) || !Array.isArray(value.spaces) || value.spaces.length > 1000) fail('بيانات مساحات الكتابة غير صالحة.');
        const ids = new Set();
        value.spaces.forEach(space => {
            if (!object(space) || typeof space.id !== 'string' || !space.id || space.id.length > 200 || ids.has(space.id) ||
                typeof space.name !== 'string' || !Array.isArray(space.pages) || !space.pages.length || space.pages.length > 10000) {
                fail('تحتوي النسخة على مساحة كتابة غير صالحة.');
            }
            ids.add(space.id);
            space.pages.forEach(page => {
                if (!object(page) || !Array.isArray(page.strokes) || !Array.isArray(page.texts)) fail('صفحات مساحة الكتابة غير صالحة.');
                page.strokes.forEach(stroke => {
                    if (!object(stroke) || !Array.isArray(stroke.points) || !Number.isFinite(stroke.size) || stroke.size < 0 ||
                        !stroke.points.every(point => object(point) && Number.isFinite(point.x) && Number.isFinite(point.y) &&
                            (point.pressure === undefined || point.pressure === null || Number.isFinite(point.pressure)))) {
                        fail('تحتوي النسخة على رسم غير صالح.');
                    }
                });
                page.texts.forEach(text => {
                    if (!object(text) || typeof text.text !== 'string' || !Number.isFinite(text.x) || !Number.isFinite(text.y) ||
                        !Number.isFinite(text.size) || text.size <= 0) fail('تحتوي النسخة على نص رسم غير صالح.');
                });
            });
            if (space.pageIndex !== undefined && (!Number.isInteger(space.pageIndex) || space.pageIndex < 0 || space.pageIndex >= space.pages.length)) {
                fail('رقم صفحة مساحة الكتابة غير صالح.');
            }
            if (space.metadata && space.metadata.pdf && (!object(space.metadata.pdf) || typeof space.metadata.pdf.fileName !== 'string' ||
                !Number.isInteger(space.metadata.pdf.pageCount) || space.metadata.pdf.pageCount < 1)) fail('بيانات ملف PDF غير صالحة.');
        });
        return value;
    }
    function allowedKeys() {
        return new Set([...(Array.isArray(global.HAYYIZ_ALLOWED_BACKUP_KEYS) ? global.HAYYIZ_ALLOWED_BACKUP_KEYS : []), DRAW_KEY, DRAW_PREFS_KEY]
            .filter(key => key !== 'hayyiz-workspace-focus-outbox'));
    }
    function sanitizeKey(key, raw) {
        if (typeof raw !== 'string') raw = JSON.stringify(raw);
        if (typeof raw !== 'string' || raw.length > MAX_KEY_CHARACTERS) fail('حجم البيانات المحلية في النسخة أكبر من الحد المسموح.');
        if (key === DRAW_KEY) return JSON.stringify(validateDrawing(parseStructured(raw, true)));
        if (key === DRAW_PREFS_KEY) {
            const prefs = parseStructured(raw);
            if (!object(prefs)) fail('تفضيلات الرسم غير صالحة.');
            return JSON.stringify(prefs);
        }
        // Validate nesting before the shared legacy sanitizer recursively reads it.
        const startsJson = raw.trim().startsWith('{') || raw.trim().startsWith('[');
        if (startsJson && !['hayyiz-current-task', 'hayyiz-birthdate'].includes(key)) {
            const parsed = parseStructured(raw);
            if (Array.isArray(parsed) && !parsed.every(item => object(item))) fail('تحتوي النسخة على سجل غير صالح.');
            if (Array.isArray(parsed)) parsed.forEach(item => {
                ['text', 'title', 'name', 'content', 'date'].forEach(field => {
                    if (item[field] !== undefined && item[field] !== null && typeof item[field] !== 'string') fail('تحتوي النسخة على حقل نصي غير صالح.');
                });
                if (item.tags !== undefined && (!Array.isArray(item.tags) || !item.tags.every(tag => typeof tag === 'string'))) fail('وسوم الملاحظات غير صالحة.');
            });
            raw = JSON.stringify(parsed);
        }
        if (typeof global.hayyizSanitizeValue !== 'function') fail('تعذر تحميل أدوات النسخ الاحتياطي. أعد فتح الصفحة.');
        const value = global.hayyizSanitizeValue(key, raw);
        if (value === null) fail('تحتوي النسخة على بيانات غير صالحة للمفتاح: ' + key);
        return value;
    }
    function pdfReferences(keys) {
        if (!Object.prototype.hasOwnProperty.call(keys, DRAW_KEY)) return [];
        return JSON.parse(keys[DRAW_KEY]).spaces.filter(space => space.metadata && space.metadata.pdf)
            .map(space => ({ id: space.id, fileName: space.metadata.pdf.fileName }));
    }
    function includeLegacyDrawing(currentStorage, keys) {
        if (keys[DRAW_KEY] && JSON.parse(keys[DRAW_KEY]).spaces.length) return;
        const raw = currentStorage.getItem('hayyiz-free-notes-v2');
        if (!raw) return;
        const old = parseStructured(raw, true);
        if (!object(old) || !Array.isArray(old.pages) || !old.pages.length) fail('تعذر قراءة مساحة الكتابة القديمة.');
        // Use the same legacy conversion as the drawing page without deleting or
        // changing the original data merely because the user exports a backup.
        const migrated = { spaces: [{ id: 'legacy-free-notes-v2', name: 'مساحة الكتابة السابقة', metadata: {},
            pages: old.pages.map((page, index) => ({ strokes: page.strokes || [], texts: (page.texts || []).map((text, textIndex) => ({
                id: text.id || 'legacy-text-' + index + '-' + textIndex, text: text.text || '', x: text.x || 0, y: text.y || 0,
                color: text.color || '#1e293b', size: text.size || 18, fontFamily: text.fontFamily || "'Segoe UI', Tahoma, Arial, sans-serif"
            })) })), pageIndex: Math.min(Math.max(0, Number(old.pageIndex) || 0), old.pages.length - 1),
            bgStyle: old.bgStyle || 'plain', updated: Number(old.updated) || 0 }] };
        keys[DRAW_KEY] = JSON.stringify(validateDrawing(migrated));
    }
    function pdfBytes(value) {
        let bytes;
        if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
        else if (ArrayBuffer.isView(value)) bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        else fail('تعذر قراءة أحد ملفات PDF المحفوظة.');
        if (bytes.byteLength < 5 || bytes.byteLength > MAX_PDF_BYTES) fail('يجب ألا يتجاوز حجم ملف PDF الواحد 25 ميجابايت.');
        const header = Array.from(bytes.subarray(0, 1024), byte => String.fromCharCode(byte)).join('');
        if (!header.includes('%PDF-')) fail('تحتوي النسخة على ملف ليس بصيغة PDF.');
        return bytes;
    }
    function encode(bytes) {
        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + 8192));
        return global.btoa(binary);
    }
    function decode(text) {
        if (typeof text !== 'string' || text.length > Math.ceil(MAX_PDF_BYTES / 3) * 4 || text.length % 4 !== 0 ||
            !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) fail('ترميز أحد ملفات PDF غير صالح.');
        let binary;
        try { binary = global.atob(text); } catch (_) { fail('ترميز أحد ملفات PDF غير صالح.'); }
        return pdfBytes(Uint8Array.from(binary, character => character.charCodeAt(0)));
    }
    function databaseName(currentStorage) {
        return typeof currentStorage.databaseName === 'function' ? currentStorage.databaseName('hayyiz-pdf-db') : 'hayyiz-pdf-db';
    }
    function openPdfDb(name) {
        name = name || databaseName(storage());
        return new Promise((resolve, reject) => {
            if (!global.indexedDB) return reject(new Error('لا يدعم هذا المتصفح حفظ ملفات PDF. جرّب متصفحًا يدعمها.'));
            const request = global.indexedDB.open(name, 1);
            let settled = false;
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(PDF_STORE)) db.createObjectStore(PDF_STORE, { keyPath: 'spaceId' });
            };
            request.onsuccess = () => {
                // A blocked request may still succeed after the caller has
                // retried. Do not leave that abandoned connection open.
                if (settled) { request.result.close(); return; }
                settled = true;
                resolve(request.result);
            };
            request.onerror = () => { settled = true; reject(request.error || new Error('تعذر فتح ملفات PDF المحفوظة.')); };
            request.onblocked = () => { settled = true; reject(new Error('أغلق مساحة الكتابة المفتوحة ثم أعد المحاولة.')); };
        });
    }
    async function readPdfs(references, name) {
        if (!references.length) return [];
        const db = await openPdfDb(name);
        try {
            return await new Promise((resolve, reject) => {
                const result = new Array(references.length);
                const transaction = db.transaction(PDF_STORE, 'readonly');
                references.forEach((reference, index) => {
                    const request = transaction.objectStore(PDF_STORE).get(reference.id);
                    request.onsuccess = () => { result[index] = request.result || null; };
                });
                transaction.oncomplete = () => resolve(result);
                transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('تعذر قراءة ملفات PDF المحفوظة.'));
            });
        } finally { db.close(); }
    }
    async function createBackupFromStorage(currentStorage, name) {
        if (!currentStorage || typeof currentStorage.getItem !== 'function') fail('تعذر قراءة البيانات المحلية.');
        name = name || databaseName(currentStorage);
        if (typeof name !== 'string' || !/^hayyiz-pdf-db(?:--[\w%-]+)?$/.test(name)) fail('تعذر تحديد ملفات PDF الخاصة بهذه البيانات.');
        return operation('جارٍ تجهيز النسخة الاحتياطية وملفات PDF…', async () => {
            const keys = Object.create(null);
            allowedKeys().forEach(key => {
                const raw = currentStorage.getItem(key);
                if (raw !== null) keys[key] = sanitizeKey(key, raw);
            });
            includeLegacyDrawing(currentStorage, keys);
            if (Object.values(keys).reduce((total, value) => total + value.length, 0) > MAX_KEY_CHARACTERS) {
                fail('حجم البيانات المحلية في النسخة أكبر من الحد المسموح.');
            }
            const references = pdfReferences(keys);
            const records = await readPdfs(references, name);
            const pdfFiles = [], missingPdfIds = [];
            let total = 0;
            references.forEach((reference, index) => {
                const record = records[index];
                if (!record) { missingPdfIds.push(reference.id); return; }
                const bytes = pdfBytes(record.data);
                total += bytes.byteLength;
                if (total > MAX_TOTAL_PDF_BYTES) fail('يتجاوز مجموع ملفات PDF في النسخة 100 ميجابايت.');
                const fileName = typeof record.fileName === 'string' && record.fileName ? record.fileName : reference.fileName;
                if (fileName.length > 1000) fail('اسم أحد ملفات PDF غير صالح.');
                pdfFiles.push({ id: reference.id, fileName, data: encode(bytes) });
            });
            const backup = { version: 3, exportedAt: new Date().toISOString(), app: 'حيز', keys, pdfFiles };
            if (missingPdfIds.length) backup.missingPdfIds = missingPdfIds;
            status(missingPdfIds.length
                ? 'جُهزت البيانات والرسومات. تنبيه: ' + missingPdfIds.length + ' ملفات PDF لم تعد موجودة على هذا الجهاز ولا يمكن تضمينها.'
                : 'جُهزت النسخة الاحتياطية مع ' + pdfFiles.length + ' ملفات PDF.', false);
            return backup;
        });
    }
    function createBackup() { return createBackupFromStorage(storage()); }
    function validateBackup(data) {
        if (!object(data) || !object(data.keys) || (data.version !== undefined && ![1, 2, 3].includes(data.version))) fail('الملف ليس نسخة احتياطية مدعومة من حيز.');
        const allowed = allowedKeys(), keys = Object.create(null);
        let characters = 0;
        Object.keys(data.keys).forEach(key => {
            if (!allowed.has(key)) return;
            const value = sanitizeKey(key, data.keys[key]);
            characters += value.length;
            if (characters > MAX_KEY_CHARACTERS) fail('حجم البيانات المحلية في النسخة أكبر من الحد المسموح.');
            keys[key] = value;
        });
        if (!Object.keys(keys).length) fail('لم يُعثر على بيانات شخصية صالحة في النسخة.');
        const references = new Map(pdfReferences(keys).map(reference => [reference.id, reference]));
        const files = data.pdfFiles === undefined ? [] : data.pdfFiles;
        if (!Array.isArray(files) || files.length > 1000) fail('قائمة ملفات PDF غير صالحة.');
        const ids = new Set();
        let total = 0;
        const pdfFiles = files.map(file => {
            if (!object(file) || typeof file.id !== 'string' || !references.has(file.id) || ids.has(file.id) ||
                typeof file.fileName !== 'string' || file.fileName.length > 1000) fail('بيانات أحد ملفات PDF غير صالحة أو لا ترتبط بمساحة كتابة.');
            ids.add(file.id);
            const bytes = decode(file.data);
            total += bytes.byteLength;
            if (total > MAX_TOTAL_PDF_BYTES) fail('يتجاوز مجموع ملفات PDF في النسخة 100 ميجابايت.');
            return { spaceId: file.id, fileName: file.fileName, data: bytes.buffer, updated: Date.now() };
        });
        return { keys, pdfFiles, missingPdfIds: Array.from(references.keys()).filter(id => !ids.has(id)) };
    }
    function localRestore(currentStorage, keys) {
        Object.keys(keys).forEach(key => currentStorage.setItem(key, keys[key]));
    }
    function rollbackLocal(currentStorage, previous) {
        // Remove the staged values first so restoring a full previous store does
        // not require room for both versions at once after a quota failure.
        Object.keys(previous).forEach(key => currentStorage.removeItem(key));
        Object.keys(previous).forEach(key => { if (previous[key] !== null) currentStorage.setItem(key, previous[key]); });
    }
    async function restoreBackup(data) {
        return operation('جارٍ التحقق من النسخة واستعادة البيانات…', async () => {
            const validated = validateBackup(data);
            if (validated.missingPdfIds.length) {
                const missing = new Set(validated.missingPdfIds);
                const drawing = JSON.parse(validated.keys[DRAW_KEY]);
                drawing.spaces.forEach(space => {
                    // A previous local PDF can share this ID but have different
                    // bytes. Keep annotations without attaching the wrong file.
                    if (missing.has(space.id)) delete space.metadata.pdf;
                });
                validated.keys[DRAW_KEY] = JSON.stringify(drawing);
            }
            const currentStorage = storage();
            if (typeof global.hayyizPrepareRestoredKeys === 'function') {
                validated.keys = global.hayyizPrepareRestoredKeys(validated.keys);
            }
            const previous = Object.create(null);
            Object.keys(validated.keys).forEach(key => { previous[key] = currentStorage.getItem(key); });
            if (!validated.pdfFiles.length) {
                try { localRestore(currentStorage, validated.keys); }
                catch (error) {
                    try { rollbackLocal(currentStorage, previous); }
                    catch (_) { fail('تعذرت استعادة البيانات السابقة كاملة. احتفظ بملف النسخة وأعد المحاولة بعد توفير مساحة.'); }
                    throw error;
                }
            } else {
                const db = await openPdfDb();
                try {
                    await new Promise((resolve, reject) => {
                        const transaction = db.transaction(PDF_STORE, 'readwrite');
                        const store = transaction.objectStore(PDF_STORE);
                        let localAttempted = false, cause = null;
                        transaction.oncomplete = () => resolve();
                        transaction.onabort = transaction.onerror = () => {
                            try { if (localAttempted) rollbackLocal(currentStorage, previous); }
                            catch (_) { return reject(new Error('تعذرت استعادة البيانات السابقة كاملة. احتفظ بملف النسخة وأعد المحاولة بعد توفير مساحة.')); }
                            reject(cause || transaction.error || new Error('تعذر حفظ ملفات PDF؛ احتُفظ بالبيانات السابقة.'));
                        };
                        try {
                            validated.pdfFiles.forEach((file, index) => {
                                const request = store.put(file);
                                if (index === validated.pdfFiles.length - 1) request.onsuccess = () => {
                                    localAttempted = true;
                                    try { localRestore(currentStorage, validated.keys); }
                                    catch (error) { cause = error; transaction.abort(); }
                                };
                            });
                        } catch (error) { cause = error; transaction.abort(); }
                    });
                } finally { db.close(); }
            }
            status('استُعيدت البيانات مع ' + validated.pdfFiles.length + ' ملفات PDF.' +
                (validated.missingPdfIds.length ? ' تنبيه: حُفظت الرسومات دون خلفية ' + validated.missingPdfIds.length + ' ملفات PDF غير مضمّنة في النسخة.' : ''), false);
            return { keysCount: Object.keys(validated.keys).length, pdfCount: validated.pdfFiles.length, missingPdfIds: validated.missingPdfIds };
        });
    }

    global.hayyizCreateBackup = createBackup;
    global.hayyizCreateBackupFromStorage = createBackupFromStorage;
    global.hayyizRestoreBackup = restoreBackup;
    global.hayyizValidateBackup = validateBackup;
    global.hayyizBackupLimits = Object.freeze({ maxFileBytes: MAX_FILE_BYTES, maxPdfBytes: MAX_PDF_BYTES, maxTotalPdfBytes: MAX_TOTAL_PDF_BYTES });
})(window);
