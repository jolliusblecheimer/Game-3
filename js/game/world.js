// The village simulation: buildings (with levels), villagers, resources, time, saving.
import * as THREE from 'three';
import { BUILDINGS, JOBS, RES, START, ECON, TOWNHALL, MAX_TH, RESEARCH } from './data.js';
import { Grid, FREE, TREE, ROCK } from './grid.js';
import { PLOT } from '../render/nature.js';
import { buildModel, buildScaffold, SIZE_AWARE } from '../render/buildings.js';
import { Person } from '../render/people.js';
import { Mesher, MAT } from '../render/geo.js';
import { thinkVillager, updateVillager } from './villagers.js';
import { Country } from './country.js';
import { Raids } from './raids.js';
import { NAMES, mulberry32, clamp } from '../util.js';

export const SAVE_KEY = 'tenka.save.v1';
export const SAVE_VERSION = 3;
const CONNECT = {
  wall: ['wall', 'gate', 'tower', 'palisade'], palisade: ['palisade', 'gate', 'tower', 'wall'], hedge: ['hedge'],
  road: ['road', 'stoneroad'], stoneroad: ['road', 'stoneroad'],
};
const round5 = n => Math.max(5, Math.round(n / 5) * 5);

export class Game {
  constructor(stage, nature, seed) {
    this.stage = stage; this.scene = stage.scene; this.nature = nature;
    this.grid = new Grid();
    this.buildings = new Map(); this.villagers = new Map();
    this.state = {
      seed, res: { ...START.res }, clock: 0, time: 0.3, day: 1, nextId: 1,
      settings: { welcome: true }, stats: { arrived: 0, trained: 0, raidsBeaten: 0 },
      arriveT: 0, eatAcc: 0, research: { done: [], active: null },
    };
    this.listeners = new Set();
    this.version = 0;
    this.rand = mulberry32(seed * 3 + 1);
    this.clearMarks = new Map();   // "t:cx,cz" / "r:cx,cz" -> marker mesh
    for (const t of nature.trees) this.grid.set(t.cx, t.cz, TREE, false);
    for (const r of nature.rocks) this.grid.set(r.cx, r.cz, ROCK, false);
    this.country = new Country(this);
    this.raids = new Raids(this);
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type, data) { this.version++; for (const fn of this.listeners) fn(type, data); }
  toast(text, kind = '') { this.emit('toast', { text, kind }); }

  /* ---------- derived numbers ---------- */
  get pop() { return this.villagers.size; }
  get keep() { for (const b of this.buildings.values()) if (b.type === 'townhall') return b; return null; }
  get thLevel() { const k = this.keep; return k ? k.level : 1; }
  housing() {
    let h = 0;
    for (const b of this.buildings.values()) if (b.done) { if (b.type === 'townhall') h += TOWNHALL[b.level].housing; else if (b.def.housing) h += b.def.housing + (b.def.housingUp || 2) * (b.level - 1); }
    return h;
  }
  storageCap() {
    let s = 0;
    for (const b of this.buildings.values()) if (b.done) { if (b.type === 'townhall') s += TOWNHALL[b.level].storage; else if (b.def.storage) s += b.def.storage + 300 * (b.level - 1); }
    return s;
  }
  jobSlots(b) { return b.def.jobs ? b.def.jobs + (b.level - 1) : 0; }
  levelMult(b) { return 1 + 0.25 * ((b ? b.level : 1) - 1); }
  // how many of a building the current Keep level allows (null = no limit)
  buildLimit(type) { const d = BUILDINGS[type]; return d.limit ? d.limit[this.thLevel - 1] : d.unique ? 1 : null; }
  countType(type) { let n = 0; for (const b of this.buildings.values()) if (b.type === type) n++; return n; }
  // villagers busy on a construction site right now
  building() { let n = 0; for (const v of this.villagers.values()) if (v.site) n++; return n; }
  // anything a helper could do: build, upgrade, repair, or clear marked land
  hasBuildWork() { for (const b of this.buildings.values()) if (this.needsWork(b)) return true; return this.clearMarks.size > 0; }
  maxHp(b) { return b.def.hp ? Math.round(b.def.hp * (1 + 0.6 * (b.level - 1)) * (1 + this.rb('wallHp'))) : 0; }

  /* ---------- research (skill trees) ---------- */
  researchNode(id) { for (const [tree, T] of Object.entries(RESEARCH)) { const i = T.nodes.findIndex(n => n.id === id); if (i >= 0) return { tree, i, node: T.nodes[i] }; } return null; }
  hasResearch(id) { return this.state.research.done.includes(id); }
  // sum of a research effect over everything researched
  rb(key) { let v = 0; for (const id of this.state.research.done) { const r = this.researchNode(id); if (r && r.node.fx[key]) v += r.node.fx[key]; } return v; }
  researchBlock(id) {
    const r = this.researchNode(id); if (!r) return 'Unknown';
    if (this.hasResearch(id)) return 'Researched';
    if (![...this.buildings.values()].some(b => b.type === 'strategy' && b.done)) return 'Build a Strategy Hall first';
    if (this.state.research.active) return 'Scholars are busy with another study';
    const miss = (r.node.req || []).filter(id => !this.hasResearch(id)).map(id => this.researchNode(id).node.name);
    if (miss.length) return `Needs ${miss.join(' and ')} first`;
    if (!this.canAfford(r.node.cost)) return 'Not enough resources';
    return '';
  }
  startResearch(id) {
    const why = this.researchBlock(id); if (why) { this.toast(why, 'warn'); return false; }
    const r = this.researchNode(id); this.pay(r.node.cost);
    this.state.research.active = { id, progress: 0, time: r.node.time };
    this.toast(`Your scholars begin studying ${r.node.name}`); this.emit('research'); return true;
  }
  beauty() { let s = 0; for (const b of this.buildings.values()) if (b.done && b.def.beauty) s += b.def.beauty; return s; }
  // Harmony: beauty shared among everyone who lives here — more villagers need more beauty (max 30%)
  harmony(extraBeauty = 0) { return Math.min(30, Math.round((this.beauty() + extraBeauty) * 12 / (this.pop + 4))); }
  hungry() { return this.state.res.wheat <= 0; }
  workMult() { return (this.hungry() ? ECON.hungryWork : 1) * (1 + this.harmony() / 100); }
  countJob(job) { let n = 0; for (const v of this.villagers.values()) if (v.job === job) n++; return n; }
  idleVillagers() { return [...this.villagers.values()].filter(v => v.job === 'idle' && !v.away); }
  soldiers(all = false) { return [...this.villagers.values()].filter(v => JOBS[v.job].soldier && (all || !v.away)); }
  unlocked(type) { return (BUILDINGS[type].th || 1) <= this.thLevel; }
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
    this.state.res[r] = Math.max(0, Math.min(cap, before + amt));
    this.emit('res'); return this.state.res[r] - before;
  }

  /* ---------- sizes & placement ---------- */
  sizeAt(type, level = 1) { const d = BUILDINGS[type]; let s = d.size; if (d.grow) for (const L of Object.keys(d.grow).map(Number).sort((a, b) => a - b)) if (level >= L) s = d.grow[L]; return s; }
  footprint(type, rot, level = 1) { const [a, b] = this.sizeAt(type, level); return rot % 2 ? [b, a] : [a, b]; }
  worldCenter(cx, cz, w, d) { return { x: -PLOT.half + (cx + w / 2) * PLOT.cell, z: -PLOT.half + (cz + d / 2) * PLOT.cell }; }
  cellsFree(cx, cz, w, d, ignoreId = 0, forRoad = false) {
    if (cx < 0 || cz < 0 || cx + w > PLOT.n || cz + d > PLOT.n) return false;
    for (let z = cz; z < cz + d; z++) for (let x = cx; x < cx + w; x++) {
      const o = this.grid.get(x, z);
      if (o > 0 && o !== ignoreId && !(this.isRoad(o) && !forRoad)) return false;
    }
    return true;
  }
  canPlace(type, cx, cz, rot, ignoreId = 0) {
    const def = BUILDINGS[type], b = ignoreId && this.buildings.get(ignoreId), [w, d] = this.footprint(type, rot, b ? b.level : 1);
    if (!ignoreId && !this.unlocked(type)) return { ok: false, why: `Needs Town Hall level ${def.th}` };
    if (cx < 0 || cz < 0 || cx + w > PLOT.n || cz + d > PLOT.n) return { ok: false, why: 'Outside your land' };
    if (def.unique && [...this.buildings.values()].some(o => o.type === type && o.id !== ignoreId)) return { ok: false, why: 'You can only have one' };
    if (!ignoreId && def.limit) { const lim = this.buildLimit(type); if (this.countType(type) >= lim) return { ok: false, why: lim ? `You have all ${lim} allowed — upgrade the Keep for more` : `Unlocks at Keep level ${def.limit.findIndex(x => x > 0) + 1}` }; }
    if (!this.cellsFree(cx, cz, w, d, ignoreId, !!def.road)) return { ok: false, why: 'Something is already built here' };
    return { ok: true, why: '' };
  }
  isRoad(id) { const b = this.buildings.get(id); return !!(b && b.def.road); }
  // Building over trees/boulders clears them (a little wood/stone comes back).
  clearCells(cx, cz, w, d) {
    let wood = 0, stone = 0;
    for (const t of this.nature.trees) if (!t.removed && t.cx >= cx && t.cx < cx + w && t.cz >= cz && t.cz < cz + d) { this.removeTree(t); if (t.alive) wood += 4; }
    this.nature.rocks.forEach((r, i) => { if (!r.removed && r.cx >= cx && r.cx < cx + w && r.cz >= cz && r.cz < cz + d) { this.removeRock(r, i); stone += 8; } });
    if (wood) this.add('wood', wood);
    if (stone) this.add('stone', stone);
  }
  removeTree(t) { t.removed = true; this.nature.syncTree(t); this.unmark('t', t.cx, t.cz); }
  removeRock(r, i) { r.removed = true; this.nature.hideRock(i); this.unmark('r', r.cx, r.cz); }
  place(type, cx, cz, rot, { done = false, progress = 0, id = 0, free = false, level = 1, hp = null } = {}) {
    const def = BUILDINGS[type], [w, d] = this.footprint(type, rot, level), [sw, sd] = this.sizeAt(type, level);
    if (!free) { if (!this.canAfford(def.cost)) return null; this.pay(def.cost); }
    if (def.time === 0) done = true; // roads are laid instantly
    if (!def.road) for (let z = cz; z < cz + d; z++) for (let x = cx; x < cx + w; x++) { const o = this.grid.get(x, z); if (o > 0 && this.isRoad(o)) this.demolish(o, { silent: true }); }
    const b = { id: id || this.state.nextId++, type, def, cx, cz, rot, w, d, sw, sd, level, done, progress: done ? 1 : progress, workers: [], upg: null };
    b.hp = hp != null ? hp : this.maxHp(b);
    if (id && id >= this.state.nextId) this.state.nextId = id + 1;
    this.clearCells(cx, cz, w, d);
    this.occupy(b, true);
    this.buildings.set(b.id, b);
    this.makeVisual(b);
    if (CONNECT[type] || type === 'gate' || type === 'tower') this.refreshNeighbours(b);
    this.emit('build', b);
    return b;
  }
  occupy(b, on) {
    for (let z = b.cz; z < b.cz + b.d; z++) for (let x = b.cx; x < b.cx + b.w; x++) this.grid.set(x, z, on ? b.id : FREE, on ? !!b.def.walkable : true, on && b.def.road ? b.def.road : 1);
    const c = this.worldCenter(b.cx, b.cz, b.w, b.d), hw = b.w * PLOT.cell / 2, hd = b.d * PLOT.cell / 2;
    this.nature.clearGrass(c.x - hw, c.z - hd, c.x + hw, c.z + hd, on);
  }
  makeVisual(b) {
    if (b.root) { this.scene.remove(b.root); b.root.traverse(o => o.geometry && o.geometry.dispose()); }
    const c = this.worldCenter(b.cx, b.cz, b.w, b.d), [bw, bd] = b.def.size;
    const root = new THREE.Group();
    root.position.set(c.x, 0, c.z); root.rotation.y = b.rot * Math.PI / 2;
    // field-like buildings are built at their real size; others are scaled up as they grow
    const aware = SIZE_AWARE.has(b.type);
    const model = buildModel(b.type, (aware ? b.sw : bw) * PLOT.cell, (aware ? b.sd : bd) * PLOT.cell, b.id, this.connections(b), b.level);
    if (!aware && (b.sw !== bw || b.sd !== bd)) { const sx = b.sw / bw, sz = b.sd / bd; model.scale.set(sx, (sx + sz) / 2, sz); }
    model.userData.baseScaleY = model.scale.y;
    root.add(model);
    b.root = root; b.model = model; b.extra = model.userData.extra;
    if (!b.done || b.upg) { b.scaffold = buildScaffold(b.sw * PLOT.cell, b.sd * PLOT.cell, Math.max(2, b.def.h * 0.8)); root.add(b.scaffold); }
    else b.scaffold = null;
    root.traverse(o => { if (o.isMesh) { o.userData.pick = { kind: 'building', id: b.id }; if (b.def.road) o.castShadow = false; } });
    this.scene.add(root);
    this.syncProgress(b);
  }
  // Walls, palisades, hedges and roads join up with their neighbours.
  connections(b) {
    const fam = CONNECT[b.type]; if (!fam) return null;
    const at = (x, z) => { const o = this.grid.get(x, z); const nb = o > 0 && this.buildings.get(o); return !!(nb && fam.includes(nb.type)); };
    return { n: at(b.cx, b.cz - 1), s: at(b.cx, b.cz + 1), e: at(b.cx + 1, b.cz), w: at(b.cx - 1, b.cz) };
  }
  refreshNeighbours(b) {
    const seen = new Set();
    for (let z = b.cz - 1; z <= b.cz + b.d; z++) for (let x = b.cx - 1; x <= b.cx + b.w; x++) {
      if ((x < b.cx || x >= b.cx + b.w) && (z < b.cz || z >= b.cz + b.d) && CONNECT[b.type]) continue; // corners don't touch
      const o = this.grid.get(x, z), nb = o > 0 && o !== b.id && this.buildings.get(o);
      if (nb && CONNECT[nb.type] && !seen.has(nb.id)) { seen.add(nb.id); this.makeVisual(nb); }
    }
  }
  syncProgress(b) {
    const base = b.model.userData.baseScaleY || 1;
    if (b.done && !b.upg) { b.model.scale.y = base; if (b.scaffold) { b.root.remove(b.scaffold); b.scaffold.geometry.dispose(); b.scaffold = null; } return; }
    b.model.scale.y = b.done ? base : base * (0.04 + 0.96 * b.progress);
  }
  // front door in world coords (just outside the footprint, facing +z locally)
  door(b, extra = 1.2) {
    const c = this.worldCenter(b.cx, b.cz, b.w, b.d);
    const local = b.sd * PLOT.cell / 2 + extra, a = b.rot * Math.PI / 2;
    return { x: c.x + Math.sin(a) * local, z: c.z + Math.cos(a) * local };
  }
  // a point given in the building's own (unrotated) coordinates
  local(b, lx, lz) { const c = this.center(b), a = b.rot * Math.PI / 2; return { x: c.x + lx * Math.cos(a) + lz * Math.sin(a), z: c.z - lx * Math.sin(a) + lz * Math.cos(a) }; }
  center(b) { return this.worldCenter(b.cx, b.cz, b.w, b.d); }
  spotIn(b) {
    const c = this.center(b), hw = b.w * PLOT.cell / 2 - 0.8, hd = b.d * PLOT.cell / 2 - 0.8;
    return { x: c.x + (this.rand() * 2 - 1) * hw, z: c.z + (this.rand() * 2 - 1) * hd };
  }
  spotAround(b, r = 1.4) {
    const c = this.center(b), hw = b.w * PLOT.cell / 2 + r, hd = b.d * PLOT.cell / 2 + r, side = Math.floor(this.rand() * 4), t = this.rand() * 2 - 1;
    return side === 0 ? { x: c.x + t * hw, z: c.z + hd } : side === 1 ? { x: c.x + t * hw, z: c.z - hd } : side === 2 ? { x: c.x + hw, z: c.z + t * hd } : { x: c.x - hw, z: c.z + t * hd };
  }

  demolish(id, { silent = false, destroyed = false } = {}) {
    const b = this.buildings.get(id); if (!b || b.type === 'townhall') return;
    if (!silent && !destroyed) for (const r in b.def.cost) this.add(r, Math.floor(b.def.cost[r] * ECON.refund * (b.done ? 1 : 1 + b.progress)));
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
    this.refreshNeighbours(b);
    [b.w, b.d] = this.footprint(b.type, rot, b.level); b.cx = cx; b.cz = cz; b.rot = rot;
    this.clearCells(cx, cz, b.w, b.d); this.occupy(b, true); this.makeVisual(b); this.refreshNeighbours(b);
    for (const v of this.villagers.values()) { v.reset = true; if (v.post && v.post.b === id) { v.post = null; v.elev = 0; } }
    this.emit('move', b); return true;
  }

  /* ---------- upgrades ---------- */
  // What an upgrade of b would cost and whether it's possible right now.
  upgradeInfo(b) {
    const def = b.def, th = this.thLevel;
    if (!b.done) return null;
    if (b.upg) return { busy: true };
    if (def.upgradeTo) { // e.g. palisade -> stone wall
      const to = BUILDINGS[def.upgradeTo];
      return { to: def.upgradeTo, name: `Rebuild as ${to.name}`, cost: to.cost, time: to.time, level: 1, ok: th >= to.th && this.canAfford(to.cost), why: th < to.th ? `Needs Town Hall level ${to.th}` : this.canAfford(to.cost) ? '' : 'Not enough resources' };
    }
    const max = def.maxLevel || 1; if (b.level >= max) return { max: true };
    const L = b.level + 1;
    let cost, time, why = '';
    if (b.type === 'townhall') {
      const T = TOWNHALL[L]; cost = T.cost; time = T.time;
      if (this.pop < T.needPop) why = `Needs ${T.needPop} villagers (you have ${this.pop})`;
    } else {
      cost = {}; for (const r in def.cost) cost[r] = round5(def.cost[r] * Math.pow(1.7, L - 1));
      if (def.cat === 'resources' || def.cat === 'military') cost.gold = (cost.gold || 0) + round5(10 * (L - 1) * (L - 1));
      time = Math.round(def.time * (1 + 0.6 * (L - 1)));
      const needTh = def.cat === 'defense' ? Math.min(MAX_TH, (def.th || 1) + L - 1) : Math.min(MAX_TH, L);
      if (th < needTh) why = `Needs Town Hall level ${needTh}`;
    }
    // growing: find room for the bigger footprint that still covers the old one
    let anchor = null;
    const [nw, nd] = this.footprint(b.type, b.rot, L);
    if (nw !== b.w || nd !== b.d) {
      for (let ox = 0; ox <= nw - b.w && !anchor; ox++) for (let oz = 0; oz <= nd - b.d && !anchor; oz++) if (this.cellsFree(b.cx - ox, b.cz - oz, nw, nd, b.id)) anchor = [b.cx - ox, b.cz - oz];
      if (!anchor && !why) why = 'Needs free space around it to grow bigger';
    }
    if (!why && !this.canAfford(cost)) why = 'Not enough resources';
    return { level: L, name: `Upgrade to level ${L}`, cost, time, anchor, grows: !!anchor, ok: !why, why };
  }
  startUpgrade(b) {
    const u = this.upgradeInfo(b); if (!u || !u.ok) { if (u && u.why) this.toast(u.why, 'warn'); return false; }
    this.pay(u.cost);
    if (u.to) { // rebuild as another type in place (keeps the spot)
      const { cx, cz, rot, id } = b; this.demolish(id, { silent: true });
      const nb = this.place(u.to, cx, cz, rot, { free: true, id }); nb.done = true; nb.upg = { level: 1, progress: 0, time: u.time, convert: true }; this.makeVisual(nb);
      this.toast(`Your villagers start rebuilding the wall in stone`); return true;
    }
    if (u.anchor) { this.occupy(b, false); [b.cx, b.cz] = u.anchor; [b.w, b.d] = this.footprint(b.type, b.rot, u.level); [b.sw, b.sd] = this.sizeAt(b.type, u.level); this.clearCells(b.cx, b.cz, b.w, b.d); this.occupy(b, true); for (const v of this.villagers.values()) v.reset = true; }
    b.upg = { level: u.level, progress: 0, time: u.time };
    this.makeVisual(b);
    this.toast(`Builders start upgrading the ${b.def.name}`); this.emit('build', b);
    return true;
  }
  finishUpgrade(b) {
    const u = b.upg; b.upg = null;
    if (!u.convert) b.level = u.level;
    b.hp = this.maxHp(b);
    this.makeVisual(b); this.refreshNeighbours(b);
    this.toast(b.type === 'townhall' ? `The Keep is now level ${b.level}! New buildings are unlocked.` : u.convert ? `The ${b.def.name} is finished` : `${b.def.name} is now level ${b.level}`);
    this.emit('built', b);
  }

  /* ---------- clearing trees & rocks ---------- */
  mark(kind, cx, cz) {
    const key = `${kind}:${cx},${cz}`; if (this.clearMarks.has(key)) return false;
    const m = new Mesher(cx * 7 + cz, 0.05);
    m.cyl(0.04, 0.04, 2.2, 5, '#5a3a28', [0, 1.1, 0]); m.box(0.04, 0.5, 0.6, '#c2412d', [0, 1.9, 0.3]);
    const mesh = m.mesh(MAT.flat, false, false), c = this.grid.center(cx, cz);
    mesh.position.set(c.x + 0.8, kind === 'r' ? 0.8 : 0, c.z + 0.8); this.scene.add(mesh);
    this.clearMarks.set(key, { kind, cx, cz, mesh }); return true;
  }
  unmark(kind, cx, cz) { const key = `${kind}:${cx},${cz}`, m = this.clearMarks.get(key); if (!m) return; this.scene.remove(m.mesh); m.mesh.geometry.dispose(); this.clearMarks.delete(key); }
  markArea(x0, z0, x1, z1) {
    let n = 0;
    for (const t of this.nature.trees) if (!t.removed && t.cx >= x0 && t.cx <= x1 && t.cz >= z0 && t.cz <= z1) n += this.mark('t', t.cx, t.cz) ? 1 : 0;
    for (const r of this.nature.rocks) if (!r.removed && r.cx >= x0 && r.cx <= x1 && r.cz >= z0 && r.cz <= z1) n += this.mark('r', r.cx, r.cz) ? 1 : 0;
    return n;
  }
  clearMarked(m) {
    if (m.kind === 't') { const t = this.nature.trees.find(t => t.cx === m.cx && t.cz === m.cz && !t.removed); if (t) { this.removeTree(t); this.grid.set(t.cx, t.cz, FREE, true); this.add('wood', t.alive ? 6 : 2); } }
    else { const i = this.nature.rocks.findIndex(r => r.cx === m.cx && r.cz === m.cz && !r.removed); if (i >= 0) { this.removeRock(this.nature.rocks[i], i); this.grid.set(m.cx, m.cz, FREE, true); this.add('stone', 12); } }
    this.unmark(m.kind, m.cx, m.cz);
  }

  /* ---------- villagers ---------- */
  spawnVillager({ id = 0, name = null, job = 'idle', work = null, seed = 0, x = null, z = null, train = 0, paid = false } = {}) {
    const vid = id || this.state.nextId++;
    if (id && id >= this.state.nextId) this.state.nextId = id + 1;
    const used = new Set([...this.villagers.values()].map(v => v.name));
    const pick = name || NAMES.find(n => !used.has(n)) || NAMES[Math.floor(this.rand() * NAMES.length)];
    const s = seed || Math.floor(this.rand() * 1e6);
    const person = new Person(JOBS[job].look, s);
    const th = this.keep;
    const p = x != null ? { x, z } : th ? this.door(th, 2 + this.rand() * 3) : { x: 0, z: 10 };
    const v = { id: vid, name: pick, job, work, seed: s, person, pos: { x: p.x, z: p.z }, elev: 0, heading: this.rand() * 6, path: null, act: 0, status: 'Settling in', train, paid, carry: null, reset: false, hp: 100 };
    person.group.position.set(v.pos.x, 0, v.pos.z);
    person.group.traverse(o => { if (o.isMesh) o.userData.pick = { kind: 'villager', id: vid }; });
    this.scene.add(person.group);
    this.villagers.set(vid, v);
    this.emit('villager', v);
    return v;
  }
  setJob(v, job, work = null) {
    if (v.work) { const b = this.buildings.get(v.work); if (b) b.workers = b.workers.filter(i => i !== v.id); }
    if (v.tree) { v.tree.reserved = 0; v.tree = null; }
    v.job = job; v.work = work; v.train = 0; v.paid = false; v.aid = false;
    if (work) { const b = this.buildings.get(work); if (b && !b.workers.includes(v.id)) b.workers.push(v.id); }
    v.carry = null; v.person.setCarry(null); v.elev = 0; v.post = null; v.claim = null; v.hidden = false;
    v.person.setLook(JOBS[job].look);
    v.person.group.traverse(o => { if (o.isMesh) o.userData.pick = { kind: 'villager', id: v.id }; });
    v.path = null; v.act = 0; v.reset = true;
    this.emit('job', v);
  }
  // Only unemployed villagers are ever pulled into a job.
  assign(b, delta) {
    if (delta > 0) {
      if (b.workers.length >= this.jobSlots(b)) return this.toast('No free places here — upgrade it for more', 'warn');
      const c = this.center(b);
      const idle = this.idleVillagers().sort((p, q) => Math.hypot(p.pos.x - c.x, p.pos.z - c.z) - Math.hypot(q.pos.x - c.x, q.pos.z - c.z));
      if (!idle.length) return this.toast('No unemployed villagers — everyone already has a job', 'warn');
      this.setJob(idle[0], b.def.job, b.id);
    } else {
      const vid = b.workers[b.workers.length - 1]; if (!vid) return;
      this.setJob(this.villagers.get(vid), 'idle');
    }
  }
  refreshWorkers() {
    for (const b of this.buildings.values()) b.workers = [];
    for (const v of this.villagers.values()) {
      if (!v.work) continue;
      const b = this.buildings.get(v.work);
      if (!b) { v.work = null; if (!JOBS[v.job].soldier) v.job = 'idle'; continue; }
      if (v.job === 'trainee' && b.type === 'kyudojo') { v.job = 'trainee_archer'; v.person.setLook(JOBS.trainee_archer.look); }
      b.workers.push(v.id);
    }
  }

  /* ---------- simulation ---------- */
  update(dt) {
    const S = this.state;
    S.clock += dt;
    S.time += dt / ECON.dayLength;
    if (S.time >= 1) { S.time -= 1; S.day++; this.emit('day'); }
    S.eatAcc += dt * this.pop / ECON.eatEvery;
    if (S.eatAcc >= 1) { const n = Math.floor(S.eatAcc); S.eatAcc -= n; S.res.wheat = Math.max(0, S.res.wheat - n); if (S.res.wheat === 0) this.emit('hungry'); this.emit('res'); }
    // new families are rare: a chance every few minutes, if there's room and food
    S.arriveT += dt;
    if (S.arriveT >= ECON.arriveEvery) {
      S.arriveT = 0;
      if (S.settings.welcome && this.pop < this.housing() && this.canAfford(ECON.arriveCost) && this.rand() < ECON.arriveChance * (1 + this.harmony() / 60) && !this.raids.active) {
        this.pay(ECON.arriveCost);
        const v = this.spawnVillager({ x: (this.rand() - 0.5) * 20, z: PLOT.half - 1.5 });
        S.stats.arrived++;
        this.toast(`${v.name} has moved into your village. Welcome!`);
      }
    }
    for (const t of this.nature.trees) {
      if (t.removed) continue;
      if (!t.alive && S.clock >= t.regrowAt) { t.alive = true; t.chops = 0; t.grow = 0.15; this.grid.set(t.cx, t.cz, TREE, false); this.nature.syncTree(t); }
      else if (t.alive && t.grow < 1) { t.grow = Math.min(1, t.grow + dt / 40); this.nature.syncTree(t); }
    }
    this.countryT = (this.countryT || 0) + dt;
    if (this.countryT > 0.2) { this.countryT = 0; this.country.update(); }
    this.raids.update(dt);
    const R = S.research.active;
    if (R) {
      R.progress += dt / R.time;
      if (R.progress >= 1) { S.research.done.push(R.id); S.research.active = null; this.toast(`Research complete: ${this.researchNode(R.id).node.name}!`); this.emit('research'); }
    }
    if (S.ramBuild && S.clock >= S.ramBuild.done) { S.rams = (S.rams || 0) + 1; S.ramBuild = null; this.toast('A battering ram is ready at the Siege Workshop'); this.emit('rams'); }
    // wounds heal slowly by themselves, four times faster with a Healer's House (resting inside: faster still)
    const healer = [...this.buildings.values()].some(b => b.def.heals && b.done);
    for (const v of this.villagers.values()) {
      if (v.hpf == null || v.away || (this.raids.alarmed && v.rhp != null)) continue;
      v.hpf += dt / (healer ? (v.resting ? 90 : 150) : 600);
      if (v.hpf >= 1) { v.hpf = null; v.resting = false; }
    }
    for (const v of this.villagers.values()) {
      if (v.away) { v.person.group.visible = false; continue; }
      if (v.reset) { v.reset = false; v.claim = null; v.path = null; v.act = 0; v.onDone = null; v.onArrive = null; v.site = null; v.building = null; v.hidden = false; if (v.onWall) { const c = this.grid.nearestWalkable(...this.grid.toCell(v.pos.x, v.pos.z), 3); if (c) { const p = this.grid.center(c[0], c[1]); v.pos.x = p.x; v.pos.z = p.z; } v.onWall = false; } if (!v.post) v.elev = 0; }
      if (!v.path && v.act <= 0) thinkVillager(this, v);
      updateVillager(this, v, dt);
    }
    for (const b of this.buildings.values()) {
      if (b.extra.koi) for (const k of b.extra.koi) { k.a += dt * k.s; k.mesh.position.set(Math.cos(k.a) * k.r, 0.13, Math.sin(k.a) * k.r * 0.8); k.mesh.rotation.y = -k.a; }
      if (b.extra.crop) { const ph = (S.clock / 140 + b.id * 0.37) % 1; b.extra.crop.scale.y = 0.35 + 0.65 * Math.min(1, ph * 1.4); }
    }
  }
  // Work on a construction site or upgrade (called while a builder hammers).
  buildTick(b, dt) {
    const mult = this.workMult();
    if (!b.done) {
      b.progress = Math.min(1, b.progress + dt * mult / Math.max(1, b.def.time));
      this.syncProgress(b);
      if (b.progress >= 1) this.completeConstruction(b);
    } else if (b.upg) {
      b.upg.progress = Math.min(1, b.upg.progress + dt * mult / Math.max(1, b.upg.time));
      if (b.upg.progress >= 1) this.finishUpgrade(b);
    } else if (b.hp < this.maxHp(b)) {
      b.hp = Math.min(this.maxHp(b), b.hp + dt * this.maxHp(b) / 40);
    }
  }
  needsWork(b) { return !b.done || !!b.upg || (b.def.hp && b.hp < this.maxHp(b) && !this.raids.active); }
  completeConstruction(b) {
    b.done = true; b.progress = 1; this.syncProgress(b);
    if (b.def.time > 12) this.toast(`${b.def.name} is finished!`);
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
      buildings: [...this.buildings.values()].map(b => ({ id: b.id, type: b.type, cx: b.cx, cz: b.cz, rot: b.rot, done: b.done, progress: +b.progress.toFixed(4), level: b.level, hp: Math.round(b.hp || 0), upg: b.upg, prio: b.prio ? 1 : 0 })).concat(this.keptBuildings || []),
      villagers: [...this.villagers.values()].map(v => ({ id: v.id, name: v.name, job: v.job, work: v.work, seed: v.seed, x: +v.pos.x.toFixed(2), z: +v.pos.z.toFixed(2), train: +(v.train || 0).toFixed(2), paid: !!v.paid, away: v.away || null, aid: v.aid ? 1 : 0, hpf: v.hpf != null ? +v.hpf.toFixed(3) : null })).concat(this.keptVillagers || []),
      rams: S.rams || 0, ramBuild: S.ramBuild || null,
      trees: this.nature.trees.filter(t => t.removed || !t.alive || t.chops).map(t => [t.cx, t.cz, t.alive ? 1 : 0, Math.round(t.regrowAt), t.removed ? 1 : 0, t.chops || 0]),
      rocks: this.nature.rocks.filter(r => r.removed).map(r => [r.cx, r.cz]),
      marks: [...this.clearMarks.values()].map(m => [m.kind, m.cx, m.cz]),
      raids: this.raids.serialize(),
      research: S.research,
      country: this.country.serialize(),
    };
  }
  load(s) {
    const S = this.state;
    for (const k of ['clock', 'time', 'day', 'nextId', 'arriveT', 'eatAcc']) if (typeof s[k] === 'number' && isFinite(s[k])) S[k] = s[k];
    for (const r in RES) S.res[r] = Math.max(0, +s.res?.[r] || 0);
    Object.assign(S.settings, s.settings || {}); Object.assign(S.stats, s.stats || {});
    delete S.settings.autoBuild;
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
    this.keptBuildings = []; this.keptVillagers = [];
    // the Keep first, so level requirements of everything else can be checked
    const list = [...(s.buildings || [])].sort((a, b) => (a.type === 'townhall' ? -1 : 0) - (b.type === 'townhall' ? -1 : 0));
    for (const b of list) {
      try {
        if (!BUILDINGS[b.type]) { this.keptBuildings.push(b); continue; }
        const lvl = clamp(b.level | 0 || 1, 1, BUILDINGS[b.type].maxLevel || 1);
        const nb = this.place(b.type, b.cx | 0, b.cz | 0, (b.rot | 0) % 4, { done: !!b.done, progress: clamp(+b.progress || 0, 0, 1), id: b.id, free: true, level: lvl, hp: b.hp || null });
        if (b.prio) nb.prio = true;
        if (b.upg && b.upg.level) { nb.upg = { level: b.upg.level, progress: clamp(+b.upg.progress || 0, 0, 1), time: +b.upg.time || 60, convert: !!b.upg.convert }; this.makeVisual(nb); }
      } catch (e) { console.warn('Skipped a building while loading', b, e); this.keptBuildings.push(b); }
    }
    for (let v of s.villagers || []) {
      try {
        if (v.job === 'builder') v = { ...v, job: 'idle', work: null }; // builders are no longer a job: free villagers build
        if (!JOBS[v.job]) { this.keptVillagers.push(v); continue; }
        const nv = this.spawnVillager({ id: v.id, name: v.name, job: v.job, work: v.work, seed: v.seed, x: v.x, z: v.z, train: v.train, paid: v.paid });
        if (v.away) { nv.away = v.away; nv.person.group.visible = false; }
        if (v.aid) nv.aid = true;
        if (typeof v.hpf === 'number' && v.hpf < 1) nv.hpf = Math.max(0.05, v.hpf);
      } catch (e) { console.warn('Skipped a villager while loading', v, e); this.keptVillagers.push(v); }
    }
    for (const [kind, cx, cz] of s.marks || []) this.mark(kind, cx, cz);
    if (s.research && Array.isArray(s.research.done)) S.research = { done: s.research.done.filter(id => this.researchNode(id)), active: s.research.active && this.researchNode(s.research.active.id) ? s.research.active : null };
    S.rams = +s.rams || 0; S.ramBuild = s.ramBuild || null;
    try { this.country.load(s.country); } catch (e) { console.warn('Country map could not be loaded', e); }
    this.raids.load(s.raids);
    for (const v of this.villagers.values()) { v.person.setLook(JOBS[v.job].look); v.person.group.traverse(o => { if (o.isMesh) o.userData.pick = { kind: 'villager', id: v.id }; }); }
    if (!this.keep) this.place('townhall', PLOT.n / 2 - 2, PLOT.n / 2 - 2, 0, { done: true, free: true });
    this.refreshWorkers();
    return this.offlineProgress((Date.now() - (s.savedAt || Date.now())) / 1000);
  }
  offlineProgress(sec) {
    sec = Math.min(sec, ECON.offlineCapHours * 3600);
    if (sec < 120) return null;
    const got = { wheat: 0, wood: 0, stone: 0, gold: 0 }, eff = ECON.offlineEfficiency * (1 + this.harmony() / 100);
    for (const v of this.villagers.values()) {
      const J = JOBS[v.job]; if (!J.res || v.away) continue;
      got[J.res] += sec * J.amount / (J.work / this.levelMult(this.buildings.get(v.work)) + 16) * eff;
    }
    got.wheat -= sec * this.pop / ECON.eatEvery;
    const out = {};
    for (const r in got) { const before = this.state.res[r]; this.state.res[r] = clamp(before + got[r], 0, this.storageCap()); out[r] = Math.round(this.state.res[r] - before); }
    // free villagers keep building
    let crew = [...this.villagers.values()].filter(v => !v.away && (v.job === 'idle' || v.aid)).length * sec * eff, built = 0;
    for (const b of this.buildings.values()) {
      if (crew <= 0) break;
      if (!b.done) { const need = (1 - b.progress) * b.def.time, use = Math.min(need, crew); crew -= use; b.progress += use / b.def.time; if (b.progress >= 0.999) { b.done = true; b.progress = 1; built++; } this.syncProgress(b); }
      else if (b.upg) { const need = (1 - b.upg.progress) * b.upg.time, use = Math.min(need, crew); crew -= use; b.upg.progress += use / b.upg.time; if (b.upg.progress >= 0.999) { this.finishUpgrade(b); built++; } }
    }
    let trained = 0;
    for (const v of this.villagers.values()) {
      if (!(v.job === 'trainee' || v.job === 'trainee_archer') || !v.paid) continue;
      const b = this.buildings.get(v.work); if (!b) continue;
      v.train += sec * eff;
      if (v.train >= b.def.trainTime) { this.setJob(v, b.def.trains); trained++; }
    }
    this.state.clock += sec; this.state.time = (this.state.time + sec / ECON.dayLength) % 1;
    for (const t of this.nature.trees) if (!t.alive && !t.removed && this.state.clock >= t.regrowAt) { t.alive = true; t.chops = 0; t.grow = 1; this.grid.set(t.cx, t.cz, TREE, false); this.nature.syncTree(t); }
    this.raids.postpone();
    this.emit('res');
    return { sec, res: out, built, trained };
  }
}
