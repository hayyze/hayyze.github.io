/**
 * تقويم الطالب — Hayyiz Student Calendar
 * متابعة العمر، والعد التنازلي للاختبارات والمواعيد المهمة
 */

(function () {
    'use strict';

    // مفاتيح التخزين المحلي
    const STORAGE_KEY_BIRTHDATE = 'hayyiz-birthdate';
    const STORAGE_KEY_EXAMS = 'hayyiz-student-exams';
    const STORAGE_KEY_EVENTS = 'hayyiz-custom-events';

    let countdownInterval = null;

    document.addEventListener('DOMContentLoaded', initCalculator);

    function initCalculator() {
        bindBirthdateEvents();
        bindEventForm();
        bindResetButton();

        // تحميل البيانات المحفوظة
        loadSavedBirthdate();
        renderAllEvents();

        // تحديث مستمر للعدادات التنازلية كل 30 ثانية
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = setInterval(updateAllCountdowns, 30000);
    }

    /* =========================================================
     * 1. معلومات العمر وبلوغ 18 سنة
     * ========================================================= */

    function bindBirthdateEvents() {
        const birthInput = document.getElementById('birthdate-input');
        if (!birthInput) return;

        birthInput.addEventListener('change', () => {
            const val = birthInput.value;
            if (!val) {
                clearBirthdateResult();
                localStorage.removeItem(STORAGE_KEY_BIRTHDATE);
                return;
            }
            saveAndCalculateAge(val);
        });
    }

    function loadSavedBirthdate() {
        const saved = localStorage.getItem(STORAGE_KEY_BIRTHDATE);
        const birthInput = document.getElementById('birthdate-input');
        if (saved && birthInput) {
            birthInput.value = saved;
            calculateAndRenderAge(saved);
        }
    }

    function saveAndCalculateAge(dateStr) {
        localStorage.setItem(STORAGE_KEY_BIRTHDATE, dateStr);
        calculateAndRenderAge(dateStr);
    }

    function clearBirthdateResult() {
        const resultWrap = document.getElementById('age-result-wrap');
        if (resultWrap) {
            resultWrap.classList.add('hidden');
        }
        const errorEl = document.getElementById('birthdate-error');
        if (errorEl) {
            errorEl.style.display = 'none';
            errorEl.textContent = '';
        }
    }

    /**
     * حساب تقويمي دقيق للعمر بالأيام والأشهر والسنوات
     */
    function calculateExactAge(birthDateObj, nowObj) {
        let years = nowObj.getFullYear() - birthDateObj.getFullYear();
        let months = nowObj.getMonth() - birthDateObj.getMonth();
        let days = nowObj.getDate() - birthDateObj.getDate();

        if (days < 0) {
            months--;
            // عدد أيام الشهر السابق للشهر الحالي في 'nowObj'
            const prevMonthLastDay = new Date(nowObj.getFullYear(), nowObj.getMonth(), 0).getDate();
            days += prevMonthLastDay;
        }

        if (months < 0) {
            years--;
            months += 12;
        }

        return { years, months, days };
    }

    /**
     * حساب حالة وتاريخ بلوغ سن 18 عاماً
     */
    function get18Status(birthDateObj, nowObj) {
        const year18 = birthDateObj.getFullYear() + 18;
        const month18 = birthDateObj.getMonth();
        const day18 = birthDateObj.getDate();

        // التعامل مع المولودين في 29 فبراير في سنة كبيسة
        let date18 = new Date(year18, month18, day18);
        if (date18.getMonth() !== month18) {
            // انزياح الشهر لعدم وجود 29 فبراير -> تعديل لـ 28 فبراير
            date18 = new Date(year18, month18, 28);
        }

        date18.setHours(0, 0, 0, 0);
        const todayMidnight = new Date(nowObj.getFullYear(), nowObj.getMonth(), nowObj.getDate());

        const date18Str = formatDateArabic(formatDateIso(date18));

        if (todayMidnight >= date18) {
            return {
                is18OrOlder: true,
                date18Str: date18Str
            };
        } else {
            const rem = calculateExactAge(todayMidnight, date18);
            return {
                is18OrOlder: false,
                years: rem.years,
                months: rem.months,
                days: rem.days,
                date18Str: date18Str
            };
        }
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

    function calculateAndRenderAge(dateStr) {
        const errorEl = document.getElementById('birthdate-error');
        const resultWrap = document.getElementById('age-result-wrap');
        if (!errorEl || !resultWrap) return;

        errorEl.style.display = 'none';
        errorEl.textContent = '';

        const birthDateObj = new Date(dateStr + 'T00:00:00');
        const nowObj = new Date();
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);

        if (isNaN(birthDateObj.getTime())) {
            errorEl.textContent = 'الرجاء إدخال تاريخ ميلاد صحيح.';
            errorEl.style.display = 'block';
            resultWrap.classList.add('hidden');
            return;
        }

        if (birthDateObj > todayMidnight) {
            errorEl.textContent = 'تاريخ الميلاد يجب أن يكون في الماضي، وليس تاريخاً مستقبلياً.';
            errorEl.style.display = 'block';
            resultWrap.classList.add('hidden');
            return;
        }

        const age = calculateExactAge(birthDateObj, todayMidnight);

        // عرض بطاقات نتائج العمر
        document.getElementById('age-years').textContent = age.years;
        document.getElementById('age-months').textContent = age.months;
        document.getElementById('age-days').textContent = age.days;
        document.getElementById('formatted-birthdate').textContent = formatDateArabic(dateStr);

        // حالة بلوغ 18 سنة
        const until18Box = document.getElementById('until-18-box');
        const until18Text = document.getElementById('until-18-text');

        const status18 = get18Status(birthDateObj, nowObj);

        if (until18Box && until18Text) {
            until18Box.style.display = 'flex';
            if (status18.is18OrOlder) {
                until18Text.innerHTML = `تاريخ بلوغك سن 18 عاماً: <strong>${status18.date18Str}</strong>`;
            } else {
                let remStr = '';
                if (status18.years > 0) remStr += `${status18.years} سنة `;
                if (status18.months > 0) remStr += `و ${status18.months} شهر `;
                if (status18.days > 0 || (!status18.years && !status18.months)) remStr += `و ${status18.days} يوم`;
                remStr = remStr.trim().replace(/^و\s*/, '');

                until18Text.innerHTML = `تاريخ بلوغ 18 عاماً هو <strong>${status18.date18Str}</strong> (المدة المتبقية: <strong>${remStr}</strong>)`;
            }
        }

        resultWrap.classList.remove('hidden');
    }

    /* =========================================================
     * 2. قسم "أحداثك القادمة" وإضافة المواعيد
     * ========================================================= */

    function bindEventForm() {
        const form = document.getElementById('add-event-form');
        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
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

            addEvent({ name, type, date, time });

            nameInput.value = '';
            dateInput.value = '';
            if (timeInput) timeInput.value = '';
        });

        // أزرار الاقتراحات السريعة
        const quickBtns = document.querySelectorAll('.quick-exam-btn');
        quickBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const nameInput = document.getElementById('event-name-input');
                const typeInput = document.getElementById('event-type-input');
                const title = btn.getAttribute('data-title');
                const type = btn.getAttribute('data-type') || 'exam';

                if (nameInput && title) {
                    nameInput.value = title;
                    if (typeInput) typeInput.value = type;
                    document.getElementById('event-date-input').focus();
                }
            });
        });
    }

    function getSavedEvents() {
        const events = [];

        // 1. الاختبارات
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

        // 2. الأحداث والمواعيد المخصصة
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

    function addEvent({ name, type, date, time }) {
        const id = (type === 'exam' ? 'ex_' : 'ev_') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const newObj = { id, name, type, date, time: time || '' };

        const targetKey = (type === 'exam') ? STORAGE_KEY_EXAMS : STORAGE_KEY_EVENTS;

        try {
            const raw = localStorage.getItem(targetKey);
            const list = raw ? JSON.parse(raw) : [];
            list.push(newObj);
            localStorage.setItem(targetKey, JSON.stringify(list));
        } catch (e) {
            localStorage.setItem(targetKey, JSON.stringify([newObj]));
        }

        renderAllEvents();
    }

    function deleteEvent(id, storageKey) {
        if (!id || !storageKey) return;
        try {
            const raw = localStorage.getItem(storageKey);
            let list = raw ? JSON.parse(raw) : [];
            list = list.filter(item => item && item.id !== id);
            localStorage.setItem(storageKey, JSON.stringify(list));
        } catch (e) { /* تجاهل */ }

        renderAllEvents();
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

    function calculateEventStatus(ev) {
        const now = new Date();
        const todayStr = getTodayLocalStr();

        if (ev.time) {
            const target = new Date(`${ev.date}T${ev.time}:00`);
            if (isNaN(target.getTime())) {
                return { status: 'passed', badgeClass: 'badge-passed', badgeText: 'انتهى', numText: 'تاريخ غير صالح', lblText: '' };
            }

            const diffMs = target.getTime() - now.getTime();

            if (diffMs > 0) {
                const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
                const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const remHours = totalHours % 24;

                let countdownStr = '';
                if (totalDays > 0) {
                    if (remHours > 0) {
                        countdownStr = `بعد ${totalDays} يوم و ${remHours} ساعة`;
                    } else {
                        countdownStr = `بعد ${totalDays} يومًا`;
                    }
                } else {
                    const remMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    if (totalHours > 0) {
                        countdownStr = `بعد ${totalHours} ساعة و ${remMinutes} دقيقة`;
                    } else {
                        countdownStr = `بعد ${remMinutes} دقيقة`;
                    }
                }

                return {
                    status: 'upcoming',
                    badgeClass: 'badge-upcoming',
                    badgeText: 'قادم',
                    numText: countdownStr,
                    lblText: 'متبقي على الموعد'
                };
            } else {
                if (ev.date === todayStr) {
                    return {
                        status: 'today',
                        badgeClass: 'badge-today',
                        badgeText: 'اليوم',
                        numText: 'اليوم',
                        lblText: 'تاريخ الموعد اليوم'
                    };
                } else {
                    const passedDays = Math.max(1, Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24)));
                    return {
                        status: 'passed',
                        badgeClass: 'badge-passed',
                        badgeText: 'مضى',
                        numText: `مضى عليه ${passedDays} يوم`,
                        lblText: ''
                    };
                }
            }
        } else {
            const t0 = new Date(`${todayStr}T00:00:00`).getTime();
            const t1 = new Date(`${ev.date}T00:00:00`).getTime();
            const diffDays = Math.round((t1 - t0) / (1000 * 60 * 60 * 24));

            if (diffDays > 0) {
                return {
                    status: 'upcoming',
                    badgeClass: 'badge-upcoming',
                    badgeText: 'قادم',
                    numText: `بعد ${diffDays} يومًا`,
                    lblText: 'متبقي على الموعد'
                };
            } else if (diffDays === 0) {
                return {
                    status: 'today',
                    badgeClass: 'badge-today',
                    badgeText: 'اليوم',
                    numText: 'اليوم',
                    lblText: 'تاريخ الموعد اليوم'
                };
            } else {
                const passedDays = Math.abs(diffDays);
                return {
                    status: 'passed',
                    badgeClass: 'badge-passed',
                    badgeText: 'مضى',
                    numText: `مضى عليه ${passedDays} يوم`,
                    lblText: ''
                };
            }
        }
    }

    function getTypeLabel(type) {
        if (type === 'exam') return '<i class="fa-solid fa-pen-ruler"></i> اختبار';
        if (type === 'personal') return '<i class="fa-solid fa-user-clock"></i> موعد شخصي';
        return '<i class="fa-solid fa-bookmark"></i> حدث مخصص';
    }

    function renderAllEvents() {
        const listEl = document.getElementById('events-list');
        const emptyEl = document.getElementById('events-empty');
        if (!listEl) return;

        const events = getSavedEvents();

        if (events.length === 0) {
            listEl.innerHTML = '';
            if (emptyEl) emptyEl.classList.remove('hidden');
            return;
        }

        if (emptyEl) emptyEl.classList.add('hidden');
        listEl.innerHTML = '';

        // ترتيب الأحداث تلقائيًا حسب الأقرب تاريخًا ووقتًا
        events.sort((a, b) => getEventTimestamp(a) - getEventTimestamp(b));

        events.forEach(ev => {
            const statusInfo = calculateEventStatus(ev);
            const card = document.createElement('div');
            card.className = 'exam-card card';

            let dateDisplay = formatDateArabic(ev.date);
            if (ev.time) {
                dateDisplay += ` — ${ev.time}`;
            }

            const typeTag = getTypeLabel(ev.type);

            card.innerHTML = `
                <div class="exam-header">
                    <div class="exam-title-wrap">
                        <h3 class="exam-title">${escapeHtml(ev.name)}</h3>
                        <span class="exam-date-str"><i class="fa-regular fa-calendar"></i> ${dateDisplay}</span>
                        <span style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.1rem;">${typeTag}</span>
                    </div>
                    <span class="badge ${statusInfo.badgeClass}">${statusInfo.badgeText}</span>
                </div>
                <div class="exam-body">
                    <div class="countdown-wrap ${statusInfo.status}">
                        <span class="countdown-num">${statusInfo.numText}</span>
                        ${statusInfo.lblText ? `<span class="countdown-label">${statusInfo.lblText}</span>` : ''}
                    </div>
                </div>
                <div class="exam-actions">
                    <button type="button" class="btn-delete-exam" data-id="${ev.id}" data-key="${ev._storageKey}" title="حذف الموعد" aria-label="حذف الموعد">
                        <i class="fa-solid fa-trash-can"></i> حذف
                    </button>
                </div>
            `;

            listEl.appendChild(card);
        });

        // ربط أحداث الحذف
        const deleteBtns = listEl.querySelectorAll('.btn-delete-exam');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const key = btn.getAttribute('data-key');
                if (id && key) deleteEvent(id, key);
            });
        });
    }

    function updateAllCountdowns() {
        renderAllEvents();
    }

    /* =========================================================
     * 3. إعادة تعيين البيانات
     * ========================================================= */

    function bindResetButton() {
        const resetBtn = document.getElementById('reset-calc-btn');
        if (!resetBtn) return;

        resetBtn.addEventListener('click', () => {
            const ok = confirm('هل أنت متأكد من أتك تريد إعادة تعيين كافة بيانات تقويم الطالب (تاريخ الميلاد، الاختبارات، والمواعيد المحفوظة)؟');
            if (!ok) return;

            localStorage.removeItem(STORAGE_KEY_BIRTHDATE);
            localStorage.removeItem(STORAGE_KEY_EXAMS);
            localStorage.removeItem(STORAGE_KEY_EVENTS);

            const birthInput = document.getElementById('birthdate-input');
            if (birthInput) birthInput.value = '';

            clearBirthdateResult();
            renderAllEvents();
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
