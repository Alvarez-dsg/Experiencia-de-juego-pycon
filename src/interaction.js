// Traduce la entrada (pellizcos, toques, gestos, clics) en acciones del juego:
// recoger gotas de agua, tomar un personaje de la bandeja y soltarlo en una casilla, lanzar el jabillo,
// empujar a los invasores con un manotazo y pulsar botones o cartas.
import * as THREE from 'three';
import { LAYOUT, BOARD, PLANTS, HAND } from './config.js';
import { MATS } from './models.js';
import { plantGeometry } from './defenders.js';
import { BUTTONS, isShown } from './ui3d.js';
import { colX, rowZ, surfaceAt, LAND_Y } from './terrain.js';
import { sfx } from './audio.js';

const CELL = BOARD.cell;
const _l = new THREE.Vector3();
const _w = new THREE.Vector3();
const _n = new THREE.Vector3();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _plane = new THREE.Plane();

export class Interaction {
  constructor({ scene, game, board, tray }) {
    this.scene = scene;
    this.game = game;
    this.board = board;
    this.tray = tray;
    this.drags = new Map();
    this.hist = new Map(); // historial de posiciones por fuente → velocidad de la mano
    this.pushLock = new Map();
    this.onEmptyPress = null; // lo usa main para colocar el tablero sobre una mesa
  }

  inBox(obj, p, hx, hy, z0, z1) {
    obj.worldToLocal(_l.copy(p));
    return Math.abs(_l.x) < hx && Math.abs(_l.y) < hy && _l.z > z0 && _l.z < z1;
  }

  // ─── velocidad de cada mano/control ───
  track(src) {
    const now = performance.now();
    let h = this.hist.get(src.id);
    if (!h) this.hist.set(src.id, (h = []));
    h.push({ t: now, p: src.point.clone() });
    while (h.length > 2 && now - h[0].t > 110) h.shift();
  }

  velocity(src, out) {
    const h = this.hist.get(src.id);
    if (!h || h.length < 2) return out.set(0, 0, 0);
    const a = h[0];
    const b = h[h.length - 1];
    const dt = (b.t - a.t) / 1000;
    if (dt < 0.02) return out.set(0, 0, 0);
    return out.subVectors(b.p, a.p).divideScalar(dt);
  }

  // ─── búsqueda del objetivo bajo una mano/control ───
  pickNear(src) {
    const p = src.point;
    let best = null;
    let bestD = 0.045;
    for (const o of this.game.orbs) {
      if (o.state === 'collect' || o.state === 'gone') continue;
      const d = o.group.getWorldPosition(_w).distanceTo(p);
      if (d < bestD) {
        bestD = d;
        best = { kind: 'orb', orb: o };
      }
    }
    if (best) return best;
    // la carta o el botón más cercano (las cajas de detección se solapan un poco)
    let score = Infinity;
    if (isShown(this.tray)) {
      for (const card of this.tray.allCards) {
        if (!card.visible) continue;
        if (this.inBox(card, p, card.w / 2 + 0.008, card.h / 2 + 0.014, -0.035, 0.08)) {
          const s = Math.hypot(_l.x / card.w, _l.y / card.h);
          if (s < score) {
            score = s;
            best = { kind: 'card', card };
          }
        }
      }
    }
    for (const b of BUTTONS) {
      if (!b.enabled || !isShown(b)) continue;
      if (this.inBox(b, p, b.w / 2 + 0.01, b.h / 2 + 0.01, -0.03, 0.05)) {
        const s = Math.hypot(_l.x / b.w, _l.y / b.h);
        if (s < score) {
          score = s;
          best = { kind: 'button', button: b };
        }
      }
    }
    return best;
  }

  pickRay(src) {
    const ray = src.ray.ray;
    let best = null;
    let bestT = Infinity;
    for (const o of this.game.orbs) {
      if (o.state === 'collect' || o.state === 'gone') continue;
      o.group.getWorldPosition(_w);
      if (ray.distanceSqToPoint(_w) < 0.022 * 0.022) {
        const t = _w.sub(ray.origin).dot(ray.direction);
        if (t < bestT) {
          bestT = t;
          best = { kind: 'orb', orb: o };
        }
      }
    }
    const hitList = [];
    if (isShown(this.tray)) {
      for (const card of this.tray.allCards) if (card.visible) hitList.push([card.bg, { kind: 'card', card }], [card.model, { kind: 'card', card }]);
    }
    for (const b of BUTTONS) if (b.enabled && isShown(b)) hitList.push([b.face, { kind: 'button', button: b }]);
    for (const [obj, target] of hitList) {
      const hits = src.ray.intersectObject(obj, false);
      if (hits.length && hits[0].distance < bestT) {
        bestT = hits[0].distance;
        best = target;
      }
    }
    if (best) return best;
    // con el mouse se empuja a los invasores haciendo clic sobre ellos
    if (this.game.state === 'playing') {
      for (const e of this.game.enemies) {
        if (!e.alive) continue;
        for (const m of e.m.meshes) {
          const hits = src.ray.intersectObject(m, false);
          if (hits.length && hits[0].distance < bestT) {
            bestT = hits[0].distance;
            best = { kind: 'enemy', enemy: e };
          }
        }
      }
    }
    return best;
  }

  /** Punto de la superficie del tablero bajo el mouse. */
  boardPointFromRay(ray, out) {
    _n.set(0, 1, 0).applyQuaternion(this.board.root.quaternion);
    _l.set(0, LAYOUT.tileTop, 0);
    this.board.content.localToWorld(_l);
    _plane.setFromNormalAndCoplanarPoint(_n, _l);
    return ray.intersectPlane(_plane, out);
  }

  // ─── bucle ───
  update(sources) {
    for (const b of BUTTONS) b.setHover(false);
    for (const c of this.tray.allCards) c.hover = false;

    for (const src of sources) {
      if (src.kind !== 'mouse') this.track(src);
      const drag = this.drags.get(src.id);
      const target = drag ? null : src.kind === 'mouse' ? this.pickRay(src) : this.pickNear(src);
      if (target?.kind === 'button') target.button.setHover(true);
      if (target?.kind === 'card') target.card.hover = true;

      if (src.kind === 'hand' && !src.pressed && !drag) {
        this.poke(src);
        this.swipe(src);
      }

      if (src.justPressed) {
        if (!target) this.onEmptyPress?.(src);
        else if (target.kind === 'orb') this.game.collectOrb(target.orb);
        else if (target.kind === 'button') target.button.press();
        else if (target.kind === 'card') this.startDrag(src, target.card);
        else if (target.kind === 'enemy') this.game.pushAt(target.enemy.x, target.enemy.z);
      }
      const d = this.drags.get(src.id);
      if (d) {
        // al soltar se usa la última casilla válida: al abrir los dedos el punto del pellizco se desplaza
        if (src.pressed) this.updateDrag(src, d);
        else this.drop(d);
      }
    }
    // fuentes que desaparecieron (mano perdida) sueltan lo que tenían
    for (const [id, d] of this.drags) {
      if (!sources.some((s) => s.id === id)) this.drop(d, true);
    }
    for (const id of this.hist.keys()) if (!sources.some((s) => s.id === id)) this.hist.delete(id);
  }

  /** Tocar con la punta del índice: botones y gotas de agua. */
  poke(src) {
    const tip = src.tip;
    for (const o of this.game.orbs) {
      if (o.state === 'collect' || o.state === 'gone') continue;
      if (o.group.getWorldPosition(_w).distanceTo(tip) < 0.03) this.game.collectOrb(o);
    }
    for (const b of BUTTONS) {
      if (!b.enabled || !isShown(b)) {
        b._poked.delete(src.id);
        continue;
      }
      b.worldToLocal(_l.copy(tip));
      const inside = Math.abs(_l.x) < b.w / 2 && Math.abs(_l.y) < b.h / 2 && _l.z < 0.01 && _l.z > -0.05;
      if (inside && !b._poked.has(src.id)) {
        b._poked.add(src.id);
        b.press();
      } else if (!inside && _l.z > 0.02) b._poked.delete(src.id);
    }
  }

  /** Manotazo: la mano abierta barre el tablero, bajita y rápido (en cualquier dirección). */
  swipe(src) {
    const game = this.game;
    if (game.state !== 'playing') return;
    const now = performance.now();
    if ((this.pushLock.get(src.id) || 0) > now) return;
    const P = HAND.push;
    const s = this.board.root.scale.x;
    this.board.content.worldToLocal(_l.copy(src.point));
    if (_l.x < LAYOUT.left || _l.x > LAYOUT.right || _l.z < LAYOUT.back || _l.z > LAYOUT.front) return;
    const h = (_l.y - surfaceAt(_l.x, _l.z)) * s;
    if (h < -0.03 || h > P.height) return;
    this.velocity(src, _v);
    _n.set(0, 1, 0).applyQuaternion(this.board.root.quaternion);
    _v.addScaledVector(_n, -_v.dot(_n)); // solo cuenta la velocidad horizontal
    if (_v.length() < P.speed) return;
    game.pushAt(_l.x, _l.z);
    this.pushLock.set(src.id, now + 450);
  }

  startDrag(src, card) {
    const type = card.type;
    if (type === 'shovel') {
      if (this.game.state !== 'playing') return sfx.deny();
    } else {
      const why = this.game.whyCantPlant(type);
      if (why) {
        card.shake();
        sfx.deny();
        if (why === 'agua') this.tray.denyWater();
        return;
      }
    }
    const geo = plantGeometry(type);
    const ghost = new THREE.Mesh(geo, MATS.ghost);
    ghost.renderOrder = 20;
    this.scene.add(ghost);
    const preview = new THREE.Mesh(geo, MATS.preview);
    preview.visible = false;
    this.board.content.add(preview);
    const hl = this.board.makeHighlight();
    const grenade = PLANTS[type]?.kind === 'grenade';
    let ring = null;
    if (grenade) {
      // área de la explosión bajo la mano
      ring = new THREE.Mesh(
        new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: '#E3913A', transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide })
      );
      ring.scale.setScalar(CELL * PLANTS[type].radius);
      ring.renderOrder = 3;
      ring.visible = false;
      this.board.content.add(ring);
    }
    card.selected = true;
    this.drags.set(src.id, { src, type, card, ghost, preview, hl, ring, grenade, cell: null, t: 0, local: new THREE.Vector3(), valid: false });
    sfx.pick();
  }

  updateDrag(src, d) {
    d.t += 1 / 60;
    const s = this.board.root.scale.x;
    let world = null;
    if (src.kind === 'mouse') world = this.boardPointFromRay(src.ray.ray, _w);
    else world = _w.copy(src.point);

    if (!world) {
      d.ghost.visible = false;
      d.hl.visible = false;
      d.preview.visible = false;
      if (d.ring) d.ring.visible = false;
      d.cell = null;
      d.valid = false;
      return;
    }
    d.ghost.visible = true;
    d.ghost.scale.setScalar(s * (1 + Math.sin(d.t * 8) * 0.03));
    d.ghost.quaternion.copy(this.board.root.quaternion);
    d.ghost.position.copy(world);
    if (src.kind === 'mouse') d.ghost.position.y += (d.grenade ? 0.06 : 0.025) * s;
    else d.ghost.position.y -= 0.035 * s; // cuelga de los dedos

    this.board.content.worldToLocal(_l.copy(world));
    if (d.grenade) {
      // sombra del área donde caería si se suelta aquí
      d.local.copy(_l);
      const inside = _l.x > LAYOUT.left && _l.x < LAYOUT.right && _l.z > LAYOUT.back && _l.z < LAYOUT.front;
      d.valid = true;
      d.hl.visible = false;
      d.ring.visible = inside;
      if (inside) {
        d.ring.position.set(_l.x, surfaceAt(_l.x, _l.z) + 0.0015, _l.z);
        d.ring.material.opacity = 0.45 + Math.sin(d.t * 10) * 0.2;
      }
      return;
    }
    const cell = _l.y > -0.06 && _l.y < 0.3 ? this.board.cellFromLocal(_l) : null;
    let ok = false;
    if (cell) {
      const occupant = this.game.grid[cell.r][cell.c];
      // solo se planta en la tierra verde de la isla (nunca en la arena ni en el Mangle madre)
      ok = d.type === 'shovel' ? !!occupant : cell.land && !occupant && !this.game.whyCantPlant(d.type);
    }
    d.cell = ok ? cell : null;
    d.hl.visible = !!cell && (cell.land || d.type !== 'shovel');
    if (cell) {
      d.hl.position.x = colX(cell.c);
      d.hl.position.z = rowZ(cell.r);
      d.hl.material.color.set(ok ? (d.type === 'shovel' ? '#E3913A' : '#b9ff9e') : '#ff6b5b');
      d.hl.material.opacity = 0.35 + Math.sin(d.t * 10) * 0.15;
    }
    d.preview.visible = ok && d.type !== 'shovel';
    if (d.preview.visible) d.preview.position.set(colX(cell.c), LAND_Y, rowZ(cell.r));
  }

  /** Suelta el jabillo: con la mano sale con la velocidad del lanzamiento; con el mouse cae sobre el punto. */
  throwGrenade(d) {
    const s = this.board.root.scale.x;
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();
    if (d.src.kind === 'mouse') {
      if (!d.ring.visible) return;
      pos.copy(d.local).setY(surfaceAt(d.local.x, d.local.z) + 0.12);
    } else {
      this.board.content.worldToLocal(pos.copy(d.ghost.position));
      this.velocity(d.src, vel);
      const G = HAND.grenade;
      const sp = vel.length();
      if (sp < G.minThrow) vel.set(0, 0, 0);
      else if (sp > G.maxSpeed) vel.multiplyScalar(G.maxSpeed / sp);
      // de mundo a coordenadas del tablero (sin traslación)
      _q.copy(this.board.root.quaternion).invert();
      vel.applyQuaternion(_q).divideScalar(s);
    }
    this.game.throwGrenade(pos, vel);
  }

  drop(d, cancel = false) {
    if (!cancel) {
      if (d.grenade) {
        if (d.valid) this.throwGrenade(d);
      } else if (d.cell) {
        if (d.type === 'shovel') this.game.dig(d.cell.r, d.cell.c);
        else this.game.plant(d.type, d.cell.r, d.cell.c);
      }
    }
    this.scene.remove(d.ghost);
    this.board.content.remove(d.preview, d.hl);
    d.hl.geometry.dispose();
    d.hl.material.dispose();
    if (d.ring) {
      this.board.content.remove(d.ring);
      d.ring.geometry.dispose();
      d.ring.material.dispose();
    }
    d.card.selected = false;
    this.drags.delete(d.src.id);
  }

  cancelAll() {
    for (const d of [...this.drags.values()]) this.drop(d, true);
  }
}
