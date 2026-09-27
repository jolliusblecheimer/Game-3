// Sounds of the first-person fight, all synthesised (no files): the swish of a strike, steel on steel,
// the bright ring of a parry, a thump into straw, a kick, getting hurt, footsteps, water.
export class FPSound {
  constructor(getCtx) { this.getCtx = getCtx; this.on = true; this.last = {}; }
  ctx() { const c = this.getCtx(); if (c && c.state === 'suspended') c.resume(); return c && c.state === 'running' ? c : null; }
  noise(ac, out, t, dur, f, q, vol, type = 'bandpass', f2 = 0) {
    const len = Math.ceil(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5);
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = buf; fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl).connect(g).connect(out); s.start(t); s.stop(t + dur + 0.02);
  }
  tone(ac, out, t, f, dur, vol, type = 'sine', f2 = 0) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  play(kind, vol = 1) {
    if (!this.on) return;
    const now = performance.now(); if (now - (this.last[kind] || 0) < 45) return; this.last[kind] = now;
    const ac = this.ctx(); if (!ac) return;
    const t = ac.currentTime, out = ac.createGain(); out.gain.value = 0.6 * vol; out.connect(ac.destination);
    switch (kind) {
      case 'swish': this.noise(ac, out, t, 0.18, 900, 1.2, 0.35, 'bandpass', 2600); break;
      case 'swishHeavy': this.noise(ac, out, t, 0.28, 500, 1, 0.5, 'bandpass', 1900); break;
      case 'clash':   // steel on steel
        this.noise(ac, out, t, 0.08, 3200, 3, 0.5);
        for (const [f, v] of [[1870, 0.12], [2630, 0.08], [3410, 0.05]]) this.tone(ac, out, t, f, 0.35, v, 'triangle');
        break;
      case 'parry':   // a bright, ringing *kin*
        this.noise(ac, out, t, 0.05, 4500, 4, 0.5);
        for (const [f, v] of [[2340, 0.2], [3120, 0.14], [4680, 0.08], [1170, 0.1]]) this.tone(ac, out, t, f, 0.9, v, 'sine');
        break;
      case 'thud':    // a blade into straw
        this.noise(ac, out, t, 0.14, 700, 0.8, 0.7, 'lowpass', 200); this.noise(ac, out, t + 0.01, 0.2, 2400, 1.5, 0.2, 'bandpass', 900); break;
      case 'block': this.noise(ac, out, t, 0.1, 1400, 2, 0.5); this.tone(ac, out, t, 180, 0.12, 0.25, 'triangle', 90); break;
      case 'kick': this.tone(ac, out, t, 120, 0.14, 0.5, 'sine', 50); this.noise(ac, out, t, 0.08, 600, 1, 0.3, 'lowpass'); break;
      case 'hurt': this.tone(ac, out, t, 90, 0.25, 0.6, 'sine', 40); this.noise(ac, out, t, 0.18, 400, 0.7, 0.35, 'lowpass'); break;
      case 'whiff': this.noise(ac, out, t, 0.22, 700, 1, 0.3, 'bandpass', 1800); break;
      case 'step': this.noise(ac, out, t, 0.07, 260 + Math.random() * 120, 1, 0.16 * vol, 'lowpass'); break;
      case 'stepWood': this.noise(ac, out, t, 0.06, 500, 2, 0.2, 'bandpass'); this.tone(ac, out, t, 140 + Math.random() * 30, 0.06, 0.1, 'triangle'); break;
      case 'splash': this.noise(ac, out, t, 0.25, 1400, 0.6, 0.28, 'bandpass', 500); break;
      case 'tired': this.noise(ac, out, t, 0.35, 900, 0.5, 0.12, 'bandpass', 400); break;
      case 'bell': for (const [f, v] of [[660, 0.2], [990, 0.1]]) this.tone(ac, out, t, f, 1.2, v, 'sine'); break;
    }
  }
}
