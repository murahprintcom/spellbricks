// One side of the battle: board + deck + active piece + attack/garbage/combo/elements.
// The player and the AI use this exact class, so the AI follows the same rules.
(function (EB) {
  'use strict';
  const C = () => EB.CONFIG;

  class Fighter {
    constructor(battle, o) {
      this.battle = battle;
      this.side = o.side;               // 'top' (player) or 'bottom' (AI)
      this.name = o.name;
      this.isAI = !!o.isAI;
      this.portrait = o.portrait || null;
      this.rng = new EB.RNG(o.seed);
      this.board = new EB.Board(C().COLS, C().ROWS);
      this.deck = new EB.BattleDeck(o.cards, this.rng, C().PREVIEW);
      // a hero brings a passive (a hidden relic) and an active skill charged by clearing lines
      this.hero = o.hero && EB.HEROES && EB.HEROES[o.hero] ? EB.HEROES[o.hero] : null;
      this.relics = (o.relics || []).concat(this.hero ? ['hero:' + this.hero.id] : []).filter((id) => EB.RELICS[id]);
      this.skillCharge = 0;
      this.relicState = {};
      for (const id of this.relics) this.relicState[id] = {};

      this.piece = null;
      this.holdUsed = false;
      this.softDrop = false;
      this.gravAcc = 0; this.lockTimer = 0; this.lockResets = 0; this.lowestY = 0;
      this.spawnTime = 0;

      this.incoming = [];      // [{lines, hole, readyAt}]
      this.lastHole = -1;
      this.shield = 0;
      this.combo = 0; this.comboGuard = false; this.lastQuad = false;
      this.rapidStreak = 0;
      this.storedBonus = 0;
      this.energy = EB.Elemental.emptyEnergy();
      this.aura = null;
      this.reactionReadyAt = 0;
      this.fogUntil = 0;
      this.chargedUntil = 0;
      this.dead = false; this.deathReason = '';
      this.lastClearRows = [];

      this.stats = {
        pieces: 0, lines: 0, sent: 0, attack: 0, received: 0, cancelled: 0, absorbed: 0,
        maxCombo: 0, actions: 0, reactions: 0, bursts: 0, quads: 0, clears: [0, 0, 0, 0, 0],
      };
      if (o.energy) for (const el in o.energy) EB.Elemental.add(this, el, o.energy[el]);
    }

    get opp() { return this.side === 'top' ? this.battle.ai : this.battle.player; }
    emit(type, data) { this.battle.emit(type, Object.assign({ side: this.side }, data || {})); }
    popup(text, color, big) { this.emit('popup', { text, color, big }); }

    startBattle() {
      for (const id of this.relics) {
        const r = EB.RELICS[id];
        if (r.onBattleStart) r.onBattleStart(this, this.relicState[id]);
      }
      for (const el of EB.ELEMENT_IDS) this.energy[el] = Math.min(this.energy[el], C().ENERGY_MAX - 1);
      this.spawn();
    }

    // ---------------- pieces ----------------
    setPiece(card) {
      const def = EB.CARDS[card.id];
      const sh = EB.SHAPES[def.shape];
      this.piece = { card, shape: def.shape, el: def.element, rot: 0, x: sh.spawnX, y: sh.spawnY };
      this.gravAcc = 0; this.lockTimer = 0; this.lockResets = 0; this.lowestY = this.piece.y;
      if (!this.board.fits(this.piece.shape, 0, this.piece.x, this.piece.y)) {
        // try one row higher (into the hidden buffer) before topping out
        if (this.board.fits(this.piece.shape, 0, this.piece.x, this.piece.y - 1)) this.piece.y -= 1;
        else { this.die('blocked'); return false; }
      }
      return true;
    }

    spawn() {
      if (this.dead) return;
      const card = this.deck.next();
      if (!card) { this.die('empty deck'); return; }
      this.holdUsed = false;
      this.spawnTime = this.battle.time;
      if (this.setPiece(card)) this.emit('spawn', {});
    }

    fits(dx, dy, rot) {
      const p = this.piece;
      return this.board.fits(p.shape, rot === undefined ? p.rot : rot, p.x + dx, p.y + dy);
    }

    onGround() { return this.piece && !this.fits(0, 1); }

    touchLock() {
      if (this.onGround() && this.lockResets < C().LOCK_RESETS) { this.lockTimer = 0; this.lockResets++; }
    }

    move(dx) {
      if (!this.canAct()) return false;
      if (!this.fits(dx, 0)) return false;
      this.piece.x += dx;
      this.stats.actions++;
      this.touchLock();
      this.emit('move', {});
      return true;
    }

    rotate(dir) {
      if (!this.canAct()) return false;
      const p = this.piece;
      const sh = EB.SHAPES[p.shape];
      const to = (p.rot + (dir > 0 ? 1 : 3)) % 4;
      if (!sh.kicks) { this.stats.actions++; this.emit('rotate', {}); return true; } // O
      const kicks = sh.kicks['' + p.rot + to];
      for (const [kx, ky] of kicks) {
        if (this.board.fits(p.shape, to, p.x + kx, p.y + ky)) {
          p.x += kx; p.y += ky; p.rot = to;
          if (p.y > this.lowestY) { this.lowestY = p.y; this.lockResets = 0; }
          this.stats.actions++;
          this.touchLock();
          this.emit('rotate', {});
          return true;
        }
      }
      return false;
    }

    // one controlled row down (touch soft drop); keeps the normal lock delay so the block
    // can still be slid into a gap after it lands
    stepDown() {
      if (!this.canAct() || !this.fits(0, 1)) return false;
      this.piece.y++;
      this.gravAcc = 0;
      if (this.piece.y > this.lowestY) { this.lowestY = this.piece.y; this.lockResets = 0; }
      this.emit('softdrop', {});
      return true;
    }

    ghostY() {
      const p = this.piece;
      let y = p.y;
      while (this.board.fits(p.shape, p.rot, p.x, y + 1)) y++;
      return y;
    }

    hardDrop() {
      if (!this.canAct()) return false;
      const y = this.ghostY();
      const dist = y - this.piece.y;
      this.piece.y = y;
      this.stats.actions++;
      this.emit('harddrop', { dist });
      this.lock();
      return true;
    }

    hold() {
      if (!this.canAct() || this.holdUsed) return false;
      this.deck.active = this.piece.card;
      const card = this.deck.swapHold();
      this.holdUsed = true;
      this.stats.actions++;
      this.emit('hold', {});
      if (card) this.setPiece(card);
      return true;
    }

    skillReady() { return !!this.hero && this.skillCharge >= this.hero.skill.charge; }

    useSkill() {
      if (!this.skillReady() || this.dead || !this.battle.started || this.battle.state === 'over') return false;
      this.skillCharge = 0;
      this.hero.skill.use(this);
      this.emit('skill', { name: this.hero.skill.name, el: this.hero.element });
      // the board may have changed under the falling block
      if (this.piece) while (!this.fits(0, 0) && this.piece.y > -2) this.piece.y--;
      return true;
    }

    canAct() { return !this.dead && this.piece && this.battle.state !== 'over' && this.battle.started; }

    // ---------------- per-frame ----------------
    update(dt) {
      for (const id of this.relics) {
        const r = EB.RELICS[id];
        if (r.onTick) r.onTick(this, dt, this.relicState[id]);
      }
      if (this.dead || !this.piece) return;
      let g = this.battle.gravityInterval();
      if (this.hastedUntil > this.battle.time) g /= 2; // hit by Raiden's Haste
      const interval = this.softDrop ? Math.min(g, C().SOFT_DROP_INTERVAL) : g;
      if (this.fits(0, 1)) {
        this.lockTimer = 0;
        this.gravAcc += dt;
        while (this.gravAcc >= interval) {
          this.gravAcc -= interval;
          if (this.fits(0, 1)) {
            this.piece.y++;
            if (this.softDrop) this.emit('softdrop', {});
            if (this.piece.y > this.lowestY) { this.lowestY = this.piece.y; this.lockResets = 0; }
          } else { this.gravAcc = 0; break; }
        }
      } else {
        this.gravAcc = 0;
        this.lockTimer += dt;
        if (this.lockTimer >= C().LOCK_DELAY || (this.softDrop && this.lockTimer >= C().LOCK_DELAY * 0.5)) this.lock();
      }
    }

    // ---------------- context for card / relic / element effects ----------------
    makeCtx(card, extra) {
      const f = this;
      const def = EB.CARDS[card.id];
      const ctx = Object.assign({
        f, opp: f.opp, card, def, cardEl: def.element, lvl: card.lvl || 1,
        lines: 0, rapid: false, rapidStreak: f.rapidStreak, combo: f.combo, baseAttack: 0, attack: 0,
        addAttack(n) { if (n > 0) ctx.attack += n; },
        cancel(n) { return f.cancelIncoming(n); },
        shield(n) { f.addShield(n); },
        removeGarbage(n) { const r = f.board.removeGarbageRows(n); if (r) { f.emit('purify', { n: r }); f.popup('-' + r + ' GARBAGE', '#8be05a'); } return r; },
        energy(el, n) { EB.Elemental.add(f, el, n); },
        comboAdd(n) { f.combo += n; ctx.combo = f.combo; },
        guardCombo() { f.comboGuard = true; },
        fogOpponent(s) { const o = f.opp; if (o) f.battle.affect(o, 'fog', s); },
        charge(s) { f.chargedUntil = f.battle.time + s; f.popup('CHARGED', '#ffe14a'); },
        shake(p) { f.battle.emit('shake', { side: f.opp ? f.opp.side : f.side, power: p }); },
        storeBonus(n, max) { f.storedBonus = Math.min(max, f.storedBonus + n); },
      }, extra || {});
      return ctx;
    }

    relicHook(name, ctx) {
      for (const id of this.relics) {
        const r = EB.RELICS[id];
        if (r[name]) r[name](ctx, this.relicState[id]);
      }
    }

    // ---------------- lock & resolve ----------------
    lock() {
      if (!this.piece || this.dead) return;
      const p = this.piece;
      const card = p.card;
      const def = EB.CARDS[card.id];
      const t = this.battle.time;
      const placedCells = EB.SHAPES[p.shape].rots[p.rot].map(([dx, dy]) => [p.x + dx, p.y + dy]);
      const ok = this.board.lock(p.shape, p.rot, p.x, p.y, { el: def.element });
      this.deck.active = card;
      this.deck.spend();
      this.piece = null;
      this.stats.pieces++;
      const rapid = t - this.spawnTime <= C().RAPID_TIME;
      this.rapidStreak = rapid ? this.rapidStreak + 1 : 0;
      this.emit('lock', { cells: placedCells, el: def.element, shape: p.shape });
      if (!ok) { this.die('overflow'); return; }

      const rows = this.board.fullRows();
      const n = rows.length;
      let cleared = [];
      if (n) {
        this.lastClearRows = rows.slice();
        // remember the cells for fx before removal
        const fxRows = rows.map((r) => ({ r, cells: this.board.grid[r].map((c) => (c ? c.el : null)) }));
        cleared = this.board.clearRows(rows);
        this.emit('clear', { rows: fxRows, n });
      }

      const ctx = this.makeCtx(card, { lines: n, rapid, rapidStreak: this.rapidStreak });
      if (def.element !== 'neutral') EB.Elemental.add(this, def.element, C().ENERGY_PER_PLACE);
      if (def.onLock) def.onLock(ctx);
      this.relicHook('onLock', ctx);

      let total = 0;
      if (n > 0) {
        this.combo++;
        if (this.hero) {
          const before = this.skillCharge, max = this.hero.skill.charge;
          this.skillCharge = Math.min(max, this.skillCharge + n);
          if (before < max && this.skillCharge >= max) this.emit('skillready', {});
        }
        ctx.combo = this.combo;
        const base = EB.attackFor(n);
        ctx.baseAttack = base;
        this.stats.lines += n;
        this.stats.clears[Math.min(4, n)]++;
        // element energy from cleared blocks
        // reactions come from sequencing: this card's element + the aura of your previous elemental clear
        const els = new Set();
        if (def.element !== 'neutral') els.add(def.element);
        const counts = {};
        for (const c of cleared) if (c && c.el in this.energy) counts[c.el] = (counts[c.el] || 0) + 1;
        for (const el in counts) EB.Elemental.add(this, el, counts[el] * C().ENERGY_PER_CELL);

        if (def.onClear) def.onClear(ctx);
        this.relicHook('onClear', ctx);
        EB.Elemental.reaction(this, ctx, els);

        let extra = 0;
        const combo = this.combo;
        const cb = C().COMBO_BONUS[Math.min(combo, C().COMBO_BONUS.length - 1)];
        extra += cb;
        if (n >= 4) {
          this.stats.quads++;
          if (this.lastQuad) { extra += C().B2B_BONUS; this.popup('BACK-TO-BACK', '#ffd35c'); }
          this.lastQuad = true;
        } else this.lastQuad = false;
        if (this.board.isEmpty()) { extra += C().ALL_CLEAR_BONUS; this.popup('ALL CLEAR!', '#ffffff', true); }
        if (this.chargedUntil > t) extra += 1;
        if (this.storedBonus) { extra += this.storedBonus; this.storedBonus = 0; }
        total = base + extra;

        const names = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD!'];
        this.popup(names[Math.min(4, n)], n >= 4 ? '#ffe14a' : '#ffffff', n >= 4);
        if (combo >= 2) { this.popup('COMBO x' + combo, combo >= 4 ? '#ff6a2a' : '#ffd35c', combo >= 4); this.emit('combo', { combo }); }
        this.stats.maxCombo = Math.max(this.stats.maxCombo, combo);
      } else {
        if (this.comboGuard && this.combo > 0) { this.comboGuard = false; this.popup('COMBO KEPT', '#c6ff4a'); }
        else this.combo = 0;
      }

      EB.Elemental.bursts(this, ctx);
      total += ctx.attack;
      if (total > 0) {
        this.stats.attack += total;
        const cancelled = C().GARBAGE_MODE === 'direct' ? 0 : this.cancelIncoming(total);
        const rem = total - cancelled;
        if (rem > 0) this.battle.sendAttack(this, rem, def.element);
      }

      if (n === 0) this.applyGarbage();
      if (this.board.inDanger(C().DANGER_ROWS)) { this.die('danger'); return; }
      this.spawn();
    }

    // ---------------- garbage ----------------
    pendingLines() { let s = 0; for (const g of this.incoming) s += g.lines; return s; }
    readyLines() { const t = this.battle.time; let s = 0; for (const g of this.incoming) if (g.readyAt <= t) s += g.lines; return s; }

    receive(lines, el) {
      for (const id of this.relics) {
        const r = EB.RELICS[id];
        if (r.onReceive) lines = r.onReceive(this, lines, this.relicState[id]);
      }
      if (this.shield > 0 && lines > 0) {
        const a = Math.min(this.shield, lines);
        this.shield -= a; lines -= a;
        this.stats.absorbed += a;
        this.emit('absorb', { n: a });
        this.popup('BLOCKED ' + a, '#6fc3ff');
      }
      if (lines <= 0) return;
      let hole = this.rng.int(C().COLS);
      if (hole === this.lastHole) hole = (hole + 1 + this.rng.int(C().COLS - 1)) % C().COLS;
      this.lastHole = hole;
      this.incoming.push({ lines, hole, readyAt: this.battle.time + C().GARBAGE_DELAY, el });
      this.emit('incoming', { lines });
    }

    cancelIncoming(n) {
      let c = 0;
      while (n > 0 && this.incoming.length) {
        const g = this.incoming[0];
        const k = Math.min(n, g.lines);
        g.lines -= k; n -= k; c += k;
        if (g.lines <= 0) this.incoming.shift();
      }
      if (c) { this.stats.cancelled += c; this.emit('cancel', { n: c }); this.popup('COUNTER ' + c, '#6fc3ff'); }
      return c;
    }

    addShield(n) {
      this.shield = Math.min(8, this.shield + n);
      this.emit('shield', { n });
    }

    applyGarbage(force) {
      const t = this.battle.time;
      let cap = C().GARBAGE_CAP_PER_LOCK;
      const holes = [];
      while (cap > 0 && this.incoming.length && (force || this.incoming[0].readyAt <= t)) {
        const g = this.incoming[0];
        const k = Math.min(cap, g.lines);
        for (let i = 0; i < k; i++) {
          if (i > 0 && this.rng.chance(C().GARBAGE_MESSINESS)) g.hole = (g.hole + 1 + this.rng.int(C().COLS - 1)) % C().COLS;
          holes.push(g.hole);
        }
        g.lines -= k; cap -= k;
        if (g.lines <= 0) this.incoming.shift();
      }
      if (!holes.length) return;
      const overflow = this.board.addGarbage(holes);
      this.stats.received += holes.length;
      this.emit('garbage', { n: holes.length });
      if (this.piece) {
        // keep the active piece clear of the risen stack
        while (!this.fits(0, 0) && this.piece.y > -2) this.piece.y--;
      }
      if (overflow || this.board.inDanger(C().DANGER_ROWS)) this.die('danger');
    }

    die(reason) {
      if (this.dead) return;
      this.dead = true;
      this.deathReason = reason;
      this.piece = null;
      this.emit('topout', { reason });
    }

    stackHeight() { return this.board.stackHeight(); }
  }

  // base garbage for a clear of n lines
  EB.attackFor = (n) => (C().GARBAGE_MODE === 'direct' ? n : C().ATTACK_TABLE[Math.min(4, n)]);

  EB.Fighter = Fighter;
})(globalThis.EB = globalThis.EB || {});
