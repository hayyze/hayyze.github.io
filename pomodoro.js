document.addEventListener('DOMContentLoaded', () => {
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

    let timerInterval = null;
    let endTime = null;
    let totalDuration = 25 * 60;
    let isRunning = false;
    let isWorkMode = true;
    let completedSessions = parseInt(localStorage.getItem('hayyiz-sessions') || '0');

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

    if (sessionsCount) sessionsCount.textContent = completedSessions;

    function updateTimerDisplay() {
        let remaining = isRunning && endTime ? Math.max(0, Math.round((endTime - Date.now()) / 1000)) : totalDuration;
        const min = Math.floor(remaining / 60);
        const sec = remaining % 60;
        timerDisplay.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        progressBar.style.width = `${(remaining / totalDuration) * 100}%`;

        if (isRunning && remaining <= 0) {
            clearInterval(timerInterval);
            isRunning = false;
            startBtn.innerHTML = '<i class="fa-solid fa-play"></i> تشغيل';
            playNotificationSound();

            if (isWorkMode) {
                completedSessions++;
                localStorage.setItem('hayyiz-sessions', completedSessions);
                sessionsCount.textContent = completedSessions;
                alert('انتهت جلسة الدراسة! حان وقت الراحة.');
                switchToBreak();
            } else {
                alert('انتهت الراحة! ابدأ جلسة جديدة.');
                switchToWork();
            }
        }
    }

    function startTimer() {
        if (isRunning) return;
        let remaining = endTime ? Math.max(0, Math.round((endTime - Date.now()) / 1000)) : totalDuration;
        endTime = Date.now() + remaining * 1000;
        isRunning = true;
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> يعمل...';
        clearInterval(timerInterval);
        timerInterval = setInterval(updateTimerDisplay, 200);
        updateTimerDisplay();
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
    }

    function resetTimer() {
        clearInterval(timerInterval);
        isRunning = false;
        endTime = null;
        totalDuration = (isWorkMode ? parseInt(workInput.value) : parseInt(breakInput.value)) * 60;
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> تشغيل';
        updateTimerDisplay();
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

    startBtn.addEventListener('click', startTimer);
    pauseBtn.addEventListener('click', pauseTimer);
    resetBtn.addEventListener('click', resetTimer);
    modeWork.addEventListener('click', () => { pauseTimer(); switchToWork(); });
    modeBreak.addEventListener('click', () => { pauseTimer(); switchToBreak(); });
    workInput.addEventListener('change', () => { if (isWorkMode) resetTimer(); });
    breakInput.addEventListener('change', () => { if (!isWorkMode) resetTimer(); });

    updateTimerDisplay();
});