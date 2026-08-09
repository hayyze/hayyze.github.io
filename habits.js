document.addEventListener('DOMContentLoaded', () => {
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
    }

    function updateHabitStats() {
        totalHabitsEl.textContent = habits.length;
        let best = 0, todayCount = 0;
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

    habitForm.addEventListener('submit', e => {
        e.preventDefault();
        const name = habitInput.value.trim();
        if (!name) return;
        habits.push({ name, streak: 0, lastCompleted: null });
        saveHabits();
        habitInput.value = '';
        renderHabits();
    });

    habitsList.addEventListener('click', e => {
        if (e.target.classList.contains('habit-check')) {
            const i = e.target.dataset.index;
            const today = getToday();
            const habit = habits[i];
            if (e.target.checked) {
                if (habit.lastCompleted !== today) {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yStr = yesterday.toISOString().slice(0, 10);
                    habit.streak = habit.lastCompleted === yStr ? habit.streak + 1 : 1;
                    habit.lastCompleted = today;
                }
            } else if (habit.lastCompleted === today) {
                habit.streak = Math.max(0, habit.streak - 1);
                habit.lastCompleted = null;
            }
            saveHabits();
            renderHabits();
        }
        if (e.target.closest('.habit-delete')) {
            habits.splice(e.target.closest('.habit-delete').dataset.index, 1);
            saveHabits();
            renderHabits();
        }
    });

    renderHabits();
});