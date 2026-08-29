document.addEventListener('DOMContentLoaded', () => {
    function getToday() {
        if (typeof getTodayLocal === 'function') return getTodayLocal();
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function ensureTodayStats() {
        const today = getToday();
        const lastDay = localStorage.getItem('hayyiz-sessions-day');
        if (lastDay !== today) {
            localStorage.setItem('hayyiz-sessions-today', '0');
            localStorage.setItem('hayyiz-focus-minutes-today', '0');
            localStorage.setItem('hayyiz-sessions-day', today);
        }
    }

    ensureTodayStats();

    const today = getToday();

    // المصدر الوحيد للحقيقة للمهام والعادات والتركيز
    const todos = typeof hayyizGetTodos === 'function'
        ? hayyizGetTodos()
        : JSON.parse(localStorage.getItem('hayyiz-todos') || '[]');
    const habits = typeof hayyizGetHabits === 'function'
        ? hayyizGetHabits()
        : JSON.parse(localStorage.getItem('hayyiz-habits') || '[]');
    const sessionsToday = parseInt(localStorage.getItem('hayyiz-sessions-today') || '0', 10);
    const focusMinutes = parseInt(localStorage.getItem('hayyiz-focus-minutes-today') || '0', 10);

    const activeTodos = todos.filter((t) => t && !t.completed);
    const completedToday = todos.filter(
        (t) => t && t.completed && t.completedAt === today
    ).length;
    const completedAll = todos.filter((t) => t && t.completed).length;
    const overdueTodos = activeTodos.filter((t) => t.date && String(t.date).slice(0, 10) < today);
    const dueTodayTodos = activeTodos.filter((t) => t.date && String(t.date).slice(0, 10) === today);

    const habitTodaySummary = typeof hayyizGetHabitTodaySummary === 'function'
        ? hayyizGetHabitTodaySummary(habits)
        : (() => {
            const completed = habits.filter((h) => h && h.lastCompleted === today).length;
            const total = habits.length;
            return {
                total,
                completed,
                remaining: Math.max(0, total - completed),
                percent: total > 0 ? Math.round((completed / total) * 100) : 0
            };
        })();
    const habitsDoneToday = habitTodaySummary.completed;

    const hours = Math.floor(focusMinutes / 60);
    const mins = focusMinutes % 60;
    let timeText = '0 د';
    if (focusMinutes > 0) {
        timeText = hours > 0 ? `${hours}س ${mins}د` : `${mins} د`;
    }

    const hour = new Date().getHours();
    let greeting = 'مرحباً';
    if (hour < 12) greeting = 'صباح الخير';
    else greeting = 'مساء الخير';

    const dateLabel = new Date().toLocaleDateString('ar-SA', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });

    let recommendation = null;
    if (typeof hayyizRecommendNext === 'function') {
        recommendation = hayyizRecommendNext(5);
    }

    function getNextTasksFallback(list, limit) {
        const order = { high: 3, medium: 2, low: 1 };
        return list
            .filter((t) => t && !t.completed)
            .slice()
            .sort((a, b) => {
                const pDiff = (order[b.priority] || 0) - (order[a.priority] || 0);
                if (pDiff !== 0) return pDiff;
                const dateA = a.date ? new Date(a.date).getTime() : Infinity;
                const dateB = b.date ? new Date(b.date).getTime() : Infinity;
                if (dateA !== dateB) return dateA - dateB;
                return (b.created || 0) - (a.created || 0);
            })
            .slice(0, limit);
    }

    const nextTasks = recommendation
        ? recommendation.ranked.map((r) => r.task)
        : getNextTasksFallback(todos, 3);
    const nextTask = recommendation ? recommendation.next : (nextTasks[0] || null);
    const nextReason = recommendation ? recommendation.reason : '';
    const isTaskInProgress = recommendation ? recommendation.isInProgress : (nextTask && (parseInt(nextTask.focusDone, 10) || 0) > 0);

    const content = document.getElementById('summary-content');
    if (!content) return;

    function launchPomodoroForTask(task, index) {
        if (typeof hayyizLaunchPomodoro === 'function') {
            hayyizLaunchPomodoro(task, index);
            return;
        }
        const workMin = parseInt(localStorage.getItem('hayyiz-pref-work') || '25', 10) || 25;
        const totalMinutes = task.minutes ? parseInt(task.minutes, 10) : null;
        const plan = {
            text: task.text,
            id: task.id || null,
            index: index,
            subjectId: task.subjectId || null,
            totalMinutes: totalMinutes && totalMinutes > 0 ? totalMinutes : null,
            focusDone: task.focusDone ? parseInt(task.focusDone, 10) || 0 : 0,
            sessionsDone: task.sessionsDone ? parseInt(task.sessionsDone, 10) || 0 : 0,
            sessionsNeeded:
                totalMinutes && totalMinutes > 0
                    ? Math.ceil(totalMinutes / workMin)
                    : null
        };
        localStorage.setItem('hayyiz-current-task', task.text);
        if (task.id) localStorage.setItem('hayyiz-current-task-id', task.id);
        localStorage.setItem('hayyiz-current-task-index', String(index));
        localStorage.setItem('hayyiz-task-session', JSON.stringify(plan));
        window.location.href = 'pomodoro.html?task=' + encodeURIComponent(task.text);
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

    const priMap = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };

    content.replaceChildren();

    // ==========================================
    // 1. اليوم (Today Header)
    // ==========================================
    const greet = document.createElement('div');
    greet.className = 'dash-greeting';
    const greetTitle = document.createElement('h3');
    greetTitle.textContent = greeting + ' 👋';
    const greetDate = document.createElement('p');
    greetDate.textContent = dateLabel;
    greet.appendChild(greetTitle);
    greet.appendChild(greetDate);
    content.appendChild(greet);

    // ==========================================
    // 2. ما يحتاج انتباهي الآن (Needs Attention Now)
    // ==========================================
    const activeFocusState = typeof hayyizGetFocusState === 'function' ? hayyizGetFocusState() : null;
    if (activeFocusState && activeFocusState.status === 'running' && activeFocusState.remainingSeconds > 0) {
        const activeFocusBanner = document.createElement('div');
        activeFocusBanner.className = 'dash-attention-banner focus-running';

        const remMin = Math.floor(activeFocusState.remainingSeconds / 60);
        const remSec = activeFocusState.remainingSeconds % 60;
        const timeFormatted = `${String(remMin).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
        const ctxTitle = activeFocusState.context ? activeFocusState.context.title : 'جلسة تركيز';

        activeFocusBanner.innerHTML = `
            <div>
                <strong class="banner-title"><i class="fa-solid fa-play" aria-hidden="true"></i> جلسة تركيز قائمة الآن (${timeFormatted})</strong>
                <span class="banner-sub">${escapeHtml(ctxTitle)}</span>
            </div>
            <a href="pomodoro.html" class="btn btn-accent btn-sm">متابعة الجلسة</a>
        `;
        content.appendChild(activeFocusBanner);
    } else if (overdueTodos.length > 0) {
        const alertBox = document.createElement('div');
        alertBox.className = 'dash-attention-banner overdue-alert';
        alertBox.innerHTML = `
            <div>
                <strong class="banner-title"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> مهام متأخرة تحتاج الانتباه</strong>
                <span class="banner-sub">لديك ${overdueTodos.length} مهمة متأخرة عن موعد استحقاقها</span>
            </div>
            <a href="todo.html" class="btn btn-secondary btn-sm">عرض المهام</a>
        `;
        content.appendChild(alertBox);
    }

    // ==========================================
    // 3. الخطوة التالية (Next Action & Student OS Recommendation - Integrated, Human & Action-First)
    // ==========================================
    const suggestion = typeof hayyizEvaluateStudentState === 'function' ? hayyizEvaluateStudentState() : null;
    const nowCard = document.createElement('div');
    nowCard.className = 'dash-now-card card';

    const nowHead = document.createElement('div');
    nowHead.className = 'dash-now-header';
    const nowLabel = document.createElement('span');
    nowLabel.className = 'dash-now-label';
    nowLabel.innerHTML = '<i class="fa-solid fa-bullseye" aria-hidden="true"></i> الخطوة التالية';
    nowHead.appendChild(nowLabel);

    if (suggestion && suggestion.badge) {
        const sugBadge = document.createElement('span');
        sugBadge.className = 'dash-now-tag';
        sugBadge.textContent = suggestion.badge;
        nowHead.appendChild(sugBadge);
    }
    nowCard.appendChild(nowHead);

    if (suggestion && suggestion.text && suggestion.actionType) {
        // إذا وجد اقتراح ذكي مباشر من النظام
        const nowTitle = document.createElement('div');
        nowTitle.className = 'dash-now-title';
        nowTitle.textContent = suggestion.text;
        nowCard.appendChild(nowTitle);

        const nowActions = document.createElement('div');
        nowActions.className = 'dash-now-actions';

        const startBtn = document.createElement('button');
        startBtn.type = 'button';
        startBtn.className = 'btn btn-primary';
        startBtn.innerHTML = '<i class="fa-solid fa-play" aria-hidden="true"></i> ' + escapeHtml(suggestion.actionLabel || 'ابدأ التركيز');
        startBtn.addEventListener('click', () => {
            if (suggestion.actionType === 'pomo-task' && suggestion.task) {
                const idx = todos.indexOf(suggestion.task);
                launchPomodoroForTask(suggestion.task, idx >= 0 ? idx : 0);
            } else if (suggestion.actionType === 'pomo-event' && suggestion.event) {
                if (typeof hayyizLaunchPomodoro === 'function') {
                    hayyizLaunchPomodoro(suggestion.event);
                } else if (suggestion.url) {
                    window.location.href = suggestion.url;
                }
            } else if (suggestion.url) {
                window.location.href = suggestion.url;
            }
        });
        nowActions.appendChild(startBtn);

        const secondaryLink = document.createElement('a');
        secondaryLink.href = 'todo.html';
        secondaryLink.className = 'btn btn-secondary';
        secondaryLink.textContent = 'قائمة المهام';
        nowActions.appendChild(secondaryLink);

        nowCard.appendChild(nowActions);

    } else if (nextTask) {
        // إذا لم يوجد اقتراح استثنائي ولكن توجد مهمة قادمة
        const nowTitle = document.createElement('div');
        nowTitle.className = 'dash-now-title';
        nowTitle.textContent = nextTask.text;
        nowCard.appendChild(nowTitle);

        const metaParts = [];
        if (nextTask.priority) metaParts.push('أولوية ' + (priMap[nextTask.priority] || nextTask.priority));
        if (nextTask.subjectId && typeof hayyizGetSubjectName === 'function') {
            const sn = hayyizGetSubjectName(nextTask.subjectId);
            if (sn) metaParts.push(sn);
        }
        if (nextTask.minutes) {
            const done = nextTask.focusDone ? parseInt(nextTask.focusDone, 10) || 0 : 0;
            const total = parseInt(nextTask.minutes, 10) || 0;
            if (done > 0 && total > 0) metaParts.push(done + '/' + total + ' د');
            else metaParts.push(nextTask.minutes + ' د');
        }
        if (nextTask.date) {
            const d = String(nextTask.date).slice(0, 10);
            if (d < today) metaParts.push('متأخرة');
            else if (d === today) metaParts.push('اليوم');
            else metaParts.push(d);
        }

        const nowMeta = document.createElement('div');
        nowMeta.className = 'dash-now-meta';
        nowMeta.textContent = metaParts.join(' · ');
        nowCard.appendChild(nowMeta);

        if (nextReason) {
            const reasonEl = document.createElement('div');
            reasonEl.className = 'dash-now-reason';
            reasonEl.textContent = nextReason;
            nowCard.appendChild(reasonEl);
        }

        const nowActions = document.createElement('div');
        nowActions.className = 'dash-now-actions';

        const startNowBtn = document.createElement('button');
        startNowBtn.type = 'button';
        startNowBtn.className = 'btn btn-primary';
        startNowBtn.innerHTML = isTaskInProgress
            ? '<i class="fa-solid fa-play" aria-hidden="true"></i> استكمال جلسة التركيز'
            : '<i class="fa-solid fa-play" aria-hidden="true"></i> ابدأ جلسة تركيز';
        startNowBtn.addEventListener('click', () => {
            const idx = todos.indexOf(nextTask);
            launchPomodoroForTask(nextTask, idx >= 0 ? idx : 0);
        });
        nowActions.appendChild(startNowBtn);

        const openTodo = document.createElement('a');
        openTodo.href = 'todo.html';
        openTodo.className = 'btn btn-secondary';
        openTodo.textContent = 'اختر مهمة أخرى';
        nowActions.appendChild(openTodo);

        nowCard.appendChild(nowActions);

    } else {
        // حالة عدم وجود مهام
        const emptyTitle = document.createElement('div');
        emptyTitle.className = 'dash-now-title';
        emptyTitle.textContent = 'لا توجد مهام نشطة حالياً';
        nowCard.appendChild(emptyTitle);

        const emptyHint = document.createElement('p');
        emptyHint.className = 'dash-empty-text';
        emptyHint.textContent = 'أضف مهمة دراسية جديدة أو ابدأ جلسة تركيز حرة مباشرة.';
        nowCard.appendChild(emptyHint);

        const nowActions = document.createElement('div');
        nowActions.className = 'dash-now-actions';

        const startFree = document.createElement('button');
        startFree.type = 'button';
        startFree.className = 'btn btn-primary';
        startFree.innerHTML = '<i class="fa-solid fa-play" aria-hidden="true"></i> ابدأ جلسة تركيز';
        startFree.addEventListener('click', () => {
            if (typeof hayyizLaunchPomodoro === 'function') {
                hayyizLaunchPomodoro(null);
            } else {
                localStorage.removeItem('hayyiz-current-task');
                localStorage.removeItem('hayyiz-current-task-index');
                localStorage.removeItem('hayyiz-current-task-id');
                localStorage.removeItem('hayyiz-task-session');
                window.location.href = 'pomodoro.html';
            }
        });
        nowActions.appendChild(startFree);

        const addTask = document.createElement('a');
        addTask.href = 'todo.html';
        addTask.className = 'btn btn-secondary';
        addTask.textContent = 'إضافة مهمة';
        nowActions.appendChild(addTask);

        nowCard.appendChild(nowActions);
    }
    content.appendChild(nowCard);

    // ==========================================
    // 4. التقدم وخطة اليوم (Progress & Today's Plan)
    // ==========================================

    // أ) شريط إحصائيات اليوم (Stats Bar)
    const statsGrid = document.createElement('div');
    statsGrid.className = 'dash-stats-grid';

    function makeStatBox(icon, value, label, link) {
        const el = link ? document.createElement('a') : document.createElement('div');
        if (link) {
            el.href = link;
            el.className = 'dash-stat-card dash-stat-link';
        } else {
            el.className = 'dash-stat-card';
        }
        const ic = document.createElement('i');
        ic.className = icon;
        ic.setAttribute('aria-hidden', 'true');
        const val = document.createElement('strong');
        val.textContent = String(value);
        const lab = document.createElement('span');
        lab.textContent = label;
        el.appendChild(ic);
        el.appendChild(val);
        el.appendChild(lab);
        return el;
    }

    statsGrid.appendChild(makeStatBox('fa-solid fa-clock', sessionsToday, 'جلسات اليوم', 'pomodoro.html'));
    statsGrid.appendChild(makeStatBox('fa-solid fa-hourglass-half', timeText, 'وقت التركيز', 'pomodoro.html'));
    statsGrid.appendChild(makeStatBox('fa-solid fa-circle-check', completedToday, 'المنجز اليوم', 'todo.html'));
    statsGrid.appendChild(makeStatBox('fa-solid fa-list-check', activeTodos.length, 'المهام المتبقية', 'todo.html'));
    content.appendChild(statsGrid);

    // ب) خطة اليوم المدمجة (Integrated Daily Plan)
    const planItems = typeof hayyizGenerateDailyPlan === 'function' ? hayyizGenerateDailyPlan() : [];
    if (planItems && planItems.length > 0) {
        const planCard = document.createElement('div');
        planCard.className = 'dash-section card';

        const planHead = document.createElement('div');
        planHead.className = 'dash-section-head';

        const planTitle = document.createElement('h4');
        planTitle.innerHTML = '<i class="fa-solid fa-calendar-check" aria-hidden="true" style="color:var(--color-primary);"></i> خطة اليوم';

        const planLink = document.createElement('a');
        planLink.href = 'todo.html';
        planLink.textContent = 'إدارة الخطة';

        planHead.appendChild(planTitle);
        planHead.appendChild(planLink);
        planCard.appendChild(planHead);

        const planList = document.createElement('ul');
        planList.className = 'dash-plan-list';

        planItems.forEach((item) => {
            const li = document.createElement('li');
            li.className = 'dash-plan-item';

            const info = document.createElement('div');
            info.className = 'dash-plan-info';

            const badge = document.createElement('span');
            badge.className = 'dash-plan-badge ' + (item.badgeClass || '');
            badge.textContent = item.badge;

            const titleWrap = document.createElement('div');
            titleWrap.className = 'dash-plan-title-wrap';

            const icon = document.createElement('i');
            icon.className = item.icon || 'fa-solid fa-check';
            icon.setAttribute('aria-hidden', 'true');

            const title = document.createElement('strong');
            title.className = 'dash-plan-title';
            title.textContent = item.title;

            titleWrap.appendChild(icon);
            titleWrap.appendChild(title);

            const sub = document.createElement('span');
            sub.className = 'dash-plan-sub';
            sub.textContent = item.subtitle;

            info.appendChild(badge);
            info.appendChild(titleWrap);
            info.appendChild(sub);

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-secondary btn-sm';
            btn.textContent = item.actionLabel;
            btn.addEventListener('click', () => {
                if (item.actionType === 'pomo-task' && item.task) {
                    const idx = todos.indexOf(item.task);
                    launchPomodoroForTask(item.task, idx >= 0 ? idx : 0);
                } else if (item.actionType === 'pomo-event' && item.event) {
                    if (typeof hayyizLaunchPomodoro === 'function') {
                        hayyizLaunchPomodoro(item.event);
                    } else if (item.url) {
                        window.location.href = item.url;
                    }
                } else if (item.url) {
                    window.location.href = item.url;
                }
            });

            li.appendChild(info);
            li.appendChild(btn);
            planList.appendChild(li);
        });

        planCard.appendChild(planList);
        content.appendChild(planCard);
    }

    // ج) بطاقة الهدف والتقدم الدراسي (Academic Progress)
    const acadSummary = typeof hayyizGetAcademicSummary === 'function' ? hayyizGetAcademicSummary() : null;
    if (acadSummary && (acadSummary.current !== null || acadSummary.target !== null)) {
        const goalCard = document.createElement('div');
        goalCard.className = 'dash-card card';

        const goalHead = document.createElement('div');
        goalHead.className = 'dash-section-head';

        const goalHeadTitle = document.createElement('h4');
        goalHeadTitle.innerHTML = '<i class="fa-solid fa-bullseye" aria-hidden="true" style="color:var(--color-primary);"></i> الهدف والتقدم الدراسي';

        const gpaLink = document.createElement('a');
        gpaLink.href = 'gpa.html';
        gpaLink.textContent = acadSummary.target !== null ? 'تعديل الهدف' : 'حدد هدفك';

        goalHead.appendChild(goalHeadTitle);
        goalHead.appendChild(gpaLink);
        goalCard.appendChild(goalHead);

        const goalGrid = document.createElement('div');
        goalGrid.className = 'dash-card-grid';

        if (acadSummary.current !== null) {
            const curBox = document.createElement('div');
            curBox.className = 'dash-card-box';
            curBox.innerHTML = '<span style="font-size:0.8rem; color:var(--color-text-secondary); display:block;">المعدل الحالي</span>' +
                               '<strong style="font-size:1.25rem; color:var(--color-text);">' + acadSummary.current.toFixed(2) + '%</strong>';
            goalGrid.appendChild(curBox);
        }

        if (acadSummary.target !== null) {
            const tgtBox = document.createElement('div');
            tgtBox.className = 'dash-card-box';
            tgtBox.innerHTML = '<span style="font-size:0.8rem; color:var(--color-text-secondary); display:block;">الهدف المخطط</span>' +
                               '<strong style="font-size:1.25rem; color:var(--color-primary);">' + acadSummary.target.toFixed(2) + '%</strong>';
            goalGrid.appendChild(tgtBox);
        }

        if (acadSummary.current !== null && acadSummary.target !== null) {
            const pctVal = Math.min(100, Math.max(0, Math.round((acadSummary.current / acadSummary.target) * 100)));
            const pctBox = document.createElement('div');
            pctBox.className = 'dash-card-box';
            pctBox.innerHTML = '<span style="font-size:0.8rem; color:var(--color-text-secondary); display:block;">نسبة الإنجاز</span>' +
                               '<strong style="font-size:1.25rem; color:var(--color-success);">' + pctVal + '%</strong>';
            goalGrid.appendChild(pctBox);
        }

        goalCard.appendChild(goalGrid);

        if (acadSummary.current !== null && acadSummary.target !== null) {
            const pctVal = Math.min(100, Math.max(0, (acadSummary.current / acadSummary.target) * 100));
            const progWrap = document.createElement('div');
            progWrap.className = 'dash-progress-track';
            const progBar = document.createElement('div');
            progBar.className = 'dash-progress-fill';
            progBar.style.width = pctVal.toFixed(1) + '%';
            progWrap.appendChild(progBar);
            goalCard.appendChild(progWrap);

            const gapP = document.createElement('p');
            gapP.style.cssText = 'margin: 0; font-size: 0.9rem; color: var(--color-text); font-weight: 600;';
            if (acadSummary.gap > 0.009) {
                gapP.innerHTML = `المتبقي للوصول إلى الهدف: <strong>${acadSummary.gap.toFixed(2)} نقطة مئوية</strong>`;
            } else if (acadSummary.gap < -0.009) {
                gapP.innerHTML = `أنت أعلى من هدفك الحالي بـ <strong>${Math.abs(acadSummary.gap).toFixed(2)} نقطة مئوية</strong> 🎉`;
            } else {
                gapP.innerHTML = `وصلت إلى هدفك الدراسي تماماً 🎉`;
            }
            goalCard.appendChild(gapP);
        }

        content.appendChild(goalCard);
    }

    // د) تقويم الطالب والأحداث القادمة (Calendar & Countdown)
    if (typeof hayyizGetCalendarSummary === 'function') {
        const calSummary = hayyizGetCalendarSummary();
        const calCard = document.createElement('div');
        calCard.className = 'dash-section card';

        const calHead = document.createElement('div');
        calHead.className = 'dash-section-head';

        const calHeadTitle = document.createElement('h4');
        calHeadTitle.innerHTML = '<i class="fa-solid fa-calendar-days" aria-hidden="true" style="color:var(--color-primary);"></i> تقويم الطالب';

        const calLink = document.createElement('a');
        calLink.href = 'calculator.html';
        calLink.textContent = 'عرض التقويم';

        calHead.appendChild(calHeadTitle);
        calHead.appendChild(calLink);
        calCard.appendChild(calHead);

        const eventBox = document.createElement('div');
        eventBox.className = 'dash-card-box';
        eventBox.style.textAlign = 'right';

        if (calSummary.nearestEvent) {
            const ev = calSummary.nearestEvent;
            const now = new Date();
            const todayStr = getToday();

            let statusBadge = '';
            let countdownStr = '';

            if (ev.time) {
                const target = new Date(`${ev.date}T${ev.time}:00`);
                const diffMs = target.getTime() - now.getTime();
                if (diffMs > 0) {
                    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
                    const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    const remHours = totalHours % 24;

                    if (totalDays > 0) {
                        countdownStr = remHours > 0 ? `بعد ${totalDays} يوم و ${remHours} ساعة` : `بعد ${totalDays} يومًا`;
                    } else {
                        const remMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                        countdownStr = totalHours > 0 ? `بعد ${totalHours} ساعة و ${remMinutes} دقيقة` : `بعد ${remMinutes} دقيقة`;
                    }
                    statusBadge = '<span class="dash-now-tag">قادم</span>';
                } else {
                    countdownStr = 'اليوم';
                    statusBadge = '<span class="dash-now-tag">اليوم</span>';
                }
            } else {
                const t0 = new Date(`${todayStr}T00:00:00`).getTime();
                const t1 = new Date(`${ev.date}T00:00:00`).getTime();
                const diffDays = Math.round((t1 - t0) / (1000 * 60 * 60 * 24));

                if (diffDays > 0) {
                    countdownStr = `بعد ${diffDays} يومًا`;
                    statusBadge = '<span class="dash-now-tag">قادم</span>';
                } else {
                    countdownStr = 'اليوم';
                    statusBadge = '<span class="dash-now-tag">اليوم</span>';
                }
            }

            const typeLabel = ev.type === 'exam' ? 'اختبار' : (ev.type === 'personal' ? 'موعد شخصي' : 'حدث مخصص');
            let dateStrFormatted = ev.date;
            if (ev.time) dateStrFormatted += ` (${ev.time})`;

            eventBox.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.35rem;">
                    <strong style="font-size: 1rem; color: var(--color-text);">${escapeHtml(ev.name)}</strong>
                    ${statusBadge}
                </div>
                <div style="font-size: 0.85rem; color: var(--color-text-secondary); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.4rem;">
                    <span><i class="fa-regular fa-calendar"></i> ${dateStrFormatted} · ${typeLabel}</span>
                    <strong style="color: var(--color-primary); font-size: 0.95rem;">${countdownStr}</strong>
                </div>
            `;
        } else {
            eventBox.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap;">
                    <span style="font-size: 0.9rem; color: var(--color-text-secondary);"><i class="fa-regular fa-calendar-xmark"></i> لا توجد اختبارات قادمة</span>
                    <a href="calculator.html" style="font-size: 0.85rem; color: var(--color-primary); font-weight: 700; text-decoration: none;">+ إضافة موعد</a>
                </div>
            `;
        }
        calCard.appendChild(eventBox);

        // العمر الاختياري
        if (calSummary.birthdate && calSummary.ageInfo) {
            const ageBox = document.createElement('div');
            ageBox.style.cssText = 'padding: 0.75rem 0.85rem; background: var(--color-surface); border-radius: var(--radius-sm); border: 1px solid var(--color-border); font-size: 0.88rem; margin-top: 0.75rem;';

            if (calSummary.showAgePref === 'true') {
                const age = calSummary.ageInfo;
                let ageStr = `عمرك الحالي: <strong>${age.years} سنة و ${age.months} شهر و ${age.days} يوم</strong>`;
                if (!age.is18OrOlder && age.status18) {
                    const st = age.status18;
                    let remStr = '';
                    if (st.years > 0) remStr += `${st.years} سنة `;
                    if (st.months > 0) remStr += `و ${st.months} شهر `;
                    if (st.days > 0 || (!st.years && !st.months)) remStr += `و ${st.days} يوم`;
                    remStr = remStr.trim().replace(/^و\s*/, '');
                    ageStr += `<div style="margin-top:0.3rem; color: var(--color-text-secondary); font-size: 0.82rem;">متبقي على 18 عاماً: <strong>${remStr}</strong></div>`;
                }

                ageBox.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                        <div><i class="fa-solid fa-cake-candles" style="color:var(--color-primary);"></i> ${ageStr}</div>
                        <button type="button" id="hide-age-dash-btn" style="background: none; border: none; color: var(--color-text-secondary); font-size: 0.78rem; cursor: pointer; text-decoration: underline;">إخفاء</button>
                    </div>
                `;
                calCard.appendChild(ageBox);

                setTimeout(() => {
                    const hideBtn = document.getElementById('hide-age-dash-btn');
                    if (hideBtn) {
                        hideBtn.addEventListener('click', () => {
                            localStorage.setItem('hayyiz-show-age-in-dashboard', 'false');
                            window.location.reload();
                        });
                    }
                }, 0);

            } else if (calSummary.showAgePref === 'false') {
                ageBox.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                        <span style="color: var(--color-text-secondary);"><i class="fa-solid fa-cake-candles"></i> معلومات العمر مخفية</span>
                        <button type="button" id="show-age-dash-btn" style="background: none; border: none; color: var(--color-primary); font-weight: 600; font-size: 0.82rem; cursor: pointer;">عرض عمري</button>
                    </div>
                `;
                calCard.appendChild(ageBox);

                setTimeout(() => {
                    const showBtn = document.getElementById('show-age-dash-btn');
                    if (showBtn) {
                        showBtn.addEventListener('click', () => {
                            localStorage.setItem('hayyiz-show-age-in-dashboard', 'true');
                            window.location.reload();
                        });
                    }
                }, 0);

            } else {
                ageBox.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <span>هل تريد عرض عمرك في الملخص اليومي؟</span>
                        <div style="display: flex; gap: 0.5rem;">
                            <button type="button" id="accept-show-age-btn" class="btn btn-primary btn-sm">عرض عمري</button>
                            <button type="button" id="decline-show-age-btn" class="btn btn-secondary btn-sm">ليس الآن</button>
                        </div>
                    </div>
                `;
                calCard.appendChild(ageBox);

                setTimeout(() => {
                    const accBtn = document.getElementById('accept-show-age-btn');
                    const decBtn = document.getElementById('decline-show-age-btn');
                    if (accBtn) {
                        accBtn.addEventListener('click', () => {
                            localStorage.setItem('hayyiz-show-age-in-dashboard', 'true');
                            window.location.reload();
                        });
                    }
                    if (decBtn) {
                        decBtn.addEventListener('click', () => {
                            localStorage.setItem('hayyiz-show-age-in-dashboard', 'false');
                            window.location.reload();
                        });
                    }
                }, 0);
            }
        }
        content.appendChild(calCard);
    }

    // هـ) العادات اليومية (Habits Progress)
    const habitsCard = document.createElement('a');
    habitsCard.className = 'dash-card card dash-habits-card';
    habitsCard.href = 'habits.html';

    const habitsHead = document.createElement('div');
    habitsHead.className = 'dash-section-head';
    const habitsTitle = document.createElement('h4');
    habitsTitle.innerHTML = '<i class="fa-solid fa-fire" aria-hidden="true" style="color:var(--color-primary);"></i> العادات الدراسية';
    const habitsAction = document.createElement('span');
    habitsAction.textContent = habits.length > 0 ? 'عرض العادات' : 'أضف عادة';
    habitsHead.appendChild(habitsTitle);
    habitsHead.appendChild(habitsAction);
    habitsCard.appendChild(habitsHead);

    const habitsRow = document.createElement('div');
    habitsRow.className = 'dash-habits-row';
    const habitsCount = document.createElement('strong');
    habitsCount.textContent = habitTodaySummary.completed + ' / ' + habitTodaySummary.total + ' مكتملة';
    const habitsPct = document.createElement('span');
    habitsPct.textContent = habitTodaySummary.percent + '% من أهداف اليوم';
    habitsRow.appendChild(habitsCount);
    habitsRow.appendChild(habitsPct);
    habitsCard.appendChild(habitsRow);

    const habitsProgWrap = document.createElement('div');
    habitsProgWrap.className = 'dash-progress-track';
    const habitsProg = document.createElement('div');
    habitsProg.className = 'dash-progress-fill';
    habitsProg.style.width = habitTodaySummary.percent + '%';
    habitsProgWrap.appendChild(habitsProg);
    habitsCard.appendChild(habitsProgWrap);

    content.appendChild(habitsCard);

    // و) تركيز الأسبوع والإحصائيات الخاصة بالمواد (Weekly Focus & Subjects Breakdown)
    try {
        const hist = JSON.parse(localStorage.getItem('hayyiz-focus-history') || '{}');
        if (focusMinutes > 0) {
            hist[today] = Math.max(parseInt(hist[today], 10) || 0, focusMinutes);
        }
        const dayNames = ['الاحد', 'الاثنين', 'الثلاثاء', 'الاربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const weekSection = document.createElement('div');
        weekSection.className = 'dash-section card';

        const weekHead = document.createElement('div');
        weekHead.className = 'dash-section-head';
        const weekTitle = document.createElement('h4');
        weekTitle.innerHTML = '<i class="fa-solid fa-chart-column" aria-hidden="true" style="color:var(--color-primary);"></i> تركيز الأسبوع';
        weekHead.appendChild(weekTitle);
        weekSection.appendChild(weekHead);

        const bars = document.createElement('div');
        bars.className = 'dash-week-bars';
        let maxVal = 1;
        const days = [];
        let totalWeekMinutesFromHist = 0;

        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const key = `${y}-${m}-${dd}`;
            const val = parseInt(hist[key], 10) || 0;
            totalWeekMinutesFromHist += val;
            if (val > maxVal) maxVal = val;
            days.push({ key, val, name: dayNames[d.getDay()], isToday: key === today });
        }

        days.forEach((day) => {
            const col = document.createElement('div');
            col.className = 'dash-week-col' + (day.isToday ? ' today' : '');
            const bar = document.createElement('div');
            bar.className = 'dash-week-bar';
            const pct = Math.round((day.val / maxVal) * 100);
            bar.style.height = Math.max(4, pct) + '%';
            bar.title = day.val + ' دقيقة';
            const label = document.createElement('span');
            label.textContent = day.name.slice(0, 3);
            const valEl = document.createElement('span');
            valEl.className = 'dash-week-val';
            valEl.textContent = day.val > 0 ? day.val + 'د' : '';
            col.appendChild(valEl);
            col.appendChild(bar);
            col.appendChild(label);
            bars.appendChild(col);
        });
        weekSection.appendChild(bars);

        // إحصائيات توزيع وقت المذاكرة حسب المواد هذا الأسبوع (Safely rendered textContent)
        if (typeof hayyizGetWeeklySubjectStats === 'function') {
            const subStats = hayyizGetWeeklySubjectStats();
            const grandTotal = Math.max(subStats.totalMinutes, totalWeekMinutesFromHist);

            if (grandTotal > 0 || subStats.subjects.length > 0) {
                const subBox = document.createElement('div');
                subBox.style.cssText = 'margin-top: 1rem; padding-top: 0.85rem; border-top: 1px solid var(--color-border);';

                if (subStats.subjects.length > 0) {
                    const topSub = subStats.subjects[0];
                    const insightP = document.createElement('p');
                    insightP.style.cssText = 'margin: 0 0 0.6rem; font-size: 0.88rem; color: var(--color-text-secondary);';
                    insightP.textContent = `قضيت ${topSub.percentage}% من وقت مذاكرتك الموزّع على المواد هذا الأسبوع على ${topSub.name} (${topSub.minutes} دقيقة).`;
                    subBox.appendChild(insightP);

                    const subList = document.createElement('div');
                    subList.style.cssText = 'display: flex; flex-wrap: wrap; gap: 0.5rem;';
                    subStats.subjects.forEach((s) => {
                        const tag = document.createElement('span');
                        tag.className = 'dash-subject-tag';
                        tag.textContent = `${s.name}: ${s.percentage}% — ${s.minutes} دقيقة`;
                        subList.appendChild(tag);
                    });
                    subBox.appendChild(subList);
                }
                weekSection.appendChild(subBox);
            }
        }

        content.appendChild(weekSection);
    } catch (e) {
        /* تجاهل */
    }

    // ==========================================
    // 5. الأدوات (Tools Quick Grid)
    // ==========================================
    const quickSection = document.createElement('div');
    quickSection.className = 'dash-section';

    const quickHead = document.createElement('div');
    quickHead.className = 'dash-section-head';
    const quickTitle = document.createElement('h4');
    quickTitle.textContent = 'أدوات حيز';
    quickHead.appendChild(quickTitle);
    quickSection.appendChild(quickHead);

    const quick = document.createElement('div');
    quick.className = 'dash-quick';

    const shortcuts = [
        { href: 'pomodoro.html', icon: 'fa-solid fa-stopwatch', label: 'المؤقت' },
        { href: 'todo.html', icon: 'fa-solid fa-list-check', label: 'المهام' },
        { href: 'notes.html', icon: 'fa-solid fa-note-sticky', label: 'الملاحظات' },
        { href: 'gpa.html', icon: 'fa-solid fa-calculator', label: 'المعدل' },
        { href: 'habits.html', icon: 'fa-solid fa-fire', label: 'العادات' },
        { href: 'calculator.html', icon: 'fa-solid fa-calendar-days', label: 'التقويم' }
    ];

    shortcuts.forEach((s) => {
        const a = document.createElement('a');
        a.href = s.href;
        a.className = 'dash-quick-item';
        a.innerHTML = `<i class="${s.icon}" aria-hidden="true"></i><span>${s.label}</span>`;
        quick.appendChild(a);
    });
    quickSection.appendChild(quick);
    content.appendChild(quickSection);

    const startBtn = document.getElementById('start-focus-session-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (nextTask) {
                const idx = todos.indexOf(nextTask);
                launchPomodoroForTask(nextTask, idx >= 0 ? idx : 0);
            } else if (typeof hayyizLaunchPomodoro === 'function') {
                hayyizLaunchPomodoro(null);
            } else {
                localStorage.removeItem('hayyiz-current-task');
                localStorage.removeItem('hayyiz-current-task-index');
                localStorage.removeItem('hayyiz-current-task-id');
                localStorage.removeItem('hayyiz-task-session');
                window.location.href = 'pomodoro.html';
            }
        });
    }
});