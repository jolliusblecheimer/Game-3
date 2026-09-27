// Generated soundtrack: played live with the Web Audio API — nothing to download.
// Styles: "mix" (default) rotates like a game soundtrack — a few minutes of one piece, a quiet pause, the next —
// through "piano" (spacious ambient piano), "chip" (Tenka's own theme as a C64-style chiptune) and
// "calm" (koto), which is made up as it plays:
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
// ---- "Tenka" — the original chiptune theme, in the style of the C64 SID classics ----
// 16 bars in D minor, eighth notes: MIDI note, 0 = hold the previous note, -1 = rest.
const THEME = [
  [74, 0, 77, 0, 81, 0, 79, 77], [74, 0, 0, 72, 70, 0, 72, 74], [72, 0, 77, 0, 76, 0, 74, 72], [72, 0, 0, 0, 67, 0, 69, 72],
  [74, 0, 77, 0, 81, 0, 84, 0], [82, 0, 81, 79, 77, 0, 74, 0], [79, 0, 77, 74, 70, 0, 74, 77], [76, 0, 0, 0, 73, 0, 76, 0],
  [77, 79, 81, 0, 82, 0, 81, 79], [79, 0, 76, 0, 72, 0, 76, 79], [81, 0, 77, 0, 74, 0, 77, 81], [86, 0, 0, 0, 84, 0, 81, 0],
  [82, 0, 81, 0, 79, 0, 77, 0], [79, 0, 77, 0, 76, 0, 72, 0], [73, 76, 79, 0, 81, 0, 79, 76], [76, 0, 0, 0, 0, 0, -1, -1],
];
// the chord under each bar: root (MIDI) and chord tones in semitones
const MIN = [0, 3, 7, 12], MAJ = [0, 4, 7, 12];
const CHORDS = [[50, MIN], [46, MAJ], [53, MAJ], [48, MAJ], [50, MIN], [46, MAJ], [43, MIN], [45, MAJ],
                [46, MAJ], [48, MAJ], [50, MIN], [50, MIN], [46, MAJ], [48, MAJ], [45, MAJ], [45, MAJ]];
const CHIP = { day: { tempo: 116, drums: 1, arp: 1 }, night: { tempo: 96, drums: 0, arp: 0.6 }, raid: { tempo: 140, drums: 2, arp: 1 }, battle: { tempo: 134, drums: 2, arp: 1 } };
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
// ---- ambient piano: slow chords that ring out, a few quiet notes above, lots of air ----
const PIANO_CHORDS = [[48, [0, 7, 16, 19, 23]], [45, [0, 7, 15, 19, 26]], [41, [0, 7, 16, 19, 23]], [43, [0, 7, 14, 17, 21]],
                      [48, [0, 7, 16, 19, 26]], [52, [0, 7, 15, 19, 22]], [41, [0, 7, 14, 16, 21]], [43, [0, 5, 14, 19, 22]]]; // Cmaj9 Am9 Fmaj7 G6sus ...
const PENTA = [0, 2, 4, 7, 9];
const MIX = ['piano', 'chip', 'calm'];

// taiko pattern over 16 steps: 2 = big drum (o-daiko), 1 = small drum (shime-daiko)
const TAIKO = [2, 0, 1, 0, 0, 1, 2, 0, 2, 0, 1, 1, 0, 1, 2, 1];

export class Music {
  constructor() { this.on = true; this.vol = 0.6; this.style = 'mix'; this.piece = 0; this.pieceUntil = 0; this.silentUntil = 0; this.mood = 'day'; this.ctx = null; this.k = 0; this.phrase = 0; this.restLeft = 4; this.deg = 5; this.step = 0; }

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
    // SID-style pulse waves
    const pulse = duty => { const N = 48, re = new Float32Array(N), im = new Float32Array(N); for (let n = 1; n < N; n++) re[n] = 2 / (n * Math.PI) * Math.sin(n * Math.PI * duty); return c.createPeriodicWave(re, im); };
    this.pulse12 = pulse(0.125); this.pulse25 = pulse(0.25); this.pulse50 = pulse(0.5);
    this.droneGain = c.createGain(); this.droneGain.gain.value = 0; this.droneGain.connect(this.dry);
    const lfo = c.createOscillator(), lfoG = c.createGain(); lfo.frequency.value = 0.07; lfoG.gain.value = 0.015; lfo.connect(lfoG).connect(this.droneGain.gain); lfo.start();
    for (const [f, t] of [[ROOT / 2, 'sine'], [ROOT * 0.75, 'sine'], [ROOT / 2 * 1.003, 'triangle']]) { const o = c.createOscillator(), g = c.createGain(); o.type = t; o.frequency.value = f; g.gain.value = t === 'triangle' ? 0.25 : 0.5; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; o.connect(lp).connect(g).connect(this.droneGain); o.start(); }
    this.setMood(this.mood, true);
    this.nextT = c.currentTime + 0.3;
    this.timer = setInterval(() => this.schedule(), 90);
    document.addEventListener('visibilitychange', () => { if (!this.ctx) return; if (document.hidden) this.ctx.suspend(); else if (this.on) this.ctx.resume(); });
    return c;
  }
  // off really means off: fade out, then stop the whole audio engine (iPad Safari doesn't always honour a volume of 0)
  setOn(on) {
    this.on = on; if (!this.ctx) return;
    clearTimeout(this.offT);
    if (on) { this.ctx.resume(); this.master.gain.cancelScheduledValues(this.ctx.currentTime); this.master.gain.setTargetAtTime(this.vol * 0.9, this.ctx.currentTime, 0.3); this.nextT = this.ctx.currentTime + 0.1; }
    else { this.master.gain.cancelScheduledValues(this.ctx.currentTime); this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08); this.offT = setTimeout(() => { if (!this.on && this.ctx) this.ctx.suspend(); }, 400); }
  }
  setVolume(v) { this.vol = v; if (this.ctx && this.on) this.master.gain.setTargetAtTime(v * 0.9, this.ctx.currentTime, 0.2); }
  setMood(m, now = false) {
    if (!MOODS[m] || (m === this.mood && !now)) return;
    this.mood = m;
    this.droneTo = null; // the scheduler fades the drone in or out for whatever is playing
  }
  setStyle(st) { this.style = ['calm', 'chip', 'piano', 'mix'].includes(st) ? st : 'mix'; this.step = 0; this.pieceUntil = 0; this.silentUntil = 0; this.setMood(this.mood, true); }
  // what is playing right now: in the mix, pieces take turns with a quiet pause between; fights always get the drums
  current(now) {
    if (this.mood === 'raid' || this.mood === 'battle') return this.style === 'calm' ? 'calm' : 'chip';
    if (this.style !== 'mix') return this.style;
    if (now < this.silentUntil) return 'silence';
    if (now >= this.pieceUntil) {
      if (this.pieceUntil) { this.silentUntil = now + 20 + Math.random() * 25; this.piece = (this.piece + 1) % MIX.length; this.pieceUntil = this.silentUntil + 150 + Math.random() * 90; this.step = 0; return 'silence'; }
      this.pieceUntil = now + 150 + Math.random() * 90;
    }
    return MIX[this.piece];
  }

  schedule() {
    if (!this.ctx || !this.on || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.nextT < now) this.nextT = now + 0.05;
    const st = this.current(now);
    const drone = st === 'calm' ? MOODS[this.mood].drone : 0;
    if (Math.abs(this.droneGain.gain.value - drone) > 0.005 && this.droneTo !== drone) { this.droneTo = drone; this.droneGain.gain.setTargetAtTime(drone, now, 2); }
    if (st === 'silence') { this.nextT = now + 0.1; return; }
    if (st === 'chip') { while (this.nextT < now + 0.25) { this.chipTick(this.nextT); this.nextT += 60 / CHIP[this.mood].tempo / 4; } return; }
    if (st === 'piano') { while (this.nextT < now + 0.35) { this.pianoTick(this.nextT); this.nextT += this.mood === 'night' ? 0.62 : 0.5; } return; }
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

  // ---- ambient piano: one eighth-note step (two bars per chord) ----
  pianoTick(t) {
    const s = this.step++, chordI = Math.floor(s / 16) % PIANO_CHORDS.length, pos = s % 16, r = Math.random, night = this.mood === 'night';
    const [root, tones] = PIANO_CHORDS[chordI];
    if (pos === 0) { this.piano(t, midi(root - 12), 0.19, 6); this.piano(t + 0.02, midi(root), 0.12, 6); }        // the bass rings for the whole chord
    // the chord's notes, slowly broken upward, some skipped
    if (pos % 2 === 0 && pos < 12 && r() < (night ? 0.45 : 0.62)) this.piano(t + r() * 0.05, midi(root + 12 + tones[(pos / 2) % tones.length]), 0.09 + r() * 0.04, 4.5);
    // now and then a quiet melody note high above
    if (pos % 4 === 2 && r() < (night ? 0.2 : 0.3)) { const m = root + 24 + PENTA[Math.floor(r() * 5)] + (r() < 0.4 ? 12 : 0); this.piano(t, midi(m), 0.085, 5); if (r() < 0.25) this.piano(t + 0.5, midi(m - 3 + (r() < 0.5 ? 0 : 5)), 0.065, 5); }
  }
  piano(t, f, vel, len) {
    const c = this.ctx, g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(9000, f * 9), t); lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.5), t + len * 0.6);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.008); g.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    // a hammered string: the note, its octave and a quiet slightly-out third partial
    for (const [mul, amp, type] of [[1, 1, 'triangle'], [2.001, 0.35, 'sine'], [3.003, 0.12, 'sine']]) { const o = c.createOscillator(), og = c.createGain(); o.type = type; o.frequency.value = f * mul; og.gain.value = amp; o.connect(og).connect(lp); o.start(t); o.stop(t + len + 0.05); }
    lp.connect(g); g.connect(this.dry); g.connect(this.reverb);
  }

  // ---- the chiptune: one sixteenth-note step of the theme ----
  chipTick(t) {
    const C = CHIP[this.mood], s = this.step++, bar = Math.floor(s / 16) % 16, pos = s % 16, sixteenth = 60 / C.tempo / 4;
    const [root, tones] = CHORDS[bar];
    // shimmering arpeggio: the chord's notes, one per sixteenth, two octaves up
    if (C.arp && Math.random() < C.arp) this.chip(t, midi(root + 24 + tones[pos % 4]), sixteenth * 0.9, this.pulse12, 0.028);
    // bouncing bass on the eighths: root, octave, fifth, octave
    if (pos % 2 === 0) this.chip(t, midi(root - 12 + [0, 12, 7, 12][(pos / 2) % 4]), sixteenth * 1.7, this.pulse50, 0.07);
    // the lead on the eighths
    if (pos % 2 === 0) {
      const row = THEME[bar], i = pos / 2, n = row[i];
      if (n > 0) { let len = 1; while (i + len < 8 && row[i + len] === 0) len++; this.lead(t, midi(n), len * sixteenth * 2 * 0.95); }
    }
    // drums: kick on 1 and 3, snare on 2 and 4, hi-hats (busier in a fight)
    if (C.drums) {
      if (pos === 0 || pos === 8 || (C.drums > 1 && pos === 10)) this.kick(t);
      if (pos === 4 || pos === 12) this.snare(t);
      if (C.drums > 1 || pos % 2 === 0) this.hat(t, pos % 4 === 2 ? 0.03 : 0.018);
    }
  }
  chip(t, f, len, wave, vol) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.setPeriodicWave(wave); o.frequency.value = f;
    g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + len + 0.02);
  }
  lead(t, f, len) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), vib = c.createOscillator(), vg = c.createGain();
    o.setPeriodicWave(this.pulse25); o.frequency.setValueAtTime(f, t);
    vib.frequency.value = 5.5; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(0, t + Math.min(0.18, len * 0.4)); vg.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.45, len)); vib.connect(vg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.085, t + 0.012); g.gain.setTargetAtTime(0.06, t + 0.05, 0.1); g.gain.setValueAtTime(0.06, t + Math.max(0.05, len - 0.04)); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(this.master); g.connect(this.reverb);
    o.start(t); vib.start(t); o.stop(t + len + 0.02); vib.stop(t + len + 0.02);
  }
  kick(t) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.25);
  }
  snare(t) {
    const c = this.ctx, n = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise; hp.type = 'highpass'; hp.frequency.value = 1200;
    g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    n.connect(hp).connect(g); g.connect(this.master); n.start(t, Math.random()); n.stop(t + 0.16);
  }
  hat(t, vol) {
    const c = this.ctx, n = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise; hp.type = 'highpass'; hp.frequency.value = 7000;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    n.connect(hp).connect(g); g.connect(this.master); n.start(t, Math.random()); n.stop(t + 0.05);
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
