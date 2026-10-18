-- Права администратора: тариф и удаление участников.
-- Выполните этот файл целиком один раз в Supabase: SQL Editor -> New query -> вставить -> Run.

-- 1. Тариф после выбора меняет только администратор.
--    Заодно: когда администратор меняет чужой трекер, email и время обновления участника не трогаются.
create or replace function public.trackers_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.user_id = auth.uid() then
    new.email := auth.jwt() ->> 'email';
    new.updated_at := now();
  else
    new.email := old.email;
    new.updated_at := old.updated_at;
  end if;
  if tg_op = 'UPDATE' and not public.is_admin()
     and coalesce(old.data -> 'start' ->> 'plan', '') <> ''
     and coalesce(new.data -> 'start' ->> 'plan', '') <> (old.data -> 'start' ->> 'plan') then
    new.data := jsonb_set(new.data, '{start,plan}', old.data -> 'start' -> 'plan');
  end if;
  return new;
end;
$$;

create or replace function public.set_participant_plan(target uuid, p text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Менять тариф может только администратор';
  end if;
  if p not in ('rec', 'flow', 'deep', 'vip') then
    raise exception 'Неизвестный тариф';
  end if;
  update public.trackers set data = jsonb_set(data, '{start,plan}', to_jsonb(p)) where user_id = target;
end;
$$;
revoke all on function public.set_participant_plan(uuid, text) from public, anon;
grant execute on function public.set_participant_plan(uuid, text) to authenticated;

-- 2. Удаление участника целиком: аккаунт, трекер и всё, что с ним связано.
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
