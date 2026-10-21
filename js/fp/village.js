// Your own village on foot: the ground you walk on (the flat plot, the hills around it), and everything solid in
// it — buildings, walls, towers, trees, rocks, the forest near the edge. Roads, fields, gates and the Town Square
// are open. It answers the same questions as the training valley (FPTerrain), so the player controller works here.
import { heightAt, PLOT } from '../render/nature.js';
import { canEnter } from './interiors.js';

const WATER = -1.2;                 // the level of the lake and the sea (stage.water)
const OPEN = new Set(['road', 'stoneroad', 'farm']);
const CELLS = new Set(['wall', 'palisade', 'hedge', 'spikes']);

export class VillageGround {
  constructor(game) {
    this.game = game;
    this.half = PLOT.half + 30;     // how far you may wander into the hills
    this.colliders = [];
    this.bridge = { len: 0, half: 0 };
    this.spawn = { x: 0, z: 8 }; this.yard = { x: 0, z: 0 };
    this.ver = -1; this.t = 0;
    this.rebuild();
  }
  groundAt(x, z) { return Math.max(heightAt(x, z), WATER - 0.6, this.stairAt(x, z)); }
  // the Keep's front steps (8 steps of 0.29 m, 0.2 m deep, from 5.05 m in front of its middle up to the door)
  stairAt(x, z) {
    const k = this.keep; if (!k) return 0;
    const dx = x - k.x, dz = z - k.z, lx = dx * k.ca - dz * k.sa, lz = dx * k.sa + dz * k.ca;
    if (Math.abs(lx) > 0.8 || lz < 3.55 || lz > 5.15) return 0;
    return (8 - Math.min(7, Math.max(0, Math.floor((lz - 3.55) / 0.2)))) * 0.2875;
  }
  terrainAt(x, z) { return heightAt(x, z); }
  waterDepth(x, z) { return Math.max(0, WATER - heightAt(x, z)); }
  deckAt() { return null; }
  bridgeLocal() { return { u: 1e9, v: 0 }; }
  // the village changes (a house goes up, a tree is felled): look again now and then
  update(dt) {
    this.t -= dt;
    if (this.t <= 0) { this.t = 1.5; if (this.game.version !== this.ver) this.rebuild(); }
  }

  // the Keep's front steps: where you come out, and the spot that takes you in
  keepFront(out = 6.4) {
    const k = this.game.keep; if (!k) return null;
    const a = k.rot * Math.PI / 2, p = this.game.local(k, 0, out);
    return { x: p.x, z: p.z, yaw: a + Math.PI, a };
  }
  // are you on the steps, walking in? (in the Keep's own frame: in front of the door, close to the base)
  atKeepDoor(x, z, fwd) {
    const k = this.game.keep; if (!k || !k.done) return false;
    const c = this.game.center(k), a = k.rot * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
    const dx = x - c.x, dz = z - c.z, lx = dx * ca - dz * sa, lz = dx * sa + dz * ca;
    if (Math.abs(lx) > 1.15 || lz > 4.45 || lz < 3.5) return false;   // up the steps, at the door
    // facing the door: your forward against the Keep's outward direction
    return fwd.x * Math.sin(a) + fwd.z * Math.cos(a) < -0.35;
  }

  // the door you're at: { b, into } — into when you're in the doorway, facing in. Null if no door is close.
  doorAt(x, z, fwd) {
    let best = null, bd = 1e9;
    for (const b of this.game.buildings.values()) {
      if (!canEnter(b)) continue;
      const c = this.game.center(b), a = b.rot * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
      const dx = x - c.x, dz = z - c.z, lx = dx * ca - dz * sa, lz = dx * sa + dz * ca;
      const W = b.sw * PLOT.cell, D = b.sd * PLOT.cell, keep = b.type === 'townhall';
      const front = keep ? 4.45 : D / 2 + 0.45, back = keep ? 3.5 : D / 2 - 0.6, reach = keep ? 6.4 : D / 2 + 2.2, half = keep ? 1.15 : Math.min(0.95, W / 2 - 0.25);
      if (Math.abs(lx) > Math.max(half, 1.3) || lz < back || lz > reach) continue;
      const d = Math.abs(lx) + (lz - back);
      if (d < bd) { bd = d; best = { b, into: Math.abs(lx) <= half && lz <= front && fwd.x * Math.sin(a) + fwd.z * Math.cos(a) < -0.35 }; }
    }
    return best;
  }
  rebuild() {
    const G = this.game, out = this.colliders; out.length = 0; this.ver = G.version;
    const kb = G.keep; if (kb) { const c = G.center(kb), a = kb.rot * Math.PI / 2; this.keep = { x: c.x, z: c.z, ca: Math.cos(a), sa: Math.sin(a) }; } else this.keep = null;
    const box = (b, lx, lz, hw, hd) => { const p = G.local(b, lx, lz); out.push({ x: p.x, z: p.z, hw, hd, ang: b.rot * Math.PI / 2 }); };
    const post = (b, lx, lz, r) => { const p = G.local(b, lx, lz); out.push({ x: p.x, z: p.z, r }); };
    for (const b of G.buildings.values()) {
      if (OPEN.has(b.type)) continue;
      const W = b.sw * PLOT.cell, D = b.sd * PLOT.cell;   // the building's own width and depth (before turning)
      if (CELLS.has(b.type)) { box(b, 0, 0, W / 2, D / 2); continue; }
      switch (b.type) {
        case 'townhall':
          box(b, 0, 0, 3.95, 3.95);
          for (const x of [-2.6, 2.6]) post(b, x, 4.6, 0.12);
          break;
        case 'gate':
          for (const x of [-1.55, 1.55]) box(b, x, 0, 0.28, 0.42);
          if (W >= 5) for (const x of [-1, 1]) box(b, x * (W / 2 - 0.7), 0, 0.68, 0.58);
          break;
        case 'torii': for (const x of [-1.4, 1.4]) post(b, x, 0, 0.22); break;
        case 'hiroba': box(b, 0, 0, 1.2, 1.2); break;           // the festival tower in the middle
        case 'lantern': post(b, 0, 0, 0.32); break;
        case 'sakura': post(b, 0, 0, 0.3); break;
        default: box(b, 0, 0, Math.max(0.4, W / 2 - 0.3), Math.max(0.4, D / 2 - 0.3));
      }
    }
    const N = G.nature;
    for (const t of N.trees || []) if (!t.removed) out.push({ x: t.x, z: t.z, r: t.alive ? 0.28 * t.s * Math.max(0.4, t.grow) : 0.3 });
    for (const r of N.rocks || []) out.push({ x: r.x, z: r.z, r: 0.95 * r.s });
    for (const w of N.woods || []) if (Math.max(Math.abs(w.x), Math.abs(w.z)) < this.half + 6) out.push({ x: w.x, z: w.z, r: 0.32 * w.s });
  }
  // the people walking about: soft obstacles that move, and step aside when their lord is right there
  people(px, pz) {
    const out = [];
    for (const v of this.game.villagers.values()) {
      if (v.hidden || v.away || v.onWall || !v.pos) continue;
      const dx = v.pos.x - px, dz = v.pos.z - pz, d = Math.hypot(dx, dz);
      if (d < 0.85 && d > 1e-3) { v.pos.x = px + dx / d * 0.85; v.pos.z = pz + dz / d * 0.85; }
      out.push({ x: v.pos.x, z: v.pos.z, r: 0.25 });
    }
    return out;
  }
}
