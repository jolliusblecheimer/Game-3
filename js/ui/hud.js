// All on-screen interface: resource bar, build menu, selection panel, toasts, dialogs.
import { BUILDINGS, CATEGORIES, RES, JOBS, ECON } from '../game/data.js';
import { h, fmt, fmtTime } from '../util.js';

const $ = s => document.querySelector(s);

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
  live(el, fn) { this.lives.push({ el, fn }); fn(el); return el; }
  tick() { this.lives = this.lives.filter(l => l.el.isConnected); for (const l of this.lives) l.fn(l.el); }

  build() {
    const g = this.game, R = this.root;
    R.textContent = '';
    // top bar
    const res = h('div', { class: 'resbar' });
    for (const r in RES) {
      res.append(this.live(h('div', { class: 'res', title: RES[r].name }), el => {
        const v = g.state.res[r], cap = g.storageCap();
        el.textContent = ''; el.append(h('span', { class: 'ic' }, RES[r].icon), h('b', null, fmt(v)), h('small', null, '/' + fmt(cap)));
        el.classList.toggle('full', v >= cap * 0.95); el.classList.toggle('empty', v <= 0);
      }));
    }
    const pop = this.live(h('div', { class: 'res wide', title: 'Villagers / housing (idle)' }), el => {
      el.textContent = ''; const idle = g.idleVillagers().length;
      el.append(h('span', { class: 'ic' }, '👥'), h('b', null, `${g.pop}/${g.housing()}`), h('small', null, idle ? ` · ${idle} idle` : ''));
    });
    const army = this.live(h('div', { class: 'res', title: 'Soldiers' }), el => { el.textContent = ''; el.append(h('span', { class: 'ic' }, '⚔️'), h('b', null, String(g.soldiers().length))); });
    const harm = this.live(h('div', { class: 'res', title: 'Harmony: beauty buildings make villagers work faster' }), el => { el.textContent = ''; el.append(h('span', { class: 'ic' }, '🌸'), h('b', null, `+${g.harmony()}%`)); });
    const clock = this.live(h('button', { class: 'res clock', title: 'Pause (Space) · speed (F)', onclick: () => this.cycleSpeed() }), el => {
      const t = g.state.time, hr = Math.floor(t * 24), night = t < 0.22 || t > 0.8;
      el.textContent = ''; el.append(h('span', { class: 'ic' }, night ? '🌙' : '☀️'), h('b', null, `Day ${g.state.day}`), h('small', null, ` ${String(hr).padStart(2, '0')}:00 · ${this.paused ? '⏸' : this.speed + '×'}`));
    });
    const menu = h('button', { class: 'res menu', title: 'Menu', onclick: () => this.openMenu() }, '☰');
    R.append(h('header', { class: 'top' }, h('div', { class: 'brand' }, h('span', { class: 'kanji' }, '天下'), h('span', { class: 'word' }, 'Tenka')), res, pop, army, harm, h('div', { class: 'spacer' }), clock, menu));
    // build bar
    this.bar = h('section', { class: 'buildbar' });
    R.append(this.bar);
    this.renderBar();
    // selection panel, hint, toasts, modal
    this.panel = h('aside', { class: 'panel', hidden: true }); R.append(this.panel);
    this.hint = h('div', { class: 'hint', hidden: true }); R.append(this.hint);
    this.toasts = h('div', { class: 'toasts' }); R.append(this.toasts);
    this.modal = h('div', { class: 'modal', hidden: true }); R.append(this.modal);
    R.append(h('div', { class: 'keys' }, 'Drag: move · Scroll: pan · Pinch: zoom · Q/E: rotate · B: build · H: help'));
  }

  renderBar() {
    const g = this.game, bar = this.bar; bar.textContent = '';
    bar.classList.toggle('closed', !this.buildOpen);
    const tabs = h('div', { class: 'tabs' },
      CATEGORIES.map(c => h('button', { class: 'tab' + (c.id === this.cat ? ' on' : ''), onclick: () => { this.cat = c.id; this.buildOpen = true; this.renderBar(); } }, h('span', { class: 'ic' }, c.icon), c.name)),
      h('button', { class: 'tab toggle', title: 'Show/hide (B)', onclick: () => { this.buildOpen = !this.buildOpen; this.renderBar(); } }, this.buildOpen ? '▾' : '▴ Build'));
    bar.append(tabs);
    if (!this.buildOpen) return;
    const row = h('div', { class: 'cards' });
    for (const [type, d] of Object.entries(BUILDINGS)) {
      if (d.cat !== this.cat) continue;
      const cost = h('div', { class: 'cost' }, Object.keys(d.cost).map(r => this.live(h('span', null, RES[r].icon, d.cost[r]), el => el.classList.toggle('short', g.state.res[r] < d.cost[r]))));
      const card = h('button', { class: 'card', title: d.desc, onclick: () => this.input.startPlacing(type) },
        h('span', { class: 'kanji' }, d.kanji), h('span', { class: 'nm' }, d.name), cost);
      card.dataset.type = type;
      row.append(card);
    }
    bar.append(row);
  }

  onPlacing(P) {
    document.querySelectorAll('.card').forEach(c => c.classList.toggle('on', !!P && c.dataset.type === P.type && !P.moveId));
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
      h('small', null, `  R: rotate · Esc: cancel${P && !P.moveId && !BUILDINGS[P.type].line ? ' · Shift+click: place more' : ''}`),
      h('button', { class: 'mini', onclick: () => this.input.cancelPlacing() }, 'Cancel'),
      h('button', { class: 'mini', onclick: () => this.input.rotatePlacing() }, '⟳ Rotate')].filter(Boolean));
  }

  /* ---------- selection panel ---------- */
  onSelect(sel) { this.sel = sel; this.confirmDemolish = false; this.renderPanel(); }
  renderPanel() {
    const p = this.panel, sel = this.sel, g = this.game;
    p.textContent = '';
    if (!sel) { p.hidden = true; return; }
    p.hidden = false;
    const close = h('button', { class: 'x', title: 'Close (Esc)', onclick: () => this.input.select(null) }, '✕');
    if (sel.kind === 'building') {
      const b = g.buildings.get(sel.id); if (!b) { p.hidden = true; return; }
      const d = b.def;
      p.append(close, h('div', { class: 'phead' }, h('span', { class: 'kanji big' }, d.kanji), h('div', null, h('h2', null, d.name),
        this.live(h('p', { class: 'sub' }), el => { el.textContent = b.done ? 'Complete' : `Under construction · ${Math.floor(b.progress * 100)}%`; }))),
        h('p', { class: 'desc' }, d.desc));
      if (!b.done) {
        p.append(this.bar2(() => b.progress), this.live(h('p', { class: 'sub' }), el => {
          const n = [...g.villagers.values()].filter(v => v.site === b.id).length;
          el.textContent = n ? `${n} villager${n > 1 ? 's' : ''} building` : g.state.settings.autoBuild ? 'Waiting for an idle villager to come and build' : 'Auto-build is off — turn it on in the menu';
        }));
      }
      const facts = [];
      if (d.housing) facts.push(['Homes', `${d.housing} villagers`]);
      if (d.storage) facts.push(['Storage', `+${d.storage} of each`]);
      if (d.beauty) facts.push(['Harmony', `+${d.beauty} beauty`]);
      if (d.dropoff === 'wood') facts.push(['Drop-off', 'Wood']);
      if (facts.length) p.append(h('dl', { class: 'kv' }, facts.map(([k, v]) => [h('dt', null, k), h('dd', null, v)])));
      if (d.jobs) {
        const J = JOBS[d.job];
        p.append(h('div', { class: 'jobs' },
          h('div', { class: 'jrow' }, h('b', null, d.trains ? 'Recruits' : `${J.name}s`),
            this.live(h('span', { class: 'count' }), el => { el.textContent = `${b.workers.length} / ${d.jobs}`; }),
            h('button', { class: 'mini', title: 'Remove a worker', onclick: () => { g.assign(b, -1); this.renderPanel(); } }, '−'),
            h('button', { class: 'mini', title: 'Add an idle villager', onclick: () => { g.assign(b, +1); this.renderPanel(); } }, '+')),
          d.trains ? h('p', { class: 'sub' }, `Each recruit costs ${this.costText(d.trainCost)} and trains for ${d.trainTime}s → ${JOBS[d.trains].name}`) : null,
          h('ul', { class: 'names' }, b.workers.map(id => {
            const v = g.villagers.get(id); if (!v) return null;
            return h('li', null, h('button', { class: 'link', onclick: () => this.input.select({ kind: 'villager', id }) }, v.name),
              d.trains ? this.bar2(() => (v.train || 0) / d.trainTime) : this.live(h('small', null), el => { el.textContent = v.status; }));
          }))));
      }
      if (d.garrison) {
        p.append(this.live(h('p', { class: 'sub' }), el => {
          const n = [...g.villagers.values()].filter(v => v.post && v.post.b === b.id).length;
          el.textContent = `Archers on watch: ${n} / ${d.garrison}` + (g.countJob('archer') ? '' : ' — train archers at a Kyūdō Range');
        }));
      }
      const actions = h('div', { class: 'actions' });
      if (b.type !== 'townhall') {
        actions.append(h('button', { class: 'btn ghost', title: 'Move (M)', onclick: () => this.input.startPlacing(b.type, b.id) }, '✥ Move'));
        actions.append(h('button', { class: 'btn danger', title: 'Demolish (Delete)', onclick: () => this.demolishSelected() }, this.confirmDemolish ? 'Really demolish?' : '🗑 Demolish'));
      } else actions.append(h('button', { class: 'btn ghost', title: 'Move (M)', onclick: () => this.input.startPlacing(b.type, b.id) }, '✥ Move'));
      p.append(actions);
    } else {
      const v = g.villagers.get(sel.id); if (!v) { p.hidden = true; return; }
      const J = JOBS[v.job], work = v.work ? g.buildings.get(v.work) : null;
      p.append(close, h('div', { class: 'phead' }, h('span', { class: 'kanji big' }, J.soldier ? '侍' : '人'), h('div', null, h('h2', null, v.name), h('p', { class: 'sub' }, J.name + (work ? ` · ${work.def.name}` : '')))),
        this.live(h('p', { class: 'desc status' }), el => { el.textContent = v.status || '…'; }));
      if (J.desc) p.append(h('p', { class: 'sub' }, J.desc));
      if (v.job === 'trainee' && work) p.append(this.bar2(() => (v.train || 0) / work.def.trainTime));
      const actions = h('div', { class: 'actions' });
      actions.append(h('button', { class: 'btn ghost', onclick: () => { this.cam.follow = () => g.villagers.get(v.id) && g.villagers.get(v.id).pos; } }, '👁 Follow'));
      if (v.job !== 'idle' && !J.soldier) actions.append(h('button', { class: 'btn ghost', onclick: () => { g.setJob(v, 'idle'); this.renderPanel(); } }, 'Stop working'));
      p.append(actions);
      if (v.job === 'idle') {
        const open = [...g.buildings.values()].filter(b => b.done && b.def.jobs && b.workers.length < b.def.jobs);
        p.append(h('p', { class: 'sub' }, open.length ? 'Give a job:' : 'No free jobs — build a field, camp, quarry, mine or dojo.'),
          h('div', { class: 'jobgrid' }, open.slice(0, 8).map(b => h('button', { class: 'btn ghost small', onclick: () => { g.setJob(v, b.def.job, b.id); this.renderPanel(); } }, `${b.def.kanji} ${JOBS[b.def.job].name}`))));
      }
    }
  }
  bar2(frac) { const i = h('i'); return this.live(h('div', { class: 'bar' }, i), () => { i.style.width = Math.min(100, Math.max(0, frac() * 100)).toFixed(1) + '%'; }); }
  costText(c) { return Object.keys(c).map(r => `${RES[r].icon}${c[r]}`).join(' '); }
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
    setTimeout(() => t.remove(), 3800);
  }
  sound(kind) {
    if (!this.settings.sound) return;
    try {
      this.ac = this.ac || new (window.AudioContext || window.webkitAudioContext)();
      const notes = { place: [392, 523], done: [523, 659, 784], click: [660] }[kind] || [440];
      notes.forEach((f, i) => { const t = this.ac.currentTime + i * 0.09, o = this.ac.createOscillator(), gn = this.ac.createGain(); o.type = 'sine'; o.frequency.value = f; gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.05, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(gn).connect(this.ac.destination); o.start(t); o.stop(t + 0.32); });
    } catch (_) { /* sound optional */ }
  }
  cycleSpeed() { if (this.paused) { this.paused = false; } else this.speed = this.speed >= 3 ? 1 : this.speed + 1; this.tick(); }

  /* ---------- dialogs ---------- */
  openModal(title, body, buttons = [{ label: 'Close' }]) {
    const m = this.modal; m.textContent = ''; m.hidden = false;
    const close = () => { m.hidden = true; };
    m.append(h('div', { class: 'scrim', onclick: close }), h('div', { class: 'sheet' }, h('h2', null, title), body,
      h('div', { class: 'actions' }, buttons.map(b => h('button', { class: 'btn ' + (b.cls || ''), onclick: () => { if (b.fn) b.fn(); if (!b.keep) close(); } }, b.label)))));
  }
  showHelp() {
    const rows = [['Drag the ground', 'Move the camera'], ['Two-finger scroll', 'Move the camera'], ['Pinch  /  Z X', 'Zoom'], ['Q / E', 'Rotate the camera'], ['W A S D  /  arrows', 'Move the camera'],
      ['Click', 'Select a building or villager'], ['B', 'Show / hide the build menu'], ['R', 'Rotate while placing'], ['Shift + click', 'Keep placing the same building'],
      ['M', 'Move the selected building'], ['Delete', 'Demolish (press twice)'], ['Space', 'Pause'], ['F', 'Game speed 1× / 2× / 3×'], ['Esc', 'Cancel / close']];
    this.openModal('How to play', h('div', null,
      h('p', null, 'Build your clan’s village in the valley. Villagers do the work: give them jobs at fields, camps, quarries and mines — idle villagers build new buildings on their own. Houses bring new families; shrines and gardens raise Harmony, which makes everyone work faster. Train recruits at the Dojo and Kyūdō Range to raise an army.'),
      h('dl', { class: 'kv keys2' }, rows.map(([k, v]) => [h('dt', null, k), h('dd', null, v)]))));
  }
  openMenu() {
    const s = this.game.state.settings;
    const toggle = (label, get, set) => h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: get() ? true : null, onchange: e => set(e.target.checked) }), label);
    const q = localStorage.getItem('tenka.quality') || 'auto';
    this.openModal('Menu', h('div', { class: 'menu' },
      toggle('Idle villagers build automatically', () => s.autoBuild, v => { s.autoBuild = v; }),
      toggle('Welcome new villagers when there is room', () => s.welcome, v => { s.welcome = v; }),
      toggle('Two-finger scroll moves the camera (off: zooms)', () => this.settings.scrollPans, v => { this.settings.scrollPans = v; this.saveSettings(); }),
      toggle('Sound', () => this.settings.sound, v => { this.settings.sound = v; this.saveSettings(); this.sound('click'); }),
      h('div', { class: 'row' }, h('span', null, 'Graphics: '), ['low', 'medium', 'high'].map(k => h('button', { class: 'btn small ' + (q === k ? '' : 'ghost'), onclick: () => { try { localStorage.setItem('tenka.quality', k); } catch (_) { /* */ } this.saver(); location.reload(); } }, k))),
      h('p', { class: 'sub' }, 'Your village saves automatically on this device.')),
      [{ label: 'How to play', cls: 'ghost', fn: () => setTimeout(() => this.showHelp(), 0) },
       { label: 'Start over', cls: 'danger', keep: true, fn: () => this.confirmReset() },
       { label: 'Close' }]);
  }
  confirmReset() {
    this.openModal('Start a new village?', h('p', null, 'Everything you have built will be erased. This cannot be undone.'),
      [{ label: 'Keep playing', cls: 'ghost' }, { label: 'Erase and start over', cls: 'danger', fn: () => { this.saver(true); location.reload(); } }]);
  }
  showAway(r) {
    const rows = Object.entries(r.res).filter(([, v]) => v !== 0).map(([k, v]) => h('span', { class: 'chip' }, RES[k].icon, (v > 0 ? '+' : '') + v));
    this.openModal('While you were away…', h('div', null,
      h('p', null, `${fmtTime(r.sec)} passed in the valley. Your people kept working${r.sec >= ECON.offlineCapHours * 3600 ? ' (up to 4 hours count)' : ''}.`),
      h('div', { class: 'chips' }, rows),
      r.built ? h('p', null, `🏗 ${r.built} building${r.built > 1 ? 's' : ''} finished.`) : null,
      r.trained ? h('p', null, `⚔️ ${r.trained} recruit${r.trained > 1 ? 's' : ''} finished training.`) : null));
  }

  /* ---------- keyboard ---------- */
  onKey(k, e) {
    const I = this.input;
    if (k === 'escape') { if (!this.modal.hidden) this.modal.hidden = true; else if (I.placing) I.cancelPlacing(); else { I.select(null); this.cam.follow = null; } return; }
    if (!this.modal.hidden) return;
    if (k === 'r') return I.rotatePlacing();
    if (k === 'b') { this.buildOpen = !this.buildOpen; return this.renderBar(); }
    if (k === 'h' || k === '?') return this.showHelp();
    if (k === ' ') { this.paused = !this.paused; return this.tick(); }
    if (k === 'f') return this.cycleSpeed();
    if (k === 'delete' || k === 'backspace') return this.demolishSelected();
    if (k === 'm' && this.sel && this.sel.kind === 'building') { const b = this.game.buildings.get(this.sel.id); if (b) I.startPlacing(b.type, b.id); }
  }
}
