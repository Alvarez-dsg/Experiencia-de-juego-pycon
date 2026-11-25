// Idioma del juego: español (por defecto) o inglés. Los textos se escriben en español en el código
// y `tr()` los traduce con este diccionario cuando el idioma es inglés (si falta una frase, queda en español).
// El idioma se elige en la pantalla de inicio y se recuerda en el navegador.

const KEY = 'amazonas-lang';
let lang = 'es';
try {
  const q = new URLSearchParams(location.search).get('lang');
  lang = q === 'en' || q === 'es' ? q : localStorage.getItem(KEY) === 'en' ? 'en' : 'es';
} catch {
  /* sin almacenamiento: español */
}
const listeners = new Set();

export const getLang = () => lang;
export function setLang(l) {
  if (l !== 'es' && l !== 'en') return;
  if (l === lang) return;
  lang = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* nada */
  }
  document.documentElement.lang = l;
  for (const fn of listeners) fn(l);
}
/** Llama a fn cada vez que cambia el idioma. */
export const onLang = (fn) => (listeners.add(fn), () => listeners.delete(fn));

/** Traduce un texto escrito en español. vars: { n: 3 } reemplaza {n}. */
export function tr(es, vars) {
  let s = lang === 'en' ? EN[es] ?? dynamic(es) ?? es : es;
  if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k]);
  return s;
}

// frases que llevan nombres dentro
function dynamic(es) {
  let m = /^Nivel (\d+) · (.+)$/.exec(es);
  if (m) return `Level ${m[1]} · ${EN[m[2]] ?? m[2]}`;
  m = /^¡Llega (.+)!$/.exec(es);
  if (m) return `Here comes the ${(EN[m[1]] ?? m[1]).toLowerCase()}!`;
  m = /^Nivel (\d+) de (\d+) · (.+)$/.exec(es);
  if (m) return `Level ${m[1]} of ${m[2]} · ${EN[m[3]] ?? m[3]}`;
  m = /^Nivel (\d+) superado$/.exec(es);
  if (m) return `Level ${m[1]} cleared`;
  m = /^Nivel (\d+)$/.exec(es);
  if (m) return `Level ${m[1]}`;
  return null;
}

const EN = {
  // inicio
  'Amazonas vs Leñadores': 'Amazon vs Loggers',
  'Experiencia RA · Meta Quest': 'AR experience · Meta Quest',
  'Ver tutorial': 'View tutorial',
  Jugar: 'Play',
  Recolocar: 'Move board',
  'Defiende la isla de DEFORESTA S.A.': 'Defend the island from DEFORESTA S.A.',
  // selección
  'Elige a tus {n} defensores': 'Choose your {n} defenders',
  'Tu equipo': 'Your team',
  '{a} de {b}': '{a} of {b}',
  '¡A defender!': 'Defend!',
  'Elige {n} más': 'Pick {n} more',
  Vaciar: 'Clear',
  'Equipo completo': 'Team full',
  'Todos los defensores': 'All defenders',
  // cartas
  Quitar: 'Remove',
  Costo: 'Cost',
  Pala: 'Shovel',
  'Da agua': 'Makes water',
  'Frena y hiere': 'Slows and hurts',
  'Defensa a distancia': 'Ranged defense',
  'Muro resistente': 'Tough wall',
  'Cura a su equipo': 'Heals allies',
  'Muerde de cerca': 'Close-range bite',
  'Salta y golpea': 'Leaps and strikes',
  'Tiro triple': 'Triple shot',
  'Rueda y aplasta': 'Rolls and smashes',
  'Atrapa y aprieta': 'Grabs and squeezes',
  'Lánzalo: explota': 'Throw it: boom!',
  'Quita un defensor': 'Removes a defender',
  Heliconia: 'Heliconia',
  Achiote: 'Achiote',
  'Rana dardo': 'Dart frog',
  Rana: 'Frog',
  Ceiba: 'Kapok tree',
  'Mariposa morfo': 'Morpho butterfly',
  Mariposa: 'Butterfly',
  Chigüiro: 'Capybara',
  'Mono capuchino': 'Capuchin monkey',
  Mono: 'Monkey',
  Guacamaya: 'Macaw',
  'Tortuga charapa': 'River turtle',
  Tortuga: 'Turtle',
  Anaconda: 'Anaconda',
  Jabillo: 'Sandbox tree',
  // bandeja
  AGUA: 'WATER',
  Empujar: 'Push',
  Tutorial: 'Tutorial',
  'Isla {n}%': 'Island {n}%',
  // pausa / derrota / entre niveles
  Continuar: 'Resume',
  Reiniciar: 'Restart',
  'Salir de RA': 'Exit AR',
  Reintentar: 'Try again',
  'Cambiar equipo': 'Change team',
  Salir: 'Exit',
  'Siguiente nivel': 'Next level',
  'Jugar de nuevo': 'Play again',
  'Pausa': 'Paused',
  'Pausar': 'Pause',
  'El juego está en pausa.': 'The game is paused.',
  'Arrasaron el corazón de la isla…': 'They razed the heart of the island…',
  'DEFORESTA S.A. cruzó el río y llegó al centro de la isla. Prueba otro equipo o vuelve a intentarlo.':
    'DEFORESTA S.A. crossed the river and reached the center of the island. Try another team or give it another go.',
  '¿Sabías que…?': 'Did you know…?',
  'Conoce PyCon Colombia 2028': 'Meet PyCon Colombia 2028',
  'Invasores detenidos: {n}.': 'Invaders stopped: {n}.',
  'Superaste los {t} niveles y detuviste a {n} invasores en el último.': 'You beat all {t} levels and stopped {n} invaders in the last one.',
  // escaneo
  'Colocar frente a mí': 'Place in front of me',
  'Configurar espacio': 'Set up space',
  'Realidad aumentada': 'Augmented reality',
  'No disponible': 'Not available',
  // niveles
  'La primera tala': 'The first cut',
  'Llegan las motosierras': 'Chainsaws arrive',
  'Las máquinas': 'The machines',
  'Fiebre de madera': 'Timber fever',
  'La gran tala': 'The great clear-cut',
  'Toca las gotas del río y planta heliconias': 'Tap the river drops and plant heliconias',
  'Llegan por toda la orilla': 'They come from all along the bank',
  'Rodea el corazón de la isla con defensores': 'Surround the heart of the island with defenders',
  'Los animales también defienden': 'Animals defend too',
  'El mono salta · la tortuga nada · el chigüiro muerde': 'The monkey leaps · the turtle swims · the capybara bites',
  'El motosierrista aguanta el doble que el profesional': 'The chainsaw logger is twice as tough as the pro',
  '¡Lanza el jabillo!': 'Throw the sandbox fruit!',
  'Explota también en lo hondo del río': 'It also explodes in the deep river',
  'La excavadora aguanta muchísimo: la anaconda la aprieta': 'The excavator is very tough: the anaconda squeezes it',
  '¡Empújalos con la mano!': 'Push them with your hand!',
  'Barre con la mano abierta o pellizca y suelta el índice (con mouse: clic)': 'Swipe with an open hand or pinch and flick your index finger (mouse: click)',
  'Bulldóceres y astilladoras: el doble y el cuádruple de vida': 'Bulldozers and chippers: double and quadruple health',
  'Llega la desbrozadora: el último esfuerzo de DEFORESTA S.A.': 'The brush cutter arrives: DEFORESTA S.A.’s last push',
  'Las máquinas aguantan mucho: junta varios defensores': 'Machines are tough: team up several defenders',
  '¡GRAN OLA DE DEFORESTACIÓN!': 'HUGE DEFORESTATION WAVE!',
  '¡Tutorial completado!': 'Tutorial complete!',
  'Elige 5 defensores para el nivel 1': 'Choose 5 defenders for level 1',
  '¡Muy bien!': 'Well done!',
  // invasores
  'Leñador independiente': 'Freelance logger',
  'Leñador profesional': 'Pro logger',
  Motosierrista: 'Chainsaw logger',
  Excavadora: 'Excavator',
  Bulldócer: 'Bulldozer',
  Astilladora: 'Wood chipper',
  Desbrozadora: 'Brush cutter',
  // tutorial
  'Tutorial · Salva la isla': 'Tutorial · Save the island',
  'Los invasores cruzan el río para arrasar el centro de la isla': 'Invaders cross the river to raze the center of the island',
  'Toca una gota de agua del río': 'Tap a water drop in the river',
  'La corriente las trae: tócalas con el dedo (con mouse: clic). Con agua compras defensores':
    'The current brings them: tap them with your finger (mouse: click). Water buys defenders',
  'Planta una heliconia en la tierra verde': 'Plant a heliconia on the green land',
  'Toma su carta de la bandeja y suéltala en una casilla verde. En la arena no se puede':
    'Grab its card from the tray and drop it on a green tile. Not on the sand',
  'Ahora planta una rana dardo': 'Now plant a dart frog',
  'Escupe veneno a los invasores que se acercan a la isla': 'It spits poison at invaders approaching the island',
  '¡Llegan leñadores por el río!': 'Loggers are crossing the river!',
  'En lo hondo (agua oscura) la rana no los alcanza: espera a que salgan': 'In the deep (dark water) the frog can’t reach them: wait until they come out',
  'Empújalos con la mano': 'Push them with your hand',
  'Barre con la mano abierta, o pellizca y suelta el índice como un tirito (con mouse: clic)':
    'Swipe with an open hand, or pinch and flick your index finger (mouse: click)',
  'Lanza el jabillo como una granada': 'Throw the sandbox fruit like a grenade',
  'Tómalo de la bandeja y arrójalo sobre ellos: explota también en el agua': 'Grab it from the tray and throw it at them: it also explodes in water',
  '¡Protege el corazón de la isla!': 'Protect the heart of the island!',
  'Junta agua y planta más defensores: la ceiba aguanta, el mono salta': 'Collect water and plant more defenders: the kapok holds, the monkey leaps',
  // portada
  'Para entrar en RA abre esta página con HTTPS (o desde localhost).': 'To enter AR, open this page over HTTPS (or from localhost).',
  'Este navegador no tiene WebXR. Ábrelo en el navegador de Meta Quest. Mientras tanto, prueba el modo navegador.': 'This browser has no WebXR. Open it in the Meta Quest browser. Meanwhile, try browser mode.',
  'Listo: tu dispositivo soporta realidad aumentada.': 'Ready: your device supports augmented reality.',
  'Este dispositivo no soporta RA inmersiva. Usa unas Meta Quest o prueba el modo navegador.': 'This device doesn’t support immersive AR. Use a Meta Quest or try browser mode.',
  // RA: búsqueda de mesa
  'Buscando una mesa…': 'Looking for a table…',
  'Mira hacia una superficie elevada, como una mesa o un escritorio.': 'Look at a raised surface, like a table or a desk.',
  '¡Mesa detectada!': 'Table found!',
  'Preparando el tablero sobre la mesa…': 'Setting up the board on the table…',
  'Pellizca sobre la mesa resaltada para colocar el tablero allí.': 'Pinch over the highlighted table to place the board there.',
  'Superficie encontrada': 'Surface found',
  'Pellizca para colocar el tablero sobre el anillo amarillo.': 'Pinch to place the board on the yellow ring.',
  'No encuentro mesas': 'I can’t find any tables',
  'Haz la configuración del espacio de tu Quest y marca tu mesa, o coloca el tablero frente a ti.': 'Run your Quest’s space setup and mark your table, or place the board in front of you.',
  'Este navegador no comparte las superficies. Coloca el tablero frente a ti.': 'This browser doesn’t share surfaces. Place the board in front of you.',
  'Sal de la experiencia y haz la configuración del espacio desde los ajustes de tu Quest.': 'Exit the experience and run space setup from your Quest settings.',
  'Sal de la experiencia y haz la configuración del espacio desde los ajustes de tu Quest (marca tu mesa).': 'Exit the experience and run space setup from your Quest settings (mark your table).',
  // datos curiosos
  'La Amazonía alberga cerca del 10 % de las especies conocidas del planeta.': 'The Amazon is home to about 10% of the planet’s known species.',
  'Una ceiba puede superar los 50 metros de altura.': 'A kapok tree can grow taller than 50 meters.',
  'El fruto del jabillo (Hura crepitans) estalla para lanzar sus semillas a decenas de metros.': 'The sandbox tree fruit (Hura crepitans) explodes to fling its seeds dozens of meters away.',
  'Las semillas del achiote se usan desde hace siglos como pigmento rojo natural.': 'Achiote seeds have been used for centuries as a natural red pigment.',
  'Las heliconias son polinizadas principalmente por colibríes.': 'Heliconias are pollinated mainly by hummingbirds.',
  'Los monos capuchinos usan piedras y palos como herramientas para abrir frutos y nueces.': 'Capuchin monkeys use stones and sticks as tools to open fruits and nuts.',
  'Los colores brillantes de las ranas dardo avisan a los depredadores que son venenosas.': 'The bright colors of dart frogs warn predators that they are poisonous.',
  'La anaconda verde es la serpiente más pesada del mundo y vive en ríos y pantanos amazónicos.': 'The green anaconda is the heaviest snake in the world and lives in Amazon rivers and swamps.',
  'El chigüiro (capibara) es el roedor más grande del mundo y nada muy bien.': 'The capybara is the largest rodent in the world and a great swimmer.',
  'Las guacamayas comen semillas y frutos y los dispersan por toda la selva.': 'Macaws eat seeds and fruits and spread them throughout the rainforest.',
  'La tortuga charapa es la más grande de los ríos amazónicos.': 'The giant river turtle is the largest turtle in Amazon rivers.',
  'Las alas de la mariposa morfo son azules por su estructura microscópica, no por un pigmento.': 'Morpho butterfly wings are blue because of their microscopic structure, not a pigment.',
  'El bosque seco tropical es uno de los ecosistemas más amenazados de Colombia.': 'Tropical dry forest is one of the most threatened ecosystems in Colombia.',
  'Los manglares protegen las orillas y son criaderos de peces, cangrejos y aves.': 'Mangroves protect shorelines and are nurseries for fish, crabs and birds.',
  'Los bosques amazónicos guardan enormes cantidades de carbono: talarlos acelera el cambio climático.': 'Amazon forests store huge amounts of carbon: cutting them speeds up climate change.',
  'La ganadería extensiva es una de las principales causas de deforestación en la Amazonía.': 'Extensive cattle ranching is one of the main causes of deforestation in the Amazon.',
  'El jaguar es el felino más grande de América y necesita grandes extensiones de bosque continuo.': 'The jaguar is the largest cat in the Americas and needs large areas of unbroken forest.',
  'Una astilladora convierte un árbol entero en virutas en pocos minutos.': 'A wood chipper turns a whole tree into chips in a few minutes.',
  'Los ríos amazónicos cambian de nivel varios metros entre la época seca y la de lluvias.': 'Amazon rivers rise and fall several meters between the dry and rainy seasons.',
  // PyCon
  'Keynote de apertura': 'Opening keynote',
  'Ciencia abierta y datos ambientales': 'Open science and environmental data',
  'Keynote · Viernes 14 jul · 08:30': 'Keynote · Friday Jul 14 · 08:30',
  'Python para cuidar la Amazonía': 'Python to protect the Amazon',
  'Cómo los datos abiertos, las imágenes satelitales y un puñado de scripts de Python ayudan a detectar la deforestación casi en tiempo real.':
    'How open data, satellite images and a handful of Python scripts help detect deforestation in near real time.',
  'Auditorio Fundadores': 'Founders Auditorium',
  Ciencia: 'Science',
  'Tú frenaste a DEFORESTA S.A. en la mesa; ella lo hace con datos.': 'You stopped DEFORESTA S.A. on the table; she does it with data.',
  'La sede': 'The venue',
  'Universidad EAFIT': 'EAFIT University',
  'Medellín · 14 al 16 de julio de 2028': 'Medellín · July 14–16, 2028',
  'Un campus que es un bosque': 'A campus that is a forest',
  'Más de 500 especies de plantas': 'More than 500 plant species',
  'El campus de EAFIT recibe a la comunidad Python durante los tres días de la conferencia, entre auditorios, laboratorios y zonas verdes.':
    'The EAFIT campus hosts the Python community for the three days of the conference, among auditoriums, labs and green areas.',
  '3 días': '3 days',
  'Las plantas que defendiste también tienen casa en PyCon.': 'The plants you defended also have a home at PyCon.',
  Keynote: 'Keynote',
  'Mantenedor open source': 'Open source maintainer',
  'Keynote · Sábado 15 jul · 09:00': 'Keynote · Saturday Jul 15 · 09:00',
  'El open source que sostiene al mundo': 'The open source that holds up the world',
  'Lo que nadie ve detrás de las bibliotecas que usamos todos los días, y cómo cuidarlas entre todos.':
    'What nobody sees behind the libraries we use every day, and how to look after them together.',
  Comunidad: 'Community',
  'Como la selva, el open source se sostiene si lo cuidamos entre todos.': 'Like the rainforest, open source survives if we all look after it.',
  'Keynote de cierre': 'Closing keynote',
  'Educación y comunidad': 'Education and community',
  'Keynote · Domingo 16 jul · 09:00': 'Keynote · Sunday Jul 16 · 09:00',
  'Enseñar Python en el colegio público': 'Teaching Python in public schools',
  'Lo que aprendimos enseñando a programar a miles de estudiantes, y lo que aún nos falta.':
    'What we learned teaching thousands of students to code, and what is still missing.',
  Educación: 'Education',
  'Aprender jugando también es aprender: ¡sigue al último nivel!': 'Learning by playing is still learning: on to the last level!',
  '¡Salvaste la selva!': 'You saved the rainforest!',
  'Nos vemos en PyCon Colombia 2028': 'See you at PyCon Colombia 2028',
  'Universidad EAFIT · Medellín': 'EAFIT University · Medellín',
  '¿Qué es PyCon?': 'What is PyCon?',
  'La conferencia anual de la comunidad Python en Colombia': 'The annual conference of the Python community in Colombia',
  '3 días de charlas, talleres y keynotes para aprender, compartir y conectar. Sin ánimo de lucro, hecha por voluntarios y abierta a todos los niveles.':
    '3 days of talks, workshops and keynotes to learn, share and connect. Non-profit, run by volunteers and open to every level.',
  '14 – 16 jul 2028': 'Jul 14 – 16, 2028',
  'Todos los niveles': 'All levels',
};
