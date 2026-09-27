// What a clash looks like: sparks where steel meets steel, a flash of light, and bigger showers when a guard
// breaks. Additive, so they glow at night too.
import * as THREE from 'three';

function dotTex() {
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d');
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,230,160,0.8)'); g.addColorStop(1, 'rgba(255,160,40,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Sparks {
  constructor(parent, n = 160) {
    this.n = n; this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.k = 0;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.tex = dotTex();
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ map: this.tex, size: 0.11, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffe2a0' }));
    this.points.frustumCulled = false; parent.add(this.points);
    // a flash: a bright disc that grows and fades in a blink
    this.flashes = [];
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: '#fff2c8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      s.visible = false; parent.add(s); this.flashes.push({ s, t: 0, max: 1 });
    }
    this.fk = 0;
    for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -999;
  }
  // at (x, y, z) local metres; dir: the way the shower flies; power: 1 for a block, 2+ for a broken guard
  burst(x, y, z, power = 1, dx = 0, dz = 0) {
    const n = Math.round(14 * power);
    for (let i = 0; i < n; i++) {
      const j = this.k++ % this.n, a = Math.random() * Math.PI * 2, sp = (2.5 + Math.random() * 4.5) * (0.7 + power * 0.3);
      this.pos[j * 3] = x; this.pos[j * 3 + 1] = y; this.pos[j * 3 + 2] = z;
      this.vel[j * 3] = Math.cos(a) * sp * 0.6 + dx * 2; this.vel[j * 3 + 1] = 1 + Math.random() * 3.5; this.vel[j * 3 + 2] = Math.sin(a) * sp * 0.6 + dz * 2;
      this.life[j] = 0.25 + Math.random() * 0.35;
    }
    const f = this.flashes[this.fk++ % this.flashes.length];
    f.s.position.set(x, y, z); f.s.visible = true; f.t = 0; f.max = 0.35 + power * 0.25; f.big = power;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -999; continue; }
      this.vel[i * 3 + 1] -= 9.8 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    for (const f of this.flashes) {
      if (!f.s.visible) continue;
      f.t += dt; const k = f.t / 0.14;
      if (k >= 1) { f.s.visible = false; continue; }
      f.s.material.opacity = 1 - k; f.s.scale.setScalar(f.max * (0.4 + k));
    }
  }
}
