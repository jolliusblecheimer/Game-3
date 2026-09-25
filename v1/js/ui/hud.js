// All on-screen interface: resources, clan panel, build menu with info cards, selection panel, toasts, dialogs.
import { BUILDINGS, CATEGORIES, RES, JOBS, ECON, TOWNHALL, MAX_TH, COMMANDERS, RESEARCH, SITES, DOJO_TRAINS } from '../game/data.js';
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
// what each Town Hall level unlocks
function unlocksAt(level) { return Object.entries(BUILDINGS).filter(([, d]) => (d.th || 1) === level && d.cat).map(([, d]) => d.name); }

export class Hud {
  constructor(game) {
    this.game = game;
    this.root = $('#ui');
    this.cat = 'village';
    this.buildOpen = true;
    this.settings = { scrollPans: true, sound: false, music: true, musicVol: 0.6 };
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem('tenka.classic.ui') || '{}')); } catch (_) { /* no storage */ }
    // scrolling now zooms by default (two-finger scroll / mouse wheel); drag to move
    if (!this.settings.zoomV) { this.settings.scrollPans = false; this.settings.zoomV = 1; this.saveSettings(); }
    this.speed = 1; this.paused = false;
    this.lives = [];
    this.build();
    game.on((type, data) => this.onGame(type, data));
  }
  saveSettings() { try { localStorage.setItem('tenka.classic.ui', JSON.stringify(this.settings)); } catch (_) { /* ignore */ } }
  attach(input, cam, saver) { this.input = input; this.cam = cam; this.saver = saver; }

  live = (el, fn) => { this.lives.push({ el, fn }); fn(el); return el; };
  tick() {
    this.lives = this.lives.filter(l => l.el.isConnected); for (const l of this.lives) l.fn(l.el);
    this.layout();
    if (this.barTh !== undefined && this.barTh !== this.game.thLevel) this.renderBar(); // the Keep changed level: unlock cards
  }

  build() {
    const g = this.game, R = this.root;
    R.textContent = '';
    // top: resources on the left, time and menu on the right
    const res = h('div', { class: 'resbar' });
    for (const r in RES) res.append(this.live(h('div', { class: 'res', title: RES[r].name }), el => {
      const v = g.state.res[r], cap = g.storageCap(); el.textContent = '';
      el.append(icon(RES[r].icon, 20), h('b', null, fmt(v)), h('small', null, '/' + fmt(cap)));
      el.classList.toggle('full', v >= cap * 0.95); el.classList.toggle('empty', v <= 0);
    }));
    const night = () => g.state.time < 0.22 || g.state.time > 0.8;
    const clock = this.live(h('button', { class: 'res clock', title: 'Pause (Space) · speed (F)', onclick: () => this.cycleSpeed() }), el => {
      const hr = Math.floor(g.state.time * 24); el.textContent = '';
      el.append(icon(night() ? 'moon' : 'sun', 20), h('b', null, `Day ${g.state.day}`), h('small', null, ` ${String(hr).padStart(2, '0')}:00 · ${this.paused ? 'paused' : this.speed + '×'}`));
    });
    const menu = h('button', { class: 'res menu', title: 'Menu', onclick: () => this.openMenu() }, icon('menu', 20));
    R.append(h('header', { class: 'top' }, h('div', { class: 'brand' }, h('span', { class: 'kanji' }, '天下'), h('span', { class: 'word' }, 'Tenka v1')), res, h('div', { class: 'spacer' }), clock, this.muteBtn = h('button', { class: 'res menu mute', title: 'Mute / unmute all sound (N)', onclick: () => this.toggleMute() }), menu));
    this.renderMute();
    // raid warnings under the top bar
    this.raidBanner = this.live(h('div', { class: 'raidbanner', hidden: true }), el => {
      const R = g.raids, show = R.alarmed;
      el.hidden = !show; if (!show) return;
      el.textContent = '';
      el.append(icon(R.source ? 'castle' : 'camp', 20), h('b', null, `${R.source ? 'Attack' : 'Bandit raid'}! ${R.bandName(R.alive().length)} in the village`),
        h('small', null, 'Your soldiers fight, archers shoot from towers, everyone else hides.'));
    });
    R.append(this.raidBanner);
    // bottom-left: the clan at a glance
    this.clan = h('section', { class: 'clan' }); R.append(this.clan);
    this.renderClan();
    // bottom-centre: build menu
    this.bar = h('section', { class: 'buildbar' }); R.append(this.bar);
    this.info = h('div', { class: 'info', hidden: true }); R.append(this.info);
    this.renderBar();
    // bottom-right: map
    this.mapBtn = h('button', { class: 'mapbig', title: 'Country map (M)', onclick: () => this.onMap && this.onMap() }, icon('map', 34), h('b', null, 'Map'));
    R.append(this.mapBtn);
    // right edge: turn the camera, and move mode
    const activeCam = () => { const v = window.tenkaView; return v && v.active && v.cam ? v.cam : this.cam; };
    this.moveBtn = h('button', { class: 'ctool mv', title: 'Move mode (G): drag buildings to move them', onclick: () => this.input.setMoveMode(!this.input.moveMode) }, icon('move', 22), h('small', null, 'Move'));
    R.append(h('div', { class: 'camtools' },
      h('button', { class: 'ctool', title: 'Turn the view left (Q)', onclick: () => activeCam().rotate(Math.PI / 4) }, h('span', { class: 'flip' }, icon('rotate', 22)), h('small', null, 'Turn')),
      h('button', { class: 'ctool', title: 'Turn the view right (E)', onclick: () => activeCam().rotate(-Math.PI / 4) }, icon('rotate', 22), h('small', null, 'Turn')),
      this.moveBtn));
    this.panel = h('aside', { class: 'panel', hidden: true }); R.append(this.panel);
    // never rebuild the panel under a finger: a click would be lost, so wait until it's released
    this.panel.addEventListener('pointerdown', () => { this.panelPress = true; });
    const release = () => { if (!this.panelPress) return; this.panelPress = false; if (this.panelDirty) { this.panelDirty = false; setTimeout(() => this.renderPanel(), 0); } };
    window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release);
    this.hint = h('div', { class: 'hint', hidden: true }); R.append(this.hint);
    this.toasts = h('div', { class: 'toasts' }); R.append(this.toasts);
    this.modal = h('div', { class: 'modal', hidden: true }); R.append(this.modal);
  }
  renderClan() {
    const g = this.game, C = this.clan; C.textContent = '';
    const row = (ic, label, fn, title) => this.live(h('div', { class: 'crow', title }, icon(ic, 20), h('span', null, label), h('b')), el => { el.lastChild.textContent = fn(); });
    C.append(
      h('button', { class: 'crest', title: 'Select the Keep', onclick: () => { const k = g.keep; if (k) this.input.select({ kind: 'building', id: k.id }); } },
        h('span', { class: 'kanji' }, '天守'), this.live(h('span', null), el => { el.textContent = `Keep · level ${g.thLevel}`; })),
      row('people', 'Villagers', () => `${g.pop} / ${g.housing()}`, 'Villagers / homes'),
      this.live(h('button', { class: 'crow link2', title: 'Select an unemployed villager', onclick: () => { const v = g.idleVillagers()[0]; if (v) this.input.select({ kind: 'villager', id: v.id }); } }, icon('worker', 20), h('span', null, 'Unemployed'), h('b')), el => { el.lastChild.textContent = String(g.idleVillagers().length); el.classList.toggle('attn', g.idleVillagers().length > 0); }),
      row('build', 'Building', () => String(g.building()), 'Villagers working on construction. Unemployed villagers build on their own.'),
      this.live(h('button', { class: 'crow link2', title: 'Your army: every soldier and commander', onclick: () => this.openArmy() }, icon('soldier', 20), h('span', null, 'Army'), h('b')), el => { const all = g.soldiers(true).length, here = g.soldiers().length; el.lastChild.textContent = all > here ? `${here} (+${all - here} away)` : String(here); }),
      this.live(h('button', { class: 'crow link2', title: 'Harmony: see where it comes from', onclick: () => this.openHarmony() }, icon('sakura', 20), h('span', null, 'Harmony'), h('b')), el => { el.lastChild.textContent = `+${g.harmony()}%`; }),
    );
  }

  /* ---------- build menu ---------- */
  renderBar() {
    const g = this.game, bar = this.bar; bar.textContent = ''; this.barTh = g.thLevel;
    this.hideInfo(true);
    bar.classList.toggle('closed', !this.buildOpen);
    const tabs = h('div', { class: 'tabs' },
      CATEGORIES.map(c => h('button', { class: 'tab' + (c.id === this.cat ? ' on' : ''), onclick: () => { this.cat = c.id; this.buildOpen = true; this.renderBar(); } }, icon(c.icon, 20), c.name)),
      h('button', { class: 'tab toggle', title: 'Show / hide (B)', onclick: () => { this.buildOpen = !this.buildOpen; this.renderBar(); } }, icon(this.buildOpen ? 'down' : 'up', 18), this.buildOpen ? '' : 'Build'));
    bar.append(tabs);
    if (!this.buildOpen) return;
    const row = h('div', { class: 'cards' });
    if (this.cat === 'village') {
      row.append(h('div', { class: 'card tool', role: 'button', tabindex: '0', title: 'Mark trees and boulders for your villagers to clear',
        onclick: () => this.input.startClearing(), onpointerenter: e => { if (e.pointerType !== 'touch') this.showToolInfo(e.currentTarget); }, onpointerleave: () => this.hideInfo() },
        h('span', { class: 'art thumb' }, icon('demolish', 40)), h('span', { class: 'nm' }, 'Clear land'), h('span', { class: 'cost' }, h('span', { class: 'c free' }, 'Villagers do it'))));
    }
    for (const [type, d] of Object.entries(BUILDINGS)) {
      if (d.cat !== this.cat) continue;
      const locked = (d.th || 1) > g.thLevel, lim = g.buildLimit(type), have = lim !== null ? g.countType(type) : 0, full = !locked && lim !== null && have >= lim;
      const infoBtn = h('button', { class: 'infobtn', title: 'What does it do?', onclick: e => { e.stopPropagation(); this.toggleInfo(type, card); } }, icon('info', 16));
      const card = h('div', { class: 'card' + (locked || full ? ' locked' : ''), role: 'button', tabindex: '0',
        onclick: () => { if (locked) { this.toggleInfo(type, card); this.toast(`Upgrade your Keep to level ${d.th} to build the ${d.name}`, 'warn'); } else if (full) this.toast(lim ? `You have all ${lim} allowed (${d.name}) — upgrade them, or upgrade the Keep to build more` : `The ${d.name} unlocks at a higher Keep level`, 'warn'); else this.input.startPlacing(type); },
        onpointerenter: e => { if (e.pointerType !== 'touch') this.showInfo(type, card); }, onpointerleave: () => this.hideInfo() },
        art('building', type, d.kanji, 'thumb'), h('span', { class: 'nm' }, d.name),
        locked ? h('span', { class: 'lock' }, `Keep level ${d.th}`) : costChips(g, d.cost, this.live), infoBtn);
      if (lim !== null && !locked && lim > 1) card.append(h('span', { class: 'limit' + (full ? ' full' : '') }, `${have}/${lim}`));
      card.dataset.type = type;
      row.append(card);
    }
    bar.append(row);
  }
  infoRows(type, b = null) {
    const g = this.game, d = BUILDINGS[type], L = b ? b.level : 1, rows = [];
    const row = (ic, text) => rows.push(h('div', { class: 'irow' }, icon(ic, 18), h('span', null, text)));
    if (type === 'townhall') {
      const T = TOWNHALL[L];
      row('house', `Homes for ${T.housing} villagers`); row('storage', `Stores ${T.storage} of every resource`);
      row('camp', `Raids grow with your village: about one raider for every 3–4 villagers (now ${g.raids.popBand()})${g.thLevel >= 4 ? ' — the warlords now send real soldiers' : ''}`);
      return rows;
    }
    if (d.housing) row('house', `Homes for ${d.housing + (d.housingUp || 2) * (L - 1)} villagers${!b && (d.maxLevel || 1) > 1 ? ` (+${d.housingUp || 2} per upgrade)` : ''}`);
    if (d.storage) row('storage', `Stores ${d.storage + 300 * (L - 1)} more of every resource`);
    if (d.jobs) {
      const J = JOBS[d.job], n = d.jobs + (L - 1);
      if (d.trains) { const T = b ? g.trainInfo(b) : { to: d.trains, time: d.trainTime, cost: d.trainCost }; row('katana', `${n} trainees at a time → ${JOBS[T.to].name} after ${T.time}s (each costs ${this.costText(T.cost)})`); }
      else row(J.res ? RES[J.res].icon : 'worker', `Up to ${n} ${J.name.toLowerCase()}s, each bringing ${J.amount} ${RES[J.res].name.toLowerCase()} per trip${L > 1 ? ` — ${Math.round((g.levelMult(b) - 1) * 100)}% faster` : ''}`);
    }
    if (d.dropoff === 'wood') row('wood', 'Woodcutters drop logs here — build it near trees');
    if (d.dropoff === 'all' && type !== 'townhall') row('storage', 'Workers deliver goods here — build it near fields and mines');
    if (d.beauty) { const now = g.harmony(), next = g.harmony(d.beauty); row('sakura', b ? `+${d.beauty}% Harmony (your village: +${now}%)` : `+${d.beauty}% Harmony — everyone works faster${now >= 30 ? ' (you are already at the +30% maximum)' : ` (+${now}% → +${next}%)`}`); }
    if (d.relax) row('people', d.relax === 'pray' ? 'Villagers with free time come here to pray' : 'Villagers with free time come here to relax');
    if (d.garrison) row('soldier', `${d.garrison} archers stand watch up here${L > 1 ? `, shooting ${4 * (L - 1)} further` : ''}`);
    if (d.road) row('road', `Villagers walk ${Math.round((d.road - 1) * 100)}% faster and follow roads`);
    if (d.hp) row('wall', `Strength ${b ? `${Math.round(b.hp)} / ${g.maxHp(b)}` : d.hp} — bandits must break it to get through`);
    if (type === 'gate') row('wall', 'Your people pass through; bandits must break it down');
    if (type === 'hedge') row('soldier', 'Troops standing in a hedge are hidden from enemies');
    if (type === 'spikes') row('wall', 'Slows attackers and wounds them as they push through');
    if (d.upgradeTo) row('up', `Can be rebuilt as a ${BUILDINGS[d.upgradeTo].name} at Keep level ${BUILDINGS[d.upgradeTo].th}`);
    else if ((d.maxLevel || 1) > 1 && !b) row('up', `Can be upgraded up to level ${d.maxLevel}${d.grow ? ' — it grows bigger at levels ' + Object.keys(d.grow).join(' and ') : ''}`);
    return rows;
  }
  infoCard(type) {
    const d = BUILDINGS[type], [w, dd] = d.size, locked = (d.th || 1) > this.game.thLevel;
    return h('div', { class: 'icard' },
      h('div', { class: 'ihead' }, art('building', type, d.kanji, 'big'), h('div', null, h('h3', null, d.name), h('span', { class: 'kan' }, d.kanji))),
      h('p', null, d.desc),
      locked ? h('div', { class: 'irow warnrow' }, icon('castle', 18), h('span', null, `Unlocks at Keep level ${d.th}`)) : null,
      h('div', { class: 'irow' }, icon('hourglass', 18), h('span', null, d.time ? `Your villagers need about ${fmtTime(d.time)}` : 'Laid instantly')),
      h('div', { class: 'irow' }, icon('grid', 18), h('span', null, `Size ${w} × ${dd}` + (d.line ? ' — drawn as a line' : ''))),
      this.infoRows(type),
      h('div', { class: 'irow costrow' }, h('b', null, 'Cost'), costChips(this.game, d.cost, this.live)));
  }
  showToolInfo(card) {
    this.info.textContent = '';
    this.info.append(h('div', { class: 'icard' }, h('div', { class: 'ihead' }, h('span', { class: 'art big' }, icon('demolish', 44)), h('div', null, h('h3', null, 'Clear land'))),
      h('p', null, 'Click one corner, then the other, to mark every tree and boulder in between. Your free villagers fell the trees and break up the rocks, bringing back wood and stone.'),
      h('div', { class: 'irow' }, icon('build', 18), h('span', null, 'Unemployed villagers do this on their own'))));
    this.placeInfo(card);
  }
  placeInfo(card) {
    this.info.hidden = false;
    const r = card.getBoundingClientRect(), bw = this.info.offsetWidth || 320;
    this.info.style.left = Math.max(12, Math.min(window.innerWidth - bw - 12, r.left + r.width / 2 - bw / 2)) + 'px';
    this.info.style.bottom = (window.innerHeight - this.bar.getBoundingClientRect().top + 10) + 'px';
  }
  showInfo(type, card, pinned = false) {
    if (this.infoPinned && !pinned) return;
    this.info.textContent = ''; this.info.append(this.infoCard(type));
    this.infoType = type; this.placeInfo(card);
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
    this.hint.hidden = false;
    if (P.type === 'clear') { this.hintBase = 'Clear land'; this.placingHint(true, 'Click one corner of the area'); return; }
    const def = BUILDINGS[P.type];
    this.hintBase = P.moveId ? `Moving ${def.name}` : `Placing ${def.name}`;
    this.placingHint(true, def.line ? 'Click where the line should start' : '');
  }
  onMoveMode(on) {
    this.moveBtn.classList.toggle('on', on);
    if (this.input.placing) return;
    this.hint.hidden = !on; if (!on) return;
    this.hint.textContent = '';
    this.hint.append(h('b', null, 'Move mode'), h('span', null, ' — drag any building to a new spot'), h('small', null, '  R while dragging: rotate · G / Esc: finish'),
      h('button', { class: 'mini', onclick: () => this.input.setMoveMode(false) }, icon('close', 14), 'Done'));
  }
  placingHint(ok, why) {
    if (!this.hint || this.hint.hidden) return;
    this.lastWhy = why;
    const P = this.input && this.input.placing, line = P && (P.type === 'clear' || BUILDINGS[P.type].line);
    this.hint.textContent = '';
    this.hint.append(...[h('b', null, this.hintBase || ''), why ? h('span', { class: ok ? '' : 'bad' }, ' — ' + why) : null,
      h('small', null, line ? '  Esc: stop' : `  R: rotate · Esc: cancel${P && !P.moveId ? ' · Shift+click: place more' : ''}`),
      h('button', { class: 'mini', onclick: () => this.input.cancelPlacing() }, icon('close', 14), 'Done'),
      line ? null : h('button', { class: 'mini', onclick: () => this.input.rotatePlacing() }, icon('rotate', 14), 'Rotate')].filter(Boolean));
  }

  /* ---------- selection panel ---------- */
  onSelect(sel) { this.sel = sel; this.confirmDemolish = false; this.renderPanel(); }
  renderPanel() {
    if (this.panelPress) { this.panelDirty = true; return; }
    const p = this.panel, sel = this.sel, g = this.game;
    const key = sel ? sel.kind + sel.id : '', scroll = key && key === this.panelKey ? p.scrollTop : 0; this.panelKey = key;
    requestAnimationFrame(() => { if (this.panelKey === key) p.scrollTop = scroll; });
    p.textContent = '';
    if (!sel) { p.hidden = true; return; }
    p.hidden = false;
    const close = h('button', { class: 'x', title: 'Close (Esc)', onclick: () => this.input.select(null) }, icon('close', 16));
    if (sel.kind === 'segment') return this.segmentPanel(p, close);
    if (sel.kind === 'building') {
      const b = g.buildings.get(sel.id); if (!b) { p.hidden = true; return; }
      const d = b.def, maxL = d.maxLevel || 1;
      p.append(close, h('div', { class: 'phead' }, art('building', b.type, d.kanji, 'big'), h('div', null, h('h2', null, d.name),
        this.live(h('p', { class: 'sub' }), el => { el.textContent = !b.done ? `Under construction · ${Math.floor(b.progress * 100)}%` : b.upg ? `Upgrading to level ${b.upg.level} · ${Math.floor(b.upg.progress * 100)}%` : maxL > 1 ? `Level ${b.level} of ${maxL}` : 'Complete'; }))),
        h('p', { class: 'desc' }, d.desc));
      if (!b.done || b.upg) {
        p.append(this.bar2(() => b.done ? b.upg && b.upg.progress : b.progress), this.live(h('p', { class: 'sub' }), el => {
          const n = [...g.villagers.values()].filter(v => v.site === b.id).length, free = g.idleVillagers().length;
          el.textContent = n ? `${n} villager${n > 1 ? 's' : ''} at work` : free ? 'Waiting for a free villager' : 'Nobody is free! Click a worker and press “Aid construction”, or make someone unemployed.';
        }));
        p.append(h('button', { class: 'btn small ' + (b.prio ? 'gold' : 'ghost'), title: 'Villagers finish prioritised buildings first', onclick: () => { b.prio = !b.prio; for (const v of g.villagers.values()) if ((v.job === 'idle' || v.aid) && v.site !== b.id) v.reset = true; this.renderPanel(); } }, icon('flag', 16), b.prio ? 'Priority — villagers come here first' : 'Make this a priority'));
      }
      const rows = this.infoRows(b.type, b);
      if (rows.length) p.append(h('div', { class: 'irows' }, rows));
      if (d.hp) p.append(this.bar2(() => b.hp / g.maxHp(b), 'hp'));
      // workers
      const slots = g.jobSlots(b);
      if (slots && b.done) {
        const J = JOBS[d.job];
        p.append(h('div', { class: 'jobs' },
          h('div', { class: 'jrow' }, art('person', J.look, null, 'face'), h('b', null, b.type === 'dojo' ? `${JOBS[g.trainInfo(b).to].name} trainees` : `${J.name}s`),
            this.live(h('span', { class: 'count' }), el => { el.textContent = `${b.workers.length} / ${g.jobSlots(b)}`; }),
            h('button', { class: 'mini', title: 'Send one back to being unemployed', onclick: () => { g.assign(b, -1); this.renderPanel(); } }, '−'),
            h('button', { class: 'mini', title: 'Hire an unemployed villager', onclick: () => { g.assign(b, +1); this.renderPanel(); } }, '+')),
          this.live(h('p', { class: 'sub' }), el => { const n = g.idleVillagers().length; el.textContent = n ? `${n} unemployed villager${n > 1 ? 's' : ''} can be hired` : 'Nobody is unemployed right now'; }),
          h('ul', { class: 'names' }, b.workers.map(id => {
            const v = g.villagers.get(id); if (!v) return null;
            return h('li', null, art('person', JOBS[v.job].look, null, 'face'), h('div', null, h('button', { class: 'link', onclick: () => this.input.select({ kind: 'villager', id }) }, v.name),
              d.trains ? this.bar2(() => (v.train || 0) / g.trainInfo(b).time) : this.live(h('small', null), el => { el.textContent = v.status; })));
          }))));
      }
      if (d.garrison && b.done) {
        p.append(this.live(h('p', { class: 'sub' }), el => {
          const n = [...g.villagers.values()].filter(v => v.post && v.post.b === b.id).length;
          el.textContent = `Archers on watch: ${n} / ${d.garrison}` + (g.countJob('archer') ? '' : ' — train archers at a Kyūdō Range');
        }));
      }
      if (d.line) { const seg = g.segmentOf(b.id); if (seg.length > 1) p.append(h('button', { class: 'btn ghost', title: 'Or double-click any piece', onclick: () => this.input.selectSegment(b.id) }, icon(d.road ? 'road' : 'wall', 16), `Select the whole ${d.road ? 'road' : b.type === 'wall' || b.type === 'palisade' ? 'wall' : 'line'} (${seg.length} pieces)`)); }
      if (b.type === 'townhall') this.keepSection(p, b);
      else this.upgradeSection(p, b);
      const actions = h('div', { class: 'actions' });
      actions.append(h('button', { class: 'btn ghost', title: 'Move', onclick: () => this.input.startPlacing(b.type, b.id) }, icon('move', 16), 'Move'));
      if (b.type !== 'townhall') actions.append(h('button', { class: 'btn danger', title: 'Demolish (Delete)', onclick: () => this.demolishSelected() }, icon('demolish', 16), this.confirmDemolish ? 'Really demolish?' : 'Demolish'));
      p.append(actions);
      if (this.extraPanel) this.extraPanel(p, b);
    } else {
      const v = g.villagers.get(sel.id); if (!v) { p.hidden = true; return; }
      const J = JOBS[v.job], work = v.work ? g.buildings.get(v.work) : null;
      p.append(close, h('div', { class: 'phead' }, art('person', J.look, null, 'big'), h('div', null, h('h2', null, v.name), h('p', { class: 'sub' }, g.jobName(v) + (work ? ` · ${work.def.name}` : '') + (v.aid ? ' · aiding construction' : '')))),
        this.live(h('p', { class: 'desc status' }), el => { el.textContent = v.status || '…'; }));
      if (J.desc) p.append(h('p', { class: 'sub' }, J.desc));
      if (v.hpf != null) p.append(h('div', { class: 'irow' }, icon('soldier', 16), h('span', null, 'Wounded'), this.bar2(() => v.hpf == null ? 1 : v.hpf, 'hp')));
      if ((v.job === 'trainee' || v.job === 'trainee_archer') && work) p.append(this.bar2(() => (v.train || 0) / g.trainInfo(work).time));
      const actions = h('div', { class: 'actions' });
      actions.append(h('button', { class: 'btn ghost', onclick: () => { this.cam.follow = () => g.villagers.get(v.id) && g.villagers.get(v.id).pos; } }, icon('eye', 16), 'Follow'));
      if (v.job !== 'idle' && !v.away) {
        if (v.aid) actions.append(h('button', { class: 'btn ghost', title: 'Stop building and go back to their job', onclick: () => { v.aid = false; v.reset = true; this.renderPanel(); } }, icon('stop', 16), 'Back to work'));
        else if (g.hasBuildWork()) actions.append(h('button', { class: 'btn', title: 'Leave their job for a while and help build — they return when the building work is done', onclick: () => { v.aid = true; v.reset = true; if (v.carry) { g.add(v.carry.res, v.carry.amt); v.carry = null; v.person.setCarry(null); } this.renderPanel(); } }, icon('build', 16), 'Aid construction'));
      }
      if (v.job !== 'idle' && !J.soldier) actions.append(h('button', { class: 'btn ghost', onclick: () => { g.setJob(v, 'idle'); this.renderPanel(); } }, icon('stop', 16), 'Make unemployed'));
      p.append(actions);
      if (v.job === 'idle') {
        // jobs shown as the person they'd become
        const opts = [...g.buildings.values()].filter(b => b.done && g.jobSlots(b) && b.workers.length < g.jobSlots(b));
        p.append(h('h3', { class: 'jobh' }, 'Give a job'),
          opts.length ? h('div', { class: 'jobgrid' }, opts.slice(0, 9).map(b => {
            const J2 = JOBS[b.def.job];
            return h('button', { class: 'jobcard', onclick: () => { g.setJob(v, b.def.job, b.id); this.renderPanel(); } }, art('person', J2.look, null, 'face'),
              h('span', null, h('b', null, J2.name), h('small', null, `${b.def.name} · ${b.workers.length}/${g.jobSlots(b)}`)));
          })) : h('p', { class: 'sub' }, 'No free jobs — build a field, lumber camp, quarry, mine or dojo. Meanwhile they help build.'));
      }
    }
  }
  // a whole wall (or road, hedge, fence line) selected at once
  segmentPanel(p, close) {
    const g = this.game, sel = this.sel, list = sel.ids.map(id => g.buildings.get(id)).filter(Boolean);
    if (!list.length) { p.hidden = true; return; }
    const counts = {}; for (const b of list) counts[b.def.name] = (counts[b.def.name] || 0) + 1;
    const first = list[0], title = first.type === 'wall' || first.type === 'palisade' ? 'Wall' : first.def.name;
    p.append(close, h('div', { class: 'phead' }, art('building', first.type, first.def.kanji, 'big'), h('div', null, h('h2', null, `${title} · ${list.length} pieces`),
      h('p', { class: 'sub' }, Object.entries(counts).map(([n, c]) => `${c} ${n}`).join(' · ')))));
    const hp = list.filter(b => b.def.hp);
    if (hp.length) {
      const cur = () => hp.reduce((a, b) => a + (g.buildings.has(b.id) ? b.hp : 0), 0), max = hp.reduce((a, b) => a + g.maxHp(b), 0);
      p.append(h('div', { class: 'irow' }, icon('wall', 18), this.live(h('span'), el => { el.textContent = `Strength ${Math.round(cur())} / ${max}`; })), this.bar2(() => cur() / max, 'hp'));
    }
    const busy = list.filter(b => !b.done || b.upg).length;
    if (busy) p.append(h('p', { class: 'sub' }, `${busy} piece${busy === 1 ? ' is' : 's are'} being built or upgraded.`));
    const U = g.segmentUpgrade(sel.ids), allPal = U.items.length && U.items.every(b => b.def.upgradeTo);
    if (U.items.length) p.append(h('div', { class: 'upgrade' },
      h('div', { class: 'jrow' }, icon('up', 18), h('b', null, allPal ? `Rebuild ${U.items.length} pieces in stone` : `Upgrade ${U.items.length} piece${U.items.length === 1 ? '' : 's'}`)),
      h('div', { class: 'row' }, costChips(g, U.cost, this.live), h('button', { class: 'btn small', disabled: U.why ? true : null, onclick: () => { if (g.upgradeSegment(sel.ids)) { this.sound('place'); this.renderPanel(); } } }, 'Upgrade all')),
      U.why ? h('p', { class: 'why' }, U.why) : null));
    else if (U.why && U.why !== 'Nothing to upgrade') p.append(h('p', { class: 'why' }, U.why));
    p.append(h('p', { class: 'sub' }, 'Tip: double-click any piece of wall, fence, hedge or road to select the whole line.'),
      h('div', { class: 'actions' }, h('button', { class: 'btn danger', onclick: () => this.demolishSelected() }, icon('demolish', 16), this.confirmDemolish ? `Really demolish all ${list.length}?` : `Demolish all ${list.length}`)));
  }
  upgradeSection(p, b) {
    const g = this.game, u = g.upgradeInfo(b);
    if (!u || u.busy || u.max) { if (u && u.max && (b.def.maxLevel || 1) > 1) p.append(h('p', { class: 'sub' }, 'Fully upgraded.')); return; }
    p.append(h('div', { class: 'upgrade' },
      h('div', { class: 'jrow' }, icon('up', 18), h('b', null, u.name), h('span', { class: 'sub' }, fmtTime(u.time))),
      u.grows ? h('p', { class: 'sub' }, 'It will grow bigger.') : null,
      h('div', { class: 'row' }, costChips(g, u.cost, this.live), h('button', { class: 'btn small', disabled: u.ok ? null : true, onclick: () => { if (g.startUpgrade(b)) { this.sound('place'); this.renderPanel(); } } }, 'Upgrade')),
      u.why ? h('p', { class: 'why' }, u.why) : null));
  }
  keepSection(p, k) {
    const g = this.game, L = k.level;
    if (L < MAX_TH) {
      const u = g.upgradeInfo(k), next = unlocksAt(L + 1);
      p.append(h('div', { class: 'upgrade keepup' },
        h('div', { class: 'jrow' }, icon('castle', 20), h('b', null, `Keep level ${L + 1}`), u && !u.busy ? h('span', { class: 'sub' }, fmtTime(u.time)) : null),
        h('p', { class: 'sub' }, `+${TOWNHALL[L + 1].housing - TOWNHALL[L].housing} homes, +${TOWNHALL[L + 1].storage - TOWNHALL[L].storage} storage, more buildings of each kind` + (next.length ? `. Unlocks: ${next.join(', ')}` : '') + (COMMANDERS.berserker.th === L + 1 ? ', the Berserker commander' : COMMANDERS.taisho.th === L + 1 ? ', the Taishō commander' : '') + (L + 1 === 4 ? '. From now on the warlords’ castles send real soldiers to raid you instead of bandits' : '') ),
        u && !u.busy ? [h('div', { class: 'row' }, costChips(g, u.cost, this.live), h('button', { class: 'btn small', disabled: u.ok ? null : true, onclick: () => { if (g.startUpgrade(k)) { this.sound('place'); this.renderPanel(); } } }, 'Upgrade the Keep')),
          u.why ? h('p', { class: 'why' }, u.why) : null] : null));
    } else p.append(h('p', { class: 'sub' }, 'Your Keep is as grand as it can be.'));
  }
  bar2(frac, cls = '') { const i = h('i'); return this.live(h('div', { class: 'bar ' + cls }, i), () => { i.style.width = Math.min(100, Math.max(0, (frac() || 0) * 100)).toFixed(1) + '%'; }); }
  costText(c) { return Object.keys(c).map(r => `${c[r]} ${RES[r].name.toLowerCase()}`).join(' + '); }
  demolishSelected() {
    if (this.sel && this.sel.kind === 'segment') {
      if (!this.confirmDemolish) { this.confirmDemolish = true; this.renderPanel(); return; }
      for (const id of this.sel.ids) this.game.demolish(id);
      this.input.select(null); this.sound('place'); return;
    }
    if (!this.sel || this.sel.kind !== 'building') return;
    const b = this.game.buildings.get(this.sel.id); if (!b || b.type === 'townhall') return;
    if (!this.confirmDemolish) { this.confirmDemolish = true; this.renderPanel(); return; }
    this.game.demolish(b.id); this.input.select(null); this.sound('place');
  }

  /* ---------- game events ---------- */
  onGame(type, data) {
    if (type === 'toast') this.toast(data.text, data.kind);
    if (['build', 'built', 'demolish', 'move', 'job', 'villager'].includes(type)) {
      if (type === 'built') { this.sound('done'); if (data && data.type === 'townhall') this.renderBar(); }
      clearTimeout(this.rt); this.rt = setTimeout(() => this.renderPanel(), 30);
    }
    if (type === 'raid') this.sound('war');
    if (type === 'hungry' && this.game.state.clock - (this.hungryAt || -99) > 60) { this.hungryAt = this.game.state.clock; this.toast('Out of wheat! Villagers work slowly — add farmers.', 'bad'); }
  }
  toast(text, kind = '') {
    const t = h('div', { class: 'toast ' + kind }, text);
    this.toasts.append(t); while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => t.remove(), 5000);
  }
  sound(kind) {
    if (!this.settings.sound || this.settings.muted) return;
    try {
      this.ac = (this.music && this.music.ctx) || this.ac || new (window.AudioContext || window.webkitAudioContext)();
      const notes = { place: [392, 523], done: [523, 659, 784], click: [660], war: [196, 147, 196] }[kind] || [440];
      notes.forEach((f, i) => { const t = this.ac.currentTime + i * 0.09, o = this.ac.createOscillator(), gn = this.ac.createGain(); o.type = 'sine'; o.frequency.value = f; gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.05, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(gn).connect(this.ac.destination); o.start(t); o.stop(t + 0.32); });
    } catch (_) { /* sound optional */ }
  }
  // keep the floating pieces of the screen out of each other's way, whatever the screen size
  layout() {
    const vis = e => e && !e.hidden && !e.closest('[hidden]') && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const H = window.innerHeight, narrow = window.innerWidth <= 1000;
    // messages go below whatever sits at the top centre (raid banner, placing hint, battle bar)
    let top = 62;
    for (const e of [this.raidBanner, this.hint, document.querySelector('.btop'), document.querySelector('.mapside')]) if (vis(e)) { const r = e.getBoundingClientRect(); if (r.left < 16 + 420) top = Math.max(top, r.bottom + 8); }
    this.toasts.style.top = top + 'px';
    // the build menu sits above the clan panel when they share the bottom row
    if (vis(this.clan) && vis(this.bar)) this.bar.style.bottom = narrow ? (this.clan.getBoundingClientRect().height + 22) + 'px' : '';
    // ...and never reaches under the Turn / Move buttons, the Map button or the clan panel beside it
    const tools = document.querySelector('.camtools');
    if (vis(this.bar)) {
      this.bar.style.maxWidth = ''; this.bar.style.minWidth = '';
      const b = this.bar.getBoundingClientRect(), W = window.innerWidth;
      let left = 12, right = W - 12;
      for (const e of [tools, this.mapBtn]) if (vis(e)) { const r = e.getBoundingClientRect(); if (r.top < b.bottom + 8 && r.bottom > b.top - 8) right = Math.min(right, r.left - 10); }
      if (vis(this.clan)) { const r = this.clan.getBoundingClientRect(); if (r.top < b.bottom + 8 && r.bottom > b.top - 8) left = Math.max(left, r.right + 10); }
      const centred = getComputedStyle(this.bar).transform !== 'none';
      const room = centred ? 2 * Math.min(right - W / 2, W / 2 - left) : right - b.left;
      if (room < b.width) { this.bar.style.maxWidth = Math.max(160, room) + 'px'; this.bar.style.minWidth = '0'; }
    }
    // the side panel stops above the Turn / Move buttons and the build menu
    if (vis(this.panel)) {
      let limit = H - 12;
      if (vis(tools)) limit = Math.min(limit, tools.getBoundingClientRect().top - 10);
      if (narrow && vis(this.bar)) limit = Math.min(limit, this.bar.getBoundingClientRect().top - 10);
      this.panel.style.maxHeight = Math.max(160, limit - this.panel.getBoundingClientRect().top) + 'px';
    }
  }
  // one switch for all sound: music and effects
  toggleMute() { this.settings.muted = !this.settings.muted; this.saveSettings(); this.applySound(); this.renderMute(); this.toast(this.settings.muted ? 'Sound off' : 'Sound on'); }
  applySound() { if (this.music) { this.music.setOn(!this.settings.muted && this.settings.music !== false); if (!this.settings.muted && this.settings.music !== false) this.music.unlock(); } }
  renderMute() { if (!this.muteBtn) return; this.muteBtn.textContent = ''; this.muteBtn.append(icon(this.settings.muted ? 'muted' : 'sound', 20)); this.muteBtn.classList.toggle('off', !!this.settings.muted); }
  cycleSpeed() { if (this.paused) { this.paused = false; } else this.speed = this.speed >= 3 ? 1 : this.speed + 1; this.tick(); }

  /* ---------- army overview ---------- */
  /* ---------- harmony breakdown ---------- */
  openHarmony() {
    const g = this.game, groups = {};
    for (const b of g.buildings.values()) if (b.def.beauty) { const k = b.type; groups[k] = groups[k] || { n: 0, built: 0, pts: 0 }; groups[k].n++; if (b.done) { groups[k].built++; groups[k].pts += b.def.beauty; } }
    const beauty = g.beauty(), hm = g.harmony();
    const rows = Object.entries(groups).sort((a, b) => b[1].pts - a[1].pts).map(([k, G]) => h('div', { class: 'irow' }, art('building', k, BUILDINGS[k].kanji, 'tiny'),
      h('span', null, `${BUILDINGS[k].name} ×${G.built}${G.n > G.built ? ` (+${G.n - G.built} being built)` : ''}`), h('b', { class: 'rt' }, `+${G.pts}%`)));
    this.openModal('Harmony', h('div', { class: 'harmony' },
      h('div', { class: 'hbig' }, h('b', null, `+${hm}%`), h('span', null, 'Villagers work this much faster, and newcomers are more likely to move in.')),
      rows.length ? h('div', { class: 'irows' }, rows) : h('p', { class: 'sub' }, 'No beauty buildings yet. Build them in the Harmony tab.'),
      h('div', { class: 'irow' }, h('b', null, 'Total'), h('b', { class: 'rt' }, `+${Math.round(beauty)}%${beauty > 30 ? ' (counts up to +30%)' : ''}`)),
      h('p', { class: 'sub' }, 'Every beauty building adds the Harmony it shows, up to +30% in all. How many of each you may build grows with your Keep.'),
      hm >= 30 ? h('p', null, 'Your village is as harmonious as it can be.') : h('p', null, `${30 - hm}% more to reach the +30% maximum.`)),
      [{ label: 'Close' }]);
  }
  openArmy() {
    const g = this.game, C = g.country;
    const where = v => {
      if (!v.away) return v.post ? 'On a watchtower' : 'At home';
      if (v.away === 'scout') return 'Scouting';
      if (v.away.startsWith('hold:')) { const s = C.site(+v.away.slice(5)); return `Garrison of ${s ? s.name : '?'}`; }
      const m = C.missions.find(x => x.vids.includes(v.id)); const s = m && m.site && C.site(m.site);
      return m ? (m.phase === 'back' ? 'Marching home' : m.phase === 'ready' ? `Waiting at ${s.name}` : `Marching to ${s ? s.name : '…'}`) : 'Away';
    };
    const groups = [['Commanders', v => JOBS[v.job].commander], ['Samurai', v => v.job === 'samurai'], ['Shield-bearers', v => v.job === 'shieldman'], ['Spearmen', v => v.job === 'ashigaru'], ['Archers', v => v.job === 'archer'], ['In training', v => v.job === 'trainee' || v.job === 'trainee_archer']];
    const all = [...g.villagers.values()];
    const body = h('div', { class: 'army' });
    for (const [name, test] of groups) {
      const list = all.filter(test);
      body.append(h('h3', null, `${name} · ${list.length}`));
      if (!list.length) { body.append(h('p', { class: 'sub' }, name === 'Commanders' ? 'Appoint commanders at the Keep (level 4 and 5).' : name === 'In training' ? 'Hire unemployed villagers at a Dojo or Kyūdō Range.' : name === 'Shield-bearers' ? 'Train them at a Dojo — choose Shield-bearer in its panel (Keep level 2).' : name === 'Samurai' ? 'Train them at a Dojo — choose Samurai in its panel (Keep level 4).' : 'None yet.')); continue; }
      body.append(h('div', { class: 'armygrid' }, list.map(v => h('button', { class: 'soldier', disabled: v.away ? true : null, onclick: () => { this.modal.hidden = true; this.input.select({ kind: 'villager', id: v.id }); this.cam.follow = () => g.villagers.get(v.id) && g.villagers.get(v.id).pos; } },
        art('person', JOBS[v.job].look, null, 'face'), h('span', null, h('b', null, v.name), h('small', null, `${g.jobName(v)} · ${where(v)}`), JOBS[v.job].commander ? h('small', { class: 'ab' }, COMMANDERS[v.job].ability) : null,
          v.hpf != null ? h('span', { class: 'hpbar' }, h('i', { style: `width:${Math.round(v.hpf * 100)}%` })) : null)))));

    }
    const hurt = all.filter(v => v.hpf != null && !v.away).length;
    if (hurt) body.append(h('p', { class: 'sub' }, [...g.buildings.values()].some(b => b.def.heals && b.done) ? `${hurt} wounded — they rest at the Healer’s House and heal quickly.` : `${hurt} wounded — they heal slowly. Build a Healer’s House (Military) to heal them four times faster.`));
    body.append(h('h3', null, `Battering rams · ${g.state.rams || 0}`), h('p', { class: 'sub' }, g.state.ramBuild ? 'One more is being built at the Siege Workshop.' : 'Built at the Siege Workshop.'));
    const holds = Object.keys(C.holds);
    if (holds.length) body.append(h('h3', null, 'Held places'), h('div', { class: 'chips' }, holds.map(id => { const s = C.site(+id); return h('span', { class: 'chip' }, icon(SITES[s.type].icon, 16), `${s.name} · ${C.garrison(s).length} guards`); })));
    this.openModal('Your army', body, [{ label: 'Skill trees', cls: 'ghost', fn: () => setTimeout(() => this.openResearch(), 0) }, { label: 'Close' }], { wide: true });
  }
  /* ---------- skill trees ---------- */
  openResearch(tab) {
    const g = this.game, body = h('div', { class: 'research' });
    const hasHall = [...g.buildings.values()].some(b => b.type === 'strategy' && b.done);
    const W = 212, H = 186, NW = 186; // column width, row height, node width
    let cur = tab || this.researchTab || 'spear';
    const render = () => {
      body.textContent = '';
      if (!hasHall) body.append(h('p', { class: 'why' }, 'Build a Strategy Hall (Military, Keep level 2) to start researching.'));
      const A = g.state.research.active;
      if (A) body.append(h('div', { class: 'upgrade' }, h('b', null, `Studying: ${g.researchNode(A.id).node.name}`), this.bar2(() => g.state.research.active ? g.state.research.active.progress : 1)));
      body.append(h('div', { class: 'rtabs' }, Object.entries(RESEARCH).map(([key, T]) => {
        const n = T.nodes.filter(x => g.hasResearch(x.id)).length;
        return h('button', { class: 'rtab' + (key === cur ? ' on' : ''), onclick: () => { cur = this.researchTab = key; render(); } },
          T.look ? art('person', T.look, null, 'face') : h('span', { class: 'art face' }, icon(T.icon, 22)), h('span', null, h('b', null, T.name), h('small', null, `${n} / ${T.nodes.length} learned`)));
      })));
      const T = RESEARCH[cur], rows = Math.max(...T.nodes.map(n => n.r)) + 1, byId = Object.fromEntries(T.nodes.map(n => [n.id, n]));
      const graph = h('div', { class: 'rgraph', style: `width:${3 * W}px;height:${rows * H}px` });
      // branch lines
      const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'rlines'); svg.setAttribute('width', 3 * W); svg.setAttribute('height', rows * H);
      for (const n of T.nodes) for (const id of n.req || []) {
        const p = byId[id]; if (!p) continue;
        const x1 = p.c * W + W / 2, y1 = p.r * H + H - 38, x2 = n.c * W + W / 2, y2 = n.r * H, my = (y1 + y2) / 2;
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', `M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}`);
        path.setAttribute('class', g.hasResearch(id) ? 'done' : '');
        svg.append(path);
      }
      graph.append(svg);
      for (const n of T.nodes) {
        const done = g.hasResearch(n.id), active = A && A.id === n.id, why = g.researchBlock(n.id);
        const locked = !done && !active && why && why !== 'Not enough resources' && !why.startsWith('Scholars');
        graph.append(h('div', { class: 'node rnode' + (done ? ' done' : active ? ' active' : locked ? ' locked' : ''), style: `left:${n.c * W + (W - NW) / 2}px;top:${n.r * H}px;width:${NW}px` },
          h('b', null, n.name), h('small', null, n.desc),
          done ? h('span', { class: 'pill' }, '✓ Learned') : active ? h('span', { class: 'pill' }, 'Studying…') : [h('div', { class: 'row' }, costChips(g, n.cost, this.live), h('small', { class: 'sub' }, fmtTime(n.time))),
            h('button', { class: 'btn small', disabled: why ? true : null, title: why || 'Start studying', onclick: () => { if (g.startResearch(n.id)) render(); } }, why && why !== 'Not enough resources' ? why : 'Research')]));
      }
      body.append(h('div', { class: 'rwrap' }, graph));
    };
    render();
    this.openModal('Skill trees', body, [{ label: 'Close' }], { wide: true });
    this.modal.querySelector('.sheet').classList.add('xwide');
  }

  /* ---------- dialogs ---------- */
  openModal(title, body, buttons = [{ label: 'Close' }], opts = {}) {
    const m = this.modal; m.textContent = ''; m.hidden = false;
    const close = () => { m.hidden = true; };
    m.append(h('div', { class: 'scrim', onclick: () => { if (!opts.locked) close(); } }), h('div', { class: 'sheet' + (opts.wide ? ' wide' : '') }, h('h2', null, title), body,
      h('div', { class: 'actions' }, buttons.map(b => h('button', { class: 'btn ' + (b.cls || ''), onclick: () => { if (b.fn) b.fn(); if (!b.keep) close(); } }, b.label)))));
  }
  showHelp() {
    const rows = [['Drag the ground', 'Move the camera'], ['Scroll wheel / two fingers', 'Zoom'], ['Pinch  /  Z X', 'Zoom'], ['Q / E  /  Turn buttons', 'Turn the camera'], ['Sideways two-finger swipe  /  Option+drag', 'Turn the camera'], ['G  /  Move button', 'Move mode: drag buildings around'], ['W A S D  /  arrows', 'Move the camera'],
      ['Click', 'Select a building or villager'], ['Hover a build card', 'See what it does (or tap its ⓘ)'], ['B', 'Show / hide the build menu'], ['R', 'Rotate while placing'],
      ['Walls, roads & clearing', 'Click start, click end — keeps going until Esc'], ['M', 'Country map'],
      ['Delete', 'Demolish (press twice)'], ['Space', 'Pause'], ['F', 'Game speed 1× / 2× / 3×'], ['Esc', 'Cancel / close']];
    this.openModal('How to play', h('div', null,
      h('p', null, 'Grow your clan slowly and calmly. Unemployed villagers get jobs at fields, camps, quarries and mines, and anyone without a job builds, upgrades and clears land. Need more hands? Click a worker and press Aid construction. New families move in while you have empty homes and spare wheat.'),
      h('p', null, 'Upgrade your Keep to unlock new buildings and bigger upgrades — but a bigger village draws bigger bandit raids, so keep walls, towers and soldiers ready. When you are strong enough, open the Map to scout the country and raid your rivals.'),
      h('dl', { class: 'kv keys2' }, rows.map(([k, v]) => [h('dt', null, k), h('dd', null, v)]))));
  }
  openMenu() {
    const s = this.game.state.settings;
    const toggle = (label, get, set) => h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: get() ? true : null, onchange: e => set(e.target.checked) }), label);
    let q = 'auto'; try { q = localStorage.getItem('tenka.quality') || 'auto'; } catch (_) { /* */ }
    this.openModal('Menu', h('div', { class: 'menu' },
      toggle('Welcome new families when there is room', () => s.welcome, v => { s.welcome = v; }),
      toggle('Scrolling moves the camera instead of zooming', () => this.settings.scrollPans, v => { this.settings.scrollPans = v; this.saveSettings(); }),
      toggle('Music', () => this.settings.music, v => { this.settings.music = v; this.saveSettings(); this.applySound(); }),
      h('label', { class: 'toggle vol' }, h('span', null, 'Music volume'), h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(this.settings.musicVol ?? 0.6), oninput: e => { this.settings.musicVol = +e.target.value; if (this.music) this.music.setVolume(this.settings.musicVol); }, onchange: () => this.saveSettings() })),
      h('div', { class: 'row' }, h('span', null, 'Music style: '), [['mix', 'Mix'], ['piano', 'Ambient piano'], ['chip', 'Tenka theme (chiptune)'], ['calm', 'Calm koto']].map(([k, label]) => h('button', { class: 'btn small ' + ((this.settings.musicStyle || 'mix') === k ? '' : 'ghost'), onclick: e => { this.settings.musicStyle = k; this.saveSettings(); if (this.music) { this.music.setStyle(k); this.music.unlock(); } e.target.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('ghost', b !== e.target)); } }, label))),
      toggle('Sound effects', () => this.settings.sound, v => { this.settings.sound = v; this.saveSettings(); this.sound('click'); }),
      h('div', { class: 'row' }, h('span', null, 'Graphics: '), ['low', 'medium', 'high'].map(k => h('button', { class: 'btn small ' + (q === k ? '' : 'ghost'), onclick: () => { try { localStorage.setItem('tenka.quality', k); } catch (_) { /* */ } this.saver(); location.reload(); } }, k))),
      h('p', { class: 'sub' }, 'Your game saves automatically on this device, and a backup of the previous save is always kept.')),
      [{ label: 'How to play', cls: 'ghost', fn: () => setTimeout(() => this.showHelp(), 0) },
       { label: 'Save code', cls: 'ghost', keep: true, fn: () => this.openSaveCode() },
       { label: 'Start over', cls: 'danger', keep: true, fn: () => this.confirmReset() },
       { label: 'Close' }]);
  }
  openSaveCode() {
    this.saver();
    let code = '';
    try { code = btoa(unescape(encodeURIComponent(localStorage.getItem('tenka.classic.save') || ''))); } catch (_) { /* */ }
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
          localStorage.setItem('tenka.classic.backup', localStorage.getItem('tenka.classic.save') || '');
          localStorage.setItem('tenka.classic.save', json); this.saver.block(); location.reload();
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
      r.built ? h('p', null, `${r.built} building job${r.built > 1 ? 's' : ''} finished.`) : null,
      r.trained ? h('p', null, `${r.trained} trainee${r.trained > 1 ? 's' : ''} finished training.`) : null));
  }

  /* ---------- keyboard ---------- */
  onKey(k, e) {
    const I = this.input;
    if (this.keyHook && this.keyHook(k, e)) return;
    if (k === 'escape') {
      if (!this.modal.hidden) this.modal.hidden = true;
      else if (this.infoPinned) this.hideInfo(true);
      else if (I.placing) { if (!I.endLine()) I.cancelPlacing(); }
      else if (I.moveMode) I.setMoveMode(false);
      else { I.select(null); this.cam.follow = null; }
      return;
    }
    if (!this.modal.hidden) return;
    if (k === 'n') return this.toggleMute();
    if (k === 'r') return I.rotatePlacing();
    if (k === 'g') return I.setMoveMode(!I.moveMode);
    if (k === 'b') { this.buildOpen = !this.buildOpen; return this.renderBar(); }
    if (k === 'h' || k === '?') return this.showHelp();
    if (k === ' ') { this.paused = !this.paused; return this.tick(); }
    if (k === 'f') return this.cycleSpeed();
    if (k === 'm') return this.onMap && this.onMap();
    if (k === 'delete' || k === 'backspace') return this.demolishSelected();
  }
}
