document.addEventListener('DOMContentLoaded', () => {

    const storage = {
        get(key, defaultValue) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                return defaultValue;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (error) {}
        }
    };

    function sanitizeText(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    const navBtns = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    window.switchTab = (tabId) => {
        navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
        tabContents.forEach(tab => tab.classList.toggle('active', tab.id === `tab-${tabId}`));
    };

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    const themeBtn = document.getElementById('theme-toggle');
    const savedTheme = storage.get('adawati_theme', 'light');

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const icon = themeBtn ? themeBtn.querySelector('i') : null;
        if (icon) {
            icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
    }

    applyTheme(savedTheme);

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(nextTheme);
            storage.set('adawati_theme', nextTheme);
        });
    }

    const privacyLink = document.getElementById('privacy-link');
    const privacyModal = document.getElementById('privacy-modal');
    const closeModal = document.querySelector('.close-modal');

    if (privacyLink && privacyModal && closeModal) {
        privacyLink.addEventListener('click', (e) => { e.preventDefault(); privacyModal.classList.remove('hidden'); });
        closeModal.addEventListener('click', () => privacyModal.classList.add('hidden'));
    }

    const todoForm = document.getElementById('todo-form');
    const todoInput = document.getElementById('todo-input');
    const todoDateInput = document.getElementById('todo-date');
    const todoMinutesInput = document.getElementById('todo-minutes');
    const todoList = document.getElementById('todo-list');

    let todos = storage.get('adawati_todos', []);

    function saveTodos() {
        storage.set('adawati_todos', todos);
    }

    function getTimeRemainingText(dueDateStr) {
        if (!dueDateStr) return '';
        const due = new Date(dueDateStr).getTime();
        const now = Date.now();
        const diff = due - now;

        if (diff <= 0) {
            return '<span style="color: var(--danger-color); font-weight: bold;">(انتهى الموعد!)</span>';
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        let text = 'متبقي: ';
        if (days > 0) text += `${days} يوم و `;
        if (hours > 0 || days > 0) text += `${hours} ساعة و `;
        text += `${mins} دقيقة`;
        return sanitizeText(text);
    }

    function renderTodos() {
        if (!todoList) return;
        todoList.innerHTML = '';

        todos.forEach(todo => {
            const li = document.createElement('li');
            li.className = `todo-item ${todo.completed ? 'completed' : ''}`;

            const mins = Math.floor((todo.remainingSeconds || 0) / 60);
            const secs = (todo.remainingSeconds || 0) % 60;
            const timerFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

            const safeText = sanitizeText(todo.text);
            const safeDueDate = todo.dueDate ? new Date(todo.dueDate).toLocaleString('ar-SA') : '';

            li.innerHTML = `
                <div class="todo-header-row">
                    <span class="todo-title">${safeText}</span>
                    <button class="btn btn-sm btn-outline btn-delete" title="حذف المهمة">
                        <i class="fa-solid fa-trash" style="color: var(--danger-color);"></i>
                    </button>
                </div>
                
                <div class="todo-meta-row">
                    ${todo.dueDate ? `<span><i class="fa-regular fa-calendar"></i> ${safeDueDate} - ${getTimeRemainingText(todo.dueDate)}</span>` : ''}
                </div>

                <div class="todo-actions">
                    ${todo.durationMinutes ? `
                        <span class="timer-badge">${timerFormatted}</span>
                        <button class="btn btn-sm ${todo.isRunning ? 'btn-secondary' : 'btn-primary'} btn-toggle-timer">
                            <i class="fa-solid ${todo.isRunning ? 'fa-pause' : 'fa-play'}"></i> ${todo.isRunning ? 'إيقاف' : 'بدء'}
                        </button>
                        <button class="btn btn-sm btn-outline btn-reset-timer">
                            <i class="fa-solid fa-rotate-right"></i> إعادة ضبط
                        </button>
                    ` : ''}

                    <button class="btn btn-sm ${todo.completed ? 'btn-outline' : 'btn-primary'} btn-toggle-complete" style="margin-right: auto;">
                        <i class="fa-solid ${todo.completed ? 'fa-arrow-rotate-left' : 'fa-check'}"></i> ${todo.completed ? 'تراجع' : 'اكتملت المهمة'}
                    </button>
                </div>
            `;

            li.querySelector('.btn-delete').addEventListener('click', () => deleteTodo(todo.id));
            li.querySelector('.btn-toggle-complete').addEventListener('click', () => toggleComplete(todo.id));

            const toggleTimerBtn = li.querySelector('.btn-toggle-timer');
            if (toggleTimerBtn) toggleTimerBtn.addEventListener('click', () => toggleTaskTimer(todo.id));

            const resetTimerBtn = li.querySelector('.btn-reset-timer');
            if (resetTimerBtn) resetTimerBtn.addEventListener('click', () => resetTaskTimer(todo.id));

            todoList.appendChild(li);
        });
    }

    if (todoForm) {
        todoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = todoInput.value.trim();
            
            if (!text) {
                alert('عفوًا، يرجى كتابة نص المهمة أولاً.');
                return;
            }

            const duration = parseInt(todoMinutesInput.value) || null;

            todos.push({
                id: Date.now(),
                text: text,
                dueDate: todoDateInput.value || null,
                durationMinutes: duration,
                remainingSeconds: duration ? duration * 60 : 0,
                isRunning: false,
                completed: false
            });

            saveTodos();
            renderTodos();
            todoForm.reset();
        });
    }

    function toggleComplete(id) {
        todos = todos.map(t => t.id === id ? { ...t, completed: !t.completed, isRunning: false } : t);
        saveTodos();
        renderTodos();
    }

    function deleteTodo(id) {
        todos = todos.filter(t => t.id !== id);
        saveTodos();
        renderTodos();
    }

    function toggleTaskTimer(id) {
        todos = todos.map(t => t.id === id ? { ...t, isRunning: !t.isRunning } : t);
        saveTodos();
        renderTodos();
    }

    function resetTaskTimer(id) {
        todos = todos.map(t => t.id === id ? { ...t, remainingSeconds: (t.durationMinutes || 0) * 60, isRunning: false } : t);
        saveTodos();
        renderTodos();
    }

    setInterval(() => {
        let updated = false;
        todos = todos.map(t => {
            if (t.isRunning && t.remainingSeconds > 0) {
                updated = true;
                const nextSec = t.remainingSeconds - 1;
                return { ...t, remainingSeconds: nextSec, isRunning: nextSec > 0 };
            }
            return t;
        });

        if (updated) {
            saveTodos();
            renderTodos();
        }
    }, 1000);

    renderTodos();

    const pomodoroState = storage.get('adawati_pomodoro', {
        mode: 'work',
        timeLeft: 25 * 60,
        isRunning: false,
        completedSessions: 0
    });

    let pomodoroTimer = null;
    const timerDisplay = document.getElementById('timer-display');
    const startBtn = document.getElementById('timer-start-btn');
    const pauseBtn = document.getElementById('timer-pause-btn');
    const resetBtn = document.getElementById('timer-reset-btn');
    const sessionsCountDisplay = document.getElementById('completed-sessions-count');
    const workModeBtn = document.getElementById('mode-work');
    const breakModeBtn = document.getElementById('mode-break');

    function savePomodoroState() {
        storage.set('adawati_pomodoro', pomodoroState);
    }

    function updatePomodoroUI() {
        const m = Math.floor(pomodoroState.timeLeft / 60);
        const s = pomodoroState.timeLeft % 60;
        if (timerDisplay) timerDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        if (sessionsCountDisplay) sessionsCountDisplay.textContent = pomodoroState.completedSessions;

        if (workModeBtn && breakModeBtn) {
            workModeBtn.classList.toggle('active', pomodoroState.mode === 'work');
            breakModeBtn.classList.toggle('active', pomodoroState.mode === 'break');
        }
    }

    function startPomodoro() {
        if (pomodoroTimer) return;
        pomodoroState.isRunning = true;
        savePomodoroState();

        pomodoroTimer = setInterval(() => {
            if (pomodoroState.timeLeft > 0) {
                pomodoroState.timeLeft--;
                updatePomodoroUI();
                savePomodoroState();
            } else {
                clearInterval(pomodoroTimer);
                pomodoroTimer = null;
                pomodoroState.isRunning = false;

                if (pomodoroState.mode === 'work') {
                    pomodoroState.completedSessions++;
                    alert('أحسنت! انتهت فترة الدراسة. حان وقت الراحة.');
                    setPomodoroMode('break');
                } else {
                    alert('انتهت فترة الراحة! استعد للجولة القادمة.');
                    setPomodoroMode('work');
                }
            }
        }, 1000);
    }

    function pausePomodoro() {
        clearInterval(pomodoroTimer);
        pomodoroTimer = null;
        pomodoroState.isRunning = false;
        savePomodoroState();
    }

    function setPomodoroMode(mode) {
        pausePomodoro();
        pomodoroState.mode = mode;
        pomodoroState.timeLeft = (mode === 'work' ? 25 : 5) * 60;
        updatePomodoroUI();
        savePomodoroState();
    }

    if (startBtn) startBtn.addEventListener('click', startPomodoro);
    if (pauseBtn) pauseBtn.addEventListener('click', pausePomodoro);
    if (resetBtn) resetBtn.addEventListener('click', () => setPomodoroMode(pomodoroState.mode));

    if (workModeBtn) workModeBtn.addEventListener('click', () => setPomodoroMode('work'));
    if (breakModeBtn) breakModeBtn.addEventListener('click', () => setPomodoroMode('break'));

    updatePomodoroUI();
    if (pomodoroState.isRunning) startPomodoro();

    function normalizeArabicText(text) {
        if (!text) return '';
        return text
            .trim()
            .replace(/[\u064B-\u0652]/g, '')
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي');
    }

    const gameForm = document.getElementById('game-form');
    if (gameForm) {
        gameForm.addEventListener('submit', (e) => {
            ['g-human', 'g-animal', 'g-plant', 'g-thing', 'g-country'].forEach(id => {
                const input = document.getElementById(id);
                if (input) {
                    input.value = normalizeArabicText(input.value);
                }
            });
        });
    }
});
