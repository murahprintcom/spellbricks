// Headless logic tests: node elemental-blocks/tests/sim.js
// Loads the pure-logic scripts (no DOM) and runs rule checks + AI-vs-AI matches.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..', 'js');
const FILES = [
  'core/util.js', 'config.js', 'data/shapes.js', 'data/elements.js', 'data/cards.js', 'data/relics.js',
  'data/enemies.js', 'data/events.js', 'data/dungeons.js', 'data/heroes.js', 'systems/board.js', 'systems/deck.js', 'systems/elemental.js',
  'systems/fighter.js', 'systems/ai.js', 'systems/battle.js', 'systems/run.js',
];
for (const f of FILES) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: f });
}
const EB = globalThis.EB;
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

// ---- shapes & rotation ----
for (const k of EB.SHAPE_KEYS) {
  const s = EB.SHAPES[k];
  ok(s.rots.length === 4 && s.rots.every((r) => r.length === 4), `shape ${k} has 4 rotation states of 4 cells`);
}
{
  const b = new EB.Board(10, 20);
  ok(b.fits('I', 0, 3, 0), 'I fits at spawn');
  ok(!b.fits('I', 0, 7, 0), 'I does not fit past right wall');
  ok(!b.fits('T', 0, 3, 19), 'T does not fit through floor');
  // fill a row except one and clear it
  for (let c = 0; c < 9; c++) b.grid[19][c] = { el: 'neutral', kind: 'block' };
  ok(b.fullRows().length === 0, 'row with hole is not full');
  b.grid[19][9] = { el: 'fire', kind: 'block' };
  const cl = b.clearRows(b.fullRows());
  ok(cl.length === 10 && b.isEmpty(), 'full row clears');
  const of = b.addGarbage([0, 3]);
  ok(!of && b.grid[19][3] === null && b.grid[18][0] === null && b.grid[19][0].kind === 'garbage', 'garbage enters from floor with holes');
  ok(b.stackHeight() === 2, 'stack height counts garbage');
  ok(b.removeGarbageRows(1) === 1 && b.stackHeight() === 1, 'remove garbage row');
}

// ---- deck ----
{
  const cards = EB.STARTER_DECK.map((id) => EB.makeCard(id));
  const d = new EB.BattleDeck(cards, new EB.RNG(5), 3);
  const seen = [];
  for (let i = 0; i < 30; i++) { const c = d.next(); seen.push(c.uid); d.spend(); }
  const counts = {};
  seen.slice(0, 12).forEach((u) => (counts[u] = (counts[u] || 0) + 1));
  ok(d.shuffles >= 1, 'discard reshuffles into draw pile');
  ok(d.queue.length === 3, 'preview always shows 3');
  ok(new Set(seen.slice(0, 12)).size === 12, 'every card drawn once per cycle');
}

// ---- full matches AI vs AI ----
function match(lvlTop, lvlBot, seed, deckTop, deckBot) {
  const mk = (ids) => ids.map((id) => EB.makeCard(id));
  const b = new EB.Battle({
    seed, mode: 'test',
    player: { name: 'P', cards: mk(deckTop || EB.STARTER_DECK) },
    enemy: { name: 'E', cards: mk(deckBot || EB.STARTER_DECK), level: lvlBot },
    autoPlayer: { level: lvlTop },
  });
  const ev = {};
  b.on((t) => { ev[t] = (ev[t] || 0) + 1; });
  let guard = 0;
  while (b.state !== 'over' && guard++ < 60 * 400) b.update(1 / 60);
  return { r: b.result, ev, b };
}
const names = ['easy', 'normal', 'hard'];
const tally = {};
for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) {
  let w = 0;
  const N = 6;
  for (let s = 1; s <= N; s++) {
    const { r } = match(a, c, s * 101 + a * 7 + c);
    if (r.winner === 'player') w++;
  }
  tally[names[a] + ' vs ' + names[c]] = `${w}/${N}`;
}
console.log('top-AI wins:', tally);
{
  const { r, ev, b } = match(2, 1, 4242);
  ok(r && r.winner, 'match finishes with a winner: ' + r.winner + ' — ' + r.reason);
  ok(r.player.lines > 0 && r.ai.lines > 0, `both sides clear lines (P ${r.player.lines}, AI ${r.ai.lines})`);
  ok(r.player.sent + r.ai.sent > 0, `attacks were sent (P ${r.player.sent}, AI ${r.ai.sent})`);
  ok((ev.garbage || 0) > 0, 'garbage entered a board');
  console.log('  stats P:', JSON.stringify(r.player));
  console.log('  stats A:', JSON.stringify(r.ai));
  console.log('  duration', r.duration.toFixed(1), 'events', JSON.stringify(ev));
}
// elemental decks
for (const k of ['inferno', 'tidal', 'verdant', 'tempest', 'chaos']) {
  const { r, ev } = match(1, 1, 99, EB.PRESET_DECKS[k].cards, EB.STARTER_DECK);
  console.log(`  ${k.padEnd(8)} vs starter: winner ${r.winner.padEnd(6)} sent ${r.player.sent}/${r.ai.sent} bursts ${ev.burst || 0} reactions ${ev.reaction || 0}`);
}
// counter: attack cancels incoming
{
  const b = new EB.Battle({ seed: 3, player: { name: 'P', cards: EB.STARTER_DECK.map((i) => EB.makeCard(i)) }, enemy: { name: 'E', cards: EB.STARTER_DECK.map((i) => EB.makeCard(i)), level: 0 } });
  b.player.startBattle();
  b.player.receive(3);
  const c = b.player.cancelIncoming(2);
  ok(c === 2 && b.player.pendingLines() === 1, 'clearing lines cancels incoming garbage');
}
// timer: lower stack wins, then sudden death on a perfect tie
{
  const mkB = () => new EB.Battle({ seed: 5, player: { name: 'P', cards: EB.STARTER_DECK.map((i) => EB.makeCard(i)) }, enemy: { name: 'E', cards: EB.STARTER_DECK.map((i) => EB.makeCard(i)), level: 0 } });
  let b = mkB();
  b.state = 'playing'; b.started = true; b.player.startBattle(); b.ai.startBattle();
  b.ai.board.addGarbage([0, 1, 2]);
  b.timeLeft = 0.001; b.aiCtrl.update = () => {}; b.update(0.01);
  ok(b.result && b.result.winner === 'player', 'time up: lower stack wins (' + (b.result && b.result.reason) + ')');
  b = mkB();
  b.state = 'playing'; b.started = true; b.player.startBattle(); b.ai.startBattle();
  b.aiCtrl.update = () => {};
  b.timeLeft = 0.001; b.update(0.01);
  ok(b.state === 'sudden' && b.sudden, 'perfect tie triggers sudden death');
  for (let c = 0; c < 10; c++) if (c !== 4) b.player.board.grid[19][c] = { el: 'neutral', kind: 'block' };
  b.player.piece = { card: b.player.deck.active || b.player.piece.card, shape: 'I', el: 'neutral', rot: 1, x: 2, y: 0 };
  b.player.hardDrop();
  ok(b.result && b.result.winner === 'player', 'sudden death: first clear wins');
  // overflow loses immediately
  b = mkB();
  b.state = 'playing'; b.started = true; b.player.startBattle(); b.ai.startBattle(); b.aiCtrl.update = () => {};
  b.player.receive(19); b.time += 2; for (let i = 0; i < 3; i++) b.player.applyGarbage();
  b.update(0.01);
  ok(b.result && b.result.winner === 'ai', 'garbage to the danger line = immediate loss');
}
// heroes: passive, skill charge, skills
{
  const mkH = (hero) => new EB.Battle({ seed: 9, player: { name: 'P', hero, cards: EB.HEROES[hero].deck.map((i) => EB.makeCard(i)) }, enemy: { name: 'E', cards: EB.STARTER_DECK.map((i) => EB.makeCard(i)), level: 0 } });
  let b = mkH('marisa');
  b.state = 'playing'; b.started = true; b.player.startBattle(); b.ai.startBattle(); b.aiCtrl.update = () => {};
  ok(b.player.shield === 2, 'Marisa starts with 2 shield');
  ok(!b.player.skillReady(), 'skill starts uncharged');
  b.player.skillCharge = 10;
  ok(b.player.useSkill() && b.player.shield === 6 && b.projectiles.length === 1 && b.projectiles[0].lines === 1, 'Tsunami: +4 shield and 1 garbage sent');
  ok(!b.player.useSkill(), 'skill cannot be used again until recharged');
  b = mkH('ignis');
  b.state = 'playing'; b.started = true; b.player.startBattle(); b.ai.startBattle(); b.aiCtrl.update = () => {};
  const f = b.player, R = f.board.rows;
  for (let c = 0; c < f.board.cols; c++) { if (c !== 2) f.board.grid[R - 1][c] = { el: 'garbage', kind: 'garbage' }; if (c !== 5) f.board.grid[R - 2][c] = { el: 'garbage', kind: 'garbage' }; }
  f.skillCharge = 8;
  ok(f.useSkill() && f.board.isEmpty() && b.projectiles[0].lines === 2, 'Meteor: burns the 2 bottom rows and sends 2');
  // charging: clearing lines fills the meter
  f.skillCharge = 0;
  for (let c = 0; c < f.board.cols; c++) if (c < 3 || c > 6) f.board.grid[R - 1][c] = { el: 'neutral', kind: 'block' };
  f.board.grid[R - 2][0] = { el: 'neutral', kind: 'block' };
  f.piece = { card: f.piece.card, shape: 'I', el: 'neutral', rot: 0, x: 3, y: 0 };
  f.hardDrop();
  ok(f.skillCharge === 1, 'clearing 1 line charges the skill by 1');
  ok(EB.RELIC_IDS.every((id) => !id.startsWith('hero:')), 'hero passives never appear in relic pools');
  const start = (hero) => { const bb = mkH(hero); bb.state = 'playing'; bb.started = true; bb.player.startBattle(); bb.ai.startBattle(); bb.aiCtrl.update = () => {}; return bb; };
  // Raiden: Haste doubles the foe's gravity for 6s
  b = start('raiden');
  const g0 = b.ai.gravAcc; b.player.skillCharge = 8;
  ok(b.player.useSkill() && b.ai.hastedUntil > b.time + 5, 'Haste: the foe is hasted for 6 seconds');
  b.ai.piece.y = 0; b.ai.gravAcc = 0; const yBefore = b.ai.piece.y; b.ai.update(b.gravityInterval() * 0.55);
  ok(b.ai.piece.y > yBefore, 'a hasted foe falls at double speed');
  // Sylva: Overgrowth fills holes in the 3 lowest rows and clears them
  b = start('sylva');
  const sf = b.player, SR = sf.board.rows;
  for (let r = SR - 3; r < SR; r++) for (let c = 0; c < sf.board.cols; c++) if ((c + r) % 3) sf.board.grid[r][c] = { el: 'garbage', kind: 'garbage' };
  sf.skillCharge = 12;
  ok(sf.useSkill() && sf.board.isEmpty() && sf.stats.lines === 3 && b.projectiles[0].lines === EB.attackFor(3), 'Overgrowth: fills 3 rows, clears them and attacks');
  // Brick: no element energy, Reshape turns the block into an I
  b = start('brick');
  const bf = b.player;
  EB.Elemental.add(bf, 'fire', 50);
  ok(bf.energy.fire === 0, 'Brick gains no element energy');
  bf.piece.shape = 'T'; bf.piece.rot = 0; bf.skillCharge = 6;
  ok(bf.useSkill() && bf.piece.shape === 'I' && bf.board.fits('I', bf.piece.rot, bf.piece.x, bf.piece.y), 'Reshape: the falling block becomes an I-block');
  const fresh = { maxDungeonCleared: 0, stats: { runsWon: 0 } };
  ok(EB.unlockedHeroes(fresh).join() === 'ignis,marisa', 'a new player has Ignis and Marisa only');
  ok(EB.heroUnlocked('raiden', { maxDungeonCleared: 1, stats: { runsWon: 0 } }) && !EB.heroUnlocked('sylva', { maxDungeonCleared: 2, stats: { runsWon: 0 } }), 'Raiden unlocks after Dungeon 1, Sylva not before Dungeon 3');
  ok(EB.heroUnlocked('sylva', { maxDungeonCleared: 3, stats: { runsWon: 0 } }) && !EB.heroUnlocked('brick', { maxDungeonCleared: 4, stats: { runsWon: 0 } }), 'Sylva unlocks after Dungeon 3, Brick needs a won run');
  ok(EB.unlockedHeroes({ maxDungeonCleared: 5, stats: { runsWon: 1 } }).length === 5, 'winning a run unlocks every hero');
  const run = EB.Run.create({ difficulty: 1, seed: 3, hero: 'ignis' });
  ok(run.hero === 'ignis' && run.deck.map((c) => c.id).join() === EB.HEROES.ignis.deck.join(), 'a run starts with the hero deck');
}
if (EB.Run) {
  const run = EB.Run.create({ difficulty: 1, seed: 77 });
  ok(run.map.floors.length >= 6, 'run map has floors: ' + run.map.floors.length);
  ok(run.map.floors[run.map.floors.length - 1][0].type === 'boss', 'last floor is the boss');
  const reachable = run.map.floors.every((fl, i) => i === 0 || fl.every((n) => run.map.floors[i - 1].some((p) => p.next.includes(n.idx))));
  ok(reachable, 'every map node is reachable');
  // three dungeons: each map uses its own foes, later dungeons are tougher
  const bossOf = (r) => r.map.floors[r.map.floors.length - 1][0].enemy;
  ok(bossOf(run) === 'grove_warden', 'dungeon 1 boss is the Grove Warden');
  const d1 = EB.Run.enemyFor(run, run.map.floors[1].find((n) => n.enemy) || { enemy: 'mud_slime', floor: 1 });
  run.hp = 30; const heal = EB.Run.dungeonHeal(run);
  ok(heal === 15, 'dungeon clear heals half the missing HP');
  EB.Run.nextDungeon(run);
  ok(run.dungeon === 1 && run.floor === -1 && bossOf(run) === 'thunder_roc', 'dungeon 2 map with the Thunder Roc');
  const normals2 = run.map.floors.flat().filter((n) => n.type === 'battle').map((n) => n.enemy);
  ok(normals2.every((e) => EB.DUNGEONS[1].pools.normal.includes(e)), 'dungeon 2 battles use dungeon 2 foes');
  const d2 = EB.Run.enemyFor(run, run.map.floors.flat().find((n) => n.type === 'battle'));
  ok(d2.speed > d1.speed - 0.2 && d2.level >= 1, 'dungeon 2 foes are at least Normal AI and faster');
  EB.Run.nextDungeon(run);
  ok(run.dungeon === 2 && bossOf(run) === 'prism_dragon' && !EB.Run.lastDungeon(run), 'dungeon 3 ends with the Prism Dragon');
  EB.Run.nextDungeon(run);
  ok(run.dungeon === 3 && bossOf(run) === 'leviathan', 'dungeon 4 ends with the Leviathan');
  EB.Run.nextDungeon(run);
  ok(run.dungeon === 4 && bossOf(run) === 'eclipse_sovereign' && EB.Run.lastDungeon(run), 'dungeon 5 (last) ends with the Eclipse Sovereign');
  const up = EB.enemyDeck(EB.ENEMIES.leviathan);
  ok(up.some((c) => c.lvl === 2) && up.every((c) => EB.CARDS[c.id]), "enemy decks support upgraded cards ('+')");
  const rr = new EB.RNG(3); const seen = new Set(); for (let i = 0; i < 300; i++) seen.add(EB.Run.rarityFor(rr, 'normal', 4));
  ok(!seen.has(undefined) && seen.size >= 3, 'reward rarity works in dungeon 5');
}
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
