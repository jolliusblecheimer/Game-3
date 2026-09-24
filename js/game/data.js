// Game data: every number that shapes the economy lives here.

export const RES = {
  wheat: { name: 'Wheat', icon: 'wheat' },
  wood: { name: 'Wood', icon: 'wood' },
  stone: { name: 'Stone', icon: 'stone' },
  gold: { name: 'Gold', icon: 'gold' },
};

export const START = {
  res: { wheat: 160, wood: 180, stone: 90, gold: 40 },
  villagers: 6,
};

export const ECON = {
  walkSpeed: 3.3,            // world units per second
  arriveEvery: 30,           // seconds between new villagers (if there is housing & food)
  arriveCost: { wheat: 15 },
  eatEvery: 55,              // each villager eats 1 wheat this often
  hungryWork: 0.5,           // work speed when out of wheat
  dayLength: 480,            // seconds for a full day–night cycle at 1×
  refund: 0.5,               // share of cost returned when demolishing
  offlineCapHours: 4,
  offlineEfficiency: 0.6,    // share of normal output earned while away
  treeRegrow: 180,           // seconds for a felled tree to regrow
  treeChops: 3,              // trips a tree supports before it falls
  autoBuild: true,
};

// Jobs. `work` = seconds of work per trip, `amount` = goods carried back.
export const JOBS = {
  idle:        { name: 'Villager',    look: 'villager' },
  builder:     { name: 'Builder',     look: 'builder' },
  farmer:      { name: 'Farmer',      look: 'farmer',      res: 'wheat', work: 9,  amount: 6, pose: 'dig' },
  woodcutter:  { name: 'Woodcutter',  look: 'woodcutter',  res: 'wood',  work: 7,  amount: 5, pose: 'chop' },
  stonecutter: { name: 'Stonecutter', look: 'stonecutter', res: 'stone', work: 10, amount: 4, pose: 'work' },
  miner:       { name: 'Miner',       look: 'miner',       res: 'gold',  work: 13, amount: 3, pose: 'dig' },
  trainee:     { name: 'Recruit',     look: 'trainee' },
  ashigaru:    { name: 'Ashigaru',    look: 'ashigaru', soldier: true, desc: 'Spearman — the backbone of your army.' },
  archer:      { name: 'Yumi Archer', look: 'archer',   soldier: true, desc: 'Archer — mans towers and fires from cover.' },
};

export const CATEGORIES = [
  { id: 'village', name: 'Village', icon: 'village' },
  { id: 'resources', name: 'Resources', icon: 'resources' },
  { id: 'military', name: 'Military', icon: 'military' },
  { id: 'defense', name: 'Defense', icon: 'defense' },
  { id: 'beauty', name: 'Harmony', icon: 'beauty' },
];

// size = footprint in grid cells (1 cell = 2 × 2 world units), before rotation.
export const BUILDINGS = {
  townhall:   { name: 'Tenshu Keep', kanji: '天守', cat: null, size: [4, 4], cost: {}, time: 0, housing: 6, storage: 500, unique: true, dropoff: 'all', h: 12,
                desc: 'The heart of your clan. Stores goods and shelters your first villagers.' },
  road:       { name: 'Dirt Road', kanji: '道', cat: 'village', size: [1, 1], cost: {}, time: 0, walkable: true, line: true, road: 1.5, h: 0.2,
                desc: 'A packed-earth path. Villagers walk 50% faster on roads and choose them when they can. Free, and laid instantly.' },
  stoneroad:  { name: 'Stone Road', kanji: '石畳', cat: 'village', size: [1, 1], cost: { stone: 3 }, time: 0, walkable: true, line: true, road: 1.9, h: 0.2,
                desc: 'Paved with cut stone. Villagers walk 90% faster. Laid instantly.' },
  house:      { name: 'Minka House', kanji: '民家', cat: 'village', size: [2, 2], cost: { wood: 40, stone: 10 }, time: 22, housing: 4, h: 4.5,
                desc: 'A thatched family home. Room for 4 more villagers.' },
  storehouse: { name: 'Kura Storehouse', kanji: '蔵', cat: 'village', size: [2, 3], cost: { wood: 60, stone: 40 }, time: 30, storage: 400, dropoff: 'all', h: 5,
                desc: 'Stores 400 more of every resource. Workers drop off goods here too.' },
  farm:       { name: 'Wheat Field', kanji: '畑', cat: 'resources', size: [4, 4], cost: { wood: 30 }, time: 18, jobs: 3, job: 'farmer', walkable: true, h: 1.5,
                desc: 'Farmers plant, tend and harvest wheat, then carry it to storage.' },
  lumber:     { name: 'Lumber Camp', kanji: '木場', cat: 'resources', size: [2, 2], cost: { wood: 20, stone: 10 }, time: 18, jobs: 3, job: 'woodcutter', dropoff: 'wood', h: 3,
                desc: 'Woodcutters fell nearby trees and bring logs here. Felled trees regrow.' },
  quarry:     { name: 'Stone Quarry', kanji: '石切場', cat: 'resources', size: [3, 3], cost: { wood: 50 }, time: 25, jobs: 3, job: 'stonecutter', h: 3.5,
                desc: 'Stonecutters split rock into blocks and haul them to storage.' },
  mine:       { name: 'Gold Mine', kanji: '金山', cat: 'resources', size: [3, 3], cost: { wood: 80, stone: 50 }, time: 40, jobs: 3, job: 'miner', h: 4,
                desc: 'Miners dig gold ore from deep in the hill. Slow but precious.' },
  dojo:       { name: 'Dojo', kanji: '道場', cat: 'military', size: [3, 3], cost: { wood: 100, stone: 50, gold: 20 }, time: 40, jobs: 4, job: 'trainee', trains: 'ashigaru', trainTime: 40, trainCost: { wheat: 10, gold: 5 }, h: 5,
                desc: 'Recruits train here and graduate as Ashigaru spearmen.' },
  kyudojo:    { name: 'Kyūdō Range', kanji: '弓道場', cat: 'military', size: [3, 4], cost: { wood: 120, stone: 30, gold: 30 }, time: 45, jobs: 4, job: 'trainee', trains: 'archer', trainTime: 50, trainCost: { wood: 15, gold: 5 }, h: 4,
                desc: 'Recruits practise the way of the bow and become Yumi archers.' },
  wall:       { name: 'Castle Wall', kanji: '石垣', cat: 'defense', size: [1, 1], cost: { stone: 8, wood: 2 }, time: 5, blocks: true, line: true, h: 3.2,
                desc: 'Stone base, plastered top. Blocks attackers — archers on towers shoot over it.' },
  gate:       { name: 'Castle Gate', kanji: '門', cat: 'defense', size: [2, 1], cost: { wood: 40, stone: 30 }, time: 20, walkable: true, h: 4.5,
                desc: 'Lets your people through your walls. Enemies must break it down.' },
  tower:      { name: 'Yagura Tower', kanji: '櫓', cat: 'defense', size: [2, 2], cost: { wood: 60, stone: 40 }, time: 30, garrison: 3, h: 7,
                desc: 'Your archers climb up here and fire down on attackers.' },
  palisade:   { name: 'Bamboo Palisade', kanji: '竹柵', cat: 'defense', size: [1, 1], cost: { wood: 4 }, time: 3, blocks: true, line: true, h: 2.5,
                desc: 'Cheap sharpened bamboo fence. Slows attackers, burns easily.' },
  spikes:     { name: 'Spike Barricade', kanji: '逆茂木', cat: 'defense', size: [1, 1], cost: { wood: 6 }, time: 3, line: true, h: 1.6,
                desc: 'Sharpened stakes that stop cavalry and slow foot soldiers.' },
  hedge:      { name: 'Hedge', kanji: '生垣', cat: 'defense', size: [1, 1], cost: { wood: 2 }, time: 2, line: true, beauty: 0.3, h: 1.4,
                desc: 'Thick bushes. Troops hiding inside are hard to spot.' },
  shrine:     { name: 'Shinto Shrine', kanji: '神社', cat: 'beauty', size: [3, 3], cost: { wood: 80, stone: 40, gold: 20 }, time: 40, beauty: 8, relax: 'pray', h: 4.5,
                desc: 'Villagers with free time come to pray. Raises Harmony a lot.' },
  garden:     { name: 'Zen Garden', kanji: '枯山水', cat: 'beauty', size: [3, 3], cost: { stone: 60, wood: 10 }, time: 30, beauty: 6, relax: 'sit', h: 1.5,
                desc: 'Raked sand and quiet stones. A place to rest the mind.' },
  pond:       { name: 'Koi Pond', kanji: '鯉池', cat: 'beauty', size: [3, 3], cost: { stone: 40, gold: 10 }, time: 25, beauty: 5, relax: 'sit', h: 1,
                desc: 'Koi drift beneath lily pads. Villagers love to sit here.' },
  teahouse:   { name: 'Tea House', kanji: '茶屋', cat: 'beauty', size: [2, 2], cost: { wood: 50, stone: 20, gold: 10 }, time: 28, beauty: 4, relax: 'sit', h: 4,
                desc: 'A quiet hut for the tea ceremony.' },
  sakura:     { name: 'Sakura Tree', kanji: '桜', cat: 'beauty', size: [1, 1], cost: { wheat: 20, wood: 5 }, time: 10, beauty: 2, h: 5,
                desc: 'A cherry tree in bloom.' },
  lantern:    { name: 'Stone Lantern', kanji: '灯籠', cat: 'beauty', size: [1, 1], cost: { stone: 10 }, time: 6, beauty: 1, h: 2.5,
                desc: 'Glows softly at night.' },
  torii:      { name: 'Torii Gate', kanji: '鳥居', cat: 'beauty', size: [2, 1], cost: { wood: 30, gold: 5 }, time: 12, beauty: 3, walkable: true, h: 3.8,
                desc: 'Marks the way to the sacred.' },
};
