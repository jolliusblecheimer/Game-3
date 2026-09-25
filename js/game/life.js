// Village life: the seasons and the weather, the villagers' mood, festivals, children, fires and other
// events, the market and travelling merchants, and the forge.
import * as THREE from 'three';
import { SEASONS, DAYS_PER_SEASON, RES } from './data.js';

const DAY = 720;
// what goods are worth in gold at the market
const VALUE = { wheat: 0.5, wood: 0.6, stone: 0.8, iron: 3, sake: 4 };   // gold per unit

export class Life {
  constructor(game) {
    this.game = game;
    this.weather = 'clear';       // clear | rain | snow
    this.festivalUntil = 0;       // game clock
    this.moodBoost = 0;           // +mood from festivals and good news, fades
    this.grief = 0;               // -mood from deaths, fades
    this.badHarvestUntil = 0;
    this.merchant = null;         // { until, offers: [{ give, get }] }
    this.lastFestival = -1e9;
    this.fireT = 0;
  }
  get g() { return this.game; }
  get S() { return this.game.state; }
  get season() { return Math.floor((this.S.day - 1) / DAYS_PER_SEASON) % 4; }
  get seasonInfo() { return SEASONS[this.season]; }
  get festival() { return this.S.clock < this.festivalUntil; }
  farmMult() { return this.seasonInfo.farm * (this.weather === 'rain' ? 1.1 : 1) * (this.S.clock < this.badHarvestUntil ? 0.5 : 1); }

  /* ---------- mood ---------- */
  // 0..100; above 50 villagers work faster and families move in more often, below 25 some leave
  moodParts() {
    const g = this.g, parts = [['Base', 50]];
    parts.push(['Harmony', Math.round(g.harmony() * 0.8)]);
    if (g.hungry()) parts.push(['Hungry!', -30]); else if (g.state.res.wheat > g.pop * 8) parts.push(['Full storehouses', 5]);
    const room = g.housing() - g.pop; if (room <= 0) parts.push(['Crowded homes', -8]);
    if ((g.state.res.sake || 0) >= 10) parts.push(['Sake to share', 6]);
    if (this.festival) parts.push(['Festival!', 20]);
    if (this.moodBoost > 0.5) parts.push(['Good memories', Math.round(this.moodBoost)]);
    if (this.grief > 0.5) parts.push(['Grief', -Math.round(this.grief)]);
    parts.push([`${this.seasonInfo.name}`, this.seasonInfo.mood]);
    if (this.weather === 'rain') parts.push(['Rain', -2]);
    if (g.raids.alarmed) parts.push(['Raid!', -15]);
    return parts;
  }
  mood() { return Math.max(0, Math.min(100, this.moodParts().reduce((a, [, v]) => a + v, 0))); }
  moodMult() { return 1 + (this.mood() - 50) / 250; }        // 0.8 … 1.2

  /* ---------- the forge ---------- */
  forgeBonus() {
    for (const b of this.g.buildings.values()) if (b.type === 'blacksmith' && b.done && (b.forgingUntil || 0) > this.S.clock) return 0.08 * b.level;
    return 0;
  }

  /* ---------- festivals ---------- */
  festivalCost() { return (this.S.res.sake || 0) >= 20 ? { wheat: 100, sake: 20 } : { wheat: 120, gold: 60 }; }
  festivalBlock() {
    if (this.festival) return 'A festival is on right now';
    const left = this.lastFestival + DAY * 3 - this.S.clock; if (left > 0) return `The next festival can be held in ${Math.ceil(left / DAY)} day${left > DAY ? 's' : ''}`;
    if (this.g.raids.alarmed) return 'Not during a raid!';
    if (!this.g.canAfford(this.festivalCost())) return 'Not enough for the feast';
    return '';
  }
  holdFestival() {
    const why = this.festivalBlock(); if (why) { this.g.toast(why, 'warn'); return false; }
    this.g.pay(this.festivalCost());
    this.festivalUntil = this.S.clock + DAY * 0.35; this.lastFestival = this.S.clock; this.moodBoost = Math.max(this.moodBoost, 15);
    this.g.toast('The festival begins! Lanterns rise, drums play and the sake flows.');
    this.g.progress.log('A festival was held in the village.', 'life'); this.g.progress.add('festivals');
    for (const v of this.g.villagers.values()) v.reset = true;
    this.g.emit('festival'); return true;
  }

  /* ---------- the market ---------- */
  market() { for (const b of this.g.buildings.values()) if (b.type === 'market' && b.done) return b; return null; }
  prices(r) { const m = this.market(), L = m ? m.level : 1, v = VALUE[r]; return { sell: v * (0.55 + 0.1 * L), buy: v * (1.6 - 0.1 * L) }; }
  // sell (n > 0: give goods, get gold) or buy (n < 0: pay gold, get goods), in lots of 10
  trade(r, n) {
    const g = this.g, P = this.prices(r);
    if (n > 0) { if ((g.state.res[r] || 0) < n) return g.toast(`Not enough ${RES[r].name.toLowerCase()}`, 'warn'); g.pay({ [r]: n }); g.add('gold', Math.floor(n * P.sell)); }
    else { const cost = Math.ceil(-n * P.buy); if (g.state.res.gold < cost) return g.toast('Not enough gold', 'warn'); g.pay({ gold: cost }); g.add(r, -n); }
    g.emit('res'); return true;
  }
  takeOffer(i) {
    const g = this.g, o = this.merchant && this.merchant.offers[i]; if (!o || o.done) return false;
    if (!g.canAfford(o.give)) { g.toast('You can’t pay for that', 'warn'); return false; }
    g.pay(o.give); for (const r in o.get) g.add(r, o.get[r]); o.done = true; g.toast('A deal! The merchant bows.'); g.emit('merchant'); return true;
  }
  newMerchant() {
    const g = this.g, R = Object.keys(VALUE), pick = () => R[Math.floor(g.rand() * R.length)], offers = [];
    for (let i = 0; i < 3; i++) {
      const a = pick(); let b = pick(); if (b === a) b = 'gold';
      const give = { [a]: Math.round(40 + g.rand() * 80) }, worth = give[a] * VALUE[a] * (1.25 + g.rand() * 0.35);   // a good deal
      offers.push({ give, get: { [b]: Math.max(5, Math.round(worth / (VALUE[b] || 1))) } });
    }
    offers.push({ give: { sake: 30 }, get: { gold: 140 + Math.round(g.rand() * 40) } });
    this.merchant = { until: this.S.clock + DAY * 0.8, offers };
    g.toast('A merchant caravan has stopped at your market! See the Market for their offers.');
    g.emit('merchant');
  }

  /* ---------- fires ---------- */
  startFire(b) {
    if (!b || b.fire || !b.done) return;
    b.fire = { left: 1, burn: 80 };  // left: how much fire is left to put out; burn: seconds until it's lost
    this.g.toast(`Fire! The ${b.def.name} is burning — free villagers rush to put it out.`, 'bad');
    this.g.progress.log(`A fire broke out in the ${b.def.name}.`, 'life');
    this.fireFx(b, true);
    for (const v of this.g.villagers.values()) if (v.job === 'idle' || v.aid) v.reset = true;
  }
  fireFx(b, on) {
    if (on && !b.fireMesh) {
      const g = new THREE.Group(), flame = new THREE.MeshBasicMaterial({ color: '#ff8a2a', transparent: true, opacity: 0.85 }), core = new THREE.MeshBasicMaterial({ color: '#ffd35a' });
      for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.8, 6), i % 2 ? core : flame); f.position.set((Math.random() - 0.5) * b.w * 1.4, 2.4 + Math.random(), (Math.random() - 0.5) * b.d * 1.4); g.add(f); }
      const smoke = new THREE.MeshBasicMaterial({ color: '#3d3a38', transparent: true, opacity: 0.45 });
      for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.9, 6, 5), smoke); s.position.set((Math.random() - 0.5) * 2, 5 + i * 1.4, (Math.random() - 0.5) * 2); g.add(s); }
      const c = this.g.center(b); g.position.set(c.x, 0, c.z); this.g.scene.add(g); b.fireMesh = g;
    } else if (!on && b.fireMesh) { this.g.scene.remove(b.fireMesh); b.fireMesh.traverse(o => o.geometry && o.geometry.dispose()); b.fireMesh = null; }
  }
  // a villager beating at the flames (called while a helper works on a burning building)
  fightFire(b, dt) {
    if (!b.fire) return;
    b.fire.left -= dt / 22 * this.g.workMult();
    if (b.fire.left <= 0) { b.fire = null; this.fireFx(b, false); this.g.toast(`The fire at the ${b.def.name} is out!`); this.moodBoost = Math.max(this.moodBoost, 4); }
  }

  /* ---------- every frame ---------- */
  update(dt) {
    const g = this.g;
    this.moodBoost = Math.max(0, this.moodBoost - dt / 180);
    this.grief = Math.max(0, this.grief - dt / 240);
    if (this.merchant && this.S.clock > this.merchant.until) { this.merchant = null; g.toast('The merchant caravan has moved on.'); g.emit('merchant'); }
    // fires spread their damage; the flames flicker
    this.fireT += dt;
    for (const b of g.buildings.values()) {
      if (!b.fire) continue;
      b.fire.burn -= dt;
      if (b.fireMesh) b.fireMesh.children.forEach((f, i) => {
        if (f.geometry.type === 'ConeGeometry') f.scale.set(1, 0.7 + 0.4 * Math.abs(Math.sin(this.fireT * 7 + i)), 1);
        else { f.position.y += dt * 0.6; if (f.position.y > 11) f.position.y = 5; }   // smoke drifting up
      });
      if (b.fire.burn <= 0) {
        this.fireFx(b, false); b.fire = null;
        g.toast(`The ${b.def.name} burned down!`, 'bad'); g.progress.log(`The ${b.def.name} burned down.`, 'life'); this.grief = Math.min(30, this.grief + 6);
        g.demolish(b.id, { destroyed: true });
      }
    }
    // festival lanterns
    if (this.festival && !this.lanterns) this.makeLanterns(true); else if (!this.festival && this.lanterns) this.makeLanterns(false);
    if (this.lanterns) this.lanterns.children.forEach((l, i) => { l.position.y = 7 + Math.sin(this.fireT * 0.8 + i) * 0.6 + i % 3; l.rotation.y += dt * 0.3; });
  }
  makeLanterns(on) {
    const g = this.g;
    if (on) {
      const grp = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: '#ffb36a' }), keep = g.keep, c = keep ? g.center(keep) : { x: 0, z: 0 };
      for (let i = 0; i < 18; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 8), mat); const a = i / 18 * Math.PI * 2, r = 9 + (i % 4) * 3; l.position.set(c.x + Math.cos(a) * r, 7, c.z + Math.sin(a) * r); grp.add(l); }
      g.scene.add(grp); this.lanterns = grp;
    } else { g.scene.remove(this.lanterns); this.lanterns.traverse(o => o.geometry && o.geometry.dispose()); this.lanterns = null; }
  }

  /* ---------- once a day ---------- */
  newDay() {
    const g = this.g, r = g.rand, S = this.S, season = this.season;
    // the weather
    this.weather = season === 3 ? (r() < 0.55 ? 'snow' : 'clear') : r() < 0.2 ? 'rain' : 'clear';
    if ((S.day - 1) % DAYS_PER_SEASON === 0) { g.toast(`${SEASONS[season].name} has come to the valley.${season === 3 ? ' The fields rest until spring.' : season === 0 ? ' The sakura bloom!' : season === 2 ? ' Harvest time: the fields give more.' : ''}`); g.progress.log(`${SEASONS[season].name} began.`, 'life'); }
    // children grow up
    for (const v of g.villagers.values()) if (v.job === 'child' && S.day - (v.born || 0) >= 2) { g.setJob(v, 'idle'); g.toast(`${v.name} has grown up and is ready to work.`); }
    // a happy, fed village has children
    const mood = this.mood();
    if (mood >= 60 && g.pop < g.housing() && S.res.wheat > g.pop * 3 && r() < 0.35) { const v = g.spawnVillager({ job: 'child' }); v.born = S.day; g.toast(`A child, ${v.name}, was born in the village!`); g.progress.log(`${v.name} was born.`, 'life'); g.progress.add('births'); }
    // a miserable one loses people
    if (mood < 25 && g.pop > 6 && r() < 0.4) { const v = g.idleVillagers()[0]; if (v) { g.toast(`${v.name} has had enough and left the village.`, 'bad'); g.progress.log(`${v.name} left the village, unhappy.`, 'life'); g.killVillager(v.id); } }
    // events
    if (S.day > 2 && r() < 0.55) this.event();
    if (this.market() && !this.merchant && r() < 0.5) this.newMerchant();
  }
  event() {
    const g = this.g, r = g.rand, homes = [...g.buildings.values()].filter(b => b.done && ['house', 'nagaya', 'storehouse', 'lumber', 'sakebrewery', 'teahouse'].includes(b.type));
    const E = [
      [2, () => homes.length > 3 && this.season !== 3 && this.startFire(homes[Math.floor(r() * homes.length)])],
      [1, () => this.season !== 3 && (this.badHarvestUntil = this.S.clock + DAY * 1.5, g.toast('Blight in the fields: harvests are halved for a day and a half.', 'warn'), g.progress.log('A bad harvest.', 'life'))],
      [2, () => { this.moodBoost = Math.max(this.moodBoost, 12); g.toast('A travelling monk visits, blessing homes and telling stories. Spirits rise.'); g.progress.log('A travelling monk visited.', 'life'); }],
      [1, () => g.emit('ronin')],
      [1, () => { const n = 1 + Math.floor(r() * 2); for (let i = 0; i < n; i++) g.spawnVillager({}); g.toast(`${n === 1 ? 'A refugee family arrives' : 'Refugees arrive'} from a burned village, asking for shelter.`); g.progress.log('Refugees arrived.', 'life'); }],
      [1, () => { const got = { wood: 60 + Math.round(r() * 60) }; g.add('wood', got.wood); g.toast(`A storm felled trees near the village: +${got.wood} wood.`); }],
      [1, () => this.season === 2 && (g.add('wheat', 150), g.toast('A golden autumn: the harvest is rich! +150 wheat.'))],
    ];
    let total = E.reduce((a, [w]) => a + w, 0), pick = r() * total;
    for (const [w, fn] of E) { pick -= w; if (pick <= 0) { fn(); return; } }
  }
  // a wandering ronin offers his sword
  hireRonin() {
    const g = this.g; if (!g.canAfford({ gold: 60 })) { g.toast('Not enough gold', 'warn'); return false; }
    g.pay({ gold: 60 }); const v = g.spawnVillager({ job: 'samurai' }); g.toast(`${v.name}, a masterless samurai, swears to serve your clan.`); g.progress.log(`The rōnin ${v.name} joined the clan.`, 'life'); return true;
  }

  serialize() { return { weather: this.weather, festivalUntil: this.festivalUntil, lastFestival: this.lastFestival, moodBoost: this.moodBoost, grief: this.grief, badHarvestUntil: this.badHarvestUntil, merchant: this.merchant }; }
  load(o) { if (!o) return; Object.assign(this, { weather: o.weather || 'clear', festivalUntil: o.festivalUntil || 0, lastFestival: o.lastFestival ?? -1e9, moodBoost: o.moodBoost || 0, grief: o.grief || 0, badHarvestUntil: o.badHarvestUntil || 0, merchant: o.merchant || null }); }
}
