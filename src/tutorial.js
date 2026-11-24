// Nivel tutorial: pasos cortos que enseñan las dinámicas con las manos y cómo funciona el juego.
// Cada paso muestra un anuncio fijo y avanza cuando el jugador lo cumple (o tras un rato, para no trabarse).

const STEPS = [
  {
    id: 'hola',
    text: 'Tutorial · Salva la isla',
    sub: 'Los invasores cruzan el río para arrasar el centro de la isla',
    time: 5,
  },
  {
    id: 'gota',
    text: 'Toca una gota de agua del río',
    sub: 'La corriente las trae: tócalas con el dedo (con mouse: clic). Con agua compras defensores',
    until: 'collect',
    time: 35,
    start: (g) => {
      // una gota cerca del usuario, ya
      const o = g.spawnRiverDrop(true);
      o.pos.x = -0.2;
      g.nextDrop = 4;
    },
  },
  {
    id: 'heliconia',
    text: 'Planta una heliconia en la tierra verde',
    sub: 'Toma su carta de la bandeja y suéltala en una casilla verde. En la arena no se puede',
    until: 'plant',
    match: (d) => d.type === 'heliconia',
    time: 40,
    start: (g) => g.giveWater(100),
  },
  {
    id: 'rana',
    text: 'Ahora planta una rana dardo',
    sub: 'Escupe veneno a los invasores que se acercan a la isla',
    until: 'plant',
    match: (d) => d.type === 'rana',
    time: 40,
    start: (g) => g.giveWater(75),
  },
  {
    id: 'hondo',
    text: '¡Llegan leñadores por el río!',
    sub: 'En lo hondo (agua oscura) la rana no los alcanza: espera a que salgan',
    spawn: [
      ['independiente', -0.12, 0],
      ['independiente', 0.16, 4],
    ],
    until: 'clear',
    time: 70,
  },
  {
    id: 'manotazo',
    text: 'Empújalos con la mano',
    sub: 'Barre con la mano abierta, o pellizca y suelta el índice como un tirito (con mouse: clic)',
    spawn: [
      ['independiente', -0.3, 0],
      ['independiente', -0.26, 0.6],
      ['profesional', 0.3, 1.2],
    ],
    respawn: true,
    until: 'push',
    time: 45,
    start: (g) => (g.pushCool = 0),
  },
  {
    id: 'jabillo',
    text: 'Lanza el jabillo como una granada',
    sub: 'Tómalo de la bandeja y arrójalo sobre ellos: explota también en el agua',
    respawn: true,
    until: 'grenade',
    time: 45,
    start: (g) => {
      g.giveWater(100);
      g.cool.jabillo = 0;
    },
  },
  {
    id: 'final',
    text: '¡Protege el corazón de la isla!',
    sub: 'Junta agua y planta más defensores: la ceiba aguanta, el mono salta',
    spawn: [
      ['independiente', -0.38, 2],
      ['profesional', 0.0, 6],
      ['independiente', 0.38, 10],
      ['independiente', -0.15, 16],
      ['profesional', 0.22, 20],
      ['independiente', -0.35, 24],
    ],
    until: 'clear',
    time: 120,
    start: (g) => g.giveWater(100),
  },
];

export class Tutorial {
  constructor(game) {
    this.g = game;
    this.i = -1;
    this.finished = false;
    this.queue = [];
    this.next();
  }

  get step() {
    return STEPS[this.i];
  }
  get progress() {
    return Math.min(1, Math.max(0, this.i) / STEPS.length);
  }

  next() {
    this.i++;
    const s = this.step;
    if (!s) {
      this.finished = true;
      return;
    }
    this.t = 0;
    this.done = false;
    this.mine = [];
    this.queue = (s.spawn || []).map(([type, x, t]) => ({ type, x, t }));
    s.start?.(this.g);
    this.g.on.banner({ text: s.text, sub: s.sub, big: s.id === 'final', hold: !!s.until, tutorial: true });
  }

  /** Eventos del juego: collect, plant, push, grenade, kill. */
  event(evt, data) {
    const s = this.step;
    if (!s || this.done || s.until !== evt) return;
    if (s.match && !s.match(data)) return;
    this.complete();
  }

  complete() {
    this.done = true;
    this.doneT = 0;
    this.g.on.banner({ text: '¡Muy bien!', sub: '', ok: true });
  }

  update(dt) {
    const s = this.step;
    if (!s) return;
    this.t += dt;
    for (let k = this.queue.length - 1; k >= 0; k--) {
      const q = this.queue[k];
      if (this.t >= q.t) {
        this.mine.push(this.g.spawnEnemy(q.type, q.x));
        this.queue.splice(k, 1);
      }
    }
    const alive = this.g.enemies.some((e) => e.alive);
    // en los pasos de manotazo y jabillo siempre tiene que haber a quién empujar
    if (s.respawn && !this.done && !alive && this.queue.length === 0) {
      this.mine.push(this.g.spawnEnemy('independiente', (Math.random() - 0.5) * 0.6));
      this.mine.push(this.g.spawnEnemy('independiente', (Math.random() - 0.5) * 0.6));
    }
    if (!this.done) {
      if (s.until === 'clear' && this.queue.length === 0 && !alive) this.complete();
      else if (!s.until && this.t >= s.time) this.done = true;
      else if (this.t >= s.time) this.complete(); // no trabarse
      if (this.done && !s.until) this.doneT = 1;
    } else {
      this.doneT += dt;
      // el último paso termina el tutorial; el juego da la victoria cuando no queda nadie
      if (this.doneT >= 1.4) this.next();
    }
  }
}
