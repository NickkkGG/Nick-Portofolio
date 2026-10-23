"""Shared helpers for the asset scripts (spec §5.1).

Every script authors positions in three.js coordinates (metres, Y up, -Z toward
the room's back wall) through `V()`, so numbers match the web code. The glTF
exporter turns Blender's Z-up back into Y-up on the way out.
"""

import math
import pathlib
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = pathlib.Path(__file__).resolve().parents[2]
BLENDER = ROOT / "blender"
TEXTURES = BLENDER / "assets-src" / "textures"
BUILD = BLENDER / "build"
SOURCE = BLENDER / "source"
PREVIEWS = BLENDER / "previews"
PUBLIC_MODELS = ROOT / "public" / "models"


def V(x, y, z):
    """three.js position (Y up) -> Blender position (Z up)."""
    return Vector((x, -z, y))


def D(w, h, d):
    """three.js size (width X, height Y, depth Z) -> Blender size (X, Y, Z)."""
    return Vector((w, d, h))


def rotation(rot):
    """three.js rotation (x, y, z) in radians -> Blender matrix. Applied Z, then X, then Y (yaw last)."""
    rx, ry, rz = rot
    return Matrix.Rotation(ry, 4, "Z") @ Matrix.Rotation(rx, 4, "X") @ Matrix.Rotation(-rz, 4, "Y")


def aim(direction):
    """The rotation() that turns a primitive's +Y (three.js) to point along `direction`."""
    d = Vector(direction).normalized()
    return (math.acos(max(-1.0, min(1.0, d.y))), math.atan2(d.x, d.z), 0.0)


# ---------------------------------------------------------------------------
# Scene


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for device in prefs.devices:
        device.use = device.type == "METAL"
    scene.cycles.device = "GPU"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    return scene


def use_gpu():
    """Device preferences are not saved in .blend files; call after opening one."""
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for device in prefs.devices:
        device.use = device.type == "METAL"
    bpy.context.scene.cycles.device = "GPU"


def collection(name):
    found = bpy.data.collections.get(name)
    if found:
        return found
    created = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(created)
    return created


def save_blend(path):
    path = pathlib.Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)


def seeded(seed):
    return random.Random(seed)


# ---------------------------------------------------------------------------
# Mesh building: bmesh in world space, objects keep identity transforms.
#
# Each primitive is created at the origin, then moved on its own: a vertex layer
# marks what existed before, so only the new vertices are transformed.

_MARK = "__old"


def _mark_all(bm):
    layer = bm.verts.layers.int.get(_MARK) or bm.verts.layers.int.new(_MARK)
    for v in bm.verts:
        v[layer] = 1


def _fresh(bm):
    layer = bm.verts.layers.int.get(_MARK)
    if layer is None:
        return list(bm.verts)
    return [v for v in bm.verts if v[layer] == 0]


def _place(bm, center, rot, material):
    """Rotates and moves the fresh primitive; material None keeps per-face materials."""
    verts = _fresh(bm)
    fresh = set(verts)
    if material is not None:
        for face in bm.faces:
            if face.verts[0] in fresh:
                face.material_index = material
    bmesh.ops.transform(bm, matrix=rotation(rot), verts=verts)
    bmesh.ops.translate(bm, vec=V(*center), verts=verts)
    _mark_all(bm)
    return verts


def new_bmesh():
    bm = bmesh.new()
    _mark_all(bm)
    return bm


def box(bm, size, center, bevel=0.0, segments=2, rot=(0.0, 0.0, 0.0), material=0):
    """Box of three.js size (w, h, d) centred at center, optionally with rounded edges."""
    geom = bmesh.ops.create_cube(bm, size=1.0)
    s = D(*size)
    bmesh.ops.scale(bm, vec=s, verts=geom["verts"])
    if bevel > 0:
        edges = list({e for v in geom["verts"] for e in v.link_edges})
        bmesh.ops.bevel(
            bm, geom=edges, offset=min(bevel, 0.45 * min(s)), segments=segments, profile=0.5, affect="EDGES", clamp_overlap=True
        )
    return _place(bm, center, rot, material)


def cylinder(bm, radius, height, center, segments=24, rot=(0.0, 0.0, 0.0), material=0, radius_top=None, cap=True, bevel=0.0):
    """Cylinder (or cone, with radius_top) along three.js Y, centred at center."""
    geom = bmesh.ops.create_cone(
        bm,
        cap_ends=cap,
        cap_tris=False,
        segments=segments,
        radius1=radius,
        radius2=radius if radius_top is None else radius_top,
        depth=height,
    )
    if bevel > 0 and cap:
        edges = [e for e in {e for v in geom["verts"] for e in v.link_edges} if len(e.link_faces) == 2 and abs(e.link_faces[0].normal.dot(e.link_faces[1].normal)) < 0.5]
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=2, profile=0.5, affect="EDGES", clamp_overlap=True)
    return _place(bm, center, rot, material)


def sphere(bm, radius, center, segments=24, rings=12, scale=(1.0, 1.0, 1.0), rot=(0.0, 0.0, 0.0), material=0):
    geom = bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    bmesh.ops.scale(bm, vec=D(*scale), verts=geom["verts"])
    return _place(bm, center, rot, material)


def lathe(bm, profile, center, segments=32, rot=(0.0, 0.0, 0.0), material=0, close_bottom=False, close_top=False):
    """Surface of revolution around three.js Y. profile = [(radius, y), ...] from bottom to top."""
    rings = []
    for r, y in profile:
        ring = [bm.verts.new(Vector((r * math.cos(2 * math.pi * k / segments), r * math.sin(2 * math.pi * k / segments), y))) for k in range(segments)]
        rings.append(ring)
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(segments):
            bm.faces.new((r0[k], r0[(k + 1) % segments], r1[(k + 1) % segments], r1[k]))
    if close_bottom:
        bm.faces.new(list(reversed(rings[0])))
    if close_top:
        bm.faces.new(rings[-1])
    return _place(bm, center, rot, material)


def tube(bm, points, radius, sides=8, material=0, caps=True, uv_tile=None):
    """Round tube along a polyline of three.js points (cables, wires, rods).

    radius may be one number or one per point (tapering). With uv_tile (metres per texture
    repeat), UVs run along the tube (u) and around it (v), so cable textures follow the cable.
    """
    pts = [V(*p) for p in points]
    radii = list(radius) if isinstance(radius, (list, tuple)) else [radius] * len(pts)
    rings = []
    normal = None
    for i, p in enumerate(pts):
        if i == 0:
            t = pts[1] - pts[0]
        elif i == len(pts) - 1:
            t = pts[-1] - pts[-2]
        else:
            t = pts[i + 1] - pts[i - 1]
        t.normalize()
        if normal is None:
            helper = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
            normal = t.cross(helper).normalized()
        else:
            # Parallel transport keeps the rings from twisting along the tube.
            normal = (normal - t * normal.dot(t)).normalized()
        binormal = t.cross(normal).normalized()
        r = radii[i]
        rings.append([bm.verts.new(p + r * (math.cos(2 * math.pi * k / sides) * normal + math.sin(2 * math.pi * k / sides) * binormal)) for k in range(sides)])
    uv = bm.loops.layers.uv.get("UVMap") or bm.loops.layers.uv.new("UVMap") if uv_tile else None
    along = [0.0]
    for a, b in zip(pts, pts[1:]):
        along.append(along[-1] + (b - a).length)
    for i, (r0, r1) in enumerate(zip(rings, rings[1:])):
        for k in range(sides):
            face = bm.faces.new((r0[k], r0[(k + 1) % sides], r1[(k + 1) % sides], r1[k]))
            if uv is not None:
                around = 2 * math.pi * radii[i] / uv_tile
                coords = [(along[i], k), (along[i], k + 1), (along[i + 1], k + 1), (along[i + 1], k)]
                for loop, (u, kk) in zip(face.loops, coords):
                    loop[uv].uv = (u / uv_tile, kk / sides * around)
    if caps:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    return _place(bm, (0, 0, 0), (0, 0, 0), material)


def rounded_outline(width_bottom, width_top, height, radius_bottom, radius_top, steps=6):
    """Counter-clockwise outline of a rounded, slightly tapered slab, centred, in (x, y)."""
    hb, ht, hh = width_bottom / 2, width_top / 2, height / 2

    def arc(cx, cy, r, a0, a1):
        return [(cx + r * math.cos(a0 + (a1 - a0) * i / steps), cy + r * math.sin(a0 + (a1 - a0) * i / steps)) for i in range(steps + 1)]

    pts = []
    pts += arc(hb - radius_bottom, -hh + radius_bottom, radius_bottom, -math.pi / 2, 0)
    pts += arc(ht - radius_top, hh - radius_top, radius_top, 0, math.pi / 2)
    pts += arc(-ht + radius_top, hh - radius_top, radius_top, math.pi / 2, math.pi)
    pts += arc(-hb + radius_bottom, -hh + radius_bottom, radius_bottom, math.pi, 3 * math.pi / 2)
    return pts


def padded(bm, outline, thickness, center, rot=(0.0, 0.0, 0.0), bevel=0.02, material=0):
    """An upholstered pad: the outline (local x, y) extruded along local +Z, edges rounded."""
    front = [bm.verts.new(V(x, y, thickness / 2)) for x, y in outline]
    back = [bm.verts.new(V(x, y, -thickness / 2)) for x, y in outline]
    f_front = bm.faces.new(front)
    f_back = bm.faces.new(list(reversed(back)))
    n = len(outline)
    for i in range(n):
        bm.faces.new((back[i], back[(i + 1) % n], front[(i + 1) % n], front[i]))
    bm.normal_update()
    edges = list({e for f in (f_front, f_back) for e in f.edges})
    bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=3, profile=0.5, affect="EDGES", clamp_overlap=True)
    return _place(bm, center, rot, material)


def book(bm, size, center, rot=(0.0, 0.0, 0.0), design=0, designs=16, cover=0, pages=1):
    """A hardback: two cover boards, a rounded spine and a page block set back inside them.

    size is (thickness, height, depth) in three.js metres; locally the spine faces +Z and the
    front cover +X. UVs point into the book atlas (art.book_atlas): column `design`, spine in
    its top three quarters, plain cloth for the covers in the bottom quarter. Page faces tile
    the page-edge texture, with the sheet lines running along the edges.
    """
    t, h, d = size
    board = min(0.0028, t * 0.12)
    overhang = 0.003
    uv = bm.loops.layers.uv.get("UVMap") or bm.loops.layers.uv.new("UVMap")
    local = lambda co: (co.x, co.z, -co.y)  # Blender -> three.js
    col0, col1 = (design + 0.04) / designs, (design + 0.96) / designs

    def cover_uv(face):
        for loop in face.loops:
            x, y, z = local(loop.vert.co)
            loop[uv].uv = (col0 + (col1 - col0) * (z / d + 0.5), 0.01 + 0.23 * (y / h + 0.5))

    def page_uv(face):
        n = face.normal
        for loop in face.loops:
            x, y, z = local(loop.vert.co)
            if abs(n.z) > 0.5:  # three.js Y: top and bottom of the block
                loop[uv].uv = (z / 0.12, x / 0.03)
            elif abs(n.y) > 0.5:  # three.js Z: fore-edge
                loop[uv].uv = (y / 0.12, x / 0.03)
            else:
                loop[uv].uv = (y / 0.12, z / 0.12)

    def cube(sx, sy, sz, cx, cy, cz):
        geom = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=D(sx, sy, sz), verts=geom["verts"])
        bmesh.ops.translate(bm, vec=V(cx, cy, cz), verts=geom["verts"])
        return {f for v in geom["verts"] for f in v.link_faces}

    for face in cube(t - 2 * board, h - 2 * overhang, d - overhang - 0.004, 0, 0, -(overhang + 0.004) / 2):
        face.material_index = pages
        face.normal_update()
        page_uv(face)
    for side in (1, -1):
        for face in cube(board, h, d, side * (t / 2 - board / 2), 0, 0):
            face.material_index = cover
            cover_uv(face)
    # The spine bows out a little between the boards.
    steps = 6
    bottom, top = [], []
    for i in range(steps + 1):
        a = i / steps
        x = -t / 2 + t * a
        z = d / 2 + t * 0.12 * math.sin(math.pi * a)
        bottom.append(bm.verts.new(V(x, -h / 2, z)))
        top.append(bm.verts.new(V(x, h / 2, z)))
    for i in range(steps):
        face = bm.faces.new((bottom[i], bottom[i + 1], top[i + 1], top[i]))
        face.material_index = cover
        for loop, (a, b) in zip(face.loops, [(i, 0), (i + 1, 0), (i + 1, 1), (i, 1)]):
            loop[uv].uv = (col0 + (col1 - col0) * a / steps, 0.255 + 0.74 * b)
    return _place(bm, center, rot, None)


def polygon(bm, corners, material=0):
    """One face through three.js corners, counter-clockwise seen from its front."""
    bm.faces.new([bm.verts.new(V(*c)) for c in corners])
    return _place(bm, (0, 0, 0), (0, 0, 0), material)


def sheet(bm, cuts_u, cuts_v, to_world, material=0):
    """A subdivided patch; to_world(u, v) with u, v in 0..1 returns a three.js point."""
    rows = [[bm.verts.new(V(*to_world(i / cuts_u, j / cuts_v))) for i in range(cuts_u + 1)] for j in range(cuts_v + 1)]
    for j in range(cuts_v):
        for i in range(cuts_u):
            bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
    return _place(bm, (0, 0, 0), (0, 0, 0), material)


def finish(name, bm, materials, coll, smooth_angle=None, props=None):
    """Turns a bmesh into an object with its material slots and custom properties."""
    layer = bm.verts.layers.int.get(_MARK)
    if layer is not None:
        bm.verts.layers.int.remove(layer)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for mat in materials:
        me.materials.append(mat)
    obj = bpy.data.objects.new(name, me)
    coll.objects.link(obj)
    if smooth_angle is not None:
        me.shade_smooth()
        me.set_sharp_from_angle(angle=math.radians(smooth_angle))
    for key, value in (props or {}).items():
        obj[key] = value
    return obj


# ---------------------------------------------------------------------------
# Materials


def load_image(path, colorspace):
    img = bpy.data.images.load(str(path), check_existing=True)
    img.colorspace_settings.name = colorspace
    return img


def gltf_output_group():
    """The node group the glTF exporter reads ambient occlusion from."""
    group = bpy.data.node_groups.get("glTF Material Output")
    if group:
        return group
    group = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
    group.interface.new_socket("Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
    group.interface.new_socket("Thickness", in_out="INPUT", socket_type="NodeSocketFloat")
    group.nodes.new("NodeGroupInput")
    return group


def material(name, color=(0.5, 0.5, 0.5), roughness=0.8, metallic=0.0, textures=None, normal_strength=1.0, alpha_blend=False, alpha=1.0, tile=1.0, emission=None, props=None):
    """Principled material for bake and glTF export.

    textures: dict(color=, normal=, orm=, alpha=) image paths on UV map "UVMap". Missing files fall
    back to the flat values, so geometry previews work before textures are downloaded.
    alpha: constant opacity; Cycles lets light through the rest, which is how glass passes moonlight.
    tile: metres per texture repeat, read by box_uv().
    """
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    out.location = (600, 0)
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (300, 0)
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Alpha"].default_value = alpha
    textures = {k: pathlib.Path(v) for k, v in (textures or {}).items() if v and pathlib.Path(v).exists()}
    uv = nodes.new("ShaderNodeUVMap")
    uv.uv_map = "UVMap"
    uv.location = (-900, 0)

    def tex(key, colorspace, y):
        node = nodes.new("ShaderNodeTexImage")
        node.image = load_image(textures[key], colorspace)
        node.location = (-600, y)
        node.label = key
        links.new(uv.outputs["UV"], node.inputs["Vector"])
        return node

    if "color" in textures:
        links.new(tex("color", "sRGB", 300).outputs["Color"], bsdf.inputs["Base Color"])
    if "orm" in textures:
        orm = tex("orm", "Non-Color", 0)
        split = nodes.new("ShaderNodeSeparateColor")
        split.location = (-300, 0)
        links.new(orm.outputs["Color"], split.inputs["Color"])
        links.new(split.outputs["Green"], bsdf.inputs["Roughness"])
        if metallic > 0:
            links.new(split.outputs["Blue"], bsdf.inputs["Metallic"])
        group = nodes.new("ShaderNodeGroup")
        group.node_tree = gltf_output_group()
        group.location = (300, -450)
        links.new(split.outputs["Red"], group.inputs["Occlusion"])
    if "normal" in textures:
        nmap = nodes.new("ShaderNodeNormalMap")
        nmap.location = (0, -300)
        nmap.inputs["Strength"].default_value = normal_strength
        links.new(tex("normal", "Non-Color", -300).outputs["Color"], nmap.inputs["Color"])
        links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    if "alpha" in textures:
        links.new(tex("alpha", "Non-Color", -600).outputs["Color"], bsdf.inputs["Alpha"])
    if alpha_blend or "alpha" in textures:
        mat.surface_render_method = "BLENDED"
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission[0], 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission[1]
    mat["tile"] = tile
    for key, value in (props or {}).items():
        mat[key] = value
    return mat


# ---------------------------------------------------------------------------
# UVs


def box_uv(obj, layer="UVMap", rotate=0.0, offset=(0.0, 0.0), only_unset=False):
    """World-scale box projection: each face takes the plane of its dominant axis.

    Texel density comes from the material's `tile` (metres per repeat), so separate
    meshes with the same material share one texture scale. rotate turns the grain.
    only_unset leaves faces alone that already have UVs (all-zero UVs count as unset).
    """
    me = obj.data
    uv_layer = me.uv_layers.get(layer) or me.uv_layers.new(name=layer)
    mw = obj.matrix_world
    c, s = math.cos(rotate), math.sin(rotate)
    for poly in me.polygons:
        if only_unset and any(uv_layer.data[li].uv.length_squared > 0 for li in poly.loop_indices):
            continue
        mat = me.materials[poly.material_index] if me.materials else None
        tile = float(mat.get("tile", 1.0)) if mat else 1.0
        n = (mw.to_3x3() @ poly.normal).normalized()
        ax = max(range(3), key=lambda k: abs(n[k]))
        for li in poly.loop_indices:
            p = mw @ me.vertices[me.loops[li].vertex_index].co
            if ax == 2:
                u, v = p.x, p.y
            elif ax == 0:
                u, v = p.y, p.z
            else:
                u, v = p.x, p.z
            u, v = u * c - v * s, u * s + v * c
            uv_layer.data[li].uv = (u / tile + offset[0], v / tile + offset[1])
    return uv_layer


def strip_uv(obj, length_axis_world, tile, layer="UVMap"):
    """For long thin things (cables, rods): u runs along the object, v around it."""
    me = obj.data
    uv_layer = me.uv_layers.get(layer) or me.uv_layers.new(name=layer)
    axis = Vector(length_axis_world).normalized()
    for poly in me.polygons:
        for li in poly.loop_indices:
            p = obj.matrix_world @ me.vertices[me.loops[li].vertex_index].co
            uv_layer.data[li].uv = (p.dot(axis) / tile, (li % 8) / 8.0 * 0.05)
    return uv_layer


def select_only(objects, active=None):
    for obj in bpy.context.view_layer.objects:
        obj.select_set(False)
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = active or (objects[0] if objects else None)
