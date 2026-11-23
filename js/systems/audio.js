// Audio Manager: chiptune SFX and music synthesised with WebAudio (no audio files).
(function (EB) {
  'use strict';

  const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const midi = (n) => { const m = n.match(/^([A-G][#b]?)(\d)$/); return 12 * (+m[2] + 1) + NOTE[m[1]]; };
  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const seq = (s) => s.trim().split(/\s+/);

  const TRACKS = {
    menu: {
      bpm: 84, chords: [['A3', 'm'], ['F3', 'M'], ['C4', 'M'], ['G3', 'M']], drums: 'soft',
      lead: seq(`A4 - C5 - E5 - D5 C5  C5 - A4 - F4 - G4 A4  G4 - E4 - G4 - C5 -  B4 - D5 - G4 - - .
                 A4 - E5 - A5 - G5 E5  F5 - E5 - C5 - A4 -  G4 - C5 - E5 - D5 C5  B4 - G4 - B4 D5 - -`),
    },
    battle: {
      bpm: 140, chords: [['D3', 'm'], ['A#2', 'M'], ['C3', 'M'], ['A2', 'M']], drums: 'full',
      lead: seq(`D5 . F5 A5 - G5 F5 E5  D5 - . D5 F5 - D5 C5  E5 . G5 C6 - B5 G5 E5  C#5 - E5 - A4 - . .
                 A5 - G5 F5 E5 D5 E5 F5  D5 - A#4 - D5 F5 G5 F5  E5 - C5 - E5 G5 A5 G5  A5 - - - E5 - C#5 -`),
    },
    boss: {
      bpm: 152, chords: [['E3', 'm'], ['C3', 'M'], ['D3', 'M'], ['B2', 'M']], drums: 'full',
      lead: seq(`E5 . G5 B5 - A5 G5 F#5  E5 - . E5 G5 - E5 D5  F#5 . A5 D6 - C6 A5 F#5  D#5 - F#5 - B4 - . .
                 B5 - A5 G5 F#5 E5 F#5 G5  E5 - C5 - E5 G5 A5 G5  F#5 - D5 - F#5 A5 B5 A5  B5 - - - F#5 - D#5 -`),
    },
    victory: {
      bpm: 120, chords: [['C3', 'M'], ['G2', 'M'], ['A2', 'm'], ['F2', 'M']], drums: 'soft',
      lead: seq(`C5 E5 G5 C6 - - G5 -  B4 D5 G5 B5 - - G5 -  A4 C5 E5 A5 - - E5 -  F5 - A5 - C6 - - -`),
    },
  };

  class AudioMgr {
    constructor() {
      this.ctx = null;
      this.vol = { music: 0.5, sfx: 0.7 };
      this.track = null; this.wanted = null;
      this.step = 0; this.nextTime = 0; this.timer = null;
      this.last = {};
    }

    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain(); this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolume();
      if (this.wanted) this.music(this.wanted, true);
    }

    setVolume(kind, v) { this.vol[kind] = v; this.applyVolume(); }
    applyVolume() {
      if (!this.ctx) return;
      this.musicGain.gain.value = this.vol.music * 0.32;
      this.sfxGain.gain.value = this.vol.sfx * 0.55;
    }

    // ---- primitives ----
    tone(type, f0, f1, dur, vol, when, dest) {
      const c = this.ctx; if (!c) return;
      const t = when || c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest || this.sfxGain);
      o.start(t); o.stop(t + dur + 0.02);
    }
    hiss(dur, vol, when, hp, dest, lp) {
      const c = this.ctx; if (!c) return;
      const t = when || c.currentTime;
      const s = c.createBufferSource(); s.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800;
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f);
      let last = f;
      if (lp) { const l = c.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp; f.connect(l); last = l; }
      last.connect(g); g.connect(dest || this.sfxGain);
      s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    }

    // ---- sound effects ----
    sfx(name, arg, quiet) {
      if (!this.ctx || this.vol.sfx <= 0) return;
      const now = this.ctx.currentTime;
      const k = quiet ? 0.35 : 1;
      // rate-limit very frequent sounds
      const gap = { move: 0.03, softdrop: 0.05, rotate: 0.03, lock: 0.04 }[name];
      if (gap) { if (this.last[name + k] && now - this.last[name + k] < gap) return; this.last[name + k] = now; }
      switch (name) {
        case 'move': this.tone('square', 260, 0, 0.035, 0.08 * k); break;
        case 'rotate': this.tone('square', 380, 520, 0.05, 0.08 * k); break;
        case 'softdrop': this.tone('triangle', 140, 0, 0.025, 0.08 * k); break;
        case 'harddrop': this.tone('sine', 140, 50, 0.14, 0.4 * k); this.hiss(0.08, 0.12 * k, now, 1500); break;
        case 'lock': this.tone('triangle', 180, 120, 0.06, 0.15 * k); break;
        case 'hold': this.tone('square', 300, 600, 0.08, 0.08 * k); break;
        case 'clear': {
          const n = arg || 1;
          const base = [72, 76, 79, 84];
          for (let i = 0; i < n + 1; i++) this.tone('square', freq(base[Math.min(i, 3)] + (n >= 4 ? 5 : 0)), 0, 0.09, 0.12 * k, now + i * 0.045);
          if (n >= 4) this.hiss(0.3, 0.12 * k, now, 3000);
          break;
        }
        case 'combo': this.tone('square', freq(76 + Math.min(arg || 2, 10) * 2), 0, 0.12, 0.12 * k, now + 0.12); break;
        case 'attack': this.tone('sawtooth', 220, 900, 0.22, 0.09 * k); this.hiss(0.18, 0.06 * k, now, 2500); break;
        case 'hit': this.tone('square', 110, 55, 0.2, 0.18 * k); this.hiss(0.2, 0.15 * k, now, 300, null, 2000); break;
        case 'garbage': this.tone('sawtooth', 90, 45, 0.25, 0.16 * k); break;
        case 'cancel': this.tone('sine', 900, 1400, 0.12, 0.14 * k); this.tone('sine', 1400, 1800, 0.1, 0.1 * k, now + 0.06); break;
        case 'shield': this.tone('sine', 600, 1200, 0.2, 0.14 * k); break;
        case 'purify': for (let i = 0; i < 3; i++) this.tone('triangle', freq(79 + i * 4), 0, 0.1, 0.13 * k, now + i * 0.05); break;
        case 'burst': {
          const el = arg;
          if (el === 'fire') { this.hiss(0.45, 0.3 * k, now, 200, null, 1800); this.tone('sawtooth', 120, 60, 0.4, 0.15 * k); }
          else if (el === 'water') { for (let i = 0; i < 5; i++) this.tone('sine', 300 + Math.random() * 500, 900, 0.07, 0.12 * k, now + i * 0.05); }
          else if (el === 'nature') { for (let i = 0; i < 4; i++) this.tone('triangle', freq(67 + [0, 4, 7, 12][i]), 0, 0.14, 0.14 * k, now + i * 0.06); }
          else { this.hiss(0.2, 0.25 * k, now, 4000); this.tone('square', 1200, 80, 0.25, 0.12 * k); }
          break;
        }
        case 'reaction': {
          [60, 64, 67, 72].forEach((m, i) => this.tone('square', freq(m + 7), 0, 0.35, 0.08 * k, now + i * 0.02));
          this.hiss(0.4, 0.2 * k, now, 600);
          this.tone('sine', 80, 40, 0.4, 0.3 * k);
          break;
        }
        case 'tick': this.tone('square', 520, 0, 0.1, 0.15); break;
        case 'go': this.tone('square', 1040, 0, 0.25, 0.16); this.tone('square', 780, 0, 0.25, 0.1); break;
        case 'danger': this.tone('sine', 70, 50, 0.12, 0.3); this.tone('sine', 70, 50, 0.12, 0.25, now + 0.18); break;
        case 'victory': [72, 76, 79, 84, 88].forEach((m, i) => this.tone('square', freq(m), 0, 0.2, 0.12, now + i * 0.1)); break;
        case 'defeat': [67, 63, 60, 55].forEach((m, i) => this.tone('triangle', freq(m), 0, 0.35, 0.18, now + i * 0.18)); break;
        case 'ui': this.tone('square', 660, 0, 0.04, 0.07); break;
        case 'buy': this.tone('square', 990, 0, 0.06, 0.1); this.tone('square', 1320, 0, 0.1, 0.1, now + 0.06); break;
        case 'sudden': this.tone('sawtooth', 200, 800, 0.5, 0.15); break;
      }
    }

    // ---- music sequencer ----
    music(name, force) {
      this.wanted = name;
      if (!this.ctx) return;
      if (this.track === name && !force) return;
      this.track = name;
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.1;
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      if (!name) return;
      this.timer = setInterval(() => this.schedule(), 25);
    }

    schedule() {
      const tr = TRACKS[this.track];
      if (!tr || !this.ctx) return;
      const eighth = 60 / tr.bpm / 2;
      const dest = this.musicGain;
      while (this.nextTime < this.ctx.currentTime + 0.12) {
        const t = this.nextTime;
        const i = this.step % tr.lead.length;
        const bar = Math.floor(this.step / 8) % tr.chords.length;
        const inBar = this.step % 8;
        // lead
        const tok = tr.lead[i];
        if (tok !== '-' && tok !== '.') {
          let len = 1;
          while (tr.lead[(i + len) % tr.lead.length] === '-' && len < 8) len++;
          this.tone('square', freq(midi(tok)), 0, eighth * len * 0.9, 0.16, t, dest);
        }
        // bass + arp
        const [root, q] = tr.chords[bar];
        const r = midi(root);
        if (inBar % 2 === 0) this.tone('triangle', freq(inBar === 4 ? r + 12 : r), 0, eighth * 1.8, 0.32, t, dest);
        const third = q === 'm' ? 3 : 4;
        const arp = [0, third, 7, 12][inBar % 4] + 12;
        this.tone('square', freq(r + arp), 0, eighth * 0.45, 0.04, t, dest);
        this.tone('square', freq(r + arp), 0, eighth * 0.45, 0.025, t + eighth / 2, dest);
        // drums
        if (tr.drums === 'full') {
          if (inBar === 0 || inBar === 4 || inBar === 5) this.tone('sine', 150, 40, 0.12, 0.5, t, dest);
          if (inBar === 2 || inBar === 6) this.hiss(0.1, 0.18, t, 1200, dest);
          this.hiss(0.03, 0.06, t, 7000, dest);
          this.hiss(0.03, 0.04, t + eighth / 2, 7000, dest);
        } else {
          if (inBar === 0) this.tone('sine', 120, 40, 0.15, 0.35, t, dest);
          if (inBar % 2 === 1) this.hiss(0.03, 0.04, t, 7000, dest);
        }
        this.nextTime += eighth;
        this.step++;
      }
    }
  }

  EB.Audio = new AudioMgr();
})(globalThis.EB = globalThis.EB || {});
