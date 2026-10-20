// Rival clans: they own places on the map, grow, fight each other, raid you — and can be dealt with.
import { SITES, CLANS } from './data.js';

const TURN = 150;            // game seconds between the clans' moves
const SEATS = ['warlord', 'castle'];
const CLAIMABLE = ['village', 'fort', 'smallcastle', 'bandits', 'hideout'];

export class Clans {
  constructor(game) {
    this.game = game;
    this.rel = {};        // clan -> relation with you, -100..100
    this.status = {};     // clan -> 'rivals' | 'war' | 'truce' | 'allied' | 'married' | 'fallen'
    this.power = {};      // clan -> soldiers it can field
    this.truceUntil = {}; // clan -> game clock
    this.spied = {};      // clan -> true once a spy has mapped their lands
    this.nextTurn = 0;
    for (const k of Object.keys(CLANS)) { this.rel[k] = -10; this.status[k] = 'rivals'; this.power[k] = CLANS[k].power; }
  }
  get C() { return this.game.country; }
  get clock() { return this.game.state.clock; }

  // hand out the land once: each clan gets a seat (a castle) and the villages, forts and castles around it
  init() {
    const C = this.C;
    if (C.sites.some(s => (C.state[s.id] || {}).owner)) return;
    const keys = Object.keys(CLANS), seats = C.sites.filter(s => SEATS.includes(s.type)).sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
    seats.forEach((s, i) => this.setOwner(s, keys[Math.min(i, keys.length - 1)], true));   // a spare castle goes to the Hōjō, famed for their castles
    for (const s of C.sites) {
      if (!['village', 'fort', 'smallcastle'].includes(s.type) || C.status(s) === 'held' || C.status(s) === 'ruined') continue;
      const seat = seats.slice().sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z))[0];
      if (seat && Math.hypot(seat.x - s.x, seat.z - s.z) < 170) this.setOwner(s, this.owner(seat), true);
    }
  }
  owner(s) { return (this.C.state[s.id] || {}).owner || null; }
  setOwner(s, k, quiet = false) { const C = this.C; C.state[s.id] = { ...(C.state[s.id] || {}), owner: k }; if (!quiet) this.game.emit('country'); }
  sitesOf(k) { return this.C.sites.filter(s => this.owner(s) === k && !['ruined', 'held'].includes(this.C.status(s))); }
  seatOf(k) { return this.sitesOf(k).find(s => SEATS.includes(s.type)) || null; }
  alive(k) { return this.status[k] !== 'fallen' && this.sitesOf(k).length > 0; }
  hostile(k) { return this.alive(k) && (this.status[k] === 'rivals' || this.status[k] === 'war'); }
  friendly(k) { return this.status[k] === 'allied' || this.status[k] === 'married'; }
  name(k) { return CLANS[k] ? `${CLANS[k].name} clan` : 'the enemy'; }

  // the castle whose soldiers raid your village: the nearest seat of a clan still hostile to you
  raidSource() {
    let best = null, bd = Infinity;
    for (const k of Object.keys(CLANS)) { if (!this.hostile(k)) continue; const seat = this.seatOf(k); if (!seat) continue; const d = Math.hypot(seat.x, seat.z) * (this.status[k] === 'war' ? 0.6 : 1); if (d < bd) { bd = d; best = seat; } }
    return best;
  }

  update() {
    if (this.clock < this.nextTurn) return;
    const first = !this.nextTurn; this.nextTurn = this.clock + TURN; if (first) return;
    const g = this.game, keys = Object.keys(CLANS).filter(k => this.alive(k));
    for (const k of Object.keys(CLANS)) if (this.status[k] !== 'fallen' && !this.sitesOf(k).length) this.fall(k);
    for (const k of keys) {
      // they grow with their lands
      this.power[k] = Math.min(CLANS[k].power * 3, this.power[k] + 1 + this.sitesOf(k).length * 0.5);
      // feelings cool (or warm) back towards where they stand
      const aim = { war: -70, rivals: -15, truce: 0, allied: 50, married: 80 }[this.status[k]] ?? 0;
      this.rel[k] += Math.sign(aim - this.rel[k]) * Math.min(3, Math.abs(aim - this.rel[k]));
      if (this.status[k] === 'truce' && this.clock > (this.truceUntil[k] || 0)) { this.status[k] = 'rivals'; this.news(`The truce with the ${this.name(k)} has ended.`, 'warn'); }
      if (this.status[k] === 'allied' && this.rel[k] < 10) { this.status[k] = 'rivals'; this.news(`The ${this.name(k)} has broken off your alliance.`, 'bad'); }
      if (this.friendly(k) && Math.random() < 0.5) { const gift = { gold: 10 + Math.round(this.power[k] / 3), wheat: 20 }; for (const r in gift) g.add(r, gift[r]); }
      const r = Math.random();
      if (r < 0.35) this.expand(k);
      else if (r < 0.55) this.feud(k, keys);
      else if (r < 0.7 && this.status[k] === 'war') this.strike(k);
    }
    g.emit('country');
  }
  // take a nearby place nobody (or only bandits) holds
  expand(k) {
    const seat = this.seatOf(k); if (!seat) return;
    const C = this.C, cand = C.sites.filter(s => CLAIMABLE.includes(s.type) && !this.owner(s) && !['held', 'ruined'].includes(C.status(s)) && Math.hypot(s.x - seat.x, s.z - seat.z) < 160)
      .sort((a, b) => Math.hypot(a.x - seat.x, a.z - seat.z) - Math.hypot(b.x - seat.x, b.z - seat.z));
    const s = cand[0]; if (!s || this.power[k] < 12) return;
    this.setOwner(s, k); this.power[k] -= 4;
    if (C.status(s) !== 'hidden') this.news(`The ${this.name(k)} has taken ${s.name}.`);
  }
  // clans fight each other over a border place
  feud(k, keys) {
    const foes = keys.filter(o => o !== k); if (!foes.length) return;
    const o = foes[Math.floor(Math.random() * foes.length)], seat = this.seatOf(k); if (!seat) return;
    const targets = this.sitesOf(o).filter(s => !SEATS.includes(s.type) || this.sitesOf(o).length === 1).sort((a, b) => Math.hypot(a.x - seat.x, a.z - seat.z) - Math.hypot(b.x - seat.x, b.z - seat.z));
    const s = targets[0]; if (!s) return;
    const win = Math.random() < this.power[k] / (this.power[k] + this.power[o] * 1.2);
    this.power[k] = Math.max(5, this.power[k] - 3); this.power[o] = Math.max(5, this.power[o] - 3);
    if (win) { this.setOwner(s, k); if (this.C.status(s) !== 'hidden' || this.friendly(o) || this.friendly(k)) this.news(`The ${this.name(k)} took ${s.name} from the ${this.name(o)}.`); }
    if (!this.sitesOf(o).length) this.fall(o);
  }
  // a clan at war with you marches on one of the places you hold
  strike(k) {
    const C = this.C, holds = Object.keys(C.holds).map(id => C.site(+id)).filter(Boolean);
    const s = holds.find(h => !C.holds[h.id].attack); if (!s) return;
    C.holds[s.id].checkT = this.clock; C.holds[s.id].by = k;
  }
  fall(k) {
    if (this.status[k] === 'fallen') return;
    this.status[k] = 'fallen';
    this.news(`The ${this.name(k)} is no more — its last stronghold has fallen.`, 'good');
    this.game.progress && this.game.progress.check();
  }
  news(text, kind = '') { this.game.toast(text, kind === 'good' ? '' : kind); this.game.progress && this.game.progress.log(text, 'clans'); }

  /* ---------- when you act against them ---------- */
  onTaken(site, how) {
    const k = this.owner(site); if (!k) return;
    this.rel[k] = Math.max(-100, this.rel[k] - (SEATS.includes(site.type) ? 45 : 25));
    if (this.status[k] !== 'war' && this.alive(k)) { this.status[k] = 'war'; this.news(`The ${this.name(k)} declares war on you for ${how === 'held' ? 'taking' : 'burning'} ${site.name}!`, 'bad'); }
    if (how === 'held') this.setOwner(site, null);
    if (!this.sitesOf(k).length) this.fall(k);
  }

  /* ---------- diplomacy ---------- */
  // what can be done with clan k right now: [{ id, label, cost, why }]
  options(k) {
    const g = this.game, st = this.status[k], rel = this.rel[k], mine = g.soldiers(true).length, out = [];
    const gold = n => ({ gold: n });
    out.push({ id: 'gift', label: 'Send gifts', desc: 'Silk, sake and gold: they think better of you (+15).', cost: gold(100) });
    out.push({ id: 'spy', label: 'Send a spy', desc: this.spied[k] ? 'Your spies already know their lands.' : 'Maps all their places and shows their strength.', cost: gold(40), why: this.spied[k] ? 'Already done' : '' });
    if (st === 'war' || st === 'rivals') out.push({ id: 'truce', label: 'Offer a truce', desc: 'No raids or attacks from them for 10 days.', cost: gold(st === 'war' ? 200 : 80), why: rel < (st === 'war' ? -40 : -60) ? 'They are too angry — send gifts first' : '' });
    if (st !== 'allied' && st !== 'married') out.push({ id: 'ally', label: 'Propose an alliance', desc: 'Allies never raid you, send gifts now and then, and share what they know.', cost: gold(250), why: rel < 40 ? `They need to like you more (${Math.round(rel)} / 40)` : '' });
    if (st === 'allied') out.push({ id: 'marry', label: 'Arrange a marriage', desc: 'Bind the clans for good: a lasting alliance and richer gifts.', cost: { gold: 400, wheat: 200 }, why: rel < 65 ? `They need to like you more (${Math.round(rel)} / 65)` : '' });
    if (st !== 'married') out.push({ id: 'demand', label: 'Demand tribute', desc: 'If they fear you, they pay — but they will hate you for it.', cost: {}, why: mine < this.power[k] * 0.6 ? 'They do not fear you — you need a bigger army' : '' });
    if (st !== 'war') out.push({ id: 'war', label: 'Declare war', desc: 'They will raid you and attack the places you hold.', cost: {} });
    return out;
  }
  act(k, id) {
    const g = this.game, o = this.options(k).find(x => x.id === id); if (!o) return false;
    if (o.why) { g.toast(o.why, 'warn'); return false; }
    if (!g.canAfford(o.cost)) { g.toast('Not enough resources', 'warn'); return false; }
    g.pay(o.cost);
    const n = this.name(k);
    if (id === 'gift') { this.rel[k] = Math.min(100, this.rel[k] + 15); this.news(`You sent gifts to the ${n}. They are pleased.`); }
    if (id === 'spy') { this.spied[k] = true; for (const s of this.sitesOf(k)) this.C.reveal(s.x, s.z, 16); this.news(`Your spy maps the lands of the ${n}: ${this.sitesOf(k).length} places, about ${Math.round(this.power[k])} soldiers.`); }
    if (id === 'truce') { this.status[k] = 'truce'; this.truceUntil[k] = this.clock + 10 * 720; this.rel[k] = Math.max(this.rel[k], 0); this.news(`A truce with the ${n}: no fighting for ten days.`); }
    if (id === 'ally') { this.status[k] = 'allied'; this.rel[k] = Math.max(this.rel[k], 50); for (const s of this.sitesOf(k)) this.C.reveal(s.x, s.z, 16); this.news(`The ${n} is now your ally!`); }
    if (id === 'marry') { this.status[k] = 'married'; this.rel[k] = 90; this.news(`A wedding binds your house to the ${n}. The alliance will last.`); }
    if (id === 'demand') { const pay = { gold: 60 + Math.round(this.power[k] * 3), wheat: 100 }; for (const r in pay) g.add(r, pay[r]); this.rel[k] = Math.max(-100, this.rel[k] - 30); this.news(`The ${n} pays you tribute: ${pay.gold} gold and ${pay.wheat} wheat — and seethes.`); }
    if (id === 'war') { this.status[k] = 'war'; this.rel[k] = Math.min(this.rel[k], -60); this.news(`You declare war on the ${n}!`, 'bad'); }
    g.emit('country'); return true;
  }

  serialize() { return { rel: this.rel, status: this.status, power: this.power, truceUntil: this.truceUntil, spied: this.spied, nextTurn: this.nextTurn }; }
  load(o) {
    if (!o) return;
    for (const k of Object.keys(CLANS)) {
      if (o.rel && typeof o.rel[k] === 'number') this.rel[k] = o.rel[k];
      if (o.status && o.status[k]) this.status[k] = o.status[k];
      if (o.power && typeof o.power[k] === 'number') this.power[k] = o.power[k];
    }
    this.truceUntil = o.truceUntil || {}; this.spied = o.spied || {}; this.nextTurn = o.nextTurn || 0;
  }
}
