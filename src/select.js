// Pantalla de selección de equipo: todos los personajes en cartas, se eligen TEAM.size.
// Al acercar la mano (o pasar el mouse) sobre una carta, la carta grande muestra su habilidad.
import * as THREE from 'three';
import { PLANT_ORDER, TEAM } from './config.js';
import { CanvasPlane, Pressable, Button3D, PY, FONT, drawCard, drawEyebrow, drawPyBrand, roundRect, popIn, fitFont } from './ui3d.js';
import { drawSeedCard, AbilityCard } from './cards.js';
import { sfx } from './audio.js';
import { tr } from './i18n.js';


/** Carta pulsable de la selección (o ranura del equipo si `slot` es un número). */
class PickCard extends Pressable {
  constructor(type, w, h, slot = null) {
    super(w, h);
    this.slot = slot;
    this.face = new CanvasPlane(w, h, 3000);
    this.face.renderOrder = 12;
    this.add(this.face);
    this.picked = false;
    this.shakeT = 0;
    this.t = Math.random() * 5;
    this.baseX = 0;
    this._key = '';
    this.setType(type);
  }
  setType(type) {
    this.type = type;
    this.redraw(true);
  }
  setPicked(v) {
    if (v === this.picked) return;
    this.picked = v;
    this.redraw();
  }
  redraw(force = false) {
    const key = `${this.type}|${this.hover}|${this.picked}`;
    if (!force && key === this._key) return;
    this._key = key;
    this.face.draw((ctx, W, H) => drawSeedCard(ctx, W, H, this.type, { hover: this.hover && !!this.type, picked: this.picked, empty: !this.type, index: (this.slot ?? 0) + 1 }));
  }
  shake() {
    this.shakeT = 0.4;
  }
  update(dt) {
    super.update(dt);
    this.t += dt;
    const lift = this.hover && this.type ? 1 : 0;
    const s = this.scale.x + (1 + lift * 0.08 - this.scale.x) * Math.min(1, dt * 12);
    this.scale.setScalar(s);
    let off = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      off = Math.sin(this.t * 70) * 0.003 * (this.shakeT / 0.4);
    }
    this.position.x = this.baseX + off;
    this.position.z = 0.004 + lift * 0.008;
  }
}

export class TeamSelect extends THREE.Group {
  constructor({ onPlay, onRelocate }) {
    super();
    // Composición del wireframe: tablero grande con TODOS los personajes (4 columnas) y debajo
    // una franja delgada con los 5 elegidos; a la derecha la carta mínima del personaje y "¡A defender!".
    const W = 0.62;
    const H = 0.56;
    this.W = W;
    this.H = H;
    this.bg = new CanvasPlane(W, H, 2000);
    this.bg.renderOrder = 9;
    this.add(this.bg);
    this.team = [...TEAM.default];
    this.level = { number: 1, total: 5, name: '' };
    this.denyT = 0;

    const cw = 0.068;
    const ch = 0.095;
    const stepX = 0.078;
    const stepY = 0.104;
    const COLS = 4;
    // tablero de todos los personajes
    this.grid = { x: -W / 2 + 0.03, y: H / 2 - 0.085, w: 0.33, h: 0.012 * 2 + stepY * 2 + ch };
    const gx0 = this.grid.x + 0.014 + cw / 2;
    const gy0 = this.grid.y - 0.012 - ch / 2;
    this.cards = PLANT_ORDER.map((type, i) => {
      const c = new PickCard(type, cw, ch);
      c.baseX = gx0 + (i % COLS) * stepX;
      c.position.set(c.baseX, gy0 - Math.floor(i / COLS) * stepY, 0.004);
      c.onPress = () => this.toggle(type, c);
      this.add(c);
      return c;
    });
    // franja delgada de los elegidos
    this.strip = { x: this.grid.x, y: this.grid.y - this.grid.h - 0.016, w: this.grid.w, h: 0.088 };
    const sx = this.strip.x + this.strip.w / 2;
    this.slots = Array.from({ length: TEAM.size }, (_, i) => {
      const s = new PickCard(null, 0.05, 0.07, i);
      s.baseX = sx + (i - (TEAM.size - 1) / 2) * 0.062;
      s.position.set(s.baseX, this.strip.y - this.strip.h / 2 - 0.003, 0.004);
      s.onPress = () => s.type && this.toggle(s.type, s);
      this.add(s);
      return s;
    });
    // carta mínima del personaje (a la derecha)
    const rx = (this.grid.x + this.grid.w + W / 2) / 2;
    this.ability = new AbilityCard(0.2, 0.29);
    this.ability.position.set(rx, this.grid.y - 0.145, 0.004);
    this.add(this.ability);

    this.playBtn = new Button3D({ label: '¡A defender!', w: 0.2, h: 0.05, onPress: () => this.team.length === TEAM.size && onPlay([...this.team]) });
    this.playBtn.position.set(rx, this.strip.y - 0.03, 0.004);
    this.add(this.playBtn);
    this.clearBtn = new Button3D({ label: 'Vaciar', w: 0.09, h: 0.038, variant: 'outline', onPress: () => this.clear() });
    this.clearBtn.position.set(rx - 0.055, this.strip.y - 0.078, 0.004);
    this.add(this.clearBtn);
    this.relocBtn = new Button3D({ label: 'Recolocar', w: 0.1, h: 0.038, variant: 'outline', onPress: () => onRelocate() });
    this.relocBtn.position.set(rx + 0.05, this.strip.y - 0.078, 0.004);
    this.add(this.relocBtn);
    this.buttons = [this.playBtn, this.clearBtn, this.relocBtn];

    this.appear = 1;
    this.visible = false;
    this.focus = null;
  }

  setXR(isXR) {
    this.relocBtn.visible = isXR;
    this.clearBtn.position.x = this.ability.position.x - (isXR ? 0.055 : 0);
  }

  open(level, team) {
    this.level = level;
    this.team = team.filter((t) => PLANT_ORDER.includes(t)).slice(0, TEAM.size);
    this.focus = this.team[0] || PLANT_ORDER[0];
    this.ability.show(this.focus);
    this.refresh();
    this.visible = true;
    this.appear = 0;
    this.scale.setScalar(0.01);
  }

  hide() {
    this.visible = false;
  }

  toggle(type, card) {
    this.focus = type;
    this.ability.show(type);
    const i = this.team.indexOf(type);
    if (i >= 0) {
      this.team.splice(i, 1);
      sfx.pick();
    } else if (this.team.length < TEAM.size) {
      this.team.push(type);
      sfx.plant();
    } else {
      card.shake();
      sfx.deny();
      this.denyT = 0.8;
    }
    this.refresh();
  }

  /** Vuelve a escribir las cartas en el idioma elegido. */
  relang() {
    for (const c of [...this.cards, ...this.slots]) c.redraw(true);
    const t = this.ability.type;
    this.ability.type = null;
    if (t) this.ability.show(t);
    if (this.visible) this.refresh();
  }

  clear() {
    this.team = [];
    this.refresh();
  }

  refresh() {
    for (const c of this.cards) c.setPicked(this.team.includes(c.type));
    this.slots.forEach((s, i) => {
      if (s.type !== (this.team[i] ?? null)) s.setType(this.team[i] ?? null);
    });
    const n = this.team.length;
    const full = n === TEAM.size;
    this.playBtn.setEnabled(full);
    this.playBtn.setLabel(full ? tr('¡A defender!') : tr('Elige {n} más', { n: TEAM.size - n }));
    this.drawBg();
  }

  drawBg() {
    const { W: wm, H: hm, grid, strip } = this;
    const n = this.team.length;
    const deny = this.denyT > 0;
    this.bg.draw((ctx, W, H) => {
      const toX = (x) => ((x + wm / 2) / wm) * W;
      const toY = (y) => ((hm / 2 - y) / hm) * H;
      const k = W / wm; // px por metro
      const pad = W * 0.01;
      drawCard(ctx, pad, pad, W - pad * 2, H - pad * 2, H * 0.05, { lw: H * 0.006 });
      const mx = toX(grid.x);
      drawEyebrow(ctx, tr(`Nivel ${this.level.number} de ${this.level.total} · ${this.level.name}`), mx, H * 0.05, H * 0.024, { maxW: W * 0.62 });
      ctx.fillStyle = PY.ink;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      fitFont(ctx, tr('Elige a tus {n} defensores', { n: TEAM.size }), W * 0.6, H * 0.05, 600);
      ctx.fillText(tr('Elige a tus {n} defensores', { n: TEAM.size }), mx, H * 0.12);
      drawPyBrand(ctx, W - W * 0.05 - H * 0.2, H * 0.06, H * 0.04);
      // tablero grande con todos los personajes
      roundRect(ctx, toX(grid.x), toY(grid.y), grid.w * k, grid.h * k, H * 0.03);
      ctx.fillStyle = 'rgba(238, 242, 225, 0.8)';
      ctx.fill();
      ctx.lineWidth = H * 0.004;
      ctx.strokeStyle = PY.teal;
      ctx.stroke();
      // franja delgada de los elegidos
      roundRect(ctx, toX(strip.x), toY(strip.y), strip.w * k, strip.h * k, H * 0.03);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = H * 0.005;
      ctx.strokeStyle = deny ? PY.danger : n === TEAM.size ? PY.green : PY.orange;
      ctx.stroke();
      // contador como "leyenda" sobre el borde de la franja
      ctx.font = `700 ${H * 0.024}px ${FONT}`;
      ctx.textBaseline = 'middle';
      const label = `${tr('Tu equipo')} · ${tr('{a} de {b}', { a: n, b: TEAM.size })}${deny ? ' · ' + tr('Equipo completo') : ''}`;
      const lw = ctx.measureText(label).width + H * 0.04;
      const lx = toX(strip.x) + H * 0.025;
      const ly = toY(strip.y);
      roundRect(ctx, lx, ly - H * 0.018, lw, H * 0.036, H * 0.018);
      ctx.fillStyle = deny ? PY.danger : n === TEAM.size ? PY.green : PY.orange;
      ctx.fill();
      ctx.fillStyle = n === TEAM.size || deny ? '#ffffff' : PY.ink;
      ctx.fillText(label, lx + H * 0.02, ly + H * 0.001);
    });
  }

  update(dt) {
    if (!this.visible) return;
    popIn(this, dt);
    for (const c of this.cards) c.update(dt);
    for (const s of this.slots) s.update(dt);
    for (const b of this.buttons) b.update(dt);
    this.ability.update(dt);
    const hov = this.cards.find((c) => c.hover) || this.slots.find((s) => s.hover && s.type);
    if (hov && hov.type !== this.ability.type) this.ability.show(hov.type);
    if (this.denyT > 0) {
      this.denyT -= dt;
      if (this.denyT <= 0) this.drawBg();
    }
  }
}
