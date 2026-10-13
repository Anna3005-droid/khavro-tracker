-- Трекер 8 недель: база данных.
-- Выполните этот файл целиком один раз в Supabase: SQL Editor -> New query -> вставить -> Run.

-- Кто видит кабинет «Участники»
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- Один трекер на одного участника
create table if not exists public.trackers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.admins enable row level security;
alter table public.trackers enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to authenticated;

-- Email всегда берётся из аккаунта, подделать его нельзя
create or replace function public.trackers_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.email := auth.jwt() ->> 'email';
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trackers_stamp on public.trackers;
create trigger trackers_stamp before insert or update on public.trackers
for each row execute function public.trackers_stamp();

-- Участник видит и меняет только свой трекер, администратор видит все
drop policy if exists "read own or admin" on public.trackers;
create policy "read own or admin" on public.trackers for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "insert own" on public.trackers;
create policy "insert own" on public.trackers for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "update own" on public.trackers;
create policy "update own" on public.trackers for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "admin delete" on public.trackers;
create policy "admin delete" on public.trackers for delete to authenticated
  using (public.is_admin());

-- У таблицы admins нет политик: через сайт её нельзя ни прочитать, ни изменить.


-- =====================================================================
-- ПОСЛЕ того как вы сами зарегистрировались на сайте, выполните
-- отдельно эту строку, подставив свой email. Она делает вас администратором.
-- Для второго администратора (например, Татьяны) выполните её ещё раз с её email.
--
-- insert into public.admins (user_id)
--   select id from auth.users where email = 'ваш@email.com'
-- on conflict do nothing;
