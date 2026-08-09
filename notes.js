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
        const filtered = notes.filter(n => n.title.includes(filter) || n.content.includes(filter));
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
            div.innerHTML = `
                <button class="note-delete" data-index="${realIndex}"><i class="fa-solid fa-trash"></i></button>
                <h4>${note.title || 'بدون عنوان'}</h4>
                <p>${note.content}</p>
                <div class="note-date">${new Date(note.created).toLocaleString('ar-EG')}</div>
            `;
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
        if (e.target.closest('.note-delete')) {
            const i = e.target.closest('.note-delete').dataset.index;
            notes.splice(i, 1);
            saveNotes();
            renderNotes(notesSearch.value);
        }
    });

    notesSearch.addEventListener('input', () => {
        renderNotes(notesSearch.value.trim());
    });

    renderNotes();
});