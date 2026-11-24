// Amazonas vs Leñadores — prototipo WebXR (realidad aumentada) para Meta Quest.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Board } from './board.js';
import { Game } from './game.js';
import { Tray } from './tray.js';
import { Particles } from './particles.js';
import { InputManager } from './input.js';
import { Interaction } from './interaction.js';
import { PlaneTracker } from './planes.js';
import { Hud } from './hud.js';
import { sfx } from './audio.js';
import { LEVELS } from './levels.js';
import { TEAM } from './config.js';
import { preloadPycon } from './pycon.js';
import { loadAssets } from './assets.js';
import { tr, onLang, getLang, setLang } from './i18n.js';

// Modo de prueba en PC (solo con `npm run dev`): emula unas Meta Quest 3 con el runtime oficial de Meta (IWER).
//   ?emular       → gafas + manos emuladas (sin mesas)
//   ?emular=sala  → además carga una sala sintética con escritorio (detección de planos)
const EMULATE = new URLSearchParams(location.search).get('emular');
if (import.meta.env.DEV && EMULATE !== null) {
  try {
    const { XRDevice, metaQuest3 } = await import('iwer');
    const device = new XRDevice(metaQuest3);
    device.installRuntime({ forceInstall: true });
    device.primaryInputMode = 'hand';
    if (EMULATE === 'sala') {
      const { SyntheticEnvironmentModule } = await import('@iwer/sem');
      device.installSEM(SyntheticEnvironmentModule);
      await device.sem.loadDefaultEnvironment('home_office');
    }
    window.__xrDevice = device;
  } catch (e) {
    console.warn('No se pudo iniciar el emulador IWER', e);
  }
}

// Espera la tipografía de la página (Poppins) para que los textos 3D se dibujen bien
await Promise.race([
  Promise.all(['500', '600', '700', '800'].map((w) => document.fonts.load(`${w} 40px Poppins`))),
  new Promise((r) => setTimeout(r, 2500)),
]).catch(() => {});
preloadPycon();
await loadAssets(); // modelos de Blender (animales) y vegetación de la landing

// ?nivel=N empieza en el nivel N (para probar; 0 = tutorial)
const START_LEVEL = Math.max(0, Math.min(LEVELS.length - 1, parseInt(new URLSearchParams(location.search).get('nivel') ?? '1', 10) || 0));

const TABLE_Y = 0.75;
const app = { mode: 'desktop', placement: 'placed', autoPlace: true, scanT: 0, stableT: 0, endPending: 0, endWon: false, endInfo: null, trayAppear: 1 };
const head = new THREE.Vector3(0, 1.4, 0.8);
const headQ = new THREE.Quaternion();

// ───────────────────────── render ─────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.localClippingEnabled = true;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 50);
camera.position.set(-0.3, 1.47, 1.12); // a la izquierda para ver también la bandeja vertical
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-0.17, 0.87, -0.03);
controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 0.35;
controls.maxDistance = 2.4;
controls.maxPolarAngle = 1.45;
controls.update();

scene.add(new THREE.HemisphereLight('#ffffff', '#6b5a3a', 1.6));
const sun = new THREE.DirectionalLight('#fff1d6', 2.0);
sun.position.set(0.6, 2.2, 1.4);
scene.add(sun);

// ───────────────────────── entorno de escritorio (simulador) ─────────────────────────
const desk = new THREE.Group();
{
  // el mismo atardecer de la página de PyCon (fondo del recorrido 3D)
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#7CA6D8');
  g.addColorStop(0.32, '#E4CFCB');
  g.addColorStop(0.48, '#FFDAAA');
  g.addColorStop(0.58, '#A3A672');
  g.addColorStop(0.74, '#4D6A3B');
  g.addColorStop(1, '#1E3822');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  var bgTex = new THREE.CanvasTexture(c);
  bgTex.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(5, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#7f8f5e' }));
  desk.add(floor);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.3, 40).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#F6E5D3' }));
  rug.position.y = 0.002;
  desk.add(rug);
  const wood = new THREE.MeshLambertMaterial({ color: '#a77b52' });
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.9), wood);
  top.position.y = TABLE_Y - 0.02;
  desk.add(top);
  for (const [x, z] of [
    [0.68, 0.38],
    [-0.68, 0.38],
    [0.68, -0.38],
    [-0.68, -0.38],
  ]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, TABLE_Y - 0.04, 0.05), new THREE.MeshLambertMaterial({ color: '#8a6440' }));
    leg.position.set(x, (TABLE_Y - 0.04) / 2, z);
    desk.add(leg);
  }
}
scene.add(desk);
const fog = new THREE.Fog('#E9D9C2', 3.5, 9);
scene.background = bgTex;
scene.fog = fog;

// ───────────────────────── juego ─────────────────────────
const fx = new Particles();
const board = new Board(fx);
scene.add(board.root);
const game = new Game(board, fx);
game.setLevel(START_LEVEL);
const tray = new Tray();
tray.visible = false;
board.root.add(tray);
const planes = new PlaneTracker(scene);
planes.setVisible(false);

function showTray(v) {
  if (v && !tray.visible) app.trayAppear = 0;
  tray.visible = v;
}

const actions = {
  /** Pantalla de selección del equipo para el nivel actual. */
  choose() {
    interaction.cancelAll();
    if (game.levelIdx === 0) game.setLevel(1); // el tutorial no tiene selección
    if (game.state !== 'idle') game.reset();
    app.endPending = 0;
    showTray(false);
    hud.showSelect(game);
  },
  /** Tutorial: equipo fijo, sin pantalla de selección. */
  tutorial() {
    game.setLevel(0);
    actions.play([...TEAM.tutorial]);
  },
  /** Empieza el nivel actual con el equipo elegido. */
  play(team) {
    interaction.cancelAll();
    game.team = team;
    tray.setTeam(team, game.level);
    game.start(game.levelIdx);
    hud.playing();
    showTray(true);
    app.endPending = 0;
  },
  retry() {
    if (game.isTutorial) return actions.tutorial();
    actions.play(game.team);
  },
  next() {
    game.setLevel(game.levelIdx + 1);
    actions.choose();
  },
  replay() {
    game.setLevel(1);
    actions.choose();
  },
  /** "Salir" en la tarjeta entre niveles: vuelve a la pantalla de inicio. */
  home() {
    interaction.cancelAll();
    if (game.state !== 'idle') game.reset();
    game.setLevel(Math.max(1, game.levelIdx));
    app.endPending = 0;
    showTray(false);
    hud.showStart();
  },
  resume() {
    game.resume();
    hud.playing();
  },
  relocate() {
    if (app.mode !== 'ar') return;
    interaction.cancelAll();
    game.pause();
    beginScanning(false);
  },
  exitAR() {
    renderer.xr.getSession()?.end();
  },
  placeHere() {
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(headQ).setY(0);
    if (f.lengthSq() < 1e-4) f.set(0, 0, -1);
    f.normalize();
    const pos = head.clone().addScaledVector(f, 0.6);
    pos.y = Math.max(0.55, head.y - 0.55);
    finishPlacement({ position: pos, yaw: Math.atan2(-f.x, -f.z), scale: 0.8 });
  },
  roomSetup() {
    const s = renderer.xr.getSession();
    if (s && typeof s.initiateRoomCapture === 'function') {
      s.initiateRoomCapture().catch(() => hud.setScan('No disponible', 'Sal de la experiencia y haz la configuración del espacio desde los ajustes de tu Quest.'));
    } else {
      hud.setScan('No disponible', 'Sal de la experiencia y haz la configuración del espacio desde los ajustes de tu Quest (marca tu mesa).');
    }
  },
};

const hud = new Hud(board, scene, actions);
document.documentElement.lang = getLang();
onLang(() => tray.relang(game));
// portada HTML: los elementos con data-en cambian de idioma; los botones de la píldora eligen el idioma
const htmlEs = new Map();
function applyHtmlLang() {
  for (const el of document.querySelectorAll('[data-en]')) {
    if (!htmlEs.has(el)) htmlEs.set(el, el.innerHTML);
    el.innerHTML = getLang() === 'en' ? el.dataset.en : htmlEs.get(el);
  }
  for (const b of document.querySelectorAll('[data-lang]')) b.classList.toggle('on', b.dataset.lang === getLang());
}
for (const b of document.querySelectorAll('[data-lang]')) b.addEventListener('click', () => setLang(b.dataset.lang));
onLang(applyHtmlLang);
applyHtmlLang();
hud.setXR(false);
const input = new InputManager(renderer, scene, camera, renderer.domElement);
const interaction = new Interaction({ scene, game, board, tray });

game.on.collectTarget = (out) => board.content.worldToLocal(tray.luzWorld(out));
game.on.waterGained = () => tray.pulseLuz();
game.on.banner = (b) => {
  // los pasos del tutorial se quedan hasta que se cumplen
  const dur = b.hold ? 9999 : b.ok ? 1.3 : b.big ? 3.6 : 2.8;
  hud.banner.show(tr(b.text), tr(b.sub || ''), b.big, dur, b.ok);
  if (b.ok) sfx.collect();
  else sfx.banner(b.big);
};
game.on.end = (won, info) => {
  app.endPending = won ? 1.8 : 1.4;
  app.endWon = won;
  app.endInfo = info;
};
tray.menuBtn.onPress = () => {
  if (game.state === 'playing') {
    interaction.cancelAll();
    game.pause();
    hud.showFor('paused', game);
  } else if (game.state === 'paused') actions.resume();
};
board.onRisen = () => {
  const inGame = game.state === 'playing' || game.state === 'paused';
  showTray(inGame);
  hud.showFor(game.state, game);
};

// ───────────────────────── colocación del tablero ─────────────────────────
function placeDesktop() {
  tray.visible = false;
  hud.hideBoardPanels();
  board.place({ position: new THREE.Vector3(0, TABLE_Y, -0.05), yaw: 0, scale: 1 });
}

function beginScanning(auto) {
  app.placement = 'scanning';
  app.autoPlace = auto;
  app.scanT = 0;
  app.stableT = 0;
  board.root.visible = false;
  tray.visible = false;
  hud.hideBoardPanels();
  hud.banner.visible = false;
  planes.setVisible(true);
  hud.setScan('Buscando una mesa…', 'Mira hacia una superficie elevada, como una mesa o un escritorio.');
  hud.showScan();
}

function finishPlacement(p) {
  app.placement = 'placed';
  planes.setVisible(false);
  hud.scan.hide();
  interaction.cancelAll();
  board.place(p);
}

interaction.onEmptyPress = (src) => {
  if (app.mode !== 'ar' || app.placement !== 'scanning') return;
  const d = planes.planeAt(src.point);
  if (d) return finishPlacement(planes.placement(d, head, src.point));
  if (planes.hit) {
    const pos = planes.hit.position.clone();
    const to = new THREE.Vector3(head.x - pos.x, 0, head.z - pos.z);
    finishPlacement({ position: pos, yaw: Math.atan2(to.x, to.z), scale: 0.85 });
  }
};

function xrFrame(frame, dt) {
  const ref = renderer.xr.getReferenceSpace();
  const pose = frame.getViewerPose(ref);
  if (pose) {
    const p = pose.transform.position;
    const o = pose.transform.orientation;
    head.set(p.x, p.y, p.z);
    headQ.set(o.x, o.y, o.z, o.w);
  }
  if (app.placement !== 'scanning') return;
  planes.update(frame, ref, dt);
  app.scanT += dt;
  const best = planes.best(head);
  if (best && app.autoPlace) {
    // espera ~1 s con la mesa detectada (tiempo real) para que el usuario la vea resaltada
    if (!app.stableT) app.stableT = performance.now();
    if (performance.now() - app.stableT > 1000) {
      finishPlacement(planes.placement(best, head));
      return;
    }
  } else app.stableT = 0;

  if (best) hud.setScan('¡Mesa detectada!', app.autoPlace ? 'Preparando el tablero sobre la mesa…' : 'Pellizca sobre la mesa resaltada para colocar el tablero allí.');
  else if (planes.hit) hud.setScan('Superficie encontrada', 'Pellizca para colocar el tablero sobre el anillo amarillo.');
  else if (app.scanT > 4)
    hud.setScan(
      'No encuentro mesas',
      planes.supported
        ? 'Haz la configuración del espacio de tu Quest y marca tu mesa, o coloca el tablero frente a ti.'
        : 'Este navegador no comparte las superficies. Coloca el tablero frente a ti.'
    );
}

// ───────────────────────── sesión de RA ─────────────────────────
renderer.xr.addEventListener('sessionstart', () => {
  app.mode = 'ar';
  desk.visible = false;
  scene.background = null;
  scene.fog = null;
  hud.setXR(true);
  interaction.cancelAll();
  game.pause();
  planes.reset();
  planes.initHitTest(renderer.xr.getSession());
  beginScanning(true);
  document.body.classList.add('in-xr');
});

renderer.xr.addEventListener('sessionend', () => {
  app.mode = 'desktop';
  app.placement = 'placed';
  desk.visible = true;
  scene.background = bgTex;
  scene.fog = fog;
  hud.setXR(false);
  hud.scan.hide();
  planes.reset();
  planes.setVisible(false);
  input.releaseAll();
  interaction.cancelAll();
  placeDesktop();
  document.body.classList.remove('in-xr');
});

async function enterAR() {
  sfx.unlock();
  const status = document.getElementById('xr-status');
  try {
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['local-floor'],
      optionalFeatures: ['hand-tracking', 'plane-detection', 'hit-test', 'anchors'],
    });
    await renderer.xr.setSession(session);
    document.body.classList.add('playing');
  } catch (e) {
    status.textContent = 'No se pudo iniciar la realidad aumentada: ' + (e?.message || e);
    status.className = 'status warn';
  }
}

// ───────────────────────── interfaz HTML ─────────────────────────
const btnAR = document.getElementById('btn-ar');
const btnARMini = document.getElementById('btn-ar-mini');
const status = document.getElementById('xr-status');
btnAR.addEventListener('click', enterAR);
btnARMini.addEventListener('click', enterAR);
document.getElementById('btn-desktop').addEventListener('click', () => {
  sfx.unlock();
  document.body.classList.add('playing');
});
document.getElementById('btn-help').addEventListener('click', () => document.body.classList.remove('playing'));
renderer.domElement.addEventListener('pointerdown', () => sfx.unlock());

let statusKey = '';
(async () => {
  let ok = false;
  if (!window.isSecureContext) {
    status.textContent = tr((statusKey = 'Para entrar en RA abre esta página con HTTPS (o desde localhost).'));
  } else if (!navigator.xr) {
    status.textContent = tr((statusKey = 'Este navegador no tiene WebXR. Ábrelo en el navegador de Meta Quest. Mientras tanto, prueba el modo navegador.'));
  } else {
    try {
      ok = await navigator.xr.isSessionSupported('immersive-ar');
    } catch (e) {
      ok = false;
    }
    status.textContent = ok ? tr((statusKey = 'Listo: tu dispositivo soporta realidad aumentada.')) : tr((statusKey = 'Este dispositivo no soporta RA inmersiva. Usa unas Meta Quest o prueba el modo navegador.'));
  }
  status.className = ok ? 'status ok' : 'status warn';
  onLang(() => statusKey && (status.textContent = tr(statusKey)));
  btnAR.disabled = !ok;
  btnARMini.hidden = !ok;
})();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ───────────────────────── bucle principal ─────────────────────────
placeDesktop();
const clock = new THREE.Clock();
let birdT = 4;

renderer.setAnimationLoop((time, frame) => tick(Math.min(clock.getDelta(), 0.05), frame));

function tick(dt, frame = null) {
  const inXR = renderer.xr.isPresenting;
  if (inXR && frame) xrFrame(frame, dt);
  else {
    controls.update();
    head.copy(camera.position);
    headQ.copy(camera.quaternion);
  }

  const sources = input.update(inXR);
  interaction.update(sources);
  game.update(dt);
  board.update(dt);
  tray.update(dt, game);
  hud.update(dt, head, headQ);
  fx.update(dt);

  if (app.trayAppear < 1) {
    app.trayAppear = Math.min(1, app.trayAppear + dt * 3);
    const t = app.trayAppear;
    tray.scale.setScalar(Math.max(0.01, 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2)) * (tray.baseScale ?? 1));
  }
  if (app.endPending > 0) {
    app.endPending -= dt;
    if (app.endPending <= 0) {
      interaction.cancelAll();
      showTray(false);
      if (app.endWon && app.endInfo.tutorial) {
        // tutorial superado: directo a elegir el equipo del nivel 1
        game.setLevel(1);
        actions.choose();
        hud.banner.show(tr('¡Tutorial completado!'), tr('Elige 5 defensores para el nivel 1'), true, 3.5);
      } else if (app.endWon) hud.showWin(app.endInfo);
      else hud.showLose(app.endInfo);
    }
  }
  birdT -= dt;
  if (birdT <= 0) {
    birdT = 3 + Math.random() * 6;
    if (board.root.visible) sfx.bird();
  }

  renderer.render(scene, camera);
}

// Acceso para depurar desde la consola. __amz.tick(n) avanza n cuadros de 1/60 s (útil si la pestaña está en segundo plano).
window.__amz = {
  game,
  board,
  tray,
  hud,
  planes,
  app,
  actions,
  camera,
  renderer,
  interaction,
  input,
  fx,
  tick: (n = 1, dt = 1 / 60) => {
    for (let i = 0; i < n; i++) tick(dt);
  },
};
