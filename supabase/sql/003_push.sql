-- ============================================
-- Этап 4: push-уведомления
-- ============================================

-- 1) Когда по делу последний раз отправили напоминание.
--    Напоминание «нужно отправить», если remind_at уже наступило,
--    а reminded_at пустое или раньше remind_at.
alter table public.tasks add column if not exists reminded_at timestamptz;

-- 2) Устройства пользователей, на которые можно отправлять push.
--    endpoint — уникальный «адрес» устройства у Apple/Google,
--    p256dh и auth — ключи шифрования: содержимое уведомления видит только это устройство.
create table public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  lang          text not null default 'ru' check (lang in ('ru', 'az', 'en')),
  user_agent    text,
  created_at    timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "Свои устройства: чтение" on public.push_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Свои устройства: удаление" on public.push_subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, delete on public.push_subscriptions to authenticated;
revoke all on public.push_subscriptions from anon;

-- 3) Сохранить устройство текущего пользователя.
--    Если на этом телефоне раньше входил другой аккаунт — устройство переходит к новому
--    (иначе напоминания прошлого аккаунта приходили бы новому человеку).
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_lang text, p_user_agent text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 then
    raise exception 'bad endpoint';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, lang, user_agent)
  values (uid, p_endpoint, p_p256dh, p_auth,
          case when p_lang in ('ru', 'az', 'en') then p_lang else 'ru' end,
          left(p_user_agent, 300))
  on conflict (endpoint) do update set
    user_id    = excluded.user_id,
    p256dh     = excluded.p256dh,
    auth       = excluded.auth,
    lang       = excluded.lang,
    user_agent = excluded.user_agent;
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text, text) to authenticated;

-- 4) «Забрать» напоминания, которым пора сработать.
--    Работает атомарно: одно и то же напоминание не уйдёт дважды,
--    даже если проверка запустится два раза одновременно.
--    Для повторяющихся дел сразу переносит remind_at на следующий раз.
--    Вызывать может ТОЛЬКО сервер (service_role), не пользователи.
create or replace function public.claim_due_reminders()
returns table (
  task_id    uuid,
  user_id    uuid,
  title      text,
  date       date,
  "time"     time,
  tz         text,
  repeat     text,
  fired_at   timestamptz,  -- на какое время было назначено это напоминание
  is_stale   boolean       -- просрочено больше чем на сутки — не отправляем, только переносим
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select t.id, t.remind_at as fired_at
    from public.tasks t
    where t.remind_at <= now()
      and (t.reminded_at is null or t.reminded_at < t.remind_at)
    order by t.remind_at
    limit 500
    for update skip locked
  ),
  upd as (
    update public.tasks t set
      reminded_at = now(),
      remind_at = case t.repeat
        when 'daily'   then t.remind_at + interval '1 day'
        when 'weekly'  then t.remind_at + interval '7 days'
        when 'monthly' then t.remind_at + interval '1 month'
        when 'yearly'  then t.remind_at + interval '1 year'
        else t.remind_at
      end
    from due
    where t.id = due.id
    returning t.id, t.user_id, t.title, t.date, t.time, t.tz, t.repeat
  )
  select upd.id, upd.user_id, upd.title, upd.date, upd.time, upd.tz, upd.repeat,
         due.fired_at, due.fired_at < now() - interval '1 day'
  from upd join due on due.id = upd.id;
end;
$$;

revoke execute on function public.claim_due_reminders() from public, anon, authenticated;
grant execute on function public.claim_due_reminders() to service_role;
