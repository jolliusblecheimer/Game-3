// Villager & soldier models with simple limb animation.
import * as THREE from 'three';
import { Mesher, MAT } from './geo.js';
import { mulberry32 } from '../util.js';

const SKIN = ['#f1d2b0', '#e8c29c', '#dcb088', '#e9c8a8', '#d3a47c'];
const HAIR = '#1b1714';
const CLAN = '#b8342a';

// Look presets: clothes, headwear, tools, armour.
export const LOOKS = {
  villager:    { robe: ['#5f7392', '#7b6a8e', '#6d8065', '#8a6a55'], pants: '#3f4146', hat: 'none', tool: null },
  farmer:      { robe: ['#8a6c41', '#9a7b4d', '#7a6a4b'], pants: '#4a4032', hat: 'kasa', tool: 'hoe' },
  woodcutter:  { robe: ['#566b3a', '#4f6140'], pants: '#3d3a33', hat: 'hachimaki', tool: 'axe' },
  stonecutter: { robe: ['#7a7a72', '#6b6f75'], pants: '#3a3a3c', hat: 'hachimaki', tool: 'hammer' },
  miner:       { robe: ['#4a3f35', '#56473a'], pants: '#2f2a26', hat: 'cloth', tool: 'pick' },
  builder:     { robe: ['#9a5b2e', '#8c5530'], pants: '#3d3228', hat: 'hachimaki', tool: 'mallet' },
  brewer:      { robe: ['#2f4a7a', '#3a5586'], pants: '#2b2f3a', hat: 'hachimaki', tool: null },
  smith:       { robe: ['#3a3430', '#4a3a30'], pants: '#2a2622', hat: 'hachimaki', tool: 'hammer' },
  merchant:    { robe: ['#7a5a2e', '#6a4a7a'], pants: '#3a3228', hat: 'kasa', tool: null },
  child:       { robe: ['#c2412d', '#e0873a', '#5f8a3e', '#2f5aa0', '#b84a8a'], pants: '#3f4146', hat: 'none', tool: null, scale: 0.62 },
  trainee:     { robe: ['#ece6d6'], pants: '#2b3346', hat: 'hachimaki', tool: 'bokken' },
  trainee_archer: { robe: ['#ece6d6'], pants: '#3a2e4a', hat: 'hachimaki', tool: 'yumi', quiver: true },
  ashigaru:    { robe: ['#2e3440'], pants: '#23262d', hat: 'jingasa', tool: 'yari', armor: '#3a3f4a', banner: CLAN },
  shieldman:   { robe: ['#2e3440'], pants: '#23262d', hat: 'jingasa', tool: 'katana', armor: '#3a3f4a', shield: '#7a2a22' },
  archer:      { robe: ['#34402e'], pants: '#23262d', hat: 'jingasa', tool: 'yumi', armor: '#3c4636', quiver: true },
  samurai:     { robe: ['#5a1f1c'], pants: '#2a1a18', hat: 'kabuto', tool: 'katana', armor: '#9e2a22', banner: '#1c1c22', crest: '#e0b04a' },
  monk:        { robe: ['#c9772e'], pants: '#8f4f1f', hat: 'bald', tool: 'staff' },
  // commanders
  berserker:   { robe: ['#3a2320'], pants: '#1f1716', hat: 'oni', tool: 'kanabo', armor: '#4a2a24', scale: 1.22 },
  taisho:      { robe: ['#5a1f1c'], pants: '#2a1a18', hat: 'kabuto', tool: 'katana', armor: '#9e2a22', banner: '#f2ece0', crest: '#e8c25a', cloak: '#b8342a', scale: 1.1 },
  // the rival clans wear indigo
  enemy_ashigaru: { robe: ['#26324a'], pants: '#1c2230', hat: 'jingasa', tool: 'yari', armor: '#2f3d5c', banner: '#2f4a7a' },
  enemy_shield:   { robe: ['#26324a'], pants: '#1c2230', hat: 'jingasa', tool: 'katana', armor: '#2f3d5c', shield: '#5a4632' },
  enemy_archer:   { robe: ['#26324a'], pants: '#1c2230', hat: 'jingasa', tool: 'yumi', armor: '#34466a', quiver: true },
  enemy_samurai:  { robe: ['#1f2a44'], pants: '#161c2a', hat: 'kabuto', tool: 'katana', armor: '#2c3a60', banner: '#e8e2d0', crest: '#c9ced4', scale: 1.08 },
  enemy_lord:     { robe: ['#1f2a44'], pants: '#161c2a', hat: 'kabuto', tool: 'katana', armor: '#1f2b4d', crest: '#e8c25a', cloak: '#2f4a7a', scale: 1.15 },
  bandit:         { robe: ['#6b5a44', '#5a4a3a', '#4f5a3a'], pants: '#3a3228', hat: 'bandit', tool: 'katana' },
};

function toolMesh(m, tool) {
  switch (tool) {
    case 'hoe': m.box(0.05, 1.3, 0.05, '#7a5a3a', [0, -0.15, 0.1], [1.2, 0, 0]); m.box(0.25, 0.06, 0.2, '#8d9298', [0, -0.42, 0.72], [1.2, 0, 0]); break;
    case 'axe': m.box(0.05, 0.8, 0.05, '#6b4a2e', [0, -0.05, 0.08]); m.box(0.05, 0.22, 0.25, '#9aa0a6', [0, 0.28, 0.2]); break;
    case 'hammer': m.box(0.05, 0.7, 0.05, '#6b4a2e', [0, -0.05, 0.05]); m.box(0.16, 0.16, 0.3, '#6f7378', [0, 0.28, 0.05]); break;
    case 'pick': m.box(0.05, 0.8, 0.05, '#6b4a2e', [0, -0.05, 0.05]); m.box(0.06, 0.06, 0.6, '#6f7378', [0, 0.3, 0.05], [0.25, 0, 0]); break;
    case 'mallet': m.box(0.05, 0.6, 0.05, '#6b4a2e', [0, -0.05, 0.05]); m.box(0.22, 0.22, 0.34, '#8b5e3c', [0, 0.25, 0.05]); break;
    case 'bokken': m.box(0.05, 1.0, 0.07, '#c9a36f', [0, 0.25, 0.05], [0.2, 0, 0]); break;
    case 'yari': m.cyl(0.03, 0.03, 3.0, 5, '#4a3222', [0, 0.6, 0.05]); m.cone(0.06, 0.4, 4, '#c9ced4', [0, 2.3, 0.05]); break;
    case 'katana': m.box(0.04, 1.0, 0.07, '#d9dde2', [0, 0.35, 0.1], [0.3, 0, 0]); m.box(0.12, 0.04, 0.12, '#caa04a', [0, -0.12, 0.0]); break;
    case 'staff': m.cyl(0.03, 0.03, 1.9, 5, '#6b4a2e', [0, 0.3, 0.05]); m.box(0.12, 0.12, 0.12, '#caa04a', [0, 1.25, 0.05]); break;
    case 'kanabo': m.cyl(0.05, 0.05, 0.5, 6, '#2a1c14', [0, -0.1, 0.05]); m.cyl(0.14, 0.07, 1.2, 7, '#3b2a20', [0, 0.72, 0.05]);
      for (let i = 0; i < 10; i++) { const a = i * 2.4, y = 0.4 + (i % 5) * 0.16; m.box(0.05, 0.05, 0.05, '#9aa0a6', [Math.cos(a) * 0.12, y + 0.1, 0.05 + Math.sin(a) * 0.12]); } break;
  }
}

export class Person {
  constructor(lookName, seed = 1) {
    this.group = new THREE.Group();
    this.phase = Math.random() * 10;
    this.setLook(lookName, seed);
  }
  setLook(lookName, seed = this.seed || 1) {
    if (this.lookName === lookName) return;
    this.lookName = lookName; this.seed = seed;
    for (const c of [...this.group.children]) { this.group.remove(c); c.traverse(o => o.geometry && o.geometry.dispose()); }
    const L = LOOKS[lookName] || LOOKS.villager, r = mulberry32(seed * 7 + lookName.length);
    const skin = SKIN[Math.floor(r() * SKIN.length)], robe = L.robe[Math.floor(r() * L.robe.length)];
    const g = this.group;
    // body (torso, hips, head, hat, back items)
    const b = new Mesher(seed, 0.04);
    b.frustum(0.72, 0.46, 0.52, 0.34, 0.55, robe, [0, 0.45, 0]);         // kimono skirt / hakama top
    b.box(0.54, 0.62, 0.32, robe, [0, 1.25, 0]);                          // torso
    b.box(0.2, 0.3, 0.02, '#f2ece0', [0, 1.4, 0.165], [0, 0, 0.5]);        // collar
    b.box(0.58, 0.12, 0.35, L.armor ? '#1c1c1f' : '#2f2b28', [0, 0.97, 0]); // obi belt
    if (L.armor) {
      b.box(0.6, 0.5, 0.38, L.armor, [0, 1.2, 0]);
      for (let i = 0; i < 3; i++) b.box(0.64, 0.06, 0.4, '#18181b', [0, 1.02 + i * 0.16, 0]);
      b.frustum(0.66, 0.44, 0.6, 0.4, 0.35, L.armor, [0, 0.62, 0]);   // kusazuri skirt plates
    }
    b.box(0.3, 0.32, 0.3, skin, [0, 1.72, 0]);                            // head
    b.box(0.31, 0.06, 0.02, '#2a2320', [0, 1.76, 0.155]);                  // eyes line
    if (L.hat !== 'bald' && L.hat !== 'kabuto') { b.box(0.32, 0.14, 0.32, HAIR, [0, 1.87, -0.01]); b.box(0.32, 0.22, 0.08, HAIR, [0, 1.72, -0.14]); }
    switch (L.hat) {
      case 'none': b.box(0.08, 0.1, 0.18, HAIR, [0, 1.98, 0]); break;   // chonmage topknot
      case 'kasa': b.cone(0.48, 0.26, 12, '#c9a764', [0, 2.02, 0]); break;
      case 'hachimaki': b.box(0.34, 0.06, 0.34, '#f4efe4', [0, 1.84, 0]); b.box(0.08, 0.1, 0.18, HAIR, [0, 1.98, 0]); break;
      case 'cloth': b.box(0.34, 0.16, 0.34, '#6e5b48', [0, 1.9, 0]); break;
      case 'jingasa': b.cone(0.46, 0.16, 12, '#1f2024', [0, 1.99, 0]); b.ball(0.05, '#c9a04a', [0, 2.08, 0]); break;
      case 'bald': b.box(0.31, 0.08, 0.31, skin, [0, 1.89, 0]); break;
      case 'oni':
        b.ball(0.23, '#2a1c18', [0, 1.9, 0], [1, 0.75, 1], 1);
        b.cone(0.05, 0.34, 5, '#e8dcc0', [-0.16, 2.14, 0.02], [0, 0, 0.5]); b.cone(0.05, 0.34, 5, '#e8dcc0', [0.16, 2.14, 0.02], [0, 0, -0.5]);
        b.box(0.3, 0.26, 0.05, '#b8342a', [0, 1.7, 0.16]); b.box(0.22, 0.04, 0.02, '#f2ece0', [0, 1.62, 0.19]); b.box(0.06, 0.04, 0.02, '#ffd76a', [-0.07, 1.76, 0.19]); b.box(0.06, 0.04, 0.02, '#ffd76a', [0.07, 1.76, 0.19]);
        b.frustum(0.6, 0.6, 0.34, 0.34, 0.16, '#1c1c1f', [0, 1.72, -0.05]); break;
      case 'bandit': b.box(0.34, 0.08, 0.34, '#8a2a20', [0, 1.84, 0]); b.box(0.1, 0.2, 0.04, '#8a2a20', [0.1, 1.72, -0.18], [0.3, 0, 0.2]); b.box(0.08, 0.1, 0.18, HAIR, [0, 1.98, 0]); b.box(0.26, 0.08, 0.03, '#3a3228', [0, 1.66, 0.16]); break;
      case 'kabuto':
        b.ball(0.24, L.armor, [0, 1.9, 0], [1, 0.8, 1], 1);
        b.frustum(0.62, 0.62, 0.34, 0.34, 0.18, '#1c1c1f', [0, 1.72, -0.04]);
        b.box(0.05, 0.3, 0.02, L.crest, [-0.1, 2.12, 0.18], [0, 0, 0.45]); b.box(0.05, 0.3, 0.02, L.crest, [0.1, 2.12, 0.18], [0, 0, -0.45]);
        b.box(0.26, 0.1, 0.03, '#2a1c1a', [0, 1.66, 0.16]); break;           // menpo mask
    }
    if (L.banner) { b.cyl(0.02, 0.02, 1.7, 4, '#2a2320', [0, 1.9, -0.22]); b.box(0.02, 0.8, 0.42, L.banner, [0, 2.35, -0.44]); b.ball(0.07, '#f2ece0', [0.02, 2.4, -0.44]); }
    if (L.cloak) b.frustum(0.62, 0.2, 0.9, 0.24, 0.9, L.cloak, [0, 0.6, -0.2]);
    if (L.quiver) { b.cyl(0.08, 0.08, 0.7, 6, '#4a3222', [0.14, 1.3, -0.22], [0.3, 0, -0.3]); for (let i = 0; i < 3; i++) b.box(0.02, 0.2, 0.02, '#e9e4d8', [0.24 + i * 0.03, 1.72, -0.34]); }
    if (L.tool === 'katana' || L.armor) b.box(0.05, 0.05, 0.8, '#1d1a18', [-0.3, 0.98, 0.05], [0.25, 0, 0.3]); // sheathed sword
    this.body = b.mesh(MAT.flat, true, false);
    this.body.userData.person = this;
    g.add(this.body);
    // legs
    this.legs = [-1, 1].map(s => {
      const p = new THREE.Group(); p.position.set(s * 0.14, 0.82, 0);
      const m = new Mesher(seed + s, 0.03);
      m.box(0.22, 0.62, 0.24, L.pants, [0, -0.33, 0]); m.box(0.14, 0.24, 0.16, skin, [0, -0.72, 0]); m.box(0.16, 0.06, 0.28, '#b08d57', [0, -0.82, 0.04]);
      p.add(m.mesh(MAT.flat, true, false)); g.add(p); return p;
    });
    // arms (right arm holds the tool)
    this.arms = [-1, 1].map(s => {
      const p = new THREE.Group(); p.position.set(s * 0.33, 1.5, 0);
      const m = new Mesher(seed + 3 * s, 0.03);
      m.box(0.2, 0.4, 0.26, L.armor || robe, [s * 0.03, -0.18, 0]);
      if (L.armor) m.box(0.26, 0.28, 0.3, '#1c1c1f', [s * 0.05, -0.08, 0]);   // sode shoulder guard
      m.box(0.12, 0.3, 0.14, skin, [s * 0.02, -0.5, 0]);
      if (s === 1 && L.tool && L.tool !== 'yari') { const t = new Mesher(seed + 9, 0.02); toolMesh(t, L.tool); const tm = t.mesh(MAT.flat, true, false); tm.position.set(0.02, -0.62, 0.02); p.add(tm); }
      if (s === -1 && L.shield) { // wooden hand shield with an iron rim and a painted crest
        const t = new Mesher(seed + 11, 0.02);
        t.box(0.62, 0.95, 0.07, L.shield, [0, 0, 0]); t.box(0.66, 0.06, 0.08, '#3a3d42', [0, 0.47, 0]); t.box(0.66, 0.06, 0.08, '#3a3d42', [0, -0.47, 0]);
        for (const y of [-0.22, 0.22]) t.box(0.64, 0.04, 0.08, '#3d2c1e', [0, y, 0.01]);
        t.cyl(0.14, 0.14, 0.02, 12, '#e8e2d0', [0, 0.05, 0.045], [Math.PI / 2, 0, 0]);
        const tm = t.mesh(MAT.flat, true, false); tm.position.set(-0.08, -0.5, 0.26); p.add(tm);
      }
      if (s === -1 && L.tool === 'yumi') {
        const t = new Mesher(seed + 10, 0.02);
        t.box(0.04, 1.3, 0.04, '#3a2418', [0, 0.35, 0.12], [0.2, 0, 0]); t.box(0.04, 0.7, 0.04, '#3a2418', [0, -0.55, 0.05], [-0.3, 0, 0]); t.box(0.01, 2.0, 0.01, '#e9e4d8', [0, 0.1, -0.02]);
        const tm = t.mesh(MAT.flat, true, false); tm.position.set(0, -0.62, 0.05); p.add(tm);
      }
      p.add(m.mesh(MAT.flat, true, false)); g.add(p); return p;
    });
    // the yari is held in both hands and moves on its own, so it always points the right way
    this.spear = null;
    if (L.tool === 'yari') {
      const t = new Mesher(seed + 9, 0.02); toolMesh(t, 'yari');
      const tm = t.mesh(MAT.flat, true, false); tm.position.z = -0.05;
      this.spear = new THREE.Group(); this.spear.add(tm); g.add(this.spear);
    }
    // carried goods (shown while hauling)
    this.carry = {};
    const cm = (fn) => { const m = new Mesher(seed + 21, 0.06); fn(m); const mesh = m.mesh(MAT.flat, true, false); mesh.visible = false; g.add(mesh); return mesh; };
    this.carry.wheat = cm(m => { m.ball(0.3, '#d8c08a', [0, 1.65, -0.25], [1, 0.9, 1]); m.box(0.08, 0.1, 0.08, '#8a6b41', [0, 1.95, -0.25]); });
    this.carry.wood = cm(m => { for (let i = 0; i < 3; i++) m.cyl(0.1, 0.1, 1.1, 6, '#7a5438', [-0.1 + i * 0.1, 1.72 + (i % 2) * 0.1, -0.22], [0, 0, Math.PI / 2]); });
    this.carry.stone = cm(m => { m.box(0.4, 0.3, 0.3, '#a9a397', [0, 1.72, -0.22]); });
    this.carry.gold = cm(m => { m.box(0.34, 0.24, 0.26, '#6b4a2e', [0, 1.68, -0.22]); m.ball(0.1, '#e0b04a', [0.05, 1.85, -0.2]); m.ball(0.08, '#e0b04a', [-0.08, 1.84, -0.24]); });
    this.pose = 'idle';
    g.scale.setScalar(L.scale || 1);
  }
  setCarry(res) { for (const k in this.carry) this.carry[k].visible = k === res; }
  // pose: idle | walk | work | chop | pray | sit | train | shoot | guard
  animate(dt, pose, speed = 1) {
    this.phase += dt * speed;
    const t = this.phase, [lL, lR] = this.legs, [aL, aR] = this.arms, body = this.body;
    let bodyY = 0, bodyRX = 0;
    lL.rotation.set(0, 0, 0); lR.rotation.set(0, 0, 0); aL.rotation.set(0, 0, 0); aR.rotation.set(0, 0, 0);
    switch (pose) {
      case 'walk': {
        const s = Math.sin(t * 9);
        lL.rotation.x = s * 0.6; lR.rotation.x = -s * 0.6; aL.rotation.x = -s * 0.5; aR.rotation.x = s * 0.5; bodyY = Math.abs(Math.cos(t * 9)) * 0.05;
        if (this.carryVisible()) { aL.rotation.x = -2.6; aR.rotation.x = -2.6; aL.rotation.z = 0.25; aR.rotation.z = -0.25; }
        break;
      }
      case 'chop': { const s = Math.sin(t * 5); aR.rotation.x = -1.7 + s * 1.0; aL.rotation.x = -1.1 + s * 0.5; bodyRX = 0.15 + s * 0.08; break; }
      case 'sneak': { const s = Math.sin(t * 6); lL.rotation.x = -0.5 + s * 0.45; lR.rotation.x = -0.5 - s * 0.45; aL.rotation.x = -0.6; aR.rotation.x = -0.9; bodyY = -0.28; bodyRX = 0.45; break; }
      case 'work': { const s = Math.sin(t * 7); aR.rotation.x = -1.2 + s * 0.35; aL.rotation.x = -1.0; bodyRX = 0.3; lL.rotation.x = -0.3; lR.rotation.x = 0.2; break; }
      case 'hammer': { const s = Math.max(0, Math.sin(t * 6)); aR.rotation.x = -2.6 + s * 1.9; aL.rotation.x = -0.9; bodyRX = 0.1 + s * 0.12; break; }
      case 'pickaxe': { const s = Math.sin(t * 3.6); aR.rotation.x = -2.9 + (s + 1) * 1.2; aL.rotation.x = -2.9 + (s + 1) * 1.2; aL.rotation.z = -0.2; bodyRX = 0.05 + (s + 1) * 0.18; break; }
      case 'kneel': { lL.rotation.x = -1.4; lR.rotation.x = 0.2; bodyY = -0.38; bodyRX = 0.45; const s = Math.sin(t * 2.4); aR.rotation.x = -0.9 + s * 0.3; aL.rotation.x = -0.7 - s * 0.2; break; }
      case 'drop': { const s = Math.min(1, (t % 1.4) / 0.7); aR.rotation.x = -2.4 + s * 1.2; aL.rotation.x = -2.4 + s * 1.2; bodyRX = s * 0.5; break; }
      case 'dig': { const s = Math.sin(t * 4); aR.rotation.x = -0.6 + s * 0.8; aL.rotation.x = -0.6 + s * 0.8; bodyRX = 0.35 + s * 0.12; break; }
      case 'pray': { aL.rotation.x = -1.2; aR.rotation.x = -1.2; aL.rotation.z = -0.35; aR.rotation.z = 0.35; bodyRX = 0.25 + Math.sin(t * 0.8) * 0.12; break; }
      case 'sit': { lL.rotation.x = -1.5; lR.rotation.x = -1.5; bodyY = -0.5; aL.rotation.x = -0.5; aR.rotation.x = -0.4 + Math.sin(t * 0.7) * 0.2; break; }
      case 'train': { const s = Math.sin(t * 6); aR.rotation.x = -2.2 + s * 1.3; aL.rotation.x = -2.0 + s * 1.2; lL.rotation.x = 0.3; lR.rotation.x = -0.4; bodyRX = s * 0.1; break; }
      case 'shoot': { aL.rotation.x = -1.5; aL.rotation.z = -0.1; aR.rotation.x = -1.4 + Math.max(0, Math.sin(t * 2)) * 0.4; aR.rotation.z = 0.5; break; }
      case 'guard': { aR.rotation.x = -0.25; aL.rotation.x = -0.1; bodyY = Math.sin(t * 1.5) * 0.01; break; }
      default: { aL.rotation.x = Math.sin(t * 1.2) * 0.05; aR.rotation.x = -Math.sin(t * 1.2) * 0.05; bodyY = Math.sin(t * 1.6) * 0.012; }
    }
    if (this.spear) {
      const S = this.spear;
      if (pose === 'chop') { // thrust: both hands on the shaft, tip forward
        const th = Math.max(0, Math.sin(t * 5));
        aR.rotation.set(-1.25 - th * 0.25, 0, 0); aL.rotation.set(-1.05 - th * 0.25, 0, -0.45);
        S.rotation.set(1.5, 0, 0); S.position.set(0.16, 1.22 + bodyY, 0.25 + th * 0.5); bodyRX = 0.08 + th * 0.12;
      } else if (pose === 'sneak') { // carried low and level
        aR.rotation.set(-0.9, 0, 0); aL.rotation.set(-0.7, 0, -0.3);
        S.rotation.set(1.45, 0, 0); S.position.set(0.2, 1.05 + bodyY, 0.1);
      } else if (pose === 'guard') { // ready: tilted forward
        aR.rotation.set(-0.45, 0, 0);
        S.rotation.set(0.3, 0, 0); S.position.set(0.35, 0.94 + bodyY, 0.27);
      } else { // upright at the right side
        aR.rotation.set(-0.3, 0, 0);
        S.rotation.set(0.06, 0, 0); S.position.set(0.35, 0.91 + bodyY, 0.18);
      }
    }
    body.position.y = bodyY; body.rotation.x = bodyRX;
    for (const a of this.arms) { a.position.y = 1.5 + bodyY; }
    for (const k in this.carry) this.carry[k].position.y = bodyY;
  }
  carryVisible() { for (const k in this.carry) if (this.carry[k].visible) return true; return false; }
  dispose() { this.group.traverse(o => o.geometry && o.geometry.dispose()); }
}
