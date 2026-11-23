// Opponents. They use the same Fighter rules as the player: the deck, relics and AI
// level are the only differences. `level` is a base AI tier (0 easy, 1 normal, 2 hard);
// the run difficulty shifts it (see run.js enemyLevel).
(function (EB) {
  'use strict';
  EB.ENEMIES = {
    mud_slime: {
      name: 'Mud Slime', tier: 'normal', el: 'nature', level: 0, seed: 11,
      quote: 'Blorp. Your lines look tasty.',
      deck: ['stone_I', 'stone_I', 'stone_I', 'stone_O', 'stone_O', 'stone_T', 'stone_L', 'stone_J', 'sprout_S', 'sprout_O', 'stone_S', 'stone_Z'],
    },
    ember_imp: {
      name: 'Ember Imp', tier: 'normal', el: 'fire', level: 0, seed: 23,
      quote: 'Hehehe! Everything burns!',
      deck: ['stone_I', 'stone_I', 'stone_I', 'stone_O', 'ember_T', 'ember_Z', 'stone_L', 'stone_J', 'magma_O', 'stone_S', 'stone_T', 'cinder_L'],
    },
    tide_sprite: {
      name: 'Tide Sprite', tier: 'normal', el: 'water', level: 0, seed: 37,
      quote: 'The tide always returns.',
      deck: ['stone_I', 'stone_I', 'stone_I', 'tide_O', 'stone_O', 'drop_J', 'drop_S', 'stone_L', 'stone_T', 'mist_T', 'stone_Z', 'stone_S'],
    },
    volt_wisp: {
      name: 'Volt Wisp', tier: 'normal', el: 'lightning', level: 0, seed: 41,
      quote: 'Zzzt! Too slow!',
      deck: ['stone_I', 'stone_I', 'stone_I', 'stone_O', 'spark_T', 'spark_L', 'static_J', 'stone_L', 'stone_S', 'stone_Z', 'arc_Z', 'stone_O'],
    },
    gargoyle: {
      name: 'Stone Gargoyle', tier: 'normal', el: 'neutral', level: 0, seed: 53,
      quote: '...',
      deck: ['stone_I', 'stone_I', 'stone_I', 'stone_I', 'stone_O', 'stone_O', 'stone_T', 'stone_T', 'stone_L', 'stone_J', 'stone_S', 'stone_Z'],
    },
    magma_golem: {
      name: 'Magma Golem', tier: 'elite', el: 'fire', level: 1, seed: 61, relics: ['flame_core'],
      quote: 'I AM THE FORGE.',
      deck: ['inferno_I', 'stone_I', 'stone_I', 'magma_O', 'stone_O', 'blaze_T', 'ember_T', 'cinder_L', 'stone_L', 'flare_J', 'ember_Z', 'stone_S', 'spark_T'],
    },
    storm_harpy: {
      name: 'Storm Harpy', tier: 'elite', el: 'lightning', level: 1, seed: 71, relics: ['storm_battery'],
      quote: 'Catch me if you can!',
      deck: ['bolt_I', 'stone_I', 'stone_I', 'surge_O', 'stone_O', 'spark_T', 'bloom_T', 'spark_L', 'root_L', 'static_J', 'volt_S', 'sprout_S', 'arc_Z'],
    },
    deep_kraken: {
      name: 'Deep Kraken', tier: 'elite', el: 'water', level: 1, seed: 83, relics: ['ocean_heart'],
      quote: 'Sink beneath the waves.',
      deck: ['wave_I', 'stone_I', 'stone_I', 'tide_O', 'stone_O', 'mist_T', 'stone_T', 'undertow_L', 'stone_L', 'drop_J', 'drop_S', 'ember_Z', 'magma_O'],
    },
    prism_dragon: {
      name: 'Prism Dragon', tier: 'boss', el: 'mixed', level: 2, seed: 97, relics: ['prism_shard', 'combo_crown'],
      quote: 'Four elements. One end.',
      deck: ['inferno_I', 'bolt_I', 'stone_I', 'stone_I', 'tide_O', 'magma_O', 'blaze_T', 'bloom_T', 'root_L', 'undertow_L', 'static_J', 'volt_S', 'arc_Z', 'stone_O'],
    },

    // ----- Dungeon 1 boss -----
    grove_warden: {
      name: 'Grove Warden', tier: 'boss', el: 'nature', level: 2, seed: 149, relics: ['verdant_totem', 'combo_crown'],
      quote: 'The ruins are mine to keep.',
      deck: ['grove_I', 'worldtree_Z', 'vine_S', 'root_L', 'bloom_T', 'moss_J', 'sprout_S', 'sprout_O', 'stone_I', 'stone_I', 'tide_O', 'undertow_L', 'stone_O', 'bolt_I'],
    },
    // ----- Dungeon 2: Storm Peaks -----
    cinder_hound: {
      name: 'Cinder Hound', tier: 'normal', el: 'fire', level: 0, seed: 101,
      quote: 'Grrr... smoke and ash!',
      deck: ['stone_I', 'stone_I', 'ember_T', 'ember_Z', 'magma_O', 'cinder_L', 'blaze_T', 'stone_L', 'stone_S', 'stone_O', 'flare_J', 'stone_J'],
    },
    reef_crab: {
      name: 'Reef Crab', tier: 'normal', el: 'water', level: 0, seed: 109,
      quote: 'Click click. Your garbage is my garbage.',
      deck: ['stone_I', 'stone_I', 'drop_J', 'drop_S', 'tide_O', 'mist_T', 'wave_I', 'stone_L', 'stone_O', 'undertow_L', 'stone_Z', 'stone_T'],
    },
    thorn_sprite: {
      name: 'Thorn Sprite', tier: 'normal', el: 'nature', level: 0, seed: 113,
      quote: 'Grow, little blocks, grow!',
      deck: ['stone_I', 'sprout_S', 'sprout_O', 'bloom_T', 'root_L', 'moss_J', 'vine_S', 'stone_I', 'stone_O', 'stone_L', 'stone_T', 'stone_Z'],
    },
    spark_golem: {
      name: 'Spark Golem', tier: 'normal', el: 'lightning', level: 0, seed: 127,
      quote: 'BZZT. CALCULATING.',
      deck: ['stone_I', 'spark_T', 'spark_L', 'static_J', 'arc_Z', 'surge_O', 'volt_S', 'stone_I', 'stone_O', 'stone_L', 'stone_S', 'stone_T'],
    },
    lava_wyrm: {
      name: 'Lava Wyrm', tier: 'elite', el: 'fire', level: 1, seed: 131, relics: ['ember_heart'],
      quote: 'The mountain bleeds fire.',
      deck: ['inferno_I', 'phoenix_L', 'blaze_T', 'magma_O', 'cinder_L', 'flare_J', 'ember_T', 'ember_Z', 'stone_I', 'stone_I', 'stone_O', 'spark_T', 'bolt_I'],
    },
    tidal_titan: {
      name: 'Tidal Titan', tier: 'elite', el: 'water', level: 1, seed: 137, relics: ['tidal_bell'],
      quote: 'I am the flood.',
      deck: ['wave_I', 'tsunami_L', 'tide_O', 'mist_T', 'undertow_L', 'drop_J', 'drop_S', 'leviathan_J', 'stone_I', 'stone_I', 'stone_O', 'root_L'],
    },
    thunder_roc: {
      name: 'Thunder Roc', tier: 'boss', el: 'lightning', level: 2, seed: 139, relics: ['storm_battery', 'thunder_ring'],
      quote: 'The sky itself answers me.',
      deck: ['bolt_I', 'raijin_T', 'volt_S', 'surge_O', 'arc_Z', 'static_J', 'spark_L', 'spark_T', 'inferno_I', 'blaze_T', 'stone_I', 'stone_I', 'stone_O', 'magma_O'],
    },
    // ----- Dungeon 3: Prism Spire -----
    ash_wraith: {
      name: 'Ash Wraith', tier: 'normal', el: 'fire', level: 0, seed: 151,
      quote: 'Everything ends in ash.',
      deck: ['inferno_I', 'blaze_T', 'cinder_L', 'magma_O', 'ember_T', 'ember_Z', 'flare_J', 'stone_I', 'stone_I', 'stone_O', 'spark_L', 'arc_Z'],
    },
    mire_hydra: {
      name: 'Mire Hydra', tier: 'normal', el: 'water', level: 0, seed: 157,
      quote: 'Cut one head, two lines grow back.',
      deck: ['wave_I', 'tide_O', 'undertow_L', 'mist_T', 'root_L', 'bloom_T', 'vine_S', 'sprout_O', 'stone_I', 'stone_I', 'drop_J', 'stone_Z'],
    },
    crystal_knight: {
      name: 'Crystal Knight', tier: 'normal', el: 'mixed', level: 0, seed: 163,
      quote: 'None pass the Spire.',
      deck: ['stone_I', 'stone_I', 'stone_I', 'stone_O', 'stone_T', 'stone_L', 'stone_J', 'blaze_T', 'wave_I', 'root_L', 'volt_S', 'stone_S'],
    },
    tempest_imp: {
      name: 'Tempest Imp', tier: 'normal', el: 'lightning', level: 0, seed: 167,
      quote: 'Faster! FASTER!',
      deck: ['bolt_I', 'volt_S', 'surge_O', 'arc_Z', 'static_J', 'spark_T', 'spark_L', 'stone_I', 'stone_I', 'stone_O', 'blaze_T', 'stone_Z'],
    },
    elemental_twins: {
      name: 'Elemental Twins', tier: 'elite', el: 'mixed', level: 1, seed: 173, relics: ['storm_battery', 'prism_lens'],
      quote: 'Two minds. Four elements.',
      deck: ['inferno_I', 'bolt_I', 'tsunami_L', 'grove_I', 'blaze_T', 'volt_S', 'wave_I', 'root_L', 'magma_O', 'tide_O', 'stone_I', 'stone_I', 'arc_Z'],
    },
    void_knight: {
      name: 'Void Knight', tier: 'elite', el: 'neutral', level: 1, seed: 179, relics: ['quad_gem', 'combo_crown'],
      quote: 'Plain stone. Perfect form.',
      deck: ['stone_I', 'stone_I', 'stone_I', 'stone_I', 'inferno_I', 'grove_I', 'stone_O', 'stone_T', 'stone_L', 'stone_J', 'stone_S', 'stone_Z'],
    },

    // ----- Dungeon 4: Sunken Abyss (a '+' after a card id = upgraded card) -----
    abyss_eel: {
      name: 'Abyss Eel', tier: 'normal', el: 'water', level: 0, seed: 181,
      quote: 'Down here, the pressure crushes stacks.',
      deck: ['wave_I', 'tide_O+', 'undertow_L', 'mist_T+', 'drop_J', 'drop_S', 'stone_I', 'stone_I', 'stone_O', 'tsunami_L', 'spark_T', 'stone_Z'],
    },
    coral_golem: {
      name: 'Coral Golem', tier: 'normal', el: 'nature', level: 0, seed: 191,
      quote: 'I grow back. Always.',
      deck: ['grove_I', 'root_L+', 'bloom_T+', 'vine_S', 'moss_J', 'sprout_O', 'stone_I', 'stone_I', 'stone_O', 'tide_O', 'stone_T', 'stone_Z'],
    },
    storm_jelly: {
      name: 'Storm Jelly', tier: 'normal', el: 'lightning', level: 0, seed: 193,
      quote: 'Bzzz... bloop... BZZZ!',
      deck: ['bolt_I', 'volt_S+', 'surge_O', 'arc_Z+', 'static_J', 'spark_L', 'stone_I', 'stone_I', 'stone_O', 'wave_I', 'spark_T', 'stone_L'],
    },
    magma_crab: {
      name: 'Magma Crab', tier: 'normal', el: 'fire', level: 0, seed: 197,
      quote: 'Hot claws, hotter lines.',
      deck: ['inferno_I', 'blaze_T+', 'cinder_L+', 'magma_O', 'flare_J', 'ember_Z', 'stone_I', 'stone_I', 'stone_O', 'undertow_L', 'ember_T', 'stone_S'],
    },
    kraken_queen: {
      name: 'Kraken Queen', tier: 'elite', el: 'water', level: 1, seed: 199, relics: ['ocean_heart', 'tidal_bell'],
      quote: 'My children will drown your board.',
      deck: ['wave_I+', 'tsunami_L', 'leviathan_J', 'tide_O+', 'undertow_L+', 'mist_T', 'drop_J', 'stone_I', 'stone_I', 'stone_O', 'bolt_I', 'root_L'],
    },
    siren: {
      name: 'Storm Siren', tier: 'elite', el: 'lightning', level: 1, seed: 211, relics: ['thunder_ring', 'storm_battery'],
      quote: 'Listen to my song... and fall.',
      deck: ['bolt_I+', 'raijin_T', 'volt_S+', 'surge_O', 'arc_Z', 'static_J+', 'wave_I', 'tide_O', 'stone_I', 'stone_I', 'stone_O', 'spark_L'],
    },
    leviathan: {
      name: 'Leviathan', tier: 'boss', el: 'water', level: 2, seed: 223, relics: ['ocean_heart', 'tidal_bell', 'combo_crown'],
      quote: 'The abyss has no floor.',
      deck: ['wave_I+', 'tsunami_L+', 'leviathan_J', 'undertow_L+', 'tide_O+', 'mist_T+', 'grove_I', 'root_L+', 'bolt_I', 'volt_S', 'stone_I', 'stone_I', 'stone_O', 'blaze_T+'],
    },
    // ----- Dungeon 5: Eclipse Citadel -----
    shadow_knight: {
      name: 'Shadow Knight', tier: 'normal', el: 'mixed', level: 0, seed: 227,
      quote: 'The light ends here.',
      deck: ['inferno_I', 'bolt_I', 'stone_I+', 'stone_I+', 'blaze_T+', 'volt_S+', 'root_L+', 'undertow_L', 'stone_O', 'magma_O', 'tide_O', 'arc_Z'],
    },
    flame_sentinel: {
      name: 'Flame Sentinel', tier: 'normal', el: 'fire', level: 0, seed: 229,
      quote: 'Burn. Burn. Burn.',
      deck: ['inferno_I+', 'phoenix_L', 'blaze_T+', 'cinder_L+', 'magma_O+', 'flare_J+', 'ember_T', 'stone_I', 'stone_I', 'stone_O', 'bolt_I', 'stone_Z'],
    },
    storm_sentinel: {
      name: 'Storm Sentinel', tier: 'normal', el: 'lightning', level: 0, seed: 233,
      quote: 'Too slow. Again.',
      deck: ['bolt_I+', 'raijin_T', 'volt_S+', 'surge_O+', 'arc_Z+', 'static_J+', 'spark_L', 'stone_I', 'stone_I', 'stone_O', 'blaze_T', 'stone_S'],
    },
    verdant_sentinel: {
      name: 'Verdant Sentinel', tier: 'normal', el: 'nature', level: 0, seed: 239,
      quote: 'Roots older than stone.',
      deck: ['grove_I+', 'worldtree_Z', 'vine_S+', 'root_L+', 'bloom_T+', 'moss_J+', 'sprout_O', 'stone_I', 'stone_I', 'stone_O', 'wave_I', 'stone_T'],
    },
    eclipse_mage: {
      name: 'Eclipse Mage', tier: 'elite', el: 'mixed', level: 1, seed: 241, relics: ['prism_lens', 'storm_battery'],
      quote: 'Light and dark, fire and storm. All mine.',
      deck: ['inferno_I+', 'bolt_I+', 'tsunami_L', 'grove_I', 'phoenix_L', 'raijin_T', 'blaze_T+', 'volt_S+', 'root_L+', 'tide_O+', 'stone_I', 'stone_I', 'magma_O'],
    },
    iron_titan: {
      name: 'Iron Titan', tier: 'elite', el: 'neutral', level: 1, seed: 251, relics: ['quad_gem', 'combo_crown', 'prism_shard'],
      quote: 'I do not fall.',
      deck: ['stone_I+', 'stone_I+', 'stone_I+', 'stone_I+', 'inferno_I+', 'grove_I+', 'bolt_I+', 'stone_O+', 'stone_T+', 'stone_L+', 'stone_J+', 'stone_S+', 'stone_Z+'],
    },
    eclipse_sovereign: {
      name: 'Eclipse Sovereign', tier: 'boss', el: 'mixed', level: 2, seed: 257, relics: ['prism_shard', 'storm_battery', 'combo_crown', 'prism_lens'],
      quote: 'Every element bows to the eclipse.',
      deck: ['inferno_I+', 'bolt_I+', 'grove_I+', 'phoenix_L+', 'raijin_T+', 'worldtree_Z', 'leviathan_J', 'tsunami_L+', 'blaze_T+', 'volt_S+', 'root_L+', 'stone_I+', 'stone_I+', 'magma_O+'],
    },
  };
  // build a battle deck for an enemy: 'blaze_T+' is an upgraded Blaze Tee
  EB.enemyDeck = (e) => e.deck.map((id) => (id.endsWith('+') ? EB.makeCard(id.slice(0, -1), 2) : EB.makeCard(id)));

  EB.ENEMY_POOLS = {
    normal: ['mud_slime', 'ember_imp', 'tide_sprite', 'volt_wisp', 'gargoyle'],
    elite: ['magma_golem', 'storm_harpy', 'deep_kraken'],
    boss: ['prism_dragon'],
  };

  // AI presets. Difficulty comes from decision quality + reaction speed, never extra rules.
  EB.AI_LEVELS = [
    // Retuned: Hard = the old Normal, Normal = the old Easy, Easy = a new, gentler tier.
    { id: 'easy', name: 'Easy', think: 1.35, step: 0.22, dropWait: 0.5, noise: 3.2, mistake: 0.28, lookahead: false, hold: false, attackBias: 0.0 },
    { id: 'normal', name: 'Normal', think: 0.95, step: 0.17, dropWait: 0.35, noise: 2.2, mistake: 0.18, lookahead: false, hold: false, attackBias: 0.2 },
    { id: 'hard', name: 'Hard', think: 0.85, step: 0.14, dropWait: 0.25, noise: 1.2, mistake: 0.12, lookahead: false, hold: true, attackBias: 0.6 },
  ];
})(globalThis.EB = globalThis.EB || {});
