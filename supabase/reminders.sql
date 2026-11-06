-- Напоминания об эфирах: push-уведомления на телефон участникам и (по желанию) сообщения в Telegram-группу.
-- Урок с Татьяной: каждый четверг программы в 9:00 по Киеву. Занятия с кураторами: по дате и времени
-- из таблицы curator_sessions (время считается киевским). Напоминания: за сутки и за час до начала.
--
-- Как это работает: каждые 5 минут Supabase (pg_cron) зовёт https://khavro-tracker.vercel.app/api/remind.
-- Сайт спрашивает у базы, какие напоминания пора отправить (функция due_reminders), и шлёт их в группу.
-- Каждое напоминание отправляется один раз: отметки хранятся в private.reminders_sent.
--
-- Выполните этот файл целиком один раз в Supabase: SQL Editor -> New query -> вставить -> Run.
-- Повторный запуск безопасен.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists private.settings (key text primary key, value text not null default '');
create table if not exists private.reminders_sent (key text primary key, sent_at timestamptz not null default now());
-- Подписки на push-уведомления: одна строка на телефон или браузер участника
create table if not exists private.push_subs (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

insert into private.settings (key, value) values
  ('cron_key', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')),
  ('program_start', '2026-11-05'),
  ('lesson_time', '09:00')
on conflict (key) do nothing;

-- Какие напоминания пора отправить. Вызывает только сайт по секретному ключу из cron.
create or replace function public.due_reminders(k text) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  res jsonb := '[]'::jsonb;
  r record;
  st date;
  lt time;
  chat text;
  subs jsonb;
begin
  if k is null or k <> (select value from private.settings where key = 'cron_key') then
    raise exception 'forbidden';
  end if;
  chat := nullif((select value from private.settings where key = 'chat_id'), '');
  -- Подписки всех участников, включая тариф «Записи»
  subs := coalesce((
    select jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'keys', jsonb_build_object('p256dh', ps.p256dh, 'auth', ps.auth)))
    from private.push_subs ps
  ), '[]'::jsonb);
  if chat is null and (jsonb_array_length(subs) = 0 or nullif((select value from private.settings where key = 'vapid_private'), '') is null) then
    return jsonb_build_object('chat', null, 'items', res, 'subs', '[]'::jsonb);
  end if;
  st := (select value from private.settings where key = 'program_start')::date;
  lt := (select value from private.settings where key = 'lesson_time')::time;
  for r in
    with ev as (
      select 'lesson-' || n as id, 'lesson' as type, n as week, ''::text as title,
             ((st + (n - 1) * 7) + lt) at time zone 'Europe/Kyiv' as starts_at,
             to_char(lt, 'HH24:MI') as hhmm,
             coalesce((select m.live_url from public.meetings m where m.week = n), '') as live_url
      from generate_series(1, 8) as n
      union all
      select 'cs-' || c.id || '-' || c.day || '-' || c.time, 'curator', null, c.title,
             (c.day + c.time::time) at time zone 'Europe/Kyiv', c.time, c.live_url
      from public.curator_sessions c
      where c.time ~ '^[0-9]{1,2}:[0-9]{2}$'
    ), due as (
      select ev.*, 'day' as kind from ev
        where now() >= starts_at - interval '24 hours' and now() < starts_at - interval '22 hours'
      union all
      select ev.*, 'hour' as kind from ev
        where now() >= starts_at - interval '1 hour' and now() < starts_at - interval '10 minutes'
    )
    select * from due order by starts_at
  loop
    insert into private.reminders_sent (key) values (r.id || '-' || r.kind) on conflict do nothing;
    if found then
      res := res || jsonb_build_object('kind', r.kind, 'type', r.type, 'week', r.week, 'title', r.title,
        'time', r.hhmm, 'starts_at', r.starts_at, 'live_url', r.live_url);
    end if;
  end loop;
  return jsonb_build_object('chat', chat, 'items', res, 'subs', subs,
    'vapid_public', (select value from private.settings where key = 'vapid_public'),
    'vapid_private', (select value from private.settings where key = 'vapid_private'));
end;
$$;
revoke all on function public.due_reminders(text) from public;
grant execute on function public.due_reminders(text) to anon, authenticated;

-- Администратор выбирает группу, куда слать напоминания
create or replace function public.set_reminder_chat(chat text, title text) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  insert into private.settings (key, value) values ('chat_id', coalesce(chat, ''))
    on conflict (key) do update set value = excluded.value;
  insert into private.settings (key, value) values ('chat_title', coalesce(title, ''))
    on conflict (key) do update set value = excluded.value;
end;
$$;
revoke all on function public.set_reminder_chat(text, text) from public;
grant execute on function public.set_reminder_chat(text, text) to authenticated;

-- Состояние напоминаний для кабинета администратора
create or replace function public.reminder_status() returns jsonb
language plpgsql security definer set search_path = public, private as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'chat_id', (select value from private.settings where key = 'chat_id'),
    'chat_title', (select value from private.settings where key = 'chat_title'),
    'cron', exists (select 1 from cron.job where jobname = 'tracker-reminders'),
    'last', (select max(sent_at) from private.reminders_sent),
    'push_ready', exists (select 1 from private.settings where key = 'vapid_public' and value <> ''),
    'push_subs', (select count(*) from private.push_subs)
  );
end;
$$;
revoke all on function public.reminder_status() from public;
grant execute on function public.reminder_status() to authenticated;

-- Ключи push-уведомлений создаёт сайт при первом входе администратора
create or replace function public.set_push_keys(pub text, priv text) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if exists (select 1 from private.settings where key = 'vapid_public' and value <> '') then return; end if;
  insert into private.settings (key, value) values ('vapid_public', pub), ('vapid_private', priv)
    on conflict (key) do update set value = excluded.value;
end;
$$;
revoke all on function public.set_push_keys(text, text) from public;
grant execute on function public.set_push_keys(text, text) to authenticated;

-- Открытый ключ нужен браузеру участника, чтобы подписаться
create or replace function public.push_public_key() returns text
language sql stable security definer set search_path = public, private as $$
  select nullif(value, '') from private.settings where key = 'vapid_public';
$$;
revoke all on function public.push_public_key() from public;
grant execute on function public.push_public_key() to authenticated;

-- Участник включает и выключает напоминания на своём устройстве
create or replace function public.save_push_sub(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  insert into private.push_subs (endpoint, user_id, p256dh, auth) values (p_endpoint, auth.uid(), p_p256dh, p_auth)
    on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;
revoke all on function public.save_push_sub(text, text, text) from public;
grant execute on function public.save_push_sub(text, text, text) to authenticated;

create or replace function public.delete_push_sub(p_endpoint text) returns void
language sql security definer set search_path = public, private as $$
  delete from private.push_subs ps where ps.endpoint = p_endpoint and ps.user_id = auth.uid();
$$;
revoke all on function public.delete_push_sub(text) from public;
grant execute on function public.delete_push_sub(text) to authenticated;

-- Тестовое уведомление администратору на его собственные устройства
create or replace function public.push_test_bundle() returns jsonb
language plpgsql security definer set search_path = public, private as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'vapid_public', (select value from private.settings where key = 'vapid_public'),
    'vapid_private', (select value from private.settings where key = 'vapid_private'),
    'subs', coalesce((select jsonb_agg(jsonb_build_object('endpoint', endpoint, 'keys', jsonb_build_object('p256dh', p256dh, 'auth', auth)))
                      from private.push_subs where user_id = auth.uid()), '[]'::jsonb));
end;
$$;
revoke all on function public.push_test_bundle() from public;
grant execute on function public.push_test_bundle() to authenticated;

-- Сайт убирает подписки, которые телефон больше не принимает
create or replace function public.drop_push_subs(k text, endpoints text[]) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  if k is null or k <> (select value from private.settings where key = 'cron_key') then raise exception 'forbidden'; end if;
  delete from private.push_subs where endpoint = any(endpoints);
end;
$$;
revoke all on function public.drop_push_subs(text, text[]) from public;
grant execute on function public.drop_push_subs(text, text[]) to anon, authenticated;

-- Каждые 5 минут проверяем, не пора ли напомнить
select cron.unschedule('tracker-reminders') where exists (select 1 from cron.job where jobname = 'tracker-reminders');
select cron.schedule('tracker-reminders', '*/5 * * * *', $job$
  select net.http_post(
    url := 'https://khavro-tracker.vercel.app/api/remind',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-key', (select value from private.settings where key = 'cron_key')),
    body := '{}'::jsonb
  );
$job$);
