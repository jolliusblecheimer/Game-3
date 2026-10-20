// What you see on screen in first person, in Tenka's paper-and-ink style: the crosshair, health and stamina
// brush strokes, the training card, messages, hints for the device you're using, the red ink of a hit, and the
// pause screen with the soldier you fight as and the settings.
import { h } from '../util.js';
import { CLASSES, ABILITY } from './classes.js';
import { WEAPONS } from './combat.js';

export const HINTS = {
  mouse: [['W A S D', 'move'], ['Shift', 'run'], ['Click', 'strike — left, right, left… (a combo)'], ['Hold click', 'heavy overhead — breaks any guard'], ['Hold right button', 'block (face the strike) · bow: aim'], ['E', 'kick'], ['G', 'ability'], ['Space', 'dodge'], ['C', 'crouch'], ['F', 'use'], ['J / K', 'strike / block by key'], ['Esc', 'pause']],
  trackpad: [['W A S D', 'move'], ['Shift', 'run'], ['Click', 'strike — a left / right combo'], ['Press and hold', 'heavy overhead — breaks any guard'], ['Two-finger click (hold)', 'block · bow: aim'], ['J / K', 'strike / block by key'], ['E', 'kick'], ['G', 'ability'], ['Space', 'dodge'], ['F', 'use'], ['Esc', 'pause']],
  touch: [['W A S D', 'move (or the stick)'], ['Drag the screen', 'look'], ['STRIKE', 'tap: combo · hold: heavy overhead'], ['BLOCK', 'hold (face the strike) · bow: AIM'], ['KICK · DODGE · USE · G', ''], ['J / K', 'keys still work']],
};

export class FPHud {
  constructor(fp) {
    this.fp = fp;
    this.cross = h('div', { class: 'fp-cross' });
    this.cross.innerHTML = `<svg viewBox="0 0 80 80" class="fp-x">
      <circle class="ring" cx="40" cy="40" r="17"/><circle class="charge" cx="40" cy="40" r="17" pathLength="100"/>
      <path class="side l" d="M 16 33 L 10 40 L 16 47"/><path class="side r" d="M 64 33 L 70 40 L 64 47"/>
      <circle class="dot" cx="40" cy="40" r="2.2"/></svg>`;
    this.x = this.cross.querySelector('svg'); this.chargeEl = this.cross.querySelector('.charge');
    this.sideL = this.cross.querySelector('.side.l'); this.sideR = this.cross.querySelector('.side.r');
    this.hp = h('i'); this.st = h('i'); this.who = h('b'); this.ammo = h('span', { class: 'fp-ammo' });
    this.bars = h('div', { class: 'fp-bars' }, h('div', { class: 'fp-who' }, this.who, this.ammo), h('div', { class: 'fp-bar hp' }, this.hp), h('div', { class: 'fp-bar st' }, this.st));
    this.card = h('div', { class: 'fp-card' });
    this.hint = h('div', { class: 'fp-hint' });
    this.say = h('div', { class: 'fp-say' });
    this.prompt = h('div', { class: 'fp-prompt', hidden: true });
    this.vig = h('div', { class: 'fp-vig' }); this.flashEl = h('div', { class: 'fp-flash' });
    this.menuBtn = h('button', { class: 'fp-menubtn', title: 'Pause', onclick: () => fp.pause() }, '≡');
    this.pauseEl = h('div', { class: 'fp-pause', hidden: true });
    // the one you're fighting: name and a brush stroke of health; red ink at the screen's edge when struck from outside your view
    this.foeName = h('b'); this.foeHp = h('i'); this.foe = h('div', { class: 'fp-foe', hidden: true }, this.foeName, h('div', { class: 'fp-bar hp' }, this.foeHp));
    this.edgeL = h('div', { class: 'fp-edge l' }); this.edgeR = h('div', { class: 'fp-edge r' }); this.edgeB = h('div', { class: 'fp-edge b' });
    this.root = h('div', { id: 'fp-ui', hidden: true }, this.vig, this.flashEl, this.edgeL, this.edgeR, this.edgeB, this.cross, this.bars, this.card, this.foe, this.hint, this.say, this.prompt, this.menuBtn, this.pauseEl);
    document.body.append(this.root);
    this.sayT = 0; this.hurtA = 0; this.flashA = 0;
  }
  show(on) { this.root.hidden = !on; }
  setDevice(d) {
    this.root.classList.toggle('touch', d === 'touch');
    const list = HINTS[d === 'touch' ? 'touch' : this.fp.S.trackpad ? 'trackpad' : 'mouse'];
    this.hint.textContent = '';
    this.hint.append(...list.slice(0, 8).map(([k, v]) => h('span', null, h('kbd', null, k), v ? ' ' + v : '')));
  }
  setClass(C) {
    this.who.textContent = `${C.kanji} ${C.name}`;
    const bow = C.weapon === 'yumi';
    if (this.fp.input.blockBtn) { this.fp.input.blockBtn.firstChild.textContent = bow ? 'AIM' : C.shield ? 'SHIELD' : 'BLOCK'; }
    if (this.fp.input.abilBtn) { this.fp.input.abilBtn.hidden = !C.ability; this.fp.input.abilBtn.firstChild.textContent = C.ability ? ABILITY[C.ability].name.split(' ').pop().toUpperCase() : 'G'; }
    this.root.classList.toggle('bow', bow);
  }
  message(text, sec = 2.4, kind = '') { this.say.textContent = text; this.say.className = 'fp-say on ' + kind; this.sayT = sec; }
  hurt(a = 1) { this.hurtA = Math.min(1.2, this.hurtA + a); }
  flash(kind) { this.flashEl.className = 'fp-flash ' + kind; this.flashA = 1; }
  // the crosshair: which side the next cut comes from, a ring that fills while you charge the heavy overhead,
  // blue while you block, gold while your counter is ready, red (orange for heavy) when a strike is coming
  update(dt, F, info) {
    this.hp.style.width = `${F.hp / F.maxHp * 100}%`;
    this.st.style.width = `${F.st / F.maxSt * 100}%`;
    this.bars.classList.toggle('tired', F.st < 20);
    const X = this.x.classList, next = F.state === 'windup' || F.state === 'active' ? F.dir : info.nextSide;
    this.sideL.classList.toggle('on', !F.isBow && next === 'l'); this.sideR.classList.toggle('on', !F.isBow && next === 'r');
    X.toggle('guard', F.state === 'guard');
    X.toggle('counter', info.now < F.counterUntil || info.now < F.riposteUntil);
    X.toggle('incoming', !!info.incoming && !info.incomingHeavy);
    X.toggle('incomingHeavy', !!info.incomingHeavy);
    X.toggle('bow', F.isBow); X.toggle('full', F.isBow && F.state === 'aim' && F.draw >= 1);
    const charging = F.state === 'windup' && F.hold && !F.isBow;
    const k = F.isBow ? (F.state === 'aim' ? F.draw : 0) : charging ? Math.min(1, F.t / 0.3) : F.state === 'windup' && F.heavy ? 1 : 0;
    this.chargeEl.style.strokeDasharray = `${k * 100} 100`;
    X.toggle('heavy', F.heavy && (F.state === 'windup' || F.state === 'active'));
    if (F.isBow) this.cross.style.transform = `scale(${1.25 - (F.state === 'aim' ? F.draw : 0) * 0.55})`; else this.cross.style.transform = '';
    this.ammo.textContent = info.ammo || '';
    this.sayT -= dt; if (this.sayT <= 0 && this.say.classList.contains('on')) this.say.classList.remove('on');
    this.hurtA = Math.max(0, this.hurtA - dt * 1.4);
    const ratio = F.hp / F.maxHp, low = ratio < 0.5 ? (0.5 - ratio) * 1.8 * (0.85 + 0.15 * Math.sin(info.now * 6)) : 0;   // badly hurt: the red ink stays and pulses
    this.vig.style.opacity = Math.min(1, Math.max(this.hurtA, low));
    this.vig.classList.toggle('down', F.state === 'down');
    if (F.state === 'down') this.vig.style.opacity = 1;
    this.flashA = Math.max(0, this.flashA - dt * 4); this.flashEl.style.opacity = this.flashA * 0.55;
  }
  setCard(title, rows) {
    const key = title + rows.map(r => r.join(':')).join('|'); if (key === this.cardKey) return; this.cardKey = key;
    this.card.textContent = '';
    this.card.append(h('b', null, title), ...rows.map(r => h('div', { class: 'row' }, h('span', null, r[0]), h('em', null, String(r[1])))));
  }
  setFoe(a) {
    this.foe.hidden = true; return;   // no health bars for now: you read the fight, not a number
    this.foeName.textContent = a.name; this.foeHp.style.width = `${Math.max(0, a.fighter.hp / a.fighter.maxHp * 100)}%`;
  }
  emptyAmmo() { const el = this.ammo; el.classList.remove('empty'); void el.offsetWidth; el.classList.add('empty'); }
  edge(side) { const el = side < -0.3 ? this.edgeL : side > 0.3 ? this.edgeR : this.edgeB; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); }
  setPrompt(text) { this.prompt.hidden = !text; if (text) this.prompt.textContent = text; }
  // the pause screen: who you fight as, continue, the settings for each device, and the way back
  renderPause() {
    const fp = this.fp, S = fp.S, P = this.pauseEl; P.textContent = '';
    const row = (label, ...kids) => h('div', { class: 'fp-row' }, h('span', null, label), h('div', null, ...kids));
    const choice = (opts, cur, set) => opts.map(([k, l]) => h('button', { class: 'btn small ' + (cur === k ? '' : 'ghost'), onclick: () => { set(k); this.renderPause(); } }, l));
    const slider = (min, max, step, val, set) => h('input', { type: 'range', min, max, step, value: String(val), oninput: e => set(+e.target.value) });
    const toggle = (label, val, set) => h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: val ? true : null, onchange: e => set(e.target.checked) }), label);
    const dev = fp.input.device === 'touch' ? 'touch' : S.trackpad ? 'trackpad' : 'mouse';
    const C = CLASSES[fp.cls];
    P.append(h('div', { class: 'fp-sheet' },
      h('h2', null, 'Tenka — first person ', h('small', null, '(preview: the training yard)')),
      h('h3', null, 'Fight as'),
      h('div', { class: 'fp-classes' }, ...Object.entries(CLASSES).map(([k, c]) => h('button', { class: 'fp-class' + (k === fp.cls ? ' on' : '') + (c.commander ? ' cmd' : ''), onclick: () => { fp.setClass(k); this.renderPause(); } },
        h('span', { class: 'k' }, c.kanji), h('b', null, c.name), h('small', null, c.role)))),
      h('p', { class: 'fp-classdesc' }, h('b', null, `${C.name}: `), C.desc, ` · Health ${C.hp}${C.ability ? ` · G: ${ABILITY[C.ability].name}` : ''}`),
      h('button', { class: 'btn big', onclick: () => fp.resume() }, fp.input.device === 'touch' ? 'Continue' : 'Click to play'),
      h('h3', null, 'How to fight'),
      h('div', { class: 'fp-legend' },
        h('div', null, h('i', { class: 'lg side' }), h('span', null, 'The arrow at the left or right of the crosshair: the side your next cut comes from. Clicks alternate left, right, left…')),
        h('div', null, h('i', { class: 'lg charge' }), h('span', null, 'Hold the strike and the ring fills orange: the heavy overhead. It breaks any block or shield.')),
        h('div', null, h('i', { class: 'lg guard' }), h('span', null, 'Blue ring: you are blocking. Every strike from in front of you is stopped — just face your opponent.')),
        h('div', null, h('i', { class: 'lg counter' }), h('span', null, 'Gold ring: you blocked a strike — your next strike within a second does ×1.5.')),
        h('div', null, h('i', { class: 'lg incoming' }), h('span', null, 'Red ring: a strike is coming — block. Orange: a heavy one — it breaks blocks, so dodge (Space).')),
        h('div', null, h('i', { class: 'lg bow' }), h('span', null, 'Bows: hold the block button to aim — the circle closes as you draw — then click to loose.'))),
      row('Sparring post', ...choice([['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], S.diff, k => { S.diff = k; fp.applySettings(); })),
      row('Time of day', ...choice([['0.3', 'Morning'], ['0.5', 'Noon'], ['0.74', 'Dusk'], ['0.95', 'Night'], ['village', 'As in the village']], S.time, k => { S.time = k; fp.applySettings(); })),
      row('I play with', ...choice([['mouse', 'Mouse'], ['trackpad', 'Trackpad'], ['touch', 'Touchscreen']], dev, k => { S.trackpad = k === 'trackpad'; fp.input.setDevice(k === 'touch' ? 'touch' : 'mouse'); fp.applySettings(); })),
      row('Look speed (mouse / trackpad)', slider(0.2, 3, 0.05, S.sens, v => { S.sens = v; fp.applySettings(false); })),
      row('Look speed (touch)', slider(0.1, 1.5, 0.05, S.touchSens, v => { S.touchSens = v; fp.applySettings(false); })),
      row('Field of view', slider(60, 95, 1, S.fov, v => { S.fov = v; fp.applySettings(false); })),
      h('div', { class: 'fp-toggles' },
        toggle('Invert up / down', S.invert, v => { S.invert = v; fp.applySettings(false); }),
        toggle('Show the red warning when a strike is coming', S.cue !== false, v => { S.cue = v; fp.applySettings(false); }),
        toggle('Head bob and camera shake', S.bob !== false, v => { S.bob = v; fp.applySettings(false); }),
        toggle('Sounds', S.sound !== false, v => { S.sound = v; fp.applySettings(false); }),
        toggle('Experimental: split-second parry (block just as the strike lands for a ×2 riposte)', !!S.parry, v => { S.parry = v; fp.applySettings(false); })),
      h('h3', null, 'Controls'),
      h('div', { class: 'fp-keys' }, ...HINTS[dev].map(([k, v]) => h('div', null, h('kbd', null, k), h('span', null, v)))),
      h('div', { class: 'fp-actions' }, h('button', { class: 'btn ghost', onclick: () => { fp.resetCamp(); this.renderPause(); } }, 'Reset the bandits'), h('button', { class: 'btn ghost', onclick: () => fp.respawn() }, 'Back to the start'), h('button', { class: 'btn danger', onclick: () => fp.exit() }, 'Back to the village'))));
  }
  showPause(on) { this.pauseEl.hidden = !on; if (on) this.renderPause(); }
}
export { WEAPONS };
