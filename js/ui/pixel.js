// Pixel art: every sprite is a tiny text pattern painted to a canvas, then scaled with
// nearest-neighbour so it stays crisp. No image files needed.
(function (EB) {
  'use strict';
  const U = EB.util;

  function palFromBase(base) {
    return { o: U.shade(base, -0.75), d: U.shade(base, -0.42), '.': base, l: U.shade(base, 0.35), a: U.shade(base, 0.7), i: '#ffffff' };
  }

  EB.tileKind = (el, shape) => (el === 'garbage' ? 'garbage' : !el || el === 'neutral' ? 'n:' + shape : el);

  function paint(pat, pal, px) {
    const h = pat.length, w = pat[0].length;
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * px); cv.height = Math.round(h * px);
    const g = cv.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = pat[y][x];
        const col = pal[ch];
        if (!col || ch === ' ') continue;
        const x0 = Math.round(x * px), y0 = Math.round(y * px);
        g.fillStyle = col;
        g.fillRect(x0, y0, Math.round((x + 1) * px) - x0, Math.round((y + 1) * px) - y0);
      }
    }
    return cv;
  }

  const cache = new Map();

  // ---- blocks: 12x12, ink outline, rounded corners, light from the top-left ----
  const INK = '#241826';
  const NEW_TILE = {
    fire: ['#e5603a', '#ff9a5a', '#b23a2a', '#ffe08a'],
    water: ['#4a8fe0', '#8cc8ff', '#2f62b0', '#e6f6ff'],
    nature: ['#5aa84a', '#9ed870', '#3d7d36', '#eaffc0'],
    lightning: ['#8a6ad0', '#b8a0f0', '#5e48a0', '#ffe14a'],
    garbage: ['#6e6658', '#8a8272', '#4e473d', '#3a342c'],
  };
  const SHAPE_TINT = { I: '#7fa8a8', O: '#c2b07a', T: '#a48eb4', L: '#c0946c', J: '#7f94b8', S: '#8fa87c', Z: '#b88484' };
  const GLYPH12 = {
    fire: ['....a.....', '....aa....', '...aaa.a..', '...aiaaa..', '..aaiia...', '..aiiiia..', '..aiiiia..', '...aaaa...'],
    water: ['....aa....', '....aa....', '...aaaa...', '..aaaaaa..', '..aiaaaa..', '..aiaaaa..', '...aaaa...', '..........'],
    nature: ['.......aa.', '.....aaaa.', '....aaiaa.', '...aaia...', '..aaia....', '..aa......', '.a........', '..........'],
    lightning: ['.....aa...', '....aa....', '...aa.....', '..aaaaaa..', '.....aa...', '....aa....', '...aa.....', '..........'],
    neutral: ['..........', '..........', '...a......', '..........', '..........', '......a...', '..........', '..........'],
    garbage: ['..........', '...a......', '....a.....', '....aa....', '...a..a...', '..a.......', '......a...', '..........'],
  };
  EB.GLYPHS = GLYPH12; // add a 10x8 glyph here for a new element's block

  function tileColors(kind) {
    if (NEW_TILE[kind]) return { c: NEW_TILE[kind], glyph: GLYPH12[kind] };
    if (kind.startsWith('n:')) {
      const base = SHAPE_TINT[kind[2]] || '#a8a398';
      return { c: [base, U.shade(base, 0.3), U.shade(base, -0.28), U.shade(base, 0.55)], glyph: GLYPH12.neutral };
    }
    const el = EB.ELEMENTS[kind];
    const base = el ? el.color : '#a8a398';
    return { c: [base, U.shade(base, 0.3), U.shade(base, -0.3), U.shade(base, 0.6)], glyph: GLYPH12[kind] || GLYPH12.neutral };
  }
  function paintTile(kind, size) {
    const { c: [b, l, d, a], glyph } = tileColors(kind);
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    const p = size / 12;
    const R = (x, y, w, h, col) => { g.fillStyle = col; const X = Math.round(x * p), Y = Math.round(y * p); g.fillRect(X, Y, Math.round((x + w) * p) - X, Math.round((y + h) * p) - Y); };
    if (size < 9) { R(0, 0, 12, 12, INK); R(1, 1, 10, 10, b); R(1, 1, 10, 3, l); return cv; } // tiny: no detail
    R(1, 0, 10, 12, INK); R(0, 1, 12, 10, INK);
    R(1, 1, 10, 10, b);
    R(2, 1, 8, 1, l); R(1, 2, 1, 7, l);
    R(2, 10, 8, 1, d); R(10, 3, 1, 7, d);
    R(2, 2, 1, 1, '#ffffff');
    glyph.forEach((row, y) => [...row].forEach((k, x) => { if (k !== '.') R(x + 1, y + 2, 1, 1, k === 'i' ? '#ffffff' : a); }));
    return cv;
  }
  function tile(kind, sizePx) {
    const key = kind + '@' + sizePx;
    let c = cache.get(key);
    if (!c) { c = paintTile(kind, sizePx); cache.set(key, c); }
    return c;
  }

  // ---- 8x8 icons ----
  const ICONS = {
    fire: [['...a....', '...aa...', '..aaa.a.', '..aiaaa.', '.aaiiaa.', '.aiiiia.', '.aiiiia.', '..aaaa..'], { a: '#ff6a2a', i: '#ffd35c' }],
    water: [['...aa...', '...aa...', '..aaaa..', '..aaaa..', '.aalaaa.', '.alaaaa.', '.aaaaaa.', '..aaaa..'], { a: '#3fa2ff', l: '#c8f1ff' }],
    nature: [['......aa', '....aaaa', '...aalaa', '..aalaa.', '.aalaa..', '.alaa...', '.aa.....', 'a.......'], { a: '#5fd24a', l: '#d8ff8a' }],
    lightning: [['....aa..', '...aa...', '..aa....', '.aaaaaa.', '....aa..', '...aa...', '..aa....', '.a......'], { a: '#ffe14a' }],
    neutral: [['..aaaa..', '.alllla.', 'aalllaaa', 'aallaaaa', 'aaaaaada', 'aaaaadda', '.aaddda.', '..aaaa..'], { a: '#8a93a6', l: '#c9d0dc', d: '#5a6274' }],
    sword: [['.......a', '......aa', '.....aa.', '..b.aa..', '...ba...', '..cbb...', '.cc..b..', 'cc......'], { a: '#e8ecf4', b: '#9aa3b5', c: '#b07a3a' }],
    skull: [['..aaaa..', '.aaaaaa.', 'aaaaaaaa', 'a..aa..a', 'a..aa..a', 'aaaa.aaa', '.aaaaaa.', '.a.a.a..'], { a: '#f0e6d6' }],
    question: [['..aaaa..', '.aa..aa.', '.....aa.', '....aa..', '...aa...', '...aa...', '........', '...aa...'], { a: '#c070ff' }],
    coin: [['..aaaa..', '.alllaa.', 'alaaaaab', 'aladdaab', 'aladdaab', 'alaaaaab', '.aaaaab.', '..bbbb..'], { a: '#ffd35c', l: '#fff4c2', d: '#c98a1a', b: '#a06a10' }],
    hammer: [['.aaaaa..', '.aaaaab.', '.aaaaab.', '...cc...', '...cc...', '...cc...', '...cc...', '...cc...'], { a: '#b8c0cc', b: '#6a7284', c: '#b07a3a' }],
    campfire: [['...a....', '..aba...', '..abba..', '.abbba..', '.abbbba.', '..aaaa..', 'c.cccc.c', '.cc..cc.'], { a: '#ff6a2a', b: '#ffd35c', c: '#b07a3a' }],
    crown: [['........', 'a..aa..a', 'aa.aa.aa', 'aaaaaaaa', 'abaaaaba', 'aaaaaaaa', 'aaaaaaaa', '........'], { a: '#ffb02a', b: '#ff4a6a' }],
    heart: [['.aa..aa.', 'alaaaaaa', 'allaaaaa', 'aaaaaaaa', '.aaaaaa.', '..aaaa..', '...aa...', '........'], { a: '#ff4a5a', l: '#ffc0c8' }],
    gem: [['........', '..aaaa..', '.allaab.', 'alaaaabb', '.aaaabb.', '..aabb..', '...ab...', '........'], { a: '#5ff0d0', l: '#e0fff8', b: '#2a9a8a' }],
    shield: [['aaaaaaaa', 'alllllba', 'alllllba', 'allllbba', '.alllba.', '.albba..', '..aba...', '...a....'], { a: '#2f7de1', l: '#9fd8ff', b: '#6fc3ff' }],
    card: [['.aaaaa..', '.abbba..', '.ab.ba..', '.abbba..', '.ab.ba..', '.abbba..', '.aaaaa..', '........'], { a: '#e8ecf4', b: '#9b5cf0' }],
    deck: [['..aaaaa.', '.abbbba.', 'abbbbba.', 'abaaaba.', 'abbbbba.', 'abaaaba.', 'abbbbba.', 'aaaaaa..'], { a: '#e8ecf4', b: '#5a3ab0' }],
    arrowUp: [['...aa...', '..aaaa..', '.aaaaaa.', 'aaaaaaaa', '...aa...', '...aa...', '...aa...', '...aa...'], { a: '#ffffff' }],
    arrowDown: [['...aa...', '...aa...', '...aa...', '...aa...', 'aaaaaaaa', '.aaaaaa.', '..aaaa..', '...aa...'], { a: '#ffffff' }],
    arrowLeft: [['...a....', '..aa....', '.aaaaaaa', 'aaaaaaaa', 'aaaaaaaa', '.aaaaaaa', '..aa....', '...a....'], { a: '#ffffff' }],
    arrowRight: [['....a...', '....aa..', 'aaaaaaa.', 'aaaaaaaa', 'aaaaaaaa', 'aaaaaaa.', '....aa..', '....a...'], { a: '#ffffff' }],
    rotate: [['..aaaa..', '.a....a.', 'a......a', 'a....aaa', 'a.....aa', '.a....a.', '..aaa...', '........'], { a: '#ffffff' }],
    drop: [['aaaaaaaa', '........', '...aa...', '...aa...', 'aaaaaaaa', '.aaaaaa.', '..aaaa..', '...aa...'], { a: '#ffffff' }],
    hold: [['.aaaaaa.', 'a......a', 'a.aaaa.a', 'a.a..a.a', 'a.a..a.a', 'a.aaaa.a', 'a......a', '.aaaaaa.'], { a: '#ffffff' }],
    pause: [['........', '.aa..aa.', '.aa..aa.', '.aa..aa.', '.aa..aa.', '.aa..aa.', '.aa..aa.', '........'], { a: '#ffffff' }],
  };
  EB.ICONS = ICONS;

  function icon(name, sizePx) {
    const key = 'icon:' + name + '@' + sizePx;
    let c = cache.get(key);
    if (!c) {
      const d = ICONS[name] || ICONS.question;
      c = paint(d[0], d[1], sizePx / 8);
      cache.set(key, c);
    }
    return c;
  }

  const urlCache = new Map();
  function toURL(key, make) {
    let u = urlCache.get(key);
    if (!u) { u = make().toDataURL(); urlCache.set(key, u); }
    return u;
  }
  const iconURL = (name, px) => toURL('i' + name + px, () => icon(name, px || 32));

  // ---- chibi sprites (data in js/data/sprites.js) ----
  // def: { arch, head?, extras?, pal, prop? }  ->  18x22 canvas with a 1px ink outline.
  // bob: idle frame 2 (everything above the feet drops 1px).
  function spriteGrid(def) {
    const D = EB.SPRITE_DATA;
    const A = D.ARCH[def.arch] || D.ARCH.wisp;
    const W = 16, H = 20, grid = [];
    for (let y = 0; y < H; y++) grid.push(new Array(W).fill(null));
    const pal = def.pal;
    const put = (x, y, k) => { if (x < 0 || x >= W || y < 0 || y >= H || k === '.') return; const col = pal[k]; if (col) grid[y][x] = col; };
    A.rows.forEach((r, y) => [...r].forEach((k, x) => put(x, y, k)));
    if (def.head && D.HEAD[def.head]) D.HEAD[def.head].forEach((r, y) => [...r].forEach((k, x) => put(x, y, k)));
    for (const ex of def.extras || []) for (const [dy, r] of D.EXTRAS[ex] || []) [...r].forEach((k, x) => put(x, A.top + dy, k));
    for (const [x, y, c] of def.prop || []) if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = c;
    return grid;
  }
  function sprite(def, px, bob) {
    const grid = spriteGrid(def);
    const W = 16, H = 20;
    const cv = document.createElement('canvas');
    cv.width = 18 * px; cv.height = 22 * px;
    const g = cv.getContext('2d');
    const at = (x, y) => (y >= 0 && y < H && x >= 0 && x < W ? grid[y][x] : null);
    const dy = (y) => (bob && y < 17 ? 1 : 0);
    g.fillStyle = INK;
    for (let y = -1; y <= H; y++) for (let x = -1; x <= W; x++) {
      if (at(x, y)) continue;
      if (at(x + 1, y) || at(x - 1, y) || at(x, y + 1) || at(x, y - 1)) g.fillRect((x + 1) * px, (y + 1 + dy(Math.min(16, Math.max(0, y)))) * px, px, px);
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x]) { g.fillStyle = grid[y][x]; g.fillRect((x + 1) * px, (y + 1 + dy(y)) * px, px, px); }
    return cv;
  }
  function spriteDef(kind) {
    if (kind === 'hero' || !kind) return EB.HERO_SPRITE;
    if (kind.hero && EB.HEROES && EB.HEROES[kind.hero]) return EB.HEROES[kind.hero].sprite;
    if (kind.enemy && EB.ENEMY_SPRITES[kind.enemy]) return EB.ENEMY_SPRITES[kind.enemy];
    // unknown foe: a spirit in its element's colour
    const el = EB.ELEMENTS[kind.el];
    const c = el && el.color ? el.color : '#a8a398';
    return { arch: 'wisp', pal: { x: c, X: U.shade(c, -0.3), l: U.shade(c, 0.4), a: U.shade(c, 0.6), e: INK, m: INK, k: '#4a3426' } };
  }
  // portrait(kind, px, bob): kind = 'hero' | {enemy: id}; px = device pixels per art pixel
  function portrait(kind, px, bob) {
    const key = 'p:' + JSON.stringify(kind) + '@' + px + (bob ? 'b' : '');
    let c = cache.get(key);
    if (!c) { c = sprite(spriteDef(kind), Math.max(1, Math.round(px)), bob); cache.set(key, c); }
    return c;
  }
  // dark silhouette of a sprite (locked heroes)
  const silhouetteURL = (kind, px) => toURL('sil' + JSON.stringify(kind) + px, () => {
    const src = portrait(kind, px || 4);
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#18211c'; g.fillRect(0, 0, c.width, c.height);
    return c;
  });
  // ---- Spellbricks logo (option A): gold "SPELL" over "BRICKS" written on six element blocks ----
  const LOGO_BLOCKS = [['#e5603a', '#ff9a5a', '#b23a2a'], ['#4a8fe0', '#8cc8ff', '#2f62b0'], ['#5aa84a', '#9ed870', '#3d7d36'],
    ['#8a6ad0', '#b8a0f0', '#5e48a0'], ['#a8a398', '#cfcbc0', '#7d786e'], ['#e5603a', '#ff9a5a', '#b23a2a']];
  function logoBlock(g, x, y, p, [b, l, d]) {
    const R = (a, c, w, h, col) => { g.fillStyle = col; g.fillRect(x + a * p, y + c * p, w * p, h * p); };
    R(1, 0, 10, 12, INK); R(0, 1, 12, 10, INK); R(1, 1, 10, 10, b);
    R(2, 1, 8, 1, l); R(1, 2, 1, 7, l); R(2, 10, 8, 1, d); R(10, 3, 1, 7, d);
  }
  function logoText(g, text, x, y, size, fill, o, drop) {
    g.font = size + 'px "Press Start 2P", monospace'; g.textBaseline = 'top'; g.textAlign = 'center';
    if (drop) { g.fillStyle = drop; for (let dx = -o; dx <= o; dx += o) g.fillText(text, x + dx, y + o * 2.4); }
    g.fillStyle = INK;
    for (let dx = -o; dx <= o; dx += o) for (let dy = -o; dy <= o; dy += o) g.fillText(text, x + dx, y + dy);
    g.fillStyle = fill; g.fillText(text, x, y);
  }
  function sparkle(g, x, y, s, col) {
    g.fillStyle = col; g.fillRect(x, y - 2 * s, s, 5 * s); g.fillRect(x - 2 * s, y, 5 * s, s);
    g.fillStyle = '#ffffff'; g.fillRect(x, y, s, s);
  }
  // logo(scale): 640x236 art units times scale (use 2 for crisp text on phones)
  function logo(scale) {
    const k = scale || 1;
    const cv = document.createElement('canvas'); cv.width = 640 * k; cv.height = 236 * k;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.scale(k, k);
    logoText(g, 'SPELL', 320, 8, 96, '#ffd35c', 6, '#6b3a2a');          // bigger, sits close to BRICKS
    sparkle(g, 596, 26, 5, '#ffe14a'); sparkle(g, 38, 96, 4, '#8cc8ff');
    const p = 8, size = 12 * p, gap = 6, x0 = (640 - (6 * size + 5 * gap)) / 2;
    'BRICKS'.split('').forEach((ch, i) => {
      const x = x0 + i * (size + gap), y = 126 + (i % 2 ? 6 : 0);
      logoBlock(g, x, y, p, LOGO_BLOCKS[i]);
      logoText(g, ch, x + size / 2, y + 24, 48, '#fff8e6', 4);
    });
    return cv;
  }
  // app icon: a gold-outlined "S" on a fire block, on moss
  function logoIcon(size) {
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#2f4a38'; g.fillRect(0, 0, size, size);
    const p = Math.max(1, Math.floor(size / 16)), b = 12 * p;
    logoBlock(g, Math.round((size - b) / 2), Math.round((size - b) / 2), p, LOGO_BLOCKS[0]);
    logoText(g, 'S', size / 2, (size - b) / 2 + p * 2.5, p * 7, '#fff8e6', Math.max(1, Math.round(p / 2)));
    return cv;
  }

  const portraitURL = (kind, px) => toURL('p' + JSON.stringify(kind) + px, () => portrait(kind, px || 4));

  // shape preview for cards (blocks painted with the element tile)
  function shapeCanvas(shape, el, cell) {
    const s = EB.SHAPES[shape];
    const cells = s.rots[0];
    const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const w = Math.max(...xs) - minX + 1, h = Math.max(...ys) - minY + 1;
    const cv = document.createElement('canvas');
    cv.width = w * cell; cv.height = h * cell;
    const g = cv.getContext('2d');
    const t = tile(EB.tileKind(el, shape), cell);
    for (const [x, y] of cells) g.drawImage(t, (x - minX) * cell, (y - minY) * cell);
    return cv;
  }
  const shapeURL = (shape, el, cell) => toURL('s' + shape + el + cell, () => shapeCanvas(shape, el, cell || 16));

  EB.Pix = { tile, icon, iconURL, portrait, portraitURL, silhouetteURL, logo, logoIcon, sprite, spriteDef, shapeCanvas, shapeURL, paint, palFromBase, INK };
})(globalThis.EB = globalThis.EB || {});
