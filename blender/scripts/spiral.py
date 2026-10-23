"""Builds the project world (spec §3.6): the cable pillar, the far pillars and the TV towers.

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/scripts/spiral.py

Writes blender/source/spiral.blend. Same coordinates as the web (three.js metres): the
pillar stands on the axis x = z = 0, the project monitors hang at radius 6 between
y = -84 and -156, and the camera circles them at radius 10.5. The pillar hangs above the
depths (floor y = -180) and frays into dangling ends, so it never touches the bulb.
"""

import math
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import bmesh  # noqa: E402
import bpy  # noqa: E402
import numpy as np  # noqa: E402

import bake  # noqa: E402

import common as C  # noqa: E402
import textures as T  # noqa: E402
from common import V  # noqa: E402

PLATFORM_Y = -80.0
FRAY_Y = -158.0
FLOOR_Y = -180.0
WORLD = "Spiral"
CABLE_TILE = 0.35


def materials():
    plastic = T.ambientcg("Plastic012B")
    beige = T.ambientcg("Plastic018B")
    m = {}
    # Wet rubber: the colour map darkened, glossier than dry plastic.
    m["black"] = C.material("CableBlack", (0.02, 0.022, 0.024), 0.35, textures=T.with_color(plastic, T.tinted(plastic.get("color"), "cable_black", (0.55, 0.6, 0.62))), tile=CABLE_TILE)
    m["grey"] = C.material("CableGrey", (0.12, 0.13, 0.13), 0.4, textures=T.with_color(beige, T.tinted(beige.get("color"), "cable_grey", (0.3, 0.32, 0.33), size=1024)), tile=CABLE_TILE)
    m["beige"] = C.material("CableBeige", (0.42, 0.38, 0.3), 0.45, textures=T.with_color(beige, T.tinted(beige.get("color"), "cable_beige", (0.72, 0.64, 0.48), size=1024)), tile=CABLE_TILE)
    m["core"] = C.material("PillarCore", (0.008, 0.01, 0.01), 0.6)
    m["tape"] = C.material("Tape", (0.28, 0.28, 0.27), 0.7, textures=T.with_color(beige, T.tinted(beige.get("color"), "tape_grey", (0.42, 0.42, 0.42), size=1024)), tile=0.2)
    m["plug"] = C.material("Plug", (0.05, 0.05, 0.05), 0.45)
    m["copper"] = C.material("Copper", (0.72, 0.42, 0.25), 0.35, metallic=1.0)
    for i, tone in enumerate([(0.55, 0.5, 0.4), (0.3, 0.3, 0.29), (0.1, 0.1, 0.11)]):
        m[f"tower{i}"] = C.material(
            f"TowerCasing{i}", tone, 0.5, textures=T.with_color(beige, T.tinted(beige.get("color"), f"tower_casing{i}", tone, size=1024)), tile=0.6
        )
    m["tower_screen"] = C.material("TowerScreen", (0.02, 0.03, 0.03), 0.15, props={"runtime": "tower-screen"})
    return m


# ---------------------------------------------------------------------------
# Cables


def pick_material(rng):
    roll = rng.random()
    return 0 if roll < 0.68 else (1 if roll < 0.9 else 2)


def cable_radius(rng):
    roll = rng.random()
    if roll < 0.55:
        return 0.025 + 0.025 * rng.random()
    if roll < 0.9:
        return 0.05 + 0.04 * rng.random()
    return 0.1 + 0.05 * rng.random()


def pillar_radius(y):
    """The bundle's outline: flared under the platform, pinched in places, fraying at the bottom."""
    flare = 0.7 * math.exp(-((y - PLATFORM_Y) / 2.2) ** 2)
    pinch = 0.12 * math.sin(y * 0.07 + 1.3) + 0.06 * math.sin(y * 0.19)
    return 2.0 + flare + pinch


def main_cables(bm, rng, count=130):
    """Cables twisting down the pillar like a rope, a fifth of them against the lay."""
    for _ in range(count):
        a0 = rng.random() * 2 * math.pi
        layer0 = 0.82 + 0.3 * rng.random()  # inner cables sit deeper
        weave = rng.random() * 2 * math.pi
        # Most follow the lay, about one turn per 50 m; the rest cross it, steeper, like a tangle.
        twist = (0.09 + 0.06 * rng.random()) if rng.random() < 0.72 else -(0.12 + 0.12 * rng.random())
        r = cable_radius(rng)
        # Below the fray line each cable comes loose and hangs to its own length.
        end = FRAY_Y - 2 - rng.random() * 10
        drift = rng.random() * 2 * math.pi
        # The top end tucks over the rim and under the coiled nest.
        pts = [((pillar_radius(PLATFORM_Y) * layer0 - 0.6) * math.cos(a0), PLATFORM_Y + 0.02, (pillar_radius(PLATFORM_Y) * layer0 - 0.6) * math.sin(a0))]
        pts.append(((pillar_radius(PLATFORM_Y) * layer0 + 0.05) * math.cos(a0), PLATFORM_Y + 0.12, (pillar_radius(PLATFORM_Y) * layer0 + 0.05) * math.sin(a0)))
        y = PLATFORM_Y - 0.25
        while y > end:
            a = a0 + twist * (PLATFORM_Y - y)
            # Weaving in and out of the bundle as it goes down.
            layer = layer0 + 0.14 * math.sin((PLATFORM_Y - y) * 0.16 + weave)
            rad = pillar_radius(y) * layer
            if y < FRAY_Y:
                # Fraying: the end swings out and droops.
                k = (FRAY_Y - y) / 10
                rad += 1.6 * k * k
                a += 0.4 * k * math.sin(drift)
            pts.append((rad * math.cos(a) + 0.03 * math.sin(y * 1.3 + a0), y, rad * math.sin(a) + 0.03 * math.cos(y * 1.1 + a0)))
            y -= 0.55
        C.tube(bm, pts, r, sides=8 if r > 0.06 else 6, material=pick_material(rng), uv_tile=CABLE_TILE)
        # A plug or a frayed copper tip where it ends.
        tip = pts[-1]
        if rng.random() < 0.5:
            C.box(bm, (r * 3.2, r * 4.5, r * 2.4), (tip[0], tip[1] - r * 2, tip[2]), bevel=r * 0.4, material=4)
        else:
            C.cylinder(bm, r * 0.6, r * 3, (tip[0], tip[1] - r * 1.2, tip[2]), segments=6, material=5)


def loops_off_the_pillar(bm, rng, count=26):
    """Slack cables that bulge out of the bundle and tuck back in further down."""
    for _ in range(count):
        a = rng.random() * 2 * math.pi
        y0 = PLATFORM_Y - 3 - rng.random() * 70
        drop = 2 + rng.random() * 7
        out = 0.6 + rng.random() * 1.8
        r = cable_radius(rng)
        pts = []
        for i in range(25):
            s = i / 24
            y = y0 - drop * s
            rad = pillar_radius(y) + out * math.sin(math.pi * s) + 0.25 * math.sin(math.pi * s) ** 2 * drop / 4
            aa = a + 0.25 * s
            pts.append((rad * math.cos(aa), y - 0.6 * math.sin(math.pi * s) ** 2, rad * math.sin(aa)))
        C.tube(bm, pts, r, sides=6, material=pick_material(rng), uv_tile=CABLE_TILE)


def relics(bm, rng, m):
    """Things from the room, grown into the bundle: keyboards, radios, small TVs, a phone, tapes.

    Each sits half in the cables on the pillar's surface, facing out, with a couple of
    cables wrapped over it. Material indices follow relic_materials().
    """
    kinds = ["keyboard", "tv", "radio", "phone", "tapes", "tv", "keyboard", "radio", "tapes", "tv", "phone", "radio"]
    for i, kind in enumerate(kinds):
        y = PLATFORM_Y - 7 - i * 6.1 - rng.random() * 2.5
        a = rng.random() * 2 * math.pi
        rad = pillar_radius(y) * 1.02
        cx, cz = rad * math.cos(a), rad * math.sin(a)
        yaw = math.atan2(math.cos(a), math.sin(a))  # facing out from the axis
        tilt = ((rng.random() - 0.5) * 0.5, yaw, (rng.random() - 0.5) * 0.6)
        if kind == "keyboard":
            C.box(bm, (0.9, 0.08, 0.36), (cx, y, cz), bevel=0.012, rot=(tilt[0] + 1.3, yaw, tilt[2]), material=0)
            for k in range(14):
                C.box(bm, (0.045, 0.035, 0.045), (cx + 0.06 * (k - 6.5) * math.cos(yaw), y + 0.02, cz - 0.06 * (k - 6.5) * math.sin(yaw)), rot=(tilt[0] + 1.3, yaw, tilt[2]), material=0)
        elif kind == "tv":
            C.box(bm, (0.7, 0.6, 0.55), (cx, y, cz), bevel=0.04, rot=tilt, material=0)
            fx, fz = cx + math.sin(yaw) * 0.28, cz + math.cos(yaw) * 0.28
            C.box(bm, (0.5, 0.38, 0.02), (fx, y + 0.03, fz), bevel=0.02, rot=tilt, material=2)
        elif kind == "radio":
            C.box(bm, (0.8, 0.42, 0.24), (cx, y, cz), bevel=0.04, rot=tilt, material=1)
            for side in (-1, 1):
                gx, gz = cx + math.sin(yaw) * 0.12 + side * 0.22 * math.cos(yaw), cz + math.cos(yaw) * 0.12 - side * 0.22 * math.sin(yaw)
                C.cylinder(bm, 0.13, 0.02, (gx, y - 0.02, gz), segments=20, rot=(math.pi / 2 + tilt[0], yaw, tilt[2]), material=3)
        elif kind == "phone":
            C.box(bm, (0.45, 0.22, 0.4), (cx, y, cz), bevel=0.06, rot=tilt, material=1)
            C.tube(bm, [(cx - 0.18, y + 0.14, cz), (cx, y + 0.24, cz), (cx + 0.18, y + 0.14, cz)], 0.045, sides=8, material=1)
        else:
            for k in range(4):
                C.box(bm, (0.38, 0.06, 0.22), (cx, y + k * 0.065, cz), bevel=0.006, rot=(tilt[0], yaw + 0.2 * k, tilt[2]), material=1)
        # Cables lashed over it, holding it to the bundle.
        for k in range(2):
            yy = y + (k - 0.5) * 0.35
            arc = [(pillar_radius(yy) * 1.06 * math.cos(a + s), yy + 0.06 * math.sin(s * 9), pillar_radius(yy) * 1.06 * math.sin(a + s)) for s in [(j / 12 - 0.5) * 0.9 for j in range(13)]]
            C.tube(bm, arc, 0.05, sides=6, material=1, uv_tile=CABLE_TILE)


def nest(bm, rng):
    """The landing: cables coiled flat on top of the pillar, overlapping like a bird's nest."""
    for k in range(4):
        r = 0.07 + 0.02 * k
        phase = rng.random() * 2 * math.pi
        pts = []
        for i in range(260):
            s = i / 259
            rad = 0.25 + 2.45 * s + 0.05 * math.sin(i * 0.7 + k)
            a = phase + 5.2 * 2 * math.pi * s
            pts.append((rad * math.cos(a), PLATFORM_Y + 0.02 + 0.07 * k / 3 + 0.03 * math.sin(i * 0.37 + k), rad * math.sin(a)))
        C.tube(bm, pts, r, sides=8, material=k % 2, uv_tile=CABLE_TILE)
    # Cables rising from the nest toward the room, far above, out of the fog.
    for i in range(9):
        a = 2 * math.pi * i / 9 + rng.random() * 0.3
        r0 = 0.6 + rng.random() * 0.9
        pts = []
        for j in range(40):
            s = j / 39
            rad = r0 * (1 - 0.8 * s)
            pts.append((rad * math.cos(a + s), PLATFORM_Y + 0.1 + 60 * s, rad * math.sin(a + s)))
        C.tube(bm, pts, 0.06 + 0.04 * rng.random(), sides=6, material=pick_material(rng), uv_tile=CABLE_TILE)


def far_pillar(bm, rng, cx, cz, radius, top=-30.0, bottom=-186.0, cables=24):
    """A distant trunk of cables; fewer, coarser cables, it lives in the fog."""
    for _ in range(cables):
        a0 = rng.random() * 2 * math.pi
        twist = (0.02 + 0.03 * rng.random()) * (1 if rng.random() < 0.75 else -1)
        layer = 0.85 + 0.25 * rng.random()
        pts = []
        y = top
        while y > bottom:
            a = a0 + twist * (top - y)
            rad = radius * layer * (1 + 0.15 * math.sin(y * 0.05 + cx) + 0.5 * math.exp(-((y - bottom) / 4) ** 2))
            pts.append((cx + rad * math.cos(a), y, cz + rad * math.sin(a)))
            y -= 2.0
        C.tube(bm, pts, 0.06 + 0.12 * rng.random(), sides=5, material=pick_material(rng), uv_tile=CABLE_TILE)
    C.cylinder(bm, radius * 0.8, top - bottom, (cx, (top + bottom) / 2, cz), segments=16, cap=False, material=6)


def droop(a, b, sag, n=40):
    """Points of a cable hanging between a and b."""
    return [tuple(a[k] + (b[k] - a[k]) * (i / n) - (sag * 4 * (i / n) * (1 - i / n) if k == 1 else 0) for k in range(3)) for i in range(n + 1)]


# ---------------------------------------------------------------------------
# TV towers: CRTs stacked into ruined buildings far out in the fog


def crt_block(bm, size, center, yaw, casing, screen):
    """A far-away CRT: casing, a tapered back and a recessed screen. Low detail on purpose."""
    w, h, d = size
    verts = C.box(bm, (w, h, d), center, bevel=min(w, h) * 0.05, segments=1, rot=(0, yaw, 0), material=casing)
    del verts
    # The screen faces the CRT's local +Z.
    sx, sz = math.sin(yaw), math.cos(yaw)
    cx, cy, cz = center
    fx, fz = cx + sx * (d / 2 + 0.005), cz + sz * (d / 2 + 0.005)
    hw, hh = w * 0.38, h * 0.34
    right = (math.cos(yaw), 0, -math.sin(yaw))
    corners = [
        (fx - right[0] * hw, cy - hh, fz - right[2] * hw),
        (fx + right[0] * hw, cy - hh, fz + right[2] * hw),
        (fx + right[0] * hw, cy + hh, fz + right[2] * hw),
        (fx - right[0] * hw, cy + hh, fz - right[2] * hw),
    ]
    face_verts = [bm.verts.new(V(*c)) for c in corners]
    face = bm.faces.new(face_verts)
    face.material_index = screen
    face.normal_update()
    if face.normal.dot(V(sx, 0, sz)) < 0:
        face.normal_flip()
    uv = bm.loops.layers.uv.get("UVMap") or bm.loops.layers.uv.new("UVMap")
    for loop, c in zip(face.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        loop[uv].uv = c
    C._mark_all(bm)


def tower(bm, rng, cx, cz, height, base_y=FLOOR_Y - 1.5):
    """A leaning stack of dead and dying TVs, a few per floor, facing every way."""
    y = base_y
    lean_x, lean_z = (rng.random() - 0.5) * 0.06, (rng.random() - 0.5) * 0.06
    level = 0
    while y < base_y + height:
        size = 1.6 + rng.random() * 1.6
        per_floor = 2 + int(rng.random() * 3)
        floor_h = size * 0.85
        for k in range(per_floor):
            a = 2 * math.pi * k / per_floor + rng.random() * 0.6
            off = size * 0.55
            px = cx + off * math.cos(a) + lean_x * (y - base_y)
            pz = cz + off * math.sin(a) + lean_z * (y - base_y)
            yaw = math.atan2(math.cos(a), math.sin(a)) + (rng.random() - 0.5) * 0.8
            crt_block(bm, (size, size * 0.82, size * 0.9), (px, y + floor_h / 2, pz), yaw, int(rng.random() * 3), 3)
        y += floor_h
        level += 1


# ---------------------------------------------------------------------------


def build():
    C.reset_scene()
    m = materials()
    coll = C.collection(WORLD)
    rng = C.seeded(101)
    cable_mats = [m["black"], m["grey"], m["beige"], m["tape"], m["plug"], m["copper"], m["core"]]

    def build_obj(name, fn, mats, props=None):
        bm = C.new_bmesh()
        fn(bm)
        obj = C.finish(name, bm, mats, coll, smooth_angle=60, props=props)
        # Cables brought their own UVs; plugs, tape and casings get a box projection.
        C.box_uv(obj, only_unset=True)
        return obj

    build_obj("Pillar_Cables", lambda bm: main_cables(bm, rng), cable_mats, props={"ao": 1})
    build_obj("Pillar_Loops", lambda bm: loops_off_the_pillar(bm, rng), cable_mats, props={"ao": 1})
    build_obj("Pillar_Relics", lambda bm: relics(bm, rng, m), [m["tower0"], m["black"], m["tower_screen"], m["tower1"]], props={"ao": 1})
    build_obj("Pillar_Core", lambda bm: C.cylinder(bm, 1.55, FRAY_Y - PLATFORM_Y + 0.6, (0, (FRAY_Y + PLATFORM_Y) / 2 - 0.3, 0), segments=48, cap=False, material=6), cable_mats)
    build_obj("Pillar_Nest", lambda bm: nest(bm, rng), cable_mats, props={"ao": 1})

    # The forest of other pillars, between 18 and 60 m out.
    far = []
    for i in range(9):
        a = 2 * math.pi * i / 9 + rng.random() * 0.5
        dist = 18 + rng.random() * 42
        far.append((dist * math.cos(a), dist * math.sin(a), 1.2 + rng.random() * 2.2))
    build_obj("Far_Pillars", lambda bm: [far_pillar(bm, rng, x, z, r) for x, z, r in far], cable_mats)

    def droops(bm):
        # Cables slung between the far pillars, and vines hanging out of the dark above.
        for _ in range(26):
            p, q = rng.sample(far, 2)
            span = math.dist((p[0], p[1]), (q[0], q[1]))
            dx, dz = (q[0] - p[0]) / span, (q[1] - p[1]) / span
            # From the surface of one trunk to the surface of the other.
            a = (p[0] + dx * p[2], -60 - rng.random() * 90, p[1] + dz * p[2])
            b = (q[0] - dx * q[2], -60 - rng.random() * 90, q[1] - dz * q[2])
            C.tube(bm, droop(a, b, 4 + rng.random() * 12), 0.05 + rng.random() * 0.1, sides=6, material=pick_material(rng), uv_tile=CABLE_TILE)
        for _ in range(34):
            a = rng.random() * 2 * math.pi
            dist = 12 + rng.random() * 40
            x, z = dist * math.cos(a), dist * math.sin(a)
            end = -70 - rng.random() * 95
            pts = [(x + 0.4 * math.sin(s * 3 + a), -20 - (-20 - end) * s, z + 0.4 * math.cos(s * 2 + a)) for s in [i / 30 for i in range(31)]]
            C.tube(bm, pts, 0.03 + rng.random() * 0.06, sides=5, material=pick_material(rng), uv_tile=CABLE_TILE)

    build_obj("Droops", droops, cable_mats)

    def towers(bm):
        for i in range(8):
            a = 2 * math.pi * (i + 0.5) / 8 + rng.random() * 0.4
            dist = 34 + rng.random() * 40
            tower(bm, rng, dist * math.cos(a), dist * math.sin(a), 22 + rng.random() * 48)

    build_obj("Towers", towers, [m["tower0"], m["tower1"], m["tower2"], m["tower_screen"]])
    C.save_blend(C.SOURCE / "spiral.blend")
    print("spiral objects:", [(o.name, len(o.data.polygons)) for o in coll.objects])


# ---------------------------------------------------------------------------
# Bake, probe, export


def bake_vertex_ao():
    """Ambient occlusion into vertex colours: the gaps between cables go dark, the bundle reads as a tangle."""
    C.use_gpu()
    scene = bpy.context.scene
    scene.world = bpy.data.worlds.new("Ao")
    scene.world.light_settings.distance = 0.8
    scene.cycles.samples = 64
    objects = [o for o in C.collection(WORLD).objects if o.get("ao")]
    for o in objects:
        attr = o.data.color_attributes.get("AO") or o.data.color_attributes.new("AO", "BYTE_COLOR", "POINT")
        o.data.color_attributes.active_color = attr
    C.select_only(objects)
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS", use_clear=True)


def render_probe():
    """What wet cables reflect: the teal dark, the glow of hanging screens, the towers' static."""
    scene = bpy.context.scene
    world = bpy.data.worlds.new("Teal")
    scene.world = world
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.004, 0.022, 0.022, 1)
    glow = C.material("ProbeGlow", (0, 0, 0), 1.0, emission=((0.75, 0.92, 1.0), 6.0))
    bm = C.new_bmesh()
    # Stand-ins for the project monitors on the helix, and a few in the far dark.
    for i in range(6):
        a = i * 1.25 * 2 * math.pi / 5
        y = -84 + i * (-72 / 5)
        C.box(bm, (1.7, 1.3, 0.05), (6 * math.sin(a), y, 6 * math.cos(a)), rot=(0, a, 0))
    rng = C.seeded(7)
    for _ in range(40):
        a = rng.random() * 2 * math.pi
        d = 12 + rng.random() * 50
        C.box(bm, (1.2, 0.9, 0.05), (d * math.sin(a), -70 - rng.random() * 100, d * math.cos(a)), rot=(0, a + math.pi, 0))
    C.finish("ProbeScreens", bm, [glow], C.collection("Probe"))
    shaft = bpy.data.lights.new("Shaft", "SPOT")
    shaft.energy = 40000
    shaft.spot_size = math.radians(30)
    shaft.color = (0.5, 0.9, 0.82)
    o = bpy.data.objects.new("Shaft", shaft)
    o.location = V(0, -40, 0)
    o.rotation_euler = (0, 0, 0)
    C.collection("Probe").objects.link(o)
    cam = bpy.data.cameras.new("ProbeCam")
    cam.type = "PANO"
    cam.panorama_type = "EQUIRECTANGULAR"
    probe = bpy.data.objects.new("ProbeCam", cam)
    probe.location = V(9.4, -112, 0)
    # three.js reads equirect maps with +X in the middle.
    probe.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
    C.collection("Probe").objects.link(probe)
    scene.camera = probe
    scene.render.resolution_x, scene.render.resolution_y = 1024, 512
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "Standard"
    scene.render.image_settings.file_format = "OPEN_EXR"
    raw = C.BUILD / "spiral-probe.exr"
    scene.render.filepath = str(raw)
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(str(raw))
    px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    scale = bake.encode_probe(px.reshape(img.size[1], img.size[0], 4), C.PUBLIC_MODELS / "spiral-probe.webp")
    bpy.context.scene["probe_scale"] = scale
    for o in list(C.collection("Probe").objects):
        bpy.data.objects.remove(o)


def export():
    objs = list(C.collection(WORLD).objects)
    C.select_only(objs)
    out = C.PUBLIC_MODELS / "spiral.glb"
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
        export_vertex_color="ACTIVE",
        # Hundreds of cables: Draco shrinks the geometry several times over (decoder in public/draco).
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=8,
        export_yup=True,
    )
    print("exported:", out, f"{out.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    build()
    bake_vertex_ao()
    render_probe()
    C.save_blend(C.SOURCE / "spiral.blend")
    export()
