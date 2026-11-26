// Tablero tipo diorama: orilla talada con DEFORESTA S.A. (fondo) → río → isla de manglar con el
// Mangle madre (centro) → río → orilla de selva (cerca del usuario).
import * as THREE from 'three';
import { BOARD, LAYOUT, ISLAND } from './config.js';
import { MATS, riseClip, addOutline, createHpBar, toon } from './models.js';
import { animateFoliage } from './foliage.js';
import { buildTerrain, buildSkirt, buildWater, buildTiles, buildProps, buildCompany, buildHeart, buildMeadow, buildVegetation, HEART_TOP, MEADOW_TOP, SIGN_YAW } from './scenery.js';
import { cellAt, colX, rowZ, LAND_Y, HEART } from './terrain.js';
import { CanvasPlane, FONT, roundRect } from './ui3d.js';
import { asset } from './assets.js';
import { sfx } from './audio.js';

const CELL = BOARD.cell;
const RISE_FROM = -0.26;
const RISE_TO = BOARD.thickness + 0.002; // la base queda apoyada sobre la mesa
const RISE_TIME = 1.9;

export { colX, rowZ };

export class Board {
  constructor(particles) {
    this.root = new THREE.Group();
    this.root.name = 'board-root';
    this.content = new THREE.Group();
    this.content.position.y = RISE_TO;
    this.root.add(this.content);
    this.fx = particles;
    this.content.add(particles.mesh);

    const terrainMat = toon({ side: THREE.FrontSide });
    const add = (geo, mat = MATS.std, outline = 0) => {
      const m = new THREE.Mesh(geo, mat);
      if (outline) addOutline(m, outline);
      m.matrixAutoUpdate = false;
      this.content.add(m);
      return m;
    };
    // isla y entorno modelados en Blender (blender/entorno.py → models/entorno.glb, en casillas);
    // si el GLB no cargó, se usa la versión hecha con código
    const env = (name, fallback) => asset(name)?.clone().scale(CELL, CELL, CELL) ?? fallback();
    add(env('terreno', buildTerrain), terrainMat).receiveShadow = true;
    add(env('costado', buildSkirt), new THREE.MeshLambertMaterial({ vertexColors: true, clippingPlanes: [riseClip], side: THREE.DoubleSide }));
    // casillas por fila: solo se ven las filas abiertas en el nivel actual
    this.rowTiles = [];
    for (let r = 0; r < BOARD.rows; r++) {
      const g = buildTiles(r);
      const t = g ? add(g, terrainMat) : null;
      if (t) t.receiveShadow = true;
      this.rowTiles.push(t);
    }
    add(env('decorado', buildProps), MATS.std, 0.0007).castShadow = true;
    // vegetación de la landing de PyCon 2028 (hojas finas: sin contorno y por las dos caras)
    const vegGeo = buildVegetation();
    if (vegGeo) {
      const vegMat = toon({ side: THREE.DoubleSide });
      add(vegGeo, vegMat).receiveShadow = true;
      // árboles grandes de la orilla: proyectan sombra sobre el tablero
      if (vegGeo.userData.trees) add(vegGeo.userData.trees, vegMat).castShadow = true;
      // copas de racimos de hojas fotografiadas (estilo de la landing de PyCon 2028)
      const tufts = vegGeo.userData.tufts;
      if (tufts) {
        tufts.matrixAutoUpdate = false;
        this.content.add(tufts);
      }
    }
    const comp = buildCompany();
    add(env('empresa', () => comp.geo), MATS.std, 0.0009).castShadow = true;
    this.smokeOrigin = comp.smoke;
    this.smokeT = 0;

    // río animado
    this.water = buildWater();
    this.content.add(this.water);

    // Letrero de la empresa
    this.sign = new CanvasPlane(0.15, 0.046, 3000);
    this.sign.material.clippingPlanes = [riseClip];
    this.sign.material.side = THREE.DoubleSide;
    this.sign.position.copy(comp.signCenter);
    this.sign.rotation.y = SIGN_YAW;
    this.sign.draw((ctx, W, H) => {
      roundRect(ctx, 4, 4, W - 8, H - 8, H * 0.12);
      ctx.fillStyle = '#f4f1ea';
      ctx.fill();
      ctx.lineWidth = H * 0.07;
      ctx.strokeStyle = '#b3261e';
      ctx.stroke();
      ctx.fillStyle = '#b3261e';
      ctx.beginPath();
      ctx.arc(H * 0.48, H * 0.5, H * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4f1ea';
      ctx.fillRect(H * 0.34, H * 0.42, H * 0.28, H * 0.26);
      ctx.beginPath();
      ctx.ellipse(H * 0.48, H * 0.42, H * 0.14, H * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#2b2b2b';
      let size = H * 0.36;
      ctx.font = `700 ${size}px ${FONT}`;
      while (ctx.measureText('DEFORESTA S.A.').width > W - H * 1.05 && size > 8) {
        size *= 0.95;
        ctx.font = `700 ${size}px ${FONT}`;
      }
      ctx.fillText('DEFORESTA S.A.', H * 0.9, H * 0.4);
      ctx.fillStyle = '#7a7a7a';
      ctx.font = `500 ${H * 0.17}px ${FONT}`;
      ctx.fillText('madera · ganado · minería', H * 0.92, H * 0.72);
    });
    this.content.add(this.sign);

    // lo que hay que proteger
    this.heart = new THREE.Group();
    this.heart.position.set(HEART.x, LAND_Y - 0.0005, HEART.z);
    // corazón de la isla: una pradera tupida (si no cargó la vegetación, el Mangle madre de antes)
    const meadow = buildMeadow();
    this.heartMesh = new THREE.Mesh(meadow || buildHeart(), meadow ? toon({ side: THREE.DoubleSide }) : MATS.std);
    if (!meadow) addOutline(this.heartMesh, 0.0009);
    this.heartMats = meadow ? { std: this.heartMesh.material, hurt: MATS.hurt, charred: MATS.charred } : MATS;
    this.heart.add(this.heartMesh);
    this.heartBar = createHpBar(0.09, 0.006, '#5fd16a');
    this.heartBar.group.position.y = (meadow ? MEADOW_TOP : HEART_TOP) + 0.012;
    this.heart.add(this.heartBar.group);
    this.content.add(this.heart);
    this.heartT = 0;
    this.heartShake = 0;

    this.riseT = 1;
    this.onRisen = null;
  }

  /** Vida del corazón de la isla (0..1). */
  setHeart(f, hit = false) {
    this.heartBar.set(f);
    if (hit) this.heartShake = 0.2;
    const dead = f <= 0;
    const M = this.heartMats;
    this.heartMesh.material = dead ? M.charred : f < 0.3 ? M.hurt : M.std;
  }

  heartPulse(dt, hit) {
    this.heartT += dt;
    this.heartShake = Math.max(0, this.heartShake - dt);
    const s = 1 + Math.sin(this.heartT * 1.6) * 0.012;
    this.heartMesh.scale.set(1, s, 1);
    this.heartMesh.rotation.z = this.heartShake > 0 ? Math.sin(this.heartT * 60) * 0.03 : Math.sin(this.heartT * 0.8) * 0.01;
    if (hit && Math.random() < dt * 10) {
      this.fx.emit({ pos: [HEART.x + (Math.random() - 0.5) * 0.06, LAND_Y + 0.1 + Math.random() * 0.04, HEART.z + (Math.random() - 0.5) * 0.05], vel: [(Math.random() - 0.5) * 0.04, -0.03, (Math.random() - 0.5) * 0.04], color: Math.random() < 0.5 ? '#3aa048' : '#7bc96f', size: 0.0028, life: 1.2, grav: -0.1 });
    }
  }

  /** Muestra solo las casillas de las filas abiertas (las demás quedan como pasto). */
  setRows(open) {
    this.rowTiles.forEach((m, r) => m && (m.visible = !open || open.includes(r)));
  }

  /** Casilla bajo un punto local; `land` dice si se puede plantar ahí. */
  cellFromLocal(v) {
    return cellAt(v.x, v.z);
  }

  makeHighlight() {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(CELL * 0.92, CELL * 0.92).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false })
    );
    mesh.position.y = LAND_Y + 0.0022;
    mesh.renderOrder = 3;
    mesh.visible = false;
    this.content.add(mesh);
    return mesh;
  }

  /** Coloca el tablero en el mundo y lo hace brotar desde la superficie. */
  place({ position, yaw = 0, scale = 1 }) {
    this.root.position.copy(position);
    this.root.rotation.set(0, yaw, 0);
    this.root.scale.setScalar(scale);
    this.root.visible = true;
    this.root.updateMatrixWorld(true);
    this.riseT = 0;
    this.content.position.y = RISE_FROM;
    riseClip.normal.set(0, 1, 0);
    riseClip.constant = -position.y + 0.0005;
    sfx.rise();
  }

  get risen() {
    return this.riseT >= 1;
  }

  update(dt) {
    animateFoliage(performance.now() / 1000);
    // corriente del río (de izquierda a derecha)
    const map = this.water.material.normalMap || this.water.material.map;
    map.offset.x -= dt * 0.03;
    map.offset.y = Math.sin(performance.now() * 0.0004) * 0.01;

    if (this.riseT < 1) {
      this.riseT = Math.min(1, this.riseT + dt / RISE_TIME);
      const t = this.riseT;
      const e = 1 - Math.pow(1 - t, 3);
      this.content.position.y = RISE_FROM + (RISE_TO - RISE_FROM) * e;
      if (Math.random() < 0.6) {
        const x = LAYOUT.left + Math.random() * LAYOUT.totalW;
        const z = Math.random() < 0.5 ? LAYOUT.back : LAYOUT.front;
        this.fx.emit({
          pos: [x, -this.content.position.y + 0.002, z],
          vel: [(Math.random() - 0.5) * 0.08, 0.1 + Math.random() * 0.1, (z > 0 ? 1 : -1) * 0.05],
          color: Math.random() < 0.5 ? '#7a5a3a' : '#9c7a52',
          size: 0.0025,
          life: 0.7,
          grav: -0.5,
          floor: false,
        });
      }
      if (this.riseT >= 1) {
        riseClip.constant = 1000;
        for (let i = 0; i < 40; i++) {
          const a = Math.random() * Math.PI * 2;
          const rr = Math.sqrt(Math.random());
          this.fx.emit({
            pos: [ISLAND.cx + Math.cos(a) * ISLAND.landA * rr, LAND_Y + 0.04 + Math.random() * 0.04, ISLAND.cz + Math.sin(a) * ISLAND.landB * rr],
            vel: [(Math.random() - 0.5) * 0.06, 0.06, (Math.random() - 0.5) * 0.06],
            color: ['#3fa34d', '#7bc96f', '#2e7d32', '#ffd23f'][i % 4],
            size: 0.0028,
            life: 1.1,
            grav: -0.25,
            drag: 2,
          });
        }
        this.onRisen?.();
      }
    }

    // humo de la chimenea
    this.smokeT -= dt;
    if (this.smokeT <= 0 && this.root.visible) {
      this.smokeT = 0.3 + Math.random() * 0.2;
      this.fx.smoke(this.smokeOrigin, { color: Math.random() < 0.5 ? '#6b6b6b' : '#888888', size: 0.0045, rise: 0.035, life: 2.2 });
    }
  }
}
