// First-person input for the three setups: keyboard + mouse, keyboard + trackpad, keyboard + touchscreen.
// The keyboard always does the same (physical key positions, so QWERTZ and AZERTY keyboards work too).
// Pointer devices only look, strike and block. The last device used wins.
import { h } from '../util.js';

const clampLook = v => Math.max(-60, Math.min(60, v));

export class FPInput {
  constructor(canvas, settings) {
    this.cv = canvas; this.S = settings;
    this.keys = new Set(); this.pressed = new Set();
    this.device = 'mouse';
    this.look = { x: 0, y: 0 };
    this.motion = [];             // recent pointer movement, for the strike direction
    this.dir = 'r';               // the last strike / guard direction ('l' | 'r' | 'u')
    this.events = [];             // strikeDown / strikeUp / blockDown / blockUp …
    this.touchMove = { x: 0, y: 0 };
    this.active = false;
    this.locked = false;
    this._on = [];
    const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); this._on.push([t, ev, fn, opt]); };
    on(window, 'keydown', e => this.key(e, true), true);
    on(window, 'keyup', e => this.key(e, false), true);
    on(document, 'pointerlockchange', () => { this.locked = document.pointerLockElement === this.cv; if (!this.locked && this.active && this.onUnlock) this.onUnlock(); });
    on(window, 'mousemove', e => this.mouseMove(e));
    on(canvas, 'mousedown', e => this.mouseButton(e, true));
    on(window, 'mouseup', e => this.mouseButton(e, false));
    on(canvas, 'contextmenu', e => { if (this.active) e.preventDefault(); });
    on(canvas, 'pointerdown', e => this.touchDown(e));
    on(window, 'pointermove', e => this.touchDrag(e));
    on(window, 'pointerup', e => this.touchUp(e));
    on(window, 'pointercancel', e => this.touchUp(e));
    on(canvas, 'wheel', e => { if (this.active) { e.preventDefault(); this.events.push({ t: 'wheel', d: Math.sign(e.deltaY) }); } }, { passive: false });
  }
  dispose() { for (const [t, ev, fn, opt] of this._on) t.removeEventListener(ev, fn, opt); }

  setDevice(d) { if (this.device !== d) { this.device = d; if (this.onDevice) this.onDevice(d); } }
  /* ---------- keyboard ---------- */
  key(e, down) {
    if (!this.active) return;
    const tag = e.target && e.target.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const c = e.code;
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace'].includes(c) || (e.key && e.key.length === 1)) e.preventDefault();
    e.stopPropagation();   // the village's hotkeys stay quiet while you're in first person
    if (down) { if (!this.keys.has(c)) this.pressed.add(c); this.keys.add(c); } else this.keys.delete(c);
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(c) && this.onKeyboard) this.onKeyboard();
    // keyboard backups for fighting: J / I / L strike from the left / overhead / right, K blocks
    const dirKey = { KeyJ: 'l', KeyI: 'u', KeyL: 'r' }[c];
    if (dirKey && !e.repeat) { if (down) { this.dir = dirKey; this.events.push({ t: 'strikeDown', dir: dirKey }); } else this.events.push({ t: 'strikeUp' }); }
    if (c === 'KeyK' && !e.repeat) this.events.push({ t: down ? 'blockDown' : 'blockUp', dir: this.dir });
    if (c === 'Escape' && down) this.events.push({ t: 'pause' });
  }
  down(c) { return this.keys.has(c); }
  hit(c) { return this.pressed.has(c); }
  // movement from the keyboard (W A S D / arrows) or the touch stick
  move() {
    let x = 0, z = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) z += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) z -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    x += this.touchMove.x; z += this.touchMove.y;
    const L = Math.hypot(x, z); if (L > 1) { x /= L; z /= L; }
    return { x, z };
  }

  /* ---------- mouse and trackpad ---------- */
  lock() { if (this.cv.requestPointerLock && !this.locked) { try { const p = this.cv.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* not allowed */ } } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  mouseMove(e) {
    if (!this.active || e.pointerType === 'touch' || this.touching) return;
    // without pointer lock (e.g. a browser that can't lock), looking only works while a button is held
    if (!this.locked && !e.buttons) return;
    const dx = clampLook(e.movementX || 0), dy = clampLook(e.movementY || 0);
    if (dx || dy) this.setDevice('mouse');
    this.look.x += dx * this.S.sens; this.look.y += dy * this.S.sens * (this.S.invert ? -1 : 1);
    this.motion.push({ t: performance.now(), dx, dy });
    this.trimMotion();
  }
  trimMotion() { const t = performance.now() - 180; while (this.motion.length && this.motion[0].t < t) this.motion.shift(); }
  // which way the pointer was moving just now: left, right or up (a downward chop counts as overhead)
  motionDir() {
    this.trimMotion(); let x = 0, y = 0; for (const m of this.motion) { x += m.dx; y += m.dy; }
    if (Math.abs(x) < 6 && Math.abs(y) < 6) return this.dir;
    if (Math.abs(x) > Math.abs(y) * 0.9) return x < 0 ? 'l' : 'r';
    return 'u';
  }
  mouseButton(e, down) {
    if (!this.active || this.touching) return;
    if (down && !this.locked) { this.lock(); if (this.cv.requestPointerLock) return; }   // the first click only captures the mouse
    this.setDevice('mouse');
    if (e.button === 0) { if (down) { this.dir = this.motionDir(); this.events.push({ t: 'strikeDown', dir: this.dir }); } else this.events.push({ t: 'strikeUp' }); }
    if (e.button === 2) { if (down) this.events.push({ t: 'blockDown', dir: this.motionDir() }); else this.events.push({ t: 'blockUp' }); }
  }
  // while blocking, the guard follows the pointer
  guardDir() { return this.device === 'touch' ? this.touchGuard || this.dir : this.motionDir(); }

  /* ---------- touchscreen ---------- */
  touchDown(e) {
    if (!this.active || e.pointerType !== 'touch') return;
    this.setDevice('touch');
    if (this.lookId == null) { this.lookId = e.pointerId; this.lookLast = { x: e.clientX, y: e.clientY }; }
    this.touching = true;
  }
  touchDrag(e) {
    if (!this.active || e.pointerType !== 'touch' || e.pointerId !== this.lookId) return;
    const dx = e.clientX - this.lookLast.x, dy = e.clientY - this.lookLast.y; this.lookLast = { x: e.clientX, y: e.clientY };
    this.look.x += dx * this.S.touchSens; this.look.y += dy * this.S.touchSens * (this.S.invert ? -1 : 1);
  }
  touchUp(e) {
    if (e.pointerType !== 'touch') return;
    if (e.pointerId === this.lookId) this.lookId = null;
    setTimeout(() => { if (this.lookId == null) this.touching = false; }, 400);
  }
  // the on-screen buttons (touchscreen): strike with a swipe, block with a slide, and plain buttons
  buttons(root) {
    const btn = (cls, label, sub) => h('div', { class: 'fp-btn ' + cls }, h('b', null, label), sub ? h('small', null, sub) : null);
    const strike = btn('strike', 'STRIKE', 'swipe ← ↑ →'), block = btn('block', 'BLOCK', 'slide to turn'), kick = btn('kick', 'KICK'), use = btn('use', 'USE'), dodge = btn('dodge', 'DODGE');
    const swipeDir = (dx, dy) => Math.abs(dx) > Math.abs(dy) * 0.9 ? (dx < 0 ? 'l' : 'r') : 'u';
    // each button follows its own finger, even when the finger slides off the button
    const track = (el, down, move, up) => {
      let pid = null;
      el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); this.setDevice('touch'); pid = e.pointerId; try { el.setPointerCapture(pid); } catch (_) { /* fine */ } el.classList.add('on'); down(e); });
      window.addEventListener('pointermove', e => { if (e.pointerId === pid) move(e); });
      const end = e => { if (e.pointerId !== pid) return; pid = null; el.classList.remove('on'); up(e); };
      window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    };
    let s0 = null, fired = false;
    track(strike, e => { s0 = { x: e.clientX, y: e.clientY }; fired = false; }, e => {
      const dx = e.clientX - s0.x, dy = e.clientY - s0.y;
      if (!fired && Math.hypot(dx, dy) > 26) { fired = true; this.dir = swipeDir(dx, dy); this.events.push({ t: 'strikeDown', dir: this.dir }); }
    }, () => { if (!fired) this.events.push({ t: 'strikeDown', dir: this.dir }); this.events.push({ t: 'strikeUp', touchTap: !fired }); });
    let b0 = null;
    track(block, e => { b0 = { x: e.clientX, y: e.clientY }; this.touchGuard = null; this.events.push({ t: 'blockDown', dir: this.dir }); }, e => {
      const dx = e.clientX - b0.x, dy = e.clientY - b0.y; if (Math.hypot(dx, dy) > 20) this.touchGuard = swipeDir(dx, dy);
    }, () => { this.touchGuard = null; this.events.push({ t: 'blockUp' }); });
    track(kick, () => this.pressed.add('KeyE'), () => {}, () => {});
    track(use, () => this.pressed.add('KeyF'), () => {}, () => {});
    track(dodge, () => this.pressed.add('Space'), () => {}, () => {});
    // a move stick for when there is no keyboard at hand; it steps aside once W A S D are used
    const knob = h('i'), stick = h('div', { class: 'fp-stick' }, knob);
    let c0 = null;
    track(stick, e => { const r = stick.getBoundingClientRect(); c0 = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, e => {
      let dx = (e.clientX - c0.x) / 50, dy = (e.clientY - c0.y) / 50; const L = Math.hypot(dx, dy); if (L > 1) { dx /= L; dy /= L; }
      this.touchMove = { x: dx, y: -dy }; this.touchRun = L > 1.25; knob.style.transform = `translate(${dx * 38}px, ${dy * 38}px)`;
    }, () => { this.touchMove = { x: 0, y: 0 }; this.touchRun = false; knob.style.transform = ''; });
    this.stick = stick;
    root.append(h('div', { class: 'fp-touch' }, stick, strike, block, kick, use, dodge));
  }
  endFrame() { this.pressed.clear(); this.look.x = 0; this.look.y = 0; }
}
