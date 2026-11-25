// Entrada unificada: manos (pellizco), controles (gatillo) y mouse (modo escritorio).
// Cada fuente expone: point (punto de agarre, mundo), tip (punta del índice), pressed, justPressed, justReleased.
import * as THREE from 'three';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

const PINCH_ON = 0.022; // m entre pulgar e índice para empezar a pellizcar
const PINCH_OFF = 0.04; // m para soltar (histéresis)
// "Tirito": pellizcar índice y pulgar y soltar el índice de golpe, como quien lanza algo con el dedo
const FLICK_OPEN = 0.055; // m de apertura que cuenta como soltar el índice
const FLICK_HOLD = 0.15; // s mínimos de pellizco antes de soltar
const FLICK_FAST = 0.14; // s máximos entre dejar de pellizcar y abrir del todo
// Mano abierta (para el manotazo): las puntas de índice, medio y anular lejos de la muñeca.
// Al señalar una gota o al pellizcar, medio y anular están doblados y no cuenta.
const OPEN_TIP = 0.13; // m de la punta a la muñeca

export class InputManager {
  constructor(renderer, scene, camera, dom) {
    this.renderer = renderer;
    this.camera = camera;
    this.xr = [];
    const handFactory = new XRHandModelFactory();
    const ctrlFactory = new XRControllerModelFactory();
    const tipGeo = new THREE.SphereGeometry(0.0055, 12, 8);
    const ringGeo = new THREE.TorusGeometry(0.012, 0.0018, 6, 24);

    for (let i = 0; i < 2; i++) {
      const ctrl = renderer.xr.getController(i);
      const grip = renderer.xr.getControllerGrip(i);
      const hand = renderer.xr.getHand(i);
      scene.add(ctrl, grip, hand);
      grip.add(ctrlFactory.createControllerModel(grip));
      const handModel = handFactory.createHandModel(hand, 'mesh');
      hand.add(handModel);

      const mk = (color) => {
        const m = new THREE.Mesh(tipGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false }));
        m.renderOrder = 40;
        m.visible = false;
        scene.add(m);
        return m;
      };
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffd84d', depthTest: false, transparent: true }));
      ring.renderOrder = 41;
      ring.visible = false;
      scene.add(ring);

      const s = {
        id: 'xr' + i,
        kind: 'none',
        ctrl,
        hand,
        handModel,
        active: false,
        point: new THREE.Vector3(),
        tip: new THREE.Vector3(),
        pressed: false,
        justPressed: false,
        justReleased: false,
        trigger: false,
        styled: false,
        dotIndex: mk('#ffffff'),
        dotThumb: mk('#ffffff'),
        ring,
      };
      ctrl.addEventListener('connected', (e) => {
        s.kind = e.data.hand ? 'hand' : 'controller';
        s.handedness = e.data.handedness;
      });
      ctrl.addEventListener('disconnected', () => {
        s.kind = 'none';
        s.trigger = false;
      });
      ctrl.addEventListener('selectstart', () => {
        if (s.kind === 'controller') s.trigger = true;
      });
      ctrl.addEventListener('selectend', () => {
        s.trigger = false;
      });
      this.xr.push(s);
    }

    // mouse
    this.mouse = {
      id: 'mouse',
      kind: 'mouse',
      active: false,
      ndc: new THREE.Vector2(),
      ray: new THREE.Raycaster(),
      point: new THREE.Vector3(),
      tip: new THREE.Vector3(),
      pressed: false,
      justPressed: false,
      justReleased: false,
      down: false,
      inside: false,
    };
    const m = this.mouse;
    const setNdc = (e) => {
      const r = dom.getBoundingClientRect();
      m.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    dom.addEventListener('pointermove', (e) => {
      setNdc(e);
      m.inside = true;
    });
    dom.addEventListener('pointerleave', () => (m.inside = false));
    dom.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      setNdc(e);
      m.inside = true;
      m.down = true;
    });
    window.addEventListener('pointerup', (e) => {
      if (e.button === 0) m.down = false;
    });
  }

  /** Actualiza y devuelve las fuentes activas. */
  update(inXR) {
    const out = [];
    const now = performance.now() / 1000;
    for (const s of this.xr) {
      let pressed = false;
      s.active = false;
      s.flick = false;
      s.open = false;
      if (inXR && s.kind === 'hand') {
        const it = s.hand.joints['index-finger-tip'];
        const th = s.hand.joints['thumb-tip'];
        if (it && th && it.visible && th.visible && s.hand.visible !== false) {
          s.active = true;
          s.tip.copy(it.position);
          const d = it.position.distanceTo(th.position);
          pressed = s.pressed ? d < PINCH_OFF : d < PINCH_ON;
          // detector del tirito
          if (d < PINCH_ON) {
            if (!s.pinchSince) s.pinchSince = now;
            s.lastPinch = now;
          } else if (s.pinchSince) {
            if (d > FLICK_OPEN) {
              if (s.lastPinch - s.pinchSince > FLICK_HOLD && now - s.lastPinch < FLICK_FAST) {
                const mid = s.hand.joints['index-finger-phalanx-intermediate'];
                s.flick = true;
                s.flickFrom = (s.flickFrom || new THREE.Vector3()).copy(it.position);
                s.flickDir = (s.flickDir || new THREE.Vector3()).copy(it.position).sub(mid && mid.visible ? mid.position : th.position).normalize();
              }
              s.pinchSince = 0;
            } else if (now - s.lastPinch > FLICK_FAST) s.pinchSince = 0;
          }
          const wr = s.hand.joints['wrist'];
          const far = (j) => s.hand.joints[j]?.visible && wr?.visible && s.hand.joints[j].position.distanceTo(wr.position) > OPEN_TIP;
          s.open = far('index-finger-tip') && far('middle-finger-tip') && far('ring-finger-tip');
          s.point.copy(it.position).add(th.position).multiplyScalar(0.5);
          s.dotIndex.position.copy(it.position);
          s.dotThumb.position.copy(th.position);
          if (!s.styled) this.styleHand(s);
        }
      } else if (inXR && s.kind === 'controller' && s.ctrl.visible !== false) {
        s.active = true;
        // punto de agarre ~6 cm delante del control
        s.point.set(0, 0, -0.06).applyMatrix4(s.ctrl.matrixWorld);
        s.tip.copy(s.point);
        pressed = s.trigger;
        s.dotIndex.position.copy(s.point);
      }
      s.justPressed = pressed && !s.pressed;
      s.justReleased = !pressed && s.pressed;
      s.pressed = pressed;
      const showDots = s.active;
      s.dotIndex.visible = showDots;
      s.dotThumb.visible = showDots && s.kind === 'hand';
      s.dotIndex.material.color.set(pressed ? '#ffd84d' : '#ffffff');
      s.dotThumb.material.color.set(pressed ? '#ffd84d' : '#ffffff');
      s.ring.visible = s.active && pressed;
      if (s.ring.visible) {
        s.ring.position.copy(s.point);
        s.ring.lookAt(this.camera.getWorldPosition(new THREE.Vector3()));
      }
      if (s.active || s.justReleased) out.push(s);
    }

    const m = this.mouse;
    const pressed = !inXR && m.down;
    m.active = !inXR && (m.inside || pressed);
    m.ray.setFromCamera(m.ndc, this.camera);
    m.justPressed = pressed && !m.pressed;
    m.justReleased = !pressed && m.pressed;
    m.pressed = pressed;
    if (m.active || m.justReleased) out.push(m);
    return out;
  }

  /** Manos virtuales semitransparentes, para no tapar la mesa. */
  styleHand(s) {
    let found = false;
    s.handModel.traverse((o) => {
      if (o.isMesh) {
        found = true;
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = 0.45;
        o.material.color?.set('#c8f5c0');
        o.renderOrder = 35;
      }
    });
    s.styled = found;
  }

  releaseAll() {
    for (const s of this.xr) {
      s.pressed = false;
      s.trigger = false;
      s.dotIndex.visible = s.dotThumb.visible = s.ring.visible = false;
    }
  }
}
