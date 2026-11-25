# Amazonas vs Leñadores — invasores de DEFORESTA S.A., mismo estilo que los animales (blender/estilo.py).
#
# Leñadores: un modelo BASE (sin accesorios) y sus variaciones, que suman ropa, pelo, casco y herramienta:
#   lenador        base de referencia (no se usa en el juego)
#   independiente  sin casco, pelo despeinado, barba de tres días, camisa de cuadros, hacha
#   profesional    casco blanco, uniforme naranja con franjas reflectivas y logo, hacha
#   motosierra     casco amarillo con protectores de oídos, uniforme naranja, motosierra
# Máquinas (mismas medidas del juego): excavadora, bulldozer, astilladora y desbrozadora.
#
# Cada uno se divide en piezas para animarlo en el juego (mismo rig que src/invaders.js):
#   <tipo>_cuerpo  torso + cabeza + brazo de atrás (fijo)        origen en el suelo
#   <tipo>_pierna  pierna con bota; pivote en la cadera (y 0,2)  se usa dos veces (z ±0,065)
#   <tipo>_brazo   brazo de adelante con la herramienta; pivote en el hombro (y 0,47, z 0,15)
# Unidades = casillas; miran hacia +x (coordenadas de three.js, como en animales.py).
import bpy, bmesh, math, os, sys, importlib

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.getcwd()
sys.path.insert(0, HERE)
import estilo
importlib.reload(estilo)
from estilo import V, Model, export_glb, build_scene

DARK = '#21170f'
HIP = (0, 0.2, 0.065)
SHOULDER = (0, 0.47, 0.15)
HEAD = ((0, 0.665, 0), (0.34, 0.33, 0.34), (0, 0, 0))
TORSO = ((0, 0.38, 0), (0.27, 0.34, 0.25), (0, 0, 0))

TIPOS = {
    'lenador': dict(skin='#e9b58c', hair='#3b2a1e', shirt='#c8423a', pants='#3e5f8f', boots='#6b4428'),
    'independiente': dict(skin='#e9b58c', hair='#3b2a1e', shirt='#c8423a', pants='#3e5f8f', boots='#6b4428',
                          plaid='#7a1f1a', beard='#a67b5c', messy=True, tool='hacha'),
    'profesional': dict(skin='#d9a07a', hair='#2a1e16', shirt='#ff8a2a', pants='#3d4a5a', boots='#2b2b2b',
                        hat='#f6f5ef', hat2='#d9d8d0', reflect='#f4f4ee', logo='#2d6a9f', tool='hacha'),
    'motosierra': dict(skin='#c98e62', hair='#1e1612', shirt='#ff8a2a', pants='#3d4a5a', boots='#2b2b2b',
                       hat='#ffd23f', hat2='#e6b800', reflect='#f4f4ee', logo='#2d6a9f', muffs='#e04b2a', tool='motosierra'),
}


def bandas(m, c, ys, sleeve=False):
    """Franjas horizontales que rodean el torso (cuadros o cinta reflectiva)."""
    for y in ys:
        m.ell(c, (0, y, 0), (0.275, 0.022, 0.258), ink=False)


def cuerpo(nm, t):
    m = Model(nm + '_cuerpo')
    m.ell(t['pants'], (0, 0.24, 0), (0.25, 0.15, 0.24))  # cadera
    m.ell(t['shirt'], *TORSO)
    m.ell(t['shirt'], (-0.005, 0.47, 0), (0.25, 0.12, 0.3))  # hombros
    m.ell(t['skin'], *HEAD)
    for s in (1, -1):
        m.ell(t['skin'], (-0.005, 0.655, 0.168 * s), (0.05, 0.075, 0.04))  # oreja
        m.eye((0.148, 0.685, 0.062 * s), 0.022, (1, 0, 0.35 * s))
        m.tube(DARK, [(0.16, 0.722, 0.028 * s), (0.15, 0.738, 0.092 * s)], 0.008, 0.007, seg=6, ink=False)  # ceja de malo
    m.ell(t['skin'], (0.172, 0.64, 0), (0.055, 0.05, 0.055))  # nariz
    m.tube(DARK, [(0.15, 0.6, -0.03), (0.155, 0.603, 0), (0.15, 0.6, 0.03)], 0.004, seg=6, ink=False)  # boca
    # brazo de atrás (fijo en el cuerpo)
    m.tube(t['shirt'], [(0, 0.47, -0.15), (0.03, 0.37, -0.17), (0.05, 0.3, -0.165)], 0.04, 0.036, seg=10)
    m.ell(t['skin'], (0.058, 0.265, -0.165), (0.075, 0.075, 0.075))

    # ── pelo ──
    if 'hat' not in t:
        m.ell(t['hair'], (-0.03, 0.735, 0), (0.33, 0.21, 0.355), (0, 0, 0.25))
    if t.get('messy'):
        for x, z, dx, dz in ((0.06, 0.0, 0.07, 0.02), (0.02, 0.07, 0.04, 0.07), (0.02, -0.07, 0.04, -0.07),
                             (-0.06, 0.04, -0.03, 0.06), (-0.06, -0.04, -0.03, -0.06), (-0.1, 0.0, -0.08, 0.0)):
            m.tube(t['hair'], [(x, 0.8, z), (x + dx * 0.6, 0.86, z + dz * 0.6), (x + dx, 0.88, z + dz)], 0.04, 0.008, seg=8, tip=True)
    if 'beard' in t:  # barba de tres días en la mandíbula
        m.spot(t['beard'], *HEAD, (0.62, -0.7, 0), (0.3, 0.15), thick=0.012, along=(0, 0, 1), ink=False)
    # ── casco de seguridad ──
    if 'hat' in t:
        for s in (1, -1):
            m.ell(t['hair'], (-0.02, 0.68, 0.152 * s), (0.08, 0.1, 0.05))  # patillas bajo el casco
        m.ell(t['hat'], (0, 0.758, 0), (0.37, 0.3, 0.37), half=True)  # domo (solo la mitad de arriba)
        m.ell(t['hat'], (0.03, 0.758, 0), (0.45, 0.035, 0.42))  # ala, por encima de las cejas
        m.tube(t['hat2'], [(-0.16, 0.85, 0), (-0.08, 0.895, 0), (0, 0.91, 0), (0.08, 0.895, 0), (0.16, 0.85, 0)], 0.022, seg=8)  # cresta
    if 'muffs' in t:  # protectores de oídos
        for s in (1, -1):
            m.ell(t['muffs'], (-0.005, 0.655, 0.18 * s), (0.11, 0.11, 0.045))
            m.ell('#3a3a3a', (-0.005, 0.655, 0.157 * s), (0.08, 0.08, 0.03))
    # ── ropa ──
    if 'plaid' in t:  # camisa de cuadros
        bandas(m, t['plaid'], (0.33, 0.43))
        for d in ((1, 0, 0.35), (1, 0, -0.35), (-1, 0, 0.35), (-1, 0, -0.35), (0, 0, 1), (0, 0, -1)):
            m.spot(t['plaid'], *TORSO, d, (0.3, 0.022), thick=0.01, along=(0, 1, 0), ink=False)
        for y in (0.42, 0.36):  # cuadros en la manga de atrás
            m.ell(t['plaid'], (0.0 + (0.47 - y) * 0.3, y, -0.158), (0.088, 0.016, 0.088), ink=False)
    if 'reflect' in t:  # uniforme con cinta reflectiva y logo
        bandas(m, t['reflect'], (0.31, 0.41))
        m.spot(t['logo'], *TORSO, (1, 0.45, 0.5), (0.05, 0.05), thick=0.012)
        m.ell(t['reflect'], (0.025, 0.4, -0.163), (0.09, 0.02, 0.09), ink=False)
    m.ell('#3b2a1c', (0, 0.255, 0), (0.262, 0.035, 0.252), ink=False)  # cinturón
    return m


def pierna(nm, t):
    m = Model(nm + '_pierna')
    m.tube(t['pants'], [(0, 0, 0), (0, -0.15, 0)], 0.05, 0.046, seg=10)
    m.ell(t['boots'], (0.03, -0.172, 0), (0.135, 0.07, 0.095))
    if 'reflect' in t:
        m.ell(t['reflect'], (0, -0.1, 0), (0.104, 0.018, 0.104), ink=False)
    return m


def brazo(nm, t):
    m = Model(nm + '_brazo')
    m.tube(t['shirt'], [(0, 0, 0), (0.012, -0.1, 0.01), (0.01, -0.165, 0)], 0.04, 0.036, seg=10)
    m.ell(t['skin'], (0.01, -0.2, 0), (0.075, 0.075, 0.075))
    if 'plaid' in t:
        for y in (-0.05, -0.11):
            m.ell(t['plaid'], (0.008, y, 0.005), (0.088, 0.016, 0.088), ink=False)
    if 'reflect' in t:
        m.ell(t['reflect'], (0.008, -0.08, 0.005), (0.09, 0.02, 0.09), ink=False)
    tool = t.get('tool')
    if tool == 'hacha':
        m.tube('#9a6a3a', [(0.01, -0.15, 0), (0.0, -0.45, 0)], 0.018, 0.02, seg=8)  # mango
        m.ell('#b3bdc2', (-0.055, -0.39, 0), (0.13, 0.1, 0.034))  # cabeza del hacha
        m.ell('#e9eef0', (-0.115, -0.39, 0), (0.035, 0.125, 0.038))  # filo
    elif tool == 'motosierra':
        m.ell('#ff7a1a', (0.0, -0.27, 0), (0.16, 0.17, 0.12))  # motor
        m.ell('#2d3436', (0.06, -0.24, 0), (0.05, 0.09, 0.13))  # tapa
        m.tube('#2d3436', [(-0.04, -0.2, 0.065), (-0.06, -0.16, 0), (-0.04, -0.2, -0.065)], 0.012, seg=6)  # agarradera
        m.ell('#a6b1b4', (0.23, -0.28, 0), (0.34, 0.06, 0.024))  # espada, apuntando hacia adelante
        m.ell('#2b2b2b', (0.23, -0.28, 0), (0.36, 0.078, 0.012))  # cadena
    return m


models = []
for nm, t in TIPOS.items():
    models += [cuerpo(nm, t), pierna(nm, t), brazo(nm, t)]


# ───────────────────────── máquinas ─────────────────────────
# Juguetes de construcción con cara: cabina con ventana, ojos y cejas de malo.
# Piezas que se animan aparte: excavadora_brazo (pivote ARM_POS) y desbrozadora_tambor (pivote DRUM_POS).
TRACK, ROLLER, WIN, STEEL, STEEL2 = '#38393b', '#8a8f92', '#9fd6ea', '#8f9a9c', '#d9dee0'
MAQ_S = 1.35  # las máquinas se modelan a la escala de antes y se agrandan al construirlas
ARM_POS = (0.18, 0.45, 0.12)
DRUM_POS = (0.62, 0.17, 0)


def orugas(m, length, z, h=0.2):
    for s in (1, -1):
        m.rbox(TRACK, (0, h / 2, s * z), (length, h, 0.2), rad=h * 0.45)
        for i in range(4):
            x = -length * 0.34 + i * length * 0.68 / 3
            m.tube(ROLLER, [(x, h / 2, s * (z + 0.095)), (x, h / 2, s * (z + 0.112))], 0.055, seg=12, capk=0.3)


def ruedas(m, xs, z, r):
    for x in xs:
        for s in (1, -1):
            m.tube('#2b2b2b', [(x, r, s * (z - 0.06)), (x, r, s * (z + 0.06))], r, seg=16, capk=0.35)
            m.ell('#c9cdd0', (x, r, s * (z + 0.06)), (r * 0.9, r * 0.9, 0.025), ink=False)


def cabina(m, x, y, z, w, h, d, col):
    m.rbox(col, (x, y, z), (w, h, d), rad=0.05)
    fx = x + w / 2
    m.rbox(WIN, (fx - 0.006, y + h * 0.08, z), (0.03, h * 0.62, d * 0.8), rad=0.012)
    for s in (1, -1):
        m.eye((fx + 0.012, y + h * 0.08, z + s * d * 0.19), 0.036, (1, 0, 0.15 * s), kind='toy')
        m.tube(DARK, [(fx + 0.02, y + h * 0.27, z + s * d * 0.06), (fx + 0.02, y + h * 0.36, z + s * d * 0.32)], 0.012, seg=6, ink=False)


def escape(m, a, b, r=0.027):
    m.tube('#3a3a3a', [a, b], r, r * 1.15, seg=10, capk=0.3)


def excavadora():
    Y, Y2 = '#f2b705', '#d99a00'
    m = Model('excavadora_cuerpo')
    orugas(m, 0.95, 0.27)
    m.rbox(Y, (-0.05, 0.33, 0), (0.7, 0.24, 0.52), rad=0.06)
    m.rbox(Y2, (-0.38, 0.38, 0), (0.16, 0.28, 0.5), rad=0.06)  # contrapeso
    cabina(m, 0.05, 0.6, -0.1, 0.32, 0.32, 0.28, Y)
    escape(m, (-0.25, 0.45, 0.15), (-0.25, 0.72, 0.15))
    m.ell(Y2, (0.18, 0.45, 0.12), (0.12, 0.12, 0.14))  # base del brazo
    arm = Model('excavadora_brazo')  # pivote en ARM_POS
    arm.tube(Y, [(0, 0, 0), (0.32, 0.3, 0)], 0.06, 0.055, seg=12)
    arm.tube(Y2, [(0.32, 0.3, 0), (0.55, -0.05, 0)], 0.05, 0.045, seg=12)
    arm.ell(STEEL, (0.32, 0.3, 0), (0.08, 0.08, 0.13))  # codo
    arm.rbox('#7f8a8d', (0.58, -0.12, 0), (0.16, 0.14, 0.24), rad=0.04)  # cucharón
    for i in (-1, 0, 1):
        arm.tube(STEEL2, [(0.6, -0.18, i * 0.075), (0.62, -0.24, i * 0.075)], 0.022, 0.004, seg=6, tip=True, cap0=False)
    return [m, arm]


def bulldozer():
    Y, Y2 = '#ffc21a', '#e0a800'
    m = Model('bulldozer_cuerpo')
    orugas(m, 0.95, 0.28)
    m.rbox(Y, (-0.02, 0.35, 0), (0.78, 0.28, 0.54), rad=0.06)
    m.rbox(Y2, (0.24, 0.5, 0), (0.3, 0.06, 0.5), rad=0.025)
    cabina(m, -0.18, 0.66, 0, 0.34, 0.32, 0.4, Y)
    escape(m, (0.18, 0.5, 0.17), (0.18, 0.8, 0.17))
    for s in (1, -1):
        m.tube('#d9ab12', [(0.18, 0.28, s * 0.24), (0.47, 0.18, s * 0.24)], 0.03, seg=10)
    m.rbox(STEEL, (0.5, 0.2, 0), (0.07, 0.32, 0.76), r=(0, 0, 0.18), rad=0.03)  # pala
    m.rbox('#c4ccce', (0.535, 0.045, 0), (0.07, 0.05, 0.76), rad=0.02)  # filo
    return [m]


def astilladora():
    O, O2 = '#f06a1a', '#d65612'
    m = Model('astilladora_cuerpo')
    ruedas(m, (-0.28, 0.12), 0.27, 0.15)
    m.rbox('#2d3436', (-0.08, 0.26, 0), (0.68, 0.06, 0.52), rad=0.025)  # chasis
    m.rbox(O, (-0.08, 0.4, 0), (0.66, 0.3, 0.5), rad=0.06)
    # tolva (embudo) al frente: por ahí se traga los árboles
    m.tube('#9aa5a8', [(0.2, 0.42, 0), (0.5, 0.46, 0)], 0.12, 0.23, seg=16, capk=0.12)
    m.ell('#2d2d2d', (0.528, 0.462, 0), (0.02, 0.4, 0.4), (0, 0, 0.13), ink=False)  # boca
    for i in (-1, 0, 1):
        m.tube('#eef3f5', [(0.535, 0.35, i * 0.09), (0.545, 0.43, i * 0.09)], 0.025, 0.003, seg=6, tip=True, cap0=False, ink=False)
    # chimenea de descarga curva
    m.tube(O, [(-0.25, 0.5, 0), (-0.28, 0.75, 0), (-0.2, 0.92, 0), (-0.05, 0.98, 0)], 0.065, 0.07, seg=12, capk=0.3)
    m.tube(O2, [(-0.05, 0.98, 0), (0.05, 0.96, 0)], 0.085, 0.07, seg=12, capk=0.3)
    for s in (1, -1):
        m.eye((0.255, 0.49, s * 0.19), 0.04, (1, 0.1, 0.25 * s), kind='toy')
        m.tube(DARK, [(0.27, 0.565, s * 0.13), (0.268, 0.6, s * 0.24)], 0.012, seg=6, ink=False)
    return [m]


def desbrozadora():
    R, R2 = '#d63a2a', '#a82a1e'
    m = Model('desbrozadora_cuerpo')
    orugas(m, 1.05, 0.3, 0.22)
    m.rbox(R, (-0.08, 0.38, 0), (0.84, 0.3, 0.6), rad=0.06)
    m.rbox(R2, (-0.08, 0.545, 0), (0.8, 0.05, 0.58), rad=0.02)
    cabina(m, -0.2, 0.74, 0.05, 0.36, 0.34, 0.4, R)
    escape(m, (-0.42, 0.55, -0.2), (-0.42, 0.86, -0.2), 0.03)
    for s in (1, -1):
        m.tube(R2, [(0.18, 0.38, s * 0.3), (0.56, 0.22, s * 0.3)], 0.04, seg=10)
    m.rbox(STEEL, (0.58, 0.33, 0), (0.26, 0.1, 0.76), rad=0.04)  # capota del tambor
    drum = Model('desbrozadora_tambor')  # pivote en DRUM_POS, gira en z
    drum.tube('#5b6366', [(0, 0, -0.33), (0, 0, 0.33)], 0.13, seg=16, capk=0.25)
    for i in range(10):
        a = i / 10 * math.tau
        for zz in (-0.2, 0, 0.2):
            z = zz + (i % 2) * 0.08 - 0.04
            drum.tube('#e9eef0', [(math.cos(a) * 0.11, math.sin(a) * 0.11, z), (math.cos(a) * 0.19, math.sin(a) * 0.19, z)],
                      0.03, 0.004, seg=6, tip=True, cap0=False)
    return [m, drum]


for fn in (excavadora, bulldozer, astilladora, desbrozadora):
    for mm in fn():
        mm.scale = MAQ_S
        models.append(mm)


# ───────────────────────── escena ─────────────────────────
LINEUP = [nm + '_cuerpo' for nm in TIPOS] + ['excavadora_cuerpo', 'bulldozer_cuerpo', 'astilladora_cuerpo', 'desbrozadora_cuerpo']


def place(objs, coll):
    for nm in TIPOS:
        body, leg, arm = objs[nm + '_cuerpo'], objs[nm + '_pierna'], objs[nm + '_brazo']
        leg2 = bpy.data.objects.new(nm + '_pierna_vista', leg.data)  # segunda pierna (solo para verlo armado)
        coll.objects.link(leg2)
        leg2.vertex_groups.new(name='Tinta')
        s = leg2.modifiers.new('Contorno', 'SOLIDIFY')
        for k in ('thickness', 'offset', 'use_flip_normals', 'use_rim', 'use_quality_normals', 'material_offset', 'vertex_group', 'thickness_vertex_group'):
            setattr(s, k, getattr(leg.modifiers['Contorno'], k))
        # three (x, y, z) → blender (x, -z, y)
        for o, (x, y, z) in ((leg, HIP), (leg2, (HIP[0], HIP[1], -HIP[2])), (arm, SHOULDER)):
            o.parent = body
            o.location = (x, -z, y)
            o.rotation_euler = (0, 0, 0)
    for body, part, (x, y, z) in (('excavadora_cuerpo', 'excavadora_brazo', ARM_POS), ('desbrozadora_cuerpo', 'desbrozadora_tambor', DRUM_POS)):
        o = objs[part]
        o.parent = objs[body]
        o.location = (x * MAQ_S, -z * MAQ_S, y * MAQ_S)
        o.rotation_euler = (0, 0, 0)


SCENE, OBJS = build_scene('Invasores', models, LINEUP, 1.6, place)
STATS = {nm: len(o.data.polygons) for nm, o in OBJS.items()}
