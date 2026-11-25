// Escenario del diorama: terreno (orilla talada, río, isla de manglar, orilla de selva), agua animada,
// decoración, la empresa DEFORESTA S.A. y el Mangle madre. Estilo caricatura.
import * as THREE from 'three';
import { BOARD, LAYOUT, ISLAND } from './config.js';
import { GeoBuilder, mulberry32, seg, cyl, ball, cone, capsule, rbox, eye, blush, CLIP, toon, pick, U } from './models.js';
import { asset } from './assets.js';
import { regionAt, groundAt, depthAt, bankZ, frontZ, LAND, colX, rowZ, CELL, ROWS, COLS, WATER_Y, LAND_Y, BANK_Y } from './terrain.js';

const L = LAYOUT;
const T = BOARD.thickness;
const _c = new THREE.Color();
const _c2 = new THREE.Color();

// ruido suave para manchas de color
const noise = (x, z) => Math.sin(x * 41 + Math.sin(z * 23)) * 0.5 + Math.sin(z * 37 + x * 13) * 0.5;

const COL = {
  bank: '#c9a06a',
  bankDark: '#b2875a',
  land: '#67bd52',
  landDark: '#58ad46',
  sand: '#f1dca4',
  bedShallow: '#d9d39a',
  bedDeep: '#0f3f57',
  front: '#4fa040',
  frontDark: '#43913a',
  earth: '#7a5236',
  earthDark: '#5b3c26',
};

function terrainColor(x, z, out) {
  const reg = regionAt(x, z);
  const n = noise(x, z);
  if (reg === 'bank') return out.set(n > 0.35 ? COL.bankDark : COL.bank);
  if (reg === 'front') return out.set(n > 0.3 ? COL.frontDark : COL.front);
  if (reg === 'land') return out.set(n > 0.45 ? COL.landDark : COL.land);
  if (reg === 'sand') return out.set(COL.sand);
  return out.set(COL.bedShallow).lerp(_c2.set(COL.bedDeep), depthAt(x, z));
}

/** Terreno: una malla de alturas con colores por vértice. */
export function buildTerrain() {
  const nx = 150;
  const nz = 120;
  const g = new THREE.PlaneGeometry(L.totalW, L.totalD, nx, nz).rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = Math.max(L.left + 1e-4, Math.min(L.right - 1e-4, pos.getX(i)));
    const z = Math.max(L.back + 1e-4, Math.min(L.front - 1e-4, pos.getZ(i)));
    pos.setY(i, groundAt(x, z));
    terrainColor(x, z, _c);
    col[i * 3] = _c.r;
    col[i * 3 + 1] = _c.g;
    col[i * 3 + 2] = _c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

/** Costados del diorama: tierra con estratos y, donde hay río, el agua vista de lado. */
export function buildSkirt() {
  const verts = [];
  const cols = [];
  const quad = (a, b, c, d, color) => {
    _c.set(color);
    for (const v of [a, b, c, a, c, d]) {
      verts.push(...v);
      cols.push(_c.r, _c.g, _c.b);
    }
  };
  const N = 120;
  const edges = [
    (t) => [L.left + t * L.totalW, L.front, 1], // frente (mira a +z)
    (t) => [L.right - t * L.totalW, L.back, 1],
    (t) => [L.left, L.back + t * L.totalD, 0],
    (t) => [L.right, L.front - t * L.totalD, 0],
  ];
  const bottom = -T;
  for (const ed of edges) {
    for (let i = 0; i < N; i++) {
      const [x0, z0] = ed(i / N);
      const [x1, z1] = ed((i + 1) / N);
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const inset = 1e-4;
      const g0 = groundAt(Math.min(L.right - inset, Math.max(L.left + inset, x0)), Math.min(L.front - inset, Math.max(L.back + inset, z0)));
      const g1 = groundAt(Math.min(L.right - inset, Math.max(L.left + inset, x1)), Math.min(L.front - inset, Math.max(L.back + inset, z1)));
      quad([x0, bottom, z0], [x1, bottom, z1], [x1, bottom * 0.62, z1], [x0, bottom * 0.62, z0], COL.earthDark);
      quad([x0, bottom * 0.62, z0], [x1, bottom * 0.62, z1], [x1, g1, z1], [x0, g0, z0], COL.earth);
      const reg = regionAt(Math.min(L.right - inset, Math.max(L.left + inset, cx)), Math.min(L.front - inset, Math.max(L.back + inset, cz)));
      if (reg === 'water' || (g0 < WATER_Y && g1 < WATER_Y)) quad([x0, Math.min(g0, WATER_Y), z0], [x1, Math.min(g1, WATER_Y), z1], [x1, WATER_Y, z1], [x0, WATER_Y, z0], '#4fb0cc');
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

/** Superficie del río con una textura de corriente que se desplaza. */
export function buildWater() {
  // Textura del río de la página interactiva de PyCon 2028 (mapa de normales): ondas que corren con la corriente
  const normal = new THREE.TextureLoader().load(import.meta.env.BASE_URL + 'tex/agua_n.jpg');
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.repeat.set(5, 4);
  const mat = new THREE.MeshPhongMaterial({
    color: '#4fa9c4',
    specular: '#e8fbff',
    shininess: 90,
    normalMap: normal,
    normalScale: new THREE.Vector2(0.55, 0.55),
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    clippingPlanes: CLIP,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(L.totalW, L.totalD).rotateX(-Math.PI / 2), mat);
  mesh.position.y = WATER_Y;
  mesh.renderOrder = 2;
  return mesh;
}

/** (Ya no se usa) agua dibujada en un canvas. */
export function buildWaterCanvas() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 256);
  const R = mulberry32(5);
  ctx.strokeStyle = 'rgba(255,255,255,1)';
  ctx.lineCap = 'round';
  // fondo azul + rayitas claras de corriente
  ctx.fillStyle = '#58bcd8';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 26; i++) {
    const x = R() * 256;
    const y = R() * 256;
    const w = 20 + R() * 50;
    ctx.strokeStyle = `rgba(230,250,255,${0.35 + R() * 0.4})`;
    ctx.lineWidth = 3 + R() * 3;
    for (const dx of [0, 256, -256]) {
      ctx.beginPath();
      ctx.moveTo(x + dx, y);
      ctx.quadraticCurveTo(x + dx + w / 2, y - 4, x + dx + w, y);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 3.2);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.5, depthWrite: false, clippingPlanes: CLIP });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(L.totalW, L.totalD).rotateX(-Math.PI / 2), mat);
  mesh.position.y = WATER_Y;
  mesh.renderOrder = 2;
  return mesh;
}

/** Casillas de la isla donde se puede plantar (cuadros redondeados un poco más claros). */
export function buildTiles(row = null) {
  const b = new GeoBuilder();
  for (let r = 0; r < ROWS; r++) {
    if (row !== null && r !== row) continue;
    for (let c = 0; c < COLS; c++) {
      if (!LAND[r][c]) continue;
      b.add(rbox(0.3), (r + c) % 2 ? '#79c962' : '#6dc157', { p: [colX(c), LAND_Y + 0.0006, rowZ(r)], s: [CELL * 0.9, 0.0018, CELL * 0.9] });
    }
  }
  return b.parts.length ? b.build() : null;
}

// ───────────────────────── vegetación de la landing de PyCon 2028 ─────────────────────────
const _vm = new THREE.Matrix4();
const _vq = new THREE.Quaternion();
const _vy = new THREE.Vector3(0, 1, 0);
const _vp = new THREE.Vector3();
const _vs = new THREE.Vector3();
/** Pone un modelo de la landing (public/models/vegetacion.glb) a escala k (1 = su tamaño en casillas). */
function veg(b, name, x, y, z, k = 1, yaw = 0) {
  const g = asset(name);
  if (!g) return false;
  _vm.compose(_vp.set(x, y, z), _vq.setFromAxisAngle(_vy, yaw), _vs.set(k * U, k * U, k * U));
  b.addBuilt(g, _vm);
  return true;
}

/** Vegetación (sin contorno): pasto de la isla, matas de la orilla de selva, lirios y raíces de mangle. */
export function buildVegetation() {
  const R = mulberry32(77);
  const b = new GeoBuilder(R);
  if (!asset('pasto')) return null;
  const grass = (x, z, k) => veg(b, 'pasto', x, groundAt(x, z) - 0.0005, z, k, R() * 6.28);
  // ── isla: mucho pasto en las esquinas de las casillas y en el borde de la tierra ──
  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c <= COLS; c++) {
      const x = LAYOUT.gridX0 + c * CELL + (R() - 0.5) * CELL * 0.12;
      const z = LAYOUT.gridZ0 + r * CELL + (R() - 0.5) * CELL * 0.12;
      if (regionAt(x, z) === 'land') grass(x, z, 0.55 + R() * 0.25);
    }
  }
  // pasto suelto por toda la isla, sin tapar el centro de las casillas
  for (let i = 0; i < 260; i++) {
    const x = ISLAND.cx + (R() * 2 - 1) * ISLAND.landA;
    const z = ISLAND.cz + (R() * 2 - 1) * ISLAND.landB;
    if (regionAt(x, z) !== 'land') continue;
    const fx = (x - LAYOUT.gridX0) / CELL - 0.5;
    const fz = (z - LAYOUT.gridZ0) / CELL - 0.5;
    const inGrid = fx > -0.5 && fx < COLS - 0.5 && fz > -0.5 && fz < ROWS - 0.5;
    const near = Math.hypot(fx - Math.round(fx), fz - Math.round(fz));
    if (inGrid && near < 0.28) continue;
    grass(x, z, 0.4 + R() * 0.35);
  }
  for (let i = 0; i < 110; i++) {
    const a = R() * Math.PI * 2;
    const k = 0.86 + R() * 0.16;
    const x = ISLAND.cx + Math.cos(a) * ISLAND.landA * k;
    const z = ISLAND.cz + Math.sin(a) * ISLAND.landB * k;
    const reg = regionAt(x, z);
    if (reg === 'land' || reg === 'sand') grass(x, z, 0.6 + R() * 0.4);
  }
  // raíces de mangle, helechos y bromelias en la arena de la isla
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + R() * 0.3;
    const x = ISLAND.cx + Math.cos(a) * ISLAND.sandA * 0.95;
    const z = ISLAND.cz + Math.sin(a) * ISLAND.sandB * 0.95;
    if (i % 3 === 0) veg(b, 'raices', x, WATER_Y - 0.002, z, 0.32 + R() * 0.08, R() * 6.28);
    else veg(b, i % 3 === 1 ? 'helecho' : 'bromelia', x, groundAt(x, z), z, 0.5 + R() * 0.2, R() * 6.28);
  }
  // ── río: victorias amazónicas y camalotes en lo bajito ──
  for (let i = 0; i < 16; i++) {
    const x = L.left + 0.03 + R() * (L.totalW - 0.06);
    const front = R() < 0.6;
    const z = front ? frontZ(x) - 0.012 - R() * 0.02 : bankZ(x) + 0.012 + R() * 0.015;
    if (regionAt(x, z) !== 'water' || depthAt(x, z) > 0.4) continue;
    if (R() < 0.6) veg(b, R() < 0.5 ? 'victoria' : 'victoria_b', x, WATER_Y + 0.0006, z, 0.22 + R() * 0.12, R() * 6.28);
    else veg(b, 'camalote', x, WATER_Y - 0.001, z, 0.45 + R() * 0.2, R() * 6.28);
  }
  // ── orilla de selva (la del usuario): matas bajas para no tapar el juego, más altas en las esquinas ──
  const lows = ['helecho', 'heliconia_pl', 'bromelia', 'musgo_a', 'musgo_b', 'flores', 'orquidea', 'pasto', 'pasto', 'hongos'];
  for (let x = L.left + 0.012; x < L.right - 0.008; x += 0.026 + R() * 0.012) {
    for (let k = 0; k < 2; k++) {
      const z = frontZ(x) + 0.012 + R() * (L.front - frontZ(x) - 0.024);
      const name = pick(lows, R);
      veg(b, name, x + (R() - 0.5) * 0.01, BANK_Y, z, name === 'heliconia_pl' ? 0.5 : 0.55 + R() * 0.25, R() * 6.28);
    }
  }
  // ── selva tupida en la orilla del usuario: árboles grandes y frondosos de la landing a lo largo del borde,
  //    más bajos en el centro (para no tapar el río) y más altos hacia las esquinas ──
  const trees = ['arbol_a', 'arbol_b', 'arbol_orilla_a', 'arbol_orilla_b', 'arbol_orilla_c'];
  if (asset('arbol_a')) {
    for (let x = L.left + 0.025, i = 0; x < L.right - 0.015; x += 0.05 + R() * 0.02, i++) {
      const t = Math.min(1, Math.abs(x) / (L.totalW / 2));
      veg(b, trees[i % trees.length], x, BANK_Y, L.front - 0.012 - R() * 0.01, 0.42 + 0.45 * t * t + R() * 0.08, R() * 6.28);
    }
    // segunda fila en las esquinas, más adentro, y árboles por los costados cercanos
    for (const s of [-1, 1]) {
      for (let j = 0; j < 3; j++) {
        const x = s * (L.totalW / 2 - 0.06 - j * 0.07 - R() * 0.02);
        veg(b, pick(trees, R), x, BANK_Y, L.front - 0.035 - R() * 0.01, 0.7 + R() * 0.2 - j * 0.1, R() * 6.28);
      }
      veg(b, 'cecropia', s * (L.totalW / 2 - 0.02), BANK_Y, L.front - 0.045, 0.62, R() * 6.28);
      veg(b, 'helecho_arb', s * (L.totalW / 2 - 0.1), BANK_Y, L.front - 0.03, 0.7, R() * 6.28);
    }
    // sotobosque entre los troncos
    for (let x = L.left + 0.02; x < L.right - 0.01; x += 0.035 + R() * 0.015) {
      veg(b, pick(['helecho_arb', 'heliconia_pl', 'helecho', 'bromelia'], R), x, BANK_Y, L.front - 0.02 - R() * 0.02, 0.45 + R() * 0.25, R() * 6.28);
    }
  } else {
    for (const [x, name, k] of [[L.left + 0.05, 'helecho_arb', 0.75], [L.right - 0.05, 'cecropia', 0.62], [L.left + 0.13, 'aguaje', 0.5], [L.right - 0.14, 'helecho_arb', 0.6]]) {
      veg(b, name, x, BANK_Y, L.front - 0.035, k, R() * 6.28);
    }
  }
  // lo poco que DEFORESTA S.A. aún no ha talado al fondo
  veg(b, 'aguaje', L.left + 0.04, BANK_Y, L.back + 0.04, 0.55, 1);
  veg(b, 'tronco', L.left + 0.2, BANK_Y, L.back + 0.06, 0.6, 0.3);
  return b.build();
}

// ───────────────────────── decoración ─────────────────────────
function stump(b, x, z, r, h, y) {
  b.add(cyl(r * 0.9, r * 1.15), '#7b5232', { p: [x, y + h / 2, z], s: [1, h, 1] });
  b.add(cyl(r * 0.86, r * 0.86), '#e2bb83', { p: [x, y + h + 0.0005, z], s: [1, 0.001, 1] });
  b.add(cyl(r * 0.4, r * 0.4), '#c1965c', { p: [x, y + h + 0.0011, z], s: [1, 0.0006, 1] });
}
function log(b, x, z, len, r, ang, y) {
  const dx = (Math.cos(ang) * len) / 2;
  const dz = (Math.sin(ang) * len) / 2;
  b.add(cyl(r, r), '#835a35', { m: seg([x - dx, y + r, z - dz], [x + dx, y + r, z + dz]) });
  b.add(cyl(r * 0.82, r * 0.82), '#e2bb83', { m: seg([x + dx, y + r, z + dz], [x + dx * 1.02, y + r, z + dz * 1.02]) });
}
function bush(b, x, z, s, y, R, colors = ['#3c9a42', '#47a84b', '#2f8a3a']) {
  b.add(ball(), pick(colors, R), { p: [x, y + s * 0.45, z], s: [s * 2, s * 1.4, s * 2] });
  b.add(ball(), pick(colors, R), { p: [x + s * 0.6, y + s * 0.35, z + s * 0.3], s: [s * 1.3, s, s * 1.3] });
  if (R() < 0.3) b.add(ball(), pick(['#ff5c8a', '#ffd23f', '#ff7a3c'], R), { p: [x - s * 0.3, y + s * 1.05, z + s * 0.4], s: s * 0.45 });
}
function rock(b, x, z, s, y, R) {
  b.add(ball(), pick(['#9aa3a6', '#8b9497', '#a9b0b2'], R), { p: [x, y, z], s: [s * 1.4, s, s * 1.1], r: [0, R() * 3, 0] });
}
function reed(b, x, z, h, y) {
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    b.add(cyl(0.0009, 0.0012), '#5f9a3a', { m: seg([x, y, z], [x + Math.cos(a) * h * 0.18, y + h, z + Math.sin(a) * h * 0.18]) });
  }
  b.add(capsule(0.0018, 0.008), '#7a4a26', { p: [x, y + h * 0.95, z] });
}
function deadTree(b, x, z, h, y) {
  b.add(cyl(h * 0.035, h * 0.06), '#8a6f55', { m: seg([x, y, z], [x, y + h, z]) });
  b.add(cyl(h * 0.02, h * 0.03), '#8a6f55', { m: seg([x, y + h * 0.6, z], [x + h * 0.25, y + h * 0.85, z + h * 0.05]) });
  b.add(cyl(h * 0.018, h * 0.026), '#8a6f55', { m: seg([x, y + h * 0.75, z], [x - h * 0.2, y + h, z - h * 0.05]) });
}
/** Raíces arqueadas de mangle en la orilla de la isla. */
function mangroveRoots(b, x, z, s, ang, y) {
  for (let i = 0; i < 3; i++) {
    const a = ang + (i - 1) * 0.6;
    const ox = Math.cos(a) * s;
    const oz = Math.sin(a) * s;
    b.add(new THREE.TorusGeometry(0.5, 0.07, 6, 14, Math.PI), '#7c5a3c', { p: [x + ox * 0.5, y, z + oz * 0.5], r: [0, -a, 0], s: [s, s * 0.9, s] });
  }
  b.add(ball(), '#3f9a45', { p: [x, y + s * 0.75, z], s: [s * 1.3, s * 0.8, s * 1.3] });
}

export function buildProps() {
  const R = mulberry32(61);
  const b = new GeoBuilder(R);
  // ── orilla talada: tocones, troncos, árboles secos, pasto seco ──
  for (let i = 0; i < 26; i++) {
    const x = L.left + 0.03 + R() * (L.totalW - 0.06);
    const zb = bankZ(x);
    const z = L.back + 0.015 + R() * (zb - L.back - 0.03);
    if (x > 0.17 && z < -0.3) continue; // ahí está la empresa
    stump(b, x, z, 0.007 + R() * 0.006, 0.006 + R() * 0.008, BANK_Y);
  }
  for (let i = 0; i < 5; i++) {
    const x = L.left + 0.06 + R() * 0.6;
    log(b, x, L.back + 0.03 + R() * 0.06, 0.04 + R() * 0.03, 0.0045, R() * 3, BANK_Y);
  }
  deadTree(b, -0.42, -0.36, 0.07, BANK_Y);
  deadTree(b, -0.06, -0.38, 0.055, BANK_Y);
  for (let i = 0; i < 40; i++) {
    const x = L.left + R() * L.totalW;
    const z = L.back + R() * (bankZ(x) - L.back);
    b.add(cone(0.0025, 0.008, 6), pick(['#d4bd78', '#c4a964', '#e0cd8a'], R), { p: [x, BANK_Y + 0.004, z] });
  }
  // huellas de máquinas que bajan hacia el río
  for (let i = 0; i < 5; i++) {
    const x = -0.38 + i * 0.17;
    for (const off of [-0.012, 0.012]) b.add(rbox(0.4), '#a98252', { p: [x + off, BANK_Y + 0.0004, -0.33], s: [0.007, 0.0008, 0.12], r: [0, x * 0.4, 0] });
  }
  // ── río: piedras y juncos en las orillas ──
  for (let i = 0; i < 14; i++) {
    const x = L.left + R() * L.totalW;
    const z = bankZ(x) + 0.004 + R() * 0.01;
    rock(b, x, z, 0.004 + R() * 0.005, WATER_Y - 0.001, R);
  }
  for (let i = 0; i < 18; i++) {
    const x = L.left + R() * L.totalW;
    const z = frontZ(x) - 0.004 - R() * 0.012;
    if (R() < 0.5) reed(b, x, z, 0.018 + R() * 0.012, WATER_Y - 0.002);
    else b.add(cyl(0.006, 0.006), '#4caf50', { p: [x, WATER_Y + 0.0006, z - 0.01], s: [1, 0.001, 1] }); // hoja de lirio
  }
  // ── isla: raíces de mangle y juncos en la arena (si no cargó la vegetación de la landing) ──
  for (let i = 0; i < 16 && !asset('pasto'); i++) {
    const a = (i / 16) * Math.PI * 2 + R() * 0.2;
    const x = ISLAND.cx + Math.cos(a) * ISLAND.sandA * 0.93;
    const z = ISLAND.cz + Math.sin(a) * ISLAND.sandB * 0.93;
    if (i % 2) mangroveRoots(b, x, z, 0.014 + R() * 0.006, a, WATER_Y);
    else reed(b, x, z, 0.02, WATER_Y);
  }
  // cangrejitos rojos en la arena
  for (const a of [0.4, 2.6, 4.2]) {
    const x = ISLAND.cx + Math.cos(a) * ISLAND.sandA * 0.96;
    const z = ISLAND.cz + Math.sin(a) * ISLAND.sandB * 0.96;
    b.add(ball(), '#e2492f', { p: [x, WATER_Y + 0.003, z], s: [0.008, 0.004, 0.006] });
    for (const s of [-1, 1]) b.add(ball(), '#e2492f', { p: [x + 0.004, WATER_Y + 0.004, z + s * 0.004], s: 0.003 });
  }
  // ── orilla de selva (la del usuario): matas bajas (solo si no cargó la vegetación de la landing) ──
  for (let x = L.left + 0.01; x < L.right && !asset('pasto'); x += 0.022 + R() * 0.01) {
    const z = frontZ(x) + 0.01 + R() * (L.front - frontZ(x) - 0.02);
    if (R() < 0.75) bush(b, x, z, 0.006 + R() * 0.005, BANK_Y, R);
    else b.add(cone(0.004, 0.016, 8), '#2f8a3a', { p: [x, BANK_Y + 0.008, z] });
  }
  return b.build();
}

// ───────────────────────── DEFORESTA S.A. ─────────────────────────
export const SIGN_YAW = -0.35;
export function buildCompany() {
  const b = new GeoBuilder(mulberry32(71));
  const bx = 0.33;
  const bz = -0.365;
  const bw = 0.2;
  const bd = 0.06;
  const bh = 0.06;
  const y0 = BANK_Y;
  b.add(rbox(0.06), '#9ba8ae', { p: [bx, y0 + bh / 2, bz], s: [bw, bh, bd] });
  for (let x = bx - bw / 2 + 0.012; x < bx + bw / 2; x += 0.02) b.add(rbox(0.3), '#86949a', { p: [x, y0 + bh / 2, bz + bd / 2 + 0.0005], s: [0.004, bh * 0.9, 0.002] });
  // techo rojo redondeado
  b.add(capsule(0.035, bw + 0.04), '#c0392b', { p: [bx, y0 + bh + 0.004, bz], r: [0, 0, Math.PI / 2], s: [1, 1, bd / 0.07] });
  // portón (de aquí salen las máquinas)
  b.add(rbox(0.2), '#22262d', { p: [bx - 0.04, y0 + 0.018, bz + bd / 2 + 0.001], s: [0.05, 0.036, 0.003] });
  b.add(rbox(0.3), '#f1c40f', { p: [bx - 0.04, y0 + 0.039, bz + bd / 2 + 0.002], s: [0.056, 0.006, 0.004] });
  // chimenea
  const chx = bx + 0.06;
  b.add(cyl(0.009, 0.011), '#5b5b5b', { m: seg([chx, y0 + bh, bz], [chx, y0 + bh + 0.07, bz]) });
  for (const y of [0.04, 0.06]) b.add(cyl(0.0115, 0.0115), '#c0392b', { m: seg([chx, y0 + bh + y, bz], [chx, y0 + bh + y + 0.007, bz]) });
  // pila de troncos "cosechados"
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 3 - row; k++) {
      const z = -0.33 + (k - (2 - row) / 2) * 0.011;
      const y = y0 + 0.0055 + row * 0.009;
      b.add(cyl(0.0055, 0.0055), k % 2 ? '#8a5e34' : '#7d5532', { m: seg([0.16, y, z], [0.21, y, z]) });
      b.add(cyl(0.0045, 0.0045), '#e2bb83', { m: seg([0.21, y, z], [0.2108, y, z]) });
    }
  }
  const signCenter = new THREE.Vector3(bx - 0.005, y0 + bh + 0.06, bz + 0.01);
  const ax = new THREE.Vector3(Math.cos(SIGN_YAW), 0, -Math.sin(SIGN_YAW));
  for (const s of [-0.055, 0.055]) {
    const p = signCenter.clone().addScaledVector(ax, s);
    b.add(cyl(0.0022, 0.0022), '#444444', { m: seg([p.x, y0 + bh - 0.004, p.z - 0.003], [p.x, signCenter.y, p.z - 0.003]) });
  }
  return { geo: b.build(), smoke: new THREE.Vector3(chx, y0 + bh + 0.075, bz), signCenter };
}

// ───────────────────────── CORAZÓN DE LA ISLA ─────────────────────────
/** El centro de la isla que hay que proteger: una pradera tupida de pasto y flores (sin árbol). */
export function buildMeadow() {
  const R = mulberry32(93);
  const b = new GeoBuilder(R);
  if (!asset('pasto')) return null;
  for (let i = 0; i < 64; i++) {
    const a = R() * Math.PI * 2;
    const r = Math.sqrt(R()) * 0.98;
    const x = Math.cos(a) * r * CELL;
    const z = Math.sin(a) * r * CELL * 0.95;
    const name = i % 8 === 0 ? 'heliconia_pl' : i % 6 === 0 ? 'flores' : i % 11 === 0 ? 'helecho' : 'pasto';
    veg(b, name, x, 0, z, (name === 'pasto' ? 0.9 + R() * 0.6 : 0.45 + R() * 0.2) * (1.15 - r * 0.35), R() * 6.28);
  }
  return b.build();
}

// ───────────────────────── MANGLE MADRE (respaldo si no cargan los modelos) ─────────────────────────
/** El árbol que hay que proteger: mangle con raíces zancudas y cara amable (mira al usuario, +z). */
export function buildHeart() {
  const b = new GeoBuilder(mulberry32(91));
  // raíces zancudas en arco
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.2;
    const ox = Math.cos(a);
    const oz = Math.sin(a);
    const pts = [
      [ox * 0.1, 0.62, oz * 0.1],
      [ox * 0.42, 0.55, oz * 0.42],
      [ox * 0.68, 0.28, oz * 0.68],
      [ox * 0.78, 0.0, oz * 0.78],
    ];
    for (let k = 0; k < pts.length - 1; k++) b.add(cyl(0.05 - k * 0.008, 0.055 - k * 0.008), k % 2 ? '#7a573a' : '#83603f', { m: seg(pts[k], pts[k + 1]) });
  }
  // tronco
  b.add(cyl(0.2, 0.26), '#8b6644', { p: [0, 1.05, 0], s: [1, 0.95, 1] });
  b.add(ball(), '#8b6644', { p: [0, 0.6, 0], s: [0.5, 0.25, 0.5] });
  // cara (hacia el usuario)
  for (const x of [-0.09, 0.09]) eye(b, [x, 1.12, 0.2], 0.055, [0, 0, 1]);
  for (const x of [-0.17, 0.17]) blush(b, [x, 1.0, 0.19], 0.07);
  b.add(new THREE.TorusGeometry(0.05, 0.014, 6, 12, Math.PI), '#3b2a1c', { p: [0, 1.0, 0.22], r: [0, 0, Math.PI] });
  // ramas y copa redonda
  for (const [x, z] of [
    [0.35, 0.1],
    [-0.35, 0.05],
    [0.05, -0.35],
  ]) b.add(cyl(0.05, 0.07), '#8b6644', { m: seg([0, 1.35, 0], [x, 1.6, z]) });
  const greens = ['#2f8f3d', '#3aa048', '#45ad52', '#2a8237'];
  const R = mulberry32(92);
  b.add(ball(), '#2f8f3d', { p: [0, 1.85, 0], s: [1.5, 0.75, 1.4] });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.add(ball(), pick(greens, R), { p: [Math.cos(a) * 0.55, 1.8 + R() * 0.15, Math.sin(a) * 0.5], s: [0.65, 0.5, 0.6] });
  }
  b.add(ball(), '#4cb658', { p: [0.1, 2.15, 0.1], s: [0.8, 0.45, 0.75] });
  // florecitas blancas del mangle
  for (let i = 0; i < 9; i++) {
    const a = R() * Math.PI * 2;
    b.add(ball(), '#fff6e0', { p: [Math.cos(a) * 0.6, 1.9 + R() * 0.3, Math.sin(a) * 0.55 + 0.05], s: 0.07 });
  }
  return b.build(U);
}

export const HEART_TOP = 2.4 * U;
export const MEADOW_TOP = 0.75 * U;
