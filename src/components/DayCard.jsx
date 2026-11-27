// Карточка одного дня: заголовок и список дел.
import { fromISO } from '../lib/dates.js';
import { isDone } from '../lib/recurrence.js';

export default function DayCard({ iso, tasks, isToday, names, t, onAdd, onEdit, onToggle, label, overdue }) {
  const date = fromISO(iso);

  return (
    <section className={`day-card${isToday ? ' is-today' : ''}${overdue ? ' is-overdue' : ''}`}>
      <header className="day-card__head">
        <div>
          <span className="day-card__weekday">{label ?? names.weekday(date)}</span>
          <span className="day-card__date">{names.dayMonth(date)}</span>
        </div>
        <button className="icon-btn" onClick={() => onAdd(iso)} aria-label={t('add')}>
          +
        </button>
      </header>

      {tasks.length === 0 ? (
        <p className="day-card__empty">{t('empty')}</p>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => {
            const done = isDone(task, iso);
            return (
              <li key={task.id} className={`task${done ? ' is-done' : ''}`}>
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => onToggle(task, iso)}
                  aria-label={task.title}
                />
                <button className="task__body" onClick={() => onEdit(task)}>
                  <span className="task__title">{task.title}</span>
                  <span className="task__meta">
                    {task.time && <span>{task.time}</span>}
                    {task.remindAt && <span title={t('remind')}>🔔</span>}
                    {task.repeat && <span title={t(task.repeat)}>↻ {t(task.repeat)}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
