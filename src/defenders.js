// Defensores: geometría estática de cada tipo (cartas, fantasma, vista previa)
// y modelos con partes animables para el tablero.
import * as THREE from 'three';
import { U, MATS, addOutline, buildHeliconia, buildAchiote, buildCeiba, buildJabillo, buildShovel } from './models.js';
import {
  buildMono,
  buildRana,
  buildAnaconda,
  buildGuacamaya,
  buildTortuga,
  buildTortugaShell,
  buildChiguiro,
  buildMariposa,
  buildMariposaFlower,
  buildMariposaBug,
  buildMariposaWing,
  MARIPOSA_BUG_Y,
} from './animals.js';

// Los animales se modelan en casillas (escala 1): se pasan a metros con U
const unit = (fn) => () => {
  const g = fn();
  g.scale(U, U, U);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
};

const BUILDERS = {
  heliconia: buildHeliconia,
  achiote: buildAchiote,
  ceiba: buildCeiba,
  jabillo: buildJabillo,
  shovel: buildShovel,
  rana: unit(buildRana),
  mono: unit(buildMono),
  anaconda: unit(buildAnaconda),
  guacamaya: unit(buildGuacamaya),
  tortuga: unit(buildTortuga),
  chiguiro: unit(buildChiguiro),
  mariposa: unit(buildMariposa),
};

const cache = {};
/** Geometría estática (compartida) de un defensor, en metros. */
export function plantGeometry(type) {
  return (cache[type] ??= BUILDERS[type]());
}

// Giro sobre sí mismos para que el usuario les vea la cara (vista 3/4) sin dejar de mirar a los invasores
export const FACE_YAW = { mono: -0.5, rana: -0.45, guacamaya: -0.5, chiguiro: -0.45, tortuga: -0.4, anaconda: -0.45, mariposa: -0.35, ceiba: -0.4, jabillo: -0.5 };

// Boca de los tiradores: [x, y] en casillas, desde el centro de la casilla
export const MUZZLE = { rana: [0.24, 0.18], guacamaya: [0.3, 0.41] };

const partCache = {};
const part = (key, fn) => (partCache[key] ??= unit(fn)());

/** Modelo para el tablero: { root, body, meshes[] } y partes animables (alas, caparazón…). */
export function createDefender(type) {
  const root = new THREE.Group();
  const d = { root, meshes: [], mat: MATS.std };
  const add = (geo, parent = root) => {
    const m = new THREE.Mesh(geo, MATS.std);
    addOutline(m, 0.0009);
    parent.add(m);
    d.meshes.push(m);
    return m;
  };
  if (type === 'mariposa') {
    d.body = add(part('mFlower', buildMariposaFlower));
    d.bug = new THREE.Group();
    d.bug.position.y = MARIPOSA_BUG_Y * U;
    root.add(d.bug);
    add(part('mBug', buildMariposaBug), d.bug);
    d.wingL = add(part('mWingL', () => buildMariposaWing(1)), d.bug);
    d.wingR = add(part('mWingR', () => buildMariposaWing(-1)), d.bug);
  } else if (type === 'tortuga') {
    d.body = add(plantGeometry('tortuga'));
    d.shell = add(part('tShell', buildTortugaShell));
    d.shell.position.y = 0.25 * U;
    d.shell.visible = false;
  } else {
    d.body = add(plantGeometry(type));
  }
  return d;
}

/** Cambia el material de todas las piezas (daño, destello…). */
export function setDefenderMat(d, mat) {
  if (d.mat === mat) return;
  d.mat = mat;
  for (const m of d.meshes) m.material = mat;
}
/** Muestra u oculta el contorno (las vistas transparentes no lo llevan). */
export function setOutline(d, on) {
  for (const m of d.meshes) for (const c of m.children) if (c.userData.outline) c.visible = on;
}
