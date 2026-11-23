// Heroes: chosen before a run. Each has a starting deck, a passive (same hooks as a relic:
// onBattleStart / onLock / onClear / onReceive / onTick / onReaction) and an active skill
// charged by clearing lines. Passives are registered as hidden relics 'hero:<id>' so the
// fighter runs them with the relic hooks; they never appear in relic pools or collections.
(function (EB) {
  'use strict';
  const INK = '#241826';

  EB.HEROES = {
    ignis: {
      id: 'ignis', name: 'Ignis', title: 'The Pyromancer', element: 'fire', color: '#ff8a5a',
      quote: 'Every line I clear comes back as fire.',
      deck: ['stone_I', 'stone_I', 'stone_I', 'stone_I', 'stone_O', 'magma_O', 'ember_T', 'blaze_T', 'cinder_L', 'stone_L', 'ember_Z', 'stone_S'],
      passive: {
        name: 'Ember Heart', desc: 'Clears in a combo of 3 or more send +1 garbage.',
        onClear(ctx) { if (ctx.combo >= 3) ctx.addAttack(1); },
      },
      skill: {
        name: 'Meteor', charge: 8,
        desc: 'Burn away the 2 lowest rows of your board, then send 2 garbage to the foe.',
        use(f) {
          const n = f.board.removeBottomRows(2);
          f.emit('purify', { n });
          f.battle.emit('shake', { side: f.opp.side, power: 6 });
          f.battle.sendAttack(f, 2, 'fire');
        },
      },
      sprite: { arch: 'human', head: 'hair',
        pal: { x: '#e5733a', X: '#b8502a', l: '#ff9a5a', a: '#ffd35c', e: INK, m: INK, k: '#5a3a2a', h: '#d94a3a', H: '#a3302a', s: '#f2c9a0', S: '#d99a78' },
        prop: [[14, 10, '#ffd35c'], [13, 11, '#ff8a3d'], [14, 11, '#fff4c2'], [15, 11, '#ff8a3d'], [13, 12, '#e5533a'], [14, 12, '#ffd35c'], [15, 12, '#e5533a'], [14, 13, '#e5533a']] },
    },
    marisa: {
      id: 'marisa', name: 'Marisa', title: 'The Tidecaller', element: 'water', color: '#6fb0ff',
      quote: 'Send all the garbage you like. The tide carries it away.',
      deck: ['stone_I', 'stone_I', 'wave_I', 'tide_O', 'stone_O', 'mist_T', 'stone_T', 'stone_L', 'drop_J', 'drop_S', 'stone_S', 'stone_Z'],
      passive: {
        name: 'Calm Current', desc: 'Start every battle with 2 shield (blocks the first 2 garbage rows).',
        onBattleStart(f) { f.addShield(2); },
      },
      skill: {
        name: 'Tsunami', charge: 10,
        desc: 'Gain 4 shield and send 1 garbage to the foe.',
        use(f) {
          f.addShield(4);
          f.popup('TSUNAMI', '#6fc3ff', true);
          f.battle.sendAttack(f, 1, 'water');
        },
      },
      sprite: { arch: 'human', head: 'longband',
        pal: { x: '#eef0f8', X: '#c3c8e0', l: '#ffffff', a: '#4a7fd9', e: INK, m: INK, k: '#3a4a6a', h: '#4a7fd9', H: '#355fae', w: '#f4f4f4', s: '#f2c9a0', S: '#d99a78' },
        prop: [[14, 6, '#8a5a3a'], [14, 7, '#8a5a3a'], [14, 8, '#8a5a3a'], [14, 9, '#8a5a3a'], [14, 10, '#8a5a3a'], [14, 11, '#8a5a3a'], [14, 12, '#8a5a3a'], [14, 13, '#8a5a3a'], [14, 14, '#8a5a3a'], [14, 15, '#8a5a3a'], [14, 16, '#8a5a3a'], [13, 4, '#6fc3ff'], [14, 4, '#c8f1ff'], [15, 4, '#6fc3ff'], [14, 3, '#6fc3ff'], [14, 5, '#3f7fd0']] },
    },
    raiden: {
      id: 'raiden', name: 'Raiden', title: 'The Stormblade', element: 'lightning', color: '#ffe14a',
      unlock: { dungeons: 1, text: 'Defeat the boss of Dungeon 1 (Grove Warden).' },
      quote: 'Think fast. Place faster.',
      deck: ['stone_I', 'stone_I', 'bolt_I', 'stone_O', 'surge_O', 'spark_T', 'stone_T', 'spark_L', 'stone_L', 'static_J', 'arc_Z', 'stone_S'],
      passive: {
        name: 'Live Current', desc: 'Rapid placements give +4 Lightning energy. Every 5 rapid placements in a row send +1 garbage.',
        onLock(ctx) {
          if (!ctx.rapid) return;
          ctx.energy('lightning', 4);
          if (ctx.rapidStreak > 0 && ctx.rapidStreak % 5 === 0) ctx.addAttack(1);
        },
      },
      skill: {
        name: 'Haste', charge: 8,
        desc: "The foe's blocks fall twice as fast for 6 seconds.",
        use(f) {
          const o = f.opp;
          o.hastedUntil = f.battle.time + 6;
          o.popup('HASTED!', '#ffe14a', true);
          f.battle.emit('shake', { side: o.side, power: 4 });
        },
      },
      sprite: { arch: 'human', head: 'ninja',
        pal: { x: '#5a4a8a', X: '#3e3366', l: '#8a78c8', a: '#ffd35c', e: INK, m: INK, k: '#2a2240', h: '#4b3a6e', H: '#3a2c58', y: '#ffd35c', s: '#e8c09a', S: '#c9956e' },
        prop: [[14, 6, '#e8ecf4'], [14, 7, '#e8ecf4'], [14, 8, '#c9d0dc'], [14, 9, '#e8ecf4'], [14, 10, '#c9d0dc'], [14, 11, '#e8ecf4'], [14, 12, '#c9d0dc'], [13, 13, '#ffd35c'], [14, 13, '#ffd35c'], [15, 13, '#ffd35c'], [14, 14, '#5a3a2a']] },
    },
    sylva: {
      id: 'sylva', name: 'Sylva', title: 'The Druid', element: 'nature', color: '#8be05a',
      unlock: { dungeons: 3, text: 'Defeat the boss of Dungeon 3 (Prism Dragon).' },
      quote: 'A broken board can grow back.',
      deck: ['stone_I', 'stone_I', 'stone_I', 'sprout_O', 'stone_O', 'bloom_T', 'stone_T', 'root_L', 'stone_L', 'moss_J', 'sprout_S', 'stone_Z'],
      passive: {
        name: 'Deep Roots', desc: 'Every 10 lines you clear remove 1 garbage row from your board.',
        onBattleStart(f, st) { st.n = 0; },
        onClear(ctx, st) { st.n += ctx.lines; while (st.n >= 10) { st.n -= 10; ctx.removeGarbage(1); } },
      },
      skill: {
        name: 'Overgrowth', charge: 12,
        desc: 'Fill every hole in your 3 lowest rows with Nature blocks. Rows that fill up clear and attack.',
        use(f) {
          const B = f.board;
          for (let r = B.rows - 3; r < B.rows; r++) {
            if (!B.grid[r].some((c) => c)) continue; // leave empty rows alone
            for (let c = 0; c < B.cols; c++) if (!B.grid[r][c]) B.grid[r][c] = { el: 'nature', shape: 'S', kind: 'block' };
          }
          const rows = B.fullRows();
          if (rows.length) {
            const fx = rows.map((r) => ({ r, cells: B.grid[r].map((c) => (c ? c.el : null)) }));
            B.clearRows(rows);
            f.stats.lines += rows.length;
            f.emit('clear', { rows: fx, n: rows.length });
            const atk = EB.attackFor(rows.length);
            if (atk > 0) f.battle.sendAttack(f, atk, 'nature');
          }
          f.popup('OVERGROWTH', '#8be05a', true);
        },
      },
      sprite: { arch: 'human', head: 'leafhood',
        pal: { x: '#7aa850', X: '#567a38', l: '#9ed870', a: '#e0c060', e: INK, m: INK, k: '#4a3426', h: '#4f9a4a', H: '#3a7a3a', L: '#9ee06a', s: '#e8c8a0', S: '#c99a78' },
        prop: [[14, 5, '#9ee06a'], [13, 5, '#4f9a4a'], [15, 6, '#9ee06a'], [14, 6, '#7a5030'], [14, 7, '#7a5030'], [14, 8, '#7a5030'], [14, 9, '#7a5030'], [14, 10, '#7a5030'], [14, 11, '#7a5030'], [14, 12, '#7a5030'], [14, 13, '#7a5030'], [14, 14, '#7a5030'], [14, 15, '#7a5030'], [14, 16, '#7a5030']] },
    },
    brick: {
      id: 'brick', name: 'Brick', title: 'The Stonemason', element: 'neutral', color: '#d0c8b4',
      unlock: { runsWon: 1, text: 'Win a full run with any hero.' },
      quote: 'No magic needed. Just stack it right.',
      noElements: true,
      deck: ['stone_I', 'stone_I', 'stone_I', 'stone_I', 'stone_O', 'stone_T', 'stone_L', 'stone_J', 'stone_S', 'stone_Z'],
      passive: {
        name: 'Master Mason', desc: '3-line clears send +1, 4-line clears send +2. No element energy, bursts or reactions.',
        onClear(ctx) { if (ctx.lines === 3) ctx.addAttack(1); if (ctx.lines >= 4) ctx.addAttack(2); },
      },
      skill: {
        name: 'Reshape', charge: 6,
        desc: 'Turn the falling block into an I-block (four in a line).',
        use(f) {
          const p = f.piece;
          if (!p) return;
          const old = { shape: p.shape, rot: p.rot, x: p.x, y: p.y };
          p.shape = 'I'; p.rot = 0;
          // find a spot for the I-block near where the old block was
          const tries = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1], [0, -2]];
          const hit = tries.find(([dx, dy]) => f.board.fits('I', 0, old.x + dx, old.y + dy));
          if (!hit) { Object.assign(p, old); f.skillCharge = f.hero.skill.charge; f.popup('NO ROOM', '#ff7a6a'); return; }
          p.x = old.x + hit[0]; p.y = old.y + hit[1];
          f.popup('RESHAPE', '#d0c8b4', true);
        },
      },
      sprite: { arch: 'human', head: 'bandana',
        pal: { x: '#8a8f9e', X: '#6a6f7c', l: '#b0b5c2', a: '#c9763a', e: INK, m: INK, k: '#4a3426', h: '#c9763a', H: '#a35a2a', g: '#d0ccc4', s: '#d8a880', S: '#b88560' },
        prop: [[13, 10, '#b8c0cc'], [14, 10, '#e8ecf4'], [15, 10, '#b8c0cc'], [13, 11, '#8a93a6'], [14, 11, '#b8c0cc'], [15, 11, '#8a93a6'], [14, 12, '#7a5030'], [14, 13, '#7a5030'], [14, 14, '#7a5030'], [14, 15, '#7a5030']] },
    },
  };
  EB.HERO_IDS = Object.keys(EB.HEROES);

  // achievements: profile.maxDungeonCleared (bosses beaten in one run, best ever) and stats.runsWon
  EB.heroUnlocked = (id, profile) => {
    const u = EB.HEROES[id] && EB.HEROES[id].unlock;
    if (!u) return true;
    const p = profile || (EB.Save && EB.Save.profile) || {};
    if (u.dungeons && (p.maxDungeonCleared || 0) >= u.dungeons) return true;
    if (u.runsWon && ((p.stats && p.stats.runsWon) || 0) >= u.runsWon) return true;
    return false;
  };
  EB.unlockedHeroes = (profile) => EB.HERO_IDS.filter((id) => EB.heroUnlocked(id, profile));

  // hidden relics carrying each hero's passive
  for (const id of EB.HERO_IDS) {
    const h = EB.HEROES[id];
    EB.RELICS['hero:' + id] = Object.assign({ id: 'hero:' + id, name: h.passive.name, icon: h.element, rarity: 'common', hidden: true }, h.passive);
  }
})(globalThis.EB = globalThis.EB || {});
