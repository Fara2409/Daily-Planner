// Локальное хранилище телефона (localStorage).
// С этапа 2 дела хранятся на сервере (см. api.js), а здесь остаются только
// настройки (язык, вид календаря) и дела из этапа 1 — их один раз переносим на сервер.

const KEY = 'daily-planner.tasks.v1';

export function loadLocalTasks() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
}

export function clearLocalTasks() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
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
