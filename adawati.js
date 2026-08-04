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

    function saveTodos() { storage.set('adawati_todos', todos); }

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
            if (!text) return alert('عفوًا، يرجى كتابة نص المهمة أولاً.');
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
        saveTodos(); renderTodos();
    }
    function deleteTodo(id) {
        todos = todos.filter(t => t.id !== id);
        saveTodos(); renderTodos();
    }
    function toggleTaskTimer(id) {
        todos = todos.map(t => t.id === id ? { ...t, isRunning: !t.isRunning } : t);
        saveTodos(); renderTodos();
    }
    function resetTaskTimer(id) {
        todos = todos.map(t => t.id === id ? { ...t, remainingSeconds: (t.durationMinutes || 0) * 60, isRunning: false } : t);
        saveTodos(); renderTodos();
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

        if (updated) { saveTodos(); renderTodos(); }
    }, 1000);

    renderTodos();

    const pomodoroState = storage.get('adawati_pomodoro', { mode: 'work', timeLeft: 25 * 60, isRunning: false, completedSessions: 0 });
    let pomodoroTimer = null;
    const timerDisplay = document.getElementById('timer-display');
    const startBtn = document.getElementById('timer-start-btn');
    const pauseBtn = document.getElementById('timer-pause-btn');
    const resetBtn = document.getElementById('timer-reset-btn');
    const sessionsCountDisplay = document.getElementById('completed-sessions-count');
    const workModeBtn = document.getElementById('mode-work');
    const breakModeBtn = document.getElementById('mode-break');

    function savePomodoroState() { storage.set('adawati_pomodoro', pomodoroState); }

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

    const gameDictionary = {
        "human": { "أ": ["أحمد", "أمل", "أميرة", "أسامة", "أنس", "إبراهيم", "أروى", "أسمهان"], "ب": ["باسم", "بدر", "بسمة", "بشرى", "بلال", "براء", "بثينة"], "ت": ["تامر", "تيم", "تقى", "تميم", "تركي", "تسنيم"], "ث": ["ثامر", "ثريا", "ثابت", "ثناء"], "ج": ["جمال", "جاسر", "جنى", "جواهر", "جميلة", "جابر"], "ح": ["حسن", "حسين", "حنان", "حسام", "حمزة", "حصة"], "خ": ["خالد", "خديجة", "خليل", "خولان", "خولة"], "د": ["داليا", "داوود", "ديمة", "دانة", "دانيال"], "ذ": ["ذيب", "ذكية", "ذاكر"], "ر": ["ريم", "راكان", "رائد", "رانيا", "رضا", "رحمة"], "ز": ["زياد", "زينب", "زكريا", "زهراء", "زين"], "س": ["سارة", "سعود", "سعيد", "سالم", "سلمى", "سليمان"], "ش": ["شهد", "شريف", "شادي", "شوق", "شروق"], "ص": ["صالح", "صفاء", "صلاح", "صديق", "صبرينة"], "ض": ["ضياء", "ضحى", "ضامني"], "ط": ["طاهر", "طلال", "طيبة", "طارق"], "ظ": ["ظافر", "ظبية"], "ع": ["عمر", "علي", "عائشة", "عبدالله", "عبير", "عثمان"], "غ": ["غادة", "غسان", "غيث", "غزل"], "ف": ["فهد", "فاطمة", "فارس", "فيصل", "فراس", "فريدة"], "ق": ["قاسم", "قصي", "قمر"], "ك": ["كريم", "كارم", "كوثر", "كليثم"], "ل": ["ليلى", "لطيفة", "لجين", "لقمان", "لمى"], "م": ["محمد", "مريم", "مشاري", "منى", "ماجد", "محمود"], "ن": ["نورة", "ناصر", "نجلاء", "نايف", "ندى", "نبيل"], "هـ": ["هشام", "هند", "هيا", "هاني", "هدى"], "و": ["وليد", "وفاء", "وسيم", "وجدان", "وداد"], "ي": ["يوسف", "ياسر", "ياسمين", "يعقوب", "يمني"] },
        "animal": { "أ": ["أسد", "أرنب", "أفعى", "أنكليس"], "ب": ["بقرة", "بطة", "بومة", "ببر", "بجع"], "ت": ["تمساح", "تنين", "تيس"], "ث": ["ثعلب", "ثور", "ثعبان"], "ج": ["جمل", "جاموس", "جرو"], "ح": ["حصان", "حمار", "حمامة", "حوت", "حسون"], "خ": ["خروف", "خفاش", "خنزير"], "د": ["دب", "دجاجة", "دلفين", "دبور", "ديك"], "ذ": ["ذئب", "ذباب"], "ر": ["رنة", "راكون"], "ز": ["زرافة", "زنبور"], "س": ["سنجاب", "سمكة", "سلحفاة", "سلطعون"], "ش": ["شاهين", "شادي", "شيمبانزي"], "ص": ["صقر", "صرصور"], "ض": ["ضبع", "ضفدع"], "ط": ["طاووس", "طائر"], "ظ": ["ظبي"], "ع": ["عصفور", "عنكبوت", "عقرب"], "غ": ["غزال", "غراب", "غوريلا"], "ف": ["فيل", "فهد", "فأر", "فراشة"], "ق": ["قرد", "قط", "قنديل البحر", "قنفذ"], "ك": ["كلب", "كغر", "كوالا"], "ل": ["لقلق", "ليث"], "م": ["ماعز", "مهى"], "ن": ["نمر", "نحلة", "نسر", "نملة"], "هـ": ["هدهد", "هرة"], "و": ["واوي", "وحش القرن", "ورل"], "ي": ["يعسوب", "يمامة"] },
        "plant": { "أ": ["أرز", "أناناس", "أفوكادو", "أقحوان"], "ب": ["برتقال", "بطيخ", "باذنجان", "بصل", "باميا", "بقدونس"], "ت": ["تفاح", "تين", "توت", "تمر"], "ث": ["ثوم", "ثوم المعمر"], "ج": ["جزر", "جوز", "جرجير", "جوافة"], "ح": ["حمص", "حلبة", "حبق"], "خ": ["خيار", "خوخ", "خس", "خرشوف"], "د": ["ذرة", "دوار الشمس", "دوم"], "ذ": ["ذرة"], "ر": ["رمان", "ريحان", "رطب"], "ز": ["زيتون", "زنجبيل", "زعتر", "زهرة"], "س": ["سبانخ", "سمسم", "سدر"], "ش": ["شمام", "شاي", "شعير", "شوفان"], "ص": ["صبار", "صنوبر"], "ض": ["ضرم"], "ط": ["طماطم", "طلح"], "ظ": ["ظيان"], "ع": ["عنب", "عدس", "عرعر"], "غ": ["غار"], "ف": ["فراولة", "فلفل", "فول", "فستق"], "ق": ["قرنبيط", "قمح", "قرع", "قرفة"], "ك": ["كوسة", "كرز", "كيوي", "كمثرى", "كزبرة"], "ل": ["ليمون", "لوز", "لفت"], "م": ["موز", "مانجو", "مشمش", "مرمية"], "ن": ["نعناع", "نخلة", "نارجيل"], "هـ": ["هيل", "هندباء"], "و": ["ورد", "وسمة"], "ي": ["يقطين", "يوسفي", "ياسمين"] },
        "thing": { "أ": ["إبرة", "أريكة", "أنبوب"], "ب": ["باب", "بيت", "بندقية", "برميل"], "ت": ["تلفاز", "تلفون", "تاج", "تمثال"], "ث": ["ثلاجة", "ثوب"], "ج": ["جدار", "جرس", "جوال", "جسر"], "ح": ["حبل", "حقيبة", "حاسوب", "حجر"], "خ": ["خزانة", "خاتم", "خيمة", "خيط"], "د": ["دفتر", "دبوس", "دراجة", "دوار"], "ذ": ["ذخيرة"], "ر": ["رف", "رسالة", "راديو", "ريشة"], "ز": ["زجاج", "زر", "زورق"], "س": ["ساعة", "سيارة", "سرير", "سلسلة", "سكين"], "ش": ["شباك", "شاحنة", "شاشة", "شوكة"], "ص": ["صندوق", "صحن", "صواريخ", "صورة"], "ض": ["ضمادة", "ضوء"], "ط": ["طاولة", "طائرة", "طبق", "طربوش"], "ظ": ["ظرف"], "ع": ["عربة", "علم", "عقاد", "عكاز"], "غ": ["غسالة", "غلاف", "غرفة"], "ف": ["فانوس", "فرن", "فستان", "فأس"], "ق": ["قلم", "قفل", "قارب", "قميص", "قبعة"], "ك": ["كرسي", "كتاب", "كرة", "كأس"], "ل": ["لوحة", "لمبة", "لباس"], "م": ["مكتب", "مفتاح", "مرآة", "ملعقة", "مظلة"], "ن": ["نافذة", "نظارة", "نفق"], "هـ": ["هاتف", "هدية"], "و": ["ورقة", "وسادة"], "ي": ["ياخت", "ياقة"] },
        "country": { "أ": ["ألمانيا", "أستراليا", "أمريكا", "أرجنتين", "أردن", "أذربيجان"], "ب": ["البحرين", "برازيل", "بلجيكا", "بلغاريا", "باكستان"], "ت": ["تونس", "تركيا", "تشاد", "تايلاند"], "ث": ["ثيساليا"], "ج": ["الجزائر", "جيبوتي", "جورجيا"], "ح": ["حائل"], "خ": ["خرطوم"], "د": ["الدنمارك", "دبي", "دوحة"], "ذ": ["فقار"], "ر": ["روسيا", "رومانيا", "رياض"], "ز": ["زامبيا", "زيمبابوي"], "س": ["السعودية", "سوريا", "السودان", "سويد", "سويسرا", "سنغافورة"], "ش": ["شيلي", "شارقة"], "ص": ["الصين", "صومال", "صربيا"], "ض": ["ضفة"], "ط": ["طاجيكستان", "طرابلس"], "ظ": ["ظبي"], "ع": ["عمان", "العراق", "أبوظبي"], "غ": ["غانا", "غينيا", "غواتيمالا"], "ف": ["فرنسا", "فلسطين", "فنلندا", "فلبين"], "ق": ["قطر", "قبرص"], "ك": ["الكويت", "كندا", "كولومبيا", "كرواتيا"], "ل": ["لبنان", "ليبيا", "لندن"], "م": ["مصر", "المغرب", "ماليزيا", "مكسيك"], "ن": ["النرويج", "نيجيريا", "نيوزيلندا", "نمسا"], "هـ": ["الهند", "هولندا", "هنغاريا"], "و": ["واشنطن"], "ي": ["اليمن", "اليابان", "يونان"] }
    };

    const letters = ["أ", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "هـ", "و", "ي"];
    
    let currentLetter = '';
    let gameTimer = null;
    let timeLeft = 60;
    let highScore = storage.get('adawati_highscore', 0);

    const startGameBtn = document.getElementById('start-game-btn');
    const currentLetterDisplay = document.getElementById('current-letter');
    const gameTimerDisplay = document.getElementById('game-timer-display');
    const gameForm = document.getElementById('game-form');
    const gameResultBox = document.getElementById('game-result-box');
    const highScoreDisplay = document.getElementById('high-score');

    if (highScoreDisplay) highScoreDisplay.textContent = highScore;

    function normalizeArabicText(text) {
        if (!text) return '';
        return text.trim()
            .replace(/[\u064B-\u0652]/g, '')
            .replace(/[أإآ]/g, 'أ')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي');
    }

    function startGame() {
        currentLetter = letters[Math.floor(Math.random() * letters.length)];
        currentLetterDisplay.textContent = currentLetter;

        timeLeft = 60;
        gameTimerDisplay.textContent = `الوقت: ${timeLeft}ث`;

        gameForm.reset();
        gameForm.classList.remove('hidden');
        gameResultBox.classList.add('hidden');

        clearInterval(gameTimer);
        gameTimer = setInterval(() => {
            timeLeft--;
            gameTimerDisplay.textContent = `الوقت: ${timeLeft}ث`;
            if (timeLeft <= 0) {
                clearInterval(gameTimer);
                endGame();
            }
        }, 1000);
    }

    function endGame() {
        clearInterval(gameTimer);
        let score = 0;
        const fields = [
            { id: 'g-human', category: 'human', name: 'إنسان' },
            { id: 'g-animal', category: 'animal', name: 'حيوان' },
            { id: 'g-plant', category: 'plant', name: 'نبات' },
            { id: 'g-thing', category: 'thing', name: 'جماد' },
            { id: 'g-country', category: 'country', name: 'بلاد' }
        ];

        let resultsHTML = '<h4>نتائج الجولة:</h4><ul>';

        fields.forEach(f => {
            const input = document.getElementById(f.id);
            const val = input ? input.value.trim() : '';
            const normalizedVal = normalizeArabicText(val);

            const categoryData = gameDictionary[f.category][currentLetter] || [];
            const normalizedDict = categoryData.map(item => normalizeArabicText(item));

            if (normalizedVal && normalizedDict.includes(normalizedVal)) {
                score += 10;
                resultsHTML += `<li style="color: var(--accent-color);">✓ ${f.name}: ${val} (+10 نقاط)</li>`;
            } else if (val) {
                resultsHTML += `<li style="color: var(--danger-color);">✗ ${f.name}: ${val} (غير موجودة في القاموس)</li>`;
            } else {
                resultsHTML += `<li style="color: var(--text-muted);">- ${f.name}: لم تُجب</li>`;
            }
        });

        resultsHTML += `</ul><p style="margin-top: 10px; font-weight: bold;">المجموع: ${score} نقطة</p>`;

        if (score > highScore) {
            highScore = score;
            storage.set('adawati_highscore', highScore);
            if (highScoreDisplay) highScoreDisplay.textContent = highScore;
            resultsHTML += '<p style="color: var(--accent-color); font-weight: bold;">🎉 رقم قياسي جديد!</p>';
        }

        gameResultBox.innerHTML = resultsHTML;
        gameResultBox.classList.remove('hidden');
    }

    if (startGameBtn) startGameBtn.addEventListener('click', startGame);

    if (gameForm) {
        gameForm.addEventListener('submit', (e) => {
            e.preventDefault();
            endGame();
        });
    }
});
