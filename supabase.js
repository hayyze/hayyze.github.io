const SUPABASE_URL = 'https://dzfdbjnqtgltuguqqdkz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_zXE2LbHMIAiTFjrYTyb7GA_zrHGa1rv';

let supabaseClient = (typeof window !== 'undefined' && window.supabaseClient) || null;
let supabaseLoadingPromise = null;

function ensureSupabaseLoaded() {
    if (supabaseClient) {
        return Promise.resolve(supabaseClient);
    }
    if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
        window.supabaseClient = supabaseClient;
        return Promise.resolve(supabaseClient);
    }
    if (supabaseLoadingPromise) {
        return supabaseLoadingPromise;
    }

    supabaseLoadingPromise = new Promise((resolve, reject) => {
        if (typeof document === 'undefined') {
            return reject(new Error('Document unavailable'));
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.onload = () => {
            if (window.supabase && typeof window.supabase.createClient === 'function') {
                supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
                window.supabaseClient = supabaseClient;
                resolve(supabaseClient);
            } else {
                reject(new Error('Supabase failed to initialize'));
            }
        };
        script.onerror = (err) => reject(err);
        document.head.appendChild(script);
    });

    return supabaseLoadingPromise;
}

if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    window.supabaseClient = supabaseClient;
}

// إنشاء حساب جديد عبر Supabase Auth مباشرة
async function hayyizSignUp(email, password) {
    const client = await ensureSupabaseLoaded();
    return await client.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: 'https://hayyze.github.io/'
        }
    });
}

// تسجيل الدخول
async function hayyizSignIn(email, password) {
    const client = await ensureSupabaseLoaded();
    return await client.auth.signInWithPassword({
        email,
        password
    });
}

// تسجيل الخروج
async function hayyizSignOut() {
    const client = await ensureSupabaseLoaded();
    return await client.auth.signOut();
}

// الحصول على المستخدم الحالي
async function hayyizGetUser() {
    try {
        const client = await ensureSupabaseLoaded();
        const { data, error } = await client.auth.getUser();
        if (error) return null;
        return data.user;
    } catch (e) {
        return null;
    }
}

function hasSavedSupabaseSession() {
    try {
        if (typeof localStorage === 'undefined') return false;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                const val = localStorage.getItem(key);
                if (val && val.includes('access_token')) {
                    return true;
                }
            }
        }
    } catch (e) {}
    return false;
}

if (typeof window !== 'undefined') {
    window.ensureSupabaseLoaded = ensureSupabaseLoaded;
    window.hasSavedSupabaseSession = hasSavedSupabaseSession;
}
