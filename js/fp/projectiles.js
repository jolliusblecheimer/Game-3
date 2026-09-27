// Arrows and kunai in flight: they drop with distance, stick where they land, and hit targets, dummies or the ground.
import * as THREE from 'three';
import { Mesher, MAT } from '../render/geo.js';

const G = 9.8;
function arrowGeo() {
  const m = new Mesher(81, 0.03);
  m.cyl(0.008, 0.008, 0.95, 5, '#c9a36f', [0, 0, -0.475], [Math.PI / 2, 0, 0]); m.cone(0.016, 0.07, 4, '#6f7378', [0, 0, -0.98], [-Math.PI / 2, 0, 0]);
  for (const a of [0, 2.1, 4.2]) m.box(0.004, 0.035, 0.13, '#f4efe4', [Math.cos(a) * 0.013, Math.sin(a) * 0.013, -0.06]);
  return m.geometry();
}
function kunaiGeo() {
  const m = new Mesher(82, 0.03);
  m.box(0.03, 0.012, 0.16, '#8a9096', [0, 0, -0.12]); m.cone(0.022, 0.06, 4, '#aab0b6', [0, 0, -0.23], [-Math.PI / 2, 0, 0]);
  m.box(0.018, 0.018, 0.1, '#2a2624', [0, 0, 0]); m.cyl(0.025, 0.025, 0.01, 8, '#6f7378', [0, 0, 0.06], [Math.PI / 2, 0, 0]);
  return m.geometry();
}

export class Projectiles {
  constructor(parent) {
    this.parent = parent; this.list = [];
    this.geo = { arrow: arrowGeo(), kunai: kunaiGeo() };
    this._v = new THREE.Vector3(); this._q = new THREE.Quaternion(); this.FWD = new THREE.Vector3(0, 0, -1);
  }
  // pos, vel in the valley's local metres
  fire(kind, pos, vel) {
    const mesh = new THREE.Mesh(this.geo[kind], MAT.flat); mesh.castShadow = true;
    if (!this.streakMat) { this.streakMat = new THREE.MeshBasicMaterial({ color: '#fff6dc', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }); this.streakGeo = new THREE.BoxGeometry(0.012, 0.012, 1); this.streakGeo.translate(0, 0, 0.5); }
    const streak = new THREE.Mesh(this.streakGeo, this.streakMat); streak.scale.z = kind === 'arrow' ? Math.min(2.2, vel.length() * 0.03) : 0.6; mesh.add(streak);
    mesh.position.copy(pos); this.parent.add(mesh);
    const p = { kind, mesh, pos: pos.clone(), vel: vel.clone(), life: 12, stuck: false, spin: kind === 'kunai' ? 0 : null, streak };
    this.list.push(p); this.orient(p);
    if (this.list.length > 60) { const old = this.list.shift(); this.parent.remove(old.mesh); }
    return p;
  }
  orient(p) { this._v.copy(p.vel).normalize(); p.mesh.quaternion.setFromUnitVectors(this.FWD, this._v); }
  // hit(p, from, to) returns { stick: bool } when the arrow meets something along from→to, or null; ground(x, z) gives height
  update(dt, hit, ground) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.parent.remove(p.mesh); this.list.splice(i, 1); continue; }
      if (p.stuck) {
        // a stuck arrow quivers for a moment
        if (p.wob > 0) { p.wob -= dt; p.mesh.quaternion.copy(p.baseQ); p.mesh.rotateX(Math.sin(p.wob * 70) * 0.05 * p.wob / 0.45); p.mesh.rotateY(Math.cos(p.wob * 63) * 0.04 * p.wob / 0.45); }
        continue;
      }
      const from = p.pos.clone();
      p.vel.y -= G * (p.grav ?? 1) * dt;
      p.pos.addScaledVector(p.vel, dt);
      const r = hit(p, from, p.pos);
      if (r) { if (r.at) p.pos.copy(r.at); p.stuck = true; p.life = r.stick ? 20 : 0.01; p.mesh.position.copy(p.pos); p.streak.visible = false; p.baseQ = p.mesh.quaternion.clone(); p.wob = r.stick ? 0.45 : 0; continue; }
      const g = ground(p.pos.x, p.pos.z);
      if (p.pos.y <= g + 0.02) { p.pos.y = g + 0.05; p.stuck = true; p.life = 15; p.mesh.position.copy(p.pos); p.streak.visible = false; p.baseQ = p.mesh.quaternion.clone(); p.wob = 0.3; if (p.onGround) p.onGround(p); continue; }
      p.mesh.position.copy(p.pos); this.orient(p);
    }
  }
}
