// GRAPHICS PREVIEW — upgraded looks for the same game, to compare before deciding.
//  • ambient occlusion (soft contact shadows), bloom (lanterns and windows glow at night)
//  • tilt-shift (the village as a miniature diorama), a warm film grade, vignette and paper grain
//  • crisper soft shadows, trees and grass swaying in the wind, water with waves and glints, drifting clouds
// Every effect can be switched on and off in the little panel, with a frame counter to see what the device manages.
import * as THREE from 'three';
import { MAT } from './geo.js';

const CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/';
const DEFAULTS = { wind: true, water: true, clouds: true, hdShadows: true };   // (the screen filters are gone: this preview is about more detailed models)

const INK_FILM = {
  uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(1, 1) }, tilt: { value: 1 }, grade: { value: 1 }, time: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 res; uniform float tilt, grade, time; varying vec2 vUv;
    vec3 blur(vec2 uv, float r) {
      vec3 c = vec3(0.0); float w = 0.0;
      for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) { vec2 o = vec2(float(i), float(j)) * r / res; float k = 1.0 / (1.0 + float(i * i + j * j)); c += texture2D(tDiffuse, uv + o).rgb * k; w += k; }
      return c / w;
    }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // tilt-shift: sharp in a band through the middle, softening toward the top and bottom
      if (tilt > 0.0) { float d = smoothstep(0.16, 0.5, abs(vUv.y - 0.52)); if (d > 0.001) c = mix(c, blur(vUv, 3.2 * d * tilt), d * tilt); }
      if (grade > 0.0) {
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        vec3 g = mix(vec3(l), c, 1.1);                        // a touch more colour
        g *= vec3(1.035, 1.0, 0.95);                          // warm light
        g += vec3(0.010, 0.006, 0.0) * (1.0 - smoothstep(0.0, 0.5, l));   // warm, lifted shadows
        float v = smoothstep(1.05, 0.35, length((vUv - 0.5) * vec2(1.1, 1.25)));   // vignette
        g *= mix(0.78, 1.0, v);
        float n = fract(sin(dot(vUv * res + time * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
        g += (n - 0.5) * 0.018;                                // paper grain
        c = mix(c, g, grade);
      }
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export class GfxPreview {
  constructor(stage, nature) {
    this.stage = stage; this.nature = nature; this.R = stage.renderer;
    this.O = { ...DEFAULTS }; try { Object.assign(this.O, JSON.parse(localStorage.getItem('tenka.gfx.opts') || '{}')); } catch (_) { /* */ }
    this.time = { value: 0 }; this.fps = 60; this.ready = false;
    this.makeWind(); this.makeWater(); this.makeClouds(); this.applyShadows();
    this.panel();
  }
  save() { try { localStorage.setItem('tenka.gfx.opts', JSON.stringify(this.O)); } catch (_) { /* */ } }

  /* ---------- the effects that need three.js add-ons: loaded from the official package ---------- */
  async loadPost() {
    try {
      const [{ EffectComposer }, { RenderPass }, { GTAOPass }, { UnrealBloomPass }, { ShaderPass }, { OutputPass }] = await Promise.all([
        import(CDN + 'postprocessing/EffectComposer.js'), import(CDN + 'postprocessing/RenderPass.js'), import(CDN + 'postprocessing/GTAOPass.js'),
        import(CDN + 'postprocessing/UnrealBloomPass.js'), import(CDN + 'postprocessing/ShaderPass.js'), import(CDN + 'postprocessing/OutputPass.js')]);
      const { scene, camera } = this.stage, w = innerWidth, h = innerHeight;
      const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });   // smooth edges
      const C = this.composer = new EffectComposer(this.R, rt);
      C.addPass(new RenderPass(scene, camera));
      this.ao = new GTAOPass(scene, camera, w, h);
      this.ao.updateGtaoMaterial({ radius: 2.2, distanceExponent: 1.4, thickness: 1.2, scale: 1.25, samples: 12 });
      this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 8 });
      this.ao.blendIntensity = 0.85;
      C.addPass(this.ao);
      this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.5, 0.55, 1.0); C.addPass(this.bloom);
      this.film = new ShaderPass(INK_FILM); C.addPass(this.film);
      C.addPass(new OutputPass());
      this.resize(); this.ready = true; this.applyToggles();
      this.status.textContent = '';
    } catch (e) {
      console.warn('Graphics preview: effects could not load', e);
      this.status.textContent = 'The screen effects could not load (no internet?). The other upgrades still work.';
    }
  }
  resize() {
    if (!this.composer) return;
    const pr = this.R.getPixelRatio(), w = innerWidth, h = innerHeight;
    this.composer.setPixelRatio(pr); this.composer.setSize(w, h);
    this.film.uniforms.res.value.set(w * pr, h * pr);
  }
  applyToggles() {
    const O = this.O;
    if (this.ready) { this.ao.enabled = O.ao; this.bloom.enabled = O.bloom; }
    for (const m of this.windMats) m.userData.on.value = O.wind ? 1 : 0;
    this.water.material = O.water ? this.waterMat : this.waterMat0; this.water.geometry = O.water ? this.waterGeo : this.waterGeo0;
    this.clouds.visible = O.clouds;
    this.applyShadows();
  }
  applyShadows() {
    const s = this.stage.sun.shadow, size = this.O.hdShadows ? 4096 : (this.stage.quality === 'high' ? 2048 : 1024);
    if (s.mapSize.x !== size) { s.mapSize.set(size, size); if (s.map) { s.map.dispose(); s.map = null; } }
    s.radius = this.O.hdShadows ? 3 : 1; s.bias = -0.0003; s.normalBias = this.O.hdShadows ? 0.02 : 0.03;
  }

  /* ---------- wind: trees and grass sway (a small change to their shader) ---------- */
  makeWind() {
    const mk = (amp, key) => {
      const m = MAT.flat.clone(); m.userData.on = { value: 1 };
      m.customProgramCacheKey = () => key;
      m.onBeforeCompile = sh => {
        sh.uniforms.uTime = this.time; sh.uniforms.uWind = m.userData.on;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            #ifdef USE_INSTANCING
              vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
            #else
              vec3 ip = vec3(0.0);
            #endif
            float hh = max(0.0, transformed.y);
            float ph = ip.x * 0.11 + ip.z * 0.07;
            float sway = (sin(uTime * 1.2 + ph) * 0.7 + sin(uTime * 2.9 + ph * 1.9) * 0.3) * ${amp.toFixed(4)} * hh * hh * uWind;
            transformed.x += sway; transformed.z += sway * 0.55;`);
      };
      return m;
    };
    this.windTree = mk(0.012, 'wind-tree'); this.windGrass = mk(0.9, 'wind-grass');
    this.windMats = [this.windTree, this.windGrass];
    this.assignWind();
  }
  // (trees are planted and regrow over time, so this is checked again now and then)
  assignWind() {
    const N = this.nature;
    for (const im of Object.values(N.forestMesh || {})) im.material = this.windTree;
    for (const im of Object.values(N.treeMesh || {})) im.material = this.windTree;
    for (const im of Object.values(N.nearMesh || {})) im.material = this.windTree;
    if (N.grassMesh) N.grassMesh.material = this.windGrass;
  }
  /* ---------- water: small waves and glints of the sky ---------- */
  makeWater() {
    const W = this.water = this.stage.water;
    this.waterGeo0 = W.geometry; this.waterMat0 = W.material;
    const g = new THREE.PlaneGeometry(2400, 2400, 180, 180); g.rotateX(-Math.PI / 2); this.waterGeo = g;
    const m = new THREE.MeshStandardMaterial({ color: '#3a7f9e', roughness: 0.06, metalness: 0.25, transparent: true, opacity: 0.88 });
    m.customProgramCacheKey = () => 'waves';
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = this.time;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vWP;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 wp0 = modelMatrix * vec4(transformed, 1.0);
          transformed.y += sin(wp0.x * 0.18 + uTime * 1.1) * 0.07 + sin(wp0.z * 0.23 - uTime * 0.9) * 0.06 + sin((wp0.x + wp0.z) * 0.5 + uTime * 2.0) * 0.02;
          vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vWP;')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          vec3 wn = vec3(cos(vWP.x * 0.18 + uTime * 1.1) * 0.013 + cos((vWP.x + vWP.z) * 0.5 + uTime * 2.0) * 0.01 + sin(vWP.x * 1.7 + uTime * 3.1) * 0.035,
                         1.0,
                         cos(vWP.z * 0.23 - uTime * 0.9) * 0.014 + sin(vWP.z * 1.9 - uTime * 2.6) * 0.035);
          normal = normalize((viewMatrix * vec4(normalize(wn), 0.0)).xyz);`);
    };
    this.waterMat = m;
  }
  /* ---------- clouds: soft ink-wash billows drifting high above ---------- */
  makeClouds() {
    const tex = (() => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
      for (let i = 0; i < 26; i++) {
        const px = 30 + Math.random() * 196, py = 50 + Math.random() * 40 - Math.abs(px - 128) * 0.15, r = 18 + Math.random() * 34;
        const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
      }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    this.clouds = new THREE.Group(); this.cloudList = [];
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.8 }));
      const a = Math.random() * Math.PI * 2, r = 180 + Math.random() * 380;
      s.userData = { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 110 + Math.random() * 70, v: 1.5 + Math.random() * 2.5 };
      s.scale.set(160 + Math.random() * 120, 70 + Math.random() * 40, 1);
      this.clouds.add(s); this.cloudList.push(s);
    }
    this.stage.scene.add(this.clouds);
  }

  /* ---------- the panel: switch each effect, see the frame rate ---------- */
  panel() {
    const box = document.createElement('div'); box.className = 'gfxpanel';
    const names = { wind: 'Wind in trees and grass', water: 'Waves and glints on the water', clouds: 'Drifting clouds', hdShadows: 'Crisper shadows (for the finer detail)' };
    box.innerHTML = `<div class="gp-head"><b>Detail preview</b><span class="gp-fps">— fps</span><button class="gp-min" title="Fold">–</button></div><div class="gp-body"></div><p class="gp-note">More detailed roofs, posts, windows, trees, rocks, grass, flowers and people.</p><p class="gp-status"></p>
      <div class="gp-foot"><button class="gp-all">All off / on</button><button class="gp-copy">Copy my village again</button><a href="../">Main game</a></div>`;
    const body = box.querySelector('.gp-body');
    for (const [k, label] of Object.entries(names)) {
      const l = document.createElement('label'); l.innerHTML = `<input type="checkbox"${this.O[k] ? ' checked' : ''}> ${label}`;
      l.querySelector('input').onchange = e => { this.O[k] = e.target.checked; this.save(); this.applyToggles(); };
      body.append(l);
    }
    box.querySelector('.gp-min').onclick = () => box.classList.toggle('min');
    box.querySelector('.gp-all').onclick = () => { const on = !Object.values(this.O).some(Boolean); for (const k in this.O) this.O[k] = on; this.save(); body.querySelectorAll('input').forEach((c, i) => { c.checked = on; }); this.applyToggles(); };
    box.querySelector('.gp-copy').onclick = () => { if (!confirm('Replace the village in this preview with a fresh copy of your village from the main game?')) return; try { const raw = localStorage.getItem('tenka.save.v1'); if (raw) { localStorage.setItem('tenka.gfx.save', raw); window.tenka && window.tenka.save && window.tenka.save.block && window.tenka.save.block(); location.reload(); } } catch (_) { /* */ } };
    this.fpsEl = box.querySelector('.gp-fps'); this.status = box.querySelector('.gp-status');
    document.body.append(box);
  }

  render(dt) {
    this.time.value += dt;
    this.windT = (this.windT || 0) + dt; if (this.windT > 2) { this.windT = 0; this.assignWind(); }
    this.fps += ((dt > 0 ? 1 / dt : 60) - this.fps) * 0.05;
    this.fpsT = (this.fpsT || 0) + dt; if (this.fpsT > 0.5) { this.fpsT = 0; this.fpsEl.textContent = `${Math.round(this.fps)} fps`; }
    // clouds drift and stay above wherever you look; they fade at night
    const f = this.stage.focus, day = 1 - this.stage.night;
    for (const s of this.cloudList) {
      const u = s.userData; u.x += u.v * dt; if (u.x > 600) u.x -= 1200;
      s.position.set(f.x + u.x, u.y, f.z + u.z); s.material.opacity = 0.25 + 0.6 * day;
      s.material.color.setScalar(0.45 + 0.55 * day);
    }
    this.R.render(this.stage.scene, this.stage.camera);
  }
}
