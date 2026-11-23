// Keyboard + touch input for the human player, with DAS/ARR auto-repeat for sideways moves.
(function (EB) {
  'use strict';

  class Input {
    constructor(fighter, hooks) {
      this.f = fighter;
      this.hooks = hooks || {};
      this.dir = 0; this.held = { left: false, right: false };
      this.dasT = 0; this.arrAcc = 0;
      this.map = {};
      const keys = EB.Save.settings.keys;
      for (const act in keys) for (const code of keys[act]) this.map[code] = act;
      this.kd = (e) => this.onKey(e, true);
      this.ku = (e) => this.onKey(e, false);
      this.blur = () => this.releaseAll();
      window.addEventListener('keydown', this.kd);
      window.addEventListener('keyup', this.ku);
      window.addEventListener('blur', this.blur);
    }

    detach() {
      window.removeEventListener('keydown', this.kd);
      window.removeEventListener('keyup', this.ku);
      window.removeEventListener('blur', this.blur);
      this.releaseAll();
    }

    onKey(e, down) {
      const act = this.map[e.code];
      if (!act) return;
      e.preventDefault();
      if (down && e.repeat) return;
      if (down) this.press(act); else this.release(act);
    }

    press(act) {
      if (this.hooks.isPaused && this.hooks.isPaused() && act !== 'pause') return;
      EB.Audio.unlock();
      const f = this.f;
      switch (act) {
        case 'left': case 'right': {
          this.held[act] = true;
          this.dir = act === 'left' ? -1 : 1;
          this.dasT = EB.Save.settings.das; this.arrAcc = 0;
          f.move(this.dir);
          break;
        }
        case 'soft': f.softDrop = true; break;
        case 'cw': f.rotate(1); break;
        case 'ccw': f.rotate(-1); break;
        case 'hard': f.hardDrop(); break;
        case 'hold': f.hold(); break;
        case 'skill': f.useSkill(); break;
        case 'pause': if (this.hooks.pause) this.hooks.pause(); break;
      }
    }

    release(act) {
      if (act === 'left' || act === 'right') {
        this.held[act] = false;
        if (this.held.left) this.dir = -1;
        else if (this.held.right) this.dir = 1;
        else this.dir = 0;
        this.dasT = EB.Save.settings.das; this.arrAcc = 0;
      }
      if (act === 'soft') this.f.softDrop = false;
    }

    releaseAll() { this.held.left = this.held.right = false; this.dir = 0; this.f.softDrop = false; }

    update(dt) {
      if (!this.dir) return;
      this.dasT -= dt;
      if (this.dasT > 0) return;
      const arr = EB.Save.settings.arr;
      if (arr <= 0) { while (this.f.move(this.dir)); return; }
      this.arrAcc += dt;
      while (this.arrAcc >= arr) { this.arrAcc -= arr; if (!this.f.move(this.dir)) { this.arrAcc = 0; break; } }
    }

    // ---------- touch controls (phones) ----------
    // Two schemes (Settings / arena menu):
    //  'tap'  (like Tetris One-Touch): tap a column = the block goes there, tap the same
    //         column again = drop, tap the block = rotate, slide sideways = slow relative move
    //         (one column per ~1.6 cells of finger travel).
    //  'drag' (classic swipe): drag sideways moves one column per step, tap = rotate,
    //         circle = rotate. (No double-tap action: fast taps are just more rotations.)
    // Both: drag down = the block follows the finger down row by row, flick down = hard drop, flick up = hold, two-finger tap =
    // rotate counter-clockwise. A gesture that starts downward is AXIS-LOCKED: it never moves
    // the block sideways, so a hard drop lands exactly where you aimed.
    bindGestures(el, o) {
      o = o || {};
      const G = { id: null, others: 0, lastRot: 0 };
      this.gest = G;
      const f = this.f;
      const mode = o.mode || 'tap';
      const stepPx = () => (o.stepPx ? o.stepPx() : 16);
      const paused = () => this.hooks.isPaused && this.hooks.isPaused();
      const moveTo = (x) => { if (!f.piece) return; let guard = 40; while (f.piece && f.piece.x < x && guard-- && f.move(1)); while (f.piece && f.piece.x > x && guard-- && f.move(-1)); };
      // piece x that centres the current shape on board column `col`
      const xForCol = (col) => {
        const cells = EB.SHAPES[f.piece.shape].rots[f.piece.rot];
        const xs = cells.map((c) => c[0]);
        return col - Math.floor((Math.min(...xs) + Math.max(...xs)) / 2);
      };

      el.onpointerdown = (e) => {
        if (e.pointerType === 'mouse' && !o.mouse) return;
        if (paused()) return;
        e.preventDefault();
        EB.Audio.unlock();
        if (G.id !== null) { if (!G.moved && performance.now() - G.t0 < 250) G.two = true; G.others++; return; }
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        Object.assign(G, {
          id: e.pointerId, x0: e.clientX, y0: e.clientY, ax: e.clientX, ay: e.clientY, lx: e.clientX, ly: e.clientY,
          t0: performance.now(), moved: false, axis: null, soft: false, piece: f.piece, turn: 0, lastAng: null,
          two: false, others: 0, moves: [], hist: [[e.clientX, e.clientY, performance.now()]],
        });
      };

      el.onpointermove = (e) => {
        if (e.pointerId !== G.id || paused()) return;
        e.preventDefault();
        if (f.piece !== G.piece) { f.softDrop = false; G.axis = 'done'; return; }
        const x = e.clientX, y = e.clientY, now = performance.now();
        const dx = x - G.x0, dy = y - G.y0;
        G.hist.push([x, y, now]);
        if (G.hist.length > 8) G.hist.shift();
        if (!G.moved && Math.hypot(dx, dy) > 20) G.moved = true; // small slips still count as a tap

        // circle = rotate (drag scheme only)
        if (mode === 'drag' && G.axis !== 'v') {
          const sx = x - G.lx, sy = y - G.ly;
          if (Math.hypot(sx, sy) >= 7) {
            const ang = Math.atan2(sy, sx);
            if (G.lastAng !== null) {
              let d = ang - G.lastAng;
              while (d > Math.PI) d -= 2 * Math.PI;
              while (d < -Math.PI) d += 2 * Math.PI;
              if (Math.abs(d) < 2.4) G.turn += d; else G.turn = 0;
            }
            G.lastAng = ang; G.lx = x; G.ly = y;
            if (Math.abs(G.turn) > 4.7) {
              for (const m of G.moves) f.move(-m.dir);
              G.moves = []; G.axis = 'circle'; f.softDrop = false;
              f.rotate(G.turn > 0 ? 1 : -1);
              G.turn = 0;
            }
          }
        }
        if (G.axis === 'circle' || G.axis === 'done') return;

        // One axis at a time, favouring vertical, so a downward pull never drifts sideways.
        // The finger may change axis mid-gesture: pull down to lower the block, then slide
        // sideways to tuck it into a gap, then pull down again.
        const step = mode === 'tap' ? (o.slidePx ? o.slidePx() : 24) : stepPx();
        const rowPx = o.rowPx ? o.rowPx() : 16;
        if (!G.axis && G.moved) G.axis = Math.abs(dy) >= Math.abs(dx) * 0.7 ? 'v' : 'h';
        if (G.axis === 'v' && Math.abs(x - G.ax) >= step * 1.2) { G.axis = 'h'; G.ay = y; }
        else if (G.axis === 'h' && y - G.ay >= rowPx * 1.5) { G.axis = 'v'; G.ax = x; }
        if (G.axis === 'h') {
          // relative and deliberately slow: one column per `step` pixels of finger travel
          while (x - G.ax >= step) { G.ax += step; G.ay = y; if (f.move(1)) G.moves.push({ t: now, dir: 1 }); }
          while (G.ax - x >= step) { G.ax -= step; G.ay = y; if (f.move(-1)) G.moves.push({ t: now, dir: -1 }); }
          if (y < G.ay) G.ay = y;
        }
        if (G.axis === 'v') {
          // controlled descent: the block goes down one row per `rowPx` of finger travel and
          // stops when the finger stops (gravity still applies)
          while (y - G.ay >= rowPx) { G.ay += rowPx; f.stepDown(); }
          if (y < G.ay) G.ay = y;
        }
      };

      const end = (e) => {
        if (e.pointerId !== G.id) { if (G.others) G.others--; return; }
        const now = performance.now();
        const dt = now - G.t0;
        const dx = e.clientX - G.x0, dy = e.clientY - G.y0;
        const h0 = G.hist[0];
        const vy = (e.clientY - h0[1]) / Math.max(1, now - h0[2]);
        f.softDrop = false;
        G.id = null;
        if (e.type !== 'pointerup' || paused() || G.axis === 'circle' || G.axis === 'done') return;
        if (G.two) { f.rotate(-1); return; }
        const flickDown = dy > 60 && vy > 0.8 && Math.abs(dx) < dy * 0.7;
        const flickUp = dy < -60 && vy < -0.7 && Math.abs(dx) < -dy * 0.7;
        if (flickDown) {
          // drop where the block was aimed: undo sideways steps made during the flick itself
          for (let i = G.moves.length - 1; i >= 0 && now - G.moves[i].t < 160; i--) f.move(-G.moves[i].dir);
          f.hardDrop();
          return;
        }
        if (flickUp) { f.hold(); return; }
        if (G.moved || dt > 350) return;
        // tapping the hero / skill meter in the info column fires the hero skill
        if (o.hitSkill && o.hitSkill(e.clientX, e.clientY)) { f.useSkill(); return; }
        if (!f.piece) return;
        // a tap
        if (mode === 'tap' && o.colAt) {
          // a quick tap right after a rotation is another rotation (the block may have kicked
          // sideways and slipped from under the finger), never a drop
          const rapidRotate = now - G.lastRot < 400;
          if (rapidRotate || (o.hitPiece && o.hitPiece(e.clientX, e.clientY))) { f.rotate(1); G.lastRot = now; return; }
          const target = xForCol(o.colAt(e.clientX));
          if (f.piece.x === target) f.hardDrop();
          else moveTo(target);
          return;
        }
        f.rotate(1);
      };
      el.onpointerup = end;
      el.onpointercancel = end;
    }

    // touch buttons: <button data-touch="left">
    bindTouch(root) {
      this.touchRoot = root;
      root.querySelectorAll('[data-touch]').forEach((btn) => {
        const act = btn.dataset.touch;
        const down = (e) => { e.preventDefault(); btn.classList.add('on'); this.press(act); };
        const up = (e) => { e.preventDefault(); btn.classList.remove('on'); this.release(act); };
        btn.onpointerdown = down;
        btn.onpointerup = up;
        btn.onpointerleave = up;
        btn.onpointercancel = up;
      });
    }
  }

  // Touch options for bindGestures on the arena layout (shared by the game and the prototype).
  // getL() returns the ArenaRenderer layout; sens is 'low' | 'medium' | 'high'.
  Input.touchOptions = (fighter, stage, getL, scheme, sens) => {
    const mul = { low: 1.3, medium: 1, high: 0.75 }[sens] || 1;
    const rect = () => stage.getBoundingClientRect();
    return {
      mode: scheme,
      stepPx: () => ({ low: 34, medium: 26, high: 18 }[sens] || 26),
      rowPx: () => Math.max(14, getL().cell) * mul,
      slidePx: () => Math.max(24, getL().cell * 1.6) * mul,
      colAt: (cx) => EB.util.clamp(Math.floor((cx - rect().left - getL().bx) / getL().cell), 0, EB.CONFIG.COLS - 1),
      hitSkill: (cx, cy) => {
        const s = getL().skillRect, r = rect();
        return !!s && cx - r.left >= s.x - 6 && cx - r.left <= s.x + s.w + 6 && cy - r.top >= s.y - 6 && cy - r.top <= s.y + s.h + 6;
      },
      // generous hit box: the block plus one cell around it, on your board
      hitPiece: (cx, cy) => {
        const p = fighter.piece; if (!p) return false;
        const L = getL(), r = rect();
        const col = (cx - r.left - L.bx) / L.cell, row = (cy - r.top - L.topY) / L.cell;
        return EB.SHAPES[p.shape].rots[p.rot].some(([dx, dy]) => Math.abs(col - (p.x + dx + 0.5)) < 1.5 && Math.abs(row - (p.y + dy + 0.5)) < 1.5);
      },
    };
  };

  EB.Input = Input;
})(globalThis.EB = globalThis.EB || {});
