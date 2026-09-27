// All on-screen interface: resources, clan panel, build menu with info cards, selection panel, toasts, dialogs.
import { BUILDINGS, CATEGORIES, RES, JOBS, ECON, TOWNHALL, MAX_TH, COMMANDERS, TECHS, ERAS, TECH_LANES, TECH_LANE, KEY_TECHS, SITES, DOJO_TRAINS, CLANS, RANKS, rankOf, xpOf, DIFFICULTY, WONDER_BP } from '../game/data.js';
import { GUIDE, ACHIEVEMENTS } from '../game/progress.js';
import { SEASONS } from '../game/data.js';
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
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem('tenka.ui') || '{}')); } catch (_) { /* no storage */ }
    // scrolling now zooms by default (two-finger scroll / mouse wheel); drag to move
    if (!this.settings.zoomV) { this.settings.scrollPans = false; this.settings.zoomV = 1; this.saveSettings(); }
    this.speed = 1; this.paused = false;
    this.lives = [];
    this.build();
    game.on((type, data) => this.onGame(type, data));
    game.onSfx = kind => this.sfx(kind);
    this.root.classList.toggle('lefty', !!this.settings.lefty);
  }
  raidOrder(kind) {
    const R = this.game.raids; if (!R.alarmed) return;
    if (!R.cmd.size) { this.toast('Select some soldiers first (click them, or use the buttons)', 'warn'); return; }
    if (kind === 'wall') {
      const c = R.centroid() || { x: 0, z: 0 }, T = R.threatPoint(c), at = T ? this.game.center(T) : c;
      if (!R.wallSpots(at, 60).length) { this.toast('No wall walk to stand on — upgrade stone walls to level 2 to give them a walkway', 'warn'); return; }
      R.command('wall', { at });
    } else R.command(kind);
    this.toast({ charge: 'Charge!', wall: 'To the walls!', auto: 'They fight on their own again' }[kind]);
  }
  // a new version is out: a small banner with an Update button (the game saves first)
  updateReady(go) {
    if (this.updBanner) return;
    this.updBanner = h('div', { class: 'updbanner' }, h('b', null, 'A new version of Tenka is ready'), h('button', { class: 'btn small', onclick: go }, 'Update now'), h('button', { class: 'btn small ghost', onclick: () => { this.updBanner.remove(); } }, 'Later'));
    this.root.append(this.updBanner);
  }
  applyLayout() { this.root.classList.toggle('lefty', !!this.settings.lefty); this.layout(); }
  saveSettings() { try { localStorage.setItem('tenka.ui', JSON.stringify(this.settings)); } catch (_) { /* ignore */ } }
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
      if (RES[r].extra) el.hidden = !(v > 0 || g.countType(r === 'iron' ? 'ironmine' : 'sakebrewery') > 0);
      el.classList.toggle('full', v >= cap * 0.95); el.classList.toggle('empty', v <= 0);
    }));
    const night = () => g.state.time < 0.22 || g.state.time > 0.8;
    const clock = this.live(h('button', { class: 'res clock', title: 'Pause (Space) · speed (F)', onclick: () => this.cycleSpeed() }), el => {
      const hr = Math.floor(g.state.time * 24); el.textContent = '';
      const L = g.life, sea = SEASONS[L.season];
      el.append(icon(night() ? 'moon' : 'sun', 20), h('b', null, `Day ${g.state.day}`), h('small', null, ` ${sea.kanji} ${sea.name}${L.weather !== 'clear' ? ' · ' + L.weather : ''} · ${String(hr).padStart(2, '0')}:00 · ${this.paused ? 'paused' : this.speed + '×'}`));
    });
    const menu = h('button', { class: 'res menu', title: 'Menu', onclick: () => this.openMenu() }, icon('menu', 20));
    R.append(h('header', { class: 'top' }, h('div', { class: 'brand' }, h('span', { class: 'kanji' }, '天下'), h('span', { class: 'word' }, 'Tenka')), res, h('div', { class: 'spacer' }), this.live(h('button', { class: 'res research', title: 'Research: new technologies and eras (paid with Wisdom)', onclick: () => this.openResearch() }, icon('wisdom', 20), h('b', null, 'Research'), h('small')), el => { const w = Math.floor(g.state.wisdom), c = g.wisdomCap(); el.lastChild.textContent = ` ${w}/${c}`; el.classList.toggle('full', w >= c); }), clock, this.muteBtn = h('button', { class: 'res menu mute', title: 'Mute / unmute all sound (N)', onclick: () => this.toggleMute() }), menu));
    this.renderMute();
    // raid warnings under the top bar
    const rbTitle = h('b'), rbSub = h('small'), rbIcon = h('span');
    this.raidBanner = this.live(h('div', { class: 'raidbanner', hidden: true }, rbIcon, h('span', { class: 'rbtext' }, rbTitle, rbSub),
      h('button', { class: 'btn small ghost', title: 'Look at the enemy', onclick: () => { const c = g.raids.centroid(); if (c) { this.cam.target.set(c.x, 0, c.z); this.cam.follow = null; } } }, icon('eye', 14), 'Show me')), el => {
      const R = g.raids, show = R.alarmed;
      el.hidden = !show; if (!show) return;
      const n = R.alive().length, phases = R.groups.map(G => G.phase), T = R.groups.map(G => G.target).find(Boolean);
      const what = phases.includes('march') || phases.includes('form') ? `forming up in the hills to ${R.fromText()}`
        : R.alive().some(u => R.isInside && R.outside && R.isInside(u.x, u.z)) ? 'inside the village!' : T && g.buildings.has(T.id) ? `attacking your ${T.def.name}` : 'in the village';
      const title = `${R.army ? 'Attack' : 'Bandit raid'}! ${R.bandName(n)} ${what}`;
      if (rbTitle.textContent !== title) rbTitle.textContent = title;
      const sub = R.cmd.size ? `${R.cmd.size} soldier${R.cmd.size > 1 ? 's' : ''} under your command — click the ground to send them, an enemy to attack, a wall to man it.` : 'Click your soldiers (or use the bar below) to command them — or let them fight on their own.';
      if (rbSub.textContent !== sub) rbSub.textContent = sub;
      if (rbIcon.dataset.k !== String(R.army)) { rbIcon.dataset.k = String(R.army); rbIcon.textContent = ''; rbIcon.append(icon(R.army ? 'castle' : 'camp', 20)); }
    });
    R.append(this.raidBanner);
    // the raid command bar: pick your soldiers, give orders
    const GROUPS = [['all', 'All soldiers', '1', () => true], ['spear', 'Spears & shields', '2', v => v.job === 'ashigaru' || v.job === 'shieldman'], ['archer', 'Archers', '3', v => v.job === 'archer'], ['elite', 'Samurai & elite', '4', v => !['ashigaru', 'shieldman', 'archer'].includes(v.job)]];
    const pickGroup = (test, add) => { const list = g.soldiers().filter(test); g.raids.selectSoldiers(list, add); };
    this.raidGroups = GROUPS;
    const grpBtns = GROUPS.map(([k, name, key, test]) => this.live(h('button', { class: 'grp', title: `Select (${key})`, onclick: e => pickGroup(test, e.shiftKey) }, h('span', null, h('b'), h('small', null, name)), h('kbd', null, key)), el => {
      const list = g.soldiers().filter(test); el.querySelector('b').textContent = String(list.length); el.disabled = !list.length;
      el.classList.toggle('on', list.length > 0 && list.every(v => g.raids.cmd.has(v.id)));
    }));
    const order = (kind, label, key, tip, ic) => h('button', { class: 'btn small ghost', title: `${tip} (${key})`, onclick: () => this.raidOrder(kind) }, icon(ic, 15), label, h('kbd', null, key));
    this.raidCmd = this.live(h('div', { class: 'raidcmd', hidden: true },
      h('div', { class: 'groups' }, ...grpBtns),
      h('div', { class: 'cmds' },
        order('charge', 'Charge!', 'C', 'Go after every enemy on your land — out through the gate if need be', 'sword'),
        order('wall', 'Man the walls', 'V', 'Up onto the nearest upgraded stone walls: spears stab down at the enemy, bows shoot further', 'wall'),
        order('auto', 'On their own', 'K', 'Stop giving orders: they stand ready behind the point under attack and hunt down whoever gets in', 'soldier'),
        h('button', { class: 'btn small ghost', title: 'Deselect (Esc)', onclick: () => g.raids.selectSoldiers([]) }, icon('close', 15), 'Deselect'))), el => {
      const on = g.raids.alarmed;
      el.hidden = !on; this.root.classList.toggle('raiding', on);
      el.querySelectorAll('.cmds .btn').forEach((b, i) => { if (i < 3) b.disabled = !g.raids.cmd.size; });
    });
    R.append(this.raidCmd);
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
      this.live(h('button', { class: 'crow link2', title: 'Research: invest Wisdom in new technologies', onclick: () => this.openResearch() }, icon('wisdom', 20), h('span', null, 'Wisdom'), h('b')), el => {
        const w = Math.floor(g.state.wisdom), cap = g.wisdomCap(); el.lastChild.textContent = `${w}/${cap}`; el.classList.toggle('attn', w >= cap);
        el.title = `Era ${g.era}: ${ERAS[g.era].name}. Wisdom +${g.wisdomRate().toFixed(1)} a minute — click to research`;
      }),
      this.live(h('button', { class: 'crow link2', title: 'Buildings with no road to the Keep do nothing — click to find one', onclick: () => { const b = [...g.buildings.values()].find(b => b.done && b.linked === false); if (b) { const c = g.center(b); this.cam.target.set(c.x, 0, c.z); this.input.select({ kind: 'building', id: b.id }); } } }, icon('road', 20), h('span', null, 'No road'), h('b')), el => {
        const n = g.unlinked || 0; el.hidden = !n; el.lastChild.textContent = String(n); el.classList.toggle('attn', n > 0);
        if (n > 0 && !g.state.settings.roadIntro && this.modal.hidden) {
          g.state.settings.roadIntro = true;
          setTimeout(() => this.openModal('Roads to the Keep', h('div', null,
            h('p', null, 'From now on every working building — homes, fields, workshops, storehouses — must be connected to the Keep by a road. Without one it does nothing: no workers, no homes, no storage.'),
            h('p', null, `${n} of your buildings aren’t connected yet. They show a red 道 sign.`),
            h('p', { class: 'sub' }, 'Decorations, walls, gates and towers don’t need roads. Roads may pass through gates. Dirt roads are free.')),
            [{ label: 'I’ll lay them myself', cls: 'ghost' }, { label: 'Connect them with free dirt roads', fn: () => g.autoRoadAll() }]), 400);
        }
      }),
      this.live(h('div', { class: 'crow', title: 'When the next raid is expected (your scouts only know roughly)' }, icon('camp', 20), h('span', null, 'Next raid'), h('b')), el => {
        const R = g.raids, t = R.timeLeft();
        el.hidden = !isFinite(t) && !R.active;
        el.lastChild.textContent = R.active ? 'now!' : t < 60 ? 'under a minute' : `~${Math.max(1, Math.round(t / 60))} min`;
        el.classList.toggle('attn', R.active || t < 60);
      }),
      this.live(h('button', { class: 'crow link2', title: 'How your villagers feel', onclick: () => this.openMood() }, icon('people', 20), h('span', null, 'Mood'), h('b')), el => { const m = g.life.mood(); el.lastChild.textContent = `${m}%${g.life.festival ? ' 🏮' : ''}`; el.classList.toggle('attn', m < 30); }),
      this.live(h('button', { class: 'crow link2 tasks', title: 'Tasks and the guide', onclick: () => this.openTasks() }, icon('flag', 20), h('span', null, 'Tasks'), h('b')), el => {
        const P = g.progress, guide = P.guide < GUIDE.length; el.lastChild.textContent = guide ? `Guide ${P.guide + 1}/${GUIDE.length}` : String(P.tasks.length); el.classList.toggle('attn', guide);
        el.title = guide ? 'Guide: ' + GUIDE[P.guide].text : 'Tasks with rewards';
      }),
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
      const wlock = d.wonder ? g.wonderBlock(type) : '', locked = (d.th || 1) > g.thLevel || !!wlock, lim = g.buildLimit(type), have = lim !== null ? g.countType(type) : 0, full = !locked && lim !== null && have >= lim;
      const infoBtn = h('button', { class: 'infobtn', title: 'What does it do?', onclick: e => { e.stopPropagation(); this.toggleInfo(type, card); } }, icon('info', 16));
      const card = h('div', { class: 'card' + (locked || full ? ' locked' : ''), role: 'button', tabindex: '0',
        onclick: () => { if (locked) { this.toggleInfo(type, card); this.toast(wlock ? (wlock.startsWith('Blue') ? `The ${d.name} needs ${WONDER_BP} blueprints — win battles, beat off raids, make offerings at temples` : `The ${d.name} can be built from the ${wlock}`) : `Upgrade your Keep to level ${d.th} to build the ${d.name}`, 'warn'); } else if (full) this.toast(lim ? `You have all ${lim} allowed (${d.name}) — upgrade them, or upgrade the Keep to build more` : `The ${d.name} unlocks at a higher Keep level`, 'warn'); else this.input.startPlacing(type); },
        onpointerenter: e => { if (e.pointerType !== 'touch') this.showInfo(type, card); }, onpointerleave: () => this.hideInfo() },
        art('building', type, d.kanji, 'thumb'), h('span', { class: 'nm' }, d.name),
        locked ? h('span', { class: 'lock' }, wlock && (d.th || 1) <= g.thLevel ? wlock : wlock && wlock.startsWith('Blue') ? `Keep ${d.th} · ${wlock}` : wlock || `Keep level ${d.th}`) : costChips(g, d.cost, this.live), infoBtn);
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
      else if (!J.res || !J.amount) row('worker', `Up to ${n} ${J.name.toLowerCase()}${n > 1 ? 's' : ''}${J.desc ? ' — ' + J.desc : ''}`);
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
    if (this.sel) this.renderPanel();
    if (this.input.placing) return;
    this.hint.hidden = !on; if (!on) return;
    this.hint.textContent = '';
    this.hint.append(h('b', null, 'Move mode'), h('span', null, ' — drag a building to move it, or tap it to demolish it'), h('small', null, '  R while dragging: rotate · G / Esc: finish'),
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
      // moving and demolishing belong to Move mode (the Move button or G), not to every click
      if (this.input.moveMode) {
        const actions = h('div', { class: 'actions' });
        actions.append(h('button', { class: 'btn ghost', title: 'Move', onclick: () => this.input.startPlacing(b.type, b.id) }, icon('move', 16), 'Move'));
        if (b.type !== 'townhall') actions.append(h('button', { class: 'btn danger', title: 'Demolish (Delete)', onclick: () => this.demolishSelected() }, icon('demolish', 16), this.confirmDemolish ? 'Really demolish?' : 'Demolish'));
        p.append(actions);
      }
      if (this.extraPanel) this.extraPanel(p, b);
    } else {
      const v = g.villagers.get(sel.id); if (!v) { p.hidden = true; return; }
      const J = JOBS[v.job], work = v.work ? g.buildings.get(v.work) : null;
      p.append(close, h('div', { class: 'phead' }, art('person', J.look, null, 'big'), h('div', null, h('h2', null, v.name), h('p', { class: 'sub' }, g.jobName(v) + (work ? ` · ${work.def.name}` : '') + (v.aid ? ' · aiding construction' : '')))),
        this.live(h('p', { class: 'desc status' }), el => { el.textContent = v.status || '…'; }));
      if (J.desc) p.append(h('p', { class: 'sub' }, J.desc));
      if (J.soldier) {
        const r = rankOf(v), R = RANKS[r], N = RANKS[r + 1];
        p.append(h('div', { class: 'irow rank' }, icon('katana', 16), h('span', null, h('b', null, `${R.name} ${R.stars}`), ` · ${v.kills || 0} kill${v.kills === 1 ? '' : 's'} · ${v.battles || 0} battle${v.battles === 1 ? '' : 's'}`),
          h('small', { class: 'rt sub' }, N ? `${N.xp - xpOf(v)} to ${N.name}` : 'Highest rank')));
      }
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
      this.input.moveMode ? h('div', { class: 'actions' }, h('button', { class: 'btn danger', onclick: () => this.demolishSelected() }, icon('demolish', 16), this.confirmDemolish ? `Really demolish all ${list.length}?` : `Demolish all ${list.length}`)) : null);
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
          u.why ? h('p', { class: 'why' }, u.why) : null,
          u.why && u.why.startsWith('Research') ? h('button', { class: 'btn small', onclick: () => this.openResearch() }, icon('wisdom', 15), 'Open Research') : null] : null));
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
    const g = this.game;
    if (type === 'toast') this.toast(data.text, data.kind);
    if (['build', 'built', 'demolish', 'move', 'job', 'villager'].includes(type)) {
      if (type === 'built') { this.sound('done'); if (data && data.type === 'townhall') this.renderBar(); }
      clearTimeout(this.rt); this.rt = setTimeout(() => this.renderPanel(), 30);
    }
    if (type === 'raid') this.sound('war');
    if (type === 'victory') setTimeout(() => this.showVictory(data), 600);
    if (type === 'linkChange' && data && data.linked === false && data.done) this.toast(`The ${data.def.name} lost its road to the Keep and stops working`, 'warn');
    if (type === 'holdReport' && !document.getElementById('ui').classList.contains('mode-battle')) {
      const r = data;
      this.openModal(`Report from ${r.site.name}`, h('div', null,
        h('p', null, r.won ? `An enemy force of about ${Math.round(r.force)} attacked ${r.site.name}. Your garrison of ${r.n0} held the walls and drove them off.` : `An enemy force of about ${Math.round(r.force)} attacked ${r.site.name}. Your garrison of ${r.n0} could not hold it.`),
        h('p', { class: 'sub' }, r.lost ? `Fallen: ${r.names.join(', ')}.` : 'Not one of them fell.'),
        !r.won && r.back ? h('p', { class: 'sub' }, `${r.back} survivor${r.back > 1 ? 's are' : ' is'} on the way home.`) : null,
        h('p', { class: 'sub' }, r.won ? 'Tip: more men — and commanders — make a garrison much stronger. You can also lead the defence yourself when the warning comes.' : 'You can take it back with a new attack.')),
        [{ label: 'Understood' }]);
    }
    if (type === 'ronin') this.openModal('A wandering r\u014dnin', h('div', null, h('p', null, 'A masterless samurai stops at your gate. His clan is gone; for 60 gold and a roof, he will swear his sword to yours.'), h('p', { class: 'sub' }, 'He joins as a Samurai.')),
      [{ label: 'Send him away', cls: 'ghost' }, { label: 'Hire him (60 gold)', fn: () => g.life.hireRonin() }]);
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
  // sound effects, all made on the spot: steel, arrows, boulders, horns, bells, drums, coins
  sfx(kind) {
    if (!this.settings.sound || this.settings.muted) return;
    const now = performance.now(), last = this.sfxT || (this.sfxT = {});
    if (now - (last[kind] || 0) < ({ clash: 90, arrow: 110, boom: 160, throw: 200 }[kind] ?? 300)) return;
    last[kind] = now;
    try {
      const ac = this.ac = (this.music && this.music.ctx) || this.ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state !== 'running') return;
      const t = ac.currentTime, out = ac.createGain(); out.gain.value = 0.55; out.connect(ac.destination);
      const noise = (dur, f, q, vol, type = 'bandpass', f2 = 0) => {
        const len = Math.ceil(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), gn = ac.createGain(); s.buffer = buf; fl.type = type; fl.Q.value = q;
        fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
        gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
        s.connect(fl).connect(gn).connect(out); s.start(t); s.stop(t + dur);
      };
      const tone = (f, dur, vol, type = 'sine', at = 0, f2 = 0) => {
        const o = ac.createOscillator(), gn = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t + at); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + at + dur);
        gn.gain.setValueAtTime(0.0001, t + at); gn.gain.exponentialRampToValueAtTime(vol, t + at + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
        o.connect(gn).connect(out); o.start(t + at); o.stop(t + at + dur + 0.02);
      };
      switch (kind) {
        case 'clash': noise(0.12, 2600 + Math.random() * 1400, 3, 0.22); tone(1900 + Math.random() * 700, 0.14, 0.025, 'triangle'); break;
        case 'arrow': noise(0.22, 3200, 1.2, 0.07, 'bandpass', 900); break;
        case 'throw': noise(0.4, 420, 0.8, 0.12, 'lowpass', 150); tone(120, 0.3, 0.05, 'triangle', 0, 70); break;
        case 'boom': noise(0.7, 320, 0.7, 0.35, 'lowpass', 60); tone(72, 0.55, 0.2, 'sine', 0, 38); break;
        case 'horn': tone(147, 1.2, 0.06, 'sawtooth', 0, 150); tone(220, 1.2, 0.035, 'sawtooth', 0, 224); noise(1.1, 300, 0.5, 0.03, 'lowpass'); break;
        case 'bell': [0, 0.5, 1.0].forEach(at => { tone(660, 1.1, 0.06, 'sine', at); tone(1072, 0.8, 0.02, 'sine', at); tone(1650, 0.5, 0.015, 'sine', at); }); break;
        case 'drum': [0, 0.3, 0.6, 0.75].forEach(at => tone(95, 0.4, 0.28, 'sine', at, 48)); break;
        case 'coin': tone(1320, 0.12, 0.05, 'square'); tone(1760, 0.22, 0.04, 'square', 0.08); break;
        case 'fanfare': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.32, 0.05, 'triangle', i * 0.1)); break;
      }
    } catch (_) { /* sound is optional */ }
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
      for (const e of [tools, this.mapBtn, this.clan]) if (vis(e)) {
        const r = e.getBoundingClientRect(); if (!(r.top < b.bottom + 8 && r.bottom > b.top - 8)) continue;
        if (r.left + r.width / 2 > W / 2) right = Math.min(right, r.left - 10); else left = Math.max(left, r.right + 10);
      }
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
  cycleSpeed() {
    if (this.paused) { this.paused = false; this.tick(); return; }
    const steps = [1, 2, 3, 5, 10].filter(x => x <= (this.settings.maxSpeed || 3)), i = steps.indexOf(this.speed);
    this.speed = steps[(i + 1) % steps.length]; this.tick();
  }

  /* ---------- army overview ---------- */
  /* ---------- mood & festivals ---------- */
  openMood() {
    const g = this.game, L = g.life, body = h('div', { class: 'harmony' });
    const render = () => {
      body.textContent = '';
      const m = L.mood();
      body.append(h('div', { class: 'hbig' }, h('b', { style: `color:${m >= 60 ? 'var(--leaf)' : m < 30 ? 'var(--verm)' : 'var(--gold)'}` }, `${m}%`),
        h('span', null, m >= 60 ? 'Your people are content: they work faster, families move in and children are born.' : m < 25 ? 'Your people are miserable — some will leave!' : 'Your people get by.')),
        h('div', { class: 'irows' }, L.moodParts().map(([k, v]) => h('div', { class: 'irow' }, h('span', null, k), h('b', { class: 'rt', style: `color:${v > 0 ? 'var(--leaf)' : v < 0 ? 'var(--verm)' : 'inherit'}` }, (v > 0 ? '+' : '') + v)))),
        h('p', { class: 'sub' }, `Work speed ${Math.round((L.moodMult() - 1) * 100) >= 0 ? '+' : ''}${Math.round((L.moodMult() - 1) * 100)}% from mood. Above 60%, children are born; below 25%, people leave.`));
      const why = L.festivalBlock();
      body.append(h('div', { class: 'upgrade' }, h('div', { class: 'jrow' }, icon('sakura', 18), h('b', null, 'Hold a festival')),
        h('p', { class: 'sub' }, 'Lanterns, drums, dancing and sake: a big lift in mood for a while. Once every three days.'),
        h('div', { class: 'row' }, costChips(g, L.festivalCost(), this.live), h('button', { class: 'btn small', disabled: why ? true : null, onclick: () => { if (L.holdFestival()) render(); } }, 'Hold it')), why ? h('p', { class: 'why' }, why) : null));
    };
    render();
    this.openModal('Mood of the village', body, [{ label: 'Close' }]);
  }
  /* ---------- tasks, guide, chronicle ---------- */
  openTasks() {
    const g = this.game, P = g.progress, body = h('div', { class: 'tasks' });
    if (P.guide < GUIDE.length) body.append(h('div', { class: 'upgrade' }, h('b', null, `Guide — step ${P.guide + 1} of ${GUIDE.length}`), h('p', null, GUIDE[P.guide].text),
      h('div', { class: 'bar' }, h('i', { style: `width:${P.guide / GUIDE.length * 100}%` }))));
    body.append(h('h3', null, 'Tasks'));
    if (!P.tasks.length) body.append(h('p', { class: 'sub' }, 'New tasks will come soon.'));
    for (const t of P.tasks) body.append(h('div', { class: 'irow task' }, icon('flag', 18), h('span', null, t.text), h('span', { class: 'rt' }, costChips(g, t.reward))));
    body.append(h('p', { class: 'sub' }, P.won ? `The land is unified (day ${P.stats.wonDay}). Rule on as long as you like.` : 'The goal: unify the land (Tenka) — take the Shogun\u2019s castle, or break every rival clan.'));
    this.openModal('Tasks', body, [{ label: 'Chronicle', cls: 'ghost', fn: () => setTimeout(() => this.openChronicle(), 0) }, { label: 'Close' }]);
  }
  openChronicle(tab = 'log') {
    const g = this.game, P = g.progress, S = P.stats, body = h('div', { class: 'chron' });
    const render = () => {
      body.textContent = '';
      body.append(h('div', { class: 'rtabs' }, [['log', 'Chronicle'], ['stats', 'Statistics'], ['ach', `Achievements ${Object.keys(P.ach).length}/${ACHIEVEMENTS.length}`]].map(([k, l]) => h('button', { class: 'rtab' + (k === tab ? ' on' : ''), onclick: () => { tab = k; render(); } }, h('span', null, h('b', null, l))))));
      if (tab === 'log') {
        const list = h('div', { class: 'chronlist' });
        if (!P.chronicle.length) list.append(h('p', { class: 'sub' }, 'Nothing has been written yet.'));
        for (const e of P.chronicle.slice().reverse()) list.append(h('div', { class: 'chronrow ' + e.kind }, h('small', null, `Day ${e.day}`), h('span', null, e.text)));
        body.append(list);
      } else if (tab === 'stats') {
        const rows = [['Days ruled', g.state.day], ['Villagers (most ever)', `${g.pop} (${S.maxPop || g.pop})`], ['Soldiers', g.soldiers(true).length], ['Buildings', g.buildings.size], ['Keep level', g.thLevel],
          ['Battles won / lost', `${S.battlesWon || 0} / ${S.battlesLost || 0}`], ['Castles and forts taken', S.castlesTaken || 0], ['Places plundered', S.plundered || 0], ['Places held now', Object.keys(g.country.holds).length],
          ['Raids beaten off', g.state.stats.raidsBeaten || 0], ['Raiders defeated', S.raidersKilled || 0], ['Soldiers fallen', S.soldiersLost || 0], ['Scouts sent', S.scouts || 0], ['Newcomers welcomed', g.state.stats.arrived || 0], ['Soldiers trained', g.state.stats.trained || 0],
          ['Studies completed', g.state.research.done.length], ['Rival clans left', Object.keys(CLANS).filter(k => g.clans.status[k] !== 'fallen').length]];
        body.append(h('div', { class: 'irows' }, rows.map(([k, v]) => h('div', { class: 'irow' }, h('span', null, k), h('b', { class: 'rt' }, String(v))))));
      } else {
        body.append(h('div', { class: 'achgrid' }, ACHIEVEMENTS.map(a => h('div', { class: 'ach' + (P.ach[a.id] ? ' got' : '') }, h('b', null, a.name), h('small', null, a.desc), P.ach[a.id] ? h('small', { class: 'when' }, `Day ${P.ach[a.id]}`) : null))));
      }
    };
    render();
    this.openModal('Chronicle of your clan', body, [{ label: 'Close' }], { wide: true });
  }
  showVictory(how) {
    const g = this.game, S = g.progress.stats;
    this.sound('done');
    this.openModal('Tenka — the land is yours!', h('div', { class: 'victory' },
      h('div', { class: 'vseal' }, '天下'),
      h('p', null, how === 'shogun' ? 'The Shogun\u2019s castle has fallen. From the mountains to the sea, every lord bows to your clan.' : 'The last rival clan is broken. From the mountains to the sea, every lord bows to your clan.'),
      h('div', { class: 'irows' }, [['Days', g.state.day], ['Villagers', g.pop], ['Battles won', S.battlesWon || 0], ['Castles taken', S.castlesTaken || 0], ['Soldiers fallen', S.soldiersLost || 0]].map(([k, v]) => h('div', { class: 'irow' }, h('span', null, k), h('b', { class: 'rt' }, String(v))))),
      h('p', { class: 'sub' }, 'You can keep ruling as long as you like.')),
      [{ label: 'Read the chronicle', cls: 'ghost', fn: () => setTimeout(() => this.openChronicle(), 0) }, { label: 'Rule on' }], { wide: true });
  }
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
    this.openModal('Your army', body, [{ label: 'Research', cls: 'ghost', fn: () => setTimeout(() => this.openResearch(), 0) }, { label: 'Close' }], { wide: true });
  }
  /* ---------- skill trees ---------- */
  // what a Great Building gives at a level
  wonderBonus(type, L) {
    return {
      kinkaku: `+${Math.round(2 + 1.5 * L)} mood`, daibutsu: `+${(0.25 * L).toFixed(2)} Wisdom a minute, +${4 * L} room`,
      itsukushima: `+${5 * L}% trade, festivals ${5 * L}% cheaper`, himeji: `walls, gates and towers +${6 * L}% stronger`,
      bell: `soldiers train ${5 * L}% faster, sentries see ${10 * L}% further`, inari: `+${(1.5 * L).toFixed(1)} gold a minute`,
      osaka: `your soldiers +${3 * L}% damage, commanders +${4 * L}% health`, sanjusangendo: `the wounded heal ${12 * L}% faster`,
      nijo: `+${3 * L} homes, +${8 * L}% tribute`,
    }[type] || '';
  }
  // Research: one long hanging scroll. Each era is a chapter with its own ink painting — the mountains
  // grow taller as your clan climbs — then its technologies as plain cards. No tangle of lines:
  // every card says what it needs, what it costs and what to do next.
  openResearch() {
    const g = this.game;
    const ERA_TEXT = [null,
      'A handful of families under your banner. Farm well, drill your spearmen, send out scouts — then raise a proper Clan Hall.',
      'Palisades become walls. Bows, shields and trade turn the village into a fortress.',
      'A castle town grows around your Keep. Finer weapons, ninja, warrior monks and horses — and the first Great Buildings.',
      'You rule a domain. Samurai, siege engines and commanders make your army a force the clans fear.',
      'You contend for the whole realm. Master every weapon and win the Emperor’s mandate.',
      'The Shogunate: legends, a surveyed land, and one realm under one banner.'];
    const state = t => g.hasResearch(t.id) ? 'done' : g.researchBlock(t.id) ? 'locked' : g.techPts(t.id) >= t.pts ? 'full' : 'open';
    const laneOf = t => TECH_LANES.find(l => l.id === (TECH_LANE[t.id] || 'unit'));
    const body = h('div', { class: 'kake' });
    const head = h('div', { class: 'kake-head' }), paper = h('div', { class: 'kake-paper' });
    const drawHead = () => {
      head.textContent = '';
      const E = ERAS[g.era], w = Math.floor(g.state.wisdom), cap = g.wisdomCap();
      head.append(
        h('div', { class: 'kh-era' }, h('span', { class: 'seal' }, E.kanji), h('span', null, h('small', null, `You are in era ${g.era} of 6`), h('b', null, E.name))),
        h('div', { class: 'kh-wis' }, icon('wisdom', 24), h('span', null, h('b', null, `${w} / ${cap} Wisdom`), h('small', null, `+${g.wisdomRate().toFixed(2)} a minute`)), h('div', { class: 'brush' }, h('i', { style: `width:${Math.min(100, w / cap * 100)}%` }))),
        h('div', { class: 'kh-legend' }, h('span', { class: 'lg done' }, '学'), 'learned', h('span', { class: 'lg open' }, '●'), 'can study now', h('span', { class: 'lg locked' }, '○'), 'not yet'),
        ...(g.pavilionLevel() ? [] : [h('p', { class: 'why' }, 'Build a Scholars’ Pavilion (Village tab) — without it Wisdom only trickles in.')]));
    };
    const card = t => {
      const st = state(t), L = laneOf(t), pts = g.techPts(t.id), why = g.researchBlock(t.id);
      const redraw = () => { drawHead(); drawAll(); };
      const c = h('div', { class: `scard ${st}${t.key ? ' key' : ''}` },
        h('div', { class: 'sc-top' },
          h('span', { class: 'sc-seal', style: `--p:${st === 'done' ? 1 : Math.min(1, pts / t.pts)}` }, h('span', null, t.key ? '★' : L.seal)),
          h('span', { class: 'sc-name' }, h('b', null, t.name), h('small', null, t.key ? 'The way to the next era' : L.name)),
          h('span', { class: 'sc-tag ' + st }, st === 'done' ? 'Learned' : st === 'locked' ? 'Not yet' : st === 'full' ? 'Ready!' : 'Study')),
        h('p', { class: 'sc-desc' }, t.desc));
      if (st === 'locked') c.append(h('p', { class: 'sc-need' }, why.startsWith('Needs the') ? `Opens in a later era` : why));
      if (st === 'open') c.append(h('div', { class: 'sc-prog' }, h('div', { class: 'brush' }, h('i', { style: `width:${pts / t.pts * 100}%` })), h('small', null, `${pts} / ${t.pts} Wisdom`)),
        h('div', { class: 'sc-act' }, h('button', { class: 'btn small ghost', onclick: () => { if (g.investTech(t.id, 1)) redraw(); } }, '+1'), h('button', { class: 'btn small', onclick: () => { if (g.investTech(t.id)) redraw(); } }, icon('wisdom', 14), 'Invest Wisdom')));
      if (st === 'full') c.append(h('div', { class: 'sc-act' }, h('small', null, 'Fully studied — pay to complete:'), costChips(g, t.cost, this.live), h('button', { class: 'btn small', onclick: () => { if (g.completeTech(t.id)) redraw(); } }, 'Complete')));
      return c;
    };
    const drawAll = () => {
      const top = paper.scrollTop;
      paper.textContent = '';
      for (let e = 1; e <= 6; e++) {
        const techs = TECHS.filter(t => t.era === e), key = techs.find(t => t.key), rest = techs.filter(t => !t.key)
          .sort((a, b) => TECH_LANES.findIndex(l => l === laneOf(a)) - TECH_LANES.findIndex(l => l === laneOf(b)));
        const learned = techs.filter(t => g.hasResearch(t.id)).length, here = e === g.era;
        const sec = h('section', { class: 'kake-era' + (here ? ' now' : e < g.era ? ' past' : ' future'), 'data-era': e },
          h('div', { class: 'ke-side' }, h('span', { class: 'ke-kanji' }, ERAS[e].kanji), h('span', { class: 'ke-seal' }, String(e))),
          h('div', { class: 'ke-main' },
            h('div', { class: 'ke-paint', html: inkScene(e, here) }),
            h('div', { class: 'ke-title' }, h('b', null, `Era ${e} · ${ERAS[e].name}`), h('small', null, `${learned} of ${techs.length} learned${here ? ' · you are here' : ''}`)),
            h('p', { class: 'ke-text' }, ERA_TEXT[e]),
            h('div', { class: 'ke-grid' }, ...rest.map(card)),
            key ? h('div', { class: 'ke-key' }, card(key)) : null));
        paper.append(sec);
      }
      paper.scrollTop = top;
    };
    drawHead(); drawAll();
    body.append(h('div', { class: 'kake-roll top' }), head, paper, h('div', { class: 'kake-roll bottom' }));
    this.openModal('Research', body, [{ label: 'Close' }], { wide: true });
    this.modal.querySelector('.sheet').classList.add('xwide', 'kake-sheet');
    const toNow = () => { const s = paper.querySelector('.kake-era.now'); if (s) paper.scrollTop = s.offsetTop - paper.offsetTop - 6; };
    requestAnimationFrame(toNow); setTimeout(toNow, 180);
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
      toggle('Speech bubbles over villagers', () => this.settings.bubbles !== false, v => { this.settings.bubbles = v; this.saveSettings(); }),
      toggle('Sound effects', () => this.settings.sound, v => { this.settings.sound = v; this.saveSettings(); this.sound('click'); }),
      h('div', { class: 'row' }, h('span', null, 'Difficulty: '), Object.entries(DIFFICULTY).map(([k, D]) => h('button', { class: 'btn small ' + ((s.difficulty || 'normal') === k ? '' : 'ghost'), title: D.desc, onclick: e => { s.difficulty = k; this.toast(`Difficulty: ${D.name} — ${D.desc}`); e.target.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('ghost', b !== e.target)); } }, D.name))),
      h('div', { class: 'row' }, h('span', null, 'Fastest game speed: '), [3, 5, 10].map(n => h('button', { class: 'btn small ' + ((this.settings.maxSpeed || 3) === n ? '' : 'ghost'), onclick: e => { this.settings.maxSpeed = n; if (this.speed > n) this.speed = n; this.saveSettings(); e.target.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('ghost', b !== e.target)); } }, n + '\u00d7'))),
      toggle('Left-handed layout (Map, Turn and Move buttons on the left)', () => this.settings.lefty, v => { this.settings.lefty = v; this.saveSettings(); this.applyLayout(); }),
      toggle('Keep it smooth: lower the resolution automatically when the game slows down', () => this.settings.autoRes !== false, v => { this.settings.autoRes = v; this.saveSettings(); }),
      h('div', { class: 'row' }, h('span', null, 'Graphics: '), ['low', 'medium', 'high'].map(k => h('button', { class: 'btn small ' + (q === k ? '' : 'ghost'), onclick: () => { try { localStorage.setItem('tenka.quality', k); } catch (_) { /* */ } this.saver(); location.reload(); } }, k))),
      h('p', { class: 'sub' }, 'Your game saves automatically on this device, and a backup of the previous save is always kept. There is no cloud save (the game has no server): to carry your village to another device, use a save file or a save code.'),
      h('p', { class: 'sub' }, `Version ${(() => { try { return localStorage.getItem('tenka.ver') || '?'; } catch (_) { return '?'; } })()}`),
      h('p', { class: 'sub' }, 'Prefer the older game? ', h('a', { href: 'v1/', target: '_self' }, 'Play the classic version (v1)'), ' — it keeps its own save.')),
      [{ label: 'Chronicle', cls: 'ghost', fn: () => setTimeout(() => this.openChronicle(), 0) },
       { label: 'How to play', cls: 'ghost', fn: () => setTimeout(() => this.showHelp(), 0) },
       { label: 'Save file / code', cls: 'ghost', keep: true, fn: () => this.openSaveCode() },
       { label: 'Start over', cls: 'danger', keep: true, fn: () => this.confirmReset() },
       { label: 'Close' }]);
  }
  openSaveCode() {
    this.saver();
    let code = '';
    try { code = btoa(unescape(encodeURIComponent(localStorage.getItem('tenka.save.v1') || ''))); } catch (_) { /* */ }
    const out = h('textarea', { readonly: true, rows: 4 }); out.value = code;
    const inp = h('textarea', { rows: 4, placeholder: 'Paste a save code here…' });
    const msg = h('p', { class: 'sub' });
    const loadJson = json => {
      const obj = JSON.parse(json); if (!obj || !obj.v || !obj.buildings) throw new Error('bad');
      localStorage.setItem('tenka.save.backup', localStorage.getItem('tenka.save.v1') || '');
      localStorage.setItem('tenka.save.v1', json); this.saver.block(); location.reload();
    };
    const file = h('input', { type: 'file', accept: '.json,.tenka,application/json,text/plain', style: 'display:none', onchange: e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      f.text().then(txt => { try { loadJson(txt.trim()); } catch (_) { msg.textContent = 'That file isn\u2019t a Tenka save.'; } });
    } });
    const download = () => {
      try {
        const blob = new Blob([localStorage.getItem('tenka.save.v1') || ''], { type: 'application/json' }), a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = `tenka-day${this.game.state.day}.json`; document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000); msg.textContent = 'Saved. On an iPad it goes to Files \u2192 Downloads.';
      } catch (_) { msg.textContent = 'Your browser could not save the file — use the save code instead.'; }
    };
    this.openModal('Save file & save code', h('div', { class: 'menu' },
      h('p', null, 'Your village lives in this browser. There is no cloud save, so to move it to another device (or keep it safe), save it as a file or copy the code, then load it there.'),
      h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: download }, 'Download save file'), h('button', { class: 'btn small ghost', onclick: () => file.click() }, 'Load a save file'), file),
      h('hr'),
      h('p', { class: 'sub' }, 'Or use the save code: this text is your whole village.'), out,
      h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => { out.select(); try { navigator.clipboard.writeText(code).then(() => { msg.textContent = 'Copied.'; }, () => { msg.textContent = 'Select the text and copy it.'; }); } catch (_) { msg.textContent = 'Select the text and copy it.'; } } }, icon('copy', 14), 'Copy')),
      h('hr'), inp,
      h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => {
        try {
          loadJson(decodeURIComponent(escape(atob(inp.value.trim()))));
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
      if (this.game.raids.cmd.size && this.modal.hidden) { this.game.raids.selectSoldiers([]); return; }
      if (!this.modal.hidden) this.modal.hidden = true;
      else if (this.infoPinned) this.hideInfo(true);
      else if (I.placing) { if (!I.endLine()) I.cancelPlacing(); }
      else if (I.moveMode) I.setMoveMode(false);
      else { I.select(null); this.cam.follow = null; }
      return;
    }
    if (!this.modal.hidden) return;
    // commanding soldiers during a raid
    const R = this.game.raids;
    if (R.alarmed) {
      const G = this.raidGroups && this.raidGroups.find(x => x[2] === k);
      if (G) { R.selectSoldiers(this.game.soldiers().filter(G[3]), e && e.shiftKey); return; }
      if (k === 'c') return this.raidOrder('charge');
      if (k === 'v') return this.raidOrder('wall');
      if (k === 'k') return this.raidOrder('auto');
    }
    if (k === 'n') return this.toggleMute();
    if (k === 'r') return I.rotatePlacing();
    if (k === 'g') return I.setMoveMode(!I.moveMode);
    if (k === 'b') { this.buildOpen = !this.buildOpen; return this.renderBar(); }
    if (k === 'h' || k === '?') return this.showHelp();
    if (k === ' ') { this.paused = !this.paused; return this.tick(); }
    if (k === 'f') return this.cycleSpeed();
    if (k === 'm') return this.onMap && this.onMap();
    if ((k === 'delete' || k === 'backspace') && I.moveMode) return this.demolishSelected();
  }
}

// An ink-wash (sumi-e) landscape for one era of the research scroll: misty mountains that grow taller
// as your clan climbs, pines on the ridges, and a settlement that grows from huts to a great castle.
function inkScene(e, here) {
  let seed = e * 7919 + 13; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const W = 800, H = 190, INK = '#2b2118';
  const ridge = (base, amp, n, soft) => {
    let d = `M0 ${H} L0 ${base}`, px = 0, py = base;
    for (let i = 1; i <= n; i++) {
      const x = i * W / n, y = base - amp * (0.25 + 0.75 * r());
      d += soft ? ` Q${(px + x) / 2} ${Math.min(py, y) - amp * 0.25} ${x} ${y}` : ` L${x - W / n * (0.3 + 0.2 * r())} ${y - amp * 0.35 * r()} L${x} ${y}`;
      px = x; py = y;
    }
    return d + ` L${W} ${H} Z`;
  };
  const pine = (x, y, s) => {
    let p = `<path d="M${x} ${y} q${2 * s} ${-9 * s} ${-1 * s} ${-18 * s}" stroke="${INK}" stroke-width="${1.4 * s}" fill="none" opacity=".75"/>`;
    for (let k = 0; k < 4; k++) p += `<ellipse cx="${x + (k % 2 ? 4 : -3) * s}" cy="${y - (5 + k * 4.5) * s}" rx="${(8 - k * 1.4) * s}" ry="${1.9 * s}" fill="${INK}" opacity="${0.55 + k * 0.08}"/>`;
    return p;
  };
  const hut = (x, y, s) => `<rect x="${x - 7 * s}" y="${y - 7 * s}" width="${14 * s}" height="${7 * s}" fill="#f1e8d4" stroke="${INK}" stroke-width=".8" opacity=".9"/>` +
    `<path d="M${x - 11 * s} ${y - 6 * s} L${x} ${y - 16 * s} L${x + 11 * s} ${y - 6 * s} Z" fill="${INK}" opacity=".62"/>`;
  const keep = (x, y, s, tiers) => {
    let p = `<path d="M${x - 16 * s} ${y} L${x - 12 * s} ${y - 8 * s} L${x + 12 * s} ${y - 8 * s} L${x + 16 * s} ${y} Z" fill="${INK}" opacity=".35"/>`;
    let yy = y - 8 * s;
    for (let t = 0; t < tiers; t++) {
      const w = (11 - t * 2) * s;
      p += `<rect x="${x - w}" y="${yy - 6 * s}" width="${2 * w}" height="${6 * s}" fill="#f4efe4" stroke="${INK}" stroke-width=".7"/>`;
      p += `<path d="M${x - w - 4 * s} ${yy - 5 * s} Q${x} ${yy - 11 * s} ${x + w + 4 * s} ${yy - 5 * s} L${x + w} ${yy - 7 * s} L${x - w} ${yy - 7 * s} Z" fill="${INK}" opacity=".75"/>`;
      yy -= 8 * s;
    }
    return p;
  };
  let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">`;
  s += `<defs><linearGradient id="mist${e}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6efdd" stop-opacity="0"/><stop offset=".55" stop-color="#f6efdd" stop-opacity=".95"/><stop offset="1" stop-color="#f6efdd" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="fade${e}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${INK}" stop-opacity=".8"/><stop offset="1" stop-color="${INK}" stop-opacity=".12"/></linearGradient></defs>`;
  if (here) s += `<circle cx="${640 + r() * 60}" cy="${34 + r() * 10}" r="20" fill="#b8342a" opacity=".85"/>`;
  const tall = 34 + e * 13;
  s += `<path d="${ridge(H * 0.55, tall * 0.7, 7, true)}" fill="${INK}" opacity=".18"/>`;                         // far range
  s += `<path d="${ridge(H * 0.72, tall, 5 + e, e < 3)}" fill="url(#fade${e})" opacity=".8"/>`;                   // the mountains of this era
  s += `<rect x="0" y="${H * 0.5}" width="${W}" height="${H * 0.3}" fill="url(#mist${e})"/>`;                        // mist
  if (e >= 4) s += `<path d="M${520 + r() * 60} ${H * 0.3} q-3 30 2 60 q-2 20 1 40" stroke="#f6efdd" stroke-width="5" fill="none" opacity=".9"/>`;  // a waterfall
  s += `<path d="${ridge(H * 0.9, 26, 6, true)}" fill="${INK}" opacity=".42"/>`;                                   // near hills
  for (let i = 0; i < 7 + e; i++) s += pine(30 + r() * 740, H * (0.72 + r() * 0.2), 0.7 + r() * 0.6);
  // the settlement of this era
  const sx = 180 + r() * 120, sy = H * 0.86;
  if (e === 1) { s += hut(sx, sy, 1.1) + hut(sx + 26, sy - 3, 0.9) + hut(sx + 48, sy + 1, 1); s += `<path d="M${sx + 90} ${sy - 4} L${sx + 170} ${sy - 4}" stroke="${INK}" stroke-width="1.6" opacity=".7"/>` + [0, 1, 2, 3].map(k => `<path d="M${sx + 95 + k * 22} ${sy - 4} l0 14" stroke="${INK}" stroke-width="1" opacity=".6"/>`).join(''); }
  else if (e === 2) { for (let k = 0; k < 14; k++) s += `<path d="M${sx - 30 + k * 5} ${sy} l0 -${9 + (k % 3)}" stroke="${INK}" stroke-width="2" opacity=".6"/>`; s += keep(sx + 60, sy, 0.8, 1) + hut(sx + 20, sy - 2, 0.9); }
  else s += keep(sx + 40, sy, 0.9 + (e - 3) * 0.12, Math.min(5, e - 1)) + hut(sx - 10, sy, 0.8) + hut(sx + 100, sy + 2, 0.8);
  return s + '</svg>';
}
