# Трекер 8 недель

Трекер программы «Психология финансового масштаба» Татьяны Хавро.
Участники регистрируются со своим email и паролем и отмечают недели.
Администраторы видят вкладку «Участники» со статистикой всех участников.

Обычный сайт без сборки: `index.html`, `styles.css`, `app.js`, `config.js`.
Данные и вход хранятся в Supabase, сайт публикует Vercel.

## Запуск

### 1. Supabase (база и вход)
1. Зарегистрируйтесь на https://supabase.com и создайте проект (New project). Регион: Frankfurt (Central EU).
2. SQL Editor → New query → вставьте весь файл `supabase/schema.sql` → Run.
3. Authentication → Sign In / Providers → Email: выключите **Confirm email** и сохраните.
   Без этого каждому участнику придёт письмо, а бесплатная почта Supabase отправляет всего несколько писем в час.
4. Project Settings → API: скопируйте **Project URL** и **anon public** key и впишите их в `config.js`.

### 2. Vercel (публикация)
1. Войдите на https://vercel.com через GitHub.
2. Add New → Project → выберите репозиторий `khavro-tracker` → Deploy. Настройки менять не нужно.
3. Скопируйте адрес сайта, например `https://khavro-tracker.vercel.app`.
4. Вернитесь в Supabase: Authentication → URL Configuration → **Site URL** = адрес сайта. Это нужно для писем «Забыли пароль».

### 3. Администратор
1. Зарегистрируйтесь на сайте сами.
2. В Supabase → SQL Editor выполните (со своим email):
   ```sql
   insert into public.admins (user_id)
     select id from auth.users where email = 'ваш@email.com'
   on conflict do nothing;
   ```
3. Обновите страницу: появится вкладка «Участники».

Сначала зарегистрируйтесь и назначьте себя администратором, а уже потом отправляйте ссылку участникам.

## Как поменять что-то потом
- Тексты модулей, ситуаций и результатов находятся в начале `app.js`.
- Дата старта по умолчанию: `DEFAULT_START` в `app.js`.
- Каждое изменение, отправленное на GitHub, Vercel публикует сам примерно за минуту.
