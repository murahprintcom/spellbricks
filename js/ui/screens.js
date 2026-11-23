// UI Manager: every non-battle screen and the run flow between them.
(function (EB) {
  'use strict';
  const { ico, cardHTML, relicIcon, relicItem, portraitURL, modal, toast, bind, pickCard, hpBar, esc } = EB.UIC;
  const Run = () => EB.Run;
  const save = () => EB.Save;
  const DIFF = ['Easy', 'Normal', 'Hard'];

  const UI = {
    root() { return document.getElementById('screen'); },

    show(html, handlers) {
      EB.Game.hideBattle();
      const r = UI.root();
      r.classList.remove('hidden');
      r.innerHTML = html;
      r.scrollTop = 0;
      bind(r, handlers || {});
      const first = r.querySelector('.btn.primary, .btn');
      if (first && !('ontouchstart' in window)) first.focus({ preventScroll: true });
    },

    back() { UI.title(); },

    // ================= TITLE =================
    title() {
      const run = save().run;
      EB.Audio.music('menu');
      UI.show(`<div class="title-screen">
        <canvas id="titleBg"></canvas>
        <div class="logo"><h1 class="sr-only">Spellbricks</h1><span class="logo-art" id="logoArt"></span><span class="tag">Every block is a card. Every line is an attack.</span></div>
        <div class="hero-strip" aria-hidden="true">${['ember_imp', 'tide_sprite'].map((k) => `<img src="${portraitURL(k, 4)}" alt="">`).join('')}<img src="${EB.Pix.portraitURL('hero', 4)}" alt="" style="width:60px;height:73px">${['mud_slime', 'volt_wisp'].map((k) => `<img src="${portraitURL(k, 4)}" alt="">`).join('')}</div>
        <div class="menu">
          <button class="btn primary" data-act="play">${ico('sword', 32)} New Run</button>
          <button class="btn" data-act="cont" ${run && run.status === 'map' ? '' : 'disabled'}>${ico('campfire', 32)} Continue Run${run && run.status === 'map' ? ` <span class="tiny dim">D${(run.dungeon || 0) + 1} F${Math.max(1, run.floor + 1)}</span>` : ''}</button>
          <button class="btn" data-act="quick">${ico('lightning', 32)} Quick Battle</button>
          <div class="row" style="gap:0">
            <button class="btn sm grow" data-act="deck">${ico('deck', 32)} Deck</button>
            <button class="btn sm grow" data-act="cards">${ico('card', 32)} Cards</button>
          </div>
          <div class="row" style="gap:0">
            <button class="btn sm grow" data-act="relics">${ico('gem', 32)} Relics</button>
            <button class="btn sm grow" data-act="stats">${ico('crown', 32)} Stats</button>
          </div>
          <div class="row" style="gap:0">
            <button class="btn sm grow" data-act="settings">${ico('hammer', 32)} Settings</button>
            <button class="btn sm grow" data-act="howto">${ico('question', 32)} How to Play</button>
          </div>
        </div>
        <div class="footer-note">Arrows / WASD move · Up/X rotate · Space drop · Shift hold · Esc pause</div>
      </div>`, {
        play() {
          if (run && run.status === 'map') {
            const b = modal.open(`<h2>Abandon current run?</h2><p class="small">You are on floor ${run.floor + 1} with ${run.hp} HP. Starting a new run will end it.</p>
              <div class="row center mt"><button class="btn" data-act="no">Keep it</button><button class="btn primary" data-act="yes">New Run</button></div>`, true);
            bind(b.parentElement, { no: () => modal.close(), yes: () => { modal.close(); UI.newRun(); } });
          } else UI.newRun();
        },
        cont() { UI.map(); },
        quick: () => UI.quick(),
        deck: () => UI.deck(UI.title),
        cards: () => UI.collection(),
        relics: () => UI.relicCollection(),
        stats: () => UI.stats(),
        settings: () => UI.settings(UI.title),
        howto: () => UI.howto(UI.title),
      });
      titleAnim();
      const la = document.getElementById('logoArt');
      if (la) { const c = EB.Pix.logo(2); c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'Spellbricks'); la.appendChild(c); }
    },

    // ================= NEW RUN =================
    newRun() {
      let diff = 1;
      let hero = EB.HEROES[save().settings.lastHero] && EB.heroUnlocked(save().settings.lastHero) ? save().settings.lastHero : EB.unlockedHeroes()[0];
      const render = () => UI.show(`<div class="wrap">
        <h2>New Run</h2>
        <h3>Choose your hero</h3>
        <div class="heroes-pick">${EB.HERO_IDS.map((id) => UI.heroCard(id, id === hero)).join('')}</div>
        <div class="panel"><p class="small">Fight through <b>${EB.DUNGEONS.length} dungeons</b> of 8 floors each: ${EB.DUNGEONS.map((d) => `<b style="color:${d.color}">${d.name}</b>`).join(', ')}.
          Each ends with a boss; the last is the <b style="color:var(--legendary)">${EB.ENEMIES[EB.DUNGEONS[EB.DUNGEONS.length - 1].pools.boss[0]].name}</b>. Beating a boss heals half your missing HP and lets you pick a relic.
          You start with ${EB.CONFIG.RUN_HP} HP and your hero's 12-card deck. Win battles to earn new cards, upgrades and relics.
          You lose HP from garbage you receive, and more when you lose a battle. At 0 HP the run ends.</p></div>
        <h3>Difficulty</h3>
        <div class="row mb">${DIFF.map((d, i) => `<button class="btn ${i === diff ? 'sel' : ''}" data-act="diff" data-arg="${i}">${d}</button>`).join('')}</div>
        <p class="small dim">${['Gentle opponents. Good for learning.', 'Foes get sharper after floor 3. The boss plays at Hard level.', 'Every foe is a tier smarter and faster. For experts.'][diff]}</p>
        <div class="row mt"><button class="btn" data-act="back">Back</button><button class="btn primary" data-act="go">${ico('sword', 32)} Begin</button></div>
      </div>`, {
        diff(a) { diff = +a; render(); },
        hero(a) { if (EB.heroUnlocked(a)) { hero = a; render(); } },
        back: UI.title,
        go() {
          save().settings.lastHero = hero;
          const run = Run().create({ difficulty: diff, hero });
          save().setRun(run);
          save().profile.stats.runsStarted++;
          save().write();
          if (!save().profile.tutorialSeen) UI.howto(UI.map, true); else UI.map();
        },
      });
      render();
    },

    // hero card for the pick screens
    heroCard(id, selected) {
      const h = EB.HEROES[id];
      if (!EB.heroUnlocked(id)) {
        return `<div class="hero-pick locked" style="--hc:${h.color}">
          <img src="${EB.Pix.silhouetteURL({ hero: id }, 4)}" alt="">
          <span class="hp-body"><span class="hp-name">${esc(h.name.toUpperCase())}</span><span class="hp-title">${esc(h.title)} · ${EB.ELEMENTS[h.element].name}</span>
          <span class="hp-lock">LOCKED</span><span class="hp-line">${esc(h.unlock.text)}</span></span></div>`;
      }
      return `<button class="hero-pick ${selected ? 'sel' : ''}" style="--hc:${h.color}" data-act="hero" data-arg="${id}" aria-pressed="${selected}">
        <img src="${EB.Pix.portraitURL({ hero: id }, 4)}" alt="">
        <span class="hp-body">
          <span class="hp-name">${esc(h.name.toUpperCase())}</span><span class="hp-title">${esc(h.title)} · ${EB.ELEMENTS[h.element].name}</span>
          <span class="hp-line"><b>Passive · ${esc(h.passive.name)}:</b> ${esc(h.passive.desc)}</span>
          <span class="hp-line"><b>Skill · ${esc(h.skill.name)} (${h.skill.charge} lines):</b> ${esc(h.skill.desc)}</span>
          <span class="hp-deck">${h.deck.map((c) => `<img src="${EB.Pix.shapeURL(EB.CARDS[c].shape, EB.CARDS[c].element, 8)}" alt="${esc(EB.CARDS[c].name)}" title="${esc(EB.CARDS[c].name)}">`).join('')}</span>
        </span>
      </button>`;
    },

    // ================= QUICK BATTLE =================
    quick() {
      const st = save().settings;
      let lvl = st.quickLevel != null ? st.quickLevel : 1;
      let deck = EB.PRESET_DECKS[st.quickDeck] ? st.quickDeck : 'chaos';
      let foe = st.quickFoe && EB.ENEMIES[st.quickFoe] ? st.quickFoe : 'volt_wisp';
      let hero = st.quickHero === '' || (EB.HEROES[st.quickHero] && EB.heroUnlocked(st.quickHero)) ? (st.quickHero || '') : 'ignis';
      const render = () => {
        const p = EB.PRESET_DECKS[deck];
        UI.show(`<div class="wrap">
          <div class="row spread"><h2>Quick Battle</h2><button class="btn sm" data-act="back">Back</button></div>
          <h3>AI Difficulty</h3>
          <div class="row mb">${EB.AI_LEVELS.map((l, i) => `<button class="btn ${i === lvl ? 'sel' : ''}" data-act="lvl" data-arg="${i}">${l.name}</button>`).join('')}</div>
          <h3>Hero <span class="tiny">(passive + skill)</span></h3>
          <div class="row mb"><button class="btn sm ${hero === '' ? 'sel' : ''}" data-act="qhero" data-arg="">None</button>${EB.HERO_IDS.map((id) => EB.heroUnlocked(id)
            ? `<button class="btn sm ${id === hero ? 'sel' : ''}" data-act="qhero" data-arg="${id}"><img class="foe-ico" src="${EB.Pix.portraitURL({ hero: id }, 2)}" alt="">${esc(EB.HEROES[id].name)}</button>`
            : `<button class="btn sm" disabled title="${esc(EB.HEROES[id].unlock.text)}"><img class="foe-ico" src="${EB.Pix.silhouetteURL({ hero: id }, 2)}" alt="">LOCKED</button>`).join('')}</div>
          <h3>Your Deck</h3>
          <div class="row mb">${Object.keys(EB.PRESET_DECKS).map((k) => {
            const d = EB.PRESET_DECKS[k];
            return `<button class="btn sm ${k === deck ? 'sel' : ''}" data-act="deck" data-arg="${k}">${ico(d.el === 'mixed' ? 'gem' : d.el, 32)}${esc(d.name)}</button>`;
          }).join('')}</div>
          <div class="cards mb">${p.cards.map((id) => cardHTML(id, { small: true })).join('')}</div>
          <h3>Opponent</h3>
          <div class="row mb">${Object.keys(EB.ENEMIES).map((k) => `<button class="btn sm ${k === foe ? 'sel' : ''}" data-act="foe" data-arg="${k}"><img class="foe-ico" src="${portraitURL(k, 2)}" alt="">${esc(EB.ENEMIES[k].name)}</button>`).join('')}</div>
          <div class="row center mt"><button class="btn primary" data-act="fight">${ico('sword', 32)} FIGHT</button></div>
        </div>`, {
          back: UI.title,
          lvl(a) { lvl = +a; render(); },
          deck(a) { deck = a; render(); },
          foe(a) { foe = a; render(); },
          qhero(a) { if (!a || EB.heroUnlocked(a)) { hero = a; render(); } },
          fight() {
            st.quickLevel = lvl; st.quickDeck = deck; st.quickFoe = foe; st.quickHero = hero; save().write();
            UI.startQuick(lvl, deck, foe, hero);
          },
        });
      };
      render();
    },

    startQuick(lvl, deck, foe, hero) {
      const e = EB.ENEMIES[foe];
      const cfg = {
        mode: 'quick',
        player: { name: hero ? EB.HEROES[hero].name : 'You', hero: hero || null, cards: EB.PRESET_DECKS[deck].cards.map((id) => EB.makeCard(id)), relics: [], portrait: hero ? { hero } : 'hero' },
        enemy: { name: e.name, cards: EB.enemyDeck(e), relics: e.relics || [], level: lvl, speed: e.tier === 'boss' ? EB.CONFIG.BOSS_SPEED : 1, portrait: { enemy: foe } },
        label: 'QUICK BATTLE', playerSub: EB.PRESET_DECKS[deck].name.toUpperCase() + ' DECK', enemySub: EB.AI_LEVELS[lvl].name.toUpperCase() + ' AI',
        music: e.tier === 'boss' ? 'boss' : 'battle',
      };
      save().profile.enemies[foe] = true;
      EB.Game.startBattle(cfg, (res) => UI.result(res, { quick: true, rematch: () => UI.startQuick(lvl, deck, foe, hero) }));
    },

    // ================= RUN: TOP BAR + MAP =================
    topbar(run) {
      return `<div class="topbar">
        <div class="stat">${ico('heart', 32)}<span>${run.hp}/${run.maxHp}</span>${hpBar(run)}</div>
        <div class="stat">${ico('coin', 32)}<span>${run.gold}</span></div>
        <div class="stat">${ico('deck', 32)}<span>${run.deck.length}</span></div>
        <div class="relics">${run.relics.map((r) => relicIcon(r, 32)).join('')}</div>
        <div class="grow"></div>
        <button class="btn sm" data-act="viewDeck">Deck</button>
        <button class="btn sm" data-act="menu">Menu</button>
      </div>`;
    },
    topHandlers(back) {
      return {
        viewDeck: () => UI.deck(back),
        menu: () => { save().write(); UI.title(); },
      };
    },

    map() {
      const run = save().run;
      if (!run) return UI.title();
      if (run.status === 'lost' || run.status === 'won') return UI.runEnd(run.status === 'won');
      if (run.clearReward) return UI.dungeonCleared(); // boss beaten, next dungeon not entered yet
      EB.Audio.music('menu');
      const floors = run.map.floors;
      const F = floors.length;
      const cur = Run().currentNode(run);
      const pending = cur && !run.nodeDone;
      const avail = pending ? [] : Run().choices(run);
      const visited = new Set(run.path.map(([f, i]) => f + ':' + i));
      const pos = (n) => ({ x: 8 + n.x * 84, y: 100 - ((n.floor + 0.5) / F) * 100 });
      let lines = '';
      for (const fl of floors) for (const n of fl) for (const j of n.next) {
        const m = floors[n.floor + 1][j];
        const a = pos(n), b = pos(m);
        const on = visited.has(n.floor + ':' + n.idx) && visited.has(m.floor + ':' + m.idx);
        lines += `<line x1="${a.x}%" y1="${a.y}%" x2="${b.x}%" y2="${b.y}%" stroke="${on ? '#ffd35c' : '#7a9a7e'}" stroke-width="${on ? 4 : 3}" stroke-dasharray="${on ? '0' : '6 6'}"/>`;
      }
      let nodes = '';
      for (const fl of floors) for (const n of fl) {
        const t = EB.NODE_TYPES[n.type];
        const key = n.floor + ':' + n.idx;
        const isCur = cur && cur.floor === n.floor && cur.idx === n.idx;
        const isAvail = (run.floor + 1 === n.floor && avail.includes(n.idx)) || (isCur && pending);
        const cls = ['node', n.type === 'boss' ? 'boss' : '', visited.has(key) && !isCur ? 'done' : '', isCur ? 'cur' : '', isAvail ? 'avail' : '', !isAvail && !visited.has(key) ? 'locked' : ''].join(' ');
        const p = pos(n);
        const label = n.enemy ? EB.ENEMIES[n.enemy].name : t.name;
        nodes += `<button class="${cls}" style="left:${p.x}%;top:${p.y}%;--nc:${t.color};background-image:url(${EB.Pix.iconURL(t.icon, 64)})" ${isAvail ? `data-act="node" data-arg="${n.idx}"` : 'tabindex="-1"'} title="${esc(t.name + ': ' + t.desc)}" aria-label="${esc(t.name)}"><span class="lbl">${esc(label)}</span></button>`;
      }
      const height = Math.max(560, F * 86);
      const dun = EB.dungeonOf(run);
      UI.show(`${UI.topbar(run)}<div class="wrap">
        <div class="row spread"><h2 style="color:${dun.color}">${ico(dun.icon, 32)} Dungeon ${(run.dungeon || 0) + 1}/${EB.DUNGEONS.length}: ${esc(dun.name)}</h2><span class="small dim">${DIFF[run.difficulty]} run</span></div>
        <p class="small">Floor ${Math.max(1, run.floor + 1)} / ${F} <span class="dim">· ${esc(dun.blurb)}</span></p>
        <p class="small dim">${pending ? 'Finish the current encounter.' : run.floor < 0 ? 'Choose where to begin. The path climbs upward to the boss.' : 'Choose your next destination.'}</p>
        <div class="legend mb">${Object.values(EB.NODE_TYPES).map((t) => `<span>${ico(t.icon, 32)}${t.name}</span>`).join('')}</div>
        <div class="map" style="height:${height}px;background:radial-gradient(ellipse at 50% 8%, ${EB.util.rgba(dun.color, 0.16)}, transparent 60%)"><svg>${lines}</svg>${nodes}</div>
      </div>`, Object.assign(UI.topHandlers(UI.map), {
        node(idx) {
          if (!pending) { Run().enter(run, +idx); save().setRun(run); }
          UI.openNode();
        },
      }));
      // scroll so the current floor is visible
      const target = UI.root().querySelector('.node.avail, .node.cur');
      if (target) target.scrollIntoView({ block: 'center' });
    },

    openNode() {
      const run = save().run;
      const n = Run().currentNode(run);
      if (!n) return UI.map();
      switch (n.type) {
        case 'battle': case 'elite': case 'boss': return UI.preBattle(n);
        case 'shop': return UI.shop(n);
        case 'event': return UI.event(n);
        case 'rest': return UI.rest();
        case 'upgrade': return UI.forge();
      }
    },

    completeNode() {
      const run = save().run;
      run.nodeDone = true;
      save().setRun(run);
      UI.map();
    },

    // ================= BATTLE (run) =================
    preBattle(node) {
      const run = save().run;
      const en = Run().enemyFor(run, node);
      const e = en.def;
      const tierCol = { normal: '#d9dde6', elite: '#ff6a5a', boss: '#ffb02a' }[en.tier];
      const elName = e.el === 'mixed' ? 'All elements' : EB.ELEMENTS[e.el].name;
      UI.show(`${UI.topbar(run)}<div class="wrap">
        <div class="panel"><div class="row" style="gap:22px;align-items:flex-start">
          <img class="enemy-portrait" src="${portraitURL(en.id, 12)}" alt="">
          <div class="grow">
            <span class="pill" style="color:${tierCol}">${en.tier.toUpperCase()}</span>
            <span class="pill" style="color:var(--dim)">${EB.AI_LEVELS[en.level].name.toUpperCase()} AI${en.speed !== 1 ? ' · SPEED ' + en.speed.toFixed(2) : ''}</span>
            <h1 style="margin-top:10px">${esc(e.name)}</h1>
            <p class="quote">“${esc(e.quote)}”</p>
            <p class="small dim">Element: ${elName} · Deck: ${e.deck.length} cards</p>
            ${(e.relics || []).length ? `<div class="small">Relics:</div><div class="list" style="margin-top:6px">${e.relics.map((r) => relicItem(r)).join('')}</div>` : ''}
          </div>
        </div></div>
        <div class="panel small">
          <b>You are at the TOP</b> — your blocks fall down toward the centre. The enemy is at the BOTTOM.
          Clear 2+ lines to send garbage. Clearing lines while garbage is incoming cancels it.
          Reach the danger line and you lose. When time runs out, the lower stack wins.
        </div>
        <div class="row center"><button class="btn" data-act="viewDeck">View Deck</button><button class="btn primary" data-act="fight">${ico('sword', 32)} FIGHT!</button></div>
      </div>`, Object.assign(UI.topHandlers(() => UI.preBattle(node)), {
        fight() { UI.startRunBattle(node); },
      }));
    },

    startRunBattle(node) {
      const run = save().run;
      const en = Run().enemyFor(run, node);
      const e = en.def;
      save().profile.enemies[en.id] = true;
      const cfg = {
        mode: 'run', tier: en.tier,
        player: { name: run.hero ? EB.HEROES[run.hero].name : 'You', hero: run.hero || null, cards: run.deck, relics: run.relics, energy: run.blessings, portrait: run.hero ? { hero: run.hero } : 'hero' },
        enemy: { name: e.name, cards: EB.enemyDeck(e), relics: e.relics || [], level: en.level, speed: en.speed, portrait: { enemy: en.id } },
        label: `D${(run.dungeon || 0) + 1} F${node.floor + 1} · ${EB.NODE_TYPES[node.type].name.toUpperCase()}`,
        theme: EB.dungeonOf(run).color,
        playerSub: `HP ${run.hp}/${run.maxHp}`,
        enemySub: `${en.tier.toUpperCase()} · ${EB.AI_LEVELS[en.level].name.toUpperCase()}`,
        music: en.tier === 'boss' ? 'boss' : 'battle',
      };
      EB.Game.startBattle(cfg, (res) => {
        const out = Run().afterBattle(run, res, en.tier);
        // achievement: bosses beaten in this run (unlocks heroes)
        if (res.winner === 'player' && en.tier === 'boss') {
          const pr = save().profile;
          pr.maxDungeonCleared = Math.max(pr.maxDungeonCleared || 0, (run.dungeon || 0) + 1);
          save().write();
        }
        save().setRun(run);
        UI.result(res, { run, out, node, tier: en.tier });
      });
    },

    result(res, ctx) {
      const win = res.winner === 'player', draw = res.winner === 'draw';
      const p = res.player, a = res.ai;
      const mins = Math.max(res.duration, 1) / 60;
      const rows = [
        ['Match time', EB.util.fmtTime(res.duration), ''],
        ['Lines cleared', p.lines, a.lines],
        ['Attack lines sent', p.sent, a.sent],
        ['Garbage received', p.received, a.received],
        ['Garbage countered', p.cancelled + p.absorbed, a.cancelled + a.absorbed],
        ['Highest combo', p.maxCombo, a.maxCombo],
        ['4-line clears', p.quads, a.quads],
        ['Pieces placed', p.pieces, a.pieces],
        ['Pieces / minute', Math.round(p.pieces / mins), Math.round(a.pieces / mins)],
        ['Reactions · Bursts', p.reactions + ' · ' + p.bursts, a.reactions + ' · ' + a.bursts],
        ['Final stack height', p.height, a.height],
      ];
      let runInfo = '', actions = '';
      const h = {};
      if (ctx.quick) {
        actions = `<button class="btn" data-act="menu">Menu</button><button class="btn" data-act="setup">Change Setup</button><button class="btn primary" data-act="again">Rematch</button>`;
        h.menu = UI.title; h.setup = UI.quick; h.again = ctx.rematch;
      } else {
        const run = ctx.run, out = ctx.out;
        runInfo = `<div class="row center mt small">
          <span>${ico('heart', 32)} -${out.damage} HP → ${run.hp}/${run.maxHp}</span>
          ${out.gold ? `<span>${ico('coin', 32)} +${out.gold} gold</span>` : ''}
        </div>`;
        if (run.status === 'lost') {
          actions = `<button class="btn primary" data-act="end">Continue</button>`;
          h.end = () => UI.runEnd(false);
        } else if (win) {
          actions = `<button class="btn primary" data-act="reward">${ico('gem', 32)} Choose Reward</button>`;
          h.reward = () => UI.rewards(ctx.tier);
        } else if (ctx.tier === 'boss') {
          actions = `<button class="btn primary" data-act="retry">Try the boss again</button>`;
          h.retry = () => UI.map();
        } else {
          actions = `<button class="btn primary" data-act="cont">Continue</button>`;
          h.cont = () => UI.completeNode();
        }
      }
      UI.show(`<div class="wrap">
        <div class="result-title ${win ? 'win' : 'lose'}">${win ? 'VICTORY!' : draw ? 'DRAW' : 'DEFEAT'}</div>
        <p class="center small dim" style="text-align:center">${esc(res.reason)}</p>
        <div class="panel"><div class="statgrid">
          <span class="h"></span><span class="h you">YOU</span><span class="h foe">FOE</span>
          ${rows.map(([k, x, y]) => `<span class="small">${k}</span><span class="you">${x}</span><span class="foe">${y}</span>`).join('')}
        </div>${runInfo}</div>
        <div class="row center">${actions}</div>
      </div>`, h);
    },

    // ================= REWARDS =================
    rewards(tier) {
      const run = save().run;
      const opts = Run().rewards(run, tier);
      save().setRun(run);
      opts.forEach((o) => { if (o.type === 'card') save().discoverCard(o.cardId); if (o.type === 'relic') save().discoverRelic(o.relicId); });
      const finish = () => {
        if (tier === 'boss' && !Run().lastDungeon(run)) UI.dungeonCleared();
        else if (tier === 'boss') { run.status = 'won'; save().setRun(run); UI.runEnd(true); }
        else UI.completeNode();
      };
      const render = () => UI.show(`${UI.topbar(run)}<div class="wrap">
        <h2 class="center" style="text-align:center">Choose a Reward</h2>
        <p class="small dim" style="text-align:center">Pick one. Choose wisely — it shapes your deck.</p>
        <div class="rewards mt">${opts.map((o, i) => {
          const d = Run().describeReward(o);
          let art = '';
          if (o.type === 'card') art = cardHTML(o.cardId, { small: true });
          else if (o.type === 'relic') art = `<img class="big" src="${EB.Pix.iconURL(EB.RELICS[o.relicId].icon, 64)}" alt="">`;
          else art = `<img class="big" src="${EB.Pix.iconURL({ gold: 'coin', heal: 'heart', upgrade: 'hammer', remove: 'skull', blessing: o.el || 'gem' }[o.type], 64)}" alt="">`;
          return `<button class="reward" data-act="pick" data-arg="${i}"><span class="kind">${d.title.toUpperCase()}</span>${art}<span class="rname">${esc(d.name)}</span><span class="rdesc">${esc(d.desc)}</span></button>`;
        }).join('')}</div>
        <div class="row center mt"><button class="btn ghost" data-act="skip">Skip reward</button></div>
      </div>`, Object.assign(UI.topHandlers(render), {
        skip: finish,
        pick(i) {
          const o = opts[+i];
          if (o.type === 'upgrade') {
            pickCard(run, 'Upgrade a card', (c) => (c.lvl || 1) < 2, { title: 'Upgrade?', ok: 'Upgrade', after: true }).then((uid) => {
              if (!uid) return;
              Run().upgradeCard(run, uid); save().setRun(run); toast('Card upgraded!'); EB.Audio.sfx('buy'); finish();
            });
            return;
          }
          if (o.type === 'remove') {
            pickCard(run, 'Remove a card', null, { title: 'Remove this card?', ok: 'Remove', arrow: '✕' }).then((uid) => {
              if (!uid) return;
              Run().removeCard(run, uid); save().setRun(run); toast('Card removed.'); finish();
            });
            return;
          }
          Run().applyReward(run, o);
          if (o.type === 'card') save().discoverCard(o.cardId);
          if (o.type === 'relic') save().discoverRelic(o.relicId);
          save().setRun(run);
          EB.Audio.sfx('buy');
          toast(Run().describeReward(o).name + '!');
          finish();
        },
      }));
      render();
    },

    // ================= SHOP =================
    shop(node) {
      const run = save().run;
      const shop = Run().shop(run, node);
      save().setRun(run);
      shop.cards.forEach((c) => save().discoverCard(c.cardId));
      const render = () => UI.show(`${UI.topbar(run)}<div class="wrap">
        <div class="row spread"><h2>${ico('coin', 32)} Shop</h2><button class="btn" data-act="leave">Leave</button></div>
        <p class="small dim">"Fine blocks, fresh from the quarry. No refunds."</p>
        <h3 class="mt">Cards</h3>
        <div class="cards mb" style="padding-bottom:24px">${shop.cards.map((c, i) => cardHTML(c.cardId, { small: true, pick: !c.sold, sold: c.sold, price: c.price, attrs: c.sold ? '' : `data-act="buyCard" data-arg="${i}"` })).join('')}</div>
        <h3>Relics</h3>
        <div class="list mb">${shop.relics.map((r, i) => relicItem(r.relicId, r.sold ? '<span class="small dim">SOLD</span>' : `<button class="btn sm" data-act="buyRelic" data-arg="${i}" ${run.gold < r.price ? 'disabled' : ''}>${ico('coin', 32)}${r.price}</button>`)).join('') || '<p class="dim small">Sold out.</p>'}</div>
        <h3>Services</h3>
        <div class="list">
          <div class="item">${ico('skull', 32)}<div class="grow"><div class="t">Remove a card</div><div class="d">Thin your deck (min ${EB.CONFIG.MIN_DECK} cards).</div></div>
            ${shop.removed ? '<span class="small dim">USED</span>' : `<button class="btn sm" data-act="remove" ${run.gold < shop.removePrice || run.deck.length <= EB.CONFIG.MIN_DECK ? 'disabled' : ''}>${ico('coin', 32)}${shop.removePrice}</button>`}</div>
          <div class="item">${ico('heart', 32)}<div class="grow"><div class="t">Healing tonic</div><div class="d">Restore ${shop.heal.amount} HP.</div></div>
            ${shop.heal.sold ? '<span class="small dim">SOLD</span>' : `<button class="btn sm" data-act="heal" ${run.gold < shop.heal.price || run.hp >= run.maxHp ? 'disabled' : ''}>${ico('coin', 32)}${shop.heal.price}</button>`}</div>
        </div>
      </div>`, Object.assign(UI.topHandlers(render), {
        leave: () => UI.completeNode(),
        buyCard(i) {
          const c = shop.cards[+i];
          if (c.sold) return;
          if (run.gold < c.price) { toast('Not enough gold.'); return; }
          run.gold -= c.price; c.sold = true;
          run.deck.push(EB.makeCard(c.cardId));
          save().setRun(run); EB.Audio.sfx('buy'); toast('Bought ' + EB.CARDS[c.cardId].name);
          render();
        },
        buyRelic(i) {
          const r = shop.relics[+i];
          if (r.sold || run.gold < r.price) return;
          run.gold -= r.price; r.sold = true; run.relics.push(r.relicId);
          save().discoverRelic(r.relicId); save().setRun(run); EB.Audio.sfx('buy'); toast('Got ' + EB.RELICS[r.relicId].name);
          render();
        },
        remove() {
          pickCard(run, 'Remove a card', null, { title: 'Remove this card?', ok: 'Remove', arrow: '✕' }).then((uid) => {
            if (!uid) return;
            run.gold -= shop.removePrice; shop.removed = true; run.removals++;
            Run().removeCard(run, uid); save().setRun(run); toast('Card removed.');
            render();
          });
        },
        heal() {
          run.gold -= shop.heal.price; shop.heal.sold = true;
          run.hp = Math.min(run.maxHp, run.hp + shop.heal.amount);
          save().setRun(run); EB.Audio.sfx('buy'); render();
        },
      }));
      render();
    },

    // ================= EVENT =================
    event(node) {
      const run = save().run;
      const ev = Run().pickEvent(run, node);
      save().setRun(run);
      const rng = Run().rng(run);
      const api = {
        rng,
        randomCard: (o) => Run().randomCard(rng, o),
        addCard: (id) => { run.deck.push(EB.makeCard(id)); save().discoverCard(id); },
        randomRelic: () => Run().randomRelic(run, rng),
        addRelic: (id) => { run.relics.push(id); save().discoverRelic(id); },
        upgradeRandom(n) {
          const ups = rng.shuffle(Run().upgradable(run).slice());
          ups.slice(0, n).forEach((c) => Run().upgradeCard(run, c.uid));
          return Math.min(n, ups.length);
        },
        pickUpgrade: () => pickCard(run, 'Upgrade a card', (c) => (c.lvl || 1) < 2, { title: 'Upgrade?', ok: 'Upgrade', after: true })
          .then((uid) => (uid && Run().upgradeCard(run, uid) ? 'The hammer rings. Your card grows stronger.' : 'You leave the anvil untouched.')),
        pickRemove: () => pickCard(run, 'Remove a card', null, { title: 'Wash away this card?', ok: 'Remove', arrow: '✕' })
          .then((uid) => (uid && Run().removeCard(run, uid) ? 'The card dissolves in the spring.' : 'You change your mind.')),
        transformStone() {
          const stones = run.deck.filter((c) => EB.CARDS[c.id].element === 'neutral');
          const c = rng.pick(stones);
          const shape = EB.CARDS[c.id].shape;
          const pool = EB.CARD_IDS.filter((id) => EB.CARDS[id].shape === shape && EB.CARDS[id].element !== 'neutral' && EB.CARDS[id].rarity !== 'legendary');
          const old = EB.CARDS[c.id].name;
          c.id = rng.pick(pool);
          save().discoverCard(c.id);
          return `${old} is reforged into ${EB.CARDS[c.id].name}!`;
        },
        pickCardFrom: (n, minR) => new Promise((resolve) => {
          const ids = [];
          for (let i = 0; i < n; i++) ids.push(Run().randomCard(rng, { minRarity: minR, tier: 'elite', exclude: ids }));
          ids.forEach((id) => save().discoverCard(id));
          const b = modal.open(`<h2>Choose a card</h2><div class="cards">${ids.map((id, i) => cardHTML(id, { pick: true, attrs: `data-act="p" data-arg="${i}"` })).join('')}</div>
            <div class="row center mt"><button class="btn ghost" data-act="skip">Skip</button></div>`);
          bind(b.parentElement, {
            p(i) { modal.close(); api.addCard(ids[+i]); resolve(`You learn ${EB.CARDS[ids[+i]].name}.`); },
            skip() { modal.close(); resolve('You put the book back.'); },
          });
        }),
      };
      const done = (text) => {
        Run().saveRng(run, rng);
        save().setRun(run);
        UI.show(`${UI.topbar(run)}<div class="wrap"><div class="panel center" style="text-align:center">
          <img src="${EB.Pix.iconURL(ev.icon, 64)}" width="64" height="64" alt=""><h2 class="mt">${esc(ev.title)}</h2><p class="small">${esc(text)}</p>
          <button class="btn primary mt" data-act="cont">Continue</button></div></div>`, Object.assign(UI.topHandlers(() => done(text)), { cont: () => UI.completeNode() }));
      };
      const render = () => UI.show(`${UI.topbar(run)}<div class="wrap"><div class="panel">
        <div class="row" style="gap:16px"><img src="${EB.Pix.iconURL(ev.icon, 64)}" width="64" height="64" alt=""><h2 style="margin:0">${esc(ev.title)}</h2></div>
        <p class="small mt">${esc(ev.text)}</p>
        <div class="list mt">${ev.options.map((o, i) => {
          const ok = !o.can || o.can(run);
          return `<button class="btn wide" style="justify-content:space-between;text-align:left" data-act="opt" data-arg="${i}" ${ok ? '' : 'disabled'}><span>${esc(o.label)}</span><span class="tiny dim">${esc(o.desc)}</span></button>`;
        }).join('')}</div>
      </div></div>`, Object.assign(UI.topHandlers(render), {
        opt(i) {
          const o = ev.options[+i];
          Promise.resolve(o.run(run, api)).then(done);
        },
      }));
      render();
    },

    // ================= REST / FORGE =================
    rest() {
      const run = save().run;
      const heal = Math.round(run.maxHp * 0.3);
      const render = () => UI.show(`${UI.topbar(run)}<div class="wrap"><div class="panel" style="text-align:center">
        <img src="${EB.Pix.iconURL('campfire', 64)}" width="64" height="64" alt=""><h2 class="mt">Rest Site</h2>
        <p class="small dim">The fire crackles. Embers drift upward like tiny falling blocks in reverse.</p>
        <div class="row center mt">
          <button class="btn good" data-act="heal" ${run.hp >= run.maxHp ? 'disabled' : ''}>${ico('heart', 32)} Rest: heal ${heal} HP</button>
          <button class="btn" data-act="up" ${Run().upgradable(run).length ? '' : 'disabled'}>${ico('hammer', 32)} Smith: upgrade a card</button>
        </div>
      </div></div>`, Object.assign(UI.topHandlers(render), {
        heal() { run.hp = Math.min(run.maxHp, run.hp + heal); save().setRun(run); toast('+' + heal + ' HP'); UI.completeNode(); },
        up() {
          pickCard(run, 'Upgrade a card', (c) => (c.lvl || 1) < 2, { title: 'Upgrade?', ok: 'Upgrade', after: true }).then((uid) => {
            if (!uid) return;
            Run().upgradeCard(run, uid); save().setRun(run); EB.Audio.sfx('buy'); UI.completeNode();
          });
        },
      }));
      render();
    },

    forge() {
      const run = save().run;
      const render = () => UI.show(`${UI.topbar(run)}<div class="wrap"><div class="panel" style="text-align:center">
        <img src="${EB.Pix.iconURL('hammer', 64)}" width="64" height="64" alt=""><h2 class="mt">The Forge</h2>
        <p class="small dim">A master smith offers to improve one card, free of charge.</p>
        <div class="row center mt"><button class="btn primary" data-act="up" ${Run().upgradable(run).length ? '' : 'disabled'}>${ico('hammer', 32)} Upgrade a card</button><button class="btn ghost" data-act="skip">Leave</button></div>
      </div></div>`, Object.assign(UI.topHandlers(render), {
        skip: () => UI.completeNode(),
        up() {
          pickCard(run, 'Upgrade a card', (c) => (c.lvl || 1) < 2, { title: 'Upgrade?', ok: 'Upgrade', after: true }).then((uid) => {
            if (!uid) return;
            Run().upgradeCard(run, uid); save().setRun(run); EB.Audio.sfx('buy'); UI.completeNode();
          });
        },
      }));
      render();
    },

    // ================= DUNGEON CLEARED =================
    dungeonCleared() {
      const run = save().run;
      const done = EB.dungeonOf(run), next = EB.DUNGEONS[(run.dungeon || 0) + 1];
      if (!run.clearReward) {
        // decided once and saved, so closing the game here can't reroll it
        run.clearReward = { heal: Run().dungeonHeal(run), relics: Run().dungeonRelics(run) };
        run.hp = Math.min(run.maxHp, run.hp + run.clearReward.heal);
        save().profile.stats.dungeonsCleared = (save().profile.stats.dungeonsCleared || 0) + 1;
        save().setRun(run);
      }
      const cr = run.clearReward;
      cr.relics.forEach((r) => save().discoverRelic(r));
      EB.Audio.music('victory');
      const go = () => {
        delete run.clearReward;
        Run().nextDungeon(run);
        save().setRun(run);
        UI.map();
      };
      const render = () => UI.show(`${UI.topbar(run)}<div class="wrap" style="text-align:center">
        <div class="result-title win">DUNGEON CLEARED!</div>
        <p class="small"><b style="color:${done.color}">${esc(done.name)}</b> is behind you. ${cr.heal ? `You rest and recover <b>${cr.heal} HP</b>.` : 'You are at full health.'}</p>
        ${cr.picked ? `<p class="small">You took <b>${esc(EB.RELICS[cr.picked].name)}</b>.</p>` : `
        <h3 class="mt">Choose a relic</h3>
        <div class="list" style="text-align:left;max-width:560px;margin:0 auto">${cr.relics.map((r) => relicItem(r, `<button class="btn sm" data-act="relic" data-arg="${r}">Take</button>`)).join('') || '<p class="dim small">You already own every relic.</p>'}</div>
        <button class="btn ghost mt" data-act="skip">Skip relic</button>`}
        <div class="panel mt" style="text-align:left"><h3 style="color:${next.color}">${ico(next.icon, 32)} Next: ${esc(next.name)}</h3><p class="small">${esc(next.blurb)}</p></div>
        <button class="btn primary" data-act="go" ${cr.picked || cr.skipped || !cr.relics.length ? '' : 'disabled'}>${ico('sword', 32)} Enter ${esc(next.name)}</button>
      </div>`, Object.assign(UI.topHandlers(render), {
        relic(id) { if (cr.picked) return; cr.picked = id; run.relics.push(id); save().setRun(run); EB.Audio.sfx('buy'); render(); },
        skip() { cr.skipped = true; save().setRun(run); render(); },
        go,
      }));
      render();
      setTimeout(() => UI.announceUnlocks(), 300);
    },

    // show any hero unlocked since the last announcement
    announceUnlocks() {
      const pr = save().profile;
      const fresh = EB.unlockedHeroes(pr).filter((id) => EB.HEROES[id].unlock && !pr.heroesAnnounced.includes(id));
      if (!fresh.length) return;
      pr.heroesAnnounced.push(...fresh);
      save().write();
      EB.Audio.sfx('victory');
      const b = modal.open(`<div class="result-title win" style="font-size:22px">HERO UNLOCKED!</div>
        <div class="list mt">${fresh.map((id) => { const h = EB.HEROES[id]; return `<div class="item"><img src="${EB.Pix.portraitURL({ hero: id }, 3)}" alt="" style="width:54px;height:66px">
          <div class="grow"><div class="t" style="color:${h.color}">${esc(h.name)}, ${esc(h.title)}</div><div class="d">${esc(h.skill.name)}: ${esc(h.skill.desc)}</div></div></div>`; }).join('')}</div>
        <p class="small dim mt">Pick them on the New Run screen or in Quick Battle.</p>
        <div class="row center mt"><button class="btn primary" data-act="ok">Great!</button></div>`, true);
      bind(b.parentElement, { ok: () => modal.close() });
    },

    // ================= RUN END =================
    runEnd(won) {
      const run = save().run;
      if (!run) return UI.title();
      const st = save().profile.stats;
      if (!run.recorded) { run.recorded = true; if (won) st.runsWon++; save().write(); }
      setTimeout(() => UI.announceUnlocks(), 300);
      EB.Audio.music(won ? 'victory' : null);
      if (!won) EB.Audio.sfx('defeat');
      const s = run.stats;
      UI.show(`<div class="wrap" style="text-align:center">
        <div class="result-title ${won ? 'win' : 'lose'}">${won ? 'RUN COMPLETE!' : 'RUN OVER'}</div>
        <p class="small dim">${won ? `The ${esc(EB.ENEMIES[EB.DUNGEONS[EB.DUNGEONS.length - 1].pools.boss[0]].name)} falls and the eclipse breaks. All ${EB.DUNGEONS.length} dungeons are cleared.` : `Your stack crumbles in ${esc(EB.dungeonOf(run).name)}. The elements will wait for your return.`}</p>
        <div class="panel" style="text-align:left"><div class="statgrid" style="grid-template-columns:1fr auto">
          <span class="small">Dungeon reached</span><span class="you">${(run.dungeon || 0) + 1} / ${EB.DUNGEONS.length} · ${esc(EB.dungeonOf(run).name)}</span>
          <span class="small">Floors cleared</span><span class="you">${(run.dungeon || 0) * run.map.floors.length + Math.max(0, run.floor + (won ? 1 : 0))} / ${EB.DUNGEONS.length * run.map.floors.length}</span>
          <span class="small">Battles won / lost</span><span class="you">${s.battlesWon} / ${s.battlesLost}</span>
          <span class="small">Lines cleared</span><span class="you">${s.lines}</span>
          <span class="small">Attack sent</span><span class="you">${s.sent}</span>
          <span class="small">Best combo</span><span class="you">${s.bestCombo}</span>
          <span class="small">Reactions</span><span class="you">${s.reactions}</span>
          <span class="small">Final deck</span><span class="you">${run.deck.length} cards · ${run.relics.length} relics</span>
        </div></div>
        <div class="cards">${run.deck.map((c) => cardHTML(c, { small: true })).join('')}</div>
        <div class="row center mt"><button class="btn" data-act="menu">Menu</button><button class="btn primary" data-act="again">New Run</button></div>
      </div>`, {
        menu() { save().setRun(null); UI.title(); },
        again() { save().setRun(null); UI.newRun(); },
      });
    },

    // ================= DECK =================
    deck(back) {
      const run = save().run;
      const cards = run ? run.deck : EB.STARTER_DECK.map((id) => ({ id, lvl: 1, uid: id }));
      const shapes = {}, els = {}, rar = {};
      for (const c of cards) {
        const d = EB.CARDS[c.id];
        shapes[d.shape] = (shapes[d.shape] || 0) + 1;
        els[d.element] = (els[d.element] || 0) + 1;
        rar[d.rarity] = (rar[d.rarity] || 0) + 1;
      }
      const n = cards.length;
      const bars = (obj, keys, colorOf, labelOf) => keys.map((k) => `<div class="row" style="gap:8px;margin:4px 0"><span class="tiny" style="width:92px">${labelOf(k)}</span><div class="bar grow"><i style="width:${Math.round(((obj[k] || 0) / n) * 100)}%;background:${colorOf(k)}"></i></div><span class="tiny" style="width:22px;text-align:right">${obj[k] || 0}</span></div>`).join('');
      const sorted = cards.slice().sort((a, b) => {
        const A = EB.CARDS[a.id], B = EB.CARDS[b.id];
        return (A.element > B.element ? 1 : A.element < B.element ? -1 : 0) || EB.RARITY_ORDER.indexOf(B.rarity) - EB.RARITY_ORDER.indexOf(A.rarity);
      });
      UI.show(`<div class="wrap">
        <div class="row spread"><h2>${run ? 'Your Deck' : 'Starter Deck'} (${n})</h2><button class="btn sm" data-act="back">Back</button></div>
        ${run ? '' : '<p class="small dim">No run in progress. This is the deck every run starts with.</p>'}
        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
          <div class="panel"><h3>Shapes</h3>${bars(shapes, EB.SHAPE_KEYS, () => '#a7b0c2', (k) => k + '-Block')}</div>
          <div class="panel"><h3>Elements</h3>${bars(els, ['neutral'].concat(EB.ELEMENT_IDS), (k) => EB.ELEMENTS[k].color, (k) => EB.ELEMENTS[k].name)}</div>
          <div class="panel"><h3>Rarity</h3>${bars(rar, EB.RARITY_ORDER, (k) => EB.RARITIES[k].color, (k) => EB.RARITIES[k].name)}</div>
        </div>
        ${run && Object.values(run.blessings).some((v) => v) ? `<div class="panel small">Blessings (starting energy): ${EB.ELEMENT_IDS.filter((e) => run.blessings[e]).map((e) => `${ico(e, 32).replace('<img', '<img width="14" height="14"')} ${EB.ELEMENTS[e].name} +${run.blessings[e]}`).join(' · ')}</div>` : ''}
        ${run && run.relics.length ? `<h3>Relics</h3><div class="list mb">${run.relics.map((r) => relicItem(r)).join('')}</div>` : ''}
        <p class="tiny dim">Cards are added, upgraded and removed through rewards, shops, events, forges and rest sites.</p>
        <div class="cards mt">${sorted.map((c) => cardHTML(c, { small: true })).join('')}</div>
      </div>`, { back: () => (back || UI.title)() });
    },

    // ================= COLLECTION =================
    collection() {
      let fe = 'all', fr = 'all';
      const prof = save().profile;
      const render = () => {
        const ids = EB.CARD_IDS.filter((id) => (fe === 'all' || EB.CARDS[id].element === fe) && (fr === 'all' || EB.CARDS[id].rarity === fr));
        const found = EB.CARD_IDS.filter((id) => prof.cards[id]).length;
        UI.show(`<div class="wrap">
          <div class="row spread"><h2>Card Collection ${found}/${EB.CARD_IDS.length}</h2><button class="btn sm" data-act="back">Back</button></div>
          <div class="filters">${['all', 'neutral'].concat(EB.ELEMENT_IDS).map((e) => `<button class="btn ${fe === e ? 'sel' : ''}" data-act="fe" data-arg="${e}">${e === 'all' ? 'All' : EB.ELEMENTS[e].name}</button>`).join('')}</div>
          <div class="filters">${['all'].concat(EB.RARITY_ORDER).map((r) => `<button class="btn ${fr === r ? 'sel' : ''}" data-act="fr" data-arg="${r}" style="${r !== 'all' ? 'color:' + EB.RARITIES[r].color : ''}">${r === 'all' ? 'All' : EB.RARITIES[r].name}</button>`).join('')}</div>
          <p class="tiny dim">Tap a card to inspect it and see its upgrade.</p>
          <div class="cards">${ids.map((id) => cardHTML(id, { small: true, locked: !prof.cards[id], pick: !!prof.cards[id], attrs: prof.cards[id] ? `data-act="inspect" data-arg="${id}"` : '' })).join('')}</div>
        </div>`, {
          back: UI.title,
          fe(a) { fe = a; render(); },
          fr(a) { fr = a; render(); },
          inspect(id) {
            const d = EB.CARDS[id];
            const b = modal.open(`<div class="row spread"><h2>${esc(d.name)}</h2><button class="btn sm" data-act="x">Close</button></div>
              <div class="row center" style="gap:30px">${cardHTML(id)}<div><div class="tiny dim" style="text-align:center">UPGRADED</div>${cardHTML(id, { lvl: 2 })}</div></div>
              <p class="small mt">${EB.ELEMENTS[d.element].role ? `<b style="color:${EB.ELEMENTS[d.element].color}">${EB.ELEMENTS[d.element].name}</b> — ${esc(EB.ELEMENTS[d.element].blurb || EB.ELEMENTS[d.element].role)}` : ''}</p>`);
            bind(b.parentElement, { x: () => modal.close() });
          },
        });
      };
      render();
    },

    relicCollection() {
      const prof = save().profile;
      const found = EB.RELIC_IDS.filter((id) => prof.relics[id]).length;
      UI.show(`<div class="wrap">
        <div class="row spread"><h2>Relics ${found}/${EB.RELIC_IDS.length}</h2><button class="btn sm" data-act="back">Back</button></div>
        <p class="small dim">Relics are passive bonuses that last a whole run. Find them in rewards, elite fights, shops and events.</p>
        <div class="list">${EB.RELIC_IDS.map((id) => prof.relics[id] ? relicItem(id, `<span class="pill" style="color:${EB.RARITIES[EB.RELICS[id].rarity].color}">${EB.RARITIES[EB.RELICS[id].rarity].name}</span>`)
          : `<div class="item" style="opacity:.5">${ico('question', 32)}<div class="grow"><div class="t">???</div><div class="d">Not discovered yet.</div></div></div>`).join('')}</div>
      </div>`, { back: UI.title });
    },

    stats() {
      const s = save().profile.stats;
      const rows = [
        ['Runs started', s.runsStarted], ['Runs won', s.runsWon], ['Dungeons cleared', s.dungeonsCleared || 0], ['Battles won', s.battlesWon], ['Battles lost', s.battlesLost],
        ['Lines cleared', s.lines], ['Attack lines sent', s.sent], ['4-line clears', s.quads], ['Pieces placed', s.pieces],
        ['Best combo', s.bestCombo], ['Best pieces/min', s.bestPPM], ['Elemental reactions', s.reactions], ['Battle time', EB.util.fmtTime(s.playTime)],
      ];
      UI.show(`<div class="wrap">
        <div class="row spread"><h2>Statistics</h2><button class="btn sm" data-act="back">Back</button></div>
        <div class="panel"><div class="statgrid" style="grid-template-columns:1fr auto">${rows.map(([k, v]) => `<span class="small">${k}</span><span class="you">${v}</span>`).join('')}</div></div>
      </div>`, { back: UI.title });
    },

    // ================= SETTINGS =================
    settings(back) {
      const st = save().settings;
      const names = { left: 'Move left', right: 'Move right', soft: 'Soft drop', cw: 'Rotate clockwise', ccw: 'Rotate counter-clockwise', hard: 'Hard drop', hold: 'Hold card', skill: 'Hero skill', pause: 'Pause' };
      const pretty = (c) => c.replace(/^Key/, '').replace(/^Arrow/, '').replace(/^Digit/, '').replace('Left', ' L').replace('Right', ' R');
      let waiting = null;
      const seg = (k, opts, cur) => `<span class="row" style="gap:0">${opts.map(([v, l]) => `<button class="btn sm ${String(v) === String(cur) ? 'sel' : ''}" data-act="set" data-arg="${k}:${v}">${l}</button>`).join('')}</span>`;
      const render = () => {
        UI.show(`<div class="wrap">
          <div class="row spread"><h2>Settings</h2><button class="btn sm" data-act="back">Back</button></div>
          <div class="panel">
            <h3>Audio</h3>
            <div class="set-row"><span>Music</span><input type="range" min="0" max="1" step="0.05" value="${st.music}" data-set="music"></div>
            <div class="set-row"><span>Sound effects</span><input type="range" min="0" max="1" step="0.05" value="${st.sfx}" data-set="sfx"></div>
          </div>
          <div class="panel">
            <h3>Gameplay</h3>
            <div class="set-row"><span>Ghost piece</span><button class="btn sm" data-act="tog" data-arg="ghost">${st.ghost ? 'ON' : 'OFF'}</button></div>
            <div class="set-row"><span>Screen shake</span><button class="btn sm" data-act="tog" data-arg="shake">${st.shake ? 'ON' : 'OFF'}</button></div>
            <div class="set-row"><span>Touch controls</span>${seg('controls', [['auto', 'Auto'], ['tap', 'Tap'], ['drag', 'Drag'], ['buttons', 'Buttons'], ['keyboard', 'Keys']], ['gestures', 'both'].includes(st.controls) ? 'drag' : st.controls || 'drag')}</div>
            <p class="tiny dim">Tap: tap a column to move there, tap again to drop, tap the block to rotate. Drag: classic swipe. Auto = Tap on touch screens.</p>
            <div class="set-row"><span>Slide sensitivity</span>${seg('sens', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], st.sens || 'medium')}</div>
            <div class="set-row"><span>Blocks per row</span>${seg('cols', [[10, '10'], [15, '15'], [20, '20'], [30, '30']], st.cols || 15)}</div>
            <div class="set-row"><span>Garbage rule</span>${seg('garbageMode', [['direct', 'Direct'], ['classic', 'Classic']], st.garbageMode || 'direct')}</div>
            <p class="tiny dim">Classic: 2/3/4 lines send 1/2/4 garbage, queued, and clearing cancels it. Direct: every cleared line sends 1 garbage row that lands at once.</p>
            <div class="set-row"><span>Match time</span>${seg('matchTime', [[1, '1m'], [2, '2m'], [3, '3m'], [4, '4m'], [5, '5m'], [0, 'No limit']], st.matchTime || 0)}</div>
            <div class="set-row"><span>Auto-repeat delay (DAS) <span class="dim tiny">${Math.round(st.das * 1000)}ms</span></span><input type="range" min="0.05" max="0.3" step="0.01" value="${st.das}" data-set="das"></div>
            <div class="set-row"><span>Repeat rate (ARR) <span class="dim tiny">${Math.round(st.arr * 1000)}ms</span></span><input type="range" min="0" max="0.1" step="0.005" value="${st.arr}" data-set="arr"></div>
          </div>
          <div class="panel">
            <h3>Controls <span class="tiny">(click a key, then press the new key)</span></h3>
            ${Object.keys(names).map((a) => `<div class="set-row"><span>${names[a]}</span><span>${st.keys[a].map((c, i) => `<span class="keycap ${waiting && waiting[0] === a && waiting[1] === i ? 'wait' : ''}" data-act="key" data-arg="${a}:${i}">${waiting && waiting[0] === a && waiting[1] === i ? '...' : esc(pretty(c))}</span>`).join('')}</span></div>`).join('')}
            <div class="row mt"><button class="btn sm" data-act="resetKeys">Reset controls</button></div>
          </div>
          <div class="panel">
            <h3>Data</h3>
            <div class="set-row"><span>Delete all progress (collection, stats, run)</span><button class="btn sm" data-act="wipe">Delete</button></div>
          </div>
        </div>`, {
          back: () => { save().write(); (back || UI.title)(); },
          tog(k) { st[k] = !st[k]; save().write(); render(); },
          set(arg) {
            const [k, v] = arg.split(':');
            st[k] = k === 'cols' || k === 'matchTime' ? +v : v;
            if (k === 'controls') { st.touchHelpV2 = false; EB.Game.applyTouch(); }
            save().write(); render();
          },
          key(arg) { const [a, i] = arg.split(':'); waiting = [a, +i]; render(); },
          resetKeys() { st.keys = JSON.parse(JSON.stringify(save().DEFAULT_KEYS)); save().write(); render(); },
          wipe() {
            const b = modal.open(`<h2>Delete everything?</h2><p class="small">This removes your collection, statistics and current run.</p><div class="row center"><button class="btn" data-act="n">Cancel</button><button class="btn primary" data-act="y">Delete</button></div>`, true);
            bind(b.parentElement, { n: () => modal.close(), y: () => { modal.close(); save().resetAll(); toast('Progress deleted.'); UI.title(); } });
          },
        });
        UI.root().querySelectorAll('[data-set]').forEach((inp) => {
          inp.oninput = () => {
            const k = inp.dataset.set;
            st[k] = parseFloat(inp.value);
            if (k === 'music' || k === 'sfx') EB.Audio.setVolume(k, st[k]);
            if (k === 'sfx') EB.Audio.sfx('rotate');
          };
          inp.onchange = () => { save().write(); if (inp.dataset.set === 'das' || inp.dataset.set === 'arr') render(); };
        });
      };
      const onKey = (e) => {
        if (!waiting) return;
        if (!document.body.contains(UI.root().querySelector('.keycap.wait'))) { waiting = null; return; }
        e.preventDefault();
        const [a, i] = waiting;
        // a key can only do one thing
        for (const k in st.keys) st.keys[k] = st.keys[k].filter((c) => c !== e.code);
        st.keys[a][i] = e.code;
        st.keys[a] = st.keys[a].filter(Boolean);
        if (!st.keys[a].length) st.keys[a] = [e.code];
        waiting = null; save().write(); render();
      };
      window.removeEventListener('keydown', UI._keyHandler || (() => {}), true);
      UI._keyHandler = onKey;
      window.addEventListener('keydown', onKey, true);
      render();
    },

    // ================= HOW TO PLAY =================
    howto(back, first) {
      const k = (a) => save().settings.keys[a].map((c) => `<kbd>${esc(c.replace(/^Key|^Arrow/, ''))}</kbd>`).join(' ');
      UI.show(`<div class="wrap">
        <div class="row spread"><h2>How to Play</h2><button class="btn ${first ? 'primary' : 'sm'}" data-act="back">${first ? 'Start!' : 'Back'}</button></div>
        <div class="howto-grid">
          <div class="panel"><h3>The Arena</h3><p>Your board is at the <b style="color:var(--you)">TOP</b>: your blocks fall <b>down</b> toward the centre battle line.
            The enemy board is at the <b style="color:var(--foe)">BOTTOM</b>: its blocks rise <b>up</b> toward the centre. Both of you play at the same time.</p>
            <p>The dashed red line on the outer edge is your <b>danger line</b>. If your stack reaches it, you lose instantly.</p></div>
          <div class="panel"><h3>Controls</h3><ul>
            <li>Move: ${k('left')} ${k('right')}</li><li>Soft drop: ${k('soft')}</li><li>Hard drop: ${k('hard')}</li>
            <li>Rotate: ${k('cw')} / ${k('ccw')}</li><li>Hold card: ${k('hold')}</li><li>Hero skill: ${k('skill')} or tap your hero</li><li>Pause: ${k('pause')}</li></ul>
            <p class="dim">Phones (Tap scheme): tap a column to send the block there, tap it again to drop, tap the block to rotate, drag down to lower it slowly, flick down to hard drop, flick up to hold. Change it in Settings.</p></div>
          <div class="panel"><h3>Lines are Attacks</h3><p>Fill a row to clear it. Clears send garbage rows to your foe:</p>
            <ul><li>1 line → 0</li><li>2 lines → 1</li><li>3 lines → 2</li><li>4 lines → 4 (+1 back-to-back)</li><li>Combos (clears in a row) add more</li></ul>
            <p>Garbage enters from the centre side and pushes the stack toward the danger line. <b>Clear lines while garbage is incoming to cancel it.</b></p></div>
          <div class="panel"><h3>Speed is Skill</h3><p>Gravity is steady. You play faster by deciding faster: hard drop as soon as a piece is placed well and the next card arrives at once.
            A piece placed within ${EB.CONFIG.RAPID_TIME}s is <b>rapid</b> — Lightning cards love that. But sloppy speed builds holes, and holes lose games.</p></div>
          <div class="panel"><h3>Your Pieces are Your Deck</h3><p>Every block is a card. You draw from your deck, used cards go to the discard pile, and the discard pile is reshuffled when the deck runs out.
            You see the next 3 cards and can hold one. Cards have rarities and abilities, and can be upgraded.</p></div>
          <div class="panel"><h3>Elements</h3><ul>${EB.ELEMENT_IDS.map((e) => `<li><b style="color:${EB.ELEMENTS[e].color}">${EB.ELEMENTS[e].name}</b> (${EB.ELEMENTS[e].role}): ${esc(EB.ELEMENTS[e].blurb)} Full energy → <b>${EB.ELEMENTS[e].burst.name}</b>: ${esc(EB.ELEMENTS[e].burst.desc)}.</li>`).join('')}</ul></div>
          <div class="panel"><h3>Reactions</h3><p>Clear lines that mix two elements (blocks, your card, or your lingering aura) to trigger a reaction:</p>
            <ul>${EB.REACTIONS.map((r) => `<li><b style="color:${r.color}">${r.name}</b> (${r.els.map((e) => EB.ELEMENTS[e].name).join(' + ')}): ${esc(r.desc)}</li>`).join('')}</ul></div>
          <div class="panel"><h3>Winning</h3><ul><li>Push the foe's stack to their danger line, or</li><li>after 2:00 have the <b>lower</b> stack.</li>
            <li>Tie → fewer garbage received → more lines → sudden death (first clear wins).</li></ul></div>
          <div class="panel"><h3>The Run</h3><p>Fight through ${EB.DUNGEONS.length} dungeons (${EB.DUNGEONS.map((d) => d.name).join(', ')}). In each, pick a path up an 8-floor map: battles, elites, events, shops, forges and rest sites, then the boss. Each dungeon's foes are faster and its rewards rarer.
            After each win choose 1 of 3 rewards: new cards, upgrades, card removal, relics, gold, healing or elemental blessings.</p></div>
        </div>
      </div>`, {
        back() { if (first) { save().profile.tutorialSeen = true; save().write(); } (back || UI.title)(); },
      });
    },
  };

  // animated falling blocks behind the title
  function titleAnim() {
    const cv = document.getElementById('titleBg');
    if (!cv) return;
    const g = cv.getContext('2d');
    const kinds = ['fire', 'water', 'nature', 'lightning', 'n:I', 'n:T', 'n:O'];
    const drops = [];
    let last = performance.now();
    const step = (now) => {
      if (!document.body.contains(cv)) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (cv.width !== cv.clientWidth || cv.height !== cv.clientHeight) { cv.width = cv.clientWidth; cv.height = cv.clientHeight; }
      g.clearRect(0, 0, cv.width, cv.height);
      if (drops.length < 26 && Math.random() < 0.08) {
        const up = Math.random() < 0.5;
        drops.push({ x: Math.floor(Math.random() * (cv.width / 24)) * 24, y: up ? cv.height + 24 : -24, v: (up ? -1 : 1) * (30 + Math.random() * 60), k: kinds[Math.floor(Math.random() * kinds.length)] });
      }
      g.imageSmoothingEnabled = false;
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.y += d.v * dt;
        g.drawImage(EB.Pix.tile(d.k, 24), d.x, Math.round(d.y / 24) * 24);
        if (d.y < -40 || d.y > cv.height + 40) drops.splice(i, 1);
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  EB.UI = UI;
})(globalThis.EB = globalThis.EB || {});
