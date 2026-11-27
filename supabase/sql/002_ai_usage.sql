-- ============================================
-- Этап 3: счётчик запросов к ИИ (защита от злоупотреблений)
-- ============================================
-- Каждый голосовой запрос стоит денег (или тратит общий бесплатный лимит Gemini),
-- поэтому считаем, сколько запросов сделал каждый пользователь за день.

create table public.ai_usage (
  user_id  uuid not null references auth.users (id) on delete cascade,
  day      date not null default current_date,
  count    int  not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

-- Пользователь может только посмотреть свой счётчик, но не изменить его напрямую.
create policy "Свой счётчик: чтение" on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);

grant select on public.ai_usage to authenticated;
revoke all on public.ai_usage from anon;

-- Увеличить счётчик текущего пользователя на 1 и вернуть новое значение.
-- security definer = функция работает с правами владельца таблицы,
-- но меняет ТОЛЬКО строку того, кто её вызвал (auth.uid()).
create or replace function public.ai_usage_increment()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  c int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.ai_usage (user_id, day, count)
  values (uid, current_date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into c;

  return c;
end;
$$;

revoke execute on function public.ai_usage_increment() from public, anon;
grant execute on function public.ai_usage_increment() to authenticated;
