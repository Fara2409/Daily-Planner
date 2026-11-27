// Окно добавления / изменения дела.
// На этапе 3 его будет заполнять ИИ после голосовой фразы, а человек только проверит.
import { useState } from 'react';
import { REPEATS } from '../lib/recurrence.js';
import { eveningBefore } from '../lib/dates.js';

export default function TaskForm({ task, isNew, t, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(task);
  const [error, setError] = useState('');

  const set = (field) => (e) => setDraft({ ...draft, [field]: e.target.value });

  const toggleReminder = (e) =>
    setDraft({ ...draft, remindAt: e.target.checked ? eveningBefore(draft.date) : '' });

  const submit = (e) => {
    e.preventDefault();
    if (!draft.title.trim()) return setError(t('titleRequired'));
    onSave({ ...draft, title: draft.title.trim(), notes: draft.notes.trim() });
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{isNew ? t('newTask') : t('editTask')}</h2>

        <label>
          {t('title')}
          <input
            autoFocus
            value={draft.title}
            onChange={(e) => { setError(''); set('title')(e); }}
            placeholder={t('titlePlaceholder')}
          />
        </label>
        {error && <p className="form-error">{error}</p>}

        <div className="row">
          <label>
            {t('date')}
            <input type="date" required value={draft.date} onChange={set('date')} />
          </label>
          <label>
            {t('time')}
            <input type="time" value={draft.time} onChange={set('time')} />
          </label>
        </div>

        <label>
          {t('repeat')}
          <select
            value={draft.repeat ?? ''}
            onChange={(e) => setDraft({ ...draft, repeat: e.target.value || null })}
          >
            <option value="">{t('repeatNone')}</option>
            {REPEATS.map((r) => <option key={r} value={r}>{t(r)}</option>)}
          </select>
        </label>

        <label className="check">
          <input type="checkbox" checked={!!draft.remindAt} onChange={toggleReminder} />
          {t('remind')}
        </label>
        {draft.remindAt && (
          <>
            <input type="datetime-local" value={draft.remindAt} onChange={set('remindAt')} />
            <p className="hint">{t('remindHint')}</p>
          </>
        )}

        <label>
          {t('notes')}
          <textarea rows={2} value={draft.notes} onChange={set('notes')} />
        </label>

        <div className="sheet__actions">
          {!isNew && (
            <button type="button" className="btn btn--danger" onClick={() => onDelete(draft.id)}>
              {t('delete')}
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>{t('cancel')}</button>
          <button type="submit" className="btn btn--primary">{t('save')}</button>
        </div>
      </form>
    </div>
  );
}
