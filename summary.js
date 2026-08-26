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

    // المصدر الوحيد للحقيقة للمهام: hayyizGetTodos()
    const todos = typeof hayyizGetTodos === 'function'
        ? hayyizGetTodos()
        : JSON.parse(localStorage.getItem('hayyiz-todos') || '[]');
    const habits = JSON.parse(localStorage.getItem('hayyiz-habits') || '[]');
    const sessionsToday = parseInt(localStorage.getItem('hayyiz-sessions-today') || '0', 10);
    const focusMinutes = parseInt(localStorage.getItem('hayyiz-focus-minutes-today') || '0', 10);

    // تفكيك أرقام المهام بوضوح ودون تناقض:
    const activeTodos = todos.filter((t) => t && !t.completed);
    const completedToday = todos.filter(
        (t) => t && t.completed && t.completedAt === today
    ).length;
    const completedAll = todos.filter((t) => t && t.completed).length;
    const overdueTodos = activeTodos.filter((t) => t.date && String(t.date).slice(0, 10) < today);
    const dueTodayTodos = activeTodos.filter((t) => t.date && String(t.date).slice(0, 10) === today);
    const habitsDoneToday = habits.filter((h) => h && h.lastCompleted === today).length;

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

    const priMap = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };

    content.replaceChildren();

    // --- الترحيب ---
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
    // قسم 1: «أين أنا وما هدفي؟» — Goal & Academic Progress Card
    // ==========================================
    const acadSummary = typeof hayyizGetAcademicSummary === 'function' ? hayyizGetAcademicSummary() : null;
    if (acadSummary && (acadSummary.current !== null || acadSummary.target !== null)) {
        const goalCard = document.createElement('div');
        goalCard.className = 'dash-card card';

        const goalHead = document.createElement('div');
        goalHead.className = 'dash-section-head';

        const goalHeadTitle = document.createElement('h4');
        goalHeadTitle.innerHTML = '<i class="fa-solid fa-bullseye" aria-hidden="true" style="color:var(--primary);"></i> وضعك الدراسي وهدفك';

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
            curBox.innerHTML = '<span style="font-size:0.8rem; color:var(--text-muted); display:block;">المعدل الحالي</span>' +
                               '<strong style="font-size:1.25rem; color:var(--text);">' + acadSummary.current.toFixed(2) + '%</strong>';
            goalGrid.appendChild(curBox);
        }

        if (acadSummary.target !== null) {
            const tgtBox = document.createElement('div');
            tgtBox.className = 'dash-card-box';
            tgtBox.innerHTML = '<span style="font-size:0.8rem; color:var(--text-muted); display:block;">الهدف</span>' +
                               '<strong style="font-size:1.25rem; color:var(--primary);">' + acadSummary.target.toFixed(2) + '%</strong>';
            goalGrid.appendChild(tgtBox);
        }

        if (acadSummary.current !== null && acadSummary.target !== null) {
            const pctVal = Math.min(100, Math.max(0, Math.round((acadSummary.current / acadSummary.target) * 100)));
            const pctBox = document.createElement('div');
            pctBox.className = 'dash-card-box';
            pctBox.innerHTML = '<span style="font-size:0.8rem; color:var(--text-muted); display:block;">نسبة الاقتراب من الهدف</span>' +
                               '<strong style="font-size:1.25rem; color:var(--success, #10b981);">' + pctVal + '%</strong>';
            goalGrid.appendChild(pctBox);
        }

        goalCard.appendChild(goalGrid);

        // شريط الاقتراب من الهدف مع التركيز البصري على الفجوة بالنظام المئوي / النقاط
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
            gapP.style.cssText = 'margin: 0 0 0.6rem; font-size: 0.92rem; color: var(--text); font-weight: 600;';
            if (acadSummary.gap > 0.009) {
                gapP.innerHTML = `<i class="fa-solid fa-arrow-trend-up" style="color:var(--primary);"></i> المتبقي للوصول إلى الهدف: <strong>${acadSummary.gap.toFixed(2)} نقطة مئوية</strong>`;
            } else if (acadSummary.gap < -0.009) {
                gapP.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--success);"></i> أنت أعلى من هدفك بـ <strong>${Math.abs(acadSummary.gap).toFixed(2)} نقطة مئوية</strong> 🎉`;
            } else {
                gapP.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--success);"></i> وصلت إلى هدفك تماماً! حافظ على استمراريتك 🎉`;
            }
            goalCard.appendChild(gapP);
        }

        // تحسين عرض أهداف المواد والمهام المرتبطة
        if (acadSummary.subjectGoals && acadSummary.subjectGoals.length > 0) {
            const subGoalsWrap = document.createElement('div');
            subGoalsWrap.style.cssText = 'margin-top: 0.85rem; padding-top: 0.85rem; border-top: 1px solid var(--border);';

            const subGoalsTitle = document.createElement('strong');
            subGoalsTitle.style.cssText = 'font-size: 0.88rem; color: var(--text); display: block; margin-bottom: 0.5rem;';
            subGoalsTitle.textContent = 'أهداف المواد والمهام المرتبطة بها:';
            subGoalsWrap.appendChild(subGoalsTitle);

            const subGoalsList = document.createElement('ul');
            subGoalsList.style.cssText = 'list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem;';

            const allSubjects = typeof hayyizGetSubjects === 'function' ? hayyizGetSubjects() : [];

            acadSummary.subjectGoals.forEach((sg) => {
                const li = document.createElement('li');
                li.style.cssText = 'font-size: 0.85rem; color: var(--text); display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; background: var(--bg); padding: 0.5rem 0.75rem; border-radius: 8px; border: 1px solid var(--border);';

                const relSubject = allSubjects.find((s) => s.name === sg.name);
                const relTodos = relSubject ? todos.filter((t) => t && t.subjectId === relSubject.id) : [];
                const relCompleted = relTodos.filter((t) => t && t.completed).length;
                const relFocusMin = relSubject ? (parseInt(relSubject.focusMinutes, 10) || 0) : 0;

                const leftText = sg.name + ' (هدف: ' + sg.target + '%)';
                const leftSpan = document.createElement('span');
                leftSpan.innerHTML = '<i class="fa-solid fa-flag" style="color:var(--primary); font-size:0.75rem;"></i> ' + leftText;

                const rightSpan = document.createElement('span');
                rightSpan.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; flex-wrap: wrap;';

                if (relTodos.length > 0) {
                    let infoText = `المهام: ${relCompleted}/${relTodos.length}`;
                    if (relFocusMin > 0) infoText += ` · ${relFocusMin} د تركيز`;
                    rightSpan.textContent = infoText;
                } else {
                    const noTasksSpan = document.createElement('span');
                    noTasksSpan.style.color = 'var(--text-muted)';
                    noTasksSpan.textContent = 'لا توجد مهام مرتبطة ';

                    const addBtn = document.createElement('a');
                    addBtn.href = 'todo.html' + (relSubject ? '?subjectId=' + encodeURIComponent(relSubject.id) : '');
                    addBtn.style.cssText = 'color: var(--primary); font-weight: 600; text-decoration: none;';
                    addBtn.textContent = '+ إضافة مهمة';

                    rightSpan.appendChild(noTasksSpan);
                    rightSpan.appendChild(addBtn);
                }

                li.appendChild(leftSpan);
                li.appendChild(rightSpan);
                subGoalsList.appendChild(li);
            });

            subGoalsWrap.appendChild(subGoalsList);
            goalCard.appendChild(subGoalsWrap);
        }

        content.appendChild(goalCard);
    }

    // ==========================================
    // قسم 2: «حالتك الدراسية الآن» — Student Status & Active Focus Session Banner
    // ==========================================
    const activeFocusState = typeof hayyizGetFocusState === 'function' ? hayyizGetFocusState() : null;
    if (activeFocusState && activeFocusState.status === 'running' && activeFocusState.remainingSeconds > 0) {
        const activeFocusBanner = document.createElement('div');
        activeFocusBanner.style.cssText = 'padding: 1rem 1.25rem; margin-bottom: 1.25rem; background: var(--color-primary); color: var(--color-primary-text); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: space-between; gap: 0.85rem; flex-wrap: wrap; box-shadow: var(--shadow);';

        const remMin = Math.floor(activeFocusState.remainingSeconds / 60);
        const remSec = activeFocusState.remainingSeconds % 60;
        const timeFormatted = `${String(remMin).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
        const ctxTitle = activeFocusState.context ? activeFocusState.context.title : 'جلسة تركيز';

        activeFocusBanner.innerHTML = `
            <div>
                <strong style="font-size: 1.05rem; display: block; margin-bottom: 0.2rem;"><i class="fa-solid fa-play"></i> لديك جلسة تركيز جارية الآن (${timeFormatted})</strong>
                <span style="font-size: 0.88rem; opacity: 0.9;">السياق: ${escapeHtml(ctxTitle)}</span>
            </div>
            <a href="pomodoro.html" class="btn btn-accent" style="font-weight: 700; text-decoration: none;">متابعة الجلسة</a>
        `;
        content.appendChild(activeFocusBanner);
    }

    const statusBox = document.createElement('div');
    statusBox.className = 'dash-section';
    statusBox.style.cssText = 'padding: 0.9rem 1.15rem; margin-bottom: 1.25rem; background: var(--bg); border-radius: var(--radius-sm, 12px); border-right: 4px solid var(--primary); display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;';

    let statusMsg = '';
    const activeCount = activeTodos.length;

    if (activeCount === 0) {
        statusMsg = 'لا توجد مهام متبقية اليوم. يمكنك إضافة مهمة جديدة أو أداء جلسة تركيز حرة.';
    } else if (overdueTodos.length > 0) {
        statusMsg = `لديك ${overdueTodos.length} مهام متأخرة عن موعدها اليوم. ابدأ بالمهام المتأخرة ذات الأولوية العالية.`;
    } else if (isTaskInProgress && nextTask) {
        statusMsg = `لديك مهمة قيد التنفيذ ("${nextTask.text.length > 25 ? nextTask.text.slice(0, 25) + '…' : nextTask.text}"). أكمل الجلسة القائمة أولاً.`;
    } else if (dueTodayTodos.length > 0) {
        statusMsg = `لديك ${dueTodayTodos.length} مهام مستحقة اليوم و${activeCount} مهام نشطة إجمالاً. ابدأ بالمهمة الأكثر أولوية.`;
    } else if (hour < 12) {
        statusMsg = `لديك ${activeCount} مهام متبقية في خطتك اليوم. جدول أعمالك جاهز للبدء.`;
    } else if (hour >= 18) {
        statusMsg = `لديك ${activeCount} مهام متبقية اليوم (${completedToday} منجزة اليوم). ركّز على إنجاز الأهم قبل نهاية اليوم.`;
    } else {
        statusMsg = `لديك ${activeCount} مهام متبقية اليوم. اختر المهمة التالية للبدء.`;
    }

    statusBox.innerHTML = '<div><strong style="display:block; font-size:0.92rem; color:var(--text); margin-bottom:0.2rem;">حالتك الدراسية الآن</strong>' +
                        '<span style="font-size:0.88rem; color:var(--text-muted);">' + statusMsg + '</span></div>';

    content.appendChild(statusBox);

    // ==========================================
    // قسم 3: «ماذا أفعل الآن؟» — Task Card ("أكمل ما بدأت" أو "ما المهمة التالية؟")
    // ==========================================
    const nowCard = document.createElement('div');
    nowCard.className = 'dash-now';

    if (nextTask) {
        const nowLabel = document.createElement('div');
        nowLabel.className = 'dash-now-label';
        const cardHeaderTitle = isTaskInProgress ? 'أكمل ما بدأت' : 'ما المهمة التالية؟';
        nowLabel.innerHTML = `<i class="fa-solid fa-bullseye" aria-hidden="true"></i> ${cardHeaderTitle}`;
        nowCard.appendChild(nowLabel);

        const nowName = document.createElement('div');
        nowName.className = 'dash-now-name';
        nowName.textContent = nextTask.text;
        nowCard.appendChild(nowName);

        const nowMeta = document.createElement('div');
        nowMeta.className = 'dash-now-meta';
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
        nowMeta.textContent = metaParts.join(' · ');
        nowCard.appendChild(nowMeta);

        // السبب الموضوعي: لماذا هذه المهمة؟
        if (nextReason) {
            const reasonEl = document.createElement('p');
            reasonEl.className = 'dash-now-reason';
            reasonEl.style.cssText = 'margin: 0.4rem 0 0; font-size: 0.88rem; color: var(--text-muted);';
            reasonEl.innerHTML = `<strong style="color:var(--text);">لماذا هذه المهمة؟</strong> ${nextReason}`;
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
        openTodo.className = 'btn btn-outline';
        openTodo.textContent = 'اختر مهمة أخرى';
        nowActions.appendChild(openTodo);

        nowCard.appendChild(nowActions);
    } else {
        const nowLabel = document.createElement('div');
        nowLabel.className = 'dash-now-label';
        nowLabel.innerHTML = '<i class="fa-solid fa-check-double" aria-hidden="true"></i> لا مهام نشطة الآن';
        nowCard.appendChild(nowLabel);

        const emptyHint = document.createElement('p');
        emptyHint.className = 'dash-empty';
        emptyHint.style.margin = '0.5rem 0 0.85rem';
        emptyHint.textContent = 'أضف مهمة من قائمة المهام، أو ابدأ جلسة تركيز مباشرة.';
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
        addTask.className = 'btn btn-outline';
        addTask.textContent = 'أضف مهمة';
        nowActions.appendChild(addTask);

        nowCard.appendChild(nowActions);
    }
    content.appendChild(nowCard);

    // ==========================================
    // قسم: بطاقة تقويم الطالب — Student Calendar Card
    // ==========================================
    if (typeof hayyizGetCalendarSummary === 'function') {
        const calSummary = hayyizGetCalendarSummary();
        const calCard = document.createElement('div');
        calCard.className = 'dash-section card';
        calCard.style.cssText = 'padding: 1.1rem 1.25rem; margin-bottom: 1.25rem; background: var(--bg-card); border-radius: var(--radius); border: 1px solid var(--border);';

        const calHead = document.createElement('div');
        calHead.className = 'dash-section-head';
        calHead.style.cssText = 'margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between;';

        const calHeadTitle = document.createElement('h4');
        calHeadTitle.style.cssText = 'font-size: 1.05rem; margin: 0;';
        calHeadTitle.innerHTML = '<i class="fa-solid fa-calendar-days" aria-hidden="true" style="color:var(--primary);"></i> تقويم الطالب';

        const calLink = document.createElement('a');
        calLink.href = 'calculator.html';
        calLink.textContent = 'عرض التقويم';
        calLink.style.cssText = 'color: var(--primary); font-weight: 600; text-decoration: none; font-size: 0.9rem;';

        calHead.appendChild(calHeadTitle);
        calHead.appendChild(calLink);
        calCard.appendChild(calHead);

        // 1. أقرب حدث قادم
        const eventBox = document.createElement('div');
        eventBox.style.cssText = 'padding: 0.85rem; background: var(--bg); border-radius: 10px; border: 1px solid var(--border); margin-bottom: 0.75rem;';

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
                    statusBadge = '<span style="background: rgba(79, 70, 229, 0.1); color: var(--primary); font-size: 0.8rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 12px;">قادم</span>';
                } else {
                    countdownStr = 'اليوم';
                    statusBadge = '<span style="background: rgba(245, 158, 11, 0.15); color: #d97706; font-size: 0.8rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 12px;">اليوم</span>';
                }
            } else {
                const t0 = new Date(`${todayStr}T00:00:00`).getTime();
                const t1 = new Date(`${ev.date}T00:00:00`).getTime();
                const diffDays = Math.round((t1 - t0) / (1000 * 60 * 60 * 24));

                if (diffDays > 0) {
                    countdownStr = `بعد ${diffDays} يومًا`;
                    statusBadge = '<span style="background: rgba(79, 70, 229, 0.1); color: var(--primary); font-size: 0.8rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 12px;">قادم</span>';
                } else {
                    countdownStr = 'اليوم';
                    statusBadge = '<span style="background: rgba(245, 158, 11, 0.15); color: #d97706; font-size: 0.8rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 12px;">اليوم</span>';
                }
            }

            const typeLabel = ev.type === 'exam' ? 'اختبار' : (ev.type === 'personal' ? 'موعد شخصي' : 'حدث مخصص');
            let dateStrFormatted = ev.date;
            if (ev.time) dateStrFormatted += ` (${ev.time})`;

            eventBox.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.35rem;">
                    <strong style="font-size: 1rem; color: var(--text);">${escapeHtml(ev.name)}</strong>
                    ${statusBadge}
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.4rem;">
                    <span><i class="fa-regular fa-calendar"></i> ${dateStrFormatted} · ${typeLabel}</span>
                    <strong style="color: var(--primary); font-size: 0.95rem;">${countdownStr}</strong>
                </div>
            `;
        } else {
            eventBox.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap;">
                    <span style="font-size: 0.9rem; color: var(--text-muted);"><i class="fa-regular fa-calendar-xmark"></i> لا توجد اختبارات قادمة</span>
                    <a href="calculator.html" style="font-size: 0.85rem; color: var(--primary); font-weight: 700; text-decoration: none;">+ إضافة موعد</a>
                </div>
            `;
        }
        calCard.appendChild(eventBox);

        // 2. قسم العمر الاختياري
        const ageBox = document.createElement('div');
        ageBox.style.cssText = 'padding: 0.75rem 0.85rem; background: var(--bg); border-radius: 10px; border: 1px solid var(--border); font-size: 0.88rem;';

        if (calSummary.birthdate && calSummary.ageInfo) {
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
                    ageStr += `<div style="margin-top:0.3rem; color: var(--text-muted); font-size: 0.82rem;">متبقي على 18 عاماً: <strong>${remStr}</strong></div>`;
                }

                ageBox.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                        <div><i class="fa-solid fa-cake-candles" style="color:var(--primary);"></i> ${ageStr}</div>
                        <button type="button" id="hide-age-dash-btn" style="background: none; border: none; color: var(--text-muted); font-size: 0.78rem; cursor: pointer; text-decoration: underline;">إخفاء</button>
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
                        <span style="color: var(--text-muted);"><i class="fa-solid fa-cake-candles"></i> معلومات العمر مخفية</span>
                        <button type="button" id="show-age-dash-btn" style="background: none; border: none; color: var(--primary); font-weight: 600; font-size: 0.82rem; cursor: pointer;">عرض عمري</button>
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
                        <span><i class="fa-solid fa-circle-question" style="color:var(--primary);"></i> هل تريد عرض عمرك في الملخص اليومي؟</span>
                        <div style="display: flex; gap: 0.5rem;">
                            <button type="button" id="accept-show-age-btn" class="btn btn-primary" style="padding: 0.3rem 0.75rem; font-size: 0.82rem;">عرض عمري</button>
                            <button type="button" id="decline-show-age-btn" class="btn btn-outline" style="padding: 0.3rem 0.75rem; font-size: 0.82rem;">ليس الآن</button>
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
        } else {
            ageBox.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                    <span style="color: var(--text-muted);"><i class="fa-solid fa-cake-candles"></i> لم تقم بإدخال تاريخ ميلادك بعد</span>
                    <a href="calculator.html" style="color: var(--primary); font-weight: 600; text-decoration: none; font-size: 0.85rem;">أضف تاريخ ميلادك</a>
                </div>
            `;
            calCard.appendChild(ageBox);
        }

        content.appendChild(calCard);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ==========================================
    // قسم 4: «ماذا أنجزت؟» — Dashboard Stats (اتساق رياضي تام)
    // ==========================================
    const stats = document.createElement('div');
    stats.className = 'dash-stats';

    function makeStat(icon, value, label, sublabel, link) {
        const el = link ? document.createElement('a') : document.createElement('div');
        if (link) {
            el.href = link;
            el.className = 'dash-stat dash-stat-link';
        } else {
            el.className = 'dash-stat';
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
        if (sublabel) {
            const sub = document.createElement('small');
            sub.style.cssText = 'font-size:0.75rem; color:var(--text-muted); display:block; margin-top:2px;';
            sub.textContent = sublabel;
            el.appendChild(sub);
        }
        return el;
    }

    stats.appendChild(makeStat('fa-solid fa-clock', sessionsToday, 'جلسات اليوم', null, 'pomodoro.html'));
    stats.appendChild(makeStat('fa-solid fa-hourglass-half', timeText, 'تركيز اليوم', null, 'pomodoro.html'));
    stats.appendChild(makeStat('fa-solid fa-circle-check', completedToday, 'أنجزت اليوم', `إجمالي المنجز: ${completedAll}`, 'todo.html'));
    stats.appendChild(makeStat('fa-solid fa-list-check', activeTodos.length, 'المهام المتبقية', overdueTodos.length > 0 ? `متأخرة: ${overdueTodos.length}` : null, 'todo.html'));

    content.appendChild(stats);

    // ملخص اليوم النظري الإجرائي
    const dayBits = [];
    if (sessionsToday > 0) dayBits.push(sessionsToday + ' جلسة تركيز');
    if (focusMinutes > 0) dayBits.push(timeText + ' تركيز');
    dayBits.push(completedToday + ' مهمة منجزة اليوم');
    if (habits.length > 0) dayBits.push(habitsDoneToday + '/' + habits.length + ' عادات');
    if (dayBits.length > 0) {
        const daySum = document.createElement('p');
        daySum.className = 'dash-day-summary';
        daySum.textContent = 'ملخص اليوم: ' + dayBits.join(' · ');
        content.appendChild(daySum);
    }

    // تنبيه بالمهام المتأخرة / المستحقة
    if (overdueTodos.length > 0 || dueTodayTodos.length > 0) {
        const alertBox = document.createElement('div');
        alertBox.className = 'dash-alert';
        if (overdueTodos.length > 0) {
            alertBox.classList.add('warn');
            alertBox.innerHTML =
                '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ' +
                '<span>لديك <strong>' + overdueTodos.length + '</strong> مهمة متأخرة عن موعدها</span>';
        } else {
            alertBox.innerHTML =
                '<i class="fa-solid fa-calendar-day" aria-hidden="true"></i> ' +
                '<span><strong>' + dueTodayTodos.length + '</strong> مهمة مستحقة اليوم</span>';
        }
        const alertLink = document.createElement('a');
        alertLink.href = 'todo.html';
        alertLink.textContent = 'عرض في المهام';
        alertBox.appendChild(alertLink);
        content.appendChild(alertBox);
    }

    // ==========================================
    // قسم 5: مهام أخرى مناسبة
    // ==========================================
    const moreTasks = nextTasks.slice(1);
    const tasksSection = document.createElement('div');
    tasksSection.className = 'dash-section';

    const tasksHead = document.createElement('div');
    tasksHead.className = 'dash-section-head';
    const tasksTitle = document.createElement('h4');
    tasksTitle.textContent = moreTasks.length > 0 ? 'مهام أخرى مناسبة' : 'المهام';
    const tasksAll = document.createElement('a');
    tasksAll.href = 'todo.html';
    tasksAll.textContent = 'عرض الكل (' + activeTodos.length + ')';
    tasksHead.appendChild(tasksTitle);
    tasksHead.appendChild(tasksAll);
    tasksSection.appendChild(tasksHead);

    if (nextTasks.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'dash-empty';
        empty.textContent = 'لا توجد مهام نشطة — ';
        const addLink = document.createElement('a');
        addLink.href = 'todo.html';
        addLink.textContent = 'أضف مهمة';
        empty.appendChild(addLink);
        tasksSection.appendChild(empty);
        content.appendChild(tasksSection);
    } else if (moreTasks.length > 0) {
        const list = document.createElement('ul');
        list.className = 'dash-task-list';

        moreTasks.forEach((task) => {
            const realIndex = todos.indexOf(task);
            const li = document.createElement('li');
            li.className = 'dash-task-item';

            const info = document.createElement('div');
            info.className = 'dash-task-info';

            const name = document.createElement('span');
            name.className = 'dash-task-name';
            name.textContent = task.text;

            const meta = document.createElement('span');
            meta.className = 'dash-task-meta';
            let metaText = priMap[task.priority] || '';
            if (task.subjectId && typeof hayyizGetSubjectName === 'function') {
                const sn = hayyizGetSubjectName(task.subjectId);
                if (sn) metaText += (metaText ? ' · ' : '') + sn;
            }
            if (task.minutes) {
                const done = task.focusDone ? parseInt(task.focusDone, 10) || 0 : 0;
                const total = parseInt(task.minutes, 10) || 0;
                if (done > 0 && total > 0) {
                    metaText += (metaText ? ' · ' : '') + done + '/' + total + ' د';
                } else {
                    metaText += (metaText ? ' · ' : '') + task.minutes + ' د';
                }
            }
            if (task.date) {
                const d = String(task.date).slice(0, 10);
                if (d < today) metaText += (metaText ? ' · ' : '') + 'متأخرة';
                else if (d === today) metaText += (metaText ? ' · ' : '') + 'اليوم';
                else metaText += (metaText ? ' · ' : '') + d;
            }
            meta.textContent = metaText;

            info.appendChild(name);
            info.appendChild(meta);

            const pomoBtn = document.createElement('button');
            pomoBtn.type = 'button';
            pomoBtn.className = 'dash-pomo-btn';
            pomoBtn.title = 'ابدأ تركيز';
            pomoBtn.setAttribute('aria-label', 'ابدأ جلسة تركيز على ' + task.text);
            pomoBtn.innerHTML = '<i class="fa-solid fa-play" aria-hidden="true"></i>';
            pomoBtn.addEventListener('click', () => {
                launchPomodoroForTask(task, realIndex);
            });

            li.appendChild(info);
            li.appendChild(pomoBtn);
            list.appendChild(li);
        });

        tasksSection.appendChild(list);
        content.appendChild(tasksSection);
    }

    // ==========================================
    // قسم 6: عادات اليوم
    // ==========================================
    if (habits.length > 0) {
        const habitsSection = document.createElement('div');
        habitsSection.className = 'dash-section';

        const habitsHead = document.createElement('div');
        habitsHead.className = 'dash-section-head';
        const habitsTitle = document.createElement('h4');
        habitsTitle.textContent =
            'عادات اليوم · ' + habitsDoneToday + '/' + habits.length;
        const habitsAll = document.createElement('a');
        habitsAll.href = 'habits.html';
        habitsAll.textContent = 'الكل';
        habitsHead.appendChild(habitsTitle);
        habitsHead.appendChild(habitsAll);
        habitsSection.appendChild(habitsHead);

        const habitsList = document.createElement('ul');
        habitsList.className = 'dash-habit-list';

        habits.slice(0, 5).forEach((habit, i) => {
            const li = document.createElement('li');
            li.className = 'dash-habit-item';

            const check = document.createElement('input');
            check.type = 'checkbox';
            check.checked = habit.lastCompleted === today;
            check.title = 'تسجيل لليوم';
            check.setAttribute('aria-label', 'تسجيل عادة ' + (habit.name || ''));

            check.addEventListener('change', () => {
                const all = JSON.parse(localStorage.getItem('hayyiz-habits') || '[]');
                const idx = all.findIndex(
                    (h, j) => h.name === habit.name && (j === i || h.created === habit.created)
                );
                const target = idx >= 0 ? idx : i;
                if (!all[target]) return;

                if (check.checked) {
                    const last = all[target].lastCompleted;
                    const yStr =
                        typeof getYesterdayLocal === 'function'
                            ? getYesterdayLocal()
                            : (() => {
                                  const y = new Date();
                                  y.setDate(y.getDate() - 1);
                                  return (
                                      y.getFullYear() +
                                      '-' +
                                      String(y.getMonth() + 1).padStart(2, '0') +
                                      '-' +
                                      String(y.getDate()).padStart(2, '0')
                                  );
                              })();
                    if (last === yStr) {
                        all[target].streak = (all[target].streak || 0) + 1;
                    } else if (last !== today) {
                        all[target].streak = 1;
                    }
                    all[target].lastCompleted = today;
                } else {
                    if (all[target].lastCompleted === today) {
                        all[target].lastCompleted = null;
                        all[target].streak = Math.max(0, (all[target].streak || 1) - 1);
                    }
                }
                localStorage.setItem('hayyiz-habits', JSON.stringify(all));
                const done = all.filter((h) => h.lastCompleted === today).length;
                habitsTitle.textContent = 'عادات اليوم · ' + done + '/' + all.length;
                const labelSpan = li.querySelector('span');
                if (labelSpan) {
                    labelSpan.textContent =
                        all[target].name +
                        (all[target].streak ? ' · ' + all[target].streak + '🔥' : '');
                }
            });

            const label = document.createElement('span');
            label.textContent = habit.name + (habit.streak ? ` · ${habit.streak}🔥` : '');

            li.appendChild(check);
            li.appendChild(label);
            habitsList.appendChild(li);
        });

        habitsSection.appendChild(habitsList);
        content.appendChild(habitsSection);
    }

    // ==========================================
    // قسم 7: «كيف وزعت وقتي؟» — Weekly Focus Statistics
    // ==========================================
    try {
        const hist = JSON.parse(localStorage.getItem('hayyiz-focus-history') || '{}');
        if (focusMinutes > 0) {
            hist[today] = Math.max(parseInt(hist[today], 10) || 0, focusMinutes);
        }
        const dayNames = ['الاحد', 'الاثنين', 'الثلاثاء', 'الاربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const weekSection = document.createElement('div');
        weekSection.className = 'dash-section';
        const weekHead = document.createElement('div');
        weekHead.className = 'dash-section-head';
        const weekTitle = document.createElement('h4');
        weekTitle.textContent = 'تركيز الأسبوع';
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

        // إحصائيات توزيع وقت المذاكرة حسب المواد هذا الأسبوع
        if (typeof hayyizGetWeeklySubjectStats === 'function') {
            const subStats = hayyizGetWeeklySubjectStats();
            const grandTotal = Math.max(subStats.totalMinutes, totalWeekMinutesFromHist);

            if (grandTotal > 0 || subStats.subjects.length > 0) {
                const subBox = document.createElement('div');
                subBox.style.cssText = 'margin-top: 1rem; padding-top: 0.85rem; border-top: 1px solid var(--border);';

                const summaryTotalP = document.createElement('p');
                summaryTotalP.style.cssText = 'margin: 0 0 0.6rem; font-size: 0.9rem; font-weight: 600; color: var(--text);';
                summaryTotalP.innerHTML = `<i class="fa-solid fa-chart-pie" aria-hidden="true" style="color:var(--primary);"></i> إجمالي التركيز هذا الأسبوع: <strong>${grandTotal} دقيقة</strong>`;
                subBox.appendChild(summaryTotalP);

                if (subStats.subjects.length > 0) {
                    const topSub = subStats.subjects[0];
                    const insightP = document.createElement('p');
                    insightP.style.cssText = 'margin: 0 0 0.6rem; font-size: 0.88rem; color: var(--text-muted);';
                    insightP.innerHTML = `قضيت <strong>${topSub.percentage}%</strong> من وقت مذاكرتك الموزّع على المواد هذا الأسبوع على <strong>${topSub.name}</strong> (${topSub.minutes} دقيقة).`;
                    subBox.appendChild(insightP);

                    const subList = document.createElement('div');
                    subList.style.cssText = 'display: flex; flex-wrap: wrap; gap: 0.5rem;';
                    subStats.subjects.forEach((s) => {
                        const tag = document.createElement('span');
                        tag.style.cssText = 'font-size: 0.8rem; padding: 0.25rem 0.65rem; background: var(--bg); border: 1px solid var(--border); border-radius: 20px; color: var(--text);';
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
    // قسم 8: اختصارات سريعة
    // ==========================================
    const quick = document.createElement('div');
    quick.className = 'dash-quick';

    const shortcuts = [
        { href: 'pomodoro.html', icon: 'fa-solid fa-clock', label: 'مؤقت' },
        { href: 'todo.html', icon: 'fa-solid fa-list-check', label: 'مهام' },
        { href: 'notes.html', icon: 'fa-solid fa-note-sticky', label: 'ملاحظات' },
        { href: 'gpa.html', icon: 'fa-solid fa-calculator', label: 'معدل' },
        { href: 'habits.html', icon: 'fa-solid fa-fire', label: 'عادات' },
        { href: 'game.html', icon: 'fa-solid fa-gamepad', label: 'لعبة' }
    ];

    shortcuts.forEach((s) => {
        const a = document.createElement('a');
        a.href = s.href;
        a.className = 'dash-quick-item';
        a.innerHTML =
            '<i class="' + s.icon + '" aria-hidden="true"></i><span>' + s.label + '</span>';
        quick.appendChild(a);
    });
    content.appendChild(quick);

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