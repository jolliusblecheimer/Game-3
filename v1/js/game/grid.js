// Build grid + A* pathfinding for villagers.
import { PLOT } from '../render/nature.js';

export const FREE = 0, TREE = -1, ROCK = -2;

export class Grid {
  // n×n cells of `cell` units, centred on (ox, oz). The village uses the defaults; battles use their own grid.
  constructor(n = PLOT.n, cell = PLOT.cell, ox = 0, oz = 0) {
    this.n = n; this.cell = cell; this.half = n * cell / 2; this.ox = ox; this.oz = oz;
    this.occ = new Int32Array(this.n * this.n);       // 0 free, >0 building id, -1 tree, -2 rock
    this.pass = new Uint8Array(this.n * this.n).fill(1); // walkable?
    this.speed = new Float32Array(this.n * this.n).fill(1); // walking speed multiplier (roads > 1)
  }
  static MAX_SPEED = 1.9;
  idx(cx, cz) { return cz * this.n + cx; }
  inside(cx, cz) { return cx >= 0 && cz >= 0 && cx < this.n && cz < this.n; }
  toCell(x, z) { return [Math.floor((x - this.ox + this.half) / this.cell), Math.floor((z - this.oz + this.half) / this.cell)]; }
  center(cx, cz) { return { x: this.ox - this.half + cx * this.cell + this.cell / 2, z: this.oz - this.half + cz * this.cell + this.cell / 2 }; }
  set(cx, cz, v, walkable, speed = 1) { const i = this.idx(cx, cz); this.occ[i] = v; this.pass[i] = walkable ? 1 : 0; this.speed[i] = speed; }
  speedAt(x, z) { const [cx, cz] = this.toCell(x, z); return this.inside(cx, cz) ? this.speed[this.idx(cx, cz)] : 1; }
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

  // straight line walkable? minSpeed keeps shortcuts from leaving a road
  lineClear(ax, az, bx, bz, minSpeed = 0) {
    const dx = bx - ax, dz = bz - az, dist = Math.hypot(dx, dz), steps = Math.ceil(dist / (this.cell * 0.3));
    for (let i = 1; i < steps; i++) {
      const t = i / steps, [cx, cz] = this.toCell(ax + dx * t, az + dz * t);
      if (!this.walkable(cx, cz)) return false;
      if (minSpeed > 1 && this.speed[this.idx(cx, cz)] < minSpeed) return false;
    }
    return true;
  }

  // walking time along a straight line (Infinity if blocked)
  lineTime(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, dist = Math.hypot(dx, dz), steps = Math.max(1, Math.ceil(dist / (this.cell * 0.25)));
    let t = 0;
    for (let i = 0; i < steps; i++) {
      const f = (i + 0.5) / steps, [cx, cz] = this.toCell(ax + dx * f, az + dz * f);
      if (i > 0 && !this.walkable(cx, cz)) return Infinity;
      t += (dist / steps) / (this.inside(cx, cz) ? this.speed[this.idx(cx, cz)] : 1);
    }
    return t;
  }
  // Returns a list of world points from `from` to `to`, or null if unreachable.
  // partial: if the goal can't be reached, lead as close to it as possible instead of giving up
  findPath(from, to, partial = false) {
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
    const hfn = (cx, cz) => { const dx = Math.abs(cx - gx), dz = Math.abs(cz - gz); return ((dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz)) / Grid.MAX_SPEED; };
    g[start] = 0; push(start, hfn(sx, sz));
    let found = false, iter = 0, best = start, bestH = Infinity;
    while (heap.length && iter++ < n * n * 1.5) {
      const cur = pop(); if (closed[cur]) continue; closed[cur] = 1;
      if (cur === end) { found = true; break; }
      const cx = cur % n, cz = (cur / n) | 0;
      if (partial) { const hh = hfn(cx, cz); if (hh < bestH) { bestH = hh; best = cur; } }
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (!this.walkable(nx, nz)) continue;
        if (dx && dz && (!this.walkable(cx + dx, cz) || !this.walkable(cx, cz + dz))) continue; // no corner cutting
        const ni = this.idx(nx, nz), cost = g[cur] + (dx && dz ? Math.SQRT2 : 1) / this.speed[ni]; // roads are "shorter"
        if (cost < g[ni]) { g[ni] = cost; came[ni] = cur; push(ni, cost + hfn(nx, nz)); }
      }
    }
    let last = end;
    if (!found) { if (!partial || best === start) return null; last = best; }
    const cells = []; for (let c = last; c !== -1 && c !== start; c = came[c]) cells.push(c);
    cells.reverse();
    const pts = cells.map(c => this.center(c % n, (c / n) | 0));
    if (exactGoal && found) pts[pts.length - 1] = { x: to.x, z: to.z };
    // string-pulling: skip points we can see past
    // (a shortcut is only taken if it's no slower than following the path — keeps villagers on roads)
    const cum = [0]; // walking time along the path up to each point
    for (let q = 1; q < pts.length; q++) cum.push(cum[q - 1] + this.lineTime(pts[q - 1].x, pts[q - 1].z, pts[q].x, pts[q].z));
    const out = []; let anchor = { x: from.x, z: from.z }, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      const toI = this.lineTime(anchor.x, anchor.z, pts[i].x, pts[i].z);
      while (j > i) {
        const direct = this.lineTime(anchor.x, anchor.z, pts[j].x, pts[j].z);
        if (direct < Infinity && direct <= (toI + cum[j] - cum[i]) * 1.02) break;
        j--;
      }
      out.push(pts[j]); anchor = pts[j]; i = j + 1;
    }
    return out;
  }
}
