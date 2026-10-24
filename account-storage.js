/* Keep the existing logical keys while isolating each signed-in account on this device. */
(function (global) {
    'use strict';
    if (global.hayyizStorage) return;
    const native = global.localStorage;
    const authKey = 'sb-dzfdbjnqtgltuguqqdkz-auth-token';
    const prefix = 'hayyiz-account:';
    const shared = new Set(['hayyiz-theme', 'hayyiz-highscore', 'hayyiz-device-id']);
    function savedUser() {
        try {
            const session = JSON.parse(native.getItem(authKey) || 'null');
            const id = session && session.user && session.user.id;
            return typeof id === 'string' && /^[\w-]{1,128}$/.test(id) ? id : null;
        } catch (_) { return null; }
    }
    // Pre-upgrade data has no reliable owner. Keep it in the guest area until the
    // user explicitly copies it into an account; never infer ownership from a new login.
    const accountId = savedUser();
    const scope = accountId ? 'user:' + accountId : 'guest';
    const accountPrefix = accountId ? prefix + encodeURIComponent(accountId) + ':' : '';
    let changing = false;
    function personal(key) { return key.startsWith('hayyiz-') && !key.startsWith(prefix) && !shared.has(key); }
    function physical(key) {
        key = String(key);
        if (key.startsWith(prefix)) throw new TypeError('Use a logical Hayyiz storage key.');
        return personal(key) && accountId ? accountPrefix + key : key;
    }
    function nativeKeys() {
        const keys = [];
        for (let i = 0; i < native.length; i++) {
            const key = native.key(i);
            if (typeof key === 'string') keys.push(key);
        }
        return keys;
    }
    function keys() {
        return nativeKeys().flatMap(key => {
            if (accountId && key.startsWith(accountPrefix)) return [key.slice(accountPrefix.length)];
            if (key.startsWith(prefix)) return [];
            if (accountId && personal(key)) return [];
            return [key];
        });
    }
    function transitionTo(userId) {
        if ((userId || null) === accountId && !changing) return false;
        if (changing) return true;
        changing = true;
        if (typeof global.dispatchEvent === 'function' && typeof global.Event === 'function') {
            global.dispatchEvent(new Event('hayyiz:account-changing'));
        }
        // This document remains bound to its original account, including unload
        // handlers. A new document reads the new session and its separate cache.
        if (global.location && typeof global.location.reload === 'function') global.location.reload();
        return true;
    }
    function guestSnapshot() {
        const result = Object.create(null);
        nativeKeys().filter(key => personal(key)).forEach(key => { result[key] = native.getItem(key); });
        return result;
    }
    function deviceId() {
        let id = native.getItem('hayyiz-device-id');
        if (!id) {
            id = global.crypto && typeof global.crypto.randomUUID === 'function' ? global.crypto.randomUUID()
                : 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
            native.setItem('hayyiz-device-id', id);
        }
        return id;
    }
    global.hayyizStorage = Object.freeze({
        getItem(key) { return native.getItem(physical(key)); },
        setItem(key, value) { native.setItem(physical(key), String(value)); },
        removeItem(key) { native.removeItem(physical(key)); },
        key(index) { return keys()[index] || null; },
        get length() { return keys().length; },
        clear() { keys().filter(personal).forEach(key => native.removeItem(physical(key))); },
        accountId, scope, transitionTo, guestSnapshot, deviceId,
        isCurrentUser(id) { return !changing && accountId === (id || null); },
        isCurrentScope(value) { return !changing && scope === value; },
        databaseName(name) { return accountId ? name + '--' + encodeURIComponent(accountId) : name; }
    });
    if (typeof global.addEventListener === 'function') global.addEventListener('storage', event => {
        if ((event.key === authKey || event.key === null) && savedUser() !== accountId) transitionTo(savedUser());
    });
})(typeof window !== 'undefined' ? window : globalThis);
