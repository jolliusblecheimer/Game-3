// Renders small portraits of every building and villager type (used as UI art).
import * as THREE from 'three';
import { buildModel } from './buildings.js';
import { Person, LOOKS } from './people.js';
import { BUILDINGS } from '../game/data.js';
import { PLOT } from './nature.js';

export const THUMBS = { building: {}, person: {} };

export function renderThumbs(size = 192) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch (e) { return THUMBS; } // no WebGL for thumbnails — UI falls back to kanji
  renderer.setPixelRatio(1); renderer.setSize(size, size, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff6e6', '#6d7d55', 1.3));
  const sun = new THREE.DirectionalLight('#fff1db', 2.4); sun.position.set(4, 8, 6); scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const box = new THREE.Box3(), sphere = new THREE.Sphere();

  const shoot = (obj, yaw = 0.7, pitch = 0.5, pad = 1.08, frame = null) => {
    scene.add(obj);
    box.setFromObject(obj); box.getBoundingSphere(sphere);
    const dist = frame ? frame.dist : sphere.radius * pad / Math.sin((cam.fov * Math.PI / 180) / 2);
    const c = frame ? frame.center : sphere.center;
    cam.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * dist, c.y + Math.sin(pitch) * dist, c.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    cam.lookAt(c);
    renderer.render(scene, cam);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(obj);
    obj.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    return url;
  };

  for (const [type, d] of Object.entries(BUILDINGS)) {
    const [a, b] = d.size;
    const conn = ['wall', 'palisade', 'hedge', 'road', 'stoneroad'].includes(type) ? { e: true, w: true } : null;
    const model = buildModel(type, a * PLOT.cell, b * PLOT.cell, 3, conn);
    const pitch = d.h < 2 ? 0.75 : 0.45;
    THUMBS.building[type] = shoot(model, 0.65, pitch, d.h < 2 ? 1.0 : 1.05);
  }
  for (const look of Object.keys(LOOKS)) {
    const p = new Person(look, 11);
    p.animate(0, 'idle');
    THUMBS.person[look] = shoot(p.group, 0.45, 0.1, 1, { center: new THREE.Vector3(0, 1.55 + (LOOKS[look].horse ? 0.62 : 0), 0), dist: 3.1 });
  }
  renderer.dispose();
  try { renderer.forceContextLoss(); } catch (_) { /* fine */ }
  return THUMBS;
}
