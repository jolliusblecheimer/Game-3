// The story of your clan: the chronicle, statistics, tasks with rewards, the guide for new lords,
// achievements — and the goal: unify the land (Tenka) by taking the Shogun's castle or breaking every rival clan.
import { BUILDINGS, TECHS, ERAS, CLANS, rankOf } from './data.js';

const soldiers = g => g.soldiers(true).length;
const count = (g, t) => g.countType(t);
const jobs = (g, j) => g.countJob(j);

// The main quest: the story of your rise, one step at a time. Each says what to do and where to find it;
// when it's done you claim the reward, and the next step appears.
export const QUESTS = [
  { title: 'Timber', text: 'Build a Lumber Camp near the trees.', hint: 'Build menu → Resources → Lumber Camp', done: g => count(g, 'lumber') > 0, reward: { wood: 60, wheat: 40 } },
  { title: 'Hands at work', text: 'Give the Lumber Camp two woodcutters.', hint: 'Select the camp and press +', done: g => jobs(g, 'woodcutter') >= 2, reward: { wood: 60 } },
  { title: 'Stone', text: 'Build a Stone Quarry.', hint: 'Build menu → Resources → Stone Quarry', done: g => count(g, 'quarry') > 0, reward: { wood: 50, stone: 40 } },
  { title: 'Roads home', text: 'Connect every building to the Keep with roads.', hint: 'A red 道 sign means no road — Dirt Road is free (Village tab)', done: g => (g.unlinked || 0) === 0 && g.buildings.size > 3, reward: { stone: 40, gold: 20 } },
  { title: 'Room for families', text: 'Build a second Minka House so new families can move in.', hint: 'Build menu → Village → Minka House', done: g => count(g, 'house') >= 2, reward: { wood: 80, wheat: 60 } },
  { title: 'Scholars', text: 'Build a Scholars’ Pavilion — your clan’s research happens there.', hint: 'Build menu → Village → Scholars’ Pavilion', done: g => count(g, 'shoin') > 0, reward: { gold: 30 }, wisdom: 3 },
  { title: 'A Clan Hall', text: 'Research “Clan Hall”: put Wisdom into it, then complete it.', hint: 'Select the Scholars\u2019 Pavilion \u2192 Open the research tree', done: g => g.hasResearch('keep2'), reward: { wood: 100, stone: 60 } },
  { title: 'A bigger Keep', text: 'Upgrade your Keep to level 2.', hint: 'Select the Keep → Upgrade', done: g => g.thLevel >= 2, reward: { gold: 60, stone: 80 } },
  { title: 'The first spear', text: 'Build a Dojo and train your first spearman.', hint: 'Build menu → Military → Dojo, then give it trainees', done: g => soldiers(g) >= 1, reward: { wheat: 80, gold: 40 } },
  { title: 'Eyes on the hills', text: 'Open the Map and send a scout into the clouds.', hint: 'Map button (bottom right) → click the land', done: g => (g.progress.stats.scouts || 0) >= 1, reward: { wheat: 60, gold: 20 } },
  { title: 'Watchtower', text: 'Build a Yagura Tower and put archers on it.', hint: 'Build a Kyūdō Range for archers — they climb the tower by themselves', done: g => g.soldiers().some(v => v.post), reward: { stone: 100, gold: 40 } },
  { title: 'Hold the village', text: 'Beat off a raid on your village.', hint: 'When raiders come: select your soldiers and send them, or let them fight', done: g => (g.state.stats.raidsBeaten || 0) >= 1, reward: { gold: 80 }, wisdom: 4 },
  { title: 'First blood abroad', text: 'Win a battle on the map — a bandit camp is a good start.', hint: 'Map → click a place → Raid', done: g => (g.progress.stats.battlesWon || 0) >= 1, reward: { gold: 100, wood: 100 } },
  { title: 'Castle Town', text: 'Research “Castle Architecture” and raise your Keep to level 3.', hint: 'Pavilion → research → era 2 → ★ Castle Architecture', done: g => g.thLevel >= 3, reward: { gold: 150, stone: 150 }, wisdom: 5 },
  { title: 'Our banner abroad', text: 'Take a place on the map and hold it with a garrison.', hint: 'Win a battle there and choose “Hold it”', done: g => Object.keys(g.country.holds).length >= 1, reward: { gold: 120, wheat: 150 } },
  { title: 'A wonder of the age', text: 'Gather 5 blueprints and build a Great Building.', hint: 'Blueprints come from battles, raids you beat off and temples — Wonders tab', done: g => [...g.buildings.values()].some(b => b.def.wonder && b.done), reward: { gold: 200 }, wisdom: 8 },
  { title: 'Seat of a Daimyō', text: 'Raise your Keep to level 4.', hint: 'Pavilion \u2192 research, era 3 → ★ Seat of a Daimyō, then upgrade the Keep', done: g => g.thLevel >= 4, reward: { gold: 250, stone: 250 } },
  { title: 'A commander', text: 'Build a Strategy Hall and appoint your first commander.', hint: 'Research “Oni Captains”, build the Strategy Hall, appoint at the Keep', done: g => g.villagers && [...g.villagers.values()].some(v => v.job === 'berserker' || v.job === 'taisho'), reward: { gold: 200, wheat: 200 }, wisdom: 6 },
  { title: 'Contender', text: 'Raise your Keep to level 5.', hint: 'Pavilion \u2192 research, era 4 → ★ The Great Keep', done: g => g.thLevel >= 5, reward: { gold: 400, stone: 300 } },
  { title: 'The Emperor’s leave', text: 'Research the Imperial Mandate.', hint: 'Pavilion → research → era 5 → ★ Imperial Mandate', done: g => g.hasResearch('mandate'), reward: { gold: 500 }, wisdom: 10 },
  { title: 'Tenka', text: 'Unify the land: take the Shogun’s castle — or break every rival clan.', hint: 'Map → the Shogun’s castle, or Clans & diplomacy', done: g => !!g.progress.won, reward: { gold: 1000 } },
];
export const GUIDE = QUESTS;   // (older code and saves called it the guide)

// Task templates: each makes a task from where you stand now, or nothing if it doesn't fit
const TASKS = [
  g => { const want = Object.entries(BUILDINGS).find(([t, d]) => d.cat && d.cat !== 'wonder' && d.th <= g.thLevel && !d.line && count(g, t) === 0 && t !== 'townhall' && (g.buildLimit(t) ?? 1) > 0); return want && { id: 'build:' + want[0], text: `Build a ${want[1].name}`, check: gg => count(gg, want[0]) > 0 && [...gg.buildings.values()].some(b => b.type === want[0] && b.done), reward: { wood: 80, stone: 40 } }; },
  g => { const n = g.pop + 5; return { id: 'pop:' + n, text: `Grow your village to ${n} villagers`, check: gg => gg.pop >= n, reward: { wheat: 150, gold: 30 } }; },
  g => { const n = soldiers(g) + 3; return { id: 'army:' + n, text: `Have ${n} soldiers`, check: gg => soldiers(gg) >= n, reward: { gold: 60, wheat: 80 } }; },
  g => { const n = (g.progress.stats.battlesWon || 0) + 1; return { id: 'win:' + n, text: 'Win a raid on a place on the map', check: gg => (gg.progress.stats.battlesWon || 0) >= n, reward: { gold: 80, wood: 100 } }; },
  g => { const n = (g.state.stats.raidsBeaten || 0) + 1; return soldiers(g) ? { id: 'defend:' + n, text: 'Beat off a raid on your village', check: gg => (gg.state.stats.raidsBeaten || 0) >= n, reward: { stone: 120, gold: 40 } } : null; },
  g => g.thLevel < 5 && { id: 'keep:' + (g.thLevel + 1), text: `Upgrade your Keep to level ${g.thLevel + 1}`, check: gg => gg.thLevel > g.thLevel, reward: { gold: 120, stone: 150 } },
  g => { const n = g.state.research.done.length + 1; return { id: 'study:' + n, text: 'Complete a technology (Research)', check: gg => gg.state.research.done.length >= n, reward: { gold: 70 }, wisdom: 3 }; },
  g => { const need = Object.keys(BUILDINGS).filter(t => BUILDINGS[t].wonder && BUILDINGS[t].wonder.era <= g.era + 1 && !count(g, t)); return need.length && { id: 'bp:' + g.state.research.done.length, text: 'Find a blueprint for a Great Building (win battles, beat off raids)', check: gg => Object.values(gg.state.blueprints || {}).reduce((a, b) => a + b, 0) > Object.values(g.state.blueprints || {}).reduce((a, b) => a + b, 0), reward: { gold: 60, stone: 60 }, wisdom: 2 }; },
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
  { id: 'scholar', name: 'Scholar of War', desc: 'Complete every technology of an era', check: g => [1, 2, 3, 4, 5, 6].some(e => TECHS.filter(t => t.era === e).every(t => g.hasResearch(t.id))) },
  { id: 'castletown', name: 'Castle Town', desc: 'Reach the era of the Castle Town', check: g => g.era >= 3 },
  { id: 'shogunate', name: 'The Shogunate', desc: 'Reach the final era', check: g => g.era >= 6 },
  { id: 'wonder', name: 'A Wonder of the Age', desc: 'Build a Great Building', check: g => [...g.buildings.values()].some(b => b.def.wonder && b.done) },
  { id: 'wonder10', name: 'Eternal', desc: 'Raise a Great Building to level 10', check: g => [...g.buildings.values()].some(b => b.def.wonder && b.level >= 10) },
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
    // the main quest: done → ready to claim
    const Q = QUESTS[this.guide];
    let qd = false; try { qd = Q && Q.done(g); } catch (e) { }
    if (Q && !this.questReady && qd) { this.questReady = true; g.sfx('coin'); g.toast(`Quest complete: ${Q.title}! Claim your reward (Tasks).`); g.emit('guide'); }
    // side tasks: keep three going; finished ones wait for you to claim them
    this.fillTasks();
    for (const t of this.tasks) if (!t.ready && t.check(g)) { t.ready = true; g.toast(`Task complete: ${t.text} \u2014 claim your reward (Tasks).`); g.emit('tasks'); }
    this.check();
  }
  toClaim() { return (this.questReady ? 1 : 0) + this.tasks.filter(t => t.ready).length; }
  pay(reward, wisdom) { const g = this.game; for (const r in reward) g.add(r, reward[r]); if (wisdom) g.gainWisdom(wisdom); g.sfx('fanfare'); }
  claimQuest() {
    const Q = QUESTS[this.guide]; if (!Q || !this.questReady) return false;
    this.pay(Q.reward, Q.wisdom); this.log(`Quest done: ${Q.title}.`, 'task');
    this.guide++; this.questReady = false;
    const N = QUESTS[this.guide]; this.game.toast(N ? `Next quest: ${N.title} \u2014 ${N.text}` : 'Every quest is done. The land is yours.');
    this.game.emit('guide'); return true;
  }
  claimTask(id) {
    const t = this.tasks.find(t => t.id === id); if (!t || !t.ready) return false;
    this.pay(t.reward, t.wisdom); this.log(`Task done: ${t.text}.`, 'task');
    this.tasks = this.tasks.filter(x => x !== t); this.fillTasks(t.id); this.game.emit('tasks'); return true;
  }
  fillTasks(skip) {
    const g = this.game, have = new Set(this.tasks.map(t => t.id));
    for (const make of TASKS.slice().sort(() => Math.random() - 0.5)) {
      if (this.tasks.length >= 3) break;
      const t = make(g); if (!t || have.has(t.id) || t.id === skip || t.check(g)) continue;   // (already done: not a task)
      this.tasks.push(t); have.add(t.id);
    }
  }
  // achievements and the end of the game
  check() {
    const g = this.game;
    for (const a of ACHIEVEMENTS) if (!this.ach[a.id] && a.check(g)) { this.ach[a.id] = g.state.day; g.toast(`Achievement: ${a.name} — ${a.desc}`); this.log(`Achievement unlocked: ${a.name}.`, 'ach'); g.emit('achievement', a); }
    if (!this.won && Object.keys(CLANS).every(k => g.clans.status[k] === 'fallen')) {
      // the clans are broken — but only the Emperor's mandate makes you ruler of the realm
      if (g.hasResearch('mandate')) this.win('conquest');
      else if (!this.mandateHint) { this.mandateHint = true; g.toast('Every rival clan is broken! Win the Emperor\u2019s mandate (Research) to be named ruler of the realm.'); }
    }
  }
  win(how) {
    if (this.won) return;
    this.won = how; this.stats.wonDay = this.game.state.day;
    this.log(how === 'shogun' ? 'The Shogun’s castle has fallen. The land is yours: Tenka!' : 'Every rival clan is broken. The land is yours: Tenka!', 'win');
    this.check();
    this.game.emit('victory', how);
  }

  serialize() { return { chronicle: this.chronicle, stats: this.stats, ach: this.ach, tasks: this.tasks.map(t => t.id), ready: this.tasks.filter(t => t.ready).map(t => t.id), guide: this.guide, questReady: this.questReady, quests: 2, won: this.won }; }
  load(o, isNew) {
    if (!o) { this.guide = isNew ? 0 : GUIDE.length; return; }   // older saves: no guide
    this.chronicle = Array.isArray(o.chronicle) ? o.chronicle : []; this.stats = o.stats || {}; this.ach = o.ach || {};
    this.guide = typeof o.guide === 'number' ? o.guide : GUIDE.length; this.won = o.won || null; this.questReady = !!o.questReady;
    // saves from before the quest line: start at the first step not yet done
    if (o.quests !== 2) { this.guide = 0; this.questReady = false; try { while (this.guide < QUESTS.length && QUESTS[this.guide].done(this.game)) this.guide++; } catch (e) { } }
    // tasks are rebuilt from their templates; the ones that no longer fit are replaced
    const ids = new Set(o.tasks || []);
    const ready = new Set(o.ready || []);
    for (const make of TASKS) { const t = make(this.game); if (t && ids.has(t.id)) { if (ready.has(t.id)) t.ready = true; this.tasks.push(t); } }
  }
}
