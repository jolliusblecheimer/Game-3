// Generated soundtrack: played live with the Web Audio API — nothing to download, never quite the same twice.
// Day: a koto plucking slow phrases in the bright yo scale over a soft drone, now and then a shakuhachi.
// Night: the melancholy in scale, sparser, with wind chimes. Raids and battles: taiko drums.

const YO = [0, 2, 5, 7, 9];          // Japanese pentatonic (yo): open and calm
const IN = [0, 1, 5, 7, 8];          // miyako-bushi (in): the koto's dusky scale
const ROOT = 146.83;                 // D3
const hz = semis => ROOT * Math.pow(2, semis / 12);
const MOODS = {
  day:    { scale: YO, tempo: 66, play: 0.14, rest: [5, 12], drone: 0.06, taiko: 0 },
  night:  { scale: IN, tempo: 54, play: 0.09, rest: [8, 16], drone: 0.055, taiko: 0 },
  raid:   { scale: IN, tempo: 96, play: 0.05, rest: [6, 12], drone: 0.03,  taiko: 1 },
  battle: { scale: IN, tempo: 92, play: 0.06, rest: [6, 12], drone: 0.025, taiko: 1 },
};
// taiko pattern over 16 steps: 2 = big drum (o-daiko), 1 = small drum (shime-daiko)
const TAIKO = [2, 0, 1, 0, 0, 1, 2, 0, 2, 0, 1, 1, 0, 1, 2, 1];

export class Music {
  constructor() { this.on = true; this.vol = 0.6; this.mood = 'day'; this.ctx = null; this.k = 0; this.phrase = 0; this.restLeft = 4; this.deg = 5; }

  // browsers only allow sound after the player has touched the page
  unlock() {
    if (this.ctx) { if (this.on && this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { return null; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.on ? this.vol * 0.9 : 0;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    this.master.connect(comp).connect(c.destination);
    // a soft hall: generated impulse response
    const len = c.sampleRate * 3.2, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.reverb = c.createConvolver(); this.reverb.buffer = ir;
    const wet = c.createGain(); wet.gain.value = 0.42; this.reverb.connect(wet).connect(this.master);
    this.dry = c.createGain(); this.dry.gain.value = 0.8; this.dry.connect(this.master); this.dry.connect(this.reverb);
    // breath / drum noise
    this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const nd = this.noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    // the drone: root and fifth, breathing slowly
    this.droneGain = c.createGain(); this.droneGain.gain.value = 0; this.droneGain.connect(this.dry);
    const lfo = c.createOscillator(), lfoG = c.createGain(); lfo.frequency.value = 0.07; lfoG.gain.value = 0.015; lfo.connect(lfoG).connect(this.droneGain.gain); lfo.start();
    for (const [f, t] of [[ROOT / 2, 'sine'], [ROOT * 0.75, 'sine'], [ROOT / 2 * 1.003, 'triangle']]) { const o = c.createOscillator(), g = c.createGain(); o.type = t; o.frequency.value = f; g.gain.value = t === 'triangle' ? 0.25 : 0.5; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; o.connect(lp).connect(g).connect(this.droneGain); o.start(); }
    this.setMood(this.mood, true);
    this.nextT = c.currentTime + 0.3;
    this.timer = setInterval(() => this.schedule(), 90);
    document.addEventListener('visibilitychange', () => { if (!this.ctx) return; if (document.hidden) this.ctx.suspend(); else if (this.on) this.ctx.resume(); });
    return c;
  }
  setOn(on) { this.on = on; if (!this.ctx) return; this.master.gain.setTargetAtTime(on ? this.vol * 0.9 : 0, this.ctx.currentTime, 0.4); if (on) this.ctx.resume(); }
  setVolume(v) { this.vol = v; if (this.ctx && this.on) this.master.gain.setTargetAtTime(v * 0.9, this.ctx.currentTime, 0.2); }
  setMood(m, now = false) {
    if (!MOODS[m] || (m === this.mood && !now)) return;
    this.mood = m;
    if (this.ctx) this.droneGain.gain.setTargetAtTime(MOODS[m].drone, this.ctx.currentTime, now ? 1.5 : 3);
  }

  schedule() {
    if (!this.ctx || !this.on || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.nextT < now) this.nextT = now + 0.05;
    while (this.nextT < now + 0.35) { this.tick(this.nextT); this.nextT += 60 / MOODS[this.mood].tempo / 2; }
  }
  // one eighth-note step
  tick(t) {
    const M = MOODS[this.mood], k = this.k++, r = Math.random;
    if (M.taiko) { const d = TAIKO[k % 16]; if (d && (d === 2 || r() < 0.8)) this.taiko(t, d === 2); if (k % 64 === 60) this.taiko(t, true, 1.4); }
    // koto: phrases of a few notes, then silence
    if (this.phrase > 0) {
      this.phrase--;
      if (r() < 0.72) {
        this.deg = Math.max(0, Math.min(10, this.deg + [-2, -1, -1, 1, 1, 2][Math.floor(r() * 6)]));
        const oct = Math.floor(this.deg / 5), semi = M.scale[this.deg % 5] + 12 * oct + 12;
        this.pluck(t, hz(semi), 0.16 + r() * 0.08);
        if (r() < 0.12) this.pluck(t + 0.03, hz(semi + 7), 0.08);           // a fifth rung with it
        if (r() < 0.1) this.pluck(t + 60 / M.tempo / 4, hz(semi), 0.07);    // a quick grace repeat
      }
      if (!this.phrase) this.restLeft = M.rest[0] + Math.floor(r() * (M.rest[1] - M.rest[0]));
    } else if (this.restLeft > 0) this.restLeft--;
    else if (r() < M.play * 4) { this.phrase = 4 + Math.floor(r() * 6); if (r() < 0.3) this.deg = 3 + Math.floor(r() * 4); }
    // a shakuhachi now and then, when all is calm
    if (!M.taiko && k % 16 === 0 && r() < (this.mood === 'night' ? 0.22 : 0.16)) this.flute(t, hz(M.scale[Math.floor(r() * 5)] + 12), 2.6 + r() * 2);
    // wind chimes (furin) at night, rarely by day
    if (!M.taiko && r() < (this.mood === 'night' ? 0.035 : 0.01)) this.chime(t);
  }

  out(node) { node.connect(this.dry); }
  pluck(t, f, vel) {
    const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), g2 = c.createGain(), lp = c.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2.005; g2.gain.value = 0.35;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 7, t); lp.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.9);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    o.connect(lp); o2.connect(g2).connect(lp); lp.connect(g); this.out(g);
    o.start(t); o2.start(t); o.stop(t + 2.7); o2.stop(t + 2.7);
  }
  flute(t, f, dur) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), vib = c.createOscillator(), vg = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f * 0.97, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.35);  // the shakuhachi's bend up into the note
    vib.frequency.value = 4.8; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.008, t + dur * 0.6); vib.connect(vg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.6); g.gain.setValueAtTime(0.07, t + dur - 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); this.out(g);
    // breath
    const n = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain(); n.buffer = this.noise; bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 2.5;
    ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.02, t + 0.25); ng.gain.exponentialRampToValueAtTime(0.004, t + 0.9); ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(ng); this.out(ng);
    o.start(t); vib.start(t); n.start(t); o.stop(t + dur + 0.1); vib.stop(t + dur + 0.1); n.stop(t + dur + 0.1);
  }
  chime(t) {
    const c = this.ctx;
    for (let i = 0; i < 3; i++) {
      const f = hz(YO[Math.floor(Math.random() * 5)] + 36 + (Math.random() < 0.3 ? 12 : 0)), s = t + i * (0.08 + Math.random() * 0.15);
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.025, s + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, s + 1.8);
      o.connect(g); this.out(g); o.start(s); o.stop(s + 1.9);
    }
  }
  taiko(t, big, vel = 1) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    const f0 = big ? 78 : 170, len = big ? 0.7 : 0.22;
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((big ? 0.5 : 0.18) * vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); this.out(g); o.start(t); o.stop(t + len + 0.05);
    // the skin's slap
    const n = c.createBufferSource(), lp = c.createBiquadFilter(), ng = c.createGain(); n.buffer = this.noise; lp.type = 'lowpass'; lp.frequency.value = big ? 900 : 2400;
    ng.gain.setValueAtTime((big ? 0.14 : 0.08) * vel, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 0.18 : 0.08));
    n.connect(lp).connect(ng); this.out(ng); n.start(t, Math.random()); n.stop(t + 0.25);
  }
}
