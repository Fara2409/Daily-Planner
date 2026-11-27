// Помощники для работы с датами.
// Даты дел храним строкой 'YYYY-MM-DD' (например '2026-12-20') —
// так их легко сравнивать и не путаться с часовыми поясами.

export const pad = (n) => String(n).padStart(2, '0');

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayISO = () => toISO(new Date());

export const addDays = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);

// Неделя начинается с понедельника.
// getDay(): 0 = воскресенье, 1 = понедельник ... поэтому сдвигаем на 6.
export const startOfWeek = (d) => {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
};

export const weekDays = (d) => {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

// Сетка месяца: полные недели (5 или 6 строк по 7 дней).
export const monthGrid = (d) => {
  const start = startOfWeek(new Date(d.getFullYear(), d.getMonth(), 1));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return cells[35].getMonth() !== d.getMonth() ? cells.slice(0, 35) : cells;
};

// Вечер накануне: дата на день раньше, время 19:00.
export const eveningBefore = (iso) => `${toISO(addDays(fromISO(iso), -1))}T19:00`;
