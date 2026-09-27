// Your hands and weapon, drawn in front of the camera, and how they move for each strike, guard and stagger.
// Camera space: x right, y up, forward is −z. Weapons are modelled along +y from the right hand's grip.
import * as THREE from 'three';
import { Mesher } from '../render/geo.js';
import { lerp, clamp, smoothstep } from '../util.js';

const SKIN = '#d9a882';
const P = (x, y, z, rx, ry, rz) => ({ p: [x, y, z], r: [rx, ry, rz] });

// poses per weapon: rest, guards, wind-ups and follow-throughs for each direction
const POSES = {
  katana: {
    rest: P(0.3, -0.34, -0.62, -0.55, 0.12, -0.2),
    guard: { u: P(0.02, 0.02, -0.62, 0.1, 0, 1.45), l: P(-0.22, -0.2, -0.58, 0.05, 0, 0.28), r: P(0.34, -0.2, -0.58, 0.05, 0, -0.28) },
    wind: { l: P(-0.36, -0.04, -0.46, -1.15, 1.25, 0.45), r: P(0.44, -0.02, -0.46, -1.15, -1.25, -0.45), u: P(0.12, 0.2, -0.34, 0.65, 0, -0.1) },
    heavy: { l: P(-0.46, 0.04, -0.38, -1.0, 1.6, 0.6), r: P(0.52, 0.06, -0.38, -1.0, -1.6, -0.6), u: P(0.14, 0.3, -0.24, 1.05, 0, -0.1) },
    end: { l: P(0.36, -0.24, -0.64, -1.3, -1.35, 0.4), r: P(-0.36, -0.24, -0.64, -1.3, 1.35, -0.4), u: P(0.06, -0.38, -0.7, -1.95, 0, -0.1) },
    kick: P(0.34, -0.42, -0.54, -0.2, 0.2, -0.5),
    offHand: -0.2,     // the left hand grips lower on the handle
  },
  yari: {
    rest: P(0.24, -0.34, -0.54, -1.42, 0.06, 0),
    guard: { u: P(0.0, -0.02, -0.77, 0, 0, 1.52), l: P(-0.22, -0.3, -0.7, 0.12, 0, 0.22), r: P(0.3, -0.3, -0.7, 0.12, 0, -0.22) },
    wind: { l: P(0.3, -0.3, -0.32, -1.42, 0.4, 0), r: P(0.2, -0.3, -0.32, -1.42, -0.4, 0), u: P(0.24, -0.24, -0.3, -1.3, 0.04, 0) },
    heavy: { l: P(0.34, -0.26, -0.17, -1.35, 0.55, 0), r: P(0.18, -0.26, -0.17, -1.35, -0.55, 0), u: P(0.24, -0.18, -0.14, -1.2, 0.04, 0) },
    end: { l: P(0.12, -0.24, -1.17, -1.5, -0.25, 0), r: P(0.3, -0.24, -1.17, -1.5, 0.25, 0), u: P(0.2, -0.2, -1.22, -1.55, 0.02, 0) },
    kick: P(0.3, -0.4, -0.42, -1.2, 0.3, 0),
    offHand: 0.55,     // the left hand holds the shaft further forward
  },
};

function weaponMesh(k) {
  const m = new Mesher(k.length * 7, 0.04);
  if (k === 'katana') {
    m.box(0.045, 0.3, 0.04, '#1f1c1f', [0, -0.1, 0]);                       // tsuka (the wrapped grip)
    for (let i = 0; i < 5; i++) m.box(0.05, 0.02, 0.046, '#e8e0cc', [0, -0.22 + i * 0.06, 0], [0, 0, i % 2 ? 0.5 : -0.5]);
    m.cyl(0.055, 0.055, 0.015, 10, '#3a3228', [0, 0.06, 0]);                // tsuba (guard)
    m.box(0.03, 0.035, 0.03, '#c9a24a', [0, 0.08, 0]);
    // a slightly curved blade: three segments bending back
    m.box(0.012, 0.28, 0.034, '#dfe4ea', [0, 0.23, 0.0], [0.02, 0, 0]);
    m.box(0.012, 0.28, 0.03, '#e8ecf0', [0, 0.5, 0.012], [0.07, 0, 0]);
    m.box(0.012, 0.22, 0.026, '#eef1f4', [0, 0.74, 0.03], [0.13, 0, 0]);
    m.box(0.004, 0.72, 0.008, '#a9b1ba', [0, 0.5, -0.017]);                  // the edge line (hamon)
    m.cone(0.017, 0.08, 4, '#eef1f4', [0, 0.88, 0.04], [0.2, 0, 0]);
  } else {
    m.cyl(0.02, 0.022, 2.4, 6, '#4a3222', [0, 0.95, 0]);                   // the shaft, from just behind the hand to the tip
    for (const y of [-0.15, 1.2]) m.cyl(0.026, 0.026, 0.08, 6, '#2a1c14', [0, y, 0]);
    m.cyl(0.028, 0.02, 0.08, 6, '#6f7378', [0, -0.25, 0]);                   // the iron butt cap
    m.box(0.03, 0.34, 0.012, '#dfe4ea', [0, 1.95, 0]);                      // the blade
    m.cone(0.022, 0.1, 4, '#eef1f4', [0, 2.17, 0]);
    m.cyl(0.03, 0.03, 0.1, 6, '#6f7378', [0, 1.76, 0]);
  }
  const mesh = m.mesh(undefined, false, false); mesh.frustumCulled = false;
  return mesh;
}

export class ViewModel {
  constructor(camera, sleeve = '#2e3440') {
    this.camera = camera;
    this.root = new THREE.Group(); this.root.name = 'fp-viewmodel';
    this.weapon = new THREE.Group(); this.weapon.rotation.order = 'YXZ';
    this.root.add(this.weapon);
    // arms: a sleeve from off-screen shoulders to each hand
    const arm = new Mesher(3, 0.05).box(0.085, 0.085, 1, sleeve, [0, 0, -0.5]).geometry();
    this.armR = new THREE.Mesh(arm, undefined); this.armL = new THREE.Mesh(arm, undefined);
    for (const a of [this.armR, this.armL]) { a.frustumCulled = false; this.root.add(a); }
    const hg = new Mesher(4, 0.04).box(0.062, 0.058, 0.072, SKIN, [0, 0, 0]).geometry();
    this.handR = new THREE.Mesh(hg); this.handL = new THREE.Mesh(hg);
    for (const o of [this.handR, this.handL]) { o.frustumCulled = false; this.root.add(o); }
    this.cur = null; this.bob = 0; this.shake = 0; this.sway = { x: 0, y: 0 };
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
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._m = new THREE.Matrix4();
  }
  setMaterial(mat) { for (const o of [this.armR, this.armL, this.handR, this.handL]) o.material = mat; }
  setWeapon(k, mat) {
    this.wk = k; this.poses = POSES[k];
    if (this.wm) this.weapon.remove(this.wm);
    this.wm = weaponMesh(k); this.weapon.add(this.wm);
    if (mat) this.setMaterial(mat);
    this.cur = null;
  }
  attach() { this.camera.add(this.root); }
  detach() { this.camera.remove(this.root); }

  // the pose for this moment of the fight
  target(F) {
    const Q = this.poses, d = F.dir;
    switch (F.state) {
      case 'windup': {
        const W = F.heavy ? Q.heavy[d] : Q.wind[d], k = clamp(F.t / (F.heavy ? 0.5 : F.w.light.wind), 0, 1);
        return { pose: W, speed: F.heavy ? 10 : 22, k };
      }
      case 'active': { const k = smoothstep(0, 1, F.t / F.phase.act); return { from: F.heavy ? Q.heavy[d] : Q.wind[d], to: Q.end[d], k, snap: true }; }
      case 'recover': return { pose: Q.end[d], back: Q.rest, k: smoothstep(0.2, 1, F.t / F.phase.rec), speed: 14 };
      case 'guard': return { pose: Q.guard[F.guardDir], speed: 20 };
      case 'kick': return { pose: Q.kick, speed: 16 };
      case 'stagger': return { pose: Q.rest, speed: 6, shake: 1 };
      case 'down': return { pose: Q.kick, speed: 3 };
      default: return { pose: Q.rest, speed: 9 };
    }
  }
  update(dt, F, move) {
    const T = this.target(F);
    let goal;
    if (T.snap) goal = mixPose(T.from, T.to, T.k);
    else if (T.back) goal = mixPose(T.pose, T.back, T.k);
    else goal = T.pose;
    if (!this.cur) this.cur = clonePose(goal);
    const s = T.snap ? 1 : 1 - Math.exp(-(T.speed || 10) * dt);
    for (let i = 0; i < 3; i++) { this.cur.p[i] = lerp(this.cur.p[i], goal.p[i], s); this.cur.r[i] = lerp(this.cur.r[i], goal.r[i], s); }
    // walking bob and a little sway when you turn
    this.bob += dt * (move.speed > 0.3 ? 6 + move.speed * 1.1 : 1.2);
    const bobA = Math.min(1, move.speed / 4) * move.bobScale;
    this.sway.x = lerp(this.sway.x, clamp(-move.turnX * 0.004, -0.06, 0.06), 1 - Math.exp(-8 * dt));
    this.sway.y = lerp(this.sway.y, clamp(move.turnY * 0.004, -0.05, 0.05), 1 - Math.exp(-8 * dt));
    this.shake = Math.max(0, this.shake - dt * 3); if (T.shake) this.shake = Math.max(this.shake, 0.4);
    const sh = this.shake * 0.03;
    const W = this.weapon;
    W.position.set(this.cur.p[0] + Math.sin(this.bob) * 0.012 * bobA + this.sway.x + (Math.random() - 0.5) * sh,
      this.cur.p[1] + Math.abs(Math.cos(this.bob)) * 0.016 * bobA + this.sway.y + (Math.random() - 0.5) * sh, this.cur.p[2]);
    W.rotation.set(this.cur.r[0], this.cur.r[1], this.cur.r[2]);
    W.updateMatrix();
    // the arms reach from the shoulders to the hands on the grip
    const off = this.poses.offHand;
    this._a.set(0, 0, 0).applyMatrix4(W.matrix); this.pointArm(this.armR, [0.42, -0.62, -0.12], this._a); this.handR.position.copy(this._a); this.handR.quaternion.copy(W.quaternion);
    this._b.set(0, off, 0).applyMatrix4(W.matrix); this.pointArm(this.armL, [-0.3, -0.64, -0.16], this._b); this.handL.position.copy(this._b); this.handL.quaternion.copy(W.quaternion);
    // the ink trail: the blade tip and a point down the blade, while striking
    const tipY = this.wk === 'yari' ? 2.2 : 0.9, midY = this.wk === 'yari' ? 1.7 : 0.35;
    const striking = F.state === 'active' || (F.state === 'recover' && F.t < 0.06);
    const tip = new THREE.Vector3(0, tipY, 0).applyMatrix4(W.matrix), mid = new THREE.Vector3(0, midY, 0).applyMatrix4(W.matrix);
    if (striking) this.trailPts.unshift([tip, mid]); else if (this.trailPts.length) this.trailPts.pop();
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
  pointArm(arm, sh, hand) {
    arm.position.set(sh[0], sh[1], sh[2]);
    const d = new THREE.Vector3().subVectors(hand, arm.position), L = d.length();
    arm.scale.set(1, 1, L);
    arm.quaternion.setFromUnitVectors(FWD, d.normalize());   // the arm is modelled along −z (camera space, so no lookAt)
  }
}
const FWD = new THREE.Vector3(0, 0, -1);
const clonePose = a => ({ p: [...a.p], r: [...a.r] });
function mixPose(a, b, k) { return { p: a.p.map((v, i) => lerp(v, b.p[i], k)), r: a.r.map((v, i) => lerp(v, b.r[i], k)) }; }
