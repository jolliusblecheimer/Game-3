// Build grid + A* pathfinding for villagers.
import { PLOT } from '../render/nature.js';

export const FREE = 0, TREE = -1, ROCK = -2;

export class Grid {
  constructor() {
    this.n = PLOT.n; this.cell = PLOT.cell; this.half = PLOT.half;
    this.occ = new Int32Array(this.n * this.n);       // 0 free, >0 building id, -1 tree, -2 rock
    this.pass = new Uint8Array(this.n * this.n).fill(1); // walkable?
  }
  idx(cx, cz) { return cz * this.n + cx; }
  inside(cx, cz) { return cx >= 0 && cz >= 0 && cx < this.n && cz < this.n; }
  toCell(x, z) { return [Math.floor((x + this.half) / this.cell), Math.floor((z + this.half) / this.cell)]; }
  center(cx, cz) { return { x: -this.half + cx * this.cell + this.cell / 2, z: -this.half + cz * this.cell + this.cell / 2 }; }
  set(cx, cz, v, walkable) { const i = this.idx(cx, cz); this.occ[i] = v; this.pass[i] = walkable ? 1 : 0; }
  get(cx, cz) { return this.inside(cx, cz) ? this.occ[this.idx(cx, cz)] : ROCK; }
  walkable(cx, cz) { return this.inside(cx, cz) && this.pass[this.idx(cx, cz)] === 1; }

  // nearest walkable cell to (cx,cz), searching outward in rings
  nearestWalkable(cx, cz, maxR = 8) {
    if (this.walkable(cx, cz)) return [cx, cz];
    for (let r = 1; r <= maxR; r++) {
      let best = null, bd = Infinity;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (this.walkable(cx + dx, cz + dz)) { const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = [cx + dx, cz + dz]; } }
      }
      if (best) return best;
    }
    return null;
  }

  lineClear(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, dist = Math.hypot(dx, dz), steps = Math.ceil(dist / (this.cell * 0.3));
    for (let i = 1; i < steps; i++) {
      const t = i / steps, [cx, cz] = this.toCell(ax + dx * t, az + dz * t);
      if (!this.walkable(cx, cz)) return false;
    }
    return true;
  }

  // Returns a list of world points from `from` to `to`, or null if unreachable.
  findPath(from, to) {
    const n = this.n;
    let [sx, sz] = this.toCell(from.x, from.z);
    sx = Math.max(0, Math.min(n - 1, sx)); sz = Math.max(0, Math.min(n - 1, sz));
    const [gx0, gz0] = this.toCell(to.x, to.z);
    const goal = this.nearestWalkable(Math.max(0, Math.min(n - 1, gx0)), Math.max(0, Math.min(n - 1, gz0)));
    if (!goal) return null;
    const [gx, gz] = goal, exactGoal = gx === gx0 && gz === gz0;
    const start = this.idx(sx, sz), end = this.idx(gx, gz);
    if (start === end) return [exactGoal ? { x: to.x, z: to.z } : this.center(gx, gz)];
    const g = new Float32Array(n * n).fill(Infinity), came = new Int32Array(n * n).fill(-1), closed = new Uint8Array(n * n);
    const heap = [], push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top[1]; };
    const hfn = (cx, cz) => { const dx = Math.abs(cx - gx), dz = Math.abs(cz - gz); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
    g[start] = 0; push(start, hfn(sx, sz));
    let found = false, iter = 0;
    while (heap.length && iter++ < 6000) {
      const cur = pop(); if (closed[cur]) continue; closed[cur] = 1;
      if (cur === end) { found = true; break; }
      const cx = cur % n, cz = (cur / n) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (!this.walkable(nx, nz)) continue;
        if (dx && dz && (!this.walkable(cx + dx, cz) || !this.walkable(cx, cz + dz))) continue; // no corner cutting
        const ni = this.idx(nx, nz), cost = g[cur] + (dx && dz ? Math.SQRT2 : 1);
        if (cost < g[ni]) { g[ni] = cost; came[ni] = cur; push(ni, cost + hfn(nx, nz)); }
      }
    }
    if (!found) return null;
    const cells = []; for (let c = end; c !== -1 && c !== start; c = came[c]) cells.push(c);
    cells.reverse();
    const pts = cells.map(c => this.center(c % n, (c / n) | 0));
    if (exactGoal) pts[pts.length - 1] = { x: to.x, z: to.z };
    // string-pulling: skip points we can see past
    const out = []; let anchor = { x: from.x, z: from.z }, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.lineClear(anchor.x, anchor.z, pts[j].x, pts[j].z)) j--;
      out.push(pts[j]); anchor = pts[j]; i = j + 1;
    }
    return out;
  }
}
