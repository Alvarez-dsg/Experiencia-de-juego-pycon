// Detección de superficies elevadas (mesas) con la API WebXR Plane Detection
// + respaldo con hit-test + cálculo de dónde y cómo colocar el tablero.
import * as THREE from 'three';
import { LAYOUT } from './config.js';

const UP = new THREE.Vector3(0, 1, 0);
const BANNED = [
  'floor',
  'ceiling',
  'wall',
  'door',
  'door frame',
  'window',
  'window frame',
  'wall art',
  'screen',
  'lamp',
  'plant',
  'couch',
  'bed',
  'invisible wall face',
  'global mesh',
];
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();

export class PlaneTracker {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.map = new Map();
    this.candidates = [];
    this.supported = false;
    this.show = true;
    this.t = 0;
    this.fill = new THREE.MeshBasicMaterial({ color: '#57e389', transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
    this.line = new THREE.LineBasicMaterial({ color: '#c8ffd9', transparent: true, opacity: 0.95 });
    this.reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.05, 0.065, 36).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ffd84d', transparent: true, opacity: 0.9, depthWrite: false })
    );
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
    scene.add(this.reticle);
    this.hitSource = null;
    this.hit = null;
  }

  reset() {
    for (const d of this.map.values()) this.disposePlane(d);
    this.map.clear();
    this.candidates = [];
    this.hitSource?.cancel?.();
    this.hitSource = null;
    this.hit = null;
    this.reticle.visible = false;
  }

  async initHitTest(session) {
    try {
      if (!session.requestHitTestSource) return;
      const viewer = await session.requestReferenceSpace('viewer');
      this.hitSource = await session.requestHitTestSource({ space: viewer });
    } catch (e) {
      this.hitSource = null;
    }
  }

  disposePlane(d) {
    this.group.remove(d.obj);
    d.obj.traverse((o) => o.geometry?.dispose());
  }

  rebuild(d) {
    d.obj.traverse((o) => o.geometry?.dispose());
    d.obj.clear();
    const pts = d.plane.polygon || [];
    if (pts.length < 3) {
      d.valid = false;
      return;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    const tri = [];
    const outline = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
      outline.push(new THREE.Vector3(p.x, 0.003, p.z));
      if (i >= 1 && i < pts.length - 1) tri.push(pts[0].x, 0.001, pts[0].z, p.x, 0.001, p.z, pts[i + 1].x, 0.001, pts[i + 1].z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
    d.obj.add(new THREE.Mesh(g, this.fill));
    d.obj.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(outline), this.line));
    Object.assign(d, { minX, maxX, minZ, maxZ, width: maxX - minX, depth: maxZ - minZ, valid: true });
  }

  classify(d) {
    _v.setFromMatrixColumn(d.matrix, 1);
    d.up = _v.y;
    d.center = new THREE.Vector3((d.minX + d.maxX) / 2, 0, (d.minZ + d.maxZ) / 2).applyMatrix4(d.matrix);
    d.height = d.center.y;
    const label = String(d.plane.semanticLabel || '').toLowerCase();
    d.label = label;
    const horizontal = String(d.plane.orientation || '').toLowerCase() === 'horizontal' || d.up > 0.9;
    d.isTable =
      d.valid && horizontal && d.up > 0.85 && d.height > 0.3 && d.height < 1.5 && !BANNED.includes(label) && d.width >= 0.25 && d.depth >= 0.2;
    d.priority = label === 'table' || label === 'desk' ? 1 : 0;
  }

  update(frame, refSpace, dt) {
    this.t += dt;
    const det = frame.detectedPlanes;
    this.supported = !!det;
    if (det) {
      for (const [plane, d] of this.map) {
        if (!det.has(plane)) {
          this.disposePlane(d);
          this.map.delete(plane);
        }
      }
      det.forEach((plane) => {
        let d = this.map.get(plane);
        if (!d) {
          d = { plane, obj: new THREE.Group(), matrix: new THREE.Matrix4(), time: -1, valid: false };
          d.obj.matrixAutoUpdate = false;
          this.group.add(d.obj);
          this.map.set(plane, d);
        }
        if (plane.lastChangedTime !== d.time) {
          this.rebuild(d);
          d.time = plane.lastChangedTime;
        }
        const pose = frame.getPose(plane.planeSpace, refSpace);
        d.tracked = !!pose;
        if (pose) {
          d.matrix.fromArray(pose.transform.matrix);
          d.obj.matrix.copy(d.matrix);
          d.obj.matrixWorldNeedsUpdate = true;
          this.classify(d);
        }
      });
    }
    this.candidates = [...this.map.values()].filter((d) => d.tracked && d.isTable);
    this.fill.opacity = 0.14 + Math.sin(this.t * 4) * 0.07;
    for (const d of this.map.values()) d.obj.visible = this.show && d.tracked && d.isTable;

    // hit-test (respaldo cuando no hay planos)
    this.hit = null;
    if (this.hitSource) {
      const res = frame.getHitTestResults(this.hitSource);
      if (res.length) {
        const pose = res[0].getPose(refSpace);
        if (pose) {
          _m.fromArray(pose.transform.matrix);
          _v.setFromMatrixColumn(_m, 1);
          const pos = new THREE.Vector3().setFromMatrixPosition(_m);
          if (_v.y > 0.8 && pos.y > 0.3) this.hit = { position: pos };
        }
      }
    }
    this.reticle.visible = this.show && !!this.hit && this.candidates.length === 0;
    if (this.reticle.visible) {
      this.reticle.matrix.makeTranslation(this.hit.position.x, this.hit.position.y + 0.002, this.hit.position.z);
      this.reticle.matrixWorldNeedsUpdate = true;
    }
  }

  setVisible(v) {
    this.show = v;
    this.group.visible = v;
    if (!v) this.reticle.visible = false;
  }

  /** Mejor mesa: etiquetada como mesa y cercana al usuario. */
  best(head) {
    let best = null;
    let bestScore = -Infinity;
    for (const d of this.candidates) {
      const dist = Math.hypot(d.center.x - head.x, d.center.z - head.z);
      // prioriza mesas etiquetadas, cercanas, amplias y de altura normal (~75 cm)
      const score = d.priority * 2 - dist + Math.min(d.width * d.depth, 1) * 0.5 - Math.abs(d.height - 0.75);
      if (score > bestScore) {
        bestScore = score;
        best = d;
      }
    }
    return best;
  }

  /** Candidato que está bajo un punto del mundo (p. ej. donde el usuario pellizcó). */
  planeAt(point) {
    for (const d of this.candidates) {
      _v.copy(point).applyMatrix4(_m.copy(d.matrix).invert());
      if (_v.x > d.minX - 0.1 && _v.x < d.maxX + 0.1 && _v.z > d.minZ - 0.1 && _v.z < d.maxZ + 0.1 && Math.abs(_v.y) < 0.35) return d;
    }
    return null;
  }

  /** Calcula posición, giro y escala del tablero sobre una mesa, alineado con sus bordes y mirando al usuario. */
  placement(d, head, pickPoint = null) {
    const xAxis = new THREE.Vector3().setFromMatrixColumn(d.matrix, 0).setY(0).normalize();
    const zAxis = new THREE.Vector3().setFromMatrixColumn(d.matrix, 2).setY(0).normalize();
    const toUser = new THREE.Vector3(head.x - d.center.x, 0, head.z - d.center.z);
    if (toUser.lengthSq() < 1e-6) toUser.set(0, 0, 1);
    toUser.normalize();
    const opts = [
      { a: zAxis, depth: d.depth, width: d.width },
      { a: zAxis.clone().negate(), depth: d.depth, width: d.width },
      { a: xAxis, depth: d.width, width: d.depth },
      { a: xAxis.clone().negate(), depth: d.width, width: d.depth },
    ];
    let o = opts[0];
    for (const op of opts) if (op.a.dot(toUser) > o.a.dot(toUser)) o = op;
    const bz = o.a;
    const bx = new THREE.Vector3().crossVectors(UP, bz);
    const scale = THREE.MathUtils.clamp(Math.min((o.width * 0.96) / LAYOUT.totalW, (o.depth * 0.96) / LAYOUT.totalD), 0.55, 1);
    const slackZ = Math.max(0, (o.depth - LAYOUT.totalD * scale) / 2);
    const slackX = Math.max(0, (o.width - LAYOUT.totalW * scale) / 2);
    const ref = pickPoint || head;
    const rel = new THREE.Vector3(ref.x - d.center.x, 0, ref.z - d.center.z);
    const lateral = THREE.MathUtils.clamp(rel.dot(bx), -slackX, slackX);
    const along = pickPoint ? THREE.MathUtils.clamp(rel.dot(bz), -slackZ, slackZ) : Math.max(0, slackZ - 0.04);
    const position = d.center.clone().addScaledVector(bx, lateral).addScaledVector(bz, along);
    position.y = d.height;
    return { position, yaw: Math.atan2(bz.x, bz.z), scale };
  }
}
