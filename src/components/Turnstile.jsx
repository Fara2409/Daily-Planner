// Cloudflare Turnstile — проверка «вы не робот» перед входом и регистрацией по email.
// Обычно проходит сама за секунду, без картинок и кликов.
// Ключ сайта (site key) — публичный. Секретный ключ хранится только в Supabase.
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export const TURNSTILE_SITE_KEY = 'TURNSTILE_SITE_KEY_HERE';
export const captchaEnabled = !TURNSTILE_SITE_KEY.includes('HERE');

let scriptPromise = null;
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return scriptPromise;
}

// onToken(token | '') — вызывается, когда проверка пройдена (или токен истёк).
const Turnstile = forwardRef(function Turnstile({ lang, onToken }, ref) {
  const box = useRef(null);
  const widget = useRef(null);

  useImperativeHandle(ref, () => ({
    // Токен одноразовый: после каждой попытки входа берём новый.
    reset() {
      onToken('');
      if (widget.current != null) window.turnstile?.reset(widget.current);
    },
  }));

  useEffect(() => {
    if (!captchaEnabled) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !box.current) return;
        widget.current = window.turnstile.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          language: lang,
          appearance: 'interaction-only', // виджет показывается, только если нужна проверка
          callback: (token) => onToken(token),
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken(''),
        });
      })
      .catch(() => onToken(''));
    return () => {
      cancelled = true;
      if (widget.current != null) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  if (!captchaEnabled) return null;
  return <div ref={box} className="captcha" />;
});

export default Turnstile;
