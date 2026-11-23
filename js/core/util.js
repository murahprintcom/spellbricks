// Spellbricks — shared namespace + small helpers.
// Every file attaches to the global EB object so the game runs from file:// with no build step.
(function (EB) {
  'use strict';

  // Seeded RNG (mulberry32) so runs and AI can be reproduced.
  class RNG {
    constructor(seed) { this.s = (seed >>> 0) || 1; }
    next() {
      let t = (this.s += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    int(n) { return Math.floor(this.next() * n); }
    range(a, b) { return a + this.int(b - a + 1); }
    chance(p) { return this.next() < p; }
    pick(arr) { return arr[this.int(arr.length)]; }
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = this.int(i + 1);
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }
    weighted(items, wf) {
      let total = 0;
      for (const it of items) total += wf(it);
      let r = this.next() * total;
      for (const it of items) { r -= wf(it); if (r <= 0) return it; }
      return items[items.length - 1];
    }
  }

  EB.RNG = RNG;
  EB.newSeed = () => (Math.random() * 0xffffffff) >>> 0;

  EB.util = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    fmtTime(sec) {
      sec = Math.max(0, Math.ceil(sec));
      const m = Math.floor(sec / 60), s = sec % 60;
      return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    },
    hexToRgb(h) {
      h = h.replace('#', '');
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    },
    rgbToHex(r, g, b) {
      const c = (v) => EB.util.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
      return '#' + c(r) + c(g) + c(b);
    },
    shade(hex, f) { // f>0 lighten toward white, f<0 darken toward black
      const [r, g, b] = EB.util.hexToRgb(hex);
      if (f >= 0) return EB.util.rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f);
      return EB.util.rgbToHex(r * (1 + f), g * (1 + f), b * (1 + f));
    },
    mix(a, b, t) {
      const A = EB.util.hexToRgb(a), B = EB.util.hexToRgb(b);
      return EB.util.rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
    },
    rgba(hex, a) {
      const [r, g, b] = EB.util.hexToRgb(hex);
      return `rgba(${r},${g},${b},${a})`;
    },
    esc(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
  };
})(globalThis.EB = globalThis.EB || {});
