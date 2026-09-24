// All on-screen interface: resource bar, build menu with info cards, selection panel, toasts, dialogs.
import { BUILDINGS, CATEGORIES, RES, JOBS, ECON } from '../game/data.js';
import { h, fmt, fmtTime } from '../util.js';
import { icon } from './icons.js';
import { THUMBS } from '../render/thumbs.js';

const $ = s => document.querySelector(s);

// 3D portrait of a building / person, with a kanji seal as fallback.
export function art(kind, key, kanji, cls = '') {
  const url = kind === 'building' ? THUMBS.building[key] : THUMBS.person[key];
  const wrap = h('span', { class: 'art ' + cls });
  if (url) wrap.append(h('img', { src: url, alt: '', draggable: 'false' }));
  else wrap.append(h('span', { class: 'fallback' }, kanji || '?'));
  if (kanji) wrap.append(h('span', { class: 'seal' }, kanji));
  return wrap;
}
export function costChips(game, cost, live) {
  return h('span', { class: 'cost' }, Object.keys(cost).length ? Object.keys(cost).map(r => {
    const el = h('span', { class: 'c' }, icon(RES[r].icon, 15), String(cost[r]));
    if (live) live(el, e => e.classList.toggle('short', game.state.res[r] < cost[r]));
    return el;
  }) : h('span', { class: 'c free' }, 'Free'));
}

export class Hud {
  constructor(game) {
    this.game = game;
    this.root = $('#ui');
    this.cat = 'village';
    this.buildOpen = true;
    this.settings = { scrollPans: true, sound: false };
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem('tenka.ui') || '{}')); } catch (_) { /* no storage */ }
    this.speed = 1; this.paused = false;
    this.lives = [];
    this.build();
    game.on((type, data) => this.onGame(type, data));
  }
  saveSettings() { try { localStorage.setItem('tenka.ui', JSON.stringify(this.settings)); } catch (_) { /* ignore */ } }
  attach(input, cam, saver) { this.input = input; this.cam = cam; this.saver = saver; }

  /* ---------- live values (updated 4× per second) ---------- */
  live = (el, fn) => { this.lives.push({ el, fn }); fn(el); return el; };
  tick() { this.lives = this.lives.filter(l => l.el.isConnected); for (const l of this.lives) l.fn(l.el); }

  build() {
    const g = this.game, R = this.root;
    R.textContent = '';
    const pill = (ic, title, fn, cls = '') => this.live(h('div', { class: 'res ' + cls, title }), el => {
      const [b, small] = fn(); el.textContent = '';
      el.append(icon(typeof ic === 'function' ? ic() : ic, 20), h('b', null, b), small ? h('small', null, small) : '');
    });
    const res = h('div', { class: 'resbar' });
    for (const r in RES) res.append(pill(RES[r].icon, RES[r].name, () => [fmt(g.state.res[r]), '/' + fmt(g.storageCap())]));
    for (const r in RES) res.children[Object.keys(RES).indexOf(r)].dataset.res = r;
    const pop = pill('people', 'Villagers / homes', () => { const idle = g.idleVillagers().length; return [`${g.pop}/${g.housing()}`, idle ? ` ${idle} idle` : '']; });
    const army = pill('soldier', 'Soldiers', () => [String(g.soldiers().length)]);
    const harm = pill('sakura', 'Harmony: beauty buildings make villagers work faster', () => [`+${g.harmony()}%`]);
    const night = () => g.state.time < 0.22 || g.state.time > 0.8;
    const clock = this.live(h('button', { class: 'res clock', title: 'Pause (Space) · speed (F)', onclick: () => this.cycleSpeed() }), el => {
      const hr = Math.floor(g.state.time * 24); el.textContent = '';
      el.append(icon(night() ? 'moon' : 'sun', 20), h('b', null, `Day ${g.state.day}`), h('small', null, ` ${String(hr).padStart(2, '0')}:00 · ${this.paused ? 'paused' : this.speed + '×'}`));
    });
    this.mapBtn = h('button', { class: 'res mapbtn', title: 'Country map (M)', onclick: () => this.onMap && this.onMap() }, icon('map', 20), h('b', null, 'Map'));
    const menu = h('button', { class: 'res menu', title: 'Menu', onclick: () => this.openMenu() }, icon('menu', 20));
    R.append(h('header', { class: 'top' }, h('div', { class: 'brand' }, h('span', { class: 'kanji' }, '天下'), h('span', { class: 'word' }, 'Tenka')), res, pop, army, harm, h('div', { class: 'spacer' }), clock, this.mapBtn, menu));
    this.bar = h('section', { class: 'buildbar' }); R.append(this.bar);
    this.info = h('div', { class: 'info', hidden: true }); R.append(this.info);
    this.renderBar();
    this.panel = h('aside', { class: 'panel', hidden: true }); R.append(this.panel);
    this.hint = h('div', { class: 'hint', hidden: true }); R.append(this.hint);
    this.toasts = h('div', { class: 'toasts' }); R.append(this.toasts);
    this.modal = h('div', { class: 'modal', hidden: true }); R.append(this.modal);
    R.append(h('div', { class: 'keys' }, 'Drag: move · Scroll: pan · Pinch: zoom · Q/E: rotate · B: build · H: help'));
  }

  /* ---------- build menu ---------- */
  renderBar() {
    const g = this.game, bar = this.bar; bar.textContent = '';
    this.hideInfo(true);
    bar.classList.toggle('closed', !this.buildOpen);
    const tabs = h('div', { class: 'tabs' },
      CATEGORIES.map(c => h('button', { class: 'tab' + (c.id === this.cat ? ' on' : ''), onclick: () => { this.cat = c.id; this.buildOpen = true; this.renderBar(); } }, icon(c.icon, 20), c.name)),
      h('button', { class: 'tab toggle', title: 'Show / hide (B)', onclick: () => { this.buildOpen = !this.buildOpen; this.renderBar(); } }, icon(this.buildOpen ? 'down' : 'up', 18), this.buildOpen ? '' : 'Build'));
    bar.append(tabs);
    if (!this.buildOpen) return;
    const row = h('div', { class: 'cards' });
    for (const [type, d] of Object.entries(BUILDINGS)) {
      if (d.cat !== this.cat) continue;
      const infoBtn = h('button', { class: 'infobtn', title: 'What does it do?', onclick: e => { e.stopPropagation(); this.toggleInfo(type, card); } }, icon('info', 16));
      const card = h('div', { class: 'card', role: 'button', tabindex: '0', onclick: () => this.input.startPlacing(type),
        onpointerenter: e => { if (e.pointerType !== 'touch') this.showInfo(type, card); }, onpointerleave: () => this.hideInfo() },
        art('building', type, d.kanji, 'thumb'), h('span', { class: 'nm' }, d.name), costChips(g, d.cost, this.live), infoBtn);
      card.dataset.type = type;
      row.append(card);
    }
    bar.append(row);
  }
  infoRows(type) {
    const d = BUILDINGS[type], rows = [];
    const row = (ic, text) => rows.push(h('div', { class: 'irow' }, icon(ic, 18), h('span', null, text)));
    if (d.housing) row('house', `Homes for ${d.housing} villagers`);
    if (d.storage) row('storage', `Stores ${d.storage} more of every resource`);
    if (d.jobs) {
      const J = JOBS[d.job];
      if (d.trains) row('katana', `${d.jobs} recruits at a time → ${JOBS[d.trains].name} in ${d.trainTime}s (each costs ${this.costText(d.trainCost)})`);
      else row(J.res ? RES[J.res].icon : 'worker', `Up to ${d.jobs} ${J.name.toLowerCase()}s, each bringing ${J.amount} ${RES[J.res].name.toLowerCase()} per trip`);
    }
    if (d.dropoff === 'wood') row('wood', 'Woodcutters drop logs here — build it near trees');
    if (d.dropoff === 'all' && type !== 'townhall') row('storage', 'Workers deliver goods here — build it near fields and mines');
    if (d.beauty) row('sakura', `+${d.beauty} beauty — raises Harmony, so everyone works faster`);
    if (d.relax) row('people', d.relax === 'pray' ? 'Villagers with free time come here to pray' : 'Villagers with free time come here to relax');
    if (d.garrison) row('soldier', `${d.garrison} archers can stand watch up here`);
    if (d.road) row('road', `Villagers walk ${Math.round((d.road - 1) * 100)}% faster and follow roads`);
    if (d.blocks) row('wall', 'Blocks attackers — they must break through or go around');
    if (type === 'gate') row('wall', 'Your people pass through; enemies must break it down');
    if (type === 'hedge') row('soldier', 'Troops standing in a hedge are hidden from enemies');
    if (type === 'spikes') row('wall', 'Slows attackers who push through');
    return rows;
  }
  infoCard(type) {
    const d = BUILDINGS[type], [w, dd] = d.size;
    return h('div', { class: 'icard' },
      h('div', { class: 'ihead' }, art('building', type, d.kanji, 'big'), h('div', null, h('h3', null, d.name), h('span', { class: 'kan' }, d.kanji))),
      h('p', null, d.desc),
      h('div', { class: 'irow' }, icon('hourglass', 18), h('span', null, d.time ? `Builds in ${d.time}s (faster with more helpers)` : 'Laid instantly')),
      h('div', { class: 'irow' }, icon('grid', 18), h('span', null, `Size ${w} × ${dd}` + (d.line ? ' — drawn as a line' : ''))),
      this.infoRows(type),
      h('div', { class: 'irow costrow' }, h('b', null, 'Cost'), costChips(this.game, d.cost, this.live)));
  }
  showInfo(type, card, pinned = false) {
    if (this.infoPinned && !pinned) return;
    this.info.textContent = ''; this.info.append(this.infoCard(type));
    this.info.hidden = false; this.infoType = type;
    const r = card.getBoundingClientRect(), bw = this.info.offsetWidth || 320;
    this.info.style.left = Math.max(12, Math.min(window.innerWidth - bw - 12, r.left + r.width / 2 - bw / 2)) + 'px';
    this.info.style.bottom = (window.innerHeight - this.bar.getBoundingClientRect().top + 10) + 'px';
  }
  toggleInfo(type, card) {
    if (this.infoPinned && this.infoType === type) { this.hideInfo(true); return; }
    this.infoPinned = true; this.showInfo(type, card, true);
  }
  hideInfo(force = false) { if (this.infoPinned && !force) return; this.infoPinned = false; if (this.info) this.info.hidden = true; }

  onPlacing(P) {
    document.querySelectorAll('.card').forEach(c => c.classList.toggle('on', !!P && c.dataset.type === P.type && !P.moveId));
    this.hideInfo(true);
    if (!P) { this.hint.hidden = true; return; }
    const def = BUILDINGS[P.type];
    this.hint.hidden = false;
    this.hintBase = P.moveId ? `Moving ${def.name}` : `Placing ${def.name}`;
    this.placingHint(true, def.line ? 'Click where the line should start' : '');
  }
  placingHint(ok, why) {
    if (!this.hint || this.hint.hidden) return;
    this.lastWhy = why;
    const P = this.input && this.input.placing;
    this.hint.textContent = '';
    this.hint.append(...[h('b', null, this.hintBase || ''), why ? h('span', { class: ok ? '' : 'bad' }, ' — ' + why) : null,
      h('small', null, `  R: rotate · Esc: ${P && P.lineStart ? 'finish line' : 'cancel'}${P && !P.moveId && !BUILDINGS[P.type].line ? ' · Shift+click: place more' : ''}`),
      h('button', { class: 'mini', onclick: () => this.input.cancelPlacing() }, icon('close', 14), 'Done'),
      BUILDINGS[P ? P.type : 'house'].line ? null : h('button', { class: 'mini', onclick: () => this.input.rotatePlacing() }, icon('rotate', 14), 'Rotate')].filter(Boolean));
  }

  /* ---------- selection panel ---------- */
  onSelect(sel) { this.sel = sel; this.confirmDemolish = false; this.renderPanel(); }
  renderPanel() {
    const p = this.panel, sel = this.sel, g = this.game;
    p.textContent = '';
    if (!sel) { p.hidden = true; return; }
    p.hidden = false;
    const close = h('button', { class: 'x', title: 'Close (Esc)', onclick: () => this.input.select(null) }, icon('close', 16));
    if (sel.kind === 'building') {
      const b = g.buildings.get(sel.id); if (!b) { p.hidden = true; return; }
      const d = b.def;
      p.append(close, h('div', { class: 'phead' }, art('building', b.type, d.kanji, 'big'), h('div', null, h('h2', null, d.name),
        this.live(h('p', { class: 'sub' }), el => { el.textContent = b.done ? 'Complete' : `Under construction · ${Math.floor(b.progress * 100)}%`; }))),
        h('p', { class: 'desc' }, d.desc));
      if (!b.done) {
        p.append(this.bar2(() => b.progress), this.live(h('p', { class: 'sub' }), el => {
          const n = [...g.villagers.values()].filter(v => v.site === b.id).length;
          el.textContent = n ? `${n} villager${n > 1 ? 's' : ''} building` : g.state.settings.autoBuild ? 'Waiting for an idle villager to come and build' : 'Auto-build is off — turn it on in the menu';
        }));
      }
      const rows = this.infoRows(b.type);
      if (rows.length) p.append(h('div', { class: 'irows' }, rows));
      if (d.jobs) {
        const J = JOBS[d.job];
        p.append(h('div', { class: 'jobs' },
          h('div', { class: 'jrow' }, icon(d.trains ? 'katana' : 'worker', 18), h('b', null, d.trains ? 'Recruits' : `${J.name}s`),
            this.live(h('span', { class: 'count' }), el => { el.textContent = `${b.workers.length} / ${d.jobs}`; }),
            h('button', { class: 'mini', title: 'Remove a worker', onclick: () => { g.assign(b, -1); this.renderPanel(); } }, '−'),
            h('button', { class: 'mini', title: 'Add an idle villager', onclick: () => { g.assign(b, +1); this.renderPanel(); } }, '+')),
          h('ul', { class: 'names' }, b.workers.map(id => {
            const v = g.villagers.get(id); if (!v) return null;
            return h('li', null, art('person', JOBS[v.job].look, null, 'face'), h('div', null, h('button', { class: 'link', onclick: () => this.input.select({ kind: 'villager', id }) }, v.name),
              d.trains ? this.bar2(() => (v.train || 0) / d.trainTime) : this.live(h('small', null), el => { el.textContent = v.status; })));
          }))));
      }
      if (d.garrison) {
        p.append(this.live(h('p', { class: 'sub' }), el => {
          const n = [...g.villagers.values()].filter(v => v.post && v.post.b === b.id).length;
          el.textContent = `Archers on watch: ${n} / ${d.garrison}` + (g.countJob('archer') ? '' : ' — train archers at a Kyūdō Range');
        }));
      }
      const actions = h('div', { class: 'actions' });
      actions.append(h('button', { class: 'btn ghost', title: 'Move (M)', onclick: () => this.input.startPlacing(b.type, b.id) }, icon('move', 16), 'Move'));
      if (b.type !== 'townhall') actions.append(h('button', { class: 'btn danger', title: 'Demolish (Delete)', onclick: () => this.demolishSelected() }, icon('demolish', 16), this.confirmDemolish ? 'Really demolish?' : 'Demolish'));
      p.append(actions);
      if (this.extraPanel) this.extraPanel(p, b);
    } else {
      const v = g.villagers.get(sel.id); if (!v) { p.hidden = true; return; }
      const J = JOBS[v.job], work = v.work ? g.buildings.get(v.work) : null;
      p.append(close, h('div', { class: 'phead' }, art('person', J.look, null, 'big'), h('div', null, h('h2', null, v.name), h('p', { class: 'sub' }, J.name + (work ? ` · ${work.def.name}` : '')))),
        this.live(h('p', { class: 'desc status' }), el => { el.textContent = v.status || '…'; }));
      if (J.desc) p.append(h('p', { class: 'sub' }, J.desc));
      if (v.job === 'trainee' && work) p.append(this.bar2(() => (v.train || 0) / work.def.trainTime));
      const actions = h('div', { class: 'actions' });
      actions.append(h('button', { class: 'btn ghost', onclick: () => { this.cam.follow = () => g.villagers.get(v.id) && g.villagers.get(v.id).pos; } }, icon('eye', 16), 'Follow'));
      if (v.job !== 'idle' && !J.soldier) actions.append(h('button', { class: 'btn ghost', onclick: () => { g.setJob(v, 'idle'); this.renderPanel(); } }, icon('stop', 16), 'Stop working'));
      p.append(actions);
      if (v.job === 'idle') {
        const open = [...g.buildings.values()].filter(b => b.done && b.def.jobs && b.workers.length < b.def.jobs);
        p.append(h('p', { class: 'sub' }, open.length ? 'Give a job:' : 'No free jobs — build a field, camp, quarry, mine or dojo.'),
          h('div', { class: 'jobgrid' }, open.slice(0, 8).map(b => h('button', { class: 'btn ghost small', onclick: () => { g.setJob(v, b.def.job, b.id); this.renderPanel(); } }, art('building', b.type, null, 'tiny'), JOBS[b.def.job].name))));
      }
    }
  }
  bar2(frac) { const i = h('i'); return this.live(h('div', { class: 'bar' }, i), () => { i.style.width = Math.min(100, Math.max(0, frac() * 100)).toFixed(1) + '%'; }); }
  costText(c) { return Object.keys(c).map(r => `${c[r]} ${RES[r].name.toLowerCase()}`).join(' + '); }
  demolishSelected() {
    if (!this.sel || this.sel.kind !== 'building') return;
    const b = this.game.buildings.get(this.sel.id); if (!b || b.type === 'townhall') return;
    if (!this.confirmDemolish) { this.confirmDemolish = true; this.renderPanel(); return; }
    this.game.demolish(b.id); this.input.select(null); this.sound('place');
  }

  /* ---------- game events ---------- */
  onGame(type, data) {
    if (type === 'toast') this.toast(data.text, data.kind);
    if (['build', 'built', 'demolish', 'move', 'job', 'villager'].includes(type)) {
      if (type === 'built') this.sound('done');
      clearTimeout(this.rt); this.rt = setTimeout(() => this.renderPanel(), 30);
    }
    if (type === 'hungry' && this.game.state.clock - (this.hungryAt || -99) > 60) { this.hungryAt = this.game.state.clock; this.toast('Out of wheat! Villagers work slowly — add farmers.', 'bad'); }
  }
  toast(text, kind = '') {
    const t = h('div', { class: 'toast ' + kind }, text);
    this.toasts.append(t); while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => t.remove(), 4200);
  }
  sound(kind) {
    if (!this.settings.sound) return;
    try {
      this.ac = this.ac || new (window.AudioContext || window.webkitAudioContext)();
      const notes = { place: [392, 523], done: [523, 659, 784], click: [660], war: [196, 147, 196] }[kind] || [440];
      notes.forEach((f, i) => { const t = this.ac.currentTime + i * 0.09, o = this.ac.createOscillator(), gn = this.ac.createGain(); o.type = 'sine'; o.frequency.value = f; gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.05, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(gn).connect(this.ac.destination); o.start(t); o.stop(t + 0.32); });
    } catch (_) { /* sound optional */ }
  }
  cycleSpeed() { if (this.paused) { this.paused = false; } else this.speed = this.speed >= 3 ? 1 : this.speed + 1; this.tick(); }

  /* ---------- dialogs ---------- */
  openModal(title, body, buttons = [{ label: 'Close' }], opts = {}) {
    const m = this.modal; m.textContent = ''; m.hidden = false;
    const close = () => { m.hidden = true; };
    m.append(h('div', { class: 'scrim', onclick: () => { if (!opts.locked) close(); } }), h('div', { class: 'sheet' + (opts.wide ? ' wide' : '') }, h('h2', null, title), body,
      h('div', { class: 'actions' }, buttons.map(b => h('button', { class: 'btn ' + (b.cls || ''), onclick: () => { if (b.fn) b.fn(); if (!b.keep) close(); } }, b.label)))));
  }
  showHelp() {
    const rows = [['Drag the ground', 'Move the camera'], ['Two-finger scroll', 'Move the camera'], ['Pinch  /  Z X', 'Zoom'], ['Q / E', 'Rotate the camera'], ['W A S D  /  arrows', 'Move the camera'],
      ['Click', 'Select a building or villager'], ['Hover a build card', 'See what it does (or tap its ⓘ)'], ['B', 'Show / hide the build menu'], ['R', 'Rotate while placing'],
      ['Shift + click', 'Keep placing the same building'], ['Walls & roads', 'Click start, click end — keeps going until Esc'], ['M', 'Country map'],
      ['Delete', 'Demolish (press twice)'], ['Space', 'Pause'], ['F', 'Game speed 1× / 2× / 3×'], ['Esc', 'Cancel / close']];
    this.openModal('How to play', h('div', null,
      h('p', null, 'Build your clan’s village in the valley. Villagers do the work: give them jobs at fields, camps, quarries and mines — idle villagers build new buildings on their own. Roads speed everyone up. Houses bring new families; shrines and gardens raise Harmony. Train soldiers, then open the Map to scout the country and raid rival strongholds.'),
      h('dl', { class: 'kv keys2' }, rows.map(([k, v]) => [h('dt', null, k), h('dd', null, v)]))));
  }
  openMenu() {
    const s = this.game.state.settings;
    const toggle = (label, get, set) => h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: get() ? true : null, onchange: e => set(e.target.checked) }), label);
    let q = 'auto'; try { q = localStorage.getItem('tenka.quality') || 'auto'; } catch (_) { /* */ }
    this.openModal('Menu', h('div', { class: 'menu' },
      toggle('Idle villagers build automatically', () => s.autoBuild, v => { s.autoBuild = v; }),
      toggle('Welcome new villagers when there is room', () => s.welcome, v => { s.welcome = v; }),
      toggle('Two-finger scroll moves the camera (off: zooms)', () => this.settings.scrollPans, v => { this.settings.scrollPans = v; this.saveSettings(); }),
      toggle('Sound', () => this.settings.sound, v => { this.settings.sound = v; this.saveSettings(); this.sound('click'); }),
      h('div', { class: 'row' }, h('span', null, 'Graphics: '), ['low', 'medium', 'high'].map(k => h('button', { class: 'btn small ' + (q === k ? '' : 'ghost'), onclick: () => { try { localStorage.setItem('tenka.quality', k); } catch (_) { /* */ } this.saver(); location.reload(); } }, k))),
      h('p', { class: 'sub' }, 'Your game saves automatically on this device, and a backup of the previous save is always kept.')),
      [{ label: 'How to play', cls: 'ghost', fn: () => setTimeout(() => this.showHelp(), 0) },
       { label: 'Save code', cls: 'ghost', keep: true, fn: () => this.openSaveCode() },
       { label: 'Start over', cls: 'danger', keep: true, fn: () => this.confirmReset() },
       { label: 'Close' }]);
  }
  // Copy your save as text (to move it to another device or keep it safe), or paste one in.
  openSaveCode() {
    this.saver();
    let code = '';
    try { code = btoa(unescape(encodeURIComponent(localStorage.getItem('tenka.save.v1') || ''))); } catch (_) { /* */ }
    const out = h('textarea', { readonly: true, rows: 4 }); out.value = code;
    const inp = h('textarea', { rows: 4, placeholder: 'Paste a save code here…' });
    const msg = h('p', { class: 'sub' });
    this.openModal('Save code', h('div', { class: 'menu' },
      h('p', null, 'This code is your whole village. Keep it somewhere safe, or paste it on another device to continue there.'), out,
      h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => { out.select(); try { navigator.clipboard.writeText(code).then(() => { msg.textContent = 'Copied.'; }, () => { msg.textContent = 'Select the text and copy it.'; }); } catch (_) { msg.textContent = 'Select the text and copy it.'; } } }, icon('copy', 14), 'Copy')),
      h('hr'), inp,
      h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => {
        try {
          const json = decodeURIComponent(escape(atob(inp.value.trim())));
          const obj = JSON.parse(json); if (!obj || !obj.v || !obj.buildings) throw new Error('bad');
          localStorage.setItem('tenka.save.backup', localStorage.getItem('tenka.save.v1') || '');
          localStorage.setItem('tenka.save.v1', json); this.saver.block(); location.reload();
        } catch (_) { msg.textContent = 'That doesn’t look like a Tenka save code. Check it was copied completely.'; }
      } }, 'Load this save')), msg), [{ label: 'Close' }]);
  }
  confirmReset() {
    this.openModal('Start a new village?', h('p', null, 'Everything you have built will be erased (the last save is kept as a backup). This cannot be undone from inside the game.'),
      [{ label: 'Keep playing', cls: 'ghost' }, { label: 'Erase and start over', cls: 'danger', fn: () => { this.saver(true); location.reload(); } }]);
  }
  showAway(r) {
    const rows = Object.entries(r.res).filter(([, v]) => v !== 0).map(([k, v]) => h('span', { class: 'chip' }, icon(RES[k].icon, 16), (v > 0 ? '+' : '') + v));
    this.openModal('While you were away…', h('div', null,
      h('p', null, `${fmtTime(r.sec)} passed in the valley. Your people kept working${r.sec >= ECON.offlineCapHours * 3600 ? ' (up to 4 hours count)' : ''}.`),
      h('div', { class: 'chips' }, rows),
      r.built ? h('p', null, `${r.built} building${r.built > 1 ? 's' : ''} finished.`) : null,
      r.trained ? h('p', null, `${r.trained} recruit${r.trained > 1 ? 's' : ''} finished training.`) : null,
      r.extra || null));
  }

  /* ---------- keyboard ---------- */
  onKey(k, e) {
    const I = this.input;
    if (this.keyHook && this.keyHook(k, e)) return;
    if (k === 'escape') {
      if (!this.modal.hidden) this.modal.hidden = true;
      else if (this.infoPinned) this.hideInfo(true);
      else if (I.placing) { if (!I.endLine()) I.cancelPlacing(); }
      else { I.select(null); this.cam.follow = null; }
      return;
    }
    if (!this.modal.hidden) return;
    if (k === 'r') return I.rotatePlacing();
    if (k === 'b') { this.buildOpen = !this.buildOpen; return this.renderBar(); }
    if (k === 'h' || k === '?') return this.showHelp();
    if (k === ' ') { this.paused = !this.paused; return this.tick(); }
    if (k === 'f') return this.cycleSpeed();
    if (k === 'm') return this.onMap && this.onMap();
    if (k === 'delete' || k === 'backspace') return this.demolishSelected();
  }
}
