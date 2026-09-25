// Falling things: sakura petals in spring, leaves in autumn, snow and rain. They follow the camera.
import * as THREE from 'three';

const N = 1400;
const KINDS = {
  petals: { color: '#f7c6d4', size: 0.32, fall: 0.9, drift: 1.4, count: 320 },
  leaves: { color: '#d8762e', size: 0.34, fall: 1.2, drift: 1.2, count: 260 },
  snow:   { color: '#f6f8fa', size: 0.26, fall: 1.6, drift: 0.6, count: 1300 },
  rain:   { color: '#a9bfd6', size: 0.14, fall: 18, drift: 0.2, count: 1400 },
};
export class Weather {
  constructor(scene) {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 3); this.seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { this.pos[i * 3] = (Math.random() - 0.5) * 120; this.pos[i * 3 + 1] = Math.random() * 40; this.pos[i * 3 + 2] = (Math.random() - 0.5) * 120; this.seed[i] = Math.random() * 10; }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({ size: 0.3, color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false });
    this.points = new THREE.Points(this.geo, this.mat); this.points.frustumCulled = false; this.points.visible = false;
    scene.add(this.points); this.kind = null; this.t = 0;
  }
  // kind: petals | leaves | snow | rain | null
  update(dt, focus, kind, visible) {
    this.t += dt;
    if (kind !== this.kind) { this.kind = kind; if (kind) { const K = KINDS[kind]; this.mat.color.set(K.color); this.mat.size = K.size; this.geo.setDrawRange(0, K.count); } }
    this.points.visible = !!kind && visible; if (!this.points.visible) return;
    const K = KINDS[kind], P = this.pos, fx = focus.x, fz = focus.z;
    for (let i = 0; i < K.count; i++) {
      const s = this.seed[i];
      P[i * 3 + 1] -= K.fall * dt * (0.7 + (s % 1) * 0.6);
      P[i * 3] += Math.sin(this.t * 1.3 + s) * K.drift * dt + (kind === 'rain' ? 0 : 0.4 * dt);
      P[i * 3 + 2] += Math.cos(this.t * 1.1 + s * 2) * K.drift * dt;
      // keep them in a box around what the camera looks at
      if (P[i * 3 + 1] < 0) { P[i * 3 + 1] = 30 + Math.random() * 10; P[i * 3] = fx + (Math.random() - 0.5) * 120; P[i * 3 + 2] = fz + (Math.random() - 0.5) * 120; }
      if (Math.abs(P[i * 3] - fx) > 60) P[i * 3] = fx - Math.sign(P[i * 3] - fx) * 59;
      if (Math.abs(P[i * 3 + 2] - fz) > 60) P[i * 3 + 2] = fz - Math.sign(P[i * 3 + 2] - fz) * 59;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}
