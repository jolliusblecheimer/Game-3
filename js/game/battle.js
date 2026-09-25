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
  } else if (site.type === 'smallcastle') {
    // stone walls with two gate towers, a keep at the back and spikes before the gate
    const [x0, z0, x1, z1] = [25, 14, 39, 28];
    ring('wall', x0, z0, x1, z1, { gate: 'gate', towers: [[x0, z1 - 1], [x1 - 1, z1 - 1]] });
    mark(add('keep', Math.floor((x0 + x1) / 2) - 2, z0 + 2, 4, 4));
    deco('storehouse', x0 + 2, z0 + 7, x1 - 2, z1 - 3, 2, 3);
    for (const [i, s] of S.entries()) if (s.type === 'tower') posted(i, 1);
    wallArchers(2, z1, x0, x1);
    defenders('enemy_ashigaru', 5, [x0 + 2, z0 + 7, x1 - 2, z1 - 2]);
    defenders('enemy_shield', 2, [x0 + 2, z0 + 7, x1 - 2, z1 - 2]);
    defenders('enemy_samurai', 1, [x0 + 3, z0 + 6, x1 - 3, z0 + 8]);
    for (let x = x0 + 3; x <= x1 - 3; x++) if (Math.abs(x - (x0 + x1) / 2) > 1.6 && r() < 0.7) mark(add('spikes', x, z1 + 3));
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
    defenders('enemy_ashigaru', 5, [25, 16, 38, 28]);
    defenders('enemy_shield', 3, [25, 16, 38, 28]);
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
    defenders('enemy_ashigaru', castle ? 11 : 8, [x0 + 2, z0 + 8, x1 - 2, z1 - 2]);
    defenders('enemy_shield', castle ? 5 : 3, [x0 + 2, z0 + 8, x1 - 2, z1 - 2]);
    defenders('enemy_samurai', castle ? 4 : 2, [x0 + 3, z0 + 7, x1 - 3, z0 + 9]);
    if (castle) D.push({ type: 'enemy_lord', cx: Math.floor((x0 + x1) / 2), cz: z0 + 8 });
    if (T >= 5) { defenders('enemy_samurai', 4, [x0 + 3, z0 + 7, x1 - 3, z0 + 10]); defenders('enemy_shield', 4, [x0 + 2, z0 + 8, x1 - 2, z1 - 2]); defenders('enemy_ashigaru', 4, [x0 + 2, z0 + 8, x1 - 2, z1 - 2]); }
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

const HP_SCALE = 3.5;        // everyone is much tougher in battle: fights last longer
const SIGHT = { ground: 13, high: 20, bush: 4, alert: 22 }; // after the alarm everyone looks everywhere, and further
const FOV = 2.3;             // a man on the ground sees about 130° ahead of him (towers see all round)
const HEAR = 3.2;            // ...and hears footsteps this close behind him (sneaking: half)
const CAPTURE_TIME = 12;
const WALL_SCALE = 2;        // walls, gates and towers are this much stronger than their base hp
const FORTIFIED = 0.8;       // men fighting inside their own walls take this share of the damage

/*
 * Before the alarm every defender keeps watch:
 *  - On the ground he sees in the direction he faces; on a tower all round. Sentries walk their
 *    round and pause at the corners to look about; the others stand and now and then look round.
 *  - What he sees makes him suspicious (?) — slowly at the edge of his sight, fast up close,
 *    slower still if you creep. He stops and stares; if you vanish he walks over to have a look.
 *    Only when he is sure does he raise the alarm (!).
 *  - A thrown stone makes those nearby turn to look, and one or two walk off to check.
 *  - Strike an unaware man from behind while sneaking and he goes down without a sound.
 *  - A body, once found, raises the alarm.
 * After the alarm:
 *  - A lone attacker or two out in the open tempts a few out through the gate (lead them into an ambush).
 *  - A man who is struck calls the ones beside him; a broken wall draws men to plug the breach.
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
      const hp = (D.hp || 0) * WALL_SCALE; // walls and gates keep pace with the tougher troops
      const st = { ...s, id, def: D, hp, maxHp: hp, dead: false, isStruct: true, r: 1, team: this.defend ? 0 : 1 };
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
    const v = extra.vid && this.game.villagers.get(extra.vid), hurt = v && v.hpf != null ? Math.max(0.15, v.hpf) : 1;
    const u = { id: this.nextId++, team, type, U, S, x, z, y: 0, hp: S.hp * hurt, maxHp: S.hp, r: U.r, cd: this.rand(), obj, person, heading: team ? 0 : Math.PI, dead: false, deadT: 0,
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
    const order = ['berserker', 'taisho', 'samurai', 'shieldman', 'ashigaru', 'archer'];
    list.sort((a, b) => order.indexOf(a.job) - order.indexOf(b.job));
    const sides = this.mission.sides || {}, split = list.some(v => sides[v.id] === 'e');
    // one group from the south; or a west and an east group closing in from both flanks
    const spot = (side, i) => {
      if (!split) return [27 + (i % 10), 58 + Math.floor(i / 10) * 1.3];
      const x0 = side === 'e' ? 58 : 3;
      return [x0 + (i % 3) * 1.2 * (side === 'e' ? 1 : -1) + (side === 'e' ? 0 : 2), 18 + Math.floor(i / 3) * 1.4];
    };
    const idx = { w: 0, e: 0 };
    list.forEach(v => {
      const side = sides[v.id] === 'e' ? 'e' : 'w', [cx, cz] = spot(side, idx[side]++);
      const w = this.grid.nearestWalkable(Math.round(cx), Math.round(cz), 4) || [Math.round(cx), Math.round(cz)], c = this.W(w[0], w[1]);
      this.makeUnit(0, v.job, c.x + (this.rand() - 0.5) * 0.4, c.z + (this.rand() - 0.5) * 0.4, { vid: v.id, name: v.name, side });
    });
    const ramsE = split ? Math.min(this.mission.ramsE || 0, this.mission.rams) : 0;
    for (let i = 0; i < this.mission.rams; i++) {
      const east = i < ramsE, [cx, cz] = split ? [east ? 57 : 6, 30 + (i % 2) * 3] : [29 + i * 3, 62];
      const w = this.grid.nearestWalkable(cx, cz, 4) || [cx, cz], c = this.W(w[0], w[1]);
      this.makeUnit(0, 'ram', c.x, c.z, { ram: true, side: east ? 'e' : 'w' });
    }
  }
  // Give every defender a job: sentry, spear line, reserve or guard.
  assignRoles() {
    const foes = this.units.filter(u => u.team === 1 && !u.post), gate = this.gate, keep = this.keep;
    const bx = this.box, gx = gate ? gate.x : this.W(Math.round((bx[0] + bx[2]) / 2), 0).x, gz = gate ? gate.z : this.W(0, bx[3]).z;
    const kx = keep ? keep.x : gx, kz = keep ? keep.z + 6 : gz - 10;
    const plain = foes.filter(u => u.type === 'enemy_ashigaru' || u.type === 'bandit' || u.type === 'outlaw'), shields = foes.filter(u => u.type === 'enemy_shield');
    // sentries walk a loop just inside the walls
    const nSentry = Math.min(plain.length, this.site.tier >= 3 && this.site.type !== 'smallcastle' ? 3 : 2);
    const spears = plain.slice(0, nSentry).concat(shields, plain.slice(nSentry));
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
    const force = this.mission.force || 8, n = Math.round(force), r = this.rand;
    const types = []; for (let i = 0; i < n; i++) types.push(i % 10 < 4 ? 'enemy_ashigaru' : i % 10 < 6 ? 'enemy_shield' : i % 10 < 9 ? 'enemy_archer' : 'enemy_samurai');
    if (this.site.tier >= 4 && n >= 12) types.push('enemy_lord');
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
  raiseAlarm(by, msg) {
    if (this.alarm) return;
    this.alarm = true; this.phase = 'alarm'; this.lastHitT = this.t;
    this.fx.push({ kind: 'banner', text: msg || 'Spotted! The war horn sounds — defenders to your posts!', t: 0 });
    if (by) this.fx.push({ kind: 'shout', x: by.x, z: by.z, y: (by.y || 0) + 2.9, text: '!', t: 0, cls: 'x' });
    for (const u of this.units) if (u.team === 1 && u.role !== 'post') { u.path = null; u.target = null; u.inv = null; u.st = 'alert'; }
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
    // soldiers chasing someone (or running away) pass through their own side's gates
    const G = this.grid, opened = [];
    if (u.aggro || u.fleeing || u.inv) for (const st of this.structs) if (st.def.gate && !st.dead && st.team === u.team) for (let cz = st.cz; cz < st.cz + st.d; cz++) for (let cx = st.cx; cx < st.cx + st.w; cx++) { const i = G.idx(cx, cz); if (!G.pass[i]) { G.pass[i] = 1; opened.push(i); } }
    // your troops told to go somewhere walled off walk as close as they can get
    const p = G.findPath({ x: u.x, z: u.z }, { x, z }, u.team === 0 && (u.order.kind === 'move' || u.order.kind === 'amove')); u.path = p; u.pathI = 0; u.repathT = 1.5;
    for (const i of opened) G.pass[i] = 0;
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
      if (u.post) { const s = this.structs[u.post - 1]; if (s.dead) { u.post = null; u.y = 0; u.hp -= u.maxHp * 0.4; if (u.hp <= 0) { this.kill(u); continue; } if (u.team === 1) { u.role = 'guard'; u.pos = { x: u.x, z: u.z }; u.holdR = 8; } } }
      u.thinkT -= dt;
      if (u.thinkT <= 0) { u.thinkT = u.team ? 0.4 + this.rand() * 0.3 : 0.25; this.think(u); }
      // pulled out of the fight, your soldiers bind their wounds: 6s without being hit and 4s without striking
      u.healing = u.team === 0 && !u.U.siege && u.hp < u.maxHp && this.t - (u.lastHurt ?? -99) > 6 && this.t - (u.lastStrike ?? -99) > 4;
      if (u.healing) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.015 * dt);
      this.act(u, dt);
    }
    this.separate();
    this.unstick();
    for (const a of this.arrows) {
      a.t += dt;
      if (a.t >= a.dur) {
        a.done = true; const T = a.target; if (T.dead) continue;
        // a shield turns the arrow aside when its bearer faces the shooter
        if (T.U && T.U.block && !T.isStruct) {
          const toShooter = Math.atan2(a.x0 - T.x, a.z0 - T.z), off = Math.abs(Math.atan2(Math.sin(toShooter - T.heading), Math.cos(toShooter - T.heading)));
          if (off < 1.7 && this.rand() < T.U.block) { this.fx.push({ kind: 'shout', x: T.x, z: T.z, y: 2.6, text: 'Blocked!', t: 0 }); if (!T.fleeing && !T.post) T.aggro = { u: a.from, until: this.t + 15 }; continue; }
        }
        this.damage(T, a.dmg, a.from);
      }
    }
    this.arrows = this.arrows.filter(a => !a.done);
    if (this.stones) { for (const s of this.stones) { s.t += dt; if (s.t >= s.dur) { s.done = true; this.noise(s.x, s.z); } } this.stones = this.stones.filter(s => !s.done); }
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
      const defenders = this.units.filter(o => o.team !== u.team && !o.dead && (o.y || 0) > 1 && Math.hypot(o.x - u.target.x, o.z - u.target.z) < 16).length;
      if (!defenders) continue;
      const res = u.team === 0 && this.rb('ramHp') ? 0.5 : 1;
      this.damage(u, 7 * HP_SCALE * defenders * res * dt, null);
      if (Math.random() < dt * 2) this.fx.push({ kind: 'dust', x: u.x, z: u.z, t: 0 });
    }
  }
  think(u) {
    if (u.team === 0) {
      if (u.order.kind === 'retreat' || u.climbing) return;
      if (u.order.kind === 'attack') { const t = u.order.target; if (t && !t.dead && !t.fled) { u.target = t; return; } u.order = { kind: 'idle' }; if (u.U.siege) { u.target = this.nearestTarget(u, 60); return; } }
      if (u.order.kind === 'move' && u.path) return;
      if (u.noReachT > this.t) return;
      // your troops only strike on their own when the enemy knows you're here, or when they're told to
      const range = u.order.kind === 'hold' || u.post ? u.S.range + ((u.y || 0) > 1 ? 5 : 0) + 0.5 : u.U.siege ? 16 : u.U.ranged ? u.S.range + 2 : 12;
      u.target = (this.alarm || this.defend) ? this.nearestTarget(u, range) : null;
      if (!u.target && u.order.kind === 'amove' && !u.path) this.pathTo(u, u.order.x, u.order.z);
      return;
    }
    if (this.defend) return this.thinkAttacker(u);
    // defenders
    if (u.fleeing) return;
    const dt = Math.min(1, this.t - (u.lastThink ?? this.t)); u.lastThink = this.t;
    this.watch(u, dt);
    if (this.chaseAggro(u)) return;
    if (u.post) { u.target = this.nearestTarget(u, u.S.range + ((u.y || 0) > 1 ? 5 : 0)); return; }
    if (!this.alarm) return this.calm(u);
    u.walkSlow = false; u.st = 'alert'; u.inv = null;
    this.maybeSally(u);
    if (this.chaseAggro(u)) return;
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
    if (this.chaseAggro(u)) return;
    const gate = this.gate, breached = !gate || gate.dead || this.structs.some(s => (s.type === 'wall' || s.type === 'palisade') && s.dead);
    if (u.U.siege) { u.target = gate && !gate.dead ? gate : this.units.filter(o => o.team === 0 && !o.dead && o.post).map(o => this.structs[o.post - 1]).find(s => s && !s.dead) || this.nearestStruct(u); return; }
    if (u.U.ranged) { u.target = this.nearestTarget(u, u.S.range + 2); if (!u.target && !u.path) { const g = gate || this.W(32, this.box[3]); this.pathTo(u, g.x + (this.rand() - 0.5) * 14, g.z + 13); } return; }
    if (!breached && this.t < 60) {
      u.target = this.nearestTarget(u, 3);
      if (!u.target && !u.path) { const g = gate || this.W(32, this.box[3]); this.pathTo(u, g.x + (this.rand() - 0.5) * 12, g.z + 9); }
      return;
    }
    u.target = u.noReachT > this.t ? null : this.nearestTarget(u, 60);
    // nobody to reach: batter the gate if it stands, else bring down what the defenders stand on
    if (!u.target && gate && !gate.dead) u.target = gate;
    // defenders out of reach up on the towers and walls: bring down what they stand on
    if (!u.target) { const perch = this.units.filter(o => o.team === 0 && !o.dead && !o.fled && o.post).map(o => this.structs[o.post - 1]).filter(s => s && !s.dead).sort((a, b) => Math.hypot(a.x - u.x, a.z - u.z) - Math.hypot(b.x - u.x, b.z - u.z))[0]; if (perch) u.target = perch; }
    if (!u.target && !breached) u.target = gate && !gate.dead ? gate : this.nearestStruct(u);
  }
  /* ---------- keeping watch (before the alarm) ---------- */
  // how fast defender e grows sure he sees player unit o (per second); 0 = he doesn't see him
  seeing(e, o) {
    const d = Math.hypot(o.x - e.x, o.z - e.z), high = (e.y || 0) > 1.5;
    let sight = high ? SIGHT.high : SIGHT.ground;
    if (this.alarm) sight = Math.max(sight, SIGHT.alert);
    if (e.st === 'suspicious' || e.st === 'investigate') sight *= 1.25; // eyes wide open
    if (o.sneak) sight *= 0.5;
    if (o.hidden) sight = Math.min(sight, SIGHT.bush);
    if (d > sight || !this.lineOfSight(e, o)) return 0;
    if (!high && !this.alarm && d > (o.sneak ? HEAR / 2 : HEAR) && !this.inCone(e, o.x, o.z)) return 0;
    const near = 1 - d / sight;
    return (o.sneak ? 0.16 : 0.3) * (1 + 6 * near * near) * (o.moving ? 1.25 : 0.8) * (e.st === 'suspicious' ? 1.6 : 1);
  }
  inCone(e, x, z) { const dir = Math.atan2(x - e.x, z - e.z); return Math.abs(Math.atan2(Math.sin(dir - e.heading), Math.cos(dir - e.heading))) <= FOV / 2; }
  seesPoint(e, x, z) { const d = Math.hypot(x - e.x, z - e.z), high = (e.y || 0) > 1.5; return d <= (high ? SIGHT.high : SIGHT.ground) && (high || this.inCone(e, x, z)) && this.lineOfSight(e, { x, z }); }
  watch(u, dt) {
    let seen = null, best = 0;
    for (const o of this.units) {
      if (o.team !== 0 || o.dead || o.fled) continue;
      const v = this.seeing(u, o); if (!v) continue;
      if (this.alarm) { o.spotted = this.t; continue; }
      if (v > best) { best = v; seen = o; }
    }
    if (this.alarm) return;
    if (seen) {
      u.sus = Math.min(1.2, (u.sus || 0) + best * dt);
      u.lastSeen = { x: seen.x, z: seen.z, t: this.t };
      if (u.sus >= 1) { seen.spotted = this.t; this.raiseAlarm(u); return; }
      if (u.sus >= 0.3 && u.st !== 'suspicious' && !u.post) { this.setState(u, 'suspicious', '?'); u.path = null; }
    } else u.sus = Math.max(0, (u.sus || 0) - 0.1 * dt);
    // a friend lying dead
    if (!u.post && !(u.inv && u.inv.body)) for (const o of this.units) {
      if (o.team !== 1 || !o.dead || o.found || !this.seesPoint(u, o.x, o.z)) continue;
      o.found = true; u.inv = { x: o.x, z: o.z, body: true }; this.setState(u, 'investigate', '?'); u.path = null; break;
    }
  }
  setState(u, st, mark) { u.st = st; if (mark) this.fx.push({ kind: 'shout', x: u.x, z: u.z, y: (u.y || 0) + 2.9, text: mark, t: 0, cls: mark === '?' ? 'q' : '' }); }
  // before the alarm: patrol, stand watch, stare, go and look
  calm(u) {
    u.target = null;
    if (u.st === 'distracted') { u.path = null; if (this.t > u.distractT) u.st = 'calm'; return; }
    if (u.st === 'suspicious') {
      const L = u.lastSeen; u.path = null;
      if (L) u.lookAt = Math.atan2(L.x - u.x, L.z - u.z);
      if (!L || this.t - L.t > 1.5) { if (L) { u.inv = { x: L.x, z: L.z }; this.setState(u, 'investigate'); } else u.st = 'calm'; }
      return;
    }
    if (u.st === 'investigate' && u.inv) {
      const I = u.inv; u.walkSlow = false;
      if (!I.arrived) {
        if (Math.hypot(I.x - u.x, I.z - u.z) < 1.8) { I.arrived = this.t; u.path = null; if (I.body) { this.raiseAlarm(u, 'A body is found — the alarm is raised!'); return; } }
        else { if (!u.path) { this.pathTo(u, I.x, I.z); if (!u.path) I.arrived = this.t; } return; }
      }
      if (!u.scanT || this.t > u.scanT) { u.scanT = this.t + 1.3; u.lookAt = u.heading + (this.rand() - 0.5) * 3.2; }
      if (this.t - I.arrived > 5) { u.inv = null; u.st = 'calm'; u.sus = Math.min(u.sus || 0, 0.15); this.fx.push({ kind: 'shout', x: u.x, z: u.z, y: 2.9, text: '…', t: 0 }); if (u.role === 'sentry') u.pauseT = 0; else this.pathTo(u, u.home.x, u.home.z); }
      return;
    }
    // sentries walk their round and pause at each corner to look about
    if (u.role === 'sentry') {
      if (!u.path) {
        if (!u.pauseT) { u.pauseT = this.t + 1.5 + this.rand() * 1.5; u.lookAt = u.heading + (this.rand() < 0.5 ? -1 : 1) * (0.8 + this.rand() * 0.7); }
        else if (this.t > u.pauseT) { u.pauseT = 0; u.routeI = (u.routeI + 1) % u.route.length; const p = u.route[u.routeI]; this.pathTo(u, p.x, p.z); u.walkSlow = true; }
      }
      return;
    }
    // the rest stand where they are, gazing out and now and then looking round
    const p = u.home;
    if (p && Math.hypot(u.x - p.x, u.z - p.z) > 1.2) { if (!u.path) this.pathTo(u, p.x, p.z); return; }
    if (!u.scanT || this.t > u.scanT) { u.scanT = this.t + 3 + this.rand() * 4; u.lookAt = this.outward(u) + (this.rand() - 0.5) * 2.4; }
  }
  outward(u) { const b = this.box, c = this.W(Math.round((b[0] + b[2]) / 2), Math.round((b[1] + b[3]) / 2)); return Math.atan2(u.x - c.x, u.z - c.z); }
  // a noise (a thrown stone): calm defenders nearby turn to look; one or two go to check
  noise(x, z, r = 16) {
    this.fx.push({ kind: 'shout', x, z, y: 0.9, text: '*clack*', t: 0 });
    if (this.alarm) return;
    const near = this.units.filter(u => u.team === 1 && !u.dead && !u.fled && Math.hypot(u.x - x, u.z - z) < r).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    let sent = 0;
    for (const u of near) {
      u.lookAt = Math.atan2(x - u.x, z - u.z); u.scanT = this.t + 5; u.sus = Math.max(u.sus || 0, 0.2);
      if (!u.post && sent < 2 && u.st !== 'investigate' && u.st !== 'suspicious') { u.inv = { x: x + (this.rand() - 0.5) * 2, z: z + (this.rand() - 0.5) * 2 }; u.pauseT = 0; u.path = null; this.setState(u, 'investigate', '?'); sent++; }
      else if (u.st === 'calm' || !u.st) { u.distractT = this.t + 4 + this.rand() * 2; this.setState(u, 'distracted', '?'); }
    }
  }
  // your soldier throws a stone to draw the guards' eyes (and feet) away
  distract(units, p) {
    const d = u => Math.hypot(u.x - p.x, u.z - p.z);
    const u = units.filter(o => !o.dead && !o.fled && !o.U.siege && o.team === 0 && (o.distractCd || 0) <= this.t).sort((a, b) => d(a) - d(b))[0];
    if (!u) return 'busy';
    if (d(u) > 26) return 'far';
    u.distractCd = this.t + 8; u.swing = 0.5; u.heading = Math.atan2(p.x - u.x, p.z - u.z);
    this.stones = this.stones || [];
    this.stones.push({ x0: u.x, z0: u.z, y0: (u.y || 0) + 1.6, x: p.x, z: p.z, t: 0, dur: 0.3 + d(u) / 28 });
    return 'ok';
  }
  /* ---------- after the alarm ---------- */
  // a lone attacker or two out in the open tempts a few defenders out through the gate
  maybeSally(u) {
    if (u.aggro || u.post || u.role === 'reserve' || u.U.ranged || this.phase === 'fallback' || u.sallyT > this.t) return;
    if (this.units.filter(o => o.sally && !o.dead && !o.fled).length >= 3) return;
    const pos = u.pos || u.home;
    for (const o of this.units) {
      if (o.team !== 0 || o.dead || o.fled || o.U.siege || !this.known(o) || this.inside(o.x, o.z)) continue;
      if (Math.hypot(o.x - pos.x, o.z - pos.z) > 26 || !this.canHit(u, o)) continue;
      const friends = this.units.filter(f => f.team === 0 && !f.dead && !f.fled && this.known(f) && Math.hypot(f.x - o.x, f.z - o.z) < 10).length;
      if (friends > 2) continue;
      u.sally = true; u.aggro = { u: o, until: this.t + 20 };
      this.fx.push({ kind: 'shout', x: u.x, z: u.z, y: 2.9, text: 'After them!', t: 0 });
      return;
    }
  }
  // a broken wall draws the nearest men to plug the breach
  plugBreach(s) {
    const b = this.box, c = this.W(Math.round((b[0] + b[2]) / 2), Math.round((b[1] + b[3]) / 2));
    const dx = c.x - s.x, dz = c.z - s.z, d = Math.hypot(dx, dz) || 1, p = { x: s.x + dx / d * 3.5, z: s.z + dz / d * 3.5 };
    const men = this.units.filter(u => u.team === 1 && !u.dead && !u.fled && !u.post && !u.U.ranged && !u.fleeing).sort((a, b2) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b2.x - p.x, b2.z - p.z)).slice(0, 4);
    for (const u of men) { u.pos = { x: p.x + (this.rand() - 0.5) * 3, z: p.z + (this.rand() - 0.5) * 3 }; u.holdR = 5; u.path = null; u.target = null; }
    if (men.length) this.fx.push({ kind: 'banner', text: 'They rush to plug the breach!', t: 0 });
  }
  // someone hit this soldier: go after them (for a while, and not too far from where he stands)
  chaseAggro(u) {
    const A = u.aggro; if (!A) return false;
    const a = A.u, P = u.pos || u.home;
    if (a.dead || a.fled || this.t > A.until || Math.hypot(a.x - u.x, a.z - u.z) > 45 || (P && Math.hypot(u.x - P.x, u.z - P.z) > 38) || !this.canHit(u, a)) {
      u.aggro = null; if (u.sally) { u.sally = false; u.sallyT = this.t + 12; } return false;
    }
    if (!this.alarm && !this.defend) this.raiseAlarm(u);
    u.target = a; u.walkSlow = false;
    return true;
  }
  nearestStruct(u) {
    let best = null, bd = Infinity;
    for (const s of this.structs) { if (s.dead || !s.maxHp || s.def.keep) continue; const d = Math.hypot(s.x - u.x, s.z - u.z); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  nearestTarget(u, range) {
    let best = null, bd = Infinity;
    if (u.U.siege) {
      // a ram goes for the nearest gate it can actually get to (through any gap already made); only failing that, the nearest wall
      const gates = this.structs.filter(s => !s.dead && s.def.gate && s.team !== u.team).sort((a, b) => Math.hypot(a.x - u.x, a.z - u.z) - Math.hypot(b.x - u.x, b.z - u.z));
      for (const gt of gates) {
        const dx = u.x - gt.x, dz = u.z - gt.z, d = Math.hypot(dx, dz) || 1, R = structRadius(gt) + u.r + 0.6;
        const p = this.grid.findPath({ x: u.x, z: u.z }, { x: gt.x + dx / d * R, z: gt.z + dz / d * R }), end = p && p[p.length - 1];
        if (end && Math.hypot(end.x - gt.x, end.z - gt.z) <= R + 2.5) return gt;
      }
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
      if (d >= range) continue;
      if (u.team === 1 && o.buffs.taunt) d -= 25;
      if (u.U.ranged && o.U.siege) d += 40;   // arrows barely scratch a ram: shoot the men first
      if (d < bd) { bd = d; best = o; }
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
    if (u.team === 1 && u.lookAt != null && !u.path && !u.target) { const diff = Math.atan2(Math.sin(u.lookAt - u.heading), Math.cos(u.lookAt - u.heading)); u.heading += Math.sign(diff) * Math.min(Math.abs(diff), dt * 1.8); }
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
        if (!u.path || (end && Math.hypot(end.x - t.x, end.z - t.z) > (t.isStruct ? structRadius(t) + 3 : 4))) {
          const wall = u.U.siege && this.blockerToward(u, t);
          if (wall && wall !== t) { u.target = wall; if (u.order.kind === 'attack') u.order = { kind: 'attack', target: wall }; u.path = null; u.repathT = 0; return; }
          u.target = null; u.path = null; u.aggro = null; u.noReachT = this.t + 2.5; if (u.order.kind === 'attack') u.order = { kind: 'idle' }; return; }
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
    u.lastStrike = this.t;
    let dmg = u.S.dmg * (u.buffs.rally ? 1.2 : 1);
    // a silent takedown: creeping up on a man who hasn't seen you, from behind
    if (u.team === 0 && t.team === 1 && !this.alarm && !this.defend && !t.isStruct && !u.U.ranged && !u.U.siege && (u.sneak || u.hidden) && t.st !== 'suspicious' && !this.inCone(t, u.x, u.z)) {
      const big = t.type === 'enemy_samurai' || t.type === 'enemy_lord';
      this.fx.push({ kind: 'shout', x: t.x, z: t.z, y: 2.6, text: big ? 'Ambush!' : 'Silent takedown', t: 0 });
      this.damage(t, big ? t.maxHp * 0.5 : t.hp + 1, u); u.swing = 0.35;
      if (!t.dead) { t.sus = 1.2; this.raiseAlarm(t); }
      return;
    }
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
      if ((u.y || 0) > 1) dmg *= 1.5;   // shooting down from a wall or tower
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
    if (from && !from.isStruct && this.inside(t.x, t.z) && t.team === (this.defend ? 0 : 1) && !this.inside(from.x, from.z)) dmg *= FORTIFIED; // behind their own walls
    if (t.team === 0 && t.type === 'ashigaru' && t.order.kind === 'hold') dmg *= 1 - this.rb('spearWall');
    if (t.U.arrowResist && from && from.U.ranged) dmg *= t.U.arrowResist;
    t.hp -= dmg; t.hitT = 0.25; t.lastHurt = this.t; this.lastHitT = this.t;
    if (from && !from.isStruct && from.team !== t.team) {
      const d = Math.hypot(from.x - t.x, from.z - t.z);
      // being hit gives the attacker away — unless they shoot from a bush far off
      if (from.team === 0 && (!from.hidden || d < 8)) from.spotted = this.t;
      // struck foot soldiers fight back; shot at from afar, they charge the shooter
      if (t.team === 1 && !t.U.ranged && !t.U.siege && !t.post && !t.fleeing && (!from.hidden || d < 10) && this.canHit(t, from)) t.aggro = { u: from, until: this.t + 15 };
      // ...and call the men beside them
      if (t.team === 1 && this.alarm && (!from.hidden || d < 10)) {
        let n = 0;
        for (const f of this.units) if (n < 2 && f.team === 1 && f !== t && !f.dead && !f.fled && !f.post && !f.aggro && !f.U.ranged && f.role !== 'reserve' && Math.hypot(f.x - t.x, f.z - t.z) < 8 && this.canHit(f, from)) { f.aggro = { u: from, until: this.t + 10 }; n++; }
      }
    }
    if (t.hp <= 0) {
      this.kill(t);
      if (from && from.type === 'berserker' && from.team === 0 && this.rb('bloodlust')) from.hp = Math.min(from.maxHp, from.hp + from.maxHp * 0.12);
    }
  }
  kill(u) {
    u.dead = true; u.hp = 0; u.deadT = 0; u.path = null;
    if (u.team === 1 && !this.over) {
      const alive = this.units.filter(o => o.team === 1 && !o.dead && !o.fled).length;
      const onlyBows = alive > 0 && !this.units.some(o => o.team === 1 && !o.dead && !o.fled && !o.U.ranged && !o.U.siege);
      if ((alive <= Math.ceil(this.initialEnemies * 0.22) || onlyBows) && alive > 0 && !this.routed) this.rout('The enemy breaks and runs!');
    }
  }
  // the enemy gives up: everyone climbs down and runs for the edge of the field
  rout(text) {
    this.routed = true; this.fx.push({ kind: 'banner', text, t: 0 });
    for (const o of this.units) if (o.team === 1 && !o.dead) { o.fleeing = true; o.post = null; o.y = 0; o.target = null; o.aggro = null; this.pathTo(o, o.x, this.defend ? BATTLE_ORIGIN.z + HALF - 2 : BATTLE_ORIGIN.z - HALF + 2); o.order = { kind: 'retreat' }; }
  }
  destroy(s) {
    s.dead = true; s.hp = 0; s.collapse = 0;
    if (!this.defend && s.team === 1 && ['wall', 'palisade', 'gate', 'pgate'].includes(s.type)) { if (!this.alarm) this.raiseAlarm(null, 'The crash of timber — the alarm is raised!'); this.plugBreach(s); }
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
  // the first enemy wall, gate or tower on the straight line from u towards t
  blockerToward(u, t) {
    const dx = t.x - u.x, dz = t.z - u.z, d = Math.hypot(dx, dz);
    for (let k = 1; k < d; k += 0.8) { const s = this.structAt(u.x + dx * k / d, u.z + dz * k / d); if (s && !s.dead && s.def.blocks && s.team !== u.team && s.maxHp) return s; }
    return null;
  }
  // a soldier on the ground who has ended up inside a wall, tower or shut gate steps out to the nearest open ground
  unstick() {
    for (const u of this.units) {
      if (u.dead || u.fled || u.post || u.climbing || (u.y || 0) > 1 || u.U.siege) continue;
      const s = this.structAt(u.x, u.z);
      if (!s || !s.def.blocks || s.dead) { u.inWallT = 0; continue; }
      if (s.def.gate && s.team === u.team && u.path) continue;          // walking out through his own gate
      u.inWallT = (u.inWallT || 0) + 1; if (u.inWallT < 6) continue;
      const w = this.grid.nearestWalkable(...this.cellOf(u.x, u.z), 4);
      if (w) { const c = this.W(w[0], w[1]); u.x = c.x; u.z = c.z; u.path = null; u.repathT = 0; }
      u.inWallT = 0;
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
    for (const f of foes) if (f.fleeing) {
      this.escape(f);
      // a man running for it with nowhere to go simply gets away
      if (!f.path) { f.noPathT = (f.noPathT || 0) + dt; if (f.noPathT > 4) { f.fled = true; f.obj.visible = false; } } else f.noPathT = 0;
    }
    // neither side can get at the other: after 40s without a blow the weaker side gives up
    if (this.alarm && !this.routed && this.t - (this.lastHitT ?? this.t) > 40) {
      const fightingNow = foes.filter(f => !f.fleeing);
      if (mine.length >= fightingNow.length) this.rout(this.defend ? 'The attackers give up and withdraw!' : 'The last defenders lay down their arms!');
      else { this.fx.push({ kind: 'banner', text: 'Neither side can reach the other — your men pull back', t: 0 }); this.retreat(); }
      this.lastHitT = this.t;
    }
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
    // what the enemy can see (shown before the alarm, so you can plan a sneak): all sight circles merged
    // into one zone with a single outline, painted on a canvas laid over the battlefield
    const px = 4, size = N * CELL;
    this.sight = { px, size, canvas: document.createElement('canvas'), layer: document.createElement('canvas'), t: 0 };
    this.sight.canvas.width = this.sight.canvas.height = this.sight.layer.width = this.sight.layer.height = size * px;
    this.sight.tex = new THREE.CanvasTexture(this.sight.canvas); this.sight.tex.colorSpace = THREE.SRGBColorSpace;
    const sg = new THREE.PlaneGeometry(size, size); sg.rotateX(-Math.PI / 2);
    this.sightMesh = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: this.sight.tex, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
    this.sightMesh.position.y = 0.12; this.sightMesh.renderOrder = 2; this.root.add(this.sightMesh);
  }
  animate(dt) {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), camQ = this.ctx.stage.camera.quaternion, c = new THREE.Color();
    let bars = 0, hidden = 0;
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
    this.drawSight(dt);
    let k = 0;
    for (const s of this.stones || []) {
      if (k >= 300) break;
      const f = s.t / s.dur, x = s.x0 + (s.x - s.x0) * f, z = s.z0 + (s.z - s.z0) * f, y = s.y0 * (1 - f) + 0.2 * f + Math.sin(f * Math.PI) * 2.5;
      m4.compose(new THREE.Vector3(x - BATTLE_ORIGIN.x, y, z - BATTLE_ORIGIN.z), q.identity(), new THREE.Vector3(1.4, 1.4, 0.18)); this.arrowMesh.setMatrixAt(k++, m4);
    }
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
  // paint the enemy's sight: one soft zone, one outline around its edge
  drawSight(dt) {
    const S = this.sight, show = !this.alarm && !this.defend;
    this.sightMesh.visible = show;
    if (!show || (S.t -= dt) > 0) return;
    S.t = 0.1;
    // towers see all round; men on the ground see a wedge ahead of them and hear a little way behind
    const shapes = this.units.filter(u => u.team === 1 && !u.dead && !u.fled).map(u => {
      const x = (u.x - BATTLE_ORIGIN.x + S.size / 2) * S.px, z = (u.z - BATTLE_ORIGIN.z + S.size / 2) * S.px, high = (u.y || 0) > 1.5;
      const r = (high ? SIGHT.high : SIGHT.ground) * (u.st === 'suspicious' || u.st === 'investigate' ? 1.25 : 1) * S.px;
      return { x, z, r, cone: !high, a: Math.PI / 2 - u.heading };
    });
    const W = S.canvas.width, c = S.canvas.getContext('2d'), l = S.layer.getContext('2d');
    const union = (ctx, grow, color) => {
      ctx.fillStyle = color; ctx.beginPath();
      for (const s of shapes) {
        const r = Math.max(1, s.r + grow);
        if (!s.cone) { ctx.moveTo(s.x + r, s.z); ctx.arc(s.x, s.z, r, 0, Math.PI * 2); continue; }
        const h = Math.max(1, HEAR * S.px + grow), off = grow < 0 ? -grow * 1.4 : 0;
        ctx.moveTo(s.x + Math.cos(s.a) * off, s.z + Math.sin(s.a) * off); ctx.arc(s.x, s.z, r, s.a - FOV / 2, s.a + FOV / 2); ctx.closePath();
        ctx.moveTo(s.x + h, s.z); ctx.arc(s.x, s.z, h, 0, Math.PI * 2);
      }
      ctx.fill('nonzero');
    };
    c.clearRect(0, 0, W, W);
    // soft fill of everything they can see
    l.globalCompositeOperation = 'source-over'; l.clearRect(0, 0, W, W); union(l, 0, '#e8452e');
    c.globalAlpha = 0.2; c.drawImage(S.layer, 0, 0);
    // the outline: the union minus a slightly smaller union
    l.clearRect(0, 0, W, W); union(l, 0, '#e8452e'); l.globalCompositeOperation = 'destination-out'; union(l, -1.4 * S.px / 2, '#000');
    c.globalAlpha = 0.85; c.drawImage(S.layer, 0, 0); c.globalAlpha = 1;
    S.tex.needsUpdate = true;
  }
  dispose() {
    if (this.sight) this.sight.tex.dispose();
    this.scene.remove(this.root);
    this.root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  results() {
    const alive = this.units.filter(u => u.team === 0 && !u.dead);
    return { survivors: alive.filter(u => u.vid).map(u => u.vid), rams: alive.filter(u => u.ram).length, dead: this.units.filter(u => u.team === 0 && u.dead && u.vid).map(u => u.name),
      health: Object.fromEntries(alive.filter(u => u.vid).map(u => [u.vid, u.hp / u.maxHp])) };
  }
}
function structRadius(s) { return Math.max(s.w, s.d) * CELL / 2; }
