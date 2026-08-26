function getTodayLocal() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * تاريخ أمس المحلي بصيغة YYYY-MM-DD
 */
function getYesterdayLocal() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    const docEl = document.documentElement;
    const themeToggle = document.getElementById('theme-toggle');
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');

    // الثيم
    const savedTheme = localStorage.getItem('hayyiz-theme') || 'light';
    const isDark = savedTheme === 'dark';
    docEl.classList.toggle('theme-dark', isDark);
    body.classList.toggle('theme-dark', isDark);
    updateThemeIcon();

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentlyDark = docEl.classList.contains('theme-dark') || body.classList.contains('theme-dark');
            const nextIsDark = !currentlyDark;
            docEl.classList.toggle('theme-dark', nextIsDark);
            body.classList.toggle('theme-dark', nextIsDark);
            localStorage.setItem('hayyiz-theme', nextIsDark ? 'dark' : 'light');
            updateThemeIcon();
        });
    }

    function updateThemeIcon() {
        if (!themeToggle) return;
        const icon = themeToggle.querySelector('i');
        if (!icon) return;
        const isDarkNow = docEl.classList.contains('theme-dark') || body.classList.contains('theme-dark');
        icon.className = isDarkNow ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }

    // قائمة الجوال
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('open');
        });
    }
});

// تسجيل Service Worker لـ PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        console.log('Service Worker مسجل بنجاح:', reg.scope);
      })
      .catch((err) => {
        console.log('فشل تسجيل Service Worker:', err);
      });
  });
}

/** قائمة السماح الصريحة (Allowlist) بمفاتيح البيانات الشخصية المسموح بتصديرها واستيرادها */
var HAYYIZ_ALLOWED_BACKUP_KEYS = [
    'hayyiz-todos',
    'hayyiz-notes',
    'hayyiz-habits',
    'hayyiz-sessions',
    'hayyiz-sessions-today',
    'hayyiz-focus-minutes-today',
    'hayyiz-sessions-day',
    'hayyiz-focus-history',
    'hayyiz-focus-sessions-log',
    'hayyiz-pref-work',
    'hayyiz-pref-break',
    'hayyiz-pref-long',
    'hayyiz-theme',
    'hayyiz-session-in-cycle',
    'hayyiz-highscore',
    'hayyiz-current-task',
    'hayyiz-current-task-index',
    'hayyiz-current-task-id',
    'hayyiz-task-session',
    'hayyiz-current-event',
    'hayyiz-pomodoro-state',
    'hayyiz-subjects',
    'hayyiz-exams',
    'hayyiz-goals',
    'hayyiz-subject-progress',
    'hayyiz-gpa-snapshot',
    'hayyiz-academic-goal',
    'hayyiz-subject-goals',
    'hayyiz-daily-goal',
    'hayyiz-birthdate',
    'hayyiz-student-exams',
    'hayyiz-custom-events',
    'hayyiz-hide-pomo-prompt-today',
    'hayyiz-hide-pomo-prompt-hour',
    'hayyiz-deleted-items'
];

/** التوافقية الكاملة مع التسمية السابقة */
var HAYYIZ_BACKUP_KEYS = HAYYIZ_ALLOWED_BACKUP_KEYS;

/** الحقول الممنوعة/الموثوقة التي يجب تجريدها واستبعادها تماماً من أي ملف استيراد أو تصدير */
var HAYYIZ_FORBIDDEN_PROPERTIES = new Set([
    '__proto__',
    'constructor',
    'prototype',
    'user_id',
    'owner_id',
    'user',
    'account',
    'auth_id',
    'points',
    'score_points',
    'premium',
    'is_premium',
    'subscription',
    'subscription_status',
    'granted_focus_sessions',
    'granted_sessions',
    'credits',
    'limits',
    'badges',
    'badge',
    'role',
    'roles',
    'permissions',
    'permission',
    'admin',
    'is_admin'
]);

/**
 * تنقية كائن بشكل عودي لتجريد أي حقول إدارية أو موثوقة أو معرفات هوية أو محاولات prototype pollution
 */
function hayyizSanitizeObject(val) {
    if (val === null || val === undefined) return val;
    if (Array.isArray(val)) {
        return val.map((item) => hayyizSanitizeObject(item));
    }
    if (typeof val === 'object') {
        const cleanObj = Object.create(null);
        Object.keys(val).forEach((k) => {
            const lowerK = k.toLowerCase();
            if (HAYYIZ_FORBIDDEN_PROPERTIES.has(lowerK) || lowerK.startsWith('_storagekey')) {
                return; // تجريد الحقل الممنوع
            }
            cleanObj[k] = hayyizSanitizeObject(val[k]);
        });
        return cleanObj;
    }
    return val;
}

/**
 * دالة التحقق والتنقية لقيم المفاتيح حسب نوعها وقائمة السماح الصريحة
 * @returns {string|null} تعيد النص النظيف الجاهز للتخزين، أو null إذا كانت البيانات غير صالحة.
 */
function hayyizSanitizeValue(key, rawVal) {
    const allowedSet = new Set(HAYYIZ_ALLOWED_BACKUP_KEYS);
    if (!allowedSet.has(key)) return null;
    if (rawVal === null || rawVal === undefined) return null;

    // المفاتيح ذات مصفوفات البيانات (Collections)
    const arrayCollectionKeys = new Set([
        'hayyiz-todos',
        'hayyiz-notes',
        'hayyiz-habits',
        'hayyiz-focus-sessions-log',
        'hayyiz-subjects',
        'hayyiz-exams',
        'hayyiz-goals',
        'hayyiz-subject-goals',
        'hayyiz-student-exams',
        'hayyiz-custom-events'
    ]);

    // المفاتيح ذات الكائنات الهيكلية (Objects)
    const objectKeys = new Set([
        'hayyiz-focus-history',
        'hayyiz-task-session',
        'hayyiz-current-event',
        'hayyiz-pomodoro-state',
        'hayyiz-subject-progress',
        'hayyiz-gpa-snapshot',
        'hayyiz-academic-goal',
        'hayyiz-daily-goal',
        'hayyiz-deleted-items'
    ]);

    // المفاتيح العددية النصية
    const numericKeys = new Set([
        'hayyiz-sessions',
        'hayyiz-sessions-today',
        'hayyiz-focus-minutes-today',
        'hayyiz-pref-work',
        'hayyiz-pref-break',
        'hayyiz-pref-long',
        'hayyiz-session-in-cycle',
        'hayyiz-highscore',
        'hayyiz-current-task-index',
        'hayyiz-hide-pomo-prompt-hour'
    ]);

    let valStr = typeof rawVal === 'string' ? rawVal : String(rawVal);

    if (arrayCollectionKeys.has(key)) {
        try {
            const parsed = JSON.parse(valStr);
            if (!Array.isArray(parsed)) return JSON.stringify([]);
            const clean = hayyizSanitizeObject(parsed).filter((item) => item && typeof item === 'object');
            return JSON.stringify(clean);
        } catch (e) {
            return null;
        }
    }

    if (objectKeys.has(key)) {
        try {
            const parsed = JSON.parse(valStr);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
            const clean = hayyizSanitizeObject(parsed);
            return JSON.stringify(clean);
        } catch (e) {
            return null;
        }
    }

    if (numericKeys.has(key)) {
        const num = Number(valStr);
        if (!Number.isFinite(num)) return null;
        return String(num);
    }

    // مفاتيح النصوص البسيطة
    if (typeof valStr === 'string') {
        // حماية إضافية في حالة تم تمرير JSON نصي يحتوي حقول حظر في سلاسل نصية
        return valStr;
    }

    return null;
}

function exportHayyizData() {
    const data = {
        version: 2,
        exportedAt: new Date().toISOString(),
        app: 'حيز',
        keys: {}
    };
    HAYYIZ_ALLOWED_BACKUP_KEYS.forEach((key) => {
        const val = localStorage.getItem(key);
        if (val !== null) {
            const sanitized = hayyizSanitizeValue(key, val);
            if (sanitized !== null) {
                data.keys[key] = sanitized;
            }
        }
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = 'hayyiz-backup-' + today + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function importHayyizData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            if (!data || typeof data !== 'object' || !data.keys || typeof data.keys !== 'object') {
                alert('الملف غير صالح. تأكد أنه نسخة احتياطية من حيز.');
                return;
            }
            const allowedSet = new Set(HAYYIZ_ALLOWED_BACKUP_KEYS);
            const toImport = {};
            let count = 0;

            Object.keys(data.keys).forEach((key) => {
                if (allowedSet.has(key)) {
                    const rawVal = data.keys[key];
                    const sanitizedVal = hayyizSanitizeValue(key, rawVal);
                    if (sanitizedVal !== null) {
                        toImport[key] = sanitizedVal;
                        count++;
                    }
                }
            });

            if (count === 0) {
                alert('لم يُعثر على بيانات شخصية صالحة ومسموح بها في الملف.');
                return;
            }
            const ok = confirm(
                'سيتم استبدال البيانات الحالية في هذا المتصفح ببيانات النسخة الاحتياطية (' +
                count +
                ' مفتاح).\n\nهل أنت متأكد؟ يُفضّل تصدير نسخة حالية أولًا.'
            );
            if (!ok) return;
            Object.keys(toImport).forEach((key) => {
                localStorage.setItem(key, toImport[key]);
            });
            if (typeof hayyizEnsureDataShape === 'function') {
                hayyizEnsureDataShape();
            }
            alert('تم استيراد البيانات بنجاح. سيتم تحديث الصفحة.');
            window.location.reload();
        } catch (e) {
            alert('تعذر قراءة الملف. تأكد أنه JSON صالح من حيز.');
        }
    };
    reader.onerror = () => alert('فشل قراءة الملف.');
    reader.readAsText(file);
}

document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('hayyiz-export-btn');
    const importBtn = document.getElementById('hayyiz-import-btn');
    const importFile = document.getElementById('hayyiz-import-file');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportHayyizData);
    }
    if (importBtn && importFile) {
        importBtn.addEventListener('click', () => importFile.click());
        importFile.addEventListener('change', () => {
            if (importFile.files && importFile.files[0]) {
                importHayyizData(importFile.files[0]);
                importFile.value = '';
            }
        });
    }
});

/* =========================================================
 * طبقة البيانات والتكامل — Hayyiz Data Layer
 * تفصل المنطق عن الواجهة وتوحّد Tasks / Subjects / Focus / Recommend
 * ========================================================= */

function hayyizGenerateId() {
    return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function hayyizParseJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
    } catch (e) {
        return fallback;
    }
}

function hayyizSaveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

/** يضمن وجود id لكل مهمة وملاحظة، ويحفظ إن لزم */
function hayyizEnsureDataShape() {
    let changed = false;

    const todos = hayyizParseJSON('hayyiz-todos', []);
    if (Array.isArray(todos)) {
        todos.forEach((t) => {
            if (t && !t.id) {
                t.id = hayyizGenerateId();
                changed = true;
            }
        });
        if (changed) hayyizSaveJSON('hayyiz-todos', todos);
    }

    let notesChanged = false;
    const notes = hayyizParseJSON('hayyiz-notes', []);
    if (Array.isArray(notes)) {
        notes.forEach((n) => {
            if (n && !n.id) {
                n.id = hayyizGenerateId();
                notesChanged = true;
            }
        });
        if (notesChanged) hayyizSaveJSON('hayyiz-notes', notes);
    }

    // تهيئة مصفوفات فارغة إن لم تكن موجودة
    if (localStorage.getItem('hayyiz-subjects') === null) {
        hayyizSaveJSON('hayyiz-subjects', []);
    }
    if (localStorage.getItem('hayyiz-exams') === null) {
        hayyizSaveJSON('hayyiz-exams', []);
    }
    if (localStorage.getItem('hayyiz-goals') === null) {
        hayyizSaveJSON('hayyiz-goals', []);
    }
    if (localStorage.getItem('hayyiz-subject-progress') === null) {
        hayyizSaveJSON('hayyiz-subject-progress', {});
    }
}

/** قراءة/حفظ المهام مع ضمان المعرفات والحالة والملاءمة الكاملة */
function hayyizGetTodos() {
    hayyizEnsureDataShape();
    return hayyizParseJSON('hayyiz-todos', []);
}

function hayyizSaveTodos(todos) {
    if (!Array.isArray(todos)) return;
    todos.forEach((t) => {
        if (!t) return;
        if (!t.id) t.id = hayyizGenerateId();
        if (t.completed) {
            t.status = 'completed';
        } else if (!t.status || t.status === 'completed') {
            t.status = (parseInt(t.focusDone, 10) || 0) > 0 ? 'in-progress' : 'todo';
        }
    });
    hayyizSaveJSON('hayyiz-todos', todos);
}

function hayyizFindTodoIndex(todos, task) {
    if (!Array.isArray(todos) || !task) return -1;
    if (task.id) {
        const byId = todos.findIndex((t) => t && t.id === task.id);
        if (byId >= 0) return byId;
    }
    if (typeof task.index === 'number' && todos[task.index] && todos[task.index].text === task.text) {
        return task.index;
    }
    if (task.text) {
        return todos.findIndex((t) => t && t.text === task.text && !t.completed);
    }
    return -1;
}

function hayyizGetTodoById(id) {
    if (!id) return null;
    const todos = hayyizGetTodos();
    return todos.find((t) => t && t.id === id) || null;
}

function hayyizGetTaskById(id) {
    return hayyizGetTodoById(id);
}

function hayyizUpdateTask(id, patch) {
    if (!id || !patch || typeof patch !== 'object') return null;
    const todos = hayyizGetTodos();
    const idx = todos.findIndex((t) => t && t.id === id);
    if (idx < 0) return null;

    todos[idx] = Object.assign({}, todos[idx], patch);
    if (patch.completed !== undefined) {
        todos[idx].completed = Boolean(patch.completed);
        if (todos[idx].completed) {
            todos[idx].status = 'completed';
            if (!todos[idx].completedAt) todos[idx].completedAt = getTodayLocal();
        } else {
            todos[idx].status = (parseInt(todos[idx].focusDone, 10) || 0) > 0 ? 'in-progress' : 'todo';
            delete todos[idx].completedAt;
        }
    } else if (patch.status) {
        if (patch.status === 'completed') {
            todos[idx].completed = true;
            if (!todos[idx].completedAt) todos[idx].completedAt = getTodayLocal();
        } else {
            todos[idx].completed = false;
            delete todos[idx].completedAt;
        }
    }

    hayyizSaveTodos(todos);
    return todos[idx];
}

function hayyizDeleteTask(id) {
    if (!id) return false;
    const todos = hayyizGetTodos();
    const idx = todos.findIndex((t) => t && t.id === id);
    if (idx < 0) return false;
    const taskToDelete = todos[idx];
    todos.splice(idx, 1);
    hayyizSaveTodos(todos);
    if (typeof hayyizDeleteRemoteItem === 'function') {
        hayyizDeleteRemoteItem('todos', id, taskToDelete);
    }
    return true;
}

/** صيغة التواريخ النسبية والسياقية للمهام */
function hayyizFormatRelativeDueDate(dateStr) {
    if (!dateStr) return { label: 'بدون موعد', isOverdue: false, days: null, cssClass: 'due-none' };
    const dateOnly = String(dateStr).slice(0, 10);
    const days = hayyizDaysUntil(dateOnly);
    if (days === null) return { label: dateStr, isOverdue: false, days: null, cssClass: 'due-none' };

    if (days < 0) {
        const abs = Math.abs(days);
        const label = abs === 1 ? 'متأخرة يوماً واحداً' : (abs === 2 ? 'متأخرة يومين' : `متأخرة ${abs} أيام`);
        return { label, isOverdue: true, days, cssClass: 'due-overdue' };
    } else if (days === 0) {
        return { label: 'اليوم', isOverdue: false, days: 0, cssClass: 'due-today' };
    } else if (days === 1) {
        return { label: 'غداً', isOverdue: false, days: 1, cssClass: 'due-tomorrow' };
    } else if (days <= 7) {
        return { label: `بعد ${days} أيام`, isOverdue: false, days, cssClass: 'due-week' };
    } else {
        return { label: dateOnly, isOverdue: false, days, cssClass: 'due-future' };
    }
}

/** ملخص إحصاءات المهام للـ Dashboard وشريط المهام */
function hayyizGetTaskSummary() {
    const todos = hayyizGetTodos();
    const today = getTodayLocal();

    const active = todos.filter((t) => t && !t.completed);
    const completedToday = todos.filter((t) => t && t.completed && t.completedAt === today).length;
    const overdue = active.filter((t) => t.date && String(t.date).slice(0, 10) < today);
    const dueToday = active.filter((t) => t.date && String(t.date).slice(0, 10) === today);

    let totalFocusMin = 0;
    todos.forEach((t) => {
        totalFocusMin += (parseInt(t.focusDone, 10) || 0);
    });

    return {
        total: todos.length,
        activeCount: active.length,
        completedToday,
        completedTotal: todos.length - active.length,
        overdueCount: overdue.length,
        dueTodayCount: dueToday.length,
        totalFocusMinutes: totalFocusMin
    };
}

/* ---------- المواد ---------- */

function hayyizGetSubjects() {
    hayyizEnsureDataShape();
    return hayyizParseJSON('hayyiz-subjects', []);
}

function hayyizSaveSubjects(list) {
    hayyizSaveJSON('hayyiz-subjects', Array.isArray(list) ? list : []);
}

function hayyizAddSubject(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) return null;
    const list = hayyizGetSubjects();
    const exists = list.find((s) => s.name === trimmed);
    if (exists) return exists;
    const nowMs = Date.now();
    const subject = {
        id: hayyizGenerateId(),
        name: trimmed,
        created: nowMs,
        updated: nowMs,
        focusMinutes: 0,
        sessions: 0
    };
    list.push(subject);
    hayyizSaveSubjects(list);
    if (typeof hayyizUploadItem === 'function') {
        hayyizUploadItem('subjects', subject.id, subject);
    }
    return subject;
}

function hayyizGetSubjectById(id) {
    if (!id) return null;
    return hayyizGetSubjects().find((s) => s.id === id) || null;
}

function hayyizGetSubjectName(id) {
    const s = hayyizGetSubjectById(id);
    return s ? s.name : '';
}

/** تحديث تقدم المادة من جلسة تركيز */
function hayyizBumpSubjectProgress(subjectId, minutes) {
    if (!subjectId || !minutes || minutes <= 0) return;
    const list = hayyizGetSubjects();
    const idx = list.findIndex((s) => s.id === subjectId);
    if (idx < 0) return;
    const nowMs = Date.now();
    list[idx].focusMinutes = (parseInt(list[idx].focusMinutes, 10) || 0) + minutes;
    list[idx].sessions = (parseInt(list[idx].sessions, 10) || 0) + 1;
    list[idx].lastFocused = getTodayLocal();
    list[idx].updated = nowMs;
    hayyizSaveSubjects(list);

    if (typeof hayyizUploadItem === 'function') {
        hayyizUploadItem('subjects', list[idx].id, list[idx]);
    }

    const progress = hayyizParseJSON('hayyiz-subject-progress', {});
    const day = getTodayLocal();
    if (!progress[subjectId]) progress[subjectId] = {};
    progress[subjectId][day] = (parseInt(progress[subjectId][day], 10) || 0) + minutes;
    hayyizSaveJSON('hayyiz-subject-progress', progress);
}

/* ---------- الاختبارات والأهداف (خفيف) ---------- */

function hayyizGetExams() {
    hayyizEnsureDataShape();
    return hayyizParseJSON('hayyiz-exams', []);
}

function hayyizSaveExams(list) {
    hayyizSaveJSON('hayyiz-exams', Array.isArray(list) ? list : []);
}

function hayyizGetGoals() {
    hayyizEnsureDataShape();
    return hayyizParseJSON('hayyiz-goals', []);
}

function hayyizSaveGoals(list) {
    hayyizSaveJSON('hayyiz-goals', Array.isArray(list) ? list : []);
}

function hayyizDaysUntil(dateStr) {
    if (!dateStr) return null;
    const day = String(dateStr).slice(0, 10);
    const today = getTodayLocal();
    const t0 = new Date(today + 'T12:00:00').getTime();
    const t1 = new Date(day + 'T12:00:00').getTime();
    if (isNaN(t0) || isNaN(t1)) return null;
    return Math.round((t1 - t0) / 86400000);
}

/* ---------- محرك التوصية (حتمي، بدون AI) ---------- */

/**
 * يحسب درجة أولوية داخلية للمهمة.
 * لا تُعرض المعادلة للطالب — تُستخدم فقط لاختيار «ابدأ من هنا».
 */
function hayyizScoreTask(task, context) {
    if (!task || task.completed) return -Infinity;

    const ctx = context || {};
    const today = ctx.today || getTodayLocal();
    const exams = ctx.exams || hayyizGetExams();
    const subjects = ctx.subjects || hayyizGetSubjects();
    const subjectGoals = ctx.subjectGoals || hayyizGetSubjectGoals();
    const workMin = ctx.workMin || parseInt(localStorage.getItem("hayyiz-pref-work") || "25", 10) || 25;

    let score = 0;
    const reasons = [];

    const focusDone = parseInt(task.focusDone, 10) || 0;
    const totalMin = parseInt(task.minutes, 10) || 0;
    const isInProgress = focusDone > 0;

    if (isInProgress) {
        score += 60;
        reasons.push("مهمة قيد التنفيذ — أكمل ما بدأت");
    }

    // الأولوية
    const pri = { high: 40, medium: 18, low: 5 };
    score += pri[task.priority] || 10;

    // موعد التسليم
    if (task.date) {
        const days = hayyizDaysUntil(String(task.date).slice(0, 10));
        if (days !== null) {
            if (days < 0) {
                score += 55;
                if (!isInProgress) reasons.push("متأخرة عن موعدها");
            } else if (days === 0) {
                score += 45;
                if (!isInProgress) reasons.push("مستحقة اليوم");
            } else if (days === 1) {
                score += 30;
                if (!isInProgress) reasons.push("موعدها غداً");
            } else if (days <= 3) {
                score += 18;
                if (!isInProgress) reasons.push("موعدها قريب");
            } else if (days <= 7) {
                score += 8;
            }
        }
    }

    if (!isInProgress && task.priority === "high") {
        reasons.push("أولويتها عالية");
    }

    // قرب اختبار أو هدف مرتبط بالمادة
    if (task.subjectId) {
        const sub = subjects.find((s) => s.id === task.subjectId);
        const subGoal = sub ? subjectGoals.find((sg) => sg.name === sub.name) : null;
        if (subGoal && !isInProgress) {
            score += 20;
            reasons.push("مرتبطة بهدفك النشط وموعدها قريب");
        }

        const relatedExams = exams.filter(
            (e) => e && !e.done && e.subjectId === task.subjectId && e.date
        );
        relatedExams.forEach((ex) => {
            const d = hayyizDaysUntil(String(ex.date).slice(0, 10));
            if (d === null) return;
            if (d < 0) {
                score += 20;
            } else if (d <= 3) {
                score += 35;
                if (!isInProgress) reasons.push("مرتبطة باختبار قريب");
            } else if (d <= 7) {
                score += 22;
            }
        });
    }

    // ملاءمة المدة
    if (totalMin > 0) {
        const remaining = Math.max(0, totalMin - focusDone);
        if (remaining > 0 && remaining <= workMin) {
            score += 14;
        }
    }

    if (reasons.length === 0) {
        if (task.priority === "high") reasons.push("هي أعلى مهمة أولوية حالياً");
        else reasons.push("أعلى مهمة أولوية حالياً");
    }

    return { score, reasons: reasons.slice(0, 2), task, isInProgress };
}

/**
 * يعيد أفضل مهمة للبدء + قائمة مرتبة.
 * @returns {{ next: object|null, reason: string, isInProgress: boolean, ranked: Array, allActive: Array }}
 */
function hayyizRecommendNext(limit) {
    const todos = hayyizGetTodos();
    const active = todos.filter((t) => t && !t.completed);
    const ctx = {
        today: getTodayLocal(),
        exams: hayyizGetExams(),
        subjects: hayyizGetSubjects(),
        subjectGoals: hayyizGetSubjectGoals(),
        workMin: parseInt(localStorage.getItem("hayyiz-pref-work") || "25", 10) || 25
    };

    const ranked = active
        .map((t) => hayyizScoreTask(t, ctx))
        .filter((r) => r.score > -Infinity)
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return (b.task.created || 0) - (a.task.created || 0);
        });

    const max = typeof limit === "number" ? limit : 5;
    const top = ranked.slice(0, max);
    const next = top[0] || null;

    return {
        next: next ? next.task : null,
        reason: next ? next.reasons.join(" · ") : "",
        isInProgress: next ? !!next.isInProgress : false,
        ranked: top,
        allActive: active
    };
}

/* ---------- Focus Engine Data Layer Helpers ---------- */

/**
 * التأكد من إعادة تهيئة إحصائيات اليوم عند تغير التاريخ
 */
function hayyizEnsureTodayStats() {
    const today = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
    const lastDay = localStorage.getItem('hayyiz-sessions-day');
    if (lastDay !== today) {
        localStorage.setItem('hayyiz-sessions-today', '0');
        localStorage.setItem('hayyiz-focus-minutes-today', '0');
        localStorage.setItem('hayyiz-sessions-day', today);
    }
}

/**
 * دالة مركزية لمطابقة وتحديث حالة البومودورو بشكل حتمي وidempotent اعتماداً على timestamps
 */
function hayyizReconcilePomodoroState() {
    hayyizEnsureTodayStats();
    const raw = localStorage.getItem('hayyiz-pomodoro-state');
    if (!raw) return null;

    try {
        const state = JSON.parse(raw);
        if (!state || typeof state !== 'object') return null;

        const workMin = parseInt(state.workMinutes || localStorage.getItem('hayyiz-pref-work') || '25', 10) || 25;
        const breakMin = parseInt(state.breakMinutes || localStorage.getItem('hayyiz-pref-break') || '5', 10) || 5;
        const longBreakMin = parseInt(state.longBreakMinutes || localStorage.getItem('hayyiz-pref-long') || '15', 10) || 15;

        let mode = state.mode || (state.isWorkMode === false ? 'break' : 'focus');
        let status = state.status || (state.isRunning ? 'running' : 'idle');
        let endTime = typeof state.endTime === 'number' ? state.endTime : null;
        let totalDuration = typeof state.totalDuration === 'number' ? state.totalDuration : (mode === 'focus' ? workMin : breakMin) * 60;
        let remainingSeconds = typeof state.remainingSeconds === 'number' ? state.remainingSeconds : totalDuration;
        let sessionInCycle = typeof state.sessionInCycle === 'number' ? state.sessionInCycle : parseInt(localStorage.getItem('hayyiz-session-in-cycle') || '0', 10);
        let sessionId = state.sessionId || null;
        let pendingCompletionModal = state.pendingCompletionModal || null;
        let pendingNextMode = state.pendingNextMode || null;

        let context = state.context || null;
        if (!context) {
            const taskName = localStorage.getItem('hayyiz-current-task');
            const taskId = localStorage.getItem('hayyiz-current-task-id');
            const eventRaw = localStorage.getItem('hayyiz-current-event');
            let eventObj = null;
            try { eventObj = eventRaw ? JSON.parse(eventRaw) : null; } catch(e){}

            if (taskName) {
                context = { type: 'task', id: taskId || null, title: taskName };
            } else if (eventObj && eventObj.name) {
                context = { type: 'event', id: eventObj.id || null, title: eventObj.name };
            } else {
                context = { type: 'free', id: null, title: 'تركيز حر' };
            }
        }

        // تقييم الجلسة النشطة
        if (status === 'running' && endTime) {
            const now = Date.now();
            const rem = Math.round((endTime - now) / 1000);

            if (rem <= 0) {
                // انتهى وقت الجلسة
                remainingSeconds = 0;
                status = 'completed';
                endTime = null;

                if (!sessionId) {
                    sessionId = 's_legacy_' + (state.lastUpdated || Date.now());
                }

                // التحقق الإلزامي من عدم تكرار التسجيل (Idempotency guarantee)
                const log = hayyizGetFocusSessions();
                const alreadyLogged = log.some((entry) => entry && entry.id === sessionId);

                if (!alreadyLogged) {
                    if (mode === 'focus') {
                        const workMinJustDone = Math.round(totalDuration / 60) || workMin;

                        // 1. تحديث الإحصائيات العامة والإحصائيات اليومية مرة واحدة فقط
                        const completedTotal = parseInt(localStorage.getItem('hayyiz-sessions') || '0', 10) + 1;
                        localStorage.setItem('hayyiz-sessions', String(completedTotal));

                        hayyizEnsureTodayStats();
                        const todaySess = parseInt(localStorage.getItem('hayyiz-sessions-today') || '0', 10) + 1;
                        const todayMin = parseInt(localStorage.getItem('hayyiz-focus-minutes-today') || '0', 10) + workMinJustDone;
                        localStorage.setItem('hayyiz-sessions-today', String(todaySess));
                        localStorage.setItem('hayyiz-focus-minutes-today', String(todayMin));

                        // 2. تحديث سجل تاريخ التركيز
                        try {
                            const hist = JSON.parse(localStorage.getItem('hayyiz-focus-history') || '{}');
                            const today = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
                            const nowMs = Date.now();
                            hist[today] = (parseInt(hist[today], 10) || 0) + workMinJustDone;
                            localStorage.setItem('hayyiz-focus-history', JSON.stringify(hist));
                            localStorage.setItem('hayyiz-focus-history-updated', String(nowMs));
                            if (typeof hayyizUploadItem === 'function') {
                                hayyizUploadItem('focus-history', 'history', hist);
                            }
                        } catch (e) {}

                        // 3. كتابة السجل غير القابل للتغيير
                        hayyizLogFocusSession({
                            id: sessionId,
                            durationMinutes: workMinJustDone,
                            mode: 'focus',
                            contextType: context.type,
                            contextId: context.id,
                            contextTitle: context.title,
                            subjectId: context.subjectId
                        });

                        // 4. تطبيق نتيجة التركيز على المهمة أو المادة
                        if (context.type === 'task') {
                            hayyizApplyFocusResult({
                                workMin: workMinJustDone,
                                taskId: context.id,
                                taskText: context.title
                            });
                        } else if (context.subjectId) {
                            hayyizBumpSubjectProgress(context.subjectId, workMinJustDone);
                        }

                        // 5. تحديث دورة الجلسات وتجهيز النمط القادم
                        sessionInCycle++;
                        let isLong = false;
                        if (sessionInCycle >= 4) {
                            sessionInCycle = 0;
                            isLong = true;
                        }

                        const nextBreakMin = isLong ? longBreakMin : breakMin;
                        pendingNextMode = isLong ? 'longBreak' : 'break';

                        pendingCompletionModal = {
                            workMinJustDone: workMinJustDone,
                            isLongBreak: isLong,
                            breakMin: nextBreakMin,
                            contextTitle: context.title
                        };
                    } else {
                        // انتهت جلسة راحة
                        pendingNextMode = 'focus';
                    }
                }
            } else {
                remainingSeconds = rem;
            }
        }

        const reconciled = {
            mode,
            status,
            endTime,
            remainingSeconds: Math.max(0, remainingSeconds),
            totalDuration: Math.max(1, totalDuration),
            workMinutes: workMin,
            breakMinutes: breakMin,
            longBreakMinutes: longBreakMin,
            sessionInCycle,
            sessionId,
            context,
            pendingCompletionModal,
            pendingNextMode,
            lastUpdated: Date.now()
        };

        localStorage.setItem('hayyiz-pomodoro-state', JSON.stringify(reconciled));
        localStorage.setItem('hayyiz-session-in-cycle', String(sessionInCycle));

        return reconciled;
    } catch (e) {
        return null;
    }
}

/**
 * جلب حالة جهاز التركيز الحالية بعد التثبت والمطابقة
 */
function hayyizGetFocusState() {
    return hayyizReconcilePomodoroState();
}

/**
 * حفظ حالة جهاز التركيز
 */
function hayyizSaveFocusState(state) {
    if (!state || typeof state !== 'object') {
        localStorage.removeItem('hayyiz-pomodoro-state');
        return;
    }
    state.lastUpdated = Date.now();
    hayyizSaveJSON('hayyiz-pomodoro-state', state);
}

/**
 * جلب سجل الجلسات المكتملة
 */
function hayyizGetFocusSessions() {
    return hayyizParseJSON('hayyiz-focus-sessions-log', []);
}

/**
 * تسجيل جلسة تركيز مكتملة في السجل غير القابل للتغيير
 */
function hayyizLogFocusSession(sessionObj) {
    if (!sessionObj) return;
    const log = hayyizGetFocusSessions();
    const today = getTodayLocal();
    const entry = {
        id: sessionObj.id || hayyizGenerateId(),
        timestamp: new Date().toISOString(),
        date: today,
        durationMinutes: parseInt(sessionObj.durationMinutes, 10) || 25,
        mode: sessionObj.mode || 'focus',
        contextSnapshot: {
            type: sessionObj.contextType || 'free',
            id: sessionObj.contextId || null,
            title: sessionObj.contextTitle || 'تركيز حر',
            subjectId: sessionObj.subjectId || null
        }
    };
    log.unshift(entry);
    // الاحتفاظ بأحدث 200 جلسة لمنع التضخم
    if (log.length > 200) log.length = 200;
    hayyizSaveJSON('hayyiz-focus-sessions-log', log);
    if (typeof hayyizUploadItem === 'function') {
        hayyizUploadItem('focus-log', entry.id, entry);
    }
    return entry;
}

/**
 * حساب أيام الاستمرارية (Streak): عدد الأيام المتتالية التي أُكملت فيها جلسة واحدة على الأقل
 */
function hayyizCalculateStreak() {
    try {
        const hist = hayyizParseJSON('hayyiz-focus-history', {});
        const today = getTodayLocal();
        const yesterday = getYesterdayLocal();

        let streak = 0;
        let checkDate = new Date();

        // هل توجد جلسة اليوم؟
        const hasToday = (parseInt(hist[today], 10) || 0) > 0;
        if (!hasToday) {
            // نتحقق من الأمس، إذا لم يوجد جلسة بالأمس فالستريك 0
            const hasYesterday = (parseInt(hist[yesterday], 10) || 0) > 0;
            if (!hasYesterday) return 0;
            // تبدأ السلسلة من الأمس
            checkDate.setDate(checkDate.getDate() - 1);
        }

        while (true) {
            const year = checkDate.getFullYear();
            const month = String(checkDate.getMonth() + 1).padStart(2, '0');
            const day = String(checkDate.getDate()).padStart(2, '0');
            const key = `${year}-${month}-${day}`;
            const minutes = parseInt(hist[key], 10) || 0;
            if (minutes > 0) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
        return streak;
    } catch (e) {
        return 0;
    }
}

/* ---------- إطلاق جلسة تركيز موحّد ---------- */

/**
 * يجهّز التخزين وينتقل إلى صفحة البومودورو مرتبطاً بمهمة أو حدث تقويم أو تركيز حر.
 */
function hayyizLaunchPomodoro(target, indexHint) {
    if (!target) {
        localStorage.removeItem('hayyiz-current-task');
        localStorage.removeItem('hayyiz-current-task-index');
        localStorage.removeItem('hayyiz-current-task-id');
        localStorage.removeItem('hayyiz-task-session');
        localStorage.removeItem('hayyiz-current-event');
        window.location.href = 'pomodoro.html';
        return;
    }

    // إذا كان الهدف حدث تقويم (يحتوي على date أو type)
    if (typeof target === 'object' && (target.type || target.date) && !target.text) {
        const eventSnapshot = {
            id: target.id || null,
            name: target.name || target.title || 'حدث تقويم',
            date: target.date || null,
            type: target.type || 'exam',
            subjectId: target.subjectId || null
        };
        localStorage.setItem('hayyiz-current-event', JSON.stringify(eventSnapshot));
        localStorage.removeItem('hayyiz-current-task');
        localStorage.removeItem('hayyiz-current-task-index');
        localStorage.removeItem('hayyiz-current-task-id');
        localStorage.removeItem('hayyiz-task-session');
        window.location.href = 'pomodoro.html?event=' + encodeURIComponent(eventSnapshot.name);
        return;
    }

    // إذا كان الهدف مهمة
    const taskText = typeof target === 'string' ? target : target.text;
    if (!taskText) {
        window.location.href = 'pomodoro.html';
        return;
    }

    const taskObj = typeof target === 'object' ? target : { text: taskText };
    const todos = hayyizGetTodos();
    let index = typeof indexHint === 'number' ? indexHint : -1;
    if (index < 0 || !todos[index] || (taskObj.id && todos[index].id !== taskObj.id)) {
        index = hayyizFindTodoIndex(todos, taskObj);
    }
    if (index < 0 && taskObj.id) {
        index = todos.findIndex((t) => t && t.id === taskObj.id);
    }

    const workMin = parseInt(localStorage.getItem('hayyiz-pref-work') || '25', 10) || 25;
    const totalMinutes = taskObj.minutes ? parseInt(taskObj.minutes, 10) : null;
    const plan = {
        text: taskText,
        id: taskObj.id || null,
        index: index,
        subjectId: taskObj.subjectId || null,
        totalMinutes: totalMinutes && totalMinutes > 0 ? totalMinutes : null,
        focusDone: taskObj.focusDone ? parseInt(taskObj.focusDone, 10) || 0 : 0,
        sessionsDone: taskObj.sessionsDone ? parseInt(taskObj.sessionsDone, 10) || 0 : 0,
        sessionsNeeded:
            totalMinutes && totalMinutes > 0
                ? Math.ceil(totalMinutes / workMin)
                : null
    };

    localStorage.setItem('hayyiz-current-task', taskText);
    if (taskObj.id) localStorage.setItem('hayyiz-current-task-id', taskObj.id);
    else localStorage.removeItem('hayyiz-current-task-id');
    localStorage.setItem('hayyiz-current-task-index', String(index >= 0 ? index : -1));
    localStorage.setItem('hayyiz-task-session', JSON.stringify(plan));
    localStorage.removeItem('hayyiz-current-event');
    window.location.href = 'pomodoro.html?task=' + encodeURIComponent(taskText);
}

/**
 * بعد انتهاء جلسة عمل: يحدّث المهمة + المادة + اليوم.
 * يُستدعى من pomodoro.js
 */
function hayyizApplyFocusResult(opts) {
    const options = opts || {};
    const workMin = parseInt(options.workMin, 10) || 25;
    const taskId = options.taskId || localStorage.getItem('hayyiz-current-task-id');
    const taskText = options.taskText || localStorage.getItem('hayyiz-current-task');
    let plan = null;
    try {
        plan = JSON.parse(localStorage.getItem('hayyiz-task-session') || 'null');
    } catch (e) {
        plan = null;
    }

    const todos = hayyizGetTodos();
    let idx = -1;
    if (taskId) idx = todos.findIndex((t) => t && t.id === taskId);
    if (idx < 0 && plan && plan.id) idx = todos.findIndex((t) => t && t.id === plan.id);
    if (idx < 0 && plan && typeof plan.index === 'number' && todos[plan.index] && todos[plan.index].text === taskText) {
        idx = plan.index;
    }
    if (idx < 0 && taskText) {
        idx = todos.findIndex((t) => t && t.text === taskText && !t.completed);
    }

    if (idx >= 0 && todos[idx]) {
        const nowMs = Date.now();
        const focusDone = (parseInt(todos[idx].focusDone, 10) || 0) + workMin;
        const sessionsDone = (parseInt(todos[idx].sessionsDone, 10) || 0) + 1;
        todos[idx].focusDone = focusDone;
        todos[idx].sessionsDone = sessionsDone;
        todos[idx].lastFocused = getTodayLocal();
        todos[idx].updated = nowMs;
        hayyizSaveTodos(todos);

        if (typeof hayyizUploadItem === 'function') {
            hayyizUploadItem('todos', todos[idx].id, todos[idx]);
        }

        if (plan) {
            plan.focusDone = focusDone;
            plan.sessionsDone = sessionsDone;
            plan.id = todos[idx].id;
            plan.subjectId = todos[idx].subjectId || plan.subjectId || null;
            if (plan.totalMinutes) {
                plan.sessionsNeeded = Math.ceil(plan.totalMinutes / workMin);
            }
            localStorage.setItem('hayyiz-task-session', JSON.stringify(plan));
        }

        const subjectId = todos[idx].subjectId || (plan && plan.subjectId);
        if (subjectId) {
            hayyizBumpSubjectProgress(subjectId, workMin);
        }

        return { task: todos[idx], index: idx, plan };
    }

    // لا مهمة مرتبطة — نحدّث المادة فقط إن وُجدت في الخطة
    if (plan && plan.subjectId) {
        hayyizBumpSubjectProgress(plan.subjectId, workMin);
    }
    return null;
}

/**
 * تعليم مهمة كمكتملة بالاعتماد على id أولاً
 */
function hayyizCompleteTask(taskId, taskText, indexHint) {
    const todos = hayyizGetTodos();
    let idx = -1;
    if (taskId) idx = todos.findIndex((t) => t && t.id === taskId);
    if (idx < 0 && typeof indexHint === 'number' && todos[indexHint] && todos[indexHint].text === taskText) {
        idx = indexHint;
    }
    if (idx < 0 && taskText) {
        idx = todos.findIndex((t) => t && t.text === taskText && !t.completed);
    }
    if (idx < 0) return false;

    const nowMs = Date.now();
    todos[idx].completed = true;
    todos[idx].completedAt = getTodayLocal();
    todos[idx].updated = nowMs;
    hayyizSaveTodos(todos);

    if (typeof hayyizUploadItem === 'function') {
        hayyizUploadItem('todos', todos[idx].id, todos[idx]);
    }
    return true;
}

/**
 * بناء قائمة منسدلة للمواد داخل نموذج موجود
 */
function hayyizFillSubjectSelect(selectEl, selectedId) {
    if (!selectEl) return;
    const subjects = hayyizGetSubjects();
    selectEl.innerHTML = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'بدون مادة';
    selectEl.appendChild(empty);
    subjects.forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        if (selectedId && selectedId === s.id) opt.selected = true;
        selectEl.appendChild(opt);
    });
}

// تهيئة الشكل عند تحميل أي صفحة
if (typeof window !== 'undefined') {
    try {
        hayyizEnsureDataShape();
    } catch (e) { /* تجاهل */ }
}


/* ---------- المعدل والأهداف الأكاديمية ---------- */

/**
 * حساب المعدل الموزون من قائمة مواد { grade, weight }
 * Single Source of Truth — تُستخدم في الحاسبة و«ماذا لو؟» والـDashboard
 */
function hayyizComputeWeightedGpa(subjects) {
    if (!Array.isArray(subjects) || !subjects.length) return null;
    let totalWeighted = 0;
    let totalWeight = 0;
    subjects.forEach((s) => {
        const val = parseFloat(s.grade);
        const weight = parseFloat(s.weight);
        if (!isNaN(val) && val >= 0 && val <= 100 && !isNaN(weight) && weight > 0) {
            totalWeighted += val * weight;
            totalWeight += weight;
        }
    });
    if (totalWeight <= 0) return null;
    return totalWeighted / totalWeight;
}

function hayyizGetGpaSnapshot() {
    return hayyizParseJSON('hayyiz-gpa-snapshot', null);
}

function hayyizSaveGpaSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;
    snapshot.updatedAt = Date.now();
    snapshot.version = 1;
    hayyizSaveJSON('hayyiz-gpa-snapshot', snapshot);
    if (typeof hayyizUploadItem === 'function') {
        hayyizUploadItem('gpa-snapshot', 'snapshot', snapshot);
    }
}

function hayyizGetAcademicGoal() {
    return hayyizParseJSON('hayyiz-academic-goal', null);
}

function hayyizSaveAcademicGoal(goal) {
    if (!goal) {
        const oldGoal = hayyizGetAcademicGoal();
        localStorage.removeItem('hayyiz-academic-goal');
        if (typeof hayyizDeleteRemoteItem === 'function') {
            hayyizDeleteRemoteItem('academic-goal', 'goal', oldGoal);
        }
        return;
    }
    goal.updatedAt = Date.now();
    hayyizSaveJSON('hayyiz-academic-goal', goal);
    if (typeof hayyizUploadItem === 'function') {
        hayyizUploadItem('academic-goal', 'goal', goal);
    }
}

function hayyizGetSubjectGoals() {
    return hayyizParseJSON('hayyiz-subject-goals', []);
}

function hayyizSaveSubjectGoals(list) {
    const oldList = hayyizGetSubjectGoals();
    const newList = Array.isArray(list) ? list : [];
    const nowMs = Date.now();

    newList.forEach(item => {
        if (item) {
            if (!item.id) item.id = item.name || hayyizGenerateId();
            item.updated = nowMs;
            if (typeof hayyizUploadItem === 'function') {
                hayyizUploadItem('subject-goals', item.id, item);
            }
        }
    });

    oldList.forEach(oldItem => {
        if (oldItem && oldItem.id && !newList.some(n => n && n.id === oldItem.id)) {
            if (typeof hayyizDeleteRemoteItem === 'function') {
                hayyizDeleteRemoteItem('subject-goals', oldItem.id, oldItem);
            }
        }
    });

    hayyizSaveJSON('hayyiz-subject-goals', newList);
}

function hayyizGetDailyGoal() {
    const g = hayyizParseJSON('hayyiz-daily-goal', null);
    if (!g) return null;
    const today = getTodayLocal();
    if (g.date && g.date !== today) {
        // هدف يوم سابق — لا نعرضه كهدف اليوم
        return null;
    }
    return g;
}

function hayyizSaveDailyGoal(goal) {
    if (!goal) {
        const oldGoal = hayyizGetDailyGoal();
        localStorage.removeItem('hayyiz-daily-goal');
        if (typeof hayyizDeleteRemoteItem === 'function') {
            hayyizDeleteRemoteItem('daily-goal', 'goal', oldGoal);
        }
        return;
    }
    if (!goal.date) goal.date = getTodayLocal();
    goal.updated = Date.now();
    hayyizSaveJSON('hayyiz-daily-goal', goal);
    if (typeof hayyizUploadItem === 'function') {
        hayyizUploadItem('daily-goal', 'goal', goal);
    }
}

/**
 * ملخص جاهز للـDashboard: معدل حالي، هدف، فجوة، هدف اليوم
 */
function hayyizGetAcademicSummary() {
    const snap = hayyizGetGpaSnapshot();
    const goal = hayyizGetAcademicGoal();
    const current = snap && typeof snap.gpa === 'number' ? snap.gpa : null;
    const target = goal && typeof goal.target === 'number' ? goal.target : null;
    let gap = null;
    if (current !== null && target !== null) {
        gap = target - current;
    }
    const daily = hayyizGetDailyGoal();
    const subjectGoals = hayyizGetSubjectGoals();
    return {
        current,
        target,
        gap,
        snapshot: snap,
        goal,
        daily,
        subjectGoals
    };
}

/**
 * حساب إحصائيات المذاكرة الأسبوعية حسب المواد من البيانات المحلية الحقيقية
 */
function hayyizGetWeeklySubjectStats() {
    const subjects = hayyizGetSubjects();
    const progress = hayyizParseJSON('hayyiz-subject-progress', {});

    // الأيام الـ 7 الأخيرة
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        days.push(`${year}-${month}-${day}`);
    }

    const statsBySubject = [];
    let grandTotalMinutes = 0;

    subjects.forEach((s) => {
        let sumMin = 0;
        const subProg = progress[s.id] || {};
        days.forEach((dayStr) => {
            sumMin += parseInt(subProg[dayStr], 10) || 0;
        });
        if (sumMin > 0) {
            statsBySubject.push({
                id: s.id,
                name: s.name,
                minutes: sumMin
            });
            grandTotalMinutes += sumMin;
        }
    });

    statsBySubject.forEach((st) => {
        st.percentage = grandTotalMinutes > 0 ? Math.round((st.minutes / grandTotalMinutes) * 100) : 0;
    });

    statsBySubject.sort((a, b) => b.minutes - a.minutes);

    return {
        totalMinutes: grandTotalMinutes,
        subjects: statsBySubject
    };
}

/**
 * تأثير مادة على المعدل: فرق المعدل إذا ارتفعت الدرجة إلى target
 */
function hayyizSubjectImpact(subjects, index, newGrade) {
    const real = hayyizComputeWeightedGpa(subjects);
    if (real === null) return null;
    const clone = subjects.map((s, i) => {
        if (i !== index) return { grade: s.grade, weight: s.weight };
        return { grade: newGrade, weight: s.weight };
    });
    const hypothetical = hayyizComputeWeightedGpa(clone);
    if (hypothetical === null) return null;
    return {
        real,
        hypothetical,
        delta: hypothetical - real
    };
}

/* ---------- تقويم الطالب — Calendar Data Layer ---------- */

/**
 * حساب تقويمي دقيق للعمر بالأيام والأشهر والسنوات
 */
function hayyizCalculateExactAge(birthDateObj, nowObj) {
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

/**
 * حساب حالة وتاريخ وعداد 18 سنة
 */
function hayyizGet18Status(birthDateObj, nowObj) {
    const year18 = birthDateObj.getFullYear() + 18;
    const month18 = birthDateObj.getMonth();
    const day18 = birthDateObj.getDate();

    let date18 = new Date(year18, month18, day18);
    if (date18.getMonth() !== month18) {
        date18 = new Date(year18, month18, 28);
    }

    date18.setHours(0, 0, 0, 0);
    const todayMidnight = new Date(nowObj.getFullYear(), nowObj.getMonth(), nowObj.getDate());

    const monthNames = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    const date18Str = `${date18.getDate()} ${monthNames[date18.getMonth()]} ${date18.getFullYear()}`;

    if (todayMidnight >= date18) {
        return {
            is18OrOlder: true,
            date18Str: date18Str
        };
    } else {
        const rem = hayyizCalculateExactAge(todayMidnight, date18);
        return {
            is18OrOlder: false,
            years: rem.years,
            months: rem.months,
            days: rem.days,
            date18Str: date18Str
        };
    }
}

/**
 * جلب جميع الأحداث من الذاكرة المحلية (القادمة والسابقة) مع خيارات الفرز والتصنيف
 */
function hayyizGetAllCalendarEvents() {
    const events = [];
    const STORAGE_KEY_EXAMS = 'hayyiz-student-exams';
    const STORAGE_KEY_EVENTS = 'hayyiz-custom-events';

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
                        notes: item.notes || '',
                        subjectId: item.subjectId || null,
                        priority: item.priority || 'medium',
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
                        notes: item.notes || '',
                        subjectId: item.subjectId || null,
                        priority: item.priority || 'medium',
                        _storageKey: STORAGE_KEY_EVENTS
                    });
                }
            });
        }
    } catch (e) { /* تجاهل */ }

    return events;
}

/**
 * جلب جميع الأحداث القادمة المرتبة بحسب الأقرب زمنيًا (مستبعدًا الأحداث المنتهية)
 */
function hayyizGetSavedCalendarEvents() {
    const events = hayyizGetAllCalendarEvents();
    const now = new Date();
    const todayStr = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);

    function isEventPassed(ev) {
        if (!ev.date) return true;
        if (ev.time) {
            const target = new Date(`${ev.date}T${ev.time}:00`);
            if (isNaN(target.getTime())) return true;
            return target.getTime() < now.getTime();
        } else {
            return ev.date < todayStr;
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

    const upcomingEvents = events.filter(ev => !isEventPassed(ev));
    upcomingEvents.sort((a, b) => getEventTimestamp(a) - getEventTimestamp(b));

    return upcomingEvents;
}

/**
 * تحويل حدث تقويم إلى مهمة دراسية في hayyiz-todos
 */
function hayyizConvertEventToTodo(eventObj) {
    if (!eventObj || !eventObj.name || !eventObj.date) return null;
    const todos = hayyizGetTodos();

    const todoText = (eventObj.type === 'exam' ? 'مراجعة: ' : 'متابعة: ') + eventObj.name;

    // منع التكرار إذا كانت المهمة موجودة بنفس الاسم والتاريخ
    const exists = todos.find(t => t && t.text === todoText && t.date && String(t.date).slice(0, 10) === eventObj.date);
    if (exists) return exists;

    let datetimeStr = eventObj.date;
    if (eventObj.time) {
        datetimeStr += `T${eventObj.time}`;
    }

    const newTodo = {
        id: hayyizGenerateId(),
        text: todoText,
        priority: eventObj.type === 'exam' ? 'high' : 'medium',
        date: datetimeStr,
        minutes: eventObj.type === 'exam' ? 45 : 30,
        completed: false,
        created: Date.now(),
        eventId: eventObj.id || null
    };

    todos.push(newTodo);
    hayyizSaveTodos(todos);
    return newTodo;
}

/**
 * ملخص تقويم الطالب جاهز للـ Dashboard والصفحات
 */
function hayyizGetCalendarSummary() {
    const upcoming = hayyizGetSavedCalendarEvents();
    const nearestEvent = upcoming.length > 0 ? upcoming[0] : null;

    const todayStr = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);

    // حساب الأحداث هذا الأسبوع (خلال الأيام الـ 7 القادمة)
    const t0 = new Date(`${todayStr}T00:00:00`).getTime();
    const tWeekEnd = t0 + (7 * 24 * 60 * 60 * 1000);

    const thisWeekEvents = upcoming.filter(ev => {
        const tEv = new Date(`${ev.date}T00:00:00`).getTime();
        return tEv >= t0 && tEv <= tWeekEnd;
    });

    const birthdate = localStorage.getItem('hayyiz-birthdate') || null;
    const showAgePref = localStorage.getItem('hayyiz-show-age-in-dashboard');

    let ageInfo = null;
    if (birthdate) {
        const birthObj = new Date(birthdate + 'T00:00:00');
        const nowObj = new Date();
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);

        if (!isNaN(birthObj.getTime()) && birthObj <= todayMidnight) {
            const age = hayyizCalculateExactAge(birthObj, todayMidnight);
            const status18 = hayyizGet18Status(birthObj, nowObj);
            ageInfo = {
                birthdate,
                years: age.years,
                months: age.months,
                days: age.days,
                is18OrOlder: status18.is18OrOlder,
                status18
            };
        }
    }

    return {
        upcoming,
        nearestEvent,
        thisWeekCount: thisWeekEvents.length,
        thisWeekEvents,
        totalUpcomingCount: upcoming.length,
        birthdate,
        showAgePref,
        ageInfo
    };
}
