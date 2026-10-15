-- Практики недель и картинки к ним.
-- Выполните этот файл целиком один раз в Supabase: SQL Editor -> New query -> вставить -> Run.

-- Практики: по одной на неделю. Участники видят только открытые.
create table if not exists public.practices (
  week int primary key check (week between 1 and 8),
  title text not null default '',
  body text not null default '',
  link text not null default '',
  images jsonb not null default '[]',
  is_open boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.practices enable row level security;

drop policy if exists "practices read" on public.practices;
create policy "practices read" on public.practices for select to authenticated
  using (is_open or public.is_admin());

drop policy if exists "practices admin write" on public.practices;
create policy "practices admin write" on public.practices for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Хранилище картинок. Загружать и удалять может только администратор.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media admin insert" on storage.objects;
create policy "media admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "media admin update" on storage.objects;
create policy "media admin update" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin());

drop policy if exists "media admin delete" on storage.objects;
create policy "media admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());
