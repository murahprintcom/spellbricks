// Balance probe: node tests/balance.js — average attack/min per preset deck (same AI both sides).
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..', 'js');
for (const f of ['core/util.js','config.js','data/shapes.js','data/elements.js','data/cards.js','data/relics.js','data/enemies.js','systems/board.js','systems/deck.js','systems/elemental.js','systems/fighter.js','systems/ai.js','systems/battle.js'])
  vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
const EB = globalThis.EB;
const lvl = +(process.argv[2] || 1), N = +(process.argv[3] || 8);
const mk = (ids) => ids.map((id) => EB.makeCard(id));
for (const k of Object.keys(EB.PRESET_DECKS)) {
  let atk = 0, mins = 0, wins = 0, bursts = 0, rx = 0, lines = 0;
  for (let s = 1; s <= N; s++) {
    const b = new EB.Battle({ seed: s * 977, player: { name: 'P', cards: mk(EB.PRESET_DECKS[k].cards) }, enemy: { name: 'E', cards: mk(EB.STARTER_DECK), level: lvl }, autoPlayer: { level: lvl } });
    let g = 0; while (b.state !== 'over' && g++ < 60 * 400) b.update(1 / 60);
    const r = b.result; atk += r.player.attack; lines += r.player.lines; mins += r.duration / 60; bursts += r.player.bursts; rx += r.player.reactions;
    if (r.winner === 'player') wins++;
  }
  console.log(k.padEnd(8), 'atk/min', (atk / mins).toFixed(1).padStart(5), ' lines/min', (lines / mins).toFixed(1).padStart(5), ' bursts/min', (bursts / mins).toFixed(2), ' rx/min', (rx / mins).toFixed(2), ' winrate', wins + '/' + N);
}
