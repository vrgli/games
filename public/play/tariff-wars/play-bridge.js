/* Fitz & Pop Arcade bridge for Tariff Wars.
   Watches window.__kl.game and reports the finished match once to /api/sessions. */
(function () {
  var GAME_ID = 'tariff-wars';
  if (window.top === window.self) {
    var addHome = function () {
      if (document.getElementById('arcade-home') || document.getElementById('ah-arcade')) return;
      var a = document.createElement('a');
      a.id = 'arcade-home'; a.href = '/'; a.textContent = '← Home';
      // CANONICAL arcade home button — keep identical across every game's
      // play-bridge.js (see the clearance rule in this game's CSS). Do not
      // restyle per-game: a divergent button is what caused the overlap bugs.
      a.style.cssText = 'position:fixed;left:12px;top:11px;z-index:2147483000;display:inline-flex;' +
        'align-items:center;background:#e8c15a;color:#1a1205;padding:7px 14px;border-radius:9px;' +
        'font:700 13px/1 system-ui,-apple-system,sans-serif;text-decoration:none;' +
        'box-shadow:0 2px 10px rgba(0,0,0,.45)';
      document.body.appendChild(a);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addHome);
    else addHome();
  }
  var tracked = { seed: null, reported: false };
  setInterval(function () {
    try {
      var g = window.__kl && window.__kl.game;
      if (!g || typeof g.getState !== 'function') return;
      var s = g.getState();
      if (s.seed !== tracked.seed) {
        tracked = { seed: s.seed, reported: false };
        // Only a game that is actually being played: the start screen deals a
        // fresh seed every time the mode changes.
        if (window.vgTrack && s.mode && s.status !== 'done') window.vgTrack('solo_start', { mode: s.mode, humans: 1, ai: 3 });
      }
      if (s.status === 'done' && !tracked.reported) {
        tracked.reported = true;
        fetch('/api/sessions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
          body: JSON.stringify({
            game: GAME_ID, seed: String(s.seed), score: s.score, uid: (function () { try { return localStorage.getItem('vg_uid'); } catch (e) { return null; } })(),
            // A finished game is always status 'completed' and carries the win in
            // wonAt — same contract as KK and YGM. Reporting status 'won' (as this
            // bridge used to) hid the row from the leaderboard AND from XP, both of
            // which select on status = 'completed'. So Presina's only solo WIN was
            // the one play that never showed up.
            status: 'completed',
            wonAt: s.won ? ((s.place || '1st') + ' place · ' + s.turns_taken + ' hands') : null,
            // mode → the leaderboard's per-mode tab; the rest are the XP signals
            // (xp.js Length axis, min-play guard, and the 3-opponent bump — Presina
            // is always a four-seat table).
            meta: {
              mode: s.mode || '',
              duration_seconds: s.duration_seconds,
              turns_taken: s.turns_taken,
              players: s.players,
              margin: s.margin,
            },
            log: [s.faction + ' finished ' + s.place + ' with ' + s.score + ' points'],
          }),
        }).catch(function () {});
      }
    } catch (e) {}
  }, 800);
})();
