// Lógica del juego: defensores en la isla, invasores que llegan de forma radial cruzando el río,
// gotas de agua que trae la corriente, el Mangle madre, niveles, tutorial y gestos con la mano.
import * as THREE from 'three';
import { LAYOUT, PLANTS, ENEMIES, ECONOMY, HAND, TEAM, ISLAND } from './config.js';
import { makeLevel, LEVELS } from './levels.js';
import { MATS, U, createOrb, createShadow, PROJ, PROJ_HIT } from './models.js';
import { createEnemy, exhaustOf, chipsOf } from './invaders.js';
import { createDefender, setDefenderMat, plantGeometry, MUZZLE } from './defenders.js';
import { MARIPOSA_BUG_Y } from './animals.js';
import { CELL, ROWS, COLS, LAND_Y, WATER_Y, colX, rowZ, groundAt, surfaceAt, regionAt, depthAt, HEART, LAND } from './terrain.js';
import { Tutorial } from './tutorial.js';
import { sfx } from './audio.js';

const L = LAYOUT;
const TOP = LAND_Y;
const PROJ_SPEED = 4.2 * CELL; // m/s
const HEART_DMG = 0.5; // fracción del daño de los invasores que recibe el Mangle madre
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const easeOutBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
const _v = new THREE.Vector3();
/** Giro (rotation.y) para que un modelo que mira a +x mire hacia (dx, dz). */
const yawTo = (dx, dz) => Math.atan2(-dz, dx);
const angLerp = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
const DEEP = 0.55;

/** z de una gota del brazo de adelante: a `off` de la arena de la isla (sigue su contorno). */
function frontDropZ(x, off) {
  const u = Math.min(1, Math.abs(x - ISLAND.cx) / ISLAND.sandA);
  const edge = ISLAND.cz + ISLAND.sandB * Math.sqrt(1 - u * u);
  return Math.min(0.3, Math.max(edge, 0.245) + off);
}

export class Game {
  constructor(board, fx) {
    this.board = board;
    this.fx = fx;
    this.layer = new THREE.Group();
    board.content.add(this.layer);
    this.on = { banner: () => {}, end: () => {}, collectTarget: (out) => out.set(0, 0.2, -0.3) };
    this.state = 'idle';
    this.team = [...TEAM.default];
    this.plants = [];
    this.enemies = [];
    this.projectiles = [];
    this.grenades = [];
    this.orbs = [];
    this.fading = [];
    this.tut = null;
    this.setLevel(1);
    this.reset();
  }

  // ───────────────────────── estado ─────────────────────────
  setLevel(i) {
    this.levelIdx = Math.max(0, Math.min(LEVELS.length - 1, i));
    this.level = makeLevel(this.levelIdx);
  }

  get isLastLevel() {
    return this.levelIdx >= LEVELS.length - 1;
  }
  get isTutorial() {
    return !!this.level.tutorial;
  }
  get heartFrac() {
    return Math.max(0, this.heartHp / ISLAND.heartHp);
  }

  reset() {
    for (const p of this.plants) this.layer.remove(p.root, p.shadow);
    for (const e of this.enemies) this.layer.remove(e.m.root, e.m.shadow);
    for (const p of this.projectiles) this.layer.remove(p.mesh);
    for (const g of this.grenades) this.layer.remove(g.mesh);
    for (const o of this.orbs) this.layer.remove(o.group);
    for (const f of this.fading) this.layer.remove(f.obj);
    this.plants = [];
    this.enemies = [];
    this.projectiles = [];
    this.grenades = [];
    this.orbs = [];
    this.fading = [];
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.water = this.level.startWater ?? ECONOMY.startWater;
    this.time = 0;
    this.spawnIdx = 0;
    this.bannerIdx = 0;
    this.nextDrop = ECONOMY.firstDrop;
    this.cool = {};
    for (const k in PLANTS) this.cool[k] = 0;
    this.pushCool = 0;
    this.endTimer = 0;
    this.kills = 0;
    this.heartHp = ISLAND.heartHp;
    this.heartHitT = 0;
    this.board.setHeart(1);
    this.fx.clear();
    this.tut = null;
    this.state = 'idle';
  }

  /** ¿Se puede plantar en la fila r en este nivel? (al principio solo 2 filas; se abre una más por nivel) */
  rowOpen(r) {
    const rows = this.level?.rows;
    return !rows || rows.includes(r);
  }

  /** Empieza (o reinicia) el nivel `i` con el equipo actual. */
  start(i = this.levelIdx) {
    this.setLevel(i);
    this.reset();
    this.board.setRows?.(this.level.rows);
    if (this.level.tutorial) this.tut = new Tutorial(this);
    this.state = 'playing';
  }
  pause() {
    if (this.state === 'playing') this.state = 'paused';
  }
  resume() {
    if (this.state === 'paused') this.state = 'playing';
  }
  get progress() {
    if (this.tut) return this.tut.progress;
    return Math.min(1, this.time / this.level.last);
  }
  // compatibilidad: algunos módulos aún dicen "luz"
  get luz() {
    return this.water;
  }

  /** null si se puede usar; si no, el motivo. */
  whyCantPlant(type) {
    if (this.state !== 'playing') return 'state';
    if (this.cool[type] > 0) return 'cool';
    if (this.water < PLANTS[type].cost) return 'agua';
    return null;
  }

  /** null si se puede plantar en (r, c); si no, el motivo. */
  whyCantCell(r, c) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS || !LAND[r][c]) return 'arena';
    if (!this.rowOpen(r)) return 'cerrada';
    if (this.grid[r][c]) return 'ocupada';
    return null;
  }

  /** Tutorial: asegura que haya al menos `n` de agua. */
  giveWater(n) {
    if (this.water < n) {
      this.water = n;
      this.on.waterGained?.();
    }
  }

  emit(evt, data) {
    this.tut?.event(evt, data);
  }

  // ───────────────────────── defensores ─────────────────────────
  plant(type, r, c) {
    const def = PLANTS[type];
    if (def.kind === 'grenade' || this.whyCantPlant(type) || this.whyCantCell(r, c)) return false;
    this.water -= def.cost;
    this.cool[type] = def.cooldown;
    const d = createDefender(type);
    const root = d.root;
    const x = colX(c);
    const z = rowZ(r);
    root.position.set(x, TOP - 0.0005, z);
    // en reposo miran al usuario, un poco hacia afuera de la isla
    const idleYaw = -Math.PI / 2 + Math.sign(x - HEART.x || 1) * 0.35 + rand(-0.12, 0.12);
    root.rotation.y = idleYaw;
    root.scale.setScalar(0.01);
    const sr = { ceiba: 0.036, anaconda: 0.03, achiote: 0.03, tortuga: 0.03, chiguiro: 0.03 }[type] ?? 0.026;
    const shadow = createShadow(sr);
    shadow.position.set(x, TOP + 0.0006, z);
    this.layer.add(root, shadow);
    const p = {
      type,
      def,
      r,
      c,
      x,
      z,
      hp: def.hp,
      d,
      root,
      shadow,
      shadowR: sr,
      yaw: idleYaw,
      idleYaw,
      aimYaw: idleYaw,
      aimT: 0,
      age: 0,
      phase: Math.random() * 6,
      fireT: 0.2,
      prodT: def.firstProduce ?? 0,
      trap: 'ready',
      trapT: 0,
      prey: null,
      squash: 0,
      st: 'idle',
      stT: 0,
      px: x, // posición del mono o la tortuga cuando salen de su casilla
      pz: z,
      away: false,
      flapT: def.flapEvery ?? 0,
      biteT: 0,
      lunge: 0,
      alive: true,
    };
    this.plants.push(p);
    this.grid[r][c] = p;
    this.fx.burst({ pos: [x, TOP + 0.006, z], n: 16, colors: ['#3fa34d', '#7bc96f', '#2e7d32', '#a5d66f'], speed: 0.22, size: 0.0032, life: 0.6, grav: -0.9 });
    sfx.plant();
    this.emit('plant', { type, r, c });
    return true;
  }

  dig(r, c) {
    const p = this.grid[r]?.[c];
    if (!p) return false;
    this.removePlant(p, 'dug');
    return true;
  }

  removePlant(p, how) {
    if (!p.alive) return;
    p.alive = false;
    if (this.grid[p.r][p.c] === p) this.grid[p.r][p.c] = null;
    this.plants.splice(this.plants.indexOf(p), 1);
    this.layer.remove(p.shadow);
    this.fading.push({ obj: p.root, t: 0, dur: 0.35, kind: 'shrink' });
    const pos = [p.root.position.x, TOP + 0.02, p.root.position.z];
    if (how === 'eaten' || how === 'crushed') {
      this.fx.burst({ pos, n: 18, colors: ['#2e7d32', '#6d4c2f', '#a5d66f', '#8d6e4a'], speed: 0.25, size: 0.0035, life: 0.8 });
      sfx.eaten();
    } else if (how === 'dug') {
      this.fx.burst({ pos, n: 12, colors: ['#6d4c2f', '#8d6e4a'], speed: 0.18, size: 0.003, life: 0.6 });
      sfx.plant();
    }
  }

  /** Invasor vivo más peligroso (el más cercano al Mangle madre) a menos de `range` casillas de (x, z). */
  findEnemy(x, z, range, { deep = false, minDist = 0 } = {}) {
    let best = null;
    let bestH = Infinity;
    const R = range * CELL;
    for (const e of this.enemies) {
      if (!e.alive || (!deep && e.deep)) continue;
      const d = Math.hypot(e.x - x, e.z - z) - e.def.rad * CELL * 0.5;
      if (d > R || d < minDist * CELL) continue;
      const h = Math.hypot(e.x - HEART.x, e.z - HEART.z);
      if (h < bestH) {
        bestH = h;
        best = e;
      }
    }
    return best;
  }

  /** Mira hacia un punto durante un rato (después vuelve a mirar al usuario). */
  aim(p, x, z, hold = 2.2) {
    p.aimYaw = yawTo(x - p.x, z - p.z);
    p.aimT = hold;
  }

  updatePlant(p, dt, playing) {
    p.age += dt;
    const root = p.root;
    const d = p.d;
    const grow = Math.min(1, p.age / 0.35);
    let sx = easeOutBack(grow);
    let sy = sx;
    p.squash = Math.max(0, p.squash - dt * 5);
    sy *= 1 - p.squash * 0.12 + Math.sin(p.age * 2.4 + p.phase) * 0.015;
    sx *= 1 + p.squash * 0.1;
    root.rotation.z = Math.sin(p.age * 1.6 + p.phase) * 0.035;
    const def = p.def;
    let lunge = 0;
    let lift = 0;
    p.aimT -= dt;

    switch (def.kind) {
      case 'shooter': {
        if (!playing) break;
        p.fireT = Math.max(0, p.fireT - dt);
        const t = this.findEnemy(p.x, p.z, def.range);
        if (t) this.aim(p, t.x, t.z, 1.5);
        if (p.fireT === 0 && t && Math.abs(angLerp(p.yaw, p.aimYaw, 1) - p.yaw) < 0.5) {
          this.fire(p, t);
          p.fireT = def.fireEvery;
        }
        break;
      }

      case 'producer':
        if (!playing) break;
        p.prodT -= dt;
        if (p.prodT < 1) sy *= 1 + Math.sin(p.age * 20) * 0.04 * (1 - Math.max(0, p.prodT));
        if (p.prodT <= 0) {
          p.prodT = def.produceEvery * rand(0.9, 1.1);
          this.spawnDew(p);
          p.squash = 1;
        }
        break;

      case 'healer': {
        const fl = 0.5 + 0.5 * Math.sin(p.age * 13);
        d.wingL.rotation.x = -(0.15 + fl * 0.95);
        d.wingR.rotation.x = 0.15 + fl * 0.95;
        d.bug.position.y = (MARIPOSA_BUG_Y + 0.05 * Math.sin(p.age * 2.6)) * U;
        d.bug.rotation.y = Math.sin(p.age * 0.9) * 0.3;
        if (!playing) break;
        p.flapT -= dt;
        if (p.flapT <= 0) {
          p.flapT = def.flapEvery;
          this.heal(p);
        }
        break;
      }

      case 'biter': {
        p.biteT = Math.max(0, p.biteT - dt);
        p.lunge = Math.max(0, p.lunge - dt * 4);
        lunge = Math.sin(p.lunge * Math.PI) * 0.18;
        if (!playing) break;
        const prey = this.findEnemy(p.x, p.z, def.reach + 0.3, { deep: true });
        if (prey) this.aim(p, prey.x, prey.z, 1);
        if (prey && p.biteT === 0) {
          p.biteT = def.biteEvery;
          p.lunge = 1;
          this.hitEnemy(prey, def.damage, 0, 'bite');
          this.fx.burst({ pos: [prey.x, TOP + 0.02, prey.z], n: 6, colors: ['#fffbe8', '#c9a06a', '#8b5e3c'], speed: 0.15, size: 0.0024, life: 0.4 });
          sfx.bite();
        }
        break;
      }

      case 'leaper':
        if (playing) this.updateLeaper(p, dt);
        if (p.st === 'jump' || p.st === 'back') {
          const k = clamp01(p.stT / def.jumpTime);
          lift = Math.sin(k * Math.PI) * 0.9 * CELL;
          root.rotation.z = -Math.sin(k * Math.PI) * 0.5;
          sy *= 1 + Math.sin(k * Math.PI) * 0.12;
        } else if (p.st === 'land') sy *= 0.85;
        break;

      case 'roller':
        if (playing) this.updateRoller(p, dt);
        if (p.st === 'hide') {
          const k = clamp01(p.stT / 0.25);
          d.body.scale.set(1 - k * 0.3, 1 - k * 0.7, 1 - k * 0.3);
        } else if (p.st === 'unhide') {
          const k = clamp01(p.stT / 0.3);
          d.body.scale.set(0.7 + k * 0.3, 0.3 + k * 0.7, 0.7 + k * 0.3);
        }
        break;

      case 'trap':
        if (!playing) break;
        this.updateTrap(p, dt);
        if (p.trap === 'strike') lunge = Math.sin(clamp01(p.trapT / def.windup) * Math.PI) * 0.55;
        else if (p.trap === 'digest') {
          const bulge = 0.12 + Math.sin(p.age * 3) * 0.03;
          sx *= 1 + bulge;
          sy *= 1 - bulge * 0.4;
        }
        if (lunge) sx *= 1 + lunge * 0.45;
        break;
    }

    // giro suave: hacia el objetivo o, en reposo, hacia el usuario
    if (!(def.kind === 'roller' && p.away)) {
      p.yaw = angLerp(p.yaw, p.aimT > 0 ? p.aimYaw : p.idleYaw, Math.min(1, dt * 7));
      root.rotation.y = p.yaw;
    }
    const fx = Math.cos(p.yaw);
    const fz = -Math.sin(p.yaw);
    if (p.away) {
      root.position.x = p.px;
      root.position.z = p.pz;
      root.position.y = Math.max(groundAt(p.px, p.pz), def.kind === 'roller' ? WATER_Y - 0.004 : WATER_Y) + lift;
    } else {
      root.position.x = p.x + fx * lunge * CELL;
      root.position.z = p.z + fz * lunge * CELL;
      root.position.y = TOP - 0.0005 + lift;
    }
    p.shadow.position.set(root.position.x, (p.away ? surfaceAt(p.px, p.pz) : TOP) + 0.0006, root.position.z);
    p.shadow.scale.setScalar(p.shadowR * (lift ? 1 - Math.min(0.6, lift / CELL) : 1));
    root.scale.set(sx, sy, sx);
    setDefenderMat(d, p.hp < def.hp * 0.35 ? MATS.hurt : MATS.std);
  }

  fire(p, target) {
    const kind = p.def.projectile;
    const mz = MUZZLE[p.type] || [0.3, 0.3];
    const base = yawTo(target.x - p.x, target.z - p.z);
    const x = p.x + Math.cos(base) * mz[0] * U;
    const z = p.z - Math.sin(base) * mz[0] * U;
    const y = TOP + mz[1] * U;
    const n = p.def.spread || 1;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.28;
      const mesh = new THREE.Mesh(PROJ[kind].geo, PROJ[kind].mat);
      mesh.position.set(x, y, z);
      this.layer.add(mesh);
      this.projectiles.push({ mesh, kind, x, z, vx: Math.cos(a) * PROJ_SPEED, vz: -Math.sin(a) * PROJ_SPEED, dist: 0, max: (p.def.range + 0.8) * CELL, dmg: p.def.damage, slow: p.def.slowTime || 0 });
    }
    p.squash = 1;
    sfx.shoot(p.type);
  }

  heal(p) {
    let any = false;
    for (const q of this.plants) {
      if (q === p || !q.alive || q.hp >= q.def.hp) continue;
      if (Math.hypot(q.c - p.c, q.r - p.r) > p.def.radius) continue;
      q.hp = Math.min(q.def.hp, q.hp + p.def.heal);
      any = true;
      for (let i = 0; i < 3; i++) {
        this.fx.emit({ pos: [q.x + rand(-0.012, 0.012), TOP + 0.015 + rand(0, 0.02), q.z + rand(-0.012, 0.012)], vel: [0, 0.05, 0], color: i ? '#9cff8a' : '#ffffff', size: 0.0026, life: 0.7, grav: 0.05, drag: 1 });
      }
    }
    const bp = p.root.position;
    this.fx.emit({ pos: [bp.x, bp.y + MARIPOSA_BUG_Y * U, bp.z], vel: [rand(-0.03, 0.03), -0.02, rand(-0.03, 0.03)], color: '#7fc4ff', size: 0.0022, life: 0.8, grav: -0.02 });
    if (any) sfx.heal();
  }

  /** Mono: salta al invasor (nunca a lo hondo), lo golpea y vuelve de otro salto. */
  updateLeaper(p, dt) {
    const def = p.def;
    p.stT += dt;
    if (p.st === 'idle') {
      p.px = p.x;
      p.pz = p.z;
      const prey = this.findEnemy(p.x, p.z, def.range, { minDist: 0.2 });
      if (prey) {
        p.st = 'jump';
        p.stT = 0;
        p.prey = prey;
        const dx = prey.x - p.x;
        const dz = prey.z - p.z;
        const len = Math.hypot(dx, dz) || 1;
        const stop = Math.max(0.3 * CELL, len - (prey.def.rad + 0.15) * CELL);
        p.from = [p.x, p.z];
        p.to = [p.x + (dx / len) * stop, p.z + (dz / len) * stop];
        p.away = true;
        this.aim(p, prey.x, prey.z, 3);
        sfx.jump();
      }
    } else if (p.st === 'jump') {
      const k = clamp01(p.stT / def.jumpTime);
      p.px = lerp(p.from[0], p.to[0], k);
      p.pz = lerp(p.from[1], p.to[1], k);
      if (k >= 1) {
        const prey = p.prey?.alive && !p.prey.deep && Math.hypot(p.prey.x - p.px, p.prey.z - p.pz) < CELL * 1.1 ? p.prey : this.findEnemy(p.px, p.pz, 0.9);
        if (prey) {
          this.hitEnemy(prey, def.damage, 0, 'punch');
          prey.stunT = Math.max(prey.stunT, 0.3);
          this.fx.burst({ pos: [prey.x, TOP + 0.03, prey.z], n: 10, colors: ['#ffe17a', '#ffffff', '#c9955a'], speed: 0.2, size: 0.003, life: 0.4 });
          sfx.impact(false);
        }
        if (regionAt(p.px, p.pz) === 'water') this.splash(p.px, p.pz, 6);
        p.st = 'land';
        p.stT = 0;
        p.squash = 1;
      }
    } else if (p.st === 'land') {
      if (p.stT > 0.18) {
        p.st = 'back';
        p.stT = 0;
        p.from = [p.px, p.pz];
        p.to = [p.x, p.z];
        this.aim(p, p.x, p.z, def.jumpTime + 0.3);
        sfx.jump();
      }
    } else if (p.st === 'back') {
      const k = clamp01(p.stT / def.jumpTime);
      p.px = lerp(p.from[0], p.to[0], k);
      p.pz = lerp(p.from[1], p.to[1], k);
      if (k >= 1) {
        p.st = 'rest';
        p.stT = 0;
        p.away = false;
        p.squash = 1;
      }
    } else if (p.st === 'rest') {
      if (p.stT >= def.rest) p.st = 'idle';
    }
  }

  /** Tortuga: se mete en el caparazón, rueda (o nada, también por lo hondo), golpea en área y regresa. */
  updateRoller(p, dt) {
    const def = p.def;
    const d = p.d;
    p.stT += dt;
    if (p.st === 'idle') {
      p.px = p.x;
      p.pz = p.z;
      const prey = this.findEnemy(p.x, p.z, def.range, { deep: true, minDist: 0.2 });
      if (prey) {
        p.st = 'hide';
        p.stT = 0;
        p.prey = prey;
        this.aim(p, prey.x, prey.z, 1);
      }
    } else if (p.st === 'hide') {
      if (p.stT >= 0.25) {
        p.st = 'roll';
        p.stT = 0;
        p.away = true;
        p.travel = 0;
        d.body.visible = false;
        d.shell.visible = true;
        sfx.roll();
      }
    } else if (p.st === 'roll') {
      const tx = p.prey?.alive ? p.prey.x : p.px + Math.cos(p.yaw) * CELL;
      const tz = p.prey?.alive ? p.prey.z : p.pz - Math.sin(p.yaw) * CELL;
      p.yaw = angLerp(p.yaw, yawTo(tx - p.px, tz - p.pz), Math.min(1, dt * 8));
      p.root.rotation.y = p.yaw;
      const step = def.rollSpeed * CELL * dt;
      p.px += Math.cos(p.yaw) * step;
      p.pz -= Math.sin(p.yaw) * step;
      p.travel += step;
      d.shell.rotation.z -= def.rollSpeed * 4 * dt;
      const wet = regionAt(p.px, p.pz) === 'water';
      if (Math.random() < dt * 25) {
        if (wet) this.splash(p.px, p.pz, 1);
        else this.fx.emit({ pos: [p.px, TOP + 0.002, p.pz], vel: [rand(-0.04, 0.04), 0.06, rand(-0.04, 0.04)], color: '#8d6e4a', size: 0.0022, life: 0.4 });
      }
      const hit = this.enemies.some((e) => e.alive && Math.hypot(e.x - p.px, e.z - p.pz) < (e.def.rad + 0.25) * CELL);
      if (hit || p.travel >= (def.range + 0.5) * CELL) {
        this.rollerImpact(p);
        p.st = 'back';
        p.stT = 0;
      }
    } else if (p.st === 'back') {
      const dx = p.x - p.px;
      const dz = p.z - p.pz;
      const len = Math.hypot(dx, dz);
      const step = def.backSpeed * CELL * dt;
      p.yaw = yawTo(-dx, -dz); // rueda de espaldas
      p.root.rotation.y = p.yaw;
      d.shell.rotation.z += def.backSpeed * 4 * dt;
      if (len <= step) {
        p.px = p.x;
        p.pz = p.z;
        p.st = 'unhide';
        p.stT = 0;
        p.away = false;
        d.shell.visible = false;
        d.body.visible = true;
      } else {
        p.px += (dx / len) * step;
        p.pz += (dz / len) * step;
      }
    } else if (p.st === 'unhide') {
      if (p.stT >= 0.3) {
        p.st = 'rest';
        p.stT = 0;
        d.body.scale.set(1, 1, 1);
      }
    } else if (p.st === 'rest') {
      if (p.stT >= def.rest) p.st = 'idle';
    }
  }

  rollerImpact(p) {
    const def = p.def;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (Math.hypot(e.x - p.px, e.z - p.pz) > def.radius * CELL) continue;
      this.hitEnemy(e, def.damage, 0, 'roll');
      const heavy = e.def.kind === 'machine';
      this.knock(e, heavy ? def.knockMachine ?? 0.12 : 0.5, heavy ? 0.15 : 0.5);
    }
    const y = surfaceAt(p.px, p.pz) + 0.008;
    const pos = [p.px, y, p.pz];
    this.fx.burst({ pos, n: 22, colors: regionAt(p.px, p.pz) === 'water' ? ['#bfefff', '#ffffff', '#58bcd8'] : ['#8d6e4a', '#c9b86a', '#4f5a2e', '#ffffff'], speed: 0.3, up: 0.7, size: 0.0032, life: 0.6 });
    this.ring(p.px, p.pz, CELL * def.radius, '#e9d8a6', y - 0.005);
    sfx.impact(true);
  }

  /** Anaconda: a las personas se las traga; a las máquinas las aprieta y las detiene. */
  updateTrap(p, dt) {
    const def = p.def;
    if (p.trap === 'ready') {
      const prey = this.findEnemy(p.x, p.z, def.range, { deep: true });
      if (prey) {
        p.trap = 'strike';
        p.trapT = 0;
        p.prey = prey;
        p.ate = false;
        this.aim(p, prey.x, prey.z, def.windup + 1);
        sfx.snake();
      }
    } else if (p.trap === 'strike') {
      p.trapT += dt;
      const k = Math.min(1, p.trapT / def.windup);
      if (k >= 0.55 && p.prey) {
        const e = p.prey;
        if (e.alive) {
          if (e.def.kind === 'machine') {
            this.hitEnemy(e, def.squeeze, 0, 'squeeze');
            e.stunT = Math.max(e.stunT, 2.5);
            this.fx.burst({ pos: [e.x, TOP + 0.03, e.z], n: 16, colors: ['#5a6e2c', '#c9c26a', '#8f9a9c', '#ffd23f'], speed: 0.22, size: 0.0032, life: 0.6 });
            p.ate = 'machine';
          } else {
            this.killEnemy(e, 'snake', p);
            p.ate = true;
          }
        }
        p.prey = null;
      }
      if (k >= 1) {
        p.trap = p.ate ? 'digest' : 'ready';
        p.trapT = p.ate === 'machine' ? def.digest * 0.5 : def.digest;
      }
    } else if (p.trap === 'digest') {
      p.trapT -= dt;
      if (p.trapT <= 0) {
        p.trap = 'ready';
        p.squash = 1;
      }
    }
  }

  // ───────────────────────── mano: granada de jabillo y manotazo ─────────────────────────
  /** Lanza un jabillo desde `pos` (local, m) con velocidad `vel` (local, m/s). */
  throwGrenade(pos, vel) {
    const def = PLANTS.jabillo;
    if (this.whyCantPlant('jabillo')) return false;
    this.water -= def.cost;
    this.cool.jabillo = def.cooldown;
    const mesh = new THREE.Mesh(plantGeometry('jabillo'), MATS.std);
    mesh.position.copy(pos);
    mesh.rotation.y = -0.5;
    this.layer.add(mesh);
    this.grenades.push({ mesh, vel: vel.clone(), t: 0, spin: new THREE.Vector3(rand(-6, 6), rand(-3, 3), rand(-9, -3)).multiplyScalar(vel.length() > 0.3 ? 1 : 0.15) });
    sfx.throw();
    return true;
  }

  updateGrenades(dt) {
    const g = HAND.grenade.gravity / Math.max(0.2, this.board.root.scale.x);
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const gr = this.grenades[i];
      gr.t += dt;
      gr.vel.y -= g * dt;
      gr.mesh.position.addScaledVector(gr.vel, dt);
      gr.mesh.rotation.x += gr.spin.x * dt;
      gr.mesh.rotation.y += gr.spin.y * dt;
      gr.mesh.rotation.z += gr.spin.z * dt;
      const p = gr.mesh.position;
      const floor = surfaceAt(p.x, p.z);
      let done = false;
      if (floor > -Infinity && p.y <= floor && gr.vel.y < 0) {
        this.explodeAt(p.x, p.z);
        done = true;
      } else if (p.y < -0.5 || gr.t > 5) {
        done = true; // se cayó de la mesa
      }
      if (done) {
        this.layer.remove(gr.mesh);
        this.grenades.splice(i, 1);
      }
    }
  }

  explodeAt(lx, lz) {
    const def = PLANTS.jabillo;
    let n = 0;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (Math.hypot(e.x - lx, e.z - lz) > def.radius * CELL + e.def.rad * CELL * 0.5) continue;
      this.hitEnemy(e, def.damage, 0, 'burn');
      n++;
    }
    const wet = regionAt(lx, lz) === 'water';
    const y = surfaceAt(lx, lz) + 0.012;
    const pos = [lx, y, lz];
    this.fx.burst({ pos, n: 40, colors: ['#ffd23f', '#ff8f1f', '#ff5a1f', '#fff3a6'], speed: 0.5, up: 0.8, size: 0.005, life: 0.5, grav: -0.3, drag: 3 });
    if (wet) this.fx.burst({ pos, n: 30, colors: ['#bfefff', '#ffffff', '#58bcd8'], speed: 0.35, up: 1.6, size: 0.004, life: 0.9, grav: -1.4 });
    else this.fx.burst({ pos, n: 26, colors: ['#5a4a2a', '#7c8b35', '#3b2a17'], speed: 0.45, up: 1.2, size: 0.0035, life: 1.0, grav: -1.2 });
    for (let i = 0; i < 10; i++) this.fx.smoke(_v.set(lx + rand(-0.03, 0.03), y, lz + rand(-0.03, 0.03)), { color: '#4a4a4a', size: 0.008, rise: 0.06, life: 1.4 });
    this.ring(lx, lz, CELL * def.radius * 1.1, '#ffd27a', y - 0.009);
    sfx.explode();
    this.emit('grenade', { n });
    return n;
  }

  /** Manotazo en (x, z) locales (m): aleja a los invasores cercanos del Mangle madre. */
  pushAt(x, z) {
    if (this.state !== 'playing' || this.pushCool > 0) return -1;
    const P = HAND.push;
    let n = 0;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (Math.hypot(e.x - x, e.z - z) > P.radius * CELL) continue;
      const heavy = e.def.kind === 'machine';
      this.knock(e, P.knock * (heavy ? 0.3 : 1), P.stun * (heavy ? 0.5 : 1));
      this.hitEnemy(e, P.damage, 0, 'push');
      n++;
    }
    // ráfaga de hojas hacia afuera
    let ox = x - HEART.x;
    let oz = z - HEART.z;
    const ol = Math.hypot(ox, oz) || 1;
    ox /= ol;
    oz /= ol;
    for (let i = 0; i < 18; i++) {
      const s = rand(0.25, 0.5);
      this.fx.emit({ pos: [x + rand(-0.03, 0.03), surfaceAt(x, z) + rand(0.005, 0.03), z + rand(-0.03, 0.03)], vel: [ox * s + rand(-0.06, 0.06), rand(0.02, 0.08), oz * s + rand(-0.06, 0.06)], color: ['#3fa34d', '#7bc96f', '#a5d66f', '#E3913A'][i % 4], size: 0.0028, life: 0.6, grav: -0.2, drag: 2 });
    }
    sfx.whoosh(n > 0);
    if (n > 0) {
      this.pushCool = P.cooldown;
      this.emit('push', { n });
    }
    return n;
  }

  /** Empujón hacia afuera de la isla (`cells` casillas en 0.3 s). */
  knock(e, cells, stun) {
    let dx = e.x - HEART.x;
    let dz = e.z - HEART.z;
    const len = Math.hypot(dx, dz) || 1;
    e.knockT = 0.3;
    e.knockVx = ((dx / len) * cells * CELL) / 0.3;
    e.knockVz = ((dz / len) * cells * CELL) / 0.3;
    e.stunT = Math.max(e.stunT, stun);
  }

  ring(x, z, radius, color, y = TOP + 0.003) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 1, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })
    );
    ring.position.set(x, y, z);
    ring.scale.setScalar(0.01);
    this.layer.add(ring);
    this.fading.push({ obj: ring, t: 0, dur: 0.5, kind: 'ring', max: radius });
  }

  splash(x, z, n = 4) {
    this.fx.burst({ pos: [x, WATER_Y + 0.002, z], n, colors: ['#ffffff', '#bfefff', '#8fd6ec'], speed: 0.08, up: 1.4, size: 0.0022, life: 0.45, grav: -0.8, floor: false });
  }

  // ───────────────────────── gotas de agua ─────────────────────────
  /** Gota que trae la corriente: entra por la izquierda y flota hasta la derecha. */
  spawnRiverDrop(front = Math.random() < 0.55) {
    const o = createOrb();
    // brazo de adelante (cerca del usuario) o de atrás
    // adelante van pegadas a la arena de la isla (lejos del follaje de la orilla, que las tapa); atrás, por el centro del cauce
    const z = front ? rand(0.014, 0.024) : rand(-0.22, -0.198);
    const orb = { ...o, value: ECONOMY.dropValue, t: 0, pos: new THREE.Vector3(L.left + 0.012, WATER_Y + 0.009, front ? frontDropZ(L.left, z) : z), z0: z, front, state: 'float', phase: Math.random() * 6 };
    orb.group.position.copy(orb.pos);
    orb.group.scale.setScalar(0.01);
    this.layer.add(orb.group);
    this.orbs.push(orb);
    return orb;
  }

  /** Rocío de la heliconia: cae al lado de la planta. */
  spawnDew(p) {
    const o = createOrb();
    const orb = { ...o, value: p.def.produceValue, t: 0, life: ECONOMY.dropLife, pos: new THREE.Vector3(p.x, TOP + 0.05, p.z), state: 'hop' };
    orb.start = orb.pos.clone();
    orb.end = orb.pos.clone().add(_v.set(rand(-0.025, 0.025), 0, rand(0.012, 0.03)));
    orb.end.y = TOP + 0.018;
    orb.group.position.copy(orb.pos);
    this.layer.add(orb.group);
    this.orbs.push(orb);
  }

  collectOrb(orb) {
    if (orb.state === 'collect' || orb.state === 'gone') return;
    orb.state = 'collect';
    orb.t = 0;
    orb.from = orb.pos.clone();
    orb.group.scale.setScalar(1);
    sfx.collect();
  }

  updateOrbs(dt, playing) {
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.t += dt;
      o.core.rotation.y += dt * 2;
      const pulse = 1 + Math.sin(o.t * 6) * 0.08;
      o.halo.scale.setScalar(0.065 * pulse);
      if (o.state === 'float') {
        if (playing) {
          o.pos.x += ECONOMY.current * dt;
          o.pos.z = (o.front ? frontDropZ(o.pos.x, o.z0) : o.z0) + Math.sin(o.t * 0.9 + o.phase) * 0.004;
        }
        o.pos.y = WATER_Y + 0.009 + Math.sin(o.t * 2.6 + o.phase) * 0.002;
        o.core.rotation.z = Math.sin(o.t * 2 + o.phase) * 0.15;
        const edge = Math.min(o.pos.x - L.left, L.right - o.pos.x);
        o.group.scale.setScalar(Math.max(0.01, Math.min(1, edge / 0.03)));
        if (Math.random() < dt * 3) this.fx.emit({ pos: [o.pos.x - 0.008, WATER_Y + 0.001, o.pos.z], vel: [-0.01, 0.005, 0], color: '#e6fbff', size: 0.0018, life: 0.5, grav: 0, floor: false });
        if (o.pos.x > L.right - 0.004) o.state = 'gone';
      } else if (o.state === 'hop') {
        const k = Math.min(1, o.t / 0.7);
        o.pos.lerpVectors(o.start, o.end, k);
        o.pos.y = lerp(o.start.y, o.end.y, k) + Math.sin(k * Math.PI) * 0.04;
        if (k >= 1) {
          o.state = 'rest';
          o.t = 0;
        }
      } else if (o.state === 'rest') {
        if (playing) o.life -= dt;
        o.pos.y = o.end.y + Math.sin(o.t * 3) * 0.003;
        o.group.visible = o.life > 2.5 || Math.floor(o.life * 8) % 2 === 0;
        if (o.life <= 0) o.state = 'gone';
      } else if (o.state === 'collect') {
        this.on.collectTarget(_v);
        const k = Math.min(1, o.t / 0.55);
        const e = k * k * (3 - 2 * k);
        o.pos.lerpVectors(o.from, _v, e);
        o.pos.y += Math.sin(k * Math.PI) * 0.05;
        o.group.visible = true;
        o.group.scale.setScalar(1 - k * 0.5);
        if (k >= 1) {
          this.water += o.value;
          this.on.waterGained?.();
          o.state = 'gone';
          this.emit('collect', {});
        }
      }
      o.group.position.copy(o.pos);
      if (o.state === 'gone') {
        this.layer.remove(o.group);
        this.orbs.splice(i, 1);
      }
    }
  }

  // ───────────────────────── invasores ─────────────────────────
  /** Aparece un invasor en la orilla talada (x en metros; si no se da, al azar). */
  spawnEnemy(type, x = rand(-0.44, 0.44)) {
    const def = ENEMIES[type];
    const m = createEnemy(type);
    const hp = Math.round(def.hp * (this.level.hpMul ?? 1));
    // frente al edificio de la empresa salen un poco más adelante
    const z = x > 0.18 ? -0.318 : L.back + 0.022;
    const e = {
      type,
      def,
      x,
      z,
      hp,
      maxHp: hp,
      speed: def.speed * (this.level.speedMul ?? 1) * CELL,
      m,
      state: 'walk',
      slowT: 0,
      flashT: 0,
      stunT: 0,
      knockT: 0,
      knockVx: 0,
      knockVz: 0,
      thornT: 0,
      t: Math.random() * 10,
      chopT: 0,
      dieT: 0,
      alive: true,
      smokeT: 0,
      deep: false,
      depth: 0,
      yaw: yawTo(HEART.x - x, HEART.z - z),
      wetT: 0,
    };
    m.root.position.set(x, groundAt(x, z), z);
    m.root.rotation.y = e.yaw;
    m.shadow.position.set(x, groundAt(x, z) + 0.0006, z);
    this.layer.add(m.root, m.shadow);
    this.enemies.push(e);
    if (type === 'motosierra') sfx.saw();
    else if (def.kind === 'machine') sfx.engine();
    return e;
  }

  /** Defensor que detiene al invasor: el más cercano que tenga delante (las barreras no cuentan). */
  blockingPlant(e, dx, dz) {
    let best = null;
    let bestD = Infinity;
    const reach = (0.42 + e.def.reach) * CELL;
    for (const p of this.plants) {
      if (!p.alive || p.away || p.def.kind === 'barrier') continue;
      const px = p.x - e.x;
      const pz = p.z - e.z;
      const d = Math.hypot(px, pz);
      if (d > reach || d >= bestD) continue;
      if (px * dx + pz * dz < -0.2 * d) continue; // está detrás
      best = p;
      bestD = d;
    }
    return best;
  }

  /** Achiote bajo los pies del invasor. */
  barrierUnder(e) {
    const c = Math.floor((e.x - L.gridX0) / CELL);
    const r = Math.floor((e.z - L.gridZ0) / CELL);
    const p = this.grid[r]?.[c];
    return p && p.def.kind === 'barrier' ? p : null;
  }

  hitEnemy(e, dmg, slow = 0, how = 'shot') {
    if (!e.alive) return;
    e.hp -= dmg;
    e.flashT = 0.09;
    if (slow) e.slowT = Math.max(e.slowT, slow);
    if (e.m.bar) {
      e.m.bar.group.visible = true;
      e.m.bar.set(e.hp / e.maxHp);
    }
    if (e.hp <= 0) this.killEnemy(e, how);
  }

  killEnemy(e, how, by = null) {
    if (!e.alive) return;
    e.alive = false;
    e.dieT = 0;
    e.how = how;
    this.kills++;
    if (e.m.bar) e.m.bar.group.visible = false;
    this.emit('kill', { type: e.type });
    const pos = e.m.root.position;
    if (how === 'snake') {
      // la anaconda lo arrastra hacia su casilla y se lo traga
      e.pullFrom = [pos.x, pos.z];
      e.pullTo = by ? [by.x, by.z] : [pos.x, pos.z];
      e.m.shadow.visible = false;
      this.fx.burst({ pos: [pos.x, TOP + 0.02, pos.z], n: 14, colors: ['#5a6e2c', '#c9c26a', '#3fa34d', '#8d6e4a'], speed: 0.2, size: 0.003, life: 0.6 });
      return;
    }
    if (e.def.kind === 'machine' || how === 'burn') {
      const big = e.def.kind === 'machine';
      this.fx.burst({ pos: [pos.x, pos.y + 0.03, pos.z], n: big ? 34 : 12, colors: ['#f2c318', '#333333', '#8f9a9c', '#c0392b'], speed: 0.3, up: 1, size: 0.004, life: 0.9 });
      for (let i = 0; i < (big ? 8 : 4); i++) this.fx.smoke(_v.set(pos.x + rand(-0.02, 0.02), pos.y + 0.03, pos.z + rand(-0.02, 0.02)), { color: '#3a3a3a', size: 0.007, rise: 0.05, life: 1.5 });
      if (big) sfx.explode();
    }
    e.m.meshes.forEach((x) => (x.material = how === 'burn' || e.def.kind === 'machine' ? MATS.charred : MATS.std));
    if (how !== 'burn') sfx.fall();
  }

  updateEnemy(e, dt, playing) {
    const m = e.m;
    if (!e.alive) return this.deathAnim(e, dt);
    e.t += dt;
    if (!playing) {
      this.animateEnemy(e, 0, 1, false);
      return;
    }
    if (e.slowT > 0) e.slowT -= dt;
    if (e.flashT > 0) e.flashT -= dt;
    if (e.stunT > 0) e.stunT -= dt;
    let k = e.slowT > 0 ? 0.5 : 1;
    e.depth = depthAt(e.x, e.z);
    e.deep = e.depth > DEEP;
    if (e.depth > 0) k *= 1 - 0.3 * e.depth; // el agua los frena

    // empujón (manotazo o caparazón)
    if (e.knockT > 0) {
      e.knockT -= dt;
      e.x = Math.max(L.left + 0.02, Math.min(L.right - 0.02, e.x + e.knockVx * dt));
      e.z = Math.max(L.back + 0.015, Math.min(L.front - 0.02, e.z + e.knockVz * dt));
    }

    // achiote: frena y lastima poco a poco; las máquinas lo aplastan
    const bar = this.barrierUnder(e);
    if (bar) {
      k *= bar.def.slow;
      e.thornT += dt;
      if (e.thornT >= 0.33) {
        this.hitEnemy(e, bar.def.dps * e.thornT, 0, 'thorn');
        e.thornT = 0;
        this.fx.burst({ pos: [e.x, TOP + 0.006, e.z], n: 3, colors: ['#d42a2a', '#ff5a3c', '#2f7d32'], speed: 0.1, size: 0.0022, life: 0.35 });
      }
      if (e.def.kind === 'machine') {
        bar.hp -= e.def.dps * bar.def.crush * dt;
        bar.squash = Math.max(bar.squash, 0.4);
        if (bar.hp <= 0) this.removePlant(bar, 'crushed');
      }
      if (!e.alive) return;
    } else e.thornT = 0;

    // hacia el Mangle madre
    let dx = HEART.x - e.x;
    let dz = HEART.z - e.z;
    const dist = Math.hypot(dx, dz) || 1;
    dx /= dist;
    dz /= dist;
    const atHeart = dist < ISLAND.heartR + (e.def.rad * 0.6 + e.def.reach) * CELL;
    const stunned = e.stunT > 0;
    const target = stunned || atHeart ? null : this.blockingPlant(e, dx, dz);
    let faceX = dx;
    let faceZ = dz;
    if (stunned) {
      e.state = 'stun';
    } else if (target || atHeart) {
      e.state = 'eat';
      const dmg = e.def.dps * k * dt;
      if (target) {
        target.hp -= dmg;
        faceX = target.x - e.x;
        faceZ = target.z - e.z;
      } else this.hurtHeart(dmg * HEART_DMG);
      const cycle = e.def.kind === 'machine' ? 0.6 : e.def.tool === 'saw' ? 0.3 : e.type === 'independiente' ? 0.75 : 0.6;
      e.chopT += dt * k;
      if (e.chopT >= cycle) {
        e.chopT -= cycle;
        const tx = target ? target.x : e.x + dx * (e.def.rad + e.def.reach) * CELL;
        const tz = target ? target.z : e.z + dz * (e.def.rad + e.def.reach) * CELL;
        this.fx.burst({ pos: [lerp(e.x, tx, 0.6), TOP + 0.02, lerp(e.z, tz, 0.6)], n: 5, colors: ['#c9a06a', '#8d6e4a', '#4caf50'], speed: 0.18, size: 0.0025, life: 0.5 });
        if (target) target.squash = 0.8;
        sfx.chop(e.def.kind === 'machine' ? 'topadora' : e.def.tool === 'saw' ? 'motosierra' : 'lenador');
      }
      if (target && target.hp <= 0) this.removePlant(target, 'eaten');
    } else {
      e.state = 'walk';
      e.x += dx * e.speed * k * dt;
      e.z += dz * e.speed * k * dt;
    }

    e.yaw = angLerp(e.yaw, yawTo(faceX, faceZ), Math.min(1, dt * 5));
    m.root.rotation.y = e.yaw;
    const gy = groundAt(e.x, e.z);
    m.root.position.set(e.x, gy, e.z);
    const wet = e.depth > 0;
    m.shadow.visible = !wet;
    m.shadow.position.set(e.x, gy + 0.0006, e.z);
    if (wet && e.state === 'walk') {
      e.wetT -= dt;
      if (e.wetT <= 0) {
        e.wetT = e.def.kind === 'machine' ? 0.12 : 0.25;
        this.splash(e.x + dx * e.def.rad * CELL * 0.6, e.z + dz * e.def.rad * CELL * 0.6, e.def.kind === 'machine' ? 4 : 2);
      }
    }
    this.animateEnemy(e, dt, k, true);
    const mat = e.flashT > 0 ? MATS.flash : e.slowT > 0 ? MATS.slow : MATS.std;
    if (m.mat !== mat) {
      m.meshes.forEach((x) => (x.material = mat));
      m.mat = mat;
    }
  }

  /** Los invasores no se encaraman unos sobre otros. */
  separate(dt) {
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      const a = es[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j];
        if (!b.alive) continue;
        const min = (a.def.rad + b.def.rad) * CELL * 0.85;
        let dx = b.x - a.x;
        let dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d >= min) continue;
        if (d < 1e-5) {
          dx = Math.random() - 0.5;
          dz = Math.random() - 0.5;
        }
        const len = Math.hypot(dx, dz);
        const push = Math.min(min - d, 0.02) * Math.min(1, dt * 6);
        // la máquina empuja más de lo que la empujan
        const wa = a.def.kind === 'machine' && b.def.kind !== 'machine' ? 0.15 : 0.5;
        const wb = 1 - wa;
        a.x -= (dx / len) * push * wa;
        a.z -= (dz / len) * push * wa;
        b.x += (dx / len) * push * wb;
        b.z += (dz / len) * push * wb;
      }
    }
  }

  emitAt(e, local, opts) {
    _v.set(local[0] * U, local[1] * U, local[2] * U);
    e.m.inner.localToWorld(_v);
    this.layer.worldToLocal(_v);
    this.fx.smoke(_v, opts);
  }

  animateEnemy(e, dt, k, active) {
    const m = e.m;
    const t = e.t;
    const stun = active && e.state === 'stun';
    const eat = active && e.state === 'eat';
    const walk = active && e.state === 'walk';
    if (e.def.kind === 'machine') {
      m.inner.position.y = active && !stun ? Math.abs(Math.sin(t * 20)) * 0.0007 : 0;
      m.inner.rotation.x = stun ? Math.sin(t * 18) * 0.05 : Math.sin(t * 9) * 0.008 * (active ? 1 : 0);
      m.inner.position.x = eat ? Math.sin(t * 9) * 0.0018 : 0;
      if (m.arm) {
        // brazo de la excavadora: cava cuando ataca
        m.arm.rotation.z = eat ? -0.25 + Math.sin(t * 5.2) * 0.45 : Math.sin(t * 1.2) * 0.06;
      }
      if (m.drum) m.drum.rotation.z -= dt * (eat ? 26 : walk ? 10 : 0);
      e.smokeT -= dt;
      if (active && !stun && e.smokeT <= 0) {
        e.smokeT = eat ? 0.12 : 0.2;
        this.emitAt(e, exhaustOf(e.type), { color: '#3d3d3d', size: 0.004, rise: 0.05, life: 1.2 });
        const ch = chipsOf(e.type);
        if (ch && (eat || Math.random() < 0.3)) {
          _v.set(ch[0] * U, ch[1] * U, ch[2] * U);
          m.inner.localToWorld(_v);
          this.layer.worldToLocal(_v);
          for (let i = 0; i < (eat ? 3 : 1); i++) this.fx.emit({ pos: [_v.x, _v.y, _v.z], vel: [rand(-0.06, 0.06), rand(0.08, 0.16), rand(-0.06, 0.06)], color: ['#e2bb83', '#c1965c', '#8a5e34'][i % 3], size: 0.0024, life: 0.8 });
        }
      }
      if (stun && Math.random() < dt * 8) this.fx.emit({ pos: [e.x, m.root.position.y + 0.08, e.z], vel: [rand(-0.02, 0.02), 0.02, rand(-0.02, 0.02)], color: '#ffe17a', size: 0.0022, life: 0.4, grav: 0 });
      return;
    }
    const f = (e.def.tool === 'saw' ? 9 : 7) * k;
    const sw = walk ? Math.sin(t * f) : 0;
    m.legL.rotation.z = sw * 0.5;
    m.legR.rotation.z = -sw * 0.5;
    m.inner.position.y = walk ? Math.abs(Math.cos(t * f)) * 0.0012 : 0;
    m.inner.rotation.z = stun ? 0.25 + Math.sin(t * 16) * 0.08 : walk ? -0.06 : -0.1;
    m.inner.rotation.x = stun ? Math.sin(t * 11) * 0.12 : 0;
    if (e.def.tool === 'axe') {
      const cycle = e.type === 'independiente' ? 0.75 : 0.6;
      if (eat) {
        const ph = e.chopT / cycle;
        m.arm.rotation.z = ph < 0.65 ? lerp(0.9, 2.8, 1 - Math.pow(1 - ph / 0.65, 2)) : lerp(2.8, 0.9, Math.pow((ph - 0.65) / 0.35, 2));
      } else m.arm.rotation.z = 0.35 + sw * 0.25;
    } else {
      m.arm.rotation.z = eat ? 1.05 + Math.sin(t * 50) * 0.05 + Math.sin(t * 3) * 0.15 : 1.25 + sw * 0.08;
      if (active && !stun && Math.random() < dt * 6) this.emitAt(e, [-0.05, 0.55, 0.12], { color: '#9a9a9a', size: 0.0022, rise: 0.03, life: 0.7 });
    }
    if (stun && Math.random() < dt * 8) this.fx.emit({ pos: [e.x, m.root.position.y + 0.07, e.z], vel: [rand(-0.02, 0.02), 0.02, rand(-0.02, 0.02)], color: '#ffe17a', size: 0.002, life: 0.4, grav: 0 });
  }

  deathAnim(e, dt) {
    const m = e.m;
    e.dieT += dt;
    if (e.how === 'snake') {
      const k = Math.min(1, e.dieT / 0.45);
      m.root.position.x = lerp(e.pullFrom[0], e.pullTo[0], k * k);
      m.root.position.z = lerp(e.pullFrom[1], e.pullTo[1], k * k);
      m.root.position.y = Math.max(TOP, m.root.position.y) + Math.sin(k * Math.PI) * 0.004;
      m.root.scale.setScalar(Math.max(0.001, 1 - k * k));
      if (k >= 1) this.removeEnemy(e);
      return;
    }
    const gy = groundAt(e.x, e.z);
    if (e.def.kind === 'machine') {
      // se apaga, se hunde un poco y desaparece
      m.inner.rotation.z = Math.min(0.12, e.dieT * 0.3);
      if (e.dieT > 0.8) m.root.position.y = gy - (e.dieT - 0.8) * 0.04;
      if (Math.random() < dt * 6) this.fx.smoke(_v.set(e.x + rand(-0.01, 0.01), gy + 0.05, e.z), { color: '#2e2e2e', size: 0.006, rise: 0.05, life: 1.2 });
      if (e.dieT > 2) this.removeEnemy(e);
      return;
    }
    const fall = Math.min(1, e.dieT * 2.4);
    m.inner.rotation.z = (fall * fall * Math.PI) / 2.1;
    if (e.dieT > 0.7) {
      const s = e.dieT - 0.7;
      m.root.position.y = gy - s * 0.05;
      m.shadow.scale.setScalar(Math.max(0.001, m.shadow.scale.x * (1 - dt * 3)));
    }
    if (e.dieT > 1.5) this.removeEnemy(e);
  }

  removeEnemy(e) {
    this.layer.remove(e.m.root, e.m.shadow);
    this.enemies.splice(this.enemies.indexOf(e), 1);
  }

  // ───────────────────────── Mangle madre ─────────────────────────
  hurtHeart(dmg) {
    if (this.state !== 'playing') return;
    this.heartHp -= dmg;
    this.heartHitT = 0.15;
    this.board.setHeart(this.heartFrac, true);
    if (this.heartHp <= 0) this.lose();
  }

  // ───────────────────────── fin del nivel ─────────────────────────
  info() {
    return { level: this.level.number, number: this.level.number, name: this.level.name, total: LEVELS.length - 1, kills: this.kills, last: this.isLastLevel, tutorial: this.isTutorial };
  }

  win() {
    this.state = 'won';
    sfx.win();
    for (let i = 0; i < 70; i++) {
      this.fx.emit({
        pos: [L.gridX0 + Math.random() * L.gridW, 0.18 + Math.random() * 0.1, L.gridZ0 + Math.random() * L.gridD],
        vel: [(Math.random() - 0.5) * 0.05, -0.02, (Math.random() - 0.5) * 0.05],
        color: ['#3fa34d', '#E3913A', '#F59216', '#47868B', '#2e7d32'][i % 5],
        size: 0.003,
        life: 2.5,
        grav: -0.06,
        drag: 0.5,
      });
    }
    this.on.end(true, this.info());
  }

  lose() {
    this.state = 'lost';
    this.board.setHeart(0);
    sfx.lose();
    this.on.end(false, this.info());
  }

  // ───────────────────────── bucle ─────────────────────────
  update(dt) {
    if (this.state === 'paused') return;
    const playing = this.state === 'playing';
    const Lv = this.level;
    if (playing) {
      this.time += dt;
      if (this.tut) this.tut.update(dt);
      else {
        while (this.spawnIdx < Lv.spawns.length && this.time >= Lv.spawns[this.spawnIdx].t) {
          const s = Lv.spawns[this.spawnIdx];
          this.spawnEnemy(s.type, s.x);
          this.spawnIdx++;
        }
        while (this.bannerIdx < Lv.banners.length && this.time >= Lv.banners[this.bannerIdx].t) {
          this.on.banner(Lv.banners[this.bannerIdx]);
          this.bannerIdx++;
        }
      }
      this.nextDrop -= dt;
      if (this.nextDrop <= 0) {
        this.nextDrop = rand(ECONOMY.dropEvery[0], ECONOMY.dropEvery[1]);
        this.spawnRiverDrop();
      }
      for (const k in this.cool) this.cool[k] = Math.max(0, this.cool[k] - dt);
      this.pushCool = Math.max(0, this.pushCool - dt);
    }

    for (let i = this.plants.length - 1; i >= 0; i--) {
      const p = this.plants[i];
      if (p) this.updatePlant(p, dt, playing);
    }
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e) this.updateEnemy(e, dt, playing);
    }
    if (playing) this.separate(dt);

    if (playing) {
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const pr = this.projectiles[i];
        pr.x += pr.vx * dt;
        pr.z += pr.vz * dt;
        pr.dist += PROJ_SPEED * dt;
        pr.mesh.position.x = pr.x;
        pr.mesh.position.z = pr.z;
        pr.mesh.rotation.z -= dt * 12;
        let hit = null;
        let hd = Infinity;
        for (const e of this.enemies) {
          if (!e.alive || e.deep) continue; // lo hondo los protege
          const d = Math.hypot(e.x - pr.x, e.z - pr.z);
          if (d < (e.def.rad * 0.6 + 0.12) * CELL && d < hd) {
            hit = e;
            hd = d;
          }
        }
        if (hit) {
          this.hitEnemy(hit, pr.dmg, pr.slow);
          const pp = pr.mesh.position;
          const fxHit = PROJ_HIT[pr.kind] || PROJ_HIT.seed;
          this.fx.burst({ pos: [pp.x, pp.y, pp.z], n: fxHit.n, colors: fxHit.colors, speed: 0.12, size: 0.0022, life: 0.35 });
          sfx.hit();
        }
        if (hit || pr.dist > pr.max || regionAt(pr.x, pr.z) === 'off') {
          if (!hit && regionAt(pr.x, pr.z) === 'water') this.splash(pr.x, pr.z, 3);
          this.layer.remove(pr.mesh);
          this.projectiles.splice(i, 1);
        }
      }
      const finished = this.tut ? this.tut.finished : this.spawnIdx >= Lv.spawns.length;
      if (finished && !this.enemies.some((e) => e.alive)) {
        this.endTimer += dt;
        if (this.endTimer > 1.6) this.win();
      }
    }
    this.updateGrenades(dt);
    this.updateOrbs(dt, playing);
    this.board.heartPulse(dt, this.heartHitT > 0);
    this.board.heartBar.group.visible = playing || this.state === 'paused';
    this.heartHitT = Math.max(0, this.heartHitT - dt);

    for (let i = this.fading.length - 1; i >= 0; i--) {
      const f = this.fading[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      if (f.kind === 'shrink') {
        f.obj.scale.setScalar(Math.max(0.001, 1 - k));
        f.obj.rotation.z += dt * 3;
      } else if (f.kind === 'ring') {
        f.obj.scale.setScalar(0.01 + f.max * (1 - Math.pow(1 - k, 3)));
        f.obj.material.opacity = 0.8 * (1 - k);
      }
      if (k >= 1) {
        this.layer.remove(f.obj);
        if (f.kind === 'ring') {
          f.obj.geometry.dispose();
          f.obj.material.dispose();
        }
        this.fading.splice(i, 1);
      }
    }
  }
}
