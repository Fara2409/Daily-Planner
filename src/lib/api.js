// Работа с делами на сервере.
// В приложении поля называются в стиле JavaScript (remindAt),
// в базе — в стиле SQL (remind_at). Здесь мы переводим одно в другое.
import { supabase } from './supabase.js';
import { pad } from './dates.js';

// Дата-время из базы (UTC) → местное 'YYYY-MM-DDTHH:MM' для формы
function toLocalInput(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const fromRow = (r) => ({
  id: r.id,
  title: r.title,
  notes: r.notes ?? '',
  date: r.date,
  time: r.time ? r.time.slice(0, 5) : '',
  remindAt: toLocalInput(r.remind_at),
  repeat: r.repeat,
  doneDates: r.done_dates ?? [],
  tz: r.tz,
  createdAt: r.created_at,
});

const toRow = (t) => ({
  id: t.id,
  title: t.title,
  notes: t.notes ?? '',
  date: t.date,
  time: t.time || null,
  // '2026-12-19T19:00' без пояса JavaScript понимает как местное время —
  // переводим его в точный момент (UTC), чтобы сервер знал, когда напомнить.
  remind_at: t.remindAt ? new Date(t.remindAt).toISOString() : null,
  repeat: t.repeat || null,
  done_dates: t.doneDates ?? [],
  tz: t.tz || Intl.DateTimeFormat().resolvedOptions().timeZone,
  updated_at: new Date().toISOString(),
});

export async function fetchTasks() {
  const { data, error } = await supabase.from('tasks').select('*').order('date');
  if (error) throw error;
  return data.map(fromRow);
}

// upsert = «создать, а если уже есть с таким id — обновить»
export async function saveTask(task) {
  const { error } = await supabase.from('tasks').upsert(toRow(task));
  if (error) throw error;
}

export async function saveTasks(tasks) {
  if (!tasks.length) return;
  const { error } = await supabase.from('tasks').upsert(tasks.map(toRow));
  if (error) throw error;
}

export async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}
