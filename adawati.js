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

    // ========== Navigation ==========
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');

    window.switchTab = (tabId) => {
        navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
        tabContents.forEach(tab => tab.classList.toggle('active', tab.id === `tab-${tabId}`));
        // إغلاق قائمة الجوال بعد الاختيار
        if (navLinks) navLinks.classList.remove('open');
    };

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('open');
            const icon = menuToggle.querySelector('i');
            if (icon) {
                icon.className = navLinks.classList.contains('open')
                    ? 'fa-solid fa-xmark'
                    : 'fa-solid fa-bars';
            }
        });
    }

    // ========== Theme ==========
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

    // ========== Privacy Modal ==========
    const privacyLink = document.getElementById('privacy-link');
    const privacyModal = document.getElementById('privacy-modal');
    const closeModal = document.querySelector('.close-modal');

    if (privacyLink && privacyModal && closeModal) {
        privacyLink.addEventListener('click', (e) => {
            e.preventDefault();
            privacyModal.classList.remove('hidden');
        });
        closeModal.addEventListener('click', () => privacyModal.classList.add('hidden'));
        privacyModal.addEventListener('click', (e) => {
            if (e.target === privacyModal) privacyModal.classList.add('hidden');
        });
    }

    // ========== Todo List ==========
    const todoForm = document.getElementById('todo-form');
    const todoInput = document.getElementById('todo-input');
    const todoDateInput = document.getElementById('todo-date');
    const todoMinutesInput = document.getElementById('todo-minutes');
    const todoPriorityInput = document.getElementById('todo-priority');
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

        if (diff <= 0) return '<span style="color: var(--danger-color); font-weight: bold;">(انتهى الموعد!)</span>';

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        let text = 'متبقي: ';
        if (days > 0) text += `${days} يوم و `;
        if (hours > 0 || days > 0) text += `${hours} ساعة و `;
        text += `${mins} دقيقة`;
        return text;
    }

    const priorityLabels = {
        high: 'عالية',
        medium: 'متوسطة',
        low: 'منخفضة'
    };

    function renderTodos() {
        if (!todoList) return;
        todoList.innerHTML = '';

        // ترتيب حسب الأولوية ثم التاريخ
        const sorted = [...todos].sort((a, b) => {
            const order = { high: 0, medium: 1, low: 2 };
            return (order[a.priority] || 1) - (order[b.priority] || 1);
        });

        sorted.forEach(todo => {
            const li = document.createElement('li');
            li.className = `todo-item priority-${todo.priority || 'medium'} ${todo.completed ? 'completed' : ''}`;

            const mins = Math.floor((todo.remainingSeconds || 0) / 60);
            const secs = (todo.remainingSeconds || 0) % 60;
            const timerFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

            const safeText = sanitizeText(todo.text);
            const safeDueDate = todo.dueDate ? new Date(todo.dueDate).toLocaleString('ar-SA') : '';

            li.innerHTML = `
                <div class="todo-header-row">
                    <span class="todo-title">${safeText}</span>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span class="priority-badge">${priorityLabels[todo.priority] || 'متوسطة'}</span>
                        <button class="btn btn-sm btn-outline btn-delete" title="حذف المهمة">
                            <i class="fa-solid fa-trash" style="color: var(--danger-color);"></i>
                        </button>
                    </div>
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
                            <i class="fa-solid fa-rotate-right"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-sm ${todo.completed ? 'btn-outline' : 'btn-primary'} btn-toggle-complete" style="margin-right: auto;">
                        <i class="fa-solid ${todo.completed ? 'fa-arrow-rotate-left' : 'fa-check'}"></i> ${todo.completed ? 'تراجع' : 'اكتملت'}
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
            if (!text) return alert('عفوًا، يرجى كتابة نص المهمة أولاً.');
            const duration = parseInt(todoMinutesInput.value) || null;

            todos.push({
                id: Date.now(),
                text: text,
                priority: todoPriorityInput ? todoPriorityInput.value : 'medium',
                dueDate: todoDateInput.value || null,
                durationMinutes: duration,
                remainingSeconds: duration ? duration * 60 : 0,
                isRunning: false,
                completed: false
            });

            saveTodos();
            renderTodos();
            todoForm.reset();
            if (todoPriorityInput) todoPriorityInput.value = 'medium';
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

    // ========== Pomodoro ==========
    const workMinutesInput = document.getElementById('work-minutes');
    const breakMinutesInput = document.getElementById('break-minutes');

    const pomodoroState = storage.get('adawati_pomodoro', {
        mode: 'work',
        timeLeft: 25 * 60,
        isRunning: false,
        completedSessions: 0,
        workMinutes: 25,
        breakMinutes: 5
    });

    let pomodoroTimer = null;
    const timerDisplay = document.getElementById('timer-display');
    const startBtn = document.getElementById('timer-start-btn');
    const pauseBtn = document.getElementById('timer-pause-btn');
    const resetBtn = document.getElementById('timer-reset-btn');
    const sessionsCountDisplay = document.getElementById('completed-sessions-count');
    const workModeBtn = document.getElementById('mode-work');
    const breakModeBtn = document.getElementById('mode-break');

    // تعبئة القيم المحفوظة
    if (workMinutesInput) workMinutesInput.value = pomodoroState.workMinutes || 25;
    if (breakMinutesInput) breakMinutesInput.value = pomodoroState.breakMinutes || 5;

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

    function playBeep() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 800;
            gain.gain.value = 0.3;
            osc.start();
            setTimeout(() => {
                osc.stop();
                ctx.close();
            }, 400);
        } catch (e) {}
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
                playBeep();

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
        const mins = mode === 'work'
            ? (parseInt(workMinutesInput?.value) || pomodoroState.workMinutes || 25)
            : (parseInt(breakMinutesInput?.value) || pomodoroState.breakMinutes || 5);
        pomodoroState.timeLeft = mins * 60;
        updatePomodoroUI();
        savePomodoroState();
    }

    // تحديث الأوقات عند تغيير المدخلات
    if (workMinutesInput) {
        workMinutesInput.addEventListener('change', () => {
            const val = Math.max(1, Math.min(120, parseInt(workMinutesInput.value) || 25));
            workMinutesInput.value = val;
            pomodoroState.workMinutes = val;
            if (pomodoroState.mode === 'work' && !pomodoroState.isRunning) {
                pomodoroState.timeLeft = val * 60;
                updatePomodoroUI();
            }
            savePomodoroState();
        });
    }

    if (breakMinutesInput) {
        breakMinutesInput.addEventListener('change', () => {
            const val = Math.max(1, Math.min(60, parseInt(breakMinutesInput.value) || 5));
            breakMinutesInput.value = val;
            pomodoroState.breakMinutes = val;
            if (pomodoroState.mode === 'break' && !pomodoroState.isRunning) {
                pomodoroState.timeLeft = val * 60;
                updatePomodoroUI();
            }
            savePomodoroState();
        });
    }

    if (startBtn) startBtn.addEventListener('click', startPomodoro);
    if (pauseBtn) pauseBtn.addEventListener('click', pausePomodoro);
    if (resetBtn) resetBtn.addEventListener('click', () => setPomodoroMode(pomodoroState.mode));
    if (workModeBtn) workModeBtn.addEventListener('click', () => setPomodoroMode('work'));
    if (breakModeBtn) breakModeBtn.addEventListener('click', () => setPomodoroMode('break'));

    updatePomodoroUI();
    if (pomodoroState.isRunning) startPomodoro();

    // ========== Game ==========
    let dictionary = null;
    let gameTimer = null;
    let gameTimeLeft = 60;
    let currentLetter = '';
    let highScore = storage.get('adawati_highscore', 0);

    const highScoreEl = document.getElementById('high-score');
    const currentLetterEl = document.getElementById('current-letter');
    const startGameBtn = document.getElementById('start-game-btn');
    const gameForm = document.getElementById('game-form');
    const gameTimerDisplay = document.getElementById('game-timer-display');
    const gameResultBox = document.getElementById('game-result-box');

    if (highScoreEl) highScoreEl.textContent = highScore;

    // تحميل القاموس
    fetch('words.json')
        .then(res => res.json())
        .then(data => { dictionary = data; })
        .catch(() => {
            // قاموس احتياطي بسيط إذا فشل التحميل
            dictionary = {
                human: { "أ": ["أحمد", "أمل"], "م": ["محمد", "مريم"] },
                animal: { "أ": ["أسد", "أرنب"], "ق": ["قط", "قرد"] },
                plant: { "ت": ["تفاح", "تمر"], "ن": ["نخيل", "نعناع"] },
                thing: { "ق": ["قلم", "كتاب"], "س": ["ساعة", "سرير"] },
                country: { "س": ["السعودية", "سوريا"], "م": ["مصر", "المغرب"] }
            };
        });

    const arabicLetters = ['أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'هـ', 'و', 'ي'];

    function normalizeArabic(str) {
        if (!str) return '';
        return str.trim()
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/ؤ/g, 'و')
            .replace(/ئ/g, 'ي')
            .toLowerCase();
    }

    function checkWord(category, word, letter) {
        if (!dictionary || !word) return false;
        const list = dictionary[category]?.[letter] || [];
        const normalized = normalizeArabic(word);
        return list.some(w => normalizeArabic(w) === normalized);
    }

    function startGame() {
        if (!dictionary) {
            alert('جاري تحميل القاموس، حاول مرة أخرى بعد ثوانٍ.');
            return;
        }

        currentLetter = arabicLetters[Math.floor(Math.random() * arabicLetters.length)];
        if (currentLetterEl) currentLetterEl.textContent = currentLetter;

        gameTimeLeft = 60;
        if (gameTimerDisplay) gameTimerDisplay.textContent = `الوقت: ${gameTimeLeft}ث`;

        if (gameForm) {
            gameForm.classList.remove('hidden');
            gameForm.reset();
        }
        if (gameResultBox) {
            gameResultBox.classList.add('hidden');
            gameResultBox.innerHTML = '';
        }
        if (startGameBtn) startGameBtn.classList.add('hidden');

        clearInterval(gameTimer);
        gameTimer = setInterval(() => {
            gameTimeLeft--;
            if (gameTimerDisplay) gameTimerDisplay.textContent = `الوقت: ${gameTimeLeft}ث`;
            if (gameTimeLeft <= 0) {
                clearInterval(gameTimer);
                submitGame();
            }
        }, 1000);
    }

    function submitGame() {
        clearInterval(gameTimer);

        const answers = {
            human: document.getElementById('g-human')?.value || '',
            animal: document.getElementById('g-animal')?.value || '',
            plant: document.getElementById('g-plant')?.value || '',
            thing: document.getElementById('g-thing')?.value || '',
            country: document.getElementById('g-country')?.value || ''
        };

        const categories = [
            { key: 'human', label: 'إنسان' },
            { key: 'animal', label: 'حيوان' },
            { key: 'plant', label: 'نبات' },
            { key: 'thing', label: 'جماد' },
            { key: 'country', label: 'بلاد' }
        ];

        let score = 0;
        let resultsHtml = '<h3 style="margin-bottom:12px;">نتيجة الجولة</h3><ul style="list-style:none;display:flex;flex-direction:column;gap:8px;">';

        categories.forEach(cat => {
            const word = answers[cat.key];
            const valid = checkWord(cat.key, word, currentLetter);
            if (valid) score += 20;
            resultsHtml += `
                <li style="display:flex;justify-content:space-between;align-items:center;">
                    <span><strong>${cat.label}:</strong> ${sanitizeText(word) || '—'}</span>
                    <span style="color:${valid ? 'var(--accent-color)' : 'var(--danger-color)'};font-weight:700;">
                        ${valid ? '✓ صحيح' : '✗ خطأ'}
                    </span>
                </li>`;
        });

        resultsHtml += `</ul><p style="margin-top:14px;font-size:1.15rem;font-weight:700;">النتيجة: ${score} / 100</p>`;

        if (score > highScore) {
            highScore = score;
            storage.set('adawati_highscore', highScore);
            if (highScoreEl) highScoreEl.textContent = highScore;
            resultsHtml += `<p style="color:var(--accent-color);margin-top:8px;">🎉 رقم قياسي جديد!</p>`;
        }

        if (gameResultBox) {
            gameResultBox.innerHTML = resultsHtml;
            gameResultBox.classList.remove('hidden');
        }
        if (gameForm) gameForm.classList.add('hidden');
        if (startGameBtn) startGameBtn.classList.remove('hidden');
        if (currentLetterEl) currentLetterEl.textContent = '؟';
    }

    if (startGameBtn) startGameBtn.addEventListener('click', startGame);
    if (gameForm) {
        gameForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitGame();
        });
    }

});
