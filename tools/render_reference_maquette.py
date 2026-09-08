import bpy
import math
import os
import sys
import traceback
from mathutils import Vector

OUT_DIR = r"D:\program project\HyperDesignDev\artifacts\reference_views"
os.makedirs(OUT_DIR, exist_ok=True)


def _report_exception(exc_type, exc_value, exc_tb):
    with open(os.path.join(OUT_DIR, 'reference_render_error.txt'), 'w', encoding='utf-8') as handle:
        traceback.print_exception(exc_type, exc_value, exc_tb, file=handle)
    sys.__excepthook__(exc_type, exc_value, exc_tb)


sys.excepthook = _report_exception


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def mat(name, color, metallic=0.0, roughness=0.45):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1.0)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return m


scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 640
scene.render.resolution_y = 640
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.world.color = (0.05, 0.05, 0.05)

clay = mat('MAT_REFERENCE_CLAY', (0.72, 0.76, 0.82), 0.05, 0.28)
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        obj.data.materials.clear()
        obj.data.materials.append(clay)
        for poly in obj.data.polygons:
            poly.use_smooth = True

bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
ground = bpy.context.object
ground.name = 'GROUND_PREVIEW'
ground.data.materials.append(mat('MAT_GROUND', (0.12, 0.14, 0.18), 0.0, 0.65))

for idx, (loc, energy, size) in enumerate([
    ((-3.5, -4.5, 5.0), 900, 4.0),
    ((4.0, -1.5, 3.2), 650, 3.0),
    ((0.0, 4.0, 4.5), 800, 3.0),
]):
    bpy.ops.object.light_add(type='AREA', location=loc)
    light = bpy.context.object
    light.name = f'AREA_{idx}'
    light.data.energy = energy
    light.data.shape = 'DISK'
    light.data.size = size
    look_at(light, (0, 0, 0.45))

bpy.ops.object.camera_add()
cam = bpy.context.object
cam.name = 'CAM_REFERENCE'
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 1.18
scene.camera = cam

views = {
    'reference_front.png': ((0.0, -4.0, 0.49), (0.0, 0.0, 0.47)),
    'reference_side.png': ((4.0, 0.0, 0.49), (0.0, 0.0, 0.47)),
    'reference_rear.png': ((0.0, 4.0, 0.49), (0.0, 0.0, 0.47)),
    'reference_3q.png': ((2.8, -3.4, 1.55), (0.0, 0.02, 0.45)),
}

for filename, (loc, target) in views.items():
    cam.location = loc
    if filename == 'reference_3q.png':
        cam.data.type = 'PERSP'
        cam.data.lens = 70
    else:
        cam.data.type = 'ORTHO'
        cam.data.ortho_scale = 1.18
    look_at(cam, target)
    scene.render.filepath = os.path.join(OUT_DIR, filename)
    bpy.ops.render.render(write_still=True)

print('REFERENCE_RENDER_DONE', OUT_DIR)
