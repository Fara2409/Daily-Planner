// Планировщик: шапка, переключатель Неделя/Месяц, календарь и кнопка «+».
// Дела хранятся на сервере Supabase; на экране мы сразу показываем изменение,
// а сохранение идёт в фоне (если не удалось — показываем ошибку и перезагружаем).
import { useCallback, useEffect, useState } from 'react';
import DayCard from './components/DayCard.jsx';
import MonthGrid from './components/MonthGrid.jsx';
import TaskForm from './components/TaskForm.jsx';
import LangSwitch from './components/LangSwitch.jsx';
import VoiceButton from './components/VoiceButton.jsx';
import NotificationsCard from './components/NotificationsCard.jsx';
import Agenda from './components/Agenda.jsx';
import DeleteAccount from './components/DeleteAccount.jsx';
import { addDays, addMonths, fromISO, todayISO, toISO, weekDays } from './lib/dates.js';
import { occursOn, isDone } from './lib/recurrence.js';
import { newTask, getSetting, setSetting, loadLocalTasks, clearLocalTasks } from './lib/storage.js';
import { dateNames } from './lib/i18n.js';
import * as api from './lib/api.js';
import { signOut } from './lib/supabase.js';

// Сортировка: сначала дела со временем (по времени), потом без времени.
const byTime = (a, b) => (a.time || '99').localeCompare(b.time || '99');

export default function Planner({ user, lang, setLang, t }) {
  const [view, setView] = useState(() => getSetting('view', 'week'));
  const [cursor, setCursor] = useState(() => new Date()); // какую неделю/месяц показываем
  const [selected, setSelected] = useState(todayISO);      // выбранный день в режиме «Месяц»
  const [tasks, setTasks] = useState(null);                // null = ещё загружаем
  const [editing, setEditing] = useState(null);            // { task, isNew } или null
  const [voiceQueue, setVoiceQueue] = useState([]);        // дела, распознанные голосом, ждут проверки
  const [voiceInfo, setVoiceInfo] = useState(null);        // { transcript, total } для подписи в форме
  const [error, setError] = useState(''); // ключ перевода ошибки, например 'errorSave'
  const [deleting, setDeleting] = useState(false);          // открыто окно «Удалить аккаунт»

  const names = dateNames(lang);
  const today = todayISO();

  useEffect(() => { setSetting('view', view); }, [view]);

  // --- загрузка дел с сервера ---
  const load = useCallback(async () => {
    setError('');
    try {
      // Дела, созданные на этапе 1 (только на этом телефоне), один раз переносим на сервер.
      const local = loadLocalTasks();
      if (local.length) {
        await api.saveTasks(local);
        clearLocalTasks();
      }
      setTasks(await api.fetchTasks());
    } catch (e) {
      console.error(e);
      setError('errorLoad');
      setTasks((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Выполнить сохранение в фоне; при ошибке — сообщить и вернуть данные с сервера.
  const sync = async (request) => {
    try {
      await request;
    } catch (e) {
      console.error(e);
      setError('errorSave');
      load();
    }
  };

  const list = tasks ?? [];
  const tasksOn = (iso) => list.filter((task) => occursOn(task, iso)).sort(byTime);

  // --- навигация ---
  const move = (dir) =>
    setCursor(view === 'week' ? addDays(cursor, 7 * dir) : addMonths(cursor, dir));

  const goToday = () => {
    setCursor(new Date());
    setSelected(today);
  };

  const selectDay = (iso) => {
    setSelected(iso);
    const d = fromISO(iso);
    if (d.getMonth() !== cursor.getMonth()) setCursor(d); // нажали на день соседнего месяца
  };

  // --- действия с делами ---
  const openNew = (iso) => setEditing({ task: newTask(iso), isNew: true });
  const openEdit = (task) => setEditing({ task, isNew: false });

  const save = (task) => {
    setTasks((prev) =>
      prev.some((x) => x.id === task.id) ? prev.map((x) => (x.id === task.id ? task : x)) : [...prev, task]
    );
    closeForm();
    sync(api.saveTask(task));
  };

  const remove = (id) => {
    if (!window.confirm(t('deleteConfirm'))) return;
    setTasks((prev) => prev.filter((x) => x.id !== id));
    setEditing(null);
    sync(api.deleteTask(id));
  };

  const toggleDone = (task, iso) => {
    const doneDates = isDone(task, iso)
      ? task.doneDates.filter((d) => d !== iso)
      : [...(task.doneDates ?? []), iso];
    const updated = { ...task, doneDates };
    setTasks((prev) => prev.map((x) => (x.id === task.id ? updated : x)));
    sync(api.saveTask(updated));
  };

  // --- голосовой ввод ---
  // ИИ вернул список дел → показываем их по одному в форме, человек проверяет и сохраняет.
  const openVoiceTask = (queue, total, transcript) => {
    if (!queue.length) {
      setVoiceInfo(null);
      return setEditing(null);
    }
    const [first, ...rest] = queue;
    setVoiceQueue(rest);
    setVoiceInfo({ transcript, total, n: total - rest.length });
    setEditing({ task: { ...newTask(first.date), ...first }, isNew: true });
    setView('week');
    setCursor(fromISO(first.date)); // показать неделю этого дела
    setSelected(first.date);
  };

  const onVoiceResult = (res) => {
    if (!res?.understood || !res.tasks?.length) return setError('v_not_understood');
    setError('');
    openVoiceTask(res.tasks, res.tasks.length, res.transcript);
  };

  const onVoiceError = (code) => setError(`v_${code}`);

  // После сохранения/закрытия формы — открыть следующее распознанное дело, если есть.
  const closeForm = () => {
    if (voiceQueue.length) openVoiceTask(voiceQueue, voiceInfo.total, voiceInfo.transcript);
    else {
      setEditing(null);
      setVoiceInfo(null);
    }
  };

  const logout = () => {
    if (window.confirm(t('signOutConfirm'))) signOut();
  };

  // --- заголовок периода ---
  const days = weekDays(cursor);
  const periodTitle =
    view === 'week'
      ? `${names.dayMonthShort(days[0])} – ${names.dayMonthShort(days[6])} ${days[6].getFullYear()}`
      : names.monthYear(cursor);

  const dayProps = { names, t, onAdd: openNew, onEdit: openEdit, onToggle: toggleDone };

  return (
    <div className="app">
      <header className="topbar">
        <h1>Daily Planner</h1>
        <LangSwitch lang={lang} onChange={setLang} />
      </header>

      <nav className="toolbar">
        <div className="segmented">
          <button className={view === 'week' ? 'is-active' : ''} onClick={() => setView('week')}>
            {t('week')}
          </button>
          <button className={view === 'month' ? 'is-active' : ''} onClick={() => setView('month')}>
            {t('month')}
          </button>
          <button className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}>
            {t('list')}
          </button>
        </div>
        <button className="btn btn--small" onClick={goToday}>{t('today')}</button>
      </nav>

      {view !== 'list' && <div className="period">
        <button className="icon-btn" onClick={() => move(-1)} aria-label={t('prev')}>‹</button>
        <h2>{periodTitle}</h2>
        <button className="icon-btn" onClick={() => move(1)} aria-label={t('next')}>›</button>
      </div>}

      {error && (
        <div className="banner" role="alert">
          <span>{t(error)}</span>
          {error === 'errorLoad' || error === 'errorSave' ? (
            <button className="btn btn--small" onClick={load}>{t('retry')}</button>
          ) : (
            <button className="icon-btn" onClick={() => setError('')} aria-label="OK">×</button>
          )}
        </div>
      )}

      <NotificationsCard t={t} lang={lang} />

      <main className="content">
        {tasks === null ? (
          <p className="day-card__empty">{t('loading')}</p>
        ) : view === 'list' ? (
          <Agenda tasks={list} today={today} names={names} t={t} byTime={byTime} dayProps={dayProps} />
        ) : view === 'week' ? (
          days.map((d) => {
            const iso = toISO(d);
            return <DayCard key={iso} iso={iso} tasks={tasksOn(iso)} isToday={iso === today} {...dayProps} />;
          })
        ) : (
          <>
            <MonthGrid
              cursor={cursor}
              selected={selected}
              today={today}
              names={names}
              countOn={(iso) => tasksOn(iso).length}
              onSelect={selectDay}
            />
            <DayCard iso={selected} tasks={tasksOn(selected)} isToday={selected === today} {...dayProps} />
          </>
        )}
      </main>

      <footer className="account">
        <span>{user.email}</span>
        <button className="link-btn" onClick={logout}>{t('signOut')}</button>
        <button className="link-btn link-btn--danger" onClick={() => setDeleting(true)}>{t('deleteAccount')}</button>
      </footer>

      {deleting && <DeleteAccount t={t} onClose={() => setDeleting(false)} />}

      <div className="actions">
        <VoiceButton t={t} onResult={onVoiceResult} onError={onVoiceError} />
        <button
          className="fab"
          onClick={() => openNew(view === 'month' ? selected : today)}
          aria-label={t('add')}
        >
          +
        </button>
      </div>

      {editing && (
        <TaskForm
          key={editing.task.id}
          task={editing.task}
          isNew={editing.isNew}
          t={t}
          onSave={save}
          onDelete={remove}
          onClose={closeForm}
          heard={voiceInfo?.transcript}
          counter={voiceInfo && voiceInfo.total > 1
            ? t('voiceCount').replace('{n}', voiceInfo.n).replace('{total}', voiceInfo.total)
            : null}
        />
      )}
    </div>
  );
}
