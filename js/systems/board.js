// Board Manager — pure logic, no rendering.
// Logical orientation for BOTH sides: row 0 = spawn edge (outer edge, danger line side),
// row ROWS-1 = floor (the edge touching the centre battle line). The renderer flips the
// AI board so its spawn edge is at the bottom of the screen.
(function (EB) {
  'use strict';

  class Board {
    constructor(cols, rows) {
      this.cols = cols;
      this.rows = rows;
      this.grid = [];
      for (let r = 0; r < rows; r++) this.grid.push(new Array(cols).fill(null));
    }

    get(x, y) { return y < 0 ? null : this.grid[y][x]; }

    fits(shape, rot, x, y) {
      const cells = EB.SHAPES[shape].rots[rot];
      for (let i = 0; i < 4; i++) {
        const cx = x + cells[i][0], cy = y + cells[i][1];
        if (cx < 0 || cx >= this.cols || cy >= this.rows) return false;
        if (cy >= 0 && this.grid[cy][cx]) return false;
      }
      return true;
    }

    // Place a piece. Returns false if any block ended up above the board.
    lock(shape, rot, x, y, meta) {
      const cells = EB.SHAPES[shape].rots[rot];
      let ok = true;
      for (const [dx, dy] of cells) {
        const cx = x + dx, cy = y + dy;
        if (cy < 0) { ok = false; continue; }
        this.grid[cy][cx] = { el: meta.el, shape, kind: 'block' };
      }
      return ok;
    }

    fullRows() {
      const out = [];
      for (let r = 0; r < this.rows; r++) if (this.grid[r].every((c) => c)) out.push(r);
      return out;
    }

    // Remove rows; returns the cells that were cleared (for element energy / fx).
    clearRows(rows) {
      const cleared = [];
      const set = new Set(rows);
      const keep = [];
      for (let r = 0; r < this.rows; r++) {
        if (set.has(r)) cleared.push(...this.grid[r]);
        else keep.push(this.grid[r]);
      }
      while (keep.length < this.rows) keep.unshift(new Array(this.cols).fill(null));
      this.grid = keep;
      return cleared;
    }

    // Push garbage in from the floor (centre side). holes: array of hole columns, one per row.
    // Returns true if blocks were pushed off the spawn edge (overflow).
    addGarbage(holes) {
      let overflow = false;
      for (const h of holes) {
        const top = this.grid.shift();
        if (top.some((c) => c)) overflow = true;
        const row = new Array(this.cols).fill(null).map((_, i) => (i === h ? null : { el: 'garbage', kind: 'garbage' }));
        this.grid.push(row);
      }
      return overflow;
    }

    // remove the n rows nearest the floor, whatever is in them (hero skills)
    removeBottomRows(n) {
      let removed = 0;
      while (removed < n && this.grid[this.rows - 1].some((c) => c)) {
        this.grid.pop();
        this.grid.unshift(new Array(this.cols).fill(null));
        removed++;
      }
      return removed;
    }

    // Remove up to n rows that contain garbage, nearest the floor first. Returns rows removed.
    removeGarbageRows(n) {
      let removed = 0;
      for (let r = this.rows - 1; r >= 0 && removed < n; r--) {
        if (this.grid[r].some((c) => c && c.kind === 'garbage')) {
          this.grid.splice(r, 1);
          this.grid.unshift(new Array(this.cols).fill(null));
          removed++;
          r++; // re-check the same index (rows shifted down)
        }
      }
      return removed;
    }

    garbageRowCount() {
      let n = 0;
      for (const row of this.grid) if (row.some((c) => c && c.kind === 'garbage')) n++;
      return n;
    }

    stackHeight() {
      for (let r = 0; r < this.rows; r++) if (this.grid[r].some((c) => c)) return this.rows - r;
      return 0;
    }

    inDanger(dangerRows) {
      for (let r = 0; r < dangerRows; r++) if (this.grid[r].some((c) => c)) return true;
      return false;
    }

    isEmpty() { return this.grid.every((row) => row.every((c) => !c)); }

    // Compact bit representation for the AI (bit x set = filled).
    toMasks() {
      const m = new Array(this.rows);
      for (let r = 0; r < this.rows; r++) {
        let v = 0;
        const row = this.grid[r];
        for (let c = 0; c < this.cols; c++) if (row[c]) v |= 1 << c;
        m[r] = v;
      }
      return m;
    }
  }

  EB.Board = Board;
})(globalThis.EB = globalThis.EB || {});
