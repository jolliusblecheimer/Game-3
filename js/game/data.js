// Game data: every number that shapes the economy lives here.
// The pace is deliberately slow: this is meant to be a calm game.

export const RES = {
  wheat: { name: 'Wheat', icon: 'wheat' },
  wood: { name: 'Wood', icon: 'wood' },
  stone: { name: 'Stone', icon: 'stone' },
  gold: { name: 'Gold', icon: 'gold' },
};

export const START = {
  res: { wheat: 300, wood: 260, stone: 140, gold: 40 },
  villagers: 10,
};

export const ECON = {
  walkSpeed: 3.0,            // world units per second
  arriveEvery: 300,          // a new family is rare: at most one every 5 minutes…
  arriveChance: 0.6,         // …and only if they decide to come
  arriveCost: { wheat: 40 },
  eatEvery: 70,              // each villager eats 1 wheat this often
  hungryWork: 0.5,           // work speed when out of wheat
  dayLength: 720,            // seconds for a full day–night cycle at 1×
  refund: 0.5,               // share of cost returned when demolishing
  offlineCapHours: 4,
  offlineEfficiency: 0.6,    // share of normal output earned while away
  treeRegrow: 300,           // seconds for a felled tree to regrow
  treeChops: 3,              // trips a tree supports before it falls
  clearTime: 6,              // seconds for a builder to clear one tree or boulder
  autoBuild: false,          // idle villagers help build only if you allow it (menu)
};

// Town Hall levels: everything else grows from here.
export const TOWNHALL = [
  null,
  { housing: 8,  storage: 500,  builders: 2, raid: 3 },
  { housing: 10, storage: 800,  builders: 3, raid: 5, cost: { wood: 320, stone: 200, gold: 40 },  time: 150, needPop: 12 },
  { housing: 12, storage: 1200, builders: 4, raid: 8, cost: { wood: 650, stone: 520, gold: 150 }, time: 240, needPop: 18 },
  { housing: 14, storage: 1800, builders: 5, raid: 12, cost: { wood: 1000, stone: 900, gold: 380 }, time: 330, needPop: 25 },
  { housing: 16, storage: 2600, builders: 6, raid: 16, cost: { wood: 1600, stone: 1500, gold: 750 }, time: 420, needPop: 33 },
];
export const MAX_TH = 5;

// Jobs. `work` = seconds of work per trip, `amount` = goods carried back.
export const JOBS = {
  idle:           { name: 'Villager',        look: 'villager', desc: 'Unemployed. Give them a job at a workplace, or make them a builder at the Keep.' },
  builder:        { name: 'Builder',         look: 'builder', desc: 'Builds, upgrades and repairs, and clears trees and rocks you mark.' },
  farmer:         { name: 'Farmer',          look: 'farmer',      res: 'wheat', work: 12, amount: 6 },
  woodcutter:     { name: 'Woodcutter',      look: 'woodcutter',  res: 'wood',  work: 10, amount: 5 },
  stonecutter:    { name: 'Stonecutter',     look: 'stonecutter', res: 'stone', work: 13, amount: 4 },
  miner:          { name: 'Miner',           look: 'miner',       res: 'gold',  work: 16, amount: 3 },
  trainee:        { name: 'Spearman trainee', look: 'trainee' },
  trainee_archer: { name: 'Archer trainee',  look: 'trainee_archer' },
  ashigaru:       { name: 'Spearman',        look: 'ashigaru', soldier: true, desc: 'Ashigaru spearman — the backbone of your army. Defends the village against bandits.' },
  archer:         { name: 'Archer',          look: 'archer',   soldier: true, desc: 'Yumi archer — climbs your watchtowers and shoots from cover.' },
  berserker:      { name: 'Berserker',       look: 'berserker', soldier: true, commander: true, desc: 'Commander. Climbs enemy walls and draws their fire. Huge damage.' },
  taisho:         { name: 'Taishō',          look: 'taisho',    soldier: true, commander: true, desc: 'Commander. His banner makes nearby troops fight harder; can rally them mid-battle.' },
};

// Commanders are appointed at the Keep.
export const COMMANDERS = {
  berserker: { th: 4, cost: { gold: 200, wheat: 150 }, ability: 'Scale the Wall', abilityDesc: 'Climbs straight over walls to a spot you choose and draws every enemy’s fire for 10s while taking half damage.' },
  taisho:    { th: 5, cost: { gold: 320, wood: 200 }, ability: 'Rally Banner', abilityDesc: 'Nearby troops heal 30% and move and strike 40% faster for 8s.' },
};

// Battle stats (per unit). range in world units; dps = dmg / cd.
export const UNITS = {
  ashigaru:  { hp: 120, dmg: 14, cd: 1.0, range: 1.8, speed: 3.3, look: 'ashigaru', r: 0.5 },
  archer:    { hp: 70, dmg: 11, cd: 1.5, range: 21, speed: 3.3, look: 'archer', ranged: true, r: 0.45 },
  berserker: { hp: 560, dmg: 36, cd: 1.1, range: 2.2, speed: 3.9, look: 'berserker', cleave: 2.4, r: 0.6, climb: true },
  taisho:    { hp: 380, dmg: 22, cd: 1.0, range: 2.0, speed: 3.5, look: 'taisho', aura: 10, r: 0.55 },
  ram:       { hp: 800, dmg: 110, cd: 2.2, range: 2.2, speed: 1.7, siege: true, r: 1.2, arrowResist: 0.3 },
  // enemies
  bandit:         { hp: 85, dmg: 11, cd: 1.0, range: 1.8, speed: 3.2, look: 'bandit', r: 0.5 },
  enemy_ashigaru: { hp: 115, dmg: 13, cd: 1.0, range: 1.8, speed: 3.1, look: 'enemy_ashigaru', r: 0.5 },
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
};
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
  holdCheckEvery: 600,   // game seconds between counter-attack checks on held places
};

export const CATEGORIES = [
  { id: 'village', name: 'Village', icon: 'village' },
  { id: 'resources', name: 'Resources', icon: 'resources' },
  { id: 'military', name: 'Military', icon: 'military' },
  { id: 'defense', name: 'Defense', icon: 'defense' },
  { id: 'beauty', name: 'Harmony', icon: 'beauty' },
];

// size = footprint in grid cells (1 cell = 2 × 2 world units), before rotation.
// th = Town Hall level needed; maxLevel = how far it can be upgraded;
// grow = bigger footprint at those levels.
export const BUILDINGS = {
  townhall:   { name: 'Tenshu Keep', kanji: '天守', cat: null, size: [4, 4], cost: {}, time: 0, unique: true, dropoff: 'all', h: 12, th: 1, maxLevel: 5, job: 'builder',
                desc: 'The heart of your clan. Upgrading it unlocks new buildings, more homes, storage and builders — but bandits notice a richer village.' },
  road:       { name: 'Dirt Road', kanji: '道', cat: 'village', size: [1, 1], cost: {}, time: 0, walkable: true, line: true, road: 1.5, h: 0.2, th: 1,
                desc: 'A packed-earth path. Villagers walk 50% faster on roads and choose them when they can. Free, and laid instantly.' },
  stoneroad:  { name: 'Stone Road', kanji: '石畳', cat: 'village', size: [1, 1], cost: { stone: 4 }, time: 0, walkable: true, line: true, road: 1.9, h: 0.2, th: 2,
                desc: 'Paved with cut stone. Villagers walk 90% faster. Laid instantly.' },
  house:      { name: 'Minka House', kanji: '民家', cat: 'village', size: [2, 2], cost: { wood: 60, stone: 15 }, time: 45, housing: 4, h: 4.5, th: 1, maxLevel: 3,
                desc: 'A thatched family home with room for 4 villagers (+2 per upgrade).' },
  storehouse: { name: 'Kura Storehouse', kanji: '蔵', cat: 'village', size: [2, 3], cost: { wood: 90, stone: 60 }, time: 60, storage: 400, dropoff: 'all', h: 5, th: 1, maxLevel: 4,
                desc: 'Stores 400 more of every resource (+300 per upgrade). Workers drop off goods here too.' },
  farm:       { name: 'Wheat Field', kanji: '畑', cat: 'resources', size: [4, 4], cost: { wood: 45 }, time: 35, jobs: 2, job: 'farmer', walkable: true, h: 1.5, th: 1, maxLevel: 5, grow: { 3: [5, 5], 5: [6, 6] },
                desc: 'Farmers plant, tend and harvest wheat, then carry it to storage.' },
  lumber:     { name: 'Lumber Camp', kanji: '木場', cat: 'resources', size: [2, 2], cost: { wood: 30, stone: 15 }, time: 35, jobs: 2, job: 'woodcutter', dropoff: 'wood', h: 3, th: 1, maxLevel: 5, grow: { 3: [3, 3], 5: [4, 3] },
                desc: 'Woodcutters fell nearby trees and bring logs here. Felled trees regrow.' },
  quarry:     { name: 'Stone Quarry', kanji: '石切場', cat: 'resources', size: [3, 3], cost: { wood: 75 }, time: 45, jobs: 2, job: 'stonecutter', h: 3.5, th: 1, maxLevel: 5, grow: { 3: [4, 4], 5: [5, 4] },
                desc: 'Stonecutters split rock into blocks and haul them to storage.' },
  mine:       { name: 'Gold Mine', kanji: '金山', cat: 'resources', size: [3, 3], cost: { wood: 120, stone: 80 }, time: 70, jobs: 2, job: 'miner', h: 4, th: 2, maxLevel: 5, grow: { 3: [4, 4], 5: [5, 4] },
                desc: 'Miners go deep into the hill for gold ore. Slow but precious.' },
  dojo:       { name: 'Dojo', kanji: '道場', cat: 'military', size: [3, 3], cost: { wood: 150, stone: 80, gold: 30 }, time: 70, jobs: 2, job: 'trainee', trains: 'ashigaru', trainTime: 90, trainCost: { wheat: 20, gold: 8 }, h: 5, th: 2, maxLevel: 4, grow: { 3: [4, 3] },
                desc: 'Unemployed villagers train here and graduate as Spearmen.' },
  kyudojo:    { name: 'Kyūdō Range', kanji: '弓道場', cat: 'military', size: [3, 4], cost: { wood: 180, stone: 50, gold: 45 }, time: 80, jobs: 2, job: 'trainee_archer', trains: 'archer', trainTime: 110, trainCost: { wood: 25, gold: 8 }, h: 4, th: 3, maxLevel: 4, walkable: true, grow: { 3: [4, 4] },
                desc: 'Trainees practise the way of the bow on the shooting line and become Archers.' },
  workshop:   { name: 'Siege Workshop', kanji: '工房', cat: 'military', size: [3, 3], cost: { wood: 220, stone: 90, gold: 40 }, time: 90, h: 4, th: 3,
                desc: 'Carpenters build battering rams here for breaking castle gates.' },
  palisade:   { name: 'Bamboo Palisade', kanji: '竹柵', cat: 'defense', size: [1, 1], cost: { wood: 18 }, time: 8, blocks: true, line: true, h: 2.5, th: 1, hp: 400, upgradeTo: 'wall',
                desc: 'Sharpened bamboo fence — your first defense. Can be upgraded to a stone wall at Town Hall level 3.' },
  spikes:     { name: 'Spike Barricade', kanji: '逆茂木', cat: 'defense', size: [1, 1], cost: { wood: 12 }, time: 6, line: true, h: 1.6, th: 1,
                desc: 'Sharpened stakes that slow attackers and hurt them as they push through.' },
  hedge:      { name: 'Hedge', kanji: '生垣', cat: 'defense', size: [1, 1], cost: { wood: 3 }, time: 4, line: true, beauty: 0.3, h: 1.4, th: 1,
                desc: 'Thick bushes. Troops hiding inside are hard to spot.' },
  gate:       { name: 'Castle Gate', kanji: '門', cat: 'defense', size: [2, 1], cost: { wood: 140, stone: 70 }, time: 45, walkable: true, h: 4.5, th: 2, hp: 1200, maxLevel: 3,
                desc: 'Lets your people through your walls. Bandits must break it down.' },
  tower:      { name: 'Yagura Tower', kanji: '櫓', cat: 'defense', size: [2, 2], cost: { wood: 160, stone: 100 }, time: 60, garrison: 3, h: 7, th: 2, maxLevel: 3,
                desc: 'Your archers climb up here and shoot down at raiders. Upgrades make their arrows reach farther.' },
  wall:       { name: 'Stone Wall', kanji: '石垣', cat: 'defense', size: [1, 1], cost: { stone: 45, wood: 10 }, time: 16, blocks: true, line: true, h: 3.2, th: 3, hp: 1500, maxLevel: 3,
                desc: 'A stone base with a plastered top — very strong, and priced like it. Bandits need a long time to break through.' },
  shrine:     { name: 'Shinto Shrine', kanji: '神社', cat: 'beauty', size: [3, 3], cost: { wood: 120, stone: 60, gold: 30 }, time: 80, beauty: 8, relax: 'pray', h: 4.5, th: 3,
                desc: 'Villagers with free time come to pray. Raises Harmony a lot.' },
  garden:     { name: 'Zen Garden', kanji: '枯山水', cat: 'beauty', size: [3, 3], cost: { stone: 90, wood: 15 }, time: 60, beauty: 6, relax: 'sit', h: 1.5, th: 2,
                desc: 'Raked sand and quiet stones. A place to rest the mind.' },
  pond:       { name: 'Koi Pond', kanji: '鯉池', cat: 'beauty', size: [3, 3], cost: { stone: 60, gold: 15 }, time: 50, beauty: 5, relax: 'sit', h: 1, th: 3,
                desc: 'Koi drift beneath lily pads. Villagers love to sit here.' },
  teahouse:   { name: 'Tea House', kanji: '茶屋', cat: 'beauty', size: [2, 2], cost: { wood: 75, stone: 30, gold: 15 }, time: 55, beauty: 4, relax: 'sit', h: 4, th: 2,
                desc: 'A quiet hut for the tea ceremony.' },
  sakura:     { name: 'Sakura Tree', kanji: '桜', cat: 'beauty', size: [1, 1], cost: { wheat: 30, wood: 10 }, time: 20, beauty: 2, h: 5, th: 1,
                desc: 'A cherry tree in bloom.' },
  lantern:    { name: 'Stone Lantern', kanji: '灯籠', cat: 'beauty', size: [1, 1], cost: { stone: 15 }, time: 12, beauty: 1, h: 2.5, th: 1,
                desc: 'Glows softly at night.' },
  torii:      { name: 'Torii Gate', kanji: '鳥居', cat: 'beauty', size: [2, 1], cost: { wood: 45, gold: 8 }, time: 25, beauty: 3, walkable: true, h: 3.8, th: 2,
                desc: 'Marks the way to the sacred.' },
};

// Bandits raid the village now and then; the band grows with your Town Hall.
export const RAIDS = {
  firstAfter: 2.5 * 720,   // no raids in the first days
  every: [1100, 1700],     // game seconds between raids
  warning: 60,             // seconds of warning before they arrive
  steal: 0.12,             // share of each resource a band carries off if they reach storage
  bounty: 6,               // gold per bandit defeated
};
