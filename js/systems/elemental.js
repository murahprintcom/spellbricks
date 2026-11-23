// Elemental System: energy, bursts, auras and reactions. Works for any element listed in
// EB.ELEMENT_IDS, so new elements only need data.
(function (EB) {
  'use strict';
  const CFG = () => EB.CONFIG;

  EB.Elemental = {
    // aura lasts longer on wide boards (a line takes more blocks): 6s at 10 columns, 12s at 20+
    auraTime() { return CFG().AURA_TIME * Math.min(2, Math.max(1, CFG().COLS / 10)); },

    // the reaction two elements make together, or null
    reactionFor(a, b) {
      if (!a || !b || a === b) return null;
      return EB.REACTIONS.find((r) => r.els.includes(a) && r.els.includes(b)) || null;
    },

    // what clearing with this card would trigger right now (aura active and cooldown over)
    pending(f, card) {
      if (!card || !f.aura || f.aura.until <= f.battle.time || f.reactionReadyAt > f.battle.time) return null;
      return EB.Elemental.reactionFor(f.aura.el, EB.CARDS[card.id].element);
    },

    emptyEnergy() {
      const e = {};
      for (const el of EB.ELEMENT_IDS) e[el] = 0;
      return e;
    },

    add(f, el, n) {
      if (!el || !(el in f.energy) || n <= 0) return;
      if (f.hero && f.hero.noElements) return;
      f.energy[el] = Math.min(CFG().ENERGY_MAX, f.energy[el] + n);
    },

    // Fire every full meter. Called during lock resolution with the same ctx.
    bursts(f, ctx) {
      for (const el of EB.ELEMENT_IDS) {
        if (f.energy[el] >= CFG().ENERGY_MAX) {
          f.energy[el] = 0;
          const b = EB.ELEMENTS[el].burst;
          b.apply(ctx);
          f.stats.bursts++;
          f.battle.emit('burst', { side: f.side, el, name: b.name });
        }
      }
    },

    // els: elements of this clear (the card placed). The aura of the previous elemental clear is added.
    reaction(f, ctx, els) {
      if (f.hero && f.hero.noElements) return null;
      const t = f.battle.time;
      if (f.aura && f.aura.until > t) els.add(f.aura.el);
      let fired = null;
      if (t >= f.reactionReadyAt) {
        for (const r of EB.REACTIONS) {
          if (els.has(r.els[0]) && els.has(r.els[1])) { fired = r; break; }
        }
      }
      if (fired) {
        fired.apply(ctx);
        for (const id of f.relics) {
          const rel = EB.RELICS[id];
          if (rel && rel.onReaction) rel.onReaction(ctx, f.relicState[id]);
        }
        let cd = CFG().REACTION_COOLDOWN;
        for (const id of f.relics) { const m = EB.RELICS[id] && EB.RELICS[id].mods; if (m && m.reactionCd) cd *= m.reactionCd; }
        f.reactionReadyAt = t + cd;
        f.aura = null;
        f.stats.reactions++;
        f.battle.emit('reaction', { side: f.side, id: fired.id, name: fired.name, color: fired.color });
      } else if (ctx.cardEl !== 'neutral') {
        const dur = EB.Elemental.auraTime();
        f.aura = { el: ctx.cardEl, until: t + dur, dur };
      }
      return fired;
    },
  };
})(globalThis.EB = globalThis.EB || {});
