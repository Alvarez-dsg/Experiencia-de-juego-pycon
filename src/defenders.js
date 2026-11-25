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
import { asset } from './assets.js';
import { GeoBuilder } from './models.js';

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

// Modelos de Blender (public/models/animales.glb): nombre de la pieza por tipo.
const GLB = { rana: 'rana', mono: 'mono', anaconda: 'anaconda', guacamaya: 'guacamaya', tortuga: 'tortuga', chiguiro: 'chiguiro' };
const fromGlb = (name) => {
  const g = asset(name);
  return g ? unit(() => g.clone())() : null;
};
// Mariposa estática (carta y vista previa): planta + mariposa con las alas abiertas
const glbMariposa = () => {
  if (!asset('mariposa_planta')) return null;
  const b = new GeoBuilder();
  const up = new THREE.Matrix4().makeTranslation(0, MARIPOSA_BUG_Y, 0);
  b.addBuilt(asset('mariposa_planta'));
  b.addBuilt(asset('mariposa_cuerpo'), up);
  b.addBuilt(asset('mariposa_ala_d'), new THREE.Matrix4().makeRotationX(-0.45).premultiply(up));
  b.addBuilt(asset('mariposa_ala_i'), new THREE.Matrix4().makeRotationX(0.45).premultiply(up));
  return unit(() => b.build(1))();
};

const cache = {};
/** Geometría estática (compartida) de un defensor, en metros. */
export function plantGeometry(type) {
  return (cache[type] ??= (GLB[type] && fromGlb(GLB[type])) || (type === 'mariposa' && glbMariposa()) || BUILDERS[type]());
}

// Giro sobre sí mismos para que el usuario les vea la cara (vista 3/4) sin dejar de mirar a los invasores
export const FACE_YAW = { mono: -0.5, rana: -0.45, guacamaya: -0.5, chiguiro: -0.45, tortuga: -0.4, anaconda: -0.45, mariposa: -0.35, ceiba: -0.4, jabillo: -0.5 };

// Boca de los tiradores: [x, y] en casillas, desde el centro de la casilla
export const MUZZLE = { rana: [0.3, 0.27], guacamaya: [0.22, 0.52] };

const partCache = {};
const part = (key, fn, glb) => (partCache[key] ??= (glb && fromGlb(glb)) || unit(fn)());

/** Modelo para el tablero: { root, body, meshes[] } y partes animables (alas, caparazón…). */
export function createDefender(type) {
  const root = new THREE.Group();
  const d = { root, meshes: [], mat: MATS.std };
  const add = (geo, parent = root) => {
    const m = new THREE.Mesh(geo, MATS.std);
    m.castShadow = true;
    addOutline(m, 0.0009);
    parent.add(m);
    d.meshes.push(m);
    return m;
  };
  if (type === 'mariposa') {
    d.body = add(part('mFlower', buildMariposaFlower, 'mariposa_planta'));
    d.bug = new THREE.Group();
    d.bug.position.y = MARIPOSA_BUG_Y * U;
    root.add(d.bug);
    add(part('mBug', buildMariposaBug, 'mariposa_cuerpo'), d.bug);
    d.wingL = add(part('mWingL', () => buildMariposaWing(1), 'mariposa_ala_d'), d.bug);
    d.wingR = add(part('mWingR', () => buildMariposaWing(-1), 'mariposa_ala_i'), d.bug);
  } else if (type === 'tortuga') {
    d.body = add(plantGeometry('tortuga'));
    d.shell = add(part('tShell', buildTortugaShell, 'tortuga_caparazon'));
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
