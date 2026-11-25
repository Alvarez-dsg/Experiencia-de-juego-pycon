// Elementos de interfaz dentro del mundo 3D (texturas de canvas, botones, paneles).
// Estética de la página de PyCon Colombia 2028: tarjetas crema con borde naranja,
// paneles salvia, botones píldora verde selva y tipografía Poppins.
import * as THREE from 'three';
import { sfx } from './audio.js';
import { tr, onLang } from './i18n.js';

export const FONT = "'Poppins', system-ui, 'Segoe UI', Roboto, sans-serif";

// Tokens de color de la página (styles.css de pycon-landing)
export const PY = {
  cream: '#FBF6EC', // fondo de tarjeta
  orange: '#E3913A', // borde de tarjeta
  aqua: '#EEF2E1', // panel interno salvia
  teal: '#4D6E3C', // verde selva
  blush: '#F6E5D3', // durazno
  green: '#3F5F31', // botón principal
  greenDark: '#2F4A24', // hover / texto verde
  ink: '#1B2A17', // texto principal
  muted: '#4E5A45', // texto secundario
  sky: '#E9EFDD',
  pyBlue: '#47868B', // logo de Python
  pyOrange: '#F59216',
  danger: '#B4442B',
};

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Ajusta el tamaño de letra para que `text` quepa en `maxW`. Devuelve el tamaño final. */
export function fitFont(ctx, text, maxW, size, weight = 600, min = 8) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  while (ctx.measureText(text).width > maxW && size > min) {
    size *= 0.93;
    ctx.font = `${weight} ${size}px ${FONT}`;
  }
  return size;
}

/** Texto con espaciado entre letras (las "cejas" de la página van en mayúsculas espaciadas). */
export function spacedText(ctx, text, x, y, spacing) {
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${spacing}px`;
    // el espaciado se añade también tras la última letra: se compensa al centrar
    const dx = ctx.textAlign === 'center' ? spacing / 2 : 0;
    ctx.fillText(text, x + dx, y);
    ctx.letterSpacing = '0px';
  } else ctx.fillText(text, x, y);
}

/** "Ceja" (eyebrow) de la página: línea naranja + texto en mayúsculas espaciadas. */
export function drawEyebrow(ctx, text, x, y, size, { align = 'left', color = PY.greenDark, line = true, maxW = Infinity } = {}) {
  ctx.save();
  const lw = line ? size * 2.2 : 0;
  const gap = line ? size * 0.6 : 0;
  const measure = () => {
    ctx.font = `600 ${size}px ${FONT}`;
    return ctx.measureText(text.toUpperCase()).width + size * 0.14 * text.length;
  };
  let w = measure();
  while (w + lw + gap > maxW && size > 6) {
    size *= 0.94;
    w = measure();
  }
  ctx.textBaseline = 'middle';
  const sp = size * 0.14;
  let x0 = x;
  if (align === 'center') x0 = x - (w + lw + gap) / 2;
  if (line) {
    ctx.fillStyle = PY.orange;
    ctx.fillRect(x0, y - size * 0.08, lw, size * 0.16);
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  spacedText(ctx, text.toUpperCase(), x0 + lw + gap, y, sp);
  ctx.restore();
}

/** Ícono de agua (la "moneda" del juego): gota azul con brillo y contorno. */
export function drawDrop(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y + r * 0.15);
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.25);
  ctx.bezierCurveTo(r * 0.35, -r * 0.7, r * 0.85, -r * 0.2, r * 0.85, r * 0.2);
  ctx.arc(0, r * 0.2, r * 0.85, 0, Math.PI, false);
  ctx.bezierCurveTo(-r * 0.85, -r * 0.2, -r * 0.35, -r * 0.7, 0, -r * 1.25);
  ctx.closePath();
  const g = ctx.createRadialGradient(-r * 0.25, -r * 0.1, r * 0.05, 0, r * 0.1, r * 1.1);
  g.addColorStop(0, '#d8f6ff');
  g.addColorStop(0.45, '#58c4f0');
  g.addColorStop(1, '#1f86c8');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = r * 0.14;
  ctx.strokeStyle = '#21170f';
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.32, r * 0.05, r * 0.13, r * 0.26, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
export const drawSun = drawDrop;

// Símbolo de Python del logo de PyCon Colombia (favicon.svg de la página)
const PY_PATH = 'M31.5 3C22 3 17 6.4 17 12.5V20h15v3H10.5C4.6 23 1 27.6 1 36.5S4.6 50 10.5 50H16v-8.3C16 35.8 20.6 31 26.5 31h13c4.9 0 8.5-3.8 8.5-8.6V12.5C48 6.6 42 3 31.5 3Z';
let pyPath = null;
export function drawPyLogo(ctx, x, y, size) {
  pyPath ??= new Path2D(PY_PATH);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 64, size / 64);
  ctx.fillStyle = PY.pyBlue;
  ctx.fill(pyPath);
  ctx.save();
  ctx.translate(64, 64);
  ctx.rotate(Math.PI);
  ctx.fillStyle = PY.pyOrange;
  ctx.fill(pyPath);
  ctx.restore();
  ctx.fillStyle = '#FFFDF7';
  ctx.beginPath();
  ctx.arc(24, 11.5, 2.8, 0, Math.PI * 2);
  ctx.arc(40, 52.5, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Marca "PyCon Colombia 2028" (logo + texto) alineada a la izquierda en (x, y centro). */
export function drawPyBrand(ctx, x, y, h, color = PY.ink) {
  drawPyLogo(ctx, x, y - h / 2, h);
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.font = `600 ${h * 0.5}px ${FONT}`;
  ctx.fillText('PyCon', x + h * 1.18, y + h * 0.02);
  const w = ctx.measureText('PyCon ').width;
  ctx.fillStyle = PY.greenDark;
  ctx.font = `700 ${h * 0.5}px ${FONT}`;
  ctx.fillText('CO 2028', x + h * 1.18 + w, y + h * 0.02);
  ctx.restore();
}

/** Fondo "avatar" de la página: degradados suaves con un tono y hojas en la base. */
export function drawAvatarBg(ctx, x, y, w, h, hue, r) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const lin = ctx.createLinearGradient(x, y, x + w * 0.5, y + h);
  lin.addColorStop(0, `hsl(${hue} 55% 88%)`);
  lin.addColorStop(1, `hsl(${hue} 40% 70%)`);
  ctx.fillStyle = lin;
  ctx.fillRect(x, y, w, h);
  const blob = (cx, cy, rx, ry, color) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  };
  blob(x + w * 0.78, y + h * 0.18, w * 0.45, h * 0.4, 'hsl(42 95% 78% / 0.85)');
  blob(x + w * 0.2, y + h * 1.05, w * 0.6, h * 0.5, `hsl(${hue + 40} 45% 52% / 0.75)`);
  blob(x + w * 0.95, y + h * 0.9, w * 0.55, h * 0.45, `hsl(${hue - 30} 50% 45% / 0.6)`);
  // silueta de hojas
  ctx.fillStyle = `hsl(${hue - 40} 40% 32% / 0.35)`;
  for (const [fx, a] of [
    [0.08, -0.5],
    [0.24, 0.3],
    [0.8, -0.3],
    [0.95, 0.5],
  ]) {
    ctx.save();
    ctx.translate(x + w * fx, y + h * 0.98);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.07, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** Tarjeta de la página: crema + borde naranja + sombra suave. */
export function drawCard(ctx, x, y, w, h, r, { fill = PY.cream, border = PY.orange, lw = 3, alpha = 0.97, shadow = true } = {}) {
  ctx.save();
  if (shadow) {
    ctx.shadowColor = 'rgba(27, 42, 23, 0.35)';
    ctx.shadowBlur = lw * 5;
    ctx.shadowOffsetY = lw * 1.5;
  }
  roundRect(ctx, x, y, w, h, r);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = lw;
  ctx.strokeStyle = border;
  ctx.stroke();
  ctx.restore();
}

/** Plano con textura de canvas que se puede redibujar. */
export class CanvasPlane extends THREE.Mesh {
  constructor(wM, hM, pxPerM = 2400, opts = {}) {
    const cw = Math.min(2048, Math.round(wM * pxPerM));
    const ch = Math.min(2048, Math.round(hM * pxPerM));
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: opts.alphaTest ?? 0.02,
      depthWrite: opts.depthWrite ?? true,
      depthTest: opts.depthTest ?? true,
      toneMapped: false,
    });
    super(new THREE.PlaneGeometry(wM, hM), mat);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tex = tex;
    this.wM = wM;
    this.hM = hM;
  }
  draw(fn) {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fn(ctx, canvas.width, canvas.height);
    this.tex.needsUpdate = true;
  }
}

/** ¿El objeto está realmente en escena y visible? */
export function isShown(obj) {
  let o = obj;
  while (o) {
    if (!o.visible) return false;
    if (o.isScene) return true;
    o = o.parent;
  }
  return false;
}

// Todo lo que se puede pulsar (botones y cartas de la selección). Interaction los recorre.
export const BUTTONS = new Set();
// al cambiar de idioma, los botones con texto fijo se vuelven a escribir
onLang(() => {
  for (const b of BUTTONS) if (b.i18n) b.setLabel?.(tr(b.i18n));
});

/** Base de todo lo pulsable: `face` es el plano que recibe el rayo; w/h la caja de toque. */
export class Pressable extends THREE.Group {
  constructor(w, h) {
    super();
    this.w = w;
    this.h = h;
    this.enabled = true;
    this.hover = false;
    this.pressT = 0;
    this._poked = new Set();
    this.onPress = null;
    BUTTONS.add(this);
  }
  redraw() {}
  setHover(v) {
    if (v !== this.hover) {
      this.hover = v;
      this.redraw();
    }
  }
  press() {
    if (!this.enabled || !isShown(this) || this.pressT > 0.4) return;
    this.pressT = 1;
    sfx.click();
    this.onPress?.();
  }
  update(dt) {
    if (this.pressT > 0) this.pressT = Math.max(0, this.pressT - dt * 4);
    const k = this.pressT;
    this.face.position.z = -0.005 * k;
    this.face.scale.setScalar(1 - 0.06 * k);
  }
}

/** Botón píldora de la página. variant: 'primary' (verde), 'outline' (crema con borde verde), 'accent' (naranja). */
export class Button3D extends Pressable {
  constructor({ label = '', w = 0.12, h = 0.042, variant = 'primary', icon = null, onPress = null, fontScale = 0.4 }) {
    super(w, h);
    this.i18n = label; // texto original (español): se vuelve a traducir si cambia el idioma
    this.label = tr(label);
    this.variant = variant;
    this.icon = icon;
    this.fontScale = fontScale;
    this.onPress = onPress;
    this.face = new CanvasPlane(w, h, 2600);
    this.face.renderOrder = 12;
    this.add(this.face);
    this.redraw();
  }
  setLabel(label) {
    if (label === this.label) return;
    this.label = label;
    this.redraw();
  }
  setEnabled(v) {
    if (v === this.enabled) return;
    this.enabled = v;
    this.redraw();
  }
  redraw() {
    const { label, variant, hover, icon, enabled } = this;
    this.face.draw((ctx, W, H) => {
      const pad = H * 0.1;
      const x = pad;
      const y = pad * 0.8;
      const w = W - pad * 2;
      const h = H - pad * 2.2;
      ctx.globalAlpha = enabled ? 1 : 0.45;
      let fill;
      let text;
      let border;
      if (variant === 'outline') {
        fill = hover ? PY.aqua : PY.cream;
        text = PY.greenDark;
        border = hover ? PY.orange : PY.green;
      } else if (variant === 'accent') {
        fill = hover ? '#D07E2A' : PY.orange;
        text = PY.ink;
        border = hover ? PY.ink : 'rgba(27,42,23,0.25)';
      } else if (variant === 'danger') {
        fill = hover ? '#963722' : PY.danger;
        text = '#ffffff';
        border = hover ? PY.orange : 'rgba(255,255,255,0.35)';
      } else {
        fill = hover ? PY.greenDark : PY.green;
        text = '#ffffff';
        border = hover ? PY.orange : 'rgba(255,255,255,0.3)';
      }
      ctx.shadowColor = 'rgba(47, 74, 36, 0.55)';
      ctx.shadowBlur = H * 0.12;
      ctx.shadowOffsetY = H * 0.06;
      roundRect(ctx, x, y, w, h, h / 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = H * (variant === 'outline' || hover ? 0.05 : 0.03);
      ctx.strokeStyle = border;
      ctx.stroke();
      ctx.fillStyle = text;
      const cy = y + h / 2;
      if (icon === 'pause' && label) {
        // ícono de pausa + texto, centrados juntos
        const bw = H * 0.09;
        const bh = H * 0.34;
        ctx.font = `700 ${H * this.fontScale}px ${FONT}`;
        const tw = Math.min(ctx.measureText(label).width, w - h * 0.6 - bw * 4);
        const x0 = W / 2 - (bw * 3.2 + H * 0.12 + tw) / 2;
        ctx.fillRect(x0, cy - bh / 2, bw, bh);
        ctx.fillRect(x0 + bw * 2.2, cy - bh / 2, bw, bh);
        fitFont(ctx, label, tw, H * this.fontScale, 700);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x0 + bw * 3.2 + H * 0.12, cy + H * 0.01);
      } else if (icon === 'pause') {
        const bw = H * 0.1;
        const bh = H * 0.36;
        ctx.fillRect(W / 2 - bw * 1.6, cy - bh / 2, bw, bh);
        ctx.fillRect(W / 2 + bw * 0.6, cy - bh / 2, bw, bh);
      } else {
        fitFont(ctx, label, w - h * 0.7, H * this.fontScale, 600);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, W / 2, cy + H * 0.01);
      }
      ctx.globalAlpha = 1;
    });
  }
}

/** Panel (tarjeta de la página) con ceja, título, cuerpo y una fila de botones. */
export class Panel3D extends THREE.Group {
  constructor({ w = 0.44, h = 0.25, buttons = [] } = {}) {
    super();
    this.w = w;
    this.h = h;
    this.bg = new CanvasPlane(w, h, 2300);
    this.bg.renderOrder = 10;
    this.add(this.bg);
    this.buttons = buttons.map((cfg) => {
      const b = new Button3D({ h: 0.044, ...cfg });
      b.position.z = 0.004;
      this.add(b);
      return b;
    });
    this.layout();
    this.appear = 1;
  }
  layout() {
    const vis = this.buttons.filter((b) => b.visible);
    const gap = 0.01;
    const total = vis.reduce((s, b) => s + b.w, 0) + gap * (vis.length - 1);
    let x = -total / 2;
    for (const b of vis) {
      b.position.x = x + b.w / 2;
      b.position.y = -this.h / 2 + 0.036;
      x += b.w + gap;
    }
  }
  setText(title, body, { eyebrow = '', accent = PY.ink, icon = null, brand = true } = {}) {
    this.bg.draw((ctx, W, H) => {
      const pad = W * 0.02;
      drawCard(ctx, pad, pad, W - pad * 2, H - pad * 2, H * 0.09, { lw: H * 0.01 });
      const mx = W * 0.075;
      let y = H * 0.14;
      if (brand) drawPyBrand(ctx, W - mx - H * 0.36, H * 0.12, H * 0.075);
      if (eyebrow) {
        drawEyebrow(ctx, eyebrow, mx, y, H * 0.045, { maxW: W - mx * 2 - (brand ? H * 0.45 : 0) });
        y += H * 0.105;
      } else y += H * 0.03;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const size = fitFont(ctx, title, W - mx * 2, H * 0.115, 600);
      ctx.fillStyle = accent;
      ctx.fillText(title, mx, y + size * 0.7);
      y += size * 0.7 + H * 0.085;
      if (icon) icon(ctx, W, H);
      ctx.fillStyle = PY.muted;
      ctx.font = `500 ${H * 0.058}px ${FONT}`;
      for (const para of (body || '').split('\n')) {
        for (const line of wrapText(ctx, para, W - mx * 2)) {
          ctx.fillText(line, mx, y);
          y += H * 0.08;
        }
        y += H * 0.022;
      }
    });
  }
  update(dt) {
    for (const b of this.buttons) b.update(dt);
    popIn(this, dt);
  }
  show() {
    if (!this.visible) {
      this.visible = true;
      this.appear = 0;
      this.scale.setScalar(0.01);
    }
  }
  hide() {
    this.visible = false;
  }
}

/** Animación de aparición con rebote (usa obj.appear 0 → 1). */
export function popIn(obj, dt) {
  if (obj.appear >= 1) return;
  obj.appear = Math.min(1, obj.appear + dt * 4);
  const t = obj.appear;
  const s = 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
  obj.scale.setScalar(Math.max(0.01, s));
}

/** Letrero grande y temporal (anuncios de oleadas): píldora crema con borde naranja. */
export class Banner extends THREE.Group {
  constructor() {
    super();
    this.plane = new CanvasPlane(0.62, 0.12, 2200, { depthTest: false, depthWrite: false });
    this.plane.renderOrder = 30;
    this.add(this.plane);
    this.t = 0;
    this.dur = 0;
    this.visible = false;
  }
  show(text, sub = '', big = false, dur = 3, ok = false) {
    this.plane.draw((ctx, W, H) => {
      const pad = H * 0.08;
      const fill = big || ok ? PY.green : PY.cream;
      drawCard(ctx, pad, pad, W - pad * 2, H - pad * 2, (H - pad * 2) / 2, { fill, lw: H * 0.035, alpha: big ? 1 : 0.96 });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // el subtítulo puede ocupar hasta dos líneas
      let lines = [];
      let fs = H * 0.15;
      if (sub) {
        for (;;) {
          ctx.font = `500 ${fs}px ${FONT}`;
          lines = wrapText(ctx, sub, W * 0.84);
          if (lines.length <= 2 || fs < H * 0.09) break;
          fs *= 0.92;
        }
      }
      const two = lines.length > 1;
      const y = sub ? (two ? H * 0.33 : H * 0.4) : H * 0.5;
      fitFont(ctx, text, W * 0.86, H * (sub ? (two ? 0.26 : 0.3) : 0.36), 700);
      ctx.fillStyle = big || ok ? '#ffffff' : PY.ink;
      ctx.fillText(text, W / 2, y);
      if (sub) {
        ctx.font = `500 ${fs}px ${FONT}`;
        ctx.fillStyle = big || ok ? '#F6E5D3' : PY.muted;
        const y0 = two ? H * 0.6 : H * 0.7;
        lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, W / 2, y0 + i * fs * 1.2));
      }
    });
    this.t = 0;
    this.dur = dur;
    this.visible = true;
  }
  update(dt) {
    if (!this.visible) return;
    this.t += dt;
    const t = this.t;
    const inT = Math.min(1, t / 0.35);
    const outT = Math.max(0, (t - this.dur) / 0.4);
    const s = (1 + 2.2 * Math.pow(inT - 1, 3) + 1.2 * Math.pow(inT - 1, 2)) * (1 - outT);
    this.scale.setScalar(Math.max(0.001, s));
    if (outT >= 1) this.visible = false;
  }
}
