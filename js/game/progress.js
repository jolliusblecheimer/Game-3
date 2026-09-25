// The story of your clan: the chronicle, statistics, tasks with rewards, the guide for new lords,
// achievements — and the goal: unify the land (Tenka) by taking the Shogun's castle or breaking every rival clan.
import { BUILDINGS, RESEARCH, CLANS, rankOf } from './data.js';

const soldiers = g => g.soldiers(true).length;
const count = (g, t) => g.countType(t);
const jobs = (g, j) => g.countJob(j);

// The guide: the first steps for a new lord, one at a time
export const GUIDE = [
  { text: 'Build a Lumber Camp near the trees (Resources tab)', done: g => count(g, 'lumber') > 0 },
  { text: 'Give it two woodcutters: select the camp and press +', done: g => jobs(g, 'woodcutter') >= 2 },
  { text: 'Build a Stone Quarry (Resources tab)', done: g => count(g, 'quarry') > 0 },
  { text: 'Build a Minka House so new families can move in (Village tab)', done: g => count(g, 'house') >= 2 },
  { text: 'Build a Dojo and train your first spearman (Military tab)', done: g => soldiers(g) >= 1 },
  { text: 'Open the Map and send a scout into the clouds', done: g => (g.progress.stats.scouts || 0) >= 1 },
  { text: 'Upgrade your Keep to level 2 — select the Keep', done: g => g.thLevel >= 2 },
];

// Task templates: each makes a task from where you stand now, or nothing if it doesn't fit
const TASKS = [
  g => { const want = Object.entries(BUILDINGS).find(([t, d]) => d.cat && d.th <= g.thLevel && !d.line && count(g, t) === 0 && t !== 'townhall' && (g.buildLimit(t) ?? 1) > 0); return want && { id: 'build:' + want[0], text: `Build a ${want[1].name}`, check: gg => count(gg, want[0]) > 0 && [...gg.buildings.values()].some(b => b.type === want[0] && b.done), reward: { wood: 80, stone: 40 } }; },
  g => { const n = g.pop + 5; return { id: 'pop:' + n, text: `Grow your village to ${n} villagers`, check: gg => gg.pop >= n, reward: { wheat: 150, gold: 30 } }; },
  g => { const n = soldiers(g) + 3; return { id: 'army:' + n, text: `Have ${n} soldiers`, check: gg => soldiers(gg) >= n, reward: { gold: 60, wheat: 80 } }; },
  g => { const n = (g.progress.stats.battlesWon || 0) + 1; return { id: 'win:' + n, text: 'Win a raid on a place on the map', check: gg => (gg.progress.stats.battlesWon || 0) >= n, reward: { gold: 80, wood: 100 } }; },
  g => { const n = (g.state.stats.raidsBeaten || 0) + 1; return soldiers(g) ? { id: 'defend:' + n, text: 'Beat off a raid on your village', check: gg => (gg.state.stats.raidsBeaten || 0) >= n, reward: { stone: 120, gold: 40 } } : null; },
  g => g.thLevel < 5 && { id: 'keep:' + (g.thLevel + 1), text: `Upgrade your Keep to level ${g.thLevel + 1}`, check: gg => gg.thLevel > g.thLevel, reward: { gold: 120, stone: 150 } },
  g => { const n = g.state.research.done.length + 1; return [...g.buildings.values()].some(b => b.type === 'strategy' && b.done) && { id: 'study:' + n, text: 'Complete a study at the Strategy Hall', check: gg => gg.state.research.done.length >= n, reward: { gold: 70 } }; },
  g => { const n = Math.min(30, g.harmony() + 5); return g.harmony() < 30 && { id: 'harmony:' + n, text: `Raise Harmony to +${n}%`, check: gg => gg.harmony() >= n, reward: { wheat: 120, wood: 60 } }; },
  g => { const held = Object.keys(g.country.holds).length; return soldiers(g) >= 4 && { id: 'hold:' + (held + 1), text: 'Take a place and hold it with a garrison', check: gg => Object.keys(gg.country.holds).length > held, reward: { gold: 100, stone: 100 } }; },
  g => { const n = (g.progress.stats.scouts || 0) + 2; return { id: 'scout:' + n, text: 'Send out two scouts', check: gg => (gg.progress.stats.scouts || 0) >= n, reward: { wheat: 60, gold: 20 } }; },
];

// Achievements: a name, what it takes, and a check
export const ACHIEVEMENTS = [
  { id: 'veteran', name: 'Blooded', desc: 'Raise a soldier to Veteran', check: g => [...g.villagers.values()].some(v => rankOf(v) >= 1) },
  { id: 'hero', name: 'A Living Legend', desc: 'Raise a soldier to the rank of Hero', check: g => [...g.villagers.values()].some(v => rankOf(v) >= 3) },
  { id: 'hooves', name: 'Thunder of Hooves', desc: 'Train your first cavalry', check: g => [...g.villagers.values()].some(v => v.job === 'cavalry') },
  { id: 'shadows', name: 'From the Shadows', desc: 'Train a ninja', check: g => [...g.villagers.values()].some(v => v.job === 'ninja') },
  { id: 'firstBlood', name: 'First Blood', desc: 'Beat off your first raid', check: g => (g.state.stats.raidsBeaten || 0) >= 1 },
  { id: 'warband', name: 'War Band', desc: 'Have 10 soldiers', check: g => soldiers(g) >= 10 },
  { id: 'army', name: 'An Army', desc: 'Have 30 soldiers', check: g => soldiers(g) >= 30 },
  { id: 'town', name: 'A Town', desc: 'Reach 50 villagers', check: g => g.pop >= 50 },
  { id: 'city', name: 'A City', desc: 'Reach 100 villagers', check: g => g.pop >= 100 },
  { id: 'keep5', name: 'Tenshu', desc: 'Raise your Keep to level 5', check: g => g.thLevel >= 5 },
  { id: 'zen', name: 'Perfect Harmony', desc: 'Reach +30% Harmony', check: g => g.harmony() >= 30 },
  { id: 'conqueror', name: 'Conqueror', desc: 'Win 10 battles', check: g => (g.progress.stats.battlesWon || 0) >= 10 },
  { id: 'castle', name: 'Castle Breaker', desc: 'Take a castle', check: g => (g.progress.stats.castlesTaken || 0) >= 1 },
  { id: 'lord', name: 'Lord of the Province', desc: 'Hold 3 places at once', check: g => Object.keys(g.country.holds).length >= 3 },
  { id: 'burner', name: 'Fire and Sword', desc: 'Plunder 5 places', check: g => (g.progress.stats.plundered || 0) >= 5 },
  { id: 'flawless', name: 'Not One Lost', desc: 'Win a battle without losing a soldier', check: g => !!g.progress.stats.flawless },
  { id: 'slayer', name: 'Bandit Slayer', desc: 'Defeat 100 raiders', check: g => (g.progress.stats.raidersKilled || 0) >= 100 },
  { id: 'scholar', name: 'Scholar of War', desc: 'Complete a whole skill tree', check: g => Object.values(RESEARCH).some(T => T.nodes.every(n => g.hasResearch(n.id))) },
  { id: 'samurai', name: 'Way of the Warrior', desc: 'Have 10 samurai', check: g => jobs(g, 'samurai') >= 10 },
  { id: 'friend', name: 'Friends in High Places', desc: 'Ally with a clan', check: g => Object.keys(CLANS).some(k => g.clans.friendly(k)) },
  { id: 'wedding', name: 'A Great Wedding', desc: 'Marry into a clan', check: g => Object.keys(CLANS).some(k => g.clans.status[k] === 'married') },
  { id: 'breaker', name: 'Clan Breaker', desc: 'Destroy a rival clan', check: g => Object.keys(CLANS).some(k => g.clans.status[k] === 'fallen') },
  { id: 'month', name: 'A Long Reign', desc: 'Rule for 30 days', check: g => g.state.day >= 30 },
  { id: 'rich', name: 'Treasury', desc: 'Store 1000 gold', check: g => g.state.res.gold >= 1000 },
  { id: 'builder', name: 'Master Builder', desc: 'Build 100 buildings', check: g => g.buildings.size >= 100 },
  { id: 'tenka', name: 'Tenka', desc: 'Unify the land', check: g => !!g.progress.won },
];

export class Progress {
  constructor(game) {
    this.game = game;
    this.chronicle = [];      // { day, text, kind }
    this.stats = {};          // battlesWon, battlesLost, castlesTaken, plundered, raidersKilled, soldiersLost, scouts, maxPop ...
    this.ach = {};            // id -> day unlocked
    this.tasks = [];          // active tasks (ids); built back from templates
    this.guide = 0;           // guide step (GUIDE.length = finished)
    this.won = null;          // how the land was unified
    this.t = 0;
  }
  log(text, kind = '') { this.chronicle.push({ day: this.game.state.day, text, kind }); if (this.chronicle.length > 300) this.chronicle.shift(); this.game.emit('chronicle'); }
  add(k, n = 1) { this.stats[k] = (this.stats[k] || 0) + n; }

  update(dt) {
    this.t += dt; if (this.t < 1) return; this.t = 0;
    const g = this.game;
    this.stats.maxPop = Math.max(this.stats.maxPop || 0, g.pop);
    // the guide
    if (this.guide < GUIDE.length && GUIDE[this.guide].done(g)) {
      this.guide++;
      g.toast(this.guide < GUIDE.length ? `Well done! Next: ${GUIDE[this.guide].text}` : 'You know the basics now, lord. Tasks will keep coming — see the Tasks button.');
      g.emit('guide');
    }
    // tasks: keep three going; pay out the finished ones
    this.fillTasks();
    for (const t of this.tasks.slice()) if (t.check(g)) {
      for (const r in t.reward) g.add(r, t.reward[r]);
      g.toast(`Task done: ${t.text}! Reward: ${Object.entries(t.reward).map(([r, n]) => `${n} ${r}`).join(', ')}`);
      this.log(`Task done: ${t.text}.`, 'task');
      this.tasks = this.tasks.filter(x => x !== t); this.fillTasks(t.id); g.emit('tasks');
    }
    this.check();
  }
  fillTasks(skip) {
    const g = this.game, have = new Set(this.tasks.map(t => t.id));
    for (const make of TASKS.slice().sort(() => Math.random() - 0.5)) {
      if (this.tasks.length >= 3) break;
      const t = make(g); if (!t || have.has(t.id) || t.id === skip || t.check(g)) continue;
      this.tasks.push(t); have.add(t.id);
    }
  }
  // achievements and the end of the game
  check() {
    const g = this.game;
    for (const a of ACHIEVEMENTS) if (!this.ach[a.id] && a.check(g)) { this.ach[a.id] = g.state.day; g.toast(`Achievement: ${a.name} — ${a.desc}`); this.log(`Achievement unlocked: ${a.name}.`, 'ach'); g.emit('achievement', a); }
    if (!this.won && Object.keys(CLANS).every(k => g.clans.status[k] === 'fallen')) this.win('conquest');
  }
  win(how) {
    if (this.won) return;
    this.won = how; this.stats.wonDay = this.game.state.day;
    this.log(how === 'shogun' ? 'The Shogun’s castle has fallen. The land is yours: Tenka!' : 'Every rival clan is broken. The land is yours: Tenka!', 'win');
    this.check();
    this.game.emit('victory', how);
  }

  serialize() { return { chronicle: this.chronicle, stats: this.stats, ach: this.ach, tasks: this.tasks.map(t => t.id), guide: this.guide, won: this.won }; }
  load(o, isNew) {
    if (!o) { this.guide = isNew ? 0 : GUIDE.length; return; }   // older saves: no guide
    this.chronicle = Array.isArray(o.chronicle) ? o.chronicle : []; this.stats = o.stats || {}; this.ach = o.ach || {};
    this.guide = typeof o.guide === 'number' ? o.guide : GUIDE.length; this.won = o.won || null;
    // tasks are rebuilt from their templates; the ones that no longer fit are replaced
    const ids = new Set(o.tasks || []);
    for (const make of TASKS) { const t = make(this.game); if (t && ids.has(t.id)) this.tasks.push(t); }
  }
}
