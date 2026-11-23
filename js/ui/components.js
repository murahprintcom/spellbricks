// Small UI building blocks shared by the screens (card faces, relic rows, modal, toast).
(function (EB) {
  'use strict';
  const esc = (s) => EB.util.esc(s);

  const ico = (name, px, cls) => `<img class="${cls || ''}" src="${EB.Pix.iconURL(name, px || 32)}" alt="">`;

  // inst: {id, lvl, uid} or a card id string
  function cardHTML(inst, opt) {
    opt = opt || {};
    if (typeof inst === 'string') inst = { id: inst, lvl: 1 };
    const d = EB.CARDS[inst.id];
    const lvl = opt.lvl || inst.lvl || 1;
    const locked = opt.locked;
    const el = EB.ELEMENTS[d.element];
    const cls = ['card', 'el-' + d.element, 'r-' + d.rarity];
    if (opt.small) cls.push('small');
    if (opt.pick) cls.push('pick');
    if (locked) cls.push('locked');
    if (opt.sold) cls.push('sold');
    const attrs = opt.attrs || '';
    return `<div class="${cls.join(' ')}" ${opt.pick ? 'tabindex="0" role="button"' : ''} ${attrs}>
      <div class="top">${ico(d.element, 32)}<span class="name">${locked ? '???' : esc(d.name)}${lvl >= 2 ? '+' : ''}</span></div>
      <div class="art"><img src="${EB.Pix.shapeURL(d.shape, d.element, 16)}" alt="${d.shape} block"></div>
      <div class="meta"><span>${EB.RARITIES[d.rarity].name.toUpperCase()}</span><span class="el">${el.name.toUpperCase()}</span></div>
      <div class="desc">${locked ? 'Not discovered yet.' : esc(d.desc(lvl))}</div>
      ${lvl >= 2 ? '<div class="lvl">+</div>' : ''}
      ${opt.price != null ? `<div class="price">${ico('coin', 16)}${opt.price}</div>` : ''}
    </div>`;
  }

  function relicIcon(id, px) {
    const r = EB.RELICS[id];
    return `<img class="relic-ico" src="${EB.Pix.iconURL(r.icon, px || 32)}" alt="${esc(r.name)}" title="${esc(r.name + ': ' + r.desc)}">`;
  }

  function relicItem(id, extra) {
    const r = EB.RELICS[id];
    return `<div class="item">${ico(r.icon, 32)}<div class="grow"><div class="t">${esc(r.name)}</div><div class="d">${esc(r.desc)}</div></div>${extra || ''}</div>`;
  }

  function portraitURL(enemyId, px) {
    const e = EB.ENEMIES[enemyId];
    return EB.Pix.portraitURL({ enemy: enemyId }, px || 12);
  }

  // ---- modal ----
  const modal = {
    open(html, narrow) {
      const m = document.getElementById('modal');
      m.innerHTML = `<div class="box ${narrow ? 'narrow' : ''}">${html}</div>`;
      m.classList.remove('hidden');
      return m.firstElementChild;
    },
    close() {
      const m = document.getElementById('modal');
      m.classList.add('hidden');
      m.innerHTML = '';
    },
    get isOpen() { return !document.getElementById('modal').classList.contains('hidden'); },
  };

  let toastT = 0;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // Bind [data-act] clicks inside root to handlers. data-arg passed as string.
  function bind(root, handlers) {
    root.onclick = (e) => {
      const el = e.target.closest('[data-act]');
      if (!el || !root.contains(el) || el.disabled) return;
      const fn = handlers[el.dataset.act];
      if (fn) { EB.Audio.unlock(); EB.Audio.sfx('ui'); fn(el.dataset.arg, el, e); }
    };
    root.onkeydown = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const el = e.target.closest('[data-act]');
      if (el && el.tagName !== 'BUTTON') { e.preventDefault(); el.click(); }
    };
  }

  // Pick a card from the run deck. filter(inst) -> bool. Resolves uid or null.
  function pickCard(run, title, filter, preview) {
    return new Promise((resolve) => {
      const list = run.deck.filter(filter || (() => true));
      const html = `<div class="row spread mb"><h2>${esc(title)}</h2><button class="btn sm" data-act="cancel">Cancel</button></div>
        ${list.length ? '' : '<p class="dim">No valid cards.</p>'}
        <div class="cards">${list.map((c) => cardHTML(c, { pick: true, small: true, attrs: `data-act="pick" data-arg="${c.uid}"` })).join('')}</div>`;
      const box = modal.open(html);
      bind(box.parentElement, {
        cancel() { modal.close(); resolve(null); },
        pick(uid) {
          const c = run.deck.find((x) => x.uid === uid);
          if (!preview) { modal.close(); resolve(uid); return; }
          const b2 = modal.open(`<h2>${esc(preview.title)}</h2>
            <div class="row center">${cardHTML(c)}<span style="font-size:20px">${preview.arrow || '→'}</span>${preview.after ? cardHTML(Object.assign({}, c, { lvl: (c.lvl || 1) + 1 })) : ''}</div>
            <div class="row center mt"><button class="btn" data-act="back">Back</button><button class="btn primary" data-act="ok">${esc(preview.ok)}</button></div>`, !preview.after);
          bind(b2.parentElement, {
            back() { modal.close(); pickCard(run, title, filter, preview).then(resolve); },
            ok() { modal.close(); resolve(uid); },
          });
        },
      });
    });
  }

  function hpBar(run) {
    const p = Math.max(0, run.hp / run.maxHp);
    const col = p > 0.5 ? '#5fd24a' : p > 0.25 ? '#ffb02a' : '#ff3355';
    return `<div class="bar" style="width:110px"><i style="width:${Math.round(p * 100)}%;background:${col}"></i></div>`;
  }

  EB.UIC = { ico, cardHTML, relicIcon, relicItem, portraitURL, modal, toast, bind, pickCard, hpBar, esc };
})(globalThis.EB = globalThis.EB || {});
