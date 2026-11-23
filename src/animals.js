// Animales amazónicos defensores, estilo "juguete chibi": cabezas grandes y ojos grandes con brillo.
// Unidades = casillas. Miran hacia +x (hacia los invasores); el lado +z queda de frente al usuario.
// Todos se apoyan directamente sobre el suelo (y = 0), sin montículos ni bases.
import * as THREE from 'three';
import { GeoBuilder, mulberry32, seg, cyl, ball, box, cone, eye } from './models.js';

const ball2 = () => ball(18, 14); // esferas más redondas para las cabezas

// ───────────────────────── MONO CAPUCHINO ─────────────────────────
export function buildMono() {
  const b = new GeoBuilder(mulberry32(41));
  const fur = '#7a4a28';
  const dark = '#3a2312';
  const cream = '#f3dfba';
  // cola enroscada detrás
  const tail = [
    [-0.08, 0.08, 0],
    [-0.22, 0.1, 0.01],
    [-0.3, 0.22, 0.02],
    [-0.27, 0.36, 0.02],
    [-0.18, 0.4, 0.01],
    [-0.15, 0.32, 0],
  ];
  for (let i = 0; i < tail.length - 1; i++) b.add(cyl(0.026, 0.03), fur, { m: seg(tail[i], tail[i + 1]) });
  // pies y cuerpo sentado
  for (const z of [0.08, -0.08]) b.add(ball(), dark, { p: [0.1, 0.025, z], s: [0.13, 0.05, 0.09] });
  b.add(ball2(), fur, { p: [0, 0.16, 0], s: [0.27, 0.3, 0.27] });
  b.add(ball2(), cream, { p: [0.06, 0.15, 0], s: [0.16, 0.2, 0.2] });
  // brazos listos para saltar
  for (const z of [0.13, -0.13]) {
    b.add(cyl(0.032, 0.036), fur, { m: seg([0.02, 0.25, z], [0.13, 0.08, z * 1.05]) });
    b.add(ball(), dark, { p: [0.14, 0.05, z * 1.05], s: 0.06 });
  }
  // cabeza grande con gorro oscuro y cara crema
  b.add(ball2(), fur, { p: [0.03, 0.45, 0], s: 0.37 });
  b.add(ball2(), dark, { p: [0.0, 0.57, 0], s: [0.3, 0.13, 0.31] });
  b.add(ball2(), cream, { p: [0.12, 0.43, 0], s: [0.2, 0.26, 0.29] });
  b.add(ball(), '#e3c194', { p: [0.21, 0.39, 0], s: [0.1, 0.09, 0.14] });
  b.add(box(0.012, 0.012, 0.05), '#5a3a22', { p: [0.255, 0.365, 0], j: 0 });
  for (const z of [0.065, -0.065]) eye(b, [0.2, 0.465, z + 0.01], 0.046, [1, 0, z > 0 ? 0.55 : 0.1]);
  for (const z of [0.19, -0.19]) b.add(ball(), cream, { p: [0.03, 0.46, z], s: [0.06, 0.1, 0.05] });
  return b.build(1);
}

// ───────────────────────── RANA DARDO ─────────────────────────
export function buildRana() {
  // Dendrobates tinctorius: amarilla con manchas negras y patas azules
  const b = new GeoBuilder(mulberry32(42));
  const yellow = '#ffd21f';
  const blue = '#1f63d6';
  const black = '#111111';
  for (const z of [0.16, -0.16]) {
    b.add(ball(), blue, { p: [-0.1, 0.07, z], s: [0.24, 0.12, 0.12], r: [0, z > 0 ? -0.5 : 0.5, 0] });
    for (let i = -1; i <= 1; i++) b.add(ball(), '#3f86f2', { p: [-0.18, 0.02, z * 1.25 + i * 0.03], s: [0.05, 0.03, 0.035] });
    b.add(cyl(0.028, 0.032), blue, { m: seg([0.12, 0.1, z * 0.75], [0.17, 0.02, z * 0.9]) });
    for (let i = -1; i <= 1; i++) b.add(ball(), '#3f86f2', { p: [0.19, 0.015, z * 0.9 + i * 0.025], s: [0.045, 0.025, 0.03] });
  }
  // cuerpo-cabeza redondo (las ranas son casi pura cabeza)
  b.add(ball2(), black, { p: [0, 0.17, 0], s: [0.44, 0.3, 0.4] });
  b.add(ball2(), yellow, { p: [0.01, 0.185, 0], s: [0.42, 0.29, 0.37] });
  const R = mulberry32(43);
  for (let i = 0; i < 8; i++) {
    const a = R() * Math.PI * 2;
    const rr = 0.06 + R() * 0.08;
    b.add(ball(), black, { p: [-0.06 + Math.cos(a) * rr * 0.6, 0.31, Math.sin(a) * rr], s: [0.07, 0.03, 0.06], j: 0 });
  }
  b.add(ball2(), blue, { p: [0.07, 0.1, 0], s: [0.3, 0.1, 0.32] });
  // ojos saltones arriba
  for (const z of [0.1, -0.1]) {
    b.add(ball2(), yellow, { p: [0.11, 0.3, z], s: 0.14 });
    eye(b, [0.14, 0.32, z + 0.01], 0.05, [1, 0.15, z > 0 ? 0.6 : 0.1]);
  }
  b.add(box(0.012, 0.012, 0.16), '#3b2a17', { p: [0.215, 0.17, 0], j: 0 });
  for (const z of [0.07, -0.07]) b.add(ball(), '#ff9f6b', { p: [0.19, 0.2, z * 1.6], s: [0.04, 0.03, 0.05], j: 0 });
  return b.build(1);
}

// ───────────────────────── ANACONDA ─────────────────────────
export function buildAnaconda() {
  const b = new GeoBuilder(mulberry32(44));
  const olive = '#5a6e2c';
  const belly = '#c9c26a';
  const spot = '#1d2410';
  const coil = (r, tube, y, n) => {
    b.add(new THREE.TorusGeometry(r, tube, 6, 16), olive, { p: [0, y, 0], r: [Math.PI / 2, 0, 0] });
    b.add(new THREE.TorusGeometry(r - tube * 0.6, tube * 0.45, 4, 16), belly, { p: [0, y - tube * 0.45, 0], r: [Math.PI / 2, 0, 0] });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + y * 7;
      b.add(ball(), spot, { p: [Math.cos(a) * (r + tube * 0.55), y + tube * 0.45, Math.sin(a) * (r + tube * 0.55)], s: [0.07, 0.05, 0.07], j: 0 });
    }
  };
  coil(0.23, 0.08, 0.08, 9);
  coil(0.16, 0.075, 0.21, 7);
  const neck = [
    [0.04, 0.26, 0],
    [0.1, 0.38, 0],
    [0.17, 0.45, 0],
    [0.24, 0.47, 0],
  ];
  for (let i = 0; i < neck.length - 1; i++) b.add(cyl(0.065, 0.07, 7), olive, { m: seg(neck[i], neck[i + 1]) });
  // cabeza grande y redondeada
  b.add(ball2(), olive, { p: [0.31, 0.48, 0], s: [0.28, 0.18, 0.24] });
  b.add(ball2(), belly, { p: [0.33, 0.43, 0], s: [0.22, 0.07, 0.18] });
  for (const z of [0.065, -0.065]) eye(b, [0.36, 0.55, z + 0.01], 0.045, [1, 0.2, z > 0 ? 0.6 : 0.1]);
  b.add(box(0.07, 0.006, 0.012), '#d6223a', { p: [0.48, 0.45, 0], j: 0 });
  for (const z of [0.012, -0.012]) b.add(box(0.03, 0.006, 0.008), '#d6223a', { p: [0.525, 0.45, z], r: [0, z > 0 ? -0.5 : 0.5, 0], j: 0 });
  return b.build(1);
}

// ───────────────────────── GUACAMAYA ─────────────────────────
export function buildGuacamaya() {
  // guacamaya bandera (Ara macao): roja, con franja amarilla y plumas azules
  const b = new GeoBuilder(mulberry32(45));
  const red = '#d62828';
  const yellow = '#f2c230';
  const blue = '#1e5fbf';
  for (const z of [0.06, -0.06]) {
    b.add(cyl(0.022, 0.026), '#4a4a4a', { m: seg([0.02, 0.12, z], [0.03, 0.03, z]) });
    b.add(box(0.1, 0.025, 0.03), '#3a3a3a', { p: [0.05, 0.0125, z], j: 0 });
    b.add(box(0.05, 0.022, 0.025), '#3a3a3a', { p: [-0.02, 0.011, z], j: 0 });
  }
  // cola larga hasta el suelo
  b.add(ball(), red, { m: seg([-0.06, 0.16, 0], [-0.4, 0.02, 0], 0.11, 0.05) });
  b.add(ball(), blue, { m: seg([-0.26, 0.08, 0], [-0.46, 0.0, 0], 0.07, 0.04) });
  // cuerpo rechoncho
  b.add(ball2(), red, { p: [0, 0.24, 0], s: [0.27, 0.32, 0.25], r: [0, 0, -0.25] });
  for (const z of [0.12, -0.12]) {
    b.add(ball(), yellow, { p: [-0.01, 0.28, z], s: [0.18, 0.13, 0.05], r: [0, 0, -0.4] });
    b.add(ball(), '#3f9b4a', { p: [-0.05, 0.22, z * 1.02], s: [0.18, 0.1, 0.05], r: [0, 0, -0.5] });
    b.add(ball(), blue, { p: [-0.1, 0.15, z * 1.04], s: [0.22, 0.09, 0.05], r: [0, 0, -0.6] });
  }
  // cabeza grande con cara blanca y pico curvo
  b.add(ball2(), red, { p: [0.05, 0.5, 0], s: 0.32 });
  b.add(ball2(), '#f5f1e8', { p: [0.14, 0.49, 0], s: [0.12, 0.18, 0.25] });
  for (const z of [0.07, -0.07]) eye(b, [0.18, 0.53, z + 0.01], 0.042, [1, 0, z > 0 ? 0.55 : 0.1]);
  b.add(cone(0.06, 0.15, 7), '#efe3c4', { m: seg([0.17, 0.47, 0], [0.3, 0.38, 0], 1, 0.8) });
  b.add(cone(0.042, 0.08, 6), '#2b2b2b', { m: seg([0.17, 0.42, 0], [0.24, 0.38, 0], 1, 0.8) });
  for (let i = 0; i < 3; i++) b.add(cone(0.03, 0.08, 4), i === 1 ? yellow : red, { m: seg([0.0, 0.62, 0], [-0.08 - i * 0.02, 0.7 - i * 0.03, (i - 1) * 0.04]) });
  return b.build(1);
}

// ───────────────────────── TORTUGA CHARAPA ─────────────────────────
function shellPattern(b, cx, cy, rx, ry, rz) {
  // placas del caparazón sobre una semiesfera
  const plates = [[0, 1]];
  for (let i = 0; i < 6; i++) plates.push([(i / 6) * Math.PI * 2, 0.62]);
  for (const [a, h] of plates) {
    const r = Math.sqrt(1 - h * h);
    const px = cx + Math.cos(a) * r * rx * 0.95;
    const pz = Math.sin(a) * r * rz * 0.95;
    const py = cy + h * ry;
    b.add(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 6), '#3c4622', { p: [px, py, pz], r: [Math.sin(a) * (1 - h) * 0.9, 0, -Math.cos(a) * (1 - h) * 0.9], j: 0.05 });
  }
}

export function buildTortuga() {
  const b = new GeoBuilder(mulberry32(46));
  const skin = '#6b7a52';
  for (const [x, z] of [
    [0.18, 0.2],
    [0.18, -0.2],
    [-0.18, 0.2],
    [-0.18, -0.2],
  ]) b.add(ball(), skin, { p: [x, 0.04, z], s: [0.14, 0.07, 0.12], r: [0, x * z > 0 ? 0.5 : -0.5, 0] });
  b.add(cone(0.035, 0.1, 5), skin, { p: [-0.33, 0.06, 0], r: [0, 0, Math.PI / 2] });
  b.add(new THREE.CylinderGeometry(0.31, 0.29, 0.05, 12), '#c9b86a', { p: [0, 0.075, 0], s: [1.05, 1, 0.9] });
  b.add(new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#4f5a2e', { p: [0, 0.09, 0], s: [0.64, 0.42, 0.56] });
  shellPattern(b, 0, 0.09, 0.32, 0.21, 0.28);
  // cabeza grande con manchas amarillas
  b.add(cyl(0.055, 0.065, 6), skin, { m: seg([0.24, 0.1, 0], [0.33, 0.15, 0]) });
  b.add(ball2(), skin, { p: [0.4, 0.19, 0], s: [0.22, 0.2, 0.21] });
  for (const z of [0.07, -0.07]) b.add(ball(), '#f2d046', { p: [0.37, 0.27, z], s: [0.06, 0.03, 0.05], j: 0 });
  for (const z of [0.055, -0.055]) eye(b, [0.47, 0.22, z + 0.01], 0.038, [1, 0, z > 0 ? 0.55 : 0.1]);
  b.add(box(0.012, 0.01, 0.06), '#2d3320', { p: [0.505, 0.15, 0.01], j: 0 });
  return b.build(1);
}

/** Caparazón cerrado que rueda como una rueda (eje z). Centrado en el eje para poder girarlo. */
export function buildTortugaShell() {
  const b = new GeoBuilder(mulberry32(47));
  b.add(new THREE.SphereGeometry(0.5, 12, 8), '#4f5a2e', { s: [0.5, 0.5, 0.36] });
  b.add(new THREE.TorusGeometry(0.245, 0.03, 4, 18), '#c9b86a', {});
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    for (const z of [0.12, -0.12]) b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 6), '#3c4622', { p: [Math.cos(a) * 0.15, Math.sin(a) * 0.15, z], r: [Math.PI / 2, 0, 0] });
  }
  for (const z of [0.18, -0.18]) b.add(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 6), '#3c4622', { p: [0, 0, z], r: [Math.PI / 2, 0, 0] });
  return b.build(1);
}

// ───────────────────────── CHIGÜIRO ─────────────────────────
export function buildChiguiro() {
  const b = new GeoBuilder(mulberry32(48));
  const fur = '#8b5e3c';
  const dark = '#5e3d25';
  for (const [x, z] of [
    [0.14, 0.11],
    [0.14, -0.11],
    [-0.17, 0.12],
    [-0.17, -0.12],
  ]) {
    b.add(cyl(0.05, 0.045), fur, { m: seg([x, 0.14, z], [x, 0.03, z]) });
    b.add(ball(), '#3a2616', { p: [x + 0.02, 0.02, z], s: [0.09, 0.04, 0.08] });
  }
  b.add(ball2(), fur, { p: [-0.03, 0.22, 0], s: [0.52, 0.32, 0.36] });
  b.add(ball(), dark, { p: [-0.05, 0.35, 0], s: [0.34, 0.07, 0.2] });
  // cabeza grande y chata
  b.add(ball2(), fur, { p: [0.24, 0.34, 0], s: [0.32, 0.3, 0.28] });
  b.add(ball2(), dark, { p: [0.37, 0.29, 0], s: [0.18, 0.2, 0.22] });
  b.add(box(0.03, 0.05, 0.08), '#2b1d14', { p: [0.45, 0.32, 0], j: 0 });
  for (const z of [0.014, -0.014]) b.add(box(0.02, 0.04, 0.02), '#fffbe8', { p: [0.44, 0.2, z], j: 0 });
  for (const z of [0.08, -0.08]) eye(b, [0.32, 0.39, z + 0.012], 0.042, [1, 0, z > 0 ? 0.6 : 0.1]);
  for (const z of [0.1, -0.1]) b.add(ball(), dark, { p: [0.19, 0.48, z], s: [0.06, 0.06, 0.04] });
  return b.build(1);
}

// ───────────────────────── MARIPOSA MORFO ─────────────────────────
// Una flor plantada en el suelo y la mariposa que revolotea encima (con alas animadas).
export const MARIPOSA_BUG_Y = 0.62;

function mariposaFlower(b) {
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    b.add(ball(5, 3), '#3d9b40', { m: seg([0, 0.01, 0], [Math.cos(a) * 0.2, 0.06, Math.sin(a) * 0.2], 0.12, 0.02, a) });
  }
  b.add(cyl(0.018, 0.022), '#3b7d2c', { m: seg([0, 0, 0], [0.02, 0.42, 0]) });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.add(ball(5, 3), '#ff7aa8', { p: [0.02 + Math.cos(a) * 0.06, 0.44, Math.sin(a) * 0.06], s: [0.09, 0.03, 0.06], r: [0, -a, 0] });
  }
  b.add(ball(5, 4), '#ffd23f', { p: [0.02, 0.455, 0], s: 0.05 });
}

function mariposaBug(b) {
  b.add(cyl(0.022, 0.016, 6), '#1b1b2a', { m: seg([-0.12, 0, 0], [0.07, 0, 0]) });
  // cabeza grande con ojos de juguete
  b.add(ball2(), '#22223a', { p: [0.12, 0.01, 0], s: 0.12 });
  for (const z of [0.03, -0.03]) eye(b, [0.165, 0.025, z + 0.005], 0.025, [1, 0.1, z > 0 ? 0.6 : 0.1]);
  for (const z of [0.025, -0.025]) {
    b.add(cyl(0.004, 0.004, 4), '#1b1b2a', { m: seg([0.14, 0.06, z], [0.2, 0.15, z * 3]) });
    b.add(ball(), '#2f8cff', { p: [0.2, 0.15, z * 3], s: 0.025 });
  }
}

/** Ala (lado +z si side = 1), con la bisagra en el eje x. */
export function buildMariposaWing(side) {
  const b = new GeoBuilder(mulberry32(49 + side));
  const s = side;
  b.add(ball(8, 4), '#111522', { p: [0.04, -0.004, 0.17 * s], s: [0.3, 0.012, 0.33] });
  b.add(ball(8, 4), '#2f8cff', { p: [0.035, 0.002, 0.16 * s], s: [0.25, 0.012, 0.27] });
  b.add(ball(8, 4), '#111522', { p: [-0.09, -0.004, 0.13 * s], s: [0.22, 0.012, 0.24] });
  b.add(ball(8, 4), '#1f6fe0', { p: [-0.09, 0.002, 0.125 * s], s: [0.18, 0.012, 0.19] });
  for (const k of [0, 1]) b.add(ball(4, 3), '#ffffff', { p: [0.1 - k * 0.04, 0.008, (0.25 + k * 0.03) * s], s: 0.018, j: 0 });
  return b.build(1);
}

export function buildMariposaFlower() {
  const b = new GeoBuilder(mulberry32(50));
  mariposaFlower(b);
  return b.build(1);
}

export function buildMariposaBug() {
  const b = new GeoBuilder(mulberry32(51));
  mariposaBug(b);
  return b.build(1);
}

/** Versión estática (alas abiertas) para la carta y la vista previa. */
export function buildMariposa() {
  const b = new GeoBuilder(mulberry32(52));
  mariposaFlower(b);
  const up = new THREE.Matrix4().makeTranslation(0, MARIPOSA_BUG_Y, 0);
  b.addBuilt(buildMariposaBug(), up);
  for (const side of [1, -1]) {
    const m = new THREE.Matrix4().makeRotationX(-0.45 * side).premultiply(up);
    b.addBuilt(buildMariposaWing(side), m);
  }
  return b.build(1);
}
