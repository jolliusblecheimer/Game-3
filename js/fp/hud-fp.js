// What you see on screen in first person, in Tenka's paper-and-ink style: the crosshair with the three
// strike/guard directions, health and stamina brush strokes, the training card, messages, hints for the
// device you're using, the red ink of a hit, and the pause screen with the settings.
import { h } from '../util.js';
import { WEAPONS, DIR_NAME } from './combat.js';

const ARC = { l: 'M 22 58 A 36 36 0 0 1 22 22', u: 'M 24 18 A 36 36 0 0 1 56 18', r: 'M 58 22 A 36 36 0 0 1 58 58' };

export const HINTS = {
  mouse: [['W A S D', 'move'], ['Shift', 'run'], ['C', 'crouch'], ['Space', 'dodge'], ['Move mouse ← ↑ →, then click', 'strike from that side'], ['Hold click', 'heavy strike'], ['Hold right button', 'block'], ['Tap right as it lands', 'parry'], ['E', 'kick'], ['F', 'use'], ['J I L / K', 'strike / block by key'], ['Esc', 'pause']],
  trackpad: [['W A S D', 'move'], ['Slide ← ↑ →, then click', 'strike from that side'], ['Press and hold', 'heavy strike'], ['Two-finger click (hold)', 'block'], ['Two-finger tap as it lands', 'parry'], ['J I L', 'strike left / overhead / right'], ['K', 'block (tap = parry)'], ['E', 'kick'], ['Space', 'dodge'], ['F', 'use'], ['Esc', 'pause']],
  touch: [['W A S D', 'move (or the stick)'], ['Drag the screen', 'look'], ['STRIKE: tap / swipe ← ↑ →', 'strike'], ['Hold STRIKE', 'heavy strike'], ['Hold BLOCK, slide to turn', 'block'], ['Tap BLOCK as it lands', 'parry'], ['KICK · DODGE · USE', ''], ['J I L / K', 'keys still work']],
};

export class FPHud {
  constructor(fp) {
    this.fp = fp;
    const svg = `<svg viewBox="0 0 80 80" class="fp-arcs">${Object.entries(ARC).map(([k, d]) => `<path data-d="${k}" d="${d}"/>`).join('')}<circle cx="40" cy="40" r="2.2" class="dot"/></svg>`;
    this.cross = h('div', { class: 'fp-cross' }); this.cross.innerHTML = svg;
    this.arcs = Object.fromEntries([...this.cross.querySelectorAll('path')].map(p => [p.dataset.d, p]));
    this.hp = h('i'); this.st = h('i'); this.who = h('b');
    this.bars = h('div', { class: 'fp-bars' }, this.who, h('div', { class: 'fp-bar hp' }, this.hp), h('div', { class: 'fp-bar st' }, this.st));
    this.card = h('div', { class: 'fp-card' });
    this.hint = h('div', { class: 'fp-hint' });
    this.say = h('div', { class: 'fp-say' });
    this.prompt = h('div', { class: 'fp-prompt', hidden: true });
    this.vig = h('div', { class: 'fp-vig' }); this.flashEl = h('div', { class: 'fp-flash' });
    this.menuBtn = h('button', { class: 'fp-menubtn', title: 'Pause', onclick: () => fp.pause() }, '≡');
    this.pauseEl = h('div', { class: 'fp-pause', hidden: true });
    this.root = h('div', { id: 'fp-ui', hidden: true }, this.vig, this.flashEl, this.cross, this.bars, this.card, this.hint, this.say, this.prompt, this.menuBtn, this.pauseEl);
    document.body.append(this.root);
    this.sayT = 0; this.hurtA = 0; this.flashA = 0;
  }
  show(on) { this.root.hidden = !on; }
  setDevice(d) {
    this.root.classList.toggle('touch', d === 'touch');
    const list = HINTS[d === 'touch' ? 'touch' : this.fp.S.trackpad ? 'trackpad' : 'mouse'];
    this.hint.textContent = '';
    this.hint.append(...list.slice(0, 7).map(([k, v]) => h('span', null, h('kbd', null, k), v ? ' ' + v : '')));
  }
  message(text, sec = 2.4, kind = '') { this.say.textContent = text; this.say.className = 'fp-say on ' + kind; this.sayT = sec; }
  hurt(a = 1) { this.hurtA = Math.min(1.2, this.hurtA + a); }
  flash(kind) { this.flashEl.className = 'fp-flash ' + kind; this.flashA = 1; }
  update(dt, F, info) {
    this.hp.style.width = `${F.hp / F.maxHp * 100}%`;
    this.st.style.width = `${F.st / F.maxSt * 100}%`;
    this.bars.classList.toggle('tired', F.st < 20);
    // the crosshair: the direction you'd strike or guard, the incoming side in red, and a ring when you can riposte
    const cur = F.state === 'guard' ? F.guardDir : info.aimDir;
    for (const [k, p] of Object.entries(this.arcs)) {
      p.classList.toggle('cur', k === cur);
      p.classList.toggle('guard', F.state === 'guard' && k === F.guardDir);
      p.classList.toggle('danger', info.incoming === k);
    }
    this.cross.classList.toggle('riposte', info.now < F.riposteUntil);
    this.cross.classList.toggle('heavy', F.state === 'windup' && F.heavy);
    // messages and flashes fade
    this.sayT -= dt; if (this.sayT <= 0 && this.say.classList.contains('on')) this.say.classList.remove('on');
    this.hurtA = Math.max(0, this.hurtA - dt * 1.4); this.vig.style.opacity = Math.min(1, this.hurtA);
    this.vig.classList.toggle('down', F.state === 'down');
    if (F.state === 'down') this.vig.style.opacity = 1;
    this.flashA = Math.max(0, this.flashA - dt * 4); this.flashEl.style.opacity = this.flashA * 0.55;
  }
  setCard(title, rows) {
    this.card.textContent = '';
    this.card.append(h('b', null, title), ...rows.map(r => h('div', { class: 'row' }, h('span', null, r[0]), h('em', null, String(r[1])))));
  }
  setPrompt(text) { this.prompt.hidden = !text; if (text) this.prompt.textContent = text; }
  // the pause screen: continue, what to train with, the settings for each device, and the way back
  renderPause() {
    const fp = this.fp, S = fp.S, P = this.pauseEl; P.textContent = '';
    const row = (label, ...kids) => h('div', { class: 'fp-row' }, h('span', null, label), h('div', null, ...kids));
    const choice = (opts, cur, set) => opts.map(([k, l]) => h('button', { class: 'btn small ' + (cur === k ? '' : 'ghost'), onclick: () => { set(k); this.renderPause(); } }, l));
    const slider = (min, max, step, val, set) => h('input', { type: 'range', min, max, step, value: String(val), oninput: e => set(+e.target.value) });
    const toggle = (label, val, set) => h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: val ? true : null, onchange: e => set(e.target.checked) }), label);
    const dev = fp.input.device === 'touch' ? 'touch' : S.trackpad ? 'trackpad' : 'mouse';
    P.append(h('div', { class: 'fp-sheet' },
      h('h2', null, 'Tenka — first person ', h('small', null, '(preview: the training yard)')),
      h('p', { class: 'sub' }, 'Walk the valley, cut the straw dummies, and learn to block and parry the sparring post. Enemies, squads and orders come next.'),
      h('button', { class: 'btn big', onclick: () => fp.resume() }, fp.input.device === 'touch' ? 'Continue' : 'Click to play'),
      row('Weapon', ...choice(Object.entries(WEAPONS).map(([k, w]) => [k, w.name]), fp.fighter.wk, k => fp.setWeapon(k))),
      row('Sparring post', ...choice([['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], S.diff, k => { S.diff = k; fp.applySettings(); })),
      row('Time of day', ...choice([['0.3', 'Morning'], ['0.5', 'Noon'], ['0.74', 'Dusk'], ['0.95', 'Night'], ['village', 'As in the village']], S.time, k => { S.time = k; fp.applySettings(); })),
      row('I play with', ...choice([['mouse', 'Mouse'], ['trackpad', 'Trackpad'], ['touch', 'Touchscreen']], dev, k => { S.trackpad = k === 'trackpad'; if (k === 'touch') fp.input.setDevice('touch'); else fp.input.setDevice('mouse'); if (k !== 'mouse' && S.autoGuard == null) S.autoGuard = true; fp.applySettings(); })),
      row('Look speed (mouse / trackpad)', slider(0.2, 3, 0.05, S.sens, v => { S.sens = v; fp.applySettings(false); })),
      row('Look speed (touch)', slider(0.1, 1.5, 0.05, S.touchSens, v => { S.touchSens = v; fp.applySettings(false); })),
      row('Field of view', slider(60, 95, 1, S.fov, v => { S.fov = v; fp.applySettings(false); })),
      h('div', { class: 'fp-toggles' },
        toggle('Invert up / down', S.invert, v => { S.invert = v; fp.applySettings(false); }),
        toggle('Auto-guard (your block turns to the strike by itself — recommended for trackpad and touch)', fp.autoGuard, v => { S.autoGuard = v; fp.applySettings(false); }),
        toggle('Show the red strike cue', S.cue !== false, v => { S.cue = v; fp.applySettings(false); }),
        toggle('Head bob and camera shake', S.bob !== false, v => { S.bob = v; fp.applySettings(false); }),
        toggle('Sounds', S.sound !== false, v => { S.sound = v; fp.applySettings(false); })),
      h('h3', null, 'Controls'),
      h('div', { class: 'fp-keys' }, ...HINTS[dev].map(([k, v]) => h('div', null, h('kbd', null, k), h('span', null, v)))),
      h('div', { class: 'fp-actions' }, h('button', { class: 'btn ghost', onclick: () => fp.respawn() }, 'Back to the start'), h('button', { class: 'btn danger', onclick: () => fp.exit() }, 'Back to the village'))));
  }
  showPause(on) { this.pauseEl.hidden = !on; if (on) this.renderPause(); }
}
export { DIR_NAME };
