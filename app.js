(function () {
  var MODULES = [
    ['Самосаботаж и скрытые выгоды', 'Самосаботаж, конфликт «хочу» и «боюсь», скрытые выгоды бездействия', 'Доступ к заблокированной энергии'],
    ['Травмы денег и бизнеса', 'Травматические узлы, незавершённые процессы, травмы развития и бизнеса', 'Прошлое перестаёт управлять настоящим'],
    ['Сепарация', 'Эмоциональная связь с родителями, обиды и ожидания, взрослая позиция', 'Рост дохода и внутренней свободы'],
    ['Дефициты и опоры', 'Чувство недостаточности, антиденежная самооценка, внутренние опоры', 'Деньги из достоинства, а не из нужды'],
    ['Самоценность и проявленность', 'Страх быть видимым, право занимать своё место', 'Свобода проявляться и действовать на результат'],
    ['Убеждения и финансовая растяжка', 'Денежные убеждения, страх больших денег, финансовая растяжка', 'Психика выдерживает новый масштаб'],
    ['Жизненные сценарии', 'Сценарии бедности и потолка, повторяющиеся циклы', 'Разрыв цикла, выход на новый уровень'],
    ['Новая идентичность и ABC-стратегия', 'Новая версия себя, ABC-шаги стратегии', 'Готовность действовать из новой себя']
  ];
  var SITUATIONS = [
    'Доход не растёт выше определённой суммы',
    'Действий много, а результата нет',
    'Деньги то приходят, то обнуляются',
    'Хорошие возможности упускаются',
    'Клиентов мало или не того уровня'
  ];
  var RESULTS = [
    'Я снимаю блоки, которые не дают зарабатывать больше',
    'У меня новая версия себя, которая может зарабатывать больше',
    'Я делаю осознанные выборы, которые ведут к большим деньгам',
    'Я не боюсь проявляться',
    'У меня сильная внутренняя опора и финансовая ёмкость'
  ];
  // Первое занятие в четверг 5 ноября: с него начинается неделя 1, недели идут с четверга по среду
  var DEFAULT_START = '2026-11-05';

  var cfg = window.TRACKER_CONFIG || {};
  var sb = window.supabase && cfg.supabaseUrl && cfg.supabaseUrl.indexOf('YOUR-') < 0
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  var tab = 'start', cur = 0, S = null, me = null, admin = false;
  var people = [], VIEW = null, feedWeek = 0, peopleTimer = null;
  var saveTimer = null, writing = false, again = false, booted = false, pendingName = '', pendingTg = '', pendingPlan = '';

  function $(id) { return document.getElementById(id); }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  // Ник в Telegram: принимаем «@anna», «anna», «t.me/anna»; возвращаем «@anna» или '' если ник неправильный
  function tgNick(v) {
    var s = String(v || '').trim().replace(/^https?:\/\//i, '').replace(/^(t\.me|telegram\.me)\//i, '').replace(/^@/, '');
    return /^[A-Za-z0-9_]{4,32}$/.test(s) ? '@' + s : '';
  }
  function tgLink(v) {
    var n = tgNick(v);
    return n ? '<a href="https://t.me/' + n.slice(1) + '" target="_blank" rel="noopener">' + n + '</a>' : esc(v || '');
  }
  function num(v) { if (v === '' || v == null) return null; var n = Number(v); return isFinite(n) ? n : null; }
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }
  function avg(a) { a = a.filter(function (x) { return x != null; }); return a.length ? sum(a) / a.length : null; }
  function D() { return VIEW ? VIEW.s : S; }
  function dis() { return VIEW ? ' disabled' : ''; }
  function money(n, c) { return n == null ? '-' : Math.round(n).toLocaleString('ru-RU') + ' ' + (c || D().start.cur); }

  function blankWeek() { return { meet: 0, cur: 0, buddy: 0, daily: { pol: [0, 0, 0, 0, 0, 0, 0], emo: [0, 0, 0, 0, 0, 0, 0] }, practices: [0, 0, 0], pnotes: ['', '', ''], nights: [0, 0, 0, 0, 0, 0, 0], s0: 0, s1: 0, insight: '', action: '', recap: '' }; }
  function blank() {
    var w = []; for (var i = 0; i < 8; i++) w.push(blankWeek());
    return { start: { name: '', cur: '€', date: DEFAULT_START, income: '', sit: [0, 0, 0, 0, 0], res: [0, 0, 0, 0, 0] }, weeks: w, end: { income: '', res: [0, 0, 0, 0, 0] }, cards: [] };
  }
  function valid(o) { return o && o.weeks && o.weeks.length === 8 && o.start && o.end; }
  function norm(o) {
    // Старая дата старта по умолчанию (воскресенье) переводится на четверг первого занятия
    if (o.start.date === '2026-11-01') o.start.date = DEFAULT_START;
    if (o.start.name == null) o.start.name = '';
    if (o.start.tg == null) o.start.tg = '';
    if (o.start.plan == null) o.start.plan = '';
    // Доход фиксируется дважды: на старте и в конце программы (в месяц)
    if (o.start.income == null) o.start.income = '';
    if (o.end.income == null) o.end.income = '';
    if (!Array.isArray(o.cards)) o.cards = [];
    o.weeks.forEach(function (w) {
      if (!Array.isArray(w.practices)) w.practices = [0, 0, 0];
      if (w.cur == null) w.cur = 0; // занятие с куратором (вместо групповой терапии и чата)
      if (!w.daily) w.daily = {};
      DAILY.forEach(function (d) { if (!Array.isArray(w.daily[d.key])) w.daily[d.key] = [0, 0, 0, 0, 0, 0, 0]; });
      if (!Array.isArray(w.pnotes)) w.pnotes = ['', '', ''];
      delete w.practice; delete w.income;
    });
    return o;
  }
  function set(path, val) { var p = path.split('.'), last = p.pop(), o = p.reduce(function (a, k) { return a[k]; }, S); o[last] = val; }

  // Недели программы: неделя 1 идёт от дня старта (четверг первого занятия) до воскресенья,
  // со второй недели обычные недели с понедельника по воскресенье.
  function startDate(s) { var d = new Date(((s || D()).start.date || DEFAULT_START) + 'T00:00:00'); return isNaN(d.getTime()) ? null : d; }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function firstLen(d) { return (8 - d.getDay()) % 7 || 7; }
  function weekLen(i, s) { var d = startDate(s); return d && i === 0 ? firstLen(d) : 7; }
  function weekStart(i, s) {
    var d = startDate(s); if (!d) return null;
    return i === 0 ? d : addDays(d, firstLen(d) + (i - 1) * 7);
  }
  function totalNights(s) { var t = 0; for (var i = 0; i < 8; i++) t += weekLen(i, s); return t; }
  function weekRange(i) {
    var a = weekStart(i); if (!a) return '';
    var b = addDays(a, weekLen(i) - 1);
    var f = function (x) { return x.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', ''); };
    return f(a) + ' - ' + f(b);
  }
  function currentWeek(s) {
    if (!startDate(s)) return 0;
    var now = Date.now(), w = 0;
    for (var i = 1; i < 8; i++) if (weekStart(i, s).getTime() <= now) w = i;
    return w;
  }
  // Тарифы программы. От тарифа зависит, что показывает трекер:
  // «Записи» смотрят встречи в записи и задают вопросы в общем чате (без куратора),
  // «Глубина» и VIP получают личную работу «Точка сборки», VIP ещё 4 индивидуальные сессии.
  var PLANS = [
    { id: 'rec', name: 'Записи', inc: ['Занятия в записи, доступ через сутки после эфира', 'Базовые упражнения и психотехники', 'Материалы 3 месяца', 'Общий чат потока'] },
    { id: 'flow', name: 'Поток', inc: ['Всё из «Записей»', 'Живое участие во всех занятиях с вопросами', 'Куратор', 'Материалы 6 месяцев', 'Приложение «Проработчик денег»'] },
    { id: 'deep', name: 'Глубина', main: true, inc: ['Всё из «Потока»', 'Личная работа «Точка сборки» с Татьяной', 'Работа с травмами развития', 'Разбор своего случая в группе', '3 месяца в группе «Метафизика бизнеса»', 'Материалы навсегда', 'VIP-чат с ответами Татьяны'] },
    { id: 'vip', name: 'VIP', inc: ['Всё из «Глубины»', '4 глубинные сессии индивидуально', 'Личный маршрут проработки', 'Прямая связь с Татьяной между сессиями'] }
  ];
  function plan(s) { var id = (s || D()).start.plan; return PLANS.filter(function (p) { return p.id === id; })[0] || null; }
  function planId(s) { var p = plan(s); return p ? p.id : ''; }
  function isRec(s) { return planId(s) === 'rec'; }
  function isVip(s) { return planId(s) === 'vip'; }
  function hasPersonal(s) { var id = planId(s); return id === 'deep' || id === 'vip' || id === ''; }
  // Что доступно в тарифе «Записи» (по описанию программы: занятия в записи, базовые упражнения
  // и психотехники, общий чат потока). Недоступно: всё живое и личное сопровождение.
  var REC_OFF = ['buddy'];                            // бадди нет в тарифе «Записи»
  var LIVE_PRACTICES = ['2-1', '2-3', '3-1', '4-1', '8-1']; // практики вживую или в группе
  var PERSONAL_PRACTICES = ['5-1'];
  // Практик в неделе может быть от 0 до 3. Участники видят и считают только те, что администратор открыл.
  function pOpen(week, num) { var p = practices[pkey(week, num)]; return !!(p && p.is_open); }
  function openNums(week) { return [1, 2, 3].filter(function (n) { return pOpen(week, n); }); }
  function practWord(n) { var a = n % 10, b = n % 100; return a === 1 && b !== 11 ? 'практика' : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'практики' : 'практик'; }                   // «Точка сборки»: только «Глубина» и VIP
  function feature(name, s) { return !(isRec(s) && REC_OFF.indexOf(name) >= 0); }
  // 'ok' — практика доступна, 'live' — вживую/в группе (не для «Записей»), 'personal' — только «Глубина» и VIP
  function practiceAccess(week, num, s) {
    if (!pOpen(week, num)) return 'off';
    var k = week + '-' + num;
    if (PERSONAL_PRACTICES.indexOf(k) >= 0 && !hasPersonal(s)) return 'personal';
    if (LIVE_PRACTICES.indexOf(k) >= 0 && isRec(s)) return 'live';
    return 'ok';
  }
  // «Протокол для подсознания во сне» пока скрыт: решают, давать ли его. Вернуть — поставить true.
  var SHOW_NIGHTS = false;
  // Оценка «Состояние: энергия и ясность» тоже скрыта. Вернуть — поставить true.
  var SHOW_STATE = false;
  // Ежедневная практика в первые недели: каждый день полярности и эмоции, чтобы держать ритм.
  // Номера недель с нуля: [0, 1] — недели 1 и 2.
  var DAILY_WEEKS = [0, 1];
  var DAILY = [
    { key: 'pol', title: 'Проработка полярностей', url: 'https://practici-polyarnosti.vercel.app/' },
    { key: 'emo', title: 'Проработка эмоций', url: 'https://emotional-pi.vercel.app/' }
  ];
  function hasDaily(i) { return DAILY_WEEKS.indexOf(i) >= 0; }
  function dailyDone(w, i, s) {
    if (!hasDaily(i) || !w.daily) return 0;
    var n = weekLen(i, s);
    return DAILY.reduce(function (t, d) { return t + sum((w.daily[d.key] || []).slice(0, n)); }, 0);
  }
  function practicesOpenTo(i, s) { return [1, 2, 3].filter(function (n) { return practiceAccess(i + 1, n, s) === 'ok'; }).length; }
  // Пункты недели, которые считаются в кольце прогресса, зависят от тарифа
  function maxDone(s, i) {
    return 1 + 1 + (feature('buddy', s) ? 1 : 0) +
      (isVip(s) ? 1 : 0) + practicesOpenTo(i, s) + (SHOW_NIGHTS ? weekLen(i, s) : 0) + (hasDaily(i) ? DAILY.length * weekLen(i, s) : 0);
  }
  function done(w, s, i) {
    var pr = (w.practices || []).filter(function (v, j) { return v && practiceAccess(i + 1, j + 1, s) === 'ok'; }).length;
    return w.meet + (w.cur || 0) + (feature('buddy', s) ? w.buddy : 0) +
      pr + (SHOW_NIGHTS ? sum(w.nights.slice(0, weekLen(i, s))) : 0) + dailyDone(w, i, s) + (isVip(s) ? (w.vip || 0) : 0);
  }
  function planPill(s) { var p = plan(s); return p ? '<span class="pill plan-' + p.id + '">' + p.name + '</span>' : '<span class="pill mute">тариф не выбран</span>'; }

  function stats(s) {
    var W = s.weeks, states = [];
    W.forEach(function (w) { if (w.s0) states.push(w.s0); if (w.s1) states.push(w.s1); });
    var rs = s.start.res.filter(Boolean), re = s.end.res.filter(Boolean);
    var touched = W.filter(function (w, i) { return done(w, s, i) > 0 || w.insight || w.action || w.recap || w.s0 || w.s1; }).length;
    var a = num(s.start.income), b = num(s.end.income);
    return {
      incStart: a, incEnd: b,
      incPct: a != null && b != null && a > 0 ? Math.round((b - a) / a * 100) : null,
      meets: sum(W.map(function (w) { return w.meet; })),
      curs: sum(W.map(function (w) { return w.cur || 0; })),
      daily: sum(W.map(function (w, i) { return dailyDone(w, i, s); })),
      dailyMax: sum(W.map(function (w, i) { return hasDaily(i) ? DAILY.length * weekLen(i, s) : 0; })),
      nights: sum(W.map(function (w, i) { return sum(w.nights.slice(0, weekLen(i, s))); })),
      practices: sum(W.map(function (w, i) { return (w.practices || []).filter(function (v, j) { return v && practiceAccess(i + 1, j + 1, s) === 'ok'; }).length; })),
      practicesMax: sum(W.map(function (w, i) { return practicesOpenTo(i, s); })),
      state: states.length ? sum(states) / states.length : null,
      resStart: rs.length ? sum(rs) / rs.length : null, resEnd: re.length ? sum(re) / re.length : null,
      touched: touched
    };
  }

  // ---------- Трекер участника ----------
  function dotsRow(path, val) {
    return '<div class="dots">' + [1, 2, 3, 4, 5].map(function (k) {
      return '<button class="dot" type="button" data-path="' + path + '" data-k="' + k + '" aria-label="Оценка ' + k + ' из 5" aria-pressed="' + (val >= k) + '"' + dis() + '></button>';
    }).join('') + '</div>';
  }
  // Линейные иконки 24×24 для вкладок и чек-листа
  var ICON = {
    records: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10.5 9.5v5l4-2.5z"/>',
    today: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    yinyang: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a4.25 4.25 0 0 1 0 8.5 4.25 4.25 0 0 0 0 8.5"/><circle cx="12" cy="7.75" r=".9"/><circle cx="12" cy="16.25" r=".9"/>',
    cards: '<rect x="3" y="6" width="12" height="16" rx="2" transform="rotate(-8 9 14)"/><rect x="9" y="3" width="12" height="16" rx="2"/><path d="M15 8.5l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"/>',
    start: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    weeks: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    practice: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    total: '<path d="M4 20V11M10 20V5M16 20v-7M21 20H3"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.3c3 .1 5.5 2.6 5.5 5.7"/>',
    meet: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10.5l5-3v9l-5-3"/>',
    group: '<circle cx="12" cy="7.5" r="2.6"/><circle cx="5.5" cy="11.5" r="2.1"/><circle cx="18.5" cy="11.5" r="2.1"/><path d="M8 20c0-2.2 1.8-4 4-4s4 1.8 4 4M2 19c.3-1.7 1.7-3 3.5-3M22 19c-.3-1.7-1.7-3-3.5-3"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    buddy: '<path d="M6.5 3h3l2 5-2.5 1.5a11 11 0 0 0 5.5 5.5L16 12.5l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5a2 2 0 0 1 2-2z"/>',
    leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19l8-8"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><path d="M12 17h.01"/>'
  };
  function svg(name) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[name] + '</svg>'; }

  function chkRow(id, path, val, label, hint, icon) {
    return '<label class="crow' + (icon ? ' has-ico' : '') + '" for="' + id + '">' + (icon ? '<span class="ci">' + svg(icon) + '</span>' : '') +
      '<span>' + label + (hint ? '<small>' + hint + '</small>' : '') + '</span><input class="chk" type="checkbox" id="' + id + '" data-bind="' + path + '"' + (val ? ' checked' : '') + dis() + '></label>';
  }

  // Кольцо прогресса: при обновлении плавно дорисовывается
  function setRing(el, v, max) {
    if (!el) return;
    var C = 163.4;
    if (!el.querySelector('.rf')) {
      el.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" class="rt"/><circle cx="32" cy="32" r="26" class="rf" style="stroke-dasharray:163.4;stroke-dashoffset:163.4"/></svg><span class="rv"><b></b><small></small></span>';
      void el.offsetWidth;
    }
    el.querySelector('.rf').style.strokeDashoffset = (C * (1 - Math.min(1, v / max))).toFixed(1);
    el.querySelector('.rv b').textContent = v;
    el.querySelector('.rv small').textContent = 'из ' + max;
    el.classList.toggle('full', v >= max);
    el.setAttribute('aria-label', 'Выполнено ' + v + ' из ' + max);
  }

  // Шапка: приветствие по имени, неделя программы и прогресс этой недели
  function updHead() {
    if (!S) return;
    var first = (S.start.name || '').trim().split(/\s+/)[0];
    var hr = new Date().getHours(), g = hr < 5 ? 'Доброй ночи' : hr < 12 ? 'Доброе утро' : hr < 18 ? 'Добрый день' : 'Добрый вечер';
    $('ah-title').innerHTML = g + (first ? ', <em>' + esc(first) + '</em>' : '');
    var d = new Date((S.start.date || DEFAULT_START) + 'T00:00:00'), wk = currentWeek(S);
    $('ah-sub').textContent = !isNaN(d.getTime()) && Date.now() < d.getTime()
      ? 'Программа начнётся ' + d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
      : 'Неделя ' + (wk + 1) + ' из 8 · ' + MODULES[wk][0];
    setRing($('ah-ring'), done(S.weeks[wk], S, wk), maxDone(S, wk));
  }

  function renderStart() {
    var v = D().start, h = '';
    h += '<h2>Точка старта</h2>';
    h += pushBlock(); // напоминания включают один раз, сразу при первом входе
    h += '<div class="block"><h3>Расписание · по Киеву</h3><div class="sched sched-plain">' +
      '<div class="sched-row"><span class="sched-day">Каждый понедельник</span><span class="sched-time">' + CURATOR_TIME + '</span><span class="sched-what">Занятие с куратором</span></div>' +
      '<div class="sched-row"><span class="sched-day">Каждый четверг</span><span class="sched-time">' + LESSON_TIME + '</span><span class="sched-what">Урок с Татьяной</span></div>' +
      '</div></div>';
    h += '<div class="block"><h3>О вас</h3><div class="row"><label class="f" for="s-name">Как вас зовут<input type="text" id="s-name" data-bind="start.name" value="' + esc(v.name) + '" placeholder="Имя и фамилия" autocomplete="name"' + dis() + '></label>' +
      '<label class="f" for="s-tg">Ник в Telegram<input type="text" id="s-tg" data-bind="start.tg" value="' + esc(v.tg) + '" placeholder="@nickname" autocapitalize="off" spellcheck="false"' + dis() + '></label>' +
      '<label class="f" for="s-date">Старт программы<input type="date" id="s-date" data-bind="start.date" value="' + esc(v.date) + '"' + dis() + '></label></div></div>';
    h += planBlock();
    h += '<div class="block"><h3>Доход на старте</h3><div class="row">' +
      '<label class="f" for="s-income">Ваш доход в месяц сейчас<input type="number" inputmode="numeric" id="s-income" data-bind="start.income" value="' + esc(v.income) + '" placeholder="0"' + dis() + '></label>' +
      '<label class="f" for="s-cur">Валюта<select id="s-cur" data-bind="start.cur"' + dis() + '>' + ['€', '$', '₴'].map(function (c) { return '<option' + (v.cur === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></label></div>' +
      '</div>';
    h += '<div class="block"><h3>С чем вы пришли в программу</h3><div class="sitlist">' + SITUATIONS.map(function (t, i) {
      return chkRow('sit-' + i, 'start.sit.' + i, v.sit[i], t);
    }).join('') + '</div></div>';
    h += '<div class="block"><h3>Оцените себя сейчас</h3><div class="cmp">' + RESULTS.map(function (t, i) {
      return '<div class="item"><span class="name">' + t + '</span>' + dotsRow('start.res.' + i, v.res[i]) + '</div>';
    }).join('') + '</div><p class="scale">1 — совсем не про меня · 5 — это уже так</p></div>';
    $('start').innerHTML = h;
  }
  // Выбор тарифа на вкладке «Старт»: четыре карточки, у выбранной виден состав
  // Тариф выбирают один раз, при регистрации. Потом его меняет только администратор:
  // в своём трекере или в трекере участника (через функцию set_participant_plan в базе).
  function planBlock() {
    var cur0 = planId(), h = '<div class="block" id="plan-block"><h3>' + (VIEW ? 'Тариф участника' : 'Ваш тариф') + '</h3>';
    var canChange = VIEW ? admin : (admin || !cur0);
    var attr = VIEW ? 'data-setplan' : 'data-plan';
    if (!cur0 && !VIEW) h += '';
    if (VIEW && admin) h += '<p class="scale" style="margin:0 0 12px">Нажмите на другой тариф, чтобы поменять его участнику.</p>';
    h += '<div class="plans">' + PLANS.map(function (p) {
      var on = p.id === cur0;
      return '<button class="plan' + (on ? ' on' : '') + '" type="button" ' + attr + '="' + p.id + '" aria-pressed="' + on + '"' + (canChange ? '' : ' disabled') + '>' +
        '<b>' + p.name + '</b></button>';
    }).join('') + '</div>';
    if (cur0 && !canChange) h += '';
    // Состав тарифов участникам не показываем: трекер — платформа, а не описание тарифов
    return h + '</div>';
  }
  function renderWeeks() {
    var w = D().weeks[cur], M = MODULES[cur], h = '';
    h += '<div class="chips" id="chips">' + MODULES.map(function (x, i) { return '<button class="chip" type="button" data-w="' + i + '" aria-pressed="' + (i === cur) + '">' + (i + 1) + '<small>неделя</small></button>'; }).join('') + '</div>';
    var rng = weekRange(cur);
    h += '<div class="wk-head"><div><p class="eyebrow">Неделя ' + (cur + 1) + (rng ? ' · ' + rng : '') + '</p><h2>' + M[0] + '</h2></div><div class="ring" id="w-ring" role="img"></div></div>';
    h += scheduleBlock();
    h += todayBlock();
    if (!planId() && !VIEW) h += '<div class="helpbox"><span class="ci">' + svg('start') + '</span><div class="hb-text"><b>Укажите ваш тариф</b><small>Это займёт секунду.</small></div><button class="btn" type="button" data-goplan="1">Выбрать</button></div>';
    h += meetingBlock();
    h += curatorBlock();
    h += helpBox('w');
    // «Что прорабатываем» не показываем: трекер — дневник, без описаний модуля
    h += '<div class="block"><h3>На этой неделе</h3><div class="checks">' +
      (isRec() ? chkRow('w-meet', 'weeks.' + cur + '.meet', w.meet, 'Запись встречи с Татьяной', 'Доступна через сутки после эфира', 'meet')
        : chkRow('w-meet', 'weeks.' + cur + '.meet', w.meet, 'Живая встреча с Татьяной', '', 'meet')) +
      (isVip() ? chkRow('w-vip', 'weeks.' + cur + '.vip', w.vip, 'Индивидуальная сессия с Татьяной', '4 сессии за программу', 'star') : '') +
      chkRow('w-cur', 'weeks.' + cur + '.cur', w.cur, 'Занятие с куратором', '', 'group') +
      (feature('buddy') ? chkRow('w-buddy', 'weeks.' + cur + '.buddy', w.buddy, 'Созвон с бадди', '', 'buddy') : '') +
      '</div>' + '</div>';
    var wnums = openNums(cur + 1).filter(function (n) { return practiceAccess(cur + 1, n) === 'ok'; });
    h += '<div class="block"><h3>Практики модуля</h3><div class="checks">' + weekVideos(cur).map(function (v) {
      var d = !!(w.vids && w.vids[v.id]);
      return '<div class="crow has-ico"><span class="ci">' + svg('records') + '</span><span>' + esc(v.title) + '<small>Видео-техника' + (d ? ' · ✓ выполнено' : '') + (VIEW ? '' : ' · <button class="plink" type="button" data-govid="1">Смотреть →</button>') + '</small></span></div>';
    }).join('') + (wnums.length || weekVideos(cur).length ? '' : '<p class="scale" style="margin:0">Скоро</p>') + wnums.map(function (n) {
      var j = n - 1, p = practices[pkey(cur + 1, n)];
      var title = esc((p && p.title) || 'Практика');
      var go = VIEW ? '' : '<button class="plink" type="button" data-gopr="' + j + '">Открыть практику →</button>';
      var acc = practiceAccess(cur + 1, j + 1);
      if (acc !== 'ok') return '<div class="crow has-ico"><span class="ci mute">' + svg('star') + '</span><span>' + title + '<small>' +
        (acc === 'personal' ? 'Личная работа с Татьяной: тарифы «Глубина» и VIP' : 'Проходит вживую на занятии: тарифы «Поток», «Глубина» и VIP') + '</small></span><span class="pill mute">не в тарифе</span></div>';
      if (p && p.is_open) return chkRow('w-p' + j, 'weeks.' + cur + '.practices.' + j, w.practices[j], title, esc(p.meta) + go, 'leaf');
      return '<div class="crow has-ico"><span class="ci mute">' + svg('lock') + '</span><span>' + title + '<small>Станет доступна после встречи с Татьяной</small></span><span class="pill mute">закрыта</span></div>';
    }).join('') + '</div></div>';
    var ws0 = weekStart(cur), nn = [0, 1, 2, 3, 4, 5, 6].slice(0, weekLen(cur));
    if (hasDaily(cur)) {
      h += '<div class="block daily"><h3>Каждый день</h3>' +
        DAILY.map(function (d) {
          var arr = (w.daily && w.daily[d.key]) || [];
          return '<div class="daily-row"><div class="daily-head"><b>' + esc(d.title) + '</b>' + (VIEW ? '' : '<a class="plink" href="' + esc(d.url) + '" target="_blank" rel="noopener">Открыть ↗</a>') + '</div>' +
            '<div class="nights">' + nn.map(function (n) {
              var day = ws0 ? addDays(ws0, n) : null, id = 'w-' + d.key + n;
              var wd = day ? day.toLocaleDateString('ru-RU', { weekday: 'short' }) : 'день';
              return '<label class="night" for="' + id + '"><b>' + wd + '</b><input class="chk" type="checkbox" id="' + id + '" data-bind="weeks.' + cur + '.daily.' + d.key + '.' + n + '"' + (arr[n] ? ' checked' : '') + dis() +
                ' aria-label="' + esc(d.title) + ', ' + (day ? day.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }) : 'день ' + (n + 1)) + '">' + (day ? day.getDate() : n + 1) + '</label>';
            }).join('') + '</div></div>';
        }).join('') + '</div>';
    }
    if (SHOW_NIGHTS) h += '<div class="block"><h3>Протокол для подсознания во сне</h3><div class="nights">' + nn.map(function (n) {
      var day = ws0 ? addDays(ws0, n) : null;
      var wd = day ? day.toLocaleDateString('ru-RU', { weekday: 'short' }) : 'ночь';
      return '<label class="night" for="w-n' + n + '"><b>' + wd + '</b><input class="chk moon" type="checkbox" id="w-n' + n + '" data-bind="weeks.' + cur + '.nights.' + n + '"' + (w.nights[n] ? ' checked' : '') + dis() + ' aria-label="' + (day ? day.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Ночь ' + (n + 1)) + '">' + (day ? day.getDate() : n + 1) + '</label>';
    }).join('') + '</div><p class="scale">Отмечайте ночи, когда вы слушали протокол перед сном.</p></div>';
    h += '<div class="block"><h3>Действие недели</h3><p class="field-hint">Один конкретный шаг к деньгам на эту неделю.</p><input type="text" id="w-action" data-bind="weeks.' + cur + '.action" value="' + esc(w.action) + '" placeholder="Например: написать 3 клиентам"' + dis() + '></div>';
    if (SHOW_STATE) h += '<div class="block"><h3>Состояние: энергия и ясность</h3><div class="scales">' +
      '<div class="week"><span>В начале недели</span>' + dotsRow('weeks.' + cur + '.s0', w.s0) + '</div>' +
      '<div class="week"><span>В конце недели</span>' + dotsRow('weeks.' + cur + '.s1', w.s1) + '</div>' +
      '</div><p class="scale">От 1, когда нет сил, до 5, когда ясно и легко.</p></div>';
    h += '<div class="block"><h3>Главный инсайт</h3><p class="field-hint">Главное, что вы поняли о себе и деньгах за неделю.</p><textarea id="w-insight" data-bind="weeks.' + cur + '.insight" placeholder="Например: я боюсь поднимать цену, потому что…"' + dis() + '>' + esc(w.insight) + '</textarea></div>';
    h += '<div class="block"><h3>Итог недели</h3><p class="field-hint">Что изменилось и что берёте дальше.</p><textarea id="w-recap" data-bind="weeks.' + cur + '.recap" placeholder="Например: подняла цену, пришёл новый клиент"' + dis() + '>' + esc(w.recap) + '</textarea></div>';
    $('weeks').innerHTML = h; lastDone = null; updDone();
    var chip = document.querySelector('.chip[data-w="' + cur + '"]'), box = $('chips');
    if (chip && box) box.scrollLeft = Math.max(0, chip.offsetLeft - 16);
  }
  var lastDone = null;
  function updDone() {
    var v = done(D().weeks[cur], D(), cur), mx = maxDone(D(), cur);
    setRing($('w-ring'), v, mx);
    if (!VIEW && lastDone != null && lastDone < mx && v >= mx) toast('Неделя ' + (cur + 1) + ' пройдена полностью ✦');
    lastDone = v;
    if (!VIEW) updHead();
  }

  function renderTotal() {
    var s = D(), W = s.weeks, st = stats(s), h = '';
    h += '<h2>Итоги программы</h2>';
    h += '<div class="kpis">' +
      '<div><span>' + (isRec(s) ? 'Записи встреч' : 'Встречи с Татьяной') + '</span><strong>' + st.meets + ' из 8</strong></div>' +
      '<div><span>Занятия с куратором</span><strong>' + st.curs + ' из 8</strong></div>' +
      '<div><span>Практики</span><strong>' + st.practices + ' из ' + st.practicesMax + '</strong></div>' +
      (st.dailyMax ? '<div><span>Дни практики: полярности и эмоции</span><strong>' + st.daily + ' из ' + st.dailyMax + '</strong></div>' : '') +
      (SHOW_NIGHTS ? '<div><span>Ночей с протоколом</span><strong>' + st.nights + ' из ' + totalNights(s) + '</strong></div>' : '') + '</div>';
    h += '<div class="income"><h3>Доход: старт и итог</h3>' +
      '<div class="row"><label class="f" for="e-income">Ваш доход в месяц в конце программы, ' + esc(s.start.cur) + '<input type="number" inputmode="numeric" id="e-income" data-bind="end.income" value="' + esc(s.end.income) + '" placeholder="0"' + dis() + '></label></div>' +
      '<div id="inc-cmp"></div></div>';
    if (SHOW_STATE) h += '<h3 style="margin-top:26px">Состояние по неделям</h3><div class="statebar">' + W.map(function (w, i) {
      var a = [w.s0, w.s1].filter(Boolean); a = a.length ? sum(a) / a.length : 0;
      return '<i title="Неделя ' + (i + 1) + ': ' + (a ? a.toFixed(1) + ' из 5' : 'нет данных') + '" style="opacity:' + (a ? (0.2 + a / 5 * 0.8).toFixed(2) : 0.08) + '"></i>';
    }).join('') + '</div><p class="legend">Чем ярче, тем выше среднее состояние недели.</p>';
    h += '<h3 style="margin-top:30px">Результаты программы: до и после</h3><div class="cmp">' + RESULTS.map(function (t, i) {
      var b = s.start.res[i], a = s.end.res[i];
      return '<div class="item"><span class="name">' + t + '</span>' +
        '<div class="pair"><span>До</span><span class="track"><span class="fill" style="width:' + b * 20 + '%"></span></span><span>' + (b || '-') + '</span></div>' +
        '<div class="pair"><span>После</span><span class="track"><span class="fill after" style="width:' + a * 20 + '%"></span></span><span>' + (a || '-') + '</span></div>' +
        dotsRow('end.res.' + i, a) + '</div>';
    }).join('') + '</div><p class="scale">1 — совсем не про меня · 5 — это уже так</p>';
    $('total').innerHTML = h;
    updIncome();
  }
  // Сравнение дохода на старте и в конце: обновляется сразу, пока человек вводит цифру
  function updIncome() {
    var el = $('inc-cmp'); if (!el) return;
    var st = stats(D()), c = D().start.cur;
    if (st.incStart == null) { el.innerHTML = '<p class="scale">Доход на старте не записан. Его можно указать во вкладке «Старт».</p>'; return; }
    var max = Math.max(st.incStart, st.incEnd || 0, 1);
    el.innerHTML = '<div class="cmp" style="margin-top:14px"><div class="item">' +
      '<div class="pair wide"><span>Старт</span><span class="track"><span class="fill" style="width:' + (st.incStart / max * 100).toFixed(0) + '%"></span></span><span>' + money(st.incStart, c) + '</span></div>' +
      '<div class="pair wide"><span>Итог</span><span class="track"><span class="fill after" style="width:' + ((st.incEnd || 0) / max * 100).toFixed(0) + '%"></span></span><span>' + (st.incEnd == null ? '-' : money(st.incEnd, c)) + '</span></div>' +
      '</div></div>' +
      (st.incPct == null ? '' : '<p class="inc-pct ' + (st.incPct >= 0 ? 'up' : 'down') + '">' + (st.incPct > 0 ? '+' : '') + st.incPct + '%<small>' + (st.incPct >= 0 ? 'рост дохода за программу' : 'изменение дохода за программу') + '</small></p>');
  }

  // ---------- Кабинет администратора ----------
  function pname(p) { return (p.s.start.name || '').trim() || p.email || 'Участник без имени'; }
  function ago(iso) {
    var d = (Date.now() - new Date(iso).getTime()) / 864e5;
    if (d < 1 / 24) return 'только что';
    if (d < 1) return Math.round(d * 24) + ' ч назад';
    if (d < 2) return 'вчера';
    return Math.floor(d) + ' дн назад';
  }
  function freshPill(iso) {
    if (!iso) return '<span class="pill mute">нет данных</span>';
    var d = (Date.now() - new Date(iso).getTime()) / 864e5;
    return '<span class="pill ' + (d <= 3 ? 'good' : d <= 7 ? 'mute' : 'warn') + '">' + ago(iso) + '</span>';
  }

  function renderPeople() {
    var h = '', P = people.slice().sort(function (a, b) { return pname(a).localeCompare(pname(b), 'ru'); });
    h += '<h2>Участники программы</h2><p class="note">Здесь видно всё, что отмечают участники. Список обновляется каждую минуту. Нажмите на строку, чтобы открыть трекер человека.</p>';
    h += '<p class="actions" style="margin:0 0 20px"><button class="ghost gold" type="button" id="refresh">Обновить сейчас</button></p>';
    h += helpSection();
    h += reminderSection();
    if (!P.length) {
      h += '<div class="empty"><b>Пока никто не заполнил трекер.</b><br>Отправьте участникам ссылку на этот сайт. Каждый регистрируется со своим email, и как только человек отметит первый пункт, он появится здесь.</div>';
      $('people').innerHTML = h; return;
    }
    var all = P.map(function (p) { return { p: p, st: stats(p.s) }; });
    var N = P.length, wk = currentWeek(P[0].s);
    var active = P.filter(function (p) { return p.updatedAt && (Date.now() - new Date(p.updatedAt).getTime()) < 7 * 864e5; }).length;
    var meetPct = avg(all.map(function (x) { return x.st.touched ? x.st.meets / x.st.touched : null; }));
    var nightsAvg = avg(all.map(function (x) { return x.st.touched ? x.st.nights / x.st.touched : null; }));
    var stAvg = avg(all.map(function (x) { return x.st.state; }));
    h += '<div class="kpis">' +
      '<div><span>Участников</span><strong>' + N + '</strong></div>' +
      '<div><span>Активны за 7 дней</span><strong>' + active + ' из ' + N + '</strong></div>' +
      '<div><span>Посещают встречи</span><strong>' + (meetPct == null ? '-' : Math.round(meetPct * 100) + '%') + '</strong></div>' +
      (SHOW_NIGHTS ? '<div><span>Ночей протокола в неделю</span><strong>' + (nightsAvg == null ? '-' : nightsAvg.toFixed(1) + ' из 7') + '</strong></div>' : '') +
      (SHOW_STATE ? '<div><span>Среднее состояние</span><strong>' + (stAvg == null ? '-' : stAvg.toFixed(1) + ' из 5') + '</strong></div>' : '') + '</div>';
    // Сколько людей на каждом тарифе
    var noPlan = P.filter(function (p) { return !planId(p.s); }).length;
    h += '<div class="plan-count">' + PLANS.map(function (pl) {
      var n = P.filter(function (p) { return planId(p.s) === pl.id; }).length;
      return '<span class="pill plan-' + pl.id + '">' + pl.name + ': ' + n + '</span>';
    }).join('') + (noPlan ? '<span class="pill mute">не выбрали: ' + noPlan + '</span>' : '') + '</div>';

    h += '<h3>Каждый участник</h3><div class="tablewrap"><table><thead><tr>' +
      '<th>Участник</th><th>Тариф</th><th>Обновлял(а)</th><th>Недели</th><th>Встречи</th><th>Кураторы</th><th>Дни практики</th>' + (SHOW_NIGHTS ? '<th>Ночи</th>' : '') + '<th>Практики</th><th>Доход в месяц: старт → итог</th>' + (SHOW_STATE ? '<th>Состояние</th>' : '') + '<th>Результаты до → после</th><th><span class="sr">Удалить</span></th>' +
      '</tr></thead><tbody>' + all.map(function (x) {
        var p = x.p, st = x.st, c = p.s.start.cur;
        var mini = '<span class="mini" aria-hidden="true">' + p.s.weeks.map(function (w) { return '<i class="' + (w.meet ? 'y' : '') + '"></i>'; }).join('') + '</span> ';
        var m2 = st.incStart == null ? '-' : st.incEnd == null ? money(st.incStart, c)
          : money(st.incStart, c) + ' → <span class="' + (st.incEnd >= st.incStart ? 'up' : 'down') + '">' + money(st.incEnd, c) + (st.incPct == null ? '' : ' (' + (st.incPct > 0 ? '+' : '') + st.incPct + '%)') + '</span>';
        var res = st.resStart == null ? '-' : st.resStart.toFixed(1) + (st.resEnd == null ? '' : ' → <span class="' + (st.resEnd >= st.resStart ? 'up' : 'down') + '">' + st.resEnd.toFixed(1) + '</span>');
        var sub = [tgNick(p.s.start.tg), p.email, p.id === me.id ? 'это вы' : ''].filter(Boolean).join(' · ');
        return '<tr class="p" tabindex="0" data-pid="' + esc(p.id) + '">' +
          '<td class="nm"><b>' + esc(pname(p)) + (adminIds[p.id] ? ' <span class="pill admin-pill">админ</span>' : '') + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</td>' +
          '<td><select class="plan-select plan-' + (planId(p.s) || 'none') + '" data-rowplan="' + esc(p.id) + '" aria-label="Тариф участника">' +
            (planId(p.s) ? '' : '<option value="">не выбран</option>') +
            PLANS.map(function (pl) { return '<option value="' + pl.id + '"' + (pl.id === planId(p.s) ? ' selected' : '') + '>' + pl.name + '</option>'; }).join('') +
          '</select></td>' +
          '<td>' + freshPill(p.updatedAt) + '</td><td>' + st.touched + ' из 8</td>' +
          '<td>' + mini + st.meets + '</td><td>' + st.curs + '</td><td>' + st.daily + '</td>' + (SHOW_NIGHTS ? '<td>' + st.nights + '</td>' : '') + '<td>' + st.practices + '</td>' +
          '<td>' + m2 + '</td>' + (SHOW_STATE ? '<td>' + (st.state == null ? '-' : st.state.toFixed(1)) + '</td>' : '') + '<td>' + res + '</td>' +
          '<td>' + (p.id !== me.id ? '<button class="ghost danger small" type="button" data-delp="' + esc(p.id) + '">Удалить</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    h += '<h3>Посещаемость по неделям</h3><div class="tablewrap"><table style="min-width:520px"><thead><tr><th>Неделя</th><th>Встреча с Татьяной</th><th>Занятие с куратором</th><th>Бадди</th><th>Практики выполнены</th>' + (SHOW_NIGHTS ? '<th>Ночей в среднем</th>' : '') + '</tr></thead><tbody>' +
      MODULES.map(function (m, i) {
        var ws = P.map(function (p) { return p.s.weeks[i]; });
        var c = function (k) { return ws.filter(function (w) { return w[k]; }).length + ' из ' + N; };
        var n = avg(ws.map(function (w) { return sum(w.nights); }));
        return '<tr><td>' + (i + 1) + (i === wk ? ' <span class="pill good">сейчас</span>' : '') + '</td><td>' + c('meet') + '</td><td>' + c('cur') + '</td><td>' + c('buddy') + '</td><td>' + sum(ws.map(function (w) { return sum(w.practices); })) + ' из ' + N * 3 + '</td>' + (SHOW_NIGHTS ? '<td>' + (n == null ? '-' : n.toFixed(1)) + '</td>' : '') + '</tr>';
      }).join('') + '</tbody></table></div>';

    h += '<h3>С чем пришли участники</h3><div class="hbars">' + SITUATIONS.map(function (t, i) {
      var n = P.filter(function (p) { return p.s.start.sit[i]; }).length;
      return '<div class="hb"><span>' + t + '</span><span class="track"><span class="fill" style="width:' + (n / N * 100).toFixed(0) + '%"></span></span><b>' + n + '</b></div>';
    }).join('') + '</div>';

    h += '<h3>Инсайты и действия недели</h3><div class="chips">' + MODULES.map(function (x, i) { return '<button class="chip fchip" type="button" data-fw="' + i + '" aria-pressed="' + (i === feedWeek) + '">' + (i + 1) + '<small>неделя</small></button>'; }).join('') + '</div>';
    var items = P.filter(function (p) { var w = p.s.weeks[feedWeek]; return w.insight || w.action || w.recap; });
    h += items.length ? '<div class="feed">' + items.map(function (p) {
      var w = p.s.weeks[feedWeek];
      return '<article><h4>' + esc(pname(p)) + '</h4>' +
        (w.insight ? '<p><small>Инсайт</small>' + esc(w.insight) + '</p>' : '') +
        (w.action ? '<p><small>Действие</small>' + esc(w.action) + '</p>' : '') +
        (w.recap ? '<p><small>Итог</small>' + esc(w.recap) + '</p>' : '') + '</article>';
    }).join('') + '</div>' : '<div class="empty">За неделю ' + (feedWeek + 1) + ' пока никто не написал инсайт, действие или итог.</div>';
    $('people').innerHTML = h;
  }

  // Кто из участников администратор. Нужен один раз выполненный supabase/admins-read.sql;
  // без него список просто пустой и отметок нет.
  var adminIds = {};
  function loadAdmins() {
    return sb.from('admins').select('user_id').then(function (r) {
      var next = {};
      (r.data || []).forEach(function (a) { next[a.user_id] = true; });
      adminIds = next;
    }, function () {});
  }
  function loadPeople() {
    loadAdmins().then(function () { if (tab === 'people' && !VIEW) { var ae = document.activeElement; if (!(ae && ae.closest && ae.closest('#people input, #people textarea'))) render(); } });
    return sb.from('trackers').select('user_id,email,data,updated_at').then(function (r) {
      if (r.error) { syncState('err', 'Не удалось загрузить участников: ' + r.error.message); return; }
      people = (r.data || []).filter(function (row) { return valid(row.data); }).map(function (row) {
        return { id: row.user_id, email: row.email, s: norm(row.data), updatedAt: row.updated_at };
      });
      if (VIEW) { var f = people.filter(function (p) { return p.id === VIEW.id; })[0]; if (f) VIEW = f; }
      updHelpAlert();
      // Не перерисовываем, пока администратор что-то вписывает (например, имя куратора)
      var ae = document.activeElement, typing = ae && ae.closest && ae.closest('#people input, #people textarea');
      if ((tab === 'people' || VIEW) && !typing) render();
    });
  }

  function renderViewbar() {
    $('viewbar').innerHTML = VIEW ? '<div class="banner"><p>Вы смотрите трекер участника <b>' + esc(pname(VIEW)) + '</b>. Здесь ничего нельзя изменить.</p>' +
      '<span style="display:flex;gap:8px;flex-wrap:wrap"><button class="ghost gold" type="button" id="back">Вернуться к участникам</button>' +
      (VIEW.id !== me.id ? '<button class="ghost danger" type="button" data-delp="' + esc(VIEW.id) + '">Удалить участника</button>' : '') + '</span></div>' : '';
  }

  // ---------- Встреча недели: эфир и запись ----------
  // Ссылки вставляет администратор. Эфир видят «Поток», «Глубина» и VIP, запись видят все тарифы.
  var meetings = {}, meetingsLoaded = false, meetingsMissing = false, mdraft = null;
  function loadMeetings() {
    return sb.from('meetings').select('*').then(function (r) {
      meetings = {}; meetingsLoaded = true; meetingsMissing = !!r.error;
      (r.data || []).forEach(function (m) { meetings[m.week] = m; });
      if (tab === 'weeks') renderWeeks(); else if (tab === 'records') renderRecords();
    });
  }
  // ---------- Занятия с кураторами ----------
  // Отдельные встречи в течение недели. Неделя программы определяется по дате занятия.
  // Тариф «Записи» без куратора, поэтому блок ему не показывается. Таблица: supabase/curator-sessions.sql
  var csessions = [], csLoaded = false, csMissing = false, cdraft = null;
  function loadCurator() {
    return sb.from('curator_sessions').select('*').order('day').order('time').then(function (r) {
      csLoaded = true; csMissing = !!r.error; csessions = r.data || [];
      if (tab === 'weeks') renderWeeks(); else if (tab === 'records') renderRecords();
    });
  }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  // Постоянное расписание: каждый понедельник в 18:00 по Киеву — занятие с куратором.
  // Если админ сам добавил занятие на этот понедельник (тема, ссылка, запись), показывается оно.
  var CURATOR_WEEKDAY = 1, CURATOR_TIME = '18:00';
  function weekSessions(i) {
    var a = weekStart(i); if (!a) return [];
    var from = ymd(a), to = ymd(addDays(a, weekLen(i) - 1));
    var list = csessions.filter(function (c) { return c.day >= from && c.day <= to; });
    for (var k = 0; k < weekLen(i); k++) {
      var d = addDays(a, k);
      if (d.getDay() === CURATOR_WEEKDAY && !list.some(function (c) { return c.day === ymd(d); }))
        list.push({ id: 'auto-' + ymd(d), auto: true, day: ymd(d), time: CURATOR_TIME, title: '', live_url: '', record_url: '' });
    }
    return list.sort(function (x, y) { return (x.day + x.time).localeCompare(y.day + y.time); });
  }
  // «Расписание недели» под заголовком недели: даты и время эфиров
  function scheduleBlock() {
    var rows = [], md = meetingDate(cur);
    weekSessions(cur).forEach(function (c) { rows.push({ k: c.day + c.time, d: new Date(c.day + 'T00:00:00'), t: c.time, what: 'Занятие с куратором' }); });
    if (md) rows.push({ k: ymd(md) + LESSON_TIME, d: md, t: LESSON_TIME, what: 'Урок с Татьяной' });
    if (!rows.length) return '';
    rows.sort(function (x, y) { return x.k.localeCompare(y.k); });
    var today = ymd(new Date());
    return '<div class="sched"><p class="sched-h">Расписание недели · по Киеву</p>' + rows.map(function (r) {
      var day = r.d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' }), past = ymd(r.d) < today, now = ymd(r.d) === today;
      return '<div class="sched-row' + (past ? ' past' : '') + (now ? ' now' : '') + '"><span class="sched-day">' + day.charAt(0).toUpperCase() + day.slice(1) + '</span><span class="sched-time">' + esc(r.t) + '</span><span class="sched-what">' + r.what + (now ? ' <span class="pill good">сегодня</span>' : '') + '</span></div>';
    }).join('') + '</div>';
  }
  function csWhen(c) {
    var d = new Date(c.day + 'T00:00:00'); if (isNaN(d.getTime())) return '';
    var t = d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    return t.charAt(0).toUpperCase() + t.slice(1) + (c.time ? ', ' + c.time : '');
  }
  function csPast(c) { return c.day < ymd(new Date()); }
  function curatorBlock() {
    if (isRec() && !admin) return '';
    var list = weekSessions(cur), editing = admin && !VIEW;
    var h = '<div class="meet cs"><span class="ci">' + svg('chat') + '</span><div class="hb-text"><b>Занятия с кураторами</b>' +
      '<small>' + (list.length ? 'На этой неделе: ' + list.length : 'Каждый понедельник в ' + CURATOR_TIME + ' по Киеву') + '</small></div>';
    if (list.length) {
      h += '<div class="cs-list">' + list.map(function (c) {
        var live = safeLink(c.live_url), recs = recLinks(c.record_url).filter(safeLink), past = csPast(c);
        var acts = '';
        if (live && !past) acts += '<a class="btnlink" href="' + esc(live) + '" target="_blank" rel="noopener">Подключиться</a>';
        recs.forEach(function (u, k) { acts += '<a class="btnlink ghostlink" href="' + esc(u) + '" target="_blank" rel="noopener">' + (recs.length > 1 ? 'Запись · часть ' + (k + 1) : 'Смотреть запись') + '</a>'; });
        if (!acts) acts = '<span class="meet-wait">' + (past ? 'Запись появится позже' : 'Ссылка появится перед занятием') + '</span>';
        return '<div class="cs-item' + (past ? ' past' : '') + '"><p class="cs-when">' + esc(csWhen(c)) + '</p>' +
          (c.title ? '<p class="cs-title">' + esc(c.title) + '</p>' : '') + '<div class="meet-acts">' + acts + '</div>' +
          (editing && c.auto ? '<div class="actions cs-admin"><button class="ghost small" type="button" data-csauto="' + esc(c.day) + '">Добавить тему и ссылку</button></div>' : '') +
          (editing && !c.auto ? '<div class="actions cs-admin"><button class="ghost small" type="button" data-csedit="' + esc(c.id) + '">Изменить</button><button class="ghost small" type="button" data-csdel="' + esc(c.id) + '">Удалить</button></div>' : '') +
          (editing && cdraft && cdraft.id === c.id ? csEditor() : '') + '</div>';
      }).join('') + '</div>';
    }
    if (editing) {
      if (csMissing) h += '<p class="msg err cs-full">Чтобы добавлять занятия, выполните один раз код curator-sessions.sql в Supabase.</p>';
      else if (cdraft && !cdraft.id) h += '<div class="cs-full">' + csEditor() + '</div>';
      else h += '<div class="actions cs-full"><button class="ghost gold small" type="button" id="cs-add">+ Добавить занятие</button></div>';
    }
    return h + '</div>';
  }
  function csEditor() {
    var d = cdraft;
    return '<div class="meet-edit cs-edit">' +
      '<div class="row"><label class="f" for="cs-day">Дата<input type="date" id="cs-day" data-cdraft="day" value="' + esc(d.day) + '"></label>' +
      '<label class="f" for="cs-time">Время по Киеву<input type="time" id="cs-time" data-cdraft="time" value="' + esc(d.time) + '"></label></div>' +
      '<label class="f" for="cs-title">Тема коротко, 2–3 слова<input type="text" id="cs-title" data-cdraft="title" value="' + esc(d.title) + '" placeholder="Например: Кармический менеджмент" maxlength="40"></label>' +
      '<label class="f" for="cs-live">Ссылка на встречу<input type="text" id="cs-live" data-cdraft="live" value="' + esc(d.live) + '" placeholder="https://"></label>' +
      '<label class="f" for="cs-rec">Ссылки на запись, каждая с новой строки<textarea id="cs-rec" data-cdraft="rec" rows="2" placeholder="https://">' + esc(d.rec) + '</textarea></label>' +
      '<div class="actions"><button class="ghost gold small" type="button" id="cs-save">Сохранить занятие</button><button class="ghost small" type="button" id="cs-cancel">Отмена</button></div></div>';
  }
  function csStart(id) {
    var c = id ? csessions.filter(function (x) { return x.id === id; })[0] : null;
    var a = weekStart(cur), today = ymd(new Date()), from = a ? ymd(a) : today, to = a ? ymd(addDays(a, weekLen(cur) - 1)) : today;
    cdraft = c ? { id: c.id, day: c.day, time: c.time || '', title: c.title || '', live: c.live_url || '', rec: c.record_url || '' }
      : { id: null, day: today >= from && today <= to ? today : from, time: '', title: '', live: '', rec: '' };
    renderWeeks();
  }
  function csSave(btn) {
    var d = cdraft; if (!d) return;
    var live = d.live.trim(), list = recLinks(d.rec);
    if (!d.day) return toast('Укажите дату занятия', 'err');
    if ((live && !safeLink(live)) || list.some(function (u) { return !safeLink(u); })) return toast('Каждая ссылка должна начинаться с https://', 'err');
    var row = { day: d.day, time: d.time.trim(), title: d.title.trim(), live_url: live, record_url: list.join('\n'), updated_at: new Date().toISOString() };
    if (d.id) row.id = d.id;
    btn.disabled = true;
    sb.from('curator_sessions').upsert(row).select().single().then(function (r) {
      btn.disabled = false;
      if (r.error) return toast(/curator_sessions/.test(r.error.message || '') ? 'Нужно один раз выполнить код curator-sessions.sql в Supabase' : 'Не удалось сохранить: ' + r.error.message, 'err');
      csessions = csessions.filter(function (x) { return x.id !== r.data.id; }).concat([r.data]);
      cdraft = null; renderWeeks(); toast('Занятие сохранено');
    });
  }
  function csDelete(id, btn) {
    if (btn.dataset.arm !== '1') {
      btn.dataset.arm = '1'; btn.textContent = 'Точно удалить?';
      setTimeout(function () { if (btn.isConnected) { btn.dataset.arm = ''; btn.textContent = 'Удалить'; } }, 4000);
      return;
    }
    btn.disabled = true;
    sb.from('curator_sessions').delete().eq('id', id).then(function (r) {
      if (r.error) { btn.disabled = false; return toast('Не удалось удалить: ' + r.error.message, 'err'); }
      csessions = csessions.filter(function (x) { return x.id !== id; }); cdraft = null; renderWeeks(); toast('Занятие удалено');
    });
  }

  // ---------- Push-напоминания на телефон ----------
  // Участник включает их один раз на своём устройстве. Рассылает api/remind.js по расписанию из Supabase.
  // На iPhone работают только из трекера, добавленного на экран «Домой» (iOS 16.4+).
  var pushState = 'unknown', swReg = null;
  function pushSupported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function isStandalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function initPush() {
    if (!('serviceWorker' in navigator)) { pushState = 'unsupported'; return; }
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      swReg = reg;
      if (!pushSupported()) { pushState = isIOS() && !isStandalone() ? 'ios-install' : 'unsupported'; return; }
      if (Notification.permission === 'denied') { pushState = 'denied'; return; }
      return reg.pushManager.getSubscription().then(function (sub) {
        pushState = sub ? 'on' : 'off';
        if (sub) savePushSub(sub); // обновляем привязку к текущему участнику
      });
    }).catch(function () { pushState = 'unsupported'; }).then(function () { if (tab === 'start') renderStart(); });
  }
  function b64ToBytes(b64) {
    var pad = '='.repeat((4 - b64.length % 4) % 4), raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out;
  }
  function savePushSub(sub) {
    var j = sub.toJSON(), k = j.keys || {};
    return sb.rpc('save_push_sub', { p_endpoint: j.endpoint, p_p256dh: k.p256dh, p_auth: k.auth });
  }
  function enablePush(btn) {
    if (!swReg) return toast('Обновите страницу и попробуйте ещё раз', 'err');
    btn.disabled = true; btn.textContent = 'Включаем…';
    var fail = function (msg) { btn.disabled = false; btn.textContent = 'Включить напоминания'; toast(msg, 'err'); renderStart(); };
    Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') { pushState = perm === 'denied' ? 'denied' : 'off'; return fail('Без разрешения на уведомления напоминания не придут'); }
      return sb.rpc('push_public_key').then(function (r) {
        if (r.error || !r.data) return fail('Напоминания ещё не настроены. Напишите в чат группы.');
        return swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(r.data) }).then(function (sub) {
          return savePushSub(sub).then(function (s2) {
            if (s2.error) return fail('Не удалось сохранить: ' + s2.error.message);
            pushState = 'on'; renderStart(); toast('Напоминания включены ✓');
            try { swReg.showNotification('Напоминания включены', { body: 'Мы напомним об эфирах за сутки и за час до начала.', icon: 'icons/icon-192.png' }); } catch (e) {}
          });
        });
      });
    }).catch(function (e) { fail('Не получилось включить: ' + (e && e.message || e)); });
  }
  function disablePush() {
    if (!swReg) return;
    swReg.pushManager.getSubscription().then(function (sub) {
      if (!sub) return;
      var ep = sub.endpoint;
      return sub.unsubscribe().then(function () { return sb.rpc('delete_push_sub', { p_endpoint: ep }); });
    }).then(function () { pushState = 'off'; renderStart(); toast('Напоминания выключены'); });
  }
  function pushBlock() {
    if (VIEW || pushState === 'unknown') return '';
    var h = '<div class="meet push"><span class="ci">' + svg('bell') + '</span><div class="hb-text"><b>Напоминания на телефон</b>';
    if (pushState === 'on') return h + '<small>Включены ✓</small></div><div class="meet-acts"><button class="ghost small" type="button" id="push-off">Выключить</button></div></div>';
    if (pushState === 'off') return h + '<small>За сутки и за час до эфира</small></div><div class="meet-acts"><button class="btn" type="button" id="push-on">Включить напоминания</button></div></div>';
    if (pushState === 'denied') return h + '<small>Уведомления запрещены. Разрешите их для этого сайта в настройках телефона или браузера и обновите страницу.</small></div></div>';
    if (pushState === 'ios-install') return h + '<small>На iPhone сначала добавьте трекер на экран «Домой»: «Поделиться» → «На экран „Домой“». Откройте трекер с иконки, и здесь появится кнопка.</small></div></div>';
    return h + '<small>Этот браузер не поддерживает уведомления. Откройте трекер в Chrome или Safari.</small></div></div>';
  }

  // ---------- «Сегодня»: что сделать прямо сейчас ----------
  // Показывается вверху текущей недели. Собирает эфиры сегодня/завтра, ежедневную практику,
  // неотмеченные встречи, открытые практики и пустое действие недели.
  var LESSON_TIME = '09:00';
  function todayIndex() {
    var a = weekStart(cur); if (!a) return -1;
    var d = Math.round((new Date(ymd(new Date()) + 'T00:00:00') - new Date(ymd(a) + 'T00:00:00')) / 864e5);
    return d >= 0 && d < weekLen(cur) ? d : -1;
  }
  function todayBlock() {
    if (VIEW || !S || cur !== currentWeek(S)) return '';
    var w = S.weeks[cur], today = ymd(new Date()), tomorrow = ymd(addDays(new Date(), 1)), items = [];
    var item = function (icon, title, sub, acts) { items.push('<div class="td-item"><span class="ci">' + svg(icon) + '</span><div class="td-text"><b>' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>' + (acts ? '<div class="td-acts">' + acts + '</div>' : '') + '</div>'); };
    var link = function (u, label, ghost) { return '<a class="btnlink' + (ghost ? ' ghostlink' : '') + '" href="' + esc(u) + '" target="_blank" rel="noopener">' + label + '</a>'; };
    // Урок с Татьяной
    var md = meetingDate(cur), m = meetings[cur + 1] || {}, live = safeLink(m.live_url);
    if (md && ymd(md) === today) item('meet', 'Урок с Татьяной в ' + LESSON_TIME, '', !isRec() && live ? link(live, 'Перейти на эфир') : '<span class="meet-wait">Ссылка появится перед встречей</span>');
    else if (md && ymd(md) === tomorrow) item('meet', 'Завтра урок с Татьяной в ' + LESSON_TIME, '', '');
    // Занятия с кураторами
    weekSessions(cur).concat(weekSessions(Math.min(7, cur + 1))).forEach(function (c) {
      if (c.day === today) item('chat', 'Занятие с куратором' + (c.time ? ' в ' + esc(c.time) : ''), '', safeLink(c.live_url) ? link(c.live_url, 'Подключиться') : '<span class="meet-wait">Ссылка появится перед занятием</span>');
      else if (c.day === tomorrow) item('chat', 'Завтра занятие с куратором' + (c.time ? ' в ' + esc(c.time) : ''), '', '');
    });
    // Ежедневная практика
    var di = todayIndex();
    if (hasDaily(cur) && di >= 0) DAILY.forEach(function (d) {
      if (!(w.daily && w.daily[d.key] && w.daily[d.key][di])) item('leaf', d.title, '', link(d.url, 'Открыть ↗', true) + '<button class="ghost gold small" type="button" data-tdaily="' + d.key + '">✓ Сделано</button>');
    });
    // Неотмеченные встречи
    if (md && ymd(md) <= today && !w.meet) item('meet', 'Урок с Татьяной', '', '<button class="ghost gold small" type="button" data-ttick="meet">✓ Отметить</button>');
    if (!w.cur && weekSessions(cur).some(function (c) { return c.day <= today; })) item('chat', 'Занятие с куратором', '', '<button class="ghost gold small" type="button" data-ttick="cur">✓ Отметить</button>');
    // Открытые и не выполненные практики
    openNums(cur + 1).forEach(function (n) {
      if (practiceAccess(cur + 1, n) !== 'ok' || (w.practices || [])[n - 1]) return;
      var p = practices[pkey(cur + 1, n)];
      item('practice', esc((p && p.title) || 'Практика'), '', '<button class="ghost gold small" type="button" data-gopr="' + (n - 1) + '">Открыть</button>');
    });
    // Действие недели
    if (!w.action) item('start', 'Действие недели', '', '<button class="ghost gold small" type="button" data-tfocus="w-action">Написать</button>');
    var dt = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    return '<div class="today"><div class="td-head"><span class="ci">' + svg('today') + '</span><div><h3>Сегодня</h3><small>' + dt.charAt(0).toUpperCase() + dt.slice(1) + '</small></div></div>' +
      (items.length ? items.join('') : '<p class="td-done">На сегодня всё сделано ✨ Отличный ритм!</p>') + '</div>';
  }

  // ---------- Вкладка «Записи»: все записи эфиров в одном месте ----------
  // Записи: по порядку программы — модуль, тема и видео. Без дат и описаний.
  function renderRecords() {
    var last = S ? currentWeek(S) : 7;
    var btns = function (list, label) {
      return list.map(function (u, k) { return '<a class="btnlink ghostlink" href="' + esc(u) + '" target="_blank" rel="noopener">▶ ' + label + (list.length > 1 ? ' · часть ' + (k + 1) : '') + '</a>'; }).join('');
    };
    var h = '<h2>Записи эфиров</h2>';
    for (var i = 0; i <= last; i++) {
      var m = meetings[i + 1] || {}, vids = [], lesson = recLinks(m.record_url).filter(safeLink);
      if (lesson.length) vids.push(btns(lesson, 'Урок с Татьяной'));
      weekSessions(i).forEach(function (c) {
        var cr = recLinks(c.record_url).filter(safeLink);
        if (cr.length) vids.push(btns(cr, 'Занятие с куратором' + (c.title ? ': ' + esc(c.title) : '')));
      });
      h += '<section class="rec-week"><div class="rec-head"><span class="rec-num">' + (i + 1) + '</span><div><p class="eyebrow">Модуль ' + (i + 1) + '</p>' +
        '<h3 class="rec-title">' + esc(MODULES[i][0]) + '</h3></div></div>' +
        (vids.length ? '<div class="rec-vids">' + vids.join('') + '</div>' : '<p class="meet-wait rec-none">Запись появится позже</p>') + '</section>';
    }
    $('records').innerHTML = h;
  }

  // Дата встречи: первый четверг недели программы
  function meetingDate(i) {
    var d = weekStart(i);
    if (!d) return null;
    return addDays(d, (4 - d.getDay() + 7) % 7);
  }
  function meetingBlock() {
    var m = meetings[cur + 1] || {}, live = safeLink(m.live_url), recs = recLinks(m.record_url).filter(safeLink), rec = recs.length > 0;
    var day = meetingDate(cur), when = day ? day.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
    var h = '<div class="meet"><span class="ci">' + svg('meet') + '</span><div class="hb-text"><b>' + (isRec() ? 'Запись встречи с Татьяной' : 'Встреча с Татьяной') + '</b>' +
      '<small>' + (when ? when.charAt(0).toUpperCase() + when.slice(1) : '') + '</small></div><div class="meet-acts">';
    if (!isRec() && live) h += '<a class="btnlink" href="' + esc(live) + '" target="_blank" rel="noopener">Перейти на эфир</a>';
    recs.forEach(function (u, k) {
      h += '<a class="btnlink ghostlink" href="' + esc(u) + '" target="_blank" rel="noopener">' + (recs.length > 1 ? 'Запись · часть ' + (k + 1) : 'Смотреть запись') + '</a>';
    });
    if (!rec && (isRec() || !live)) h += '<span class="meet-wait">' + (isRec() ? 'Запись появится через сутки после эфира' : 'Ссылка появится перед встречей') + '</span>';
    h += '</div>';
    if (admin && !VIEW) {
      if (!mdraft || mdraft.week !== cur + 1) mdraft = { week: cur + 1, live: m.live_url || '', rec: m.record_url || '' };
      h += '<div class="meet-edit">' +
        (meetingsMissing ? '<p class="msg err">Чтобы сохранять ссылки, выполните один раз код meetings.sql в Supabase.</p>' : '') +
        '<label class="f" for="me-live">Ссылка на эфир (видят «Поток», «Глубина», VIP)<input type="text" id="me-live" data-mdraft="live" value="' + esc(mdraft.live) + '" placeholder="https://"></label>' +
        '<label class="f" for="me-rec">Ссылки на запись (видят все). Если запись разделена на части, вставьте каждую ссылку с новой строки<textarea id="me-rec" data-mdraft="rec" rows="3" placeholder="https://… часть 1&#10;https://… часть 2">' + esc(mdraft.rec) + '</textarea></label>' +
        '<div class="actions"><button class="ghost gold small" type="button" id="me-save">Сохранить ссылки</button></div></div>';
    }
    return h + '</div>';
  }
  function saveMeeting(btn) {
    var d = mdraft; if (!d) return;
    var live = d.live.trim(), list = recLinks(d.rec), rec = list.join('\n');
    if ((live && !safeLink(live)) || list.some(function (u) { return !safeLink(u); })) return toast('Каждая ссылка должна начинаться с https://', 'err');
    btn.disabled = true;
    sb.from('meetings').upsert({ week: d.week, live_url: live, record_url: rec, updated_at: new Date().toISOString() }).select().single().then(function (r) {
      btn.disabled = false;
      if (r.error) return toast(/meetings/.test(r.error.message || '') ? 'Нужно один раз выполнить код meetings.sql в Supabase' : 'Не удалось сохранить: ' + r.error.message, 'err');
      meetings[d.week] = r.data; meetingsMissing = false; mdraft = null; renderWeeks();
      toast('Ссылки недели ' + d.week + ' сохранены');
    });
  }

  // ---------- Практики ----------
  // В неделе от 0 до 3 практик. Каждая закрыта, пока администратор не откроет её после вебинара.
  var practices = {}, pdraft = null, practicesLoaded = false;
  function pkey(week, num) { return week + '-' + num; }
  function weekPractices(week) { return [1, 2, 3].map(function (n) { return practices[pkey(week, n)] || null; }); }

  function rich(t) {
    return String(t || '').split(/\n\s*\n/).filter(function (p) { return p.trim(); }).map(function (p) {
      return '<p>' + esc(p.trim()).replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>') + '</p>';
    }).join('');
  }
  function gallery(imgs) {
    imgs = imgs || [];
    if (!imgs.length) return '';
    return '<div class="gallery' + (imgs.length === 1 ? ' one' : '') + '">' + imgs.map(function (im) { return '<img src="' + esc(im.url) + '" alt="" loading="lazy">'; }).join('') + '</div>';
  }
  // Запись урока может быть разделена на части: ссылки хранятся в одном поле, каждая с новой строки
  function recLinks(v) { return String(v || '').split(/\s+/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function safeLink(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }

  function loadPractices() {
    return sb.from('practices').select('*').order('week').order('num').then(function (r) {
      practices = {};
      (r.data || []).forEach(function (p) { practices[pkey(p.week, p.num)] = p; });
      practicesLoaded = true;
      if (!r.error) fixPracticeTexts();
      if (r.error) syncState('err', 'Практики пока не подключены');
      if (tab === 'practice' && !(pdraft && pdraft.dirty)) renderPractice();
      if (tab === 'weeks') renderWeeks();
    });
  }

  // Разовые исправления текстов, которые сайт когда-то сам записал в базу черновиками.
  // Участники сразу видят исправленный текст, а когда заходит администратор, правка сохраняется в базе.
  var TEXT_FIXES = [
    { key: '1-1', from: '9 вопросов', to: '3 вопроса' },
    { key: '1-1', from: 'девять вопросов', to: 'три вопроса' }
  ];
  function fixPracticeTexts() {
    var changed = {};
    TEXT_FIXES.forEach(function (f) {
      var p = practices[f.key]; if (!p) return;
      ['title', 'meta', 'body'].forEach(function (k) {
        if (typeof p[k] === 'string' && p[k].indexOf(f.from) >= 0) { p[k] = p[k].split(f.from).join(f.to); changed[f.key] = true; }
      });
    });
    if (!admin) return;
    Object.keys(changed).forEach(function (key) {
      var p = practices[key];
      sb.from('practices').update({ title: p.title, meta: p.meta, body: p.body }).eq('week', p.week).eq('num', p.num).then(function () {});
    });
  }


  // Содержимое практики хранится в поле body как JSON: суть, для чего, шаги, материалы.
  // Старые практики (обычный текст в body) читаются как «для чего».
  function unpack(p) {
    var b = (p && p.body) || '', o = null;
    if (b.charAt(0) === '{') { try { o = JSON.parse(b); } catch (e) { o = null; } }
    if (!o || o.v !== 2) o = { summary: b.split(/\n\s*\n/)[0] || '', purpose: b, steps: [], media: [] };
    o.steps = (o.steps || []).filter(Boolean); o.media = (o.media || []).slice();
    if (p && safeLink(p.link) && !o.media.some(function (m) { return m.url === p.link; })) o.media.unshift({ url: p.link, name: 'Материалы практики' });
    return o;
  }

  function mediaKind(u) {
    u = String(u || '').toLowerCase().split('?')[0];
    if (/\.(mp3|m4a|wav|ogg|oga|aac)$/.test(u)) return 'audio';
    if (/\.(mp4|webm|mov|m4v)$/.test(u)) return 'video';
    if (/youtube\.com|youtu\.be|vimeo\.com|rutube\.ru/.test(u)) return 'watch';
    if (/\.(pdf|docx?|pptx?|xlsx?|txt)$/.test(u)) return 'file';
    return 'link';
  }
  function mediaHtml(list) {
    return list.filter(function (m) { return safeLink(m.url); }).map(function (m) {
      var k = mediaKind(m.url), name = esc(m.name || ''), url = esc(m.url);
      if (k === 'audio') return '<div class="media"><p class="mname">' + (name || 'Аудио') + '</p><audio controls preload="none" src="' + url + '"></audio></div>';
      if (k === 'video') return '<div class="media"><p class="mname">' + (name || 'Видео') + '</p><video controls preload="metadata" playsinline src="' + url + '"></video></div>';
      var label = k === 'watch' ? 'Смотреть видео' : k === 'file' ? 'Открыть файл' : 'Открыть материалы';
      return '<a class="mlink" href="' + url + '" target="_blank" rel="noopener">' + (name ? name + ' · ' : '') + label + ' →</a>';
    }).join('');
  }

  // Практики, которые выполняются на отдельном сайте-тренажёре: «неделя-номер» -> адрес.
  // Кнопка видна на карточке практики сразу, без раскрытия.
  var PRACTICE_TOOLS = {
    '1-1': 'https://vygody-eight.vercel.app/'
  };
  function practiceToolBtn(week, num) {
    var u = safeLink(PRACTICE_TOOLS[week + '-' + num]);
    return u ? '<a class="btnlink pc-tool" href="' + esc(u) + '" target="_blank" rel="noopener">Пройти практику ↗</a>' : '';
  }

  var openCards = {};
  // ---------- Видео-техники недели ----------
  // Видны сразу, без открытия админом. Ключ — номер недели с нуля (1 = неделя 2).
  // Участник отмечает «✓ Выполнено» (S.weeks[i].vids[id]); в кольцо прогресса не входит.
  var WEEK_VIDEOS = {
    1: [{
      id: 'krutilka', title: 'Техника «Крутилка»', yt: 'eCtOjSd5Qik',
      about: 'Помогает стирать негативный опыт прошлого и возвращать себе энергию, которая в нём ещё осталась.',
      steps: [
        'Вспомните несколько ситуаций из прошлого, которые до сих пор вызывают у вас эмоции или сильно запомнились и с которыми вы ещё не работали: школьные, подростковые годы или что-то недавнее.',
        'Возьмите одну ситуацию и выполняйте технику вместе с Татьяной по видео.',
        'Повторите с каждой ситуацией из вашего списка.'
      ],
      note: 'Пока не берите очень большие события, например начало войны: с ними работаем отдельно.'
    }, {
      id: 'oskolki', title: 'Возвращение осколков души', yt: 'sLDDy_U8NGU',
      about: 'Когда случается травмирующая ситуация, в ней остаётся часть нашей личности. Ситуации давно нет, а эта часть продолжает жить в шоке и стрессе, и вместе с ней уходит наша энергия. Техника помогает увидеть эти осколки души, поблагодарить их и вернуть себе энергию.',
      steps: [
        'Вспомните ситуации и людей, где могли «застрять» ваши части: травмирующие события, расставания и потери, конфликты, отношения, в которые вы много вкладывались.',
        'Включите видео и выполняйте технику вместе с Татьяной.',
        'Обратитесь к своим осколкам: «Дорогие мои осколки, осколки моей души, я вижу вас и я чувствую вашу боль. Я знаю, что вы хотели спасти меня, но это было выше ваших сил».',
        'Поблагодарите их: «Я благодарю вас, что вы защищали меня и приняли на себя эту травму, боль и всю тяжесть». Дальше Татьяна проведёт вас до конца техники.'
      ]
    }, {
      id: 'dpdg', title: 'Десенсибилизация и проработка травм движением глаз', yt: '9QYlp6WLPA0',
      about: 'Помогает снизить эмоциональный заряд тяжёлых воспоминаний с помощью движений глаз, чтобы прошлое перестало так сильно отзываться.',
      steps: [
        'Выберите воспоминание, которое до сих пор вызывает у вас неприятные чувства.',
        'Включите видео и выполняйте движения глазами вместе с Татьяной.',
        'После практики заметьте, как изменились чувства, когда вы снова вспоминаете эту ситуацию.'
      ]
    }]
  };
  var playing = {};
  var SHOW_VIDEO_TEXT = false;
  function weekVideos(i) { return WEEK_VIDEOS[i] || []; }
  function videoCard(v, i) {
    var w = S.weeks[i], done = !!(w.vids && w.vids[v.id]), key = i + '-' + v.id;
    var player = playing[key]
      ? '<iframe class="vid-frame" src="https://www.youtube-nocookie.com/embed/' + v.yt + '?autoplay=1&rel=0" title="' + esc(v.title) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>'
      : '<button class="vid-thumb" type="button" data-play="' + esc(key) + '" aria-label="Смотреть: ' + esc(v.title) + '"><img src="https://i.ytimg.com/vi/' + v.yt + '/hqdefault.jpg" alt="" loading="lazy"><span class="vid-play">▶</span></button>';
    return '<article class="pc vid' + (done ? ' done' : '') + '"><div class="pc-body"><div class="pc-top"><p class="pc-eyebrow">Видео-техника</p>' + (done ? '<span class="pc-done">✓ Выполнено</span>' : '') + '</div>' +
      // Описания (about / steps / note) пока не показываем: только название и видео. Вернуть — SHOW_VIDEO_TEXT = true.
      '<h3 class="pc-title">' + esc(v.title) + '</h3>' + (SHOW_VIDEO_TEXT && v.about ? '<p class="pc-sum">' + esc(v.about) + '</p>' : '') + player +
      (SHOW_VIDEO_TEXT && v.steps ? '<h4 class="vid-h">Как выполнять</h4><ol class="steps">' + v.steps.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' : '') +
      (SHOW_VIDEO_TEXT && v.note ? '<p class="vid-note"><b>Важно:</b> ' + esc(v.note) + '</p>' : '') +
      (VIEW ? '' : '<div class="actions"><button class="' + (done ? 'ghost' : 'btn') + '" type="button" data-vdone="' + esc(v.id) + '">' + (done ? 'Снять отметку' : 'Отметить выполненной') + '</button>' +
        '<a class="plink" href="https://youtu.be/' + v.yt + '" target="_blank" rel="noopener">Открыть в YouTube ↗</a></div>') + '</div></article>';
  }
  function renderPractice() {
    var wk = cur + 1, list = weekPractices(wk), w = S.weeks[cur], h = '';
    var doneN = w.practices.filter(function (v, j) { return v && practiceAccess(wk, j + 1) === 'ok'; }).length, ofN = practicesOpenTo(cur);
    h += '<div class="chips">' + MODULES.map(function (x, i) {
      var n = openNums(i + 1).filter(function (k) { return admin || practiceAccess(i + 1, k) === 'ok'; }).length;
      return '<button class="chip pchip' + (n || weekVideos(i).length ? '' : ' locked') + '" type="button" data-pw="' + i + '" aria-pressed="' + (i === cur) + '">' + (i + 1) + '<small>' + (n ? n + ' ' + practWord(n) : weekVideos(i).length ? 'видео' : 'скоро') + '</small></button>';
    }).join('') + '</div>';
    h += '<div class="mod-head"><h2>Модуль ' + wk + ' · <em>' + MODULES[cur][0] + '</em></h2>' +
      (ofN ? '<div class="mod-prog"><span>Выполнено <b>' + doneN + '</b> из ' + ofN + '</span><span class="thin" role="img" aria-label="Выполнено ' + doneN + ' из ' + ofN + '"><i style="width:' + (doneN / ofN * 100).toFixed(0) + '%"></i></span></div>' : '') + '</div>';
    mountCards();
    // Тренажёры (карты, эмоции, полярности) показываем только в неделе 1, чтобы не путать с практиками других недель
    $('practice-tools').hidden = cur !== 0;
    if (!practicesLoaded) { $('practice-body').innerHTML = h + '<p class="loading">Загружаем практики…</p>'; return; }
    // Участник видит открытые практики; администратор — все созданные (и черновики) и кнопку «Добавить практику»
    var shown = [1, 2, 3].filter(function (n) {
      var p = practices[pkey(wk, n)];
      return admin ? !!p || (pdraft && pdraft.week === wk && pdraft.num === n) : !!(p && p.is_open) && practiceAccess(wk, n) === 'ok';
    });
    var free = [1, 2, 3].filter(function (n) { return !practices[pkey(wk, n)] && !(pdraft && pdraft.week === wk && pdraft.num === n); });
    var vids = weekVideos(cur);
    h += '<div class="plist">' + vids.map(function (v) { return videoCard(v, cur); }).join('') + shown.map(function (n, k) { return practiceCard(list[n - 1], n - 1, k); }).join('') + '</div>';
    if (!shown.length && !vids.length && !admin) h += '<div class="empty">Практики этой недели появятся после встречи с Татьяной.</div>';
    if (admin && free.length) h += '<div class="actions"><button class="ghost gold" type="button" data-pedit="' + free[0] + '">+ Добавить практику</button></div>';
    $('practice-body').innerHTML = h;
  }

  function practiceCard(p, j, k) {
    var wk = cur + 1, num = j + 1, nn = '0' + ((k == null ? j : k) + 1), key = pkey(wk, num);
    var open = !!(p && p.is_open), visible = !!(p && (open || admin));
    var title = (p && p.title) || (p ? 'Практика' : 'Новая практика');
    var isDone = !!S.weeks[cur].practices[j];
    var editing = admin && pdraft && pdraft.week === wk && pdraft.num === num;
    // «Точка сборки» (модуль 5, практика 1) — личная работа с Татьяной, только в «Глубине» и VIP
    // Практика не входит в тариф участника (администратор видит всё)
    var acc = admin ? 'ok' : practiceAccess(wk, num);
    if (acc !== 'ok') {
      return '<article class="pc locked" id="pc-' + key + '"><span class="pc-num" aria-hidden="true">' + nn + '</span><div class="pc-body">' +
        '<p class="pc-eyebrow">Практика ' + nn + '</p><h3 class="pc-title">' + esc(title) + '</h3>' +
        '<p class="pc-lock"><span class="ci mute">' + svg('star') + '</span>' +
        (acc === 'personal' ? 'Личная работа с Татьяной входит в тарифы «Глубина» и VIP' : 'Практика проходит вживую на занятии и входит в тарифы «Поток», «Глубина» и VIP') + '</p></div></article>';
    }
    if (!visible) {
      return '<article class="pc locked" id="pc-' + key + '"><span class="pc-num" aria-hidden="true">' + nn + '</span><div class="pc-body">' +
        '<p class="pc-eyebrow">Практика ' + nn + '</p><h3 class="pc-title">' + esc(title) + '</h3>' +
        '<p class="pc-lock"><span class="ci mute">' + svg('lock') + '</span>' + (admin ? 'Практика ещё не написана' : 'Станет доступна после встречи с Татьяной') + '</p>' +
        (admin ? '<div class="actions"><button class="ghost" type="button" data-pedit="' + num + '">Написать практику</button></div>' + (editing ? practiceEditor() : '') : '') +
        '</div></article>';
    }
    var o = unpack(p), expanded = !!openCards[key] || editing;
    var c = '<article class="pc' + (isDone ? ' done' : '') + (expanded ? ' open' : '') + (open ? '' : ' draft') + '" id="pc-' + key + '">' +
      '<span class="pc-num" aria-hidden="true">' + nn + '</span><div class="pc-body">' +
      '<div class="pc-top"><p class="pc-eyebrow">Практика ' + nn + '</p>' +
      (isDone ? '<span class="pc-done">✓ Выполнено</span>' : '') +
      (admin ? '<span class="pill ' + (open ? 'good' : 'mute') + '">' + (open ? 'открыта' : 'закрыта для участников') + '</span>' : '') + '</div>' +
      '<h3 class="pc-title">' + esc(title) + '</h3>' +
      // Описание и формат практики на карточке не показываем: только название и кнопки
      '' +
      '' +
      practiceToolBtn(wk, num) +
      '<button class="pc-toggle" type="button" data-pcard="' + key + '" aria-expanded="' + expanded + '">' + (expanded ? 'Свернуть ↑' : (PRACTICE_TOOLS[wk + '-' + num] ? 'Описание →' : 'Открыть практику →')) + '</button>';
    if (expanded) {
      c += '<div class="pc-detail">';
      if (o.purpose && o.purpose.trim() !== (o.summary || '').trim()) c += '<h4>Для чего</h4><div class="prose">' + rich(o.purpose) + '</div>';
      if (o.steps.length) c += '<h4>Как выполнять</h4><ol class="steps">' + o.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
      var mats = gallery(p.images) + mediaHtml(o.media);
      if (mats) c += '<h4>Материалы</h4>' + mats;
      if (open) {
        c += '<label class="f pc-notes" for="pn-' + key + '">Что я заметил(а) после практики<textarea id="pn-' + key + '" data-bind="weeks.' + cur + '.pnotes.' + j + '" placeholder="Ощущения, мысли, что изменилось">' + esc(S.weeks[cur].pnotes[j]) + '</textarea></label>' +
          '<div class="actions">' + (isDone
            ? '<span class="pc-done big">✓ Выполнено</span><button class="ghost" type="button" data-pdone="' + j + '">Снять отметку</button>'
            : '<button class="btn" type="button" data-pdone="' + j + '">Отметить выполненной</button>') + '</div>' +
          helpBox('p' + j);
      }
      c += '</div>';
    }
    if (admin && !editing) {
      c += '<div class="actions pc-admin"><button class="ghost" type="button" data-pedit="' + num + '">Изменить</button>' +
        '<button class="ghost gold" type="button" data-ptoggle="' + num + '">' + (open ? 'Закрыть от участников' : 'Открыть участникам') + '</button>' +
        '<button class="ghost" type="button" data-pdel="' + num + '">Удалить</button></div>';
    }
    if (editing) c += practiceEditor();
    return c + '</div></article>';
  }

  function deletePractice(num, btn) {
    var key = pkey(cur + 1, num), p = practices[key]; if (!p || !admin) return;
    if (btn.dataset.arm !== '1') {
      btn.dataset.arm = '1'; btn.textContent = 'Нажмите ещё раз, чтобы удалить';
      setTimeout(function () { if (btn.isConnected) { btn.dataset.arm = ''; btn.textContent = 'Удалить'; } }, 4000);
      return;
    }
    btn.disabled = true;
    sb.from('practices').delete().eq('week', p.week).eq('num', p.num).then(function (r) {
      if (r.error) { btn.disabled = false; return toast('Не удалось удалить: ' + r.error.message, 'err'); }
      delete practices[key]; delete openCards[key]; renderPractice(); toast('Практика удалена');
    });
  }
  function startEdit(num) {
    var p = practices[pkey(cur + 1, num)] || {}, o = unpack(p);
    pdraft = {
      week: cur + 1, num: num, title: p.title || '', meta: p.meta || '',
      summary: o.summary || '', purpose: o.purpose || '', stepsText: o.steps.join('\n'), media: o.media.slice(),
      images: (p.images || []).slice(), is_open: !!p.is_open, newName: '', newUrl: '', dirty: false
    };
    renderPractice();
  }
  function practiceEditor() {
    var d = pdraft;
    return '<div class="editor">' +
      '<label class="f" for="pe-title">Название<input type="text" id="pe-title" data-draft="title" value="' + esc(d.title) + '"></label>' +
      '<label class="f" for="pe-summary">Коротко о сути, одна строка на карточке<input type="text" id="pe-summary" data-draft="summary" value="' + esc(d.summary) + '" placeholder="Зачем выполнять эту практику"></label>' +
      '<label class="f" for="pe-meta">Формат и длительность<input type="text" id="pe-meta" data-draft="meta" value="' + esc(d.meta) + '" placeholder="Например: Письменная практика · 15 минут"></label>' +
      '<label class="f" for="pe-purpose">Для чего практика<textarea id="pe-purpose" data-draft="purpose" placeholder="Подробнее, что даёт практика. Пустая строка начинает новый абзац.">' + esc(d.purpose) + '</textarea></label>' +
      '<label class="f" for="pe-steps">Инструкция по шагам, каждый шаг с новой строки<textarea id="pe-steps" data-draft="stepsText" placeholder="Сядьте удобно и включите запись&#10;Ответьте письменно на первый вопрос&#10;…">' + esc(d.stepsText) + '</textarea></label>' +
      '<div><p class="eyebrow" style="margin-bottom:8px">Картинки</p><div class="thumbs">' + d.images.map(function (im, i) {
        return '<div class="thumb"><img src="' + esc(im.url) + '" alt=""><button type="button" data-rmimg="' + i + '" aria-label="Убрать картинку">✕</button></div>';
      }).join('') + '<label class="upload" for="pe-file">+ Добавить картинки<input type="file" id="pe-file" accept="image/*" multiple></label></div></div>' +
      '<div><p class="eyebrow" style="margin-bottom:8px">Видео, аудио и файлы</p><div class="mlist">' + d.media.map(function (m, i) {
        return '<div class="mrow"><span>' + esc(m.name || m.url) + '<small>' + esc({ audio: 'аудио', video: 'видео', watch: 'видео по ссылке', file: 'файл', link: 'ссылка' }[mediaKind(m.url)]) + '</small></span><button class="ghost small" type="button" data-rmmedia="' + i + '">Убрать</button></div>';
      }).join('') + '</div>' +
      '<div class="row" style="margin-top:8px"><label class="f" for="pe-mname">Название (необязательно)<input type="text" id="pe-mname" data-draft="newName" value="' + esc(d.newName) + '" placeholder="Запись медитации"></label>' +
      '<label class="f" for="pe-murl">Ссылка на YouTube, Google Диск и т. п.<input type="text" id="pe-murl" data-draft="newUrl" value="' + esc(d.newUrl) + '" placeholder="https://"></label></div>' +
      '<div class="actions" style="margin-top:8px"><button class="ghost" type="button" id="pe-madd">Добавить ссылку</button>' +
      '<label class="upload" for="pe-mfile">+ Загрузить аудио, видео или PDF<input type="file" id="pe-mfile" accept="audio/*,video/*,.pdf,.doc,.docx" multiple></label></div></div>' +
      '<div class="actions"><button class="btn" type="button" id="pe-save">Сохранить</button>' +
      '<button class="ghost" type="button" id="pe-cancel">Отмена</button>' +
      '<span class="msg" id="pe-msg" role="status"></span></div></div>';
  }
  function peMsg(text, kind) { var m = $('pe-msg'); if (m) { m.textContent = text; m.className = 'msg' + (kind ? ' ' + kind : ''); } else if (kind === 'err') syncState('err', text); }

  // Большие фото с телефона уменьшаем до 1600 px, чтобы практики быстро открывались
  function shrink(file) {
    return new Promise(function (resolve) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return resolve(file);
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.width, img.height));
        if (k === 1 && file.size < 800000) { URL.revokeObjectURL(url); return resolve(file); }
        var c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        var g = c.getContext('2d'); g.fillStyle = '#031426'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { resolve(b || file); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  // Загрузка в хранилище: картинки уменьшаются, аудио, видео и файлы идут как есть
  function uploadFiles(files, asMedia) {
    var d = pdraft; if (!d || !files || !files.length) return;
    peMsg(asMedia ? 'Загружаем файлы… Большое видео может грузиться несколько минут.' : 'Загружаем картинки…');
    Array.prototype.reduce.call(files, function (chain, f) {
      return chain.then(function () {
        if (f.size > 50 * 1024 * 1024) throw new Error('файл «' + f.name + '» больше 50 МБ. Загрузите его на YouTube или Google Диск и добавьте ссылкой');
        return (asMedia ? Promise.resolve(f) : shrink(f)).then(function (blob) {
          var ext = blob.type === 'image/jpeg' && !asMedia ? 'jpg' : ((f.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin');
          var path = 'practices/week-' + d.week + '-' + d.num + '/' + (asMedia ? 'files/' : '') + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
          return sb.storage.from('media').upload(path, blob, { contentType: blob.type || f.type || 'application/octet-stream', upsert: false }).then(function (r) {
            if (r.error) throw r.error;
            var url = sb.storage.from('media').getPublicUrl(path).data.publicUrl;
            if (asMedia) d.media.push({ url: url, name: f.name.replace(/\.[^.]+$/, ''), path: path });
            else d.images.push({ path: path, url: url });
          });
        });
      });
    }, Promise.resolve()).then(function () {
      d.dirty = true; renderPractice(); peMsg('Добавлено. Нажмите «Сохранить».');
    }, function (e) {
      renderPractice(); peMsg('Не удалось загрузить: ' + (e && e.message || e), 'err');
    });
  }
  function savePractice() {
    var d = pdraft;
    var body = JSON.stringify({
      v: 2, summary: d.summary.trim(), purpose: d.purpose,
      steps: d.stepsText.split('\n').map(function (s) { return s.replace(/^\s*\d+[.)]\s*/, '').trim(); }).filter(Boolean),
      media: d.media
    });
    var row = { week: d.week, num: d.num, title: d.title.trim(), meta: d.meta.trim(), body: body, link: '', images: d.images, is_open: d.is_open, updated_at: new Date().toISOString() };
    peMsg('Сохраняем…');
    sb.from('practices').upsert(row).select().single().then(function (r) {
      if (r.error) return peMsg('Не удалось сохранить: ' + r.error.message, 'err');
      practices[pkey(d.week, d.num)] = r.data; pdraft = null; openCards[pkey(d.week, d.num)] = true; renderPractice();
      toast(r.data.is_open ? 'Сохранено, участники видят практику' : 'Сохранено, участники пока не видят практику');
    });
  }
  function togglePractice(num, btn) {
    var p = practices[pkey(cur + 1, num)]; if (!p) return;
    btn.disabled = true;
    sb.from('practices').update({ is_open: !p.is_open, updated_at: new Date().toISOString() }).eq('week', p.week).eq('num', p.num).select().single().then(function (r) {
      if (r.error) { btn.disabled = false; return syncState('err', 'Не удалось изменить доступ: ' + r.error.message); }
      practices[pkey(p.week, p.num)] = r.data; renderPractice();
      toast(r.data.is_open ? 'Практика ' + num + ' открыта участникам' : 'Практика ' + num + ' закрыта');
    });
  }
  function goPractice(j) {
    openCards[pkey(cur + 1, j + 1)] = true;
    show('practice');
    var el = $('pc-' + pkey(cur + 1, j + 1));
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // ---------- Помощь куратора ----------
  // Участник отправляет запрос: он хранится в его трекере (S.help).
  // Администратор видит запросы всех участников, а свои отметки «передано» и «решено»
  // хранит в своём трекере (S.helpAdmin), поэтому новых таблиц в базе не нужно.
  var helpUI = null, lastHelpCount = null;
  function fmtWhen(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '') + ', ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  function helpCtx(h) {
    var s = 'Неделя ' + h.week;
    if (h.practice) {
      var p = practices[pkey(h.week, h.practice)];
      s += ' · Практика' + (p && p.title ? ': ' + p.title : ' ' + h.practice);
    }
    return s;
  }
  function activeHelp() { return (S.help || []).filter(function (h) { return !h.cancelled; }); }

  // Блок для участника: кнопка, форма и статус отправленного запроса
  // Срок ответа куратора, который видят участники
  var HELP_RESPONSE = 'в течение 24 часов';
  function helpBox(key) {
    // Кнопку «Нужен куратор» убрали: вопросы участники задают в общем чате
    return '';
    if (VIEW) return '';
    var isPractice = key.charAt(0) === 'p', h = '';
    // В тарифе «Записи» куратора нет: вопросы задают в общем чате потока
    if (isRec()) return isPractice ? '' : '<div class="helpbox"><span class="ci">' + svg('chat') + '</span><div class="hb-text"><b>Есть вопрос?</b><small>Задайте его в общем чате потока. Личный куратор входит в тарифы «Поток», «Глубина» и VIP.</small></div></div>';
    var mine = activeHelp().filter(function (r) { return !isPractice || (r.week === cur + 1 && r.practice === Number(key.slice(1)) + 1); });
    var formOpen = helpUI && helpUI.key === key;
    if (!formOpen) {
      if (isPractice) {
        if (!mine.length) h += '<button class="ghost help-ghost" type="button" data-help="' + key + '">' + svg('chat') + 'Написать куратору об этой практике</button>';
      } else {
        h += '<div class="helpbox"><span class="ci">' + svg('chat') + '</span><div class="hb-text"><b>Нужна помощь куратора?</b><small>Обычно вопросы удобно задавать в чате группы. Если нужен куратор лично, напишите здесь: он ответит ' + HELP_RESPONSE + '.</small></div>' +
          '<button class="btn" type="button" data-help="' + key + '">Написать куратору</button></div>';
      }
    } else {
      h += '<div class="helpform"><p class="hf-title">' + svg('chat') + (isPractice ? 'Написать куратору об этой практике' : 'Написать куратору') + '</p>' +
        '<label class="f" for="help-text">Ваш вопрос<textarea id="help-text" data-hdraft="text" placeholder="Например: не получается выполнить практику, поднялось много эмоций">' + esc(helpUI.text) + '</textarea></label>' +
        // Ник спрашиваем только у тех, кто зарегистрировался до появления этого поля
        (tgNick(S.start.tg) ? '' : '<label class="f" for="help-tg">Ваш ник в Telegram, чтобы куратор мог вам написать<input type="text" id="help-tg" data-hdraft="tg" value="' + esc(helpUI.tg) + '" placeholder="@nickname" autocapitalize="off" spellcheck="false"></label>') +
        '<p class="scale" style="margin:0">Куратор напишет вам в Telegram ' + (tgNick(S.start.tg) ? '(' + esc(tgNick(S.start.tg)) + ') ' : '') + HELP_RESPONSE + '.</p>' +
        '<div class="actions"><button class="btn" type="button" data-hsend="1">Отправить</button><button class="ghost" type="button" data-hclose="1">Отмена</button></div></div>';
    }
    if (mine.length) {
      h += '<div class="hsent">' + mine.map(function (r) {
        return '<div class="hs-row"><span class="ci">' + svg('chat') + '</span><span class="hs-text"><b>Запрос отправлен.</b> Куратор свяжется с вами ' + HELP_RESPONSE + '.' +
          '<small>' + fmtWhen(r.at) + ' · ' + esc(helpCtx(r)) + (r.text ? ' · «' + esc(r.text) + '»' : '') + '</small></span>' +
          '<button class="ghost small" type="button" data-hcancel="' + esc(r.id) + '">Отменить</button></div>';
      }).join('') + '</div>';
    }
    return h;
  }
  function sendHelp() {
    var text = (helpUI.text || '').trim();
    if (!tgNick(S.start.tg)) {
      var nick = tgNick(helpUI.tg);
      if (!nick) return toast('Напишите ник в Telegram, например @anna_ivanova', 'err');
      S.start.tg = nick;
    }
    var contact = tgNick(S.start.tg);
    if (!S.help) S.help = [];
    S.help.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: new Date().toISOString(), week: cur + 1, practice: helpUI.practice, text: text, contact: contact });
    var id = S.help[S.help.length - 1].id;
    helpUI = null;
    clearTimeout(saveTimer);
    toast('Отправляем…');
    render();
    // Сначала сохраняем трекер, потом просим сервер прислать уведомление в Telegram
    sb.from('trackers').upsert({ user_id: me.id, data: S }).then(function (r) {
      if (r.error) { syncState('err', 'Не удалось отправить запрос. Проверьте интернет и попробуйте ещё раз'); return; }
      syncState('on', savedLabel());
      toast('Запрос отправлен. Куратор свяжется с вами ' + HELP_RESPONSE);
      notifyTelegram({ id: id });
    });
  }
  function notifyTelegram(payload) {
    return sb.auth.getSession().then(function (s) {
      var token = s.data.session && s.data.session.access_token;
      if (!token) return null;
      return fetch('api/notify-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(payload)
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; }); });
    }).catch(function () { return null; });
  }
  function testTelegram(btn) {
    btn.disabled = true; btn.textContent = 'Отправляем…';
    notifyTelegram({ test: true }).then(function (r) {
      btn.disabled = false; btn.textContent = 'Проверить Telegram';
      if (!r) return toast('Не удалось связаться с сервером', 'err');
      if (r.status === 200) return toast('Готово: проверьте Telegram ✓');
      if (r.status === 503) return toast('Telegram ещё не подключён в Vercel', 'err');
      var e = r.body && r.body.sent && r.body.sent.filter(function (x) { return !x.ok; })[0];
      toast('Telegram не принял сообщение' + (e && e.error ? ': ' + e.error : ''), 'err');
    });
  }

  // Администратор: список запросов
  function helpRequests() {
    var st = (S && S.helpAdmin) || {}, out = [];
    people.forEach(function (p) {
      (p.s.help || []).forEach(function (h) { if (!h.cancelled) out.push({ p: p, h: h, st: st[h.id] || null }); });
    });
    return out.sort(function (a, b) { return String(b.h.at).localeCompare(String(a.h.at)); });
  }
  function helpSection() {
    var all = helpRequests();
    if (!all.length) return '';
    var active = all.filter(function (x) { return !x.st || x.st.state !== 'done'; }), done = all.filter(function (x) { return x.st && x.st.state === 'done'; });
    var item = function (x) {
      var st = x.st, state = st ? st.state : 'new', who = esc(pname(x.p));
      var nickHtml = tgNick(x.h.contact) || tgNick(x.p.s.start.tg) ? tgLink(x.h.contact || x.p.s.start.tg) : esc(x.h.contact || '');
      var contacts = [nickHtml, esc(x.p.email || '')].filter(Boolean).join(' · ');
      var pill = state === 'new' ? '<span class="pill hot">Новый</span>' : state === 'passed' ? '<span class="pill warn">Передано: ' + esc(st.curator || 'куратору') + '</span>' : '<span class="pill good">Решено</span>';
      var acts = state === 'new'
        ? '<input type="text" id="hc-' + esc(x.h.id) + '" placeholder="Имя куратора" aria-label="Имя куратора"><button class="btn warm small" type="button" data-hpass="' + esc(x.h.id) + '">Передать куратору</button><button class="ghost small" type="button" data-hdone="' + esc(x.h.id) + '">Решено</button>'
        : state === 'passed' ? '<button class="ghost small" type="button" data-hdone="' + esc(x.h.id) + '">Решено</button>'
        : '<button class="ghost small" type="button" data-hreopen="' + esc(x.h.id) + '">Вернуть в работу</button>';
      return '<article class="hreq st-' + state + '"><div class="hr-top"><b>' + who + '</b>' + planPill(x.p.s) + pill + '</div>' +
        '<p class="hr-ctx">' + esc(helpCtx(x.h)) + ' · ' + fmtWhen(x.h.at) + '</p>' +
        (x.h.text ? '<p class="hr-text">' + esc(x.h.text) + '</p>' : '') +
        (contacts ? '<p class="hr-contact">' + contacts + '</p>' : '') +
        '<div class="actions hr-acts">' + acts + '</div></article>';
    };
    return '<section class="helpsec" id="help"><h3>Запросы помощи куратора</h3>' +
      (active.length ? active.map(item).join('') : '<p class="note">Новых запросов нет.</p>') +
      (done.length ? '<details class="hdone"><summary>Решённые: ' + done.length + '</summary>' + done.map(item).join('') + '</details>' : '') +
      '</section>';
  }
  // ---------- Напоминания об эфирах в Telegram-группу ----------
  // Сервер: api/remind.js, расписание и отметки: supabase/reminders.sql
  var remSt = null, remChats = null, remLoading = false;
  function loadReminderStatus() {
    if (remLoading) return; remLoading = true;
    sb.rpc('reminder_status').then(function (r) {
      remLoading = false;
      remSt = r.error ? { missing: true } : (r.data || {});
      // Ключи push создаются сами при первом входе администратора
      if (!remSt.missing && !remSt.push_ready) remCall({ action: 'push-setup' }).then(function (x) { if (x && x.status === 200) remSt.push_ready = true; if (tab === 'people' && !VIEW) renderPeople(); });
      if (tab === 'people' && !VIEW) renderPeople();
    });
  }
  function remCall(payload) {
    return sb.auth.getSession().then(function (s) {
      var token = s.data.session && s.data.session.access_token; if (!token) return null;
      return fetch('api/remind', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; }); });
    }).catch(function () { return null; });
  }
  function reminderSection() {
    if (!remSt) { loadReminderStatus(); return ''; }
    var h = '<section class="helpsec remsec"><h3>Напоминания об эфирах</h3>' +
      '<p class="note">За сутки и за час до начала: урок с Татьяной по четвергам в 9:00 по Киеву и занятия с кураторами, у которых указано время. Ссылка на эфир берётся из трекера.</p>';
    if (remSt.missing) return h + '<p class="msg err">Чтобы включить напоминания, выполните один раз код reminders.sql в Supabase.</p></section>';
    h += '<p class="rem-st"><b>На телефон:</b> ' + (remSt.push_ready ? 'включили ' + (remSt.push_subs || 0) + ' ' + devWord(remSt.push_subs || 0) + '. Участники включают их сами на вкладке «Старт».' : 'настраиваются…') +
      (remSt.cron ? '' : ' · <span class="down">расписание не запущено</span>') + '</p>';
    if (remSt.push_ready) h += '<div class="actions"><button class="ghost gold small" type="button" id="push-test">Отправить тестовое уведомление мне</button></div>';
    h += '<p class="rem-st"><b>В Telegram-группу</b> (по желанию): ' + (remSt.chat_id ? '✓ <b>' + esc(remSt.chat_title || remSt.chat_id) + '</b>' : 'группа не выбрана') + '</p>';
    if (remChats) {
      h += remChats.length ? '<div class="rem-chats">' + remChats.map(function (c) {
        return '<button class="ghost small" type="button" data-remchat="' + esc(c.id) + '" data-remtitle="' + esc(c.title) + '">Выбрать «' + esc(c.title) + '»</button>';
      }).join('') + '</div>' : '<p class="note">Группы не нашлись. Добавьте бота в группу участников, напишите в группе любое сообщение и нажмите «Найти группу» ещё раз.</p>';
    }
    h += '<div class="actions"><button class="ghost gold small" type="button" id="rem-find">' + (remSt.chat_id ? 'Сменить группу' : 'Найти группу') + '</button>' +
      (remSt.chat_id ? '<button class="ghost small" type="button" id="rem-test">Отправить проверку</button>' : '') + '</div></section>';
    return h;
  }
  function devWord(n) { var a = n % 10, b = n % 100; return a === 1 && b !== 11 ? 'устройство' : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'устройства' : 'устройств'; }
  function remErr(r) {
    if (!r) return 'Не удалось связаться с сервером';
    if (r.status === 503) return 'Бот Telegram ещё не подключён в Vercel (TELEGRAM_BOT_TOKEN)';
    return (r.body && r.body.error) || 'Ошибка ' + r.status;
  }
  function remFind(btn) {
    btn.disabled = true; btn.textContent = 'Ищем…';
    remCall({ action: 'find' }).then(function (r) {
      btn.disabled = false;
      if (!r || r.status !== 200) { renderPeople(); return toast(remErr(r), 'err'); }
      remChats = r.body.chats || []; renderPeople();
    });
  }
  function remChoose(id, title) {
    sb.rpc('set_reminder_chat', { chat: id, title: title }).then(function (r) {
      if (r.error) return toast('Не удалось сохранить: ' + r.error.message, 'err');
      remChats = null; remSt.chat_id = id; remSt.chat_title = title; renderPeople(); toast('Напоминания будут приходить в «' + title + '»');
    });
  }
  function pushTest(btn) {
    btn.disabled = true; btn.textContent = 'Отправляем…';
    remCall({ action: 'push-test' }).then(function (r) {
      btn.disabled = false; btn.textContent = 'Отправить тестовое уведомление мне';
      if (r && r.status === 200) return toast('Отправлено на ваши устройства: ' + r.body.ok + ' ✓');
      toast((r && r.body && r.body.error) || 'Не удалось отправить', 'err');
    });
  }
  function remTest(btn) {
    btn.disabled = true; btn.textContent = 'Отправляем…';
    remCall({ action: 'test' }).then(function (r) {
      btn.disabled = false; btn.textContent = 'Отправить проверку';
      if (r && r.status === 200) return toast('Готово: проверьте группу ✓');
      toast(remErr(r), 'err');
    });
  }
  function setHelpState(id, state) {
    if (!S.helpAdmin) S.helpAdmin = {};
    if (state === 'passed') {
      var inp = $('hc-' + id), name = inp ? inp.value.trim() : '';
      if (!name) { if (inp) inp.focus(); return toast('Впишите имя куратора', 'err'); }
      S.helpAdmin[id] = { state: 'passed', curator: name, at: new Date().toISOString() };
      toast('Передано куратору: ' + name);
    } else if (state === 'done') {
      S.helpAdmin[id] = { state: 'done', curator: S.helpAdmin[id] && S.helpAdmin[id].curator, at: new Date().toISOString() };
      toast('Отмечено как решённое');
    } else delete S.helpAdmin[id];
    clearTimeout(saveTimer); flush();
    renderPeople(); updHelpAlert();
  }

  // Яркое напоминание для администратора на любой вкладке
  function updHelpAlert() {
    if (!admin) return;
    var fresh = helpRequests().filter(function (x) { return !x.st; });
    var n = fresh.length, bar = $('helpbar'), tabBtn = $('t-people');
    if (tabBtn) {
      var b = tabBtn.querySelector('.badge');
      if (n && !b) { b = document.createElement('span'); b.className = 'badge'; tabBtn.appendChild(b); }
      if (b) { if (n) b.textContent = n; else b.remove(); }
    }
    var names = fresh.map(function (x) { return pname(x.p).split(/\s+/)[0]; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    bar.innerHTML = n ? '<button class="helpbar" type="button" data-gohelp="1"><span class="hb-bell">' + svg('bell') + '</span><span class="hb-txt"><b>Нужна помощь куратора: ' + n + '</b><small>' + esc(names.slice(0, 3).join(', ')) + (names.length > 3 ? ' и ещё ' + (names.length - 3) : '') + ' · открыть</small></span></button>' : '';
    document.title = (n ? '(' + n + ') ' : '') + 'Трекер 8 недель';
    if (lastHelpCount != null && n > lastHelpCount) {
      toast('Новый запрос помощи куратора');
      try { if (navigator.vibrate) navigator.vibrate([120, 80, 120]); } catch (e) {}
    }
    lastHelpCount = n;
  }

  // ---------- Инструменты ----------
  // Отдельные сайты-тренажёры команды. Открываются в новой вкладке: у каждого свой прогресс
  // на телефоне, и каждый можно поставить на главный экран отдельным значком.
  var TOOLS = [
    { url: 'https://practici-karty.vercel.app/', icon: 'cards', title: 'Метафорические карты', tag: 'Вторичные выгоды',
      text: 'Рандомайзер колоды МАК. Сформулируйте запрос, вытяните 1 или 3 карты, ответьте на вопросы к карте. Расклады сохраняются в дневнике.' },
    { url: 'https://emotional-pi.vercel.app/', icon: 'heart', title: 'Проработка эмоций', tag: 'Шкала эмоций',
      text: 'Девять уровней от Апатии до Мира. Отмечайте проработанные состояния и следите за прогрессом за день.' },
    { url: 'https://practici-polyarnosti.vercel.app/', icon: 'yinyang', title: 'Проработка полярностей', tag: 'Протокол «Слив»',
      text: 'Пары полярностей порциями по 10–15, можно пропускать и добавлять свои личные полярности.' }
  ];
  // Под практиками недели: ссылки на сайты-тренажёры. Каждый открывается отдельно, в новой вкладке.
  function toolsHTML() {
    return '<div class="mak"><h2>Техники</h2>' +
      '<div class="tools">' + TOOLS.map(function (t) {
        return '<a class="tool" href="' + esc(t.url) + '" target="_blank" rel="noopener">' +
          '<span class="ci">' + svg(t.icon) + '</span>' +
          '<span class="tool-body"><b>' + esc(t.title) + '</b></span>' +
          '<span class="tool-go">Открыть<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg></span></a>';
      }).join('') + '</div></div>';
  }
  function mountCards() { if (!$('practice-tools').innerHTML) $('practice-tools').innerHTML = toolsHTML(); }

  // ---------- Навигация ----------
  function render() {
    renderViewbar();
    if (tab === 'start') renderStart(); else if (tab === 'weeks') renderWeeks(); else if (tab === 'total') renderTotal();
    else if (tab === 'practice') renderPractice(); else if (tab === 'records') renderRecords(); else renderPeople();
  }
  function show(t) {
    tab = t;
    if (t === 'people' || t === 'practice' || t === 'records') VIEW = null;
    document.querySelectorAll('#tabs .tab').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.tab === t ? 'true' : 'false'); });
    ['start', 'weeks', 'practice', 'records', 'total', 'people'].forEach(function (id) { $(id).hidden = id !== t; });
    $('reset').hidden = t === 'people' || t === 'practice' || t === 'records' || !!VIEW;
    render();
    window.scrollTo(0, 0);
  }
  function openPerson(pid) {
    var p = people.filter(function (x) { return x.id === pid; })[0]; if (!p) return;
    VIEW = p; cur = currentWeek(p.s); show('start');
  }

  // ---------- Сохранение ----------
  function syncState(kind, text) {
    $('sync').className = 'sync' + (kind ? ' ' + kind : ''); $('sync-text').textContent = text;
    if (kind === 'err') toast(text, 'err');
  }
  var toastTimer = null;
  function toast(text, kind) {
    var t = $('toast'); t.textContent = text; t.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast' + (kind ? ' ' + kind : ''); }, kind === 'err' ? 4500 : 1600);
  }
  function savedLabel() { return admin ? 'Сохранено' : 'Сохранено. Ваши отметки видит Татьяна'; }
  function touch() {
    syncState('on', 'Сохраняем…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 1000);
  }
  function flush() {
    if (writing) { again = true; return; }
    writing = true;
    sb.from('trackers').upsert({ user_id: me.id, data: S }).then(function (r) {
      if (r.error) { syncState('err', 'Не удалось сохранить. Проверьте интернет, попробуем ещё раз'); again = true; }
      else { syncState('on', savedLabel()); if (!$('toast').classList.contains('show')) toast('Сохранено ✓'); }
    }).then(function () {
      writing = false;
      if (again) { again = false; setTimeout(flush, 2000); }
    });
  }
  window.addEventListener('beforeunload', function (e) { if (saveTimer && (writing || $('sync-text').textContent === 'Сохраняем…')) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- События трекера ----------
  // Удаление участника: первое нажатие спрашивает, второе удаляет аккаунт целиком
  function deleteParticipant(btn) {
    var id = btn.dataset.delp, p = people.filter(function (x) { return x.id === id; })[0];
    if (btn.dataset.arm !== '1') {
      btn.dataset.arm = '1'; btn.textContent = 'Точно удалить?';
      setTimeout(function () { if (btn.isConnected && btn.dataset.arm === '1') { btn.dataset.arm = ''; btn.textContent = btn.closest('.banner') ? 'Удалить участника' : 'Удалить'; } }, 4000);
      return;
    }
    btn.disabled = true; btn.textContent = 'Удаляем…';
    sb.rpc('delete_participant', { target: id }).then(function (r) {
      if (r.error && /delete_participant/.test(r.error.message || '')) {
        // Функции ещё нет в базе: удаляем хотя бы трекер
        return sb.from('trackers').delete().eq('user_id', id).then(function (r2) {
          return r2.error ? r2 : { error: null, partial: true };
        });
      }
      return r;
    }).then(function (r) {
      if (r.error) { btn.disabled = false; btn.dataset.arm = ''; btn.textContent = 'Удалить'; return syncState('err', 'Не удалось удалить: ' + r.error.message); }
      people = people.filter(function (x) { return x.id !== id; });
      VIEW = null; show('people');
      toast((p ? pname(p) : 'Участник') + (r.partial ? ': трекер удалён' : ' удалён(а)'));
    });
  }

  document.addEventListener('click', function (e) {
    var dp = e.target.closest('[data-delp]');
    if (dp) { e.stopPropagation(); return deleteParticipant(dp); }
    if (e.target.closest('select')) return;
    var row = e.target.closest('tr.p');
    if (row) return openPerson(row.dataset.pid);
    var t = e.target.closest('button'); if (!t || !S) return;
    if (t.id === 'back') return show('people');
    if (t.id === 'refresh') { t.textContent = 'Обновляем…'; return loadPeople(); }
    if (t.id === 'tg-test') return testTelegram(t);
    if (t.id === 'rem-find') return remFind(t);
    if (t.id === 'rem-test') return remTest(t);
    if (t.id === 'push-test') return pushTest(t);
    if (t.dataset.remchat) return remChoose(t.dataset.remchat, t.dataset.remtitle);
    if (t.id === 'logout') { sb.auth.signOut(); return; }
    if (t.closest('#tabs') && t.dataset.tab) return show(t.dataset.tab);
    if (t.classList.contains('pchip')) {
      if (pdraft && pdraft.dirty && t.dataset.arm !== '1') { t.dataset.arm = '1'; peMsg('Есть несохранённые изменения. Нажмите неделю ещё раз, чтобы уйти без сохранения.', 'err'); return; }
      cur = Number(t.dataset.pw); pdraft = null; return renderPractice();
    }
    if (t.dataset.help) {
      var hk = t.dataset.help;
      helpUI = { key: hk, practice: hk.charAt(0) === 'p' ? Number(hk.slice(1)) + 1 : null, text: '', contact: (activeHelp().slice(-1)[0] || {}).contact || '' };
      render(); var ht = $('help-text'); if (ht) ht.focus();
      return;
    }
    if (t.dataset.hclose) { helpUI = null; return render(); }
    if (t.dataset.hsend) return sendHelp();
    if (t.dataset.hcancel) {
      (S.help || []).forEach(function (h) { if (h.id === t.dataset.hcancel) h.cancelled = true; });
      clearTimeout(saveTimer); flush(); toast('Запрос отменён'); return render();
    }
    if (t.dataset.hpass) return setHelpState(t.dataset.hpass, 'passed');
    if (t.dataset.hdone) return setHelpState(t.dataset.hdone, 'done');
    if (t.dataset.hreopen) return setHelpState(t.dataset.hreopen, 'new');
    if (t.dataset.gohelp) {
      show('people');
      var hs = $('help'); if (hs) hs.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    if (t.dataset.setplan) {
      if (!VIEW || !admin) return;
      var vid = VIEW.id, np = t.dataset.setplan;
      t.disabled = true;
      sb.rpc('set_participant_plan', { target: vid, p: np }).then(function (r) {
        if (r.error) {
          t.disabled = false;
          return toast(/set_participant_plan/.test(r.error.message || '') ? 'Нужно один раз выполнить код admin-tools.sql в Supabase' : 'Не удалось поменять тариф: ' + r.error.message, 'err');
        }
        VIEW.s.start.plan = np;
        people.forEach(function (p) { if (p.id === vid) p.s.start.plan = np; });
        render();
        toast('Тариф участника: ' + plan(VIEW.s).name);
      });
      return;
    }
    if (t.dataset.plan) {
      if (VIEW || (planId() && !admin)) return;
      S.start.plan = t.dataset.plan; touch(); renderStart(); updHead();
      toast('Тариф: ' + plan().name);
      return;
    }
    if (t.dataset.goplan) { show('start'); var pb = $('plan-block'); if (pb) pb.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    if (t.dataset.pcard) { openCards[t.dataset.pcard] = !openCards[t.dataset.pcard]; return renderPractice(); }
    if (t.dataset.gopr != null) { e.preventDefault(); return goPractice(Number(t.dataset.gopr)); }
    if (t.dataset.play) { playing[t.dataset.play] = true; return renderPractice(); }
    if (t.dataset.vdone) { var vw = S.weeks[cur]; if (!vw.vids) vw.vids = {}; vw.vids[t.dataset.vdone] = vw.vids[t.dataset.vdone] ? 0 : 1; touch(); renderPractice(); if (vw.vids[t.dataset.vdone]) toast('Отмечено ✓'); return; }
    if (t.dataset.govid) { show('practice'); return; }
    if (t.dataset.tdaily) { var di = todayIndex(); if (di >= 0) { S.weeks[cur].daily[t.dataset.tdaily][di] = 1; touch(); renderWeeks(); toast('Отмечено ✓'); } return; }
    if (t.dataset.ttick) { S.weeks[cur][t.dataset.ttick] = 1; touch(); renderWeeks(); toast('Отмечено ✓'); return; }
    if (t.dataset.tfocus) { var fe = $(t.dataset.tfocus); if (fe) { fe.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(function () { fe.focus(); }, 350); } return; }
    if (t.dataset.pdone != null) {
      var pj = Number(t.dataset.pdone), pv = S.weeks[cur].practices[pj] ? 0 : 1;
      S.weeks[cur].practices[pj] = pv; touch(); renderPractice();
      if (pv) toast('Практика выполнена ✓');
      return;
    }
    if (t.id === 'pe-madd') {
      var u = (pdraft.newUrl || '').trim();
      if (!safeLink(u)) return peMsg('Вставьте ссылку, которая начинается с https://', 'err');
      pdraft.media.push({ url: u, name: (pdraft.newName || '').trim() }); pdraft.newUrl = ''; pdraft.newName = ''; pdraft.dirty = true;
      renderPractice(); return peMsg('Ссылка добавлена. Нажмите «Сохранить».');
    }
    if (t.dataset.rmmedia != null) { pdraft.media.splice(Number(t.dataset.rmmedia), 1); pdraft.dirty = true; renderPractice(); return peMsg('Убрано. Нажмите «Сохранить».'); }
    if (t.id === 'me-save') return saveMeeting(t);
    if (t.id === 'cs-add') return csStart(null);
    if (t.id === 'push-on') return enablePush(t);
    if (t.id === 'push-off') return disablePush();
    if (t.id === 'cs-save') return csSave(t);
    if (t.id === 'cs-cancel') { cdraft = null; return renderWeeks(); }
    if (t.dataset.csedit) return csStart(t.dataset.csedit);
    if (t.dataset.csauto) { cdraft = { id: null, day: t.dataset.csauto, time: CURATOR_TIME, title: '', live: '', rec: '' }; return renderWeeks(); }
    if (t.dataset.csdel) return csDelete(t.dataset.csdel, t);
    if (t.id === 'pe-save') return savePractice();
    if (t.id === 'pe-cancel') { pdraft = null; return renderPractice(); }
    if (t.dataset.pedit) {
      if (pdraft && pdraft.dirty) return peMsg('Сначала сохраните или отмените практику, которую вы редактируете.', 'err');
      return startEdit(Number(t.dataset.pedit));
    }
    if (t.dataset.ptoggle) return togglePractice(Number(t.dataset.ptoggle), t);
    if (t.dataset.pdel) return deletePractice(Number(t.dataset.pdel), t);
    if (t.dataset.rmimg != null) { pdraft.images.splice(Number(t.dataset.rmimg), 1); pdraft.dirty = true; renderPractice(); return peMsg('Картинка убрана. Нажмите «Сохранить».'); }
    if (t.classList.contains('fchip')) { feedWeek = Number(t.dataset.fw); return renderPeople(); }
    if (t.classList.contains('chip')) { cur = Number(t.dataset.w); return renderWeeks(); }
    if (t.classList.contains('col')) { cur = Number(t.dataset.w); return show('weeks'); }
    if (t.classList.contains('dot')) {
      if (VIEW) return;
      var path = t.dataset.path, k = Number(t.dataset.k), p = path.split('.'), o = S;
      for (var i = 0; i < p.length - 1; i++) o = o[p[i]];
      var last = p[p.length - 1]; o[last] = o[last] === k ? 0 : k; touch();
      t.closest('.dots').querySelectorAll('.dot').forEach(function (d) { d.setAttribute('aria-pressed', String(o[last] >= Number(d.dataset.k))); });
      if (tab === 'total') renderTotal();
      return;
    }
    if (t.id === 'reset') {
      if (t.dataset.arm === '1') { var nm = S.start.name; S = blank(); S.start.name = nm; touch(); t.dataset.arm = ''; t.textContent = 'Очистить мой трекер'; show(tab); }
      else { t.dataset.arm = '1'; t.textContent = 'Нажмите ещё раз, чтобы стереть все отметки'; setTimeout(function () { t.dataset.arm = ''; t.textContent = 'Очистить мой трекер'; }, 4000); }
    }
  });
  document.addEventListener('keydown', function (e) {
    var row = e.target.closest && !e.target.closest('button, select') && e.target.closest('tr.p');
    if (row &&(e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPerson(row.dataset.pid); }
  });
  document.addEventListener('input', function (e) {
    var dr = e.target.getAttribute && e.target.getAttribute('data-draft');
    if (dr && pdraft) { pdraft[dr] = e.target.value; pdraft.dirty = true; return; }
    var cd = e.target.getAttribute && e.target.getAttribute('data-cdraft');
    if (cd && cdraft) { cdraft[cd] = e.target.value; return; }
    var md = e.target.getAttribute && e.target.getAttribute('data-mdraft');
    if (md && mdraft) { mdraft[md] = e.target.value; return; }
    var hd = e.target.getAttribute && e.target.getAttribute('data-hdraft');
    if (hd && helpUI) { helpUI[hd] = e.target.value; return; }
    if (VIEW || !S) return;
    var p = e.target.getAttribute && e.target.getAttribute('data-bind'); if (!p) return;
    set(p, e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : e.target.value);
    touch();
    if (/^weeks\.\d+\.(meet|cur|buddy|nights|daily|practices|vip)/.test(p)) updDone();
    if (p === 'start.name' || p === 'start.date') updHead();
    if (p === 'end.income') updIncome();
  });
  document.addEventListener('change', function (e) {
    if (e.target.id === 'pe-file') { uploadFiles(e.target.files, false); return; }
    if (e.target.id === 'pe-mfile') { uploadFiles(e.target.files, true); return; }
    // Смена тарифа участнику прямо из таблицы «Участники»
    if (e.target.dataset && e.target.dataset.rowplan) {
      var sel = e.target, uid = sel.dataset.rowplan, np = sel.value;
      if (!np || !admin) return;
      sel.disabled = true;
      sb.rpc('set_participant_plan', { target: uid, p: np }).then(function (r) {
        sel.disabled = false;
        if (r.error) {
          renderPeople();
          return toast(/set_participant_plan/.test(r.error.message || '') ? 'Нужно один раз выполнить код admin-tools.sql в Supabase' : 'Не удалось поменять тариф: ' + r.error.message, 'err');
        }
        var who = '';
        people.forEach(function (p) { if (p.id === uid) { p.s.start.plan = np; who = pname(p); } });
        renderPeople();
        toast(who + ': тариф ' + PLANS.filter(function (pl) { return pl.id === np; })[0].name);
      });
      return;
    }
    if (VIEW || !S) return;
    if (e.target.id === 's-cur') { set('start.cur', e.target.value); touch(); }
  });

  // ---------- Вход ----------
  var mode = 'login';
  function screen(name) {
    $('loading').hidden = name !== 'loading';
    $('auth').hidden = name !== 'auth';
    $('recover').hidden = name !== 'recover';
    $('app').hidden = name !== 'app';
    $('hero').hidden = name === 'app';
    $('apphead').hidden = name !== 'app';
    if (name === 'app') updHead();
  }
  function decorateTab(b) {
    if (!b.querySelector('.ti')) b.innerHTML = '<span class="ti">' + svg(b.dataset.tab) + '</span><span class="tl">' + esc(b.textContent) + '</span>';
  }
  document.querySelectorAll('#tabs .tab').forEach(decorateTab);
  function authMsg(text, kind) { var m = $('a-msg'); m.textContent = text || ''; m.className = 'msg' + (kind ? ' ' + kind : ''); }
  function setMode(m) {
    mode = m;
    $('a-login').setAttribute('aria-selected', String(m === 'login'));
    $('a-signup').setAttribute('aria-selected', String(m === 'signup'));
    $('a-name-wrap').hidden = m !== 'signup';
    $('a-tg-wrap').hidden = m !== 'signup';
    $('a-plan-wrap').hidden = m !== 'signup';
    $('a-pass-wrap').hidden = m === 'forgot';
    $('a-forgot').hidden = m !== 'login';
    $('a-pass').autocomplete = m === 'signup' ? 'new-password' : 'current-password';
    $('a-submit').textContent = m === 'login' ? 'Войти' : m === 'signup' ? 'Зарегистрироваться' : 'Прислать ссылку для нового пароля';
    authMsg('');
  }
  $('a-login').addEventListener('click', function () { setMode('login'); });
  $('a-signup').addEventListener('click', function () { setMode('signup'); });
  $('a-forgot').addEventListener('click', function () { setMode('forgot'); });

  function ruError(err) {
    var m = (err && err.message || '').toLowerCase();
    if (m.indexOf('invalid login') >= 0) return 'Неверный email или пароль.';
    if (m.indexOf('already registered') >= 0 || m.indexOf('already been registered') >= 0) return 'Этот email уже зарегистрирован. Перейдите на вкладку «Вход».';
    if (m.indexOf('password') >= 0 && m.indexOf('6') >= 0) return 'Пароль должен быть не короче 6 символов.';
    if (m.indexOf('email not confirmed') >= 0) return 'Email ещё не подтверждён. Проверьте почту.';
    if (m.indexOf('rate limit') >= 0) return 'Слишком много попыток. Подождите немного и попробуйте снова.';
    if (m.indexOf('invalid') >= 0 && m.indexOf('email') >= 0) return 'Проверьте email: похоже, в нём ошибка.';
    return 'Не получилось: ' + (err && err.message || 'неизвестная ошибка');
  }

  $('auth-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('a-email').value.trim(), pass = $('a-pass').value, btn = $('a-submit');
    if (!email) return authMsg('Введите email.', 'err');
    if (mode !== 'forgot' && pass.length < 6) return authMsg('Пароль должен быть не короче 6 символов.', 'err');
    if (mode === 'signup' && !$('a-name').value.trim()) return authMsg('Напишите, как вас зовут.', 'err');
    if (mode === 'signup' && !tgNick($('a-tg').value)) return authMsg('Напишите ник в Telegram, например @anna_ivanova. Его можно посмотреть в Telegram: Настройки, затем Имя пользователя.', 'err');
    if (mode === 'signup' && !$('a-plan').value) return authMsg('Выберите ваш тариф.', 'err');
    btn.disabled = true; authMsg('Секунду…');
    var p;
    if (mode === 'login') p = sb.auth.signInWithPassword({ email: email, password: pass });
    else if (mode === 'signup') { pendingName = $('a-name').value.trim(); pendingTg = tgNick($('a-tg').value); pendingPlan = $('a-plan').value; p = sb.auth.signUp({ email: email, password: pass }); }
    else p = sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    p.then(function (r) {
      btn.disabled = false;
      if (r.error) return authMsg(ruError(r.error), 'err');
      if (mode === 'forgot') return authMsg('Готово. Проверьте почту и перейдите по ссылке из письма.', 'ok');
      if (mode === 'signup' && !r.data.session) return authMsg('Мы отправили письмо для подтверждения. Откройте его и вернитесь сюда.', 'ok');
    });
  });

  $('rec-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var pass = $('rec-pass').value, m = $('rec-msg');
    if (pass.length < 6) { m.textContent = 'Пароль должен быть не короче 6 символов.'; m.className = 'msg err'; return; }
    sb.auth.updateUser({ password: pass }).then(function (r) {
      if (r.error) { m.textContent = ruError(r.error); m.className = 'msg err'; return; }
      history.replaceState(null, '', location.pathname);
      sb.auth.getSession().then(function (s) { enter(s.data.session); });
    });
  });

  // ---------- Запуск ----------
  function enter(session) {
    if (!session) { booted = false; me = null; S = null; VIEW = null; clearInterval(peopleTimer); screen('auth'); setMode('login'); return; }
    if (booted && me && me.id === session.user.id) { if (S) screen('app'); return; }
    booted = true; me = session.user; screen('loading');
    $('who-email').textContent = me.email;
    Promise.all([
      sb.from('trackers').select('data').eq('user_id', me.id).maybeSingle(),
      sb.rpc('is_admin')
    ]).then(function (r) {
      var row = r[0].data, isNew = !row || !valid(row.data);
      S = isNew ? blank() : norm(row.data);
      if (isNew && pendingName) S.start.name = pendingName;
      if (isNew && pendingTg) S.start.tg = pendingTg;
      if (isNew && pendingPlan) S.start.plan = pendingPlan;
      admin = r[1].data === true;
      var pt = $('t-people');
      if (admin && !pt) {
        var b = document.createElement('button');
        b.className = 'tab owner'; b.setAttribute('role', 'tab'); b.id = 't-people'; b.dataset.tab = 'people'; b.setAttribute('aria-selected', 'false');
        b.textContent = 'Участники'; decorateTab(b);
        $('tabs').insertBefore(b, $('tabs').firstChild);
      } else if (!admin && pt) pt.remove();
      cur = currentWeek(S);
      pdraft = null; openCards = {}; mdraft = null; cdraft = null; loadPractices(); loadMeetings(); loadCurator();
      if (pushState === 'unknown') initPush(); else if (pushState === 'on' && swReg) swReg.pushManager.getSubscription().then(function (sub) { if (sub) savePushSub(sub); });
      screen('app');
      syncState('on', isNew ? (admin ? 'Готово' : 'Готово. Татьяна увидит ваши отметки') : savedLabel());
      if (isNew) flush();
      if (r[0].error) syncState('err', 'Не удалось загрузить трекер: ' + r[0].error.message);
      if (admin) {
        show('people'); loadPeople();
        clearInterval(peopleTimer);
        // Раз в минуту проверяем отметки и новые запросы помощи, на любой вкладке
        peopleTimer = setInterval(function () { if (!document.hidden) loadPeople(); }, 60000);
      } else { if (S.start.name && planId()) cur = currentWeek(S); show(S.start.name && planId() ? 'weeks' : 'start'); }
    });
  }

  if (!sb) {
    screen('auth');
    $('auth-form').hidden = true;
    authMsg('');
    $('auth').querySelector('.auth').insertAdjacentHTML('beforeend', '<p class="msg err">Сайт ещё не подключён к базе. Впишите ключи Supabase в файл config.js.</p>');
    return;
  }

  sb.auth.onAuthStateChange(function (event, session) {
    if (event === 'PASSWORD_RECOVERY') { screen('recover'); return; }
    if (event === 'SIGNED_OUT') { enter(null); return; }
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
      // Supabase просит не делать запросы прямо внутри этого обработчика
      setTimeout(function () { if ($('recover').hidden) enter(session); }, 0);
    }
  });
})();
