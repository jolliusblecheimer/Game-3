// Procedural building models. Front of every building faces local +Z.
import * as THREE from 'three';
import { ModelBuilder, Mesher, MAT } from './geo.js';

const WOOD = '#5a3a28', WOOD_L = '#8b5e3c', WOOD_D = '#3b2619', PLASTER = '#efe7d6', ROOF = '#3a414d', ROOF_D = '#262b33';
const STONE = '#8e897e', STONE_D = '#6d685f', THATCH = '#b8955a', THATCH_D = '#8f7040', VERM = '#c2412d', GOLD = '#dcaa45';
const PAPER = '#f3e9cf', DIRT = '#7d6245', SAND = '#e7dec8', MOSS = '#5f8a3e', BAMBOO = '#a9b25e', DARK = '#23252a';

function posts(m, w, d, h, y, hex, r = 0.13) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box(r * 2, h, r * 2, hex, [sx * (w / 2 - r), y + h / 2, sz * (d / 2 - r)]);
}
function stoneLantern(b, x, z, s = 1) {
  const m = b.m;
  m.cyl(0.32 * s, 0.4 * s, 0.25 * s, 6, STONE, [x, 0.12 * s, z]);
  m.cyl(0.12 * s, 0.14 * s, 0.9 * s, 6, STONE, [x, 0.7 * s, z]);
  m.box(0.5 * s, 0.12 * s, 0.5 * s, STONE, [x, 1.2 * s, z]);
  b.g.box(0.34 * s, 0.34 * s, 0.34 * s, '#ffd89a', [x, 1.43 * s, z]);
  m.cone(0.48 * s, 0.35 * s, 4, STONE_D, [x, 1.78 * s, z], [0, Math.PI / 4, 0]);
  m.ball(0.08 * s, STONE_D, [x, 2.0 * s, z]);
}
function hangingLantern(b, x, y, z) {
  b.m.box(0.04, 0.3, 0.04, DARK, [x, y + 0.35, z]);
  b.g.cyl(0.16, 0.16, 0.36, 8, '#ff9b6a', [x, y, z]);
  b.m.cyl(0.17, 0.17, 0.05, 8, DARK, [x, y + 0.2, z]); b.m.cyl(0.17, 0.17, 0.05, 8, DARK, [x, y - 0.2, z]);
}
function bush(m, x, z, s = 1, hex = '#4f7d3a') { m.ball(0.55 * s, hex, [x, 0.4 * s, z], [1.2, 0.9, 1.1]); }

const MODELS = {
  townhall(b) {
    const m = b.m;
    m.frustum(8, 8, 6.9, 6.9, 2.3, STONE, [0, 0, 0]);
    for (let i = 0; i < 5; i++) m.box(1.6, 0.2, 0.5, STONE_D, [0, 0.1 + i * 0.22, 4.1 - i * 0.25]); // front steps
    m.box(6.3, 2.7, 6.3, PLASTER, [0, 2.3 + 1.35, 0]);
    for (const y of [2.4, 4.9]) m.box(6.45, 0.26, 6.45, WOOD, [0, y, 0]);
    posts(m, 6.45, 6.45, 2.6, 2.3, WOOD, 0.16);
    m.box(1.4, 1.7, 0.1, WOOD_D, [0, 3.2, 3.17]);
    for (const x of [-2, 2]) b.g.box(0.7, 0.55, 0.08, '#ffcf7a', [x, 3.8, 3.17]);
    for (const z of [-1.6, 1.6]) { b.g.box(0.08, 0.55, 0.7, '#ffcf7a', [3.17, 3.8, z]); b.g.box(0.08, 0.55, 0.7, '#ffcf7a', [-3.17, 3.8, z]); }
    m.roof(6.3, 6.3, 1.7, ROOF, 5.0, { over: 0.95, ridge: 0.4 });
    m.box(4.8, 2.3, 4.8, PLASTER, [0, 6.0 + 1.15, 0]);
    m.box(4.95, 0.22, 4.95, WOOD, [0, 6.1, 0]); posts(m, 4.95, 4.95, 2.3, 6.0, WOOD, 0.14);
    for (const x of [-1.2, 1.2]) b.g.box(0.6, 0.5, 0.08, '#ffcf7a', [x, 7.3, 2.42]);
    // front gable (karahafu) accent
    m.frustum(2.6, 1.3, 0.3, 1.0, 0.9, ROOF, [0, 8.1, 2.55]);
    m.roof(4.8, 4.8, 1.5, ROOF, 8.3, { over: 0.85, ridge: 0.4 });
    m.box(3.3, 1.9, 3.3, PLASTER, [0, 9.2 + 0.95, 0]);
    m.box(3.45, 0.2, 3.45, WOOD, [0, 9.3, 0]); posts(m, 3.45, 3.45, 1.9, 9.2, WOOD, 0.12);
    b.g.box(0.9, 0.5, 0.08, '#ffcf7a', [0, 10.2, 1.67]);
    m.roof(3.3, 3.3, 1.9, ROOF, 11.1, { over: 0.75, ridge: 0.35, ornaments: GOLD });
    hangingLantern(b, -1.1, 4.3, 3.35); hangingLantern(b, 1.1, 4.3, 3.35);
    stoneLantern(b, -3.4, 5.2, 0.9); stoneLantern(b, 3.4, 5.2, 0.9);
    // clan banners
    for (const x of [-2.6, 2.6]) { m.cyl(0.05, 0.05, 4.2, 5, WOOD_D, [x, 2.1, 4.6]); m.box(0.05, 2.2, 0.7, VERM, [x, 2.9, 4.95]); m.box(0.06, 0.5, 0.5, PLASTER, [x, 3.3, 4.95]); }
  },
  house(b) {
    const m = b.m;
    m.box(3.7, 0.45, 3.7, WOOD_L, [0, 0.22, 0]);
    posts(m, 3.5, 3.5, 0.5, 0, WOOD_D, 0.14);
    m.box(3.1, 1.9, 2.8, PLASTER, [0, 0.45 + 0.95, -0.2]);
    posts(m, 3.2, 2.9, 1.95, 0.45, WOOD, 0.1);
    m.box(3.25, 0.16, 2.95, WOOD, [0, 2.35, -0.2]);
    b.g.box(1.3, 1.35, 0.06, PAPER, [0, 1.2, 1.22]);
    m.box(0.06, 1.35, 0.06, WOOD, [0, 1.2, 1.26]); m.box(1.3, 0.06, 0.06, WOOD, [0, 1.2, 1.26]);
    b.g.box(0.06, 0.7, 0.9, PAPER, [1.57, 1.5, -0.2]);
    m.box(3.7, 0.12, 0.8, WOOD_L, [0, 0.5, 1.55]); // engawa porch
    m.roof(3.1, 2.8, 2.5, THATCH, 2.35, { over: 0.75, ridge: 0.45, ridgeHex: THATCH_D, cz: -0.2 });
    m.box(0.5, 0.5, 0.5, WOOD_L, [1.2, 0.25, 2.1]); m.cyl(0.25, 0.28, 0.5, 8, WOOD, [-1.3, 0.25, 2.1]); // barrel & crate
    hangingLantern(b, 1.3, 1.9, 1.35);
  },
  storehouse(b) {
    const m = b.m;
    m.box(3.8, 0.4, 5.6, STONE, [0, 0.2, 0]);
    m.box(3.3, 3.1, 5.1, PLASTER, [0, 0.4 + 1.55, 0]);
    m.box(3.36, 1.0, 5.16, DARK, [0, 0.9, 0]);
    for (let i = -2; i <= 2; i++) { m.box(3.4, 0.05, 0.05, '#dcd6c8', [0, 0.9, i * 1.0]); m.box(0.05, 1.0, 5.2, '#dcd6c8', [i * 0.55, 0.9, 0]); }
    m.box(1.3, 1.9, 0.18, WOOD_D, [0, 1.35, 2.6]); m.box(1.5, 0.18, 0.3, PLASTER, [0, 2.4, 2.62]);
    b.g.box(0.6, 0.45, 0.08, '#ffcf7a', [0, 3.0, 2.56]);
    m.roof(3.3, 5.1, 1.5, ROOF, 3.5, { over: 0.55, ridge: 0.85 });
    m.box(0.3, 0.4, 0.3, GOLD, [0, 2.95, 2.62]);
  },
  farm(b, w, d) {
    const m = b.m;
    m.box(w - 0.3, 0.12, d - 0.3, '#6a4e33', [0, 0.06, 0]);
    const rows = 7;
    for (let i = 0; i < rows; i++) m.box(w - 0.9, 0.22, 0.55, '#7d5f3f', [0, 0.14, -d / 2 + 0.75 + i * ((d - 1.5) / (rows - 1))]);
    // bamboo fence on three sides
    for (let i = 0; i <= 8; i++) { const t = -w / 2 + 0.15 + i * (w - 0.3) / 8; m.cyl(0.05, 0.05, 0.9, 5, BAMBOO, [t, 0.45, -d / 2 + 0.15]); m.cyl(0.05, 0.05, 0.9, 5, BAMBOO, [-w / 2 + 0.15, 0.45, t]); m.cyl(0.05, 0.05, 0.9, 5, BAMBOO, [w / 2 - 0.15, 0.45, t]); }
    m.box(w - 0.3, 0.05, 0.05, BAMBOO, [0, 0.7, -d / 2 + 0.15]); m.box(0.05, 0.05, d - 0.3, BAMBOO, [-w / 2 + 0.15, 0.7, 0]); m.box(0.05, 0.05, d - 0.3, BAMBOO, [w / 2 - 0.15, 0.7, 0]);
    // scarecrow (kakashi)
    const sx = w / 2 - 1.0, sz = -d / 2 + 1.1;
    m.cyl(0.05, 0.05, 1.8, 5, WOOD, [sx, 0.9, sz]); m.box(1.3, 0.06, 0.06, WOOD, [sx, 1.4, sz]);
    m.box(0.55, 0.6, 0.2, '#5d6f8f', [sx, 1.3, sz]); m.ball(0.2, '#e9dcc0', [sx, 1.8, sz]); m.cone(0.45, 0.25, 10, THATCH, [sx, 2.0, sz]);
    // crops live in their own mesh so they can grow
    const c = new Mesher(11, 0.12);
    for (let i = 0; i < rows; i++) {
      const z = -d / 2 + 0.75 + i * ((d - 1.5) / (rows - 1));
      for (let k = 0; k < 9; k++) {
        const x = -w / 2 + 0.8 + k * (w - 1.6) / 8;
        c.cone(0.22, 0.9, 5, k % 3 ? '#d8b653' : '#c9a443', [x, 0.7, z], [0, k, 0]);
      }
    }
    const crop = c.mesh(MAT.flat, true, true);
    b.extra = { crop };
  },
  lumber(b) {
    const m = b.m;
    m.box(3.8, 0.1, 3.8, DIRT, [0, 0.05, 0]);
    posts(m, 3.0, 2.4, 2.4, 0, WOOD, 0.12);
    m.box(3.5, 0.15, 3.0, '#6b4c35', [0, 2.55, -0.3], [0.25, 0, 0]);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) m.cyl(0.26, 0.26, 2.4, 7, i % 2 ? '#7a5438' : '#6d4a31', [-0.9 + i * 0.55 + r * 0.27, 0.28 + r * 0.46, -0.5], [0, 0, Math.PI / 2]);
    m.cyl(0.4, 0.45, 0.6, 8, '#6b4a33', [1.2, 0.3, 1.2]); m.cyl(0.36, 0.36, 0.02, 8, '#c9a878', [1.2, 0.61, 1.2]);
    m.box(0.06, 0.6, 0.06, WOOD_D, [1.2, 0.9, 1.2], [0.4, 0, 0]); m.box(0.25, 0.18, 0.04, '#9aa0a6', [1.2, 1.15, 1.32], [0.4, 0, 0]);
    m.box(1.4, 0.08, 0.2, '#8c6a4a', [-1.1, 0.7, 1.3]); for (const x of [-1.6, -0.6]) m.box(0.08, 0.7, 0.5, '#8c6a4a', [x, 0.35, 1.3], [0.3, 0, 0]);
  },
  quarry(b, w, d) {
    const m = b.m;
    m.box(w - 0.2, 0.1, d - 0.2, '#8b8578', [0, 0.05, 0]);
    m.add(new THREE.DodecahedronGeometry(1.6, 0), STONE, [-1.2, 1.0, -1.2], [0.2, 0.4, 0], [1.3, 1, 1.1]);
    m.add(new THREE.DodecahedronGeometry(1.2, 0), STONE_D, [0.6, 0.8, -1.7], [0.5, 0, 0.3], [1.2, 1, 1]);
    m.add(new THREE.DodecahedronGeometry(0.9, 0), '#9a958a', [-2.0, 0.6, 0.4], [0, 1, 0]);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) m.box(0.7, 0.45, 0.45, '#b3ada1', [1.1 + i * 0.72, 0.23 + j * 0.46, 1.4 - j * 0.1]);
    // wooden hoist
    for (const a of [0, 2.1, 4.2]) m.cyl(0.07, 0.07, 3.2, 5, WOOD, [0.6 + Math.cos(a) * 0.6, 1.5, 0.2 + Math.sin(a) * 0.6], [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35]);
    m.cyl(0.02, 0.02, 1.6, 4, '#c9b58a', [0.6, 2.2, 0.2]); m.box(0.5, 0.35, 0.35, '#a9a397', [0.6, 1.2, 0.2]);
    b.g.box(0.2, 0.2, 0.2, '#ffcf7a', [2.4, 1.2, -0.6]);
  },
  mine(b, w, d) {
    const m = b.m;
    m.box(w - 0.2, 0.1, d - 0.2, '#7a6a55', [0, 0.05, 0]);
    m.add(new THREE.DodecahedronGeometry(2.6, 1), '#7d756a', [0, 1.1, -0.9], [0, 0.3, 0], [1.1, 0.75, 0.9]);
    m.add(new THREE.DodecahedronGeometry(1.4, 0), '#6d665c', [-1.8, 0.9, 0.2], [0.3, 0, 0]);
    m.box(1.5, 1.7, 0.4, '#141312', [0, 0.95, 1.2]);
    m.box(0.22, 2.0, 0.22, WOOD, [-0.85, 1.0, 1.35]); m.box(0.22, 2.0, 0.22, WOOD, [0.85, 1.0, 1.35]); m.box(2.1, 0.26, 0.3, WOOD, [0, 2.05, 1.35]);
    for (const x of [-0.35, 0.35]) m.box(0.06, 0.05, 2.0, '#6f7378', [x, 0.13, 2.1]);
    for (let i = 0; i < 6; i++) m.box(0.9, 0.06, 0.12, WOOD, [0, 0.1, 1.3 + i * 0.35]);
    m.box(0.9, 0.5, 0.7, WOOD_L, [0, 0.45, 2.3]); for (const x of [-0.3, 0.3]) m.cyl(0.12, 0.12, 0.8, 8, DARK, [x * 1.2, 0.2, 2.3], [0, 0, Math.PI / 2]);
    for (let i = 0; i < 5; i++) m.ball(0.14, GOLD, [-0.25 + (i % 3) * 0.25, 0.75, 2.2 + (i > 2 ? 0.2 : 0)]);
    for (const [x, y, z] of [[-1.2, 1.5, 0.4], [1.3, 1.8, -0.1], [0.4, 2.6, -0.4]]) m.box(0.22, 0.18, 0.2, GOLD, [x, y, z], [0.5, 0.7, 0]);
    hangingLantern(b, 0.7, 1.6, 1.62);
  },
  dojo(b, w, d) {
    const m = b.m;
    m.box(w - 0.2, 0.08, d - 0.2, SAND, [0, 0.04, 0]);
    m.box(4.8, 0.6, 3.6, STONE, [0, 0.3, -0.9]);
    m.box(4.4, 2.4, 3.2, WOOD_L, [0, 0.6 + 1.2, -0.9]);
    posts(m, 4.5, 3.3, 2.4, 0.6, WOOD_D, 0.14);
    b.g.box(3.6, 0.8, 0.06, PAPER, [0, 2.3, 0.73]);
    m.box(1.6, 1.4, 0.06, WOOD_D, [0, 1.3, 0.72]);
    m.roof(4.4, 3.2, 2.0, ROOF, 3.0, { over: 0.8, ridge: 0.6, cz: -0.9 });
    m.box(1.3, 0.5, 0.08, '#f5efe0', [0, 3.3, 1.1]); m.box(1.0, 0.25, 0.1, DARK, [0, 3.3, 1.12]);
    // weapon rack with bokken
    m.box(1.6, 0.08, 0.2, WOOD, [2.0, 1.0, 1.6]); m.box(0.08, 1.0, 0.2, WOOD, [1.3, 0.5, 1.6]); m.box(0.08, 1.0, 0.2, WOOD, [2.7, 0.5, 1.6]);
    for (let i = 0; i < 5; i++) m.box(0.05, 1.1, 0.05, '#c9a36f', [1.45 + i * 0.28, 0.75, 1.68], [0.12, 0, 0]);
    for (const x of [-2.3, -1.6]) { m.cyl(0.04, 0.04, 3, 5, WOOD_D, [x, 1.5, 1.9]); m.box(0.04, 1.8, 0.45, x < -2 ? VERM : '#27354f', [x, 2.0, 2.15]); }
    m.cyl(0.18, 0.2, 1.6, 7, THATCH, [-1.9, 0.8, 0.7]);
  },
  kyudojo(b, w, d) {
    const m = b.m;
    m.box(w - 0.2, 0.08, d - 0.2, SAND, [0, 0.04, 0]);
    m.box(w - 0.4, 0.4, 2.2, WOOD_L, [0, 0.2, -d / 2 + 1.3]);
    posts(m, w - 0.4, 2.2, 2.2, 0.4, WOOD_D, 0.12);
    m.box(w - 0.4, 2.2, 0.12, WOOD, [0, 1.5, -d / 2 + 0.25]);
    m.roof(w - 0.4, 2.2, 1.3, ROOF, 2.6, { over: 0.6, ridge: 0.8, cz: -d / 2 + 1.3 });
    m.box(w - 0.6, 1.2, 1.0, '#6c5a3f', [0, 0.6, d / 2 - 0.7]); // earth mound (azuchi)
    for (let i = 0; i < 3; i++) {
      const x = -1.6 + i * 1.6;
      m.cyl(0.36, 0.36, 0.08, 14, '#f4f0e6', [x, 1.0, d / 2 - 1.25], [Math.PI / 2, 0, 0]);
      m.cyl(0.25, 0.25, 0.09, 14, DARK, [x, 1.0, d / 2 - 1.25], [Math.PI / 2, 0, 0]);
      m.cyl(0.11, 0.11, 0.1, 12, '#f4f0e6', [x, 1.0, d / 2 - 1.25], [Math.PI / 2, 0, 0]);
    }
    m.box(w - 0.4, 0.08, 1.4, THATCH, [0, 1.9, d / 2 - 0.9], [-0.3, 0, 0]);
    for (const x of [-w / 2 + 0.4, w / 2 - 0.4]) m.box(0.1, 1.9, 0.1, WOOD_D, [x, 0.95, d / 2 - 0.3]);
    m.box(0.3, 1.9, 0.3, '#27354f', [w / 2 - 0.5, 1.5, -d / 2 + 2.6]);
  },
  wall(b, w, d, conn) {
    const m = b.m;
    if (conn && (conn.n || conn.s || conn.e || conn.w)) {
      // connected wall: a pillar in the middle and an arm towards each neighbour
      m.frustum(1.35, 1.35, 1.1, 1.1, 1.5, STONE, [0, 0, 0]);
      m.box(1.0, 1.3, 1.0, PLASTER, [0, 2.15, 0]); m.box(1.04, 0.16, 1.04, WOOD_D, [0, 1.56, 0]);
      m.roof(1.0, 1.0, 0.5, ROOF, 2.8, { over: 0.26, ridge: 0.3 });
      for (const [k, ax, az] of [['e', 1, 0], ['w', -1, 0], ['s', 0, 1], ['n', 0, -1]]) {
        if (!conn[k]) continue;
        const along = ax !== 0, x = ax * 0.52, z = az * 0.52;
        m.frustum(along ? 1.0 : 1.35, along ? 1.35 : 1.0, along ? 1.0 : 1.1, along ? 1.1 : 1.0, 1.5, STONE, [x, 0, z]);
        m.box(along ? 1.0 : 0.8, 1.3, along ? 0.8 : 1.0, PLASTER, [x, 2.15, z]);
        m.box(along ? 1.0 : 0.84, 0.16, along ? 0.84 : 1.0, WOOD_D, [x, 1.56, z]);
        m.box(along ? 0.22 : 0.06, 0.18, along ? 0.06 : 0.22, DARK, [x + (along ? 0 : 0.41), 2.3, z + (along ? 0.41 : 0)]);
        m.box(along ? 0.22 : 0.06, 0.18, along ? 0.06 : 0.22, DARK, [x - (along ? 0 : 0.41), 2.3, z - (along ? 0.41 : 0)]);
        m.roof(along ? 1.0 : 0.8, along ? 0.8 : 1.0, 0.5, ROOF, 2.8, { over: 0.26, ridge: 0.9 });
      }
      return;
    }
    m.frustum(2.05, 2.05, 1.75, 1.75, 1.5, STONE, [0, 0, 0]);
    m.box(1.6, 1.3, 1.6, PLASTER, [0, 1.5 + 0.65, 0]);
    m.box(1.64, 0.18, 1.64, WOOD_D, [0, 1.55, 0]);
    m.box(0.3, 0.18, 0.06, DARK, [0, 2.3, 0.82]); m.box(0.3, 0.18, 0.06, DARK, [0, 2.3, -0.82]); m.box(0.06, 0.18, 0.3, DARK, [0.82, 2.3, 0]); m.box(0.06, 0.18, 0.3, DARK, [-0.82, 2.3, 0]);
    m.roof(1.6, 1.6, 0.55, ROOF, 2.8, { over: 0.28, ridge: 0.3 });
  },
  gate(b, w) {
    const m = b.m;
    for (const x of [-1.55, 1.55]) { m.box(0.5, 0.4, 0.8, STONE, [x, 0.2, 0]); m.box(0.36, 3.4, 0.36, WOOD, [x, 1.9, 0]); }
    m.box(3.7, 0.36, 0.5, WOOD_D, [0, 3.35, 0]); m.box(3.4, 0.22, 0.34, WOOD, [0, 2.85, 0]);
    m.roof(3.6, 1.1, 1.0, ROOF, 3.55, { over: 0.55, ridge: 0.9 });
    m.box(1.3, 2.6, 0.12, WOOD_L, [-1.0, 1.35, 0.7], [0, -1.2, 0]); m.box(1.3, 2.6, 0.12, WOOD_L, [1.0, 1.35, 0.7], [0, 1.2, 0]);
    for (const x of [-1.5, 1.5]) for (const y of [0.8, 1.9]) m.ball(0.06, GOLD, [x * 0.55 + (x > 0 ? 0.35 : -0.35), y, 1.2]);
    hangingLantern(b, -1.1, 2.3, 0.35); hangingLantern(b, 1.1, 2.3, 0.35);
  },
  tower(b) {
    const m = b.m;
    m.frustum(4, 4, 3.2, 3.2, 2.0, STONE, [0, 0, 0]);
    posts(m, 3.0, 3.0, 3.4, 2.0, WOOD, 0.13);
    m.box(3.3, 0.22, 3.3, WOOD_L, [0, 3.5, 0]);
    for (const [x, z, rx, rz] of [[0, 1.55, 3.1, 0.1], [0, -1.55, 3.1, 0.1], [1.55, 0, 0.1, 3.1], [-1.55, 0, 0.1, 3.1]]) m.box(rx, 0.9, rz, PLASTER, [x, 4.05, z]);
    for (const [x, z, rx, rz] of [[0, 1.6, 3.2, 0.12], [0, -1.6, 3.2, 0.12], [1.6, 0, 0.12, 3.2], [-1.6, 0, 0.12, 3.2]]) m.box(rx, 0.12, rz, WOOD_D, [x, 4.55, z]);
    m.roof(3.0, 3.0, 1.4, ROOF, 5.4, { over: 0.55, ridge: 0.3 });
    for (let i = 0; i < 6; i++) m.box(0.9, 0.08, 0.2, WOOD, [1.6, 0.4 + i * 0.5, 1.4 - i * 0.02], [0, 0, 0]); // ladder rungs
    m.box(0.08, 3.4, 0.08, WOOD, [1.95, 1.7, 1.2]); m.box(0.08, 3.4, 0.08, WOOD, [1.95, 1.7, 1.6]);
    m.cyl(0.04, 0.04, 2.4, 5, WOOD_D, [-1.3, 6.2, -1.3]); m.box(0.04, 1.0, 0.6, VERM, [-1.3, 6.8, -1.0]);
    b.extra = { post: [[0, 3.62, 0.6], [-0.8, 3.62, -0.5], [0.8, 3.62, -0.5]] };
  },
  palisade(b, w, d, conn) {
    const m = b.m;
    if (conn && (conn.n || conn.s || conn.e || conn.w)) {
      const pole = (x, z, k) => { const hgt = 2.1 + (k % 3) * 0.2; m.cyl(0.11, 0.12, hgt, 6, k % 2 ? BAMBOO : '#bdc06f', [x, hgt / 2, z]); m.cone(0.11, 0.35, 6, '#d9d49a', [x, hgt + 0.17, z]); };
      pole(0, 0, 0);
      for (const [k, ax, az] of [['e', 1, 0], ['w', -1, 0], ['s', 0, 1], ['n', 0, -1]]) {
        if (!conn[k]) continue;
        for (let i = 1; i <= 4; i++) pole(ax * i * 0.25, az * i * 0.25, i);
        for (const y of [0.6, 1.5]) m.box(ax ? 1.0 : 0.08, 0.08, az ? 1.0 : 0.08, '#8b7a4c', [ax * 0.5, y, az * 0.5]);
      }
      return;
    }
    for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) {
      const x = -0.8 + i * 0.4 + j * 0.2, z = -0.2 + j * 0.4, hgt = 2.1 + ((i + j) % 3) * 0.2;
      m.cyl(0.11, 0.12, hgt, 6, (i + j) % 2 ? BAMBOO : '#bdc06f', [x, hgt / 2, z]);
      m.cone(0.11, 0.35, 6, '#d9d49a', [x, hgt + 0.17, z]);
    }
    for (const y of [0.6, 1.5]) m.box(2.0, 0.08, 0.9, '#8b7a4c', [0, y, 0]);
  },
  spikes(b) {
    const m = b.m;
    for (let i = 0; i < 3; i++) {
      const x = -0.65 + i * 0.65;
      m.cyl(0.08, 0.1, 2.2, 5, WOOD_L, [x, 0.7, 0], [0.9, 0, 0]); m.cyl(0.08, 0.1, 2.2, 5, WOOD_L, [x, 0.7, 0], [-0.9, 0, 0]);
      m.cone(0.08, 0.3, 5, '#d8c29a', [x, 1.48, 0.95], [0.9, 0, 0]); m.cone(0.08, 0.3, 5, '#d8c29a', [x, 1.48, -0.95], [-0.9, 0, 0]);
    }
    m.cyl(0.07, 0.07, 2.0, 5, WOOD, [0, 0.62, 0], [0, 0, Math.PI / 2]);
  },
  hedge(b, w, d, conn) {
    const m = b.m;
    if (conn) for (const [k, ax, az] of [['e', 1, 0], ['w', -1, 0], ['s', 0, 1], ['n', 0, -1]]) if (conn[k]) { bush(m, ax * 0.7, az * 0.7, 1.15, '#4b7a39'); }
    bush(m, -0.5, -0.3, 1.1); bush(m, 0.5, 0.2, 1.2, '#46733a'); bush(m, 0, 0.1, 1.35, '#56853f'); bush(m, 0.1, -0.5, 1.0, '#4a7a3a');
  },
  shrine(b, w, d) {
    const m = b.m;
    m.box(w - 0.2, 0.08, d - 0.2, SAND, [0, 0.04, 0]);
    for (let i = 0; i < 4; i++) m.box(0.9, 0.06, 0.6, STONE, [0, 0.1, d / 2 - 0.5 - i * 0.7]);
    // torii
    const tz = d / 2 - 0.4;
    for (const x of [-1.1, 1.1]) m.cyl(0.13, 0.15, 2.6, 8, VERM, [x, 1.3, tz]);
    m.box(3.0, 0.2, 0.28, DARK, [0, 2.75, tz]); m.box(2.8, 0.18, 0.25, VERM, [0, 2.55, tz]); m.box(2.5, 0.15, 0.18, VERM, [0, 2.1, tz]);
    // honden
    m.box(3.0, 0.5, 2.6, STONE, [0, 0.25, -1.0]);
    posts(m, 2.6, 2.2, 1.9, 0.5, VERM, 0.12);
    m.box(2.3, 1.7, 1.9, '#d9c9a4', [0, 0.5 + 0.85, -1.05]);
    m.box(2.5, 0.12, 2.1, VERM, [0, 2.3, -1.05]);
    b.g.box(0.9, 1.1, 0.06, PAPER, [0, 1.2, -0.08]);
    m.roof(2.5, 2.2, 1.5, '#5b6a52', 2.4, { over: 0.7, ridge: 0.55, ridgeHex: '#3f4a38', cz: -1.05, ornaments: GOLD });
    m.cyl(0.05, 0.05, 2.2, 6, '#d8c28a', [0, 2.15, 0.12], [0, 0, Math.PI / 2]); // shimenawa
    for (const x of [-0.6, 0, 0.6]) m.box(0.08, 0.3, 0.02, '#f7f3ea', [x, 1.95, 0.14]);
    m.ball(0.14, GOLD, [0, 1.8, 0.16]);
    stoneLantern(b, -1.6, 0.6, 0.8); stoneLantern(b, 1.6, 0.6, 0.8);
    for (const x of [-0.9, 0.9]) { m.box(0.35, 0.35, 0.35, STONE, [x, 0.18, 1.1]); m.box(0.3, 0.4, 0.3, '#9c978c', [x, 0.55, 1.1]); m.box(0.2, 0.2, 0.25, '#9c978c', [x, 0.8, 1.2]); }
  },
  garden(b, w, d) {
    const m = b.m;
    m.box(w - 0.4, 0.1, d - 0.4, SAND, [0, 0.05, 0]);
    for (let i = 0; i < 9; i++) m.box(w - 0.6, 0.02, 0.06, '#d6ccb3', [0, 0.11, -d / 2 + 0.6 + i * (d - 1.2) / 8]);
    for (const [x, z, s] of [[-1.2, -0.8, 1], [0.9, 0.5, 0.75], [-0.1, 1.2, 0.55]]) {
      m.ball(0.8 * s, MOSS, [x, 0.12, z], [1.4, 0.35, 1.4]);
      m.add(new THREE.DodecahedronGeometry(0.55 * s, 0), '#77726a', [x, 0.4 * s, z], [0.4, x, 0.2], [1, 1.2, 0.9]);
    }
    for (let i = 0; i <= 10; i++) { const t = -w / 2 + 0.2 + i * (w - 0.4) / 10; m.cyl(0.04, 0.04, 0.55, 5, BAMBOO, [t, 0.28, d / 2 - 0.2]); m.cyl(0.04, 0.04, 0.55, 5, BAMBOO, [t, 0.28, -d / 2 + 0.2]); }
    m.box(w - 0.4, 0.04, 0.04, BAMBOO, [0, 0.45, d / 2 - 0.2]); m.box(w - 0.4, 0.04, 0.04, BAMBOO, [0, 0.45, -d / 2 + 0.2]);
    m.cyl(0.08, 0.12, 0.8, 5, WOOD, [2.0, 0.4, -1.8], [0, 0, 0.3]); m.ball(0.5, '#2f5a36', [2.2, 0.95, -1.8], [1.3, 0.5, 1]); m.ball(0.35, '#35653c', [1.8, 1.2, -1.7], [1.2, 0.5, 1]);
    m.box(0.8, 0.12, 0.4, WOOD_L, [1.6, 0.35, 1.9]); m.box(0.08, 0.3, 0.3, WOOD_D, [1.3, 0.18, 1.9]); m.box(0.08, 0.3, 0.3, WOOD_D, [1.9, 0.18, 1.9]);
  },
  pond(b, w, d) {
    const m = b.m;
    m.box(w - 0.2, 0.06, d - 0.2, '#79a24e', [0, 0.03, 0]);
    const R = Math.min(w, d) / 2 - 0.5;
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; m.add(new THREE.DodecahedronGeometry(0.35 + (i % 3) * 0.08, 0), i % 2 ? '#8e897e' : '#77726a', [Math.cos(a) * R, 0.2, Math.sin(a) * R * 0.85], [i, i * 2, 0], [1, 0.6, 1]); }
    m.cyl(R - 0.1, R - 0.3, 0.3, 20, '#33505a', [0, -0.05, 0], [0, 0, 0], [1, 1, 0.85]);
    for (const [x, z] of [[-0.8, 0.4], [0.7, -0.6], [0.2, 0.9]]) m.cyl(0.28, 0.28, 0.03, 8, '#4f8a3a', [x, 0.2, z]);
    m.ball(0.12, '#f4b8c8', [0.7, 0.26, -0.6]);
    const water = new THREE.Mesh(new THREE.CircleGeometry(R - 0.15, 24), MAT.water); water.rotation.x = -Math.PI / 2; water.scale.y = 0.85; water.position.y = 0.16; water.receiveShadow = true;
    const koi = [];
    for (let i = 0; i < 4; i++) {
      const k = new Mesher(40 + i, 0.05); k.box(0.12, 0.05, 0.36, i % 2 ? '#ff8a3d' : '#f4f0e6', [0, 0, 0]); k.box(0.1, 0.02, 0.14, '#e24a2a', [0, 0.03, 0.05]); k.box(0.02, 0.06, 0.12, '#ff8a3d', [0, 0, -0.22]);
      const km = k.mesh(MAT.flat, false, false); km.position.y = 0.13; koi.push({ mesh: km, r: 0.5 + i * 0.28, s: 0.4 + i * 0.12, a: i * 1.7 });
    }
    b.extra = { water, koi };
  },
  teahouse(b) {
    const m = b.m;
    m.box(3.7, 0.3, 3.7, STONE, [0, 0.15, 0]);
    m.box(2.6, 1.8, 2.3, '#d6c49c', [0, 0.3 + 0.9, -0.5]);
    posts(m, 2.7, 2.4, 1.85, 0.3, WOOD_D, 0.09);
    b.g.cyl(0.4, 0.4, 0.06, 16, PAPER, [0.6, 1.3, 0.66], [Math.PI / 2, 0, 0]);
    m.box(0.8, 1.2, 0.05, WOOD, [-0.6, 0.95, 0.67]);
    m.roof(2.6, 2.3, 1.7, THATCH, 2.15, { over: 0.6, ridgeHex: THATCH_D, cz: -0.5 });
    m.box(1.6, 0.35, 0.6, VERM, [0.2, 0.45, 1.35]); m.box(1.6, 0.05, 0.7, '#b8392a', [0.2, 0.63, 1.35]);
    m.cyl(0.04, 0.04, 2.2, 5, WOOD, [1.3, 1.1, 1.3]); m.cone(1.1, 0.5, 14, VERM, [1.3, 2.3, 1.3]);
    hangingLantern(b, -1.2, 1.7, 0.8);
  },
  sakura(b) {
    const m = b.m;
    m.cyl(0.2, 0.34, 2.4, 7, '#4a3530', [0, 1.2, 0], [0, 0, 0.08]);
    m.cyl(0.1, 0.14, 1.6, 5, '#4a3530', [-0.55, 2.5, 0], [0, 0, 0.8]); m.cyl(0.1, 0.14, 1.5, 5, '#4a3530', [0.5, 2.6, 0.2], [0.2, 0, -0.8]);
    m.ball(1.4, '#f4b8c8', [0, 3.4, 0], [1.3, 0.8, 1.2]); m.ball(1.05, '#f7c9d6', [-1.1, 3.0, 0.3], [1.1, 0.75, 1]); m.ball(0.95, '#eea3b9', [1.0, 3.0, -0.4], [1, 0.8, 1]); m.ball(0.85, '#fbd6e1', [0.2, 4.1, 0.3]);
    m.cyl(1.0, 1.0, 0.02, 12, '#f4c7d3', [0, 0.02, 0]);
  },
  lantern(b) { stoneLantern(b, 0, 0, 1.15); },
  torii(b) {
    const m = b.m;
    for (const x of [-1.4, 1.4]) { m.cyl(0.16, 0.19, 3.2, 8, VERM, [x, 1.6, 0]); m.cyl(0.24, 0.24, 0.3, 8, DARK, [x, 0.15, 0]); }
    m.box(3.9, 0.25, 0.34, DARK, [0, 3.4, 0]); m.box(3.6, 0.22, 0.3, VERM, [0, 3.18, 0]); m.box(3.2, 0.18, 0.2, VERM, [0, 2.6, 0]); m.box(0.2, 0.55, 0.12, VERM, [0, 2.9, 0]);
  },
};

// A model for a building type, sized to its footprint (w×d world units).
export function buildModel(type, w, d, seed = 1, conn = null) {
  const b = new ModelBuilder(seed + type.length * 17);
  MODELS[type](b, w, d, conn);
  const group = b.finish(type);
  if (b.extra) {
    if (b.extra.crop) group.add(b.extra.crop);
    if (b.extra.water) group.add(b.extra.water);
    if (b.extra.koi) for (const k of b.extra.koi) group.add(k.mesh);
  }
  group.userData.extra = b.extra || {};
  return group;
}

// Scaffolding + materials for a building under construction.
export function buildScaffold(w, d, h) {
  const m = new Mesher(3, 0.1);
  m.box(w - 0.1, 0.1, d - 0.1, '#8a6f4d', [0, 0.05, 0]);
  const nx = Math.max(2, Math.round(w / 1.6)), nz = Math.max(2, Math.round(d / 1.6));
  for (let i = 0; i <= nx; i++) for (const s of [-1, 1]) m.cyl(0.05, 0.05, h, 5, BAMBOO, [-w / 2 + i * w / nx, h / 2, s * (d / 2 - 0.05)]);
  for (let i = 1; i < nz; i++) for (const s of [-1, 1]) m.cyl(0.05, 0.05, h, 5, BAMBOO, [s * (w / 2 - 0.05), h / 2, -d / 2 + i * d / nz]);
  for (let y = 1; y < h; y += 1.3) { m.box(w, 0.06, 0.06, BAMBOO, [0, y, d / 2 - 0.05]); m.box(w, 0.06, 0.06, BAMBOO, [0, y, -d / 2 + 0.05]); m.box(0.06, 0.06, d, BAMBOO, [w / 2 - 0.05, y, 0]); m.box(0.06, 0.06, d, BAMBOO, [-w / 2 + 0.05, y, 0]); }
  for (let i = 0; i < 3; i++) m.cyl(0.18, 0.18, 1.6, 6, '#7a5438', [w / 2 - 0.5, 0.2 + i * 0.3, d / 2 + 0.4 - i * 0.05], [0, 0, Math.PI / 2]);
  m.box(0.6, 0.4, 0.4, '#a9a397', [-w / 2 + 0.6, 0.2, d / 2 + 0.35]);
  return m.mesh(MAT.flat);
}
