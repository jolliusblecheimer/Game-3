// People you fight in first person (and, later, fight beside). Every one of them uses the same Fighter as you —
// the combo, the heavy overhead, blocks, counters, stamina, kicks — only a small brain presses the buttons.
//  • Sensei Kenji in the training yard: bouts with wooden swords (no one dies).
//  • A bandit camp across the river: swordsmen and an archer, for real.
import * as THREE from 'three';
import { Person } from '../render/people.js';
import { Mesher, MAT } from '../render/geo.js';
import { Fighter } from './combat.js';
import { pushOut } from './controller.js';
import { clamp, lerp, mulberry32 } from '../util.js';

// how sharp the enemy is, by difficulty
export const SKILL = {
  easy:   { react: 0.24, miss: 0.33, feint: 0,    breakTurtle: 0.35, dmg: 0.7,  tokens: 1, aim: 0.05 },
  normal: { react: 0.15, miss: 0.17, feint: 0.12, breakTurtle: 0.7,  dmg: 1,    tokens: 2, aim: 0.03 },
  hard:   { react: 0.09, miss: 0.08, feint: 0.3,  breakTurtle: 1,    dmg: 1.25, tokens: 3, aim: 0.018 },
};
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export class Actor {
  // o: { look, weapon, name, hp, st, x, z, yaw, team: 'foe' | 'spar', archer, seed, aggroRange }
  constructor(fp, o) {
    this.fp = fp; this.o = o; this.name = o.name; this.team = o.team || 'foe'; this.archer = !!o.archer;
    this.x = o.x; this.z = o.z; this.home = { x: o.x, z: o.z, yaw: o.yaw || 0 }; this.yaw = o.yaw || 0; this.y = fp.T.groundAt(o.x, o.z);
    this.r = 0.35; this.h = 1.8; this.vx = 0; this.vz = 0; this.speed = 0;
    this.fighter = new Fighter(o.weapon, { maxHp: o.hp || 80, maxSt: o.st || 100 });
    this.person = new Person(o.look, o.seed || 1);
    this.person.group.rotation.order = 'YXZ';
    fp.world.add(this.person.group);
    this.aggro = false; this.dead = false; this.fall = 0; this.idlePose = o.idle || 'guard';
    this.thinkT = Math.random() * 0.2; this.strafe = Math.random() < 0.5 ? 1 : -1; this.strafeT = 0;
    this.plan = []; this.holdUntil = 0; this.blockUntil = 0; this.sawStrikeAt = null; this.turtleSince = null; this.retreatUntil = 0; this.nextAttack = 0;
    this.aimT = 0; this.shotCd = 1 + Math.random();
    this.world = { strike: F => fp.actorStrike(this, F), kick: F => fp.actorKick(this, F), shoot: () => false };
    this.place();
  }
  get alive() { return !this.dead; }
  get fwd() { return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) }; }   // people face +z at yaw 0
  place() { this.person.group.position.set(this.x, this.y, this.z); this.person.group.rotation.y = this.yaw; }
  reset() {
    this.x = this.home.x; this.z = this.home.z; this.yaw = this.home.yaw; this.y = this.fp.T.groundAt(this.x, this.z);
    const F = this.fighter; F.hp = F.maxHp; F.st = F.maxSt; F.state = 'idle'; F.blockHeld = false; F.hold = false;
    this.dead = false; this.fall = 0; this.aggro = false; this.plan = []; this.person.group.rotation.x = 0; this.person.group.visible = true;
    this.place();
  }
  // the angle between where this one faces and the direction to (x, z)
  facing(x, z) { return Math.abs(angDiff(Math.atan2(x - this.x, z - this.z), this.yaw)); }

  /* ---------- being hit ---------- */
  onHit(h) {
    if (this.dead) return null;
    const fp = this.fp, P = fp.player, F = this.fighter, now = fp.now;
    this.aggro = true; this.alertOthers();
    const faced = this.facing(P.x, P.z) <= F.guardArc / 2 + 0.15;
    if (F.state === 'guard' && faced) {
      if (h.heavy) { F.spend(h.dmg * 0.6, now); F.hurt(h.dmg * 0.35, now); F.stagger(0.9, now); this.checkDown(); return { sound: 'clash', text: 'Guard broken!', broke: true }; }
      F.spend(h.dmg * 0.8, now);
      if (F.st <= 0) { F.hurt(h.dmg * 0.5, now); F.stagger(1.0, now); this.checkDown(); return { sound: 'clash', text: 'Out of breath — his guard breaks!', broke: true }; }
      F.counterUntil = now + 1.0; this.counterNow = true;
      return { sound: 'clash', blocked: true };
    }
    F.hurt(h.dmg, now);
    if (F.state === 'windup' || F.state === 'active' || F.state === 'aim') F.stagger(0.45, now);
    // a little push back
    this.vx += h.fx * (h.heavy ? 3 : 1.5); this.vz += h.fz * (h.heavy ? 3 : 1.5);
    this.checkDown();
    return { sound: 'flesh', ink: h.heavy ? 12 : 7, text: this.dead && this.team !== 'spar' ? `${this.name} falls.` : null };
  }
  onKick(h) {
    if (this.dead) return null;
    const F = this.fighter, now = this.fp.now; this.aggro = true;
    this.vx += h.fx * 4; this.vz += h.fz * 4;
    if (F.state === 'guard') { F.stagger(0.7, now); F.blockUp(); return { sound: 'kick', text: 'Kicked through his guard!' }; }
    F.stagger(0.5, now); return { sound: 'kick' };
  }
  parried() { this.fighter.stagger(1.3, this.fp.now); this.plan = []; this.holdUntil = 0; }
  deflected() { this.fighter.stagger(0.25, this.fp.now); this.plan = []; }
  onArrow(dmg, zone) {
    if (this.dead) return null;
    this.aggro = true; this.alertOthers();
    this.fighter.hurt(dmg, this.fp.now); if (this.fighter.state === 'windup' || this.fighter.state === 'aim') this.fighter.stagger(0.4, this.fp.now);
    this.checkDown();
    return { sound: 'flesh', ink: 5, text: this.dead ? `${this.name} falls.` : null };
  }
  checkDown() {
    const F = this.fighter;
    if (this.team === 'spar') { if (F.hp <= F.maxHp * 0.2 && this.fp.bout) this.fp.endBout(true); if (F.state === 'down') { F.state = 'idle'; F.hp = F.maxHp * 0.2; } return; }
    if (F.state === 'down' || F.hp <= 0) { this.dead = true; this.fighter.blockHeld = false; this.fp.releaseToken(this); this.fp.onKilled(this); }
  }
  alertOthers() { if (this.group) for (const a of this.group) if (a !== this && !a.dead) a.aggro = true; }

  /* ---------- the brain ---------- */
  think(now, dt) {
    const fp = this.fp, P = fp.player, PF = fp.fighter, F = this.fighter, S = fp.skill;
    const dx = P.x - this.x, dz = P.z - this.z, d = Math.hypot(dx, dz);
    if (!this.aggro) {
      const range = (this.o.aggroRange || 20) * (P.crouch ? 0.55 : 1);
      if (d < range && this.team === 'foe') { this.aggro = true; this.alertOthers(); fp.hud.message(`${this.name}: "Who goes there?!"`, 1.8, 'bad'); fp.sound.play('bell', 0.5); }
      return;
    }
    if (this.archer) return this.thinkArcher(now, d);
    const reach = F.w.reach, want = reach * 0.85, hasToken = fp.hasToken(this);
    const playerStriking = (PF.state === 'windup' || PF.state === 'active') && d < PF.w.reach + 1.2;
    // 1. an incoming strike: block it (after the reaction time, and not always)
    if (playerStriking) {
      if (this.sawStrikeAt == null || PF.strikeId !== this.seenStrike) { this.seenStrike = PF.strikeId; this.sawStrikeAt = now; this.willBlock = Math.random() > S.miss && F.st > 8; }   // every new cut is judged again
      if (this.willBlock && now - this.sawStrikeAt >= S.react && F.state !== 'guard' && (!F.busy || (F.state === 'recover' && F.t > 0.1))) { if (F.state === 'recover') F.state = 'idle'; this.plan = []; F.blockDown(now); this.blockUntil = now + 0.8; }
    } else this.sawStrikeAt = null;
    // 2. after a block: counter at once
    if (this.counterNow && F.state === 'guard' && now < F.counterUntil) { this.counterNow = false; F.blockUp(); this.combo(now, 1 + (Math.random() < 0.4 ? 1 : 0)); }
    if (F.state === 'guard' && now > this.blockUntil && !playerStriking) F.blockUp();
    // 3. you hold your block too long: break it with a heavy, or kick you
    if (PF.state === 'guard' && d < reach + 0.5) { if (this.turtleSince == null) this.turtleSince = now; } else this.turtleSince = null;
    if (this.turtleSince != null && now - this.turtleSince > 0.9 && !F.busy && F.state !== 'guard' && Math.random() < S.breakTurtle * dt * 4 && hasToken) {
      this.turtleSince = null;
      if (d < 1.7 && Math.random() < 0.4) F.kick(now); else { F.strikeDown(now); this.holdUntil = now + 0.6; }
    }
    // 4. tired: back off until the breath comes back
    if (F.st < 22 && now > this.retreatUntil) this.retreatUntil = now + 2.2;
    // 5. attack: ready and allowed → close in; in reach → a short combo
    const ready = now > this.nextAttack && now > this.retreatUntil && F.st > 30;
    if (ready && !hasToken) fp.askToken(this);
    if (ready && fp.hasToken(this) && !F.busy && F.state !== 'guard' && d < reach + 0.2) this.combo(now, 1 + Math.floor(Math.random() * 3));
    // a feint on hard: start a cut and turn it into a block
    if (F.state === 'windup' && !F.heavy && F.t > 0.05 && this.feintRoll == null) { this.feintRoll = Math.random() < S.feint; if (this.feintRoll) { F.blockDown(now); this.blockUntil = now + 0.4; } }
    if (F.state !== 'windup') this.feintRoll = null;
    // movement goal: keep the right distance and circle; wait further out without a token
    const attacking = fp.hasToken(this) && (ready || this.plan.length || F.state === 'windup' || F.state === 'active');
    const w = attacking ? reach * 0.7 : hasToken ? want : want + 1.4;
    this.goal = now < this.retreatUntil ? 'back' : d > w + (attacking ? 0.1 : 0.5) ? 'close' : d < w - 0.6 ? 'back' : 'circle';
    this.strafeT -= dt; if (this.strafeT <= 0) { this.strafeT = 1.5 + Math.random() * 2; this.strafe = -this.strafe; }
  }
  combo(now, n) { this.plan = []; for (let i = 0; i < n; i++) this.plan.push(now + i * 0.42); this.nextAttack = now + n * 0.42 + 0.9 + Math.random() * 0.8; }
  thinkArcher(now, d) {
    const F = this.fighter, fp = this.fp;
    // keep 14–30 m away; kick and step back if you come close
    this.goal = d < 12 ? 'back' : d > 32 ? 'close' : 'hold';
    if (d < 1.8 && !F.busy) { F.kick(now); return; }
    if (d > 45) { this.aimT = 0; return; }
    this.shotCd -= 0.12;
    if (this.shotCd <= 0 && fp.canSee(this)) { this.aimT += 0.12; if (this.aimT > 1.1) { this.aimT = 0; this.shotCd = 1.6 + Math.random() * 1.2; fp.actorShoot(this); } }
    else if (this.shotCd <= 0) this.aimT = 0;
  }

  update(dt, now) {
    const fp = this.fp, F = this.fighter, P = fp.player;
    if (this.dead) {
      this.fall = Math.min(1, this.fall + dt * 2.2);
      this.person.group.rotation.x = -1.45 * (1 - Math.pow(1 - this.fall, 3));
      return;
    }
    this.thinkT -= dt; if (this.thinkT <= 0) { this.thinkT = 0.12; this.think(now, 0.12); }
    // run the planned combo; let go of a heavy after its wind-up
    if (this.plan.length && now >= this.plan[0] && F.state !== 'stagger') { this.plan.shift(); if (F.state === 'guard') F.blockUp(); F.strikeDown(now); F.strikeUp(); }
    if (this.holdUntil && now >= this.holdUntil) { this.holdUntil = 0; F.strikeUp(); }
    F.update(dt, now, this.world);
    if (F.state !== 'windup' && F.state !== 'active' && !this.plan.length && !this.holdUntil && fp.hasToken(this) && now > this.nextAttack - 0.6) fp.releaseToken(this);
    // turn to face you, move toward the goal
    const dx = P.x - this.x, dz = P.z - this.z, d = Math.hypot(dx, dz) || 1;
    if (this.aggro) { const want = Math.atan2(dx, dz); this.yaw += clamp(angDiff(want, this.yaw), -7 * dt, 7 * dt); }
    let mx = 0, mz = 0, sp = 0;
    if (this.aggro && F.state !== 'stagger') {
      const ux = dx / d, uz = dz / d;
      if (this.goal === 'close') { mx = ux; mz = uz; sp = this.archer ? 3 : 3.4; }
      else if (this.goal === 'back') { mx = -ux; mz = -uz; sp = 2.2; }
      else if (this.goal === 'circle') { mx = -uz * this.strafe; mz = ux * this.strafe; sp = 1.1; }
      if (F.state === 'guard' || F.state === 'windup' || F.state === 'active') sp = Math.min(sp, 1.4);
    } else if (!this.aggro && this.team === 'spar') {
      const hx = this.home.x - this.x, hz = this.home.z - this.z, hd = Math.hypot(hx, hz);
      if (hd > 0.4) { mx = hx / hd; mz = hz / hd; sp = 2; this.yaw += clamp(angDiff(Math.atan2(hx, hz), this.yaw), -5 * dt, 5 * dt); }
      else this.yaw += clamp(angDiff(this.home.yaw, this.yaw), -3 * dt, 3 * dt);
    }
    const k = 1 - Math.exp(-8 * dt);
    this.vx = lerp(this.vx, mx * sp, k); this.vz = lerp(this.vz, mz * sp, k);
    let nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    if (fp.player.walkable(nx, nz)) { this.x = nx; this.z = nz; }
    [this.x, this.z] = pushOut(this.x, this.z, this.r, fp.T.colliders);
    for (const o of fp.actors) if (o !== this && !o.dead) { const ex = this.x - o.x, ez = this.z - o.z, e = Math.hypot(ex, ez); if (e < 0.75 && e > 1e-3) { this.x += ex / e * (0.75 - e) * 0.5; this.z += ez / e * (0.75 - e) * 0.5; } }
    { const ex = this.x - P.x, ez = this.z - P.z, e = Math.hypot(ex, ez); if (e < 0.7 && e > 1e-3) { this.x = P.x + ex / e * 0.7; this.z = P.z + ez / e * 0.7; } }
    this.speed = Math.hypot(this.vx, this.vz);
    this.y = lerp(this.y, fp.T.groundAt(this.x, this.z), 1 - Math.exp(-15 * dt));
    this.place();
    this.animate(dt);
  }
  // body language: the pose for walking or standing, then the arms for the fight
  animate(dt) {
    const F = this.fighter, pe = this.person, moving = this.speed > 0.4;
    const base = !this.aggro ? this.idlePose : this.archer ? (this.aimT > 0 ? 'shoot' : moving ? 'walk' : 'guard') : moving ? 'walk' : 'guard';
    pe.animate(dt, base, moving ? Math.min(1.6, this.speed / 2.5) : 1);
    if (this.archer || !this.aggro) return;
    const [aL, aR] = pe.arms, t = F.t;
    const set = (a, x, z) => { a.rotation.x = x; a.rotation.y = 0; a.rotation.z = z; };
    // the side a cut comes from, as you see it: 'l' from your left = the tool arm (+x) swings in from outside
    const W = { l: [-2.1, 1.25], r: [-1.9, -1.1], u: [-3.0, 0.1] }, E = { l: [-1.2, -0.7], r: [-1.2, 0.9], u: [-0.9, 0.05] };
    switch (F.state) {
      case 'windup': { const w = W[F.heavy ? 'u' : F.dir], k = Math.min(1, t / 0.18); set(aR, lerp(-0.6, w[0], k), lerp(0, w[1], k)); set(aL, F.heavy ? lerp(-0.4, -2.9, k) : -1.0, F.heavy ? 0 : 0.35); break; }
      case 'active': { const w = W[F.heavy ? 'u' : F.dir], e = E[F.dir], k = Math.min(1, t / F.phase.act); set(aR, lerp(w[0], e[0], k), lerp(w[1], e[1], k)); set(aL, F.heavy ? lerp(-2.9, -0.9, k) : -1.0, 0.3); break; }
      case 'recover': { const e = E[F.dir]; set(aR, e[0], e[1]); set(aL, -0.9, 0.3); break; }
      case 'guard': set(aR, -1.5, -0.55); set(aL, -1.3, 0.45); break;
      case 'kick': set(aR, -0.5, 0.2); set(aL, -0.5, -0.2); pe.legs[1].rotation.x = -1.3 * Math.sin(Math.min(1, t / 0.45) * Math.PI); break;
      case 'stagger': set(aR, -0.3, 0.5); set(aL, -0.3, -0.5); pe.body.rotation.x = -0.25; break;
      default: set(aR, -0.7, 0.1); set(aL, -0.6, 0.2);
    }
  }
  dispose() { this.fp.world.remove(this.person.group); this.person.dispose(); }
}

// Sensei Kenji: stands by the sparring post; F asks him for a bout with wooden swords
export function makeSensei(fp) {
  const Y = fp.T.yard, post = fp.yard.post, dx = post.x - Y.x, dz = post.z - Y.z, L = Math.hypot(dx, dz) || 1;
  const x = Y.x + dx / L * (L - 2.6) - dz / L * 2.2, z = Y.z + dz / L * (L - 2.6) + dx / L * 2.2;
  const a = new Actor(fp, { look: 'sensei', weapon: 'katana', name: 'Sensei Kenji', hp: 120, st: 110, x, z, yaw: Math.atan2(Y.x - x, Y.z - z), team: 'spar', seed: 5, idle: 'idle' });
  a.bokken = true;
  return a;
}

// the bandit camp: across the bridge, at the end of the trail — tents, a fire, stolen rice, and its people
export function buildBanditCamp(fp) {
  const T = fp.T, R = mulberry32(333), end = T.trail[T.trail.length - 1], prev = T.trail[T.trail.length - 6];
  const ax = end.x - prev.x, az = end.z - prev.z, al = Math.hypot(ax, az) || 1;
  // a little further on, where the ground is walkable
  let cx = end.x + ax / al * 14, cz = end.z + az / al * 14;
  for (let i = 0; i < 12 && !fp.player.walkable(cx, cz); i++) { cx -= ax / al * 2; cz -= az / al * 2; }
  const g = new THREE.Group(); fp.world.add(g);
  const m = new Mesher(334, 0.07), gy = (x, z) => T.groundAt(x, z);
  // the fire: a ring of stones, logs, glowing embers
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; m.ball(0.2, '#8a857a', [cx + Math.cos(a) * 0.7, gy(cx, cz) + 0.1, cz + Math.sin(a) * 0.7], [1, 0.7, 1]); }
  for (let i = 0; i < 3; i++) m.cyl(0.08, 0.08, 1.0, 6, '#4a3222', [cx, gy(cx, cz) + 0.18, cz], [Math.PI / 2, i * 1.05, 0]);
  const glow = new Mesher(335, 0.05); glow.ball(0.35, '#ff8a3a', [cx, gy(cx, cz) + 0.25, cz], [1, 0.6, 1]);
  // two tents of patched cloth, a crate, stolen rice bales, a rough fence of stakes
  const tent = (x, z, rot) => {
    const y = gy(x, z), c = Math.cos(rot), s = Math.sin(rot);
    for (const sd of [-1, 1]) m.box(0.04, 2.1, 3.0, sd < 0 ? '#8a7a5a' : '#7a6a4a', [x + c * sd * 0.72, y + 0.75, z - s * sd * 0.72], [0, rot, sd * 0.78]);
    m.box(0.08, 0.08, 3.2, '#3b2619', [x, y + 1.5, z], [0, rot, 0]);
    fp.T.colliders.push({ x, z, hw: 1.3, hd: 1.6, ang: rot });
  };
  tent(cx + 6, cz + 3, 0.4); tent(cx - 5, cz + 5, -0.6);
  m.box(0.8, 0.6, 0.6, '#6b4a33', [cx + 2.5, gy(cx + 2.5, cz - 4) + 0.3, cz - 4]); fp.T.colliders.push({ x: cx + 2.5, z: cz - 4, r: 0.5 });
  for (let i = 0; i < 4; i++) { const bx = cx - 3 + (i % 2) * 0.6, bz = cz - 5 - Math.floor(i / 2) * 0.1; m.cyl(0.25, 0.25, 0.62, 8, '#cdb27a', [bx, gy(bx, bz) + 0.25 + Math.floor(i / 2) * 0.42, bz], [0, 0, Math.PI / 2]); }
  for (let i = 0; i < 14; i++) { const a = -0.9 + i * 0.13, rr = 11, sx = cx + Math.cos(a + Math.atan2(az, ax)) * rr, sz = cz + Math.sin(a + Math.atan2(az, ax)) * rr; m.cyl(0.07, 0.09, 1.6, 5, '#5a3a28', [sx, gy(sx, sz) + 0.6, sz], [0.15 * Math.sin(i), 0, 0.15 * Math.cos(i)]); }
  const mesh = m.mesh(); g.add(mesh); const gm = glow.mesh(MAT.glow, false); g.add(gm);
  // the bandits: three swordsmen round the fire and an archer on watch
  const names = ['Scarred Goro', 'One-eyed Taki', 'Big Hachi', 'Archer Sen'];
  const group = [];
  const spots = [[1.8, 0.6], [-1.6, 1.1], [0.2, -1.9]];
  spots.forEach(([ox, oz], i) => {
    const x = cx + ox, z = cz + oz;
    group.push(new Actor(fp, { look: 'bandit', weapon: 'katana', name: names[i], hp: 75, st: 90, x, z, yaw: Math.atan2(cx - x, cz - z), team: 'foe', seed: 40 + i, idle: i === 2 ? 'guard' : 'sit', aggroRange: 22 }));
  });
  const wx = cx - ax / al * 9 + az / al * 4, wz = cz - az / al * 9 - ax / al * 4;
  group.push(new Actor(fp, { look: 'bandit_archer', weapon: 'yumi', name: names[3], hp: 60, st: 90, x: wx, z: wz, yaw: Math.atan2(-ax, -az), team: 'foe', archer: true, seed: 50, idle: 'guard', aggroRange: 30 }));
  for (const a of group) a.group = group;
  return { root: g, center: { x: cx, z: cz }, actors: group };
}
