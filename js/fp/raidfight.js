// Raiders in your village, on foot: the bandits of a raid notice their lord when he comes close (or cuts at
// them), turn on him, wind up (the red ring warns you) and strike. Your cuts, kicks and arrows hurt them.
// A bandit fighting you is steered from here (raids.js hands it over through game.lordDuel); the rest of the
// raid goes on as before. When you're far away, down, or at your desk, they go back to the village.
import { pushOut } from './controller.js';

const NOTICE = 4.5, LEAVE = 16, REACH = 1.55;

export class RaidFight {
  constructor(fp) {
    this.fp = fp; this.cache = new Map();
    fp.game.lordDuel = (u, dt) => this.duel(u, dt);
  }
  get raids() { return this.fp.game.raids; }
  on() { const fp = this.fp; return fp.active && fp.village && !fp.paused && !fp.holding && fp.fighter && fp.fighter.state !== 'down'; }
  // the bandits as targets for your strikes and arrows (the same shape as the yard's people)
  foes() {
    const out = [], R = this.raids;
    for (const u of R.bandits) {
      if (u.dead || u.gone || u.ram || !u.person) { this.cache.delete(u.id); continue; }
      let f = this.cache.get(u.id);
      if (!f) { f = this.make(u); this.cache.set(u.id, f); }
      out.push(f);
    }
    return out;
  }
  make(u) {
    const R = () => this.raids, fp = this.fp;
    return {
      u, name: 'Bandit', r: 0.42, h: 1.8, team: 'raid',
      get x() { return u.x; }, get z() { return u.z; }, get y() { return u.y || 0; }, get dead() { return !!u.dead; },
      onHit(o) {
        u.duel = true;
        // a bandit who sees it coming puts his blade up: only a heavy overhead breaks through
        if (!o.heavy && u.wind == null && this.facing(fp.player.x, fp.player.z) < 0.8 && Math.random() < 0.35) { u.cd = Math.min(u.cd, 0.35); return { blocked: true, sound: 'clash', sparks: 1 }; }
        R().hurtBandit(u, o.dmg); u.bump = o.heavy ? 0.35 : 0.2;
        if (u.wind != null && (o.heavy || Math.random() < 0.25)) u.wind = null;   // a heavy cut breaks his swing
        if (o.heavy) u.cd = Math.max(u.cd, 1.1);
        return { sound: 'flesh', ink: o.heavy ? 9 : 5 };
      },
      onKick(o) { u.duel = true; u.x += o.fx * 1.3; u.z += o.fz * 1.3; u.wind = null; u.cd = Math.max(u.cd, 1); return { sound: 'kick' }; },
      parried() { u.wind = null; u.cd = 1.6; u.bump = 0.3; },
      onArrow(dmg) { R().hurtBandit(u, dmg); u.duel = true; return { ink: 5 }; },
      facing(px, pz) { const a = Math.atan2(px - u.x, pz - u.z); return Math.abs(Math.atan2(Math.sin(a - u.heading), Math.cos(a - u.heading))); },
    };
  }
  // called each step by the raid for a bandit fighting you; false hands him back to the raid
  duel(u, dt) {
    const fp = this.fp, P = fp.player, R = this.raids;
    if (!this.on()) { u.duel = false; u.wind = null; return false; }
    const dx = P.x - u.x, dz = P.z - u.z, d = Math.hypot(dx, dz) || 1;
    if (!u.duel) { if (d < NOTICE && R.active) { u.duel = true; u.cd = 0.4 + Math.random() * 0.4; } else return false; }
    if (d > LEAVE) { u.duel = false; u.wind = null; return false; }
    R.face(u, dx, dz, dt);
    let pose = 'guard';
    if (u.wind != null) {
      // the swing: a moment to see it coming, then it lands (or misses if you stepped away)
      u.wind -= dt;
      if (u.wind <= 0) {
        u.wind = null; u.cd = 1.2 + Math.random() * 0.9; u.chopT = 0.3;
        if (d < REACH + 0.5 && fp.fighter.state !== 'down') fp.enemyStrike(this.cache.get(u.id) || { x: u.x, z: u.z }, { dir: u.dir, dmg: u.dmg * 1.5 * (u.heavy ? 1.6 : 1), heavy: u.heavy });
        else fp.sound.play('whiff', 0.5);
      }
    } else if (d > REACH) {
      // close in, around houses and trees
      const sp = Math.min(u.speed * 1.1, (d - REACH) * 4 + 0.5), nx = u.x + dx / d * sp * dt, nz = u.z + dz / d * sp * dt;
      [u.x, u.z] = pushOut(nx, nz, 0.35, fp.T.colliders); pose = 'walk';
    } else {
      u.cd -= dt;
      if (u.cd <= 0) { u.heavy = Math.random() < 0.2; u.dir = Math.random() < 0.5 ? 'l' : 'r'; u.wind = u.heavy ? 0.85 : 0.55; fp.sound.play('whiff', 0.25); }
    }
    if (u.chopT > 0) { u.chopT -= dt; pose = 'chop'; }
    if (u.wind != null) pose = u.wind < 0.2 ? 'chop' : 'guard';
    R.pose(u, pose, dt);
    return true;
  }
  // a strike is on its way at you: for the crosshair's warning
  incoming() {
    const P = this.fp.player; let light = false, heavy = false;
    for (const f of this.cache.values()) {
      const u = f.u; if (u.dead || u.wind == null) continue;
      if (Math.hypot(u.x - P.x, u.z - P.z) < REACH + 1.2) { if (u.heavy) heavy = true; else light = true; }
    }
    return { light, heavy };
  }
  // carried home, or gone inside: every bandit goes back to the raid
  release() { for (const f of this.cache.values()) { f.u.duel = false; f.u.wind = null; } }
}
