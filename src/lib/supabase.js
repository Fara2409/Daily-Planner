// Подключение к серверу Supabase.
//
// Оба значения ПУБЛИЧНЫЕ — их можно держать в коде и на GitHub:
// - адрес проекта;
// - publishable key (sb_publishable_...) — он только «представляет» приложение.
// Что кому можно читать и менять, решают правила RLS в базе данных.
//
// СЕКРЕТНЫЙ ключ (sb_secret_...) сюда никогда не кладём.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jwjnxxbcjpxcdcceloel.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_J4NaMfZJyQpyrabQjG35yw_qhUPkBrt';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,      // помнить вход после закрытия приложения
    autoRefreshToken: true,    // продлевать вход автоматически
    detectSessionInUrl: true,  // подхватить вход, когда Google вернёт человека обратно
    flowType: 'pkce',          // безопасный способ входа для веб-приложений
  },
});

// Вход через Google. После выбора аккаунта Google вернёт человека на этот же адрес.
export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + import.meta.env.BASE_URL,
      queryParams: { prompt: 'select_account' }, // всегда предлагать выбрать аккаунт
    },
  });
}

export const signOut = () => supabase.auth.signOut();

// ---------- Вход по email и паролю ----------
// Подтверждение почты и сброс пароля работают через 6-значный КОД из письма,
// а не через ссылку: на iPhone ссылка открылась бы в Safari, а не в приложении.

export const signInWithPassword = (email, password) =>
  supabase.auth.signInWithPassword({ email, password });

export const signUp = (email, password) => supabase.auth.signUp({ email, password });

export const resendSignupCode = (email) => supabase.auth.resend({ type: 'signup', email });

// Подтверждение регистрации кодом. Тип 'email' — современный, 'signup' — старый вариант.
export async function verifySignupCode(email, token) {
  let res = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (res.error) res = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
  return res;
}

export const sendResetCode = (email) => supabase.auth.resetPasswordForEmail(email);

// Сброс пароля: код из письма → временный вход → установка нового пароля.
export async function resetPassword(email, token, password) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
  if (error) return { error };
  return supabase.auth.updateUser({ password });
}
