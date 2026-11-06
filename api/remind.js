// Серверная функция Vercel: напоминания об эфирах в Telegram-группу участников.
//
// 1) Каждые 5 минут её вызывает Supabase (pg_cron, см. supabase/reminders.sql) с секретным ключом.
//    Функция спрашивает у базы, какие напоминания пора отправить, и шлёт их в группу.
// 2) Администратор из кабинета «Участники» может найти группу ({action:'find'})
//    и отправить проверочное сообщение ({action:'test'}).
//
// Нужна переменная окружения в Vercel: TELEGRAM_BOT_TOKEN (тот же бот, что и для запросов помощи).
// Бота нужно добавить в группу участников.

const SUPABASE_URL = 'https://txyawjxefzzwxvypfvlr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_TQj7UK_FS5p6nW7T3vRy7g_9x8DWxSV';
const SITE_URL = 'https://khavro-tracker.vercel.app';
const MODULES = [
  'Самосаботаж и скрытые выгоды', 'Разрушение старых программ', 'Сепарация и взросление', 'Дефициты и самооценка',
  'Самоценность и проявленность', 'Убеждения и растяжка', 'Выход из сценариев', 'Новая идентичность'
];

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function safeLink(u) { return /^https?:\/\//i.test(String(u || '')) ? String(u) : ''; }

async function rpc(name, args, token) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + (token || SUPABASE_KEY), 'Content-Type': 'application/json' },
    body: JSON.stringify(args || {})
  });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
  return { ok: r.ok, status: r.status, json };
}

async function tg(token, method, body) {
  const r = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
  return r.json().catch(() => ({}));
}

function dayLabel(iso) {
  return new Date(iso).toLocaleDateString('ru-RU', { timeZone: 'Europe/Kyiv', weekday: 'long', day: 'numeric', month: 'long' });
}

function message(it) {
  const live = safeLink(it.live_url);
  const when = it.kind === 'day' ? 'Завтра, ' + dayLabel(it.starts_at) + ', в ' + esc(it.time) + ' по Киеву' : 'Через час, в ' + esc(it.time) + ' по Киеву';
  const lines = [];
  if (it.type === 'lesson') {
    lines.push((it.kind === 'day' ? '🔔' : '⏰') + ' <b>' + when + ' — урок с Татьяной</b>');
    const m = MODULES[(it.week || 1) - 1];
    lines.push('Модуль ' + esc(it.week) + (m ? ' · ' + esc(m) : ''));
  } else {
    lines.push((it.kind === 'day' ? '📅' : '⏰') + ' <b>' + when + ' — занятие с куратором</b>');
    if (it.title) lines.push(esc(it.title));
  }
  lines.push('');
  lines.push(live ? '👉 Ссылка на эфир: ' + esc(live) : 'Ссылка на эфир появится в трекере: ' + SITE_URL);
  return lines.join('\n');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' });
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

  // Вызов по расписанию из Supabase
  const cronKey = req.headers['x-cron-key'];
  if (cronKey) {
    const due = await rpc('due_reminders', { k: String(cronKey) });
    if (!due.ok) return res.status(403).json({ error: 'forbidden' });
    const chat = due.json && due.json.chat, items = (due.json && due.json.items) || [];
    if (!chat || !items.length) return res.status(200).json({ sent: 0 });
    if (!botToken) return res.status(503).json({ error: 'telegram_not_configured' });
    const out = [];
    for (const it of items) {
      const j = await tg(botToken, 'sendMessage', { chat_id: chat, text: message(it), parse_mode: 'HTML', disable_web_page_preview: true });
      out.push({ ok: !!j.ok, error: j.description });
    }
    return res.status(200).json({ sent: out });
  }

  // Действия администратора из кабинета
  const userToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!userToken) return res.status(401).json({ error: 'Нужен вход' });
  const isAdmin = await rpc('is_admin', {}, userToken);
  if (!isAdmin.ok || isAdmin.json !== true) return res.status(403).json({ error: 'Только для администратора' });
  if (!botToken) return res.status(503).json({ error: 'telegram_not_configured' });

  if (body.action === 'find') {
    // Группы, куда недавно добавили бота или где ему писали (Telegram хранит это сутки)
    const j = await tg(botToken, 'getUpdates', { allowed_updates: ['message', 'my_chat_member', 'chat_member'] });
    const chats = {};
    (j.result || []).forEach((u) => {
      const c = (u.message && u.message.chat) || (u.my_chat_member && u.my_chat_member.chat) || (u.chat_member && u.chat_member.chat);
      if (c && (c.type === 'group' || c.type === 'supergroup')) chats[c.id] = { id: String(c.id), title: c.title || 'Группа' };
    });
    return res.status(200).json({ ok: !!j.ok, error: j.description, chats: Object.values(chats) });
  }

  if (body.action === 'test') {
    const st = await rpc('reminder_status', {}, userToken);
    const chat = st.ok && st.json && st.json.chat_id;
    if (!chat) return res.status(409).json({ error: 'Группа не выбрана' });
    const j = await tg(botToken, 'sendMessage', {
      chat_id: chat, parse_mode: 'HTML', disable_web_page_preview: true,
      text: '✅ <b>Трекер 8 недель</b>\nНапоминания об эфирах будут приходить сюда: за сутки и за час до начала.'
    });
    return res.status(j.ok ? 200 : 502).json({ ok: !!j.ok, error: j.description });
  }

  return res.status(400).json({ error: 'Неизвестное действие' });
};
