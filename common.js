var hayyizStorage = (typeof window !== 'undefined' && window.hayyizStorage) || (typeof localStorage !== 'undefined' ? localStorage : undefined);
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
    const savedTheme = hayyizStorage.getItem('hayyiz-theme') || 'light';
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
            hayyizStorage.setItem('hayyiz-theme', nextIsDark ? 'dark' : 'light');
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

    // قائمة الجوال والـ Dropdown Interactions
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = navLinks.classList.toggle('open');
            menuToggle.setAttribute('aria-expanded', String(isOpen));
        });

        // إغلاق القائمة والـ Dropdowns عند اختيار أي رابط
        navLinks.addEventListener('click', (e) => {
            if (e.target.closest('a')) {
                navLinks.classList.remove('open');
                menuToggle.setAttribute('aria-expanded', 'false');
                document.querySelectorAll('.nav-dropdown.open').forEach(d => {
                    d.classList.remove('open');
                    const t = d.querySelector('.nav-dropdown-toggle');
                    if (t) t.setAttribute('aria-expanded', 'false');
                });
            }
        });

        // إغلاق القائمة والـ Dropdowns عند النقر خارج الـ navbar
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.nav-container')) {
                navLinks.classList.remove('open');
                menuToggle.setAttribute('aria-expanded', 'false');
                document.querySelectorAll('.nav-dropdown.open').forEach(d => {
                    d.classList.remove('open');
                    const t = d.querySelector('.nav-dropdown-toggle');
                    if (t) t.setAttribute('aria-expanded', 'false');
                });
            }
        });

        // إغلاق القائمة والـ Dropdowns عند الضغط على Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (navLinks.classList.contains('open')) {
                    navLinks.classList.remove('open');
                    menuToggle.setAttribute('aria-expanded', 'false');
                    menuToggle.focus();
                }
                document.querySelectorAll('.nav-dropdown.open').forEach(d => {
                    d.classList.remove('open');
                    const t = d.querySelector('.nav-dropdown-toggle');
                    if (t) {
                        t.setAttribute('aria-expanded', 'false');
                        t.focus();
                    }
                });
            }
        });
    }

    // Dropdown Accessibility & Keyboard Navigation
    const dropdownToggles = document.querySelectorAll('.nav-dropdown-toggle');
    dropdownToggles.forEach(toggle => {
        const parentDropdown = toggle.closest('.nav-dropdown');
        if (!parentDropdown) return;

        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = parentDropdown.classList.contains('open');
            document.querySelectorAll('.nav-dropdown.open').forEach(d => {
                if (d !== parentDropdown) d.classList.remove('open');
            });
            parentDropdown.classList.toggle('open', !isOpen);
            toggle.setAttribute('aria-expanded', String(!isOpen));
        });

        toggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle.click();
            } else if (e.key === 'Escape') {
                parentDropdown.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
                toggle.focus();
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-dropdown')) {
            document.querySelectorAll('.nav-dropdown.open').forEach(d => {
                d.classList.remove('open');
                const t = d.querySelector('.nav-dropdown-toggle');
                if (t) t.setAttribute('aria-expanded', 'false');
            });
        }
    });
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
    'hayyiz-focus-history-state',
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
    'hayyiz-multi-day-plans',
    'hayyiz-planning-preferences',
    'hayyiz-day-reviews',
    'hayyiz-planner-draft',
    'hayyiz-pref-daily-capacity',
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
        'hayyiz-focus-history-state',
        'hayyiz-task-session',
        'hayyiz-current-event',
        'hayyiz-pomodoro-state',
        'hayyiz-subject-progress',
        'hayyiz-gpa-snapshot',
        'hayyiz-academic-goal',
        'hayyiz-daily-goal',
        'hayyiz-multi-day-plans',
        'hayyiz-planning-preferences',
        'hayyiz-day-reviews',
        'hayyiz-planner-draft',
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
        'hayyiz-pref-daily-capacity',
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

async function exportHayyizData() {
    try {
    let data = {
        version: 2,
        exportedAt: new Date().toISOString(),
        app: 'حيز',
        keys: {}
    };
    HAYYIZ_ALLOWED_BACKUP_KEYS.forEach((key) => {
        const val = hayyizStorage.getItem(key);
        if (val !== null) {
            const sanitized = hayyizSanitizeValue(key, val);
            if (sanitized !== null) {
                data.keys[key] = sanitized;
            }
        }
    });
    if (typeof window.hayyizCreateBackup === 'function') data = await window.hayyizCreateBackup();
    if (data.missingPdfIds && data.missingPdfIds.length && !confirm('توجد ' + data.missingPdfIds.length + ' ملفات PDF غير متاحة على هذا الجهاز. ستُحفظ الرسومات دون هذه الملفات. هل تريد تنزيل النسخة؟')) return;
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
    } catch (error) { alert(error.message || 'تعذر إنشاء النسخة الاحتياطية.'); }
}

// A restore is a new user edit. Stage its sync metadata with the restored values
// so a later cloud read cannot immediately put an older snapshot back.
function hayyizPrepareRestoredKeys(input) {
    const keys = Object.assign(Object.create(null), input);
    let now = Date.now();
    const read = raw => { try { return JSON.parse(raw); } catch (_) { return null; } };
    function clock(value, depth) {
        if (!value || typeof value !== 'object' || depth > 40) return;
        Object.entries(value).forEach(([field, child]) => {
            if (['updated', 'updatedAt', 'lastUpdated', 'created', 'timestamp'].includes(field)) {
                const time = Number(child) || (typeof child === 'string' ? Date.parse(child) : 0);
                if (Number.isFinite(time) && time > 0 && time < 8640000000000000) now = Math.max(now, time + 1);
            }
            if (child && typeof child === 'object') clock(child, depth + 1);
        });
    }
    Object.keys(keys).forEach(key => { clock(read(keys[key]), 0); clock(read(hayyizStorage.getItem(key)), 0); });
    const registry = Object.assign(Object.create(null), hayyizParseJSON('hayyiz-deleted-items', {}), read(keys['hayyiz-deleted-items']) || {});
    const collections = ['todos', 'notes', 'habits', 'student-exams', 'custom-events', 'subjects', 'subject-goals', 'focus-log'];
    collections.forEach(tool => {
        const key = tool === 'focus-log' ? 'hayyiz-focus-sessions-log' : 'hayyiz-' + tool;
        if (!Object.prototype.hasOwnProperty.call(keys, key)) return;
        const rows = read(keys[key]);
        if (!Array.isArray(rows)) return;
        const ids = new Set();
        rows.forEach(row => {
            if (!row.id) row.id = tool === 'subject-goals' && row.name ? row.name : hayyizGenerateId();
            ids.add(String(row.id));
            row.updated = now;
            delete registry[tool + ':' + row.id];
        });
        const previous = hayyizParseJSON(key, []);
        if (Array.isArray(previous)) previous.forEach(row => {
            const id = row && (row.id || (tool === 'subject-goals' ? row.name : null));
            if (id && !ids.has(String(id))) registry[tool + ':' + id] = { timestamp: now, data: row };
        });
        keys[key] = JSON.stringify(rows);
        keys['hayyiz-sync-last-time-' + tool] = '';
    });
    const singles = { 'gpa-snapshot': 'updatedAt', 'academic-goal': 'updatedAt', 'daily-goal': 'updated', 'planning-preferences': 'updatedAt' };
    Object.entries(singles).forEach(([tool, field]) => {
        const key = 'hayyiz-' + tool;
        if (!Object.prototype.hasOwnProperty.call(keys, key)) return;
        const value = read(keys[key]);
        if (value && typeof value === 'object') { value[field] = now; keys[key] = JSON.stringify(value); }
        keys['hayyiz-sync-last-time-' + tool] = '';
    });
    ['multi-day-plans', 'day-reviews'].forEach(tool => {
        const key = 'hayyiz-' + tool;
        if (!Object.prototype.hasOwnProperty.call(keys, key)) return;
        const value = read(keys[key]);
        if (value && typeof value === 'object') {
            Object.values(value).forEach(row => { if (row && typeof row === 'object') row.updatedAt = now; });
            keys[key] = JSON.stringify(value);
        }
        keys['hayyiz-sync-last-time-' + tool] = '';
    });
    if (keys['hayyiz-birthdate'] !== undefined) {
        keys['hayyiz-birthdate-updated'] = String(now);
        keys['hayyiz-sync-last-time-birthdate'] = '';
    }
    if (['work', 'break', 'long'].some(mode => keys['hayyiz-pref-' + mode] !== undefined)) {
        keys['hayyiz-pomodoro-prefs-updated'] = String(now);
        keys['hayyiz-sync-last-time-pomodoro-prefs'] = '';
    }
    if (keys['hayyiz-focus-history'] !== undefined) {
        keys['hayyiz-focus-writer-id'] = hayyizGenerateId();
        keys['hayyiz-focus-history-updated'] = String(now);
        keys['hayyiz-sync-last-time-focus-history'] = '';
        // A v2 backup must not inherit unrelated v3 counter metadata already on
        // the device. Its flat history becomes the backward-compatible baseline.
        if (keys['hayyiz-focus-history-state'] === undefined) keys['hayyiz-focus-history-state'] = 'null';
    }
    const singleIds = { 'gpa-snapshot': 'snapshot', 'academic-goal': 'goal', 'daily-goal': 'goal',
        'planning-preferences': 'preferences', 'multi-day-plans': 'plans', 'day-reviews': 'reviews',
        birthdate: 'birthdate', 'focus-history': 'history' };
    Object.entries(singleIds).forEach(([tool, id]) => {
        if (keys['hayyiz-' + tool] !== undefined) delete registry[tool + ':' + id];
    });
    if (['work', 'break', 'long'].some(mode => keys['hayyiz-pref-' + mode] !== undefined)) delete registry['pomodoro-prefs:prefs'];
    keys['hayyiz-deleted-items'] = JSON.stringify(registry);
    return keys;
}

function importHayyizData(file) {
    if (!file) return;
    if (window.hayyizBackupLimits && file.size > window.hayyizBackupLimits.maxFileBytes) {
        alert('حجم النسخة الاحتياطية أكبر من الحد المسموح (192 ميغابايت).');
        return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
        try {
            const data = JSON.parse(reader.result);
            if (!data || typeof data !== 'object' || !data.keys || typeof data.keys !== 'object') {
                alert('الملف غير صالح. تأكد أنه نسخة احتياطية من حيز.');
                return;
            }
            if (typeof window.hayyizRestoreBackup === 'function') {
                const validated = window.hayyizValidateBackup(data);
                if (!Object.keys(validated.keys).length) throw new Error('لم يُعثر على بيانات صالحة في النسخة.');
                const warning = validated.missingPdfIds.length ? '\nتنبيه: ' + validated.missingPdfIds.length + ' ملفات PDF غير مضمّنة؛ ستُستعاد رسوماتها دون خلفية PDF.' : '';
                if (!confirm('سيتم استبدال البيانات الموجودة في النسخة داخل الحساب الحالي. يُفضّل تصدير نسخة حالية أولًا.' + warning + '\nهل تريد المتابعة؟')) return;
                await window.hayyizRestoreBackup(data);
                if (typeof hayyizEnsureDataShape === 'function') hayyizEnsureDataShape();
                if (typeof window.hayyizRefreshFocusStats === 'function') window.hayyizRefreshFocusStats();
                alert('تم استيراد البيانات بنجاح.' + warning);
                window.location.reload();
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
                hayyizStorage.setItem(key, toImport[key]);
            });
            if (typeof hayyizEnsureDataShape === 'function') {
                hayyizEnsureDataShape();
            }
            alert('تم استيراد البيانات بنجاح. سيتم تحديث الصفحة.');
            window.location.reload();
        } catch (e) {
            alert(e.message || 'تعذر قراءة الملف. تأكد أنه JSON صالح من حيز.');
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
        const raw = hayyizStorage.getItem(key);
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
    } catch (e) {
        return fallback;
    }
}

function hayyizSaveJSON(key, value) {
    hayyizStorage.setItem(key, JSON.stringify(value));
}


function hayyizGetHabits() {
    const habits = hayyizParseJSON('hayyiz-habits', []);
    return Array.isArray(habits) ? habits : [];
}

function hayyizGetHabitTodaySummary(list) {
    const habits = Array.isArray(list) ? list : hayyizGetHabits();
    const today = typeof getTodayLocal === 'function'
        ? getTodayLocal()
        : (() => {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        })();
    const total = habits.length;
    const completed = habits.filter((h) => h && h.lastCompleted === today).length;
    const remaining = Math.max(0, total - completed);
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, remaining, percent, today };
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
    if (hayyizStorage.getItem('hayyiz-subjects') === null) {
        hayyizSaveJSON('hayyiz-subjects', []);
    }
    if (hayyizStorage.getItem('hayyiz-exams') === null) {
        hayyizSaveJSON('hayyiz-exams', []);
    }
    if (hayyizStorage.getItem('hayyiz-goals') === null) {
        hayyizSaveJSON('hayyiz-goals', []);
    }
    if (hayyizStorage.getItem('hayyiz-subject-progress') === null) {
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
    const previous = hayyizParseJSON('hayyiz-todos', []);
    const completedTransition = Array.isArray(previous) && todos.some(task => task?.completed && previous.some(old => old?.id === task.id && !old.completed));
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
    if (completedTransition) hayyizTrackPlanningEvent('task_completed');
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

    const workspaceTaskId = todos[idx].workspaceTaskId || todos[idx].workspace_task_id;
    if (workspaceTaskId && (patch.completed !== undefined || patch.status !== undefined)) {
        return hayyizUpdateWorkspaceCompletion(id, workspaceTaskId, patch);
    }
    return hayyizPersistTaskUpdate(id, patch);
}

async function hayyizUpdateWorkspaceCompletion(id, workspaceTaskId, patch) {
    if (typeof ensureSupabaseLoaded !== 'function') throw new Error('تحتاج المهمة المتزامنة إلى اتصال بحسابك.');
    const client = await ensureSupabaseLoaded();
    const scope = hayyizStorage.scope;
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth || !auth.user || (hayyizStorage.isCurrentUser && !hayyizStorage.isCurrentUser(auth.user.id))) {
        throw new Error('يرجى تسجيل الدخول إلى حساب المهمة والمحاولة مرة أخرى.');
    }
    const completed = patch.completed !== undefined ? Boolean(patch.completed) : patch.status === 'completed';
    const { data, error } = await client.rpc('set_task_progress_and_recalculate', { p_task_id: workspaceTaskId, p_completed: completed });
    if (error || !data || data.success !== true) throw new Error(error?.message || data?.message || 'تعذر حفظ إنجاز المهمة في المساحة.');
    if (hayyizStorage.isCurrentScope && !hayyizStorage.isCurrentScope(scope)) throw new Error('تغير الحساب؛ أعد فتح المهمة.');
    return hayyizPersistTaskUpdate(id, Object.assign({}, patch, { completed, updated: Date.now() }));
}

function hayyizPersistTaskUpdate(id, patch) {
    const todos = hayyizGetTodos();
    const idx = todos.findIndex(task => task && task.id === id);
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
    if (typeof hayyizUploadItem === 'function') hayyizUploadItem('todos', id, todos[idx]);
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
/**
 * تنسيق تقدم المهمة بصورة آمنة ومفهومة للاستخدام في العرض واختبارات التكامل
 */
function hayyizFormatTaskProgress(task) {
    if (!task) return null;
    const done = parseInt(task.focusDone, 10) || 0;
    const total = parseInt(task.minutes, 10) || 0;
    if (done <= 0) {
        return {
            hasProgress: false,
            done: 0,
            total: total > 0 ? total : 0,
            percent: null,
            progressText: '',
            progressMeta: total > 0 ? `${total} دقيقة` : ''
        };
    }

    const hasValidTotal = total > 0 && Number.isFinite(total);
    const percent = hasValidTotal ? Math.round((done / total) * 100) : null;
    const progressText = hasValidTotal
        ? `أُنجز ${done} من ${total} دقيقة (${percent}%)`
        : `أُنجز ${done} دقيقة تركيز`;

    return {
        hasProgress: true,
        done,
        total: hasValidTotal ? total : 0,
        percent: hasValidTotal ? percent : null,
        progressText,
        progressMeta: progressText
    };
}

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
function hayyizBumpSubjectProgress(subjectId, minutes, date) {
    if (!subjectId || !minutes || minutes <= 0) return;
    const list = hayyizGetSubjects();
    const idx = list.findIndex((s) => s.id === subjectId);
    if (idx < 0) return;
    const nowMs = Date.now();
    list[idx].focusMinutes = (parseInt(list[idx].focusMinutes, 10) || 0) + minutes;
    list[idx].sessions = (parseInt(list[idx].sessions, 10) || 0) + 1;
    list[idx].lastFocused = date || getTodayLocal();
    list[idx].updated = nowMs;
    hayyizSaveSubjects(list);

    if (typeof hayyizUploadItem === 'function') {
        hayyizAfterFocusCommit(() => hayyizUploadItem('subjects', list[idx].id, list[idx]));
    }

    const progress = hayyizParseJSON('hayyiz-subject-progress', {});
    const day = date || getTodayLocal();
    if (!progress[subjectId]) progress[subjectId] = {};
    progress[subjectId][day] = (parseInt(progress[subjectId][day], 10) || 0) + minutes;
    hayyizSaveJSON('hayyiz-subject-progress', progress);
}

/* ---------- الاختبارات والأهداف (خفيف) ---------- */

function hayyizGetExams() {
    hayyizEnsureDataShape();
    const list1 = hayyizParseJSON('hayyiz-student-exams', []);
    const list2 = hayyizParseJSON('hayyiz-exams', []);
    const merged = [];
    const seen = new Set();

    [...list1, ...list2].forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const key = item.id ? String(item.id) : `${item.name || ''}_${item.date || ''}`;
        if (key && !seen.has(key)) {
            seen.add(key);
            merged.push(item);
        }
    });

    return merged;
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
    const workMin = ctx.workMin || parseInt(hayyizStorage.getItem("hayyiz-pref-work") || "25", 10) || 25;

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

    // الخطة متعددة الأيام — إذا كانت المهمة مجدولة لليوم في خطة متعددة الأيام نشطة
    try {
        const multiDayPlans = hayyizGetMultiDayPlans();
        const todayStr = ctx.today || getTodayLocal();
        Object.keys(multiDayPlans).forEach((pid) => {
            const p = multiDayPlans[pid];
            if (p && Array.isArray(p.schedule)) {
                const todayItem = p.schedule.find((s) => s.date === todayStr);
                if (todayItem && Array.isArray(todayItem.tasks)) {
                    if (todayItem.tasks.some((st) => st.taskId === task.id)) {
                        score += 25;
                        if (!isInProgress && reasons.length < 2) {
                            reasons.push("مجدولة لليوم في خطتك متعددة الأيام");
                        }
                    }
                }
            }
        });
    } catch (e) {}

    if (reasons.length === 0) {
        if (task.priority === "high") reasons.push("هي أعلى مهمة أولوية حالياً");
        else reasons.push("أعلى مهمة أولوية حالياً");
    }

    return { score, reasons: reasons.slice(0, 2), task, isInProgress };
}

/* ---------- محرك التوصية والقرار المركزي — Student OS Pipeline ---------- */

/**
 * 1. جمع البيانات مرة واحدة فقط (Data Snapshot Builder)
 */
function hayyizBuildStudentSnapshot() {
    const focusState = hayyizGetFocusState();
    const today = getTodayLocal();
    const workMin = parseInt(hayyizStorage.getItem('hayyiz-pref-work') || '25', 10) || 25;
    const focusMinutesToday = parseInt(hayyizStorage.getItem('hayyiz-focus-minutes-today') || '0', 10);

    const todos = hayyizGetTodos();
    const activeTodos = todos.filter((t) => t && !t.completed);
    const overdueTodos = activeTodos.filter((t) => t.date && String(t.date).slice(0, 10) < today);
    const dueTodayTodos = activeTodos.filter((t) => t.date && String(t.date).slice(0, 10) === today);

    const habits = hayyizGetHabits();
    const habitsSummary = hayyizGetHabitTodaySummary(habits);

    const exams = hayyizGetExams();
    const subjects = hayyizGetSubjects();
    const subjectGoals = hayyizGetSubjectGoals();

    return {
        today,
        workMin,
        focusMinutesToday,
        todos,
        activeTodos,
        overdueTodos,
        dueTodayTodos,
        habits,
        habitsSummary,
        exams,
        subjects,
        subjectGoals,
        focusState
    };
}

/**
 * 2. ترتيب المهام بناءً على الـ Snapshot (Task Ranking Engine)
 */
function hayyizRankTasks(snapshot) {
    const snap = snapshot || hayyizBuildStudentSnapshot();
    const ctx = {
        today: snap.today,
        exams: snap.exams,
        subjects: snap.subjects,
        subjectGoals: snap.subjectGoals,
        workMin: snap.workMin
    };

    const rankedTasks = snap.activeTodos
        .map((t) => hayyizScoreTask(t, ctx))
        .filter((r) => r.score > -Infinity)
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return (b.task.created || 0) - (a.task.created || 0);
        });

    const topRankedTask = rankedTasks[0] || null;
    const nextTask = topRankedTask ? topRankedTask.task : (snap.activeTodos[0] || null);
    const nextReason = topRankedTask ? topRankedTask.reasons.join(' · ') : '';
    const isInProgress = topRankedTask ? Boolean(topRankedTask.isInProgress) : (nextTask && (parseInt(nextTask.focusDone, 10) || 0) > 0);

    return {
        rankedTasks,
        topRankedTask,
        nextTask,
        nextReason,
        isInProgress
    };
}

/**
 * 3. تقييم حالات واختيار القرار الرئيسي بناءً على الـ Snapshot والمهام المرتبة (Decision Evaluation Engine)
 */
function hayyizEvaluateDecisions(snapshot, rankedTasks) {
    const snap = snapshot || hayyizBuildStudentSnapshot();
    const ranked = rankedTasks || hayyizRankTasks(snap).rankedTasks;
    const topRankedTask = ranked[0] || null;
    const nextTask = topRankedTask ? topRankedTask.task : (snap.activeTodos[0] || null);
    const nextReason = topRankedTask ? topRankedTask.reasons.join(' · ') : '';
    const isInProgress = topRankedTask ? Boolean(topRankedTask.isInProgress) : (nextTask && (parseInt(nextTask.focusDone, 10) || 0) > 0);

    const candidates = [];

    // أ) جلسة تركيز جارية
    if (snap.focusState && snap.focusState.status === 'running' && snap.focusState.remainingSeconds > 0) {
        const ctxTitle = snap.focusState.context ? snap.focusState.context.title : 'جلسة تركيز';
        candidates.push({
            score: 1000, id: 'running-focus', type: 'pomodoro', badge: 'جلسة جارية',
            title: 'اقتراح حيز',
            actionTitle: ctxTitle,
            reason: 'جلسة تركيز جارية الآن للحفاظ على استمراريتك',
            text: `لديك جلسة تركيز جارية الآن ("${ctxTitle}"). واصل تركيزك للحفاظ على استمراريتك.`,
            actionLabel: 'متابعة الجلسة', actionType: 'url', url: 'pomodoro.html'
        });
    }

    // ب) اختبار قريب
    const upcomingExams = snap.exams.filter((e) => e && !e.done && e.date);
    let nearestExam = null, minDays = Infinity;
    upcomingExams.forEach((e) => {
        const d = hayyizDaysUntil(String(e.date).slice(0, 10));
        if (d !== null && d >= 0 && d <= 7 && d < minDays) {
            minDays = d;
            nearestExam = e;
        }
    });

    if (nearestExam && snap.focusMinutesToday < snap.workMin) {
        const daysText = minDays === 0 ? 'اليوم' : (minDays === 1 ? 'غداً' : `بعد ${minDays} أيام`);

        const relatedTask = snap.activeTodos.find((t) => {
            if (!t) return false;
            if (nearestExam.subjectId && t.subjectId === nearestExam.subjectId) return true;
            if (t.eventId && t.eventId === nearestExam.id) return true;
            if (nearestExam.name && t.text && t.text.includes(nearestExam.name)) return true;
            return false;
        });

        const actTitle = relatedTask ? relatedTask.text : nearestExam.name;
        const reasonMsg = relatedTask
            ? `مرتبطة باختبار قريب (${nearestExam.name}) ${daysText}`
            : `لديك اختبار قريب (${nearestExam.name}) ${daysText}`;
        const textMsg = `لديك اختبار قريب (${nearestExam.name}) ${daysText}، ولم تبدأ جلسة دراسة كافية اليوم.` +
            (relatedTask ? ` ابدأ جلسة ${snap.workMin} دقيقة لمهمتك المرتبطة ("${relatedTask.text}").` : ` ابدأ جلسة تركيز مدتها ${snap.workMin} دقيقة للمراجعة.`);
        candidates.push({
            score: 150 + (7 - minDays) * 15, id: 'exam-upcoming', type: 'exam', badge: 'اختبار قريب',
            title: 'اقتراح حيز',
            actionTitle: actTitle,
            reason: reasonMsg,
            text: textMsg,
            actionLabel: relatedTask ? 'ابدأ جلسة للمهمة' : 'ابدأ جلسة تركيز',
            actionType: relatedTask ? 'pomo-task' : 'pomo-event',
            task: relatedTask || null,
            event: relatedTask ? null : nearestExam,
            url: 'pomodoro.html'
        });
    }

    // ج) مهام متأخرة
    if (snap.overdueTodos.length > 0) {
        const topOverdue = snap.overdueTodos[0];
        const daysOverdue = Math.abs(hayyizDaysUntil(String(topOverdue.date).slice(0, 10)) || 1);
        candidates.push({
            score: 130 + Math.min(daysOverdue * 10, 50) + (topOverdue.priority === 'high' ? 30 : 10),
            id: 'task-overdue', type: 'todo', badge: 'مهام متأخرة', title: 'اقتراح حيز',
            actionTitle: topOverdue.text,
            reason: `مهمة متأخرة عن موعد استحقاقها (${snap.overdueTodos.length} مهام متأخرة)`,
            text: `لديك ${snap.overdueTodos.length} مهام متأخرة عن موعدها. يفضل البدء بمهمة "${topOverdue.text}" لإنجازها أولاً وتجنب تراكم المهام.`,
            actionLabel: 'ابدأ التركيز عليها', actionType: 'pomo-task', task: topOverdue, url: 'pomodoro.html'
        });
    }

    // د) مهمة قيد التنفيذ أو عالية الأولوية
    if (nextTask) {
        if (isInProgress) {
            candidates.push({
                score: 140, id: 'task-in-progress', type: 'todo', badge: 'قيد التنفيذ', title: 'اقتراح حيز',
                actionTitle: nextTask.text,
                reason: 'أكمل ما بدأت به في الجلسة السابقة',
                text: `بدأت العمل على مهمة "${nextTask.text}". أكمل جلسة التركيز القادمة لإتمامها.`,
                actionLabel: 'استكمال التركيز', actionType: 'pomo-task', task: nextTask, url: 'pomodoro.html'
            });
        } else if (nextTask.priority === 'high') {
            candidates.push({
                score: 95, id: 'high-priority-task', type: 'todo', badge: 'أولوية عالية', title: 'اقتراح حيز',
                actionTitle: nextTask.text,
                reason: nextReason ? nextReason : 'أعلى مهمة أولوية حالياً',
                text: `لديك مهمة عالية الأولوية "${nextTask.text}". ابدأ بها الآن لتحقيق أقصى تقدم في خطتك الدراسية.`,
                actionLabel: 'ابدأ جلسة تركيز', actionType: 'pomo-task', task: nextTask, url: 'pomodoro.html'
            });
        }
    }

    // هـ) عادات غير مكتملة
    if (snap.habitsSummary.remaining > 0) {
        const uncompletedHabit = snap.habits.find((h) => h && h.lastCompleted !== snap.today);
        const habitName = uncompletedHabit ? (uncompletedHabit.name || uncompletedHabit.title) : 'عاداتك اليومية';
        candidates.push({
            score: 65 + Math.min(snap.habitsSummary.remaining * 10, 25), id: 'habit-due', type: 'habit', badge: 'عادات اليوم',
            title: 'اقتراح حيز',
            actionTitle: habitName,
            reason: `متبقي ${snap.habitsSummary.remaining} عادات لم تنجزها اليوم`,
            text: `متبقي لديك ${snap.habitsSummary.remaining} عادات لم تنجزها اليوم ("${habitName}"). أتمها للحفاظ على استمراريتك وسلسلة الإنجاز!`,
            actionLabel: 'انتقل للعادات', actionType: 'url', url: 'habits.html'
        });
    }

    candidates.sort((a, b) => b.score - a.score);
    const winnerCandidate = candidates[0] || null;
    const primaryDecision = (winnerCandidate && winnerCandidate.score >= 50) ? winnerCandidate : null;

    if (primaryDecision && primaryDecision.task) {
        primaryDecision.taskProgress = hayyizFormatTaskProgress(primaryDecision.task);
    }

    return {
        candidates,
        primaryDecision
    };
}

/**
 * 4. بناء الخطة اليومية التكيفية بناءً على الـ Snapshot والمهام المرتبة والقرار الرئيسي (Daily Plan Builder)
 */
function hayyizBuildDailyPlan(snapshot, rankedTasks, primaryDecision) {
    const snap = snapshot || hayyizBuildStudentSnapshot();
    const ranked = rankedTasks || hayyizRankTasks(snap).rankedTasks;
    const topDecision = primaryDecision !== undefined ? primaryDecision : hayyizEvaluateDecisions(snap, ranked).primaryDecision;

    const planItems = [];
    const itemIdsSeen = new Set();

    const urgentExams = snap.exams.filter((ex) => {
        if (!ex || ex.done || !ex.date) return false;
        const d = hayyizDaysUntil(String(ex.date).slice(0, 10));
        return d !== null && d >= 0 && d <= 2;
    });

    const topRankedForPlan = ranked.length > 0
        ? ranked
        : snap.activeTodos.map((t) => ({ task: t, score: 10 }));

    topRankedForPlan.forEach((r, idx) => {
        const t = r.task;
        if (!t) return;
        const itemId = 'plan-task-' + (t.id || t.text);
        if (itemIdsSeen.has(itemId)) return;

        const d = t.date ? hayyizDaysUntil(String(t.date).slice(0, 10)) : null;
        const isOverdue = d !== null && d < 0;
        const isDueToday = d === 0;
        const isHigh = t.priority === 'high';
        const focusDone = parseInt(t.focusDone, 10) || 0;
        const hasExplicitDuration = Boolean(t.minutes && parseInt(t.minutes, 10) > 0);
        const totalMin = hasExplicitDuration ? parseInt(t.minutes, 10) : snap.workMin;
        const remainingMin = Math.max(0, totalMin - focusDone);

        let badgeText = 'مهمة';
        let badgeClass = 'badge-primary';
        if (isOverdue) {
            badgeText = 'متأخرة';
            badgeClass = 'badge-danger';
        } else if (isDueToday) {
            badgeText = 'اليوم';
            badgeClass = 'badge-warning';
        } else if (isHigh) {
            badgeText = 'أولوية عالية';
            badgeClass = 'badge-primary';
        } else if (focusDone > 0) {
            badgeText = 'قيد التنفيذ';
            badgeClass = 'badge-warning';
        }

        let timeSubtitle = '';
        if (hasExplicitDuration) {
            if (focusDone > 0 && remainingMin > 0) {
                timeSubtitle = `متبقي ${remainingMin} دقيقة (${focusDone}/${totalMin} د)`;
            } else if (focusDone > 0 && remainingMin === 0) {
                timeSubtitle = `بلغت تقدير ${totalMin} دقيقة؛ تأكد من الإنجاز أو خصص جلسة إضافية`;
            } else {
                timeSubtitle = `${totalMin} دقيقة`;
            }
        } else {
            if (focusDone > 0) {
                timeSubtitle = `أُنجز ${focusDone} دقيقة تركيز`;
            } else {
                timeSubtitle = `جلسة ${snap.workMin} دقيقة مقترحة`;
            }
        }

        let priorityScore = r.score || (50 - idx * 2);
        if (isOverdue) priorityScore += 40;
        if (isDueToday) priorityScore += 30;

        planItems.push({
            id: itemId,
            type: 'todo',
            priority: priorityScore,
            badge: badgeText,
            badgeClass: badgeClass,
            title: t.text,
            subtitle: timeSubtitle,
            icon: focusDone > 0 ? 'fa-solid fa-spinner' : 'fa-solid fa-list-check',
            actionLabel: focusDone > 0 ? 'استكمال' : 'ابدأ',
            actionType: 'pomo-task',
            task: t,
            url: 'pomodoro.html'
        });
        itemIdsSeen.add(itemId);
    });

    urgentExams.forEach((ex) => {
        const d = hayyizDaysUntil(String(ex.date).slice(0, 10));
        const itemId = 'plan-exam-' + ex.id;
        if (itemIdsSeen.has(itemId)) return;

        let badgeText = d === 0 ? 'اليوم' : (d === 1 ? 'غداً' : `بعد يومين`);
        let badgeClass = d === 0 ? 'badge-danger' : 'badge-warning';
        let priorityScore = 120 + (7 - d) * 15;

        planItems.push({
            id: itemId,
            type: 'exam',
            priority: priorityScore,
            badge: 'اختبار ' + badgeText,
            badgeClass: badgeClass,
            title: ex.name,
            subtitle: ex.time ? `موعد الاختبار: ${ex.time}` : 'مراجعة وتأهب للاختبار',
            icon: 'fa-solid fa-graduation-cap',
            actionLabel: 'مراجعة',
            actionType: 'pomo-event',
            event: ex,
            url: 'pomodoro.html'
        });
        itemIdsSeen.add(itemId);
    });

    const pendingHabits = snap.habits.filter((h) => h && h.lastCompleted !== snap.today);
    if (pendingHabits.length > 0 && planItems.length < 4) {
        const h = pendingHabits[0];
        const itemId = 'plan-habit-' + h.id;
        if (!itemIdsSeen.has(itemId)) {
            planItems.push({
                id: itemId,
                type: 'habit',
                priority: 35,
                badge: 'عادة',
                badgeClass: 'badge-success',
                title: h.name || h.title,
                subtitle: `سلسلة الاستمرار: ${h.streak || 0} أيام`,
                icon: 'fa-solid fa-fire',
                actionLabel: 'إنجاز',
                actionType: 'url',
                url: 'habits.html'
            });
            itemIdsSeen.add(itemId);
        }
    }

    planItems.sort((a, b) => b.priority - a.priority);

    if (topDecision) {
        if (topDecision.id === 'running-focus') {
            const runningItem = {
                id: 'plan-running-focus',
                type: 'pomodoro',
                priority: 2000,
                isPrimaryNextAction: true,
                badge: 'جلسة جارية',
                badgeClass: 'badge-danger',
                title: topDecision.actionTitle || 'جلسة تركيز',
                subtitle: topDecision.reason || 'واصل تركيزك الحقيقي الآن',
                icon: 'fa-solid fa-circle-play',
                actionLabel: 'متابعة',
                actionType: 'url',
                url: 'pomodoro.html'
            };
            planItems.unshift(runningItem);
        } else if (topDecision.task) {
            const existingIdx = planItems.findIndex((item) => item.task && item.task.id === topDecision.task.id);
            if (existingIdx >= 0) {
                const item = planItems.splice(existingIdx, 1)[0];
                item.priority = 1000;
                item.isPrimaryNextAction = true;
                item.actionLabel = topDecision.actionLabel || item.actionLabel;
                planItems.unshift(item);
            }
        } else if (topDecision.event) {
            const existingIdx = planItems.findIndex((item) => item.event && item.event.id === topDecision.event.id);
            if (existingIdx >= 0) {
                const item = planItems.splice(existingIdx, 1)[0];
                item.priority = 1000;
                item.isPrimaryNextAction = true;
                planItems.unshift(item);
            }
        }
    }

    // Use the shared schedules for planned tasks and fill only genuinely free time.
    const capacity = hayyizGetDayCapacity(snap.today);
    const scheduledToday = new Map(), plannedTaskIds = new Set();
    const allocation = hayyizBuildSharedStudyAllocation(hayyizGetMultiDayPlans());
    allocation.allocations.forEach((days, taskId) => {
        plannedTaskIds.add(taskId);
        scheduledToday.set(taskId, days.get(snap.today) || 0);
    });
    let remaining = capacity.remainingMinutes;
    let reserved = Math.min(remaining, Array.from(scheduledToday.values()).reduce((sum, minutes) => sum + minutes, 0));
    const included = [], deferred = [];
    planItems.forEach((item) => {
        let needed = 0;
        if (item.task) needed = hayyizTaskRemainingMinutes(item.task, snap.workMin);
        else if (item.event) needed = snap.workMin;
        const inPlan = item.task && plannedTaskIds.has(item.task.id);
        const todayShare = item.task ? scheduledToday.get(item.task.id) || 0 : 0;
        if (inPlan && !todayShare) {
            deferred.push(Object.assign({}, item, { deferredMinutes: needed, deferredReason: allocation.allocations.get(item.task.id)?.size ? 'موزعة على أيام لاحقة' : 'لا يتسع لها الوقت قبل موعدها' })); return;
        }
        if (needed > 0) {
            const free = inPlan ? Math.min(todayShare, remaining) : Math.max(0, remaining - reserved);
            const allocated = Math.min(needed, free);
            if (!allocated) { deferred.push(Object.assign({}, item, { deferredMinutes: needed, deferredReason: 'لا يتسع لها وقت اليوم' })); return; }
            item.plannedMinutes = allocated;
            if (allocated < needed) item.subtitle += ` · اليوم ${allocated} دقيقة`;
            remaining -= allocated;
            if (inPlan) reserved = Math.max(0, reserved - allocated);
            if (allocated < needed) deferred.push(Object.assign({}, item, { deferredMinutes: needed - allocated, deferredReason: 'بقية العمل خارج وقت اليوم' }));
        }
        included.push(item);
    });
    included.budget = Object.assign({}, capacity, {
        plannedMinutes: capacity.remainingMinutes - remaining,
        deferredMinutes: deferred.reduce((sum, item) => sum + item.deferredMinutes, 0)
    });
    included.deferred = deferred;
    return included;
}

/**
 * حساب مقارنة التركيز اليومي مع التاريخ الأسبوعي البسيط (7 أيام سابقة)
 */
function hayyizGetFocusHistoryComparison(focusMinutesToday) {
    try {
        const hist = hayyizParseJSON('hayyiz-focus-history', {});
        let totalPastMinutes = 0;
        let recordedInWindowCount = 0;

        const todayStr = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
        const parts = todayStr.split('-').map(Number);

        // جمع دقائق التركيز وفحص وجود السجلات للـ 7 أيام السابقة بالكامل (ضمن النافذة فقط)
        for (let i = 1; i <= 7; i++) {
            const d = new Date(parts[0], parts[1] - 1, parts[2] - i);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const key = `${y}-${m}-${dd}`;

            if (hist[key] !== undefined) {
                recordedInWindowCount++;
                totalPastMinutes += (parseInt(hist[key], 10) || 0);
            }
        }

        // يتطلب وجود 3 أيام مسجلة على الأقل داخل نافذة الأيام السبعة السابقة فقط
        if (recordedInWindowCount < 3) {
            return { hasSufficientData: false, comparisonText: '', avgMinutes: 0 };
        }

        // المتوسط يُحسب دائماً على الأيام السبعة السابقة بالكامل
        const avgMinutes = Math.round(totalPastMinutes / 7);
        let comparisonText = '';

        if (focusMinutesToday >= Math.round(avgMinutes * 1.2) && focusMinutesToday >= 20) {
            comparisonText = 'أعلى من معدلك الأسبوعي';
        } else if (focusMinutesToday >= Math.round(avgMinutes * 0.7)) {
            comparisonText = 'ضمن معدلك المعتاد';
        } else if (focusMinutesToday > 0) {
            comparisonText = 'أقل من معدلك المعتاد';
        } else {
            comparisonText = 'لم تبدأ التركيز بعد اليوم';
        }

        return {
            hasSufficientData: true,
            comparisonText,
            avgMinutes,
            validDaysCount: 7
        };
    } catch (e) {
        return { hasSufficientData: false, comparisonText: '', avgMinutes: 0 };
    }
}

/**
 * استخراج حالة يوم الطالب الموحدة بناءً على الإشارات الحقيقية
 */
function hayyizComputeDayStatus(snapshot) {
    const snap = snapshot || hayyizBuildStudentSnapshot();
    const today = snap.today;
    const completedToday = snap.todos.filter((t) => t && t.completed && t.completedAt === today).length;
    const tasksWithPartialFocus = snap.activeTodos.filter((t) => (parseInt(t.focusDone, 10) || 0) > 0);

    let totalPartialFocusMinutes = 0;
    tasksWithPartialFocus.forEach((t) => {
        totalPartialFocusMinutes += (parseInt(t.focusDone, 10) || 0);
    });

    const isRunningFocus = Boolean(
        snap.focusState && snap.focusState.status === 'running' && snap.focusState.remainingSeconds > 0
    );

    const upcomingExamsNear = snap.exams.filter((ex) => {
        if (!ex || ex.done || !ex.date) return false;
        const d = hayyizDaysUntil(String(ex.date).slice(0, 10));
        return d !== null && d >= 0 && d <= 2;
    });

    const historyComparison = hayyizGetFocusHistoryComparison(snap.focusMinutesToday);

    let statusKey = 'no_plan';
    let statusLabel = 'بدون خطة نشطة';
    let title = 'لا توجد خطة عمل محددة اليوم';
    let description = 'أضف مهامك أو جدول اختباراتك لتبدأ تنظيم يومك بشكل واضح.';
    let cssClass = 'status-neutral';

    // 1. نشاط جاري الآن
    if (isRunningFocus) {
        statusKey = 'active_activity';
        statusLabel = 'نشاط حالي مستمر';
        const ctxTitle = snap.focusState.context ? snap.focusState.context.title : 'جلسة تركيز';
        title = 'جلسة تركيز جارية الآن';
        description = `أنت في منتصف جلسة تركيز ("${ctxTitle}"). واصل تركيزك للحفاظ على الاستمرارية.`;
        cssClass = 'status-active';
    }
    // 2. ضغط متراكم (3+ مهام متأخرة أو مهام متأخرة + اختبار قريب)
    else if (snap.overdueTodos.length >= 3 || (snap.overdueTodos.length >= 1 && upcomingExamsNear.length >= 1 && snap.focusMinutesToday < snap.workMin)) {
        statusKey = 'accumulated_pressure';
        statusLabel = 'ضغط متراكم';

        const hasNearExams = upcomingExamsNear.length >= 1;
        if (hasNearExams) {
            title = 'تراكم في المهام والاستحقاقات';
            description = `لديك ${snap.overdueTodos.length} مهام متأخرة مع وجود استحقاق قريب (${upcomingExamsNear[0].name}). البدء بأصغر مهمة يقلل الضغط تدريجياً.`;
        } else {
            title = 'تراكم في المهام المتأخرة';
            description = `لديك ${snap.overdueTodos.length} مهام متأخرة عن موعدها. البدء بأصغر مهمة يقلل الضغط تدريجياً.`;
        }
        cssClass = 'status-danger';
    }
    // 3. تأخر في بعض المهام (1-2 مهمة متأخرة)
    else if (snap.overdueTodos.length > 0) {
        statusKey = 'struggling';
        statusLabel = 'يحتاج استدراك';
        title = 'تأخر في بعض المهام';
        description = `لديك ${snap.overdueTodos.length} مهمة متأخرة عن موعدها. خذ جلسة تركيز واحدة لاستعادة السيطرة.`;
        cssClass = 'status-warning';
    }
    // 4. اختبار قريب (استحقاق قريب)
    else if (upcomingExamsNear.length > 0) {
        statusKey = 'upcoming_due';
        statusLabel = 'استحقاق قريب';
        const ex = upcomingExamsNear[0];
        const d = hayyizDaysUntil(String(ex.date).slice(0, 10));
        const dayLabel = d === 0 ? 'اليوم' : (d === 1 ? 'غداً' : 'بعد يومين');

        const linkedTaskWithFocus = snap.activeTodos.find((t) => {
            if (!t || (parseInt(t.focusDone, 10) || 0) <= 0) return false;
            if (ex.subjectId && t.subjectId === ex.subjectId) return true;
            if (t.eventId && t.eventId === ex.id) return true;
            if (ex.name && t.text && t.text.includes(ex.name)) return true;
            return false;
        });

        if (linkedTaskWithFocus) {
            title = `استعداد لاختبار قريب (${ex.name})`;
            description = `لديك اختبار ${dayLabel} وقد أنجزت ${linkedTaskWithFocus.focusDone} دقيقة تركيز على مهمة الاستعداد ("${linkedTaskWithFocus.text}"). استمر في المراجعة.`;
        } else {
            title = `اختبار قريب (${ex.name})`;
            description = `لديك اختبار ${dayLabel}. الاستعداد المبكر يمنحك ثقة وأداء أفضل.`;
        }
        cssClass = 'status-info';
    }
    // 5. تقدم جاري على مهمة بدأت فيها جلسات تركيز
    else if (tasksWithPartialFocus.length > 0) {
        statusKey = 'active_activity';
        statusLabel = 'تقدم جاري';
        title = 'عمل قيد التنفيذ';
        description = `أُنجزت ${totalPartialFocusMinutes} دقيقة تركيز على مهام قيد التنفيذ. استكمال الجلسات يوصلك للإنجاز الكامل.`;
        cssClass = 'status-active';
    }
    // 6. يوم يسير بشكل جيد (مهام مكتملة أو تقدم حقيقي)
    else if (completedToday > 0 || (snap.focusMinutesToday >= snap.workMin && snap.activeTodos.length <= 3) || (snap.habitsSummary.total > 0 && snap.habitsSummary.completed === snap.habitsSummary.total && snap.activeTodos.length === 0)) {
        statusKey = 'good';
        statusLabel = 'يسير بشكل جيد';

        if (completedToday > 0) {
            title = 'تقدم وإنجاز محرز';
            description = `أكملت ${completedToday} مهام اليوم` + (snap.focusMinutesToday > 0 ? ` مع ${snap.focusMinutesToday} دقيقة تركيز.` : '.');
        } else if (snap.focusMinutesToday >= snap.workMin) {
            title = 'بداية تركيز جيدة';
            description = `أنجزت ${snap.focusMinutesToday} دقيقة تركيز اليوم. واصل الجلسات لإكمال مهامك.`;
        } else {
            title = 'يوم متوازن';
            description = 'أكملت جميع عاداتك اليومية بنجاح.';
        }
        cssClass = 'status-success';
    }
    // 7. توجد مهام نشطة جاهزة للبدء ولم تبدأ بعد
    else if (snap.activeTodos.length > 0) {
        statusKey = 'ready_to_start';
        statusLabel = 'جاهز للبدء';
        title = 'لديك مهام تنتظر البدء';
        description = `لديك ${snap.activeTodos.length} مهام محددة. اختر أول مهمة وابدأ جلسة التركيز الأولى.`;
        cssClass = 'status-neutral';
    }
    // 8. لا توجد خطة أو عمل محدد
    else {
        statusKey = 'no_plan';
        statusLabel = 'بدون خطة نشطة';
        title = 'لا توجد خطة عمل محددة اليوم';
        description = 'أضف مهامك أو جدول اختباراتك لتبدأ تنظيم يومك بشكل واضح.';
        cssClass = 'status-neutral';
    }

    return {
        statusKey,
        statusLabel,
        title,
        description,
        cssClass,
        completedToday,
        tasksWithPartialFocusCount: tasksWithPartialFocus.length,
        totalPartialFocusMinutes,
        historyComparison
    };
}

/**
 * 5. المنسق المركزي لحالة الطالب ورؤية القرار الموحدة (Orchestrator Function)
 * Snapshot → Rank Tasks → Evaluate Decisions → Daily Plan → Day Status → Unified State
 */
function hayyizComputeStudentDecisionState() {
    const snapshot = hayyizBuildStudentSnapshot();
    const taskRanking = hayyizRankTasks(snapshot);
    const evaluation = hayyizEvaluateDecisions(snapshot, taskRanking.rankedTasks);
    const dailyPlan = hayyizBuildDailyPlan(snapshot, taskRanking.rankedTasks, evaluation.primaryDecision);
    const primary = evaluation.primaryDecision;
    const primaryIncluded = primary && dailyPlan.some(item =>
        (primary.task && item.task?.id === primary.task.id) ||
        (primary.event && item.event?.id === primary.event.id) || item.id === 'plan-running-focus');
    if (primary && (primary.task || primary.event) && !primaryIncluded) {
        const first = dailyPlan.find(item => item.task);
        evaluation.primaryDecision = first ? {
            id: 'today-planned-task', type: 'todo', badge: 'خطة اليوم', actionType: 'pomo-task',
            task: first.task, actionTitle: first.title, actionLabel: first.actionLabel,
            reason: 'ضمن وقتك المتاح وخطة اليوم', taskProgress: hayyizFormatTaskProgress(first.task)
        } : null;
    }
    if (dailyPlan.length && !dailyPlan.some(item => item.isPrimaryNextAction)) dailyPlan[0].isPrimaryNextAction = true;
    const dayStatus = hayyizComputeDayStatus(snapshot);

    const rankingById = new Map(taskRanking.rankedTasks.map(row => [row.task.id, row]));
    const plannedTasks = dailyPlan.filter(item => item.task && item.plannedMinutes > 0).map(item =>
        Object.assign({}, rankingById.get(item.task.id), { task: item.task, plannedMinutes: item.plannedMinutes }));
    const getRecommendations = (limit) => {
        const max = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 5;
        const top = plannedTasks.slice(0, max);
        const next = top[0] || null;
        return {
            next: next ? next.task : null,
            reason: next ? (next.reasons || []).join(' · ') : '',
            isInProgress: next ? !!next.isInProgress : false,
            plannedMinutes: next ? next.plannedMinutes : 0,
            ranked: top,
            allActive: snapshot.activeTodos
        };
    };

    const recommendation = getRecommendations(5);

    return {
        snapshot,
        today: snapshot.today,
        todos: snapshot.todos,
        activeTodos: snapshot.activeTodos,
        overdueTodos: snapshot.overdueTodos,
        dueTodayTodos: snapshot.dueTodayTodos,
        habits: snapshot.habits,
        habitsSummary: snapshot.habitsSummary,
        exams: snapshot.exams,
        focusState: snapshot.focusState,
        focusMinutesToday: snapshot.focusMinutesToday,
        workMin: snapshot.workMin,
        rankedTasks: taskRanking.rankedTasks,
        nextTask: recommendation.next,
        nextReason: recommendation.reason,
        isInProgress: recommendation.isInProgress,
        candidates: evaluation.candidates,
        primaryDecision: evaluation.primaryDecision,
        dailyPlan,
        dailyBudget: dailyPlan.budget,
        deferredItems: dailyPlan.deferred || [],
        dayStatus,
        recommendation,
        getRecommendations
    };
}

/**
 * 6. Compatibility wrappers share the same allocated decisions as the dashboard.
 */
function hayyizRecommendNext(limit) {
    return hayyizComputeStudentDecisionState().getRecommendations(limit);
}

function hayyizEvaluateStudentState() {
    return hayyizComputeStudentDecisionState().primaryDecision;
}

function hayyizGenerateDailyPlan() {
    return hayyizComputeStudentDecisionState().dailyPlan;
}

/* ---------- Focus Engine Data Layer Helpers ---------- */

/**
 * حساب عدد جلسات التركيز المطلوبة بناءً على الدقائق وتفضيلات البومودورو
 */
function hayyizCalculateFocusSessions(minutes, workMinOverride) {
    if (!minutes || minutes <= 0) return 0;
    const workMin = typeof workMinOverride === 'number' && workMinOverride > 0
        ? workMinOverride
        : (parseInt(hayyizStorage.getItem('hayyiz-pref-work') || '25', 10) || 25);
    return Math.ceil(minutes / workMin);
}

/**
 * تنسيق عدد جلسات التركيز باللغة العربية
 */
function hayyizFormatFocusSessions(minutes, workMinOverride) {
    const count = hayyizCalculateFocusSessions(minutes, workMinOverride);
    if (count === 0) return '0 جلسات';
    if (count === 1) return 'جلسة واحدة';
    if (count === 2) return 'جلستان';
    if (count >= 3 && count <= 10) return `${count} جلسات`;
    return `${count} جلسة`;
}

/**
 * التأكد من إعادة تهيئة إحصائيات اليوم عند تغير التاريخ
 */
function hayyizEnsureTodayStats() {
    if (typeof hayyizRefreshFocusStats === 'function') {
        hayyizRefreshFocusStats();
        return;
    }
    const today = typeof getTodayLocal === 'function' ? getTodayLocal() : new Date().toISOString().slice(0, 10);
    const lastDay = hayyizStorage.getItem('hayyiz-sessions-day');
    if (lastDay !== today) {
        hayyizStorage.setItem('hayyiz-sessions-today', '0');
        hayyizStorage.setItem('hayyiz-focus-minutes-today', '0');
        hayyizStorage.setItem('hayyiz-sessions-day', today);
    }
}

/**
 * دالة مركزية لمطابقة وتحديث حالة البومودورو بشكل حتمي وidempotent اعتماداً على timestamps
 */
function hayyizAfterFocusCommit(effect) {
    if (hayyizStorage.afterCommit) hayyizStorage.afterCommit(effect); else effect();
}
let hayyizFocusCommitPromise = null;
let hayyizFocusCommitFailed = false;
function hayyizCommitPomodoroState() {
    try {
        if (hayyizStorage.isCurrentScope && !hayyizStorage.isCurrentScope(hayyizStorage.scope)) return null;
        return hayyizStorage.transaction ? hayyizStorage.transaction(hayyizReconcilePomodoroValues) : hayyizReconcilePomodoroValues();
    } catch (error) { console.warn('تعذر حفظ الجلسة؛ ستُعاد المحاولة.', error); return null; }
}
function hayyizHasFocusCoordinator() {
    return (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') || typeof indexedDB !== 'undefined';
}
function hayyizWithFocusLock(commit) {
    const locks = typeof navigator !== 'undefined' && navigator.locks;
    const name = 'hayyiz-focus-completion:' + (hayyizStorage.scope || 'guest');
    if (locks && typeof locks.request === 'function') return locks.request(name, commit);
    if (typeof indexedDB === 'undefined') return Promise.resolve().then(commit);
    // IndexedDB readwrite transactions serialize across documents too. This
    // dedicated database contains no student data, files or completion records.
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('hayyiz-focus-coordination', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('gate');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            let transaction, result;
            try {
                transaction = db.transaction('gate', 'readwrite');
                transaction.oncomplete = () => { db.close(); resolve(result); };
                transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error || new Error('Focus coordination failed')); };
                transaction.objectStore('gate').get(name).onsuccess = () => {
                    try { result = commit(); } catch (error) { transaction.abort(); }
                };
            } catch (error) { db.close(); reject(error); }
        };
    });
}
function hayyizReconcilePomodoroStateAsync() {
    if (hayyizFocusCommitPromise) return hayyizFocusCommitPromise;
    const commit = () => hayyizCommitPomodoroState();
    // Re-read the timer and log INSIDE the same account lock. A transaction
    // provides rollback; the Web Lock serializes other documents' completion.
    const pending = hayyizWithFocusLock(commit);
    hayyizFocusCommitPromise = pending.catch(error => {
        console.warn('تعذر قفل حفظ الجلسة.', error);
        return null;
    }).then(result => {
        hayyizFocusCommitFailed = !result;
        return result;
    }).finally(() => { hayyizFocusCommitPromise = null; });
    return hayyizFocusCommitPromise;
}
function hayyizReconcilePomodoroState() {
    if (!hayyizHasFocusCoordinator()) return hayyizCommitPomodoroState();
    // Synchronous dashboard/Todo readers must never write a stale snapshot
    // outside the lock. They can request completion and render its result later.
    let snapshot;
    try { snapshot = hayyizReconcilePomodoroValues(true); } catch (_) { return null; }
    if (snapshot && snapshot.status === 'running' && snapshot.endTime && snapshot.remainingSeconds === 0) {
        hayyizReconcilePomodoroStateAsync().then(result => {
            if (result && result.status === 'completed' && typeof window.dispatchEvent === 'function') {
                window.dispatchEvent(new Event('hayyiz:planning-changed'));
            }
        });
        if (hayyizFocusCommitFailed) return null;
    }
    return snapshot;
}
function hayyizReconcilePomodoroValues(readOnly = false) {
    if (!readOnly) hayyizEnsureTodayStats();
    const raw = hayyizStorage.getItem('hayyiz-pomodoro-state');
    if (!raw) return null;

    try {
        const state = JSON.parse(raw);
        if (!state || typeof state !== 'object') return null;

        const workMin = parseInt(state.workMinutes || hayyizStorage.getItem('hayyiz-pref-work') || '25', 10) || 25;
        const breakMin = parseInt(state.breakMinutes || hayyizStorage.getItem('hayyiz-pref-break') || '5', 10) || 5;
        const longBreakMin = parseInt(state.longBreakMinutes || hayyizStorage.getItem('hayyiz-pref-long') || '15', 10) || 15;

        let mode = state.mode || (state.isWorkMode === false ? 'break' : 'focus');
        let status = state.status || (state.isRunning ? 'running' : 'idle');
        let endTime = typeof state.endTime === 'number' ? state.endTime : null;
        let totalDuration = typeof state.totalDuration === 'number' ? state.totalDuration : (mode === 'focus' ? workMin : breakMin) * 60;
        let remainingSeconds = typeof state.remainingSeconds === 'number' ? state.remainingSeconds : totalDuration;
        let sessionInCycle = typeof state.sessionInCycle === 'number' ? state.sessionInCycle : parseInt(hayyizStorage.getItem('hayyiz-session-in-cycle') || '0', 10);
        let sessionId = state.sessionId || null;
        let pendingCompletionModal = state.pendingCompletionModal || null;
        let pendingNextMode = state.pendingNextMode || null;
        const startedAt = state.startedAt || (endTime ? new Date(endTime - totalDuration * 1000).toISOString() : null);

        let context = state.context || null;
        if (!context) {
            const taskName = hayyizStorage.getItem('hayyiz-current-task');
            const taskId = hayyizStorage.getItem('hayyiz-current-task-id');
            const eventRaw = hayyizStorage.getItem('hayyiz-current-event');
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

            if (rem <= 0 && !readOnly) {
                const completedAt = new Date(endTime).toISOString();
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
                        const completionDate = hayyizLocalDateKey(new Date(completedAt));

                        // Legacy counters remain readable; the shared counter module is authoritative.
                        if (typeof hayyizRecordFocusMinutes === 'function') {
                            hayyizRecordFocusMinutes(completionDate, workMinJustDone);
                            if (typeof hayyizSyncTool === 'function') hayyizAfterFocusCommit(() => hayyizSyncTool('focus-history'));
                        } else {
                            const completedTotal = parseInt(hayyizStorage.getItem('hayyiz-sessions') || '0', 10) + 1;
                            hayyizStorage.setItem('hayyiz-sessions', String(completedTotal));

                            hayyizEnsureTodayStats();
                            if (completionDate === getTodayLocal()) {
                                const todaySess = parseInt(hayyizStorage.getItem('hayyiz-sessions-today') || '0', 10) + 1;
                                const todayMin = parseInt(hayyizStorage.getItem('hayyiz-focus-minutes-today') || '0', 10) + workMinJustDone;
                                hayyizStorage.setItem('hayyiz-sessions-today', String(todaySess));
                                hayyizStorage.setItem('hayyiz-focus-minutes-today', String(todayMin));
                            }

                            // 2. تحديث سجل تاريخ التركيز
                            try {
                                const hist = JSON.parse(hayyizStorage.getItem('hayyiz-focus-history') || '{}');
                                const today = completionDate;
                                const nowMs = Date.now();
                                hist[today] = (parseInt(hist[today], 10) || 0) + workMinJustDone;
                                hayyizStorage.setItem('hayyiz-focus-history', JSON.stringify(hist));
                                hayyizStorage.setItem('hayyiz-focus-history-updated', String(nowMs));
                                if (typeof hayyizUploadItem === 'function') {
                                    hayyizAfterFocusCommit(() => hayyizUploadItem('focus-history', 'history', hist));
                                }
                            } catch (e) {}
                        }

                        // 3. كتابة السجل غير القابل للتغيير
                        hayyizLogFocusSession({
                            id: sessionId,
                            completedAt,
                            date: completionDate,
                            durationMinutes: workMinJustDone,
                            mode: 'focus',
                            contextType: context.type,
                            contextId: context.id,
                            contextTitle: context.title,
                            subjectId: context.subjectId
                        });
                        hayyizQueueWorkspaceFocusSession({ id: sessionId, context, startedAt, completedAt, durationMinutes: workMinJustDone });

                        hayyizAfterFocusCommit(() => hayyizTrackPlanningEvent('focus_completed'));

                        // 4. تطبيق نتيجة التركيز على المهمة أو المادة
                        if (context.type === 'task') {
                            hayyizApplyFocusResult({
                                workMin: workMinJustDone,
                                taskId: context.id,
                                taskText: context.title,
                                date: completionDate
                            });
                        } else if (context.subjectId) {
                            hayyizBumpSubjectProgress(context.subjectId, workMinJustDone, completionDate);
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
            startedAt,
            context,
            pendingCompletionModal,
            pendingNextMode,
            lastUpdated: Date.now()
        };

        if (!readOnly) {
            hayyizStorage.setItem('hayyiz-pomodoro-state', JSON.stringify(reconciled));
            hayyizStorage.setItem('hayyiz-session-in-cycle', String(sessionInCycle));
        }

        return reconciled;
    } catch (e) { throw e; }
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
        hayyizStorage.removeItem('hayyiz-pomodoro-state');
        return;
    }
    // A suspended tab must not resurrect a session completed in another tab.
    if (state.sessionId && ['running', 'paused'].includes(state.status) && hayyizGetFocusSessions().some(entry => entry && entry.id === state.sessionId)) return false;
    state.lastUpdated = Date.now();
    hayyizSaveJSON('hayyiz-pomodoro-state', state);
    return true;
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
    const today = sessionObj.date || getTodayLocal();
    const entry = {
        id: sessionObj.id || hayyizGenerateId(),
        timestamp: sessionObj.completedAt || new Date().toISOString(),
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
        hayyizAfterFocusCommit(() => hayyizUploadItem('focus-log', entry.id, entry));
    }
    return entry;
}

function hayyizLocalDateKey(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function hayyizQueueWorkspaceFocusSession(entry) {
    const context = entry.context || {};
    if (!context.workspaceTaskId || !entry.id) return;
    const queue = hayyizParseJSON('hayyiz-workspace-focus-outbox', {});
    queue[entry.id] = {
        id: entry.id, taskId: context.workspaceTaskId, workspaceId: context.workspaceId || null,
        startedAt: entry.startedAt || new Date(Date.parse(entry.completedAt) - entry.durationMinutes * 60000).toISOString(),
        endedAt: entry.completedAt, durationSeconds: entry.durationMinutes * 60
    };
    hayyizSaveJSON('hayyiz-workspace-focus-outbox', queue);
    if (typeof hayyizFlushWorkspaceFocusSessions === 'function') hayyizAfterFocusCommit(() => hayyizFlushWorkspaceFocusSessions());
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

// Automatic suggestions recheck today's allocation at click time. Manual task selection
// continues to use hayyizLaunchPomodoro directly, including work outside today's plan.
function hayyizLaunchPlannedTask(taskId) {
    const state = hayyizComputeStudentDecisionState();
    const item = state.dailyPlan.find(row => row.task && row.task.id === taskId && row.plannedMinutes > 0);
    if (!item) return false;
    if (state.focusState && ['running', 'paused'].includes(state.focusState.status) && state.focusState.remainingSeconds > 0) {
        window.location.href = 'pomodoro.html';
        return true;
    }
    hayyizLaunchPomodoro(item.task, undefined, item.plannedMinutes);
    return true;
}

/**
 * يجهّز التخزين وينتقل إلى صفحة البومودورو مرتبطاً بمهمة أو حدث تقويم أو تركيز حر.
 */
function hayyizLaunchPomodoro(target, indexHint, plannedMinutes) {
    if (!target) {
        hayyizStorage.removeItem('hayyiz-current-task');
        hayyizStorage.removeItem('hayyiz-current-task-index');
        hayyizStorage.removeItem('hayyiz-current-task-id');
        hayyizStorage.removeItem('hayyiz-task-session');
        hayyizStorage.removeItem('hayyiz-current-event');
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
        hayyizStorage.setItem('hayyiz-current-event', JSON.stringify(eventSnapshot));
        hayyizStorage.removeItem('hayyiz-current-task');
        hayyizStorage.removeItem('hayyiz-current-task-index');
        hayyizStorage.removeItem('hayyiz-current-task-id');
        hayyizStorage.removeItem('hayyiz-task-session');
        let eventUrl = 'pomodoro.html?event=' + encodeURIComponent(eventSnapshot.name);
        if (Number.isFinite(plannedMinutes) && plannedMinutes > 0) eventUrl += '&sessionMinutes=' + Math.max(1, Math.min(180, Math.floor(plannedMinutes)));
        window.location.href = eventUrl;
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

    const workMin = parseInt(hayyizStorage.getItem('hayyiz-pref-work') || '25', 10) || 25;
    const totalMinutes = taskObj.minutes ? parseInt(taskObj.minutes, 10) : null;

    const wsTaskId = taskObj.workspaceTaskId || taskObj.workspace_task_id || null;
    const wsId = taskObj.workspaceId || taskObj.workspace_id || null;

    const plan = {
        text: taskText,
        id: taskObj.id || null,
        index: index,
        subjectId: taskObj.subjectId || null,
        workspaceTaskId: wsTaskId,
        workspaceId: wsId,
        totalMinutes: totalMinutes && totalMinutes > 0 ? totalMinutes : null,
        focusDone: taskObj.focusDone ? parseInt(taskObj.focusDone, 10) || 0 : 0,
        sessionsDone: taskObj.sessionsDone ? parseInt(taskObj.sessionsDone, 10) || 0 : 0,
        sessionsNeeded:
            totalMinutes && totalMinutes > 0
                ? Math.ceil(totalMinutes / workMin)
                : null
    };

    hayyizStorage.setItem('hayyiz-current-task', taskText);
    if (taskObj.id) hayyizStorage.setItem('hayyiz-current-task-id', taskObj.id);
    else hayyizStorage.removeItem('hayyiz-current-task-id');
    hayyizStorage.setItem('hayyiz-current-task-index', String(index >= 0 ? index : -1));
    hayyizStorage.setItem('hayyiz-task-session', JSON.stringify(plan));
    hayyizStorage.removeItem('hayyiz-current-event');

    let pomoUrl = 'pomodoro.html?task=' + encodeURIComponent(taskText);
    if (taskObj.id) {
        pomoUrl += '&taskId=' + encodeURIComponent(taskObj.id);
    }
    if (wsTaskId) {
        pomoUrl += '&workspace_task_id=' + encodeURIComponent(wsTaskId);
    }
    if (wsId) {
        pomoUrl += '&workspace_id=' + encodeURIComponent(wsId);
    }
    if (Number.isFinite(plannedMinutes) && plannedMinutes > 0) pomoUrl += '&sessionMinutes=' + Math.max(1, Math.min(180, Math.floor(plannedMinutes)));
    window.location.href = pomoUrl;
}

/**
 * بعد انتهاء جلسة عمل: يحدّث المهمة + المادة + اليوم.
 * يُستدعى من pomodoro.js
 */
function hayyizApplyFocusResult(opts) {
    const options = opts || {};
    const workMin = parseInt(options.workMin, 10) || 25;
    const taskId = options.taskId || hayyizStorage.getItem('hayyiz-current-task-id');
    const taskText = options.taskText || hayyizStorage.getItem('hayyiz-current-task');
    let plan = null;
    try {
        plan = JSON.parse(hayyizStorage.getItem('hayyiz-task-session') || 'null');
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
        todos[idx].lastFocused = options.date || getTodayLocal();
        todos[idx].updated = nowMs;
        hayyizSaveTodos(todos);

        if (typeof hayyizUploadItem === 'function') {
            hayyizAfterFocusCommit(() => hayyizUploadItem('todos', todos[idx].id, todos[idx]));
        }

        if (plan) {
            plan.focusDone = focusDone;
            plan.sessionsDone = sessionsDone;
            plan.id = todos[idx].id;
            plan.subjectId = todos[idx].subjectId || plan.subjectId || null;
            if (plan.totalMinutes) {
                plan.sessionsNeeded = Math.ceil(plan.totalMinutes / workMin);
            }
            hayyizStorage.setItem('hayyiz-task-session', JSON.stringify(plan));
        }

        const subjectId = todos[idx].subjectId || (plan && plan.subjectId);
        if (subjectId) {
            hayyizBumpSubjectProgress(subjectId, workMin, options.date);
        }

        return { task: todos[idx], index: idx, plan };
    }

    // لا مهمة مرتبطة — نحدّث المادة فقط إن وُجدت في الخطة
    if (plan && plan.subjectId) {
        hayyizBumpSubjectProgress(plan.subjectId, workMin, options.date);
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

    const result = hayyizUpdateTask(todos[idx].id, { completed: true, updated: Date.now() });
    const finish = updated => {
    if (!updated) return false;
    // تنظيف تخزين المهمة الحالية إذا كانت هي المهمة التي اكتملت
    const currentTaskId = hayyizStorage.getItem('hayyiz-current-task-id');
    const currentTaskText = hayyizStorage.getItem('hayyiz-current-task');
    if ((currentTaskId && currentTaskId === todos[idx].id) || (currentTaskText && currentTaskText === todos[idx].text)) {
        hayyizStorage.removeItem('hayyiz-current-task');
        hayyizStorage.removeItem('hayyiz-current-task-id');
        hayyizStorage.removeItem('hayyiz-current-task-index');
        hayyizStorage.removeItem('hayyiz-task-session');
    }

    return true;
    };
    return result && typeof result.then === 'function' ? result.then(finish) : finish(result);
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
        hayyizStorage.removeItem('hayyiz-academic-goal');
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
        hayyizStorage.removeItem('hayyiz-daily-goal');
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

/* ---------- الخطة متعددة الأيام — Multi-Day Study Plan Engine ---------- */

/* Shared planning preferences: additive keys; existing tasks and IDs stay intact. */
function hayyizParseMinutes(value) {
    const normalized = String(value == null ? '' : value).trim()
        .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632))
        .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776));
    if (!/^\d+$/.test(normalized)) return null;
    const number = Number(normalized);
    return Number.isSafeInteger(number) && number >= 0 && number <= 1440 ? number : null;
}

function hayyizValidDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T12:00:00');
    return !isNaN(date.getTime()) && date.getFullYear() === Number(value.slice(0, 4)) &&
        date.getMonth() + 1 === Number(value.slice(5, 7)) && date.getDate() === Number(value.slice(8, 10));
}

// Tasks may store a date or an HTML datetime-local value. Scheduling uses its local day;
// the original deadline (including its time) stays on the canonical task.
function hayyizTaskDateKey(value) {
    if (typeof value !== 'string') return null;
    if (/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
        const instant = new Date(value);
        return isNaN(instant.getTime()) ? null : hayyizLocalDateKey(instant);
    }
    const day = value.slice(0, 10);
    if (!hayyizValidDate(day)) return null;
    const time = value.slice(10);
    if (time && !/^T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?$/.test(time)) return null;
    return day;
}

function hayyizDefaultCapacity() {
    const configured = hayyizParseMinutes(hayyizGetPlanningPreferences().defaultMinutes);
    const value = configured !== null ? configured : hayyizParseMinutes(hayyizStorage.getItem('hayyiz-pref-daily-capacity'));
    return value === null ? 120 : value;
}

function hayyizGetPlanningPreferences() {
    const data = hayyizParseJSON('hayyiz-planning-preferences', {});
    const prefs = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return Object.assign({}, prefs, {
        week: object(prefs.week), overrides: object(prefs.overrides),
        commitments: (Array.isArray(prefs.commitments) ? prefs.commitments : []).filter(item => item && typeof item === 'object' && typeof item.name === 'string' && Array.isArray(item.days)).slice(0, 50),
        studyStart: hayyizClockMinutes(prefs.studyStart) !== null ? prefs.studyStart : '16:00',
        studyEnd: hayyizClockMinutes(prefs.studyEnd) !== null ? prefs.studyEnd : '22:00'
    });
}

function hayyizSavePlanningPreferences(prefs) {
    const next = Object.assign({}, prefs, { updatedAt: Math.max(Date.now(), Number(hayyizGetPlanningPreferences().updatedAt || 0) + 1) });
    hayyizSaveJSON('hayyiz-planning-preferences', next);
    if (typeof hayyizSyncTool === 'function') hayyizSyncTool('planning-preferences');
    hayyizReevaluateMultiDayPlan();
    hayyizNotifyPlanningChanged();
}

function hayyizClockMinutes(value) {
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
    const parts = value.split(':').map(Number);
    return parts[0] * 60 + parts[1];
}

function hayyizGetDayCapacity(date) {
    const day = hayyizValidDate(date) ? date : getTodayLocal();
    const prefs = hayyizGetPlanningPreferences();
    const weekday = new Date(day + 'T12:00:00').getDay();
    const weekly = hayyizParseMinutes(prefs.week && prefs.week[weekday]);
    const override = prefs.overrides && prefs.overrides[day];
    const overridden = hayyizParseMinutes(override && override.minutes);
    const total = overridden !== null ? overridden : weekly !== null ? weekly : hayyizDefaultCapacity();
    const start = hayyizClockMinutes(prefs.studyStart) ?? 960;
    const end = hayyizClockMinutes(prefs.studyEnd) ?? 1320;
    const ranges = (Array.isArray(prefs.commitments) ? prefs.commitments : []).filter(item =>
        item && Array.isArray(item.days) && item.days.includes(weekday) &&
        (!item.startDate || item.startDate <= day) && (!item.endDate || item.endDate >= day)
    ).map(item => [Math.max(start, hayyizClockMinutes(item.start) ?? end), Math.min(end, hayyizClockMinutes(item.end) ?? start)])
        .filter(range => range[1] > range[0]).sort((a, b) => a[0] - b[0]);
    // Union overlapping reservations so one minute can never be deducted twice.
    let busy = 0, lastEnd = start;
    ranges.forEach(range => { busy += Math.max(0, range[1] - Math.max(lastEnd, range[0])); lastEnd = Math.max(lastEnd, range[1]); });
    const focused = day === getTodayLocal() ? Math.max(0, parseInt((hayyizParseJSON('hayyiz-focus-history', {}) || {})[day], 10) ||
        (hayyizStorage.getItem('hayyiz-sessions-day') === day ? parseInt(hayyizStorage.getItem('hayyiz-focus-minutes-today'), 10) || 0 : 0)) : 0;
    return { date: day, totalMinutes: total, commitmentMinutes: busy, focusedMinutes: focused,
        remainingMinutes: Math.max(0, Math.min(total, Math.max(0, end - start)) - busy - focused) };
}

function hayyizSetTodayRemainingMinutes(value) {
    const minutes = hayyizParseMinutes(value);
    if (minutes === null) return false;
    const prefs = hayyizGetPlanningPreferences();
    const capacity = hayyizGetDayCapacity(getTodayLocal());
    const total = minutes + capacity.focusedMinutes + capacity.commitmentMinutes;
    const windowSize = (hayyizClockMinutes(prefs.studyEnd) ?? 1320) - (hayyizClockMinutes(prefs.studyStart) ?? 960);
    if (total > windowSize) return false;
    prefs.overrides = Object.assign({}, prefs.overrides, { [getTodayLocal()]: { minutes: total, updatedAt: Date.now() } });
    // Keep bounded historical overrides; future overrides are not discarded.
    Object.keys(prefs.overrides).sort().slice(0, Math.max(0, Object.keys(prefs.overrides).length - 90)).forEach(key => delete prefs.overrides[key]);
    hayyizSavePlanningPreferences(prefs);
    hayyizTrackPlanningEvent('time_updated');
    return true;
}

function hayyizTaskRemainingMinutes(task, fallback) {
    const estimate = Math.max(0, parseInt(task.minutes, 10) || fallback || 25);
    const done = Math.max(0, parseInt(task.focusDone, 10) || 0);
    // Exhausting an estimate never silently completes a task. Offer another session.
    return Math.max(0, estimate - done) || (task.completed ? 0 : fallback || 25);
}

function hayyizNotifyPlanningChanged() {
    if (typeof window.dispatchEvent === 'function' && typeof Event === 'function') {
        window.dispatchEvent(new Event('hayyiz:planning-changed'));
    }
}

function hayyizSaveDayReview(reason) {
    const allowed = ['done', 'time', 'difficulty', 'distraction', 'other'];
    if (!allowed.includes(reason)) return false;
    const raw = hayyizParseJSON('hayyiz-day-reviews', {});
    const reviews = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    reviews[getTodayLocal()] = { date: getTodayLocal(), reason, updatedAt: Date.now() };
    Object.keys(reviews).sort().slice(0, Math.max(0, Object.keys(reviews).length - 90)).forEach(key => delete reviews[key]);
    hayyizSaveJSON('hayyiz-day-reviews', reviews);
    if (typeof hayyizSyncTool === 'function') hayyizSyncTool('day-reviews');
    hayyizReevaluateMultiDayPlan();
    hayyizTrackPlanningEvent('day_reviewed');
    return true;
}

function hayyizExtendTaskEstimate(taskId, extraMinutes) {
    const extra = hayyizParseMinutes(extraMinutes);
    const task = hayyizGetTaskById(taskId);
    if (!task || task.completed || !extra || extra > 180) return false;
    const minutes = Math.max(parseInt(task.minutes, 10) || 0, parseInt(task.focusDone, 10) || 0) + extra;
    hayyizUpdateTask(taskId, { minutes, updated: Date.now() });
    hayyizReevaluateMultiDayPlan();
    hayyizTrackPlanningEvent('estimate_extended');
    return true;
}

function hayyizAdoptStudyPlan(config) {
    if (!config || (config.dailyCapacityMinutes !== undefined && hayyizParseMinutes(config.dailyCapacityMinutes) === null) || !hayyizValidDate(config.targetDate) || hayyizDaysUntil(config.targetDate) < 1 ||
        hayyizDaysUntil(config.targetDate) > 366 || !Array.isArray(config.subjects) || !config.subjects.length || config.subjects.length > 50) return null;
    if (config.subjects.some(s => !s || !String(s.name || '').trim() || !Number.isFinite(s.minutes) || s.minutes <= 0 || s.minutes > 527040)) return null;
    // Group by the same canonical name used to find subjects, before any writes.
    // One task per subject must preserve all requested minutes rather than keeping the last row.
    const subjectsByName = new Map();
    const priorities = { low: 1, medium: 2, high: 3 };
    config.subjects.forEach(row => {
        const name = String(row.name).trim().slice(0, 80);
        const priority = ['low', 'medium', 'high'].includes(row.priority) ? row.priority : 'medium';
        const existing = subjectsByName.get(name);
        if (existing) {
            existing.minutes += Math.ceil(row.minutes);
            if (priorities[priority] > priorities[existing.priority]) existing.priority = priority;
        } else subjectsByName.set(name, { name, minutes: Math.ceil(row.minutes), priority });
    });
    const subjects = Array.from(subjectsByName.values());
    if (subjects.some(row => row.minutes > 527040)) return null;
    const exams = hayyizParseJSON('hayyiz-student-exams', []);
    const existingExam = config.examId ? exams.find(ex => ex.id === config.examId) : null;
    if (config.examId && !existingExam) return null;
    if (existingExam && (!hayyizValidDate(existingExam.date) || hayyizDaysUntil(existingExam.date) < 1 || hayyizDaysUntil(existingExam.date) > 366)) return null;
    // A remembered target is reusable only when the planner created that exam.
    const draft = hayyizParseJSON('hayyiz-planner-draft', {});
    const previous = exams.find(ex => ex && ex.id === config.targetId && (ex.plannerSource === true ||
        // Backward compatibility: only an explicit saved new-plan draft establishes legacy ownership.
        (draft.targetId === ex.id && draft.examId === '' && ex.name === 'خطة مراجعة قبل الاختبار' && hayyizGetMultiDayPlan(ex.id))));
    const targetId = existingExam ? existingExam.id : (previous ? previous.id : hayyizGenerateId());
    const targetName = existingExam ? existingExam.name : (previous ? previous.name : 'خطة مراجعة قبل الاختبار');
    const now = Date.now();
    if (!existingExam) {
        const exam = Object.assign({}, previous || {}, { id: targetId, name: previous ? previous.name : targetName, date: config.targetDate,
            type: 'exam', created: previous ? previous.created : now, updated: now, plannerSource: true });
        const index = exams.findIndex(ex => ex && ex.id === targetId);
        if (index >= 0) exams[index] = Object.assign({}, exams[index], exam); else exams.push(exam);
        hayyizSaveJSON('hayyiz-student-exams', exams);
        if (typeof hayyizUploadItem === 'function') hayyizUploadItem('student-exams', targetId, exam);
    }
    const todos = hayyizGetTodos();
    const adoption = { created: 0, updated: 0, protectedFields: [], retainedTaskIds: [], mergedSubjects: config.subjects.length - subjects.length };
    const adoptedTasks = new Set();
    subjects.forEach(row => {
        const name = row.name;
        const subject = hayyizGetSubjects().find(s => s.name === name) || hayyizAddSubject(name);
        let task = todos.find(t => t.eventId === targetId && t.subjectId === subject.id && t.plannerSource === true);
        const generated = { date: existingExam ? existingExam.date : config.targetDate, minutes: Math.ceil(row.minutes),
            priority: ['high', 'medium', 'low'].includes(row.priority) ? row.priority : 'medium' };
        if (!task) {
            task = { id: hayyizGenerateId(), text: 'مراجعة ' + name, subjectId: subject.id, eventId: targetId,
                date: config.targetDate, minutes: Math.ceil(row.minutes), priority: row.priority || 'medium', taskType: 'review',
                completed: false, created: now, updated: now, plannerSource: true };
            Object.assign(task, generated);
            task.plannerDefaults = generated;
            todos.push(task);
            adoption.created++;
        } else {
            const baseline = task.plannerDefaults;
            Object.keys(generated).forEach(field => {
                // Older tasks have no baseline: preserve them rather than guessing which fields were edited.
                const same = (a, b) => field === 'minutes'
                    ? a != null && b != null && a !== '' && b !== '' && Number.isFinite(Number(a)) && Number(a) === Number(b)
                    : a === b;
                if (baseline && same(task[field], baseline[field])) {
                    if (!same(task[field], generated[field])) adoption.updated++;
                    task[field] = generated[field];
                } else if (!same(task[field], generated[field])) {
                    adoption.protectedFields.push({ taskId: task.id, field });
                }
            });
            task.plannerDefaults = generated;
            task.updated = Math.max(now, Number(task.updated || 0) + 1);
        }
        adoptedTasks.add(task.id);
        // Never reset text, completion or focus progress, and never delete omitted subjects.
        if (typeof hayyizUploadItem === 'function') hayyizUploadItem('todos', task.id, task);
    });
    adoption.retainedTaskIds = todos.filter(t => t.eventId === targetId && t.plannerSource === true && !adoptedTasks.has(t.id)).map(t => t.id);
    hayyizSaveTodos(todos);
    const plan = hayyizComputeMultiDayPlan({ targetId, targetName, targetDate: existingExam ? existingExam.date : config.targetDate,
        dailyCapacityMinutes: config.dailyCapacityMinutes, includeSubjectTasks: false });
    hayyizTrackPlanningEvent('plan_adopted');
    if (plan) plan.adoption = adoption;
    return plan;
}

function hayyizTrackPlanningEvent(name) {
    const allowed = ['first_plan', 'plan_adopted', 'focus_started', 'focus_completed', 'task_completed', 'time_updated', 'day_reviewed', 'estimate_extended'];
    if (!allowed.includes(name) || hayyizStorage.getItem('hayyiz-planning-metrics') !== 'enabled') return;
    if (typeof navigator !== 'undefined' && (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true)) return;
    // Store action names only. A sensitive route or unavailable SDK must never fall back to raw gtag.
    const stored = hayyizParseJSON('hayyiz-planning-pending-events', []);
    const queue = Array.isArray(stored) ? stored.filter(event => allowed.includes(event)).slice(-49) : [];
    hayyizSaveJSON('hayyiz-planning-pending-events', queue.concat(name));
    hayyizFlushPlanningEvents();
}

function hayyizFlushPlanningEvents() {
    if (hayyizStorage.getItem('hayyiz-planning-metrics') !== 'enabled' || typeof window.hayyizSendPlanningEvent !== 'function') return;
    if (typeof navigator !== 'undefined' && (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true)) return;
    const queue = hayyizParseJSON('hayyiz-planning-pending-events', []);
    if (!Array.isArray(queue)) { hayyizStorage.removeItem('hayyiz-planning-pending-events'); return; }
    const allowed = new Set(['first_plan', 'plan_adopted', 'focus_started', 'focus_completed', 'task_completed', 'time_updated', 'day_reviewed', 'estimate_extended']);
    const remaining = queue.slice(-50).filter(event => allowed.has(event)).filter(event => {
        try { return window.hayyizSendPlanningEvent(event) !== true; }
        catch (_) { return true; }
    });
    if (remaining.length) hayyizSaveJSON('hayyiz-planning-pending-events', remaining);
    else hayyizStorage.removeItem('hayyiz-planning-pending-events');
}
document.addEventListener('DOMContentLoaded', hayyizFlushPlanningEvents);

function hayyizGetMultiDayPlans() {
    hayyizEnsureDataShape();
    const plans = hayyizParseJSON('hayyiz-multi-day-plans', {});
    return (plans && typeof plans === 'object' && !Array.isArray(plans)) ? plans : {};
}

function hayyizGetPlanSyncData(plans) {
    const data = {};
    Object.values(plans || {}).forEach(p => {
        if (!p || !p.targetId) return;
        data[p.targetId] = {
            targetId: p.targetId, targetDate: p.targetDate, targetName: p.targetName,
            targetType: p.targetType, subjectId: p.subjectId, includeSubjectTasks: p.includeSubjectTasks,
            createdAt: p.createdAt, updatedAt: p.updatedAt
        };
    });
    return data;
}

function hayyizSaveMultiDayPlans(plans) {
    const cleanPlans = (plans && typeof plans === 'object' && !Array.isArray(plans)) ? plans : {};
    const before = JSON.stringify(hayyizGetPlanSyncData(hayyizGetMultiDayPlans()));
    hayyizSaveJSON('hayyiz-multi-day-plans', cleanPlans);
    // Merge remote configurations before uploading; a fresh device must not erase unseen plans.
    if (before !== JSON.stringify(hayyizGetPlanSyncData(cleanPlans)) && typeof hayyizSyncTool === 'function') {
        hayyizSyncTool('multi-day-plans');
    }
}

function hayyizGetMultiDayPlan(targetId) {
    if (!targetId) return null;
    const plans = hayyizGetMultiDayPlans();
    return plans[targetId] || null;
}

/**
 * حساب وإنشاء/تحديث خطة دراسية متعددة الأيام لهدف أو اختبار معين.
 * تعتمد على المهام الحقيقية في hayyiz-todos ولا تُنشئ أي نسخ موازية للمهام.
 */
function hayyizComputeMultiDayPlan(config) {
    if (!config || !config.targetId || !hayyizValidDate(config.targetDate) || hayyizDaysUntil(config.targetDate) > 366) return null;
    if (config.dailyCapacityMinutes !== undefined) {
        const minutes = hayyizParseMinutes(config.dailyCapacityMinutes);
        if (minutes === null) return null;
        hayyizStorage.setItem('hayyiz-pref-daily-capacity', String(minutes));
        const prefs = hayyizGetPlanningPreferences();
        if (prefs.defaultMinutes !== minutes) {
            prefs.defaultMinutes = minutes;
            prefs.updatedAt = Math.max(Date.now(), Number(prefs.updatedAt || 0) + 1);
            hayyizSaveJSON('hayyiz-planning-preferences', prefs);
            if (typeof hayyizSyncTool === 'function') hayyizSyncTool('planning-preferences');
        }
    }
    const plans = hayyizGetMultiDayPlans();
    const id = String(config.targetId);
    plans[id] = Object.assign({}, plans[id] || {}, config, { updatedAt: Math.max(Date.now(), Number(plans[id]?.updatedAt || 0) + 1) });
    return hayyizRebuildStudyPlans(plans)[id] || null;
}

// One derived allocation over canonical tasks, ordered by the earliest usable deadline.
// No extra task store is created; all plans and the daily view consume the same slices.
function hayyizBuildSharedStudyAllocation(plans) {
    const today = getTodayLocal();
    const ordered = Object.values(plans || {}).filter(p => p && p.targetId && hayyizValidDate(p.targetDate) &&
        hayyizDaysUntil(p.targetDate) >= 0 && hayyizDaysUntil(p.targetDate) <= 366)
        .sort((a, b) => a.targetDate.localeCompare(b.targetDate) || String(a.targetId).localeCompare(String(b.targetId)));
    const shared = { owners: new Map(), allocations: new Map() };
    const dateAt = offset => { const d = new Date(today + 'T12:00:00'); d.setDate(d.getDate() + offset);
        return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); };
    const lastWorkDate = p => dateAt(Math.max(0, hayyizDaysUntil(p.targetDate) - (hayyizDaysUntil(p.targetDate) >= 2 ? 2 : 1)));
    // Dated tasks must compete even when no exam plan exists. Bound the horizon independently.
    const horizon = dateAt(366);
    const work = [];
    hayyizGetTodos().forEach(task => {
        if (!task) return;
        const owner = ordered.find(p => task.eventId ? String(task.eventId) === String(p.targetId) :
            task.goalId ? String(task.goalId) === String(p.targetId) :
            p.includeSubjectTasks !== false && p.subjectId && String(task.subjectId) === String(p.subjectId));
        if (owner) shared.owners.set(task.id, String(owner.targetId));
        if (task.completed) return;
        // Overdue work competes for today, while its real deadline remains untouched on the task.
        const taskDay = hayyizTaskDateKey(task.date);
        const due = taskDay ? (taskDay < today ? today : taskDay) : null;
        if (!owner && (!due || due > horizon)) return;
        let deadline = owner ? lastWorkDate(owner) : (due < today ? today : due);
        if (owner && due && due < deadline) deadline = due;
        shared.allocations.set(task.id, new Map());
        work.push({ task, owner, deadline });
    });
    const priority = { high: 3, medium: 2, low: 1 };
    work.sort((a, b) => a.deadline.localeCompare(b.deadline) ||
        (priority[b.task.priority] || 2) - (priority[a.task.priority] || 2) ||
        String(a.owner?.targetDate || a.deadline).localeCompare(String(b.owner?.targetDate || b.deadline)) ||
        String(a.owner?.targetId || '').localeCompare(String(b.owner?.targetId || '')) ||
        (a.task.created || 0) - (b.task.created || 0) || String(a.task.id).localeCompare(String(b.task.id)));
    const reserved = new Map(), capacity = new Map();
    work.forEach(({ task, deadline }) => {
        let remaining = hayyizTaskRemainingMinutes(task, parseInt(hayyizStorage.getItem('hayyiz-pref-work'), 10) || 25);
        for (let offset = 0; offset <= 366 && remaining > 0; offset++) {
            const date = dateAt(offset);
            if (date > deadline) break;
            if (!capacity.has(date)) capacity.set(date, hayyizGetDayCapacity(date).remainingMinutes);
            const minutes = Math.min(remaining, Math.max(0, capacity.get(date) - (reserved.get(date) || 0)));
            if (!minutes) continue;
            shared.allocations.get(task.id).set(date, minutes);
            reserved.set(date, (reserved.get(date) || 0) + minutes);
            remaining -= minutes;
        }
    });
    return shared;
}

function hayyizRebuildStudyPlans(plansInput) {
    const plans = plansInput || hayyizGetMultiDayPlans();
    const shared = hayyizBuildSharedStudyAllocation(plans);
    const rebuilt = Object.assign({}, plans);
    Object.values(plans).filter(p => p && p.targetId && hayyizValidDate(p.targetDate))
        .sort((a, b) => a.targetDate.localeCompare(b.targetDate) || String(a.targetId).localeCompare(String(b.targetId)))
        .forEach(p => {
            // Daily capacity belongs to the student, never to an individual exam.
            const plan = hayyizAllocateMultiDayPlan(Object.assign({}, p, {
                dailyCapacityMinutes: hayyizDefaultCapacity()
            }), shared);
            if (plan) rebuilt[p.targetId] = plan;
        });
    hayyizSaveMultiDayPlans(rebuilt);
    return rebuilt;
}

function hayyizAllocateMultiDayPlan(config, shared) {
    if (!config || !config.targetId || !config.targetDate) return null;

    const today = getTodayLocal();
    const targetId = String(config.targetId);
    const targetDate = String(config.targetDate).slice(0, 10);
    const targetName = config.targetName || config.title || 'هدف دراسي';
    const targetType = config.targetType || 'exam';
    const subjectId = config.subjectId || null;

    // القدرة اليومية المحددة أو المخزنة أو الافتراضية
    const capacityPerDay = hayyizDefaultCapacity();



    const daysRemaining = hayyizDaysUntil(targetDate);
    if (daysRemaining === null || daysRemaining < 0 || daysRemaining > 366) {
        return {
            targetId,
            targetName,
            targetType,
            targetDate,
            subjectId,
            dailyCapacityMinutes: capacityPerDay,
            status: 'impossible',
            statusLabel: 'منتهي الموعد',
            daysRemaining: daysRemaining || -1,
            totalTasksCount: 0,
            completedTasksCount: 0,
            totalRequiredMinutes: 0,
            completedMinutes: 0,
            schedule: Array.isArray(config.schedule) ? config.schedule : [],
            updatedAt: config.updatedAt || Date.now()
        };
    }

    // 1. حساب مصفوفة التواريخ المتاحة من اليوم وحتى موعد الاستحقاق (شاملة)
    const dates = [];
    const parts = today.split('-').map(Number);
    const startObj = new Date(parts[0], parts[1] - 1, parts[2]);

    for (let i = 0; i <= daysRemaining; i++) {
        const d = new Date(startObj);
        d.setDate(d.getDate() + i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${dd}`);
    }

    // 2. ربط دقيق ومستهدف للمهام الحقيقية (المفتوحة والمكتملة)
    const todos = hayyizGetTodos();
    const includeSubjectTasks = config.includeSubjectTasks !== false;
    const linkedTasks = todos.filter(t => t && shared.owners.get(t.id) === targetId);
    const openTasks = linkedTasks.filter((t) => !t.completed);
    const completedTasks = linkedTasks.filter((t) => t.completed);

    const workMinDefault = parseInt(hayyizStorage.getItem('hayyiz-pref-work') || '25', 10) || 25;

    let totalRequiredMinutes = 0;
    let completedMinutes = 0;

    linkedTasks.forEach((t) => {
        const total = parseInt(t.minutes, 10) || workMinDefault;
        const done = parseInt(t.focusDone, 10) || 0;
        if (t.completed) {
            completedMinutes += Math.max(total, done);
        } else {
            completedMinutes += Math.min(done, total);
            totalRequiredMinutes += hayyizTaskRemainingMinutes(t, workMinDefault);
        }
    });

    // فحص وجود خطة سابقة للاحتفاظ بأيام الماضي ثابتة
    const existingPlansMap = hayyizGetMultiDayPlans();
    const existingPlan = existingPlansMap[targetId] || null;
    const pastScheduleItems = (existingPlan && Array.isArray(existingPlan.schedule))
        ? existingPlan.schedule.filter((s) => s && s.date && s.date < today)
        : [];

    // 3. تحديد أيام التوزيع ويوم المراجعة (D-1) ويوم الهدف (D)
    // D هو targetDate (تاريخ الهدف/الاختبار). ليس buffer day ولا يُجدول فيه عمل عادي إلا إذا كان daysRemaining === 0
    const totalDaysCount = dates.length; // daysRemaining + 1
    const targetDateStr = dates[totalDaysCount - 1]; // اليوم D

    // يوم الهامش/المراجعة هو D-1 عند وجود 2 أيام أو أكثر حتى موعد الهدف
    const hasBufferDay = daysRemaining >= 2;

    // تحديد التواريخ المتاحة للتوزيع المباشر للمهام
    let allocatableDates = [];
    if (daysRemaining === 0) {
        allocatableDates = [targetDateStr];
    } else if (daysRemaining === 1) {
        allocatableDates = [dates[0]]; // اليوم فقط، وغداً هو يوم الهدف
    } else { // daysRemaining >= 2
        allocatableDates = dates.slice(0, totalDaysCount - 2); // من اليوم وحتى D-2
    }

    const dayScheduleMap = {};
    dates.forEach((d, idx) => {
        const isTargetDay = (d === targetDateStr);
        const isBufferDay = hasBufferDay && (idx === totalDaysCount - 2);

        dayScheduleMap[d] = {
            date: d,
            dayIndex: idx,
            isToday: (d === today),
            isTargetDay: isTargetDay,
            isBufferDay: isBufferDay,
            tasks: [],
            plannedMinutes: 0
        };
    });

    // Consume the globally reserved slices; never reserve a whole exam before other deadlines.
    let totalPlannedMinutes = 0;
    let totalUnallocatedMinutes = 0;
    openTasks.forEach(t => {
        let allocated = 0;
        (shared.allocations.get(t.id) || new Map()).forEach((minutes, date) => {
            const day = dayScheduleMap[date];
            if (!day || !allocatableDates.includes(date)) return;
            day.tasks.push({ taskId: t.id, text: t.text, taskType: t.taskType || 'general', priority: t.priority || 'medium',
                totalMinutes: parseInt(t.minutes, 10) || workMinDefault, focusDone: parseInt(t.focusDone, 10) || 0,
                remainingMinutes: minutes, isSplit: minutes < hayyizTaskRemainingMinutes(t, workMinDefault), completed: false });
            day.plannedMinutes += minutes;
            allocated += minutes;
        });
        totalPlannedMinutes += allocated;
        totalUnallocatedMinutes += Math.max(0, hayyizTaskRemainingMinutes(t, workMinDefault) - allocated);
    });

    const futureSchedule = dates.map((d) => {
        const item = dayScheduleMap[d];
        let dayStatus = 'balanced';
        let dayStatusLabel = 'متوازن';

        if (item.isTargetDay) {
            dayStatus = 'target_day';
            dayStatusLabel = 'موعد الهدف / الاختبار';
        } else if (item.isBufferDay) {
            dayStatus = 'review_buffer';
            dayStatusLabel = 'هامش مراجعة وتأهب';
        } else if (item.plannedMinutes > capacityPerDay) {
            dayStatus = 'heavy';
            dayStatusLabel = 'حمل مرتفع (يتجاوز القدرة)';
        } else if (item.plannedMinutes === 0) {
            dayStatus = 'free';
            dayStatusLabel = 'استراحة / بدون مهام';
        }

        return {
            date: d,
            isToday: item.isToday,
            isTargetDay: item.isTargetDay,
            isBufferDay: item.isBufferDay,
            plannedMinutes: item.plannedMinutes,
            capacityMinutes: hayyizGetDayCapacity(d).remainingMinutes,
            tasksCount: item.tasks.length,
            tasks: item.tasks,
            dayStatus,
            dayStatusLabel
        };
    });

    // دمج عناصر الماضي الثابتة التي سبقت تاريخ اليوم مع جدول المستقبل
    const schedule = [...pastScheduleItems, ...futureSchedule];

    let overallStatus = 'active';
    let statusLabel = 'خطة متوازنة';
    const isCapacityExceeded = totalUnallocatedMinutes > 0;

    if (daysRemaining === 0) {
        overallStatus = 'final_day';
        statusLabel = 'اليوم — موعد الهدف';
    } else if (isCapacityExceeded) {
        overallStatus = 'overloaded';
        statusLabel = `الوقت المتاح لا يكفي لإكمال جميع المهام قبل الموعد (عجز: ${totalUnallocatedMinutes} د)`;
    } else if (openTasks.length === 0 && linkedTasks.length > 0) {
        overallStatus = 'completed';
        statusLabel = 'أُنجزت جميع المهام بنجاح 🎉';
    } else if (linkedTasks.length === 0) {
        overallStatus = 'no_tasks';
        statusLabel = 'لا توجد مهام مرتبطة بعد';
    }

    const plan = {
        targetId,
        targetName,
        targetType,
        targetDate,
        subjectId,
        dailyCapacityMinutes: capacityPerDay,
        status: overallStatus,
        statusLabel,
        daysRemaining,
        hasBufferDay,
        totalTasksCount: linkedTasks.length,
        openTasksCount: openTasks.length,
        completedTasksCount: completedTasks.length,
        totalRequiredMinutes,
        totalPlannedMinutes,
        totalUnallocatedMinutes,
        isCapacityExceeded,
        completedMinutes,
        schedule,
        includeSubjectTasks,
        createdAt: config.createdAt || Date.now(),
        updatedAt: config.updatedAt || Date.now()
    };
    return plan;
}

/**
 * إعادة تقييم وتحديث الخطة المستقبلية دون المساس بالماضي أو المهام المكتملة
 */
function hayyizReevaluateMultiDayPlan(targetId) {
    const plans = hayyizRebuildStudyPlans();
    return targetId ? plans[targetId] || null : plans;
}

/* ---------- تقويم الطالب — Calendar Data Layer ---------- */

/**
 * حساب تقويمي دقيق للعمر بالأيام والأشهر والسنوات
 */
function hayyizCalculateExactAge(birthDateObj, nowObj) {
    const end = new Date(nowObj.getFullYear(), nowObj.getMonth(), nowObj.getDate());
    const start = new Date(birthDateObj.getFullYear(), birthDateObj.getMonth(), birthDateObj.getDate());
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return { years: 0, months: 0, days: 0 };
    let count = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
    const anniversary = months => {
        const anchor = new Date(start.getFullYear(), start.getMonth() + months, 1);
        anchor.setDate(Math.min(start.getDate(), new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()));
        return anchor;
    };
    if (anniversary(count) > end) count--;
    const anchor = anniversary(count);
    const days = Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())) / 86400000);
    return { years: Math.floor(count / 12), months: count % 12, days };
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
        const rawExams = hayyizStorage.getItem(STORAGE_KEY_EXAMS);
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
        const rawEvents = hayyizStorage.getItem(STORAGE_KEY_EVENTS);
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

    // Event identity survives renaming/rescheduling; unrelated events may share a title.
    const exists = todos.find(t => t && ((eventObj.id && t.eventId === eventObj.id) ||
        (!t.eventId && t.text === todoText && t.date && String(t.date).slice(0, 10) === eventObj.date)));
    if (exists) return exists;

    let datetimeStr = eventObj.date;
    if (eventObj.time) {
        datetimeStr += `T${eventObj.time}`;
    }

    const newTodo = {
        id: hayyizGenerateId(),
        text: todoText,
        subjectId: eventObj.subjectId || null,
        taskType: eventObj.type === 'exam' ? 'review' : eventObj.type === 'assignment' ? 'assignment' : 'general',
        priority: eventObj.type === 'exam' ? 'high' : 'medium',
        date: datetimeStr,
        minutes: eventObj.type === 'exam' ? 45 : 30,
        completed: false,
        status: 'todo',
        created: Date.now(),
        updated: Date.now(),
        eventId: eventObj.id || null
    };

    todos.push(newTodo);
    hayyizSaveTodos(todos);
    if (typeof hayyizUploadItem === 'function') hayyizUploadItem('todos', newTodo.id, newTodo);
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

    const birthdate = hayyizStorage.getItem('hayyiz-birthdate') || null;
    const showAgePref = hayyizStorage.getItem('hayyiz-show-age-in-dashboard');

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
