const SUPABASE_URL = 'https://dzfdbjnqtgltuguqqdkz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_zXE2LbHMIAiTFjrYTyb7GA_zrHGa1rv';

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

// إنشاء حساب جديد عبر Supabase Auth مباشرة (الاعتماد على حدود Supabase Auth الأصلية من جهة الخادم)
async function hayyizSignUp(email, password) {
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
