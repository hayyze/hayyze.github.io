document.addEventListener('DOMContentLoaded', () => {
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

    const today = getToday();
    const todos = JSON.parse(localStorage.getItem('hayyiz-todos') || '[]');
    const habits = JSON.parse(localStorage.getItem('hayyiz-habits') || '[]');
    const notes = JSON.parse(localStorage.getItem('hayyiz-notes') || '[]');
    const sessionsToday = parseInt(localStorage.getItem('hayyiz-sessions-today') || '0', 10);
    const focusMinutes = parseInt(localStorage.getItem('hayyiz-focus-minutes-today') || '0', 10);
    const highScore = parseInt(localStorage.getItem('hayyiz-highscore') || '0', 10);

    const activeTodos = todos.filter((t) => !t.completed);
    const completedTodayish = todos.filter((t) => t.completed).length;
    const overdue = activeTodos.filter((t) => t.date && t.date < today);
    const dueToday = activeTodos.filter((t) => t.date === today);
    const habitsDoneToday = habits.filter((h) => h.lastCompleted === today).length;

    const hours = Math.floor(focusMinutes / 60);
    const mins = focusMinutes % 60;
    let timeText = '0 د';
    if (focusMinutes > 0) {
        timeText = hours > 0 ? `${hours}س ${mins}د` : `${mins} د`;
    }

    // ترحيب حسب الوقت
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

    function getNextTasks(list, limit) {
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

    const nextTasks = getNextTasks(todos, 3);
    const nextTask = nextTasks[0] || null;
    const content = document.getElementById('summary-content');
    if (!content) return;

    function launchPomodoroForTask(task, index) {
        const workMin = parseInt(localStorage.getItem('hayyiz-pref-work') || '25', 10) || 25;
        const totalMinutes = task.minutes ? parseInt(task.minutes, 10) : null;
        const plan = {
            text: task.text,
            index: index,
            totalMinutes: totalMinutes && totalMinutes > 0 ? totalMinutes : null,
            focusDone: 0,
            sessionsDone: 0,
            sessionsNeeded:
                totalMinutes && totalMinutes > 0
                    ? Math.ceil(totalMinutes / workMin)
                    : null
        };
        localStorage.setItem('hayyiz-current-task', task.text);
        localStorage.setItem('hayyiz-current-task-index', String(index));
        localStorage.setItem('hayyiz-task-session', JSON.stringify(plan));
        window.location.href = 'pomodoro.html?task=' + encodeURIComponent(task.text);
    }

    content.replaceChildren();

    // --- ترحيب ---
    const greet = document.createElement('div');
    greet.className = 'dash-greeting';
    const greetTitle = document.createElement('h3');
    greetTitle.textContent = greeting + ' 👋';
    const greetDate = document.createElement('p');
    greetDate.textContent = dateLabel;
    greet.appendChild(greetTitle);
    greet.appendChild(greetDate);
    content.appendChild(greet);

    // --- بطاقات الإحصائيات ---
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

    stats.appendChild(makeStat('fa-solid fa-clock', sessionsToday, 'جلسات التركيز', 'pomodoro.html'));
    stats.appendChild(makeStat('fa-solid fa-hourglass-half', timeText, 'تركيز اليوم', 'pomodoro.html'));
    stats.appendChild(makeStat('fa-solid fa-circle-check', completedTodayish, 'المهام المنجزة', 'todo.html'));
    stats.appendChild(
        makeStat(
            'fa-solid fa-list-check',
            activeTodos.length,
            'مهام نشطة',
            'todo.html'
        )
    );
    content.appendChild(stats);

    // تنبيه متأخرة
    if (overdue.length > 0 || dueToday.length > 0) {
        const alert = document.createElement('div');
        alert.className = 'dash-alert';
        if (overdue.length > 0) {
            alert.classList.add('warn');
            alert.innerHTML =
                '<i class="fa-solid fa-triangle-exclamation"></i> ' +
                '<span>لديك <strong>' +
                overdue.length +
                '</strong> مهمة متأخرة</span>';
        } else {
            alert.innerHTML =
                '<i class="fa-solid fa-calendar-day"></i> ' +
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

    // --- المهام القادمة ---
    const tasksSection = document.createElement('div');
    tasksSection.className = 'dash-section';

    const tasksHead = document.createElement('div');
    tasksHead.className = 'dash-section-head';
    const tasksTitle = document.createElement('h4');
    tasksTitle.textContent = 'المهام القادمة';
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
    } else {
        const list = document.createElement('ul');
        list.className = 'dash-task-list';

        nextTasks.forEach((task) => {
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
            const priMap = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };
            let metaText = priMap[task.priority] || '';
            if (task.minutes) {
                metaText += (metaText ? ' · ' : '') + task.minutes + ' د';
            }
            if (task.date) {
                if (task.date < today) metaText += (metaText ? ' · ' : '') + 'متأخرة';
                else if (task.date === today) metaText += (metaText ? ' · ' : '') + 'اليوم';
                else metaText += (metaText ? ' · ' : '') + task.date;
            }
            meta.textContent = metaText;

            info.appendChild(name);
            info.appendChild(meta);

            const pomoBtn = document.createElement('button');
            pomoBtn.type = 'button';
            pomoBtn.className = 'dash-pomo-btn';
            pomoBtn.title = 'ابدأ تركيز';
            pomoBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            pomoBtn.addEventListener('click', () => {
                launchPomodoroForTask(task, realIndex);
            });

            li.appendChild(info);
            li.appendChild(pomoBtn);
            list.appendChild(li);
        });

        tasksSection.appendChild(list);
    }
    content.appendChild(tasksSection);

    // --- عادات اليوم ---
    if (habits.length > 0) {
        const habitsSection = document.createElement('div');
        habitsSection.className = 'dash-section';

        const habitsHead = document.createElement('div');
        habitsHead.className = 'dash-section-head';
        const habitsTitle = document.createElement('h4');
        habitsTitle.textContent = 'عادات اليوم';
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

            check.addEventListener('change', () => {
                const all = JSON.parse(localStorage.getItem('hayyiz-habits') || '[]');
                // مطابقة بالاسم+الفهرس التقريبي
                const idx = all.findIndex(
                    (h, j) => h.name === habit.name && (j === i || h.created === habit.created)
                );
                const target = idx >= 0 ? idx : i;
                if (!all[target]) return;

                if (check.checked) {
                    const last = all[target].lastCompleted;
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yStr = yesterday.toISOString().slice(0, 10);
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
                // تحديث العداد في الإحصائيات
                const done = all.filter((h) => h.lastCompleted === today).length;
                const statLabs = stats.querySelectorAll('.dash-stat');
                if (statLabs[3]) {
                    const strong = statLabs[3].querySelector('strong');
                    if (strong) strong.textContent = done + '/' + all.length;
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

    // --- اختصارات سريعة ---
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
        a.innerHTML = '<i class="' + s.icon + '" aria-hidden="true"></i><span>' + s.label + '</span>';
        quick.appendChild(a);
    });
    content.appendChild(quick);

    // زر بدء التركيز
    const startBtn = document.getElementById('start-focus-session-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (nextTask) {
                const idx = todos.indexOf(nextTask);
                launchPomodoroForTask(nextTask, idx >= 0 ? idx : 0);
            } else {
                localStorage.removeItem('hayyiz-current-task');
                localStorage.removeItem('hayyiz-current-task-index');
                localStorage.removeItem('hayyiz-task-session');
                window.location.href = 'pomodoro.html';
            }
        });
    }
});