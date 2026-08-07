document.addEventListener('DOMContentLoaded', async () => {

    // ===================== تحميل القاموس =====================
    let dictionary = null;
    try {
        const response = await fetch('words.json');
        if (!response.ok) throw new Error('فشل تحميل القاموس');
        dictionary = await response.json();
        console.log('تم تحميل القاموس بنجاح');
    } catch (error) {
        console.error('خطأ في تحميل words.json:', error);
        alert('تعذر تحميل قاموس الكلمات. تأكد أن ملف words.json موجود في نفس المجلد.');
    }

    // ===================== نظام الصوت =====================
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

            setTimeout(() => {
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.type = 'sine';
                osc2.frequency.value = 660;
                gain2.gain.setValueAtTime(0.25, ctx.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                osc2.start();
                osc2.stop(ctx.currentTime + 0.5);
            }, 300);
        } catch (e) {
            console.log('تعذر تشغيل الصوت');
        }
    }

    // ===================== العناصر العامة =====================
    const body = document.body;
    const themeToggle = document.getElementById('theme-toggle');
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const logoBtn = document.getElementById('logo-btn');
    const toolCards = document.querySelectorAll('.tool-card');

    // ===================== دالة التبديل بين الصفحات =====================
    function switchTab(tabId) {
        navBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        tabContents.forEach(tab => {
            tab.classList.toggle('active', tab.id === `tab-${tabId}`);
        });
        navLinks.classList.remove('open');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        updateHomeStats();
    }

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    if (logoBtn) {
        logoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('home');
        });
    }

    toolCards.forEach(card => {
        card.addEventListener('click', () => {
            const tab = card.dataset.tab;
            if (tab) switchTab(tab);
        });
    });

    // ===================== الثيم =====================
    const savedTheme = localStorage.getItem('hayyiz-theme') || 'light';
    body.classList.toggle('theme-dark', savedTheme === 'dark');
    updateThemeIcon();

    themeToggle.addEventListener('click', () => {
        body.classList.toggle('theme-dark');
        const isDark = body.classList.contains('theme-dark');
        localStorage.setItem('hayyiz-theme', isDark ? 'dark' : 'light');
        updateThemeIcon();
    });

    function updateThemeIcon() {
        const icon = themeToggle.querySelector('i');
        icon.className = body.classList.contains('theme-dark') ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }

    // ===================== القائمة للجوال =====================
    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('open');
    });

    // ===================== المودال =====================
    const privacyLink = document.getElementById('privacy-link');
    const privacyModal = document.getElementById('privacy-modal');
    const closeModal = document.querySelector('.close-modal');

    privacyLink.addEventListener('click', (e) => {
        e.preventDefault();
        privacyModal.classList.remove('hidden');
    });
    closeModal.addEventListener('click', () => privacyModal.classList.add('hidden'));
    privacyModal.addEventListener('click', (e) => {
        if (e.target === privacyModal) privacyModal.classList.add('hidden');
    });

    // ===================== البومودورو (توقيت حقيقي + صوت) =====================
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

    sessionsCount.textContent = completedSessions;

    function updateTimerDisplay() {
        let remaining = 0;
        if (isRunning && endTime) {
            remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
        } else {
            remaining = totalDuration;
        }

        const min = Math.floor(remaining / 60);
        const sec = remaining % 60;
        timerDisplay.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

        const progress = totalDuration > 0 ? (remaining / totalDuration) * 100 : 0;
        progressBar.style.width = `${progress}%`;

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
            updateHomeStats();
        }
    }

    function startTimer() {
        if (isRunning) return;

        let remaining = totalDuration;
        if (endTime) {
            remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
        }

        endTime = Date.now() + (remaining * 1000);
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
            const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
            totalDuration = remaining;
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

    // ===================== قائمة المهام + عداد المهام =====================
    let todos = JSON.parse(localStorage.getItem('hayyiz-todos') || '[]');
    let currentFilter = 'all';
    let currentTaskTimer = null; // { index, endTime, total }

    const todoForm = document.getElementById('todo-form');
    const todoInput = document.getElementById('todo-input');
    const todoPriority = document.getElementById('todo-priority');
    const todoDate = document.getElementById('todo-date');
    const todoMinutes = document.getElementById('todo-minutes');
    const todoList = document.getElementById('todo-list');
    const todoEmpty = document.getElementById('todo-empty');
    const filterBtns = document.querySelectorAll('.filter-btn');

    function saveTodos() {
        localStorage.setItem('hayyiz-todos', JSON.stringify(todos));
        updateHomeStats();
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function startTaskTimer(index) {
        // إيقاف أي مؤقت مهمة سابق فقط
        if (window.taskTimerInterval) {
            clearInterval(window.taskTimerInterval);
        }

        const todo = todos[index];
        if (!todo.minutes) return;

        const totalSeconds = parseInt(todo.minutes) * 60;
        currentTaskTimer = {
            index: index,
            endTime: Date.now() + totalSeconds * 1000,
            total: totalSeconds
        };

        window.taskTimerInterval = setInterval(() => {
            const remaining = Math.max(0, Math.round((currentTaskTimer.endTime - Date.now()) / 1000));

            const timerEl = document.getElementById(`task-timer-${index}`);
            if (timerEl) {
                timerEl.textContent = formatTime(remaining);
            }

            if (remaining <= 0) {
                clearInterval(window.taskTimerInterval);
                window.taskTimerInterval = null;
                currentTaskTimer = null;

                playNotificationSound();
                alert(`انتهى وقت المهمة: ${todo.text}`);
                renderTodos();
            }
        }, 200);

        renderTodos();
    }

    function stopTaskTimer() {
        if (window.taskTimerInterval) {
            clearInterval(window.taskTimerInterval);
            window.taskTimerInterval = null;
        }
        currentTaskTimer = null;
        renderTodos();
    }

    function renderTodos() {
        let filtered = todos;
        if (currentFilter === 'active') filtered = todos.filter(t => !t.completed);
        if (currentFilter === 'completed') filtered = todos.filter(t => t.completed);
        if (currentFilter === 'high') filtered = todos.filter(t => t.priority === 'high');

        todoList.innerHTML = '';
        if (filtered.length === 0) {
            todoEmpty.classList.remove('hidden');
            return;
        }
        todoEmpty.classList.add('hidden');

        filtered.forEach((todo) => {
            const realIndex = todos.indexOf(todo);
            const isThisTaskRunning = currentTaskTimer && currentTaskTimer.index === realIndex;

            let timerHTML = '';
            if (todo.minutes && !todo.completed) {
                if (isThisTaskRunning) {
                    const remaining = Math.max(0, Math.round((currentTaskTimer.endTime - Date.now()) / 1000));
                    timerHTML = `
                        <div class="task-timer-box">
                            <span class="task-timer" id="task-timer-${realIndex}">${formatTime(remaining)}</span>
                            <button class="btn btn-outline btn-sm stop-task-timer" data-index="${realIndex}">
                                <i class="fa-solid fa-stop"></i> إيقاف
                            </button>
                        </div>
                    `;
                } else {
                    timerHTML = `
                        <div class="task-timer-box">
                            <span class="task-duration">${todo.minutes} دقيقة</span>
                            <button class="btn btn-primary btn-sm start-task-timer" data-index="${realIndex}">
                                <i class="fa-solid fa-play"></i> بدء
                            </button>
                        </div>
                    `;
                }
            }

            const li = document.createElement('li');
            li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
            li.innerHTML = `
                <input type="checkbox" class="todo-check" ${todo.completed ? 'checked' : ''} data-index="${realIndex}">
                <div class="todo-content">
                    <div class="todo-text">${todo.text}</div>
                    <div class="todo-meta">
                        <span class="priority-${todo.priority}">
                            ${todo.priority === 'high' ? 'عالية' : todo.priority === 'medium' ? 'متوسطة' : 'منخفضة'}
                        </span>
                        ${todo.date ? `<span><i class="fa-regular fa-calendar"></i> ${new Date(todo.date).toLocaleString('ar-EG')}</span>` : ''}
                        ${todo.minutes ? `<span><i class="fa-solid fa-hourglass-half"></i> ${todo.minutes} د</span>` : ''}
                    </div>
                    ${timerHTML}
                </div>
                <button class="todo-delete" data-index="${realIndex}"><i class="fa-solid fa-trash"></i></button>
            `;
            todoList.appendChild(li);
        });
    }

    todoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = todoInput.value.trim();
        if (!text) return;
        todos.unshift({
            text,
            priority: todoPriority.value,
            date: todoDate.value || null,
            minutes: todoMinutes.value || null,
            completed: false,
            created: Date.now()
        });
        saveTodos();
        todoInput.value = '';
        todoDate.value = '';
        todoMinutes.value = '';
        renderTodos();
    });

    todoList.addEventListener('click', (e) => {
        if (e.target.classList.contains('todo-check')) {
            const i = e.target.dataset.index;
            todos[i].completed = e.target.checked;
            if (currentTaskTimer && currentTaskTimer.index == i) {
                stopTaskTimer();
            }
            saveTodos();
            renderTodos();
        }

        if (e.target.closest('.todo-delete')) {
            const i = e.target.closest('.todo-delete').dataset.index;
            if (currentTaskTimer && currentTaskTimer.index == i) {
                stopTaskTimer();
            }
            todos.splice(i, 1);
            saveTodos();
            renderTodos();
        }

        if (e.target.closest('.start-task-timer')) {
            const i = e.target.closest('.start-task-timer').dataset.index;
            startTaskTimer(parseInt(i));
        }

        if (e.target.closest('.stop-task-timer')) {
            stopTaskTimer();
        }
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTodos();
        });
    });

    renderTodos();

    // ===================== الملاحظات =====================
    let notes = JSON.parse(localStorage.getItem('hayyiz-notes') || '[]');

    const notesForm = document.getElementById('notes-form');
    const noteTitle = document.getElementById('note-title');
    const noteContent = document.getElementById('note-content');
    const notesList = document.getElementById('notes-list');
    const notesEmpty = document.getElementById('notes-empty');
    const notesSearch = document.getElementById('notes-search');
    const clearNoteBtn = document.getElementById('clear-note-btn');

    function saveNotes() {
        localStorage.setItem('hayyiz-notes', JSON.stringify(notes));
    }

    function renderNotes(filter = '') {
        const filtered = notes.filter(n =>
            n.title.includes(filter) || n.content.includes(filter)
        );
        notesList.innerHTML = '';
        if (filtered.length === 0) {
            notesEmpty.classList.remove('hidden');
            return;
        }
        notesEmpty.classList.add('hidden');

        filtered.forEach((note) => {
            const realIndex = notes.indexOf(note);
            const div = document.createElement('div');
            div.className = 'note-card';
            div.innerHTML = `
                <button class="note-delete" data-index="${realIndex}"><i class="fa-solid fa-trash"></i></button>
                <h4>${note.title || 'بدون عنوان'}</h4>
                <p>${note.content}</p>
                <div class="note-date">${new Date(note.created).toLocaleString('ar-EG')}</div>
            `;
            notesList.appendChild(div);
        });
    }

    notesForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const content = noteContent.value.trim();
        if (!content) return;
        notes.unshift({
            title: noteTitle.value.trim(),
            content,
            created: Date.now()
        });
        saveNotes();
        noteTitle.value = '';
        noteContent.value = '';
        renderNotes();
    });

    clearNoteBtn.addEventListener('click', () => {
        noteTitle.value = '';
        noteContent.value = '';
    });

    notesList.addEventListener('click', (e) => {
        if (e.target.closest('.note-delete')) {
            const i = e.target.closest('.note-delete').dataset.index;
            notes.splice(i, 1);
            saveNotes();
            renderNotes(notesSearch.value);
        }
    });

    notesSearch.addEventListener('input', () => {
        renderNotes(notesSearch.value.trim());
    });

    renderNotes();

    // ===================== متتبع العادات =====================
    let habits = JSON.parse(localStorage.getItem('hayyiz-habits') || '[]');

    const habitForm = document.getElementById('habit-form');
    const habitInput = document.getElementById('habit-input');
    const habitsList = document.getElementById('habits-list');
    const habitsEmpty = document.getElementById('habits-empty');
    const totalHabitsEl = document.getElementById('total-habits');
    const bestStreakEl = document.getElementById('best-streak');
    const todayCompletedEl = document.getElementById('today-completed');

    function getToday() {
        return new Date().toISOString().slice(0, 10);
    }

    function saveHabits() {
        localStorage.setItem('hayyiz-habits', JSON.stringify(habits));
        updateHabitStats();
        updateHomeStats();
    }

    function updateHabitStats() {
        totalHabitsEl.textContent = habits.length;
        let best = 0;
        let todayCount = 0;
        const today = getToday();
        habits.forEach(h => {
            if (h.streak > best) best = h.streak;
            if (h.lastCompleted === today) todayCount++;
        });
        bestStreakEl.textContent = best;
        todayCompletedEl.textContent = todayCount;
    }

    function renderHabits() {
        habitsList.innerHTML = '';
        if (habits.length === 0) {
            habitsEmpty.classList.remove('hidden');
            return;
        }
        habitsEmpty.classList.add('hidden');

        const today = getToday();
        habits.forEach((habit, i) => {
            const doneToday = habit.lastCompleted === today;
            const div = document.createElement('div');
            div.className = 'habit-item';
            div.innerHTML = `
                <input type="checkbox" class="habit-check" ${doneToday ? 'checked' : ''} data-index="${i}">
                <div class="habit-info">
                    <div class="habit-name">${habit.name}</div>
                    <div class="habit-streak">السلسلة الحالية: <strong>${habit.streak} يوم</strong></div>
                </div>
                <button class="habit-delete" data-index="${i}"><i class="fa-solid fa-trash"></i></button>
            `;
            habitsList.appendChild(div);
        });
        updateHabitStats();
    }

    habitForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = habitInput.value.trim();
        if (!name) return;
        habits.push({ name, streak: 0, lastCompleted: null });
        saveHabits();
        habitInput.value = '';
        renderHabits();
    });

    habitsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('habit-check')) {
            const i = e.target.dataset.index;
            const today = getToday();
            const habit = habits[i];

            if (e.target.checked) {
                if (habit.lastCompleted !== today) {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayStr = yesterday.toISOString().slice(0, 10);
                    habit.streak = (habit.lastCompleted === yesterdayStr) ? habit.streak + 1 : 1;
                    habit.lastCompleted = today;
                }
            } else {
                if (habit.lastCompleted === today) {
                    habit.streak = Math.max(0, habit.streak - 1);
                    habit.lastCompleted = null;
                }
            }
            saveHabits();
            renderHabits();
        }

        if (e.target.closest('.habit-delete')) {
            const i = e.target.closest('.habit-delete').dataset.index;
            habits.splice(i, 1);
            saveHabits();
            renderHabits();
        }
    });

    renderHabits();

    // ===================== لعبة الحروف (مع القاموس + توقيت حقيقي) =====================
    const letters = 'أبتثجحخدذرزسشصضطظعغفقكلمنهوي';
    let currentLetter = '';
    let gameEndTime = null;
    let gameTimerInterval = null;
    let highScore = parseInt(localStorage.getItem('hayyiz-highscore') || '0');

    const currentLetterEl = document.getElementById('current-letter');
    const startGameBtn = document.getElementById('start-game-btn');
    const gameForm = document.getElementById('game-form');
    const gameTimerDisplay = document.getElementById('game-timer-display');
    const gameResultBox = document.getElementById('game-result-box');
    const highScoreEl = document.getElementById('high-score');

    highScoreEl.textContent = highScore;

    function normalize(str) {
        return str.trim().replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/أ|إ|آ/g, 'ا');
    }

    function isValidWord(category, letter, word) {
        if (!dictionary || !dictionary[category] || !dictionary[category][letter]) return false;
        const list = dictionary[category][letter];
        const normalizedWord = normalize(word);
        return list.some(item => normalize(item) === normalizedWord);
    }

    function updateGameTimer() {
        if (!gameEndTime) return;
        const remaining = Math.max(0, Math.round((gameEndTime - Date.now()) / 1000));
        gameTimerDisplay.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> الوقت: ${remaining}ث`;

        if (remaining <= 0) {
            clearInterval(gameTimerInterval);
            submitGame();
        }
    }

    startGameBtn.addEventListener('click', () => {
        if (!dictionary) {
            alert('القاموس غير محمّل. تأكد من وجود ملف words.json');
            return;
        }

        const availableLetters = letters.split('').filter(l => {
            return dictionary.human[l] || dictionary.animal[l] || dictionary.plant[l] ||
                   dictionary.thing[l] || dictionary.country[l];
        });

        currentLetter = availableLetters[Math.floor(Math.random() * availableLetters.length)];
        currentLetterEl.textContent = currentLetter;

        gameForm.classList.remove('hidden');
        gameResultBox.classList.add('hidden');
        startGameBtn.classList.add('hidden');

        gameEndTime = Date.now() + 60000;
        clearInterval(gameTimerInterval);
        gameTimerInterval = setInterval(updateGameTimer, 200);
        updateGameTimer();

        ['g-human', 'g-animal', 'g-plant', 'g-thing', 'g-country'].forEach(id => {
            document.getElementById(id).value = '';
        });
    });

    gameForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitGame();
    });

    function submitGame() {
        clearInterval(gameTimerInterval);
        gameEndTime = null;

        const answers = {
            human: document.getElementById('g-human').value.trim(),
            animal: document.getElementById('g-animal').value.trim(),
            plant: document.getElementById('g-plant').value.trim(),
            thing: document.getElementById('g-thing').value.trim(),
            country: document.getElementById('g-country').value.trim()
        };

        let score = 0;
        let details = [];

        const categories = [
            { key: 'human', label: 'إنسان' },
            { key: 'animal', label: 'حيوان' },
            { key: 'plant', label: 'نبات' },
            { key: 'thing', label: 'جماد' },
            { key: 'country', label: 'بلاد' }
        ];

        categories.forEach(cat => {
            const word = answers[cat.key];

            if (!word) {
                details.push(`
                    <div style="margin-bottom: 10px; font-size: 0.95rem; line-height: 1.6;">
                        <strong>${cat.label}:</strong>
                        <span style="color: #94a3b8;">— لم تُدخل إجابة</span>
                    </div>
                `);
                return;
            }

            if (isValidWord(cat.key, currentLetter, word)) {
                score += 20;
                details.push(`
                    <div style="margin-bottom: 10px; font-size: 0.95rem; line-height: 1.6;">
                        <strong>${cat.label}:</strong>
                        <span style="color: #059669; font-weight: 700;">${word}</span>
                        <span style="color: #059669; font-weight: 700; margin-right: 6px;">✓ صح</span>
                    </div>
                `);
            } else {
                details.push(`
                    <div style="margin-bottom: 10px; font-size: 0.95rem; line-height: 1.6;">
                        <strong>${cat.label}:</strong>
                        <span style="color: #dc2626; font-weight: 700;">${word}</span>
                        <span style="color: #dc2626; font-weight: 700; margin-right: 6px;">✗ غير موجود بالقاموس</span>
                    </div>
                `);
            }
        });

        if (score > highScore) {
            highScore = score;
            localStorage.setItem('hayyiz-highscore', highScore);
            highScoreEl.textContent = highScore;
        }

        gameResultBox.innerHTML = `
            <div style="font-size: 1.5rem; margin-bottom: 20px; font-weight: 800; text-align: center;">
                نتيجتك: ${score} / 100
            </div>
            <div style="text-align: right;">
                ${details.join('')}
            </div>
            <p style="margin-top: 20px; color: #64748b; font-size: 0.95rem; text-align: center;">
                الحرف المطلوب كان: <strong style="color: var(--primary);">${currentLetter}</strong>
            </p>
        `;

        gameResultBox.classList.remove('hidden');
        gameForm.classList.add('hidden');
        startGameBtn.classList.remove('hidden');
        startGameBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> جولة جديدة';
    }

    // ===================== إحصائيات الرئيسية =====================
    function updateHomeStats() {
        document.getElementById('home-sessions').textContent = completedSessions;
        document.getElementById('home-tasks').textContent = todos.filter(t => !t.completed).length;

        let best = 0;
        habits.forEach(h => { if (h.streak > best) best = h.streak; });
        document.getElementById('home-streak').textContent = best;
    }

    updateHomeStats();
});
