// Спокойный фоновый звук природы. Ничего не скачивается: звук собирается в браузере.
// Тихий ручей, лёгкий ветер, изредка далёкие птицы и едва слышный тёплый фон.
(function () {
  var KEY = 'khavro-sound';
  var btn = document.getElementById('sound');
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!btn || !AC) { if (btn) btn.hidden = true; return; }

  var ctx = null, master = null, on = false, birdTimer = null, birdBus = null;
  var VOLUME = 0.5;

  function noiseBuffer(seconds, brown) {
    var len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0), last = 0, i;
    for (i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    if (brown) { var drift = d[len - 1] - d[0]; for (i = 0; i < len; i++) d[i] -= drift * i / len; } // без щелчка на стыке петли
    return buf;
  }
  function loop(buf) { var s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; }
  // Медленное «дыхание» громкости: gain колеблется вокруг base на ±depth
  function breathe(gainNode, base, depth, hz) {
    gainNode.gain.value = base;
    var l = ctx.createOscillator(), g = ctx.createGain();
    l.frequency.value = hz; g.gain.value = depth;
    l.connect(g); g.connect(gainNode.gain); l.start();
  }

  function build() {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    // Общий фильтр срезает всё резкое и шипящее
    var soft = ctx.createBiquadFilter();
    soft.type = 'lowpass'; soft.frequency.value = 3200; soft.Q.value = 0.3;
    master.connect(soft); soft.connect(ctx.destination);

    var white = noiseBuffer(10, false), brown = noiseBuffer(10, true);

    // Ручей: журчание из двух слоёв, которые «перекатываются» в разном ритме
    [[650, 0.7, 0.05, 0.023, 0.31], [1500, 1.1, 0.018, 0.012, 0.53]].forEach(function (p) {
      var bp = ctx.createBiquadFilter(), g = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = p[0]; bp.Q.value = p[1];
      breathe(g, p[2], p[3], p[4]);
      loop(white).connect(bp); bp.connect(g); g.connect(master);
    });

    // Ветер: низкий мягкий шум с редкими порывами
    var wl = ctx.createBiquadFilter(), wg = ctx.createGain();
    wl.type = 'lowpass'; wl.frequency.value = 380;
    breathe(wg, 0.09, 0.07, 0.045);
    loop(brown).connect(wl); wl.connect(wg); wg.connect(master);

    // Едва слышный тёплый фон: две низкие чистые ноты
    [110, 164.81].forEach(function (f, i) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      breathe(g, 0.018, 0.012, 0.02 + i * 0.013);
      o.connect(g); g.connect(master); o.start();
    });

    // Птицы: отдельная шина, тише всего остального
    birdBus = ctx.createGain(); birdBus.gain.value = 1;
    var bl = ctx.createBiquadFilter(); bl.type = 'lowpass'; bl.frequency.value = 4200;
    birdBus.connect(bl); bl.connect(master);
  }

  // Одна далёкая птица: 2-4 коротких посвиста с лёгким подъёмом высоты
  function bird() {
    if (!on || !ctx || ctx.state !== 'running') return;
    var t = ctx.currentTime + 0.05, notes = 2 + Math.floor(Math.random() * 3), base = 2300 + Math.random() * 1100;
    var out = birdBus;
    if (ctx.createStereoPanner) { var pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.2 - 0.6; pan.connect(birdBus); out = pan; }
    for (var n = 0; n < notes; n++) {
      var o = ctx.createOscillator(), g = ctx.createGain(), s = t + n * (0.16 + Math.random() * 0.08), f = base * (1 + (Math.random() * 0.12 - 0.06));
      o.type = 'sine';
      o.frequency.setValueAtTime(f, s);
      o.frequency.exponentialRampToValueAtTime(f * 1.28, s + 0.07);
      o.frequency.exponentialRampToValueAtTime(f * 0.95, s + 0.13);
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.011, s + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.14);
      o.connect(g); g.connect(out);
      o.start(s); o.stop(s + 0.16);
    }
  }
  function scheduleBirds() {
    clearTimeout(birdTimer);
    birdTimer = setTimeout(function () { bird(); if (on) scheduleBirds(); }, 5000 + Math.random() * 9000);
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
    fadeTo(VOLUME, 6);
    on = true; ui(); save('on'); scheduleBirds();
  }
  function stop() {
    if (!ctx) return;
    fadeTo(0, 1.2);
    setTimeout(function () { if (!on) ctx.suspend(); }, 1300);
    on = false; ui(); save('off'); clearTimeout(birdTimer);
  }
  function ui() {
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Выключить звуки природы' : 'Включить звуки природы');
  }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function wanted() { try { return localStorage.getItem(KEY) === 'on'; } catch (e) { return false; } }

  btn.addEventListener('click', function () { if (on) stop(); else play(); });

  // Если звук был включён в прошлый раз, он продолжится после первого касания страницы:
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

  // Когда вкладку свернули, звук затихает, а когда вернулись, возвращается
  document.addEventListener('visibilitychange', function () {
    if (!ctx || !on) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });
})();
