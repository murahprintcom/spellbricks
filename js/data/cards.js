// Every Tetris piece is a card. Card definitions are pure data + two optional hooks:
//   onLock(ctx)  — after the piece is placed (before attack is resolved)
//   onClear(ctx) — when this placement cleared at least one line
// ctx.lvl is 1 or 2 (upgraded). desc(lvl) returns the rules text.
(function (EB) {
  'use strict';

  const C = {};
  const add = (id, o) => { C[id] = Object.assign({ id, maxLvl: 2 }, o); };
  const v = (lvl, a, b) => (lvl >= 2 ? b : a);

  // ---------- Neutral (starter) ----------
  const neutralNames = { I: 'Stone Pillar', O: 'Stone Block', T: 'Stone Tee', L: 'Stone Hook', J: 'Stone Crook', S: 'Stone Step', Z: 'Stone Zag' };
  for (const s of 'IOTLJSZ') {
    add('stone_' + s, {
      name: neutralNames[s], shape: s, element: 'neutral', rarity: 'common',
      desc: (l) => (l >= 2 ? 'Polished: 4-line clears +1 attack.' : 'A plain block. No ability.'),
      onClear(ctx) { if (ctx.lvl >= 2 && ctx.lines >= 4) ctx.addAttack(1); },
    });
  }

  // ---------- Commons: element only (upgrade adds energy) ----------
  const commons = [
    ['ember_T', 'Ember Tee', 'T', 'fire'], ['ember_Z', 'Ember Zag', 'Z', 'fire'],
    ['drop_J', 'Droplet Crook', 'J', 'water'], ['drop_S', 'Droplet Step', 'S', 'water'],
    ['sprout_S', 'Sprout Step', 'S', 'nature'], ['sprout_O', 'Sprout Block', 'O', 'nature'],
    ['spark_T', 'Spark Tee', 'T', 'lightning'], ['spark_L', 'Spark Hook', 'L', 'lightning'],
  ];
  for (const [id, name, shape, el] of commons) {
    add(id, {
      name, shape, element: el, rarity: 'common',
      desc: (l) => (l >= 2 ? `Placed: +6 ${EB.ELEMENTS[el].name} energy.` : `${EB.ELEMENTS[el].name} block. Charges ${EB.ELEMENTS[el].name} energy.`),
      onLock(ctx) { if (ctx.lvl >= 2) ctx.energy(el, 6); },
    });
  }

  // ---------- Fire ----------
  add('magma_O', {
    name: 'Magma Block', shape: 'O', element: 'fire', rarity: 'uncommon',
    desc: (l) => `Placed: +${v(l, 12, 20)} Fire energy.`,
    onLock(ctx) { ctx.energy('fire', v(ctx.lvl, 12, 20)); },
  });
  add('cinder_L', {
    name: 'Cinder Hook', shape: 'L', element: 'fire', rarity: 'uncommon',
    desc: (l) => `Clear during a combo (2+): +${v(l, 1, 2)} attack.`,
    onClear(ctx) { if (ctx.combo >= 2) ctx.addAttack(v(ctx.lvl, 1, 2)); },
  });
  add('blaze_T', {
    name: 'Blaze Tee', shape: 'T', element: 'fire', rarity: 'rare',
    desc: (l) => `Clear: +${v(l, 1, 2)} attack.`,
    onClear(ctx) { ctx.addAttack(v(ctx.lvl, 1, 2)); },
  });
  add('flare_J', {
    name: 'Flare Crook', shape: 'J', element: 'fire', rarity: 'rare',
    desc: (l) => `Clear: burn ${v(l, 1, 2)} of your garbage row(s), +10 Fire energy.`,
    onClear(ctx) { ctx.removeGarbage(v(ctx.lvl, 1, 2)); ctx.energy('fire', 10); },
  });
  add('inferno_I', {
    name: 'Inferno Pillar', shape: 'I', element: 'fire', rarity: 'epic',
    desc: (l) => `Clear 3+ lines: +${v(l, 3, 4)} attack. Otherwise +1.`,
    onClear(ctx) { ctx.addAttack(ctx.lines >= 3 ? v(ctx.lvl, 3, 4) : 1); },
  });
  add('phoenix_L', {
    name: 'Phoenix Hook', shape: 'L', element: 'fire', rarity: 'legendary',
    desc: (l) => `Clear: double your line attack${l >= 2 ? ', then +1' : ''}.`,
    onClear(ctx) { ctx.addAttack(ctx.baseAttack + (ctx.lvl >= 2 ? 1 : 0)); },
  });

  // ---------- Water ----------
  add('tide_O', {
    name: 'Tide Block', shape: 'O', element: 'water', rarity: 'uncommon',
    desc: (l) => `Placed: cancel ${v(l, 1, 2)} incoming garbage.`,
    onLock(ctx) { ctx.cancel(v(ctx.lvl, 1, 2)); },
  });
  add('mist_T', {
    name: 'Mist Tee', shape: 'T', element: 'water', rarity: 'uncommon',
    desc: (l) => `Clear: gain ${v(l, 1, 2)} shield.`,
    onClear(ctx) { ctx.shield(v(ctx.lvl, 1, 2)); },
  });
  add('wave_I', {
    name: 'Wave Pillar', shape: 'I', element: 'water', rarity: 'rare',
    desc: (l) => `Clear: gain ${v(l, 2, 3)} shield.`,
    onClear(ctx) { ctx.shield(v(ctx.lvl, 2, 3)); },
  });
  add('undertow_L', {
    name: 'Undertow Hook', shape: 'L', element: 'water', rarity: 'rare',
    desc: (l) => `Clear: cancel up to ${v(l, 3, 5)} incoming garbage.`,
    onClear(ctx) { ctx.cancel(v(ctx.lvl, 3, 5)); },
  });
  add('tsunami_L', {
    name: 'Tsunami Hook', shape: 'L', element: 'water', rarity: 'epic',
    desc: (l) => `Clear: cancel up to ${v(l, 4, 6)} incoming; +1 attack per 2 cancelled.`,
    onClear(ctx) { const c = ctx.cancel(v(ctx.lvl, 4, 6)); ctx.addAttack(Math.floor(c / 2)); },
  });
  add('leviathan_J', {
    name: 'Leviathan Crook', shape: 'J', element: 'water', rarity: 'legendary',
    desc: (l) => `Clear: gain ${v(l, 3, 4)} shield and +1 attack per line cleared.`,
    onClear(ctx) { ctx.shield(v(ctx.lvl, 3, 4)); ctx.addAttack(ctx.lines); },
  });

  // ---------- Nature ----------
  add('bloom_T', {
    name: 'Bloom Tee', shape: 'T', element: 'nature', rarity: 'uncommon',
    desc: (l) => `Clear: combo +1${l >= 2 ? ', +10 Nature energy' : ''}.`,
    onClear(ctx) { ctx.comboAdd(1); if (ctx.lvl >= 2) ctx.energy('nature', 10); },
  });
  add('moss_J', {
    name: 'Moss Crook', shape: 'J', element: 'nature', rarity: 'uncommon',
    desc: (l) => `Placed: +${v(l, 12, 20)} Nature energy.`,
    onLock(ctx) { ctx.energy('nature', v(ctx.lvl, 12, 20)); },
  });
  add('root_L', {
    name: 'Root Hook', shape: 'L', element: 'nature', rarity: 'rare',
    desc: (l) => `Clear: remove ${v(l, 1, 2)} garbage row(s) from your board.`,
    onClear(ctx) { ctx.removeGarbage(v(ctx.lvl, 1, 2)); },
  });
  add('vine_S', {
    name: 'Vine Step', shape: 'S', element: 'nature', rarity: 'rare',
    desc: (l) => `Clear during a combo (3+): +${v(l, 2, 3)} attack.`,
    onClear(ctx) { if (ctx.combo >= 3) ctx.addAttack(v(ctx.lvl, 2, 3)); },
  });
  add('grove_I', {
    name: 'Grove Pillar', shape: 'I', element: 'nature', rarity: 'epic',
    desc: (l) => `Clear: remove ${v(l, 2, 3)} garbage rows and combo +1.`,
    onClear(ctx) { ctx.removeGarbage(v(ctx.lvl, 2, 3)); ctx.comboAdd(1); },
  });
  add('worldtree_Z', {
    name: 'World Tree Zag', shape: 'Z', element: 'nature', rarity: 'legendary',
    desc: (l) => `Clear: remove ${v(l, 1, 2)} garbage row(s), combo +2, combo survives one miss.`,
    onClear(ctx) { ctx.removeGarbage(v(ctx.lvl, 1, 2)); ctx.comboAdd(2); ctx.guardCombo(); },
  });

  // ---------- Lightning ----------
  add('static_J', {
    name: 'Static Crook', shape: 'J', element: 'lightning', rarity: 'uncommon',
    desc: (l) => `Rapid placement: +${v(l, 10, 16)} Lightning energy.`,
    onLock(ctx) { if (ctx.rapid) ctx.energy('lightning', v(ctx.lvl, 10, 16)); },
  });
  add('arc_Z', {
    name: 'Arc Zag', shape: 'Z', element: 'lightning', rarity: 'uncommon',
    desc: (l) => `Rapid clear: +${v(l, 1, 2)} attack.`,
    onClear(ctx) { if (ctx.rapid) ctx.addAttack(v(ctx.lvl, 1, 2)); },
  });
  add('volt_S', {
    name: 'Volt Step', shape: 'S', element: 'lightning', rarity: 'rare',
    desc: (l) => `Clear with a rapid streak of 4+: +${v(l, 2, 3)} attack.`,
    onClear(ctx) { if (ctx.rapidStreak >= 4) ctx.addAttack(v(ctx.lvl, 2, 3)); },
  });
  add('surge_O', {
    name: 'Surge Block', shape: 'O', element: 'lightning', rarity: 'rare',
    desc: (l) => `Rapid placement: store +1 attack for your next clear (max ${v(l, 2, 3)}).`,
    onLock(ctx) { if (ctx.rapid) ctx.storeBonus(1, v(ctx.lvl, 2, 3)); },
  });
  add('bolt_I', {
    name: 'Bolt Pillar', shape: 'I', element: 'lightning', rarity: 'epic',
    desc: (l) => `Rapid placement: +15 Lightning energy. Rapid clear: +${v(l, 2, 3)} attack.`,
    onLock(ctx) { if (ctx.rapid) ctx.energy('lightning', 15); },
    onClear(ctx) { if (ctx.rapid) ctx.addAttack(v(ctx.lvl, 2, 3)); },
  });
  add('raijin_T', {
    name: 'Raijin Tee', shape: 'T', element: 'lightning', rarity: 'legendary',
    desc: (l) => `Clear: +1 attack per rapid streak (max ${v(l, 4, 6)}).`,
    onClear(ctx) { ctx.addAttack(Math.min(v(ctx.lvl, 4, 6), ctx.rapidStreak)); },
  });

  EB.CARDS = C;
  EB.CARD_IDS = Object.keys(C);

  // Card instances are {uid, id, lvl}. Helpers:
  EB.cardDef = (inst) => C[inst.id];
  EB.cardDesc = (inst) => C[inst.id].desc(inst.lvl || 1);
  EB.cardName = (inst) => C[inst.id].name + ((inst.lvl || 1) >= 2 ? '+' : '');

  let uidSeq = 1;
  EB.makeCard = (id, lvl) => ({ uid: 'c' + Date.now().toString(36) + (uidSeq++), id, lvl: lvl || 1 });

  EB.STARTER_DECK = ['stone_I', 'stone_I', 'stone_I', 'stone_I', 'stone_O', 'stone_O', 'stone_T', 'stone_T', 'stone_L', 'stone_L', 'stone_S', 'stone_S'];

  // Pre-built decks for Quick Battle so each element's playstyle can be tried at once.
  EB.PRESET_DECKS = {
    starter: { name: 'Starter', el: 'neutral', cards: EB.STARTER_DECK },
    inferno: { name: 'Inferno', el: 'fire', cards: ['inferno_I', 'stone_I', 'stone_I', 'magma_O', 'stone_O', 'blaze_T', 'ember_T', 'cinder_L', 'stone_L', 'flare_J', 'ember_Z', 'stone_S'] },
    tidal: { name: 'Tidal', el: 'water', cards: ['wave_I', 'stone_I', 'stone_I', 'tide_O', 'stone_O', 'mist_T', 'stone_T', 'undertow_L', 'stone_L', 'drop_J', 'drop_S', 'stone_Z'] },
    verdant: { name: 'Verdant', el: 'nature', cards: ['grove_I', 'stone_I', 'stone_I', 'sprout_O', 'stone_O', 'bloom_T', 'stone_T', 'root_L', 'stone_L', 'moss_J', 'vine_S', 'sprout_S'] },
    tempest: { name: 'Tempest', el: 'lightning', cards: ['bolt_I', 'stone_I', 'stone_I', 'surge_O', 'stone_O', 'spark_T', 'stone_T', 'spark_L', 'stone_L', 'static_J', 'volt_S', 'arc_Z'] },
    chaos: { name: 'Elemental Chaos', el: 'mixed', cards: ['stone_I', 'bolt_I', 'wave_I', 'tide_O', 'magma_O', 'blaze_T', 'bloom_T', 'root_L', 'spark_L', 'static_J', 'sprout_S', 'arc_Z'] },
  };
})(globalThis.EB = globalThis.EB || {});
