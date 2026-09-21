import bpy, json
rig = bpy.data.objects.get('RIG | Robot Cat')
print('CAT_INSPECT', json.dumps({
 'objects': [{'name':o.name,'parent':o.parent.name if o.parent else None,'bone':o.parent_bone,'type':o.parent_type,'collections':[c.name for c in o.users_collection],'materials':[m.name for m in o.data.materials if m]} for o in bpy.data.objects if o.type=='MESH' and (o.name=='Than' or 'body' in o.parent_bone)],
 'actions': [(a.name, list(a.frame_range)) for a in bpy.data.actions],
 'active':rig.animation_data.action.name if rig.animation_data and rig.animation_data.action else None,
 'led': [{'name':m.name,'nodes':[(n.type,n.name) for n in m.node_tree.nodes]} for m in bpy.data.materials if 'led' in m.name.lower()]
},ensure_ascii=False))
