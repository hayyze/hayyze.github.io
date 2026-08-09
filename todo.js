document.addEventListener('DOMContentLoaded', () => {
    function playNotificationSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
            osc.start();
            osc.stop(ctx.currentTime + 0.6);
        } catch (e) {}
    }

    let todos = JSON.parse(localStorage.getItem('hayyiz-todos') || '[]');
    let currentFilter = 'all';
    let currentTaskTimer = null;

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
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function startTaskTimer(index) {
        if (window.taskTimerInterval) clearInterval(window.taskTimerInterval);
        const todo = todos[index];
        if (!todo.minutes) return;

        currentTaskTimer = {
            index,
            endTime: Date.now() + parseInt(todo.minutes) * 60 * 1000
        };

        window.taskTimerInterval = setInterval(() => {
            const remaining = Math.max(0, Math.round((currentTaskTimer.endTime - Date.now()) / 1000));
            const el = document.getElementById(`task-timer-${index}`);
            if (el) el.textContent = formatTime(remaining);

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
        if (window.taskTimerInterval) clearInterval(window.taskTimerInterval);
        window.taskTimerInterval = null;
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

        filtered.forEach(todo => {
            const realIndex = todos.indexOf(todo);
            const isRunning = currentTaskTimer && currentTaskTimer.index === realIndex;

            let timerHTML = '';
            if (todo.minutes && !todo.completed) {
                if (isRunning) {
                    const remaining = Math.max(0, Math.round((currentTaskTimer.endTime - Date.now()) / 1000));
                    timerHTML = `
                        <div class="task-timer-box">
                            <span class="task-timer" id="task-timer-${realIndex}">${formatTime(remaining)}</span>
                            <button class="btn btn-outline btn-sm stop-task-timer" data-index="${realIndex}"><i class="fa-solid fa-stop"></i> إيقاف</button>
                        </div>`;
                } else {
                    timerHTML = `
                        <div class="task-timer-box">
                            <span class="task-duration">${todo.minutes} دقيقة</span>
                            <button class="btn btn-primary btn-sm start-task-timer" data-index="${realIndex}"><i class="fa-solid fa-play"></i> بدء</button>
                        </div>`;
                }
            }

            const li = document.createElement('li');
            li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
            li.innerHTML = `
                <input type="checkbox" class="todo-check" ${todo.completed ? 'checked' : ''} data-index="${realIndex}">
                <div class="todo-content">
                    <div class="todo-text">${todo.text}</div>
                    <div class="todo-meta">
                        <span class="priority-${todo.priority}">${todo.priority === 'high' ? 'عالية' : todo.priority === 'medium' ? 'متوسطة' : 'منخفضة'}</span>
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

    todoForm.addEventListener('submit', e => {
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

    todoList.addEventListener('click', e => {
        if (e.target.classList.contains('todo-check')) {
            const i = e.target.dataset.index;
            todos[i].completed = e.target.checked;
            if (currentTaskTimer && currentTaskTimer.index == i) stopTaskTimer();
            saveTodos();
            renderTodos();
        }
        if (e.target.closest('.todo-delete')) {
            const i = e.target.closest('.todo-delete').dataset.index;
            if (currentTaskTimer && currentTaskTimer.index == i) stopTaskTimer();
            todos.splice(i, 1);
            saveTodos();
            renderTodos();
        }
        if (e.target.closest('.start-task-timer')) {
            startTaskTimer(parseInt(e.target.closest('.start-task-timer').dataset.index));
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
});