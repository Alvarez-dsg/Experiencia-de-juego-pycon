# Amazonas vs Leñadores 🌿🪓

Experiencia de **realidad aumentada para Meta Quest** que corre en el navegador (WebXR) y extiende la página
interactiva de **PyCon Colombia 2028**. Las gafas detectan una mesa, sobre ella **brota un tablero tipo diorama** y
el usuario elige un equipo de 5 plantas y animales amazónicos para proteger el **corazón de la isla** (una pradera
tupida en su centro) de los leñadores y máquinas de la empresa ficticia **DEFORESTA S.A.**, que cruzan el río desde todos lados.
Cada nivel ganado muestra una tarjeta de PyCon Colombia 2028 (ponentes, sede y evento). Todo está en **español e
inglés** (se elige en la pantalla de inicio).

```
 [ Nivel · vida de la isla · avance ]
 bandeja: una sola línea vertical de pie en la esquina izquierda (pausa/empujar, agua, 5 cartas, pala)

   orilla talada · tocones · DEFORESTA S.A.   ← de aquí salen los invasores (toda la orilla)
   ~~~~~~~~ río: orilla bajita · centro hondo ~~~~~~~~   ← la corriente trae gotas de agua
        arena (no se planta)
          tierra verde (2 filas en el nivel 1, +1 por nivel)  ★ pradera ★  tierra verde
        arena
   ~~~~~~~~ río ~~~~~~~~
   orilla de selva (la del usuario)
```

## Qué incluye

- **Animales e invasores modelados en Blender** con el mismo estilo de juguete liso con contorno de tinta
  (`blender/estilo.py`): `blender/animales.py` (rana dardo, chigüiro, anaconda, mono, tortuga y su caparazón,
  guacamaya y mariposa morfo sobre su matica) y `blender/invasores.py` (leñador independiente, profesional y
  motosierrista, por piezas para animarlos, y excavadora, bulldozer, astilladora y desbrozadora, 1,35 veces más
  grandes). Vistas previas en `blender/render.png`, `render_invasores.png` y `render_maquinas.png`. Se ejecutan dentro
  de Blender (conexión MCP o `blender -b --python ...`) y `export_glb` los pasa a `public/models/animales.glb` e
  `invasores.glb`; el alfa del color dice qué partes llevan contorno. En el juego el **sombreado de caricatura** es el
  mismo de Blender (`CEL` en `src/models.js`): dos tonos con corte limpio, sombra que corre el tono del color y un brillo
  pequeño donde mira el sol.
- **Vegetación y río de la landing de PyCon 2028**: `blender/vegetacion.py` extrae pasto, helechos, heliconias, árboles grandes y frondosos (la orilla de selva del usuario),
  bromelias, musgo, victorias amazónicas, camalotes, raíces de mangle, palmas y cecropias del recorrido 3D de la página
  (`recorrido-amazonas.glb`) a `public/models/vegetacion.glb`. El río usa el mapa de normales del agua de la página
  (`public/tex/agua_n.jpg`).
- **Pantallas según los wireframes**: inicio con el chigüiro constructor (casco y llave), **Ver tutorial / Jugar** y
  **Español / English**; selección con un **tablero grande de todos los personajes** y una **franja delgada con los
  5 elegidos**; **cartas mínimas** (arte grande, nombre y lo que hace en dos o tres palabras); bandeja de juego en
  **una sola línea**; y tarjetas entre niveles con **Salir / Siguiente nivel** que siguen mostrando PyCon 2028.
- **Filas que se abren por nivel**: 2 filas para plantar en el nivel 1 (y el tutorial), 3 en el nivel 2 y las 4
  desde el nivel 3 (`rows` en `levels.js`). Los invasores tienen más vida (`HP0` = 150 y `hpMul` de 1,15 a 1,4).
- **Dos gestos para empujar**: barrer con la mano abierta o **pellizcar índice y pulgar y soltar el índice** como
  un tirito (el empujón cae donde apunta el dedo).
- **Estética de PyCon Colombia 2028** en toda la experiencia: colores crema/naranja/verde de la página, tipografía
  Poppins, “cejas” en mayúsculas, botones de píldora, logo de Python y el degradado de atardecer.
- **Pantalla de selección de equipo**: las 11 cartas del juego; el usuario elige exactamente **5**. Al acercar la
  mano (o el mouse) a una carta, la **carta de habilidad** grande muestra el modelo 3D, el tipo, la habilidad y las
  estadísticas (costo, vida y su dato clave). La pala siempre va en la bandeja.
- **Tablero radial**: los invasores salen de cualquier punto de la orilla talada y caminan hacia el centro de la isla.
  Cruzan el río: en la orilla el agua es bajita y en el centro es **honda** (franja oscura); mientras van por lo hondo,
  **los ataques a distancia no los alcanzan** (rana, guacamaya y mono). La tortuga nada, la anaconda los atrapa
  donde sea y el jabillo explota también en el agua.
- **Economía de agua**: la corriente del río arrastra **gotas de agua**; tócalas antes de que se las lleve. La
  heliconia también deja caer rocío. Solo se planta en la **tierra verde** de la isla (no en la arena).
- **Tutorial** corto con pasos guiados (tocar una gota, plantar, lo hondo del río, manotazo, jabillo) y **5 niveles**
  que van presentando los 7 invasores. Al ganar un nivel aparece una **tarjeta de PyCon Colombia 2028**.
- **Interacción con las manos**: pellizcar una carta → arrastrar → soltar en la casilla. El **jabillo se lanza como
  una granada** y un **manotazo** (mano abierta, rápida, en cualquier dirección) aleja y aturde a los invasores.
- **Estilo caricatura**: formas redondas, colores planos, sombreado por bandas y **contorno negro**.
- **Portada** con una ilustración propia (`public/portada.svg`): la selva en caos y el chigüiro en primer plano.
- **Detección de mesas** con *WebXR Plane Detection* (prefiere superficies marcadas como mesa) y respaldo con
  hit-test y el botón **“Colocar frente a mí”**.
- **Modo navegador** (mouse) para probar y presentar en el PC.
- Sonidos sintetizados. Invasores, empresa y paneles se hacen con código; los animales vienen de Blender y la
  vegetación de la landing (si los GLB no cargan, el juego usa los modelos hechos con código de respaldo).

### Defensores

Cada gota de agua vale 25. Las distancias están en casillas.

| Defensor | Tipo | Habilidad | Costo | Vida |
| --- | --- | --- | --- | --- |
| **Heliconia** | Planta · productora | Cada 18 s deja caer una gota de agua | 25 | 300 |
| **Achiote** | Planta · barrera | No bloquea: frena a quien la cruza y le hace daño poco a poco (14/s) | 50 | 400 |
| **Rana dardo** | Animal · tiradora | Escupe veneno (25) al invasor más cercano y lo frena | 75 | 300 |
| **Ceiba** | Planta · muro | Aguanta muchísimo | 50 | 4000 |
| **Mariposa morfo** | Animal · sanadora | Con cada aleteo cura +25 a los aliados de alrededor | 50 | 200 |
| **Chigüiro** | Animal · mordedor | Muerde (45) a los invasores que se le acercan, en cualquier dirección | 75 | 1400 |
| **Mono capuchino** | Animal · saltador | Salta sobre el invasor más cercano, golpea (75) y vuelve | 100 | 300 |
| **Guacamaya** | Animal · tiradora triple | Tres semillas en abanico (25 × 3) | 125 | 300 |
| **Tortuga charapa** | Animal · nadadora | Rueda o nada hacia los invasores (también por lo hondo) y golpea en área (150) | 100 | 600 |
| **Anaconda** | Animal · trampa | Se traga a las personas; a las máquinas las aprieta (1500) y las detiene | 125 | 300 |
| **Jabillo** | Planta · granada | Se lanza con la mano; explota en área (2500), también en el agua | 100 | — |
| Pala | — | Quitar un defensor | — | — |

### Invasores

La vida sube de forma exponencial: cada persona aguanta el **doble** que la anterior, la primera máquina el
**triple** que la última persona y cada máquina el **doble** que la anterior.

| Invasor | Vida base | Nota |
| --- | --- | --- |
| **Leñador independiente** | 100 | Ropa civil, sin casco, con hacha |
| **Leñador profesional** | 200 | Uniforme reflectivo y casco blanco |
| **Motosierrista** | 400 | Casco amarillo y protectores; corta rápido |
| **Excavadora** | 1200 | Cava con el brazo |
| **Bulldócer** | 2400 | Pala curva |
| **Astilladora** | 4800 | Escupe astillas |
| **Desbrozadora** | 9600 | Tambor de dientes que gira |

Las máquinas aplastan el achiote y resisten el manotazo. Si alguno llega al centro ataca el **Mangle madre**
(3000 de vida, barra sobre el árbol); si cae, se pierde el nivel.

### Niveles y tarjetas PyCon

| Nivel | Nombre | Vida × | Invasores nuevos | Tarjeta al ganarlo |
| --- | --- | --- | --- | --- |
| 0 | Tutorial | 1 | Independiente y profesional | — (pasa a elegir equipo del nivel 1) |
| 1 | La primera tala | 1 | Independiente, profesional | Keynote de apertura |
| 2 | Llegan las motosierras | 1,05 | Motosierrista | La sede (Universidad EAFIT) |
| 3 | Las máquinas | 1,1 | Excavadora | Keynote |
| 4 | Fiebre de madera | 1,15 | Bulldócer, astilladora | Keynote de cierre |
| 5 | La gran tala | 1,2 | Desbrozadora | ¿Qué es PyCon? (final) |

## Ejecutar en el PC

Requiere [Node.js](https://nodejs.org) 20.19 o superior.

```bash
npm install
```

```bash
npm run dev:http
```

Abre <http://localhost:5174> y pulsa **“Probar en el navegador”**.
Clic: arrastrar cartas, tocar las gotas y hacer clic en un invasor para empujarlo · Clic derecho: girar · Rueda: acercar.

- `?nivel=3` deja listo el nivel 3 (útil para presentar o probar); el tutorial se empieza desde el panel inicial.
- En la consola, `__amz` da acceso al juego; `__amz.tick(60)` avanza un segundo aunque la pestaña esté en segundo plano.

### Emulador de Quest en el PC (opcional)

Con `npm run dev` (o `dev:http`) en `localhost`, el plugin de IWSDK inyecta el emulador oficial de Meta (IWER):
unas Quest 3 dentro de una oficina sintética (`home_office`, en `iwsdk.config.json` → `dev.emulator`). Pulsa
**“Entrar en RA”**: el tablero se coloca solo sobre el escritorio de la oficina. La barra superior del emulador
cambia entre controles y manos.

## Probar en las Meta Quest

WebXR exige **HTTPS** (o `localhost`). Cuatro opciones:

**A. Por Wi-Fi (rápido para desarrollar).** PC y Quest en la misma red:

```bash
npm run dev
```

La consola muestra algo como `https://192.168.1.50:5173`. Ábrelo en el **navegador de Meta Quest**, acepta la
advertencia del certificado (*Avanzado → Continuar*) y pulsa **“Entrar en realidad aumentada”**.

> Las redes Wi-Fi de universidades, oficinas y lugares públicos suelen **aislar los dispositivos** entre sí: la
> Quest no llega al PC y la página se queda cargando. En ese caso usa la opción **C** (GitHub Pages) o **D**.
>
> En Windows, si PowerShell dice que “la ejecución de scripts está deshabilitada”, escribe `npm.cmd` en vez de
> `npm` (por ejemplo `npm.cmd run dev`).

**B. Por USB** (sin advertencia de certificado), con el modo desarrollador activado:

```bash
adb reverse tcp:5174 tcp:5174
```

Luego `npm run dev:http` y en la Quest abre `http://localhost:5174`.

**C. GitHub Pages** (se publica solo en cada `git push`): el flujo `.github/workflows/deploy.yml` compila y
publica el juego en <https://alvarez-dsg.github.io/Experiencia-de-juego-pycon/>. La primera vez hay que activar
*Settings → Pages → Source: GitHub Actions* en el repositorio. El avance se ve en la pestaña **Actions**.

**D. Publicarlo a mano** (para presentar o compartir):

```bash
npm run build
```

Sube la carpeta `dist/` a Netlify Drop, GitHub Pages o Vercel (todas dan HTTPS). Lo más rápido: abre
<https://app.netlify.com/drop> en el PC, arrastra la carpeta `dist` a la página y abre en la Quest el enlace
`https://….netlify.app` que te da. Funciona desde cualquier red. Cada vez que cambies el código, vuelve a ejecutar
`npm run build` y sube de nuevo la carpeta.

### Antes de jugar en la Quest

1. **Configuración del espacio**: *Configuración → Entorno físico → Configuración del espacio*. Escanea la
   habitación y **marca tu mesa como “Mesa”**. Sin esto las gafas no comparten superficies con el navegador
   (igual puedes usar “Colocar frente a mí”).
2. **Seguimiento de manos** activado (*Configuración → Movimiento → Seguimiento de manos y cuerpo*).
3. La primera vez el navegador pide permiso para usar los **datos espaciales**: acéptalo.

### Cómo se juega

| Acción | Manos | Controles | Mouse |
| --- | --- | --- | --- |
| Elegir el equipo | Toca o pellizca 5 cartas; acerca la mano para leer la habilidad | Gatillo | Clic; pasa el mouse para leer |
| Tomar un defensor | Pellizca la carta de la bandeja | Gatillo sobre la carta | Clic y arrastrar |
| Plantar | Suelta el pellizco sobre una casilla de tierra verde | Suelta el gatillo | Suelta el clic |
| Lanzar el jabillo | Pellízcalo y lánzalo como una granada (suelta en movimiento) | Mueve y suelta el gatillo | Arrástralo y suéltalo donde marca el anillo naranja |
| Empujar invasores | Pasa la mano abierta sobre ellos, bajita y rápido | — | Clic sobre un invasor |
| Recoger agua | Toca la gota del río con el índice (o pellízcala) | Gatillo | Clic |
| Botones | Tócalos con el índice o pellízcalos | Gatillo | Clic |
| Pausa / recolocar / salir | Botón ❚❚ de la bandeja | ❚❚ | ❚❚ |

## Immersive Web SDK (IWSDK)

El proyecto se creó con el instalador oficial (`npm create @iwsdk@latest`, plantilla AR) y usa **`@iwsdk/core` 1.1.0**
(Three.js r185 y ECS EliCS). La configuración está en [`iwsdk.config.json`](iwsdk.config.json) con
`"mode": "ar"`, espacio `local-floor` y las funciones de la sesión (manos, detección de planos, hit-test, anclas).
`World.create()` crea el renderer, la escena, la cámara, la sesión de RA (`world.launchXR()`) y el bucle; el juego
corre dentro de ese bucle como un sistema del ECS (`GameSystem` en `src/main.js`).

| Sistema de IWSDK | ¿Se usa? | Dónde y para qué |
| --- | --- | --- |
| **Spatial UI (UIKitML)** | Sí | `public/ui/rendimiento.uikitml` (kit Horizon), cargado como asset en `src/iwsdk/assets.js`: panel de rendimiento con FPS, draw calls y triángulos detrás del tablero, más un botón para encender/apagar las sombras. |
| **Scene Understanding** | Sí | `SceneSystem` (`src/main.js`) consulta las entidades `XRPlane`; `src/planes.js` las clasifica para encontrar la mesa (altura, tamaño, etiqueta) y coloca el tablero. |
| **Environment Raycast** | Sí | Una entidad con `EnvironmentRaycastTarget` (espacio de la cabeza) da el punto de respaldo (anillo amarillo) cuando las gafas no comparten planos. |
| **Interacciones integradas** (Ray/Poke) | Sí | El panel UIKitML lleva `RayInteractable` y `PokeInteractable`: su botón se usa con el rayo del control, tocándolo con el dedo o con clic en el navegador (`canvasPointerEvents`). |
| **Input (XRInputManager)** | Sí | IWSDK gestiona controles y manos; sus manos virtuales se apagan porque en RA se ven las reales y el juego dibuja sus propios cursores. |
| Physics | No | Los proyectiles, la granada y el empujón son balísticos y sencillos; un motor de física añadiría costo en la Quest sin cambiar el juego. |
| Grabbing | No | Arrastrar cartas y lanzar el jabillo usa un pellizco propio con histéresis, ajustado al tamaño del tablero. |
| Locomotion | No | El jugador está de pie frente a su mesa; moverse por la escena no tiene sentido en RA. |
| Depth Occlusion | No | La oclusión por profundidad cuesta rendimiento en la Quest y el tablero se ve de cerca, encima de la mesa. |
| Camera Access | No | El juego no necesita leer la imagen de la cámara. |
| Audio espacial | No | Los efectos son sonidos sintetizados cortos (Web Audio), no ligados a un punto del espacio. |

## Estructura del código

| Archivo | Qué hace |
| --- | --- |
| `src/config.js` | **Todo lo ajustable**: tablero, isla, defensores, habilidades, equipo, invasores, economía, gestos |
| `src/levels.js` | Tutorial y 5 niveles: oleadas radiales, multiplicadores de vida y velocidad, anuncios |
| `src/tutorial.js` | Pasos del tutorial (cada uno espera a que el jugador lo cumpla) |
| `src/terrain.js` | Geografía: orillas, río (profundidad), isla (arena / tierra), casillas plantables |
| `src/main.js` | Mundo de IWSDK, sistemas (juego, planos/raycast), panel de rendimiento, colocación del tablero, modo escritorio |
| `iwsdk.config.json`, `src/iwsdk/` | Configuración del proyecto IWSDK (modo `ar`, funciones XR) y catálogo de assets (panel UIKitML) |
| `src/planes.js` | Detección de mesas (planos de Scene Understanding), respaldo con Environment Raycast y cálculo de posición/giro/escala |
| `src/input.js` | Manos (pellizco con histéresis), controles y mouse unificados |
| `src/interaction.js` | Arrastrar cartas, lanzar el jabillo, manotazo, tocar gotas y botones |
| `src/game.js` | Lógica: defensores, invasores radiales, proyectiles, granadas, empujón, agua, filas abiertas, vida de la isla, victoria/derrota |
| `src/board.js`, `src/scenery.js` | Diorama: terreno, río con la textura de la landing, isla con pasto, vegetación, empresa, pradera central, efecto de brote |
| `src/assets.js` | Carga `animales.glb` y `vegetacion.glb` |
| `src/i18n.js` | Español / inglés (`tr()` traduce los textos escritos en español) |
| `src/screens.js` | Pantalla de inicio del wireframe y dibujo del chigüiro constructor |
| `src/models.js`, `src/animals.js`, `src/invaders.js` | Modelos procedurales en estilo caricatura (material por bandas + contorno) |
| `src/defenders.js` | Arma cada defensor (partes animadas) |
| `src/cards.js` | Cartas de semilla y carta de habilidad (composición tipo carta coleccionable) |
| `src/select.js` | Pantalla de selección del equipo de 5 |
| `src/pycon.js` | Tarjetas de PyCon Colombia 2028 entre niveles |
| `src/tray.js` | Bandeja en una sola línea: pausa, empujar, agua, cartas del equipo, pala, vida de la isla y avance |
| `src/hud.js`, `src/ui3d.js` | Paneles, botones, anuncios y elementos de marca de PyCon en el mundo 3D |
| `src/particles.js`, `src/audio.js` | Partículas y efectos de sonido sintetizados |

### Ajustes rápidos

- La bandeja es una línea vertical de pie en la esquina izquierda cercana. Se ajusta con `TRAY` en `config.js` (`fromFront`, `gap`, `tilt`, `yaw`, `scale`); `side: 'left'` vuelve al atril de dos columnas y `'front'` la pone en una fila delante del tablero.
- ¿Muy difícil o muy fácil? Ajusta `hpMul`/`speedMul` y las oleadas en `levels.js`, los costos en `PLANTS`,
  `HP0` y `TIER` (vida de cada invasor), `ISLAND.heartHp` (vida de la isla), `rows` (filas abiertas) y `ECONOMY` (gotas del río).
- ¿Equipos de otro tamaño? Cambia `TEAM.size` y `TEAM.default` en `config.js`.
- ¿El manotazo cuesta mucho o se dispara solo? Ajusta `HAND.push.speed` (velocidad mínima) y `HAND.push.height`.
- ¿Casillas pequeñas para tus dedos? Sube `BOARD.cell` (el tablero se escala solo para caber en la mesa).
- ¿La isla más grande o el río más ancho? Cambia `ISLAND` y `LAYOUT.bankZ`/`frontZ` en `config.js`.

## Limitaciones conocidas

- En RA el contenido virtual se dibuja encima de las manos reales; por eso se muestran manos virtuales
  semitransparentes y puntos en las yemas.
- La detección de mesas depende de la configuración del espacio de la Quest.
- Probado en el navegador de escritorio (tutorial, selección, niveles, tarjetas PyCon, granada y empujón con el
  mouse; el balance se revisó simulando los 5 niveles: del 1 al 4 se ganan; el 5 es una pelea final larga). El
  lanzamiento con la mano, el manotazo y el tirito con el índice solo se pueden validar en unas Quest reales.
