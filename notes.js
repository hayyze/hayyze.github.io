document.addEventListener('DOMContentLoaded', () => {
    let notes = JSON.parse(localStorage.getItem('hayyiz-notes') || '[]');
    let editingIndex = null;

    const notesForm = document.getElementById('notes-form');
    const noteTitle = document.getElementById('note-title');
    const noteContent = document.getElementById('note-content');
    const notesList = document.getElementById('notes-list');
    const notesEmpty = document.getElementById('notes-empty');
    const notesSearch = document.getElementById('notes-search');
    const clearNoteBtn = document.getElementById('clear-note-btn');
    const submitBtn = notesForm ? notesForm.querySelector('button[type="submit"]') : null;

    // دعم القدوم من بومودورو بعنوان جاهز
    const urlParams = new URLSearchParams(window.location.search);
    const prefillTitle = urlParams.get('title');
    if (prefillTitle && noteTitle) {
        noteTitle.value = decodeURIComponent(prefillTitle);
        if (noteContent) noteContent.focus();
    }

    function saveNotes() {
        localStorage.setItem('hayyiz-notes', JSON.stringify(notes));
    }

    function resetForm() {
        editingIndex = null;
        if (noteTitle) noteTitle.value = '';
        if (noteContent) noteContent.value = '';
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fa-solid fa-plus"></i> حفظ';
        }
        if (clearNoteBtn) clearNoteBtn.textContent = 'مسح';
    }

    function renderNotes(filter = '') {
        const filtered = notes.filter(
            n => (n.title || '').includes(filter) || (n.content || '').includes(filter)
        );

        notesList.innerHTML = '';

        if (filtered.length === 0) {
            notesEmpty.classList.remove('hidden');
            return;
        }

        notesEmpty.classList.add('hidden');

        filtered.forEach(note => {
            const realIndex = notes.indexOf(note);

            const div = document.createElement('div');
            div.className = 'note-card';

            const actions = document.createElement('div');
            actions.className = 'note-card-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'note-edit';
            editBtn.dataset.index = realIndex;
            editBtn.type = 'button';
            editBtn.setAttribute('aria-label', 'تعديل الملاحظة');
            editBtn.innerHTML = '<i class="fa-solid fa-pen" aria-hidden="true"></i>';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'note-delete';
            deleteBtn.dataset.index = realIndex;
            deleteBtn.type = 'button';
            deleteBtn.setAttribute('aria-label', 'حذف الملاحظة');
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>';

            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);

            const title = document.createElement('h4');
            title.textContent = note.title || 'بدون عنوان';

            const content = document.createElement('p');
            content.textContent = note.content;

            const date = document.createElement('div');
            date.className = 'note-date';
            const ts = note.updated || note.created;
            date.textContent = new Date(ts).toLocaleString('ar-EG');
            if (note.updated) {
                date.textContent += ' · معدّلة';
            }

            div.appendChild(actions);
            div.appendChild(title);
            div.appendChild(content);
            div.appendChild(date);

            notesList.appendChild(div);
        });
    }

    notesForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = (noteTitle.value || '').trim();
        const content = (noteContent.value || '').trim();
        if (!content) return;

        if (editingIndex !== null && editingIndex >= 0 && editingIndex < notes.length) {
            notes[editingIndex].title = title;
            notes[editingIndex].content = content;
            notes[editingIndex].updated = Date.now();
        } else {
            notes.unshift({
                title,
                content,
                created: Date.now()
            });
        }

        saveNotes();
        resetForm();
        renderNotes(notesSearch ? notesSearch.value.trim() : '');
    });

    if (clearNoteBtn) {
        clearNoteBtn.addEventListener('click', () => {
            resetForm();
        });
    }

    if (notesSearch) {
        notesSearch.addEventListener('input', () => {
            renderNotes(notesSearch.value.trim());
        });
    }

    notesList.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.note-edit');
        if (editBtn) {
            const index = Number(editBtn.dataset.index);
            if (!Number.isInteger(index) || index < 0 || index >= notes.length) return;
            editingIndex = index;
            noteTitle.value = notes[index].title || '';
            noteContent.value = notes[index].content || '';
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> تحديث';
            }
            if (clearNoteBtn) clearNoteBtn.textContent = 'إلغاء';
            noteContent.focus();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        const deleteBtn = e.target.closest('.note-delete');
        if (deleteBtn) {
            const index = Number(deleteBtn.dataset.index);
            if (!Number.isInteger(index) || index < 0 || index >= notes.length) return;
            if (editingIndex === index) resetForm();
            notes.splice(index, 1);
            saveNotes();
            renderNotes(notesSearch ? notesSearch.value.trim() : '');
        }
    });

    renderNotes();
});