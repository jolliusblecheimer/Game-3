// The country around your village: places, fog of war, scouts, armies on the march, held territory.
import { SITES, PLACE_NAMES, WAR, JOBS, RES } from './data.js';
import { mulberry32, makeNoise2D, fbm, smoothstep, clamp } from '../util.js';

export const MAP = { half: 300, fogN: 128 };

// Height of the country map (map units). Below -1.2 is water.
export function makeMapHeight(seed) {
  const n1 = makeNoise2D(seed + 101), n2 = makeNoise2D(seed + 202), n3 = makeNoise2D(seed + 303);
  return (x, z) => {
    let h = fbm(n1, x * 0.006, z * 0.006, 5) * 16 + 7;
    const ridge = 1 - Math.abs(n2(x * 0.0045, z * 0.0045));
    h += Math.pow(ridge, 7) * 55 * smoothstep(40, 120, Math.hypot(x, z));
    const r = Math.abs(fbm(n3, x * 0.004 + 3, z * 0.004 - 5, 2));
    if (r < 0.045) h -= (1 - r / 0.045) * 13;                      // rivers
    const home = Math.hypot(x, z);
    if (home < 34) h = h + (5 - h) * smoothstep(34, 16, home);      // the home valley is gentle
    const edge = Math.max(Math.abs(x), Math.abs(z)) / MAP.half;
    h -= smoothstep(0.82, 1.0, edge) * 40;                           // the sea around the province
    return h - 3;
  };
}

function generateSites(seed, height) {
  const r = mulberry32(seed + 77), sites = [], used = new Set();
  let id = 1;
  for (const [type, S] of Object.entries(SITES)) {
    for (let k = 0; k < S.count; k++) {
      for (let tries = 0; tries < 400; tries++) {
        const a = r() * Math.PI * 2, d = S.dist[0] + r() * (S.dist[1] - S.dist[0]);
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (height(x, z) < 1.5 || height(x, z) > 32) continue;
        if (sites.some(s => Math.hypot(s.x - x, s.z - z) < (S.gap || 42))) continue;
        let name; do { name = PLACE_NAMES[Math.floor(r() * PLACE_NAMES.length)]; } while (used.has(name) && used.size < PLACE_NAMES.length);
        used.add(name);
        sites.push({ id: id++, type, x, z, name, tier: S.tier, seed: Math.floor(r() * 1e9) });
        break;
      }
    }
  }
  return sites;
}

export class Country {
  constructor(game) {
    this.game = game;
    const seed = game.state.seed;
    this.height = makeMapHeight(seed);
    this.sites = generateSites(seed, this.height);
    this.fog = new Uint8Array(MAP.fogN * MAP.fogN);
    this.state = {};        // siteId -> { status: 'known' | 'scouted' | 'held' | 'ruined', looted }
    this.missions = [];
    this.holds = {};        // siteId -> { tributeT, checkT }
    this.nextId = 1;
    this.fogDirty = true;
    this.reveal(0, 0, WAR.homeReveal);
    this.revealKnown();
  }
  // places everyone knows about (the warlords' castles) show on the map from the start
  revealKnown() {
    for (const s of this.sites) if (SITES[s.type].known) this.reveal(s.x, s.z, 14);
    for (const id of Object.keys(this.holds)) { const s = this.site(+id); if (s) this.reveal(s.x, s.z, 22); } // your own places are never under the clouds
  }
  // the warlord castle whose soldiers raid you: the nearest one still standing
  warlordSource() {
    let best = null, bd = Infinity;
    for (const s of this.sites) { if (s.type !== 'warlord') continue; const st = this.status(s); if (st === 'ruined' || st === 'held') continue; const d = Math.hypot(s.x, s.z); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  get clock() { return this.game.state.clock; }
  site(id) { return this.sites.find(s => s.id === id); }
  status(s) { return (this.state[s.id] && this.state[s.id].status) || (this.isRevealed(s.x, s.z) ? 'known' : 'hidden'); }
  setStatus(s, status) { this.state[s.id] = { ...(this.state[s.id] || {}), status }; this.game.emit('country'); }

  /* ---------- fog ---------- */
  fogIdx(x, z) {
    const N = MAP.fogN, cx = Math.floor((x + MAP.half) / (2 * MAP.half) * N), cz = Math.floor((z + MAP.half) / (2 * MAP.half) * N);
    return cx < 0 || cz < 0 || cx >= N || cz >= N ? -1 : cz * N + cx;
  }
  isRevealed(x, z) { const i = this.fogIdx(x, z); return i >= 0 && this.fog[i] > 128; }
  reveal(x, z, radius) {
    const N = MAP.fogN, cell = 2 * MAP.half / N, rc = Math.ceil(radius / cell) + 1;
    const [cx, cz] = [Math.floor((x + MAP.half) / cell), Math.floor((z + MAP.half) / cell)];
    let changed = false;
    for (let dz = -rc; dz <= rc; dz++) for (let dx = -rc; dx <= rc; dx++) {
      const gx = cx + dx, gz = cz + dz; if (gx < 0 || gz < 0 || gx >= N || gz >= N) continue;
      const d = Math.hypot(dx * cell, dz * cell), v = Math.round(clamp(1 - (d - radius * 0.7) / (radius * 0.3), 0, 1) * 255);
      const i = gz * N + gx; if (v > this.fog[i]) { this.fog[i] = v; changed = true; }
    }
    if (!changed) return;
    this.fogDirty = true;
    for (const s of this.sites) {
      if (this.state[s.id] || !this.isRevealed(s.x, s.z)) continue;
      this.state[s.id] = { status: 'known' };
      this.game.toast(`Discovered: ${SITES[s.type].name} of ${s.name}`);
      this.game.emit('country');
    }
  }

  /* ---------- missions ---------- */
  mission(id) { return this.missions.find(m => m.id === id); }
  posOf(m) {
    const t = clamp((this.clock - m.t0) / m.dur, 0, 1);
    const [a, b] = m.phase === 'back' ? [m.to, m.from] : [m.from, m.to];
    if (m.phase === 'ready') return { ...m.to };
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, t };
  }
  away(vids, tag) { for (const id of vids) { const v = this.game.villagers.get(id); if (v) { this.game.setJob(v, v.job); v.away = tag; v.person.group.visible = false; } } this.game.emit('away'); }
  home(vids) {
    const th = [...this.game.buildings.values()].find(b => b.type === 'townhall');
    for (const id of vids) { const v = this.game.villagers.get(id); if (!v) continue; v.away = null; if (th) { const d = this.game.door(th, 3 + Math.random() * 3); v.pos.x = d.x; v.pos.z = d.z; } v.reset = true; }
    this.game.emit('away');
  }
  // only soldiers scout; a scout is away and can't work or fight at home
  // anyone who isn't tied to a workplace: unemployed villagers first, then soldiers
  scoutCandidates() { return [...this.game.villagers.values()].filter(v => !v.away && (v.job === 'idle' || v.job === 'ashigaru' || v.job === 'shieldman' || v.job === 'archer')); }
  sendScout(to) {
    const rank = v => (v.job === 'idle' ? 0 : 1) + (v.post ? 1 : 0);
    const g = this.game, c = this.scoutCandidates().sort((a, b) => rank(a) - rank(b))[0];
    if (c) g.progress.add('scouts');
    if (!c) return g.toast('Nobody free to scout — workers stay at their jobs. Make someone unemployed, or train a soldier.', 'warn');
    if (!g.canAfford(WAR.scoutCost)) return g.toast('Scouts need 10 wheat for the journey', 'warn');
    g.pay(WAR.scoutCost);
    const dist = Math.hypot(to.x, to.z), dur = Math.max(8, dist / (WAR.scoutSpeed * this.speedMult('scout')));
    const m = { id: this.nextId++, kind: 'scout', vids: [c.id], from: { x: 0, z: 0 }, to: { x: to.x, z: to.z }, t0: this.clock, dur, phase: 'out', lastReveal: 0 };
    this.missions.push(m); this.away([c.id], 'scout');
    g.toast(`${c.name} sets out to scout (${Math.round(dur)}s there)`);
    g.emit('country'); return m;
  }
  speedMult(kind) { return 1 + (kind === 'scout' ? this.game.rb('scoutSpeed') : this.game.rb('marchSpeed')) * 0.25; }
  marchTime(site) { return Math.max(10, Math.hypot(site.x, site.z) / (WAR.armySpeed * this.speedMult('army'))); }
  sendArmy(site, vids, rams, cats = 0) {
    const g = this.game, cost = { wheat: Math.ceil(WAR.marchCost * vids.length * (g.rb('supply') ? 0.5 : 1)) };
    if (!vids.length) return g.toast('Choose at least one soldier', 'warn');
    if (!g.canAfford(cost)) return g.toast(`The march needs ${cost.wheat} wheat for supplies`, 'warn');
    g.pay(cost);
    g.state.rams = (g.state.rams || 0) - rams; g.state.catapults = (g.state.catapults || 0) - cats;
    const m = { id: this.nextId++, kind: 'army', vids: [...vids], rams, catapults: cats, site: site.id, from: { x: 0, z: 0 }, to: { x: site.x, z: site.z }, t0: this.clock, dur: this.marchTime(site), phase: 'out', loot: null };
    this.missions.push(m); this.away(vids, 'army');
    g.toast(`Your army marches on ${site.name} (${Math.round(m.dur)}s)`);
    g.emit('country'); return m;
  }
  // after a battle: survivors (and loot) head home
  returnArmy(m, survivors, rams, loot) {
    for (const id of m.vids) if (!survivors.includes(id)) this.game.killVillager(id);
    m.vids = survivors; m.rams = rams; m.loot = loot; m.phase = 'back'; m.t0 = this.clock;
    if (!survivors.length && !rams && !m.catapults) this.missions = this.missions.filter(x => x !== m);
    this.game.emit('country');
  }

  update() {
    const g = this.game;
    for (const m of [...this.missions]) {
      const p = this.posOf(m);
      if (m.kind === 'scout' && m.phase !== 'ready') {
        // reveal along the path travelled so far (works even after a long offline jump)
        const from = m.lastReveal || 0, to = p.t;
        const [a, b] = m.phase === 'back' ? [m.to, m.from] : [m.from, m.to];
        for (let t = from; t <= to + 1e-6; t += Math.max(0.02, 8 / Math.max(1, Math.hypot(b.x - a.x, b.z - a.z)))) this.reveal(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, WAR.scoutReveal * (1 + 0.5 * this.game.rb('scoutSight')));
        m.lastReveal = to;
      }
      if (p.t < 1 || m.phase === 'ready') continue;
      if (m.kind === 'scout' && m.phase === 'out') {
        this.reveal(m.to.x, m.to.z, WAR.scoutReveal * 1.6);
        for (const s of this.sites) {
          if (Math.hypot(s.x - m.to.x, s.z - m.to.z) > 45) continue;
          if (s.type === 'ruins' && !(this.state[s.id] || {}).looted) {
            const loot = SITES.ruins.loot, got = [];
            for (const r in loot) { const n = g.add(r, loot[r]); if (n) got.push(`${n} ${RES[r].name.toLowerCase()}`); }
            this.state[s.id] = { status: 'ruined', looted: true };
            g.toast(`Your scout found treasure in the ruins of ${s.name}: ${got.join(', ') || 'but your stores are full'}`);
          } else if (this.status(s) === 'known') this.setStatus(s, 'scouted');
        }
        m.phase = 'back'; m.t0 = this.clock; m.lastReveal = 0;
        g.toast('Your scout is heading home with news');
      } else if (m.kind === 'reinforce' && m.phase === 'out') {
        m.phase = 'ready';
      } else if (m.kind === 'army' && m.phase === 'out') {
        m.phase = 'ready';
        g.toast(`Your army has reached ${this.site(m.site).name}. Open the Map to lead the attack.`);
        g.emit('armyReady', m);
      } else if (m.phase === 'back') {
        this.home(m.vids);
        if (m.rams) g.state.rams = (g.state.rams || 0) + m.rams;
        if (m.catapults) g.state.catapults = (g.state.catapults || 0) + m.catapults;
        if (m.loot) { const got = []; for (const r in m.loot) { const n = g.add(r, m.loot[r]); if (n) got.push(`${n} ${RES[r].name.toLowerCase()}`); } g.toast(`The army is home${got.length ? ' with ' + got.join(', ') : ''}!`); }
        else if (m.kind === 'scout') g.toast('Your scout is back in the village');
        else g.toast('Your army has returned home');
        this.missions = this.missions.filter(x => x !== m);
        g.emit('country');
      }
    }
    // held places pay tribute; unguarded ones may be retaken
    for (const [id, hold] of Object.entries(this.holds)) {
      const s = this.site(+id), S = SITES[s.type];
      const guards = [...g.villagers.values()].filter(v => v.away === 'hold:' + id);
      if (this.clock >= hold.tributeT) {
        hold.tributeT = this.clock + 60;
        for (const r in S.tribute) g.add(r, S.tribute[r]);
      }
      // an enemy force gathers: you get a warning and time to respond
      if (!hold.attack && this.clock >= hold.checkT) {
        hold.attack = { at: this.clock + WAR.attackWarning, force: Math.max(1, Math.round(this.attackCap(s) * (0.8 + Math.random() * 0.4))) };
        g.emit('holdAttack', s);
      }
      if (hold.attack) hold.attack.force = Math.min(hold.attack.force, Math.ceil(this.attackCap(s) * 1.2)); // older saves: no 40-man armies
      if (hold.attack && this.clock >= hold.attack.at && !hold.attack.fighting) this.resolveAttack(s, hold);
      // reinforcements that arrive join the garrison
      for (const m of this.missions) if (m.kind === 'reinforce' && m.site === s.id && m.phase === 'ready') {
        for (const vid of m.vids) { const v = g.villagers.get(vid); if (v) v.away = 'hold:' + id; }
        this.missions = this.missions.filter(x => x !== m); g.toast(`Reinforcements reached ${s.name}`); g.emit('country');
      }
    }
  }
  // how big a force the enemy sends to take a place back: matched to the garrison you left there
  // (about 2 men plus 1.2 for each of yours), never more than the place is worth
  attackCap(site) { return Math.min(SITES[site.type].threat || 3, 2 + 1.2 * this.garrison(site).length); }
  garrison(site) { return [...this.game.villagers.values()].filter(v => v.away === 'hold:' + site.id); }
  // the garrison fights on its own
  resolveAttack(s, hold) {
    const g = this.game, guards = this.garrison(s), force = hold.attack.force;
    const strength = guards.reduce((a, v) => a + (JOBS[v.job].commander ? 4 : v.job === 'archer' ? 1.3 : 1), 0) * 1.6; // walls help the defenders
    hold.attack = null; hold.checkT = this.clock + WAR.holdCheckEvery;
    if (strength < force) {
      const lost = guards.filter((_, i) => i % 2 === 0);
      for (const v of lost) g.killVillager(v.id);
      this.home(guards.filter(v => !lost.includes(v)).map(v => v.id));
      delete this.holds[s.id]; this.setStatus(s, 'scouted');
      g.toast(`${s.name} was retaken by the enemy! ${lost.length} of your garrison fell.`, 'bad');
    } else {
      const lost = guards.filter((_, i) => i < Math.floor(guards.length * force / strength / 3));
      for (const v of lost) g.killVillager(v.id);
      g.toast(`Your garrison at ${s.name} drove off the attack${lost.length ? `, losing ${lost.length}` : ''}.`);
    }
    g.emit('country');
  }
  // after you led the defense yourself
  defenseResult(s, won, survivors) {
    const g = this.game, hold = this.holds[s.id], guards = this.garrison(s);
    for (const v of guards) if (!survivors.includes(v.id)) g.killVillager(v.id);
    if (!hold) return;
    hold.attack = null; hold.checkT = this.clock + WAR.holdCheckEvery;
    if (!won || !survivors.length) { this.home(survivors); delete this.holds[s.id]; this.setStatus(s, 'scouted'); }
    g.emit('country');
  }
  sendReinforcements(site, vids) {
    const g = this.game; if (!vids.length) return;
    const m = { id: this.nextId++, kind: 'reinforce', vids: [...vids], rams: 0, site: site.id, from: { x: 0, z: 0 }, to: { x: site.x, z: site.z }, t0: this.clock, dur: this.marchTime(site), phase: 'out' };
    this.missions.push(m); this.away(vids, 'army');
    g.toast(`${vids.length} soldiers march to reinforce ${site.name} (${Math.round(m.dur)}s)`); g.emit('country');
  }
  hold(site, guardVids) {
    this.away(guardVids, 'hold:' + site.id);
    this.holds[site.id] = { tributeT: this.clock + 60, checkT: this.clock + WAR.holdCheckEvery };
    this.setStatus(site, 'held');
    this.reveal(site.x, site.z, 22);
  }
  // what a garrison carries off when it strips a place it holds and burns it
  plunderLoot(site) { const L = SITES[site.type].loot || {}, out = {}; for (const r in L) out[r] = Math.round(L[r] * 1.5); return out; }
  plunderHeld(site) {
    const vids = this.garrison(site).map(v => v.id); if (!this.holds[site.id]) return;
    this.game.progress.add('plundered'); this.game.progress.log(`${site.name} was stripped and burned by its garrison.`, 'war');
    delete this.holds[site.id]; this.setStatus(site, 'ruined');
    const loot = this.plunderLoot(site);
    if (!vids.length) { for (const r in loot) this.game.add(r, loot[r]); this.game.emit('country'); return; }
    const m = { id: this.nextId++, kind: 'army', vids, rams: 0, site: site.id, from: { x: 0, z: 0 }, to: { x: site.x, z: site.z }, t0: this.clock, dur: this.marchTime(site), phase: 'back', loot, lastReveal: 0 };
    this.missions.push(m); for (const id of vids) { const v = this.game.villagers.get(id); if (v) v.away = 'army'; }
    this.game.toast(`The garrison of ${site.name} strips it bare, sets it alight and marches home with the loot (${Math.round(m.dur)}s)`);
    this.game.emit('country');
  }
  recall(site) {
    const vids = [...this.game.villagers.values()].filter(v => v.away === 'hold:' + site.id).map(v => v.id);
    this.home(vids); delete this.holds[site.id]; this.setStatus(site, 'scouted');
    this.game.toast(`The garrison of ${site.name} is coming home; the enemy will move back in`);
  }

  /* ---------- save ---------- */
  serialize() {
    let bin = ''; for (let i = 0; i < this.fog.length; i++) bin += String.fromCharCode(this.fog[i]);
    return { fog: btoa(bin), state: this.state, missions: this.missions, holds: this.holds, nextId: this.nextId };
  }
  load(o) {
    if (!o) return;
    try { const bin = atob(o.fog || ''); if (bin.length === this.fog.length) for (let i = 0; i < bin.length; i++) this.fog[i] = Math.max(this.fog[i], bin.charCodeAt(i)); } catch (_) { /* keep fresh fog */ }
    this.state = o.state || {}; this.missions = Array.isArray(o.missions) ? o.missions : []; this.holds = o.holds || {}; this.nextId = o.nextId || 1;
    // a battle can't be saved mid-fight: an army that was fighting simply waits at the gates again
    for (const m of this.missions) if (m.phase === 'battle') m.phase = 'ready';
    this.revealKnown();
    this.fogDirty = true;
  }
}
