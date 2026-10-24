var hayyizStorage = (typeof window !== 'undefined' && window.hayyizStorage) || (typeof localStorage !== 'undefined' ? localStorage : undefined);
/* Dashboard controls reuse the shared tasks, subjects, timer and planning engine. */
(function () {
    'use strict';
    const weekdays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    function node(tag, text, className) {
        const element = document.createElement(tag);
        if (text) element.textContent = text;
        if (className) element.className = className;
        return element;
    }
    function field(form, label, id, value, type) {
        const wrapper = node('div', '', 'planning-field');
        const caption = node('label', label); caption.htmlFor = id;
        const input = node('input'); input.id = id; input.name = id; input.type = type || 'text'; input.value = value;
        if (!type) { input.inputMode = 'numeric'; input.maxLength = 4; }
        wrapper.append(caption, input); form.appendChild(wrapper); return input;
    }
    function button(text, primary) { const el = node('button', text, 'btn ' + (primary ? 'btn-primary' : 'btn-secondary')); el.type = 'button'; return el; }
    function message(form) { const el = node('p', '', 'planning-message'); el.setAttribute('role', 'status'); form.appendChild(el); return el; }
    function render() {
        const host = document.getElementById('day-planning-controls');
        if (!host) return;
        host.replaceChildren();
        const prefs = hayyizGetPlanningPreferences();
        const today = getTodayLocal();
        const capacity = hayyizGetDayCapacity(today);
        const form = node('form', '', 'planning-inline');
        const time = field(form, 'الوقت المتبقي لي اليوم (دقيقة)', 'planning-today-minutes', capacity.remainingMinutes);
        const save = button('تغيّر وقتي · حدّث الخطة', true); save.type = 'submit'; form.appendChild(save);
        const status = message(form);
        form.addEventListener('submit', e => {
            e.preventDefault();
            if (!hayyizSetTodayRemainingMinutes(time.value)) {
                status.textContent = 'أدخل دقائق صحيحة ضمن فترة المذاكرة، أو وسّع الفترة من إعدادات الأسبوع.';
                time.focus(); return;
            }
            const live = document.getElementById('planning-feedback');
            if (live) live.textContent = 'حُفظ وقت اليوم وأُعيد توزيع المتبقي. مواعيد التسليم لم تتغير.';
        });
        host.appendChild(form);
        const feedback = node('p', '', 'planning-message'); feedback.id = 'planning-feedback'; feedback.setAttribute('role', 'status'); host.appendChild(feedback);
        const explanation = node('p', `ميزانية اليوم ${capacity.totalMinutes} د · التزامات ضمن فترة المذاكرة ${capacity.commitmentMinutes} د · تركيز مسجل ${capacity.focusedMinutes} د`, 'planning-muted');
        host.appendChild(explanation);
        const details = node('details', '', 'planning-settings');
        details.appendChild(node('summary', 'وقتي الأسبوعي والتزاماتي المتكررة'));
        const weeklyForm = node('form');
        weeklyForm.appendChild(node('p', 'حدد ميزانية المذاكرة لكل يوم قبل خصم الالتزامات. تُخصم الأوقات المتداخلة مع فترة المذاكرة فقط، والتداخل بين التزاماتك لا يُحسب مرتين.', 'planning-muted'));
        const grid = node('div', '', 'planning-week-grid');
        const inputs = weekdays.map((name, day) => field(grid, name + ' (دقيقة)', 'planning-week-' + day,
            prefs.week && prefs.week[day] !== undefined ? prefs.week[day] : hayyizDefaultCapacity()));
        weeklyForm.appendChild(grid);
        const windowRow = node('div', '', 'planning-inline');
        const start = field(windowRow, 'بداية فترة المذاكرة', 'planning-window-start', prefs.studyStart, 'time');
        const end = field(windowRow, 'نهاية فترة المذاكرة', 'planning-window-end', prefs.studyEnd, 'time');
        weeklyForm.appendChild(windowRow);
        const saveWeek = button('حفظ الأسبوع وإعادة التوزيع', true); saveWeek.type = 'submit'; weeklyForm.appendChild(saveWeek);
        const weekStatus = message(weeklyForm);
        weeklyForm.addEventListener('submit', e => {
            e.preventDefault();
            const values = inputs.map(input => hayyizParseMinutes(input.value));
            const from = hayyizClockMinutes(start.value), to = hayyizClockMinutes(end.value);
            if (from === null || to === null || from >= to || values.some(v => v === null || v > to - from)) {
                weekStatus.textContent = 'حدد فترة تبدأ وتنتهي في اليوم نفسه، وميزانية لكل يوم بين صفر وطول هذه الفترة.'; return;
            }
            const next = hayyizGetPlanningPreferences();
            next.week = Object.fromEntries(values.map((value, day) => [day, value]));
            next.studyStart = start.value; next.studyEnd = end.value;
            hayyizSavePlanningPreferences(next);
            document.getElementById('planning-feedback').textContent = 'حُفظ الأسبوع. تعديل وقت اليوم يبقى خاصًا بهذا اليوم.';
        });
        details.appendChild(weeklyForm);
        const reservations = node('section'); reservations.appendChild(node('h5', 'التزامات متكررة'));
        const list = node('ul', '', 'planning-reservations');
        (Array.isArray(prefs.commitments) ? prefs.commitments : []).forEach(item => {
            const li = node('li');
            li.appendChild(node('span', `${item.name} · ${item.start}–${item.end} · ${(item.days || []).map(d => weekdays[d]).join('، ')}`));
            const remove = button('حذف'); remove.setAttribute('aria-label', 'حذف التزام ' + item.name);
            remove.addEventListener('click', () => {
                const next = hayyizGetPlanningPreferences();
                next.commitments = next.commitments.filter(c => c.id !== item.id);
                hayyizSavePlanningPreferences(next);
                document.getElementById('planning-feedback').textContent = 'حُذف الالتزام وأُعيد توزيع الوقت.';
            });
            li.appendChild(remove); list.appendChild(li);
        });
        reservations.appendChild(list);
        const commitmentForm = node('form');
        const name = field(commitmentForm, 'اسم الالتزام', 'planning-commitment-name', '', 'text'); name.maxLength = 80; name.required = true;
        const times = node('div', '', 'planning-inline');
        const cStart = field(times, 'من', 'planning-commitment-start', '17:00', 'time');
        const cEnd = field(times, 'إلى', 'planning-commitment-end', '18:00', 'time'); commitmentForm.appendChild(times);
        const days = node('fieldset', '', 'planning-days'); days.appendChild(node('legend', 'يتكرر في'));
        const checks = weekdays.map((title, day) => {
            const label = node('label'); const check = node('input'); check.type = 'checkbox'; check.value = day;
            label.append(check, document.createTextNode(title)); days.appendChild(label); return check;
        }); commitmentForm.appendChild(days);
        const add = button('إضافة الالتزام'); add.type = 'submit'; commitmentForm.appendChild(add);
        const commitmentStatus = message(commitmentForm);
        commitmentForm.addEventListener('submit', e => {
            e.preventDefault();
            const from = hayyizClockMinutes(cStart.value), to = hayyizClockMinutes(cEnd.value);
            const selectedDays = checks.filter(c => c.checked).map(c => Number(c.value));
            const next = hayyizGetPlanningPreferences();
            if (!name.value.trim() || !selectedDays.length || from === null || to === null || from >= to) {
                commitmentStatus.textContent = 'أدخل اسمًا، ويومًا واحدًا على الأقل، ووقت نهاية بعد البداية في اليوم نفسه.'; return;
            }
            if (next.commitments.length >= 50) { commitmentStatus.textContent = 'يمكن حفظ 50 التزامًا؛ احذف التزامات لم تعد تحتاجها.'; return; }
            next.commitments.push({ id: hayyizGenerateId(), name: name.value.trim(), days: selectedDays, start: cStart.value, end: cEnd.value, updated: Date.now() });
            hayyizSavePlanningPreferences(next);
            document.getElementById('planning-feedback').textContent = 'أُضيف الالتزام وأُعيد توزيع الوقت.';
        });
        reservations.appendChild(commitmentForm); details.appendChild(reservations);
        host.appendChild(details);
        renderReview(host, today);
        renderSetup();
    }
    function renderReview(host, today) {
        const details = node('details', '', 'planning-settings'); details.appendChild(node('summary', 'مراجعة يومي وتجهيز الغد'));
        const reviews = hayyizParseJSON('hayyiz-day-reviews', {}) || {};
        const saved = reviews[today];
        const form = node('form');
        const label = node('label', 'كيف سار يومك؟'); label.htmlFor = 'planning-review-reason';
        const select = node('select'); select.id = 'planning-review-reason';
        [['done', 'أنجزت ما أردت'], ['time', 'احتجت وقتًا أكثر'], ['difficulty', 'واجهت صعوبة'], ['distraction', 'تشتت انتباهي'], ['other', 'سبب آخر']].forEach(([value, text]) => {
            const option = node('option', text); option.value = value; select.appendChild(option);
        });
        if (saved) select.value = saved.reason;
        const save = button(saved ? 'تحديث مراجعة اليوم' : 'حفظ مراجعة اليوم', true); save.type = 'submit';
        form.append(label, select, save); const status = message(form);
        const remaining = hayyizGetTodos().filter(t => t && !t.completed);
        form.appendChild(node('p', `متبقي ${remaining.length} مهام. سيعاد توزيع العمل المرتبط بالخطط عند فتح حيز غدًا مع إبقاء مواعيد التسليم كما هي.`, 'planning-muted'));
        form.addEventListener('submit', e => {
            e.preventDefault();
            if (hayyizSaveDayReview(select.value)) status.textContent = 'حُفظت مراجعتك وأُعيد تقييم الخطط. يمكنك تعديل وقت الغد من إعدادات الأسبوع.';
        });
        const metricsLabel = node('label', '', 'planning-metrics');
        const metrics = node('input'); metrics.type = 'checkbox'; metrics.checked = hayyizStorage.getItem('hayyiz-planning-metrics') === 'enabled';
        metrics.addEventListener('change', () => {
            hayyizStorage.setItem('hayyiz-planning-metrics', metrics.checked ? 'enabled' : 'disabled');
            if (!metrics.checked) hayyizStorage.removeItem('hayyiz-planning-pending-events');
            else hayyizFlushPlanningEvents();
        });
        metricsLabel.append(metrics, document.createTextNode('أسمح بقياس خطوات الاستخدام لتحسين التخطيط، دون إرسال محتوى المهام أو الملاحظات.'));
        form.appendChild(metricsLabel); details.appendChild(form); host.appendChild(details);
    }
    function renderSetup() {
        document.getElementById('student-quick-setup')?.remove();
        if (hayyizGetTodos().length || hayyizStorage.getItem('hayyiz-setup-dismissed') === 'yes') return;
        const summary = document.getElementById('summary-content'); if (!summary) return;
        const section = node('section', '', 'card planning-setup'); section.id = 'student-quick-setup';
        section.appendChild(node('h3', 'ابدأ يومك بثلاث خطوات بسيطة'));
        section.appendChild(node('p', 'مادة، ومهمة حقيقية، ووقتك المتاح. يمكنك البدء دون حساب.'));
        const form = node('form');
        const subject = field(form, 'المادة', 'setup-subject', '', 'text'); subject.maxLength = 80; subject.required = true;
        const title = field(form, 'ما المهمة التي تريد إنجازها؟', 'setup-task', '', 'text'); title.maxLength = 200; title.required = true;
        const minutes = field(form, 'الوقت المتبقي لي اليوم (دقيقة)', 'setup-minutes', hayyizGetDayCapacity(getTodayLocal()).remainingMinutes);
        const save = button('ابنِ خطتي الأولى', true); save.type = 'submit'; form.appendChild(save);
        const dismiss = button('لاحقًا'); dismiss.addEventListener('click', () => { hayyizStorage.setItem('hayyiz-setup-dismissed', 'yes'); section.remove(); }); form.appendChild(dismiss);
        const status = message(form);
        form.addEventListener('submit', e => {
            e.preventDefault();
            if (!subject.value.trim() || !title.value.trim() || hayyizParseMinutes(minutes.value) === null) { status.textContent = 'أدخل المادة والمهمة ووقتًا صحيحًا.'; return; }
            // Capture values before the shared refresh replaces this form.
            const subjectName = subject.value.trim(), taskTitle = title.value.trim();
            if (!hayyizSetTodayRemainingMinutes(minutes.value)) { status.textContent = 'الوقت يتجاوز فترة المذاكرة؛ عدّلها من إعدادات الأسبوع.'; return; }
            const existing = hayyizGetSubjects().find(s => s.name === subjectName);
            const sub = existing || hayyizAddSubject(subjectName);
            const task = { id: hayyizGenerateId(), text: taskTitle, subjectId: sub.id, priority: 'medium', completed: false, created: Date.now(), updated: Date.now() };
            hayyizSaveTodos(hayyizGetTodos().concat(task));
            if (typeof hayyizUploadItem === 'function') hayyizUploadItem('todos', task.id, task);
            hayyizTrackPlanningEvent('first_plan'); hayyizNotifyPlanningChanged();
            document.getElementById('planning-feedback').textContent = 'خطتك جاهزة. ابدأ المهمة من زر جلسة التركيز.';
        });
        section.appendChild(form); summary.prepend(section);
    }
    document.addEventListener('DOMContentLoaded', render);
    window.addEventListener('hayyiz:summary-rendered', render);
})();
