// Game data: every number that shapes the economy lives here.
// The pace is deliberately slow: this is meant to be a calm game.

export const RES = {
  wheat: { name: 'Wheat', icon: 'wheat' },
  wood: { name: 'Wood', icon: 'wood' },
  stone: { name: 'Stone', icon: 'stone' },
  gold: { name: 'Gold', icon: 'gold' },
  iron: { name: 'Iron', icon: 'iron', extra: true },   // extra: only shown once you have some (or the building for it)
  sake: { name: 'Sake', icon: 'sake', extra: true },
};

// The year: each season lasts a few days and changes the fields, the forest and the mood
export const DAYS_PER_SEASON = 2;
export const SEASONS = [
  { name: 'Spring', kanji: '春', farm: 1.0, wood: 1.0, march: 1.0, mood: 5, arrive: 1.3 },
  { name: 'Summer', kanji: '夏', farm: 1.25, wood: 1.1, march: 1.0, mood: 3, arrive: 1.0 },
  { name: 'Autumn', kanji: '秋', farm: 1.6, wood: 1.0, march: 1.0, mood: 2, arrive: 1.0 },
  { name: 'Winter', kanji: '冬', farm: 0, wood: 0.8, march: 0.75, mood: -6, arrive: 0.5 },
];

export const START = {
  res: { wheat: 300, wood: 260, stone: 140, gold: 60, iron: 0, sake: 0 },
  villagers: 10,
};

export const ECON = {
  walkSpeed: 3.0,            // world units per second
  arriveEvery: 100,          // while there are empty homes and food, a newcomer may arrive this often…
  arriveChance: 0.7,         // …if they decide to come (Harmony makes it likelier)
  arriveCost: { wheat: 40 },
  eatEvery: 70,              // each villager eats 1 wheat this often
  hungryWork: 0.5,           // work speed when out of wheat
  dayLength: 720,            // seconds for a full day–night cycle at 1×
  refund: 0.5,               // share of cost returned when demolishing
  offlineCapHours: 4,
  offlineEfficiency: 0.6,    // share of normal output earned while away
  treeRegrow: 300,           // seconds for a felled tree to regrow
  treeChops: 3,              // trips a tree supports before it falls
  clearTime: 6,              // seconds to clear one tree or boulder
};

// Town Hall levels: everything else grows from here.
export const TOWNHALL = [
  null,
  { housing: 8,  storage: 500 },
  { housing: 10, storage: 800, cost: { wood: 240, stone: 140, gold: 30 },  time: 150, needPop: 12 },
  { housing: 12, storage: 1200, cost: { wood: 520, stone: 400, gold: 120 }, time: 240, needPop: 16 },
  { housing: 14, storage: 1800, cost: { wood: 850, stone: 750, gold: 300 }, time: 330, needPop: 21 },
  { housing: 16, storage: 2600, cost: { wood: 1300, stone: 1200, gold: 600 }, time: 420, needPop: 26 },
];
export const MAX_TH = 5;

// Jobs. `work` = seconds of work per trip, `amount` = goods carried back.
export const JOBS = {
  idle:           { name: 'Villager',        look: 'villager', desc: 'Unemployed. Free villagers build, upgrade, repair and clear land on their own — or give them a job at a workplace.' },
  farmer:         { name: 'Farmer',          look: 'farmer',      res: 'wheat', work: 12, amount: 6 },
  woodcutter:     { name: 'Woodcutter',      look: 'woodcutter',  res: 'wood',  work: 10, amount: 7 },
  stonecutter:    { name: 'Stonecutter',     look: 'stonecutter', res: 'stone', work: 12, amount: 8 },
  miner:          { name: 'Miner',           look: 'miner',       res: 'gold',  work: 14, amount: 6 },
  ironminer:      { name: 'Iron miner',      look: 'miner',       res: 'iron',  work: 14, amount: 5 },
  brewer:         { name: 'Brewer',          look: 'brewer', desc: 'turns 6 wheat into 3 sake' },
  smith:          { name: 'Blacksmith',      look: 'smith', desc: 'forges iron into blades: while the forge burns, your soldiers hit harder and last longer' },
  merchant:       { name: 'Merchant',        look: 'merchant', desc: 'runs the trading counter and brings gold' },
  child:          { name: 'Child',           look: 'child', desc: 'Too young to work. Children play around the village and grow up in two days.' },
  trainee:        { name: 'Spearman trainee', look: 'trainee' },
  trainee_archer: { name: 'Archer trainee',  look: 'trainee_archer' },
  ashigaru:       { name: 'Spearman',        look: 'ashigaru', soldier: true, desc: 'Ashigaru spearman — the backbone of your army. Defends the village against bandits.' },
  shieldman:      { name: 'Shield-bearer',   look: 'shieldman', soldier: true, desc: 'Tate-ashigaru — a sword and a heavy wooden shield that turns most arrows aside from the front. Leads the charge on a castle.' },
  samurai:        { name: 'Samurai',         look: 'samurai',   soldier: true, desc: 'A sworn warrior in lacquered armour: twice as tough as a spearman and deadly with the katana.' },
  ninja:          { name: 'Ninja',           look: 'ninja',    soldier: true, desc: 'Shinobi — hard to see and quick even when creeping. Kills any unaware guard in one blow, and can climb walls with a grappling hook.' },
  sohei:          { name: 'Warrior monk',    look: 'sohei',    soldier: true, desc: 'S\u014dhei — a temple warrior with a naginata that sweeps several foes at once. Tends the wounds of the soldiers around him.' },
  cavalry:        { name: 'Cavalry',         look: 'cavalry',  soldier: true, desc: 'Mounted samurai — the fastest troops you have. A charge after a gallop hits two and a half times as hard.' },
  archer:         { name: 'Archer',          look: 'archer',   soldier: true, desc: 'Yumi archer — climbs your watchtowers and shoots from cover.' },
  berserker:      { name: 'Berserker',       look: 'berserker', soldier: true, commander: true, desc: 'Commander. Climbs enemy walls and draws their fire. Huge damage.' },
  taisho:         { name: 'Taishō',          look: 'taisho',    soldier: true, commander: true, desc: 'Commander. His banner makes nearby troops fight harder; can rally them mid-battle.' },
};

// The rival clans. Each holds a castle as its seat and the lands around it.
export const CLANS = {
  uesugi: { name: 'Uesugi', color: '#2f5aa0', power: 20, desc: 'Proud mountain lords, famous for their cavalry.' },
  mori:   { name: 'Mōri',   color: '#3f7a3a', power: 18, desc: 'Masters of the coast and the rivers.' },
  hojo:   { name: 'Hōjō',   color: '#7a3f8a', power: 22, desc: 'Rich and patient; their castles are the strongest.' },
};

// What a Dojo can train (chosen in its panel). Better troops need a bigger Keep, more time and more gold.
export const DOJO_TRAINS = {
  ashigaru:  { time: 90,  cost: { wheat: 20, gold: 8 } },
  shieldman: { tech: 'tate', dojo: 2, time: 110, cost: { wheat: 20, wood: 25, gold: 12, iron: 6 } },
  samurai:   { tech: 'bushido', dojo: 4, time: 200, cost: { wheat: 40, gold: 45, iron: 12 } },
  ninja:     { tech: 'ninjutsu', dojo: 3, time: 150, cost: { wheat: 20, gold: 35 } },
  sohei:     { tech: 'sohei', dojo: 3, time: 160, cost: { wheat: 30, gold: 20 }, needs: 'shrine' },
  cavalry:   { tech: 'horse', dojo: 3, time: 170, cost: { wheat: 50, gold: 30, iron: 8 }, needs: 'stable' },
};

// Iron armour: a soldier fitted with it has 30% more health. These classes are fitted when they graduate
// (if you have the iron); shield-bearers, samurai, cavalry and commanders always come in armour.
export const ARMOUR = { ashigaru: 3, archer: 2, ninja: 2, sohei: 3 };
export const ARMOUR_HP = 0.3;
const ARMOUR_BUILTIN = new Set(['shieldman', 'samurai', 'cavalry', 'berserker', 'taisho']);
export const isArmoured = v => !!v && (!!v.armour || ARMOUR_BUILTIN.has(v.job));

// Difficulty (per save): how big raids and counter-attacks get, and how hard enemy soldiers are.
export const DIFFICULTY = {
  easy:   { name: 'Easy',   raid: 0.65, foe: 0.8,  desc: 'Smaller raids, weaker enemies. For building in peace.' },
  normal: { name: 'Normal', raid: 1,    foe: 1,    desc: 'The game as intended.' },
  hard:   { name: 'Hard',   raid: 1.35, foe: 1.2,  desc: 'Bigger raids and tougher enemies.' },
};

// Soldiers who survive battles and fell enemies rise in rank: each rank makes them 10% stronger.
export const RANKS = [
  { name: 'Recruit', xp: 0, stars: '' },
  { name: 'Veteran', xp: 6, stars: '\u2605' },
  { name: 'Elite', xp: 16, stars: '\u2605\u2605' },
  { name: 'Hero', xp: 35, stars: '\u2605\u2605\u2605' },
];
export const xpOf = v => (v.kills || 0) + 2 * (v.battles || 0) + (v.drill || 0);
export const rankOf = v => { const x = xpOf(v); let r = 0; RANKS.forEach((R, i) => { if (x >= R.xp) r = i; }); return r; };

// Commanders are appointed at the Keep.
export const COMMANDERS = {
  berserker: { tech: 'oni', cost: { gold: 200, wheat: 150 }, ability: 'Scale the Wall', abilityDesc: 'Climbs straight over walls to a spot you choose and draws every enemy’s fire for 10s while taking half damage.' },
  taisho:    { tech: 'taisho', cost: { gold: 320, wood: 200 }, ability: 'Rally Banner', abilityDesc: 'Nearby troops heal 30% and move and strike 40% faster for 8s.' },
};

// Battle stats (per unit). range in world units; dps = dmg / cd.
export const UNITS = {
  ashigaru:  { hp: 120, dmg: 14, cd: 1.0, range: 1.8, speed: 3.3, look: 'ashigaru', r: 0.5 },
  archer:    { hp: 70, dmg: 11, cd: 1.5, range: 21, speed: 3.3, look: 'archer', ranged: true, r: 0.45 },
  shieldman: { hp: 135, dmg: 12, cd: 1.1, range: 1.8, speed: 3.1, look: 'shieldman', r: 0.55, block: 0.65 },
  samurai:   { hp: 280, dmg: 25, cd: 1.0, range: 2.0, speed: 3.5, look: 'samurai', r: 0.55 },
  ninja:     { hp: 95, dmg: 30, cd: 0.8, range: 1.8, speed: 4.3, look: 'ninja', r: 0.45, stealth: true },
  sohei:     { hp: 210, dmg: 17, cd: 1.1, range: 2.4, speed: 3.3, look: 'sohei', r: 0.55, cleave: 1.8, heal: 7 },
  cavalry:   { hp: 230, dmg: 20, cd: 1.1, range: 2.2, speed: 6.2, look: 'cavalry', r: 0.8, charge: 2.5 },
  catapult:  { hp: 500, dmg: 170, cd: 5.5, range: 30, speed: 1.2, siege: true, ranged: true, lob: true, r: 1.3, arrowResist: 0.3 },
  enemy_cavalry: { hp: 220, dmg: 19, cd: 1.1, range: 2.2, speed: 6.0, look: 'enemy_cavalry', r: 0.8, charge: 2.2 },
  berserker: { hp: 560, dmg: 36, cd: 1.1, range: 2.2, speed: 3.9, look: 'berserker', cleave: 2.4, r: 0.6, climb: true },
  taisho:    { hp: 380, dmg: 22, cd: 1.0, range: 2.0, speed: 3.5, look: 'taisho', aura: 10, r: 0.55 },
  ram:       { hp: 800, dmg: 110, cd: 2.2, range: 2.2, speed: 1.7, siege: true, r: 1.2, arrowResist: 0.3 },
  enemy_ram: { hp: 800, dmg: 110, cd: 2.2, range: 2.2, speed: 1.7, siege: true, r: 1.2, arrowResist: 0.3 },
  // enemies
  bandit:         { hp: 85, dmg: 11, cd: 1.0, range: 1.8, speed: 3.2, look: 'bandit', r: 0.5 },
  outlaw:         { hp: 50, dmg: 7, cd: 1.1, range: 1.7, speed: 3.0, look: 'bandit', r: 0.5 },
  enemy_ashigaru: { hp: 115, dmg: 13, cd: 1.0, range: 1.8, speed: 3.1, look: 'enemy_ashigaru', r: 0.5 },
  // shield-bearers turn aside most arrows that come at them from the front
  enemy_shield:   { hp: 125, dmg: 12, cd: 1.1, range: 1.8, speed: 3.0, look: 'enemy_shield', r: 0.55, block: 0.65 },
  enemy_archer:   { hp: 65, dmg: 10, cd: 1.6, range: 20, speed: 3.1, look: 'enemy_archer', ranged: true, r: 0.45 },
  enemy_samurai:  { hp: 260, dmg: 24, cd: 1.0, range: 2.0, speed: 3.4, look: 'enemy_samurai', r: 0.55 },
  enemy_lord:     { hp: 520, dmg: 30, cd: 1.0, range: 2.0, speed: 3.4, look: 'enemy_lord', r: 0.6 },
};

// Places on the country map.
export const SITES = {
  bandits: { name: 'Bandit Camp',   tier: 1, count: 4, dist: [55, 130],  icon: 'camp',     loot: { wheat: 160, wood: 140, gold: 40 },  tribute: { wheat: 6, wood: 4 },  threat: 3 },
  village: { name: 'Rival Village', tier: 2, count: 4, dist: [95, 190],  icon: 'village2', loot: { wheat: 300, wood: 260, stone: 140, gold: 90 }, tribute: { wheat: 10, wood: 6, stone: 3 }, threat: 7 },
  fort:    { name: 'Clan Fort',     tier: 3, count: 3, dist: [150, 240], icon: 'castle',   loot: { wheat: 450, wood: 400, stone: 300, gold: 200 }, tribute: { stone: 8, gold: 5 }, threat: 12 },
  castle:  { name: 'Daimyō Castle', tier: 4, count: 2, dist: [215, 285], icon: 'castle',   loot: { wheat: 800, wood: 700, stone: 600, gold: 450 }, tribute: { wheat: 10, stone: 8, gold: 12 }, threat: 20 },
  ruins:   { name: 'Old Ruins',     tier: 0, count: 3, dist: [70, 260],  icon: 'torii',    loot: { gold: 80, stone: 60 } },
  // small and close to home: a first target for two spearmen (kept last so older maps keep their places)
  hideout: { name: 'Bandit Hideout', tier: 0.5, count: 3, dist: [32, 75], gap: 22, icon: 'camp', loot: { wheat: 90, wood: 70, gold: 30 }, tribute: { wheat: 3, wood: 2 }, threat: 1 },
  // warlords' castles (kept last so older maps keep their places): known from the start; from Keep level 4 their soldiers raid you
  warlord: { name: 'Warlord Castle', tier: 4, count: 2, dist: [115, 170], icon: 'castle', known: true, loot: { wheat: 700, wood: 600, stone: 500, gold: 400 }, tribute: { wheat: 8, stone: 6, gold: 10 }, threat: 18 },
  // a small stone castle: walls, towers, a gate and a keep, defended just as cleverly as the big ones by fewer men
  smallcastle: { name: 'Small Castle', tier: 3, count: 3, dist: [80, 145], gap: 30, icon: 'castle', loot: { wheat: 320, wood: 260, stone: 260, gold: 160 }, tribute: { wheat: 4, stone: 4, gold: 4 }, threat: 9 },
  // the Shogun's castle: the greatest fortress in the land. Take it and Tenka is yours. (Kept last so older maps keep their places.)
  shogun: { name: 'Shogun\u2019s Castle', tier: 5, count: 1, dist: [225, 262], gap: 40, icon: 'castle', known: true, loot: { wheat: 1500, wood: 1200, stone: 1200, gold: 1200 }, tribute: { wheat: 20, stone: 15, gold: 25 }, threat: 30 },
  // added in version 2 (placed after everything else, so older maps keep their places)
  temple: { name: 'Mountain Temple', tier: 0, count: 2, dist: [60, 200], gap: 30, icon: 'torii', neutral: true, late: true,
            desc: 'Monks of the old faith. Offerings lift your people\u2019s spirits, and a friend of the temple may ask for a warrior monk.' },
  town:   { name: 'Market Town', tier: 0, count: 2, dist: [90, 230], gap: 36, icon: 'village2', neutral: true, late: true,
            desc: 'A free town of merchants. Open a trade route for a steady income of gold — if the road is safe — and hire r\u014dnin here.' },
  pass:   { name: 'Mountain Pass', tier: 1, count: 2, dist: [100, 200], gap: 30, minH: 10, icon: 'camp', late: true, loot: { wheat: 90, wood: 80, gold: 70 }, tribute: { gold: 4, wood: 2 }, threat: 4,
            desc: 'Bandits hold the narrow pass and take tolls. Hold it yourself and your armies march faster everywhere.' },
};
// names for the places added in version 2 (the old list stays as it was, so old maps keep their names)
export const LATE_NAMES = ['Hakone', 'Usui', 'Kiso', 'Koya', 'Hiei', 'Sakai', 'Hakata', 'Otsu', 'Ise', 'Nara', 'Suzuka', 'Tsumago'];
export const PLACE_NAMES = ['Kiyosu', 'Nagashino', 'Okehazama', 'Inabayama', 'Kanegasaki', 'Odawara', 'Takatenjin', 'Mikatagahara', 'Anegawa', 'Sekigahara', 'Kawanakajima',
  'Itami', 'Takamatsu', 'Nanao', 'Hachigata', 'Shizugatake', 'Yamazaki', 'Toriimoto', 'Kurosawa', 'Hanamaki', 'Shirakawa', 'Aizu', 'Yoshino', 'Matsumoto'];

export const WAR = {
  scoutSpeed: 2.4,       // map units per second
  armySpeed: 1.5,
  scoutCost: { wheat: 10 },
  marchCost: 4,          // wheat per soldier per march
  scoutReveal: 26,       // fog radius around a travelling scout
  homeReveal: 60,
  garrisonMin: 2,
  holdCheckEvery: 900,   // game seconds between counter-attacks on held places
  attackWarning: 150,    // seconds between the warning and the attack on a held place
};

export const CATEGORIES = [
  { id: 'village', name: 'Village', icon: 'village' },
  { id: 'resources', name: 'Resources', icon: 'resources' },
  { id: 'military', name: 'Military', icon: 'military' },
  { id: 'defense', name: 'Defense', icon: 'defense' },
  { id: 'beauty', name: 'Harmony', icon: 'beauty' },
  { id: 'wonder', name: 'Wonders', icon: 'torii' },
];

// size = footprint in grid cells (1 cell = 2 × 2 world units), before rotation.
// th = Town Hall level needed; maxLevel = how far it can be upgraded;
// grow = bigger footprint at those levels.
export const BUILDINGS = {
  townhall:   { name: 'Tenshu Keep', kanji: '天守', cat: null, size: [4, 4], cost: {}, time: 0, unique: true, dropoff: 'all', h: 12, th: 1, maxLevel: 5,
                desc: 'The heart of your clan. Upgrading it unlocks new buildings, more homes and storage, and lets you build more of each — but bandits notice a richer village.' },
  road:       { name: 'Dirt Road', kanji: '道', cat: 'village', size: [1, 1], cost: {}, time: 0, walkable: true, line: true, road: 1.5, h: 0.2, th: 1,
                desc: 'A packed-earth path. Villagers walk 50% faster on roads and choose them when they can. Free, and laid instantly.' },
  stoneroad:  { name: 'Stone Road', kanji: '石畳', cat: 'village', size: [1, 1], cost: { stone: 4 }, time: 0, walkable: true, line: true, road: 1.9, h: 0.2, th: 2,
                desc: 'Paved with cut stone. Villagers walk 90% faster. Laid instantly.' },
  house:      { name: 'Minka House', kanji: '民家', cat: 'village', size: [2, 2], cost: { wood: 60, stone: 15 }, time: 45, housing: 4, h: 4.5, th: 1, maxLevel: 3, limit: [4, 6, 8, 10, 12],
                desc: 'A thatched family home with room for 4 villagers (+2 per upgrade).' },
  nagaya:     { name: 'Nagaya Row House', kanji: '長屋', cat: 'village', size: [3, 2], cost: { wood: 150, stone: 70, gold: 20 }, time: 90, housing: 12, housingUp: 4, h: 4.5, th: 3, maxLevel: 3, limit: [0, 0, 2, 4, 6],
                desc: 'A long tiled terrace where four families live side by side under one roof: room for 12 villagers (+4 per upgrade) on little more ground than a Minka House.' },
  yashiki:    { name: 'Samurai Manor', kanji: '屋敷', cat: null, size: [4, 2], cost: { wood: 300, stone: 180, gold: 60 }, time: 0, housing: 20, housingUp: 4, h: 5, th: 2, maxLevel: 3, merged: true,
                desc: 'Made by joining two Minka Houses at the top level. Room for 20 people (28 when fully upgraded) — more than the two houses held — and it frees two house plots.' },
  storehouse: { name: 'Kura Storehouse', kanji: '蔵', cat: 'village', size: [2, 3], cost: { wood: 90, stone: 60 }, time: 60, storage: 400, dropoff: 'all', h: 5, th: 1, maxLevel: 4, limit: [1, 2, 3, 4, 5],
                desc: 'Stores 400 more of every resource (+300 per upgrade). Workers drop off goods here too.' },
  farm:       { name: 'Wheat Field', kanji: '畑', cat: 'resources', size: [4, 4], cost: { wood: 45 }, time: 35, jobs: 2, job: 'farmer', walkable: true, h: 1.5, th: 1, maxLevel: 5, limit: [2, 3, 4, 5, 6], grow: { 3: [5, 5], 5: [6, 6] },
                desc: 'Farmers plant, tend and harvest wheat, then carry it to storage.' },
  lumber:     { name: 'Lumber Camp', kanji: '木場', cat: 'resources', size: [2, 2], cost: { wood: 30, stone: 15 }, time: 35, jobs: 2, job: 'woodcutter', dropoff: 'wood', h: 3, th: 1, maxLevel: 5, limit: [2, 2, 3, 4, 4], grow: { 3: [3, 3], 5: [4, 3] },
                desc: 'Woodcutters fell nearby trees and bring logs here. Felled trees regrow.' },
  quarry:     { name: 'Stone Quarry', kanji: '石切場', cat: 'resources', size: [3, 3], cost: { wood: 75 }, time: 45, jobs: 2, job: 'stonecutter', h: 3.5, th: 1, maxLevel: 5, limit: [1, 2, 2, 3, 4], grow: { 3: [4, 4], 5: [5, 4] },
                desc: 'Stonecutters split rock into blocks and haul them to storage.' },
  mine:       { name: 'Gold Mine', kanji: '金山', cat: 'resources', size: [3, 3], cost: { wood: 90, stone: 50 }, time: 60, jobs: 2, job: 'miner', h: 4, th: 1, maxLevel: 5, limit: [1, 1, 2, 3, 3], grow: { 3: [4, 4], 5: [5, 4] },
                desc: 'Miners go deep into the hill for gold ore. Slow but precious.' },
  infirmary:  { name: 'Healer’s House', kanji: '薬師', cat: 'military', size: [2, 2], cost: { wood: 90, stone: 40, gold: 15 }, time: 55, h: 4, th: 1, unique: true, heals: true,
                desc: 'Wounded soldiers rest here and heal four times faster. Herbs dry on racks by the door.' },
  ironmine:   { name: 'Iron Mine', kanji: '鉄山', cat: 'resources', size: [3, 3], cost: { wood: 120, stone: 80, gold: 20 }, time: 70, jobs: 2, job: 'ironminer', h: 4, th: 2, maxLevel: 4, limit: [0, 1, 1, 2, 3], grow: { 3: [4, 4] },
                desc: 'Miners dig iron ore. The blacksmith forges it, and shield-bearers and samurai need it for their gear.' },
  sakebrewery: { name: 'Sake Brewery', kanji: '酒蔵', cat: 'village', size: [3, 2], cost: { wood: 110, stone: 50 }, time: 60, jobs: 2, job: 'brewer', h: 4.5, th: 2, maxLevel: 3, limit: [0, 1, 1, 2, 2],
                desc: 'Brewers turn wheat into sake. Sake makes villagers happier, pays for festivals and sells well to merchants.' },
  blacksmith: { name: 'Blacksmith', kanji: '鍛冶屋', cat: 'military', size: [2, 2], cost: { wood: 90, stone: 90, gold: 25 }, time: 60, jobs: 2, job: 'smith', h: 4, th: 2, maxLevel: 3, unique: true,
                desc: 'While smiths work the forge (using iron), all your soldiers fight better: +8% damage and health for each level.' },
  market:     { name: 'Market', kanji: '市場', cat: 'village', size: [3, 3], cost: { wood: 140, stone: 60, gold: 30 }, time: 70, jobs: 1, job: 'merchant', h: 3.5, th: 2, maxLevel: 3, unique: true,
                desc: 'Trade goods for gold and back. Travelling merchants stop here with special offers. Better prices at higher levels.' },
  dojo:       { name: 'Dojo', kanji: '道場', cat: 'military', size: [3, 3], cost: { wood: 150, stone: 80, gold: 30 }, time: 70, jobs: 2, job: 'trainee', trains: 'ashigaru', trainTime: 90, trainCost: { wheat: 20, gold: 8 }, h: 5, th: 1, maxLevel: 4, limit: [1, 1, 2, 2, 3], grow: { 3: [4, 3] },
                desc: 'Unemployed villagers train here and graduate as Spearmen — or, once you research them, as Shield-bearers, Samurai, Ninja, Warrior monks or Cavalry.' },
  kyudojo:    { name: 'Kyūdō Range', kanji: '弓道場', cat: 'military', size: [3, 4], cost: { wood: 180, stone: 50, gold: 45 }, time: 80, jobs: 2, job: 'trainee_archer', trains: 'archer', trainTime: 110, trainCost: { wood: 25, gold: 8 }, h: 4, th: 2, maxLevel: 4, walkable: true, limit: [0, 1, 1, 2, 2], grow: { 3: [4, 4] },
                desc: 'Trainees practise the way of the bow on the shooting line and become Archers.' },
  shoin:      { name: 'Scholars\u2019 Pavilion', kanji: '書院', cat: 'village', size: [3, 3], cost: { wood: 80, stone: 30 }, time: 50, h: 6, th: 1, unique: true, maxLevel: 5,
                desc: 'Scholars copy scrolls and argue by the pond. This is where your clan does its research: Wisdom gathers here, faster and with more room at every level.' },
  strategy:   { name: 'Strategy Hall', kanji: '兵法堂', cat: 'military', size: [3, 3], cost: { wood: 160, stone: 90, gold: 50 }, time: 80, h: 5, th: 4, unique: true, maxLevel: 3,
                desc: 'The war room of your clan: your commanders learn their skills here with the command points they earn in battle. Each level opens a deeper tier of skills — and its scholars add Wisdom.' },
  // ---- Great Buildings (wonders) ----
  kinkaku:  { name: 'Kinkaku-ji', kanji: '金閣寺', cat: 'wonder', size: [4, 4], cost: { wood: 400, stone: 250, gold: 300 }, time: 150, h: 9, th: 3, unique: true, wonder: { era: 3, bonus: 'mood' },
              desc: 'The Golden Pavilion beside its mirror pond. Your people are proud and content: more mood with every level.' },
  daibutsu: { name: 'Great Buddha of Nara', kanji: '大仏', cat: 'wonder', size: [4, 4], cost: { wood: 450, stone: 400, gold: 250 }, time: 160, h: 10, th: 3, unique: true, wonder: { era: 3, bonus: 'wisdom' },
              desc: 'A bronze Buddha in a great hall. Pilgrims and scholars come: more Wisdom every minute and room to store it.' },
  itsukushima: { name: 'Itsukushima Torii', kanji: '厳島', cat: 'wonder', size: [3, 3], cost: { wood: 350, stone: 150, gold: 350 }, time: 140, h: 7, th: 3, unique: true, wonder: { era: 3, bonus: 'trade' },
              desc: 'The great vermilion gate standing in the water. Merchants and pilgrims flock in: better trade and cheaper festivals.' },
  himeji:   { name: 'White Heron Keep', kanji: '白鷺城', cat: 'wonder', size: [4, 4], cost: { wood: 400, stone: 700, gold: 250 }, time: 180, h: 12, th: 4, unique: true, wonder: { era: 4, bonus: 'walls' },
              desc: 'A shining white castle keep on a stone base, like Himeji. Your walls, gates and towers are stronger with every level.' },
  bell:     { name: 'Great Temple Bell', kanji: '大梵鐘', cat: 'wonder', size: [3, 3], cost: { wood: 300, stone: 300, gold: 250, iron: 60 }, time: 150, h: 7, th: 4, unique: true, wonder: { era: 4, bonus: 'drill' },
              desc: 'A bronze bell as tall as a house. Its call sets the rhythm of the drill yard: soldiers train faster and sentries watch sharper.' },
  inari:    { name: 'Thousand Gates of Inari', kanji: '千本鳥居', cat: 'wonder', size: [4, 3], cost: { wood: 500, stone: 200, gold: 300 }, time: 150, h: 6, th: 4, unique: true, wonder: { era: 4, bonus: 'gold' },
              desc: 'Tunnels of vermilion torii up the hillside, each one a merchant’s thanks. Gold flows in every minute.' },
  osaka:    { name: 'Osaka Castle', kanji: '大坂城', cat: 'wonder', size: [5, 5], cost: { wood: 700, stone: 900, gold: 500, iron: 120 }, time: 220, h: 14, th: 5, unique: true, wonder: { era: 5, bonus: 'army' },
              desc: 'The great black-and-gold castle of the realm’s strongest lord. Your soldiers fight harder in every battle.' },
  sanjusangendo: { name: 'Hall of a Thousand Kannon', kanji: '三十三間堂', cat: 'wonder', size: [6, 3], cost: { wood: 700, stone: 400, gold: 400 }, time: 200, h: 6, th: 5, unique: true, wonder: { era: 5, bonus: 'heal' },
              desc: 'A hall 120 metres long, a thousand golden statues of mercy inside. The wounded heal much faster.' },
  nijo:     { name: 'Nijō Palace', kanji: '二条城', cat: 'wonder', size: [5, 4], cost: { wood: 800, stone: 600, gold: 800, sake: 120 }, time: 240, h: 8, th: 5, unique: true, wonder: { era: 6, bonus: 'court' },
              desc: 'The Shogun’s palace of painted halls and singing floors. More room for your people, more tribute from the places you hold.' },
  workshop:   { name: 'Siege Workshop', kanji: '工房', cat: 'military', size: [3, 3], cost: { wood: 220, stone: 90, gold: 40 }, time: 90, h: 4, th: 3, unique: true,
                desc: 'Carpenters build battering rams here for breaking castle gates — and, with a Keep of level 4, catapults that smash walls and towers from afar.' },
  stable:     { name: 'Stables', kanji: '厩', cat: 'military', size: [3, 3], cost: { wood: 180, stone: 60, gold: 40 }, time: 80, h: 4, th: 3, unique: true,
                desc: 'Horses for your warriors. With Stables, the Dojo can train Cavalry: mounted samurai, fast, and a charge hits very hard.' },
  palisade:   { name: 'Bamboo Palisade', kanji: '竹柵', cat: 'defense', size: [1, 1], cost: { wood: 18 }, time: 8, blocks: true, line: true, h: 2.5, th: 1, hp: 400, upgradeTo: 'wall',
                desc: 'Sharpened bamboo fence — your first defense. Can be upgraded to a stone wall at Town Hall level 3.' },
  spikes:     { name: 'Spike Barricade', kanji: '逆茂木', cat: 'defense', size: [1, 1], cost: { wood: 12 }, time: 6, line: true, h: 1.6, th: 1,
                desc: 'Sharpened stakes that slow attackers and hurt them as they push through.' },
  hedge:      { name: 'Hedge', kanji: '生垣', cat: 'defense', size: [1, 1], cost: { wood: 3 }, time: 4, line: true, h: 1.4, th: 1,
                desc: 'Thick bushes. Troops hiding inside are hard to spot.' },
  gate:       { name: 'Castle Gate', kanji: '門', cat: 'defense', size: [3, 1], cost: { wood: 140, stone: 70 }, time: 45, walkable: true, h: 4.5, th: 2, hp: 1200, maxLevel: 3, limit: [0, 1, 2, 3, 4],
                desc: 'Lets your people through your walls. Bandits must break it down.' },
  tower:      { name: 'Yagura Tower', kanji: '櫓', cat: 'defense', size: [2, 2], cost: { wood: 160, stone: 100 }, time: 60, garrison: 3, h: 7, th: 2, hp: 1800, maxLevel: 3, limit: [0, 2, 3, 4, 6],
                desc: 'Your archers climb up here and shoot down at raiders. Upgrades make their arrows reach farther.' },
  wall:       { name: 'Stone Wall', kanji: '石垣', cat: 'defense', size: [1, 1], cost: { stone: 45, wood: 10 }, time: 16, blocks: true, line: true, h: 3.2, th: 3, hp: 1500, maxLevel: 3,
                desc: 'A stone base with a plastered top — very strong, and priced like it. Bandits need a long time to break through.' },
  shrine:     { name: 'Shinto Shrine', kanji: '神社', cat: 'beauty', size: [3, 3], cost: { wood: 120, stone: 60, gold: 30 }, time: 80, beauty: 8, relax: 'pray', h: 4.5, th: 3, limit: [0, 0, 1, 1, 2],
                desc: 'Villagers with free time come to pray. +8% Harmony.' },
  garden:     { name: 'Zen Garden', kanji: '枯山水', cat: 'beauty', size: [3, 3], cost: { stone: 90, wood: 15 }, time: 60, beauty: 6, relax: 'sit', h: 1.5, th: 2, limit: [0, 1, 1, 2, 2],
                desc: 'Raked sand and quiet stones. A place to rest the mind.' },
  pond:       { name: 'Koi Pond', kanji: '鯉池', cat: 'beauty', size: [3, 3], cost: { stone: 60, gold: 15 }, time: 50, beauty: 5, relax: 'sit', h: 1, th: 3, limit: [0, 0, 1, 1, 2],
                desc: 'Koi drift beneath lily pads. Villagers love to sit here.' },
  teahouse:   { name: 'Tea House', kanji: '茶屋', cat: 'beauty', size: [2, 2], cost: { wood: 75, stone: 30, gold: 15 }, time: 55, beauty: 4, relax: 'sit', h: 4, th: 2, limit: [0, 1, 1, 2, 2],
                desc: 'A quiet hut for the tea ceremony.' },
  sakura:     { name: 'Sakura Tree', kanji: '桜', cat: 'beauty', size: [1, 1], cost: { wheat: 30, wood: 10 }, time: 20, beauty: 2, h: 5, th: 1, limit: [3, 4, 6, 8, 10],
                desc: 'A cherry tree in bloom.' },
  lantern:    { name: 'Stone Lantern', kanji: '灯籠', cat: 'beauty', size: [1, 1], cost: { stone: 15 }, time: 12, beauty: 1, h: 2.5, th: 1, limit: [4, 6, 8, 10, 12],
                desc: 'Glows softly at night.' },
  torii:      { name: 'Torii Gate', kanji: '鳥居', cat: 'beauty', size: [2, 1], cost: { wood: 45, gold: 8 }, time: 25, beauty: 3, walkable: true, h: 3.8, th: 2, limit: [0, 1, 2, 3, 4],
                desc: 'Marks the way to the sacred.' },
};

// Bandits raid the village now and then; the band grows with your Town Hall.
export const RAIDS = {
  // no raids until you have your first soldier; the first band is small and weak
  firstDelay: [200, 360],  // seconds after your first soldier
  every: [1100, 1700],     // game seconds between raids
  sight: 16,               // how far a soldier on the ground spots sneaking bandits (towers and walls: 26)
  steal: 0.12,             // share of each resource a band carries off if they reach storage
  bounty: 6,               // gold per bandit defeated
};

// Skill trees, researched at the Strategy Hall. Each tree branches: a node needs every node in `req`.
// c = column (0 left, 1 middle, 2 right), r = row (top to bottom).
// ---------------------------------------------------------------------------------------------
// Eras and technologies. Your clan rises through six eras. Scholars gather Wisdom (智) over time;
// you invest it in technologies, then pay the goods to complete them. Each era's key technology
// lets the Keep grow one level further — and the last one earns the Emperor's leave to take the realm.
export const ERAS = [
  null,
  { name: 'Village of the Warring States', short: 'Village', kanji: '村' },
  { name: 'Fortified Village', short: 'Fortress', kanji: '砦' },
  { name: 'Castle Town', short: 'Castle Town', kanji: '城下町' },
  { name: 'Daimyō’s Domain', short: 'Domain', kanji: '領国' },
  { name: 'Contender for the Realm', short: 'Contender', kanji: '天下人' },
  { name: 'Shogunate', short: 'Shogunate', kanji: '幕府' },
];
// Wisdom per minute and how much can be stored; the Strategy Hall and the Great Buddha add more
// Wisdom per minute: a trickle without a Scholars' Pavilion; the pavilion (and the Strategy Hall) add more
export const WISDOM = { base: 0.25, pavilion: 0.75, perPavilion: 0.4, perHall: 0.6, cap: 8, capPavilion: 6, capPerPavilion: 6, capPerHall: 8 };
// the branches of the research tree: where each technology grows
export const TECH_LANES = [
  { id: 'key', name: 'Eras', seal: '代' }, { id: 'eco', name: 'Harvest & trade', seal: '稲' }, { id: 'scout', name: 'Scouts & marches', seal: '道' },
  { id: 'spear', name: 'Spears', seal: '槍' }, { id: 'bow', name: 'Bows', seal: '弓' }, { id: 'wall', name: 'Walls', seal: '壁' },
  { id: 'siege', name: 'Siege', seal: '攻' }, { id: 'unit', name: 'Warriors', seal: '兵' }, { id: 'cmd', name: 'Commanders', seal: '将' },
];
export const TECH_LANE = {
  keep2: 'key', keep3: 'key', keep4: 'key', keep5: 'key', mandate: 'key', realm: 'key',
  agri: 'eco', carpentry: 'eco', trade1: 'eco', granary: 'eco', survey: 'eco',
  log1: 'scout', log2: 'scout', log3: 'scout', log4: 'scout', log5: 'scout',
  spear1: 'spear', spear2: 'spear', spear4: 'spear', spear3: 'spear', spear5: 'spear', spear6: 'spear',
  arch1: 'bow', arch2: 'bow', arch3: 'bow', arch4: 'bow', arch5: 'bow', arch6: 'bow',
  def1: 'wall', def2: 'wall', def3: 'wall', def4: 'wall', def5: 'wall',
  siege1: 'siege', siege2: 'siege', siege3: 'siege', siege4: 'siege',
  tate: 'unit', ninjutsu: 'unit', sohei: 'unit', bushido: 'unit', catapults: 'unit', horse: 'unit',
  oni: 'cmd', taisho: 'cmd',
};
export const KEY_TECHS = ['keep2', 'keep3', 'keep4', 'keep5', 'mandate'];

export const TECHS = [
  // era 1: the village
  { id: 'agri', era: 1, row: 0, name: 'Crop Rotation', desc: 'Fields yield 15% more.', pts: 4, cost: { wheat: 40 }, fx: { farmBoost: 0.15 } },
  { id: 'log1', era: 1, row: 1, name: 'Swift Scouts', desc: 'Scouts travel 25% faster.', pts: 3, cost: { gold: 40, wheat: 60 }, fx: { scoutSpeed: 1 } },
  { id: 'spear1', era: 1, row: 2, name: 'Spear Drill', desc: 'Spearmen hit 15% harder.', pts: 5, cost: { gold: 60, wheat: 60 }, fx: { spearDmg: 0.15 } },
  { id: 'carpentry', era: 1, row: 3, name: 'Carpentry', desc: 'Villagers build and upgrade 15% faster.', pts: 4, cost: { wood: 60 }, fx: { buildFast: 0.15 } },
  { id: 'keep2', era: 1, row: 4, key: true, req: ['agri', 'spear1'], name: 'Clan Hall', desc: 'Opens the era of the Fortified Village: the Keep can grow to level 2.', pts: 8, cost: { wood: 120, stone: 60 }, fx: {} },
  // era 2: the fortified village
  { id: 'def1', era: 2, row: 0, req: ['keep2'], name: 'Mortar Walls', desc: 'Walls, gates and palisades are 30% stronger.', pts: 8, cost: { gold: 80, stone: 150 }, fx: { wallHp: 0.3 } },
  { id: 'arch1', era: 2, row: 1, req: ['keep2'], name: 'Longbows', desc: 'Archers shoot 20% further.', pts: 8, cost: { gold: 60, wood: 80 }, fx: { archRange: 0.2 } },
  { id: 'spear2', era: 2, row: 2, req: ['spear1', 'keep2'], name: 'Lacquered Armour', desc: 'Spearmen have 25% more health.', pts: 10, cost: { gold: 120, wood: 80 }, fx: { spearHp: 0.25 } },
  { id: 'spear4', era: 2, row: 3, req: ['spear1', 'keep2'], name: 'Veteran Ashigaru', desc: 'Spearmen move and strike 15% faster.', pts: 10, cost: { gold: 160, wheat: 150 }, fx: { spearFast: 0.15 } },
  { id: 'log2', era: 2, row: 4, req: ['log1', 'keep2'], name: 'Mountain Paths', desc: 'Armies march 25% faster.', pts: 8, cost: { gold: 100, wheat: 100 }, fx: { marchSpeed: 1 } },
  { id: 'trade1', era: 2, row: 5, req: ['keep2'], name: 'Merchant Guilds', desc: 'Better prices at the market and 15% more from trade routes.', pts: 10, cost: { gold: 60, wood: 80 }, fx: { tradeBoost: 0.15 } },
  { id: 'tate', era: 2, row: 7, req: ['keep2'], unit: true, name: 'Tate Shields', desc: 'The Dojo can train Shield-bearers: a heavy wooden shield turns most arrows aside.', pts: 10, cost: { wood: 100, gold: 40 }, fx: {} },
  { id: 'keep3', era: 2, row: 6, key: true, req: ['def1', 'arch1'], name: 'Castle Architecture', desc: 'Opens the era of the Castle Town: the Keep can grow to level 3, and the first Great Buildings can be raised.', pts: 16, cost: { wood: 300, stone: 250, gold: 80 }, fx: {} },
  // era 3: the castle town
  { id: 'arch2', era: 3, row: 0, req: ['arch1', 'keep3'], name: 'Barbed Arrows', desc: 'Arrows do 20% more damage.', pts: 14, cost: { gold: 120, wood: 120 }, fx: { archDmg: 0.2 } },
  { id: 'arch3', era: 3, row: 1, req: ['arch1', 'keep3'], name: 'Volley Fire', desc: 'Archers loose arrows 20% faster.', pts: 14, cost: { gold: 140, wood: 140 }, fx: { archFast: 0.2 } },
  { id: 'def2', era: 3, row: 2, req: ['def1', 'keep3'], name: 'Watchmen', desc: 'Your soldiers spot sneaking bandits from 50% further away.', pts: 12, cost: { gold: 120, wood: 100 }, fx: { earlyWarn: 1 } },
  { id: 'def3', era: 3, row: 3, req: ['def1', 'keep3'], name: 'Murder Holes', desc: 'Your towers drop stones on attackers at your gates.', pts: 16, cost: { gold: 220, stone: 220 }, fx: { murder: 1 } },
  { id: 'spear3', era: 3, row: 4, req: ['spear2', 'keep3'], name: 'Spear Wall', desc: 'Holding spearmen take 30% less damage.', pts: 16, cost: { gold: 200, stone: 120 }, fx: { spearWall: 0.3 } },
  { id: 'spear5', era: 3, row: 5, req: ['spear4', 'keep3'], name: 'Dojo Masters', desc: 'Trainees at the Dojo and Kyūdō Range learn 30% faster.', pts: 14, cost: { gold: 180, wood: 120 }, fx: { trainFast: 0.3 } },
  { id: 'siege1', era: 3, row: 6, req: ['keep3'], name: 'Hide Roof', desc: 'Rams have 50% more health and shrug off dropped stones.', pts: 12, cost: { gold: 100, wood: 150 }, fx: { ramHp: 0.5 } },
  { id: 'log3', era: 3, row: 7, req: ['log2', 'keep3'], name: 'Spy Network', desc: 'Scouts see much further around them.', pts: 12, cost: { gold: 140, wheat: 120 }, fx: { scoutSight: 1 } },
  { id: 'ninjutsu', era: 3, row: 9, req: ['keep3'], unit: true, name: 'Ninjutsu', desc: 'The Dojo can train Ninja: hard to see, deadly from behind, climbing walls with a hook.', pts: 16, cost: { gold: 120, wheat: 80 }, fx: {} },
  { id: 'sohei', era: 3, row: 10, req: ['keep3'], unit: true, name: 'Warrior Monks', desc: 'The Dojo can train Warrior monks (with a Shrine in the village): sweeping naginata, healing hands.', pts: 14, cost: { gold: 100, wheat: 100 }, fx: {} },
  { id: 'horse', era: 3, row: 11, req: ['keep3'], unit: true, name: 'Horse Breeding', desc: 'The Dojo can train Cavalry (with Stables in the village): fast, and a charge hits very hard.', pts: 16, cost: { wheat: 150, gold: 80 }, fx: {} },
  { id: 'keep4', era: 3, row: 8, key: true, req: ['arch2', 'def2', 'spear3'], name: 'Seat of a Daimyō', desc: 'Opens the era of the Daimyō’s Domain: the Keep can grow to level 4.', pts: 26, cost: { wood: 500, stone: 500, gold: 200 }, fx: {} },
  // era 4: the domain
  { id: 'arch4', era: 4, row: 0, req: ['arch3', 'keep4'], name: 'Hawk Eyes', desc: 'Archers spot hidden enemies from further away; towers shoot 4 further.', pts: 22, cost: { gold: 220, wheat: 150 }, fx: { archEyes: 1 } },
  { id: 'arch5', era: 4, row: 1, req: ['arch2', 'keep4'], name: 'Bodkin Points', desc: 'Arrows punch through armour: another 15% damage.', pts: 22, cost: { gold: 200, stone: 100 }, fx: { archDmg: 0.15 } },
  { id: 'def4', era: 4, row: 2, req: ['def2', 'keep4'], name: 'Bounty Hunters', desc: 'Double gold for every raider your people defeat.', pts: 20, cost: { gold: 160, wheat: 150 }, fx: { bounty: 1 } },
  { id: 'def5', era: 4, row: 3, req: ['def3', 'keep4'], name: 'Stone Keep', desc: 'Walls, gates and palisades another 30% stronger.', pts: 24, cost: { gold: 260, stone: 300 }, fx: { wallHp: 0.3 } },
  { id: 'siege2', era: 4, row: 5, req: ['siege1', 'keep4'], name: 'Iron-Capped Ram', desc: 'Rams hit gates and walls 40% harder.', pts: 22, cost: { gold: 200, stone: 150 }, fx: { ramDmg: 0.4 } },
  { id: 'siege3', era: 4, row: 6, req: ['siege1', 'keep4'], name: 'Carpenters’ Guild', desc: 'Rams and catapults are built 40% faster.', pts: 20, cost: { gold: 150, wood: 200 }, fx: { ramBuild: 0.4 } },
  { id: 'log4', era: 4, row: 7, req: ['log3', 'keep4'], name: 'Supply Lines', desc: 'Marches cost half the wheat.', pts: 22, cost: { gold: 260, wheat: 200 }, fx: { supply: 1 } },
  { id: 'bushido', era: 4, row: 9, req: ['tate', 'keep4'], unit: true, name: 'Bushid\u014d', desc: 'The Dojo can train Samurai: sworn warriors in lacquered armour, twice as tough as a spearman.', pts: 22, cost: { gold: 200, iron: 30 }, fx: {} },
  { id: 'oni', era: 4, row: 10, req: ['keep4'], unit: true, name: 'Oni Captains', desc: 'You can appoint a Berserker commander at the Keep: he climbs walls and draws the enemy\u2019s fire.', pts: 24, cost: { gold: 200, wheat: 150 }, fx: {} },
  { id: 'catapults', era: 4, row: 11, req: ['siege1', 'keep4'], unit: true, name: 'Siege Engines', desc: 'The Siege Workshop can build catapults that smash walls and towers from afar.', pts: 24, cost: { wood: 300, gold: 150 }, fx: {} },
  { id: 'keep5', era: 4, row: 8, key: true, req: ['def5', 'siege2', 'bushido'], name: 'The Great Keep', desc: 'Opens the era of the Contender: the Keep can grow to level 5.', pts: 36, cost: { wood: 800, stone: 900, gold: 400 }, fx: {} },
  // era 5: contender for the realm
  { id: 'spear6', era: 5, row: 0, req: ['spear3', 'spear5', 'keep5'], name: 'Way of the Yari', desc: 'Spearmen hit another 20% harder.', pts: 32, cost: { gold: 380, wheat: 250 }, fx: { spearDmg: 0.2 } },
  { id: 'arch6', era: 5, row: 1, req: ['arch4', 'arch5', 'keep5'], name: 'Master of the Bow', desc: 'Archers shoot 15% further and 10% faster.', pts: 32, cost: { gold: 380, wood: 250 }, fx: { archRange: 0.15, archFast: 0.1 } },
  { id: 'siege4', era: 5, row: 4, req: ['siege2', 'siege3', 'keep5'], name: 'Swinging Crew', desc: 'Rams hit another 30% harder.', pts: 32, cost: { gold: 320, stone: 200 }, fx: { ramDmg: 0.3 } },
  { id: 'log5', era: 5, row: 5, req: ['log4', 'keep5'], name: 'Mountain Guides', desc: 'Scouts travel another 25% faster.', pts: 28, cost: { gold: 200, wheat: 150 }, fx: { scoutSpeed: 1 } },
  { id: 'granary', era: 5, row: 6, req: ['keep5'], name: 'Rice Tax Registers', desc: 'Your storehouses and Keep hold 25% more.', pts: 30, cost: { gold: 300, wood: 300 }, fx: { storageBoost: 0.25 } },
  { id: 'taisho', era: 5, row: 8, req: ['oni', 'keep5'], unit: true, name: 'The Taish\u014d', desc: 'You can appoint a Taish\u014d commander at the Keep: his banner makes nearby troops fight harder.', pts: 30, cost: { gold: 320, wood: 200 }, fx: {} },
  { id: 'mandate', era: 5, row: 7, key: true, req: ['spear6', 'arch6', 'taisho'], name: 'Imperial Mandate', desc: 'Opens the Shogunate era: the last Great Buildings — and the Emperor’s leave to march on the Shogun’s castle and rule the realm.', pts: 48, cost: { gold: 1000, sake: 100, iron: 100 }, fx: {} },
  // era 6: the shogunate
  { id: 'survey', era: 6, row: 3, req: ['mandate'], name: 'Taikō’s Land Survey', desc: 'All fields, camps, quarries and mines yield 20% more.', pts: 55, cost: { gold: 500, stone: 300 }, fx: { prodBoost: 0.2, farmBoost: 0.2 } },
  { id: 'realm', era: 6, row: 4, req: ['survey'], name: 'Rule of the Realm', desc: 'Peace under one banner: +15 mood in your village, and every clan thinks better of you.', pts: 70, cost: { gold: 800, sake: 150 }, fx: { realm: 1 } },
];

// Great Buildings: unique wonders. Gather 5 blueprints (from raids you beat off, battles you win,
// temples and tasks), build it, then invest Wisdom to raise it up to level 10.
export const WONDER_BP = 5;
export const WONDER_MAX = 10;
export const wonderLevelCost = L => 10 + 8 * L;   // Wisdom to go from level L to L+1

// Commanders' skill trees, learned at the Strategy Hall with command points. Commanders earn points by
// fighting (every battle they survive, every 5 enemies they fell); war games at the Hall buy more.
// Tier II and III need a Strategy Hall of level 2 and 3.
export const COMMAND_TREES = {
  berserker: { name: 'Berserker', look: 'berserker', nodes: [
    { id: 'b_hide', tier: 1, col: 0, name: 'Iron Hide', desc: 'The Berserker has 30% more health.', fx: { hp: 0.3 } },
    { id: 'b_str', tier: 1, col: 1, name: 'Oni Strength', desc: 'He hits 25% harder.', fx: { dmg: 0.25 } },
    { id: 'b_climb', tier: 2, col: 0, req: 'b_hide', name: 'Quick Climb', desc: 'Scale the Wall recharges 35% faster.', fx: { cd: 0.35 } },
    { id: 'b_cleave', tier: 2, col: 1, req: 'b_str', name: 'Great Cleave', desc: 'His swings reach 50% wider, and everyone caught takes full damage.', fx: { cleave: 1 } },
    { id: 'b_blood', tier: 3, col: 0, req: 'b_climb', name: 'Bloodlust', desc: 'He heals with every enemy he fells.', fx: { bloodlust: 1 } },
    { id: 'b_unstop', tier: 3, col: 1, req: 'b_cleave', name: 'Unstoppable', desc: 'Scale the Wall lasts twice as long, and meanwhile he takes only a quarter of the damage.', fx: { unstop: 1 } },
  ] },
  taisho: { name: 'Taish\u014d', look: 'taisho', nodes: [
    { id: 't_council', tier: 1, col: 0, name: 'War Council', desc: 'The Taish\u014d has 30% more health.', fx: { hp: 0.3 } },
    { id: 't_wide', tier: 1, col: 1, name: 'Tall Banner', desc: 'His banner and his rally reach 50% further.', fx: { aura: 0.5 } },
    { id: 't_orders', tier: 2, col: 0, req: 't_council', name: 'Swift Orders', desc: 'Rally Banner recharges 35% faster.', fx: { cd: 0.35 } },
    { id: 't_courage', tier: 2, col: 1, req: 't_wide', name: 'Banner of Courage', desc: 'His aura and his rally are twice as strong.', fx: { banner: 1 } },
    { id: 't_legend', tier: 3, col: 0, req: 't_orders', name: 'Living Legend', desc: 'While he lives, every one of your soldiers in the battle strikes 10% harder.', fx: { legend: 1 } },
    { id: 't_iron', tier: 3, col: 1, req: 't_courage', name: 'Iron Discipline', desc: 'Troops under his banner take 20% less damage.', fx: { discipline: 1 } },
  ] },
};
export const cmdNodeCost = tier => tier;                  // command points
export const warGamesCost = n => ({ gold: 150 + 100 * n, wheat: 100 + 50 * n });
