// Chibi sprite data (art direction "A": everything drawn in code).
// Sprites are 16x20 grids of palette keys; the painter (EB.Pix.sprite in pixel.js) adds a
// 1px outline in INK, so the output is 18x22. Keys shared by every archetype:
//   x main colour   X main shadow   l light   a accent   e eyes   m mouth (ink)   k dark detail
//   s skin  S skin shadow  h hair/hood  H hair shadow  w wing  b beak/talon (gold)
(function (EB) {
  'use strict';
  const INK = '#241826';

  const HUMAN = [
    '................', '................', '....ssssssss....', '...ssssssssss...', '...ssssssssss...', '...ssssssssss...',
    '...ssessssess...', '...ssessssess...', '...SsssmmsssS...', '....SSSSSSSS....', '......ssss......', '....xxxxxxxx....',
    '...xxxxaaxxxx...', '...xxxxaaxxxx...', '...sXXXXXXXXs...', '....xxxxxxxx....', '....XXXXXXXX....', '.....kk..kk.....',
    '.....kk..kk.....', '................',
  ];

  // archetype: { rows, top (first head row, for crowns/horns) }
  const ARCH = {
    human: { top: 2, rows: HUMAN },
    slime: { top: 11, rows: ['................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................',
      '.....xxxxxx.....', '....xllxxxxx....', '...xxlxxxxxxx...', '..xxxexxxxexxx..', '..xxxexxxxexxx..', '..xxxxxmmxxxxx..', '..XXXXXXXXXXXX..', '...XXXXXXXXXX...', '................'] },
    imp: { top: 6, rows: ['................', '................', '................', '................', '...k........k...', '...kk......kk...', '....xxxxxxxx....', '...xxxxxxxxxx...', '...xxaxxxxaxx...', '...xxxxxxxxxx...', '...xxxmmmmxxx...',
      '....XXXXXXXX....', 'w...xxxxxxxx...w', 'ww..xxxxxxxx..ww', '....xxxxxxxx....', '....XXXXXXXX....', '.....xx..xx.....', '.....kk..kk.....', '................', '................'] },
    golem: { top: 6, rows: ['................', '................', '................', '................', '................', '................', '....xxxxxxxx....', '...xXxxxxxxXx...', '...xxaxxxxaxx...', '...xxxxxxxxxx...', '..xxxxxxxxxxxx..',
      '.xxxxxxxxxxxxxx.', '.xxx.xxxxxx.xxx.', '.XXX.xxxxxx.XXX.', '.....xxxxxx.....', '.....XXXXXX.....', '.....xx..xx.....', '....XXX..XXX....', '................', '................'] },
    beast: { top: 6, rows: ['................', '................', '................', '................', '................', '................', '...XX......XX...', '...Xxx....xxX...', '...xxxxxxxxxx...', '..xxxxxxxxxxxx..', '..xxexxxxxxexx..',
      '..xxxxxmmxxxxx..', '...xxxmmmmxxx...', '....XXXXXXXX....', '...xxxxxxxxxx...', '...xxXXXXXXxx...', '...xx.xxxx.xx...', '...XX.XXXX.XX...', '................', '................'] },
    bird: { top: 4, rows: ['................', '................', '................', '................', '......aaa.......', '.....xxxxxx.....', '....xxxxxxxx....', '....xexxxxex....', '....xxxbbxxx....', '.....xxbbxx.....', 'ww...xxxxxx...ww',
      'www.xxxxxxxx.www', '.wwwxxXXXXxxwww.', '..wwxxXXXXxxww..', '....xxxxxxxx....', '.....XXXXXX.....', '.....bb..bb.....', '....bb....bb....', '................', '................'] },
    serpent: { top: 5, rows: ['................', '................', '................', '................', '................', '....xxxxxxxx....', '...xxxxxxxxxx...', '...xxexxxxexx...', '...xxxxxxxxxx...', '...xxxmmmmxxx...', '....xxxxxxxx....',
      '.....XxxxxX.....', '......xxxx......', '.....xxxxxx.....', '...xxxXXXXxxx...', '..xxXX....XXxx..', '..xX..xxxx..Xx..', '..xxxxXXXXxxxx..', '...XXXXXXXXXX...', '................'] },
    wisp: { top: 5, rows: ['................', '................', '................', '................', '................', '.......aa.......', '......aaaa......', '.....aaxxaa.....', '....aaxxxxaa....', '...axxxxxxxxa...', '...xxxxxxxxxx...',
      '...xxexxxxexx...', '...xxexxxxexx...', '...xxxxmmxxxx...', '....xxxxxxxx....', '.....XXXXXX.....', '......XXXX......', '................', '................', '................'] },
  };

  // overlays: [dy-from-top, string] lines placed relative to the archetype's head top
  const EXTRAS = {
    crown: [[-2, '....b..bb..b....'], [-1, '....bbbbbbbb....']],
    horns: [[-2, '...k........k...'], [-1, '...kk......kk...']],
    wings: [[5, 'ww............ww'], [6, 'www..........www'], [7, '.ww..........ww.']],
    claws: [[3, 'aa............aa'], [4, 'a.a..........a.a'], [5, 'aa............aa']],
    tentacles: [[7, '..X.X.X..X.X.X..'], [8, '.X...X....X...X.']],
    leaves: [[-2, '.....l....l.....'], [-1, '....lxl..lxl....']],
  };

  // hair / headgear overlays for the human archetype (rows from the top of the sprite)
  const HEAD = {
    hair: ['................', '....hhhhhhhh....', '...hhhhhhhhhh...', '..hhhhhhhhhhhh..', '..hh.hh..hh.hh..', '..h..........h..'],
    longband: ['................', '....hhhhhhhh....', '...hhhhhhhhhh...', '..hwwwwwwwwwwh..', '..hhhhh..hhhhh..', '..hhh......hhh..', '..hh........hh..', '..hh........hh..', '..hh........hh..', '..hh........hh..', '..hH........Hh..', '..HH........HH..'],
    ninja: ['................', '....hhhhhhhh....', '...hhhhhhhhhh...', '..hhhhhhhhhhhh..', '..hyyyyyyyyyyh..', '..hh........hh..', '..h..........h..', '..h..........h..', '..hhhhhhhhhhhh..', '...hhhhhhhhhh...'],
    leafhood: ['.....L....L.....', '....LhhhhhhL....', '...hhhhhhhhhh...', '..hhhHHHHHHhhh..', '..hhh......hhh..', '..hh........hh..', '..hh........hh..', '..h..........h..'],
    bandana: ['................', '....hhhhhhhh....', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '...HHHHHHHHHH...', '................', '................', '................', '...gg......gg...', '....gggggggg....', '.....gggggg.....', '......gggg......'],
    long: ['................', '....hhhhhhhh....', '...hhhhhhhhhh...', '..hhhhhhhhhhhh..', '..hhhhh..hhhhh..', '..hhh......hhh..', '..hh........hh..', '..hh........hh..', '..hh........hh..', '..hh........hh..', '..hH........Hh..', '..HH........HH..'],
    hood: ['................', '....hhhhhhhh....', '...hhhhhhhhhh...', '..hhhhhhhhhhhh..', '..hhh......hhh..', '..hh........hh..', '..h..........h..', '..h..........h..'],
    helmet: ['................', '....hhhhhhhh....', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '...hHHHHHHHHh...', '...h........h...', '...hh.hhhh.hh...', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '....HHHHHHHH....'],
  };

  const P = (x, X, l, a, extra) => Object.assign({ x, X, l, a, e: INK, m: INK, k: '#4a3426', w: X, b: '#ffd35c' }, extra || {});

  // the player's adventurer (before the hero system)
  EB.HERO_SPRITE = { arch: 'human', head: 'hair', pal: P('#3f8f86', '#2c6a63', '#6fc0b4', '#ffd35c', { h: '#6b4a2a', H: '#4e351d', s: '#f2c9a0', S: '#d99a78' }),
    prop: [[14, 8, '#c9d0dc'], [14, 9, '#e8ecf4'], [14, 10, '#c9d0dc'], [14, 11, '#e8ecf4'], [14, 12, '#c9d0dc'], [13, 13, '#ffd35c'], [14, 13, '#ffd35c'], [15, 13, '#ffd35c'], [14, 14, '#5a3a2a']] };

  const skin = { s: '#f2c9a0', S: '#d99a78' };
  const pale = { s: '#c9c4d8', S: '#9d97b0' };
  EB.ENEMY_SPRITES = {
    // Mossy Ruins
    mud_slime: { arch: 'slime', pal: P('#6ac25a', '#3f8f3a', '#d6f7c0', '#ffd35c') },
    ember_imp: { arch: 'imp', pal: P('#d9533a', '#a33a28', '#ff9a5a', '#ffe14a', { w: '#8a3a5a' }) },
    tide_sprite: { arch: 'wisp', pal: P('#4a8fe0', '#2f62b0', '#8cc8ff', '#c8f1ff') },
    volt_wisp: { arch: 'wisp', pal: P('#8a6ad0', '#5e48a0', '#b8a0f0', '#ffe14a') },
    gargoyle: { arch: 'golem', extras: ['wings'], pal: P('#9aa0a8', '#6e737c', '#c9d0dc', '#ff6a5a', { w: '#6e737c' }) },
    magma_golem: { arch: 'golem', pal: P('#b8502a', '#7a3020', '#e5733a', '#ffe14a') },
    storm_harpy: { arch: 'bird', pal: P('#8a6ad0', '#5e48a0', '#b8a0f0', '#ffe14a', { w: '#b8a0f0' }) },
    deep_kraken: { arch: 'slime', extras: ['tentacles'], pal: P('#3a6ab0', '#244a80', '#8cc8ff', '#c8f1ff') },
    grove_warden: { arch: 'golem', extras: ['leaves', 'crown'], pal: P('#5aa84a', '#3d7d36', '#9ed870', '#ffd35c', { l: '#9ed870' }) },
    // Storm Peaks
    cinder_hound: { arch: 'beast', pal: P('#c9502a', '#8a3020', '#ff9a5a', '#ffd35c') },
    reef_crab: { arch: 'beast', extras: ['claws'], pal: P('#3f8fc0', '#2a6a90', '#8cc8ff', '#ff8a5a') },
    thorn_sprite: { arch: 'wisp', pal: P('#5aa84a', '#3d7d36', '#9ed870', '#e0c060') },
    spark_golem: { arch: 'golem', pal: P('#6a5aa0', '#463a78', '#9a88d0', '#ffe14a') },
    lava_wyrm: { arch: 'serpent', extras: ['horns'], pal: P('#d9603a', '#a33a28', '#ff9a5a', '#ffe14a') },
    tidal_titan: { arch: 'golem', pal: P('#3f7ac0', '#2a5590', '#8cc8ff', '#c8f1ff') },
    thunder_roc: { arch: 'bird', extras: ['crown'], pal: P('#e0b030', '#a88020', '#ffe08a', '#8a6ad0', { w: '#8a6ad0' }) },
    // Prism Spire
    ash_wraith: { arch: 'human', head: 'hood', pal: P('#5a5560', '#3e3a44', '#8a8590', '#ff6a5a', Object.assign({ h: '#3e3a44', H: '#2a2630', e: '#ff6a5a' }, pale)) },
    mire_hydra: { arch: 'serpent', pal: P('#3f9a88', '#2a6e62', '#7fd0c0', '#e0c060') },
    crystal_knight: { arch: 'human', head: 'helmet', pal: P('#8a7ad0', '#5e48a0', '#c0b0f0', '#c8f1ff', Object.assign({ h: '#b0a0e8', H: '#7a68c0' }, skin)) },
    tempest_imp: { arch: 'imp', pal: P('#7a5ac0', '#523a90', '#b8a0f0', '#ffe14a', { w: '#ffe14a' }) },
    elemental_twins: { arch: 'wisp', extras: ['horns'], pal: P('#d9603a', '#2f62b0', '#ff9a5a', '#5ad0ff', { k: '#5aa84a' }) },
    void_knight: { arch: 'human', head: 'helmet', pal: P('#3a3448', '#26222f', '#5a5468', '#c070ff', Object.assign({ h: '#4a4458', H: '#2e2a38' }, pale)) },
    prism_dragon: { arch: 'serpent', extras: ['horns', 'wings', 'crown'], pal: P('#9a6ad0', '#6a48a0', '#d0b0ff', '#5ff0d0', { w: '#5ff0d0' }) },
    // Sunken Abyss
    abyss_eel: { arch: 'serpent', pal: P('#2a5a90', '#1a3a66', '#5a9ad0', '#5ff0d0') },
    coral_golem: { arch: 'golem', extras: ['leaves'], pal: P('#e07a8a', '#b0505e', '#ffb0b8', '#5aa84a', { l: '#9ed870' }) },
    storm_jelly: { arch: 'slime', extras: ['tentacles'], pal: P('#a070d0', '#7048a0', '#e0c0ff', '#ffe14a') },
    magma_crab: { arch: 'beast', extras: ['claws'], pal: P('#d9603a', '#a33a28', '#ff9a5a', '#ffd35c') },
    kraken_queen: { arch: 'slime', extras: ['tentacles', 'crown'], pal: P('#2f62b0', '#1e4280', '#8cc8ff', '#ffd35c') },
    siren: { arch: 'human', head: 'long', pal: P('#3f9a9a', '#2a6e6e', '#7fd0d0', '#ffe14a', Object.assign({ h: '#5ad0c0', H: '#3a9a8e' }, skin)) },
    leviathan: { arch: 'serpent', extras: ['crown', 'horns'], pal: P('#244a80', '#16305a', '#4a8fe0', '#5ff0d0') },
    // Eclipse Citadel
    shadow_knight: { arch: 'human', head: 'helmet', extras: ['horns'], pal: P('#2e2838', '#1c1824', '#4a4458', '#ff5a7a', Object.assign({ h: '#3a3448', H: '#26222f' }, pale)) },
    flame_sentinel: { arch: 'human', head: 'helmet', pal: P('#c9502a', '#8a3020', '#ff9a5a', '#ffd35c', Object.assign({ h: '#e5733a', H: '#b8502a' }, skin)) },
    storm_sentinel: { arch: 'human', head: 'helmet', pal: P('#6a5aa0', '#463a78', '#9a88d0', '#ffe14a', Object.assign({ h: '#8a78c8', H: '#5e4ea0' }, skin)) },
    verdant_sentinel: { arch: 'human', head: 'helmet', pal: P('#4f8a44', '#36662f', '#8bc070', '#e0c060', Object.assign({ h: '#6aa85a', H: '#4a7d3e' }, skin)) },
    eclipse_mage: { arch: 'human', head: 'hood', pal: P('#2e2838', '#1c1824', '#4a4458', '#ffd35c', Object.assign({ h: '#3a3448', H: '#26222f', a: '#ffd35c' }, pale)) },
    iron_titan: { arch: 'golem', pal: P('#7d8594', '#565d6a', '#b0b8c4', '#ff5a7a') },
    eclipse_sovereign: { arch: 'human', head: 'long', extras: ['crown'], pal: P('#8a2a3a', '#5e1a26', '#c04a5a', '#ffd35c', Object.assign({ h: '#2e2838', H: '#1c1824' }, pale)) },
  };

  EB.SPRITE_DATA = { INK, ARCH, EXTRAS, HEAD };
})(globalThis.EB = globalThis.EB || {});
