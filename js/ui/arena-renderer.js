// Battle renderer. It measures the real screen and gives the boards almost the whole width:
// one slim info column on the left, the board filling the rest. Player board on top (blocks
// fall toward the centre line), AI board mirrored below (blocks rise toward it).
(function (EB) {
  'use strict';
  const U = EB.util;
  const C = () => EB.CONFIG;
  const FONT = '"Press Start 2P", monospace';
  // chibi art direction: moss panels, one ink outline colour, warm text
  const COL = {
    ink: '#241826', panel: '#283830', panel2: '#31463a', edge: '#241826', edgeL: '#5a7a5f', dark: '#1a221d',
    text: '#f1ead8', dim: '#b8c4b0', you: '#6fd0e0', foe: '#ff7a6a', danger: '#ff4a4a', gold: '#ffd35c', well: '#1f2a24',
  };

  class ArenaRenderer {
    constructor(canvas, battle, opts) {
      this.cv = canvas;
      this.g = canvas.getContext('2d');
      this.b = battle;
      this.opts = opts || {};
      this.time = 0;
      this.fx = { particles: [], flashes: [], popups: [], banners: [], lock: [] };
      this.shake = { t: 0, p: 0 };
      this.bump = { top: 0, bottom: 0 };
      this.meterFlash = { top: 0, bottom: 0 };
      this.center = null;
      battle.on((t, d) => this.onEvent(t, d));
      this.resize();
    }

    // ---------- layout (CSS pixels) ----------
    resize() {
      const host = this.cv.parentElement;
      const W = host.clientWidth, H = host.clientHeight;
      const d = window.devicePixelRatio || 1;
      this.d = d;
      this.cv.width = Math.round(W * d);
      this.cv.height = Math.round(H * d);
      this.cv.style.width = W + 'px';
      this.cv.style.height = H + 'px';
      this.g.imageSmoothingEnabled = false;

      const rows = C().ROWS, cols = C().COLS;
      const { pad, meter, gap, band, colW, availW, availH } = ArenaRenderer.space(W, H);
      const cell = Math.max(4, Math.floor(Math.min(availW / cols, availH / rows)));
      const bw = cell * cols, bh = cell * rows;
      const totalW = colW + gap + meter + 2 + bw + 2 + meter;
      const x0 = Math.round((W - totalW) / 2);
      const mid = Math.round(H / 2);
      this.L = {
        W, H, cell, bw, bh, rows, cols, band, colW, meter, mid,
        colX: x0,
        bx: x0 + colW + gap + meter + 2,
        topY: mid - Math.round(band / 2) - 3 - bh,
        botY: mid + Math.round(band / 2) + 3,
      };
      this.grid = cell >= 14 ? 0.05 : 0.03;
      this.font = { s: U.clamp(Math.round(colW / 11), 6, 10), m: U.clamp(Math.round(colW / 8.5), 7, 12) };
    }

    // free space for one board on a W x H screen (shared with gridFor)
    static space(W, H) {
      const pad = 6, meter = 5, gap = 6;
      const band = U.clamp(Math.round(H * 0.055), 30, 46);
      // the info column never needs to be wider than ~a quarter of one board's height
      const colW = Math.round(Math.min(U.clamp(W * 0.17, 58, 130), Math.max(58, ((H - band) / 2) * 0.26)));
      return { pad, meter, gap, band, colW, availW: W - pad * 2 - colW - gap - meter * 2 - 4, availH: (H - band - pad * 2) / 2 - 3 };
    }

    // board for a given width in columns: square cells filling the arena width, and as
    // many rows as fit the height (about 20x24 on a phone). Columns are capped at 30 (AI bit masks).
    static gridFor(W, H, cols) {
      const { availW, availH } = ArenaRenderer.space(W, H);
      cols = Math.max(10, Math.min(30, cols));
      // keep the board at least 1.2x taller than wide (wide screens would otherwise get
      // a short board with huge blocks)
      const minRows = Math.round(cols * 1.2);
      const cell = Math.min(availW / cols, availH / minRows);
      return { cols, rows: Math.max(minRows, Math.floor(availH / cell)) };
    }

    // ---------- drawing helpers (CSS px in, device px out) ----------
    R(x, y, w, h, c) {
      const d = this.d, X = Math.round(x * d), Y = Math.round(y * d);
      this.g.fillStyle = c;
      this.g.fillRect(X, Y, Math.round((x + w) * d) - X, Math.round((y + h) * d) - Y);
    }
    // chunky panel: ink outline with clipped corners, fill, light top edge
    box(x, y, w, h, fill, edge) {
      const e = edge || COL.edge;
      this.R(x + 1.5, y, w - 3, h, e); this.R(x, y + 1.5, w, h - 3, e);
      this.R(x + 1.5, y + 1.5, w - 3, h - 3, fill || COL.panel);
      this.R(x + 2, y + 1.5, w - 4, 1, 'rgba(255,255,255,0.07)');
    }
    T(str, x, y, size, color, align, shadow) {
      const g = this.g, d = this.d;
      g.font = `${Math.round(size * d)}px ${FONT}`;
      g.textBaseline = 'top';
      g.textAlign = align || 'left';
      if (shadow !== false) { g.fillStyle = 'rgba(0,0,0,0.8)'; g.fillText(str, Math.round((x + 1) * d), Math.round((y + 1) * d)); }
      g.fillStyle = color || COL.text;
      g.fillText(str, Math.round(x * d), Math.round(y * d));
    }
    icon(name, x, y, size) { this.g.drawImage(EB.Pix.icon(name, Math.round(size * this.d)), Math.round(x * this.d), Math.round(y * this.d)); }
    boardY(side) { return side === 'top' ? this.L.topY : this.L.botY; }
    rowY(side, r) { const L = this.L; return side === 'top' ? L.topY + r * L.cell : L.botY + (L.rows - 1 - r) * L.cell; }

    // ---------- events -> effects ----------
    onEvent(t, d) {
      const s = d.side, L = this.L;
      switch (t) {
        case 'clear':
          for (const row of d.rows) {
            this.fx.flashes.push({ side: s, r: row.r, t: 0, dur: 0.28 });
            row.cells.forEach((el, c) => {
              const col = el && EB.ELEMENTS[el] && EB.ELEMENTS[el].pal ? EB.ELEMENTS[el].color : el === 'garbage' ? '#9aa0b0' : '#e8ecf4';
              const x = L.bx + c * L.cell + L.cell / 2, y = this.rowY(s, row.r) + L.cell / 2;
              for (let i = 0; i < 3; i++) this.particle(x, y, (Math.random() - 0.5) * 160, (s === 'top' ? 1 : -1) * (40 + Math.random() * 140), col, 0.6, 3);
            });
          }
          break;
        case 'lock': this.fx.lock.push({ side: s, cells: d.cells, t: 0 }); break;
        case 'hit': this.meterFlash[s] = 0.4; if (d.lines >= 3 && EB.Save.settings.shake) this.doShake(Math.min(10, d.lines * 2)); break;
        case 'garbage': this.bump[s] = Math.min(8, 2 + d.n); break;
        case 'popup': this.popup(s, d.text, d.color, d.big); break;
        case 'reaction': {
          this.fx.banners.push({ text: d.name + '!', color: d.color, t: 0, dur: 1.3, side: s });
          const y = this.boardY(s) + L.bh / 2;
          for (let i = 0; i < 50; i++) { const a = Math.random() * 6.283, v = 80 + Math.random() * 220; this.particle(L.bx + L.bw / 2, y, Math.cos(a) * v, Math.sin(a) * v, d.color, 0.8, 3); }
          if (EB.Save.settings.shake) this.doShake(8);
          break;
        }
        case 'skill': {
          const e = EB.ELEMENTS[d.el] || {};
          this.fx.banners.push({ text: d.name.toUpperCase() + '!', color: e.color || COL.gold, t: 0, dur: 1.2, side: s });
          const y = this.boardY(s) + L.bh * (s === 'top' ? 0.85 : 0.15);
          for (let i = 0; i < 46; i++) this.particle(L.bx + Math.random() * L.bw, y, (Math.random() - 0.5) * 120, (s === 'top' ? -1 : 1) * (30 + Math.random() * 160), e.color || COL.gold, 0.8, 3);
          break;
        }
        case 'skillready': this.popup(s, 'SKILL READY', COL.gold, true); break;
        case 'burst': {
          const e = EB.ELEMENTS[d.el];
          this.popup(s, d.name, e.color, true);
          const y = this.boardY(s) + L.bh / 2;
          for (let i = 0; i < 36; i++) this.particle(L.bx + Math.random() * L.bw, y + (Math.random() - 0.5) * L.bh * 0.6, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 160, e.color, 0.7, 3);
          break;
        }
        case 'shake': if (EB.Save.settings.shake) this.doShake(d.power * 1.5); break;
        case 'cancel': case 'absorb': case 'shield': {
          const y = s === 'top' ? L.topY + L.bh - 10 : L.botY + 10;
          for (let i = 0; i < 14; i++) this.particle(L.bx + L.bw + 4, y, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, '#6fc3ff', 0.5, 2);
          break;
        }
        case 'purify': {
          const y = s === 'top' ? L.topY + L.bh - 10 : L.botY + 10;
          for (let i = 0; i < 30; i++) this.particle(L.bx + Math.random() * L.bw, y, (Math.random() - 0.5) * 60, (s === 'top' ? -1 : 1) * (40 + Math.random() * 80), '#8be05a', 0.7, 3);
          break;
        }
        case 'tick': this.center = { text: String(d.n), t: 0, dur: 0.9, color: COL.text }; break;
        case 'go': this.center = { text: 'FIGHT!', t: 0, dur: 0.9, color: COL.gold }; break;
        case 'sudden': this.center = { text: 'SUDDEN DEATH', t: 0, dur: 1.6, color: COL.danger, sub: 'First line clear wins!' }; break;
      }
    }
    particle(x, y, vx, vy, color, life, size) {
      if (this.fx.particles.length < 600) this.fx.particles.push({ x, y, vx, vy, color, life, max: life, size });
    }
    popup(side, text, color, big) {
      const list = this.fx.popups.filter((p) => p.side === side);
      if (list.length > 3) list[0].t = list[0].dur;
      this.fx.popups.push({ side, text, color: color || '#fff', big, t: 0, dur: big ? 1.2 : 0.9, slot: list.length });
    }
    doShake(p) { this.shake.t = 0.25; this.shake.p = Math.max(this.shake.p, p); }

    // ---------- frame ----------
    render(dt) {
      this.time += dt;
      const g = this.g, L = this.L;
      g.setTransform(1, 0, 0, 1, 0, 0);
      // background tinted by the dungeon's colour (moss green by default), with soft pixel specks
      // dungeon colour blended into dark moss so the boards stay the brightest thing on screen
      const theme = U.mix(this.opts.theme || '#4a6b4f', '#26352d', 0.72);
      const grad = g.createLinearGradient(0, 0, 0, this.cv.height);
      grad.addColorStop(0, U.shade(theme, -0.1)); grad.addColorStop(0.5, U.shade(theme, -0.35)); grad.addColorStop(1, U.shade(theme, -0.15));
      g.fillStyle = grad;
      g.fillRect(0, 0, this.cv.width, this.cv.height);
      if (!this.specks) { const r = new EB.RNG(5); this.specks = []; for (let i = 0; i < 90; i++) this.specks.push([r.next(), r.next(), r.int(2)]); }
      for (const [sx, sy, k] of this.specks) this.R(Math.round(sx * L.W), Math.round(sy * L.H), 2, 2, k ? U.rgba(U.shade(theme, 0.25), 0.35) : 'rgba(0,0,0,0.18)');
      if (this.shake.t > 0) {
        this.shake.t -= dt;
        g.setTransform(1, 0, 0, 1, Math.round((Math.random() - 0.5) * this.shake.p * this.d), Math.round((Math.random() - 0.5) * this.shake.p * this.d));
        if (this.shake.t <= 0) this.shake.p = 0;
      }
      this.drawBand();
      for (const side of ['top', 'bottom']) {
        const f = this.b.fighter(side);
        this.drawBoard(f, dt);
        this.drawColumn(f);
      }
      this.drawProjectiles();
      this.drawFx(dt);
      g.setTransform(1, 0, 0, 1, 0, 0);
    }

    drawBand() {
      const L = this.L, b = this.b;
      const y0 = L.mid - L.band / 2;
      this.R(0, y0 - 2, L.W, L.band + 4, COL.ink);
      this.R(0, y0, L.W, L.band, 'rgba(40,56,48,0.96)');
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
      this.R(0, L.mid - 1, L.W, 2, `rgba(255,255,255,${(0.12 + 0.15 * pulse).toFixed(2)})`);
      this.R(0, y0, L.W, 1, U.rgba(COL.you, 0.5));
      this.R(0, y0 + L.band - 1, L.W, 1, U.rgba(COL.foe, 0.5));
      // with no time limit the clock counts the time played instead
      const endless = !isFinite(C().MATCH_TIME) && !b.sudden;
      const tl = endless ? b.time : b.state === 'countdown' ? C().MATCH_TIME : b.timeLeft;
      const low = !endless && tl <= 10 && b.state !== 'over';
      const fs = Math.round(L.band * 0.5);
      const tw = fs * 5 + 16;
      const cx = L.bx + L.bw / 2;
      this.box(cx - tw / 2, y0 + 3, tw, L.band - 6, COL.dark, b.sudden ? COL.danger : COL.ink);
      this.T(U.fmtTime(tl), cx, L.mid - fs / 2, fs, low && Math.floor(this.time * 4) % 2 ? COL.danger : b.sudden ? '#ff9a3c' : COL.text, 'center');
      // the pause button sits in the left part of this band (placed by the game controller);
      // the right part shows the match label and the player's run info (floor, HP)
      // left-aligned just after the timer box, using the free width up to the screen edge
      const lf = this.font.s * 0.85, lx = cx + tw / 2 + 8;
      const maxChars = Math.floor((L.W - 6 - lx) / lf);
      const lines = [this.opts.label, this.opts.playerSub].filter(Boolean);
      if (maxChars >= 5) lines.forEach((t2, i) => this.T(String(t2).toUpperCase().slice(0, maxChars), lx, L.mid - (lines.length * (lf + 4)) / 2 + i * (lf + 4), lf, i ? COL.text : COL.dim, 'left', false));
    }

    drawBoard(f, dt) {
      const L = this.L, side = f.side, top = this.boardY(side), g = this.g, d = this.d;
      const cs = L.cell, rows = L.rows;
      const height = f.stackHeight();
      const warnAt = C().DANGER_WARN_HEIGHT;
      const danger = height >= warnAt && !f.dead;
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 8);
      const acc = side === 'top' ? COL.you : COL.foe;
      // frame
      this.R(L.bx - 4, top - 4, L.bw + 8, L.bh + 8, COL.ink);
      this.R(L.bx - 2, top - 2, L.bw + 4, L.bh + 4, danger ? U.rgba(COL.danger, 0.45 + 0.5 * pulse) : U.rgba(acc, 0.55));
      this.R(L.bx, top, L.bw, L.bh, COL.well);
      const gl = `rgba(255,255,255,${this.grid})`;
      for (let c = 1; c < L.cols; c++) this.R(L.bx + c * cs, top, 1 / d, L.bh, gl);
      for (let r = 1; r < rows; r++) this.R(L.bx, top + r * cs, L.bw, 1 / d, gl);
      // danger zone at the outer edge
      const dz = C().DANGER_ROWS * cs;
      this.R(L.bx, side === 'top' ? top : top + L.bh - dz, L.bw, dz, U.rgba(COL.danger, danger ? 0.12 + 0.12 * pulse : 0.07));
      const dly = side === 'top' ? top + dz : top + L.bh - dz;
      for (let x = 0; x < L.bw; x += 10) this.R(L.bx + x, dly - 1, 5, 2, U.rgba(COL.danger, danger ? 0.6 + 0.4 * pulse : 0.55));
      // the strip inside the danger zone: card name or reaction hint (left), aura timer (right)
      this.drawAuraStrip(f, side === 'top' ? top : top + L.bh - dz, dz);

      this.bump[side] = Math.max(0, this.bump[side] - dt * 40);
      const bump = this.bump[side] * (side === 'top' ? -1 : 1);
      const csD = Math.round(cs * d), bxD = Math.round(L.bx * d), topD = Math.round(top * d);
      const yOf = (r) => topD + (side === 'top' ? r : rows - 1 - r) * csD + Math.round(bump * d);
      g.save();
      g.beginPath(); g.rect(bxD, topD, csD * L.cols, csD * rows); g.clip();
      for (let r = 0; r < rows; r++) {
        const row = f.board.grid[r];
        for (let c = 0; c < L.cols; c++) {
          const cell = row[c];
          if (cell) g.drawImage(EB.Pix.tile(EB.tileKind(cell.el, cell.shape), csD), bxD + c * csD, yOf(r));
        }
      }
      const p = f.piece;
      if (p && !f.dead) {
        const cells = EB.SHAPES[p.shape].rots[p.rot];
        if (EB.Save.settings.ghost && f.fogUntil <= this.b.time && this.b.state !== 'over') {
          const gy = f.ghostY();
          const rx = EB.Elemental.pending(f, p.card);
          const col = rx ? rx.color : p.el === 'neutral' ? '#c9d0dc' : EB.ELEMENTS[p.el].color;
          g.fillStyle = U.rgba(col, 0.16); g.strokeStyle = U.rgba(col, 0.65);
          g.lineWidth = Math.max(1, Math.round(d * 1.5));
          for (const [dx, dy] of cells) {
            const r = gy + dy; if (r < 0) continue;
            const x = bxD + (p.x + dx) * csD, y = yOf(r);
            g.fillRect(x + 2, y + 2, csD - 4, csD - 4);
            g.strokeRect(x + 2 + g.lineWidth / 2, y + 2 + g.lineWidth / 2, csD - 4 - g.lineWidth, csD - 4 - g.lineWidth);
          }
        }
        const t = EB.Pix.tile(EB.tileKind(p.el, p.shape), csD);
        const grounded = !f.fits(0, 1);
        for (const [dx, dy] of cells) {
          const r = p.y + dy; if (r < 0) continue;
          g.drawImage(t, bxD + (p.x + dx) * csD, yOf(r));
          if (grounded) { g.fillStyle = `rgba(255,255,255,${(0.08 + 0.18 * Math.min(1, f.lockTimer / C().LOCK_DELAY)).toFixed(2)})`; g.fillRect(bxD + (p.x + dx) * csD, yOf(r), csD, csD); }
        }
      }
      for (let i = this.fx.lock.length - 1; i >= 0; i--) {
        const lf = this.fx.lock[i];
        if (lf.side !== side) continue;
        lf.t += dt;
        if (lf.t > 0.12) { this.fx.lock.splice(i, 1); continue; }
        g.fillStyle = `rgba(255,255,255,${(0.5 * (1 - lf.t / 0.12)).toFixed(2)})`;
        for (const [x, r] of lf.cells) if (r >= 0) g.fillRect(bxD + x * csD, yOf(r), csD, csD);
      }
      for (const fl of this.fx.flashes) {
        if (fl.side !== side) continue;
        const a = 1 - fl.t / fl.dur;
        const shrink = Math.round(csD * 0.5 * (1 - a));
        g.fillStyle = `rgba(255,255,255,${(0.85 * a).toFixed(2)})`;
        g.fillRect(bxD, yOf(fl.r) - Math.round(bump * d) + shrink, csD * L.cols, Math.max(1, csD - shrink * 2));
      }
      g.restore();

      if (f.dead) {
        this.R(L.bx, top, L.bw, L.bh, 'rgba(10,10,20,0.7)');
        this.T('TOPPED OUT', L.bx + L.bw / 2, top + L.bh / 2 - 8, this.font.m * 1.4, COL.danger, 'center');
      }
      if (this.b.state === 'countdown') {
        const s = this.font.m;
        if (side === 'top') { this.T('YOUR BOARD', L.bx + L.bw / 2, top + L.bh * 0.3, s, COL.you, 'center'); this.T('blocks fall down', L.bx + L.bw / 2, top + L.bh * 0.3 + s * 2, s * 0.8, COL.dim, 'center'); }
        else { this.T('ENEMY BOARD', L.bx + L.bw / 2, top + L.bh * 0.65, s, COL.foe, 'center'); this.T('blocks rise up', L.bx + L.bw / 2, top + L.bh * 0.65 - s * 1.8, s * 0.8, COL.dim, 'center'); }
      }

      // garbage meter (right of board) fills from the centre side
      const mx = L.bx + L.bw + 3, mw = L.meter;
      this.R(mx, top, mw, L.bh, COL.dark);
      let used = 0;
      this.meterFlash[side] = Math.max(0, this.meterFlash[side] - dt);
      for (const gb of f.incoming) {
        const h = Math.min(gb.lines, rows - used) * cs;
        if (h <= 0) break;
        const ready = gb.readyAt <= this.b.time;
        const col = ready ? (Math.floor(this.time * 6) % 2 ? '#ff3355' : '#ff7a5a') : '#ffb02a';
        const y = side === 'top' ? top + L.bh - used * cs - h : top + used * cs;
        this.R(mx, y, mw, h, col);
        this.R(mx, side === 'top' ? y : y + h - 1, mw, 1, COL.dark);
        used += gb.lines;
      }
      if (this.meterFlash[side] > 0) this.R(mx - 1, top, mw + 2, L.bh, `rgba(255,255,255,${this.meterFlash[side].toFixed(2)})`);
      // shield (left of board)
      const sx = L.bx - 3 - mw;
      this.R(sx, top, mw, L.bh, COL.dark);
      for (let i = 0; i < f.shield; i++) {
        const y = side === 'top' ? top + L.bh - (i + 1) * cs : top + i * cs;
        this.R(sx, y + 2, mw, cs - 4, '#6fc3ff');
      }
    }

    drawAuraStrip(f, y, h) {
      const L = this.L, t = this.b.time, fs = this.font.s;
      const ty = y + (h - fs) / 2;
      const aura = f.aura && f.aura.until > t ? f.aura : null;
      let rightW = 0;
      if (aura) {
        // [icon][shrinking bar] seconds
        const e = EB.ELEMENTS[aura.el];
        const left = aura.until - t, frac = left / (aura.dur || EB.Elemental.auraTime());
        const isz = Math.min(h - 4, fs * 2.2);
        const barW = Math.min(70, L.bw * 0.22);
        const x1 = L.bx + L.bw - 4 - barW;
        const blink = left < 2 && Math.floor(this.time * 6) % 2;
        this.R(x1, y + h / 2 - 3, barW, 6, COL.dark);
        if (!blink) this.R(x1, y + h / 2 - 3, barW * frac, 6, e.color);
        this.icon(aura.el, x1 - isz - 4, y + (h - isz) / 2, isz);
        this.T('AURA', x1 - isz - 6, ty, fs * 0.85, e.color, 'right', false);
        rightW = barW + isz + fs * 4 + 16;
      }
      const cool = f.reactionReadyAt > t;
      // reaction hint: the current block, or one in HOLD / NEXT, would react with the aura
      const now = f.piece && EB.Elemental.pending(f, f.piece.card);
      let text = null, color = 'rgba(232,236,244,0.35)';
      if (now) { text = 'CLEAR = ' + now.name + '!'; color = Math.floor(this.time * 4) % 2 ? now.color : '#ffffff'; }
      else if (cool) { text = 'NEXT REACTION IN ' + Math.ceil(f.reactionReadyAt - t) + 's'; color = '#8a93b8'; }
      else if (aura) {
        const cands = [['HOLD', f.deck.hold]].concat(f.deck.queue.slice(0, 2).map((c, i) => ['NEXT' + (i ? ' ' + (i + 1) : ''), c]));
        for (const [where, c] of cands) {
          const r = c && EB.Elemental.reactionFor(aura.el, EB.CARDS[c.id].element);
          if (r) { text = where + ' = ' + r.name; color = r.color; break; }
        }
      }
      if (!text && f.piece) text = EB.cardName(f.piece.card).toUpperCase();
      if (text) {
        const maxChars = Math.floor((L.bw - rightW - 8) / fs);
        this.T(text.slice(0, Math.max(4, maxChars)), L.bx + 4, ty, fs, color, 'left', !!now);
      }
    }

    // slim info column: outer edge -> centre for the player, mirrored for the AI
    drawColumn(f) {
      const L = this.L, side = f.side, top = this.boardY(side);
      const x = L.colX, w = L.colW, fs = this.font.s, fm = this.font.m;
      const acc = side === 'top' ? COL.you : COL.foe;
      const t = this.b.time;
      const blocks = [];
      // each block: [height, draw(y)]
      // chibi sprite (idle bob) with the name beside it
      const ps = Math.max(1, Math.round(fm * 2.8 / 22 * this.d));
      const sh = 22 * ps / this.d, sw = 18 * ps / this.d;
      blocks.push([sh + 2, (y) => {
        const bob = Math.floor(this.time * 2 + (side === 'top' ? 0 : 0.5)) % 2 === 1;
        this.g.drawImage(EB.Pix.portrait(f.portrait || 'hero', ps, bob), Math.round(x * this.d), Math.round((y + 1) * this.d));
        const nf = Math.max(6, fm - 2), room = Math.max(3, Math.floor((w - sw - 3) / nf));
        this.T(f.name.toUpperCase().slice(0, room), x + sw + 3, y + sh / 2 - fm / 2 + 1, nf, acc, 'left', false);
      }]);
      // hero skill meter: one pip per line; tap it (or press Q) when it glows
      if (f.hero) {
        const sk = f.hero.skill, ready = f.skillReady();
        const kh = fs * 2 + 12;
        blocks.push([kh, (y) => {
          const glow = ready && Math.floor(this.time * 5) % 2 === 0;
          this.box(x, y, w, kh, ready ? (glow ? f.hero.color : COL.panel2) : COL.panel, ready ? COL.gold : COL.edge);
          this.T(sk.name.toUpperCase(), x + 4, y + 4, fs * 0.9, ready ? (glow ? COL.ink : COL.gold) : COL.dim, 'left', false);
          if (ready) this.T(this.b.player === f && !('ontouchstart' in window) ? 'Q' : 'TAP', x + w - 4, y + 4, fs * 0.9, glow ? COL.ink : COL.gold, 'right', false);
          const n = sk.charge, gap = 1.5, pw = (w - 8 - gap * (n - 1)) / n;
          for (let i = 0; i < n; i++) this.R(x + 4 + i * (pw + gap), y + fs + 8, pw, fs * 0.8, i < f.skillCharge ? f.hero.color : COL.dark);
          if (side === 'top') this.L.skillRect = { x, y: y - sh - 7, w, h: kh + sh + 7 };
        }]);
      }
      const hb = Math.round(w * 0.5);
      blocks.push([hb, (y) => {
        this.box(x, y, w, hb, COL.panel, COL.edge);
        this.T('HOLD', x + 4, y + 4, fs, COL.dim, 'left', false);
        if (f.deck.hold) this.mini(f.deck.hold, x + w / 2, y + hb / 2 + fs / 2, Math.min(w / 5.5, (hb - fs) / 3), f.holdUsed ? 0.35 : 1);
      }]);
      const nb = Math.round(w * 0.42);
      const fogged = f.fogUntil > t;
      blocks.push([fs + 4 + nb * 3 + 4, (y) => {
        this.T('NEXT', x + 2, y, fs, COL.dim, 'left', false);
        for (let i = 0; i < 3; i++) {
          const yy = y + fs + 4 + i * (nb + 2);
          const c = f.deck.queue[i];
          const def = c && EB.CARDS[c.id];
          this.box(x, yy, w, nb, COL.panel, def ? EB.RARITIES[def.rarity].color : COL.edge);
          if (fogged) { this.R(x + 4, yy + 4, w - 8, nb - 8, 'rgba(216,230,240,0.85)'); continue; }
          if (c) {
            this.mini(c, x + w * 0.42, yy + nb / 2, Math.min(w / 6.5, nb / 3.2), i === 0 ? 1 : 0.8);
            if (def.element !== 'neutral') this.icon(def.element, x + w - fs * 1.4 - 3, yy + 3, fs * 1.4);
          }
        }
      }]);
      const mins = Math.max(t, 1) / 60;
      const stats = [['HEIGHT', f.stackHeight()], ['SENT', f.stats.sent], ['COMBO', f.combo], ['PPM', Math.round(f.stats.pieces / mins)], ['LINES', f.stats.lines]];
      const lh = fs + 5;
      blocks.push([stats.length * lh + 6, (y) => {
        stats.forEach(([k, v], i) => {
          const yy = y + 3 + i * lh;
          this.T(k, x + 2, yy, fs * 0.85, COL.dim, 'left', false);
          const hot = (k === 'COMBO' && v >= 2) || (k === 'HEIGHT' && v >= C().DANGER_WARN_HEIGHT);
          this.T(String(v), x + w - 2, yy, fs, hot ? (k === 'HEIGHT' ? COL.danger : COL.gold) : COL.text, 'right', false);
        });
      }]);
      const eh = Math.max(6, Math.round(fs * 0.9));
      blocks.push([EB.ELEMENT_IDS.length * (eh + 3) + 2, (y) => {
        EB.ELEMENT_IDS.forEach((el, i) => {
          const yy = y + i * (eh + 3);
          const v = f.energy[el] / C().ENERGY_MAX;
          this.icon(el, x, yy - 1, eh + 2);
          this.R(x + eh + 5, yy + 1, w - eh - 6, eh - 2, COL.dark);
          this.R(x + eh + 5, yy + 1, Math.round((w - eh - 6) * v), eh - 2, EB.ELEMENTS[el].color);
        });
      }]);
      // status line (aura, shield, charged...)
      blocks.push([fs + 6, (y) => {
        let xx = x;
        if (f.aura && f.aura.until > t) { this.icon(f.aura.el, xx, y, fs + 2); xx += fs + 5; }
        const tags = [];
        if (f.chargedUntil > t) tags.push(['CHG', '#ffe14a']);
        if (f.comboGuard) tags.push(['GRD', '#c6ff4a']);
        if (f.hastedUntil > t) tags.push(['HST' + Math.ceil(f.hastedUntil - t), '#ffe14a']);
        if (f.storedBonus) tags.push(['+' + f.storedBonus, COL.gold]);
        if (f.pendingLines()) tags.push(['!' + f.pendingLines(), COL.danger]);
        for (const [s, c] of tags) { this.T(s, xx, y + 1, fs * 0.85, c, 'left', false); xx += s.length * fs * 0.85 + 4; }
      }]);

      // stack the blocks from the outer edge; drop the last ones if the board is short
      const gapY = 5;
      let need = 0, n = 0;
      for (const [h] of blocks) { if (need + h > L.bh) break; need += h + gapY; n++; }
      const order = blocks.slice(0, n);
      let y = side === 'top' ? top : top + L.bh;
      for (const [h, draw] of order) {
        if (side === 'top') { draw(y); y += h + gapY; } else { y -= h; draw(y); y -= gapY; }
      }
    }

    mini(card, cx, cy, cell, alpha) {
      const def = EB.CARDS[card.id];
      const cells = EB.SHAPES[def.shape].rots[0];
      const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
      const minX = Math.min(...xs), minY = Math.min(...ys);
      const cD = Math.max(2, Math.round(cell * this.d));
      const w = (Math.max(...xs) - minX + 1) * cD, h = (Math.max(...ys) - minY + 1) * cD;
      const t = EB.Pix.tile(EB.tileKind(def.element, def.shape), cD);
      this.g.globalAlpha = alpha == null ? 1 : alpha;
      const ox = Math.round(cx * this.d - w / 2), oy = Math.round(cy * this.d - h / 2);
      for (const [x, y] of cells) this.g.drawImage(t, ox + (x - minX) * cD, oy + (y - minY) * cD);
      this.g.globalAlpha = 1;
    }

    drawProjectiles() {
      const L = this.L;
      for (const p of this.b.projectiles) {
        const u = Math.min(1, p.t / p.dur);
        const fromTop = p.from === 'top';
        const x0 = L.bx + L.bw / 2, y0 = this.rowY(p.from, p.row) + L.cell / 2;
        const x1 = L.bx + L.bw + 5, y1 = fromTop ? L.botY + 8 : L.topY + L.bh - 8;
        const cx = L.bx + L.bw * (fromTop ? 0.75 : 0.25), cy = L.mid;
        const a = (1 - u) * (1 - u), m = 2 * (1 - u) * u, n = u * u;
        const x = a * x0 + m * cx + n * x1, y = a * y0 + m * cy + n * y1;
        const col = p.el && EB.ELEMENTS[p.el] && EB.ELEMENTS[p.el].pal ? EB.ELEMENTS[p.el].color : '#ffffff';
        const s = 6 + Math.min(10, p.lines * 2);
        this.R(x - s / 2 - 2, y - s / 2 - 2, s + 4, s + 4, U.rgba(col, 0.35));
        this.R(x - s / 2, y - s / 2, s, s, col);
        this.R(x - 2, y - 2, 4, 4, '#fff');
        for (let i = 0; i < 2; i++) this.particle(x, y, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50, col, 0.3, 2);
        this.T(String(p.lines), x + s, y - this.font.s / 2, this.font.m, '#fff');
      }
    }

    drawFx(dt) {
      const L = this.L, P = this.fx.particles;
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i];
        p.life -= dt;
        if (p.life <= 0) { P.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.95; p.vy *= 0.95;
        this.g.globalAlpha = Math.min(1, (p.life / p.max) * 1.5);
        this.R(Math.round(p.x), Math.round(p.y), p.size, p.size, p.color);
      }
      this.g.globalAlpha = 1;
      const F = this.fx.flashes;
      for (let i = F.length - 1; i >= 0; i--) { F[i].t += dt; if (F[i].t >= F[i].dur) F.splice(i, 1); }
      // popups float toward the centre line
      const pops = this.fx.popups;
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i];
        p.t += dt;
        if (p.t >= p.dur) { pops.splice(i, 1); continue; }
        const u = p.t / p.dur, dir = p.side === 'top' ? 1 : -1;
        const base = p.side === 'top' ? L.topY + L.bh * 0.4 : L.botY + L.bh * 0.6;
        const size = (p.big ? 1.6 : 1.15) * this.font.m * (u < 0.1 ? 1 + (0.1 - u) * 4 : 1);
        this.g.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
        this.T(p.text, L.bx + L.bw / 2, base + dir * (u * 24 + p.slot * size * 1.6) - size / 2, size, p.color, 'center');
        this.g.globalAlpha = 1;
      }
      const B = this.fx.banners;
      for (let i = B.length - 1; i >= 0; i--) {
        const b = B[i];
        b.t += dt;
        if (b.t >= b.dur) { B.splice(i, 1); continue; }
        const u = b.t / b.dur;
        const size = this.font.m * 2;
        const y = b.side === 'top' ? L.mid - L.band / 2 - size * 2.2 : L.mid + L.band / 2 + size * 0.8;
        const slide = u < 0.15 ? (1 - u / 0.15) * L.W * 0.3 * (b.side === 'top' ? -1 : 1) : 0;
        this.g.globalAlpha = u > 0.75 ? (1 - u) / 0.25 : 1;
        this.R(0, y - 6, L.W, size + 12, 'rgba(0,0,0,0.6)');
        this.R(0, y - 6, L.W, 2, b.color); this.R(0, y + size + 4, L.W, 2, b.color);
        this.T(b.text, L.bx + L.bw / 2 + slide, y, size, b.color, 'center');
        this.g.globalAlpha = 1;
      }
      const c = this.center;
      if (c) {
        c.t += dt;
        if (c.t >= c.dur) this.center = null;
        else {
          const u = c.t / c.dur;
          const size = Math.min(L.bw / Math.max(3, c.text.length) * 0.9, L.band * 0.9) * (u < 0.15 ? 1 + (0.15 - u) * 2 : 1);
          this.g.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
          this.R(0, L.mid - size, L.W, size * 2, 'rgba(5,6,12,0.8)');
          this.T(c.text, L.bx + L.bw / 2, L.mid - size / 2 - (c.sub ? size * 0.3 : 0), size, c.color, 'center');
          if (c.sub) this.T(c.sub, L.bx + L.bw / 2, L.mid + size * 0.45, this.font.s, COL.text, 'center');
          this.g.globalAlpha = 1;
        }
      }
    }
  }

  EB.ArenaRenderer = ArenaRenderer;
})(globalThis.EB = globalThis.EB || {});
