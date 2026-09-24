// Renderer, sky, sun/moon, day–night cycle, water and ambient particles.
import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../util.js';
import { MAT } from './geo.js';

// Day keyframes (t: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset)
const KEYS = [
  { t: 0.00, top: '#101c42', hor: '#2c3d66', fog: '#26345a', sun: '#a9bcff', sunI: 0.75, hemi: 0.62, stars: 1 },
  { t: 0.15, top: '#152450', hor: '#3a4670', fog: '#303b62', sun: '#b4c0ff', sunI: 0.75, hemi: 0.62, stars: 0.9 },
  { t: 0.21, top: '#28386c', hor: '#7a6488', fog: '#5e5a7c', sun: '#d7b8ea', sunI: 0.8, hemi: 0.66, stars: 0.4 },
  { t: 0.26, top: '#46669e', hor: '#e79a74', fog: '#c89e92', sun: '#ffac70', sunI: 1.2, hemi: 0.72, stars: 0.05 },
  { t: 0.31, top: '#4c7dbb', hor: '#f0c49a', fog: '#d8c7b2', sun: '#ffd09a', sunI: 1.9, hemi: 0.84, stars: 0 },
  { t: 0.38, top: '#4a8ad4', hor: '#cfe2ee', fog: '#c9dbe6', sun: '#fff1db', sunI: 2.6, hemi: 0.95, stars: 0 },
  { t: 0.62, top: '#4a8ad4', hor: '#d6e4ec', fog: '#cbdbe4', sun: '#fff1db', sunI: 2.6, hemi: 0.95, stars: 0 },
  { t: 0.69, top: '#4a74b4', hor: '#f0c090', fog: '#dcc2a8', sun: '#ffc88a', sunI: 1.9, hemi: 0.82, stars: 0 },
  { t: 0.74, top: '#3f5890', hor: '#ef8f62', fog: '#cf9a86', sun: '#ff9858', sunI: 1.2, hemi: 0.7, stars: 0.05 },
  { t: 0.79, top: '#26386e', hor: '#735c80', fog: '#58537a', sun: '#d7b8ea', sunI: 0.8, hemi: 0.66, stars: 0.4 },
  { t: 0.85, top: '#152450', hor: '#3a4670', fog: '#303b62', sun: '#b4c0ff', sunI: 0.75, hemi: 0.62, stars: 0.9 },
  { t: 1.00, top: '#101c42', hor: '#2c3d66', fog: '#26345a', sun: '#a9bcff', sunI: 0.75, hemi: 0.62, stars: 1 },
];
const C = hex => new THREE.Color(hex);
const KEYC = KEYS.map(k => ({ ...k, top: C(k.top), hor: C(k.hor), fog: C(k.fog), sun: C(k.sun) }));

const SKY_VS = `varying vec3 vDir; void main(){ vDir = position; vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
const SKY_FS = `
uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; uniform float stars; uniform float sunUp;
varying vec3 vDir;
float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
void main(){
  vec3 d = normalize(vDir); float h = d.y;
  vec3 col = mix(horizon, top, pow(smoothstep(-0.02, 0.65, h), 0.75));
  col = mix(col, horizon*0.55, smoothstep(0.0, -0.25, h));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * (pow(s, 1600.0) * 8.0 * sunUp + pow(s, 14.0) * 0.28);
  vec3 moon = normalize(-sunDir); float mo = max(dot(d, moon), 0.0);
  col += vec3(0.85,0.9,1.0) * pow(mo, 2600.0) * 5.0 * (1.0 - sunUp);
  if (stars > 0.0 && h > 0.0) { vec3 c = floor(d * 260.0); float st = step(0.9982, hash(c)); col += vec3(st) * stars * smoothstep(0.02, 0.3, h) * (0.6 + 0.4*hash(c+1.0)); }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function dotTexture(soft) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(soft ? 0.25 : 0.55, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Stage {
  constructor(canvas, quality = 'high') {
    this.quality = quality;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'low' ? 1 : quality === 'medium' ? 1.5 : 2));
    r.shadowMap.enabled = quality !== 'low';
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 3000);
    this.scene.fog = new THREE.Fog('#c9dbe6', 180, 700);

    this.skyU = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() }, stars: { value: 0 }, sunUp: { value: 1 } };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({ uniforms: this.skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false }));
    this.sky.frustumCulled = false; this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    this.hemi = new THREE.HemisphereLight('#dfe9ff', '#4d5b38', 0.9);
    this.scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight('#fff1db', 2.6);
    sun.castShadow = true;
    const size = quality === 'high' ? 2048 : 1024;
    sun.shadow.mapSize.set(size, size);
    const sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);

    // Water sheet under everything (terrain dips below it for lakes).
    const wg = new THREE.PlaneGeometry(2400, 2400, 1, 1); wg.rotateX(-Math.PI / 2);
    this.water = new THREE.Mesh(wg, MAT.water); this.water.position.y = -1.2; this.water.receiveShadow = true;
    this.scene.add(this.water);

    this.time = 0.33;       // time of day
    this.night = 0;         // 0 day … 1 deep night
    this._tmpA = new THREE.Color(); this._tmpB = new THREE.Color();
    this.focus = new THREE.Vector3();
    this.initParticles();
  }

  initParticles() {
    const N = 260, pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 120; pos[i * 3 + 1] = Math.random() * 30; pos[i * 3 + 2] = (Math.random() - 0.5) * 120; seed[i] = Math.random() * 100; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.petals = new THREE.Points(g, new THREE.PointsMaterial({ map: dotTexture(false), color: '#ffb8cc', size: 0.32, transparent: true, depthWrite: false, opacity: 0.9 }));
    this.petals.frustumCulled = false; this.petalSeed = seed;
    this.scene.add(this.petals);
    const M = 140, fp = new Float32Array(M * 3), fs = new Float32Array(M);
    for (let i = 0; i < M; i++) { fp[i * 3] = (Math.random() - 0.5) * 100; fp[i * 3 + 1] = 0.5 + Math.random() * 4; fp[i * 3 + 2] = (Math.random() - 0.5) * 100; fs[i] = Math.random() * 100; }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    this.flies = new THREE.Points(fg, new THREE.PointsMaterial({ map: dotTexture(true), color: '#d9ff8a', size: 0.7, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    this.flies.frustumCulled = false; this.flySeed = fs;
    this.scene.add(this.flies);
    this.pt = 0;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  // Blend the keyframes for time t and aim the sun.
  setTime(t) {
    this.time = ((t % 1) + 1) % 1;
    let i = 0; while (i < KEYC.length - 2 && KEYC[i + 1].t <= this.time) i++;
    const a = KEYC[i], b = KEYC[i + 1], k = smoothstep(0, 1, (this.time - a.t) / (b.t - a.t)); // eased, so colours drift instead of stepping
    const U = this.skyU;
    U.top.value.copy(a.top).lerp(b.top, k);
    U.horizon.value.copy(a.hor).lerp(b.hor, k);
    this.scene.fog.color.copy(a.fog).lerp(b.fog, k);
    const sunCol = this._tmpA.copy(a.sun).lerp(b.sun, k);
    U.sunColor.value.copy(sunCol);
    U.stars.value = lerp(a.stars, b.stars, k);
    this.hemi.intensity = lerp(a.hemi, b.hemi, k);
    this.hemi.color.set('#dfe9ff').lerp(this._tmpB.set('#8ea0dc'), U.stars.value * 0.7);
    this.hemi.groundColor.set('#4d5b38').lerp(this._tmpB.set('#2e3a4a'), U.stars.value * 0.7);
    // sun path: rises in the east (+x), sets in the west
    const ang = (this.time - 0.25) * Math.PI * 2;
    const up = Math.sin(ang);
    const dir = new THREE.Vector3(Math.cos(ang) * 0.85, up, 0.42).normalize();
    U.sunDir.value.copy(dir);
    U.sunUp.value = smoothstep(-0.08, 0.08, up);
    // after dusk the directional light becomes moonlight from the opposite side
    this.lightDir = up > -0.02 ? dir.clone() : dir.clone().multiplyScalar(-1);
    const minY = up > -0.02 ? 0.18 : 0.6; // moonlight stays high so night shadows don't swallow the village
    if (this.lightDir.y < minY) this.lightDir.y = minY;
    this.lightDir.normalize();
    this.sun.color.copy(sunCol);
    // the sun fades out before the moon fades in, so shadows never jump at the horizon
    this.sun.intensity = lerp(a.sunI, b.sunI, k) * smoothstep(0, 0.14, Math.abs(up));
    this.night = clamp(U.stars.value * 1.2 + (up < 0 ? 0.3 : 0), 0, 1);
    MAT.glow.emissiveIntensity = this.night * 2.2;
    this.renderer.toneMappingExposure = lerp(1.05, 1.4, this.night);
  }

  update(dt, focus, camPos) {
    this.focus.copy(focus);
    this.sky.position.copy(camPos);
    // keep the shadow camera centred on what you're looking at; snap to texels to stop shimmering
    const texel = 140 / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(fx, 0, fz);
    this.sun.position.set(fx + this.lightDir.x * 160, this.lightDir.y * 160, fz + this.lightDir.z * 160);
    this.water.position.x = focus.x; this.water.position.z = focus.z; // the sea follows you to the map and battlefields
    // particles
    this.pt += dt;
    const P = this.petals.geometry.attributes.position, arr = P.array, S = this.petalSeed;
    const day = 1 - this.night;
    this.petals.material.opacity = 0.85 * day;
    if (day > 0.05) {
      for (let i = 0; i < S.length; i++) {
        const j = i * 3;
        arr[j] += (0.9 + Math.sin(this.pt * 0.7 + S[i]) * 0.8) * dt;
        arr[j + 1] -= (0.55 + (S[i] % 1) * 0.4) * dt;
        arr[j + 2] += Math.cos(this.pt * 0.9 + S[i] * 1.3) * 0.7 * dt;
        if (arr[j + 1] < 0 || Math.abs(arr[j] - focus.x) > 70 || Math.abs(arr[j + 2] - focus.z) > 70) {
          arr[j] = focus.x + (Math.random() - 0.5) * 120; arr[j + 1] = 12 + Math.random() * 22; arr[j + 2] = focus.z + (Math.random() - 0.5) * 120;
        }
      }
      P.needsUpdate = true;
    }
    this.flies.material.opacity = this.night;
    if (this.night > 0.05) {
      const F = this.flies.geometry.attributes.position, fa = F.array, fs = this.flySeed;
      for (let i = 0; i < fs.length; i++) {
        const j = i * 3, s = fs[i];
        fa[j] += Math.sin(this.pt * 0.6 + s) * 0.6 * dt; fa[j + 2] += Math.cos(this.pt * 0.5 + s * 2) * 0.6 * dt;
        fa[j + 1] = 0.8 + Math.sin(this.pt * 0.8 + s) * 0.9 + (s % 3);
        if (Math.abs(fa[j] - focus.x) > 60 || Math.abs(fa[j + 2] - focus.z) > 60) { fa[j] = focus.x + (Math.random() - 0.5) * 100; fa[j + 2] = focus.z + (Math.random() - 0.5) * 100; }
      }
      F.needsUpdate = true;
    }
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
