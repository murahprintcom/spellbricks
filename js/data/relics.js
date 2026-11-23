// Relics: passive items for the whole run. Hooks (all optional):
//   onBattleStart(f, st)   onLock(ctx, st)   onClear(ctx, st)   onReaction(ctx, st)
//   onReceive(f, lines, st) -> lines        onTick(f, dt, st)
//   afterBattle(run, result)                 mods: { reactionCd, hpDamage, gold }
// `st` is a per-battle scratch object for that relic.
(function (EB) {
  'use strict';
  const R = {};
  const add = (id, o) => { R[id] = Object.assign({ id }, o); };

  add('flame_core', {
    name: 'Flame Core', icon: 'fire', rarity: 'rare',
    desc: 'Fire cards that clear lines deal +1 attack.',
    onClear(ctx) { if (ctx.cardEl === 'fire') ctx.addAttack(1); },
  });
  add('ocean_heart', {
    name: 'Ocean Heart', icon: 'water', rarity: 'rare',
    desc: 'The first garbage attack you receive each battle is reduced by 3.',
    onBattleStart(f, st) { st.used = false; },
    onReceive(f, lines, st) { if (!st.used) { st.used = true; f.popup('OCEAN HEART', '#3fa2ff'); return Math.max(0, lines - 3); } return lines; },
  });
  add('thunder_ring', {
    name: 'Thunder Ring', icon: 'lightning', rarity: 'rare',
    desc: 'Every 4 rapid placements in a row store +1 attack for your next clear.',
    onLock(ctx) { if (ctx.rapid && ctx.rapidStreak > 0 && ctx.rapidStreak % 4 === 0) ctx.storeBonus(1, 3); },
  });
  add('nature_seed', {
    name: 'Nature Seed', icon: 'nature', rarity: 'uncommon',
    desc: 'Heal 5 HP after every battle.',
    afterBattle(run) { run.hp = Math.min(run.maxHp, run.hp + 5); },
  });
  add('prism_shard', {
    name: 'Prism Shard', icon: 'gem', rarity: 'uncommon',
    desc: 'Start each battle with 30 energy in every element.',
    onBattleStart(f) { for (const el of EB.ELEMENT_IDS) f.energy[el] += 30; },
  });
  add('tidal_bell', {
    name: 'Tidal Bell', icon: 'water', rarity: 'uncommon',
    desc: 'Every 30 seconds of battle, gain 1 shield.',
    onBattleStart(f, st) { st.t = 0; },
    onTick(f, dt, st) { st.t += dt; if (st.t >= 30) { st.t -= 30; f.addShield(1); } },
  });
  add('verdant_totem', {
    name: 'Verdant Totem', icon: 'nature', rarity: 'rare',
    desc: 'Every 5 lines you clear removes 1 garbage row.',
    onBattleStart(f, st) { st.n = 0; },
    onClear(ctx, st) { st.n += ctx.lines; while (st.n >= 5) { st.n -= 5; ctx.removeGarbage(1); } },
  });
  add('storm_battery', {
    name: 'Storm Battery', icon: 'lightning', rarity: 'rare',
    desc: 'Elemental reactions deal +1 attack.',
    onReaction(ctx) { ctx.addAttack(1); },
  });
  add('combo_crown', {
    name: 'Combo Crown', icon: 'crown', rarity: 'rare',
    desc: 'Combo clears of 3+ deal +1 attack.',
    onClear(ctx) { if (ctx.combo >= 3) ctx.addAttack(1); },
  });
  add('quad_gem', {
    name: 'Quad Gem', icon: 'gem', rarity: 'uncommon',
    desc: '4-line clears deal +1 attack.',
    onClear(ctx) { if (ctx.lines >= 4) ctx.addAttack(1); },
  });
  add('gold_tooth', {
    name: 'Gold Tooth', icon: 'coin', rarity: 'common',
    desc: '+15 gold after every battle you win.',
    mods: { gold: 15 },
  });
  add('stone_skin', {
    name: 'Stone Skin', icon: 'shield', rarity: 'uncommon',
    desc: 'Take 40% less HP damage after battles.',
    mods: { hpDamage: 0.6 },
  });
  add('prism_lens', {
    name: 'Prism Lens', icon: 'gem', rarity: 'rare',
    desc: 'Elemental reaction cooldown is halved.',
    mods: { reactionCd: 0.5 },
  });
  add('ember_heart', {
    name: 'Ember Heart', icon: 'fire', rarity: 'uncommon',
    desc: 'Start each battle with 60 Fire energy.',
    onBattleStart(f) { f.energy.fire += 60; },
  });

  EB.RELICS = R;
  EB.RELIC_IDS = Object.keys(R);
})(globalThis.EB = globalThis.EB || {});
