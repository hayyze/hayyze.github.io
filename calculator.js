/**
 * حاسبة الطالب — Hayyiz Student Calculator
 * حساب العمر الدقيق والعد التنازلي للاختبارات والمواعيد المهمة
 */

(function () {
    'use strict';

    // مفاتيح التخزين المحلي
    const STORAGE_KEY_BIRTHDATE = 'hayyiz-birthdate';
    const STORAGE_KEY_EXAMS = 'hayyiz-student-exams';
    const STORAGE_KEY_EVENTS = 'hayyiz-custom-events';

    document.addEventListener('DOMContentLoaded', initCalculator);

    function initCalculator() {
        bindBirthdateEvents();
        bindExamEvents();
        bindCustomEventEvents();
        bindResetButton();

        // تحميل البيانات المحفوظة
        loadSavedBirthdate();
        loadSavedExams();
        loadSavedCustomEvents();

        // تحديث مستمر للعدادات التنازلية
        setInterval(updateAllCountdowns, 60000); // تحديث كل دقيقة
    }

    /* =========================================================
     * 1. حاسبة العمر وبلوغ 18 سنة
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
     * حساب دقيق للعمر التقويمي بالأيام والأشهر والسنوات
     */
    function calculateExactAge(birthDateObj, nowObj) {
        let years = nowObj.getFullYear() - birthDateObj.getFullYear();
        let months = nowObj.getMonth() - birthDateObj.getMonth();
        let days = nowObj.getDate() - birthDateObj.getDate();

        if (days < 0) {
            months--;
            // أيام الشهر السابق للشهر الحالي
            const prevMonthDate = new Date(nowObj.getFullYear(), nowObj.getMonth(), 0);
            days += prevMonthDate.getDate();
        }

        if (months < 0) {
            years--;
            months += 12;
        }

        return { years, months, days };
    }

    /**
     * حساب المدة المتبقية لبلوغ 18 سنة
     */
    function getRemainingTo18(birthDateObj, nowObj) {
        const date18 = new Date(birthDateObj.getFullYear() + 18, birthDateObj.getMonth(), birthDateObj.getDate());
        if (nowObj >= date18) {
            return null; // بلغ 18 عامًا أو أكبر
        }

        // حساب الوقت المتبقي من الآن حتى تاريخ الميلاد الـ 18
        let years = date18.getFullYear() - nowObj.getFullYear();
        let months = date18.getMonth() - nowObj.getMonth();
        let days = date18.getDate() - nowObj.getDate();

        if (days < 0) {
            months--;
            const prevMonthDate = new Date(date18.getFullYear(), date18.getMonth(), 0);
            days += prevMonthDate.getDate();
        }

        if (months < 0) {
            years--;
            months += 12;
        }

        return { years, months, days, targetDateStr: formatDateIso(date18) };
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
        nowObj.setHours(0, 0, 0, 0);

        if (isNaN(birthDateObj.getTime())) {
            errorEl.textContent = 'الرجاء إدخال تاريخ ميلاد صحيح.';
            errorEl.style.display = 'block';
            resultWrap.classList.add('hidden');
            return;
        }

        if (birthDateObj > nowObj) {
            errorEl.textContent = 'تاريخ الميلاد يجب أن يكون في الماضي، وليس تاريخاً مستقبلياً.';
            errorEl.style.display = 'block';
            resultWrap.classList.add('hidden');
            return;
        }

        const age = calculateExactAge(birthDateObj, nowObj);

        // عرض النتيجة
        document.getElementById('age-years').textContent = age.years;
        document.getElementById('age-months').textContent = age.months;
        document.getElementById('age-days').textContent = age.days;
        document.getElementById('formatted-birthdate').textContent = formatDateArabic(dateStr);

        // حساب المتبقي على 18 سنة
        const until18Box = document.getElementById('until-18-box');
        const until18Val = document.getElementById('until-18-val');

        const rem18 = getRemainingTo18(birthDateObj, nowObj);
        if (rem18 && until18Box && until18Val) {
            until18Box.style.display = 'block';
            let str = '';
            if (rem18.years > 0) str += `${rem18.years} سنة `;
            if (rem18.months > 0) str += `و ${rem18.months} شهر `;
            if (rem18.days > 0 || (!rem18.years && !rem18.months)) str += `و ${rem18.days} يوم`;
            until18Val.textContent = str.trim().replace(/^و\s*/, '');
        } else if (until18Box) {
            until18Box.style.display = 'none';
        }

        resultWrap.classList.remove('hidden');
    }

    /* =========================================================
     * 2. قسم "اختباراتك القادمة"
     * ========================================================= */

    function bindExamEvents() {
        const form = document.getElementById('add-exam-form');
        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('exam-name-input');
            const dateInput = document.getElementById('exam-date-input');

            if (!nameInput || !dateInput) return;

            const name = nameInput.value.trim();
            const date = dateInput.value;

            if (!name || !date) return;

            addExam(name, date);

            nameInput.value = '';
            dateInput.value = '';
        });

        // أزرار الاقتراحات السريعة
        const quickBtns = document.querySelectorAll('.quick-exam-btn');
        quickBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const nameInput = document.getElementById('exam-name-input');
                const examTitle = btn.getAttribute('data-exam-title');
                if (nameInput && examTitle) {
                    nameInput.value = examTitle;
                    document.getElementById('exam-date-input').focus();
                }
            });
        });
    }

    function getSavedExams() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_EXAMS);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveExams(list) {
        localStorage.setItem(STORAGE_KEY_EXAMS, JSON.stringify(list));
    }

    function addExam(name, date) {
        const exams = getSavedExams();
        const newExam = {
            id: 'ex_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name: name,
            date: date
        };
        exams.push(newExam);
        // ترتيب حسب تاريخ الاختبار القريب أولاً
        exams.sort((a, b) => new Date(a.date) - new Date(b.date));
        saveExams(exams);
        renderExams();
    }

    function deleteExam(id) {
        let exams = getSavedExams();
        exams = exams.filter(e => e.id !== id);
        saveExams(exams);
        renderExams();
    }

    function loadSavedExams() {
        renderExams();
    }

    function calculateDaysDiff(targetDateStr) {
        const today = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
        const t0 = new Date(today + 'T00:00:00').getTime();
        const t1 = new Date(targetDateStr + 'T00:00:00').getTime();
        if (isNaN(t0) || isNaN(t1)) return 0;
        return Math.round((t1 - t0) / (1000 * 60 * 60 * 24));
    }

    function renderExams() {
        const listEl = document.getElementById('exams-list');
        const emptyEl = document.getElementById('exams-empty');
        if (!listEl) return;

        const exams = getSavedExams();
        if (exams.length === 0) {
            listEl.innerHTML = '';
            if (emptyEl) emptyEl.classList.remove('hidden');
            return;
        }

        if (emptyEl) emptyEl.classList.add('hidden');
        listEl.innerHTML = '';

        exams.forEach(exam => {
            const diffDays = calculateDaysDiff(exam.date);
            const card = document.createElement('div');
            card.className = 'exam-card card';

            let statusBadge = '';
            let countdownHtml = '';

            if (diffDays > 0) {
                statusBadge = `<span class="badge badge-upcoming"><i class="fa-solid fa-clock"></i> قادم</span>`;
                countdownHtml = `
                    <div class="countdown-wrap">
                        <span class="countdown-num">${diffDays}</span>
                        <span class="countdown-label">يوم متبقي</span>
                    </div>
                `;
            } else if (diffDays === 0) {
                statusBadge = `<span class="badge badge-today"><i class="fa-solid fa-star"></i> موعده اليوم!</span>`;
                countdownHtml = `
                    <div class="countdown-wrap today">
                        <span class="countdown-num">اليوم</span>
                        <span class="countdown-label">بالتوفيق في الاختبار!</span>
                    </div>
                `;
            } else {
                const passed = Math.abs(diffDays);
                statusBadge = `<span class="badge badge-passed"><i class="fa-solid fa-check"></i> انتهى</span>`;
                countdownHtml = `
                    <div class="countdown-wrap passed">
                        <span class="countdown-num">${passed}</span>
                        <span class="countdown-label">يوم مضى</span>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="exam-header">
                    <div class="exam-title-wrap">
                        <h3 class="exam-title">${escapeHtml(exam.name)}</h3>
                        <span class="exam-date-str"><i class="fa-regular fa-calendar"></i> ${formatDateArabic(exam.date)}</span>
                    </div>
                    ${statusBadge}
                </div>
                <div class="exam-body">
                    ${countdownHtml}
                </div>
                <div class="exam-actions">
                    <button type="button" class="btn-delete-exam" data-id="${exam.id}" title="حذف الاختبار" aria-label="حذف الاختبار">
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
                if (id) deleteExam(id);
            });
        });
    }

    /* =========================================================
     * 3. قسم "التواريخ والمواعيد المهمة المخصصة"
     * ========================================================= */

    function bindCustomEventEvents() {
        const form = document.getElementById('add-event-form');
        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('event-name-input');
            const dateInput = document.getElementById('event-date-input');

            if (!nameInput || !dateInput) return;

            const name = nameInput.value.trim();
            const date = dateInput.value;

            if (!name || !date) return;

            addCustomEvent(name, date);

            nameInput.value = '';
            dateInput.value = '';
        });
    }

    function getSavedCustomEvents() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_EVENTS);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveCustomEvents(list) {
        localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(list));
    }

    function addCustomEvent(name, date) {
        const events = getSavedCustomEvents();
        const newEvent = {
            id: 'ev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name: name,
            date: date
        };
        events.push(newEvent);
        events.sort((a, b) => new Date(a.date) - new Date(b.date));
        saveCustomEvents(events);
        renderCustomEvents();
    }

    function deleteCustomEvent(id) {
        let events = getSavedCustomEvents();
        events = events.filter(e => e.id !== id);
        saveCustomEvents(events);
        renderCustomEvents();
    }

    function loadSavedCustomEvents() {
        renderCustomEvents();
    }

    function renderCustomEvents() {
        const listEl = document.getElementById('events-list');
        const emptyEl = document.getElementById('events-empty');
        if (!listEl) return;

        const events = getSavedCustomEvents();
        if (events.length === 0) {
            listEl.innerHTML = '';
            if (emptyEl) emptyEl.classList.remove('hidden');
            return;
        }

        if (emptyEl) emptyEl.classList.add('hidden');
        listEl.innerHTML = '';

        events.forEach(ev => {
            const diffDays = calculateDaysDiff(ev.date);
            const card = document.createElement('div');
            card.className = 'event-card card';

            let statusHtml = '';
            if (diffDays > 0) {
                statusHtml = `<span class="event-days-tag upcoming">باقي ${diffDays} يوم</span>`;
            } else if (diffDays === 0) {
                statusHtml = `<span class="event-days-tag today">موعده اليوم</span>`;
            } else {
                statusHtml = `<span class="event-days-tag passed">مضى عليه ${Math.abs(diffDays)} يوم</span>`;
            }

            card.innerHTML = `
                <div class="event-info">
                    <div class="event-name"><i class="fa-solid fa-bookmark"></i> ${escapeHtml(ev.name)}</div>
                    <div class="event-date">${formatDateArabic(ev.date)}</div>
                </div>
                <div class="event-meta">
                    ${statusHtml}
                    <button type="button" class="btn-delete-event" data-id="${ev.id}" title="حذف الموعد" aria-label="حذف الموعد">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;

            listEl.appendChild(card);
        });

        const deleteBtns = listEl.querySelectorAll('.btn-delete-event');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                if (id) deleteCustomEvent(id);
            });
        });
    }

    function updateAllCountdowns() {
        renderExams();
        renderCustomEvents();
    }

    /* =========================================================
     * 4. إعادة تعيين البيانات
     * ========================================================= */

    function bindResetButton() {
        const resetBtn = document.getElementById('reset-calc-btn');
        if (!resetBtn) return;

        resetBtn.addEventListener('click', () => {
            const ok = confirm('هل أنت متأكد من أتك تريد إعادة تعيين كافة بيانات حاسبة الطالب (تاريخ الميلاد، الاختبارات، والمواعيد المحفوظة)؟');
            if (!ok) return;

            localStorage.removeItem(STORAGE_KEY_BIRTHDATE);
            localStorage.removeItem(STORAGE_KEY_EXAMS);
            localStorage.removeItem(STORAGE_KEY_EVENTS);

            const birthInput = document.getElementById('birthdate-input');
            if (birthInput) birthInput.value = '';

            clearBirthdateResult();
            renderExams();
            renderCustomEvents();
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
