// Boot: build the world, load the save, run the loop.
import { initMaterials } from './render/geo.js';
import { Stage } from './render/stage.js';
import { Nature } from './render/nature.js';
import { Game, SAVE_KEY } from './game/world.js';
import { RTSCamera } from './ui/camera.js';
import { Input } from './ui/input.js';
import { Hud } from './ui/hud.js';

function pickQuality() {
  let q = null;
  try { q = localStorage.getItem('tenka.quality'); } catch (_) { /* no storage */ }
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  const iPad = navigator.maxTouchPoints > 1 && /Mac|iPad/.test(navigator.platform || navigator.userAgent);
  return iPad ? 'medium' : 'high';
}
function readSave() {
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
}

function boot() {
  const quality = pickQuality();
  initMaterials();
  const stage = new Stage(document.getElementById('scene'), quality);
  const save = readSave();
  const seed = save && save.seed ? save.seed : Math.floor(Math.random() * 1e9);
  const nature = new Nature(stage.scene, seed, quality);
  const game = new Game(stage, nature, seed);
  const hud = new Hud(game);
  const cam = new RTSCamera(stage.camera);
  const input = new Input(game, stage, cam, hud);

  let away = null;
  if (save && save.v === 1) {
    try { away = game.load(save); if (save.cam) { cam.target.set(save.cam.x, 0, save.cam.z); cam.yaw = cam.goalYaw = save.cam.yaw; cam.dist = cam.goalDist = save.cam.dist; } }
    catch (e) { console.error('Save could not be loaded', e); hud.toast('Your save could not be read — starting a new village', 'bad'); }
  }
  if (!game.buildings.size) { game.newGame(); setTimeout(() => hud.showHelp(), 600); }

  let blocked = false;
  const saveNow = (wipe = false) => {
    try {
      if (wipe) { blocked = true; localStorage.removeItem(SAVE_KEY); return; }
      if (blocked) return;
      const s = game.serialize(); s.cam = { x: +cam.target.x.toFixed(1), z: +cam.target.z.toFixed(1), yaw: +cam.yaw.toFixed(3), dist: +cam.dist.toFixed(1) };
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    } catch (e) { if (!saveNow.warned) { saveNow.warned = true; hud.toast('Saving isn’t available in this browser', 'bad'); } }
  };
  hud.attach(input, cam, saveNow);
  if (away) setTimeout(() => hud.showAway(away), 400);

  window.addEventListener('resize', () => stage.resize());
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
  window.addEventListener('pagehide', () => saveNow());
  stage.resize();

  let last = performance.now(), tickT = 0, saveT = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    let sim = hud.paused ? 0 : dt * hud.speed;
    while (sim > 0) { const step = Math.min(sim, 0.05); game.update(step); sim -= step; }
    stage.setTime(game.state.time);
    cam.update(dt, input.keys);
    input.updateSelectionVisual();
    stage.update(dt, cam.target, stage.camera.position);
    stage.render();
    tickT += dt; if (tickT > 0.25) { tickT = 0; hud.tick(); }
    saveT += dt; if (saveT > 15) { saveT = 0; saveNow(); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  document.getElementById('loading').remove();
  // debug: advance the game by hand (used for testing when the tab isn't animating)
  const advance = (sec = 1) => { for (let t = 0; t < sec; t += 0.05) game.update(0.05); stage.setTime(game.state.time); cam.update(0, new Set()); input.updateSelectionVisual(); stage.update(0.05, cam.target, stage.camera.position); stage.render(); hud.tick(); };
  window.tenka = { game, stage, cam, input, hud, save: saveNow, advance };
}

try { boot(); }
catch (e) {
  console.error(e);
  const l = document.getElementById('loading');
  if (l) l.querySelector('p').textContent = 'Something went wrong while starting the game: ' + e.message;
}
