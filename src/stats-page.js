// /stats — aggregate play statistics, readable by anyone. Nothing personal: counts by day, game, country, device.
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function table(title, rows) {
  if (!rows || !rows.length) return `<section><h2>${esc(title)}</h2><p class="mute">nothing yet</p></section>`;
  const cols = Object.keys(rows[0]);
  return `<section><h2>${esc(title)}</h2><table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${
    rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`;
}
export function statsPage(d) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stats · play.vrg.li</title><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/play.css"></head>
<body><script src="/env.js"></script><script src="/vrg-chrome.js" data-app="Play · stats" data-public="1"></script>
<main class="wrap"><p class="kicker">PLAY STATISTICS</p><h1>What Play VRG has counted</h1>
<p class="mute">Generated ${esc(d.generated)}. Aggregates only; see <a href="/privacy">privacy</a>.</p>
${table('Games per day', d.gamesPerDay)}${table('Totals by event and game', d.totals)}${table('Players per day', d.players)}
${table('Finished games by mode', d.modes)}${table('Time on page', d.watchTime)}${table('Forks and downloads', d.forks)}${table('Countries', d.countries)}${table('Devices', d.devices)}${table('Referrers', d.referrers)}${table('Most recent events', d.recent)}
</main></body></html>`;
}
