// Pantalla de selección de equipo: todos los personajes en cartas, se eligen TEAM.size.
// Al acercar la mano (o pasar el mouse) sobre una carta, la carta grande muestra su habilidad.
import * as THREE from 'three';
import { PLANT_ORDER, TEAM } from './config.js';
import { MATS } from './models.js';
import { CanvasPlane, Pressable, Button3D, PY, FONT, drawCard, drawEyebrow, drawPyBrand, roundRect, popIn } from './ui3d.js';
import { drawSeedCard, cardModel, fitModel, AbilityCard } from './cards.js';
import { sfx } from './audio.js';

const TILT = -0.25; // inclinación del panel (la misma que los demás paneles)

/** Carta pulsable de la selección (o ranura del equipo si `slot` es un número). */
class PickCard extends Pressable {
  constructor(type, w, h, slot = null) {
    super(w, h);
    this.slot = slot;
    this.face = new CanvasPlane(w, h, 3000);
    this.face.renderOrder = 12;
    this.add(this.face);
    this.maxH = h * 0.4;
    this.maxW = w * 0.62;
    this.m = cardModel(type || 'heliconia', this.maxH, this.maxW, TILT);
    this.m.pivot.position.set(0, -h * 0.075, 0.01);
    this.add(this.m.pivot);
    this.picked = false;
    this.shakeT = 0;
    this.t = Math.random() * 5;
    this.baseX = 0;
    this._key = '';
    this.setType(type);
  }
  setType(type) {
    this.type = type;
    this.m.pivot.visible = !!type;
    if (type) fitModel(this.m.mesh, type, this.maxH, this.maxW);
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
    this.m.mesh.material = this.picked ? MATS.disabled : MATS.std;
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
    const spin = this.m.spin;
    if (lift) spin.rotation.y += dt * 2.2;
    else spin.rotation.y += (-0.55 - spin.rotation.y) * Math.min(1, dt * 4);
  }
}

export class TeamSelect extends THREE.Group {
  constructor({ onPlay, onRelocate }) {
    super();
    const W = 0.84;
    const H = 0.5;
    this.W = W;
    this.H = H;
    this.bg = new CanvasPlane(W, H, 2000);
    this.bg.renderOrder = 9;
    this.add(this.bg);
    this.team = [...TEAM.default];
    this.level = { number: 1, total: 5, name: '' };
    this.denyT = 0;

    // todas las cartas: 2 filas de 6
    const cw = 0.068;
    const ch = 0.095;
    const step = 0.078;
    const x0 = -W / 2 + 0.045 + cw / 2;
    this.cards = PLANT_ORDER.map((type, i) => {
      const c = new PickCard(type, cw, ch);
      c.baseX = x0 + (i % 6) * step;
      c.position.set(c.baseX, i < 6 ? 0.098 : -0.008, 0.004);
      c.onPress = () => this.toggle(type, c);
      this.add(c);
      return c;
    });
    // ranuras del equipo
    this.slots = Array.from({ length: TEAM.size }, (_, i) => {
      const s = new PickCard(null, 0.05, 0.07, i);
      s.baseX = x0 - cw / 2 + 0.025 + i * 0.06;
      s.position.set(s.baseX, -0.128, 0.004);
      s.onPress = () => s.type && this.toggle(s.type, s);
      this.add(s);
      return s;
    });
    // carta grande de habilidad
    this.ability = new AbilityCard(0.2, 0.29, TILT);
    this.ability.position.set(W / 2 - 0.04 - 0.1, -0.012, 0.004);
    this.add(this.ability);

    this.playBtn = new Button3D({ label: '¡A defender!', w: 0.2, h: 0.046, onPress: () => this.team.length === TEAM.size && onPlay([...this.team]) });
    this.playBtn.position.set(this.ability.position.x, -this.H / 2 + 0.036, 0.004);
    this.add(this.playBtn);
    this.clearBtn = new Button3D({ label: 'Vaciar', w: 0.09, h: 0.04, variant: 'outline', onPress: () => this.clear() });
    this.clearBtn.position.set(x0 - cw / 2 + 0.045, -this.H / 2 + 0.036, 0.004);
    this.add(this.clearBtn);
    this.relocBtn = new Button3D({ label: 'Recolocar', w: 0.11, h: 0.04, variant: 'outline', onPress: () => onRelocate() });
    this.relocBtn.position.set(this.clearBtn.position.x + 0.11, -this.H / 2 + 0.036, 0.004);
    this.add(this.relocBtn);
    this.buttons = [this.playBtn, this.clearBtn, this.relocBtn];

    this.appear = 1;
    this.visible = false;
    this.focus = null;
  }

  setXR(isXR) {
    this.relocBtn.visible = isXR;
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
    this.playBtn.setLabel(full ? '¡A defender!' : `Elige ${TEAM.size - n} más`);
    this.drawBg();
  }

  drawBg() {
    const { W: wm, H: hm } = this;
    const n = this.team.length;
    const deny = this.denyT > 0;
    this.bg.draw((ctx, W, H) => {
      const toX = (x) => ((x + wm / 2) / wm) * W;
      const toY = (y) => ((hm / 2 - y) / hm) * H;
      const pad = W * 0.008;
      drawCard(ctx, pad, pad, W - pad * 2, H - pad * 2, H * 0.06, { lw: H * 0.006 });
      const mx = toX(-wm / 2 + 0.045);
      drawEyebrow(ctx, `Nivel ${this.level.number} de ${this.level.total} · ${this.level.name}`, mx, H * 0.06, H * 0.026);
      ctx.fillStyle = PY.ink;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = `600 ${H * 0.062}px ${FONT}`;
      ctx.fillText(`Elige a tus ${TEAM.size} defensores`, mx, H * 0.14);
      ctx.fillStyle = PY.muted;
      ctx.font = `500 ${H * 0.028}px ${FONT}`;
      ctx.fillText('Acerca la mano a una carta para ver su habilidad. Pellízcala o tócala para sumarla a tu equipo.', mx, H * 0.185);
      drawPyBrand(ctx, W - toX(-wm / 2 + 0.045) - H * 0.25, H * 0.07, H * 0.045);
      // equipo
      const ey = toY(-0.076);
      drawEyebrow(ctx, 'Tu equipo', mx, ey, H * 0.024);
      ctx.save();
      ctx.font = `700 ${H * 0.03}px ${FONT}`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      const label = `${n} de ${TEAM.size}`;
      const lx = mx + H * 0.27;
      const lw = ctx.measureText(label).width + H * 0.04;
      ctx.beginPath();
      roundRect(ctx, lx, ey - H * 0.022, lw, H * 0.044, H * 0.022);
      ctx.fillStyle = deny ? PY.danger : n === TEAM.size ? PY.green : PY.orange;
      ctx.fill();
      ctx.fillStyle = n === TEAM.size || deny ? '#ffffff' : PY.ink;
      ctx.fillText(label, lx + H * 0.02, ey + H * 0.002);
      if (deny) {
        ctx.fillStyle = PY.danger;
        ctx.font = `600 ${H * 0.026}px ${FONT}`;
        ctx.fillText('Equipo completo: quita uno para cambiarlo', lx + lw + H * 0.02, ey);
      } else {
        ctx.fillStyle = PY.muted;
        ctx.font = `500 ${H * 0.026}px ${FONT}`;
        ctx.fillText('La pala siempre va en la bandeja', lx + lw + H * 0.02, ey);
      }
      ctx.restore();
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
