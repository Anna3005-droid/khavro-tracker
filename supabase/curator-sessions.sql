-- Занятия с кураторами: дата, время, тема, ссылка на встречу и ссылки на запись.
-- Неделя программы определяется по дате сама. Читают все участники, меняют только администраторы.
-- Выполните один раз в Supabase: SQL Editor -> New query -> вставить -> Run.

create table if not exists public.curator_sessions (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  time text not null default '',
  title text not null default '',
  live_url text not null default '',
  record_url text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.curator_sessions enable row level security;

drop policy if exists "curator sessions read" on public.curator_sessions;
create policy "curator sessions read" on public.curator_sessions for select to authenticated
  using (true);

drop policy if exists "curator sessions admin write" on public.curator_sessions;
create policy "curator sessions admin write" on public.curator_sessions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
