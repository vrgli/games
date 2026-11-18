/* ===========================================================================
   Game header runtime for Tariff Wars.
   Classic <script> (no modules). Exposes window.ArcadeHeader = { Sound, Music,
   armOnFirstGesture, buildAudioButtons, buildMobileAudioItems, isEmbeddedInArcade,
   isKktShell, setupArcadeBack, setupEmbedExtras }.

   - Sound: procedural WebAudio SFX. Shared mute pref -> localStorage 'fp-sfx-muted'.
   - Music: procedural chiptune or brass march (style:'march'). Always starts off;
     the player switches it on with the 🎵 button.
   No audio files. Header ONLY — never touches gameplay.
   =========================================================================== */
(function (global) {
'use strict';

/* ------------------------------------------------------------------ SOUND */
var Sound = (function () {
  var LS_KEY = 'fp-sfx-muted';
  var ctx = null, noiseBuf = null, muted = false;
  try { muted = localStorage.getItem(LS_KEY) === '1'; } catch (e) {}

  function ensureCtx() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    var len = Math.floor(ctx.sampleRate * 1);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  }
  function whoosh(o) {
    o = o || {};
    var up = o.up !== false, intensity = o.intensity == null ? 1 : o.intensity, dur = o.dur || 0.22;
    if (muted) return;
    var c = ensureCtx(); if (!c) return;
    if (c.state === 'suspended') c.resume();
    var t = c.currentTime;
    var src = c.createBufferSource(); src.buffer = noiseBuf;
    var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8;
    var f0 = up ? 380 : 1700, f1 = up ? 1700 : 480;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    var gain = c.createGain();
    var peak = Math.max(0.0001, 0.22 * intensity);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(gain); gain.connect(c.destination);
    src.start(t); src.stop(t + dur + 0.03);
  }
  function blip(freq, when, dur, o) {
    o = o || {}; var c = ensureCtx(); if (!c) return;
    var osc = c.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.value = freq;
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(o.peak || 0.18, when + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(when); osc.stop(when + dur + 0.03);
  }
  return {
    arm: function () { var c = ensureCtx(); if (c && c.state === 'suspended') c.resume(); },
    isMuted: function () { return muted; },
    setMuted: function (m) { muted = !!m; try { localStorage.setItem(LS_KEY, muted ? '1' : '0'); } catch (e) {} },
    toggle: function () { this.setMuted(!muted); return muted; },
    whoosh: whoosh,
    play: function () { whoosh({ up: true, intensity: 1.0, dur: 0.22 }); },
    draw: function () { whoosh({ up: false, intensity: 0.85, dur: 0.2 }); },
    deal: function (n) { n = n || 4; for (var i = 0; i < n; i++) (function (k) { setTimeout(function () { whoosh({ up: true, intensity: 0.55, dur: 0.15 }); }, k * 90); })(i); },
    reward: function () {
      if (muted) return; var c = ensureCtx(); if (!c) return;
      if (c.state === 'suspended') c.resume();
      var t = c.currentTime, notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach(function (f, i) { blip(f, t + i * 0.075, 0.3, { type: 'triangle', peak: 0.2 }); });
      blip(1567.98, t + 0.33, 0.45, { type: 'sine', peak: 0.11 });
      blip(2093.0, t + 0.42, 0.45, { type: 'sine', peak: 0.08 });
    },
    rush: function () {
      if (muted) return; var c = ensureCtx(); if (!c) return;
      if (c.state === 'suspended') c.resume();
      var t = c.currentTime, dur = 0.55;
      var o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(1200, t + dur);
      var lp = c.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(600, t); lp.frequency.exponentialRampToValueAtTime(4000, t + dur);
      var og = c.createGain();
      og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.14, t + dur * 0.85);
      og.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
      o.connect(lp); lp.connect(og); og.connect(c.destination);
      o.start(t); o.stop(t + dur + 0.08);
      var src = c.createBufferSource(); src.buffer = noiseBuf;
      var hp = c.createBiquadFilter(); hp.type = 'highpass';
      hp.frequency.setValueAtTime(500, t); hp.frequency.exponentialRampToValueAtTime(3500, t + dur);
      var ng = c.createGain();
      ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.10, t + dur * 0.9);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
      src.connect(hp); hp.connect(ng); ng.connect(c.destination);
      src.start(t); src.stop(t + dur + 0.08);
      blip(1318.51, t + dur, 0.2, { type: 'square', peak: 0.16 });
    }
  };
})();

/* ------------------------------------------------------------------ MUSIC */
var Music = (function () {
  var LS_KEY = 'fp-music-off';
  var hz = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  var SCALE_PC = [9, 11, 0, 2, 4, 5, 7];
  var MELODY_NOTES = [];
  for (var m = 69; m <= 88; m++) if (SCALE_PC.indexOf(m % 12) >= 0) MELODY_NOTES.push(m);
  var CHORDS = {
    Am: { bass: 45, triad: [57, 60, 64], pc: [9, 0, 4] },
    F:  { bass: 41, triad: [53, 57, 60], pc: [5, 9, 0] },
    C:  { bass: 48, triad: [60, 64, 67], pc: [0, 4, 7] },
    G:  { bass: 43, triad: [55, 59, 62], pc: [7, 11, 2] },
    Em: { bass: 40, triad: [52, 55, 59], pc: [4, 7, 11] },
    Dm: { bass: 50, triad: [50, 53, 57], pc: [2, 5, 9] }
  };
  var MOODS = {
    bittersweet: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'C'],
    wistful:     ['Am', 'Em', 'F', 'C', 'Am', 'Dm', 'Em', 'Am'],
    hopeful:     ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C']
  };
  // Brass march for style:'march': original 16-bar tune in F, A then B section.
  // Each bar is 8 eighths; melody events are [midi, eighths], 0 = rest.
  var MARCH = {
    chords: { F: [41, [57, 60, 65]], Bb: [46, [58, 62, 65]], C: [36, [55, 58, 64]], Gm: [43, [55, 58, 62]] },
    bars: [
      ['F',  [[72,3],[69,1],[65,2],[69,2]]], ['F',  [[72,2],[77,4],[72,2]]],
      ['Bb', [[74,3],[72,1],[70,2],[74,2]]], ['F',  [[72,6],[0,2]]],
      ['C',  [[70,3],[69,1],[67,2],[70,2]]], ['F',  [[69,3],[67,1],[65,2],[69,2]]],
      ['C',  [[67,2],[69,2],[70,2],[64,2]]], ['F',  [[65,4],[0,2],[72,2]]],
      ['Bb', [[74,2],[74,1],[74,1],[77,4]]], ['F',  [[72,2],[72,1],[72,1],[69,4]]],
      ['Gm', [[70,2],[69,2],[67,2],[70,2]]], ['C',  [[72,6],[0,2]]],
      ['Bb', [[74,2],[74,1],[74,1],[77,2],[74,2]]], ['F',  [[72,2],[69,2],[65,2],[69,2]]],
      ['C',  [[67,3],[69,1],[70,2],[64,2]]], ['F',  [[65,2],[72,2],[65,2],[0,2]]]
    ]
  };
  var style = 'chip', noise = null;
  // Off on every page load, whatever was chosen last time: music is opt-in.
  var ctx = null, master = null, tone = null, off = true;
  var playing = false, timer = null, nextNoteTime = 0, step = 0, bar = 0, arpIdx = 0, lastMelody = 76, melodyHold = 0;
  var bpm = 90, intensity = 0.55, progression = MOODS.bittersweet;
  var SCHED_INTERVAL = 25, SCHED_AHEAD = 0.12;
  function eighthDur() { return 30 / bpm; }
  function ensureCtx() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 3200; tone.Q.value = 0.4;
    master = ctx.createGain(); master.gain.value = 0;
    tone.connect(master); master.connect(ctx.destination);
    return ctx;
  }
  function voice(freq, when, dur, o) {
    o = o || {};
    var osc = ctx.createOscillator(); osc.type = o.type || 'square'; osc.frequency.value = freq;
    if (o.detune) osc.detune.value = o.detune;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(o.peak == null ? 0.15 : o.peak, when + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g); g.connect(tone); osc.start(when); osc.stop(when + dur + 0.03);
  }
  function drum(when, kind) {
    if (kind === 'kick') {
      var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(110, when); o.frequency.exponentialRampToValueAtTime(42, when + 0.12);
      g.gain.setValueAtTime(0.32, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
      o.connect(g); g.connect(master); o.start(when); o.stop(when + 0.2); return;
    }
    if (!noise) { noise = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate); var dd = noise.getChannelData(0); for (var i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1; }
    var src = ctx.createBufferSource(); src.buffer = noise;
    var f = ctx.createBiquadFilter(), g2 = ctx.createGain();
    f.type = kind === 'cymbal' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'cymbal' ? 6000 : 1800; f.Q.value = 0.7;
    var len = kind === 'cymbal' ? 0.9 : kind === 'roll' ? 0.06 : 0.11, peak = kind === 'cymbal' ? 0.07 : kind === 'roll' ? 0.07 : 0.12;
    g2.gain.setValueAtTime(peak, when); g2.gain.exponentialRampToValueAtTime(0.0001, when + len);
    src.connect(f); f.connect(g2); g2.connect(master); src.start(when); src.stop(when + len + 0.02);
  }
  function scheduleMarch(s, when) {
    var eighth = eighthDur(), b = MARCH.bars[bar % MARCH.bars.length], ch = MARCH.chords[b[0]];
    var lastOfPhrase = bar % 4 === 3;
    // Oom-pah: tuba on the beat (root, then fifth), short brass chord on the off-beat.
    if (s === 0 || s === 4) voice(hz(ch[0] + (s === 4 ? 7 : 0)), when, eighth * 1.6, { type: 'sawtooth', peak: 0.16, attack: 0.015 });
    if (s === 2 || s === 6) ch[1].forEach(function (mm) { voice(hz(mm), when, eighth * 0.7, { type: 'sawtooth', peak: 0.035, attack: 0.01 }); });
    if (s === 0 || s === 4) drum(when, 'kick');
    if (s === 2 || s === 6) drum(when, 'snare');
    if (lastOfPhrase && s >= 6) { drum(when + eighth / 2, 'roll'); drum(when + eighth * 0.75, 'roll'); }
    if (s === 0 && bar % 8 === 0) drum(when, 'cymbal');
    // Melody: brass (two detuned saws) over a soft octave-down horn.
    var at = 0;
    for (var i = 0; i < b[1].length; i++) {
      var ev = b[1][i];
      if (at === s && ev[0]) {
        var secs = eighth * ev[1] * 0.9;
        voice(hz(ev[0]), when, secs, { type: 'sawtooth', peak: 0.075, attack: 0.03 });
        voice(hz(ev[0]), when, secs, { type: 'sawtooth', peak: 0.05, attack: 0.03, detune: 9 });
        voice(hz(ev[0] - 12), when, secs, { type: 'triangle', peak: 0.06, attack: 0.04 });
      }
      at += ev[1];
    }
  }
  function pickMelody(chordPc, beat) {
    var candidates = beat ? MELODY_NOTES.filter(function (mm) { return chordPc.indexOf(mm % 12) >= 0; }) : MELODY_NOTES;
    var best = candidates[0], bestScore = -Infinity;
    for (var i = 0; i < candidates.length; i++) {
      var mm = candidates[i], dist = Math.abs(mm - lastMelody);
      var score = -Math.abs(dist - 2.5) + Math.random() * 2.2 - (dist === 0 ? 1.5 : 0);
      if (score > bestScore) { bestScore = score; best = mm; }
    }
    return best;
  }
  function scheduleStep(s, when) {
    if (style === 'march') return scheduleMarch(s, when);
    var chord = CHORDS[progression[bar % progression.length]];
    var beat = s % 2 === 0, eighth = eighthDur();
    if (s === 0 || s === 4) voice(hz(chord.bass), when, eighth * 2 * 0.95, { type: 'triangle', peak: 0.22, attack: 0.02 });
    if (s === 0) chord.triad.forEach(function (mm) { voice(hz(mm), when, eighth * 8 * 0.98, { type: 'triangle', peak: 0.05, attack: 0.15 }); });
    var arpTones = [chord.triad[0], chord.triad[1], chord.triad[2], chord.triad[0] + 12];
    var pattern = [0, 1, 2, 3, 2, 1];
    var note = arpTones[pattern[arpIdx % pattern.length]]; arpIdx++;
    voice(hz(note), when, eighth * 0.85, { type: 'square', peak: 0.055, attack: 0.006 });
    if (melodyHold > 0) { melodyHold--; }
    else if (beat || Math.random() < 0.35) {
      var rest = beat ? Math.random() < 0.12 : Math.random() < 0.45;
      if (!rest) {
        var mm = pickMelody(chord.pc, beat); lastMelody = mm;
        var dur = beat ? [2, 2, 3, 4][Math.floor(Math.random() * 4)] : [1, 2, 2][Math.floor(Math.random() * 3)];
        melodyHold = dur - 1;
        var secs = eighth * dur * 0.96;
        voice(hz(mm), when, secs, { type: 'square', peak: 0.11, attack: 0.012 });
        voice(hz(mm), when, secs, { type: 'triangle', peak: 0.07, attack: 0.02, detune: 5 });
      }
    }
  }
  function scheduler() {
    while (nextNoteTime < ctx.currentTime + SCHED_AHEAD) {
      scheduleStep(step, nextNoteTime);
      nextNoteTime += eighthDur(); step++;
      if (step >= 8) { step = 0; bar++; }
    }
  }
  return {
    arm: function () { var c = ensureCtx(); if (c && c.state === 'suspended') c.resume(); },
    isOff: function () { return off; },
    setOff: function (v) { off = !!v; try { localStorage.setItem(LS_KEY, off ? '1' : '0'); } catch (e) {} if (off) this.stop(); else this.start(); },
    toggle: function () { this.setOff(!off); return off; },
    start: function () {
      if (off || playing) return; var c = ensureCtx(); if (!c) return;
      if (c.state === 'suspended') c.resume();
      playing = true; step = 0; bar = 0; arpIdx = 0; melodyHold = 0; lastMelody = 76;
      nextNoteTime = c.currentTime + 0.08;
      var t = c.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
      master.gain.linearRampToValueAtTime(intensity, t + 1.2);
      timer = setInterval(scheduler, SCHED_INTERVAL);
    },
    stop: function () {
      if (!playing) return; playing = false;
      if (timer) { clearInterval(timer); timer = null; }
      if (master && ctx) {
        var t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(0.0001, t + 0.6);
      }
    },
    isPlaying: function () { return playing; },
    setBpm: function (v) { bpm = Math.max(40, Math.min(200, v || 90)); },
    setIntensity: function (v) {
      intensity = Math.max(0, Math.min(1, v));
      if (playing && master && ctx) { var t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.linearRampToValueAtTime(intensity, t + 0.4); }
    },
    setMood: function (name) { if (MOODS[name]) progression = MOODS[name]; },
    configure: function (o) { o = o || {}; if (o.style === 'march') { style = 'march'; bpm = 112; intensity = 0.5; } if (o.bpm != null) this.setBpm(o.bpm); if (o.intensity != null) this.setIntensity(o.intensity); if (o.mood) this.setMood(o.mood); }
  };
})();

/* --------------------------------------------------------------- HEADER WIRING */
function isKktShell() {
  try { return new URLSearchParams(location.search).get('shell') === 'kkt'; } catch (e) { return false; }
}
function isEmbeddedInArcade() {
  // Embedded in the the arcade arcade iframe (but NOT the a partner site shell).
  var embedded = false;
  try { embedded = global.top !== global.self; } catch (e) { embedded = true; }
  return embedded && !isKktShell();
}

// Build the 🔊 + 🎵 icon buttons and append them to `container`. Returns them.
function buildAudioButtons(container, opts) {
  opts = opts || {};
  if (opts.music) Music.configure(opts.music);
  var mute = document.createElement('button');
  mute.className = 'ah-ctl icon'; mute.id = 'ah-btn-sfx'; mute.title = 'Sound effects';
  function paintMute() { mute.textContent = Sound.isMuted() ? '🔇' : '🔊'; }
  paintMute();
  mute.addEventListener('click', function () { Sound.arm(); Sound.toggle(); paintMute(); });

  var music = document.createElement('button');
  music.className = 'ah-ctl icon'; music.id = 'ah-btn-music'; music.title = 'Music'; music.textContent = '🎵';
  function paintMusic() { if (Music.isOff()) music.classList.add('off'); else music.classList.remove('off'); }
  paintMusic();
  music.addEventListener('click', function () { Music.arm(); Music.toggle(); paintMusic(); });

  if (opts.divider !== false) {
    var d = document.createElement('div'); d.className = 'ah-divider'; container.appendChild(d);
  }
  container.appendChild(mute); container.appendChild(music);
  return { mute: mute, music: music };
}

// Add Sound + Music rows to a mobile menu element (before `beforeEl` if given).
function buildMobileAudioItems(menuEl, beforeEl) {
  function row(icon, label, isOff, onClick) {
    var b = document.createElement('button'); b.className = 'ah-mitem';
    var i = document.createElement('span'); i.className = 'ah-ico'; i.textContent = icon;
    var t = document.createElement('b'); t.textContent = label;
    var s = document.createElement('span'); s.className = 'ah-state'; s.textContent = isOff() ? 'Off' : 'On';
    b.appendChild(i); b.appendChild(t); b.appendChild(s);
    b.addEventListener('click', function () { onClick(); s.textContent = isOff() ? 'Off' : 'On'; });
    if (beforeEl) menuEl.insertBefore(b, beforeEl); else menuEl.appendChild(b);
    return b;
  }
  var sfx = row('🔊', 'Sound effects', function () { return Sound.isMuted(); }, function () { Sound.arm(); Sound.toggle(); });
  var mus = row('🎵', 'Music', function () { return Music.isOff(); }, function () { Music.arm(); Music.toggle(); });
  return { sfx: sfx, mus: mus };
}

// Arm audio on first user gesture (autoplay policy) and start music.
function armOnFirstGesture() {
  function armed() {
    Sound.arm(); Music.arm(); Music.start();
    global.removeEventListener('pointerdown', armed);
    global.removeEventListener('keydown', armed);
  }
  global.addEventListener('pointerdown', armed, { once: true });
  global.addEventListener('keydown', armed, { once: true });
}

// ← Arcade button: hide when embedded in the the arcade arcade iframe
// (the arcade shell provides navigation); otherwise wire it to the arcade. In the
// a partner site shell the top origin is NOT the arcade, so use the absolute URL.
function setupArcadeBack(el) {
  if (!el) return;
  if (isEmbeddedInArcade()) { el.setAttribute('hidden', ''); return; }
  var url = isKktShell() ? '/' : '/';
  el.addEventListener('click', function (e) {
    e.preventDefault();
    try { global.top.location.href = url; } catch (err) { location.href = url; }
  });
}

// When embedded in a partner site, inject ★ Back on Kickstarter + mode label.
function setupEmbedExtras(container, opts) {
  opts = opts || {};
  if (!isKktShell() || !container) return;
  var d = document.createElement('div'); d.className = 'ah-divider'; container.appendChild(d);
  var ks = document.createElement('a'); ks.className = 'ah-ks';
  ks.href = opts.ksUrl || '/';
  ks.target = '_blank'; ks.rel = 'noopener'; ks.textContent = '★ Back on Kickstarter';
  container.appendChild(ks);
  if (opts.mode) { var mo = document.createElement('span'); mo.className = 'ah-mode'; mo.textContent = opts.mode; container.appendChild(mo); }
}

global.ArcadeHeader = {
  Sound: Sound,
  Music: Music,
  isKktShell: isKktShell,
  isEmbeddedInArcade: isEmbeddedInArcade,
  buildAudioButtons: buildAudioButtons,
  buildMobileAudioItems: buildMobileAudioItems,
  armOnFirstGesture: armOnFirstGesture,
  setupArcadeBack: setupArcadeBack,
  setupEmbedExtras: setupEmbedExtras
};

})(window);
