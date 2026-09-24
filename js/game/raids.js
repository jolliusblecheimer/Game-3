// Bandit raids on your village. The band grows with your Town Hall; walls, towers and soldiers keep them out.
import * as THREE from 'three';
import { RAIDS, TOWNHALL, JOBS, UNITS, RES } from './data.js';
import { PLOT } from '../render/nature.js';
import { Person } from '../render/people.js';
import { Mesher, MAT } from '../render/geo.js';

const SIDES = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
const SOLDIER_HP = { ashigaru: 120, archer: 70, berserker: 560, taisho: 380 };

export class Raids {
  constructor(game) {
    this.game = game; this.next = null; this.active = false; this.bandits = []; this.arrows = []; this.warned = false; this.side = 'east';
    const am = new Mesher(1, 0); am.box(0.05, 0.05, 1.0, '#3b2619', [0, 0, 0]); am.box(0.08, 0.08, 0.14, '#c9ced4', [0, 0, 0.55]);
    this.arrowGeo = am.geometry();
  }
  get clock() { return this.game.state.clock; }
  // bandits are in the village and someone has seen them: villagers hide, soldiers fight
  get alarmed() { return this.active && this.alarm; }
  // no raids until you have your first soldier; the first band is small and weak
  schedule(first = false) {
    const [a, b] = first ? RAIDS.firstDelay : RAIDS.every;
    this.next = this.clock + a + this.game.rand() * (b - a);
  }
  postpone() { if (this.next != null && this.next < this.clock + 240) this.next = this.clock + 240; }
  serialize() { return { next: this.next, firstDone: !!this.firstDone }; }
  load(o) {
    this.firstDone = !!(o && o.firstDone) || (this.game.state.stats.raidsBeaten || 0) > 0;
    this.next = o && typeof o.next === 'number' ? o.next : null;
    if (!this.firstDone && !this.game.soldiers(true).length) this.next = null;
    this.postpone();
  }
  bandSize() { return this.firstDone ? TOWNHALL[this.game.thLevel].raid + Math.floor(this.game.rand() * 2) : 2; }
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

  // Bandits creep in quietly. Nobody knows until a soldier spots them — or you do.
  start() {
    const g = this.game, n = this.bandSize();
    this.side = Object.keys(SIDES)[Math.floor(g.rand() * 4)];
    const [sx, sz] = SIDES[this.side], weak = !this.firstDone;
    this.active = true; this.alarm = false; this.bandits = []; this.stolen = {}; this.killed = 0; this.victims = 0;
    for (let i = 0; i < n; i++) {
      const along = (g.rand() - 0.5) * 30, edge = PLOT.half - 1.2;
      const x = sx ? sx * edge : along, z = sz ? sz * edge : along;
      const p = new Person('bandit', 900 + i * 17 + Math.floor(this.clock));
      p.group.position.set(x, 0, z); g.scene.add(p.group);
      const U = weak ? UNITS.outlaw : UNITS.bandit;
      const u = { x, z, hp: U.hp, maxHp: U.hp, dmg: U.dmg, speed: U.speed * 0.8, person: p, heading: 0, cd: g.rand(), path: null, pathI: 0, repath: 0, carry: null, state: 'approach' };
      p.group.traverse(o => { if (o.isMesh) o.userData.pick = { kind: 'bandit' }; });
      this.bandits.push(u);
    }
    for (const v of g.villagers.values()) if (JOBS[v.job].soldier) v.rhp = v.rhp || SOLDIER_HP[v.job] || 100;
    g.emit('raidStart');
  }
  // by = the soldier who saw them, or null when you point them out yourself
  raiseAlarm(by, why) {
    const g = this.game;
    if (!this.active || this.alarm) return;
    this.alarm = true;
    const n = this.alive().length, band = `${n} bandit${n === 1 ? '' : 's'}`;
    g.toast(why || (by ? `${by.name} spotted ${band} sneaking in from the ${this.side}! Villagers run for cover.` : `You raise the alarm: ${band} from the ${this.side}! Your soldiers move in, villagers run for cover.`), 'bad');
    for (const v of g.villagers.values()) v.reset = true;
    g.emit('raid');
  }
  alive() { return this.bandits.filter(b => !b.dead && !b.gone); }

  // bandits can't walk through gates (your people can)
  banditPath(from, to) {
    const G = this.game.grid, closed = [];
    for (const b of this.game.buildings.values()) if (b.type === 'gate' || b.type === 'torii') for (let z = b.cz; z < b.cz + b.d; z++) for (let x = b.cx; x < b.cx + b.w; x++) { const i = G.idx(x, z); if (G.pass[i]) { G.pass[i] = 0; closed.push(i); } }
    const p = G.findPath(from, to);
    for (const i of closed) G.pass[i] = 1;
    const end = p && p[p.length - 1];
    return end && Math.hypot(end.x - to.x, end.z - to.z) < 3 ? p : null;
  }
  // the wall, gate or palisade standing between a bandit and its goal
  blocker(u, to) {
    const g = this.game, dx = to.x - u.x, dz = to.z - u.z, d = Math.hypot(dx, dz);
    for (let t = 0; t < d; t += 0.8) {
      const [cx, cz] = g.grid.toCell(u.x + dx * t / d, u.z + dz * t / d), o = g.grid.get(cx, cz), b = o > 0 && g.buildings.get(o);
      if (b && (b.def.hp || b.def.blocks)) return b;
    }
    // otherwise the nearest breakable defense
    let best = null, bd = Infinity;
    for (const b of g.buildings.values()) if (b.def.hp) { const c = g.center(b), dd = Math.hypot(c.x - u.x, c.z - u.z); if (dd < bd) { bd = dd; best = b; } }
    return best;
  }
  storage() { return [...this.game.buildings.values()].filter(b => b.done && b.def.dropoff === 'all'); }

  step(dt) {
    const g = this.game, soldiers = g.soldiers().filter(v => !v.away);
    for (const u of this.bandits) {
      if (u.dead) { u.deadT += dt; u.person.group.rotation.x = -Math.min(Math.PI / 2, u.deadT * 4); if (u.deadT > 6) u.person.group.visible = false; continue; }
      if (u.gone) continue;
      u.cd -= dt; u.repath -= dt; u.hit = Math.max(0, (u.hit || 0) - dt);
      let pose = 'walk';
      // fight a soldier who comes close
      const foe = soldiers.filter(v => (v.elev || 0) < 1 && !v.hidden).map(v => [v, Math.hypot(v.pos.x - u.x, v.pos.z - u.z)]).sort((a, b) => a[1] - b[1])[0];
      if (foe && foe[1] < 2.0) {
        this.raiseAlarm(foe[0]);
        this.face(u, foe[0].pos.x - u.x, foe[0].pos.z - u.z, dt); pose = 'chop';
        if (u.cd <= 0) { u.cd = 1; this.hurtSoldier(foe[0], u.dmg); }
        this.pose(u, pose, dt); continue;
      }
      // villagers caught outside are attacked
      if (!u.carry) {
        const prey = [...g.villagers.values()].filter(v => !JOBS[v.job].soldier && !v.hidden && !v.away && !(v.elev > 1)).map(v => [v, Math.hypot(v.pos.x - u.x, v.pos.z - u.z)]).sort((a, b) => a[1] - b[1])[0];
        if (prey && prey[1] < 1.6) {
          this.face(u, prey[0].pos.x - u.x, prey[0].pos.z - u.z, dt); pose = 'chop';
          if (u.cd <= 0) { u.cd = 1.2; this.hurtVillager(prey[0], u.dmg); }
          this.pose(u, pose, dt); continue;
        }
        if (prey && prey[1] < 9 && u.state !== 'breach') {
          if (u.repath <= 0 || u.prey !== prey[0].id) { u.prey = prey[0].id; u.repath = 1; const pth = this.banditPath({ x: u.x, z: u.z }, prey[0].pos); if (pth) { u.path = pth; u.pathI = 0; } }
        } else u.prey = null;
      }
      if (u.state === 'breach' && u.wall && g.buildings.has(u.wall.id)) {
        const c = g.center(u.wall);
        if (Math.hypot(c.x - u.x, c.z - u.z) < Math.max(u.wall.w, u.wall.d) + 1.8) {
          // murder holes: stones from nearby towers
          if (g.rb('murder') && [...g.buildings.values()].some(t => t.type === 'tower' && t.done && Math.hypot(g.center(t).x - u.x, g.center(t).z - u.z) < 12)) this.hurtBandit(u, 6 * dt);
          this.face(u, c.x - u.x, c.z - u.z, dt); pose = 'chop';
          if (u.cd <= 0) {
            u.cd = 1.1; u.wall.hp -= u.dmg;
            if (u.wall.hp <= 0) { g.toast(`Bandits broke through your ${u.wall.def.name}!`, 'bad'); g.demolish(u.wall.id, { destroyed: true }); for (const o of this.bandits) if (o.wall === u.wall) { o.state = 'approach'; o.path = null; } }
          }
          this.pose(u, pose, dt); continue;
        }
      } else if (u.state === 'breach') { u.state = 'approach'; u.path = null; }
      // head for the loot (or away with it)
      if (!u.path || u.repath <= 0) {
        u.repath = 3;
        let goal;
        if (u.carry) { const [sx, sz] = SIDES[this.side]; goal = { x: sx ? sx * (PLOT.half - 1) : u.x, z: sz ? sz * (PLOT.half - 1) : u.z }; }
        else { const st = this.storage().sort((a, b) => Math.hypot(g.center(a).x - u.x, g.center(a).z - u.z) - Math.hypot(g.center(b).x - u.x, g.center(b).z - u.z))[0]; if (!st) { u.gone = true; continue; } u.goalB = st; goal = g.door(st, 1); }
        const p = this.banditPath({ x: u.x, z: u.z }, goal);
        if (p) { u.path = p; u.pathI = 0; }
        else { const w = this.blocker(u, goal); if (w) { u.state = 'breach'; u.wall = w; const c = g.center(w); u.path = g.grid.findPath({ x: u.x, z: u.z }, c); u.pathI = 0; } }
      }
      if (u.path) {
        const t = u.path[u.pathI];
        if (!t) { u.path = null; this.arrive(u); }
        else {
          const dx = t.x - u.x, dz = t.z - u.z, d = Math.hypot(dx, dz), sp = u.speed * (this.alarm ? 1.2 : 1) * (u.carry ? 0.85 : 1) * this.slow(u);
          if (d < 0.3) { u.pathI++; if (u.pathI >= u.path.length) { u.path = null; this.arrive(u); } }
          else { const s = Math.min(d, sp * dt); u.x += dx / d * s; u.z += dz / d * s; this.face(u, dx, dz, dt); }
        }
      } else pose = 'guard';
      this.pose(u, pose, dt);
    }
    // before the alarm your soldiers go about their rounds — until one of them sees a bandit
    if (!this.alarm) {
      const eyes = 1 + 0.5 * g.rb('earlyWarn');
      for (const v of soldiers) {
        if (v.hidden) continue;
        const sight = (v.post || v.onWall ? 26 : RAIDS.sight) * eyes;
        if (this.alive().some(u => Math.hypot(u.x - v.pos.x, u.z - v.pos.z) < sight)) { this.raiseAlarm(v); break; }
      }
      this.updateArrows(dt);
      if (!this.alive().length) this.end();
      return;
    }
    // your soldiers fight back
    for (const v of soldiers) {
      v.rcd = (v.rcd || 0) - dt;
      const ranged = v.job === 'archer', tower = v.post && g.buildings.get(v.post.b);
      const range = ranged ? (tower ? 22 + 4 * (tower.level - 1) + 4 * g.rb('archEyes') : 16) * (1 + g.rb('archRange')) : 1.9;
      const targets = this.alive().map(u => [u, Math.hypot(u.x - v.pos.x, u.z - v.pos.z)]).sort((a, b) => a[1] - b[1]);
      const t = targets[0];
      if (!t) continue;
      if (t[1] <= range) {
        v.heading = Math.atan2(t[0].x - v.pos.x, t[0].z - v.pos.z); v.path = null; v.act = 0.5; v.pose = ranged ? 'shoot' : 'chop';
        if (v.rcd <= 0) {
          v.rcd = ranged ? 1.5 / (1 + g.rb('archFast')) : 1.0 / (1 + (v.job === 'ashigaru' ? g.rb('spearFast') : 0));
          const dmg = ranged ? UNITS.archer.dmg * (tower ? 1.3 : 1) * (1 + g.rb('archDmg')) : v.job === 'berserker' ? UNITS.berserker.dmg : v.job === 'taisho' ? UNITS.taisho.dmg : UNITS.ashigaru.dmg * (1 + g.rb('spearDmg'));
          if (ranged) this.shoot(v, t[0], dmg); else this.hurtBandit(t[0], dmg);
        }
      } else if (!tower && !ranged && (!v.path || (v.chaseT || 0) < this.clock)) {
        v.chaseT = this.clock + 1.2;
        const p = g.grid.findPath(v.pos, { x: t[0].x, z: t[0].z }); if (p) { v.path = p; v.pathI = 0; v.act = 0; v.status = 'Fighting the bandits'; }
      } else if (ranged && !tower && t[1] > range && (!v.path || (v.chaseT || 0) < this.clock)) {
        v.chaseT = this.clock + 1.5;
        const dx = v.pos.x - t[0].x, dz = v.pos.z - t[0].z, d = Math.hypot(dx, dz) || 1;
        const p = g.grid.findPath(v.pos, { x: t[0].x + dx / d * (range - 2), z: t[0].z + dz / d * (range - 2) }); if (p) { v.path = p; v.pathI = 0; v.act = 0; v.status = 'Shooting at the bandits'; }
      }
    }
    this.updateArrows(dt);
    if (!this.alive().length) this.end();
  }
  slow(u) { const g = this.game, [cx, cz] = g.grid.toCell(u.x, u.z), o = g.grid.get(cx, cz), b = o > 0 && g.buildings.get(o); if (b && b.type === 'spikes') { u.hp -= 0.08; return 0.4; } return 1; }
  arrive(u) {
    const g = this.game;
    if (u.carry) { u.gone = true; u.person.group.visible = false; return; }
    if (u.state === 'breach') return;
    // plunder!
    this.raiseAlarm(null, `Bandits are looting your ${u.goalB ? u.goalB.def.name : 'storehouse'}! Villagers run for cover.`);
    u.carry = {};
    for (const r in RES) { const take = Math.min(60, Math.floor(g.state.res[r] * RAIDS.steal / Math.max(1, this.alive().length) * 2)); if (take > 0) { g.state.res[r] -= take; u.carry[r] = take; this.stolen[r] = (this.stolen[r] || 0) + take; } }
    u.person.setCarry('gold'); u.repath = 0; u.path = null;
    g.emit('res');
  }
  hurtVillager(v, dmg) {
    const g = this.game;
    v.vhp = (v.vhp == null ? 34 : v.vhp) - dmg;
    if (v.vhp <= 0) {
      this.victims++;
      g.toast(`${v.name} was killed by bandits!`, 'bad'); g.killVillager(v.id);
      this.raiseAlarm(null, 'Screams in the village — bandits! Everyone runs for cover.');
    }
  }
  hurtSoldier(v, dmg) {
    const g = this.game;
    v.rhp = (v.rhp || SOLDIER_HP[v.job] || 100) - dmg;
    if (v.rhp <= 0) { g.toast(`${v.name} fell defending the village.`, 'bad'); g.killVillager(v.id); }
  }
  hurtBandit(u, dmg) {
    if (u.dead) return;
    u.hp -= dmg; u.hit = 0.2;
    if (u.hp <= 0) {
      u.dead = true; u.deadT = 0; this.killed++;
      if (u.carry) { for (const r in u.carry) { this.game.add(r, u.carry[r]); this.stolen[r] -= u.carry[r]; } u.carry = null; u.person.setCarry(null); }
    }
  }
  shoot(v, u, dmg) {
    const m = new THREE.Mesh(this.arrowGeo, MAT.flat);
    const from = { x: v.pos.x, y: (v.elev || 0) + 1.6, z: v.pos.z };
    this.game.scene.add(m);
    this.arrows.push({ m, from, u, dmg, t: 0, dur: 0.2 + Math.hypot(u.x - from.x, u.z - from.z) / 35 });
  }
  updateArrows(dt) {
    for (const a of this.arrows) {
      a.t += dt; const f = Math.min(1, a.t / a.dur), tx = a.u.x, tz = a.u.z;
      const x = a.from.x + (tx - a.from.x) * f, z = a.from.z + (tz - a.from.z) * f, y = a.from.y + (1.2 - a.from.y) * f + Math.sin(f * Math.PI) * 2;
      a.m.position.set(x, y, z); a.m.lookAt(tx, 1.2, tz);
      if (f >= 1) { a.done = true; this.hurtBandit(a.u, a.dmg); this.game.scene.remove(a.m); }
    }
    this.arrows = this.arrows.filter(a => !a.done);
  }
  face(u, dx, dz, dt) { const a = Math.atan2(dx, dz); u.heading += Math.atan2(Math.sin(a - u.heading), Math.cos(a - u.heading)) * Math.min(1, dt * 10); }
  pose(u, pose, dt) { const g = u.person.group; g.position.set(u.x, 0, u.z); g.rotation.y = u.heading; u.person.animate(dt, pose); }
  end() {
    const g = this.game, stolen = Object.entries(this.stolen || {}).filter(([, v]) => v > 0);
    const bounty = this.killed * RAIDS.bounty * (1 + g.rb('bounty'));
    if (bounty) g.add('gold', bounty);
    for (const u of this.bandits) { g.scene.remove(u.person.group); u.person.dispose(); }
    for (const a of this.arrows) g.scene.remove(a.m);
    this.bandits = []; this.arrows = []; this.active = false; this.alarm = false; this.firstDone = true;
    for (const v of g.villagers.values()) { v.reset = true; v.rhp = null; v.vhp = null; }
    if (stolen.length) g.toast(`The raid is over. The bandits got away with ${stolen.map(([r, v]) => `${v} ${RES[r].name.toLowerCase()}`).join(', ')}.`, 'warn');
    else if (!this.victims) { g.toast(`Raid repelled! ${this.killed} bandit${this.killed === 1 ? '' : 's'} defeated${bounty ? ` — ${bounty} gold bounty` : ''}.`); g.state.stats.raidsBeaten = (g.state.stats.raidsBeaten || 0) + 1; }
    this.schedule();
    g.emit('raidEnd');
  }
}
