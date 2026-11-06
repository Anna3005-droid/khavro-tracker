-- Администраторы видят, кто ещё администратор (отметка «админ» в таблице «Участники»).
-- Участники по-прежнему не видят список администраторов, и через сайт его никто не может изменить.
-- Выполните один раз в Supabase: SQL Editor -> New query -> вставить -> Run.

drop policy if exists "admins read by admins" on public.admins;
create policy "admins read by admins" on public.admins for select to authenticated
  using (public.is_admin());
