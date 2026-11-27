-- Этап 2: таблица дел. (Уже выполнено в SQL Editor 27.11.2026 — хранится здесь для истории.)
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
              references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 500),
  notes       text not null default '' check (char_length(notes) <= 2000),
  date        date not null,
  time        time,
  remind_at   timestamptz,
  tz          text not null default 'Asia/Baku',
  repeat      text check (repeat in ('daily', 'weekly', 'monthly', 'yearly')),
  done_dates  date[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index tasks_user_date_idx on public.tasks (user_id, date);
create index tasks_remind_at_idx on public.tasks (remind_at) where remind_at is not null;

alter table public.tasks enable row level security;

create policy "Свои дела: чтение" on public.tasks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Свои дела: создание" on public.tasks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Свои дела: изменение" on public.tasks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Свои дела: удаление" on public.tasks
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.tasks to authenticated;
revoke all on public.tasks from anon;
