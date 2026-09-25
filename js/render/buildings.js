// Procedural building models. Front of every building faces local +Z.
import * as THREE from 'three';
import { ModelBuilder, Mesher, MAT } from './geo.js';

const WOOD = '#5a3a28', WOOD_L = '#8b5e3c', WOOD_D = '#3b2619', PLASTER = '#efe7d6', ROOF = '#3a414d', ROOF_D = '#262b33';
const STONE = '#8e897e', STONE_D = '#6d685f', THATCH = '#b8955a', THATCH_D = '#8f7040', VERM = '#c2412d', GOLD = '#dcaa45';
const PAPER = '#f3e9cf', DIRT = '#7d6245', SAND = '#e7dec8', MOSS = '#5f8a3e', BAMBOO = '#a9b25e', DARK = '#23252a';

// mortar lines on a sloped stone base (frustum wb×db → wt×dt, height h)
function courses(m, wb, db, wt, dt, h, y0 = 0, n = 4, hex = '#77736a') {
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1), w = wb + (wt - wb) * t, d = db + (dt - db) * t, y = y0 + h * t;
    m.box(w + 0.03, 0.05, 0.05, hex, [0, y, d / 2 + 0.01]); m.box(w + 0.03, 0.05, 0.05, hex, [0, y, -d / 2 - 0.01]);
    m.box(0.05, 0.05, d + 0.03, hex, [w / 2 + 0.01, y, 0]); m.box(0.05, 0.05, d + 0.03, hex, [-w / 2 - 0.01, y, 0]);
  }
}
// wooden lattice over a (glowing) window on a wall facing +z (or ±x when side)
function lattice(m, x, y, z, w, h, side = 0, hex = '#3b2619') {
  const nx = Math.max(2, Math.round(w / 0.18));
  for (let i = 1; i < nx; i++) {
    const o = -w / 2 + i * w / nx;
    if (side) m.box(0.04, h, 0.03, hex, [x + side * 0.03, y, z + o]); else m.box(0.03, h, 0.04, hex, [x + o, y, z + 0.03]);
  }
  if (side) m.box(0.04, 0.04, w, hex, [x + side * 0.03, y, z]); else m.box(w, 0.04, 0.04, hex, [x, y, z + 0.03]);
}
// the mine: rock outcrop, timbered entrance, rails and an ore cart — gold or iron
function mineModel(b, w, d, ore) { const save = MODELS._mine; return save(b, w, d, ore); }
// the iron mine's smelting furnace
function ironWorks(b, w, d) {
  const m = b.m;
  m.frustum(1.0, 1.0, 0.6, 0.6, 1.8, STONE_D, [w / 2 - 0.9, 0, d / 2 - 0.9]); b.g.box(0.3, 0.3, 0.1, '#ff7a2a', [w / 2 - 0.9, 0.5, d / 2 - 0.42]);
  for (let i = 0; i < 4; i++) m.box(0.5, 0.12, 0.3, '#6a7078', [-w / 2 + 0.7, 0.1 + i * 0.12, d / 2 - 0.5]);   // stacked iron bars
}
// latticed window with a glowing pane on a wall facing -z
function backWindow(b, x, y, z, w, h, glow = '#ffcf7a') {
  b.g.box(w, h, 0.06, glow, [x, y, z]);
  const nx = Math.max(2, Math.round(w / 0.18));
  for (let i = 1; i < nx; i++) b.m.box(0.03, h, 0.04, '#3b2619', [x - w / 2 + i * w / nx, y, z - 0.03]);
  b.m.box(w, 0.04, 0.04, '#3b2619', [x, y, z - 0.03]);
  b.m.box(w + 0.16, 0.08, 0.08, '#3b2619', [x, y - h / 2 - 0.04, z - 0.03]); b.m.box(w + 0.16, 0.08, 0.08, '#3b2619', [x, y + h / 2 + 0.04, z - 0.03]);
}
// straw rice bales (tawara)
function bales(m, x, z, n = 3) {
  for (let i = 0; i < n; i++) {
    const bx = x + (i % 2) * 0.64 + (i >= 2 ? 0.32 : 0), by = 0.25 + (i >= 2 ? 0.42 : 0);
    m.cyl(0.24, 0.24, 0.6, 8, '#cdb27a', [bx, by, z], [0, 0, Math.PI / 2]);
    for (const o of [-0.2, 0.2]) m.cyl(0.25, 0.25, 0.05, 8, '#8f7040', [bx + o, by, z], [0, 0, Math.PI / 2]);
  }
}
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
// Road tile: a centre patch plus an arm reaching exactly to each connected edge,
// so neighbouring tiles always meet without gaps or overhangs.
function roadTile(m, conn, stone) {
  const base = stone ? '#8f8a80' : '#a68a66', edge = stone ? '#77726a' : '#8f7556', W = 1.3, H = W / 2;
  const dirs = [['e', 1, 0], ['w', -1, 0], ['s', 0, 1], ['n', 0, -1]], arms = dirs.filter(([k]) => conn && conn[k]);
  m.box(W, 0.07, W, base, [0, 0.035, 0], [0, 0, 0], 0.02);
  for (const [, ax, az] of arms) m.box(ax ? 1 - H : W, 0.07, az ? 1 - H : W, base, [ax * (H + (1 - H) / 2), 0.035, az * (H + (1 - H) / 2)], [0, 0, 0], 0.02);
  // soft kerb on the open sides
  for (const [k, ax, az] of dirs) if (!(conn && conn[k])) m.box(ax ? 0.08 : W, 0.09, az ? 0.08 : W, edge, [ax * H, 0.045, az * H], [0, 0, 0], 0.02);
  const r = (i, k) => ((i * 7919 + k * 104729) % 1000) / 1000;
  if (stone) {
    let i = 0;
    const slab = (x, z) => m.box(0.38 + r(i, 1) * 0.06, 0.03, 0.38 + r(i, 2) * 0.06, ['#a39e93', '#9a958a', '#b0ab9f', '#8f8a7f'][i++ % 4], [x, 0.085, z], [0, (r(i, 3) - 0.5) * 0.12, 0], 0.03);
    for (const x of [-0.43, 0, 0.43]) for (const z of [-0.43, 0, 0.43]) slab(x, z);
    for (const [, ax, az] of arms) for (const o of [-0.43, 0, 0.43]) slab(ax ? ax * 0.83 : o, az ? az * 0.83 : o);
  } else {
    // wheel ruts follow the road through the centre
    const rut = '#8c7253';
    for (const o of [-0.3, 0.3]) {
      if (!arms.length) { m.box(W * 0.8, 0.02, 0.08, rut, [0, 0.075, o]); continue; }
      for (const [, ax, az] of arms) m.box(ax ? 1 : 0.08, 0.02, az ? 1 : 0.08, rut, [ax ? ax * 0.5 : o, 0.075, az ? az * 0.5 : o]);
    }
    for (let i = 0; i < 4; i++) m.box(0.1, 0.05, 0.1, '#9d978b', [(r(i, 5) - 0.5) * 1.0, 0.08, (r(i, 6) - 0.5) * 1.0], [0, r(i, 7) * 3, 0]);
  }
}
function bush(m, x, z, s = 1, hex = '#4f7d3a') { m.ball(0.55 * s, hex, [x, 0.4 * s, z], [1.2, 0.9, 1.1]); }

const MODELS = {
  townhall(b) {
    const m = b.m, L = b.level || 1;
    m.frustum(8, 8, 6.9, 6.9, 2.3, STONE, [0, 0, 0]);
    courses(m, 8, 8, 6.9, 6.9, 2.3, 0, 5);
    for (let i = 0; i < 5; i++) m.box(1.6, 0.2, 0.5, STONE_D, [0, 0.1 + i * 0.22, 4.1 - i * 0.25]); // front steps
    m.box(6.3, 2.7, 6.3, PLASTER, [0, 2.3 + 1.35, 0]);
    for (const y of [2.4, 4.9]) m.box(6.45, 0.26, 6.45, WOOD, [0, y, 0]);
    posts(m, 6.45, 6.45, 2.6, 2.3, WOOD, 0.16);
    m.box(1.4, 1.7, 0.1, WOOD_D, [0, 3.2, 3.17]);
    for (const x of [-2, 2]) { b.g.box(0.7, 0.55, 0.08, '#ffcf7a', [x, 3.8, 3.17]); lattice(m, x, 3.8, 3.2, 0.7, 0.55); }
    for (const z of [-1.6, 1.6]) { b.g.box(0.08, 0.55, 0.7, '#ffcf7a', [3.17, 3.8, z]); b.g.box(0.08, 0.55, 0.7, '#ffcf7a', [-3.17, 3.8, z]); lattice(m, 3.2, 3.8, z, 0.7, 0.55, 1); lattice(m, -3.2, 3.8, z, 0.7, 0.55, -1); }
    hangingLantern(b, -1.1, 4.3, 3.35); hangingLantern(b, 1.1, 4.3, 3.35);
    // back: a small service door, two windows, a timber band and supplies at the foot of the base
    m.box(1.0, 1.5, 0.1, WOOD_D, [0, 3.05, -3.17]); m.box(1.2, 0.1, 0.14, WOOD, [0, 3.85, -3.2]);
    for (const x of [-2, 2]) backWindow(b, x, 3.8, -3.18, 0.7, 0.55);
    hangingLantern(b, 0, 4.3, -3.4);
    for (const [x, z, w, d] of [[0, 3.2, 6.34, 0.06], [0, -3.2, 6.34, 0.06], [3.2, 0, 0.06, 6.34], [-3.2, 0, 0.06, 6.34]]) m.box(w, 0.1, d, WOOD, [x, 3.1, z]);

    for (const x of [-2.6, 2.6]) { m.cyl(0.05, 0.05, 4.2, 5, WOOD_D, [x, 2.1, 4.6]); m.box(0.05, 2.2, 0.7, VERM, [x, 2.9, 4.95]); m.box(0.06, 0.5, 0.5, PLASTER, [x, 3.3, 4.95]); }
    if (L === 1) { m.roof(6.3, 6.3, 2.2, ROOF, 5.0, { over: 0.95, ridge: 0.45, ornaments: GOLD }); return; }
    m.roof(6.3, 6.3, 1.7, ROOF, 5.0, { over: 0.95, ridge: 0.4 });
    // second storey with a balcony
    m.box(4.8, 2.3, 4.8, PLASTER, [0, 6.0 + 1.15, 0]);
    m.box(4.95, 0.22, 4.95, WOOD, [0, 6.1, 0]); posts(m, 4.95, 4.95, 2.3, 6.0, WOOD, 0.14);
    for (const x of [-1.2, 1.2]) { b.g.box(0.6, 0.5, 0.08, '#ffcf7a', [x, 7.3, 2.42]); lattice(m, x, 7.3, 2.44, 0.6, 0.5); }
    for (const [x, z, w, d] of [[0, 2.72, 5.3, 0.06], [0, -2.72, 5.3, 0.06], [2.72, 0, 0.06, 5.3], [-2.72, 0, 0.06, 5.3]]) { m.box(w, 0.06, d, WOOD_D, [x, 6.55, z]); m.box(w, 0.06, d, WOOD_D, [x, 6.25, z]); }
    for (let i = -2; i <= 2; i++) for (const [x, z] of [[i * 1.3, 2.72], [i * 1.3, -2.72], [2.72, i * 1.3], [-2.72, i * 1.3]]) m.box(0.07, 0.5, 0.07, WOOD_D, [x, 6.3, z]);
    m.box(5.5, 0.1, 5.5, WOOD, [0, 6.02, 0]);
    for (const x of [-1.2, 1.2]) backWindow(b, x, 7.3, -2.42, 0.6, 0.5);
    for (const z of [-1.2, 1.2]) for (const sx of [-1, 1]) { b.g.box(0.08, 0.5, 0.6, '#ffcf7a', [sx * 2.42, 7.3, z]); lattice(m, sx * 2.44, 7.3, z, 0.6, 0.5, sx); }
    m.frustum(2.6, 1.3, 0.3, 1.0, 0.9, ROOF, [0, 8.1, 2.55]); // karahafu gable
    if (L === 2) { m.roof(4.8, 4.8, 2.0, ROOF, 8.3, { over: 0.85, ridge: 0.4, ornaments: GOLD }); return; }
    m.roof(4.8, 4.8, 1.5, ROOF, 8.3, { over: 0.85, ridge: 0.4 });
    // third storey
    m.box(3.3, 1.9, 3.3, PLASTER, [0, 9.2 + 0.95, 0]);
    m.box(3.45, 0.2, 3.45, WOOD, [0, 9.3, 0]); posts(m, 3.45, 3.45, 1.9, 9.2, WOOD, 0.12);
    b.g.box(0.9, 0.5, 0.08, '#ffcf7a', [0, 10.2, 1.67]); lattice(m, 0, 10.2, 1.7, 0.9, 0.5);
    backWindow(b, 0, 10.2, -1.67, 0.9, 0.5);
    for (const sx of [-1, 1]) { b.g.box(0.08, 0.5, 0.7, '#ffcf7a', [sx * 1.67, 10.2, 0]); lattice(m, sx * 1.7, 10.2, 0, 0.7, 0.5, sx); }
    m.cyl(0.32, 0.32, 0.05, 12, GOLD, [0, 10.8, 1.72], [Math.PI / 2, 0, 0]); m.cyl(0.18, 0.18, 0.06, 12, ROOF, [0, 10.8, 1.73], [Math.PI / 2, 0, 0]);
    m.roof(3.3, 3.3, 1.9, ROOF, 11.1, { over: 0.75, ridge: 0.35, ornaments: GOLD, ridgeHex: L >= 5 ? GOLD : '#2a2e36' });
    stoneLantern(b, -3.4, 5.2, 0.9); stoneLantern(b, 3.4, 5.2, 0.9);
    if (L >= 4) {
      // corner watch turrets on the stone base
      for (const [x, z] of [[-3.3, -3.3], [3.3, -3.3], [-3.3, 3.3], [3.3, 3.3]]) {
        m.box(1.1, 1.1, 1.1, PLASTER, [x, 2.85, z]); m.box(1.2, 0.1, 1.2, WOOD_D, [x, 2.35, z]);
        m.roof(1.1, 1.1, 0.8, ROOF, 3.4, { over: 0.3, ridge: 0.3 });
      }
    }
    if (L >= 5) {
      for (const s of [-1, 1]) { m.cyl(0.06, 0.06, 6, 6, WOOD_D, [s * 4.6, 3, -2.5]); m.box(0.05, 2.6, 1.0, GOLD, [s * 4.6, 4.6, -2.0]); m.cyl(0.25, 0.25, 0.06, 10, VERM, [s * 4.62, 4.9, -2.0], [0, 0, Math.PI / 2]); }
      for (const y of [5.02, 8.32]) m.box(y > 6 ? 6.6 : 8.2, 0.05, y > 6 ? 6.6 : 8.2, GOLD, [0, y, 0]);
    }
  },
  house(b) {
    const m = b.m;
    m.box(3.7, 0.45, 3.7, WOOD_L, [0, 0.22, 0]);
    posts(m, 3.5, 3.5, 0.5, 0, WOOD_D, 0.14);
    m.box(3.1, 1.9, 2.8, PLASTER, [0, 0.45 + 0.95, -0.2]);
    posts(m, 3.2, 2.9, 1.95, 0.45, WOOD, 0.1);
    m.box(3.25, 0.16, 2.95, WOOD, [0, 2.35, -0.2]);
    b.g.box(1.3, 1.35, 0.06, PAPER, [0, 1.2, 1.22]);
    for (let i = -2; i <= 2; i++) m.box(0.04, 1.35, 0.04, WOOD, [i * 0.26, 1.2, 1.26]);
    for (let j = -2; j <= 2; j++) m.box(1.3, 0.04, 0.04, WOOD, [0, 1.2 + j * 0.27, 1.26]);
    for (let i = 0; i < 3; i++) m.box(0.4, 0.5, 0.03, '#2f4a7a', [-0.45 + i * 0.45, 1.72, 1.32]);   // noren curtain
    m.box(1.4, 0.05, 0.05, WOOD_D, [0, 1.98, 1.32]);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) m.cyl(0.08, 0.08, 0.6, 6, '#8a6a4a', [-1.35, 0.55 + r * 0.14, -1.2 + i * 0.17 + r * 0.08], [Math.PI / 2, 0, 0]);  // firewood
    m.cyl(0.14, 0.11, 0.2, 7, '#7a4a32', [1.45, 0.6, 1.75]); m.ball(0.2, '#35653c', [1.45, 0.85, 1.75], [1.3, 0.6, 1.1]);  // potted bonsai
    b.g.box(0.06, 0.7, 0.9, PAPER, [1.57, 1.5, -0.2]);
    m.box(3.7, 0.12, 0.8, WOOD_L, [0, 0.5, 1.55]); // engawa porch
    m.roof(3.1, 2.8, 2.5, THATCH, 2.35, { over: 0.75, ridge: 0.45, ridgeHex: THATCH_D, cz: -0.2 });
    m.box(0.5, 0.5, 0.5, WOOD_L, [1.2, 0.25, 2.1]); m.cyl(0.25, 0.28, 0.5, 8, WOOD, [-1.3, 0.25, 2.1]); // barrel & crate
    hangingLantern(b, 1.3, 1.9, 1.35);
    // back: a latticed window, a mid-height beam, a rain barrel and drying persimmons under the eaves
    backWindow(b, 0.55, 1.55, -1.62, 0.9, 0.6, PAPER);
    m.box(3.14, 0.08, 0.06, WOOD, [0, 0.95, -1.62]);
    m.cyl(0.22, 0.22, 0.5, 10, WOOD, [1.25, 0.7, -1.85]); m.cyl(0.23, 0.23, 0.05, 10, DARK, [1.25, 0.8, -1.85]); m.cyl(0.19, 0.19, 0.02, 10, '#2e4a58', [1.25, 0.96, -1.85]);
    for (const x of [-0.9, -0.55, -0.2]) { m.box(0.02, 0.6, 0.02, '#c9b58a', [x, 2.0, -1.75]); for (let k = 0; k < 4; k++) m.ball(0.06, '#e07a2e', [x, 1.78 + k * 0.14, -1.75]); }
    b.g.box(0.06, 0.7, 0.9, PAPER, [-1.57, 1.5, -0.2]); lattice(m, -1.6, 1.5, -0.2, 0.9, 0.7, -1);
  },
  // a row house: four homes side by side under one long tiled roof, each with its own door and curtain
  nagaya(b, w, d) {
    const m = b.m, L = b.level || 1, W = w - 0.5, D = d - 1.3, units = 4, uw = W / units;
    m.box(w - 0.1, 0.4, d - 0.1, STONE, [0, 0.2, 0]); courses(m, w - 0.1, d - 0.1, w - 0.1, d - 0.1, 0.4, 0, 1);
    m.box(W, 1.9, D, PLASTER, [0, 0.4 + 0.95, -0.35]);
    m.box(W + 0.1, 0.14, D + 0.1, WOOD, [0, 2.32, -0.35]); m.box(W + 0.1, 0.08, 0.06, WOOD, [0, 1.25, D / 2 - 0.33]); m.box(W + 0.1, 0.08, 0.06, WOOD, [0, 1.25, -D / 2 - 0.37]);
    for (let i = 0; i <= units; i++) { const x = -W / 2 + i * uw; m.box(0.16, 1.95, 0.16, WOOD, [x, 1.37, D / 2 - 0.35]); m.box(0.16, 1.95, 0.16, WOOD, [x, 1.37, -D / 2 - 0.35]); }
    const cols = ['#2f4a7a', '#7a2f2a', '#3f5f3a', '#5a3f6a'];
    for (let i = 0; i < units; i++) {
      const x = -W / 2 + (i + 0.5) * uw;
      // sliding door with a noren curtain, a small window, a pot plant or a bucket
      b.g.box(0.75, 1.3, 0.06, PAPER, [x - 0.3, 1.1, D / 2 - 0.33]); for (let k = -1; k <= 1; k++) m.box(0.03, 1.3, 0.04, WOOD, [x - 0.3 + k * 0.25, 1.1, D / 2 - 0.3]);
      for (let k = 0; k < 2; k++) m.box(0.34, 0.42, 0.03, cols[i], [x - 0.47 + k * 0.35, 1.6, D / 2 - 0.26]);
      b.g.box(0.45, 0.4, 0.06, '#ffcf7a', [x + 0.45, 1.5, D / 2 - 0.33]); lattice(m, x + 0.45, 1.5, D / 2 - 0.33, 0.45, 0.4);
      backWindow(b, x, 1.55, -D / 2 - 0.37, 0.6, 0.45, PAPER);
      if (i % 2) { m.cyl(0.14, 0.11, 0.22, 7, '#7a4a32', [x + 0.5, 0.55, D / 2 + 0.25]); m.ball(0.2, '#35653c', [x + 0.5, 0.8, D / 2 + 0.25], [1.3, 0.6, 1.1]); }
      else { m.cyl(0.16, 0.14, 0.3, 8, WOOD, [x + 0.55, 0.55, D / 2 + 0.25]); m.cyl(0.13, 0.13, 0.02, 8, '#2e4a58', [x + 0.55, 0.71, D / 2 + 0.25]); }
    }
    // shared eaves walkway and a shared well at the end
    m.box(W + 0.3, 0.1, 0.7, WOOD_L, [0, 0.45, D / 2 + 0.05]);
    m.roof(W, D, 1.6, ROOF, 2.38, { over: 0.6, ridge: 0.3, cz: -0.35 });
    for (let i = 1; i < units; i++) m.box(0.08, 0.5, D + 0.9, ROOF_D, [-W / 2 + i * uw, 2.75, -0.35]); // fire walls between the homes
    const wx = w / 2 - 0.35, wz = -d / 2 + 0.35;
    m.cyl(0.26, 0.3, 0.45, 10, STONE, [wx, 0.62, wz]); m.cyl(0.21, 0.21, 0.03, 10, '#2e4a58', [wx, 0.84, wz]);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 3 - r; i++) m.cyl(0.07, 0.07, 0.55, 6, '#8a6a4a', [-w / 2 + 0.35, 0.5 + r * 0.13, -0.8 + i * 0.15 + r * 0.07], [Math.PI / 2, 0, 0]);
    hangingLantern(b, -W / 2 + 0.3, 1.9, D / 2 - 0.05);
    if (L >= 2) hangingLantern(b, W / 2 - 0.3, 1.9, D / 2 - 0.05);
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
    m.cyl(0.3, 0.3, 0.04, 12, DARK, [0, 3.25, 2.57], [Math.PI / 2, 0, 0]); m.cyl(0.2, 0.2, 0.05, 12, PLASTER, [0, 3.25, 2.58], [Math.PI / 2, 0, 0]); m.box(0.2, 0.04, 0.02, DARK, [0, 3.25, 2.6]);
    for (let i = 0; i < 3; i++) m.box(0.6, 0.45, 0.45, i % 2 ? '#a07a4a' : '#8a6a44', [1.1 - i * 0.2, 0.62 + (i === 2 ? 0.45 : 0), 2.95 - (i === 2 ? 0.1 : 0)]);  // crates at the door
    // back: a small barred window with a plaster shutter, rice bales and a ladder
    m.box(0.7, 0.55, 0.08, DARK, [0, 2.8, -2.56]); for (let i = -1; i <= 1; i++) m.box(0.05, 0.55, 0.05, '#9aa0a6', [i * 0.18, 2.8, -2.61]);
    m.box(0.45, 0.6, 0.12, PLASTER, [0.62, 2.8, -2.6]);
    bales(m, -1.1, -2.83, 3);
    for (const x of [1.0, 1.45]) m.box(0.07, 2.4, 0.07, WOOD, [x, 1.4, -2.75], [-0.18, 0, 0]);
    for (let i = 0; i < 5; i++) m.box(0.5, 0.05, 0.05, WOOD, [1.22, 0.55 + i * 0.42, -2.83 + i * 0.075]);
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
    // a well, a drying rack hung with sheaves and an irrigation ditch
    const wx = -w / 2 + 0.9, wz = d / 2 - 0.9;
    m.cyl(0.45, 0.5, 0.6, 10, STONE, [wx, 0.3, wz]); m.cyl(0.36, 0.36, 0.05, 10, '#2e4a58', [wx, 0.58, wz]);
    for (const s of [-1, 1]) m.box(0.07, 1.2, 0.07, WOOD, [wx + s * 0.42, 0.9, wz]); m.box(1.0, 0.07, 0.07, WOOD, [wx, 1.5, wz]);
    m.roof(1.0, 0.6, 0.35, THATCH, 1.55, { over: 0.15, ridgeHex: THATCH_D, cx: wx, cz: wz });
    m.cyl(0.12, 0.1, 0.18, 8, '#6b4a2e', [wx + 0.15, 1.2, wz]);
    const rx = w / 2 - 0.6;
    for (const z of [-0.8, 0.8]) m.box(0.08, 1.4, 0.08, BAMBOO, [rx, 0.7, z]); m.box(0.06, 0.06, 1.7, BAMBOO, [rx, 1.3, 0]);
    for (let i = 0; i < 5; i++) m.cone(0.16, 0.7, 5, '#d8b653', [rx, 0.95, -0.6 + i * 0.3], [Math.PI, 0, 0]);
    m.box(w - 0.6, 0.04, 0.3, '#3f6f84', [0, 0.1, d / 2 - 0.35]);
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
    const m = b.m, L = b.level || 1;
    m.box(3.8, 0.1, 3.8, DIRT, [0, 0.05, 0]);
    posts(m, 3.0, 2.4, 2.4, 0, WOOD, 0.12);
    m.box(3.5, 0.15, 3.0, '#6b4c35', [0, 2.55, -0.3], [0.25, 0, 0]);
    for (let i = 0; i < 8; i++) m.box(0.12, 0.05, 3.0, '#5a3e2a', [-1.6 + i * 0.46, 2.66, -0.3], [0.25, 0, 0]); // shingle battens
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) {
      const x = -0.9 + i * 0.55 + r * 0.27, y = 0.28 + r * 0.46;
      m.cyl(0.26, 0.26, 2.4, 8, i % 2 ? '#7a5438' : '#6d4a31', [x, y, -0.5], [Math.PI / 2, 0, 0]); // logs run front to back
      m.cyl(0.22, 0.22, 0.02, 8, '#d2b07a', [x, y, 0.71], [Math.PI / 2, 0, 0]); // cut ends
      m.cyl(0.22, 0.22, 0.02, 8, '#d2b07a', [x, y, -1.71], [Math.PI / 2, 0, 0]);
    }
    // chopping block with an axe, sawhorse with a saw, plank stack, hand cart
    m.cyl(0.4, 0.45, 0.6, 8, '#6b4a33', [1.2, 0.3, 1.2]); m.cyl(0.36, 0.36, 0.02, 8, '#c9a878', [1.2, 0.61, 1.2]);
    m.box(0.06, 0.6, 0.06, WOOD_D, [1.2, 0.9, 1.2], [0.4, 0, 0]); m.box(0.25, 0.18, 0.04, '#9aa0a6', [1.2, 1.15, 1.32], [0.4, 0, 0]);
    m.box(1.4, 0.08, 0.2, '#8c6a4a', [-1.1, 0.7, 1.3]); for (const x of [-1.6, -0.6]) { m.box(0.08, 0.7, 0.5, '#8c6a4a', [x, 0.35, 1.3], [0.3, 0, 0]); }
    m.cyl(0.18, 0.18, 1.3, 8, '#7a5438', [-1.1, 0.9, 1.3], [0, 0, Math.PI / 2]); m.box(0.9, 0.16, 0.02, '#aab0b6', [-1.1, 1.15, 1.42]); m.box(0.08, 0.2, 0.05, WOOD_D, [-0.62, 1.15, 1.42]);
    for (let i = 0; i < 4; i++) m.box(1.4, 0.08, 0.3, i % 2 ? '#b08858' : '#a07a4a', [1.3, 0.1 + i * 0.09, -1.45]);
    m.box(0.9, 0.3, 0.6, WOOD_L, [-1.5, 0.45, -1.5]); m.cyl(0.25, 0.25, 0.06, 10, DARK, [-1.5, 0.25, -1.1], [Math.PI / 2, 0, 0]); m.box(0.05, 0.05, 1.0, WOOD_D, [-1.5, 0.5, -0.7], [0.4, 0, 0]);
    if (L >= 2) for (let i = 0; i < 3; i++) m.cyl(0.2, 0.2, 1.8, 7, '#6d4a31', [1.4, 0.2 + (i % 2) * 0.35, 0.2 + i * 0.3 - (i === 2 ? 0.45 : 0)], [0, 0, Math.PI / 2]);
    if (L >= 4) hangingLantern(b, 1.3, 1.9, 0.9);
  },
  quarry(b, w, d) {
    const m = b.m, L = b.level || 1;
    m.box(w - 0.2, 0.1, d - 0.2, '#8b8578', [0, 0.05, 0]);
    // terraced rock face with chisel marks
    for (let i = 0; i < 3; i++) m.box(w * 0.7 - i * 0.6, 0.9, 1.2, i % 2 ? STONE_D : STONE, [-0.4 + i * 0.1, 0.45 + i * 0.85, -d / 2 + 0.8 + i * 0.25]);
    for (let i = 0; i < 6; i++) m.box(0.05, 0.6, 0.05, '#5d5850', [-1.4 + i * 0.5, 1.4, -d / 2 + 1.42]);
    m.add(new THREE.DodecahedronGeometry(1.0, 0), STONE, [-w / 2 + 0.9, 0.7, 0.2], [0.2, 0.4, 0], [1.1, 0.9, 1]);
    m.add(new THREE.DodecahedronGeometry(0.7, 0), '#9a958a', [w / 2 - 0.9, 0.5, -0.5], [0, 1, 0]);
    // squared blocks ready to go, a cart and tools
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) m.box(0.7, 0.45, 0.45, '#b3ada1', [0.9 + i * 0.72, 0.23 + j * 0.46, d / 2 - 0.9 - j * 0.1]);
    m.box(1.0, 0.35, 0.7, WOOD_L, [-0.6, 0.55, d / 2 - 0.8]); for (const x of [-1.0, -0.2]) m.cyl(0.25, 0.25, 0.08, 10, DARK, [x, 0.3, d / 2 - 0.42], [Math.PI / 2, 0, 0]);
    m.box(0.45, 0.3, 0.35, '#a9a397', [-0.6, 0.85, d / 2 - 0.8]);
    for (const [x, a] of [[0.2, 0.3], [0.45, -0.2]]) { m.box(0.05, 0.9, 0.05, '#6b4a2e', [x, 0.45, 0.4], [a, 0, 0.3]); m.box(0.06, 0.06, 0.5, '#6f7378', [x, 0.9, 0.4 + a * 0.4], [0.2, 0, 0]); }
    // wooden hoist
    for (const a of [0, 2.1, 4.2]) m.cyl(0.07, 0.07, 3.2, 5, WOOD, [0.6 + Math.cos(a) * 0.6, 1.5, 0.2 + Math.sin(a) * 0.6], [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35]);
    m.cyl(0.02, 0.02, 1.6, 4, '#c9b58a', [0.6, 2.2, 0.2]); m.box(0.5, 0.35, 0.35, '#a9a397', [0.6, 1.2, 0.2]);
    b.g.box(0.2, 0.2, 0.2, '#ffcf7a', [w / 2 - 0.5, 1.2, -0.6]);
    // behind the face: scree, shrubs and a rope ladder down the rock
    for (let i = 0; i < 5; i++) m.add(new THREE.DodecahedronGeometry(0.22 + (i % 3) * 0.08, 0), i % 2 ? '#9a958a' : '#77726a', [-w / 2 + 0.6 + i * (w - 1.2) / 4, 0.18, -d / 2 + 0.28], [i, i * 2, 0], [1, 0.7, 1]);
    for (const [x, sc] of [[-w / 2 + 0.5, 0.7], [w / 2 - 0.5, 0.8]]) bush(m, x, -d / 2 + 0.5, sc, '#4a6f36');
    for (const x of [0.9, 1.3]) m.box(0.04, 2.4, 0.04, '#c9b58a', [x, 1.25, -d / 2 + 0.22]); for (let i = 0; i < 6; i++) m.box(0.44, 0.05, 0.05, WOOD, [1.1, 0.25 + i * 0.4, -d / 2 + 0.2]);
    if (L >= 3) { m.box(w - 0.6, 0.08, 0.3, WOOD, [0, 1.8, -d / 2 + 1.7]); for (const x of [-w / 2 + 0.6, w / 2 - 0.6]) m.box(0.1, 1.8, 0.1, WOOD, [x, 0.9, -d / 2 + 1.7]); }
  },
  mine(b, w, d) { return mineModel(b, w, d, GOLD); },
  ironmine(b, w, d) { mineModel(b, w, d, '#5a6068'); ironWorks(b, w, d); },
  _mine(b, w, d, ore = GOLD) {
    const m = b.m, L = b.level || 1;
    m.box(w - 0.2, 0.1, d - 0.2, '#7a6a55', [0, 0.05, 0]);
    m.add(new THREE.DodecahedronGeometry(2.6, 1), '#7d756a', [0, 1.1, -0.9], [0, 0.3, 0], [1.1, 0.75, 0.9]);
    m.add(new THREE.DodecahedronGeometry(1.4, 0), '#6d665c', [-1.8, 0.9, 0.2], [0.3, 0, 0]);
    m.ball(0.9, '#8a7a62', [1.9, 0.3, 1.2], [1.3, 0.5, 1]); // spoil heap
    // timbered entrance with a little roof and lanterns
    m.box(1.5, 1.7, 0.4, '#141312', [0, 0.95, 1.2]);
    m.box(0.22, 2.0, 0.22, WOOD, [-0.85, 1.0, 1.35]); m.box(0.22, 2.0, 0.22, WOOD, [0.85, 1.0, 1.35]); m.box(2.1, 0.26, 0.3, WOOD, [0, 2.05, 1.35]);
    m.roof(2.0, 0.8, 0.6, '#6b4c35', 2.2, { over: 0.25, ridge: 0.9, ridgeHex: WOOD_D, cz: 1.4 });
    m.box(0.6, 0.35, 0.04, '#e8dcc0', [0, 2.45, 1.52]); m.box(0.4, 0.06, 0.02, DARK, [0, 2.45, 1.55]);
    hangingLantern(b, -0.7, 1.6, 1.62); hangingLantern(b, 0.7, 1.6, 1.62);
    // rails, sleepers and an ore cart
    for (const x of [-0.35, 0.35]) m.box(0.06, 0.05, 2.0, '#6f7378', [x, 0.13, 2.1]);
    for (let i = 0; i < 6; i++) m.box(0.9, 0.06, 0.12, WOOD, [0, 0.1, 1.3 + i * 0.35]);
    m.frustum(0.8, 0.6, 1.0, 0.8, 0.5, WOOD_L, [0, 0.2, 2.3]); for (const x of [-0.3, 0.3]) m.cyl(0.12, 0.12, 0.8, 8, DARK, [x * 1.2, 0.2, 2.3], [0, 0, Math.PI / 2]);
    for (let i = 0; i < 5; i++) m.ball(0.14, ore, [-0.25 + (i % 3) * 0.25, 0.75, 2.2 + (i > 2 ? 0.2 : 0)]);
    for (const [x, y, z] of [[-1.2, 1.5, 0.4], [1.3, 1.8, -0.1], [0.4, 2.6, -0.4]]) m.box(0.22, 0.18, 0.2, ore, [x, y, z], [0.5, 0.7, 0]);
    // tools leaning by the door
    for (const x of [1.15, 1.3]) { m.box(0.05, 1.0, 0.05, '#6b4a2e', [x, 0.5, 1.5], [0, 0, 0.2]); m.box(0.4, 0.06, 0.06, '#6f7378', [x + 0.1, 1.0, 1.5]); }
    // back of the hill: a timbered air shaft, moss and shrubs
    m.box(0.6, 0.9, 0.6, WOOD, [0.9, 2.3, -1.7]); for (const [x, z] of [[0.62, -1.42], [1.18, -1.42], [0.62, -1.98], [1.18, -1.98]]) m.box(0.08, 1.0, 0.08, WOOD_D, [x, 2.3, z]);
    m.roof(0.7, 0.7, 0.4, '#6b4c35', 2.8, { over: 0.15, ridgeHex: WOOD_D, cx: 0.9, cz: -1.7 });
    for (const [x, z, sc] of [[-1.2, -2.2, 0.9], [-0.2, -2.45, 0.7], [1.9, -2.1, 0.8], [-2.3, -1.2, 0.7]]) bush(m, x, z, sc, '#4a6f36');
    for (const [x, y, z] of [[-0.9, 1.9, -1.6], [0.3, 2.4, -1.3]]) m.ball(0.5, MOSS, [x, y, z], [1.4, 0.4, 1.2]);
    if (L >= 3) { m.box(0.8, 1.6, 0.8, WOOD_L, [-1.6, 0.8, 1.4]); m.roof(0.8, 0.8, 0.5, THATCH, 1.6, { over: 0.2, ridgeHex: THATCH_D, cx: -1.6, cz: 1.4 }); }
  },
  infirmary(b) {
    const m = b.m;
    m.box(3.7, 0.35, 3.7, STONE, [0, 0.18, 0]);
    m.box(3.0, 1.8, 2.6, PLASTER, [0, 0.35 + 0.9, -0.3]); posts(m, 3.1, 2.7, 1.85, 0.35, WOOD, 0.1);
    m.box(3.14, 0.12, 2.74, WOOD, [0, 2.2, -0.3]); m.box(3.14, 0.08, 0.06, WOOD, [0, 1.1, 1.02]); m.box(3.14, 0.08, 0.06, WOOD, [0, 1.1, -1.62]);
    b.g.box(1.1, 1.2, 0.06, PAPER, [-0.5, 1.0, 1.02]); for (let i = -2; i <= 2; i++) m.box(0.04, 1.2, 0.04, WOOD, [-0.5 + i * 0.22, 1.0, 1.06]);
    for (let i = 0; i < 3; i++) m.box(0.34, 0.45, 0.03, '#4f7d4a', [-0.85 + i * 0.35, 1.45, 1.12]);   // green noren
    m.cyl(0.14, 0.14, 0.03, 12, '#f5efe0', [-0.5, 1.5, 1.14], [Math.PI / 2, 0, 0]);
    backWindow(b, 0.6, 1.4, -1.62, 1.0, 0.55, PAPER);
    m.roof(3.0, 2.6, 1.7, ROOF, 2.25, { over: 0.65, ridge: 0.5, cz: -0.3 });
    // herb drying racks, a simmering pot and a bench for the wounded
    for (const x of [0.9, 1.5]) m.box(0.06, 1.3, 0.06, BAMBOO, [x, 1.0, 1.5]); m.box(0.8, 0.05, 0.05, BAMBOO, [1.2, 1.6, 1.5]);
    for (let i = 0; i < 5; i++) m.cone(0.08, 0.35, 5, i % 2 ? '#6f9a4a' : '#9ab35a', [0.95 + i * 0.13, 1.4, 1.5], [Math.PI, 0, 0]);
    m.cyl(0.28, 0.22, 0.35, 10, '#3a3d42', [1.3, 0.55, 0.6]); m.cyl(0.22, 0.22, 0.02, 10, '#8a9a5a', [1.3, 0.73, 0.6]);
    for (let i = 0; i < 3; i++) m.box(0.07, 0.25, 0.07, '#6b4a2e', [1.3 + Math.cos(i * 2.1) * 0.22, 0.28, 0.6 + Math.sin(i * 2.1) * 0.22]);
    b.g.box(0.18, 0.1, 0.18, '#ff9b6a', [1.3, 0.3, 0.6]);
    m.box(1.2, 0.1, 0.4, WOOD_L, [-1.0, 0.6, 1.55]); for (const x of [-1.45, -0.55]) m.box(0.08, 0.25, 0.35, WOOD_D, [x, 0.47, 1.55]);
    hangingLantern(b, 1.25, 1.75, 1.15);
  },
  // Sake brewery: a white-walled kura with a cedar ball (sugidama) over the door, vats and rice bales
  sakebrewery(b, w, d) {
    const m = b.m, L = b.level || 1;
    m.box(w - 0.1, 0.35, d - 0.1, STONE, [0, 0.18, 0]);
    m.box(w - 0.6, 2.4, d - 0.9, PLASTER, [0, 0.35 + 1.2, -0.2]);
    m.box(w - 0.54, 0.8, d - 0.84, DARK, [0, 0.8, -0.2]);                                   // tarred lower walls
    for (let i = -3; i <= 3; i++) m.box(0.04, 0.8, d - 0.8, '#dcd6c8', [i * (w - 0.6) / 7, 0.8, -0.2]);
    m.box(w - 0.4, 0.14, d - 0.7, WOOD, [0, 2.8, -0.2]);
    m.roof(w - 0.6, d - 0.9, 1.5, ROOF, 2.85, { over: 0.6, ridge: 0.6, cz: -0.2 });
    // door with an indigo noren marked 酒, and the sugidama cedar ball
    m.box(1.1, 1.6, 0.06, WOOD_D, [-0.8, 1.15, d / 2 - 0.62]);
    for (let i = 0; i < 3; i++) m.box(0.34, 0.6, 0.03, '#2f4a7a', [-1.14 + i * 0.35, 1.7, d / 2 - 0.57]);
    m.box(0.22, 0.26, 0.02, '#f5efe0', [-0.8, 1.72, d / 2 - 0.55]);
    m.ball(0.42, '#6b7a3a', [0.4, 2.2, d / 2 - 0.35], [1, 1, 1]); m.box(0.05, 0.3, 0.05, WOOD_D, [0.4, 2.65, d / 2 - 0.4]);
    backWindow(b, 1.0, 1.9, -(d - 0.9) / 2 - 0.22, 0.7, 0.45, PAPER);
    // vats and barrels outside, rice bales
    for (let i = 0; i < 2; i++) { const x = w / 2 - 0.6 - i * 0.9; m.cyl(0.38, 0.34, 0.8, 12, WOOD_L, [x, 0.4, d / 2 - 0.3]); m.cyl(0.39, 0.39, 0.05, 12, DARK, [x, 0.6, d / 2 - 0.3]); m.cyl(0.39, 0.39, 0.05, 12, DARK, [x, 0.2, d / 2 - 0.3]); }
    bales(m, -w / 2 + 0.3, d / 2 - 0.25, 3);
    for (let i = 0; i < L + 1; i++) m.cyl(0.14, 0.12, 0.3, 8, '#efe7d6', [0.7 + i * 0.3, 0.52, d / 2 - 0.7]);
  },
  // Blacksmith: an open forge under a roof, glowing coals, an anvil, bellows and racks of blades
  blacksmith(b, w, d) {
    const m = b.m, L = b.level || 1;
    m.box(w - 0.1, 0.12, d - 0.1, DIRT, [0, 0.06, 0]);
    posts(m, w - 0.4, d - 0.4, 2.5, 0, WOOD_D, 0.12);
    m.box(w - 0.4, 2.3, 0.14, WOOD, [0, 1.25, -d / 2 + 0.25]);                               // back wall
    m.roof(w - 0.4, d - 0.4, 1.2, '#4a4038', 2.5, { over: 0.4, ridge: 0.5, ridgeHex: WOOD_D });
    // the forge: stone hearth with glowing coals and a chimney
    m.box(1.2, 0.8, 0.9, STONE, [-0.9, 0.4, -d / 2 + 0.8]); b.g.box(0.8, 0.12, 0.55, '#ff7a2a', [-0.9, 0.84, -d / 2 + 0.8]);
    m.box(0.55, 2.6, 0.55, STONE_D, [-0.9, 2.2, -d / 2 + 0.6]);
    m.box(0.7, 0.35, 0.5, '#6b4a2e', [-0.1, 0.55, -d / 2 + 0.9]);                              // bellows
    // anvil on a stump, quench tub, blades
    m.cyl(0.25, 0.3, 0.5, 8, '#6b4a33', [0.8, 0.25, 0.4]); m.box(0.55, 0.2, 0.22, '#3a3d42', [0.8, 0.6, 0.4]); m.box(0.18, 0.12, 0.12, '#3a3d42', [1.12, 0.62, 0.4]);
    m.cyl(0.3, 0.28, 0.4, 10, WOOD, [0.9, 0.2, -0.6]); m.cyl(0.26, 0.26, 0.02, 10, '#2e4a58', [0.9, 0.4, -0.6]);
    m.box(1.2, 0.06, 0.12, WOOD_D, [0.5, 1.6, -d / 2 + 0.38]);
    for (let i = 0; i < 2 + L; i++) m.box(0.04, 0.9, 0.03, '#d9dde2', [0.05 + i * 0.22, 1.2, -d / 2 + 0.42], [0, 0, 0.05]);
    if (L >= 2) { m.cyl(0.3, 0.3, 0.06, 12, '#2b2e33', [-w / 2 + 0.3, 1.3, 0.3], [0, 0, Math.PI / 2]); }
  },
  // Market: striped awnings over stalls of goods
  market(b, w, d) {
    const m = b.m, L = b.level || 1;
    m.box(w - 0.1, 0.08, d - 0.1, '#b8a888', [0, 0.04, 0]);
    const stalls = [[-w / 4, -d / 4, '#c2412d'], [w / 4, -d / 4, '#2f4a7a'], [-w / 4, d / 4, '#3f7a3a'], [w / 4, d / 4, '#caa04a']].slice(0, 2 + L);
    const goods = ['#d8b653', '#8a6a44', '#a9a397', '#e06a2a', '#f4f0e6', '#6b7a3a'];
    stalls.forEach(([x, z, col], i) => {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box(0.08, 1.8, 0.08, WOOD_D, [x + sx * 0.9, 0.9, z + sz * 0.55]);
      for (let k = 0; k < 4; k++) m.box(0.46, 0.05, 1.3, k % 2 ? '#f5efe0' : col, [x - 0.69 + k * 0.46, 1.85, z], [0.18, 0, 0]);   // striped awning
      m.box(1.8, 0.5, 1.0, WOOD_L, [x, 0.5, z]);
      for (let k = 0; k < 5; k++) m.box(0.26, 0.2, 0.26, goods[(i + k) % goods.length], [x - 0.7 + k * 0.35, 0.85, z + (k % 2 ? 0.2 : -0.2)]);
    });
    m.cyl(0.05, 0.05, 3.2, 5, WOOD_D, [0, 1.6, 0]); m.box(0.05, 1.3, 0.5, VERM, [0, 2.6, 0.25]); m.box(0.06, 0.4, 0.4, '#f5efe0', [0, 2.7, 0.25]);
    hangingLantern(b, 0, 2.0, 0.05);
  },
  dojo(b, w, d) {
    const m = b.m;
    m.box(w - 0.2, 0.08, d - 0.2, SAND, [0, 0.04, 0]);
    m.box(4.8, 0.6, 3.6, STONE, [0, 0.3, -0.9]);
    m.box(4.4, 2.4, 3.2, WOOD_L, [0, 0.6 + 1.2, -0.9]);
    posts(m, 4.5, 3.3, 2.4, 0.6, WOOD_D, 0.14);
    b.g.box(3.6, 0.8, 0.06, PAPER, [0, 2.3, 0.73]); lattice(m, 0, 2.3, 0.73, 3.6, 0.8);
    for (let i = 0; i < 3; i++) m.box(1.8 - i * 0.2, 0.2, 0.35, STONE_D, [0, 0.1 + i * 0.2, 1.3 - i * 0.3]);
    m.box(1.6, 1.4, 0.06, WOOD_D, [0, 1.3, 0.72]);
    m.roof(4.4, 3.2, 2.0, ROOF, 3.0, { over: 0.8, ridge: 0.6, cz: -0.9 });
    m.box(1.3, 0.5, 0.08, '#f5efe0', [0, 3.3, 1.1]); m.box(1.0, 0.25, 0.1, DARK, [0, 3.3, 1.12]);
    // weapon rack with bokken
    m.box(1.6, 0.08, 0.2, WOOD, [2.0, 1.0, 1.6]); m.box(0.08, 1.0, 0.2, WOOD, [1.3, 0.5, 1.6]); m.box(0.08, 1.0, 0.2, WOOD, [2.7, 0.5, 1.6]);
    for (let i = 0; i < 5; i++) m.box(0.05, 1.1, 0.05, '#c9a36f', [1.45 + i * 0.28, 0.75, 1.68], [0.12, 0, 0]);
    for (const x of [-2.3, -1.6]) { m.cyl(0.04, 0.04, 3, 5, WOOD_D, [x, 1.5, 1.9]); m.box(0.04, 1.8, 0.45, x < -2 ? VERM : '#27354f', [x, 2.0, 2.15]); }
    m.cyl(0.18, 0.2, 1.6, 7, THATCH, [-1.9, 0.8, 0.7]); m.box(0.5, 0.06, 0.06, WOOD, [-1.9, 1.3, 0.7]); // straw practice dummy
    m.cyl(0.45, 0.45, 0.7, 12, '#8a3a2a', [2.0, 1.1, -0.9], [Math.PI / 2, 0, 0]); m.cyl(0.42, 0.42, 0.72, 12, '#efe3c4', [2.0, 1.1, -0.9], [Math.PI / 2, 0, 0]); // taiko drum
    m.box(0.8, 0.08, 0.5, WOOD_D, [2.0, 0.6, -0.9]); for (const x of [1.7, 2.3]) m.box(0.06, 0.6, 0.06, WOOD_D, [x, 0.3, -0.9]);
    for (let i = 0; i < 5; i++) m.box(0.22, 0.16, 0.02, '#c9a36f', [-1.6 + i * 0.26, 1.3, 0.75]); // ema prayer boards
    if ((b.level || 1) >= 3) { for (const x of [-2.3, 2.3]) stoneLantern(b, x, 1.9, 0.6); }
    // back and sides: a paper window band, a back door, a barrel and a rack of drying towels
    for (const x of [-1.3, 1.3]) backWindow(b, x, 2.3, -2.52, 1.4, 0.6, PAPER);
    m.box(0.9, 1.4, 0.06, WOOD_D, [0, 1.3, -2.52]);
    for (const sx of [-1, 1]) { b.g.box(0.06, 0.6, 2.2, PAPER, [sx * 2.22, 2.3, -0.9]); lattice(m, sx * 2.24, 2.3, -0.9, 2.2, 0.6, sx); }
    m.box(4.44, 0.1, 0.06, WOOD_D, [0, 1.5, -2.53]);
    m.cyl(0.28, 0.28, 0.65, 10, WOOD, [1.6, 0.33, -2.8]); m.cyl(0.29, 0.29, 0.05, 10, DARK, [1.6, 0.5, -2.8]);
    for (const x of [-1.9, -0.9]) m.box(0.07, 1.2, 0.07, WOOD, [x, 0.6, -2.8]); m.box(1.1, 0.05, 0.05, WOOD, [-1.4, 1.15, -2.8]);
    for (let i = 0; i < 3; i++) m.box(0.25, 0.5, 0.02, i % 2 ? '#e8e0cc' : '#2f4a7a', [-1.75 + i * 0.35, 0.92, -2.8]);
  },
  kyudojo(b, w, d) {
    const m = b.m, L = b.level || 1;
    m.box(w - 0.2, 0.06, d - 0.2, '#86ad57', [0, 0.03, 0]);
    m.box(w - 1.2, 0.07, d - 3.4, SAND, [0, 0.06, 0.5]);                       // sand range (yamichi)
    // shooting hall (shajo): raised wooden floor, open towards the targets
    m.box(w - 0.4, 0.4, 2.3, WOOD_L, [0, 0.2, -d / 2 + 1.35]);
    for (let i = 0; i < 10; i++) m.box(w - 0.4, 0.02, 0.2, i % 2 ? '#9a6e48' : '#8b5e3c', [0, 0.41, -d / 2 + 0.3 + i * 0.22]); // floorboards
    posts(m, w - 0.4, 2.3, 2.2, 0.4, WOOD_D, 0.12);
    for (let i = 1; i < 4; i++) m.box(0.16, 2.2, 0.16, WOOD_D, [-w / 2 + 0.2 + i * (w - 0.4) / 4, 1.5, -d / 2 + 0.3]);
    m.box(w - 0.4, 2.2, 0.12, WOOD, [0, 1.5, -d / 2 + 0.25]);
    b.g.box(w - 1.2, 0.5, 0.06, PAPER, [0, 2.2, -d / 2 + 0.33]); lattice(m, 0, 2.2, -d / 2 + 0.33, w - 1.2, 0.5);
    m.roof(w - 0.4, 2.3, 1.3, ROOF, 2.6, { over: 0.6, ridge: 0.8, cz: -d / 2 + 1.35 });
    // bow rack and arrow stands in the hall
    m.box(1.6, 0.06, 0.12, WOOD_D, [-w / 2 + 1.3, 1.9, -d / 2 + 0.45]);
    for (let i = 0; i < 4; i++) { m.box(0.03, 1.6, 0.03, '#3a2418', [-w / 2 + 0.7 + i * 0.4, 1.2, -d / 2 + 0.5], [0.08, 0, 0]); }
    for (const x of [w / 2 - 0.8, w / 2 - 1.3]) { m.cyl(0.1, 0.12, 0.7, 6, '#4a3222', [x, 0.75, -d / 2 + 0.7]); for (let k = 0; k < 4; k++) m.box(0.02, 0.35, 0.02, '#e9e4d8', [x - 0.04 + k * 0.03, 1.2, -d / 2 + 0.7]); }
    m.box(0.5, 0.9, 0.04, '#f5efe0', [0, 1.6, -d / 2 + 0.33]); m.box(0.06, 0.6, 0.02, DARK, [0, 1.6, -d / 2 + 0.36]); // calligraphy scroll
    // target mound (azuchi) with its own little roof and three mato targets
    m.frustum(w - 0.6, 1.6, w - 0.8, 0.8, 1.3, '#6c5a3f', [0, 0, d / 2 - 0.9]);
    m.box(w - 0.4, 0.1, 1.5, THATCH, [0, 2.0, d / 2 - 0.9], [-0.25, 0, 0]);
    for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) m.box(0.1, 2.0, 0.1, WOOD_D, [x, 1.0, d / 2 - 0.25]);
    for (let i = 0; i < 3; i++) {
      const x = -1.6 + i * 1.6, z = d / 2 - 1.25;
      m.cyl(0.36, 0.36, 0.08, 16, '#f4f0e6', [x, 0.95, z], [Math.PI / 2, 0, 0]);
      m.cyl(0.27, 0.27, 0.09, 16, DARK, [x, 0.95, z], [Math.PI / 2, 0, 0]);
      m.cyl(0.18, 0.18, 0.1, 16, '#f4f0e6', [x, 0.95, z], [Math.PI / 2, 0, 0]);
      m.cyl(0.09, 0.09, 0.11, 12, DARK, [x, 0.95, z], [Math.PI / 2, 0, 0]);
      m.box(0.03, 0.5, 0.03, WOOD, [x, 0.55, z + 0.05]);
      for (let k = 0; k < 2; k++) m.box(0.02, 0.02, 0.5, '#e9e4d8', [x + 0.1 - k * 0.2, 0.95 + k * 0.12, z - 0.2]); // arrows stuck in the target
    }
    // low fence, banner and a spectator bench
    for (let i = 0; i <= 8; i++) { const t = -d / 2 + 2.7 + i * (d - 3.2) / 8; m.cyl(0.04, 0.04, 0.6, 5, BAMBOO, [-w / 2 + 0.15, 0.3, t]); m.cyl(0.04, 0.04, 0.6, 5, BAMBOO, [w / 2 - 0.15, 0.3, t]); }
    m.box(0.04, 0.04, d - 3.2, BAMBOO, [-w / 2 + 0.15, 0.5, 0.5]); m.box(0.04, 0.04, d - 3.2, BAMBOO, [w / 2 - 0.15, 0.5, 0.5]);
    m.cyl(0.04, 0.04, 3.2, 5, WOOD_D, [w / 2 - 0.4, 1.6, -d / 2 + 2.6]); m.box(0.04, 1.8, 0.5, '#27354f', [w / 2 - 0.4, 2.3, -d / 2 + 2.9]); m.cyl(0.14, 0.14, 0.05, 10, '#f5efe0', [w / 2 - 0.37, 2.6, -d / 2 + 2.9], [0, 0, Math.PI / 2]);
    m.box(1.2, 0.1, 0.35, WOOD_L, [-w / 2 + 1.0, 0.45, 0.6]); for (const x of [-w / 2 + 0.55, -w / 2 + 1.45]) m.box(0.08, 0.4, 0.3, WOOD_D, [x, 0.2, 0.6]);
    // outside of the hall: windows and a beam
    for (const x of [-w / 4, w / 4]) backWindow(b, x, 1.9, -d / 2 + 0.17, w / 2 - 1.0, 0.6, PAPER);
    m.box(w - 0.4, 0.08, 0.06, WOOD_D, [0, 1.2, -d / 2 + 0.17]);
    if (L >= 2) stoneLantern(b, -w / 2 + 0.5, -d / 2 + 2.9, 0.6);
    if (L >= 3) { for (const x of [-w / 2 + 0.6, w / 2 - 0.6]) { m.cyl(0.05, 0.05, 2.6, 5, WOOD_D, [x, 1.3, d / 2 - 2.2]); m.box(0.04, 1.4, 0.45, VERM, [x, 1.9, d / 2 - 1.95]); } }
  },
  strategy(b, w, d) {
    // Strategy Hall: a two-storey study hall with a war table, scroll racks and clan banners
    const m = b.m;
    m.box(w - 0.2, 0.08, d - 0.2, SAND, [0, 0.04, 0]);
    m.box(4.6, 0.6, 3.8, STONE, [0, 0.3, -0.6]); courses(m, 4.6, 3.8, 4.6, 3.8, 0.6, 0, 1);
    m.box(4.2, 2.0, 3.4, PLASTER, [0, 1.6, -0.6]); posts(m, 4.3, 3.5, 2.0, 0.6, WOOD, 0.13);
    m.box(4.35, 0.16, 3.55, WOOD, [0, 1.3, -0.6]);
    for (const x of [-1.3, 0, 1.3]) { b.g.box(0.8, 0.9, 0.06, PAPER, [x, 1.5, 1.12]); lattice(m, x, 1.5, 1.12, 0.8, 0.9); }
    m.roof(4.2, 3.4, 1.0, ROOF, 2.6, { over: 0.7, ridge: 0.6 });
    m.box(2.8, 1.3, 2.2, PLASTER, [0, 3.2 + 0.65, -0.6]); posts(m, 2.9, 2.3, 1.3, 3.2, WOOD, 0.1);
    b.g.box(1.2, 0.5, 0.06, PAPER, [0, 3.9, 0.52]); lattice(m, 0, 3.9, 0.52, 1.2, 0.5);
    m.roof(2.8, 2.2, 1.4, ROOF, 4.5, { over: 0.6, ridge: 0.5, ornaments: GOLD });
    // war table with a map and little markers in the yard
    m.box(1.6, 0.08, 1.0, WOOD_L, [1.4, 0.75, 1.9]); for (const x of [0.75, 2.05]) for (const z of [1.5, 2.3]) m.box(0.08, 0.7, 0.08, WOOD_D, [x, 0.38, z]);
    m.box(1.4, 0.02, 0.85, '#e8dcb8', [1.4, 0.8, 1.9]); for (let i = 0; i < 6; i++) m.box(0.08, 0.1, 0.08, i < 3 ? VERM : '#2f4a7a', [1.0 + (i % 3) * 0.3, 0.86, 1.7 + Math.floor(i / 3) * 0.35]);
    // scroll rack and a war fan (gunbai)
    m.box(1.0, 1.1, 0.3, WOOD_D, [-1.6, 0.55, 1.9]); for (let i = 0; i < 6; i++) m.cyl(0.05, 0.05, 0.3, 6, '#efe3c4', [-1.95 + (i % 3) * 0.33, 0.35 + Math.floor(i / 3) * 0.4, 1.95], [Math.PI / 2, 0, 0]);
    m.cyl(0.3, 0.3, 0.04, 12, '#1c1c1f', [-0.3, 1.3, 1.3], [Math.PI / 2, 0, 0]); m.cyl(0.14, 0.14, 0.05, 12, GOLD, [-0.3, 1.3, 1.32], [Math.PI / 2, 0, 0]); m.box(0.05, 0.6, 0.05, WOOD_D, [-0.3, 0.8, 1.3]);
    for (const x of [-2.3, 2.3]) { m.cyl(0.05, 0.05, 3.4, 5, WOOD_D, [x, 1.7, 1.4]); m.box(0.04, 1.8, 0.55, x < 0 ? VERM : '#27354f', [x, 2.4, 1.7]); }
    // back and sides
    for (const x of [-1.3, 0, 1.3]) backWindow(b, x, 1.5, -2.32, 0.8, 0.9, PAPER);
    for (const sx of [-1, 1]) { b.g.box(0.06, 0.9, 1.6, PAPER, [sx * 2.12, 1.5, -0.6]); lattice(m, sx * 2.14, 1.5, -0.6, 1.6, 0.9, sx); }
    backWindow(b, 0, 3.9, -1.72, 1.2, 0.5, PAPER);
    for (const sx of [-1, 1]) { b.g.box(0.06, 0.5, 1.0, PAPER, [sx * 1.42, 3.9, -0.6]); lattice(m, sx * 1.44, 3.9, -0.6, 1.0, 0.5, sx); }
    for (let i = 0; i < 3; i++) { m.cyl(0.04, 0.04, 2.6, 5, WOOD_D, [-1.2 + i * 1.2, 1.3, -2.9]); m.box(0.04, 1.2, 0.4, [VERM, '#27354f', GOLD][i], [-1.2 + i * 1.2, 1.9, -2.72]); }
  },
  workshop(b, w, d) {
    const m = b.m;
    m.box(w - 0.2, 0.08, d - 0.2, DIRT, [0, 0.04, 0]);
    posts(m, w - 0.8, d - 1.2, 2.8, 0, WOOD, 0.15);
    m.roof(w - 0.8, d - 1.2, 1.4, '#6b4c35', 2.8, { over: 0.5, ridge: 0.7, ridgeHex: WOOD_D });
    // a ram half-built under the roof
    m.cyl(0.35, 0.35, 3.4, 8, '#7a5438', [0, 1.0, -0.3], [0, 0, Math.PI / 2]); m.cone(0.36, 0.5, 8, '#6f7378', [1.95, 1.0, -0.3], [0, 0, -Math.PI / 2]);
    for (const x of [-1.2, 1.2]) for (const z of [-1.1, 0.5]) m.cyl(0.38, 0.38, 0.14, 10, '#4a3222', [x, 0.38, z], [Math.PI / 2, 0, 0]);
    m.box(3.0, 0.14, 1.6, WOOD_L, [0, 0.55, -0.3]);
    for (const x of [-1.2, 0, 1.2]) { m.box(0.1, 1.5, 0.1, WOOD, [x, 1.3, -1.05]); m.box(0.1, 1.5, 0.1, WOOD, [x, 1.3, 0.45]); }
    m.box(2.8, 0.1, 0.1, WOOD, [0, 2.05, -1.05]); m.box(2.8, 0.1, 0.1, WOOD, [0, 2.05, 0.45]);
    for (let i = 0; i < 4; i++) m.box(2.2, 0.16, 0.22, i % 2 ? '#a07a4a' : '#8b6a44', [-0.5, 0.1 + i * 0.16, 2.1]);   // planks
    m.box(0.9, 0.06, 0.25, '#8c6a4a', [1.6, 0.7, 2.0]); for (const x of [1.25, 1.95]) m.box(0.07, 0.7, 0.4, '#8c6a4a', [x, 0.35, 2.0], [0.3, 0, 0]);
    hangingLantern(b, -1.4, 2.2, 1.0);
    // back wall of planks with saws, mallets and rope
    const bz = -(d - 1.2) / 2 + 0.05;
    for (let i = 0; i < 9; i++) m.box((w - 0.9) / 9 - 0.03, 2.2, 0.08, i % 2 ? '#7a5438' : '#6d4a31', [-(w - 0.9) / 2 + (i + 0.5) * (w - 0.9) / 9, 1.1, bz]);
    m.box(w - 0.9, 0.1, 0.1, WOOD_D, [0, 1.7, bz - 0.06]);
    m.box(0.9, 0.18, 0.02, '#aab0b6', [-1.2, 1.4, bz - 0.08]); m.box(0.08, 0.5, 0.06, WOOD_D, [0, 1.4, bz - 0.1]); m.box(0.3, 0.2, 0.2, '#8b5e3c', [0, 1.7, bz - 0.12]);
    m.cyl(0.25, 0.25, 0.1, 12, '#c9b58a', [1.2, 1.35, bz - 0.1], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 3; i++) m.cyl(0.15, 0.15, 2.0, 7, '#7a5438', [0.6, 0.15 + i * 0.28, bz - 0.5], [0, 0, Math.PI / 2]);
  },
  wall(b, w, d, conn) {
    const m = b.m;
    if (conn && (conn.n || conn.s || conn.e || conn.w)) {
      // connected wall: a pillar in the middle and an arm towards each neighbour
      m.frustum(1.35, 1.35, 1.1, 1.1, 1.5, STONE, [0, 0, 0]);
      const walk = (b.level || 1) >= 2; // upgraded walls carry a walkway for patrols
      m.box(1.0, 1.3, 1.0, PLASTER, [0, 2.15, 0]); m.box(1.04, 0.16, 1.04, WOOD_D, [0, 1.56, 0]);
      if (walk) { m.box(1.3, 0.1, 1.3, WOOD_L, [0, 2.85, 0]); } else m.roof(1.0, 1.0, 0.5, ROOF, 2.8, { over: 0.26, ridge: 0.3 });
      for (const [k, ax, az] of [['e', 1, 0], ['w', -1, 0], ['s', 0, 1], ['n', 0, -1]]) {
        if (!conn[k]) continue;
        const along = ax !== 0, x = ax * 0.52, z = az * 0.52;
        m.frustum(along ? 1.0 : 1.35, along ? 1.35 : 1.0, along ? 1.0 : 1.1, along ? 1.1 : 1.0, 1.5, STONE, [x, 0, z]);
        m.box(along ? 1.0 : 0.8, 1.3, along ? 0.8 : 1.0, PLASTER, [x, 2.15, z]);
        m.box(along ? 1.0 : 0.84, 0.16, along ? 0.84 : 1.0, WOOD_D, [x, 1.56, z]);
        m.box(along ? 0.22 : 0.06, 0.18, along ? 0.06 : 0.22, DARK, [x + (along ? 0 : 0.41), 2.3, z + (along ? 0.41 : 0)]);
        m.box(along ? 0.22 : 0.06, 0.18, along ? 0.06 : 0.22, DARK, [x - (along ? 0 : 0.41), 2.3, z - (along ? 0.41 : 0)]);
        if (walk) {
          m.box(along ? 1.0 : 1.3, 0.1, along ? 1.3 : 1.0, WOOD_L, [x, 2.85, z]);
          for (const sd of [-1, 1]) m.box(along ? 1.0 : 0.12, 0.45, along ? 0.12 : 1.0, PLASTER, [x + (along ? 0 : sd * 0.62), 3.12, z + (along ? sd * 0.62 : 0)]);
          m.box(along ? 1.0 : 0.16, 0.08, along ? 0.16 : 1.0, ROOF, [x + (along ? 0 : 0.62), 3.38, z + (along ? 0.62 : 0)]);
        } else m.roof(along ? 1.0 : 0.8, along ? 0.8 : 1.0, 0.5, ROOF, 2.8, { over: 0.26, ridge: 0.9 });
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
    // inner side: a heavy locking bar (kannuki) resting in brackets, and bracing on the posts
    for (const x of [-1.55, 1.55]) { m.box(0.3, 0.16, 0.2, WOOD_D, [x, 1.5, -0.3]); m.box(0.08, 1.6, 0.08, WOOD, [x + (x > 0 ? -0.35 : 0.35), 2.2, -0.25], [0, 0, x > 0 ? -0.5 : 0.5]); }
    m.box(3.3, 0.18, 0.18, '#6b4c35', [0, 1.66, -0.32]);
  },
  tower(b) {
    const m = b.m;
    m.frustum(4, 4, 3.2, 3.2, 2.0, STONE, [0, 0, 0]);
    courses(m, 4, 4, 3.2, 3.2, 2.0, 0, 3);
    posts(m, 3.0, 3.0, 3.4, 2.0, WOOD, 0.13);
    for (const [x, z, rx, rz] of [[0.6, 1.6, 0.22, 0.05], [-0.6, 1.6, 0.22, 0.05], [0.6, -1.6, 0.22, 0.05], [-0.6, -1.6, 0.22, 0.05], [1.6, 0.6, 0.05, 0.22], [1.6, -0.6, 0.05, 0.22], [-1.6, 0.6, 0.05, 0.22], [-1.6, -0.6, 0.05, 0.22]]) m.box(rx, 0.22, rz, DARK, [x, 4.1, z]);
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
    // back: framed panels, a beam and a stand of bamboo
    for (const x of [-0.6, 0.6]) { m.box(0.9, 1.1, 0.04, '#cdbb92', [x, 1.3, -2.02]); m.box(0.98, 0.06, 0.05, VERM, [x, 1.88, -2.03]); m.box(0.98, 0.06, 0.05, VERM, [x, 0.72, -2.03]); }
    m.box(0.08, 1.7, 0.06, VERM, [0, 1.35, -2.03]);
    for (let i = 0; i < 6; i++) { const x = -1.3 + i * 0.5 + (i % 2) * 0.12, z = -d / 2 + 0.35 + (i % 3) * 0.12, hgt = 3.2 + (i % 3) * 0.5; m.cyl(0.05, 0.06, hgt, 5, BAMBOO, [x, hgt / 2, z]); m.ball(0.3, '#6f9a4a', [x, hgt, z], [1, 1.4, 1]); }
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
    // back: a round window and a woven bamboo fence
    b.g.cyl(0.35, 0.35, 0.06, 16, PAPER, [-0.5, 1.3, -1.66], [Math.PI / 2, 0, 0]); m.cyl(0.4, 0.4, 0.04, 16, WOOD_D, [-0.5, 1.3, -1.64], [Math.PI / 2, 0, 0]);
    for (let i = -2; i <= 2; i++) m.box(0.03, 0.66, 0.03, WOOD_D, [-0.5 + i * 0.13, 1.3, -1.7]);
    for (let i = 0; i <= 10; i++) m.cyl(0.04, 0.04, 1.1, 5, BAMBOO, [-1.7 + i * 0.34, 0.85, -1.8]);
    for (const y of [0.6, 1.1]) m.box(3.5, 0.05, 0.05, '#8b7a4c', [0, y, -1.76]);
  },
  sakura(b) {
    const m = b.m;
    m.cyl(0.2, 0.34, 2.4, 7, '#4a3530', [0, 1.2, 0], [0, 0, 0.08]);
    m.cyl(0.1, 0.14, 1.6, 5, '#4a3530', [-0.55, 2.5, 0], [0, 0, 0.8]); m.cyl(0.1, 0.14, 1.5, 5, '#4a3530', [0.5, 2.6, 0.2], [0.2, 0, -0.8]);
    m.ball(1.4, '#f4b8c8', [0, 3.4, 0], [1.3, 0.8, 1.2]); m.ball(1.05, '#f7c9d6', [-1.1, 3.0, 0.3], [1.1, 0.75, 1]); m.ball(0.95, '#eea3b9', [1.0, 3.0, -0.4], [1, 0.8, 1]); m.ball(0.85, '#fbd6e1', [0.2, 4.1, 0.3]);
    m.cyl(1.0, 1.0, 0.02, 12, '#f4c7d3', [0, 0.02, 0]);
  },
  lantern(b) { stoneLantern(b, 0, 0, 1.15); },
  road(b, w, d, conn) { roadTile(b.m, conn, false); },
  stoneroad(b, w, d, conn) { roadTile(b.m, conn, true); },
  torii(b) {
    const m = b.m;
    for (const x of [-1.4, 1.4]) { m.cyl(0.16, 0.19, 3.2, 8, VERM, [x, 1.6, 0]); m.cyl(0.24, 0.24, 0.3, 8, DARK, [x, 0.15, 0]); }
    m.box(3.9, 0.25, 0.34, DARK, [0, 3.4, 0]); m.box(3.6, 0.22, 0.3, VERM, [0, 3.18, 0]); m.box(3.2, 0.18, 0.2, VERM, [0, 2.6, 0]); m.box(0.2, 0.55, 0.12, VERM, [0, 2.9, 0]);
  },
};

// A model for a building type, sized to its footprint (w×d world units).
// Buildings that are modelled at their real (grown) size; the rest are scaled up as they grow.
export const SIZE_AWARE = new Set(['farm', 'garden', 'pond', 'kyudojo', 'quarry', 'mine']);
export function buildModel(type, w, d, seed = 1, conn = null, level = 1) {
  const b = new ModelBuilder(seed + type.length * 17);
  b.level = level;
  MODELS[type](b, w, d, conn);
  // every upgrade leaves a visible mark: a clan banner, then lanterns
  if (level >= 2 && !['wall', 'palisade', 'hedge', 'road', 'stoneroad', 'spikes', 'townhall', 'gate', 'tower'].includes(type)) {
    const x = w / 2 - 0.25, z = d / 2 - 0.25;
    b.m.cyl(0.04, 0.04, 2.6, 5, WOOD_D, [x, 1.3, z]); b.m.box(0.04, 1.3, 0.45, level >= 4 ? GOLD : VERM, [x, 1.9, z - 0.25]); b.m.cyl(0.12, 0.12, 0.05, 10, '#f5efe0', [x + 0.03, 2.2, z - 0.25], [0, 0, Math.PI / 2]);
    if (level >= 3) hangingLantern(b, -w / 2 + 0.3, 1.3, d / 2 - 0.2);
  }
  const group = b.finish(type);
  if ((type === 'wall' || type === 'tower' || type === 'gate') && level > 1) group.scale.y = 1 + 0.14 * (level - 1);
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
