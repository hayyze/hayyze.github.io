var hayyizStorage = (typeof window !== 'undefined' && window.hayyizStorage) || (typeof localStorage !== 'undefined' ? localStorage : undefined);
/**
 * auth-ui.js — واجهة المستخدم والمصادقة الخاصة بمنصة حيز عبر Supabase Auth
 * يتضمن ترجمة وتفسير أخطاء تجاوز الحدود (429 Rate Limiting) والتحكم بتبريد أزرار الواجهة (Cooldown UI)
 */

(function (global) {
    'use strict';

    let currentAuthUser = null;
    let submitCooldownTimer = null;
    let authReturnFocus = null;
    const AUTH_COOLDOWN_SECONDS = 10; // مهلة التبريد لمنع السبام بالنقر المتكرر

    /**
     * ترجمة رسائل الخطأ من Supabase إلى اللغة العربية
     */
    function formatAuthError(error) {
        if (!error) return 'حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.';
        const msg = (error.message || '').toLowerCase();
        const code = (error.code || '').toLowerCase();
        const status = error.status || (msg.includes('429') ? 429 : 0);

        if (status === 429 || msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('over_email_send_rate_limit') || code === 'over_email_send_rate_limit') {
            return 'تم تجاوز حد الطلبات المسموح به. يرجى الانتظار بضع دقائق قبل المحاولة مرة أخرى.';
        }
        if (msg.includes('user already registered') || msg.includes('already exists') || code === 'user_already_exists') {
            return 'البريد الإلكتروني مستخدم مسبقاً.';
        }
        if (msg.includes('invalid login credentials') || msg.includes('invalid credentials') || code === 'invalid_credentials') {
            return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
        }
        if (msg.includes('email not confirmed') || code === 'email_not_confirmed') {
            return 'البريد الإلكتروني غير مؤكد. يرجى التحقق من صندوق الوارد في بريدك الإلكتروني.';
        }
        if (msg.includes('password should be at least') || msg.includes('weak password')) {
            return 'كلمة المرور ضعيفة. يجب أن تكون 6 أحرف على الأقل.';
        }
        if (msg.includes('invalid email') || msg.includes('unable to validate email')) {
            return 'يرجى إدخال بريد إلكتروني صحيح.';
        }
        if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
            return 'خطأ في الاتصال بالشبكة. يرجى التحقق من اتصالك بالإنترنت.';
        }
        return error.message || 'حدث خطأ أثناء الاتصال بالخادم.';
    }

    /**
     * تطبيق فترة تبريد (Cooldown) على الأزرار في الواجهة لتجنب النقر المتكرر والـ Request Flooding
     */
    function applyButtonCooldown(buttonEl, originalHtml, seconds = AUTH_COOLDOWN_SECONDS) {
        if (!buttonEl) return;
        if (submitCooldownTimer) clearInterval(submitCooldownTimer);

        let remaining = seconds;
        buttonEl.disabled = true;
        buttonEl.innerHTML = `<i class="fa-solid fa-clock" aria-hidden="true"></i> يرجى الانتظار (${remaining}s)`;

        submitCooldownTimer = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                clearInterval(submitCooldownTimer);
                submitCooldownTimer = null;
                buttonEl.disabled = false;
                buttonEl.innerHTML = originalHtml;
            } else {
                buttonEl.innerHTML = `<i class="fa-solid fa-clock" aria-hidden="true"></i> يرجى الانتظار (${remaining}s)`;
            }
        }, 1000);
    }

    /**
     * تحديث زر التوثيق في النافبار
     */
    function updateNavAuthButton(user) {
        currentAuthUser = user;
        const navActions = document.querySelector('.nav-actions');
        if (!navActions) return;

        let authBtn = document.getElementById('nav-auth-btn');
        if (!authBtn) {
            authBtn = document.createElement('button');
            authBtn.id = 'nav-auth-btn';
            authBtn.type = 'button';
            authBtn.className = 'nav-auth-btn';
            authBtn.addEventListener('click', () => {
                openAuthModal();
            });
            // إدراج الزر قبل زر تبديل الوضع الليلي
            const themeBtn = navActions.querySelector('#theme-toggle');
            if (themeBtn) {
                navActions.insertBefore(authBtn, themeBtn);
            } else {
                navActions.appendChild(authBtn);
            }
        }

        if (user) {
            authBtn.className = 'nav-auth-btn logged-in';
            authBtn.setAttribute('aria-label', 'حسابي');
            authBtn.innerHTML = '<i class="fa-solid fa-user" aria-hidden="true"></i> <span>حسابي</span>';
        } else {
            authBtn.className = 'nav-auth-btn logged-out';
            authBtn.setAttribute('aria-label', 'تسجيل الدخول');
            authBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i> <span>تسجيل الدخول</span>';
        }
    }

    /**
     * إغلاق نافذة التوثيق
     */
    function closeAuthModal() {
        if (submitCooldownTimer) {
            clearInterval(submitCooldownTimer);
            submitCooldownTimer = null;
        }
        const modal = document.getElementById('hayyiz-auth-modal');
        if (modal) {
            modal.remove();
            if (authReturnFocus && typeof authReturnFocus.focus === 'function') authReturnFocus.focus();
            authReturnFocus = null;
        }
    }

    /**
     * فتح نافذة التوثيق (تسجيل الدخول / إنشاء حساب / البروفايل)
     */
    function openAuthModal(mode = null) {
        closeAuthModal();
        authReturnFocus = document.activeElement;

        if (typeof ensureSupabaseLoaded === 'function') {
            ensureSupabaseLoaded().catch(() => {});
        }

        const user = currentAuthUser;
        let currentMode = mode || (user ? 'profile' : 'login');

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'hayyiz-auth-modal';
        modalOverlay.className = 'modal auth-modal-overlay';
        modalOverlay.setAttribute('role', 'dialog');
        modalOverlay.setAttribute('aria-modal', 'true');
        modalOverlay.setAttribute('aria-labelledby', 'auth-modal-title');
        modalOverlay.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeAuthModal();
            } else if (event.key === 'Tab') {
                const controls = Array.from(modalOverlay.querySelectorAll('button, input, a[href]')).filter(el => !el.disabled);
                const first = controls[0], last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
        });

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeAuthModal();
            }
        });

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content auth-modal-content';

        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);

        renderModalBody(currentMode);

        function renderModalBody(viewMode) {
            const previousEmail = modalContent.querySelector('#auth-email');
            const emailValue = previousEmail ? previousEmail.value : '';
            if (submitCooldownTimer) { clearInterval(submitCooldownTimer); submitCooldownTimer = null; }
            currentMode = viewMode;
            let submitting = false;

            if (currentMode === 'profile' && currentAuthUser) {
                const userEmail = currentAuthUser.email || '';
                modalContent.innerHTML = `
                    <button type="button" class="close-modal" aria-label="إغلاق">&times;</button>
                    <div class="auth-modal-header">
                        <div class="auth-icon"><i class="fa-solid fa-user-check" aria-hidden="true"></i></div>
                        <h3 id="auth-modal-title">حسابي</h3>
                    </div>
                    <div class="auth-modal-body">
                        <div class="auth-field-group">
                            <label>البريد الإلكتروني</label>
                            <div class="auth-email-display">${escapeHtml(userEmail)}</div>
                        </div>
                        <div id="auth-alert" class="auth-alert hidden" role="status" aria-live="polite" aria-atomic="true"></div>
                        <div class="auth-actions">
                            <button type="button" id="auth-logout-btn" class="btn btn-primary width-full">
                                <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i> تسجيل الخروج
                            </button>
                        </div>
                    </div>
                `;

                modalContent.querySelector('.close-modal').addEventListener('click', closeAuthModal);
                if (hayyizStorage.accountId && hayyizStorage.guestSnapshot) {
                    const device = hayyizStorage.guestSnapshot();
                    const hasData = ['hayyiz-todos', 'hayyiz-notes', 'hayyiz-habits', 'hayyiz-free-spaces-v1'].some(key => {
                        try { const value = JSON.parse(device[key] || 'null'); return Array.isArray(value) ? value.length > 0 : value && Array.isArray(value.spaces) && value.spaces.length > 0; }
                        catch (_) { return false; }
                    });
                    if (hasData) {
                        const link = document.createElement('a');
                        link.href = 'about.html#hayyiz-device-data-controls';
                        link.className = 'btn btn-outline width-full';
                        link.textContent = 'إضافة بيانات هذا الجهاز إلى حسابي';
                        modalContent.querySelector('.auth-actions').appendChild(link);
                    }
                }
                modalContent.querySelector('#auth-logout-btn').addEventListener('click', async () => {
                    const logoutBtn = modalContent.querySelector('#auth-logout-btn');
                    logoutBtn.disabled = true;
                    logoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> جاري تسجيل الخروج...';

                    try {
                        let result;
                        if (typeof hayyizSignOut === 'function') {
                            result = await hayyizSignOut();
                        } else if (typeof supabaseClient !== 'undefined' && supabaseClient.auth) {
                            result = await supabaseClient.auth.signOut();
                        }
                        if (result && result.error) throw result.error;
                        closeAuthModal();
                    } catch (e) {
                        showAuthAlert(formatAuthError(e), 'danger');
                        logoutBtn.disabled = false;
                        logoutBtn.innerHTML = '<i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i> تسجيل الخروج';
                    }
                });

            } else if (currentMode === 'signup') {
                modalContent.innerHTML = `
                    <button type="button" class="close-modal" aria-label="إغلاق">&times;</button>
                    <div class="auth-modal-header">
                        <div class="auth-icon"><i class="fa-solid fa-user-plus" aria-hidden="true"></i></div>
                        <h3 id="auth-modal-title">إنشاء حساب</h3>
                    </div>
                    <form id="auth-form" class="auth-form" novalidate>
                        <div id="auth-alert" class="auth-alert hidden" role="status" aria-live="polite" aria-atomic="true"></div>
                        <div class="auth-field-group">
                            <label for="auth-email">البريد الإلكتروني</label>
                            <input type="email" id="auth-email" class="auth-input" placeholder="name@example.com" required autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false">
                        </div>
                        <div class="auth-field-group">
                            <label for="auth-password">كلمة المرور</label>
                            <div class="auth-password-field">
                                <input type="password" id="auth-password" class="auth-input" placeholder="••••••••" required autocomplete="new-password">
                                <button type="button" class="auth-password-toggle" aria-controls="auth-password" aria-label="إظهار كلمة المرور" aria-pressed="false">إظهار</button>
                            </div>
                        </div>
                        <div class="auth-field-group">
                            <label for="auth-confirm-password">تأكيد كلمة المرور</label>
                            <div class="auth-password-field">
                                <input type="password" id="auth-confirm-password" class="auth-input" placeholder="••••••••" required autocomplete="new-password">
                                <button type="button" class="auth-password-toggle" aria-controls="auth-confirm-password" aria-label="إظهار تأكيد كلمة المرور" aria-pressed="false">إظهار</button>
                            </div>
                        </div>
                        <button type="submit" id="auth-submit-btn" class="btn btn-primary width-full">
                            <i class="fa-solid fa-user-plus" aria-hidden="true"></i> إنشاء الحساب
                        </button>
                    </form>
                    <div class="auth-modal-footer">
                        <span>لدي حساب؟</span>
                        <button type="button" id="switch-to-login" class="auth-switch-link">تسجيل الدخول</button>
                    </div>
                `;

                modalContent.querySelector('.close-modal').addEventListener('click', closeAuthModal);
                modalContent.querySelector('#switch-to-login').addEventListener('click', () => renderModalBody('login'));

                const form = modalContent.querySelector('#auth-form');
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    if (submitting) return;
                    hideAuthAlert();

                    const email = form.querySelector('#auth-email').value.trim();
                    const password = form.querySelector('#auth-password').value;
                    const confirmPassword = form.querySelector('#auth-confirm-password').value;

                    if (!validateEmail(form, email)) return;
                    if (!password) {
                        showFieldError(form.querySelector('#auth-password'), 'يرجى إدخال كلمة المرور.');
                        return;
                    }
                    if (password.length < 6) {
                        showFieldError(form.querySelector('#auth-password'), 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
                        return;
                    }
                    if (password !== confirmPassword) {
                        showFieldError(form.querySelector('#auth-confirm-password'), 'كلمات المرور غير متطابقة.');
                        return;
                    }

                    const submitBtn = form.querySelector('#auth-submit-btn');
                    const originalBtnHtml = submitBtn.innerHTML;
                    submitting = true;
                    form.setAttribute('aria-busy', 'true');
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> جاري إنشاء الحساب...';

                    try {
                        let res = null;
                        if (typeof hayyizSignUp === 'function') {
                            res = await hayyizSignUp(email, password);
                        } else if (typeof supabaseClient !== 'undefined' && supabaseClient.auth) {
                            res = await supabaseClient.auth.signUp({
                                email,
                                password,
                                options: {
                                    emailRedirectTo: 'https://hayyze.pages.dev/'
                                }
                            });
                        }

                        if (!res) throw new Error('تعذر تجهيز تسجيل الدخول. أعد المحاولة.');
                        if (res.error) {
                            showAuthAlert(formatAuthError(res.error), 'danger');
                            restoreSubmitButton(submitBtn, originalBtnHtml, res.error);
                        } else {
                            if (res && res.data && res.data.session) {
                                closeAuthModal();
                                if (typeof hayyizSyncAllUserData === 'function') {
                                    hayyizSyncAllUserData();
                                }
                            } else {
                                showAuthAlert('تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيد الحساب.', 'success');
                                form.reset();
                                applyButtonCooldown(submitBtn, originalBtnHtml);
                            }
                        }
                    } catch (err) {
                        showAuthAlert(formatAuthError(err), 'danger');
                        restoreSubmitButton(submitBtn, originalBtnHtml, err);
                    } finally {
                        submitting = false;
                        form.setAttribute('aria-busy', 'false');
                    }
                });

            } else {
                // login mode (default)
                modalContent.innerHTML = `
                    <button type="button" class="close-modal" aria-label="إغلاق">&times;</button>
                    <div class="auth-modal-header">
                        <div class="auth-icon"><i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i></div>
                        <h3 id="auth-modal-title">تسجيل الدخول</h3>
                    </div>
                    <form id="auth-form" class="auth-form" novalidate>
                        <div id="auth-alert" class="auth-alert hidden" role="status" aria-live="polite" aria-atomic="true"></div>
                        <div class="auth-field-group">
                            <label for="auth-email">البريد الإلكتروني</label>
                            <input type="email" id="auth-email" class="auth-input" placeholder="name@example.com" required autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false">
                        </div>
                        <div class="auth-field-group">
                            <label for="auth-password">كلمة المرور</label>
                            <div class="auth-password-field">
                                <input type="password" id="auth-password" class="auth-input" placeholder="••••••••" required autocomplete="current-password">
                                <button type="button" class="auth-password-toggle" aria-controls="auth-password" aria-label="إظهار كلمة المرور" aria-pressed="false">إظهار</button>
                            </div>
                        </div>
                        <button type="submit" id="auth-submit-btn" class="btn btn-primary width-full">
                            <i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i> تسجيل الدخول
                        </button>
                    </form>
                    <div class="auth-modal-footer">
                        <span>ليس لديك حساب؟</span>
                        <button type="button" id="switch-to-signup" class="auth-switch-link">إنشاء حساب</button>
                    </div>
                `;

                modalContent.querySelector('.close-modal').addEventListener('click', closeAuthModal);
                modalContent.querySelector('#switch-to-signup').addEventListener('click', () => renderModalBody('signup'));

                const form = modalContent.querySelector('#auth-form');
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    if (submitting) return;
                    hideAuthAlert();

                    const email = form.querySelector('#auth-email').value.trim();
                    const password = form.querySelector('#auth-password').value;

                    if (!validateEmail(form, email)) return;
                    if (!password) {
                        showFieldError(form.querySelector('#auth-password'), 'يرجى إدخال كلمة المرور.');
                        return;
                    }

                    const submitBtn = form.querySelector('#auth-submit-btn');
                    const originalBtnHtml = submitBtn.innerHTML;
                    submitting = true;
                    form.setAttribute('aria-busy', 'true');
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> جاري تسجيل الدخول...';

                    try {
                        let res = null;
                        if (typeof hayyizSignIn === 'function') {
                            res = await hayyizSignIn(email, password);
                        } else if (typeof supabaseClient !== 'undefined' && supabaseClient.auth) {
                            res = await supabaseClient.auth.signInWithPassword({ email, password });
                        }

                        if (!res) throw new Error('تعذر تجهيز تسجيل الدخول. أعد المحاولة.');
                        if (res.error) {
                            showAuthAlert(formatAuthError(res.error), 'danger');
                            restoreSubmitButton(submitBtn, originalBtnHtml, res.error);
                        } else {
                            closeAuthModal();
                            if (typeof hayyizSyncAllUserData === 'function') {
                                hayyizSyncAllUserData();
                            }
                        }
                    } catch (err) {
                        showAuthAlert(formatAuthError(err), 'danger');
                        restoreSubmitButton(submitBtn, originalBtnHtml, err);
                    } finally {
                        submitting = false;
                        form.setAttribute('aria-busy', 'false');
                    }
                });
            }

            const emailInput = modalContent.querySelector('#auth-email');
            if (emailInput) emailInput.value = emailValue;
            modalContent.querySelectorAll('.auth-password-toggle').forEach(button => {
                button.addEventListener('click', () => {
                    const input = modalContent.querySelector('#' + button.getAttribute('aria-controls'));
                    const reveal = input.type === 'password';
                    input.type = reveal ? 'text' : 'password';
                    button.textContent = reveal ? 'إخفاء' : 'إظهار';
                    button.setAttribute('aria-pressed', String(reveal));
                    button.setAttribute('aria-label', (reveal ? 'إخفاء ' : 'إظهار ') + (input.id === 'auth-confirm-password' ? 'تأكيد كلمة المرور' : 'كلمة المرور'));
                });
            });
            modalContent.querySelectorAll('input').forEach(input => {
                input.addEventListener('input', () => input.setAttribute('aria-invalid', 'false'));
            });
            const focusTarget = emailInput || modalContent.querySelector('.close-modal');
            if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
        }

        function showFieldError(input, message) {
            showAuthAlert(message, 'danger');
            input.setAttribute('aria-invalid', 'true');
            input.setAttribute('aria-describedby', 'auth-alert');
            if (typeof input.focus === 'function') input.focus();
        }

        function validateEmail(form, email) {
            const input = form.querySelector('#auth-email');
            if (!email) { showFieldError(input, 'يرجى إدخال البريد الإلكتروني.'); return false; }
            if (input.validity ? input.validity.typeMismatch : !/^[^\s@]+@[^\s@]+$/.test(email)) {
                showFieldError(input, 'يرجى إدخال بريد إلكتروني صحيح، مثل name@example.com.');
                return false;
            }
            return true;
        }

        function restoreSubmitButton(button, html, error) {
            if (formatAuthError(error).includes('تم تجاوز حد الطلبات')) {
                applyButtonCooldown(button, html);
            } else {
                button.disabled = false;
                button.innerHTML = html;
            }
        }

        function showAuthAlert(msg, type = 'danger') {
            const alertEl = modalContent.querySelector('#auth-alert');
            if (!alertEl) return;
            alertEl.className = `auth-alert auth-alert-${type}`;
            alertEl.textContent = msg;
            if (alertEl.classList && typeof alertEl.classList.remove === 'function') {
                alertEl.classList.remove('hidden');
            }
        }

        function hideAuthAlert() {
            const alertEl = modalContent.querySelector('#auth-alert');
            if (!alertEl) return;
            if (alertEl.classList && typeof alertEl.classList.add === 'function') {
                alertEl.classList.add('hidden');
            }
        }

        function escapeHtml(str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }
    }

    /**
     * تهيئة واجهة التوثيق ومستمع الحالة
     */
    function initAuthUI() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupAuth);
        } else {
            setupAuth();
        }
    }

    function setupAuth() {
        if (typeof initAuthListener === 'function') initAuthListener();
        updateNavAuthButton(null);
        const attachedClients = new WeakSet();
        let authRenderEpoch = 0;

        const applyClientAuth = (client) => {
            if (!client || !client.auth || attachedClients.has(client)) return;
            attachedClients.add(client);
            const epoch = authRenderEpoch;
            client.auth.getUser().then(({ data, error }) => {
                if (epoch !== authRenderEpoch) return;
                if (!error && data && data.user) {
                    updateNavAuthButton(data.user);
                } else {
                    updateNavAuthButton(null);
                }
            }).catch(() => {
                if (epoch !== authRenderEpoch) return;
                updateNavAuthButton(null);
            });

            if (!window.__hayyizAuthUIListenerRegistered) {
                window.__hayyizAuthUIListenerRegistered = true;
                client.auth.onAuthStateChange((event, session) => {
                    authRenderEpoch++;
                    const user = session ? session.user : null;
                    updateNavAuthButton(user);

                    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
                        if (user && typeof hayyizSyncAllUserData === 'function') {
                            hayyizSyncAllUserData();
                        }
                    }
                });
            }
        };

        if (typeof window.addEventListener === 'function') {
            window.addEventListener('hayyiz:supabase-ready', event => applyClientAuth(event.detail));
        }

        if (typeof hasSavedSupabaseSession === 'function' && hasSavedSupabaseSession()) {
            if (typeof ensureSupabaseLoaded === 'function') {
                ensureSupabaseLoaded().then(applyClientAuth).catch(() => updateNavAuthButton(null));
            }
        } else if (typeof window !== 'undefined' && window.supabaseClient && window.supabaseClient.auth) {
            applyClientAuth(window.supabaseClient);
        }
    }

    // بدء التشغيل تلقائياً عند استيراد السكريبت
    initAuthUI();

    // تصدير الواجهات العامة
    global.hayyizOpenAuthModal = openAuthModal;
    global.hayyizCloseAuthModal = closeAuthModal;
    global.hayyizUpdateNavAuthButton = updateNavAuthButton;
    global.formatAuthError = formatAuthError;

})(typeof window !== 'undefined' ? window : global);
