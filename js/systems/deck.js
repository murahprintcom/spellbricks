// Card and Deck System for one battle: draw pile -> preview queue -> active -> discard.
// When the draw pile runs out, the discard pile is shuffled into a new draw pile.
(function (EB) {
  'use strict';

  class BattleDeck {
    constructor(cards, rng, preview) {
      this.rng = rng;
      this.preview = preview || EB.CONFIG.PREVIEW;
      this.all = cards.map((c) => Object.assign({}, c));
      this.draw = rng.shuffle(this.all.slice());
      this.discard = [];
      this.queue = [];
      this.active = null;
      this.hold = null;
      this.shuffles = 0;
      this.fill();
    }

    drawOne() {
      if (!this.draw.length) {
        if (!this.discard.length) return null;
        this.draw = this.rng.shuffle(this.discard);
        this.discard = [];
        this.shuffles++;
      }
      return this.draw.pop();
    }

    fill() {
      while (this.queue.length < this.preview) {
        const c = this.drawOne();
        if (!c) break;
        this.queue.push(c);
      }
    }

    // Take the next card into play.
    next() {
      this.fill();
      this.active = this.queue.shift() || null;
      this.fill();
      return this.active;
    }

    // Active card was placed: send it to the discard pile.
    spend() {
      if (this.active) this.discard.push(this.active);
      this.active = null;
    }

    // Swap the active card with the held card (or stash it and draw).
    swapHold() {
      const cur = this.active;
      if (this.hold) {
        this.active = this.hold;
        this.hold = cur;
      } else {
        this.hold = cur;
        this.next();
      }
      return this.active;
    }

    counts() {
      return { draw: this.draw.length, discard: this.discard.length, total: this.all.length };
    }
  }

  EB.BattleDeck = BattleDeck;
})(globalThis.EB = globalThis.EB || {});
