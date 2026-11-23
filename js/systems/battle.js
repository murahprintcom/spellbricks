// Game Manager for one match: two Fighters, the timer, attacks in flight and win rules.
(function (EB) {
  'use strict';
  const C = () => EB.CONFIG;

  class Battle {
    constructor(o) {
      this.o = o;
      this.rng = new EB.RNG(o.seed || EB.newSeed());
      this.time = 0;
      this.started = false;
      this.state = 'countdown';
      this.countdown = C().COUNTDOWN;
      this.timeLeft = C().MATCH_TIME;
      this.sudden = false;
      this.listeners = [];
      this.projectiles = [];
      this.result = null;
      this.player = new EB.Fighter(this, Object.assign({ side: 'top', seed: this.rng.int(1e9) }, o.player));
      this.ai = new EB.Fighter(this, Object.assign({ side: 'bottom', seed: this.rng.int(1e9), isAI: true }, o.enemy));
      const lvl = EB.AI_LEVELS[EB.util.clamp(o.enemy.level || 0, 0, EB.AI_LEVELS.length - 1)];
      this.aiCtrl = new EB.AIController(this.ai, lvl, o.enemy.speed || 1);
      // optional: let the AI also drive the player (used by automated tests / attract mode)
      if (o.autoPlayer) this.playerCtrl = new EB.AIController(this.player, EB.AI_LEVELS[o.autoPlayer.level], o.autoPlayer.speed || 1);
    }

    on(fn) { this.listeners.push(fn); }
    emit(type, data) {
      for (const fn of this.listeners) fn(type, data || {});
      if (type === 'clear' && this.state === 'sudden') {
        this.end(data.side === 'top' ? 'player' : 'ai', 'Sudden death: first line clear');
      }
    }

    fighter(side) { return side === 'top' ? this.player : this.ai; }

    gravityInterval() {
      const scale = C().GRAVITY_REF_ROWS / C().ROWS;
      if (this.sudden) return C().GRAVITY_SUDDEN * scale;
      // gravity speeds up across the match (over 2 minutes when there is no time limit)
      const ramp = isFinite(C().MATCH_TIME) ? C().MATCH_TIME : 120;
      const t = EB.util.clamp(this.time / ramp, 0, 1);
      return EB.util.lerp(C().GRAVITY_START, C().GRAVITY_END, t) * scale;
    }

    sendAttack(from, lines, el) {
      const to = from === this.player ? this.ai : this.player;
      from.stats.sent += lines;
      const fromRows = from.lastClearRows.length ? from.lastClearRows : [C().ROWS - 1];
      this.projectiles.push({
        from: from.side, to: to.side, lines, el, t: 0, dur: C().PROJECTILE_TIME,
        row: fromRows[Math.floor(fromRows.length / 2)],
      });
      this.emit('attack', { side: from.side, lines, el });
    }

    update(dt) {
      if (this.state === 'over') { this.time += dt; return; }
      if (this.state === 'countdown') {
        const before = Math.ceil(this.countdown);
        this.countdown -= dt;
        const after = Math.ceil(this.countdown);
        if (after !== before && after > 0) this.emit('tick', { n: after });
        if (this.countdown <= 0) {
          this.state = 'playing';
          this.started = true;
          this.player.startBattle();
          this.ai.startBattle();
          this.emit('go', {});
        }
        return;
      }
      this.time += dt;
      this.timeLeft -= dt;
      this.player.update(dt);
      this.ai.update(dt);
      this.aiCtrl.update(dt);
      if (this.playerCtrl) this.playerCtrl.update(dt);

      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        p.t += dt;
        if (p.t >= p.dur) {
          this.projectiles.splice(i, 1);
          const target = this.fighter(p.to);
          target.receive(p.lines, p.el);
          // direct mode: garbage lands the moment the attack arrives (no queue, no counter)
          if (C().GARBAGE_MODE === 'direct') { let guard = 10; while (target.incoming.length && !target.dead && guard--) target.applyGarbage(true); }
          this.emit('hit', { side: p.to, lines: p.lines, el: p.el });
        }
      }
      if (this.state === 'over') return;
      const pd = this.player.dead, ad = this.ai.dead;
      if (pd || ad) {
        if (pd && ad) this.end('draw', 'Both stacks overflowed');
        else this.end(pd ? 'ai' : 'player', (pd ? 'Your' : 'Enemy') + ' stack reached the danger line');
        return;
      }
      if (this.timeLeft <= 0) this.timeUp();
    }

    timeUp() {
      const hp = this.player.stackHeight(), ha = this.ai.stackHeight();
      if (hp !== ha) return this.end(hp < ha ? 'player' : 'ai', `Time! Lower stack wins (${hp} vs ${ha})`);
      const rp = this.player.stats.received, ra = this.ai.stats.received;
      if (rp !== ra) return this.end(rp < ra ? 'player' : 'ai', `Time! Same height — fewer garbage received wins (${rp} vs ${ra})`);
      const lp = this.player.stats.lines, la = this.ai.stats.lines;
      if (lp !== la) return this.end(lp > la ? 'player' : 'ai', `Time! Tie — more lines cleared wins (${lp} vs ${la})`);
      if (!this.sudden) {
        this.sudden = true;
        this.state = 'sudden';
        this.timeLeft = C().SUDDEN_DEATH_TIME;
        this.emit('sudden', {});
        return;
      }
      this.end('draw', 'Sudden death ended in a perfect tie');
    }

    end(winner, reason) {
      if (this.state === 'over') return;
      this.state = 'over';
      this.result = {
        winner, reason,
        duration: this.time,
        mode: this.o.mode,
        player: Object.assign({ height: this.player.stackHeight() }, this.player.stats),
        ai: Object.assign({ height: this.ai.stackHeight() }, this.ai.stats),
      };
      this.emit('end', this.result);
    }
  }

  EB.Battle = Battle;
})(globalThis.EB = globalThis.EB || {});
