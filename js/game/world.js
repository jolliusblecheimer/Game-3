// The village simulation: buildings, villagers, resources, time, saving.
import * as THREE from 'three';
import { BUILDINGS, JOBS, RES, START, ECON } from './data.js';
import { Grid, FREE, TREE, ROCK } from './grid.js';
import { PLOT } from '../render/nature.js';
import { buildModel, buildScaffold } from '../render/buildings.js';
import { Person } from '../render/people.js';
import { thinkVillager, updateVillager } from './villagers.js';
import { Country } from './country.js';
import { NAMES, mulberry32, clamp } from '../util.js';

export const SAVE_KEY = 'tenka.save.v1';
const CONNECT = { wall: ['wall', 'gate', 'tower'], palisade: ['palisade', 'gate', 'tower', 'wall'], hedge: ['hedge'], road: ['road', 'stoneroad', 'gate', 'torii'], stoneroad: ['road', 'stoneroad', 'gate', 'torii'] };
export const SAVE_VERSION = 2;

export class Game {
  constructor(stage, nature, seed) {
    this.stage = stage; this.scene = stage.scene; this.nature = nature;
    this.grid = new Grid();
    this.buildings = new Map(); this.villagers = new Map();
    this.state = {
      seed, res: { ...START.res }, clock: 0, time: 0.3, day: 1, nextId: 1,
      settings: { autoBuild: true, welcome: true, quality: 'high' }, stats: { arrived: 0, trained: 0 },
      arriveT: 0, eatAcc: 0,
    };
    this.listeners = new Set();
    this.version = 0;
    this.rand = mulberry32(seed * 3 + 1);
    // trees & rocks occupy grid cells
    for (const t of nature.trees) this.grid.set(t.cx, t.cz, TREE, false);
    for (const r of nature.rocks) this.grid.set(r.cx, r.cz, ROCK, false);
    this.country = new Country(this);
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type, data) { this.version++; for (const fn of this.listeners) fn(type, data); }
  toast(text, kind = '') { this.emit('toast', { text, kind }); }

  /* ---------- derived numbers ---------- */
  get pop() { return this.villagers.size; }
  housing() { let h = 0; for (const b of this.buildings.values()) if (b.done && b.def.housing) h += b.def.housing; return h; }
  storageCap() { let s = 0; for (const b of this.buildings.values()) if (b.done && b.def.storage) s += b.def.storage; return s; }
  beauty() { let s = 0; for (const b of this.buildings.values()) if (b.done && b.def.beauty) s += b.def.beauty; return s; }
  harmony() { return Math.min(30, Math.round(this.beauty() * 12 / (this.pop + 4))); }
  hungry() { return this.state.res.wheat <= 0; }
  workMult() { return (this.hungry() ? ECON.hungryWork : 1) * (1 + this.harmony() / 100); }
  countJob(job) { let n = 0; for (const v of this.villagers.values()) if (v.job === job) n++; return n; }
  idleVillagers() { return [...this.villagers.values()].filter(v => v.job === 'idle' && !v.away); }
  soldiers(all = false) { return [...this.villagers.values()].filter(v => JOBS[v.job].soldier && (all || !v.away)); }
  killVillager(id) {
    const v = this.villagers.get(id); if (!v) return;
    if (v.work) { const b = this.buildings.get(v.work); if (b) b.workers = b.workers.filter(i => i !== id); }
    this.scene.remove(v.person.group); v.person.dispose();
    this.villagers.delete(id); this.emit('villager');
  }

  canAfford(cost) { for (const r in cost) if ((this.state.res[r] || 0) < cost[r]) return false; return true; }
  pay(cost) { for (const r in cost) this.state.res[r] -= cost[r]; this.emit('res'); }
  add(r, amt) {
    const cap = this.storageCap(), before = this.state.res[r];
    this.state.res[r] = Math.min(cap, before + amt);
    this.emit('res'); return this.state.res[r] - before;
  }

  /* ---------- placement ---------- */
  footprint(type, rot) { const [a, b] = BUILDINGS[type].size; return rot % 2 ? [b, a] : [a, b]; }
  worldCenter(cx, cz, w, d) { return { x: -PLOT.half + (cx + w / 2) * PLOT.cell, z: -PLOT.half + (cz + d / 2) * PLOT.cell }; }
  canPlace(type, cx, cz, rot, ignoreId = 0) {
    const def = BUILDINGS[type], [w, d] = this.footprint(type, rot);
    if (cx < 0 || cz < 0 || cx + w > PLOT.n || cz + d > PLOT.n) return { ok: false, why: 'Outside your land' };
    if (def.unique && [...this.buildings.values()].some(b => b.type === type && b.id !== ignoreId)) return { ok: false, why: 'You can only have one' };
    for (let z = cz; z < cz + d; z++) for (let x = cx; x < cx + w; x++) {
      const o = this.grid.get(x, z);
      if (o > 0 && o !== ignoreId && !(this.isRoad(o) && !def.road)) return { ok: false, why: 'Something is already built here' };
    }
    return { ok: true, why: '' };
  }
  isRoad(id) { const b = this.buildings.get(id); return !!(b && b.def.road); }
  // Placing over trees/boulders clears them (and gives a little wood/stone back).
  clearCells(cx, cz, w, d) {
    let wood = 0, stone = 0;
    for (const t of this.nature.trees) if (!t.removed && t.cx >= cx && t.cx < cx + w && t.cz >= cz && t.cz < cz + d) { t.removed = true; this.nature.syncTree(t); if (t.alive) wood += 4; }
    this.nature.rocks.forEach((r, i) => { if (!r.removed && r.cx >= cx && r.cx < cx + w && r.cz >= cz && r.cz < cz + d) { r.removed = true; this.nature.hideRock(i); stone += 8; } });
    if (wood) this.add('wood', wood);
    if (stone) this.add('stone', stone);
  }
  place(type, cx, cz, rot, { done = false, progress = 0, id = 0, free = false } = {}) {
    const def = BUILDINGS[type], [w, d] = this.footprint(type, rot);
    if (!free) { if (!this.canAfford(def.cost)) return null; this.pay(def.cost); }
    if (def.time === 0) done = true; // roads are laid instantly
    // a building placed over a road replaces those road tiles
    if (!def.road) for (let z = cz; z < cz + d; z++) for (let x = cx; x < cx + w; x++) { const o = this.grid.get(x, z); if (o > 0 && this.isRoad(o)) this.demolish(o, { silent: true }); }
    const b = { id: id || this.state.nextId++, type, def, cx, cz, rot, w, d, done, progress: done ? 1 : progress, workers: [], builders: 0 };
    if (id && id >= this.state.nextId) this.state.nextId = id + 1;
    this.clearCells(cx, cz, w, d);
    this.occupy(b, true);
    this.makeVisual(b);
    this.buildings.set(b.id, b);
    if (CONNECT[type] || type === 'gate' || type === 'tower' || type === 'torii') { this.makeVisual(b); this.refreshNeighbours(b); }
    this.emit('build', b);
    return b;
  }
  occupy(b, on) {
    for (let z = b.cz; z < b.cz + b.d; z++) for (let x = b.cx; x < b.cx + b.w; x++) this.grid.set(x, z, on ? b.id : FREE, on ? !!b.def.walkable : true, on && b.def.road ? b.def.road : 1);
    const c = this.worldCenter(b.cx, b.cz, b.w, b.d), hw = b.w * PLOT.cell / 2, hd = b.d * PLOT.cell / 2;
    this.nature.clearGrass(c.x - hw, c.z - hd, c.x + hw, c.z + hd, on);
  }
  makeVisual(b) {
    if (b.root) { this.scene.remove(b.root); b.root.traverse(o => o.geometry && o.geometry !== b.sharedGeo && o.geometry.dispose()); }
    const [a, bb] = b.def.size, c = this.worldCenter(b.cx, b.cz, b.w, b.d);
    const root = new THREE.Group();
    root.position.set(c.x, 0, c.z); root.rotation.y = b.rot * Math.PI / 2;
    const model = buildModel(b.type, a * PLOT.cell, bb * PLOT.cell, b.id, this.connections(b));
    root.add(model);
    b.root = root; b.model = model; b.extra = model.userData.extra;
    if (!b.done) { b.scaffold = buildScaffold(a * PLOT.cell, bb * PLOT.cell, Math.max(2, b.def.h * 0.8)); root.add(b.scaffold); }
    root.traverse(o => { if (o.isMesh) { o.userData.pick = { kind: 'building', id: b.id }; if (b.def.road) o.castShadow = false; } });
    this.scene.add(root);
    this.syncProgress(b);
  }
  // Walls, palisades and hedges join up with their neighbours.
  connections(b) {
    const fam = CONNECT[b.type]; if (!fam) return null;
    const at = (x, z) => { const o = this.grid.get(x, z); const nb = o > 0 && this.buildings.get(o); return !!(nb && fam.includes(nb.type)); };
    return { n: at(b.cx, b.cz - 1), s: at(b.cx, b.cz + 1), e: at(b.cx + 1, b.cz), w: at(b.cx - 1, b.cz) };
  }
  refreshNeighbours(b) {
    const seen = new Set();
    for (let z = b.cz - 1; z <= b.cz + b.d; z++) for (let x = b.cx - 1; x <= b.cx + b.w; x++) {
      const o = this.grid.get(x, z), nb = o > 0 && o !== b.id && this.buildings.get(o);
      if (nb && CONNECT[nb.type] && !seen.has(nb.id)) { seen.add(nb.id); this.makeVisual(nb); }
    }
  }
  syncProgress(b) {
    if (b.done) { b.model.scale.y = 1; if (b.scaffold) { b.root.remove(b.scaffold); b.scaffold.geometry.dispose(); b.scaffold = null; } return; }
    b.model.scale.y = 0.04 + 0.96 * b.progress;
  }
  // front door in world coords (just outside the footprint, facing +z locally)
  door(b, extra = 1.2) {
    const [, bd] = b.def.size, c = this.worldCenter(b.cx, b.cz, b.w, b.d);
    const local = bd * PLOT.cell / 2 + extra, a = b.rot * Math.PI / 2;
    return { x: c.x + Math.sin(a) * local, z: c.z + Math.cos(a) * local };
  }
  center(b) { return this.worldCenter(b.cx, b.cz, b.w, b.d); }
  // random point inside a walkable building (e.g. a field) or around its edge
  spotIn(b) {
    const c = this.center(b), hw = b.w * PLOT.cell / 2 - 0.8, hd = b.d * PLOT.cell / 2 - 0.8;
    return { x: c.x + (this.rand() * 2 - 1) * hw, z: c.z + (this.rand() * 2 - 1) * hd };
  }
  spotAround(b, r = 1.4) {
    const c = this.center(b), hw = b.w * PLOT.cell / 2 + r, hd = b.d * PLOT.cell / 2 + r, side = Math.floor(this.rand() * 4), t = this.rand() * 2 - 1;
    return side === 0 ? { x: c.x + t * hw, z: c.z + hd } : side === 1 ? { x: c.x + t * hw, z: c.z - hd } : side === 2 ? { x: c.x + hw, z: c.z + t * hd } : { x: c.x - hw, z: c.z + t * hd };
  }

  demolish(id, { silent = false } = {}) {
    const b = this.buildings.get(id); if (!b || b.type === 'townhall') return;
    if (!silent) for (const r in b.def.cost) this.add(r, Math.floor(b.def.cost[r] * ECON.refund * (b.done ? 1 : 1 + b.progress)));
    for (const v of this.villagers.values()) if (v.work === id) this.setJob(v, JOBS[v.job].soldier ? v.job : 'idle');
    this.occupy(b, false);
    this.scene.remove(b.root); b.root.traverse(o => o.geometry && o.geometry.dispose());
    this.buildings.delete(id);
    this.refreshNeighbours(b);
    for (const v of this.villagers.values()) v.reset = true; // paths may have changed
    this.emit('demolish', b);
  }
  move(id, cx, cz, rot) {
    const b = this.buildings.get(id); if (!b) return false;
    this.occupy(b, false);
    const ok = this.canPlace(b.type, cx, cz, rot, id).ok;
    if (!ok) { this.occupy(b, true); return false; }
    [b.w, b.d] = this.footprint(b.type, rot); b.cx = cx; b.cz = cz; b.rot = rot;
    this.clearCells(cx, cz, b.w, b.d); this.occupy(b, true); this.makeVisual(b);
    for (const v of this.villagers.values()) v.reset = true;
    this.emit('move', b); return true;
  }

  /* ---------- villagers ---------- */
  spawnVillager({ id = 0, name = null, job = 'idle', work = null, seed = 0, x = null, z = null, train = 0, paid = false } = {}) {
    const vid = id || this.state.nextId++;
    if (id && id >= this.state.nextId) this.state.nextId = id + 1;
    const used = new Set([...this.villagers.values()].map(v => v.name));
    const pick = name || NAMES.find(n => !used.has(n)) || NAMES[Math.floor(this.rand() * NAMES.length)];
    const s = seed || Math.floor(this.rand() * 1e6);
    const person = new Person(JOBS[job].look, s);
    const th = [...this.buildings.values()].find(b => b.type === 'townhall');
    const p = x != null ? { x, z } : th ? this.door(th, 2 + this.rand() * 3) : { x: 0, z: 10 };
    const v = { id: vid, name: pick, job, work, seed: s, person, pos: { x: p.x, z: p.z }, elev: 0, heading: this.rand() * 6, path: null, act: 0, status: 'Settling in', train, paid, carry: null, reset: false };
    person.group.position.set(v.pos.x, 0, v.pos.z);
    person.body.userData.pick = { kind: 'villager', id: vid };
    person.group.traverse(o => { if (o.isMesh) o.userData.pick = { kind: 'villager', id: vid }; });
    this.scene.add(person.group);
    this.villagers.set(vid, v);
    this.emit('villager', v);
    return v;
  }
  setJob(v, job, work = null) {
    if (v.work) { const b = this.buildings.get(v.work); if (b) b.workers = b.workers.filter(i => i !== v.id); }
    if (v.tree) { v.tree.reserved = 0; v.tree = null; }
    v.job = job; v.work = work; v.train = 0; v.paid = false;
    if (work) { const b = this.buildings.get(work); if (b && !b.workers.includes(v.id)) b.workers.push(v.id); }
    v.carry = null; v.person.setCarry(null); v.elev = 0; v.post = null;
    v.person.setLook(JOBS[job].look);
    v.person.group.traverse(o => { if (o.isMesh) o.userData.pick = { kind: 'villager', id: v.id }; });
    v.path = null; v.act = 0; v.reset = true;
    this.emit('job', v);
  }
  // add/remove a worker at a building; picks the nearest idle villager
  assign(b, delta) {
    if (delta > 0) {
      if (b.workers.length >= b.def.jobs) return this.toast('No free places here', 'warn');
      const c = this.center(b);
      const idle = this.idleVillagers().sort((p, q) => Math.hypot(p.pos.x - c.x, p.pos.z - c.z) - Math.hypot(q.pos.x - c.x, q.pos.z - c.z));
      if (!idle.length) return this.toast('No idle villagers — build houses so more can move in', 'warn');
      this.setJob(idle[0], b.def.job, b.id);
    } else {
      const vid = b.workers[b.workers.length - 1]; if (!vid) return;
      this.setJob(this.villagers.get(vid), 'idle');
    }
  }
  refreshWorkers() {
    for (const b of this.buildings.values()) b.workers = [];
    for (const v of this.villagers.values()) if (v.work) { const b = this.buildings.get(v.work); if (b) b.workers.push(v.id); else { v.work = null; if (!JOBS[v.job].soldier) v.job = 'idle'; } }
  }

  /* ---------- simulation ---------- */
  update(dt) {
    const S = this.state;
    S.clock += dt;
    S.time += dt / ECON.dayLength;
    if (S.time >= 1) { S.time -= 1; S.day++; this.emit('day'); }
    // eating
    S.eatAcc += dt * this.pop / ECON.eatEvery;
    if (S.eatAcc >= 1) { const n = Math.floor(S.eatAcc); S.eatAcc -= n; S.res.wheat = Math.max(0, S.res.wheat - n); if (S.res.wheat === 0) this.emit('hungry'); this.emit('res'); }
    // newcomers
    S.arriveT += dt;
    if (S.arriveT >= ECON.arriveEvery) {
      S.arriveT = 0;
      if (S.settings.welcome && this.pop < this.housing() && this.canAfford(ECON.arriveCost)) {
        this.pay(ECON.arriveCost);
        const v = this.spawnVillager({ x: (this.rand() - 0.5) * 20, z: PLOT.half - 1.5 });
        S.stats.arrived++;
        this.toast(`${v.name} has moved into your village`);
      }
    }
    // trees regrow
    for (const t of this.nature.trees) {
      if (t.removed) continue;
      if (!t.alive && S.clock >= t.regrowAt) { t.alive = true; t.chops = 0; t.grow = 0.15; this.grid.set(t.cx, t.cz, TREE, false); this.nature.syncTree(t); }
      else if (t.alive && t.grow < 1) { t.grow = Math.min(1, t.grow + dt / 25); this.nature.syncTree(t); }
    }
    // villagers
    this.countryT = (this.countryT || 0) + dt;
    if (this.countryT > 0.2) { this.countryT = 0; this.country.update(); }
    // rams take time to build at the workshop
    if (S.ramBuild && S.clock >= S.ramBuild.done) { S.rams = (S.rams || 0) + 1; S.ramBuild = null; this.toast('A battering ram is ready at the Siege Workshop'); this.emit('rams'); }
    for (const v of this.villagers.values()) {
      if (v.away) { v.person.group.visible = false; continue; }
      if (v.reset) { v.reset = false; v.path = null; v.act = 0; v.onDone = null; v.onArrive = null; v.site = null; v.building = null; v.hidden = false; if (!v.post) v.elev = 0; }
      if (!v.path && v.act <= 0) thinkVillager(this, v);
      updateVillager(this, v, dt);
    }
    // ambient building animation
    for (const b of this.buildings.values()) {
      if (b.extra.koi) for (const k of b.extra.koi) { k.a += dt * k.s; k.mesh.position.set(Math.cos(k.a) * k.r, 0.13, Math.sin(k.a) * k.r * 0.8); k.mesh.rotation.y = -k.a; }
      if (b.extra.crop) { const ph = (S.clock / 90 + b.id * 0.37) % 1; b.extra.crop.scale.y = 0.35 + 0.65 * Math.min(1, ph * 1.4); }
    }
  }
  completeConstruction(b) {
    b.done = true; b.progress = 1; this.syncProgress(b);
    if (b.def.time > 6) this.toast(`${b.def.name} is finished!`);
    this.emit('built', b);
  }

  /* ---------- new game / save / load ---------- */
  newGame() {
    const c = PLOT.n / 2 - 2;
    this.place('townhall', c, c, 0, { done: true, free: true });
    this.place('house', c - 4, c + 3, 1, { done: true, free: true });
    this.place('farm', c + 6, c + 1, 0, { done: true, free: true });
    for (let i = 0; i < START.villagers; i++) this.spawnVillager();
    const farm = [...this.buildings.values()].find(b => b.type === 'farm');
    const vs = [...this.villagers.values()];
    this.setJob(vs[0], 'farmer', farm.id); this.setJob(vs[1], 'farmer', farm.id);
    this.toast('Welcome, lord. Your people await your command.');
  }
  serialize() {
    const S = this.state;
    return {
      v: SAVE_VERSION, savedAt: Date.now(), seed: S.seed, res: S.res, clock: S.clock, time: S.time, day: S.day, nextId: S.nextId, settings: S.settings, stats: S.stats,
      arriveT: S.arriveT, eatAcc: S.eatAcc,
      buildings: [...this.buildings.values()].map(b => ({ id: b.id, type: b.type, cx: b.cx, cz: b.cz, rot: b.rot, done: b.done, progress: +b.progress.toFixed(4) })).concat(this.keptBuildings || []),
      villagers: [...this.villagers.values()].map(v => ({ id: v.id, name: v.name, job: v.job, work: v.work, seed: v.seed, x: +v.pos.x.toFixed(2), z: +v.pos.z.toFixed(2), train: +(v.train || 0).toFixed(2), paid: !!v.paid, away: v.away || null })).concat(this.keptVillagers || []),
      rams: S.rams || 0, ramBuild: S.ramBuild || null,
      // trees & rocks are stored by grid cell, so future map changes can't scramble them
      trees: this.nature.trees.filter(t => t.removed || !t.alive || t.chops).map(t => [t.cx, t.cz, t.alive ? 1 : 0, Math.round(t.regrowAt), t.removed ? 1 : 0, t.chops || 0]),
      rocks: this.nature.rocks.filter(r => r.removed).map(r => [r.cx, r.cz]),
      country: this.country.serialize(),
    };
  }
  load(s) {
    const S = this.state;
    for (const k of ['clock', 'time', 'day', 'nextId', 'arriveT', 'eatAcc']) if (typeof s[k] === 'number' && isFinite(s[k])) S[k] = s[k];
    for (const r in RES) S.res[r] = Math.max(0, +s.res?.[r] || 0);
    Object.assign(S.settings, s.settings || {}); Object.assign(S.stats, s.stats || {});
    // v1 saves stored trees/rocks by list index; v2 by grid cell
    const v2 = (s.v || 1) >= 2;
    const treeAt = new Map(this.nature.trees.map(t => [t.cx + ',' + t.cz, t]));
    for (const row of s.trees || []) {
      const t = v2 ? treeAt.get(row[0] + ',' + row[1]) : this.nature.trees[row[0]];
      if (!t) continue;
      const [alive, regrowAt, removed, chops] = v2 ? row.slice(2) : row.slice(1);
      t.alive = !!alive; t.regrowAt = +regrowAt || 0; t.removed = !!removed; t.chops = +chops || 0;
      if (t.removed) this.grid.set(t.cx, t.cz, FREE, true); else this.grid.set(t.cx, t.cz, TREE, t.alive ? false : true);
      this.nature.syncTree(t);
    }
    const rocks = this.nature.rocks;
    for (const row of s.rocks || []) {
      const i = v2 ? rocks.findIndex(r => r.cx === row[0] && r.cz === row[1]) : row;
      const r = rocks[i]; if (r) { r.removed = true; this.nature.hideRock(i); this.grid.set(r.cx, r.cz, FREE, true); }
    }
    // Anything this version doesn't know (or can't place) is kept in the save untouched.
    this.keptBuildings = []; this.keptVillagers = [];
    for (const b of s.buildings || []) {
      try {
        if (!BUILDINGS[b.type]) { this.keptBuildings.push(b); continue; }
        this.place(b.type, b.cx | 0, b.cz | 0, (b.rot | 0) % 4, { done: !!b.done, progress: clamp(+b.progress || 0, 0, 1), id: b.id, free: true });
      } catch (e) { console.warn('Skipped a building while loading', b, e); this.keptBuildings.push(b); }
    }
    for (const v of s.villagers || []) {
      try {
        if (!JOBS[v.job]) { this.keptVillagers.push(v); continue; }
        const nv = this.spawnVillager({ id: v.id, name: v.name, job: v.job, work: v.work, seed: v.seed, x: v.x, z: v.z, train: v.train, paid: v.paid });
        if (v.away) { nv.away = v.away; nv.person.group.visible = false; }
      } catch (e) { console.warn('Skipped a villager while loading', v, e); this.keptVillagers.push(v); }
    }
    S.rams = +s.rams || 0; S.ramBuild = s.ramBuild || null;
    try { this.country.load(s.country); } catch (e) { console.warn('Country map could not be loaded', e); this.keptCountry = s.country; }
    for (const v of this.villagers.values()) { v.person.setLook(JOBS[v.job].look); v.person.group.traverse(o => { if (o.isMesh) o.userData.pick = { kind: 'villager', id: v.id }; }); }
    this.refreshWorkers();
    if (![...this.buildings.values()].some(b => b.type === 'townhall')) this.place('townhall', PLOT.n / 2 - 2, PLOT.n / 2 - 2, 0, { done: true, free: true });
    return this.offlineProgress((Date.now() - (s.savedAt || Date.now())) / 1000);
  }
  // While the game was closed: workers keep producing at reduced efficiency.
  offlineProgress(sec) {
    sec = Math.min(sec, ECON.offlineCapHours * 3600);
    if (sec < 120) return null;
    const got = { wheat: 0, wood: 0, stone: 0, gold: 0 }, eff = ECON.offlineEfficiency * (1 + this.harmony() / 100);
    for (const v of this.villagers.values()) {
      const J = JOBS[v.job]; if (!J.res) continue;
      got[J.res] += sec * J.amount / (J.work + 14) * eff;
    }
    got.wheat -= sec * this.pop / ECON.eatEvery;
    const out = {};
    for (const r in got) { const before = this.state.res[r]; this.state.res[r] = clamp(before + got[r], 0, this.storageCap()); out[r] = Math.round(this.state.res[r] - before); }
    // construction continues with idle helpers
    let helpers = this.idleVillagers().length, built = 0;
    for (const b of this.buildings.values()) {
      if (b.done || helpers <= 0) continue;
      b.progress = Math.min(1, b.progress + sec * Math.min(helpers, 3) / Math.max(1, b.def.time));
      if (b.progress >= 1) { b.done = true; this.syncProgress(b); built++; }
      else this.syncProgress(b);
    }
    // recruits finish training
    let trained = 0;
    for (const v of this.villagers.values()) {
      if (v.job !== 'trainee' || !v.paid) continue;
      const b = this.buildings.get(v.work); if (!b) continue;
      v.train += sec * eff;
      if (v.train >= b.def.trainTime) { this.setJob(v, b.def.trains); trained++; }
    }
    this.state.clock += sec; this.state.time = (this.state.time + sec / ECON.dayLength) % 1;
    for (const t of this.nature.trees) if (!t.alive && !t.removed && this.state.clock >= t.regrowAt) { t.alive = true; t.chops = 0; t.grow = 1; this.grid.set(t.cx, t.cz, TREE, false); this.nature.syncTree(t); }
    this.emit('res');
    return { sec, res: out, built, trained };
  }
}
