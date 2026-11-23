// Arena prototype: just the battle, restartable, with layout/test options in the pause menu.
(function (EB) {
  'use strict';
  const { modal, bind } = EB.UIC;
  const DECKS = { starter: 'Starter', chaos: 'Elemental', inferno: 'Fire', tidal: 'Water', verdant: 'Nature', tempest: 'Lightning' };
  const WIDTHS = [[10, '10'], [15, '15'], [20, '20'], [30, '30']];

  const A = {
    battle: null, r: null, input: null, raf: 0, paused: false,
    opt: { cols: 15, level: 1, deck: 'chaos', controls: 'drag', sens: 'medium', time: 0, garbage: 'direct' },

    boot() {
      EB.Save.load();
      const st = EB.Save.settings;
      Object.assign(A.opt, st.arena || {});
      EB.Audio.setVolume('music', st.music); EB.Audio.setVolume('sfx', st.sfx);
      window.addEventListener('pointerdown', () => EB.Audio.unlock());
      window.addEventListener('keydown', () => EB.Audio.unlock());
      const pb = document.getElementById('pauseBtn');
      pb.style.backgroundImage = `url(${EB.Pix.iconURL('pause', 32)})`;
      pb.onclick = () => A.pause();
      window.addEventListener('resize', () => { if (A.r) { A.r.resize(); A.placePause(); } });
      document.addEventListener('visibilitychange', () => { if (document.hidden) A.pause(); });
      const go = () => A.start();
      if (document.fonts && document.fonts.load) document.fonts.load('12px "Press Start 2P"').then(go, go); else go();
    },

    // pause button in the centre band, left of the timer, so it never covers a board
    placePause() {
      const L = A.r.L, pb = document.getElementById('pauseBtn');
      const size = Math.min(40, L.band - 6);
      const st = document.getElementById('stage').getBoundingClientRect();
      Object.assign(pb.style, { width: size + 'px', height: size + 'px', left: (st.left + L.colX) + 'px', top: (st.top + L.mid - size / 2) + 'px', right: 'auto' });
    },

    save() { EB.Save.settings.arena = Object.assign({}, A.opt); EB.Save.write(); },

    // touch scheme: 'tap' | 'drag' | null (keyboard only)
    gestures() {
      const c = A.opt.controls;
      if (c === 'tap' || c === 'drag') return c;
      if (c === 'gestures') return 'drag';
      if (c === 'keyboard') return null;
      return window.matchMedia && window.matchMedia('(pointer: coarse)').matches ? 'tap' : null;
    },

    start() {
      cancelAnimationFrame(A.raf);
      if (A.input) A.input.detach();
      modal.close();
      const st = document.getElementById('stage');
      const grid = EB.ArenaRenderer.gridFor(st.clientWidth, st.clientHeight, A.opt.cols || 20);
      EB.CONFIG.GARBAGE_MODE = A.opt.garbage === 'classic' ? 'classic' : 'direct';
      EB.CONFIG.MATCH_TIME = A.opt.time ? A.opt.time * 60 : Infinity; // 0 = no time limit
      EB.CONFIG.COLS = grid.cols;
      EB.CONFIG.ROWS = grid.rows;
      EB.CONFIG.DANGER_WARN_HEIGHT = grid.rows - EB.CONFIG.DANGER_ROWS - Math.max(3, Math.round(grid.rows * 0.2));
      const foeId = ['mud_slime', 'volt_wisp', 'prism_dragon'][A.opt.level];
      const foe = EB.ENEMIES[foeId];
      const b = new EB.Battle({
        seed: EB.newSeed(), mode: 'arena',
        player: { name: 'You', cards: EB.PRESET_DECKS[A.opt.deck].cards.map((id) => EB.makeCard(id)), portrait: 'hero' },
        enemy: { name: foe.name, cards: EB.enemyDeck(foe), relics: [], level: A.opt.level, speed: foe.tier === 'boss' ? EB.CONFIG.BOSS_SPEED : 1, portrait: { enemy: foeId } },
      });
      A.battle = b;
      A.r = new EB.ArenaRenderer(document.getElementById('cv'), b);
      A.placePause();
      A.input = new EB.Input(b.player, { pause: () => (A.paused ? A.resume() : A.pause()), isPaused: () => A.paused });
      const stage = document.getElementById('stage');
      stage.onpointerdown = stage.onpointermove = stage.onpointerup = stage.onpointercancel = null;
      const scheme = A.gestures();
      if (scheme) {
        A.input.bindGestures(stage, EB.Input.touchOptions(b.player, stage, () => A.r.L, scheme, A.opt.sens));
      }
      b.on(A.sound);
      b.on((t, d) => { if (t === 'end') setTimeout(() => A.result(d), 1400); });
      A.paused = false;
      EB.Audio.music('battle');
      let last = performance.now();
      const loop = (now) => {
        A.raf = requestAnimationFrame(loop);
        let dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (!A.paused) {
          const frame = dt;
          while (dt > 0) { const s = Math.min(dt, 1 / 120); A.input.update(s); b.update(s); dt -= s; }
          A.r.render(frame);
        } else A.r.render(0);
      };
      A.raf = requestAnimationFrame(loop);
      const touch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;
      if (A.gestures() && touch && !EB.Save.settings.touchHelpV2) A.help(true);
    },

    sound(t, d) {
      const q = d.side === 'bottom', S = EB.Audio;
      const map = { harddrop: 'harddrop', lock: 'lock', attack: 'attack', garbage: 'garbage', cancel: 'cancel', absorb: 'cancel', shield: 'shield', purify: 'purify', reaction: 'reaction' };
      if ((t === 'move' || t === 'rotate' || t === 'hold' || t === 'softdrop') && !q) S.sfx(t);
      else if (map[t]) S.sfx(map[t], null, q);
      else if (t === 'clear') S.sfx('clear', d.n, q);
      else if (t === 'combo') S.sfx('combo', d.combo, q);
      else if (t === 'hit') S.sfx('hit', null, !q);
      else if (t === 'burst') S.sfx('burst', d.el, q);
      else if (t === 'tick' || t === 'go' || t === 'sudden') S.sfx(t);
    },

    seg(name, options, cur) {
      return `<div class="seg">${options.map(([v, label]) => `<button class="btn ${String(v) === String(cur) ? 'sel' : ''}" data-act="set" data-arg="${name}:${v}">${label}</button>`).join('')}</div>`;
    },

    pause() {
      if (!A.battle || A.paused || A.battle.state === 'over') return;
      A.paused = true;
      if (A.input) A.input.releaseAll();
      A.menu();
    },

    menu() {
      const o = A.opt;
      const box = modal.open(`<h2 style="text-align:center">ARENA PROTOTYPE</h2>
        <div class="list">
          <div><h3>Blocks per row <span class="tiny dim">(board ${EB.CONFIG.COLS}x${EB.CONFIG.ROWS})</span></h3>${A.seg('cols', WIDTHS, o.cols || 20)}</div>
          <div><h3>Garbage</h3>${A.seg('garbage', [['direct', 'Direct'], ['classic', 'Classic']], o.garbage || 'direct')}
            <p class="tiny dim">Direct: every line you clear sends 1 garbage row that lands at once. Classic: 2/3/4 lines send 1/2/4, queued, and clearing cancels it.</p></div>
          <div><h3>Match time</h3>${A.seg('time', [[1, '1 min'], [2, '2 min'], [3, '3 min'], [4, '4 min'], [5, '5 min'], [0, 'No limit']], o.time == null ? 2 : o.time)}
            <p class="tiny dim">No limit: play until one stack reaches its danger line.</p></div>
          <div><h3>AI</h3>${A.seg('level', EB.AI_LEVELS.map((l, i) => [i, l.name]), o.level)}</div>
          <div><h3>Your deck</h3>${A.seg('deck', Object.entries(DECKS), o.deck)}</div>
          <div><h3>Controls</h3>${A.seg('controls', [['auto', 'Auto'], ['tap', 'Tap'], ['drag', 'Drag'], ['keyboard', 'Keyboard']], o.controls)}
            <p class="tiny dim">Tap: tap a column to move there, tap it again to drop, tap the block to rotate. Drag: classic swipe.</p></div>
          <div><h3>Slide sensitivity</h3>${A.seg('sens', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], o.sens || 'medium')}</div>
        </div>
        <p class="tiny dim mt">Changing any option restarts the match.</p>
        <div class="list mt">
          <button class="btn primary wide" data-act="resume">Resume</button>
          <button class="btn wide" data-act="restart">Restart match</button>
          <button class="btn wide" data-act="help">Touch controls</button>
        </div>`, true);
      bind(box.parentElement, {
        resume: () => A.resume(),
        restart: () => A.start(),
        help: () => A.help(false),
        set(arg) {
          const [k, v] = arg.split(':');
          A.opt[k] = k === 'cols' || k === 'level' || k === 'time' ? +v : v;
          A.save();
          A.start();
        },
      });
    },

    resume() { modal.close(); A.paused = false; },

    help(first) {
      A.paused = true;
      const row = (g, a) => `<div class="item"><div class="gest">${g}</div><div class="grow"><div class="t">${a}</div></div></div>`;
      const box = modal.open(`<h2 style="text-align:center">Touch Controls</h2>
        <p class="small dim" style="text-align:center">Use your finger anywhere on the arena.</p>
        <div class="list">${A.gestures() === 'drag' ? `
          ${row('&larr; drag &rarr;', 'Move the block one column per step')}
          ${row('tap', 'Rotate clockwise')}
          ${row('&#x21bb; circle', 'Draw a circle: rotate in that direction')}
` : `
          ${row('tap a column', 'The block moves to that column')}
          ${row('tap it again', 'Drop it there')}
          ${row('tap the block', 'Rotate clockwise')}
          ${row('&larr; slide &rarr;', 'Move the block slowly, one column at a time')}`}
          ${row('drag &darr;', 'Lower the block slowly: it follows your finger')}
          ${row('&darr; then &larr;&rarr;', 'Without lifting: slide it into a gap')}
          ${row('flick &darr;', 'Hard drop straight down')}
          ${row('flick &uarr;', 'Hold / swap card')}
          ${row('2-finger tap', 'Rotate counter-clockwise')}
        </div>
        <div class="row center mt"><button class="btn primary" data-act="ok">${first ? 'Start!' : 'Back'}</button></div>`, true);
      bind(box.parentElement, {
        ok() {
          EB.Save.settings.touchHelpV2 = true; EB.Save.write();
          if (first) A.resume(); else A.menu();
        },
      });
    },

    result(res) {
      if (!A.battle || A.battle.result !== res) return;
      EB.Audio.music(null);
      EB.Audio.sfx(res.winner === 'player' ? 'victory' : 'defeat');
      const p = res.player, a = res.ai;
      const box = modal.open(`<div class="result-title ${res.winner === 'player' ? 'win' : 'lose'}" style="font-size:26px">${res.winner === 'player' ? 'VICTORY!' : res.winner === 'draw' ? 'DRAW' : 'DEFEAT'}</div>
        <p class="tiny dim" style="text-align:center">${EB.util.esc(res.reason)}</p>
        <div class="statgrid"><span class="h"></span><span class="h you">YOU</span><span class="h foe">FOE</span>
          ${[['Lines', p.lines, a.lines], ['Sent', p.sent, a.sent], ['Received', p.received, a.received], ['Best combo', p.maxCombo, a.maxCombo], ['Pieces', p.pieces, a.pieces], ['Height', p.height, a.height]]
            .map(([k, x, y]) => `<span class="small">${k}</span><span class="you">${x}</span><span class="foe">${y}</span>`).join('')}</div>
        <div class="list mt"><button class="btn primary wide" data-act="again">Play again</button><button class="btn wide" data-act="opts">Options</button></div>`, true);
      bind(box.parentElement, { again: () => A.start(), opts: () => { A.paused = true; A.menu(); } });
    },
  };

  EB.Arena = A;
  window.addEventListener('DOMContentLoaded', () => A.boot());
})(globalThis.EB = globalThis.EB || {});
