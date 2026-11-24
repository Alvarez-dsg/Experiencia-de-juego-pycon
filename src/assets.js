// Modelos hechos en Blender (ver blender/animales.py) y vegetación de la landing de PyCon 2028.
// Se cargan una sola vez al inicio. Cada pieza se convierte al mismo formato que GeoBuilder
// (no indexada, con color RGB por vértice) para poder mezclarla con el resto de la escena.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const GEO = {};

function normalize(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name);
  const c = g.attributes.color;
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = c ? c.getX(i) : 0.5;
    col[i * 3 + 1] = c ? c.getY(i) : 0.5;
    col[i * 3 + 2] = c ? c.getZ(i) : 0.5;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!g.attributes.normal) g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

async function load(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    GEO[o.name] = normalize(g);
  });
}

/** Carga los GLB (si alguno falla, el juego usa los modelos hechos con código). */
export async function loadAssets() {
  const base = import.meta.env.BASE_URL;
  await Promise.all(
    ['models/animales.glb', 'models/vegetacion.glb'].map((f) => load(base + f).catch((e) => console.warn('No se pudo cargar', f, e))),
  );
}

/** Geometría (en casillas, escala 1) de una pieza por nombre, o null. */
export const asset = (name) => GEO[name] ?? null;
