// Pantalla de inicio (según el wireframe): selector de idioma arriba, tarjeta con el chigüiro
// constructor (casco y llave) y dos botones: "Ver tutorial" y "Jugar".
import * as THREE from 'three';
import { CanvasPlane, Button3D, PY, FONT, drawCard, roundRect, popIn } from './ui3d.js';
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
      const cx = pad;
      const cy = pad;
      const cw = W - pad * 2;
      const ch = H - pad * 2;
      const r = H * 0.08;
      drawCard(ctx, cx, cy, cw, ch, r, { lw: H * 0.01 });
      // la ilustración ocupa toda la tarjeta (recorte tipo "cover")
      ctx.save();
      roundRect(ctx, cx, cy, cw, ch, r);
      ctx.clip();
      if (this.art) {
        const iw = this.art.width;
        const ih = this.art.height;
        const k = Math.max(cw / iw, ch / ih);
        const sw = cw / k;
        const sh = ch / k;
        const sx = Math.min(iw - sw, Math.max(0, iw * 0.53 - sw / 2));
        const sy = (ih - sh) / 2;
        ctx.drawImage(this.art, sx, sy, sw, sh, cx, cy, cw, ch);
        // velo oscuro arriba y a la izquierda para que el texto blanco se lea sobre el cielo
        const top = ctx.createLinearGradient(0, cy, 0, cy + ch * 0.5);
        top.addColorStop(0, 'rgba(12, 24, 14, 0.62)');
        top.addColorStop(1, 'rgba(12, 24, 14, 0)');
        ctx.fillStyle = top;
        ctx.fillRect(cx, cy, cw, ch * 0.5);
        const left = ctx.createLinearGradient(cx, 0, cx + cw * 0.4, 0);
        left.addColorStop(0, 'rgba(12, 24, 14, 0.4)');
        left.addColorStop(1, 'rgba(12, 24, 14, 0)');
        ctx.fillStyle = left;
        ctx.fillRect(cx, cy + ch * 0.25, cw * 0.4, ch * 0.3);
      } else drawChiguiroWorker(ctx, W / 2, H * 0.52, H * 0.6);
      ctx.restore();
      // borde naranja encima de la ilustración
      roundRect(ctx, cx, cy, cw, ch, r);
      ctx.lineWidth = H * 0.01;
      ctx.strokeStyle = PY.orange;
      ctx.stroke();

      const light = !!this.art; // con ilustración: letras claras con sombra
      const ink = light ? '#fffdf7' : PY.ink;
      ctx.save();
      if (light) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
        ctx.shadowBlur = H * 0.025;
        ctx.shadowOffsetY = H * 0.006;
      }
      // título desplegado en horizontal, a lo ancho de la parte de arriba
      const words = tr('Amazonas vs Leñadores').split(' vs ');
      const a = words[0];
      const b = words[1] || '';
      const tx = W * 0.06;
      const ty = H * 0.2;
      let size = H * 0.115;
      const maxT = W * 0.88;
      const measure = () => {
        ctx.font = `800 ${size}px ${FONT}`;
        const wa = ctx.measureText(a + ' ').width;
        const wb = ctx.measureText(' ' + b).width;
        ctx.font = `600 ${size * 0.7}px ${FONT}`;
        return wa + ctx.measureText('vs').width + wb;
      };
      while (measure() > maxT && size > 8) size *= 0.95;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      let x = tx;
      ctx.font = `800 ${size}px ${FONT}`;
      ctx.fillStyle = ink;
      ctx.fillText(a, x, ty);
      x += ctx.measureText(a + ' ').width;
      ctx.font = `600 ${size * 0.7}px ${FONT}`;
      ctx.fillStyle = light ? '#ffb347' : PY.orange;
      ctx.fillText('vs', x, ty);
      x += ctx.measureText('vs').width;
      ctx.font = `800 ${size}px ${FONT}`;
      ctx.fillStyle = ink;
      ctx.fillText(' ' + b, x, ty);
      // frase corta debajo, a la izquierda
      ctx.fillStyle = ink;
      ctx.font = `600 ${H * 0.05}px ${FONT}`;
      const lines = tr('Defiende la isla de DEFORESTA S.A.').split(' ');
      const maxW = W * 0.3;
      let line = '';
      let yy = H * 0.32;
      for (const w of lines) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) {
          ctx.fillText(line, tx, yy);
          yy += H * 0.065;
          line = w;
        } else line = test;
      }
      ctx.fillText(line, tx, yy);
      ctx.restore();
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
