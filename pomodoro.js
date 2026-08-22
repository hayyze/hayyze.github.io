document.addEventListener('DOMContentLoaded', () => {

    // ========== DOM Elements ==========
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
    const srAnnouncer = document.getElementById('sr-timer-announcer');

    // Context & Goal DOM elements (will be enhanced in HTML)
    const contextSelect = document.getElementById('focus-context-select');
    const contextTitleEl = document.getElementById('current-focus-title');
    const contextMetaEl = document.getElementById('current-focus-meta');
    const dailyGoalProgressEl = document.getElementById('daily-goal-progress');
    const dailyGoalTextEl = document.getElementById('daily-goal-text');
    const streakBadgeEl = document.getElementById('focus-streak-badge');

    // Preset buttons
    const presetBtns = document.querySelectorAll('.preset-btn');

    // ========== State Machine Definition ==========
    // Mode: 'focus' | 'break' | 'longBreak'
    // Status: 'idle' | 'running' | 'paused' | 'completed'
    let state = {
        mode: 'focus',
        status: 'idle',
        endTime: null,
        remainingSeconds: 25 * 60,
        totalDuration: 25 * 60,
        sessionInCycle: 0,
        sessionId: null,
        context: {
            type: 'free', // 'task' | 'event' | 'free'
            id: null,
            title: 'تركيز حر',
            subjectId: null
        }
    };

    let timerInterval = null;

    // ========== Prefs & Goal Helper Functions ==========
    function loadPreferences() {
        const savedWork = localStorage.getItem('hayyiz-pref-work');
        const savedBreak = localStorage.getItem('hayyiz-pref-break');
        const savedLong = localStorage.getItem('hayyiz-pref-long');

        if (workInput && savedWork) workInput.value = savedWork;
        if (breakInput && savedBreak) breakInput.value = savedBreak;
        if (longBreakInput && savedLong) longBreakInput.value = savedLong;
    }

    function savePreferences() {
        const w = workInput ? Math.max(1, Math.min(180, parseInt(workInput.value, 10) || 25)) : 25;
        const b = breakInput ? Math.max(1, Math.min(60, parseInt(breakInput.value, 10) || 5)) : 5;
        const lb = longBreakInput ? Math.max(1, Math.min(60, parseInt(longBreakInput.value, 10) || 15)) : 15;

        localStorage.setItem('hayyiz-pref-work', String(w));
        localStorage.setItem('hayyiz-pref-break', String(b));
        localStorage.setItem('hayyiz-pref-long', String(lb));
    }

    [workInput, breakInput, longBreakInput].forEach((inp) => {
        if (inp) {
            inp.addEventListener('change', () => {
                savePreferences();
                if (state.status === 'idle') {
                    resetTimerToCurrentMode();
                }
            });
        }
    });

    // Preset selection logic (e.g. 25/5, 50/10, 90/15)
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const w = parseInt(btn.dataset.work, 10);
            const b = parseInt(btn.dataset.break, 10);
            const lb = parseInt(btn.dataset.longbreak || '15', 10);

            if (workInput) workInput.value = w;
            if (breakInput) breakInput.value = b;
            if (longBreakInput) longBreakInput.value = lb;

            savePreferences();
            presetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (state.status === 'idle') {
                resetTimerToCurrentMode();
            }
        });
    });

    // Screen reader accessible announcement (updates only on state changes)
    function announceSR(msg) {
        if (srAnnouncer) {
            srAnnouncer.textContent = msg;
        }
    }

    // ========== Context Management ==========
    function initContextFromParamsAndStorage() {
        const urlParams = new URLSearchParams(window.location.search);
        const taskFromUrl = urlParams.get('task');
        const eventFromUrl = urlParams.get('event');

        const savedTaskName = localStorage.getItem('hayyiz-current-task');
        const savedTaskId = localStorage.getItem('hayyiz-current-task-id');
        const savedEventRaw = localStorage.getItem('hayyiz-current-event');

        let eventObj = null;
        try { eventObj = savedEventRaw ? JSON.parse(savedEventRaw) : null; } catch (e) {}

        if (taskFromUrl || savedTaskName) {
            const title = taskFromUrl || savedTaskName;
            let taskId = savedTaskId || null;
            let subjectId = null;

            // Try to find subjectId from todo items
            if (typeof hayyizGetTodos === 'function') {
                const todos = hayyizGetTodos();
                const found = todos.find(t => t.text === title || (taskId && t.id === taskId));
                if (found) {
                    if (!taskId) taskId = found.id;
                    subjectId = found.subjectId || null;
                }
            }

            state.context = {
                type: 'task',
                id: taskId,
                title: title,
                subjectId: subjectId
            };
            localStorage.setItem('hayyiz-current-task', title);
            if (taskId) localStorage.setItem('hayyiz-current-task-id', taskId);
        } else if (eventFromUrl || (eventObj && eventObj.name)) {
            const title = eventFromUrl || eventObj.name;
            state.context = {
                type: 'event',
                id: eventObj ? eventObj.id : null,
                title: title,
                subjectId: eventObj ? eventObj.subjectId : null
            };
        } else {
            state.context = {
                type: 'free',
                id: null,
                title: 'تركيز حر',
                subjectId: null
            };
        }

        updateContextUI();
    }

    function updateContextUI() {
        const box = document.getElementById('current-task-box');
        const nameEl = document.getElementById('current-task-name') || contextTitleEl;
        const metaEl = document.getElementById('current-task-meta') || contextMetaEl;

        if (box) box.style.display = 'block';

        if (nameEl) {
            if (state.context.type === 'task') {
                nameEl.textContent = state.context.title;
            } else if (state.context.type === 'event') {
                nameEl.textContent = `استعداد: ${state.context.title}`;
            } else {
                nameEl.textContent = 'جلسة تركيز حرة';
            }
        }

        if (metaEl) {
            const workMin = workInput ? (parseInt(workInput.value, 10) || 25) : 25;
            if (state.context.type === 'task') {
                const plan = loadTaskSession();
                if (plan && plan.totalMinutes) {
                    const needed = plan.sessionsNeeded || Math.ceil(plan.totalMinutes / workMin);
                    const done = plan.sessionsDone || 0;
                    metaEl.textContent = `جلسة ${Math.min(done + 1, needed)} من ${needed} · ${plan.focusDone || 0}/${plan.totalMinutes} دقيقة`;
                } else if (plan && plan.sessionsDone) {
                    metaEl.textContent = `جلسات مكتملة: ${plan.sessionsDone} · ${plan.focusDone || 0} دقيقة`;
                } else {
                    metaEl.textContent = `مهمة محددة · ${workMin} دقيقة لكل جلسة`;
                }
            } else if (state.context.type === 'event') {
                metaEl.textContent = `مرتبط بحدث التقويم · ${workMin} دقيقة`;
            } else {
                metaEl.textContent = `بدون مهمة محددة · ${workMin} دقيقة`;
            }
        }

        // Populating task selector dropdown if present
        if (contextSelect && typeof hayyizGetTodos === 'function') {
            contextSelect.innerHTML = '';

            const freeOpt = document.createElement('option');
            freeOpt.value = 'free';
            freeOpt.textContent = '🎯 تركيز حر (بدون مهمة)';
            contextSelect.appendChild(freeOpt);

            const activeTodos = hayyizGetTodos().filter(t => !t.completed);
            activeTodos.forEach(t => {
                const opt = document.createElement('option');
                opt.value = 'task:' + t.id;
                opt.textContent = '📋 مهمة: ' + t.text;
                if (state.context.type === 'task' && (state.context.id === t.id || state.context.title === t.text)) {
                    opt.selected = true;
                }
                contextSelect.appendChild(opt);
            });

            const calendarEvents = typeof hayyizGetSavedCalendarEvents === 'function' ? hayyizGetSavedCalendarEvents() : [];
            calendarEvents.slice(0, 5).forEach(ev => {
                const opt = document.createElement('option');
                opt.value = 'event:' + ev.id;
                opt.textContent = '📅 حدث: ' + ev.name;
                if (state.context.type === 'event' && (state.context.id === ev.id || state.context.title === ev.name)) {
                    opt.selected = true;
                }
                contextSelect.appendChild(opt);
            });
        }
    }

    if (contextSelect) {
        contextSelect.addEventListener('change', () => {
            const val = contextSelect.value;
            if (val === 'free') {
                state.context = { type: 'free', id: null, title: 'تركيز حر', subjectId: null };
                localStorage.removeItem('hayyiz-current-task');
                localStorage.removeItem('hayyiz-current-task-id');
                localStorage.removeItem('hayyiz-current-event');
            } else if (val.startsWith('task:')) {
                const id = val.replace('task:', '');
                const todos = typeof hayyizGetTodos === 'function' ? hayyizGetTodos() : [];
                const t = todos.find(x => x.id === id);
                if (t) {
                    if (typeof hayyizLaunchPomodoro === 'function') {
                        hayyizLaunchPomodoro(t);
                        return;
                    }
                    state.context = { type: 'task', id: t.id, title: t.text, subjectId: t.subjectId || null };
                    localStorage.setItem('hayyiz-current-task', t.text);
                    localStorage.setItem('hayyiz-current-task-id', t.id);
                }
            } else if (val.startsWith('event:')) {
                const id = val.replace('event:', '');
                const events = typeof hayyizGetAllCalendarEvents === 'function' ? hayyizGetAllCalendarEvents() : [];
                const ev = events.find(x => x.id === id);
                if (ev) {
                    state.context = { type: 'event', id: ev.id, title: ev.name, subjectId: ev.subjectId || null };
                    localStorage.setItem('hayyiz-current-event', JSON.stringify(ev));
                }
            }
            updateContextUI();
        });
    }

    function loadTaskSession() {
        try {
            return JSON.parse(localStorage.getItem('hayyiz-task-session') || 'null');
        } catch (e) { return null; }
    }

    // ========== Sound & Notifications ==========
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

    function showNotification(title, body) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        const options = {
            body: body,
            icon: './android-chrome-192x192.png',
            badge: './favicon-32x32.png',
            tag: 'hayyiz-pomodoro',
            renotify: true,
            silent: false
        };

        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
            navigator.serviceWorker.ready
                .then((reg) => {
                    if (reg && typeof reg.showNotification === 'function') {
                        return reg.showNotification(title, options);
                    }
                    throw new Error('no-sw');
                })
                .catch(() => {
                    try { new Notification(title, options); } catch (e) {}
                });
        } else {
            try { new Notification(title, options); } catch (e) {}
        }
    }

    // ========== State Machine Persistence & Load ==========
    function ensureTodayStats() {
        const today = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
        const lastDay = localStorage.getItem('hayyiz-sessions-day');
        if (lastDay !== today) {
            localStorage.setItem('hayyiz-sessions-today', '0');
            localStorage.setItem('hayyiz-focus-minutes-today', '0');
            localStorage.setItem('hayyiz-sessions-day', today);
        }
    }

    function saveState() {
        if (typeof hayyizEnsureTodayStats === 'function') hayyizEnsureTodayStats();
        else ensureTodayStats();

        const payload = {
            mode: state.mode,
            status: state.status,
            endTime: state.endTime,
            remainingSeconds: state.remainingSeconds,
            totalDuration: state.totalDuration,
            sessionInCycle: state.sessionInCycle,
            sessionId: state.sessionId,
            workMinutes: workInput ? workInput.value : '25',
            breakMinutes: breakInput ? breakInput.value : '5',
            longBreakMinutes: longBreakInput ? longBreakInput.value : '15',
            context: state.context,
            lastUpdated: Date.now()
        };

        if (typeof hayyizSaveFocusState === 'function') {
            hayyizSaveFocusState(payload);
        } else {
            localStorage.setItem('hayyiz-pomodoro-state', JSON.stringify(payload));
        }
        localStorage.setItem('hayyiz-session-in-cycle', String(state.sessionInCycle));
    }

    function loadState() {
        if (typeof hayyizEnsureTodayStats === 'function') hayyizEnsureTodayStats();
        else ensureTodayStats();
        loadPreferences();

        let restored = typeof hayyizReconcilePomodoroState === 'function' ? hayyizReconcilePomodoroState() : null;

        if (!restored) {
            resetTimerToCurrentMode();
            return;
        }

        state.mode = restored.mode || 'focus';
        state.status = restored.status || 'idle';
        state.totalDuration = restored.totalDuration || (state.mode === 'focus' ? parseInt(workInput?.value || '25', 10) * 60 : 5 * 60);
        state.remainingSeconds = typeof restored.remainingSeconds === 'number' ? restored.remainingSeconds : state.totalDuration;
        state.endTime = restored.endTime || null;
        state.sessionInCycle = typeof restored.sessionInCycle === 'number' ? restored.sessionInCycle : 0;
        state.sessionId = restored.sessionId || null;
        if (restored.context) state.context = restored.context;

        // عرض نافذة الاكتمال إذا حُسب الانتهاء أثناء عدم التواجد بالصفحة
        if (restored.pendingCompletionModal) {
            const p = restored.pendingCompletionModal;
            playNotificationSound();
            showNotification(
                'حيز - بومودورو',
                p.isLongBreak
                    ? `أنت بطل! أكملت 4 جلسات تركيز. خذ راحة طويلة (${p.breakMin} د).`
                    : `أحسنت! أتممت جلسة التركيز (${p.workMinJustDone} د). خذ استراحة (${p.breakMin} د).`
            );
            announceSR('انتهت جلسة التركيز بنجاح');
            showCompletionModal(p.workMinJustDone, p.isLongBreak, p.breakMin);

            if (restored.pendingNextMode) {
                state.mode = restored.pendingNextMode;
            }
            state.status = 'idle';
            state.endTime = null;

            // مسح الـ modal من الحالة لتجنب التكرار عند تحديث الصفحة
            delete restored.pendingCompletionModal;
            delete restored.pendingNextMode;
            hayyizSaveFocusState(restored);
            saveState();
            updateUI();
            return;
        }

        if (restored.pendingNextMode) {
            if (state.mode !== restored.pendingNextMode) {
                state.mode = restored.pendingNextMode;
            }
            state.status = 'idle';
            state.endTime = null;
            delete restored.pendingNextMode;
            hayyizSaveFocusState(restored);
            saveState();
            updateUI();
            return;
        }

        if (state.status === 'running' && state.endTime) {
            resumeTimerInterval();
        } else {
            updateUI();
        }
    }

    // ========== Timer Core & UI Renderer ==========
    function resetTimerToCurrentMode() {
        clearInterval(timerInterval);
        state.status = 'idle';
        state.endTime = null;

        let mins = 25;
        if (state.mode === 'focus') {
            mins = parseInt(workInput?.value || '25', 10) || 25;
        } else if (state.mode === 'longBreak') {
            mins = parseInt(longBreakInput?.value || '15', 10) || 15;
        } else {
            mins = parseInt(breakInput?.value || '5', 10) || 5;
        }

        state.totalDuration = mins * 60;
        state.remainingSeconds = state.totalDuration;

        updateUI();
        saveState();
    }

    function startTimer() {
        if (state.status === 'running') return;

        let rem = state.remainingSeconds;
        if (rem <= 0) rem = state.totalDuration;

        state.endTime = Date.now() + rem * 1000;
        state.status = 'running';
        state.sessionId = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

        announceSR('بدأت جلسة ' + (state.mode === 'focus' ? 'التركيز' : 'الراحة'));

        resumeTimerInterval();
        saveState();
    }

    function pauseTimer() {
        if (state.status !== 'running') return;

        clearInterval(timerInterval);
        state.status = 'paused';

        if (state.endTime) {
            state.remainingSeconds = Math.max(0, Math.round((state.endTime - Date.now()) / 1000));
            state.endTime = null;
        }

        announceSR('تم إيقاف المؤقت موقتاً');
        updateUI();
        saveState();
    }

    function resetTimer() {
        resetTimerToCurrentMode();
        announceSR('تمت إعادة ضبط المؤقت');
    }

    function resumeTimerInterval() {
        clearInterval(timerInterval);
        timerInterval = setInterval(tick, 250);
        updateUI();
    }

    function tick() {
        if (state.status !== 'running' || !state.endTime) return;

        // إجراء مطابقة الحالة من مصدر الحقيقة
        const reconciled = typeof hayyizReconcilePomodoroState === 'function' ? hayyizReconcilePomodoroState() : null;

        if (reconciled && (reconciled.status === 'completed' || reconciled.status === 'idle')) {
            clearInterval(timerInterval);
            state.status = 'idle';
            state.endTime = null;
            state.remainingSeconds = reconciled.remainingSeconds;
            if (reconciled.pendingNextMode) state.mode = reconciled.pendingNextMode;

            if (reconciled.pendingCompletionModal) {
                const p = reconciled.pendingCompletionModal;
                playNotificationSound();
                showNotification(
                    'حيز - بومودورو',
                    p.isLongBreak
                        ? `أنت بطل! أكملت 4 جلسات تركيز. خذ راحة طويلة (${p.breakMin} د).`
                        : `أحسنت! أتممت جلسة التركيز (${p.workMinJustDone} د). خذ استراحة (${p.breakMin} د).`
                );
                announceSR('انتهت جلسة التركيز بنجاح');
                showCompletionModal(p.workMinJustDone, p.isLongBreak, p.breakMin);

                delete reconciled.pendingCompletionModal;
                delete reconciled.pendingNextMode;
                hayyizSaveFocusState(reconciled);
            }
            updateUI();
            saveState();
            return;
        }

        state.remainingSeconds = Math.max(0, Math.round((state.endTime - Date.now()) / 1000));
        updateUI();
        saveState();
    }

    // ========== Inline Duration Editing ==========
    let isInlineEditing = false;

    function startInlineEdit() {
        if (state.status !== 'idle' || isInlineEditing || !timerDisplay) return;

        isInlineEditing = true;
        let currentMins = Math.floor(state.remainingSeconds / 60);
        if (state.mode === 'focus') {
            currentMins = parseInt(workInput?.value || '25', 10) || 25;
        } else if (state.mode === 'longBreak') {
            currentMins = parseInt(longBreakInput?.value || '15', 10) || 15;
        } else {
            currentMins = parseInt(breakInput?.value || '5', 10) || 5;
        }

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'timer-inline-input';
        input.value = currentMins;
        input.min = '1';
        input.max = state.mode === 'focus' ? '180' : '60';

        timerDisplay.innerHTML = '';
        timerDisplay.appendChild(input);
        input.focus();
        input.select();

        let finished = false;

        function commitEdit() {
            if (finished) return;
            finished = true;
            isInlineEditing = false;

            const val = parseInt(input.value, 10);
            const maxVal = state.mode === 'focus' ? 180 : 60;

            if (!isNaN(val) && val >= 1 && val <= maxVal) {
                if (state.mode === 'focus') {
                    if (workInput) workInput.value = val;
                } else if (state.mode === 'longBreak') {
                    if (longBreakInput) longBreakInput.value = val;
                } else {
                    if (breakInput) breakInput.value = val;
                }
                savePreferences();
                resetTimerToCurrentMode();
                updateContextUI();
            } else {
                updateUI();
            }
        }

        function cancelEdit() {
            if (finished) return;
            finished = true;
            isInlineEditing = false;
            updateUI();
        }

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            }
        });

        input.addEventListener('blur', () => {
            commitEdit();
        });
    }

    if (timerDisplay) {
        timerDisplay.addEventListener('dblclick', (e) => {
            e.preventDefault();
            startInlineEdit();
        });

        let touchTimer = null;
        timerDisplay.addEventListener('touchend', (e) => {
            if (state.status !== 'idle') return;
            if (touchTimer) {
                clearTimeout(touchTimer);
                touchTimer = null;
                e.preventDefault();
                startInlineEdit();
            } else {
                touchTimer = setTimeout(() => {
                    touchTimer = null;
                }, 300);
            }
        });
    }

    function updateUI() {
        if (isInlineEditing) return;

        const remaining = state.remainingSeconds;
        const min = Math.floor(remaining / 60);
        const sec = remaining % 60;
        const formatted = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

        if (timerDisplay) {
            timerDisplay.textContent = formatted;
        }

        // Update page title during active timer
        if (state.status === 'running') {
            document.title = `(${formatted}) حيز — ${state.mode === 'focus' ? 'تركيز' : 'راحة'}`;
        } else {
            document.title = 'مؤقت بومودورو للمذاكرة أونلاين | حيز';
        }

        if (progressBar) {
            const pct = state.totalDuration > 0 ? (remaining / state.totalDuration) * 100 : 0;
            progressBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
        }

        // Button states
        if (startBtn) {
            if (state.status === 'running') {
                startBtn.innerHTML = '<i class="fa-solid fa-play"></i> يعمل...';
                startBtn.disabled = true;
            } else if (state.status === 'paused') {
                startBtn.innerHTML = '<i class="fa-solid fa-play"></i> استئناف';
                startBtn.disabled = false;
            } else {
                startBtn.innerHTML = '<i class="fa-solid fa-play"></i> تشغيل';
                startBtn.disabled = false;
            }
        }

        if (pauseBtn) {
            pauseBtn.disabled = (state.status !== 'running');
        }

        // Mode tabs active state
        if (modeWork && modeBreak) {
            if (state.mode === 'focus') {
                modeWork.classList.add('active');
                modeBreak.classList.remove('active');
            } else {
                modeBreak.classList.add('active');
                modeWork.classList.remove('active');
            }
        }

        // Completed sessions & Stats
        const totalCompleted = parseInt(localStorage.getItem('hayyiz-sessions') || '0', 10);
        if (sessionsCount) sessionsCount.textContent = totalCompleted;

        updateStatsAndInsightsUI();
    }

    function updateStatsAndInsightsUI() {
        const todayMinutes = parseInt(localStorage.getItem('hayyiz-focus-minutes-today') || '0', 10);
        const todaySessions = parseInt(localStorage.getItem('hayyiz-sessions-today') || '0', 10);

        const todayMinEl = document.getElementById('focus-minutes-today');
        const todaySessEl = document.getElementById('focus-sessions-today');

        if (todayMinEl) todayMinEl.textContent = todayMinutes + ' دقيقة';
        if (todaySessEl) todaySessEl.textContent = todaySessions;

        // Daily Goal Progress
        const dailyGoal = typeof hayyizGetDailyGoal === 'function' ? hayyizGetDailyGoal() : null;
        if (dailyGoalProgressEl && dailyGoalTextEl) {
            const goalTargetMin = 120; // Default daily focus target 120 mins
            const pct = Math.min(100, Math.round((todayMinutes / goalTargetMin) * 100));
            dailyGoalProgressEl.style.width = pct + '%';
            dailyGoalTextEl.textContent = `هدف اليوم: ${todayMinutes}/${goalTargetMin} دقيقة (${pct}%)`;
        }

        // Streak
        if (streakBadgeEl) {
            const streak = typeof hayyizCalculateStreak === 'function' ? hayyizCalculateStreak() : 0;
            streakBadgeEl.textContent = streak > 0 ? `${streak} أيام استمرارية 🔥` : 'ابدأ سلسلة الاستمرارية اليوم!';
        }
    }

    // ========== Completion & Workflow Flow ==========
    function handleTimerCompletion(wasAway) {
        playNotificationSound();

        if (state.mode === 'focus') {
            const workMin = Math.round(state.totalDuration / 60) || 25;

            // 1. Update totals
            const completedTotal = parseInt(localStorage.getItem('hayyiz-sessions') || '0', 10) + 1;
            localStorage.setItem('hayyiz-sessions', String(completedTotal));

            ensureTodayStats();
            const todaySess = parseInt(localStorage.getItem('hayyiz-sessions-today') || '0', 10) + 1;
            const todayMin = parseInt(localStorage.getItem('hayyiz-focus-minutes-today') || '0', 10) + workMin;
            localStorage.setItem('hayyiz-sessions-today', String(todaySess));
            localStorage.setItem('hayyiz-focus-minutes-today', String(todayMin));

            // Focus history map
            try {
                const hist = JSON.parse(localStorage.getItem('hayyiz-focus-history') || '{}');
                const today = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
                hist[today] = (parseInt(hist[today], 10) || 0) + workMin;
                localStorage.setItem('hayyiz-focus-history', JSON.stringify(hist));
            } catch (e) {}

            // Log immutable focus session entry
            if (typeof hayyizLogFocusSession === 'function') {
                hayyizLogFocusSession({
                    durationMinutes: workMin,
                    mode: 'focus',
                    contextType: state.context.type,
                    contextId: state.context.id,
                    contextTitle: state.context.title,
                    subjectId: state.context.subjectId
                });
            }

            // Apply focus to Task / Subject if connected
            if (state.context.type === 'task') {
                if (typeof hayyizApplyFocusResult === 'function') {
                    hayyizApplyFocusResult({
                        workMin: workMin,
                        taskId: state.context.id,
                        taskText: state.context.title
                    });
                }
            } else if (state.context.subjectId && typeof hayyizBumpSubjectProgress === 'function') {
                hayyizBumpSubjectProgress(state.context.subjectId, workMin);
            }

            // Session cycle counter (4 focus sessions -> long break)
            state.sessionInCycle++;
            let isLong = false;
            if (state.sessionInCycle >= 4) {
                state.sessionInCycle = 0;
                isLong = true;
            }

            const nextBreakMin = isLong
                ? (parseInt(longBreakInput?.value || '15', 10) || 15)
                : (parseInt(breakInput?.value || '5', 10) || 5);

            showNotification(
                'حيز - بومودورو',
                isLong
                    ? `أنت بطل! أكملت 4 جلسات تركيز. خذ راحة طويلة (${nextBreakMin} د).`
                    : `أحسنت! أتممت جلسة التركيز (${workMin} د). خذ استراحة (${nextBreakMin} د).`
            );

            announceSR('انتهت جلسة التركيز بنجاح');

            // Switch mode to break
            state.mode = isLong ? 'longBreak' : 'break';
            resetTimerToCurrentMode();

            showCompletionModal(workMin, isLong, nextBreakMin);

        } else {
            // Break completed
            showNotification('حيز - بومودورو', 'انتهت الاستراحة! حان وقت جلسة التركيز التالية.');
            announceSR('انتهت الاستراحة! حان وقت التركيز');

            state.mode = 'focus';
            resetTimerToCurrentMode();

            if (!wasAway) {
                alert('انتهت الاستراحة! اضغط تشغيل للبدء بالجلسة التالية 💪');
            }
        }

        saveState();
    }

    // Interactive Completion Modal
    function showCompletionModal(workMinJustDone, isLongBreak, breakMin) {
        document.querySelector('.session-end-overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.className = 'session-end-overlay task-modal-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        const modal = document.createElement('div');
        modal.className = 'task-modal';

        const h3 = document.createElement('h3');
        h3.innerHTML = '🎉 أحسنت! أتممت جلسة التركيز';
        modal.appendChild(h3);

        const summaryP = document.createElement('p');
        summaryP.style.color = 'var(--text-muted)';
        summaryP.style.fontSize = '0.95rem';
        summaryP.textContent = `أنجزت ${workMinJustDone} دقيقة تركيز حقيقي · ${state.context.title}`;
        modal.appendChild(summaryP);

        const breakNoticeP = document.createElement('p');
        breakNoticeP.style.fontWeight = '700';
        breakNoticeP.style.color = 'var(--primary)';
        breakNoticeP.textContent = isLongBreak
            ? `حان وقت راحة طويلة لمكافأة نفسك (${breakMin} دقيقة)`
            : `خذ استراحة قصيرة لتجديد طاقتك (${breakMin} دقيقة)`;
        modal.appendChild(breakNoticeP);

        const actions = document.createElement('div');
        actions.className = 'modal-actions';
        actions.style.flexDirection = 'column';
        actions.style.gap = '0.5rem';

        function closeModal() {
            overlay.remove();
        }

        // Start Break Immediately
        const startBreakBtn = document.createElement('button');
        startBreakBtn.type = 'button';
        startBreakBtn.className = 'btn btn-primary';
        startBreakBtn.innerHTML = `<i class="fa-solid fa-coffee"></i> ابدأ الاستراحة الآن (${breakMin} د)`;
        startBreakBtn.addEventListener('click', () => {
            closeModal();
            startTimer();
        });
        actions.appendChild(startBreakBtn);

        // Mark Task Complete (If connected to a task)
        if (state.context.type === 'task' && state.context.id) {
            const completeTaskBtn = document.createElement('button');
            completeTaskBtn.type = 'button';
            completeTaskBtn.className = 'btn btn-outline';
            completeTaskBtn.innerHTML = '<i class="fa-solid fa-check"></i> تعليم المهمة كمكتملة';
            completeTaskBtn.addEventListener('click', () => {
                if (typeof hayyizCompleteTask === 'function') {
                    hayyizCompleteTask(state.context.id, state.context.title);
                }
                closeModal();
                updateContextUI();
            });
            actions.appendChild(completeTaskBtn);
        }

        // Switch to Next Recommended Task
        try {
            if (typeof hayyizRecommendNext === 'function') {
                const rec = hayyizRecommendNext(3);
                if (rec && rec.next && rec.next.text !== state.context.title) {
                    const nextBtn = document.createElement('button');
                    nextBtn.type = 'button';
                    nextBtn.className = 'btn btn-outline';
                    nextBtn.innerHTML = `<i class="fa-solid fa-forward"></i> الانتقال للمهمة التالية: ${rec.next.text.slice(0, 25)}…`;
                    nextBtn.addEventListener('click', () => {
                        closeModal();
                        if (typeof hayyizLaunchPomodoro === 'function') {
                            hayyizLaunchPomodoro(rec.next);
                        }
                    });
                    actions.appendChild(nextBtn);
                }
            }
        } catch (e) {}

        // Quick Note
        const noteBtn = document.createElement('button');
        noteBtn.type = 'button';
        noteBtn.className = 'btn btn-outline';
        noteBtn.innerHTML = '<i class="fa-solid fa-note-sticky"></i> تدوين ملاحظة ملخصة';
        noteBtn.addEventListener('click', () => {
            closeModal();
            window.location.href = 'notes.html?title=' + encodeURIComponent(state.context.title);
        });
        actions.appendChild(noteBtn);

        // Close
        const dismissBtn = document.createElement('button');
        dismissBtn.type = 'button';
        dismissBtn.className = 'btn btn-outline';
        dismissBtn.textContent = 'إغلاق ومتابعة';
        dismissBtn.addEventListener('click', closeModal);
        actions.appendChild(dismissBtn);

        modal.appendChild(actions);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
    }

    // ========== Mode Controls ==========
    function switchToWork() {
        pauseTimer();
        state.mode = 'focus';
        resetTimerToCurrentMode();
        updateContextUI();
    }

    function switchToBreak() {
        pauseTimer();
        state.mode = 'break';
        resetTimerToCurrentMode();
    }

    // ========== Event Listeners ==========
    if (startBtn) startBtn.addEventListener('click', () => {
        if (state.status === 'running') return;
        startTimer();
    });

    if (pauseBtn) pauseBtn.addEventListener('click', pauseTimer);
    if (resetBtn) resetBtn.addEventListener('click', resetTimer);

    if (modeWork) modeWork.addEventListener('click', switchToWork);
    if (modeBreak) modeBreak.addEventListener('click', switchToBreak);

    // Document Visibility & Unload Handlers
    window.addEventListener('beforeunload', (e) => {
        saveState();
        if (state.status === 'running') {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            saveState();
        } else {
            loadState();
        }
    });

    // ========== Notifications Permission Button ==========
    const notifBtn = document.getElementById('enable-notifications-btn');
    function updateNotifButton() {
        if (!notifBtn) return;
        if (!('Notification' in window)) {
            notifBtn.style.display = 'none';
            return;
        }
        const perm = Notification.permission;
        if (perm === 'granted') {
            notifBtn.innerHTML = '<i class="fa-solid fa-bell"></i> التنبيه مفعّل';
            notifBtn.disabled = true;
            notifBtn.style.opacity = '0.7';
        } else if (perm === 'denied') {
            notifBtn.innerHTML = '<i class="fa-solid fa-bell-slash"></i> التنبيه مرفوض';
            notifBtn.disabled = true;
            notifBtn.style.opacity = '0.7';
        } else {
            notifBtn.innerHTML = '<i class="fa-solid fa-bell"></i> تفعيل التنبيه';
            notifBtn.disabled = false;
            notifBtn.style.opacity = '1';
        }
    }

    if (notifBtn) {
        notifBtn.addEventListener('click', () => {
            if (!('Notification' in window)) return;
            Notification.requestPermission().then(() => updateNotifButton()).catch(() => {});
        });
        updateNotifButton();
    }

    // ========== Initialization ==========
    initContextFromParamsAndStorage();
    loadState();
});
