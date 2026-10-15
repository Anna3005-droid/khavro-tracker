// Спокойная инструментальная музыка. Ничего не скачивается: музыка собирается в браузере.
// Мягкие ноты, похожие на электропиано, неспешно играют поверх тёплых аккордов, с эхом как в зале.
// Мелодия каждый раз складывается немного по-новому, поэтому не надоедает.
(function () {
  var KEY = 'khavro-sound';
  var btn = document.getElementById('sound');
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!btn || !AC) { if (btn) btn.hidden = true; return; }

  var ctx = null, master = null, dry = null, rev = null, on = false;
  var timer = null, nextNote = 0, nextChord = 0, chordIdx = 0, curChord = 0;
  var VOLUME = 0.55;

  // Аккорды: Cmaj7 → Am7 → Fmaj7 → G6, по 8 секунд каждый
  var BAR = 8;
  var CHORDS = [
    { bass: 65.41, pad: [130.81, 164.81, 196.0, 246.94], tones: [261.63, 329.63, 392.0, 493.88, 523.25, 659.25] },
    { bass: 55.0, pad: [110.0, 130.81, 164.81, 196.0], tones: [220.0, 261.63, 329.63, 392.0, 440.0, 523.25] },
    { bass: 43.65, pad: [87.31, 130.81, 164.81, 220.0], tones: [261.63, 329.63, 349.23, 440.0, 523.25, 659.25] },
    { bass: 49.0, pad: [98.0, 146.83, 196.0, 246.94], tones: [293.66, 329.63, 392.0, 493.88, 587.33, 659.25] }
  ];

  // Эхо зала: затухающий шум как отклик помещения
  function hall(seconds) {
    var len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    var conv = ctx.createConvolver(); conv.buffer = buf; return conv;
  }

  function build() {
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0;
    var soft = ctx.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = 2800; soft.Q.value = 0.2;
    master.connect(soft); soft.connect(ctx.destination);
    dry = ctx.createGain(); dry.gain.value = 0.75; dry.connect(master);
    rev = hall(3.6);
    var wet = ctx.createGain(); wet.gain.value = 0.5;
    rev.connect(wet); wet.connect(master);
  }
  function send(node) { node.connect(dry); node.connect(rev); }

  // Нота электропиано: основной тон и тихие обертоны, мягкая атака и долгое затухание
  function keyNote(f, t, vel) {
    var g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1800;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.02);
    g.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    [[1, 1], [2, 0.18], [3, 0.05]].forEach(function (h) {
      var o = ctx.createOscillator(), hg = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * h[0]; hg.gain.value = h[1];
      o.connect(hg); hg.connect(g); o.start(t); o.stop(t + 3.3);
    });
    g.connect(lp); send(lp);
  }

  // Аккорд-подушка: медленно нарастает и уходит, очень тихо
  function padChord(ch, t) {
    var g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 700;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.022, t + 2.5);
    g.gain.linearRampToValueAtTime(0.018, t + BAR - 1);
    g.gain.linearRampToValueAtTime(0.0001, t + BAR + 1.5);
    ch.pad.concat([ch.bass]).forEach(function (f, i) {
      var o = ctx.createOscillator(); o.type = i === 4 ? 'sine' : 'triangle'; o.frequency.value = f;
      o.connect(g); o.start(t); o.stop(t + BAR + 1.6);
    });
    g.connect(lp); send(lp);
  }

  // Планировщик: заранее расставляет ноты на ближайшие полторы секунды
  function tick() {
    var ahead = ctx.currentTime + 1.5;
    while (nextChord < ahead) {
      curChord = chordIdx;
      padChord(CHORDS[chordIdx], nextChord);
      keyNote(CHORDS[chordIdx].tones[0] / 2, nextChord + 0.05, 0.05);
      chordIdx = (chordIdx + 1) % CHORDS.length;
      nextChord += BAR;
    }
    while (nextNote < ahead) {
      var ch = CHORDS[curChord];
      if (Math.random() < 0.78) {
        var f = ch.tones[Math.floor(Math.random() * ch.tones.length)];
        keyNote(f, nextNote, 0.035 + Math.random() * 0.03);
        if (Math.random() < 0.18) keyNote(f > 440 ? f / 2 : f * 1.5, nextNote + 0.18, 0.02);
      }
      nextNote += [0.75, 1.0, 1.0, 1.5, 2.0][Math.floor(Math.random() * 5)];
    }
  }
  function startClock() {
    var now = ctx.currentTime;
    if (nextChord < now) { nextChord = now + 0.1; nextNote = now + 1.1; }
    if (nextNote < now) nextNote = now + 0.3;
    clearInterval(timer); timer = setInterval(tick, 250); tick();
  }

  function fadeTo(v, sec) {
    var t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(v, t + sec);
  }

  function play() {
    if (!ctx) build();
    ctx.resume();
    startClock();
    fadeTo(VOLUME, 4);
    on = true; ui(); save('on');
  }
  function stop() {
    if (!ctx) return;
    fadeTo(0, 1.5);
    setTimeout(function () { if (!on) { clearInterval(timer); ctx.suspend(); } }, 1600);
    on = false; ui(); save('off');
  }
  function ui() {
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Выключить музыку' : 'Включить спокойную музыку');
    btn.title = on ? 'Выключить музыку' : 'Спокойная музыка';
  }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function wanted() { try { return localStorage.getItem(KEY) === 'on'; } catch (e) { return false; } }

  btn.addEventListener('click', function () { if (on) stop(); else play(); });

  // Если музыка была включена в прошлый раз, она продолжится после первого касания страницы:
  // браузеры не дают сайтам включать звук самим.
  if (wanted()) {
    var resume = function (e) {
      if (e.target.closest && e.target.closest('#sound')) return;
      document.removeEventListener('pointerdown', resume, true);
      document.removeEventListener('keydown', resume, true);
      if (!on) play();
    };
    document.addEventListener('pointerdown', resume, true);
    document.addEventListener('keydown', resume, true);
  }

  // Когда вкладку свернули, музыка встаёт на паузу, а когда вернулись, продолжается
  document.addEventListener('visibilitychange', function () {
    if (!ctx || !on) return;
    if (document.hidden) { clearInterval(timer); ctx.suspend(); }
    else { ctx.resume(); startClock(); }
  });
  ui();
})();
