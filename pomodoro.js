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

    // ========== المهمة الحالية ==========
    const urlParams = new URLSearchParams(window.location.search);
    const taskFromUrl = urlParams.get('task');
    const taskFromStorage = localStorage.getItem('hayyiz-current-task');
    const currentTask = taskFromUrl || taskFromStorage || null;

    if (currentTask) {
        localStorage.setItem('hayyiz-current-task', currentTask);
        const box = document.getElementById('current-task-box');
        const nameEl = document.getElementById('current-task-name');
        const metaEl = document.getElementById('current-task-meta');
        if (box && nameEl) {
            box.style.display = 'block';
            nameEl.textContent = currentTask;
            if (metaEl) {
                const workMin = parseInt(workInput?.value, 10) || 25;
                metaEl.textContent = `4 جلسات تركيز · ${workMin * 4} دقيقة`;
            }
        }
    }

    // ========== الحالة ==========
    let timerInterval = null;
    let endTime = null;
    let totalDuration = 25 * 60;
    let isRunning = false;
    let isWorkMode = true;
    let completedSessions = parseInt(localStorage.getItem('hayyiz-sessions') || '0', 10);
    let sessionInCycle = parseInt(localStorage.getItem('hayyiz-session-in-cycle') || '0', 10);

    if (sessionsCount) sessionsCount.textContent = completedSessions;

    function getToday() {
        return new Date().toISOString().slice(0, 10);
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

    // ========== إشعار ==========
    function showNotification(title, body) {
        if (!('Notification' in window)) return;

        if (Notification.permission === 'granted') {
            try {
                new Notification(title, {
                    body: body,
                    icon: 'favicon-32x32.png',
                    silent: false
                });
            } catch (e) {}
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

            if (sessionsCount) {
                sessionsCount.textContent = completedSessions;
            }

            // دورة الجلسات: بعد 4 جلسات → راحة طويلة
            sessionInCycle++;
            if (sessionInCycle >= 4) {
                sessionInCycle = 0;
                const longMin = parseInt(longBreakInput?.value, 10) || 15;
                if (breakInput) breakInput.value = longMin;
            } else {
                // إعادة الراحة القصيرة الافتراضية إذا كانت الراحة الطويلة مفعّلة سابقًا
                // لا نفرض 5 إن غيّر المستخدم القيمة يدويًا أثناء الدورة؛ نترك القيمة الحالية
            }
            localStorage.setItem('hayyiz-session-in-cycle', String(sessionInCycle));

            showNotification(
                'حيز - بومودورو',
                'انتهت جلسة الدراسة! حان وقت الراحة.'
            );

            switchToBreak();

            if (!wasAway) {
                showSessionEndModal();
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
    function showSessionEndModal() {
        document.querySelector('.session-end-overlay')?.remove();

        const currentTask = localStorage.getItem('hayyiz-current-task');
        const taskIndexRaw = localStorage.getItem('hayyiz-current-task-index');
        const taskIndex = taskIndexRaw !== null ? parseInt(taskIndexRaw, 10) : -1;

        const overlay = document.createElement('div');
        overlay.className = 'session-end-overlay task-modal-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        const modal = document.createElement('div');
        modal.className = 'task-modal';

        const h3 = document.createElement('h3');
        h3.textContent = 'انتهت جلسة التركيز 💪';
        modal.appendChild(h3);

        if (currentTask) {
            const nameP = document.createElement('p');
            nameP.className = 'task-name';
            nameP.textContent = currentTask;
            modal.appendChild(nameP);
        }

        const q = document.createElement('p');
        q.textContent = 'ماذا تريد أن تفعل الآن؟';
        modal.appendChild(q);

        const actions = document.createElement('div');
        actions.className = 'modal-actions';
        actions.style.flexDirection = 'column';
        actions.style.gap = '0.5rem';

        function closeModal() {
            overlay.remove();
        }

        // إنهاء المهمة
        if (currentTask && Number.isInteger(taskIndex) && taskIndex >= 0) {
            const completeBtn = document.createElement('button');
            completeBtn.type = 'button';
            completeBtn.className = 'btn btn-primary';
            completeBtn.innerHTML = '<i class="fa-solid fa-check"></i> تعليم المهمة كمكتملة';
            completeBtn.addEventListener('click', () => {
                try {
                    const todos = JSON.parse(localStorage.getItem('hayyiz-todos') || '[]');
                    if (todos[taskIndex] && todos[taskIndex].text === currentTask) {
                        todos[taskIndex].completed = true;
                        localStorage.setItem('hayyiz-todos', JSON.stringify(todos));
                    } else {
                        // بحث بالاسم إذا تغيّر الفهرس
                        const found = todos.findIndex((t) => t.text === currentTask && !t.completed);
                        if (found >= 0) {
                            todos[found].completed = true;
                            localStorage.setItem('hayyiz-todos', JSON.stringify(todos));
                        }
                    }
                } catch (e) { /* تجاهل */ }
                localStorage.removeItem('hayyiz-current-task');
                localStorage.removeItem('hayyiz-current-task-index');
                closeModal();
            });
            actions.appendChild(completeBtn);
        }

        // كتابة ملاحظة
        const noteBtn = document.createElement('button');
        noteBtn.type = 'button';
        noteBtn.className = 'btn btn-outline';
        noteBtn.innerHTML = '<i class="fa-solid fa-note-sticky"></i> اكتب ملاحظة سريعة';
        noteBtn.addEventListener('click', () => {
            const title = currentTask ? encodeURIComponent(currentTask) : '';
            window.location.href = 'notes.html' + (title ? '?title=' + title : '');
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

        totalDuration =
            (isWorkMode
                ? parseInt(workInput.value, 10) || 25
                : parseInt(breakInput.value, 10) || 5
            ) * 60;

        startBtn.innerHTML =
            '<i class="fa-solid fa-play"></i> تشغيل';

        updateTimerDisplay();
        saveState();
    }

    function switchToWork() {
        isWorkMode = true;

        modeWork.classList.add('active');
        modeBreak.classList.remove('active');

        resetTimer();
    }

    function switchToBreak() {
        isWorkMode = false;

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