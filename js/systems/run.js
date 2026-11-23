// Roguelike Progression + Reward System. A run is a plain JSON object (easy to save).
(function (EB) {
  'use strict';
  const C = () => EB.CONFIG;

  const FLOOR_TYPES = [
    ['battle'],
    ['battle', 'event', 'shop'],
    ['elite', 'upgrade', 'battle'],
    ['battle', 'rest', 'event'],
    ['battle', 'elite', 'shop'],
    ['event', 'battle', 'upgrade'],
    ['rest', 'shop'],
    ['boss'],
  ];
  const FLOOR_COUNTS = [2, 3, 3, 3, 3, 3, 2, 1];

  EB.NODE_TYPES = {
    battle: { name: 'Battle', icon: 'sword', color: '#d9dde6', desc: 'Fight a wandering foe.' },
    elite: { name: 'Elite', icon: 'skull', color: '#ff6a5a', desc: 'A tough foe with a relic. Better rewards.' },
    event: { name: 'Event', icon: 'question', color: '#c070ff', desc: 'Something strange happens.' },
    shop: { name: 'Shop', icon: 'coin', color: '#ffd35c', desc: 'Buy cards and relics, remove cards.' },
    upgrade: { name: 'Forge', icon: 'hammer', color: '#ff9a3c', desc: 'Upgrade a card for free.' },
    rest: { name: 'Rest Site', icon: 'campfire', color: '#5fd24a', desc: 'Heal or upgrade a card.' },
    boss: { name: 'Boss', icon: 'crown', color: '#ffb02a', desc: 'The guardian of this dungeon.' },
  };

  function rngOf(run) {
    const r = new EB.RNG(1);
    r.s = run.rngState >>> 0;
    return r;
  }
  function saveRng(run, r) { run.rngState = r.s >>> 0; }

  function genMap(rng, dungeon) {
    const pools = (EB.DUNGEONS[dungeon || 0] || EB.DUNGEONS[0]).pools;
    const floors = [];
    const usedEnemies = new Set();
    const pickEnemy = (tier) => {
      const pool = pools[tier].filter((e) => !usedEnemies.has(e));
      const e = rng.pick(pool.length ? pool : pools[tier]);
      usedEnemies.add(e);
      if (usedEnemies.size >= pools.normal.length) usedEnemies.clear();
      return e;
    };
    for (let f = 0; f < FLOOR_TYPES.length; f++) {
      const n = FLOOR_COUNTS[f];
      let types = rng.shuffle(FLOOR_TYPES[f].slice());
      while (types.length < n) types.push(rng.pick(FLOOR_TYPES[f]));
      types = types.slice(0, n);
      const row = [];
      for (let i = 0; i < n; i++) {
        const type = types[i];
        const node = { idx: i, floor: f, type, x: (i + 0.5) / n, next: [] };
        if (type === 'battle') node.enemy = pickEnemy('normal');
        if (type === 'elite') node.enemy = pickEnemy('elite');
        if (type === 'boss') node.enemy = pickEnemy('boss');
        row.push(node);
      }
      floors.push(row);
    }
    // connect floors by lane proximity
    for (let f = 0; f < floors.length - 1; f++) {
      const a = floors[f], b = floors[f + 1];
      for (const node of a) {
        let best = 0, bd = 9;
        b.forEach((m, j) => { const d = Math.abs(m.x - node.x); if (d < bd) { bd = d; best = j; } });
        node.next.push(best);
        const side = best + (rng.chance(0.5) ? 1 : -1);
        if (side >= 0 && side < b.length && rng.chance(0.55)) node.next.push(side);
      }
      b.forEach((m, j) => {
        if (!a.some((p) => p.next.includes(j))) {
          let best = a[0], bd = 9;
          for (const p of a) { const d = Math.abs(p.x - m.x); if (d < bd) { bd = d; best = p; } }
          best.next.push(j);
        }
      });
      for (const node of a) node.next = [...new Set(node.next)].sort();
    }
    return { floors };
  }

  const Run = {
    create({ difficulty, seed, hero }) {
      seed = seed || EB.newSeed();
      const rng = new EB.RNG(seed);
      const run = {
        v: 1, seed, difficulty: difficulty == null ? 1 : difficulty,
        hp: C().RUN_HP, maxHp: C().RUN_HP, gold: 60,
        hero: hero && EB.HEROES && EB.HEROES[hero] ? hero : null,
        deck: (hero && EB.HEROES && EB.HEROES[hero] ? EB.HEROES[hero].deck : EB.STARTER_DECK).map((id) => EB.makeCard(id)),
        relics: [], blessings: EB.Elemental.emptyEnergy(),
        dungeon: 0, map: genMap(rng, 0), floor: -1, nodeIdx: null, path: [],
        status: 'map', removals: 0, startedAt: Date.now(),
        stats: { battlesWon: 0, battlesLost: 0, lines: 0, sent: 0, bestCombo: 0, pieces: 0, reactions: 0 },
        rngState: 0,
      };
      saveRng(run, rng);
      return run;
    },

    rng: rngOf,
    saveRng,

    currentNode(run) { return run.floor < 0 ? null : run.map.floors[run.floor][run.nodeIdx]; },

    // nodes the player may enter next
    choices(run) {
      if (run.floor < 0) return run.map.floors[0].map((n) => n.idx);
      const cur = Run.currentNode(run);
      return cur ? cur.next.slice() : [];
    },

    enter(run, idx) {
      run.floor += 1;
      run.nodeIdx = idx;
      run.path.push([run.floor, idx]);
      run.nodeDone = false;
    },

    // AI tier & speed for an enemy on this floor, scaled by run difficulty and dungeon.
    enemyFor(run, node) {
      const def = EB.ENEMIES[node.enemy];
      const D = EB.dungeonOf(run);
      const d = run.difficulty, tier = def.tier, f = node.floor;
      let level = def.level, speed = 1;
      // the dungeon sets a minimum tier for normal foes and elites (Dungeon 1 adds nothing)
      if (tier === 'normal') level = Math.max(level, D.normalLevel);
      if (tier === 'elite') level = Math.max(level, D.eliteLevel);
      if (d === 0) { level = Math.max(0, level - 1); speed = tier === 'boss' ? 1 : 0.9; if (tier === 'boss') level = 1; }
      if (d === 1) { if (tier === 'normal' && (f >= 3 || level >= 1)) { level = Math.max(level, 1); speed = 0.85; } if (tier === 'boss') speed = 0.9; }
      if (d === 2) { level = Math.min(2, level + 1); speed = f >= 3 ? 1.1 : 0.95; }
      if (tier === 'boss') speed *= C().BOSS_SPEED;
      speed *= D.speed;
      return { id: node.enemy, def, level: Math.min(2, level), speed, tier };
    },

    lastDungeon(run) { return (run.dungeon || 0) >= EB.DUNGEONS.length - 1; },

    // boss beaten: heal half of the missing HP and move to a fresh map in the next dungeon
    nextDungeon(run) {
      const rng = rngOf(run);
      run.dungeon = (run.dungeon || 0) + 1;
      run.map = genMap(rng, run.dungeon);
      run.floor = -1; run.nodeIdx = null; run.path = []; run.nodeDone = false;
      run.status = 'map';
      saveRng(run, rng);
    },
    dungeonHeal(run) { return Math.ceil((run.maxHp - run.hp) * 0.5); },
    dungeonRelics(run) {
      const rng = rngOf(run);
      const pool = rng.shuffle(EB.RELIC_IDS.filter((id) => !run.relics.includes(id)));
      saveRng(run, rng);
      return pool.slice(0, 3);
    },

    // shift: later dungeons (EB.DUNGEONS[].rarity) move rewards toward rarer cards
    rarityFor(rng, tier, shift) {
      const k = shift || 0;
      const w = tier === 'boss' ? { common: 0, uncommon: 10 - 3 * k, rare: 50, epic: 30 + 5 * k, legendary: 12 + 4 * k }
        : tier === 'elite' ? { common: 10 - 4 * k, uncommon: 40 - 8 * k, rare: 35 + 4 * k, epic: 12 + 5 * k, legendary: 3 + 2 * k }
          : { common: 45 - 15 * k, uncommon: 36 - 4 * k, rare: 15 + 8 * k, epic: 3 + 4 * k, legendary: 0.6 + 0.8 * k };
      return rng.weighted(EB.RARITY_ORDER, (r) => Math.max(0, w[r])); // later dungeons push some weights below 0
    },

    randomCard(rng, opt) {
      opt = opt || {};
      const minI = opt.minRarity ? EB.RARITY_ORDER.indexOf(opt.minRarity) : 0;
      let rarity = opt.rarity || Run.rarityFor(rng, opt.tier || 'normal', opt.shift);
      if (EB.RARITY_ORDER.indexOf(rarity) < minI) rarity = EB.RARITY_ORDER[minI];
      let pool = EB.CARD_IDS.filter((id) => {
        const c = EB.CARDS[id];
        return c.element !== 'neutral' && c.rarity === rarity && (!opt.element || c.element === opt.element) && !(opt.exclude || []).includes(id);
      });
      if (!pool.length) pool = EB.CARD_IDS.filter((id) => EB.CARDS[id].element !== 'neutral' && (!opt.element || EB.CARDS[id].element === opt.element) && EB.RARITY_ORDER.indexOf(EB.CARDS[id].rarity) >= minI);
      return rng.pick(pool);
    },

    randomRelic(run, rng) {
      const pool = EB.RELIC_IDS.filter((id) => !run.relics.includes(id));
      return pool.length ? rng.pick(pool) : null;
    },

    upgradable(run) { return run.deck.filter((c) => (c.lvl || 1) < (EB.CARDS[c.id].maxLvl || 2)); },

    // ---- rewards ----
    rewards(run, tier) {
      const rng = rngOf(run);
      const out = [];
      const used = new Set();
      const cardOpt = () => {
        const id = Run.randomCard(rng, { tier, shift: EB.dungeonOf(run).rarity, exclude: out.filter((o) => o.type === 'card').map((o) => o.cardId) });
        return { type: 'card', cardId: id };
      };
      out.push(cardOpt());
      if (tier !== 'normal') { const r = Run.randomRelic(run, rng); if (r) { out.push({ type: 'relic', relicId: r }); used.add('relic'); } }
      const pool = [
        { t: 'card', w: 3 },
        { t: 'upgrade', w: Run.upgradable(run).length ? 2.2 : 0 },
        { t: 'remove', w: run.deck.length > C().MIN_DECK ? 1.6 : 0 },
        { t: 'relic', w: 0.7 },
        { t: 'gold', w: 1.4 },
        { t: 'heal', w: run.hp < run.maxHp * 0.8 ? 1.8 : 0.3 },
        { t: 'blessing', w: 1.2 },
      ];
      let guard = 0;
      while (out.length < 3 && guard++ < 50) {
        const p = rng.weighted(pool, (x) => (used.has(x.t) && x.t !== 'card' ? 0 : x.w));
        if (p.t === 'card') { if (out.filter((o) => o.type === 'card').length >= 2) continue; out.push(cardOpt()); continue; }
        used.add(p.t);
        if (p.t === 'relic') { const r = Run.randomRelic(run, rng); if (r) out.push({ type: 'relic', relicId: r }); }
        else if (p.t === 'gold') out.push({ type: 'gold', amount: rng.range(35, 60) });
        else if (p.t === 'heal') out.push({ type: 'heal', amount: 15 });
        else if (p.t === 'blessing') out.push({ type: 'blessing', el: rng.pick(EB.ELEMENT_IDS), amount: 25 });
        else out.push({ type: p.t });
      }
      saveRng(run, rng);
      return out;
    },

    describeReward(r) {
      switch (r.type) {
        case 'card': { const c = EB.CARDS[r.cardId]; return { title: 'New Card', name: c.name, desc: `Add ${c.name} (${EB.RARITIES[c.rarity].name} ${EB.ELEMENTS[c.element].name}) to your deck.` }; }
        case 'relic': { const x = EB.RELICS[r.relicId]; return { title: 'Relic', name: x.name, desc: x.desc }; }
        case 'gold': return { title: 'Gold', name: `+${r.amount} Gold`, desc: 'Spend it in shops.' };
        case 'heal': return { title: 'Restore', name: `Heal ${r.amount} HP`, desc: 'Patch yourself up.' };
        case 'upgrade': return { title: 'Upgrade', name: 'Upgrade a Card', desc: 'Choose a card and improve its ability.' };
        case 'remove': return { title: 'Remove', name: 'Remove a Card', desc: 'Thin your deck so your best cards come more often.' };
        case 'blessing': return { title: 'Elemental Bonus', name: `${EB.ELEMENTS[r.el].name} Blessing`, desc: `Start every battle with +${r.amount} ${EB.ELEMENTS[r.el].name} energy.` };
      }
      return { title: '?', name: '?', desc: '' };
    },

    // apply instant rewards; upgrade/remove need a card pick (handled by the UI)
    applyReward(run, r) {
      if (r.type === 'card') run.deck.push(EB.makeCard(r.cardId));
      if (r.type === 'relic') run.relics.push(r.relicId);
      if (r.type === 'gold') run.gold += r.amount;
      if (r.type === 'heal') run.hp = Math.min(run.maxHp, run.hp + r.amount);
      if (r.type === 'blessing') run.blessings[r.el] = Math.min(75, (run.blessings[r.el] || 0) + r.amount);
    },

    upgradeCard(run, uid) {
      const c = run.deck.find((x) => x.uid === uid);
      if (c && (c.lvl || 1) < (EB.CARDS[c.id].maxLvl || 2)) { c.lvl = (c.lvl || 1) + 1; return true; }
      return false;
    },
    removeCard(run, uid) {
      if (run.deck.length <= C().MIN_DECK) return false;
      const i = run.deck.findIndex((x) => x.uid === uid);
      if (i < 0) return false;
      run.deck.splice(i, 1);
      return true;
    },

    relicMod(run, key, def) {
      let v = def;
      for (const id of run.relics) {
        const m = EB.RELICS[id] && EB.RELICS[id].mods;
        if (m && m[key] != null) v = key === 'gold' ? v + m[key] : v * m[key];
      }
      return v;
    },

    // returns {damage, gold}
    afterBattle(run, result, tier) {
      const rng = rngOf(run);
      const win = result.winner === 'player';
      let damage, gold = 0;
      if (win) {
        damage = Math.ceil(result.player.received / C().WIN_DAMAGE_DIV);
        const [a, b] = C().GOLD_REWARD[tier];
        gold = Math.round(Run.relicMod(run, 'gold', rng.range(a, b) * EB.dungeonOf(run).gold));
        run.gold += gold;
        run.stats.battlesWon++;
      } else {
        damage = result.winner === 'draw' ? Math.ceil(C().LOSS_DAMAGE[tier] / 2) : C().LOSS_DAMAGE[tier];
        run.stats.battlesLost++;
      }
      damage = Math.round(damage * Run.relicMod(run, 'hpDamage', 1));
      run.hp -= damage;
      for (const id of run.relics) { const r = EB.RELICS[id]; if (r.afterBattle) r.afterBattle(run, result); }
      run.stats.lines += result.player.lines;
      run.stats.sent += result.player.sent;
      run.stats.pieces += result.player.pieces;
      run.stats.reactions += result.player.reactions;
      run.stats.bestCombo = Math.max(run.stats.bestCombo, result.player.maxCombo);
      if (run.hp <= 0) { run.hp = 0; run.status = 'lost'; }
      saveRng(run, rng);
      return { damage, gold, win };
    },

    // ---- shop ----
    shop(run, node) {
      if (node.shop) return node.shop;
      const rng = rngOf(run);
      const cards = [];
      for (let i = 0; i < 5; i++) {
        const id = Run.randomCard(rng, { tier: i >= 3 ? 'elite' : 'normal', shift: EB.dungeonOf(run).rarity, exclude: cards.map((c) => c.cardId) });
        const base = EB.RARITIES[EB.CARDS[id].rarity].price;
        cards.push({ cardId: id, price: Math.round(base * (0.9 + rng.next() * 0.2)), sold: false });
      }
      const relics = [];
      for (let i = 0; i < 2; i++) {
        const pool = EB.RELIC_IDS.filter((id) => !run.relics.includes(id) && !relics.some((r) => r.relicId === id));
        if (pool.length) relics.push({ relicId: rng.pick(pool), price: rng.range(140, 185), sold: false });
      }
      node.shop = { cards, relics, removePrice: 75 + 25 * run.removals, removed: false, heal: { amount: 15, price: 35, sold: false } };
      saveRng(run, rng);
      return node.shop;
    },

    pickEvent(run, node) {
      if (node.event) return EB.EVENTS.find((e) => e.id === node.event);
      const rng = rngOf(run);
      run.seenEvents = run.seenEvents || [];
      let pool = EB.EVENTS.filter((e) => !run.seenEvents.includes(e.id));
      if (!pool.length) pool = EB.EVENTS;
      const ev = rng.pick(pool);
      node.event = ev.id;
      run.seenEvents.push(ev.id);
      saveRng(run, rng);
      return ev;
    },
  };

  EB.Run = Run;
})(globalThis.EB = globalThis.EB || {});
