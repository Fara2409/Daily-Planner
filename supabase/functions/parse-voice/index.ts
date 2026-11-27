// =====================================================================
// Edge Function «parse-voice»
// Получает аудиозапись фразы → отправляет в Gemini → возвращает дела в JSON.
//
// Работает на серверах Supabase, а не на телефоне. Поэтому ключ Gemini
// хранится здесь (в секретах Supabase) и никогда не попадает в приложение.
//
// Секреты (Edge Functions → Secrets):
//   GEMINI_API_KEY   — ключ Gemini (обязательно)
//   GEMINI_MODEL     — модель или несколько через запятую: первая основная,
//                      остальные запасные (например "gemini-4-hydrogen,gemini-3.5-flash")
//   GEMINI_THINKING  — уровень «размышлений» модели: minimal | low | medium | high
//                      (необязательно, по умолчанию low — быстро и достаточно для нашей задачи)
//   GEMINI_TIMEOUT_MS — сколько ждать ответа одной модели, мс (необязательно, по умолчанию 10000)
//   AI_DAILY_LIMIT   — сколько голосовых запросов в день на человека (необязательно)
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODELS = (Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash-lite,gemini-3.5-flash')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
const THINKING = (Deno.env.get('GEMINI_THINKING') ?? 'low').trim();
const TIMEOUT_MS = Number(Deno.env.get('GEMINI_TIMEOUT_MS') ?? '10000');
const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? '30');

// С каких сайтов можно вызывать функцию (защита от чужих сайтов).
const ALLOWED_ORIGINS = ['https://fara2409.github.io', 'http://localhost:5173'];

const ALLOWED_AUDIO = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/aac', 'audio/x-m4a'];
const MAX_AUDIO_BASE64 = 2_000_000; // ≈ 1.5 МБ аудио — это больше минуты речи

const REPEATS = ['none', 'daily', 'weekly', 'monthly', 'yearly'];

function cors(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json' },
  });
}

// Инструкция для ИИ. Пишем по-английски — модели так понимают точнее,
// но отвечать про названия дел ИИ будет на языке пользователя.
function buildPrompt(now: string, weekday: string, tz: string) {
  return `You are the scheduling assistant of a reminder app called Daily Planner.
The user speaks Russian, Azerbaijani or English (sometimes mixed).
Current local date and time of the user: ${now} (${weekday}), time zone ${tz}.

IMPORTANT: work ONLY with what is actually said in the audio. Never invent or guess content.
If the audio is silent, too quiet, only noise, or the speech is unclear, return
"understood": false, "transcript": "" and an empty "tasks" list.

Listen to the audio and return JSON:
- "transcript": exact transcription of what the user said, in the original language.
- "tasks": every task / event / reminder mentioned. For each task:
  - "title": short title in the SAME language the user spoke. Keep names of people and places
    (e.g. "Фархад — стрижка", "Отменить подписку"). Do not put dates or times in the title.
  - "date": the day of the event, "YYYY-MM-DD". Resolve relative words ("завтра", "sabah",
    "next Saturday", "20-го", "в субботу 20-го") against the current date. Always choose the
    nearest FUTURE date. If only a day of month is given and it already passed this month,
    use next month. If no date at all, use today.
  - "time": event time "HH:MM" (24h) or "" if the user did not say a time for the event.
  - "remindAt": when to send the reminder, "YYYY-MM-DDTHH:MM", or "" if the user did not ask
    to be reminded. Part-of-day defaults: morning = 09:00, afternoon/day = 13:00,
    evening = 19:00, night = 21:00. "Remind me the day before" without time = previous day 19:00.
    If the user asks to be reminded but gives no time: 1 hour before the event time,
    or 09:00 on the event day if the event has no time.
  - "repeat": one of "none", "daily", "weekly", "monthly", "yearly".
    Use something other than "none" ONLY if the user explicitly says it repeats
    ("каждый месяц", "hər həftə", "every year"...).
  - "notes": useful extra details, or "".
- "understood": false if there is no task in the audio (silence, noise, unrelated talk), otherwise true.`;
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    transcript: { type: 'STRING' },
    understood: { type: 'BOOLEAN' },
    tasks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          date: { type: 'STRING' },
          time: { type: 'STRING' },
          remindAt: { type: 'STRING' },
          repeat: { type: 'STRING' },
          notes: { type: 'STRING' },
        },
        required: ['title', 'date', 'time', 'remindAt', 'repeat', 'notes'],
      },
    },
  },
  required: ['transcript', 'understood', 'tasks'],
};

// Проверяем ответ ИИ: доверять ему вслепую нельзя.
const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = (s: unknown) => typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);
const isDateTime = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s);

function cleanTask(t: Record<string, unknown>, today: string) {
  return {
    title: String(t.title ?? '').trim().slice(0, 500),
    date: isDate(t.date) ? t.date : today,
    time: isTime(t.time) ? t.time : '',
    remindAt: isDateTime(t.remindAt) ? t.remindAt : '',
    repeat: REPEATS.includes(String(t.repeat)) && t.repeat !== 'none' ? t.repeat : null,
    notes: String(t.notes ?? '').trim().slice(0, 2000),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });

  if (!GEMINI_API_KEY) return json(req, 500, { error: 'not_configured' });

  // 1) Кто звонит? Проверяем вход пользователя.
  const authHeader = req.headers.get('Authorization') ?? '';
  const apiKey =
    req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, apiKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json(req, 401, { error: 'unauthorized' });

  // 2) Проверяем, что прислали.
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: 'bad_request' });
  }
  const audio = String(body.audio ?? '');
  const mimeType = String(body.mimeType ?? '').split(';')[0];
  const now = isDateTime(body.now) ? String(body.now) : '';
  const weekday = String(body.weekday ?? '').slice(0, 20);
  const tz = String(body.tz ?? 'Asia/Baku').slice(0, 60);

  if (!audio || !now || !ALLOWED_AUDIO.includes(mimeType)) return json(req, 400, { error: 'bad_request' });
  if (audio.length > MAX_AUDIO_BASE64) return json(req, 413, { error: 'too_long' });

  // 3) Лимит запросов в день.
  const { data: count, error: limitError } = await supabase.rpc('ai_usage_increment');
  if (limitError) {
    console.error('limit', limitError);
    return json(req, 500, { error: 'server_error' });
  }
  if (count > DAILY_LIMIT) return json(req, 429, { error: 'daily_limit', limit: DAILY_LIMIT });

  // 4) Отправляем аудио в Gemini.
  //    Если модель перегружена (503) или упёрлась в лимит (429) — ждём и пробуем ещё раз,
  //    а потом переходим на запасную модель.
  const makeBody = (withThinking: boolean) =>
    JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { inline_data: { mime_type: mimeType, data: audio } },
            { text: buildPrompt(now, weekday, tz) },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        // Меньше «размышлений» = быстрее ответ. Для разбора короткой фразы глубокое мышление не нужно.
        ...(withThinking && THINKING ? { thinkingConfig: { thinkingLevel: THINKING } } : {}),
      },
    });

  const RETRYABLE = [429, 500, 503, 504];
  let geminiRes: Response | null = null;
  let lastStatus = 0;
  const started = Date.now();

  outer: for (const model of GEMINI_MODELS) {
    let withThinking = true;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const t0 = Date.now();
      let res: Response;
      try {
        // Не ждём бесконечно: если модель «зависла» в очереди — прерываем и пробуем дальше.
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
            body: makeBody(withThinking),
            signal: AbortSignal.timeout(TIMEOUT_MS),
          }
        );
      } catch (e) {
        lastStatus = 504;
        console.error('gemini', model, `attempt ${attempt}`, `timeout/network after ${Date.now() - t0} ms`, String(e));
        continue; // сразу следующая попытка, без паузы
      }
      if (res.ok) {
        geminiRes = res;
        console.log(
          'gemini ok', model, `attempt ${attempt}`, `thinking=${withThinking ? THINKING : 'off'}`,
          mimeType, `audio ~${Math.round((audio.length * 3) / 4 / 1024)} KB`,
          `${Date.now() - t0} ms (total ${Date.now() - started} ms)`
        );
        break outer;
      }
      lastStatus = res.status;
      const errText = await res.text();
      console.error('gemini', model, `attempt ${attempt}`, res.status, `${Date.now() - t0} ms`, errText);

      // Модель не знает параметр thinkingLevel — сразу повторяем без него.
      if (res.status === 400 && withThinking && /thinking/i.test(errText)) {
        withThinking = false;
        continue;
      }
      if (!RETRYABLE.includes(res.status)) break; // ошибка не временная — сразу к следующей модели
      if (attempt === 1) await new Promise((r) => setTimeout(r, 1000));
    }
  }

  if (!geminiRes) {
    return json(req, 502, { error: RETRYABLE.includes(lastStatus) ? 'ai_busy' : 'ai_error' });
  }

  // 5) Разбираем и проверяем ответ.
  try {
    const result = await geminiRes.json();
    const text = result?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    const parsed = JSON.parse(text);
    console.log('transcript', JSON.stringify(parsed.transcript ?? ''));
    const today = now.slice(0, 10);
    const tasks = Array.isArray(parsed.tasks)
      ? parsed.tasks.slice(0, 10).map((t: Record<string, unknown>) => cleanTask(t, today)).filter((t) => t.title)
      : [];
    return json(req, 200, {
      transcript: String(parsed.transcript ?? '').slice(0, 2000),
      understood: parsed.understood !== false && tasks.length > 0,
      tasks,
    });
  } catch (e) {
    console.error('parse', e);
    return json(req, 502, { error: 'ai_error' });
  }
});
