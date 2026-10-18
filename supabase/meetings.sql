-- Ссылки на эфир и запись встречи для каждой недели.
-- Выполните один раз в Supabase: SQL Editor -> New query -> вставить -> Run.

create table if not exists public.meetings (
  week int primary key check (week between 1 and 8),
  live_url text not null default '',
  record_url text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.meetings enable row level security;

drop policy if exists "meetings read" on public.meetings;
create policy "meetings read" on public.meetings for select to authenticated
  using (true);

drop policy if exists "meetings admin write" on public.meetings;
create policy "meetings admin write" on public.meetings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
