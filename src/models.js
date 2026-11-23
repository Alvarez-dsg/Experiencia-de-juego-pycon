// Modelos 3D generados por código (sin archivos externos), estilo caricatura:
// formas redondas, colores planos, sombreado por bandas (toon) y contorno negro.
// Cada modelo se "hornea" en una sola geometría con colores por vértice → 1 draw call (+1 del contorno).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BOARD } from './config.js';

export const U = BOARD.cell; // 1 unidad de modelado = 1 casilla

// Plano de recorte usado para que el tablero "brote" de la mesa
export const riseClip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1000);
export const CLIP = [riseClip];

// Rampa de luz en 3 bandas: sombra suave, medio tono y luz (look de dibujo animado)
const toonRamp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();
export const toon = (o = {}) => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp, clippingPlanes: CLIP, ...o });

export const MATS = {
  std: toon(),
  flash: toon({ emissive: '#ffffff', emissiveIntensity: 0.55 }),
  slow: toon({ color: '#c8f7a6', emissive: '#1f4d10' }), // envenenado por la rana dardo
  hurt: toon({ color: '#f0b9a0' }),
  charred: toon({ color: '#3a3027' }),
  disabled: toon({ color: '#7b7b7b' }),
  ghost: toon({ transparent: true, opacity: 0.7, depthWrite: false }),
  preview: toon({ transparent: true, opacity: 0.4, depthWrite: false, emissive: '#1d5a23' }),
};

// ───────────────────────── contorno de caricatura ─────────────────────────
// Casco invertido: la misma geometría, inflada a lo largo de sus normales y dibujada por dentro en negro.
const INK = '#21170f';
const outlineMats = new Map();
export function outlineMat(t) {
  if (!outlineMats.has(t)) {
    const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, clippingPlanes: CLIP });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uInk = { value: t };
      sh.vertexShader = sh.vertexShader
        .replace('void main() {', 'uniform float uInk;\nvoid main() {')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * uInk;');
    };
    m.customProgramCacheKey = () => 'ink' + t;
    outlineMats.set(t, m);
  }
  return outlineMats.get(t);
}
/** Añade el contorno negro a una malla (la sigue en todo: posición, escala, visibilidad). */
export function addOutline(mesh, t = 0.001) {
  const o = new THREE.Mesh(mesh.geometry, outlineMat(t));
  o.raycast = () => {};
  o.userData.outline = true;
  mesh.add(o);
  return o;
}
/** Cambia la geometría de una malla y la de su contorno. */
export function setGeometry(mesh, geo) {
  mesh.geometry = geo;
  for (const c of mesh.children) if (c.userData.outline) c.geometry = geo;
}

// ───────────────────────── utilidades de construcción ─────────────────────────
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

export class GeoBuilder {
  constructor(rand = Math.random) {
    this.parts = [];
    this.rand = rand;
  }
  /** Añade una primitiva con color. o: { p:[x,y,z], r:[rx,ry,rz], s:n|[x,y,z], m:Matrix4, j:jitter } */
  add(geo, color, o = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    if (o.m) {
      _m.copy(o.m);
    } else {
      const s = o.s ?? 1;
      _s.set(...(Array.isArray(s) ? s : [s, s, s]));
      _p.set(...(o.p || [0, 0, 0]));
      _q.setFromEuler(_e.set(...(o.r || [0, 0, 0])));
      _m.compose(_p, _q, _s);
    }
    g.applyMatrix4(_m);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    const base = new THREE.Color(color);
    const jit = o.j ?? 0; // colores planos (caricatura)
    for (let f = 0; f < n; f += 3) {
      _c.copy(base);
      if (jit) _c.multiplyScalar(1 + (this.rand() * 2 - 1) * jit);
      for (let v = 0; v < 3 && f + v < n; v++) {
        col[(f + v) * 3] = _c.r;
        col[(f + v) * 3 + 1] = _c.g;
        col[(f + v) * 3 + 2] = _c.b;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.parts.push(g);
    return this;
  }
  /** Añade una geometría ya construida (conserva sus colores), opcionalmente transformada. */
  addBuilt(geo, m = null) {
    const g = geo.clone();
    if (m) g.applyMatrix4(m);
    this.parts.push(g);
    return this;
  }
  build(scale = 1) {
    const g = mergeGeometries(this.parts, false);
    this.parts.forEach((p) => p.dispose());
    this.parts = [];
    if (scale !== 1) g.scale(scale, scale, scale);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Matriz que estira una primitiva de altura 1 (eje Y) desde `from` hasta `to`. */
export function seg(from, to, sx = 1, sz = sx, roll = 0) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length() || 1e-4;
  dir.divideScalar(len);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
  if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, roll));
  return new THREE.Matrix4().compose(a.add(b).multiplyScalar(0.5), q, new THREE.Vector3(sx, len, sz));
}

// Primitivas redondeadas por defecto (más segmentos = más "caricatura", menos "low-poly")
export const cyl = (rt, rb = rt, n = 12) => new THREE.CylinderGeometry(rt, rb, 1, n);
export const ball = (w = 14, h = 10) => new THREE.SphereGeometry(0.5, w, h);
export const ico = (r, d = 2) => new THREE.IcosahedronGeometry(r, d);
export const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
export const cone = (r = 0.5, h = 1, n = 12) => new THREE.ConeGeometry(r, h, n);
/** Cápsula de radio r y largo total h (eje Y), útil para cuerpos y extremidades. */
export const capsule = (r, h) => new THREE.CapsuleGeometry(r, Math.max(0.001, h - 2 * r), 6, 12);
const roundedCache = new Map();
/** Caja con esquinas redondeadas (tamaño 1×1×1, se escala con `s`). */
export function rbox(radius = 0.18) {
  if (!roundedCache.has(radius)) roundedCache.set(radius, new RoundedBoxGeometry(1, 1, 1, 3, radius));
  return roundedCache.get(radius);
}
const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];

/** Ojos de caricatura: un punto negro ovalado con un brillo. `dir` = hacia dónde mira. */
export function eye(b, c, r, dir = [1, 0, 0.35]) {
  const d = new THREE.Vector3(...dir).normalize();
  b.add(ball(12, 10), '#17110b', { p: [c[0] + d.x * r * 0.25, c[1], c[2] + d.z * r * 0.25], s: [r * 1.25, r * 1.65, r * 1.25] });
  b.add(ball(8, 6), '#ffffff', { p: [c[0] + d.x * r * 0.8, c[1] + r * 0.35, c[2] + d.z * r * 0.8 + r * 0.12], s: r * 0.42 });
}
/** Mejillas rosadas. */
export function blush(b, c, r) {
  b.add(ball(10, 6), '#f39aa0', { p: c, s: [r * 0.5, r * 0.6, r * 1.2] });
}

export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ───────────────────────── PLANTAS (unidades = casillas) ─────────────────────────
export function mound(b) {
  b.add(cyl(0.24, 0.3), '#6b4527', { p: [0, 0.035, 0], s: [1, 0.07, 1] });
}

export function buildHeliconia() {
  const b = new GeoBuilder(mulberry32(11));
  mound(b);
  const greens = ['#3aa14a', '#4cb158', '#2f8f40', '#55ba5f'];
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + 0.7;
    const cx = Math.cos(a);
    const cz = Math.sin(a);
    b.add(cyl(0.018, 0.024), '#3b7d2c', { m: seg([0, 0.07, 0], [cx * 0.1, 0.36, cz * 0.1]) });
    b.add(ball(), greens[i], { m: seg([cx * 0.08, 0.3, cz * 0.08], [cx * 0.3, 0.74, cz * 0.3], 0.19, 0.05, a) });
  }
  b.add(cyl(0.026, 0.03), '#4d8a2e', { m: seg([0, 0.07, 0], [0, 0.95, 0]) });
  for (let k = 0; k < 5; k++) {
    const y = 0.42 + k * 0.1;
    const side = k % 2 ? 1 : -1;
    const tip = [side * 0.21, y + 0.1, side * 0.07];
    b.add(cone(0.5, 1, 10), '#ee3b30', { m: seg([0, y, 0], tip, 0.12, 0.08) });
    const t2 = [tip[0] * 1.12, tip[1] + 0.015, tip[2] * 1.12];
    b.add(cone(0.5, 1, 10), '#ffd23f', { m: seg([tip[0] * 0.72, y + 0.072, tip[2] * 0.72], t2, 0.06, 0.05) });
  }
  // carita en la flor de arriba
  for (const z of [0.035, -0.035]) eye(b, [0.03, 0.86, z], 0.022, [1, 0, z > 0 ? 0.5 : 0.1]);
  return b.build(U);
}

export function buildAchiote() {
  // mata baja y redonda de achiote con cápsulas rojas espinosas: frena y lastima a quien la cruza
  const b = new GeoBuilder(mulberry32(12));
  b.add(cyl(0.36, 0.4), '#6b4527', { p: [0, 0.025, 0], s: [1, 0.05, 1] });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = i === 6 ? 0 : 0.22;
    b.add(ball(), i % 2 ? '#3a8f3c' : '#47a64a', { p: [Math.cos(a) * r, 0.11, Math.sin(a) * r], s: [0.24, 0.16, 0.24] });
  }
  const R = mulberry32(13);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const x = Math.cos(a) * 0.2;
    const z = Math.sin(a) * 0.2;
    const y = 0.2 + R() * 0.04;
    b.add(ball(), '#e0312b', { p: [x, y, z], s: [0.12, 0.15, 0.12] });
    for (let k = 0; k < 5; k++) {
      const aa = (k / 5) * Math.PI * 2 + R();
      const d = [Math.cos(aa), 0.3 + R() * 0.4, Math.sin(aa)];
      b.add(cone(0.016, 0.05, 6), '#ff6a4a', { m: seg([x + d[0] * 0.05, y + d[1] * 0.05, z + d[2] * 0.05], [x + d[0] * 0.09, y + d[1] * 0.09, z + d[2] * 0.09]) });
    }
  }
  for (const z of [0.05, -0.05]) eye(b, [0.12, 0.2, z], 0.03, [1, 0.2, z > 0 ? 0.5 : 0.1]);
  return b.build(U);
}

export function buildCeiba() {
  const b = new GeoBuilder(mulberry32(14));
  b.add(cyl(0.15, 0.21), '#b7a68f', { p: [0, 0.32, 0], s: [1, 0.64, 1] });
  // raíces tablares redondeadas
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    b.add(ball(), '#a8977f', { p: [Math.cos(a) * 0.17, 0.08, Math.sin(a) * 0.17], s: [0.26, 0.2, 0.08], r: [0, -a, 0] });
  }
  for (const [x, z] of [
    [0.24, 0.1],
    [-0.25, 0.06],
    [0.05, -0.27],
  ]) b.add(cyl(0.03, 0.045), '#9e8d76', { m: seg([0, 0.55, 0], [x, 0.7, z]) });
  // cara amable en el tronco
  for (const z of [0.065, -0.065]) eye(b, [0.17, 0.43, z + 0.03], 0.05, [1, 0, 0.45]);
  blush(b, [0.19, 0.37, 0.14], 0.06);
  blush(b, [0.19, 0.37, -0.08], 0.06);
  b.add(capsule(0.012, 0.07), '#5e5446', { p: [0.2, 0.36, 0.03], r: [Math.PI / 2, 0, 0] });
  // copa redonda
  b.add(ball(), '#3ea044', { p: [0, 0.78, 0], s: [0.92, 0.32, 0.86] });
  b.add(ball(), '#4cb352', { p: [0.12, 0.9, 0.08], s: [0.42, 0.28, 0.42] });
  b.add(ball(), '#45aa4b', { p: [-0.16, 0.88, -0.05], s: [0.4, 0.26, 0.4] });
  return b.build(U);
}

export function buildJabillo() {
  // fruto del jabillo (Hura crepitans): cápsula con gajos que estalla; se lanza como una granada
  const b = new GeoBuilder(mulberry32(15));
  const y = 0.17;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.add(ball(10, 8), i % 2 ? '#86963b' : '#9aab46', {
      p: [Math.cos(a) * 0.12, y, Math.sin(a) * 0.12],
      r: [0, -a, 0],
      s: [0.17, 0.33, 0.16],
    });
  }
  for (const z of [0.05, -0.05]) eye(b, [0.2, y + 0.03, z + 0.03], 0.045, [1, 0.1, 0.5]);
  b.add(capsule(0.01, 0.05), '#3b2a17', { p: [0.215, y - 0.05, 0.03], r: [Math.PI / 2, 0, 0] });
  b.add(cyl(0.06, 0.06), '#6f7d2e', { p: [0, y + 0.155, 0], s: [1, 0.02, 1] });
  b.add(cyl(0.022, 0.028), '#5a4a2a', { m: seg([0, y + 0.14, 0], [0.02, y + 0.23, 0]) });
  b.add(ball(), '#4caf50', { m: seg([0.02, y + 0.21, 0], [0.17, y + 0.27, 0.05], 0.1, 0.025) });
  return b.build(U);
}

export function buildShovel() {
  const b = new GeoBuilder(mulberry32(16));
  b.add(cyl(0.035, 0.035), '#b07a45', { m: seg([0, 0.32, 0], [0, 1.0, 0]) });
  b.add(capsule(0.04, 0.22), '#5c3a1e', { p: [0, 1.02, 0], r: [0, 0, Math.PI / 2] });
  b.add(rbox(0.12), '#b4bfc4', { p: [0, 0.2, 0], s: [0.26, 0.32, 0.05] });
  return b.build(U);
}

// ───────────────────────── extras visuales ─────────────────────────
const shadowGeo = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
let shadowMat = null;
export function createShadow(radius) {
  if (!shadowMat) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(20,30,20,0.45)');
    g.addColorStop(0.6, 'rgba(20,30,20,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    shadowMat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(c),
      transparent: true,
      depthWrite: false,
      clippingPlanes: CLIP,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
  }
  const m = new THREE.Mesh(shadowGeo, shadowMat);
  m.scale.setScalar(radius);
  m.renderOrder = 1;
  return m;
}

let glowTex = null;
export function glowTexture() {
  if (!glowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(230,250,255,1)');
    g.addColorStop(0.25, 'rgba(120,210,255,0.75)');
    g.addColorStop(0.6, 'rgba(60,160,230,0.18)');
    g.addColorStop(1, 'rgba(40,140,220,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(c);
    glowTex.colorSpace = THREE.SRGBColorSpace;
  }
  return glowTex;
}

// Gota de agua (la moneda del juego): lágrima azul con brillo y un halo
let dropGeo = null;
export function createOrb() {
  if (!dropGeo) {
    const b = new GeoBuilder();
    b.add(ball(16, 12), '#3fb2ec', { s: [0.02, 0.02, 0.02] });
    b.add(cone(0.5, 1, 16), '#3fb2ec', { p: [0, 0.0145, 0], s: [0.0172, 0.016, 0.0172] });
    b.add(ball(8, 6), '#e9fbff', { p: [-0.004, 0.004, 0.0075], s: [0.0055, 0.008, 0.004] });
    dropGeo = b.build();
  }
  const group = new THREE.Group();
  const core = new THREE.Mesh(dropGeo, MATS.std);
  addOutline(core, 0.0008);
  group.add(core);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
  );
  halo.scale.setScalar(0.065);
  group.add(halo);
  return { group, core, halo };
}

const projMat = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: toonRamp, clippingPlanes: CLIP, ...o });
export const PROJ = {
  // semilla que escupe la guacamaya
  seed: { geo: new THREE.SphereGeometry(0.0068, 10, 8).scale(1.25, 0.9, 0.9), mat: projMat('#8a4b1f') },
  // gota de veneno de la rana dardo
  poison: { geo: new THREE.SphereGeometry(0.0072, 10, 8), mat: projMat('#9cff3a', { emissive: '#2f6a00' }) },
};
// Partículas al impactar, según el proyectil
export const PROJ_HIT = {
  seed: { n: 5, colors: ['#8a4b1f', '#c9955a', '#e8c06a'] },
  poison: { n: 7, colors: ['#9cff3a', '#4caf50', '#d4ff8a'] },
};

// ───────────────────────── barra de vida (máquinas y Mangle madre) ─────────────────────────
let barTex = null;
function whiteTex() {
  if (!barTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 4;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 4, 4);
    barTex = new THREE.CanvasTexture(c);
  }
  return barTex;
}
export function createHpBar(w, h, color = '#5fd16a') {
  const group = new THREE.Group();
  const mk = (col, order) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: whiteTex(), color: col, depthTest: false, depthWrite: false, transparent: true }));
    s.renderOrder = order;
    return s;
  };
  const back = mk('#21170f', 40);
  back.scale.set(w + h * 0.5, h * 1.5, 1);
  const fill = mk(color, 41);
  fill.scale.set(w, h, 1);
  group.add(back, fill);
  const bar = {
    group,
    set(f) {
      f = Math.max(0.001, Math.min(1, f));
      fill.scale.x = w * f;
      fill.center.x = 0.5 / f;
      fill.material.color.set(f > 0.5 ? color : f > 0.25 ? '#f2c230' : '#e2492f');
    },
  };
  bar.set(1);
  return bar;
}

export { pick };
