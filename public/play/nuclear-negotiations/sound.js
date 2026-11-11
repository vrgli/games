/* Nuclear Negotiations — synthesised sound effects, no audio files. */
(function (root) {
  'use strict';
  var ctx = null, on = true;
  try { on = localStorage.getItem('nn-sound') !== 'off'; } catch (e) {}
  function ac() { if (!ctx) { var C = root.AudioContext || root.webkitAudioContext; if (C) ctx = new C(); } if (ctx && ctx.state === 'suspended') ctx.resume(); return ctx; }
  function tone(f, dur, type, vol, slide) {
    var c = ac(); if (!c || !on) return;
    var o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol || .15, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur);
  }
  function noise(dur, vol, from, to) {
    var c = ac(); if (!c || !on) return;
    var n = c.sampleRate * dur, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    var s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter(), t = c.currentTime;
    s.buffer = b; f.type = 'lowpass'; f.frequency.setValueAtTime(from || 2000, t); f.frequency.exponentialRampToValueAtTime(to || 80, t + dur);
    g.gain.setValueAtTime(vol || .4, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(t); s.stop(t + dur);
  }
  var SFX = {
    count: function () { tone(660, .12, 'square', .12); },
    reveal: function () { noise(.5, .5, 3000, 300); tone(110, .6, 'sawtooth', .2, 55); setTimeout(function () { tone(880, .3, 'square', .1, 220); }, 120); },
    swap: function () { noise(.18, .25, 4000, 600); tone(520, .12, 'triangle', .12, 780); },
    turn: function () { for (var i = 0; i < 4; i++) setTimeout(function () { tone(240, .05, 'square', .08); }, i * 110); },
    tick: function () { tone(1200, .04, 'square', .07); },
    hurry: function () { [0, 90, 180].forEach(function (d) { setTimeout(function () { tone(990, .09, 'square', .14); }, d); }); },
    timeout: function () { tone(200, .3, 'sawtooth', .15, 90); },
    nuke: function () { noise(2.6, .9, 400, 30); tone(60, 2.2, 'sine', .5, 25); setTimeout(function () { noise(1.2, .3, 1500, 100); }, 250); },
    bigswap: function () { [0, 110, 220].forEach(function (d, i) { setTimeout(function () { noise(.2, .3, 5000, 700); tone(400 + i * 200, .16, 'square', .13, 900 + i * 200); }, d); }); },
    ufo: function () { tone(300, 1.6, 'sine', .12, 900); setTimeout(function () { tone(900, 1.2, 'sine', .1, 300); }, 500); },
    beam: function () { tone(1400, .7, 'sine', .08, 500); noise(.6, .12, 6000, 2000); },
    thump: function () { tone(70, .18, 'sine', .35, 40); noise(.1, .15, 300, 60); },
    lights: function () { tone(120, .12, 'sawtooth', .12); noise(.06, .2, 3000, 800); },
    flash: function () { noise(.07, .25, 8000, 3000); tone(2600, .05, 'square', .05); },
    deal: function () { [440, 554, 659].forEach(function (f, i) { setTimeout(function () { tone(f, .14, 'triangle', .12); }, i * 90); }); },
  };
  root.SND = { play: function (n) { if (SFX[n]) SFX[n](); }, unlock: ac, get on() { return on; }, set on(v) { on = !!v; try { localStorage.setItem('nn-sound', on ? 'on' : 'off'); } catch (e) {} } };
})(window);
