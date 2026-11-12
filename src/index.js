// play.vrg.li — a personal arcade on Cloudflare Workers.
// Static client from ./public (Workers Assets); multiplayer tables are Durable
// Objects (see room.js), one per 4-letter table code.
import { Room } from './room.js';
import { Stats } from './stats.js';
import { statsPage } from './stats-page.js';
import { Accounts } from './accounts.js';
import { handleAuth, getSession } from './auth.js';
import { leaderboardPage } from './leaderboard-page.js';
import { newsRoute } from './news.js';
export { Room, Stats, Accounts };

const accounts = (env) => env.ACCOUNTS.get(env.ACCOUNTS.idFromName('arcade'));
const acct = (env, path, body) => accounts(env).fetch('https://accounts' + path, body ? { method: 'POST', body: JSON.stringify(body) } : undefined).then((r) => r.json());
const PROVIDER_KEYS = { google: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'], github: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'], discord: ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'], apple: ['APPLE_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY'] };
const providers = (env) => Object.fromEntries(Object.entries(PROVIDER_KEYS).map(([k, ks]) => [k, !!env.SESSION_SECRET && ks.every((n) => !!env[n])]));

const UA = (ua) => {
  ua = ua || '';
  const device = /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'phone' : 'desktop';
  const os = /Windows/i.test(ua) ? 'Windows' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Mac OS/i.test(ua) ? 'macOS' : /CrOS/i.test(ua) ? 'ChromeOS' : /Linux/i.test(ua) ? 'Linux' : 'other';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'other';
  return { device, os, browser };
};

// Enrich a client event with what the edge knows (country, device) and store it.
// No IP address is kept.
async function record(env, req, e) {
  const cf = req.cf || {};
  const ev = { ...e, country: cf.country || null, region: cf.region || null, city: cf.city || null, colo: cf.colo || null, ...UA(req.headers.get('User-Agent')) };
  await env.STATS.get(env.STATS.idFromName('arcade')).fetch('https://stats/ingest', { method: 'POST', body: JSON.stringify(ev) });
}

// The arcade moved from arcade.vrg.li to play.vrg.li. The old host (legacy/)
// hands a browser's saved settings over in the fragment #vgcarry=<base64 JSON>;
// keys already set here win, then the fragment is wiped from the address bar.
const CARRY_IN = `(function(){try{var m=location.hash.match(/(^#|&)vgcarry=([^&]*)/);if(!m)return;var d=JSON.parse(decodeURIComponent(escape(atob(m[2].replace(/-/g,'+').replace(/_/g,'/')))));for(var k in d)if(localStorage.getItem(k)===null)localStorage.setItem(k,d[k]);var h=location.hash.replace(m[0],'').replace(/^#&/,'#');history.replaceState(null,'',location.pathname+location.search+(h==='#'?'':h));}catch(e){}})();`;

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
function makeCode() {
  const b = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join('');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;

    // Environment marker: UAT pages show a banner and stay out of search engines.
    if (p === '/env.js') return new Response(`window.ARCADE_ENV=${JSON.stringify(env.ARCADE_ENV || 'production')};` + CARRY_IN + (env.ARCADE_ENV === 'uat' ? `document.addEventListener('DOMContentLoaded',function(){var b=document.createElement('div');b.textContent='UAT · staging copy · nothing here is permanent';b.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:2147483200;background:#ffd400;color:#111;font:800 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.14em;text-align:center;padding:5px 8px;pointer-events:none';document.body.appendChild(b);});` : ''), { headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' } });
    if (p === '/robots.txt') return new Response(env.ARCADE_ENV === 'uat' ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nAllow: /\n', { headers: { 'Content-Type': 'text/plain' } });

    if (p === '/mp-socket') {
      const code = url.searchParams.get('create') === '1' ? makeCode() : String(url.searchParams.get('room') || '').toUpperCase();
      if (!/^[A-Z2-9]{4}$/.test(code)) return new Response('bad table code', { status: 400 });
      const headers = new Headers(req.headers);
      headers.set('X-Room-Code', code);
      return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(new Request(req.url, { method: req.method, headers }));
    }

    // Play statistics — see /privacy. Beacons from vg.js and the games' bridges.
    if (p === '/e' && req.method === 'POST') {
      try { const e = await req.json(); if (e && typeof e === 'object') await record(env, req, e); } catch (err) {}
      return new Response(null, { status: 204 });
    }
    // Solo results from the game's own bridge (same payload it sent the old arcade).
    if (p === '/api/sessions' && req.method === 'POST') {
      try {
        const b = await req.json(); const m = b.meta || {};
        await record(env, req, { ev: 'solo_end', game: b.game, uid: b.uid || null, mode: m.mode, duration: m.duration_seconds, score: b.score, won: !!b.wonAt, turns: m.turns_taken, humans: 1, ai: 3 });
        const s = await getSession(req, env);
        if (s && b.game === 'tariff-wars') await acct(env, '/tw/result', { accountId: s.accountId, won: !!b.wonAt, margin: b.wonAt ? Math.max(0, Number(m.margin) || 0) : 0 });
      } catch (err) {}
      return new Response(null, { status: 204 });
    }
    if (p === '/stats.json' || p === '/stats') {
      const r = await env.STATS.get(env.STATS.idFromName('arcade')).fetch('https://stats/summary');
      const data = await r.json();
      return p === '/stats.json' ? Response.json(data) : new Response(statsPage(data), { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    if (p === '/arcade' || p === '/arcade/') return Response.redirect(url.origin + '/', 302);
    const vs = p.match(/^\/vs\/tariff-wars\/([A-Za-z0-9]{4})\/?$/);
    if (vs) return Response.redirect(url.origin + '/play/tariff-wars/?room=' + vs[1].toUpperCase(), 302);
    if (p === '/play/tariff-wars') return Response.redirect(url.origin + '/play/tariff-wars/' + url.search, 301);

    // Sign-in, accounts, leaderboard — see auth.js / accounts.js.
    if (p.startsWith('/auth/')) return handleAuth(req, env, url);
    if (p === '/api/me') {
      const s = await getSession(req, env);
      const d = s ? await acct(env, '/account?id=' + s.accountId) : { account: null };
      return Response.json({ account: d.account || null, wallop: d.wallop || null, tariff_wars: d.tariff_wars || null, nuclear_negotiations: d.nuclear_negotiations || null, providers: providers(env) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (p === '/api/wallop/sync' && req.method === 'POST') {
      const s = await getSession(req, env);
      if (!s) return Response.json({ error: 'sign in first' }, { status: 401 });
      const b = await req.json().catch(() => ({}));
      return Response.json(await acct(env, '/wallop/sync', { accountId: s.accountId, noise: b.noise, teeth: b.teeth, battles: b.battles, bets: b.bets, bets_won: b.bets_won }));
    }
    if (p === '/api/tw/result' && req.method === 'POST') {
      const s = await getSession(req, env);
      if (!s) return Response.json({ error: 'sign in first' }, { status: 401 });
      const b = await req.json().catch(() => ({}));
      return Response.json(await acct(env, '/tw/result', { accountId: s.accountId, won: !!b.won, margin: b.margin }));
    }
    if (p === '/api/nn/start' && req.method === 'POST') {
      const s = await getSession(req, env);
      if (!s) return Response.json({ error: 'sign in first' }, { status: 401 });
      return Response.json(await acct(env, '/nn/start', { accountId: s.accountId }));
    }
    if (p === '/api/nn/result' && req.method === 'POST') {
      const s = await getSession(req, env);
      if (!s) return Response.json({ error: 'sign in first' }, { status: 401 });
      const b = await req.json().catch(() => ({}));
      return Response.json(await acct(env, '/nn/result', { accountId: s.accountId, ks: b.ks }));
    }
    if (p === '/api/rename' && req.method === 'POST') {
      const s = await getSession(req, env);
      if (!s) return Response.json({ error: 'sign in first' }, { status: 401 });
      const b = await req.json().catch(() => ({}));
      return Response.json(await acct(env, '/rename', { accountId: s.accountId, name: b.name }));
    }
    if (p === '/leaderboard' || p === '/leaderboard.json') {
      const data = await acct(env, '/leaderboard');
      if (p === '/leaderboard.json') {
        const strip = (rows) => rows.map(({ id, ...r }) => r);
        return Response.json({ wallop: strip(data.wallop), tariff_wars: strip(data.tariff_wars), nuclear_negotiations: strip(data.nuclear_negotiations || []) });
      }
      const s = await getSession(req, env);
      const me = s ? (await acct(env, '/account?id=' + s.accountId)).account : null;
      return new Response(leaderboardPage(data, me), { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }
    const news = newsRoute(url, env);
    if (news) return news;
    // Wallop used to be BRUX.
    if (p === '/play/brux' || p.startsWith('/play/brux/')) return Response.redirect(url.origin + '/play/wallop/' + url.search, 301);
    if (p === '/play/wallop') return Response.redirect(url.origin + '/play/wallop/' + url.search, 301);
    if (p === '/play/nuclear-negotiations') return Response.redirect(url.origin + '/play/nuclear-negotiations/' + url.search, 301);

    return env.ASSETS.fetch(req);
  },
};
