document.addEventListener('DOMContentLoaded', () => {

    // ========== عناصر الصفحة ==========
    const timerDisplay = document.getElementById('timer-display');
    const progressBar = document.getElementById('timer-progress-bar');
    const startBtn = document.getElementById('timer-start-btn');
    const pauseBtn = document.getElementById('timer-pause-btn');
    const resetBtn = document.getElementById('timer-reset-btn');
    const workInput = document.getElementById('work-minutes');
    const breakInput = document.getElementById('break-minutes');
    const longBreakInput = document.getElementById('long-break-minutes');
    const modeWork = document.getElementById('mode-work');
    const modeBreak = document.getElementById('mode-break');
    const sessionsCount = document.getElementById('completed-sessions-count');

    // ========== تفضيلات المدد ==========
    if (workInput && localStorage.getItem('hayyiz-pref-work')) {
        workInput.value = localStorage.getItem('hayyiz-pref-work');
    }
    if (breakInput && localStorage.getItem('hayyiz-pref-break')) {
        breakInput.value = localStorage.getItem('hayyiz-pref-break');
    }
    if (longBreakInput && localStorage.getItem('hayyiz-pref-long')) {
        longBreakInput.value = localStorage.getItem('hayyiz-pref-long');
    }

    function savePrefs() {
        if (workInput) localStorage.setItem('hayyiz-pref-work', String(parseInt(workInput.value, 10) || 25));
        if (breakInput) localStorage.setItem('hayyiz-pref-break', String(parseInt(breakInput.value, 10) || 5));
        if (longBreakInput) localStorage.setItem('hayyiz-pref-long', String(parseInt(longBreakInput.value, 10) || 15));
    }

    [workInput, breakInput, longBreakInput].forEach((inp) => {
        if (inp) inp.addEventListener('change', savePrefs);
    });

    // ========== خطة المهمة الحالية ==========
    const urlParams = new URLSearchParams(window.location.search);
    const taskFromUrl = urlParams.get('task');
    const taskFromStorage = localStorage.getItem('hayyiz-current-task');
    let currentTask = taskFromUrl || taskFromStorage || null;

    function loadTaskSession() {
        try {
            return JSON.parse(localStorage.getItem('hayyiz-task-session') || 'null');
        } catch (e) {
            return null;
        }
    }

    function saveTaskSession(plan) {
        if (plan) localStorage.setItem('hayyiz-task-session', JSON.stringify(plan));
        else localStorage.removeItem('hayyiz-task-session');
    }

    let taskSession = loadTaskSession();

    // مزامنة الاسم من الرابط مع الخطة
    if (currentTask) {
        localStorage.setItem('hayyiz-current-task', currentTask);
        if (!taskSession || taskSession.text !== currentTask) {
            // خطة جديدة من الرابط بدون تفاصيل — نحاول جلب الدقائق من المهام
            const todos = JSON.parse(localStorage.getItem('hayyiz-todos') || '[]');
            const idxRaw = localStorage.getItem('hayyiz-current-task-index');
            let idx = idxRaw !== null ? parseInt(idxRaw, 10) : -1;
            let task = Number.isInteger(idx) && todos[idx] && todos[idx].text === currentTask
                ? todos[idx]
                : todos.find((t) => t.text === currentTask && !t.completed);

            const workMin = parseInt(workInput?.value, 10) || 25;
            const totalMinutes = task && task.minutes ? parseInt(task.minutes, 10) : null;
            const prevFocus = task && task.focusDone ? parseInt(task.focusDone, 10) : 0;
            const prevSessions = task && task.sessionsDone ? parseInt(task.sessionsDone, 10) : 0;
            taskSession = {
                text: currentTask,
                index: task ? todos.indexOf(task) : (Number.isInteger(idx) ? idx : -1),
                totalMinutes: totalMinutes && totalMinutes > 0 ? totalMinutes : null,
                focusDone: prevFocus || 0,
                sessionsDone: prevSessions || 0,
                sessionsNeeded:
                    totalMinutes && totalMinutes > 0
                        ? Math.ceil(totalMinutes / workMin)
                        : null
            };
            saveTaskSession(taskSession);
        }
    }

    function updateTaskMeta() {
        const box = document.getElementById('current-task-box');
        const nameEl = document.getElementById('current-task-name');
        const metaEl = document.getElementById('current-task-meta');
        if (!currentTask || !box || !nameEl) return;

        box.style.display = 'block';
        nameEl.textContent = currentTask;

        if (!metaEl) return;
        const workMin = parseInt(workInput?.value, 10) || 25;
        const plan = taskSession;

        if (plan && plan.totalMinutes) {
            const needed = plan.sessionsNeeded || Math.ceil(plan.totalMinutes / workMin);
            const done = plan.sessionsDone || 0;
            const focusDone = plan.focusDone || 0;
            metaEl.textContent =
                `جلسة ${Math.min(done + 1, needed)} من ${needed} · ` +
                `${focusDone}/${plan.totalMinutes} دقيقة`;
        } else if (plan) {
            const done = plan.sessionsDone || 0;
            metaEl.textContent =
                done > 0
                    ? `جلسات مكتملة: ${done} · ${plan.focusDone || 0} دقيقة`
                    : `جلسة تركيز ${workMin} دقيقة`;
        } else {
            metaEl.textContent = `جلسة تركيز ${workMin} دقيقة`;
        }
    }

    updateTaskMeta();

    // ========== الحالة ==========
    let timerInterval = null;
    let endTime = null;
    let totalDuration = (parseInt(workInput?.value, 10) || 25) * 60;
    let isRunning = false;
    let isWorkMode = true;
    let nextBreakIsLong = false;
    let completedSessions = parseInt(localStorage.getItem('hayyiz-sessions') || '0', 10);
    let sessionInCycle = parseInt(localStorage.getItem('hayyiz-session-in-cycle') || '0', 10);

    if (sessionsCount) sessionsCount.textContent = completedSessions;

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

    // ========== الصوت ==========
    function playNotificationSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();

            oscillator.connect(gain);
            gain.connect(ctx.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);

            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.8);
        } catch (e) {}
    }

    // ========== إشعار (يفضّل Service Worker) ==========
    function showNotification(title, body) {
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;

        const options = {
            body: body,
            icon: './android-chrome-192x192.png',
            badge: './favicon-32x32.png',
            tag: 'hayyiz-pomodoro',
            renotify: true,
            silent: false
        };

        // استخدام registration.showNotification عبر Service Worker إن أمكن
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
            navigator.serviceWorker.ready
                .then((reg) => {
                    if (reg && typeof reg.showNotification === 'function') {
                        return reg.showNotification(title, options);
                    }
                    throw new Error('no-sw-notification');
                })
                .catch(() => {
                    try {
                        new Notification(title, options);
                    } catch (e) { /* تجاهل */ }
                });
        } else {
            try {
                new Notification(title, options);
            } catch (e) { /* تجاهل */ }
        }
    }

    // ========== حفظ / استعادة الحالة ==========
    function saveState() {
        const state = {
            endTime: endTime,
            totalDuration: totalDuration,
            isRunning: isRunning,
            isWorkMode: isWorkMode,
            workMinutes: workInput.value,
            breakMinutes: breakInput.value,
            longBreakMinutes: longBreakInput ? longBreakInput.value : '15',
            sessionInCycle: sessionInCycle
        };

        localStorage.setItem('hayyiz-pomodoro-state', JSON.stringify(state));
        localStorage.setItem('hayyiz-session-in-cycle', String(sessionInCycle));
    }

    function loadState() {
        try {
            const raw = localStorage.getItem('hayyiz-pomodoro-state');
            if (!raw) return false;

            const state = JSON.parse(raw);

            if (state.workMinutes) workInput.value = state.workMinutes;
            if (state.breakMinutes) breakInput.value = state.breakMinutes;
            if (state.longBreakMinutes && longBreakInput) {
                longBreakInput.value = state.longBreakMinutes;
            }
            if (typeof state.sessionInCycle === 'number') {
                sessionInCycle = state.sessionInCycle;
            }

            isWorkMode = state.isWorkMode !== false;

            totalDuration =
                state.totalDuration ||
                (isWorkMode ? workInput.value : breakInput.value) * 60;

            endTime = state.endTime || null;
            isRunning = !!state.isRunning;

            if (isWorkMode) {
                modeWork.classList.add('active');
                modeBreak.classList.remove('active');
            } else {
                modeBreak.classList.add('active');
                modeWork.classList.remove('active');
            }

            if (isRunning && endTime) {
                const remaining = Math.max(
                    0,
                    Math.round((endTime - Date.now()) / 1000)
                );

                if (remaining <= 0) {
                    isRunning = false;
                    endTime = null;
                    handleTimerEnd(true);
                    return true;
                }

                startBtn.innerHTML =
                    '<i class="fa-solid fa-play"></i> يعمل...';

                clearInterval(timerInterval);
                timerInterval = setInterval(updateTimerDisplay, 250);
            }

            return true;
        } catch (e) {
            return false;
        }
    }

    // ========== عرض الوقت ==========
    function updateTimerDisplay() {
        let remaining;

        if (isRunning && endTime) {
            remaining = Math.max(
                0,
                Math.round((endTime - Date.now()) / 1000)
            );
        } else {
            remaining = totalDuration;
        }

        const min = Math.floor(remaining / 60);
        const sec = remaining % 60;

        timerDisplay.textContent =
            `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

        progressBar.style.width =
            `${Math.max(0, (remaining / totalDuration) * 100)}%`;

        if (isRunning && remaining <= 0) {
            clearInterval(timerInterval);

            isRunning = false;
            endTime = null;

            startBtn.innerHTML =
                '<i class="fa-solid fa-play"></i> تشغيل';

            handleTimerEnd(false);
        }

        saveState();
    }

    // ========== عند انتهاء الوقت ==========
    function handleTimerEnd(wasAway) {
        playNotificationSound();

        if (isWorkMode) {
            completedSessions++;
            localStorage.setItem('hayyiz-sessions', completedSessions);

            // إحصائيات اليوم
            ensureTodayStats();
            const sessionsToday = parseInt(localStorage.getItem('hayyiz-sessions-today') || '0', 10) + 1;
            localStorage.setItem('hayyiz-sessions-today', String(sessionsToday));

            const workMin = parseInt(workInput.value, 10) || 25;
            const focusMin = parseInt(localStorage.getItem('hayyiz-focus-minutes-today') || '0', 10) + workMin;
            localStorage.setItem('hayyiz-focus-minutes-today', String(focusMin));

            // سجل أسبوعي بسيط (لا يمسح البيانات القديمة)
            try {
                const hist = JSON.parse(localStorage.getItem('hayyiz-focus-history') || '{}');
                const dayKey = getToday();
                hist[dayKey] = (parseInt(hist[dayKey], 10) || 0) + workMin;
                const keys = Object.keys(hist).sort();
                while (keys.length > 30) {
                    delete hist[keys.shift()];
                }
                localStorage.setItem('hayyiz-focus-history', JSON.stringify(hist));
            } catch (e) { /* تجاهل */ }

            if (sessionsCount) {
                sessionsCount.textContent = completedSessions;
            }

            // تحديث خطة المهمة + تقدم المهمة + المادة عبر الطبقة المشتركة
            if (typeof hayyizApplyFocusResult === 'function') {
                const applied = hayyizApplyFocusResult({
                    workMin: workMin,
                    taskId: localStorage.getItem('hayyiz-current-task-id') || (taskSession && taskSession.id),
                    taskText: currentTask
                });
                if (applied && applied.plan) {
                    taskSession = applied.plan;
                } else if (taskSession && taskSession.text === currentTask) {
                    taskSession.sessionsDone = (taskSession.sessionsDone || 0) + 1;
                    taskSession.focusDone = (taskSession.focusDone || 0) + workMin;
                    if (taskSession.totalMinutes) {
                        taskSession.sessionsNeeded = Math.ceil(taskSession.totalMinutes / workMin);
                    }
                    saveTaskSession(taskSession);
                }
            } else if (taskSession && taskSession.text === currentTask) {
                taskSession.sessionsDone = (taskSession.sessionsDone || 0) + 1;
                taskSession.focusDone = (taskSession.focusDone || 0) + workMin;
                if (taskSession.totalMinutes) {
                    taskSession.sessionsNeeded = Math.ceil(
                        taskSession.totalMinutes / workMin
                    );
                }
                saveTaskSession(taskSession);
                try {
                    const todos = JSON.parse(localStorage.getItem('hayyiz-todos') || '[]');
                    let idx = typeof taskSession.index === 'number' ? taskSession.index : -1;
                    if (idx < 0 || !todos[idx] || todos[idx].text !== currentTask) {
                        idx = todos.findIndex((t) => t.text === currentTask && !t.completed);
                    }
                    if (idx >= 0 && todos[idx]) {
                        todos[idx].focusDone = taskSession.focusDone;
                        todos[idx].sessionsDone = taskSession.sessionsDone;
                        localStorage.setItem('hayyiz-todos', JSON.stringify(todos));
                    }
                } catch (e) { /* تجاهل */ }
            }
            updateTaskMeta();

            // دورة الجلسات: بعد 4 جلسات تركيز → راحة طويلة
            sessionInCycle++;
            if (sessionInCycle >= 4) {
                sessionInCycle = 0;
                nextBreakIsLong = true;
            } else {
                nextBreakIsLong = false;
            }
            localStorage.setItem('hayyiz-session-in-cycle', String(sessionInCycle));

            const breakMin = nextBreakIsLong
                ? (parseInt(longBreakInput?.value, 10) || 15)
                : (parseInt(breakInput?.value, 10) || 5);

            showNotification(
                'حيز - بومودورو',
                nextBreakIsLong
                    ? `انتهت الجلسة! راحة طويلة ${breakMin} دقيقة.`
                    : `انتهت جلسة التركيز (${workMin} د). راحة ${breakMin} دقيقة.`
            );

            switchToBreak(nextBreakIsLong);

            if (!wasAway) {
                showSessionEndModal(workMin);
            }
        } else {
            showNotification(
                'حيز - بومودورو',
                'انتهت الراحة! ابدأ جلسة جديدة.'
            );

            if (!wasAway) {
                alert('انتهت الراحة! ابدأ جلسة جديدة.');
            }

            switchToWork();
        }

        saveState();
    }

    // ========== مودال بعد انتهاء جلسة التركيز ==========
    function showSessionEndModal(workMinJustDone) {
        document.querySelector('.session-end-overlay')?.remove();

        const taskName = localStorage.getItem('hayyiz-current-task');
        const taskIndexRaw = localStorage.getItem('hayyiz-current-task-index');
        const taskIndex = taskIndexRaw !== null ? parseInt(taskIndexRaw, 10) : -1;
        const plan = loadTaskSession();
        const doneMin = workMinJustDone || (parseInt(workInput?.value, 10) || 25);

        const overlay = document.createElement('div');
        overlay.className = 'session-end-overlay task-modal-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        const modal = document.createElement('div');
        modal.className = 'task-modal';

        const h3 = document.createElement('h3');
        h3.textContent = 'انتهت جلسة التركيز 💪';
        modal.appendChild(h3);

        const summary = document.createElement('p');
        summary.style.color = 'var(--text-muted)';
        summary.style.fontSize = '0.95rem';
        let summaryText = `أكملت جلسة تركيز · ${doneMin} دقيقة`;
        if (plan && plan.sessionsDone) {
            summaryText = `أكملت ${plan.sessionsDone} جلسة تركيز · ${plan.focusDone || doneMin} دقيقة`;
            if (plan.totalMinutes) {
                summaryText += ` من أصل ${plan.totalMinutes}`;
            }
        }
        summary.textContent = summaryText;
        modal.appendChild(summary);

        if (taskName) {
            const nameP = document.createElement('p');
            nameP.className = 'task-name';
            nameP.textContent = taskName;
            modal.appendChild(nameP);
        }

        const goalReached =
            plan &&
            plan.totalMinutes &&
            (plan.focusDone || 0) >= plan.totalMinutes;

        const q = document.createElement('p');
        q.textContent = goalReached
            ? 'وصلت لهدف دقائق المهمة. ماذا تريد؟'
            : 'ماذا تريد أن تفعل الآن؟';
        modal.appendChild(q);

        const actions = document.createElement('div');
        actions.className = 'modal-actions';
        actions.style.flexDirection = 'column';
        actions.style.gap = '0.5rem';

        function closeModal() {
            overlay.remove();
        }

        // إنهاء المهمة
        if (taskName && Number.isInteger(taskIndex) && taskIndex >= 0) {
            const completeBtn = document.createElement('button');
            completeBtn.type = 'button';
            completeBtn.className = 'btn btn-primary';
            completeBtn.innerHTML = goalReached
                ? '<i class="fa-solid fa-check"></i> تم — تعليم المهمة كمكتملة'
                : '<i class="fa-solid fa-check"></i> تعليم المهمة كمكتملة';
            completeBtn.addEventListener('click', () => {
                const taskId = localStorage.getItem('hayyiz-current-task-id') || (plan && plan.id) || null;
                if (typeof hayyizCompleteTask === 'function') {
                    hayyizCompleteTask(taskId, taskName, taskIndex);
                } else {
                    try {
                        const todos = JSON.parse(localStorage.getItem('hayyiz-todos') || '[]');
                        const todayStr = typeof getTodayLocal === 'function' ? getTodayLocal() : null;
                        if (todos[taskIndex] && todos[taskIndex].text === taskName) {
                            todos[taskIndex].completed = true;
                            if (todayStr) todos[taskIndex].completedAt = todayStr;
                            localStorage.setItem('hayyiz-todos', JSON.stringify(todos));
                        } else {
                            const found = todos.findIndex((t) => t.text === taskName && !t.completed);
                            if (found >= 0) {
                                todos[found].completed = true;
                                if (todayStr) todos[found].completedAt = todayStr;
                                localStorage.setItem('hayyiz-todos', JSON.stringify(todos));
                            }
                        }
                    } catch (e) { /* تجاهل */ }
                }
                localStorage.removeItem('hayyiz-current-task');
                localStorage.removeItem('hayyiz-current-task-index');
                localStorage.removeItem('hayyiz-current-task-id');
                saveTaskSession(null);
                taskSession = null;
                currentTask = null;
                closeModal();
            });
            actions.appendChild(completeBtn);
        }

        // المهمة التالية (إن وُجدت)
        try {
            const allTodos = JSON.parse(localStorage.getItem('hayyiz-todos') || '[]');
            const orderPri = { high: 3, medium: 2, low: 1 };
            const remaining = allTodos
                .map((t, i) => ({ t, i }))
                .filter(({ t }) => !t.completed && t.text !== taskName)
                .sort((a, b) => {
                    const pDiff = (orderPri[b.t.priority] || 0) - (orderPri[a.t.priority] || 0);
                    if (pDiff !== 0) return pDiff;
                    const dateA = a.t.date ? new Date(a.t.date).getTime() : Infinity;
                    const dateB = b.t.date ? new Date(b.t.date).getTime() : Infinity;
                    return dateA - dateB;
                });
            if (remaining.length > 0) {
                const next = remaining[0];
                const nextBtn = document.createElement('button');
                nextBtn.type = 'button';
                nextBtn.className = 'btn btn-outline';
                nextBtn.innerHTML =
                    '<i class="fa-solid fa-forward" aria-hidden="true"></i> المهمة التالية: ' +
                    (next.t.text.length > 28 ? next.t.text.slice(0, 28) + '…' : next.t.text);
                nextBtn.addEventListener('click', () => {
                    const workMinPref = parseInt(localStorage.getItem('hayyiz-pref-work') || '25', 10) || 25;
                    const totalMinutes = next.t.minutes ? parseInt(next.t.minutes, 10) : null;
                    const planNext = {
                        text: next.t.text,
                        index: next.i,
                        totalMinutes: totalMinutes && totalMinutes > 0 ? totalMinutes : null,
                        focusDone: next.t.focusDone ? parseInt(next.t.focusDone, 10) || 0 : 0,
                        sessionsDone: next.t.sessionsDone ? parseInt(next.t.sessionsDone, 10) || 0 : 0,
                        sessionsNeeded:
                            totalMinutes && totalMinutes > 0
                                ? Math.ceil(totalMinutes / workMinPref)
                                : null
                    };
                    localStorage.setItem('hayyiz-current-task', next.t.text);
                    localStorage.setItem('hayyiz-current-task-index', String(next.i));
                    localStorage.setItem('hayyiz-task-session', JSON.stringify(planNext));
                    window.location.href = 'pomodoro.html?task=' + encodeURIComponent(next.t.text);
                });
                actions.appendChild(nextBtn);
            }
        } catch (e) { /* تجاهل */ }

        // كتابة ملاحظة
        const noteBtn = document.createElement('button');
        noteBtn.type = 'button';
        noteBtn.className = 'btn btn-outline';
        noteBtn.innerHTML = '<i class="fa-solid fa-note-sticky"></i> اكتب ملاحظة سريعة';
        noteBtn.addEventListener('click', () => {
            const title = taskName ? encodeURIComponent(taskName) : '';
            const q = title
                ? '?title=' + title + '&task=' + title
                : '';
            window.location.href = 'notes.html' + q;
        });
        actions.appendChild(noteBtn);

        // متابعة الراحة فقط
        const restBtn = document.createElement('button');
        restBtn.type = 'button';
        restBtn.className = 'btn btn-outline';
        restBtn.textContent = 'متابعة الراحة';
        restBtn.addEventListener('click', closeModal);
        actions.appendChild(restBtn);

        modal.appendChild(actions);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
    }

    // ========== التحكم ==========
    function startTimer() {
        if (isRunning) return;

        let remaining = endTime
            ? Math.max(
                0,
                Math.round((endTime - Date.now()) / 1000)
            )
            : totalDuration;

        if (remaining <= 0) {
            remaining = totalDuration;
        }

        endTime = Date.now() + remaining * 1000;
        isRunning = true;

        startBtn.innerHTML =
            '<i class="fa-solid fa-play"></i> يعمل...';

        clearInterval(timerInterval);
        timerInterval = setInterval(updateTimerDisplay, 250);

        updateTimerDisplay();
        saveState();
    }

    function pauseTimer() {
        if (!isRunning) return;

        clearInterval(timerInterval);
        isRunning = false;

        if (endTime) {
            totalDuration = Math.max(
                0,
                Math.round((endTime - Date.now()) / 1000)
            );

            endTime = null;
        }

        startBtn.innerHTML =
            '<i class="fa-solid fa-play"></i> تشغيل';

        updateTimerDisplay();
        saveState();
    }

    function resetTimer() {
        clearInterval(timerInterval);

        isRunning = false;
        endTime = null;

        let mins;
        if (isWorkMode) {
            mins = parseInt(workInput.value, 10) || 25;
        } else if (nextBreakIsLong) {
            mins = parseInt(longBreakInput?.value, 10) || 15;
        } else {
            mins = parseInt(breakInput.value, 10) || 5;
        }
        totalDuration = mins * 60;

        startBtn.innerHTML =
            '<i class="fa-solid fa-play"></i> تشغيل';

        updateTimerDisplay();
        saveState();
    }

    function switchToWork() {
        isWorkMode = true;
        nextBreakIsLong = false;

        modeWork.classList.add('active');
        modeBreak.classList.remove('active');

        resetTimer();
        updateTaskMeta();
    }

    function switchToBreak(isLong) {
        isWorkMode = false;
        if (typeof isLong === 'boolean') {
            nextBreakIsLong = isLong;
        }

        modeBreak.classList.add('active');
        modeWork.classList.remove('active');

        resetTimer();
    }

    // ========== حفظ عند مغادرة الصفحة ==========
    window.addEventListener('beforeunload', (e) => {
        saveState();

        if (isRunning) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            saveState();
        } else {
            updateTimerDisplay();
        }
    });

    // ========== الأحداث ==========
    startBtn.addEventListener('click', startTimer);
    pauseBtn.addEventListener('click', pauseTimer);
    resetBtn.addEventListener('click', resetTimer);

    modeWork.addEventListener('click', () => {
        pauseTimer();
        switchToWork();
    });

    modeBreak.addEventListener('click', () => {
        pauseTimer();
        switchToBreak();
    });

    workInput.addEventListener('change', () => {
        if (isWorkMode && !isRunning) {
            resetTimer();
        }
        // تحديث meta المهمة
        const metaEl = document.getElementById('current-task-meta');
        if (metaEl && currentTask) {
            const workMin = parseInt(workInput.value, 10) || 25;
            metaEl.textContent = `4 جلسات تركيز · ${workMin * 4} دقيقة`;
        }
    });

    breakInput.addEventListener('change', () => {
        if (!isWorkMode && !isRunning) {
            resetTimer();
        }
    });

    if (longBreakInput) {
        longBreakInput.addEventListener('change', () => {
            saveState();
        });
    }

    // ========== بدء التشغيل ==========
    const restored = loadState();

    if (!restored) {
        totalDuration =
            (parseInt(workInput.value, 10) || 25) * 60;

        updateTimerDisplay();
    } else {
        updateTimerDisplay();
    }

    // ========== زر تفعيل الإشعارات ==========
    const notifBtn =
        document.getElementById('enable-notifications-btn');

    function updateNotifButton() {
        if (!notifBtn) return;

        if (!('Notification' in window)) {
            notifBtn.style.display = 'none';
            return;
        }

        const permission = Notification.permission;

        if (permission === 'granted') {
            notifBtn.innerHTML =
                '<i class="fa-solid fa-bell"></i> التنبيه مفعّل';

            notifBtn.disabled = true;
            notifBtn.style.opacity = '0.7';

        } else if (permission === 'denied') {
            notifBtn.innerHTML =
                '<i class="fa-solid fa-bell-slash"></i> التنبيه مرفوض';

            notifBtn.disabled = true;
            notifBtn.style.opacity = '0.7';

        } else {
            notifBtn.innerHTML =
                '<i class="fa-solid fa-bell"></i> تفعيل التنبيه';

            notifBtn.disabled = false;
            notifBtn.style.opacity = '1';
        }
    }

    if (notifBtn) {
        notifBtn.addEventListener('click', function () {
            if (!('Notification' in window)) {
                alert('متصفحك لا يدعم الإشعارات');
                return;
            }

            if (Notification.permission === 'denied') {
                alert(
                    'لقد رفضت الإشعارات سابقاً. يمكنك تفعيلها من إعدادات المتصفح.'
                );

                updateNotifButton();
                return;
            }

            if (Notification.permission === 'granted') {
                updateNotifButton();
                return;
            }

            Notification.requestPermission()
                .then(function (permission) {
                    updateNotifButton();

                    if (permission === 'granted') {
                        try {
                            new Notification(
                                'حيز - بومودورو',
                                {
                                    body: 'تم تفعيل التنبيهات بنجاح.',
                                    icon: 'favicon-32x32.png'
                                }
                            );
                        } catch (e) {}
                    } else if (permission === 'denied') {
                        alert('تم رفض الإشعارات.');
                    }
                })
                .catch(function () {});
        });

        updateNotifButton();
    }
});