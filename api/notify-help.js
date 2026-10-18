// Серверная функция Vercel: присылает в Telegram сообщение о запросе помощи куратора.
//
// Нужны две переменные окружения в Vercel (Settings -> Environment Variables):
//   TELEGRAM_BOT_TOKEN  токен бота от @BotFather
//   TELEGRAM_CHAT_ID    кому присылать: id из @userinfobot. Несколько получателей через запятую.
//
// Функция не верит тому, что прислал браузер: она проверяет вход участника в Supabase,
// сама читает его трекер и берёт запрос оттуда. Подделать чужой запрос нельзя.

const SUPABASE_URL = 'https://txyawjxefzzwxvypfvlr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_TQj7UK_FS5p6nW7T3vRy7g_9x8DWxSV';
const SITE_URL = 'https://khavro-tracker.vercel.app';

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function supa(path, userToken, init) {
  const r = await fetch(SUPABASE_URL + path, Object.assign({}, init, {
    headers: Object.assign({ apikey: SUPABASE_KEY, Authorization: 'Bearer ' + userToken, 'Content-Type': 'application/json' }, (init && init.headers) || {})
  }));
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
  return { ok: r.ok, status: r.status, json };
}

async function sendTelegram(token, chats, text) {
  const results = await Promise.all(chats.map(async (chat) => {
    const r = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true })
    });
    const j = await r.json().catch(() => ({}));
    return { chat, ok: !!j.ok, error: j.description };
  }));
  return results;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' });

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chats = String(process.env.TELEGRAM_CHAT_ID || '').split(/[,\s]+/).filter(Boolean);
  if (!botToken || !chats.length) return res.status(503).json({ error: 'telegram_not_configured' });

  const userToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!userToken) return res.status(401).json({ error: 'Нужен вход' });

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

  // Кто прислал
  const who = await supa('/auth/v1/user', userToken);
  if (!who.ok || !who.json || !who.json.id) return res.status(401).json({ error: 'Вход не подтверждён' });
  const user = who.json;

  // Проверочное сообщение: только для администратора
  if (body.test) {
    const isAdmin = await supa('/rest/v1/rpc/is_admin', userToken, { method: 'POST', body: '{}' });
    if (!isAdmin.ok || isAdmin.json !== true) return res.status(403).json({ error: 'Только для администратора' });
    const sent = await sendTelegram(botToken, chats, '✅ <b>Трекер 8 недель</b>\nУведомления о запросах помощи куратора работают.');
    return res.status(sent.every((s) => s.ok) ? 200 : 502).json({ sent });
  }

  // Сам запрос берём из трекера участника
  const id = String(body.id || '');
  const tr = await supa('/rest/v1/trackers?select=data,email&user_id=eq.' + encodeURIComponent(user.id), userToken);
  const row = tr.ok && Array.isArray(tr.json) ? tr.json[0] : null;
  const help = row && row.data && Array.isArray(row.data.help) ? row.data.help : [];
  const h = help.filter((x) => x && x.id === id && !x.cancelled)[0];
  if (!h) return res.status(404).json({ error: 'Запрос не найден' });
  if (Date.now() - new Date(h.at).getTime() > 15 * 60 * 1000) return res.status(409).json({ error: 'Запрос слишком старый' });

  const name = (row.data.start && row.data.start.name) || '';
  const planName = ({ rec: 'Записи', flow: 'Поток', deep: 'Глубина', vip: 'VIP' })[row.data.start && row.data.start.plan] || '';
  const rawNick = String(h.contact || (row.data.start && row.data.start.tg) || '').trim().replace(/^https?:\/\//i, '').replace(/^(t\.me|telegram\.me)\//i, '').replace(/^@/, '');
  const nick = /^[A-Za-z0-9_]{4,32}$/.test(rawNick) ? rawNick : '';
  let ctx = 'Неделя ' + esc(h.week);
  if (h.practice) {
    const pr = await supa('/rest/v1/practices?select=title&week=eq.' + Number(h.week) + '&num=eq.' + Number(h.practice), userToken);
    const title = pr.ok && Array.isArray(pr.json) && pr.json[0] ? pr.json[0].title : '';
    ctx += ' · Практика ' + esc(h.practice) + (title ? ': ' + esc(title) : '');
  }

  const lines = [
    '🔔 <b>Нужна помощь куратора</b>',
    '',
    '<b>' + esc(name || 'Участник') + '</b>' + (user.email ? ' · ' + esc(user.email) : ''),
    planName ? 'Тариф: ' + esc(planName) : '',
    ctx,
    h.text ? '\n💬 ' + esc(h.text) : '',
    nick ? '✈️ Telegram: <a href="https://t.me/' + nick + '">@' + nick + '</a>' : (h.contact ? '📞 Связь: ' + esc(h.contact) : ''),
    '',
    'Открыть трекер: ' + SITE_URL
  ].filter((l, i, a) => !(l === '' && a[i - 1] === ''));

  const sent = await sendTelegram(botToken, chats, lines.join('\n').trim());
  return res.status(sent.some((s) => s.ok) ? 200 : 502).json({ sent: sent.map((s) => ({ ok: s.ok, error: s.error })) });
};
