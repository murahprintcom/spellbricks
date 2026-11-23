// Elements, their bursts and the reactions between them. Fully data-driven:
// to add an element (Ice, Shadow...) add an entry here + a tile glyph in gfx (EB.GLYPHS).
// Effects receive the same ctx API used by cards and relics (see fighter.js makeCtx).
(function (EB) {
  'use strict';

  EB.ELEMENTS = {
    neutral: {
      id: 'neutral', name: 'Neutral', role: 'Plain stone',
      color: '#a7b0c2',
      pal: null, // neutral blocks are tinted by shape (see gfx)
    },
    fire: {
      id: 'fire', name: 'Fire', role: 'Offence',
      color: '#ff6a2a',
      pal: { o: '#2b0a0a', d: '#8c1c13', '.': '#d9431e', l: '#ff8a3d', a: '#ffd35c', i: '#fff4c2' },
      blurb: 'Aggressive. Extra garbage, burns your own garbage, big multi-line bonuses.',
      burst: {
        name: 'BLAZE BURST', desc: '+2 attack',
        apply(ctx) { ctx.addAttack(2); },
      },
    },
    water: {
      id: 'water', name: 'Water', role: 'Defence',
      color: '#3fa2ff',
      pal: { o: '#071a33', d: '#12408a', '.': '#2f7de1', l: '#6fc3ff', a: '#c8f1ff', i: '#ffffff' },
      blurb: 'Survive. Cancels incoming garbage and raises shields.',
      burst: {
        name: 'TIDAL BURST', desc: 'Cancel 2 incoming, +2 shield',
        apply(ctx) { ctx.cancel(2); ctx.shield(2); },
      },
    },
    nature: {
      id: 'nature', name: 'Nature', role: 'Growth',
      color: '#5fd24a',
      pal: { o: '#08240e', d: '#1d6b2a', '.': '#3fae3a', l: '#8be05a', a: '#d8ff8a', i: '#f4ffd8' },
      blurb: 'Plan ahead. Removes garbage rows and grows your combos.',
      burst: {
        name: 'BLOOM BURST', desc: 'Remove 2 garbage rows (or +1 attack if clean)',
        apply(ctx) { if (ctx.removeGarbage(2) === 0) ctx.addAttack(1); },
      },
    },
    lightning: {
      id: 'lightning', name: 'Lightning', role: 'Speed',
      color: '#ffe14a',
      pal: { o: '#2a1640', d: '#6a2fb0', '.': '#9b5cf0', l: '#c9a2ff', a: '#ffe74a', i: '#fffbd0' },
      blurb: 'Play fast. Rewards rapid placements with bonus attack.',
      burst: {
        name: 'THUNDER BURST', desc: '+1 attack, CHARGED 6s (+1 attack on every clear)',
        apply(ctx) { ctx.addAttack(1); ctx.charge(EB.CONFIG.CHARGED_TIME); },
      },
    },
  };

  EB.ELEMENT_IDS = ['fire', 'water', 'nature', 'lightning'];

  // Reactions trigger when a line clear involves two elements (cleared blocks, the card
  // placed, or the lingering aura from your previous elemental clear).
  EB.REACTIONS = [
    {
      id: 'overload', name: 'OVERLOAD', els: ['fire', 'lightning'], color: '#ff9a2a',
      desc: '+2 attack and a shockwave.',
      apply(ctx) { ctx.addAttack(2); ctx.shake(6); },
    },
    {
      id: 'steam', name: 'STEAM', els: ['fire', 'water'], color: '#d8e6f0',
      desc: '+1 attack. Fogs the enemy: hides their next cards and ghost for 5s.',
      apply(ctx) { ctx.addAttack(1); ctx.fogOpponent(EB.CONFIG.FOG_TIME); },
    },
    {
      id: 'growth', name: 'GROWTH', els: ['water', 'nature'], color: '#5ff0b0',
      desc: 'Remove 2 garbage rows and gain 2 shield.',
      apply(ctx) { ctx.removeGarbage(2); ctx.shield(2); },
    },
    {
      id: 'storm', name: 'STORM', els: ['nature', 'lightning'], color: '#c6ff4a',
      desc: '+1 attack per combo step (max 3). Your combo survives one miss.',
      apply(ctx) { ctx.addAttack(Math.min(3, Math.max(1, ctx.combo))); ctx.guardCombo(); },
    },
    {
      id: 'wildfire', name: 'WILDFIRE', els: ['fire', 'nature'], color: '#ffb02a',
      desc: '+1 attack and burn 1 of your garbage rows.',
      apply(ctx) { ctx.addAttack(1); ctx.removeGarbage(1); },
    },
    {
      id: 'surge', name: 'SURGE', els: ['water', 'lightning'], color: '#7fe8ff',
      desc: 'Cancel up to 3 incoming, then +1 attack.',
      apply(ctx) { ctx.cancel(3); ctx.addAttack(1); },
    },
  ];

  EB.RARITIES = {
    common: { name: 'Common', color: '#b8c0cc', weight: 60, price: 45 },
    uncommon: { name: 'Uncommon', color: '#5fd24a', weight: 28, price: 70 },
    rare: { name: 'Rare', color: '#3fa2ff', weight: 12, price: 105 },
    epic: { name: 'Epic', color: '#c070ff', weight: 4, price: 150 },
    legendary: { name: 'Legendary', color: '#ffb02a', weight: 1.2, price: 220 },
  };
  EB.RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
})(globalThis.EB = globalThis.EB || {});
