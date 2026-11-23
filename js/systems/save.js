// Save / Load System (localStorage). Stores settings, profile (unlocks + statistics) and
// the current run. Every access is guarded: the game still works when storage is blocked.
(function (EB) {
  'use strict';
  const KEY = 'elementalBlocks.v1';

  const DEFAULT_KEYS = {
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], soft: ['ArrowDown', 'KeyS'],
    cw: ['ArrowUp', 'KeyX'], ccw: ['KeyZ'], hard: ['Space'], hold: ['ShiftLeft', 'ShiftRight', 'KeyC'], skill: ['KeyQ'], pause: ['Escape', 'KeyP'],
  };

  // Battle defaults chosen in the arena prototype: Drag controls, Medium sensitivity,
  // 15 blocks per row, no time limit; Quick Battle: Normal AI, Elemental deck vs Volt Wisp.
  // (Keyboard keys always work too; Drag only affects touch.)
  // v4: Direct garbage (every cleared line sends 1 row straight to the opponent).
  const SETTINGS_VERSION = 4;
  const ARENA_DEFAULTS = () => ({
    controls: 'drag', sens: 'medium', cols: 15, matchTime: 0, garbageMode: 'direct',
    quickLevel: 1, quickDeck: 'chaos', quickFoe: 'volt_wisp',
    settingsVersion: SETTINGS_VERSION,
  });

  const defaults = () => ({
    settings: Object.assign({ music: 0.5, sfx: 0.7, shake: true, ghost: true, das: 0.14, arr: 0.035, keys: JSON.parse(JSON.stringify(DEFAULT_KEYS)) }, ARENA_DEFAULTS()),
    profile: {
      cards: {}, relics: {}, enemies: {},
      stats: { runsStarted: 0, runsWon: 0, dungeonsCleared: 0, battlesWon: 0, battlesLost: 0, lines: 0, sent: 0, pieces: 0, bestCombo: 0, bestPPM: 0, reactions: 0, quads: 0, playTime: 0 },
      tutorialSeen: false,
      maxDungeonCleared: 0,   // most bosses beaten in a single run (unlocks heroes)
      heroesAnnounced: [],    // heroes whose unlock was already shown
    },
    run: null,
  });

  const Save = {
    data: defaults(),
    DEFAULT_KEYS,
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const d = JSON.parse(raw);
          const base = defaults();
          Save.data = {
            settings: Object.assign(base.settings, d.settings || {}),
            profile: Object.assign(base.profile, d.profile || {}),
            run: d.run || null,
          };
          Save.data.profile.stats = Object.assign(defaults().profile.stats, (d.profile || {}).stats || {});
          for (const k in DEFAULT_KEYS) if (!Save.data.settings.keys[k]) Save.data.settings.keys[k] = DEFAULT_KEYS[k].slice();
          // saves from before the arena layout: move them onto the new battle defaults once
          const ver = (d.settings || {}).settingsVersion || 1;
          if (ver < 3) {
            Object.assign(Save.data.settings, ARENA_DEFAULTS());
            delete Save.data.settings.touch;
            Save.data.settings.touchHelpV2 = false;
          } else if (ver < 4) {
            // keep the player's own choices; only switch the garbage rule to Direct
            Save.data.settings.garbageMode = 'direct';
            Save.data.settings.settingsVersion = SETTINGS_VERSION;
          }
        }
      } catch (e) { Save.data = defaults(); }
      // older profiles: a won run cleared every dungeon; any dungeon clear means the first boss fell
      const pr = Save.data.profile;
      if (pr.maxDungeonCleared == null) pr.maxDungeonCleared = 0;
      if ((pr.stats.runsWon || 0) > 0) pr.maxDungeonCleared = Math.max(pr.maxDungeonCleared, (EB.DUNGEONS || []).length || 5);
      else if ((pr.stats.dungeonsCleared || 0) > 0) pr.maxDungeonCleared = Math.max(pr.maxDungeonCleared, 1);
      if (!Array.isArray(pr.heroesAnnounced)) pr.heroesAnnounced = (EB.unlockedHeroes ? EB.unlockedHeroes(pr) : []);
      // starter cards are always known
      for (const id of EB.CARD_IDS) if (EB.CARDS[id].element === 'neutral') Save.data.profile.cards[id] = true;
      return Save.data;
    },
    write() {
      try { localStorage.setItem(KEY, JSON.stringify(Save.data)); } catch (e) { /* storage blocked: keep playing */ }
    },
    get settings() { return Save.data.settings; },
    get profile() { return Save.data.profile; },
    get run() { return Save.data.run; },
    setRun(run) { Save.data.run = run; Save.write(); },
    discoverCard(id) { if (id && !Save.data.profile.cards[id]) { Save.data.profile.cards[id] = true; Save.write(); } },
    discoverRelic(id) { if (id && !Save.data.profile.relics[id]) { Save.data.profile.relics[id] = true; Save.write(); } },
    recordBattle(result) {
      const s = Save.data.profile.stats, p = result.player;
      if (result.winner === 'player') s.battlesWon++; else s.battlesLost++;
      s.lines += p.lines; s.sent += p.sent; s.pieces += p.pieces; s.reactions += p.reactions; s.quads += p.quads;
      s.bestCombo = Math.max(s.bestCombo, p.maxCombo);
      if (result.duration > 30) s.bestPPM = Math.max(s.bestPPM, Math.round(p.pieces / (result.duration / 60)));
      s.playTime += result.duration;
      Save.write();
    },
    resetAll() { Save.data = defaults(); Save.write(); Save.load(); },
  };

  EB.Save = Save;
})(globalThis.EB = globalThis.EB || {});
