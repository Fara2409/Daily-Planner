// =====================================================================
// Edge Function «delete-account»
// Полностью удаляет аккаунт того, кто её вызвал, и все его данные.
// Дела, устройства и счётчик ИИ удаляются автоматически вместе с аккаунтом
// (в таблицах стоит «on delete cascade»).
//
// Удалить пользователя может только сервер (нужен секретный ключ),
// поэтому это отдельная функция, а не запрос из приложения.
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = ['https://fara2409.github.io', 'http://localhost:5173'];

function cors(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });

  // 1) Кто просит удалить? Удаляем ТОЛЬКО собственный аккаунт вызвавшего.
  const apiKey =
    req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, apiKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data, error } = await asUser.auth.getUser();
  if (error || !data.user) return json(req, 401, { error: 'unauthorized' });

  // 2) Защита от случайного вызова: приложение должно явно подтвердить удаление.
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  if (body.confirm !== 'DELETE') return json(req, 400, { error: 'not_confirmed' });

  // 3) Удаляем.
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey(), { auth: { persistSession: false } });
  const { error: delError } = await admin.auth.admin.deleteUser(data.user.id);
  if (delError) {
    console.error('delete', delError.message);
    return json(req, 500, { error: 'server_error' });
  }

  console.log('account deleted'); // без email и id — чтобы в логах не оставалось личных данных
  return json(req, 200, { deleted: true });
});
