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

    const todos = JSON.parse(localStorage.getItem('hayyiz-todos') || '[]');
    const habits = JSON.parse(localStorage.getItem('hayyiz-habits') || '[]');
    const notes = JSON.parse(localStorage.getItem('hayyiz-notes') || '[]');
    const sessionsToday = parseInt(localStorage.getItem('hayyiz-sessions-today') || '0', 10);
    const focusMinutes = parseInt(localStorage.getItem('hayyiz-focus-minutes-today') || '0', 10);
    const highScore = parseInt(localStorage.getItem('hayyiz-highscore') || '0', 10);

    const hours = Math.floor(focusMinutes / 60);
    const mins = focusMinutes % 60;
    let timeText = '0 دقيقة';
    if (focusMinutes > 0) {
        timeText = hours > 0
            ? `${hours} ساعة و${mins} دقيقة`
            : `${mins} دقيقة`;
    }

    let bestHabit = null;
    habits.forEach(h => {
        if (!bestHabit || (h.streak || 0) > (bestHabit.streak || 0)) {
            bestHabit = h;
        }
    });

    const lastNote = notes.length > 0 ? notes[0] : null;

    function getNextTask(list) {
        const incomplete = list.filter(t => !t.completed);
        if (incomplete.length === 0) return null;

        const order = { high: 3, medium: 2, low: 1 };

        return incomplete.slice().sort((a, b) => {
            const pDiff = (order[b.priority] || 0) - (order[a.priority] || 0);
            if (pDiff !== 0) return pDiff;

            const dateA = a.date ? new Date(a.date).getTime() : Infinity;
            const dateB = b.date ? new Date(b.date).getTime() : Infinity;
            if (dateA !== dateB) return dateA - dateB;

            return (b.created || 0) - (a.created || 0);
        })[0];
    }

    const nextTask = getNextTask(todos);
    const content = document.getElementById('summary-content');
    if (!content) return;

    // بناء الملخص بأمان بدون innerHTML من بيانات المستخدم
    content.replaceChildren();

    const grid = document.createElement('div');
    grid.className = 'summary-grid';

    function makeItem(iconClass, title, subtitle, extraNode) {
        const item = document.createElement('div');
        item.className = 'summary-item';

        const icon = document.createElement('i');
        icon.className = iconClass;
        icon.setAttribute('aria-hidden', 'true');
        item.appendChild(icon);

        const div = document.createElement('div');
        const strong = document.createElement('strong');
        strong.textContent = title;
        div.appendChild(strong);

        if (subtitle) {
            const span = document.createElement('span');
            span.textContent = subtitle;
            div.appendChild(span);
        }

        if (extraNode) {
            div.appendChild(extraNode);
        }

        item.appendChild(div);
        return item;
    }

    // جلسات التركيز
    grid.appendChild(makeItem(
        'fa-solid fa-clock',
        `${sessionsToday} جلسات تركيز`,
        timeText
    ));

    // المهمة التالية أو فارغ
    if (nextTask) {
        grid.appendChild(makeItem(
            'fa-solid fa-list-check',
            'المهمة التالية',
            nextTask.text
        ));
    } else {
        const link = document.createElement('a');
        link.href = 'todo.html';
        link.className = 'btn btn-outline btn-sm';
        link.style.marginTop = '6px';
        link.style.display = 'inline-block';
        link.textContent = 'إضافة مهمة';

        const emptyItem = makeItem(
            'fa-solid fa-list-check',
            'لا توجد مهام حاليًا',
            null,
            link
        );
        emptyItem.classList.add('empty-tasks');
        grid.appendChild(emptyItem);
    }

    // أفضل عادة
    if (bestHabit) {
        grid.appendChild(makeItem(
            'fa-solid fa-fire',
            'أفضل عادة',
            `${bestHabit.name} — مستمرة ${bestHabit.streak || 0} يومًا`
        ));
    }

    // آخر ملاحظة
    if (lastNote) {
        const notePreview = lastNote.title
            ? lastNote.title
            : (lastNote.content || '').slice(0, 50);
        grid.appendChild(makeItem(
            'fa-solid fa-note-sticky',
            'آخر ملاحظة',
            notePreview
        ));
    }

    // أعلى نتيجة
    grid.appendChild(makeItem(
        'fa-solid fa-gamepad',
        'أعلى نتيجة في اللعبة',
        `${highScore} نقطة`
    ));

    content.appendChild(grid);

    // زر ابدأ جلسة تركيز
    const startBtn = document.getElementById('start-focus-session-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (nextTask) {
                localStorage.setItem('hayyiz-current-task', nextTask.text);
                window.location.href = `pomodoro.html?task=${encodeURIComponent(nextTask.text)}`;
            } else {
                localStorage.removeItem('hayyiz-current-task');
                window.location.href = 'pomodoro.html';
            }
        });
    }
});
