// Player accounts. One Durable Object with SQLite storage, named 'arcade'.
// Holds what a sign-in gives us (provider, opaque subject, display name, avatar
// URL) and per-game tallies. No e-mail, no IP. Called only by the Worker over
// stub.fetch('https://accounts/...'); nothing here is reachable from a browser.
const LIMIT = 10_000_000;
const now = () => new Date().toISOString();
const int = (v) => Math.min(LIMIT, Math.max(0, Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0));
const cleanName = (v) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, 24);
import NN from '../public/play/nuclear-negotiations/engine.js';
const hex16 = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');

// How long a Nuclear Negotiations run of n moves can take, from the deal to the nuke. game.js
// spends 3.9 s on the countdown and reveal and about 1.4 s animating each move, plus 1.3 s when
// a rogue joins or stands down; on top of that each move has its clock. The bounds are loose on
// purpose: the floor stops a run that was never played, the ceiling one worked out off the clock.
const nnMinMs = (n) => 3000 + 1000 * n;
function nnMaxMs(n) {
  let t = 3900 + 60_000;
  for (let m = 0; m < n; m++) t += NN.clockMs(m) + 3800;
  return t;
}

export class Accounts {
  constructor(state) {
    this.sql = state.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, provider TEXT NOT NULL, subject TEXT NOT NULL,
      name TEXT, avatar TEXT, created TEXT NOT NULL, last_seen TEXT NOT NULL,
      UNIQUE(provider, subject)
    )`);
    // nick_set: 1 once the player chose their own nickname (added 2026-10-31).
    try { this.sql.exec(`ALTER TABLE accounts ADD COLUMN nick_set INTEGER DEFAULT 0`); } catch (e) {}
    // Names that came from a provider before nicknames existed are never shown.
    this.sql.exec(`UPDATE accounts SET name='Player' WHERE COALESCE(nick_set,0)=0 AND name<>'Player'`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS wallop (
      account_id TEXT PRIMARY KEY, noise INTEGER DEFAULT 0, teeth INTEGER DEFAULT 0, battles INTEGER DEFAULT 0,
      bets INTEGER DEFAULT 0, bets_won INTEGER DEFAULT 0, bonus_given INTEGER DEFAULT 0, updated TEXT
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS tariff_wars (
      account_id TEXT PRIMARY KEY, games INTEGER DEFAULT 0, won INTEGER DEFAULT 0,
      margin_total INTEGER DEFAULT 0, best_margin INTEGER DEFAULT 0, updated TEXT
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS nuclear_negotiations (
      account_id TEXT PRIMARY KEY, best INTEGER DEFAULT 0, games INTEGER DEFAULT 0, updated TEXT
    )`);
    // The seed dealt for the account's game in progress and when (ms). One at a time per account.
    try { this.sql.exec(`ALTER TABLE nuclear_negotiations ADD COLUMN pending_seed INTEGER`); } catch (e) {}
    try { this.sql.exec(`ALTER TABLE nuclear_negotiations ADD COLUMN pending_at INTEGER`); } catch (e) {}
  }

  one(q, ...a) { return this.sql.exec(q, ...a).toArray()[0] || null; }
  account(id) { return this.one(`SELECT * FROM accounts WHERE id=?`, id); }
  wallop(id) { return this.one(`SELECT * FROM wallop WHERE account_id=?`, id); }
  tw(id) { return this.one(`SELECT * FROM tariff_wars WHERE account_id=?`, id); }
  nn(id) { return this.one(`SELECT account_id, best, games, updated FROM nuclear_negotiations WHERE account_id=?`, id); }

  async fetch(req) {
    const url = new URL(req.url);
    const p = url.pathname;
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const bad = (m) => Response.json({ error: m }, { status: 400 });

    // Create on first sign-in, refresh on later ones. The provider's name is only
    // taken when we have none yet, so a /rename is not undone by the next login.
    if (p === '/upsert' && req.method === 'POST') {
      const provider = String(body.provider || ''), subject = String(body.subject || '');
      if (!provider || !subject) return bad('provider and subject required');
      // The provider's real name is never stored or shown: a player is 'Player'
      // until they pick a nickname (#12).
      const avatar = body.avatar ? String(body.avatar).slice(0, 512) : null, t = now();
      this.sql.exec(
        `INSERT INTO accounts (id,provider,subject,name,avatar,created,last_seen) VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(provider,subject) DO UPDATE SET
           avatar = COALESCE(excluded.avatar, accounts.avatar), last_seen = excluded.last_seen`,
        hex16(), provider, subject, 'Player', avatar, t, t);
      return Response.json({ account: this.one(`SELECT * FROM accounts WHERE provider=? AND subject=?`, provider, subject) });
    }

    if (p === '/account') {
      const id = url.searchParams.get('id') || '';
      const account = this.account(id);
      return Response.json(account ? { account, wallop: this.wallop(id), tariff_wars: this.tw(id), nuclear_negotiations: this.nn(id) } : { account: null });
    }

    // Wallop is a client-side simulation; the reported balances are taken as-is
    // (clamped). First sync ever hands out a one-off 250 Noise welcome bonus.
    if (p === '/wallop/sync' && req.method === 'POST') {
      const id = String(body.accountId || '');
      if (!this.account(id)) return bad('no such account');
      const row = this.wallop(id);
      let noise = int(body.noise), bonusApplied = false;
      if (!row || !row.bonus_given) { noise = Math.min(LIMIT, noise + 250); bonusApplied = true; }
      this.sql.exec(
        `INSERT INTO wallop (account_id,noise,teeth,battles,bets,bets_won,bonus_given,updated) VALUES (?,?,?,?,?,?,1,?)
         ON CONFLICT(account_id) DO UPDATE SET noise=excluded.noise, teeth=excluded.teeth, battles=excluded.battles,
           bets=excluded.bets, bets_won=excluded.bets_won, bonus_given=1, updated=excluded.updated`,
        id, noise, int(body.teeth), int(body.battles), int(body.bets), int(body.bets_won), now());
      return Response.json({ wallop: this.wallop(id), bonusApplied });
    }

    // One finished Tariff Wars game. margin = winner's lead over the runner-up.
    if (p === '/tw/result' && req.method === 'POST') {
      const id = String(body.accountId || '');
      if (!this.account(id)) return bad('no such account');
      const won = body.won ? 1 : 0, margin = won ? int(body.margin) : 0;
      this.sql.exec(
        `INSERT INTO tariff_wars (account_id,games,won,margin_total,best_margin,updated) VALUES (?,1,?,?,?,?)
         ON CONFLICT(account_id) DO UPDATE SET games=games+1, won=won+excluded.won, margin_total=margin_total+excluded.margin_total,
           best_margin=MAX(best_margin, excluded.best_margin), updated=excluded.updated`,
        id, won, margin, margin, now());
      return Response.json({ tariff_wars: this.tw(id) });
    }

    // Nuclear Negotiations: the server deals the seed, so a run can be replayed and timed.
    if (p === '/nn/start' && req.method === 'POST') {
      const id = String(body.accountId || '');
      if (!this.account(id)) return bad('no such account');
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      this.sql.exec(
        `INSERT INTO nuclear_negotiations (account_id,pending_seed,pending_at) VALUES (?,?,?)
         ON CONFLICT(account_id) DO UPDATE SET pending_seed=excluded.pending_seed, pending_at=excluded.pending_at`,
        id, seed, Date.now());
      return Response.json({ seed });
    }

    // One finished run: the positions played (ks). Replayed from the dealt seed; it counts only
    // if every move was legal, it ended in war, and it took a humanly possible amount of time.
    if (p === '/nn/result' && req.method === 'POST') {
      const id = String(body.accountId || '');
      const row = this.one(`SELECT pending_seed, pending_at FROM nuclear_negotiations WHERE account_id=?`, id);
      if (!row || row.pending_seed == null) return bad('no game dealt');
      this.sql.exec(`UPDATE nuclear_negotiations SET pending_seed=NULL, pending_at=NULL WHERE account_id=?`, id);
      const ks = Array.isArray(body.ks) && body.ks.length <= 5000 ? body.ks : null;
      const g = ks && NN.replay(row.pending_seed, ks);
      if (!g) return bad('replay failed');
      const took = Date.now() - row.pending_at;
      // Events (SWAP!, aliens) pause the table on screen; the replay knows which ones happened.
      if (took < nnMinMs(g.moves) || took > nnMaxMs(g.moves) + NN.pauseMs(g)) return bad('timing');
      const moves = g.moves;
      this.sql.exec(
        `INSERT INTO nuclear_negotiations (account_id,best,games,updated) VALUES (?,?,1,?)
         ON CONFLICT(account_id) DO UPDATE SET games=games+1, best=MAX(best, excluded.best), updated=excluded.updated`,
        id, moves, now());
      return Response.json({ nuclear_negotiations: this.nn(id) });
    }

    if (p === '/leaderboard') {
      const rows = (q) => this.sql.exec(q).toArray();
      return Response.json({
        wallop: rows(`SELECT a.id, a.name, a.avatar, w.teeth, w.noise, w.battles FROM wallop w JOIN accounts a ON a.id=w.account_id
                      ORDER BY w.teeth DESC, w.noise DESC LIMIT 50`),
        tariff_wars: rows(`SELECT a.id, a.name, a.avatar, t.won, t.margin_total, t.games FROM tariff_wars t JOIN accounts a ON a.id=t.account_id
                           ORDER BY t.won DESC, t.margin_total DESC LIMIT 50`),
        nuclear_negotiations: rows(`SELECT a.id, a.name, a.avatar, n.best, n.games FROM nuclear_negotiations n JOIN accounts a ON a.id=n.account_id
                                    WHERE n.best>0 ORDER BY n.best DESC, n.updated ASC LIMIT 50`),
      });
    }

    if (p === '/rename' && req.method === 'POST') {
      const id = String(body.accountId || ''), name = String(body.name || '').trim();
      if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) return Response.json({ error: 'invalid' });
      const clash = this.one(`SELECT id FROM accounts WHERE lower(name)=lower(?) AND id<>?`, name, id);
      if (clash) return Response.json({ error: 'taken' });
      this.sql.exec(`UPDATE accounts SET name=?, nick_set=1 WHERE id=?`, name, id);
      const account = this.account(id);
      return account ? Response.json({ account }) : bad('no such account');
    }

    return new Response('not found', { status: 404 });
  }
}
