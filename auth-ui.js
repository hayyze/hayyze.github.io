/**
 * auth-ui.js — واجهة المستخدم والمصادقة الخاصة بمنصة حيز عبر Supabase Auth
 * يتضمن ترجمة وتفسير أخطاء تجاوز الحدود (429 Rate Limiting) والتحكم بتبريد أزرار الواجهة (Cooldown UI)
 */

(function (global) {
    'use strict';

    let currentAuthUser = null;
    let submitCooldownTimer = null;
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
        }
    }

    /**
     * فتح نافذة التوثيق (تسجيل الدخول / إنشاء حساب / البروفايل)
     */
    function openAuthModal(mode = null) {
        closeAuthModal();

        const user = currentAuthUser;
        let currentMode = mode || (user ? 'profile' : 'login');

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'hayyiz-auth-modal';
        modalOverlay.className = 'modal auth-modal-overlay';
        modalOverlay.setAttribute('role', 'dialog');
        modalOverlay.setAttribute('aria-modal', 'true');

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
            currentMode = viewMode;

            if (currentMode === 'profile' && currentAuthUser) {
                const userEmail = currentAuthUser.email || '';
                modalContent.innerHTML = `
                    <button type="button" class="close-modal" aria-label="إغلاق">&times;</button>
                    <div class="auth-modal-header">
                        <div class="auth-icon"><i class="fa-solid fa-user-check" aria-hidden="true"></i></div>
                        <h3>حسابي</h3>
                    </div>
                    <div class="auth-modal-body">
                        <div class="auth-field-group">
                            <label>البريد الإلكتروني</label>
                            <div class="auth-email-display">${escapeHtml(userEmail)}</div>
                        </div>
                        <div id="auth-alert" class="auth-alert hidden"></div>
                        <div class="auth-actions">
                            <button type="button" id="auth-logout-btn" class="btn btn-primary width-full">
                                <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i> تسجيل الخروج
                            </button>
                        </div>
                    </div>
                `;

                modalContent.querySelector('.close-modal').addEventListener('click', closeAuthModal);
                modalContent.querySelector('#auth-logout-btn').addEventListener('click', async () => {
                    const logoutBtn = modalContent.querySelector('#auth-logout-btn');
                    logoutBtn.disabled = true;
                    logoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> جاري تسجيل الخروج...';

                    try {
                        if (typeof hayyizSignOut === 'function') {
                            await hayyizSignOut();
                        } else if (typeof supabaseClient !== 'undefined' && supabaseClient.auth) {
                            await supabaseClient.auth.signOut();
                        }
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
                        <h3>إنشاء حساب</h3>
                    </div>
                    <form id="auth-form" class="auth-form" novalidate>
                        <div id="auth-alert" class="auth-alert hidden"></div>
                        <div class="auth-field-group">
                            <label for="auth-email">البريد الإلكتروني</label>
                            <input type="email" id="auth-email" class="auth-input" placeholder="name@example.com" required autocomplete="email">
                        </div>
                        <div class="auth-field-group">
                            <label for="auth-password">كلمة المرور</label>
                            <input type="password" id="auth-password" class="auth-input" placeholder="••••••••" required autocomplete="new-password">
                        </div>
                        <div class="auth-field-group">
                            <label for="auth-confirm-password">تأكيد كلمة المرور</label>
                            <input type="password" id="auth-confirm-password" class="auth-input" placeholder="••••••••" required autocomplete="new-password">
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
                    hideAuthAlert();

                    const email = form.querySelector('#auth-email').value.trim();
                    const password = form.querySelector('#auth-password').value;
                    const confirmPassword = form.querySelector('#auth-confirm-password').value;

                    if (!email) {
                        showAuthAlert('يرجى إدخال البريد الإلكتروني.', 'danger');
                        return;
                    }
                    if (!password) {
                        showAuthAlert('يرجى إدخال كلمة المرور.', 'danger');
                        return;
                    }
                    if (password.length < 6) {
                        showAuthAlert('كلمة المرور يجب أن تكون 6 أحرف على الأقل.', 'danger');
                        return;
                    }
                    if (password !== confirmPassword) {
                        showAuthAlert('كلمات المرور غير متطابقة.', 'danger');
                        return;
                    }

                    const submitBtn = form.querySelector('#auth-submit-btn');
                    const originalBtnHtml = submitBtn.innerHTML;
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
                                    emailRedirectTo: 'https://hayyze.github.io/'
                                }
                            });
                        }

                        if (res && res.error) {
                            showAuthAlert(formatAuthError(res.error), 'danger');
                            applyButtonCooldown(submitBtn, originalBtnHtml);
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
                        applyButtonCooldown(submitBtn, originalBtnHtml);
                    }
                });

            } else {
                // login mode (default)
                modalContent.innerHTML = `
                    <button type="button" class="close-modal" aria-label="إغلاق">&times;</button>
                    <div class="auth-modal-header">
                        <div class="auth-icon"><i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i></div>
                        <h3>تسجيل الدخول</h3>
                    </div>
                    <form id="auth-form" class="auth-form" novalidate>
                        <div id="auth-alert" class="auth-alert hidden"></div>
                        <div class="auth-field-group">
                            <label for="auth-email">البريد الإلكتروني</label>
                            <input type="email" id="auth-email" class="auth-input" placeholder="name@example.com" required autocomplete="email">
                        </div>
                        <div class="auth-field-group">
                            <label for="auth-password">كلمة المرور</label>
                            <input type="password" id="auth-password" class="auth-input" placeholder="••••••••" required autocomplete="current-password">
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
                    hideAuthAlert();

                    const email = form.querySelector('#auth-email').value.trim();
                    const password = form.querySelector('#auth-password').value;

                    if (!email) {
                        showAuthAlert('يرجى إدخال البريد الإلكتروني.', 'danger');
                        return;
                    }
                    if (!password) {
                        showAuthAlert('يرجى إدخال كلمة المرور.', 'danger');
                        return;
                    }

                    const submitBtn = form.querySelector('#auth-submit-btn');
                    const originalBtnHtml = submitBtn.innerHTML;
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> جاري تسجيل الدخول...';

                    try {
                        let res = null;
                        if (typeof hayyizSignIn === 'function') {
                            res = await hayyizSignIn(email, password);
                        } else if (typeof supabaseClient !== 'undefined' && supabaseClient.auth) {
                            res = await supabaseClient.auth.signInWithPassword({ email, password });
                        }

                        if (res && res.error) {
                            showAuthAlert(formatAuthError(res.error), 'danger');
                            applyButtonCooldown(submitBtn, originalBtnHtml);
                        } else {
                            closeAuthModal();
                            if (typeof hayyizSyncAllUserData === 'function') {
                                hayyizSyncAllUserData();
                            }
                        }
                    } catch (err) {
                        showAuthAlert(formatAuthError(err), 'danger');
                        applyButtonCooldown(submitBtn, originalBtnHtml);
                    }
                });
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
        updateNavAuthButton(null);

        const applyClientAuth = (client) => {
            if (!client || !client.auth) return;
            client.auth.getUser().then(({ data, error }) => {
                if (!error && data && data.user) {
                    updateNavAuthButton(data.user);
                } else {
                    updateNavAuthButton(null);
                }
            }).catch(() => {
                updateNavAuthButton(null);
            });

            if (!window.__hayyizAuthUIListenerRegistered) {
                window.__hayyizAuthUIListenerRegistered = true;
                client.auth.onAuthStateChange((event, session) => {
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

        if (typeof ensureSupabaseLoaded === 'function') {
            ensureSupabaseLoaded().then(applyClientAuth).catch(() => updateNavAuthButton(null));
        } else if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.auth) {
            applyClientAuth(supabaseClient);
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
