# Uso: blender -b --python blender/vegetacion.py -- public/models/vegetacion.glb vista.png
# Extrae la vegetación de la landing de PyCon 2028 a un GLB liviano con colores de vértice (en casillas).
import bpy, bmesh, sys, math
from mathutils import Vector, Matrix
OUT = sys.argv[sys.argv.index('--')+1]
PREV = sys.argv[sys.argv.index('--')+2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"D:/Alejo/Universidad/5to semestre/Interactivo/Pagina_pycon/pycon-landing_v1.1/assets/3d/recorrido-amazonas.glb")
def srgb(h):
    h=h.lstrip('#'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return [x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4 for x in c]
# colores (sRGB) para los materiales procedurales R_* de la landing; los M_* usan su color base
CUSTOM = {'R_hoja_a':'#3f8f2e','R_hoja_b':'#2f7a2a','R_hoja_clara':'#7cbf3e','R_hoja_copa':'#2e7d32','R_hoja_oscura':'#22602a',
  'R_corteza':'#7a5a3a','R_corteza_osc':'#4e3a26','R_liana':'#5b6b2a','R_musgo':'#6aa03a','R_pedunculo':'#6f8f3a',
  'M_Pasto':'#4fa832','M_Hoja':'#3f9a2e','M_Follaje':'#2f8a2a','M_Palma':'#3a8f2c','M_Musgo':'#5fa836','M_Liana':'#4a6b26','M_Corteza':'#7a5a3a'}
def matcol(m):
    if m.name in CUSTOM: return srgb(CUSTOM[m.name])
    b=m.node_tree.nodes.get('Principled BSDF'); c=list(b.inputs['Base Color'].default_value[:3])
    return [min(1,x*1.25) for x in c]  # un poco más vivo para el estilo caricatura
# nombre en el juego → (malla de la landing, altura objetivo en casillas)
PICK = {'helecho':('Planta_Helecho_low',0.55),'pasto':('Pasto_Alto_low',0.34),'heliconia_pl':('Planta_Heliconia_low',0.75),
  'musgo_a':('Arbusto_Musgo_A_low.001',0.3),'musgo_b':('Arbusto_Musgo_B_low.001',0.32),'helecho_arb':('Helecho_Arboreo',1.3),
  'cecropia':('Cecropia',2.6),'aguaje':('Palma_Aguaje',2.4),'bromelia':('Bromelia',0.45),'camalote':('Camalote',0.22),
  'raices':('Raices_Zancudas',1.7),'victoria':('Victoria_Amazonica_A',0.05),'victoria_b':('Victoria_Amazonica_B',0.04),
  'hongos':('Hongos_Suelo',0.18),'orquidea':('Orquidea',0.4),'flores':('Planta_Flores_low',0.4),'roca':('Roca_A_low',0.3),'tronco':('Tronco_Caido',0.35),
  # árboles grandes y frondosos para la orilla de selva
  'arbol_a':('Arbol_Fondo_A_low',2.4),'arbol_b':('Arbol_Fondo_B_low',2.4),'arbol_orilla_a':('Arbol_Orilla_A',2.6),
  'arbol_orilla_b':('Arbol_Orilla_B',2.6),'arbol_orilla_c':('Arbol_Orilla_C',2.4)}
scene=bpy.context.scene
col=bpy.data.collections.new('Vegetacion'); scene.collection.children.link(col)
made=[]
for name,(mesh,h) in PICK.items():
    src=bpy.data.meshes[mesh]
    me=src.copy(); me.name=name
    # color por cara según el material
    bm=bmesh.new(); bm.from_mesh(me)
    cols=[matcol(m) if m else [0.5,0.5,0.5] for m in me.materials]
    lay=bm.loops.layers.float_color.new('Col')
    for f in bm.faces:
        c=cols[f.material_index] if cols else [0.4,0.6,0.3]
        for l in f.loops: l[lay]=(*c,1)
    bm.to_mesh(me); bm.free()
    me.materials.clear()
    for a in list(me.attributes):
        if a.name in ('custom_normal',): me.attributes.remove(a)
    while me.uv_layers: me.uv_layers.remove(me.uv_layers[0])
    o=bpy.data.objects.new(name,me); col.objects.link(o)
    # base centrada en el origen y escala a la altura deseada (en casillas)
    xs=[v.co for v in me.vertices]
    mn=Vector((min(v.x for v in xs),min(v.y for v in xs),min(v.z for v in xs))); mx=Vector((max(v.x for v in xs),max(v.y for v in xs),max(v.z for v in xs)))
    sz=mx-mn
    s = h/sz.z if name not in ('victoria','victoria_b') else 0.75/max(sz.x,sz.y)
    me.transform(Matrix.Translation(-Vector(((mn.x+mx.x)/2,(mn.y+mx.y)/2,mn.z))))
    me.transform(Matrix.Scale(s,4))
    me.color_attributes.active_color = me.color_attributes['Col']
    for p in me.polygons: p.use_smooth = True
    made.append(o)
    print('VEG',name,len(me.polygons),tuple(round(x*s,2) for x in sz))
# borrar todo lo demás
for o in list(bpy.data.objects):
    if o not in made: bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT')
for o in made: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, use_selection=True, export_format='GLB', export_materials='NONE', export_vertex_color='ACTIVE', export_texcoords=False, export_yup=True, export_apply=True)
# hoja de contacto para revisar
for i,o in enumerate(made): o.location=((i%6)*3.0,-(i//6)*3.0,0)
scene.render.engine='BLENDER_WORKBENCH'; scene.display.shading.color_type='VERTEX'; scene.display.shading.light='STUDIO'
scene.render.resolution_x=1400; scene.render.resolution_y=800
cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); scene.camera=cam
cam.data.type='ORTHO'; cam.data.ortho_scale=19; cam.location=(7.5,-30,12); cam.rotation_euler=(math.radians(72),0,0)
cam.location=(7.5,-3-28*math.cos(math.radians(18)),1+9)
scene.render.filepath=PREV; bpy.ops.render.render(write_still=True)
