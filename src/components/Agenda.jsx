// Вид «Список»: ближайшие дела на 30 дней вперёд + просроченные невыполненные.
// Показываем только дни, в которых есть дела.
import DayCard from './DayCard.jsx';
import { addDays, fromISO, toISO } from '../lib/dates.js';
import { occursOn, isDone } from '../lib/recurrence.js';

const DAYS_AHEAD = 30;
const DAYS_BACK = 14;

export default function Agenda({ tasks, today, names, t, byTime, dayProps }) {
  const start = fromISO(today);

  // Просроченные: разовые дела за последние 2 недели, которые не отмечены выполненными.
  const overdue = [];
  for (let i = DAYS_BACK; i >= 1; i--) {
    const iso = toISO(addDays(start, -i));
    const list = tasks.filter((x) => !x.repeat && x.date === iso && !isDone(x, iso)).sort(byTime);
    if (list.length) overdue.push({ iso, list });
  }

  // Ближайшие дни (повторяющиеся дела тоже разворачиваем по дням).
  const upcoming = [];
  for (let i = 0; i <= DAYS_AHEAD; i++) {
    const iso = toISO(addDays(start, i));
    const list = tasks.filter((x) => occursOn(x, iso)).sort(byTime);
    if (list.length) upcoming.push({ iso, list, i });
  }

  const label = (i, iso) =>
    i === 0 ? t('today') : i === 1 ? t('tomorrow') : names.weekday(fromISO(iso));

  return (
    <>
      {overdue.length > 0 && (
        <>
          <h3 className="agenda__title agenda__title--danger">{t('overdue')}</h3>
          {overdue.map(({ iso, list }) => (
            <DayCard key={`o-${iso}`} iso={iso} tasks={list} overdue {...dayProps} />
          ))}
        </>
      )}

      <h3 className="agenda__title">{t('upcoming')}</h3>
      {upcoming.length === 0 ? (
        <p className="day-card__empty">{t('nothingUpcoming')}</p>
      ) : (
        upcoming.map(({ iso, list, i }) => (
          <DayCard key={iso} iso={iso} tasks={list} isToday={i === 0} label={label(i, iso)} {...dayProps} />
        ))
      )}
    </>
  );
}
