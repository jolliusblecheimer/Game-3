// First-person battlefields: a valley with a river that winds the way real rivers do,
// carved banks, shallow fords, a plank bridge, trees, rocks, reeds and grass.
// Everything is in local metres around FP_ORIGIN (the valley lives far away from the village).
import * as THREE from 'three';
import { Mesher, MAT } from '../render/geo.js';
import { treeGeometry } from '../render/nature.js';
import { makeNoise2D, fbm, smoothstep, mulberry32, clamp, lerp } from '../util.js';

export const FP_ORIGIN = new THREE.Vector3(0, 0, -4000);
export const HALF = 118;              // how far you can walk from the centre
const SIZE = 380, SEG = 190;          // the terrain mesh: 2 m cells
const CELL = SIZE / SEG;
export const WATER_Y = 0;
const DEEP = 1.7, SHALLOW = 0.32;     // river depth in the channel and at a ford

export class FPTerrain {
  constructor(seed = 7) {
    this.seed = seed;
    this.rand = mulberry32(seed * 7 + 3);
    this.nA = makeNoise2D(seed + 1); this.nB = makeNoise2D(seed + 2); this.nC = makeNoise2D(seed + 3);
    this.makeRiver();
    this.makeYard();
    this.makeTrail();
    this.makeCamp();
    this.bakeHeights();
    this.colliders = [];   // circles { x, z, r } and boxes { x0, z0, x1, z1 }
  }

  /* ---------------- the river ---------------- */
  // start above the valley and walk downstream: the heading drifts with slow noise and is pulled back toward
  // the middle, which makes proper meanders; then smooth it and give it a width that changes along the way
  makeRiver() {
    const R = this.rand, n = makeNoise2D(this.seed + 11), pts = [];
    let x = (R() - 0.5) * 40, z = -SIZE / 2 - 20, a = (R() - 0.5) * 0.6;
    for (let i = 0; z < SIZE / 2 + 20 && i < 400; i++) {
      pts.push({ x, z });
      const s = i * 3;
      a += n(s * 0.012, 3.1) * 0.22 - a * 0.05 - (x / 70) * 0.05;
      a = clamp(a, -1.25, 1.25);
      x += Math.sin(a) * 3; z += Math.cos(a) * 3;
    }
    let P = pts;
    for (let k = 0; k < 3; k++) {   // Chaikin smoothing
      const Q = [P[0]];
      for (let i = 0; i < P.length - 1; i++) { const p = P[i], q = P[i + 1]; Q.push({ x: p.x * 0.75 + q.x * 0.25, z: p.z * 0.75 + q.z * 0.25 }, { x: p.x * 0.25 + q.x * 0.75, z: p.z * 0.25 + q.z * 0.75 }); }
      Q.push(P[P.length - 1]); P = Q;
    }
    let s = 0;
    for (let i = 0; i < P.length; i++) { if (i) s += Math.hypot(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z); P[i].s = s; }
    this.river = P; this.riverLen = s;
    this.wn = makeNoise2D(this.seed + 17);
    // two shallow fords and one bridge, spread along the part of the river inside the valley
    const inside = P.filter(p => Math.abs(p.x) < HALF - 20 && Math.abs(p.z) < HALF - 20);
    const pick = f => inside[Math.floor(f * (inside.length - 1))].s;
    this.fords = [pick(0.22), pick(0.78)];
    this.bridgeS = pick(0.5);
    this.buildDistField();
  }
  width(s) { return 8 + this.wn(s * 0.018, 0.5) * 4 + (this.fords.some(f => Math.abs(s - f) < 10) ? 4 : 0); }   // fords are wider and shallower
  depth(s) { let d = DEEP; for (const f of this.fords) d = Math.min(d, lerp(SHALLOW, DEEP, smoothstep(5, 11, Math.abs(s - f)))); return d; }
  // distance to the river and the position along it, on a 2 m grid (bilinear between)
  buildDistField() {
    const N = SEG + 1, D = new Float32Array(N * N), S = new Float32Array(N * N), P = this.river;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -SIZE / 2 + i * CELL, z = -SIZE / 2 + j * CELL;
      let best = 1e9, bs = 0;
      // the river always flows toward +z, so search outward from the point level with z and stop once too far
      let lo = 0, hi = P.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m].z < z) lo = m; else hi = m; }
      const seg = k => {
        const a = P[k], b = P[k + 1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
        const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / L2, 0, 1), px = a.x + dx * t, pz = a.z + dz * t, d = (x - px) ** 2 + (z - pz) ** 2;
        if (d < best) { best = d; bs = a.s + (b.s - a.s) * t; }
      };
      for (let k = lo; k < P.length - 1; k++) { if ((P[k].z - z) ** 2 > best) break; seg(k); }
      for (let k = lo - 1; k >= 0; k--) { if ((P[k + 1].z - z) ** 2 > best) break; seg(k); }
      D[j * N + i] = Math.sqrt(best); S[j * N + i] = bs;
    }
    this.dField = D; this.sField = S;
  }
  field(F, x, z) {
    const N = SEG + 1, fx = clamp((x + SIZE / 2) / CELL, 0, SEG - 0.001), fz = clamp((z + SIZE / 2) / CELL, 0, SEG - 0.001);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * N + i;
    return lerp(lerp(F[k], F[k + 1], u), lerp(F[k + N], F[k + N + 1], u), v);
  }
  riverAt(x, z) { return { d: this.field(this.dField, x, z), s: this.field(this.sField, x, z) }; }
  // a point and direction on the river at arc length s
  alongRiver(s) {
    const P = this.river; let i = 1; while (i < P.length - 1 && P[i].s < s) i++;
    const a = P[i - 1], b = P[i], t = clamp((s - a.s) / ((b.s - a.s) || 1), 0, 1), dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
    return { x: a.x + dx * t, z: a.z + dz * t, dx: dx / L, dz: dz / L };
  }

  /* ---------------- the training yard, the trail, the bridge ---------------- */
  makeYard() {
    // beside the river, on the side with more room, 30 m from the water
    const B = this.alongRiver(this.bridgeS), nx = -B.dz, nz = B.dx, side = (B.x + nx * 30) ** 2 + (B.z + nz * 30) ** 2 < (B.x - nx * 30) ** 2 + (B.z - nz * 30) ** 2 ? 1 : -1;
    const Y = this.alongRiver(this.bridgeS + 28);
    this.yard = { x: Y.x + nx * side * 34, z: Y.z + nz * side * 34, r: 15 };
    const L = this.width(this.bridgeS) + 7;
    this.bridge = { x: B.x, z: B.z, ax: nx, az: nz, len: L, half: 1.25, deck: 0.95 };
    this.spawn = { x: this.yard.x - nx * side * 6, z: this.yard.z - nz * side * 6 };
    this.side = side;
  }
  makeTrail() {
    // from the yard to the bridge, over it, and on up the far side
    const b = this.bridge, s = this.side, y = this.yard, pts = [];
    const end1 = { x: b.x + b.ax * s * (b.len / 2 + 1), z: b.z + b.az * s * (b.len / 2 + 1) }, end2 = { x: b.x - b.ax * s * (b.len / 2 + 1), z: b.z - b.az * s * (b.len / 2 + 1) };
    const line = (p, q, n) => { for (let i = 0; i <= n; i++) pts.push({ x: lerp(p.x, q.x, i / n), z: lerp(p.z, q.z, i / n) }); };
    line(y, end1, 20); line(end2, { x: end2.x - b.ax * s * 60, z: end2.z - b.az * s * 60 }, 30);
    this.trail = pts;
  }
  // the bandit camp: past the far end of the bridge, on the far side, kept well inside the valley and off the river
  makeCamp() {
    const b = this.bridge, s = this.side, lim = HALF - 30;
    let best = null;
    for (const dist of [55, 50, 45, 40, 35, 30]) for (const turn of [0, 0.4, -0.4, 0.8, -0.8]) {
      const ax = -b.ax * s, az = -b.az * s, c = Math.cos(turn), sn = Math.sin(turn), dx = ax * c - az * sn, dz = ax * sn + az * c;
      const x = b.x + dx * (b.len / 2 + dist), z = b.z + dz * (b.len / 2 + dist);
      if (Math.abs(x) > lim || Math.abs(z) > lim) continue;
      if (this.riverAt(x, z).d < this.width(this.riverAt(x, z).s) / 2 + 18) continue;
      if (Math.hypot(x - this.yard.x, z - this.yard.z) < this.yard.r + 30) continue;
      best = { x, z, r: 13 }; break;
    }
    if (!best) best = { x: b.x - b.ax * s * 40, z: b.z - b.az * s * 40, r: 13 };
    this.camp = best;
    // the trail goes on from the bridge to the camp
    const e2 = { x: b.x - b.ax * s * (b.len / 2 + 1), z: b.z - b.az * s * (b.len / 2 + 1) };
    const i = this.trail.findIndex(p => Math.hypot(p.x - e2.x, p.z - e2.z) < 0.5);
    this.trail.length = Math.max(0, i);
    for (let k = 0; k <= 30; k++) this.trail.push({ x: lerp(e2.x, best.x, k / 30), z: lerp(e2.z, best.z, k / 30) });
  }
  trailDist(x, z) { let d = 1e9; for (const p of this.trail) d = Math.min(d, (p.x - x) ** 2 + (p.z - z) ** 2); return Math.sqrt(d); }
  // the bridge deck: a gentle arch; returns its height, or null when not on it
  deckAt(x, z) {
    const b = this.bridge, u = (x - b.x) * b.ax + (z - b.z) * b.az, v = -(x - b.x) * b.az + (z - b.z) * b.ax;
    if (Math.abs(u) > b.len / 2 || Math.abs(v) > b.half) return null;
    return b.deck + 0.4 * (1 - (2 * u / b.len) ** 2);
  }
  bridgeLocal(x, z) { const b = this.bridge; return { u: (x - b.x) * b.ax + (z - b.z) * b.az, v: -(x - b.x) * b.az + (z - b.z) * b.ax }; }

  /* ---------------- height ---------------- */
  rawHeight(x, z) {
    const { nA, nB, nC } = this;
    let h = 1.1 + fbm(nA, x * 0.011, z * 0.011, 4) * 2.4 + fbm(nB, x * 0.05, z * 0.05, 2) * 0.35;
    const { d, s } = this.riverAt(x, z);
    h += Math.max(0, fbm(nC, x * 0.009 + 5, z * 0.009, 4) + 0.1) * 16 * smoothstep(34, 110, d);   // hills away from the river
    const e = Math.max(Math.abs(x), Math.abs(z));
    h += smoothstep(HALF - 14, HALF + 70, e) * (38 + fbm(nB, x * 0.02, z * 0.02, 3) * 22);            // mountains around the valley
    h = Math.max(h, 0.45);
    // the training yard is levelled
    const y = this.yard, dy = Math.hypot(x - y.x, z - y.z);
    if (dy < y.r + 10) h = lerp(this.yardY ?? h, h, smoothstep(y.r, y.r + 10, dy));
    const cp = this.camp, dc = cp ? Math.hypot(x - cp.x, z - cp.z) : 1e9;   // and so is the bandits' clearing
    if (dc < cp?.r + 12) h = lerp(this.campY ?? h, h, smoothstep(cp.r, cp.r + 12, dc));
    // the flood plain and the channel
    const w = this.width(s) / 2, dep = this.depth(s);
    h = lerp(0.62, h, smoothstep(w + 1.5, w + 16, d));
    if (d < w + 1.5) {
      const t = clamp(d / (w + 1.5), 0, 1);
      h = lerp(WATER_Y - dep, 0.62, smoothstep(0.45, 1, t));
    }
    // a worn trail
    return h;
  }
  bakeHeights() {
    this.yardY = null; this.yardY = Math.max(0.9, this.rawHeight(this.yard.x, this.yard.z));
    this.campY = null; this.campY = Math.max(0.9, Math.min(8, this.rawHeight(this.camp.x, this.camp.z)));
    const N = SEG + 1, H = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = this.rawHeight(-SIZE / 2 + i * CELL, -SIZE / 2 + j * CELL);
    this.H = H;
  }
  // the ground you stand on: terrain, or the bridge deck
  terrainAt(x, z) { return this.field(this.H, x, z); }
  groundAt(x, z) { const t = this.terrainAt(x, z), d = this.deckAt(x, z); return d != null ? Math.max(t, d) : t; }
  waterDepth(x, z) { return this.deckAt(x, z) != null ? 0 : Math.max(0, WATER_Y - this.terrainAt(x, z)); }

  /* ---------------- building the meshes ---------------- */
  build(season = 0) {
    const root = new THREE.Group(); root.name = 'fp-valley';
    root.add(this.buildGround(season), this.buildWater(), this.buildBridge());
    for (const o of this.scatter(season)) root.add(o);
    this.root = root;
    return root;
  }
  buildGround(season) {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI / 2);
    const P = g.attributes.position, N = SEG + 1, col = new Float32Array(P.count * 3), c = new THREE.Color();
    const winter = season === 3, autumn = season === 2;
    for (let k = 0; k < P.count; k++) {
      const x = P.getX(k), z = P.getZ(k), i = Math.round((x + SIZE / 2) / CELL), j = Math.round((z + SIZE / 2) / CELL);
      const h = this.H[j * N + i]; P.setY(k, h);
      const hx = this.H[j * N + Math.min(SEG, i + 1)] - this.H[j * N + Math.max(0, i - 1)], hz = this.H[Math.min(SEG, j + 1) * N + i] - this.H[Math.max(0, j - 1) * N + i];
      const slope = Math.hypot(hx, hz) / (2 * CELL), n = fbm(this.nC, x * 0.08, z * 0.08, 2), { d, s } = this.riverAt(x, z), w = this.width(s) / 2;
      if (h < WATER_Y - 0.05) c.set(d < w * 0.5 ? '#4f5a44' : '#6b6a52');                       // the river bed
      else if (d < w + 2.2 && h < 0.8) c.set(n > 0 ? '#a49b86' : '#8f866f');                     // pebbles and gravel at the water's edge
      else if (d < w + 5 && h < 0.9) c.set('#6f6446');                                          // mud on the bank
      else if (slope > 0.8 || h > 26) c.set(n > 0 ? '#7c766b' : '#6d685f');                    // rock
      else if (Math.hypot(x - this.yard.x, z - this.yard.z) < this.yard.r - 1) c.set(n > 0.2 ? '#d9cfb4' : '#e2d9c0'); // the yard's sand
      else if (this.trailDist(x, z) < 1.4) c.set('#9c8563');                                    // the trail
      else if (winter) c.set(n > 0 ? '#e8edf2' : '#dfe5ea');
      else if (autumn) c.set(n > 0.2 ? '#9a8a45' : n < -0.25 ? '#7d7a3c' : '#8b8740');
      else c.set(n > 0.25 ? '#76a04c' : n < -0.3 ? '#5c8a3e' : '#69964a');
      c.offsetHSL(0, 0, this.nA(x * 0.3, z * 0.3) * 0.02);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, MAT.flat); m.receiveShadow = true; m.name = 'fp-ground';
    return m;
  }
  // the water: a ribbon that follows the river, with streaks that drift downstream
  buildWater() {
    const P = this.river, pos = [], uv = [], idx = [];
    for (let i = 0; i < P.length; i++) {
      const p = P[i], q = P[Math.min(P.length - 1, i + 1)], o = P[Math.max(0, i - 1)], dx = q.x - o.x, dz = q.z - o.z, L = Math.hypot(dx, dz) || 1;
      const nx = -dz / L, nz = dx / L, w = this.width(p.s) / 2 + 1.4;
      pos.push(p.x + nx * w, WATER_Y, p.z + nz * w, p.x - nx * w, WATER_Y, p.z - nz * w);
      uv.push(0, p.s / 9, 1, p.s / 9);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const x = cv.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(210,235,245,${0.25 + Math.random() * 0.35})`; x.fillRect(Math.random() * 64, Math.random() * 256, 1 + Math.random() * 2, 10 + Math.random() * 40); }
    for (let i = 0; i < 20; i++) { x.fillStyle = 'rgba(40,90,110,0.18)'; x.fillRect(Math.random() * 64, Math.random() * 256, 2, 20 + Math.random() * 50); }
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
    this.waterTex = tex;
    const mat = new THREE.MeshStandardMaterial({ color: '#4d8aa6', map: tex, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.84, depthWrite: false });
    const m = new THREE.Mesh(g, mat); m.renderOrder = 2; m.name = 'fp-river';
    return m;
  }
  buildBridge() {
    const b = this.bridge, m = new Mesher(this.seed + 5, 0.06), ang = Math.atan2(b.ax, b.az);
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      const u = -b.len / 2 + (i + 0.5) * b.len / steps, y = b.deck + 0.4 * (1 - (2 * u / b.len) ** 2);
      m.box(b.half * 2, 0.14, b.len / steps + 0.02, i % 2 ? '#7a5438' : '#8b6040', [0, y - 0.07, u], [Math.atan2(-0.8 * u / (b.len / 2) ** 2 * 0.4 * 2, 1), 0, 0]);
    }
    for (const sv of [-1, 1]) {
      for (let i = 0; i <= 6; i++) { const u = -b.len / 2 + i * b.len / 6, y = b.deck + 0.4 * (1 - (2 * u / b.len) ** 2); m.box(0.12, 0.9, 0.12, '#5a3a28', [sv * (b.half - 0.05), y + 0.4, u]); }
      for (let i = 0; i < 6; i++) { const u0 = -b.len / 2 + i * b.len / 6, u1 = u0 + b.len / 6, y0 = b.deck + 0.4 * (1 - (2 * u0 / b.len) ** 2), y1 = b.deck + 0.4 * (1 - (2 * u1 / b.len) ** 2); m.box(0.08, 0.08, b.len / 6 + 0.1, '#6b4a33', [sv * (b.half - 0.05), (y0 + y1) / 2 + 0.82, (u0 + u1) / 2], [Math.atan2(y0 - y1, b.len / 6), 0, 0]); }
      for (const u of [-b.len / 4, 0, b.len / 4]) m.box(0.22, 2.4, 0.22, '#4a3222', [sv * (b.half - 0.2), -0.8, u]);   // piles into the river bed
    }
    const mesh = m.mesh(); mesh.position.set(b.x, 0, b.z); mesh.rotation.y = ang; mesh.name = 'fp-bridge';
    return mesh;
  }
  // trees, rocks, reeds, stepping stones and grass (instanced)
  scatter(season) {
    const R = mulberry32(this.seed * 13 + 1), out = [], dummy = new THREE.Object3D();
    const ok = (x, z, clear) => {
      const { d, s } = this.riverAt(x, z);
      if (d < this.width(s) / 2 + clear) return false;
      if (Math.hypot(x - this.yard.x, z - this.yard.z) < this.yard.r + 3) return false;
      if (Math.hypot(x - this.camp.x, z - this.camp.z) < this.camp.r + 4) return false;
      if (this.trailDist(x, z) < 2.4) return false;
      if (Math.hypot(x - this.bridge.x, z - this.bridge.z) < this.bridge.len / 2 + 4) return false;
      return true;
    };
    // trees: in groves (noise), thicker toward the hills
    const types = ['pine', 'cedar', 'maple', 'sakura'], lists = { pine: [], cedar: [], maple: [], sakura: [] };
    for (let i = 0; i < 2000; i++) {
      const x = (R() - 0.5) * (SIZE - 20), z = (R() - 0.5) * (SIZE - 20), dens = fbm(this.nB, x * 0.02 + 3, z * 0.02, 3) + (Math.max(Math.abs(x), Math.abs(z)) > HALF - 10 ? 0.5 : 0);
      if (dens < 0.12 || !ok(x, z, 5)) continue;
      const h = this.terrainAt(x, z); if (h > 30) continue;
      const t = types[Math.floor(R() * (dens > 0.4 ? 2 : 4))];
      lists[t].push({ x, z, y: h - 0.1, s: 0.8 + R() * 0.6, r: R() * 6.28 });
      if (Math.abs(x) < HALF + 4 && Math.abs(z) < HALF + 4) this.colliders.push({ x, z, r: 0.45 });
    }
    for (const t of types) {
      const L = lists[t]; if (!L.length) continue;
      const im = new THREE.InstancedMesh(treeGeometry(t, season), MAT.flat, L.length);
      L.forEach((p, k) => { dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, p.r, 0); dummy.scale.setScalar(p.s); dummy.updateMatrix(); im.setMatrixAt(k, dummy.matrix); });
      im.castShadow = true; im.receiveShadow = true; out.push(im);
    }
    // rocks: boulders in the fields, more along the river's fast stretches
    const rockG = new Mesher(3, 0.1).add(new THREE.DodecahedronGeometry(1, 0), '#8a857a').geometry();
    const rocks = [];
    for (let i = 0; i < 700 && rocks.length < 160; i++) {
      const x = (R() - 0.5) * (SIZE - 30), z = (R() - 0.5) * (SIZE - 30);
      const { d, s } = this.riverAt(x, z), w = this.width(s) / 2;
      const nearWater = d > w - 1 && d < w + 4 && this.depth(s) > 1;
      if (!nearWater && (R() < 0.7 || !ok(x, z, 4))) continue;
      if (Math.hypot(x - this.yard.x, z - this.yard.z) < this.yard.r + 3 || Math.hypot(x - this.camp.x, z - this.camp.z) < this.camp.r + 4 || this.trailDist(x, z) < 2.4) continue;
      const sc = nearWater ? 0.5 + R() * 0.8 : 0.4 + R() * 1.3;
      rocks.push({ x, z, y: this.terrainAt(x, z) + sc * 0.2, s: sc, r: R() * 6 });
      if (sc > 0.7 && Math.abs(x) < HALF && Math.abs(z) < HALF) this.colliders.push({ x, z, r: sc * 0.85 });
    }
    const rim = new THREE.InstancedMesh(rockG, MAT.flat, rocks.length);
    rocks.forEach((p, k) => { dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.r, p.r * 2, 0); dummy.scale.set(p.s * 1.2, p.s * 0.75, p.s); dummy.updateMatrix(); rim.setMatrixAt(k, dummy.matrix); });
    rim.castShadow = true; rim.receiveShadow = true; out.push(rim);
    // reeds along the banks
    const reedG = new Mesher(4, 0.12).box(0.04, 1.1, 0.04, '#7d8a45', [0, 0.55, 0]).box(0.04, 0.9, 0.04, '#8e9a52', [0.1, 0.45, 0.06], [0.2, 0, 0.15]).box(0.04, 1.0, 0.04, '#6f7c3c', [-0.08, 0.5, -0.05], [-0.15, 0, -0.2]).box(0.07, 0.22, 0.07, '#5a4630', [0, 1.05, 0]).geometry();
    const reeds = [];
    for (let k = 0; k < this.river.length; k += 1) {
      const p = this.river[k]; if (Math.abs(p.x) > HALF + 20 || Math.abs(p.z) > HALF + 20) continue;
      const q = this.river[Math.min(this.river.length - 1, k + 1)], dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1, w = this.width(p.s) / 2;
      if (Math.abs(p.s - this.bridgeS) < 8) continue;
      for (const sd of [-1, 1]) if (R() < 0.55) for (let n = 0; n < 3; n++) {
        const off = w + 0.2 + R() * 2.2, x = p.x - dz / L * sd * off + (R() - 0.5), z = p.z + dx / L * sd * off + (R() - 0.5);
        if (Math.hypot(x - this.yard.x, z - this.yard.z) < this.yard.r + 3) continue;   // not inside the training yard
        reeds.push({ x, z, y: this.terrainAt(x, z) - 0.1, s: 0.7 + R() * 0.6, r: R() * 6 });
      }
    }
    const rdm = new THREE.InstancedMesh(reedG, MAT.flat, reeds.length);
    reeds.forEach((p, k) => { dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, p.r, 0); dummy.scale.setScalar(p.s); dummy.updateMatrix(); rdm.setMatrixAt(k, dummy.matrix); });
    out.push(rdm);
    // stepping stones across the fords
    const stoneG = new Mesher(5, 0.08).cyl(0.5, 0.6, 0.5, 7, '#9a958a', [0, 0, 0]).geometry(), stones = [];
    for (const f of this.fords) {
      const p = this.alongRiver(f), nx = -p.dz, nz = p.dx, w = this.width(f) / 2;
      for (let u = -w + 0.6; u <= w - 0.6; u += 1.3) { const x = p.x + nx * u + (R() - 0.5) * 0.4, z = p.z + nz * u + (R() - 0.5) * 0.4; stones.push({ x, z, y: this.terrainAt(x, z) + 0.2 }); }
    }
    const stm = new THREE.InstancedMesh(stoneG, MAT.flat, Math.max(1, stones.length));
    stones.forEach((p, k) => { dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, k, 0); dummy.scale.set(1, 1, 0.85); dummy.updateMatrix(); stm.setMatrixAt(k, dummy.matrix); });
    stm.receiveShadow = true; out.push(stm);
    // grass tufts
    if (season !== 3) {
      const grassG = new Mesher(6, 0.1).cone(0.12, 0.42, 4, '#ffffff', [0, 0.2, 0]).cone(0.09, 0.32, 4, '#ffffff', [0.1, 0.15, 0.05], [0.25, 0, 0.2]).cone(0.09, 0.36, 4, '#ffffff', [-0.08, 0.17, -0.06], [-0.2, 0, -0.25]).geometry();
      const G = [];
      for (let i = 0; i < 7000 && G.length < 3200; i++) {
        const x = (R() - 0.5) * (HALF * 2 + 20), z = (R() - 0.5) * (HALF * 2 + 20);
        const { d, s } = this.riverAt(x, z); if (d < this.width(s) / 2 + 0.6) continue;
        if (Math.hypot(x - this.yard.x, z - this.yard.z) < this.yard.r || this.trailDist(x, z) < 1.2) continue;
        const h = this.terrainAt(x, z); if (h > 20) continue;
        G.push({ x, z, y: h, s: 0.7 + R() * 0.9 });
      }
      const gm = new THREE.InstancedMesh(grassG, MAT.flat, G.length), gc = new THREE.Color();
      G.forEach((p, k) => {
        dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, k * 1.7, 0); dummy.scale.setScalar(p.s); dummy.updateMatrix(); gm.setMatrixAt(k, dummy.matrix);
        gm.setColorAt(k, gc.setHSL(season === 2 ? 0.12 : 0.26, 0.4, 0.33 + ((k * 7) % 20) / 100));
      });
      out.push(gm);
    }
    return out;
  }
  update(dt) { if (this.waterTex) this.waterTex.offset.y -= dt * 0.09; }
}
