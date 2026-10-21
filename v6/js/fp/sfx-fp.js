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
  // the creak of a bow being drawn: it swells over the draw and stops when you loose or let go
  drawStart(sec = 1) {
    if (!this.on) return null; const ac = this.ctx(); if (!ac) return null;
    const t = ac.currentTime, out = ac.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.35, t + sec * 0.9); out.connect(ac.destination);
    const len = Math.ceil(ac.sampleRate * (sec + 3)), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.sin(i / ac.sampleRate * 38 * Math.PI));   // a grainy creak
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(); s.buffer = buf; f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(260, t); f.frequency.linearRampToValueAtTime(620, t + sec);
    const o = ac.createOscillator(), og = ac.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(115, t + sec); og.gain.value = 0.25;
    s.connect(f).connect(out); o.connect(og).connect(out); s.start(t); o.start(t);
    return { stop: () => { try { const n = ac.currentTime; out.gain.cancelScheduledValues(n); out.gain.setValueAtTime(out.gain.value, n); out.gain.exponentialRampToValueAtTime(0.0001, n + 0.06); s.stop(n + 0.08); o.stop(n + 0.08); } catch (_) { /* done */ } } };
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
      case 'flesh':   // a blade finds its mark
        this.noise(ac, out, t, 0.12, 500, 0.7, 0.8, 'lowpass', 150); this.noise(ac, out, t, 0.1, 1800, 2, 0.25, 'bandpass', 700); this.tone(ac, out, t, 110, 0.16, 0.35, 'sine', 60); break;
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
      case 'break':   // a guard smashed open: a heavy crack of steel and a thump
        this.noise(ac, out, t, 0.18, 2400, 1.2, 0.9); this.tone(ac, out, t, 70, 0.4, 0.8, 'sine', 35); this.noise(ac, out, t + 0.02, 0.35, 600, 0.6, 0.5, 'lowpass', 120);
        for (const [f, v] of [[1320, 0.12], [1980, 0.08]]) this.tone(ac, out, t, f, 0.5, v, 'triangle', f * 0.7); break;
      case 'loose':   // the string's twang and the arrow leaving
        this.tone(ac, out, t, 196, 0.45, 0.4, 'triangle', 150); this.tone(ac, out, t, 392, 0.25, 0.14, 'sine', 300);
        this.noise(ac, out, t, 0.05, 3500, 2, 0.5); this.noise(ac, out, t + 0.02, 0.35, 1800, 1, 0.25, 'bandpass', 700); break;
      case 'fullDraw': for (const [f, v] of [[1568, 0.12], [2349, 0.07]]) this.tone(ac, out, t, f, 0.5, v, 'sine'); break;   // a bright little ping: ready
      case 'thunk':   // an arrow into the wooden target
        this.tone(ac, out, t, 240, 0.12, 0.55, 'triangle', 120); this.noise(ac, out, t, 0.06, 1200, 1.5, 0.5); this.tone(ac, out, t + 0.02, 520, 0.2, 0.1, 'sine', 470); break;
      case 'bull': for (const [f, v, d] of [[1047, 0.16, 0], [1319, 0.14, 0.07], [1568, 0.14, 0.14], [2093, 0.1, 0.21]]) this.tone(ac, out, t + d, f, 0.6, v, 'sine'); break;   // bullseye: a rising chime
      case 'breath': this.noise(ac, out, t, 0.55, 700, 0.6, 0.18, 'bandpass', 350); this.noise(ac, out, t + 0.6, 0.45, 600, 0.6, 0.12, 'bandpass', 300); break;
      case 'roar': this.tone(ac, out, t, 90, 0.9, 0.5, 'sawtooth', 60); this.noise(ac, out, t, 0.9, 400, 0.6, 0.4, 'lowpass', 150); break;
      case 'alarm': for (let i = 0; i < 3; i++) { this.tone(ac, out, t + i * 0.22, 80, 0.25, 0.6, 'sine', 45); this.noise(ac, out, t + i * 0.22, 0.12, 300, 1, 0.4, 'lowpass'); } break;
      case 'heart': this.tone(ac, out, t, 55, 0.12, 0.5, 'sine', 40); this.tone(ac, out, t + 0.18, 50, 0.12, 0.35, 'sine', 38); break;
      case 'dodge': this.noise(ac, out, t, 0.25, 900, 0.8, 0.35, 'bandpass', 300); break;
    }
  }
}
