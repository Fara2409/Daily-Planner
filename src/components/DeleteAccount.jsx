// Окно «Удалить аккаунт»: чтобы не удалить случайно, нужно вписать слово DELETE.
import { useState } from 'react';
import { supabase, signOut } from '../lib/supabase.js';
import { disablePush } from '../lib/push.js';

const WORD = 'DELETE';

export default function DeleteAccount({ t, onClose }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const remove = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { error } = await supabase.functions.invoke('delete-account', { body: { confirm: WORD } });
      if (error) throw error;
      try {
        await disablePush(); // отписать это устройство от уведомлений
      } catch {
        /* аккаунт уже удалён — это не критично */
      }
      await signOut();
    } catch (err) {
      console.error(err);
      setError(t('deleteError'));
      setBusy(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={busy ? undefined : onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={remove}>
        <h2>{t('deleteTitle')}</h2>
        <p className="danger-text">{t('deleteWarning')}</p>
        <label>
          {t('deleteType').replace('{word}', WORD)}
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder={WORD}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="sheet__actions">
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose} disabled={busy}>{t('cancel')}</button>
          <button className="btn btn--danger-fill" disabled={busy || typed.trim().toUpperCase() !== WORD}>
            {busy ? t('loading') : t('deleteBtn')}
          </button>
        </div>
      </form>
    </div>
  );
}
