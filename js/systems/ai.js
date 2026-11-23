// AI System. The AI controls its Fighter only through the same actions a human has
// (rotate, move, hold, hard drop) with human-like delays. It sees only its own board,
// its own active/held card and its own preview queue — no hidden advantages.
(function (EB) {
  'use strict';
  const C = () => EB.CONFIG;

  // ---- bit-mask board helpers ----
  function fitsM(m, cols, rows, shape, rot, x, y) {
    const cells = EB.SHAPES[shape].rots[rot];
    for (let i = 0; i < 4; i++) {
      const cx = x + cells[i][0], cy = y + cells[i][1];
      if (cx < 0 || cx >= cols || cy >= rows) return false;
      if (cy >= 0 && (m[cy] >> cx) & 1) return false;
    }
    return true;
  }

  function rotateM(m, cols, rows, shape, st, dir) {
    const sh = EB.SHAPES[shape];
    if (!sh.kicks) return { rot: st.rot, x: st.x, y: st.y };
    const to = (st.rot + (dir > 0 ? 1 : 3)) % 4;
    for (const [kx, ky] of sh.kicks['' + st.rot + to]) {
      if (fitsM(m, cols, rows, shape, to, st.x + kx, st.y + ky)) return { rot: to, x: st.x + kx, y: st.y + ky };
    }
    return null;
  }

  // Every placement reachable by: rotate (shortest way), slide, hard drop.
  function placements(m, cols, rows, shape, start) {
    const out = [];
    const seen = new Set();
    const seqs = shape === 'O' ? [[]] : [[], [1], [1, 1], [-1]];
    for (const seq of seqs) {
      let st = { rot: start.rot, x: start.x, y: start.y };
      for (const d of seq) { st = st && rotateM(m, cols, rows, shape, st, d); }
      if (!st) continue;
      for (const dir of [-1, 1]) {
        let x = st.x;
        while (true) {
          if (!fitsM(m, cols, rows, shape, st.rot, x, st.y)) break;
          let y = st.y;
          while (fitsM(m, cols, rows, shape, st.rot, x, y + 1)) y++;
          const key = st.rot + ':' + x;
          if (!seen.has(key)) { seen.add(key); out.push({ rot: st.rot, x, y }); }
          x += dir;
        }
      }
    }
    return out;
  }

  function place(m, cols, rows, shape, rot, x, y) {
    const nm = m.slice();
    let above = false;
    for (const [dx, dy] of EB.SHAPES[shape].rots[rot]) {
      const cy = y + dy;
      if (cy < 0) { above = true; continue; }
      nm[cy] |= 1 << (x + dx);
    }
    const full = (1 << cols) - 1;
    const kept = nm.filter((r) => r !== full);
    const lines = rows - kept.length;
    while (kept.length < rows) kept.unshift(0);
    return { m: kept, lines, above, landing: rows - y };
  }

  // Board quality. Higher is better.
  function evalBoard(m, cols, rows) {
    const h = new Array(cols).fill(0);
    let holes = 0, covered = 0;
    for (let c = 0; c < cols; c++) {
      let seen = false, blocksAbove = 0;
      for (let r = 0; r < rows; r++) {
        const filled = (m[r] >> c) & 1;
        if (filled) { if (!seen) { h[c] = rows - r; seen = true; } blocksAbove++; }
        else if (seen) { holes++; covered += Math.min(blocksAbove, 4); }
      }
    }
    let agg = 0, bump = 0, maxH = 0;
    for (let c = 0; c < cols; c++) { agg += h[c]; maxH = Math.max(maxH, h[c]); if (c) bump += Math.abs(h[c] - h[c - 1]); }
    // row transitions (roughness inside rows)
    let rowT = 0;
    for (let r = 0; r < rows; r++) {
      if (!m[r]) continue;
      let prev = 1;
      for (let c = 0; c < cols; c++) { const b = (m[r] >> c) & 1; if (b !== prev) rowT++; prev = b; }
      if (prev !== 1) rowT++;
    }
    // wells deeper than 2 (except one is fine for I pieces)
    let wells = 0, deepest = 0;
    for (let c = 0; c < cols; c++) {
      const l = c ? h[c - 1] : 99, r = c < cols - 1 ? h[c + 1] : 99;
      const d = Math.min(l, r) - h[c];
      if (d > 0) { wells += d * d * 0.5; deepest = Math.max(deepest, d); }
    }
    const safe = rows - C().DANGER_ROWS;
    let s = -0.51 * agg - 3.6 * holes - 0.4 * covered - 0.18 * bump - 0.32 * rowT - 0.2 * wells;
    if (deepest >= 3) s += 0.15 * wells; // one deep well is useful for 4-line clears
    const warn = Math.round(safe * 0.65); // scales with board height
    if (maxH > warn) s -= (maxH - warn) * (maxH - warn) * 1.6;
    if (maxH >= safe) s -= 500;
    return { s, maxH };
  }

  class AIController {
    constructor(fighter, level, speed) {
      this.f = fighter;
      this.L = level;
      this.speed = speed || 1;
      this.rng = new EB.RNG(fighter.rng.int(1e9) + 7);
      this.timer = 0;
      this.plan = null;
      this.pieceRef = null;
    }

    thinkTime() {
      const f = this.f;
      let t = this.L.think / this.speed;
      if (f.fogUntil > f.battle.time) t *= 1.6;
      if (f.pendingLines() > 0) t *= 0.8; // pressure sharpens focus
      return t * (0.75 + this.rng.next() * 0.5);
    }

    update(dt) {
      const f = this.f;
      if (!f.canAct()) { this.plan = null; this.pieceRef = null; f.softDrop = false; return; }
      if (f.piece !== this.pieceRef) {
        this.pieceRef = f.piece;
        if (!this.plan || !this.plan.afterHold) { this.plan = null; this.timer = this.thinkTime(); }
        else { this.plan = null; this.timer = this.L.step / this.speed; }
      }
      this.timer -= dt;
      if (this.timer > 0) return;
      const step = this.L.step / this.speed * (0.8 + this.rng.next() * 0.4);

      if (!this.plan) {
        this.plan = this.decide();
        if (this.plan.hold) {
          this.plan.afterHold = true;
          if (!f.hold()) this.plan = null;
          this.timer = step;
          return;
        }
        this.timer = step * 0.5;
        return;
      }
      const p = f.piece, plan = this.plan;
      if (p.rot !== plan.rot) {
        const d = ((plan.rot - p.rot + 4) % 4) === 3 ? -1 : 1;
        if (!f.rotate(d)) plan.rot = p.rot;
        this.timer = step;
        return;
      }
      if (p.x !== plan.x) {
        if (!f.move(plan.x > p.x ? 1 : -1)) plan.x = p.x;
        this.timer = step;
        return;
      }
      if (!plan.waited) { plan.waited = true; this.timer = this.L.dropWait / this.speed; return; }
      f.hardDrop();
    }

    // Value of clearing lines right now, given the situation.
    clearValue(lines, card, f, maxH) {
      if (!lines) return 0;
      const L = this.L;
      const atk = EB.attackFor(lines);
      let v = lines * 1.2 + atk * 1.4 * L.attackBias;
      if (f.pendingLines() > 0) v += Math.min(lines * 1.5, f.pendingLines() * 1.5) * Math.max(0.5, L.attackBias); // counter
      if (f.combo > 0) v += 0.8 * L.attackBias;
      if (card) {
        const def = EB.CARDS[card.id];
        if (def.onClear) v += 1.2 * L.attackBias;
      }
      if (maxH > 10) v += lines * 2; // survival first
      // a skilled AI saves single clears when the board is low and safe
      if (L.lookahead && lines === 1 && maxH < 7 && f.pendingLines() === 0) v -= 1.5;
      return v;
    }

    bestFor(m, card, start, f, depthCards) {
      const cols = C().COLS, rows = C().ROWS;
      const shape = EB.CARDS[card.id].shape;
      const list = [];
      for (const pl of placements(m, cols, rows, shape, start)) {
        const res = place(m, cols, rows, shape, pl.rot, pl.x, pl.y);
        if (res.above) continue;
        const ev = evalBoard(res.m, cols, rows);
        let s = ev.s + this.clearValue(res.lines, card, f, ev.maxH) - res.landing * 0.12;
        list.push({ rot: pl.rot, x: pl.x, s, m: res.m, lines: res.lines });
      }
      list.sort((a, b) => b.s - a.s);
      if (depthCards && depthCards.length && list.length) {
        const next = depthCards[0];
        const ns = EB.SHAPES[EB.CARDS[next.id].shape];
        const top = list.slice(0, 6);
        for (const c of top) {
          const inner = this.bestFor(c.m, next, { rot: 0, x: ns.spawnX, y: ns.spawnY }, f, null);
          const best = inner.length ? inner[0].s : -999;
          c.s = this.clearValue(c.lines, card, f, 0) * 0.9 + best;
        }
        top.sort((a, b) => b.s - a.s);
        return top.concat(list.slice(6));
      }
      return list;
    }

    decide() {
      const f = this.f, L = this.L;
      const m = f.board.toMasks();
      const fog = f.fogUntil > f.battle.time;
      const look = L.lookahead && !fog ? f.deck.queue.slice(0, 1) : null;
      const p = f.piece;
      let list = this.bestFor(m, p.card, { rot: p.rot, x: p.x, y: p.y }, f, look);
      for (const c of list) c.s += (this.rng.next() - 0.5) * L.noise * 4;
      list.sort((a, b) => b.s - a.s);
      let choice = list[0];
      if (list.length > 1 && this.rng.chance(L.mistake)) choice = list[1 + this.rng.int(Math.min(4, list.length - 1))];

      if (L.hold && !f.holdUsed) {
        const alt = f.deck.hold || f.deck.queue[0];
        if (alt) {
          const sh = EB.SHAPES[EB.CARDS[alt.id].shape];
          const altList = this.bestFor(m, alt, { rot: 0, x: sh.spawnX, y: Math.max(0, p.y) }, f, null);
          if (altList.length && (!choice || altList[0].s > choice.s + 1.5)) return { hold: true };
        }
      }
      if (!choice) return { rot: p.rot, x: p.x };
      return { rot: choice.rot, x: choice.x };
    }
  }

  EB.AIController = AIController;
  EB.AIUtil = { placements, place, evalBoard, fitsM };
})(globalThis.EB = globalThis.EB || {});
