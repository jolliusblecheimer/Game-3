// Melee rules shared by you and (later) every soldier: strikes from the left, the right or overhead,
// guards in the same three directions, parries, stamina, heavy strikes that break guards, and staggers.

// timings in seconds; damage before hit-zone and armour; st = stamina cost
export const WEAPONS = {
  yari: {
    name: 'Yari (spear)', reach: 3.1, cone: { l: 0.34, r: 0.34, u: 0.22 }, twoHanded: true,
    light: { wind: 0.2, act: 0.12, rec: 0.32, dmg: 20, st: 11 },
    heavy: { wind: 0.55, act: 0.16, rec: 0.5, dmg: 40, st: 24 },
    desc: 'Long reach and quick thrusts — keep the enemy at the tip.',
  },
  katana: {
    name: 'Katana', reach: 2.25, cone: { l: 0.95, r: 0.95, u: 0.45 }, twoHanded: true,
    light: { wind: 0.24, act: 0.12, rec: 0.3, dmg: 25, st: 12 },
    heavy: { wind: 0.6, act: 0.16, rec: 0.45, dmg: 48, st: 26 },
    desc: 'Fast cuts from every side, and a strong parry.',
  },
};
export const ZONES = { head: 1.6, torso: 1, legs: 0.7 };
export const DIR_NAME = { l: 'left', r: 'right', u: 'overhead' };

const HEAVY_AFTER = 0.3;       // hold the strike this long and it becomes a heavy one
const MAX_HOLD = 1.3;

export class Fighter {
  constructor(weapon = 'yari', { maxHp = 100, maxSt = 100 } = {}) {
    this.setWeapon(weapon);
    this.maxHp = maxHp; this.hp = maxHp; this.maxSt = maxSt; this.st = maxSt;
    this.state = 'idle'; this.t = 0; this.dir = 'r'; this.heavy = false; this.hold = false;
    this.guardDir = 'u'; this.guardStart = -9; this.blockHeld = false;
    this.riposteUntil = 0; this.lastUse = -9; this.queued = null; this.hitDone = false;
    this.parryWindow = 0.2;
    this.flash = null;   // the last thing that happened, for the view (parried, blocked, hurt …)
  }
  setWeapon(k) { this.wk = k; this.w = WEAPONS[k]; this.state = 'idle'; }
  get busy() { return this.state === 'windup' || this.state === 'active' || this.state === 'recover' || this.state === 'stagger' || this.state === 'kick' || this.state === 'down'; }
  get phase() { const s = this.heavy ? this.w.heavy : this.w.light; return s; }
  spend(n, now) { this.st = Math.max(0, this.st - n); this.lastUse = now; }

  strikeDown(dir, now) {
    if (this.state === 'down' || this.state === 'stagger') return;
    if (this.state === 'windup' || this.state === 'active' || (this.state === 'recover' && this.t < this.phase.rec * 0.5) || this.state === 'kick') { this.queued = { dir, now }; return; }
    if (this.st < 6) { this.flash = { kind: 'tired', t: now }; return; }
    this.state = 'windup'; this.t = 0; this.dir = dir; this.heavy = false; this.hold = true; this.hitDone = false;
    this.spend(this.w.light.st, now);
  }
  strikeUp() { this.hold = false; }
  blockDown(dir, now) {
    this.blockHeld = true;
    if (this.state === 'windup') { this.state = 'idle'; this.spend(6, now); this.flash = { kind: 'feint', t: now }; }   // a feint: cancel the strike into a guard
    if (this.state === 'idle' || this.state === 'recover' || this.state === 'guard') { this.state = 'guard'; this.guardDir = dir || this.guardDir; }
    this.guardStart = now;   // a fresh press opens the parry window
  }
  blockUp() { this.blockHeld = false; if (this.state === 'guard') this.state = 'idle'; }
  kick(now) {
    if (this.busy || this.st < 10) return false;
    this.state = 'kick'; this.t = 0; this.hitDone = false; this.spend(14, now); return true;
  }

  // world.strike(fighter) is asked once, in the middle of the active part of a strike or a kick
  update(dt, now, world) {
    this.t += dt;
    const P = this.phase;
    switch (this.state) {
      case 'windup': {
        const rip = now < this.riposteUntil ? 0.6 : 1;
        if (this.hold && this.t >= HEAVY_AFTER && !this.heavy && this.st >= this.w.heavy.st - this.w.light.st) { this.heavy = true; this.spend(this.w.heavy.st - this.w.light.st, now); }
        const need = (this.heavy ? this.w.heavy.wind : this.w.light.wind) * rip;
        if ((!this.hold && this.t >= need) || this.t >= MAX_HOLD) { this.state = 'active'; this.t = 0; }
        break;
      }
      case 'active':
        if (!this.hitDone && this.t >= P.act * 0.5) { this.hitDone = true; if (world) world.strike(this); }
        if (this.t >= P.act) { this.state = 'recover'; this.t = 0; }
        break;
      case 'recover':
        if (this.t >= P.rec) { this.state = this.blockHeld ? 'guard' : 'idle'; this.t = 0; }
        else if (this.queued && this.t >= P.rec * 0.5) { const q = this.queued; this.queued = null; this.state = 'idle'; this.strikeDown(q.dir, now); }
        break;
      case 'kick':
        if (!this.hitDone && this.t >= 0.16) { this.hitDone = true; if (world) world.kick(this); }
        if (this.t >= 0.45) { this.state = this.blockHeld ? 'guard' : 'idle'; this.t = 0; }
        break;
      case 'stagger':
        if (this.t >= this.staggerFor) { this.state = this.blockHeld ? 'guard' : 'idle'; this.t = 0; }
        break;
      case 'idle':
        if (this.queued) { const q = this.queued; this.queued = null; this.strikeDown(q.dir, now); }
        break;
    }
    if (this.queued && now - this.queued.now > 0.6) this.queued = null;
    // stamina comes back once you stop spending it (slower while guarding)
    if (now - this.lastUse > 0.7 && this.state !== 'down') this.st = Math.min(this.maxSt, this.st + dt * (this.state === 'guard' ? 9 : 24));
  }
  // the damage of the strike that is landing now
  strikeDamage(now) {
    let d = this.phase.dmg;
    if (now < this.riposteUntil) { d *= 2; this.riposteUntil = 0; this.lastRiposte = true; } else this.lastRiposte = false;
    return d;
  }
  stagger(sec, now) { this.state = 'stagger'; this.t = 0; this.staggerFor = sec; this.queued = null; this.hold = false; this.lastUse = now; }

  // an enemy strike arrives: { dir, dmg, heavy, front } → 'parry' | 'block' | 'break' | 'hit' | 'down'
  receive(a, now, { autoGuard = false } = {}) {
    if (this.state === 'down') return 'down';
    const guarding = this.state === 'guard' && a.front !== false;
    const gdir = autoGuard ? a.dir : this.guardDir;
    if (guarding && gdir === a.dir) {
      if (now - this.guardStart <= this.parryWindow) {       // a clean parry
        this.riposteUntil = now + 1.3; this.st = Math.min(this.maxSt, this.st + 10);
        this.flash = { kind: 'parry', t: now }; return 'parry';
      }
      if (a.heavy) { this.spend(a.dmg * 0.6, now); this.hurt(a.dmg * 0.35, now); this.stagger(0.9, now); this.flash = { kind: 'break', t: now }; return 'break'; }
      this.spend(a.dmg * 0.9, now);
      if (this.st <= 0) { this.hurt(a.dmg * 0.5, now); this.stagger(1.0, now); this.flash = { kind: 'break', t: now }; return 'break'; }
      this.flash = { kind: 'block', t: now }; return 'block';
    }
    this.hurt(a.dmg, now);
    if (this.state !== 'down') { if (this.state === 'windup' || this.state === 'active') this.stagger(0.35, now); }
    return this.state === 'down' ? 'down' : 'hit';
  }
  hurt(n, now) {
    this.hp = Math.max(0, this.hp - n); this.flash = { kind: 'hurt', t: now, n };
    if (this.hp <= 0) { this.state = 'down'; this.t = 0; }
  }
}
