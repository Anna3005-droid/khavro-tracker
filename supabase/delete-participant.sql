-- Удаление участника целиком: аккаунт, трекер и всё, что с ним связано.
-- Выполните один раз в Supabase: SQL Editor -> New query -> вставить -> Run.
-- Вызвать может только администратор. Себя и других администраторов удалить нельзя.

create or replace function public.delete_participant(target uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then
    raise exception 'Удалять участников может только администратор';
  end if;
  if target = auth.uid() then
    raise exception 'Нельзя удалить самого себя';
  end if;
  if exists (select 1 from public.admins where user_id = target) then
    raise exception 'Нельзя удалить администратора';
  end if;
  delete from auth.users where id = target;
end;
$$;

revoke all on function public.delete_participant(uuid) from public, anon;
grant execute on function public.delete_participant(uuid) to authenticated;
