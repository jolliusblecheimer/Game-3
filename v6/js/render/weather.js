// Falling things: sakura petals in spring, leaves in autumn, snow and rain. They follow the camera.
import * as THREE from 'three';

const N = 1400;
const KINDS = {
  petals: { color: '#f7c6d4', size: 0.32, fall: 0.9, drift: 1.4, count: 320 },
  leaves: { color: '#d8762e', size: 0.34, fall: 1.2, drift: 1.2, count: 260 },
  snow:   { color: '#f6f8fa', size: 0.26, fall: 1.6, drift: 0.6, count: 1300 },
  rain:   { color: '#a9bfd6', size: 0.14, fall: 18, drift: 0.2, count: 1400 },
};
// each kind gets its own little shape (white, tinted by the colour): without one, points are hard squares
function shape(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.translate(32, 32);
  if (kind === 'rain') { const g = x.createLinearGradient(0, -30, 0, 30); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)'); x.fillStyle = g; x.fillRect(-2, -30, 4, 60); }
  else if (kind === 'snow') { const g = x.createRadialGradient(0, 0, 0, 0, 0, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(-32, -32, 64, 64); }
  else if (kind === 'leaves') { x.rotate(0.6); x.beginPath(); x.moveTo(0, -28); x.quadraticCurveTo(22, 0, 0, 28); x.quadraticCurveTo(-22, 0, 0, -28); x.fill(); }
  else { x.rotate(-0.4); x.beginPath(); x.moveTo(0, 26); x.bezierCurveTo(-24, 8, -16, -26, -4, -22); x.lineTo(0, -14); x.lineTo(4, -22); x.bezierCurveTo(16, -26, 24, 8, 0, 26); x.fill(); }   // a sakura petal with its notch
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export class Weather {
  constructor(scene) {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 3); this.seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { this.pos[i * 3] = (Math.random() - 0.5) * 120; this.pos[i * 3 + 1] = Math.random() * 40; this.pos[i * 3 + 2] = (Math.random() - 0.5) * 120; this.seed[i] = Math.random() * 10; }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({ size: 0.3, color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false, alphaTest: 0.05 });
    this.maps = {};
    this.points = new THREE.Points(this.geo, this.mat); this.points.frustumCulled = false; this.points.visible = false;
    scene.add(this.points); this.kind = null; this.t = 0;
  }
  // kind: petals | leaves | snow | rain | null
  // close: you're on foot, so everything falls right past your eyes and must be small
  update(dt, focus, kind, visible, close = false) {
    this.t += dt;
    if (kind !== this.kind || close !== this.close) {
      this.kind = kind; this.close = close;
      if (kind) { const K = KINDS[kind]; this.mat.color.set(K.color); this.mat.size = K.size * (close ? (kind === 'rain' ? 0.8 : 0.35) : 1); this.geo.setDrawRange(0, K.count); this.mat.map = this.maps[kind] || (this.maps[kind] = shape(kind)); this.mat.needsUpdate = true; }
    }
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

// Chimney smoke: grey puffs that rise, drift and fade (a small pool shared by the whole village)
export class Smoke {
  constructor(scene) {
    this.max = 240;
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshLambertMaterial({ color: '#dcd7cf', transparent: true, opacity: 0.42, depthWrite: false }), this.max);
    this.mesh.count = 0; this.mesh.frustumCulled = false; scene.add(this.mesh);
    this.puffs = []; this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.sv = new THREE.Vector3();
  }
  // sources: [{ x, y, z, rate }]
  update(dt, sources, visible) {
    this.mesh.visible = visible; if (!visible) return;
    for (const s of sources) {
      s.t = (s.t ?? Math.random()) - dt;
      if (s.t <= 0 && this.puffs.length < this.max) { s.t = (0.8 + Math.random() * 0.7) / (s.rate || 1); this.puffs.push({ x: s.x + (Math.random() - 0.5) * 0.2, y: s.y, z: s.z, age: 0, life: 3.5 + Math.random() * 2, dx: 0.3 + Math.random() * 0.25, dz: 0.12 }); }
    }
    let i = 0;
    for (const p of this.puffs) {
      p.age += dt; if (p.age >= p.life) continue;
      p.y += dt * 0.9; p.x += p.dx * dt; p.z += p.dz * dt;
      const f = p.age / p.life, sc = (0.35 + f * 1.7) * Math.min(1, (1 - f) * 3, p.age * 4);
      this.m4.compose(this.v.set(p.x, p.y, p.z), this.q, this.sv.set(sc, sc, sc)); this.mesh.setMatrixAt(i++, this.m4);
    }
    this.puffs = this.puffs.filter(p => p.age < p.life);
    this.mesh.count = i; this.mesh.instanceMatrix.needsUpdate = true;
  }
}
