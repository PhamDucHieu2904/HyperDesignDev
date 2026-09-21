"""Attach the user's Than mesh and export evaluated geometry + existing Actions.

Reuses only the audited geometry/GLB helpers from the upstream exporter;
never runs its action, emoji, shape-key or model generators.
"""
import bpy, os, json, struct, shutil, datetime
import numpy as np
from mathutils import Matrix, Vector
from math import radians, sin, cos
ROOT = r'D:\3D model\Robot Cat'
ASSETS = ROOT + '/web-cat/assets'
rig = bpy.data.objects['RIG | Robot Cat']
scene = bpy.context.scene
face = bpy.data.materials['FACE | Interactive screen']
manifest = json.load(open(ASSETS+'/behaviors.json', encoding='utf8'))
assert set(manifest['clips']).issubset(bpy.data.actions.keys())
stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
for name in ['RobotCatLinkVatOriginal.blend', 'RobotCat_Animated_Web.blend']:
    shutil.copy2(ROOT+'/'+name, ROOT+'/'+name+'.before-body-led-'+stamp)

# Preserve the mesh's displayed position when binding it to the body control.
scene.frame_set(1)
ob = bpy.data.objects['Than']
world = ob.matrix_world.copy()
ob.parent = rig
ob.parent_type = 'BONE'
ob.parent_bone = 'CTRL_body'
bpy.context.view_layer.update()
ob.matrix_world = world
body_collection = next(c for c in bpy.data.collections if c.name.startswith('01 | Body'))
if ob.name not in body_collection.objects: body_collection.objects.link(ob)
for c in list(ob.users_collection):
    if c != body_collection: c.objects.unlink(ob)
ob['region'] = 'body'
ob['owner'] = 'CTRL_body'
bpy.context.view_layer.update()
assert max(abs(ob.matrix_world[i][j]-world[i][j]) for i in range(4) for j in range(4)) < 1e-5

# Consistent sky-cyan emission in Blender and glTF, with separate strengths.
for name, strength in [('Led', 5.0), ('Led 1', 2.0)]:
    mat = bpy.data.materials[name]
    for n in mat.node_tree.nodes:
        if n.type == 'EMISSION':
            n.inputs['Color'].default_value = (0.005, .60, 1.0, 1)
            n.inputs['Strength'].default_value = strength
        elif n.type == 'BSDF_PRINCIPLED':
            n.inputs['Emission Color'].default_value = (0.005, .60, 1.0, 1)
            n.inputs['Emission Strength'].default_value = strength
for name in ['RobotCatLinkVatOriginal.blend', 'RobotCat_Animated_Web.blend']:
    bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/'+name)

owners = {}
for ob in bpy.data.objects:
    if ob.type != 'MESH': continue
    ancestor = ob
    while ancestor.parent and ancestor.parent != rig: ancestor = ancestor.parent
    if ancestor.parent == rig and ancestor.parent_type == 'BONE': owners[ob.name] = ancestor.parent_bone
assert owners['Than'] == 'CTRL_body'
rig.animation_data.action = None
for p in rig.pose.bones: p.matrix_basis = Matrix.Identity(4)
rig['tail_curl'] = 0.0
bpy.context.view_layer.update()

# Only function definitions for the already approved tail morph, and the
# geometry/material/buffer construction block. No upstream authoring code.
upstream = open(ROOT+'/animate_robot_cat.py', encoding='utf8').read()
tail_helpers = upstream[upstream.index('tailbase='):upstream.index('tailkeys=[]')]
exec(compile(tail_helpers, '<existing tail geometry helper>', 'exec'))
geometry = upstream[upstream.index('# Keep the user'):upstream.index('def smooth(x)')]
exec(compile(geometry, '<existing geometry exporter>', 'exec'))
for m in gltf['materials']:
    if m['name'] == face.name: m['emissiveFactor'] = [.022, .738, 1]

# Sample the saved Actions rather than regenerate any motion or expression.
for name, spec in manifest['clips'].items():
    action = bpy.data.actions[name]
    rig.animation_data.action = action
    if action.slots: rig.animation_data.action_slot = action.slots[0]
    frames = round(spec['duration'] * 30)
    times = np.linspace(0, spec['duration'], frames+1, dtype=np.float32)
    track = {n:{'translation':[], 'rotation':[]} for n in boneindex}
    curltrack = []
    for i in range(frames+1):
        scene.frame_set(i+1)
        bpy.context.view_layer.update()
        curltrack.append(float(rig['tail_curl']))
        for p in rig.pose.bones:
            local = p.parent.matrix.inverted() @ p.matrix if p.parent else rig.matrix_world @ p.matrix
            loc, q, s = trs(C @ local @ Ci)
            previous = track[p.name]['rotation']
            if previous and np.dot(previous[-1],q) < 0: q = [-x for x in q]
            track[p.name]['translation'].append(loc)
            track[p.name]['rotation'].append(q)
    anim = {'name':name, 'samplers':[], 'channels':[], 'extras':spec}
    timeacc = acc(times, 'SCALAR', bounds=True)
    for n, values in track.items():
        for path, arr in values.items():
            idx = len(anim['samplers'])
            anim['samplers'].append({'input':timeacc,'output':acc(arr,'VEC3' if path=='translation' else 'VEC4'),'interpolation':'LINEAR'})
            anim['channels'].append({'sampler':idx,'target':{'node':boneindex[n],'path':path}})
    for ni in morphs:
        idx = len(anim['samplers'])
        anim['samplers'].append({'input':timeacc,'output':acc(curltrack,'SCALAR'),'interpolation':'LINEAR'})
        anim['channels'].append({'sampler':idx,'target':{'node':ni,'path':'weights'}})
    gltf['animations'].append(anim)
gltf['buffers'] = [{'byteLength':len(binary)}]
j = json.dumps(gltf,separators=(',',':')).encode()
j += b' ' * ((-len(j))%4)
binary += b'\x00' * ((-len(binary))%4)
out = ROOT+'/animation_qa/robot-cat-unoptimized.glb'
shutil.copy2(out,out+'.before-body-led-'+stamp)
with open(out,'wb') as f:
    f.write(struct.pack('<III',0x46546C67,2,28+len(j)+len(binary)))
    f.write(struct.pack('<II',len(j),0x4E4F534A)); f.write(j)
    f.write(struct.pack('<II',len(binary),0x004E4942)); f.write(binary)
report = {'source':ROOT+'/RobotCatLinkVatOriginal.blend','added':'Than','owner':owners['Than'],'clips':list(manifest['clips']),'triangles':sum(len(v)//3 for v in groups.values()),'backupStamp':stamp,'materials':[m for m in gltf['materials'] if m['name'] in ['Led','Led 1']]}
json.dump(report,open(ROOT+'/animation_qa/body-led-update.json','w'),indent=2)
print('BODY_LED_EXPORT',json.dumps(report))
