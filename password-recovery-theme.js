(function (global) {
    'use strict';

    try {
        if (global.localStorage && global.localStorage.getItem('hayyiz-theme') === 'dark') {
            global.document.documentElement.classList.add('theme-dark');
        }
    } catch (_) {}
})(window);
