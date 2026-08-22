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

/** مفاتيح بيانات المستخدم التي تُصدَّر */
var HAYYIZ_BACKUP_KEYS = [
    'hayyiz-todos',
    'hayyiz-notes',
    'hayyiz-habits',
    'hayyiz-sessions',
    'hayyiz-sessions-today',
    'hayyiz-focus-minutes-today',
    'hayyiz-sessions-day',
    'hayyiz-focus-history',
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
    'hayyiz-custom-events'
];

function exportHayyizData() {
    const data = {
        version: 2,
        exportedAt: new Date().toISOString(),
        app: 'حيز',
        keys: {}
    };
    HAYYIZ_BACKUP_KEYS.forEach((key) => {
        const val = localStorage.getItem(key);
        if (val !== null) data.keys[key] = val;
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
            const allowed = new Set(HAYYIZ_BACKUP_KEYS);
            const toImport = {};
            let count = 0;
            Object.keys(data.keys).forEach((key) => {
                if (allowed.has(key) && typeof data.keys[key] === 'string') {
                    toImport[key] = data.keys[key];
                    count++;
                }
            });
            if (count === 0) {
                alert('لم يُعثر على بيانات صالحة في الملف.');
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

/** قراءة/حفظ المهام مع ضمان المعرفات */
function hayyizGetTodos() {
    hayyizEnsureDataShape();
    return hayyizParseJSON('hayyiz-todos', []);
}

function hayyizSaveTodos(todos) {
    if (!Array.isArray(todos)) return;
    todos.forEach((t) => {
        if (t && !t.id) t.id = hayyizGenerateId();
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
    const subject = {
        id: hayyizGenerateId(),
        name: trimmed,
        created: Date.now(),
        focusMinutes: 0,
        sessions: 0
    };
    list.push(subject);
    hayyizSaveSubjects(list);
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
    list[idx].focusMinutes = (parseInt(list[idx].focusMinutes, 10) || 0) + minutes;
    list[idx].sessions = (parseInt(list[idx].sessions, 10) || 0) + 1;
    list[idx].lastFocused = getTodayLocal();
    hayyizSaveSubjects(list);

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

/* ---------- إطلاق جلسة تركيز موحّد ---------- */

/**
 * يجهّز التخزين وينتقل إلى صفحة البومودورو مرتبطاً بالمهمة.
 * يستخدم id إن وُجد حتى لا ينكسر الربط عند إعادة ترتيب القائمة.
 */
function hayyizLaunchPomodoro(task, indexHint) {
    if (!task || !task.text) {
        localStorage.removeItem('hayyiz-current-task');
        localStorage.removeItem('hayyiz-current-task-index');
        localStorage.removeItem('hayyiz-current-task-id');
        localStorage.removeItem('hayyiz-task-session');
        window.location.href = 'pomodoro.html';
        return;
    }

    const todos = hayyizGetTodos();
    let index = typeof indexHint === 'number' ? indexHint : -1;
    if (index < 0 || !todos[index] || (task.id && todos[index].id !== task.id)) {
        index = hayyizFindTodoIndex(todos, task);
    }
    if (index < 0 && task.id) {
        index = todos.findIndex((t) => t && t.id === task.id);
    }

    const workMin = parseInt(localStorage.getItem('hayyiz-pref-work') || '25', 10) || 25;
    const totalMinutes = task.minutes ? parseInt(task.minutes, 10) : null;
    const plan = {
        text: task.text,
        id: task.id || null,
        index: index,
        subjectId: task.subjectId || null,
        totalMinutes: totalMinutes && totalMinutes > 0 ? totalMinutes : null,
        focusDone: task.focusDone ? parseInt(task.focusDone, 10) || 0 : 0,
        sessionsDone: task.sessionsDone ? parseInt(task.sessionsDone, 10) || 0 : 0,
        sessionsNeeded:
            totalMinutes && totalMinutes > 0
                ? Math.ceil(totalMinutes / workMin)
                : null
    };

    localStorage.setItem('hayyiz-current-task', task.text);
    if (task.id) localStorage.setItem('hayyiz-current-task-id', task.id);
    else localStorage.removeItem('hayyiz-current-task-id');
    localStorage.setItem('hayyiz-current-task-index', String(index >= 0 ? index : -1));
    localStorage.setItem('hayyiz-task-session', JSON.stringify(plan));
    window.location.href = 'pomodoro.html?task=' + encodeURIComponent(task.text);
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
        const focusDone = (parseInt(todos[idx].focusDone, 10) || 0) + workMin;
        const sessionsDone = (parseInt(todos[idx].sessionsDone, 10) || 0) + 1;
        todos[idx].focusDone = focusDone;
        todos[idx].sessionsDone = sessionsDone;
        todos[idx].lastFocused = getTodayLocal();
        hayyizSaveTodos(todos);

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

    todos[idx].completed = true;
    todos[idx].completedAt = getTodayLocal();
    hayyizSaveTodos(todos);
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
}

function hayyizGetAcademicGoal() {
    return hayyizParseJSON('hayyiz-academic-goal', null);
}

function hayyizSaveAcademicGoal(goal) {
    if (!goal) {
        localStorage.removeItem('hayyiz-academic-goal');
        return;
    }
    hayyizSaveJSON('hayyiz-academic-goal', goal);
}

function hayyizGetSubjectGoals() {
    return hayyizParseJSON('hayyiz-subject-goals', []);
}

function hayyizSaveSubjectGoals(list) {
    hayyizSaveJSON('hayyiz-subject-goals', Array.isArray(list) ? list : []);
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
        localStorage.removeItem('hayyiz-daily-goal');
        return;
    }
    if (!goal.date) goal.date = getTodayLocal();
    hayyizSaveJSON('hayyiz-daily-goal', goal);
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
 * جلب جميع الأحداث القادمة المرتبة بحسب الأقرب زمنيًا (مستبعدًا الأحداث المنتهية)
 */
function hayyizGetSavedCalendarEvents() {
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
                        type: item.type || 'exam'
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
                        type: item.type || 'personal'
                    });
                }
            });
        }
    } catch (e) { /* تجاهل */ }

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
 * ملخص تقويم الطالب جاهز للـ Dashboard والصفحات
 */
function hayyizGetCalendarSummary() {
    const upcoming = hayyizGetSavedCalendarEvents();
    const nearestEvent = upcoming.length > 0 ? upcoming[0] : null;

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
        birthdate,
        showAgePref,
        ageInfo
    };
}
