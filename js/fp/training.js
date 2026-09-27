// The training yard of the first-person preview: straw dummies to cut, a sparring post that strikes back
// (to learn blocking and parrying), a weapon rack, a fence, and a dojo and houses from the village.
import * as THREE from 'three';
import { Mesher, MAT } from '../render/geo.js';
import { buildModel } from '../render/buildings.js';
import { mulberry32, clamp, lerp } from '../util.js';

const STRAW = '#cdb27a', STRAW_D = '#a88a52', WOOD = '#5a3a28', WOOD_D = '#3b2619', ROPE = '#8a6a3a';
const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), AX = new THREE.Vector3(1, 0, 0);

// straw bits flying off a hit
export class Chaff {
  constructor(parent, color = STRAW, size = 1) {
    this.g = new THREE.BoxGeometry(0.03 * size, 0.12 * size, 0.02 * size); this.items = [];
    this.mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    for (let i = 0; i < 28; i++) { const m = new THREE.Mesh(this.g, this.mat); m.visible = false; parent.add(m); this.items.push({ m, v: new THREE.Vector3(), t: 0 }); }
    this.k = 0;
  }
  burst(x, y, z, n = 8, dirX = 0, dirZ = 0) {
    for (let i = 0; i < n; i++) {
      const it = this.items[this.k++ % this.items.length];
      it.m.position.set(x, y, z); it.m.visible = true; it.t = 0.9 + Math.random() * 0.5;
      it.v.set(dirX * 2 + (Math.random() - 0.5) * 3, 1.5 + Math.random() * 2.5, dirZ * 2 + (Math.random() - 0.5) * 3);
      it.m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    }
  }
  update(dt) {
    for (const it of this.items) if (it.m.visible) {
      it.t -= dt; if (it.t <= 0) { it.m.visible = false; continue; }
      it.v.y -= 9 * dt; it.m.position.addScaledVector(it.v, dt); it.m.rotation.x += dt * 8;
      if (it.m.position.y < it.floor) { it.m.position.y = it.floor; it.v.set(0, 0, 0); }
    }
  }
}

export class StrawDummy {
  constructor(x, z, y, parent) {
    this.x = x; this.z = z; this.y = y; this.r = 0.34; this.h = 1.8; this.kind = 'dummy';
    this.maxHp = 150; this.hp = this.maxHp; this.tilt = 0; this.tiltV = 0; this.tiltDir = 0; this.down = 0; this.strikes = 0;
    const m = new Mesher(Math.round(x * 13 + z), 0.08);
    m.cyl(0.07, 0.08, 1.9, 6, WOOD, [0, 0.95, 0]);
    m.cyl(0.26, 0.3, 0.95, 8, STRAW, [0, 1.0, 0]); m.cyl(0.3, 0.2, 0.2, 8, STRAW_D, [0, 0.45, 0]);
    for (const y of [0.7, 1.05, 1.35]) m.cyl(0.285, 0.285, 0.05, 8, ROPE, [0, y, 0]);
    m.ball(0.2, STRAW, [0, 1.68, 0], [1, 1.15, 1]); m.cyl(0.21, 0.21, 0.04, 8, ROPE, [0, 1.58, 0]);
    m.box(1.1, 0.07, 0.07, WOOD, [0, 1.3, 0]); for (const sx of [-1, 1]) m.cyl(0.08, 0.1, 0.3, 6, STRAW, [sx * 0.55, 1.3, 0], [0, 0, Math.PI / 2]);
    m.cyl(0.22, 0.28, 0.12, 8, '#8a857a', [0, 0.06, 0]);
    this.mesh = m.mesh(); this.pivot = new THREE.Group(); this.pivot.add(this.mesh); this.pivot.position.set(x, y, z); parent.add(this.pivot);
  }
  onHit(h) {
    if (this.down > 0) return null;
    this.hp -= h.dmg; this.strikes++;
    this.tiltV += (h.heavy ? 2.4 : 1.3) * (h.dir === 'u' ? 0.6 : 1); this.tiltDir = Math.atan2(h.fx, h.fz);
    let text = null;
    if (this.hp <= 0) { this.down = 3.5; text = `Cut down in ${this.strikes} strike${this.strikes > 1 ? 's' : ''}`; }
    return { sound: 'thud', chaff: h.heavy ? 14 : 8, text };
  }
  onKick(h) { if (this.down > 0) return null; this.tiltV += 2.8; this.tiltDir = Math.atan2(h.fx, h.fz); return { sound: 'kick', chaff: 4 }; }
  update(dt) {
    if (this.down > 0) {
      this.down -= dt; this.tilt = lerp(this.tilt, 1.45, 1 - Math.exp(-6 * dt));
      if (this.down <= 0) { this.hp = this.maxHp; this.strikes = 0; this.tilt = 0.6; this.tiltV = 0; }
    } else {
      // a sprung post: it swings back and settles
      this.tiltV += (-this.tilt * 38 - this.tiltV * 5) * dt; this.tilt += this.tiltV * dt;
    }
    this.pivot.rotation.set(Math.cos(this.tiltDir) * this.tilt * 0.35, 0, -Math.sin(this.tiltDir) * this.tilt * 0.35, 'YXZ');
    if (this.down > 0) this.pivot.rotation.set(Math.cos(this.tiltDir) * this.tilt, 0, -Math.sin(this.tiltDir) * this.tilt);
  }
}

// the sparring post: a padded arm that telegraphs a strike from your left, your right or overhead,
// then swings. Block the right side, parry it at the last moment, or dodge. Heavy swings can't be blocked.
export class SparringPost {
  constructor(x, z, y, parent, diff = 'normal') {
    this.x = x; this.z = z; this.y = y; this.r = 0.3; this.h = 1.9; this.kind = 'post';
    this.setDifficulty(diff);
    this.state = 'idle'; this.t = 0; this.wait = 2; this.dir = 'l'; this.heavy = false; this.face = 0; this.hitsLanded = 0;
    const base = new Mesher(91, 0.06);
    base.cyl(0.5, 0.6, 0.25, 8, '#8a857a', [0, 0.12, 0]); base.cyl(0.11, 0.13, 1.65, 7, WOOD_D, [0, 0.95, 0]);
    base.cyl(0.24, 0.26, 0.8, 8, '#e8e0cc', [0, 1.05, 0]); for (const y of [0.75, 1.35]) base.cyl(0.25, 0.25, 0.05, 8, '#b8342a', [0, y, 0]);
    this.root = new THREE.Group(); this.root.position.set(x, y, z); parent.add(this.root);
    this.root.add(base.mesh());
    this.head = new THREE.Group(); this.head.position.y = 1.7; this.root.add(this.head);
    const hm = new Mesher(92, 0.06); hm.cyl(0.16, 0.16, 0.24, 8, WOOD, [0, 0, 0]); hm.box(0.36, 0.18, 0.05, '#e8e0cc', [0, 0.02, 0.15]); hm.box(0.26, 0.04, 0.01, '#1c1c1f', [0, 0.05, 0.18]);
    this.head.add(hm.mesh());
    // the arm: along +x from the pivot, a padded pole
    this.arm = new THREE.Group(); this.head.add(this.arm);
    const am = new Mesher(93, 0.05); am.cyl(0.035, 0.035, 1.3, 6, '#6b4a33', [0.65, 0, 0], [0, 0, Math.PI / 2]); am.cyl(0.1, 0.1, 0.4, 8, '#e8e0cc', [1.12, 0, 0], [0, 0, Math.PI / 2]);
    this.arm.add(am.mesh());
    this.glint = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff3b2a', transparent: true, opacity: 0, depthWrite: false }));
    this.glint.position.x = 1.3; this.arm.add(this.glint);
    this.armDir = new THREE.Vector3(0.3, -0.8, 0.5).normalize(); this.setArm(this.armDir);
  }
  setDifficulty(d) { this.diff = d; this.tell = { easy: 0.75, normal: 0.55, hard: 0.4 }[d] || 0.55; this.heavyChance = { easy: 0.1, normal: 0.2, hard: 0.3 }[d] || 0.2; }
  setArm(dir) { _v.copy(dir).normalize(); this.arm.quaternion.setFromUnitVectors(AX, _v); }
  // arm directions in the post's frame (it faces +z, toward you): your left is its −x
  static dirs(d) {
    if (d === 'l') return [new THREE.Vector3(-1, 0.55, 0.15), new THREE.Vector3(1, -0.1, 0.7)];
    if (d === 'r') return [new THREE.Vector3(1, 0.55, 0.15), new THREE.Vector3(-1, -0.1, 0.7)];
    return [new THREE.Vector3(0.1, 1, -0.2), new THREE.Vector3(0.05, -0.45, 1)];
  }
  onHit(h) {
    this.hitsLanded++;
    if (this.state === 'tell') { this.state = 'stagger'; this.t = 0; this.stagFor = 1.0; return { sound: 'thud', chaff: 0, text: 'Interrupted! A strike during its wind-up stops it.' }; }
    return { sound: 'thud', chaff: 0 };
  }
  onKick() { if (this.state === 'tell') { this.state = 'stagger'; this.t = 0; this.stagFor = 1.1; return { sound: 'kick', text: 'Kicked out of its swing!' }; } return { sound: 'kick' }; }
  parried() { this.state = 'stagger'; this.t = 0; this.stagFor = 1.5; }
  // fp: { px, pz, dist, strike(post, attack) }
  update(dt, fp) {
    this.t += dt;
    const dx = fp.px - this.x, dz = fp.pz - this.z, dist = Math.hypot(dx, dz);
    // turn to face you (not instantly: you can step around it)
    const want = Math.atan2(dx, dz); let dd = want - this.face; while (dd > Math.PI) dd -= Math.PI * 2; while (dd < -Math.PI) dd += Math.PI * 2;
    this.face += clamp(dd, -2.6 * dt, 2.6 * dt); this.root.rotation.y = this.face;
    const [from, to] = SparringPost.dirs(this.dir);
    const G = this.glint.material;
    switch (this.state) {
      case 'idle': {
        this.setArm(_v.lerpVectors(this.armDir, new THREE.Vector3(0.3, -0.8, 0.5), Math.min(1, this.t * 4)));
        G.opacity = 0;
        if (dist < 3.2 && this.t > this.wait) {
          this.state = 'tell'; this.t = 0; this.dir = ['l', 'r', 'u'][Math.floor(Math.random() * 3)]; this.heavy = Math.random() < this.heavyChance;
          G.color.set(this.heavy ? '#ffb13b' : '#ff3b2a');
        }
        break;
      }
      case 'tell': {
        const tell = this.tell * (this.heavy ? 1.35 : 1), k = Math.min(1, this.t / (tell * 0.6));
        this.setArm(this.armDir.set(0.3, -0.8, 0.5).lerp(from, k));
        G.opacity = fp.showCue ? Math.min(1, this.t / tell) * (0.55 + 0.45 * Math.sin(this.t * 40)) : 0;
        this.glint.scale.setScalar(this.heavy ? 1.5 : 1);
        if (this.t >= tell) { this.state = 'swing'; this.t = 0; this.resolved = false; }
        break;
      }
      case 'swing': {
        const k = Math.min(1, this.t / 0.16);
        this.armDir.copy(from).lerp(to, k); this.setArm(this.armDir); G.opacity = 0;
        if (!this.resolved && this.t >= 0.08) {
          this.resolved = true;
          // it reaches you if you're close and in front of it
          const facing = Math.cos(Math.atan2(dx, dz) - this.face) > 0.5;
          if (dist < 2.7 && facing) fp.strike(this, { dir: this.dir, dmg: this.heavy ? 26 : 14, heavy: this.heavy });
          else fp.whiff(this);
        }
        if (this.t >= 0.16) { this.state = 'recover'; this.t = 0; }
        break;
      }
      case 'recover':
        if (this.t > 0.6) { this.state = 'idle'; this.t = 0; this.wait = 0.8 + Math.random() * 1.6; }
        break;
      case 'stagger': {
        this.setArm(_v.set(Math.sin(this.t * 12) * 0.4 + 0.2, 0.9, -0.3));
        this.root.rotation.y = this.face + Math.sin(this.t * 18) * 0.25 * Math.max(0, 1 - this.t / this.stagFor);
        G.opacity = 0;
        if (this.t > this.stagFor) { this.state = 'idle'; this.t = 0; this.wait = 1.2; }
        break;
      }
    }
  }
}

// a round mato target on a stand, facing the shooting line; rings score 10 / 7 / 5 / 2
export class ArcheryTarget {
  constructor(x, z, y, face, parent) {
    this.x = x; this.z = z; this.y = y; this.face = face; this.h = 1.25; this.R = 0.55; this.kind = 'target';
    const m = new Mesher(Math.round(x * 7 + z), 0.05);
    for (const s of [-1, 1]) m.box(0.08, 1.6, 0.08, WOOD, [s * 0.5, 0.8, -0.1], [0.12, 0, 0]);
    m.box(1.2, 0.08, 0.08, WOOD, [0, 1.5, -0.12]); m.box(0.9, 0.5, 0.3, '#8a7a55', [0, 0.25, -0.2]);   // a sandbag behind
    const rings = [[0.55, '#f4f0e6'], [0.45, '#1c1c1f'], [0.36, '#f4f0e6'], [0.22, '#1c1c1f'], [0.1, '#f4f0e6']];
    rings.forEach(([r, c], i) => m.cyl(r, r, 0.06 + i * 0.01, 20, c, [0, this.h, 0], [Math.PI / 2, 0, 0]));
    this.mesh = m.mesh(); this.mesh.position.set(x, y, z); this.mesh.rotation.y = face; parent.add(this.mesh);
    this.nx = Math.sin(face); this.nz = Math.cos(face);
  }
  // does the arrow's step from a to b cross the target face? → { at, dist }
  test(a, b) {
    const da = (a.x - this.x) * this.nx + (a.z - this.z) * this.nz, db = (b.x - this.x) * this.nx + (b.z - this.z) * this.nz;
    if (da < 0 || db > 0) return null;
    const k = da / (da - db), x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k, z = a.z + (b.z - a.z) * k;
    const u = (x - this.x) * this.nz - (z - this.z) * this.nx, v = y - (this.y + this.h), dist = Math.hypot(u, v);
    if (dist > this.R) return null;
    return { at: new THREE.Vector3(x, y, z), dist };
  }
  score(dist) { return dist < 0.1 ? 10 : dist < 0.22 ? 7 : dist < 0.36 ? 5 : 2; }
}

// the yard: sand floor, a bamboo fence with an opening toward the bridge, dummies, the post, a weapon rack,
// a dojo and houses from the village, lanterns and banners
export function buildYard(T, parent, diff) {
  const R = mulberry32(77), Y = T.yard, y0 = T.yardY, out = { dummies: [], colliders: [], rack: null };
  const g = new THREE.Group(); g.position.set(0, 0, 0); parent.add(g);
  const toBridge = Math.atan2(T.bridge.x - Y.x, T.bridge.z - Y.z);
  // the fence: bamboo posts and two rails, with an opening toward the bridge
  const N = 30, fm = new Mesher(56, 0.07);
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2, a2 = (i + 1) / N * Math.PI * 2;
    const inGap = t => { let d = t - toBridge; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return Math.abs(d) < 0.22; };
    if (inGap(a) || inGap(a2)) continue;
    const x = Y.x + Math.sin(a) * Y.r, z = Y.z + Math.cos(a) * Y.r, x2 = Y.x + Math.sin(a2) * Y.r, z2 = Y.z + Math.cos(a2) * Y.r, L = Math.hypot(x2 - x, z2 - z), ang = Math.atan2(x2 - x, z2 - z);
    fm.cyl(0.06, 0.07, 1.3, 6, '#9aa35a', [x, y0 + 0.65, z]);
    for (const hy of [0.55, 1.05]) fm.box(0.06, 0.06, L, '#a9b25e', [(x + x2) / 2, y0 + hy, (z + z2) / 2], [0, ang, 0]);
    out.colliders.push({ x: (x + x2) / 2, z: (z + z2) / 2, hw: 0.1, hd: L / 2 + 0.05, ang });
  }
  g.add(fm.mesh());
  // the dojo on the far side, facing the yard; a house and a storehouse beside it
  const place = (type, w, d, dist, angOff, rotBack = 0) => {
    const a = toBridge + Math.PI + angOff, x = Y.x + Math.sin(a) * dist, z = Y.z + Math.cos(a) * dist;
    const m = buildModel(type, w, d, 11, null, 2); m.position.set(x, T.terrainAt(x, z) - 0.02, z); m.rotation.y = a + Math.PI + rotBack; g.add(m);
    m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    out.colliders.push({ x, z, hw: w / 2 - 0.2, hd: d / 2 - 0.2, ang: a + Math.PI + rotBack });
    return m;
  };
  place('dojo', 6, 6, Y.r + 5, 0);
  place('house', 4, 4, Y.r + 6, 0.62);
  place('storehouse', 4, 6, Y.r + 6, -0.64);
  // straw dummies in a row, and the sparring post
  const side = new THREE.Vector3(Math.cos(toBridge), 0, -Math.sin(toBridge)), fwd = new THREE.Vector3(Math.sin(toBridge), 0, Math.cos(toBridge));
  for (let i = 0; i < 3; i++) {
    const x = Y.x + side.x * (i - 1) * 3.2 - fwd.x * 4.5, z = Y.z + side.z * (i - 1) * 3.2 - fwd.z * 4.5;
    out.dummies.push(new StrawDummy(x, z, y0, g));
  }
  const px = Y.x + side.x * 5.5 + fwd.x * 2, pz = Y.z + side.z * 5.5 + fwd.z * 2;
  out.post = new SparringPost(px, pz, y0, g, diff);
  out.dummies.push(out.post);
  // the armoury by the gate: racks of every weapon, a quiver stand (F: change soldier, refill arrows and kunai)
  const at = (sd, fw) => ({ x: Y.x + side.x * sd + fwd.x * fw, z: Y.z + side.z * sd + fwd.z * fw });
  const A = at(3, 10.5), rack = new Mesher(57, 0.06);
  rack.box(0.1, 1.5, 0.1, WOOD, [-1.2, 0.75, 0]); rack.box(0.1, 1.5, 0.1, WOOD, [1.2, 0.75, 0]); rack.box(2.6, 0.08, 0.14, WOOD, [0, 1.45, 0]); rack.box(2.6, 0.08, 0.14, WOOD, [0, 0.5, 0]);
  rack.box(2.7, 0.1, 0.5, '#6b4c35', [0, 1.62, 0.05], [0.2, 0, 0]);
  const pole = (x, L, blade) => { rack.cyl(0.02, 0.02, L, 5, '#4a3222', [x, L / 2 + 0.05, 0.08], [0.1, 0, 0]); rack.box(0.03, 0.3, 0.012, blade, [x, L + 0.1, 0.08 + L * 0.1], [0.1, 0, 0]); };
  pole(-1.0, 2.6, '#dfe4ea'); pole(-0.75, 2.2, '#e8ecf0'); pole(-0.5, 3.0, '#dfe4ea');
  for (const [x, L] of [[0.0, 0.95], [0.2, 0.75], [0.4, 0.6]]) { rack.box(0.035, L, 0.025, '#dfe4ea', [x, 0.55 + L / 2, 0.08], [0.05, 0, 0]); rack.box(0.045, 0.26, 0.04, '#1f1c1f', [x, 0.45, 0.08]); }
  rack.cyl(0.06, 0.09, 0.95, 8, '#2a1c14', [0.75, 0.6, 0.1], [0.08, 0, 0]);                       // a kanabō
  rack.box(0.46, 0.62, 0.04, '#7a2a22', [1.0, 0.8, 0.14], [0.1, 0, 0]);                            // a shield
  rack.cyl(0.12, 0.1, 0.7, 8, '#4a3222', [1.75, 0.35, 0.3]); for (let k = 0; k < 7; k++) rack.box(0.012, 0.5, 0.012, '#e9e4d8', [1.7 + (k % 3) * 0.04, 0.85, 0.26 + Math.floor(k / 3) * 0.04]);   // the quiver stand
  rack.cyl(0.02, 0.02, 2.0, 5, '#3a2418', [-1.6, 1.0, 0.2], [0, 0, 0.12]);                          // a bow leaning on it
  const rm = rack.mesh(); rm.position.set(A.x, y0, A.z); rm.rotation.y = Math.atan2(Y.x - A.x, Y.z - A.z); g.add(rm);
  out.rack = { x: A.x, z: A.z };
  out.colliders.push({ x: A.x, z: A.z, hw: 1.5, hd: 0.3, ang: rm.rotation.y });
  // the archery range across the yard: three mato targets, and a line of stones to shoot from
  out.targets = [];
  const mark = at(9, 5), ml = new Mesher(58, 0.06);
  for (let k = -2; k <= 2; k++) ml.cyl(0.18, 0.2, 0.1, 7, '#9a958a', [fwd.x * k * 0.9, 0.05, fwd.z * k * 0.9]);
  const mm = ml.mesh(); mm.position.set(mark.x, y0, mark.z); g.add(mm);
  out.mark = mark;
  for (const fw of [1.5, 5, 8.5]) {
    const p = at(-11.5, fw), t = new ArcheryTarget(p.x, p.z, y0, Math.atan2(mark.x - p.x, mark.z - p.z), g);
    out.targets.push(t); out.colliders.push({ x: p.x, z: p.z, r: 0.35 });
  }
  // lanterns and banners at the opening
  for (const s of [-1, 1]) {
    const a = toBridge + s * 0.3, x = Y.x + Math.sin(a) * (Y.r + 0.8), z = Y.z + Math.cos(a) * (Y.r + 0.8);
    const l = buildModel('lantern', 2, 2, 3, null, 1); l.position.set(x, T.terrainAt(x, z), z); l.scale.setScalar(0.8); g.add(l);
    out.colliders.push({ x, z, r: 0.5 });
    const b = new Mesher(60 + s, 0.05); b.cyl(0.04, 0.04, 4, 5, WOOD_D, [0, 2, 0]); b.box(0.04, 2.2, 0.6, s < 0 ? '#b8342a' : '#27354f', [0, 2.6, 0.32]); b.cyl(0.15, 0.15, 0.05, 10, '#f5efe0', [0.03, 3.0, 0.32], [0, 0, Math.PI / 2]);
    const bm = b.mesh(); const bx = Y.x + Math.sin(toBridge + s * 0.5) * (Y.r - 1), bz = Y.z + Math.cos(toBridge + s * 0.5) * (Y.r - 1); bm.position.set(bx, y0, bz); bm.rotation.y = toBridge + Math.PI / 2; g.add(bm);
  }
  out.chaff = new Chaff(g);
  for (const it of out.chaff.items) it.floor = y0 + 0.02;
  out.root = g;
  return out;
}
