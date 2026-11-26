// Game controller: boots the app, owns the battle loop, pause menu and audio hooks.
(function (EB) {
  'use strict';
  const { modal, bind } = EB.UIC;

  const Game = {
    battle: null, renderer: null, input: null, raf: 0, paused: false, onEnd: null, cfg: null,
    heartbeat: 0, ending: false,

    boot() {
      EB.Save.load();
      const st = EB.Save.settings;
      EB.Audio.setVolume('music', st.music);
      EB.Audio.setVolume('sfx', st.sfx);
      const unlock = () => EB.Audio.unlock();
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);
      // touch + pause button icons
      const icons = { left: 'arrowLeft', right: 'arrowRight', hold: 'hold', soft: 'arrowDown', cw: 'rotate', hard: 'drop' };
      document.querySelectorAll('[data-touch]').forEach((b) => { b.style.backgroundImage = `url(${EB.Pix.iconURL(icons[b.dataset.touch], 32)})`; });
      const pb = document.getElementById('pauseBtn');
      pb.style.backgroundImage = `url(${EB.Pix.iconURL('pause', 32)})`;
      pb.onclick = () => Game.pause();
      Game.applyTouch();
      window.addEventListener('resize', () => { if (Game.renderer) { Game.renderer.resize(); Game.placePause(); } });
      document.addEventListener('visibilitychange', () => { if (document.hidden && Game.battle && !Game.paused && Game.battle.state !== 'over') Game.pause(); });
      EB.Track.open();
      const go = () => EB.UI.title();
      if (document.fonts && document.fonts.load) document.fonts.load('12px "Press Start 2P"').then(go, go); else go();
    },

    applyTouch() {
      const m = Game.controlMode();
      document.body.classList.toggle('touch-on', m === 'buttons');
      document.body.classList.toggle('gest-on', m === 'tap' || m === 'drag');
      if (Game.renderer) { Game.renderer.resize(); Game.placePause(); }
    },

    // 'tap' | 'drag' | 'buttons' | 'keyboard' ('auto' picks tap on touch screens)
    controlMode() {
      let pref = EB.Save.settings.controls || 'drag';
      if (pref === 'gestures' || pref === 'both') pref = 'drag'; // older saves
      if (pref !== 'auto') return pref;
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      return coarse ? 'tap' : 'keyboard';
    },
    isTouch() { return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0; },
    scheme() { const m = Game.controlMode(); return m === 'tap' || m === 'drag' ? m : null; },

    // pause button in the centre band, left of the timer, so it never covers a board
    placePause() {
      const L = Game.renderer && Game.renderer.L;
      const pb = document.getElementById('pauseBtn');
      if (!L) return;
      const size = Math.min(40, L.band - 6);
      const st = document.getElementById('stage').getBoundingClientRect();
      Object.assign(pb.style, { position: 'fixed', width: size + 'px', height: size + 'px', left: (st.left + L.colX) + 'px', top: (st.top + L.mid - size / 2) + 'px', right: 'auto', backgroundSize: '16px' });
    },

    hideBattle() {
      document.getElementById('battle').classList.add('hidden');
    },

    startBattle(cfg, onEnd) {
      Game.stopBattle();
      Game.cfg = cfg;
      Game.onEnd = onEnd;
      Game.paused = false;
      Game.ending = false;
      document.getElementById('screen').classList.add('hidden');
      document.getElementById('battle').classList.remove('hidden');
      modal.close();
      Game.applyTouch();
      // board size and match length come from Settings: the board fills the arena width
      const st = EB.Save.settings;
      const stage = document.getElementById('stage');
      const grid = EB.ArenaRenderer.gridFor(stage.clientWidth, stage.clientHeight, st.cols || 15);
      EB.CONFIG.COLS = grid.cols;
      EB.CONFIG.ROWS = grid.rows;
      EB.CONFIG.DANGER_WARN_HEIGHT = grid.rows - EB.CONFIG.DANGER_ROWS - Math.max(3, Math.round(grid.rows * 0.2));
      EB.CONFIG.GARBAGE_MODE = st.garbageMode === 'classic' ? 'classic' : 'direct';
      EB.CONFIG.MATCH_TIME = !st.matchTime ? Infinity : st.matchTime * 60; // 0 / unset = no limit
      const b = new EB.Battle(Object.assign({ seed: EB.newSeed() }, cfg));
      Game.battle = b;
      Game.renderer = new EB.ArenaRenderer(document.getElementById('cv'), b, { label: cfg.label, playerSub: cfg.playerSub, enemySub: cfg.enemySub, theme: cfg.theme });
      Game.placePause();
      Game.input = new EB.Input(b.player, { pause: () => Game.togglePause(), isPaused: () => Game.paused });
      Game.input.bindTouch(document.getElementById('touch'));
      stage.onpointerdown = stage.onpointermove = stage.onpointerup = stage.onpointercancel = null;
      // mouse / tap on the hero skill meter fires the skill (Q on keyboards)
      const skillOpts = EB.Input.touchOptions(b.player, stage, () => Game.renderer.L, null, st.sens);
      stage.onclick = (e) => { if (skillOpts.hitSkill(e.clientX, e.clientY)) b.player.useSkill(); };
      const scheme = Game.scheme();
      if (scheme) {
        Game.input.bindGestures(stage, EB.Input.touchOptions(b.player, stage, () => Game.renderer.L, scheme, st.sens || 'medium'));
        // touch help only on touch screens (the Drag default also applies on desktops)
        if (!st.touchHelpV2 && Game.isTouch()) Game.gestureHelp();
      }
      b.on(Game.audioHook);
      b.on((t, d) => { if (t === 'end') Game.finish(d); });
      EB.Audio.music(cfg.music || 'battle');
      let last = performance.now();
      const loop = (now) => {
        Game.raf = requestAnimationFrame(loop);
        let dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (!Game.paused) {
          // fixed sub-steps keep gravity / AI timing stable on slow frames
          while (dt > 0) {
            const s = Math.min(dt, 1 / 120);
            Game.input.update(s);
            b.update(s);
            dt -= s;
          }
          Game.dangerBeat(now);
        }
        Game.renderer.render(Game.paused ? 0 : Math.min(0.1, (now - (Game._lastR || now)) / 1000));
        Game._lastR = now;
      };
      Game.raf = requestAnimationFrame(loop);
    },

    dangerBeat(now) {
      const b = Game.battle;
      if (!b || b.state === 'over' || b.state === 'countdown') return;
      if (b.player.stackHeight() >= EB.CONFIG.DANGER_WARN_HEIGHT && now - Game.heartbeat > 900) {
        Game.heartbeat = now;
        EB.Audio.sfx('danger');
      }
    },

    audioHook(t, d) {
      const quiet = d.side === 'bottom';
      const A = EB.Audio;
      switch (t) {
        case 'move': case 'rotate': case 'softdrop': case 'hold': if (!quiet) A.sfx(t); break;
        case 'harddrop': A.sfx('harddrop', null, quiet); break;
        case 'lock': A.sfx('lock', null, quiet); break;
        case 'clear': A.sfx('clear', d.n, quiet); break;
        case 'combo': A.sfx('combo', d.combo, quiet); break;
        case 'attack': A.sfx('attack', null, quiet); break;
        case 'hit': A.sfx('hit', null, !quiet); break;
        case 'garbage': A.sfx('garbage', null, quiet); break;
        case 'cancel': case 'absorb': A.sfx('cancel', null, quiet); break;
        case 'shield': A.sfx('shield', null, quiet); break;
        case 'purify': A.sfx('purify', null, quiet); break;
        case 'burst': A.sfx('burst', d.el, quiet); break;
        case 'skill': A.sfx('reaction', null, quiet); A.sfx('burst', d.el, quiet); break;
        case 'skillready': if (!quiet) A.sfx('combo', 6); break;
        case 'reaction': A.sfx('reaction', null, quiet); break;
        case 'tick': A.sfx('tick'); break;
        case 'go': A.sfx('go'); break;
        case 'sudden': A.sfx('sudden'); break;
      }
    },

    finish(res) {
      if (Game.ending) return;
      Game.ending = true;
      EB.Save.recordBattle(res);
      EB.Track.battle(res, Game.cfg);
      EB.Audio.music(null);
      EB.Audio.sfx(res.winner === 'player' ? 'victory' : 'defeat');
      const cb = Game.onEnd;
      setTimeout(() => {
        if (Game.battle && Game.battle.result === res) {
          Game.stopBattle();
          if (cb) cb(res);
        }
      }, 1700);
    },

    stopBattle() {
      cancelAnimationFrame(Game.raf);
      if (Game.input) Game.input.detach();
      Game.input = null;
      Game.battle = null;
      Game.renderer = null;
      Game.paused = false;
    },

    gestureHelp(fromPause) {
      Game.paused = true;
      const row = (g, a) => `<div class="item"><div class="gest">${g}</div><div class="grow"><div class="t">${a}</div></div></div>`;
      const drag = Game.scheme() === 'drag';
      const box = modal.open(`<h2 style="text-align:center">Touch Controls</h2>
        <p class="small dim" style="text-align:center">Use your finger anywhere on the arena.</p>
        <div class="list">${drag ? `
          ${row('&larr; drag &rarr;', 'Move the block one column per step')}
          ${row('tap', 'Rotate clockwise')}
          ${row('&#x21bb; circle', 'Draw a circle: rotate in that direction')}` : `
          ${row('tap a column', 'The block moves to that column')}
          ${row('tap it again', 'Drop it there')}
          ${row('tap the block', 'Rotate clockwise')}
          ${row('&larr; slide &rarr;', 'Move the block slowly, one column at a time')}`}
          ${row('drag &darr;', 'Lower the block slowly: it follows your finger')}
          ${row('&darr; then &larr;&rarr;', 'Without lifting: slide it into a gap')}
          ${row('flick &darr;', 'Hard drop straight down')}
          ${row('flick &uarr;', 'Hold / swap card')}
          ${row('2-finger tap', 'Rotate counter-clockwise')}
          ${row('tap your hero', 'Use the hero skill when its meter glows')}
        </div>
        <div class="row center mt"><button class="btn primary" data-act="ok">Got it!</button></div>
        <p class="tiny dim" style="text-align:center">Settings &rarr; Controls changes the touch scheme.</p>`, true);
      bind(box.parentElement, {
        ok() {
          EB.Save.settings.touchHelpV2 = true; EB.Save.write();
          modal.close();
          if (fromPause) Game.pause(); else Game.paused = false;
        },
      });
    },

    togglePause() { if (Game.paused) Game.resume(); else Game.pause(); },

    pause() {
      const b = Game.battle;
      if (!b || b.state === 'over' || Game.paused) return;
      Game.paused = true;
      if (Game.input) Game.input.releaseAll();
      const st = EB.Save.settings;
      const box = modal.open(`<h2 style="text-align:center">PAUSED</h2>
        <div class="set-row"><span>Music</span><input type="range" min="0" max="1" step="0.05" value="${st.music}" data-v="music"></div>
        <div class="set-row"><span>Sound</span><input type="range" min="0" max="1" step="0.05" value="${st.sfx}" data-v="sfx"></div>
        <div class="list mt">
          <button class="btn primary wide" data-act="resume">Resume</button>
          <button class="btn wide" data-act="help">How to Play</button>
          ${Game.scheme() && Game.isTouch() ? '<button class="btn wide" data-act="gest">Touch Controls</button>' : ''}
          <button class="btn wide" data-act="quit">${Game.cfg.mode === 'run' ? 'Retreat to map' : 'Quit to menu'}</button>
        </div>
        <p class="tiny dim mt" style="text-align:center">${Game.cfg.mode === 'run' ? 'Retreating does not cost HP, but you must fight this battle again.' : ''}</p>`, true);
      box.querySelectorAll('[data-v]').forEach((inp) => {
        inp.oninput = () => { st[inp.dataset.v] = parseFloat(inp.value); EB.Audio.setVolume(inp.dataset.v, st[inp.dataset.v]); };
        inp.onchange = () => EB.Save.write();
      });
      bind(box.parentElement, {
        resume: () => Game.resume(),
        gest() { Game.paused = false; Game.gestureHelp(true); },
        help() {
          const b2 = modal.open(`<h2>Quick Help</h2><p class="small">Clear 2+ lines to attack. Clear while garbage is incoming to cancel it.
            Don't let your stack reach the dashed red danger line at your outer edge. After 2:00 the lower stack wins.</p>
            <p class="small">Fill an element's energy bar to trigger its Burst. Mix two elements in one clear for a Reaction.</p>
            <div class="row center"><button class="btn primary" data-act="ok">Back</button></div>`, true);
          bind(b2.parentElement, { ok: () => { Game.paused = false; Game.pause(); } });
        },
        quit() {
          const mode = Game.cfg.mode;
          modal.close();
          Game.stopBattle();
          EB.Audio.music(null);
          if (mode === 'run') EB.UI.map(); else EB.UI.title();
        },
      });
    },

    resume() {
      modal.close();
      Game.paused = false;
    },
  };

  EB.Game = Game;
  window.addEventListener('DOMContentLoaded', () => Game.boot());
})(globalThis.EB = globalThis.EB || {});
