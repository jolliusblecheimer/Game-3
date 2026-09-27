// You, on your feet: walking, running, crouching and dodging over the valley. Slopes slow you, fords are
// slow and wet, deep water can't be waded, the bridge has rails, and trees, rocks and buildings are solid.
import { clamp, lerp } from '../util.js';
import { HALF } from './terrain.js';

const EYE = 1.62, EYE_CROUCH = 1.12, RADIUS = 0.35;

export class Player {
  constructor(T) {
    this.T = T;
    this.x = T.spawn.x; this.z = T.spawn.z;
    this.yaw = Math.atan2(T.yard.x - T.spawn.x, T.yard.z - T.spawn.z) + Math.PI; this.pitch = -0.05;
    this.vx = 0; this.vz = 0; this.speed = 0;
    this.crouch = false; this.eye = EYE; this.y = T.groundAt(this.x, this.z);
    this.dodgeT = 0; this.dodgeV = { x: 0, z: 0 };
    this.colliders = T.colliders;
    this.wet = 0; this.onBridge = false; this.stepT = 0;
  }
  // forward/right on the ground from the view direction (the camera looks down −z at yaw 0)
  get fwd() { return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) }; }
  get right() { return { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) }; }
  look(dx, dy) { this.yaw -= dx * 0.0025; this.pitch = clamp(this.pitch - dy * 0.0025, -1.35, 1.35); }
  walkable(x, z) {
    if (Math.abs(x) > HALF || Math.abs(z) > HALF) return false;
    if (this.T.deckAt(x, z) != null) return true;
    if (this.T.waterDepth(x, z) > 0.75) return false;                       // too deep to wade
    const g = this.T.terrainAt(x, z), s = Math.max(Math.abs(this.T.terrainAt(x + 0.5, z) - g), Math.abs(this.T.terrainAt(x, z + 0.5) - g)) / 0.5;
    return s < 1.25;                                                        // too steep to climb
  }
  // move = { x, z } in −1…1 (x strafe, z forward); run, crouch toggle and dodge from the input
  update(dt, move, { run, dodge, fighter, now }) {
    const f = this.fwd, r = this.right;
    let wx = f.x * move.z + r.x * move.x, wz = f.z * move.z + r.z * move.x;
    const L = Math.hypot(wx, wz); if (L > 1) { wx /= L; wz /= L; }
    const depth = this.T.waterDepth(this.x, this.z), inWater = depth > 0.05;
    const busy = fighter && (fighter.state === 'stagger' || fighter.state === 'down');
    const canRun = run && !this.crouch && !inWater && move.z > 0.2 && fighter.st > 2 && !fighter.busy && fighter.state !== 'guard';
    let sp = this.crouch ? 1.7 : canRun ? 6.2 : 3.5;
    if (fighter && fighter.state === 'guard') sp = Math.min(sp, 2.4);
    if (fighter && (fighter.state === 'windup' || fighter.state === 'active')) sp = Math.min(sp, 2.2);
    if (inWater) sp *= depth > 0.4 ? 0.4 : 0.6;
    if (busy) sp = fighter.state === 'down' ? 0 : 1;
    // uphill is slower, downhill a touch faster
    if (L > 0.01) { const up = this.T.groundAt(this.x + wx * 0.6, this.z + wz * 0.6) - this.T.groundAt(this.x, this.z); sp *= clamp(1 - up * 0.9, 0.5, 1.12); }
    if (canRun && L > 0.1) fighter.spend(9 * dt, now);
    // a dodge: a quick step in the direction you're moving (backwards if standing still)
    if (dodge && this.dodgeT <= 0 && fighter.st >= 18 && !busy && !inWater) {
      const dx = L > 0.1 ? wx : -f.x, dz = L > 0.1 ? wz : -f.z;
      this.dodgeT = 0.24; this.dodgeV = { x: dx * 8.5, z: dz * 8.5 }; fighter.spend(20, now); this.justDodged = true;
    }
    const acc = 1 - Math.exp(-(L > 0.01 ? 14 : 10) * dt);
    this.vx = lerp(this.vx, wx * sp, acc); this.vz = lerp(this.vz, wz * sp, acc);
    let mx = this.vx, mz = this.vz;
    if (this.dodgeT > 0) { this.dodgeT -= dt; mx = this.dodgeV.x; mz = this.dodgeV.z; }
    this.tryMove(mx * dt, mz * dt);
    this.speed = Math.hypot(mx, mz);
    // stand on the ground (or the bridge), with the eye easing over steps
    const g = this.T.groundAt(this.x, this.z);
    this.y = lerp(this.y, g, 1 - Math.exp(-20 * dt));
    this.eye = lerp(this.eye, this.crouch ? EYE_CROUCH : fighter && fighter.state === 'down' ? 0.5 : EYE, 1 - Math.exp(-10 * dt));
    this.wet = this.T.waterDepth(this.x, this.z);
    this.onBridge = this.T.deckAt(this.x, this.z) != null;
  }
  tryMove(dx, dz) {
    // slide along what blocks you: try both axes, then each alone
    const nx = this.x + dx, nz = this.z + dz;
    if (this.walkable(nx, nz) && this.bridgeOk(nx, nz)) { this.x = nx; this.z = nz; }
    else if (this.walkable(nx, this.z) && this.bridgeOk(nx, this.z)) this.x = nx;
    else if (this.walkable(this.x, nz) && this.bridgeOk(this.x, nz)) this.z = nz;
    this.collide();
  }
  // on the bridge the rails keep you on the deck
  bridgeOk(x, z) {
    const a = this.T.bridgeLocal(this.x, this.z), b = this.T.bridgeLocal(x, z), B = this.T.bridge;
    if (Math.abs(a.u) < B.len / 2 - 0.3 && Math.abs(a.v) < B.half && Math.abs(b.v) > B.half - RADIUS) return false;
    return true;
  }
  collide() {
    for (let pass = 0; pass < 2; pass++) for (const c of this.colliders) {
      const dx = this.x - c.x, dz = this.z - c.z;
      if (Math.abs(dx) > 8 || Math.abs(dz) > 8) continue;
      if (c.r != null) {
        const d = Math.hypot(dx, dz), m = c.r + RADIUS;
        if (d < m && d > 1e-4) { this.x = c.x + dx / d * m; this.z = c.z + dz / d * m; }
      } else {
        // an oriented box: work in its frame (local +z along ang)
        const ca = Math.cos(c.ang), sa = Math.sin(c.ang);
        const lx = dx * ca - dz * sa, lz = dx * sa + dz * ca;
        const px = clamp(lx, -c.hw, c.hw), pz = clamp(lz, -c.hd, c.hd), ox = lx - px, oz = lz - pz, d = Math.hypot(ox, oz);
        if (d >= RADIUS) continue;
        let nlx, nlz;
        if (d > 1e-4) { nlx = px + ox / d * RADIUS; nlz = pz + oz / d * RADIUS; }
        else { const ex = c.hw - Math.abs(lx), ez = c.hd - Math.abs(lz); if (ex < ez) { nlx = Math.sign(lx || 1) * (c.hw + RADIUS); nlz = lz; } else { nlx = lx; nlz = Math.sign(lz || 1) * (c.hd + RADIUS); } }
        this.x = c.x + nlx * ca + nlz * sa; this.z = c.z - nlx * sa + nlz * ca;
      }
    }
  }
}
