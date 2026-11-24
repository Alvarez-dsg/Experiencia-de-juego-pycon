// Paneles 3D: inicio, selección de equipo, tarjeta PyCon entre niveles, derrota, pausa,
// búsqueda de mesa y anuncios. Todo con la estética de PyCon Colombia 2028.
import * as THREE from 'three';
import { Panel3D, Banner, PY } from './ui3d.js';
import { FACTS, LAYOUT } from './config.js';
import { TeamSelect } from './select.js';
import { PyconCard } from './pycon.js';
import { StartScreen } from './screens.js';
import { tr, onLang } from './i18n.js';

const _f = new THREE.Vector3();
const _t = new THREE.Vector3();

export class Hud {
  constructor(board, scene, actions) {
    // inicio (wireframe): idioma arriba, chigüiro constructor, "Ver tutorial" y "Jugar"
    this.start = new StartScreen({ onTutorial: () => actions.tutorial(), onPlay: () => actions.choose(), onRelocate: () => actions.relocate() });

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

    this.menu.setText(tr('Pausa'), tr('El juego está en pausa.'), { eyebrow: 'Amazonas vs Leñadores' });
    this.select = new TeamSelect({ onPlay: (team) => actions.play(team), onRelocate: () => actions.relocate() });
    this.pycon = new PyconCard({ onNext: () => actions.next(), onReplay: () => actions.replay(), onRelocate: () => actions.relocate(), onExit: () => actions.home() });

    // el borde inferior queda a ~12 cm de la mesa para que la ceiba y los animales plantados no lo atraviesen
    const panelH = new Map([[this.start, 0.3], [this.lose, 0.27], [this.menu, 0.22], [this.pycon, 0.33]]);
    for (const [p, h] of panelH) {
      p.position.set(0, 0.125 + h / 2, 0.13); // delante del centro de la isla
      p.rotation.x = -0.25;
      p.visible = false;
      board.root.add(p);
    }
    this.select.position.set(0, 0.33, 0.12);
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
    this.game = null;
    // al cambiar de idioma se vuelve a dibujar lo que esté en pantalla
    onLang(() => {
      this.start.redraw();
      this.setScanText();
      this.menu.setText(tr('Pausa'), tr('El juego está en pausa.'), { eyebrow: 'Amazonas vs Leñadores' });
      this.select.relang();
      if (!this.game) return;
      if (this.pycon.visible && this.lastInfo) this.pycon.open(this.lastInfo);
      if (this.lose.visible && this.lastInfo) this.showLose(this.lastInfo);
    });
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
    this.game = game;
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
    this.lose.setText(tr('Arrasaron el corazón de la isla…'), `${tr('DEFORESTA S.A. cruzó el río y llegó al centro de la isla. Prueba otro equipo o vuelve a intentarlo.')}\n${tr('¿Sabías que…?')} ${tr(fact)}`, {
      eyebrow: info.tutorial ? tr('Tutorial') : tr(`Nivel ${info.level} · ${info.name}`),
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
    this._scanText = [title, body];
    this.setScanText();
  }
  setScanText() {
    if (!this._scanText) return;
    this.scan.setText(tr(this._scanText[0]), tr(this._scanText[1]), { eyebrow: tr('Realidad aumentada') });
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
