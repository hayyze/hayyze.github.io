/**
 * تاريخ اليوم المحلي بصيغة YYYY-MM-DD
 * لا تستخدم toISOString() لأنه يعطي UTC وقد يغير اليوم عند منتصف الليل حسب المنطقة الزمنية.
 */
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
    const themeToggle = document.getElementById('theme-toggle');
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');

    // الثيم
    const savedTheme = localStorage.getItem('hayyiz-theme') || 'light';
    body.classList.toggle('theme-dark', savedTheme === 'dark');
    updateThemeIcon();

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            body.classList.toggle('theme-dark');
            const isDark = body.classList.contains('theme-dark');
            localStorage.setItem('hayyiz-theme', isDark ? 'dark' : 'light');
            updateThemeIcon();
        });
    }

    function updateThemeIcon() {
        if (!themeToggle) return;
        const icon = themeToggle.querySelector('i');
        icon.className = body.classList.contains('theme-dark') ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
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
const HAYYIZ_BACKUP_KEYS = [
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
    'hayyiz-task-session',
    'hayyiz-pomodoro-state'
];

function exportHayyizData() {
    const data = {
        version: 1,
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
