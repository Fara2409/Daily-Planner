// Главный экран: шапка, переключатель Неделя/Месяц, календарь и кнопка «+».
import { useEffect, useState } from 'react';
import DayCard from './components/DayCard.jsx';
import MonthGrid from './components/MonthGrid.jsx';
import TaskForm from './components/TaskForm.jsx';
import { addDays, addMonths, fromISO, todayISO, toISO, weekDays } from './lib/dates.js';
import { occursOn, isDone } from './lib/recurrence.js';
import { loadTasks, saveTasks, newTask, getSetting, setSetting } from './lib/storage.js';
import { LANGS, detectLang, translator, dateNames } from './lib/i18n.js';

// Сортировка: сначала дела со временем (по времени), потом без времени.
const byTime = (a, b) => (a.time || '99').localeCompare(b.time || '99');

export default function App() {
  const [lang, setLang] = useState(detectLang);
  const [view, setView] = useState(() => getSetting('view', 'week'));
  const [cursor, setCursor] = useState(() => new Date()); // какую неделю/месяц показываем
  const [selected, setSelected] = useState(todayISO);      // выбранный день в режиме «Месяц»
  const [tasks, setTasks] = useState(loadTasks);
  const [editing, setEditing] = useState(null);            // { task, isNew } или null

  const t = translator(lang);
  const names = dateNames(lang);
  const today = todayISO();

  useEffect(() => saveTasks(tasks), [tasks]);
  useEffect(() => { setSetting('view', view); }, [view]);
  useEffect(() => {
    setSetting('lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const tasksOn = (iso) => tasks.filter((task) => occursOn(task, iso)).sort(byTime);

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
    setEditing(null);
  };

  const remove = (id) => {
    if (!window.confirm(t('deleteConfirm'))) return;
    setTasks((prev) => prev.filter((x) => x.id !== id));
    setEditing(null);
  };

  const toggleDone = (task, iso) => {
    const doneDates = isDone(task, iso)
      ? task.doneDates.filter((d) => d !== iso)
      : [...(task.doneDates ?? []), iso];
    setTasks((prev) => prev.map((x) => (x.id === task.id ? { ...x, doneDates } : x)));
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
        <div className="lang">
          {Object.entries(LANGS).map(([code, label]) => (
            <button
              key={code}
              className={code === lang ? 'is-active' : ''}
              onClick={() => setLang(code)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <nav className="toolbar">
        <div className="segmented">
          <button className={view === 'week' ? 'is-active' : ''} onClick={() => setView('week')}>
            {t('week')}
          </button>
          <button className={view === 'month' ? 'is-active' : ''} onClick={() => setView('month')}>
            {t('month')}
          </button>
        </div>
        <button className="btn btn--small" onClick={goToday}>{t('today')}</button>
      </nav>

      <div className="period">
        <button className="icon-btn" onClick={() => move(-1)} aria-label={t('prev')}>‹</button>
        <h2>{periodTitle}</h2>
        <button className="icon-btn" onClick={() => move(1)} aria-label={t('next')}>›</button>
      </div>

      <main className="content">
        {view === 'week' ? (
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

      <button
        className="fab"
        onClick={() => openNew(view === 'month' ? selected : today)}
        aria-label={t('add')}
      >
        +
      </button>

      {editing && (
        <TaskForm
          task={editing.task}
          isNew={editing.isNew}
          t={t}
          onSave={save}
          onDelete={remove}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
