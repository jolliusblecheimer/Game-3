// Villager behaviour: each villager runs a little loop of "walk somewhere, do something".
import { JOBS, ECON, RES } from './data.js';
import { TREE } from './grid.js';

const PLOT_CELL = 2;

function setLook(v, look) {
  if (v.person.lookName === look) return;
  v.person.setLook(look);
  v.person.group.traverse(o => { if (o.isMesh) o.userData.pick = { kind: 'villager', id: v.id }; });
  if (v.carry) v.person.setCarry(v.carry.res);
}
function goTo(game, v, target, onArrive, status) {
  const path = game.grid.findPath(v.pos, target);
  if (status) v.status = status;
  if (!path) { v.status = 'Can’t find a way there'; act(v, 2.5, 'idle', null); return false; }
  v.path = path; v.pathI = 0; v.onArrive = onArrive; v.face = null;
  return true;
}
function act(v, sec, pose, onDone, status, face) { v.act = sec; v.pose = pose; v.onDone = onDone; if (status) v.status = status; v.face = face || null; }
// step inside a building for a while (you see them disappear through the door)
function inside(v, sec, onDone, status) { v.hidden = true; act(v, sec, 'idle', () => { v.hidden = false; if (onDone) onDone(); }, status); }
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function nearestDropoff(game, v, res) {
  let best = null, bd = Infinity;
  for (const b of game.buildings.values()) {
    if (!b.done) continue;
    const d = b.def.dropoff; if (d !== 'all' && d !== res) continue;
    const dd = dist(game.center(b), v.pos); if (dd < bd) { bd = dd; best = b; }
  }
  return best;
}
function deliver(game, v) {
  const { res, amt } = v.carry, b = nearestDropoff(game, v, res);
  if (!b) { v.status = 'Nowhere to store goods'; act(v, 3, 'idle', null); return; }
  goTo(game, v, game.door(b, 0.7), () => {
    const store = () => {
      const got = game.add(res, amt);
      if (got < amt && game.state.clock - (game.lastFullToast || -99) > 30) { game.lastFullToast = game.state.clock; game.toast(`${RES[res].name} storage is full — build or upgrade a Kura Storehouse`, 'warn'); }
      v.carry = null; v.person.setCarry(null);
    };
    if (b.type === 'lumber') act(v, 1.4, 'drop', () => { store(); v.status = 'Stacked the logs'; }, 'Stacking logs', game.center(b));
    else inside(v, 1.6, () => { store(); v.status = `Stored ${amt} ${RES[res].name.toLowerCase()}`; }, `Storing ${RES[res].name.toLowerCase()} inside the ${b.def.name}`);
  }, `Carrying ${RES[res].name.toLowerCase()} to the ${b.def.name}`);
}
function pickUp(v, res, amt) { v.carry = { res, amt }; v.person.setCarry(res); }

/* ---------- building work (builders) ---------- */
// sent = a worker you told to aid construction: they join even a busy site rather than turn back
function workFor(game, v, sitesOnly = false, sent = false) {
  // construction and upgrades first, then repairs, then marked trees & rocks
  let best = null, bd = Infinity, crowded = null, cd = Infinity;
  for (const b of game.buildings.values()) {
    if (!game.needsWork(b)) continue;
    if (sitesOnly && b.done) continue;
    let crew = 0; for (const o of game.villagers.values()) if (o.site === b.id && o !== v) crew++;
    // prioritised jobs first, then new buildings and upgrades, then repairs
    const d = dist(game.center(b), v.pos) + (b.done && !b.upg ? 40 : 0) - (b.prio ? 1000 : 0);
    if (crew >= Math.max(2, Math.ceil(b.w * b.d / 3))) { if (sent && d < cd) { cd = d; crowded = b; } continue; }
    if (d < bd) { bd = d; best = b; }
  }
  best = best || crowded;
  if (best || sitesOnly) return best ? { b: best } : null;
  let mb = null, md = Infinity;
  for (const m of game.clearMarks.values()) {
    if (m.taken && m.taken !== v.id) continue;
    const c = game.grid.center(m.cx, m.cz), d = dist(c, v.pos); if (d < md) { md = d; mb = m; }
  }
  return mb ? { m: mb } : null;
}
function doBuild(game, v, b) {
  v.site = b.id;
  const what = !b.done ? `Building the ${b.def.name}` : b.upg ? `Upgrading the ${b.def.name}` : `Repairing the ${b.def.name}`;
  goTo(game, v, game.spotAround(b, 0.9), () => {
    v.building = b.id;
    act(v, 5, 'hammer', () => { v.building = null; }, what, game.center(b));
  }, `Going to the ${b.def.name}`);
}
function doClear(game, v, m) {
  m.taken = v.id;
  const c = game.grid.center(m.cx, m.cz), d = Math.max(0.01, dist(v.pos, c));
  goTo(game, v, { x: c.x + (v.pos.x - c.x) / d * 1.3, z: c.z + (v.pos.z - c.z) / d * 1.3 }, () => {
    act(v, ECON.clearTime / game.workMult(), m.kind === 't' ? 'chop' : 'pickaxe', () => { m.taken = 0; game.clearMarked(m); }, m.kind === 't' ? 'Felling a tree to clear land' : 'Breaking up a boulder', c);
  }, 'Going to clear land');
}
function findTree(game, camp, v) {
  const c = game.center(camp), reach = 26 + 6 * (camp.level - 1);
  let best = null, bd = Infinity;
  for (const t of game.nature.trees) {
    if (!t.alive || t.removed || t.grow < 1 || (t.reserved && t.reserved !== v.id)) continue;
    if (game.clearMarks.has(`t:${t.cx},${t.cz}`)) continue;
    const d = Math.hypot(t.x - c.x, t.z - c.z); if (d > reach) continue;
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}
function goHome(game, v, status) {
  const homes = [...game.buildings.values()].filter(b => b.done && (b.def.housing || b.type === 'townhall'));
  const home = game.raids.alarmed ? homes.sort((a, b) => dist(game.center(a), v.pos) - dist(game.center(b), v.pos))[0] : homes[v.id % Math.max(1, homes.length)];
  if (!home) return act(v, 4, 'idle', null, status);
  return goTo(game, v, game.door(home, 0.5), () => inside(v, game.raids.alarmed ? 4 : 20, null, status), game.raids.alarmed ? 'Running inside to hide' : 'Heading home for the night');
}

// walk a stretch of wall walkway: climb up at one end, patrol along the top, climb down
function wallPatrol(game, v) {
  const walls = [...game.buildings.values()].filter(b => b.type === 'wall' && b.done && b.level >= 2);
  if (!walls.length) return false;
  const start = walls[Math.floor(game.rand() * walls.length)], at = new Map(walls.map(b => [b.cx + ',' + b.cz, b]));
  const chain = [start], seen = new Set([start.id]);
  for (let k = 0; k < 10; k++) {
    const cur = chain[chain.length - 1];
    const next = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => at.get((cur.cx + dx) + ',' + (cur.cz + dz))).filter(b => b && !seen.has(b.id));
    if (!next.length) break; const n = next[Math.floor(game.rand() * next.length)]; chain.push(n); seen.add(n.id);
  }
  if (chain.length < 3) return false;
  const top = b => game.center(b), H = 2.95 * (1 + 0.14 * (start.level - 1));
  const foot = b => { const c = game.grid.nearestWalkable(b.cx, b.cz, 3); return c ? game.grid.center(c[0], c[1]) : null; };
  const up = foot(start), down = foot(chain[chain.length - 1]); if (!up || !down) return false;
  return goTo(game, v, up, () => {
    const s = top(start); v.pos.x = s.x; v.pos.z = s.z; v.elev = H; v.onWall = true;
    v.path = chain.slice(1).map(top); v.pathI = 0; v.status = 'Patrolling the wall walk';
    v.onArrive = () => { v.elev = 0; v.onWall = false; v.pos.x = down.x; v.pos.z = down.z; act(v, 4, 'guard', null, 'Watching from the wall'); };
  }, 'Heading up onto the wall walk');
}
// spots on a tower that are taken — by archers up there or on their way (at most 3 per tower)
function towerSpots(game, b, except) {
  const taken = new Set();
  for (const o of game.villagers.values()) {
    if (o === except) continue;
    if (o.post && o.post.b === b.id) taken.add(o.post.i);
    if (o.claim && o.claim.b === b.id) taken.add(o.claim.i);
  }
  return taken;
}
// archers spread out: each climbs the emptiest watchtower (the nearest one when it's a tie)
function climbTower(game, v) {
  let best = null, bn = Infinity, bd = Infinity;
  for (const b of game.buildings.values()) {
    if (b.type !== 'tower' || !b.done) continue;
    const posts = b.extra.post || [], taken = towerSpots(game, b, v);
    if (taken.size >= posts.length) continue;
    const d = dist(game.center(b), v.pos);
    if (taken.size < bn || (taken.size === bn && d < bd)) { best = b; bn = taken.size; bd = d; }
  }
  if (!best) return false;
  const b = best, posts = b.extra.post, taken = towerSpots(game, b, v), i = posts.findIndex((_, k) => !taken.has(k));
  v.claim = { b: b.id, i }; // hold the spot while walking there
  goTo(game, v, game.door(b, 0.8), () => {
    v.claim = null;
    if (!game.buildings.has(b.id) || towerSpots(game, b, v).has(i)) return;
    const [px, py, pz] = posts[i], p = game.local(b, px, pz);
    v.post = { b: b.id, i }; v.elev = py * (1 + 0.14 * (b.level - 1)); v.pos.x = p.x; v.pos.z = p.z; v.heading = b.rot * Math.PI / 2;
    act(v, 8, 'guard', null, `Keeping watch on the ${b.def.name}`);
  }, 'Climbing up to a watchtower');
  return true;
}
// step down from a tower (to move to an emptier one, or because it's gone)
function leaveTower(game, v) {
  const b = v.post && game.buildings.get(v.post.b);
  v.post = null; v.elev = 0;
  if (b) { const d = game.door(b, 0.8); v.pos.x = d.x; v.pos.z = d.z; }
}

export function thinkVillager(game, v) {
  v.site = null; v.building = null; v.hidden = false;
  if (v.carry && !game.raids.alarmed) return deliver(game, v);
  const J = JOBS[v.job], work = v.work ? game.buildings.get(v.work) : null;
  // bandits! soldiers stand ready (the raid code moves them), everyone else hides
  if (game.raids.alarmed) {
    if (J.soldier) {
      if (v.job === 'archer' && !v.post && climbTower(game, v)) return;
      return act(v, 0.5, 'guard', null, v.post ? 'Shooting from the tower' : 'Ready to fight the bandits');
    }
    return goHome(game, v, 'Hiding from the bandits');
  }
  if (v.work && !work) { game.setJob(v, J.soldier ? v.job : 'idle'); return; }
  // told to aid construction: build until nothing is left, then go back to the job
  if (v.aid) {
    const w = workFor(game, v, false, true);
    if (w && w.b) { setLook(v, 'builder'); return doBuild(game, v, w.b); }
    if (w && w.m) { setLook(v, 'builder'); return doClear(game, v, w.m); }
    v.aid = false; setLook(v, J.look); game.toast(`${v.name} is done helping and goes back to work`); game.emit('job', v);
  }
  if (v.job !== 'idle') setLook(v, J.look);
  if (work && !work.done) return act(v, 3, 'idle', null, `Waiting for the ${work.def.name} to be built`);
  const mult = game.workMult() * game.levelMult(work);
  switch (v.job) {
    case 'farmer': {
      const spot = game.spotIn(work), planting = game.rand() < 0.5;
      return goTo(game, v, spot, () => act(v, J.work / mult * 0.5, planting ? 'kneel' : 'dig',
        () => act(v, J.work / mult * 0.5, planting ? 'dig' : 'kneel', () => pickUp(v, 'wheat', J.amount), planting ? 'Hoeing the soil' : 'Binding the sheaves'),
        planting ? 'Planting seedlings' : 'Cutting ripe wheat'), 'Walking to the field');
    }
    case 'woodcutter': {
      const t = findTree(game, work, v);
      if (!t) return act(v, 5, 'idle', null, 'No grown trees near the camp — wait for regrowth');
      t.reserved = v.id; v.tree = t;
      const d = Math.max(0.01, Math.hypot(v.pos.x - t.x, v.pos.z - t.z));
      const spot = { x: t.x + (v.pos.x - t.x) / d * 1.1, z: t.z + (v.pos.z - t.z) / d * 1.1 };
      return goTo(game, v, spot, () => act(v, J.work / mult, 'chop', () => {
        t.chops = (t.chops || 0) + 1; t.reserved = 0; v.tree = null;
        if (t.chops >= ECON.treeChops) { t.alive = false; t.regrowAt = game.state.clock + ECON.treeRegrow; t.chops = 0; game.grid.set(t.cx, t.cz, TREE, true); game.nature.syncTree(t); }
        pickUp(v, 'wood', J.amount);
      }, 'Chopping wood', { x: t.x, z: t.z }), 'Looking for a good tree');
    }
    case 'stonecutter': {
      const face = game.local(work, -work.sw * 0.35, -work.sd * 0.35), spot = game.spotAround(work, 0.6);
      return goTo(game, v, spot, () => act(v, J.work / mult * 0.6, 'pickaxe',
        () => act(v, J.work / mult * 0.4, 'work', () => pickUp(v, 'stone', J.amount), 'Squaring the block', face),
        'Breaking rock from the quarry face', face), 'Walking to the quarry');
    }
    case 'miner':
      return goTo(game, v, game.door(work, 0.4), () => inside(v, J.work / mult, () => pickUp(v, 'gold', J.amount), 'Digging for gold deep inside the mine'), 'Walking to the mine');
    case 'trainee': case 'trainee_archer': {
      if (!v.paid) {
        const cost = work.def.trainCost;
        if (!game.canAfford(cost)) return act(v, 4, 'idle', null, 'Waiting for training supplies');
        game.pay(cost); v.paid = true;
      }
      const archer = v.job === 'trainee_archer';
      // archers stand on the shooting line inside the range; spearmen drill in the dojo yard
      const slot = Math.max(0, work.workers.indexOf(v.id)), n = Math.max(1, game.jobSlots(work));
      const lx = (slot - (n - 1) / 2) * 1.3;
      const spot = archer ? game.local(work, lx, -work.sd * PLOT_CELL / 2 + 2.9) : game.local(work, lx, work.sd * PLOT_CELL / 2 + 1.6);
      const faceTo = archer ? game.local(work, lx, work.sd * PLOT_CELL / 2) : game.local(work, lx * 0.5, 0);
      const pct = () => Math.min(99, Math.round((v.train || 0) / work.def.trainTime * 100));
      return goTo(game, v, spot, () => act(v, 5, archer ? 'shoot' : 'train', () => {
        v.train = (v.train || 0) + 5 * mult * (1 + game.rb('trainFast'));
        if (v.train >= work.def.trainTime) {
          const to = work.def.trains;
          game.setJob(v, to); game.state.stats.trained++;
          game.toast(`${v.name} has become ${/^[AEIOU]/.test(JOBS[to].name) ? 'an' : 'a'} ${JOBS[to].name}!`);
        }
      }, archer ? `Practising the bow (${pct()}%)` : `Drilling with the spear (${pct()}%)`, faceTo), 'Heading to training');
    }
    case 'archer':
      if (v.post) {
        const b = game.buildings.get(v.post.b);
        if (b && b.done) {
          // keep the towers evenly manned: move over if another tower has two fewer archers
          const here = towerSpots(game, b, null).size;
          const emptier = [...game.buildings.values()].some(o => o.type === 'tower' && o.done && o.id !== b.id && towerSpots(game, o, null).size <= here - 2);
          if (!emptier || game.raids.alarmed) return act(v, 8, 'guard', null, `Keeping watch on the ${b.def.name}`);
        }
        leaveTower(game, v);
      }
      if (climbTower(game, v)) return;
    // eslint-disable-next-line no-fallthrough
    case 'ashigaru': case 'berserker': case 'taisho': {
      // from Keep level 4, spearmen patrol along the walkways of upgraded walls
      if (v.job === 'ashigaru' && game.thLevel >= 4 && game.rand() < 0.6 && wallPatrol(game, v)) return;
      const gates = [...game.buildings.values()].filter(b => b.done && (b.type === 'gate' || b.type === 'townhall'));
      const g = gates[Math.floor(game.rand() * gates.length)];
      if (!g) return act(v, 4, 'guard', null, 'Standing guard');
      const d = game.door(g, 1.5 + game.rand() * 2);
      return goTo(game, v, { x: d.x + (game.rand() - 0.5) * 3, z: d.z + (game.rand() - 0.5) * 3 }, () => act(v, 8 + game.rand() * 10, 'guard', null, `Guarding the ${g.def.name}`), 'On patrol');
    }
    default: { // unemployed: build, repair and clear land; otherwise relax and go home at night
      const w = workFor(game, v);
      if (w && w.b) { setLook(v, 'builder'); return doBuild(game, v, w.b); }
      if (w && w.m) { setLook(v, 'builder'); return doClear(game, v, w.m); }
      setLook(v, JOBS[v.job].look);
      const night = game.state.time < 0.22 || game.state.time > 0.8;
      if (night) return goHome(game, v, 'Sleeping at home');
      const spots = [...game.buildings.values()].filter(b => b.done && b.def.relax);
      if (spots.length && game.rand() < 0.45) {
        const b = spots[Math.floor(game.rand() * spots.length)];
        const pose = b.def.relax === 'pray' ? 'pray' : 'sit';
        const where = b.def.relax === 'pray' ? game.door(b, -0.2 + game.rand() * 0.6) : game.spotAround(b, 0.6);
        return goTo(game, v, where, () => act(v, 14 + game.rand() * 14, pose, null, b.def.relax === 'pray' ? `Praying at the ${b.def.name}` : `Relaxing at the ${b.def.name}`, game.center(b)), `Strolling to the ${b.def.name}`);
      }
      const th = game.keep;
      const base = th ? game.door(th, 4) : { x: 0, z: 8 };
      return goTo(game, v, { x: base.x + (game.rand() - 0.5) * 16, z: base.z + (game.rand() - 0.5) * 10 }, () => act(v, 5 + game.rand() * 6, 'idle', null, 'Unemployed — chatting with neighbours'), 'Taking a walk');
    }
  }
}

export function updateVillager(game, v, dt) {
  let pose = 'idle';
  if (v.path) {
    const tgt = v.path[v.pathI], dx = tgt.x - v.pos.x, dz = tgt.z - v.pos.z, d = Math.hypot(dx, dz);
    const sp = ECON.walkSpeed * (v.carry ? 0.85 : 1) * (game.hungry() ? 0.8 : 1) * game.grid.speedAt(v.pos.x, v.pos.z) * (game.raids.alarmed ? 1.4 : 1);
    if (d < 0.05) {
      v.pathI++;
      if (v.pathI >= v.path.length) { v.path = null; const cb = v.onArrive; v.onArrive = null; if (cb) cb(); }
    } else {
      const step = Math.min(d, sp * dt);
      v.pos.x += dx / d * step; v.pos.z += dz / d * step;
      turn(v, Math.atan2(dx, dz), dt);
    }
    pose = 'walk';
  } else if (v.act > 0) {
    v.act -= dt;
    if (v.building) {
      const b = game.buildings.get(v.building);
      if (b && game.needsWork(b)) game.buildTick(b, dt); else v.act = Math.min(v.act, 0.3);
    }
    if (v.face) turn(v, Math.atan2(v.face.x - v.pos.x, v.face.z - v.pos.z), dt);
    pose = v.pose;
    if (v.act <= 0) { v.act = 0; const cb = v.onDone; v.onDone = null; if (cb) cb(); }
  }
  const g = v.person.group;
  g.visible = !v.hidden;
  g.position.set(v.pos.x, v.elev || 0, v.pos.z);
  g.rotation.y = v.heading;
  v.person.animate(dt, pose, 1);
}
function turn(v, target, dt) {
  let diff = target - v.heading;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  v.heading += diff * Math.min(1, dt * 10);
}
