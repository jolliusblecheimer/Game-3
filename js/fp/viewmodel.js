// Your hands and weapon, drawn in front of the camera, and how they move: the left/right combo cuts, the heavy
// overhead, the block, a shield, a Japanese bow drawn the kyūdō way — and a horse's neck when you ride.
// Camera space: x right, y up, forward is −z. Weapons are modelled along +y from the right hand's grip.
import * as THREE from 'three';
import { Mesher, MAT } from '../render/geo.js';
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
// the bow (kyūdō): held low at rest; raised above the head (uchiokoshi); drawn down and apart to full draw with the
// string hand at the cheek (kai); on release the bow spins in the hand (yugaeri) and the hand flies back (zanshin)
const BOW = {
  rest: P(-0.2, -0.5, -0.6, -0.1, 0.25, 0.32),
  raise: P(-0.17, 0.06, -0.78, 0.05, 0.05, 0.1),
  kai: P(-0.19, -0.12, -0.7, 0, 0.1, 0.12),
  kick: P(-0.34, -0.62, -0.5, 0, 0.3, 0.6),
  anchor: [0.085, -0.13, -0.06],      // the string hand at full draw: by the right cheek
  zanshin: [0.36, -0.1, 0.02],        // where it flies after the release
};
const SETS = { katana: BLADE, sword: BLADE, ninjato: BLADE, kanabo: CLUB, yari: POLE, lance: POLE, naginata: SWEEP, yumi: BOW };
const SHIELD_POS = { rest: P(-0.46, -0.5, -0.66, 0.05, 0.35, 0.05), guard: P(-0.1, -0.4, -0.78, 0.12, 0.1, 0) };   // raised: covers your body, you still see over its rim

// smooth meshers: wood/cloth (matte) and steel (polished), no per-face jitter
const smooth = seed => { const m = new Mesher(seed, 0); m.smooth = true; return m; };
const finish = (m, st) => { const g = new THREE.Group(); if (!m.empty) g.add(m.mesh(MAT.smooth, false, false)); if (st && !st.empty) g.add(st.mesh(MAT.steel, false, false)); g.traverse(o => { o.frustumCulled = false; }); return g; };
// a gently curving blade in many short pieces (so the curve looks smooth); length L, curve c, width w
function blade(st, y0, L, c, w, col = '#dfe4ea') {
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 1) / n, za = c * a * a, zb = c * b * b, ya = y0 + L * a, yb = y0 + L * b;
    st.box(0.011, (yb - ya) + 0.004, w * (1 - 0.18 * b), col, [0, (ya + yb) / 2, (za + zb) / 2], [Math.atan2(zb - za, yb - ya), 0, 0]);
  }
  // the point (kissaki): a small wedge
  st.add(new THREE.ConeGeometry(w * 0.45, w * 1.6, 4), col, [0, y0 + L + w * 0.7, c], [0.3, 0, 0], [0.25, 1, 1]);
}
function weaponMesh(k) {
  const m = smooth(k.length * 7), st = smooth(k.length * 7 + 1);
  const tsuka = (L, col = '#1f1c1f') => {
    m.cyl(0.021, 0.022, L, 14, col, [0, -L / 2 + 0.05, 0]);
    for (let i = 0; i < Math.floor(L / 0.05); i++) m.cyl(0.0235, 0.0235, 0.012, 14, '#e8e0cc', [0, 0.02 - i * 0.05, 0], [0, 0, i % 2 ? 0.25 : -0.25]);
    m.cyl(0.024, 0.024, 0.02, 14, '#3a3228', [0, -L + 0.06, 0]);
  };
  if (k === 'katana' || k === 'sword') {
    const s = k === 'sword' ? 0.8 : 1;
    tsuka(0.3 * s); st.cyl(0.056, 0.056, 0.014, 20, '#3a3228', [0, 0.06, 0]); st.cyl(0.026, 0.026, 0.03, 12, '#c9a24a', [0, 0.085, 0]);
    blade(st, 0.1, 0.78 * s, 0.05 * s, 0.032);
  } else if (k === 'ninjato') {
    tsuka(0.26, '#101012'); st.box(0.075, 0.012, 0.075, '#1f1f22', [0, 0.06, 0]);
    blade(st, 0.07, 0.56, 0, 0.03, '#b9c0c8');
  } else if (k === 'kanabo') {
    m.cyl(0.028, 0.03, 0.3, 14, '#3a2418', [0, -0.08, 0]); m.cyl(0.05, 0.088, 0.95, 16, '#2a1c14', [0, 0.55, 0]);
    for (let i = 0; i < 28; i++) { const a = i * 2.4, y = 0.18 + (i % 14) * 0.058; st.ball(0.016, '#8a8f96', [Math.cos(a) * 0.075 * (0.7 + y * 0.35), y, Math.sin(a) * 0.075 * (0.7 + y * 0.35)], [1, 1, 1], 1); }
    st.cyl(0.09, 0.09, 0.04, 16, '#6f7378', [0, 1.02, 0]);
  } else if (k === 'yari' || k === 'lance') {
    const L = k === 'lance' ? 3.0 : 2.4;
    m.cyl(0.019, 0.021, L, 12, '#4a3222', [0, L / 2 - 0.25, 0]);
    for (const y of [-0.15, 1.2]) m.cyl(0.025, 0.025, 0.08, 12, '#2a1c14', [0, y, 0]);
    st.cyl(0.026, 0.019, 0.08, 12, '#6f7378', [0, -0.25, 0]);
    st.cyl(0.028, 0.028, 0.1, 12, '#6f7378', [0, L - 0.28, 0]);
    blade(st, L - 0.24, 0.34, 0, 0.034);
    if (k === 'lance') m.cone(0.07, 0.18, 12, '#b8342a', [0, L - 0.38, 0], [Math.PI, 0, 0]);
  } else if (k === 'naginata') {
    m.cyl(0.02, 0.022, 1.9, 12, '#3a2418', [0, 0.7, 0]); st.cyl(0.028, 0.028, 0.07, 12, '#c9a24a', [0, 1.62, 0]);
    blade(st, 1.66, 0.58, 0.14, 0.05);
  }
  return finish(m, st);
}
// the Japanese longbow (yumi): long above the grip, short below, its limbs curving back toward you;
// each limb bends around the grip as you draw
function bowRig() {
  const rig = new THREE.Group(), upper = new THREE.Group(), lower = new THREE.Group();
  const limb = (len, dir) => {
    const m = smooth(71 + (dir > 0 ? 0 : 5)), n = 14;
    const pt = t => [t * len * dir, 0.17 * Math.pow(Math.sin(t * Math.PI / 2), 1.3) + 0.035 * Math.pow(t, 5)];   // [y, z]
    for (let i = 0; i < n; i++) {
      const [y0, z0] = pt(i / n), [y1, z1] = pt((i + 1) / n), w = 0.03 * (1 - 0.45 * (i / n));
      m.box(0.022, Math.hypot(y1 - y0, z1 - z0) + 0.004, w, (dir > 0 && i === 1) ? '#b8342a' : '#2e1d14', [0, (y0 + y1) / 2, (z0 + z1) / 2], [Math.atan2(z1 - z0, y1 - y0), 0, 0]);
    }
    const [ty, tz] = pt(1); m.box(0.026, 0.04, 0.036, '#e8e0cc', [0, ty, tz]);
    const g = finish(m); g.userData.tip = new THREE.Vector3(0, ty, tz); return g;
  };
  upper.add(limb(1.32, 1)); lower.add(limb(0.72, -1));
  const grip = smooth(79); grip.cyl(0.022, 0.022, 0.16, 12, '#e8e0cc', [0, 0.02, 0]); grip.cyl(0.024, 0.024, 0.02, 12, '#b8342a', [0, 0.1, 0]);
  rig.add(upper, lower, finish(grip));
  rig.userData = { upper, lower, tipU: upper.children[0].userData.tip, tipL: lower.children[0].userData.tip };
  return rig;
}
function arrowMesh() {
  const m = smooth(72), st = smooth(73);
  m.cyl(0.0065, 0.0065, 0.95, 10, '#c9a36f', [0, 0, -0.475], [Math.PI / 2, 0, 0]);
  st.cone(0.013, 0.06, 10, '#8a9096', [0, 0, -0.98], [-Math.PI / 2, 0, 0]);
  for (const a of [0, 2.1, 4.2]) m.box(0.002, 0.028, 0.12, '#f4efe4', [Math.cos(a) * 0.011, Math.sin(a) * 0.011, -0.07], [0, 0, a]);
  m.cyl(0.008, 0.008, 0.02, 8, '#1c1c1f', [0, 0, -0.005], [Math.PI / 2, 0, 0]);   // the nock
  return finish(m, st);
}
function shieldMesh() {
  const m = smooth(73), st = smooth(74);
  m.box(0.46, 0.62, 0.035, '#7a2a22', [0, 0, 0]); m.box(0.5, 0.05, 0.05, '#3b2619', [0, 0.28, 0.01]); m.box(0.5, 0.05, 0.05, '#3b2619', [0, -0.28, 0.01]);
  st.cyl(0.1, 0.1, 0.02, 24, '#e0b04a', [0, 0.04, 0.03], [Math.PI / 2, 0, 0]); m.cyl(0.05, 0.05, 0.022, 20, '#7a2a22', [0, 0.04, 0.035], [Math.PI / 2, 0, 0]);
  return finish(m, st);
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
    this.left = new THREE.Group(); this.left.rotation.order = 'YXZ'; this.root.add(this.left);     // shield or bow
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
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._c = new THREE.Vector3(); this._d = new THREE.Vector3();
  }
  // dress up as a class: its sleeves, weapon, a shield, a horse
  setClass(C, mat) {
    this.mat = mat;
    for (const o of [this.armR, this.armL, this.handR, this.handL, ...this.string, this.arrow]) if (o) this.root.remove(o);
    const arm = new Mesher(3, 0.05).box(0.07, 0.07, 1, C.sleeve, [0, 0, -0.5]).geometry();
    const hg = new Mesher(4, 0.04).box(0.062, 0.058, 0.072, SKIN, [0, 0, 0]).geometry();
    this.armR = new THREE.Mesh(arm, mat); this.armL = new THREE.Mesh(arm, mat); this.handR = new THREE.Mesh(hg, mat); this.handL = new THREE.Mesh(hg, mat);
    for (const o of [this.armR, this.armL, this.handR, this.handL]) { o.frustumCulled = false; this.root.add(o); }
    this.wk = C.weapon; this.poses = SETS[C.weapon];
    this.weapon.clear(); this.left.clear(); this.horse.clear(); this.string = []; this.arrow = null; this.bow = null;
    this.oneHand = !!C.shield;
    if (C.weapon === 'yumi') {
      this.bow = bowRig(); this.left.add(this.bow);
      const sg = new THREE.CylinderGeometry(0.0022, 0.0022, 1, 5); sg.translate(0, 0.5, 0);
      for (let i = 0; i < 2; i++) { const s = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: '#efe6cf' })); s.frustumCulled = false; this.root.add(s); this.string.push(s); }
      this.arrow = arrowMesh(); this.root.add(this.arrow);
      this.bowHand = null;
    } else this.weapon.add(weaponMesh(C.weapon));
    if (C.shield) this.left.add(shieldMesh());
    if (C.horse) this.horse.add(horseMesh());
    this.hasHorse = !!C.horse; this.hasShield = !!C.shield;
    this.cur = null; this.curL = null; this.trailPts = [];
  }
  attach() { this.camera.add(this.root); }
  detach() { this.camera.remove(this.root); }

  // the pose of the weapon hand for this moment of the fight
  target(F) {
    const Q = this.poses, d = F.dir;
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
    // walking (or riding) bob and a little sway when you turn
    this.bob += dt * (move.speed > 0.3 ? 6 + move.speed * (this.hasHorse ? 0.5 : 1.1) : 1.2);
    const bobA = Math.min(1, move.speed / 4) * move.bobScale;
    this.sway.x = lerp(this.sway.x, clamp(-move.turnX * 0.004, -0.06, 0.06), 1 - Math.exp(-8 * dt));
    this.sway.y = lerp(this.sway.y, clamp(move.turnY * 0.004, -0.05, 0.05), 1 - Math.exp(-8 * dt));
    this.shake = Math.max(0, this.shake - dt * 3); if (F.state === 'stagger') this.shake = Math.max(this.shake, 0.4);
    const sh = this.shake * 0.03;
    this.bx = Math.sin(this.bob) * 0.012 * bobA + this.sway.x + (Math.random() - 0.5) * sh;
    this.by = Math.abs(Math.cos(this.bob)) * 0.016 * bobA + this.sway.y + (Math.random() - 0.5) * sh;
    if (this.hasHorse) { const g = Math.min(1, move.speed / 5); this.horse.position.set(0, -0.62 + Math.sin(this.bob) * 0.04 * g, -0.3); this.horse.rotation.x = Math.sin(this.bob) * 0.04 * g; }
    if (this.wk === 'yumi') { this.updateBow(dt, F); return; }
    const T = this.target(F);
    const goal = T.snap ? mixPose(T.from, T.to, T.k) : T.back ? mixPose(T.pose, T.back, T.k) : T.pose;
    if (!this.cur) this.cur = clonePose(goal);
    const s = T.snap ? 1 : 1 - Math.exp(-(T.speed || 10) * dt);
    for (let i = 0; i < 3; i++) { this.cur.p[i] = lerp(this.cur.p[i], goal.p[i], s); this.cur.r[i] = lerp(this.cur.r[i], goal.r[i], s); }
    const W = this.weapon;
    W.position.set(this.cur.p[0] + this.bx, this.cur.p[1] + this.by, this.cur.p[2]); W.rotation.set(this.cur.r[0], this.cur.r[1], this.cur.r[2]); W.updateMatrix();
    const L = this.left;
    if (this.hasShield) {
      const lg = F.state === 'guard' ? SHIELD_POS.guard : SHIELD_POS.rest;
      if (!this.curL) this.curL = clonePose(lg);
      const k = 1 - Math.exp(-18 * dt); for (let i = 0; i < 3; i++) { this.curL.p[i] = lerp(this.curL.p[i], lg.p[i], k); this.curL.r[i] = lerp(this.curL.r[i], lg.r[i], k); }
      L.position.set(this.curL.p[0] + this.bx, this.curL.p[1] + this.by, this.curL.p[2]); L.rotation.set(this.curL.r[0], this.curL.r[1], this.curL.r[2]); L.updateMatrix();
    }
    // hands: on the grip, or on the shield
    this._a.set(0, 0, 0).applyMatrix4(W.matrix); this.pointArm(this.armR, [0.42, -0.62, -0.12], this._a); this.handR.position.copy(this._a); this.handR.quaternion.copy(W.quaternion);
    if (this.oneHand) this._b.set(0, -0.05, 0.05).applyMatrix4(L.matrix);
    else this._b.set(0, this.poses.offHand, 0).applyMatrix4(W.matrix);
    this.pointArm(this.armL, [-0.3, -0.64, -0.16], this._b); this.handL.position.copy(this._b); this.handL.quaternion.copy(this.oneHand ? L.quaternion : W.quaternion);
    // the ink trail: the blade tip and a point down the blade, while striking
    const tipY = { yari: 2.4, lance: 3.0, naginata: 2.3, kanabo: 1.0, katana: 0.9, sword: 0.72, ninjato: 0.64 }[this.wk] || 0.9;
    const striking = F.state === 'active' || (F.state === 'recover' && F.t < 0.06);
    if (striking) this.trailPts.unshift([new THREE.Vector3(0, tipY, 0).applyMatrix4(W.matrix), new THREE.Vector3(0, tipY * 0.45, 0).applyMatrix4(W.matrix)]);
    else if (this.trailPts.length) this.trailPts.pop();
    this.drawTrail();
  }
  // the bow, the kyūdō way
  updateBow(dt, F) {
    const Q = BOW, rig = this.bow, U = rig.userData;
    let pose, bend = 0, hand = null, spin = 0, arrowOn = true, stringFree = false;
    const kaiNow = () => ({ l: F.quick ? smoothstep(0, 1, F.draw) : smoothstep(0.3, 1, F.draw) });
    if (F.state === 'aim') {
      // raise, then draw down and apart to the cheek; at full draw it trembles slightly if held long
      const { l } = kaiNow();
      pose = F.quick ? mixPose(Q.rest, Q.kai, l) : F.draw < 0.3 ? mixPose(Q.rest, Q.raise, smoothstep(0, 0.3, F.draw)) : mixPose(Q.raise, Q.kai, l);
      bend = l * 0.32;
      hand = { k: l };
      if (F.draw >= 1 && F.t > 2.5) { pose = clonePose(pose); pose.p[1] += Math.sin(F.t * 31) * 0.0025; }
    } else if (F.state === 'shoot') {
      // the release: the string snaps forward, the bow turns in the hand, the hand flies back — then nock the next arrow
      const t = F.t;
      pose = mixPose(Q.kai, Q.rest, smoothstep(0.25, 0.6, t));
      spin = 2.7 * smoothstep(0, 0.05, t) * (1 - smoothstep(0.2, 0.55, t));
      stringFree = t < 0.42; arrowOn = t > 0.42;
      hand = { release: t };
    } else if (F.state === 'kick') pose = Q.kick;
    else pose = Q.rest;
    if (!this.curL) this.curL = clonePose(pose);
    const k = F.state === 'shoot' && F.t < 0.1 ? 1 : 1 - Math.exp(-(F.state === 'aim' ? 16 : 10) * dt);
    for (let i = 0; i < 3; i++) { this.curL.p[i] = lerp(this.curL.p[i], pose.p[i], k); this.curL.r[i] = lerp(this.curL.r[i], pose.r[i], k); }
    const L = this.left;
    L.position.set(this.curL.p[0] + this.bx, this.curL.p[1] + this.by, this.curL.p[2]); L.rotation.set(this.curL.r[0], this.curL.r[1] + spin, this.curL.r[2]); L.updateMatrix();
    this.bend = lerp(this.bend || 0, bend, F.state === 'shoot' ? 1 : 1 - Math.exp(-20 * dt));
    U.upper.rotation.x = this.bend; U.lower.rotation.x = -this.bend; U.upper.updateMatrix(); U.lower.updateMatrix();
    rig.updateMatrix();
    // the tips, the grip and the nocking point (on the straight string, just above the grip), in camera space
    const toCam = (v, g) => v.clone().applyMatrix4(g.matrix).applyMatrix4(rig.matrix).applyMatrix4(L.matrix);
    const tipU = toCam(U.tipU, U.upper), tipL = toCam(U.tipL, U.lower);
    const grip = this._c.set(0, 0.05, 0).applyMatrix4(rig.matrix).applyMatrix4(L.matrix);
    const nockRest = new THREE.Vector3().lerpVectors(tipL, tipU, (0.72 + 0.1) / 2.04);
    // the string hand: on the nock, drawn to the anchor, or flying back after the release
    const anchor = new THREE.Vector3(Q.anchor[0] + this.bx, Q.anchor[1] + this.by, Q.anchor[2]);
    let hp;
    if (hand && hand.k != null) hp = new THREE.Vector3().lerpVectors(nockRest, anchor, hand.k);
    else if (hand && hand.release != null) {
      const t = hand.release, z = new THREE.Vector3(...Q.zanshin);
      hp = t < 0.12 ? new THREE.Vector3().lerpVectors(anchor, z, smoothstep(0, 0.12, t)) : new THREE.Vector3().lerpVectors(z, nockRest, smoothstep(0.25, 0.6, t));
    } else hp = nockRest.clone();
    this.handR.position.copy(hp); this.handR.quaternion.identity();
    this.pointArm(this.armR, [0.42, -0.62, -0.12], hp);
    this.handL.position.copy(grip); this.handL.quaternion.copy(L.quaternion);
    this.pointArm(this.armL, [-0.3, -0.64, -0.16], grip);
    // the string: from each tip to the drawing hand (or straight when nothing holds it)
    const onString = stringFree ? nockRest : hp;
    this.stringTo(this.string[0], tipU, onString); this.stringTo(this.string[1], tipL, onString);
    // the arrow rests on the right of the bow just above your hand, nock on the string
    this.arrow.visible = arrowOn && this.arrowsLeft !== 0;
    if (this.arrow.visible) {
      const rest = this._d.set(0.022, 0.1, -0.01).applyMatrix4(rig.matrix).applyMatrix4(L.matrix);
      const dir = rest.clone().sub(onString).normalize();
      if (F.state === 'aim') { const k = smoothstep(0.3, 1, F.quick ? 1 : F.draw); dir.lerp(new THREE.Vector3(0, -0.02, -40).sub(onString).normalize(), k).normalize(); }
      this.arrow.position.copy(onString); this.arrow.quaternion.setFromUnitVectors(FWD, dir);
    }
    this.trailPts.length = 0; this.drawTrail();
  }
  drawTrail() {
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
