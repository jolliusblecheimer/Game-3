// Villager behaviour: each villager runs a little loop of "walk somewhere, do something".
import { JOBS, ECON, RES } from './data.js';
import { TREE } from './grid.js';

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
  goTo(game, v, game.door(b, 1.0), () => {
    const got = game.add(res, amt);
    if (got < amt && game.state.clock - (game.lastFullToast || -99) > 20) { game.lastFullToast = game.state.clock; game.toast(`${RES[res].name} storage is full — build a Kura Storehouse`, 'warn'); }
    v.carry = null; v.person.setCarry(null);
    act(v, 0.6, 'idle', null, `Delivered ${amt} ${RES[res].name.toLowerCase()}`);
  }, `Carrying ${RES[res].name.toLowerCase()} to the ${b.def.name}`);
}
function pickUp(v, res, amt) { v.carry = { res, amt }; v.person.setCarry(res); }

function helpBuild(game, v, b) {
  v.site = b.id;
  if (v.job === 'idle') setLook(v, 'builder');
  const spot = game.spotAround(b, 0.9);
  goTo(game, v, spot, () => {
    v.building = b.id;
    act(v, 4, 'work', () => { v.building = null; }, `Building the ${b.def.name}`, game.center(b));
  }, `Going to build the ${b.def.name}`);
}
function siteNeedingHelp(game, v) {
  let best = null, bd = Infinity;
  for (const b of game.buildings.values()) {
    if (b.done) continue;
    let helpers = 0; for (const o of game.villagers.values()) if (o.site === b.id && o !== v) helpers++;
    if (helpers >= Math.max(2, Math.ceil(b.def.size[0] * b.def.size[1] / 3))) continue;
    const d = dist(game.center(b), v.pos); if (d < bd) { bd = d; best = b; }
  }
  return best;
}
function findTree(game, camp, v) {
  const c = game.center(camp);
  let best = null, bd = Infinity;
  for (const t of game.nature.trees) {
    if (!t.alive || t.removed || t.grow < 1 || (t.reserved && t.reserved !== v.id)) continue;
    const d = Math.hypot(t.x - c.x, t.z - c.z); if (d > 30) continue;
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

export function thinkVillager(game, v) {
  v.site = null; v.building = null; v.hidden = false;
  if (v.carry) return deliver(game, v);
  const J = JOBS[v.job], work = v.work ? game.buildings.get(v.work) : null;
  if (v.work && !work) { game.setJob(v, J.soldier ? v.job : 'idle'); return; }
  if (work && !work.done) return helpBuild(game, v, work);
  const mult = game.workMult();
  switch (v.job) {
    case 'farmer': {
      const spot = game.spotIn(work);
      return goTo(game, v, spot, () => act(v, J.work / mult, J.pose, () => pickUp(v, 'wheat', J.amount), 'Tending the wheat'), 'Walking to the field');
    }
    case 'woodcutter': {
      const t = findTree(game, work, v);
      if (!t) return act(v, 4, 'idle', null, 'No grown trees near the camp');
      t.reserved = v.id; v.tree = t;
      const d = Math.max(0.01, Math.hypot(v.pos.x - t.x, v.pos.z - t.z));
      const spot = { x: t.x + (v.pos.x - t.x) / d * 1.1, z: t.z + (v.pos.z - t.z) / d * 1.1 };
      return goTo(game, v, spot, () => act(v, J.work / mult, 'chop', () => {
        t.chops = (t.chops || 0) + 1; t.reserved = 0; v.tree = null;
        if (t.chops >= ECON.treeChops) {
          t.alive = false; t.regrowAt = game.state.clock + ECON.treeRegrow; t.chops = 0;
          game.grid.set(t.cx, t.cz, TREE, true); game.nature.syncTree(t);
        }
        pickUp(v, 'wood', J.amount);
      }, 'Chopping wood', { x: t.x, z: t.z }), 'Looking for a good tree');
    }
    case 'stonecutter': {
      const spot = game.spotAround(work, 0.7);
      return goTo(game, v, spot, () => act(v, J.work / mult, 'work', () => pickUp(v, 'stone', J.amount), 'Splitting stone', game.center(work)), 'Walking to the quarry');
    }
    case 'miner': {
      return goTo(game, v, game.door(work, 0.6), () => act(v, J.work / mult, 'dig', () => pickUp(v, 'gold', J.amount), 'Digging for gold', game.center(work)), 'Walking to the mine');
    }
    case 'trainee': {
      if (!v.paid) {
        const cost = work.def.trainCost;
        if (!game.canAfford(cost)) return act(v, 3, 'idle', null, 'Waiting for training supplies');
        game.pay(cost); v.paid = true;
      }
      const spot = game.spotAround(work, 1.2);
      return goTo(game, v, spot, () => act(v, 4, 'train', () => {
        v.train = (v.train || 0) + 4 * mult;
        if (v.train >= work.def.trainTime) {
          const to = work.def.trains;
          game.setJob(v, to); game.state.stats.trained++;
          game.toast(`${v.name} graduated as ${/^[AEIOU]/.test(JOBS[to].name) ? 'an' : 'a'} ${JOBS[to].name}!`);
        }
      }, `Training (${Math.min(99, Math.round((v.train || 0) / work.def.trainTime * 100))}%)`, game.center(work)), 'Heading to training');
    }
    case 'archer': {
      // man a free post on a watchtower
      if (v.post) {
        const b = game.buildings.get(v.post.b);
        if (b && b.done) return act(v, 8, 'guard', null, `Keeping watch on the ${b.def.name}`);
        v.post = null; v.elev = 0;
      }
      for (const b of game.buildings.values()) {
        if (b.type !== 'tower' || !b.done) continue;
        const posts = b.extra.post || [];
        const taken = new Set([...game.villagers.values()].filter(o => o.post && o.post.b === b.id && o !== v).map(o => o.post.i));
        const i = posts.findIndex((_, k) => !taken.has(k));
        if (i < 0) continue;
        return goTo(game, v, game.door(b, 0.8), () => {
          const c = game.center(b), [px, py, pz] = posts[i], a = b.rot * Math.PI / 2;
          v.post = { b: b.id, i }; v.elev = py;
          v.pos.x = c.x + px * Math.cos(a) + pz * Math.sin(a); v.pos.z = c.z - px * Math.sin(a) + pz * Math.cos(a);
          v.heading = a;
          act(v, 8, 'guard', null, `Keeping watch on the ${b.def.name}`);
        }, 'Climbing up to a watchtower');
      }
      // fall through: no tower — guard like a spearman
    }
    // eslint-disable-next-line no-fallthrough
    case 'ashigaru': {
      const gates = [...game.buildings.values()].filter(b => b.done && (b.type === 'gate' || b.type === 'townhall'));
      const g = gates[Math.floor(game.rand() * gates.length)];
      if (!g) return act(v, 4, 'guard', null, 'Standing guard');
      const d = game.door(g, 1.5 + game.rand() * 2);
      return goTo(game, v, { x: d.x + (game.rand() - 0.5) * 3, z: d.z + (game.rand() - 0.5) * 3 }, () => act(v, 6 + game.rand() * 8, 'guard', null, `Guarding the ${g.def.name}`), 'On patrol');
    }
    default: { // idle villagers: build, relax, go home at night
      const site = game.state.settings.autoBuild ? siteNeedingHelp(game, v) : null;
      if (site) return helpBuild(game, v, site);
      setLook(v, JOBS[v.job].look);
      const night = game.state.time < 0.22 || game.state.time > 0.8;
      if (night) {
        const homes = [...game.buildings.values()].filter(b => b.done && b.def.housing);
        const home = homes[v.id % Math.max(1, homes.length)];
        if (home) return goTo(game, v, game.door(home, 0.6), () => { v.hidden = true; act(v, 20, 'idle', null, 'Sleeping at home'); }, 'Heading home for the night');
      }
      const spots = [...game.buildings.values()].filter(b => b.done && b.def.relax);
      if (spots.length && game.rand() < 0.45) {
        const b = spots[Math.floor(game.rand() * spots.length)];
        const pose = b.def.relax === 'pray' ? 'pray' : 'sit';
        const where = b.def.relax === 'pray' ? game.door(b, -0.2 + game.rand() * 0.6) : game.spotAround(b, 0.6);
        return goTo(game, v, where, () => act(v, 10 + game.rand() * 12, pose, null, b.def.relax === 'pray' ? `Praying at the ${b.def.name}` : `Relaxing at the ${b.def.name}`, game.center(b)), `Strolling to the ${b.def.name}`);
      }
      const th = [...game.buildings.values()].find(b => b.type === 'townhall');
      const base = th ? game.door(th, 4) : { x: 0, z: 8 };
      return goTo(game, v, { x: base.x + (game.rand() - 0.5) * 16, z: base.z + (game.rand() - 0.5) * 10 }, () => act(v, 3 + game.rand() * 5, 'idle', null, 'Chatting with neighbours'), 'Taking a walk');
    }
  }
}

export function updateVillager(game, v, dt) {
  let pose = 'idle';
  if (v.path) {
    const tgt = v.path[v.pathI], dx = tgt.x - v.pos.x, dz = tgt.z - v.pos.z, d = Math.hypot(dx, dz);
    const sp = ECON.walkSpeed * (v.carry ? 0.85 : 1) * (game.hungry() ? 0.8 : 1);
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
      if (b && !b.done) {
        b.progress = Math.min(1, b.progress + dt * game.workMult() / Math.max(1, b.def.time));
        game.syncProgress(b);
        if (b.progress >= 1) { game.completeConstruction(b); v.act = 0; }
      } else v.act = 0;
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
