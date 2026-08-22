document.addEventListener('DOMContentLoaded', () => {

    // ========== DOM Elements ==========
    const actionHeroEl = document.getElementById('task-action-hero');
    const todoForm = document.getElementById('todo-form');
    const todoInput = document.getElementById('todo-input');
    const todoPriority = document.getElementById('todo-priority');
    const todoDate = document.getElementById('todo-date');
    const todoMinutes = document.getElementById('todo-minutes');
    const todoSubject = document.getElementById('todo-subject');
    const todoEvent = document.getElementById('todo-event');
    const toggleOptionsBtn = document.getElementById('toggle-task-options-btn');
    const optionsCollapsible = document.getElementById('task-options-collapsible');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const srAnnouncer = document.getElementById('sr-task-announcer');

    // Task Lists & Sections
    const sectionToday = document.getElementById('section-today');
    const sectionUpcoming = document.getElementById('section-upcoming');
    const sectionCompleted = document.getElementById('section-completed');
    const listToday = document.getElementById('list-today');
    const listUpcoming = document.getElementById('list-upcoming');
    const listCompleted = document.getElementById('list-completed');
    const countToday = document.getElementById('count-today');
    const countUpcoming = document.getElementById('count-upcoming');
    const countCompleted = document.getElementById('count-completed');
    const todoEmpty = document.getElementById('todo-empty');

    let currentFilter = 'all';

    // Announcements
    function announceSR(msg) {
        if (srAnnouncer) srAnnouncer.textContent = msg;
    }

    // Toggle options
    if (toggleOptionsBtn && optionsCollapsible) {
        toggleOptionsBtn.addEventListener('click', () => {
            const isHidden = optionsCollapsible.style.display === 'none';
            optionsCollapsible.style.display = isHidden ? 'grid' : 'none';
            toggleOptionsBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
        });
    }

    // Populate selects
    function refreshSelects() {
        if (typeof hayyizFillSubjectSelect === 'function' && todoSubject) {
            hayyizFillSubjectSelect(todoSubject, '');
        }

        if (todoEvent && typeof hayyizGetSavedCalendarEvents === 'function') {
            todoEvent.innerHTML = '<option value="">بدون حدث تقويم</option>';
            const events = hayyizGetSavedCalendarEvents();
            events.forEach(ev => {
                const opt = document.createElement('option');
                opt.value = ev.id;
                opt.textContent = `${ev.type === 'exam' ? '📝 اختبار' : '📅 موعد'}: ${ev.name}`;
                todoEvent.appendChild(opt);
            });
        }
    }

    refreshSelects();

    // Helper: Contextual Due Date Label (e.g. "متأخرة بـ يومين", "اليوم", "غداً")
    function getContextualDueDateLabel(dateStr) {
        if (!dateStr) return null;
        const todayStr = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
        const day = String(dateStr).slice(0, 10);

        const t0 = new Date(`${todayStr}T00:00:00`).getTime();
        const t1 = new Date(`${day}T00:00:00`).getTime();
        const diffDays = Math.round((t1 - t0) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            const abs = Math.abs(diffDays);
            return { text: `متأخرة ${abs === 1 ? 'يومًا واحدًا' : `بـ ${abs} أيام`}`, class: 'badge-overdue' };
        } else if (diffDays === 0) {
            return { text: 'مستحقة اليوم', class: 'badge-today' };
        } else if (diffDays === 1) {
            return { text: 'مستحقة غداً', class: 'badge-upcoming' };
        } else if (diffDays < 7) {
            return { text: `بعد ${diffDays} أيام`, class: 'badge-upcoming' };
        } else {
            return { text: day, class: 'badge-upcoming' };
        }
    }

    // ========== Action Hero Card: ماذا أفعل الآن؟ ==========
    function renderActionHero() {
        if (!actionHeroEl) return;

        const activeFocusState = typeof hayyizGetFocusState === 'function' ? hayyizGetFocusState() : null;
        const rec = typeof hayyizRecommendNext === 'function' ? hayyizRecommendNext(1) : null;
        const topTask = rec ? rec.next : null;

        actionHeroEl.innerHTML = '';

        if (activeFocusState && activeFocusState.status === 'running' && activeFocusState.remainingSeconds > 0) {
            // Running session active
            const remMin = Math.floor(activeFocusState.remainingSeconds / 60);
            const remSec = activeFocusState.remainingSeconds % 60;
            const formatted = `${String(remMin).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
            const title = activeFocusState.context ? activeFocusState.context.title : 'جلسة تركيز';

            actionHeroEl.className = 'card task-action-hero hero-focus-running';
            actionHeroEl.innerHTML = `
                <div class="hero-content-wrap">
                    <div class="hero-badge"><i class="fa-solid fa-play"></i> جلسة تركيز نشطة حالياً (${formatted})</div>
                    <h2 class="hero-task-title">${escapeHtml(title)}</h2>
                    <p class="hero-task-sub">أكمل جلسة التركيز الحالية للحصول على أفضل إنجاز للوقت.</p>
                </div>
                <div class="hero-action-box">
                    <a href="pomodoro.html" class="btn btn-primary btn-lg"><i class="fa-solid fa-play"></i> متابعة الجلسة</a>
                </div>
            `;
            return;
        }

        if (topTask) {
            const dateBadge = getContextualDueDateLabel(topTask.date);
            const priMap = { high: 'عالية 🔥', medium: 'متوسطة', low: 'منخفضة' };

            actionHeroEl.className = 'card task-action-hero';
            actionHeroEl.innerHTML = `
                <div class="hero-content-wrap">
                    <div class="hero-badge"><i class="fa-solid fa-bullseye"></i> ماذا أفعل الآن؟ (المهمة الموصى بها)</div>
                    <h2 class="hero-task-title">${escapeHtml(topTask.text)}</h2>
                    <div class="hero-meta-row">
                        <span class="hero-meta-item"><i class="fa-solid fa-layer-group"></i> أولوية ${priMap[topTask.priority] || topTask.priority}</span>
                        ${dateBadge ? `<span class="hero-meta-item ${dateBadge.class}">${dateBadge.text}</span>` : ''}
                        ${topTask.minutes ? `<span class="hero-meta-item"><i class="fa-solid fa-hourglass-half"></i> ${topTask.focusDone || 0}/${topTask.minutes} دقيقة</span>` : ''}
                    </div>
                </div>
                <div class="hero-action-box">
                    <button type="button" class="btn btn-primary btn-lg hero-start-focus-btn" data-id="${topTask.id}">
                        <i class="fa-solid fa-play"></i> ابدأ التركيز الآن
                    </button>
                </div>
            `;

            const btn = actionHeroEl.querySelector('.hero-start-focus-btn');
            if (btn) {
                btn.addEventListener('click', () => {
                    if (typeof hayyizLaunchPomodoro === 'function') {
                        hayyizLaunchPomodoro(topTask);
                    } else {
                        window.location.href = 'pomodoro.html?task=' + encodeURIComponent(topTask.text);
                    }
                });
            }
        } else {
            actionHeroEl.className = 'card task-action-hero hero-empty-state';
            actionHeroEl.innerHTML = `
                <div class="hero-content-wrap">
                    <div class="hero-badge"><i class="fa-solid fa-circle-check"></i> لا توجد مهام نشطة حالياً</div>
                    <h2 class="hero-task-title">جميع مهامك مكتملة أو لم تُضف مهام بعد 🎉</h2>
                    <p class="hero-task-sub">أضف مهمتك التالية أو ابدأ جلسة تركيز حرة مباشرة.</p>
                </div>
                <div class="hero-action-box">
                    <button type="button" class="btn btn-primary" id="hero-free-focus-btn"><i class="fa-solid fa-play"></i> جلسة تركيز حرة</button>
                </div>
            `;

            const freeBtn = document.getElementById('hero-free-focus-btn');
            if (freeBtn) {
                freeBtn.addEventListener('click', () => {
                    if (typeof hayyizLaunchPomodoro === 'function') {
                        hayyizLaunchPomodoro(null);
                    } else {
                        window.location.href = 'pomodoro.html';
                    }
                });
            }
        }
    }

    // ========== Render Tasks List ==========
    function renderTasks() {
        renderActionHero();

        const todos = typeof hayyizGetTodos === 'function' ? hayyizGetTodos() : [];
        const todayStr = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);

        // Filter active vs completed
        let filtered = todos;
        if (currentFilter === 'today') {
            filtered = todos.filter(t => !t.completed && (t.date && String(t.date).slice(0, 10) <= todayStr));
        } else if (currentFilter === 'upcoming') {
            filtered = todos.filter(t => !t.completed && (!t.date || String(t.date).slice(0, 10) > todayStr));
        } else if (currentFilter === 'high') {
            filtered = todos.filter(t => !t.completed && t.priority === 'high');
        } else if (currentFilter === 'completed') {
            filtered = todos.filter(t => t.completed);
        }

        const activeList = filtered.filter(t => !t.completed);
        const completedList = filtered.filter(t => t.completed);

        // Split active list into Today/Overdue vs Upcoming
        const todayOverdueList = activeList.filter(t => t.date && String(t.date).slice(0, 10) <= todayStr);
        const upcomingList = activeList.filter(t => !t.date || String(t.date).slice(0, 10) > todayStr);

        if (listToday) listToday.innerHTML = '';
        if (listUpcoming) listUpcoming.innerHTML = '';
        if (listCompleted) listCompleted.innerHTML = '';

        if (todos.length === 0) {
            if (todoEmpty) todoEmpty.classList.remove('hidden');
            if (sectionToday) sectionToday.style.display = 'none';
            if (sectionUpcoming) sectionUpcoming.style.display = 'none';
            if (sectionCompleted) sectionCompleted.style.display = 'none';
            return;
        }

        if (todoEmpty) todoEmpty.classList.add('hidden');

        // Render Today & Overdue
        if (todayOverdueList.length > 0) {
            if (sectionToday) sectionToday.style.display = 'block';
            if (countToday) countToday.textContent = todayOverdueList.length;
            todayOverdueList.forEach(t => listToday.appendChild(createTaskItemDOM(t)));
        } else {
            if (sectionToday) sectionToday.style.display = 'none';
        }

        // Render Upcoming
        if (upcomingList.length > 0) {
            if (sectionUpcoming) sectionUpcoming.style.display = 'block';
            if (countUpcoming) countUpcoming.textContent = upcomingList.length;
            upcomingList.forEach(t => listUpcoming.appendChild(createTaskItemDOM(t)));
        } else {
            if (sectionUpcoming) sectionUpcoming.style.display = 'none';
        }

        // Render Completed Archive
        if (completedList.length > 0 && (currentFilter === 'all' || currentFilter === 'completed')) {
            if (sectionCompleted) sectionCompleted.style.display = 'block';
            if (countCompleted) countCompleted.textContent = completedList.length;
            completedList.forEach(t => listCompleted.appendChild(createTaskItemDOM(t)));
        } else {
            if (sectionCompleted) sectionCompleted.style.display = 'none';
        }
    }

    function createTaskItemDOM(todo) {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        li.dataset.id = todo.id;

        const dateBadge = getContextualDueDateLabel(todo.date);
        const priMap = { high: 'عالية 🔥', medium: 'متوسطة', low: 'منخفضة' };

        // Active Focus session detection for this task
        const activeFocusState = typeof hayyizGetFocusState === 'function' ? hayyizGetFocusState() : null;
        const isTaskCurrentlyFocused = activeFocusState && activeFocusState.status === 'running' && activeFocusState.context && activeFocusState.context.id === todo.id;

        let subjectName = '';
        if (todo.subjectId && typeof hayyizGetSubjectName === 'function') {
            subjectName = hayyizGetSubjectName(todo.subjectId);
        }

        li.innerHTML = `
            <input type="checkbox" class="todo-check" ${todo.completed ? 'checked' : ''} aria-label="تحديد المهمة كمكتملة">
            <div class="todo-content">
                <div class="todo-text">${escapeHtml(todo.text)}</div>
                <div class="todo-meta">
                    <span class="priority-${todo.priority}">${priMap[todo.priority] || todo.priority}</span>
                    ${dateBadge ? `<span class="badge ${dateBadge.class}">${dateBadge.text}</span>` : ''}
                    ${subjectName ? `<span><i class="fa-solid fa-book"></i> ${escapeHtml(subjectName)}</span>` : ''}
                    ${todo.focusDone ? `<span><i class="fa-solid fa-clock"></i> ${todo.focusDone} د تركيز (${todo.sessionsDone || 0} جلسة)</span>` : ''}
                </div>
            </div>

            <div class="todo-actions">
                ${!todo.completed ? `
                    <button type="button" class="btn btn-sm ${isTaskCurrentlyFocused ? 'btn-secondary' : 'btn-primary'} btn-start-focus" title="بدء جلسة تركيز عل هذه المهمة">
                        <i class="fa-solid fa-play"></i> ${isTaskCurrentlyFocused ? 'متابعة الجلسة' : 'ابدأ التركيز'}
                    </button>
                    <button type="button" class="action-btn-mini btn-edit-task" title="تعديل المهمة">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                ` : ''}
                <button type="button" class="action-btn-mini btn-delete-task" title="حذف المهمة">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;

        // Checkbox Listener
        const check = li.querySelector('.todo-check');
        if (check) {
            check.addEventListener('change', () => {
                if (typeof hayyizUpdateTask === 'function') {
                    const todayStr = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
                    hayyizUpdateTask(todo.id, {
                        completed: check.checked,
                        completedAt: check.checked ? todayStr : null
                    });
                }
                announceSR(check.checked ? 'تمت إضافة المهمة إلى الأرشيف المكتمل' : 'تم استرجاع المهمة إلى النشطة');
                renderTasks();
            });
        }

        // Start Focus Listener
        const focusBtn = li.querySelector('.btn-start-focus');
        if (focusBtn) {
            focusBtn.addEventListener('click', () => {
                if (typeof hayyizLaunchPomodoro === 'function') {
                    hayyizLaunchPomodoro(todo);
                } else {
                    window.location.href = 'pomodoro.html?task=' + encodeURIComponent(todo.text);
                }
            });
        }

        // Edit Task Listener
        const editBtn = li.querySelector('.btn-edit-task');
        if (editBtn) {
            editBtn.addEventListener('click', () => showEditModal(todo));
        }

        // Delete Task Listener
        const deleteBtn = li.querySelector('.btn-delete-task');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm(`هل أنت متأكد من حذف المهمة "${todo.text}"؟`)) {
                    if (typeof hayyizDeleteTask === 'function') {
                        hayyizDeleteTask(todo.id);
                    }
                    announceSR('تم حذف المهمة');
                    renderTasks();
                }
            });
        }

        return li;
    }

    // Quick Edit Task Modal
    function showEditModal(todo) {
        document.querySelector('.task-modal-overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.className = 'task-modal-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        const modal = document.createElement('div');
        modal.className = 'task-modal';
        modal.style.maxWidth = '460px';

        modal.innerHTML = `
            <h3 style="margin-bottom:1rem;"><i class="fa-solid fa-pen-to-square"></i> تعديل المهمة</h3>
            <div style="display:flex; flex-direction:column; gap:0.75rem; text-align:right;">
                <div>
                    <label style="font-size:0.85rem; font-weight:700;">عنوان المهمة:</label>
                    <input type="text" id="edit-task-text" class="calc-input" value="${escapeHtml(todo.text)}" required>
                </div>
                <div>
                    <label style="font-size:0.85rem; font-weight:700;">الأولوية:</label>
                    <select id="edit-task-priority" class="calc-input">
                        <option value="low" ${todo.priority === 'low' ? 'selected' : ''}>منخفضة</option>
                        <option value="medium" ${todo.priority === 'medium' ? 'selected' : ''}>متوسطة</option>
                        <option value="high" ${todo.priority === 'high' ? 'selected' : ''}>عالية 🔥</option>
                    </select>
                </div>
                <div>
                    <label style="font-size:0.85rem; font-weight:700;">تاريخ الاستحقاق:</label>
                    <input type="datetime-local" id="edit-task-date" class="calc-input" value="${todo.date || ''}">
                </div>
            </div>
            <div class="modal-actions" style="margin-top:1.25rem;">
                <button type="button" id="save-edit-task-btn" class="btn btn-primary"><i class="fa-solid fa-check"></i> حفظ التغييرات</button>
                <button type="button" id="cancel-edit-task-btn" class="btn btn-outline">إلغاء</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const saveBtn = modal.querySelector('#save-edit-task-btn');
        const cancelBtn = modal.querySelector('#cancel-edit-task-btn');
        const textInput = modal.querySelector('#edit-task-text');

        function closeModal() { overlay.remove(); }

        saveBtn.addEventListener('click', () => {
            const val = textInput.value.trim();
            if (!val) return;

            const pri = modal.querySelector('#edit-task-priority').value;
            const dt = modal.querySelector('#edit-task-date').value;

            if (typeof hayyizUpdateTask === 'function') {
                hayyizUpdateTask(todo.id, { text: val, priority: pri, date: dt || null });
            }
            closeModal();
            renderTasks();
        });

        cancelBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    }

    // ========== Form Submission ==========
    if (todoForm) {
        todoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = todoInput ? todoInput.value.trim() : '';
            if (!text) return;

            const newTask = {
                id: typeof hayyizGenerateId === 'function' ? hayyizGenerateId() : ('h' + Date.now()),
                text: text,
                priority: todoPriority ? todoPriority.value : 'medium',
                date: todoDate ? (todoDate.value || null) : null,
                minutes: todoMinutes ? (todoMinutes.value || null) : null,
                subjectId: todoSubject && todoSubject.value ? todoSubject.value : null,
                calendarEventId: todoEvent && todoEvent.value ? todoEvent.value : null,
                completed: false,
                created: Date.now(),
                focusDone: 0,
                sessionsDone: 0
            };

            if (typeof hayyizSaveTask === 'function') {
                hayyizSaveTask(newTask);
            } else {
                const todos = typeof hayyizGetTodos === 'function' ? hayyizGetTodos() : [];
                todos.unshift(newTask);
                localStorage.setItem('hayyiz-todos', JSON.stringify(todos));
            }

            if (todoInput) todoInput.value = '';
            if (todoDate) todoDate.value = '';
            if (todoMinutes) todoMinutes.value = '';

            announceSR('تمت إضافة المهمة بنجاح');
            renderTasks();
        });
    }

    // Filter tab switching
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter || 'all';
            renderTasks();
        });
    });

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    renderTasks();
});