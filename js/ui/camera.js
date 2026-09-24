// Strategy camera: orbit around a ground target; tilts lower as you zoom in.
import * as THREE from 'three';
import { clamp, lerp } from '../util.js';

export const ZOOM_MIN = 12, ZOOM_MAX = 160;

export class RTSCamera {
  constructor(camera, bounds = { x0: -75, x1: 75, z0: -75, z1: 75 }, zoom = [ZOOM_MIN, ZOOM_MAX]) {
    this.cam = camera; this.bounds = bounds; this.zmin = zoom[0]; this.zmax = zoom[1];
    this.target = new THREE.Vector3((bounds.x0 + bounds.x1) / 2, 0, (bounds.z0 + bounds.z1) / 2 + 4);
    this.yaw = 0.6; this.goalYaw = 0.6;
    this.dist = 70; this.goalDist = 58;
    this.follow = null; // optional {x,z} getter
    this.apply();
  }
  get pitch() { return lerp(0.5, 1.12, clamp((this.dist - this.zmin) / (this.zmax - this.zmin), 0, 1)); }
  forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  right() { return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
  zoom(f) { this.goalDist = clamp(this.goalDist * f, this.zmin, this.zmax); }
  rotate(a) { this.goalYaw += a; }
  pan(dx, dz) { this.target.x += dx; this.target.z += dz; this.clampTarget(); this.follow = null; }
  clampTarget() { const b = this.bounds; this.target.x = clamp(this.target.x, b.x0, b.x1); this.target.z = clamp(this.target.z, b.z0, b.z1); }
  update(dt, keys) {
    const sp = this.dist * 0.9 * dt;
    const f = this.forward(), r = this.right();
    let mx = 0, mz = 0;
    if (keys.has('w') || keys.has('arrowup')) { mx += f.x; mz += f.z; }
    if (keys.has('s') || keys.has('arrowdown')) { mx -= f.x; mz -= f.z; }
    if (keys.has('d') || keys.has('arrowright')) { mx += r.x; mz += r.z; }
    if (keys.has('a') || keys.has('arrowleft')) { mx -= r.x; mz -= r.z; }
    if (mx || mz) this.pan(mx * sp, mz * sp);
    if (keys.has('q')) this.goalYaw += 1.5 * dt;
    if (keys.has('e')) this.goalYaw -= 1.5 * dt;
    if (keys.has('=') || keys.has('+') || keys.has('x')) this.zoom(1 - dt * 1.5);
    if (keys.has('-') || keys.has('z')) this.zoom(1 + dt * 1.5);
    if (this.follow) { const p = this.follow(); if (p) { this.target.x += (p.x - this.target.x) * Math.min(1, dt * 4); this.target.z += (p.z - this.target.z) * Math.min(1, dt * 4); } }
    this.dist += (this.goalDist - this.dist) * Math.min(1, dt * 8);
    this.yaw += (this.goalYaw - this.yaw) * Math.min(1, dt * 8);
    this.apply();
  }
  apply() {
    const p = this.pitch, c = Math.cos(p) * this.dist;
    this.cam.position.set(this.target.x + Math.sin(this.yaw) * c, this.target.y + Math.sin(p) * this.dist, this.target.z + Math.cos(this.yaw) * c);
    this.cam.lookAt(this.target);
    this.cam.updateMatrixWorld();
  }
}
