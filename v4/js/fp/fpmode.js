// First person: enter the valley as one of your soldiers. This version is the training yard — walk a valley
// with a winding river, cut straw dummies, shoot at the archery targets, and spar with a post that strikes back.
// You can be any kind of soldier (and the two commanders). It plugs into the main loop through views.setView.
import * as THREE from 'three';
import { FPTerrain, FP_ORIGIN } from './terrain.js';
import { FPInput } from './input-fp.js';
import { Player } from './controller.js';
import { Fighter, WEAPONS, ZONES, DIR_NAME } from './combat.js';
import { ViewModel } from './viewmodel.js';
import { buildYard } from './training.js';
import { FPHud } from './hud-fp.js';
import { FPSound } from './sfx-fp.js';
import { Projectiles } from './projectiles.js';
import { CLASSES, ABILITY } from './classes.js';
import { MAT } from '../render/geo.js';
import { clamp } from '../util.js';

const DEFAULTS = { sens: 1, touchSens: 0.45, invert: false, fov: 75, bob: true, cue: true, sound: true, diff: null, time: '0.3', trackpad: false, cls: 'ashigaru', parry: false };
const ZONE_NAME = { head: 'Head', torso: 'Body', legs: 'Legs' };

export class FPMode {
  constructor({ game, stage, hud, views }) {
    this.game = game; this.stage = stage; this.hud0 = hud; this.views = views;
    this.S = { ...DEFAULTS }; try { Object.assign(this.S, JSON.parse(localStorage.getItem('tenka.v4.fp') || '{}')); } catch (_) { /* no storage */ }
    if (!CLASSES[this.S.cls]) this.S.cls = 'ashigaru';
    if (!this.S.diff) this.S.diff = (game.state.settings && game.state.settings.difficulty) || 'normal';
    this.active = false; this.paused = true; this.built = false;
    this.camProxy = { target: new THREE.Vector3() };
    this.resetStats();
    this.tips = 0;
    window.tenkaFP = this;
  }
  resetStats() { this.stats = { blocks: 0, counters: 0, hitsTaken: 0, dodges: 0, lastHit: '—', score: 0, shots: 0, best: '—' }; }
  saveSettings() { try { localStorage.setItem('tenka.v4.fp', JSON.stringify(this.S)); } catch (_) { /* */ } }

  build() {
    const season = this.game.life ? this.game.life.season : 0;
    this.T = new FPTerrain(((this.game.state && this.game.state.seed) || 7) % 9973 + 11);
    this.world = new THREE.Group(); this.world.name = 'fp-world'; this.world.position.copy(FP_ORIGIN);
    this.world.add(this.T.build(season));
    this.yard = buildYard(this.T, this.world, this.S.diff);
    this.T.colliders.push(...this.yard.colliders);
    this.stage.scene.add(this.world);
    this.proj = new Projectiles(this.world);
    this.player = new Player(this.T);
    this.vm = new ViewModel(this.stage.camera);
    this.input = new FPInput(this.stage.renderer.domElement, this.S);
    this.hud = new FPHud(this);
    this.input.buttons(this.hud.root);
    this.input.onUnlock = () => { if (this.active && !this.paused && this.input.device !== 'touch') this.pause(); };
    this.input.onDevice = d => this.hud.setDevice(d);
    this.input.onKeyboard = () => this.hud.root.classList.add('haskeys');
    this.sound = new FPSound(() => { const H = this.hud0; return (H.ac = (H.music && H.music.ctx) || H.ac || new (window.AudioContext || window.webkitAudioContext)()); });
    this.built = true;
    this.setClass(this.S.cls, true);
    this.applySettings(false);
  }
  // become another kind of soldier
  setClass(k, quiet = false) {
    const C = CLASSES[k]; if (!C) return;
    this.cls = k; this.C = C; this.S.cls = k; this.saveSettings();
    this.fighter = new Fighter(C.weapon, { maxHp: C.hp, maxSt: C.st, shield: !!C.shield });
    this.fighter.parryOn = !!this.S.parry; this.fighter.parryWindow = { easy: 0.3, normal: 0.2, hard: 0.15 }[this.S.diff] || 0.2;
    this.player.setClass(C);
    this.vm.setClass(C, MAT.flat);
    this.hud.setClass(C);
    this.arrows = C.arrows || 0; this.kunai = C.kunai || 0; this.abilityReady = 0; this.roar = false;
    this.resetStats();
    if (!quiet) this.hud.message(`${C.name} — ${C.desc}`, 4);
  }

  enter() {
    if (this.active) return;
    if (this.views.mode !== 'village') this.views.toVillage();
    if (!this.built) this.build();
    const cam = this.stage.camera;
    this.prev = { fov: cam.fov, near: cam.near, paused: this.hud0.paused };
    if (this.hud0.input && this.hud0.input.cancelPlacing) this.hud0.input.cancelPlacing();
    this.hud0.paused = true;                                  // the village waits while you're away
    if (!cam.parent) this.stage.scene.add(cam);               // the hands and weapon ride on the camera
    this.vm.attach(); this.world.visible = true;
    document.getElementById('ui').classList.add('mode-fp');
    this.hud.show(true);
    if (document.documentElement.classList.contains('site-mobile')) this.input.setDevice('touch');
    this.hud.setDevice(this.input.device);
    this.input.active = true; this.active = true;
    this.applySettings(false);
    this.views.setView({ active: true, cam: this.camProxy, update: dt => this.update(dt) });
    this.pause();
  }
  exit() {
    if (!this.active) return;
    this.active = false; this.input.active = false; this.input.unlock();
    this.world.visible = false; this.vm.detach();
    const cam = this.stage.camera; cam.fov = this.prev.fov; cam.near = this.prev.near; cam.rotation.set(0, 0, 0); cam.updateProjectionMatrix();
    this.hud0.paused = this.prev.paused;
    document.getElementById('ui').classList.remove('mode-fp');
    this.hud.show(false); this.hud.showPause(false);
    this.views.setView(null);
  }
  pause() { this.paused = true; this.input.unlock(); this.hud.showPause(true); if (this.fighter) { this.fighter.blockUp(); this.fighter.strikeUp(); } }
  resume() {
    this.paused = false; this.hud.showPause(false); this.input.events.length = 0;
    if (this.input.device !== 'touch') this.input.lock();
    if (!this.tips) { this.tips = 1; this.hud.message(this.fighter.isBow ? 'Hold the block button to aim, click to loose.' : 'Click to strike — left, right, left… Hold for a heavy overhead. Hold the other button to block.', 5); }
  }
  respawn() {
    const P = this.player, T = this.T; P.x = T.spawn.x; P.z = T.spawn.z; P.vx = P.vz = 0; P.yaw = Math.atan2(T.yard.x - T.spawn.x, T.yard.z - T.spawn.z) + Math.PI; P.pitch = -0.05;
    const F = this.fighter; F.hp = F.maxHp; F.st = F.maxSt; F.state = 'idle'; this.downT = 0;
    this.resume();
  }
  applySettings(rerender = true) {
    const S = this.S; this.saveSettings();
    if (!this.built) return;
    const cam = this.stage.camera;
    if (this.active) { cam.fov = S.fov; cam.near = 0.05; cam.updateProjectionMatrix(); }
    this.yard.post.setDifficulty(S.diff);
    this.fighter.parryOn = !!S.parry; this.fighter.parryWindow = { easy: 0.3, normal: 0.2, hard: 0.15 }[S.diff] || 0.2;
    this.sound.on = S.sound !== false && !this.hud0.settings.muted;
    this.hud.setDevice(this.input.device);
    if (rerender && !this.hud.pauseEl.hidden) this.hud.renderPause();
  }

  /* ---------- the fight: what your strikes, kicks and missiles reach ---------- */
  targetsInReach(reach, cone) {
    const P = this.player, f = P.fwd, out = [];
    for (const t of this.yard.dummies) {
      const dx = t.x - P.x, dz = t.z - P.z, d = Math.hypot(dx, dz), edge = d - t.r;
      if (edge > reach) continue;
      const ang = Math.acos(clamp((dx * f.x + dz * f.z) / (d || 1), -1, 1));
      if (ang > cone + Math.atan2(t.r, Math.max(0.3, d))) continue;
      out.push({ t, d, dx: dx / (d || 1), dz: dz / (d || 1) });
    }
    return out.sort((a, b) => a.d - b.d);
  }
  strike(F) {
    const now = this.now, P = this.player, W = F.w;
    const roar = F.heavy && this.roar;
    const cone = roar ? Math.PI : F.heavy ? Math.min(W.cone, 0.6) : W.cone, n = roar ? 8 : F.heavy ? (W.heavyHits || W.hits) : W.hits;
    const hits = this.targetsInReach(W.reach + (P.onHorse ? 0.4 : 0), cone);
    if (roar) { this.roar = false; this.hud.message('The roar — everything around you is struck!', 1.6, 'good'); }
    let bonus = 1;
    if (P.onHorse) bonus = 1 + clamp((P.speed - 3) / 7, 0, 1) * 0.8;   // the lance hits harder at a gallop
    for (const { t, d, dx, dz } of hits.slice(0, n)) {
      // where on the body: the height you aim at where the blade meets the target (the overhead comes down high)
      const aimY = P.y + P.eye + Math.tan(P.pitch) * d + (F.heavy ? 0.25 : 0);
      const rel = clamp(aimY - t.y, 0.3, 1.9), zone = rel > 1.48 ? 'head' : rel > 0.85 ? 'torso' : 'legs';
      const dmg = Math.round(F.strikeDamage(now) * ZONES[zone] * bonus);
      const r = t.onHit({ dmg, zone, dir: F.dir, heavy: F.heavy, fx: dx, fz: dz });
      if (!r) continue;
      if (F.lastBonus.startsWith('counter')) this.stats.counters++;
      this.sound.play(r.sound || 'thud', F.heavy ? 1.2 : 1);
      if (r.chaff) this.yard.chaff.burst(t.x, t.y + rel, t.z, r.chaff, dx, dz);
      this.stats.lastHit = `${ZONE_NAME[zone]} · ${dmg}${F.lastBonus ? ` (${F.lastBonus})` : ''}${F.heavy ? ' heavy' : ''}${bonus > 1.05 ? ` charge ×${bonus.toFixed(1)}` : ''}`;
      if (r.text) this.hud.message(r.text, 2.6);
      this.vm.shake = Math.max(this.vm.shake, F.heavy ? 0.45 : 0.25);
    }
  }
  kick() {
    const hits = this.targetsInReach(1.7, 0.6);
    this.sound.play('whiff', 0.5);
    for (const { t, dx, dz } of hits.slice(0, 1)) {
      const r = t.onKick({ fx: dx, fz: dz }); if (!r) continue;
      this.sound.play(r.sound || 'kick'); if (r.chaff) this.yard.chaff.burst(t.x, t.y + 1, t.z, r.chaff, dx, dz); if (r.text) this.hud.message(r.text, 2.4);
    }
  }
  // your eye and the direction you look, in the valley's local metres
  aim() {
    const P = this.player, cp = Math.cos(P.pitch), f = P.fwd;
    return { pos: new THREE.Vector3(P.x, P.y + P.eye, P.z), dir: new THREE.Vector3(f.x * cp, Math.sin(P.pitch), f.z * cp).normalize() };
  }
  // loose an arrow: the fuller the draw, the faster and harder it flies; a quick shot from the hip scatters
  shoot(F, power, quick) {
    if (this.arrows <= 0) { this.hud.message('No arrows left — refill them at the armoury by the gate (F).', 2.4, 'bad'); this.sound.play('tired'); return false; }
    this.arrows--; this.stats.shots++;
    const { pos, dir } = this.aim(), P = this.player, r = P.right;
    const spread = quick ? 0.035 : 0.0012 + (1 - power) * 0.02;   // a full draw is very accurate
    dir.x += (Math.random() - 0.5) * spread * 2; dir.y += (Math.random() - 0.5) * spread * 2; dir.z += (Math.random() - 0.5) * spread * 2; dir.normalize();
    pos.x += dir.x * 0.5; pos.y += -0.03 + dir.y * 0.5; pos.z += dir.z * 0.5;   // from the eye line, so it goes where the crosshair is
    const p = this.proj.fire('arrow', pos, dir.multiplyScalar(30 + 80 * power)); p.dmg = Math.round(10 + 38 * power); p.grav = 0.5;   // fast and flat: a longbow
    this.sound.play('swish', 0.7);
    return true;
  }
  throwKunai() {
    if (this.kunai <= 0) { this.hud.message('No kunai left — the armoury by the gate has more (F).', 2.2, 'bad'); return; }
    this.kunai--;
    const { pos, dir } = this.aim(); pos.addScaledVector(dir, 0.5); pos.y -= 0.1;
    const p = this.proj.fire('kunai', pos, dir.multiplyScalar(30)); p.dmg = 22;
    this.sound.play('swish', 0.6);
  }
  // an arrow or kunai: did it meet a target, a dummy, or the sparring post along from→to?
  projHit(p, a, b) {
    for (const t of this.yard.targets) {
      const r = t.test(a, b); if (!r) continue;
      const s = t.score(r.dist); this.stats.score += s;
      if (this.stats.best === '—' || s > +this.stats.best) this.stats.best = String(s);
      this.hud.message(s === 10 ? 'Bullseye! 10' : `${s} points`, 1.6, s >= 7 ? 'good' : '');
      this.sound.play('thud', 0.7);
      return { at: r.at, stick: true };
    }
    for (const t of this.yard.dummies) {
      // the step against the target's upright capsule (on the ground plan, then the height)
      const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1e-6, k = clamp(((t.x - a.x) * dx + (t.z - a.z) * dz) / L2, 0, 1);
      const cx = a.x + dx * k, cz = a.z + dz * k, cy = a.y + (b.y - a.y) * k;
      if (Math.hypot(cx - t.x, cz - t.z) > t.r + 0.06 || cy < t.y + 0.1 || cy > t.y + t.h + 0.1) continue;
      const rel = cy - t.y, zone = rel > 1.48 ? 'head' : rel > 0.85 ? 'torso' : 'legs', dmg = Math.round((p.dmg || 20) * ZONES[zone]);
      const L = Math.sqrt(L2), r = t.onHit({ dmg, zone, dir: 'u', heavy: false, fx: dx / L, fz: dz / L });
      if (r) { this.sound.play('thud', 0.8); if (r.chaff) this.yard.chaff.burst(cx, cy, cz, 5, dx / L, dz / L); this.stats.lastHit = `${ZONE_NAME[zone]} · ${dmg} (${p.kind})`; if (r.text) this.hud.message(r.text, 2.4); }
      return { at: new THREE.Vector3(cx, cy, cz), stick: true };
    }
    return null;
  }
  // G: the class's special ability
  ability(now) {
    const C = this.C, F = this.fighter; if (!C.ability) return;
    if (C.ability === 'kunai') { if (now >= this.abilityReady) { this.throwKunai(); this.abilityReady = now + ABILITY.kunai.cd; } return; }
    if (now < this.abilityReady) { this.hud.message(`${ABILITY[C.ability].name} is ready again in ${Math.ceil(this.abilityReady - now)} s`, 1.4); return; }
    this.abilityReady = now + ABILITY[C.ability].cd;
    if (C.ability === 'prayer') { F.heal(35); this.sound.play('bell'); this.hud.flash('parry'); this.hud.message('A prayer — your wounds close (+35 health).', 2.2, 'good'); }
    if (C.ability === 'roar') { this.roar = true; this.sound.play('hurt', 1.4); this.hud.message('A war roar! Your next heavy strike hits everything around you.', 2.4, 'good'); }
    if (C.ability === 'rally') { F.st = F.maxSt; F.buffUntil = now + 8; this.sound.play('bell'); this.hud.message('Rally! Full stamina and +25% damage for 8 seconds.', 2.4, 'good'); }
  }
  // the sparring post swings at you
  enemyStrike(post, a) {
    const now = this.now, P = this.player, F = this.fighter;
    if (P.dodgeT > 0 || (P.dodgedAt != null && now - P.dodgedAt < 0.3)) { this.stats.dodges++; this.sound.play('whiff'); this.hud.message('Dodged!', 1.2, 'good'); return; }
    const dx = post.x - P.x, dz = post.z - P.z, d = Math.hypot(dx, dz) || 1, f = P.fwd;
    const angle = Math.acos(clamp((dx * f.x + dz * f.z) / d, -1, 1));
    const res = F.receive({ ...a, angle }, now); this.lastRes = res;
    if (res === 'parry') { post.parried(); this.sound.play('parry'); this.hud.flash('parry'); this.hud.message('Parried! Your next strike does double damage.', 2.2, 'good'); }
    else if (res === 'block') { this.stats.blocks++; this.sound.play(F.shield ? 'block' : 'clash'); this.vm.shake = 0.35; this.hud.message('Blocked — strike back now for ×1.5!', 1.4, 'good'); }
    else if (res === 'break') { this.sound.play('clash'); this.sound.play('hurt'); this.hud.hurt(0.5); this.hud.message(a.heavy ? 'A heavy strike breaks any block — dodge those (Space).' : 'Out of breath — your block broke. Watch your stamina.', 3, 'bad'); this.stats.hitsTaken++; }
    else {
      this.stats.hitsTaken++; this.sound.play('hurt'); this.hud.hurt(0.9); this.vm.shake = 0.6;
      if (res === 'down') this.hud.message('You are down. Getting back up…', 3, 'bad');
      else if (F.state === 'guard' || F.blockHeld) this.hud.message('It came from the side — face your opponent to block.', 2.4, 'bad');
      else this.hud.message(a.heavy ? 'Heavy strike — dodge those (Space).' : 'Hit! Hold block when the ring turns red.', 2.4, 'bad');
    }
  }

  update(dt) {
    // the fight runs on its own clock, which stops while paused
    if (!this.paused) this.clock = (this.clock || 0) + dt;
    const now = this.now = this.clock || 0, P = this.player, F = this.fighter, I = this.input;
    const tod = this.S.time === 'village' ? this.game.state.time : +this.S.time;
    this.stage.setTime(tod);
    const post = this.yard.post;
    if (!this.paused) {
      for (const ev of I.events) {
        if (ev.t === 'strikeDown') F.strikeDown(now);
        else if (ev.t === 'strikeUp') F.strikeUp();
        else if (ev.t === 'blockDown') F.blockDown(now);
        else if (ev.t === 'blockUp') F.blockUp();
        else if (ev.t === 'pause') this.pause();
      }
      I.events.length = 0;
      P.look(I.look.x * (F.state === 'aim' ? 0.6 : 1), I.look.y * (F.state === 'aim' ? 0.6 : 1));
      if (I.hit('KeyC') && !P.onHorse) P.crouch = !P.crouch;
      if (I.hit('KeyE')) { if (F.kick(now)) this.sound.play('whiff', 0.4); }
      if (I.hit('KeyF')) this.use();
      if (I.hit('KeyG')) this.ability(now);
      const before = F.state;
      P.update(dt, I.move(), { run: I.down('ShiftLeft') || I.down('ShiftRight') || I.touchRun, dodge: I.hit('Space'), fighter: F, now });
      if (P.justDodged) { P.dodgedAt = now; this.sound.play('whiff', 0.6); P.justDodged = false; }
      F.update(dt, now, this);
      if (before === 'windup' && F.state === 'active') this.sound.play(F.heavy ? 'swishHeavy' : 'swish');
      if (F.flash && F.flash.kind === 'tired' && now - F.flash.t < 0.05) { this.sound.play('tired'); this.hud.message('Out of breath — wait a moment.', 1.4, 'bad'); F.flash = null; }
      if (F.state === 'down') { this.downT = (this.downT || 0) + dt; if (this.downT > 3) { this.respawn(); this.hud.message('Back on your feet. Block when the ring turns red.', 3); } }
      // the dummies, the sparring post, the straw, the arrows
      for (const t of this.yard.dummies) if (t !== post) t.update(dt);
      post.update(dt, { px: P.x, pz: P.z, showCue: true, strike: (p, a) => this.enemyStrike(p, a), whiff: () => {} });
      this.yard.chaff.update(dt);
      this.proj.update(dt, (p, a, b) => this.projHit(p, a, b), (x, z) => this.T.groundAt(x, z));
      // footsteps (hoofbeats on a horse)
      P.stepT += P.speed * dt;
      if (P.stepT > (P.onHorse ? 1.9 : P.speed > 5 ? 1.6 : 1.3)) { P.stepT = 0; this.sound.play(P.wet > 0.05 ? 'splash' : P.onBridge ? 'stepWood' : 'step', P.crouch ? 0.4 : P.onHorse ? 1.6 : 1); }
      // what's close enough to use
      const rk = this.yard.rack, nearRack = Math.hypot(rk.x - P.x, rk.z - P.z) < 3;
      const dP = Math.hypot(post.x - P.x, post.z - P.z);
      this.hud.setPrompt(nearRack ? `${I.device === 'touch' ? 'USE' : 'F'} — the armoury: change soldier${this.C.arrows || this.C.kunai ? ', refill' : ''}` : dP < 5 && post.state === 'idle' && dP > 3.2 && !F.isBow ? 'Step closer to the sparring post to spar' : '');
      const rows = F.isBow ? [['Arrows', `${this.arrows} / ${this.C.arrows}`], ['Shots', this.stats.shots], ['Score', this.stats.score], ['Best', this.stats.best], ['Last hit', this.stats.lastHit]]
        : [['Last hit', this.stats.lastHit], ['Blocks', this.stats.blocks], ['Counters', this.stats.counters], ['Dodged', this.stats.dodges], ['Hits taken', this.stats.hitsTaken]];
      if (this.C.kunai) rows.push(['Kunai', `${this.kunai} / ${this.C.kunai}`]);
      if (this.C.ability && this.C.ability !== 'kunai') rows.push([ABILITY[this.C.ability].name, now >= this.abilityReady ? 'ready (G)' : `${Math.ceil(this.abilityReady - now)} s`]);
      this.hud.setCard(`${this.C.name} · training yard`, rows);
    } else I.events.length = 0;
    this.T.update(dt);
    // the camera: your eyes, with a little bob and a jolt when hit; bows zoom in a little as you draw
    const cam = this.stage.camera, bob = this.S.bob !== false ? Math.sin(this.vm.bob * 2) * (P.onHorse ? 0.06 : 0.03) * Math.min(1, P.speed / 4) : 0;
    const sh = this.S.bob !== false ? this.vm.shake * 0.02 : 0;
    cam.position.set(FP_ORIGIN.x + P.x, P.y + P.eye + bob, FP_ORIGIN.z + P.z);
    cam.rotation.set(P.pitch + (Math.random() - 0.5) * sh, P.yaw + (Math.random() - 0.5) * sh, 0, 'YXZ');
    const fov = this.S.fov - (F.state === 'aim' ? F.draw * 18 : 0);
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 10); cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
    this.camProxy.target.set(FP_ORIGIN.x + P.x, P.y, FP_ORIGIN.z + P.z);
    this.vm.arrowsLeft = this.arrows;
    this.vm.update(dt, F, { speed: P.speed, bobScale: this.S.bob !== false ? 1 : 0, turnX: I.look.x, turnY: I.look.y });
    const dP = Math.hypot(post.x - P.x, post.z - P.z), coming = this.S.cue !== false && post.state === 'tell' && dP < 4;
    const nextSide = now - F.lastStrikeEnd > 1.1 ? 'l' : F.combo % 2 ? 'r' : 'l';
    this.hud.update(dt, F, { nextSide, incoming: coming && !post.heavy, incomingHeavy: coming && post.heavy, now,
      ammo: F.isBow ? `arrows ${this.arrows}` : this.C.kunai ? `kunai ${this.kunai}` : '' });
    I.endFrame();
  }
  use() {
    const P = this.player, rk = this.yard.rack;
    if (Math.hypot(rk.x - P.x, rk.z - P.z) < 3) {
      const refill = (this.C.arrows && this.arrows < this.C.arrows) || (this.C.kunai && this.kunai < this.C.kunai);
      if (refill) { this.arrows = this.C.arrows || 0; this.kunai = this.C.kunai || 0; this.sound.play('stepWood'); this.hud.message('Refilled.', 1.2); }
      else this.pause();    // the armoury: choose who to be
    }
  }
}
export { WEAPONS, DIR_NAME };
