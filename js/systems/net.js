// Play a Friend: two phones in one room (4-letter code) through the Worker's RoomDO.
// Each phone runs its own board with the full rules; the network carries what crosses over:
// attacks, fog / haste, board snapshots (drawn as the friend's board) and fx events.
(function (EB) {
  'use strict';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const EL = { fire: 'f', water: 'w', nature: 'n', lightning: 'l', neutral: 'u', garbage: 'g' };
  const EL_BACK = Object.fromEntries(Object.entries(EL).map(([k, v]) => [v, k]));
  const FORWARD = new Set(['clear', 'lock', 'garbage', 'popup', 'reaction', 'skill', 'skillready', 'burst', 'cancel', 'absorb', 'shield', 'purify']);
  const SNAP_EVERY = 0.07; // seconds between board snapshots (only sent when something changed)

  const Net = {
    ws: null, code: null, you: 0, players: [], status: 'idle', handlers: {},

    available() {
      try { return /^https?:$/.test(location.protocol) && /(^|\.)gilagames\.com$|\.workers\.dev$|^localhost$|^127\.0\.0\.1$/.test(location.hostname); } catch (e) { return false; }
    },
    newCode() {
      const b = new Uint8Array(4);
      crypto.getRandomValues(b);
      return Array.from(b, (x) => CODE_CHARS[x % CODE_CHARS.length]).join('');
    },
    cleanCode(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/[IO01]/g, '').slice(0, 4); },
    link(code) { return location.origin + location.pathname + '?room=' + code; },

    // on: { room(players, you), start(msg), msg(m), left(), closed(reason), full() }
    connect(code, hello, on) {
      Net.leave();
      Net.code = code; Net.handlers = on || {}; Net.status = 'connecting'; Net.hello = hello;
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      let ws;
      try { ws = new WebSocket(`${proto}//${location.host}/api/room/${code}`); } catch (e) { Net.fail('Could not connect.'); return; }
      Net.ws = ws;
      ws.onopen = () => { Net.status = 'open'; Net.raw({ t: 'hello', ...hello }); Net.ping = setInterval(() => Net.raw({ t: 'ping', id: Date.now() }), 20000); };
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch (err) { return; }
        const h = Net.handlers;
        switch (m.t) {
          case 'room': Net.you = m.you; Net.players = m.players; if (h.room) h.room(m.players, m.you); break;
          case 'start': if (h.start) h.start(m); break;
          case 'full': Net.status = 'full'; if (h.full) h.full(); break;
          case 'left': if (Net.match) Net.match.friendLeft(); if (h.left) h.left(); break;
          case 'pong': break;
          default: if (Net.match) Net.match.onMessage(m);
        }
      };
      ws.onclose = () => {
        clearInterval(Net.ping);
        if (Net.ws !== ws) return;
        const was = Net.status; Net.status = 'closed'; Net.ws = null;
        if (Net.match) Net.match.friendLeft(true);
        if (was !== 'full' && Net.handlers.closed) Net.handlers.closed();
      };
      ws.onerror = () => {};
    },
    fail(msg) { Net.status = 'closed'; if (Net.handlers.closed) Net.handlers.closed(msg); },
    raw(m) { if (Net.ws && Net.ws.readyState === 1) Net.ws.send(JSON.stringify(m)); },
    ready(on) { Net.raw({ t: 'ready', on: on !== false }); },
    leave() {
      Net.match = null;
      const ws = Net.ws; Net.ws = null; Net.status = 'idle'; Net.players = [];
      clearInterval(Net.ping);
      if (ws) try { ws.close(1000, 'leave'); } catch (e) { /* closed */ }
    },

    // the per-battle link handed to EB.Battle as o.online
    makeMatch() {
      const m = {
        battle: null, lastSnap: '', snapT: 0, over: false,
        send(msg) { Net.raw(msg); },
        event(type, data) {
          if (!FORWARD.has(type)) return;
          const d = Object.assign({}, data); delete d.side;
          Net.raw({ t: 'ev', type, d });
        },
        // called every frame by the game loop: send our board when it changed
        tick(dt) {
          const b = m.battle; if (!b) return;
          m.snapT += dt;
          if (m.snapT < SNAP_EVERY) return;
          m.snapT = 0;
          const s = snapshot(b.player);
          const key = JSON.stringify(s);
          if (key !== m.lastSnap) { m.lastSnap = key; Net.raw({ t: 'st', s }); }
        },
        onMessage(msg) {
          const b = m.battle; if (!b) return;
          if (msg.t === 'atk') b.remoteAttack(msg.lines, msg.el, msg.row);
          else if (msg.t === 'fx') {
            const secs = Math.max(0, Math.min(15, +msg.secs || 0));
            if (msg.kind === 'fog') { b.player.fogUntil = b.time + secs; b.emit('fog', { side: 'top', remote: true }); }
            if (msg.kind === 'haste') { b.player.hastedUntil = b.time + secs; b.player.popup('HASTED!', '#ffe14a', true); }
          } else if (msg.t === 'st') applySnapshot(b.ai, msg.s);
          else if (msg.t === 'ev' && FORWARD.has(msg.type)) b.emit(msg.type, Object.assign({}, msg.d, { side: 'bottom', remote: true }));
          else if (msg.t === 'dead') { if (!b.ai.dead) { b.ai.dead = true; b.ai.piece = null; b.emit('topout', { side: 'bottom', remote: true }); } }
        },
        friendLeft(closed) {
          const b = m.battle;
          if (!b || b.state === 'over') return;
          b.end('player', closed ? 'Connection lost' : 'Your friend left the match');
          if (closed) b.result.disconnected = true;
        },
      };
      Net.match = m;
      return m;
    },
  };

  // ---- board snapshots ----
  function encodeGrid(grid) {
    let s = '';
    for (const row of grid) for (const c of row) s += c ? (EL[c.el] || 'u') + (c.shape || '.') : '..';
    return s;
  }
  function snapshot(f) {
    const p = f.piece;
    return {
      g: encodeGrid(f.board.grid),
      p: p ? [p.card.id, p.rot, p.x, p.y] : null,
      h: f.deck.hold ? f.deck.hold.id : null,
      q: f.deck.queue.slice(0, 3).map((c) => c.id),
      k: f.skillCharge, sh: f.shield, cb: f.combo, inc: f.pendingLines(),
      en: f.energy, au: f.aura ? [f.aura.el, Math.max(0, f.aura.until - f.battle.time)] : null,
      s: { lines: f.stats.lines, sent: f.stats.sent, pieces: f.stats.pieces, maxCombo: f.stats.maxCombo, received: f.stats.received, reactions: f.stats.reactions, quads: f.stats.quads, cancelled: f.stats.cancelled, absorbed: f.stats.absorbed, bursts: f.stats.bursts },
      d: f.dead ? 1 : 0,
    };
  }
  function applySnapshot(f, s) {
    if (!s || typeof s.g !== 'string') return;
    const B = f.board, g = s.g;
    if (g.length === B.rows * B.cols * 2) {
      let i = 0;
      for (let r = 0; r < B.rows; r++) for (let c = 0; c < B.cols; c++, i += 2) {
        const e = g[i], sh = g[i + 1];
        B.grid[r][c] = e === '.' ? null : e === 'g' ? { el: 'garbage', kind: 'garbage' } : { el: EL_BACK[e] || 'neutral', shape: sh === '.' ? 'O' : sh, kind: 'block' };
      }
    }
    if (s.p && EB.CARDS[s.p[0]]) {
      const def = EB.CARDS[s.p[0]];
      f.piece = { card: { id: s.p[0], lvl: 1 }, shape: def.shape, el: def.element, rot: s.p[1] | 0, x: s.p[2] | 0, y: s.p[3] | 0 };
    } else f.piece = null;
    f.deck.hold = s.h && EB.CARDS[s.h] ? { id: s.h, lvl: 1 } : null;
    if (Array.isArray(s.q)) f.deck.queue = s.q.filter((id) => EB.CARDS[id]).map((id) => ({ id, lvl: 1 }));
    f.skillCharge = +s.k || 0; f.shield = +s.sh || 0; f.combo = +s.cb || 0;
    f.incoming = s.inc ? [{ lines: +s.inc, hole: 0, readyAt: 0 }] : [];
    if (s.en && typeof s.en === 'object') for (const el of EB.ELEMENT_IDS) f.energy[el] = +s.en[el] || 0;
    f.aura = s.au ? { el: s.au[0], until: f.battle.time + (+s.au[1] || 0) } : null;
    if (s.s) Object.assign(f.stats, s.s);
    if (s.d && !f.dead) { f.dead = true; f.piece = null; }
  }

  EB.Net = Net;
})(globalThis.EB = globalThis.EB || {});
