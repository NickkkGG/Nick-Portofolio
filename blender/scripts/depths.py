"""Builds depths.glb: the flooded floor under the pillar and everything in the last chapters.

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/scripts/depths.py

The floor, its debris and the sunken CRTs sit where the web has them (floor y = -180).
The pieces the web moves around are modelled at the origin, true size, and named so the
web can find them: the bulb (spec §3.7), ten problem objects, one keycap (§3.8) and one
VHS cassette with its sleeve (§3.9).
"""

import math
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import common as C  # noqa: E402
import crt_model  # noqa: E402
import textures as T  # noqa: E402
from common import V  # noqa: E402

FLOOR_Y = -180.0
COLL = "Depths"


def materials():
    ph, acg = T.polyhaven, T.ambientcg
    floor = ph("concrete_floor_worn_001")
    plastic = acg("Plastic018B")
    black = acg("Plastic012B")
    cardboard = acg("Cardboard003")
    m = {}
    m["floor"] = C.material("DepthsFloor", (0.3, 0.3, 0.29), 0.5, textures=floor, tile=3.0, props={"runtime": "reflector"})
    m["concrete"] = C.material("Concrete", (0.36, 0.35, 0.33), 0.85, textures=floor, tile=1.2)
    m["concrete_inner"] = C.material(
        "ConcreteInner", (0.5, 0.48, 0.44), 0.95, textures=T.with_color(floor, T.tinted(floor["color"], "concrete_inner", (1.15, 1.1, 1.02), add=(0.05, 0.05, 0.04))), tile=0.6
    )
    m["rebar"] = C.material("Rebar", (0.25, 0.14, 0.08), 0.6, metallic=1.0)
    m["beige"] = C.material("CrtBeige", (0.62, 0.57, 0.45), 0.45, textures=T.with_color(plastic, T.tinted(plastic.get("color"), "plastic_beige", (0.98, 0.88, 0.66))), tile=0.5)
    m["black"] = C.material("PlasticBlack", (0.025, 0.025, 0.027), 0.5, textures=black, tile=0.4)
    m["screen"] = C.material("SunkenScreen", (0.02, 0.03, 0.03), 0.15, props={"runtime": "tower-screen"})
    m["bakelite"] = C.material("Bakelite", (0.03, 0.025, 0.02), 0.35)
    m["brass"] = C.material("Brass", (0.75, 0.6, 0.35), 0.35, metallic=1.0)
    m["bulb"] = C.material("BulbGlass", (0.95, 0.85, 0.7), 0.05, props={"runtime": "bulb"})
    m["filament"] = C.material("Filament", (1.0, 0.6, 0.3), 0.5, props={"runtime": "filament"})
    m["cord"] = C.material("Cord", (0.02, 0.02, 0.02), 0.5, textures=black, tile=0.3)
    m["problem_frame"] = C.material("ProblemFrame", (0.06, 0.06, 0.065), 0.4, textures=black, tile=0.3)
    m["problem_bar"] = C.material("ProblemBar", (0.55, 0.04, 0.03), 0.3, props={"runtime": "problem-glow"})
    m["problem_screen"] = C.material("ProblemScreen", (0.1, 0.0, 0.0), 0.2, props={"runtime": "problem-screen"})
    m["sign_red"] = C.material("SignRed", (0.6, 0.05, 0.04), 0.35, textures=T.with_color(plastic, T.tinted(plastic.get("color"), "sign_red", (1.1, 0.12, 0.1), size=1024)), tile=0.4, props={"runtime": "problem-glow"})
    m["sign_white"] = C.material("SignWhite", (0.85, 0.82, 0.75), 0.4, textures=T.with_color(plastic, T.tinted(plastic.get("color"), "sign_white", (1.05, 1.02, 0.95), size=1024)), tile=0.4)
    m["shard"] = C.material("Shard", (0.5, 0.03, 0.03), 0.15, props={"runtime": "problem-glow"})
    m["keycap"] = C.material("Keycap", (0.82, 0.78, 0.68), 0.55, textures=T.with_color(plastic, T.tinted(plastic.get("color"), "plastic_keycap_cream", (1.04, 0.98, 0.86), size=1024)), tile=0.02)
    m["keycap_top"] = C.material("KeycapTop", (0.85, 0.8, 0.7), 0.35, props={"runtime": "keycap-legend"})
    m["cassette"] = C.material("CassetteShell", (0.03, 0.03, 0.03), 0.4, textures=black, tile=0.08)
    m["window"] = C.material("CassetteWindow", (0.05, 0.05, 0.05), 0.05, alpha_blend=True, alpha=0.35, props={"runtime": "cassette-window"})
    m["tape"] = C.material("Tape", (0.12, 0.06, 0.03), 0.25)
    m["reel"] = C.material("Reel", (0.85, 0.85, 0.82), 0.4)
    m["label"] = C.material("CassetteLabel", (0.9, 0.88, 0.8), 0.9, props={"runtime": "cassette-label"})
    m["sleeve"] = C.material("CassetteSleeve", (0.45, 0.34, 0.2), 0.85, textures=cardboard, tile=0.15)
    return m


def make(name, fn, mats, props=None, smooth=40, uv=True):
    bm = C.new_bmesh()
    fn(bm)
    obj = C.finish(name, bm, mats, C.collection(COLL), smooth_angle=smooth, props=props)
    if uv:
        C.box_uv(obj, only_unset=True)
    return obj


# ---------------------------------------------------------------------------
# The flooded floor


def chunk(bm, rng, center, size, sink, material_top=0, material_broken=1, base=FLOOR_Y):
    """A slab of the room's floor broken off: flat top, ragged sides, rebar poking out."""
    pts = []
    for _ in range(14):
        a = rng.random() * 2 * math.pi
        r = size * (0.5 + 0.5 * rng.random())
        pts.append(Vector((r * math.cos(a), r * math.sin(a), (rng.random() - 0.5) * 0.25 * size)))
    pts += [Vector((p.x * 0.9, p.y * 0.9, 0.18 * size)) for p in pts[:6]]
    verts = [bm.verts.new(p) for p in pts]
    hull = bmesh.ops.convex_hull(bm, input=verts)
    for f in [g for g in hull["geom"] if isinstance(g, bmesh.types.BMFace)]:
        f.normal_update()
        # The slab's old top surface stays smooth concrete; every broken face is raw.
        f.material_index = material_top if f.normal.z > 0.9 else material_broken
    leftover = list({v for v in hull.get("geom_interior", []) + hull.get("geom_unused", []) if isinstance(v, bmesh.types.BMVert)})
    if leftover:
        bmesh.ops.delete(bm, geom=leftover, context="VERTS")
    tilt = ((rng.random() - 0.5) * 0.9, rng.random() * 6.28, (rng.random() - 0.5) * 0.9)
    C._place(bm, (center[0], base - sink, center[2]), tilt, None)
    if rng.random() < 0.6:
        x, z = center[0] + (rng.random() - 0.5) * size, center[2] + (rng.random() - 0.5) * size
        C.tube(bm, [(x, base + 0.05, z), (x + 0.2, base + 0.3 + rng.random() * 0.3, z + 0.1), (x + 0.15, base + 0.55, z + 0.3)], 0.012, sides=5, material=2)


def floor_debris(bm, rng):
    placed = 0
    while placed < 22:
        a = rng.random() * 2 * math.pi
        d = 3.5 + rng.random() * 16
        x, z = d * math.sin(a), d * math.cos(a)
        # Keep the camera's side (+Z, in front of the character) clear.
        if z > 1.5 and abs(x) < 4:
            continue
        chunk(bm, rng, (x, 0, z), 0.4 + rng.random() * 1.1, 0.05 + rng.random() * 0.25)
        placed += 1


def sunken_crts(m, rng):
    """Old monitors lying in the water, tipped over, some still glowing. One object each."""
    spots = [(-4.2, -6.5, 1.8), (5.5, -8.0, 2.4), (-9.0, -2.5, 1.5), (8.5, 1.5, 2.0), (-2.0, -12.0, 2.6), (11.0, -11.0, 3.0)]
    bottom = -crt_model.SIZE["h"] / 2 - 0.01
    front = crt_model.SIZE["depth"] / 2
    for i, (x, z, s) in enumerate(spots):

        def build(bm):
            crt_model.casing(bm, 0.0, bottom, front)
            crt_model.bezel(bm, 0.0, bottom, front, material=1)
            crt_model.glass(bm, 0.0, bottom, front, material=2)

        bm = C.new_bmesh()
        build(bm)
        obj = C.finish(f"Depths_Crt_{i}", bm, [m["beige"], m["black"], m["screen"]], C.collection(COLL), smooth_angle=35)
        obj.scale = (s, s, s)
        obj.rotation_euler = C.rotation((rng.random() * 1.2 - 0.2, rng.random() * 6.28, (rng.random() - 0.5) * 1.4)).to_euler()
        obj.location = V(x, FLOOR_Y + 0.22 * s, z)
        bpy.context.view_layer.update()
        C.box_uv(obj, only_unset=True)


# ---------------------------------------------------------------------------
# The bulb: the desk lamp's bare bulb, grown big, on a long cord


def bulb_parts(m):
    s = 3.0
    profile = [(0.012, -0.05), (0.013, -0.04), (0.022, -0.025), (0.03, -0.008), (0.031, 0.006), (0.026, 0.024), (0.014, 0.034), (0.001, 0.037)]
    # Nose down: the profile's +Y points at the floor.
    down = (math.pi, 0.0, 0.0)
    make("Bulb_Glass", lambda bm: C.lathe(bm, [(r * s, y * s) for r, y in profile], (0, 0, 0), segments=32, rot=down, close_top=True), [m["bulb"]], props={"runtime": "bulb"}, smooth=60)

    def filament(bm):
        pts = [(0.03 * s * math.sin(i * 1.3) / 1.5, 0.004 * s + 0.006 * s * math.cos(i * 0.7), 0.0) for i in range(14)]
        C.tube(bm, pts, 0.0012 * s, sides=4)
        for side in (-1, 1):
            C.tube(bm, [(0.003 * s * side, 0.04 * s, 0), (0.02 * s * side, 0.004 * s, 0)], 0.0006 * s, sides=3)

    make("Bulb_Filament", filament, [m["filament"]], props={"runtime": "filament"})

    def socket(bm):
        C.cylinder(bm, 0.013 * s, 0.02 * s, (0, 0.06 * s, 0), segments=20, material=1)
        C.cylinder(bm, 0.019 * s, 0.055 * s, (0, 0.1 * s, 0), segments=24, bevel=0.003 * s)
        C.cylinder(bm, 0.012 * s, 0.02 * s, (0, 0.14 * s, 0), segments=16)

    make("Bulb_Socket", socket, [m["bakelite"], m["brass"]], smooth=50)
    make("Bulb_Cord", lambda bm: C.tube(bm, [(0, 0.15 * s, 0), (0.005, 2.0, 0.003), (0.0, 6.2, 0.0)], 0.006 * s, sides=8, uv_tile=0.3), [m["cord"]], smooth=60)


# ---------------------------------------------------------------------------
# The problems (red) — error windows, warning signs, broken shards


def error_window(bm):
    C.box(bm, (0.5, 0.36, 0.035), (0, 0, 0), bevel=0.012, segments=2)
    C.box(bm, (0.48, 0.05, 0.01), (0, 0.145, 0.018), material=1)
    for k in range(3):
        C.box(bm, (0.026, 0.026, 0.01), (0.2 - k * 0.034, 0.145, 0.024), bevel=0.004, material=0)
    # The screen face: the web draws a glitching red error on it.
    C.polygon(bm, [(-0.23, -0.16, 0.0185), (0.23, -0.16, 0.0185), (0.23, 0.115, 0.0185), (-0.23, 0.115, 0.0185)], material=2)


def warning_sign(bm):
    """A bent metal plate: red rim, white field, a black exclamation mark."""

    def corners(r, drop=0.04):
        # Top, bottom-left, bottom-right: counter-clockwise seen from the front (+Z).
        return [(0.0, r - drop), (-0.866 * r, -0.5 * r - drop), (0.866 * r, -0.5 * r - drop)]

    front = [bm.verts.new(V(x, y, 0.006)) for x, y in corners(0.3)]
    back = [bm.verts.new(V(x, y, -0.006)) for x, y in corners(0.3)]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    for k in range(3):
        bm.faces.new((back[k], back[(k + 1) % 3], front[(k + 1) % 3], front[k]))
    sides = [e for e in bm.edges if e.verts[0] in front + back and e.verts[1] in front + back and ((e.verts[0] in front) != (e.verts[1] in front))]
    bmesh.ops.bevel(bm, geom=sides, offset=0.04, segments=4, profile=0.5, affect="EDGES")
    C._place(bm, (0, 0, 0), (0, 0, 0), 0)
    C.polygon(bm, [(x, y, 0.0068) for x, y in corners(0.22)], material=1)
    C.box(bm, (0.03, 0.12, 0.004), (0, 0.0, 0.009), bevel=0.008, material=2)
    C.box(bm, (0.03, 0.03, 0.004), (0, -0.11, 0.009), bevel=0.012, material=2)


def shard(bm, rng):
    pts = []
    for _ in range(9):
        pts.append(Vector(((rng.random() - 0.5) * 0.5, (rng.random() - 0.5) * 0.4, (rng.random() - 0.5) * 0.06)))
    verts = [bm.verts.new(p) for p in pts]
    hull = bmesh.ops.convex_hull(bm, input=verts)
    leftover = list({v for v in hull.get("geom_interior", []) + hull.get("geom_unused", []) if isinstance(v, bmesh.types.BMVert)})
    if leftover:
        bmesh.ops.delete(bm, geom=leftover, context="VERTS")
    C._place(bm, (0, 0, 0), (0, 0, 0), 0)


def problems(m, rng):
    kinds = ["window", "sign", "shard", "window", "sign", "window", "shard", "sign", "window", "shard"]
    for i, kind in enumerate(kinds):
        if kind == "window":
            make(f"Problem_{i}", error_window, [m["problem_frame"], m["problem_bar"], m["problem_screen"]], props={"problem": i, "kind": kind})
        elif kind == "sign":
            make(f"Problem_{i}", warning_sign, [m["sign_red"], m["sign_white"], m["black"]], props={"problem": i, "kind": kind})
        else:
            make(f"Problem_{i}", lambda bm: shard(bm, rng), [m["shard"]], props={"problem": i, "kind": kind}, smooth=None)


# ---------------------------------------------------------------------------
# One keycap, true size (18 mm): sculpted, dished, a legend face on top


def keycap(bm):
    uv = bm.loops.layers.uv.get("UVMap") or bm.loops.layers.uv.new("UVMap")
    rings = []
    levels = [(0.0, 0.018, 0.018, 0.0), (0.003, 0.0172, 0.0174, 0.0002), (0.007, 0.0155, 0.016, 0.0006), (0.0105, 0.0128, 0.0138, 0.001)]
    for y, w, d, back in levels:
        outline = C.rounded_outline(w, w, d, 0.0016, 0.0016, steps=3)
        rings.append([bm.verts.new(V(x, y, -yy - back)) for x, yy in outline])
    for r0, r1 in zip(rings, rings[1:]):
        n = len(r0)
        for k in range(n):
            bm.faces.new((r0[k], r0[(k + 1) % n], r1[(k + 1) % n], r1[k]))
    # Dished top: a fan to a sunken centre, UVs 0..1 across it for the legend.
    top = rings[-1]
    w, d = 0.0128, 0.0138
    centre = bm.verts.new(V(0, 0.0105 - 0.0007, -0.001))
    n = len(top)
    for k in range(n):
        f = bm.faces.new((top[k], top[(k + 1) % n], centre))
        f.material_index = 1
        for loop in f.loops:
            co = loop.vert.co
            loop[uv].uv = (co.x / w + 0.5, (co.y - 0.001) / d + 0.5)
    bm.faces.new(list(reversed(rings[0])))
    C._place(bm, (0, 0, 0), (0, 0, 0), None)


# ---------------------------------------------------------------------------
# A VHS cassette (187 x 103 x 25 mm) and its cardboard sleeve


def cassette(m):
    w, h, t = 0.187, 0.103, 0.025

    def shell(bm):
        C.box(bm, (w, h, t), (0, 0, 0), bevel=0.003, segments=2)
        # Grip ridges along the bottom, screws in the corners.
        for k in range(9):
            C.box(bm, (0.09 / 9 * 0.6, 0.008, 0.002), (-0.045 + k * 0.01125, -h / 2 + 0.012, t / 2 + 0.0008))
        for x, y in [(-0.085, 0.043), (0.085, 0.043), (-0.085, -0.043), (0.085, -0.043), (0.0, -0.043)]:
            C.cylinder(bm, 0.0025, 0.001, (x, y, -t / 2 - 0.0004), segments=10, rot=(math.pi / 2, 0, 0))

    make("Cassette_Shell", shell, [m["cassette"]])
    make("Cassette_Window", lambda bm: C.polygon(bm, [(-0.047, -0.023, t / 2 + 0.0006), (0.047, -0.023, t / 2 + 0.0006), (0.047, 0.004, t / 2 + 0.0006), (-0.047, 0.004, t / 2 + 0.0006)]), [m["window"]], props={"runtime": "cassette-window"})

    def reels(bm):
        # Seen through the window: a dark well, the tape wound on two white hubs.
        C.polygon(bm, [(-0.0465, -0.0225, t / 2 + 0.0001), (0.0465, -0.0225, t / 2 + 0.0001), (0.0465, 0.0035, t / 2 + 0.0001), (-0.0465, 0.0035, t / 2 + 0.0001)], material=2)
        for x, wound in ((-0.03, 0.021), (0.03, 0.012)):
            C.cylinder(bm, wound, 0.0003, (x, -0.0095, t / 2 + 0.0003), segments=40, rot=(math.pi / 2, 0, 0), material=0)
            C.cylinder(bm, 0.008, 0.0004, (x, -0.0095, t / 2 + 0.0004), segments=24, rot=(math.pi / 2, 0, 0), material=1)
            for k in range(6):
                a = k * math.pi / 3
                C.box(bm, (0.0012, 0.004, 0.0002), (x + 0.004 * math.cos(a), -0.0095 + 0.004 * math.sin(a), t / 2 + 0.0005), rot=(0, 0, a), material=2)

    make("Cassette_Reels", reels, [m["tape"], m["reel"], m["cassette"]], smooth=50)
    label = make("Cassette_Label", lambda bm: C.polygon(bm, [(-0.078, 0.012, t / 2 + 0.0007), (0.078, 0.012, t / 2 + 0.0007), (0.078, 0.046, t / 2 + 0.0007), (-0.078, 0.046, t / 2 + 0.0007)]), [m["label"]], props={"runtime": "cassette-label"}, uv=False)
    unit_uv(label, "CassetteLabel")

    def sleeve(bm):
        # Five faces of thin card, open at the right end, slipped over the tape.
        sw, sh, st, k = w + 0.006, h + 0.006, t + 0.005, 0.0012
        C.box(bm, (sw, sh, k), (0.003, 0, st / 2))
        C.box(bm, (sw, sh, k), (0.003, 0, -st / 2))
        C.box(bm, (sw, k, st), (0.003, sh / 2, 0))
        C.box(bm, (sw, k, st), (0.003, -sh / 2, 0))
        C.box(bm, (k, sh, st), (0.003 - sw / 2, 0, 0))

    make("Cassette_Sleeve", sleeve, [m["sleeve"]])


def fall_chunks(m, rng):
    """Pieces of the room's floor slab, each at the origin: the fall rains copies of them down."""
    for i in range(6):
        size = 0.22 + 0.08 * i
        make(f"Fall_Chunk_{i}", lambda bm: chunk(bm, rng, (0.0, 0.0, 0.0), size, 0.0, base=0.0), [m["concrete"], m["concrete_inner"], m["rebar"]], smooth=None)


def unit_uv(obj, material_name):
    """Faces of one material get the whole 0..1 image (canvas screens and labels)."""
    me = obj.data
    layer = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
    slot = [i for i, mat in enumerate(me.materials) if mat and mat.name == material_name]
    for poly in me.polygons:
        if poly.material_index not in slot:
            continue
        pts = [me.vertices[me.loops[li].vertex_index].co for li in poly.loop_indices]
        xs, zs = [p.x for p in pts], [p.z for p in pts]
        for li, p in zip(poly.loop_indices, pts):
            layer.data[li].uv = ((p.x - min(xs)) / (max(xs) - min(xs)), (p.z - min(zs)) / (max(zs) - min(zs)))


def build():
    C.reset_scene()
    m = materials()
    rng = C.seeded(202)
    make("Depths_Floor", lambda bm: C.polygon(bm, [(-80, FLOOR_Y, 80), (80, FLOOR_Y, 80), (80, FLOOR_Y, -80), (-80, FLOOR_Y, -80)]), [m["floor"]], props={"runtime": "reflector"})
    make("Depths_Debris", lambda bm: floor_debris(bm, rng), [m["concrete"], m["concrete_inner"], m["rebar"]], smooth=None)
    sunken_crts(m, rng)
    bulb_parts(m)
    problems(m, rng)
    make("Keycap", keycap, [m["keycap"], m["keycap_top"]], smooth=45)
    cassette(m)
    fall_chunks(m, rng)
    for obj in C.collection(COLL).objects:
        if obj.name.startswith("Problem_"):
            unit_uv(obj, "ProblemScreen")
    C.save_blend(C.SOURCE / "depths.blend")


def export():
    objs = list(C.collection(COLL).objects)
    C.select_only(objs)
    out = C.PUBLIC_MODELS / "depths.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(out),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_extras=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_image_format="WEBP",
        export_image_quality=85,
        export_yup=True,
    )
    print("exported:", out, f"{out.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    build()
    export()
