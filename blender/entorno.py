# Amazonas vs Leñadores — la isla y el entorno del diorama, modelados en Blender.
#
# Se ejecuta dentro de Blender (por la conexión MCP o con: blender -b --python blender/entorno.py -- exportar).
# Crea (o rehace) la escena "Entorno" con:
#   · terreno: la orilla talada (fondo), el lecho del río, la isla de manglar (arena + tierra verde) y la
#     orilla de selva (cerca del usuario), como una malla de alturas con colores por vértice;
#   · costado: los bordes del diorama (estratos de tierra y el agua vista de lado);
#   · decorado: tocones, troncos cortados, árboles secos, pasto seco, huellas de máquinas, piedras, juncos,
#     hojas de lirio y cangrejos;
#   · empresa: la sede de DEFORESTA S.A. (galpón, techo rojo, portón, chimenea y la pila de troncos).
# La forma de la isla y del río es la misma de src/terrain.js (las reglas del juego dependen de ella).
#
# Unidades = casillas del tablero (1 casilla = 6,8 cm), en coordenadas de three.js (x derecha, y arriba,
# z hacia el usuario); se modela en metros y se escala al construir. export_glb los deja en
# public/models/entorno.glb para el juego.
import bpy, bmesh, math, os, sys, importlib, random
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.getcwd()
sys.path.insert(0, HERE)
import estilo
importlib.reload(estilo)
from estilo import Model, lin, export_glb, build_scene, bake_ao

# ───────────── medidas (las mismas de src/config.js) ─────────────
C = 0.068
W, D, T = 1.0, 0.8, 0.03
LEFT, RIGHT, BACK, FRONT = -W / 2, W / 2, -D / 2, D / 2
CX, CZ, LAND_A, LAND_B, SAND_A, SAND_B = 0.0, 0.06, 0.335, 0.168, 0.39, 0.208
LAND_Y, BANK_Y, WATER_Y = 0.014, 0.012, 0.007
BANK_Z, FRONT_Z = -0.27, 0.345
ROWS, COLS = 4, 8
GRID_X0, GRID_Z0 = CX - COLS * C / 2, CZ - ROWS * C / 2

# ───────────── geografía (port de src/terrain.js) ─────────────
def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

bank_z = lambda x: BANK_Z + 0.016 * math.sin(x * 7.3 + 0.6) + 0.008 * math.sin(x * 17 + 2)
front_z = lambda x: FRONT_Z + 0.01 * math.sin(x * 9.1 + 1.3) + 0.005 * math.sin(x * 21)
ell = lambda x, z, a, b: math.hypot((x - CX) / a, (z - CZ) / b)

def wobble(x, z):
    a = math.atan2(z - CZ, x - CX)
    return 1 + 0.035 * math.sin(a * 5 + 0.7) + 0.02 * math.sin(a * 9)

def island_dist(x, z):
    dx, dz = x - CX, z - CZ
    r = ell(x, z, SAND_A, SAND_B) / wobble(x, z)
    ln = math.hypot(dx, dz) or 1e-6
    return ln - ln / (r or 1e-6)

def region(x, z):
    if x < LEFT or x > RIGHT or z < BACK or z > FRONT:
        return 'off'
    if z < bank_z(x):
        return 'bank'
    if z > front_z(x):
        return 'front'
    w = wobble(x, z)
    if ell(x, z, LAND_A, LAND_B) / w <= 1:
        return 'land'
    if ell(x, z, SAND_A, SAND_B) / w <= 1:
        return 'sand'
    return 'water'

def depth(x, z):
    if region(x, z) != 'water':
        return 0.0
    d = min(z - bank_z(x), front_z(x) - z, island_dist(x, z), x - LEFT + 0.2, RIGHT - x + 0.2)
    return smooth(0.004, 0.05, d)

def ground(x, z):
    reg = region(x, z)
    if reg in ('bank', 'front'):
        return BANK_Y
    if reg == 'land':
        return LAND_Y
    if reg == 'sand':
        k = smooth(1.0, 0.86, ell(x, z, SAND_A, SAND_B) / wobble(x, z))
        return WATER_Y - 0.001 + (LAND_Y - WATER_Y) * k
    return WATER_Y - 0.003 - 0.017 * depth(x, z)

clampx = lambda x: min(RIGHT - 1e-4, max(LEFT + 1e-4, x))
clampz = lambda z: min(FRONT - 1e-4, max(BACK + 1e-4, z))

# ───────────── colores ─────────────
COL = dict(bank='#c9a06a', bankDark='#b2875a', land='#67bd52', landDark='#58ad46', sand='#f1dca4',
           bedShallow='#d9d39a', bedDeep='#0f3f57', front='#4fa040', frontDark='#43913a', earth='#7a5236',
           earthDark='#5b3c26', waterSide='#4fb0cc')
noise = lambda x, z: math.sin(x * 41 + math.sin(z * 23)) * 0.5 + math.sin(z * 37 + x * 13) * 0.5

def terrain_color(x, z):
    reg, n = region(x, z), noise(x, z)
    if reg == 'bank':
        return lin(COL['bankDark'] if n > 0.35 else COL['bank'])
    if reg == 'front':
        return lin(COL['frontDark'] if n > 0.3 else COL['front'])
    if reg in ('land', 'sand'):
        # borde suave entre la tierra verde y la arena (sin escalones de la malla)
        g = lin(COL['landDark'] if n > 0.45 else COL['land'])
        s = lin(COL['sand'])
        t = smooth(0.975, 1.02, ell(x, z, LAND_A, LAND_B) / wobble(x, z))
        return [g[i] + (s[i] - g[i]) * t for i in range(3)]
    a, b, k = lin(COL['bedShallow']), lin(COL['bedDeep']), depth(x, z)
    return [a[i] + (b[i] - a[i]) * k for i in range(3)]


class Sheet(Model):
    """Malla sin contorno (terreno y costados): caras con color por esquina."""

    def face(self, pts, cols):
        vs = [self.bm.verts.new(p) for p in pts]
        f = self.bm.faces.new(vs)
        for l, c in zip(f.loops, cols):
            l[self.col] = (*c, 1.0)
        for v in vs:
            v[self.dl][0] = 0.0
        return f


def build_terrain():
    m = Sheet('terreno')
    m.scale = 1 / C
    nx, nz = 150, 120
    bm = m.bm
    grid, cols = [], []
    for j in range(nz + 1):
        row, crow = [], []
        for i in range(nx + 1):
            x, z = LEFT + W * i / nx, BACK + D * j / nz
            cx_, cz_ = clampx(x), clampz(z)
            v = bm.verts.new((x, ground(cx_, cz_), z))
            v[m.dl][0] = 0.0
            row.append(v)
            crow.append(terrain_color(cx_, cz_))
        grid.append(row)
        cols.append(crow)
    for j in range(nz):
        for i in range(nx):
            q = (grid[j][i], grid[j + 1][i], grid[j + 1][i + 1], grid[j][i + 1])  # cara hacia arriba (+y)
            f = bm.faces.new(q)
            f.smooth = True
            for l, (jj, ii) in zip(f.loops, ((j, i), (j + 1, i), (j + 1, i + 1), (j, i + 1))):
                l[m.col] = (*cols[jj][ii], 1.0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    # que mire hacia arriba
    bm.normal_update()
    if sum(f.normal.y for f in bm.faces) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    return m


def build_skirt():
    m = Sheet('costado')
    m.scale = 1 / C
    N, bot = 120, -T
    edges = [lambda t: (LEFT + t * W, FRONT), lambda t: (RIGHT - t * W, BACK),
             lambda t: (LEFT, BACK + t * D), lambda t: (RIGHT, FRONT - t * D)]
    dk, er, ws = lin(COL['earthDark']), lin(COL['earth']), lin(COL['waterSide'])
    for ed in edges:
        for i in range(N):
            x0, z0 = ed(i / N)
            x1, z1 = ed((i + 1) / N)
            g0, g1 = ground(clampx(x0), clampz(z0)), ground(clampx(x1), clampz(z1))
            mid = bot * 0.62
            m.face([(x0, bot, z0), (x1, bot, z1), (x1, mid, z1), (x0, mid, z0)], [dk] * 4)
            m.face([(x0, mid, z0), (x1, mid, z1), (x1, g1, z1), (x0, g0, z0)], [er] * 4)
            reg = region(clampx((x0 + x1) / 2), clampz((z0 + z1) / 2))
            if reg == 'water' or (g0 < WATER_Y and g1 < WATER_Y):
                m.face([(x0, min(g0, WATER_Y), z0), (x1, min(g1, WATER_Y), z1), (x1, WATER_Y, z1), (x0, WATER_Y, z0)], [ws] * 4)
    bmesh.ops.recalc_face_normals(m.bm, faces=m.bm.faces[:])
    return m


# ───────────── decorado ─────────────
def cyl(m, col, a, b, r_top, r_bot=None, seg=10, ink=True):
    """Cilindro de a (abajo) a b (arriba), como cyl(rt, rb) + seg() del juego."""
    m.tube(col, [a, b], r_bot if r_bot is not None else r_top, r_top, seg=seg, capk=0.25, ink=ink)

def stump(m, x, z, r, h, y):
    cyl(m, '#7b5232', (x, y - 0.001, z), (x, y + h, z), r * 0.9, r * 1.15)
    m.ell('#e2bb83', (x, y + h + 0.0004, z), (r * 1.7, 0.0012, r * 1.7), seg=(14, 4))  # corte
    m.ell('#c1965c', (x, y + h + 0.0009, z), (r * 0.8, 0.0006, r * 0.8), seg=(10, 4), ink=False)  # anillos
    for k in range(3):  # raíces que asoman
        a = k * 2.1 + x * 9
        m.ell('#6d4729', (x + math.cos(a) * r * 1.05, y + 0.0008, z + math.sin(a) * r * 1.05), (r * 0.9, r * 0.45, r * 0.55), (0, -a, 0), seg=(8, 6))

def log(m, x, z, ln, r, ang, y):
    dx, dz = math.cos(ang) * ln / 2, math.sin(ang) * ln / 2
    m.tube('#835a35', [(x - dx, y + r, z - dz), (x + dx, y + r, z + dz)], r, seg=10, capk=0.2)
    for s in (-1, 1):
        m.decal('#e2bb83', (x + s * dx * 1.005, y + r, z + s * dz * 1.005), (s * math.cos(ang), 0, s * math.sin(ang)), (r * 1.7, r * 1.7), thick=0.0012, ink=False)

def dead_tree(m, x, z, h, y):
    m.tube('#8a6f55', [(x, y, z), (x + h * 0.02, y + h * 0.55, z), (x - h * 0.01, y + h, z)], h * 0.06, h * 0.03, seg=8)
    m.tube('#8a6f55', [(x, y + h * 0.6, z), (x + h * 0.15, y + h * 0.75, z + h * 0.03), (x + h * 0.25, y + h * 0.85, z + h * 0.05)], h * 0.03, h * 0.015, seg=7, tip=True)
    m.tube('#8a6f55', [(x, y + h * 0.75, z), (x - h * 0.12, y + h * 0.9, z - h * 0.03), (x - h * 0.2, y + h, z - h * 0.05)], h * 0.026, h * 0.012, seg=7, tip=True)

def rock(m, x, z, s, y, R):
    m.ell(R.choice(['#9aa3a6', '#8b9497', '#a9b0b2']), (x, y, z), (s * 1.4, s, s * 1.1), (0, R.random() * 3, 0), seg=(10, 7))

def reed(m, x, z, h, y):
    for i in range(3):
        a = i * 2.1
        m.tube('#5f9a3a', [(x, y, z), (x + math.cos(a) * h * 0.18, y + h, z + math.sin(a) * h * 0.18)], 0.0012, 0.0009, seg=5, ink=False)
    m.tube('#7a4a26', [(x, y + h * 0.85, z), (x, y + h * 1.05, z)], 0.0018, seg=7)

def build_decor():
    R = random.Random(61)
    m = Model('decorado')
    m.scale = 1 / C
    # ── orilla talada: tocones, troncos, árboles secos, pasto seco ──
    for _ in range(26):
        x = LEFT + 0.03 + R.random() * (W - 0.06)
        z = BACK + 0.015 + R.random() * (bank_z(x) - BACK - 0.03)
        if x > 0.17 and z < -0.3:
            continue  # ahí está la empresa
        stump(m, x, z, 0.007 + R.random() * 0.006, 0.006 + R.random() * 0.008, BANK_Y)
    for _ in range(5):
        log(m, LEFT + 0.06 + R.random() * 0.6, BACK + 0.03 + R.random() * 0.06, 0.04 + R.random() * 0.03, 0.0045, R.random() * 3, BANK_Y)
    dead_tree(m, -0.42, -0.36, 0.07, BANK_Y)
    dead_tree(m, -0.06, -0.38, 0.055, BANK_Y)
    for _ in range(40):
        x = LEFT + R.random() * W
        z = BACK + R.random() * (bank_z(x) - BACK)
        m.tube(R.choice(['#d4bd78', '#c4a964', '#e0cd8a']), [(x, BANK_Y, z), (x, BANK_Y + 0.008, z)], 0.0025, seg=6, tip=True, cap0=False, ink=False)
    # huellas de máquinas que bajan hacia el río
    for i in range(5):
        x = -0.38 + i * 0.17
        for off in (-0.012, 0.012):
            m.rbox('#a98252', (x + off, BANK_Y + 0.0002, -0.33), (0.007, 0.0008, 0.12), (0, x * 0.4, 0), rad=0.0003, ink=False)
    # ── río: piedras y juncos en las orillas ──
    for _ in range(14):
        x = LEFT + R.random() * W
        rock(m, x, bank_z(x) + 0.004 + R.random() * 0.01, 0.004 + R.random() * 0.005, WATER_Y - 0.001, R)
    for _ in range(18):
        x = LEFT + R.random() * W
        z = front_z(x) - 0.004 - R.random() * 0.012
        if R.random() < 0.5:
            reed(m, x, z, 0.018 + R.random() * 0.012, WATER_Y - 0.002)
        else:
            m.ell('#4caf50', (x, WATER_Y + 0.0006, z - 0.01), (0.012, 0.0012, 0.012), seg=(14, 4), ink=False)  # hoja de lirio
    # cangrejitos rojos en la arena de la isla
    for a in (0.4, 2.6, 4.2):
        x, z = CX + math.cos(a) * SAND_A * 0.96, CZ + math.sin(a) * SAND_B * 0.96
        m.ell('#e2492f', (x, WATER_Y + 0.003, z), (0.008, 0.004, 0.006), seg=(10, 6))
        for s in (-1, 1):
            m.ell('#e2492f', (x + 0.004, WATER_Y + 0.004, z + s * 0.004), (0.003, 0.003, 0.003), seg=(8, 5))
    return m


def build_company():
    m = Model('empresa')
    m.scale = 1 / C
    bx, bz, bw, bd, bh, y0 = 0.33, -0.365, 0.2, 0.06, 0.06, BANK_Y
    m.rbox('#9ba8ae', (bx, y0 + bh / 2, bz), (bw, bh, bd), rad=0.0035)  # galpón
    x = bx - bw / 2 + 0.012
    while x < bx + bw / 2:  # láminas del galpón
        m.rbox('#86949a', (x, y0 + bh / 2, bz + bd / 2 + 0.0005), (0.004, bh * 0.9, 0.002), rad=0.0008, ink=False)
        x += 0.02
    m.rbox('#c0392b', (bx, y0 + bh + 0.004, bz), (bw + 0.04, 0.035, bd + 0.012), rad=0.012)  # techo rojo redondeado
    m.rbox('#22262d', (bx - 0.04, y0 + 0.018, bz + bd / 2 + 0.001), (0.05, 0.036, 0.003), rad=0.001)  # portón
    m.rbox('#f1c40f', (bx - 0.04, y0 + 0.039, bz + bd / 2 + 0.002), (0.056, 0.006, 0.004), rad=0.0015)
    for k in range(4):  # franjas de peligro del portón
        m.rbox('#22262d', (bx - 0.062 + k * 0.015, y0 + 0.039, bz + bd / 2 + 0.0042), (0.005, 0.0055, 0.0008), (0, 0, 0.6), rad=0.0002, ink=False)
    chx = bx + 0.06
    cyl(m, '#5b5b5b', (chx, y0 + bh, bz), (chx, y0 + bh + 0.07, bz), 0.009, 0.011, seg=12)  # chimenea
    for yy in (0.04, 0.06):
        cyl(m, '#c0392b', (chx, y0 + bh + yy, bz), (chx, y0 + bh + yy + 0.007, bz), 0.0115, seg=12)
    for row in range(3):  # pila de troncos "cosechados"
        for k in range(3 - row):
            z = -0.33 + (k - (2 - row) / 2) * 0.011
            y = y0 + 0.0055 + row * 0.009
            m.tube('#8a5e34' if k % 2 else '#7d5532', [(0.16, y, z), (0.21, y, z)], 0.0055, seg=10, capk=0.2)
            m.decal('#e2bb83', (0.2102, y, z), (1, 0, 0), (0.009, 0.009), thick=0.001, ink=False)
    # postes del letrero (el letrero lo dibuja el juego)
    sy = -0.35
    ax = Vector((math.cos(sy), 0, -math.sin(sy)))
    sc = Vector((bx - 0.005, y0 + bh + 0.06, bz + 0.01))
    for s in (-0.055, 0.055):
        p = sc + ax * s
        cyl(m, '#444444', (p.x, y0 + bh - 0.004, p.z - 0.003), (p.x, sc.y, p.z - 0.003), 0.0022, seg=8)
    return m


def make():
    models = [build_terrain(), build_skirt(), build_decor(), build_company()]
    sc, objs = build_scene('Entorno', models, lineup=[])
    for nm in ('terreno', 'costado'):
        o = objs[nm]
        for md in list(o.modifiers):
            o.modifiers.remove(md)
    # el piso de estudio de build_scene queda debajo del diorama
    for o in sc.objects:
        if o.type == 'MESH' and o.data.name.startswith('Entorno_piso'):
            o.location.z = -T / C - 0.05
    cam = sc.camera
    cam.data.ortho_scale = 17
    cam.location = (0, -15, 11)
    cam.rotation_euler = (math.radians(55), 0, 0)
    sc.render.resolution_x, sc.render.resolution_y = 1600, 1000
    return sc, objs


SCENE, OBJS = make()
for o in OBJS.values():
    print('ENTORNO', o.name, len(o.data.polygons))

if '--' in sys.argv and 'exportar' in sys.argv[sys.argv.index('--'):]:
    ROOT = os.path.dirname(HERE)
    bake_ao(SCENE, {k: OBJS[k] for k in ('decorado', 'empresa')})
    export_glb(os.path.join(ROOT, 'public', 'models', 'entorno.glb'), OBJS)
    print('EXPORTADO entorno.glb')
