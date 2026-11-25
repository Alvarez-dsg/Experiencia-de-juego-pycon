// ─────────────────────────────────────────────────────────────
//  Configuración general de "Amazonas vs Leñadores"
//  Todas las medidas están en METROS (escala real sobre la mesa).
//  Los niveles están en levels.js.
// ─────────────────────────────────────────────────────────────

export const BOARD = {
  cell: 0.068, // tamaño de cada casilla de la isla (6,8 cm)
  cols: 8, // casillas a lo ancho de la isla
  rows: 4, // casillas a lo hondo de la isla
  width: 1.0, // ancho total del diorama
  depth: 0.8, // fondo total del diorama
  thickness: 0.03, // grosor del "diorama"
};

const C = BOARD.cell;

// La isla de manglar: elipses (en metros) de la tierra verde y de la arena de la orilla.
// En el centro (2×2 casillas) está el Mangle madre, lo que hay que proteger.
export const ISLAND = {
  cx: 0,
  cz: 0.06,
  landA: 0.335,
  landB: 0.168,
  sandA: 0.39,
  sandB: 0.208,
  heartR: 0.075, // radio del Mangle madre
  heartHp: 3000, // vida del corazón de la isla
};

// Coordenadas locales del tablero: x → derecha, z → hacia el usuario, y → arriba.
// Al fondo (z negativo) está la orilla talada de DEFORESTA S.A.; de ahí salen los invasores.
// El río corre de izquierda a derecha y rodea la isla.
export const LAYOUT = {
  totalW: BOARD.width,
  totalD: BOARD.depth,
  left: -BOARD.width / 2,
  right: BOARD.width / 2,
  back: -BOARD.depth / 2,
  front: BOARD.depth / 2,
  gridX0: ISLAND.cx - (BOARD.cols * C) / 2,
  gridX1: ISLAND.cx + (BOARD.cols * C) / 2,
  gridZ0: ISLAND.cz - (BOARD.rows * C) / 2,
  gridZ1: ISLAND.cz + (BOARD.rows * C) / 2,
  gridW: BOARD.cols * C,
  gridD: BOARD.rows * C,
  tileTop: 0.014, // altura de la tierra verde de la isla
  groundTop: 0.012, // altura de las orillas
  waterY: 0.007, // superficie del río
  bankZ: -0.27, // borde medio de la orilla talada
  frontZ: 0.345, // borde medio de la orilla de selva (la del usuario)
};

// Bandeja de defensores: por defecto, un atril a la izquierda del tablero, al alcance de la mano.
// Otras opciones de `side`: 'back' (detrás del tablero) o 'front' (borde cercano).
// side 'left': atril bajo junto al borde izquierdo del tablero, cerca del usuario (no hay que estirarse).
// height: altura del centro sobre la mesa · gap: separación del tablero · fromFront: qué tan atrás del borde
// cercano queda su centro · tilt: inclinación hacia atrás · yaw: giro hacia el centro del tablero.
// side 'column' (wireframe): una sola línea vertical, de pie junto a la esquina izquierda cercana al usuario,
// arriba pausa y empujar, luego el agua, los 5 elegidos y la pala. scale: tamaño de la bandeja.
export const TRAY = { side: 'column', height: 0.13, gap: 0.05, fromFront: 0.1, tilt: -0.32, yaw: 0.55, scale: 0.8, perRow: 6 };

// Unidad de daño: una semilla de guacamaya o una gota de veneno de rana.
const SHOT = 25;

// ── Defensores: plantas y animales amazónicos ──
// Se compran con gotas de agua (cada gota vale 25). Las distancias están en casillas.
// Los tiradores (rana, guacamaya) y el mono no alcanzan a quien cruza la parte honda del río.
export const PLANTS = {
  heliconia: {
    name: 'Heliconia',
    animal: false,
    role: 'Da agua',
    cost: 25,
    cooldown: 7.5,
    hp: 300,
    kind: 'producer',
    firstProduce: 5,
    produceEvery: 18,
    produceValue: 25,
  },
  achiote: {
    name: 'Achiote',
    animal: false,
    role: 'Barrera que frena y hiere',
    cost: 50,
    cooldown: 7.5,
    hp: 400,
    kind: 'barrier', // no bloquea: los invasores pasan por encima, se frenan y pierden vida poco a poco
    slow: 0.45, // velocidad mientras la cruzan
    dps: 14, // daño por segundo a cada invasor encima
    crush: 0.1, // fracción del daño de las máquinas que recibe al ser aplastado (las personas no lo dañan)
  },
  rana: {
    name: 'Rana dardo',
    short: 'Rana',
    animal: true,
    role: 'Escupe veneno que frena',
    cost: 75,
    cooldown: 7.5,
    hp: 300,
    kind: 'shooter',
    projectile: 'poison',
    range: 4.6,
    fireEvery: 1.3,
    damage: SHOT,
    slowTime: 4,
  },
  ceiba: {
    name: 'Ceiba',
    animal: false,
    role: 'Muro gigante',
    cost: 50,
    cooldown: 20,
    hp: 4000,
    kind: 'wall',
  },
  mariposa: {
    name: 'Mariposa morfo',
    short: 'Mariposa',
    animal: true,
    role: 'Cura a los vecinos',
    cost: 50,
    cooldown: 10,
    hp: 200,
    kind: 'healer',
    flapEvery: 0.9,
    heal: 25,
    radius: 1.6,
  },
  chiguiro: {
    name: 'Chigüiro',
    animal: true,
    role: 'Muerde al que se acerca',
    cost: 75,
    cooldown: 10,
    hp: 1400,
    kind: 'biter',
    biteEvery: 0.8,
    damage: 45,
    reach: 1.25,
  },
  mono: {
    name: 'Mono capuchino',
    short: 'Mono',
    animal: true,
    role: 'Salta, golpea y vuelve',
    cost: 100,
    cooldown: 7.5,
    hp: 300,
    kind: 'leaper',
    range: 3.6,
    damage: 3 * SHOT,
    jumpTime: 0.42,
    rest: 1.3,
  },
  guacamaya: {
    name: 'Guacamaya',
    animal: true,
    role: 'Tres semillas en abanico',
    cost: 125,
    cooldown: 7.5,
    hp: 300,
    kind: 'shooter',
    projectile: 'seed',
    spread: 3, // tres semillas: al objetivo y a los lados
    range: 5,
    fireEvery: 1.5,
    damage: SHOT,
  },
  tortuga: {
    name: 'Tortuga charapa',
    short: 'Tortuga',
    animal: true,
    role: 'Nada, rueda y golpea en área',
    cost: 100,
    cooldown: 10,
    hp: 600,
    kind: 'roller', // también alcanza a los que cruzan por lo hondo
    range: 4.2,
    damage: 6 * SHOT,
    radius: 1.15,
    rollSpeed: 3.2,
    backSpeed: 2.4,
    rest: 5,
  },
  anaconda: {
    name: 'Anaconda',
    animal: true,
    role: 'Atrapa al que se acerca',
    cost: 125,
    cooldown: 15,
    hp: 300,
    kind: 'trap', // se traga a las personas; a las máquinas las aprieta (mucho daño) y las frena
    range: 1.8,
    windup: 0.3,
    digest: 12,
    squeeze: 1500,
  },
  jabillo: {
    name: 'Jabillo',
    animal: false,
    role: 'Lánzalo: explota',
    cost: 100,
    cooldown: 18,
    hp: 1,
    kind: 'grenade', // no se planta: se lanza con la mano como una granada
    damage: 2500,
    radius: 1.6,
  },
};
// Orden en la pantalla de selección
export const PLANT_ORDER = ['heliconia', 'achiote', 'rana', 'ceiba', 'mariposa', 'chiguiro', 'mono', 'guacamaya', 'tortuga', 'anaconda', 'jabillo'];

// Equipo: antes de cada nivel se eligen TEAM.size personajes (la pala siempre está en la bandeja).
// El tutorial usa un equipo fijo.
export const TEAM = {
  size: 5,
  default: ['heliconia', 'rana', 'achiote', 'ceiba', 'mono'],
  tutorial: ['heliconia', 'rana', 'ceiba', 'mono', 'jabillo'],
};

// Tarjeta de cada personaje: tipo, habilidad y el dato más importante
export const ABILITIES = {
  heliconia: { tipo: 'Productora', text: 'Junta rocío y cada 18 s deja caer una gota de agua. Planta varias al principio.', stat: ['Agua', '+25'] },
  achiote: { tipo: 'Barrera', text: 'Una mata espinosa en el suelo. Los invasores la cruzan a media velocidad y pierden vida poco a poco.', stat: ['Daño', '14/s'] },
  rana: { tipo: 'Tiradora', text: 'Escupe veneno al invasor más cercano y lo frena 4 s. No alcanza a quien va por lo hondo del río.', stat: ['Daño', '25'] },
  ceiba: { tipo: 'Muro', text: 'El árbol más grande de la selva. Aguanta muchísimo mientras los demás atacan.', stat: ['Vida', '4000'] },
  mariposa: { tipo: 'Sanadora', text: 'Con cada aleteo cura a los defensores que tiene alrededor. Ponla junto a tu muro.', stat: ['Cura', '+25'] },
  chiguiro: { tipo: 'Mordedor', text: 'Resistente y tranquilo… hasta que alguien se le acerca: entonces muerde sin parar.', stat: ['Mordida', '45'] },
  mono: { tipo: 'Saltador', text: 'Salta sobre el invasor más cercano, lo golpea y vuelve de otro salto. No se lanza a lo hondo.', stat: ['Golpe', '75'] },
  guacamaya: { tipo: 'Tiradora triple', text: 'Lanza tres semillas en abanico. No alcanza a quien va por lo hondo del río.', stat: ['Daño', '25×3'] },
  tortuga: { tipo: 'Nadadora', text: 'Se esconde en su caparazón y rueda o nada hacia los invasores, ¡también por lo hondo! Golpea a todos alrededor.', stat: ['Golpe', '150'] },
  anaconda: { tipo: 'Trampa', text: 'Se traga a la persona que se acerque. A las máquinas las aprieta con fuerza y las detiene un rato.', stat: ['Apretón', '1500'] },
  jabillo: { tipo: 'Granada', text: 'No se planta: tómalo con la mano y lánzalo. Su fruto estalla y arrasa a la redonda, también en el agua.', stat: ['Daño', '2500'] },
};

// ── Invasores ── velocidad en casillas por segundo
// La vida sube de forma exponencial: cada persona aguanta el doble que la anterior, la primera máquina
// el triple que la última persona y cada máquina el doble que la anterior. Cada nivel la multiplica (levels.js).
const HP0 = 150; // vida base (se subió: las peleas eran muy cortas)
const TIER = [1, 2, 4, 12, 24, 48, 96];
// kind: person | machine · rad: radio (casillas) · reach: alcance de su ataque · dps: daño a defensores
export const ENEMIES = {
  independiente: { name: 'Leñador independiente', kind: 'person', tool: 'axe', hp: HP0 * TIER[0], speed: 0.27, dps: 80, rad: 0.26, reach: 0.34 },
  profesional: { name: 'Leñador profesional', kind: 'person', tool: 'axe', hp: HP0 * TIER[1], speed: 0.25, dps: 120, rad: 0.27, reach: 0.34 },
  motosierra: { name: 'Motosierrista', kind: 'person', tool: 'saw', hp: HP0 * TIER[2], speed: 0.3, dps: 230, rad: 0.27, reach: 0.4 },
  excavadora: { name: 'Excavadora', kind: 'machine', hp: HP0 * TIER[3], speed: 0.15, dps: 450, rad: 0.5, reach: 0.72 },
  bulldozer: { name: 'Bulldócer', kind: 'machine', hp: HP0 * TIER[4], speed: 0.13, dps: 650, rad: 0.52, reach: 0.66 },
  astilladora: { name: 'Astilladora', kind: 'machine', hp: HP0 * TIER[5], speed: 0.11, dps: 900, rad: 0.52, reach: 0.7 },
  desbrozadora: { name: 'Desbrozadora', kind: 'machine', hp: HP0 * TIER[6], speed: 0.1, dps: 1300, rad: 0.58, reach: 0.74 },
};
export const ENEMY_ORDER = Object.keys(ENEMIES);

// ── Economía: el río arrastra gotas de agua; tócalas para juntarlas ──
export const ECONOMY = {
  startWater: 150,
  firstDrop: 3,
  dropEvery: [5, 8], // segundos entre gotas que trae el río
  dropValue: 25,
  current: 0.032, // m/s de la corriente (de izquierda a derecha)
  dropLife: 12, // segundos que dura en el suelo la gota de la heliconia
};

// ── Interacción directa con la mano ──
// Iluminación: sombras básicas del sol sobre el tablero (personajes, árboles y empresa proyectan; el terreno
// recibe). Un solo mapa pequeño compartido por los dos ojos para no cargar a las Quest. La oclusión ambiental de
// los personajes viene horneada desde Blender (blender/exportar.py) y no cuesta nada en tiempo real.
export const LIGHT = {
  shadows: true,
  mapSize: 1024, // px del mapa de sombras
  intensity: 0.45, // 0 = sin sombra, 1 = sombra negra (sutil)
  radius: 2.5, // suavizado del borde
};

export const HAND = {
  // Manotazo: barre el tablero con la mano abierta, rápido, para alejar a los invasores de la isla
  push: {
    speed: 1.0, // m/s mínimos de la mano (más alto = menos empujones sin querer)
    height: 0.12, // altura máxima de la mano sobre el tablero (m)
    radius: 1.4, // casillas alrededor de la mano
    knock: 1.7, // casillas que retroceden
    stun: 1.2, // segundos aturdidos
    damage: 15,
    cooldown: 6,
  },
  // Jabillo lanzado como granada
  grenade: {
    gravity: 9.8, // m/s² (gravedad real)
    minThrow: 0.5, // m/s: por debajo, simplemente se suelta y cae
    maxSpeed: 4,
  },
};

// Datos para mostrar al perder un nivel
export const FACTS = [
  'La Amazonía alberga cerca del 10 % de las especies conocidas del planeta.',
  'Una ceiba puede superar los 50 metros de altura.',
  'El fruto del jabillo (Hura crepitans) estalla para lanzar sus semillas a decenas de metros.',
  'Las semillas del achiote se usan desde hace siglos como pigmento rojo natural.',
  'Las heliconias son polinizadas principalmente por colibríes.',
  'Los monos capuchinos usan piedras y palos como herramientas para abrir frutos y nueces.',
  'Los colores brillantes de las ranas dardo avisan a los depredadores que son venenosas.',
  'La anaconda verde es la serpiente más pesada del mundo y vive en ríos y pantanos amazónicos.',
  'El chigüiro (capibara) es el roedor más grande del mundo y nada muy bien.',
  'Las guacamayas comen semillas y frutos y los dispersan por toda la selva.',
  'La tortuga charapa es la más grande de los ríos amazónicos.',
  'Las alas de la mariposa morfo son azules por su estructura microscópica, no por un pigmento.',
  'El bosque seco tropical es uno de los ecosistemas más amenazados de Colombia.',
  'Los manglares protegen las orillas y son criaderos de peces, cangrejos y aves.',
  'Los bosques amazónicos guardan enormes cantidades de carbono: talarlos acelera el cambio climático.',
  'La ganadería extensiva es una de las principales causas de deforestación en la Amazonía.',
  'El jaguar es el felino más grande de América y necesita grandes extensiones de bosque continuo.',
  'Una astilladora convierte un árbol entero en virutas en pocos minutos.',
  'Los ríos amazónicos cambian de nivel varios metros entre la época seca y la de lluvias.',
];
