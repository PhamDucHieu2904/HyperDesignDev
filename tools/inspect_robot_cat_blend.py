import bpy
import json
import mathutils
import os
import sys


def world_bbox(obj):
    if not hasattr(obj, "bound_box") or obj.type not in {"MESH", "CURVE", "SURFACE", "META", "FONT"}:
        return None
    pts = [obj.matrix_world @ mathutils.Vector(corner) for corner in obj.bound_box]
    mins = [min(p[i] for p in pts) for i in range(3)]
    maxs = [max(p[i] for p in pts) for i in range(3)]
    return {
        "min": [round(v, 6) for v in mins],
        "max": [round(v, 6) for v in maxs],
        "size": [round(maxs[i] - mins[i], 6) for i in range(3)],
    }


def main():
    data = {
        "blend": bpy.data.filepath,
        "version": bpy.app.version_string,
        "collections": [],
        "objects": [],
        "materials": [m.name for m in bpy.data.materials],
        "scenes": [s.name for s in bpy.data.scenes],
    }
    for col in bpy.data.collections:
        data["collections"].append({
            "name": col.name,
            "objects": [o.name for o in col.objects],
            "children": [c.name for c in col.children],
        })
    total_verts = total_edges = total_polys = 0
    mesh_objects = []
    for obj in bpy.data.objects:
        rec = {
            "name": obj.name,
            "type": obj.type,
            "location": [round(v, 6) for v in obj.location],
            "rotation_euler": [round(v, 6) for v in obj.rotation_euler],
            "scale": [round(v, 6) for v in obj.scale],
            "parent": obj.parent.name if obj.parent else None,
            "collections": [c.name for c in obj.users_collection],
            "bbox_world": world_bbox(obj),
        }
        if obj.type == "MESH":
            rec.update({
                "vertices": len(obj.data.vertices),
                "edges": len(obj.data.edges),
                "polygons": len(obj.data.polygons),
                "materials": [s.material.name if s.material else None for s in obj.material_slots],
                "modifiers": [{"name": m.name, "type": m.type} for m in obj.modifiers],
            })
            total_verts += len(obj.data.vertices)
            total_edges += len(obj.data.edges)
            total_polys += len(obj.data.polygons)
            mesh_objects.append(obj)
        data["objects"].append(rec)

    if mesh_objects:
        all_pts = []
        for obj in mesh_objects:
            all_pts.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
        mins = [min(p[i] for p in all_pts) for i in range(3)]
        maxs = [max(p[i] for p in all_pts) for i in range(3)]
        data["mesh_world_bbox"] = {
            "min": [round(v, 6) for v in mins],
            "max": [round(v, 6) for v in maxs],
            "size": [round(maxs[i] - mins[i], 6) for i in range(3)],
        }
    data["totals"] = {
        "objects": len(bpy.data.objects),
        "mesh_objects": len(mesh_objects),
        "vertices": total_verts,
        "edges": total_edges,
        "polygons": total_polys,
    }
    print("ROBOT_CAT_INSPECT_BEGIN")
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    print(payload)
    print("ROBOT_CAT_INSPECT_END")
    output_path = os.path.join(os.path.dirname(__file__), "reference_blend_inspection.json")
    with open(output_path, "w", encoding="utf-8") as handle:
        handle.write(payload)


if __name__ == "__main__":
    main()
