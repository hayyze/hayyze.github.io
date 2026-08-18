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
    const todos = typeof hayyizGetTodos === 'function'
        ? hayyizGetTodos()
        : JSON.parse(localStorage.getItem('hayyiz-todos') || '[]');
    const habits = JSON.parse(localStorage.getItem('hayyiz-habits') || '[]');
    const sessionsToday = parseInt(localStorage.getItem('hayyiz-sessions-today') || '0', 10);
    const focusMinutes = parseInt(localStorage.getItem('hayyiz-focus-minutes-today') || '0', 10);

    const activeTodos = todos.filter((t) => !t.completed);
    const completedToday = todos.filter(
        (t) => t.completed && t.completedAt === today
    ).length;
    const completedAll = todos.filter((t) => t.completed).length;
    const overdue = activeTodos.filter((t) => t.date && String(t.date).slice(0, 10) < today);
    const dueToday = activeTodos.filter((t) => t.date && String(t.date).slice(0, 10) === today);
    const habitsDoneToday = habits.filter((h) => h.lastCompleted === today).length;

    const hours = Math.floor(focusMinutes / 60);
    const mins = focusMinutes % 60;
    let timeText = '0 د';
    if (focusMinutes > 0) {
        timeText = hours > 0 ? `${hours}س ${mins}د` : `${mins} د`;
    }

    const hour = new Date().getHours();
    let greeting = 'مرحباً';
    if (hour < 12) greeting = 'صباح الخير';
    else if (hour < 17) greeting = 'مساء الخير';
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
            .filter((t) => !t.completed)
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
    // قسم «أين أنا وما هدفي؟» — Goal & Progress Card
    // ==========================================
    const acadSummary = typeof hayyizGetAcademicSummary === 'function' ? hayyizGetAcademicSummary() : null;
    if (acadSummary && (acadSummary.current !== null || acadSummary.target !== null)) {
        const goalCard = document.createElement('div');
        goalCard.className = 'dash-section card';
        goalCard.style.cssText = 'padding: 1.1rem 1.25rem; margin-bottom: 1.25rem; background: var(--bg-card); border-radius: var(--radius); border: 1px solid var(--border);';

        const goalHead = document.createElement('div');
        goalHead.className = 'dash-section-head';
        goalHead.style.cssText = 'margin-bottom: 0.75rem;';

        const goalHeadTitle = document.createElement('h4');
        goalHeadTitle.style.cssText = 'font-size: 1.05rem; margin: 0;';
        goalHeadTitle.innerHTML = '<i class="fa-solid fa-bullseye" aria-hidden="true" style="color:var(--primary);"></i> وضعك الدراسي وهدفك';

        const gpaLink = document.createElement('a');
        gpaLink.href = 'gpa.html';
        gpaLink.textContent = acadSummary.target !== null ? 'تعديل الهدف' : 'حدد هدفك';

        goalHead.appendChild(goalHeadTitle);
        goalHead.appendChild(gpaLink);
        goalCard.appendChild(goalHead);

        const goalGrid = document.createElement('div');
        goalGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.85rem; margin-bottom: 0.85rem; text-align: center;';

        if (acadSummary.current !== null) {
            const curBox = document.createElement('div');
            curBox.style.cssText = 'padding: 0.6rem; background: var(--bg); border-radius: 10px; border: 1px solid var(--border);';
            curBox.innerHTML = '<span style="font-size:0.8rem; color:var(--text-muted); display:block;">المعدل الحالي</span>' +
                               '<strong style="font-size:1.25rem; color:var(--text);">' + acadSummary.current.toFixed(2) + '%</strong>';
            goalGrid.appendChild(curBox);
        }

        if (acadSummary.target !== null) {
            const tgtBox = document.createElement('div');
            tgtBox.style.cssText = 'padding: 0.6rem; background: var(--bg); border-radius: 10px; border: 1px solid var(--border);';
            tgtBox.innerHTML = '<span style="font-size:0.8rem; color:var(--text-muted); display:block;">الهدف</span>' +
                               '<strong style="font-size:1.25rem; color:var(--primary);">' + acadSummary.target.toFixed(2) + '%</strong>';
            goalGrid.appendChild(tgtBox);
        }

        if (acadSummary.current !== null && acadSummary.target !== null) {
            const pctVal = Math.min(100, Math.max(0, Math.round((acadSummary.current / acadSummary.target) * 100)));
            const pctBox = document.createElement('div');
            pctBox.style.cssText = 'padding: 0.6rem; background: var(--bg); border-radius: 10px; border: 1px solid var(--border);';
            pctBox.innerHTML = '<span style="font-size:0.8rem; color:var(--text-muted); display:block;">التقدم نحو الهدف</span>' +
                               '<strong style="font-size:1.25rem; color:var(--success, #10b981);">' + pctVal + '%</strong>';
            goalGrid.appendChild(pctBox);
        }

        goalCard.appendChild(goalGrid);

        // شريط التقدم نحو الهدف
        if (acadSummary.current !== null && acadSummary.target !== null) {
            const pctVal = Math.min(100, Math.max(0, (acadSummary.current / acadSummary.target) * 100));
            const progWrap = document.createElement('div');
            progWrap.style.cssText = 'height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; margin-bottom: 0.6rem;';
            const progBar = document.createElement('div');
            progBar.style.cssText = 'height: 100%; width: ' + pctVal.toFixed(1) + '%; background: var(--primary); transition: width 0.3s;';
            progWrap.appendChild(progBar);
            goalCard.appendChild(progWrap);

            const gapP = document.createElement('p');
            gapP.style.cssText = 'margin: 0 0 0.6rem; font-size: 0.88rem; color: var(--text-muted);';
            if (acadSummary.gap > 0.009) {
                gapP.textContent = 'تحتاج إلى رفع المعدل بمقدار ' + acadSummary.gap.toFixed(2) + '% للوصول إلى هدفك.';
            } else if (acadSummary.gap < -0.009) {
                gapP.textContent = 'أنت أعلى من هدفك بـ ' + Math.abs(acadSummary.gap).toFixed(2) + '% 🎉';
            } else {
                gapP.textContent = 'وصلت إلى هدفك تماماً! حافظ على استمراريتك 🎉';
            }
            goalCard.appendChild(gapP);
        }

        // إظهار تنفيذ أهداف المواد والمهام المرتبطة
        if (acadSummary.subjectGoals && acadSummary.subjectGoals.length > 0) {
            const subGoalsWrap = document.createElement('div');
            subGoalsWrap.style.cssText = 'margin-top: 0.85rem; padding-top: 0.85rem; border-top: 1px solid var(--border);';

            const subGoalsTitle = document.createElement('strong');
            subGoalsTitle.style.cssText = 'font-size: 0.88rem; color: var(--text); display: block; margin-bottom: 0.5rem;';
            subGoalsTitle.textContent = 'أهداف المواد والمهام المرتبطة بها:';
            subGoalsWrap.appendChild(subGoalsTitle);

            const subGoalsList = document.createElement('ul');
            subGoalsList.style.cssText = 'list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4rem;';

            acadSummary.subjectGoals.forEach((sg) => {
                const li = document.createElement('li');
                li.style.cssText = 'font-size: 0.85rem; color: var(--text-muted); display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; background: var(--bg); padding: 0.4rem 0.65rem; border-radius: 8px; border: 1px solid var(--border);';

                // حساب المهام المرتبطة بالمادة
                const relSubject = typeof hayyizGetSubjects === 'function' ? hayyizGetSubjects().find(s => s.name === sg.name) : null;
                const relTodos = relSubject ? todos.filter(t => t.subjectId === relSubject.id) : [];
                const relCompleted = relTodos.filter(t => t.completed).length;
                const relFocusMin = relSubject ? (parseInt(relSubject.focusMinutes, 10) || 0) : 0;

                const leftText = sg.name + ' (هدف: ' + sg.target + '%)';
                let rightText = '';
                if (relTodos.length > 0) {
                    rightText = 'مهام: ' + relCompleted + '/' + relTodos.length;
                }
                if (relFocusMin > 0) {
                    rightText += (rightText ? ' · ' : '') + relFocusMin + ' د تركيز';
                }
                if (!rightText) rightText = 'لا مهام مرتبطة بعد';

                li.innerHTML = '<span><i class="fa-solid fa-flag" style="color:var(--primary); font-size:0.75rem;"></i> ' + leftText + '</span>' +
                             '<span style="font-size:0.8rem; opacity:0.85;">' + rightText + '</span>';
                subGoalsList.appendChild(li);
            });

            subGoalsWrap.appendChild(subGoalsList);
            goalCard.appendChild(subGoalsWrap);
        }

        content.appendChild(goalCard);
    }

    // ==========================================
    // قسم «حالة الطالب» — Student Status & Messages
    // ==========================================
    const statusBox = document.createElement('div');
    statusBox.className = 'dash-section';
    statusBox.style.cssText = 'padding: 0.85rem 1.1rem; margin-bottom: 1.25rem; background: var(--bg); border-radius: var(--radius-sm, 12px); border-right: 4px solid var(--primary); display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;';

    let statusMsg = '';
    const activeCount = activeTodos.length;
    const hourNow = new Date().getHours();

    if (activeCount === 0) {
        statusMsg = 'أنت مستعد تماماً! لا توجد مهام معلقة الآن. أضف مهمة للبدء.';
    } else if (completedToday > 0 && activeCount > 0) {
        statusMsg = 'أنجزت ' + completedToday + ' مهام اليوم وبقي ' + activeCount + ' مهمة. واصل التقدّم!';
    } else if (overdue.length > 0) {
        statusMsg = 'لديك ' + overdue.length + ' مهام متأخرة تحتاج اهتمامك اليوم.';
    } else if (dueToday.length > 0) {
        statusMsg = 'لديك ' + dueToday.length + ' مهام مستحقة اليوم. ابدأ بالأهم منها.';
    } else if (hourNow < 12) {
        statusMsg = 'صباح الإنجاز! لديك ' + activeCount + ' مهام نشطة في خطتك اليوم.';
    } else if (hourNow >= 18) {
        statusMsg = 'شارف اليوم على الانتهاء. أنجزت ' + completedToday + ' مهام وبقي ' + activeCount + ' مهمة.';
    } else {
        statusMsg = 'لديك ' + activeCount + ' مهام نشطة بانتظارك.';
    }

    statusBox.innerHTML = '<div><strong style="display:block; font-size:0.92rem; color:var(--text);">حالتك الدراسية الآن</strong>' +
                        '<span style="font-size:0.88rem; color:var(--text-muted);">' + statusMsg + '</span></div>';

    content.appendChild(statusBox);

    const nowCard = document.createElement('div');
    nowCard.className = 'dash-now';

    if (nextTask) {
        const nowLabel = document.createElement('div');
        nowLabel.className = 'dash-now-label';
        nowLabel.innerHTML =
            '<i class="fa-solid fa-bullseye" aria-hidden="true"></i> ابدأ من هنا';
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

        if (nextReason) {
            const reasonEl = document.createElement('p');
            reasonEl.className = 'dash-now-reason';
            reasonEl.style.margin = '0.4rem 0 0';
            reasonEl.style.fontSize = '0.9rem';
            reasonEl.style.color = 'var(--text-muted)';
            reasonEl.textContent = nextReason;
            nowCard.appendChild(reasonEl);
        }

        const nowActions = document.createElement('div');
        nowActions.className = 'dash-now-actions';

        const startNowBtn = document.createElement('button');
        startNowBtn.type = 'button';
        startNowBtn.className = 'btn btn-primary';
        startNowBtn.innerHTML =
            '<i class="fa-solid fa-play" aria-hidden="true"></i> ابدأ جلسة تركيز';
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
        nowLabel.innerHTML =
            '<i class="fa-solid fa-check-double" aria-hidden="true"></i> لا مهام نشطة الآن';
        nowCard.appendChild(nowLabel);

        const emptyHint = document.createElement('p');
        emptyHint.className = 'dash-empty';
        emptyHint.style.margin = '0.5rem 0 0.85rem';
        emptyHint.textContent =
            'أضف مهمة من قائمة المهام، أو ابدأ جلسة تركيز مباشرة.';
        nowCard.appendChild(emptyHint);

        const nowActions = document.createElement('div');
        nowActions.className = 'dash-now-actions';

        const startFree = document.createElement('button');
        startFree.type = 'button';
        startFree.className = 'btn btn-primary';
        startFree.innerHTML =
            '<i class="fa-solid fa-play" aria-hidden="true"></i> ابدأ جلسة تركيز';
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

    const stats = document.createElement('div');
    stats.className = 'dash-stats';

    function makeStat(icon, value, label, link) {
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
        return el;
    }

    stats.appendChild(makeStat('fa-solid fa-clock', sessionsToday, 'جلسات اليوم', 'pomodoro.html'));
    stats.appendChild(makeStat('fa-solid fa-hourglass-half', timeText, 'تركيز اليوم', 'pomodoro.html'));
    const hasAnyCompletedAt = todos.some((t) => t.completed && t.completedAt);
    if (hasAnyCompletedAt || completedToday > 0) {
        stats.appendChild(
            makeStat('fa-solid fa-circle-check', completedToday, 'منجزة اليوم', 'todo.html')
        );
    } else {
        stats.appendChild(
            makeStat('fa-solid fa-circle-check', completedAll, 'مهام منجزة', 'todo.html')
        );
    }
    stats.appendChild(
        makeStat('fa-solid fa-list-check', activeTodos.length, 'مهام متبقية', 'todo.html')
    );
    content.appendChild(stats);

    const dayBits = [];
    if (sessionsToday > 0) dayBits.push(sessionsToday + ' جلسة تركيز');
    if (focusMinutes > 0) dayBits.push(timeText + ' تركيز');
    if (completedToday > 0) dayBits.push(completedToday + ' مهمة منجزة');
    if (habits.length > 0) dayBits.push(habitsDoneToday + '/' + habits.length + ' عادات');
    if (dayBits.length > 0) {
        const daySum = document.createElement('p');
        daySum.className = 'dash-day-summary';
        daySum.textContent = 'اليوم: ' + dayBits.join(' · ');
        content.appendChild(daySum);
    }

    if (overdue.length > 0 || dueToday.length > 0) {
        const alert = document.createElement('div');
        alert.className = 'dash-alert';
        if (overdue.length > 0) {
            alert.classList.add('warn');
            alert.innerHTML =
                '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ' +
                '<span>لديك <strong>' +
                overdue.length +
                '</strong> مهمة متأخرة</span>';
        } else {
            alert.innerHTML =
                '<i class="fa-solid fa-calendar-day" aria-hidden="true"></i> ' +
                '<span><strong>' +
                dueToday.length +
                '</strong> مهمة مستحقة اليوم</span>';
        }
        const alertLink = document.createElement('a');
        alertLink.href = 'todo.html';
        alertLink.textContent = 'عرض';
        alert.appendChild(alertLink);
        content.appendChild(alert);
    }

    const moreTasks = nextTasks.slice(1);
    const tasksSection = document.createElement('div');
    tasksSection.className = 'dash-section';

    const tasksHead = document.createElement('div');
    tasksHead.className = 'dash-section-head';
    const tasksTitle = document.createElement('h4');
    tasksTitle.textContent = moreTasks.length > 0 ? 'مهام أخرى مناسبة' : 'المهام';
    const tasksAll = document.createElement('a');
    tasksAll.href = 'todo.html';
    tasksAll.textContent = 'الكل';
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
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const key = `${y}-${m}-${dd}`;
            const val = parseInt(hist[key], 10) || 0;
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
            if (subStats && subStats.subjects.length > 0) {
                const subBox = document.createElement('div');
                subBox.style.cssText = 'margin-top: 1rem; padding-top: 0.85rem; border-top: 1px solid var(--border);';

                const topSub = subStats.subjects[0];
                const insightP = document.createElement('p');
                insightP.style.cssText = 'margin: 0 0 0.6rem; font-size: 0.88rem; color: var(--text-muted);';
                insightP.innerHTML = '<i class="fa-solid fa-chart-pie" aria-hidden="true" style="color:var(--primary);"></i> ' +
                                    'قضيت <strong>' + topSub.percentage + '%</strong> من وقت مذاكرتك هذا الأسبوع على <strong>' + topSub.name + '</strong> (' + topSub.minutes + ' دقيقة).';
                subBox.appendChild(insightP);

                const subList = document.createElement('div');
                subList.style.cssText = 'display: flex; flex-wrap: wrap; gap: 0.5rem;';
                subStats.subjects.forEach((s) => {
                    const tag = document.createElement('span');
                    tag.style.cssText = 'font-size: 0.8rem; padding: 0.25rem 0.6rem; background: var(--bg); border: 1px solid var(--border); border-radius: 20px; color: var(--text);';
                    tag.textContent = s.name + ': ' + s.minutes + ' د (' + s.percentage + '%)';
                    subList.appendChild(tag);
                });
                subBox.appendChild(subList);
                weekSection.appendChild(subBox);
            }
        }

        content.appendChild(weekSection);
    } catch (e) {
        /* تجاهل */
    }

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