// Paneles 3D: inicio, selección de equipo, tarjeta PyCon entre niveles, derrota, pausa,
// búsqueda de mesa y anuncios. Todo con la estética de PyCon Colombia 2028.
import * as THREE from 'three';
import { Panel3D, Banner, PY } from './ui3d.js';
import { FACTS, LAYOUT } from './config.js';
import { TeamSelect } from './select.js';
import { PyconCard } from './pycon.js';

const _f = new THREE.Vector3();
const _t = new THREE.Vector3();

export class Hud {
  constructor(board, scene, actions) {
    this.start = new Panel3D({
      w: 0.48,
      h: 0.29,
      buttons: [
        { label: 'Empezar tutorial', w: 0.16, onPress: () => actions.tutorial() },
        { label: 'Ir al nivel 1', w: 0.13, variant: 'outline', onPress: () => actions.choose() },
        { label: 'Recolocar', w: 0.11, variant: 'outline', onPress: () => actions.relocate() },
      ],
    });
    this.start.setText(
      'Amazonas vs Leñadores',
      'Los leñadores y las máquinas de DEFORESTA S.A. cruzan el río para talar el Mangle madre. Toca las gotas de agua que trae la corriente y planta defensores en la tierra verde de la isla.\n¿Primera vez? Empieza por el tutorial.',
      { eyebrow: 'Experiencia RA · Meta Quest' }
    );

    this.lose = new Panel3D({
      w: 0.48,
      h: 0.27,
      buttons: [
        { label: 'Reintentar', w: 0.14, onPress: () => actions.retry() },
        { label: 'Cambiar equipo', w: 0.15, variant: 'outline', onPress: () => actions.choose() },
        { label: 'Recolocar', w: 0.11, variant: 'outline', onPress: () => actions.relocate() },
      ],
    });

    this.menu = new Panel3D({
      w: 0.52,
      h: 0.22,
      buttons: [
        { label: 'Continuar', w: 0.11, onPress: () => actions.resume() },
        { label: 'Reiniciar', w: 0.11, variant: 'outline', onPress: () => actions.retry() },
        { label: 'Recolocar', w: 0.11, variant: 'outline', onPress: () => actions.relocate() },
        { label: 'Salir de RA', w: 0.11, variant: 'danger', onPress: () => actions.exitAR() },
      ],
    });

    this.select = new TeamSelect({ onPlay: (team) => actions.play(team), onRelocate: () => actions.relocate() });
    this.pycon = new PyconCard({ onNext: () => actions.next(), onReplay: () => actions.replay(), onRelocate: () => actions.relocate() });

    // el borde inferior queda a ~12 cm de la mesa para que la ceiba y los animales plantados no lo atraviesen
    const panelH = new Map([[this.start, 0.29], [this.lose, 0.27], [this.menu, 0.22], [this.pycon, 0.33]]);
    for (const [p, h] of panelH) {
      p.position.set(0, 0.125 + h / 2, 0.13); // delante del Mangle madre
      p.rotation.x = -0.25;
      p.visible = false;
      board.root.add(p);
    }
    this.select.position.set(0, 0.3, 0.12);
    this.select.rotation.x = -0.25;
    board.root.add(this.select);

    // el anuncio flota por encima de la bandeja para no tapar las cartas
    this.banner = new Banner();
    this.banner.position.set(0, 0.36, LAYOUT.back - 0.06);
    this.banner.rotation.x = -0.25;
    board.root.add(this.banner);

    this.scan = new Panel3D({
      w: 0.4,
      h: 0.22,
      buttons: [
        { label: 'Colocar frente a mí', w: 0.17, onPress: () => actions.placeHere() },
        { label: 'Configurar espacio', w: 0.16, variant: 'outline', onPress: () => actions.roomSetup() },
      ],
    });
    this.scan.visible = false;
    this.scan.snap = true;
    scene.add(this.scan);
    this._scan = '';

    this.xrOnly = [this.start.buttons[2], this.lose.buttons[2], this.menu.buttons[2], this.menu.buttons[3]];
    this.panels = [this.start, this.lose, this.menu, this.pycon, this.select];
  }

  setXR(isXR) {
    for (const b of this.xrOnly) b.visible = isXR;
    for (const p of [this.start, this.lose, this.menu, this.scan]) p.layout();
    this.select.setXR(isXR);
    this.pycon.setXR(isXR);
  }

  hideBoardPanels() {
    for (const p of this.panels) p.hide();
    this.banner.visible = false;
  }

  /** Panel que corresponde al estado del juego (al terminar de brotar el tablero o tras recolocar). */
  showFor(state, game) {
    this.hideBoardPanels();
    if (state === 'paused') this.menu.show();
    else if (this.lastScreen === 'select') this.showSelect(game);
    else if (this.lastScreen === 'pycon' && this.lastInfo) this.pycon.open(this.lastInfo);
    else if (this.lastScreen === 'lose' && this.lastInfo) this.showLose(this.lastInfo);
    else if (state !== 'playing') this.start.show();
  }

  showStart() {
    this.hideBoardPanels();
    this.lastScreen = 'start';
    this.start.show();
  }

  showSelect(game) {
    this.hideBoardPanels();
    this.lastScreen = 'select';
    this.select.open(game.info(), game.team);
  }

  showWin(info) {
    this.hideBoardPanels();
    this.lastScreen = 'pycon';
    this.lastInfo = info;
    this.pycon.open(info);
  }

  showLose(info) {
    this.hideBoardPanels();
    this.lastScreen = 'lose';
    this.lastInfo = info;
    const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
    this.lose.setText('Talaron el Mangle madre…', `DEFORESTA S.A. cruzó el río y llegó al centro de la isla. Prueba otro equipo o vuelve a intentarlo.\n¿Sabías que…? ${fact}`, {
      eyebrow: info.tutorial ? 'Tutorial' : `Nivel ${info.level} · ${info.name}`,
      accent: PY.danger,
    });
    this.lose.show();
  }

  playing() {
    this.hideBoardPanels();
    this.lastScreen = 'game';
  }

  setScan(title, body) {
    const key = title + body;
    if (key === this._scan) return;
    this._scan = key;
    this.scan.setText(title, body, { eyebrow: 'Realidad aumentada' });
  }

  showScan() {
    this.scan.show();
    this.scan.snap = true;
  }

  update(dt, head, headQ) {
    for (const p of this.panels) if (p.visible) p.update(dt);
    this.banner.update(dt);
    if (this.scan.visible) {
      this.scan.update(dt);
      _f.set(0, 0, -1).applyQuaternion(headQ);
      _f.y = 0;
      if (_f.lengthSq() < 1e-4) _f.set(0, 0, -1);
      _f.normalize();
      _t.copy(head).addScaledVector(_f, 0.48);
      _t.y -= 0.12;
      if (this.scan.snap) {
        this.scan.position.copy(_t);
        this.scan.snap = false;
      } else if (this.scan.position.distanceTo(_t) > 0.15) {
        this.scan.position.lerp(_t, Math.min(1, dt * 2.5));
      }
      this.scan.lookAt(head);
    }
  }
}
