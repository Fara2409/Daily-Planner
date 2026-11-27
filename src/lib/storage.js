// Хранение дел.
// Этап 1: в памяти браузера на этом телефоне (localStorage).
// Этап 2: заменим на сервер Supabase — остальной код при этом почти не изменится,
// потому что всё приложение работает с делами только через эти функции.

const KEY = 'daily-planner.tasks.v1';

export function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
}

export function saveTasks(tasks) {
  try {
    localStorage.setItem(KEY, JSON.stringify(tasks));
  } catch {
    // Память переполнена или недоступна — просто не сохраняем.
  }
}

export function getSetting(name, fallback) {
  try {
    return localStorage.getItem(`daily-planner.${name}`) ?? fallback;
  } catch {
    return fallback;
  }
}

export function setSetting(name, value) {
  try {
    localStorage.setItem(`daily-planner.${name}`, value);
  } catch {
    /* ignore */
  }
}

// Новое пустое дело. Структура сразу такая, как будет в базе данных.
export function newTask(date) {
  return {
    id: crypto.randomUUID(),
    title: '',
    notes: '',
    date,            // 'YYYY-MM-DD' — день дела
    time: '',        // 'HH:MM' или '' — время дела, если есть
    remindAt: '',    // 'YYYY-MM-DDTHH:MM' или '' — когда напомнить
    repeat: null,    // null | 'daily' | 'weekly' | 'monthly' | 'yearly'
    doneDates: [],   // дни, в которые дело отмечено выполненным
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone, // часовой пояс (нужен серверу для уведомлений)
    createdAt: new Date().toISOString(),
  };
}
