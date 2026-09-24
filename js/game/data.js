// Game data: every number that shapes the economy lives here.
// The pace is deliberately slow: this is meant to be a calm game.

export const RES = {
  wheat: { name: 'Wheat', icon: 'wheat' },
  wood: { name: 'Wood', icon: 'wood' },
  stone: { name: 'Stone', icon: 'stone' },
  gold: { name: 'Gold', icon: 'gold' },
};

export const START = {
  res: { wheat: 300, wood: 260, stone: 140, gold: 60 },
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
  { housing: 8,  storage: 500,  raid: 2 },
  { housing: 10, storage: 800,  raid: 4, cost: { wood: 240, stone: 140, gold: 30 },  time: 150, needPop: 12 },
  { housing: 12, storage: 1200, raid: 6, cost: { wood: 520, stone: 400, gold: 120 }, time: 240, needPop: 16 },
  { housing: 14, storage: 1800, raid: 9, cost: { wood: 850, stone: 750, gold: 300 }, time: 330, needPop: 21 },
  { housing: 16, storage: 2600, raid: 13, cost: { wood: 1300, stone: 1200, gold: 600 }, time: 420, needPop: 26 },
];
export const MAX_TH = 5;

// Jobs. `work` = seconds of work per trip, `amount` = goods carried back.
export const JOBS = {
  idle:           { name: 'Villager',        look: 'villager', desc: 'Unemployed. Free villagers build, upgrade, repair and clear land on their own — or give them a job at a workplace.' },
  farmer:         { name: 'Farmer',          look: 'farmer',      res: 'wheat', work: 12, amount: 8 },
  woodcutter:     { name: 'Woodcutter',      look: 'woodcutter',  res: 'wood',  work: 10, amount: 7 },
  stonecutter:    { name: 'Stonecutter',     look: 'stonecutter', res: 'stone', work: 13, amount: 6 },
  miner:          { name: 'Miner',           look: 'miner',       res: 'gold',  work: 16, amount: 4 },
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
  holdCheckEvery: 900,   // game seconds between counter-attacks on held places
  attackWarning: 150,    // seconds between the warning and the attack on a held place
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
  townhall:   { name: 'Tenshu Keep', kanji: '天守', cat: null, size: [4, 4], cost: {}, time: 0, unique: true, dropoff: 'all', h: 12, th: 1, maxLevel: 5,
                desc: 'The heart of your clan. Upgrading it unlocks new buildings, more homes and storage, and lets you build more of each — but bandits notice a richer village.' },
  road:       { name: 'Dirt Road', kanji: '道', cat: 'village', size: [1, 1], cost: {}, time: 0, walkable: true, line: true, road: 1.5, h: 0.2, th: 1,
                desc: 'A packed-earth path. Villagers walk 50% faster on roads and choose them when they can. Free, and laid instantly.' },
  stoneroad:  { name: 'Stone Road', kanji: '石畳', cat: 'village', size: [1, 1], cost: { stone: 4 }, time: 0, walkable: true, line: true, road: 1.9, h: 0.2, th: 2,
                desc: 'Paved with cut stone. Villagers walk 90% faster. Laid instantly.' },
  house:      { name: 'Minka House', kanji: '民家', cat: 'village', size: [2, 2], cost: { wood: 60, stone: 15 }, time: 45, housing: 4, h: 4.5, th: 1, maxLevel: 3, limit: [4, 6, 8, 10, 12],
                desc: 'A thatched family home with room for 4 villagers (+2 per upgrade).' },
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
  dojo:       { name: 'Dojo', kanji: '道場', cat: 'military', size: [3, 3], cost: { wood: 150, stone: 80, gold: 30 }, time: 70, jobs: 2, job: 'trainee', trains: 'ashigaru', trainTime: 90, trainCost: { wheat: 20, gold: 8 }, h: 5, th: 1, maxLevel: 4, limit: [1, 1, 2, 2, 3], grow: { 3: [4, 3] },
                desc: 'Unemployed villagers train here and graduate as Spearmen.' },
  kyudojo:    { name: 'Kyūdō Range', kanji: '弓道場', cat: 'military', size: [3, 4], cost: { wood: 180, stone: 50, gold: 45 }, time: 80, jobs: 2, job: 'trainee_archer', trains: 'archer', trainTime: 110, trainCost: { wood: 25, gold: 8 }, h: 4, th: 2, maxLevel: 4, walkable: true, limit: [0, 1, 1, 2, 2], grow: { 3: [4, 4] },
                desc: 'Trainees practise the way of the bow on the shooting line and become Archers.' },
  strategy:   { name: 'Strategy Hall', kanji: '兵法堂', cat: 'military', size: [3, 3], cost: { wood: 160, stone: 90, gold: 50 }, time: 80, h: 5, th: 2, unique: true,
                desc: 'Scholars of war study here. Research skill trees for every kind of soldier, your scouts, your sieges and your defenses.' },
  workshop:   { name: 'Siege Workshop', kanji: '工房', cat: 'military', size: [3, 3], cost: { wood: 220, stone: 90, gold: 40 }, time: 90, h: 4, th: 3, unique: true,
                desc: 'Carpenters build battering rams here for breaking castle gates.' },
  palisade:   { name: 'Bamboo Palisade', kanji: '竹柵', cat: 'defense', size: [1, 1], cost: { wood: 18 }, time: 8, blocks: true, line: true, h: 2.5, th: 1, hp: 400, upgradeTo: 'wall',
                desc: 'Sharpened bamboo fence — your first defense. Can be upgraded to a stone wall at Town Hall level 3.' },
  spikes:     { name: 'Spike Barricade', kanji: '逆茂木', cat: 'defense', size: [1, 1], cost: { wood: 12 }, time: 6, line: true, h: 1.6, th: 1,
                desc: 'Sharpened stakes that slow attackers and hurt them as they push through.' },
  hedge:      { name: 'Hedge', kanji: '生垣', cat: 'defense', size: [1, 1], cost: { wood: 3 }, time: 4, line: true, beauty: 0.3, h: 1.4, th: 1,
                desc: 'Thick bushes. Troops hiding inside are hard to spot.' },
  gate:       { name: 'Castle Gate', kanji: '門', cat: 'defense', size: [2, 1], cost: { wood: 140, stone: 70 }, time: 45, walkable: true, h: 4.5, th: 2, hp: 1200, maxLevel: 3, limit: [0, 1, 2, 3, 4],
                desc: 'Lets your people through your walls. Bandits must break it down.' },
  tower:      { name: 'Yagura Tower', kanji: '櫓', cat: 'defense', size: [2, 2], cost: { wood: 160, stone: 100 }, time: 60, garrison: 3, h: 7, th: 2, maxLevel: 3, limit: [0, 2, 3, 4, 6],
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
  // no raids until you have your first soldier; the first band is small and weak
  firstDelay: [200, 360],  // seconds after your first soldier
  every: [1100, 1700],     // game seconds between raids
  sight: 16,               // how far a soldier on the ground spots sneaking bandits (towers and walls: 26)
  steal: 0.12,             // share of each resource a band carries off if they reach storage
  bounty: 6,               // gold per bandit defeated
};

// Skill trees, researched at the Strategy Hall. Each tree branches: a node needs every node in `req`.
// c = column (0 left, 1 middle, 2 right), r = row (top to bottom).
export const RESEARCH = {
  spear: { name: 'Spearmen', look: 'ashigaru', nodes: [
    { id: 'spear1', c: 1, r: 0, name: 'Spear Drill', desc: 'Spearmen hit 15% harder.', cost: { gold: 60, wheat: 60 }, time: 120, fx: { spearDmg: 0.15 } },
    { id: 'spear2', c: 0, r: 1, req: ['spear1'], name: 'Lacquered Armour', desc: 'Spearmen have 25% more health.', cost: { gold: 120, wood: 80 }, time: 180, fx: { spearHp: 0.25 } },
    { id: 'spear3', c: 0, r: 2, req: ['spear2'], name: 'Spear Wall', desc: 'Holding spearmen take 30% less damage.', cost: { gold: 200, stone: 120 }, time: 240, fx: { spearWall: 0.3 } },
    { id: 'spear4', c: 2, r: 1, req: ['spear1'], name: 'Veteran Ashigaru', desc: 'Spearmen move and strike 15% faster.', cost: { gold: 160, wheat: 150 }, time: 200, fx: { spearFast: 0.15 } },
    { id: 'spear5', c: 2, r: 2, req: ['spear4'], name: 'Dojo Masters', desc: 'Trainees at the Dojo and Kyūdō Range learn 30% faster.', cost: { gold: 180, wood: 120 }, time: 220, fx: { trainFast: 0.3 } },
    { id: 'spear6', c: 1, r: 3, req: ['spear3', 'spear5'], name: 'Way of the Yari', desc: 'Spearmen hit another 20% harder.', cost: { gold: 380, wheat: 250 }, time: 360, fx: { spearDmg: 0.2 } },
  ] },
  archer: { name: 'Archers', look: 'archer', nodes: [
    { id: 'arch1', c: 1, r: 0, name: 'Longbows', desc: 'Archers shoot 20% further.', cost: { gold: 60, wood: 80 }, time: 120, fx: { archRange: 0.2 } },
    { id: 'arch2', c: 0, r: 1, req: ['arch1'], name: 'Barbed Arrows', desc: 'Arrows do 20% more damage.', cost: { gold: 120, wood: 120 }, time: 180, fx: { archDmg: 0.2 } },
    { id: 'arch5', c: 0, r: 2, req: ['arch2'], name: 'Bodkin Points', desc: 'Arrows punch through armour: another 15% damage.', cost: { gold: 200, stone: 100 }, time: 240, fx: { archDmg: 0.15 } },
    { id: 'arch3', c: 2, r: 1, req: ['arch1'], name: 'Volley Fire', desc: 'Archers loose arrows 20% faster.', cost: { gold: 140, wood: 140 }, time: 200, fx: { archFast: 0.2 } },
    { id: 'arch4', c: 2, r: 2, req: ['arch3'], name: 'Hawk Eyes', desc: 'Archers spot hidden enemies from further away; towers shoot 4 further.', cost: { gold: 220, wheat: 150 }, time: 260, fx: { archEyes: 1 } },
    { id: 'arch6', c: 1, r: 3, req: ['arch5', 'arch4'], name: 'Master of the Bow', desc: 'Archers shoot 15% further and 10% faster.', cost: { gold: 380, wood: 250 }, time: 360, fx: { archRange: 0.15, archFast: 0.1 } },
  ] },
  command: { name: 'Commanders', look: 'berserker', nodes: [
    { id: 'cmd1', c: 1, r: 0, name: 'Iron Hide', desc: 'Commanders have 30% more health.', cost: { gold: 150, stone: 100 }, time: 180, fx: { cmdHp: 0.3 } },
    { id: 'cmd2', c: 0, r: 1, req: ['cmd1'], name: 'Quick Climb', desc: 'Commander abilities recharge 30% faster.', cost: { gold: 240, wood: 150 }, time: 240, fx: { cmdCd: 0.3 } },
    { id: 'cmd3', c: 0, r: 2, req: ['cmd2'], name: 'Bloodlust', desc: 'The Berserker heals with every enemy he fells.', cost: { gold: 360, wheat: 200 }, time: 300, fx: { bloodlust: 1 } },
    { id: 'cmd5', c: 2, r: 1, req: ['cmd1'], name: 'War Council', desc: 'Commanders have another 20% more health.', cost: { gold: 240, stone: 150 }, time: 240, fx: { cmdHp: 0.2 } },
    { id: 'cmd4', c: 2, r: 2, req: ['cmd5'], name: 'Banner of Courage', desc: 'The Taishō’s aura and rally are twice as strong.', cost: { gold: 400, stone: 250 }, time: 320, fx: { banner: 1 } },
    { id: 'cmd6', c: 1, r: 3, req: ['cmd3', 'cmd4'], name: 'Living Legend', desc: 'Abilities recharge another 20% faster.', cost: { gold: 600, wheat: 300 }, time: 420, fx: { cmdCd: 0.2 } },
  ] },
  siege: { name: 'Siege', look: null, icon: 'ram', nodes: [
    { id: 'siege1', c: 1, r: 0, name: 'Hide Roof', desc: 'Rams have 50% more health and shrug off dropped stones.', cost: { gold: 100, wood: 150 }, time: 150, fx: { ramHp: 0.5 } },
    { id: 'siege2', c: 0, r: 1, req: ['siege1'], name: 'Iron-Capped Ram', desc: 'Rams hit gates and walls 40% harder.', cost: { gold: 200, stone: 150 }, time: 240, fx: { ramDmg: 0.4 } },
    { id: 'siege3', c: 2, r: 1, req: ['siege1'], name: 'Carpenters’ Guild', desc: 'Rams are built 40% faster.', cost: { gold: 150, wood: 200 }, time: 200, fx: { ramBuild: 0.4 } },
    { id: 'siege4', c: 1, r: 2, req: ['siege2', 'siege3'], name: 'Swinging Crew', desc: 'Rams hit another 30% harder.', cost: { gold: 320, stone: 200 }, time: 300, fx: { ramDmg: 0.3 } },
  ] },
  logistics: { name: 'Scouts & Marches', look: null, icon: 'scout', nodes: [
    { id: 'log1', c: 1, r: 0, name: 'Swift Scouts', desc: 'Scouts travel 25% faster.', cost: { gold: 40, wheat: 60 }, time: 90, fx: { scoutSpeed: 1 } },
    { id: 'log3', c: 0, r: 1, req: ['log1'], name: 'Spy Network', desc: 'Scouts see much further around them.', cost: { gold: 140, wheat: 120 }, time: 180, fx: { scoutSight: 1 } },
    { id: 'log5', c: 0, r: 2, req: ['log3'], name: 'Mountain Guides', desc: 'Scouts travel another 25% faster.', cost: { gold: 200, wheat: 150 }, time: 220, fx: { scoutSpeed: 1 } },
    { id: 'log2', c: 2, r: 1, req: ['log1'], name: 'Mountain Paths', desc: 'Armies march 25% faster.', cost: { gold: 100, wheat: 100 }, time: 150, fx: { marchSpeed: 1 } },
    { id: 'log4', c: 2, r: 2, req: ['log2'], name: 'Supply Lines', desc: 'Marches cost half the wheat.', cost: { gold: 260, wheat: 200 }, time: 270, fx: { supply: 1 } },
  ] },
  defense: { name: 'Village Defense', look: null, icon: 'wall', nodes: [
    { id: 'def1', c: 1, r: 0, name: 'Mortar Walls', desc: 'Walls, gates and palisades are 30% stronger.', cost: { gold: 80, stone: 150 }, time: 150, fx: { wallHp: 0.3 } },
    { id: 'def2', c: 0, r: 1, req: ['def1'], name: 'Watchmen', desc: 'Your soldiers spot sneaking bandits from 50% further away.', cost: { gold: 120, wood: 100 }, time: 180, fx: { earlyWarn: 1 } },
    { id: 'def4', c: 0, r: 2, req: ['def2'], name: 'Bounty Hunters', desc: 'Double gold for every bandit your people defeat.', cost: { gold: 160, wheat: 150 }, time: 200, fx: { bounty: 1 } },
    { id: 'def3', c: 2, r: 1, req: ['def1'], name: 'Murder Holes', desc: 'Your towers drop stones on attackers at your gates.', cost: { gold: 220, stone: 220 }, time: 260, fx: { murder: 1 } },
    { id: 'def5', c: 2, r: 2, req: ['def3'], name: 'Stone Keep', desc: 'Walls, gates and palisades another 30% stronger.', cost: { gold: 260, stone: 300 }, time: 300, fx: { wallHp: 0.3 } },
  ] },
};
