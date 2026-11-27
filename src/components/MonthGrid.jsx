// Сетка месяца: числа и точки-индикаторы дел. Нажатие выбирает день.
import { monthGrid, toISO } from '../lib/dates.js';

export default function MonthGrid({ cursor, selected, today, names, countOn, onSelect }) {
  const cells = monthGrid(cursor);

  return (
    <div className="month">
      {names.weekdaysShort.map((name) => (
        <div key={name} className="month__weekday">{name}</div>
      ))}
      {cells.map((d) => {
        const iso = toISO(d);
        const count = countOn(iso);
        const classes = [
          'month__cell',
          d.getMonth() !== cursor.getMonth() && 'is-other',
          iso === today && 'is-today',
          iso === selected && 'is-selected',
        ].filter(Boolean).join(' ');

        return (
          <button key={iso} className={classes} onClick={() => onSelect(iso)}>
            <span className="month__num">{d.getDate()}</span>
            <span className="month__dots">
              {Array.from({ length: Math.min(count, 3) }, (_, i) => <i key={i} />)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
