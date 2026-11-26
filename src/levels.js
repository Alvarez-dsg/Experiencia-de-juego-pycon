// Niveles: el 0 es el tutorial; del 1 al 5 cada uno trae invasores más fuertes.
// Las oleadas se generan con una semilla fija, así cada nivel es igual cada vez que se juega.
// Los invasores llegan desde toda la orilla talada (de forma radial) hacia el corazón de la isla (una pradera en el centro).

// rows: filas de la isla donde se puede plantar (2 al principio y una más por nivel)
// hpMul: multiplica la vida · count: invasores antes de la gran ola · wave: invasores de la gran ola
// mix: probabilidad relativa de cada invasor · length: segundos hasta el final de la gran ola
// boss: invasores que siempre llegan en la gran ola
export const LEVELS = [
  {
    name: 'Tutorial',
    tutorial: true,
    hpMul: 1,
    rows: [1, 2], // filas donde se puede plantar
    speedMul: 1,
    startWater: 100,
  },
  {
    name: 'La primera tala',
    hpMul: 1.15,
    rows: [1, 2], // filas donde se puede plantar
    speedMul: 1,
    length: 90, // corto: es el nivel de calentamiento
    count: 11,
    wave: 6,
    mix: { independiente: 1, profesional: 0.45 },
    tips: [
      { t: 0.3, text: 'Nivel 1 · La primera tala', sub: 'Toca las gotas del río y planta heliconias' },
      { t: 12, text: 'Llegan por toda la orilla', sub: 'Rodea el corazón de la isla con defensores' },
      { t: 38, text: 'Los animales también defienden', sub: 'El mono salta · la tortuga nada · el chigüiro muerde' },
    ],
  },
  {
    name: 'Llegan las motosierras',
    hpMul: 1.25,
    rows: [0, 1, 2], // filas donde se puede plantar
    speedMul: 1,
    length: 160,
    count: 17,
    wave: 8,
    mix: { independiente: 0.7, profesional: 0.8, motosierra: 0.45 },
    tips: [
      { t: 0.3, text: 'Nivel 2 · Llegan las motosierras', sub: 'El motosierrista aguanta el doble que el profesional' },
      { t: 26, text: '¡Lanza el jabillo!', sub: 'Explota también en lo hondo del río' },
    ],
  },
  {
    name: 'Las máquinas',
    hpMul: 1.3,
    rows: [0, 1, 2, 3], // filas donde se puede plantar
    speedMul: 1.03,
    length: 170,
    count: 20,
    wave: 9,
    mix: { independiente: 0.4, profesional: 0.9, motosierra: 0.7, excavadora: 0.16 },
    boss: ['excavadora'],
    tips: [
      { t: 0.3, text: 'Nivel 3 · Las máquinas', sub: 'La excavadora aguanta muchísimo: la anaconda la aprieta' },
      { t: 30, text: '¡Empújalos con la mano!', sub: 'Barre con la mano abierta o pellizca y suelta el índice (con mouse: clic)' },
    ],
  },
  {
    name: 'Fiebre de madera',
    hpMul: 1.35,
    rows: [0, 1, 2, 3], // filas donde se puede plantar
    speedMul: 1.05,
    length: 180,
    count: 24,
    wave: 11,
    mix: { independiente: 0.2, profesional: 0.8, motosierra: 0.9, excavadora: 0.22, bulldozer: 0.16, astilladora: 0.09 },
    boss: ['bulldozer', 'astilladora'],
    tips: [
      { t: 0.3, text: 'Nivel 4 · Fiebre de madera', sub: 'Bulldóceres y astilladoras: el doble y el cuádruple de vida' },
    ],
  },
  {
    name: 'La gran tala',
    hpMul: 1.4,
    rows: [0, 1, 2, 3], // filas donde se puede plantar
    speedMul: 1.08,
    length: 190,
    count: 28,
    wave: 13,
    mix: { independiente: 0.2, profesional: 0.7, motosierra: 1, excavadora: 0.24, bulldozer: 0.2, astilladora: 0.14, desbrozadora: 0.06 },
    boss: ['desbrozadora', 'astilladora'],
    tips: [{ t: 0.3, text: 'Nivel 5 · La gran tala', sub: 'Llega la desbrozadora: el último esfuerzo de DEFORESTA S.A.' }],
  },
];

const MACHINES = new Set(['excavadora', 'bulldozer', 'astilladora', 'desbrozadora']);
const NAMES = { excavadora: 'la excavadora', bulldozer: 'el bulldócer', astilladora: 'la astilladora', desbrozadora: 'la desbrozadora' };

function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(mix, R) {
  const entries = Object.entries(mix).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let x = R() * total;
  for (const [type, w] of entries) {
    x -= w;
    if (x <= 0) return type;
  }
  return entries[entries.length - 1][0];
}

const randX = (R) => (R() * 2 - 1) * 0.44;

/** Construye las oleadas y anuncios del nivel `i` (0 = tutorial). */
export function makeLevel(i) {
  const L = LEVELS[i];
  if (L.tutorial) return { ...L, index: i, number: 0, total: LEVELS.length - 1, spawns: [], banners: [], last: 1 };
  const R = rng(1000 + i * 77);
  const first = 14;
  const waveT = L.length - 15; // inicio de la gran ola
  const spawns = [];
  for (let k = 0; k < L.count; k++) {
    const f = L.count > 1 ? k / (L.count - 1) : 0;
    let type = k === 0 ? 'independiente' : pick(L.mix, R);
    if (MACHINES.has(type) && f < 0.35) type = 'profesional'; // las máquinas llegan a mitad de nivel
    const t = first + (waveT - 12 - first) * Math.pow(f, 0.85) + (k ? (R() - 0.5) * 3 : 0);
    spawns.push({ t, type, x: randX(R) });
  }
  // gran ola: llegan en tres frentes (izquierda, centro, derecha)
  const waveMix = { ...L.mix };
  for (const m of MACHINES) if (waveMix[m]) waveMix[m] *= 1.4;
  if (waveMix.motosierra) waveMix.motosierra *= 1.3;
  const fronts = [-0.33, 0, 0.33];
  for (let k = 0; k < L.wave; k++) {
    spawns.push({ t: waveT + k * (14 / L.wave), type: pick(waveMix, R), x: fronts[k % 3] + (R() - 0.5) * 0.18 });
  }
  (L.boss || []).forEach((type, k) => spawns.push({ t: waveT + 4 + k * 5, type, x: fronts[(k + 1) % 3] }));
  spawns.sort((a, b) => a.t - b.t);

  const banners = [...L.tips];
  const firstMachine = spawns.find((s) => MACHINES.has(s.type));
  if (firstMachine && firstMachine.t < waveT - 8) {
    banners.push({ t: firstMachine.t - 4, text: '¡Llega ' + NAMES[firstMachine.type] + '!', sub: 'Las máquinas aguantan mucho: junta varios defensores' });
  }
  banners.push({ t: waveT - 4, text: '¡GRAN OLA DE DEFORESTACIÓN!', sub: 'Llegan por toda la orilla', big: true });
  banners.sort((a, b) => a.t - b.t);

  return { ...L, index: i, number: i, total: LEVELS.length - 1, spawns, banners, last: spawns[spawns.length - 1].t };
}
