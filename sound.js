// Спокойный фоновый звук. Ничего не скачивается: звук собирается в браузере.
// Мягкий аккорд, который медленно «дышит», и тихий шум, похожий на волны.
(function () {
  var KEY = 'khavro-sound';
  var btn = document.getElementById('sound');
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!btn || !AC) { if (btn) btn.hidden = true; return; }

  var ctx = null, master = null, on = false;
  var VOLUME = 0.32;

  function build() {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // Аккорд: ля мажор с септимой, тёплый и без резкости
    var pad = ctx.createBiquadFilter();
    pad.type = 'lowpass'; pad.frequency.value = 900; pad.Q.value = 0.4;
    pad.connect(master);
    [110, 164.81, 220, 277.18, 329.63, 415.3].forEach(function (f, i) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      var lfo = ctx.createOscillator(), depth = ctx.createGain();
      o.type = i < 2 ? 'sine' : 'triangle';
      o.frequency.value = f;
      o.detune.value = i % 2 ? 5 : -5;
      g.gain.value = i < 2 ? 0.06 : 0.025;
      // Каждая нота медленно нарастает и затихает в своём ритме
      lfo.frequency.value = 0.03 + i * 0.017;
      depth.gain.value = g.gain.value * 0.85;
      lfo.connect(depth); depth.connect(g.gain);
      o.connect(g); g.connect(pad);
      o.start(); lfo.start();
    });

    // Волны: мягкий «коричневый» шум с медленными накатами
    var len = ctx.sampleRate * 8, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0), last = 0, i;
    for (i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    var drift = d[len - 1] - d[0];
    for (i = 0; i < len; i++) d[i] -= drift * i / len; // без щелчка на стыке петли
    var noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    var nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 480;
    var ng = ctx.createGain(); ng.gain.value = 0.07;
    var wave = ctx.createOscillator(), wd = ctx.createGain();
    wave.frequency.value = 0.09; wd.gain.value = 0.06;
    wave.connect(wd); wd.connect(ng.gain);
    noise.connect(nf); nf.connect(ng); ng.connect(master);
    noise.start(); wave.start();
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
    fadeTo(VOLUME, 3);
    on = true; ui(); save('on');
  }
  function stop() {
    if (!ctx) return;
    fadeTo(0, 1.2);
    setTimeout(function () { if (!on) ctx.suspend(); }, 1300);
    on = false; ui(); save('off');
  }
  function ui() {
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Выключить фоновый звук' : 'Включить спокойный фоновый звук');
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
