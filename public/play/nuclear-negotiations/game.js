/* Nuclear Negotiations — solo table UI. Rules live in engine.js (window.NN), sounds in sound.js (window.SND). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var G = null, rot = 0, busy = true, best = 0, tick = null, deadline = 0, stage = -1;
  var ANG = [225, 315, 45, 135];                 // positions 0..3 clockwise from top-left, degrees (0 = right, 90 = down)
  var R_OUT = 41, R_IN = 21;                      // seat ring radii, % of the table
  var IDLE = { don: 'bob', vlad: 'tilt', ursula: 'sway', zel: 'nod', modi: 'breathe', bibi: 'shake', obama: 'lean', mbs: 'float' };
  var dealing = false;
  try { best = parseInt(localStorage.getItem('nn-best'), 10) || 0; } catch (e) {}
  $('best').textContent = best;
  // Signed in: the account's longest run wins over this browser's if it is longer.
  try { fetch('/api/me', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) { var b = d.nuclear_negotiations && d.nuclear_negotiations.best; if (b > best) { best = b; $('best').textContent = best; try { localStorage.setItem('nn-best', best); } catch (e) {} } }).catch(function () {}); } catch (e) {}
  $('btnSound').textContent = SND.on ? '🔊' : '🔇';

  function pos(el, r, deg) { var a = deg * Math.PI / 180; el.style.left = (50 + r * Math.cos(a)) + '%'; el.style.top = (50 + r * Math.sin(a)) + '%'; }
  function seat(id, k, ring) {
    var el = document.createElement('div'); el.className = 'seat idle-' + IDLE[id]; el.dataset.k = k; el.dataset.id = id;
    var lz = G && G.lizard && NN.lizard(G);
    el.appendChild(PX.draw(id, 6, lz ? 'lizard' : null)); if (lz) el.classList.add('lizard');
    var nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = NN.name(id).toUpperCase(); el.appendChild(nm);
    var slot = ring === 'o' ? ((k - rot / 90) % 4 + 4) % 4 : k;           // outer: the slot before the ring's own rotation
    pos(el, ring === 'o' ? R_OUT : R_IN, ANG[slot]);
    var up = ring === 'o' ? 'rotate(' + (-rot) + 'deg)' : 'none';
    el.style.setProperty('--up', up); el.style.transform = up;
    if (G && G.rogue[id]) el.classList.add('rogue');
    el.onclick = function () { play(k); };
    return el;
  }
  function render(state) {
    var o = $('outer'), i = $('inner'); o.innerHTML = ''; i.innerHTML = '';
    for (var k = 0; k < 4; k++) { o.appendChild(seat(state.outer[k], k, 'o')); i.appendChild(seat(state.inner[k], k, 'i')); }
    o.style.transform = 'rotate(' + rot + 'deg)';
  }
  function markLegal() {
    var L = NN.legal(G);
    Array.prototype.forEach.call(document.querySelectorAll('.seat.rogue'), function (el) { if (L.indexOf(+el.dataset.k) >= 0) el.classList.add('can'); });
  }
  function status(t) { $('statusTxt').textContent = t; }
  function banner(t, sub) { var b = $('banner'); b.hidden = true; $('bannerTxt').textContent = t; $('bannerSub').textContent = sub || ''; void b.offsetWidth; b.hidden = false; setTimeout(function () { b.hidden = true; }, 1400); }
  function face(id) { var c = PX.draw(id, 2); c.title = NN.name(id); return c; }
  function paintLog() {
    var lines = G ? G.log : [];
    $('log').innerHTML = lines.map(function (l) { return /NUCLEAR/.test(l) ? '<span class="war">' + l + '</span>' : l; }).join('\n') || '—';
    $('log').scrollTop = 1e6;
    $('moves').textContent = G ? G.moves : 0;
  }

  // ── the clock ──
  // The phases and their clock are rules (engine.js). The first HURRY UP is announced here;
  // ESCALATION and the return to HURRY UP are announced by escalateFx / calmFx.
  function armClock() {
    var ms = NN.clockMs(G.moves);
    if (G.moves === NN.SPELL && stage !== G.moves) { stage = G.moves; banner('HURRY UP', '1 SECOND A MOVE'); SND.play('hurry'); }
    clearInterval(tick); deadline = Date.now() + ms; $('centre').classList.add('clock'); paintClock();
    var d = NN.distraction(G); if (d) distract(d, ms);
    var lastTick = -1;
    tick = setInterval(function () {
      if (busy || !G || G.over) { clearInterval(tick); return; }
      var left = deadline - Date.now();
      if (left <= 0) { clearInterval(tick); SND.play('timeout'); var L = NN.legal(G); play(L[Math.floor(Math.random() * L.length)], true); return; }
      var sec = Math.ceil(left / 1000); if (sec !== lastTick && left < 3000) { lastTick = sec; SND.play('tick'); }
      paintClock();
    }, 50);
  }
  function paintClock() { var left = Math.max(0, deadline - Date.now()); $('centre').textContent = (left / 1000).toFixed(1); $('centre').classList.toggle('hot', left < 1000); }
  function stopClock() { clearInterval(tick); $('centre').classList.remove('clock', 'hot'); $('centre').textContent = ''; }

  // ── the game ──
  // Signed in, the server deals the seed and later replays the moves before a run reaches the
  // leaderboard. Guests, a ?seed= practice table or a failed call play unranked with a local seed.
  function deal() {
    if (dealing) return; dealing = true;
    SND.unlock(); SND.play('deal');
    var m = location.search.match(/[?&]seed=(\d+)/);
    if (m && !G) return begin(+m[1], false);
    fetch('/api/nn/start', { method: 'POST', credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { begin(d && d.seed != null ? d.seed : null, !!(d && d.seed != null)); }, function () { begin(null, false); });
  }
  function begin(seed, ranked) {
    dealing = false;
    G = NN.newGame(seed); G.ranked = ranked; rot = 0; busy = true; stage = -1; stopClock(); clearFx(true);
    $('seed').textContent = G.seed; $('nuke').hidden = true; $('banner').hidden = true;
    closeSheets(); $('start').hidden = true;
    render(G); paintLog();
    G.log.unshift('outer A ' + NN.name(G.outer[0]) + ' · B ' + NN.name(G.outer[1]) + ' · D ' + NN.name(G.outer[2]) + ' · C ' + NN.name(G.outer[3]), 'inner 1 ' + NN.name(G.inner[0]) + ' · 2 ' + NN.name(G.inner[1]) + ' · 4 ' + NN.name(G.inner[2]) + ' · 3 ' + NN.name(G.inner[3]));
    paintLog();
    if (window.vgTrack) vgTrack('nn_deal', { seed: G.seed });
    status('The leaders take their seats…');
    var n = 3, cd = $('countdown'); cd.hidden = false; $('cdNum').textContent = n; SND.play('count');
    var t = setInterval(function () {
      n--; if (n > 0) { $('cdNum').textContent = n; SND.play('count'); return; }
      clearInterval(t); cd.hidden = true; revealRogues();
    }, 1000);
  }
  function revealRogues() {
    NN.reveal(G); render(G); SND.play('reveal');
    Array.prototype.forEach.call(document.querySelectorAll('.seat.rogue'), function (el) { el.classList.add('ignite'); });
    $('table').classList.add('shake'); setTimeout(function () { $('table').classList.remove('shake'); }, 500);
    banner('ROGUE REVEAL', rogueNames().toUpperCase() + ' HAVE GONE ROGUE');
    paintLog(); status('ROGUE REVEAL · ' + rogueNames() + ' have gone rogue. Tap a rogue to swap.');
    setTimeout(function () { busy = false; markLegal(); armClock(); }, 900);
  }
  function rogueNames() { return Object.keys(G.rogue).map(NN.name).join(' and '); }

  function play(k, timeout) {
    if (busy || !G || G.over || NN.legal(G).indexOf(k) < 0) return;
    busy = true; stopClock(); clearFx(false);
    var tmp = JSON.parse(JSON.stringify(G)); var t = tmp.outer[k]; tmp.outer[k] = tmp.inner[k]; tmp.inner[k] = t;
    var line = NN.notation(G, k);
    Array.prototype.forEach.call(document.querySelectorAll('.seat[data-k="' + k + '"]'), function (el) { el.classList.add('swap'); el.classList.remove('can'); });
    SND.play('swap');
    status(line + (timeout ? ' · TIME IS UP, the table moves for you' : ' · swapping…'));
    setTimeout(function () {
      var saved = G; G = tmp; render(G); G = saved;   // paint the swapped table, not yet turned
      setTimeout(function () {
        var res = NN.apply(G, k); if (timeout) G.log[G.log.length - 1] += ' (timeout)'; rot += 90; render(G); paintLog(); SND.play('turn');
        status(line + ' · the outer wheel turns');
        setTimeout(function () {
          if (G.over) return nuke(res);
          var ev = NN.after(G);
          if (ev && ev.escalate) return escalateFx(ev.escalate);
          if (ev && ev.calm) return calmFx(ev);
          if (ev && ev.swap) return swapFx(ev.swap, nextMove);
          if (ev && ev.aliens) return aliensFx(ev.aliens);
          nextMove();
        }, 800);
      }, 150);
    }, 420);
  }
  function nextMove() {
    if (G.lizard && !NN.lizard(G) && document.querySelector('.seat.lizard')) render(G);   // the lizards turn back
    busy = false; markLegal(); armClock();
    var lz = G.lizard - G.moves;
    status('Move ' + (G.moves + 1) + ' · rogues at ' + NN.rogues(G) + (lz > 0 ? ' · lizards for ' + lz + ' more move' + (lz === 1 ? '' : 's') : '') + ' · tap a rogue');
  }
  function escalateFx(pick) {
    render(G); SND.play('reveal'); paintLog();
    Array.prototype.forEach.call(document.querySelectorAll('.seat.rogue'), function (el) { el.classList.add('ignite'); });
    $('table').classList.add('shake'); setTimeout(function () { $('table').classList.remove('shake'); }, 500);
    banner('ESCALATION', NN.name(pick.id).toUpperCase() + ' HAS GONE ROGUE');
    status('ESCALATION · ' + NN.name(pick.id) + ' joins the rogues for ' + NN.SPELL + ' moves');
    if (window.vgTrack) vgTrack('nn_escalate', { moves: G.moves, seed: G.seed });
    setTimeout(nextMove, 1300);
  }
  // The escalation ends: the third rogue stands down, then SWAP!.
  function calmFx(ev) {
    var el = document.querySelector('.seat[data-id="' + ev.calm + '"]'); if (el) el.classList.remove('rogue', 'can');
    SND.play('hurry'); paintLog();
    banner('HURRY UP', NN.name(ev.calm).toUpperCase() + ' STANDS DOWN');
    status('HURRY UP · ' + NN.name(ev.calm) + ' is no longer rogue');
    setTimeout(function () { if (ev.swap) swapFx(ev.swap, nextMove); else { render(G); nextMove(); } }, 1300);
  }
  // SWAP!: the rogue and the calm leader fly across the table into each other's seats.
  function swapFx(sw, done) {
    var tb = $('table').getBoundingClientRect(), A = document.querySelector('.seat[data-id="' + sw.a.id + '"]'), B = document.querySelector('.seat[data-id="' + sw.b.id + '"]');
    banner('SWAP!', NN.name(sw.a.id).toUpperCase() + ' AND ' + NN.name(sw.b.id).toUpperCase() + ' CHANGE SEATS');
    SND.play('bigswap'); paintLog();
    status('SWAP! · rogue ' + NN.name(sw.a.id) + ' changes seats with ' + NN.name(sw.b.id));
    if (window.vgTrack) vgTrack('nn_swap', { moves: G.moves, seed: G.seed });
    if (!A || !B) { render(G); return setTimeout(done, 1300); }
    var ra = A.getBoundingClientRect(), rb = B.getBoundingClientRect();
    function fly(el, from, to) {
      var c = el.cloneNode(true); c.classList.remove('can', 'ignite', 'swap'); c.classList.add('fx', 'flyer'); c.style.visibility = 'visible';
      c.style.transform = 'none'; c.style.margin = '0'; c.style.width = from.width + 'px'; c.style.height = from.height + 'px';
      c.style.left = (from.left - tb.left) + 'px'; c.style.top = (from.top - tb.top) + 'px';
      var cv = c.querySelector('canvas'); if (cv) { var src = el.querySelector('canvas'); cv.getContext('2d').drawImage(src, 0, 0); }
      $('table').appendChild(c); void c.offsetWidth;
      c.style.left = (to.left - tb.left) + 'px'; c.style.top = (to.top - tb.top) + 'px';
      return c;
    }
    A.style.visibility = B.style.visibility = 'hidden';
    var fa = fly(A, ra, rb), fb = fly(B, rb, ra);
    setTimeout(function () { fa.remove(); fb.remove(); render(G); markSwapped(sw); setTimeout(done, 350); }, 1100);
  }
  function markSwapped(sw) { [sw.a.id, sw.b.id].forEach(function (id) { var e = document.querySelector('.seat[data-id="' + id + '"]'); if (e) e.classList.add('ignite'); }); }
  // Aliens: a saucer comes down, beams every leader up and sets them down reshuffled, as lizards.
  function aliensFx(al) {
    var ufo = document.createElement('div'); ufo.className = 'fx ufo'; ufo.appendChild(PX.draw('ufo', 8));
    var beam = document.createElement('div'); beam.className = 'fx beam';
    $('table').appendChild(beam); $('table').appendChild(ufo);
    SND.play('ufo'); paintLog();
    banner('ALIEN INVASION', 'THE LEADERS ARE BEAMED UP');
    status('ALIEN INVASION · the game is paused');
    if (window.vgTrack) vgTrack('nn_aliens', { moves: G.moves, seed: G.seed });
    setTimeout(function () { beam.classList.add('on'); Array.prototype.forEach.call(document.querySelectorAll('.seat'), function (e) { e.classList.add('beamout'); }); SND.play('beam'); }, 900);
    setTimeout(function () {
      render(G);
      Array.prototype.forEach.call(document.querySelectorAll('.seat'), function (e) { e.classList.add('beamin'); });
      SND.play('beam');
      banner('LIZARD LEADERS', 'NEW SEATS · LIZARDS FOR ' + al.lizard + ' MOVES');
    }, 2300);
    setTimeout(function () { beam.classList.remove('on'); ufo.classList.add('away'); }, 3500);
    setTimeout(function () { ufo.remove(); beam.remove(); Array.prototype.forEach.call(document.querySelectorAll('.seat.beamin'), function (e) { e.classList.remove('beamin'); }); nextMove(); }, 4100);
  }

  // ── distractions: on screen only, the rules ignore them ──
  var fxT = [];
  function later(f, ms) { fxT.push(setTimeout(f, ms)); }
  // all: also the gorilla, which otherwise walks on after the move is played
  function clearFx(all) {
    fxT.forEach(clearTimeout); fxT = [];
    Array.prototype.forEach.call(document.querySelectorAll(all ? '.fx' : '.fx.dark, .fx.pop'), function (e) { e.remove(); });
    Array.prototype.forEach.call(document.querySelectorAll('.seat.blown'), function (e) { e.classList.remove('blown'); });
  }
  function distract(kind, ms) {
    if (window.vgTrack) vgTrack('nn_distraction', { kind: kind, moves: G.moves });
    if (kind === 'gorilla') {
      var go = document.createElement('div'), left = G.moves % 2;
      go.className = 'fx gorilla' + (left ? ' rtl' : ''); go.style.animationDuration = (ms + 900) + 'ms';
      go.appendChild(PX.draw('gorilla', 8)); $('table').appendChild(go); SND.play('thump');
      for (var t = 350; t < ms + 600; t += 350) setTimeout(function () { SND.play('thump'); }, t);
      setTimeout(function () { go.remove(); }, ms + 1000);
    } else if (kind === 'lights') {
      var dk = document.createElement('div'); dk.className = 'fx dark'; document.body.appendChild(dk);
      later(function () { dk.classList.add('flicker'); SND.play('lights'); }, ms * 0.05);
      later(function () { dk.classList.remove('flicker'); dk.classList.add('off'); }, ms * 0.05 + 260);
      later(function () { dk.classList.remove('off'); dk.classList.add('flicker'); SND.play('lights'); }, ms * 0.7);
      later(function () { dk.remove(); }, ms * 0.7 + 260);
    } else if (kind === 'paparazzi') {
      var n = ms > 1500 ? 6 : 3;
      for (var i = 0; i < n; i++) later(flash, ms * (0.08 + 0.75 * i / n));
    }
  }
  // One camera flash: a white burst over a leader's face, blown out for a moment.
  function flash() {
    var seats = document.querySelectorAll('.seat'); if (!seats.length) return;
    var el = seats[Math.floor(Math.random() * seats.length)], tb = $('table').getBoundingClientRect(), r = el.getBoundingClientRect();
    var p = document.createElement('div'); p.className = 'fx pop';
    p.style.left = (r.left + r.width / 2 - tb.left) + 'px'; p.style.top = (r.top + r.height / 2 - tb.top) + 'px';
    $('table').appendChild(p); el.classList.add('blown'); SND.play('flash');
    later(function () { p.remove(); el.classList.remove('blown'); }, 450);
  }
  function nuke(res) {
    var k = res.war, w = $('nkWhy'); w.innerHTML = ''; clearFx(true);
    SND.play('nuke');
    w.appendChild(face(G.outer[k])); w.appendChild(document.createTextNode(NN.name(G.outer[k]).toUpperCase() + ' AND '));
    w.appendChild(face(G.inner[k])); w.appendChild(document.createTextNode(NN.name(G.inner[k]).toUpperCase() + ' FACE EACH OTHER · YOU LASTED ' + G.moves + ' MOVE' + (G.moves === 1 ? '' : 'S')));
    $('cloud').innerHTML = ''; $('cloud').appendChild(PX.draw('nuke', 16)); $('nuke').hidden = false;
    $('table').classList.add('shake'); setTimeout(function () { $('table').classList.remove('shake'); }, 500);
    if (G.moves > best) { best = G.moves; $('best').textContent = best; try { localStorage.setItem('nn-best', best); } catch (e) {} }
    status('');
    if (window.vgTrack) vgTrack('nn_over', { moves: G.moves, seed: G.seed });
    // A ranked run sends the positions played; the server replays them from the seed it dealt.
    if (G.ranked) fetch('/api/nn/result', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ks: G.ks }) }).catch(function () {});
  }

  // ── chrome ──
  function openSheet(id) { closeSheets(); $('scrim').hidden = false; $(id).hidden = false; }
  function closeSheets() { $('scrim').hidden = true; ['how', 'logSheet'].forEach(function (id) { $(id).hidden = true; }); }
  $('btnDeal').onclick = deal; $('btnAgain').onclick = deal; $('btnNew').onclick = deal;
  $('btnHow').onclick = function () { openSheet('how'); };
  $('btnLog').onclick = $('btnLog2').onclick = function () { paintLog(); openSheet('logSheet'); };
  $('btnSound').onclick = function () { SND.on = !SND.on; SND.unlock(); $('btnSound').textContent = SND.on ? '🔊' : '🔇'; if (SND.on) SND.play('count'); };
  $('btnCopy').onclick = function () {
    if (!G) return;
    var txt = NN.logText(G);
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { status('Log copied.'); }, function () { window.prompt('Copy the log', txt); });
  };
  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) { b.onclick = closeSheets; });
  $('scrim').onclick = function () { if ($('start').hidden) closeSheets(); };
  $('scrim').hidden = false;                                              // start sheet is up
  render({ outer: NN.LEADERS.slice(0, 4).map(function (l) { return l.id; }), inner: NN.LEADERS.slice(4).map(function (l) { return l.id; }), rogue: {} });
})();
