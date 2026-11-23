// Geografía del tablero: orilla talada (fondo) → río → isla de manglar (arena + tierra verde) → río → orilla de selva.
// Todas las funciones trabajan en coordenadas locales del tablero, en metros.
import { BOARD, LAYOUT, ISLAND } from './config.js';

export const CELL = BOARD.cell;
export const ROWS = BOARD.rows;
export const COLS = BOARD.cols;
const { cx, cz, landA, landB, sandA, sandB } = ISLAND;

export const LAND_Y = LAYOUT.tileTop;
export const BANK_Y = LAYOUT.groundTop;
export const WATER_Y = LAYOUT.waterY;

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Borde de la orilla talada (fondo) en función de x. */
export const bankZ = (x) => LAYOUT.bankZ + 0.016 * Math.sin(x * 7.3 + 0.6) + 0.008 * Math.sin(x * 17 + 2);
/** Borde de la orilla de selva (cerca del usuario). */
export const frontZ = (x) => LAYOUT.frontZ + 0.01 * Math.sin(x * 9.1 + 1.3) + 0.005 * Math.sin(x * 21);

/** Distancia "elíptica" normalizada al centro de la isla (1 = borde de la elipse). */
const ell = (x, z, a, b) => Math.hypot((x - cx) / a, (z - cz) / b);
/** Contorno ondulado de la isla (para que no sea una elipse perfecta). */
const wobble = (x, z) => 1 + 0.035 * Math.sin(Math.atan2(z - cz, x - cx) * 5 + 0.7) + 0.02 * Math.sin(Math.atan2(z - cz, x - cx) * 9);

/** Distancia aproximada (m) desde (x, z) hasta el borde de la arena de la isla (positiva fuera). */
export function islandDist(x, z) {
  const dx = x - cx;
  const dz = z - cz;
  const r = ell(x, z, sandA, sandB) / wobble(x, z);
  const len = Math.hypot(dx, dz) || 1e-6;
  const rad = len / (r || 1e-6); // radio del contorno en esa dirección
  return len - rad;
}

/** Zona del tablero en (x, z): 'bank' | 'water' | 'sand' | 'land' | 'front' | 'off'. */
export function regionAt(x, z) {
  if (x < LAYOUT.left || x > LAYOUT.right || z < LAYOUT.back || z > LAYOUT.front) return 'off';
  if (z < bankZ(x)) return 'bank';
  if (z > frontZ(x)) return 'front';
  const w = wobble(x, z);
  if (ell(x, z, landA, landB) / w <= 1) return 'land';
  if (ell(x, z, sandA, sandB) / w <= 1) return 'sand';
  return 'water';
}

/** Profundidad del río de 0 (orilla) a 1 (lo más hondo). Fuera del agua es 0. */
export function depthAt(x, z) {
  if (regionAt(x, z) !== 'water') return 0;
  const d = Math.min(z - bankZ(x), frontZ(x) - z, islandDist(x, z), x - LAYOUT.left + 0.2, LAYOUT.right - x + 0.2);
  return smooth(0.004, 0.05, d);
}

/** ¿Está en la parte honda? Ahí no llegan los ataques a distancia. */
export const isDeep = (x, z) => depthAt(x, z) > 0.55;

/** Altura del suelo (o del fondo del río) en (x, z). */
export function groundAt(x, z) {
  const reg = regionAt(x, z);
  if (reg === 'off') return -Infinity;
  if (reg === 'bank' || reg === 'front') return BANK_Y;
  if (reg === 'land') return LAND_Y;
  if (reg === 'sand') {
    // la arena sube desde el agua hasta la tierra
    const k = smooth(1.0, 0.86, ell(x, z, sandA, sandB) / wobble(x, z));
    return WATER_Y - 0.001 + (LAND_Y - WATER_Y) * k;
  }
  return WATER_Y - 0.003 - 0.017 * depthAt(x, z);
}

/** Altura de la superficie (agua o suelo) donde cae algo lanzado. */
export function surfaceAt(x, z) {
  const g = groundAt(x, z);
  if (g === -Infinity) return g;
  return Math.max(g, regionAt(x, z) === 'water' ? WATER_Y : g);
}

// ───────────── casillas de la isla ─────────────
export const colX = (c) => LAYOUT.gridX0 + (c + 0.5) * CELL;
export const rowZ = (r) => LAYOUT.gridZ0 + (r + 0.5) * CELL;

/** Casillas del Mangle madre (centro de la isla). */
export const isHeartCell = (r, c) => (r === 1 || r === 2) && (c === COLS / 2 - 1 || c === COLS / 2);

/** ¿Se puede plantar en (r, c)? Solo en la tierra verde, nunca en la arena ni en el Mangle madre. */
export const LAND = Array.from({ length: ROWS }, (_, r) =>
  Array.from({ length: COLS }, (_, c) => {
    if (isHeartCell(r, c)) return false;
    // la casilla entera (casi) tiene que caer sobre tierra verde
    let inside = 0;
    for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4], [0, 0]]) {
      if (regionAt(colX(c) + dx * CELL, rowZ(r) + dz * CELL) === 'land') inside++;
    }
    return inside >= 4;
  })
);

export function cellAt(x, z) {
  const c = Math.floor((x - LAYOUT.gridX0) / CELL);
  const r = Math.floor((z - LAYOUT.gridZ0) / CELL);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
  return { r, c, land: LAND[r][c] };
}

export const HEART = { x: cx, z: cz };
