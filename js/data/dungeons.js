// Dungeons: a run climbs all five in order. Each has its own 8-floor map, foes and boss.
// Difficulty knobs (on top of the run difficulty in run.js enemyFor):
//   speed  — multiplies every foe's AI speed
//   normalLevel / eliteLevel — minimum AI tier for normal foes / elites (0 easy, 1 normal, 2 hard)
//   gold   — multiplies gold from battles;  rarity — shifts card rewards toward rarer cards
(function (EB) {
  'use strict';
  EB.DUNGEONS = [
    {
      id: 'ruins', name: 'Mossy Ruins', color: '#5fd24a', icon: 'nature',
      blurb: 'Crumbling halls where the elements first stirred.',
      pools: { normal: ['mud_slime', 'ember_imp', 'tide_sprite', 'volt_wisp', 'gargoyle'], elite: ['magma_golem', 'deep_kraken', 'storm_harpy'], boss: ['grove_warden'] },
      speed: 1, normalLevel: 0, eliteLevel: 0, gold: 1, rarity: 0,
    },
    {
      id: 'peaks', name: 'Storm Peaks', color: '#ffe14a', icon: 'lightning',
      blurb: 'Lightning cracks over burning cliffs. The foes here are quicker.',
      pools: { normal: ['cinder_hound', 'reef_crab', 'thorn_sprite', 'spark_golem'], elite: ['lava_wyrm', 'tidal_titan', 'storm_harpy'], boss: ['thunder_roc'] },
      speed: 1.1, normalLevel: 1, eliteLevel: 0, gold: 1.3, rarity: 1,
    },
    {
      id: 'spire', name: 'Prism Spire', color: '#c070ff', icon: 'gem',
      blurb: 'The tower of four colours. Its guardian waits at the top.',
      pools: { normal: ['ash_wraith', 'mire_hydra', 'crystal_knight', 'tempest_imp'], elite: ['elemental_twins', 'void_knight', 'lava_wyrm'], boss: ['prism_dragon'] },
      speed: 1.2, normalLevel: 1, eliteLevel: 1, gold: 1.6, rarity: 2,
    },
    {
      id: 'abyss', name: 'Sunken Abyss', color: '#3fa2ff', icon: 'water',
      blurb: 'Below the Spire, a drowned world. Foes here use upgraded cards.',
      pools: { normal: ['abyss_eel', 'coral_golem', 'storm_jelly', 'magma_crab'], elite: ['kraken_queen', 'siren', 'tidal_titan'], boss: ['leviathan'] },
      speed: 1.3, normalLevel: 1, eliteLevel: 1, gold: 1.9, rarity: 3,
    },
    {
      id: 'citadel', name: 'Eclipse Citadel', color: '#ff5a7a', icon: 'crown',
      blurb: 'The last fortress, where every element answers to the eclipse.',
      pools: { normal: ['shadow_knight', 'flame_sentinel', 'storm_sentinel', 'verdant_sentinel'], elite: ['eclipse_mage', 'iron_titan', 'elemental_twins'], boss: ['eclipse_sovereign'] },
      speed: 1.4, normalLevel: 1, eliteLevel: 1, gold: 2.2, rarity: 4,
    },
  ];
  EB.dungeonOf = (run) => EB.DUNGEONS[Math.min(EB.DUNGEONS.length - 1, (run && run.dungeon) || 0)];
})(globalThis.EB = globalThis.EB || {});
