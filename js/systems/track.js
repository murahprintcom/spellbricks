// Anonymous play statistics for the public stats page (spellbricks.gilagames.com/stats/).
// Sends small JSON events to /api/track on the same site: a random player id kept in
// localStorage, the device type and game results. No names, emails or IP addresses.
// Off when the game runs from a file, inside another page, or when the player turns it off
// in Settings -> Data.
(function (EB) {
  'use strict';
  const PID_KEY = 'spellbricks.pid';
  const ENDPOINT = '/api/track';
  const queue = [];
  let timer = 0, pid = null;

  const enabled = () => {
    try {
      if (!/^https?:$/.test(location.protocol) || window.top !== window.self) return false;
      if (!/(^|\.)gilagames\.com$|\.workers\.dev$|^localhost$|^127\.0\.0\.1$/.test(location.hostname)) return false;
    } catch (e) { return false; }
    return !EB.Save || EB.Save.settings.analytics !== false;
  };

  function playerId() {
    if (pid) return pid;
    try { pid = localStorage.getItem(PID_KEY); } catch (e) { /* storage blocked */ }
    if (!pid || !/^[a-z0-9]{12,40}$/.test(pid)) {
      const b = new Uint8Array(12);
      (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => { b[i] = Math.random() * 256; });
      pid = Array.from(b, (x) => x.toString(36).padStart(2, '0')).join('').slice(0, 20);
      try { localStorage.setItem(PID_KEY, pid); } catch (e) { /* this visit still counts */ }
    }
    return pid;
  }

  function flush(beacon) {
    clearTimeout(timer); timer = 0;
    if (!queue.length || !enabled()) { queue.length = 0; return; }
    const body = JSON.stringify({ pid: playerId(), events: queue.splice(0, 25) });
    try {
      if (beacon && navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      else fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
    } catch (e) { /* offline: stats are best effort */ }
    if (queue.length) timer = setTimeout(flush, 1000);
  }

  function send(type, data) {
    if (!enabled()) return;
    queue.push(Object.assign({ type }, data));
    if (!timer) timer = setTimeout(flush, 1500);
  }

  // Run score: floors cleared x100 + lines + attack sent, x difficulty (Easy 1, Normal 1.5, Hard 2),
  // +2000 for finishing all dungeons.
  function runScore(run, won) {
    const s = run.stats || {};
    const floors = EB.Track.floorsCleared(run, won);
    const mult = [1, 1.5, 2][run.difficulty || 0] || 1;
    return Math.round((floors * 100 + (s.lines || 0) + (s.sent || 0)) * mult) + (won ? 2000 : 0);
  }

  EB.Track = {
    enabled,
    floorsCleared: (run, won) => (run.dungeon || 0) * ((run.map && run.map.floors.length) || 8) + Math.max(0, (run.floor || 0) + (won ? 1 : 0)),
    runScore,
    open() {
      let touch = false;
      try { touch = matchMedia('(pointer: coarse)').matches; } catch (e) { /* old browser */ }
      send('open', { device: touch ? 'touch' : 'desktop' });
    },
    runStart(run) { send('run_start', { hero: run.hero || null, diff: run.difficulty }); },
    battle(res, cfg) {
      const t = (cfg && cfg.track) || {}, p = res.player;
      send('battle', {
        mode: cfg && cfg.mode, win: res.winner === 'player', hero: t.hero || null, diff: t.diff, enemy: t.enemy, tier: t.tier || 'normal',
        level: t.level, dungeon: t.dungeon, floor: t.floor, dur: res.duration, lines: p.lines, sent: p.sent, combo: p.maxCombo,
        ppm: res.duration > 0 ? p.pieces / (res.duration / 60) : 0, reactions: p.reactions,
      });
    },
    runEnd(run, won) {
      send('run_end', {
        win: won, hero: run.hero || null, diff: run.difficulty, dungeon: (run.dungeon || 0) + 1, floor: EB.Track.floorsCleared(run, won),
        lines: (run.stats || {}).lines, combo: (run.stats || {}).bestCombo, score: runScore(run, won),
      });
      flush();
    },
    unlock(hero) { send('unlock', { hero }); },
    flush,
  };

  window.addEventListener('pagehide', () => flush(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(true); });
})(globalThis.EB = globalThis.EB || {});
