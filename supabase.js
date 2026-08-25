const SUPABASE_URL = 'https://dzfdbjnqtgltuguqqdkz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_zXE2LbHMIAiTFjrYTyb7GA_zrHGa1rv';

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

// فحص الخادم للـ IP Rate Limit قبل الحسابات الجديدة والبريد
async function hayyizCheckIpRateLimit(actionType = 'signup', maxAttempts = 1, windowSeconds = 600) {
    if (!supabaseClient || !supabaseClient.rpc) {
        return { allowed: true };
    }
    try {
        const { data, error } = await supabaseClient.rpc('check_ip_rate_limit', {
            action_type: actionType,
            max_attempts: maxAttempts,
            window_seconds: windowSeconds
        });
        if (error) {
            console.warn('[Supabase Security] Rate limit RPC warning:', error.message);
            return { allowed: true };
        }
        return data || { allowed: true };
    } catch (e) {
        console.warn('[Supabase Security] Rate limit RPC exception:', e);
        return { allowed: true };
    }
}

// إنشاء حساب جديد
async function hayyizSignUp(email, password) {
    // 1. فحص حماية IP من جهة الخادم عبر Database-backed RPC
    const rateCheck = await hayyizCheckIpRateLimit('signup', 1, 600);
    if (rateCheck && rateCheck.allowed === false) {
        return {
            data: { user: null, session: null },
            error: {
                message: 'rate_limit_exceeded',
                status: 429,
                code: 'over_email_send_rate_limit'
            }
        };
    }

    // 2. إرسال الطلب الأصلي لـ Supabase Auth
    return await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: 'https://just-c.github.io/adawati/'
        }
    });
}

// تسجيل الدخول
async function hayyizSignIn(email, password) {
    return await supabaseClient.auth.signInWithPassword({
        email,
        password
    });
}

// تسجيل الخروج
async function hayyizSignOut() {
    return await supabaseClient.auth.signOut();
}

// الحصول على المستخدم الحالي
async function hayyizGetUser() {
    const { data, error } = await supabaseClient.auth.getUser();

    if (error) {
        return null;
    }

    return data.user;
}
