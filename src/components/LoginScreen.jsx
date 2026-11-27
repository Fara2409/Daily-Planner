// Экран входа: Google или email + пароль.
// Режимы (mode):
//   signIn  — вход по email и паролю
//   signUp  — регистрация
//   verify  — ввод кода из письма после регистрации
//   forgot  — запрос кода для сброса пароля
//   reset   — ввод кода и нового пароля
import { useState } from 'react';
import LangSwitch from './LangSwitch.jsx';
import {
  signInWithGoogle,
  signInWithPassword,
  signUp,
  resendSignupCode,
  verifySignupCode,
  sendResetCode,
  resetPassword,
} from '../lib/supabase.js';

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
  </svg>
);

// Ошибку Supabase превращаем в понятный текст на нужном языке.
const KNOWN = [
  'invalid_credentials', 'user_already_exists', 'weak_password', 'otp_expired',
  'over_email_send_rate_limit', 'over_request_rate_limit', 'email_address_invalid',
];
const errorKey = (error) => {
  if (KNOWN.includes(error?.code)) return `err_${error.code}`;
  if (error?.code === 'email_exists') return 'err_user_already_exists';
  if (error?.code === 'otp_disabled' || error?.code === 'invalid_otp') return 'err_otp_expired';
  return 'err_generic';
};

export default function LoginScreen({ lang, setLang, t, onHold }) {
  const [mode, setMode] = useState('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const go = (next) => {
    setMode(next);
    setError('');
    setInfo('');
    setCode('');
  };

  // Общая обёртка: показать «загрузку», поймать ошибку.
  const run = async (fn) => {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await fn();
    } catch (e) {
      console.error(e);
      setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  };
  const check = ({ error }) => { if (error) throw error; };

  const google = () => run(async () => check(await signInWithGoogle()));

  const submit = (e) => {
    e.preventDefault();
    const mail = email.trim().toLowerCase();

    if (mode === 'signIn') {
      return run(async () => {
        const { error } = await signInWithPassword(mail, password);
        if (error?.code === 'email_not_confirmed') {
          await resendSignupCode(mail);
          return go('verify');
        }
        check({ error });
      });
    }

    if (mode === 'signUp') {
      return run(async () => {
        const { data, error } = await signUp(mail, password);
        check({ error });
        // Supabase не сообщает прямо, что email уже занят (защита от перебора адресов),
        // но в этом случае у пользователя нет ни одной «личности».
        if (data.user && data.user.identities?.length === 0) {
          throw { code: 'user_already_exists' };
        }
        go('verify');
      });
    }

    if (mode === 'verify') {
      return run(async () => check(await verifySignupCode(mail, code.trim())));
    }

    if (mode === 'forgot') {
      return run(async () => {
        check(await sendResetCode(mail));
        go('reset');
      });
    }

    if (mode === 'reset') {
      // Пока меняем пароль, не даём приложению сразу переключиться на планировщик.
      return run(async () => {
        onHold(true);
        try {
          check(await resetPassword(mail, code.trim(), password));
        } finally {
          onHold(false);
        }
      });
    }
  };

  const resend = () =>
    run(async () => {
      check(mode === 'reset' ? await sendResetCode(email) : await resendSignupCode(email));
      setInfo(t('resent'));
    });

  const needsPassword = mode === 'signIn' || mode === 'signUp' || mode === 'reset';
  const needsCode = mode === 'verify' || mode === 'reset';
  const emailLocked = needsCode;

  const title = {
    signIn: null,
    signUp: t('toSignUp'),
    verify: t('verifyTitle'),
    forgot: t('forgotTitle'),
    reset: t('forgotTitle'),
  }[mode];

  const submitLabel = {
    signIn: t('signInBtn'),
    signUp: t('signUpBtn'),
    verify: t('confirm'),
    forgot: t('sendCode'),
    reset: t('savePassword'),
  }[mode];

  return (
    <div className="login">
      <div className="login__top">
        <LangSwitch lang={lang} onChange={setLang} />
      </div>

      <div className="login__card">
        <img className="login__logo" src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" />
        <h1>Daily Planner</h1>
        <p className="login__tagline">{t('tagline')}</p>

        {mode === 'signIn' && (
          <>
            <button className="google-btn" onClick={google} disabled={busy}>
              <GoogleIcon />
              <span>{t('signIn')}</span>
            </button>
            <div className="divider"><span>{t('or')}</span></div>
          </>
        )}

        {title && <h2 className="login__title">{title}</h2>}
        {needsCode && <p className="login__text">{t('codeSent').replace('{email}', email)}</p>}

        <form className="login__form" onSubmit={submit}>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={t('email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={emailLocked}
            required
          />

          {needsCode && (
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={t('code')}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
              pattern="[0-9]{6,10}"
              required
            />
          )}

          {needsPassword && (
            <div className="password">
              <input
                type={showPass ? 'text' : 'password'}
                autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                placeholder={mode === 'reset' ? t('newPassword') : t('password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={mode === 'signIn' ? undefined : 8}
                required
              />
              <button type="button" className="link-btn" onClick={() => setShowPass(!showPass)}>
                {showPass ? t('hide') : t('show')}
              </button>
            </div>
          )}
          {(mode === 'signUp' || mode === 'reset') && <p className="hint">{t('passwordHint')}</p>}

          {error && <p className="form-error">{error}</p>}
          {info && <p className="hint">{info}</p>}

          <button className="btn btn--primary btn--block" disabled={busy}>
            {busy ? t('loading') : submitLabel}
          </button>
        </form>

        <div className="login__links">
          {mode === 'signIn' && (
            <>
              <button className="link-btn" onClick={() => go('forgot')}>{t('forgot')}</button>
              <p>{t('noAccount')} <button className="link-btn" onClick={() => go('signUp')}>{t('toSignUp')}</button></p>
            </>
          )}
          {mode === 'signUp' && (
            <p>{t('haveAccount')} <button className="link-btn" onClick={() => go('signIn')}>{t('toSignIn')}</button></p>
          )}
          {needsCode && (
            <button className="link-btn" onClick={resend} disabled={busy}>{t('resend')}</button>
          )}
          {mode !== 'signIn' && mode !== 'signUp' && (
            <button className="link-btn" onClick={() => go('signIn')}>{t('back')}</button>
          )}
        </div>

        {mode === 'signIn' && <p className="login__note">{t('signInNote')}</p>}
      </div>
    </div>
  );
}
