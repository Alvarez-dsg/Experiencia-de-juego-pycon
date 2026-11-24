# Amazonas vs Leñadores — modelado de los animales defensores en Blender (estilo "arcilla / fieltro").
#
# Uso (sin abrir la interfaz):
#   blender -b --python blender/animales.py -- public/models/animales.glb blender/animales.blend blender/render.png
#
# Cada animal se arma con formas simples (elipsoides y tubos) que se FUSIONAN con un remesh de vóxeles,
# se suavizan y se reducen a pocos triángulos (para Meta Quest). Los colores se pintan por vértice según
# la forma más cercana (con patrones de ruido: manchas de la rana, la anaconda y la tortuga), y luego se
# hornea oclusión ambiental + una textura de fieltro suave en los mismos colores de vértice.
# Los detalles finos (ojos, picos, patas delgadas, alas) van aparte, sin remesh, para que queden nítidos.
#
# Unidades = casillas del tablero. Se modela en coordenadas de three.js (x = hacia los invasores,
# y = arriba, z = hacia el usuario) y al final se pasa a Blender (z arriba). El exportador glTF lo devuelve
# a +Y arriba, así que en el juego cada pieza queda exactamente como se diseñó aquí.
import bpy, bmesh, sys, math, random
from mathutils import Vector, Matrix, Euler, noise
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT_GLB = argv[0] if len(argv) > 0 else '//animales.glb'
OUT_BLEND = argv[1] if len(argv) > 1 else ''
OUT_PNG = __import__('os').path.abspath(argv[2]) if len(argv) > 2 else ''

bpy.ops.wm.read_factory_settings(use_empty=True)

def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return Vector([x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c])

V = lambda *a: Vector(a)
TO_BL = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))  # three (x,y,z) → blender (x,-z,y)


def smooth_path(pts, k=4):
    """Curva Catmull-Rom por los puntos (para colas y cuellos sin quiebres)."""
    P = [V(*p) for p in pts]
    if len(P) < 3: return P
    out = []
    for i in range(len(P) - 1):
        p0, p1, p2 = P[max(0, i - 1)], P[i], P[i + 1]
        p3 = P[min(len(P) - 1, i + 2)]
        for j in range(k):
            t = j / k
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-1])
    return out


class Model:
    """Un modelo: formas de "arcilla" (se fusionan) + detalles (se quedan tal cual)."""

    def __init__(self, name, voxel=0.0065, tris=2000, smooth=6):
        self.name, self.voxel, self.tris, self.smooth = name, voxel, tris, smooth
        self.clay = []  # (kind, data, color, fn, bias)
        self.det = bmesh.new()
        self.det_col = self.det.loops.layers.float_color.new('Col')

    # ---------- arcilla ----------
    def E(self, col, c, s, r=(0, 0, 0), fn=None, bias=0.0):
        """Elipsoide con centro c y diámetros s (como ball() del juego), girado r (rad, XYZ)."""
        R = Euler(r, 'XYZ').to_matrix()
        self.clay.append(('E', (V(*c), V(*s) * 0.5, R), col, fn, bias))

    def T(self, col, a, b, ra, rb=None, fn=None, bias=0.0):
        """Tubo redondeado de a hasta b (radios ra → rb)."""
        self.clay.append(('T', (V(*a), V(*b), ra, ra if rb is None else rb), col, fn, bias))

    def chain(self, col, pts, ra, rb=None, fn=None, bias=0.0):
        rb = ra if rb is None else rb
        pts = smooth_path(pts)
        n = len(pts) - 1
        for i in range(n):
            self.T(col, pts[i], pts[i + 1], ra + (rb - ra) * i / n, ra + (rb - ra) * (i + 1) / n, fn, bias)

    # ---------- detalles ----------
    def _paint(self, faces, col):
        c = (*lin(col), 1) if isinstance(col, str) else col
        for f in faces:
            for l in f.loops:
                l[self.det_col] = c

    def dE(self, col, c, s, r=(0, 0, 0), seg=(12, 8)):
        bm = self.det
        before = set(bm.faces)
        m = Matrix.Translation(V(*c)) @ Euler(r, 'XYZ').to_matrix().to_4x4() @ Matrix.Diagonal((*(V(*s) * 0.5), 1))
        bmesh.ops.create_uvsphere(bm, u_segments=seg[0], v_segments=seg[1], radius=1, matrix=m)
        new = [f for f in bm.faces if f not in before]
        for f in new: f.smooth = True
        self._paint(new, col)

    def dT(self, col, a, b, ra, rb=None, seg=8, caps=True):
        rb = ra if rb is None else rb
        a, b = V(*a), V(*b)
        d = b - a
        L = d.length
        q = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
        m = Matrix.Translation((a + b) / 2) @ q
        bm = self.det
        before = set(bm.faces)
        bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=ra, radius2=rb, depth=L, matrix=m)
        new = [f for f in bm.faces if f not in before]
        for f in new: f.smooth = True
        self._paint(new, col)
        if caps:
            self.dE(col, a, (2 * ra,) * 3, seg=(seg, 5))
            self.dE(col, b, (2 * rb,) * 3, seg=(seg, 5))

    def dChain(self, col, pts, ra, rb=None, seg=8):
        rb = ra if rb is None else rb
        pts = smooth_path(pts)
        n = len(pts) - 1
        for i in range(n):
            self.dT(col, pts[i], pts[i + 1], ra + (rb - ra) * i / n, ra + (rb - ra) * (i + 1) / n, seg)

    def eye(self, c, r, look=(1, 0, 0.4), kind='toy'):
        """Ojo de juguete: 'toy' = blanco con pupila; 'dot' = negro brillante."""
        c, d = V(*c), V(*look).normalized()
        if kind == 'toy':
            self.dE('#fffdf5', c, (2 * r,) * 3)
            self.dE('#151010', c + d * r * 0.42, (1.25 * r,) * 3)
            self.dE('#ffffff', c + d * r * 0.78 + V(0, r * 0.28, 0), (0.42 * r,) * 3, seg=(8, 6))
        else:
            self.dE('#120c0a', c, (2 * r,) * 3)
            self.dE('#ffffff', c + d * r * 0.7 + V(0, r * 0.35, 0), (0.5 * r,) * 3, seg=(8, 6))

    # ---------- construcción ----------
    def _clay_mesh(self):
        bm = bmesh.new()
        for kind, data, *_ in self.clay:
            if kind == 'E':
                c, h, R = data
                m = Matrix.Translation(c) @ R.to_4x4() @ Matrix.Diagonal((*h, 1))
                bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=1, matrix=m)
            else:
                a, b, ra, rb = data
                d = b - a
                q = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
                bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=ra, radius2=rb, depth=d.length,
                                      matrix=Matrix.Translation((a + b) / 2) @ q)
                for p, r in ((a, ra), (b, rb)):
                    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=r, matrix=Matrix.Translation(p))
        me = bpy.data.meshes.new(self.name + '_clay')
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new(self.name + '_clay', me)
        bpy.context.scene.collection.objects.link(o)
        rm = o.modifiers.new('remesh', 'REMESH')
        rm.mode, rm.voxel_size, rm.use_smooth_shade = 'VOXEL', self.voxel, True
        sm = o.modifiers.new('smooth', 'LAPLACIANSMOOTH')
        sm.iterations, sm.lambda_factor = self.smooth, 0.6
        dg = bpy.context.evaluated_depsgraph_get()
        tmp = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        n = len(tmp.polygons)
        o.modifiers.clear()
        o.data = tmp
        dc = o.modifiers.new('decimate', 'DECIMATE')
        dc.ratio = min(1.0, self.tris / max(1, n))
        dg = bpy.context.evaluated_depsgraph_get()
        out = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        bpy.data.objects.remove(o)
        bpy.data.meshes.remove(tmp)
        return out

    def _dist(self, p, prim):
        kind, data, col, fn, bias = prim
        if kind == 'E':
            c, h, R = data
            q = R.transposed() @ (p - c)
            k = Vector((q.x / h.x, q.y / h.y, q.z / h.z)).length
            return (k - 1) * min(h) - bias
        a, b, ra, rb = data
        ab = b - a
        t = max(0.0, min(1.0, (p - a).dot(ab) / max(1e-9, ab.length_squared)))
        return (p - (a + ab * t)).length - (ra + (rb - ra) * t) - bias

    def build(self):
        bm = bmesh.new()
        clay_faces = set()
        if self.clay:
            me = self._clay_mesh()
            bm.from_mesh(me)
            bpy.data.meshes.remove(me)
            clay_faces = set(bm.faces)
        col = bm.loops.layers.float_color.get('Col') or bm.loops.layers.float_color.new('Col')
        # colores de la arcilla: forma más cercana (+ patrón)
        vcol = {}
        for v in bm.verts:
            p = v.co
            best = min(self.clay, key=lambda pr: self._dist(p, pr))
            c = lin(best[2]) if isinstance(best[2], str) else best[2]
            if best[3]:
                r = best[3](p)
                if r: c = lin(r) if isinstance(r, str) else r
            # fieltro: variación muy suave de tono
            f = 1 + 0.06 * noise.noise(p * 55) + 0.03 * noise.noise(p * 140)
            vcol[v.index] = Vector(c) * f
        for f in bm.faces:
            for l in f.loops:
                c = vcol[l.vert.index]
                l[col] = (c.x, c.y, c.z, 1)
        # detalles
        dm = bpy.data.meshes.new('det')
        self.det.to_mesh(dm)
        bm.from_mesh(dm)
        bpy.data.meshes.remove(dm)
        bm.normal_update()
        # oclusión ambiental horneada en los colores (rayos en la semiesfera de cada vértice)
        bvh = BVHTree.FromBMesh(bm)
        rnd = random.Random(7)
        dirs = []
        while len(dirs) < 14:
            d = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1)))
            if 0.2 < d.length <= 1: dirs.append(d.normalized())
        ao = {}
        for v in bm.verts:
            n = v.normal
            o = v.co + n * 0.003
            hit = 0
            cnt = 0
            for d in dirs:
                if d.dot(n) < 0: d = -d
                cnt += 1
                loc, *_ = bvh.ray_cast(o, d, 0.09)
                if loc is not None: hit += 1
            ground = max(0.0, 1 - v.co.y / 0.05) * 0.25  # contacto con el suelo
            ao[v.index] = 1 - 0.55 * (hit / max(1, cnt)) - ground
        for f in bm.faces:
            for l in f.loops:
                k = ao[l.vert.index]
                c = l[col]
                l[col] = (c[0] * k, c[1] * k, c[2] * k, 1)
        bm.transform(TO_BL)
        me = bpy.data.meshes.new(self.name)
        bm.to_mesh(me)
        bm.free()
        for p in me.polygons: p.use_smooth = True
        me.color_attributes.active_color = me.color_attributes['Col']
        o = bpy.data.objects.new(self.name, me)
        return o


def spots(base, spot, freq, thr, extra=None):
    def fn(p):
        n = noise.noise(p * freq)
        if n > thr: return spot
        if extra and n > thr - extra[1]: return extra[0]
        return base
    return fn


models = []

# ───────────── RANA DARDO (naranja, patas azules, manchas negras) ─────────────
m = Model('rana', voxel=0.005)
OR, BL, BK = '#f2a21c', '#1d5bd6', '#141414'
def rana_body(p):
    if p.y < 0.1 + 0.025 * noise.noise(p * 9) and p.x < 0.08: return BL if noise.noise(p * 16 + V(3, 0, 0)) < 0.38 else BK
    return BK if noise.noise(p * 19) > 0.4 and p.y > 0.16 else OR
m.E(OR, (-0.02, 0.15, 0), (0.34, 0.3, 0.32), (0, 0, 0.55), fn=rana_body)
m.E(OR, (0.1, 0.25, 0), (0.24, 0.17, 0.27), (0, 0, 0.25), fn=rana_body)
m.E(OR, (0.19, 0.23, 0), (0.1, 0.09, 0.17), fn=rana_body)
blspot = spots(BL, BK, 15, 0.4)
for s in (1, -1):
    m.E(BL, (-0.08, 0.08, 0.14 * s), (0.22, 0.13, 0.11), (0, 0.5 * s, 0.4), fn=blspot)          # muslo
    m.E(BL, (0.0, 0.03, 0.17 * s), (0.18, 0.06, 0.08), (0, 0.3 * s, 0), fn=blspot)             # pierna doblada
    m.T(BL, (0.1, 0.18, 0.1 * s), (0.15, 0.03, 0.12 * s), 0.032, 0.026)                         # brazo
    for i in (-1, 0, 1):  # dedos con ventosas
        m.dT(BL, (0.15, 0.012, 0.12 * s), (0.2, 0.01, 0.12 * s + i * 0.035), 0.008, 0.008, seg=6)
        m.dE(BL, (0.205, 0.012, 0.12 * s + i * 0.037), (0.022, 0.016, 0.022), seg=(8, 6))
        m.dT(BL, (0.06, 0.012, 0.2 * s), (0.1, 0.01, 0.22 * s + i * 0.04), 0.008, 0.008, seg=6)
        m.dE(BL, (0.105, 0.012, 0.225 * s + i * 0.042), (0.022, 0.016, 0.022), seg=(8, 6))
    m.eye((0.15, 0.31, 0.085 * s), 0.042, (0.6, 0.35, 0.8 * s), kind='dot')
m.dT('#5a2a10', (0.235, 0.2, -0.05), (0.235, 0.2, 0.05), 0.005, 0.005, seg=6)  # boquita
models.append(m)

# ───────────── CHIGÜIRO (café, hocico oscuro, sentado) ─────────────
m = Model('chiguiro', voxel=0.006, )
FUR, DK, PAW = '#7b4a26', '#4e2d17', '#3a2413'
m.E(FUR, (-0.06, 0.17, 0), (0.44, 0.34, 0.38))           # ancas
m.E(FUR, (0.04, 0.29, 0), (0.32, 0.38, 0.3), (0, 0, -0.35))  # pecho / espalda
m.E(FUR, (0.15, 0.46, 0), (0.3, 0.24, 0.25), (0, 0, -0.15))  # cabeza
m.E(DK, (0.27, 0.43, 0), (0.13, 0.19, 0.18), bias=0.004)    # hocico
for s in (1, -1):
    m.T(FUR, (0.12, 0.26, 0.08 * s), (0.14, 0.025, 0.08 * s), 0.045, 0.038)  # patas delanteras
    m.E(PAW, (0.16, 0.016, 0.08 * s), (0.08, 0.035, 0.07), bias=0.004)
    m.E(FUR, (-0.02, 0.06, 0.15 * s), (0.2, 0.1, 0.1))        # pata trasera doblada
    m.E(PAW, (0.07, 0.016, 0.16 * s), (0.1, 0.035, 0.07), bias=0.004)
    m.E(FUR, (0.07, 0.6, 0.075 * s), (0.05, 0.065, 0.04), (0.4 * s, 0, 0))  # orejas
    m.dE(DK, (0.08, 0.6, 0.08 * s), (0.03, 0.04, 0.012), (0.4 * s, 0, 0), seg=(10, 6))
    m.eye((0.2, 0.52, 0.09 * s), 0.024, (0.5, 0.1, 0.9 * s), kind='dot')
    m.dE('#1e120a', (0.33, 0.47, 0.03 * s), (0.02, 0.03, 0.018), seg=(8, 6))  # fosas nasales
m.dT('#1e120a', (0.333, 0.4, 0), (0.333, 0.44, 0), 0.004, 0.004, seg=6)
m.dT('#1e120a', (0.333, 0.4, 0), (0.33, 0.39, 0.03), 0.004, 0.004, seg=6)
m.dT('#1e120a', (0.333, 0.4, 0), (0.33, 0.39, -0.03), 0.004, 0.004, seg=6)
models.append(m)

# ───────────── ANACONDA (verde oscuro con manchas verde claro, enroscada) ─────────────
m = Model('anaconda', voxel=0.0055, )
G1, G2, G3 = '#2c6a1d', '#93d45c', '#1b4612'
skin = spots(G1, G2, 11, 0.3, (G3, 0.08))
pts = []
turns, N = 2.6, 44
for i in range(0, N + 1, 2):
    t = i / N
    a = t * turns * math.pi * 2
    r = 0.21 - 0.12 * t
    pts.append((r * math.cos(a) - 0.03, 0.045 + 0.13 * t, r * math.sin(a)))
m.chain(G1, pts, 0.05, 0.043, fn=skin)
neck = [pts[-1], (0.02, 0.25, 0.0), (0.06, 0.34, 0.0), (0.12, 0.4, 0.0)]
m.chain(G1, neck, 0.042, 0.036, fn=skin)
m.E(G1, (0.17, 0.41, 0), (0.15, 0.075, 0.1), (0, 0, -0.1), fn=skin)
m.dT('#c81e3c', (0.24, 0.4, 0), (0.3, 0.405, 0), 0.0045, 0.0045, seg=6)
for s in (1, -1):
    m.dT('#c81e3c', (0.3, 0.405, 0), (0.325, 0.41, 0.012 * s), 0.004, 0.003, seg=6)
    m.eye((0.2, 0.43, 0.035 * s), 0.016, (0.4, 0.2, 0.9 * s), kind='dot')
models.append(m)

# ───────────── MONO (café, cara y barriga crema, brazo arriba, cola larga) ─────────────
m = Model('mono', voxel=0.0055, )
MF, MC, MD = '#7a4b1c', '#f3d29b', '#4a2c10'
m.E(MF, (0, 0.33, 0), (0.18, 0.26, 0.19))
m.E(MC, (0.05, 0.31, 0), (0.1, 0.19, 0.14), bias=0.006)  # barriga
m.E(MF, (0.0, 0.53, 0), (0.25, 0.23, 0.24))             # cabeza
m.E(MC, (0.075, 0.51, 0), (0.12, 0.17, 0.19), bias=0.006)  # cara
m.E(MC, (0.11, 0.465, 0), (0.08, 0.07, 0.11), bias=0.008)  # hocico
for s in (1, -1):
    m.E(MF, (0.0, 0.54, 0.135 * s), (0.05, 0.1, 0.06))   # oreja
    m.dE(MC, (0.012, 0.54, 0.14 * s), (0.03, 0.065, 0.03), seg=(10, 6))
    m.chain(MF, [(0.0, 0.23, 0.055 * s), (0.04, 0.12, 0.07 * s), (0.0, 0.035, 0.07 * s)], 0.032, 0.026)  # piernas
    m.E(MD, (0.03, 0.015, 0.075 * s), (0.1, 0.035, 0.06), bias=0.004)
    m.eye((0.135, 0.535, 0.045 * s), 0.024, (0.8, 0.1, 0.6 * s), kind='dot')
# brazo derecho abajo, brazo izquierdo sobre la cabeza (como en el boceto)
m.chain(MF, [(0.0, 0.42, 0.1), (0.04, 0.3, 0.12), (0.06, 0.2, 0.1)], 0.028, 0.024)
m.E(MD, (0.065, 0.18, 0.1), (0.05, 0.05, 0.05), bias=0.004)
m.chain(MF, [(0.0, 0.42, -0.1), (-0.01, 0.58, -0.15), (0.02, 0.67, -0.06)], 0.028, 0.024)
m.E(MD, (0.03, 0.665, -0.02), (0.05, 0.05, 0.05), bias=0.004)
tail = [(-0.06, 0.25, 0), (-0.17, 0.2, 0.0), (-0.27, 0.24, 0), (-0.31, 0.35, 0), (-0.27, 0.45, 0), (-0.19, 0.46, 0), (-0.17, 0.4, 0)]
m.chain(MF, tail, 0.024, 0.018)
m.dT(MD, (0.15, 0.445, -0.02), (0.15, 0.445, 0.02), 0.004, 0.004, seg=6)  # sonrisa
models.append(m)

# ───────────── TORTUGA (caparazón verde con manchas café, piel verde oscura) ─────────────
TS, TSP, TK, TP = '#3f9d47', '#7a5426', '#24612b', '#93c96d'
shell_fn = spots(TS, TSP, 14, 0.2)
def tortuga(m, closed=False):
    if closed:
        m.E(TS, (0, 0, 0), (0.5, 0.5, 0.36), fn=lambda p: TP if abs(p.z) < 0.035 else shell_fn(p))
        return
    m.E(TS, (0, 0.19, 0), (0.5, 0.3, 0.42), fn=shell_fn)
    m.E(TP, (0, 0.12, 0), (0.54, 0.09, 0.46), bias=0.006)
    for x, z in ((0.14, 0.15), (0.14, -0.15), (-0.14, 0.15), (-0.14, -0.15)):
        m.T(TK, (x, 0.13, z), (x * 1.15, 0.02, z * 1.15), 0.05, 0.048)
        m.E(TK, (x * 1.2, 0.012, z * 1.15), (0.1, 0.03, 0.09))
    m.chain(TK, [(0.18, 0.15, 0), (0.27, 0.22, 0), (0.31, 0.32, 0)], 0.055, 0.05)
    m.E(TK, (0.35, 0.36, 0), (0.16, 0.12, 0.12), (0, 0, -0.15))
    m.T(TK, (-0.22, 0.12, 0), (-0.3, 0.07, 0), 0.025, 0.01)
    for s in (1, -1):
        m.eye((0.39, 0.39, 0.045 * s), 0.02, (0.5, 0.2, 0.9 * s), kind='dot')
    m.dT('#173d1a', (0.415, 0.33, -0.035), (0.415, 0.33, 0.035), 0.004, 0.004, seg=6)
m = Model('tortuga', voxel=0.006, ); tortuga(m); models.append(m)
m = Model('tortuga_caparazon', voxel=0.006, tris=1000); tortuga(m, True); models.append(m)

# ───────────── GUACAMAYA (roja, alas azul-amarillo-verde, pico claro) ─────────────
m = Model('guacamaya', voxel=0.0055, )
RD, YE, GR, BU, WH = '#c41d27', '#f4cf1d', '#2f9a3e', '#1d3fb4', '#fbf6ea'
def wing(s):
    a, b = V(0.06, 0.45, 0.12 * s), V(-0.2, 0.12, 0.13 * s)
    def fn(p):
        t = (p - a).dot(b - a) / (b - a).length_squared
        t += 0.05 * noise.noise(p * 20)
        return RD if t < 0.32 else YE if t < 0.45 else GR if t < 0.55 else BU
    return fn
m.E(RD, (0, 0.3, 0), (0.25, 0.36, 0.25), (0, 0, 0.15))
m.E(RD, (0.04, 0.53, 0), (0.22, 0.21, 0.2))
m.E(WH, (0.1, 0.54, 0), (0.1, 0.11, 0.17), bias=0.006)  # cara blanca
for s in (1, -1):
    m.E(RD, (-0.04, 0.3, 0.115 * s), (0.34, 0.12, 0.07), (0.15 * s, 0, 0.95), fn=wing(s))
    m.dChain('#55504c', [(0.0, 0.15, 0.05 * s), (0.02, 0.07, 0.05 * s), (0.015, 0.015, 0.05 * s)], 0.011, 0.009)
    for dz in (-0.022, 0.022):
        m.dT('#55504c', (0.015, 0.012, 0.05 * s), (0.055, 0.01, 0.05 * s + dz), 0.007, 0.006, seg=6)
    m.dT('#55504c', (0.015, 0.012, 0.05 * s), (-0.025, 0.01, 0.05 * s), 0.007, 0.006, seg=6)
    m.eye((0.115, 0.565, 0.06 * s), 0.024, (0.6, 0.1, 0.8 * s), kind='toy')
m.chain(BU, [(-0.08, 0.2, 0), (-0.2, 0.1, 0), (-0.29, 0.03, 0)], 0.045, 0.018, fn=lambda p: RD if p.x > -0.15 and abs(p.z) < 0.02 else BU)
# pico ganchudo
m.dE('#efe1b7', (0.15, 0.53, 0), (0.1, 0.1, 0.075), (0, 0, -0.3))
m.dT('#efe1b7', (0.18, 0.53, 0), (0.205, 0.475, 0), 0.025, 0.008, seg=10)
m.dE('#2a201c', (0.14, 0.48, 0), (0.06, 0.05, 0.055))
models.append(m)

# ───────────── MARIPOSA MORFO sobre una matica ─────────────
# Piezas separadas para animar: flor (planta), cuerpo y dos alas (bisagra en el eje x del cuerpo).
m = Model('mariposa_planta')
LG, LD = '#4a9e35', '#1f5a1d'
m.dChain('#2f6b22', [(0, 0, 0), (0.01, 0.18, 0), (0.025, 0.36, 0.01), (0.02, 0.46, 0)], 0.011, 0.008)
for y, a in ((0.2, 0.5), (0.3, 2.6), (0.42, 4.2), (0.45, 1.3)):
    d = V(math.cos(a), 0.35, math.sin(a)) * 0.07
    m.dE(LG, (0.02 + d.x, y + d.y * 0.6, d.z), (0.1, 0.012, 0.045), (0, -a, 0.35), seg=(10, 6))
rnd = random.Random(3)
for i in range(14):  # matojo de pasto en la base
    a = rnd.uniform(0, math.pi * 2)
    r = rnd.uniform(0.01, 0.07)
    m.dT(LD if i % 2 else LG, (math.cos(a) * r, 0, math.sin(a) * r), (math.cos(a) * (r + 0.05), rnd.uniform(0.08, 0.14), math.sin(a) * (r + 0.05)), 0.012, 0.002, seg=5, caps=False)
models.append(m)
m = Model('mariposa_cuerpo')
m.dChain('#2a1a10', [(-0.1, 0, 0), (0.0, 0.004, 0), (0.07, 0.008, 0)], 0.016, 0.02)
m.dE('#2a1a10', (0.1, 0.012, 0), (0.06, 0.055, 0.055))
for s in (1, -1):
    m.eye((0.12, 0.025, 0.02 * s), 0.013, (0.6, 0.2, 0.8 * s), kind='dot')
    m.dChain('#2a1a10', [(0.12, 0.04, 0.012 * s), (0.17, 0.11, 0.03 * s), (0.2, 0.14, 0.05 * s)], 0.003, 0.003, seg=5)
    m.dE('#2a1a10', (0.2, 0.14, 0.05 * s), (0.016, 0.016, 0.016), seg=(8, 6))
models.append(m)
for s, nm in ((1, 'mariposa_ala_d'), (-1, 'mariposa_ala_i')):
    m = Model(nm)
    # ala delantera y trasera: borde negro con puntos blancos y centro azul morfo
    m.dE('#14121c', (0.05, -0.003, 0.15 * s), (0.27, 0.012, 0.3), (0, 0.25 * s, 0), seg=(20, 8))
    m.dE('#1f6cf2', (0.045, 0.002, 0.14 * s), (0.22, 0.012, 0.24), (0, 0.25 * s, 0), seg=(20, 8))
    m.dE('#4aa0ff', (0.035, 0.005, 0.11 * s), (0.11, 0.01, 0.12), (0, 0.25 * s, 0), seg=(12, 6))
    m.dE('#14121c', (-0.08, -0.003, 0.12 * s), (0.2, 0.012, 0.22), (0, -0.3 * s, 0), seg=(18, 8))
    m.dE('#1f6cf2', (-0.075, 0.002, 0.115 * s), (0.16, 0.012, 0.17), (0, -0.3 * s, 0), seg=(18, 8))
    for k in range(3):
        m.dE('#ffffff', (0.13 - k * 0.04, 0.008, (0.25 + k * 0.025) * s), (0.016, 0.006, 0.016), seg=(6, 4))
    models.append(m)

# ---------------- construir, exportar ----------------
scene = bpy.context.scene
col = bpy.data.collections.new('Animales')
scene.collection.children.link(col)
objs = []
for mdl in models:
    o = mdl.build()
    col.objects.link(o)
    objs.append(o)
    print('ANIMAL', o.name, len(o.data.polygons), 'caras', tuple(round(x, 3) for x in o.dimensions))

# material para Blender (el juego usa solo los colores de vértice): arcilla/fieltro mate con brillo de tela
mat = bpy.data.materials.new('Fieltro')
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes['Principled BSDF']
attr = nt.nodes.new('ShaderNodeVertexColor')
attr.layer_name = 'Col'
nt.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.85
for k, v in (('Sheen Weight', 0.6), ('Sheen Roughness', 0.4)):
    if k in bsdf.inputs: bsdf.inputs[k].default_value = v
for o in objs: o.data.materials.append(mat)

bpy.ops.object.select_all(action='DESELECT')
for o in objs: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT_GLB, use_selection=True, export_format='GLB', export_materials='NONE',
                          export_vertex_color='ACTIVE', export_texcoords=False, export_yup=True, export_apply=True)

# ---------------- escena de presentación ----------------
lineup = ['rana', 'chiguiro', 'anaconda', 'mono', 'tortuga', 'guacamaya', 'mariposa_planta']
x = 0
for o in objs:
    if o.name in lineup:
        o.location = (x, 0, 0)
        x += 0.75
    else:
        o.hide_render = o.name.startswith('tortuga')
mp = bpy.data.objects['mariposa_planta'].location
for nm in ('mariposa_cuerpo', 'mariposa_ala_d', 'mariposa_ala_i'):
    o = bpy.data.objects[nm]
    o.location = mp + Vector((0, 0, 0.62))
bpy.data.objects['mariposa_ala_d'].rotation_euler = (0.45, 0, 0)
bpy.data.objects['mariposa_ala_i'].rotation_euler = (-0.45, 0, 0)
bpy.ops.mesh.primitive_plane_add(size=40, location=(2.2, 0, 0))
floor = bpy.context.active_object
fm = bpy.data.materials.new('Piso')
fm.use_nodes = True
fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.93, 0.87, 0.74, 1)
floor.data.materials.append(fm)
world = bpy.data.worlds.new('Mundo')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.95, 0.9, 0.8, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
sun = bpy.data.objects.new('Sol', bpy.data.lights.new('Sol', 'SUN'))
sun.data.energy = 3.2
sun.data.angle = 0.35
sun.rotation_euler = (math.radians(50), 0, math.radians(-35))
scene.collection.objects.link(sun)
cam = bpy.data.objects.new('Camara', bpy.data.cameras.new('Camara'))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 5.3
cam.location = (2.25, -6, 1.35)
cam.rotation_euler = (math.radians(82), 0, 0)
scene.render.resolution_x, scene.render.resolution_y = 1800, 420
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.view_settings.view_transform = 'Standard'
if OUT_BLEND:
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
if OUT_PNG:
    scene.render.filepath = OUT_PNG
    bpy.ops.render.render(write_still=True)
print('LISTO')
