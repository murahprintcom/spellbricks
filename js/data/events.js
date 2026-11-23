// Map events. Each option: { label, desc, can(run)?, run(run, api) -> result text }.
// `api` is provided by run.js (grant card, upgrade picker, etc).
(function (EB) {
  'use strict';
  EB.EVENTS = [
    {
      id: 'shrine', title: 'Elemental Shrine', icon: 'gem',
      text: 'Four braziers flicker around a cracked altar. Each one hums with a different element.',
      options: EB.ELEMENT_IDS.map((el) => ({
        label: `Pray to ${EB.ELEMENTS[el].name}`,
        desc: `Lose 6 HP. Gain a random Rare+ ${EB.ELEMENTS[el].name} card.`,
        can: (run) => run.hp > 6,
        run(run, api) {
          run.hp -= 6;
          const c = api.randomCard({ element: el, minRarity: 'rare' });
          api.addCard(c);
          return `The ${EB.ELEMENTS[el].name} brazier roars. You gain ${EB.CARDS[c].name}.`;
        },
      })).concat([{ label: 'Leave', desc: 'Walk away.', run: () => 'You leave the shrine in peace.' }]),
    },
    {
      id: 'merchant', title: 'Wandering Merchant', icon: 'coin',
      text: 'A hooded figure opens a coat lined with glowing trinkets. "Blood or gold, friend?"',
      options: [
        { label: 'Trade 10 HP', desc: 'Lose 10 HP. Gain a random relic.', can: (run) => run.hp > 10,
          run(run, api) { run.hp -= 10; const r = api.randomRelic(); if (!r) return 'He has nothing left you lack.'; api.addRelic(r); return `You gain ${EB.RELICS[r].name}.`; } },
        { label: 'Pay 60 gold', desc: 'Upgrade 2 random cards.', can: (run) => run.gold >= 60,
          run(run, api) { run.gold -= 60; const n = api.upgradeRandom(2); return n ? `${n} card(s) shimmer with new power.` : 'Nothing could be upgraded.'; } },
        { label: 'Leave', desc: 'Keep walking.', run: () => 'The merchant shrugs and vanishes into fog.' },
      ],
    },
    {
      id: 'forge', title: 'Ancient Forge', icon: 'hammer',
      text: 'An anvil still warm from a forgotten smith. The hammer fits your hand perfectly.',
      options: [
        { label: 'Upgrade a card', desc: 'Choose a card to upgrade.', run(run, api) { return api.pickUpgrade(); } },
        { label: 'Reforge', desc: 'Transform a random Stone card into an elemental card of the same shape.',
          can: (run) => run.deck.some((c) => EB.CARDS[c.id].element === 'neutral'),
          run(run, api) { return api.transformStone(); } },
      ],
    },
    {
      id: 'spring', title: 'Healing Spring', icon: 'heart',
      text: 'Crystal water bubbles from the rock. It smells of rain and moss.',
      options: [
        { label: 'Drink', desc: 'Heal 20 HP.', run(run) { run.hp = Math.min(run.maxHp, run.hp + 20); return 'You feel restored.'; } },
        { label: 'Wash a card', desc: 'Remove a card from your deck.', can: (run) => run.deck.length > EB.CONFIG.MIN_DECK,
          run(run, api) { return api.pickRemove(); } },
      ],
    },
    {
      id: 'gamble', title: "Gambler's Stone", icon: 'question',
      text: 'A rune-carved die the size of a boulder. A sign reads: ROLL IF YOU DARE.',
      options: [
        { label: 'Roll', desc: '50%: gain 80 gold. 50%: lose 10 HP.', can: (run) => run.hp > 10,
          run(run, api) { if (api.rng.chance(0.5)) { run.gold += 80; return 'Lucky! 80 gold spills out.'; } run.hp -= 10; return 'The die crushes your toe. -10 HP.'; } },
        { label: 'Leave', desc: 'Not today.', run: () => 'Wise. Probably.' },
      ],
    },
    {
      id: 'library', title: 'Sunken Library', icon: 'card',
      text: 'Waterlogged spellbooks. One page still glows with a block-shaped sigil.',
      options: [
        { label: 'Study', desc: 'Choose 1 of 3 Uncommon+ cards.', run(run, api) { return api.pickCardFrom(3, 'uncommon'); } },
        { label: 'Sell pages', desc: 'Gain 35 gold.', run(run) { run.gold += 35; return 'A collector will pay well for these.'; } },
      ],
    },
  ];
})(globalThis.EB = globalThis.EB || {});
