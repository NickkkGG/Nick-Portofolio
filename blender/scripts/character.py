"""Builds character.glb: the tired creator who sits at the desk, falls, and waits in the depths.

    blender/build_character.sh            (sets MPFB up on the first run, then runs this)

The figure is a MakeHuman human made with MPFB 2: its low-poly body topology, a young skin,
eyes, brows, lashes, short hair, a long-sleeved shirt with jeans, sneakers and the game-engine
rig with its weights, all CC0 (see blender/assets-src/CREDITS.md). Made here on top of that:
the shirt dyed into a charcoal sweatshirt (its photographed knit kept, the print and stripes
painted out), darker jeans, a hood lying round the neck with drawstrings, over-ear headphones
with a coiled cable, plain glTF materials, and the poses the story needs. In three.js the
figure faces +Z with its feet on the origin.
"""

import math
import pathlib
import sys
import zipfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import bmesh  # noqa: E402
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix, Quaternion, Vector  # noqa: E402

import common as C  # noqa: E402
import textures as T  # noqa: E402
from common import V  # noqa: E402

COLL = "Character"
MPFB = "bl_ext.user_default.mpfb"
PACK = C.BLENDER / "assets-src" / "character" / "makehuman" / "makehuman_system_assets_cc0.zip"
OUT_TEXTURES = C.BUILD / "textures" / "character"

# A young man of about twenty-three, slight and a bit tired-looking.
MACRO = {
    "gender": 0.9,
    "age": 0.44,
    "muscle": 0.45,
    "weight": 0.42,
    "proportions": 0.6,
    "height": 0.55,
    "cupsize": 0.5,
    "firmness": 0.5,
    "race": {"asian": 0.75, "caucasian": 0.25, "african": 0.0},
}
SKIN = "young_asian_male"
# key: (asset folder, name, MPFB asset type)
ASSETS = {
    "Eyes": ("eyes", "low-poly", "Eyes"),
    "Brows": ("eyebrows", "eyebrow001", "Eyebrows"),
    "Lashes": ("eyelashes", "eyelashes01", "Eyelashes"),
    "Hair": ("hair", "short01", "Hair"),
    "Clothes": ("clothes", "male_casualsuit02", "Clothes"),
    "Shoes": ("clothes", "shoes05", "Clothes"),
}


def mpfb():
    """MPFB's services, with the asset pack unpacked into its data folder on the first run."""
    if MPFB not in bpy.context.preferences.addons and bpy.ops.preferences.addon_enable(module=MPFB) != {"FINISHED"}:
        raise RuntimeError("MPFB is not installed: run blender/build_character.sh")
    # Importable only once the add-on is enabled.
    from bl_ext.user_default.mpfb.services import HumanService, LocationService

    data = pathlib.Path(LocationService.get_user_data())
    if not (data / "skins" / SKIN).exists():
        with zipfile.ZipFile(PACK) as pack:
            pack.extractall(data)
    return HumanService, data


def make_human(coll):
    humans, data = mpfb()

    def asset(kind, name, ext="mhclo"):
        return str(data / kind / name / f"{name}.{ext}")

    base = humans.create_human(macro_detail_dict=MACRO)
    rig = humans.add_builtin_rig(base, "game_engine")
    body = humans.add_mhclo_asset(asset("proxymeshes", "male1591", "proxy"), base, asset_type="Proxymeshes", subdiv_levels=0, material_type="NONE")
    hide = base.modifiers.new("Hide base mesh", "MASK")
    hide.vertex_group = "body"
    hide.invert_vertex_group = True
    humans.set_character_skin(asset("skins", SKIN, "mhmat"), base, bodyproxy=body, skin_type="GAMEENGINE")
    parts = {"Body": body}
    for key, (kind, name, kind_name) in ASSETS.items():
        parts[key] = humans.add_mhclo_asset(asset(kind, name), base, asset_type=kind_name, subdiv_levels=0, material_type="MAKESKIN")
    for obj in [base, rig, *parts.values()]:
        for c in obj.users_collection:
            c.objects.unlink(obj)
        coll.objects.link(obj)
    base.hide_render = True
    rig.name = rig.data.name = "Rig"
    for key, obj in parts.items():
        obj.name = key
    return base, rig, parts, data


def three(p):
    """Blender position -> three.js (Y up, front +Z)."""
    return Vector((p.x, p.z, -p.y))


# ---------------------------------------------------------------------------
# Textures: the shirt dyed charcoal, the jeans a darker wash, ambient occlusion in the colour.


def _blur(img, sigma):
    """Gaussian blur that wraps at the edges (the atlas has room round every island)."""
    f = np.fft.fftfreq(img.shape[0])
    fx, fy = np.meshgrid(f, f)
    low = np.exp(-2 * math.pi**2 * sigma**2 * (fx**2 + fy**2))
    if img.ndim == 2:
        return np.fft.ifft2(np.fft.fft2(img) * low).real
    return np.dstack([np.fft.ifft2(np.fft.fft2(img[..., c]) * low).real for c in range(img.shape[2])])


def island_masks(obj, size):
    """Coverage of the shirt's and the jeans' UV islands on the clothes atlas, told apart by height."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    uv = bm.loops.layers.uv.active
    bm.faces.ensure_lookup_table()
    parent = list(range(len(bm.faces)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for edge in bm.edges:
        faces = edge.link_faces
        if len(faces) != 2:
            continue
        a, b = faces
        # The same UV at both ends of the edge in both faces: one island.
        ua = {l.vert.index: l[uv].uv.copy() for l in a.loops if l.vert in edge.verts}
        ub = {l.vert.index: l[uv].uv.copy() for l in b.loops if l.vert in edge.verts}
        if all((ua[k] - ub[k]).length < 1e-5 for k in ua):
            parent[find(a.index)] = find(b.index)
    heights = {}
    for f in bm.faces:
        heights.setdefault(find(f.index), []).append(f.calc_center_median().z)
    shirt_islands = {k for k, zs in heights.items() if sum(zs) / len(zs) > 1.0}
    masks = {"shirt": np.zeros((size, size), bool), "jeans": np.zeros((size, size), bool)}
    for f in bm.faces:
        key = "shirt" if find(f.index) in shirt_islands else "jeans"
        pts = [l[uv].uv * size for l in f.loops]
        for k in range(1, len(pts) - 1):
            _fill_triangle(masks[key], pts[0], pts[k], pts[k + 1])
    bm.free()
    return masks


def _fill_triangle(mask, a, b, c):
    x0, x1 = int(max(0, min(a.x, b.x, c.x) - 2)), int(min(mask.shape[1] - 1, max(a.x, b.x, c.x) + 2))
    y0, y1 = int(max(0, min(a.y, b.y, c.y) - 2)), int(min(mask.shape[0] - 1, max(a.y, b.y, c.y) + 2))
    if x1 < x0 or y1 < y0:
        return
    ys, xs = np.mgrid[y0 : y1 + 1, x0 : x1 + 1] + 0.5
    d = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
    if abs(d) < 1e-12:
        return
    l1 = ((b.y - c.y) * (xs - c.x) + (c.x - b.x) * (ys - c.y)) / d
    l2 = ((c.y - a.y) * (xs - c.x) + (a.x - c.x) * (ys - c.y)) / d
    l3 = 1 - l1 - l2
    # A little margin all round, so no seam shows the old colour.
    inside = (l1 > -0.02) & (l2 > -0.02) & (l3 > -0.02)
    mask[y0 : y1 + 1, x0 : x1 + 1] |= inside


def dyed_clothes(obj, folder):
    """The shirt in charcoal with its print, stripes and collar painted out; the jeans darker."""
    name = "male_casualsuit02"
    px = T.read(folder / f"{name}_diffuse.png")
    ao = T.read(folder / f"{name}_ao.png")[..., 0]
    size = px.shape[0]
    rgb = px[..., :3]
    masks = island_masks(obj, size)
    shirt, jeans = masks["shirt"], masks["jeans"]
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722])

    # Anything on the shirt far from the fabric's own blue (the print, the orange stripes, the
    # dark rib) is filled in from the fabric round it, then given back the knit's fine grain.
    fabric = np.median(rgb[shirt], axis=0)
    odd = shirt & (np.linalg.norm(rgb - fabric, axis=2) > 0.16)
    odd = shirt & (_blur(odd.astype(float), 2.5) > 0.05)
    rib = odd & (rgb[..., 2] - rgb[..., 0] > 0.3) & (lum < np.median(lum[shirt]) * 0.85)
    known = (shirt & ~odd).astype(float)
    filled = lum * known
    weight = known.copy()
    for sigma in (3, 6, 12, 24, 48):
        num, den = _blur(filled, sigma), _blur(weight, sigma)
        take = odd & (weight < 0.5) & (den > 1e-3)
        filled = np.where(take, num / np.maximum(den, 1e-6), filled)
        weight = np.where(take, 1.0, weight)
    grain = lum - _blur(lum, 4)
    filled = np.where(odd, filled + np.roll(grain, (37, 53), axis=(0, 1)) * np.roll(known, (37, 53), axis=(0, 1)), filled)
    shade = filled / max(np.median(filled[shirt & ~odd]), 1e-3)
    charcoal = np.array([0.215, 0.215, 0.228])
    sweat = charcoal * np.clip(shade, 0.2, 2.0)[..., None] ** 1.1
    sweat = np.where(rib[..., None], sweat * 0.78, sweat)

    # Jeans: a darker, deeper indigo wash; the fades and whiskers stay.
    dark = np.clip(rgb, 0, 1) ** 1.3 * np.array([0.78, 0.84, 0.98])

    out = np.where(shirt[..., None], sweat, np.where(jeans[..., None], dark, rgb))
    out = out * (0.35 + 0.65 * np.clip(ao, 0, 1))[..., None]
    color = T.write(np.dstack([np.clip(out, 0, 1), np.ones((size, size))]), OUT_TEXTURES / "clothes_color.png", fmt="PNG")
    normal = T.write(T.resized(T.read(folder / f"{name}_normal.png"), 2048), OUT_TEXTURES / "clothes_normal.png", fmt="PNG")
    return color, normal


def brown_eyes(folder):
    """MakeHuman's brown iris is nearly maroon: the same iris, a dark warm brown."""
    px = T.read(folder / "brown_eye.png")
    rgb = px[..., :3]
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722])
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    iris = np.clip((sat - 0.12) / 0.15, 0, 1)[..., None]
    brown = lum[..., None] * np.array([1.05, 0.72, 0.48]) * 0.8
    out = rgb * (1 - iris) + brown * iris
    return T.write(np.dstack([np.clip(out, 0, 1), np.ones(lum.shape)]), OUT_TEXTURES / "eyes_color.png", fmt="PNG")


# ---------------------------------------------------------------------------
# Materials: Principled BSDF fed straight by images, which is what the glTF exporter reads.


def load_image(path, colorspace):
    img = bpy.data.images.load(str(path), check_existing=True)
    img.colorspace_settings.name = colorspace
    return img


def image_material(name, color, roughness, normal=None, alpha_clip=None, double_sided=False):
    mat = bpy.data.materials.new(name)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Roughness"].default_value = roughness
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = load_image(color, "sRGB")
    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if alpha_clip is not None:
        # Alpha rounded off: the exporter writes it as alphaMode MASK.
        cut = nodes.new("ShaderNodeMath")
        cut.operation = "GREATER_THAN"
        cut.inputs[1].default_value = alpha_clip
        links.new(tex.outputs["Alpha"], cut.inputs[0])
        links.new(cut.outputs["Value"], bsdf.inputs["Alpha"])
        mat.surface_render_method = "DITHERED"
    if normal is not None:
        ntex = nodes.new("ShaderNodeTexImage")
        ntex.image = load_image(normal, "Non-Color")
        nmap = nodes.new("ShaderNodeNormalMap")
        links.new(ntex.outputs["Color"], nmap.inputs["Color"])
        links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    mat.use_backface_culling = not double_sided
    return mat


def dress(parts, data):
    """Plain materials on every part; the clothes dyed."""
    clothes_color, clothes_normal = dyed_clothes(parts["Clothes"], data / "clothes" / "male_casualsuit02")
    skin = next(data.glob(f"skins/{SKIN}/*.png"))
    mats = {
        "Body": image_material("Skin", skin, 0.52),
        "Eyes": image_material("Eyes", brown_eyes(data / "eyes" / "materials"), 0.12),
        "Brows": image_material("Brows", data / "eyebrows" / "eyebrow001" / "eyebrow001.png", 0.6, alpha_clip=0.35, double_sided=True),
        "Lashes": image_material("Lashes", data / "eyelashes" / "eyelashes01" / "eyelashes01.png", 0.6, alpha_clip=0.35, double_sided=True),
        "Hair": image_material("Hair", data / "hair" / "short01" / "short01_diffuse.png", 0.55, alpha_clip=0.4, double_sided=True),
        "Clothes": image_material("Clothes", clothes_color, 0.88, normal=clothes_normal),
        "Shoes": image_material("Shoes", data / "clothes" / "shoes05" / "shoes05_diffuse.png", 0.7),
    }
    for key, mat in mats.items():
        me = parts[key].data
        me.materials.clear()
        me.materials.append(mat)
    return mats


# ---------------------------------------------------------------------------
# Made here: the hood lying round the neck, its drawstrings, the headphones and their cable.

# Surface radius over element radius for one ball at stiffness 2, threshold 0.6.
K = 0.575
UPSCALE = 10.0


class Blob:
    """A soft form from metaballs (three.js coordinates), remeshed into even quads."""

    def __init__(self, name, coll, resolution=0.006):
        self.name = name
        self.mb = bpy.data.metaballs.new(name)
        self.mb.resolution = self.mb.render_resolution = resolution
        self.mb.threshold = 0.6
        self.obj = bpy.data.objects.new(name + "_Blob", self.mb)
        coll.objects.link(self.obj)

    def ball(self, center, radius):
        e = self.mb.elements.new(type="BALL")
        e.co = V(*center)
        e.radius = radius / K
        e.stiffness = 2.0

    def ellipsoid(self, center, radii):
        big = max(radii)
        e = self.mb.elements.new(type="ELLIPSOID")
        e.co = V(*center)
        e.radius = big / K
        e.stiffness = 2.0
        # three.js (x, y, z) semi-axes -> Blender (x, -z, y)
        e.size_x, e.size_y, e.size_z = radii[0] / big, radii[2] / big, radii[1] / big

    def to_mesh(self, voxel, faces, coll):
        """Polygonise, smooth the seams with a voxel remesh, then even quads (QuadriFlow).

        QuadriFlow rejects small closed surfaces as not manifold, so it works on a copy ten
        times the size."""
        depsgraph = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(self.obj.evaluated_get(depsgraph))
        bpy.data.objects.remove(self.obj)
        obj = bpy.data.objects.new(self.name, me)
        coll.objects.link(obj)
        bpy.context.view_layer.update()
        C.select_only([obj])
        me.transform(Matrix.Scale(UPSCALE, 4))
        remesh = obj.modifiers.new("Voxel", "REMESH")
        remesh.mode = "VOXEL"
        remesh.voxel_size = voxel * UPSCALE
        bpy.ops.object.modifier_apply(modifier=remesh.name)
        if bpy.ops.object.quadriflow_remesh(target_faces=faces, use_mesh_symmetry=True, seed=7) != {"FINISHED"}:
            raise RuntimeError(f"quadriflow failed on {self.name}")
        obj.data.transform(Matrix.Scale(1 / UPSCALE, 4))
        obj.data.shade_smooth()
        return obj


def measure(rig, parts):
    """Where the made-here parts attach, read off the MakeHuman figure (three.js metres)."""
    bones = rig.data.bones
    neck = three(bones["neck_01"].head_local)
    head = three(bones["head"].head_local)

    def points(obj):
        return [three(obj.matrix_world @ v.co) for v in obj.data.vertices]

    body, shirt, hair = points(parts["Body"]), points(parts["Clothes"]), points(parts["Hair"])
    ears = [p for p in body if head.y + 0.03 < p.y < head.y + 0.12 and abs(p.z - head.z) < 0.05]
    back = [p for p in shirt if abs(p.x) < 0.04 and neck.y - 0.12 < p.y < neck.y - 0.06]
    front = [p for p in shirt if abs(p.x) < 0.06 and neck.y - 0.2 < p.y < neck.y - 0.1]
    return {
        "neck": neck,
        "head": head,
        "ear_x": max(abs(p.x) for p in ears),
        "ear_y": head.y + 0.075,
        "ear_z": sum(p.z for p in ears) / len(ears),
        # The crown, not the odd stray strand above it.
        "hair_top": sorted(p.y for p in hair if abs(p.x) < 0.04)[-12],
        "back_z": min(p.z for p in back),
        "front_z": max(p.z for p in front),
    }


def hood(at, mat, coll):
    """A hood lying down: a soft roll round the back of the neck, its fabric piled on the shoulders."""
    n = at["neck"]
    b = Blob("Hood", coll)
    for k in range(15):
        a = math.radians(-135 + k * 270 / 14)
        b.ball((0.088 * math.sin(a), n.y + 0.028 + 0.012 * math.cos(a), n.z - 0.012 - 0.082 * math.cos(a)), 0.03 + 0.012 * math.cos(a))
    b.ellipsoid((0, n.y - 0.03, at["back_z"] - 0.028), (0.12, 0.075, 0.032))
    obj = b.to_mesh(0.006, 520, coll)
    obj.data.materials.append(mat)
    # Projected from behind onto a plain stretch of the dyed back panel.
    layer = obj.data.uv_layers.new(name="UVMap")
    for loop in obj.data.loops:
        p = three(obj.data.vertices[loop.vertex_index].co)
        layer.data[loop.index].uv = (0.06 + (p.x + 0.15) / 0.3 * 0.2, 0.66 + (p.y - n.y + 0.15) / 0.25 * 0.2)
    return obj


def drawstrings(at, mats, coll):
    n = at["neck"]
    bm = C.new_bmesh()
    for s in (1, -1):
        top = (s * 0.03, n.y + 0.02, n.z + 0.072)
        mid = (s * 0.033, n.y - 0.06, at["front_z"] + 0.006)
        end = (s * 0.036, n.y - 0.15, at["front_z"] + 0.012)
        C.tube(bm, [top, mid, end], 0.0032, sides=6, material=0)
        C.tube(bm, [end, (s * 0.037, n.y - 0.17, at["front_z"] + 0.012)], 0.004, sides=6, material=1)
    return C.finish("Drawstrings", bm, mats, coll, smooth_angle=60)


def headphones(at, mats, coll):
    """Over-ear studio headphones on the hair, and the coiled cable from the left cup into the collar."""
    x, y, z = at["ear_x"] + 0.004, at["ear_y"], at["ear_z"]
    r, depth = 0.046, 0.032
    top = at["hair_top"] + 0.006
    bm = C.new_bmesh()
    for s in (1, -1):
        C.cylinder(bm, r, depth, (s * (x + depth / 2), y, z), segments=22, rot=(0, 0, math.pi / 2), bevel=0.007, material=0)
        ring = [(s * (x - 0.004), y + 0.035 * math.cos(2 * math.pi * k / 18), z + 0.035 * math.sin(2 * math.pi * k / 18)) for k in range(19)]
        C.tube(bm, ring, 0.012, sides=8, caps=False, material=2)
        # A steel yoke over the cup, where the band meets it.
        C.tube(bm, [(s * (x + depth / 2), y + r * 0.55, z - r * 0.8), (s * (x + depth / 2), y + r * 1.05, z), (s * (x + depth / 2), y + r * 0.55, z + r * 0.8)], 0.0032, sides=6, material=1)
    reach = x + depth / 2
    # Half an ellipse over the head from cup to cup; its ends disappear into the cups.
    band = [(reach * math.sin(t), y + (top - y) * math.cos(t), z - 0.004) for t in np.linspace(-math.pi / 2, math.pi / 2, 29)]
    C.tube(bm, band, 0.0105, sides=8, material=0)
    n = at["neck"]
    path = [Vector(p) for p in ((x + depth / 2, y - r, z), (x * 0.9, y - r - 0.06, z + 0.03), (x * 0.7, n.y + 0.03, n.z + 0.06), (0.05, n.y - 0.02, at["front_z"] + 0.004))]
    coil = []
    steps = 140
    for i in range(steps + 1):
        u = i / steps * (len(path) - 1)
        k = min(int(u), len(path) - 2)
        p = path[k] + (path[k + 1] - path[k]) * (u - k)
        t = (path[k + 1] - path[k]).normalized()
        a = t.cross(Vector((1, 0, 0))).normalized()
        phase = i * 2 * math.pi / 7
        coil.append(tuple(p + 0.0062 * (math.cos(phase) * a + math.sin(phase) * t.cross(a))))
    C.tube(bm, coil, 0.0021, sides=5, material=0)
    return C.finish("Headphones", bm, [mats["plastic"], mats["metal"], mats["pad"]], coll, smooth_angle=50)


def kit_materials():
    black = T.ambientcg("Plastic012B")
    leather = T.ambientcg("Leather032")
    return {
        "plastic": C.material("HeadphonePlastic", (0.018, 0.018, 0.02), 0.42, textures=black, tile=0.2),
        "metal": C.material("HeadphoneMetal", (0.14, 0.14, 0.15), 0.35, metallic=1.0),
        "pad": C.material("HeadphonePad", (0.02, 0.02, 0.022), 0.6, textures={k: v for k, v in leather.items() if k != "color"}, tile=0.1),
        "cord": C.material("Cord", (0.62, 0.6, 0.55), 0.9),
    }


def rig_rigid(obj, rig, groups):
    """Parents a made-here part to the rig; `groups(three_position)` -> {bone: weight}."""
    obj.parent = rig
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    for v in obj.data.vertices:
        for bone, w in groups(three(v.co)).items():
            if w <= 0:
                continue
            group = obj.vertex_groups.get(bone) or obj.vertex_groups.new(name=bone)
            group.add([v.index], w, "REPLACE")


def add_kit(at, rig, parts, mats, coll):
    kit = kit_materials()

    def chest(_):
        return {"spine_03": 1.0}

    parts["Hood"] = hood(at, mats["Clothes"], coll)
    rig_rigid(parts["Hood"], rig, chest)
    parts["Drawstrings"] = drawstrings(at, [kit["cord"], kit["metal"]], coll)
    rig_rigid(parts["Drawstrings"], rig, chest)
    parts["Headphones"] = headphones(at, kit, coll)
    neck_y = at["neck"].y

    def cable(p):
        # Rigid on the head; the cable hands over to the chest on its way into the collar.
        k = min(1.0, max(0.0, (at["ear_y"] - 0.05 - p.y) / max(at["ear_y"] - 0.05 - neck_y, 1e-3)))
        return {"head": 1 - k, "spine_03": k}

    rig_rigid(parts["Headphones"], rig, cable)
    for key in ("Drawstrings", "Headphones"):
        C.box_uv(parts[key], only_unset=True)


# ---------------------------------------------------------------------------
# Poses. A pose says where bones point (three.js directions, or a lean in degrees from the rest
# pose), where the pelvis is, what the arms and legs reach for, which way the palms face and how
# far the fingers curl; the solver turns that into rotations, parents first.

SIDES = (("L", "l", 1), ("R", "r", -1))
FINGERS = ("index", "middle", "ring", "pinky")
# Degrees per finger joint at full curl.
CURL = (32, 58, 36)
FPS = 24


def palm_rest(rig, side):
    """The rest palm normal: the way the slightly bent fingers of the rest pose curl."""
    bones = rig.data.bones
    total = Vector()
    for f in FINGERS:
        a = (bones[f"{f}_01_{side}"].tail_local - bones[f"{f}_01_{side}"].head_local).normalized()
        b = (bones[f"{f}_03_{side}"].tail_local - bones[f"{f}_02_{side}"].head_local).normalized()
        total += b - a * b.dot(a)
    return total.normalized()


def _two_bone(a, target, l1, l2, pole):
    d = target - a
    dist = min(max(d.length, 1e-4), l1 + l2 - 1e-4)
    dn = d.normalized()
    cos_a = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)
    sin_a = math.sqrt(max(0.0, 1 - cos_a * cos_a))
    bend = (pole - dn * pole.dot(dn)).normalized()
    knee = a + dn * (l1 * cos_a) + bend * (l1 * sin_a)
    return (knee - a).normalized(), (a + dn * dist - knee).normalized()


def lean(pitch, yaw=0.0):
    """Leaning forward `pitch` degrees and turning `yaw` degrees to the left, from the rest pose."""
    return ("lean", pitch, yaw)


class Poser:
    def __init__(self, rig):
        self.rig = rig
        self.order = [b.name for b in rig.data.bones]  # Blender lists parents before children
        self.length = {b.name: b.length for b in rig.data.bones}
        self.palm = {s: palm_rest(rig, s) for _, s, _ in SIDES}
        self.child = {}
        for b in rig.data.bones:
            if b.parent:
                self.child.setdefault(b.parent.name, b.name)

    def apply(self, spec):
        bones = self.rig.pose.bones
        for pb in bones:
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = Quaternion()
            pb.location = Vector()
        bpy.context.view_layer.update()
        want = {name: value for name, value in spec.items() if name in self.length}
        ik = {first: (V(*t), V(*p)) for first, (t, p) in spec.get("ik", {}).items()}
        palms = {f"lowerarm_{s}": V(*n) for s, n in spec.get("palm", {}).items()}
        curl = spec.get("curl", {})
        twists = {}
        for name in self.order:
            pb = bones[name]
            m = pb.matrix.copy()
            rest = self.rig.data.bones[name].matrix_local.to_3x3()
            if name == "pelvis" and "hips" in spec:
                m.translation = V(*spec["hips"])
            direction = None
            if name in ik:
                target, pole = ik.pop(name)
                second = self.child[name]
                direction, want[second] = _two_bone(m.translation, target, self.length[name], self.length[second], pole)
            elif isinstance(want.get(name), tuple) and want[name][0] == "lean":
                _, pitch, yaw = want[name]
                # Forward is Blender -Y: a turn about +X tips an upright bone toward it.
                direction = Matrix.Rotation(math.radians(pitch), 3, "X") @ rest.col[1].normalized()
                if yaw:
                    twists[name] = math.radians(yaw)
            elif name in want:
                direction = want[name] if isinstance(want[name], Vector) else V(*want[name])
            bend = self._finger(name, curl)
            if bend is not None:
                direction = bend(m)
            r = m.to_3x3()
            if direction is not None:
                r = r.col[1].normalized().rotation_difference(direction.normalized()).to_matrix() @ r
            if name in twists:
                # Turning the head: a twist about the bone itself (+ is to the left).
                r = Matrix.Rotation(twists[name], 3, r.col[1].normalized()) @ r
            if name in palms:
                # Turn the forearm about itself until the palm faces the way asked.
                axis = r.col[1].normalized()
                palm = r @ rest.inverted() @ self.palm[name[-1]]
                goal = palms[name]
                palm = (palm - axis * palm.dot(axis)).normalized()
                goal = (goal - axis * goal.dot(axis)).normalized()
                r = palm.rotation_difference(goal).to_matrix() @ r
            pb.matrix = Matrix.Translation(m.translation) @ r.to_4x4()
            bpy.context.view_layer.update()

    def _finger(self, name, curl):
        """For a finger bone: a function giving its direction, bent toward the posed palm."""
        parts = name.split("_")
        if len(parts) != 3 or parts[0] not in (*FINGERS, "thumb"):
            return None
        side = parts[2]
        amount = curl.get(side.upper(), 0.0) * (0.5 if parts[0] == "thumb" else 1.0)
        if not amount:
            return None
        joint = int(parts[1]) - 1

        def bent(m):
            hand = self.rig.pose.bones[f"hand_{side}"].matrix.to_3x3() @ self.rig.data.bones[f"hand_{side}"].matrix_local.to_3x3().inverted()
            palm = hand @ self.palm[side]
            base = m.to_3x3().col[1].normalized()
            p = (palm - base * palm.dot(base)).normalized()
            angle = math.radians(CURL[joint] * amount)
            return base * math.cos(angle) + p * math.sin(angle)

        return bent


def wave(phase, offset=0.0):
    return math.sin(2 * math.pi * phase + offset)


def stand(phase=0.0, at=(0.0, 0.0)):
    b = wave(phase)
    x0, z0 = at
    spec = {
        "hips": (x0, 0.859 + 0.003 * b, z0),
        "spine_01": lean(0.5 * b),
        "spine_02": lean(0.5 * b),
        "spine_03": lean(-1 - 1.5 * b),
        "neck_01": lean(2),
        "head": lean(0, 2 * wave(phase, 1.0)),
        "ik": {},
        "palm": {"L": (-1, 0, 0.15), "R": (1, 0, 0.15)},
        "curl": {"L": 0.3, "R": 0.3},
    }
    for _, s, x in SIDES:
        spec[f"upperarm_{s}"] = (x * 0.18, -1, -0.02)
        spec[f"lowerarm_{s}"] = (x * 0.1, -1, 0.15)
        spec[f"hand_{s}"] = (x * 0.05, -1, 0.12)
        spec["ik"][f"thigh_{s}"] = ((x0 + x * 0.13, 0.066, z0), (0, 0, 1))
        spec[f"foot_{s}"] = (x * 0.03, -0.46, 0.89)
        spec[f"ball_{s}"] = (0, 0.06, 1)
    return spec


def sit_type(phase=0.0):
    """At the desk, leaning in to the screen, typing. The model's origin is the chair's."""
    spec = {
        "hips": (0, 0.585, -0.07),
        "pelvis": lean(-12),
        "spine_01": lean(5),
        "spine_02": lean(10),
        "spine_03": lean(16 + wave(phase)),
        "neck_01": lean(22),
        "head": lean(8 + 2.5 * wave(phase * 3, 1.3), 1.5 * wave(phase * 2, 0.4)),
        "ik": {},
        "palm": {"L": (0, -1, 0.1), "R": (0, -1, 0.1)},
        "curl": {},
    }
    for n, s, x in SIDES:
        seed = 0.0 if x > 0 else 2.1
        # Fingers on the keys: each hand dips on its own uneven rhythm.
        tap = 0.008 * max(0.0, wave(phase * 6, seed)) + 0.005 * max(0.0, wave(phase * 11, seed * 1.7))
        spec[f"clavicle_{s}"] = (x, -0.05, 0.12)
        spec["ik"][f"upperarm_{s}"] = ((x * 0.13, 0.81 - tap, 0.4), (x, -1, -0.35))
        spec[f"hand_{s}"] = (-x * 0.12, -0.25 - 2 * tap, 1)
        spec["curl"][n] = 0.45 + 12 * tap
        spec["ik"][f"thigh_{s}"] = ((x * 0.14, 0.07, 0.42), (0, 0.3, 1))
        spec[f"foot_{s}"] = (x * 0.05, -0.4, 0.9)
    return spec


def falling(phase=0.0):
    """Falling backwards through the floor, reaching for the hole above (the web lays it on its back)."""
    spec = {
        "hips": (0, 0.859, 0),
        "pelvis": lean(-15),
        "spine_01": lean(-10),
        "spine_02": lean(-5),
        "spine_03": lean(5),
        "neck_01": lean(25),
        "head": lean(30),
        "curl": {"L": 0.15, "R": 0.15},
    }
    for _, s, x in SIDES:
        off = 0.0 if x > 0 else 2.4
        spec[f"upperarm_{s}"] = (x * (0.75 + 0.15 * wave(phase, off)), 0.35 + 0.3 * wave(phase, off + 1), 0.55)
        spec[f"lowerarm_{s}"] = (x * 0.35, 0.55 + 0.25 * wave(phase, off + 2), 0.75)
        spec[f"hand_{s}"] = (x * 0.25, 0.4, 0.9)
        spec[f"thigh_{s}"] = (x * 0.15, -0.45 + 0.18 * wave(phase, off + 3), 0.85)
        spec[f"calf_{s}"] = (x * 0.05, -1, 0.25 + 0.25 * wave(phase, off + 4))
        spec[f"foot_{s}"] = (x * 0.1, -0.3, 1)
    return spec


def sit_hunched(phase=0.0):
    """On a dead TV in the water, elbows on the knees, head hanging over clasped hands."""
    b = wave(phase)
    spec = {
        "hips": (0, 0.545, -0.02),
        "pelvis": lean(10),
        "spine_01": lean(25),
        "spine_02": lean(35),
        "spine_03": lean(45 + 2 * b),
        "neck_01": lean(55),
        "head": lean(75, 2 * wave(phase, 2.0)),
        "ik": {},
        "palm": {"L": (-1, 0, 0.3), "R": (1, 0, 0.3)},
        "curl": {"L": 0.7, "R": 0.7},
    }
    for _, s, x in SIDES:
        spec["ik"][f"upperarm_{s}"] = ((x * 0.04, 0.47 + 0.006 * b, 0.38), (x, -0.4, 0.3))
        spec[f"hand_{s}"] = (-x * 0.6, -0.5, 0.6)
        spec["ik"][f"thigh_{s}"] = ((x * 0.16, 0.07, 0.4), (0, 0.5, 1))
        spec[f"foot_{s}"] = (x * 0.08, -0.35, 0.9)
    return spec


def rising(k):
    """Halfway poses of getting up off the seat: k 0.4 weight over the feet, 0.75 nearly up."""
    if k < 0.6:
        spec = {
            "hips": (0, 0.6, 0.1),
            "pelvis": lean(25),
            "spine_01": lean(40),
            "spine_02": lean(45),
            "spine_03": lean(50),
            "neck_01": lean(40),
            "head": lean(25),
            "ik": {},
            "curl": {"L": 0.4, "R": 0.4},
        }
        for _, s, x in SIDES:
            spec["ik"][f"upperarm_{s}"] = ((x * 0.17, 0.55, 0.42), (x, 0.0, -0.5))
            spec[f"hand_{s}"] = (0, -1, 0.3)
            spec["ik"][f"thigh_{s}"] = ((x * 0.16, 0.07, 0.4), (0, 0.5, 1))
            spec[f"foot_{s}"] = (x * 0.08, -0.35, 0.9)
        return spec
    spec = {
        "hips": (0, 0.78, 0.28),
        "pelvis": lean(10),
        "spine_01": lean(15),
        "spine_02": lean(15),
        "spine_03": lean(12),
        "neck_01": lean(10),
        "head": lean(5),
        "ik": {},
        "curl": {"L": 0.25, "R": 0.25},
    }
    for _, s, x in SIDES:
        spec[f"upperarm_{s}"] = (x * 0.2, -1, 0.15)
        spec[f"lowerarm_{s}"] = (x * 0.1, -1, 0.3)
        spec[f"hand_{s}"] = (x * 0.06, -1, 0.2)
        spec["ik"][f"thigh_{s}"] = ((x * 0.15, 0.068, 0.4), (0, 0.3, 1))
        spec[f"foot_{s}"] = (x * 0.05, -0.45, 0.89)
    return spec


# name: (seconds, [(time 0..1, pose)])
ACTIONS = {
    "Stand": (4.0, [(k / 8, lambda k=k: stand(k / 8)) for k in range(9)]),
    "SitType": (4.0, [(k / 32, lambda k=k: sit_type(k / 32)) for k in range(33)]),
    "Fall": (3.0, [(k / 12, lambda k=k: falling(k / 12)) for k in range(13)]),
    "SitHunched": (5.0, [(k / 8, lambda k=k: sit_hunched(k / 8)) for k in range(9)]),
    # Not a loop: the web scrubs it with the scroll, from the seat to standing over the feet.
    "StandUp": (2.0, [(0.0, sit_hunched), (0.4, lambda: rising(0.4)), (0.75, lambda: rising(0.75)), (1.0, lambda: stand(0.0, at=(0.0, 0.4)))]),
}


def bake_actions(rig):
    poser = Poser(rig)
    rig.animation_data_create()
    for name, (seconds, keys) in ACTIONS.items():
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        rig.animation_data.action = action
        last = {}
        for t, make in keys:
            frame = round(t * seconds * FPS)
            poser.apply(make())
            for pb in rig.pose.bones:
                q = pb.rotation_quaternion.copy()
                # Keep neighbouring keys on the same side of the sphere, or the slerp goes the long way.
                if pb.name in last and last[pb.name].dot(q) < 0:
                    q.negate()
                pb.rotation_quaternion = q
                last[pb.name] = q
                pb.keyframe_insert("rotation_quaternion", frame=frame)
            rig.pose.bones["pelvis"].keyframe_insert("location", frame=frame)
        action.use_frame_range = True
        action.frame_start, action.frame_end = 0, round(seconds * FPS)
    rig.animation_data.action = None
    for pb in rig.pose.bones:
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()


# ---------------------------------------------------------------------------
# Export


def export(rig, parts):
    C.select_only([rig, *parts.values()], active=rig)
    out = C.PUBLIC_MODELS / "character.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(out),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_extras=False,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_image_format="WEBP",
        export_image_quality=90,
        export_yup=True,
        export_skins=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_frame_step=1,
    )
    print("exported:", out, f"{out.stat().st_size / 1e6:.1f} MB")


def main():
    C.reset_scene()
    coll = C.collection(COLL)
    _, rig, parts, data = make_human(coll)
    mats = dress(parts, data)
    add_kit(measure(rig, parts), rig, parts, mats, coll)
    bake_actions(rig)
    triangles = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in parts.values())
    print("character:", triangles, "triangles in", len(parts), "parts")
    C.save_blend(C.SOURCE / "character.blend")
    export(rig, parts)


if __name__ == "__main__":
    main()
