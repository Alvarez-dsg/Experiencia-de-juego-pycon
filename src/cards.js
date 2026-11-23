// Cartas de personaje con la estética de PyCon Colombia 2028.
//  · Carta de semilla (bandeja y selección): marco crema con borde naranja, ventana con el personaje
//    en 3D, caja blanca con el costo y el ícono de agua, e insignia redonda con el rol.
//  · Carta de habilidad (selección): nombre arriba, arte grande, tipo, habilidad y estadísticas.
import * as THREE from 'three';
import { PLANTS, ABILITIES } from './config.js';
import { MATS, addOutline, setGeometry } from './models.js';
import { plantGeometry } from './defenders.js';
import { CanvasPlane, PY, FONT, roundRect, wrapText, fitFont, drawSun, drawEyebrow, drawAvatarBg, drawCard, drawPyBrand } from './ui3d.js';

export const SHOVEL = { name: 'Pala', short: 'Pala', kind: 'shovel', cost: 0 };
export const defOf = (type) => (type === 'shovel' ? SHOVEL : PLANTS[type]);

// Tono del fondo "avatar" de cada personaje (como las fotos de la página)
const HUE = { heliconia: 140, achiote: 105, rana: 175, ceiba: 120, mariposa: 200, chiguiro: 38, mono: 30, guacamaya: 15, tortuga: 160, anaconda: 85, jabillo: 55, shovel: 45 };
export const hueOf = (type) => HUE[type] ?? 120;

export function roleOf(type) {
  const def = defOf(type);
  if (def.kind === 'shooter' && def.lanes === 3) return 'shooter3';
  return def.kind;
}

/** Ícono de rol en blanco (insignia redonda). */
export function drawRoleIcon(ctx, kind, x, y, r, color = '#ffffff') {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = r * 0.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const circle = (cx, cy, rr, fill = true) => {
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    fill ? ctx.fill() : ctx.stroke();
  };
  const line = (...pts) => {
    ctx.beginPath();
    ctx.moveTo(pts[0] * r, pts[1] * r);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * r, pts[i + 1] * r);
    ctx.stroke();
  };
  switch (kind) {
    case 'producer':
      circle(0, 0, r * 0.36);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        line(Math.cos(a) * 0.58, Math.sin(a) * 0.58, Math.cos(a) * 0.92, Math.sin(a) * 0.92);
      }
      break;
    case 'shooter':
      circle(r * 0.3, 0, r * 0.36);
      line(-0.9, -0.35, -0.25, -0.35);
      line(-0.95, 0, -0.2, 0);
      line(-0.9, 0.35, -0.25, 0.35);
      break;
    case 'shooter3':
      for (const yy of [-0.55, 0, 0.55]) {
        circle(r * 0.42, yy * r, r * 0.22);
        line(-0.85, yy, 0.05, yy);
      }
      break;
    case 'wall':
      ctx.beginPath();
      ctx.moveTo(0, -0.9 * r);
      ctx.lineTo(0.75 * r, -0.6 * r);
      ctx.quadraticCurveTo(0.75 * r, 0.55 * r, 0, 0.92 * r);
      ctx.quadraticCurveTo(-0.75 * r, 0.55 * r, -0.75 * r, -0.6 * r);
      ctx.closePath();
      ctx.fill();
      break;
    case 'barrier':
      line(-0.9, 0.55, -0.6, -0.45, -0.3, 0.55, 0, -0.45, 0.3, 0.55, 0.6, -0.45, 0.9, 0.55);
      line(-0.95, 0.75, 0.95, 0.75);
      break;
    case 'healer':
      ctx.fillRect(-0.22 * r, -0.8 * r, 0.44 * r, 1.6 * r);
      ctx.fillRect(-0.8 * r, -0.22 * r, 1.6 * r, 0.44 * r);
      break;
    case 'biter':
      for (const s of [-1, 1]) {
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const x0 = -0.8 + i * 0.4;
          ctx.moveTo(x0 * r, s * 0.15 * r);
          ctx.lineTo((x0 + 0.2) * r, s * 0.75 * r);
          ctx.lineTo((x0 + 0.4) * r, s * 0.15 * r);
        }
        ctx.fill();
      }
      break;
    case 'leaper':
      ctx.beginPath();
      ctx.arc(0, 0.45 * r, 0.75 * r, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
      line(0.72, 0.28, 0.78, 0.62, 0.42, 0.55);
      circle(-0.72 * r, 0.55 * r, r * 0.16);
      break;
    case 'roller':
      ctx.beginPath();
      ctx.arc(-0.1 * r, 0.05 * r, 0.55 * r, 0, Math.PI * 2);
      ctx.stroke();
      line(-0.1, -0.5, -0.1, 0.6);
      line(-0.65, 0.05, 0.45, 0.05);
      line(0.65, -0.55, 0.95, -0.25, 0.65, 0.05);
      break;
    case 'trap':
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = i * 0.42;
        const rr = (0.08 + i * 0.021) * r;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.stroke();
      break;
    case 'grenade':
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const rr = (i % 2 ? 0.42 : 0.95) * r;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      break;
    case 'shovel':
      line(-0.6, -0.6, 0.25, 0.25);
      ctx.beginPath();
      ctx.moveTo(0.1 * r, 0.4 * r);
      ctx.lineTo(0.4 * r, 0.1 * r);
      ctx.lineTo(0.9 * r, 0.6 * r);
      ctx.lineTo(0.6 * r, 0.9 * r);
      ctx.closePath();
      ctx.fill();
      break;
    case 'leaf':
      ctx.beginPath();
      ctx.ellipse(0, 0, 0.42 * r, 0.85 * r, 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PY.green;
      ctx.lineWidth = r * 0.1;
      line(-0.45, 0.6, 0.45, -0.6);
      break;
    case 'paw':
      ctx.beginPath();
      ctx.ellipse(0, 0.3 * r, 0.42 * r, 0.34 * r, 0, 0, Math.PI * 2);
      ctx.fill();
      for (const [px, py] of [
        [-0.62, -0.12],
        [-0.25, -0.55],
        [0.25, -0.55],
        [0.62, -0.12],
      ])
        circle(px * r, py * r, r * 0.19);
      break;
  }
  ctx.restore();
}

/** Insignia redonda verde selva con borde crema. */
function badge(ctx, kind, x, y, r) {
  ctx.save();
  ctx.shadowColor = 'rgba(27,42,23,0.35)';
  ctx.shadowBlur = r * 0.3;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = PY.green;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = r * 0.16;
  ctx.strokeStyle = PY.cream;
  ctx.stroke();
  ctx.restore();
  drawRoleIcon(ctx, kind, x, y, r * 0.58);
}

/**
 * Carta de semilla. st: { affordable, hover, picked, empty, index }
 * (picked = ya está en el equipo; empty = ranura vacía del equipo)
 */
export function drawSeedCard(ctx, W, H, type, st = {}) {
  const pad = W * 0.045;
  if (st.empty) {
    roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, W * 0.1);
    ctx.fillStyle = 'rgba(238, 242, 225, 0.75)';
    ctx.fill();
    ctx.setLineDash([W * 0.06, W * 0.045]);
    ctx.lineWidth = W * 0.025;
    ctx.strokeStyle = PY.teal;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = PY.teal;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${H * 0.2}px ${FONT}`;
    ctx.fillText(String(st.index ?? ''), W / 2, H * 0.47);
    return;
  }
  const def = defOf(type);
  const shovel = type === 'shovel';
  const affordable = st.affordable ?? true;
  if (st.hover) {
    ctx.save();
    ctx.shadowColor = PY.orange;
    ctx.shadowBlur = W * 0.08;
    roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, W * 0.1);
    ctx.fillStyle = PY.orange;
    ctx.fill();
    ctx.restore();
  }
  drawCard(ctx, pad, pad, W - pad * 2, H - pad * 2, W * 0.1, { lw: W * (st.hover ? 0.04 : 0.025), shadow: !st.hover });
  // ventana del personaje
  drawAvatarBg(ctx, W * 0.11, H * 0.075, W * 0.78, H * 0.56, hueOf(type), W * 0.06);
  // nombre
  ctx.fillStyle = PY.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const name = def.short || def.name;
  fitFont(ctx, name, W * 0.8, H * 0.066, 600);
  ctx.fillText(name, W / 2, H * 0.68);
  // costo con la luz
  if (!shovel) {
    roundRect(ctx, W * 0.11, H * 0.735, W * 0.6, H * 0.165, W * 0.045);
    ctx.fillStyle = affordable ? '#ffffff' : '#FBE3DA';
    ctx.fill();
    ctx.lineWidth = W * 0.022;
    ctx.strokeStyle = PY.green;
    ctx.stroke();
    ctx.fillStyle = affordable ? PY.ink : PY.danger;
    ctx.textAlign = 'left';
    ctx.font = `800 ${H * 0.115}px ${FONT}`;
    ctx.fillText(String(def.cost), W * 0.17, H * 0.822);
    drawSun(ctx, W * 0.76, H * 0.815, H * 0.078);
  } else {
    roundRect(ctx, W * 0.18, H * 0.75, W * 0.64, H * 0.13, H * 0.065);
    ctx.fillStyle = PY.cream;
    ctx.fill();
    ctx.lineWidth = W * 0.022;
    ctx.strokeStyle = PY.green;
    ctx.stroke();
    ctx.fillStyle = PY.greenDark;
    ctx.textAlign = 'center';
    ctx.font = `600 ${H * 0.07}px ${FONT}`;
    ctx.fillText('Quitar', W / 2, H * 0.818);
  }
  badge(ctx, roleOf(type), W * 0.17, H * 0.11, W * 0.12);
  if (st.picked) {
    roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, W * 0.1);
    ctx.fillStyle = 'rgba(251, 246, 236, 0.5)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W * 0.8, H * 0.11, W * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = PY.orange;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = W * 0.035;
    ctx.beginPath();
    ctx.moveTo(W * 0.74, H * 0.112);
    ctx.lineTo(W * 0.785, H * 0.14);
    ctx.lineTo(W * 0.86, H * 0.085);
    ctx.stroke();
  }
}

/** Modelo 3D del personaje para una carta: pivot (compensa la inclinación) → giro → malla centrada. */
export function cardModel(type, maxH, maxW, tilt = 0) {
  const pivot = new THREE.Group();
  pivot.rotation.x = -tilt;
  const spin = new THREE.Group();
  pivot.add(spin);
  const mesh = new THREE.Mesh(plantGeometry(type), MATS.std);
  addOutline(mesh, 0.0014);
  spin.add(mesh);
  fitModel(mesh, type, maxH, maxW);
  spin.rotation.y = type === 'shovel' ? 0.6 : -0.55;
  return { pivot, spin, mesh };
}

export function fitModel(mesh, type, maxH, maxW) {
  const geo = plantGeometry(type);
  setGeometry(mesh, geo);
  const bb = geo.boundingBox;
  const h = bb.max.y - bb.min.y;
  const w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
  const k = Math.min(maxH / h, maxW / w);
  mesh.scale.setScalar(k);
  mesh.position.set((-(bb.min.x + bb.max.x) / 2) * k, -bb.min.y * k, (-(bb.min.z + bb.max.z) / 2) * k);
}

/** Carta grande de habilidad (composición tipo carta coleccionable). */
export class AbilityCard extends THREE.Group {
  constructor(w = 0.2, h = 0.29, tilt = 0) {
    super();
    this.w = w;
    this.h = h;
    this.bg = new CanvasPlane(w, h, 2600);
    this.bg.renderOrder = 11;
    this.add(this.bg);
    // ventana del arte: 14 %–56 % del alto
    this.artH = h * 0.42;
    const m = cardModel('heliconia', this.artH * 0.72, w * 0.6, tilt);
    this.pivot = m.pivot;
    this.spin = m.spin;
    this.mesh = m.mesh;
    this.pivot.position.set(0, h / 2 - h * 0.525, 0.014);
    this.add(this.pivot);
    this.type = null;
    this.t = 0;
  }

  show(type) {
    if (type === this.type) return;
    this.type = type;
    fitModel(this.mesh, type, this.artH * 0.72, this.w * 0.6);
    this.spin.rotation.y = -0.55;
    this.t = 0;
    const def = defOf(type);
    const ab = ABILITIES[type];
    this.bg.draw((ctx, W, H) => {
      const pad = W * 0.02;
      drawCard(ctx, pad, pad, W - pad * 2, H - pad * 2, W * 0.07, { lw: W * 0.012 });
      // nombre + insignia planta/animal
      roundRect(ctx, W * 0.06, H * 0.035, W * 0.88, H * 0.085, H * 0.0425);
      ctx.fillStyle = PY.aqua;
      ctx.fill();
      ctx.fillStyle = PY.ink;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitFont(ctx, def.name, W * 0.66, H * 0.046, 600);
      ctx.fillText(def.name, W * 0.1, H * 0.079);
      badge(ctx, def.animal ? 'paw' : 'leaf', W * 0.865, H * 0.0775, H * 0.036);
      // arte
      drawAvatarBg(ctx, W * 0.06, H * 0.135, W * 0.88, H * 0.42, hueOf(type), W * 0.045);
      roundRect(ctx, W * 0.06, H * 0.135, W * 0.88, H * 0.42, W * 0.045);
      ctx.lineWidth = W * 0.006;
      ctx.strokeStyle = PY.orange;
      ctx.stroke();
      // tipo
      drawEyebrow(ctx, `${def.animal ? 'Animal' : 'Planta'} · ${ab.tipo}`, W * 0.07, H * 0.592, H * 0.023);
      // habilidad
      roundRect(ctx, W * 0.06, H * 0.62, W * 0.88, H * 0.215, W * 0.04);
      ctx.fillStyle = PY.aqua;
      ctx.fill();
      ctx.fillStyle = PY.ink;
      ctx.font = `500 ${H * 0.029}px ${FONT}`;
      ctx.textBaseline = 'alphabetic';
      let y = H * 0.665;
      for (const line of wrapText(ctx, ab.text, W * 0.8).slice(0, 5)) {
        ctx.fillText(line, W * 0.1, y);
        y += H * 0.039;
      }
      // estadísticas en etiquetas (como las "tags" de la página)
      const stats = [
        ['Costo', String(def.cost ?? 0), true],
        ['Vida', def.kind === 'grenade' ? '—' : String(def.hp)],
        [ab.stat[0], ab.stat[1]],
      ];
      const sw = W * 0.28;
      stats.forEach(([label, value, sun], i) => {
        const x = W * 0.06 + i * (sw + W * 0.02);
        const yy = H * 0.85;
        roundRect(ctx, x, yy, sw, H * 0.07, H * 0.035);
        ctx.fillStyle = PY.cream;
        ctx.fill();
        ctx.lineWidth = W * 0.006;
        ctx.strokeStyle = PY.teal;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = PY.muted;
        ctx.font = `600 ${H * 0.017}px ${FONT}`;
        ctx.fillText(label.toUpperCase(), x + sw / 2 + (sun ? H * 0.012 : 0), yy + H * 0.02);
        ctx.fillStyle = PY.greenDark;
        fitFont(ctx, value, sw * 0.8, H * 0.03, 700);
        ctx.fillText(value, x + sw / 2 + (sun ? H * 0.012 : 0), yy + H * 0.047);
        if (sun) drawSun(ctx, x + H * 0.03, yy + H * 0.035, H * 0.017);
      });
      // pie de carta
      drawPyBrand(ctx, W * 0.07, H * 0.955, H * 0.028);
      ctx.textAlign = 'right';
      ctx.fillStyle = PY.muted;
      ctx.font = `500 ${H * 0.017}px ${FONT}`;
      ctx.fillText('Amazonas vs Leñadores', W * 0.93, H * 0.955);
    });
  }

  update(dt) {
    this.t += dt;
    this.spin.rotation.y = -0.55 + Math.sin(this.t * 0.9) * 0.5;
  }
}
