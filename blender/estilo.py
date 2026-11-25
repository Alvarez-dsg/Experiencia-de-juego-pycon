# Estilo común de los modelos de Amazonas vs Leñadores (animales e invasores):
# formas lisas de juguete, colores planos por vértice, contorno de tinta (casco invertido) y material toon.
# Lo usan blender/animales.py y blender/invasores.py.
import bpy, bmesh, math, os
from mathutils import Vector, Matrix, Euler

V = lambda *a: Vector(a)
TO_BL = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))  # three (x,y,z) → blender (x,-z,y)
INK = '#21170f'
INK_T = 0.006  # grosor del contorno en casillas (≈0,4 mm en el juego)


def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def smooth_path(P, k=3):
    """Curva Catmull-Rom por los puntos (colas, cuellos y la anaconda sin quiebres)."""
    out = []
    for i in range(len(P) - 1):
        p0, p1, p2, p3 = P[max(0, i - 1)], P[i], P[i + 1], P[min(len(P) - 1, i + 2)]
        for j in range(k):
            t = j / k
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-1])
    return out


class Model:
    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.float_color.new('Col')
        self.dl = self.bm.verts.layers.deform.verify()

    def _paint(self, verts, col, ink):
        c = (*lin(col), 1.0)
        faces = {f for v in verts for f in v.link_faces}
        for f in faces:
            f.smooth = True
            for l in f.loops:
                l[self.col] = c
        for v in verts:
            v[self.dl][0] = 1.0 if ink else 0.0
        return faces

    # ── elipsoide: centro c, diámetros s, giro r (rad, XYZ) ──
    def ell(self, col, c, s, r=(0, 0, 0), seg=None, ink=True, half=False):
        """half=True deja solo la mitad de arriba (domo de casco), abierta por debajo."""
        m = Matrix.Translation(V(*c)) @ Euler(r, 'XYZ').to_matrix().to_4x4() @ Matrix.Diagonal((s[0] / 2, s[1] / 2, s[2] / 2, 1))
        if seg is None:
            u = max(8, min(20, int(9 + max(s) * 30)))
            seg = (u, max(6, int(u * 0.55)))
        if half:
            seg = (seg[0], seg[1] + seg[1] % 2)  # con un anillo justo en el ecuador
        res = bmesh.ops.create_uvsphere(self.bm, u_segments=seg[0], v_segments=seg[1], radius=1, matrix=m)
        verts = res['verts']
        if half:
            cut = [v for v in verts if v.co.y < c[1] - 1e-5]
            bmesh.ops.delete(self.bm, geom=cut, context='VERTS')
            verts = [v for v in verts if v.is_valid]
        self._paint(verts, col, ink)

    # ── tubo continuo por una curva, con puntas redondas (o en punta) ──
    def tube(self, col, pts, ra, rb=None, seg=10, k=3, cap0=True, cap1=True, tip=False, ink=True, capk=1.0):
        """capk < 1 aplana las puntas (ruedas, tambores, tubos de escape)."""
        rb = ra if rb is None else rb
        P = [V(*p) for p in pts]
        P = P if len(P) == 2 else smooth_path(P, k)
        n = len(P)
        T = [(P[min(i + 1, n - 1)] - P[max(i - 1, 0)]).normalized() for i in range(n)]
        ref = V(0, 1, 0) if abs(T[0].y) < 0.9 else V(1, 0, 0)
        N = T[0].cross(ref).normalized()
        L = [0.0]
        for i in range(1, n):
            L.append(L[-1] + (P[i] - P[i - 1]).length)
        tot = L[-1] or 1
        rings = []
        for i in range(n):
            if i:
                N = (N - T[i] * N.dot(T[i])).normalized()
            rings.append((P[i], ra + (rb - ra) * L[i] / tot, N.copy(), T[i].cross(N)))
        bm = self.bm
        ang = [2 * math.pi * j / seg for j in range(seg)]
        mk = lambda c, r, Nn, Bb: [bm.verts.new(c + (Nn * math.cos(a) + Bb * math.sin(a)) * r) for a in ang]
        loops, poles = [], []
        if cap0:
            c, r, Nn, Bb = rings[0]
            poles.append((bm.verts.new(c - T[0] * r * capk), 0))
            for j in (2, 1):
                a = j / 3 * math.pi / 2
                loops.append(mk(c - T[0] * r * math.sin(a) * capk, r * math.cos(a), Nn, Bb))
        body = rings[:-1] if tip else rings
        for c, r, Nn, Bb in body:
            loops.append(mk(c, r, Nn, Bb))
        if tip:
            poles.append((bm.verts.new(rings[-1][0]), -1))
        elif cap1:
            c, r, Nn, Bb = rings[-1]
            for j in (1, 2):
                a = j / 3 * math.pi / 2
                loops.append(mk(c + T[-1] * r * math.sin(a) * capk, r * math.cos(a), Nn, Bb))
            poles.append((bm.verts.new(c + T[-1] * r * capk), -1))
        faces = []
        for A, B in zip(loops, loops[1:]):
            for j in range(seg):
                faces.append(bm.faces.new((A[j], A[(j + 1) % seg], B[(j + 1) % seg], B[j])))
        for pv, idx in poles:
            ring = loops[idx]
            for j in range(seg):
                faces.append(bm.faces.new((pv, ring[(j + 1) % seg], ring[j]) if idx == 0 else (pv, ring[j], ring[(j + 1) % seg])))
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        verts = [v for lp in loops for v in lp] + [p for p, _ in poles]
        self._paint(verts, col, ink)
        return rings

    # ── caja redondeada: centro c, medidas s, radio de las esquinas rad ──
    def rbox(self, col, c, s, r=(0, 0, 0), rad=0.03, ink=True):
        h = [x / 2 for x in s]
        rad = min(rad, *[x * 0.999 for x in h])
        # muestras por eje: caras planas + 3 pasos por esquina (ángulos 0°, 15°, 30°, 45° en cada cara)
        def axis(hh):
            inn = hh - rad
            off = [rad * math.tan(math.radians(a)) for a in (15, 30)]
            pos = [inn] + [inn + o for o in off] + [hh]
            return sorted(set([-p for p in pos] + pos))
        ax = [axis(x) for x in h]
        bm = self.bm
        cache, faces = {}, []
        def vert(p):
            key = tuple(round(x, 7) for x in p)
            if key not in cache:
                q = V(*p)
                inner = V(*[max(-(h[i] - rad), min(h[i] - rad, q[i])) for i in range(3)])
                d = q - inner
                cache[key] = bm.verts.new(inner + d.normalized() * rad if d.length > 1e-9 else q)
            return cache[key]
        for k in range(3):  # eje normal de la cara
            i, j = [a for a in range(3) if a != k]
            for sg in (-1, 1):
                for a0, a1 in zip(ax[i], ax[i][1:]):
                    for b0, b1 in zip(ax[j], ax[j][1:]):
                        qs = []
                        for u, w in ((a0, b0), (a1, b0), (a1, b1), (a0, b1)):
                            p = [0, 0, 0]
                            p[k], p[i], p[j] = sg * h[k], u, w
                            qs.append(vert(p))
                        if len(set(qs)) < 3:
                            continue
                        qs = list(dict.fromkeys(qs))
                        faces.append(bm.faces.new(qs if sg > 0 else qs[::-1]))
        m = Matrix.Translation(V(*c)) @ Euler(r, 'XYZ').to_matrix().to_4x4()
        verts = list(cache.values())
        bmesh.ops.transform(bm, matrix=m, verts=verts)
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        self._paint(verts, col, ink)

    # ── mancha / placa sobre una superficie: punto p, normal n (along = dirección del largo) ──
    def decal(self, col, p, n, size, thick=0.014, rot=0.0, ink=True, along=None):
        n = V(*n).normalized()
        if along is not None:
            ax = V(*along)
            ax = (ax - n * ax.dot(n)).normalized()
            q = Matrix((ax, n.cross(ax), n)).transposed().to_4x4() @ Matrix.Rotation(rot, 4, 'Z')
        else:
            q = V(0, 0, 1).rotation_difference(n).to_matrix().to_4x4() @ Matrix.Rotation(rot, 4, 'Z')
        m = Matrix.Translation(V(*p) - n * thick * 0.2) @ q @ Matrix.Diagonal((size[0] / 2, size[1] / 2, thick / 2, 1))
        res = bmesh.ops.create_uvsphere(self.bm, u_segments=12 if max(size) < 0.1 else 16, v_segments=6, radius=1, matrix=m)
        self._paint(res['verts'], col, ink)
        return res['verts']

    def spot(self, col, c, s, r, d, size, thick=0.014, rot=0.0, ink=True, along=None):
        """Mancha sobre el elipsoide (c, s, r) en la dirección d (en el marco del elipsoide), pegada a su curva."""
        h = V(s[0] / 2, s[1] / 2, s[2] / 2)
        d = V(*d).normalized()
        t = 1 / math.sqrt((d.x / h.x) ** 2 + (d.y / h.y) ** 2 + (d.z / h.z) ** 2)
        p = d * t
        nr = V(p.x / h.x ** 2, p.y / h.y ** 2, p.z / h.z ** 2)
        R = Euler(r, 'XYZ').to_matrix()
        C = V(*c)
        pw, nw = C + R @ p, (R @ nr).normalized()
        verts = self.decal(col, pw, nw, size, thick, rot, ink, along)
        # se dobla sobre la superficie para que las manchas largas no queden flotando
        for v in verts:
            ht = (v.co - pw).dot(nw) + thick * 0.2
            q = R.transposed() @ (v.co - nw * ht - C)
            q = V(q.x / h.x, q.y / h.y, q.z / h.z).normalized()
            sp = V(q.x * h.x, q.y * h.y, q.z * h.z)
            sn = (R @ V(sp.x / h.x ** 2, sp.y / h.y ** 2, sp.z / h.z ** 2)).normalized()
            v.co = C + R @ sp + sn * (ht + thick * 0.3)

    def eye(self, c, r, look, kind='dot'):
        """'dot' = ojo negro brillante; 'toy' = blanco con pupila."""
        c, d = V(*c), V(*look).normalized()
        up = V(0, 1, 0)
        if kind == 'toy':
            self.ell('#fffdf5', c, (2 * r,) * 3)
            self.ell('#151010', c + d * r * 0.45, (1.25 * r,) * 3, ink=False)
            self.ell('#ffffff', c + d * r * 0.85 + up * r * 0.25, (0.4 * r,) * 3, seg=(8, 6), ink=False)
        else:
            self.ell('#120c0a', c, (2 * r,) * 3)
            self.ell('#ffffff', c + d * r * 0.78 + up * r * 0.32, (0.5 * r,) * 3, seg=(8, 6), ink=False)

    def build(self, coll, mat, ink):
        bm = self.bm
        k = getattr(self, 'scale', 1.0)
        bm.transform(TO_BL @ Matrix.Diagonal((k, k, k, 1)))
        bm.normal_update()
        me = bpy.data.meshes.new(self.name)
        bm.to_mesh(me)
        bm.free()
        me.color_attributes.active_color = me.color_attributes['Col']
        me.materials.append(mat)
        me.materials.append(ink)
        o = bpy.data.objects.new(self.name, me)
        coll.objects.link(o)
        o.vertex_groups.new(name='Tinta')
        s = o.modifiers.new('Contorno', 'SOLIDIFY')
        s.thickness, s.offset = INK_T, 1.0
        s.use_flip_normals, s.use_rim, s.use_quality_normals = True, False, True
        s.material_offset = 1
        s.vertex_group, s.thickness_vertex_group = 'Tinta', 0.0
        return o


def spots_ring(m, rings, every, cols, size, phase=0):
    """Manchas a lo largo de un tubo, del lado de arriba/afuera."""
    for i in range(phase, len(rings), every):
        c, r, Nn, Bb = rings[i]
        T = Nn.cross(Bb)
        out = V(c.x + 0.03, 0, c.z)
        want = (out.normalized() if out.length > 1e-4 else V(1, 0, 0)) * (0.7 if (i // every) % 2 else -0.2) + V(0, 1, 0)
        d = (want - T * want.dot(T)).normalized()
        k = (i // every) % len(cols)
        m.decal(cols[k], c + d * r, d, size if k == 0 else (size[0] * 0.65, size[1] * 0.65), thick=0.012, rot=0.6 * i)



# ───────────────────────── escena ─────────────────────────
# Sombra caricaturesca: dos tonos con corte nítido (luz / sombra), la sombra teñida de violeta frío
# (no gris) para que los colores sigan vivos. Las sombras que se proyectan (sobre sí mismo y en el piso)
# usan el mismo tono. TOON_CUT es el punto de luz (sol + ambiente) donde empieza la sombra.
SHADOW_TINT = (0.56, 0.5, 0.72)
# Dirección del sol (rotación del objeto Sol). Los modelos calculan luz/sombra con su normal suave y esta
# dirección (sin mapas de sombra): el corte sale liso, sin facetas ni tiras sucias pegadas al contorno.
# Las sombras que los modelos proyectan solo se pintan en el piso.
SUN_ROT = (math.radians(24), 0, math.radians(70))  # sol alto: las sombras entre partes caen hacia abajo
MODEL_CUT = -0.05  # N·L donde empieza la sombra (un poco por debajo de 0 para que los bordes queden con luz)
# Sombra con tono propio: el matiz de cada color gira hacia el azul violeta (naranja → rojizo, amarillo → naranja,
# verde → azulado, café → vino, rojo → carmesí), con más saturación y menos valor. Los grises y blancos usan SHADOW_TINT.
HUE_TARGET, HUE_SHIFT, SHADOW_SAT, SHADOW_VAL = 0.72, 0.09, 1.05, 0.58
# Brillo: tercer tono claro donde la superficie mira casi directo al sol.
HL_CUT, HL_COLOR, HL_AMOUNT = 0.93, (1.0, 0.97, 0.9), 0.16
# Sombras entre partes (la cabeza sobre el cuerpo, el casco sobre la cara…): se leen del mapa de sombras solo donde
# la superficie está bien iluminada (N·L > CAST_GATE), así no aparecen facetas cerca del borde luz/sombra.
# SUN_K y AMB_V se midieron en EEVEE con este sol y este ambiente (luz = AMB_V + SUN_K · N·L).
SUN_K, AMB_V, CAST_GATE = 0.66, 0.40, 0.3
TOON_CUT = 0.55
SUN_ENERGY = 2.6
AMBIENT = 0.5


def _si(node, ident):
    return next(x for x in node.inputs if x.identifier == ident)


def _so(node, ident):
    return next(x for x in node.outputs if x.identifier == ident)


def _toon_nodes(mat, color_attr=None, color=None):
    try:
        mat.use_nodes = True
    except Exception:
        pass
    nt = mat.node_tree
    nt.nodes.clear()
    if color_attr:
        src = nt.nodes.new('ShaderNodeAttribute')
        src.attribute_name = color_attr
        col_out = src.outputs['Color']
    else:
        src = nt.nodes.new('ShaderNodeRGB')
        src.outputs[0].default_value = color
        col_out = src.outputs[0]
    dif = nt.nodes.new('ShaderNodeBsdfDiffuse')
    s2r = nt.nodes.new('ShaderNodeShaderToRGB')
    ramp = nt.nodes.new('ShaderNodeValToRGB')  # 0 = sombra, 1 = luz
    ramp.color_ramp.interpolation = 'LINEAR'  # corte nítido con un borde muy corto (sin dientes de sierra)
    e = ramp.color_ramp.elements
    e[0].position, e[0].color = (TOON_CUT - 0.02) / 4.0, (0, 0, 0, 1)
    e[1].position, e[1].color = (TOON_CUT + 0.02) / 4.0, (1, 1, 1, 1)  # el valor del ramp se divide entre 4 (math)
    div = nt.nodes.new('ShaderNodeMath')
    div.operation = 'DIVIDE'
    div.inputs[1].default_value = 4.0
    bw = nt.nodes.new('ShaderNodeRGBToBW')
    tint = nt.nodes.new('ShaderNodeMix')
    tint.data_type, tint.blend_type = 'RGBA', 'MULTIPLY'
    tint.inputs['Factor'].default_value = 1.0
    _si(tint, 'B_Color').default_value = (*SHADOW_TINT, 1)
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type, mix.blend_type = 'RGBA', 'MIX'
    em = nt.nodes.new('ShaderNodeEmission')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    L = nt.links
    L.new(dif.outputs['BSDF'], s2r.inputs['Shader'])
    L.new(s2r.outputs['Color'], bw.inputs['Color'])
    L.new(bw.outputs['Val'], div.inputs[0])
    L.new(div.outputs['Value'], ramp.inputs['Fac'])
    L.new(col_out, _si(tint, 'A_Color'))
    L.new(_so(tint, 'Result_Color'), _si(mix, 'A_Color'))
    L.new(col_out, _si(mix, 'B_Color'))
    L.new(ramp.outputs['Color'], mix.inputs['Factor'])
    L.new(_so(mix, 'Result_Color'), em.inputs['Color'])
    L.new(em.outputs['Emission'], out.inputs['Surface'])
    for i, nd in enumerate((src, dif, s2r, bw, div, ramp, tint, mix, em, out)):
        nd.location = (i * 200 - 900, 0 if nd not in (tint,) else -250)
    return mat


def toon_material():
    """Toon de tres tonos para los modelos: brillo, luz y sombra con tono propio; corte con la normal suave
    y sombras entre partes tomadas del mapa de sombras solo en las zonas bien iluminadas."""
    mat = bpy.data.materials.get('Animal_Toon') or bpy.data.materials.new('Animal_Toon')
    try:
        mat.use_nodes = True
    except Exception:
        pass
    nt = mat.node_tree
    nt.nodes.clear()
    N, Lk = nt.nodes, nt.links
    pos = [0]

    def node(kind, **kw):
        n = N.new(kind)
        n.location = ((pos[0] % 6) * 200 - 1200, -(pos[0] // 6) * 220)
        pos[0] += 1
        for k, v in kw.items():
            setattr(n, k, v)
        return n

    def math_(op, a, b=None, clamp=False):
        n = node('ShaderNodeMath', operation=op, use_clamp=clamp)
        for i, x in enumerate((a, b)):
            if x is None:
                continue
            if isinstance(x, (int, float)):
                n.inputs[i].default_value = x
            else:
                Lk.new(x, n.inputs[i])
        return n.outputs[0]

    def mix(fac, a, b, blend='MIX'):
        n = node('ShaderNodeMix', data_type='RGBA', blend_type=blend)
        for sock, x in ((n.inputs['Factor'], fac), (_si(n, 'A_Color'), a), (_si(n, 'B_Color'), b)):
            if isinstance(x, (int, float)):
                sock.default_value = x
            elif isinstance(x, tuple):
                sock.default_value = (*x, 1) if len(x) == 3 else x
            else:
                Lk.new(x, sock)
        return _so(n, 'Result_Color')

    def step(val, cut, w=0.025):
        n = node('ShaderNodeMapRange', clamp=True)
        Lk.new(val, n.inputs['Value'])
        n.inputs['From Min'].default_value = cut - w
        n.inputs['From Max'].default_value = cut + w
        return n.outputs['Result']

    col = node('ShaderNodeAttribute', attribute_name='Col').outputs['Color']
    # ── N·L con la normal suave ──
    geo = node('ShaderNodeNewGeometry')
    L = Euler(SUN_ROT, 'XYZ').to_matrix() @ Vector((0, 0, 1))
    lv = node('ShaderNodeCombineXYZ')
    for i, k in enumerate('XYZ'):
        lv.inputs[k].default_value = L[i]
    dn = node('ShaderNodeVectorMath', operation='DOT_PRODUCT')
    Lk.new(geo.outputs['Normal'], dn.inputs[0])
    Lk.new(lv.outputs['Vector'], dn.inputs[1])
    ndl = dn.outputs['Value']
    # ── sombra proyectada por otras partes (mapa de sombras del sol) ──
    dif = node('ShaderNodeBsdfDiffuse')
    s2r = node('ShaderNodeShaderToRGB')
    Lk.new(dif.outputs['BSDF'], s2r.inputs['Shader'])
    bw = node('ShaderNodeRGBToBW')
    Lk.new(s2r.outputs['Color'], bw.inputs['Color'])
    sun_part = math_('SUBTRACT', bw.outputs['Val'], AMB_V)
    expected_half = math_('MULTIPLY', ndl, SUN_K * 0.4)
    cast = math_('LESS_THAN', sun_part, expected_half)
    cast = math_('MULTIPLY', cast, step(ndl, CAST_GATE, 0.05))
    no_cast = math_('SUBTRACT', 1.0, cast)
    lit = math_('MULTIPLY', step(ndl, MODEL_CUT), no_cast)
    hl = math_('MULTIPLY', step(ndl, HL_CUT), no_cast)
    # ── color de sombra con tono propio ──
    sep = node('ShaderNodeSeparateColor', mode='HSV')
    Lk.new(col, sep.inputs['Color'])
    h, sat, val = sep.outputs[0], sep.outputs[1], sep.outputs[2]
    d = math_('SUBTRACT', math_('FLOORED_MODULO', math_('ADD', math_('SUBTRACT', HUE_TARGET, h), 0.5), 1.0), 0.5)
    h2 = math_('FRACT', math_('ADD', h, math_('MULTIPLY', d, HUE_SHIFT)))
    s2 = math_('MULTIPLY', sat, SHADOW_SAT, clamp=True)
    v2 = math_('MULTIPLY', val, SHADOW_VAL)
    comb = node('ShaderNodeCombineColor', mode='HSV')
    Lk.new(h2, comb.inputs[0])
    Lk.new(s2, comb.inputs[1])
    Lk.new(v2, comb.inputs[2])
    grey_shadow = mix(1.0, col, SHADOW_TINT, 'MULTIPLY')
    shadow = mix(math_('MULTIPLY', sat, 4.0, clamp=True), grey_shadow, comb.outputs['Color'])
    bright = mix(HL_AMOUNT, col, HL_COLOR)
    out_col = mix(hl, mix(lit, shadow, col), bright)
    em = node('ShaderNodeEmission')
    Lk.new(out_col, em.inputs['Color'])
    out = node('ShaderNodeOutputMaterial')
    Lk.new(em.outputs['Emission'], out.inputs['Surface'])
    return mat


def ink_material():
    mat = bpy.data.materials.get('Tinta') or bpy.data.materials.new('Tinta')
    try:
        mat.use_nodes = True
    except Exception:
        pass
    nt = mat.node_tree
    nt.nodes.clear()
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*lin(INK), 1)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    mat.use_backface_culling = True
    if hasattr(mat, 'use_backface_culling_shadow'):
        mat.use_backface_culling_shadow = True
    mat.diffuse_color = (*lin(INK), 1)
    return mat



def build_scene(name, models, lineup, gap=0.85, place=None, lift=None):
    """Crea (o rehace) la escena `name` con los modelos; los de `lineup` quedan en fila girados 3/4.
    place(objs) acomoda las piezas que van unidas (alas, brazos…)."""
    old = bpy.data.scenes.get(name)
    if old:
        for o in list(old.objects):
            bpy.data.objects.remove(o)
        bpy.data.scenes.remove(old)
    pre = (name + '_modelos', name + '_escena')
    for c in list(bpy.data.collections):
        if c.name.startswith(pre):
            bpy.data.collections.remove(c)
    for coll_data in (bpy.data.lights, bpy.data.cameras, bpy.data.meshes):
        for d in list(coll_data):
            if d.name.startswith((name + '_sol', name + '_camara', name + '_piso')) and d.users == 0:
                coll_data.remove(d)
    for mdl in models:
        me = bpy.data.meshes.get(mdl.name)
        if me and me.users == 0:
            bpy.data.meshes.remove(me)
    sc = bpy.data.scenes.new(name)
    coll = bpy.data.collections.new(pre[0])
    sc.collection.children.link(coll)
    mat, ink = toon_material(), ink_material()
    objs = {mdl.name: mdl.build(coll, mat, ink) for mdl in models}
    for i, nm in enumerate(lineup):
        objs[nm].location = (i * gap, 0, (lift or {}).get(nm, 0))
        objs[nm].rotation_euler = (0, 0, -0.5)
    if place:
        place(objs, coll)
    extra = bpy.data.collections.new(pre[1])
    sc.collection.children.link(extra)
    world = bpy.data.worlds.get('Animales_mundo') or bpy.data.worlds.new('Animales_mundo')
    sc.world = world
    try:
        world.use_nodes = True
    except Exception:
        pass
    bg = world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs['Color'].default_value = (0.95, 0.9, 0.8, 1)
        bg.inputs['Color'].default_value = (1, 1, 1, 1)
        bg.inputs['Strength'].default_value = AMBIENT
    sun = bpy.data.objects.new('Sol', bpy.data.lights.new(name + '_sol', 'SUN'))
    sun.data.energy = SUN_ENERGY
    sun.data.angle = math.radians(0.5)  # sombras de borde duro
    sun.data.color = (1, 1, 1)
    # luz alta y de lado (derecha): las caras y la parte de arriba quedan con luz y la sombra cae en zonas amplias
    # (espalda y panza), sin tiras delgadas de sombra pegadas al contorno
    sun.rotation_euler = SUN_ROT
    for k, v in (('shadow_maximum_resolution', 0.0002), ('use_shadow_jitter', False), ('shadow_filter_radius', 0.6),
                 ('shadow_resolution_scale', 1.0)):
        if hasattr(sun.data, k):
            setattr(sun.data, k, v)
    extra.objects.link(sun)
    fme = bpy.data.meshes.new(name + '_piso')
    fme.from_pydata([(-6, -6, 0), (16, -6, 0), (16, 30, 0), (-6, 30, 0)], [], [(0, 1, 2, 3)])
    floor = bpy.data.objects.new('Piso', fme)
    fm = bpy.data.materials.get('Animales_piso') or bpy.data.materials.new('Animales_piso')
    fm.diffuse_color = (0.93, 0.87, 0.74, 1)
    _toon_nodes(fm, color=(0.93, 0.87, 0.74, 1))  # el piso recibe la sombra con el mismo tono
    fme.materials.append(fm)
    extra.objects.link(floor)
    cam = bpy.data.objects.new('Camara', bpy.data.cameras.new(name + '_camara'))
    extra.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO'
    cx = (len(lineup) - 1) * gap / 2
    cam.data.ortho_scale = max(2.2, len(lineup) * gap + 0.3)
    cam.location = (cx, -8, 2.6)
    cam.rotation_euler = (math.radians(73), 0, 0)
    sc.render.resolution_x, sc.render.resolution_y = (2400, 520) if len(lineup) > 3 else (1600, 900)
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            sc.render.engine = eng
            break
        except Exception:
            pass
    sc.view_settings.view_transform = 'Standard'
    try:
        bpy.context.window.scene = sc
    except Exception:
        for w in bpy.context.window_manager.windows:
            w.scene = sc
    return sc, objs


AO_DIST, AO_K = 0.12, 0.45  # alcance (casillas) y fuerza de la oclusión ambiental horneada


def bake_ao(scene, objs, samples=48):
    """Hornea oclusión ambiental (Cycles) en el atributo de color "AO" de cada pieza, en la pose de la escena
    (así las piernas oscurecen un poco el cuerpo, la cabeza el cuello, el suelo los pies). Sin el contorno."""
    sc = scene
    prev = (sc.render.engine, sc.cycles.samples if hasattr(sc, 'cycles') else None)
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = samples
    sc.world.light_settings.distance = AO_DIST
    mods = [m for o in sc.objects for m in o.modifiers if m.type == 'SOLIDIFY' and m.show_render]
    for m in mods:
        m.show_render = False
    vl = sc.view_layers[0]
    for o in objs.values():
        me = o.data
        if 'AO' not in me.color_attributes:
            me.color_attributes.new('AO', 'FLOAT_COLOR', 'CORNER')
        me.color_attributes.active_color = me.color_attributes['AO']
        with bpy.context.temp_override(scene=sc, view_layer=vl, active_object=o, object=o, selected_objects=[o],
                                       selected_editable_objects=[o]):
            bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
        me.color_attributes.active_color = me.color_attributes['Col']
    for m in mods:
        m.show_render = True
    sc.render.engine = prev[0]


def export_glb(path, objs):
    """Exporta cada pieza en su origen (sin el modificador del contorno) para el juego.
    El peso del grupo "Tinta" viaja en el alfa del color (0 = esa parte no lleva contorno en el juego) y, si se
    horneó la oclusión (bake_ao), oscurece un poco el color. Llamar justo después de construir los modelos."""
    for o in objs.values():
        ao = o.data.color_attributes.get('AO')
        if ao:
            col = o.data.color_attributes['Col']
            for i, d in enumerate(col.data):
                a = ao.data[i].color[0]
                k = 1.0 - AO_K * (1.0 - a)
                c = d.color
                d.color = (c[0] * k, c[1] * k, c[2] * k, c[3])
            # el exportador toma el color "de render": que sea Col (el AO ya va multiplicado en él)
            o.data.color_attributes.remove(ao)
    for o in objs.values():
        me, g = o.data, o.vertex_groups.get('Tinta')
        ink = [0.0] * len(me.vertices)
        if g:
            for v in me.vertices:
                for e in v.groups:
                    if e.group == g.index:
                        ink[v.index] = e.weight
        col = me.color_attributes['Col']
        for l in me.loops:
            c = col.data[l.index].color
            col.data[l.index].color = (c[0], c[1], c[2], ink[l.vertex_index])
    saved = {o: (o.parent, o.location.copy(), o.rotation_euler.copy()) for o in objs.values()}
    for o in objs.values():
        o.parent = None
        o.location = (0, 0, 0)
        o.rotation_euler = (0, 0, 0)
    # escena temporal solo con estas piezas: así no se cuela nada más que esté seleccionado en otras escenas
    tmp = bpy.data.scenes.new('_exportar')
    for o in objs.values():
        tmp.collection.objects.link(o)
    with bpy.context.temp_override(scene=tmp, view_layer=tmp.view_layers[0]):
        for o in objs.values():
            ca = o.data.color_attributes
            ca.active_color = ca['Col']
            ca.render_color_index = ca.active_color_index
        bpy.ops.export_scene.gltf(filepath=path, use_selection=False, use_active_scene=True, export_format='GLB',
                                  export_materials='NONE', export_vertex_color='ACTIVE', export_texcoords=False,
                                  export_yup=True, export_apply=False)
    bpy.data.scenes.remove(tmp)
    for o, (p, l, r) in saved.items():
        o.parent, o.location, o.rotation_euler = p, l, r


