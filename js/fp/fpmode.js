// First person: enter the valley as one of your soldiers. This first version is the training yard —
// walk, run, crouch and dodge through a valley with a winding river, cut straw dummies, and learn to block
// and parry against a sparring post. It plugs into the main loop through views.setView like the map does.
import * as THREE from 'three';
import { FPTerrain, FP_ORIGIN } from './terrain.js';
import { FPInput } from './input-fp.js';
import { Player } from './controller.js';
import { Fighter, WEAPONS, ZONES, DIR_NAME } from './combat.js';
import { ViewModel } from './viewmodel.js';
import { buildYard } from './training.js';
import { FPHud } from './hud-fp.js';
import { FPSound } from './sfx-fp.js';
import { MAT } from '../render/geo.js';
import { LOOKS } from '../render/people.js';
import { clamp } from '../util.js';

const DEFAULTS = { sens: 1, touchSens: 0.45, invert: false, fov: 75, bob: true, autoGuard: null, cue: true, sound: true, diff: null, time: '0.3', trackpad: false };
const ZONE_NAME = { head: 'Head', torso: 'Body', legs: 'Legs' };

export class FPMode {
  constructor({ game, stage, hud, views }) {
    this.game = game; this.stage = stage; this.hud0 = hud; this.views = views;
    this.S = { ...DEFAULTS }; try { Object.assign(this.S, JSON.parse(localStorage.getItem('tenka.fp') || '{}')); } catch (_) { /* no storage */ }
    if (!this.S.diff) this.S.diff = (game.state.settings && game.state.settings.difficulty) || 'normal';
    this.active = false; this.paused = true; this.built = false;
    this.camProxy = { target: new THREE.Vector3() };
    this.stats = { parries: 0, blocks: 0, hitsTaken: 0, dodges: 0, lastHit: '—' };
    this.tips = 0;
    window.tenkaFP = this;
  }
  get autoGuard() { return this.S.autoGuard != null ? this.S.autoGuard : this.input && this.input.device === 'touch'; }
  saveSettings() { try { localStorage.setItem('tenka.fp', JSON.stringify(this.S)); } catch (_) { /* */ } }

  build() {
    const season = this.game.life ? this.game.life.season : 0;
    this.T = new FPTerrain(((this.game.state && this.game.state.seed) || 7) % 9973 + 11);
    this.world = new THREE.Group(); this.world.name = 'fp-world'; this.world.position.copy(FP_ORIGIN);
    this.world.add(this.T.build(season));
    this.yard = buildYard(this.T, this.world, this.S.diff);
    this.T.colliders.push(...this.yard.colliders);
    this.stage.scene.add(this.world);
    this.player = new Player(this.T);
    this.fighter = new Fighter('yari');
    this.vm = new ViewModel(this.stage.camera, LOOKS.ashigaru.robe[0]);
    this.vm.setWeapon('yari', MAT.flat);
    this.input = new FPInput(this.stage.renderer.domElement, this.S);
    this.hud = new FPHud(this);
    this.input.buttons(this.hud.root);
    this.input.onUnlock = () => { if (this.active && !this.paused && this.input.device !== 'touch') this.pause(); };
    this.input.onDevice = d => { this.hud.setDevice(d); this.hud.root.classList.toggle('touch', d === 'touch'); };
    this.input.onKeyboard = () => this.hud.root.classList.add('haskeys');
    this.sound = new FPSound(() => { const H = this.hud0; return (H.ac = (H.music && H.music.ctx) || H.ac || new (window.AudioContext || window.webkitAudioContext)()); });
    this.built = true;
    this.applySettings(false);
  }

  enter() {
    if (this.active) return;
    if (this.views.mode !== 'village') this.views.toVillage();
    if (!this.built) this.build();
    const cam = this.stage.camera;
    this.prev = { fov: cam.fov, near: cam.near, paused: this.hud0.paused };
    this.hud0.input && this.hud0.input.cancelPlacing && this.hud0.input.cancelPlacing();
    this.hud0.paused = true;                                  // the village waits while you're away
    if (!cam.parent) this.stage.scene.add(cam);               // the hands and weapon ride on the camera
    this.vm.attach(); this.world.visible = true;
    document.getElementById('ui').classList.add('mode-fp');
    this.hud.show(true); this.hud.setDevice(document.documentElement.classList.contains('site-mobile') ? 'touch' : this.input.device);
    if (document.documentElement.classList.contains('site-mobile')) this.input.setDevice('touch');
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
  pause() { this.paused = true; this.input.unlock(); this.hud.showPause(true); this.fighter.blockUp(); this.fighter.strikeUp(); }
  resume() {
    this.paused = false; this.hud.showPause(false); this.input.events.length = 0;
    if (this.input.device !== 'touch') this.input.lock();
    if (!this.tips) { this.tips = 1; this.hud.message(this.input.device === 'touch' ? 'Swipe off STRIKE to choose the side of your strike. Hold BLOCK to guard.' : 'Move the mouse left, up or right just before you click — that is the side you strike from.', 5); }
  }
  respawn() {
    const P = this.player, T = this.T; P.x = T.spawn.x; P.z = T.spawn.z; P.vx = P.vz = 0; P.yaw = Math.atan2(T.yard.x - T.spawn.x, T.yard.z - T.spawn.z) + Math.PI; P.pitch = -0.05;
    const F = this.fighter; F.hp = F.maxHp; F.st = F.maxSt; F.state = 'idle'; this.downT = 0;
    this.resume();
  }
  setWeapon(k) { this.fighter.setWeapon(k); this.vm.setWeapon(k, MAT.flat); this.hud.message(`${WEAPONS[k].name}: ${WEAPONS[k].desc}`, 3.5); }
  applySettings(rerender = true) {
    const S = this.S; this.saveSettings();
    if (!this.built) return;
    const cam = this.stage.camera;
    if (this.active) { cam.fov = S.fov; cam.near = 0.05; cam.updateProjectionMatrix(); }
    this.yard.post.setDifficulty(S.diff);
    this.fighter.parryWindow = { easy: 0.3, normal: 0.2, hard: 0.15 }[S.diff] || 0.2;
    this.sound.on = S.sound !== false && !this.hud0.settings.muted;
    this.hud.setDevice(this.input.device);
    if (rerender && !this.hud.pauseEl.hidden) this.hud.renderPause();
  }

  /* ---------- the fight: what your strikes and kicks reach ---------- */
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
    const now = this.now, P = this.player, hits = this.targetsInReach(F.w.reach, F.w.cone[F.dir] + (F.heavy ? 0.1 : 0));
    const n = F.heavy && F.wk === 'katana' && F.dir !== 'u' ? 2 : 1;
    let any = false;
    for (const { t, d, dx, dz } of hits.slice(0, n)) {
      // where on the body: from the height you're aiming at, where the blade meets the target
      const aimY = P.y + P.eye + Math.tan(P.pitch) * d - (F.dir === 'u' ? -0.25 : 0);
      const rel = clamp(aimY - t.y, 0.3, 1.9), zone = rel > 1.48 ? 'head' : rel > 0.85 ? 'torso' : 'legs';
      const dmg = Math.round(F.strikeDamage(now) * ZONES[zone]);
      const r = t.onHit({ dmg, zone, dir: F.dir, heavy: F.heavy, fx: dx, fz: dz });
      if (!r) continue;
      any = true;
      this.sound.play(r.sound || 'thud', F.heavy ? 1.2 : 1);
      if (r.chaff) this.yard.chaff.burst(t.x, t.y + rel, t.z, r.chaff, dx, dz);
      this.stats.lastHit = `${ZONE_NAME[zone]} · ${dmg}${F.lastRiposte ? ' (riposte ×2)' : ''}${F.heavy ? ' heavy' : ''}`;
      if (r.text) this.hud.message(r.text, 2.6);
      this.vm.shake = Math.max(this.vm.shake, 0.25);
    }
    if (!any && !hits.length) { /* a clean miss — the swish said it all */ }
  }
  kick() {
    const hits = this.targetsInReach(1.7, 0.6);
    this.sound.play('whiff', 0.5);
    for (const { t, dx, dz } of hits.slice(0, 1)) {
      const r = t.onKick({ fx: dx, fz: dz }); if (!r) continue;
      this.sound.play(r.sound || 'kick'); if (r.chaff) this.yard.chaff.burst(t.x, t.y + 1, t.z, r.chaff, dx, dz); if (r.text) this.hud.message(r.text, 2.4);
    }
  }
  // the sparring post swings at you
  enemyStrike(post, a) {
    const now = this.now, P = this.player, F = this.fighter;
    if (P.dodgeT > 0 || P.justDodged && now - this.dodgeAt < 0.3) { this.stats.dodges++; this.sound.play('whiff'); this.hud.message('Dodged!', 1.2, 'good'); return; }
    const dx = post.x - P.x, dz = post.z - P.z, d = Math.hypot(dx, dz) || 1, f = P.fwd, front = (dx * f.x + dz * f.z) / d > 0.35;
    const res = F.receive({ ...a, front }, now, { autoGuard: this.autoGuard }); this.lastRes = res;
    if (res === 'parry') {
      post.parried(); this.stats.parries++; this.sound.play('parry'); this.hud.flash('parry');
      this.hud.message('Parried! Strike back now — your next strike does double damage.', 2.4, 'good');
    } else if (res === 'block') { this.stats.blocks++; this.sound.play('clash'); this.vm.shake = 0.35; }
    else if (res === 'break') { this.sound.play('clash'); this.sound.play('hurt'); this.hud.hurt(0.5); this.hud.message(a.heavy ? 'A heavy strike breaks any guard — parry it at the last moment, or dodge (Space).' : 'Out of breath — your guard broke. Watch your stamina.', 3.2, 'bad'); this.stats.hitsTaken++; }
    else {
      this.stats.hitsTaken++; this.sound.play('hurt'); this.hud.hurt(0.9); this.vm.shake = 0.6;
      if (res === 'down') this.hud.message('You are down. Getting back up…', 3, 'bad');
      else if (!front) this.hud.message('Hit from behind — face your opponent to block.', 2.4, 'bad');
      else this.hud.message(F.state === 'guard' || F.blockHeld ? `Wrong side — that one came from the ${DIR_NAME[a.dir]}.` : `Hit from the ${DIR_NAME[a.dir]} — hold block on that side.`, 2.4, 'bad');
    }
  }

  update(dt) {
    // the fight runs on its own clock, which stops while paused (parry windows stay fair after a pause or a slow frame)
    if (!this.paused) this.clock = (this.clock || 0) + dt;
    const now = this.now = this.clock || 0, P = this.player, F = this.fighter, I = this.input;
    // the time of day: fixed for training, or the village's own
    const tod = this.S.time === 'village' ? this.game.state.time : +this.S.time;
    this.stage.setTime(tod);
    if (!this.paused) {
      for (const ev of I.events) {
        if (ev.t === 'strikeDown') { F.strikeDown(ev.dir, now); }
        else if (ev.t === 'strikeUp') F.strikeUp();
        else if (ev.t === 'blockDown') F.blockDown(this.autoGuard ? F.guardDir : ev.dir, now);
        else if (ev.t === 'blockUp') F.blockUp();
        else if (ev.t === 'pause') this.pause();
      }
      I.events.length = 0;
      if (F.state === 'guard' && !this.autoGuard) F.guardDir = I.guardDir();
      if (F.state === 'guard' && this.autoGuard) { const p = this.yard.post; F.guardDir = p.state === 'tell' || p.state === 'swing' ? p.dir : F.guardDir; }
      P.look(I.look.x, I.look.y);
      if (I.hit('KeyC')) P.crouch = !P.crouch;
      if (I.hit('KeyE')) { if (F.kick(now)) this.sound.play('whiff', 0.4); }
      if (I.hit('KeyF')) this.use();
      const before = F.state;
      P.justDodged = false;
      P.update(dt, I.move(), { run: I.down('ShiftLeft') || I.down('ShiftRight') || I.touchRun, dodge: I.hit('Space'), fighter: F, now });
      if (P.justDodged) { this.dodgeAt = now; this.sound.play('whiff', 0.6); }
      F.update(dt, now, this);
      if (before === 'windup' && F.state === 'active') this.sound.play(F.heavy ? 'swishHeavy' : 'swish');
      if (F.flash && F.flash.kind === 'tired' && now - F.flash.t < 0.05) { this.sound.play('tired'); this.hud.message('Out of breath — wait a moment.', 1.4, 'bad'); F.flash = null; }
      if (F.flash && F.flash.kind === 'feint' && now - F.flash.t < 0.05) { this.hud.message('Feint!', 0.8); F.flash = null; }
      // down: get back up at the start of the yard
      if (F.state === 'down') { this.downT = (this.downT || 0) + dt; if (this.downT > 3) { this.respawn(); this.hud.message('Back on your feet. Guard the side the red light shows.', 3); } }
      // the dummies and the sparring post
      const post = this.yard.post, dP = Math.hypot(post.x - P.x, post.z - P.z);
      for (const t of this.yard.dummies) if (t !== post) t.update(dt);
      post.update(dt, { px: P.x, pz: P.z, showCue: this.S.cue !== false, strike: (p, a) => this.enemyStrike(p, a), whiff: () => {} });
      this.yard.chaff.update(dt);
      // footsteps
      P.stepT += P.speed * dt;
      if (P.stepT > (P.speed > 5 ? 1.6 : 1.3)) { P.stepT = 0; this.sound.play(P.wet > 0.05 ? 'splash' : P.onBridge ? 'stepWood' : 'step', P.crouch ? 0.4 : 1); }
      // what's close enough to use
      const rk = this.yard.rack, nearRack = Math.hypot(rk.x - P.x, rk.z - P.z) < 2.4;
      const other = F.wk === 'yari' ? 'katana' : 'yari';
      this.hud.setPrompt(nearRack ? `${I.device === 'touch' ? 'USE' : 'F'} — take the ${WEAPONS[other].name}` : dP < 5 && post.state === 'idle' && dP > 3.2 ? 'Step closer to the sparring post to spar' : '');
      this.hud.setCard('Training yard', [['Weapon', WEAPONS[F.wk].name], ['Last hit', this.stats.lastHit], ['Parries', this.stats.parries], ['Blocks', this.stats.blocks], ['Dodged', this.stats.dodges], ['Hits taken', this.stats.hitsTaken]]);
    } else I.events.length = 0;
    this.T.update(dt);
    // the camera: your eyes, with a little bob and a jolt when hit
    const cam = this.stage.camera, bob = this.S.bob !== false ? Math.sin(this.vm.bob * 2) * 0.03 * Math.min(1, P.speed / 4) : 0;
    const sh = this.S.bob !== false ? this.vm.shake * 0.02 : 0;
    cam.position.set(FP_ORIGIN.x + P.x, P.y + P.eye + bob, FP_ORIGIN.z + P.z);
    cam.rotation.set(P.pitch + (Math.random() - 0.5) * sh, P.yaw + (Math.random() - 0.5) * sh, 0, 'YXZ');
    cam.updateMatrixWorld();
    this.camProxy.target.set(FP_ORIGIN.x + P.x, P.y, FP_ORIGIN.z + P.z);
    this.vm.update(dt, F, { speed: P.speed, bobScale: this.S.bob !== false ? 1 : 0, turnX: I.look.x, turnY: I.look.y });
    const post = this.yard.post, dP = Math.hypot(post.x - P.x, post.z - P.z);
    this.hud.update(dt, F, { aimDir: I.device === 'touch' ? I.dir : I.motionDir(), incoming: this.S.cue !== false && (post.state === 'tell') && dP < 4 ? post.dir : null, now });
    I.endFrame();
  }
  use() {
    const P = this.player, rk = this.yard.rack;
    if (Math.hypot(rk.x - P.x, rk.z - P.z) < 2.4) this.setWeapon(this.fighter.wk === 'yari' ? 'katana' : 'yari');
  }
}
