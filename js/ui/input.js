// Mouse / trackpad / touch / keyboard. Left click only — no right-click needed.
import * as THREE from 'three';
import { BUILDINGS } from '../game/data.js';
import { PLOT } from '../render/nature.js';
import { buildModel } from '../render/buildings.js';
import { MAT } from '../render/geo.js';

const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export class Input {
  constructor(game, stage, cam, hud) {
    this.game = game; this.stage = stage; this.cam = cam; this.hud = hud;
    this.canvas = stage.renderer.domElement;
    this.keys = new Set();
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.placing = null;    // { type, rot, moveId, lineStart }
    this.selected = null;   // { kind, id }
    this.pointers = new Map();
    this.ghost = null; this.lastCell = null;
    this.buildSelection();
    this.bind();
  }

  /* ---------- helpers ---------- */
  setRay(x, y) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.stage.camera);
  }
  ground(x, y) { this.setRay(x, y); const p = new THREE.Vector3(); return this.ray.ray.intersectPlane(plane, p) ? p : null; }
  pick(x, y) {
    this.setRay(x, y);
    const objs = [];
    for (const b of this.game.buildings.values()) objs.push(b.root);
    for (const v of this.game.villagers.values()) if (v.person.group.visible) objs.push(v.person.group);
    const hits = this.ray.intersectObjects(objs, true);
    // prefer villagers (they're small and usually in front)
    const vh = hits.find(h => h.object.userData.pick && h.object.userData.pick.kind === 'villager');
    const h = vh || hits.find(h => h.object.userData.pick);
    return h ? h.object.userData.pick : null;
  }

  /* ---------- placement ---------- */
  startPlacing(type, moveId = 0) {
    this.cancelPlacing();
    const rot = moveId ? this.game.buildings.get(moveId).rot : (this.lastRot || 0);
    this.placing = { type, rot, moveId, lineStart: null };
    this.select(null);
    this.makeGhost();
    this.hud.onPlacing(this.placing);
  }
  // Clear land: click one corner, then the other, to mark trees and rocks for the builders.
  startClearing() {
    this.cancelPlacing();
    this.placing = { type: 'clear', lineStart: null, rot: 0 };
    this.select(null);
    this.hud.onPlacing(this.placing);
  }
  clearCells(a, b) {
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), z0 = Math.min(a[1], b[1]), z1 = Math.max(a[1], b[1]), cells = [];
    for (let z = z0; z <= z1 && cells.length < 900; z++) for (let x = x0; x <= x1; x++) cells.push([x, z]);
    return cells;
  }
  endLine() {
    if (!this.placing || !this.placing.lineStart) return false;
    this.placing.lineStart = null;
    if (this.lineTiles) { this.stage.scene.remove(this.lineTiles); this.lineTiles = null; }
    this.hud.placingHint(true, 'Click where the line should start, or drag to draw it');
    return true;
  }
  // Move mode: grab any building and drop it somewhere else
  setMoveMode(on) {
    this.moveMode = !!on;
    if (on) { this.cancelPlacing(); this.select(null); }
    this.hud.onMoveMode(this.moveMode);
  }
  cancelPlacing() {
    if (this.ghost) { this.stage.scene.remove(this.ghost); this.ghost.traverse(o => { if (o.geometry) o.geometry.dispose(); }); this.ghost = null; }
    if (this.lineTiles) { this.stage.scene.remove(this.lineTiles); this.lineTiles = null; }
    const was = this.placing; this.placing = null; this.lastCell = null;
    if (was) this.hud.onPlacing(null);
    if (was && this.moveMode) this.hud.onMoveMode(true);
  }
  makeGhost() {
    if (this.ghost) { this.stage.scene.remove(this.ghost); this.ghost = null; }
    if (this.placing.type === 'clear') return;
    const P = this.placing, def = BUILDINGS[P.type], [a, b] = def.size;
    const g = new THREE.Group();
    const model = buildModel(P.type, a * PLOT.cell, b * PLOT.cell, 1);
    model.traverse(o => { if (o.isMesh) { o.material = MAT.ghostOk; o.castShadow = false; o.receiveShadow = false; } });
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(a * PLOT.cell - 0.1, b * PLOT.cell - 0.1), MAT.ghostOk);
    pad.rotation.x = -Math.PI / 2; pad.position.y = 0.06;
    g.add(model, pad); g.userData.pad = pad; g.userData.model = model;
    this.ghost = g; this.stage.scene.add(g);
    if (this.lastCell) this.updateGhost(this.lastCell[0], this.lastCell[1]);
  }
  rotatePlacing() {
    if (!this.placing) return;
    this.placing.rot = (this.placing.rot + 1) % 4; this.lastRot = this.placing.rot;
    const c = this.lastCell; this.makeGhost(); if (c) this.updateGhost(c[0], c[1]);
  }
  // footprint min-corner so the pointer is at the building's centre
  cellFor(p, type, rot) {
    if (type === 'clear') return this.game.grid.toCell(p.x, p.z);
    const mb = this.placing && this.placing.moveId && this.game.buildings.get(this.placing.moveId);
    const [w, d] = this.game.footprint(type, rot, mb ? mb.level : 1);
    return [Math.round((p.x + PLOT.half) / PLOT.cell - w / 2), Math.round((p.z + PLOT.half) / PLOT.cell - d / 2)];
  }
  lineCells(start, end) {
    const dx = end[0] - start[0], dz = end[1] - start[1], cells = [];
    if (Math.abs(dx) >= Math.abs(dz)) { const s = Math.sign(dx) || 1; for (let i = 0; i <= Math.abs(dx); i++) cells.push([start[0] + i * s, start[1]]); }
    else { const s = Math.sign(dz); for (let i = 0; i <= Math.abs(dz); i++) cells.push([start[0], start[1] + i * s]); }
    return cells.slice(0, 60);
  }
  updateGhost(cx, cz) {
    const P = this.placing; if (!P) return;
    if (P.type === 'clear') {
      this.lastCell = [cx, cz];
      const cells = P.lineStart ? this.clearCells(P.lineStart, [cx, cz]) : [[cx, cz]];
      this.drawLine(cells, cells, cells.length);
      if (P.lineStart) { const n = this.countMarkable(cells); this.hud.placingHint(true, `${n} tree${n === 1 ? '' : 's'} and boulders to clear — click to mark`); }
      return;
    }
    if (!this.ghost) return;
    this.lastCell = [cx, cz];
    const mb = P.moveId && this.game.buildings.get(P.moveId);
    const game = this.game, [w, d] = game.footprint(P.type, P.rot, mb ? mb.level : 1), c = game.worldCenter(cx, cz, w, d);
    const def = BUILDINGS[P.type];
    this.ghost.position.set(c.x, 0, c.z); this.ghost.rotation.y = P.rot * Math.PI / 2;
    let ok, why;
    if (def.line && P.lineStart) {
      const cells = this.lineCells(P.lineStart, [cx, cz]);
      const valid = cells.filter(([x, z]) => game.canPlace(P.type, x, z, 0).ok);
      let afford = 0; const res = { ...game.state.res };
      for (const _ of valid) { let can = true; for (const r in def.cost) if (res[r] < def.cost[r]) can = false; if (!can) break; for (const r in def.cost) res[r] -= def.cost[r]; afford++; }
      this.drawLine(cells, valid, afford);
      ok = afford > 0; why = ok ? `${afford} × ${def.name}` : 'Not enough resources';
      this.lineInfo = { valid, afford };
    } else {
      const r = game.canPlace(P.type, cx, cz, P.rot, P.moveId);
      ok = r.ok && (P.moveId || game.canAfford(def.cost)); why = r.ok ? (ok ? '' : 'Not enough resources') : r.why;
    }
    const mat = ok ? MAT.ghostOk : MAT.ghostBad;
    this.ghost.traverse(o => { if (o.isMesh) o.material = mat; });
    this.hud.placingHint(ok, why);
    this.ghostOk = ok;
  }
  drawLine(cells, valid, afford) {
    if (this.lineTiles) this.stage.scene.remove(this.lineTiles);
    const g = new THREE.Group(), geo = new THREE.PlaneGeometry(PLOT.cell - 0.2, PLOT.cell - 0.2); geo.rotateX(-Math.PI / 2);
    const okSet = new Set(valid.slice(0, afford).map(c => c.join(',')));
    for (const [x, z] of cells) {
      const m = new THREE.Mesh(geo, okSet.has(x + ',' + z) ? MAT.ghostOk : MAT.ghostBad);
      const c = this.game.worldCenter(x, z, 1, 1); m.position.set(c.x, 0.08, c.z); g.add(m);
    }
    this.lineTiles = g; this.stage.scene.add(g);
  }
  countMarkable(cells) {
    const set = new Set(cells.map(c => c.join(','))), g = this.game;
    return g.nature.trees.filter(t => !t.removed && set.has(t.cx + ',' + t.cz)).length + g.nature.rocks.filter(r => !r.removed && set.has(r.cx + ',' + r.cz)).length;
  }
  commitPlacing(shift) {
    const P = this.placing, game = this.game, def = BUILDINGS[P.type];
    if (!this.lastCell) return;
    const [cx, cz] = this.lastCell;
    if (P.type === 'clear') {
      if (!P.lineStart) { P.lineStart = [cx, cz]; this.updateGhost(cx, cz); return; }
      const a = P.lineStart, n = game.markArea(Math.min(a[0], cx), Math.min(a[1], cz), Math.max(a[0], cx), Math.max(a[1], cz));
      P.lineStart = null; if (this.lineTiles) { this.stage.scene.remove(this.lineTiles); this.lineTiles = null; }
      this.hud.toast(n ? `${n} marked for clearing${game.idleVillagers().length ? ' — free villagers will see to it' : ' — make a villager unemployed or have one aid construction to clear them'}` : 'No trees or boulders there', n ? '' : 'warn');
      this.hud.placingHint(true, 'Click one corner of the next area, or Esc to finish');
      return;
    }
    if (P.moveId) {
      if (game.move(P.moveId, cx, cz, P.rot)) { this.hud.sound('place'); const id = P.moveId; this.cancelPlacing(); this.select({ kind: 'building', id }); }
      else this.hud.toast('Can’t move it there', 'warn');
      return;
    }
    if (def.line) {
      if (!P.lineStart) { P.lineStart = [cx, cz]; this.updateGhost(cx, cz); this.hud.placingHint(true, 'Now click where the line should end'); return; }
      const { valid, afford } = this.lineInfo || { valid: [], afford: 0 };
      let n = 0; for (const [x, z] of valid.slice(0, afford)) if (game.place(P.type, x, z, 0)) n++;
      if (n) this.hud.sound('place');
      // the line is done; the tool stays ready for the next one (Done / Esc to stop)
      if (this.lineTiles) { this.stage.scene.remove(this.lineTiles); this.lineTiles = null; }
      P.lineStart = null;
      this.updateGhost(cx, cz);
      this.hud.placingHint(true, n ? `Built ${n} — click (or drag) for the next line` : 'Click where the line should start, or drag to draw it');
      return;
    }
    if (!this.ghostOk) { this.hud.toast(this.hud.lastWhy || 'Can’t build here', 'warn'); return; }
    const b = game.place(P.type, cx, cz, P.rot);
    if (!b) return;
    this.hud.sound('place');
    const keep = shift || (def.size[0] * def.size[1] <= 2);
    if (!keep) { this.cancelPlacing(); this.select({ kind: 'building', id: b.id }); }
    else this.updateGhost(cx, cz);
  }

  /* ---------- selection ---------- */
  buildSelection() {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 24), MAT.select); ring.rotation.x = -Math.PI / 2; ring.visible = false;
    const frame = new THREE.Group(); frame.visible = false;
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), MAT.select); m.rotation.x = -Math.PI / 2; frame.add(m); }
    this.ring = ring; this.frame = frame;
    this.stage.scene.add(ring, frame);
  }
  select(sel) {
    this.selected = sel;
    this.frame.visible = false; this.ring.visible = false;
    if (sel && sel.kind === 'building' && !this.game.buildings.get(sel.id)) this.selected = null;
    if (sel && sel.kind === 'villager' && !this.game.villagers.get(sel.id)) this.selected = null;
    this.updateSelectionVisual();
    this.hud.onSelect(this.selected);
  }
  updateSelectionVisual() {
    const s = this.selected;
    if (!s) return;
    if (s.kind === 'building') {
      const b = this.game.buildings.get(s.id); if (!b) return this.select(null);
      const c = this.game.center(b), hw = b.w * PLOT.cell / 2 + 0.25, hd = b.d * PLOT.cell / 2 + 0.25, t = 0.3;
      const [a, bb, cc, dd] = this.frame.children;
      a.scale.set(hw * 2, t, 1); a.position.set(c.x, 0.1, c.z - hd);
      bb.scale.set(hw * 2, t, 1); bb.position.set(c.x, 0.1, c.z + hd);
      cc.scale.set(t, hd * 2, 1); cc.position.set(c.x - hw, 0.1, c.z);
      dd.scale.set(t, hd * 2, 1); dd.position.set(c.x + hw, 0.1, c.z);
      this.frame.visible = true;
    } else {
      const v = this.game.villagers.get(s.id); if (!v) return this.select(null);
      this.ring.position.set(v.pos.x, (v.elev || 0) + 0.06, v.pos.z); this.ring.visible = !v.hidden;
    }
  }

  /* ---------- events ---------- */
  bind() {
    const cv = this.canvas;
    cv.addEventListener('pointerdown', e => this.onDown(e));
    window.addEventListener('pointermove', e => this.onMove(e));
    window.addEventListener('pointerup', e => this.onUp(e));
    window.addEventListener('pointercancel', e => { this.pointers.delete(e.pointerId); this.down = null; });
    cv.addEventListener('wheel', e => this.onWheel(e), { passive: false });
    // Safari trackpad pinch
    cv.addEventListener('gesturestart', e => { e.preventDefault(); this.gScale = 1; });
    cv.addEventListener('gesturechange', e => { e.preventDefault(); const f = this.gScale / e.scale; this.gScale = e.scale; const v = window.tenkaView; (v && v.active ? v.cam : this.cam).zoom(f); });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
    window.addEventListener('blur', () => this.keys.clear());
  }
  onDown(e) {
    if (window.tenkaView && window.tenkaView.active) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) { // pinch/pan with two fingers
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mid: this.ground((a.x + b.x) / 2, (a.y + b.y) / 2) };
      this.down = null; return;
    }
    this.down = { x: e.clientX, y: e.clientY, g: this.ground(e.clientX, e.clientY), drag: false, shift: e.shiftKey, rot: e.altKey };
    // move mode: pressing on a building picks it up
    if (this.moveMode && !this.placing) {
      const p = this.pick(e.clientX, e.clientY);
      if (p && p.kind === 'building' && this.game.buildings.get(p.id)) {
        const b = this.game.buildings.get(p.id);
        this.startPlacing(b.type, b.id); this.down.grab = b.id;
        if (this.down.g) this.updateGhost(...this.cellFor(this.down.g, b.type, b.rot));
      }
    }
    // line tools: press and drag to draw a whole line at once
    const P = this.placing;
    if (P && !P.moveId && !P.lineStart && (P.type === 'clear' || BUILDINGS[P.type].line) && this.down.g) this.down.draw = this.cellFor(this.down.g, P.type, P.rot);
    try { this.canvas.setPointerCapture(e.pointerId); } catch (_) { /* optional */ }
  }
  onMove(e) {
    if (window.tenkaView && window.tenkaView.active) return;
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 0 && this.pinch.d > 0) this.cam.zoom(this.pinch.d / d);
      this.pinch.d = d;
      const mid = this.ground((a.x + b.x) / 2, (a.y + b.y) / 2);
      if (mid && this.pinch.mid) { this.cam.pan(this.pinch.mid.x - mid.x, this.pinch.mid.z - mid.z); this.cam.apply(); }
      return;
    }
    const D = this.down;
    if (D && e.target === this.canvas || D) {
      if (D && !D.drag && Math.hypot(e.clientX - D.x, e.clientY - D.y) > 7) {
        D.drag = true;
        if (D.draw && this.placing) { this.placing.lineStart = D.draw; this.hud.placingHint(true, 'Let go where the line should end'); }
      }
      // Option/Alt + drag turns the camera
      if (D && D.drag && D.rot && !this.placing) { this.cam.rotate(-(e.clientX - (D.lx ?? D.x)) * 0.008); D.lx = e.clientX; return; }
      if (D && D.drag && (D.grab || D.draw) && this.placing) {
        const g = this.ground(e.clientX, e.clientY); if (!g) return;
        const [cx, cz] = this.cellFor(g, this.placing.type, this.placing.rot);
        if (!this.lastCell || this.lastCell[0] !== cx || this.lastCell[1] !== cz) this.updateGhost(cx, cz);
        return;
      }
      if (D && D.drag && D.g) {
        const g = this.ground(e.clientX, e.clientY);
        if (g) { this.cam.pan(D.g.x - g.x, D.g.z - g.z); this.cam.apply(); }
        return;
      }
    }
    if (this.placing && e.target === this.canvas) {
      const g = this.ground(e.clientX, e.clientY); if (!g) return;
      const [cx, cz] = this.cellFor(g, this.placing.type, this.placing.rot);
      if (!this.lastCell || this.lastCell[0] !== cx || this.lastCell[1] !== cz) this.updateGhost(cx, cz);
    } else if (e.target === this.canvas && !D) {
      const p = this.pick(e.clientX, e.clientY);
      this.canvas.style.cursor = p ? 'pointer' : 'grab';
    }
  }
  onUp(e) {
    if (window.tenkaView && window.tenkaView.active) return;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    const D = this.down; this.down = null;
    if (D && D.grab) { // drop the building we picked up
      const P = this.placing;
      if (D.drag && P && this.lastCell) {
        if (this.game.move(P.moveId, this.lastCell[0], this.lastCell[1], P.rot)) this.hud.sound('place');
        else this.hud.toast(this.hud.lastWhy || 'Can’t move it there', 'warn');
      }
      this.cancelPlacing();
      return;
    }
    if (D && D.draw && D.drag && this.placing) { this.commitPlacing(false); return; }
    if (!D || D.drag || e.target !== this.canvas) return;
    if (this.placing) {
      const g = this.ground(e.clientX, e.clientY);
      if (g) this.updateGhost(...this.cellFor(g, this.placing.type, this.placing.rot));
      this.commitPlacing(e.shiftKey || D.shift);
      return;
    }
    this.select(this.pick(e.clientX, e.clientY));
  }
  onWheel(e) {
    e.preventDefault();
    if (window.tenkaView && window.tenkaView.active) return;
    if (e.ctrlKey) { this.cam.zoom(Math.exp(e.deltaY * 0.012)); return; } // pinch on most browsers
    // scrolling (mouse wheel or two fingers on a trackpad) zooms, unless the player switched it to panning
    // a sideways two-finger swipe turns the camera
    if (!this.hud.settings.scrollPans && Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.5) { this.cam.rotate(e.deltaX * 0.004); return; }
    if (!this.hud.settings.scrollPans) { const d = Math.max(-120, Math.min(120, e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY)); this.cam.zoom(Math.exp(d * 0.0025)); return; }
    // two-finger trackpad scroll pans the map
    const k = this.cam.dist * 0.0022, f = this.cam.forward(), r = this.cam.right();
    this.cam.pan((r.x * e.deltaX - f.x * e.deltaY) * k, (r.z * e.deltaX - f.z * e.deltaY) * k);
  }
  onKey(e, down) {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (down) this.keys.add(k); else this.keys.delete(k);
    if (!down || e.metaKey || e.ctrlKey) return;
    if (k.startsWith('arrow') || k === ' ') e.preventDefault();
    this.hud.onKey(k, e);
  }
}
