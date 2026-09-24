// Raids: a real-time battle against a rival base. You command every unit.
import * as THREE from 'three';
import { Grid } from './grid.js';
import { UNITS, JOBS, SITES } from './data.js';
import { buildModel } from '../render/buildings.js';
import { Person } from '../render/people.js';
import { Mesher, MAT } from '../render/geo.js';
import { mulberry32, makeNoise2D, fbm, smoothstep, clamp } from '../util.js';

export const BATTLE_ORIGIN = new THREE.Vector3(4000, 0, 0);
const N = 64, CELL = 2, HALF = N * CELL / 2;
const STRUCT = {
  wall:     { hp: 900, blocks: true, stand: 2.9 },
  palisade: { hp: 320, blocks: true },
  gate:     { hp: 1000, blocks: true, gate: true, stand: 3.4 },
  pgate:    { hp: 480, blocks: true, gate: true, model: 'gate' },
  tower:    { hp: 1300, blocks: true, posts: true, stand: 3.62 },
  keep:     { hp: 3000, blocks: true, model: 'townhall', keep: true },
  house:    { blocks: true, deco: true },
  lumber:   { blocks: true, deco: true },
  storehouse: { blocks: true, deco: true },
  farm:     { deco: true },
  hedge:    { bush: true, deco: true },
  spikes:   { spikes: true, deco: true },
};
const FAMILY = { wall: ['wall', 'gate', 'tower'], palisade: ['palisade', 'pgate', 'gate', 'tower'], hedge: ['hedge'] };

/* ---------- enemy base layouts ---------- */
export function makeLayout(site) {
  const r = mulberry32(site.seed), S = [], D = [], bushes = [];
  const add = (type, cx, cz, w = 1, d = 1, rot = 0) => { S.push({ type, cx, cz, w, d, rot }); return S.length - 1; };
  const occupied = new Set(), mark = (i) => { const s = S[i]; for (let z = s.cz; z < s.cz + s.d; z++) for (let x = s.cx; x < s.cx + s.w; x++) occupied.add(x + ',' + z); };
  // a rectangular ring of wall pieces with a gate in the middle of the south side
  const ring = (piece, x0, z0, x1, z1, { gate = 'gate', gateN = false, towers = [] } = {}) => {
    const gx = Math.floor((x0 + x1) / 2) - 1;
    for (const [tx, tz] of towers) mark(add('tower', tx, tz, 2, 2));
    for (let x = x0; x <= x1; x++) for (const z of [z0, z1]) {
      if (occupied.has(x + ',' + z)) continue;
      if (z === z1 && (x === gx || x === gx + 1)) continue;
      if (z === z0 && gateN && (x === gx || x === gx + 1)) continue;
      mark(add(piece, x, z));
    }
    for (let z = z0 + 1; z < z1; z++) for (const x of [x0, x1]) if (!occupied.has(x + ',' + z)) mark(add(piece, x, z));
    if (gate) mark(add(gate, gx, z1, 2, 1));
    return gx;
  };
  const inside = (x0, z0, x1, z1) => { for (let k = 0; k < 60; k++) { const x = x0 + Math.floor(r() * (x1 - x0 + 1)), z = z0 + Math.floor(r() * (z1 - z0 + 1)); if (!occupied.has(x + ',' + z)) return [x, z]; } return [x0, z0]; };
  const deco = (type, x0, z0, x1, z1, w, d) => { for (let k = 0; k < 40; k++) { const x = x0 + Math.floor(r() * (x1 - x0 - w + 2)), z = z0 + Math.floor(r() * (z1 - z0 - d + 2)); let ok = true; for (let zz = z - 1; zz < z + d + 1; zz++) for (let xx = x - 1; xx < x + w + 1; xx++) if (occupied.has(xx + ',' + zz)) ok = false; if (ok) { mark(add(type, x, z, w, d, Math.floor(r() * 4) % 2 ? 0 : 2)); return; } } };
  const defenders = (type, n, box) => { for (let i = 0; i < n; i++) { const [x, z] = inside(...box); D.push({ type, cx: x, cz: z }); } };
  const posted = (structIdx, n, type = 'enemy_archer') => { for (let i = 0; i < n; i++) D.push({ type, post: structIdx, slot: i }); };
  const wallArchers = (n, zRow, x0, x1) => { const walls = S.map((s, i) => [s, i]).filter(([s]) => s.type === 'wall' && s.cz === zRow && s.cx > x0 && s.cx < x1); for (let i = 0; i < n && walls.length; i++) { const [, idx] = walls.splice(Math.floor(r() * walls.length), 1)[0]; D.push({ type: 'enemy_archer', post: idx, slot: 0 }); } };

  const T = site.tier;
  if (site.type === 'hideout') {
    // a few huts in the woods, no walls: three outlaws and a lookout
    for (let i = 0; i < 2; i++) deco('house', 27, 18, 37, 26, 2, 2);
    defenders('outlaw', 3, [27, 18, 37, 26]);
  } else if (T <= 1) {
    ring('palisade', 25, 16, 39, 28, { gate: null, gateN: true });
    for (let i = 0; i < 3; i++) deco(i === 2 ? 'lumber' : 'house', 27, 18, 37, 26, 2, 2);
    defenders('bandit', 7 + Math.floor(r() * 3), [27, 18, 37, 26]);
    defenders('enemy_archer', 2, [27, 18, 37, 26]);
  } else if (T === 2) {
    const tw = [[23, 29], [39, 29]];
    ring('palisade', 23, 14, 40, 30, { gate: 'pgate', towers: tw });
    for (let i = 0; i < 4; i++) deco('house', 25, 16, 38, 27, 2, 2);
    deco('farm', 25, 16, 38, 27, 4, 4);
    defenders('enemy_ashigaru', 8, [25, 16, 38, 28]);
    for (const [i, s] of S.entries()) if (s.type === 'tower') posted(i, 2);
  } else {
    const castle = T >= 4;
    if (castle) ring('palisade', 16, 6, 47, 40, { gate: 'pgate', towers: [[16, 39], [46, 39]] });
    const [x0, z0, x1, z1] = castle ? [22, 11, 41, 32] : [23, 12, 40, 31];
    ring('wall', x0, z0, x1, z1, { gate: 'gate', towers: [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]] });
    const keepIdx = add('keep', Math.floor((x0 + x1) / 2) - 2, z0 + 3, 4, 4); mark(keepIdx);
    for (let i = 0; i < (castle ? 3 : 2); i++) deco(i ? 'house' : 'storehouse', x0 + 2, z0 + 9, x1 - 2, z1 - 2, 2, i ? 2 : 3);
    for (const [i, s] of S.entries()) if (s.type === 'tower') posted(i, castle ? 2 : 2);
    wallArchers(castle ? 4 : 3, z1, x0, x1);
    defenders('enemy_ashigaru', castle ? 14 : 10, [x0 + 2, z0 + 8, x1 - 2, z1 - 2]);
    defenders('enemy_samurai', castle ? 4 : 2, [x0 + 3, z0 + 7, x1 - 3, z0 + 9]);
    if (castle) D.push({ type: 'enemy_lord', cx: Math.floor((x0 + x1) / 2), cz: z0 + 8 });
    // spike barricades in front of the gate
    const gz = castle ? 43 : z1 + 3;
    for (let x = x0 + 3; x <= x1 - 3; x++) if (Math.abs(x - (x0 + x1) / 2) > 1.6 && r() < 0.8) mark(add('spikes', x, gz));
  }
  // bushes and hedges around the base — good cover for archers and scouts
  for (let k = 0; k < 7 + T * 2; k++) {
    const a = r() * Math.PI * 2, dist = (T >= 4 ? 21 : 14) + r() * 8;
    const cx = Math.round(32 + Math.cos(a) * dist), cz = Math.round(24 + Math.sin(a) * dist * 0.8 + (Math.sin(a) > 0 ? 6 : 0));
    const len = 2 + Math.floor(r() * 4), horiz = r() < 0.5;
    for (let i = 0; i < len; i++) { const x = cx + (horiz ? i : 0), z = cz + (horiz ? 0 : i); if (x > 2 && x < N - 3 && z > 2 && z < 54 && !occupied.has(x + ',' + z)) { bushes.push([x, z]); occupied.add(x + ',' + z); } }
  }
  for (const [x, z] of bushes) add('hedge', x, z);
  return { structs: S, defenders: D };
}

function battleHeight(x, z) {
  const dx = Math.max(Math.abs(x) - HALF - 4, 0), dz = Math.max(Math.abs(z) - HALF - 4, 0), d = Math.hypot(dx, dz);
  return d <= 0 ? 0 : smoothstep(0, 30, d) * (6 + d * 0.35);
}
function ramModel() {
  const m = new Mesher(3, 0.06);
  m.box(1.6, 0.25, 3.2, '#7a5438', [0, 0.55, 0]);
  for (const x of [-0.9, 0.9]) for (const z of [-1.1, 1.1]) m.cyl(0.45, 0.45, 0.18, 10, '#4a3222', [x, 0.45, z], [0, 0, Math.PI / 2]);
  m.cyl(0.32, 0.32, 3.8, 8, '#6b4a2e', [0, 1.05, 0.2], [Math.PI / 2, 0, 0]); m.cone(0.34, 0.5, 8, '#6f7378', [0, 1.05, 2.3], [Math.PI / 2, 0, 0]);
  for (const x of [-0.75, 0.75]) for (const z of [-1.3, 1.3]) m.box(0.12, 1.8, 0.12, '#5a3a28', [x, 1.3, z]);
  m.frustum(2.0, 3.4, 0.2, 3.3, 0.9, '#8b6a44', [0, 2.1, 0]);
  const g = new THREE.Group(); g.add(m.mesh(MAT.flat)); return g;
}

const HP_SCALE = 2;          // everyone is tougher in battle: fights last longer
const SIGHT = { ground: 13, high: 20, bush: 4 };
const CAPTURE_TIME = 12;

/*
 * Defender AI, after the classic ideas of castle defence:
 *  - Sentries patrol while the rest rest. Nobody attacks what they haven't seen.
 *  - On the alarm every man goes to his post: a spear line two ranks deep behind the
 *    gate (the choke point), archers on towers and walls, a reserve at the keep.
 *  - They hold their ground and only fight what comes within reach of their post —
 *    they never charge out of the walls.
 *  - Stones are dropped on anything battering the gate.
 *  - When the spear line breaks, the survivors fall back to the keep for a last stand;
 *    when most are dead the rest flee.
 */
export class Battle {
  constructor(ctx, mission, site) {
    this.ctx = ctx; this.game = ctx.game; this.scene = ctx.stage.scene; this.mission = mission; this.site = site;
    this.defend = !!mission.defend;        // true: you hold this place against attackers
    this.root = new THREE.Group(); this.root.position.copy(BATTLE_ORIGIN); this.scene.add(this.root);
    this.grid = new Grid(N, CELL, BATTLE_ORIGIN.x, BATTLE_ORIGIN.z);
    this.units = []; this.structs = []; this.arrows = []; this.fx = [];
    this.t = 0; this.over = null; this.capture = 0; this.nextId = 1; this.alarm = false; this.phase = 'calm';
    this.rand = mulberry32(site.seed + Math.floor(this.game.state.clock));
    this.buildTerrain();
    this.layout = makeLayout(site);
    this.buildStructures();
    if (this.defend) { this.spawnGarrison(); this.spawnAttackers(); this.alarm = true; this.phase = 'siege'; }
    else { this.spawnDefenders(); this.spawnArmy(); this.assignRoles(); }
    this.initialEnemies = this.units.filter(u => u.team === 1).length;
    this.buildOverlays();
  }
  W(cx, cz) { const c = this.grid.center(cx, cz); return { x: c.x, z: c.z }; }
  cellOf(x, z) { return this.grid.toCell(x, z); }
  structAt(x, z) { const [cx, cz] = this.cellOf(x, z); const i = this.grid.get(cx, cz); return i > 0 ? this.structs[i - 1] : null; }
  get gate() { return this.structs.find(s => s.def.gate && s.type !== 'pgate') || this.structs.find(s => s.def.gate); }
  get keep() { return this.structs.find(s => s.def.keep); }
  rb(k) { return this.game.rb(k); }

  buildTerrain() {
    const size = 360, seg = 120, g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
    const P = g.attributes.position, col = new Float32Array(P.count * 3), c = new THREE.Color(), n = makeNoise2D(this.site.seed);
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), z = P.getZ(i), hgt = battleHeight(x, z); P.setY(i, hgt);
      const v = fbm(n, x * 0.04, z * 0.04, 3), dirt = Math.hypot(x - 0, (z + 16) * 0.8) < 26 - v * 6;
      c.set(dirt ? '#8f7a55' : hgt > 12 ? '#6f8f4f' : v > 0.2 ? '#7aa04c' : '#86ad57'); c.offsetHSL(0, 0, v * 0.03);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.computeVertexNormals(); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 })); m.receiveShadow = true;
    this.root.add(m);
    const t = new Mesher(5, 0.08); t.cyl(0.2, 0.3, 2.4, 6, '#5a3d2a', [0, 1.2, 0]); t.cone(1.9, 2.6, 7, '#2f5a36', [0, 2.8, 0]); t.cone(1.4, 2.2, 7, '#35653c', [0, 4.0, 0]); t.cone(0.9, 1.8, 7, '#3b6f42', [0, 5.0, 0]);
    const r = mulberry32(this.site.seed + 1), list = [];
    while (list.length < 700) { const x = (r() - 0.5) * 340, z = (r() - 0.5) * 340; if (Math.abs(x) < HALF + 3 && Math.abs(z) < HALF + 3) continue; list.push([x, battleHeight(x, z), z, 0.8 + r() * 0.8]); }
    const im = new THREE.InstancedMesh(t.geometry(), MAT.flat, list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    list.forEach(([x, y, z, s], i) => { m4.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i), new THREE.Vector3(s, s, s)); im.setMatrixAt(i, m4); });
    im.castShadow = true; im.receiveShadow = true; this.root.add(im);
  }
  buildStructures() {
    const L = this.layout, key = (x, z) => x + ',' + z, typeAt = new Map();
    L.structs.forEach(s => { for (let z = s.cz; z < s.cz + s.d; z++) for (let x = s.cx; x < s.cx + s.w; x++) typeAt.set(key(x, z), s.type); });
    L.structs.forEach((s, i) => {
      const D = STRUCT[s.type], id = i + 1;
      const st = { ...s, id, def: D, hp: D.hp || 0, maxHp: D.hp || 0, dead: false, isStruct: true, r: 1, team: this.defend ? 0 : 1 };
      const fam = FAMILY[s.type];
      const conn = fam ? { n: fam.includes(typeAt.get(key(s.cx, s.cz - 1))), s: fam.includes(typeAt.get(key(s.cx, s.cz + 1))), e: fam.includes(typeAt.get(key(s.cx + 1, s.cz))), w: fam.includes(typeAt.get(key(s.cx - 1, s.cz))) } : null;
      const [a, b] = s.rot % 2 ? [s.d, s.w] : [s.w, s.d];
      const model = buildModel(D.model || s.type, a * CELL, b * CELL, s.cx * 31 + s.cz, conn);
      const cx = this.grid.center(s.cx, s.cz).x - CELL / 2 + s.w * CELL / 2, cz = this.grid.center(s.cx, s.cz).z - CELL / 2 + s.d * CELL / 2;
      model.position.set(cx - BATTLE_ORIGIN.x, 0, cz - BATTLE_ORIGIN.z); model.rotation.y = s.rot * Math.PI / 2;
      model.traverse(o => { if (o.isMesh) o.userData.struct = id; });
      this.root.add(model);
      st.model = model; st.x = cx; st.z = cz;
      for (let z = s.cz; z < s.cz + s.d; z++) for (let x = s.cx; x < s.cx + s.w; x++) this.grid.set(x, z, id, !D.blocks, D.spikes ? 0.45 : 1);
      this.structs.push(st);
    });
    // the area inside the walls
    const w = this.structs.filter(s => s.type === 'wall' || s.type === 'palisade' || s.type === 'tower');
    const xs = w.map(s => s.cx), zs = w.map(s => s.cz);
    this.box = w.length ? [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] : [26, 16, 38, 28];
  }
  bush(x, z) { const s = this.structAt(x, z); return !!(s && s.def.bush); }
  inside(x, z) { const [cx, cz] = this.cellOf(x, z), b = this.box; return cx > b[0] && cx < b[2] && cz > b[1] && cz < b[3]; }

  /* ---------- units ---------- */
  stats(team, type) {
    const U = UNITS[type], mine = team === 0, rb = k => (mine ? this.rb(k) : 0);
    const spear = type === 'ashigaru', archer = type === 'archer', cmd = type === 'berserker' || type === 'taisho', ram = type === 'ram' || type === 'enemy_ram';
    return {
      hp: U.hp * HP_SCALE * (1 + (spear ? rb('spearHp') : 0) + (cmd ? rb('cmdHp') : 0) + (ram ? rb('ramHp') : 0)),
      dmg: U.dmg * (1 + (spear ? rb('spearDmg') : 0) + (archer ? rb('archDmg') : 0) + (ram ? rb('ramDmg') : 0)),
      cd: U.cd / (1 + (spear ? rb('spearFast') : 0) + (archer ? rb('archFast') : 0)),
      range: U.range * (1 + (archer ? rb('archRange') : 0)),
      speed: U.speed * (1 + (spear ? rb('spearFast') : 0)),
    };
  }
  makeUnit(team, type, x, z, extra = {}) {
    const U = UNITS[type], S = this.stats(team, type);
    let obj, person = null;
    if (U.siege) obj = ramModel();
    else { person = new Person(U.look, (extra.vid || this.nextId) * 13 + team); obj = person.group; }
    obj.position.set(x - BATTLE_ORIGIN.x, 0, z - BATTLE_ORIGIN.z);
    this.root.add(obj);
    const u = { id: this.nextId++, team, type, U, S, x, z, y: 0, hp: S.hp, maxHp: S.hp, r: U.r, cd: this.rand(), obj, person, heading: team ? 0 : Math.PI, dead: false, deadT: 0,
      order: { kind: 'idle' }, path: null, pathI: 0, target: null, thinkT: this.rand() * 0.5, buffs: {}, abilityCd: 0, spotted: -99, ...extra };
    this.units.push(u);
    return u;
  }
  postSpot(s, slot) {
    const [px, pz] = s.type === 'tower' ? [[0, 0.6], [-0.8, -0.5], [0.8, -0.5]][slot % 3] : [0, 0];
    return { x: s.x + px, z: s.z + pz, y: s.type === 'tower' ? 3.62 : 2.9 };
  }
  spawnDefenders() {
    for (const d of this.layout.defenders) {
      if (d.post != null) {
        const s = this.structs[d.post], p = this.postSpot(s, d.slot);
        const u = this.makeUnit(1, d.type, p.x, p.z, { post: s.id, home: { x: p.x, z: p.z } });
        u.y = p.y; u.heading = 0; u.role = 'post';
      } else {
        const c = this.W(d.cx, d.cz);
        this.makeUnit(1, d.type, c.x + (this.rand() - 0.5), c.z + (this.rand() - 0.5), { home: { x: c.x, z: c.z } });
      }
    }
  }
  spawnArmy() {
    const g = this.game, list = this.mission.vids.map(id => g.villagers.get(id)).filter(Boolean);
    const order = ['berserker', 'taisho', 'ashigaru', 'archer'];
    list.sort((a, b) => order.indexOf(a.job) - order.indexOf(b.job));
    const cols = 10;
    list.forEach((v, i) => {
      const c = this.W(27 + (i % cols), 0);
      this.makeUnit(0, v.job, c.x + (this.rand() - 0.5) * 0.4, this.grid.center(0, 58 + Math.floor(i / cols) * 1.3).z, { vid: v.id, name: v.name });
    });
    for (let i = 0; i < this.mission.rams; i++) { const c = this.W(29 + i * 3, 62); this.makeUnit(0, 'ram', c.x, c.z, { ram: true }); }
  }
  // Give every defender a job: sentry, spear line, reserve or guard.
  assignRoles() {
    const foes = this.units.filter(u => u.team === 1 && !u.post), gate = this.gate, keep = this.keep;
    const bx = this.box, gx = gate ? gate.x : this.W(Math.round((bx[0] + bx[2]) / 2), 0).x, gz = gate ? gate.z : this.W(0, bx[3]).z;
    const kx = keep ? keep.x : gx, kz = keep ? keep.z + 6 : gz - 10;
    const spears = foes.filter(u => u.type === 'enemy_ashigaru' || u.type === 'bandit' || u.type === 'outlaw');
    // sentries walk a loop just inside the walls
    const nSentry = Math.min(spears.length, this.site.tier >= 3 ? 3 : 2);
    const inner = [[bx[0] + 1.5, bx[1] + 1.5], [bx[2] - 1.5, bx[1] + 1.5], [bx[2] - 1.5, bx[3] - 1.5], [bx[0] + 1.5, bx[3] - 1.5]].map(([x, z]) => this.W(Math.round(x), Math.round(z)));
    spears.slice(0, nSentry).forEach((u, i) => { u.role = 'sentry'; u.route = inner.slice(i % 4).concat(inner.slice(0, i % 4)); u.routeI = 0; });
    // the spear line: two ranks behind the gate
    let k = 0;
    for (const u of spears.slice(nSentry)) {
      const rank = Math.floor(k / 5), file = (k % 5) - 2; k++;
      u.role = 'line'; u.pos = { x: gx + file * 1.5, z: gz - 3.2 - rank * 1.7 }; u.holdR = 4.5;
    }
    for (const u of foes.filter(u => u.type === 'enemy_samurai' || u.type === 'enemy_lord')) { u.role = 'reserve'; u.pos = { x: kx + (this.rand() - 0.5) * 4, z: kz + (this.rand() - 0.5) * 2 }; u.holdR = 12; }
    for (const u of foes.filter(u => !u.role)) { u.role = 'guard'; u.pos = { ...u.home }; u.holdR = 7; }
    this.lineStart = this.units.filter(u => u.role === 'line').length;
  }

  /* ---------- defense mode: your garrison against attackers ---------- */
  spawnGarrison() {
    const g = this.game, list = this.mission.vids.map(id => g.villagers.get(id)).filter(Boolean);
    const posts = []; for (const s of this.structs) if (s.type === 'tower') for (let i = 0; i < 3; i++) posts.push([s, i]);
    for (const s of this.structs) if (s.type === 'wall' && s.cz === this.box[3] && posts.length < 20) posts.push([s, 0]);
    const gate = this.gate, gx = gate ? gate.x : this.W(32, 0).x, gz = gate ? gate.z : this.W(0, this.box[3]).z;
    let li = 0;
    for (const v of list) {
      if (v.job === 'archer' && posts.length) {
        const [s, i] = posts.shift(), p = this.postSpot(s, i);
        const u = this.makeUnit(0, v.job, p.x, p.z, { vid: v.id, name: v.name, post: s.id }); u.y = p.y; u.heading = 0; u.order = { kind: 'hold' };
      } else {
        const rank = Math.floor(li / 5), file = (li % 5) - 2; li++;
        const u = this.makeUnit(0, v.job, gx + file * 1.5, gz - 3.2 - rank * 1.7, { vid: v.id, name: v.name }); u.heading = 0; u.order = { kind: 'hold' };
      }
    }
  }
  spawnAttackers() {
    const force = this.mission.force || 8, n = Math.round(force * 1.1), r = this.rand;
    const types = []; for (let i = 0; i < n; i++) types.push(i % 10 < 6 ? 'enemy_ashigaru' : i % 10 < 9 ? 'enemy_archer' : 'enemy_samurai');
    if (this.site.tier >= 4) types.push('enemy_lord');
    types.forEach((t, i) => { const c = this.W(20 + (i % 24), 0); this.makeUnit(1, t, c.x + (r() - 0.5), this.grid.center(0, 57 + Math.floor(i / 24) * 1.5).z, { attacker: true }); });
    if (this.gate) this.makeUnit(1, 'enemy_ram', this.W(32, 0).x, this.grid.center(0, 61).z, { attacker: true, ram: true });
  }

  /* ---------- seeing and being seen ---------- */
  lineOfSight(a, b) {
    if ((a.y || 0) > 1.5) return true;                       // from the walls you see over everything
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), steps = Math.ceil(d / 1.2);
    for (let i = 1; i < steps; i++) { const s = this.structAt(a.x + dx * i / steps, a.z + dz * i / steps); if (s && s.def.blocks && !s.dead && s !== this.structAt(b.x, b.z)) return false; }
    return true;
  }
  // can enemy `e` notice player unit `u` right now?
  notices(e, u) {
    const d = Math.hypot(u.x - e.x, u.z - e.z);
    let sight = (e.y || 0) > 1.5 ? SIGHT.high : SIGHT.ground;
    if (u.sneak) sight *= 0.5;
    if (u.hidden) sight = Math.min(sight, SIGHT.bush);
    return d <= sight && this.lineOfSight(e, u);
  }
  // player units the enemy currently knows about
  known(u) { return this.defend || this.t - u.spotted < 3; }
  raiseAlarm(by) {
    if (this.alarm) return;
    this.alarm = true; this.phase = 'alarm';
    this.fx.push({ kind: 'banner', text: 'Spotted! The war horn sounds — defenders to your posts!', t: 0 });
    if (by) this.fx.push({ kind: 'shout', x: by.x, z: by.z, y: (by.y || 0) + 2.6, text: '!', t: 0 });
    for (const u of this.units) if (u.team === 1 && u.role !== 'post') { u.path = null; u.target = null; }
  }

  /* ---------- queries ---------- */
  canHit(a, t) {
    if (t.isStruct) return !a.U.ranged || a.U.siege;
    if (a.U.siege) return false;
    const elevGap = Math.abs((a.y || 0) - (t.y || 0));
    if (!a.U.ranged && elevGap > 1.2) return false; // swords can't reach archers on the walls
    return true;
  }
  inRange(a, t) {
    const d = Math.hypot(t.x - a.x, t.z - a.z) - (t.isStruct ? structRadius(t) : t.r) - a.r;
    let range = a.S.range; if (a.U.ranged && (a.y || 0) > 1) range += 5;
    return d <= range;
  }

  /* ---------- orders from the player ---------- */
  order(units, kind, point, target = null) {
    const list = units.filter(u => !u.dead && !u.fled && u.team === 0);
    if (kind === 'move' || kind === 'amove') {
      const n = list.length, cols = Math.ceil(Math.sqrt(n)), sp = 1.7;
      list.sort((a, b) => (a.U.ranged ? 1 : 0) - (b.U.ranged ? 1 : 0));
      list.forEach((u, i) => {
        const ox = (i % cols - (cols - 1) / 2) * sp, oz = (Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2) * sp;
        u.order = { kind, x: point.x + ox, z: point.z + oz }; u.target = null;
        if (u.post) { const s = this.structs[u.post - 1]; u.post = null; u.y = 0; const d = this.structAt(u.x, u.z); if (d) { const w = this.grid.nearestWalkable(...this.cellOf(u.x, u.z)); if (w) { const c = this.W(w[0], w[1]); u.x = c.x; u.z = c.z; } } void s; }
        this.pathTo(u, u.order.x, u.order.z);
      });
    } else if (kind === 'attack') for (const u of list) { u.order = { kind: 'attack', target }; u.target = target; u.path = null; u.repathT = 0; }
    else if (kind === 'stop') for (const u of list) { u.order = { kind: 'idle' }; u.target = null; u.path = null; }
    else if (kind === 'hold') for (const u of list) { u.order = { kind: 'hold' }; u.target = null; u.path = null; }
  }
  setSneak(units, on) { for (const u of units) if (u.team === 0 && !u.U.siege) u.sneak = on; }
  pathTo(u, x, z) {
    if (u.climbing) return;
    const p = this.grid.findPath({ x: u.x, z: u.z }, { x, z }); u.path = p; u.pathI = 0; u.repathT = 1.5;
  }
  ability(u, point) {
    if (u.dead || u.abilityCd > 0) return false;
    const cdMult = 1 - this.rb('cmdCd');
    if (u.type === 'berserker') {
      if (!point) return false;
      u.climbing = { x: point.x, z: point.z }; u.path = null; u.target = null; u.order = { kind: 'idle' }; u.post = null;
      u.buffs.taunt = 10; u.buffs.shield = 10; u.abilityCd = 35 * cdMult;
      this.shout(u, 'Scale the Wall!');
      if (!this.alarm) this.raiseAlarm(u);
      return true;
    }
    if (u.type === 'taisho') {
      const big = this.rb('banner') ? 2 : 1;
      for (const o of this.units) if (o.team === 0 && !o.dead && Math.hypot(o.x - u.x, o.z - u.z) < 14) { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.3 * big); o.buffs.rally = 8 * big; }
      u.abilityCd = 40 * cdMult; this.shout(u, 'Rally to the banner!');
      return true;
    }
    return false;
  }
  shout(u, text) { this.fx.push({ kind: 'shout', x: u.x, z: u.z, y: (u.y || 0) + 3.2, text, t: 0 }); }
  retreat() {
    this.retreating = true;
    for (const u of this.units) if (u.team === 0 && !u.dead) { u.order = { kind: 'retreat' }; u.target = null; u.climbing = null; u.post = null; u.y = 0; this.pathTo(u, u.x, BATTLE_ORIGIN.z + HALF - 1); }
  }

  /* ---------- simulation ---------- */
  update(dt) {
    if (this.over) { this.animate(dt); return; }
    this.t += dt;
    if (!this.defend) this.enemyTactics();
    for (const u of this.units) {
      if (u.dead || u.fled) continue;
      for (const k in u.buffs) { u.buffs[k] -= dt; if (u.buffs[k] <= 0) delete u.buffs[k]; }
      u.abilityCd = Math.max(0, u.abilityCd - dt); u.cd -= dt * (u.buffs.rally ? 1.4 : 1);
      if (u.team === 0) u.hidden = this.bush(u.x, u.z);
      if (u.post) { const s = this.structs[u.post - 1]; if (s.dead) { u.post = null; u.y = 0; u.hp -= u.maxHp * 0.4; if (u.hp <= 0) { this.kill(u); continue; } } }
      u.thinkT -= dt;
      if (u.thinkT <= 0) { u.thinkT = u.team ? 0.4 + this.rand() * 0.3 : 0.25; this.think(u); }
      this.act(u, dt);
    }
    this.separate();
    for (const a of this.arrows) {
      a.t += dt;
      if (a.t >= a.dur) { a.done = true; if (!a.target.dead) this.damage(a.target, a.dmg, a.from); }
    }
    this.arrows = this.arrows.filter(a => !a.done);
    this.dropStones(dt);
    this.checkEnd(dt);
    this.animate(dt);
  }
  // Keep the defence coherent: line breaks -> fall back to the keep.
  enemyTactics() {
    if (!this.alarm) return;
    const line = this.units.filter(u => u.role === 'line' && !u.dead && !u.fled);
    if (this.phase !== 'fallback' && this.lineStart >= 3 && line.length <= Math.floor(this.lineStart * 0.4)) {
      this.phase = 'fallback';
      this.fx.push({ kind: 'banner', text: 'Their line breaks — they fall back to the keep!', t: 0 });
      const keep = this.keep;
      for (const u of this.units) if (u.team === 1 && !u.dead && (u.role === 'line' || u.role === 'guard' || u.role === 'sentry')) { u.role = 'reserve'; u.pos = keep ? { x: keep.x + (this.rand() - 0.5) * 8, z: keep.z + 5 + this.rand() * 2 } : u.pos; u.holdR = 10; u.path = null; u.target = null; }
    }
  }
  // Stones rain on anything battering the gate while someone guards it from above.
  dropStones(dt) {
    for (const u of this.units) {
      if (u.dead || !u.U.siege || !(u.target && u.target.def && u.target.def.gate)) continue;
      const defenders = this.units.filter(o => o.team !== u.team && !o.dead && (o.y || 0) > 1 && Math.hypot(o.x - u.target.x, o.z - u.target.z) < 12).length;
      if (!defenders) continue;
      const res = u.team === 0 && this.rb('ramHp') ? 0.5 : 1;
      this.damage(u, 7 * defenders * res * dt * 2, null);
      if (Math.random() < dt * 2) this.fx.push({ kind: 'dust', x: u.x, z: u.z, t: 0 });
    }
  }
  think(u) {
    if (u.team === 0) {
      if (u.order.kind === 'retreat' || u.climbing) return;
      if (u.order.kind === 'attack') { const t = u.order.target; if (t && !t.dead && !t.fled) { u.target = t; return; } u.order = { kind: 'idle' }; }
      if (u.order.kind === 'move' && u.path) return;
      if (u.noReachT > this.t) return;
      // your troops only strike on their own when the enemy knows you're here, or when they're told to
      const range = u.order.kind === 'hold' || u.post ? u.S.range + ((u.y || 0) > 1 ? 5 : 0) + 0.5 : u.U.siege ? 16 : u.U.ranged ? u.S.range + 2 : 9;
      u.target = (this.alarm || this.defend) ? this.nearestTarget(u, range) : null;
      if (!u.target && u.order.kind === 'amove' && !u.path) this.pathTo(u, u.order.x, u.order.z);
      return;
    }
    if (this.defend) return this.thinkAttacker(u);
    // defenders
    if (u.fleeing) return;
    // everyone keeps an eye out
    for (const o of this.units) if (o.team === 0 && !o.dead && !o.fled && this.notices(u, o)) { o.spotted = this.t; if (!this.alarm) this.raiseAlarm(u); }
    if (u.post) { u.target = this.nearestTarget(u, u.S.range + ((u.y || 0) > 1 ? 5 : 0)); return; }
    if (!this.alarm) {
      u.target = null;
      if (u.role === 'sentry' && !u.path) { u.routeI = (u.routeI + 1) % u.route.length; const p = u.route[u.routeI]; this.pathTo(u, p.x, p.z); u.walkSlow = true; }
      return;
    }
    u.walkSlow = false;
    const pos = u.pos || u.home, holdR = u.holdR || 6;
    // fight only what comes within reach of the post
    let best = null, bd = Infinity;
    for (const o of this.units) {
      if (o.team !== 0 || o.dead || o.fled || !this.known(o) || !this.canHit(u, o)) continue;
      const fromPost = Math.hypot(o.x - pos.x, o.z - pos.z);
      if (fromPost > holdR + (u.U.ranged ? u.S.range : 1.5)) continue;
      if (u.role === 'reserve' && !this.inside(o.x, o.z)) continue;   // the reserve never leaves the walls
      const d = Math.hypot(o.x - u.x, o.z - u.z) - (o.buffs.taunt ? 25 : 0);
      if (d < bd) { bd = d; best = o; }
    }
    u.target = best;
    if (!best && Math.hypot(u.x - pos.x, u.z - pos.z) > 1.2 && !u.path) this.pathTo(u, pos.x, pos.z);
  }
  // attackers in defence mode: archers shoot at the walls, the ram goes for the gate,
  // the foot soldiers wait for a breach and then storm in
  thinkAttacker(u) {
    if (u.fleeing) return;
    const gate = this.gate, breached = !gate || gate.dead || this.structs.some(s => (s.type === 'wall' || s.type === 'palisade') && s.dead);
    if (u.U.siege) { u.target = gate && !gate.dead ? gate : this.nearestStruct(u); return; }
    if (u.U.ranged) { u.target = this.nearestTarget(u, u.S.range + 2); if (!u.target && !u.path) { const g = gate || this.W(32, this.box[3]); this.pathTo(u, g.x + (this.rand() - 0.5) * 14, g.z + 13); } return; }
    if (!breached && this.t < 60) {
      u.target = this.nearestTarget(u, 3);
      if (!u.target && !u.path) { const g = gate || this.W(32, this.box[3]); this.pathTo(u, g.x + (this.rand() - 0.5) * 12, g.z + 9); }
      return;
    }
    u.target = this.nearestTarget(u, 60);
    if (!u.target && !breached) u.target = gate && !gate.dead ? gate : this.nearestStruct(u);
  }
  nearestStruct(u) {
    let best = null, bd = Infinity;
    for (const s of this.structs) { if (s.dead || !s.maxHp || s.def.keep) continue; const d = Math.hypot(s.x - u.x, s.z - u.z); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  nearestTarget(u, range) {
    let best = null, bd = Infinity;
    if (u.U.siege) {
      for (const s of this.structs) {
        if (s.dead || !s.maxHp || s.def.keep || s.team === u.team) continue;
        const d = Math.hypot(s.x - u.x, s.z - u.z) - (s.def.gate ? 6 : 0);
        if (d < range && d < bd) { bd = d; best = s; }
      }
      return best;
    }
    for (const o of this.units) {
      if (o.team === u.team || o.dead || o.fled) continue;
      if (u.team === 1 && !this.known(o)) continue;
      if (u.team === 0 && o.team === 1 && o.hidden) continue;
      if (!this.canHit(u, o)) continue;
      let d = Math.hypot(o.x - u.x, o.z - u.z);
      if (u.team === 1 && o.buffs.taunt) d -= 25;
      if (d < range && d < bd) { bd = d; best = o; }
    }
    return best;
  }
  act(u, dt) {
    const sp = u.S.speed * (u.buffs.rally ? 1.4 : 1) * this.grid.speedAt(u.x, u.z) * (u.post ? 0 : 1) * (u.sneak ? 0.55 : 1) * (u.walkSlow ? 0.5 : 1);
    if (u.climbing) {
      const c = u.climbing, dx = c.x - u.x, dz = c.z - u.z, d = Math.hypot(dx, dz);
      const on = this.structAt(u.x, u.z), up = on && on.def.blocks && !on.dead;
      u.y += ((up ? (on.def.stand || 3.2) : 0) - u.y) * Math.min(1, dt * 3);
      if (d < 0.3) { u.climbing = null; u.target = this.nearestTarget(u, 6); }
      else { const step = Math.min(d, u.S.speed * 0.7 * dt); u.x += dx / d * step; u.z += dz / d * step; this.face(u, dx, dz, dt); u.moving = true; return; }
    }
    const st = this.structAt(u.x, u.z);
    if (u.team !== (st && st.team) && st && st.def.spikes && !u.U.siege) u.hp -= 4 * dt;
    if (!u.climbing && !u.post && u.y > 0) { const on = this.structAt(u.x, u.z); if (!(on && on.def.blocks && !on.dead)) u.y = Math.max(0, u.y - dt * 6); }
    u.moving = false;
    const t = u.target;
    if (t && !(t.dead) && !t.fled) {
      if (this.inRange(u, t) && this.canHit(u, t)) {
        this.face(u, t.x - u.x, t.z - u.z, dt);
        if (u.cd <= 0) { u.cd = u.S.cd; this.attack(u, t); }
        u.path = null; return;
      }
      if (u.post || u.order.kind === 'hold' || ((u.y || 0) > 1 && !u.U.climb)) return;
      u.repathT = (u.repathT || 0) - dt;
      if (!u.path || u.repathT <= 0) {
        if (t.isStruct) { const dx = u.x - t.x, dz = u.z - t.z, d = Math.hypot(dx, dz) || 1, R = structRadius(t) + u.r + 0.6; this.pathTo(u, t.x + dx / d * R, t.z + dz / d * R); }
        else this.pathTo(u, t.x, t.z);
        const end = u.path && u.path[u.path.length - 1];
        if (!u.path || (end && Math.hypot(end.x - t.x, end.z - t.z) > (t.isStruct ? structRadius(t) + 3 : 4))) { u.target = null; u.path = null; u.noReachT = this.t + 2.5; if (u.order.kind === 'attack') u.order = { kind: 'idle' }; return; }
      }
    }
    if (u.path && sp > 0) {
      const p = u.path[u.pathI];
      if (!p) { u.path = null; if (u.order.kind === 'move' || u.order.kind === 'amove') u.order = { kind: 'idle' }; if (u.order.kind === 'retreat') this.escape(u); return; }
      const dx = p.x - u.x, dz = p.z - u.z, d = Math.hypot(dx, dz);
      if (d < 0.25) { u.pathI++; if (u.pathI >= u.path.length) { u.path = null; if (u.order.kind === 'retreat') this.escape(u); else if (u.order.kind === 'move') u.order = { kind: 'idle' }; } return; }
      const step = Math.min(d, sp * dt); u.x += dx / d * step; u.z += dz / d * step; this.face(u, dx, dz, dt); u.moving = true;
    }
  }
  escape(u) { if (u.team === 0 ? u.z > BATTLE_ORIGIN.z + HALF - 6 : u.z < BATTLE_ORIGIN.z - HALF + 6) { u.fled = true; u.obj.visible = false; } }
  face(u, dx, dz, dt) { const a = Math.atan2(dx, dz); let diff = Math.atan2(Math.sin(a - u.heading), Math.cos(a - u.heading)); u.heading += diff * Math.min(1, dt * 10); }
  attack(u, t) {
    let dmg = u.S.dmg * (u.buffs.rally ? 1.2 : 1);
    if (u.team === 0) for (const o of this.units) if (o.type === 'taisho' && !o.dead && o !== u && Math.hypot(o.x - u.x, o.z - u.z) < 10) { dmg *= this.rb('banner') ? 1.4 : 1.2; break; }
    // attacking gives you away
    if (u.team === 0 && !this.defend) {
      const near = this.units.some(o => o.team === 1 && !o.dead && Math.hypot(o.x - u.x, o.z - u.z) < (u.hidden ? 7 : 16));
      if (near || !u.U.ranged) { u.spotted = this.t; if (!this.alarm && (!u.hidden || near)) this.raiseAlarm(u); }
    }
    if (t.isStruct) {
      if (!u.U.siege) dmg *= t.def.gate || t.type === 'palisade' ? 0.25 : 0.1;
      this.damage(t, dmg, u); u.swing = 0.35; return;
    }
    if (u.U.ranged) {
      if ((t.y || 0) > 1 && (u.y || 0) < 1) dmg *= 0.8;
      if ((u.y || 0) > 1) dmg *= 1.25;
      const d = Math.hypot(t.x - u.x, t.z - u.z);
      this.arrows.push({ from: u, target: t, x0: u.x, z0: u.z, y0: (u.y || 0) + 1.5, dmg, t: 0, dur: 0.15 + d / 38 });
      u.swing = 0.5; return;
    }
    this.damage(t, dmg, u); u.swing = 0.35;
    if (u.U.cleave) for (const o of this.units) if (o.team !== u.team && !o.dead && o !== t && Math.hypot(o.x - t.x, o.z - t.z) < u.U.cleave && this.canHit(u, o)) this.damage(o, dmg * 0.6, u);
  }
  damage(t, dmg, from) {
    if (t.isStruct) {
      if (t.dead) return;
      t.hp -= dmg; t.hitT = 0.3;
      if (t.hp <= 0) this.destroy(t);
      return;
    }
    if (t.dead) return;
    if (t.buffs.shield) dmg *= 0.5;
    if (t.team === 0 && t.type === 'ashigaru' && t.order.kind === 'hold') dmg *= 1 - this.rb('spearWall');
    if (t.U.arrowResist && from && from.U.ranged) dmg *= t.U.arrowResist;
    t.hp -= dmg; t.hitT = 0.25;
    if (from && from.team === 0) from.spotted = Math.max(from.spotted, this.t - 1);
    if (t.hp <= 0) {
      this.kill(t);
      if (from && from.type === 'berserker' && from.team === 0 && this.rb('bloodlust')) from.hp = Math.min(from.maxHp, from.hp + from.maxHp * 0.12);
    }
  }
  kill(u) {
    u.dead = true; u.hp = 0; u.deadT = 0; u.path = null;
    if (u.team === 1 && !this.over) {
      const alive = this.units.filter(o => o.team === 1 && !o.dead && !o.fled).length;
      if (alive <= Math.ceil(this.initialEnemies * 0.22) && alive > 0 && !this.routed) {
        this.routed = true; this.fx.push({ kind: 'banner', text: 'The enemy breaks and runs!', t: 0 });
        for (const o of this.units) if (o.team === 1 && !o.dead) { o.fleeing = true; o.post = null; o.y = 0; o.target = null; this.pathTo(o, o.x, this.defend ? BATTLE_ORIGIN.z + HALF - 2 : BATTLE_ORIGIN.z - HALF + 2); o.order = { kind: 'retreat' }; }
      }
    }
  }
  destroy(s) {
    s.dead = true; s.hp = 0; s.collapse = 0;
    for (let z = s.cz; z < s.cz + s.d; z++) for (let x = s.cx; x < s.cx + s.w; x++) this.grid.set(x, z, 0, true, 1);
    for (const u of this.units) if (u.path) u.repathT = 0;
    this.fx.push({ kind: 'dust', x: s.x, z: s.z, t: 0 });
    if (s.def.gate) this.fx.push({ kind: 'banner', text: s.team === 0 ? 'Your gate is broken!' : 'The gate is broken!', t: 0 });
  }
  separate() {
    const U = this.units;
    for (let i = 0; i < U.length; i++) {
      const a = U[i]; if (a.dead || a.fled || a.post) continue;
      for (let j = i + 1; j < U.length; j++) {
        const b = U[j]; if (b.dead || b.fled || b.post) continue;
        if (Math.abs((a.y || 0) - (b.y || 0)) > 1) continue;
        const dx = b.x - a.x, dz = b.z - a.z, min = a.r + b.r, d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2), push = (min - d) * 0.5, nx = dx / d, nz = dz / d;
        const wa = a.U.siege ? 0.1 : 1, wb = b.U.siege ? 0.1 : 1;
        this.nudge(a, -nx * push * wa, -nz * push * wa); this.nudge(b, nx * push * wb, nz * push * wb);
      }
    }
  }
  nudge(u, dx, dz) {
    if (u.climbing) { u.x += dx; u.z += dz; return; }
    const [cx, cz] = this.cellOf(u.x + dx, u.z + dz);
    if (this.grid.walkable(cx, cz) || u.y > 1) { u.x += dx; u.z += dz; }
  }
  checkEnd(dt) {
    const mine = this.units.filter(u => u.team === 0 && !u.dead && !u.fled);
    const foes = this.units.filter(u => u.team === 1 && !u.dead && !u.fled);
    if (!mine.length) { this.finish(this.retreating ? 'retreat' : 'defeat'); return; }
    for (const f of foes) if (f.fleeing) this.escape(f);
    const fighting = foes.filter(f => !f.fleeing);
    const keep = this.keep;
    if (this.defend) {
      if (!fighting.length) { this.finish('victory'); return; }
      // the attackers take the keep if they reach it and nobody defends it
      if (keep) {
        const near = fighting.some(u => Math.hypot(u.x - keep.x, u.z - keep.z) < 8), guarded = mine.some(u => Math.hypot(u.x - keep.x, u.z - keep.z) < 12);
        if (near && !guarded) { this.capture += dt / CAPTURE_TIME; if (this.capture >= 1) this.finish('defeat'); } else this.capture = Math.max(0, this.capture - dt / 20);
      }
      return;
    }
    if (!keep) { if (!fighting.length) this.finish('victory'); return; }
    const near = mine.some(u => Math.hypot(u.x - keep.x, u.z - keep.z) < 8);
    const guarded = fighting.some(f => Math.hypot(f.x - keep.x, f.z - keep.z) < 12);
    if (near && !guarded) { this.capture += dt / CAPTURE_TIME; if (this.capture >= 1) this.finish('victory'); }
    else this.capture = Math.max(0, this.capture - dt / 20);
    if (!fighting.length && !foes.length) this.finish('victory');
  }
  finish(result) {
    if (this.over) return;
    this.over = result;
    if (this.onEnd) setTimeout(() => this.onEnd(result), 1400);
  }

  /* ---------- visuals ---------- */
  buildOverlays() {
    const bar = new THREE.PlaneGeometry(1, 0.14);
    this.barBg = new THREE.InstancedMesh(bar, new THREE.MeshBasicMaterial({ color: '#1b1714', depthTest: false, transparent: true, opacity: 0.7 }), 400);
    this.barFg = new THREE.InstancedMesh(bar, new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false }), 400);
    this.barFg.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(400 * 3), 3);
    for (const b of [this.barBg, this.barFg]) { b.renderOrder = 20; b.frustumCulled = false; b.count = 0; this.root.add(b); }
    const ring = new THREE.RingGeometry(0.75, 0.95, 20); ring.rotateX(-Math.PI / 2);
    this.rings = new THREE.InstancedMesh(ring, new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.85, depthWrite: false }), 200);
    this.rings.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(200 * 3), 3);
    this.rings.frustumCulled = false; this.rings.count = 0; this.root.add(this.rings);
    const am = new Mesher(1, 0); am.box(0.05, 0.05, 1.1, '#3b2619', [0, 0, 0]); am.box(0.08, 0.08, 0.15, '#c9ced4', [0, 0, 0.6]); am.box(0.14, 0.02, 0.2, '#f2ece0', [0, 0, -0.5]);
    this.arrowMesh = new THREE.InstancedMesh(am.geometry(), MAT.flat, 300); this.arrowMesh.frustumCulled = false; this.arrowMesh.count = 0; this.root.add(this.arrowMesh);
    const bush = new THREE.RingGeometry(0.3, 0.55, 12); bush.rotateX(-Math.PI / 2);
    this.hideMarks = new THREE.InstancedMesh(bush, new THREE.MeshBasicMaterial({ color: '#a6e07b', transparent: true, opacity: 0.8, depthWrite: false }), 120); this.hideMarks.frustumCulled = false; this.hideMarks.count = 0; this.root.add(this.hideMarks);
    // sight circles of the enemy (shown before the alarm, so you can plan a sneak)
    const cone = new THREE.RingGeometry(SIGHT.ground - 0.3, SIGHT.ground, 40); cone.rotateX(-Math.PI / 2);
    this.sightMarks = new THREE.InstancedMesh(cone, new THREE.MeshBasicMaterial({ color: '#ff8a6a', transparent: true, opacity: 0.35, depthWrite: false }), 80); this.sightMarks.frustumCulled = false; this.sightMarks.count = 0; this.root.add(this.sightMarks);
  }
  animate(dt) {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), camQ = this.ctx.stage.camera.quaternion, c = new THREE.Color();
    let bars = 0, hidden = 0, sights = 0;
    for (const u of this.units) {
      const o = u.obj;
      o.position.set(u.x - BATTLE_ORIGIN.x, u.y || 0, u.z - BATTLE_ORIGIN.z);
      o.rotation.y = u.heading;
      if (u.dead) {
        u.deadT += dt;
        if (u.person) { o.rotation.x = Math.min(Math.PI / 2, u.deadT * 4) * -1; o.position.y = Math.max(-0.3, (u.y || 0) - u.deadT * 3); }
        else o.scale.y = Math.max(0.3, 1 - u.deadT);
        if (u.deadT > 8) o.visible = false;
        continue;
      }
      if (u.person) {
        u.swing = Math.max(0, (u.swing || 0) - dt);
        const pose = u.swing > 0 ? (u.U.ranged ? 'shoot' : 'chop') : u.moving || u.climbing ? (u.sneak ? 'sneak' : 'walk') : u.target && u.U.ranged ? 'shoot' : u.sneak ? 'kneel' : 'guard';
        u.person.animate(dt, pose, u.buffs.rally ? 1.4 : u.walkSlow ? 0.6 : 1);
        const ghost = u.team === 0 && (u.hidden || u.sneak);
        if (u._hid !== ghost) { u._hid = ghost; o.traverse(x => { if (x.isMesh) x.material = ghost ? MAT.hidden : MAT.flat; }); }
      }
      if (u.team === 1 && !this.alarm && !this.defend && sights < 80) { m4.compose(new THREE.Vector3(u.x - BATTLE_ORIGIN.x, 0.1, u.z - BATTLE_ORIGIN.z), q.identity(), new THREE.Vector3(1, 1, 1).multiplyScalar((u.y || 0) > 1.5 ? SIGHT.high / SIGHT.ground : 1)); this.sightMarks.setMatrixAt(sights++, m4); }
      if (u.hidden && hidden < 120) { m4.compose(new THREE.Vector3(u.x - BATTLE_ORIGIN.x, 0.08, u.z - BATTLE_ORIGIN.z), q.identity(), new THREE.Vector3(1.6, 1, 1.6)); this.hideMarks.setMatrixAt(hidden++, m4); }
      if ((u.hp < u.maxHp || u.team === 0) && bars < 399) {
        const w = u.U.siege ? 2.4 : u.type === 'berserker' || u.type === 'taisho' || u.type === 'enemy_lord' ? 1.8 : 1.1, y = (u.y || 0) + (u.U.siege ? 3.4 : 2.6 * (u.person ? u.person.group.scale.x : 1));
        const pos = new THREE.Vector3(u.x - BATTLE_ORIGIN.x, y, u.z - BATTLE_ORIGIN.z);
        m4.compose(pos, camQ, new THREE.Vector3(w + 0.1, 1.3, 1)); this.barBg.setMatrixAt(bars, m4);
        const f = clamp(u.hp / u.maxHp, 0, 1);
        const off = new THREE.Vector3(-(w * (1 - f)) / 2, 0, 0.01).applyQuaternion(camQ);
        m4.compose(pos.clone().add(off), camQ, new THREE.Vector3(Math.max(0.001, w * f), 1, 1)); this.barFg.setMatrixAt(bars, m4);
        this.barFg.setColorAt(bars, c.set(u.team ? '#e0584a' : f > 0.5 ? '#7fd36a' : '#e6b84a'));
        bars++;
      }
    }
    for (const s of this.structs) {
      if (s.dead) {
        if (s.collapse < 1) { s.collapse = Math.min(1, s.collapse + dt * 1.5); s.model.scale.y = 1 - s.collapse * 0.8; s.model.rotation.z = s.collapse * 0.08; }
        continue;
      }
      if (s.maxHp && s.hp < s.maxHp && bars < 399) {
        const w = 3, pos = new THREE.Vector3(s.x - BATTLE_ORIGIN.x, (s.def.keep ? 13 : s.type === 'tower' ? 7.5 : 4.2), s.z - BATTLE_ORIGIN.z);
        m4.compose(pos, camQ, new THREE.Vector3(w + 0.1, 1.5, 1)); this.barBg.setMatrixAt(bars, m4);
        const f = clamp(s.hp / s.maxHp, 0, 1), off = new THREE.Vector3(-(w * (1 - f)) / 2, 0, 0.01).applyQuaternion(camQ);
        m4.compose(pos.clone().add(off), camQ, new THREE.Vector3(Math.max(0.001, w * f), 1.2, 1)); this.barFg.setMatrixAt(bars, m4);
        this.barFg.setColorAt(bars, c.set('#d9a441')); bars++;
      }
    }
    this.barBg.count = this.barFg.count = bars;
    this.barBg.instanceMatrix.needsUpdate = this.barFg.instanceMatrix.needsUpdate = true; if (this.barFg.instanceColor) this.barFg.instanceColor.needsUpdate = true;
    this.hideMarks.count = hidden; this.hideMarks.instanceMatrix.needsUpdate = true;
    this.sightMarks.count = sights; this.sightMarks.instanceMatrix.needsUpdate = true;
    let k = 0;
    for (const a of this.arrows) {
      if (k >= 300) break;
      const f = a.t / a.dur, tx = a.target.x, tz = a.target.z, ty = (a.target.y || 0) + (a.target.isStruct ? 2 : 1.2);
      const x = a.x0 + (tx - a.x0) * f, z = a.z0 + (tz - a.z0) * f, y = a.y0 + (ty - a.y0) * f + Math.sin(f * Math.PI) * Math.hypot(tx - a.x0, tz - a.z0) * 0.12;
      const f2 = Math.min(1, f + 0.05), x2 = a.x0 + (tx - a.x0) * f2, z2 = a.z0 + (tz - a.z0) * f2, y2 = a.y0 + (ty - a.y0) * f2 + Math.sin(f2 * Math.PI) * Math.hypot(tx - a.x0, tz - a.z0) * 0.12;
      m4.lookAt(new THREE.Vector3(x2, y2, z2), new THREE.Vector3(x, y, z), new THREE.Vector3(0, 1, 0));
      q.setFromRotationMatrix(m4); m4.compose(new THREE.Vector3(x - BATTLE_ORIGIN.x, y, z - BATTLE_ORIGIN.z), q, new THREE.Vector3(1, 1, 1));
      this.arrowMesh.setMatrixAt(k++, m4);
    }
    this.arrowMesh.count = k; this.arrowMesh.instanceMatrix.needsUpdate = true;
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter(f => f.t < 3.5);
  }
  setSelection(sel) {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    let i = 0;
    for (const u of sel) {
      if (u.dead || u.fled || i >= 199) continue;
      const s = u.U.siege ? 2.2 : u.r * 1.8;
      m4.compose(new THREE.Vector3(u.x - BATTLE_ORIGIN.x, (u.y || 0) + 0.07, u.z - BATTLE_ORIGIN.z), q, new THREE.Vector3(s, 1, s));
      this.rings.setMatrixAt(i, m4); this.rings.setColorAt(i++, c.set('#ffd76a'));
    }
    if (this.focusTarget && !this.focusTarget.dead) {
      const t = this.focusTarget, s = t.isStruct ? 2.4 : t.r * 1.8;
      m4.compose(new THREE.Vector3(t.x - BATTLE_ORIGIN.x, (t.y || 0) + 0.07, t.z - BATTLE_ORIGIN.z), q, new THREE.Vector3(s, 1, s));
      this.rings.setMatrixAt(i, m4); this.rings.setColorAt(i++, c.set('#ff6b5a'));
    }
    this.rings.count = i; this.rings.instanceMatrix.needsUpdate = true; if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
  }
  dispose() {
    this.scene.remove(this.root);
    this.root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  results() {
    const alive = this.units.filter(u => u.team === 0 && !u.dead);
    return { survivors: alive.filter(u => u.vid).map(u => u.vid), rams: alive.filter(u => u.ram).length, dead: this.units.filter(u => u.team === 0 && u.dead && u.vid).map(u => u.name) };
  }
}
function structRadius(s) { return Math.max(s.w, s.d) * CELL / 2; }
