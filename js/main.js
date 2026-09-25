// Boot: build the world, load the save, run the loop.
import { initMaterials } from './render/geo.js';
import { Stage } from './render/stage.js';
import { Nature } from './render/nature.js';
import { renderThumbs } from './render/thumbs.js';
import { Game, SAVE_KEY } from './game/world.js';
import { RTSCamera } from './ui/camera.js';
import { Input } from './ui/input.js';
import { Hud } from './ui/hud.js';
import { Views } from './ui/views.js';
import { h } from './util.js';
import { Music } from './audio/music.js';
import { Weather, Smoke } from './render/weather.js';
import { Bubbles } from './ui/bubbles.js';

const BACKUP_KEY = 'tenka.save.backup';

function pickQuality() {
  let q = null;
  try { q = localStorage.getItem('tenka.quality'); } catch (_) { /* no storage */ }
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  const iPad = navigator.maxTouchPoints > 1 && /Mac|iPad/.test(navigator.platform || navigator.userAgent);
  return iPad ? 'medium' : 'high';
}
function readRaw() { try { return localStorage.getItem(SAVE_KEY); } catch (_) { return null; } }
// before version 2 touches anything, keep a snapshot of the village for the classic (v1) backup at /v1/
try { const raw = localStorage.getItem(SAVE_KEY); if (raw && !localStorage.getItem('tenka.v1snapshot')) localStorage.setItem('tenka.v1snapshot', raw); } catch (_) { /* storage off */ }

function boot() {
  const quality = pickQuality();
  initMaterials();
  renderThumbs();
  const stage = new Stage(document.getElementById('scene'), quality);

  // Progress safety: keep a copy of the last save before this version touches it.
  const raw = readRaw();
  let save = null, parseError = false;
  if (raw) {
    try { save = JSON.parse(raw); } catch (_) { parseError = true; }
    try { if (save) localStorage.setItem(BACKUP_KEY, raw); } catch (_) { /* storage full or off */ }
  }
  const seed = save && save.seed ? save.seed : Math.floor(Math.random() * 1e9);
  const nature = new Nature(stage.scene, seed, quality);
  const game = new Game(stage, nature, seed);
  const hud = new Hud(game);
  const cam = new RTSCamera(stage.camera);
  const input = new Input(game, stage, cam, hud);
  const views = new Views({ game, stage, hud, input, cam });

  // Autosave is switched off if the save couldn't be read, so a bad update can never overwrite it.
  let blocked = false;
  const saveNow = (wipe = false) => {
    try {
      if (wipe) { blocked = true; localStorage.removeItem(SAVE_KEY); return; }
      if (blocked) return;
      const s = game.serialize(); s.cam = { x: +cam.target.x.toFixed(1), z: +cam.target.z.toFixed(1), yaw: +cam.yaw.toFixed(3), dist: +cam.dist.toFixed(1) };
      if (window.tenkaExtraSave) window.tenkaExtraSave(s);
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    } catch (e) { if (!saveNow.warned) { saveNow.warned = true; hud.toast('Saving isn’t available in this browser', 'bad'); } }
  };
  saveNow.block = () => { blocked = true; };
  hud.attach(input, cam, saveNow);

  let away = null, failed = parseError;
  if (save && !parseError) {
    try {
      away = game.load(save);
      if (save.cam) { cam.target.set(+save.cam.x || 0, 0, +save.cam.z || 0); cam.yaw = cam.goalYaw = +save.cam.yaw || 0.6; cam.dist = cam.goalDist = +save.cam.dist || 58; }
    } catch (e) { console.error('Save could not be loaded', e); failed = true; }
  }
  if (failed) {
    blocked = true;
    hud.openModal('Your save couldn’t be loaded', h('div', null,
      h('p', null, 'Your village is still safe — nothing has been overwritten. This can happen for a moment right after an update while the browser still has old files.'),
      h('p', { class: 'sub' }, 'Try reloading first. If it keeps happening, copy your save code so it can be restored later.')),
      [{ label: 'Reload', fn: () => location.reload() },
       { label: 'Copy save code', cls: 'ghost', keep: true, fn: () => { try { navigator.clipboard.writeText(btoa(unescape(encodeURIComponent(raw || '')))); hud.toast('Save code copied'); } catch (_) { hud.toast('Could not copy', 'bad'); } } },
       { label: 'Start a new village (old one kept as backup)', cls: 'danger', fn: () => { blocked = false; try { localStorage.setItem(BACKUP_KEY, raw || ''); } catch (_) { /* */ } location.reload(); saveNow(true); } }],
      { locked: true });
  }
  if (!game.buildings.size) { game.newGame(); if (!failed) setTimeout(() => hud.showHelp(), 600); }
  hud.renderBar(); // the build menu was drawn before the save was loaded: redraw it for the real Keep level
  if (away) setTimeout(() => hud.showAway(away), 400);

  window.addEventListener('resize', () => { stage.resize(); hud.layout(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
  window.addEventListener('pagehide', () => saveNow());
  stage.resize();

  const weather = new Weather(stage.scene), bubbles = new Bubbles(game, stage), smoke = new Smoke(stage.scene);
  let smokeSrc = [], smokeT = 0, slowT = 0, fastT = 0, avgDt = 1 / 60;
  // chimneys: homes smoke more in the cold, the forge and the brewery always
  const SMOKY = { house: 0.5, nagaya: 0.8, blacksmith: 1.6, sakebrewery: 1.1, teahouse: 0.5 };
  const chimneys = () => {
    const out = [], t = cam.target, winter = game.life.season === 3 ? 1.8 : game.life.season === 1 ? 0.5 : 1;
    for (const b of game.buildings.values()) {
      const k = SMOKY[b.type]; if (!k || !b.done || b.fire) continue;
      const c = game.center(b); if (Math.hypot(c.x - t.x, c.z - t.z) > 70) continue;
      if (b.type === 'house' && (b.id % 3) && game.life.season !== 3) continue;
      out.push({ x: c.x + 0.4, y: (b.def.h || 4) * 0.95, z: c.z - 0.3, rate: k * (b.type === 'blacksmith' || b.type === 'sakebrewery' ? 1 : winter), d: Math.hypot(c.x - t.x, c.z - t.z) });
    }
    return out.sort((a, b) => a.d - b.d).slice(0, 24);
  };
  const hooks = { frame: [] };
  let last = performance.now(), tickT = 0, saveT = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    step(dt);
    requestAnimationFrame(frame);
  }
  function step(dt) {
    let sim = hud.paused ? 0 : dt * hud.speed;
    while (sim > 0) { const s = Math.min(sim, 0.05); game.update(s); for (const f of hooks.frame) f(s); sim -= s; }
    stage.setTime(game.state.time);
    const view = window.tenkaView;           // the country map / battle can take over the camera
    if (view && view.active) view.update(dt, input.keys);
    else { cam.update(dt, input.keys); input.updateSelectionVisual(); }
    const c = view && view.active ? view.cam : cam;
    // the year in the valley: leaves, ground, falling petals / leaves / snow / rain, and what the villagers say
    const inVillage = !(view && view.active), L = game.life;
    game.viewFocus = cam.target;
    nature.setSeason(L.season);
    weather.update(dt, c.target, L.weather === 'rain' ? 'rain' : L.weather === 'snow' ? 'snow' : L.season === 0 ? 'petals' : L.season === 2 ? 'leaves' : null, inVillage || views.mode === 'battle');
    bubbles.update(dt, inVillage && hud.settings.bubbles !== false);
    smokeT -= dt; if (smokeT <= 0) { smokeT = 2; smokeSrc = inVillage ? chimneys() : []; }
    smoke.update(dt, smokeSrc, inVillage);
    // keep it smooth on slower devices: step the resolution down when frames get slow, back up when there's room
    avgDt += (dt - avgDt) * 0.05;
    if (hud.settings.autoRes !== false && document.visibilityState === 'visible') {
      const R = stage.renderer, pr = R.getPixelRatio(), maxPr = Math.min(window.devicePixelRatio || 1, stage.quality === 'low' ? 1 : stage.quality === 'medium' ? 1.5 : 2);
      if (avgDt > 1 / 26) { slowT += dt; fastT = 0; } else if (avgDt < 1 / 50) { fastT += dt; slowT = 0; } else { slowT = 0; fastT = 0; }
      if (slowT > 4 && pr > 0.75) { R.setPixelRatio(Math.max(0.75, pr - 0.25)); stage.resize(); slowT = 0; }
      if (fastT > 12 && pr < maxPr) { R.setPixelRatio(Math.min(maxPr, pr + 0.25)); stage.resize(); fastT = 0; }
    }
    stage.update(dt, c.target, stage.camera.position);
    stage.render();
    tickT += dt; if (tickT > 0.25) { tickT = 0; hud.tick(); music.setMood(views.mode === 'battle' && view && view.active ? 'battle' : game.raids.alarmed ? 'raid' : (game.state.time < 0.22 || game.state.time > 0.8) ? 'night' : 'day'); }
    saveT += dt; if (saveT > 15) { saveT = 0; saveNow(); }
  }
  // the soundtrack starts with the first touch or key (browsers don't allow sound before that)
  const music = new Music(); hud.music = music;
  music.on = hud.settings.music !== false && !hud.settings.muted; music.vol = hud.settings.musicVol ?? 0.6; music.style = hud.settings.musicStyle || 'mix';
  const wake = () => { if (music.on) music.unlock(); };
  window.addEventListener('pointerdown', wake); window.addEventListener('keydown', wake);
  requestAnimationFrame(frame);
  document.getElementById('loading').remove();
  // debug: advance the game by hand (used for testing when the tab isn't animating)
  const advance = (sec = 1) => { for (let t = 0; t < sec; t += 0.05) { game.update(0.05); for (const f of hooks.frame) f(0.05); } step(0); };
  window.tenka = { game, stage, cam, input, hud, views, save: saveNow, advance, hooks, music };
}

try { boot(); }
catch (e) {
  console.error(e);
  const l = document.getElementById('loading');
  if (l) l.querySelector('p').textContent = 'Something went wrong while starting the game: ' + e.message + ' — try reloading. Your saved village is not affected.';
}
