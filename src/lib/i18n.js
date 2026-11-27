// Переводы интерфейса: русский, азербайджанский, английский.
import { getSetting } from './storage.js';

export const LANGS = { ru: 'RU', az: 'AZ', en: 'EN' };

// Локаль для названий месяцев и дней недели (их даёт сам браузер).
export const LOCALES = { ru: 'ru-RU', az: 'az-Latn-AZ', en: 'en-GB' };

const dict = {
  ru: {
    week: 'Неделя',
    month: 'Месяц',
    today: 'Сегодня',
    add: 'Добавить дело',
    newTask: 'Новое дело',
    editTask: 'Изменить дело',
    title: 'Что нужно сделать',
    titlePlaceholder: 'Например: Фархад придёт на стрижку',
    titleRequired: 'Напишите, что нужно сделать',
    date: 'Дата',
    time: 'Время (необязательно)',
    notes: 'Заметка',
    remind: 'Напомнить',
    remindHint: 'Уведомления заработают на этапе 4',
    repeat: 'Повтор',
    repeatNone: 'Не повторять',
    daily: 'Каждый день',
    weekly: 'Каждую неделю',
    monthly: 'Каждый месяц',
    yearly: 'Каждый год',
    save: 'Сохранить',
    cancel: 'Отмена',
    delete: 'Удалить',
    deleteConfirm: 'Удалить это дело?',
    empty: 'Дел нет',
    prev: 'Назад',
    next: 'Вперёд',
  },
  az: {
    week: 'Həftə',
    month: 'Ay',
    today: 'Bu gün',
    add: 'İş əlavə et',
    newTask: 'Yeni iş',
    editTask: 'İşi dəyiş',
    title: 'Nə etmək lazımdır',
    titlePlaceholder: 'Məsələn: Fərhad saç kəsdirməyə gələcək',
    titleRequired: 'Nə etmək lazım olduğunu yazın',
    date: 'Tarix',
    time: 'Vaxt (istəyə görə)',
    notes: 'Qeyd',
    remind: 'Xatırlat',
    remindHint: 'Bildirişlər 4-cü mərhələdə işləyəcək',
    repeat: 'Təkrar',
    repeatNone: 'Təkrarlanmasın',
    daily: 'Hər gün',
    weekly: 'Hər həftə',
    monthly: 'Hər ay',
    yearly: 'Hər il',
    save: 'Yadda saxla',
    cancel: 'Ləğv et',
    delete: 'Sil',
    deleteConfirm: 'Bu iş silinsin?',
    empty: 'İş yoxdur',
    prev: 'Geri',
    next: 'İrəli',
  },
  en: {
    week: 'Week',
    month: 'Month',
    today: 'Today',
    add: 'Add task',
    newTask: 'New task',
    editTask: 'Edit task',
    title: 'What needs to be done',
    titlePlaceholder: 'E.g. Farhad comes for a haircut',
    titleRequired: 'Please describe the task',
    date: 'Date',
    time: 'Time (optional)',
    notes: 'Note',
    remind: 'Remind me',
    remindHint: 'Notifications arrive in stage 4',
    repeat: 'Repeat',
    repeatNone: 'Does not repeat',
    daily: 'Every day',
    weekly: 'Every week',
    monthly: 'Every month',
    yearly: 'Every year',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    deleteConfirm: 'Delete this task?',
    empty: 'Nothing planned',
    prev: 'Previous',
    next: 'Next',
  },
};

// Язык: сохранённый выбор → язык телефона → русский.
export function detectLang() {
  const saved = getSetting('lang', null);
  if (saved && dict[saved]) return saved;
  const phone = (navigator.language || 'ru').slice(0, 2);
  return dict[phone] ? phone : 'ru';
}

export const translator = (lang) => (key) => dict[lang]?.[key] ?? dict.en[key] ?? key;

// ---------- Названия дат ----------
// Для русского и английского берём названия у браузера (Intl).
// Для азербайджанского — свои: не все браузеры знают азербайджанские месяцы.
const AZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
const AZ_WEEKDAYS = ['bazar ertəsi', 'çərşənbə axşamı', 'çərşənbə', 'cümə axşamı', 'cümə', 'şənbə', 'bazar'];
const AZ_WEEKDAYS_SHORT = ['B.e.', 'Ç.a.', 'Ç.', 'C.a.', 'C.', 'Ş.', 'B.'];

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const intl = (lang, opts) => new Intl.DateTimeFormat(LOCALES[lang], opts);
const mondayIndex = (d) => (d.getDay() + 6) % 7; // 0 = понедельник

export function dateNames(lang) {
  if (lang === 'az') {
    return {
      weekday: (d) => capitalize(AZ_WEEKDAYS[mondayIndex(d)]),
      weekdaysShort: AZ_WEEKDAYS_SHORT,
      dayMonth: (d) => `${d.getDate()} ${AZ_MONTHS[d.getMonth()]}`,
      dayMonthShort: (d) => `${d.getDate()} ${AZ_MONTHS[d.getMonth()].slice(0, 3)}`,
      monthYear: (d) => `${capitalize(AZ_MONTHS[d.getMonth()])} ${d.getFullYear()}`,
    };
  }
  return {
    weekday: (d) => capitalize(intl(lang, { weekday: 'long' }).format(d)),
    // 1 января 2024 — понедельник, от него берём 7 дней подряд
    weekdaysShort: Array.from({ length: 7 }, (_, i) =>
      capitalize(intl(lang, { weekday: 'short' }).format(new Date(2024, 0, 1 + i)))
    ),
    dayMonth: (d) => intl(lang, { day: 'numeric', month: 'long' }).format(d),
    dayMonthShort: (d) => intl(lang, { day: 'numeric', month: 'short' }).format(d),
    monthYear: (d) => capitalize(intl(lang, { month: 'long', year: 'numeric' }).format(d)),
  };
}
