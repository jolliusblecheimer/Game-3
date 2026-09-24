// Geometry toolkit. Every model is built from simple primitives that are baked
// into ONE vertex-coloured, flat-shaded mesh — few draw calls, fast on iPad.
import * as THREE from 'three';
import { mulberry32 } from '../util.js';

export const MAT = {};
export function initMaterials() {
  MAT.flat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 });
  // Lanterns, windows, fires: glow at night (emissiveIntensity driven by the day cycle).
  MAT.glow = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6, emissive: new THREE.Color('#ffae55'), emissiveIntensity: 0 });
  MAT.water = new THREE.MeshStandardMaterial({ color: '#3f86a6', roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.86 });
  MAT.ghostOk = new THREE.MeshBasicMaterial({ color: '#7be08f', transparent: true, opacity: 0.45, depthWrite: false });
  MAT.ghostBad = new THREE.MeshBasicMaterial({ color: '#ff6b5a', transparent: true, opacity: 0.45, depthWrite: false });
  MAT.select = new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.55, depthWrite: false });
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3();

// Closed frustum (tapered box): bottom w×d, top w2×d2, height h. Base sits on y=0.
function frustumGeo(wb, db, wt, dt, h, offX = 0, offZ = 0) {
  const B = [[-wb / 2, 0, -db / 2], [wb / 2, 0, -db / 2], [wb / 2, 0, db / 2], [-wb / 2, 0, db / 2]];
  const T = [[-wt / 2 + offX, h, -dt / 2 + offZ], [wt / 2 + offX, h, -dt / 2 + offZ], [wt / 2 + offX, h, dt / 2 + offZ], [-wt / 2 + offX, h, dt / 2 + offZ]];
  const quads = [[B[0], B[1], B[2], B[3]], [T[0], T[1], T[2], T[3]]];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quads.push([B[i], B[j], T[j], T[i]]); }
  const pos = [], cx = offX / 2, cy = h / 2, cz = offZ / 2;
  for (const q of quads) {
    for (const tri of [[q[0], q[1], q[2]], [q[0], q[2], q[3]]]) {
      // orient every triangle outward (normal points away from the centre)
      _a.fromArray(tri[0]); _b.fromArray(tri[1]); _d.fromArray(tri[2]);
      _n.subVectors(_b, _a).cross(_d.clone().sub(_a));
      const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3 - cx, my = (tri[0][1] + tri[1][1] + tri[2][1]) / 3 - cy, mz = (tri[0][2] + tri[1][2] + tri[2][2]) / 3 - cz;
      const t = _n.x * mx + _n.y * my + _n.z * mz < 0 ? [tri[0], tri[2], tri[1]] : tri;
      for (const v of t) pos.push(v[0], v[1], v[2]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

export class Mesher {
  constructor(seed = 1, jitter = 0.05) { this.p = []; this.n = []; this.c = []; this.rand = mulberry32(seed); this.jitter = jitter; }
  add(geo, hex, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1], jitter = this.jitter) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    g.deleteAttribute('uv');
    _m.compose(_p.fromArray(pos), _q.setFromEuler(_e.set(rot[0], rot[1], rot[2])), _s.fromArray(scl));
    g.applyMatrix4(_m);
    g.computeVertexNormals();
    const P = g.attributes.position.array, N = g.attributes.normal.array;
    _c.set(hex);
    for (let i = 0; i < P.length; i += 9) {
      const f = 1 + (this.rand() - 0.5) * 2 * jitter; // per-face shade variation = hand-made feel
      for (let k = 0; k < 9; k += 3) {
        this.p.push(P[i + k], P[i + k + 1], P[i + k + 2]);
        this.n.push(N[i + k], N[i + k + 1], N[i + k + 2]);
        this.c.push(_c.r * f, _c.g * f, _c.b * f);
      }
    }
    g.dispose();
    return this;
  }
  box(w, h, d, hex, pos, rot, jitter) { return this.add(new THREE.BoxGeometry(w, h, d), hex, pos, rot, undefined, jitter); }
  cyl(rt, rb, h, seg, hex, pos, rot, scl) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), hex, pos, rot, scl); }
  cone(r, h, seg, hex, pos, rot, scl) { return this.add(new THREE.ConeGeometry(r, h, seg), hex, pos, rot, scl); }
  ball(r, hex, pos, scl, detail = 0) { return this.add(new THREE.IcosahedronGeometry(r, detail), hex, pos, [0, 0, 0], scl); }
  frustum(wb, db, wt, dt, h, hex, pos, rot) { return this.add(frustumGeo(wb, db, wt, dt, h), hex, pos, rot); }
  // Japanese hip roof with flared eaves: a shallow wide skirt under a steep upper roof.
  roof(w, d, h, hex, y = 0, { over = 0.6, ridge = 0.45, ridgeHex = '#2a2e36', cx = 0, cz = 0, rotY = 0, ornaments = null } = {}) {
    const W = w + over * 2, D = d + over * 2, h1 = h * 0.22, h2 = h * 0.78;
    const mW = w + over * 0.5, mD = d + over * 0.5;
    this.frustum(W, D, mW, mD, h1, hex, [cx, y, cz], [0, rotY, 0]);
    const rl = Math.max(0.2, (rotY ? D : W) * 0), topW = Math.max(0.3, mW - mD * (1 - ridge) * 0.9), topD = mD * 0.12;
    this.frustum(mW, mD, topW, topD, h2, hex, [cx, y + h1, cz], [0, rotY, 0]);
    this.box(topW + 0.25, 0.22, topD + 0.2, ridgeHex, [cx, y + h + 0.05, cz], [0, rotY, 0]);
    if (ornaments) for (const s of [-1, 1]) {
      const ox = Math.cos(rotY) * s * (topW / 2 + 0.1), oz = -Math.sin(rotY) * s * (topW / 2 + 0.1);
      this.box(0.14, 0.4, 0.16, ornaments, [cx + ox, y + h + 0.3, cz + oz], [0, rotY, s * 0.35]);
    }
    return this;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
  mesh(mat = MAT.flat, cast = true, receive = true) {
    const m = new THREE.Mesh(this.geometry(), mat);
    m.castShadow = cast; m.receiveShadow = receive;
    return m;
  }
  get empty() { return this.p.length === 0; }
}

// Builds a model as a group of two meshes: normal parts + glowing parts.
export class ModelBuilder {
  constructor(seed = 1) { this.m = new Mesher(seed); this.g = new Mesher(seed + 7, 0.02); }
  finish(name = '') {
    const group = new THREE.Group(); group.name = name;
    if (!this.m.empty) group.add(this.m.mesh(MAT.flat));
    if (!this.g.empty) group.add(this.g.mesh(MAT.glow, false));
    return group;
  }
}
