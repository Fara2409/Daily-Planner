// Повторяющиеся дела.
// task.repeat: null (разовое) | 'daily' | 'weekly' | 'monthly' | 'yearly'.
// На этапе 3 ИИ будет заполнять это поле, если человек сам скажет
// «каждый месяц», «каждую неделю» и т.п.

import { fromISO } from './dates.js';

export const REPEATS = ['daily', 'weekly', 'monthly', 'yearly'];

// Попадает ли дело на конкретный день iso?
export function occursOn(task, iso) {
  if (!task.repeat) return task.date === iso;
  if (iso < task.date) return false;

  const start = fromISO(task.date);
  const day = fromISO(iso);

  switch (task.repeat) {
    case 'daily':
      return true;
    case 'weekly':
      return start.getDay() === day.getDay();
    case 'monthly':
      return start.getDate() === day.getDate();
    case 'yearly':
      return start.getDate() === day.getDate() && start.getMonth() === day.getMonth();
    default:
      return false;
  }
}

// «Выполнено» отмечаем по каждому дню отдельно —
// так у ежемесячного дела можно отметить декабрь, не трогая январь.
export const isDone = (task, iso) => (task.doneDates ?? []).includes(iso);
