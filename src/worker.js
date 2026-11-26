// Spellbricks Worker: serves the game from site/ (static assets) and keeps anonymous play
// statistics in one SQLite Durable Object.
//   POST /api/track  {pid, events:[{type, ...}]}  -> stored (the game sends these)
//   GET  /api/stats                               -> aggregated numbers for /stats/
// No names, emails or IP addresses are stored: only a random player id made by the game,
// the country Cloudflare reports for the request, and game results.
import { DurableObject } from 'cloudflare:workers';

const TZ_OFFSET_MS = 8 * 3600 * 1000;       // days are counted in Malaysia time (UTC+8)
const DAY = 86400000;
const MAX_EVENTS_PER_POST = 25;
const MAX_EVENTS_PER_10_MIN = 120;          // per player, to keep spam out
const TYPES = new Set(['open', 'run_start', 'battle', 'run_end', 'unlock']);
const ID = /^[a-z0-9_]{1,32}$/;

const json = (data, init = {}) => new Response(JSON.stringify(data), {
  ...init, headers: { 'content-type': 'application/json; charset=utf-8', ...(init.headers || {}) },
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/track') {
      if (request.method !== 'POST') return json({ error: 'POST only' }, { status: 405 });
      const len = +(request.headers.get('content-length') || 0);
      if (len > 32768) return json({ error: 'too large' }, { status: 413 });
      let body;
      try { body = JSON.parse(await request.text()); } catch { return json({ error: 'bad json' }, { status: 400 }); }
      const country = (request.cf && request.cf.country) || '';
      const res = await stub(env).track(body, typeof country === 'string' ? country.slice(0, 2) : '');
      return json(res, { status: res.ok ? 200 : 400 });
    }
    if (url.pathname === '/api/stats') {
      // cache for a minute so a busy stats page doesn't hammer the Durable Object
      const cache = caches.default, key = new Request(url.origin + '/api/stats', { method: 'GET' });
      let hit = await cache.match(key);
      if (hit) return hit;
      const res = json(await stub(env).stats(), { headers: { 'cache-control': 'public, max-age=60' } });
      ctx.waitUntil(cache.put(key, res.clone()));
      return res;
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, { status: 404 });
    return env.ASSETS.fetch(request);
  },
};

const stub = (env) => env.STATS.get(env.STATS.idFromName('global'));

// ---------- helpers for cleaning what the game sends ----------
const int = (v, lo, hi) => { v = Math.round(+v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null; };
const id = (v) => (typeof v === 'string' && ID.test(v) ? v : null);
const bool = (v) => (v === true || v === 1 ? 1 : v === false || v === 0 ? 0 : null);

function clean(e) {
  if (!e || !TYPES.has(e.type)) return null;
  return {
    type: e.type,
    mode: e.mode === 'run' || e.mode === 'quick' ? e.mode : null,
    win: bool(e.win),
    hero: id(e.hero),
    diff: int(e.diff, 0, 2),
    enemy: id(e.enemy),
    tier: ['normal', 'elite', 'boss'].includes(e.tier) ? e.tier : null,
    level: int(e.level, 0, 2),
    dungeon: int(e.dungeon, 1, 9),
    floor: int(e.floor, 0, 99),
    dur: int(e.dur, 0, 3600),
    lines: int(e.lines, 0, 5000),
    sent: int(e.sent, 0, 5000),
    combo: int(e.combo, 0, 200),
    ppm: int(e.ppm, 0, 600),
    reactions: int(e.reactions, 0, 500),
    score: int(e.score, 0, 10000000),
    device: e.device === 'touch' || e.device === 'desktop' ? e.device : null,
  };
}

const COLS = ['type', 'mode', 'win', 'hero', 'diff', 'enemy', 'tier', 'level', 'dungeon', 'floor', 'dur', 'lines', 'sent', 'combo', 'ppm', 'reactions', 'score', 'device'];

export class StatsDO extends DurableObject {
  constructor(state, env) {
    super(state, env);
    this.sql = state.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS players (
      pid TEXT PRIMARY KEY, first_ts INTEGER, last_ts INTEGER, sessions INTEGER DEFAULT 0, country TEXT, device TEXT)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, day INTEGER, pid TEXT,
      type TEXT, mode TEXT, win INTEGER, hero TEXT, diff INTEGER, enemy TEXT, tier TEXT, level INTEGER,
      dungeon INTEGER, floor INTEGER, dur INTEGER, lines INTEGER, sent INTEGER, combo INTEGER, ppm INTEGER,
      reactions INTEGER, score INTEGER, device TEXT)`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS ev_type_day ON events(type, day)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS ev_pid_ts ON events(pid, ts)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS ev_day_pid ON events(day, pid)');
  }

  q(sql, ...args) { return this.sql.exec(sql, ...args).toArray(); }
  one(sql, ...args) { return this.q(sql, ...args)[0] || {}; }

  async track(body, country) {
    const pid = body && typeof body.pid === 'string' && /^[a-z0-9]{12,40}$/.test(body.pid) ? body.pid : null;
    if (!pid || !Array.isArray(body.events)) return { ok: false, error: 'bad payload' };
    const now = Date.now(), day = Math.floor((now + TZ_OFFSET_MS) / DAY);
    const recent = this.one('SELECT COUNT(*) AS n FROM events WHERE pid = ? AND ts > ?', pid, now - 600000).n || 0;
    const room = Math.max(0, MAX_EVENTS_PER_10_MIN - recent);
    const evs = body.events.slice(0, Math.min(MAX_EVENTS_PER_POST, room)).map(clean).filter(Boolean);
    const p = this.one('SELECT pid FROM players WHERE pid = ?', pid);
    const opens = evs.filter((e) => e.type === 'open').length;
    const device = (evs.find((e) => e.device) || {}).device || null;
    if (!p.pid) this.sql.exec('INSERT INTO players (pid, first_ts, last_ts, sessions, country, device) VALUES (?, ?, ?, ?, ?, ?)', pid, now, now, opens, country || null, device);
    else this.sql.exec('UPDATE players SET last_ts = ?, sessions = sessions + ?, country = COALESCE(?, country), device = COALESCE(?, device) WHERE pid = ?', now, opens, country || null, device, pid);
    const ph = COLS.map(() => '?').join(',');
    for (const e of evs) this.sql.exec(`INSERT INTO events (ts, day, pid, ${COLS.join(',')}) VALUES (?, ?, ?, ${ph})`, now, day, pid, ...COLS.map((c) => e[c]));
    return { ok: true, stored: evs.length };
  }

  async stats() {
    const now = Date.now(), today = Math.floor((now + TZ_OFFSET_MS) / DAY);
    const dayOf = (ts) => Math.floor((ts + TZ_OFFSET_MS) / DAY);
    const active = (days) => this.one('SELECT COUNT(DISTINCT pid) AS n FROM events WHERE day > ?', today - days).n || 0;
    const newSince = (days) => this.one('SELECT COUNT(*) AS n FROM players WHERE first_ts >= ?', (today - days + 1) * DAY - TZ_OFFSET_MS).n || 0;

    const totals = {
      players: this.one('SELECT COUNT(*) AS n FROM players').n || 0,
      activeToday: active(1), active7: active(7), active30: active(30),
      newToday: newSince(1), new7: newSince(7),
      sessions: this.one('SELECT COALESCE(SUM(sessions),0) AS n FROM players').n || 0,
      ...this.one(`SELECT
        SUM(type='run_start') AS runsStarted,
        SUM(type='run_end' AND win=1) AS runsWon,
        SUM(type='battle') AS battles,
        SUM(type='battle' AND win=1) AS battlesWon,
        SUM(type='battle' AND tier='boss' AND win=1) AS bossesBeaten,
        SUM(CASE WHEN type='battle' THEN lines ELSE 0 END) AS lines,
        SUM(CASE WHEN type='battle' THEN dur ELSE 0 END) AS playSeconds
        FROM events`),
    };

    // last 30 days, one row per day (days with no play are filled with zeros)
    const byDay = {};
    for (const r of this.q(`SELECT day, COUNT(DISTINCT pid) AS players, SUM(type='run_start') AS runs, SUM(type='battle') AS battles
        FROM events WHERE day > ? GROUP BY day`, today - 30)) byDay[r.day] = r;
    const newByDay = {};
    for (const r of this.q('SELECT first_ts FROM players WHERE first_ts >= ?', (today - 29) * DAY - TZ_OFFSET_MS)) {
      const d = dayOf(r.first_ts); newByDay[d] = (newByDay[d] || 0) + 1;
    }
    const daily = [];
    for (let d = today - 29; d <= today; d++) {
      const r = byDay[d] || {};
      daily.push({ date: new Date(d * DAY).toISOString().slice(0, 10), players: r.players || 0, newPlayers: newByDay[d] || 0, runs: r.runs || 0, battles: r.battles || 0 });
    }

    const heroes = this.q(`SELECT hero,
        SUM(type='run_start') AS runs,
        SUM(type='run_end' AND win=1) AS wins,
        SUM(type='run_end') AS ended,
        MAX(CASE WHEN type='run_end' THEN dungeon END) AS bestDungeon
      FROM events WHERE hero IS NOT NULL AND type IN ('run_start','run_end') GROUP BY hero ORDER BY runs DESC`);

    const bosses = this.q(`SELECT enemy, dungeon, COUNT(*) AS fights, SUM(win=1) AS wins, MIN(CASE WHEN win=1 THEN dur END) AS fastest
      FROM events WHERE type='battle' AND mode='run' AND tier='boss' GROUP BY enemy ORDER BY MIN(dungeon), enemy`);

    const deadliest = this.q(`SELECT enemy, tier, COUNT(*) AS losses FROM events
      WHERE type='battle' AND mode='run' AND win=0 GROUP BY enemy ORDER BY losses DESC LIMIT 8`);

    const reached = this.q(`SELECT dungeon, COUNT(*) AS runs, SUM(win=1) AS wins FROM events
      WHERE type='run_end' GROUP BY dungeon ORDER BY dungeon`);

    const difficulty = this.q(`SELECT diff, COUNT(*) AS runs FROM events WHERE type='run_start' GROUP BY diff ORDER BY diff`);

    const quick = this.q(`SELECT level, COUNT(*) AS battles, SUM(win=1) AS wins FROM events
      WHERE type='battle' AND mode='quick' GROUP BY level ORDER BY level`);

    const topRuns = this.q(`SELECT e.pid, e.hero, e.diff, e.dungeon, e.floor, e.win, e.score, e.lines, e.combo, e.ts, p.country
      FROM events e LEFT JOIN players p ON p.pid = e.pid
      WHERE e.type='run_end' ORDER BY e.score DESC, e.ts ASC LIMIT 10`).map((r) => ({ ...r, pid: r.pid.slice(0, 6) }));

    const rec = (sql) => { const r = this.one(sql); return r.v == null ? null : { ...r, pid: r.pid ? r.pid.slice(0, 6) : null }; };
    const records = {
      bestScore: rec("SELECT score AS v, pid, hero, ts FROM events WHERE type='run_end' ORDER BY score DESC LIMIT 1"),
      bestCombo: rec("SELECT combo AS v, pid, hero, ts FROM events WHERE type='battle' ORDER BY combo DESC LIMIT 1"),
      bestPPM: rec("SELECT ppm AS v, pid, hero, ts FROM events WHERE type='battle' AND dur >= 30 ORDER BY ppm DESC LIMIT 1"),
      mostLines: rec("SELECT lines AS v, pid, hero, ts FROM events WHERE type='battle' ORDER BY lines DESC LIMIT 1"),
      fastestBoss: rec("SELECT dur AS v, pid, hero, enemy, ts FROM events WHERE type='battle' AND tier='boss' AND win=1 ORDER BY dur ASC LIMIT 1"),
    };

    const countries = this.q(`SELECT COALESCE(country,'??') AS country, COUNT(*) AS players FROM players GROUP BY country ORDER BY players DESC LIMIT 10`);
    const devices = this.q(`SELECT COALESCE(device,'unknown') AS device, COUNT(*) AS players FROM players GROUP BY device ORDER BY players DESC`);

    return { generated: now, totals, daily, heroes, bosses, deadliest, reached, difficulty, quick, topRuns, records, countries, devices };
  }
}
