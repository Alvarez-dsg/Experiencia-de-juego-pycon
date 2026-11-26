// Copas de hojas al estilo de la página de PyCon Colombia 2028 (selva.js de la landing): racimos de hojas
// fotografiadas (ambientCG, CC0) pintados una vez en un atlas y repartidos sobre la copa de cada árbol como
// tarjetas que miran a la cámara. Se iluminan como un volumen: el lado del sol claro, el interior en sombra.
// La copa original del modelo queda debajo, oscurecida, como el "relleno" que se ve entre los racimos.
import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { riseClip } from './models.js';

const canvas2d = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
};
const rng = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar ' + src));
    img.src = src;
  });

// ── atlas de racimos (mismo proceso que la landing: cortar, teñir por luz, estampar) ──
function cutLeaves(color, alpha, cols, rows) {
  const W = color.naturalWidth;
  const H = color.naturalHeight;
  const [c, g] = canvas2d(W, H);
  g.drawImage(color, 0, 0);
  const d = g.getImageData(0, 0, W, H);
  const [, ga] = canvas2d(W, H);
  ga.drawImage(alpha, 0, 0, W, H);
  const a = ga.getImageData(0, 0, W, H).data;
  for (let i = 0; i < a.length; i += 4) d.data[i + 3] = a[i] > 40 ? Math.min(255, (a[i] - 40) * 1.4) : 0;
  g.putImageData(d, 0, 0);
  const out = [];
  const cw = W / cols;
  const ch = H / rows;
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < cols; k++) {
      const [lc, lg] = canvas2d(Math.round(cw), Math.round(ch));
      lg.drawImage(c, k * cw, r * ch, cw, ch, 0, 0, cw, ch);
      out.push(lc);
    }
  return out;
}
// tonos un poco más vivos que en la landing: el tablero es un juguete al sol
const HUES = { deep: [0.36, 0.62, 0.3], mid: [0.5, 0.76, 0.34], warm: [0.74, 0.86, 0.36], olive: [0.52, 0.62, 0.32] };
const LEVELS = [0.18, 0.3, 0.44, 0.6, 0.76, 0.9, 1.05];
const levelOf = (b) => Math.max(0, Math.min(LEVELS.length - 1, Math.round(b * (LEVELS.length - 1))));
function tintLeaves(leaves, size) {
  const out = {};
  for (const [name, h] of Object.entries(HUES)) {
    out[name] = LEVELS.map((L) =>
      leaves.map((leaf) => {
        const s = size / Math.max(leaf.width, leaf.height);
        const w = Math.max(2, Math.round(leaf.width * s));
        const hh = Math.max(2, Math.round(leaf.height * s));
        const [c, g] = canvas2d(w, hh);
        g.drawImage(leaf, 0, 0, w, hh);
        g.globalCompositeOperation = 'multiply';
        g.fillStyle = `rgb(${Math.min(255, h[0] * L * 255) | 0},${Math.min(255, h[1] * L * 255) | 0},${Math.min(255, h[2] * L * 255) | 0})`;
        g.fillRect(0, 0, w, hh);
        g.globalCompositeOperation = 'destination-in';
        g.drawImage(leaf, 0, 0, w, hh);
        return c;
      }),
    );
  }
  return out;
}
function stamp(g, spr, x, y, size, rot) {
  const s = size / spr.height;
  const c = Math.cos(rot) * s;
  const n = Math.sin(rot) * s;
  g.setTransform(c, n, -n, c, x, y);
  g.drawImage(spr, -spr.width / 2, -spr.height / 2);
}
// 2 × 2 racimos: hojas que salen del centro, las de atrás más oscuras y las de encima más claras
function paintTufts(tinted, cell = 256) {
  const R = rng(33);
  const [c, g] = canvas2d(cell * 2, cell * 2);
  const huesBy = [
    ['deep', 'mid', 'mid', 'olive'],
    ['mid', 'mid', 'warm', 'olive'],
    ['deep', 'deep', 'mid', 'olive'],
    ['mid', 'warm', 'olive', 'deep'],
  ];
  for (let k = 0; k < 4; k++) {
    const cx = (k % 2) * cell + cell / 2;
    const cy = Math.floor(k / 2) * cell + cell / 2;
    const leaves = [];
    for (let i = 0; i < 38; i++) {
      const a = R() * Math.PI * 2;
      const d = Math.sqrt(R()) * cell * 0.3;
      leaves.push({ a, d, b: 0.35 + R() * 0.65, size: cell * (0.15 + R() * 0.13), hue: huesBy[k][(R() * 4) | 0] });
    }
    leaves.sort((p, q) => p.b - q.b);
    for (const l of leaves) {
      const set = tinted[l.hue][levelOf(l.b)];
      stamp(g, set[(R() * set.length) | 0], cx + Math.cos(l.a) * l.d, cy + Math.sin(l.a) * l.d, l.size, l.a + Math.PI / 2 + (R() - 0.5) * 1.2);
    }
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  return c;
}

// ── material de los racimos ──
const VERT = /* glsl */ `
attribute vec3 aPos;   // centro del racimo
attribute vec3 aNrm;   // hacia afuera de la copa
attribute vec4 aData;  // x tamaño, y giro, z brillo (bajo = interior), w racimo del atlas
uniform vec3 uSunDir;
uniform float uTime;
varying vec2 vUv;
varying float vShade;
#include <clipping_planes_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(aPos, 1.0);
  vec3 n = normalize(mat3(modelMatrix) * aNrm);
  float k = length(modelMatrix[0].xyz);
  float ph = dot(wp.xyz, vec3(37.0, 21.0, 29.0));
  wp.xyz += vec3(sin(uTime * 1.3 + ph), 0.5 * sin(uTime * 1.7 + ph * 1.3), cos(uTime * 1.1 + ph)) * 0.04 * aData.x * k;
  vec4 mvPosition = viewMatrix * wp;
  float c = cos(aData.y), s = sin(aData.y);
  vec2 q = position.xy * aData.x * k;
  mvPosition.xy += vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  vUv = (uv + vec2(mod(aData.w, 2.0), floor(aData.w / 2.0))) * 0.5;
  float sunLit = smoothstep(-0.3, 0.7, dot(n, uSunDir));
  float skyLit = 0.7 + 0.3 * n.y;
  vShade = (0.72 * skyLit * mix(0.5, 1.0, aData.z) + 1.05 * sunLit * aData.z) * mix(0.72, 1.0, aData.z);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;
const FRAG = /* glsl */ `
uniform sampler2D uTufts;
varying vec2 vUv;
varying float vShade;
#include <clipping_planes_pars_fragment>
void main() {
  #include <clipping_planes_fragment>
  vec4 c = texture2D(uTufts, vUv);
  float a = (c.a - 0.45) / max(fwidth(c.a), 1e-4) + 0.5;
  if (a < 0.5) discard;
  gl_FragColor = vec4(c.rgb / max(c.a, 0.25) * vShade, 1.0);
  #include <colorspace_fragment>
}`;

let tuftTex = null;
let tuftMat = null;
const crowns = {};

/** Carga las hojas y pinta el atlas (una vez, al inicio). Si falla, los árboles quedan como antes. */
export async function loadFoliage() {
  const base = import.meta.env.BASE_URL + 'tex/';
  const [a, aa, b, ba] = await Promise.all(['hojas_a', 'hojas_a_alfa', 'hojas_b', 'hojas_b_alfa'].map((n) => loadImage(base + n + '.jpg')));
  const leaves = [...cutLeaves(a, aa, 3, 2), ...cutLeaves(b, ba, 2, 2)];
  tuftTex = new THREE.CanvasTexture(paintTufts(tintLeaves(leaves, 72)));
  tuftTex.colorSpace = THREE.SRGBColorSpace;
  tuftTex.minFilter = THREE.LinearMipmapLinearFilter;
  tuftTex.anisotropy = 4;
  tuftMat = new THREE.ShaderMaterial({
    name: 'Copas_Racimos',
    uniforms: { uTufts: { value: tuftTex }, uSunDir: { value: new THREE.Vector3(0.6, 2.2, 1.4).normalize() }, uTime: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    clipping: true,
    clippingPlanes: [riseClip],
  });
}
export const foliageReady = () => !!tuftMat;
export function animateFoliage(t) {
  if (tuftMat) tuftMat.uniforms.uTime.value = t;
}

const isLeaf = (r, g, b) => g >= r * 0.98 && g > b * 1.15;
/** Separa la copa de un modelo de árbol: devuelve el modelo sin la copa y un muestreador de su superficie. */
function crown(name, geo) {
  if (crowns[name] !== undefined) return crowns[name];
  const col = geo.attributes.color;
  const pos = geo.attributes.position;
  const leafPos = [];
  const leafNrm = [];
  const leafTris = [];
  const nrm = geo.attributes.normal;
  for (let t = 0; t < pos.count; t += 3) {
    let r = 0;
    let g = 0;
    let b = 0;
    for (let v = t; v < t + 3; v++) {
      r += col.getX(v);
      g += col.getY(v);
      b += col.getZ(v);
    }
    if (!isLeaf(r, g, b)) continue;
    leafTris.push(t);
    for (let v = t; v < t + 3; v++) {
      leafPos.push(pos.getX(v), pos.getY(v), pos.getZ(v));
      leafNrm.push(nrm.getX(v), nrm.getY(v), nrm.getZ(v));
    }
  }
  if (leafPos.length < 9) return (crowns[name] = null);
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(leafPos, 3));
  lg.setAttribute('normal', new THREE.Float32BufferAttribute(leafNrm, 3));
  lg.computeBoundingSphere();
  // el modelo queda sin la copa original (solo tronco, ramas y lo demás): las hojas son solo los racimos
  const isLeafTri = new Uint8Array(pos.count / 3);
  for (const t of leafTris) isLeafTri[t / 3] = 1;
  const dark = new THREE.BufferGeometry();
  for (const [key, attr] of Object.entries(geo.attributes)) {
    const n = attr.itemSize;
    const out = new attr.array.constructor((pos.count - leafTris.length * 3) * n);
    let o = 0;
    for (let t = 0; t < pos.count; t += 3) {
      if (isLeafTri[t / 3]) continue;
      out.set(attr.array.subarray(t * n, (t + 3) * n), o);
      o += 3 * n;
    }
    dark.setAttribute(key, new THREE.BufferAttribute(out, n, attr.normalized));
  }
  const sampler = new MeshSurfaceSampler(new THREE.Mesh(lg)).build();
  const area = sampler.distribution[sampler.distribution.length - 1];
  return (crowns[name] = { dark, sampler, area, radius: lg.boundingSphere.radius, center: lg.boundingSphere.center.clone() });
}

/** Junta los racimos de varios árboles colocados. */
export class TuftBuilder {
  constructor(seed = 11) {
    this.R = rng(seed);
    this.pos = [];
    this.nrm = [];
    this.data = [];
  }
  /** Devuelve la geometría del árbol a usar (sin copa) y agrega sus racimos; null si no aplica. */
  tree(name, geo, matrix) {
    if (!tuftMat) return null;
    const c = crown(name, geo);
    if (!c) return null;
    const R = this.R;
    const scale = matrix.getMaxScaleOnAxis();
    const size = c.radius * 0.42; // racimos grandes: se leen bien en un árbol de juguete
    const n = Math.min(380, Math.round((c.area / (size * size)) * 5));
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const p = new THREE.Vector3();
    const q = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      c.sampler.sample(p, q);
      const outer = R() < 0.62;
      const depth = (outer ? -R() * 0.15 : 0.25 + R() * 0.8) * size;
      p.addScaledVector(q, -depth).applyMatrix4(matrix);
      q.applyMatrix3(nm).normalize();
      this.pos.push(p.x, p.y, p.z);
      this.nrm.push(q.x, q.y, q.z);
      this.data.push(size * scale * (0.75 + R() * 0.55), R() * Math.PI * 2, outer ? 0.85 + R() * 0.3 : 0.35 + R() * 0.3, (R() * 4) | 0);
    }
    return c.dark;
  }
  /** Malla con todos los racimos (o null). */
  build() {
    const n = this.pos.length / 3;
    if (!n) return null;
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    geo.setAttribute('uv', quad.attributes.uv);
    geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(new Float32Array(this.pos), 3));
    geo.setAttribute('aNrm', new THREE.InstancedBufferAttribute(new Float32Array(this.nrm), 3));
    geo.setAttribute('aData', new THREE.InstancedBufferAttribute(new Float32Array(this.data), 4));
    geo.instanceCount = n;
    const box = new THREE.Box3().setFromArray(this.pos).expandByScalar(0.05);
    geo.boundingBox = box;
    geo.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    const mesh = new THREE.Mesh(geo, tuftMat);
    mesh.name = 'Copas_Racimos';
    mesh.userData.count = n;
    return mesh;
  }
}
