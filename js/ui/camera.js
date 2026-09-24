// Strategy camera: orbit around a ground target; tilts lower as you zoom in.
import * as THREE from 'three';
import { clamp, lerp } from '../util.js';

export const ZOOM_MIN = 12, ZOOM_MAX = 160;

export class RTSCamera {
  constructor(camera) {
    this.cam = camera;
    this.target = new THREE.Vector3(0, 0, 4);
    this.yaw = 0.6; this.goalYaw = 0.6;
    this.dist = 70; this.goalDist = 58;
    this.follow = null; // optional {x,z} getter
    this.apply();
  }
  get pitch() { return lerp(0.5, 1.12, clamp((this.dist - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN), 0, 1)); }
  forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  right() { return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
  zoom(f) { this.goalDist = clamp(this.goalDist * f, ZOOM_MIN, ZOOM_MAX); }
  rotate(a) { this.goalYaw += a; }
  pan(dx, dz) { this.target.x += dx; this.target.z += dz; this.clampTarget(); this.follow = null; }
  clampTarget() { this.target.x = clamp(this.target.x, -75, 75); this.target.z = clamp(this.target.z, -75, 75); }
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
