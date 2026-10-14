(function () {
  var MODULES = [
    ['Знакомство с психикой и подсознанием', 'Самосаботаж, конфликт «хочу» и «боюсь», скрытые выгоды бездействия', 'Доступ к заблокированной энергии'],
    ['Разрушение старых программ', 'Травматические узлы, незавершённые процессы, травмы развития и бизнеса', 'Прошлое перестаёт управлять настоящим'],
    ['Сепарация и взросление', 'Эмоциональная связь с родителями, обиды и ожидания, взрослая позиция', 'Рост дохода и внутренней свободы'],
    ['Дефициты и самооценка', 'Чувство недостаточности, антиденежная самооценка, внутренние опоры', 'Деньги из достоинства, а не из нужды'],
    ['Самоценность и проявленность', 'Страх быть видимым, право занимать своё место', 'Свобода проявляться и действовать на результат'],
    ['Убеждения и растяжка', 'Денежные убеждения, страх больших денег, финансовая растяжка', 'Психика выдерживает новый масштаб'],
    ['Выход из сценариев', 'Сценарии бедности и потолка, повторяющиеся циклы', 'Разрыв цикла, выход на новый уровень'],
    ['Новая идентичность', 'Новая версия себя, ABC-шаги стратегии', 'Готовность действовать из новой себя']
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
  var saveTimer = null, writing = false, again = false, booted = false, pendingName = '';

  function $(id) { return document.getElementById(id); }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function num(v) { if (v === '' || v == null) return null; var n = Number(v); return isFinite(n) ? n : null; }
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }
  function avg(a) { a = a.filter(function (x) { return x != null; }); return a.length ? sum(a) / a.length : null; }
  function D() { return VIEW ? VIEW.s : S; }
  function dis() { return VIEW ? ' disabled' : ''; }
  function money(n, c) { return n == null ? '-' : Math.round(n).toLocaleString('ru-RU') + ' ' + (c || D().start.cur); }

  function blankWeek() { return { meet: 0, group: 0, chat: 0, buddy: 0, nights: [0, 0, 0, 0, 0, 0, 0], s0: 0, s1: 0, income: '', insight: '', action: '', recap: '' }; }
  function blank() {
    var w = []; for (var i = 0; i < 8; i++) w.push(blankWeek());
    return { start: { name: '', cur: '€', date: DEFAULT_START, sit: [0, 0, 0, 0, 0], res: [0, 0, 0, 0, 0] }, weeks: w, end: { res: [0, 0, 0, 0, 0] } };
  }
  function valid(o) { return o && o.weeks && o.weeks.length === 8 && o.start && o.end; }
  function norm(o) { if (o.start.name == null) o.start.name = ''; return o; }
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
  function done(w) { return w.meet + w.group + w.chat + w.buddy + sum(w.nights); }

  function stats(s) {
    var W = s.weeks, inc = W.map(function (w) { return num(w.income); }), i;
    var filled = inc.filter(function (x) { return x != null && x > 0; });
    var states = [];
    W.forEach(function (w) { if (w.s0) states.push(w.s0); if (w.s1) states.push(w.s1); });
    var rs = s.start.res.filter(Boolean), re = s.end.res.filter(Boolean);
    var touched = W.filter(function (w) { return done(w) > 0 || w.income !== '' || w.insight || w.action || w.recap || w.s0 || w.s1; }).length;
    var lastIdx = -1; for (i = 7; i >= 0; i--) if (inc[i] != null && inc[i] > 0) { lastIdx = i; break; }
    var firstIdx = -1; for (i = 0; i < 8; i++) if (inc[i] != null && inc[i] > 0) { firstIdx = i; break; }
    return {
      meets: sum(W.map(function (w) { return w.meet; })),
      groups: sum(W.map(function (w) { return w.group; })),
      nights: sum(W.map(function (w) { return sum(w.nights); })),
      inc: inc.map(function (x) { return x || 0; }),
      tot: sum(filled), best: filled.length ? Math.max.apply(null, filled) : null,
      first: firstIdx >= 0 ? inc[firstIdx] : null, last: lastIdx >= 0 ? inc[lastIdx] : null, multi: firstIdx >= 0 && lastIdx > firstIdx,
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
  function chkRow(id, path, val, label, hint) {
    return '<label class="crow" for="' + id + '"><span>' + label + (hint ? '<small>' + hint + '</small>' : '') + '</span><input class="chk" type="checkbox" id="' + id + '" data-bind="' + path + '"' + (val ? ' checked' : '') + dis() + '></label>';
  }

  function renderStart() {
    var v = D().start, h = '';
    h += '<h2>Точка старта</h2><p class="note">Отметьте, что вам знакомо, и оцените, где вы сейчас. В конце программы вы посмотрите, как изменилось ваше состояние и ваши решения.</p>';
    h += '<div class="block"><h3>О вас</h3><div class="row"><label class="f" for="s-name">Как вас зовут<input type="text" id="s-name" data-bind="start.name" value="' + esc(v.name) + '" placeholder="Имя и фамилия" autocomplete="name"' + dis() + '></label>' +
      '<label class="f" for="s-date">Старт программы<input type="date" id="s-date" data-bind="start.date" value="' + esc(v.date) + '"' + dis() + '></label>' +
      '<label class="f" for="s-cur">Валюта для записей о деньгах<select id="s-cur" data-bind="start.cur"' + dis() + '>' + ['€', '$', '₴'].map(function (c) { return '<option' + (v.cur === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></label></div></div>';
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
    h += '<p class="eyebrow">Неделя ' + (cur + 1) + (rng ? ' · ' + rng : '') + '</p><h2>' + M[0] + '</h2>';
    h += '<div class="themes"><div class="theme"><h3>Что прорабатываем</h3><p>' + M[1] + '</p></div><div class="theme"><h3>Результат модуля</h3><p>' + M[2] + '</p></div></div>';
    h += '<div class="block"><h3>На этой неделе</h3><div class="checks">' +
      chkRow('w-meet', 'weeks.' + cur + '.meet', w.meet, 'Живая встреча с Татьяной') +
      chkRow('w-group', 'weeks.' + cur + '.group', w.group, 'Групповая терапия') +
      chkRow('w-chat', 'weeks.' + cur + '.chat', w.chat, 'Сообщение психотерапевту в чате', 'Личный психотерапевт отвечает с обратной связью') +
      chkRow('w-buddy', 'weeks.' + cur + '.buddy', w.buddy, 'Созвон с бадди') +
      '</div></div>';
    h += '<div class="block"><h3>Протокол для подсознания во сне</h3><div class="nights">' + [0, 1, 2, 3, 4, 5, 6].map(function (n) {
      return '<label for="w-n' + n + '"><input class="chk" type="checkbox" id="w-n' + n + '" data-bind="weeks.' + cur + '.nights.' + n + '"' + (w.nights[n] ? ' checked' : '') + dis() + '>' + (n + 1) + '</label>';
    }).join('') + '</div><p class="scale">Отмечайте ночи, когда вы слушали протокол перед сном.</p>';
    h += '<div class="progress"><strong id="w-done"></strong><span>пунктов недели из 11</span></div></div>';
    h += '<div class="block"><h3>Действие недели</h3><input type="text" id="w-action" data-bind="weeks.' + cur + '.action" value="' + esc(w.action) + '" placeholder="Один шаг, который приведёт к деньгам, а не только к инсайту"' + dis() + '></div>';
    h += '<div class="block"><h3>Деньги недели</h3><div class="row"><label class="f" for="w-income">Поступило за неделю, ' + esc(D().start.cur) + '<input type="number" inputmode="numeric" id="w-income" data-bind="weeks.' + cur + '.income" value="' + esc(w.income) + '" placeholder="0"' + dis() + '></label></div></div>';
    h += '<div class="block"><h3>Состояние: энергия и ясность</h3><div class="scales">' +
      '<div class="week"><span>В начале недели</span>' + dotsRow('weeks.' + cur + '.s0', w.s0) + '</div>' +
      '<div class="week"><span>В конце недели</span>' + dotsRow('weeks.' + cur + '.s1', w.s1) + '</div>' +
      '</div><p class="scale">От 1, когда нет сил, до 5, когда ясно и легко.</p></div>';
    h += '<div class="block"><h3>Главный инсайт</h3><textarea id="w-insight" data-bind="weeks.' + cur + '.insight" placeholder="Главный инсайт недели, своими словами"' + dis() + '>' + esc(w.insight) + '</textarea></div>';
    h += '<div class="block"><h3>Итог недели</h3><textarea id="w-recap" data-bind="weeks.' + cur + '.recap" placeholder="Что изменилось в действиях и в деньгах, что берёте в следующую неделю"' + dis() + '>' + esc(w.recap) + '</textarea></div>';
    $('weeks').innerHTML = h; updDone();
    var chip = document.querySelector('.chip[data-w="' + cur + '"]'), box = $('chips');
    if (chip && box) box.scrollLeft = Math.max(0, chip.offsetLeft - 16);
  }
  function updDone() { var el = $('w-done'); if (el) el.textContent = done(D().weeks[cur]); }

  function renderTotal() {
    var s = D(), W = s.weeks, st = stats(s), h = '';
    var top = Math.max(Math.max.apply(null, st.inc), 1);
    h += '<h2>Итоги программы</h2><p class="note">Цифры собираются из недель. Нажмите на столбец, чтобы открыть неделю.</p>';
    h += '<div class="kpis">' +
      '<div><span>Встречи с Татьяной</span><strong>' + st.meets + ' из 8</strong></div>' +
      '<div><span>Групповые терапии</span><strong>' + st.groups + ' из 8</strong></div>' +
      '<div><span>Ночей с протоколом</span><strong>' + st.nights + ' из 56</strong></div></div>';
    h += '<div class="kpis">' +
      '<div><span>Записано за недели программы</span><strong>' + money(st.tot) + '</strong></div>' +
      '<div><span>Лучшая неделя</span><strong>' + money(st.best) + '</strong></div></div>';
    h += '<h3>Деньги по неделям</h3><div class="chart"><div class="cols">' + st.inc.map(function (v, i) {
      return '<button class="col" type="button" data-w="' + i + '" aria-label="Неделя ' + (i + 1) + ': ' + (v ? money(v) : 'нет данных') + '"><span class="bar" style="height:' + (v / top * 100).toFixed(1) + '%"></span></button>';
    }).join('') + '</div></div>';
    h += '<div class="axis">' + W.map(function (x, i) { return '<span>' + (i + 1) + '</span>'; }).join('') + '</div>';
    h += '<p class="legend">Высота столбца: доход недели, шкала от 0 до ' + money(top) + '.</p>';
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
    h += '<p style="margin:0 0 20px"><button class="ghost gold" type="button" id="refresh">Обновить сейчас</button></p>';
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
      '<th>Участник</th><th>Обновлял(а)</th><th>Недели</th><th>Встречи</th><th>Группы</th><th>Ночи</th><th>Деньги: первая → последняя</th><th>Состояние</th><th>Результаты до → после</th>' +
      '</tr></thead><tbody>' + all.map(function (x) {
        var p = x.p, st = x.st, c = p.s.start.cur;
        var mini = '<span class="mini" aria-hidden="true">' + p.s.weeks.map(function (w) { return '<i class="' + (w.meet ? 'y' : '') + '"></i>'; }).join('') + '</span> ';
        var m2 = st.first == null ? '-' : st.multi
          ? money(st.first, c) + ' → <span class="' + (st.last >= st.first ? 'up' : 'down') + '">' + money(st.last, c) + '</span>'
          : money(st.first, c);
        var res = st.resStart == null ? '-' : st.resStart.toFixed(1) + (st.resEnd == null ? '' : ' → <span class="' + (st.resEnd >= st.resStart ? 'up' : 'down') + '">' + st.resEnd.toFixed(1) + '</span>');
        var sub = [p.email, p.id === me.id ? 'это вы' : ''].filter(Boolean).join(' · ');
        return '<tr class="p" tabindex="0" data-pid="' + esc(p.id) + '">' +
          '<td class="nm"><b>' + esc(pname(p)) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</td>' +
          '<td>' + freshPill(p.updatedAt) + '</td><td>' + st.touched + ' из 8</td>' +
          '<td>' + mini + st.meets + '</td><td>' + st.groups + '</td><td>' + st.nights + '</td>' +
          '<td>' + m2 + '</td><td>' + (st.state == null ? '-' : st.state.toFixed(1)) + '</td><td>' + res + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    h += '<h3>Посещаемость по неделям</h3><div class="tablewrap"><table style="min-width:520px"><thead><tr><th>Неделя</th><th>Встреча с Татьяной</th><th>Групповая терапия</th><th>Чат с психотерапевтом</th><th>Бадди</th><th>Ночей в среднем</th></tr></thead><tbody>' +
      MODULES.map(function (m, i) {
        var ws = P.map(function (p) { return p.s.weeks[i]; });
        var c = function (k) { return ws.filter(function (w) { return w[k]; }).length + ' из ' + N; };
        var n = avg(ws.map(function (w) { return sum(w.nights); }));
        return '<tr><td>' + (i + 1) + (i === wk ? ' <span class="pill good">сейчас</span>' : '') + '</td><td>' + c('meet') + '</td><td>' + c('group') + '</td><td>' + c('chat') + '</td><td>' + c('buddy') + '</td><td>' + (n == null ? '-' : n.toFixed(1)) + '</td></tr>';
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
      if (tab === 'people' || VIEW) render();
    });
  }

  function renderViewbar() {
    $('viewbar').innerHTML = VIEW ? '<div class="banner"><p>Вы смотрите трекер участника <b>' + esc(pname(VIEW)) + '</b>. Здесь ничего нельзя изменить.</p>' +
      '<span style="display:flex;gap:8px;flex-wrap:wrap"><button class="ghost gold" type="button" id="back">Вернуться к участникам</button>' +
      (VIEW.id !== me.id ? '<button class="ghost danger" type="button" id="del">Удалить трекер</button>' : '') + '</span></div>' : '';
  }

  // ---------- Навигация ----------
  function render() {
    renderViewbar();
    if (tab === 'start') renderStart(); else if (tab === 'weeks') renderWeeks(); else if (tab === 'total') renderTotal(); else renderPeople();
  }
  function show(t) {
    tab = t;
    if (t === 'people') VIEW = null;
    document.querySelectorAll('#tabs .tab').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.tab === t ? 'true' : 'false'); });
    ['start', 'weeks', 'total', 'people'].forEach(function (id) { $(id).hidden = id !== t; });
    $('reset').hidden = t === 'people' || !!VIEW;
    render();
    window.scrollTo(0, 0);
  }
  function openPerson(pid) {
    var p = people.filter(function (x) { return x.id === pid; })[0]; if (!p) return;
    VIEW = p; cur = currentWeek(p.s); show('start');
  }

  // ---------- Сохранение ----------
  function syncState(kind, text) { $('sync').className = 'sync' + (kind ? ' ' + kind : ''); $('sync-text').textContent = text; }
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
      else syncState('on', savedLabel());
    }).then(function () {
      writing = false;
      if (again) { again = false; setTimeout(flush, 2000); }
    });
  }
  window.addEventListener('beforeunload', function (e) { if (saveTimer && (writing || $('sync-text').textContent === 'Сохраняем…')) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- События трекера ----------
  document.addEventListener('click', function (e) {
    var row = e.target.closest('tr.p');
    if (row) return openPerson(row.dataset.pid);
    var t = e.target.closest('button'); if (!t || !S) return;
    if (t.id === 'back') return show('people');
    if (t.id === 'refresh') { t.textContent = 'Обновляем…'; return loadPeople(); }
    if (t.id === 'del') {
      if (t.dataset.arm === '1') {
        var id = VIEW.id;
        sb.from('trackers').delete().eq('user_id', id).then(function (r) {
          if (r.error) { syncState('err', 'Не удалось удалить: ' + r.error.message); return; }
          people = people.filter(function (p) { return p.id !== id; }); show('people');
        });
      } else { t.dataset.arm = '1'; t.textContent = 'Нажмите ещё раз, чтобы удалить навсегда'; }
      return;
    }
    if (t.id === 'logout') { sb.auth.signOut(); return; }
    if (t.closest('#tabs') && t.dataset.tab) return show(t.dataset.tab);
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
    var row = e.target.closest && e.target.closest('tr.p');
    if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPerson(row.dataset.pid); }
  });
  document.addEventListener('input', function (e) {
    if (VIEW || !S) return;
    var p = e.target.getAttribute && e.target.getAttribute('data-bind'); if (!p) return;
    set(p, e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : e.target.value);
    touch();
    if (/^weeks\.\d+\.(meet|group|chat|buddy|nights)/.test(p)) updDone();
  });
  document.addEventListener('change', function (e) {
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
  }
  function authMsg(text, kind) { var m = $('a-msg'); m.textContent = text || ''; m.className = 'msg' + (kind ? ' ' + kind : ''); }
  function setMode(m) {
    mode = m;
    $('a-login').setAttribute('aria-selected', String(m === 'login'));
    $('a-signup').setAttribute('aria-selected', String(m === 'signup'));
    $('a-name-wrap').hidden = m !== 'signup';
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
    btn.disabled = true; authMsg('Секунду…');
    var p;
    if (mode === 'login') p = sb.auth.signInWithPassword({ email: email, password: pass });
    else if (mode === 'signup') { pendingName = $('a-name').value.trim(); p = sb.auth.signUp({ email: email, password: pass }); }
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
      admin = r[1].data === true;
      var pt = $('t-people');
      if (admin && !pt) {
        var b = document.createElement('button');
        b.className = 'tab owner'; b.setAttribute('role', 'tab'); b.id = 't-people'; b.dataset.tab = 'people'; b.setAttribute('aria-selected', 'false');
        b.textContent = 'Участники';
        $('tabs').insertBefore(b, $('tabs').firstChild);
      } else if (!admin && pt) pt.remove();
      cur = currentWeek(S);
      screen('app');
      syncState('on', isNew ? (admin ? 'Готово' : 'Готово. Татьяна увидит ваши отметки') : savedLabel());
      if (isNew) flush();
      if (r[0].error) syncState('err', 'Не удалось загрузить трекер: ' + r[0].error.message);
      if (admin) {
        show('people'); loadPeople();
        clearInterval(peopleTimer);
        peopleTimer = setInterval(function () { if (tab === 'people' && !document.hidden) loadPeople(); }, 60000);
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
