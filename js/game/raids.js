// Raids on your village.
// Bandits come over the hills and creep in to loot; nobody knows until a soldier spots them.
// From Keep level 4 the clans send real armies: they march in from the hills in one to three groups,
// form up out of reach, then attack — a battering ram for the gate, shield-bearers hacking at the
// weakest stretch of wall while the rest wait for the breach, archers shooting your men off the walls
// (and fire arrows into the village). Once a gap opens, everyone storms in. Beaten badly, they run.
// While a raid lasts you can command your soldiers: select them and send them anywhere, onto the
// walls, out through the gate to kill the ram, or let them fight on their own.
import * as THREE from 'three';
import { RAIDS, JOBS, UNITS, RES, rankOf } from './data.js';
import { PLOT, heightAt } from '../render/nature.js';
import { Person } from '../render/people.js';
import { Mesher, MAT } from '../render/geo.js';
import { ramModel } from './battle.js';

const SIDES = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
const TURN = { north: 'east', east: 'south', south: 'west', west: 'north' };
const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };
const SOLDIER_HP = { ashigaru: 120, shieldman: 135, samurai: 280, archer: 70, berserker: 560, taisho: 380, ninja: 95, sohei: 210, cavalry: 230 };
const TOUGH = 1.75; // everyone lasts longer in a fight
const maxHp = v => (SOLDIER_HP[v.job] || 100) * TOUGH;
const EDGE = PLOT.half - 1.2;
const inPlot = (x, z) => Math.abs(x) < PLOT.half - 0.6 && Math.abs(z) < PLOT.half - 0.6;
const wallTopH = b => 2.95 * (1 + 0.14 * ((b.level || 1) - 1));
const BREAKABLE = b => b && b.def.hp && b.done;
const RANGED_JOBS = new Set(['archer']);

export class Raids {
  constructor(game) {
    this.game = game; this.next = null; this.active = false; this.bandits = []; this.arrows = []; this.groups = []; this.side = 'east';
    this.cmd = new Set();     // soldiers you have selected to command
    this.nextId = 1;
    const am = new Mesher(1, 0); am.box(0.05, 0.05, 1.0, '#3b2619', [0, 0, 0]); am.box(0.08, 0.08, 0.14, '#c9ced4', [0, 0, 0.55]);
    this.arrowGeo = am.geometry();
    const fm = new Mesher(2, 0); fm.box(0.05, 0.05, 1.0, '#3b2619', [0, 0, 0]); fm.box(0.16, 0.16, 0.22, '#ff8a2a', [0, 0, 0.55]);
    this.fireGeo = fm.geometry();
  }
  get clock() { return this.game.state.clock; }
  // bandits are in the village and someone has seen them (or an army announced itself): villagers hide, soldiers fight
  get alarmed() { return this.active && this.alarm; }
  schedule(first = false) {
    const [a, b] = first ? RAIDS.firstDelay : RAIDS.every;
    this.next = this.clock + a + this.game.rand() * (b - a);
  }
  postpone() { if (this.next != null && this.next < this.clock + 240) this.next = this.clock + 240; }
  serialize() { return { next: this.next, firstDone: !!this.firstDone, count: this.count || 0 }; }
  load(o) {
    this.firstDone = !!(o && o.firstDone); this.count = (o && +o.count) || 0;
    this.next = o && typeof o.next === 'number' ? o.next : null;
    if (!this.firstDone && !this.game.soldiers(true).length) this.next = null;
    this.postpone();
  }
  // the bigger your village, the bigger the band: about one raider for every 3–4 villagers
  popBand() { return Math.max(2, Math.round(this.game.pop / 3.5)); }
  // bands grow raid after raid (by up to 4), and never far beyond what your soldiers can face
  bandSize() {
    if (!this.firstDone) return 2;
    const soldiers = this.game.soldiers(true).length;
    return Math.max(2, Math.round(Math.min(this.popBand(), 2 + 4 * (this.count || 0), soldiers * 3 + 2) * this.game.diff.raid));
  }
  timeLeft() { return this.next == null ? Infinity : this.next - this.clock; }

  update(dt) {
    if (!this.active) {
      if (this.next == null) {
        if (!this.firstDone && !this.game.soldiers(true).length) return; // waiting for your first soldier
        this.schedule(!this.firstDone);
      }
      if (this.timeLeft() <= 0) this.start();
      return;
    }
    this.step(dt);
  }

  /* ================= the enemy arrives ================= */
  start() {
    const g = this.game, n = this.bandSize();
    const weak = !this.firstDone;
    const src = this.firstDone && g.thLevel >= 4 ? g.clans.raidSource() : null;
    this.source = src ? src.id : null; this.army = !!src;
    this.count = (this.count || 0) + 1;
    this.active = true; this.alarm = false; this.bandits = []; this.stolen = {}; this.killed = 0; this.victims = 0; this.fled = 0; this.fireT = this.clock + 20;
    this.cmd.clear(); this.outsideT = 0; this.outsideDirty = true;
    // one, two or three groups, from different sides
    const sides = Object.keys(SIDES); this.side = sides[Math.floor(g.rand() * 4)];
    const nG = !this.army ? (n > 15 ? 2 : 1) : n >= 20 ? 3 : n >= 9 ? 2 : 1;
    const gs = [this.side, g.rand() < 0.5 ? TURN[this.side] : OPPOSITE[this.side], TURN[TURN[TURN[this.side]]]].slice(0, nG);
    this.side2 = gs[1] || null;
    const walled = [...g.buildings.values()].some(b => BREAKABLE(b) && b.def.blocks || b.type === 'gate');
    this.groups = gs.map((side, i) => {
      const [sx, sz] = SIDES[side], along = (g.rand() - 0.5) * 40;
      const entry = { x: sx ? sx * EDGE : along, z: sz ? sz * EDGE : along };
      const muster = { x: entry.x + sx * 9, z: entry.z + sz * 9 };
      return { i, side, sx, sz, entry, muster, phase: 'march', members: [], n0: 0, t0: this.clock, target: null };
    });
    const kinds = i => !src ? (weak || (this.count <= 2 && i % 2) ? 'outlaw' : 'bandit') : ['enemy_ashigaru', 'enemy_shield', 'enemy_ashigaru', 'enemy_archer', 'enemy_shield', 'enemy_archer', 'enemy_ashigaru', 'enemy_samurai'][i % 8];
    for (let i = 0; i < n; i++) this.spawn(kinds(i), this.groups[i % nG]);
    if (this.army && this.count >= 2 && n >= 12) this.spawn('enemy_cavalry', this.groups[nG - 1]);
    // rams come with a real army when there is a gate or a wall to break
    if (this.army && walled) { this.spawn('enemy_ram', this.groups[0]); if (n >= 26 && nG > 1) this.spawn('enemy_ram', this.groups[1]); }
    for (const G of this.groups) G.n0 = G.members.length;
    for (const v of g.villagers.values()) if (JOBS[v.job].soldier) v.rhp = v.rhp || maxHp(v) * (v.hpf ?? 1);
    if (this.army) {
      const rams = this.bandits.filter(u => u.type === 'enemy_ram').length;
      this.raiseAlarm(null, `War drums in the hills! ${this.bandName(this.alive().length)} march on the village from ${this.fromText()}${rams ? ` with ${rams === 1 ? 'a battering ram' : rams + ' battering rams'}` : ''}. Prepare the defence!`);
    }
    g.emit('raidStart');
  }
  spawn(type, G) {
    const g = this.game, U = UNITS[type], far = (U.siege ? 30 : 45) + g.rand() * (U.siege ? 8 : 22), lat = (g.rand() - 0.5) * 16;
    const x = G.entry.x + G.sx * far + (G.sx ? 0 : lat), z = G.entry.z + G.sz * far + (G.sz ? 0 : lat);
    let obj, person = null;
    if (U.siege) { obj = ramModel(); obj.scale.setScalar(0.85); }
    else { person = new Person(U.look, 900 + this.bandits.length * 17 + Math.floor(this.clock)); obj = person.group; }
    obj.position.set(x, heightAt(x, z), z); g.scene.add(obj);
    const id = this.nextId++;
    obj.traverse(o => { if (o.isMesh) o.userData.pick = { kind: 'bandit', id }; });
    const hp = U.hp * TOUGH * (this.army ? g.diff.foe : 1);
    const u = { id, type, U, g: G, side: G.side, ranged: !!U.ranged && !U.siege, ram: !!U.siege, x, z, y: 0, hp, maxHp: hp, dmg: U.dmg * (this.army ? g.diff.foe : 1), speed: U.speed * (U.siege ? 1.05 : 0.8),
      obj, person, heading: Math.atan2(-G.sx, -G.sz), cd: g.rand(), path: null, pathI: 0, repath: 0, carry: null, state: 'march', slot: G.members.length };
    G.members.push(u); this.bandits.push(u);
    return u;
  }
  fromText() { const s = this.groups.map(G => G.side); return s.length === 1 ? `the ${s[0]}` : s.slice(0, -1).map(x => 'the ' + x).join(', ') + ' and the ' + s[s.length - 1]; }
  raiseAlarm(by, why) {
    const g = this.game;
    if (!this.active || this.alarm) return;
    this.alarm = true; g.sfx(this.army ? 'horn' : 'bell');
    const n = this.alive().length, band = this.bandName(n);
    g.toast(why || (by ? `${by.name} spotted ${band} sneaking in from ${this.fromText()}! Villagers run for cover.` : `You raise the alarm: ${band} from ${this.fromText()}! Your soldiers move in, villagers run for cover.`), 'bad');
    for (const v of g.villagers.values()) { v.reset = true; if (v.onWall) { v.path = null; v.onArrive = null; const w = this.wallUnder(v); v.wallB = w ? w.id : null; if (!w) { v.onWall = false; v.elev = 0; } } }
    g.emit('raid');
  }
  // "3 bandits" or "5 soldiers of the Uesugi"
  bandName(n) { const g = this.game, s = this.source && g.country.site(this.source), k = s && g.clans.owner(s); return s ? `${n} soldier${n === 1 ? '' : 's'} of ${k ? 'the ' + g.clans.name(k) : s.name + ' Castle'}` : `${n} bandit${n === 1 ? '' : 's'}`; }
  alive() { return this.bandits.filter(b => !b.dead && !b.gone); }
  byId(id) { return this.bandits.find(u => u.id === id); }
  centroid() { const a = this.alive(); if (!a.length) return null; return { x: a.reduce((s, u) => s + u.x, 0) / a.length, z: a.reduce((s, u) => s + u.z, 0) / a.length }; }

  /* ================= the lie of the land ================= */
  // every cell the enemy can reach from the edge of your land without breaking anything (gates are shut to them)
  computeOutside() {
    const G = this.game.grid, n = G.n, out = new Uint8Array(n * n), q = [];
    // the raiders' own map: they push through woods and past boulders (slowly), but gates are shut to them
    const RG = this.rg = Object.create(G); RG.pass = G.pass.slice(); RG.speed = G.speed.slice();
    for (let i = 0; i < n * n; i++) if (G.occ[i] < 0) { RG.pass[i] = 1; RG.speed[i] = 0.55; }
    for (const b of this.game.buildings.values()) if (b.type === 'gate' || b.type === 'torii') for (let z = b.cz; z < b.cz + b.d; z++) for (let x = b.cx; x < b.cx + b.w; x++) RG.pass[G.idx(x, z)] = 0;
    const ok = i => RG.pass[i];
    for (let k = 0; k < n; k++) for (const [x, z] of [[k, 0], [k, n - 1], [0, k], [n - 1, k]]) { const i = G.idx(x, z); if (!out[i] && ok(i)) { out[i] = 1; q.push(i); } }
    while (q.length) {
      const i = q.pop(), x = i % n, z = (i / n) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue; const j = G.idx(nx, nz); if (!out[j] && ok(j)) { out[j] = 1; q.push(j); } }
    }
    this.outside = out; this.outsideDirty = false; this.outsideT = this.clock + 3;
  }
  isOutside(x, z) { if (!inPlot(x, z)) return true; const G = this.game.grid, [cx, cz] = G.toCell(x, z); return !!this.outside[G.idx(cx, cz)]; }
  isInside(x, z) { if (!inPlot(x, z)) return false; const G = this.game.grid, [cx, cz] = G.toCell(x, z), i = G.idx(cx, cz); return G.walkable(cx, cz) && !this.outside[i]; }
  // can the enemy walk into the village (to a storehouse) without breaking anything?
  villageOpen() { if (this.openT === this.clock) return this.openV; this.openT = this.clock; return (this.openV = this.villageOpen0()); }
  villageOpen0() { return this.storage().some(b => { const d = this.game.door(b, 1); return this.isOutside(d.x, d.z); }); }
  // the cells right next to a building, on the enemy's side (outside) or on yours (inside)
  besideCells(b, outside) {
    const G = this.game.grid, out = [];
    for (let z = b.cz - 1; z <= b.cz + b.d; z++) for (let x = b.cx - 1; x <= b.cx + b.w; x++) {
      if (x >= b.cx && x < b.cx + b.w && z >= b.cz && z < b.cz + b.d) continue;
      if ((x < b.cx || x >= b.cx + b.w) && (z < b.cz || z >= b.cz + b.d)) continue;   // no corners
      const i = G.idx(x, z);
      if (outside ? !this.rg.pass[i] : !G.walkable(x, z)) continue;
      if (!!this.outside[i] !== outside) continue;
      out.push(G.center(x, z));
    }
    return out;
  }

  // bandit-style paths: gates are shut, torii too
  banditPath(from, to, partial = false) {
    if (!this.rg) this.computeOutside();
    const p = this.rg.findPath(from, to, partial);
    if (partial) return p;
    const end = p && p[p.length - 1];
    return end && Math.hypot(end.x - to.x, end.z - to.z) < 3 ? p : null;
  }
  // the wall, gate or palisade standing between a raider and its goal
  blocker(u, to) {
    const g = this.game, dx = to.x - u.x, dz = to.z - u.z, d = Math.hypot(dx, dz);
    for (let t = 0; t < d; t += 0.8) {
      const [cx, cz] = g.grid.toCell(u.x + dx * t / d, u.z + dz * t / d), o = g.grid.get(cx, cz), b = o > 0 && g.buildings.get(o);
      if (BREAKABLE(b) && this.besideCells(b, true).length) return b;
    }
    return this.bestBreach(u, false);
  }
  // where to break in: the gate for a ram, otherwise the weakest piece of wall facing them (palisades before stone)
  bestBreach(from, ram, taken = null) {
    const g = this.game; let best = null, bs = Infinity;
    for (const b of g.buildings.values()) {
      if (!BREAKABLE(b) || !this.besideCells(b, true).length) continue;
      if (ram && b.type !== 'gate' && [...g.buildings.values()].some(o => o.type === 'gate' && BREAKABLE(o) && this.besideCells(o, true).length)) continue;
      const c = g.center(b), d = Math.hypot(c.x - from.x, c.z - from.z);
      const s = d * 1.2 + b.hp / 30 + (b.type === 'gate' && !ram ? (this.bandits.some(u => u.ram && !u.dead && !u.gone) ? 90 : 25) : 0) + (this.besideCells(b, false).length ? 0 : 60) + (taken && taken.has(b.id) ? 60 : 0);
      if (s < bs) { bs = s; best = b; }
    }
    return best;
  }
  storage() { return [...this.game.buildings.values()].filter(b => b.done && b.def.dropoff === 'all'); }

  /* ================= every tick ================= */
  step(dt) {
    const g = this.game;
    if (this.outsideDirty || this.clock > this.outsideT || !this.outside) this.computeOutside();
    this.planT = (this.planT || 0) - dt;
    if (this.planT <= 0) { this.planT = 0.5; for (const G of this.groups) this.planGroup(G); }
    const soldiers = g.soldiers().filter(v => !v.away);
    for (const u of this.bandits) this.stepRaider(u, dt, soldiers);
    // before the alarm your soldiers go about their rounds — until one of them sees a bandit
    if (!this.alarm) {
      const eyes = 1 + 0.5 * g.rb('earlyWarn');
      for (const v of soldiers) {
        if (v.hidden) continue;
        const sight = (v.post || v.onWall ? 26 : RAIDS.sight) * eyes;
        if (this.alive().some(u => inPlot(u.x, u.z) && Math.hypot(u.x - v.pos.x, u.z - v.pos.z) < sight)) { this.raiseAlarm(v); break; }
      }
    } else this.defend(dt, soldiers);
    this.updateArrows(dt);
    this.drawOverlays();
    if (!this.alive().length) this.end();
  }

  /* ---------- an army group decides what to do ---------- */
  planGroup(G) {
    const g = this.game, live = G.members.filter(u => !u.dead && !u.gone);
    if (!live.length) return;
    if (G.phase === 'march') {
      // gather out of reach before attacking
      const there = live.filter(u => u.state === 'form').length, ramThere = live.every(u => !u.ram || u.state === 'form');
      if ((there >= live.length * 0.85 && ramThere) || this.clock - G.t0 > 75) { G.phase = 'form'; G.formT = this.clock + (this.army ? 7 : 1); }
      return;
    }
    if (G.phase === 'form') {
      if (this.clock < G.formT) return;
      G.phase = 'assault'; for (const u of live) if (u.state === 'form' || u.state === 'march') u.state = 'enter';
      if (this.army && !this.announced) { this.announced = true; g.sfx('horn'); g.toast(`The ${this.source ? 'enemy' : 'bandits'} attack${this.groups.length > 1 ? ' from ' + this.groups.length + ' sides' : ''}!`, 'bad'); }
      return;
    }
    if (G.phase === 'flee') return;
    // morale: a group cut down to a third breaks and runs (not those carrying loot — they run anyway)
    const fighting = live.filter(u => !u.ram);
    if (this.army && G.n0 >= 4 && fighting.length <= Math.ceil(G.n0 * 0.33)) { this.flee(G, 'break and run'); return; }
    if (!this.army && G.n0 >= 4 && fighting.length <= Math.ceil(G.n0 * 0.25) && this.alarm) { this.flee(G, 'run for the hills'); return; }
    if (G.phase === 'storm' || !this.army) return;
    if (this.villageOpen()) { G.phase = 'storm'; G.target = null; for (const u of live) if (!u.carry && u.state !== 'flee') { u.state = 'approach'; u.path = null; u.repath = 0; } return; }
    // choose what to break
    const ram = live.find(u => u.ram);
    if (!G.target || !g.buildings.has(G.target.id) || !this.besideCells(G.target, true).length) G.target = this.bestBreach(ram || G.entry, !!ram, new Set(this.groups.filter(o => o !== G && o.target).map(o => o.target.id)));
    if (!G.target) { G.phase = 'storm'; return; }
    // assign roles: the ram and up to 4 sappers break it (bandits: 3), archers stand off, the rest wait for the breach
    const sapN = ram ? (this.army ? 2 : 3) : this.army ? 4 : 3;
    let sappers = 0;
    for (const u of live) {
      if (u.carry || u.state === 'flee' || u.state === 'enter') continue;
      if (u.ram) { u.role = 'ram'; continue; }
      if (u.ranged) { u.role = 'archer'; continue; }
      if (u.role === 'sapper' && u.breach === G.target && sappers < sapN) { sappers++; continue; }
      u.role = 'wait';
    }
    for (const u of live.filter(u => u.role === 'wait' && !u.carry && u.type !== 'enemy_samurai').sort((a, b) => (b.type === 'enemy_shield') - (a.type === 'enemy_shield'))) { if (sappers >= sapN) break; u.role = 'sapper'; sappers++; }
    for (const u of live) if (u.breach !== G.target) { u.breach = G.target; u.path = null; u.repath = 0; }
  }
  flee(G, what) {
    if (G.phase === 'flee') return;
    G.phase = 'flee';
    for (const u of G.members) if (!u.dead && !u.gone) { u.state = 'flee'; u.path = null; u.repath = 0; }
    this.game.toast(`${this.army ? 'The enemy' : 'The bandits'} from the ${G.side} ${what}!`);
  }

  /* ---------- one raider ---------- */
  stepRaider(u, dt, soldiers) {
    const g = this.game;
    if (u.dead) { u.deadT += dt; if (u.person) u.obj.rotation.x = -Math.min(Math.PI / 2, u.deadT * 4); else u.obj.scale.y = Math.max(0.25, 0.85 - u.deadT * 0.3); if (u.deadT > 6) u.obj.visible = false; return; }
    if (u.gone) return;
    u.cd -= dt; u.repath -= dt;
    let pose = 'walk';
    const G = u.g;
    // outside your land: walk over the hills in a straight line
    if ((u.state === 'march' || u.state === 'form') && G.phase !== 'march' && G.phase !== 'form') { u.state = 'enter'; u.path = null; }
    if (u.state === 'march' || u.state === 'form') {
      const [sx, sz] = [G.sx, G.sz], k = u.slot, spot = { x: G.muster.x + (sx ? sx * (k % 3) * 1.4 : ((k % 7) - 3) * 1.6), z: G.muster.z + (sz ? sz * (k % 3) * 1.4 : ((k % 7) - 3) * 1.6) };
      if (sx) spot.z += ((Math.floor(k / 3) % 7) - 3) * 1.6; else spot.x += ((Math.floor(k / 3) % 7) - 3) * 1.6;
      if (this.walk(u, spot, dt, u.speed)) { u.state = 'form'; pose = 'guard'; this.face(u, -sx, -sz, dt); }
      return this.pose(u, pose, dt);
    }
    if (u.state === 'flee') {
      const [sx, sz] = SIDES[u.side], out = { x: sx ? sx * (EDGE + 60) : u.x, z: sz ? sz * (EDGE + 60) : u.z };
      if (inPlot(u.x, u.z)) {
        if (u.repath <= 0) { u.repath = 2; const exit = { x: sx ? sx * (EDGE - 0.5) : u.x, z: sz ? sz * (EDGE - 0.5) : u.z }; u.path = this.banditPath(u, exit, true) || g.grid.findPath(u, exit, true); u.pathI = 0; }
        if (!this.follow(u, dt, u.speed * 1.25)) this.walk(u, out, dt, u.speed * 1.25);
      } else if (this.walk(u, out, dt, u.speed * 1.25)) { u.gone = true; u.obj.visible = false; this.fled++; }
      return this.pose(u, 'walk', dt);
    }
    if (u.state === 'enter') {
      // over the edge of your land
      const e = { x: G.entry.x + (G.sx ? 0 : ((u.slot % 7) - 3) * 1.4), z: G.entry.z + (G.sz ? 0 : ((u.slot % 7) - 3) * 1.4) };
      this.walk(u, e, dt, u.speed);
      if (inPlot(u.x, u.z)) { u.state = this.army && G.phase === 'assault' ? 'assault' : 'approach'; u.path = null; u.repath = 0; }
      return this.pose(u, 'walk', dt);
    }
    // fight a soldier on the ground who comes close
    if (!u.ram) {
      let foe = null, fd = 2.1;
      for (const v of soldiers) { if ((v.elev || 0) > 1 || v.hidden) continue; const d = Math.hypot(v.pos.x - u.x, v.pos.z - u.z); if (d < fd) { fd = d; foe = v; } }
      if (foe) {
        this.raiseAlarm(foe);
        this.face(u, foe.pos.x - u.x, foe.pos.z - u.z, dt);
        if (u.cd <= 0) { u.cd = u.U.cd || 1; this.hurtSoldier(foe, u.dmg * (u.charge > 6 ? u.U.charge || 1 : 1)); u.charge = 0; }
        return this.pose(u, 'chop', dt);
      }
    }
    // archers: shoot at soldiers on the walls and towers first, then anyone in the open; fire arrows at houses
    if (u.ranged && !u.carry) {
      let shot = null, bd = 17;
      for (const v of g.villagers.values()) {
        if (v.hidden || v.away) continue;
        const d = Math.hypot(v.pos.x - u.x, v.pos.z - u.z) - ((v.elev || 0) > 1 ? 4 : 0) - (JOBS[v.job].soldier ? 1 : 0);
        if (d < bd) { bd = d; shot = v; }
      }
      if (shot && (this.alarm || bd < 11)) {
        this.face(u, shot.pos.x - u.x, shot.pos.z - u.z, dt);
        if (u.cd <= 0) { u.cd = 1.8; this.enemyShoot(u, shot, u.dmg); if (!this.alarm) this.raiseAlarm(null, `Arrows! ${this.bandName(this.alive().length)} are attacking the village!`); }
        return this.pose(u, 'shoot', dt);
      }
      if (this.army && this.alarm && this.clock > this.fireT && u.role === 'archer') {
        const b = [...g.buildings.values()].find(b => b.done && !b.fire && !b.def.hp && !b.def.line && b.type !== 'townhall' && b.type !== 'tower' && Math.hypot(g.center(b).x - u.x, g.center(b).z - u.z) < 17);
        if (b) { this.fireT = this.clock + 25; this.face(u, g.center(b).x - u.x, g.center(b).z - u.z, dt); this.fireArrow(u, b); return this.pose(u, 'shoot', dt); }
      }
    }
    // villagers caught outside are attacked
    if (!u.carry && !u.ram && (u.state === 'approach' || u.role !== 'sapper')) {
      if (!u.preyT || u.preyT <= 0 || (u.preyV && (u.preyV.hidden || !g.villagers.has(u.preyV.id)))) {
        u.preyT = 0.35 + g.rand() * 0.2; let best = null, bd = 9;
        for (const v of g.villagers.values()) { if (JOBS[v.job].soldier || v.hidden || v.away || v.elev > 1) continue; const d = Math.hypot(v.pos.x - u.x, v.pos.z - u.z); if (d < bd) { bd = d; best = v; } }
        u.preyV = best;
      }
      u.preyT -= dt;
      const prey = u.preyV && g.villagers.has(u.preyV.id) ? u.preyV : null, pd = prey ? Math.hypot(prey.pos.x - u.x, prey.pos.z - u.z) : Infinity;
      if (prey && pd < 1.6) {
        this.face(u, prey.pos.x - u.x, prey.pos.z - u.z, dt);
        if (u.cd <= 0) { u.cd = 1.2; this.hurtVillager(prey, u.dmg); }
        return this.pose(u, 'chop', dt);
      }
      if (prey && pd < 9 && (u.state === 'approach' || this.isOutside(prey.pos.x, prey.pos.z))) {
        if (u.repath <= 0 || u.prey !== prey.id) { u.prey = prey.id; u.repath = 1; const pth = this.banditPath(u, prey.pos); if (pth) { u.path = pth; u.pathI = 0; } }
        if (this.follow(u, dt, u.speed * 1.2)) return this.pose(u, 'walk', dt);
      } else u.prey = null;
    }
    // an army's assault: break in where the group decided
    if (u.state === 'assault') {
      const T = u.breach;
      if (!T || !g.buildings.has(T.id)) { u.path = null; return this.pose(u, 'guard', dt); }
      if (u.role === 'sapper' || u.role === 'ram') return this.sap(u, T, dt);
      // archers stand off 12–15 paces out; the rest wait 6–8 paces back in a loose line, shields to the front
      const c = g.center(T), dx = G.muster.x - c.x, dz = G.muster.z - c.z, d = Math.hypot(dx, dz) || 1, lx = -dz / d, lz = dx / d;
      const back = u.role === 'archer' ? 12 + (u.slot % 3) : 6 + (u.slot % 2) * 1.6, side = ((u.slot % 7) - 3) * 1.5;
      const spot = { x: c.x + dx / d * back + lx * side, z: c.z + dz / d * back + lz * side };
      if (Math.hypot(spot.x - u.x, spot.z - u.z) < 1) { this.face(u, c.x - u.x, c.z - u.z, dt); return this.pose(u, 'guard', dt); }
      if (u.repath <= 0) { u.repath = 2.5; u.path = inPlot(spot.x, spot.z) ? this.banditPath(u, spot, true) : null; u.pathI = 0; }
      if (!this.follow(u, dt, u.speed)) { if (!inPlot(spot.x, spot.z)) this.walk(u, spot, dt, u.speed); else { this.face(u, c.x - u.x, c.z - u.z, dt); return this.pose(u, 'guard', dt); } }
      return this.pose(u, 'walk', dt);
    }
    if (u.state === 'breach') {
      if (u.wall && g.buildings.has(u.wall.id)) return this.sap(u, u.wall, dt);
      u.state = 'approach'; u.path = null;
    }
    // head for the loot (or away with it)
    if (u.repath <= 0) {
      u.repath = 3;
      let goal;
      if (u.carry) { const [sx, sz] = SIDES[u.side]; goal = { x: sx ? sx * (PLOT.half - 1) : u.x, z: sz ? sz * (PLOT.half - 1) : u.z }; }
      else { const st = this.storage().sort((a, b) => Math.hypot(g.center(a).x - u.x, g.center(a).z - u.z) - Math.hypot(g.center(b).x - u.x, g.center(b).z - u.z))[0]; if (!st) { u.state = 'flee'; return; } u.goalB = st; goal = g.door(st, 1); }
      const p = this.banditPath(u, goal);
      if (p) { u.path = p; u.pathI = 0; }
      else if (!u.carry) {
        // no way in: a few break through, the others wait close behind them
        const w = this.blocker(u, goal);
        if (w) {
          const on = this.bandits.filter(o => !o.dead && !o.gone && o.state === 'breach' && o.wall === w).length;
          if (on < (u.ram ? 9 : 3) || u.ram) { u.state = 'breach'; u.wall = w; u.path = null; }
          else { const c = g.center(w), s = this.besideCells(w, true)[0]; if (s) { const dx = s.x - c.x, dz = s.z - c.z, d = Math.hypot(dx, dz) || 1; u.path = this.banditPath(u, { x: s.x + dx / d * 5 + (u.slot % 3 - 1) * 1.5, z: s.z + dz / d * 5 }, true); u.pathI = 0; } }
        }
      } else { u.path = this.banditPath(u, goal, true); u.pathI = 0; }
    }
    if (!this.follow(u, dt, u.speed * (this.alarm ? 1.2 : 1) * (u.carry ? 0.85 : 1))) {
      if (u.carry && Math.max(Math.abs(u.x), Math.abs(u.z)) > PLOT.half - 2.5) { u.state = 'flee'; }
      else if (u.goalB && !u.carry && Math.hypot(g.door(u.goalB, 1).x - u.x, g.door(u.goalB, 1).z - u.z) < 2.5) this.arrive(u);
      pose = 'guard';
    }
    this.pose(u, pose, dt);
  }
  // hack at (or ram) a wall, palisade or gate
  sap(u, T, dt) {
    const g = this.game, c = g.center(T), reach = Math.max(T.w, T.d) + (u.ram ? 2.4 : 1.8);
    if (Math.hypot(c.x - u.x, c.z - u.z) < reach) {
      // murder holes: stones from nearby towers
      if (g.rb('murder') && [...g.buildings.values()].some(t => t.type === 'tower' && t.done && Math.hypot(g.center(t).x - u.x, g.center(t).z - u.z) < 12)) this.hurtBandit(u, 6 * dt);
      this.face(u, c.x - u.x, c.z - u.z, dt);
      if (u.cd <= 0) {
        u.cd = u.ram ? 2.2 : 1.1; T.hp -= u.dmg * (u.ram ? 1 : T.type === 'gate' ? 0.5 : 1); T.hitT = 0.4;
        g.sfx(u.ram ? 'boom' : 'clash'); if (u.ram) u.bump = 0.5;
        if (T.hp <= 0) this.breakThrough(T);
      }
      return this.pose(u, u.ram ? 'guard' : 'chop', dt);
    }
    if (u.repath <= 0) {
      u.repath = 2;
      const spots = this.besideCells(T, true).sort((a, b) => Math.hypot(a.x - u.x, a.z - u.z) - Math.hypot(b.x - u.x, b.z - u.z));
      const s = spots[u.slot % Math.max(1, Math.min(spots.length, 3))] || spots[0];
      u.path = s ? this.banditPath(u, s, true) : null; u.pathI = 0;
      if (!u.path && !inPlot(u.x, u.z) && s) { this.walk(u, s, dt, u.speed); return this.pose(u, 'walk', dt); }
    }
    if (!this.follow(u, dt, u.speed)) { if (!inPlot(u.x, u.z)) this.walk(u, c, dt, u.speed); else { this.face(u, c.x - u.x, c.z - u.z, dt); return this.pose(u, 'guard', dt); } }
    return this.pose(u, 'walk', dt);
  }
  breakThrough(T) {
    const g = this.game, name = T.def.name;
    g.toast(T.type === 'gate' ? `The ${this.army ? 'enemy' : 'bandits'} broke down your ${name}!` : `The ${this.army ? 'enemy' : 'bandits'} broke through your ${name}!`, 'bad');
    g.demolish(T.id, { destroyed: true }); g.sfx('boom');
    this.computeOutside();
    for (const o of this.bandits) if (o.wall === T || o.breach === T) { o.path = null; o.repath = 0; if (o.state === 'breach') o.state = 'approach'; }
    for (const G of this.groups) if (G.target === T) G.target = null;
    this.planT = 0;
    // soldiers standing on it fall
    for (const v of g.villagers.values()) if (v.onWall && v.wallB === T.id) this.dropFromWall(v, 0.3);
  }
  // straight-line walking (over the hills, and as a fallback); returns true once there
  walk(u, to, dt, sp) {
    const dx = to.x - u.x, dz = to.z - u.z, d = Math.hypot(dx, dz);
    if (d < 0.35) return true;
    const s = Math.min(d, sp * dt);
    let nx = u.x + dx / d * s, nz = u.z + dz / d * s;
    // don't walk through walls and houses inside your land (trees and boulders at the edge don't stop them)
    if (inPlot(nx, nz)) { const G = this.game.grid, [cx, cz] = G.toCell(nx, nz); if (!G.walkable(cx, cz) && G.get(cx, cz) > 0) return false; }
    u.x = nx; u.z = nz; u.charge = (u.charge || 0) + s; this.face(u, dx, dz, dt);
    return false;
  }
  // follow the current path; false when there's none (or it's done)
  follow(u, dt, sp) {
    if (!u.path) return false;
    const t = u.path[u.pathI];
    if (!t) { u.path = null; u.repath = Math.min(u.repath, 1); return false; }
    const dx = t.x - u.x, dz = t.z - u.z, d = Math.hypot(dx, dz);
    if (d < 0.3) { u.pathI++; if (u.pathI >= u.path.length) { u.path = null; u.repath = Math.min(u.repath, 1); return false; } return true; }
    const s = Math.min(d, sp * this.slow(u) * dt); u.x += dx / d * s; u.z += dz / d * s; u.charge = (u.charge || 0) + s; this.face(u, dx, dz, dt);
    return true;
  }

  /* ================= your soldiers ================= */
  // orders: null (fight on their own), { kind: 'move', x, z }, { kind: 'attack', id }, { kind: 'wall', b }, { kind: 'charge' }
  command(kind, data = {}) {
    const g = this.game, list = [...this.cmd].map(id => g.villagers.get(id)).filter(v => v && !v.away);
    if (!list.length) return false;
    list.forEach((v, i) => {
      v.order = kind === 'auto' ? null : { kind, ...data, i, n: list.length };
      v.orderT = 0; if (kind !== 'wall' && v.onWall) this.dropFromWall(v, 0);
      if (v.post && kind !== 'auto') { const b = g.buildings.get(v.post.b); v.post = null; v.elev = 0; if (b) { const d = g.door(b, 0.8); v.pos.x = d.x; v.pos.z = d.z; } }
      if (kind !== 'wall') v.wallB = null;
      v.path = null; v.onArrive = null; v.act = 0;
    });
    g.sfx('clash');
    return true;
  }
  selectSoldiers(list, add = false) {
    if (!add) this.cmd.clear();
    for (const v of list) if (v && !v.away && JOBS[v.job].soldier) this.cmd.add(v.id);
    this.game.emit('raidCmd');
  }
  wallUnder(v) { const G = this.game.grid, [cx, cz] = G.toCell(v.pos.x, v.pos.z), o = G.get(cx, cz), b = o > 0 && this.game.buildings.get(o); return b && b.type === 'wall' ? b : null; }
  dropFromWall(v, hurt) {
    const g = this.game, b = g.buildings.get(v.wallB) || this.wallUnder(v);
    v.onWall = false; v.elev = 0; v.wallB = null; v.path = null; v.onArrive = null;
    const G = g.grid, [cx, cz] = G.toCell(v.pos.x, v.pos.z);
    let best = null, bd = Infinity;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const x = cx + dx, z = cz + dz; if (!G.walkable(x, z)) continue; const inside = this.outside ? !this.outside[G.idx(x, z)] : true; const d = Math.abs(dx) + Math.abs(dz) + (inside ? 0 : 5); if (d < bd) { bd = d; best = [x, z]; } }
    if (best) { const c = G.center(best[0], best[1]); v.pos.x = c.x; v.pos.z = c.z; }
    if (hurt && v.rhp != null) this.hurtSoldier(v, maxHp(v) * hurt);
    void b;
  }
  // climb onto a wall-walk piece (stone walls, upgraded)
  mountWall(v, b) {
    const g = this.game, inner = this.besideCells(b, false).sort((a, c) => Math.hypot(a.x - v.pos.x, a.z - v.pos.z) - Math.hypot(c.x - v.pos.x, c.z - v.pos.z))[0];
    const foot = inner || (() => { const c = g.grid.nearestWalkable(b.cx, b.cz, 3); return c && g.grid.center(c[0], c[1]); })();
    if (!foot) return false;
    if (Math.hypot(foot.x - v.pos.x, foot.z - v.pos.z) < 1.2) {
      const c = g.center(b); v.pos.x = c.x; v.pos.z = c.z; v.elev = wallTopH(b); v.onWall = true; v.wallB = b.id; v.path = null; v.status = 'Defending the wall';
      return true;
    }
    if (!v.path) { v.path = g.grid.findPath(v.pos, foot, true); v.pathI = 0; v.onArrive = null; v.act = 0; v.status = 'Climbing onto the wall'; }
    return false;
  }
  // free wall-walk pieces near a point (one soldier per piece)
  wallSpots(p, max = 16) {
    const g = this.game;
    if (this.wallT !== this.clock) { this.wallT = this.clock; this.wallList = [...g.buildings.values()].filter(b => b.type === 'wall' && b.done && b.level >= 2 && this.besideCells(b, false).length); }
    const taken = new Set([...g.villagers.values()].filter(v => v.wallB || (v.order && v.order.kind === 'wall')).map(v => v.wallB || v.order.b));
    return this.wallList.filter(b => !taken.has(b.id) && Math.hypot(g.center(b).x - p.x, g.center(b).z - p.z) < max)
      .sort((a, b) => Math.hypot(g.center(a).x - p.x, g.center(a).z - p.z) - Math.hypot(g.center(b).x - p.x, g.center(b).z - p.z));
  }
  // where the enemy is trying to break in (the nearest one to p)
  threatPoint(p) {
    const g = this.game; let best = null, bd = Infinity;
    if (this.threatT !== this.clock) { this.threatT = this.clock; this.breachers = this.alive().filter(u => u.state === 'breach' && u.wall && g.buildings.has(u.wall.id)).map(u => u.wall); }
    const weigh = (T, n) => { const c = g.center(T), d = Math.hypot(c.x - p.x, c.z - p.z) / (1 + n + (T.hp < g.maxHp(T) ? 8 : 0)); if (d < bd) { bd = d; best = T; } };
    for (const G of this.groups) { const T = G.target; if (!T || !g.buildings.has(T.id) || G.phase === 'flee' || G.phase === 'storm') continue; weigh(T, G.members.filter(u => !u.dead && !u.gone && u.breach === T).length); }
    for (const w of this.breachers) weigh(w, this.breachers.filter(o => o === w).length);
    return best;
  }
  defend(dt, soldiers) {
    const g = this.game, foes = this.alive().filter(u => inPlot(u.x, u.z) || Math.max(Math.abs(u.x), Math.abs(u.z)) < PLOT.half + 22);
    for (const v of soldiers) {
      v.rcd = (v.rcd || 0) - dt;
      if (v.onWall && !g.buildings.has(v.wallB)) this.dropFromWall(v, 0.2);
      const ranged = RANGED_JOBS.has(v.job), tower = v.post && g.buildings.get(v.post.b), high = tower || v.onWall;
      const range = ranged ? (tower ? 22 + 4 * (tower.level - 1) + 4 * g.rb('archEyes') : v.onWall ? 19 : 16) * (1 + g.rb('archRange')) : v.onWall ? 3.8 : 2.0;
      // strike whatever is in reach
      let O = v.order;
      const want = O && O.kind === 'attack' ? this.byId(O.id) : null;
      if (O && O.kind === 'attack' && (!want || want.dead || want.gone)) { v.order = O = null; }
      let t = null, td = range;
      if (want && !want.dead && Math.hypot(want.x - v.pos.x, want.z - v.pos.z) <= range) t = want;
      else { const men = foes.some(o => !o.ram); for (const u of foes) { if (ranged && u.ram && men) continue; const d = Math.hypot(u.x - v.pos.x, u.z - v.pos.z); if (d <= td) { td = d; t = u; } } }
      if (t) {
        {
          v.heading = Math.atan2(t.x - v.pos.x, t.z - v.pos.z); if (!high) { v.path = null; } v.act = 0.5; v.pose = ranged ? 'shoot' : 'chop';
          if (v.rcd <= 0) {
            v.rcd = ranged ? 1.5 / (1 + g.rb('archFast')) : (UNITS[v.job]?.cd || 1) / (1 + (v.job === 'ashigaru' ? g.rb('spearFast') : 0));
            const base = ranged ? UNITS.archer.dmg * (tower ? 1.3 : v.onWall ? 1.2 : 1) * (1 + g.rb('archDmg')) : v.job === 'ashigaru' ? UNITS.ashigaru.dmg * (1 + g.rb('spearDmg')) : (UNITS[v.job] || UNITS.ashigaru).dmg;
            const dmg = base * (1 + g.life.forgeBonus()) * (1 + 0.1 * rankOf(v)) * (v.onWall && !ranged ? 1.25 : 1);
            if (ranged) this.shoot(v, t, dmg); else this.hurtBandit(t, t.ram ? dmg * 1.4 : dmg, v);
          }
          continue;
        }
      }
      if (tower) continue;                                   // archers on towers stay up there
      // move according to orders (or on their own)
      if ((v.orderT || 0) > this.clock) continue;
      v.orderT = this.clock + 0.9 + (v.id % 7) * 0.05;
      if (O && O.kind === 'wall') {
        if (!v.wallB) { const w = this.wallSpots(O.at || v.pos, 30)[0]; if (!w) { v.order = null; continue; } v.wallB = w.id; }
        const b = g.buildings.get(v.wallB);
        if (!b) { v.wallB = null; continue; }
        if (!v.onWall) this.mountWall(v, b);
        continue;
      }
      if (v.onWall) { if (!O) continue; this.dropFromWall(v, 0); }
      if (O && O.kind === 'move') {
        // hold the spot; step out to meet raiders who come within 6
        const k = O.i, cols = Math.ceil(Math.sqrt(O.n)), spot = { x: O.x + ((k % cols) - (cols - 1) / 2) * 1.6, z: O.z + (Math.floor(k / cols) - (Math.ceil(O.n / cols) - 1) / 2) * 1.6 };
        const near = !ranged && foes.filter(u => Math.hypot(u.x - spot.x, u.z - spot.z) < 6).sort((a, b) => Math.hypot(a.x - v.pos.x, a.z - v.pos.z) - Math.hypot(b.x - v.pos.x, b.z - v.pos.z))[0];
        const to = near ? { x: near.x, z: near.z } : spot;
        if (Math.hypot(to.x - v.pos.x, to.z - v.pos.z) > 0.8) this.goTo(v, to, near ? 'Fighting' : 'Holding the position you gave');
        else { v.path = null; v.act = 0.6; v.pose = 'guard'; v.status = 'Holding the position you gave'; }
        continue;
      }
      if (O && O.kind === 'attack' && want) { this.goTo(v, want, 'Attacking the enemy you pointed out'); continue; }
      if (O && O.kind === 'charge') { const u = this.nearest(v, foes.filter(u => inPlot(u.x, u.z))); if (u) this.goTo(v, u, 'Charging the enemy'); continue; }
      // on their own: finish climbing onto the wall they picked
      if (v.wallB && !v.onWall) { const b = g.buildings.get(v.wallB); if (b) { this.mountWall(v, b); continue; } v.wallB = null; }
      // enemies inside the walls are hunted down; otherwise stand ready behind the point under attack
      const insiders = foes.filter(u => this.isInside(u.x, u.z) || (!this.outside && inPlot(u.x, u.z)));
      const hunt = this.nearest(v, insiders.length ? insiders : this.villageOpen() || !this.threatPoint(v.pos) ? foes.filter(u => inPlot(u.x, u.z)) : []);
      if (hunt && !ranged) { this.goTo(v, hunt, 'Fighting the raiders'); continue; }
      const T = this.threatPoint(v.pos);
      if (T) {
        // archers onto the walls near it (if there are wall-walks), everyone else waits behind it
        const spear = v.job === 'ashigaru' || v.job === 'shieldman';
        if (ranged || (spear && v.id % 5 < 3)) { const w = this.wallSpots(g.center(T), ranged ? 14 : 8)[0]; if (w) { v.wallB = w.id; this.mountWall(v, w); continue; } }
        const inner = this.besideCells(T, false), c = g.center(T);
        let spot = inner.length ? inner[v.id % inner.length] : c;
        if (inner.length) { const dx = spot.x - c.x, dz = spot.z - c.z, d = Math.hypot(dx, dz) || 1; spot = { x: spot.x + dx / d * (ranged ? 6 : 2.5) + ((v.id % 3) - 1) * 1.4, z: spot.z + dz / d * (ranged ? 6 : 2.5) + ((v.id % 5) - 2) * 1.2 }; }
        if (Math.hypot(spot.x - v.pos.x, spot.z - v.pos.z) > 1.2) this.goTo(v, spot, `Standing ready behind the ${T.def.name}`);
        else { v.act = 0.6; v.pose = 'guard'; v.heading = Math.atan2(c.x - v.pos.x, c.z - v.pos.z); v.status = `Standing ready behind the ${T.def.name}`; }
        continue;
      }
      if (ranged && hunt) {
        const dx = v.pos.x - hunt.x, dz = v.pos.z - hunt.z, d = Math.hypot(dx, dz) || 1;
        this.goTo(v, { x: hunt.x + dx / d * (range - 2), z: hunt.z + dz / d * (range - 2) }, 'Shooting at the raiders');
      }
    }
  }
  nearest(v, list) { let best = null, bd = Infinity; for (const u of list) { const d = Math.hypot(u.x - v.pos.x, u.z - v.pos.z); if (d < bd) { bd = d; best = u; } } return best; }
  goTo(v, to, status) {
    const p = this.game.grid.findPath(v.pos, { x: to.x, z: to.z }, true);
    if (p) { v.path = p; v.pathI = 0; v.act = 0; v.onArrive = null; v.status = status; }
  }

  /* ================= hits ================= */
  slow(u) { const g = this.game, [cx, cz] = g.grid.toCell(u.x, u.z), o = g.grid.get(cx, cz), b = o > 0 && g.buildings.get(o); if (b && b.type === 'spikes') { u.hp -= 0.08; return 0.4; } return o < 0 && inPlot(u.x, u.z) ? 0.55 : 1; }
  arrive(u) {
    const g = this.game;
    if (u.carry || u.ram) return;
    // plunder!
    this.raiseAlarm(null, `${this.army ? 'Enemy soldiers' : 'Bandits'} are looting your ${u.goalB ? u.goalB.def.name : 'storehouse'}! Villagers run for cover.`);
    u.carry = {};
    for (const r in RES) { const take = Math.min(60, Math.floor(g.state.res[r] * RAIDS.steal / Math.max(1, this.alive().length) * 2)); if (take > 0) { g.state.res[r] -= take; u.carry[r] = take; this.stolen[r] = (this.stolen[r] || 0) + take; } }
    if (u.person) u.person.setCarry('gold'); u.repath = 0; u.path = null;
    g.emit('res');
  }
  hurtVillager(v, dmg) {
    const g = this.game;
    v.vhp = (v.vhp == null ? 34 : v.vhp) - dmg;
    if (v.vhp <= 0) {
      this.victims++; g.life.grief = Math.min(30, g.life.grief + 5);
      g.toast(`${v.name} was killed by ${this.army ? 'enemy soldiers' : 'bandits'}!`, 'bad'); g.killVillager(v.id);
      this.raiseAlarm(null, `Screams in the village — ${this.army ? 'enemy soldiers' : 'bandits'}! Everyone runs for cover.`);
    }
  }
  hurtSoldier(v, dmg) {
    const g = this.game; g.sfx('clash');
    if (v.job === 'shieldman' && g.rand() < 0.25) return;       // caught on the shield
    v.rhp = (v.rhp || maxHp(v) * (v.hpf ?? 1)) - dmg; v.hitT = 0.3;
    if (v.rhp <= 0) { g.toast(`${v.name} fell defending the village.`, 'bad'); this.cmd.delete(v.id); g.killVillager(v.id); }
  }
  hurtBandit(u, dmg, by = null) {
    if (u.dead) return;
    if (u.ram && by && RANGED_JOBS.has(by.job)) dmg *= 0.3;     // arrows barely scratch a ram
    u.hp -= dmg; u.hit = 0.2; this.game.sfx('clash');
    if (u.hp <= 0) {
      u.dead = true; u.deadT = 0; this.killed++;
      if (by && this.game.villagers.has(by.id)) this.game.credit(by, 1);
      if (u.ram) this.game.toast('The battering ram is wrecked!');
      if (u.carry) { for (const r in u.carry) { this.game.add(r, u.carry[r]); this.stolen[r] -= u.carry[r]; } u.carry = null; u.person.setCarry(null); }
    }
  }
  shoot(v, u, dmg) {
    const m = new THREE.Mesh(this.arrowGeo, MAT.flat);
    const from = { x: v.pos.x, y: (v.elev || 0) + 1.6, z: v.pos.z };
    this.game.scene.add(m); this.game.sfx('arrow');
    this.arrows.push({ m, from, u, by: v, dmg, t: 0, dur: 0.2 + Math.hypot(u.x - from.x, u.z - from.z) / 35 });
  }
  // an enemy archer shoots at one of your people
  enemyShoot(u, v, dmg) {
    const m = new THREE.Mesh(this.arrowGeo, MAT.flat);
    const from = { x: u.x, y: (u.y || 0) + 1.6, z: u.z };
    this.game.scene.add(m); this.game.sfx('arrow');
    this.arrows.push({ m, from, v, dmg, t: 0, dur: 0.2 + Math.hypot(v.pos.x - from.x, v.pos.z - from.z) / 35 });
  }
  // a burning arrow into a house: it may catch fire
  fireArrow(u, b) {
    const m = new THREE.Mesh(this.fireGeo, MAT.glow || MAT.flat), c = this.game.center(b);
    const from = { x: u.x, y: (u.y || 0) + 1.6, z: u.z };
    this.game.scene.add(m); this.game.sfx('arrow');
    this.arrows.push({ m, from, b, to: { x: c.x, y: (b.def.h || 4) * 0.7, z: c.z }, t: 0, dur: 0.4 + Math.hypot(c.x - from.x, c.z - from.z) / 30 });
  }
  updateArrows(dt) {
    const g = this.game;
    for (const a of this.arrows) {
      a.t += dt; const f = Math.min(1, a.t / a.dur);
      const tx = a.to ? a.to.x : a.v ? a.v.pos.x : a.u.x, tz = a.to ? a.to.z : a.v ? a.v.pos.z : a.u.z, ty = a.to ? a.to.y : a.v ? (a.v.elev || 0) + 1.2 : (a.u.y || 0) + 1.2;
      const x = a.from.x + (tx - a.from.x) * f, z = a.from.z + (tz - a.from.z) * f, y = a.from.y + (ty - a.from.y) * f + Math.sin(f * Math.PI) * 2;
      a.m.position.set(x, y, z); a.m.lookAt(tx, ty, tz);
      if (f >= 1) {
        a.done = true; this.game.scene.remove(a.m);
        if (a.b) { if (g.buildings.has(a.b.id) && !a.b.fire && g.rand() < 0.35) g.life.startFire(a.b); continue; }
        if (!a.v) this.hurtBandit(a.u, a.dmg, a.by);
        else if (g.villagers.has(a.v.id) && !a.v.hidden) { if (UNITS[a.v.job] && UNITS[a.v.job].block && g.rand() < UNITS[a.v.job].block) continue; if (JOBS[a.v.job].soldier) this.hurtSoldier(a.v, a.dmg); else this.hurtVillager(a.v, a.dmg); }
      }
    }
    this.arrows = this.arrows.filter(a => !a.done);
  }
  face(u, dx, dz, dt) { if (!dx && !dz) return; const a = Math.atan2(dx, dz); u.heading += Math.atan2(Math.sin(a - u.heading), Math.cos(a - u.heading)) * Math.min(1, dt * 10); }
  pose(u, pose, dt) {
    const o = u.obj; u.y = Math.max(-0.4, heightAt(u.x, u.z));
    u.bump = Math.max(0, (u.bump || 0) - dt);
    o.position.set(u.x + Math.sin(u.heading) * u.bump * 0.6, u.y, u.z + Math.cos(u.heading) * u.bump * 0.6); o.rotation.y = u.heading;
    if (u.person) u.person.animate(dt, pose);
  }

  /* ================= what you see: health bars, rings on your chosen soldiers ================= */
  drawOverlays() {
    const g = this.game, cam = g.stage && g.stage.camera; if (!cam) return;
    if (!this.bars) {
      const bar = new THREE.PlaneGeometry(1, 0.14);
      this.bars = { bg: new THREE.InstancedMesh(bar, new THREE.MeshBasicMaterial({ color: '#1b1714', depthTest: false, transparent: true, opacity: 0.7 }), 160), fg: new THREE.InstancedMesh(bar, new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false }), 160) };
      this.bars.fg.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(160 * 3), 3);
      for (const b of [this.bars.bg, this.bars.fg]) { b.renderOrder = 20; b.frustumCulled = false; b.count = 0; g.scene.add(b); }
      const ring = new THREE.RingGeometry(0.6, 0.78, 20); ring.rotateX(-Math.PI / 2);
      this.rings = new THREE.InstancedMesh(ring, new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.9, depthWrite: false }), 120); this.rings.frustumCulled = false; this.rings.count = 0; g.scene.add(this.rings);
      this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.col = new THREE.Color();
    }
    const m4 = this.m4, q = cam.quaternion, c = this.col, B = this.bars; let n = 0;
    const bar = (x, y, z, w, f, color) => {
      if (n >= 159) return;
      const pos = new THREE.Vector3(x, y, z);
      m4.compose(pos, q, new THREE.Vector3(w + 0.1, 1.3, 1)); B.bg.setMatrixAt(n, m4);
      const off = new THREE.Vector3(-(w * (1 - f)) / 2, 0, 0.01).applyQuaternion(q);
      m4.compose(pos.add(off), q, new THREE.Vector3(Math.max(0.001, w * f), 1, 1)); B.fg.setMatrixAt(n, m4); B.fg.setColorAt(n, c.set(color)); n++;
    };
    for (const u of this.bandits) if (!u.dead && !u.gone && u.hp < u.maxHp) bar(u.x, u.y + (u.ram ? 3.4 : 2.6), u.z, u.ram ? 2.2 : 1.1, u.hp / u.maxHp, '#e0584a');
    for (const G of this.groups) { const T = G.target; if (T && g.buildings.has(T.id) && T.hp < g.maxHp(T)) { const c0 = g.center(T); bar(c0.x, (T.def.h || 3) + 1.2, c0.z, 2.6, Math.max(0, T.hp / g.maxHp(T)), '#d9a441'); } }
    for (const id of this.cmd) { const v = g.villagers.get(id); if (v && v.rhp != null) bar(v.pos.x, (v.elev || 0) + 2.6, v.pos.z, 1.1, Math.max(0, v.rhp / maxHp(v)), '#7fd36a'); }
    B.bg.count = B.fg.count = n; B.bg.instanceMatrix.needsUpdate = B.fg.instanceMatrix.needsUpdate = true; if (B.fg.instanceColor) B.fg.instanceColor.needsUpdate = true;
    let k = 0; const rq = new THREE.Quaternion();
    for (const id of this.cmd) { const v = g.villagers.get(id); if (!v || v.hidden || k >= 119) continue; m4.compose(new THREE.Vector3(v.pos.x, (v.elev || 0) + 0.07, v.pos.z), rq, new THREE.Vector3(1, 1, 1)); this.rings.setMatrixAt(k++, m4); }
    const M = this.markAt, age = M ? (performance.now() - M.t) / 1000 : 9;
    if (M && age < 1.2 && k < 119) { const s = 1.6 + age * 1.5; m4.compose(new THREE.Vector3(M.x, 0.09, M.z), rq, new THREE.Vector3(s, 1, s)); this.rings.setMatrixAt(k++, m4); }
    this.rings.count = k; this.rings.instanceMatrix.needsUpdate = true;
  }
  mark(x, z, foe = false) { this.markAt = { x, z, t: performance.now(), foe }; }
  clearOverlays() { if (this.bars) { this.bars.bg.count = this.bars.fg.count = 0; this.rings.count = 0; } }

  end() {
    const g = this.game, stolen = Object.entries(this.stolen || {}).filter(([, v]) => v > 0);
    const bounty = this.killed * RAIDS.bounty * (1 + g.rb('bounty'));
    if (bounty) g.add('gold', bounty);
    g.progress.add('raidersKilled', this.killed);
    g.progress.log(stolen.length ? `Raiders got away with plunder (${this.bandName(this.bandits.length)}).` : this.victims ? `A raid was beaten off, but ${this.victims} villager${this.victims === 1 ? '' : 's'} died.` : `A raid was beaten off: ${this.bandName(this.killed)} defeated${this.fled ? `, ${this.fled} fled` : ''}.`, 'raid');
    for (const u of this.bandits) { g.scene.remove(u.obj); if (u.person) u.person.dispose(); else u.obj.traverse(o => o.geometry && o.geometry.dispose()); }
    for (const a of this.arrows) g.scene.remove(a.m);
    this.bandits = []; this.arrows = []; this.groups = []; this.active = false; this.alarm = false; this.firstDone = true; this.announced = false;
    this.cmd.clear(); this.clearOverlays();
    // soldiers keep their wounds and heal over time (faster at a Healer's House); orders end, men climb down
    for (const v of g.villagers.values()) {
      v.reset = true; v.order = null;
      if (v.onWall) { v.onWall = false; v.elev = 0; v.wallB = null; const G = g.grid, [cx, cz] = G.toCell(v.pos.x, v.pos.z), w = G.nearestWalkable(cx, cz, 3); if (w) { const c = G.center(w[0], w[1]); v.pos.x = c.x; v.pos.z = c.z; } }
      if (v.rhp != null) { const f = v.rhp / maxHp(v); v.hpf = f >= 0.99 ? null : Math.max(0.05, f); } v.rhp = null; v.vhp = null;
    }
    if (stolen.length) g.toast(`The raid is over. The ${this.army ? 'enemy' : 'bandits'} got away with ${stolen.map(([r, v]) => `${v} ${RES[r].name.toLowerCase()}`).join(', ')}.`, 'warn');
    else if (!this.victims) { g.toast(`Raid repelled! ${this.bandName(this.killed)} defeated${this.fled ? `, ${this.fled} fled` : ''}${bounty ? ` — ${bounty} gold bounty` : ''}.`); g.state.stats.raidsBeaten = (g.state.stats.raidsBeaten || 0) + 1; }
    this.schedule();
    g.emit('raidEnd');
  }
}
