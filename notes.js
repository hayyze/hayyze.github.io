document.addEventListener('DOMContentLoaded', () => {
    let notes = JSON.parse(localStorage.getItem('hayyiz-notes') || '[]');

    const notesForm = document.getElementById('notes-form');
    const noteTitle = document.getElementById('note-title');
    const noteContent = document.getElementById('note-content');
    const notesList = document.getElementById('notes-list');
    const notesEmpty = document.getElementById('notes-empty');
    const notesSearch = document.getElementById('notes-search');
    const clearNoteBtn = document.getElementById('clear-note-btn');

    function saveNotes() {
        localStorage.setItem('hayyiz-notes', JSON.stringify(notes));
    }

    function renderNotes(filter = '') {
        const filtered = notes.filter(
            n => n.title.includes(filter) || n.content.includes(filter)
        );

        // مسح القائمة الحالية
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

            // زر الحذف
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'note-delete';
            deleteBtn.dataset.index = realIndex;
            deleteBtn.setAttribute('aria-label', 'حذف الملاحظة');
            deleteBtn.type = 'button';

            const deleteIcon = document.createElement('i');
            deleteIcon.className = 'fa-solid fa-trash';
            deleteIcon.setAttribute('aria-hidden', 'true');

            deleteBtn.appendChild(deleteIcon);

            // عنوان الملاحظة
            const title = document.createElement('h4');
            title.textContent = note.title || 'بدون عنوان';

            // محتوى الملاحظة
            const content = document.createElement('p');
            content.textContent = note.content;

            // تاريخ الملاحظة
            const date = document.createElement('div');
            date.className = 'note-date';
            date.textContent = new Date(note.created).toLocaleString('ar-EG');

            // تجميع العناصر
            div.appendChild(deleteBtn);
            div.appendChild(title);
            div.appendChild(content);
            div.appendChild(date);

            notesList.appendChild(div);
        });
    }

    notesForm.addEventListener('submit', e => {
        e.preventDefault();

        const content = noteContent.value.trim();

        if (!content) return;

        notes.unshift({
            title: noteTitle.value.trim(),
            content,
            created: Date.now()
        });

        saveNotes();

        noteTitle.value = '';
        noteContent.value = '';

        renderNotes();
    });

    clearNoteBtn.addEventListener('click', () => {
        noteTitle.value = '';
        noteContent.value = '';
    });

    notesList.addEventListener('click', e => {
        const deleteButton = e.target.closest('.note-delete');

        if (!deleteButton) return;

        const i = Number(deleteButton.dataset.index);

        if (!Number.isInteger(i) || i < 0 || i >= notes.length) {
            return;
        }

        notes.splice(i, 1);

        saveNotes();

        renderNotes(notesSearch.value.trim());
    });

    notesSearch.addEventListener('input', () => {
        renderNotes(notesSearch.value.trim());
    });

    renderNotes();
});
