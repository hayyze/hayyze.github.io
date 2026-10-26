var hayyizStorage = (typeof window !== 'undefined' && window.hayyizStorage) || (typeof localStorage !== 'undefined' ? localStorage : undefined);
/**
 * دفتر الملاحظات الدراسية - حيز
 * إدارة الملاحظات وتنظيمها، البحث، التصفية، والربط بالمهام والمواد
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. تحميل واستعادة وقراءة البيانات بصورة آمنة ---
    let notes = loadAndNormalizeNotes();
    let editingId = null;
    let editingBase = null;
    let savingNote = false;
    let editorDirty = false;
    let draftSaved = true;
    let editorRevision = 0;
    const draftId = generateUniqueId();
    const draftKey = 'hayyiz-note-draft-' + draftId;
    const draftLockName = key => 'hayyiz-note-editor:' + (hayyizStorage.scope || 'guest') + ':' + key;
    const draftLocks = typeof navigator !== 'undefined' && navigator.locks;
    // A document owns its key for its lifetime. Cloned sessionStorage cannot
    // give another tab ownership; closed documents automatically release locks.
    const draftReady = draftLocks ? new Promise(resolve => {
        draftLocks.request(draftLockName(draftKey), () => {
            resolve();
            return new Promise(() => {});
        }).catch(() => resolve());
    }) : Promise.resolve();
    let pendingDeleteId = null;

    // عناصر النموذج والواجهة
    const modePicker = document.getElementById('notes-mode-picker');
    const textPanel = document.getElementById('text-notes-panel');
    const chooseText = document.getElementById('choose-text-notes');
    const backToModes = document.getElementById('back-to-modes');

    const notesForm = document.getElementById('notes-form');
    const noteTitle = document.getElementById('note-title');
    const notesExtraDetails = document.getElementById('notes-extra-details');
    const noteSubjectSelect = document.getElementById('note-subject-select');
    const customSubjectField = document.getElementById('custom-subject-field');
    const noteSubjectCustom = document.getElementById('note-subject-custom');
    const noteCategory = document.getElementById('note-category');
    const noteTags = document.getElementById('note-tags');
    const noteTaskSelect = document.getElementById('note-task-select');
    const noteContent = document.getElementById('note-content');
    const notePinned = document.getElementById('note-pinned');
    const noteFavorite = document.getElementById('note-favorite');
    const noteReview = document.getElementById('note-review');
    const submitBtn = document.getElementById('note-submit-btn');
    const clearNoteBtn = document.getElementById('clear-note-btn');
    const saveStatus = document.getElementById('note-save-status');
    const saveCopyBtn = document.getElementById('note-save-copy-btn');

    // أدوات الشريط والبحث والتصفية
    const notesSearch = document.getElementById('notes-search');
    const filterSubject = document.getElementById('filter-subject');
    const filterTag = document.getElementById('filter-tag');
    const notesSort = document.getElementById('notes-sort');
    const filterPills = document.querySelectorAll('.filter-pill');

    const notesList = document.getElementById('notes-list');
    const notesEmpty = document.getElementById('notes-empty');
    const notesSearchEmpty = document.getElementById('notes-search-empty');

    // مودال عرض الملاحظة
    const viewModal = document.getElementById('note-view-modal');
    const closeViewModal = document.getElementById('close-view-modal');
    const viewBadges = document.getElementById('view-note-badges');
    const viewTitle = document.getElementById('view-note-title');
    const viewMeta = document.getElementById('view-note-meta');
    const viewContent = document.getElementById('view-note-content');
    const viewTags = document.getElementById('view-note-tags');
    const viewTask = document.getElementById('view-note-task');
    const viewCopyBtn = document.getElementById('view-copy-btn');
    const viewShareBtn = document.getElementById('view-share-btn');
    const viewEditBtn = document.getElementById('view-edit-btn');
    const viewDeleteBtn = document.getElementById('view-delete-btn');
    let currentViewingNoteId = null;

    // مودال تأكيد الحذف
    const deleteModal = document.getElementById('note-delete-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

    // إشعار التنبيه
    const toast = document.getElementById('notes-toast');

    // حالة التصفية الحالية
    let currentPillFilter = 'all'; // all, pinned, favorite, review

    // المعلمات من الرابط (بومودورو / المهام)
    const urlParams = new URLSearchParams(window.location.search);
    const prefillTitle = urlParams.get('title');
    const urlNoteId = urlParams.get('id');
    let urlTaskName = urlParams.get('task') || prefillTitle || null;
    let urlTaskId = urlParams.get('taskId') || null;
    if (urlTaskName) {
        try { urlTaskName = decodeURIComponent(urlTaskName); } catch (e) { /* keep */ }
    }
    if (urlTaskId) {
        try { urlTaskId = decodeURIComponent(urlTaskId); } catch (e) { /* keep */ }
    }

    // --- 2. الدعم التقني والتطبيع لتفادي أخطاء البيانات الكاسرة ---
    function generateUniqueId() {
        if (typeof hayyizGenerateId === 'function') {
            return hayyizGenerateId();
        }
        return 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function loadAndNormalizeNotes() {
        let rawNotes = [];
        try {
            const raw = hayyizStorage.getItem('hayyiz-notes');
            rawNotes = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(rawNotes)) rawNotes = [];
        } catch (e) {
            rawNotes = [];
        }

        let hasChanges = false;
        const normalized = rawNotes.map(n => {
            if (!n || typeof n !== 'object') return null;
            const item = Object.assign({}, n);

            if (!item.id) {
                item.id = generateUniqueId();
                hasChanges = true;
            }
            if (typeof item.title !== 'string') item.title = '';
            if (typeof item.content !== 'string') item.content = '';
            if (!item.created || typeof item.created !== 'number') {
                item.created = Date.now();
                hasChanges = true;
            }

            item.subject = typeof item.subject === 'string' ? item.subject.trim() : '';
            const canonicalSubject = subjectMatch(item.subjectId, item.subject);
            if (canonicalSubject && !item.subjectId) { item.subjectId = canonicalSubject.id; hasChanges = true; }
            item.category = typeof item.category === 'string' ? item.category.trim() : '';

            // الوسوم
            if (Array.isArray(item.tags)) {
                item.tags = item.tags.map(t => String(t).trim().replace(/^#/, '')).filter(Boolean);
            } else if (typeof item.tags === 'string' && item.tags.trim()) {
                item.tags = item.tags.split(/[,،\s]+/).map(t => t.trim().replace(/^#/, '')).filter(Boolean);
                hasChanges = true;
            } else {
                item.tags = [];
            }

            item.relatedTaskId = item.relatedTaskId || null;
            item.relatedTask = typeof item.relatedTask === 'string' ? item.relatedTask.trim() : null;

            item.isPinned = Boolean(item.isPinned);
            item.isFavorite = Boolean(item.isFavorite);
            item.isReview = Boolean(item.isReview);

            return item;
        }).filter(Boolean);

        if (hasChanges) {
            try { hayyizStorage.setItem('hayyiz-notes', JSON.stringify(normalized)); } catch (e) {}
        }

        return normalized;
    }

    // Read the latest collection inside a same-origin Web Lock. A stale tab may
    // change only its selected record, never replace another tab's collection.
    async function saveNotes(id, update, expected) {
        const commit = () => {
            if (hayyizStorage.isCurrentScope && !hayyizStorage.isCurrentScope(hayyizStorage.scope)) return false;
            const latest = loadAndNormalizeNotes();
            const index = latest.findIndex(note => note.id === id);
            if (expected !== undefined && (index < 0 || noteVersion(latest[index]) !== noteVersion(JSON.parse(expected)))) {
                if (saveCopyBtn) saveCopyBtn.hidden = false;
                showSaveError('تغيرت هذه الملاحظة أو حُذفت في تبويب أو جهاز آخر. احتفظ بتعديلك كنسخة جديدة.');
                return false;
            }
            const next = update(index >= 0 ? latest[index] : null);
            if (next === null) {
                if (index >= 0) latest.splice(index, 1);
            } else if (index >= 0) latest[index] = next;
            else latest.unshift(next);
            hayyizStorage.setItem('hayyiz-notes', JSON.stringify(latest));
            notes = latest;
            return next === null ? true : next;
        };
        try {
            const locks = typeof navigator !== 'undefined' && navigator.locks;
            return locks && typeof locks.request === 'function'
                ? await locks.request('hayyiz-notes:' + (hayyizStorage.scope || 'guest'), commit) : commit();
        } catch (e) {
            showSaveError('تعذر الحفظ على هذا الجهاز. النص ما زال في المحرر؛ انسخه أو صدّر بياناتك ثم وفّر مساحة وحاول مجددًا.');
            return false;
        }
    }

    function noteVersion(note) {
        const value = { ...note, subjectId: subjectMatch(note.subjectId, note.subject)?.id || note.subjectId || null };
        return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
    }

    function showSaveError(message) {
        if (saveStatus) saveStatus.textContent = message;
        showToast(message);
    }

    function getSubjects() {
        return typeof hayyizGetSubjects === 'function' ? hayyizGetSubjects() : [];
    }

    function subjectMatch(id, name) {
        const subjects = getSubjects();
        if (id) return subjects.find(subject => subject && String(subject.id) === String(id)) || null;
        const normalize = value => String(value || '').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').trim().replace(/^ال/, '');
        const matches = name ? subjects.filter(subject => subject && normalize(subject.name) === normalize(name)) : [];
        return matches.length === 1 ? matches[0] : null;
    }

    function noteSubject(note) {
        const subject = subjectMatch(note.subjectId, note.subject);
        return subject ? { id: subject.id, name: subject.name } : { id: null, name: note.subject || '' };
    }

    function fillSubjects(id, name) {
        if (!noteSubjectSelect) return;
        const current = subjectMatch(id, name);
        const options = getSubjects().filter(subject => subject && subject.id).map(subject => ({ value: subject.id, name: subject.name }));
        const legacy = new Set(['رياضيات', 'فيزياء', 'كيمياء', 'أحياء', 'لغة عربية', 'لغة إنجليزية', 'اجتماعيات']);
        notes.forEach(note => { if (note.subject && !note.subjectId) legacy.add(note.subject); });
        if (name && !current) legacy.add(name);
        legacy.forEach(value => { if (!subjectMatch(null, value)) options.push({ value: 'legacy:' + value, name: value }); });
        noteSubjectSelect.replaceChildren();
        [{ value: '', name: 'بدون مادة' }, ...options, { value: 'other', name: 'أخرى...' }].forEach(item => {
            const option = document.createElement('option');
            option.value = item.value; option.textContent = item.name; noteSubjectSelect.appendChild(option);
        });
        noteSubjectSelect.value = current ? current.id : name ? 'legacy:' + name : '';
    }

    function selectedSubject() {
        const value = noteSubjectSelect ? noteSubjectSelect.value : '';
        const subject = value && value !== 'other' && !value.startsWith('legacy:') ? subjectMatch(value, '') : null;
        const name = value === 'other' ? (noteSubjectCustom ? noteSubjectCustom.value.trim() : '')
            : value.startsWith('legacy:') ? value.slice(7) : subject ? subject.name : '';
        return { subject: name, subjectId: subject ? subject.id : null };
    }

    function showToast(message) {
        if (!toast) return;
        toast.textContent = message;
        toast.classList.remove('hidden');
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hidden');
        }, 3000);
    }

    // --- 3. إدارة وضع العرض (picker vs text notes) ---
    function showTextNotes() {
        if (modePicker) modePicker.classList.add('hidden');
        if (textPanel) textPanel.classList.remove('hidden');
        try { sessionStorage.setItem('hayyiz-notes-mode', 'text'); } catch (e) {}
    }

    function showModePicker() {
        if (modePicker) modePicker.classList.remove('hidden');
        if (textPanel) textPanel.classList.add('hidden');
        try { sessionStorage.setItem('hayyiz-notes-mode', 'picker'); } catch (e) {}
    }

    if (chooseText) chooseText.addEventListener('click', showTextNotes);
    if (backToModes) backToModes.addEventListener('click', showModePicker);

    try { if (sessionStorage.getItem('hayyiz-notes-mode') === 'text') showTextNotes(); } catch (_) {}

    // --- 4. تهيئة الخيارات القادمة من المزايا الأخرى (المواد والمهام) ---
    function populateTasksDropdown() {
        if (!noteTaskSelect) return;
        let todos = [];
        if (typeof hayyizGetTodos === 'function') {
            todos = hayyizGetTodos();
        } else {
            try {
                todos = JSON.parse(hayyizStorage.getItem('hayyiz-todos') || '[]');
            } catch (e) { todos = []; }
        }

        const currentVal = noteTaskSelect.value;
        const activeTodos = Array.isArray(todos) ? todos.filter(t => t && (!t.completed || String(t.id) === currentVal)) : [];

        noteTaskSelect.innerHTML = '<option value="">بدون مهمة مرتبطة</option>';
        activeTodos.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id || t.text;
            opt.textContent = t.text;
            if (t.id) opt.dataset.taskId = t.id;
            opt.dataset.taskText = t.text;
            noteTaskSelect.appendChild(opt);
        });

        if (currentVal) noteTaskSelect.value = currentVal;
    }

    function populateFilterDropdowns() {
        // قائمة المواد للمرشح
        if (filterSubject) {
            const currentSub = filterSubject.value;
            const subjectsSet = new Set();

            if (typeof hayyizGetSubjects === 'function') {
                const globalSubs = hayyizGetSubjects();
                if (Array.isArray(globalSubs)) {
                    globalSubs.forEach(s => { if (s && s.name) subjectsSet.add(s.name); });
                }
            }

            notes.forEach(n => {
                const subject = noteSubject(n);
                if (subject.name) subjectsSet.add(subject.name);
            });

            filterSubject.innerHTML = '<option value="">جميع المواد</option>';
            Array.from(subjectsSet).sort().forEach(sub => {
                const opt = document.createElement('option');
                opt.value = sub;
                opt.textContent = sub;
                filterSubject.appendChild(opt);
            });
            if (currentSub) filterSubject.value = currentSub;
        }

        // قائمة الوسوم للمرشح
        if (filterTag) {
            const currentTag = filterTag.value;
            const tagsSet = new Set();
            notes.forEach(n => {
                if (Array.isArray(n.tags)) {
                    n.tags.forEach(t => tagsSet.add(t));
                }
            });

            filterTag.innerHTML = '<option value="">جميع الوسوم</option>';
            Array.from(tagsSet).sort().forEach(tag => {
                const opt = document.createElement('option');
                opt.value = tag;
                opt.textContent = '#' + tag;
                filterTag.appendChild(opt);
            });
            if (currentTag) filterTag.value = currentTag;
        }
    }

    if (noteSubjectSelect) {
        noteSubjectSelect.addEventListener('change', () => {
            if (noteSubjectSelect.value === 'other') {
                if (customSubjectField) customSubjectField.classList.remove('hidden');
                if (noteSubjectCustom) noteSubjectCustom.focus();
            } else {
                if (customSubjectField) customSubjectField.classList.add('hidden');
                if (noteSubjectCustom) noteSubjectCustom.value = '';
            }
            saveDraft();
        });
    }

    // --- 5. الحفظ التلقائي للمسودة ---
    function saveDraft() {
        editorDirty = true;
        editorRevision++;
        const titleVal = noteTitle ? noteTitle.value : '';
        const contentVal = noteContent ? noteContent.value : '';
        const categoryVal = noteCategory ? noteCategory.value : '';
        const tagsVal = noteTags ? noteTags.value : '';

        const selected = selectedSubject();
        const subjectVal = selected.subject;

        const taskVal = noteTaskSelect ? noteTaskSelect.value : '';
        const pinnedVal = notePinned ? notePinned.checked : false;
        const favVal = noteFavorite ? noteFavorite.checked : false;
        const reviewVal = noteReview ? noteReview.checked : false;

        const hasAnyContent = editingId || titleVal.trim() || contentVal.trim() || subjectVal || categoryVal || tagsVal.trim();

        if (hasAnyContent) {
            const draftObj = {
                updatedAt: Date.now(),
                editingId,
                editingBase,
                subjectId: selected.subjectId,
                title: titleVal,
                content: contentVal,
                subject: subjectVal,
                category: categoryVal,
                tags: tagsVal,
                task: taskVal,
                taskText: noteTaskSelect && noteTaskSelect.selectedOptions[0] ? noteTaskSelect.selectedOptions[0].dataset.taskText || '' : '',
                isPinned: pinnedVal,
                isFavorite: favVal,
                isReview: reviewVal
            };
            try { hayyizStorage.setItem(draftKey, JSON.stringify(draftObj)); draftSaved = true; }
            catch (e) { draftSaved = false; showSaveError('تعذر حفظ المسودة تلقائيًا. أبقِ الصفحة مفتوحة وانسخ النص قبل مغادرتها.'); }
        } else {
            try { hayyizStorage.removeItem(draftKey); draftSaved = true; } catch (e) { draftSaved = false; }
        }
    }

    async function loadDraft() {
        await draftReady;
        if (editorDirty || prefillTitle || urlTaskName || urlNoteId) return;
        try {
            let key = draftKey;
            let raw = hayyizStorage.getItem(key);
            if (!raw) {
                const candidates = ['hayyiz-note-draft'];
                for (let i = 0; i < hayyizStorage.length; i++) {
                    const candidate = hayyizStorage.key(i);
                    if (candidate && candidate.startsWith('hayyiz-note-draft-')) candidates.push(candidate);
                }
                const drafts = candidates.map(candidate => {
                    try { const value = hayyizStorage.getItem(candidate); return value ? { key: candidate, raw: value, at: Number(JSON.parse(value).updatedAt) || 0 } : null; }
                    catch (_) { return null; }
                }).filter(Boolean).sort((a, b) => b.at - a.at);
                for (const candidate of drafts) {
                    const recover = lock => {
                        if (!lock || editorDirty) return;
                        const latest = hayyizStorage.getItem(candidate.key);
                        if (latest !== candidate.raw) return;
                        // Persist the new owner before removing the orphan. A
                        // quota error leaves the original recovery copy intact.
                        hayyizStorage.setItem(draftKey, latest);
                        hayyizStorage.removeItem(candidate.key);
                        key = draftKey;
                        raw = latest;
                    };
                    if (draftLocks) await draftLocks.request(draftLockName(candidate.key), { ifAvailable: true }, recover);
                    else { key = candidate.key; raw = candidate.raw; } // Preserve foreign copies on older browsers.
                    if (raw) break;
                }
            }
            if (raw && !editorDirty) {
                const draft = JSON.parse(raw);
                if (draft && typeof draft === 'object') {
                    editingId = draft.editingId || null;
                    editingBase = typeof draft.editingBase === 'string' ? draft.editingBase : undefined;
                    if (noteTitle) noteTitle.value = draft.title || '';
                    if (noteContent) noteContent.value = draft.content || '';
                    if (noteCategory) noteCategory.value = draft.category || '';
                    if (noteTags) noteTags.value = draft.tags || '';

                    fillSubjects(draft.subjectId, draft.subject);

                    if (noteTaskSelect && draft.task) {
                        if (!Array.from(noteTaskSelect.options).some(option => option.value === draft.task)) {
                            const option = document.createElement('option');
                            option.value = draft.task;
                            option.dataset.taskId = draft.task;
                            option.dataset.taskText = draft.taskText || '';
                            option.textContent = draft.taskText || 'المهمة المرتبطة السابقة';
                            noteTaskSelect.appendChild(option);
                        }
                        noteTaskSelect.value = draft.task;
                    }

                    if (notePinned) notePinned.checked = Boolean(draft.isPinned);
                    if (noteFavorite) noteFavorite.checked = Boolean(draft.isFavorite);
                    if (noteReview) noteReview.checked = Boolean(draft.isReview);
                    if (editingId) {
                        if (submitBtn) submitBtn.textContent = 'تحديث الملاحظة';
                        if (clearNoteBtn) clearNoteBtn.textContent = 'إلغاء التعديل';
                    }
                    editorDirty = true;
                    showTextNotes();

                    // افتح تفاصيل الخيارات الإضافية تلقائياً إذا كانت تحتوي على بيانات في المسودة
                    if (draft.subject || draft.category || draft.tags || draft.task || draft.isPinned || draft.isFavorite || draft.isReview) {
                        if (notesExtraDetails) notesExtraDetails.open = true;
                    }
                }
            }
        } catch (e) { showSaveError('تعذر استرجاع المسودة؛ النسخة الأصلية محفوظة على الجهاز.'); }
    }

    // ربط مستمعات المسودة
    [noteTitle, noteContent, noteSubjectCustom, noteCategory, noteTags, noteTaskSelect].forEach(el => {
        if (el) el.addEventListener('input', () => { editorDirty = true; saveDraft(); });
    });
    [notePinned, noteFavorite, noteReview].forEach(el => {
        if (el) el.addEventListener('change', () => { editorDirty = true; saveDraft(); });
    });

    function resetForm() {
        editingId = null;
        editingBase = null;
        editorDirty = false;
        draftSaved = true;
        if (saveStatus) saveStatus.textContent = '';
        if (saveCopyBtn) saveCopyBtn.hidden = true;
        if (notesForm) notesForm.reset();
        if (customSubjectField) customSubjectField.classList.add('hidden');
        if (noteSubjectCustom) noteSubjectCustom.value = '';
        fillSubjects(null, '');
        if (notesExtraDetails) notesExtraDetails.open = false;
        try {
            hayyizStorage.removeItem(draftKey);
        } catch (e) {}

        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fa-solid fa-plus"></i> حفظ الملاحظة';
        }
        if (clearNoteBtn) clearNoteBtn.textContent = 'مسح';
    }

    // --- 6. تصفية وترتيب وعرض الملاحظات ---
    function renderNotes() {
        populateFilterDropdowns();

        const query = notesSearch ? notesSearch.value.trim().toLowerCase() : '';
        const selectedSubject = filterSubject ? filterSubject.value : '';
        const selectedTag = filterTag ? filterTag.value : '';
        const sortVal = notesSort ? notesSort.value : 'updated-desc';

        // 1. التصفية
        let filtered = notes.filter(note => {
            // تصفية الأقراص السريعة
            if (currentPillFilter === 'pinned' && !note.isPinned) return false;
            if (currentPillFilter === 'favorite' && !note.isFavorite) return false;
            if (currentPillFilter === 'review' && !note.isReview) return false;

            // تصفية المادة
            if (selectedSubject && noteSubject(note).name !== selectedSubject) return false;

            // تصفية الوسم
            if (selectedTag && (!Array.isArray(note.tags) || !note.tags.includes(selectedTag))) return false;

            // نص البحث
            if (query) {
                const titleMatch = (note.title || '').toLowerCase().includes(query);
                const contentMatch = (note.content || '').toLowerCase().includes(query);
                const subjectMatch = (note.subject || '').toLowerCase().includes(query);
                const categoryMatch = (note.category || '').toLowerCase().includes(query);
                const tagMatch = Array.isArray(note.tags) && note.tags.some(t => t.toLowerCase().includes(query));
                const taskMatch = (note.relatedTask || '').toLowerCase().includes(query);

                if (!titleMatch && !contentMatch && !subjectMatch && !categoryMatch && !tagMatch && !taskMatch) {
                    return false;
                }
            }

            return true;
        });

        // 2. الترتيب
        filtered.sort((a, b) => {
            // الملاحظات المثبتة تظهر دائمًا في الأعلى ما لم تكن التصفية خاصة
            if (a.isPinned !== b.isPinned) {
                return a.isPinned ? -1 : 1;
            }

            if (sortVal === 'updated-desc') {
                const timeA = a.updated || a.created;
                const timeB = b.updated || b.created;
                return timeB - timeA;
            } else if (sortVal === 'created-desc') {
                return b.created - a.created;
            } else if (sortVal === 'created-asc') {
                return a.created - b.created;
            } else if (sortVal === 'title-asc') {
                return (a.title || 'بدون عنوان').localeCompare(b.title || 'بدون عنوان', 'ar');
            }
            return 0;
        });

        // 3. العرض والتحكم في حالات الفراغ
        notesList.innerHTML = '';

        if (notes.length === 0) {
            if (notesEmpty) notesEmpty.classList.remove('hidden');
            if (notesSearchEmpty) notesSearchEmpty.classList.add('hidden');
            return;
        }

        if (filtered.length === 0) {
            if (notesEmpty) notesEmpty.classList.add('hidden');
            if (notesSearchEmpty) notesSearchEmpty.classList.remove('hidden');
            return;
        }

        if (notesEmpty) notesEmpty.classList.add('hidden');
        if (notesSearchEmpty) notesSearchEmpty.classList.add('hidden');

        // جلب المهام الحالية لمطابقة الروابط
        let currentTodos = [];
        if (typeof hayyizGetTodos === 'function') {
            currentTodos = hayyizGetTodos();
        } else {
            try { currentTodos = JSON.parse(hayyizStorage.getItem('hayyiz-todos') || '[]'); } catch (e) {}
        }

        filtered.forEach(note => {
            const card = document.createElement('div');
            card.className = 'note-card' + (note.isPinned ? ' pinned-card' : '');
            card.dataset.id = note.id;

            // إجراءات وتسهيلات رأس البطاقة
            const actions = document.createElement('div');
            actions.className = 'note-card-actions';

            const pinBtn = document.createElement('button');
            pinBtn.type = 'button';
            pinBtn.className = 'note-action-btn' + (note.isPinned ? ' active' : '');
            pinBtn.setAttribute('aria-label', note.isPinned ? 'إلغاء التثبيت' : 'تثبيت الملاحظة');
            pinBtn.title = note.isPinned ? 'إلغاء التثبيت' : 'تثبيت';
            pinBtn.innerHTML = '<i class="fa-solid fa-thumbtack" aria-hidden="true"></i>';
            pinBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                togglePinNote(note.id);
            });

            const favBtn = document.createElement('button');
            favBtn.type = 'button';
            favBtn.className = 'note-action-btn' + (note.isFavorite ? ' active-fav' : '');
            favBtn.setAttribute('aria-label', note.isFavorite ? 'إزالة من المفضلة' : 'تمييز كمفضلة');
            favBtn.title = note.isFavorite ? 'في المفضلة' : 'إضافة للمفضلة';
            favBtn.innerHTML = '<i class="' + (note.isFavorite ? 'fa-solid' : 'fa-regular') + ' fa-star" aria-hidden="true"></i>';
            favBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavoriteNote(note.id);
            });

            actions.appendChild(pinBtn);
            actions.appendChild(favBtn);

            // الشارات المشروطة
            const badgesRow = document.createElement('div');
            badgesRow.className = 'note-badges-row';

            if (note.isPinned) {
                const b = document.createElement('span');
                b.className = 'badge badge-pinned';
                b.innerHTML = '<i class="fa-solid fa-thumbtack"></i> مثبتة';
                badgesRow.appendChild(b);
            }
            if (note.isFavorite) {
                const b = document.createElement('span');
                b.className = 'badge badge-favorite';
                b.innerHTML = '<i class="fa-solid fa-star"></i> مفضلة';
                badgesRow.appendChild(b);
            }
            if (note.isReview) {
                const b = document.createElement('span');
                b.className = 'badge badge-review';
                b.innerHTML = '<i class="fa-solid fa-book-open"></i> للمراجعة';
                badgesRow.appendChild(b);
            }
            if (note.subject || note.subjectId) {
                const matchedSub = subjectMatch(note.subjectId, note.subject);
                if (matchedSub && matchedSub.id) {
                    const b = document.createElement('a');
                    b.href = `subject.html?id=${encodeURIComponent(matchedSub.id)}`;
                    b.className = 'badge badge-subject';
                    b.style.textDecoration = 'none';
                    b.textContent = matchedSub.name;
                    b.addEventListener('click', (e) => e.stopPropagation());
                    badgesRow.appendChild(b);
                } else if (note.subject) {
                    const b = document.createElement('span');
                    b.className = 'badge badge-subject';
                    b.textContent = note.subject;
                    badgesRow.appendChild(b);
                }
            }
            if (note.category) {
                const b = document.createElement('span');
                b.className = 'badge badge-category';
                b.textContent = note.category;
                badgesRow.appendChild(b);
            }

            // العنوان
            const title = document.createElement('h4');
            title.textContent = note.title || 'بدون عنوان';

            // مقتطع المحتوى
            const excerpt = document.createElement('p');
            excerpt.className = 'note-excerpt';
            excerpt.textContent = note.content;

            // الوسوم
            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'note-tags-container';
            if (Array.isArray(note.tags) && note.tags.length > 0) {
                note.tags.forEach(t => {
                    const tagBadge = document.createElement('span');
                    tagBadge.className = 'note-tag-pill';
                    tagBadge.textContent = '#' + t;
                    tagBadge.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (filterTag) {
                            filterTag.value = t;
                            renderNotes();
                        }
                    });
                    tagsContainer.appendChild(tagBadge);
                });
            }

            // المهمة المرتبطة - relatedTaskId هو المرجع الحاسم والأصلي
            const taskBox = document.createElement('div');
            taskBox.className = 'note-task-info';
            if (note.relatedTaskId || note.relatedTask) {
                let matchedTask = null;
                if (note.relatedTaskId) {
                    // البحث بشكل حاسم ومباشر بالمعرف
                    matchedTask = currentTodos.find(t => t && t.id === note.relatedTaskId) || null;
                } else if (note.relatedTask) {
                    // توافق مع الملاحظات القديمة التي تحتوي فقط على نص المهمة
                    matchedTask = currentTodos.find(t => t && t.text === note.relatedTask) || null;
                }

                if (matchedTask) {
                    taskBox.className += ' task-exists';
                    const taskNameSpan = document.createElement('span');
                    taskNameSpan.innerHTML = '<i class="fa-solid fa-list-check"></i> مرتبطة بالمهمة: <strong>' + escapeHtml(matchedTask.text) + '</strong>';

                    const openTaskBtn = document.createElement('a');
                    openTaskBtn.className = 'btn-open-task';
                    openTaskBtn.href = 'todo.html?id=' + encodeURIComponent(matchedTask.id);
                    openTaskBtn.textContent = 'فتح المهمة';
                    openTaskBtn.addEventListener('click', (e) => { e.stopPropagation(); });

                    taskBox.appendChild(taskNameSpan);
                    taskBox.appendChild(openTaskBtn);
                } else {
                    taskBox.className += ' task-missing';
                    taskBox.innerHTML = '<i class="fa-solid fa-circle-info"></i> المهمة المرتبطة غير موجودة';
                }
            }

            // التاريخ والأزرار القاعية
            const footer = document.createElement('div');
            footer.className = 'note-card-footer';

            const date = document.createElement('div');
            date.className = 'note-date';
            const ts = note.updated || note.created;
            const dateStr = new Date(ts).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
            date.textContent = note.updated ? ('آخر تعديل: ' + dateStr) : ('أنشئت: ' + dateStr);

            const footerBtns = document.createElement('div');
            footerBtns.className = 'note-footer-actions';

            const viewBtn = document.createElement('button');
            viewBtn.type = 'button';
            viewBtn.className = 'btn btn-secondary btn-xs';
            viewBtn.innerHTML = '<i class="fa-solid fa-eye"></i> عرض';
            viewBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openNoteViewModal(note.id);
            });

            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'btn btn-secondary btn-xs';
            editBtn.innerHTML = '<i class="fa-solid fa-pen"></i> تعديل';
            editBtn.title = 'تعديل الملاحظة';
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                startEditNote(note.id);
            });

            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.className = 'btn btn-outline btn-xs';
            copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> نسخ';
            copyBtn.title = 'نسخ محتوى الملاحظة';
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                copyNoteContent(note);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn btn-outline btn-xs btn-delete-note';
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i> حذف';
            deleteBtn.title = 'حذف الملاحظة';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                promptDeleteNote(note.id);
            });

            footerBtns.appendChild(viewBtn);
            footerBtns.appendChild(editBtn);
            footerBtns.appendChild(copyBtn);
            footerBtns.appendChild(deleteBtn);

            footer.appendChild(footerBtns);

            // تجميع العناصر داخل البطاقة بالترتيب المحدد:
            // 1. عنوان ومحتوى الملاحظة
            // 2. بيانات الملاحظة والحالة (الشارات، الوسوم، المهمة المرتبطة، التاريخ)
            // 3. شريط أزرار التحكم في أسفل البطاقة (عرض، تعديل، نسخ، حذف)
            card.appendChild(actions);
            card.appendChild(title);
            card.appendChild(excerpt);
            if (badgesRow.children.length > 0) card.appendChild(badgesRow);
            if (tagsContainer.children.length > 0) card.appendChild(tagsContainer);
            if (note.relatedTaskId || note.relatedTask) card.appendChild(taskBox);
            card.appendChild(date);
            card.appendChild(footer);

            // فتح الملاحظة بكاملها عند النقر على البطاقة نفسها
            card.addEventListener('click', () => {
                openNoteViewModal(note.id);
            });

            notesList.appendChild(card);
        });
    }

    function escapeHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // --- 7. عمليات الملاحظات (إضافة، تعديل، حذف، تثبيت، تفضيل، نسخ، مشاركة) ---
    async function togglePinNote(id) {
        const saved = await saveNotes(id, note => note ? { ...note, isPinned: !note.isPinned, updated: Date.now() } : null);
        if (!saved || saved === true) return;
        if (typeof hayyizUploadNote === 'function') {
            hayyizUploadNote(saved);
        }
        renderNotes();
        showToast(saved.isPinned ? 'تم تثبيت الملاحظة في الأعلى' : 'تم إلغاء تثبيت الملاحظة');
    }

    async function toggleFavoriteNote(id) {
        const saved = await saveNotes(id, note => note ? { ...note, isFavorite: !note.isFavorite, updated: Date.now() } : null);
        if (!saved || saved === true) return;
        if (typeof hayyizUploadNote === 'function') {
            hayyizUploadNote(saved);
        }
        renderNotes();
        showToast(saved.isFavorite ? 'تمت إضافة الملاحظة للمفضلة' : 'تمت إزالة الملاحظة من المفضلة');
    }

    function copyNoteContent(note) {
        if (!note) return;
        const textToCopy = (note.title ? (note.title + '\n\n') : '') + (note.content || '');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy)
                .then(() => showToast('تم نسخ الملاحظة إلى الحافظة'))
                .catch(() => fallbackCopy(textToCopy));
        } else {
            fallbackCopy(textToCopy);
        }
    }

    function fallbackCopy(text) {
        try {
            const temp = document.createElement('textarea');
            temp.value = text;
            temp.style.position = 'fixed';
            temp.style.opacity = '0';
            document.body.appendChild(temp);
            temp.focus();
            temp.select();
            document.execCommand('copy');
            document.body.removeChild(temp);
            showToast('تم نسخ الملاحظة إلى الحافظة');
        } catch (e) {
            showToast('تعذر النسخ تلقائيًا');
        }
    }

    function startEditNote(id) {
        if (editorDirty && !confirm('توجد مسودة في المحرر. هل تريد استبدالها بهذه الملاحظة؟')) return;
        notes = loadAndNormalizeNotes();
        const note = notes.find(n => n.id === id);
        if (!note) return;

        editingId = id;
        editingBase = JSON.stringify(note);
        editorDirty = false;
        if (saveCopyBtn) saveCopyBtn.hidden = true;
        showTextNotes();
        noteTitle.value = note.title || '';
        noteContent.value = note.content || '';
        noteCategory.value = note.category || '';
        noteTags.value = Array.isArray(note.tags) ? note.tags.join(', ') : '';

        fillSubjects(note.subjectId, note.subject);
        if (customSubjectField) customSubjectField.classList.add('hidden');
        populateTasksDropdown();
        if (note.relatedTaskId && !Array.from(noteTaskSelect.options).some(option => option.value === note.relatedTaskId)) {
            const option = document.createElement('option');
            option.value = note.relatedTaskId;
            option.dataset.taskId = note.relatedTaskId;
            option.dataset.taskText = note.relatedTask || '';
            option.textContent = note.relatedTask || 'المهمة المرتبطة السابقة';
            noteTaskSelect.appendChild(option);
        }

        if (noteTaskSelect) {
            if (note.relatedTaskId) {
                noteTaskSelect.value = note.relatedTaskId;
            } else if (note.relatedTask) {
                noteTaskSelect.value = note.relatedTask;
            } else {
                noteTaskSelect.value = '';
            }
        }

        if (notePinned) notePinned.checked = Boolean(note.isPinned);
        if (noteFavorite) noteFavorite.checked = Boolean(note.isFavorite);
        if (noteReview) noteReview.checked = Boolean(note.isReview);

        // فتح خيارات التنظيم الإضافية تلقائياً عند التعديل إذا كانت الملاحظة تحتوي خيارات مخصصة
        if (notesExtraDetails) {
            notesExtraDetails.open = Boolean(note.subject || note.category || (note.tags && note.tags.length) || note.relatedTaskId || note.relatedTask || note.isPinned || note.isFavorite || note.isReview);
        }

        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> تحديث الملاحظة';
        }
        if (clearNoteBtn) clearNoteBtn.textContent = 'إلغاء التعديل';

        closeViewModalHandler();
        noteContent.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function promptDeleteNote(id) {
        pendingDeleteId = id;
        if (deleteModal) {
            deleteModal.classList.remove('hidden');
            deleteModal.setAttribute('aria-hidden', 'false');
        } else {
            if (confirm('هل تريد حذف هذه الملاحظة؟')) {
                executeDeleteNote(id);
            }
        }
    }

    async function executeDeleteNote(id) {
        const noteToDelete = notes.find(n => n.id === id);
        if (noteToDelete) {
            if (!await saveNotes(id, () => null)) return;
            if (typeof hayyizDeleteRemoteNote === 'function') {
                hayyizDeleteRemoteNote(id, noteToDelete);
            }
            if (editingId === id) resetForm();
            if (currentViewingNoteId === id) closeViewModalHandler();
            renderNotes();
            showToast('تم حذف الملاحظة بنجاح');
        }
        pendingDeleteId = null;
        if (deleteModal) {
            deleteModal.classList.add('hidden');
            deleteModal.setAttribute('aria-hidden', 'true');
        }
    }

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', () => {
            if (pendingDeleteId) executeDeleteNote(pendingDeleteId);
        });
    }

    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => {
            pendingDeleteId = null;
            if (deleteModal) {
                deleteModal.classList.add('hidden');
                deleteModal.setAttribute('aria-hidden', 'true');
            }
        });
    }

    // --- 8. مودال العرض الكامل للملاحظة ---
    function openNoteViewModal(id) {
        const note = notes.find(n => n.id === id);
        if (!note) return;

        currentViewingNoteId = id;
        if (viewTitle) viewTitle.textContent = note.title || 'بدون عنوان';
        if (viewContent) viewContent.textContent = note.content;

        // الشارات
        if (viewBadges) {
            viewBadges.innerHTML = '';
            if (note.isPinned) {
                const b = document.createElement('span');
                b.className = 'badge badge-pinned';
                b.innerHTML = '<i class="fa-solid fa-thumbtack"></i> مثبتة';
                viewBadges.appendChild(b);
            }
            if (note.isFavorite) {
                const b = document.createElement('span');
                b.className = 'badge badge-favorite';
                b.innerHTML = '<i class="fa-solid fa-star"></i> مفضلة';
                viewBadges.appendChild(b);
            }
            if (note.isReview) {
                const b = document.createElement('span');
                b.className = 'badge badge-review';
                b.innerHTML = '<i class="fa-solid fa-book-open"></i> للمراجعة';
                viewBadges.appendChild(b);
            }
            if (note.subject || note.subjectId) {
                const matchedSub = subjectMatch(note.subjectId, note.subject);
                if (matchedSub && matchedSub.id) {
                    const b = document.createElement('a');
                    b.href = `subject.html?id=${encodeURIComponent(matchedSub.id)}`;
                    b.className = 'badge badge-subject';
                    b.style.textDecoration = 'none';
                    b.textContent = matchedSub.name;
                    b.addEventListener('click', (e) => e.stopPropagation());
                    viewBadges.appendChild(b);
                } else if (note.subject) {
                    const b = document.createElement('span');
                    b.className = 'badge badge-subject';
                    b.textContent = note.subject;
                    viewBadges.appendChild(b);
                }
            }
            if (note.category) {
                const b = document.createElement('span');
                b.className = 'badge badge-category';
                b.textContent = note.category;
                viewBadges.appendChild(b);
            }
        }

        // تفاصيل التواريخ
        if (viewMeta) {
            const createdStr = new Date(note.created).toLocaleString('ar-EG');
            let metaHtml = '<span><i class="fa-solid fa-calendar"></i> أنشئت: ' + createdStr + '</span>';
            if (note.updated) {
                const updatedStr = new Date(note.updated).toLocaleString('ar-EG');
                metaHtml += ' · <span><i class="fa-solid fa-clock-rotate-left"></i> آخر تعديل: ' + updatedStr + '</span>';
            }
            viewMeta.innerHTML = metaHtml;
        }

        // الوسوم
        if (viewTags) {
            viewTags.innerHTML = '';
            if (Array.isArray(note.tags) && note.tags.length > 0) {
                note.tags.forEach(t => {
                    const tagPill = document.createElement('span');
                    tagPill.className = 'note-tag-pill';
                    tagPill.textContent = '#' + t;
                    viewTags.appendChild(tagPill);
                });
            }
        }

        // المهمة المرتبطة
        if (viewTask) {
            viewTask.innerHTML = '';
            if (note.relatedTaskId || note.relatedTask) {
                let currentTodos = [];
                if (typeof hayyizGetTodos === 'function') currentTodos = hayyizGetTodos();
                else { try { currentTodos = JSON.parse(hayyizStorage.getItem('hayyiz-todos') || '[]'); } catch(e){} }

                let matchedTask = null;
                if (note.relatedTaskId) matchedTask = currentTodos.find(t => t && t.id === note.relatedTaskId) || null;
                else if (note.relatedTask) matchedTask = currentTodos.find(t => t && t.text === note.relatedTask) || null;

                if (matchedTask) {
                    viewTask.innerHTML = '<div class="note-task-info task-exists"><i class="fa-solid fa-list-check"></i> مرتبطة بالمهمة: <strong>' + escapeHtml(matchedTask.text) + '</strong> <a href="todo.html?id=' + encodeURIComponent(matchedTask.id) + '" class="btn-open-task">فتح المهمة</a></div>';
                } else {
                    viewTask.innerHTML = '<div class="note-task-info task-missing"><i class="fa-solid fa-circle-info"></i> المهمة المرتبطة غير موجودة</div>';
                }
            }
        }

        // دعم مشاركة المتصفح (Web Share API) إن توفرت مع معالجة الأخطاء غير الملغاة
        if (viewShareBtn) {
            if (navigator.share) {
                viewShareBtn.classList.remove('hidden');
            } else {
                viewShareBtn.classList.add('hidden');
            }
        }

        if (viewModal) {
            viewModal.classList.remove('hidden');
            viewModal.setAttribute('aria-hidden', 'false');
        }
    }

    function closeViewModalHandler() {
        if (viewModal) {
            viewModal.classList.add('hidden');
            viewModal.setAttribute('aria-hidden', 'true');
        }
        currentViewingNoteId = null;
    }

    if (closeViewModal) closeViewModal.addEventListener('click', closeViewModalHandler);

    if (viewCopyBtn) {
        viewCopyBtn.addEventListener('click', () => {
            const note = notes.find(n => n.id === currentViewingNoteId);
            if (note) copyNoteContent(note);
        });
    }

    if (viewShareBtn) {
        viewShareBtn.addEventListener('click', () => {
            const note = notes.find(n => n.id === currentViewingNoteId);
            if (note && navigator.share) {
                navigator.share({
                    title: note.title || 'ملاحظة من حيز',
                    text: (note.title ? (note.title + '\n\n') : '') + (note.content || '')
                }).catch((err) => {
                    if (err && (err.name === 'AbortError' || (err.message && err.message.toLowerCase().includes('canceled')))) {
                        return; // إلغاء المستخدم الطبيعي
                    }
                    showToast('تعذر مشاركة الملاحظة');
                });
            }
        });
    }

    if (viewEditBtn) {
        viewEditBtn.addEventListener('click', () => {
            if (currentViewingNoteId) startEditNote(currentViewingNoteId);
        });
    }

    if (viewDeleteBtn) {
        viewDeleteBtn.addEventListener('click', () => {
            if (currentViewingNoteId) promptDeleteNote(currentViewingNoteId);
        });
    }

    // --- 9. تقديم النموذج (حفظ/تعديل) ---
    notesForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (savingNote) return;
        const title = (noteTitle ? noteTitle.value : '').trim();
        const content = (noteContent ? noteContent.value : '').trim();
        if (!content) return;

        const selected = selectedSubject();
        let subject = selected.subject;
        let subjectId = selected.subjectId;
        if (subject && !subjectId && typeof hayyizAddSubject === 'function') {
            try {
                const canonical = subjectMatch(null, subject) || hayyizAddSubject(subject);
                if (canonical) { subjectId = canonical.id; subject = canonical.name; }
            } catch (_) { showSaveError('تعذر حفظ المادة على هذا الجهاز. بقي نص الملاحظة في المحرر.'); return; }
        }

        const category = (noteCategory ? noteCategory.value : '').trim();
        const tagsRaw = (noteTags ? noteTags.value : '').trim();
        const tags = tagsRaw ? tagsRaw.split(/[,،\s]+/).map(t => t.trim().replace(/^#/, '')).filter(Boolean) : [];

        let relatedTaskId = null;
        let relatedTask = null;

        if (noteTaskSelect && noteTaskSelect.value) {
            const selOpt = noteTaskSelect.options[noteTaskSelect.selectedIndex];
            if (selOpt) {
                relatedTaskId = selOpt.dataset.taskId || null;
                relatedTask = selOpt.dataset.taskText || selOpt.value || null;
            }
        }

        const isPinned = notePinned ? notePinned.checked : false;
        const isFavorite = noteFavorite ? noteFavorite.checked : false;
        const isReview = noteReview ? noteReview.checked : false;

        const wasEditing = editingId !== null;
        const id = editingId || generateUniqueId();
        const submittedRevision = editorRevision;
        savingNote = true;
        if (submitBtn) submitBtn.disabled = true;
        if (clearNoteBtn) clearNoteBtn.disabled = true;
        try {
            const saved = await saveNotes(id, current => ({
                ...(current || {}), id, title, content, subject, subjectId,
                category, tags, relatedTaskId, relatedTask, isPinned, isFavorite, isReview,
                created: current ? current.created : Date.now(), updated: Date.now()
            }), wasEditing ? editingBase : undefined);
            if (!saved) return;
            if (typeof hayyizUploadNote === 'function') hayyizUploadNote(saved);
            if (editorRevision === submittedRevision) resetForm();
            else {
                editingId = saved.id;
                editingBase = JSON.stringify(saved);
                saveDraft();
                if (submitBtn) submitBtn.textContent = 'تحديث الملاحظة';
            }
            renderNotes();
            const message = wasEditing ? 'تم تحديث الملاحظة على هذا الجهاز' : 'تم حفظ الملاحظة على هذا الجهاز';
            if (saveStatus) saveStatus.textContent = message;
            showToast(message);
        } finally {
            savingNote = false;
            if (submitBtn) submitBtn.disabled = false;
            if (clearNoteBtn) clearNoteBtn.disabled = false;
        }
    });

    if (clearNoteBtn) {
        clearNoteBtn.addEventListener('click', () => {
            if (editorDirty && !confirm('هل تريد مسح التعديلات الموجودة في المحرر؟')) return;
            resetForm();
        });
    }
    if (saveCopyBtn) saveCopyBtn.addEventListener('click', () => {
        editingId = null; editingBase = null; saveDraft();
        notesForm.requestSubmit();
    });
    window.addEventListener('beforeunload', event => {
        if (editorDirty && !draftSaved) { event.preventDefault(); event.returnValue = ''; }
    });
    window.addEventListener('storage', event => {
        const key = hayyizStorage.logicalKey ? hayyizStorage.logicalKey(event.key) : event.key;
        if (key === null || key === 'hayyiz-notes') {
            notes = loadAndNormalizeNotes(); renderNotes();
        }
        if (key === null || ['hayyiz-subjects', 'hayyiz-todos'].includes(key)) populateTasksDropdown();
    });

    // --- 10. أدوات البحث والتصفية للواجهة ---
    if (notesSearch) {
        notesSearch.addEventListener('input', renderNotes);
    }

    if (filterSubject) {
        filterSubject.addEventListener('change', renderNotes);
    }

    if (filterTag) {
        filterTag.addEventListener('change', renderNotes);
    }

    if (notesSort) {
        notesSort.addEventListener('change', renderNotes);
    }

    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentPillFilter = pill.dataset.filter || 'all';
            renderNotes();
        });
    });

    // إغلاق المودالات بالنقر الخارجي أو مفتاح Escape
    window.addEventListener('click', (e) => {
        if (e.target === viewModal) closeViewModalHandler();
        if (e.target === deleteModal && deleteModal) {
            deleteModal.classList.add('hidden');
            deleteModal.setAttribute('aria-hidden', 'true');
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeViewModalHandler();
            if (deleteModal) {
                deleteModal.classList.add('hidden');
                deleteModal.setAttribute('aria-hidden', 'true');
            }
        }
    });

    // التهيئة البدائية
    populateTasksDropdown();
    fillSubjects(null, '');
    loadDraft().catch(() => showSaveError('تعذر استرجاع المسودة؛ النسخة الأصلية محفوظة على الجهاز.'));
    // معالجة معلمات البومودورو/المهام القادمة عبر URL
    if (prefillTitle && noteTitle) {
        noteTitle.value = prefillTitle;
    }
    if (urlTaskName && noteTaskSelect) {
        let matchedOpt = null;
        if (urlTaskId) {
            matchedOpt = Array.from(noteTaskSelect.options).find(o => o.dataset.taskId === urlTaskId);
        }
        if (!matchedOpt && urlTaskName) {
            matchedOpt = Array.from(noteTaskSelect.options).find(o => o.dataset.taskText === urlTaskName || o.value === urlTaskName);
        }

        if (matchedOpt) {
            noteTaskSelect.value = matchedOpt.value;
        } else if (urlTaskName) {
            // إضافة الخيار للمنسدلة
            const opt = document.createElement('option');
            opt.value = urlTaskId || urlTaskName;
            opt.textContent = urlTaskName;
            if (urlTaskId) opt.dataset.taskId = urlTaskId;
            opt.dataset.taskText = urlTaskName;
            opt.selected = true;
            noteTaskSelect.appendChild(opt);
        }
        if (notesExtraDetails) notesExtraDetails.open = true;
    }

    if (prefillTitle || urlTaskName || urlNoteId) showTextNotes();
    renderNotes();
    if (urlNoteId) {
        if (notes.some(note => note.id === urlNoteId)) openNoteViewModal(urlNoteId);
        else showSaveError('لم تعد هذه الملاحظة موجودة على هذا الجهاز أو في الحساب الحالي.');
    }

    // تهيئة المزامنة السحابية للملاحظات
    if (typeof hayyizRegisterNotesSyncCallback === 'function') {
        hayyizRegisterNotesSyncCallback((mergedNotes) => {
            notes = loadAndNormalizeNotes();
            renderNotes();
            if (urlNoteId && notes.some(note => note.id === urlNoteId) && !currentViewingNoteId) openNoteViewModal(urlNoteId);
        });
    }

    const syncStatusBadge = document.getElementById('sync-status-badge');
    const syncStatusText = document.getElementById('sync-status-text');

    function checkSyncStatus() {
        if (!syncStatusBadge || !syncStatusText) return;
        const status = typeof hayyizGetSyncStatus === 'function' ? hayyizGetSyncStatus('notes') : { state: 'local' };
        const messages = { local: 'محفوظة على هذا الجهاز', syncing: 'جارٍ التحقق من المزامنة…',
            synced: 'اكتملت آخر مزامنة سحابية', error: 'تعذرت المزامنة؛ البيانات المحلية محفوظة' };
        syncStatusBadge.classList.remove('hidden');
        syncStatusText.textContent = messages[status.state] || messages.local;
        const retry = document.getElementById('notes-sync-retry');
        if (retry) retry.hidden = status.state !== 'error';
    }
    window.addEventListener('hayyiz:sync-status', event => { if (event.detail && event.detail.tool === 'notes') checkSyncStatus(); });
    const retrySync = document.getElementById('notes-sync-retry');
    if (retrySync) retrySync.addEventListener('click', () => { if (typeof hayyizSyncNotes === 'function') hayyizSyncNotes(); });
    checkSyncStatus();

    if (typeof hayyizSyncNotes === 'function') {
        hayyizSyncNotes();
    }
    if (typeof initAuthListener === 'function') {
        initAuthListener();
    }
});
