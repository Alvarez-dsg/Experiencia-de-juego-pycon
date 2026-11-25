# Amazonas vs Leñadores — animales defensores, estilo liso de juguete con contorno de tinta.
#
# Se ejecuta dentro de Blender (por la conexión MCP o con: blender -b --python blender/animales.py).
# Crea (o rehace) la escena "Animales" con cada animal como un objeto de pocas caras:
#   · formas simples y lisas (elipsoides y tubos continuos, sombreado suave), colores planos por vértice
#     tomados de los bocetos (los detalles como manchas o caparazón son piezas aparte, no ruido);
#   · contorno de tinta: casco invertido (modificador Solidify con normales giradas + material "Tinta" con
#     backface culling). El grupo de vértices "Tinta" decide qué piezas llevan contorno (los brillos de los
#     ojos y las antenas no). El modificador NO se exporta: en el juego el contorno lo dibuja el shader;
#   · material toon (3 bandas de luz) para que la vista en Blender se parezca al juego.
#
# Unidades = casillas del tablero (1 casilla = 6,8 cm). Se modela en coordenadas de three.js
# (x = hacia los invasores, y = arriba, z = hacia el usuario) y se pasa a Blender (z arriba).
# export_glb(ruta) los exporta en su origen para public/models/animales.glb (solo cuando se aprueben).
import bpy, bmesh, math, os, sys, importlib
from mathutils import Vector, Matrix, Euler

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.getcwd()
sys.path.insert(0, HERE)
import estilo
importlib.reload(estilo)
from estilo import V, Model, spots_ring, export_glb, build_scene

models = []

# ───────────── RANA DARDO: delgada y erguida (como Dendrobates tinctorius), naranja con bandas negras,
#               antifaz negro, garganta y patas azules ─────────────
m = Model('rana')
OR, BL, BK = '#f39a1e', '#1f5fd8', '#18130f'
BODY = ((-0.03, 0.17, 0), (0.34, 0.19, 0.2), (0, 0, 0.65))  # cuerpo largo e inclinado hacia arriba
HEAD = ((0.13, 0.285, 0), (0.19, 0.13, 0.17), (0, 0, 0.2))
AX = (math.cos(0.65), math.sin(0.65), 0)
m.ell(OR, *BODY)
m.ell(OR, *HEAD)
m.ell(OR, (0.205, 0.275, 0), (0.1, 0.075, 0.105), (0, 0, 0.05))  # hocico en punta
m.ell(BL, (0.13, 0.235, 0), (0.13, 0.06, 0.13), (0, 0, 0.3))  # garganta azul
m.spot(BK, *BODY, (0.55, 1, 0), (0.08, 0.05), along=AX)  # mancha de la espalda
m.spot(BK, *HEAD, (-0.2, 1, 0), (0.07, 0.045), along=(1, 0, 0))  # mancha de la cabeza
for s in (1, -1):
    m.spot(BK, *BODY, (0.05, 0.7, 0.75 * s), (0.22, 0.045), along=AX)  # banda larga del costado
    m.spot(BK, *BODY, (-0.75, 0.55, 0.45 * s), (0.07, 0.04), along=AX)  # mancha de la cadera
    m.spot(BK, *HEAD, (0.2, 0.05, s), (0.13, 0.06), along=(1, -0.15, 0))  # antifaz (del ojo hacia el hocico)
    m.eye((0.158, 0.3, 0.072 * s), 0.024, (0.4, 0.25, 0.9 * s))
    # pata trasera doblada
    m.ell(BL, (-0.1, 0.08, 0.085 * s), (0.19, 0.1, 0.075), (0, 0.25 * s, 0.55))
    m.ell(BL, (-0.04, 0.035, 0.105 * s), (0.17, 0.05, 0.055), (0, 0.15 * s, -0.1))
    # pata delantera larga y recta
    m.tube(BL, [(0.08, 0.2, 0.07 * s), (0.12, 0.11, 0.08 * s), (0.14, 0.02, 0.085 * s)], 0.021, 0.015, seg=8)
    for a, ends in (((0.14, 0.012, 0.085 * s), [(0.19, 0.01, 0.085 * s + i * 0.03) for i in (-1, 0, 1)] + [(0.1, 0.01, 0.11 * s)]),
                    ((0.03, 0.012, 0.11 * s), [(0.085, 0.01, 0.11 * s + i * 0.03) for i in (-1, 0, 1)])):
        for b in ends:  # dedos finos con ventosa
            m.tube(BL, [a, b], 0.0065, 0.006, seg=5, cap0=False, cap1=False, ink=False)
            m.ell(BL, b, (0.02, 0.013, 0.02), seg=(8, 6), ink=False)
m.tube('#5a2a10', [(0.232, 0.256, -0.045), (0.256, 0.26, 0), (0.232, 0.256, 0.045)], 0.004, seg=6, ink=False)  # boca
bmesh.ops.scale(m.bm, vec=(1.15, 1.15, 1.15), verts=m.bm.verts)  # al ser más delgada se agranda un poco para que se lea igual
models.append(m)

# ───────────── CHIGÜIRO: café, hocico oscuro, sentado ─────────────
m = Model('chiguiro')
FUR, DK, PAW, NOSE = '#7b4a26', '#4e2d17', '#3a2413', '#22150c'
m.ell(FUR, (-0.06, 0.17, 0), (0.44, 0.34, 0.38))  # ancas
m.ell(FUR, (0.05, 0.29, 0), (0.3, 0.38, 0.3), (0, 0, -0.35))  # pecho
m.ell(FUR, (0.16, 0.47, 0), (0.34, 0.24, 0.25), (0, 0, -0.12))  # cabeza
m.ell(DK, (0.29, 0.44, 0), (0.13, 0.18, 0.19))  # hocico
for s in (1, -1):
    m.tube(FUR, [(0.12, 0.26, 0.08 * s), (0.14, 0.04, 0.08 * s)], 0.045, 0.04)  # pata delantera
    m.ell(PAW, (0.16, 0.018, 0.08 * s), (0.09, 0.036, 0.075))
    m.ell(FUR, (-0.03, 0.07, 0.16 * s), (0.22, 0.12, 0.11))  # pata trasera doblada
    m.ell(PAW, (0.07, 0.018, 0.17 * s), (0.1, 0.036, 0.075))
    m.ell(FUR, (0.07, 0.6, 0.08 * s), (0.055, 0.07, 0.04), (0.4 * s, 0, 0))  # oreja
    m.ell(DK, (0.078, 0.6, 0.092 * s), (0.03, 0.045, 0.02), (0.4 * s, 0, 0), ink=False)
    m.eye((0.21, 0.53, 0.095 * s), 0.024, (0.5, 0.15, 0.9 * s))
    m.ell(NOSE, (0.345, 0.47, 0.032 * s), (0.02, 0.03, 0.018), seg=(8, 6), ink=False)  # fosas nasales
m.tube(NOSE, [(0.352, 0.405, -0.03), (0.356, 0.395, 0), (0.352, 0.405, 0.03)], 0.004, seg=6, ink=False)
models.append(m)

# ───────────── ANACONDA: verde oscuro con manchas claras, enroscada ─────────────
m = Model('anaconda')
G1, G2, G3 = '#2c6a1d', '#93d45c', '#1b4612'
pts, turns, N = [], 2.6, 24
for i in range(N + 1):
    t = i / N
    a = t * turns * math.pi * 2
    r = 0.21 - 0.12 * t
    pts.append((r * math.cos(a) - 0.03, 0.045 + 0.13 * t, r * math.sin(a)))
pts += [(0.02, 0.25, 0.0), (0.06, 0.34, 0.0), (0.12, 0.4, 0.0)]
rings = m.tube(G1, pts, 0.05, 0.036, seg=10, k=2)
spots_ring(m, rings[:-6], 4, (G2, G3), (0.055, 0.035), phase=2)
HD = ((0.17, 0.41, 0), (0.16, 0.075, 0.11), (0, 0, -0.1))
m.ell(G1, *HD)
m.spot(G2, *HD, (-0.3, 1, 0), (0.05, 0.03))
m.tube('#c81e3c', [(0.24, 0.4, 0), (0.3, 0.405, 0)], 0.0045, seg=6, ink=False)
for s in (1, -1):
    m.tube('#c81e3c', [(0.3, 0.405, 0), (0.325, 0.41, 0.012 * s)], 0.004, 0.003, seg=6, ink=False)
    m.eye((0.2, 0.43, 0.036 * s), 0.016, (0.4, 0.2, 0.9 * s))
models.append(m)

# ───────────── MONO: café, cara y barriga crema, brazo arriba, cola larga ─────────────
m = Model('mono')
MF, MC, MD = '#7a4b1c', '#f3d29b', '#4a2c10'
m.ell(MF, (0, 0.32, 0), (0.2, 0.27, 0.2))
m.ell(MC, (0.055, 0.31, 0), (0.1, 0.19, 0.14))  # barriga
m.ell(MF, (0, 0.54, 0), (0.26, 0.24, 0.25))  # cabeza
m.ell(MC, (0.075, 0.52, 0), (0.13, 0.18, 0.2))  # cara
m.ell(MC, (0.115, 0.47, 0), (0.08, 0.07, 0.11))  # hocico
for s in (1, -1):
    m.ell(MF, (0, 0.55, 0.135 * s), (0.05, 0.1, 0.06))  # oreja
    m.ell(MC, (0.012, 0.55, 0.15 * s), (0.03, 0.065, 0.03), ink=False)
    m.tube(MF, [(0, 0.23, 0.055 * s), (0.04, 0.12, 0.07 * s), (0.0, 0.045, 0.07 * s)], 0.032, 0.027)  # pierna
    m.ell(MD, (0.03, 0.018, 0.075 * s), (0.1, 0.036, 0.06))
    m.eye((0.125, 0.548, 0.046 * s), 0.022, (0.8, 0.1, 0.6 * s))
m.tube(MD, [(0.15, 0.455, -0.025), (0.157, 0.448, 0), (0.15, 0.455, 0.025)], 0.004, seg=6, ink=False)  # sonrisa
m.tube(MF, [(0.0, 0.42, 0.1), (0.04, 0.3, 0.12), (0.06, 0.2, 0.1)], 0.028, 0.024)  # brazo abajo
m.ell(MD, (0.065, 0.185, 0.1), (0.05, 0.05, 0.05))
m.tube(MF, [(0.0, 0.42, -0.1), (-0.01, 0.58, -0.16), (0.02, 0.67, -0.07)], 0.028, 0.024)  # brazo sobre la cabeza
m.ell(MD, (0.03, 0.665, -0.025), (0.05, 0.05, 0.05))
m.tube(MF, [(-0.06, 0.25, 0), (-0.17, 0.2, 0), (-0.27, 0.24, 0), (-0.31, 0.35, 0), (-0.27, 0.45, 0), (-0.19, 0.46, 0), (-0.17, 0.4, 0)],
       0.024, 0.016, seg=8)  # cola
models.append(m)

# ───────────── TORTUGA: caparazón verde con placas café, piel verde oscura ─────────────
TS, TSP, TK, TP = '#3f9d47', '#7a5426', '#24612b', '#93c96d'


def placas(m, c, s, r, up):
    m.spot(TSP, c, s, r, up, (0.13, 0.11))
    for i in range(6):
        a = i / 6 * math.tau + 0.3
        d = Vector(up) * 0.95 + (V(math.cos(a), 0, math.sin(a)) if up[1] else V(math.cos(a), math.sin(a), 0))
        m.spot(TSP, c, s, r, d, (0.1, 0.08), rot=a)


m = Model('tortuga')
SH = ((0, 0.19, 0), (0.5, 0.3, 0.42), (0, 0, 0))
m.ell(TS, *SH)
placas(m, *SH, (0, 1, 0))
m.ell(TP, (0, 0.12, 0), (0.54, 0.09, 0.46))  # borde del caparazón
for x, z in ((0.14, 0.15), (0.14, -0.15), (-0.14, 0.15), (-0.14, -0.15)):
    m.tube(TK, [(x, 0.12, z), (x * 1.15, 0.03, z * 1.15)], 0.05, 0.046)
    m.ell(TK, (x * 1.2, 0.014, z * 1.15), (0.1, 0.03, 0.09))
m.tube(TK, [(0.18, 0.15, 0), (0.27, 0.22, 0), (0.31, 0.32, 0)], 0.055, 0.05)  # cuello
m.ell(TK, (0.35, 0.36, 0), (0.16, 0.12, 0.12), (0, 0, -0.15))  # cabeza
m.tube(TK, [(-0.22, 0.12, 0), (-0.3, 0.07, 0)], 0.025, 0.006, tip=True)  # cola
for s in (1, -1):
    m.eye((0.39, 0.39, 0.045 * s), 0.02, (0.5, 0.2, 0.9 * s))
m.tube('#173d1a', [(0.418, 0.335, -0.035), (0.426, 0.33, 0), (0.418, 0.335, 0.035)], 0.004, seg=6, ink=False)
models.append(m)

m = Model('tortuga_caparazon')  # caparazón cerrado que rueda (gira en z)
CS = ((0, 0, 0), (0.5, 0.5, 0.36), (0, 0, 0))
m.ell(TS, *CS)
m.ell(TP, (0, 0, 0), (0.53, 0.53, 0.07))
for sz in (1, -1):
    placas(m, *CS, (0, 0, sz))
models.append(m)

# ───────────── GUACAMAYA: roja, alas rojo-amarillo-verde-azul, cara blanca ─────────────
m = Model('guacamaya')
RD, YE, GR, BU, WH, BK2, BE, LEG = '#c41d27', '#f4cf1d', '#2f9a3e', '#1d3fb4', '#fbf6ea', '#2a201c', '#efe1b7', '#55504c'
m.ell(RD, (0, 0.3, 0), (0.25, 0.36, 0.25), (0, 0, 0.15))
m.ell(RD, (0.04, 0.53, 0), (0.22, 0.21, 0.2))
m.ell(WH, (0.1, 0.54, 0), (0.1, 0.11, 0.17))  # cara blanca
for s in (1, -1):
    r = (0.15 * s, 0, 0.95)
    for col, c, sz in ((BU, (-0.085, 0.25, 0.122), (0.38, 0.12, 0.05)), (GR, (-0.045, 0.3, 0.13), (0.28, 0.12, 0.05)),
                       (YE, (-0.012, 0.345, 0.137), (0.2, 0.12, 0.045)), (RD, (0.02, 0.38, 0.145), (0.13, 0.12, 0.045))):
        m.ell(col, (c[0], c[1], c[2] * s), sz, r)
    m.tube(LEG, [(0.0, 0.15, 0.05 * s), (0.02, 0.07, 0.05 * s), (0.015, 0.02, 0.05 * s)], 0.011, 0.009, seg=8)
    for b in ((0.055, 0.01, 0.05 * s - 0.022), (0.055, 0.01, 0.05 * s + 0.022), (-0.025, 0.01, 0.05 * s)):
        m.tube(LEG, [(0.015, 0.014, 0.05 * s), b], 0.007, 0.006, seg=6, ink=False)
    m.eye((0.115, 0.565, 0.062 * s), 0.024, (0.6, 0.1, 0.8 * s), kind='toy')
m.tube(BU, [(-0.08, 0.2, 0), (-0.2, 0.1, 0), (-0.3, 0.03, 0)], 0.045, 0.016)  # cola
m.ell(BE, (0.15, 0.53, 0), (0.1, 0.1, 0.075), (0, 0, -0.3))  # pico
m.tube(BE, [(0.165, 0.56, 0), (0.2, 0.535, 0), (0.208, 0.475, 0)], 0.028, 0.006, seg=10, tip=True)
m.ell(BK2, (0.14, 0.48, 0), (0.06, 0.05, 0.055))
models.append(m)

# ───────────── MARIPOSA MORFO sobre una matica (piezas separadas para animar) ─────────────
LG, LD, ST = '#4a9e35', '#1f5a1d', '#2f6b22'
m = Model('mariposa_planta')
m.tube(ST, [(0, 0, 0), (0.01, 0.18, 0), (0.025, 0.36, 0.01), (0.02, 0.46, 0)], 0.011, 0.008, seg=8)
for y, a in ((0.2, 0.5), (0.3, 2.6), (0.42, 4.2), (0.45, 1.3)):
    d = V(math.cos(a), 0.35, math.sin(a)) * 0.07
    m.ell(LG, (0.02 + d.x, y + d.y * 0.6, d.z), (0.1, 0.014, 0.045), (0, -a, 0.35), seg=(12, 6))
for i in range(9):  # matojo de pasto en la base
    a = i / 9 * math.tau + 0.4
    r = 0.03 + 0.02 * (i % 3)
    h = 0.09 + 0.025 * ((i * 7) % 3)
    m.tube(LD if i % 2 else LG, [(math.cos(a) * r * 0.5, 0, math.sin(a) * r * 0.5), (math.cos(a) * (r + 0.02), h * 0.6, math.sin(a) * (r + 0.02)),
                                 (math.cos(a) * (r + 0.05), h, math.sin(a) * (r + 0.05))], 0.012, 0.002, seg=5, cap0=False, tip=True)
models.append(m)

BD = '#2a1a10'
m = Model('mariposa_cuerpo')
m.tube(BD, [(-0.1, 0, 0), (0.0, 0.004, 0), (0.07, 0.008, 0)], 0.016, 0.02, seg=8)
m.ell(BD, (0.1, 0.012, 0), (0.06, 0.055, 0.055))
for s in (1, -1):
    m.eye((0.12, 0.026, 0.02 * s), 0.013, (0.6, 0.2, 0.8 * s))
    m.tube(BD, [(0.12, 0.04, 0.012 * s), (0.17, 0.11, 0.03 * s), (0.2, 0.14, 0.05 * s)], 0.003, 0.003, seg=5, ink=False)
    m.ell(BD, (0.2, 0.14, 0.05 * s), (0.016, 0.016, 0.016), seg=(8, 6), ink=False)
models.append(m)

for s, nm in ((1, 'mariposa_ala_d'), (-1, 'mariposa_ala_i')):
    m = Model(nm)  # ala delantera y trasera: borde negro, centro azul morfo, puntos blancos
    m.ell('#14121c', (0.05, -0.003, 0.15 * s), (0.27, 0.012, 0.3), (0, 0.25 * s, 0), seg=(20, 8))
    m.ell('#1f6cf2', (0.045, 0.003, 0.14 * s), (0.22, 0.012, 0.24), (0, 0.25 * s, 0), seg=(20, 8), ink=False)
    m.ell('#4aa0ff', (0.035, 0.007, 0.11 * s), (0.11, 0.01, 0.12), (0, 0.25 * s, 0), seg=(14, 6), ink=False)
    m.ell('#14121c', (-0.08, -0.003, 0.12 * s), (0.2, 0.012, 0.22), (0, -0.3 * s, 0), seg=(18, 8))
    m.ell('#1f6cf2', (-0.075, 0.003, 0.115 * s), (0.16, 0.012, 0.17), (0, -0.3 * s, 0), seg=(18, 8), ink=False)
    for k in range(3):
        m.ell('#ffffff', (0.13 - k * 0.04, 0.009, (0.25 + k * 0.025) * s), (0.016, 0.006, 0.016), seg=(6, 4), ink=False)
    models.append(m)


# ───────────────────────── escena ─────────────────────────
LINEUP = ['rana', 'chiguiro', 'anaconda', 'mono', 'tortuga', 'tortuga_caparazon', 'guacamaya', 'mariposa_planta']


def place(objs, coll):
    mp = objs['mariposa_planta']
    for nm, rx in (('mariposa_cuerpo', 0), ('mariposa_ala_d', 0.45), ('mariposa_ala_i', -0.45)):
        o = objs[nm]
        o.parent = mp
        o.location = (0, 0, 0.62)
        o.rotation_euler = (rx, 0, 0)


SCENE, OBJS = build_scene('Animales', models, LINEUP, 0.85, place, {'tortuga_caparazon': 0.25})
STATS = {nm: len(o.data.polygons) for nm, o in OBJS.items()}
