(function (global) {
    'use strict';

    const documentRef = global.document;
    if (!documentRef) return;

    const REDIRECT_URL = 'https://hayyze.pages.dev/reset-password.html';
    const RECOVERY_MARKER_KEY = 'hayyiz-password-recovery-session-v1';
    const RECOVERY_MARKER_TTL_MS = 15 * 60 * 1000;
    const MIN_PASSWORD_LENGTH = 8;
    const MAX_PASSWORD_LENGTH = 128;

    function byId(id) {
        return documentRef.getElementById(id);
    }

    function setStatus(element, message, kind) {
        if (!element) return;
        element.textContent = message;
        element.className = 'password-recovery-status' + (kind ? ' password-recovery-status--' + kind : '');
        element.hidden = false;
    }

    function hideStatus(element) {
        if (!element) return;
        element.hidden = true;
        element.textContent = '';
    }

    function isValidEmail(value, input) {
        if (!value || value.length > 254 || /\s/.test(value)) return false;
        if (input && input.validity && input.validity.typeMismatch) return false;
        const at = value.indexOf('@');
        return at > 0 && at < value.length - 3 && value.lastIndexOf('.') > at + 1;
    }

    function getSupabaseClient() {
        if (typeof global.ensureSupabaseLoaded !== 'function') {
            return Promise.reject(new Error('Supabase client loader is unavailable.'));
        }
        return global.ensureSupabaseLoaded().then(function (client) {
            if (!client || !client.auth) throw new Error('Supabase Auth is unavailable.');
            return client;
        });
    }

    function isRateLimitError(error) {
        const message = String(error && error.message || '').toLowerCase();
        const code = String(error && error.code || '').toLowerCase();
        return Number(error && error.status) === 429 ||
            message.includes('rate limit') ||
            message.includes('too many requests') ||
            code === 'over_email_send_rate_limit';
    }

    function initRequestPage(form) {
        const emailInput = byId('password-recovery-email');
        const status = byId('password-recovery-request-status');
        const submitButton = byId('password-recovery-request-button');
        if (!emailInput || !status || !submitButton) return;

        let submitting = false;
        let cooldownTimer = null;
        const originalButtonText = submitButton.textContent;

        function startCooldown() {
            if (cooldownTimer !== null) global.clearTimeout(cooldownTimer);
            submitButton.disabled = true;
            submitButton.textContent = 'انتظر دقيقة قبل إعادة الإرسال';
            cooldownTimer = global.setTimeout(function () {
                cooldownTimer = null;
                if (!submitting) {
                    submitButton.disabled = false;
                    submitButton.textContent = originalButtonText;
                }
            }, 60000);
        }

        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            if (submitting || submitButton.disabled) return;
            hideStatus(status);

            const email = String(emailInput.value || '').trim().toLowerCase();
            if (!isValidEmail(email, emailInput)) {
                emailInput.setAttribute('aria-invalid', 'true');
                setStatus(status, 'أدخل بريدًا إلكترونيًا صحيحًا ثم حاول مرة أخرى.', 'danger');
                emailInput.focus();
                return;
            }
            emailInput.setAttribute('aria-invalid', 'false');

            submitting = true;
            submitButton.disabled = true;
            submitButton.textContent = 'جارٍ إرسال الطلب...';
            form.setAttribute('aria-busy', 'true');

            try {
                const client = await getSupabaseClient();
                const result = await client.auth.resetPasswordForEmail(email, {
                    redirectTo: REDIRECT_URL
                });
                if (result && result.error) throw result.error;

                // Supabase intentionally returns the same result for unknown addresses.
                // Never display or log whether the account exists.
                setStatus(
                    status,
                    'إذا كان هذا البريد مرتبطًا بحساب في حيز، فستصلك رسالة تحتوي على رابط آمن لتعيين كلمة مرور جديدة. افحص البريد الوارد ومجلد الرسائل غير المرغوب فيها.',
                    'success'
                );
                startCooldown();
            } catch (error) {
                if (isRateLimitError(error)) {
                    setStatus(status, 'تم إرسال طلب حديث. انتظر قليلًا قبل طلب رابط جديد.', 'danger');
                    startCooldown();
                } else {
                    setStatus(status, 'تعذر إرسال الطلب الآن. تحقق من اتصالك بالإنترنت وحاول مرة أخرى لاحقًا.', 'danger');
                    submitButton.disabled = false;
                    submitButton.textContent = originalButtonText;
                }
            } finally {
                submitting = false;
                form.setAttribute('aria-busy', 'false');
            }
        });

        global.addEventListener('pagehide', function () {
            if (cooldownTimer !== null) global.clearTimeout(cooldownTimer);
        });
    }

    function readRecoveryMarker() {
        try {
            const raw = global.sessionStorage.getItem(RECOVERY_MARKER_KEY);
            if (!raw) return null;
            const marker = JSON.parse(raw);
            if (!marker || typeof marker.userId !== 'string' || !marker.userId ||
                !Number.isFinite(marker.expiresAt) || marker.expiresAt <= Date.now()) {
                global.sessionStorage.removeItem(RECOVERY_MARKER_KEY);
                return null;
            }
            return marker;
        } catch (_) {
            try { global.sessionStorage.removeItem(RECOVERY_MARKER_KEY); } catch (__) {}
            return null;
        }
    }

    function saveRecoveryMarker(userId) {
        try {
            global.sessionStorage.setItem(RECOVERY_MARKER_KEY, JSON.stringify({
                userId: userId,
                expiresAt: Date.now() + RECOVERY_MARKER_TTL_MS
            }));
        } catch (_) {}
    }

    function clearRecoveryMarker() {
        try { global.sessionStorage.removeItem(RECOVERY_MARKER_KEY); } catch (_) {}
    }

    function cleanCallbackCredentials() {
        try {
            global.history.replaceState(null, documentRef.title, global.location.pathname);
        } catch (_) {}
    }

    function initResetPage(form) {
        const checking = byId('password-recovery-checking');
        const invalid = byId('password-recovery-invalid');
        const success = byId('password-recovery-success');
        const status = byId('password-recovery-reset-status');
        const passwordInput = byId('password-recovery-new-password');
        const confirmInput = byId('password-recovery-confirm-password');
        const submitButton = byId('password-recovery-save-button');
        if (!checking || !invalid || !success || !form || !status || !passwordInput || !confirmInput || !submitButton) return;

        let authorized = false;
        let submitting = false;
        let verificationTimer = null;
        let client = null;
        let subscription = null;

        function showInvalidLink() {
            if (authorized || success.hidden === false) return;
            if (verificationTimer !== null) {
                global.clearTimeout(verificationTimer);
                verificationTimer = null;
            }
            checking.hidden = true;
            form.hidden = true;
            invalid.hidden = false;
        }

        function authorizeRecovery(user) {
            if (authorized || !user || typeof user.id !== 'string' || !user.id) return;
            authorized = true;
            saveRecoveryMarker(user.id);
            if (verificationTimer !== null) {
                global.clearTimeout(verificationTimer);
                verificationTimer = null;
            }
            cleanCallbackCredentials();
            checking.hidden = true;
            invalid.hidden = true;
            form.hidden = false;
            passwordInput.focus();
        }

        function showResetError(message, kind) {
            setStatus(status, message, kind || 'danger');
        }

        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            if (submitting || !authorized || !client) return;
            hideStatus(status);
            passwordInput.setAttribute('aria-invalid', 'false');
            confirmInput.setAttribute('aria-invalid', 'false');

            const password = String(passwordInput.value || '');
            const confirmation = String(confirmInput.value || '');
            if (password.length < MIN_PASSWORD_LENGTH) {
                passwordInput.setAttribute('aria-invalid', 'true');
                showResetError('يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.');
                passwordInput.focus();
                return;
            }
            if (password.length > MAX_PASSWORD_LENGTH) {
                passwordInput.setAttribute('aria-invalid', 'true');
                showResetError('كلمة المرور طويلة جدًا. استخدم 128 حرفًا كحد أقصى.');
                passwordInput.focus();
                return;
            }
            if (password !== confirmation) {
                confirmInput.setAttribute('aria-invalid', 'true');
                showResetError('كلمتا المرور غير متطابقتين.');
                confirmInput.focus();
                return;
            }

            submitting = true;
            submitButton.disabled = true;
            submitButton.textContent = 'جارٍ تحديث كلمة المرور...';
            form.setAttribute('aria-busy', 'true');

            try {
                const result = await client.auth.updateUser({ password: password });
                if (result && result.error) throw result.error;

                authorized = false;
                clearRecoveryMarker();
                passwordInput.value = '';
                confirmInput.value = '';
                form.hidden = true;
                success.hidden = false;
                checking.hidden = true;
                invalid.hidden = true;

                // Password recovery is a security event: revoke refresh-token sessions
                // across devices, then clear this browser even if global revocation fails.
                try {
                    const signOutResult = await client.auth.signOut({ scope: 'global' });
                    if (signOutResult && signOutResult.error) throw signOutResult.error;
                } catch (_) {
                    const successMessage = success.querySelector('span');
                    try {
                        const localSignOutResult = await client.auth.signOut({ scope: 'local' });
                        if (localSignOutResult && localSignOutResult.error) throw localSignOutResult.error;
                    } catch (__) {}
                    if (successMessage) {
                        successMessage.textContent = 'تم تغيير كلمة المرور، لكن تعذر إنهاء الجلسات الأخرى تلقائيًا. ننصح بتسجيل الخروج يدويًا من الأجهزة الأخرى.';
                    }
                }
            } catch (error) {
                const message = String(error && error.message || '').toLowerCase();
                if (isRateLimitError(error)) {
                    showResetError('تم تجاوز عدد المحاولات. انتظر قليلًا ثم حاول مجددًا.');
                } else if (message.includes('password') || message.includes('weak') || message.includes('length')) {
                    showResetError('كلمة المرور لا تستوفي متطلبات الأمان. استخدم كلمة مرور أطول وأقوى.');
                } else {
                    showResetError('تعذر تحديث كلمة المرور. قد يكون رابط الاستعادة منتهي الصلاحية؛ اطلب رابطًا جديدًا.');
                }
                submitButton.disabled = false;
                submitButton.textContent = 'حفظ كلمة المرور الجديدة';
            } finally {
                submitting = false;
                form.setAttribute('aria-busy', 'false');
            }
        });

        form.querySelectorAll('[data-password-target]').forEach(function (toggle) {
            toggle.addEventListener('click', function () {
                const targetId = toggle.getAttribute('data-password-target');
                const input = byId(targetId);
                if (!input) return;
                const reveal = input.type === 'password';
                input.type = reveal ? 'text' : 'password';
                toggle.textContent = reveal ? 'إخفاء' : 'إظهار';
                toggle.setAttribute('aria-pressed', String(reveal));
                toggle.setAttribute('aria-label', (reveal ? 'إخفاء' : 'إظهار') + ' ' +
                    (targetId === 'password-recovery-new-password' ? 'كلمة المرور الجديدة' : 'تأكيد كلمة المرور'));
            });
        });

        function attachAuthListener(readyClient) {
            if (!readyClient || !readyClient.auth || subscription) return;
            const listener = readyClient.auth.onAuthStateChange(function (event, session) {
                if (event === 'PASSWORD_RECOVERY' && session && session.user) {
                    authorizeRecovery(session.user);
                } else if (event === 'SIGNED_OUT') {
                    clearRecoveryMarker();
                }
            });
            subscription = listener && listener.data && listener.data.subscription;
        }

        // Subscribe as soon as the shared client is published, before its URL
        // callback initialization can emit PASSWORD_RECOVERY.
        if (global.supabaseClient && global.supabaseClient.auth) {
            attachAuthListener(global.supabaseClient);
        }
        global.addEventListener('hayyiz:supabase-ready', function (event) {
            attachAuthListener(event && event.detail);
        });

        async function bootstrap() {
            try {
                client = await getSupabaseClient();
                attachAuthListener(client);

                const url = new URL(global.location.href);
                const code = url.searchParams.get('code');
                if (code) {
                    const result = await client.auth.exchangeCodeForSession(code);
                    cleanCallbackCredentials();
                    if (result && !result.error && result.data && result.data.session && result.data.session.user) {
                        authorizeRecovery(result.data.session.user);
                    } else {
                        showInvalidLink();
                    }
                    return;
                }

                const hashParams = new URLSearchParams(String(global.location.hash || '').replace(/^#/, ''));
                if (hashParams.get('type') === 'recovery') {
                    // A new recovery callback must take precedence over any marker
                    // left by an earlier recovery session in this tab.
                    if (authorized) return;
                    clearRecoveryMarker();
                    // The SDK detects the implicit-flow callback and emits PASSWORD_RECOVERY.
                    verificationTimer = global.setTimeout(showInvalidLink, 8000);
                    return;
                }

                const marker = readRecoveryMarker();
                if (marker) {
                    const result = await client.auth.getUser();
                    if (!result.error && result.data && result.data.user && result.data.user.id === marker.userId) {
                        authorizeRecovery(result.data.user);
                        return;
                    }
                    clearRecoveryMarker();
                }

                showInvalidLink();
            } catch (_) {
                showInvalidLink();
            }
        }

        bootstrap();

        global.addEventListener('pagehide', function () {
            if (subscription && typeof subscription.unsubscribe === 'function') {
                subscription.unsubscribe();
            }
            if (verificationTimer !== null) global.clearTimeout(verificationTimer);
        });
    }

    const requestForm = byId('password-recovery-request-form');
    const resetForm = byId('password-recovery-reset-form');
    if (requestForm) initRequestPage(requestForm);
    if (resetForm) initResetPage(resetForm);
})(typeof window !== 'undefined' ? window : globalThis);
