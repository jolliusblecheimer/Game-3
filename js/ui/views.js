// Switches between the village, the country map and battles; owns their interfaces and controls.
import * as THREE from 'three';
import { CountryMap, MAP_ORIGIN } from '../render/countrymap.js';
import { Battle, BATTLE_ORIGIN, makeLayout } from '../game/battle.js';
import { RTSCamera } from './camera.js';
import { SITES, JOBS, UNITS, COMMANDERS, WAR, RES, DOJO_TRAINS, CLANS } from '../game/data.js';
import { h, fmtTime } from '../util.js';
import { icon } from './icons.js';
import { art, costChips } from './hud.js';

const STATUS = { hidden: 'Unexplored', known: 'Not scouted', scouted: 'Scouted', held: 'Yours — held by your garrison', ruined: 'Ruined' };
const UNIT_NAMES = { bandit: 'Bandits', outlaw: 'Outlaws', enemy_shield: 'Shield-bearers', enemy_ashigaru: 'Spearmen', enemy_archer: 'Archers', enemy_samurai: 'Samurai', enemy_lord: 'Daimyō' };

// one wheel step, whether from a mouse wheel (lines) or a trackpad (pixels)
const clampWheel = e => Math.max(-120, Math.min(120, e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY));

export class Views {
  constructor(ctx) {
    this.ctx = ctx; const { game, hud } = ctx;
    this.game = game; this.hud = hud; this.stage = ctx.stage;
    this.mode = 'village';
    this.ray = new THREE.Raycaster(); this.ndc = new THREE.Vector2();
    hud.onMap = () => this.mode === 'map' ? this.toVillage() : this.mode === 'village' ? this.toMap() : null;
    hud.keyHook = (k, e) => this.onKey(k, e);
    hud.extraPanel = (p, b) => this.extraPanel(p, b);
    game.on((type, m) => {
      if (type === 'armyReady') this.hud.toast(`Army at ${this.game.country.site(m.site).name} awaits your command — open the Map`, 'warn');
      if (type === 'country' && this.mode === 'map') this.renderMapUI();
      if (type === 'holdAttack') this.holdAlert(m);
    });
    const cv = ctx.stage.renderer.domElement;
    cv.addEventListener('pointerdown', e => this.onDown(e));
    window.addEventListener('pointermove', e => this.onMove(e));
    window.addEventListener('pointerup', e => this.onUp(e));
    cv.addEventListener('wheel', e => this.onWheel(e), { passive: false });
    this.ui = h('div', { class: 'viewui', hidden: true });
    document.getElementById('ui').append(this.ui);
    this.labels = h('div', { class: 'maplabels' }); this.ui.append(this.labels);
  }
  setView(v) { window.tenkaView = v; }

  /* ================= country map ================= */
  toMap() {
    const g = this.game;
    this.ctx.input.cancelPlacing(); this.ctx.input.select(null);
    if (!this.map) {
      this.map = new CountryMap(this.stage.scene, g.country);
      this.mapCam = new RTSCamera(this.stage.camera, { x0: MAP_ORIGIN.x - 280, x1: MAP_ORIGIN.x + 280, z0: MAP_ORIGIN.z - 280, z1: MAP_ORIGIN.z + 280 }, [50, 480]);
      this.mapCam.target.set(MAP_ORIGIN.x, 0, MAP_ORIGIN.z + 20); this.mapCam.dist = this.mapCam.goalDist = 300; this.mapCam.yaw = this.mapCam.goalYaw = 0.35;
    }
    this.mode = 'map'; this.map.root.visible = true;
    document.getElementById('ui').classList.add('mode-map');
    this.hud.mapBtn.lastChild.textContent = 'Village';
    this.ui.hidden = false;
    this.setView({ active: true, cam: this.mapCam, update: (dt, keys) => this.updateMap(dt, keys) });
    this.renderMapUI();
  }
  toVillage() {
    this.mode = 'village'; if (this.map) this.map.root.visible = false;
    document.getElementById('ui').classList.remove('mode-map', 'mode-battle');
    this.hud.mapBtn.lastChild.textContent = 'Map';
    this.ui.hidden = true; this.setView(null); this.ctx.cam.apply();
  }
  updateMap(dt, keys) {
    this.mapCam.update(dt, keys);
    this.map.update(dt, this.game.state.clock);
    // labels over places
    const cam = this.stage.camera, W = window.innerWidth, H = window.innerHeight, C = this.game.country;
    const items = [{ key: 'home', x: 0, z: 0, text: 'Your village', cls: 'home', ic: 'castle' }];
    for (const s of C.sites) {
      const st = C.status(s); if (st === 'hidden') continue;
      const own = this.game.clans.owner(s);
      const sub = st === 'held' ? `Yours · ${C.garrison(s).length} on guard` : SITES[s.type].name + (st === 'ruined' ? (s.type === 'ruins' ? ' · searched' : ' · plundered') : own ? ` · ${CLANS[own].name}` : '');
      items.push({ key: 's' + s.id, site: s, x: s.x, z: s.z, text: s.name, sub, cls: st, ic: st === 'held' ? 'flag' : SITES[s.type].icon });
    }
    for (const m of C.missions) if (m.kind === 'army' && m.phase === 'ready') { const s = C.site(m.site); items.push({ key: 'm' + m.id, x: s.x, z: s.z + 14, text: 'Your army is waiting', cls: 'army', ic: 'flag', mission: m }); }
    const seen = new Set();
    for (const it of items) {
      seen.add(it.key);
      let el = this.labels.querySelector(`[data-k="${it.key}"]`);
      if (el && el.dataset.ic !== it.ic) { el.remove(); el = null; } // e.g. a place you just took: show your banner
      if (!el) {
        el = h('button', { class: 'maplabel ' + it.cls, 'data-k': it.key, onclick: () => { if (it.mission) this.openBattle(it.mission); else if (it.site) this.selectSite(it.site); else this.selectHome(); } },
          icon(it.ic, 20), h('span', null, h('b', null, it.text), it.sub ? h('small', null, it.sub) : null));
        el.dataset.sub = it.sub || ''; el.dataset.ic = it.ic;
        this.labels.append(el);
      }
      el.className = 'maplabel ' + it.cls + (this.sel && this.sel.site === it.site && it.site ? ' on' : '');
      const owner = it.site && it.cls !== 'held' && it.cls !== 'ruined' && this.game.clans.owner(it.site); el.style.borderLeft = owner ? `5px solid ${CLANS[owner].color}` : '';
      if (it.sub && el.dataset.sub !== it.sub) { el.dataset.sub = it.sub; const sm = el.querySelector('small'); if (sm) sm.textContent = it.sub; }
      const p = this.map.worldPos(it.x, it.z, 12).project(cam);
      const vis = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
      el.style.display = vis ? '' : 'none';
      if (vis) el.style.transform = `translate(${(p.x + 1) / 2 * W}px, ${(1 - p.y) / 2 * H}px) translate(-50%, -100%)`;
    }
    for (const el of [...this.labels.children]) if (!seen.has(el.dataset.k)) el.remove();
    this.liveT = (this.liveT || 0) + dt; if (this.liveT > 0.5) { this.liveT = 0; this.renderMissions(); }
  }
  renderMapUI() {
    if (!this.mapPanel) {
      this.missionBox = h('div', { class: 'mapside' }); this.mapPanel = h('aside', { class: 'panel mappanel', hidden: true });
      this.mapHint = h('div', { class: 'maphint' }, 'Click the land to send a scout · click a place for details · drag or scroll to look around');
      this.ui.append(this.missionBox, this.mapPanel, this.mapHint);
    }
    this.renderMissions(); this.renderSitePanel();
  }
  renderMissions() {
    const C = this.game.country, box = this.missionBox; if (!box) return;
    box.textContent = '';
    box.append(h('button', { class: 'btn small', onclick: () => this.openClans() }, icon('flag', 16), 'Clans & diplomacy'));
    box.append(h('h3', null, 'Your people abroad'));
    if (!C.missions.length && !Object.keys(C.holds).length) box.append(h('p', { class: 'sub' }, 'No one is out. Send scouts to uncover the country — the clouds hide everything you haven’t seen.'));
    for (const m of C.missions) {
      const p = C.posOf(m), site = m.site ? C.site(m.site) : null;
      const left = m.phase === 'ready' ? 0 : Math.max(0, m.dur - (C.clock - m.t0));
      const title = m.kind === 'scout' ? `Scout ${this.game.villagers.get(m.vids[0])?.name || ''}` : `Army of ${m.vids.length}${m.rams ? ` + ${m.rams} ram${m.rams > 1 ? 's' : ''}` : ''}`;
      const what = m.phase === 'ready' ? `Waiting at ${site.name}` : m.phase === 'back' ? `Coming home · ${fmtTime(left)}` : site ? `Marching on ${site.name} · ${fmtTime(left)}` : `Exploring · ${fmtTime(left)}`;
      box.append(h('div', { class: 'mission' }, icon(m.kind === 'scout' ? 'scout' : 'flag', 22), h('div', null, h('b', null, title), h('small', null, what),
        h('div', { class: 'bar' }, h('i', { style: `width:${(m.phase === 'ready' ? 1 : p.t) * 100}%` }))),
        m.phase === 'ready' ? h('button', { class: 'btn danger small', onclick: () => this.openBattle(m) }, icon('sword', 16), 'Attack') : null));
    }
    for (const id of Object.keys(C.holds)) {
      const s = C.site(+id), n = [...this.game.villagers.values()].filter(v => v.away === 'hold:' + id).length;
      box.append(h('div', { class: 'mission' }, icon('castle', 22), h('div', null, h('b', null, s.name), h('small', null, `Held by ${n} · pays ${this.costText(SITES[s.type].tribute)} a minute`))));
    }
    box.append(h('button', { class: 'btn ghost small', onclick: () => this.toVillage() }, icon('house', 16), 'Back to the village'));
  }
  costText(c) { return Object.keys(c).map(r => `${c[r]} ${RES[r].name.toLowerCase()}`).join(', '); }
  selectHome() { this.sel = null; this.map.select(null); this.renderSitePanel(); this.mapCam.follow = null; }
  selectSite(s) { this.sel = { site: s }; this.map.select(s); this.renderSitePanel(); }
  selectPoint(p) { this.sel = { point: p }; this.map.pinAt(p); this.renderSitePanel(); }
  renderSitePanel() {
    const P = this.mapPanel, C = this.game.country, g = this.game; if (!P) return;
    P.textContent = ''; P.hidden = !this.sel; if (!this.sel) return;
    P.append(h('button', { class: 'x', onclick: () => { this.sel = null; this.map.select(null); this.map.pinAt(null); this.renderSitePanel(); } }, icon('close', 16)));
    if (this.sel.point) {
      const p = this.sel.point, d = Math.hypot(p.x, p.z), t = d / (WAR.scoutSpeed * C.speedMult('scout'));
      P.append(h('div', { class: 'phead' }, h('span', { class: 'art big' }, icon('scout', 48)), h('div', null, h('h2', null, C.isRevealed(p.x, p.z) ? 'Explored land' : 'Unexplored land'), h('p', { class: 'sub' }, `${Math.round(d)} leagues from home`))),
        h('p', { class: 'desc' }, 'Send a scout here. They reveal the land along the way and report what they find — the farther, the longer the trip.'),
        h('div', { class: 'irow' }, icon('hourglass', 18), h('span', null, `About ${fmtTime(t)} there and ${fmtTime(t)} back`)),
        h('div', { class: 'irow' }, icon('wheat', 18), h('span', null, 'Costs 10 wheat for supplies')),
        h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => { C.sendScout(p); this.map.pinAt(null); this.sel = null; this.renderMapUI(); } }, icon('scout', 16), 'Send a scout')));
      return;
    }
    const s = this.sel.site, S = SITES[s.type], st = C.status(s);
    const stars = '★'.repeat(S.tier) + '☆'.repeat(Math.max(0, 4 - S.tier));
    P.append(h('div', { class: 'phead' }, h('span', { class: 'art big' }, icon(S.icon, 50)), h('div', null, h('h2', null, s.name), h('p', { class: 'sub' }, `${S.name} ${S.tier ? '· ' + stars : ''}`))),
      h('p', { class: 'desc status' }, STATUS[st]));
    if (s.type === 'ruins') { P.append(h('p', null, st === 'ruined' ? 'Your scouts have already searched these ruins.' : 'Old ruins. A scout who reaches them may find buried treasure.')); }
    else {
      const march = C.marchTime(s);
      P.append(h('div', { class: 'irow' }, icon('hourglass', 18), h('span', null, `March: ${fmtTime(march)} each way`)));
      if (st === 'scouted' || st === 'held') {
        const L = makeLayout(s), counts = {};
        for (const d of L.defenders) counts[d.type] = (counts[d.type] || 0) + 1;
        const towers = L.structs.filter(x => x.type === 'tower').length, walls = L.structs.some(x => x.type === 'wall') ? 'Stone walls' : L.structs.some(x => x.type === 'palisade') ? 'Bamboo palisade' : 'No walls';
        const gate = L.structs.some(x => x.type === 'gate' || x.type === 'pgate');
        P.append(h('h3', null, 'Defenses'), h('div', { class: 'intel' }, Object.entries(counts).map(([t, n]) => h('span', { class: 'chip' }, art('person', UNITS[t].look, null, 'face'), `${n} ${UNIT_NAMES[t]}`))),
          h('div', { class: 'irow' }, icon('wall', 18), h('span', null, `${walls}${towers ? `, ${towers} watchtower${towers > 1 ? 's' : ''} with archers` : ''}${gate ? ', a gate' : ''}`)),
          gate ? h('div', { class: 'irow' }, icon('ram', 18), h('span', null, 'Bring a battering ram to break the gate')) : '',
          h('div', { class: 'irow' }, icon('sakura', 18), h('span', null, 'Bushes around the walls — archers hidden there are hard to spot')));
      } else P.append(h('p', { class: 'sub' }, 'Send a scout close to learn its defenses before you attack.'));
      P.append(h('div', { class: 'irow costrow' }, h('b', null, 'Loot'), costChips(g, S.loot)));
      if (st === 'held') {
        const n = [...g.villagers.values()].filter(v => v.away === 'hold:' + s.id).length;
        P.append(h('p', null, `${n} of your soldiers guard it. It pays ${this.costText(S.tribute)} every minute, but may be attacked.`),
          h('div', { class: 'actions' },
            h('button', { class: 'btn ghost', onclick: () => { C.recall(s); this.renderMapUI(); } }, 'Recall the garrison'),
            h('button', { class: 'btn danger', onclick: () => this.hud.openModal(`Plunder ${s.name}?`, h('div', null,
              h('p', null, `Your garrison strips ${s.name} of everything of value, burns it and marches home with the loot. It stops paying tribute and can’t be held again.`),
              h('div', { class: 'irow costrow' }, h('b', null, 'They bring home'), costChips(g, C.plunderLoot(s)))),
              [{ label: 'Keep holding it', cls: 'ghost' }, { label: 'Plunder and come home', cls: 'danger', fn: () => { C.plunderHeld(s); this.selectSite(s); this.renderMapUI(); } }]) }, 'Plunder and come home')));
      }
    }
    const waiting = C.missions.find(m => m.kind === 'army' && m.site === s.id && m.phase === 'ready');
    const actions = h('div', { class: 'actions' });
    if (waiting) actions.append(h('button', { class: 'btn danger', onclick: () => this.openBattle(waiting) }, icon('sword', 16), 'Lead the attack'));
    else if (s.type !== 'ruins' && st !== 'held' && st !== 'ruined' && !C.missions.some(m => m.site === s.id)) actions.append(h('button', { class: 'btn danger', onclick: () => this.armyPicker(s) }, icon('flag', 16), 'Raid'));
    if (st !== 'ruined' || s.type !== 'ruins') actions.append(h('button', { class: 'btn ghost', onclick: () => { C.sendScout({ x: s.x, z: s.z }); this.renderMapUI(); } }, icon('scout', 16), 'Send a scout'));
    P.append(actions);
  }
  /* ---------- the rival clans ---------- */
  openClans() {
    const g = this.game, K = g.clans, body = h('div', { class: 'clans' });
    const statusName = { rivals: 'Rivals', war: 'At war', truce: 'Truce', allied: 'Allied', married: 'Bound by marriage', fallen: 'Destroyed' };
    const render = () => {
      body.textContent = '';
      body.append(h('p', { class: 'sub' }, 'Three clans hold the land around you. Rivals and clans at war raid you (from Keep level 4) and attack the places you hold; allies never do, and send gifts. Take or break every clan — or storm the Shogun\u2019s castle — to unify the land.'));
      for (const [k, c] of Object.entries(CLANS)) {
        const st = K.status[k], rel = Math.round(K.rel[k]), places = K.sitesOf(k).length;
        const card = h('div', { class: 'clancard' + (st === 'fallen' ? ' fallen' : '') },
          h('div', { class: 'clanhead' }, h('span', { class: 'mon', style: `background:${c.color}` }, c.name[0]), h('div', null, h('b', null, `${c.name} clan`), h('small', null, c.desc)), h('span', { class: 'pill ' + st }, statusName[st])),
          st === 'fallen' ? null : h('div', { class: 'relrow' }, h('small', null, 'Feelings'), h('div', { class: 'relbar' }, h('i', { style: `left:50%;width:${Math.abs(rel) / 2}%;${rel < 0 ? `transform:translateX(-100%);background:#c2412d` : 'background:#5f8a3e'}` })), h('small', null, String(rel))),
          st === 'fallen' ? null : h('small', { class: 'sub' }, `${places} place${places === 1 ? '' : 's'}${K.spied[k] || K.friendly(k) ? ` · about ${Math.round(K.power[k])} soldiers` : ' · strength unknown (send a spy)'}`));
        if (st !== 'fallen') {
          const acts = h('div', { class: 'clanacts' });
          for (const o of K.options(k)) acts.append(h('button', { class: 'btn small ' + (o.id === 'war' || o.id === 'demand' ? 'danger' : 'ghost'), disabled: o.why ? true : null, title: o.why || o.desc, onclick: () => { if (K.act(k, o.id)) render(); } }, o.label, Object.keys(o.cost).length ? costChips(g, o.cost) : null));
          card.append(acts);
        }
        body.append(card);
      }
    };
    render();
    this.hud.openModal('Clans & diplomacy', body, [{ label: 'Close' }], { wide: true });
  }
  armyPicker(site) {
    const g = this.game, C = g.country, soldiers = g.soldiers();
    const types = ['ashigaru', 'shieldman', 'samurai', 'archer', 'berserker', 'taisho'];
    // two groups: the west group (everything, by default) and an east group for a pincer attack
    const pick = Object.fromEntries(types.map(t => [t, [soldiers.filter(v => v.job === t).length, 0]]));
    const haveRams = g.state.rams || 0, rams = [Math.min(haveRams, 2), 0];
    const body = h('div', { class: 'menu picker' });
    const counter = (arr, k, max) => h('span', { class: 'ctr' },
      h('button', { class: 'mini', onclick: () => { arr[k] = Math.max(0, arr[k] - 1); render(); } }, '−'), h('span', { class: 'count' }, String(arr[k])),
      h('button', { class: 'mini', onclick: () => { if (arr[0] + arr[1] < max) arr[k]++; else if (arr[1 - k] > 0) { arr[1 - k]--; arr[k]++; } render(); } }, '+'));
    const render = () => {
      body.textContent = '';
      if (!soldiers.length) { body.append(h('p', null, 'You have no soldiers. Train Ashigaru at the Dojo and archers at the Kyūdō Range, and appoint commanders at the Keep.')); return; }
      body.append(h('div', { class: 'selrow head' }, h('span'), h('b', null, 'Troops'), h('span', { class: 'sub' }, 'West group'), h('span', { class: 'sub' }, 'East group')));
      for (const t of types) {
        const list = soldiers.filter(v => v.job === t), have = list.length; if (!have) continue;
        const hurt = list.filter(v => v.hpf != null && v.hpf < 0.95).length;
        body.append(h('div', { class: 'selrow' }, art('person', JOBS[t].look, null, 'face'),
          h('span', null, h('b', null, `${JOBS[t].name} · ${have}`), h('small', { class: 'sub' }, hurt ? `${hurt} wounded` : JOBS[t].commander ? COMMANDERS[t].ability : '')),
          counter(pick[t], 0, have), counter(pick[t], 1, have)));
      }
      body.append(h('div', { class: 'selrow' }, icon('ram', 30), h('span', null, h('b', null, `Battering ram · ${haveRams}`), h('small', { class: 'sub' }, haveRams ? '' : 'Build one at a Siege Workshop')),
        counter(rams, 0, haveRams), counter(rams, 1, haveRams)));
      const n = types.reduce((a, t) => a + pick[t][0] + pick[t][1], 0), east = types.reduce((a, t) => a + pick[t][1], 0);
      body.append(h('p', { class: 'sub' }, east ? 'The west group attacks from the west flank, the east group from the east — close in from both sides at once.' : 'Put troops in the east group to attack from two sides at once.'),
        h('div', { class: 'irow' }, icon('hourglass', 18), h('span', null, `March: ${fmtTime(C.marchTime(site))} — supplies: ${WAR.marchCost * n} wheat`)));
    };
    render();
    this.hud.openModal(`Raid ${site.name}`, body, [{ label: 'Cancel', cls: 'ghost' }, { label: 'March!', cls: 'danger', fn: () => {
      const vids = [], sides = {};
      for (const t of types) {
        // the healthiest go first
        const list = soldiers.filter(v => v.job === t).sort((a, b) => (b.hpf ?? 1) - (a.hpf ?? 1));
        list.slice(0, pick[t][0]).forEach(v => { vids.push(v.id); sides[v.id] = 'w'; });
        list.slice(pick[t][0], pick[t][0] + pick[t][1]).forEach(v => { vids.push(v.id); sides[v.id] = 'e'; });
      }
      const m = C.sendArmy(site, vids, rams[0] + rams[1]);
      if (m && typeof m === 'object') { m.sides = sides; m.ramsE = rams[1]; }
      this.renderMapUI();
    } }], { wide: true });
  }

  /* ================= battle ================= */
  // A held place is threatened: let the player choose how to respond.
  holdAlert(site) {
    const g = this.game, C = g.country, hold = C.holds[site.id]; if (!hold || !hold.attack) return;
    const guards = C.garrison(site), home = g.soldiers();
    this.hud.sound('war');
    this.hud.openModal(`${site.name} is under attack!`, h('div', null,
      h('p', null, `Scouts report a force of about ${hold.attack.force} ${hold.by ? `soldiers of the ${g.clans.name(hold.by)}` : 'enemy soldiers'} marching on ${site.name}. They will storm it in ${fmtTime(hold.attack.at - C.clock)}.`),
      h('p', { class: 'sub' }, `Your garrison: ${guards.length} soldier${guards.length === 1 ? '' : 's'}. The walls, towers and gate are yours now — use them.`)),
      [{ label: 'Lead the defense', cls: 'danger', fn: () => this.openDefense(site) },
       { label: `Send reinforcements (${home.length} at home)`, cls: 'ghost', keep: true, fn: () => this.reinforcePicker(site) },
       { label: 'Let the garrison fight', cls: 'ghost' }], { locked: true, wide: true });
  }
  reinforcePicker(site) {
    const g = this.game, C = g.country, home = g.soldiers();
    if (!home.length) { g.toast('You have no soldiers at home to send', 'warn'); return; }
    let n = Math.min(home.length, 4);
    const body = h('div', { class: 'menu' }), render = () => {
      body.textContent = '';
      body.append(h('p', null, `March time: ${fmtTime(C.marchTime(site))} — they only help if they arrive before the attack (${fmtTime(C.holds[site.id].attack.at - C.clock)}).`),
        h('div', { class: 'selrow' }, icon('soldier', 28), h('b', null, 'Soldiers'), h('span'), h('button', { class: 'mini', onclick: () => { n = Math.max(1, n - 1); render(); } }, '−'), h('span', { class: 'count' }, `${n} / ${home.length}`), h('button', { class: 'mini', onclick: () => { n = Math.min(home.length, n + 1); render(); } }, '+')));
    };
    render();
    this.hud.openModal(`Reinforce ${site.name}`, body, [{ label: 'Cancel', cls: 'ghost' }, { label: 'March!', cls: 'danger', fn: () => C.sendReinforcements(site, home.slice(0, n).map(v => v.id)) }]);
  }
  openDefense(site) {
    const g = this.game, C = g.country, hold = C.holds[site.id]; if (!hold || !hold.attack) return;
    const vids = C.garrison(site).map(v => v.id);
    if (!vids.length) { g.toast('There is nobody left in the garrison to command', 'warn'); return; }
    hold.attack.fighting = true;
    this.openBattle({ defend: true, vids, rams: 0, site: site.id, force: hold.attack.force, phase: 'defend' });
  }
  openBattle(m) {
    const g = this.game, site = g.country.site(m.site);
    if (!this.map) this.toMap();
    this.map.root.visible = false;
    this.ui.hidden = false;
    if (!m.defend) m.phase = 'battle';
    this.battle = new Battle({ game: g, stage: this.stage }, m, site);
    this.battle.onEnd = r => this.battleEnded(r);
    this.selected = [];
    this.battleCam = new RTSCamera(this.stage.camera, { x0: BATTLE_ORIGIN.x - 66, x1: BATTLE_ORIGIN.x + 66, z0: BATTLE_ORIGIN.z - 66, z1: BATTLE_ORIGIN.z + 66 }, [8, 110]);
    // start close to your own troops
    const mine = this.battle.units.filter(u => u.team === 0), cx = mine.reduce((a, u) => a + u.x, 0) / Math.max(1, mine.length), cz = mine.reduce((a, u) => a + u.z, 0) / Math.max(1, mine.length);
    this.battleCam.target.set(cx || BATTLE_ORIGIN.x, 0, (cz || BATTLE_ORIGIN.z) - (m.defend ? -4 : 8)); this.battleCam.yaw = this.battleCam.goalYaw = 0; this.battleCam.dist = this.battleCam.goalDist = 38;
    this.boxMode = false;
    this.mode = 'battle';
    document.getElementById('ui').classList.remove('mode-map'); document.getElementById('ui').classList.add('mode-battle');
    this.labels.textContent = '';
    if (this.mapPanel) { this.mapPanel.hidden = true; this.missionBox.hidden = true; this.mapHint.hidden = true; }
    this.hud.paused = true;
    this.buildBattleUI(site);
    this.setView({ active: true, cam: this.battleCam, update: (dt, keys) => this.updateBattle(dt, keys) });
    this.hud.sound('war');
  }
  buildBattleUI(site) {
    const b = this.battle;
    this.bui = h('div', { class: 'battleui' });
    this.bTop = h('div', { class: 'btop' }); this.bBottom = h('div', { class: 'bbottom' });
    this.bFloat = h('div', { class: 'bfloat' }); this.bBox = h('div', { class: 'selbox', hidden: true });
    this.bui.append(this.bTop, this.bBottom, this.bFloat, this.bBox);
    this.ui.append(this.bui);
    this.renderBattleUI(true);
  }
  groups() {
    const mine = this.battle.units.filter(u => u.team === 0 && !u.dead && !u.fled);
    return [['ashigaru', 'Spearmen', '1'], ['archer', 'Archers', '2'], ['cmd', 'Commanders', '3'], ['ram', 'Rams', '4'], ['shieldman', 'Shields', '6'], ['samurai', 'Samurai', '7']].map(([k, name, key]) => ({ k, name, key, units: mine.filter(u => k === 'cmd' ? (u.type === 'berserker' || u.type === 'taisho') : u.type === k) })).filter(g => g.units.length);
  }
  renderBattleUI() {
    const b = this.battle, site = b.site; if (!this.bTop) return;
    const foes = b.units.filter(u => u.team === 1 && !u.dead && !u.fled).length, keep = b.structs.find(s => s.def.keep);
    this.bTop.textContent = '';
    const title = b.defend ? `Defend ${site.name}` : `Raid on ${site.name}`;
    const goal = b.defend ? 'Hold the walls until the attackers break — don’t let them reach the keep' : keep ? 'Take the keep: reach it and clear the defenders around it' : 'Defeat or drive off every defender';
    this.bTop.append(h('div', { class: 'btitle' }, h('b', null, title), h('small', null, goal)),
      b.defend ? '' : h('div', { class: 'bstat ' + (b.alarm ? 'alarm' : 'unseen') }, icon(b.alarm ? 'camp' : 'eye', 18), b.alarm ? 'Alarm raised' : 'They haven’t seen you'),
      h('div', { class: 'bstat' }, icon('soldier', 18), `${foes} ${b.defend ? 'attackers' : 'enemies'} left`),
      keep ? h('div', { class: 'bstat cap' }, icon('flag', 18), h('div', { class: 'bar' }, h('i', { style: `width:${b.capture * 100}%` }))) : '',
      this.hud.paused && !b.over ? h('button', { class: 'btn danger', onclick: () => { this.hud.paused = false; this.renderBattleUI(); } }, b.t > 0 ? '▶ Resume' : '▶ Begin the attack') : h('button', { class: 'btn ghost small', onclick: () => { this.hud.paused = true; this.renderBattleUI(); } }, 'Pause'));
    if (this.hud.paused && b.t === 0) this.bTop.append(h('p', { class: 'plan' }, b.defend
      ? 'Your archers are on the towers and walls, your spearmen hold the gate. Plan while paused: drag to look around, click your troops to move them.'
      : 'The defenders haven’t spotted you. The red zone shows what they can see — men on the ground only look ahead, so come from behind. A “?” means one is growing suspicious. Creep in Stealth (C) and strike an unaware guard from behind for a silent takedown; throw a stone (F) to turn heads or lure a guard away; bodies that are found raise the alarm. Once the alarm sounds, one or two of you in the open will tempt a few out through the gate — into your ambush. Drag to look around; Shift+drag or Box select to select troops.'));
    this.bBottom.textContent = '';
    const grp = h('div', { class: 'groups' });
    for (const G of this.groups()) {
      const look = G.k === 'cmd' ? G.units[0].type : G.k === 'ram' ? null : G.k;
      const on = G.units.every(u => this.selected.includes(u));
      grp.append(h('button', { class: 'grp' + (on ? ' on' : ''), title: `Select (${G.key})`, onclick: e => this.selectUnits(G.units, e.shiftKey) },
        look ? art('person', UNITS[look].look, null, 'face') : icon('ram', 30), h('span', null, h('b', null, `${G.units.length}`), h('small', null, G.name)), h('kbd', null, G.key)));
    }
    const sel = this.selected.filter(u => !u.dead);
    const sneaking = sel.length && sel.every(u => u.sneak || u.U.siege);
    const cmds = h('div', { class: 'cmds' },
      h('button', { class: 'btn ghost small' + (this.boxMode ? ' armed' : ''), title: 'Box select (V): drag a box around your troops. Shift+drag also works.', onclick: () => { this.boxMode = !this.boxMode; this.renderBattleUI(); } }, icon('grid', 16), 'Box select', h('kbd', null, 'V')),
      b.defend ? null : h('button', { class: 'btn ghost small' + (sneaking ? ' armed' : ''), title: 'Stealth (C): creep slowly and stay unseen much longer', disabled: sel.length ? null : true, onclick: () => { this.battle.setSneak(sel, !sneaking); this.renderBattleUI(); } }, icon('eye', 16), 'Stealth', h('kbd', null, 'C')),
      h('button', { class: 'btn ghost small' + (this.armed === 'amove' ? ' armed' : ''), title: 'Attack-move (T): walk and fight anything on the way', disabled: sel.length ? null : true, onclick: () => { this.armed = this.armed === 'amove' ? null : 'amove'; this.renderBattleUI(); } }, icon('sword', 16), 'Attack-move', h('kbd', null, 'T')),
      h('button', { class: 'btn ghost small', title: 'Hold (G): stay put and fight only what comes in range', disabled: sel.length ? null : true, onclick: () => this.battle.order(sel, 'hold') }, icon('stop', 16), 'Hold', h('kbd', null, 'G')),
      b.defend ? null : h('button', { class: 'btn ghost small' + (this.armed === 'distract' ? ' armed' : ''), title: 'Distract (F): throw a stone — guards nearby turn to look and one or two walk over to check', disabled: sel.length ? null : true, onclick: () => { this.armed = this.armed === 'distract' ? null : 'distract'; this.renderBattleUI(); } }, icon('scout', 16), 'Distract', h('kbd', null, 'F')),
      h('button', { class: 'btn ghost small', title: 'Stop (X)', disabled: sel.length ? null : true, onclick: () => this.battle.order(sel, 'stop') }, icon('close', 16), 'Stop', h('kbd', null, 'X')));
    for (const u of sel.filter(u => u.type === 'berserker' || u.type === 'taisho')) {
      const C = COMMANDERS[u.type];
      cmds.append(h('button', { class: 'btn small ability' + (this.armed === 'climb' ? ' armed' : ''), title: C.abilityDesc, disabled: u.abilityCd > 0 ? true : null,
        onclick: () => { if (u.type === 'taisho') { this.battle.ability(u); this.renderBattleUI(); } else { this.armed = this.armed === 'climb' ? null : 'climb'; this.abilityUnit = u; this.renderBattleUI(); } } },
        art('person', UNITS[u.type].look, null, 'tiny'), u.abilityCd > 0 ? `${C.ability} (${Math.ceil(u.abilityCd)}s)` : C.ability, h('kbd', null, 'R')));
    }
    this.bBottom.append(grp, cmds, h('button', { class: 'btn danger small retreat', title: 'Pull every unit back off the field', onclick: () => this.battle.retreat() }, 'Retreat'));
    if (this.armed === 'climb') this.bBottom.append(h('div', { class: 'armedhint' }, 'Click where the Berserker should climb to — a wall, over a wall, or up onto an archer tower'));
    if (this.armed === 'amove') this.bBottom.append(h('div', { class: 'armedhint' }, 'Click where to attack-move'));
    if (this.armed === 'distract') this.bBottom.append(h('div', { class: 'armedhint' }, 'Click where the stone should land (within 26 of one of your selected soldiers)'));
  }
  selectUnits(list, add = false) {
    if (!add) this.selected = [];
    for (const u of list) if (!this.selected.includes(u)) this.selected.push(u);
    this.renderBattleUI();
  }
  updateBattle(dt, keys) {
    const b = this.battle;
    this.battleCam.update(dt, keys);
    if (!this.hud.paused) { let sim = dt * this.hud.speed; while (sim > 0) { const s = Math.min(sim, 0.05); b.update(s); sim -= s; } }
    else b.animate(0);
    this.selected = this.selected.filter(u => !u.dead && !u.fled);
    b.setSelection(this.selected);
    // floating shouts & banners
    const cam = this.stage.camera, W = window.innerWidth, H = window.innerHeight;
    this.bFloat.textContent = '';
    for (const f of b.fx) {
      if (f.kind === 'banner') this.bFloat.append(h('div', { class: 'bbanner', style: `opacity:${Math.min(1, 3 - f.t)}` }, f.text));
      if (f.kind === 'shout') { const p = new THREE.Vector3(f.x, f.y + f.t * 0.5, f.z).project(cam); if (p.z < 1) this.bFloat.append(h('div', { class: 'shout' + (f.cls ? ' ' + f.cls : ''), style: `left:${(p.x + 1) / 2 * W}px;top:${(1 - p.y) / 2 * H}px;opacity:${Math.min(1, 3 - f.t)}` }, f.text)); }
    }
    this.uiT = (this.uiT || 0) + dt; if (this.uiT > 0.4) { this.uiT = 0; this.renderBattleUI(); }
  }
  battleEnded(result) {
    const b = this.battle, g = this.game, C = g.country, m = b.mission, site = b.site, S = SITES[site.type];
    const r = b.results(), alive = r.survivors;
    for (const [id, f] of Object.entries(r.health || {})) { const v = g.villagers.get(+id); if (v) v.hpf = f >= 0.99 ? null : f; }
    const P = g.progress; P.add('soldiersLost', r.dead.length);
    if (m.defend) {
      const won = result === 'victory';
      P.add(won ? 'defencesWon' : 'defencesLost'); P.log(won ? `${site.name} held against an attack.` : `${site.name} was lost to an attack.`, 'war');
      C.defenseResult(site, won, alive);
      this.hud.paused = false;
      this.hud.openModal(won ? `${site.name} holds!` : `${site.name} has fallen`, h('div', null,
        h('p', null, won ? 'The attackers broke against your walls and fled.' : alive.length ? `${alive.length} survivor${alive.length > 1 ? 's' : ''} escape and march home.` : 'None of the garrison survived.'),
        r.dead.length ? h('p', { class: 'sub' }, `Fallen: ${r.dead.join(', ')}.`) : h('p', { class: 'sub' }, 'Not one defender fell.')),
        [{ label: 'Return to the map', fn: () => this.closeBattle() }], { locked: true });
      return;
    }
    for (const id of m.vids) if (!alive.includes(id)) g.killVillager(id);
    m.vids = alive.slice();
    this.hud.paused = false;
    const fallen = r.dead.length ? h('p', { class: 'sub' }, `Fallen: ${r.dead.join(', ')}. They will be remembered.`) : h('p', { class: 'sub' }, 'Not one of your soldiers fell.');
    const finish = (loot, garrison) => {
      if (garrison) { C.hold(site, garrison); m.vids = m.vids.filter(id => !garrison.includes(id)); }
      C.returnArmy(m, m.vids, r.rams, loot);
      this.closeBattle();
    };
    if (result === 'victory') {
      P.add('battlesWon'); if (!r.dead.length) P.stats.flawless = true;
      if (['castle', 'warlord', 'shogun', 'smallcastle', 'fort'].includes(site.type)) P.add('castlesTaken');
      P.log(`Victory at ${site.name}${r.dead.length ? ` — fallen: ${r.dead.join(', ')}` : ', without a single loss'}.`, 'war');
      if (site.type === 'shogun') setTimeout(() => P.win('shogun'), 400);
      if (C.status(site) !== 'held') C.setStatus(site, 'scouted');
      const plunder = {}, take = {}; for (const k in S.loot) { plunder[k] = Math.round(S.loot[k] * 1.5); take[k] = Math.round(S.loot[k] * 0.6); }
      const canHold = alive.length >= WAR.garrisonMin + 0;
      const gSize = Math.min(alive.length, Math.max(WAR.garrisonMin, Math.ceil(alive.length / 3)));
      this.hud.openModal(`Victory at ${site.name}!`, h('div', null,
        h('p', null, `${site.name} is yours. What now?`), fallen,
        h('div', { class: 'choice' },
          h('div', null, h('h3', null, 'Plunder and burn'), h('p', { class: 'sub' }, 'Carry off everything of value and leave it in ruins.'), costChips(g, plunder)),
          h('div', null, h('h3', null, 'Hold it'), h('p', { class: 'sub' }, canHold ? `Leave ${gSize} soldiers as a garrison. It pays ${this.costText(S.tribute)} every minute, but the enemy may try to take it back.` : `You need at least ${WAR.garrisonMin} survivors to hold it.`), costChips(g, take)))),
        [{ label: 'Plunder', cls: 'danger', fn: () => { g.clans.onTaken(site, 'plundered'); P.add('plundered'); C.setStatus(site, 'ruined'); finish(plunder); } },
         ...(canHold ? [{ label: `Hold with ${gSize}`, fn: () => { g.clans.onTaken(site, 'held'); const garrison = alive.slice(0, gSize); finish(take, garrison); } }] : [])], { locked: true, wide: true });
    } else {
      P.add('battlesLost'); P.log(`${result === 'retreat' ? 'Retreat from' : 'Defeat at'} ${site.name}.`, 'war');
      if (C.status(site) === 'known') C.setStatus(site, 'scouted');
      this.hud.openModal(result === 'retreat' ? 'Your army retreats' : 'Defeat', h('div', null,
        h('p', null, alive.length ? `${alive.length} survivor${alive.length > 1 ? 's' : ''} march home.` : 'None of your soldiers survived.'), fallen,
        h('p', { class: 'sub' }, 'Tip: scout first, hide archers in the bushes to thin out the wall archers, and bring a ram for the gate.')),
        [{ label: 'Return to the map', fn: () => finish(null) }], { locked: true });
    }
  }
  closeBattle() {
    if (this.battle) { this.battle.dispose(); this.battle = null; }
    if (this.bui) { this.bui.remove(); this.bui = null; this.bTop = null; }
    document.getElementById('ui').classList.remove('mode-battle');
    this.toMap();
    if (this.mapPanel) { this.missionBox.hidden = false; this.mapHint.hidden = false; }
  }

  /* ================= input for map & battle ================= */
  ndcOf(e) { const r = this.stage.renderer.domElement.getBoundingClientRect(); this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); this.ray.setFromCamera(this.ndc, this.stage.camera); }
  groundBattle(e) { this.ndcOf(e); const p = new THREE.Vector3(); return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) ? p : null; }
  groundMap(e) {
    this.ndcOf(e);
    const hits = this.ray.intersectObjects([this.map.terrain, ...this.map.siteObjs.values()], true);
    const siteHit = hits.find(x => x.object.userData.mapPick && x.object.visible);
    const ground = hits.find(x => x.object === this.map.terrain);
    return { pick: siteHit && siteHit.object.userData.mapPick, point: ground ? { x: ground.point.x - MAP_ORIGIN.x, z: ground.point.z - MAP_ORIGIN.z } : null, world: ground && ground.point };
  }
  onDown(e) {
    if (this.mode === 'village' || e.target !== this.stage.renderer.domElement) return;
    const cam = this.mode === 'map' ? this.mapCam : this.battleCam;
    this.down = { x: e.clientX, y: e.clientY, drag: false, shift: e.shiftKey, world: this.mode === 'map' ? this.groundMap(e).world : this.groundBattle(e) };
    this.pointers = (this.pointers || 0) + 1;
  }
  onMove(e) {
    if (this.mode === 'village' || !this.down) return;
    const D = this.down;
    if (!D.drag && Math.hypot(e.clientX - D.x, e.clientY - D.y) > 8) D.drag = true;
    if (!D.drag) return;
    if (this.mode === 'map') {
      const gp = this.groundMap(e).world;
      if (gp && D.world) { this.mapCam.pan(D.world.x - gp.x, D.world.z - gp.z); this.mapCam.apply(); }
    } else if (!(D.shift || this.boxMode)) {
      // drag in battle moves the camera
      const gp = this.groundBattle(e);
      if (gp && D.world) { this.battleCam.pan(D.world.x - gp.x, D.world.z - gp.z); this.battleCam.apply(); }
    } else {
      // Shift+drag (or Box select mode) = box select
      const x0 = Math.min(D.x, e.clientX), y0 = Math.min(D.y, e.clientY);
      Object.assign(this.bBox.style, { left: x0 + 'px', top: y0 + 'px', width: Math.abs(e.clientX - D.x) + 'px', height: Math.abs(e.clientY - D.y) + 'px' });
      this.bBox.hidden = false;
    }
  }
  onUp(e) {
    const D = this.down; this.down = null; this.pointers = Math.max(0, (this.pointers || 1) - 1);
    if (this.mode === 'village' || !D) return;
    if (this.mode === 'map') {
      if (D.drag) return;
      const { pick, point } = this.groundMap(e);
      if (pick && pick.kind === 'site') this.selectSite(this.game.country.site(pick.id));
      else if (pick && pick.kind === 'home') this.selectHome();
      else if (point) this.selectPoint(point);
      return;
    }
    // battle
    const b = this.battle; if (!b || b.over) return;
    if (D.drag && !(D.shift || this.boxMode)) return;
    if (D.drag) {
      this.bBox.hidden = true;
      const x0 = Math.min(D.x, e.clientX), x1 = Math.max(D.x, e.clientX), y0 = Math.min(D.y, e.clientY), y1 = Math.max(D.y, e.clientY);
      const inBox = b.units.filter(u => u.team === 0 && !u.dead && !u.fled).filter(u => { const s = this.screen(u); return s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1; });
      this.selectUnits(inBox, D.shift || e.shiftKey);
      return;
    }
    const hit = this.pickBattle(e), g = this.groundBattle(e);
    if (this.armed === 'climb' && g) {
      // clicking a tower or wall climbs right onto it
      const onto = hit && hit.isStruct ? { x: hit.x, z: hit.z } : { x: g.x, z: g.z };
      if (this.abilityUnit) b.ability(this.abilityUnit, onto); this.armed = null; this.renderBattleUI(); return;
    }
    if (this.armed === 'distract' && g) {
      const r = b.distract(this.selected, { x: g.x, z: g.z });
      if (r === 'far') this.hud.toast('Too far to throw — get one of your soldiers within 26 of that spot', 'warn');
      if (r === 'busy') this.hud.toast('Your soldiers need a moment before throwing again', 'warn');
      this.armed = null; this.renderBattleUI(); return;
    }
    if (hit && hit.team === 0) {
      const now = performance.now();
      if (this.lastClick && this.lastClick.u === hit && now - this.lastClick.t < 380) this.selectUnits(b.units.filter(u => u.team === 0 && u.type === hit.type && !u.dead));
      else if (e.shiftKey) { if (this.selected.includes(hit)) this.selected = this.selected.filter(u => u !== hit); else this.selected.push(hit); this.renderBattleUI(); }
      else this.selectUnits([hit]);
      this.lastClick = { u: hit, t: now };
      return;
    }
    if (!this.selected.length) return;
    if (hit) { b.order(this.selected, 'attack', null, hit); b.focusTarget = hit; this.hud.sound('click'); }
    else if (g) { b.order(this.selected, this.armed === 'amove' ? 'amove' : 'move', { x: g.x, z: g.z }); b.focusTarget = null; this.moveMark(g); }
    this.armed = null; this.renderBattleUI();
  }
  moveMark(p) { this.battle.fx.push({ kind: 'shout', x: p.x, z: p.z, y: 0.5, text: '▼', t: 2.2 }); }
  screen(u) { const p = new THREE.Vector3(u.x, (u.y || 0) + 1, u.z).project(this.stage.camera); return { x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight, z: p.z }; }
  pickBattle(e) {
    const b = this.battle; let best = null, bd = 26;
    for (const u of b.units) { if (u.dead || u.fled) continue; if (u.team === 1 && u.hidden) continue; const s = this.screen(u); const d = Math.hypot(s.x - e.clientX, s.y - e.clientY); if (s.z < 1 && d < bd) { bd = d; best = u; } }
    if (best) return best;
    this.ndcOf(e);
    const hits = this.ray.intersectObjects(b.structs.filter(s => !s.dead && s.maxHp).map(s => s.model), true);
    if (hits.length) { const id = hits[0].object.userData.struct; return b.structs[id - 1]; }
    return null;
  }
  onWheel(e) {
    if (this.mode === 'village') return;
    e.preventDefault();
    const cam = this.mode === 'map' ? this.mapCam : this.battleCam;
    if (e.ctrlKey) { cam.zoom(Math.exp(e.deltaY * 0.012)); return; }
    if (!this.hud.settings.scrollPans) { cam.zoom(Math.exp(clampWheel(e) * 0.0025)); return; }
    const k = cam.dist * 0.0022, f = cam.forward(), r = cam.right();
    cam.pan((r.x * e.deltaX - f.x * e.deltaY) * k, (r.z * e.deltaX - f.z * e.deltaY) * k);
  }
  onKey(k) {
    if (this.mode === 'village') return false;
    if (!this.hud.modal.hidden) return false;
    if (k === 'm' && this.mode === 'map') { this.toVillage(); return true; }
    if (k === 'escape') {
      if (this.mode === 'map') { if (this.sel) { this.sel = null; this.map.select(null); this.map.pinAt(null); this.renderSitePanel(); } else this.toVillage(); return true; }
      if (this.armed) { this.armed = null; this.renderBattleUI(); return true; }
      this.selected = []; this.renderBattleUI(); return true;
    }
    if (this.mode !== 'battle') return ['b', 'r', 'delete', 'backspace', 'h'].includes(k);
    const b = this.battle, sel = this.selected.filter(u => !u.dead);
    const G = this.groups();
    if (/^[1-4]$|^[67]$/.test(k)) { const g = G.find(x => x.key === k); if (g) this.selectUnits(g.units); return true; }
    if (k === '5') { this.selectUnits(b.units.filter(u => u.team === 0 && !u.dead && !u.fled)); return true; }
    if (k === 't') { this.armed = 'amove'; this.renderBattleUI(); return true; }
    if (k === 'c') { const on = !sel.every(u => u.sneak || u.U.siege); b.setSneak(sel, on); this.renderBattleUI(); return true; }
    if (k === 'v') { this.boxMode = !this.boxMode; this.renderBattleUI(); return true; }
    if (k === 'x') { b.order(sel, 'stop'); return true; }
    if (k === 'f' && !b.defend) { this.armed = this.armed === 'distract' ? null : 'distract'; this.renderBattleUI(); return true; }
    if (k === 'g') { b.order(sel, 'hold'); return true; }
    if (k === 'r') { const c = sel.find(u => u.type === 'berserker' || u.type === 'taisho'); if (c) { if (c.type === 'taisho') b.ability(c); else { this.armed = 'climb'; this.abilityUnit = c; } this.renderBattleUI(); } return true; }
    if (k === ' ') { this.hud.paused = !this.hud.paused; this.renderBattleUI(); return true; }
    return ['b', 'delete', 'backspace', 'm', 'h'].includes(k);
  }

  /* ================= keep & workshop panels ================= */
  extraPanel(p, b) {
    const g = this.game;
    if (b.type === 'townhall' && b.done) {
      const box = h('div', { class: 'jobs' }, h('div', { class: 'jrow' }, icon('soldier', 18), h('b', null, 'Commanders')));
      for (const [type, C] of Object.entries(COMMANDERS)) {
        const cur = [...g.villagers.values()].find(v => v.job === type);
        if (!cur && g.thLevel < C.th) { box.append(h('div', { class: 'cmdrow' }, art('person', JOBS[type].look, null, 'face'), h('div', null, h('b', null, JOBS[type].name), h('small', null, `${C.ability}: ${C.abilityDesc}`)), h('span', { class: 'pill' }, `Keep level ${C.th}`))); continue; }
        box.append(h('div', { class: 'cmdrow' }, art('person', JOBS[type].look, null, 'face'), h('div', null, h('b', null, JOBS[type].name + (cur ? ` — ${cur.name}` : '')), h('small', null, `${C.ability}: ${C.abilityDesc}`)),
          cur ? h('span', { class: 'pill' }, cur.away ? 'Away' : 'Ready') : h('button', { class: 'btn small', onclick: () => {
            const cand = g.soldiers().find(v => v.job === 'ashigaru') || g.idleVillagers()[0];
            if (!cand) return g.toast('You need a spearman (or an unemployed villager) to promote', 'warn');
            if (!g.canAfford(C.cost)) return g.toast('Not enough resources', 'warn');
            g.pay(C.cost); g.setJob(cand, type); g.toast(`${cand.name} is now your ${JOBS[type].name}!`); this.hud.renderPanel();
          } }, 'Appoint', costChips(g, C.cost))));
      }
      p.append(box);
    }
    if (b.type === 'dojo' && b.done) {
      // what the dojo trains: spearmen, shield-bearers (Keep 2) or samurai (Keep 4)
      const cur = g.trainInfo(b).to, box = h('div', { class: 'jobs' }, h('div', { class: 'jrow' }, icon('katana', 20), h('b', null, 'Train as')));
      for (const [k, T] of Object.entries(DOJO_TRAINS)) {
        const locked = g.thLevel < T.th;
        box.append(h('button', { class: 'jobcard' + (k === cur ? ' on' : ''), disabled: locked ? true : null, onclick: () => { if (b.trainAs !== k) { b.trainAs = k; g.toast(`The dojo now trains ${JOBS[k].name}s`); } this.hud.renderPanel(); } },
          art('person', JOBS[k].look, null, 'face'), h('span', null, h('b', null, JOBS[k].name), h('small', null, locked ? `Keep level ${T.th}` : `${T.time}s · ${this.costText(T.cost)}`))));
      }
      box.append(h('p', { class: 'sub' }, 'Trainees already in the yard finish as whatever the dojo trains when they graduate.'));
      p.append(box);
    }
    if (b.type === 'strategy' && b.done) {
      const A = g.state.research.active;
      p.append(h('div', { class: 'jobs' }, h('div', { class: 'jrow' }, icon('katana', 20), h('b', null, 'Skill trees')),
        A ? [h('p', { class: 'sub' }, `Studying ${g.researchNode(A.id).node.name}…`), this.hud.bar2(() => g.state.research.active ? g.state.research.active.progress : 1)] : h('p', { class: 'sub' }, 'Your scholars are waiting for orders.'),
        h('button', { class: 'btn', onclick: () => this.hud.openResearch() }, 'Open the skill trees')));
    }
    if (b.type === 'workshop' && b.done) {
      const cost = { wood: 120, stone: 20 };
      p.append(h('div', { class: 'jobs' }, h('div', { class: 'jrow' }, icon('ram', 22), h('b', null, 'Battering rams'), this.hud.live(h('span', { class: 'count' }), el => { el.textContent = `${g.state.rams || 0} ready`; })),
        this.hud.live(h('div', null), el => {
          el.textContent = '';
          if (g.state.ramBuild) { const left = g.state.ramBuild.done - g.state.clock; el.append(h('p', { class: 'sub' }, `Building a ram… ${fmtTime(left)}`), h('div', { class: 'bar' }, h('i', { style: `width:${(1 - left / 45) * 100}%` }))); }
          else el.append(h('button', { class: 'btn small', onclick: () => { if (!g.canAfford(cost)) return g.toast('Not enough resources', 'warn'); g.pay(cost); g.state.ramBuild = { done: g.state.clock + Math.round(45 * (1 - g.rb('ramBuild'))) }; this.hud.renderPanel(); } }, `Build a ram (${Math.round(45 * (1 - g.rb('ramBuild')))}s)`, costChips(g, cost)));
        })));
    }
  }
}
