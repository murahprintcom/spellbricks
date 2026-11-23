# Spellbricks

(Formerly "Elemental Blocks"; the `EB` namespace, the bundle name `dist/elemental-blocks.html` and the save key `elementalBlocks.v1` keep the old name so existing saves still load.) Logo: gold "SPELL" over "BRICKS" written on six element blocks, drawn in code by `EB.Pix.logo` / `EB.Pix.logoIcon` in `js/ui/pixel.js`.

Competitive puzzle battle + deckbuilding + elemental combat + roguelike runs, in chibi pixel art (moss palette, one ink outline colour #241826, 12x12 rounded blocks, 16x20 sprites drawn in code; fonts Press Start 2P for titles and Pixelify Sans for text, both OFL).
Every falling block is a card from your deck. Every line you clear is an attack.

- **Website:** https://spellbricks.gilagames.com — Cloudflare Worker `spellbricks` with static assets from `site/` (see `wrangler.jsonc`; deploy command `npx wrangler deploy`, no build command). Rebuild with `python3 tools/build_site.py` and commit `site/`; every push to `main` deploys.
- **Play:** open `index.html` in a browser (no build, no server needed), or the single-file
  bundle `dist/elemental-blocks.html`.
- **Arena prototype** (battle only, big boards, slim info column): `arena-prototype.html` — renderer `js/ui/arena-renderer.js` (shared with the game), controller `js/proto/arena-main.js`. Pause menu sets match time (1-5 min or no limit), blocks per row (10 / 15 / 20 / 30, default 20 = about 20x25 on a phone), AI level, deck and controls. Board width/height adapt to the screen; gravity is scaled so a piece takes the same time to cross any board height. Single file: `python3 tools/build.py arena-prototype.html arena-prototype.html`.
- **Rebuild the single file:** `python3 tools/build.py`
- **Logic tests:** `node tests/sim.js` (rules, deck, timer, sudden death, AI-vs-AI matches, run map)
- **Balance probe:** `node tests/balance.js <aiLevel 0-2> <matches>` (attack/min per preset deck)

## Arena
The battle uses the arena layout: the board fills the screen width with square cells (Settings: 10 / 15 / 20 / 30 blocks per row, default 15; rows fill the height, at least 1.2x the width), one slim info column on the left, and the pause button, timer and run info (floor, HP) in the centre band. Match time is 1-5 minutes or no limit (Settings, default no limit). Touch controls default to Drag with Medium sensitivity.

Player board at the **top** (blocks fall down toward the centre). AI board at the **bottom**
(a vertical mirror: blocks rise toward the centre). Garbage always enters from the centre side and
pushes a stack toward that side's danger line at the outer edge. Boards are 10 x 20.

## Controls
| Action | Keys | Touch |
|---|---|---|
| Move | ← → / A D | arrows |
| Soft drop | ↓ / S | ↓ |
| Rotate CW / CCW | ↑ / X, Z | ⟳ |
| Hard drop | Space | orange button |
| Hold card | Shift / C | ▣ |
| Hero skill | Q | tap your hero |
| Pause | Esc / P | ❚❚ |

Keys, DAS and ARR can be changed in Settings.

**Arena prototype touch schemes:** *Tap* (default, like Tetris One-Touch): tap a column to send the block there, tap the same column again to drop, tap the block to rotate, slide sideways for a slow relative move (one column per ~1.6 cells, min 24px). *Drag*: classic swipe with Low/Medium/High sensitivity. In both, drag down lowers the block one row per cell of finger travel (it stops when the finger stops); one axis moves at a time, and without lifting you can switch from down to sideways to tuck into a gap, flick down = hard drop, flick up = hold.

**Full game phones (gestures, default on touch screens):** drag sideways = the block follows your finger · tap = rotate ·
draw a circle = rotate that way · two-finger tap = rotate counter-clockwise · drag down = soft drop ·
flick down = hard drop · double tap or flick up = hold. Settings → Controls switches between
AUTO / GESTURES / BUTTONS / BOTH / KEYBOARD.

## Code map
| System | File |
|---|---|
| Tuning numbers (attack table, gravity, energy, timer, HP) | `js/config.js` |
| Shapes + SRS rotation/kicks | `js/data/shapes.js` |
| Elements, bursts, reactions, rarities | `js/data/elements.js` |
| Cards (39), starter + preset decks | `js/data/cards.js` |
| Relics (14) | `js/data/relics.js` |
| Enemies + AI difficulty presets | `js/data/enemies.js` |
| Map events | `js/data/events.js` |
| Dungeons (5: Mossy Ruins, Storm Peaks, Prism Spire, Sunken Abyss, Eclipse Citadel — foes, bosses, difficulty, rewards) | `js/data/dungeons.js` |
| Board Manager | `js/systems/board.js` |
| Card & Deck System (draw / discard / hold) | `js/systems/deck.js` |
| Elemental System (energy, bursts, auras, reactions) | `js/systems/elemental.js` |
| Fighter: piece control, lock, attack, garbage, combo | `js/systems/fighter.js` |
| AI (placement search, look-ahead, human-like inputs) | `js/systems/ai.js` |
| Game Manager (timer, projectiles, win rules) | `js/systems/battle.js` |
| Roguelike progression + rewards + shop | `js/systems/run.js` |
| Audio (synth SFX + chiptune music) | `js/systems/audio.js` |
| Save / Load (localStorage) | `js/systems/save.js` |
| Pixel art painter (12x12 outlined blocks, icons, chibi sprites with auto outline) | `js/ui/pixel.js` |
| Chibi sprite data (archetypes, headgear, extras, the player and all 37 foes) | `js/data/sprites.js` |
| Battle renderer (big boards that fill the screen, slim info column) | `js/ui/arena-renderer.js` |
| Input (keyboard DAS/ARR + touch) | `js/ui/input.js` |
| UI screens + run flow | `js/ui/components.js`, `js/ui/screens.js` |
| Boot, battle loop, pause | `js/main.js` |

### Adding content
- **Card:** add an `add('id', {...})` entry in `cards.js` with `shape`, `element`, `rarity`, `desc(lvl)` and optional `onLock(ctx)` / `onClear(ctx)`. The `ctx` API (addAttack, cancel, shield, removeGarbage, energy, comboAdd, guardCombo, fogOpponent, charge, storeBonus, shake) is defined in `Fighter.makeCtx`.
- **Element:** add it to `EB.ELEMENTS` + `EB.ELEMENT_IDS`, a tile glyph in `EB.GLYPHS` (pixel.js) and an icon in `EB.ICONS`. Reactions are pairs in `EB.REACTIONS`.
- **Relic / enemy / event:** one entry in the matching data file.

## Heroes
Pick one of five heroes before a run (or in Quick Battle). Each has its own starting deck, a passive and a skill charged by clearing lines (use it with Q or by tapping/clicking your hero):

| Hero | Element | Passive | Skill (lines) |
|---|---|---|---|
| Ignis | Fire | combo 3+ sends +1 | Meteor (8): burn your 2 lowest rows, send 2 |
| Marisa | Water | start battles with 2 shield | Tsunami (10): +4 shield, send 1 |
| Raiden | Lightning | rapid placements +4 Lightning energy; every 5 in a row send +1 | Haste (8): foe's gravity x2 for 6s |
| Sylva | Nature | every 10 lines remove 1 garbage row | Overgrowth (12): fill holes in your 3 lowest rows, clear and attack |
| Brick | Neutral | 3/4-line clears +1/+2; no element energy, bursts or reactions | Reshape (6): falling block becomes an I-block |

Ignis and Marisa are open from the start. The others unlock with achievements: **Raiden** — beat the Dungeon 1 boss; **Sylva** — beat the Dungeon 3 boss; **Brick** — win a full run (tracked as `profile.maxDungeonCleared` and `stats.runsWon`; a "HERO UNLOCKED!" window announces each once). Locked heroes show as silhouettes with their requirement. Data in `js/data/heroes.js` (passives run as hidden relics `hero:<id>`). The AI has no hero yet.

## Runs
A run is 5 dungeons of 8 floors: **Mossy Ruins** (boss Grove Warden), **Storm Peaks** (boss Thunder Roc), **Prism Spire** (boss Prism Dragon), **Sunken Abyss** (boss Leviathan), **Eclipse Citadel** (final boss Eclipse Sovereign). Foes in dungeons 4-5 use upgraded cards (a `+` after a card id in `enemies.js`). Each map has battles, elites, events, shops, forges and rest sites. Beating a boss heals half your missing HP and offers 1 of 3 relics, then the next dungeon starts on a fresh map. Later dungeons have new foes, faster AI (x1.1 up to x1.4), more gold (x1.3 up to x2.2) and rarer card rewards. Bosses act at half speed.

## Rules summary
- **Garbage rule** (Settings / arena menu): *Classic* (below) or *Direct*: every cleared line sends 1 garbage row (plus combo/element bonuses) that lands the moment it arrives, no queue and no counter. Both the game and the arena prototype default to Direct.
- Attack: 1/2/3/4 lines → 0/1/2/4 garbage, combo bonus, +1 back-to-back 4-line clears, +4 all clear.
- Clearing lines while garbage is queued cancels it first. Garbage waits 0.8 s, then enters on your next lock that clears nothing (max 8 rows per lock). Each garbage row has a hole.
- Elements fill energy; a full bar fires that element's Burst. Clearing with element B while the aura of a recent element-A clear is active fires the A+B reaction (12 s cooldown).
- 2:00 matches. Stack reaching the danger line = instant loss. Time up → lower stack wins → fewer garbage received → more lines → 30 s sudden death (first clear wins).
- The AI plays by the exact same rules through the same actions (rotate / move / hold / hard drop); difficulty only changes think time, input speed, look-ahead and mistakes.
