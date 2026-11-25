// Retratos de los personajes para las cartas: cada modelo se dibuja UNA vez (al cargar) en una imagen con
// suavizado, con el mismo sombreado de caricatura y contorno que en el tablero. Las cartas muestran esa imagen y
// no el modelo 3D: así no se ven parpadeos del contorno ni recortes contra el plano de la carta en el visor.
import * as THREE from 'three';
import { MATS, addOutline } from './models.js';
import { plantGeometry } from './defenders.js';

const SIZE = 384; // píxeles del retrato (se dibuja al doble y se reduce para suavizar los bordes)
const SS = 2;
const IMG = {};
let ctx3 = null;

function setup(renderer) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#6b5a3a', 1.6));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.0);
  sun.position.set(0.6, 2.2, 1.4); // la misma dirección del sol del juego
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(24, 1, 0.01, 10);
  const target = new THREE.WebGLRenderTarget(SIZE * SS, SIZE * SS, { samples: 4, colorSpace: THREE.SRGBColorSpace });
  const pixels = new Uint8Array(SIZE * SS * SIZE * SS * 4);
  ctx3 = { renderer, scene, camera, target, pixels };
}

function render(type) {
  const { renderer, scene, camera, target, pixels } = ctx3;
  const geo = plantGeometry(type);
  const mesh = new THREE.Mesh(geo, MATS.std);
  addOutline(mesh, 0.0014);
  const bb = geo.boundingBox;
  const size = new THREE.Vector3();
  bb.getSize(size);
  const k = 1 / Math.max(size.y, size.x, size.z);
  mesh.scale.setScalar(k);
  mesh.position.set((-(bb.min.x + bb.max.x) / 2) * k, (-(bb.min.y + bb.max.y) / 2) * k, (-(bb.min.z + bb.max.z) / 2) * k);
  const pivot = new THREE.Group();
  pivot.rotation.y = type === 'shovel' ? 0.6 : -0.55; // vista 3/4, como antes en las cartas
  pivot.add(mesh);
  scene.add(pivot);
  // cámara un poco desde arriba, encuadrando la caja del modelo
  const dist = 0.62 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  camera.position.set(0, dist * 0.28, dist);
  camera.lookAt(0, 0, 0);

  const xr = renderer.xr.enabled;
  const prevTarget = renderer.getRenderTarget();
  const prevClear = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  renderer.xr.enabled = false;
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.readRenderTargetPixels(target, 0, 0, SIZE * SS, SIZE * SS, pixels);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevClear, prevAlpha);
  renderer.xr.enabled = xr;
  scene.remove(pivot);

  // a un lienzo (volteado: WebGL lee de abajo hacia arriba) y reducido a la mitad para suavizar
  const big = document.createElement('canvas');
  big.width = big.height = SIZE * SS;
  const img = new ImageData(SIZE * SS, SIZE * SS);
  const row = SIZE * SS * 4;
  for (let y = 0; y < SIZE * SS; y++) img.data.set(pixels.subarray((SIZE * SS - 1 - y) * row, (SIZE * SS - y) * row), y * row);
  big.getContext('2d').putImageData(img, 0, 0);
  const out = document.createElement('canvas');
  out.width = out.height = SIZE;
  const c = out.getContext('2d');
  c.imageSmoothingQuality = 'high';
  c.drawImage(big, 0, 0, SIZE, SIZE);
  return out;
}

/** Prepara los retratos (llamar una vez, antes de entrar a la sesión de RA). */
export function makePortraits(renderer, types) {
  setup(renderer);
  for (const t of types) IMG[t] = render(t);
}

/** Imagen (canvas) del personaje, o null si todavía no existe. */
export function portrait(type) {
  if (!IMG[type] && ctx3) IMG[type] = render(type);
  return IMG[type] ?? null;
}

/** Dibuja el retrato centrado en la caja (x, y, w, h), sin deformarlo. */
export function drawPortrait(ctx, type, x, y, w, h, { dim = false } = {}) {
  const img = portrait(type);
  if (!img) return;
  const s = Math.min(w, h);
  ctx.save();
  if (dim) {
    ctx.filter = 'grayscale(1) brightness(0.85)';
    ctx.globalAlpha = 0.75;
  }
  ctx.drawImage(img, x + (w - s) / 2, y + (h - s) / 2, s, s);
  ctx.restore();
}
