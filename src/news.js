// /news, /news.json and /feed.xml. On play.vrg.li they list the game entries;
// the same three under /studio/ list everything (games and apps), which is what
// vrg.li serves as its own /news.
import { NEWS } from './news-data.js';
import { page } from './leaderboard-page.js';

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const paras = (t) => t.split(/\n\n+/);

export function newsRoute(url, env) {
  let p = url.pathname;
  const studio = p.startsWith('/studio/');
  if (studio) p = p.slice(7);
  if (p !== '/news' && p !== '/news.json' && p !== '/feed.xml') return null;
  const items = NEWS.filter((n) => studio || n.kind === 'game');
  const origin = studio ? 'https://vrg.li' : 'https://play.vrg.li';
  const self = (env && env.ARCADE_ENV === 'uat') ? url.origin : origin;
  const title = studio ? 'VRG news' : 'VRG Play news';
  const base = self + (studio ? '/studio' : '');
  const abs = (u) => (u && u.startsWith('/') ? self + u : u);
  const cors = { 'Access-Control-Allow-Origin': '*' };

  if (p === '/news.json') {
    return Response.json({
      version: 'https://jsonfeed.org/version/1.1', title, home_page_url: origin, feed_url: base + '/news.json',
      items: items.map((n) => ({
        id: n.id, url: abs(n.url) || origin, title: n.title, content_text: n.body, date_published: n.date + 'T12:00:00Z',
        tags: [n.kind, n.about], ...(n.image ? { image: abs(n.image) } : {}),
      })),
    }, { headers: { ...cors, 'Content-Type': 'application/feed+json;charset=utf-8' } });
  }
  if (p === '/feed.xml') {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>${esc(title)}</title><id>${esc(origin)}/news</id>
<link rel="self" href="${esc(base)}/feed.xml"/><link rel="alternate" href="${esc(origin)}/news"/>
<updated>${items[0].date}T12:00:00Z</updated><author><name>VRG</name></author>
${items.map((n) => `<entry><id>${esc(origin)}/news#${esc(n.id)}</id><title>${esc(n.title)}</title><link href="${esc(abs(n.url) || origin)}"/>
<updated>${n.date}T12:00:00Z</updated><category term="${esc(n.kind)}"/><category term="${esc(n.about)}"/>
<content type="html">${esc((n.image ? '<p><img src="' + esc(abs(n.image)) + '" alt="' + esc(n.about) + '"/></p>' : '') + paras(n.body).map((t) => '<p>' + esc(t) + '</p>').join(''))}</content></entry>`).join('\n')}
</feed>`;
    return new Response(xml, { headers: { ...cors, 'Content-Type': 'application/atom+xml;charset=utf-8' } });
  }
  const body = `<link rel="alternate" type="application/atom+xml" href="${base}/feed.xml"><p class="mute">${studio ? 'Games and apps.' : 'Game updates.'} <a href="${base}/feed.xml">ATOM FEED</a> · <a href="${base}/news.json">JSON</a></p>` +
    items.map((n) => `<section id="${esc(n.id)}"><p class="kicker">${esc(n.date)} · ${esc(n.kind.toUpperCase())} · ${esc(n.about.toUpperCase())}</p><h2>${esc(n.title)}</h2>${n.image ? `<p><img src="${esc(abs(n.image))}" alt="${esc(n.about)}" style="max-width:100%;border-radius:8px" loading="lazy"></p>` : ''}${paras(n.body).map((t) => `<p>${esc(t)}</p>`).join('')}${n.url ? `<p><a href="${esc(n.url)}">${n.kind === 'game' ? 'PLAY' : 'OPEN'} →</a></p>` : ''}</section>`).join('');
  const html = page(title, body).replace('</head>', `<link rel="alternate" type="application/atom+xml" title="${esc(title)}" href="${esc(base)}/feed.xml"><link rel="alternate" type="application/feed+json" title="${esc(title)}" href="${esc(base)}/news.json"><link rel="me" href="https://mastodon.social/@vrg_li"></head>`);
  return new Response(html, { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
}
