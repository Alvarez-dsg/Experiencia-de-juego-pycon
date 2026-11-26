// Pantalla de inicio (según el wireframe): selector de idioma arriba, tarjeta con el chigüiro
// constructor (casco y llave) y dos botones: "Ver tutorial" y "Jugar".
import * as THREE from 'three';
import { CanvasPlane, Button3D, PY, FONT, drawCard, drawEyebrow, drawPyBrand, fitFont, roundRect, popIn } from './ui3d.js';
import { tr, getLang, setLang } from './i18n.js';

/** Chigüiro con casco amarillo, camisa morada y una llave en la mano (dibujo original, estilo de la portada). */
export function drawChiguiroWorker(ctx, cx, cy, s) {
  const ink = '#2a1d14';
  const lw = s * 0.035;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const shape = (fill, draw) => {
    ctx.beginPath();
    draw();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = ink;
    ctx.stroke();
  };
  // cuerpo con camisa morada
  shape('#c58cf0', () => {
    ctx.moveTo(-s * 0.42, s * 0.62);
    ctx.bezierCurveTo(-s * 0.44, s * 0.3, -s * 0.36, s * 0.16, -s * 0.2, s * 0.12);
    ctx.lineTo(s * 0.22, s * 0.12);
    ctx.bezierCurveTo(s * 0.38, s * 0.16, s * 0.45, s * 0.3, s * 0.43, s * 0.62);
    ctx.closePath();
  });
  // cuello de la camisa y botones
  shape('#d9a9fb', () => {
    ctx.moveTo(-s * 0.16, s * 0.13);
    ctx.lineTo(0, s * 0.3);
    ctx.lineTo(-s * 0.04, s * 0.13);
    ctx.closePath();
  });
  shape('#d9a9fb', () => {
    ctx.moveTo(s * 0.17, s * 0.13);
    ctx.lineTo(s * 0.01, s * 0.3);
    ctx.lineTo(s * 0.05, s * 0.13);
    ctx.closePath();
  });
  ctx.fillStyle = '#9b5fc9';
  for (const y of [0.4, 0.52]) {
    ctx.beginPath();
    ctx.arc(0, s * y, s * 0.018, 0, Math.PI * 2);
    ctx.fill();
  }
  // cabeza redonda
  shape('#c49a6c', () => ctx.ellipse(0, -s * 0.1, s * 0.36, s * 0.3, 0, 0, Math.PI * 2));
  // orejitas
  for (const k of [-1, 1]) shape('#b5875a', () => ctx.ellipse(k * s * 0.27, -s * 0.33, s * 0.06, s * 0.055, 0, 0, Math.PI * 2));
  // casco amarillo
  shape('#ffc93c', () => {
    ctx.moveTo(-s * 0.32, -s * 0.27);
    ctx.bezierCurveTo(-s * 0.3, -s * 0.58, s * 0.3, -s * 0.58, s * 0.32, -s * 0.27);
    ctx.closePath();
  });
  shape('#f5b21f', () => roundRect(ctx, -s * 0.38, -s * 0.3, s * 0.76, s * 0.07, s * 0.035));
  shape('#ffd966', () => roundRect(ctx, -s * 0.05, -s * 0.52, s * 0.1, s * 0.22, s * 0.04));
  // hocico
  shape('#9c6a45', () => roundRect(ctx, -s * 0.09, -s * 0.12, s * 0.18, s * 0.2, s * 0.07));
  ctx.fillStyle = ink;
  ctx.fillRect(-s * 0.005, -s * 0.08, s * 0.012, s * 0.1);
  ctx.beginPath();
  ctx.moveTo(-s * 0.04, s * 0.04);
  ctx.lineTo(0, s * 0.02);
  ctx.lineTo(s * 0.04, s * 0.04);
  ctx.lineWidth = lw * 0.8;
  ctx.stroke();
  // ojos tranquilos (rayitas) y cejas
  ctx.lineWidth = lw * 1.1;
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(k * s * 0.13, -s * 0.15);
    ctx.lineTo(k * s * 0.2, -s * 0.15);
    ctx.stroke();
  }
  // rubor
  ctx.fillStyle = 'rgba(240, 120, 120, 0.35)';
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(k * s * 0.22, -s * 0.05, s * 0.05, s * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // llave inglesa en la mano, junto a la cara
  ctx.save();
  ctx.translate(-s * 0.2, s * 0.08);
  ctx.rotate(-0.75);
  shape('#f2f2f2', () => {
    roundRect(ctx, -s * 0.035, -s * 0.02, s * 0.07, s * 0.34, s * 0.03);
  });
  shape('#f2f2f2', () => {
    ctx.arc(0, -s * 0.06, s * 0.085, Math.PI * 0.15, Math.PI * 1.85, false);
    ctx.lineTo(s * 0.02, -s * 0.06);
    ctx.closePath();
  });
  ctx.restore();
  // mano (pata) sosteniendo la llave
  shape('#b5875a', () => ctx.ellipse(-s * 0.12, s * 0.2, s * 0.08, s * 0.065, -0.4, 0, Math.PI * 2));
  // otra pata cruzada
  shape('#b5875a', () => ctx.ellipse(s * 0.14, s * 0.3, s * 0.08, s * 0.06, 0.4, 0, Math.PI * 2));
  ctx.restore();
}

export class StartScreen extends THREE.Group {
  constructor({ onTutorial, onPlay, onRelocate }) {
    super();
    this.w = 0.46;
    this.h = 0.3;
    // píldora de idioma (arriba, centrada)
    this.langBg = new CanvasPlane(0.2, 0.05, 2400);
    this.langBg.position.set(0, this.h / 2 + 0.04, 0);
    this.langBg.renderOrder = 10;
    this.langBg.draw((ctx, W, H) => {
      roundRect(ctx, H * 0.06, H * 0.06, W - H * 0.12, H * 0.88, H * 0.44);
      ctx.fillStyle = 'rgba(251, 246, 236, 0.96)';
      ctx.fill();
      ctx.lineWidth = H * 0.05;
      ctx.strokeStyle = PY.orange;
      ctx.stroke();
    });
    this.add(this.langBg);
    this.esBtn = new Button3D({ label: 'Español', w: 0.088, h: 0.036, onPress: () => setLang('es') });
    this.enBtn = new Button3D({ label: 'English', w: 0.088, h: 0.036, onPress: () => setLang('en') });
    this.esBtn.i18n = null; // los nombres de los idiomas no se traducen
    this.enBtn.i18n = null;
    this.esBtn.position.set(-0.047, this.langBg.position.y, 0.004);
    this.enBtn.position.set(0.047, this.langBg.position.y, 0.004);
    this.add(this.esBtn, this.enBtn);

    this.bg = new CanvasPlane(this.w, this.h, 2300);
    this.bg.renderOrder = 10;
    this.add(this.bg);
    const y = -this.h / 2 + 0.04;
    this.tutBtn = new Button3D({ label: 'Ver tutorial', w: 0.15, h: 0.048, variant: 'outline', onPress: () => onTutorial() });
    this.playBtn = new Button3D({ label: 'Jugar', w: 0.15, h: 0.048, onPress: () => onPlay() });
    this.relocBtn = new Button3D({ label: 'Recolocar', w: 0.1, h: 0.036, variant: 'outline', onPress: () => onRelocate() });
    this.tutBtn.position.set(-this.w / 2 + 0.035 + 0.075, y, 0.004);
    this.playBtn.position.set(this.w / 2 - 0.035 - 0.075, y, 0.004);
    this.relocBtn.position.set(0, -this.h / 2 - 0.03, 0.004);
    this.add(this.tutBtn, this.playBtn, this.relocBtn);
    // mismo orden que antes: [tutorial, jugar, recolocar] (hud usa buttons[2] solo en RA)
    this.buttons = [this.tutBtn, this.playBtn, this.relocBtn, this.esBtn, this.enBtn];
    this.appear = 1;
    this.visible = false;
    // ilustración del chigüiro (de frente, con casco y llave); mientras carga se usa el dibujo vectorial
    this.art = null;
    const img = new Image();
    img.onload = () => {
      this.art = img;
      this.redraw();
    };
    img.src = import.meta.env.BASE_URL + 'chiguiro_inicio.webp';
    this.redraw();
  }

  layout() {}

  redraw() {
    const es = getLang() === 'es';
    this.esBtn.variant = es ? 'primary' : 'outline';
    this.enBtn.variant = es ? 'outline' : 'primary';
    this.esBtn.redraw();
    this.enBtn.redraw();
    this.bg.draw((ctx, W, H) => {
      const pad = W * 0.015;
      drawCard(ctx, pad, pad, W - pad * 2, H - pad * 2, H * 0.08, { lw: H * 0.01 });
      // arte: fondo salvia con el chigüiro constructor
      const ax = W * 0.3;
      const aw = W * 0.4;
      const ay = H * 0.07;
      const ah = H * 0.6;
      roundRect(ctx, ax, ay, aw, ah, H * 0.05);
      const g = ctx.createLinearGradient(0, ay, 0, ay + ah);
      g.addColorStop(0, '#eef2e1');
      g.addColorStop(1, '#d6e4c4');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      roundRect(ctx, ax, ay, aw, ah, H * 0.05);
      ctx.clip();
      if (this.art) {
        // recorte tipo "cover" centrado en el chigüiro (algo a la derecha del centro de la imagen)
        const iw = this.art.width;
        const ih = this.art.height;
        const k = Math.max(aw / iw, ah / ih);
        const sw = aw / k;
        const sh = ah / k;
        const sx = Math.min(iw - sw, Math.max(0, iw * 0.53 - sw / 2));
        const sy = (ih - sh) / 2;
        ctx.drawImage(this.art, sx, sy, sw, sh, ax, ay, aw, ah);
      } else drawChiguiroWorker(ctx, W / 2, ay + ah * 0.52, ah * 0.78);
      ctx.restore();
      // borde fino sobre el arte
      roundRect(ctx, ax, ay, aw, ah, H * 0.05);
      ctx.lineWidth = H * 0.006;
      ctx.strokeStyle = 'rgba(31, 41, 32, 0.25)';
      ctx.stroke();
      // marca y título a los lados del arte
      drawPyBrand(ctx, W * 0.045, H * 0.1, H * 0.06);
      drawEyebrow(ctx, tr('Experiencia RA · Meta Quest'), W * 0.045, H * 0.24, H * 0.032, { maxW: ax - W * 0.07 });
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = PY.ink;
      const words = tr('Amazonas vs Leñadores').split(' vs ');
      ctx.font = `700 ${H * 0.085}px ${FONT}`;
      fitFont(ctx, words[0], ax - W * 0.07, H * 0.085, 700);
      ctx.fillText(words[0], W * 0.045, H * 0.4);
      ctx.fillStyle = PY.orange;
      ctx.font = `600 ${H * 0.06}px ${FONT}`;
      ctx.fillText('vs', W * 0.045, H * 0.48);
      ctx.fillStyle = PY.ink;
      fitFont(ctx, words[1] || '', ax - W * 0.07, H * 0.085, 700);
      ctx.fillText(words[1] || '', W * 0.045, H * 0.58);
      // lado derecho: frase corta
      ctx.fillStyle = PY.muted;
      ctx.font = `500 ${H * 0.045}px ${FONT}`;
      const lines = tr('Defiende la isla de DEFORESTA S.A.').split(' ');
      let line = '';
      let yy = H * 0.3;
      const maxW = W - (ax + aw) - W * 0.07;
      for (const w of lines) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) {
          ctx.fillText(line, ax + aw + W * 0.035, yy);
          yy += H * 0.065;
          line = w;
        } else line = test;
      }
      ctx.fillText(line, ax + aw + W * 0.035, yy);
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
