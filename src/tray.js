// Bandeja de juego: contador de agua, las cartas del equipo elegido, la pala, pausa,
// indicador del manotazo y barra de avance del nivel. Estética de PyCon Colombia 2028.
import * as THREE from 'three';
import { PLANTS, LAYOUT, TRAY, ECONOMY, HAND, TEAM } from './config.js';
import { MATS } from './models.js';
import { CanvasPlane, Button3D, PY, FONT, roundRect, drawSun, drawCard, fitFont } from './ui3d.js';
import { drawSeedCard, cardModel, fitModel } from './cards.js';
import { tr } from './i18n.js';

const CARD_W = 0.07;
const CARD_H = 0.098;
const STEP = 0.078;

class SeedCard extends THREE.Group {
  constructor(type, tilt) {
    super();
    this.w = CARD_W;
    this.h = CARD_H;
    this.bg = new CanvasPlane(this.w, this.h, 3000);
    this.bg.renderOrder = 5;
    this.add(this.bg);
    this.maxH = this.h * 0.4;
    this.maxW = this.w * 0.62;
    const m = cardModel(type, this.maxH, this.maxW, tilt);
    m.pivot.position.set(0, -this.h * 0.075, 0.012);
    this.add(m.pivot);
    this.spin = m.spin;
    this.model = m.mesh;

    const ov = new THREE.PlaneGeometry(this.w * 0.86, this.h * 0.9).translate(0, -this.h * 0.45, 0);
    this.cool = new THREE.Mesh(ov, new THREE.MeshBasicMaterial({ color: '#1B2A17', transparent: true, opacity: 0.5, depthWrite: false }));
    this.cool.position.set(0, this.h * 0.45, 0.0015);
    this.cool.renderOrder = 6;
    this.cool.visible = false;
    this.add(this.cool);

    this.hover = false;
    this.selected = false;
    this.shakeT = 0;
    this.t = Math.random() * 5;
    this.baseX = 0;
    this.setType(type);
  }

  setType(type) {
    this.type = type;
    this.def = type === 'shovel' ? { cost: 0, cooldown: 1 } : PLANTS[type];
    fitModel(this.model, type, this.maxH, this.maxW);
    this.spin.rotation.y = type === 'shovel' ? 0.6 : -0.55;
    this._key = '';
    this.redraw(true, false);
  }

  redraw(affordable, highlight) {
    const key = `${affordable}|${highlight}`;
    if (key === this._key) return;
    this._key = key;
    this.bg.draw((ctx, W, H) => drawSeedCard(ctx, W, H, this.type, { affordable, hover: highlight }));
  }

  setState(coolFrac, affordable, active) {
    this.cool.visible = coolFrac > 0.001;
    this.cool.scale.y = Math.max(0.0001, coolFrac);
    const usable = !active || (coolFrac <= 0.001 && affordable);
    this.model.material = usable ? MATS.std : MATS.disabled;
    this.redraw(affordable || !active, this.hover || this.selected);
  }

  shake() {
    this.shakeT = 0.4;
  }

  update(dt) {
    this.t += dt;
    const lift = this.hover || this.selected ? 1 : 0;
    const s = this.scale.x + (1 + lift * 0.08 - this.scale.x) * Math.min(1, dt * 12);
    this.scale.setScalar(s);
    let off = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      off = Math.sin(this.t * 70) * 0.003 * (this.shakeT / 0.4);
    }
    this.position.x = this.baseX + off;
    this.position.z = 0.006 + lift * 0.008;
    if (lift) this.spin.rotation.y += dt * 2.2;
    else this.spin.rotation.y += ((this.type === 'shovel' ? 0.6 : -0.55) - this.spin.rotation.y) * Math.min(1, dt * 4);
  }
}

export class Tray extends THREE.Group {
  constructor() {
    super();
    // side: 'column' (una sola línea vertical de pie junto a la esquina izquierda, como en el wireframe)
    //       | 'left' (atril de dos columnas) | 'back' | 'front'
    const side = TRAY.side;
    const column = side === 'column';
    const left = side === 'left';
    this.left = left;
    const n = TEAM.size + 1; // equipo + pala
    const ROW = 0.108;
    const STEPV = 0.104;
    const rows = Math.ceil(n / 2);
    const W = column ? CARD_W + 0.036 : left ? 2 * STEP + 0.05 : 0.04 + 0.08 + 0.016 + n * STEP + 0.07;
    const H = column ? 0.06 + 0.12 + n * STEPV + 0.02 : left ? 0.13 + rows * ROW + 0.02 : 0.122;
    this.rotation.order = 'YXZ'; // primero se inclina, luego se gira hacia el usuario
    this.baseScale = column ? TRAY.scale ?? 1 : 1;
    if (column) {
      this.tilt = TRAY.tilt;
      const k = this.baseScale;
      this.position.set(LAYOUT.left - TRAY.gap - (W / 2) * k, (H / 2) * k * Math.cos(TRAY.tilt) + 0.004, LAYOUT.front - TRAY.fromFront);
      this.rotation.y = TRAY.yaw;
      this.scale.setScalar(k);
    } else if (left) {
      this.tilt = TRAY.tilt;
      this.position.set(LAYOUT.left - TRAY.gap - W / 2, TRAY.height, LAYOUT.front - TRAY.fromFront);
      this.rotation.y = TRAY.yaw;
    } else if (side === 'front') {
      this.tilt = -1.05;
      this.position.set(0, 0.06, LAYOUT.front + 0.06);
    } else {
      this.tilt = -0.5;
      this.position.set(0, 0.17, LAYOUT.back - 0.03);
    }
    this.rotation.x = this.tilt;
    this.W = W;
    this.H = H;
    const x0 = -W / 2;

    // fondo: tarjeta crema con borde naranja
    this.panel = new CanvasPlane(W, H, 1800);
    this.panel.position.z = -0.004;
    this.panel.renderOrder = 4;
    this.add(this.panel);
    this.panel.draw((ctx, cw, chh) => {
      const pad = chh * 0.03;
      drawCard(ctx, pad, pad, cw - pad * 2, chh - pad * 2, chh * 0.16, { lw: chh * 0.022, alpha: 0.93 });
      // hojas en las esquinas (eco de la ilustración de la página)
      ctx.fillStyle = 'rgba(77, 110, 60, 0.35)';
      for (const [fx, fy, a] of [
        [0.012, 0.15, -0.7],
        [0.03, 0.08, -0.2],
        [0.988, 0.15, 0.7],
        [0.97, 0.08, 0.2],
      ]) {
        ctx.save();
        ctx.translate(cw * fx, chh * fy);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, 0, chh * 0.05, chh * 0.13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    // contador de agua
    this.luzPanel = new CanvasPlane(0.08, 0.1, 3000);
    const yTop = H / 2 - 0.068; // fila superior del atril: agua · pausa/manotazo
    this.luzPanel.position.set(...(column ? [0, H / 2 - 0.06 - 0.062] : left ? [-STEP / 2, yTop] : [x0 + 0.04 + 0.04, 0]), 0.002);
    this.luzPanel.renderOrder = 5;
    this.add(this.luzPanel);
    this._luz = -1;
    this.luzPulse = 0;
    this.luzDeny = 0;

    // cartas del equipo + pala
    const cx0 = x0 + 0.04 + 0.08 + 0.016 + STEP / 2;
    // en el atril: dos columnas (la pala en la última casilla)
    const slot = (i) =>
      column ? [0, H / 2 - 0.06 - 0.12 - 0.008 - CARD_H / 2 - i * STEPV] : left ? [((i % 2) - 0.5) * STEP, yTop - 0.112 - Math.floor(i / 2) * ROW] : [cx0 + i * STEP, 0];
    this.cards = TEAM.default.map((type, i) => {
      const c = new SeedCard(type, this.tilt);
      const [x, y] = slot(i);
      c.baseX = x;
      c.position.set(x, y, 0.006);
      this.add(c);
      return c;
    });
    this.shovel = new SeedCard('shovel', this.tilt);
    const [sx, sy] = slot(TEAM.size);
    this.shovel.baseX = sx;
    this.shovel.position.set(sx, sy, 0.006);
    this.add(this.shovel);
    this.allCards = [...this.cards, this.shovel];

    // pausa y manotazo
    const rx = W / 2 - 0.04;
    this.menuBtn = new Button3D({ icon: 'pause', w: 0.05, h: 0.046, variant: 'primary' });
    const yBot = H / 2 - 0.036; // en la bandeja vertical: pausa y empujar arriba del todo
    this.menuBtn.position.set(...(column ? [-0.026, yBot] : left ? [STEP / 2, yTop + 0.026] : [rx, 0.026]), 0.006);
    this.add(this.menuBtn);
    this.pushPanel = new CanvasPlane(0.056, 0.05, 3000);
    this.pushPanel.position.set(...(column ? [0.026, yBot] : left ? [STEP / 2, yTop - 0.026] : [rx, -0.026]), 0.004);
    this.pushPanel.renderOrder = 5;
    this.add(this.pushPanel);
    this._push = -1;

    // barra de avance
    this.progress = new CanvasPlane(0.42, 0.036, 2600);
    this.progress.position.set(0, H / 2 + (column ? 0.014 : left ? 0.016 : 0.03), 0.0);
    if (left || column) this.progress.scale.setScalar(column ? 0.42 : 0.5);
    this.progress.renderOrder = 5;
    this.add(this.progress);
    this._prog = -1;
    this.levelLabel = 'Nivel 1';
    this.drawLuz(ECONOMY.startWater);
    this.drawProgress(0);
    this.drawPush(1);
  }

  /** Pone en la bandeja las cartas del equipo elegido. */
  setTeam(team, level = null) {
    this.cards.forEach((c, i) => {
      if (team[i] && c.type !== team[i]) c.setType(team[i]);
      c.visible = !!team[i];
    });
    if (level) this.level = level;
    this.levelLabel = !this.level ? tr('Nivel 1') : this.level.tutorial ? tr('Tutorial') : tr(`Nivel ${this.level.number} · ${this.level.name}`);
    this._prog = -1;
  }

  /** Vuelve a escribir los textos en el idioma elegido. */
  relang(game) {
    for (const c of this.allCards) c.setType(c.type);
    this.setTeam(game.team || this.cards.map((c) => c.type));
    this._luz = -1;
    this._push = -1;
  }

  drawLuz(v) {
    const pulse = this.luzPulse;
    const deny = this.luzDeny > 0;
    this.luzPanel.draw((ctx, W, H) => {
      const pad = W * 0.05;
      roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, W * 0.16);
      ctx.fillStyle = deny ? PY.danger : PY.green;
      ctx.fill();
      ctx.lineWidth = W * 0.04;
      ctx.strokeStyle = PY.orange;
      ctx.stroke();
      drawSun(ctx, W / 2, H * 0.33, W * (0.19 + pulse * 0.05));
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitFont(ctx, String(v), W * 0.8, H * 0.24, 700);
      ctx.fillText(String(v), W / 2, H * 0.71);
      ctx.font = `600 ${H * 0.085}px ${FONT}`;
      ctx.fillStyle = PY.blush;
      ctx.fillText(tr('AGUA'), W / 2, H * 0.88);
    });
  }

  drawPush(frac) {
    // frac: 1 = listo
    this.pushPanel.draw((ctx, W, H) => {
      const ready = frac >= 1;
      const r = H * 0.3;
      const cx = W / 2;
      const cy = H * 0.36;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = ready ? PY.orange : PY.aqua;
      ctx.fill();
      ctx.lineWidth = H * 0.06;
      ctx.strokeStyle = 'rgba(27,42,23,0.15)';
      ctx.stroke();
      if (!ready) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
        ctx.strokeStyle = PY.orange;
        ctx.stroke();
      }
      // mano abierta
      ctx.fillStyle = ready ? PY.ink : PY.muted;
      ctx.save();
      ctx.translate(cx, cy + r * 0.12);
      roundRect(ctx, -r * 0.38, -r * 0.2, r * 0.76, r * 0.62, r * 0.25);
      ctx.fill();
      for (let i = 0; i < 4; i++) roundRect(ctx, -r * 0.36 + i * r * 0.19, -r * 0.68, r * 0.14, r * 0.6, r * 0.07), ctx.fill();
      ctx.rotate(-0.7);
      roundRect(ctx, -r * 0.62, -r * 0.05, r * 0.14, r * 0.42, r * 0.07);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = PY.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${H * 0.17}px ${FONT}`;
      ctx.fillText(ready ? tr('Empujar') : `${Math.ceil((1 - frac) * HAND.push.cooldown)} s`, cx, H * 0.86);
    });
  }

  drawProgress(p, heart = 1) {
    const label = this.levelLabel;
    this.progress.draw((ctx, W, H) => {
      const pad = H * 0.06;
      roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, (H - pad * 2) / 2);
      ctx.fillStyle = 'rgba(251, 246, 236, 0.94)';
      ctx.fill();
      ctx.lineWidth = H * 0.05;
      ctx.strokeStyle = PY.orange;
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = PY.ink;
      const lx = H * 0.45;
      fitFont(ctx, label, W * 0.36, H * 0.34, 600);
      ctx.fillText(label, lx, H * 0.36);
      // vida del corazón de la isla
      ctx.font = `600 ${H * 0.22}px ${FONT}`;
      ctx.fillStyle = heart > 0.5 ? PY.greenDark : heart > 0.25 ? '#b7791f' : PY.danger;
      ctx.fillText(tr('Isla {n}%', { n: Math.ceil(heart * 100) }), lx, H * 0.7);
      const x0 = W * 0.42;
      const bw = W * 0.54;
      const bh = H * 0.3;
      const y0 = H / 2 - bh / 2;
      roundRect(ctx, x0, y0, bw, bh, bh / 2);
      ctx.fillStyle = PY.aqua;
      ctx.fill();
      ctx.lineWidth = H * 0.03;
      ctx.strokeStyle = 'rgba(77,110,60,0.5)';
      ctx.stroke();
      if (p > 0) {
        roundRect(ctx, x0, y0, Math.max(bh, bw * p), bh, bh / 2);
        const g = ctx.createLinearGradient(x0, 0, x0 + bw, 0);
        g.addColorStop(0, PY.orange);
        g.addColorStop(1, PY.danger);
        ctx.fillStyle = g;
        ctx.fill();
      }
      // banderín de la gran ola
      const fx = x0 + bw * 0.92;
      ctx.fillStyle = PY.ink;
      ctx.fillRect(fx, y0 - bh * 0.55, H * 0.035, bh * 1.7);
      ctx.fillStyle = PY.danger;
      ctx.beginPath();
      ctx.moveTo(fx + H * 0.035, y0 - bh * 0.55);
      ctx.lineTo(fx + H * 0.3, y0 - bh * 0.25);
      ctx.lineTo(fx + H * 0.035, y0 + bh * 0.05);
      ctx.fill();
    });
  }

  luzWorld(out) {
    return this.luzPanel.getWorldPosition(out);
  }
  pulseLuz() {
    this.luzPulse = 1;
  }
  denyLuz() {
    this.luzDeny = 0.6;
    this._luz = -1;
  }
  denyWater() {
    this.denyLuz();
  }

  update(dt, game) {
    const active = game.state === 'playing';
    for (const c of this.cards) {
      if (!c.visible) continue;
      const def = PLANTS[c.type];
      c.setState(game.cool[c.type] / def.cooldown, game.luz >= def.cost, active);
      c.update(dt);
    }
    this.shovel.setState(0, true, active);
    this.shovel.update(dt);
    this.menuBtn.update(dt);
    if (this.luzPulse > 0) {
      this.luzPulse = Math.max(0, this.luzPulse - dt * 3);
      this._luz = -1;
    }
    if (this.luzDeny > 0) {
      this.luzDeny -= dt;
      if (this.luzDeny <= 0) this._luz = -1;
    }
    if (game.luz !== this._luz) {
      this._luz = game.luz;
      this.drawLuz(game.luz);
    }
    const p = Math.round(game.progress * 100) / 100;
    const hf = Math.ceil((game.heartFrac ?? 1) * 100) / 100;
    if (p !== this._prog || hf !== this._heart) {
      this._prog = p;
      this._heart = hf;
      this.drawProgress(p, hf);
    }
    const pf = Math.round((1 - game.pushCool / HAND.push.cooldown) * 20) / 20;
    if (pf !== this._push) {
      this._push = pf;
      this.drawPush(pf);
    }
  }
}
