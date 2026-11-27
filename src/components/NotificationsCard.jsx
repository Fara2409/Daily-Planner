// Карточка «Уведомления»: включить / выключить push на этом устройстве.
import { useEffect, useState } from 'react';
import { getPushState, enablePush, disablePush, refreshPush } from '../lib/push.js';

export default function NotificationsCard({ t, lang }) {
  const [state, setState] = useState(null); // null = ещё проверяем
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getPushState().then(setState).catch(() => setState('unsupported'));
  }, []);

  useEffect(() => {
    refreshPush(lang);
  }, [lang]);

  if (state === null || state === 'unsupported') return null;

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      setState(await fn());
    } catch (e) {
      console.error(e);
      // Показываем и техническую причину — на телефоне нет консоли, иначе не понять, что сломалось.
      const detail = [e?.name, e?.code, e?.message].filter(Boolean).join(': ');
      setError(`${t('pushError')}${detail ? ` (${detail})` : ''}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`notify notify--${state}`}>
      <div className="notify__text">
        <strong>🔔 {t('pushTitle')}</strong>
        <span>{t(`push_${state}`)}</span>
        {error && <span className="form-error">{error}</span>}
      </div>
      {state === 'off' && (
        <button className="btn btn--primary btn--small" disabled={busy} onClick={() => run(() => enablePush(lang))}>
          {t('pushEnable')}
        </button>
      )}
      {state === 'on' && (
        <button className="link-btn" disabled={busy} onClick={() => run(disablePush)}>
          {t('pushDisable')}
        </button>
      )}
    </section>
  );
}
