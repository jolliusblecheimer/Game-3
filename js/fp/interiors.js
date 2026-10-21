// Inside your buildings, on foot. Walk in through a building's door and you stand in a room of its own:
// the Keep's hall (your bed, your desk, your armoury), homes with a hearth, the forge, the mine's tunnel,
// the brewery's vats, the scholars' scrolls… Each room has spots you can use with F (USE on touch):
// help the workers (dig ore, hammer at the anvil, split logs, stir the mash), rest, pray, or open the
// building's own panel (workers, upgrades). Rooms are built when you enter and thrown away when you leave.
// They sit far from the village (INSIDE_AT), like the training valley, and answer the same questions
// as the ground outside (FPTerrain / VillageGround), so the player controller works unchanged.
import * as THREE from 'three';
import { Mesher, MAT } from '../render/geo.js';
import { Person } from '../render/people.js';
import { JOBS } from '../game/data.js';

export const INSIDE_AT = new THREE.Vector3(0, 0, 8000);
// what has no inside: open ground, lines, decorations, gates
const NO_INSIDE = new Set(['road', 'stoneroad', 'farm', 'wall', 'palisade', 'hedge', 'spikes', 'gate', 'torii', 'lantern', 'sakura', 'hiroba', 'pond', 'garden']);
export const canEnter = b => !NO_INSIDE.has(b.type);

// colours
const WOOD = '#7a5636', WOOD_D = '#4a3222', WOOD_L = '#a98258', PLASTER = '#e9e1cf', TATAMI = '#c8b878', TATAMI_E = '#3b4a2c',
  STONE = '#8a847a', ROCK = '#5e5850', ROCK_D = '#4b463f', EARTH = '#6b5641', PAPER = '#f2ead6', LACQ = '#2a1a14', GOLD = '#c9a24a', VERM = '#b8432f', INDIGO = '#2d3a5c';

// the floor and walls you walk on and into
class Room {
  constructor(W, D) {
    this.W = W; this.D = D; this.half = Math.max(W, D) / 2 + 1.5;
    this.colliders = []; this.npcs = [];
    this.bridge = { len: 0, half: 0 }; this.spawn = { x: 0, z: D / 2 - 1.1 }; this.yard = { x: 0, z: 0 };
  }
  groundAt(x, z) { const p = this.platform; return p && Math.abs(x - p.x) < p.hw && Math.abs(z - p.z) < p.hd ? p.h : 0; }
  terrainAt() { return 0; }
  waterDepth() { return 0; }
  deckAt() { return null; }
  bridgeLocal() { return { u: 1e9, v: 0 }; }
  update() {}
  rebuild() {}
  people() { return this.npcs.map(n => ({ x: n.x, z: n.z, r: 0.3 })); }
  box(x, z, hw, hd) { this.colliders.push({ x, z, hw, hd, ang: 0 }); }
  post(x, z, r) { this.colliders.push({ x, z, r }); }
}

// ---------- the shell: floor, walls with the door in front (+z), ceiling, beams, light from the doorway ----------
function shell(R, m, g, { W, D, H, floor, wall, beams = true, tatami = false, mine = false }) {
  if (mine) {
    // a tunnel: rough rock all round, a timber frame every few steps, rails on the floor
    m.box(W + 0.6, 0.2, D + 0.4, EARTH, [0, -0.1, 0]);
    for (let z = -D / 2; z <= D / 2; z += 0.9) for (const s of [-1, 1]) {
      m.add(new THREE.DodecahedronGeometry(0.9, 0), (Math.round(z * 3) % 2) ? ROCK : ROCK_D, [s * (W / 2 + 0.35), 0.9 + Math.sin(z * 3) * 0.2, z], [z, z * 2, 0], [0.8, 1.5, 0.9]);
      m.add(new THREE.DodecahedronGeometry(0.8, 0), ROCK_D, [s * W * 0.2, H + 0.3, z + 0.4], [z * 3, 0, z], [1.2, 0.6, 1]);
    }
    // solid rock behind the rough stones, so no daylight gets in
    m.box(W + 4, 0.6, D + 2, ROCK_D, [0, H + 0.9, 0]); for (const sx of [-1, 1]) m.box(0.6, H + 1.6, D + 2, ROCK_D, [sx * (W / 2 + 1.0), (H + 1.6) / 2 - 0.2, 0]);
    m.box(W + 4, H + 1.6, 0.6, ROCK_D, [0, (H + 1.6) / 2 - 0.2, -D / 2 - 0.9]);
    m.box(W + 4, H + 1.6 - 2.3, 0.4, ROCK_D, [0, 2.3 + (H + 1.6 - 2.3) / 2 - 0.2, D / 2 + 0.3]);   // the rock above the entrance
    for (const sx of [-1, 1]) m.box(W / 2 + 0.4, 2.4, 0.4, ROCK_D, [sx * (0.75 + (W / 2 + 0.4) / 2), 1.0, D / 2 + 0.3]);   // and beside it: only the way out stays open
    for (let z = -D / 2 + 1.2; z < D / 2 - 0.5; z += 2.6) {
      for (const s of [-1, 1]) m.box(0.22, H, 0.22, WOOD, [s * (W / 2 - 0.15), H / 2, z]);
      m.box(W, 0.24, 0.26, WOOD, [0, H - 0.1, z]);
    }
    for (const s of [-0.45, 0.45]) m.box(0.06, 0.06, D, '#5a5a5e', [s, 0.03, 0]);
    for (let z = -D / 2 + 0.4; z < D / 2; z += 0.6) m.box(1.2, 0.05, 0.14, WOOD_D, [0, 0.01, z]);
    R.box(-W / 2 - 0.2, 0, 0.25, D / 2 + 1); R.box(W / 2 + 0.2, 0, 0.25, D / 2 + 1); R.box(0, -D / 2 - 0.2, W / 2 + 0.5, 0.25);
  } else {
    m.box(W, 0.12, D, floor, [0, -0.06, 0]);
    if (tatami) {
      // tatami mats with their dark cloth borders
      for (let x = -W / 2 + 0.9; x < W / 2 - 0.4; x += 1.8) for (let z = -D / 2 + 0.45; z < D / 2 - 0.2; z += 0.9) {
        m.box(1.76, 0.03, 0.86, TATAMI, [x, 0.015, z]); m.box(1.78, 0.032, 0.05, TATAMI_E, [x, 0.016, z - 0.43]); m.box(1.78, 0.032, 0.05, TATAMI_E, [x, 0.016, z + 0.43]);
      }
    } else for (let x = -W / 2 + 0.25; x < W / 2; x += 0.5) m.box(0.02, 0.005, D, '#4a3524', [x, 0.002, 0]);   // floorboards
    // walls, the front one with the doorway
    m.box(W + 0.3, H, 0.15, wall, [0, H / 2, -D / 2 - 0.07]);
    for (const s of [-1, 1]) m.box(0.15, H, D + 0.3, wall, [s * (W / 2 + 0.07), H / 2, 0]);
    const gw = (W - 1.4) / 2;
    for (const s of [-1, 1]) m.box(gw + 0.15, H, 0.15, wall, [s * (0.7 + gw / 2 + 0.07), H / 2, D / 2 + 0.07]);
    m.box(1.4, H - 2.1, 0.15, wall, [0, 2.1 + (H - 2.1) / 2, D / 2 + 0.07]);
    // posts, sills and the timber band (nuki) along the walls
    for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) m.box(0.2, H, 0.2, WOOD, [x, H / 2, z]);
    for (const s of [-0.7, 0.7]) m.box(0.16, 2.1, 0.2, WOOD_D, [s, 1.05, D / 2]);
    m.box(1.6, 0.16, 0.22, WOOD_D, [0, 2.12, D / 2]);
    for (const y of [0.08, H * 0.62]) { m.box(W, 0.12, 0.06, WOOD, [0, y, -D / 2 + 0.02]); for (const s of [-1, 1]) m.box(0.06, 0.12, D, WOOD, [s * (W / 2 - 0.02), y, 0]); }
    // ceiling and beams
    m.box(W + 0.3, 0.12, D + 0.3, '#5b4330', [0, H + 0.06, 0]);
    if (beams) for (let x = -W / 2 + 1; x < W / 2; x += 1.6) m.box(0.16, 0.2, D, WOOD_D, [x, H - 0.1, 0]);
    // a noren curtain over the door, the bright day (or the night) beyond it
    for (let i = 0; i < 3; i++) m.box(0.44, 0.6, 0.02, INDIGO, [-0.47 + i * 0.47, 1.78, D / 2 - 0.02]);
    R.box(0, -D / 2 - 0.15, W / 2 + 0.5, 0.2); for (const s of [-1, 1]) R.box(s * (W / 2 + 0.15), 0, 0.2, D / 2 + 1);
    for (const s of [-1, 1]) R.box(s * (0.7 + gw / 2), D / 2 + 0.1, gw / 2 + 0.1, 0.2);
  }
  R.box(0, D / 2 + 0.75, 1.2, 0.2);   // the step outside the door (leaving is by walking out, see fpmode)
}
// a soft lantern (glows at night)
const andon = (m, g, x, z, y = 0) => { m.box(0.34, 0.06, 0.34, LACQ, [x, y + 0.03, z]); for (const a of [-1, 1]) for (const b of [-1, 1]) m.box(0.04, 0.8, 0.04, LACQ, [x + a * 0.15, y + 0.4, z + b * 0.15]); g.box(0.28, 0.5, 0.28, '#fff0c8', [x, y + 0.5, z]); };
const hanging = (m, g, x, z, H) => { m.box(0.02, 0.5, 0.02, '#222', [x, H - 0.25, z]); g.cyl(0.18, 0.18, 0.4, 8, '#ffd48a', [x, H - 0.7, z]); m.box(0.3, 0.05, 0.3, LACQ, [x, H - 0.48, z]); m.box(0.3, 0.05, 0.3, LACQ, [x, H - 0.92, z]); };
const sack = (m, x, z, y = 0, c = '#cdbb8e') => { m.ball(0.3, c, [x, y + 0.28, z], [1, 0.9, 1], 1); m.box(0.16, 0.12, 0.16, c, [x, y + 0.58, z]); };
const barrel = (m, x, z, r = 0.32, h = 0.7, c = '#8b6a45') => { m.cyl(r, r * 0.9, h, 10, c, [x, h / 2, z]); for (const y of [0.15, h - 0.15]) m.cyl(r + 0.01, r + 0.01, 0.05, 10, '#3a3a3a', [x, y, z]); };
const crate = (m, x, z, y = 0, s = 0.6) => { m.box(s, s, s, WOOD_L, [x, y + s / 2, z]); m.box(s + 0.02, 0.06, s + 0.02, WOOD_D, [x, y + s * 0.8, z]); };
const shelf = (m, x, z, w, rot = 0) => { const L = (dx, dz) => [x + dx * Math.cos(rot) + dz * Math.sin(rot), z - dx * Math.sin(rot) + dz * Math.cos(rot)];
  for (const s of [-1, 1]) { const [px, pz] = L(s * w / 2, 0); m.box(0.08, 2, 0.5, WOOD_D, [px, 1, pz], [0, rot, 0]); }
  for (const y of [0.3, 0.9, 1.5]) { m.box(w, 0.05, 0.5, WOOD, [x, y, z], [0, rot, 0]); for (let i = 0; i < 4; i++) { const [px, pz] = L(-w / 2 + 0.25 + i * (w - 0.5) / 3, 0); if ((i + y * 10) % 3 < 2) m.box(0.3, 0.32, 0.3, ['#b49a6a', '#8b6a45', '#c9b58a'][i % 3], [px, y + 0.18, pz], [0, rot, 0]); } } };
const scrollWall = (m, x, z, W) => { for (let i = 0; i < 5; i++) { const px = x - W / 2 + 0.3 + i * (W - 0.6) / 4; m.box(0.36, 0.9, 0.02, PAPER, [px, 1.5, z]); m.box(0.4, 0.05, 0.04, WOOD_D, [px, 1.96, z]); for (let k = 0; k < 3; k++) m.box(0.03, 0.5, 0.005, '#2b2420', [px - 0.08 + k * 0.08, 1.5, z + 0.012]); } };
const hearth = (m, g, x, z) => { m.box(1.1, 0.1, 1.1, WOOD_D, [x, 0.05, z]); m.box(0.9, 0.06, 0.9, '#8a8278', [x, 0.08, z]); g.ball(0.18, '#ff8a3a', [x, 0.16, z], [1.4, 0.5, 1.4]); m.box(0.03, 2.2, 0.03, '#2a2a2a', [x, 1.5, z]); m.cyl(0.2, 0.16, 0.26, 10, '#2a2a2a', [x, 0.55, z]); };
const futon = (m, x, z, rot = 0, quilt = INDIGO) => { m.box(1.0, 0.12, 2.0, '#efe8da', [x, 0.06, z], [0, rot, 0]); m.box(0.98, 0.1, 1.4, quilt, [x + Math.sin(rot) * 0.28, 0.16, z + Math.cos(rot) * 0.28], [0, rot, 0]); m.box(0.4, 0.12, 0.22, '#d9c9a8', [x - Math.sin(rot) * 0.72, 0.18, z - Math.cos(rot) * 0.72], [0, rot, 0]); };
const counter = (m, x, z, w) => { m.box(w, 0.9, 0.5, WOOD, [x, 0.45, z]); m.box(w + 0.1, 0.06, 0.6, WOOD_D, [x, 0.92, z]); };
const ledger = (m, g, x, z) => { m.box(0.9, 0.3, 0.55, LACQ, [x, 0.15, z]); m.box(0.4, 0.03, 0.3, PAPER, [x - 0.1, 0.32, z]); m.box(0.12, 0.04, 0.08, '#111', [x + 0.25, 0.32, z]); m.box(0.4, 0.06, 0.4, '#7a2f2a', [x, 0.03, z + 0.55]); };

// ---------- every kind of building: its room, its spots, and where its workers stand ----------
// spot: { x, z, r, label, use: fp => …, work?: { res, amount, swings, sound, fx, cost? } }
const ROOMS = {
  townhall(R, m, g, b) {
    const W = 10, D = 9, H = 3.8;
    shell(R, m, g, { W, D, H, floor: TATAMI, wall: PLASTER, tatami: true });
    // the raised dais at the back (jōdan-no-ma), gold screens behind, the lord's desk on it
    m.box(W - 0.4, 0.28, 2.6, WOOD_L, [0, 0.14, -D / 2 + 1.5]); m.box(W - 0.4, 0.06, 0.12, LACQ, [0, 0.29, -D / 2 + 2.8]);
    R.platform = { x: 0, z: -D / 2 + 1.5, hw: W / 2, hd: 1.3, h: 0.28 };
    // gold-leaf screens with one great pine painted across them (Kanō style): a twisting trunk, flat layers of needles, gold clouds
    for (let i = 0; i < 6; i++) { const x = -W / 2 + 0.85 + i * (W - 1.7) / 5; m.box(1.5, 2.4, 0.04, i % 2 ? GOLD : '#d2ad55', [x, 1.6, -D / 2 + 0.06]); m.box(1.5, 0.05, 0.05, LACQ, [x, 2.8, -D / 2 + 0.07]); }
    const pz = -D / 2 + 0.1;
    for (const [x0, y0, x1, y1, t] of [[-2.6, 0.5, -1.9, 1.5, 0.16], [-1.9, 1.5, -0.6, 2.0, 0.12], [-0.6, 2.0, 1.4, 1.8, 0.09], [-1.9, 1.5, -2.6, 2.2, 0.08], [0.5, 1.95, 2.6, 2.3, 0.06]]) {
      const L = Math.hypot(x1 - x0, y1 - y0); m.box(L, t, 0.02, '#4a3426', [(x0 + x1) / 2, (y0 + y1) / 2, pz], [0, 0, Math.atan2(y1 - y0, x1 - x0)]);
    }
    for (const [x, y, w] of [[-2.7, 2.25, 0.9], [-1.8, 1.75, 1.1], [-0.9, 2.15, 1.2], [0.4, 2.1, 1.4], [1.6, 1.9, 1.0], [2.5, 2.4, 0.9], [-0.2, 1.75, 0.8]]) {
      m.box(w, 0.16, 0.02, '#2f5a32', [x, y, pz + 0.005]); m.box(w * 0.75, 0.1, 0.02, '#3f7040', [x + 0.05, y + 0.1, pz + 0.008]);
    }
    for (const [x, y, w] of [[-3.5, 0.9, 1.4], [1.2, 0.8, 2.2], [3.3, 1.4, 1.2], [-0.5, 2.55, 1.6]]) m.box(w, 0.22, 0.015, '#e8cf7a', [x, y, pz - 0.01]);
    // the desk: lacquer, a map of the valley, ink and brush, a cushion and an armrest
    m.box(1.6, 0.34, 0.8, LACQ, [0, 0.28 + 0.17, -D / 2 + 1.6]); m.box(1.3, 0.02, 0.6, PAPER, [0, 0.64, -D / 2 + 1.6]);
    for (const [x, z, c] of [[-0.3, -0.1, '#5c7a46'], [0.2, 0.08, '#4a6a8a'], [0.35, -0.15, '#8a6a46']]) m.box(0.3, 0.005, 0.2, c, [x, 0.655, -D / 2 + 1.6 + z]);
    m.box(0.16, 0.04, 0.1, '#111', [0.55, 0.66, -D / 2 + 1.85]); m.cyl(0.01, 0.01, 0.25, 4, WOOD_D, [0.45, 0.67, -D / 2 + 1.85], [0, 0, Math.PI / 2]);
    m.box(0.7, 0.1, 0.7, '#7a2f2a', [0, 0.33, -D / 2 + 2.35]); m.box(0.5, 0.3, 0.12, LACQ, [-0.6, 0.45, -D / 2 + 2.3]);
    R.box(0, -D / 2 + 1.6, 0.85, 0.45);
    // the bed: a futon behind a folding gold screen, on the left
    futon(m, -W / 2 + 1.1, -0.2, 0, '#5a2a2a');
    for (let i = 0; i < 6; i++) m.box(0.5, 1.4, 0.03, i % 2 ? GOLD : '#d8b860', [-W / 2 + 2.1, 0.72, -1.4 + i * 0.47], [0, i % 2 ? 0.35 : -0.35, 0]);
    R.box(-W / 2 + 1.1, -0.2, 0.55, 1.05); R.box(-W / 2 + 2.1, -0.2, 0.15, 1.4);
    // the armoury on the right: armour on its box, swords on a stand, a spear rack, a bow and a shield
    const ax = W / 2 - 0.8;
    m.box(0.7, 0.5, 0.5, LACQ, [ax, 0.25, -1.6]); m.box(0.6, 0.7, 0.4, '#2a2a30', [ax, 0.9, -1.6]); for (let i = 0; i < 4; i++) m.box(0.62, 0.06, 0.42, VERM, [ax, 0.62 + i * 0.16, -1.6]);
    m.box(0.3, 0.3, 0.3, '#2a2a30', [ax, 1.45, -1.6]); m.cone(0.3, 0.2, 8, '#1f1f24', [ax, 1.6, -1.6]); m.box(0.5, 0.04, 0.05, GOLD, [ax, 1.75, -1.48], [0, 0, 0]); m.box(0.08, 0.3, 0.02, GOLD, [ax - 0.15, 1.85, -1.45], [0, 0, 0.5]); m.box(0.08, 0.3, 0.02, GOLD, [ax + 0.15, 1.85, -1.45], [0, 0, -0.5]);
    m.box(0.7, 0.4, 0.25, LACQ, [ax, 0.2, -0.4]); for (const y of [0.55, 0.75]) { m.box(0.04, 0.04, 0.9, '#d9dde2', [ax, y, -0.4], [0, 0, 0]); m.box(0.06, 0.06, 0.25, '#2a1a14', [ax, y, -0.75]); }
    for (let i = 0; i < 3; i++) { m.cyl(0.025, 0.025, 2.8, 5, WOOD_D, [ax + 0.2, 1.4, 0.5 + i * 0.35]); m.cone(0.05, 0.3, 4, '#c9ced4', [ax + 0.2, 2.95, 0.5 + i * 0.35]); }
    m.box(0.12, 0.08, 1.3, WOOD, [ax + 0.2, 1.9, 0.85]);
    m.cyl(0.02, 0.02, 2.2, 5, '#3a2a1e', [ax + 0.3, 1.2, 1.8], [0.08, 0, 0]); m.box(0.5, 0.7, 0.06, '#5a3a2a', [ax - 0.1, 0.5, 2.3], [0, 0.3, 0.05]);
    R.box(ax, 0.3, 0.45, 2.3);
    // a tokonoma alcove with a scroll and flowers, braziers and lanterns
    m.box(1.2, 0.15, 0.6, WOOD_L, [-W / 2 + 1.1, 0.36, -D / 2 + 0.5]); m.box(0.5, 1.2, 0.02, PAPER, [-W / 2 + 1.1, 1.6, -D / 2 + 0.25]); m.box(0.03, 0.8, 0.005, '#222', [-W / 2 + 1.1, 1.6, -D / 2 + 0.27]);
    m.cyl(0.1, 0.08, 0.2, 8, '#5a6a7a', [-W / 2 + 1.3, 0.54, -D / 2 + 0.55]); for (let i = 0; i < 3; i++) m.ball(0.06, ['#e86a8a', '#f4e4ea', VERM][i], [-W / 2 + 1.25 + i * 0.05, 0.8 + i * 0.07, -D / 2 + 0.55]);
    andon(m, g, -W / 2 + 0.5, D / 2 - 0.8); andon(m, g, W / 2 - 0.5, D / 2 - 0.8); andon(m, g, -1.6, -D / 2 + 1.0, 0.28); andon(m, g, 1.6, -D / 2 + 1.0, 0.28);
    m.cyl(0.3, 0.25, 0.3, 10, '#4a3a2a', [0, 0.15, 1.5]); g.ball(0.16, '#ff8a3a', [0, 0.3, 1.5], [1.3, 0.5, 1.3]); R.post(0, 1.5, 0.35);
    return { W, D, H, spots: [
      { x: 0, z: -D / 2 + 2.6, r: 1.5, label: 'Sit at your desk — the village from above: build, give out jobs, research, the country map', use: fp => fp.toDesk() },
      { x: -W / 2 + 1.6, z: -0.2, r: 1.4, label: 'Your bed — sleep until morning (rest if it is day)', use: fp => fp.sleep() },
      { x: ax - 0.9, z: 0.2, r: 1.6, label: 'Your armoury — choose the weapon you carry', use: fp => fp.armoury() },
    ], npc: [] };
  },
  house(R, m, g, b, size) {
    const { W, D, H } = size; shell(R, m, g, { W, D, H, floor: TATAMI, wall: PLASTER, tatami: true });
    hearth(m, g, 0, -0.3); R.box(0, -0.3, 0.55, 0.55);
    futon(m, -W / 2 + 0.7, -D / 2 + 1.2, 0); if (W > 5) futon(m, W / 2 - 0.7, -D / 2 + 1.2, 0, '#6a3a2a');
    m.box(0.9, 1.1, 0.45, WOOD, [W / 2 - 0.6, 0.55, D / 2 - 0.9]); for (let i = 0; i < 3; i++) m.box(0.8, 0.02, 0.02, '#c9a24a', [W / 2 - 0.6, 0.25 + i * 0.35, D / 2 - 0.66]);
    R.box(-W / 2 + 0.7, -D / 2 + 1.2, 0.5, 1); R.box(W / 2 - 0.6, D / 2 - 0.9, 0.45, 0.25);
    hanging(m, g, 0, -0.3, H);
    return { spots: [{ x: 0, z: 0.6, r: 1.3, label: 'Warm yourself at the hearth (heals a little)', use: fp => fp.rest(25, 'You warm your hands at the hearth.') }],
      npc: [{ x: -0.8, z: -0.6, pose: 'sit' }, { x: 0.8, z: -0.6, pose: 'sit' }, { x: 0.6, z: 0.4, pose: 'idle' }, { x: -0.6, z: 0.5, pose: 'sit' }] };
  },
  storehouse(R, m, g, b, size) {
    const { W, D, H } = size; shell(R, m, g, { W, D, H, floor: WOOD_L, wall: PLASTER });
    shelf(m, -W / 2 + 0.35, 0, D - 1.6, Math.PI / 2); shelf(m, W / 2 - 0.35, 0, D - 1.6, Math.PI / 2); R.box(-W / 2 + 0.35, 0, 0.3, D / 2 - 0.7); R.box(W / 2 - 0.35, 0, 0.3, D / 2 - 0.7);
    for (let i = 0; i < 4; i++) sack(m, -0.6 + (i % 2) * 1.2, -D / 2 + 0.7 + Math.floor(i / 2) * 0.7, 0, i % 2 ? '#d8c690' : '#b8a070'); barrel(m, 0, -D / 2 + 0.5);
    R.box(0, -D / 2 + 1, 1.0, 0.7);
    ledger(m, g, 0, 0.3);
    return { spots: [{ x: 0, z: 1, r: 1.3, label: 'The stock ledger — what your stores hold', use: fp => fp.stock() }], npc: [] };
  },
  blacksmith(R, m, g, b, size) {
    const { W, D, H } = size; shell(R, m, g, { W, D, H, floor: EARTH, wall: '#9a8a76' });
    // the forge, the bellows, the anvil, the quench tub and the tools
    m.box(1.4, 0.9, 1.0, STONE, [-W / 2 + 0.9, 0.45, -D / 2 + 0.8]); g.box(0.8, 0.12, 0.5, '#ff7a2a', [-W / 2 + 0.9, 0.95, -D / 2 + 0.75]); m.frustum(1.2, 0.9, 0.4, 0.3, 1.6, STONE, [-W / 2 + 0.9, 0.9, -D / 2 + 0.7]);
    m.box(0.5, 0.5, 0.9, WOOD_D, [-W / 2 + 0.2, 0.6, -D / 2 + 1.7]);
    m.box(0.3, 0.5, 0.3, WOOD_D, [0.3, 0.25, -0.2]); m.box(0.5, 0.2, 0.28, '#3a3a3e', [0.3, 0.6, -0.2]); m.cone(0.12, 0.25, 4, '#3a3a3e', [0.6, 0.62, -0.2], [0, 0, -Math.PI / 2]);
    barrel(m, W / 2 - 0.6, -D / 2 + 0.6, 0.38, 0.6, '#5a4632'); m.cyl(0.34, 0.34, 0.02, 10, '#2e4a58', [W / 2 - 0.6, 0.58, -D / 2 + 0.6]);
    for (let i = 0; i < 4; i++) m.box(0.04, 0.6, 0.04, '#55555a', [W / 2 - 0.15, 1.4, -0.6 + i * 0.25], [0, 0, 0.1]);
    R.box(-W / 2 + 0.9, -D / 2 + 0.8, 0.75, 0.55); R.box(0.3, -0.2, 0.3, 0.2); R.post(W / 2 - 0.6, -D / 2 + 0.6, 0.4);
    ledger(m, g, -W / 2 + 0.7, D / 2 - 0.9);
    return { spots: [{ x: 0.3, z: 0.6, r: 1.3, label: 'Hammer at the anvil — help the smiths keep the forge hot (uses iron)', work: { kind: 'forge', swings: 4, sound: 'clash', fx: 'sparks' } }],
      npc: [{ x: -W / 2 + 1.2, z: -D / 2 + 1.6, pose: 'work' }, { x: 0.3, z: -0.75, pose: 'hammer', face: [0, 1] }] };
  },
  mine(R, m, g, b, size) {
    const W = 3.4, D = 15, H = 2.7; shell(R, m, g, { W, D, H, mine: true });
    const gold = b.type === 'mine', ore = gold ? '#e8c04a' : '#9a5a44', glint = gold ? '#fff0a0' : '#c27a5a';
    const veins = [[-1, -4], [1, -1.5], [-1, 1.5], [0, -D / 2 + 0.4]];
    for (const [s, z] of veins) { const x = s ? s * (W / 2 - 0.15) : 0; for (let k = 0; k < 7; k++) m.add(new THREE.OctahedronGeometry(0.12 + (k % 3) * 0.05, 0), k % 2 ? ore : glint, [x + (s ? -s * 0.05 : (k - 3) * 0.14), 0.7 + (k % 4) * 0.25, z + (s ? (k - 3) * 0.14 : 0.05)], [k, k * 2, 0]); }
    m.box(0.9, 0.5, 1.3, WOOD, [0, 0.45, 3.5]); for (const s of [-1, 1]) for (const z of [-0.45, 0.45]) m.cyl(0.14, 0.14, 0.08, 8, '#3a3a3a', [s * 0.46, 0.15, 3.5 + z], [0, 0, Math.PI / 2]);
    for (let i = 0; i < 5; i++) m.add(new THREE.DodecahedronGeometry(0.16, 0), ore, [-0.25 + (i % 3) * 0.25, 0.75 + Math.floor(i / 3) * 0.12, 3.4 + (i % 2) * 0.3]);
    R.box(0, 3.5, 0.5, 0.7);
    for (const z of [-5, 0, 5]) hanging(m, g, 0, z + 0.6, H + 0.1);
    ledger(m, g, W / 2 - 0.55, D / 2 - 1.2);
    const res = gold ? 'gold' : 'iron', job = gold ? 'miner' : 'ironminer', J = JOBS[job];
    return { W, D, H, spots: veins.map(([s, z]) => ({ x: s * (W / 2 - 0.9), z: s ? z : z + 0.9, r: 1.0, label: `Dig ${gold ? 'gold' : 'iron'} ore from the seam`, work: { kind: 'ore', res, amount: J.amount, swings: 5, sound: 'thunk', fx: 'sparks' } })),
      npc: [{ x: -0.6, z: -3.2, pose: 'pickaxe', face: [-1, 0] }, { x: 0.5, z: 0.8, pose: 'pickaxe', face: [1, 0] }, { x: 0.2, z: -6.2, pose: 'pickaxe', face: [0, -1] }] };
  },
  quarry(R, m, g, b, size) {
    const W = 6, D = 7, H = 4; shell(R, m, g, { W, D, H, mine: true });
    for (let i = 0; i < 6; i++) m.box(0.8, 0.5, 0.6, '#b0a898', [-1.8 + (i % 3) * 1.8, 0.25 + Math.floor(i / 3) * 0.5, 2.2], [0, i * 0.2, 0]);
    R.box(0, 2.2, 2.4, 0.4);
    hanging(m, g, 0, 0, H);
    ledger(m, g, W / 2 - 0.6, D / 2 - 0.9);
    const J = JOBS.stonecutter;
    return { W, D, H, spots: [[-1.5, -D / 2 + 1.1], [1.5, -D / 2 + 1.1]].map(([x, z]) => ({ x, z, r: 1.1, label: 'Break stone from the face', work: { kind: 'ore', res: 'stone', amount: J.amount, swings: 4, sound: 'thunk', fx: 'chaff' } })),
      npc: [{ x: 0, z: -D / 2 + 1.0, pose: 'pickaxe', face: [0, -1] }, { x: -1.8, z: 1.4, pose: 'work' }] };
  },
  lumber(R, m, g, b, size) {
    const { W, D, H } = size; shell(R, m, g, { W, D, H, floor: EARTH, wall: WOOD_L });
    for (let i = 0; i < 9; i++) m.cyl(0.18, 0.18, 2.4, 8, i % 2 ? '#8a6440' : '#7a5636', [-W / 2 + 0.5 + (i % 3) * 0.38, 0.2 + Math.floor(i / 3) * 0.32, 0], [Math.PI / 2, 0, 0]);
    R.box(-W / 2 + 0.85, 0, 0.6, 1.3);
    m.cyl(0.35, 0.38, 0.5, 10, '#8a6a48', [0.6, 0.25, -0.6]); m.box(0.05, 0.5, 0.05, '#6b4a2e', [0.55, 0.65, -0.6], [0, 0, 0.4]); m.box(0.05, 0.18, 0.22, '#9aa0a6', [0.45, 0.9, -0.6]);
    for (let i = 0; i < 6; i++) m.box(0.14, 0.14, 0.5, '#b08a5a', [W / 2 - 0.5 - (i % 2) * 0.16, 0.07 + Math.floor(i / 2) * 0.14, -D / 2 + 0.6]);
    R.post(0.6, -0.6, 0.4);
    ledger(m, g, W / 2 - 0.6, D / 2 - 0.9);
    return { spots: [{ x: 0.6, z: 0.4, r: 1.2, label: 'Split logs on the block', work: { kind: 'ore', res: 'wood', amount: JOBS.woodcutter.amount, swings: 3, sound: 'thud', fx: 'chaff' } }], npc: [{ x: -0.4, z: -1.0, pose: 'chop', face: [1, 0] }] };
  },
  sakebrewery(R, m, g, b, size) {
    const { W, D, H } = size; shell(R, m, g, { W, D, H, floor: WOOD, wall: PLASTER });
    for (const x of [-W / 2 + 0.9, 0, W / 2 - 0.9]) { m.cyl(0.65, 0.6, 1.4, 12, '#9a7a52', [x, 0.7, -D / 2 + 0.9]); for (const y of [0.2, 0.7, 1.2]) m.cyl(0.67, 0.67, 0.05, 12, '#4a3a2a', [x, y, -D / 2 + 0.9]); m.cyl(0.6, 0.6, 0.02, 12, '#efe4c8', [x, 1.38, -D / 2 + 0.9]); R.post(x, -D / 2 + 0.9, 0.7); }
    for (let i = 0; i < 4; i++) barrel(m, W / 2 - 0.4, 0.4 + i * 0.6, 0.25, 0.5, '#c9a46a');
    m.box(0.03, 1.4, 0.03, WOOD_D, [0, 1.4, -D / 2 + 0.9], [0.4, 0, 0]);
    hanging(m, g, 0, 0.6, H); ledger(m, g, -W / 2 + 0.7, D / 2 - 0.9);
    return { spots: [{ x: 0, z: -D / 2 + 2.0, r: 1.3, label: 'Stir the rice mash (turns 6 wheat into 3 sake)', work: { kind: 'brew', swings: 3, sound: 'splash', fx: 'chaff' } }], npc: [{ x: -W / 2 + 0.9, z: -D / 2 + 1.75, pose: 'work', face: [0, -1] }] };
  },
  market(R, m, g, b, size) {
    const { W, D, H } = size; shell(R, m, g, { W, D, H, floor: WOOD_L, wall: PLASTER });
    counter(m, 0, -0.6, W - 2); R.box(0, -0.6, (W - 2) / 2, 0.3);
    for (let i = 0; i < 5; i++) m.box(0.3, 0.2, 0.3, ['#c94a3a', '#e8c04a', '#6a9a4a', '#4a6a9a', '#d8c690'][i], [-(W - 2) / 2 + 0.4 + i * (W - 2.8) / 4, 1.05, -0.6]);
    shelf(m, 0, -D / 2 + 0.35, W - 1.2); for (let i = 0; i < 3; i++) sack(m, W / 2 - 0.6, 0.8 + i * 0.6);
    hanging(m, g, -1, 0.6, H); hanging(m, g, 1, 0.6, H);
    return { spots: [{ x: 0, z: 0.5, r: 1.4, label: 'Trade at the counter', panel: true }], npc: [{ x: 0, z: -1.3, pose: 'idle', face: [0, 1] }] };
  },
  dojo(R, m, g, b, size) {
    const { W, D, H } = size; shell(R, m, g, { W, D, H, floor: '#c9a46a', wall: PLASTER });
    for (let x = -W / 2 + 0.3; x < W / 2; x += 0.35) m.box(0.01, 0.005, D, '#a5824e', [x, 0.003, 0]);
    m.box(1.2, 0.3, 0.3, WOOD, [0, 2.4, -D / 2 + 0.2]); m.box(0.8, 0.12, 0.2, '#e9e1cf', [0, 2.6, -D / 2 + 0.2]);   // the kamidana shelf
    m.box(1.8, 0.9, 0.03, PAPER, [0, 1.6, -D / 2 + 0.08]); for (let k = 0; k < 2; k++) m.box(0.12, 0.5, 0.005, '#111', [-0.3 + k * 0.6, 1.6, -D / 2 + 0.1]);
    for (let i = 0; i < 6; i++) m.box(0.06, 1.1, 0.06, '#c9a36f', [-W / 2 + 0.2, 0.8, -1 + i * 0.25], [0.2, 0, 0]);
    for (const x of [-1.4, 1.4]) { m.cyl(0.06, 0.06, 1.4, 6, WOOD_D, [x, 0.7, -1]); m.cyl(0.24, 0.24, 0.9, 8, '#c9b075', [x, 1.0, -1]); m.ball(0.17, '#c9b075', [x, 1.65, -1]); R.post(x, -1, 0.3); }
    return { spots: [{ x: 0, z: 0.3, r: 1.5, label: 'The dojo — trainees and what they learn', panel: true }],
      npc: [{ x: -1.4, z: -0.3, pose: 'chop', face: [0, -1] }, { x: 1.4, z: -0.3, pose: 'chop', face: [0, -1] }, { x: 0, z: -D / 2 + 1.1, pose: 'guard', face: [0, 1] }] };
  },
  shrine(R, m, g, b, size) {
    const { W, D, H } = size; shell(R, m, g, { W, D, H, floor: WOOD_L, wall: PLASTER });
    m.box(2.2, 0.6, 1, WOOD_L, [0, 0.3, -D / 2 + 0.7]); m.box(0.9, 1.0, 0.6, WOOD, [0, 1.1, -D / 2 + 0.6]); m.frustum(1.1, 0.8, 0.7, 0.5, 0.3, '#2a2e36', [0, 1.6, -D / 2 + 0.6]);
    m.ball(0.14, '#d8d8d0', [0, 1.1, -D / 2 + 0.92]); for (const x of [-0.8, 0.8]) { m.box(0.08, 0.8, 0.08, VERM, [x, 1.0, -D / 2 + 0.7]); m.box(0.4, 0.2, 0.4, '#f4efe4', [x, 0.7, -D / 2 + 1.0]); }
    m.box(1.4, 0.04, 0.04, '#e9dcc0', [0, 2.3, -D / 2 + 1.3]); for (let i = 0; i < 4; i++) m.box(0.12, 0.3, 0.01, '#f4efe4', [-0.5 + i * 0.33, 2.1, -D / 2 + 1.3], [0, 0, 0.3]);
    m.cyl(0.02, 0.02, 2, 5, '#d8c690', [0, 1.3, -D / 2 + 1.6]); m.ball(0.15, GOLD, [0, 2.35, -D / 2 + 1.6]);
    R.box(0, -D / 2 + 0.7, 1.2, 0.6); andon(m, g, -W / 2 + 0.5, -D / 2 + 0.6); andon(m, g, W / 2 - 0.5, -D / 2 + 0.6);
    return { spots: [{ x: 0, z: -D / 2 + 2.2, r: 1.4, label: 'Ring the bell and pray', use: fp => fp.pray() }], npc: [{ x: -1, z: 0.2, pose: 'sit', face: [0, -1] }] };
  },
  teahouse(R, m, g, b, size) {
    const { W, D, H } = size; shell(R, m, g, { W, D, H, floor: TATAMI, wall: PLASTER, tatami: true });
    m.box(0.5, 0.2, 0.5, '#3a3a3a', [0, 0.1, -0.2]); g.ball(0.1, '#ff8a3a', [0, 0.22, -0.2]); m.cyl(0.16, 0.14, 0.22, 10, '#2a2a2a', [0, 0.32, -0.2]);
    for (const [x, z] of [[-0.5, 0.2], [0.5, 0.2]]) m.cyl(0.05, 0.04, 0.07, 8, '#e8e0d0', [x, 0.04, z]);
    m.box(0.8, 1.0, 0.02, PAPER, [0, 1.5, -D / 2 + 0.08]); m.cyl(0.06, 0.05, 0.25, 6, '#5a6a7a', [0.8, 0.15, -D / 2 + 0.4]);
    R.box(0, -0.2, 0.3, 0.3);
    return { spots: [{ x: 0, z: 0.8, r: 1.3, label: 'Drink tea (heals you)', use: fp => fp.rest(999, 'The tea is bitter and warm. You feel rested.', 'tea') }], npc: [{ x: 0, z: -0.8, pose: 'sit', face: [0, 1] }] };
  },
  infirmary(R, m, g, b, size) {
    const { W, D, H } = size; shell(R, m, g, { W, D, H, floor: TATAMI, wall: PLASTER, tatami: true });
    futon(m, -W / 2 + 0.7, 0, 0, '#e8e0d0'); futon(m, W / 2 - 0.7, 0, 0, '#e8e0d0'); R.box(-W / 2 + 0.7, 0, 0.5, 1); R.box(W / 2 - 0.7, 0, 0.5, 1);
    for (let i = 0; i < 5; i++) m.box(0.12, 0.4, 0.12, ['#6a8a4a', '#8a7a4a', '#5a7a5a'][i % 3], [-0.6 + i * 0.3, 1.7, -D / 2 + 0.2]);
    m.box(1.6, 0.04, 0.3, WOOD, [0, 1.5, -D / 2 + 0.2]); m.box(0.8, 0.3, 0.4, WOOD, [0, 0.15, -D / 2 + 0.6]);
    return { spots: [{ x: 0, z: -D / 2 + 1.5, r: 1.3, label: 'See the healer (heals you fully)', use: fp => fp.rest(999, 'The healer cleans and binds your wounds.') }], npc: [{ x: 0, z: -D / 2 + 0.95, pose: 'work', face: [0, 1] }] };
  },
  shoin(R, m, g, b, size) {
    const { W, D, H } = size; shell(R, m, g, { W, D, H, floor: TATAMI, wall: PLASTER, tatami: true });
    shelf(m, -W / 2 + 0.35, 0, D - 1.8, Math.PI / 2); scrollWall(m, 0, -D / 2 + 0.09, W - 1);
    m.box(1.2, 0.3, 0.6, LACQ, [0.5, 0.15, -0.4]); m.box(0.6, 0.02, 0.4, PAPER, [0.5, 0.31, -0.4]); R.box(0.5, -0.4, 0.6, 0.3); R.box(-W / 2 + 0.35, 0, 0.3, D / 2 - 0.8);
    hanging(m, g, 0.5, -0.4, H);
    return { spots: [{ x: 0.5, z: 0.5, r: 1.4, label: 'Read with the scholars — research', use: fp => fp.openModal(() => fp.hud0.openResearch()) }], npc: [{ x: 0.5, z: -1.0, pose: 'sit', face: [0, 1] }, { x: -1, z: 0.6, pose: 'sit' }] };
  },
  strategy(R, m, g, b, size) {
    const { W, D, H } = size; shell(R, m, g, { W, D, H, floor: WOOD_L, wall: PLASTER });
    m.box(2.4, 0.75, 1.6, WOOD, [0, 0.375, -0.3]); m.box(2.3, 0.02, 1.5, '#a99a6a', [0, 0.76, -0.3]);
    for (let i = 0; i < 9; i++) m.box(0.08, 0.12, 0.08, i % 3 ? VERM : '#2a2a30', [-0.9 + (i % 5) * 0.45, 0.83, -0.8 + Math.floor(i / 5) * 0.8]);
    for (let i = 0; i < 3; i++) m.box(0.9, 1.2, 0.03, PAPER, [-W / 2 + 1 + i * 1.1, 1.6, -D / 2 + 0.08]);
    R.box(0, -0.3, 1.25, 0.85);
    return { spots: [{ x: 0, z: 0.9, r: 1.4, label: 'The war room — your generals’ skills', use: fp => fp.openModal(() => fp.hud0.openWarRoom()) }], npc: [] };
  },
  stable(R, m, g, b, size) {
    const { W, D, H } = size; shell(R, m, g, { W, D, H, floor: EARTH, wall: WOOD_L });
    for (const x of [-W / 2 + 1, W / 2 - 1]) m.box(0.08, 1.2, 1.8, WOOD, [x + (x < 0 ? 0.9 : -0.9), 0.6, -0.3]);   // the stall walls
    for (let i = 0; i < 6; i++) m.box(0.3, 0.3, 0.3, '#d8c070', [-0.4 + (i % 3) * 0.32, 0.15 + Math.floor(i / 3) * 0.3, -D / 2 + 0.4]);
    R.box(-W / 2 + 1.9, -0.3, 0.1, 0.9); R.box(W / 2 - 1.9, -0.3, 0.1, 0.9);
    return { spots: [{ x: 0, z: 0.8, r: 1.4, label: 'The stables', panel: true }], npc: [], horses: [[-W / 2 + 0.9, -0.3], [W / 2 - 0.9, -0.3]] };
  },
  generic(R, m, g, b, size) {
    const { W, D, H } = size; shell(R, m, g, { W, D, H, floor: WOOD_L, wall: PLASTER });
    if (b.def.wonder) { m.box(1.4, 0.5, 1.4, STONE, [0, 0.25, -D / 2 + 1.2]); m.cyl(0.4, 0.5, 1.6, 10, GOLD, [0, 1.3, -D / 2 + 1.2]); m.ball(0.4, GOLD, [0, 2.3, -D / 2 + 1.2]); R.box(0, -D / 2 + 1.2, 0.75, 0.75); }
    else { shelf(m, 0, -D / 2 + 0.35, Math.min(3, W - 1)); crate(m, -W / 2 + 0.6, 0.2); crate(m, -W / 2 + 0.6, 0.9); barrel(m, W / 2 - 0.5, 0.4); R.box(-W / 2 + 0.6, 0.55, 0.35, 0.7); }
    andon(m, g, -W / 2 + 0.5, D / 2 - 0.8); andon(m, g, W / 2 - 0.5, D / 2 - 0.8);
    return { spots: [], npc: [] };
  },
};
for (const k of ['nagaya', 'yashiki']) ROOMS[k] = ROOMS.house;
ROOMS.ironmine = ROOMS.mine;

// which workers you meet inside, and how they stand
const INDOOR = new Set(['mine', 'ironmine', 'sakebrewery', 'blacksmith', 'dojo', 'kyudojo', 'market', 'infirmary', 'shoin']);

export function buildInterior(fp, b) {
  const game = fp.game, cell = 2;
  const W0 = Math.max(4.6, b.sw * cell * 1.15 - 0.4), D0 = Math.max(4.6, b.sd * cell * 1.15 - 0.4);
  const size = { W: Math.min(W0, 12), D: Math.min(D0, 11), H: b.type === 'townhall' ? 3.8 : 3.0 };
  const R0 = new Room(size.W, size.D);
  const m = new Mesher(500 + b.id, 0.03), g = new Mesher(700 + b.id, 0.02);
  const make = ROOMS[b.type] || ROOMS.generic, out = make(R0, m, g, b, size);
  // rooms that set their own size (the Keep, mines) make a room of that size instead
  let R = R0;
  if (out.W && (out.W !== size.W || out.D !== size.D)) { R = new Room(out.W, out.D); R.colliders = R0.colliders; R.platform = R0.platform; }
  const W = out.W || size.W, D = out.D || size.D, H = out.H || size.H;
  // every room has the building's ledger by the door: workers, upgrades, everything from the desk's panel
  const spots = out.spots.slice();
  if (!spots.some(s => s.panel) && b.type !== 'townhall') {
    const lx = W / 2 - 0.7, lz = D / 2 - 1.0;
    if (b.type !== 'storehouse' && !['blacksmith', 'lumber', 'sakebrewery', 'mine', 'ironmine', 'quarry'].includes(b.type)) ledger(m, g, lx, lz);
    spots.push({ x: lx - 0.3, z: lz - 0.4, r: 1.0, label: `The ${b.def.name}: workers and upgrades`, panel: true });
  }
  const world = new THREE.Group(); world.name = 'fp-inside'; world.position.copy(INSIDE_AT);
  const mesh = m.mesh(MAT.flat, false, true); world.add(mesh);
  if (!g.empty) world.add(g.mesh(MAT.glow, false, false));
  // the doorway: the light (or the dark) outside
  const day = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.1), new THREE.MeshBasicMaterial({ color: '#cfe2ee', fog: false }));
  day.position.set(0, 1.05, D / 2 + 0.2); day.rotation.y = Math.PI; world.add(day);
  // the people inside: those who work here (and in a home, those who live here and are at home)
  const npcs = [], spotsN = (out.npc || []).slice();
  const here = [...game.villagers.values()].filter(v => !v.away && (v.work === b.id ? (v.hidden || INDOOR.has(b.type)) : (b.def.housing && v.hidden && !v.work && Math.abs(Math.hypot(v.pos.x - game.door(b, 0.5).x, v.pos.z - game.door(b, 0.5).z)) < 2.5)));
  here.slice(0, spotsN.length).forEach((v, i) => {
    const s = spotsN[i], p = new Person((JOBS[v.job] && JOBS[v.job].look) || 'villager', v.id);
    p.group.position.set(s.x, 0, s.z); if (s.face) p.group.rotation.y = Math.atan2(s.face[0], s.face[1]); else p.group.rotation.y = Math.random() * 6;
    world.add(p.group); npcs.push({ x: s.x, z: s.z, p, pose: s.pose || 'idle', name: v.name });
  });
  for (const [x, z] of out.horses || []) { const p = new Person('cavalry', b.id + x * 10); p.group.position.set(x, 0, z); p.group.rotation.y = Math.PI / 2; world.add(p.group); npcs.push({ x, z, p, pose: 'idle', still: true }); }
  R.npcs = npcs; R.spawn = { x: 0, z: D / 2 - 1.0 };
  return { name: 'inside', b, T: R, world, origin: INSIDE_AT, actors: [], camp: { actors: [] }, sensei: null, spots, npcs, day, W, D, H,
    dispose() { world.traverse(o => { if (o.geometry) o.geometry.dispose(); }); world.parent && world.parent.remove(world); } };
}
