// The country map: a miniature 3D province far from the village, covered by golden clouds (fog of war).
import * as THREE from 'three';
import { Mesher, MAT } from './geo.js';
import { buildModel } from './buildings.js';
import { Person } from './people.js';
import { MAP } from '../game/country.js';
import { SITES } from '../game/data.js';
import { makeNoise2D, fbm, mulberry32 } from '../util.js';

export const MAP_ORIGIN = new THREE.Vector3(-4000, 0, 0);

function mapColor(c, h, forest, slope) {
  if (h < -0.8) c.set('#c9b98e');
  else if (h > 44) c.set('#eef1f4');
  else if (h > 28 || slope > 0.8) c.set('#857f73');
  else if (forest > 0.15) c.set('#4e7a3c');
  else if (h > 16) c.set('#78985a');
  else c.set('#8bb462');
  return c;
}

// Golden clouds, drawn once, then masked by the fog each time it changes.
function cloudCanvas(size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), r = mulberry32(9);
  x.fillStyle = '#efe4c6'; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    const px = r() * size, py = r() * size, rad = 10 + r() * 34;
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    const gold = r() < 0.35;
    g.addColorStop(0, gold ? 'rgba(232,196,110,0.55)' : 'rgba(255,252,242,0.9)'); g.addColorStop(1, 'rgba(255,250,235,0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, rad, 0, Math.PI * 2); x.fill();
  }
  x.strokeStyle = 'rgba(190,150,70,0.35)'; x.lineWidth = 1.5;
  for (let i = 0; i < 70; i++) { const px = r() * size, py = r() * size, w = 20 + r() * 50; x.beginPath(); x.moveTo(px, py); x.bezierCurveTo(px + w * 0.3, py - 8, px + w * 0.7, py - 8, px + w, py); x.stroke(); }
  return c;
}

// your clan's war banner (nobori): planted on your village and every place you hold
function clanBanner(seed) {
  const g = new THREE.Group(), m = new Mesher(seed, 0.02), cloth = new Mesher(seed + 1, 0.02);
  m.cyl(0.18, 0.22, 11, 6, '#3b2619', [0, 5.5, 0]); m.cone(0.3, 0.8, 6, '#d9b24a', [0, 11.3, 0]);
  m.box(2.4, 0.16, 0.16, '#3b2619', [1.1, 10.6, 0]);
  cloth.box(2.2, 6.2, 0.1, '#b8342a', [1.2, 7.4, 0]); cloth.box(2.2, 0.35, 0.12, '#1c1a17', [1.2, 10.35, 0]);
  cloth.cyl(0.75, 0.75, 0.14, 16, '#f5efe0', [1.2, 8.6, 0], [Math.PI / 2, 0, 0]); cloth.cyl(0.42, 0.42, 0.16, 16, '#b8342a', [1.2, 8.6, 0], [Math.PI / 2, 0, 0]);
  g.add(m.mesh(MAT.flat)); const c = cloth.mesh(MAT.flat); g.add(c); g.userData.cloth = c;
  return g;
}
function siteModel(type, seed) {
  const g = new THREE.Group(), add = (m, x, z, s = 1, ry = 0) => { m.position.set(x, 0, z); m.scale.setScalar(s); m.rotation.y = ry; g.add(m); };
  const r = mulberry32(seed);
  if (type === 'hideout') {
    const m = new Mesher(seed, 0.08);
    for (let i = 0; i < 2; i++) { const a = i * 2.4 + r(); m.cone(1.2, 2.0, 6, i % 2 ? '#8a6a44' : '#6f5537', [Math.cos(a) * 2, 1.0, Math.sin(a) * 2]); }
    m.cyl(0.45, 0.5, 0.25, 8, '#5a4a3a', [0, 0.12, 0]); m.cone(0.3, 0.7, 6, '#ff9a4a', [0, 0.55, 0]);
    for (let i = 0; i < 5; i++) { const a = r() * Math.PI * 2, d = 3 + r() * 2; m.ball(0.9, '#3f5a2e', [Math.cos(a) * d, 0.7, Math.sin(a) * d]); }
    g.add(m.mesh(MAT.flat));
  } else if (type === 'bandits') {
    const m = new Mesher(seed, 0.08);
    for (let i = 0; i < 4; i++) { const a = i * 1.6 + r(); m.cone(1.6, 2.6, 6, i % 2 ? '#8a6a44' : '#7a5d3c', [Math.cos(a) * 3, 1.3, Math.sin(a) * 3]); }
    m.cyl(0.6, 0.7, 0.3, 8, '#5a4a3a', [0, 0.15, 0]); m.cone(0.4, 0.9, 6, '#ff9a4a', [0, 0.7, 0]);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; m.cyl(0.12, 0.12, 1.6, 5, '#8b7a4c', [Math.cos(a) * 5.5, 0.8, Math.sin(a) * 5.5]); }
    g.add(m.mesh(MAT.flat));
  } else if (type === 'village') {
    for (let i = 0; i < 5; i++) { const a = i * 1.3 + r(); add(buildModel('house', 4, 4, seed + i), Math.cos(a) * 4.5, Math.sin(a) * 4.5, 0.7, a); }
    add(buildModel('farm', 8, 8, seed), 7, 6, 0.6); add(buildModel('tower', 4, 4, seed), -6, 4, 0.6);
  } else if (type === 'fort' || type === 'smallcastle') {
    add(buildModel('tower', 4, 4, seed), 0, 0, 1.0);
    for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) add(buildModel('tower', 4, 4, seed), x, z, 0.7);
    const w = new Mesher(seed, 0.05);
    for (const [x, z, a] of [[0, -6, 0], [0, 6, 0], [-6, 0, 1], [6, 0, 1]]) { w.box(a ? 1.2 : 11, 2.2, a ? 11 : 1.2, '#8e897e', [x, 1.1, z]); w.box(a ? 1.0 : 11, 0.9, a ? 11 : 1.0, '#efe7d6', [x, 2.6, z]); }
    g.add(w.mesh(MAT.flat)); add(buildModel('house', 4, 4, seed), 3, -2, 0.6);
  } else if (type === 'castle' || type === 'warlord') {
    add(buildModel('townhall', 8, 8, seed), 0, -1, 0.95);
    const w = new Mesher(seed, 0.05);
    for (const [x, z, a] of [[0, -9, 0], [0, 9, 0], [-9, 0, 1], [9, 0, 1]]) { w.frustum(a ? 2.4 : 18, a ? 18 : 2.4, a ? 1.6 : 18, a ? 18 : 1.6, 2.6, '#8e897e', [x, 0, z]); w.box(a ? 1.2 : 17, 1.1, a ? 17 : 1.2, '#efe7d6', [x, 3.1, z]); }
    g.add(w.mesh(MAT.flat));
    for (const [x, z] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) add(buildModel('tower', 4, 4, seed), x, z, 0.8);
  } else { // ruins
    add(buildModel('torii', 4, 2, seed), 0, 3, 0.9, 0.3);
    const m = new Mesher(seed, 0.12);
    for (let i = 0; i < 7; i++) m.add(new THREE.DodecahedronGeometry(0.8 + r() * 0.9, 0), '#8a857a', [(r() - 0.5) * 8, 0.4, (r() - 0.5) * 7], [r(), r(), r()], [1, 0.6, 1]);
    m.box(4, 0.3, 3, '#6d685f', [0, 0.15, -2], [0, 0.4, 0]); g.add(m.mesh(MAT.flat));
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export class CountryMap {
  constructor(scene, country) {
    this.scene = scene; this.country = country;
    this.root = new THREE.Group(); this.root.position.copy(MAP_ORIGIN); this.root.visible = false;
    scene.add(this.root);
    this.buildTerrain();
    this.buildForest();
    this.buildSites();
    this.buildFog();
    this.markers = new Map();
    this.pathLines = new THREE.Group(); this.root.add(this.pathLines);
    const ringGeo = new THREE.RingGeometry(9, 11, 40); ringGeo.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ringGeo, MAT.select); this.ring.visible = false; this.root.add(this.ring);
    const pinGeo = new THREE.ConeGeometry(1.6, 5, 8); pinGeo.rotateX(Math.PI);
    this.pin = new THREE.Mesh(pinGeo, new THREE.MeshStandardMaterial({ color: '#b8392a', emissive: '#5a1008' })); this.pin.visible = false; this.root.add(this.pin);
  }
  h(x, z) { return Math.max(-1.2, this.country.height(x, z)); }
  buildTerrain() {
    const size = MAP.half * 2 + 160, seg = 200, H = this.country.height, n = makeNoise2D(this.country.game.state.seed + 404);
    const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
    const P = g.attributes.position, col = new Float32Array(P.count * 3), c = new THREE.Color();
    for (let i = 0; i < P.count; i++) P.setY(i, H(P.getX(i), P.getZ(i)));
    g.computeVertexNormals();
    const N = g.attributes.normal;
    this.forest = (x, z) => fbm(n, x * 0.012, z * 0.012, 3);
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), z = P.getZ(i);
      mapColor(c, P.getY(i), this.forest(x, z), (1 - N.getY(i)) * 3);
      c.offsetHSL(0, 0, n(x * 0.1, z * 0.1) * 0.02);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
    m.receiveShadow = true; this.terrain = m; this.root.add(m);
  }
  buildForest() {
    const t = new Mesher(5, 0.08); t.cyl(0.15, 0.2, 1.2, 5, '#4a3222', [0, 0.6, 0]); t.cone(1.3, 3.2, 6, '#2f5a36', [0, 2.4, 0]); t.cone(0.9, 2.2, 6, '#3b6f42', [0, 3.6, 0]);
    const geo = t.geometry(), r = mulberry32(this.country.game.state.seed + 5), list = [];
    for (let i = 0; i < 9000 && list.length < 3200; i++) {
      const x = (r() - 0.5) * 2 * MAP.half, z = (r() - 0.5) * 2 * MAP.half, h = this.country.height(x, z);
      if (h < 0.5 || h > 30 || this.forest(x, z) < 0.12) continue;
      if (Math.hypot(x, z) < 22 || this.country.sites.some(s => Math.hypot(s.x - x, s.z - z) < 14)) continue;
      list.push([x, h, z, 0.8 + r() * 0.7]);
    }
    const im = new THREE.InstancedMesh(geo, MAT.flat, list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    list.forEach(([x, y, z, s], i) => { m4.compose(new THREE.Vector3(x, y - 0.2, z), q, new THREE.Vector3(s, s, s)); im.setMatrixAt(i, m4); });
    im.castShadow = true; im.receiveShadow = true; this.root.add(im);
  }
  buildSites() {
    this.siteObjs = new Map();
    const home = new THREE.Group();
    const keep = buildModel('townhall', 8, 8, 1); keep.scale.setScalar(0.9); home.add(keep);
    for (let i = 0; i < 6; i++) { const a = i * 1.05, hm = buildModel('house', 4, 4, i); hm.scale.setScalar(0.7); hm.position.set(Math.cos(a) * 9, 0, Math.sin(a) * 9); hm.rotation.y = -a; home.add(hm); }
    const hb = clanBanner(7); hb.position.set(-6, 0, -6); home.add(hb);
    home.position.set(0, this.h(0, 0), 0); home.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.mapPick = { kind: 'home' }; } });
    this.root.add(home);
    this.banners = [hb];
    for (const s of this.country.sites) {
      const g = siteModel(s.type, s.seed); g.position.set(s.x, this.h(s.x, s.z), s.z);
      g.traverse(o => { if (o.isMesh) o.userData.mapPick = { kind: 'site', id: s.id }; });
      this.root.add(g); this.siteObjs.set(s.id, g);
      const b = clanBanner(s.seed); b.position.set(s.x + 6, this.h(s.x + 6, s.z - 4), s.z - 4); b.visible = false;
      b.traverse(o => { if (o.isMesh) o.userData.mapPick = { kind: 'site', id: s.id }; });
      this.root.add(b); s._banner = b; this.banners.push(b);
    }
  }
  buildFog() {
    const N = MAP.fogN;
    this.cloudBase = cloudCanvas(512);
    this.fogCanvas = document.createElement('canvas'); this.fogCanvas.width = this.fogCanvas.height = 512;
    this.maskCanvas = document.createElement('canvas'); this.maskCanvas.width = this.maskCanvas.height = N;
    this.fogTex = new THREE.CanvasTexture(this.fogCanvas); this.fogTex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: this.fogTex, transparent: true, depthWrite: false, fog: false, toneMapped: false });
    const geo = new THREE.PlaneGeometry(MAP.half * 2, MAP.half * 2); geo.rotateX(-Math.PI / 2);
    this.fog = new THREE.Mesh(geo, mat); this.fog.position.y = 24; this.fog.renderOrder = 5;
    this.root.add(this.fog);
    // a lower cloud layer that hugs the hills gives the fog some depth
    this.fog2 = new THREE.Mesh(geo, mat); this.fog2.position.y = 12; this.fog2.renderOrder = 4; this.root.add(this.fog2);
    this.redrawFog();
  }
  redrawFog() {
    const N = MAP.fogN, mctx = this.maskCanvas.getContext('2d'), img = mctx.createImageData(N, N), F = this.country.fog;
    for (let i = 0; i < N * N; i++) { img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = 255 - F[i]; }
    mctx.putImageData(img, 0, 0);
    const c = this.fogCanvas.getContext('2d');
    c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, 512, 512);
    c.imageSmoothingEnabled = true; c.drawImage(this.maskCanvas, 0, 0, 512, 512);      // soft alpha mask
    c.globalCompositeOperation = 'source-in'; c.drawImage(this.cloudBase, 0, 0);         // clouds only where hidden
    c.globalCompositeOperation = 'source-over';
    this.fogTex.needsUpdate = true;
    this.country.fogDirty = false;
  }
  personMarker(look, n = 1) {
    const g = new THREE.Group();
    for (let i = 0; i < n; i++) { const p = new Person(look, 7 + i); p.group.position.set((i % 3 - 1) * 1.6, 0, Math.floor(i / 3) * 1.6); g.add(p.group); g.userData.people = (g.userData.people || []).concat(p); }
    g.scale.setScalar(2.6); return g;
  }
  update(dt, t) {
    const C = this.country;
    if (C.fogDirty) this.redrawFog();
    this.fog.material.map.offset.set(Math.sin(t * 0.01) * 0.003, 0);
    this.banners.forEach((b, i) => { if (b.visible) b.userData.cloth.rotation.y = Math.sin(t * 1.3 + i) * 0.18; });
    for (const s of C.sites) {
      const st = C.status(s), obj = this.siteObjs.get(s.id);
      obj.visible = st !== 'hidden';
      s._banner.visible = st === 'held';
      obj.traverse(o => { if (o.isMesh && o.material === MAT.flat && st === 'ruined' && s.type !== 'ruins') o.scale.y = 0.35; });
    }
    // missions on the move
    const seen = new Set();
    for (const m of C.missions) {
      seen.add(m.id);
      let mk = this.markers.get(m.id);
      if (!mk) { mk = m.kind === 'scout' ? this.personMarker('villager') : this.personMarker('ashigaru', Math.min(5, m.vids.length)); this.root.add(mk); this.markers.set(m.id, mk); }
      const p = C.posOf(m), [a, b] = m.phase === 'back' ? [m.to, m.from] : [m.from, m.to];
      mk.position.set(p.x, this.h(p.x, p.z) + 0.2, p.z); mk.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
      for (const person of mk.userData.people || []) person.animate(dt, m.phase === 'ready' ? 'guard' : 'walk');
    }
    for (const [id, mk] of this.markers) if (!seen.has(id)) { this.root.remove(mk); this.markers.delete(id); }
    // dotted route lines (rebuilt only when missions change)
    const key = C.missions.map(m => m.id + m.phase).join('|');
    if (key === this.lineKey) return;
    this.lineKey = key;
    this.pathLines.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.pathLines.clear();
    for (const m of C.missions) {
      const pts = []; const [a, b] = [m.from, m.to];
      for (let i = 0; i <= 40; i++) { const f = i / 40, x = a.x + (b.x - a.x) * f, z = a.z + (b.z - a.z) * f; pts.push(new THREE.Vector3(x, this.h(x, z) + 1.2, z)); }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: m.kind === 'scout' ? '#f4ecdb' : '#b8392a', dashSize: 3, gapSize: 2.5 }));
      line.computeLineDistances(); this.pathLines.add(line);
    }
  }
  worldPos(x, z, y = 0) { return new THREE.Vector3(MAP_ORIGIN.x + x, this.h(x, z) + y, MAP_ORIGIN.z + z); }
  select(site) {
    this.ring.visible = !!site; this.pin.visible = false;
    if (site) this.ring.position.set(site.x, this.h(site.x, site.z) + 0.6, site.z);
  }
  pinAt(p) { this.pin.visible = !!p; this.ring.visible = false; if (p) this.pin.position.set(p.x, this.h(p.x, p.z) + 4, p.z); }
}
