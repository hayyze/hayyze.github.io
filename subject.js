/**
 * subject.js — صفحة المادة المركزية في منصة حيز (Subject Hub)
 */

if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('DOMContentLoaded', () => {
        try {
            initSubjectPage();
        } catch (e) {
            console.error('Error initializing subject page:', e);
        }
    });
}

let currentActiveTaskTab = 'open'; // 'open' | 'done'

function initSubjectPage() {
    const notFoundEl = document.getElementById('subject-not-found');
    const contentEl = document.getElementById('subject-content');

    if (!notFoundEl || !contentEl) return;

    const urlParams = new URLSearchParams(window.location.search);
    const subjectId = urlParams.get('id');

    // جلب المواد المخزنة
    const subjects = typeof hayyizGetSubjects === 'function' ? hayyizGetSubjects() : [];
    let subject = null;

    if (subjectId) {
        // البحث بالـ id أولاً
        if (typeof hayyizGetSubjectById === 'function') {
            subject = hayyizGetSubjectById(subjectId);
        }
        if (!subject && Array.isArray(subjects)) {
            subject = subjects.find(s => s && String(s.id) === String(subjectId)) || null;
        }
        // كخيار توافق احتياطي: إذا كان المدخل اسم المادة
        if (!subject && Array.isArray(subjects)) {
            subject = subjects.find(s => s && s.name === subjectId.trim()) || null;
        }
    }

    if (!subject) {
        showNotFoundState(subjects);
        return;
    }

    notFoundEl.style.display = 'none';
    contentEl.style.display = 'block';

    // تحديث عنوان الصفحة والهيدر
    const escapeFn = typeof escapeHtml === 'function' ? escapeHtml : (str => str || '');
    document.title = `${subject.name} | صفحة المادة | حيز`;

    const headingEl = document.getElementById('subject-name-heading');
    if (headingEl) {
        headingEl.textContent = subject.name;
    }

    const focusBtn = document.getElementById('btn-focus-subject');
    if (focusBtn) {
        focusBtn.href = `pomodoro.html?subjectId=${encodeURIComponent(subject.id)}`;
    }

    // جلب البيانات المرتبطة من الأدوات المختلفة
    const allTodos = typeof hayyizGetTodos === 'function' ? hayyizGetTodos() : [];
    const allExams = typeof hayyizGetExams === 'function' ? hayyizGetExams() : [];
    const allSessions = typeof hayyizGetFocusSessions === 'function' ? hayyizGetFocusSessions() : [];
    const rawNotes = localStorage.getItem('hayyiz-notes');
    let allNotes = [];
    try {
        allNotes = rawNotes ? JSON.parse(rawNotes) : [];
        if (!Array.isArray(allNotes)) allNotes = [];
    } catch (e) {
        allNotes = [];
    }

    // 1. تصفية المهام
    const subjectTasks = allTodos.filter(t => {
        if (!t) return false;
        if (t.subjectId) return String(t.subjectId) === String(subject.id);
        if (t.subject) return t.subject === subject.name;
        return false;
    });

    const openTasks = subjectTasks.filter(t => !t.completed && !t.done);
    const doneTasks = subjectTasks.filter(t => t.completed || t.done);

    // 2. تصفية الاختبارات
    const subjectExams = allExams.filter(e => {
        if (!e) return false;
        if (e.subjectId) return String(e.subjectId) === String(subject.id);
        if (e.subject) return e.subject === subject.name;
        if (e.name && e.name.includes(subject.name)) return true;
        return false;
    });

    // 3. تصفية جلسات التركيز
    // إما مطابقة مباشرة للـ subjectId في contextSnapshot، أو عبر مهمة تنتمي لهذه المادة
    const subjectTaskIds = new Set(subjectTasks.map(t => String(t.id)));
    const subjectSessions = allSessions.filter(s => {
        if (!s) return false;
        const snap = s.contextSnapshot;
        if (snap) {
            if (snap.subjectId && String(snap.subjectId) === String(subject.id)) return true;
            if (snap.type === 'task' && snap.id && subjectTaskIds.has(String(snap.id))) return true;
        }
        return false;
    });

    let totalFocusMin = parseInt(subject.focusMinutes, 10) || 0;
    let totalSessionsCount = parseInt(subject.sessions, 10) || 0;

    // إضافة الدقائق المسجلة في السجل إذا كانت أكبر
    let logMin = 0;
    subjectSessions.forEach(s => {
        logMin += parseInt(s.durationMinutes, 10) || 0;
    });
    if (logMin > totalFocusMin) {
        totalFocusMin = logMin;
    }
    if (subjectSessions.length > totalSessionsCount) {
        totalSessionsCount = subjectSessions.length;
    }

    // 4. تصفية الملاحظات
    const subjectNotes = allNotes.filter(n => {
        if (!n) return false;
        if (n.subjectId && String(n.subjectId) === String(subject.id)) return true;
        if (n.subject && n.subject === subject.name) return true;
        if (n.relatedTaskId && subjectTaskIds.has(String(n.relatedTaskId))) return true;
        if (n.relatedTask) {
            const matchesTask = subjectTasks.some(t => t.text === n.relatedTask || t.title === n.relatedTask);
            if (matchesTask) return true;
        }
        return false;
    });

    // 5. الأهداف الأكاديمية
    const subjectGoals = typeof hayyizGetSubjectGoals === 'function' ? hayyizGetSubjectGoals() : [];
    const goal = subjectGoals.find(g => g && (String(g.subjectId) === String(subject.id) || g.name === subject.name || String(g.id) === String(subject.id))) || null;

    // تحديث الهيدر والإحصائيات السريعة
    const statOpenTasks = document.getElementById('stat-open-tasks');
    if (statOpenTasks) statOpenTasks.textContent = openTasks.length;

    const statFocusTime = document.getElementById('stat-focus-time');
    if (statFocusTime) statFocusTime.textContent = `${totalFocusMin} دقيقة`;

    const statFocusSessions = document.getElementById('stat-focus-sessions');
    if (statFocusSessions) statFocusSessions.textContent = `${totalSessionsCount} جلسة`;

    const statNearestExam = document.getElementById('stat-nearest-exam');
    if (statNearestExam) {
        if (subjectExams.length > 0) {
            // ترتيب حسب التاريخ
            const sortedExams = [...subjectExams].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
            const nearest = sortedExams[0];
            const daysUntil = typeof hayyizGetDaysUntil === 'function' ? hayyizGetDaysUntil(nearest.date) : null;
            let label = nearest.name || 'اختبار';
            if (daysUntil !== null) {
                if (daysUntil === 0) label += ' (اليوم)';
                else if (daysUntil === 1) label += ' (غداً)';
                else if (daysUntil > 1) label += ` (بعد ${daysUntil} أيام)`;
            }
            statNearestExam.textContent = label;
        } else {
            statNearestExam.textContent = 'لا يوجد';
        }
    }

    // عرض الأقسام المختلفة
    renderGoalSection(subject, goal);
    renderTasksSection(subject, openTasks, doneTasks);
    renderExamsSection(subject, subjectExams);
    renderFocusSection(subject, subjectSessions, totalFocusMin, totalSessionsCount);
    renderNotesSection(subject, subjectNotes);
}

/**
 * عرض حالة "لم يتم العثور على المادة"
 */
function showNotFoundState(subjects) {
    const notFoundEl = document.getElementById('subject-not-found');
    const contentEl = document.getElementById('subject-content');
    const availableContainer = document.getElementById('available-subjects-container');

    if (notFoundEl) notFoundEl.style.display = 'block';
    if (contentEl) contentEl.style.display = 'none';

    if (availableContainer) {
        availableContainer.innerHTML = '';
        if (Array.isArray(subjects) && subjects.length > 0) {
            const p = document.createElement('p');
            p.style.cssText = 'font-weight: 600; margin-bottom: 0.75rem; color: var(--deep-ink); font-size: 0.95rem;';
            p.textContent = 'أو اختر مادة من موادك المسجلة:';
            availableContainer.appendChild(p);

            const list = document.createElement('div');
            list.style.cssText = 'display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center;';

            subjects.forEach(s => {
                if (!s || !s.id || !s.name) return;
                const link = document.createElement('a');
                link.href = `subject.html?id=${encodeURIComponent(s.id)}`;
                link.className = 'btn btn-secondary btn-sm';
                link.textContent = s.name;
                list.appendChild(link);
            });
            availableContainer.appendChild(list);
        }
    }
}

/**
 * قسم الهدف الأكاديمي والتقدم
 */
function renderGoalSection(subject, goal) {
    const wrapper = document.getElementById('goal-section-wrapper');
    const container = document.getElementById('goal-content');
    if (!wrapper || !container) return;

    if (!goal) {
        wrapper.style.display = 'none';
        return;
    }

    wrapper.style.display = 'block';
    container.innerHTML = '';

    const box = document.createElement('div');
    box.style.cssText = 'display: flex; align-items: center; justify-content: space-between; background: var(--surface-secondary); padding: 0.88rem; border-radius: 8px; flex-wrap: wrap; gap: 0.75rem;';

    const info = document.createElement('div');
    const title = document.createElement('div');
    title.style.cssText = 'font-weight: 700; color: var(--deep-ink); font-size: 0.95rem; margin-bottom: 0.25rem;';
    title.textContent = `الدرجة أو الهدف المستهدف: ${goal.target || goal.gradeGoal || 'غير محدد'}`;

    const desc = document.createElement('div');
    desc.style.cssText = 'font-size: 0.85rem; color: var(--text-muted);';
    desc.textContent = `المادة: ${subject.name}`;

    info.appendChild(title);
    info.appendChild(desc);
    box.appendChild(info);

    container.appendChild(box);
}

/**
 * قسم المهام الدراسية
 */
function renderTasksSection(subject, openTasks, doneTasks) {
    const container = document.getElementById('subject-tasks-container');
    const openCountEl = document.getElementById('count-open-tab');
    const doneCountEl = document.getElementById('count-done-tab');
    const tabOpenBtn = document.getElementById('tab-tasks-open');
    const tabDoneBtn = document.getElementById('tab-tasks-done');

    if (!container) return;

    if (openCountEl) openCountEl.textContent = openTasks.length;
    if (doneCountEl) doneCountEl.textContent = doneTasks.length;

    const renderList = () => {
        container.innerHTML = '';
        const listToRender = currentActiveTaskTab === 'open' ? openTasks : doneTasks;

        if (listToRender.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'text-align: center; padding: 2rem 1rem; color: var(--text-muted); font-size: 0.95rem;';
            empty.textContent = currentActiveTaskTab === 'open' ? 'لا توجد مهام مفتوحة لهذه المادة حالياً.' : 'لا توجد مهام مكتملة لهذه المادة.';
            container.appendChild(empty);
            return;
        }

        const listDiv = document.createElement('div');
        listDiv.style.cssText = 'display: flex; flex-direction: column; gap: 0.75rem;';

        listToRender.forEach(task => {
            const card = document.createElement('div');
            card.style.cssText = 'background: var(--surface-secondary); padding: 0.88rem 1rem; border-radius: 8px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;';

            const rightDiv = document.createElement('div');
            rightDiv.style.cssText = 'display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 200px;';

            // Checkbox/Icon
            const checkIcon = document.createElement('i');
            checkIcon.className = task.completed || task.done ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle';
            checkIcon.style.cssText = `font-size: 1.1rem; color: ${task.completed || task.done ? 'var(--primary)' : 'var(--text-muted)'}; cursor: pointer;`;

            const titleDiv = document.createElement('div');
            const taskText = document.createElement('div');
            taskText.style.cssText = `font-weight: 600; font-size: 0.95rem; color: var(--deep-ink); ${task.completed || task.done ? 'text-decoration: line-through; opacity: 0.7;' : ''}`;
            taskText.textContent = task.text || task.title || 'مهمة بدون عنوان';

            const metaDiv = document.createElement('div');
            metaDiv.style.cssText = 'display: flex; gap: 0.75rem; font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem; flex-wrap: wrap;';

            if (task.date) {
                const dateSpan = document.createElement('span');
                const dueObj = typeof hayyizFormatRelativeDueDate === 'function' ? hayyizFormatRelativeDueDate(task.date) : { label: task.date };
                dateSpan.textContent = `📅 ${dueObj.label}`;
                metaDiv.appendChild(dateSpan);
            }

            if (task.priority) {
                const prioSpan = document.createElement('span');
                const prioMap = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };
                prioSpan.textContent = `أولوية: ${prioMap[task.priority] || task.priority}`;
                metaDiv.appendChild(prioSpan);
            }

            titleDiv.appendChild(taskText);
            if (metaDiv.children.length > 0) titleDiv.appendChild(metaDiv);

            rightDiv.appendChild(checkIcon);
            rightDiv.appendChild(titleDiv);

            // Actions
            const actionsDiv = document.createElement('div');
            actionsDiv.style.cssText = 'display: flex; gap: 0.5rem; align-items: center;';

            const openLink = document.createElement('a');
            openLink.href = `todo.html?id=${encodeURIComponent(task.id)}`;
            openLink.className = 'btn btn-secondary btn-sm';
            openLink.innerHTML = '<i class="fa-solid fa-arrow-left-long"></i> عرض';

            if (!task.completed && !task.done) {
                const focusLink = document.createElement('a');
                focusLink.href = `pomodoro.html?taskId=${encodeURIComponent(task.id)}`;
                focusLink.className = 'btn btn-primary btn-sm';
                focusLink.innerHTML = '<i class="fa-solid fa-play"></i> تركيز';
                actionsDiv.appendChild(focusLink);
            }

            actionsDiv.appendChild(openLink);

            card.appendChild(rightDiv);
            card.appendChild(actionsDiv);
            listDiv.appendChild(card);
        });

        container.appendChild(listDiv);
    };

    if (tabOpenBtn && tabDoneBtn) {
        tabOpenBtn.onclick = () => {
            currentActiveTaskTab = 'open';
            tabOpenBtn.className = 'btn btn-sm btn-primary';
            tabDoneBtn.className = 'btn btn-sm btn-secondary';
            renderList();
        };
        tabDoneBtn.onclick = () => {
            currentActiveTaskTab = 'done';
            tabDoneBtn.className = 'btn btn-sm btn-primary';
            tabOpenBtn.className = 'btn btn-sm btn-secondary';
            renderList();
        };
    }

    renderList();
}

/**
 * قسم الاختبارات
 */
function renderExamsSection(subject, exams) {
    const container = document.getElementById('subject-exams-container');
    if (!container) return;

    container.innerHTML = '';

    if (exams.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'text-align: center; padding: 1.5rem 1rem; color: var(--text-muted); font-size: 0.95rem;';
        empty.textContent = 'لا توجد اختبارات قادمة مسجلة لهذه المادة في التقويم.';
        container.appendChild(empty);
        return;
    }

    const listDiv = document.createElement('div');
    listDiv.style.cssText = 'display: flex; flex-direction: column; gap: 0.75rem;';

    // ترتيب الاختبارات زمنيًا
    const sorted = [...exams].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    sorted.forEach(exam => {
        const card = document.createElement('div');
        card.style.cssText = 'background: var(--surface-secondary); padding: 0.88rem 1rem; border-radius: 8px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;';

        const infoDiv = document.createElement('div');
        const title = document.createElement('div');
        title.style.cssText = 'font-weight: 700; font-size: 0.95rem; color: var(--deep-ink); margin-bottom: 0.25rem;';
        title.textContent = exam.name || exam.title || 'اختبار مادة';

        const meta = document.createElement('div');
        meta.style.cssText = 'font-size: 0.85rem; color: var(--text-muted); display: flex; gap: 0.75rem; flex-wrap: wrap;';

        if (exam.date) {
            const dateSpan = document.createElement('span');
            dateSpan.textContent = `📅 التاريخ: ${exam.date}`;
            meta.appendChild(dateSpan);

            const daysUntil = typeof hayyizGetDaysUntil === 'function' ? hayyizGetDaysUntil(exam.date) : null;
            if (daysUntil !== null) {
                const daysSpan = document.createElement('span');
                daysSpan.style.fontWeight = '600';
                daysSpan.style.color = daysUntil <= 2 ? 'var(--terracotta)' : 'var(--primary)';
                if (daysUntil === 0) daysSpan.textContent = ' (اليوم)';
                else if (daysUntil === 1) daysSpan.textContent = ' (غداً)';
                else if (daysUntil > 1) daysSpan.textContent = ` (متبقي ${daysUntil} أيام)`;
                else daysSpan.textContent = ' (مكتمل/سابق)';
                meta.appendChild(daysSpan);
            }
        }

        infoDiv.appendChild(title);
        infoDiv.appendChild(meta);

        const actionsDiv = document.createElement('div');
        const calLink = document.createElement('a');
        calLink.href = 'calculator.html';
        calLink.className = 'btn btn-secondary btn-sm';
        calLink.innerHTML = '<i class="fa-solid fa-calendar-days"></i> فتح التقويم';

        actionsDiv.appendChild(calLink);

        card.appendChild(infoDiv);
        card.appendChild(actionsDiv);
        listDiv.appendChild(card);
    });

    container.appendChild(listDiv);
}

/**
 * قسم جلسات التركيز
 */
function renderFocusSection(subject, sessions, totalMin, totalCount) {
    const container = document.getElementById('subject-focus-container');
    if (!container) return;

    container.innerHTML = '';

    const summaryBox = document.createElement('div');
    summaryBox.style.cssText = 'background: var(--surface-secondary); padding: 0.88rem 1rem; border-radius: 8px; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;';

    const sumText = document.createElement('div');
    sumText.style.cssText = 'font-size: 0.9rem; color: var(--deep-ink); font-weight: 600;';
    sumText.textContent = `المجموع الكلي: ${totalMin} دقيقة تركيز عبر ${totalCount} جلسة.`;

    const startLink = document.createElement('a');
    startLink.href = `pomodoro.html?subjectId=${encodeURIComponent(subject.id)}`;
    startLink.className = 'btn btn-primary btn-sm';
    startLink.innerHTML = '<i class="fa-solid fa-play"></i> بدء جلسة جديدة';

    summaryBox.appendChild(sumText);
    summaryBox.appendChild(startLink);
    container.appendChild(summaryBox);

    if (sessions.length === 0) {
        const empty = document.createElement('p');
        empty.style.cssText = 'text-align: center; color: var(--text-muted); font-size: 0.9rem; margin: 1rem 0;';
        empty.textContent = 'لم يتم تسجيل جلسات تركيز مخصصة لهذه المادة مؤخرًا.';
        container.appendChild(empty);
        return;
    }

    const listDiv = document.createElement('div');
    listDiv.style.cssText = 'display: flex; flex-direction: column; gap: 0.5rem;';

    // عرض أحدث 5 جلسات
    const recent = [...sessions].slice(0, 5);

    recent.forEach(s => {
        const item = document.createElement('div');
        item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.88rem; background: var(--card-bg); border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.88rem;';

        const titleSpan = document.createElement('span');
        titleSpan.style.fontWeight = '600';
        titleSpan.style.color = 'var(--deep-ink)';
        const titleText = s.contextSnapshot && s.contextSnapshot.title ? s.contextSnapshot.title : 'جلسة تركيز';
        titleSpan.textContent = `⏱️ ${titleText}`;

        const detailsSpan = document.createElement('span');
        detailsSpan.style.color = 'var(--text-muted)';
        const dateStr = s.date || (s.timestamp ? s.timestamp.split('T')[0] : '');
        detailsSpan.textContent = `${s.durationMinutes || 25} دقيقة ${dateStr ? '— ' + dateStr : ''}`;

        item.appendChild(titleSpan);
        item.appendChild(detailsSpan);
        listDiv.appendChild(item);
    });

    container.appendChild(listDiv);
}

/**
 * قسم الملاحظات المرتبطة
 */
function renderNotesSection(subject, notes) {
    const container = document.getElementById('subject-notes-container');
    if (!container) return;

    container.innerHTML = '';

    if (notes.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'text-align: center; padding: 1.5rem 1rem; color: var(--text-muted); font-size: 0.95rem;';
        empty.textContent = 'لا توجد ملاحظات مرتبطة بهذه المادة حالياً.';
        container.appendChild(empty);
        return;
    }

    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.88rem;';

    notes.forEach(note => {
        const card = document.createElement('div');
        card.style.cssText = 'background: var(--surface-secondary); padding: 0.88rem; border-radius: 8px; border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between; gap: 0.5rem;';

        const top = document.createElement('div');
        const title = document.createElement('div');
        title.style.cssText = 'font-weight: 700; font-size: 0.95rem; color: var(--deep-ink); margin-bottom: 0.35rem;';
        title.textContent = note.title || 'ملاحظة بدون عنوان';

        const content = document.createElement('div');
        content.style.cssText = 'font-size: 0.85rem; color: var(--text-muted); line-height: 1.4; max-height: 3.6em; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;';
        content.textContent = note.content || note.text || '';

        top.appendChild(title);
        top.appendChild(content);

        const bottom = document.createElement('div');
        bottom.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed var(--border-color); font-size: 0.78rem; color: var(--text-muted);';

        const dateSpan = document.createElement('span');
        if (note.created) {
            try {
                dateSpan.textContent = new Date(note.created).toLocaleDateString('ar-SA');
            } catch (e) {
                dateSpan.textContent = '';
            }
        }

        const openLink = document.createElement('a');
        openLink.href = `notes.html?id=${encodeURIComponent(note.id)}`;
        openLink.className = 'btn btn-secondary btn-sm';
        openLink.style.cssText = 'padding: 0.2rem 0.5rem; font-size: 0.78rem;';
        openLink.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> عرض';

        bottom.appendChild(dateSpan);
        bottom.appendChild(openLink);

        card.appendChild(top);
        card.appendChild(bottom);
        grid.appendChild(card);
    });

    container.appendChild(grid);
}
