// =====================================================================
// Edge Function «send-reminders»
// Запускается планировщиком (Supabase Cron) каждую минуту:
//   1) забирает из базы напоминания, которым пора сработать;
//   2) отправляет push-уведомления на все устройства владельца дела.
//
// Секреты (Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY   — публичный ключ (тот же, что в приложении)
//   VAPID_PRIVATE_KEY  — приватный ключ (только здесь!)
//   VAPID_SUBJECT      — контакт для служб push, например "mailto:you@example.com"
//   CRON_SECRET        — пароль, без которого функцию нельзя запустить
// =====================================================================
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const APP_URL = 'https://fara2409.github.io/Daily-Planner/';

// Серверный ключ: обходит RLS, поэтому используется только здесь, на сервере.
function serviceKey() {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    const first = Object.values(keys)[0];
    if (typeof first === 'string' && first) return first;
  } catch {
    /* ignore */
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

// ---------- Текст уведомления на языке пользователя ----------
const WORDS = {
  ru: { today: 'Сегодня', tomorrow: 'Завтра', reminder: 'Напоминание' },
  az: { today: 'Bu gün', tomorrow: 'Sabah', reminder: 'Xatırlatma' },
  en: { today: 'Today', tomorrow: 'Tomorrow', reminder: 'Reminder' },
} as const;
const LOCALES = { ru: 'ru-RU', az: 'az-Latn-AZ', en: 'en-GB' } as const;
const AZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
type Lang = keyof typeof WORDS;

// Дата 'YYYY-MM-DD' в часовом поясе tz для момента ts
function localISO(ts: Date, tz: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ts);
}
const addDaysISO = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Для повторяющегося дела: ближайший день события, начиная с fromISO.
function nextOccurrence(startISO: string, repeat: string | null, fromISO: string) {
  if (!repeat || fromISO <= startISO) return startISO;
  const start = new Date(startISO + 'T12:00:00Z');
  for (let i = 0; i < 400; i++) {
    const iso = addDaysISO(fromISO, i);
    const d = new Date(iso + 'T12:00:00Z');
    if (
      repeat === 'daily' ||
      (repeat === 'weekly' && d.getUTCDay() === start.getUTCDay()) ||
      (repeat === 'monthly' && d.getUTCDate() === start.getUTCDate()) ||
      (repeat === 'yearly' && d.getUTCDate() === start.getUTCDate() && d.getUTCMonth() === start.getUTCMonth())
    ) return iso;
  }
  return startISO;
}

function formatDay(iso: string, lang: Lang, todayISO: string) {
  if (iso === todayISO) return WORDS[lang].today;
  if (iso === addDaysISO(todayISO, 1)) return WORDS[lang].tomorrow;
  const d = new Date(iso + 'T12:00:00Z');
  if (lang === 'az') return `${d.getUTCDate()} ${AZ_MONTHS[d.getUTCMonth()]}`;
  return new Intl.DateTimeFormat(LOCALES[lang], { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d);
}

type Due = {
  task_id: string; user_id: string; title: string; date: string; time: string | null;
  tz: string; repeat: string | null; fired_at: string; is_stale: boolean;
};

function buildMessage(task: Due, lang: Lang) {
  const tz = task.tz || 'Asia/Baku';
  const today = localISO(new Date(), tz);
  const firedDay = localISO(new Date(task.fired_at), tz);
  const eventDay = nextOccurrence(task.date, task.repeat, firedDay);
  const when = [formatDay(eventDay, lang, today), task.time ? task.time.slice(0, 5) : ''].filter(Boolean).join(' · ');
  return {
    title: task.title,
    body: `🔔 ${WORDS[lang].reminder}: ${when}`,
    tag: task.task_id,
    url: APP_URL,
  };
}

Deno.serve(async (req) => {
  // Защита: запускать может только наш планировщик, знающий CRON_SECRET.
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('forbidden', { status: 403 });
  }
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    console.error('VAPID secrets are not configured');
    return new Response('not configured', { status: 500 });
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey(), { auth: { persistSession: false } });

  // 1) Забираем напоминания, которым пора сработать.
  const { data: due, error } = await db.rpc('claim_due_reminders');
  if (error) {
    console.error('claim', error);
    return new Response('db error', { status: 500 });
  }
  const tasks = (due as Due[]).filter((t) => !t.is_stale);
  if (!tasks.length) return Response.json({ sent: 0 });

  // 2) Устройства владельцев этих дел.
  const userIds = [...new Set(tasks.map((t) => t.user_id))];
  const { data: subs, error: subsError } = await db
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth, lang')
    .in('user_id', userIds);
  if (subsError) {
    console.error('subs', subsError);
    return new Response('db error', { status: 500 });
  }

  // 3) Отправляем.
  let sent = 0;
  const dead: string[] = [];
  await Promise.all(
    tasks.flatMap((task) =>
      (subs ?? [])
        .filter((s) => s.user_id === task.user_id)
        .map(async (s) => {
          const lang = (['ru', 'az', 'en'].includes(s.lang) ? s.lang : 'ru') as Lang;
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              JSON.stringify(buildMessage(task, lang)),
              { TTL: 6 * 3600, urgency: 'high' }
            );
            sent++;
          } catch (e) {
            const code = (e as { statusCode?: number }).statusCode;
            // 404/410 — устройство отписалось (удалили приложение, запретили уведомления).
            if (code === 404 || code === 410) dead.push(s.id);
            else console.error('push', code, (e as { body?: string }).body ?? String(e));
          }
        })
    )
  );

  if (dead.length) await db.from('push_subscriptions').delete().in('id', dead);

  console.log(`reminders: ${tasks.length}, pushes sent: ${sent}, removed devices: ${dead.length}`);
  return Response.json({ reminders: tasks.length, sent, removed: dead.length });
});
