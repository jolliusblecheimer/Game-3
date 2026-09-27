// Melee rules shared by you and (later) every soldier.
//  • Click: a combo of cuts that alternate left, right, left, right…
//  • Hold the click: a strong overhead strike that breaks any guard (block or shield).
//  • Hold the other button: block. Every strike from in front of you is stopped (a shield covers a wider arc);
//    a block opens a calm counter window: your next strike does ×1.5.
//  • Bows: hold the other button to aim, click to shoot.
// The old split-second parry is kept here, switched off (Fighter.parryOn).

// timings in seconds; damage before hit-zone and armour; st = stamina cost; hits = how many it can cut at once
export const WEAPONS = {
  yari:     { name: 'Yari', kind: 'pole', reach: 3.1, cone: 0.36, hits: 1, light: { wind: 0.2, act: 0.12, rec: 0.3, dmg: 20, st: 11 }, heavy: { wind: 0.55, act: 0.16, rec: 0.5, dmg: 42, st: 24 } },
  lance:    { name: 'Lance', kind: 'pole', reach: 3.4, cone: 0.34, hits: 1, light: { wind: 0.22, act: 0.14, rec: 0.34, dmg: 22, st: 10 }, heavy: { wind: 0.6, act: 0.18, rec: 0.5, dmg: 44, st: 22 } },
  naginata: { name: 'Naginata', kind: 'pole', reach: 2.9, cone: 0.85, hits: 2, light: { wind: 0.26, act: 0.14, rec: 0.34, dmg: 22, st: 13 }, heavy: { wind: 0.62, act: 0.18, rec: 0.5, dmg: 44, st: 26 } },
  katana:   { name: 'Katana', kind: 'blade', reach: 2.25, cone: 0.9, hits: 1, light: { wind: 0.2, act: 0.12, rec: 0.26, dmg: 25, st: 11 }, heavy: { wind: 0.55, act: 0.16, rec: 0.42, dmg: 50, st: 25 } },
  sword:    { name: 'Uchigatana', kind: 'blade', reach: 2.0, cone: 0.85, hits: 1, light: { wind: 0.22, act: 0.12, rec: 0.28, dmg: 20, st: 10 }, heavy: { wind: 0.58, act: 0.16, rec: 0.45, dmg: 40, st: 22 } },
  ninjato:  { name: 'Ninjatō', kind: 'blade', reach: 1.9, cone: 0.9, hits: 1, light: { wind: 0.14, act: 0.1, rec: 0.2, dmg: 16, st: 8 }, heavy: { wind: 0.45, act: 0.14, rec: 0.36, dmg: 34, st: 20 } },
  kanabo:   { name: 'Kanabō', kind: 'club', reach: 2.3, cone: 1.0, hits: 2, light: { wind: 0.34, act: 0.16, rec: 0.42, dmg: 34, st: 16 }, heavy: { wind: 0.8, act: 0.2, rec: 0.6, dmg: 75, st: 32 }, heavyHits: 4 },
  yumi:     { name: 'Yumi', kind: 'bow', reach: 1.4, cone: 0.6, hits: 1, light: { wind: 0.14, act: 0.1, rec: 0.3, dmg: 10, st: 8 }, heavy: { wind: 0.4, act: 0.12, rec: 0.4, dmg: 14, st: 12 } },
};
export const ZONES = { head: 1.6, torso: 1, legs: 0.7 };
export const DIR_NAME = { l: 'left', r: 'right', u: 'overhead' };

const HEAVY_AFTER = 0.3;       // hold the strike this long and it becomes the heavy overhead
const MAX_HOLD = 1.3;
const COMBO_RESET = 1.1;       // pause this long and the combo starts again from the left
const COUNTER = 1.0, COUNTER_MULT = 1.5;
const DRAW = 1.0;              // seconds to draw a bow fully (raise, then draw down to the cheek)

export class Fighter {
  constructor(weapon = 'yari', { maxHp = 100, maxSt = 100, shield = false } = {}) {
    this.maxHp = maxHp; this.hp = maxHp; this.maxSt = maxSt; this.st = maxSt; this.shield = shield;
    this.setWeapon(weapon);
    this.state = 'idle'; this.t = 0; this.dir = 'l'; this.heavy = false; this.hold = false;
    this.blockHeld = false; this.guardStart = -9; this.guardDir = 'u';
    this.counterUntil = 0; this.riposteUntil = 0; this.lastUse = -9; this.queued = null; this.hitDone = false;
    this.combo = 0; this.lastStrikeEnd = -9;
    this.parryOn = false; this.parryWindow = 0.2;      // the shelved split-second parry
    this.draw = 0; this.aiming = false;                 // bows
    this.flash = null;
  }
  setWeapon(k) { this.wk = k; this.w = WEAPONS[k]; this.state = 'idle'; this.combo = 0; this.draw = 0; }
  get isBow() { return this.w.kind === 'bow'; }
  get busy() { return ['windup', 'active', 'recover', 'stagger', 'kick', 'down', 'shoot'].includes(this.state); }
  get phase() { return this.heavy ? this.w.heavy : this.w.light; }
  get guardArc() { return this.shield ? 1.75 : 1.2; }   // how far round the front a block covers (radians, both sides)
  spend(n, now) { this.st = Math.max(0, this.st - n); this.lastUse = now; }

  /* ---------- the strike button ---------- */
  strikeDown(now) {
    if (this.state === 'down' || this.state === 'stagger') return;
    if (this.isBow) {                                                       // bows: shoot — aimed, or a quick shot from the hip
      if (this.aiming) { this.loose = true; this.quick = false; }
      else if (!this.busy) { this.state = 'aim'; this.t = 0; this.draw = 0.45; this.loose = true; this.quick = true; }
      else if (this.state === 'shoot') this.queuedShot = true;
      return;
    }
    if (this.state === 'windup' || this.state === 'active' || (this.state === 'recover' && this.t < this.phase.rec * 0.5) || this.state === 'kick') { this.queued = { now, released: false }; return; }
    if (this.st < 6) { this.flash = { kind: 'tired', t: now }; return; }
    if (this.state === 'guard') this.state = 'idle';
    if (now - this.lastStrikeEnd > COMBO_RESET) this.combo = 0;
    this.dir = this.combo % 2 ? 'r' : 'l';
    this.state = 'windup'; this.t = 0; this.heavy = false; this.hold = true; this.hitDone = false; this.strikeId = (this.strikeId || 0) + 1;
    this.spend(this.w.light.st, now);
  }
  strikeUp() { this.hold = false; if (this.queued) this.queued.released = true; }   // a queued click that was let go stays a quick cut
  /* ---------- the block / aim button ---------- */
  blockDown(now) {
    this.blockHeld = true;
    if (this.isBow) { if (!this.busy) { this.aiming = true; this.state = 'aim'; this.draw = 0; } return; }
    if (this.state === 'windup' && !this.heavy) { this.state = 'idle'; this.spend(4, now); this.flash = { kind: 'feint', t: now }; }   // cancel a cut into a block
    if (this.state === 'idle' || this.state === 'recover' || this.state === 'guard') this.state = 'guard';
    this.guardStart = now;
  }
  blockUp() {
    this.blockHeld = false;
    if (this.isBow) { this.aiming = false; if (this.state === 'aim') this.state = 'idle'; this.draw = 0; return; }
    if (this.state === 'guard') this.state = 'idle';
  }
  kick(now) {
    if (this.busy || this.st < 10) return false;
    this.state = 'kick'; this.t = 0; this.hitDone = false; this.spend(14, now); return true;
  }

  // world.strike(fighter) is asked once, in the middle of the active part of a strike; world.kick(fighter) for kicks;
  // world.shoot(fighter, power) when a bow looses
  update(dt, now, world) {
    this.t += dt;
    const P = this.phase;
    switch (this.state) {
      case 'windup': {
        const quick = now < this.counterUntil || now < this.riposteUntil ? 0.7 : 1;
        // held long enough: it turns into the heavy overhead
        if (this.hold && this.t >= HEAVY_AFTER && !this.heavy && this.st >= this.w.heavy.st - this.w.light.st) { this.heavy = true; this.dir = 'u'; this.spend(this.w.heavy.st - this.w.light.st, now); }
        const need = (this.heavy ? this.w.heavy.wind : this.w.light.wind) * quick;
        if ((!this.hold && this.t >= need) || this.t >= MAX_HOLD) { this.state = 'active'; this.t = 0; }
        break;
      }
      case 'active':
        if (!this.hitDone && this.t >= P.act * 0.5) { this.hitDone = true; if (world) world.strike(this); }
        if (this.t >= P.act) { this.state = 'recover'; this.t = 0; if (!this.heavy) this.combo++; else this.combo = 0; this.lastStrikeEnd = now; }
        break;
      case 'recover':
        if (this.t >= P.rec) { this.state = this.blockHeld ? 'guard' : 'idle'; this.t = 0; this.lastStrikeEnd = now; }
        else if (this.queued && this.t >= P.rec * 0.45) { const q = this.queued; this.queued = null; this.state = 'idle'; this.strikeDown(now); if (q.released) this.hold = false; }
        break;
      case 'kick':
        if (!this.hitDone && this.t >= 0.16) { this.hitDone = true; if (world) world.kick(this); }
        if (this.t >= 0.45) { this.state = this.blockHeld && !this.isBow ? 'guard' : 'idle'; this.t = 0; }
        break;
      case 'stagger':
        if (this.t >= this.staggerFor) { this.state = this.blockHeld && !this.isBow ? 'guard' : 'idle'; this.t = 0; }
        break;
      case 'aim':
        this.draw = Math.min(1, this.draw + dt / DRAW);
        if (this.loose && (!this.quick || this.t >= 0.12)) {
          this.loose = false;
          if (world && world.shoot(this, this.draw, this.quick)) { this.state = 'shoot'; this.t = 0; this.draw = 0; }
          else if (this.quick) { this.state = 'idle'; this.draw = 0; }
          this.quick = false;
        }
        break;
      case 'shoot':   // nocking the next arrow
        if (this.t >= 0.6) {
          this.state = this.blockHeld ? 'aim' : 'idle'; this.t = 0; this.draw = 0; this.aiming = this.blockHeld;
          if (this.queuedShot && !this.blockHeld) { this.state = 'aim'; this.draw = 0.45; this.loose = true; this.quick = true; }   // a click while nocking: the next quick shot
          this.queuedShot = false;
        }
        break;
      case 'idle':
        if (this.queued) { const q = this.queued; this.queued = null; this.strikeDown(now); if (q.released) this.hold = false; }
        if (this.isBow && this.loose) { this.loose = false; }
        break;
    }
    if (this.queued && now - this.queued.now > 0.6) this.queued = null;
    // stamina comes back once you stop spending it (slower while guarding or drawing)
    if (now - this.lastUse > 0.7 && this.state !== 'down') this.st = Math.min(this.maxSt, this.st + dt * (this.state === 'guard' || this.state === 'aim' ? 10 : 24));
    if (this.state === 'aim') this.st = Math.max(0, this.st - dt * 3);
  }
  // the damage of the strike that is landing now (a counter after a block: ×1.5)
  strikeDamage(now) {
    let d = this.phase.dmg; this.lastBonus = '';
    if (now < this.riposteUntil) { d *= 2; this.riposteUntil = 0; this.lastBonus = 'riposte ×2'; }
    else if (now < this.counterUntil) { d *= COUNTER_MULT; this.counterUntil = 0; this.lastBonus = 'counter ×1.5'; }
    if (this.buffUntil && now < this.buffUntil) d *= 1.25;
    return d;
  }
  stagger(sec, now) { this.state = 'stagger'; this.t = 0; this.staggerFor = sec; this.queued = null; this.hold = false; this.lastUse = now; this.aiming = false; this.draw = 0; }

  // an enemy strike arrives: { dir, dmg, heavy, angle (how far from straight ahead it comes, radians) }
  //  → 'block' | 'break' | 'hit' | 'down'  (or 'parry' with the shelved parry switched on)
  receive(a, now) {
    if (this.state === 'down') return 'down';
    const faced = (a.angle ?? 0) <= this.guardArc / 2 + 0.15;
    if (this.state === 'guard' && faced) {
      if (this.parryOn && now - this.guardStart <= this.parryWindow) {
        this.riposteUntil = now + 1.3; this.st = Math.min(this.maxSt, this.st + 10); this.flash = { kind: 'parry', t: now }; return 'parry';
      }
      if (a.heavy) {   // the strong overhead breaks any guard; a shield takes the worst of it
        this.spend(a.dmg * (this.shield ? 0.8 : 0.6), now); this.hurt(a.dmg * (this.shield ? 0.2 : 0.4), now);
        this.stagger(this.shield ? 0.6 : 0.9, now); this.flash = { kind: 'break', t: now }; return 'break';
      }
      this.spend(a.dmg * (this.shield ? 0.45 : 0.8), now);
      if (this.st <= 0) { this.hurt(a.dmg * 0.5, now); this.stagger(1.0, now); this.flash = { kind: 'break', t: now }; return 'break'; }
      this.counterUntil = now + COUNTER; this.flash = { kind: 'block', t: now }; return 'block';
    }
    this.hurt(a.dmg, now);
    if (this.state !== 'down' && (this.state === 'windup' || this.state === 'active' || this.state === 'aim')) this.stagger(0.35, now);
    return this.state === 'down' ? 'down' : 'hit';
  }
  hurt(n, now) {
    this.hp = Math.max(0, this.hp - n); this.flash = { kind: 'hurt', t: now, n };
    if (this.hp <= 0) { this.state = 'down'; this.t = 0; }
  }
  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }
}
