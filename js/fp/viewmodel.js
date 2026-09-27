// Your hands and weapon, drawn in front of the camera, and how they move: the left/right combo cuts, the heavy
// overhead, the block, a shield, a drawn bow — and a horse's neck when you ride.
// Camera space: x right, y up, forward is −z. Weapons are modelled along +y from the right hand's grip.
import * as THREE from 'three';
import { Mesher } from '../render/geo.js';
import { lerp, clamp, smoothstep } from '../util.js';

const SKIN = '#d9a882';
const P = (x, y, z, rx, ry, rz) => ({ p: [x, y, z], r: [rx, ry, rz] });

// pose sets by kind of weapon
const BLADE = {
  rest: P(0.3, -0.34, -0.62, -0.55, 0.12, -0.2),
  guard: P(0.04, -0.1, -0.62, 0.1, 0, 1.38),
  wind: { l: P(-0.36, -0.04, -0.46, -1.15, 1.25, 0.45), r: P(0.44, -0.02, -0.46, -1.15, -1.25, -0.45), u: P(0.12, 0.2, -0.34, 0.65, 0, -0.1) },
  heavy: { u: P(0.14, 0.32, -0.24, 1.05, 0, -0.1) },
  end: { l: P(0.36, -0.24, -0.64, -1.3, -1.35, 0.4), r: P(-0.36, -0.24, -0.64, -1.3, 1.35, -0.4), u: P(0.06, -0.38, -0.7, -1.95, 0, -0.1) },
  kick: P(0.34, -0.42, -0.54, -0.2, 0.2, -0.5),
  offHand: -0.2,
};
const POLE = {
  rest: P(0.24, -0.34, -0.54, -1.42, 0.06, 0),
  guard: P(0.0, -0.1, -0.74, 0, 0, 1.52),
  wind: { l: P(0.3, -0.3, -0.32, -1.42, 0.4, 0), r: P(0.2, -0.3, -0.32, -1.42, -0.4, 0), u: P(0.24, 0.12, -0.42, -0.55, 0.04, 0) },
  heavy: { u: P(0.24, 0.24, -0.34, -0.35, 0.04, 0) },
  end: { l: P(0.12, -0.24, -1.17, -1.5, -0.25, 0), r: P(0.3, -0.24, -1.17, -1.5, 0.25, 0), u: P(0.2, -0.32, -1.02, -1.85, 0.02, 0) },
  kick: P(0.3, -0.4, -0.42, -1.2, 0.3, 0),
  offHand: 0.55,
};
// the naginata sweeps instead of thrusting
const SWEEP = { ...POLE,
  wind: { l: P(-0.1, -0.28, -0.4, -1.45, 1.0, 0.1), r: P(0.5, -0.28, -0.4, -1.45, -1.0, -0.1), u: POLE.wind.u },
  end: { l: P(0.45, -0.3, -0.7, -1.5, -1.0, -0.1), r: P(-0.15, -0.3, -0.7, -1.5, 1.0, 0.1), u: POLE.end.u },
};
const CLUB = { ...BLADE, rest: P(0.32, -0.4, -0.6, -0.35, 0.1, -0.35), guard: P(0.04, -0.14, -0.64, 0.1, 0, 1.3), offHand: -0.24 };
const BOW = { rest: P(-0.12, -0.52, -0.62, 0, 0, 0.2), aim: P(0.12, -0.27, -0.72, 0, 0, 0.02), kick: P(-0.3, -0.62, -0.5, 0, 0, 0.5) };
const SETS = { katana: BLADE, sword: BLADE, ninjato: BLADE, kanabo: CLUB, yari: POLE, lance: POLE, naginata: SWEEP, yumi: BOW };
// one-handed weapons (a shield or a fan in the other hand)
const SHIELD_POS = { rest: P(-0.46, -0.5, -0.66, 0.05, 0.35, 0.05), guard: P(-0.1, -0.4, -0.78, 0.12, 0.1, 0) };   // raised: covers your body, you still see over its rim

function weaponMesh(k) {
  const m = new Mesher(k.length * 7, 0.04);
  const tsuka = (L, col = '#1f1c1f') => { m.box(0.045, L, 0.04, col, [0, -L / 2 + 0.05, 0]); for (let i = 0; i < Math.floor(L / 0.06); i++) m.box(0.05, 0.02, 0.046, '#e8e0cc', [0, 0.02 - i * 0.06, 0], [0, 0, i % 2 ? 0.5 : -0.5]); };
  if (k === 'katana' || k === 'sword') {
    const s = k === 'sword' ? 0.8 : 1;
    tsuka(0.3 * s); m.cyl(0.055, 0.055, 0.015, 10, '#3a3228', [0, 0.06, 0]); m.box(0.03, 0.035, 0.03, '#c9a24a', [0, 0.08, 0]);
    m.box(0.012, 0.28 * s, 0.034, '#dfe4ea', [0, 0.09 + 0.14 * s, 0], [0.02, 0, 0]);
    m.box(0.012, 0.28 * s, 0.03, '#e8ecf0', [0, 0.09 + 0.41 * s, 0.012 * s], [0.07 * s, 0, 0]);
    m.box(0.012, 0.22 * s, 0.026, '#eef1f4', [0, 0.09 + 0.65 * s, 0.03 * s], [0.13 * s, 0, 0]);
    m.cone(0.017, 0.08, 4, '#eef1f4', [0, 0.1 + 0.79 * s, 0.04 * s], [0.2, 0, 0]);
  } else if (k === 'ninjato') {
    tsuka(0.26, '#101012'); m.box(0.075, 0.012, 0.075, '#1f1f22', [0, 0.06, 0]);
    m.box(0.012, 0.55, 0.03, '#b9c0c8', [0, 0.35, 0]); m.cone(0.017, 0.06, 4, '#c9d0d6', [0, 0.65, 0]);
  } else if (k === 'kanabo') {
    m.cyl(0.03, 0.03, 0.3, 6, '#3a2418', [0, -0.08, 0]); m.cyl(0.05, 0.085, 0.95, 8, '#2a1c14', [0, 0.55, 0]);
    for (let i = 0; i < 20; i++) { const a = i * 2.4, y = 0.2 + (i % 10) * 0.08; m.box(0.03, 0.03, 0.03, '#8a8f96', [Math.cos(a) * 0.075, y, Math.sin(a) * 0.075]); }
    m.cyl(0.09, 0.09, 0.04, 8, '#6f7378', [0, 1.02, 0]);
  } else if (k === 'yari' || k === 'lance') {
    const L = k === 'lance' ? 3.0 : 2.4;
    m.cyl(0.02, 0.022, L, 6, '#4a3222', [0, L / 2 - 0.25, 0]);
    for (const y of [-0.15, 1.2]) m.cyl(0.026, 0.026, 0.08, 6, '#2a1c14', [0, y, 0]);
    m.cyl(0.028, 0.02, 0.08, 6, '#6f7378', [0, -0.25, 0]);
    m.box(0.03, 0.34, 0.012, '#dfe4ea', [0, L - 0.08, 0]); m.cone(0.022, 0.1, 4, '#eef1f4', [0, L + 0.14, 0]);
    m.cyl(0.03, 0.03, 0.1, 6, '#6f7378', [0, L - 0.28, 0]);
    if (k === 'lance') m.cone(0.07, 0.18, 6, '#b8342a', [0, L - 0.38, 0], [Math.PI, 0, 0]);
  } else if (k === 'naginata') {
    m.cyl(0.021, 0.023, 1.9, 6, '#3a2418', [0, 0.7, 0]); m.cyl(0.03, 0.03, 0.08, 6, '#c9a24a', [0, 1.62, 0]);
    m.box(0.012, 0.3, 0.05, '#dfe4ea', [0, 1.8, 0.01], [0.08, 0, 0]); m.box(0.012, 0.25, 0.045, '#e8ecf0', [0, 2.06, 0.04], [0.25, 0, 0]);
    m.cone(0.022, 0.1, 4, '#eef1f4', [0, 2.22, 0.08], [0.45, 0, 0]);
  }
  const mesh = m.mesh(undefined, false, false); mesh.frustumCulled = false;
  return mesh;
}
// a Japanese longbow: long above the grip, short below; the string is drawn separately
function bowMesh() {
  const m = new Mesher(71, 0.04), segs = 9;
  const pt = t => { const y = lerp(-0.55, 1.15, t), x = -Math.sin(t * Math.PI) * 0.16 - (t > 0.5 ? (t - 0.5) * 0.05 : 0); return [x, y]; };
  for (let i = 0; i < segs; i++) {
    const [x0, y0] = pt(i / segs), [x1, y1] = pt((i + 1) / segs), L = Math.hypot(x1 - x0, y1 - y0);
    m.box(0.028, L + 0.01, 0.03, i === 3 ? '#b8342a' : '#3a2418', [(x0 + x1) / 2, (y0 + y1) / 2, 0], [0, 0, Math.atan2(x0 - x1, y1 - y0)]);
  }
  m.box(0.04, 0.12, 0.04, '#e8e0cc', [-0.16, 0.2, 0]);   // the grip wrap
  const mesh = m.mesh(undefined, false, false); mesh.frustumCulled = false;
  mesh.userData.tips = [new THREE.Vector3(...pt(0), 0), new THREE.Vector3(...pt(1), 0)];
  return mesh;
}
function arrowMesh() {
  const m = new Mesher(72, 0.03);
  m.cyl(0.007, 0.007, 0.95, 5, '#c9a36f', [0, 0, -0.475], [Math.PI / 2, 0, 0]); m.cone(0.014, 0.06, 4, '#6f7378', [0, 0, -0.98], [-Math.PI / 2, 0, 0]);
  for (const a of [0, 2.1, 4.2]) m.box(0.003, 0.03, 0.12, '#f4efe4', [Math.cos(a) * 0.012, Math.sin(a) * 0.012, -0.06]);
  const mesh = m.mesh(undefined, false, false); mesh.frustumCulled = false; return mesh;
}
function shieldMesh() {
  const m = new Mesher(73, 0.05);
  m.box(0.46, 0.62, 0.035, '#7a2a22', [0, 0, 0]); m.box(0.5, 0.05, 0.05, '#3b2619', [0, 0.28, 0.01]); m.box(0.5, 0.05, 0.05, '#3b2619', [0, -0.28, 0.01]);
  m.cyl(0.1, 0.1, 0.02, 12, '#e0b04a', [0, 0.04, 0.03], [Math.PI / 2, 0, 0]); m.cyl(0.05, 0.05, 0.022, 10, '#7a2a22', [0, 0.04, 0.035], [Math.PI / 2, 0, 0]);
  const mesh = m.mesh(undefined, false, false); mesh.frustumCulled = false; return mesh;
}
function fanMesh() {
  const m = new Mesher(74, 0.05);
  m.cyl(0.015, 0.015, 0.2, 6, '#1c1c1f', [0, 0.1, 0]); m.cyl(0.13, 0.13, 0.012, 14, '#1c1c1f', [0, 0.3, 0], [Math.PI / 2, 0, 0]); m.cyl(0.06, 0.06, 0.014, 12, '#e0b04a', [0, 0.3, 0.008], [Math.PI / 2, 0, 0]);
  const mesh = m.mesh(undefined, false, false); mesh.frustumCulled = false; return mesh;
}
function horseMesh(col = '#6b4a33') {
  const m = new Mesher(75, 0.05);
  m.box(0.34, 0.5, 1.1, col, [0, -0.2, -0.3], [-0.95, 0, 0]);                 // the neck, rising ahead of you
  m.box(0.26, 0.3, 0.62, col, [0, 0.12, -0.95], [0.35, 0, 0]);                // the head, looking down the road
  m.box(0.12, 0.18, 0.14, '#1b1714', [0, 0.0, -1.24]);
  for (const s of [-1, 1]) m.box(0.05, 0.14, 0.06, col, [s * 0.08, 0.34, -0.8], [0.2, 0, s * 0.2]);   // ears
  m.box(0.06, 0.62, 0.9, '#1b1714', [0, 0.02, -0.2], [-0.95, 0, 0]);          // the mane
  m.box(0.36, 0.1, 0.4, '#8a2a22', [0, -0.52, 0.12]);                           // the saddle front
  const mesh = m.mesh(undefined, false, false); mesh.frustumCulled = false; return mesh;
}

export class ViewModel {
  constructor(camera) {
    this.camera = camera;
    this.root = new THREE.Group(); this.root.name = 'fp-viewmodel';
    this.weapon = new THREE.Group(); this.weapon.rotation.order = 'YXZ'; this.root.add(this.weapon);
    this.left = new THREE.Group(); this.left.rotation.order = 'YXZ'; this.root.add(this.left);     // shield, fan or bow
    this.horse = new THREE.Group(); this.root.add(this.horse);
    this.string = []; this.arrow = null;
    this.cur = null; this.curL = null; this.bob = 0; this.shake = 0; this.sway = { x: 0, y: 0 };
    // the ink trail behind the blade
    this.trailN = 12; this.trailPts = [];
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.trailN * 2 * 3), 3));
    const idx = []; for (let i = 0; i < this.trailN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } tg.setIndex(idx);
    tg.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(this.trailN * 2), 1));
    this.trail = new THREE.Mesh(tg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(0.09,0.08,0.1, vA * 0.55); }',
    }));
    this.trail.frustumCulled = false; this.root.add(this.trail);
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3();
  }
  // dress up as a class: its sleeves, weapon, the thing in the other hand, a horse
  setClass(C, mat) {
    this.mat = mat;
    for (const o of [this.armR, this.armL, this.handR, this.handL, ...this.string, this.arrow]) if (o) this.root.remove(o);
    const arm = new Mesher(3, 0.05).box(0.085, 0.085, 1, C.sleeve, [0, 0, -0.5]).geometry();
    const hg = new Mesher(4, 0.04).box(0.062, 0.058, 0.072, SKIN, [0, 0, 0]).geometry();
    this.armR = new THREE.Mesh(arm, mat); this.armL = new THREE.Mesh(arm, mat); this.handR = new THREE.Mesh(hg, mat); this.handL = new THREE.Mesh(hg, mat);
    for (const o of [this.armR, this.armL, this.handR, this.handL]) { o.frustumCulled = false; this.root.add(o); }
    this.wk = C.weapon; this.poses = SETS[C.weapon];
    this.weapon.clear(); this.left.clear(); this.horse.clear(); this.string = []; this.arrow = null; this.bow = null;
    this.oneHand = !!(C.shield || C.fan);
    if (C.weapon === 'yumi') {
      this.bow = bowMesh(); this.left.add(this.bow);
      const sg = new THREE.BoxGeometry(0.006, 1, 0.006); sg.translate(0, 0.5, 0);
      for (let i = 0; i < 2; i++) { const s = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: '#e8e0cc' })); s.frustumCulled = false; this.root.add(s); this.string.push(s); }
      this.arrow = arrowMesh(); this.root.add(this.arrow);
    } else this.weapon.add(weaponMesh(C.weapon));
    if (C.shield) this.left.add(shieldMesh());
    if (C.fan) this.left.add(fanMesh());
    if (C.horse) this.horse.add(horseMesh());
    this.hasHorse = !!C.horse; this.hasShield = !!C.shield; this.hasFan = !!C.fan;
    this.cur = null; this.curL = null; this.trailPts = [];
  }
  attach() { this.camera.add(this.root); }
  detach() { this.camera.remove(this.root); }

  // the pose of the weapon hand for this moment of the fight
  target(F) {
    const Q = this.poses, d = F.dir;
    if (this.wk === 'yumi') {
      if (F.state === 'kick') return { pose: Q.kick, speed: 16 };
      return { pose: mixPose(Q.rest, Q.aim, F.state === 'aim' ? Math.max(0.35, F.draw) : F.state === 'shoot' ? 0.6 : 0), speed: 14 };
    }
    switch (F.state) {
      case 'windup': return { pose: F.heavy ? Q.heavy.u : Q.wind[d], speed: F.heavy ? 9 : 22 };
      case 'active': { const k = smoothstep(0, 1, F.t / F.phase.act); return { from: F.heavy ? Q.heavy.u : Q.wind[d], to: Q.end[d], k, snap: true }; }
      case 'recover': return { pose: Q.end[d], back: Q.rest, k: smoothstep(0.2, 1, F.t / F.phase.rec), speed: 14 };
      case 'guard': return { pose: this.hasShield ? Q.rest : Q.guard, speed: 20 };
      case 'kick': return { pose: Q.kick, speed: 16 };
      case 'stagger': return { pose: Q.rest, speed: 6, shake: 1 };
      case 'down': return { pose: Q.kick, speed: 3 };
      default: return { pose: Q.rest, speed: 9 };
    }
  }
  update(dt, F, move) {
    const T = this.target(F);
    const goal = T.snap ? mixPose(T.from, T.to, T.k) : T.back ? mixPose(T.pose, T.back, T.k) : T.pose;
    if (!this.cur) this.cur = clonePose(goal);
    const s = T.snap ? 1 : 1 - Math.exp(-(T.speed || 10) * dt);
    for (let i = 0; i < 3; i++) { this.cur.p[i] = lerp(this.cur.p[i], goal.p[i], s); this.cur.r[i] = lerp(this.cur.r[i], goal.r[i], s); }
    // the other hand: a shield comes up to block, a fan stays low, a bow is the main thing
    let lg = null;
    if (this.hasShield) lg = F.state === 'guard' ? SHIELD_POS.guard : SHIELD_POS.rest;
    else if (this.hasFan) lg = P(-0.36, -0.4, -0.55, -0.2, 0.3, 0.3);
    else if (this.wk === 'yumi') lg = this.cur;
    if (lg) { if (!this.curL) this.curL = clonePose(lg); const k = 1 - Math.exp(-18 * dt); for (let i = 0; i < 3; i++) { this.curL.p[i] = lerp(this.curL.p[i], lg.p[i], k); this.curL.r[i] = lerp(this.curL.r[i], lg.r[i], k); } }
    // walking (or riding) bob and a little sway when you turn
    this.bob += dt * (move.speed > 0.3 ? 6 + move.speed * (this.hasHorse ? 0.5 : 1.1) : 1.2);
    const bobA = Math.min(1, move.speed / 4) * move.bobScale;
    this.sway.x = lerp(this.sway.x, clamp(-move.turnX * 0.004, -0.06, 0.06), 1 - Math.exp(-8 * dt));
    this.sway.y = lerp(this.sway.y, clamp(move.turnY * 0.004, -0.05, 0.05), 1 - Math.exp(-8 * dt));
    this.shake = Math.max(0, this.shake - dt * 3); if (T.shake) this.shake = Math.max(this.shake, 0.4);
    const sh = this.shake * 0.03, bx = Math.sin(this.bob) * 0.012 * bobA + this.sway.x + (Math.random() - 0.5) * sh, by = Math.abs(Math.cos(this.bob)) * 0.016 * bobA + this.sway.y + (Math.random() - 0.5) * sh;
    const W = this.weapon;
    W.position.set(this.cur.p[0] + bx, this.cur.p[1] + by, this.cur.p[2]); W.rotation.set(this.cur.r[0], this.cur.r[1], this.cur.r[2]); W.updateMatrix();
    const L = this.left;
    if (this.curL) { L.position.set(this.curL.p[0] + bx, this.curL.p[1] + by, this.curL.p[2]); L.rotation.set(this.curL.r[0], this.curL.r[1], this.curL.r[2]); L.updateMatrix(); }
    // the horse's neck rises and falls with its stride
    if (this.hasHorse) { const g = Math.min(1, move.speed / 5); this.horse.position.set(0, -0.62 + Math.sin(this.bob) * 0.04 * g, -0.3); this.horse.rotation.x = Math.sin(this.bob) * 0.04 * g; }
    // hands: on the grip, or on the shield / fan / bow
    if (this.wk === 'yumi') {
      // left hand on the bow's grip; right hand draws the string back toward your cheek
      this._b.set(-0.16, 0.2, 0).applyMatrix4(L.matrix);
      const drawK = F.state === 'aim' ? F.draw : 0;
      this._a.set(lerp(this._b.x + 0.16, 0.02, drawK), lerp(this._b.y - 0.03, -0.1, drawK), lerp(this._b.z + 0.06, -0.34, drawK));
      this.pointArm(this.armR, [0.42, -0.62, -0.12], this._a); this.handR.position.copy(this._a);
      this.pointArm(this.armL, [-0.3, -0.64, -0.16], this._b); this.handL.position.copy(this._b);
      const t0 = this.bow.userData.tips[0].clone().applyMatrix4(L.matrix), t1 = this.bow.userData.tips[1].clone().applyMatrix4(L.matrix);
      this.stringTo(this.string[0], t0, this._a); this.stringTo(this.string[1], t1, this._a);
      // the arrow: nocked on the string, pointing past the bow (hidden just after a shot)
      this.arrow.visible = (F.state !== 'shoot' || F.t > 0.3) && this.arrowsLeft !== 0;
      if (this.arrow.visible) { this.arrow.position.copy(this._a); const dir = this._b.clone().add(new THREE.Vector3(0, 0.01, 0)).sub(this._a).normalize(); this.arrow.quaternion.setFromUnitVectors(FWD, dir); }
    } else {
      this._a.set(0, 0, 0).applyMatrix4(W.matrix); this.pointArm(this.armR, [0.42, -0.62, -0.12], this._a); this.handR.position.copy(this._a); this.handR.quaternion.copy(W.quaternion);
      if (this.oneHand) this._b.set(0, -0.05, 0.05).applyMatrix4(L.matrix);
      else this._b.set(0, this.poses.offHand, 0).applyMatrix4(W.matrix);
      this.pointArm(this.armL, [-0.3, -0.64, -0.16], this._b); this.handL.position.copy(this._b); this.handL.quaternion.copy(this.oneHand ? L.quaternion : W.quaternion);
    }
    // the ink trail: the blade tip and a point down the blade, while striking
    const tipY = { yari: 2.4, lance: 3.0, naginata: 2.1, kanabo: 1.0, katana: 0.9, sword: 0.72, ninjato: 0.64 }[this.wk] || 0.9;
    const striking = F.state === 'active' || (F.state === 'recover' && F.t < 0.06);
    if (this.wk !== 'yumi' && striking) this.trailPts.unshift([new THREE.Vector3(0, tipY, 0).applyMatrix4(W.matrix), new THREE.Vector3(0, tipY * 0.45, 0).applyMatrix4(W.matrix)]);
    else if (this.trailPts.length) this.trailPts.pop();
    if (this.trailPts.length > this.trailN) this.trailPts.length = this.trailN;
    const pos = this.trail.geometry.attributes.position, al = this.trail.geometry.attributes.alpha;
    for (let i = 0; i < this.trailN; i++) {
      const pr = this.trailPts[Math.min(i, this.trailPts.length - 1)];
      if (!pr) { pos.setXYZ(i * 2, 0, 0, 0); pos.setXYZ(i * 2 + 1, 0, 0, 0); al.setX(i * 2, 0); al.setX(i * 2 + 1, 0); continue; }
      pos.setXYZ(i * 2, pr[0].x, pr[0].y, pr[0].z); pos.setXYZ(i * 2 + 1, pr[1].x, pr[1].y, pr[1].z);
      const a = i < this.trailPts.length ? 1 - i / this.trailN : 0; al.setX(i * 2, a); al.setX(i * 2 + 1, a * 0.2);
    }
    pos.needsUpdate = true; al.needsUpdate = true;
  }
  stringTo(s, from, to) { const d = new THREE.Vector3().subVectors(to, from), L = d.length(); s.position.copy(from); s.scale.set(1, L, 1); s.quaternion.setFromUnitVectors(UP, d.normalize()); }
  pointArm(arm, sh, hand) {
    arm.position.set(sh[0], sh[1], sh[2]);
    const d = new THREE.Vector3().subVectors(hand, arm.position), L = d.length();
    arm.scale.set(1, 1, L);
    arm.quaternion.setFromUnitVectors(FWD, d.normalize());   // the arm is modelled along −z (camera space, so no lookAt)
  }
}
const FWD = new THREE.Vector3(0, 0, -1), UP = new THREE.Vector3(0, 1, 0);
const clonePose = a => ({ p: [...a.p], r: [...a.r] });
function mixPose(a, b, k) { return { p: a.p.map((v, i) => lerp(v, b.p[i], k)), r: a.r.map((v, i) => lerp(v, b.r[i], k)) }; }
