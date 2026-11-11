#!/usr/bin/env node
// Nuclear Negotiations events: play many seeded games and check the event rules and the replay.
// Run: node scripts/nn-events.js [games]
'use strict';
const NN = require('../public/play/nuclear-negotiations/engine.js');
const N = +process.argv[2] || 2000;
let fails = 0; const fail = (m) => { if (fails++ < 20) console.log('FAIL', m); };
const count = { games: 0, late: 0, big: 0, bigSwap: 0, aliens: 0, swapEnd: 0, dist: 0, noSafeAfterEvent: 0 };
const kinds = {};
// a deterministic "player": a safe move when there is one, now and then a blunder
function pick(g, r) { const L = NN.legal(g), S = L.filter((k) => !NN.fatal(g, k)), A = S.length && r() > 0.01 ? S : L; return A[Math.floor(r() * A.length)]; }
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
for (let s = 1; s <= N; s++) {
  const seed = (Math.imul(s, 2654435761) >>> 0), r = mulberry(s), g = NN.reveal(NN.newGame(seed)), p = g.plan;
  count.games++; if (p.late) count.late++;
  // plan rules
  const win = p.late ? [6, 7, 8, 9] : [2, 3, 4, 5];
  if (!p.dist.length || p.dist.length > 2) fail(seed + ' distraction count ' + p.dist.length);
  const at = p.dist.map((d) => d.at);
  if (new Set(at).size !== at.length) fail(seed + ' two distractions in one move');
  for (const d of p.dist) {
    count.dist++; kinds[d.kind] = (kinds[d.kind] || 0) + 1;
    if (!win.includes(d.at)) fail(seed + ' distraction outside its window at ' + d.at);
    if (d.at < 2 || d.at >= 10) fail(seed + ' distraction in the first 2 moves or right before the escalation');
    if (p.big && p.big.at === d.at) fail(seed + ' distraction together with the big event');
  }
  if (p.big) { count.big++; if (p.big.at < 3 || p.big.at >= 12) fail(seed + ' big event not before the first escalation'); }
  let firstEsc = 0;
  while (!g.over && g.moves < 80) {
    const k = pick(g, r); if (!NN.apply(g, k)) { fail(seed + ' picked an illegal move'); break; }
    if (g.over) break;
    const ev = NN.after(g);
    if (ev && ev.escalate && !firstEsc) firstEsc = g.moves;
    if (ev && (ev.swap || ev.aliens)) {
      if (NN.war(g) >= 0) fail(seed + ' event put two rogues face to face');
      if (!NN.legal(g).some((m) => !NN.fatal(g, m))) count.noSafeAfterEvent++;
      if (ev.aliens) count.aliens++; else if (ev.big) count.bigSwap++; else count.swapEnd++;
    }
    if (ev && ev.calm && !ev.swap) fail(seed + ' escalation ended without SWAP!');
  }
  if (firstEsc && firstEsc !== 12) fail(seed + ' first escalation at ' + firstEsc);
  // the server's replay meets the same events and the same end
  if (g.over) {
    const rp = NN.replay(seed, g.ks);
    if (!rp) fail(seed + ' replay refused a played game');
    else if (rp.log.join('\n') !== g.log.join('\n') || rp.moves !== g.moves || NN.pauseMs(rp) !== NN.pauseMs(g)) fail(seed + ' replay differs');
    const bad = g.ks.slice(); bad[bad.length - 1] = (bad[bad.length - 1] + 1) % 4;
    const rb = NN.replay(seed, bad); if (rb && rb.moves === g.moves && rb.log.join() === g.log.join()) fail(seed + ' tampered run replays identically');
  }
}
// phase lengths: open 6, hurry 6, first escalation 3, then 6 and 6
const ph = []; for (let m = 0; m < 40; m++) { const x = NN.phase(m); if (!ph.length || ph[ph.length - 1][0] !== x) ph.push([x, 0]); ph[ph.length - 1][1]++; }
const lens = ph.slice(0, 6).map((x) => x[0][0] + x[1]).join(' ');
if (lens !== 'o6 h6 e3 h6 e6 h6') fail('phases ' + lens);
const pc = (n) => (100 * n / count.games).toFixed(1) + '%';
console.log(`games ${count.games}  late distractions ${pc(count.late)}  big event planned ${pc(count.big)} (SWAP! fired ${count.bigSwap}, aliens fired ${count.aliens})`);
console.log(`SWAP! at the end of an escalation ${count.swapEnd}  distractions ${count.dist} ${JSON.stringify(kinds)}  events with no safe move left ${count.noSafeAfterEvent}`);
console.log('phases ' + lens);
console.log(fails ? `${fails} FAILED` : 'all checks passed');
process.exit(fails ? 1 : 0);
