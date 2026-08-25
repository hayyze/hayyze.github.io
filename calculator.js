/**
 * تقويم الطالب وخطة المواعيد الدراسية — Hayyiz Student Calendar & Timeline
 * إدارة العمر، والخط الزمني التفاعلي للاختبارات والمواعيد والواجبات
 */

(function () {
    'use strict';

    const STORAGE_KEY_BIRTHDATE = 'hayyiz-birthdate';
    const STORAGE_KEY_EXAMS = 'hayyiz-student-exams';
    const STORAGE_KEY_EVENTS = 'hayyiz-custom-events';

    let countdownInterval = null;
    let currentFilter = 'all';
    let showPastEvents = false;

    document.addEventListener('DOMContentLoaded', initCalculator);

    function initCalculator() {
        bindBirthdateControls();
        bindEventFormControls();
        bindToolbarControls();
        bindResetButton();

        loadSavedBirthdate();
        renderStudentTimeline();

        // مؤقت واحد مركزي لتحديث العدادات التنازلية
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            if (!document.hidden) {
                renderStudentTimeline();
            }
        }, 30000);

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                renderStudentTimeline();
            }
        });

        if (typeof hayyizRegisterSyncCallback === 'function') {
            hayyizRegisterSyncCallback('student-exams', () => renderStudentTimeline());
            hayyizRegisterSyncCallback('custom-events', () => renderStudentTimeline());
            hayyizRegisterSyncCallback('birthdate', () => {
                loadSavedBirthdate();
                renderStudentTimeline();
            });
        }

        if (typeof hayyizSyncTool === 'function') {
            hayyizSyncTool('student-exams');
            hayyizSyncTool('custom-events');
            hayyizSyncTool('birthdate');
        }
        if (typeof initAuthListener === 'function') {
            initAuthListener();
        }
    }

    /* =========================================================
     * 1. معلومات العمر والهيرو بار (Hero Status Dashboard)
     * ========================================================= */

    function bindBirthdateControls() {
        const toggleBtn = document.getElementById('toggle-birthdate-form-btn');
        const formWrapper = document.getElementById('birthdate-form-wrapper');
        const birthInput = document.getElementById('birthdate-input');
        const saveBtn = document.getElementById('save-birthdate-btn');
        const cancelBtn = document.getElementById('cancel-birthdate-btn');

        if (toggleBtn && formWrapper) {
            toggleBtn.addEventListener('click', () => {
                const isHidden = formWrapper.style.display === 'none';
                formWrapper.style.display = isHidden ? 'block' : 'none';
                toggleBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
                if (isHidden && birthInput) birthInput.focus();
            });
        }

        if (saveBtn && birthInput) {
            saveBtn.addEventListener('click', () => {
                const dateVal = birthInput.value;
                if (!dateVal) {
                    showBirthdateError('الرجاء اختيار تاريخ ميلاد صحيح.');
                    return;
                }
                const birthObj = new Date(dateVal + 'T00:00:00');
                const todayMidnight = new Date();
                todayMidnight.setHours(0, 0, 0, 0);

                if (isNaN(birthObj.getTime()) || birthObj > todayMidnight) {
                    showBirthdateError('تاريخ الميلاد يجب أن يكون في الماضي.');
                    return;
                }

                showBirthdateError('');
                const nowMs = Date.now();
                localStorage.setItem(STORAGE_KEY_BIRTHDATE, dateVal);
                localStorage.setItem('hayyiz-birthdate-updated', String(nowMs));
                if (typeof hayyizUploadItem === 'function') {
                    hayyizUploadItem('birthdate', 'birthdate', dateVal);
                }
                if (formWrapper) formWrapper.style.display = 'none';
                updateHeroDashboard();
            });
        }

        if (cancelBtn && formWrapper) {
            cancelBtn.addEventListener('click', () => {
                showBirthdateError('');
                formWrapper.style.display = 'none';
            });
        }
    }

    function showBirthdateError(msg) {
        const errEl = document.getElementById('birthdate-error');
        if (!errEl) return;
        if (msg) {
            errEl.textContent = msg;
            errEl.style.display = 'block';
        } else {
            errEl.textContent = '';
            errEl.style.display = 'none';
        }
    }

    function loadSavedBirthdate() {
        const saved = localStorage.getItem(STORAGE_KEY_BIRTHDATE);
        const birthInput = document.getElementById('birthdate-input');
        const btnLbl = document.getElementById('birthdate-btn-lbl');
        if (saved && birthInput) {
            birthInput.value = saved;
            if (btnLbl) btnLbl.textContent = 'تعديل تاريخ الميلاد';
        }
    }

    function updateHeroDashboard() {
        const birthdate = localStorage.getItem(STORAGE_KEY_BIRTHDATE);
        const heroAgeVal = document.getElementById('hero-age-val');
        const heroAgeSub = document.getElementById('hero-age-sub');
        const heroNearestVal = document.getElementById('hero-nearest-val');
        const heroNearestSub = document.getElementById('hero-nearest-sub');
        const heroCountdownVal = document.getElementById('hero-countdown-val');
        const heroCountdownSub = document.getElementById('hero-countdown-sub');
        const heroWeekVal = document.getElementById('hero-week-val');
        const hero18Sub = document.getElementById('hero-18-sub');
        const btnLbl = document.getElementById('birthdate-btn-lbl');

        if (birthdate) {
            if (btnLbl) btnLbl.textContent = 'تعديل تاريخ الميلاد';
            const birthObj = new Date(birthdate + 'T00:00:00');
            const nowObj = new Date();
            const todayMidnight = new Date();
            todayMidnight.setHours(0, 0, 0, 0);

            if (!isNaN(birthObj.getTime()) && birthObj <= todayMidnight) {
                const age = typeof hayyizCalculateExactAge === 'function'
                    ? hayyizCalculateExactAge(birthObj, todayMidnight)
                    : calculateExactAgeFallback(birthObj, todayMidnight);

                if (heroAgeVal) heroAgeVal.textContent = `${age.years} سنة و${age.months} شهر`;
                if (heroAgeSub) heroAgeSub.textContent = `مواليد ${formatDateArabic(birthdate)} (${age.days} يوم)`;

                const status18 = typeof hayyizGet18Status === 'function'
                    ? hayyizGet18Status(birthObj, nowObj)
                    : get18StatusFallback(birthObj, nowObj);

                if (hero18Sub) {
                    if (status18.is18OrOlder) {
                        hero18Sub.textContent = `بلغت 18 سنة في ${status18.date18Str}`;
                    } else {
                        let rem = '';
                        if (status18.years > 0) rem += `${status18.years}س `;
                        if (status18.months > 0) rem += `${status18.months}ش `;
                        if (status18.days > 0 || (!status18.years && !status18.months)) rem += `${status18.days}ي`;
                        hero18Sub.textContent = `باقي على 18: ${rem.trim()} (${status18.date18Str})`;
                    }
                }
            }
        } else {
            if (btnLbl) btnLbl.textContent = 'تحديد تاريخ الميلاد';
            if (heroAgeVal) heroAgeVal.textContent = '--';
            if (heroAgeSub) heroAgeSub.textContent = 'أدخل تاريخ ميلادك';
            if (hero18Sub) hero18Sub.textContent = 'بلوغ 18: --';
        }

        // جلب الملخص التنازلي من common.js
        const calSummary = typeof hayyizGetCalendarSummary === 'function'
            ? hayyizGetCalendarSummary()
            : null;

        if (calSummary && calSummary.nearestEvent) {
            const ev = calSummary.nearestEvent;
            if (heroNearestVal) heroNearestVal.textContent = ev.name;

            const typeMap = { exam: 'اختبار', assignment: 'واجب/مشروع', personal: 'موعد شخصي', custom: 'حدث مخصص' };
            if (heroNearestSub) heroNearestSub.textContent = `${typeMap[ev.type] || 'موعد'} · ${formatDateArabic(ev.date)}`;

            const countdown = calculateContextualCountdown(ev);
            if (heroCountdownVal) heroCountdownVal.textContent = countdown.mainText;
            if (heroCountdownSub) heroCountdownSub.textContent = countdown.subText || 'أقرب استحقاق قادم';
        } else {
            if (heroNearestVal) heroNearestVal.textContent = 'لا توجد مواعيد';
            if (heroNearestSub) heroNearestSub.textContent = 'أضف اختبارك أو موعدك';
            if (heroCountdownVal) heroCountdownVal.textContent = '--';
            if (heroCountdownSub) heroCountdownSub.textContent = 'عَدّ تنازلي آلي';
        }

        if (heroWeekVal && calSummary) {
            heroWeekVal.textContent = `${calSummary.thisWeekCount} أحداث`;
        }
    }

    /* =========================================================
     * 2. أشرطة الأدوات والفلترة والنماذج
     * ========================================================= */

    function bindToolbarControls() {
        const openAddBtn = document.getElementById('open-add-exam-btn');
        const emptyAddBtn = document.getElementById('empty-add-event-btn');
        const formCard = document.getElementById('event-form-card');
        const filterBtns = document.querySelectorAll('.filter-tab-btn');
        const togglePastBtn = document.getElementById('toggle-past-events-btn');

        const handleOpenForm = () => {
            resetEventForm();
            if (formCard) {
                formCard.style.display = 'block';
                formCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const nameInput = document.getElementById('event-name-input');
                if (nameInput) nameInput.focus();
            }
        };

        if (openAddBtn) openAddBtn.addEventListener('click', handleOpenForm);
        if (emptyAddBtn) emptyAddBtn.addEventListener('click', handleOpenForm);

        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => {
                    b.classList.remove('active');
                    b.style.background = 'transparent';
                    b.style.color = 'var(--text)';
                });
                btn.classList.add('active');
                btn.style.background = 'var(--primary)';
                btn.style.color = '#ffffff';

                currentFilter = btn.getAttribute('data-filter') || 'all';
                renderStudentTimeline();
            });
        });

        if (togglePastBtn) {
            togglePastBtn.addEventListener('click', () => {
                showPastEvents = !showPastEvents;
                renderStudentTimeline();
            });
        }
    }

    function bindEventFormControls() {
        const form = document.getElementById('add-event-form');
        const cancelBtn = document.getElementById('cancel-event-form-btn');
        const formCard = document.getElementById('event-form-card');

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                saveEventFromForm();
            });
        }

        if (cancelBtn && formCard) {
            cancelBtn.addEventListener('click', () => {
                resetEventForm();
                formCard.style.display = 'none';
            });
        }

        const quickBtns = document.querySelectorAll('.quick-exam-btn');
        quickBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const nameInput = document.getElementById('event-name-input');
                const typeInput = document.getElementById('event-type-input');
                const dateInput = document.getElementById('event-date-input');
                const title = btn.getAttribute('data-title');
                const type = btn.getAttribute('data-type') || 'exam';

                if (nameInput && title) {
                    nameInput.value = title;
                    if (typeInput) typeInput.value = type;
                    if (dateInput && !dateInput.value) {
                        dateInput.value = getTodayLocalStr();
                    }
                    if (dateInput) dateInput.focus();
                }
            });
        });
    }

    function resetEventForm() {
        const form = document.getElementById('add-event-form');
        const editIdInput = document.getElementById('event-edit-id');
        const storageKeyInput = document.getElementById('event-storage-key');
        const formTitle = document.getElementById('form-card-title');
        const saveBtnText = document.getElementById('save-btn-text');

        if (form) form.reset();
        if (editIdInput) editIdInput.value = '';
        if (storageKeyInput) storageKeyInput.value = '';

        if (formTitle) formTitle.innerHTML = '<i class="fa-solid fa-calendar-plus"></i> إضافة موعد جديد إلى خطك الزمني';
        if (saveBtnText) saveBtnText.textContent = 'إضافة إلى الخط الزمني';

        const dateInput = document.getElementById('event-date-input');
        if (dateInput) dateInput.value = getTodayLocalStr();
    }

    function editEvent(id, storageKey) {
        if (!id || !storageKey) return;
        const allEvents = typeof hayyizGetAllCalendarEvents === 'function'
            ? hayyizGetAllCalendarEvents()
            : getSavedEventsFallback();

        const target = allEvents.find(e => e.id === id);
        if (!target) return;

        const formCard = document.getElementById('event-form-card');
        const editIdInput = document.getElementById('event-edit-id');
        const storageKeyInput = document.getElementById('event-storage-key');
        const nameInput = document.getElementById('event-name-input');
        const typeInput = document.getElementById('event-type-input');
        const dateInput = document.getElementById('event-date-input');
        const timeInput = document.getElementById('event-time-input');
        const formTitle = document.getElementById('form-card-title');
        const saveBtnText = document.getElementById('save-btn-text');

        if (editIdInput) editIdInput.value = target.id;
        if (storageKeyInput) storageKeyInput.value = target._storageKey || storageKey;
        if (nameInput) nameInput.value = target.name || '';
        if (typeInput) typeInput.value = target.type || 'exam';
        if (dateInput) dateInput.value = target.date || '';
        if (timeInput) timeInput.value = target.time || '';

        if (formTitle) formTitle.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> تعديل الموعد في خطك الزمني';
        if (saveBtnText) saveBtnText.textContent = 'حفظ التغييرات';

        if (formCard) {
            formCard.style.display = 'block';
            formCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (nameInput) nameInput.focus();
        }
    }

    function saveEventFromForm() {
        const editId = document.getElementById('event-edit-id').value;
        const oldStorageKey = document.getElementById('event-storage-key').value;
        const nameInput = document.getElementById('event-name-input');
        const typeInput = document.getElementById('event-type-input');
        const dateInput = document.getElementById('event-date-input');
        const timeInput = document.getElementById('event-time-input');

        if (!nameInput || !dateInput) return;

        const name = nameInput.value.trim();
        const type = typeInput ? typeInput.value : 'exam';
        const date = dateInput.value;
        const time = timeInput ? timeInput.value : '';

        if (!name || !date) return;

        const targetKey = (type === 'exam') ? STORAGE_KEY_EXAMS : STORAGE_KEY_EVENTS;

        const nowMs = Date.now();
        const eventObj = { id: editId || ((type === 'exam' ? 'ex_' : 'ev_') + nowMs.toString(36) + Math.random().toString(36).slice(2, 6)), name, type, date, time, updated: nowMs };

        if (editId) {
            if (oldStorageKey && oldStorageKey !== targetKey) {
                deleteEventFromStorage(editId, oldStorageKey);
            }
            saveEventToStorage(eventObj, targetKey);
        } else {
            saveEventToStorage(eventObj, targetKey);
        }

        const toolName = targetKey === STORAGE_KEY_EXAMS ? 'student-exams' : 'custom-events';
        if (typeof hayyizUploadItem === 'function') {
            hayyizUploadItem(toolName, eventObj.id, eventObj);
        }

        const formCard = document.getElementById('event-form-card');
        if (formCard) formCard.style.display = 'none';
        resetEventForm();
        renderStudentTimeline();
    }

    function saveEventToStorage(eventObj, storageKey) {
        try {
            const raw = localStorage.getItem(storageKey);
            let list = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(list)) list = [];

            const idx = list.findIndex(item => item && item.id === eventObj.id);
            if (idx >= 0) {
                list[idx] = Object.assign({}, list[idx], eventObj);
            } else {
                list.push(eventObj);
            }
            localStorage.setItem(storageKey, JSON.stringify(list));
        } catch (e) {
            localStorage.setItem(storageKey, JSON.stringify([eventObj]));
        }
    }

    function deleteEventFromStorage(id, storageKey) {
        if (!id || !storageKey) return;
        try {
            const raw = localStorage.getItem(storageKey);
            let list = raw ? JSON.parse(raw) : [];
            let eventToDelete = null;
            if (Array.isArray(list)) {
                eventToDelete = list.find(item => item && item.id === id) || null;
                list = list.filter(item => item && item.id !== id);
                localStorage.setItem(storageKey, JSON.stringify(list));
            }
            const toolName = storageKey === STORAGE_KEY_EXAMS ? 'student-exams' : 'custom-events';
            if (typeof hayyizDeleteRemoteItem === 'function') {
                hayyizDeleteRemoteItem(toolName, id, eventToDelete);
            }
        } catch (e) { /* تجاهل */ }
    }

    /* =========================================================
     * 3. بناء واستعراض الخط الزمني (Student Timeline Renderer)
     * ========================================================= */

    function renderStudentTimeline() {
        updateHeroDashboard();

        const allEvents = typeof hayyizGetAllCalendarEvents === 'function'
            ? hayyizGetAllCalendarEvents()
            : getSavedEventsFallback();

        // تصفية بحسب التبويب المفتوح
        let filtered = allEvents;
        if (currentFilter === 'exam') {
            filtered = allEvents.filter(e => e.type === 'exam');
        } else if (currentFilter === 'assignment') {
            filtered = allEvents.filter(e => e.type === 'assignment');
        }

        // الكشف عن التعارضات في الوقت/التاريخ
        const conflictMap = findConflicts(filtered);

        const now = new Date();
        const todayStr = getTodayLocalStr();

        // تصنيف زمني ذكي
        const todayTomorrowEvents = [];
        const thisWeekEvents = [];
        const futureEvents = [];
        const pastEvents = [];

        const t0 = new Date(`${todayStr}T00:00:00`).getTime();
        const tWeekEnd = t0 + (7 * 24 * 60 * 60 * 1000);

        filtered.forEach(ev => {
            const isPassed = isEventPassedCheck(ev, now, todayStr);
            if (isPassed) {
                pastEvents.push(ev);
            } else {
                const tEv = new Date(`${ev.date}T00:00:00`).getTime();
                const diffDays = Math.round((tEv - t0) / (1000 * 60 * 60 * 24));

                if (diffDays <= 1) {
                    todayTomorrowEvents.push(ev);
                } else if (tEv <= tWeekEnd) {
                    thisWeekEvents.push(ev);
                } else {
                    futureEvents.push(ev);
                }
            }
        });

        // ترتيب الأقسام زمنيًا
        todayTomorrowEvents.sort((a, b) => getEventTimestamp(a) - getEventTimestamp(b));
        thisWeekEvents.sort((a, b) => getEventTimestamp(a) - getEventTimestamp(b));
        futureEvents.sort((a, b) => getEventTimestamp(a) - getEventTimestamp(b));
        pastEvents.sort((a, b) => getEventTimestamp(b) - getEventTimestamp(a)); // الأحدث سابقة أولاً

        // تحديث زر الأحداث السابقة
        const pastBtnLbl = document.getElementById('past-btn-lbl');
        if (pastBtnLbl) {
            pastBtnLbl.textContent = showPastEvents
                ? `إخفاء الأحداث السابقة (${pastEvents.length})`
                : `الأحداث السابقة (${pastEvents.length})`;
        }

        const emptyEl = document.getElementById('events-empty');
        const activeTotalCount = todayTomorrowEvents.length + thisWeekEvents.length + futureEvents.length;

        if (activeTotalCount === 0 && (!showPastEvents || pastEvents.length === 0)) {
            if (emptyEl) emptyEl.style.display = 'block';
            hideTimelineGroups();
            return;
        }

        if (emptyEl) emptyEl.style.display = 'none';

        // عرض الأقسام
        renderGroup('group-today-tomorrow', 'count-today-tomorrow', 'cards-today-tomorrow', todayTomorrowEvents, conflictMap);
        renderGroup('group-this-week', 'count-this-week', 'cards-this-week', thisWeekEvents, conflictMap);
        renderGroup('group-future', 'count-future', 'cards-future', futureEvents, conflictMap);

        if (showPastEvents) {
            renderGroup('group-past', 'count-past', 'cards-past', pastEvents, conflictMap);
        } else {
            const pastGroup = document.getElementById('group-past');
            if (pastGroup) pastGroup.style.display = 'none';
        }
    }

    function hideTimelineGroups() {
        ['group-today-tomorrow', 'group-this-week', 'group-future', 'group-past'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }

    function renderGroup(groupId, countId, containerId, events, conflictMap) {
        const groupEl = document.getElementById(groupId);
        const countEl = document.getElementById(countId);
        const containerEl = document.getElementById(containerId);

        if (!groupEl || !containerEl) return;

        if (events.length === 0) {
            groupEl.style.display = 'none';
            containerEl.innerHTML = '';
            return;
        }

        groupEl.style.display = 'flex';
        if (countEl) countEl.textContent = events.length;

        containerEl.innerHTML = '';

        events.forEach(ev => {
            const card = createTimelineCard(ev, conflictMap.has(ev.id));
            containerEl.appendChild(card);
        });
    }

    function createTimelineCard(ev, hasConflict) {
        const card = document.createElement('div');
        card.className = 'timeline-card';
        if (hasConflict) card.classList.add('conflict-warning');

        const typeBadges = {
            exam: { class: 'badge-exam', text: '<i class="fa-solid fa-pen-ruler"></i> اختبار' },
            assignment: { class: 'badge-assignment', text: '<i class="fa-solid fa-file-pen"></i> واجب/مشروع' },
            personal: { class: 'badge-personal', text: '<i class="fa-solid fa-user-clock"></i> موعد شخصي' },
            custom: { class: 'badge-custom', text: '<i class="fa-solid fa-bookmark"></i> حدث مخصص' }
        };

        const badgeInfo = typeBadges[ev.type] || typeBadges.custom;
        const countdownInfo = calculateContextualCountdown(ev);

        let dateDisplay = formatDateArabic(ev.date);
        if (ev.time) dateDisplay += ` — ${ev.time}`;

        card.innerHTML = `
            <div class="card-top-row">
                <div class="card-title-group">
                    <h3 class="card-title">${escapeHtml(ev.name)}</h3>
                    <span class="card-subtitle"><i class="fa-regular fa-calendar"></i> ${dateDisplay}</span>
                </div>
                <span class="badge ${badgeInfo.class}">${badgeInfo.text}</span>
            </div>

            ${hasConflict ? `
                <div class="card-conflict-tag">
                    <i class="fa-solid fa-triangle-exclamation"></i> يوجد تعارض مع موعد آخر في نفس الوقت
                </div>
            ` : ''}

            <div class="card-countdown-box">
                <span class="card-countdown-main">${countdownInfo.mainText}</span>
                <span class="card-countdown-sub">${countdownInfo.subText}</span>
            </div>

            <div class="card-action-bar">
                <div class="card-quick-links">
                    <button type="button" class="action-btn-mini btn-convert-todo" data-id="${ev.id}" data-key="${ev._storageKey}" title="تحويل إلى مهمة في قائمة المهام">
                        <i class="fa-solid fa-list-check"></i> تحويل لمهمة
                    </button>
                    ${ev.type === 'exam' ? `
                        <button type="button" class="action-btn-mini btn-start-pomo" data-name="${escapeHtml(ev.name)}" title="بدء جلسة تركيز للاستعداد للاختبار">
                            <i class="fa-solid fa-play"></i> تركيز
                        </button>
                    ` : ''}
                </div>

                <div style="display: flex; gap: 0.3rem;">
                    <button type="button" class="action-btn-mini btn-edit-event" data-id="${ev.id}" data-key="${ev._storageKey}" title="تعديل الموعد">
                        <i class="fa-solid fa-pen"></i> تعديل
                    </button>
                    <button type="button" class="action-btn-mini action-btn-delete btn-delete-event" data-id="${ev.id}" data-key="${ev._storageKey}" title="حذف الموعد">
                        <i class="fa-solid fa-trash-can"></i> حذف
                    </button>
                </div>
            </div>
        `;

        // ربط التفاعلات
        const editBtn = card.querySelector('.btn-edit-event');
        const deleteBtn = card.querySelector('.btn-delete-event');
        const todoBtn = card.querySelector('.btn-convert-todo');
        const pomoBtn = card.querySelector('.btn-start-pomo');

        if (editBtn) {
            editBtn.addEventListener('click', () => editEvent(ev.id, ev._storageKey));
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm(`هل أنت متأكد من حذف الموعد "${ev.name}"؟`)) {
                    deleteEventFromStorage(ev.id, ev._storageKey);
                    renderStudentTimeline();
                }
            });
        }

        if (todoBtn) {
            todoBtn.addEventListener('click', () => {
                if (typeof hayyizConvertEventToTodo === 'function') {
                    hayyizConvertEventToTodo(ev);
                    alert(`تمت إضافة "${ev.name}" إلى قائمة المهام الدراسية بنجاح!`);
                }
            });
        }

        if (pomoBtn) {
            pomoBtn.addEventListener('click', () => {
                if (typeof hayyizLaunchPomodoro === 'function') {
                    hayyizLaunchPomodoro({ text: `استعداد لاختبار: ${ev.name}`, priority: 'high', minutes: '45' });
                } else {
                    window.location.href = 'pomodoro.html';
                }
            });
        }

        return card;
    }

    /* =========================================================
     * 4. الحسابات المساعدة والعد التنازلي الذكي
     * ========================================================= */

    function isEventPassedCheck(ev, nowObj, todayStr) {
        if (!ev.date) return true;
        if (ev.time) {
            const target = new Date(`${ev.date}T${ev.time}:00`);
            if (isNaN(target.getTime())) return true;
            return target.getTime() < nowObj.getTime();
        } else {
            return ev.date < todayStr;
        }
    }

    function calculateContextualCountdown(ev) {
        const now = new Date();
        const todayStr = getTodayLocalStr();

        if (ev.time) {
            const target = new Date(`${ev.date}T${ev.time}:00`);
            if (isNaN(target.getTime())) {
                return { mainText: 'تاريخ غير صالح', subText: '' };
            }

            const diffMs = target.getTime() - now.getTime();

            if (diffMs > 0) {
                const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
                const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const remHours = totalHours % 24;

                if (totalDays === 0) {
                    const remMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    if (totalHours > 0) {
                        return { mainText: `بعد ${totalHours} س و${remMinutes} د`, subText: 'متبقي على الوقت المحدد اليوم' };
                    } else {
                        return { mainText: `بعد ${remMinutes} دقيقة`, subText: 'متبقي على الوقت المحدد' };
                    }
                } else if (totalDays === 1) {
                    return { mainText: 'غداً', subText: `الساعة ${ev.time}` };
                } else if (totalDays < 7) {
                    return { mainText: `بعد ${totalDays} أيام`, subText: remHours > 0 ? `و${remHours} ساعة` : 'متبقي على الموعد' };
                } else {
                    return { mainText: `بعد ${totalDays} يومًا`, subText: `في ${formatDateArabic(ev.date)}` };
                }
            } else {
                if (ev.date === todayStr) {
                    return { mainText: 'اليوم', subText: 'حان موعد اليوم' };
                } else {
                    const passedDays = Math.max(1, Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24)));
                    return { mainText: 'انتهى', subText: `مضى عليه ${passedDays} يوم` };
                }
            }
        } else {
            const t0 = new Date(`${todayStr}T00:00:00`).getTime();
            const t1 = new Date(`${ev.date}T00:00:00`).getTime();
            const diffDays = Math.round((t1 - t0) / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
                return { mainText: 'اليوم', subText: 'موعد اليوم المستحق' };
            } else if (diffDays === 1) {
                return { mainText: 'غداً', subText: 'مستحق غداً' };
            } else if (diffDays > 1 && diffDays < 7) {
                return { mainText: `بعد ${diffDays} أيام`, subText: 'هذا الأسبوع' };
            } else if (diffDays >= 7) {
                return { mainText: `بعد ${diffDays} يومًا`, subText: `في ${formatDateArabic(ev.date)}` };
            } else {
                const passedDays = Math.abs(diffDays);
                return { mainText: 'انتهى', subText: `مضى عليه ${passedDays} يوم` };
            }
        }
    }

    function findConflicts(events) {
        const conflicts = new Set();
        const map = {};

        events.forEach(ev => {
            if (!ev.date) return;
            const key = ev.date + (ev.time ? `_${ev.time}` : '');
            if (map[key]) {
                conflicts.add(ev.id);
                conflicts.add(map[key]);
            } else {
                map[key] = ev.id;
            }
        });

        return conflicts;
    }

    function getSavedEventsFallback() {
        const events = [];
        try {
            const rawExams = localStorage.getItem(STORAGE_KEY_EXAMS);
            const examsList = rawExams ? JSON.parse(rawExams) : [];
            if (Array.isArray(examsList)) {
                examsList.forEach(item => {
                    if (item && item.name && item.date) {
                        events.push({
                            id: item.id || ('ex_' + Date.now()),
                            name: item.name,
                            date: item.date,
                            time: item.time || '',
                            type: item.type || 'exam',
                            _storageKey: STORAGE_KEY_EXAMS
                        });
                    }
                });
            }
        } catch (e) { /* تجاهل */ }

        try {
            const rawEvents = localStorage.getItem(STORAGE_KEY_EVENTS);
            const customList = rawEvents ? JSON.parse(rawEvents) : [];
            if (Array.isArray(customList)) {
                customList.forEach(item => {
                    if (item && item.name && item.date) {
                        events.push({
                            id: item.id || ('ev_' + Date.now()),
                            name: item.name,
                            date: item.date,
                            time: item.time || '',
                            type: item.type || 'personal',
                            _storageKey: STORAGE_KEY_EVENTS
                        });
                    }
                });
            }
        } catch (e) { /* تجاهل */ }

        return events;
    }

    function calculateExactAgeFallback(birthDateObj, nowObj) {
        let years = nowObj.getFullYear() - birthDateObj.getFullYear();
        let months = nowObj.getMonth() - birthDateObj.getMonth();
        let days = nowObj.getDate() - birthDateObj.getDate();

        if (days < 0) {
            months--;
            const prevMonthLastDay = new Date(nowObj.getFullYear(), nowObj.getMonth(), 0).getDate();
            days += prevMonthLastDay;
        }

        if (months < 0) {
            years--;
            months += 12;
        }

        return { years, months, days };
    }

    function get18StatusFallback(birthDateObj, nowObj) {
        const year18 = birthDateObj.getFullYear() + 18;
        const month18 = birthDateObj.getMonth();
        const day18 = birthDateObj.getDate();

        let date18 = new Date(year18, month18, day18);
        if (date18.getMonth() !== month18) {
            date18 = new Date(year18, month18, 28);
        }

        date18.setHours(0, 0, 0, 0);
        const todayMidnight = new Date(nowObj.getFullYear(), nowObj.getMonth(), nowObj.getDate());
        const date18Str = formatDateArabic(formatDateIso(date18));

        if (todayMidnight >= date18) {
            return { is18OrOlder: true, date18Str };
        } else {
            const rem = calculateExactAgeFallback(todayMidnight, date18);
            return { is18OrOlder: false, years: rem.years, months: rem.months, days: rem.days, date18Str };
        }
    }

    function getEventTimestamp(ev) {
        if (!ev.date) return Infinity;
        if (ev.time) {
            const d = new Date(`${ev.date}T${ev.time}:00`);
            if (!isNaN(d.getTime())) return d.getTime();
        }
        const d = new Date(`${ev.date}T00:00:00`);
        return isNaN(d.getTime()) ? Infinity : d.getTime();
    }

    function getTodayLocalStr() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function formatDateIso(d) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function formatDateArabic(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        const year = parts[0];
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);

        const monthNames = [
            'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
            'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
        ];

        return `${day} ${monthNames[month - 1]} ${year}`;
    }

    function bindResetButton() {
        const resetBtn = document.getElementById('reset-calc-btn');
        if (!resetBtn) return;

        resetBtn.addEventListener('click', () => {
            const ok = confirm('هل أنت متأكد من أتك تريد إعادة تعيين كافة بيانات تقويم الطالب (تاريخ الميلاد، الاختبارات، والمواعيد المحفوظة)؟');
            if (!ok) return;

            const examsList = JSON.parse(localStorage.getItem(STORAGE_KEY_EXAMS) || '[]');
            const eventsList = JSON.parse(localStorage.getItem(STORAGE_KEY_EVENTS) || '[]');

            if (Array.isArray(examsList) && typeof hayyizDeleteRemoteItem === 'function') {
                examsList.forEach(e => { if (e && e.id) hayyizDeleteRemoteItem('student-exams', e.id, e); });
            }
            if (Array.isArray(eventsList) && typeof hayyizDeleteRemoteItem === 'function') {
                eventsList.forEach(e => { if (e && e.id) hayyizDeleteRemoteItem('custom-events', e.id, e); });
            }
            const birthdateVal = localStorage.getItem(STORAGE_KEY_BIRTHDATE);
            if (typeof hayyizDeleteRemoteItem === 'function') {
                hayyizDeleteRemoteItem('birthdate', 'birthdate', birthdateVal);
            }

            localStorage.removeItem(STORAGE_KEY_BIRTHDATE);
            localStorage.removeItem(STORAGE_KEY_EXAMS);
            localStorage.removeItem(STORAGE_KEY_EVENTS);

            const birthInput = document.getElementById('birthdate-input');
            if (birthInput) birthInput.value = '';

            renderStudentTimeline();
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

})();
