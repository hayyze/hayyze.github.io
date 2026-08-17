document.addEventListener('DOMContentLoaded', () => {
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

    const today = getToday();
    const todos = JSON.parse(localStorage.getItem('hayyiz-todos') || '[]');
    const habits = JSON.parse(localStorage.getItem('hayyiz-habits') || '[]');
    const notes = JSON.parse(localStorage.getItem('hayyiz-notes') || '[]');
    const sessionsToday = parseInt(localStorage.getItem('hayyiz-sessions-today') || '0', 10);
    const focusMinutes = parseInt(localStorage.getItem('hayyiz-focus-minutes-today') || '0', 10);
    const highScore = parseInt(localStorage.getItem('hayyiz-highscore') || '0', 10);

    const activeTodos = todos.filter((t) => !t.completed);
    // مهام منجزة اليوم: تفضيل completedAt إن وُجد، وإلا لا نعرض رقمًا مضلّلًا لكل المهام القديمة
    const completedToday = todos.filter(
        (t) => t.completed && t.completedAt === today
    ).length;
    const completedAll = todos.filter((t) => t.completed).length;
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
            focusDone: task.focusDone ? parseInt(task.focusDone, 10) || 0 : 0,
            sessionsDone: task.sessionsDone ? parseInt(task.sessionsDone, 10) || 0 : 0,
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

    const priMap = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };

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

    // --- ماذا عليّ أن أفعل الآن؟ (بطاقة التركيز التالية) ---
    const nowCard = document.createElement('div');
    nowCard.className = 'dash-now';

    if (nextTask) {
        const nowLabel = document.createElement('div');
        nowLabel.className = 'dash-now-label';
        nowLabel.innerHTML =
            '<i class="fa-solid fa-bullseye" aria-hidden="true"></i> الخطوة التالية';
        nowCard.appendChild(nowLabel);

        const nowName = document.createElement('div');
        nowName.className = 'dash-now-name';
        nowName.textContent = nextTask.text;
        nowCard.appendChild(nowName);

        const nowMeta = document.createElement('div');
        nowMeta.className = 'dash-now-meta';
        const metaParts = [];
        if (nextTask.priority) metaParts.push('أولوية ' + (priMap[nextTask.priority] || nextTask.priority));
        if (nextTask.minutes) {
            const done = nextTask.focusDone ? parseInt(nextTask.focusDone, 10) || 0 : 0;
            const total = parseInt(nextTask.minutes, 10) || 0;
            if (done > 0 && total > 0) metaParts.push(done + '/' + total + ' د');
            else metaParts.push(nextTask.minutes + ' د');
        }
        if (nextTask.date) {
            if (nextTask.date < today) metaParts.push('متأخرة');
            else if (nextTask.date === today) metaParts.push('اليوم');
            else metaParts.push(nextTask.date);
        }
        nowMeta.textContent = metaParts.join(' · ');
        nowCard.appendChild(nowMeta);

        const nowActions = document.createElement('div');
        nowActions.className = 'dash-now-actions';

        const startNowBtn = document.createElement('button');
        startNowBtn.type = 'button';
        startNowBtn.className = 'btn btn-primary';
        startNowBtn.innerHTML =
            '<i class="fa-solid fa-play" aria-hidden="true"></i> ابدأ جلسة تركيز';
        startNowBtn.addEventListener('click', () => {
            const idx = todos.indexOf(nextTask);
            launchPomodoroForTask(nextTask, idx >= 0 ? idx : 0);
        });
        nowActions.appendChild(startNowBtn);

        const openTodo = document.createElement('a');
        openTodo.href = 'todo.html';
        openTodo.className = 'btn btn-outline';
        openTodo.textContent = 'عرض المهام';
        nowActions.appendChild(openTodo);

        nowCard.appendChild(nowActions);
    } else {
        const nowLabel = document.createElement('div');
        nowLabel.className = 'dash-now-label';
        nowLabel.innerHTML =
            '<i class="fa-solid fa-check-double" aria-hidden="true"></i> لا مهام نشطة الآن';
        nowCard.appendChild(nowLabel);

        const emptyHint = document.createElement('p');
        emptyHint.className = 'dash-empty';
        emptyHint.style.margin = '0.5rem 0 0.85rem';
        emptyHint.textContent =
            'أضف مهمة من قائمة المهام، أو ابدأ جلسة تركيز مباشرة.';
        nowCard.appendChild(emptyHint);

        const nowActions = document.createElement('div');
        nowActions.className = 'dash-now-actions';

        const startFree = document.createElement('button');
        startFree.type = 'button';
        startFree.className = 'btn btn-primary';
        startFree.innerHTML =
            '<i class="fa-solid fa-play" aria-hidden="true"></i> ابدأ جلسة تركيز';
        startFree.addEventListener('click', () => {
            localStorage.removeItem('hayyiz-current-task');
            localStorage.removeItem('hayyiz-current-task-index');
            localStorage.removeItem('hayyiz-task-session');
            window.location.href = 'pomodoro.html';
        });
        nowActions.appendChild(startFree);

        const addTask = document.createElement('a');
        addTask.href = 'todo.html';
        addTask.className = 'btn btn-outline';
        addTask.textContent = 'أضف مهمة';
        nowActions.appendChild(addTask);

        nowCard.appendChild(nowActions);
    }
    content.appendChild(nowCard);

    // --- بطاقات الإحصائيات (ماذا أنجزت اليوم؟) ---
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

    stats.appendChild(makeStat('fa-solid fa-clock', sessionsToday, 'جلسات اليوم', 'pomodoro.html'));
    stats.appendChild(makeStat('fa-solid fa-hourglass-half', timeText, 'تركيز اليوم', 'pomodoro.html'));
    // عرض منجز اليوم إن وُجدت تواريخ، وإلا إجمالي المنجز مع تسمية واضحة
    const hasAnyCompletedAt = todos.some((t) => t.completed && t.completedAt);
    if (hasAnyCompletedAt || completedToday > 0) {
        stats.appendChild(
            makeStat('fa-solid fa-circle-check', completedToday, 'منجزة اليوم', 'todo.html')
        );
    } else {
        stats.appendChild(
            makeStat('fa-solid fa-circle-check', completedAll, 'مهام منجزة', 'todo.html')
        );
    }
    stats.appendChild(
        makeStat('fa-solid fa-list-check', activeTodos.length, 'مهام متبقية', 'todo.html')
    );
    content.appendChild(stats);

    // ملخص يومي مختصر
    const dayBits = [];
    if (sessionsToday > 0) dayBits.push(sessionsToday + ' جلسة تركيز');
    if (focusMinutes > 0) dayBits.push(timeText + ' تركيز');
    if (completedToday > 0) dayBits.push(completedToday + ' مهمة منجزة');
    if (habits.length > 0) dayBits.push(habitsDoneToday + '/' + habits.length + ' عادات');
    if (dayBits.length > 0) {
        const daySum = document.createElement('p');
        daySum.className = 'dash-day-summary';
        daySum.textContent = 'اليوم: ' + dayBits.join(' · ');
        content.appendChild(daySum);
    }

    // تنبيه متأخرة
    if (overdue.length > 0 || dueToday.length > 0) {
        const alert = document.createElement('div');
        alert.className = 'dash-alert';
        if (overdue.length > 0) {
            alert.classList.add('warn');
            alert.innerHTML =
                '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ' +
                '<span>لديك <strong>' +
                overdue.length +
                '</strong> مهمة متأخرة</span>';
        } else {
            alert.innerHTML =
                '<i class="fa-solid fa-calendar-day" aria-hidden="true"></i> ' +
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

    // --- المهام القادمة (باقي القائمة بعد المهمة الأولى) ---
    const moreTasks = nextTasks.slice(1);
    const tasksSection = document.createElement('div');
    tasksSection.className = 'dash-section';

    const tasksHead = document.createElement('div');
    tasksHead.className = 'dash-section-head';
    const tasksTitle = document.createElement('h4');
    tasksTitle.textContent = moreTasks.length > 0 ? 'مهام أخرى قادمة' : 'المهام';
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
        content.appendChild(tasksSection);
    } else if (moreTasks.length > 0) {
        const list = document.createElement('ul');
        list.className = 'dash-task-list';

        moreTasks.forEach((task) => {
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
            let metaText = priMap[task.priority] || '';
            if (task.minutes) {
                const done = task.focusDone ? parseInt(task.focusDone, 10) || 0 : 0;
                const total = parseInt(task.minutes, 10) || 0;
                if (done > 0 && total > 0) {
                    metaText += (metaText ? ' · ' : '') + done + '/' + total + ' د';
                } else {
                    metaText += (metaText ? ' · ' : '') + task.minutes + ' د';
                }
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
            pomoBtn.setAttribute('aria-label', 'ابدأ جلسة تركيز على ' + task.text);
            pomoBtn.innerHTML = '<i class="fa-solid fa-play" aria-hidden="true"></i>';
            pomoBtn.addEventListener('click', () => {
                launchPomodoroForTask(task, realIndex);
            });

            li.appendChild(info);
            li.appendChild(pomoBtn);
            list.appendChild(li);
        });

        tasksSection.appendChild(list);
        content.appendChild(tasksSection);
    }

    // --- عادات اليوم ---
    if (habits.length > 0) {
        const habitsSection = document.createElement('div');
        habitsSection.className = 'dash-section';

        const habitsHead = document.createElement('div');
        habitsHead.className = 'dash-section-head';
        const habitsTitle = document.createElement('h4');
        habitsTitle.textContent =
            'عادات اليوم · ' + habitsDoneToday + '/' + habits.length;
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
            check.setAttribute('aria-label', 'تسجيل عادة ' + (habit.name || ''));

            check.addEventListener('change', () => {
                const all = JSON.parse(localStorage.getItem('hayyiz-habits') || '[]');
                const idx = all.findIndex(
                    (h, j) => h.name === habit.name && (j === i || h.created === habit.created)
                );
                const target = idx >= 0 ? idx : i;
                if (!all[target]) return;

                if (check.checked) {
                    const last = all[target].lastCompleted;
                    const yStr =
                        typeof getYesterdayLocal === 'function'
                            ? getYesterdayLocal()
                            : (() => {
                                  const y = new Date();
                                  y.setDate(y.getDate() - 1);
                                  return (
                                      y.getFullYear() +
                                      '-' +
                                      String(y.getMonth() + 1).padStart(2, '0') +
                                      '-' +
                                      String(y.getDate()).padStart(2, '0')
                                  );
                              })();
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
                const done = all.filter((h) => h.lastCompleted === today).length;
                habitsTitle.textContent = 'عادات اليوم · ' + done + '/' + all.length;
                const labelSpan = li.querySelector('span');
                if (labelSpan) {
                    labelSpan.textContent =
                        all[target].name +
                        (all[target].streak ? ' · ' + all[target].streak + '🔥' : '');
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

    // --- إحصاءات الأسبوع (آخر 7 أيام) ---
    try {
        const hist = JSON.parse(localStorage.getItem('hayyiz-focus-history') || '{}');
        if (focusMinutes > 0) {
            hist[today] = Math.max(parseInt(hist[today], 10) || 0, focusMinutes);
        }
        const dayNames = ['الاحد', 'الاثنين', 'الثلاثاء', 'الاربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const weekSection = document.createElement('div');
        weekSection.className = 'dash-section';
        const weekHead = document.createElement('div');
        weekHead.className = 'dash-section-head';
        const weekTitle = document.createElement('h4');
        weekTitle.textContent = 'تركيز الأسبوع';
        weekHead.appendChild(weekTitle);
        weekSection.appendChild(weekHead);

        const bars = document.createElement('div');
        bars.className = 'dash-week-bars';
        let maxVal = 1;
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const key = `${y}-${m}-${dd}`;
            const val = parseInt(hist[key], 10) || 0;
            if (val > maxVal) maxVal = val;
            days.push({ key, val, name: dayNames[d.getDay()], isToday: key === today });
        }
        days.forEach((day) => {
            const col = document.createElement('div');
            col.className = 'dash-week-col' + (day.isToday ? ' today' : '');
            const bar = document.createElement('div');
            bar.className = 'dash-week-bar';
            const pct = Math.round((day.val / maxVal) * 100);
            bar.style.height = Math.max(4, pct) + '%';
            bar.title = day.val + ' دقيقة';
            const label = document.createElement('span');
            label.textContent = day.name.slice(0, 3);
            const valEl = document.createElement('span');
            valEl.className = 'dash-week-val';
            valEl.textContent = day.val > 0 ? day.val + 'د' : '';
            col.appendChild(valEl);
            col.appendChild(bar);
            col.appendChild(label);
            bars.appendChild(col);
        });
        weekSection.appendChild(bars);
        content.appendChild(weekSection);
    } catch (e) {
        /* تجاهل */
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
        a.innerHTML =
            '<i class="' + s.icon + '" aria-hidden="true"></i><span>' + s.label + '</span>';
        quick.appendChild(a);
    });
    content.appendChild(quick);

    // زر بدء التركيز في أسفل البطاقة (يبقى متوافقًا مع HTML الحالي)
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