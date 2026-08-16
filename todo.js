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
        } catch (e) {
            // تجاهل أخطاء الصوت
        }
    }


    function showTaskCreatedModal(taskText) {
        document.querySelector('.task-modal-overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.className = 'task-modal-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        const modal = document.createElement('div');
        modal.className = 'task-modal';

        const h3 = document.createElement('h3');
        h3.textContent = 'تم إنشاء المهمة';
        modal.appendChild(h3);

        const nameP = document.createElement('p');
        nameP.className = 'task-name';
        nameP.textContent = taskText;
        modal.appendChild(nameP);

        const q = document.createElement('p');
        q.textContent = 'هل تريد البدء بجلسة تركيز؟';
        modal.appendChild(q);

        const actions = document.createElement('div');
        actions.className = 'modal-actions';

        const startBtn = document.createElement('button');
        startBtn.type = 'button';
        startBtn.className = 'btn btn-primary';
        startBtn.id = 'start-pomodoro-from-modal';
        startBtn.innerHTML = '<i class="fa-solid fa-play" aria-hidden="true"></i> ابدأ ببومودورو';

        const laterBtn = document.createElement('button');
        laterBtn.type = 'button';
        laterBtn.className = 'btn btn-outline';
        laterBtn.id = 'later-from-modal';
        laterBtn.textContent = 'لاحقًا';

        actions.appendChild(startBtn);
        actions.appendChild(laterBtn);
        modal.appendChild(actions);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        startBtn.addEventListener('click', () => {
            startPomodoroForTask(0);
        });

        laterBtn.addEventListener('click', () => {
            overlay.remove();
        });

        overlay.addEventListener('click', e => {
            if (e.target === overlay) overlay.remove();
        });
    }


    function startPomodoroForTask(index) {
        if (!Number.isInteger(index) || index < 0 || index >= todos.length) return;
        const task = todos[index];
        const workMin = parseInt(localStorage.getItem('hayyiz-pref-work') || '25', 10) || 25;
        const totalMinutes = task.minutes ? parseInt(task.minutes, 10) : null;
        const sessionsNeeded =
            totalMinutes && totalMinutes > 0
                ? Math.ceil(totalMinutes / workMin)
                : null;

        const plan = {
            text: task.text,
            index: index,
            totalMinutes: totalMinutes && totalMinutes > 0 ? totalMinutes : null,
            focusDone: 0,
            sessionsDone: 0,
            sessionsNeeded: sessionsNeeded
        };

        localStorage.setItem('hayyiz-current-task', task.text);
        localStorage.setItem('hayyiz-current-task-index', String(index));
        localStorage.setItem('hayyiz-task-session', JSON.stringify(plan));
        window.location.href = 'pomodoro.html?task=' + encodeURIComponent(task.text);
    }

    let todos = JSON.parse(
        localStorage.getItem('hayyiz-todos') || '[]'
    );

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
        if (window.taskTimerInterval) {
            clearInterval(window.taskTimerInterval);
        }

        const todo = todos[index];

        if (!todo || !todo.minutes) {
            return;
        }

        currentTaskTimer = {
            index,
            endTime: Date.now() + parseInt(todo.minutes, 10) * 60 * 1000
        };

        window.taskTimerInterval = setInterval(() => {
            const remaining = Math.max(
                0,
                Math.round(
                    (currentTaskTimer.endTime - Date.now()) / 1000
                )
            );

            const el = document.getElementById(
                `task-timer-${index}`
            );

            if (el) {
                el.textContent = formatTime(remaining);
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
        }

        window.taskTimerInterval = null;
        currentTaskTimer = null;

        renderTodos();
    }

    function renderTodos() {
        let filtered = todos;

        if (currentFilter === 'active') {
            filtered = todos.filter(todo => !todo.completed);
        }

        if (currentFilter === 'completed') {
            filtered = todos.filter(todo => todo.completed);
        }

        if (currentFilter === 'high') {
            filtered = todos.filter(todo => todo.priority === 'high');
        }

        todoList.innerHTML = '';

        if (filtered.length === 0) {
            todoEmpty.classList.remove('hidden');
            return;
        }

        todoEmpty.classList.add('hidden');

        filtered.forEach(todo => {
            const realIndex = todos.indexOf(todo);

            const isRunning =
                currentTaskTimer &&
                currentTaskTimer.index === realIndex;

            const li = document.createElement('li');

            li.className = `todo-item ${
                todo.completed ? 'completed' : ''
            }`;

            // Checkbox
            const checkbox = document.createElement('input');

            checkbox.type = 'checkbox';
            checkbox.className = 'todo-check';
            checkbox.checked = Boolean(todo.completed);
            checkbox.dataset.index = realIndex;

            // محتوى المهمة
            const content = document.createElement('div');
            content.className = 'todo-content';

            // نص المهمة
            const text = document.createElement('div');
            text.className = 'todo-text';

            // مهم: استخدام textContent يمنع تفسير مدخل المستخدم كـ HTML
            text.textContent = todo.text;

            // معلومات المهمة
            const meta = document.createElement('div');
            meta.className = 'todo-meta';

            const priority = document.createElement('span');

            priority.className = `priority-${todo.priority}`;

            if (todo.priority === 'high') {
                priority.textContent = 'عالية';
            } else if (todo.priority === 'medium') {
                priority.textContent = 'متوسطة';
            } else {
                priority.textContent = 'منخفضة';
            }

            meta.appendChild(priority);

            // التاريخ
            if (todo.date) {
                const dateSpan = document.createElement('span');

                const dateIcon = document.createElement('i');
                dateIcon.className = 'fa-regular fa-calendar';
                dateIcon.setAttribute('aria-hidden', 'true');

                dateSpan.appendChild(dateIcon);
                dateSpan.appendChild(
                    document.createTextNode(
                        ` ${new Date(todo.date).toLocaleString('ar-EG')}`
                    )
                );

                meta.appendChild(dateSpan);
            }

            // مدة المهمة
            if (todo.minutes) {
                const minutesSpan = document.createElement('span');

                const minutesIcon = document.createElement('i');
                minutesIcon.className =
                    'fa-solid fa-hourglass-half';
                minutesIcon.setAttribute('aria-hidden', 'true');

                minutesSpan.appendChild(minutesIcon);
                minutesSpan.appendChild(
                    document.createTextNode(
                        ` ${todo.minutes} د`
                    )
                );

                meta.appendChild(minutesSpan);
            }

            content.appendChild(text);
            content.appendChild(meta);

            // مؤقت المهمة
            if (todo.minutes && !todo.completed) {

                const timerBox = document.createElement('div');
                timerBox.className = 'task-timer-box';

                if (isRunning) {

                    const remaining = Math.max(
                        0,
                        Math.round(
                            (currentTaskTimer.endTime - Date.now()) / 1000
                        )
                    );

                    const timer = document.createElement('span');
                    timer.className = 'task-timer';
                    timer.id = `task-timer-${realIndex}`;
                    timer.textContent = formatTime(remaining);

                    const stopBtn = document.createElement('button');

                    stopBtn.className =
                        'btn btn-outline btn-sm stop-task-timer';

                    stopBtn.dataset.index = realIndex;
                    stopBtn.type = 'button';

                    const stopIcon = document.createElement('i');
                    stopIcon.className = 'fa-solid fa-stop';
                    stopIcon.setAttribute('aria-hidden', 'true');

                    stopBtn.appendChild(stopIcon);
                    stopBtn.appendChild(
                        document.createTextNode(' إيقاف')
                    );

                    timerBox.appendChild(timer);
                    timerBox.appendChild(stopBtn);

                } else {

                    const duration = document.createElement('span');
                    duration.className = 'task-duration';

                    duration.textContent =
                        `${todo.minutes} دقيقة`;

                    const startBtn = document.createElement('button');

                    startBtn.className =
                        'btn btn-primary btn-sm start-task-timer';

                    startBtn.dataset.index = realIndex;
                    startBtn.type = 'button';

                    const startIcon = document.createElement('i');
                    startIcon.className = 'fa-solid fa-play';
                    startIcon.setAttribute('aria-hidden', 'true');

                    startBtn.appendChild(startIcon);
                    startBtn.appendChild(
                        document.createTextNode(' بدء')
                    );

                    timerBox.appendChild(duration);
                    timerBox.appendChild(startBtn);
                }

                content.appendChild(timerBox);
            }

            // أزرار الإجراءات
            const actions = document.createElement('div');
            actions.className = 'todo-actions';

            // زر بدء بومودورو (للمهام غير المكتملة)
            if (!todo.completed) {
                const pomoBtn = document.createElement('button');
                pomoBtn.className = 'todo-pomo-btn';
                pomoBtn.dataset.index = realIndex;
                pomoBtn.type = 'button';
                pomoBtn.title = 'ابدأ جلسة تركيز على هذه المهمة';
                pomoBtn.setAttribute('aria-label', 'بدء بومودورو');
                pomoBtn.innerHTML = '<i class="fa-solid fa-clock" aria-hidden="true"></i>';
                actions.appendChild(pomoBtn);
            }

            // زر الحذف
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'todo-delete';
            deleteBtn.dataset.index = realIndex;
            deleteBtn.type = 'button';
            deleteBtn.setAttribute('aria-label', 'حذف المهمة');
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>';
            actions.appendChild(deleteBtn);

            // تجميع العنصر
            li.appendChild(checkbox);
            li.appendChild(content);
            li.appendChild(actions);

            todoList.appendChild(li);
        });
    }

    todoForm.addEventListener('submit', e => {
        e.preventDefault();

        const text = todoInput.value.trim();

        if (!text) {
            return;
        }

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

        showTaskCreatedModal(text);
    });

    todoList.addEventListener('click', e => {

        // بدء بومودورو على المهمة
        const pomoButton = e.target.closest('.todo-pomo-btn');
        if (pomoButton) {
            const index = Number(pomoButton.dataset.index);
            startPomodoroForTask(index);
            return;
        }

        // بدء المؤقت
        const startButton = e.target.closest('.start-task-timer');

        if (startButton) {
            const index = Number(startButton.dataset.index);

            if (
                Number.isInteger(index) &&
                index >= 0 &&
                index < todos.length
            ) {
                startTaskTimer(index);
            }

            return;
        }

        // إيقاف المؤقت
        const stopButton = e.target.closest('.stop-task-timer');

        if (stopButton) {
            stopTaskTimer();
            return;
        }

        // حذف المهمة
        const deleteButton = e.target.closest('.todo-delete');

        if (deleteButton) {
            const index = Number(deleteButton.dataset.index);

            if (
                !Number.isInteger(index) ||
                index < 0 ||
                index >= todos.length
            ) {
                return;
            }

            if (
                currentTaskTimer &&
                currentTaskTimer.index === index
            ) {
                stopTaskTimer();
            }

            todos.splice(index, 1);

            saveTodos();
            renderTodos();

            return;
        }

        // تغيير حالة المهمة
        if (e.target.classList.contains('todo-check')) {

            const index = Number(e.target.dataset.index);

            if (
                !Number.isInteger(index) ||
                index < 0 ||
                index >= todos.length
            ) {
                return;
            }

            todos[index].completed = e.target.checked;

            if (
                currentTaskTimer &&
                currentTaskTimer.index === index
            ) {
                stopTaskTimer();
            }

            saveTodos();
            renderTodos();
        }
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {

            filterBtns.forEach(b => {
                b.classList.remove('active');
            });

            btn.classList.add('active');

            currentFilter = btn.dataset.filter;

            renderTodos();
        });
    });

    renderTodos();
});