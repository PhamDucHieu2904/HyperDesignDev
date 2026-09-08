import bpy
import bmesh
import json
import os
import sys
import traceback
from mathutils import Vector


ROOT_DIR = r"D:\program project\HyperDesignDev\artifacts\robot_cat"
RENDER_DIR = os.path.join(ROOT_DIR, "renders")
os.makedirs(RENDER_DIR, exist_ok=True)


def _exception(exc_type, exc_value, exc_tb):
    with open(os.path.join(ROOT_DIR, "audit_error.txt"), "w", encoding="utf-8") as handle:
        traceback.print_exception(exc_type, exc_value, exc_tb, file=handle)
    sys.__excepthook__(exc_type, exc_value, exc_tb)


sys.excepthook = _exception


def is_reference(obj):
    return bool(obj.get("reference_only")) or obj.name.startswith("SRC_MAQUETTE")


def is_production(obj):
    if is_reference(obj) or obj.type in {"CAMERA", "LIGHT"}:
        return False
    if obj.name in {"GROUND_PLANE", "ROOT", "BODY_ROOT", "HEAD_YAW"}:
        return False
    if obj.name.startswith("PIVOT_"):
        return False
    return obj.type in {"MESH", "CURVE"}


def evaluated_mesh_stats(obj, depsgraph):
    eval_obj = obj.evaluated_get(depsgraph)
    mesh = eval_obj.to_mesh()
    try:
        bm = bmesh.new()
        bm.from_mesh(mesh)
        boundary = sum(1 for e in bm.edges if e.is_boundary)
        non_manifold = sum(1 for e in bm.edges if not e.is_manifold)
        components = 0
        unseen = set(bm.verts)
        while unseen:
            components += 1
            stack = [unseen.pop()]
            while stack:
                vert = stack.pop()
                for edge in vert.link_edges:
                    other = edge.other_vert(vert)
                    if other in unseen:
                        unseen.remove(other)
                        stack.append(other)
        return {
            "vertices": len(mesh.vertices),
            "edges": len(mesh.edges),
            "polygons": len(mesh.polygons),
            "boundary_edges": boundary,
            "non_manifold_edges": non_manifold,
            "connected_components": components,
        }
    finally:
        try:
            bm.free()
        except Exception:
            pass
        eval_obj.to_mesh_clear()


scene = bpy.context.scene
depsgraph = bpy.context.evaluated_depsgraph_get()
production = [o for o in bpy.data.objects if is_production(o)]
pivots = [o for o in bpy.data.objects if o.type == "EMPTY" and (o.name.startswith("PIVOT_") or o.name in {"ROOT", "BODY_ROOT", "HEAD_YAW"})]

records = []
totals = {"vertices": 0, "edges": 0, "polygons": 0, "non_manifold_edges": 0}
world_points = []
for obj in production:
    rec = {
        "name": obj.name,
        "type": obj.type,
        "parent": obj.parent.name if obj.parent else None,
        "mechanically_separate": bool(obj.get("mechanically_separate")),
        "topology_method": obj.get("topology_method", "Blender primitive/curve detail"),
    }
    if obj.type in {"MESH", "CURVE"}:
        stats = evaluated_mesh_stats(obj, depsgraph)
        rec["evaluated"] = stats
        for key in totals:
            totals[key] += stats.get(key, 0)
        for corner in obj.bound_box:
            world_points.append(obj.matrix_world @ Vector(corner))
    records.append(rec)

if world_points:
    mins = [min(v[i] for v in world_points) for i in range(3)]
    maxs = [max(v[i] for v in world_points) for i in range(3)]
    bbox = {
        "min": [round(v, 4) for v in mins],
        "max": [round(v, 4) for v in maxs],
        "size": [round(maxs[i] - mins[i], 4) for i in range(3)],
    }
else:
    bbox = None

required = [
    "CAT_HEAD_SHELL", "CAT_VISOR", "CAT_EAR_L", "CAT_EAR_R",
    "CAT_BODY", "CAT_LEG_FL", "CAT_LEG_FR", "CAT_LEG_RL", "CAT_LEG_RR",
    "CAT_PAW_FL", "CAT_PAW_FR", "CAT_PAW_RL", "CAT_PAW_RR",
    "CAT_HIP_L", "CAT_HIP_R", "CAT_TAIL_SHELL", "CAT_TAIL_TIP",
    "CAT_SIDE_MODULE_L", "CAT_SIDE_MODULE_R", "CAT_CHEST_MODULE",
]
required_pivots = [
    "ROOT", "BODY_ROOT", "HEAD_YAW", "PIVOT_EAR_L", "PIVOT_EAR_R",
    "PIVOT_SHOULDER_L", "PIVOT_SHOULDER_R", "PIVOT_HIP_L", "PIVOT_HIP_R",
    "PIVOT_TAIL_ROOT", "PIVOT_TAIL_01", "PIVOT_TAIL_02", "PIVOT_TAIL_03",
    "PIVOT_TAIL_04", "PIVOT_TAIL_05",
]

audit = {
    "asset": scene.get("asset_name", "ROBOT_CAT_CAT_E2"),
    "blender_version": bpy.app.version_string,
    "production_object_count": len(production),
    "production_mesh_count": sum(1 for o in production if o.type == "MESH"),
    "production_curve_count": sum(1 for o in production if o.type == "CURVE"),
    "reference_object_count": sum(1 for o in bpy.data.objects if is_reference(o)),
    "pivot_count": len(pivots),
    "production_bbox": bbox,
    "evaluated_totals": totals,
    "required_parts": {name: name in bpy.data.objects for name in required},
    "required_pivots": {name: name in bpy.data.objects for name in required_pivots},
    "all_required_parts_present": all(name in bpy.data.objects for name in required),
    "all_required_pivots_present": all(name in bpy.data.objects for name in required_pivots),
    "maquette_used_as_production": bool(scene.get("maquette_is_production", False)),
    "rig_ready_flag": bool(scene.get("rig_ready", False)),
    "objects": records,
}

with open(os.path.join(ROOT_DIR, "topology_audit.json"), "w", encoding="utf-8") as handle:
    json.dump(audit, handle, ensure_ascii=False, indent=2)

# Silhouette validation renders. This is a temporary in-memory material override;
# the saved .blend remains untouched.
sil = bpy.data.materials.get("MAT_AUDIT_SILHOUETTE") or bpy.data.materials.new("MAT_AUDIT_SILHOUETTE")
sil.use_nodes = True
bsdf = sil.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = (0.002, 0.002, 0.002, 1)
bsdf.inputs["Roughness"].default_value = 1.0
saved_materials = {}
for obj in production:
    if hasattr(obj.data, "materials"):
        saved_materials[obj.name] = [m for m in obj.data.materials]
        obj.data.materials.clear()
        obj.data.materials.append(sil)

ground = bpy.data.objects.get("GROUND_PLANE")
if ground:
    ground.hide_render = True
world = scene.world
bg = world.node_tree.nodes.get("Background") if world and world.use_nodes else None
saved_bg = tuple(bg.inputs["Color"].default_value) if bg else None
saved_strength = bg.inputs["Strength"].default_value if bg else None
if bg:
    bg.inputs["Color"].default_value = (1, 1, 1, 1)
    bg.inputs["Strength"].default_value = 1.0

for filename, camera_name in (("silhouette_front.png", "CAM_FRONT"), ("silhouette_side.png", "CAM_SIDE"), ("silhouette_3q.png", "CAM_THREEQUARTER")):
    scene.camera = bpy.data.objects[camera_name]
    scene.render.filepath = os.path.join(RENDER_DIR, filename)
    bpy.ops.render.render(write_still=True)

print("ROBOT_CAT_AUDIT_COMPLETE", json.dumps({k: audit[k] for k in audit if k != "objects"}))
