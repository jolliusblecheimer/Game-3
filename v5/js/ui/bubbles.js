// Little speech bubbles over villagers: what they think about their work, the weather, the mood of the village.
import * as THREE from 'three';

const pick = a => a[Math.floor(Math.random() * a.length)];
const JOB_LINES = {
  farmer: ['The wheat stands tall.', 'Good soil here.', 'My back aches…'], woodcutter: ['Timber!', 'Fine straight pine.', 'Chop, chop.'],
  stonecutter: ['Hard rock today.', 'Clack, clack.'], miner: ['Dark down there…', 'I saw a glint!'], ironminer: ['Heavy ore today.', 'Rust on my hands again.'],
  brewer: ['This batch smells good.', 'Patience makes good sake.'], smith: ['Clang! Clang!', 'A blade needs fire and patience.'], merchant: ['Fine goods, fair prices!', 'Buy, sell, haggle!'],
  child: ['Tag! You’re it!', 'Look, a frog!', 'When I grow up I’ll be a samurai!', 'Hehe!'],
  ashigaru: ['All quiet.', 'My spear is sharp.', 'I will guard the gate.'], archer: ['I see far from here.', 'Wind from the east.'],
  samurai: ['Honour above all.', 'My blade is ready.'], shieldman: ['Let them shoot.', 'My shield holds.'], trainee: ['Again! Again!', 'My arms hurt…'], trainee_archer: ['Breathe, draw, release.'],
  idle: ['Is there work for me?', 'Nice day for a walk.', 'I heard the Keep is growing.'],
};
const SEASON_LINES = [['The sakura are blooming!', 'Spring at last.'], ['So hot today…', 'Cicadas everywhere.'], ['Look at the red leaves.', 'A good harvest this year.'], ['Brr, so cold!', 'Snow on the roofs.']];

export class Bubbles {
  constructor(game, stage) {
    this.game = game; this.stage = stage; this.list = []; this.t = 0;
    this.layer = document.createElement('div'); this.layer.className = 'bubbles'; document.getElementById('ui').append(this.layer);
  }
  line(v) {
    const g = this.game, L = g.life, mood = L.mood();
    if (g.raids.alarmed) return pick(['Bandits!!', 'Hide!', 'Help!']);
    if (L.festival) return pick(['Kanpai!', 'What a festival!', 'Dance with me!', 'More sake!']);
    if ([...g.buildings.values()].some(b => b.fire) && Math.random() < 0.4) return pick(['Fire! Fire!', 'Bring water!']);
    if (g.hungry() && Math.random() < 0.6) return pick(['My belly rumbles…', 'Is there no food?']);
    if (L.weather === 'rain' && Math.random() < 0.25) return pick(['Rain again…', 'Good for the fields, at least.']);
    if (v.hpf != null && Math.random() < 0.5) return pick(['My wounds ache.', 'I need rest.']);
    const r = Math.random();
    if (r < 0.2) return mood >= 65 ? pick(['I love this village.', 'Life is good here.', 'What a lovely day!']) : mood < 35 ? pick(['Life is hard…', 'I might leave…', 'Nobody cares about us.']) : pick(['Another day.', 'Hm.']);
    if (r < 0.35) return pick(SEASON_LINES[L.season]);
    return pick(JOB_LINES[v.job] || JOB_LINES.idle);
  }
  update(dt, active) {
    this.layer.hidden = !active;
    if (this.layer.hidden) return;
    this.t += dt;
    const cam = this.stage.camera, W = window.innerWidth, H = window.innerHeight, g = this.game;
    if (this.t > 2.4 && this.list.length < 3) {
      this.t = 0;
      const cands = [...g.villagers.values()].filter(v => !v.hidden && !v.away && !this.list.some(b => b.v === v));
      for (let k = 0; k < 6 && cands.length; k++) {
        const v = cands[Math.floor(Math.random() * cands.length)], p = new THREE.Vector3(v.pos.x, (v.elev || 0) + 2.6, v.pos.z).project(cam);
        if (p.z < 1 && Math.abs(p.x) < 0.8 && Math.abs(p.y) < 0.75) { const el = document.createElement('div'); el.className = 'bubble'; el.textContent = this.line(v); this.layer.append(el); this.list.push({ v, el, t: 0 }); break; }
      }
    }
    for (const b of this.list) {
      b.t += dt;
      const v = b.v, p = new THREE.Vector3(v.pos.x, (v.elev || 0) + 2.6 * (v.person.group.scale.y || 1), v.pos.z).project(cam);
      const gone = b.t > 3.6 || v.hidden || !g.villagers.has(v.id) || p.z >= 1;
      if (gone) { b.el.remove(); b.done = true; continue; }
      b.el.style.transform = `translate(${(p.x + 1) / 2 * W}px, ${(1 - p.y) / 2 * H}px) translate(-50%, -100%)`;
      b.el.style.opacity = String(Math.min(1, b.t * 4, (3.6 - b.t) * 3));
    }
    this.list = this.list.filter(b => !b.done);
  }
}
