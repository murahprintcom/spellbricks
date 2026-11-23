// The seven tetromino shapes with SRS rotation states and wall kicks.
// Coordinates are in logical board space: y grows from the spawn edge toward the floor
// (the floor is always the side nearest the centre battle line).
(function (EB) {
  'use strict';

  const BASE = {
    I: { n: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
    O: { n: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    T: { n: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
    L: { n: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
    J: { n: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
    S: { n: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
    Z: { n: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  };

  // SRS kick data (from the guideline, y-up) converted to our y-down space.
  const JLSTZ = {
    '01': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '10': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '12': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '21': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '23': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '32': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '30': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '03': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  };
  const I_KICKS = {
    '01': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '10': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '12': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    '21': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '23': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '32': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '30': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '03': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  };
  const flipY = (tbl) => {
    const o = {};
    for (const k in tbl) o[k] = tbl[k].map(([x, y]) => [x, -y]);
    return o;
  };
  const KICKS_JLSTZ = flipY(JLSTZ);
  const KICKS_I = flipY(I_KICKS);

  const SHAPES = {};
  for (const key in BASE) {
    const { n, cells } = BASE[key];
    const rots = [cells];
    for (let r = 1; r < 4; r++) {
      const prev = rots[r - 1];
      rots.push(key === 'O' ? prev : prev.map(([x, y]) => [n - 1 - y, x]));
    }
    SHAPES[key] = {
      key, n, rots,
      // centred for any board width (10 cols: I/T/L/J/S/Z at 3, O at 4)
      get spawnX() { return Math.floor((EB.CONFIG.COLS - n) / 2); },
      spawnY: 0,
      kicks: key === 'I' ? KICKS_I : key === 'O' ? null : KICKS_JLSTZ,
    };
  }

  EB.SHAPES = SHAPES;
  EB.SHAPE_KEYS = Object.keys(SHAPES);
})(globalThis.EB = globalThis.EB || {});
