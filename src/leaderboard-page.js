// /leaderboard — top players by game, readable by anyone. Names and avatars are
// what players chose to sign in with; nothing else about them is shown.
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Bare branded page shell, shared with the sign-in notices in auth.js. The bar
// always carries a way back to the home page; signedIn adds SIGN OUT.
const SIGN_OUT = '<form method="post" action="/auth/logout" style="display:contents"><button type="submit">SIGN OUT</button></form>';
export function page(title, body, app = 'Play', signedIn = false) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · play.vrg.li</title><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/play.css">
<style>.av{width:24px;height:24px;border-radius:50%;object-fit:cover;background:var(--panel);border:1px solid var(--line);vertical-align:middle;margin-right:10px}
.av.i{display:inline-flex;align-items:center;justify-content:center;font:700 11px/1 var(--mono);color:var(--yl)}
td.p{white-space:nowrap}.you{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:-24px 0 40px;color:var(--mute)}.you b{color:var(--yl)}tr.me td{background:rgba(255,212,0,.08)}tr.me td.p{color:var(--yl)}td.n{color:var(--mute);width:36px}</style></head>
<body><div id="barActions"><a class="btn" href="/">← PLAY</a>${signedIn ? SIGN_OUT : ''}</div>
<script src="/env.js"></script><script src="/vrg-chrome.js" data-app="${esc(app)}" data-public="1" data-actions="#barActions"></script>
<main class="wrap"><p class="kicker">VRG · PLAY</p><h1>${esc(title)}</h1>${body}
<footer><a href="/">PLAY</a><a href="/source/">SOURCE</a><a href="/stats">STATS</a><a href="/privacy">PRIVACY</a></footer></main></body></html>`;
}

const avatar = (r) => r.avatar
  ? `<img class="av" src="${esc(r.avatar)}" alt="" referrerpolicy="no-referrer" onerror="this.outerHTML='<span class=&quot;av i&quot;>${esc((r.name || 'P')[0].toUpperCase())}</span>'">`
  : `<span class="av i">${esc((r.name || 'P')[0].toUpperCase())}</span>`;

function board(title, rows, cols, me) {
  if (!rows || !rows.length) return `<section><h2>${esc(title)}</h2><p class="mute">nobody on the board yet</p></section>`;
  return `<section><h2>${esc(title)}</h2><table><thead><tr><th>#</th><th>PLAYER</th>${cols.map(([, h]) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
    rows.map((r, i) => `<tr${me && r.id === me ? ' class="me"' : ''}><td class="n">${i + 1}</td><td class="p">${avatar(r)}${esc(r.name || 'Player')}</td>${
      cols.map(([k]) => `<td>${esc(Number(r[k] || 0).toLocaleString('en'))}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`;
}

// data = the Accounts DO's /leaderboard payload; account = the signed-in account or null.
export function leaderboardPage(data, account) {
  const me = account && account.id;
  const you = account && account.nick_set
    ? `<p class="you">Playing as <b>${esc(account.name)}</b><button class="fork" data-nick-edit="${esc(account.name)}">CHANGE NICKNAME</button></p><script src="/nick.js"></script>`
    : account ? '<script src="/nick.js"></script>' : '';
  const body = `<p class="lead">Top 50 per game. Sign in from any game to get on the board.</p>${you}
${board('Tariff Wars', data.tariff_wars, [['won', 'GAMES WON'], ['margin_total', 'MARGIN OVER RUNNER-UP'], ['games', 'GAMES']], me)}
${board('Wallop', data.wallop, [['teeth', 'TEETH'], ['noise', 'NOISE'], ['battles', 'BATTLES']], me)}
${board('Nuclear Negotiations', data.nuclear_negotiations, [['best', 'LONGEST RUN (MOVES)'], ['games', 'GAMES']], me)}`;
  return page('Leaderboard', body, 'Play · leaderboard', !!account);
}
