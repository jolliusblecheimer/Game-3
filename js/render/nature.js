// Terrain, forests, rocks and grass. The village plot (a 72×72 grid of 2-unit
// cells centred on the origin; 48×48 before version 2.1) is perfectly flat; hills and mountains rise around it.
import * as THREE from 'three';
import { Mesher, MAT } from './geo.js';
import { makeNoise2D, fbm, smoothstep, mulberry32, clamp } from '../util.js';

export const PLOT = { n: 72, cell: 2, half: 72 };
export const OLD_PLOT_N = 48;                       // saves from before the plot grew
const OLD_OFF = (PLOT.n - OLD_PLOT_N) / 2;          // the old plot sits in the middle of the new one
const FLAT = PLOT.half + 2;
const nA = makeNoise2D(7), nB = makeNoise2D(13), nC = makeNoise2D(29);

export function heightAt(x, z) {
  const dx = Math.max(Math.abs(x) - FLAT, 0), dz = Math.max(Math.abs(z) - FLAT, 0), d = Math.hypot(dx, dz);
  if (d <= 0) return 0;
  const edge = smoothstep(0, 36, d);
  const rolling = fbm(nA, x * 0.011, z * 0.011, 4) * 7 + fbm(nB, x * 0.035, z * 0.035, 3) * 2.2 + 4;
  const m = Math.max(0, fbm(nB, x * 0.0055 + 10, z * 0.0055 - 4, 5) * 0.5 + 0.55);
  const mountains = Math.pow(m, 2.3) * 110 * smoothstep(40, 230, d);
  let h = edge * (rolling + mountains);
  // a lake to the south-east of the village
  const lk = Math.hypot((x - 150) * 0.85, z - 80);
  h -= smoothstep(52, 14, lk) * (h + 3.5);
  return h;
}

function terrainColor(c, x, z, h, slope) {
  const n = fbm(nC, x * 0.05, z * 0.05, 3), n2 = nA(x * 0.2, z * 0.2);
  const inPlot = Math.abs(x) < FLAT && Math.abs(z) < FLAT;
  if (h < -0.6) c.set('#b9a77a');                                // lake shore sand
  else if (h > 70 && slope < 0.9) c.set('#eef2f6');              // snow caps
  else if (slope > 0.75 || h > 48) c.set(n > 0 ? '#7c766b' : '#6d685f'); // rock
  else if (inPlot) c.set(n > 0.25 ? '#86ad57' : n < -0.3 ? '#6c9446' : '#79a24e');
  else c.set(n > 0.2 ? '#6f9748' : n < -0.25 ? '#55803b' : '#62893f');
  c.offsetHSL(0, 0, n2 * 0.025);
  return c;
}

const TREE_TYPES = ['pine', 'maple', 'sakura', 'cedar'];
// leaf colours through the year (season -1 = the classic look: red maples, pink sakura)
const LEAVES = {
  maple: [['#7fae4a', '#9cc25a', '#6a9a3e', '#a6c86a'], ['#4f7d3a', '#5f8a3e', '#46733a', '#6a9a44'], ['#c8452b', '#dc6a2f', '#b8392a', '#e0873a'], null],
  sakura: [['#f4b8c8', '#f7c9d6', '#eea3b9', '#fbd6e1'], ['#5f8a3e', '#6f9a4a', '#557f3a', '#7aa652'], ['#d9a23a', '#c8702e', '#e0b04a', '#b85a2a'], null],
};
function treeGeometry(type, season = -1) {
  const m = new Mesher(type.length * 31, 0.07), snow = season === 3;
  if (type === 'pine') {
    m.cyl(0.18, 0.28, 2.4, 6, '#5a3d2a', [0, 1.2, 0]);
    m.cone(1.9, 2.6, 7, '#2f5a36', [0, 2.8, 0]); m.cone(1.5, 2.3, 7, '#35653c', [0.1, 4.0, 0], [0, 0.5, 0]); m.cone(1.0, 1.9, 7, '#3b6f42', [0, 5.1, 0.05], [0, 1, 0]);
    if (snow) { m.cone(1.25, 0.9, 7, '#eef2f6', [0, 3.75, 0]); m.cone(1.0, 0.8, 7, '#eef2f6', [0.1, 4.85, 0], [0, 0.5, 0]); m.cone(0.62, 0.9, 7, '#f6f8fa', [0, 5.7, 0.05], [0, 1, 0]); }
  } else if (type === 'cedar') {
    m.cyl(0.2, 0.3, 3, 6, '#5b3b28', [0, 1.5, 0]);
    m.cone(1.4, 6.5, 7, '#2c4f33', [0, 5.2, 0]);
    if (snow) m.cone(0.75, 2.6, 7, '#eef2f6', [0, 7.25, 0]);
  } else {
    const maple = type === 'maple', L = season < 0 ? LEAVES[type][maple ? 2 : 0] : LEAVES[type][season];
    if (maple) { m.cyl(0.16, 0.26, 2.6, 6, '#4b3326', [0, 1.3, 0]); m.cyl(0.08, 0.12, 1.4, 5, '#4b3326', [0.45, 2.5, 0], [0, 0, -0.7]); }
    else { m.cyl(0.18, 0.3, 2.2, 6, '#4a3530', [0, 1.1, 0], [0, 0, 0.08]); m.cyl(0.09, 0.13, 1.6, 5, '#4a3530', [-0.55, 2.4, 0], [0, 0, 0.8]); }
    if (L) {
      if (maple) { m.ball(1.25, L[0], [0, 3.5, 0], [1.2, 0.85, 1.2]); m.ball(0.95, L[1], [0.9, 3.1, 0.3], [1, 0.8, 1]); m.ball(0.9, L[2], [-0.7, 3.0, -0.5], [1, 0.8, 1]); m.ball(0.8, L[3], [0.1, 4.2, 0.4]); }
      else { m.ball(1.3, L[0], [0, 3.2, 0], [1.3, 0.8, 1.2]); m.ball(1.0, L[1], [-1.0, 2.9, 0.3], [1.1, 0.75, 1]); m.ball(0.9, L[2], [0.9, 2.8, -0.4], [1, 0.8, 1]); m.ball(0.8, L[3], [0.2, 3.9, 0.3]); }
    } else {   // winter: bare branches with a little snow
      const tr = maple ? '#4b3326' : '#4a3530';
      for (let i = 0; i < 5; i++) { const a = i * 1.26; m.cyl(0.05, 0.08, 1.5, 4, tr, [Math.cos(a) * 0.5, 3.1 + (i % 2) * 0.4, Math.sin(a) * 0.5], [Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7]); }
      m.ball(0.35, '#eef2f6', [0, 2.75, 0], [1.4, 0.4, 1.4]);
    }
  }
  return m.geometry();
}

export class Nature {
  constructor(scene, seed, quality) {
    this.scene = scene; this.seed = seed; this.quality = quality;
    this.rand = mulberry32(seed);
    this.buildTerrain();
    this.treeGeo = Object.fromEntries(TREE_TYPES.map(t => [t, treeGeometry(t)]));
    this.buildForest();
    this.buildPlotTrees();
    this.buildRocks();
    this.buildGrass();
  }

  buildTerrain() {
    const size = 900, seg = this.quality === 'low' ? 150 : 230;
    const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
    const P = g.attributes.position, cols = new Float32Array(P.count * 3), c = new THREE.Color();
    for (let i = 0; i < P.count; i++) P.setY(i, heightAt(P.getX(i), P.getZ(i)));
    g.computeVertexNormals();
    const N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      const slope = 1 - N.getY(i);
      terrainColor(c, P.getX(i), P.getZ(i), P.getY(i), slope * 3);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    this.terrain = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
  }

  buildForest() {
    const count = this.quality === 'low' ? 900 : this.quality === 'medium' ? 1800 : 3000;
    const r = this.rand, buckets = Object.fromEntries(TREE_TYPES.map(t => [t, []]));
    let tries = 0;
    while (tries++ < count * 6 && Object.values(buckets).reduce((a, b) => a + b.length, 0) < count) {
      const x = (r() - 0.5) * 760, z = (r() - 0.5) * 760;
      if (Math.abs(x) < FLAT + 6 && Math.abs(z) < FLAT + 6) continue;
      const h = heightAt(x, z);
      if (h < -0.4 || h > 52) continue;
      if (fbm(nC, x * 0.012, z * 0.012, 3) < -0.05 && r() > 0.15) continue;
      const hh = heightAt(x + 1.5, z) - h, slope = Math.abs(hh) + Math.abs(heightAt(x, z + 1.5) - h);
      if (slope > 2.2) continue;
      const type = h > 26 ? (r() < 0.6 ? 'cedar' : 'pine') : r() < 0.45 ? 'pine' : r() < 0.55 ? 'maple' : r() < 0.6 ? 'cedar' : 'sakura';
      buckets[type].push([x, h - 0.2, z, 0.8 + r() * 0.7, r() * 6.28]);
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    for (const t of TREE_TYPES) {
      const list = buckets[t]; if (!list.length) continue;
      const im = new THREE.InstancedMesh(this.treeGeo[t], MAT.flat, list.length);
      list.forEach(([x, y, z, s, a], i) => {
        m4.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(s, s * (0.9 + (i % 5) * 0.05), s));
        im.setMatrixAt(i, m4); im.setColorAt(i, c.setHSL(0, 0, 0.85 + ((i * 37) % 30) / 100));
      });
      im.castShadow = true; im.receiveShadow = true;
      this.scene.add(im); (this.forestMesh = this.forestMesh || {})[t] = im;
    }
  }
  // the year turns: trees change their leaves, the ground and grass their colour
  setSeason(season) {
    if (season === this.seasonNow) return; this.seasonNow = season;
    this.geoCache = this.geoCache || {};
    const geo = t => this.geoCache[t + season] || (this.geoCache[t + season] = treeGeometry(t, season));
    for (const [t, im] of Object.entries(this.forestMesh || {})) im.geometry = geo(t);
    for (const [t, im] of Object.entries(this.treeMesh || {})) im.geometry = geo(t);
    // ground: snow in winter, ochre in autumn
    const col = this.terrain.geometry.attributes.color;
    if (!this.baseCols) this.baseCols = col.array.slice();
    const [tint, amt] = season === 3 ? [[0.92, 0.94, 0.97], 0.72] : season === 2 ? [[0.66, 0.56, 0.3], 0.3] : season === 1 ? [[0.35, 0.5, 0.2], 0.12] : [[0, 0, 0], 0];
    for (let i = 0; i < col.array.length; i += 3) for (let k = 0; k < 3; k++) col.array[i + k] = this.baseCols[i + k] * (1 - amt) + tint[k] * amt;
    col.needsUpdate = true;
    // grass hides under the snow and turns golden in autumn
    if (this.grassMesh) {
      this.grassMesh.visible = season !== 3;
      const c = new THREE.Color();
      for (let i = 0; i < this.grassMesh.count; i++) this.grassMesh.setColorAt(i, c.setHSL(season === 2 ? 0.12 : 0.25, season === 2 ? 0.45 : 0.3, 0.75 + ((i * 7) % 30) / 100));
      this.grassMesh.instanceColor.needsUpdate = true;
    }
  }

  // Trees inside the plot: woodcutters fell these and they regrow.
  buildPlotTrees() {
    const trees = [];
    const grow = (r, cx, cz, edge) => {
      const x = -PLOT.half + cx * 2 + 1, z = -PLOT.half + cz * 2 + 1;
      if (Math.hypot(x, z) < 22) return;
      const d = fbm(nA, x * 0.045 + 3, z * 0.045 - 7, 3);
      const edgeBoost = smoothstep(edge - 11, edge, Math.max(Math.abs(x), Math.abs(z))) * 0.35;
      if (d + edgeBoost > 0.3 && r() < 0.42) {
        const type = d > 0.45 ? 'pine' : r() < 0.35 ? 'maple' : r() < 0.25 ? 'sakura' : 'pine';
        trees.push({ i: trees.length, cx, cz, x: x + (r() - 0.5) * 0.7, z: z + (r() - 0.5) * 0.7, type, s: 0.8 + r() * 0.35, a: r() * 6.28, alive: true, removed: false, regrowAt: 0, grow: 1 });
      }
    };
    const r = mulberry32(this.seed + 5), r2 = mulberry32(this.seed + 55);
    for (let cz = 0; cz < OLD_PLOT_N; cz++) for (let cx = 0; cx < OLD_PLOT_N; cx++) grow(r, cx + OLD_OFF, cz + OLD_OFF, 47);
    const old = (cx, cz) => cx >= OLD_OFF && cz >= OLD_OFF && cx < OLD_OFF + OLD_PLOT_N && cz < OLD_OFF + OLD_PLOT_N;
    for (let cz = 0; cz < PLOT.n; cz++) for (let cx = 0; cx < PLOT.n; cx++) if (!old(cx, cz)) grow(r2, cx, cz, PLOT.half - 1);
    this.trees = trees;
    this.treeMesh = {};
    const c = new THREE.Color();
    for (const t of ['pine', 'maple', 'sakura']) {
      const list = trees.filter(tr => tr.type === t);
      const im = new THREE.InstancedMesh(this.treeGeo[t], MAT.flat, Math.max(1, list.length));
      im.count = list.length;
      list.forEach((tr, k) => { tr.slot = k; im.setColorAt(k, c.setHSL(0, 0, 0.88 + ((k * 13) % 20) / 100)); });
      im.castShadow = true; im.receiveShadow = true;
      this.treeMesh[t] = im; this.scene.add(im);
    }
    const sm = new Mesher(99, 0.08); sm.cyl(0.3, 0.38, 0.45, 7, '#6b4a33', [0, 0.22, 0]); sm.cyl(0.26, 0.26, 0.02, 7, '#c9a878', [0, 0.46, 0]);
    this.stumps = new THREE.InstancedMesh(sm.geometry(), MAT.flat, trees.length || 1);
    this.stumps.castShadow = true; this.stumps.receiveShadow = true;
    this.scene.add(this.stumps);
    for (const tr of trees) this.syncTree(tr);
  }
  syncTree(tr) {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), tr.a);
    const s = tr.alive && !tr.removed ? tr.s * tr.grow : 0;
    m4.compose(new THREE.Vector3(tr.x, 0, tr.z), q, new THREE.Vector3(s, s, s) );
    const im = this.treeMesh[tr.type]; im.setMatrixAt(tr.slot, m4); im.instanceMatrix.needsUpdate = true;
    const ss = !tr.alive && !tr.removed ? 1 : 0;
    m4.compose(new THREE.Vector3(tr.x, 0, tr.z), q, new THREE.Vector3(ss, ss, ss));
    this.stumps.setMatrixAt(tr.i, m4); this.stumps.instanceMatrix.needsUpdate = true;
  }

  buildRocks() {
    const r = mulberry32(this.seed + 11), r2 = mulberry32(this.seed + 66), rocks = [];
    const stone = (r, cx, cz) => {
      const x = -PLOT.half + cx * 2 + 1, z = -PLOT.half + cz * 2 + 1;
      if (Math.hypot(x, z) < 20) return;
      if (nB(x * 0.06 + 40, z * 0.06) > 0.7 && r() < 0.35) rocks.push({ cx, cz, x, z, s: 0.8 + r() * 0.7, a: r() * 6.28 });
    };
    // the old middle first (the same boulders as before), then the new ring
    for (let cz = 1; cz < OLD_PLOT_N - 1; cz++) for (let cx = 1; cx < OLD_PLOT_N - 1; cx++) stone(r, cx + OLD_OFF, cz + OLD_OFF);
    for (let cz = 1; cz < PLOT.n - 1; cz++) for (let cx = 1; cx < PLOT.n - 1; cx++) if (cx < OLD_OFF + 1 || cz < OLD_OFF + 1 || cx >= OLD_OFF + OLD_PLOT_N - 1 || cz >= OLD_OFF + OLD_PLOT_N - 1) stone(r2, cx, cz);
    this.rocks = rocks;
    const m = new Mesher(5, 0.1);
    m.add(new THREE.DodecahedronGeometry(1, 0), '#8d887e', [0, 0.45, 0], [0.3, 0, 0.2], [1.1, 0.75, 0.95]);
    m.add(new THREE.DodecahedronGeometry(0.6, 0), '#7f7a71', [0.75, 0.3, 0.35], [0, 0.6, 0], [1, 0.8, 1]);
    const geo = m.geometry();
    const im = new THREE.InstancedMesh(geo, MAT.flat, rocks.length + 260);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    rocks.forEach((k, i) => { m4.compose(new THREE.Vector3(k.x, 0, k.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), k.a), new THREE.Vector3(k.s, k.s, k.s)); im.setMatrixAt(i, m4); });
    // decorative rocks in the hills
    let j = rocks.length, tries = 0;
    while (j < rocks.length + 260 && tries++ < 3000) {
      const x = (r() - 0.5) * 600, z = (r() - 0.5) * 600; if (Math.abs(x) < FLAT + 4 && Math.abs(z) < FLAT + 4) continue;
      const hgt = heightAt(x, z); if (hgt < -0.5) continue;
      const s = 0.8 + r() * 2.2; m4.compose(new THREE.Vector3(x, hgt - 0.3, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6), new THREE.Vector3(s, s * 0.8, s)); im.setMatrixAt(j++, m4);
    }
    im.count = j; im.castShadow = true; im.receiveShadow = true;
    this.scene.add(im);
    this.rockMesh = im;
  }
  hideRock(i) {
    const m4 = new THREE.Matrix4().makeScale(0, 0, 0);
    this.rockMesh.setMatrixAt(i, m4); this.rockMesh.instanceMatrix.needsUpdate = true;
  }

  buildGrass() {
    const count = this.quality === 'low' ? 2000 : 5600;
    const m = new Mesher(3, 0.12);
    for (let k = 0; k < 4; k++) m.cone(0.06, 0.55 + k * 0.08, 3, k % 2 ? '#6f9a44' : '#88b454', [Math.cos(k * 1.7) * 0.12, 0.28, Math.sin(k * 1.7) * 0.12], [Math.cos(k) * 0.25, 0, Math.sin(k) * 0.25]);
    const im = new THREE.InstancedMesh(m.geometry(), MAT.flat, count);
    const r = mulberry32(this.seed + 17), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    this.grass = [];
    for (let i = 0; i < count; i++) {
      const x = (r() - 0.5) * (PLOT.half * 2 + 2), z = (r() - 0.5) * (PLOT.half * 2 + 2), s = 0.6 + r() * 0.8;
      this.grass.push({ x, z, s, a: r() * 6 });
      m4.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6), new THREE.Vector3(s, s, s));
      im.setMatrixAt(i, m4); im.setColorAt(i, c.setHSL(0.25, 0.3, 0.75 + r() * 0.3));
    }
    im.receiveShadow = true;
    this.grassMesh = im; this.scene.add(im);
  }
  // hide grass tufts under a building footprint (world rect)
  clearGrass(x0, z0, x1, z1, hide = true) {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    this.grass.forEach((g, i) => {
      if (g.x < x0 || g.x > x1 || g.z < z0 || g.z > z1) return;
      g.hidden = hide ? (g.hidden || 0) + 1 : Math.max(0, (g.hidden || 0) - 1);
      const s = g.hidden ? 0 : g.s;
      m4.compose(new THREE.Vector3(g.x, 0, g.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), g.a), new THREE.Vector3(s, s, s));
      this.grassMesh.setMatrixAt(i, m4);
    });
    this.grassMesh.instanceMatrix.needsUpdate = true;
  }
}
export { clamp };
