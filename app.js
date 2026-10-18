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
  var DEFAULT_START = '2026-11-01';

  var cfg = window.TRACKER_CONFIG || {};
  var sb = window.supabase && cfg.supabaseUrl && cfg.supabaseUrl.indexOf('YOUR-') < 0
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  var tab = 'start', cur = 0, S = null, me = null, admin = false;
  var people = [], VIEW = null, feedWeek = 0, peopleTimer = null;
  var saveTimer = null, writing = false, again = false, booted = false, pendingName = '', pendingTg = '';

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

  function blankWeek() { return { meet: 0, group: 0, chat: 0, buddy: 0, practices: [0, 0, 0], pnotes: ['', '', ''], nights: [0, 0, 0, 0, 0, 0, 0], s0: 0, s1: 0, insight: '', action: '', recap: '' }; }
  function blank() {
    var w = []; for (var i = 0; i < 8; i++) w.push(blankWeek());
    return { start: { name: '', cur: '€', date: DEFAULT_START, income: '', sit: [0, 0, 0, 0, 0], res: [0, 0, 0, 0, 0] }, weeks: w, end: { income: '', res: [0, 0, 0, 0, 0] } };
  }
  function valid(o) { return o && o.weeks && o.weeks.length === 8 && o.start && o.end; }
  function norm(o) {
    if (o.start.name == null) o.start.name = '';
    if (o.start.tg == null) o.start.tg = '';
    // Доход фиксируется дважды: на старте и в конце программы (в месяц)
    if (o.start.income == null) o.start.income = '';
    if (o.end.income == null) o.end.income = '';
    o.weeks.forEach(function (w) {
      if (!Array.isArray(w.practices)) w.practices = [0, 0, 0];
      if (!Array.isArray(w.pnotes)) w.pnotes = ['', '', ''];
      delete w.practice; delete w.income;
    });
    return o;
  }
  function set(path, val) { var p = path.split('.'), last = p.pop(), o = p.reduce(function (a, k) { return a[k]; }, S); o[last] = val; }

  function weekRange(i) {
    var d = D().start.date ? new Date(D().start.date + 'T00:00:00') : null;
    if (!d || isNaN(d.getTime())) return '';
    var a = new Date(d.getTime() + i * 7 * 864e5), b = new Date(a.getTime() + 6 * 864e5);
    var f = function (x) { return x.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', ''); };
    return f(a) + ' - ' + f(b);
  }
  function currentWeek(s) {
    var d = s.start.date ? new Date(s.start.date + 'T00:00:00') : null;
    if (!d || isNaN(d.getTime())) return 0;
    return Math.min(7, Math.max(0, Math.floor((Date.now() - d.getTime()) / (7 * 864e5))));
  }
  function done(w) { return w.meet + w.group + w.chat + w.buddy + sum(w.practices || []) + sum(w.nights); }

  function stats(s) {
    var W = s.weeks, states = [];
    W.forEach(function (w) { if (w.s0) states.push(w.s0); if (w.s1) states.push(w.s1); });
    var rs = s.start.res.filter(Boolean), re = s.end.res.filter(Boolean);
    var touched = W.filter(function (w) { return done(w) > 0 || w.insight || w.action || w.recap || w.s0 || w.s1; }).length;
    var a = num(s.start.income), b = num(s.end.income);
    return {
      incStart: a, incEnd: b,
      incPct: a != null && b != null && a > 0 ? Math.round((b - a) / a * 100) : null,
      meets: sum(W.map(function (w) { return w.meet; })),
      groups: sum(W.map(function (w) { return w.group; })),
      nights: sum(W.map(function (w) { return sum(w.nights); })),
      practices: sum(W.map(function (w) { return sum(w.practices); })),
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
    setRing($('ah-ring'), done(S.weeks[wk]), 14);
  }

  function renderStart() {
    var v = D().start, h = '';
    h += '<h2>Точка старта</h2><p class="note">Отметьте, что вам знакомо, и оцените, где вы сейчас. В конце программы вы посмотрите, как изменилось ваше состояние и ваши решения.</p>';
    h += '<div class="block"><h3>О вас</h3><div class="row"><label class="f" for="s-name">Как вас зовут<input type="text" id="s-name" data-bind="start.name" value="' + esc(v.name) + '" placeholder="Имя и фамилия" autocomplete="name"' + dis() + '></label>' +
      '<label class="f" for="s-tg">Ник в Telegram<input type="text" id="s-tg" data-bind="start.tg" value="' + esc(v.tg) + '" placeholder="@nickname" autocapitalize="off" spellcheck="false"' + dis() + '></label>' +
      '<label class="f" for="s-date">Старт программы<input type="date" id="s-date" data-bind="start.date" value="' + esc(v.date) + '"' + dis() + '></label></div></div>';
    h += '<div class="block"><h3>Доход на старте</h3><div class="row">' +
      '<label class="f" for="s-income">Ваш доход в месяц сейчас<input type="number" inputmode="numeric" id="s-income" data-bind="start.income" value="' + esc(v.income) + '" placeholder="0"' + dis() + '></label>' +
      '<label class="f" for="s-cur">Валюта<select id="s-cur" data-bind="start.cur"' + dis() + '>' + ['€', '$', '₴'].map(function (c) { return '<option' + (v.cur === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></label></div>' +
      '<p class="scale">В конце программы вы запишете доход ещё раз во вкладке «Итоги» и увидите, как он изменился.</p></div>';
    h += '<div class="block"><h3>Что вы узнаёте в себе</h3><div class="sitlist">' + SITUATIONS.map(function (t, i) {
      return chkRow('sit-' + i, 'start.sit.' + i, v.sit[i], t);
    }).join('') + '</div></div>';
    h += '<div class="block"><h3>Где вы сейчас по результатам программы</h3><div class="cmp">' + RESULTS.map(function (t, i) {
      return '<div class="item"><span class="name">' + t + '</span>' + dotsRow('start.res.' + i, v.res[i]) + '</div>';
    }).join('') + '</div><p class="scale">От 1, когда это совсем не про меня, до 5, когда это уже так.</p></div>';
    $('start').innerHTML = h;
  }
  function renderWeeks() {
    var w = D().weeks[cur], M = MODULES[cur], h = '';
    h += '<div class="chips" id="chips">' + MODULES.map(function (x, i) { return '<button class="chip" type="button" data-w="' + i + '" aria-pressed="' + (i === cur) + '">' + (i + 1) + '<small>неделя</small></button>'; }).join('') + '</div>';
    var rng = weekRange(cur);
    h += '<div class="wk-head"><div><p class="eyebrow">Неделя ' + (cur + 1) + (rng ? ' · ' + rng : '') + '</p><h2>' + M[0] + '</h2></div><div class="ring" id="w-ring" role="img"></div></div>';
    h += helpBox('w');
    h += '<div class="themes"><div class="theme"><h3>Что прорабатываем</h3><p>' + M[1] + '</p></div><div class="theme"><h3>Результат модуля</h3><p>' + M[2] + '</p></div></div>';
    h += '<div class="block"><h3>На этой неделе</h3><div class="checks">' +
      chkRow('w-meet', 'weeks.' + cur + '.meet', w.meet, 'Живая встреча с Татьяной', '', 'meet') +
      chkRow('w-group', 'weeks.' + cur + '.group', w.group, 'Групповая терапия', '', 'group') +
      chkRow('w-chat', 'weeks.' + cur + '.chat', w.chat, 'Сообщение психотерапевту в чате', 'Личный психотерапевт отвечает с обратной связью', 'chat') +
      chkRow('w-buddy', 'weeks.' + cur + '.buddy', w.buddy, 'Созвон с бадди', '', 'buddy') +
      '</div></div>';
    h += '<div class="block"><h3>Практики модуля</h3><div class="checks">' + [0, 1, 2].map(function (j) {
      var p = practices[pkey(cur + 1, j + 1)], def = defPractice(cur + 1, j + 1);
      var title = esc((p && p.title) || (def ? def[2] : 'Практика ' + (j + 1)));
      var go = VIEW ? '' : '<button class="plink" type="button" data-gopr="' + j + '">Открыть практику →</button>';
      if (p && p.is_open) return chkRow('w-p' + j, 'weeks.' + cur + '.practices.' + j, w.practices[j], title, esc(p.meta) + go, 'leaf');
      return '<div class="crow has-ico"><span class="ci mute">' + svg('lock') + '</span><span>' + title + '<small>Станет доступна после встречи с Татьяной</small></span><span class="pill mute">закрыта</span></div>';
    }).join('') + '</div></div>';
    var d0 = new Date((D().start.date || DEFAULT_START) + 'T00:00:00');
    h += '<div class="block"><h3>Протокол для подсознания во сне</h3><div class="nights">' + [0, 1, 2, 3, 4, 5, 6].map(function (n) {
      var day = isNaN(d0.getTime()) ? null : new Date(d0.getTime() + (cur * 7 + n) * 864e5);
      var wd = day ? day.toLocaleDateString('ru-RU', { weekday: 'short' }) : 'ночь';
      return '<label class="night" for="w-n' + n + '"><b>' + wd + '</b><input class="chk moon" type="checkbox" id="w-n' + n + '" data-bind="weeks.' + cur + '.nights.' + n + '"' + (w.nights[n] ? ' checked' : '') + dis() + ' aria-label="' + (day ? day.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Ночь ' + (n + 1)) + '">' + (day ? day.getDate() : n + 1) + '</label>';
    }).join('') + '</div><p class="scale">Отмечайте ночи, когда вы слушали протокол перед сном.</p></div>';
    h += '<div class="block"><h3>Действие недели</h3><input type="text" id="w-action" data-bind="weeks.' + cur + '.action" value="' + esc(w.action) + '" placeholder="Один шаг, который приведёт к деньгам, а не только к инсайту"' + dis() + '></div>';
    h += '<div class="block"><h3>Состояние: энергия и ясность</h3><div class="scales">' +
      '<div class="week"><span>В начале недели</span>' + dotsRow('weeks.' + cur + '.s0', w.s0) + '</div>' +
      '<div class="week"><span>В конце недели</span>' + dotsRow('weeks.' + cur + '.s1', w.s1) + '</div>' +
      '</div><p class="scale">От 1, когда нет сил, до 5, когда ясно и легко.</p></div>';
    h += '<div class="block"><h3>Главный инсайт</h3><textarea id="w-insight" data-bind="weeks.' + cur + '.insight" placeholder="Главный инсайт недели, своими словами"' + dis() + '>' + esc(w.insight) + '</textarea></div>';
    h += '<div class="block"><h3>Итог недели</h3><textarea id="w-recap" data-bind="weeks.' + cur + '.recap" placeholder="Что изменилось в действиях и в деньгах, что берёте в следующую неделю"' + dis() + '>' + esc(w.recap) + '</textarea></div>';
    $('weeks').innerHTML = h; lastDone = null; updDone();
    var chip = document.querySelector('.chip[data-w="' + cur + '"]'), box = $('chips');
    if (chip && box) box.scrollLeft = Math.max(0, chip.offsetLeft - 16);
  }
  var lastDone = null;
  function updDone() {
    var v = done(D().weeks[cur]);
    setRing($('w-ring'), v, 14);
    if (!VIEW && lastDone != null && lastDone < 14 && v >= 14) toast('Неделя ' + (cur + 1) + ' пройдена полностью ✦');
    lastDone = v;
    if (!VIEW) updHead();
  }

  function renderTotal() {
    var s = D(), W = s.weeks, st = stats(s), h = '';
    h += '<h2>Итоги программы</h2><p class="note">Встречи, практики и состояние собираются из недель. Доход вы записываете здесь в конце программы.</p>';
    h += '<div class="kpis">' +
      '<div><span>Встречи с Татьяной</span><strong>' + st.meets + ' из 8</strong></div>' +
      '<div><span>Групповые терапии</span><strong>' + st.groups + ' из 8</strong></div>' +
      '<div><span>Практики</span><strong>' + st.practices + ' из 24</strong></div>' +
      '<div><span>Ночей с протоколом</span><strong>' + st.nights + ' из 56</strong></div></div>';
    h += '<div class="income"><h3>Доход: старт и итог</h3>' +
      '<div class="row"><label class="f" for="e-income">Ваш доход в месяц в конце программы, ' + esc(s.start.cur) + '<input type="number" inputmode="numeric" id="e-income" data-bind="end.income" value="' + esc(s.end.income) + '" placeholder="0"' + dis() + '></label></div>' +
      '<div id="inc-cmp"></div></div>';
    h += '<h3 style="margin-top:26px">Состояние по неделям</h3><div class="statebar">' + W.map(function (w, i) {
      var a = [w.s0, w.s1].filter(Boolean); a = a.length ? sum(a) / a.length : 0;
      return '<i title="Неделя ' + (i + 1) + ': ' + (a ? a.toFixed(1) + ' из 5' : 'нет данных') + '" style="opacity:' + (a ? (0.2 + a / 5 * 0.8).toFixed(2) : 0.08) + '"></i>';
    }).join('') + '</div><p class="legend">Чем ярче, тем выше среднее состояние недели.</p>';
    h += '<h3 style="margin-top:30px">Результаты программы: до и после</h3><div class="cmp">' + RESULTS.map(function (t, i) {
      var b = s.start.res[i], a = s.end.res[i];
      return '<div class="item"><span class="name">' + t + '</span>' +
        '<div class="pair"><span>До</span><span class="track"><span class="fill" style="width:' + b * 20 + '%"></span></span><span>' + (b || '-') + '</span></div>' +
        '<div class="pair"><span>После</span><span class="track"><span class="fill after" style="width:' + a * 20 + '%"></span></span><span>' + (a || '-') + '</span></div>' +
        dotsRow('end.res.' + i, a) + '</div>';
    }).join('') + '</div><p class="scale">Оцените, где вы сейчас, на тех же пяти результатах, что и на старте.</p>';
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
      '<div><span>Ночей протокола в неделю</span><strong>' + (nightsAvg == null ? '-' : nightsAvg.toFixed(1) + ' из 7') + '</strong></div>' +
      '<div><span>Среднее состояние</span><strong>' + (stAvg == null ? '-' : stAvg.toFixed(1) + ' из 5') + '</strong></div></div>';

    h += '<h3>Каждый участник</h3><div class="tablewrap"><table><thead><tr>' +
      '<th>Участник</th><th>Обновлял(а)</th><th>Недели</th><th>Встречи</th><th>Группы</th><th>Ночи</th><th>Практики</th><th>Доход в месяц: старт → итог</th><th>Состояние</th><th>Результаты до → после</th><th><span class="sr">Удалить</span></th>' +
      '</tr></thead><tbody>' + all.map(function (x) {
        var p = x.p, st = x.st, c = p.s.start.cur;
        var mini = '<span class="mini" aria-hidden="true">' + p.s.weeks.map(function (w) { return '<i class="' + (w.meet ? 'y' : '') + '"></i>'; }).join('') + '</span> ';
        var m2 = st.incStart == null ? '-' : st.incEnd == null ? money(st.incStart, c)
          : money(st.incStart, c) + ' → <span class="' + (st.incEnd >= st.incStart ? 'up' : 'down') + '">' + money(st.incEnd, c) + (st.incPct == null ? '' : ' (' + (st.incPct > 0 ? '+' : '') + st.incPct + '%)') + '</span>';
        var res = st.resStart == null ? '-' : st.resStart.toFixed(1) + (st.resEnd == null ? '' : ' → <span class="' + (st.resEnd >= st.resStart ? 'up' : 'down') + '">' + st.resEnd.toFixed(1) + '</span>');
        var sub = [tgNick(p.s.start.tg), p.email, p.id === me.id ? 'это вы' : ''].filter(Boolean).join(' · ');
        return '<tr class="p" tabindex="0" data-pid="' + esc(p.id) + '">' +
          '<td class="nm"><b>' + esc(pname(p)) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</td>' +
          '<td>' + freshPill(p.updatedAt) + '</td><td>' + st.touched + ' из 8</td>' +
          '<td>' + mini + st.meets + '</td><td>' + st.groups + '</td><td>' + st.nights + '</td><td>' + st.practices + '</td>' +
          '<td>' + m2 + '</td><td>' + (st.state == null ? '-' : st.state.toFixed(1)) + '</td><td>' + res + '</td>' +
          '<td>' + (p.id !== me.id ? '<button class="ghost danger small" type="button" data-delp="' + esc(p.id) + '">Удалить</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    h += '<h3>Посещаемость по неделям</h3><div class="tablewrap"><table style="min-width:520px"><thead><tr><th>Неделя</th><th>Встреча с Татьяной</th><th>Групповая терапия</th><th>Чат с психотерапевтом</th><th>Бадди</th><th>Практики выполнены</th><th>Ночей в среднем</th></tr></thead><tbody>' +
      MODULES.map(function (m, i) {
        var ws = P.map(function (p) { return p.s.weeks[i]; });
        var c = function (k) { return ws.filter(function (w) { return w[k]; }).length + ' из ' + N; };
        var n = avg(ws.map(function (w) { return sum(w.nights); }));
        return '<tr><td>' + (i + 1) + (i === wk ? ' <span class="pill good">сейчас</span>' : '') + '</td><td>' + c('meet') + '</td><td>' + c('group') + '</td><td>' + c('chat') + '</td><td>' + c('buddy') + '</td><td>' + sum(ws.map(function (w) { return sum(w.practices); })) + ' из ' + N * 3 + '</td><td>' + (n == null ? '-' : n.toFixed(1)) + '</td></tr>';
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

  function loadPeople() {
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

  // ---------- Практики ----------
  // В каждой неделе три практики. Каждая закрыта, пока администратор не откроет её после вебинара.
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
  function safeLink(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }

  function loadPractices() {
    return sb.from('practices').select('*').order('week').order('num').then(function (r) {
      practices = {};
      (r.data || []).forEach(function (p) { practices[pkey(p.week, p.num)] = p; });
      practicesLoaded = true;
      if (r.error) syncState('err', 'Практики пока не подключены');
      if (tab === 'practice' && !(pdraft && pdraft.dirty)) renderPractice();
      if (tab === 'weeks') renderWeeks();
      if (admin && !r.error) seedPractices();
    });
  }

  // Черновики практик всех модулей. Когда заходит администратор, недостающие
  // добавляются в базу сами (закрытыми). Уже написанные практики не трогаются.
  var DEFAULT_PRACTICES = [
    [1, 1, 'Письменный протокол скрытых выгод', 'Письменно · около 20 минут · 9 вопросов', 'Вы письменно отвечаете на девять вопросов протокола. Он помогает найти выгоду от текущего положения, которую вы раньше не замечали.'],
    [1, 2, 'Диалог с частью, которая против роста', 'Трансовая техника · запись · 25 минут лёжа', 'Вы слушаете запись лёжа. В трансе вы встречаетесь с той частью себя, которая сопротивляется росту, и вступаете с ней в диалог.'],
    [1, 3, 'Работа через образы', 'Образная работа', 'Когда часть не отвечает прямо, с ней работают через образы: психика показывает ответ картинкой, а не словами.'],
    [2, 1, 'Протокол разрядки эпизода', 'Вживую · 30 минут', 'Находим момент, когда психика решила, что деньги опасны, и снимаем с него эмоциональный заряд.'],
    [2, 2, 'Телесный протокол', '20 минут лёжа', 'То, что не уходит через разговор, снимается через тело.'],
    [2, 3, 'Родовые эпизоды через поле', 'Групповая работа', 'Групповая работа с родовыми эпизодами через поле.'],
    [3, 1, 'Протокол возврата', 'В группе · 40 минут', 'Разбираем, что вы несёте из родительской системы, и возвращаем то, что не ваше.'],
    [3, 2, 'Внутренний диалог с родительской фигурой', 'Запись · когда будете готовы', 'Диалог с родительской фигурой внутри себя. Запись можно пройти тогда, когда почувствуете готовность.'],
    [3, 3, 'Телесная практика на взрослую опору', '15 минут в день', 'Ежедневная телесная практика, которая выстраивает взрослую внутреннюю опору.'],
    [4, 1, 'Диагностика по телу', 'Вживую', 'Через тело находим, какая потребность не закрылась и в каком возрасте это произошло.'],
    [4, 2, 'Протокол застройки опоры', '15 минут ежедневно · 2 недели', 'Ежедневная практика, которая шаг за шагом выстраивает внутреннюю опору на месте дефицита.'],
    [4, 3, 'Разбор компенсаций', 'Разбор', 'Смотрим, чем вы закрываете дыру вместо того, чтобы закрыть её по-настоящему.'],
    [5, 1, 'Точка сборки', 'Личная работа с Татьяной', 'Индивидуальная работа с Татьяной.'],
    [5, 2, 'Протокол на стыд', '30 минут', 'Находим эпизод стыда и снимаем с него эмоциональный заряд.'],
    [5, 3, 'Выдерживание внимания', 'С нарастанием: от одного человека до зала', 'Учимся выдерживать внимание к себе, постепенно увеличивая аудиторию: от одного человека до целого зала.'],
    [6, 1, 'Протокол переписывания убеждения', 'Один подход · одно убеждение', 'Берём фразу из вашей собственной речи, находим её корень и меняем убеждение.'],
    [6, 2, 'Дневник речи', 'На неделю', 'Неделю вы записываете себя и слышите свои программы вслух.'],
    [6, 3, 'Растяжка', 'Одно задание в неделю', 'Каждую неделю одно задание, которое расширяет вашу финансовую норму.'],
    [7, 1, 'Карта цикла', 'Письменно · 40 минут', 'Выписываем все повторы и находим точку входа в цикл.'],
    [7, 2, 'Техника выхода', '3 минуты', 'Применяется в тот момент, когда вы ловите себя на входе в старый круг.'],
    [7, 3, 'Сборка новой картины будущего', '', 'Собираем новую картину вашего будущего.'],
    [8, 1, 'Протокол сборки качеств новой версии себя', 'Вживую · 40 минут', 'Собираем качества новой версии себя.'],
    [8, 2, 'ABC-шаги', 'Стратегия по шагам со сроками', 'Составляем стратегию по шагам: что вы делаете и в какие сроки.'],
    [8, 3, 'Протокол принятия решения из взрослой позиции', '', 'Учимся принимать решения из взрослой позиции.']
  ];
  var seeded = false;
  function seedPractices() {
    if (seeded) return; seeded = true;
    var rows = DEFAULT_PRACTICES.filter(function (d) { return !practices[pkey(d[0], d[1])]; }).map(function (d) {
      return { week: d[0], num: d[1], title: d[2], meta: d[3], body: d[4] };
    });
    if (!rows.length) return;
    sb.from('practices').upsert(rows, { onConflict: 'week,num', ignoreDuplicates: true }).select().then(function (r) {
      if (r.error) return syncState('err', 'Не удалось добавить практики: ' + r.error.message);
      (r.data || []).forEach(function (p) { practices[pkey(p.week, p.num)] = p; });
      toast('Добавлены черновики практик: ' + rows.length);
      if (tab === 'practice' && !(pdraft && pdraft.dirty)) renderPractice();
      if (tab === 'weeks') renderWeeks();
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
  function defPractice(week, num) { return DEFAULT_PRACTICES.filter(function (d) { return d[0] === week && d[1] === num; })[0]; }

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

  var openCards = {};
  function renderPractice() {
    var wk = cur + 1, list = weekPractices(wk), w = S.weeks[cur], h = '';
    var doneN = sum(w.practices);
    h += '<div class="chips">' + MODULES.map(function (x, i) {
      var n = weekPractices(i + 1).filter(function (p) { return p && p.is_open; }).length;
      return '<button class="chip pchip' + (n ? '' : ' locked') + '" type="button" data-pw="' + i + '" aria-pressed="' + (i === cur) + '">' + (i + 1) + '<small>' + n + ' из 3</small></button>';
    }).join('') + '</div>';
    h += '<div class="mod-head"><h2>Модуль ' + wk + ' · <em>' + MODULES[cur][0] + '</em></h2>' +
      '<div class="mod-prog"><span>Выполнено <b>' + doneN + '</b> из 3</span><span class="thin" role="img" aria-label="Выполнено ' + doneN + ' из 3"><i style="width:' + (doneN / 3 * 100).toFixed(0) + '%"></i></span></div></div>';
    if (!practicesLoaded) { $('practice').innerHTML = h + '<p class="loading">Загружаем практики…</p>'; return; }
    h += '<div class="plist">' + list.map(function (p, j) { return practiceCard(p, j); }).join('') + '</div>';
    $('practice').innerHTML = h;
  }

  function practiceCard(p, j) {
    var wk = cur + 1, num = j + 1, nn = '0' + num, key = pkey(wk, num), def = defPractice(wk, num);
    var open = !!(p && p.is_open), visible = !!(p && (open || admin));
    var title = (p && p.title) || (def ? def[2] : 'Практика ' + num);
    var isDone = !!S.weeks[cur].practices[j];
    var editing = admin && pdraft && pdraft.week === wk && pdraft.num === num;
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
      (o.summary ? '<p class="pc-sum">' + esc(o.summary) + '</p>' : '') +
      (p.meta ? '<span class="pc-meta">' + esc(p.meta) + '</span>' : '') +
      '<button class="pc-toggle" type="button" data-pcard="' + key + '" aria-expanded="' + expanded + '">' + (expanded ? 'Свернуть ↑' : 'Открыть практику →') + '</button>';
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
        '<button class="ghost gold" type="button" data-ptoggle="' + num + '">' + (open ? 'Закрыть от участников' : 'Открыть участникам') + '</button></div>';
    }
    if (editing) c += practiceEditor();
    return c + '</div></article>';
  }

  function startEdit(num) {
    var p = practices[pkey(cur + 1, num)] || {}, def = defPractice(cur + 1, num), o = unpack(p);
    pdraft = {
      week: cur + 1, num: num, title: p.title || (def ? def[2] : ''), meta: p.meta || (def ? def[3] : ''),
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
        var g = c.getContext('2d'); g.fillStyle = '#0C1330'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
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
      var p = practices[pkey(h.week, h.practice)], def = defPractice(h.week, h.practice);
      s += ' · Практика ' + h.practice + ': ' + ((p && p.title) || (def ? def[2] : ''));
    }
    return s;
  }
  function activeHelp() { return (S.help || []).filter(function (h) { return !h.cancelled; }); }

  // Блок для участника: кнопка, форма и статус отправленного запроса
  // Срок ответа куратора, который видят участники
  var HELP_RESPONSE = 'в течение 24 часов';
  function helpBox(key) {
    if (VIEW) return '';
    var isPractice = key.charAt(0) === 'p', h = '';
    var mine = activeHelp().filter(function (r) { return !isPractice || (r.week === cur + 1 && r.practice === Number(key.slice(1)) + 1); });
    var formOpen = helpUI && helpUI.key === key;
    if (!formOpen) {
      if (isPractice) {
        if (!mine.length) h += '<button class="ghost help-ghost" type="button" data-help="' + key + '">' + svg('chat') + 'Написать куратору об этой практике</button>';
      } else {
        h += '<div class="helpbox"><span class="ci">' + svg('chat') + '</span><div class="hb-text"><b>Нужна помощь куратора?</b><small>Если застряли, стало тяжело или непонятна практика. Куратор ответит ' + HELP_RESPONSE + '.</small></div>' +
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
      return '<article class="hreq st-' + state + '"><div class="hr-top"><b>' + who + '</b>' + pill + '</div>' +
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

  // ---------- Навигация ----------
  function render() {
    renderViewbar();
    if (tab === 'start') renderStart(); else if (tab === 'weeks') renderWeeks(); else if (tab === 'total') renderTotal();
    else if (tab === 'practice') renderPractice(); else renderPeople();
  }
  function show(t) {
    tab = t;
    if (t === 'people' || t === 'practice') VIEW = null;
    document.querySelectorAll('#tabs .tab').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.tab === t ? 'true' : 'false'); });
    ['start', 'weeks', 'practice', 'total', 'people'].forEach(function (id) { $(id).hidden = id !== t; });
    $('reset').hidden = t === 'people' || t === 'practice' || !!VIEW;
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
    var row = e.target.closest('tr.p');
    if (row) return openPerson(row.dataset.pid);
    var t = e.target.closest('button'); if (!t || !S) return;
    if (t.id === 'back') return show('people');
    if (t.id === 'refresh') { t.textContent = 'Обновляем…'; return loadPeople(); }
    if (t.id === 'tg-test') return testTelegram(t);
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
    if (t.dataset.pcard) { openCards[t.dataset.pcard] = !openCards[t.dataset.pcard]; return renderPractice(); }
    if (t.dataset.gopr != null) { e.preventDefault(); return goPractice(Number(t.dataset.gopr)); }
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
    if (t.id === 'pe-save') return savePractice();
    if (t.id === 'pe-cancel') { pdraft = null; return renderPractice(); }
    if (t.dataset.pedit) {
      if (pdraft && pdraft.dirty) return peMsg('Сначала сохраните или отмените практику, которую вы редактируете.', 'err');
      return startEdit(Number(t.dataset.pedit));
    }
    if (t.dataset.ptoggle) return togglePractice(Number(t.dataset.ptoggle), t);
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
    var row = e.target.closest && !e.target.closest('button') && e.target.closest('tr.p');
    if (row &&(e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPerson(row.dataset.pid); }
  });
  document.addEventListener('input', function (e) {
    var dr = e.target.getAttribute && e.target.getAttribute('data-draft');
    if (dr && pdraft) { pdraft[dr] = e.target.value; pdraft.dirty = true; return; }
    var hd = e.target.getAttribute && e.target.getAttribute('data-hdraft');
    if (hd && helpUI) { helpUI[hd] = e.target.value; return; }
    if (VIEW || !S) return;
    var p = e.target.getAttribute && e.target.getAttribute('data-bind'); if (!p) return;
    set(p, e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : e.target.value);
    touch();
    if (/^weeks\.\d+\.(meet|group|chat|buddy|nights|practices)/.test(p)) updDone();
    if (p === 'start.name' || p === 'start.date') updHead();
    if (p === 'end.income') updIncome();
  });
  document.addEventListener('change', function (e) {
    if (e.target.id === 'pe-file') { uploadFiles(e.target.files, false); return; }
    if (e.target.id === 'pe-mfile') { uploadFiles(e.target.files, true); return; }
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
    btn.disabled = true; authMsg('Секунду…');
    var p;
    if (mode === 'login') p = sb.auth.signInWithPassword({ email: email, password: pass });
    else if (mode === 'signup') { pendingName = $('a-name').value.trim(); pendingTg = tgNick($('a-tg').value); p = sb.auth.signUp({ email: email, password: pass }); }
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
      admin = r[1].data === true;
      var pt = $('t-people');
      if (admin && !pt) {
        var b = document.createElement('button');
        b.className = 'tab owner'; b.setAttribute('role', 'tab'); b.id = 't-people'; b.dataset.tab = 'people'; b.setAttribute('aria-selected', 'false');
        b.textContent = 'Участники'; decorateTab(b);
        $('tabs').insertBefore(b, $('tabs').firstChild);
      } else if (!admin && pt) pt.remove();
      cur = currentWeek(S);
      pdraft = null; openCards = {}; loadPractices();
      screen('app');
      syncState('on', isNew ? (admin ? 'Готово' : 'Готово. Татьяна увидит ваши отметки') : savedLabel());
      if (isNew) flush();
      if (r[0].error) syncState('err', 'Не удалось загрузить трекер: ' + r[0].error.message);
      if (admin) {
        show('people'); loadPeople();
        clearInterval(peopleTimer);
        // Раз в минуту проверяем отметки и новые запросы помощи, на любой вкладке
        peopleTimer = setInterval(function () { if (!document.hidden) loadPeople(); }, 60000);
      } else show('start');
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
