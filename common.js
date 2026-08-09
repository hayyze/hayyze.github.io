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