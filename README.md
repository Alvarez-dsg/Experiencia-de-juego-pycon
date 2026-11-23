# Amazonas vs Leñadores 🌿🪓

Experiencia de **realidad aumentada para Meta Quest** que corre en el navegador (WebXR) y extiende la página
interactiva de **PyCon Colombia 2028**. Las gafas detectan una mesa, sobre ella **brota un tablero tipo diorama** y
el usuario elige un equipo de 5 plantas y animales amazónicos para proteger el **Mangle madre**, en el centro de una
isla, de los leñadores y máquinas de la empresa ficticia **DEFORESTA S.A.**, que cruzan el río desde todos lados.
Cada nivel ganado muestra una tarjeta de PyCon Colombia 2028 (ponentes, sede y evento).

```
 [ Nivel · vida del Mangle madre · avance ]
 bandeja: atril a la izquierda del tablero (agua, 5 cartas, pala, pausa, empujar)

   orilla talada · tocones · DEFORESTA S.A.   ← de aquí salen los invasores (toda la orilla)
   ~~~~~~~~ río: orilla bajita · centro hondo ~~~~~~~~   ← la corriente trae gotas de agua
        arena (no se planta)
          tierra verde (casillas)  ★ Mangle madre ★  tierra verde
        arena
   ~~~~~~~~ río ~~~~~~~~
   orilla de selva (la del usuario)
```

## Qué incluye

- **Estética de PyCon Colombia 2028** en toda la experiencia: colores crema/naranja/verde de la página, tipografía
  Poppins, “cejas” en mayúsculas, botones de píldora, logo de Python y el degradado de atardecer.
- **Pantalla de selección de equipo**: las 11 cartas del juego; el usuario elige exactamente **5**. Al acercar la
  mano (o el mouse) a una carta, la **carta de habilidad** grande muestra el modelo 3D, el tipo, la habilidad y las
  estadísticas (costo, vida y su dato clave). La pala siempre va en la bandeja.
- **Tablero radial**: los invasores salen de cualquier punto de la orilla talada y caminan hacia el Mangle madre.
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
- Todo es **procedural** (modelos hechos con código, sonidos sintetizados). Las únicas imágenes son la portada y las
  fotos de los ponentes en `public/pycon/`, tomadas del proyecto de la página.

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

Requiere [Node.js](https://nodejs.org) 18 o superior.

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

Con el servidor de desarrollo puedes emular unas Quest 3 con manos usando el runtime oficial de Meta (IWER):

- <http://localhost:5174/?emular> → gafas + manos emuladas (usa “Colocar frente a mí”).
- <http://localhost:5174/?emular=sala> → además carga una oficina sintética con escritorio: el tablero se coloca
  solo sobre el escritorio.

## Probar en las Meta Quest

WebXR exige **HTTPS** (o `localhost`). Tres opciones:

**A. Por Wi-Fi (rápido para desarrollar).** PC y Quest en la misma red:

```bash
npm run dev
```

La consola muestra algo como `https://192.168.1.50:5173`. Ábrelo en el **navegador de Meta Quest**, acepta la
advertencia del certificado (*Avanzado → Continuar*) y pulsa **“Entrar en realidad aumentada”**.

> Las redes Wi-Fi de universidades, oficinas y lugares públicos suelen **aislar los dispositivos** entre sí: la
> Quest no llega al PC y la página se queda cargando. En ese caso usa la opción **C** (publicarlo).
>
> En Windows, si PowerShell dice que “la ejecución de scripts está deshabilitada”, escribe `npm.cmd` en vez de
> `npm` (por ejemplo `npm.cmd run dev`).

**B. Por USB** (sin advertencia de certificado), con el modo desarrollador activado:

```bash
adb reverse tcp:5174 tcp:5174
```

Luego `npm run dev:http` y en la Quest abre `http://localhost:5174`.

**C. Publicarlo** (para presentar o compartir):

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

## Estructura del código

| Archivo | Qué hace |
| --- | --- |
| `src/config.js` | **Todo lo ajustable**: tablero, isla, defensores, habilidades, equipo, invasores, economía, gestos |
| `src/levels.js` | Tutorial y 5 niveles: oleadas radiales, multiplicadores de vida y velocidad, anuncios |
| `src/tutorial.js` | Pasos del tutorial (cada uno espera a que el jugador lo cumpla) |
| `src/terrain.js` | Geografía: orillas, río (profundidad), isla (arena / tierra), casillas plantables |
| `src/main.js` | Arranque, sesión WebXR, colocación del tablero, bucle principal, modo escritorio |
| `src/planes.js` | Detección de mesas (Plane Detection), hit-test y cálculo de posición/giro/escala |
| `src/input.js` | Manos (pellizco con histéresis), controles y mouse unificados |
| `src/interaction.js` | Arrastrar cartas, lanzar el jabillo, manotazo, tocar gotas y botones |
| `src/game.js` | Lógica: defensores, invasores radiales, proyectiles, granadas, empujón, agua, Mangle madre, victoria/derrota |
| `src/board.js`, `src/scenery.js` | Diorama: terreno, río animado, isla, decoración, empresa, Mangle madre, efecto de brote |
| `src/models.js`, `src/animals.js`, `src/invaders.js` | Modelos procedurales en estilo caricatura (material por bandas + contorno) |
| `src/defenders.js` | Arma cada defensor (partes animadas) |
| `src/cards.js` | Cartas de semilla y carta de habilidad (composición tipo carta coleccionable) |
| `src/select.js` | Pantalla de selección del equipo de 5 |
| `src/pycon.js` | Tarjetas de PyCon Colombia 2028 entre niveles |
| `src/tray.js` | Bandeja: agua, cartas del equipo, pala, pausa, manotazo, vida del Mangle madre y avance |
| `src/hud.js`, `src/ui3d.js` | Paneles, botones, anuncios y elementos de marca de PyCon en el mundo 3D |
| `src/particles.js`, `src/audio.js` | Partículas y efectos de sonido sintetizados |

### Ajustes rápidos

- La bandeja es un atril a la izquierda del tablero, cerca del usuario. Se mueve con `TRAY` en `config.js` (`fromFront`, `gap`, `height`, `tilt`, `yaw`); `side: 'back'` la pone detrás del tablero.
- ¿Muy difícil o muy fácil? Ajusta `hpMul`/`speedMul` y las oleadas en `levels.js`, los costos en `PLANTS`,
  `HP0` y `TIER` (vida de cada invasor), `ISLAND.heartHp` (vida del Mangle madre) y `ECONOMY` (gotas del río).
- ¿Equipos de otro tamaño? Cambia `TEAM.size` y `TEAM.default` en `config.js`.
- ¿El manotazo cuesta mucho o se dispara solo? Ajusta `HAND.push.speed` (velocidad mínima) y `HAND.push.height`.
- ¿Casillas pequeñas para tus dedos? Sube `BOARD.cell` (el tablero se escala solo para caber en la mesa).
- ¿La isla más grande o el río más ancho? Cambia `ISLAND` y `LAYOUT.bankZ`/`frontZ` en `config.js`.

## Limitaciones conocidas

- En RA el contenido virtual se dibuja encima de las manos reales; por eso se muestran manos virtuales
  semitransparentes y puntos en las yemas.
- La detección de mesas depende de la configuración del espacio de la Quest.
- Probado en el navegador de escritorio (tutorial, selección, niveles, tarjetas PyCon, granada y empujón con el
  mouse; el balance se revisó simulando los 5 niveles). El lanzamiento con la mano y el manotazo solo se pueden validar en unas Quest reales o con el emulador.
