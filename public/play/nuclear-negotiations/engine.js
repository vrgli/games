/* Nuclear Negotiations — table engine. No DOM, so the same rules can run on a server later.
 *
 * Two wheels of four seats. Positions go clockwise from top-left: 0,1,2,3.
 * Outer seats are lettered A B D C (A top-left, B top-right, D bottom-right, C bottom-left);
 * inner seats are numbered 1 2 4 3 the same way, so A faces 1, B faces 2, C faces 3, D faces 4.
 * Seat labels are fixed to the table; leaders move through them.
 *
 * Standard mode: a move swaps a rogue leader with the leader facing it on the other wheel,
 * then the outer wheel turns one seat clockwise. If that leaves the two rogues facing each
 * other, it is nuclear war and whoever made the move loses.
 */
(function (root) {
  'use strict';
  var LEADERS = [
    { id: 'don', nm: 'Don' }, { id: 'vlad', nm: 'Vlad' }, { id: 'ursula', nm: 'Ursula' }, { id: 'zel', nm: 'Zel' },
    { id: 'modi', nm: 'Modi' }, { id: 'bibi', nm: 'Bibi' }, { id: 'obama', nm: 'Obama' }, { id: 'mbs', nm: 'MBS' },
  ];
  var OUTER = ['A', 'B', 'D', 'C'], INNER = ['1', '2', '4', '3'];
  // The rhythm, in spells of SPELL moves: an opening at 3 s a move, then HURRY UP at 1 s, then
  // ESCALATION (a third leader goes rogue, still 1 s), then HURRY UP again with the third rogue
  // standing down, then ESCALATION again, and so on until the war. The first escalation is
  // short (FIRST_ESC moves); later ones last a full spell.
  var SPELL = 6, FIRST_ESC = 3, CLOCK = { open: 3000, hurry: 1000, escalation: 1000 };
  function phase(m) {
    if (m < SPELL) return 'open';
    if (m < 2 * SPELL) return 'hurry';
    if (m < 2 * SPELL + FIRST_ESC) return 'escalation';
    return Math.floor((m - 2 * SPELL - FIRST_ESC) / SPELL) % 2 ? 'escalation' : 'hurry';
  }
  function clockMs(m) { return CLOCK[phase(m)]; }

  // Events. Everything here is drawn from the game's seed, so a server replay meets the same ones.
  //  · SWAP!: when an escalation ends, a rogue changes seats with a calm leader across the table.
  //  · Aliens: the leaders beam out and back in reshuffled, as lizards for LIZARD moves.
  //  · One bigger event (SWAP! or aliens) may come before the first escalation.
  //  · Distractions (gorilla, lights out, paparazzi) are only on screen; the rules ignore them.
  //    They come in the opening but never in its first 2 moves; 1 game in 5 has them in the first
  //    HURRY UP instead, never in the 2 moves before the escalation; never two at once.
  var LIZARD = 4, DISTRACTIONS = ['gorilla', 'lights', 'paparazzi'];
  // Extra seconds a replay allows for the pauses these events cause on screen.
  var EVENT_MS = { swap: 4000, aliens: 8000 };
  // Small seeded PRNG (mulberry32) so a game can be replayed from its seed.
  function rng(seed) { var a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function shuffle(a, r) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  // The game's event plan. Its own PRNG stream, so the deal for a seed is the same as before.
  function plan(seed) {
    var r = rng((seed ^ 0x6A09E667) >>> 0);
    var late = r() < 0.2, bigRoll = r(), bigAt = 3 + Math.floor(r() * 8), bigKind = r() < 0.5 ? 'swap' : 'aliens', n = r() < 0.35 ? 1 : 2;
    var big = bigRoll < 0.75 ? { at: bigAt, kind: bigKind } : null;
    var slots = shuffle((late ? [6, 7, 8, 9] : [2, 3, 4, 5]).filter(function (m) { return !big || m !== big.at; }), r);
    var kinds = shuffle(DISTRACTIONS.slice(), r), dist = [];
    for (var i = 0; i < n; i++) dist.push({ at: slots[i], kind: kinds[i] });
    dist.sort(function (a, b) { return a.at - b.at; });
    return { late: late, big: big, dist: dist };
  }

  function newGame(seed) {
    if (seed == null) seed = (Math.random() * 4294967296) >>> 0;
    var r = rng(seed), ids = LEADERS.map(function (l) { return l.id; });
    shuffle(ids, r);
    var ro = Math.floor(r() * 4), ri = Math.floor(r() * 3); if (ri >= ro) ri++;   // never facing
    return { seed: seed, outer: ids.slice(0, 4), inner: ids.slice(4, 8), rogue: {}, rogueOuter: ro, rogueInner: ri, moves: 0, ks: [], extra: null, log: [], over: false, turns: 0,
      plan: plan(seed), events: [], lizard: 0 };
  }
  // Rogue reveal: fix which two leaders are rogue (the leaders carry it, not the seats).
  function reveal(g) { g.rogue[g.outer[g.rogueOuter]] = true; g.rogue[g.inner[g.rogueInner]] = true; g.log.push('reveal ' + rogues(g)); return g; }

  function rogues(g) {
    var s = [];
    for (var k = 0; k < 4; k++) { if (g.rogue[g.outer[k]]) s.push(OUTER[k] + '*'); if (g.rogue[g.inner[k]]) s.push(INNER[k] + '*'); }
    return s.join(' ');
  }
  function war(g) { for (var k = 0; k < 4; k++) if (g.rogue[g.outer[k]] && g.rogue[g.inner[k]]) return k; return -1; }
  // Legal moves: every position holding exactly one rogue (both would already be war).
  function legal(g) { var m = []; if (g.over) return m; for (var k = 0; k < 4; k++) if (g.rogue[g.outer[k]] || g.rogue[g.inner[k]]) m.push(k); return m; }
  function notation(g, k) { return OUTER[k] + (g.rogue[g.outer[k]] ? '*' : '') + '<->' + INNER[k] + (g.rogue[g.inner[k]] ? '*' : ''); }
  // Would playing position k end in war? (Lets a trainer or an AI tell a blunder from a safe move.)
  function fatal(g, k) { var c = clone(g); apply(c, k); return c.over; }

  function apply(g, k) {
    if (g.over || legal(g).indexOf(k) < 0) return null;
    var line = notation(g, k);
    var t = g.outer[k]; g.outer[k] = g.inner[k]; g.inner[k] = t;             // the swap
    g.outer = [g.outer[3], g.outer[0], g.outer[1], g.outer[2]];               // outer turns one seat clockwise
    g.turns++; g.moves++; g.ks.push(k);
    var w = war(g); g.over = w >= 0;
    g.log.push(g.moves + '. ' + line + ' -> ' + (g.over ? 'NUCLEAR WAR at ' + OUTER[w] + '/' + INNER[w] : rogues(g)));
    return { move: line, war: w };
  }
  // Escalation: one more leader goes rogue. Never one already facing a rogue (instant war), and
  // when possible one that still leaves the player a safe move. Returns the seat label, or null.
  // The pick is seeded by the game and the move number, so a replay picks the same leader.
  function escalate(g, r) {
    r = r || rng((g.seed ^ Math.imul(g.moves + 1, 0x9E3779B1)) >>> 0);
    var c = [], k;
    for (k = 0; k < 4; k++) {
      if (!g.rogue[g.outer[k]] && !g.rogue[g.inner[k]]) { c.push({ id: g.outer[k], lbl: OUTER[k] }); c.push({ id: g.inner[k], lbl: INNER[k] }); }
    }
    if (!c.length) return null;
    var ok = c.filter(function (x) { var t = clone(g); t.rogue[x.id] = true; return legal(t).some(function (m) { return !fatal(t, m); }); });
    var pick = (ok.length ? ok : c)[Math.floor(r() * (ok.length ? ok : c).length)];
    g.rogue[pick.id] = true; g.log.push('escalation ' + pick.lbl + '* -> ' + rogues(g));
    return pick;
  }
  // Replay a finished game from its seed and the positions played (g.ks). Returns the final
  // state, or null if a move was illegal, the game went on after the war, or never ended.
  function replay(seed, ks) {
    if (!Array.isArray(ks)) return null;
    var g = reveal(newGame(seed >>> 0));
    for (var i = 0; i < ks.length; i++) {
      if (g.over || !apply(g, ks[i])) return null;
      after(g);
    }
    return g.over ? g : null;
  }
  function safe(g) { return legal(g).some(function (m) { return !fatal(g, m); }); }
  function evRng(g, salt) { return rng((g.seed ^ Math.imul(g.moves + 1, 0x85EBCA6B) ^ salt) >>> 0); }
  function seatId(g, s) { return (s.ring === 'o' ? g.outer : g.inner)[s.k]; }
  function seatLbl(s) { return (s.ring === 'o' ? OUTER : INNER)[s.k]; }
  // SWAP!: a rogue changes seats with a calm leader who is not facing them. Never into a war,
  // and when possible leaving a safe move. Returns { a: rogue seat, b: calm seat } (before the swap).
  function swapEvent(g) {
    var r = evRng(g, 0x5A0B), rs = [], cs = [], c = [], k;
    for (k = 0; k < 4; k++) [{ ring: 'o', k: k }, { ring: 'i', k: k }].forEach(function (s) { (g.rogue[seatId(g, s)] ? rs : cs).push(s); });
    rs.forEach(function (a) { cs.forEach(function (b) { if (a.k !== b.k) c.push({ a: a, b: b }); }); });
    function swapped(t, x) { var A = x.a.ring === 'o' ? t.outer : t.inner, B = x.b.ring === 'o' ? t.outer : t.inner, v = A[x.a.k]; A[x.a.k] = B[x.b.k]; B[x.b.k] = v; return t; }
    var noWar = c.filter(function (x) { return war(swapped(clone(g), x)) < 0; });
    var ok = noWar.filter(function (x) { return safe(swapped(clone(g), x)); });
    var from = ok.length ? ok : noWar; if (!from.length) return null;
    var x = from[Math.floor(r() * from.length)];
    var res = { a: { id: seatId(g, x.a), ring: x.a.ring, k: x.a.k }, b: { id: seatId(g, x.b), ring: x.b.ring, k: x.b.k } };
    swapped(g, x); g.events.push('swap');
    g.log.push('SWAP! ' + NN.name(res.a.id) + ' ' + seatLbl(x.a) + '* <-> ' + NN.name(res.b.id) + ' ' + seatLbl(x.b) + ' -> ' + rogues(g));
    return res;
  }
  // Aliens: every leader is beamed up and set down in a new seat, never into a war, with a safe
  // move left. They stay lizards for LIZARD moves (only the look changes; rogues stay rogue).
  function aliens(g) {
    var r = evRng(g, 0xA11E), ids = g.outer.concat(g.inner), best = null;
    for (var tries = 0; tries < 60; tries++) {
      var p = shuffle(ids.slice(), r), t = clone(g); t.outer = p.slice(0, 4); t.inner = p.slice(4);
      if (war(t) >= 0 || p.join() === ids.join()) continue;
      best = best || p;
      if (safe(t)) { best = p; break; }
    }
    if (!best) return null;
    g.outer = best.slice(0, 4); g.inner = best.slice(4); g.lizard = g.moves + LIZARD; g.events.push('aliens');
    g.log.push('ALIEN INVASION: the leaders come back as lizards -> ' + rogues(g));
    return { lizard: LIZARD };
  }
  // After a move: when the phase turns, ESCALATION brings a third rogue in; when it ends, that
  // one stands down and SWAP! follows. Before the first escalation the planned bigger event fires.
  // Returns { escalate: pick }, { calm: id, swap: s }, { swap: s }, { aliens: … } or null.
  function after(g) {
    if (g.over) return null;
    var m = g.moves;
    if (m > 0 && phase(m - 1) !== phase(m)) {
      if (phase(m) === 'escalation') { var pick = escalate(g); if (!pick) return null; g.extra = pick.id; return { escalate: pick }; }
      if (phase(m - 1) === 'escalation') {
        var ev = {};
        if (g.extra) { ev.calm = g.extra; delete g.rogue[g.extra]; g.extra = null; g.log.push('de-escalation ' + NN.name(ev.calm) + ' stands down -> ' + rogues(g)); }
        var s = swapEvent(g); if (s) ev.swap = s;
        return ev.calm || ev.swap ? ev : null;
      }
    }
    var big = g.plan && g.plan.big;
    if (big && big.at === m) {
      if (big.kind === 'swap') { var sw = swapEvent(g); return sw ? { swap: sw, big: true } : null; }
      var al = aliens(g); return al ? { aliens: al } : null;
    }
    return null;
  }
  // The distraction on screen during the move about to be played, or null.
  function distraction(g) { var d = g.plan ? g.plan.dist : []; for (var i = 0; i < d.length; i++) if (d[i].at === g.moves) return d[i].kind; return null; }
  function lizard(g) { return g.moves < (g.lizard || 0); }
  function pauseMs(g) { return (g.events || []).reduce(function (t, e) { return t + (EVENT_MS[e] || 0); }, 0); }
  function clone(g) { return JSON.parse(JSON.stringify(g)); }
  function logText(g) { return ['Nuclear Negotiations · seed ' + g.seed, 'outer A ' + g.outer[0] + ' B ' + g.outer[1] + ' D ' + g.outer[2] + ' C ' + g.outer[3] + ' (now)', 'inner 1 ' + g.inner[0] + ' 2 ' + g.inner[1] + ' 4 ' + g.inner[2] + ' 3 ' + g.inner[3]].concat(g.log).join('\n'); }

  var NN = { LEADERS: LEADERS, OUTER: OUTER, INNER: INNER, SPELL: SPELL, FIRST_ESC: FIRST_ESC, LIZARD: LIZARD, phase: phase, plan: plan, distraction: distraction, lizard: lizard, pauseMs: pauseMs, clockMs: clockMs, after: after, newGame: newGame, replay: replay, reveal: reveal, escalate: escalate, legal: legal, apply: apply, fatal: fatal, war: war, rogues: rogues, notation: notation, logText: logText, name: function (id) { for (var i = 0; i < LEADERS.length; i++) if (LEADERS[i].id === id) return LEADERS[i].nm; return id; } };
  if (root.exports) root.exports = NN; else root.NN = NN;
})(typeof module !== 'undefined' ? module : window);
