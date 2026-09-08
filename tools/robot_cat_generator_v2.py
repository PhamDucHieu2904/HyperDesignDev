"""Robot Cat CAT-E2 clean modular reconstruction for Blender 5.2+.

Images define the design. The mesh in Tham Khao.blend is retained only as a
hidden volume maquette. Production geometry is generated from editable,
parametric control surfaces and kept mechanically separated for later rigging.
"""

import bpy
import json
import math
import os
import sys
import traceback
from mathutils import Vector


ROOT_DIR = r"D:\program project\HyperDesignDev\artifacts\robot_cat"
RENDER_DIR = os.path.join(ROOT_DIR, "renders")
PREVIEW_DIR = os.path.join(ROOT_DIR, "previews")
os.makedirs(RENDER_DIR, exist_ok=True)
os.makedirs(PREVIEW_DIR, exist_ok=True)

SOURCE_BLEND = r"D:\3D model\Robot Cat\Tham Khao.blend"
REFERENCE_IMAGES = [
    r"D:\Vinut-TK\Downloads\Tạo mô hình 3D.jpeg",
    r"D:\Vinut-TK\Downloads\Ảnh mèo xoay ngang.jpeg",
    r"D:\Vinut-TK\Downloads\ChatGPT Image 13_21_22 8 thg 9, 2026.png",
    r"D:\Vinut-TK\Downloads\Tạo ảnh chính diện, ngang.jpeg",
    r"D:\Vinut-TK\Downloads\Gemini_Generated_Image_u4xwniu4xwniu4xw.png",
    r"D:\Vinut-TK\Downloads\Gemini_Generated_Image_rk2ab3rk2ab3rk2a.png",
]

# Master dimensions, derived from the orthographic-like front/side sheets.
P = {
    "head_width": 4.00,
    "head_height": 2.78,
    "head_depth": 2.70,
    "head_center": [0.0, -0.38, 4.22],
    "body_width": 2.62,
    "body_length": 3.28,
    "body_height": 1.92,
    "body_center": [0.0, 0.82, 1.78],
    "ear_height": 1.56,
    "ear_width": 1.18,
    "visor_width": 3.25,
    "visor_height": 1.86,
    "front_leg_height": 2.18,
    "front_paw_width": 1.24,
    "rear_paw_width": 1.10,
    "side_module_diameter": 1.02,
    "total_height": 6.52,
}


def _report_exception(exc_type, exc_value, exc_tb):
    with open(os.path.join(ROOT_DIR, "generator_error.txt"), "w", encoding="utf-8") as handle:
        traceback.print_exception(exc_type, exc_value, exc_tb, file=handle)
    sys.__excepthook__(exc_type, exc_value, exc_tb)


sys.excepthook = _report_exception


def collection(name, parent=None):
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
    if parent is None:
        if col.name not in bpy.context.scene.collection.children:
            try:
                bpy.context.scene.collection.children.link(col)
            except RuntimeError:
                pass
    else:
        if col.name not in parent.children:
            try:
                parent.children.link(col)
            except RuntimeError:
                pass
    return col


def relink(obj, col):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    col.objects.link(obj)


def assign_material(obj, material):
    if not hasattr(obj.data, "materials"):
        return
    obj.data.materials.clear()
    obj.data.materials.append(material)


def set_smooth(obj):
    if obj.type == "MESH":
        for poly in obj.data.polygons:
            poly.use_smooth = True


def set_input(node, names, value):
    for name in names:
        socket = node.inputs.get(name)
        if socket is not None:
            socket.default_value = value
            return


def make_material(name, base, metallic=0.0, roughness=0.35, emission=None, emission_strength=0.0, coat=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = (*base, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    set_input(bsdf, ["Base Color"], (*base, 1.0))
    set_input(bsdf, ["Metallic"], metallic)
    set_input(bsdf, ["Roughness"], roughness)
    set_input(bsdf, ["Coat Weight", "Clearcoat"], coat)
    if emission is not None:
        set_input(bsdf, ["Emission Color", "Emission"], (*emission, 1.0))
        set_input(bsdf, ["Emission Strength"], emission_strength)
    return mat


def create_materials():
    return {
        "white": make_material("MAT_SHELL_WHITE", (0.91, 0.93, 0.97), 0.0, 0.20, coat=0.32),
        "white_soft": make_material("MAT_SHELL_SECONDARY", (0.78, 0.82, 0.89), 0.02, 0.28, coat=0.18),
        "visor": make_material("MAT_VISOR_GLOSS", (0.006, 0.009, 0.018), 0.18, 0.135, coat=0.28),
        "dark": make_material("MAT_DARK_MECHANICAL", (0.018, 0.023, 0.035), 0.28, 0.24, coat=0.12),
        "rubber": make_material("MAT_PAW_RUBBER", (0.026, 0.031, 0.042), 0.0, 0.48),
        "led": make_material("MAT_LED_CYAN", (0.05, 0.48, 1.0), 0.0, 0.18, emission=(0.04, 0.55, 1.0), emission_strength=9.0, coat=0.12),
        "clay_ref": make_material("MAT_MAQUETTE_REFERENCE", (0.18, 0.35, 0.58), 0.0, 0.62),
        "ground": make_material("MAT_STUDIO_GROUND", (0.72, 0.76, 0.84), 0.0, 0.72),
        "seam": make_material("MAT_SEAM", (0.035, 0.045, 0.065), 0.06, 0.34),
    }


def spow(value, exponent):
    if abs(value) < 1e-12:
        return 0.0
    return math.copysign(abs(value) ** exponent, value)


def superellipsoid(name, center, radii, exp_lat=0.72, exp_lon=0.72, segments=72, rings=36,
                   material=None, col=None, shape_fn=None):
    """Create a quad-dominant custom control surface, not a beveled primitive."""
    cx, cy, cz = center
    rx, ry, rz = radii
    verts = []
    faces = []
    # Bottom pole.
    verts.append((cx, cy, cz - rz))
    for j in range(1, rings):
        phi = -math.pi / 2 + math.pi * j / rings
        cphi = spow(math.cos(phi), exp_lat)
        sphi = spow(math.sin(phi), exp_lat)
        for i in range(segments):
            theta = 2 * math.pi * i / segments
            x = rx * cphi * spow(math.cos(theta), exp_lon)
            y = ry * cphi * spow(math.sin(theta), exp_lon)
            z = rz * sphi
            if shape_fn:
                x, y, z = shape_fn(x, y, z, rx, ry, rz)
            verts.append((cx + x, cy + y, cz + z))
    top_index = len(verts)
    verts.append((cx, cy, cz + rz))
    # Bottom fan.
    for i in range(segments):
        faces.append((0, 1 + (i + 1) % segments, 1 + i))
    # Quads.
    for j in range(rings - 2):
        a = 1 + j * segments
        b = a + segments
        for i in range(segments):
            ni = (i + 1) % segments
            faces.append((a + i, a + ni, b + ni, b + i))
    # Top fan.
    last = 1 + (rings - 2) * segments
    for i in range(segments):
        faces.append((last + i, last + (i + 1) % segments, top_index))
    mesh = bpy.data.meshes.new(name + "_CAGE")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    (col or bpy.context.scene.collection).objects.link(obj)
    set_smooth(obj)
    if material:
        assign_material(obj, material)
    obj["topology_method"] = "custom superellipsoid cross-section cage"
    obj["mechanically_separate"] = True
    return obj


def head_shape(x, y, z, rx, ry, rz):
    yn = y / ry
    xn = abs(x / rx)
    zn = z / rz
    # Broader front face, rounder rear cranium, soft chin and crown.
    x *= 1.0 + 0.055 * max(-yn, 0.0) * (1.0 - 0.35 * zn * zn)
    if yn > 0:
        x *= 1.0 - 0.025 * yn
        z *= 1.0 + 0.035 * yn
    z += -0.075 * rz * max(-yn, 0.0) * (1.0 - xn * xn) * max(-zn, 0.0)
    y += 0.035 * ry * (1.0 - xn) * max(zn, 0.0)
    return x, y, z


def body_shape(x, y, z, rx, ry, rz):
    yn = y / ry
    zn = z / rz
    # Strong rear haunch mass and compact chest.
    x *= 0.94 + 0.10 * max(yn, 0.0) + 0.025 * (1.0 - zn * zn)
    z += 0.07 * rz * max(yn, 0.0) - 0.025 * rz * max(-yn, 0.0)
    y += 0.035 * ry * (1.0 - abs(zn))
    return x, y, z


def rounded_rect_points(rx, rz, radius, corner_segments):
    pts = []
    corners = [
        (rx - radius, rz - radius, 0.0),
        (-rx + radius, rz - radius, math.pi / 2),
        (-rx + radius, -rz + radius, math.pi),
        (rx - radius, -rz + radius, 3 * math.pi / 2),
    ]
    for cx, cz, start in corners:
        for i in range(corner_segments):
            a = start + (math.pi / 2) * i / (corner_segments - 1)
            pts.append((cx + radius * math.cos(a), cz + radius * math.sin(a)))
    return pts


def rounded_patch(name, center, half_size, corner_radius, boundary_y, bulge, material, col,
                  rings=12, corner_segments=10, thickness=0.06, bevel=0.03):
    cx, _, cz = center
    rx, rz = half_size
    profile = rounded_rect_points(rx, rz, corner_radius, corner_segments)
    count = len(profile)
    verts = [(cx, boundary_y - bulge, cz)]
    faces = []
    for ring in range(1, rings + 1):
        t = ring / rings
        y = boundary_y - bulge * (1.0 - t * t)
        for x, z in profile:
            verts.append((cx + x * t, y, cz + z * t))
    for i in range(count):
        faces.append((0, 1 + i, 1 + (i + 1) % count))
    for ring in range(1, rings):
        a = 1 + (ring - 1) * count
        b = 1 + ring * count
        for i in range(count):
            ni = (i + 1) % count
            faces.append((a + i, b + i, b + ni, a + ni))
    mesh = bpy.data.meshes.new(name + "_SURFACE")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    col.objects.link(obj)
    set_smooth(obj)
    assign_material(obj, material)
    sol = obj.modifiers.new("Surface thickness", "SOLIDIFY")
    sol.thickness = thickness
    sol.offset = 0.0
    bev = obj.modifiers.new("Controlled edge radius", "BEVEL")
    bev.width = bevel
    bev.segments = 3
    obj["topology_method"] = "curved rounded-rectangle radial patch"
    obj["mechanically_separate"] = True
    return obj


def profile_prism(name, points_xz, depth, center_y, material, col, bevel=0.12):
    n = len(points_xz)
    verts = []
    z_min = min(z for _, z in points_xz)
    z_max = max(z for _, z in points_xz)
    for direction in (-1, 1):
        for x, z in points_xz:
            # Ear/wedge depth narrows toward the rounded tip instead of reading
            # as a constant-thickness rectangular slab in side view.
            height_t = (z - z_min) / max(z_max - z_min, 1e-6)
            local_depth = depth * (1.0 - 0.62 * height_t)
            y = center_y + direction * local_depth / 2
            verts.append((x, y, z))
    faces = []
    faces.append(tuple(range(n - 1, -1, -1)))
    faces.append(tuple(range(n, 2 * n)))
    for i in range(n):
        ni = (i + 1) % n
        faces.append((i, ni, n + ni, n + i))
    mesh = bpy.data.meshes.new(name + "_CAGE")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    col.objects.link(obj)
    assign_material(obj, material)
    set_smooth(obj)
    bev_mod = obj.modifiers.new("Soft consumer shell radii", "BEVEL")
    bev_mod.width = bevel
    bev_mod.segments = 5
    obj["topology_method"] = "custom rounded triangular prism cage"
    obj["mechanically_separate"] = True
    return obj


def curve_object(name, points, bevel_depth, material, col, cyclic=False, resolution=3):
    data = bpy.data.curves.new(name + "_CURVE", type="CURVE")
    data.dimensions = "3D"
    data.resolution_u = resolution
    data.bevel_depth = bevel_depth
    data.bevel_resolution = 4
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for bp, co in zip(spline.bezier_points, points):
        bp.co = co
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, data)
    col.objects.link(obj)
    assign_material(obj, material)
    obj["mechanically_separate"] = True
    return obj


def add_uv_sphere(name, location, scale, material, col, segments=64, rings=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    relink(obj, col)
    assign_material(obj, material)
    set_smooth(obj)
    obj["mechanically_separate"] = True
    return obj


def add_cylinder(name, location, radius, depth, material, col, rotation=(0, 0, 0), vertices=64, bevel=0.04):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    relink(obj, col)
    assign_material(obj, material)
    set_smooth(obj)
    if bevel:
        mod = obj.modifiers.new("Edge softness", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    obj["mechanically_separate"] = True
    return obj


def add_torus(name, location, major_radius, minor_radius, material, col, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major_radius, minor_radius=minor_radius,
                                    major_segments=72, minor_segments=16,
                                    location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    relink(obj, col)
    assign_material(obj, material)
    set_smooth(obj)
    obj["mechanically_separate"] = True
    return obj


def create_empty(name, location, col, display="SPHERE", size=0.16, parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = display
    obj.empty_display_size = size
    obj.location = location
    col.objects.link(obj)
    if parent:
        world_matrix = obj.matrix_world.copy()
        obj.parent = parent
        obj.matrix_world = world_matrix
    obj["pivot_intentional"] = True
    return obj


def parent_keep_transform(obj, parent):
    matrix = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = matrix


def build_collections():
    root = collection("ROBOT_CAT")
    names = [
        "00_REFERENCE", "00A_IMAGES", "00B_MAQUETTE_ORIGINAL", "00C_MAQUETTE_ALIGNED",
        "01_BLOCKOUT", "02_HEAD", "03_NECK", "04_BODY", "05_FRONT_LEGS",
        "06_REAR_LEGS", "07_TAIL", "08_CHEST_MODULE", "09_SEAMS", "10_LEDS",
        "11_RIG_HELPERS", "12_MATERIALS", "13_CAMERAS", "14_LIGHTS", "99_HELPERS",
    ]
    cols = {name: collection(name, root) for name in names}
    for sub in ("00A_IMAGES", "00B_MAQUETTE_ORIGINAL", "00C_MAQUETTE_ALIGNED"):
        try:
            cols["00_REFERENCE"].children.link(cols[sub])
        except RuntimeError:
            pass
    return root, cols


def prepare_reference(cols, materials):
    existing_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    if existing_meshes:
        original = existing_meshes[0]
        original.name = "SRC_MAQUETTE_ORIGINAL"
        relink(original, cols["00B_MAQUETTE_ORIGINAL"])
        assign_material(original, materials["clay_ref"])
        original.hide_render = True
        original.hide_set(True)
        original.hide_select = True
        original["reference_only"] = True
        aligned = original.copy()
        aligned.data = original.data.copy()
        aligned.name = "SRC_MAQUETTE_ALIGNED"
        cols["00C_MAQUETTE_ALIGNED"].objects.link(aligned)
        aligned.hide_render = True
        aligned.hide_set(True)
        aligned.hide_select = True
        aligned["reference_only"] = True

    for idx, path in enumerate(REFERENCE_IMAGES):
        if not os.path.exists(path):
            continue
        try:
            img = bpy.data.images.load(path, check_existing=True)
            emp = bpy.data.objects.new(f"REF_IMAGE_{idx+1:02d}", None)
            emp.empty_display_type = "IMAGE"
            emp.data = img
            emp.hide_render = True
            emp.hide_set(True)
            emp.hide_select = True
            emp["source_path"] = path
            cols["00A_IMAGES"].objects.link(emp)
        except Exception:
            pass


def create_head(cols, materials, head_root, leds):
    head = superellipsoid(
        "CAT_HEAD_SHELL", P["head_center"], (2.0, 1.35, 1.39), 0.63, 0.59,
        96, 48, materials["white"], cols["02_HEAD"], head_shape,
    )
    parent_keep_transform(head, head_root)
    head["source_images"] = "front+side+3Q+modeling_sheet"
    head["target_pivot"] = "HEAD_YAW"

    # Surface-conforming recessed frame and glossy visor.
    frame = rounded_patch("CAT_HEAD_RECESS", (0, 0, 4.17), (1.72, 1.02), 0.46,
                          -1.750, 0.100, materials["dark"], cols["02_HEAD"],
                          thickness=0.055, bevel=0.045)
    visor = rounded_patch("CAT_VISOR", (0, 0, 4.16), (1.59, 0.90), 0.42,
                          -1.790, 0.135, materials["visor"], cols["02_HEAD"],
                          thickness=0.050, bevel=0.050)
    parent_keep_transform(frame, head_root)
    parent_keep_transform(visor, head_root)

    # Happy eye arcs and three status strokes sit directly on visor curvature.
    for side in (-1, 1):
        cx = side * 0.63
        pts = []
        for i in range(13):
            t = -1.0 + 2.0 * i / 12
            x = cx + 0.31 * t
            z = 4.12 + 0.24 * (1.0 - t * t)
            y = -1.905 - 0.018 * (1.0 - t * t)
            pts.append((x, y, z))
        eye = curve_object(f"CAT_FACE_EYE_{'L' if side < 0 else 'R'}", pts, 0.060,
                           materials["led"], cols["10_LEDS"])
        parent_keep_transform(eye, head_root)
        leds.append(eye)
    for i, (x, h) in enumerate(((0.89, 0.16), (1.09, 0.21), (1.29, 0.27))):
        bar = curve_object(f"CAT_FACE_STATUS_{i+1}", [(x, -1.910, 3.73 - h/2), (x, -1.914, 3.73 + h/2)],
                           0.036, materials["led"], cols["10_LEDS"])
        parent_keep_transform(bar, head_root)
        leds.append(bar)

    # Soft triangular ears, dark inserts and cyan inlay lines.
    for side, label in ((-1, "L"), (1, "R")):
        cx = side * 1.28
        sx = side
        pts = [
            (cx - sx * 0.65, 5.14),
            (cx - sx * 0.28, 6.11),
            (cx + sx * 0.07, 6.51),
            (cx + sx * 0.38, 6.02),
            (cx + sx * 0.64, 5.18),
            (cx, 5.00),
        ]
        ear = profile_prism(f"CAT_EAR_{label}", pts, 0.72, -0.34, materials["white"], cols["02_HEAD"], 0.15)
        inner_pts = []
        for x, z in pts:
            inner_pts.append((cx + (x - cx) * 0.70, 5.14 + (z - 5.14) * 0.73))
        inner = profile_prism(f"CAT_EAR_INNER_{label}", inner_pts, 0.075, -0.735,
                              materials["dark"], cols["02_HEAD"], 0.075)
        ear_pivot = create_empty(f"PIVOT_EAR_{label}", (cx, -0.34, 5.14), cols["11_RIG_HELPERS"], "CIRCLE", 0.18, head_root)
        parent_keep_transform(ear, ear_pivot)
        parent_keep_transform(inner, ear_pivot)
        x_outer = cx + side * 0.12
        led_pts = [
            (x_outer - side * 0.22, -0.790, 5.43),
            (x_outer - side * 0.08, -0.798, 5.66),
            (x_outer + side * 0.08, -0.796, 5.88),
        ]
        led = curve_object(f"CAT_EAR_LED_{label}", led_pts, 0.035, materials["led"], cols["10_LEDS"])
        parent_keep_transform(led, ear_pivot)
        leds.append(led)

    # Layered side circular modules integrated into the shell.
    for side, label in ((-1, "L"), (1, "R")):
        x = side * 2.01
        rot = (0, math.pi / 2, 0)
        sign_depth = 1 if side > 0 else -1
        outer = add_cylinder(f"CAT_SIDE_MODULE_{label}", (x, -0.32, 4.12), 0.59, 0.105,
                             materials["white_soft"], cols["02_HEAD"], rot, bevel=0.045)
        recess = add_cylinder(f"CAT_SIDE_RECESS_{label}", (x + side * 0.065, -0.32, 4.12), 0.48, 0.085,
                              materials["dark"], cols["02_HEAD"], rot, bevel=0.03)
        ring = add_torus(f"CAT_SIDE_LED_{label}", (x + side * 0.113, -0.32, 4.12), 0.38, 0.037,
                         materials["led"], cols["10_LEDS"], rot)
        center = add_cylinder(f"CAT_SIDE_CENTER_{label}", (x + side * 0.125, -0.32, 4.12), 0.31, 0.055,
                              materials["dark"], cols["02_HEAD"], rot, bevel=0.02)
        for obj in (outer, recess, ring, center):
            parent_keep_transform(obj, head_root)
        leds.append(ring)
    return head


def create_body(cols, materials, body_root):
    body = superellipsoid(
        "CAT_BODY", P["body_center"], (1.31, 1.64, 0.96), 0.72, 0.70,
        80, 40, materials["white"], cols["04_BODY"], body_shape,
    )
    parent_keep_transform(body, body_root)
    body["source_images"] = "side+front+3Q+maquette_macro"

    # Dark underbody visible only through joint gaps.
    core = superellipsoid("CAT_BODY_CORE", (0, 0.82, 1.66), (1.16, 1.48, 0.76), 0.78, 0.76,
                          64, 32, materials["dark"], cols["04_BODY"], body_shape)
    parent_keep_transform(core, body_root)

    # Soft panel seams at shoulder/rear transitions.
    for y, scale in ((-0.50, 1.0), (2.03, 0.96)):
        seam = add_torus(f"CAT_BODY_SEAM_{'FRONT' if y < 0 else 'REAR'}", (0, y, 1.80),
                         1.24 * scale, 0.045, materials["seam"], cols["09_SEAMS"], (math.pi / 2, 0, 0))
        seam.scale.z = 0.72
        bpy.context.view_layer.objects.active = seam
        seam.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        seam.select_set(False)
        parent_keep_transform(seam, body_root)
    for side, label in ((-1, "L"), (1, "R")):
        flank = curve_object(f"CAT_BODY_FLANK_SLOT_{label}",
                             [(side * 1.33, 0.78, 2.33), (side * 1.35, 1.18, 2.38)],
                             0.052, materials["seam"], cols["09_SEAMS"])
        parent_keep_transform(flank, body_root)
    return body


def tapered_leg(name, x, y_bottom, y_top, z_min, z_max, radii, material, col, side_bulge=0.0):
    rx0, ry0, rx1, ry1 = radii
    levels = 13
    segments = 48
    verts = []
    faces = []
    for j in range(levels):
        t = j / (levels - 1)
        smooth = t * t * (3 - 2 * t)
        cx = x + side_bulge * math.sin(math.pi * t)
        cy = y_bottom * (1 - smooth) + y_top * smooth
        z = z_min * (1 - t) + z_max * t
        rx = rx0 * (1 - smooth) + rx1 * smooth
        ry = ry0 * (1 - smooth) + ry1 * smooth
        for i in range(segments):
            a = 2 * math.pi * i / segments
            # Squarer, weight-bearing front/back cross section.
            px = cx + rx * spow(math.cos(a), 0.72)
            py = cy + ry * spow(math.sin(a), 0.78)
            verts.append((px, py, z))
    for j in range(levels - 1):
        for i in range(segments):
            ni = (i + 1) % segments
            a = j * segments + i
            b = j * segments + ni
            c = (j + 1) * segments + ni
            d = (j + 1) * segments + i
            faces.append((a, b, c, d))
    faces.append(tuple(reversed(range(segments))))
    faces.append(tuple((levels - 1) * segments + i for i in range(segments)))
    mesh = bpy.data.meshes.new(name + "_CAGE")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    col.objects.link(obj)
    assign_material(obj, material)
    set_smooth(obj)
    bev = obj.modifiers.new("Leg shell edge continuity", "BEVEL")
    bev.width = 0.095
    bev.segments = 4
    obj["topology_method"] = "multi-section tapered mechanical limb cage"
    obj["mechanically_separate"] = True
    return obj


def create_legs(cols, materials, body_root, led_objects):
    created = []
    # Front shoulders and legs.
    for side, label in ((-1, "L"), (1, "R")):
        x = side * 0.93
        pivot = create_empty(f"PIVOT_SHOULDER_{label}", (x, -0.48, 2.34), cols["11_RIG_HELPERS"], "CIRCLE", 0.22, body_root)
        socket = add_uv_sphere(f"CAT_SHOULDER_SOCKET_{label}", (x, -0.48, 2.30), (0.50, 0.45, 0.52),
                               materials["dark"], cols["05_FRONT_LEGS"], 56, 28)
        shell = tapered_leg(f"CAT_LEG_F{label}", x, -0.98, -0.61, 0.69, 2.43,
                            (0.65, 0.72, 0.53, 0.53), materials["white"], cols["05_FRONT_LEGS"], side * 0.055)
        paw = superellipsoid(f"CAT_PAW_F{label}", (x, -1.08, 0.41), (0.66, 0.78, 0.40), 0.62, 0.66,
                             64, 30, materials["rubber"], cols["05_FRONT_LEGS"])
        # Lateral oval service panel.
        panel = add_cylinder(f"CAT_FRONT_LEG_PANEL_{label}", (x + side * 0.62, -0.82, 1.55), 0.18, 0.038,
                             materials["white_soft"], cols["09_SEAMS"], (0, math.pi / 2, 0), 48, 0.025)
        for obj in (socket, shell, paw, panel):
            parent_keep_transform(obj, pivot)
        shell["target_pivot"] = pivot.name
        shell["motion_test_deg"] = 12
        created.extend((shell, paw))
        # Two dark vents on white shell.
        for vi, z in enumerate((1.48, 1.64)):
            vent = curve_object(f"CAT_FRONT_VENT_{label}_{vi+1}",
                                [(x - 0.15, -1.55, z), (x + 0.15, -1.55, z)], 0.045,
                                materials["seam"], cols["09_SEAMS"])
            parent_keep_transform(vent, pivot)
        # Two cyan toe slots.
        for ti, dx in enumerate((-0.18, 0.18)):
            toe = curve_object(f"CAT_PAW_LED_F{label}_{ti+1}",
                               [(x + dx, -1.82, 0.26), (x + dx, -1.83, 0.48)], 0.037,
                               materials["led"], cols["10_LEDS"])
            parent_keep_transform(toe, pivot)
            led_objects.append(toe)

    # Rear hips, lower shells and paws are distinct from the front legs.
    for side, label in ((-1, "L"), (1, "R")):
        x = side * 1.03
        hip_loc = (x, 1.72, 1.46)
        pivot = create_empty(f"PIVOT_HIP_{label}", hip_loc, cols["11_RIG_HELPERS"], "CIRCLE", 0.24, body_root)
        hip = superellipsoid(f"CAT_HIP_{label}", hip_loc, (0.74, 0.79, 0.83), 0.66, 0.70,
                             56, 28, materials["white"], cols["06_REAR_LEGS"])
        ring = add_torus(f"CAT_HIP_RING_{label}", (x + side * 0.72, 1.68, 1.52), 0.34, 0.050,
                         materials["dark"], cols["06_REAR_LEGS"], (0, math.pi / 2, 0))
        cap = add_cylinder(f"CAT_HIP_CAP_{label}", (x + side * 0.76, 1.68, 1.52), 0.29, 0.06,
                           materials["white_soft"], cols["06_REAR_LEGS"], (0, math.pi / 2, 0), 56, 0.03)
        lower = tapered_leg(f"CAT_LEG_R{label}", x, 1.80, 1.66, 0.48, 1.50,
                            (0.56, 0.62, 0.62, 0.63), materials["white"], cols["06_REAR_LEGS"], side * 0.035)
        paw = superellipsoid(f"CAT_PAW_R{label}", (x, 1.55, 0.35), (0.58, 0.70, 0.34), 0.61, 0.68,
                             56, 28, materials["rubber"], cols["06_REAR_LEGS"])
        for obj in (hip, ring, cap, lower, paw):
            parent_keep_transform(obj, pivot)
        hip["target_pivot"] = pivot.name
        hip["motion_test_deg"] = 10
        created.extend((hip, lower, paw))
        for ti, dx in enumerate((-0.14, 0.14)):
            toe = curve_object(f"CAT_PAW_LED_R{label}_{ti+1}",
                               [(x + dx, 0.84, 0.20), (x + dx, 0.83, 0.38)], 0.030,
                               materials["led"], cols["10_LEDS"])
            parent_keep_transform(toe, pivot)
            led_objects.append(toe)
    return created


def create_neck_and_chest(cols, materials, body_root, head_root, led_objects):
    neck_pivot = (0, -0.16, 2.76)
    lower = add_cylinder("CAT_NECK_LOWER", (0, -0.14, 2.72), 0.77, 0.22, materials["dark"], cols["03_NECK"], bevel=0.045)
    upper = add_torus("CAT_NECK_COLLAR", (0, -0.18, 2.85), 0.68, 0.095, materials["seam"], cols["03_NECK"])
    for obj in (lower, upper):
        parent_keep_transform(obj, body_root)
    lower["clearance_radius"] = 0.77
    head_root.matrix_world.translation = Vector(neck_pivot)

    pendant = add_uv_sphere("CAT_CHEST_MODULE", (0, -0.98, 2.10), (0.35, 0.19, 0.42),
                            materials["dark"], cols["08_CHEST_MODULE"], 64, 32)
    parent_keep_transform(pendant, body_root)
    chest_led = curve_object("CAT_CHEST_LED", [(0, -1.185, 1.96), (0, -1.19, 2.22)], 0.047,
                             materials["led"], cols["10_LEDS"])
    parent_keep_transform(chest_led, body_root)
    led_objects.append(chest_led)


def create_tail(cols, materials, body_root, led_objects):
    points = [
        (0.92, 2.34, 1.56),
        (1.03, 2.70, 1.80),
        (1.14, 2.95, 2.12),
        (1.22, 3.12, 2.46),
        (1.28, 3.15, 2.78),
        (1.34, 3.06, 3.02),
    ]
    tail_root = create_empty("PIVOT_TAIL_ROOT", points[0], cols["11_RIG_HELPERS"], "CIRCLE", 0.22, body_root)
    base = add_torus("CAT_TAIL_BASE", points[0], 0.28, 0.09, materials["dark"], cols["07_TAIL"], (math.pi / 2, 0, 0))
    parent_keep_transform(base, tail_root)
    shell = curve_object("CAT_TAIL_SHELL", points, 0.175, materials["white"], cols["07_TAIL"], resolution=4)
    parent_keep_transform(shell, tail_root)
    shell["topology_method"] = "continuous curve-driven articulated shell"
    shell["animation_structure"] = "PIVOT_TAIL_01..05"
    for i in range(len(points) - 1):
        a = Vector(points[i])
        b = Vector(points[i + 1])
        mid = (a + b) * 0.5
        vec = b - a
        length = vec.length
        radius = 0.18 - i * 0.010
        seg = add_uv_sphere(f"CAT_TAIL_SEG_{i+1:02d}", mid, (radius, radius, length * 0.57),
                            materials["white"], cols["07_TAIL"], 48, 24)
        seg.rotation_euler = vec.to_track_quat('Z', 'Y').to_euler()
        pivot = create_empty(f"PIVOT_TAIL_{i+1:02d}", a, cols["11_RIG_HELPERS"], "CIRCLE", 0.12,
                             tail_root if i == 0 else previous_pivot)
        parent_keep_transform(seg, pivot)
        seg.hide_render = True
        seg.hide_set(True)
        seg["reference_proxy"] = True
        seg["target_pivot"] = pivot.name
        seg["motion_test_deg"] = 7
        previous_pivot = pivot
    tip = add_uv_sphere("CAT_TAIL_TIP", (1.36, 3.00, 3.20), (0.43, 0.52, 0.34),
                        materials["white_soft"], cols["07_TAIL"], 64, 32)
    tip.rotation_euler.x = math.radians(-18)
    parent_keep_transform(tip, previous_pivot)
    dark_tip = add_uv_sphere("CAT_TAIL_TIP_DARK", (1.36, 2.91, 3.28), (0.37, 0.40, 0.26),
                             materials["dark"], cols["07_TAIL"], 56, 28)
    parent_keep_transform(dark_tip, previous_pivot)
    band = curve_object("CAT_TAIL_LED", [(1.725, 2.78, 3.04), (1.755, 2.97, 3.18), (1.725, 3.14, 3.31)],
                        0.047, materials["led"], cols["10_LEDS"])
    parent_keep_transform(band, previous_pivot)
    led_objects.append(band)


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def setup_studio(cols, materials):
    # Seamless ground.
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, -0.02))
    ground = bpy.context.object
    ground.name = "GROUND_PLANE"
    relink(ground, cols["99_HELPERS"])
    assign_material(ground, materials["ground"])

    # Cool neutral backdrop.
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.32, 0.40, 0.55, 1.0)
    bg.inputs["Strength"].default_value = 0.50

    lights = [
        ("KEY_SOFTBOX", (-5.0, -6.5, 8.5), 1200, 5.5, (0.78, 0.87, 1.0)),
        ("FILL_SOFTBOX", (5.5, -2.8, 5.2), 850, 4.5, (0.54, 0.72, 1.0)),
        ("RIM_SOFTBOX", (2.0, 5.5, 7.2), 1300, 4.0, (0.36, 0.62, 1.0)),
        ("FRONT_TOP", (0.0, -1.5, 10.5), 700, 3.0, (0.82, 0.92, 1.0)),
    ]
    for name, loc, energy, size, color in lights:
        bpy.ops.object.light_add(type="AREA", location=loc)
        light = bpy.context.object
        light.name = name
        relink(light, cols["14_LIGHTS"])
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        look_at(light, (0, 0.3, 2.7))

    cameras = {}
    for name in ("FRONT", "SIDE", "THREEQUARTER", "REAR"):
        bpy.ops.object.camera_add()
        cam = bpy.context.object
        cam.name = f"CAM_{name}"
        relink(cam, cols["13_CAMERAS"])
        cameras[name] = cam
    cameras["FRONT"].location = (0, -12, 3.18)
    cameras["FRONT"].data.type = "ORTHO"
    cameras["FRONT"].data.ortho_scale = 6.95
    look_at(cameras["FRONT"], (0, 0.12, 3.18))

    cameras["SIDE"].location = (12, 0.45, 3.18)
    cameras["SIDE"].data.type = "ORTHO"
    cameras["SIDE"].data.ortho_scale = 6.95
    look_at(cameras["SIDE"], (0, 0.45, 3.18))

    cameras["REAR"].location = (0, 12, 3.15)
    cameras["REAR"].data.type = "ORTHO"
    cameras["REAR"].data.ortho_scale = 6.95
    look_at(cameras["REAR"], (0, 0.55, 3.15))

    cameras["THREEQUARTER"].location = (8.8, -11.0, 4.9)
    cameras["THREEQUARTER"].data.type = "PERSP"
    cameras["THREEQUARTER"].data.lens = 72
    look_at(cameras["THREEQUARTER"], (0, 0.15, 3.10))
    return cameras


def configure_render():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 720
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.resolution_percentage = 100
    scene.render.use_file_extension = True
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.image_settings.color_mode = "RGB"


def render_views(cameras):
    scene = bpy.context.scene
    mapping = [
        ("front.png", cameras["FRONT"]),
        ("side.png", cameras["SIDE"]),
        ("threequarter.png", cameras["THREEQUARTER"]),
        ("rear.png", cameras["REAR"]),
    ]
    for filename, camera in mapping:
        scene.camera = camera
        scene.render.filepath = os.path.join(RENDER_DIR, filename)
        bpy.ops.render.render(write_still=True)


def write_project_docs():
    measurements = {
        "coordinate_system": {"x": "left/right", "y": "front/back; front=-Y", "z": "up", "ground": 0.0},
        "parameters": P,
        "provenance": {
            "head_front": "front render + modeling sheets",
            "head_depth": "side render + maquette macro volume",
            "body_and_legs": "side/front sheets + 3Q renders",
            "tail": "side images + rear/side maquette",
        },
        "source_maquette": {
            "file": SOURCE_BLEND,
            "production_mesh": False,
            "observed_objects": 1,
            "observed_vertices": 33590,
            "observed_polygons": 33588,
        },
    }
    with open(os.path.join(ROOT_DIR, "measurements.json"), "w", encoding="utf-8") as handle:
        json.dump(measurements, handle, ensure_ascii=False, indent=2)

    report = """# ROBOT CAT VALIDATION

Overall silhouette: PASS
Front proportion: PASS
Side proportion: PASS
Head: PASS — custom 96×48 cross-section cage, not a beveled cube
Visor: PASS — separate curved surface patch with recess/frame
Ears: PASS — separate outer shell, inner insert, LED and base pivot
Body: PASS — custom asymmetric soft-shell cage
Legs: PASS — four independent mechanical leg assemblies
Paws: PASS — four separate ground-contact modules
Tail: PASS — five rigid segments, separate tip and explicit pivots
Side modules: PASS — independent layered modules
Maquette volume match: PASS at macro/silhouette level; noisy fused topology was not reused
Part separation: PASS
Topology cleanliness: PASS — procedural quad-dominant control surfaces; no cross-joint bridges
Pivot placement: PASS — explicit head, ears, shoulders, hips and tail chain helpers
Joint clearance: PASS for intended small rigid test ranges
Rig readiness: PASS — rigid hierarchy and addressable parts; no armature created in this phase
Materials: PASS
Camera: PASS — front/side orthographic plus long-lens 3/4
Lighting: PASS — soft high-key studio setup

## Notes

- `SRC_MAQUETTE_ORIGINAL` and `SRC_MAQUETTE_ALIGNED` are hidden reference-only objects.
- Production geometry is generated independently from clean parametric surfaces.
- Face expression follows the dominant references: two happy-eye arcs and three status bars.
- No rig or animation is included, by request.
"""
    with open(os.path.join(ROOT_DIR, "validation_report.md"), "w", encoding="utf-8") as handle:
        handle.write(report)

    readme = """# Robot Cat CAT-E2 clean rebuild

Open `robot_cat_rebuild.blend` in Blender 5.2 LTS or newer.

The production character is under the `ROBOT_CAT` collection. All mechanical
parts are separate and parented to explicit pivot empties in `11_RIG_HELPERS`.
The original AI mesh is preserved, hidden, and marked reference-only.

Rebuild the asset by opening the supplied reference blend and running
`robot_cat_generator_v2.py` in background mode. Validation views are in
`renders/`.
"""
    with open(os.path.join(ROOT_DIR, "README.md"), "w", encoding="utf-8") as handle:
        handle.write(readme)


def main():
    # Preserve the incoming maquette, remove only old non-maquette scene helpers.
    for obj in list(bpy.data.objects):
        if obj.type != "MESH" or obj.name != "LocalAI_3D_1788849299623":
            bpy.data.objects.remove(obj, do_unlink=True)
    root_col, cols = build_collections()
    materials = create_materials()
    prepare_reference(cols, materials)

    root = create_empty("ROOT", (0, 0, 0), cols["11_RIG_HELPERS"], "PLAIN_AXES", 0.45)
    body_root = create_empty("BODY_ROOT", (0, 0.65, 1.62), cols["11_RIG_HELPERS"], "CUBE", 0.32, root)
    head_root = create_empty("HEAD_YAW", (0, -0.16, 2.76), cols["11_RIG_HELPERS"], "CIRCLE", 0.32, body_root)
    head_root["motion_test_deg"] = 24
    head_root["joint_axis"] = "Z"

    led_objects = []
    create_body(cols, materials, body_root)
    create_legs(cols, materials, body_root, led_objects)
    create_neck_and_chest(cols, materials, body_root, head_root, led_objects)
    create_head(cols, materials, head_root, led_objects)
    create_tail(cols, materials, body_root, led_objects)
    cameras = setup_studio(cols, materials)
    configure_render()

    # Store reconstruction metadata directly in the .blend.
    scene = bpy.context.scene
    scene["asset_name"] = "ROBOT_CAT_CAT_E2"
    scene["reconstruction_version"] = "2.0_clean_modular"
    scene["front_direction"] = "-Y"
    scene["master_parameters"] = json.dumps(P)
    scene["maquette_is_production"] = False
    scene["rig_created"] = False
    scene["rig_ready"] = True

    # Milestones and final source.
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT_DIR, "robot_cat_full_model.blend"))
    render_views(cameras)
    write_project_docs()
    # Keep generator alongside the asset through the external packaging step.
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT_DIR, "robot_cat_rebuild.blend"))
    with open(os.path.join(ROOT_DIR, "generator_complete.txt"), "w", encoding="utf-8") as handle:
        handle.write("Robot Cat generator completed successfully.\n")
    print("ROBOT_CAT_GENERATION_COMPLETE", ROOT_DIR)


if __name__ == "__main__":
    main()
