document.addEventListener('DOMContentLoaded', () => {

    // ========== Service Worker ==========
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    // ========== عناصر الصفحة ==========
    const timerDisplay = document.getElementById('timer-display');
    const progressBar = document.getElementById('timer-progress-bar');
    const startBtn = document.getElementById('timer-start-btn');
    const pauseBtn = document.getElementById('timer-pause-btn');
    const resetBtn = document.getElementById('timer-reset-btn');
    const workInput = document.getElementById('work-minutes');
    const breakInput = document.getElementById('break-minutes');
    const modeWork = document.getElementById('mode-work');
    const modeBreak = document.getElementById('mode-break');
    const sessionsCount = document.getElementById('completed-sessions-count');

    // ========== الحالة ==========
    let timerInterval = null;
    let endTime = null;
    let totalDuration = 25 * 60;
    let isRunning = false;
    let isWorkMode = true;
    let completedSessions = parseInt(localStorage.getItem('hayyiz-sessions') || '0');

    if (sessionsCount) sessionsCount.textContent = completedSessions;

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
            breakMinutes: breakInput.value
        };
        localStorage.setItem('hayyiz-pomodoro-state', JSON.stringify(state));
    }

    function loadState() {
        try {
            const raw = localStorage.getItem('hayyiz-pomodoro-state');
            if (!raw) return false;

            const state = JSON.parse(raw);

            if (state.workMinutes) workInput.value = state.workMinutes;
            if (state.breakMinutes) breakInput.value = state.breakMinutes;

            isWorkMode = state.isWorkMode !== false;
            totalDuration = state.totalDuration || (isWorkMode ? workInput.value : breakInput.value) * 60;
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
                const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
                if (remaining <= 0) {
                    isRunning = false;
                    endTime = null;
                    handleTimerEnd(true);
                    return true;
                }
                startBtn.innerHTML = '<i class="fa-solid fa-play"></i> يعمل...';
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
            remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
        } else {
            remaining = totalDuration;
        }

        const min = Math.floor(remaining / 60);
        const sec = remaining % 60;
        timerDisplay.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        progressBar.style.width = `${Math.max(0, (remaining / totalDuration) * 100)}%`;

        if (isRunning && remaining <= 0) {
            clearInterval(timerInterval);
            isRunning = false;
            endTime = null;
            startBtn.innerHTML = '<i class="fa-solid fa-play"></i> تشغيل';
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
            if (sessionsCount) sessionsCount.textContent = completedSessions;

            showNotification('حيز - بومودورو', 'انتهت جلسة الدراسة! حان وقت الراحة.');
            if (!wasAway) alert('انتهت جلسة الدراسة! حان وقت الراحة.');
            switchToBreak();
        } else {
            showNotification('حيز - بومودورو', 'انتهت الراحة! ابدأ جلسة جديدة.');
            if (!wasAway) alert('انتهت الراحة! ابدأ جلسة جديدة.');
            switchToWork();
        }

        saveState();
    }

    // ========== التحكم ==========
    function startTimer() {
        if (isRunning) return;

        let remaining = endTime
            ? Math.max(0, Math.round((endTime - Date.now()) / 1000))
            : totalDuration;

        if (remaining <= 0) remaining = totalDuration;

        endTime = Date.now() + remaining * 1000;
        isRunning = true;
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> يعمل...';
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
            totalDuration = Math.max(0, Math.round((endTime - Date.now()) / 1000));
            endTime = null;
        }

        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> تشغيل';
        updateTimerDisplay();
        saveState();
    }

    function resetTimer() {
        clearInterval(timerInterval);
        isRunning = false;
        endTime = null;
        totalDuration = (isWorkMode ? parseInt(workInput.value) || 25 : parseInt(breakInput.value) || 5) * 60;
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> تشغيل';
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
        if (isWorkMode && !isRunning) resetTimer();
    });

    breakInput.addEventListener('change', () => {
        if (!isWorkMode && !isRunning) resetTimer();
    });

    // ========== بدء التشغيل ==========
    const restored = loadState();
    if (!restored) {
        totalDuration = (parseInt(workInput.value) || 25) * 60;
        updateTimerDisplay();
    } else {
        updateTimerDisplay();
    }

    // ========== زر تفعيل الإشعارات ==========
    const notifBtn = document.getElementById('enable-notifications-btn');

    function updateNotifButton() {
        if (!notifBtn) return;

        if (!('Notification' in window)) {
            notifBtn.style.display = 'none';
            return;
        }

        if (Notification.permission === 'granted') {
            notifBtn.innerHTML = '<i class="fa-solid fa-bell"></i> التنبيه مفعّل';
            notifBtn.disabled = true;
            notifBtn.style.opacity = '0.7';
            notifBtn.style.cursor = 'default';
        } else if (Notification.permission === 'denied') {
            notifBtn.innerHTML = '<i class="fa-solid fa-bell-slash"></i> التنبيه مرفوض';
            notifBtn.disabled = true;
            notifBtn.style.opacity = '0.7';
            notifBtn.style.cursor = 'default';
        } else {
            notifBtn.innerHTML = '<i class="fa-solid fa-bell"></i> تفعيل التنبيه';
            notifBtn.disabled = false;
            notifBtn.style.opacity = '1';
            notifBtn.style.cursor = 'pointer';
        }
    }

    if (notifBtn) {
        notifBtn.addEventListener('click', function () {
            if (!('Notification' in window)) {
                alert('متصفحك لا يدعم الإشعارات');
                return;
            }

            if (Notification.permission === 'granted' || Notification.permission === 'denied') {
                updateNotifButton();
                return;
            }

            Notification.requestPermission().then(function (permission) {
                updateNotifButton();

                if (permission === 'granted') {
                    try {
                        new Notification('حيز - بومودورو', {
                            body: 'تم تفعيل التنبيهات بنجاح. سننبهك عند انتهاء الجلسة.',
                            icon: 'favicon-32x32.png'
                        });
                    } catch (e) {}
                }
            }).catch(function () {});
        });

        updateNotifButton();
    }
});
