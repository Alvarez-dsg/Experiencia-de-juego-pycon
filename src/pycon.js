// Tarjetas de PyCon Colombia 2028 que aparecen al ganar cada nivel.
// Datos tomados de la página interactiva (pycon-landing: data.js, keynotes y sede).
// Estilo de la tarjeta de ponente de la página: crema, borde naranja, foto en panel salvia,
// ceja en mayúsculas, título de la charla en un recuadro y etiquetas.
import * as THREE from 'three';
import { tr } from './i18n.js';
import { CanvasPlane, Button3D, PY, FONT, roundRect, wrapText, fitFont, drawEyebrow, drawPyBrand, drawPyLogo, drawAvatarBg, drawCard, popIn } from './ui3d.js';

const BASE = import.meta.env.BASE_URL || './';

export const PYCON_CARDS = [
  {
    // nivel 1: la keynote sobre la Amazonía
    photo: 'pycon/k0.jpg',
    hue: 160,
    kicker: 'Keynote de apertura',
    name: 'Valentina Restrepo',
    role: 'Ciencia abierta y datos ambientales',
    talkLabel: 'Keynote · Viernes 14 jul · 08:30',
    talk: 'Python para cuidar la Amazonía',
    text: 'Cómo los datos abiertos, las imágenes satelitales y un puñado de scripts de Python ayudan a detectar la deforestación casi en tiempo real.',
    tags: ['Auditorio Fundadores', 'Ciencia'],
    hook: 'Tú frenaste a DEFORESTA S.A. en la mesa; ella lo hace con datos.',
  },
  {
    // nivel 2: la sede
    initials: 'EAFIT',
    hue: 120,
    kicker: 'La sede',
    name: 'Universidad EAFIT',
    role: 'Medellín · 14 al 16 de julio de 2028',
    talkLabel: 'Un campus que es un bosque',
    talk: 'Más de 500 especies de plantas',
    text: 'El campus de EAFIT recibe a la comunidad Python durante los tres días de la conferencia, entre auditorios, laboratorios y zonas verdes.',
    tags: ['Medellín', '3 días'],
    hook: 'Las plantas que defendiste también tienen casa en PyCon.',
  },
  {
    // nivel 3
    photo: 'pycon/k1.jpg',
    hue: 200,
    kicker: 'Keynote',
    name: 'Tomás Guerrero',
    role: 'Mantenedor open source',
    talkLabel: 'Keynote · Sábado 15 jul · 09:00',
    talk: 'El open source que sostiene al mundo',
    text: 'Lo que nadie ve detrás de las bibliotecas que usamos todos los días, y cómo cuidarlas entre todos.',
    tags: ['Auditorio Fundadores', 'Comunidad'],
    hook: 'Como la selva, el open source se sostiene si lo cuidamos entre todos.',
  },
  {
    // nivel 4
    photo: 'pycon/k2.jpg',
    hue: 300,
    kicker: 'Keynote de cierre',
    name: 'Ingrid Mejía',
    role: 'Educación y comunidad',
    talkLabel: 'Keynote · Domingo 16 jul · 09:00',
    talk: 'Enseñar Python en el colegio público',
    text: 'Lo que aprendimos enseñando a programar a miles de estudiantes, y lo que aún nos falta.',
    tags: ['Auditorio Fundadores', 'Educación'],
    hook: 'Aprender jugando también es aprender: ¡sigue al último nivel!',
  },
  {
    // final: ¿qué es PyCon?
    logo: true,
    hue: 100,
    kicker: '¡Salvaste la selva!',
    name: 'Nos vemos en PyCon Colombia 2028',
    role: 'Universidad EAFIT · Medellín',
    talkLabel: '¿Qué es PyCon?',
    talk: 'La conferencia anual de la comunidad Python en Colombia',
    text: '3 días de charlas, talleres y keynotes para aprender, compartir y conectar. Sin ánimo de lucro, hecha por voluntarios y abierta a todos los niveles.',
    tags: ['14 – 16 jul 2028', 'Todos los niveles'],
    hook: '',
  },
];

const images = {};
function loadImage(src) {
  if (!images[src]) {
    images[src] = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = BASE + src;
    });
  }
  return images[src];
}
/** Precarga las fotos para que la tarjeta aparezca completa. */
export function preloadPycon() {
  for (const c of PYCON_CARDS) if (c.photo) loadImage(c.photo);
}

export class PyconCard extends THREE.Group {
  constructor({ onNext, onRelocate, onReplay, onExit }) {
    super();
    this.w = 0.56;
    this.h = 0.33;
    this.bg = new CanvasPlane(this.w, this.h, 2300);
    this.bg.renderOrder = 10;
    this.add(this.bg);
    const y = -this.h / 2 + 0.036;
    // wireframe: "Salir" (a la pantalla de inicio) y "Siguiente nivel"
    this.exitBtn = new Button3D({ label: 'Salir', w: 0.13, h: 0.046, variant: 'outline', onPress: () => onExit?.() });
    this.nextBtn = new Button3D({ label: 'Siguiente nivel', w: 0.17, h: 0.046, onPress: () => onNext() });
    this.replayBtn = new Button3D({ label: 'Jugar de nuevo', w: 0.17, h: 0.046, onPress: () => onReplay() });
    this.relocBtn = new Button3D({ label: 'Recolocar', w: 0.11, h: 0.046, variant: 'outline', onPress: () => onRelocate() });
    this.buttons = [this.exitBtn, this.relocBtn, this.nextBtn, this.replayBtn];
    for (const b of this.buttons) {
      b.position.set(0, y, 0.004);
      this.add(b);
    }
    this.isXR = false;
    this.appear = 1;
    this.visible = false;
    this.token = 0;
  }

  setXR(isXR) {
    this.isXR = isXR;
    this.layout();
  }

  layout() {
    this.relocBtn.visible = this.isXR;
    // los botones van bajo la columna de texto
    const vis = this.buttons.filter((b) => b.visible);
    const gap = 0.01;
    const total = vis.reduce((s, b) => s + b.w, 0) + gap * (vis.length - 1);
    let x = this.w / 2 - 0.035 - total;
    for (const b of vis) {
      b.position.x = x + b.w / 2;
      x += b.w + gap;
    }
  }

  /** Muestra la tarjeta del nivel ganado. info: { level, total, kills, last } */
  async open(info) {
    const card = PYCON_CARDS[Math.min(info.level - 1, PYCON_CARDS.length - 1)];
    const final = info.last;
    this.nextBtn.visible = !final;
    this.replayBtn.visible = final;
    this.layout();
    const token = ++this.token;
    this.draw(card, info, null);
    this.visible = true;
    this.appear = 0;
    this.scale.setScalar(0.01);
    if (card.photo) {
      const img = await loadImage(card.photo);
      if (token === this.token && img) this.draw(card, info, img);
    }
  }

  hide() {
    this.visible = false;
  }

  draw(cardEs, info, img) {
    // textos de la tarjeta en el idioma elegido
    const card = { ...cardEs };
    for (const k of ['kicker', 'name', 'role', 'talkLabel', 'talk', 'text', 'hook']) if (card[k]) card[k] = tr(card[k]);
    if (card.tags) card.tags = card.tags.map((t) => tr(t));
    this.bg.draw((ctx, W, H) => {
      const pad = W * 0.008;
      drawCard(ctx, pad, pad, W - pad * 2, H - pad * 2, H * 0.08, { lw: H * 0.008 });
      // columna de la foto (panel salvia como en la tarjeta de ponente)
      const px = W * 0.04;
      const py = H * 0.07;
      const pw = W * 0.34;
      const ph = H * 0.86;
      roundRect(ctx, px, py, pw, ph, H * 0.05);
      ctx.fillStyle = PY.aqua;
      ctx.fill();
      const ix = px + pw * 0.07;
      const iy = py + pw * 0.07;
      const iw = pw * 0.86;
      const ih = ph * 0.66;
      if (img) {
        ctx.save();
        roundRect(ctx, ix, iy, iw, ih, H * 0.035);
        ctx.clip();
        const s = Math.max(iw / img.width, ih / img.height);
        const dw = img.width * s;
        const dh = img.height * s;
        ctx.drawImage(img, ix + (iw - dw) / 2, iy + (ih - dh) * 0.3, dw, dh);
        ctx.restore();
      } else {
        drawAvatarBg(ctx, ix, iy, iw, ih, card.hue, H * 0.035);
        if (card.logo) drawPyLogo(ctx, ix + iw / 2 - ih * 0.28, iy + ih * 0.22, ih * 0.56);
        else if (card.initials) {
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(27,42,23,0.45)';
          ctx.shadowBlur = H * 0.04;
          fitFont(ctx, card.initials, iw * 0.8, ih * 0.26, 600);
          ctx.fillText(card.initials, ix + iw / 2, iy + ih / 2);
          ctx.shadowBlur = 0;
        }
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = PY.ink;
      fitFont(ctx, card.name, pw * 0.9, H * 0.05, 500);
      const nameLines = card.name.length > 22 ? wrapText(ctx, card.name, pw * 0.9) : [card.name];
      let ny = iy + ih + H * 0.07;
      for (const l of nameLines.slice(0, 2)) {
        ctx.fillText(l, px + pw / 2, ny);
        ny += H * 0.055;
      }
      ctx.fillStyle = PY.muted;
      fitFont(ctx, card.role, pw * 0.9, H * 0.034, 500);
      ctx.fillText(card.role, px + pw / 2, Math.min(ny + H * 0.005, py + ph - H * 0.03));

      // columna de texto
      const tx = px + pw + W * 0.035;
      const tw = W - tx - W * 0.045;
      const brandX = W - W * 0.045 - H * 0.33;
      drawPyBrand(ctx, brandX, H * 0.1, H * 0.06);
      const eyebrow = info.last ? card.kicker : tr(`Nivel ${info.level} superado`);
      drawEyebrow(ctx, eyebrow, tx, H * 0.1, H * 0.028, { maxW: brandX - tx - W * 0.02 });
      ctx.textAlign = 'left';
      ctx.fillStyle = PY.ink;
      const title = info.last ? 'PyCon Colombia 2028' : tr('Conoce PyCon Colombia 2028');
      fitFont(ctx, title, tw * 0.95, H * 0.07, 600);
      ctx.fillText(title, tx, H * 0.2);
      // recuadro de la charla
      const by = H * 0.235;
      const bh = H * 0.37;
      roundRect(ctx, tx, by, tw, bh, H * 0.04);
      ctx.fillStyle = 'rgba(238, 242, 225, 0.9)';
      ctx.fill();
      ctx.save();
      ctx.font = `600 ${H * 0.026}px ${FONT}`;
      ctx.fillStyle = PY.greenDark;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${H * 0.003}px`;
      ctx.fillText(card.talkLabel.toUpperCase(), tx + H * 0.035, by + H * 0.06);
      ctx.restore();
      ctx.fillStyle = PY.ink;
      ctx.font = `600 ${H * 0.042}px ${FONT}`;
      let y = by + H * 0.115;
      for (const l of wrapText(ctx, card.talk, tw - H * 0.07).slice(0, 2)) {
        ctx.fillText(l, tx + H * 0.035, y);
        y += H * 0.05;
      }
      ctx.fillStyle = PY.muted;
      ctx.font = `500 ${H * 0.031}px ${FONT}`;
      y += H * 0.008;
      for (const l of wrapText(ctx, card.text, tw - H * 0.07).slice(0, 3)) {
        ctx.fillText(l, tx + H * 0.035, y);
        y += H * 0.042;
      }
      // etiquetas
      let gx = tx;
      const gy = by + bh + H * 0.03;
      ctx.font = `500 ${H * 0.028}px ${FONT}`;
      for (const t of card.tags) {
        const w = ctx.measureText(t).width + H * 0.05;
        roundRect(ctx, gx, gy, w, H * 0.055, H * 0.0275);
        ctx.fillStyle = PY.cream;
        ctx.fill();
        ctx.lineWidth = H * 0.004;
        ctx.strokeStyle = PY.teal;
        ctx.stroke();
        ctx.fillStyle = PY.greenDark;
        ctx.textBaseline = 'middle';
        ctx.fillText(t, gx + H * 0.025, gy + H * 0.029);
        ctx.textBaseline = 'alphabetic';
        gx += w + H * 0.015;
      }
      // dato del juego
      ctx.fillStyle = PY.ink;
      ctx.font = `500 ${H * 0.03}px ${FONT}`;
      const line = card.hook ? `${card.hook} ${tr('Invasores detenidos: {n}.', { n: info.kills })}` : tr('Superaste los {t} niveles y detuviste a {n} invasores en el último.', { t: info.total, n: info.kills });
      let hy = gy + H * 0.098;
      for (const l of wrapText(ctx, line, tw).slice(0, 2)) {
        ctx.fillText(l, tx, hy);
        hy += H * 0.04;
      }
    });
  }

  update(dt) {
    if (!this.visible) return;
    popIn(this, dt);
    for (const b of this.buttons) b.update(dt);
  }
}
