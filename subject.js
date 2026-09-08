/**
 * subject.js — صفحة المادة المركزية في منصة حيز (Subject Hub)
 */

if (typeof document !== 'undefined' && document.documentElement) {
    try {
        if (localStorage.getItem('hayyiz-theme') === 'dark') {
            document.documentElement.classList.add('theme-dark');
        }
    } catch (e) {}
}

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

/**
 * دالة نقية ومعزولة لتجميع ومعالجة كافة بيانات المادة
 * @param {string} subjectId - المعرف الوحيد للمادة
 * @param {Object} rawData - كائن يحتوي على القوائم الخام: { subjects, todos, exams, focusSessions, notes, goals }
 * @returns {Object|null}
 */
function getSubjectHubData(subjectId, rawData) {
    if (!subjectId || !rawData) return null;

    const subjects = Array.isArray(rawData.subjects) ? rawData.subjects : [];
    const todos = Array.isArray(rawData.todos) ? rawData.todos : [];
    const exams = Array.isArray(rawData.exams) ? rawData.exams : [];
    const focusSessions = Array.isArray(rawData.focusSessions) ? rawData.focusSessions : [];
    const notes = Array.isArray(rawData.notes) ? rawData.notes : [];
    const goals = Array.isArray(rawData.goals) ? rawData.goals : [];

    // 1. المطابقة الدقيقة للمادة عبر ID
    let subject = subjects.find(s => s && String(s.id) === String(subjectId)) || null;
    if (!subject) {
        // Fallback توافقي عند تمرير اسم المادة بالخطأ في URL
        subject = subjects.find(s => s && s.name === String(subjectId).trim()) || null;
    }
    if (!subject) return null;

    // 2. تصفية المهام المخصصة للمادة
    const subjectTasks = todos.filter(t => t && String(t.subjectId) === String(subject.id));
    const openTasks = subjectTasks.filter(t => !t.completed && !t.done);
    const completedTasks = subjectTasks.filter(t => t.completed || t.done);

    // 3. تصفية الاختبارات والتمييز بين القادمة والسابقة
    const subjectExams = exams.filter(e => {
        if (!e) return false;
        if (e.subjectId) return String(e.subjectId) === String(subject.id);
        if (!e.subjectId && e.subject) return e.subject === subject.name;
        return false;
    });

    const todayStr = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().split('T')[0];
    const upcomingExams = [];
    const pastExams = [];

    subjectExams.forEach(e => {
        if (!e.date) return;
        if (e.date >= todayStr) {
            upcomingExams.push(e);
        } else {
            pastExams.push(e);
        }
    });

    upcomingExams.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
    pastExams.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    const nearestExam = upcomingExams.length > 0 ? upcomingExams[0] : null;

    // 4. تصفية وحساب جلسات التركيز للمادة
    const subjectTaskIds = new Set(subjectTasks.map(t => String(t.id)));
    const matchingSessions = focusSessions.filter(s => {
        if (!s) return false;
        const snap = s.contextSnapshot;
        if (snap) {
            if (snap.subjectId && String(snap.subjectId) === String(subject.id)) return true;
            if (snap.type === 'task' && snap.id && subjectTaskIds.has(String(snap.id))) return true;
        }
        if (s.subjectId && String(s.subjectId) === String(subject.id)) return true;
        return false;
    });

    matchingSessions.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : (a.date ? new Date(a.date).getTime() : 0);
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : (b.date ? new Date(b.date).getTime() : 0);
        return timeB - timeA;
    });

    let totalMinutes = parseInt(subject.focusMinutes, 10) || 0;
    let totalSessions = parseInt(subject.sessions, 10) || 0;

    let logMin = 0;
    matchingSessions.forEach(s => {
        logMin += parseInt(s.durationMinutes, 10) || 0;
    });

    if (logMin > totalMinutes) totalMinutes = logMin;
    if (matchingSessions.length > totalSessions) totalSessions = matchingSessions.length;

    // 5. تصفية الملاحظات (أولوية: note.subjectId ثم relatedTaskId -> task.subjectId ثم legacy subject name)
    const subjectNotes = notes.filter(n => {
        if (!n) return false;
        if (n.subjectId && String(n.subjectId) === String(subject.id)) return true;
        if (n.relatedTaskId && subjectTaskIds.has(String(n.relatedTaskId))) return true;
        if (!n.subjectId && !n.relatedTaskId && n.subject && n.subject === subject.name) return true;
        return false;
    });

    // 6. الأهداف الأكاديمية (أولوية: subjectId أو name المطابق واسم المادة)
    const goal = goals.find(g => g && (String(g.subjectId) === String(subject.id) || g.name === subject.name)) || null;

    // 7. تحديد "ما يحتاج انتباهك الآن" (Attention Item)
    let attentionItem = null;

    if (nearestExam) {
        const daysUntil = typeof hayyizDaysUntil === 'function' ? hayyizDaysUntil(nearestExam.date) : null;
        if (daysUntil !== null && daysUntil <= 3 && daysUntil >= 0) {
            attentionItem = {
                type: 'exam',
                exam: nearestExam,
                daysUntil,
                title: nearestExam.name || nearestExam.title || 'اختبار قريب',
                subtitle: daysUntil === 0 ? 'الاختبار اليوم! خذ جلسة مراجعة مركزة الآن' : (daysUntil === 1 ? 'الاختبار غداً! أكمل مراجعتك الأخيرة' : `متبقي ${daysUntil} أيام على موعد الاختبار`)
            };
        }
    }

    if (!attentionItem && openTasks.length > 0) {
        const highTask = openTasks.find(t => t.priority === 'high') || openTasks[0];
        attentionItem = {
            type: 'task',
            task: highTask,
            title: highTask.text || highTask.title || 'مهمة دراسية',
            subtitle: highTask.priority === 'high' ? 'مهمة عالية الأولوية بحاجة لإنجاز' : 'المهمة القادمة المقترحة في هذه المادة'
        };
    }

    return {
        subject,
        openTasks,
        completedTasks,
        upcomingExams,
        pastExams,
        nearestExam,
        focusMinutes: totalMinutes,
        focusSessionsCount: totalSessions,
        recentFocusSessions: matchingSessions.slice(0, 5),
        notes: subjectNotes,
        goal,
        attentionItem
    };
}

function initSubjectPage() {
    const notFoundEl = document.getElementById('subject-not-found');
    const contentEl = document.getElementById('subject-content');

    if (!notFoundEl || !contentEl) return;

    const urlParams = new URLSearchParams(window.location.search);
    const subjectId = urlParams.get('id');

    const subjects = typeof hayyizGetSubjects === 'function' ? hayyizGetSubjects() : [];
    const todos = typeof hayyizGetTodos === 'function' ? hayyizGetTodos() : [];
    const exams = typeof hayyizGetExams === 'function' ? hayyizGetExams() : [];
    const focusSessions = typeof hayyizGetFocusSessions === 'function' ? hayyizGetFocusSessions() : [];

    let rawNotes = [];
    try {
        const parsed = JSON.parse(localStorage.getItem('hayyiz-notes') || '[]');
        rawNotes = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        rawNotes = [];
    }

    const goals = typeof hayyizGetSubjectGoals === 'function' ? hayyizGetSubjectGoals() : [];

    const hubData = getSubjectHubData(subjectId, {
        subjects,
        todos,
        exams,
        focusSessions,
        notes: rawNotes,
        goals
    });

    if (!hubData) {
        showNotFoundState(subjects);
        return;
    }

    notFoundEl.style.display = 'none';
    contentEl.style.display = 'block';

    const { subject, openTasks, completedTasks, upcomingExams, pastExams, nearestExam, focusMinutes, focusSessionsCount, recentFocusSessions, notes, goal, attentionItem } = hubData;

    document.title = `${subject.name} | صفحة المادة | حيز`;

    const headingEl = document.getElementById('subject-name-heading');
    if (headingEl) headingEl.textContent = subject.name;

    const addBtn = document.getElementById('btn-add-subject-task');
    if (addBtn) addBtn.href = `todo.html?subjectId=${encodeURIComponent(subject.id)}`;

    const focusBtn = document.getElementById('btn-focus-subject');
    if (focusBtn) focusBtn.href = `pomodoro.html?subjectId=${encodeURIComponent(subject.id)}`;

    const statOpenTasks = document.getElementById('stat-open-tasks');
    if (statOpenTasks) statOpenTasks.textContent = openTasks.length;

    const statFocusTime = document.getElementById('stat-focus-time');
    if (statFocusTime) statFocusTime.textContent = `${focusMinutes} دقيقة`;

    const statFocusSessions = document.getElementById('stat-focus-sessions');
    if (statFocusSessions) statFocusSessions.textContent = `${focusSessionsCount} جلسة`;

    const statNearestExam = document.getElementById('stat-nearest-exam');
    if (statNearestExam) {
        if (nearestExam) {
            const daysUntil = typeof hayyizDaysUntil === 'function' ? hayyizDaysUntil(nearestExam.date) : null;
            let label = nearestExam.name || nearestExam.title || 'اختبار';
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

    renderAttentionHero(subject, attentionItem);
    renderGoalSection(subject, goal);
    renderTasksSection(subject, openTasks, completedTasks);
    renderExamsSection(subject, upcomingExams, pastExams);
    renderFocusSection(subject, recentFocusSessions, focusMinutes, focusSessionsCount);
    renderNotesSection(subject, notes);
}

function showNotFoundState(subjects) {
    const notFoundEl = document.getElementById('subject-not-found');
    const contentEl = document.getElementById('subject-content');
    const availableContainer = document.getElementById('available-subjects-container');

    if (notFoundEl) notFoundEl.style.display = 'block';
    if (contentEl) contentEl.style.display = 'none';

    if (availableContainer) {
        availableContainer.textContent = '';
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
 * قسم "ما يحتاج انتباهك الآن"
 */
function renderAttentionHero(subject, attentionItem) {
    const container = document.getElementById('attention-hero-container');
    if (!container) return;

    container.textContent = '';
    if (!attentionItem) return;

    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'background: var(--surface-secondary); border-right: 4px solid var(--terracotta); padding: 1.25rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;';

    const left = document.createElement('div');
    const badge = document.createElement('div');
    badge.style.cssText = 'font-size: 0.8rem; font-weight: 700; color: var(--terracotta); margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.4rem;';

    const icon = document.createElement('i');
    icon.className = attentionItem.type === 'exam' ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-bullseye';
    badge.appendChild(icon);

    const badgeText = document.createElement('span');
    badgeText.textContent = 'ما يحتاج انتباهك الآن';
    badge.appendChild(badgeText);

    const title = document.createElement('div');
    title.style.cssText = 'font-size: 1.1rem; font-weight: 800; color: var(--deep-ink); margin-bottom: 0.2rem;';
    title.textContent = attentionItem.title;

    const subtitle = document.createElement('div');
    subtitle.style.cssText = 'font-size: 0.88rem; color: var(--text-muted);';
    subtitle.textContent = attentionItem.subtitle;

    left.appendChild(badge);
    left.appendChild(title);
    left.appendChild(subtitle);

    const right = document.createElement('div');
    if (attentionItem.type === 'exam') {
        const focusBtn = document.createElement('a');
        focusBtn.href = `pomodoro.html?subjectId=${encodeURIComponent(subject.id)}`;
        focusBtn.className = 'btn btn-primary btn-sm';
        focusBtn.textContent = 'بدء مراجعة مركزة';
        right.appendChild(focusBtn);
    } else if (attentionItem.type === 'task' && attentionItem.task) {
        const focusTaskBtn = document.createElement('a');
        focusTaskBtn.href = `pomodoro.html?taskId=${encodeURIComponent(attentionItem.task.id)}`;
        focusTaskBtn.className = 'btn btn-primary btn-sm';
        focusTaskBtn.textContent = 'بدء تركيز للمهمة';
        right.appendChild(focusTaskBtn);
    }

    card.appendChild(left);
    card.appendChild(right);
    container.appendChild(card);
}

function renderGoalSection(subject, goal) {
    const wrapper = document.getElementById('goal-section-wrapper');
    const container = document.getElementById('goal-content');
    if (!wrapper || !container) return;

    if (!goal) {
        wrapper.style.display = 'none';
        return;
    }

    wrapper.style.display = 'block';
    container.textContent = '';

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
        container.textContent = '';
        const listToRender = currentActiveTaskTab === 'open' ? openTasks : doneTasks;

        if (listToRender.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'text-align: center; padding: 2rem 1rem; color: var(--text-muted); font-size: 0.95rem;';

            const p = document.createElement('p');
            p.style.margin = '0 0 1rem 0';
            p.textContent = currentActiveTaskTab === 'open' ? 'لا توجد مهام مفتوحة لهذه المادة حالياً.' : 'لا توجد مهام مكتملة لهذه المادة.';
            empty.appendChild(p);

            if (currentActiveTaskTab === 'open') {
                const addLink = document.createElement('a');
                addLink.href = `todo.html?subjectId=${encodeURIComponent(subject.id)}`;
                addLink.className = 'btn btn-secondary btn-sm';
                addLink.textContent = 'أضف أول مهمة للمادة';
                empty.appendChild(addLink);
            }

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

            const checkIcon = document.createElement('i');
            checkIcon.className = task.completed || task.done ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle';
            checkIcon.style.cssText = `font-size: 1.1rem; color: ${task.completed || task.done ? 'var(--primary)' : 'var(--text-muted)'}; cursor: pointer;`;

            // إمكانية التبديل السريع لحالة الإكمال
            checkIcon.addEventListener('click', () => {
                if (typeof hayyizToggleTodoComplete === 'function') {
                    hayyizToggleTodoComplete(task.id);
                } else if (typeof hayyizUpdateTask === 'function') {
                    hayyizUpdateTask(task.id, { completed: !(task.completed || task.done), updated: Date.now() });
                }
                initSubjectPage();
            });

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

            const actionsDiv = document.createElement('div');
            actionsDiv.style.cssText = 'display: flex; gap: 0.5rem; align-items: center;';

            const openLink = document.createElement('a');
            openLink.href = `todo.html?id=${encodeURIComponent(task.id)}`;
            openLink.className = 'btn btn-secondary btn-sm';
            openLink.textContent = 'عرض';

            if (!task.completed && !task.done) {
                const focusLink = document.createElement('a');
                focusLink.href = `pomodoro.html?taskId=${encodeURIComponent(task.id)}`;
                focusLink.className = 'btn btn-primary btn-sm';
                focusLink.textContent = 'تركيز';
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

function renderExamsSection(subject, upcomingExams, pastExams) {
    const container = document.getElementById('subject-exams-container');
    if (!container) return;

    container.textContent = '';

    if (!upcomingExams || upcomingExams.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'text-align: center; padding: 1.5rem 1rem; color: var(--text-muted); font-size: 0.95rem;';

        const p = document.createElement('p');
        p.style.margin = '0 0 1rem 0';
        p.textContent = 'لا توجد اختبارات قادمة مسجلة لهذه المادة.';
        empty.appendChild(p);

        const calLink = document.createElement('a');
        calLink.href = 'calculator.html';
        calLink.className = 'btn btn-secondary btn-sm';
        calLink.textContent = 'افتح التقويم لإضافة اختبار';
        empty.appendChild(calLink);

        container.appendChild(empty);
        return;
    }

    const listDiv = document.createElement('div');
    listDiv.style.cssText = 'display: flex; flex-direction: column; gap: 0.75rem;';

    upcomingExams.forEach(exam => {
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

            const daysUntil = typeof hayyizDaysUntil === 'function' ? hayyizDaysUntil(exam.date) : null;
            if (daysUntil !== null) {
                const daysSpan = document.createElement('span');
                daysSpan.style.fontWeight = '600';
                daysSpan.style.color = daysUntil <= 2 ? 'var(--terracotta)' : 'var(--primary)';
                if (daysUntil === 0) daysSpan.textContent = ' (اليوم)';
                else if (daysUntil === 1) daysSpan.textContent = ' (غداً)';
                else if (daysUntil > 1) daysSpan.textContent = ` (متبقي ${daysUntil} أيام)`;
                meta.appendChild(daysSpan);
            }
        }

        infoDiv.appendChild(title);
        infoDiv.appendChild(meta);

        const actionsDiv = document.createElement('div');
        const calLink = document.createElement('a');
        calLink.href = 'calculator.html';
        calLink.className = 'btn btn-secondary btn-sm';
        calLink.textContent = 'فتح التقويم';

        actionsDiv.appendChild(calLink);

        card.appendChild(infoDiv);
        card.appendChild(actionsDiv);
        listDiv.appendChild(card);
    });

    container.appendChild(listDiv);
}

function renderFocusSection(subject, recentSessions, totalMin, totalCount) {
    const container = document.getElementById('subject-focus-container');
    if (!container) return;

    container.textContent = '';

    const summaryBox = document.createElement('div');
    summaryBox.style.cssText = 'background: var(--surface-secondary); padding: 0.88rem 1rem; border-radius: 8px; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;';

    const sumText = document.createElement('div');
    sumText.style.cssText = 'font-size: 0.9rem; color: var(--deep-ink); font-weight: 600;';
    sumText.textContent = `المجموع الكلي: ${totalMin} دقيقة تركيز عبر ${totalCount} جلسة.`;

    const startLink = document.createElement('a');
    startLink.href = `pomodoro.html?subjectId=${encodeURIComponent(subject.id)}`;
    startLink.className = 'btn btn-primary btn-sm';
    startLink.textContent = 'بدء جلسة جديدة';

    summaryBox.appendChild(sumText);
    summaryBox.appendChild(startLink);
    container.appendChild(summaryBox);

    if (!recentSessions || recentSessions.length === 0) {
        const empty = document.createElement('p');
        empty.style.cssText = 'text-align: center; color: var(--text-muted); font-size: 0.9rem; margin: 1rem 0;';
        empty.textContent = 'لم يتم تسجيل جلسات تركيز مخصصة لهذه المادة مؤخرًا.';
        container.appendChild(empty);
        return;
    }

    const listDiv = document.createElement('div');
    listDiv.style.cssText = 'display: flex; flex-direction: column; gap: 0.5rem;';

    recentSessions.forEach(s => {
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

function renderNotesSection(subject, notes) {
    const container = document.getElementById('subject-notes-container');
    if (!container) return;

    container.textContent = '';

    if (notes.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'text-align: center; padding: 1.5rem 1rem; color: var(--text-muted); font-size: 0.95rem;';

        const p = document.createElement('p');
        p.style.margin = '0 0 1rem 0';
        p.textContent = 'لا توجد ملاحظات مرتبطة بهذه المادة حالياً.';
        empty.appendChild(p);

        const noteLink = document.createElement('a');
        noteLink.href = 'notes.html';
        noteLink.className = 'btn btn-secondary btn-sm';
        noteLink.textContent = 'اكتب ملاحظة جديدة';
        empty.appendChild(noteLink);

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
        openLink.textContent = 'عرض';

        bottom.appendChild(dateSpan);
        bottom.appendChild(openLink);

        card.appendChild(top);
        card.appendChild(bottom);
        grid.appendChild(card);
    });

    container.appendChild(grid);
}
