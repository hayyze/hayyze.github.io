document.addEventListener('DOMContentLoaded', () => {
    let habits = JSON.parse(
        localStorage.getItem('hayyiz-habits') || '[]'
    );

    const habitForm = document.getElementById('habit-form');
    const habitInput = document.getElementById('habit-input');
    const habitsList = document.getElementById('habits-list');
    const habitsEmpty = document.getElementById('habits-empty');
    const totalHabitsEl = document.getElementById('total-habits');
    const bestStreakEl = document.getElementById('best-streak');
    const todayCompletedEl = document.getElementById('today-completed');

    function getToday() {
        // استخدام التاريخ المحلي لتجنب خطأ UTC عند منتصف الليل
        if (typeof getTodayLocal === 'function') return getTodayLocal();
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function ensureHabitIds() {
        let changed = false;
        habits.forEach(h => {
            if (h && !h.id) {
                h.id = typeof hayyizGenerateId === 'function' ? hayyizGenerateId() : ('hb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
                changed = true;
            }
        });
        return changed;
    }

    function saveHabits(changedHabit) {
        ensureHabitIds();
        localStorage.setItem(
            'hayyiz-habits',
            JSON.stringify(habits)
        );

        if (changedHabit && changedHabit.id && typeof hayyizUploadItem === 'function') {
            hayyizUploadItem('habits', changedHabit.id, changedHabit);
        }

        updateHabitStats();
    }

    function updateHabitStats() {
        totalHabitsEl.textContent = habits.length;

        let best = 0;
        let todayCount = 0;

        const today = getToday();

        habits.forEach(habit => {
            if (habit.streak > best) {
                best = habit.streak;
            }

            if (habit.lastCompleted === today) {
                todayCount++;
            }
        });

        bestStreakEl.textContent = best;
        todayCompletedEl.textContent = todayCount;
    }

    function renderHabits() {
        // مسح القائمة الحالية
        habitsList.innerHTML = '';

        if (habits.length === 0) {
            habitsEmpty.classList.remove('hidden');
            updateHabitStats();
            return;
        }

        habitsEmpty.classList.add('hidden');

        const today = getToday();

        habits.forEach((habit, i) => {
            const doneToday = habit.lastCompleted === today;

            const div = document.createElement('div');
            div.className = 'habit-item';

            // Checkbox
            const checkbox = document.createElement('input');

            checkbox.type = 'checkbox';
            checkbox.className = 'habit-check';
            checkbox.checked = doneToday;
            checkbox.dataset.index = i;

            // معلومات العادة
            const info = document.createElement('div');
            info.className = 'habit-info';

            // اسم العادة
            const name = document.createElement('div');
            name.className = 'habit-name';

            // مهم: textContent يمنع تفسير اسم العادة كـ HTML
            name.textContent = habit.name;

            // السلسلة
            const streak = document.createElement('div');
            streak.className = 'habit-streak';

            const streakText = document.createTextNode(
                'السلسلة الحالية: '
            );

            const streakStrong = document.createElement('strong');
            streakStrong.textContent =
                `${habit.streak} يوم`;

            streak.appendChild(streakText);
            streak.appendChild(streakStrong);

            info.appendChild(name);
            info.appendChild(streak);

            // زر الحذف
            const deleteBtn = document.createElement('button');

            deleteBtn.className = 'habit-delete';
            deleteBtn.dataset.index = i;
            deleteBtn.type = 'button';
            deleteBtn.setAttribute(
                'aria-label',
                'حذف العادة'
            );

            const deleteIcon = document.createElement('i');

            deleteIcon.className = 'fa-solid fa-trash';
            deleteIcon.setAttribute(
                'aria-hidden',
                'true'
            );

            deleteBtn.appendChild(deleteIcon);

            // تجميع العنصر
            div.appendChild(checkbox);
            div.appendChild(info);
            div.appendChild(deleteBtn);

            habitsList.appendChild(div);
        });

        updateHabitStats();
    }

    habitForm.addEventListener('submit', e => {
        e.preventDefault();

        const name = habitInput.value.trim();

        if (!name) {
            return;
        }

        const newHabit = {
            id: typeof hayyizGenerateId === 'function' ? hayyizGenerateId() : ('hb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
            name,
            streak: 0,
            lastCompleted: null,
            created: Date.now()
        };

        habits.push(newHabit);

        saveHabits(newHabit);

        habitInput.value = '';

        renderHabits();
    });

    habitsList.addEventListener('click', e => {

        // تغيير حالة العادة
        if (e.target.classList.contains('habit-check')) {
            const i = Number(e.target.dataset.index);

            if (
                !Number.isInteger(i) ||
                i < 0 ||
                i >= habits.length
            ) {
                return;
            }

            const today = getToday();
            const habit = habits[i];

            if (e.target.checked) {

                if (habit.lastCompleted !== today) {
                    const yStr = typeof getYesterdayLocal === 'function'
                        ? getYesterdayLocal()
                        : (() => {
                            const y = new Date();
                            y.setDate(y.getDate() - 1);
                            const yy = y.getFullYear();
                            const mm = String(y.getMonth() + 1).padStart(2, '0');
                            const dd = String(y.getDate()).padStart(2, '0');
                            return `${yy}-${mm}-${dd}`;
                        })();

                    habit.streak =
                        habit.lastCompleted === yStr
                            ? habit.streak + 1
                            : 1;

                    habit.lastCompleted = today;
                }

            } else if (habit.lastCompleted === today) {

                habit.streak = Math.max(
                    0,
                    habit.streak - 1
                );

                habit.lastCompleted = null;
            }

            saveHabits(habit);
            renderHabits();

            return;
        }

        // حذف العادة
        const deleteButton =
            e.target.closest('.habit-delete');

        if (deleteButton) {
            const i = Number(
                deleteButton.dataset.index
            );

            if (
                !Number.isInteger(i) ||
                i < 0 ||
                i >= habits.length
            ) {
                return;
            }

            const habitToDelete = habits[i];
            habits.splice(i, 1);

            saveHabits();
            if (habitToDelete && habitToDelete.id && typeof hayyizDeleteRemoteItem === 'function') {
                hayyizDeleteRemoteItem('habits', habitToDelete.id);
            }
            renderHabits();
        }
    });

    ensureHabitIds();
    renderHabits();

    if (typeof hayyizRegisterSyncCallback === 'function') {
        hayyizRegisterSyncCallback('habits', (merged) => {
            if (Array.isArray(merged)) {
                habits = merged;
                renderHabits();
            }
        });
    }

    if (typeof hayyizSyncTool === 'function') {
        hayyizSyncTool('habits');
    }
    if (typeof initAuthListener === 'function') {
        initAuthListener();
    }
});
