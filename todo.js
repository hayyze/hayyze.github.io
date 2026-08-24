document.addEventListener('DOMContentLoaded', () => {

    function playNotificationSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
            osc.start();
            osc.stop(ctx.currentTime + 0.6);
        } catch (e) { /* ignore */ }
    }

    function announceToScreenReader(msg) {
        const announcer = document.getElementById('sr-todo-announcer');
        if (announcer) announcer.textContent = msg;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    let todos = typeof hayyizGetTodos === 'function'
        ? hayyizGetTodos()
        : JSON.parse(localStorage.getItem('hayyiz-todos') || '[]');

    let currentFilter = 'all';
    let searchQuery = '';

    /* =========================================================
     * POMODORO PROMPT SUPPRESSION HELPERS
     * ========================================================= */
    function isPomodoroPromptSuppressed() {
        try {
            const todayStr = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
            const hiddenToday = localStorage.getItem('hayyiz-hide-pomo-prompt-today');
            if (hiddenToday === todayStr) {
                return true;
            }

            const hiddenUntil = localStorage.getItem('hayyiz-hide-pomo-prompt-hour');
            if (hiddenUntil) {
                const expiresAt = parseInt(hiddenUntil, 10);
                if (!isNaN(expiresAt) && Date.now() < expiresAt) {
                    return true;
                } else if (!isNaN(expiresAt) && Date.now() >= expiresAt) {
                    localStorage.removeItem('hayyiz-hide-pomo-prompt-hour');
                }
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    function suppressPomodoroPrompt(type) {
        try {
            if (type === 'today') {
                const todayStr = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
                localStorage.setItem('hayyiz-hide-pomo-prompt-today', todayStr);
            } else if (type === 'hour') {
                const oneHourLater = Date.now() + (60 * 60 * 1000);
                localStorage.setItem('hayyiz-hide-pomo-prompt-hour', String(oneHourLater));
            }
        } catch (e) { /* ignore */ }
    }

    /* =========================================================
     * POMODORO SUGGESTION MODAL
     * ========================================================= */
    function showPomodoroSuggestion(taskObj, taskIndex) {
        if (!taskObj || isPomodoroPromptSuppressed()) return;

        document.querySelectorAll('.pomo-suggestion-overlay').forEach(el => el.remove());

        const overlay = document.createElement('div');
        overlay.className = 'task-modal-overlay pomo-suggestion-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'pomo-suggestion-title');

        const modal = document.createElement('div');
        modal.className = 'task-modal';

        const title = document.createElement('h3');
        title.id = 'pomo-suggestion-title';
        title.innerHTML = '<i class="fa-solid fa-stopwatch" style="color: var(--primary);"></i> البدء في المهمة؟';
        modal.appendChild(title);

        const taskNameEl = document.createElement('div');
        taskNameEl.className = 'task-name';
        taskNameEl.textContent = taskObj.text;
        modal.appendChild(taskNameEl);

        const desc = document.createElement('p');
        desc.style.fontSize = '0.92rem';
        desc.style.marginBottom = '1rem';
        desc.textContent = 'تم حفظ المهمة بنجاح! هل ترغب في الانتقال إلى مؤقت بومودورو لبدء جلسة تركيز عليها الآن؟';
        modal.appendChild(desc);

        const actions = document.createElement('div');
        actions.className = 'modal-actions';
        actions.style.flexDirection = 'column';
        actions.style.gap = '0.5rem';

        const closeModal = () => overlay.remove();

        // 1. Accept button -> Go to pomodoro
        const acceptBtn = document.createElement('button');
        acceptBtn.type = 'button';
        acceptBtn.className = 'btn btn-primary';
        acceptBtn.innerHTML = '<i class="fa-solid fa-play"></i> بدء جلسة التركيز';
        acceptBtn.addEventListener('click', () => {
            closeModal();
            startFocusForTask(taskObj, taskIndex);
        });
        actions.appendChild(acceptBtn);

        // 2. Reject button -> Stay on tasks
        const rejectBtn = document.createElement('button');
        rejectBtn.type = 'button';
        rejectBtn.className = 'btn btn-outline';
        rejectBtn.textContent = 'ليس الآن';
        rejectBtn.addEventListener('click', closeModal);
        actions.appendChild(rejectBtn);

        // Divider for suppression options
        const optionsDivider = document.createElement('div');
        optionsDivider.style.cssText = 'border-top: 1px dashed var(--border); margin: 0.5rem 0 0.25rem; padding-top: 0.5rem; font-size: 0.82rem; color: var(--text-muted);';
        optionsDivider.textContent = 'خيارات التعطيل المؤقت:';
        actions.appendChild(optionsDivider);

        const suppressGroup = document.createElement('div');
        suppressGroup.style.cssText = 'display: flex; gap: 0.4rem; justify-content: center; flex-wrap: wrap;';

        // 3. Hide for an hour button
        const hideHourBtn = document.createElement('button');
        hideHourBtn.type = 'button';
        hideHourBtn.className = 'btn btn-secondary btn-sm';
        hideHourBtn.style.fontSize = '0.8rem';
        hideHourBtn.textContent = 'لا تظهر لمدة ساعة';
        hideHourBtn.addEventListener('click', () => {
            suppressPomodoroPrompt('hour');
            closeModal();
        });
        suppressGroup.appendChild(hideHourBtn);

        // 4. Hide today button
        const hideTodayBtn = document.createElement('button');
        hideTodayBtn.type = 'button';
        hideTodayBtn.className = 'btn btn-secondary btn-sm';
        hideTodayBtn.style.fontSize = '0.8rem';
        hideTodayBtn.textContent = 'لا تظهر اليوم';
        hideTodayBtn.addEventListener('click', () => {
            suppressPomodoroPrompt('today');
            closeModal();
        });
        suppressGroup.appendChild(hideTodayBtn);

        actions.appendChild(suppressGroup);
        modal.appendChild(actions);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
    }

    // DOM Elements
    const heroCard = document.getElementById('todo-hero-card');
    const todoForm = document.getElementById('todo-form');
    const todoInput = document.getElementById('todo-input');
    const toggleOptionsBtn = document.getElementById('toggle-more-options');
    const extraOptionsDiv = document.getElementById('todo-extra-options');
    const toggleOptionsText = document.getElementById('toggle-options-text');

    const todoPriority = document.getElementById('todo-priority');
    const todoDate = document.getElementById('todo-date');
    const todoMinutes = document.getElementById('todo-minutes');
    const todoSubject = document.getElementById('todo-subject');
    const todoGoal = document.getElementById('todo-goal');
    const todoSubjectNew = document.getElementById('todo-subject-new');
    const todoSubjectAdd = document.getElementById('todo-subject-add');

    const todoStatsBar = document.getElementById('todo-stats-bar');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const searchWrap = document.getElementById('todo-search-wrap');
    const searchInput = document.getElementById('todo-search-input');
    const sectionsContainer = document.getElementById('todo-sections-container');
    const todoEmpty = document.getElementById('todo-empty');
    const todoEmptyText = document.getElementById('todo-empty-text');
    const emptyAddBtn = document.getElementById('empty-add-btn');

    // Modal Elements
    const detailsModal = document.getElementById('task-details-modal');
    const closeModalBtn = document.getElementById('close-task-modal');
    const modalForm = document.getElementById('modal-task-form');
    const modalTaskId = document.getElementById('modal-task-id');
    const modalTitle = document.getElementById('modal-input-title');
    const modalPriority = document.getElementById('modal-input-priority');
    const modalSubject = document.getElementById('modal-input-subject');
    const modalDate = document.getElementById('modal-input-date');
    const modalMinutes = document.getElementById('modal-input-minutes');
    const modalIntegrationInfo = document.getElementById('modal-integration-info');
    const modalBtnFocus = document.getElementById('modal-btn-focus');
    const modalBtnNote = document.getElementById('modal-btn-note');
    const modalBtnDelete = document.getElementById('modal-btn-delete');

    function saveTodos(changedTask) {
        if (typeof hayyizSaveTodos === 'function') {
            hayyizSaveTodos(todos);
        } else {
            localStorage.setItem('hayyiz-todos', JSON.stringify(todos));
        }
        if (changedTask && changedTask.id && typeof hayyizUploadItem === 'function') {
            hayyizUploadItem('todos', changedTask.id, changedTask);
        }
    }

    function refreshSelects() {
        if (typeof hayyizFillSubjectSelect === 'function') {
            hayyizFillSubjectSelect(todoSubject, todoSubject ? todoSubject.value : '');
            if (modalSubject) hayyizFillSubjectSelect(modalSubject, modalSubject.value || '');
        }

        if (todoGoal) {
            todoGoal.innerHTML = '<option value="">بدون هدف خاص</option>';
            const acadGoal = typeof hayyizGetAcademicGoal === 'function' ? hayyizGetAcademicGoal() : null;
            if (acadGoal && typeof acadGoal.target === 'number') {
                const opt = document.createElement('option');
                opt.value = 'acad-target';
                opt.textContent = `الهدف الأكاديمي الشامل (${acadGoal.target}%)`;
                todoGoal.appendChild(opt);
            }
            const subjectGoals = typeof hayyizGetSubjectGoals === 'function' ? hayyizGetSubjectGoals() : [];
            subjectGoals.forEach((sg) => {
                const opt = document.createElement('option');
                opt.value = sg.id || ('sg-' + sg.name);
                opt.textContent = `هدف مادة: ${sg.name} (${sg.target}%)`;
                todoGoal.appendChild(opt);
            });
        }
    }

    refreshSelects();

    // Toggle Extra Options
    if (toggleOptionsBtn && extraOptionsDiv) {
        toggleOptionsBtn.addEventListener('click', () => {
            const isHidden = extraOptionsDiv.classList.contains('hidden');
            if (isHidden) {
                extraOptionsDiv.classList.remove('hidden');
                toggleOptionsBtn.setAttribute('aria-expanded', 'true');
                if (toggleOptionsText) toggleOptionsText.textContent = 'خيارات أقل';
            } else {
                extraOptionsDiv.classList.add('hidden');
                toggleOptionsBtn.setAttribute('aria-expanded', 'false');
                if (toggleOptionsText) toggleOptionsText.textContent = 'تفاصيل أكثر';
            }
        });
    }

    // Add Subject Button
    if (todoSubjectAdd) {
        todoSubjectAdd.addEventListener('click', () => {
            const name = (todoSubjectNew && todoSubjectNew.value || '').trim();
            if (!name) return;
            let subject = null;
            if (typeof hayyizAddSubject === 'function') {
                subject = hayyizAddSubject(name);
            }
            if (todoSubjectNew) todoSubjectNew.value = '';
            refreshSelects();
            if (todoSubject && subject) todoSubject.value = subject.id;
        });
    }

    /* =========================================================
     * RENDER HERO CARD: ماذا أفعل الآن؟
     * ========================================================= */
    function renderHeroCard() {
        if (!heroCard) return;

        const focusState = typeof hayyizGetFocusState === 'function' ? hayyizGetFocusState() : null;
        const activeFocusRunning = focusState && focusState.status === 'running' && focusState.remainingSeconds > 0;

        let activeTask = null;
        if (activeFocusRunning && focusState.context && focusState.context.type === 'task') {
            activeTask = todos.find(t => t && (t.id === focusState.context.id || t.text === focusState.context.title));
        }

        const recommendation = typeof hayyizRecommendNext === 'function' ? hayyizRecommendNext(1) : null;
        const recommendedTask = activeTask || (recommendation ? recommendation.next : null);

        if (!recommendedTask) {
            heroCard.className = 'card todo-hero-card empty-hero';
            heroCard.innerHTML = `
                <div class="dash-now-label"><i class="fa-solid fa-circle-check" style="color: var(--success);"></i> يومك الدراسي منظم بالكامل!</div>
                <h2 style="font-size: 1.3rem; margin: 0.4rem 0 0.2rem;">لا توجد مهام نشطة حاليًا</h2>
                <p style="color: var(--text-muted); font-size: 0.92rem; margin-bottom: 0.85rem;">أضف أداء دراسيًا جديدًا أو ابدأ جلسة تركيز حرة لإنجاز المزيد.</p>
                <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
                    <button type="button" class="btn btn-primary" id="hero-start-free-btn"><i class="fa-solid fa-play"></i> ابدأ جلسة تركيز حرة</button>
                    <button type="button" class="btn btn-outline" id="hero-add-quick-btn"><i class="fa-solid fa-plus"></i> أضف مهمة</button>
                </div>
            `;

            document.getElementById('hero-start-free-btn')?.addEventListener('click', () => {
                if (typeof hayyizLaunchPomodoro === 'function') hayyizLaunchPomodoro(null);
            });
            document.getElementById('hero-add-quick-btn')?.addEventListener('click', () => {
                todoInput?.focus();
            });
            return;
        }

        const priMap = { high: 'عالية 🔥', medium: 'عادية', low: 'منخفضة' };
        const dueInfo = typeof hayyizFormatRelativeDueDate === 'function'
            ? hayyizFormatRelativeDueDate(recommendedTask.date)
            : { label: recommendedTask.date || 'بدون موعد' };

        const subName = recommendedTask.subjectId && typeof hayyizGetSubjectName === 'function'
            ? hayyizGetSubjectName(recommendedTask.subjectId)
            : '';

        const focusDone = parseInt(recommendedTask.focusDone, 10) || 0;
        const totalMin = parseInt(recommendedTask.minutes, 10) || 0;
        const isTaskActiveFocus = activeFocusRunning && focusState.context && focusState.context.title === recommendedTask.text;

        heroCard.className = 'card todo-hero-card';
        heroCard.innerHTML = `
            <div class="todo-hero-header">
                <div class="dash-now-label">
                    <i class="fa-solid fa-bullseye" style="color: var(--primary);"></i>
                    ${isTaskActiveFocus ? 'جلسة تركيز نشطة الآن' : (focusDone > 0 ? 'أكمل ما بدأت' : 'ماذا أفعل الآن؟')}
                </div>
                <span class="badge ${dueInfo.cssClass || 'badge-personal'}">${dueInfo.label}</span>
            </div>

            <h2 class="todo-hero-title">${escapeHtml(recommendedTask.text)}</h2>

            <div class="todo-hero-meta">
                <span><i class="fa-solid fa-layer-group"></i> أولوية ${priMap[recommendedTask.priority] || 'عادية'}</span>
                ${subName ? `<span><i class="fa-solid fa-book"></i> ${escapeHtml(subName)}</span>` : ''}
                ${totalMin > 0 ? `<span><i class="fa-solid fa-hourglass-half"></i> ${focusDone}/${totalMin} دقيقة</span>` : (focusDone > 0 ? `<span><i class="fa-solid fa-clock"></i> ${focusDone} دقيقة تركيز</span>` : '')}
            </div>

            ${recommendation && recommendation.reason ? `
                <div class="todo-hero-reason">
                    <i class="fa-solid fa-lightbulb" style="color: var(--warning);"></i> <strong>لماذا اخترنا هذه المهمة؟</strong> ${escapeHtml(recommendation.reason)}
                </div>
            ` : ''}

            <div class="todo-hero-actions">
                <button type="button" class="btn btn-primary btn-lg" id="hero-action-btn">
                    <i class="fa-solid ${isTaskActiveFocus ? 'fa-play' : 'fa-play'}"></i> ${isTaskActiveFocus ? 'متابعة الجلسة الجارية' : 'ابدأ التركيز على هذه المهمة'}
                </button>
                <button type="button" class="btn btn-secondary" id="hero-details-btn">
                    <i class="fa-solid fa-pen-to-square"></i> التفاصيل والتعديل
                </button>
            </div>
        `;

        document.getElementById('hero-action-btn')?.addEventListener('click', () => {
            const realIdx = todos.indexOf(recommendedTask);
            startFocusForTask(recommendedTask, realIdx >= 0 ? realIdx : 0);
        });

        document.getElementById('hero-details-btn')?.addEventListener('click', () => {
            openTaskModal(recommendedTask);
        });
    }

    function startFocusForTask(taskObj, index) {
        if (!taskObj) return;
        if (typeof hayyizLaunchPomodoro === 'function') {
            hayyizLaunchPomodoro(taskObj, index);
        } else {
            window.location.href = `pomodoro.html?task=${encodeURIComponent(taskObj.text)}`;
        }
    }

    /* =========================================================
     * RENDER WORKSPACE: STATS BAR, SECTIONS & ITEMS
     * ========================================================= */
    function renderTodos() {
        todos = typeof hayyizGetTodos === 'function' ? hayyizGetTodos() : todos;

        // Render Hero First
        renderHeroCard();

        // 1. Stats Bar
        const summary = typeof hayyizGetTaskSummary === 'function' ? hayyizGetTaskSummary() : null;
        if (summary && todoStatsBar) {
            todoStatsBar.innerHTML = `
                <div class="stat-pill"><i class="fa-solid fa-list-check" style="color:var(--primary);"></i> ${summary.activeCount} نشطة</div>
                ${summary.overdueCount > 0 ? `<div class="stat-pill overdue"><i class="fa-solid fa-triangle-exclamation"></i> ${summary.overdueCount} متأخرة</div>` : ''}
                <div class="stat-pill"><i class="fa-solid fa-calendar-day"></i> ${summary.dueTodayCount} اليوم</div>
                <div class="stat-pill"><i class="fa-solid fa-check-double" style="color:var(--success);"></i> ${summary.completedToday} أُنجزت اليوم</div>
            `;
        }

        // Show/Hide Search Wrap
        if (searchWrap) {
            if (todos.length >= 4) searchWrap.classList.remove('hidden');
            else searchWrap.classList.add('hidden');
        }

        // Filter Logic
        let filtered = todos;
        if (searchQuery) {
            filtered = filtered.filter(t => t && t.text && t.text.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        const todayStr = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);

        if (currentFilter === 'today') {
            filtered = filtered.filter(t => !t.completed && t.date && String(t.date).slice(0, 10) <= todayStr);
        } else if (currentFilter === 'upcoming') {
            filtered = filtered.filter(t => !t.completed && (!t.date || String(t.date).slice(0, 10) > todayStr));
        } else if (currentFilter === 'high') {
            filtered = filtered.filter(t => t.priority === 'high');
        } else if (currentFilter === 'completed') {
            filtered = filtered.filter(t => t.completed);
        }

        sectionsContainer.innerHTML = '';

        if (filtered.length === 0) {
            todoEmpty.classList.remove('hidden');
            if (searchQuery) todoEmptyText.textContent = `لا توجد نتائج تطابق "${searchQuery}".`;
            else if (currentFilter === 'completed') todoEmptyText.textContent = 'لم تُكمل أي مهام بعد. عند إنجاز مهمة، ستظهر هنا مع سجل جلسات التركيز.';
            else todoEmptyText.textContent = 'لا توجد مهام نشطة حاليًا في هذا القسم.';
            return;
        }

        todoEmpty.classList.add('hidden');

        // Grouping logic for 'all' or filtered list
        if (currentFilter === 'all' && !searchQuery) {
            const todayOverdueList = filtered.filter(t => !t.completed && t.date && String(t.date).slice(0, 10) <= todayStr);
            const upcomingList = filtered.filter(t => !t.completed && (!t.date || String(t.date).slice(0, 10) > todayStr));
            const completedList = filtered.filter(t => t.completed);

            // Sort Ranking helper
            const rankSort = (a, b) => {
                const pMap = { high: 3, medium: 2, low: 1 };
                if ((pMap[b.priority] || 2) !== (pMap[a.priority] || 2)) {
                    return (pMap[b.priority] || 2) - (pMap[a.priority] || 2);
                }
                const dateA = a.date ? new Date(a.date).getTime() : Infinity;
                const dateB = b.date ? new Date(b.date).getTime() : Infinity;
                if (dateA !== dateB) return dateA - dateB;
                return (b.created || 0) - (a.created || 0);
            };

            todayOverdueList.sort(rankSort);
            upcomingList.sort(rankSort);

            if (todayOverdueList.length > 0) {
                renderSectionGroup('اليوم والمتأخر', 'fa-solid fa-clock-rotate-left', todayOverdueList, 'due-overdue');
            }
            if (upcomingList.length > 0) {
                renderSectionGroup('القادم ومهام التخطيط', 'fa-solid fa-calendar-days', upcomingList, 'badge-personal');
            }
            if (completedList.length > 0) {
                renderSectionGroup('المهام المكتملة', 'fa-solid fa-circle-check', completedList, 'badge-completed', true);
            }
        } else {
            // Standard single group
            renderSectionGroup('نتائج التصفية', 'fa-solid fa-filter', filtered, 'badge-personal');
        }
    }

    function renderSectionGroup(title, iconClass, groupTodos, badgeStyleClass, isCollapsible = false) {
        const sectionEl = document.createElement('div');
        sectionEl.className = 'todo-section-group';
        sectionEl.style.marginBottom = '1.5rem';

        const headEl = document.createElement('div');
        headEl.className = 'todo-section-head';
        headEl.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border); padding-bottom: 0.4rem;';

        const titleEl = document.createElement('h3');
        titleEl.style.cssText = 'font-size: 1.1rem; margin: 0; display: flex; align-items: center; gap: 0.5rem;';
        titleEl.innerHTML = `<i class="${iconClass}" style="color: var(--primary);"></i> ${escapeHtml(title)} <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: normal;">(${groupTodos.length})</span>`;

        headEl.appendChild(titleEl);

        if (isCollapsible) {
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'btn btn-outline btn-sm';
            toggleBtn.textContent = 'عرض / إخفاء';
            toggleBtn.style.fontSize = '0.8rem';
            headEl.appendChild(toggleBtn);

            const listUl = document.createElement('ul');
            listUl.className = 'todo-list hidden';

            toggleBtn.addEventListener('click', () => {
                listUl.classList.toggle('hidden');
            });

            groupTodos.forEach(t => listUl.appendChild(createTaskItemNode(t)));
            sectionEl.appendChild(headEl);
            sectionEl.appendChild(listUl);
        } else {
            const listUl = document.createElement('ul');
            listUl.className = 'todo-list';
            groupTodos.forEach(t => listUl.appendChild(createTaskItemNode(t)));
            sectionEl.appendChild(headEl);
            sectionEl.appendChild(listUl);
        }

        sectionsContainer.appendChild(sectionEl);
    }

    function createTaskItemNode(todo) {
        const realIndex = todos.indexOf(todo);
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        li.dataset.id = todo.id;

        const focusState = typeof hayyizGetFocusState === 'function' ? hayyizGetFocusState() : null;
        const isRunningThis = focusState && focusState.status === 'running' && focusState.context && focusState.context.title === todo.text;

        // Checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'todo-check';
        checkbox.checked = Boolean(todo.completed);
        checkbox.setAttribute('aria-label', `تعديل حالة مهمة ${todo.text}`);
        checkbox.addEventListener('change', () => {
            if (typeof hayyizUpdateTask === 'function') {
                hayyizUpdateTask(todo.id, { completed: checkbox.checked });
            } else {
                todo.completed = checkbox.checked;
                saveTodos();
            }
            announceToScreenReader(checkbox.checked ? `تم إكمال المهمة: ${todo.text}` : `تمت إعادة المهمة: ${todo.text}`);
            renderTodos();
        });

        // Content Wrapper
        const content = document.createElement('div');
        content.className = 'todo-content';

        const text = document.createElement('div');
        text.className = 'todo-text';
        text.textContent = todo.text;

        // Click on title opens modal
        text.style.cursor = 'pointer';
        text.addEventListener('click', () => openTaskModal(todo));

        const meta = document.createElement('div');
        meta.className = 'todo-meta';

        // Priority Badge
        const priSpan = document.createElement('span');
        priSpan.className = `priority-${todo.priority || 'medium'}`;
        const priMap = { high: 'عالية 🔥', medium: 'متوسطة', low: 'منخفضة' };
        priSpan.textContent = priMap[todo.priority] || 'متوسطة';
        meta.appendChild(priSpan);

        // Relative Due Date
        if (todo.date) {
            const dueObj = typeof hayyizFormatRelativeDueDate === 'function'
                ? hayyizFormatRelativeDueDate(todo.date)
                : { label: todo.date };
            const dateSpan = document.createElement('span');
            dateSpan.style.fontWeight = dueObj.isOverdue ? '700' : 'normal';
            dateSpan.style.color = dueObj.isOverdue ? 'var(--danger)' : 'var(--text-muted)';
            dateSpan.innerHTML = `<i class="fa-regular fa-calendar"></i> ${escapeHtml(dueObj.label)}`;
            meta.appendChild(dateSpan);
        }

        // Subject
        if (todo.subjectId && typeof hayyizGetSubjectName === 'function') {
            const subName = hayyizGetSubjectName(todo.subjectId);
            if (subName) {
                const subSpan = document.createElement('span');
                subSpan.innerHTML = `<i class="fa-solid fa-book"></i> ${escapeHtml(subName)}`;
                meta.appendChild(subSpan);
            }
        }

        // Focus minutes/sessions progress
        const focusDone = parseInt(todo.focusDone, 10) || 0;
        const totalMin = parseInt(todo.minutes, 10) || 0;
        const sessionsDone = parseInt(todo.sessionsDone, 10) || 0;

        if (focusDone > 0 || totalMin > 0) {
            const focusSpan = document.createElement('span');
            focusSpan.style.color = 'var(--primary)';
            focusSpan.style.fontWeight = '600';
            focusSpan.innerHTML = `<i class="fa-solid fa-clock"></i> ${focusDone}${totalMin > 0 ? '/' + totalMin : ''} دقيقة ${sessionsDone > 0 ? '(' + sessionsDone + ' جلسات)' : ''}`;
            meta.appendChild(focusSpan);
        }

        // Active Focus Indicator
        if (isRunningThis) {
            const activeTag = document.createElement('span');
            activeTag.className = 'badge badge-exam';
            activeTag.style.animation = 'pulse 1.5s infinite';
            activeTag.innerHTML = '<i class="fa-solid fa-play"></i> جلسة تركيز جارية';
            meta.appendChild(activeTag);
        }

        content.appendChild(text);
        content.appendChild(meta);

        // Actions
        const actions = document.createElement('div');
        actions.className = 'todo-actions';

        if (!todo.completed) {
            const pomoBtn = document.createElement('button');
            pomoBtn.className = 'btn btn-primary btn-sm';
            pomoBtn.type = 'button';
            pomoBtn.title = 'ابدأ جلسة تركيز على هذه المهمة';
            pomoBtn.innerHTML = isRunningThis
                ? '<i class="fa-solid fa-play"></i> متابعة'
                : '<i class="fa-solid fa-play"></i> تركيز';
            pomoBtn.addEventListener('click', () => startFocusForTask(todo, realIndex));
            actions.appendChild(pomoBtn);
        }

        const editBtn = document.createElement('button');
        editBtn.className = 'todo-pomo-btn';
        editBtn.type = 'button';
        editBtn.title = 'التفاصيل والتعديل';
        editBtn.setAttribute('aria-label', `تعديل مهمة ${todo.text}`);
        editBtn.innerHTML = '<i class="fa-solid fa-pen" aria-hidden="true"></i>';
        editBtn.addEventListener('click', () => openTaskModal(todo));
        actions.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'todo-delete';
        deleteBtn.type = 'button';
        deleteBtn.title = 'حذف المهمة';
        deleteBtn.setAttribute('aria-label', `حذف مهمة ${todo.text}`);
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>';
        deleteBtn.addEventListener('click', () => {
            if (confirm(`هل أنت متأكد من حذف المهمة "${todo.text}"؟`)) {
                if (typeof hayyizDeleteTask === 'function') {
                    hayyizDeleteTask(todo.id);
                } else {
                    todos.splice(realIndex, 1);
                    saveTodos();
                }
                announceToScreenReader(`تم حذف المهمة: ${todo.text}`);
                renderTodos();
            }
        });
        actions.appendChild(deleteBtn);

        li.appendChild(checkbox);
        li.appendChild(content);
        li.appendChild(actions);

        return li;
    }

    /* =========================================================
     * TASK FORM SUBMISSION
     * ========================================================= */
    todoForm.addEventListener('submit', e => {
        e.preventDefault();

        const text = todoInput ? todoInput.value.trim() : '';
        if (!text) return;

        const newTask = {
            id: typeof hayyizGenerateId === 'function' ? hayyizGenerateId() : ('h' + Date.now()),
            text,
            priority: todoPriority ? todoPriority.value : 'medium',
            date: (todoDate && todoDate.value) ? todoDate.value : null,
            minutes: (todoMinutes && todoMinutes.value) ? todoMinutes.value : null,
            subjectId: (todoSubject && todoSubject.value) ? todoSubject.value : null,
            goalId: (todoGoal && todoGoal.value) ? todoGoal.value : null,
            completed: false,
            status: 'todo',
            created: Date.now(),
            focusDone: 0,
            sessionsDone: 0
        };

        todos.unshift(newTask);
        saveTodos(newTask);

        todoInput.value = '';
        if (todoDate) todoDate.value = '';
        if (todoMinutes) todoMinutes.value = '';

        announceToScreenReader(`تمت إضافة المهمة: ${text}`);
        renderTodos();

        if (!isPomodoroPromptSuppressed()) {
            showPomodoroSuggestion(newTask, 0);
        }
    });

    // Filter Buttons Click
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTodos();
        });
    });

    // Search Input
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            searchQuery = searchInput.value.trim();
            renderTodos();
        });
    }

    if (emptyAddBtn) {
        emptyAddBtn.addEventListener('click', () => todoInput?.focus());
    }

    /* =========================================================
     * TASK DETAILS & EDIT MODAL
     * ========================================================= */
    function openTaskModal(task) {
        if (!task || !detailsModal) return;

        modalTaskId.value = task.id;
        modalTitle.value = task.text || '';
        modalPriority.value = task.priority || 'medium';
        modalDate.value = task.date || '';
        modalMinutes.value = task.minutes || '';

        if (typeof hayyizFillSubjectSelect === 'function') {
            hayyizFillSubjectSelect(modalSubject, task.subjectId || '');
        }

        const focusDone = parseInt(task.focusDone, 10) || 0;
        const sessionsDone = parseInt(task.sessionsDone, 10) || 0;

        // Check if linked calendar event exists
        let eventMeta = '';
        if (task.eventId) {
            const allEvents = typeof hayyizGetAllCalendarEvents === 'function' ? hayyizGetAllCalendarEvents() : [];
            const linkedEv = allEvents.find(e => e.id === task.eventId);
            if (linkedEv) {
                eventMeta = `<div><i class="fa-regular fa-calendar-check" style="color:var(--primary);"></i> <strong>مرتبطة بالتقويم:</strong> ${escapeHtml(linkedEv.name)} (${linkedEv.date})</div>`;
            }
        }

        modalIntegrationInfo.innerHTML = `
            <div><i class="fa-solid fa-chart-simple" style="color:var(--primary);"></i> <strong>إحصاءات التركيز:</strong> ${focusDone} دقيقة إجمالية عبر ${sessionsDone} جلسات تركيز.</div>
            ${eventMeta}
            <div><i class="fa-solid fa-info-circle" style="color:var(--text-muted);"></i> <strong>تاريخ الإنشاء:</strong> ${new Date(task.created || Date.now()).toLocaleString('ar-EG')}</div>
        `;

        modalBtnFocus.onclick = () => {
            detailsModal.classList.add('hidden');
            const realIdx = todos.indexOf(task);
            startFocusForTask(task, realIdx >= 0 ? realIdx : 0);
        };

        modalBtnNote.onclick = () => {
            detailsModal.classList.add('hidden');
            window.location.href = `notes.html?title=${encodeURIComponent(task.text)}&task=${encodeURIComponent(task.text)}`;
        };

        modalBtnDelete.onclick = () => {
            if (confirm(`هل أنت متأكد من حذف المهمة "${task.text}"؟`)) {
                if (typeof hayyizDeleteTask === 'function') {
                    hayyizDeleteTask(task.id);
                } else {
                    const idx = todos.indexOf(task);
                    if (idx >= 0) todos.splice(idx, 1);
                    saveTodos();
                }
                detailsModal.classList.add('hidden');
                renderTodos();
            }
        };

        detailsModal.classList.remove('hidden');
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => detailsModal.classList.add('hidden'));
    }

    if (modalForm) {
        modalForm.addEventListener('submit', e => {
            e.preventDefault();
            const id = modalTaskId.value;
            if (!id) return;

            const patch = {
                text: modalTitle.value.trim(),
                priority: modalPriority.value,
                subjectId: modalSubject.value || null,
                date: modalDate.value || null,
                minutes: modalMinutes.value || null
            };

            if (typeof hayyizUpdateTask === 'function') {
                hayyizUpdateTask(id, patch);
            } else {
                const target = todos.find(t => t.id === id);
                if (target) Object.assign(target, patch);
                saveTodos();
            }

            detailsModal.classList.add('hidden');
            renderTodos();
        });
    }

    // Initial render
    renderTodos();

    if (typeof hayyizRegisterSyncCallback === 'function') {
        hayyizRegisterSyncCallback('todos', (merged) => {
            if (Array.isArray(merged)) {
                todos = merged;
                renderTodos();
            }
        });
    }

    if (typeof hayyizSyncTool === 'function') {
        hayyizSyncTool('todos');
    }
    if (typeof initAuthListener === 'function') {
        initAuthListener();
    }
});
