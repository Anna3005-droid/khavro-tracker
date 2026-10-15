-- Практики недель и картинки к ним.
-- В каждой неделе (модуле) три практики. Каждая открывается участникам отдельно.
-- Выполните этот файл целиком один раз в Supabase: SQL Editor -> New query -> вставить -> Run.

create table if not exists public.practices (
  week int not null check (week between 1 and 8),
  num int not null check (num between 1 and 3),
  title text not null default '',
  meta text not null default '',
  body text not null default '',
  link text not null default '',
  images jsonb not null default '[]',
  is_open boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (week, num)
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

-- Первые наброски практик модулей 1-3 (все закрыты). Дальше их правят в редакторе на сайте.
insert into public.practices (week, num, title, meta, body) values
(1, 1, 'Письменный протокол скрытых выгод', 'Письменно · около 20 минут · 9 вопросов',
 'Вы письменно отвечаете на девять вопросов протокола. Он помогает найти выгоду от текущего положения, которую вы раньше не замечали.'),
(1, 2, 'Диалог с частью, которая против роста', 'Трансовая техника · запись · 25 минут лёжа',
 'Вы слушаете запись лёжа. В трансе вы встречаетесь с той частью себя, которая сопротивляется росту, и вступаете с ней в диалог.'),
(1, 3, 'Работа через образы', 'Образная работа',
 'Когда часть не отвечает прямо, с ней работают через образы: психика показывает ответ картинкой, а не словами.'),
(2, 1, 'Протокол разрядки эпизода', 'Вживую · 30 минут',
 'Находим момент, когда психика решила, что деньги опасны, и снимаем с него эмоциональный заряд.'),
(2, 2, 'Телесный протокол', '20 минут лёжа',
 'То, что не уходит через разговор, снимается через тело.'),
(2, 3, 'Родовые эпизоды через поле', 'Групповая работа',
 'Групповая работа с родовыми эпизодами через поле.'),
(3, 1, 'Протокол возврата', 'В группе · 40 минут',
 'Разбираем, что вы несёте из родительской системы, и возвращаем то, что не ваше.'),
(3, 2, 'Внутренний диалог с родительской фигурой', 'Запись · когда будете готовы',
 'Диалог с родительской фигурой внутри себя. Запись можно пройти тогда, когда почувствуете готовность.'),
(3, 3, 'Телесная практика на взрослую опору', '15 минут в день',
 'Ежедневная телесная практика, которая выстраивает взрослую внутреннюю опору.')
on conflict (week, num) do nothing;
