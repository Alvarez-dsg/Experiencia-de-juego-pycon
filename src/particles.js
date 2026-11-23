// Sistema de partículas sencillo con InstancedMesh (1 draw call para todas).
import * as THREE from 'three';
import { riseClip } from './models.js';
import { surfaceAt } from './terrain.js';

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();

export class Particles {
  constructor(max = 700) {
    this.max = max;
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshLambertMaterial({ flatShading: true, clippingPlanes: [riseClip] });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    const c = new THREE.Color();
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, c);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.list = [];
    this.pool = [];
  }

  emit({ pos, vel = [0, 0, 0], color = '#ffffff', size = 0.003, life = 0.8, grav = -0.6, drag = 1.2, grow = 0, floor = true }) {
    if (this.list.length >= this.max) return;
    const p = this.pool.pop() || { p: new THREE.Vector3(), v: new THREE.Vector3(), c: new THREE.Color(), r: new THREE.Vector3(), w: new THREE.Vector3() };
    p.p.set(pos[0] ?? pos.x, pos[1] ?? pos.y, pos[2] ?? pos.z);
    p.v.set(vel[0], vel[1], vel[2]);
    p.c.set(color);
    p.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    p.w.set(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5);
    p.size = size;
    p.life = p.max = life;
    p.grav = grav;
    p.drag = drag;
    p.grow = grow;
    p.floor = floor;
    this.list.push(p);
  }

  burst({ pos, n = 10, colors = ['#ffffff'], speed = 0.2, up = 0.6, size = 0.003, life = 0.7, grav = -0.7, drag = 1.4, grow = 0, spread = 1, floor = true }) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.emit({
        pos,
        vel: [Math.cos(a) * s * spread, (up + Math.random() * 0.6) * speed, Math.sin(a) * s * spread],
        color: colors[Math.floor(Math.random() * colors.length)],
        size: size * (0.6 + Math.random() * 0.8),
        life: life * (0.6 + Math.random() * 0.7),
        grav,
        drag,
        grow,
        floor,
      });
    }
  }

  smoke(pos, { color = '#7d7d7d', size = 0.004, n = 1, rise = 0.05, life = 1.6 } = {}) {
    for (let i = 0; i < n; i++) {
      this.emit({
        pos: [pos.x + (Math.random() - 0.5) * 0.004, pos.y, pos.z + (Math.random() - 0.5) * 0.004],
        vel: [0.006 + Math.random() * 0.01, rise * (0.7 + Math.random() * 0.6), (Math.random() - 0.5) * 0.01],
        color,
        size,
        life,
        grav: 0.004,
        drag: 0.4,
        grow: 2.2,
        floor: false,
      });
    }
  }

  clear() {
    this.pool.push(...this.list);
    this.list.length = 0;
    this.mesh.count = 0;
  }

  update(dt) {
    let k = 0;
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) {
        list[i] = list[list.length - 1];
        list.pop();
        this.pool.push(p);
        continue;
      }
      p.v.y += p.grav * dt;
      p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.p.addScaledVector(p.v, dt);
      // el suelo se consulta solo cuando la partícula baja cerca de él
      const floorY = p.floor && p.v.y < 0 && p.p.y < 0.03 ? surfaceAt(p.p.x, p.p.z) : -Infinity;
      if (p.p.y < floorY + p.size * 0.5) {
        p.p.y = floorY + p.size * 0.5;
        p.v.y *= -0.3;
        p.v.x *= 0.6;
        p.v.z *= 0.6;
        p.w.multiplyScalar(0.8);
      }
      p.r.addScaledVector(p.w, dt);
      const t = 1 - p.life / p.max;
      const fade = Math.min(1, (p.life / p.max) * 4);
      const sc = p.size * (1 + p.grow * t) * fade;
      _q.setFromEuler(_e.set(p.r.x, p.r.y, p.r.z));
      _m.compose(p.p, _q, _s.set(sc, sc, sc));
      this.mesh.setMatrixAt(k, _m);
      this.mesh.setColorAt(k, p.c);
      k++;
    }
    this.mesh.count = k;
    if (k > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.instanceColor.needsUpdate = true;
    }
  }
}
