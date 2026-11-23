// Balance + tuning values. Change numbers here, not inside the systems.
(function (EB) {
  'use strict';
  EB.CONFIG = {
    COLS: 10,
    ROWS: 20,
    DANGER_ROWS: 2,            // rows at the outer edge; a locked block here = loss
    DANGER_WARN_HEIGHT: 14,    // stack height that starts the danger warning

    MATCH_TIME: 120,           // seconds
    SUDDEN_DEATH_TIME: 30,
    COUNTDOWN: 3,

    // gravity: seconds per row, eases from START to END across the match (same for both sides)
    GRAVITY_START: 1.0,
    GRAVITY_END: 0.45,
    GRAVITY_SUDDEN: 0.3,
    GRAVITY_REF_ROWS: 20,      // gravity is scaled so a piece takes the same time to cross any board height
    SOFT_DROP_INTERVAL: 0.03,
    LOCK_DELAY: 0.5,
    LOCK_RESETS: 15,

    // human input feel (can be changed in Settings)
    DAS: 0.14,
    ARR: 0.035,

    // attack
    ATTACK_TABLE: [0, 0, 1, 2, 4],          // lines cleared -> garbage sent (classic mode)
    // 'classic': table above, garbage waits in a queue and can be countered by clearing.
    // 'direct':  every cleared line sends 1 garbage row that lands as soon as it arrives.
    GARBAGE_MODE: 'classic',
    COMBO_BONUS: [0, 0, 1, 1, 2, 2, 3, 3, 4], // by combo count (1 = first clear of a chain)
    B2B_BONUS: 1,                            // back-to-back 4-line clears
    ALL_CLEAR_BONUS: 4,
    GARBAGE_DELAY: 0.8,        // grace after an attack lands before it can enter the board
    GARBAGE_CAP_PER_LOCK: 8,
    GARBAGE_MESSINESS: 0.25,   // chance a garbage row moves its hole
    PROJECTILE_TIME: 0.55,

    // speed
    RAPID_TIME: 1.2,           // a piece locked within this many seconds of appearing is "rapid"

    // elements
    ENERGY_MAX: 140,
    ENERGY_PER_CELL: 1,          // per cleared block of that element
    ENERGY_PER_PLACE: 2,       // per elemental card placed
    AURA_TIME: 6,
    REACTION_COOLDOWN: 12,
    FOG_TIME: 5,
    CHARGED_TIME: 6,

    PREVIEW: 3,
    MIN_DECK: 8,

    // run
    RUN_HP: 60,
    BOSS_SPEED: 0.5,           // bosses act at half speed (half the pieces and attack per minute)
    LOSS_DAMAGE: { normal: 18, elite: 24, boss: 30 },
    WIN_DAMAGE_DIV: 3,         // after a win you lose ceil(garbageReceived / this) HP
    GOLD_REWARD: { normal: [16, 26], elite: [38, 48], boss: [80, 100] },
  };
})(globalThis.EB = globalThis.EB || {});
