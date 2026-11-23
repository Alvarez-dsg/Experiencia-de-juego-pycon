// Invasores de DEFORESTA S.A., estilo caricatura (cabeza grande y redonda, ojos de punto, contorno negro).
// Personas: leñador independiente, leñador profesional, motosierrista.
// Máquinas: excavadora, bulldócer, astilladora, desbrozadora.
// Unidades = casillas. Se modelan mirando hacia +x; el juego las gira hacia donde caminan.
import * as THREE from 'three';
import { GeoBuilder, mulberry32, seg, cyl, ball, cone, capsule, rbox, eye, blush, U, MATS, addOutline, createShadow, createHpBar } from './models.js';
import { ENEMIES } from './config.js';

const SKIN = { independiente: '#e9b58c', profesional: '#d9a07a', motosierra: '#c98e62' };
const INK_W = 0.0009;

// ───────────────────────── personas ─────────────────────────
function personGeos(type) {
  const indep = type === 'independiente';
  const saw = type === 'motosierra';
  const skin = SKIN[type];
  const shirt = indep ? '#c8423a' : '#ff8a2a';
  const pants = indep ? '#3e5f8f' : '#3d4a5a';
  const boots = indep ? '#6b4428' : '#2b2b2b';

  const body = new GeoBuilder(mulberry32(type.length * 7));
  // torso redondo
  body.add(capsule(0.13, 0.32), shirt, { p: [0, 0.36, 0], s: [1, 1, 0.95] });
  if (indep) {
    // camisa de cuadros: franjas oscuras
    for (const y of [0.3, 0.4]) body.add(cyl(0.133, 0.133), '#7a1f1a', { p: [0, y, 0], s: [1, 0.025, 0.95] });
    body.add(capsule(0.012, 0.2), '#7a1f1a', { p: [0.125, 0.36, 0] });
  } else {
    // uniforme con chaleco reflectivo
    for (const y of [0.31, 0.41]) body.add(cyl(0.134, 0.134), '#f4f4ee', { p: [0, y, 0], s: [1, 0.028, 0.96] });
    body.add(ball(), '#2d6a9f', { p: [0.1, 0.45, 0.05], s: [0.03, 0.05, 0.05] }); // logo
  }
  body.add(cyl(0.135, 0.135), '#3b2a1c', { p: [0, 0.25, 0], s: [1, 0.035, 0.96] }); // cinturón
  // brazo de atrás (fijo)
  body.add(capsule(0.04, 0.2), shirt, { m: seg([0.0, 0.45, -0.14], [0.06, 0.3, -0.16]) });
  body.add(ball(), skin, { p: [0.07, 0.28, -0.16], s: 0.075 });
  // cabeza grande
  body.add(ball(20, 16), skin, { p: [0, 0.66, 0], s: 0.36 });
  for (const z of [0.06, -0.06]) eye(body, [0.165, 0.67, z], 0.024, [1, 0, z > 0 ? 0.4 : 0.1]);
  body.add(ball(), skin, { p: [0.18, 0.635, 0], s: [0.04, 0.035, 0.04] }); // nariz
  for (const z of [0.18, -0.18]) body.add(ball(), skin, { p: [0, 0.66, z], s: [0.05, 0.07, 0.04] }); // orejas
  if (indep) {
    // sin casco: pelo despeinado y barba de tres días
    body.add(ball(20, 12), '#3b2a1e', { p: [-0.02, 0.73, 0], s: [0.36, 0.26, 0.37] });
    for (let i = 0; i < 4; i++) body.add(cone(0.035, 0.08, 8), '#3b2a1e', { m: seg([-0.02 + i * 0.03, 0.83, (i - 1.5) * 0.04], [0.02 + i * 0.04, 0.88, (i - 1.5) * 0.06]) });
    body.add(ball(), '#8a6a52', { p: [0.13, 0.58, 0], s: [0.1, 0.07, 0.22] });
  } else {
    // casco de seguridad (blanco el profesional, amarillo el motosierrista) con visera
    const hat = saw ? '#ffd23f' : '#f6f5ef';
    body.add(new THREE.SphereGeometry(0.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), hat, { p: [0, 0.72, 0], s: [0.39, 0.34, 0.39] });
    body.add(cyl(0.21, 0.23), hat, { p: [0.03, 0.725, 0], s: [1, 0.025, 0.95] });
    body.add(capsule(0.02, 0.3), saw ? '#e6b800' : '#d9d8d0', { p: [0, 0.85, 0], r: [0, 0, Math.PI / 2] });
    if (saw) {
      // protectores de oídos
      for (const z of [0.18, -0.18]) body.add(cyl(0.05, 0.05), '#e04b2a', { p: [0, 0.66, z], r: [Math.PI / 2, 0, 0], s: [1, 0.06, 1] });
    }
  }

  const leg = new GeoBuilder(mulberry32(3));
  leg.add(capsule(0.05, 0.2), pants, { p: [0, -0.09, 0] });
  leg.add(capsule(0.045, 0.14), boots, { p: [0.035, -0.18, 0], r: [0, 0, Math.PI / 2] });

  const arm = new GeoBuilder(mulberry32(4));
  arm.add(capsule(0.04, 0.2), shirt, { p: [0, -0.08, 0] });
  arm.add(ball(), skin, { p: [0, -0.19, 0], s: 0.075 });
  if (!saw) {
    // hacha
    arm.add(cyl(0.018, 0.02), '#9a6a3a', { m: seg([0, -0.14, 0], [0, -0.56, 0]) });
    arm.add(rbox(0.25), '#b3bdc2', { p: [-0.05, -0.5, 0], s: [0.13, 0.1, 0.03] });
    arm.add(rbox(0.3), '#e9eef0', { p: [-0.115, -0.5, 0], s: [0.03, 0.11, 0.035] });
  } else {
    // motosierra
    arm.add(rbox(0.2), '#ff7a1a', { p: [0, -0.27, 0], s: [0.14, 0.16, 0.12] });
    arm.add(rbox(0.3), '#2d3436', { p: [0.04, -0.24, 0], s: [0.04, 0.08, 0.13] });
    arm.add(rbox(0.45), '#a6b1b4', { p: [0, -0.52, 0], s: [0.06, 0.38, 0.025] });
    arm.add(rbox(0.45), '#2b2b2b', { p: [0, -0.52, 0], s: [0.075, 0.4, 0.012] });
  }
  return { body: body.build(U), leg: leg.build(U), arm: arm.build(U) };
}

// ───────────────────────── máquinas ─────────────────────────
const TRACK = '#38393b';
function tracks(b, len, z, h = 0.2) {
  for (const s of [-1, 1]) {
    b.add(rbox(0.45), TRACK, { p: [0, h / 2, s * z], s: [len, h, 0.2] });
    for (let i = 0; i < 4; i++) b.add(cyl(0.06, 0.06), '#7d8184', { p: [-len * 0.36 + (i * len * 0.72) / 3, h / 2, s * (z + 0.1)], r: [Math.PI / 2, 0, 0], s: [1, 0.02, 1] });
  }
}
function wheels(b, xs, z, r) {
  for (const x of xs) {
    for (const s of [-1, 1]) {
      b.add(cyl(r, r, 18), '#2b2b2b', { p: [x, r, s * z], r: [Math.PI / 2, 0, 0], s: [1, 0.12, 1] });
      b.add(cyl(r * 0.45, r * 0.45, 12), '#c9cdd0', { p: [x, r, s * (z + 0.062)], r: [Math.PI / 2, 0, 0], s: [1, 0.01, 1] });
    }
  }
}
/** Cabina con ventana y ojos enojados (las máquinas también son personajes). */
function cabin(b, x, y, z, w, h, d, color) {
  b.add(rbox(0.2), color, { p: [x, y, z], s: [w, h, d] });
  b.add(rbox(0.3), '#9fd6ea', { p: [x + w / 2 - 0.005, y + h * 0.08, z], s: [0.02, h * 0.6, d * 0.78] });
  for (const s of [-1, 1]) {
    eye(b, [x + w / 2 + 0.008, y + h * 0.1, z + s * d * 0.18], 0.035, [1, 0, 0]);
    // ceja inclinada (cara de malo)
    b.add(capsule(0.012, 0.09), '#21170f', { p: [x + w / 2 + 0.012, y + h * 0.27, z + s * d * 0.18], r: [s * 0.45 + Math.PI / 2, 0, 0] });
  }
}

function excavadoraGeos() {
  const b = new GeoBuilder(mulberry32(81));
  tracks(b, 0.95, 0.27);
  b.add(rbox(0.25), '#f2b705', { p: [-0.05, 0.33, 0], s: [0.7, 0.24, 0.52] });
  b.add(rbox(0.3), '#d99a00', { p: [-0.38, 0.38, 0], s: [0.16, 0.28, 0.5] }); // contrapeso
  cabin(b, 0.05, 0.6, -0.1, 0.32, 0.32, 0.28, '#f2b705');
  b.add(cyl(0.025, 0.03), '#3a3a3a', { m: seg([-0.25, 0.45, 0.15], [-0.25, 0.72, 0.15]) });
  // brazo articulado (se mueve aparte)
  const arm = new GeoBuilder(mulberry32(82));
  arm.add(capsule(0.06, 0.5), '#f2b705', { m: seg([0, 0, 0], [0.32, 0.3, 0]) });
  arm.add(capsule(0.05, 0.42), '#e0a800', { m: seg([0.32, 0.3, 0], [0.55, -0.05, 0]) });
  arm.add(rbox(0.3), '#7f8a8d', { p: [0.58, -0.12, 0], s: [0.16, 0.14, 0.24] });
  for (let i = -1; i <= 1; i++) arm.add(cone(0.025, 0.06, 6), '#d9dee0', { p: [0.6, -0.21, i * 0.08], r: [Math.PI, 0, 0] });
  return { body: b.build(U), arm: arm.build(U), armPos: [0.18, 0.45, 0.12], exhaust: [-0.25, 0.74, 0.15], top: 0.95 };
}

function bulldozerGeos() {
  const b = new GeoBuilder(mulberry32(83));
  tracks(b, 0.95, 0.28);
  b.add(rbox(0.25), '#ffc21a', { p: [-0.02, 0.35, 0], s: [0.78, 0.28, 0.54] });
  b.add(rbox(0.2), '#e0a800', { p: [0.24, 0.48, 0], s: [0.3, 0.06, 0.5] });
  cabin(b, -0.18, 0.64, 0, 0.34, 0.32, 0.4, '#ffc21a');
  b.add(cyl(0.028, 0.032), '#3a3a3a', { m: seg([0.18, 0.48, 0.17], [0.18, 0.8, 0.17]) });
  // pala curva al frente
  b.add(new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1, true, -0.9, 1.8), '#8f9a9c', { p: [0.42, 0.2, 0], r: [Math.PI / 2, 0, 0], s: [0.24, 0.72, 0.26] });
  b.add(rbox(0.4), '#c4ccce', { p: [0.62, 0.045, 0], s: [0.06, 0.05, 0.72] });
  for (const s of [-1, 1]) b.add(capsule(0.03, 0.34), '#d9ab12', { m: seg([0.18, 0.28, s * 0.24], [0.48, 0.18, s * 0.24]) });
  return { body: b.build(U), exhaust: [0.18, 0.82, 0.17], top: 1.0 };
}

function astilladoraGeos() {
  const b = new GeoBuilder(mulberry32(84));
  wheels(b, [-0.28, 0.12], 0.27, 0.15);
  b.add(rbox(0.25), '#f06a1a', { p: [-0.08, 0.38, 0], s: [0.66, 0.3, 0.5] });
  b.add(rbox(0.2), '#2d3436', { p: [-0.08, 0.26, 0], s: [0.68, 0.06, 0.52] });
  // tolva (embudo) al frente: por ahí se traga los árboles
  b.add(new THREE.CylinderGeometry(0.5, 0.28, 1, 4, 1, true), '#9aa5a8', { p: [0.38, 0.42, 0], r: [0, Math.PI / 4, Math.PI / 2], s: [0.62, 0.32, 0.62] });
  b.add(rbox(0.3), '#7d878a', { p: [0.24, 0.4, 0], s: [0.1, 0.24, 0.3] });
  // dientes dentro de la tolva
  for (let i = -1; i <= 1; i++) b.add(cone(0.03, 0.08, 6), '#eef3f5', { p: [0.33, 0.33, i * 0.08], r: [0, 0, Math.PI / 2] });
  // chimenea de descarga curva
  const pts = [
    [-0.25, 0.5, 0],
    [-0.28, 0.75, 0],
    [-0.2, 0.92, 0],
    [-0.05, 0.98, 0],
  ];
  for (let i = 0; i < pts.length - 1; i++) b.add(cyl(0.065, 0.07), '#f06a1a', { m: seg(pts[i], pts[i + 1]) });
  b.add(cyl(0.08, 0.06), '#d65612', { m: seg([-0.05, 0.98, 0], [0.04, 0.96, 0]) });
  // ojos en el capó
  for (const s of [-1, 1]) {
    eye(b, [0.25, 0.47, s * 0.13], 0.04, [1, 0.1, 0]);
    b.add(capsule(0.012, 0.1), '#21170f', { p: [0.255, 0.555, s * 0.13], r: [s * 0.45 + Math.PI / 2, 0, 0] });
  }
  return { body: b.build(U), exhaust: [-0.36, 0.55, -0.15], chips: [0.06, 0.96, 0], top: 1.1 };
}

function desbrozadoraGeos() {
  const b = new GeoBuilder(mulberry32(85));
  tracks(b, 1.05, 0.3, 0.22);
  b.add(rbox(0.25), '#d63a2a', { p: [-0.08, 0.38, 0], s: [0.84, 0.3, 0.6] });
  b.add(rbox(0.2), '#a82a1e', { p: [-0.08, 0.53, 0], s: [0.8, 0.05, 0.58] });
  cabin(b, -0.2, 0.72, 0.05, 0.36, 0.34, 0.4, '#d63a2a');
  b.add(cyl(0.03, 0.035), '#3a3a3a', { m: seg([-0.42, 0.52, -0.2], [-0.42, 0.86, -0.2]) });
  // brazos que sostienen el tambor
  for (const s of [-1, 1]) b.add(capsule(0.04, 0.42), '#a82a1e', { m: seg([0.18, 0.38, s * 0.3], [0.56, 0.22, s * 0.3]) });
  b.add(rbox(0.25), '#8f9a9c', { p: [0.58, 0.33, 0], s: [0.24, 0.1, 0.74] }); // capota del tambor
  // tambor con dientes (gira aparte)
  const drum = new GeoBuilder(mulberry32(86));
  drum.add(cyl(0.13, 0.13, 18), '#5b6366', { r: [Math.PI / 2, 0, 0], s: [1, 0.66, 1] });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    for (const z of [-0.2, 0, 0.2]) drum.add(cone(0.035, 0.07, 6), '#e9eef0', { m: seg([Math.cos(a) * 0.12, Math.sin(a) * 0.12, z + (i % 2) * 0.08 - 0.04], [Math.cos(a) * 0.19, Math.sin(a) * 0.19, z + (i % 2) * 0.08 - 0.04]) });
  }
  return { body: b.build(U), drum: drum.build(U), drumPos: [0.62, 0.17, 0], exhaust: [-0.42, 0.88, -0.2], top: 1.12 };
}

const BUILD = { excavadora: excavadoraGeos, bulldozer: bulldozerGeos, astilladora: astilladoraGeos, desbrozadora: desbrozadoraGeos };
const cache = {};
function geos(type) {
  if (!cache[type]) cache[type] = ENEMIES[type].kind === 'person' ? personGeos(type) : BUILD[type]();
  return cache[type];
}

/** Arma un invasor: { root, inner, body, legL, legR, arm, drum, meshes, shadow, bar, info }. */
export function createEnemy(type) {
  const g = geos(type);
  const machine = ENEMIES[type].kind === 'machine';
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  const mk = (geo, parent) => {
    const m = new THREE.Mesh(geo, MATS.std);
    addOutline(m, machine ? 0.0012 : INK_W);
    parent.add(m);
    return m;
  };
  const body = mk(g.body, inner);
  const meshes = [body];
  const e = { root, inner, body, legL: null, legR: null, arm: null, drum: null, meshes, mat: MATS.std, info: g, machine };
  if (!machine) {
    e.legL = mk(g.leg, inner);
    e.legR = mk(g.leg, inner);
    e.legL.position.set(0, 0.2 * U, 0.065 * U);
    e.legR.position.set(0, 0.2 * U, -0.065 * U);
    e.arm = mk(g.arm, inner);
    e.arm.position.set(0, 0.47 * U, 0.15 * U);
    meshes.push(e.legL, e.legR, e.arm);
  } else {
    if (g.arm) {
      e.arm = mk(g.arm, inner);
      e.arm.position.set(...g.armPos.map((v) => v * U));
      meshes.push(e.arm);
    }
    if (g.drum) {
      e.drum = mk(g.drum, inner);
      e.drum.position.set(...g.drumPos.map((v) => v * U));
      meshes.push(e.drum);
    }
    e.bar = createHpBar(0.05, 0.0045);
    e.bar.group.position.y = (g.top + 0.18) * U;
    e.bar.group.visible = false;
    root.add(e.bar.group);
  }
  e.shadow = createShadow(machine ? 0.05 : 0.022);
  return e;
}

/** Punto local (casillas) de donde sale el humo del escape. */
export const exhaustOf = (type) => geos(type).exhaust;
export const chipsOf = (type) => geos(type).chips;
