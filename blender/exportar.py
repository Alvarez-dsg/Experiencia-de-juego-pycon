# Uso: blender -b --python blender/exportar.py
# Rehace animales e invasores, hornea su oclusión ambiental y los exporta a public/models/*.glb para el juego.
import bpy, os, time
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
t0 = time.time()
for script, skip in (('animales', None), ('invasores', 'lenador_')):
    p = os.path.join(HERE, script + '.py')
    g = {'__file__': p, '__name__': '__main__'}
    exec(compile(open(p, encoding='utf-8').read(), p, 'exec'), g)
    objs = {k: o for k, o in g['OBJS'].items() if not (skip and k.startswith(skip))}
    g['estilo'].bake_ao(g['SCENE'], objs)
    for k, o in list(objs.items())[:3]:
        vals = [c.color[0] for c in o.data.color_attributes['AO'].data]
        print('AO', k, round(min(vals), 2), round(sum(vals) / len(vals), 2))
    g['export_glb'](os.path.join(ROOT, 'public', 'models', script + '.glb'), objs)
print('LISTO', round(time.time() - t0, 1), 's')
