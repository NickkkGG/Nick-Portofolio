"""Builds the opening room (spec §3.3, §5.2): geometry, materials and bake lights.

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/scripts/room.py

Writes blender/source/room.blend. Positions are three.js metres (see common.V):
the character sits at the origin facing -Z, the desk stands against the back wall.
"""

import math
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import art  # noqa: E402
import common as C  # noqa: E402
import crt_model  # noqa: E402
import textures as T  # noqa: E402
from common import V  # noqa: E402

# Room shell: 6 m wide, 4.2 m deep, 3 m high. The back wall sits right behind the desk.
X0, X1 = -3.0, 3.0
Z0, Z1 = -1.18, 3.0
H = 3.0
WALL = 0.25  # wall thickness, seen in the window reveal
WIN = {"z0": -1.0, "z1": 0.3, "y0": 0.95, "y1": 2.25}

DESK = {"x0": -0.7, "x1": 0.7, "z0": -1.13, "z1": -0.38, "top": 0.75, "thick": 0.035}
CRT = {"x": -0.04, "front": -0.62, "depth": 0.46, "w": 0.46, "h": 0.43, "screen": (0.372, 0.286)}
LAMP_BULB = (0.4, 1.36, -0.66)  # filament centre: high enough that its light clears the CRT
MOON_DIR = (0.72, -0.68, 0.12)  # direction the moonlight travels

STATIC = "Room"


# ---------------------------------------------------------------------------
# Materials


def build_materials():
    ph, acg = T.polyhaven, T.ambientcg
    plastic = acg("Plastic018B")
    plastic_color = plastic.get("color")
    metal = ph("green_metal_rust")
    wood = ph("wood_table_worn")
    paper = acg("Paper003")
    m = {}
    m["wall"] = C.material("Wall", (0.56, 0.54, 0.5), 0.92, textures=ph("worn_plaster_wall"), tile=2.4)
    m["ceiling"] = C.material(
        "Ceiling", (0.6, 0.58, 0.55), 0.95, textures=T.with_color(ph("worn_plaster_wall"), T.tinted(ph("worn_plaster_wall")["color"], "ceiling_color", (0.95, 0.95, 0.93), contrast=0.7)), tile=2.8
    )
    m["floor"] = C.material("Floor", (0.32, 0.32, 0.31), 0.85, textures=ph("concrete_floor_worn_001"), tile=2.2)
    m["wood"] = C.material("Wood", (0.24, 0.13, 0.07), 0.6, textures=wood, tile=1.1)
    m["wood_dark"] = C.material(
        "WoodDark", (0.13, 0.08, 0.05), 0.55, textures=T.with_color(wood, T.tinted(wood["color"], "wood_dark_color", (0.55, 0.5, 0.47))), tile=0.9
    )
    m["metal"] = C.material("GreenMetal", (0.1, 0.17, 0.12), 0.45, metallic=1.0, textures=metal, tile=0.6)
    m["radiator"] = C.material(
        "Radiator",
        (0.5, 0.48, 0.4),
        0.55,
        metallic=1.0,
        textures=T.with_color(metal, T.tinted(metal["color"], "radiator_color", (1.0, 0.95, 0.75), add=(0.28, 0.25, 0.18), contrast=0.8)),
        tile=0.7,
    )
    m["carpet"] = C.material("Carpet", (0.07, 0.08, 0.06), 1.0, textures=ph("dirty_carpet", size=1024), tile=0.9)
    m["beige"] = C.material(
        "PlasticBeige", (0.62, 0.57, 0.45), 0.45, textures=T.with_color(plastic, T.tinted(plastic_color, "plastic_beige", (0.98, 0.88, 0.66))), tile=0.5
    )
    m["beige_light"] = C.material(
        "Keycaps", (0.7, 0.66, 0.55), 0.5, textures=T.with_color(plastic, T.tinted(plastic_color, "plastic_keycap", (1.0, 0.94, 0.78), add=(0.05, 0.04, 0.02), size=1024)), tile=0.3
    )
    m["beige_dark"] = C.material(
        "KeycapsDark", (0.42, 0.4, 0.36), 0.5, textures=T.with_color(plastic, T.tinted(plastic_color, "plastic_keycap_dark", (0.62, 0.6, 0.55), size=1024)), tile=0.3
    )
    m["blind"] = C.material(
        "BlindSlat", (0.72, 0.7, 0.64), 0.5, textures=T.with_color(plastic, T.tinted(plastic_color, "plastic_blind", (1.0, 0.97, 0.88), add=(0.08, 0.07, 0.05), size=1024)), tile=0.4
    )
    m["trim"] = C.material(
        "Trim", (0.5, 0.48, 0.44), 0.7, textures=T.with_color(plastic, T.tinted(plastic_color, "plastic_trim", (0.82, 0.8, 0.74), size=1024)), tile=0.8
    )
    m["black"] = C.material("PlasticBlack", (0.025, 0.025, 0.027), 0.5, textures=acg("Plastic012B"), tile=0.4)
    m["leather"] = C.material("Leather", (0.035, 0.035, 0.04), 0.55, textures=acg("Leather032"), tile=0.45)
    m["paper"] = C.material("Paper", (0.82, 0.8, 0.74), 0.9, textures=paper, tile=0.35)
    m["cardboard"] = C.material("Cardboard", (0.47, 0.35, 0.21), 0.85, textures=acg("Cardboard003"), tile=0.45)
    m["steel"] = C.material("Steel", (0.56, 0.56, 0.58), 0.32, metallic=1.0)
    m["ceramic"] = C.material("Ceramic", (0.8, 0.78, 0.72), 0.22)
    m["coffee"] = C.material("Coffee", (0.05, 0.025, 0.012), 0.08)
    m["can"] = C.material("Can", (0.06, 0.16, 0.15), 0.3, metallic=0.9)
    m["terracotta"] = C.material("Terracotta", (0.36, 0.17, 0.1), 0.9)
    m["dry_plant"] = C.material("DryPlant", (0.2, 0.15, 0.08), 0.9)
    m["glass"] = C.material("WindowGlass", (0.6, 0.66, 0.7), 0.08, alpha_blend=True, alpha=0.12, props={"runtime": "glass"})
    m["screen"] = C.material("CrtScreen", (0.02, 0.025, 0.025), 0.1, props={"runtime": "screen"})
    m["bulb"] = C.material("BulbGlass", (0.95, 0.85, 0.7), 0.05, emission=((1.0, 0.75, 0.45), 6.0), props={"runtime": "bulb"})
    m["filament"] = C.material("Filament", (1.0, 0.6, 0.3), 0.5, emission=((1.0, 0.55, 0.25), 40.0), props={"runtime": "filament"})
    m["led"] = C.material("PowerLed", (0.1, 0.9, 0.3), 0.3, emission=((0.2, 1.0, 0.35), 4.0), props={"runtime": "led"})
    for i, color in enumerate([(0.32, 0.06, 0.05), (0.06, 0.12, 0.2), (0.12, 0.16, 0.09), (0.45, 0.38, 0.2), (0.08, 0.07, 0.07), (0.38, 0.33, 0.28)]):
        m[f"book{i}"] = C.material(f"Book{i}", color, 0.75, textures={"normal": paper.get("normal"), "orm": paper.get("orm")}, tile=0.3)
    m["book_cloth"] = C.material(
        "BookCloth", (0.3, 0.2, 0.15), 0.8, textures={"color": art.book_atlas(art.OUT / "book_atlas.jpg", paper.get("color")), "normal": paper.get("normal"), "orm": paper.get("orm")}
    )
    m["book_pages"] = C.material("BookPages", (0.84, 0.8, 0.68), 0.9, textures={"color": art.page_edges(art.OUT / "page_edges.png"), "normal": paper.get("normal")})
    m["poster"] = C.material("Poster", (0.3, 0.3, 0.28), 0.85, textures={"color": art.poster(art.OUT / "poster.jpg", paper.get("color")), "normal": paper.get("normal"), "orm": paper.get("orm")})
    for i in range(3):
        m[f"note{i}"] = C.material(f"Note{i}", (0.9, 0.8, 0.3), 0.9, textures={"color": art.scribbles(art.OUT / f"note{i}.png", seed=40 + i, paper=[(0.93, 0.83, 0.32), (0.9, 0.55, 0.6), (0.6, 0.85, 0.75)][i])})
    m["vhs_label"] = C.material("VhsLabel", (0.8, 0.78, 0.7), 0.9, textures={"color": art.scribbles(art.OUT / "vhs_label.png", seed=50, lines=2, paper=(0.86, 0.84, 0.78), ink=(0.1, 0.1, 0.12))})
    for i, (hub, triangle) in enumerate([((0.28, 0.3), True), ((0.42, 0.62), False)]):
        m[f"web{i}"] = C.material(
            f"Cobweb{i}", (0.8, 0.8, 0.78), 0.6, textures={"alpha": art.cobweb(art.OUT / f"cobweb{i}.png", seed=60 + i, hub=hub, triangle=triangle)}, props={"runtime": "cobweb"}
        )
    for i, asset in enumerate(["Leaking007", "Leaking008"]):
        leak = acg(asset)
        m[f"leak{i}"] = C.material(
            f"Leak{i}",
            (0.16, 0.13, 0.09),
            0.75,
            textures={"color": T.tinted(leak.get("color"), f"leak{i}_color", (0.55, 0.48, 0.38)), "alpha": leak.get("alpha")} if leak else None,
            props={"runtime": "decal"},
        )
    return m


# ---------------------------------------------------------------------------
# Helpers


def obj(name, build, mats, smooth=None, props=None, uv_rotate=0.0, coll=None):
    """Builds one object: build(bm) adds geometry using material indices into mats."""
    bm = C.new_bmesh()
    build(bm)
    o = C.finish(name, bm, mats, coll or C.collection(STATIC), smooth_angle=smooth, props=props)
    C.box_uv(o, rotate=uv_rotate)
    return o


def books_object(name, place, m):
    """Books carry their own atlas UVs, so they skip the box projection obj() applies."""
    bm = C.new_bmesh()
    place(bm)
    return C.finish(name, bm, [m["book_cloth"], m["book_pages"]], C.collection(STATIC), smooth_angle=50)


def oriented(bm, corners, normal, material=0):
    """Quad through three.js corners whose front faces along `normal` (three.js)."""
    verts = [bm.verts.new(V(*c)) for c in corners]
    face = bm.faces.new(verts)
    face.normal_update()
    if face.normal.dot(V(*normal)) < 0:
        face.normal_flip()
    face.material_index = material
    C._mark_all(bm)
    return face


def catmull(points, step=0.01):
    """Smooth path through control points (three.js), sampled about every `step` metres."""
    pts = [Vector(p) for p in points]
    pts = [pts[0] + (pts[0] - pts[1])] + pts + [pts[-1] + (pts[-1] - pts[-2])]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        n = max(2, int((p2 - p1).length / step))
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(pts[-2])
    return [tuple(p) for p in out]


def hang(a, b, sag, n=24):
    """Points of a cable hanging between a and b (three.js), dropping `sag` metres mid-span."""
    a, b = Vector(a), Vector(b)
    return [tuple(a + (b - a) * (i / n) - Vector((0, sag * 4 * (i / n) * (1 - i / n), 0))) for i in range(n + 1)]


# ---------------------------------------------------------------------------
# Shell


def shell(m):
    knock = {"knock": 1}
    obj("Floor", lambda bm: oriented(bm, [(X0, 0, Z1), (X1, 0, Z1), (X1, 0, Z0), (X0, 0, Z0)], (0, 1, 0)), [m["floor"]], props={"lm_scale": 1.3})
    obj("Ceiling", lambda bm: oriented(bm, [(X0, H, Z0), (X1, H, Z0), (X1, H, Z1), (X0, H, Z1)], (0, -1, 0)), [m["ceiling"]], props={**knock, "lm_scale": 0.5})
    obj("Wall_Back", lambda bm: oriented(bm, [(X0, 0, Z0), (X1, 0, Z0), (X1, H, Z0), (X0, H, Z0)], (0, 0, 1)), [m["wall"]], props=knock)
    obj("Wall_Right", lambda bm: oriented(bm, [(X1, 0, Z0), (X1, 0, Z1), (X1, H, Z1), (X1, H, Z0)], (-1, 0, 0)), [m["wall"]], props={**knock, "lm_scale": 0.6})
    obj("Wall_Front", lambda bm: oriented(bm, [(X1, 0, Z1), (X0, 0, Z1), (X0, H, Z1), (X1, H, Z1)], (0, 0, -1)), [m["wall"]], props={**knock, "lm_scale": 0.4})

    def left(bm):
        z0, z1, y0, y1 = WIN["z0"], WIN["z1"], WIN["y0"], WIN["y1"]
        x, xo = X0, X0 - WALL
        oriented(bm, [(x, 0, Z0), (x, 0, Z1), (x, y0, Z1), (x, y0, Z0)], (1, 0, 0))
        oriented(bm, [(x, y1, Z0), (x, y1, Z1), (x, H, Z1), (x, H, Z0)], (1, 0, 0))
        oriented(bm, [(x, y0, Z0), (x, y0, z0), (x, y1, z0), (x, y1, Z0)], (1, 0, 0))
        oriented(bm, [(x, y0, z1), (x, y0, Z1), (x, y1, Z1), (x, y1, z1)], (1, 0, 0))
        # The reveal: the wall's thickness around the opening.
        oriented(bm, [(x, y0, z0), (xo, y0, z0), (xo, y0, z1), (x, y0, z1)], (0, 1, 0))
        oriented(bm, [(x, y1, z0), (x, y1, z1), (xo, y1, z1), (xo, y1, z0)], (0, -1, 0))
        oriented(bm, [(x, y0, z0), (x, y1, z0), (xo, y1, z0), (xo, y0, z0)], (0, 0, 1))
        oriented(bm, [(x, y0, z1), (xo, y0, z1), (xo, y1, z1), (x, y1, z1)], (0, 0, -1))

    obj("Wall_Left", left, [m["wall"]], props=knock)

    def skirting(bm):
        h, t = 0.09, 0.016
        C.box(bm, (X1 - X0, h, t), (0, h / 2, Z0 + t / 2), bevel=0.003)
        C.box(bm, (t, h, Z1 - Z0), (X0 + t / 2, h / 2, (Z0 + Z1) / 2), bevel=0.003)
        C.box(bm, (t, h, Z1 - Z0), (X1 - t / 2, h / 2, (Z0 + Z1) / 2), bevel=0.003)
        C.box(bm, (X1 - X0, h, t), (0, h / 2, Z1 - t / 2), bevel=0.003)

    obj("Skirting", skirting, [m["trim"]], smooth=40)

    # Interior sill: a worn ledge under the window.
    obj("Window_Sill", lambda bm: C.box(bm, (WALL + 0.06, 0.035, WIN["z1"] - WIN["z0"] + 0.14), (X0 - WALL / 2 + 0.03, WIN["y0"] - 0.0175, (WIN["z0"] + WIN["z1"]) / 2), bevel=0.006), [m["trim"]], smooth=40)


def window(m):
    z0, z1, y0, y1 = WIN["z0"], WIN["z1"], WIN["y0"], WIN["y1"]
    xf = X0 - WALL * 0.55  # frame plane, inside the reveal
    bar, depth = 0.032, 0.045
    cols, rows = 3, 3

    def frame(bm):
        C.box(bm, (depth, bar * 1.6, z1 - z0), (xf, y1 - bar * 0.8, (z0 + z1) / 2), bevel=0.004)
        C.box(bm, (depth, bar * 1.6, z1 - z0), (xf, y0 + bar * 0.8, (z0 + z1) / 2), bevel=0.004)
        C.box(bm, (depth, y1 - y0, bar * 1.6), (xf, (y0 + y1) / 2, z0 + bar * 0.8), bevel=0.004)
        C.box(bm, (depth, y1 - y0, bar * 1.6), (xf, (y0 + y1) / 2, z1 - bar * 0.8), bevel=0.004)
        for i in range(1, cols):
            C.box(bm, (depth * 0.8, y1 - y0, bar), (xf, (y0 + y1) / 2, z0 + (z1 - z0) * i / cols), bevel=0.003)
        for j in range(1, rows):
            C.box(bm, (depth * 0.8, bar, z1 - z0), (xf, y0 + (y1 - y0) * j / rows, (z0 + z1) / 2), bevel=0.003)
        # Latch on the middle bar.
        C.box(bm, (0.03, 0.012, 0.012), (xf + 0.03, y0 + (y1 - y0) / 3 + 0.03, z0 + (z1 - z0) * 2 / 3), bevel=0.003)
        C.cylinder(bm, 0.006, 0.08, (xf + 0.045, y0 + (y1 - y0) / 3 + 0.0, z0 + (z1 - z0) * 2 / 3), segments=8)

    obj("Window_Frame", frame, [m["metal"]], smooth=40)
    obj("Window_Glass", lambda bm: oriented(bm, [(xf - 0.005, y0, z0), (xf - 0.005, y0, z1), (xf - 0.005, y1, z1), (xf - 0.005, y1, z0)], (1, 0, 0)), [m["glass"]], props={"runtime": "glass"})


def blinds(m):
    rng = C.seeded(3)
    z0, z1 = WIN["z0"] + 0.02, WIN["z1"] - 0.02
    x = X0 - 0.03
    top = WIN["y1"] - 0.045
    pitch = 0.0215
    # Tilted so the slats lean down into the room: moonlight slices through in stripes.
    tilt = math.radians(-25)

    def build(bm):
        C.box(bm, (0.05, 0.035, z1 - z0 + 0.04), (x, top + 0.0175, (z0 + z1) / 2), bevel=0.004)  # head rail
        y = top - 0.02
        k = 0
        bottom_left, bottom_right = 1.33, 1.21  # uneven: one cord pulled further
        while True:
            yl = y - k * pitch * 1.0
            # The bottom edge slopes from the back end to the front end of the window.
            yr = yl - (bottom_left - bottom_right) * (k * pitch) / (top - bottom_right)
            if yl < bottom_left or yr < bottom_right:
                break
            yc = (yl + yr) / 2
            roll = math.atan2(yl - yr, z1 - z0)
            # A few slats bent down in the middle: someone peeked outside.
            peek = 18 <= k <= 21
            # rot = (slope along the slat about X, 0, tilt about the slat's long axis Z).
            if k == 27:
                # Torn loose at the front end, hanging at an angle.
                C.box(bm, (0.025, 0.0016, z1 - z0), (x, yc - 0.07, (z0 + z1) / 2 + 0.02), rot=(0.12 + roll, 0, tilt * 0.4))
            elif peek:
                half = (z1 - z0) / 2
                for side in (-1, 1):
                    C.box(bm, (0.025, 0.0016, half * 0.62), (x, yc, (z0 + z1) / 2 + side * half * 0.69), rot=(roll, 0, tilt))
                    C.box(bm, (0.025, 0.0016, half * 0.4), (x + 0.004, yc - 0.012 - 0.004 * (k - 18), (z0 + z1) / 2 + side * half * 0.19), rot=(roll + side * 0.12, 0, tilt + 0.5))
            else:
                C.box(bm, (0.025, 0.0016, z1 - z0), (x, yc, (z0 + z1) / 2), rot=(roll, 0, tilt + (rng.random() - 0.5) * 0.08))
            k += 1
        last = k - 1
        yb = top - 0.02 - last * pitch
        C.box(bm, (0.03, 0.012, z1 - z0), (x, yb - 0.02 - (bottom_left - bottom_right) / 2, (z0 + z1) / 2), bevel=0.003, rot=(math.atan2(bottom_left - bottom_right, z1 - z0), 0, 0))

    obj("Blinds", build, [m["blind"]], smooth=30)

    def cords(bm):
        for zc in (z0 + 0.18, z1 - 0.18):
            for dx in (-0.0135, 0.0135):
                C.tube(bm, [(x + dx, top, zc), (x + dx, 1.22 if zc > 0 else 1.32, zc)], 0.0007, sides=4)
        # Pull cord with its tassel, swaying a little off vertical.
        C.tube(bm, catmull([(x + 0.03, top, z1 - 0.03), (x + 0.04, 1.6, z1 - 0.02), (x + 0.045, 1.05, z1 - 0.01)]), 0.0012, sides=5)
        C.cylinder(bm, 0.006, 0.035, (x + 0.045, 1.035, z1 - 0.01), segments=8, radius_top=0.003)

    obj("Blind_Cords", cords, [m["blind"]])


def radiator(m):
    zc, n = -0.35, 13
    width = 0.062

    def build(bm):
        for i in range(n):
            z = zc + (i - (n - 1) / 2) * width
            C.box(bm, (0.15, 0.6, width * 0.82), (X0 + 0.13, 0.46, z), bevel=0.02, segments=3)
        C.box(bm, (0.05, 0.05, n * width), (X0 + 0.13, 0.2, zc), bevel=0.012)
        C.box(bm, (0.05, 0.05, n * width), (X0 + 0.13, 0.72, zc), bevel=0.012)
        for z in (zc - n * width / 2 + 0.03, zc + n * width / 2 - 0.03):
            C.box(bm, (0.13, 0.12, 0.03), (X0 + 0.13, 0.08, z), bevel=0.01)
        # Valve and the pipe into the wall.
        C.cylinder(bm, 0.016, 0.12, (X0 + 0.07, 0.2, zc + n * width / 2 + 0.05), segments=12, rot=(0, 0, math.pi / 2))
        C.cylinder(bm, 0.022, 0.05, (X0 + 0.13, 0.27, zc + n * width / 2 + 0.05), segments=12)

    obj("Radiator", build, [m["radiator"]], smooth=35)


# ---------------------------------------------------------------------------
# Desk corner


def desk(m):
    d = DESK
    top = d["top"]
    zc = (d["z0"] + d["z1"]) / 2
    depth = d["z1"] - d["z0"]

    def body(bm):
        C.box(bm, (d["x1"] - d["x0"], d["thick"], depth), (0, top - d["thick"] / 2, zc), bevel=0.008, segments=3)
        # Drawer pedestal on the left, a side panel and a modesty panel on the right.
        C.box(bm, (0.42, top - d["thick"] - 0.04, depth - 0.04), (-0.47, (top - d["thick"]) / 2 + 0.02, zc - 0.01), bevel=0.004)
        C.box(bm, (0.025, top - d["thick"], depth - 0.04), (0.665, (top - d["thick"]) / 2, zc), bevel=0.004)
        C.box(bm, (0.92, 0.42, 0.018), (0.19, top - d["thick"] - 0.23, d["z0"] + 0.03), bevel=0.003)

    obj("Desk", body, [m["wood"]], smooth=40)

    def drawers(bm):
        fronts = [(0.62, 0.08), (0.43, 0.0), (0.2, 0.0)]  # (centre y, pulled out)
        for i, (y, out) in enumerate(fronts):
            h = 0.17 if i < 2 else 0.24
            C.box(bm, (0.4, h, 0.022), (-0.47, y - (0.02 if i == 2 else 0), d["z1"] - 0.005 + out), bevel=0.004, material=0)
            if out:
                # The open drawer's sides, with papers sticking out.
                C.box(bm, (0.012, 0.12, out + 0.05), (-0.65, y - 0.01, d["z1"] - 0.02 + out / 2), material=0)
                C.box(bm, (0.012, 0.12, out + 0.05), (-0.29, y - 0.01, d["z1"] - 0.02 + out / 2), material=0)
                C.box(bm, (0.3, 0.004, 0.2), (-0.48, y + 0.055, d["z1"] - 0.06 + out), rot=(0.12, 0.08, 0.04), material=2)
            C.box(bm, (0.11, 0.012, 0.018), (-0.47, y + 0.02, d["z1"] + 0.016 + out), bevel=0.004, material=1)

    obj("Desk_Drawers", drawers, [m["wood"], m["steel"], m["paper"]], smooth=40)


def crt(m):
    """The desk monitor (shared model, see crt_model.py) standing on its swivel foot."""
    x, front = CRT["x"], CRT["front"]
    bottom = DESK["top"] + 0.055
    obj("CRT_Casing", lambda bm: crt_model.casing(bm, x, bottom, front, foot_top=DESK["top"]), [m["beige"], m["black"]], smooth=35)
    obj("CRT_Led", lambda bm: crt_model.led(bm, x, bottom, front), [m["led"]], props={"runtime": "led", "lightmap": 0})
    obj("CRT_Bezel", lambda bm: crt_model.bezel(bm, x, bottom, front), [m["black"]], smooth=35)
    bm = C.new_bmesh()
    crt_model.glass(bm, x, bottom, front)
    C.finish("CRT_Screen", bm, [m["screen"]], C.collection(STATIC), smooth_angle=80, props={"runtime": "screen", "lightmap": 0})


def keyboard_and_mouse(m):
    kx, kz = -0.05, -0.495
    top = DESK["top"]
    slope = math.radians(5)

    def case(bm):
        verts = C.box(bm, (0.47, 0.04, 0.2), (kx, top + 0.02, kz), bevel=0.006, segments=2)
        for v in verts:
            # Back edge higher than the front: Model M wedge.
            back = (-v.co.y) < kz
            if v.co.z > top + 0.02:
                v.co.z += 0.012 if back else -0.004

    obj("Keyboard", case, [m["beige"]], smooth=35)

    def keys(bm):
        pitch = 0.0185
        rows = [(16, 0.0), (15, 0.0), (15, 0.0), (14, 0.0), (13, 0.0)]
        z_front = kz + 0.075
        for r, (count, _) in enumerate(rows):
            for i in range(count):
                xk = kx - 0.2 + i * pitch + (r % 2) * 0.006
                zk = z_front - r * pitch
                yk = top + 0.044 + r * pitch * math.tan(slope) - 0.002
                dark = i == 0 or i == count - 1 or r == 0
                C.box(bm, (0.0165, 0.012, 0.0165), (xk, yk, zk), bevel=0.0025, segments=1, rot=(slope, 0, 0), material=1 if dark else 0)
        # Space bar row.
        C.box(bm, (0.11, 0.012, 0.0165), (kx - 0.03, top + 0.04, z_front + pitch), bevel=0.0025, segments=1, rot=(slope, 0, 0))
        for i in (-1, 1):
            C.box(bm, (0.03, 0.012, 0.0165), (kx - 0.03 + i * 0.08, top + 0.04, z_front + pitch), bevel=0.0025, segments=1, rot=(slope, 0, 0), material=1)

    obj("Keyboard_Keys", keys, [m["beige_light"], m["beige_dark"]], smooth=40)

    mx, mz = 0.34, -0.5
    obj("Mousepad", lambda bm: C.box(bm, (0.23, 0.004, 0.19), (mx, top + 0.002, mz), bevel=0.002, rot=(0, 0.08, 0)), [m["black"]], props={"lm_scale": 1.5})

    def mouse(bm):
        verts = C.sphere(bm, 0.05, (mx + 0.01, top + 0.012, mz + 0.01), segments=16, rings=10, scale=(0.62, 0.48, 1.0), rot=(0, 0.15, 0))
        for v in verts:
            v.co.z = max(v.co.z, top + 0.0045)

    obj("Mouse", mouse, [m["beige"]], smooth=60)


def desk_props(m):
    top = DESK["top"]

    def mug(bm):
        cx, cz = -0.43, -0.53
        C.lathe(bm, [(0.034, 0.0), (0.041, 0.004), (0.042, 0.095), (0.038, 0.097), (0.037, 0.02)], (cx, top, cz), segments=28, close_bottom=True)
        C.lathe(bm, [(0.0, 0.0), (0.0365, 0.0)], (cx, top + 0.075, cz), segments=28, material=1)
        handle = [(cx + 0.041 + 0.02 * math.sin(a), top + 0.05 + 0.03 * math.cos(a), cz) for a in [i * math.pi / 10 for i in range(11)]]
        C.tube(bm, handle, 0.006, sides=8)

    obj("Mug", mug, [m["ceramic"], m["coffee"]], smooth=60, props={"lm_scale": 2.0})

    def cans(bm):
        C.cylinder(bm, 0.033, 0.155, (-0.6, top + 0.0775, -1.0), segments=20, bevel=0.004)
        # A crushed one lying on its side.
        verts = C.cylinder(bm, 0.033, 0.12, (-0.22, top + 0.026, -1.03), segments=20, rot=(0, 0.6, math.pi / 2))
        for v in verts:
            v.co.z = top + (v.co.z - top) * 0.75

    obj("Cans", cans, [m["can"]], smooth=40)

    def papers(bm):
        rng = C.seeded(9)
        for i in range(4):
            C.box(bm, (0.21, 0.0015, 0.297), (-0.5 + rng.random() * 0.06, top + 0.001 + i * 0.0016, -0.8 + rng.random() * 0.05), rot=(0, 0.3 + rng.random() * 0.6, 0))
        # Closed notebook and a pen beside it.
        C.box(bm, (0.16, 0.012, 0.22), (0.27, top + 0.006, -0.85), bevel=0.003, rot=(0, -0.25, 0), material=1)
        C.cylinder(bm, 0.0045, 0.14, (0.17, top + 0.005, -0.78), segments=8, rot=(math.pi / 2, 0.9, 0), material=2)

    obj("Papers", papers, [m["paper"], m["book1"], m["black"]], smooth=40, props={"lm_scale": 1.5})


def lamp(m):
    top = DESK["top"]
    base = (0.5, top, -0.97)
    elbow = (0.55, 1.6, -0.98)
    # The bare bulb hangs nose-down over the keyboard, so the camera sees it glow.
    bulb_dir = Vector((-0.25, -0.85, 0.45)).normalized()
    socket_c = Vector(LAMP_BULB) - bulb_dir * 0.09
    head = socket_c - bulb_dir * 0.04
    aimed = C.aim(bulb_dir)

    def body(bm):
        C.lathe(bm, [(0.085, 0.0), (0.085, 0.012), (0.07, 0.03), (0.02, 0.036), (0.012, 0.05)], (base[0], top, base[2]), segments=32, close_top=True)
        C.tube(bm, [(base[0], top + 0.045, base[2]), elbow], 0.008, sides=10)
        C.tube(bm, [elbow, tuple(head)], 0.007, sides=10)
        for p in (elbow, (base[0], top + 0.05, base[2]), tuple(head)):
            C.sphere(bm, 0.016, p, segments=12, rings=8)
        # Springs along the lower arm.
        a, b = Vector((base[0] + 0.02, top + 0.08, base[2])), Vector(elbow) + Vector((0.02, -0.08, 0))
        axis = (b - a).normalized()
        side = axis.cross(Vector((0, 0, 1))).normalized()
        up = axis.cross(side).normalized()
        coil = [tuple(a + (b - a) * (i / 160) + 0.007 * (math.cos(i * 0.9) * side + math.sin(i * 0.9) * up)) for i in range(161)]
        C.tube(bm, coil, 0.0011, sides=4, material=1)
        # Bakelite socket and its shoulder.
        C.cylinder(bm, 0.019, 0.055, tuple(socket_c), segments=20, rot=aimed, material=2, bevel=0.003)
        C.cylinder(bm, 0.013, 0.02, tuple(socket_c + bulb_dir * 0.035), segments=16, rot=aimed, material=1)

    obj("Lamp", body, [m["metal"], m["steel"], m["black"]], smooth=45)

    def bulb(bm):
        # A19 bulb along +Y: the neck toward the socket, the round glass at the tip.
        profile = [(0.012, -0.05), (0.013, -0.04), (0.022, -0.025), (0.03, -0.008), (0.031, 0.006), (0.026, 0.024), (0.014, 0.034), (0.001, 0.037)]
        C.lathe(bm, profile, LAMP_BULB, segments=24, rot=aimed, close_top=True)

    obj("Lamp_Bulb", bulb, [m["bulb"]], smooth=60, props={"runtime": "bulb", "lightmap": 0})

    def filament(bm):
        c = Vector(LAMP_BULB)
        side = bulb_dir.cross(Vector((0, 1, 0))).normalized()
        pts = [tuple(c + side * (0.011 * math.sin(i * 1.3)) + bulb_dir * (0.006 * math.cos(i * 0.7) + 0.004)) for i in range(14)]
        C.tube(bm, pts, 0.0008, sides=4)
        # Support wires from the neck.
        for s in (-1, 1):
            C.tube(bm, [tuple(c - bulb_dir * 0.035 + side * 0.003 * s), tuple(c + side * 0.011 * s)], 0.0005, sides=3)

    obj("Lamp_Filament", filament, [m["filament"]], props={"runtime": "filament", "lightmap": 0})


def chair(m):
    def base(bm):
        for i in range(5):
            a = 2 * math.pi * i / 5 + 0.3
            dx, dz = math.sin(a), math.cos(a)
            C.box(bm, (0.045, 0.035, 0.3), (dx * 0.15, 0.085, 0.03 + dz * 0.15), bevel=0.01, rot=(0.12, a, 0))
            C.cylinder(bm, 0.025, 0.022, (dx * 0.3, 0.032, 0.03 + dz * 0.3), segments=12, rot=(0, a, math.pi / 2), material=0)
            C.cylinder(bm, 0.008, 0.035, (dx * 0.3, 0.06, 0.03 + dz * 0.3), segments=8)
        C.cylinder(bm, 0.045, 0.06, (0, 0.11, 0.03), segments=16, bevel=0.008)
        C.box(bm, (0.24, 0.035, 0.22), (0, 0.405, 0.03), bevel=0.008)
        # Curved spine from the seat to the backrest.
        C.box(bm, (0.06, 0.03, 0.26), (0, 0.4, 0.2), bevel=0.01, rot=(0.0, 0, 0))
        C.box(bm, (0.06, 0.32, 0.03), (0, 0.56, 0.33), bevel=0.01, rot=(-0.1, 0, 0))
        # Armrests: posts and pads.
        for s in (-1, 1):
            C.box(bm, (0.03, 0.2, 0.05), (s * 0.27, 0.52, 0.05), bevel=0.008)
            C.box(bm, (0.07, 0.025, 0.24), (s * 0.27, 0.635, 0.03), bevel=0.011, segments=3)
            C.box(bm, (0.2, 0.025, 0.04), (s * 0.18, 0.42, 0.05), bevel=0.008)

    obj("Chair_Base", base, [m["black"]], smooth=35)
    obj("Chair_Lift", lambda bm: C.cylinder(bm, 0.022, 0.29, (0, 0.27, 0.03), segments=16), [m["steel"]], smooth=60)

    seat_outline = C.rounded_outline(0.5, 0.48, 0.47, 0.07, 0.09)
    # Shoulders wider than the waist, a rounded top: an old executive chair's back.
    back_outline = C.rounded_outline(0.4, 0.45, 0.64, 0.06, 0.15)
    back_rot = (-0.13, 0, 0)

    def cushions(bm):
        C.padded(bm, seat_outline, 0.085, (0, 0.46, 0.02), rot=(-math.pi / 2, 0, 0), bevel=0.03)
        verts = C.padded(bm, back_outline, 0.08, (0, 0.92, 0.3), rot=back_rot, bevel=0.03)
        for v in verts:
            # Wrap the backrest around the sitter: its sides come forward (-Z).
            v.co.y += 0.035 * (v.co.x / 0.22) ** 2

    obj("Chair_Seat", cushions, [m["leather"]], smooth=50, props={"lm_scale": 1.3})

    def piping(bm):
        # The stitched welt around each cushion, where front and back panels meet.
        for outline, center, rot, wrap in ((seat_outline, (0, 0.46, 0.02), (-math.pi / 2, 0, 0), False), (back_outline, (0, 0.92, 0.3), back_rot, True)):
            m4 = C.rotation(rot)
            pts = []
            for x, y in outline + outline[:1]:
                p = (m4 @ C.V(x, y, 0.0).to_4d()).to_3d() + C.V(*center)
                if wrap:
                    p.y += 0.035 * (p.x / 0.22) ** 2
                pts.append((p.x, p.z, -p.y))  # back to three.js coordinates
            C.tube(bm, pts, 0.0055, sides=6, caps=False)

    obj("Chair_Piping", piping, [m["black"]], smooth=60, props={"lm_scale": 0.5})


def rug(m):
    def build(bm):
        w, d = 1.7, 1.15
        rot = math.radians(7)

        def point(u, v):
            # v runs toward -Z so the faces point up.
            lx, lz = (u - 0.5) * w, (0.5 - v) * d
            y = 0.007
            # The front-left corner curls up.
            cu, cv = max(0.0, 0.18 - u) / 0.18, max(0.0, 0.18 - v) / 0.18
            y += 0.06 * (cu * cv) ** 1.5
            return (-0.15 + lx * math.cos(rot) - lz * math.sin(rot), y, 0.12 + lx * math.sin(rot) + lz * math.cos(rot))

        C.sheet(bm, 24, 16, point)

    obj("Rug", build, [m["carpet"]], smooth=60, props={"lm_scale": 1.2})


def crumpled(bm, center, radius, seed, material=0):
    """A ball of crumpled paper: an icosphere pushed in and out at random."""
    rng = C.seeded(seed)
    geom = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=radius)
    for v in geom["verts"]:
        v.co *= 0.75 + 0.4 * rng.random()
    C._place(bm, center, (rng.random() * 3, rng.random() * 3, rng.random() * 3), material)


def floor_clutter(m):
    def bin_and_paper(bm):
        # A plastic waste bin left of the desk, overflowing onto the floor.
        C.lathe(bm, [(0.11, 0.0), (0.135, 0.31), (0.14, 0.315), (0.132, 0.315), (0.104, 0.008)], (-0.98, 0, -0.86), segments=28, close_bottom=True)
        for i, (x, y, z) in enumerate([(-0.99, 0.3, -0.85), (-0.94, 0.31, -0.9), (-1.02, 0.32, -0.88), (-0.78, 0.034, -0.55), (-1.14, 0.03, -0.62), (-0.62, 0.032, -0.36)]):
            crumpled(bm, (x, y, z), 0.036 + 0.008 * (i % 2), seed=70 + i, material=1)

    obj("Bin", bin_and_paper, [m["black"], m["paper"]], smooth=40)

    def books(bm):
        # A stack on the floor, lying flat, spines toward the room.
        rng = C.seeded(23)
        y = 0.0
        for i, design in enumerate((4, 10, 0, 15, 7, 2, 12)):
            t, h, d = 0.025 + rng.random() * 0.03, 0.24 + rng.random() * 0.06, 0.17 + rng.random() * 0.05
            C.book(bm, (t, h, d), (-2.55 + rng.random() * 0.03, y + t / 2, Z0 + 0.2), rot=(0, (rng.random() - 0.5) * 0.4, math.pi / 2), design=design)
            y += t

    books_object("Floor_Books", books, m)

    def box(bm):
        # A moving box that was never unpacked.
        C.box(bm, (0.46, 0.34, 0.36), (-1.72, 0.17, Z0 + 0.22), bevel=0.006, rot=(0, 0.08, 0))
        C.box(bm, (0.46, 0.003, 0.17), (-1.72, 0.37, Z0 + 0.46), rot=(-1.0, 0.08, 0))
        C.box(bm, (0.2, 0.003, 0.34), (-1.98, 0.38, Z0 + 0.21), rot=(0, 0.08, 0.9))
        # A VHS tape sticking out of it.
        C.box(bm, (0.187, 0.103, 0.025), (-1.66, 0.36, Z0 + 0.2), rot=(0.15, 0.3, 0.1), material=1)

    obj("Floor_Box", box, [m["cardboard"], m["black"]], smooth=40)


def shelf_and_cabinet(m):
    rng = C.seeded(17)
    sy = 1.66
    sz = Z0 + 0.125

    obj("Shelf", lambda bm: C.box(bm, (1.15, 0.028, 0.24), (1.62, sy, sz), bevel=0.005, segments=2), [m["wood"]], smooth=40)

    def brackets(bm):
        for bx in (1.2, 2.04):
            C.box(bm, (0.025, 0.004, 0.2), (bx, sy - 0.016, Z0 + 0.105), bevel=0.001)
            C.box(bm, (0.025, 0.18, 0.004), (bx, sy - 0.105, Z0 + 0.004), bevel=0.001)
            C.box(bm, (0.02, 0.004, 0.2), (bx, sy - 0.1, Z0 + 0.09), rot=(-0.78, 0, 0))

    obj("Shelf_Brackets", brackets, [m["metal"]], smooth=40)

    def books(bm):
        # A row of spines on the shelf, the last two leaning, and a small stack lying flat.
        top = sy + 0.014
        x = 1.09
        for i, design in enumerate((1, 6, 3, 13, 8, 5, 11, 9, 14)):
            t = 0.022 + rng.random() * 0.03
            h = 0.18 + rng.random() * 0.07
            d = 0.14 + rng.random() * 0.05
            lean = 0.0 if i < 7 else 0.3
            C.book(bm, (t, h, d), (x + t / 2 + (0.035 if lean else 0), top + h / 2 - (0.012 if lean else 0), sz - 0.01 + (0.17 - d) / 2), rot=(0, 0, -lean), design=design)
            x += t + 0.0015
        y = top
        for j, design in enumerate((0, 12, 2)):
            t = 0.026 + 0.008 * j
            C.book(bm, (t, 0.21 - j * 0.02, 0.15), (1.95, y + t / 2, sz), rot=(0, 0.1 * j - 0.1, math.pi / 2), design=design)
            y += t

    books_object("Books", books, m)

    def box(bm):
        C.box(bm, (0.22, 0.15, 0.17), (1.62, sy + 0.014 + 0.075, sz), bevel=0.004)
        # Flaps left open.
        C.box(bm, (0.22, 0.003, 0.09), (1.62, sy + 0.17, sz + 0.11), rot=(0.9, 0, 0))
        C.box(bm, (0.22, 0.003, 0.08), (1.62, sy + 0.17, sz - 0.11), rot=(-1.1, 0, 0))

    obj("Shelf_Box", box, [m["cardboard"]], smooth=40)

    def tin_and_plant(bm):
        C.lathe(bm, [(0.035, 0.0), (0.036, 0.11), (0.033, 0.112), (0.032, 0.01)], (1.82, sy + 0.014, sz + 0.02), segments=20, close_bottom=True)
        for i in range(5):
            a = i * 1.3
            C.cylinder(bm, 0.0035, 0.16, (1.82 + 0.012 * math.cos(a), sy + 0.1, sz + 0.02 + 0.012 * math.sin(a)), segments=6, rot=(0.15 * math.sin(a), 0, 0.15 * math.cos(a)), material=1)
        C.lathe(bm, [(0.04, 0.0), (0.055, 0.09), (0.06, 0.1), (0.055, 0.1)], (2.1, sy + 0.014, sz), segments=20, close_bottom=True, material=2)
        for i in range(6):
            a = i * 1.05
            stem = [(2.1, sy + 0.1, sz), (2.1 + 0.03 * math.cos(a), sy + 0.18, sz + 0.03 * math.sin(a)), (2.1 + 0.07 * math.cos(a), sy + 0.16 + 0.03 * (i % 2), sz + 0.07 * math.sin(a))]
            C.tube(bm, catmull(stem, 0.01), 0.002, sides=4, material=3)

    obj("Shelf_Tin_Plant", tin_and_plant, [m["steel"], m["book3"], m["terracotta"], m["dry_plant"]], smooth=45)

    cx0, cx1, cz1, ch = 1.1, 2.22, Z0 + 0.42, 0.78

    def cabinet(bm):
        C.box(bm, (cx1 - cx0, ch - 0.05, cz1 - Z0 - 0.01), ((cx0 + cx1) / 2, 0.05 + (ch - 0.05) / 2, (Z0 + cz1) / 2 - 0.005), bevel=0.006)
        C.box(bm, (cx1 - cx0 + 0.02, 0.025, cz1 - Z0 + 0.01), ((cx0 + cx1) / 2, ch + 0.0125, (Z0 + cz1) / 2), bevel=0.006, segments=2)
        for i, y in enumerate((0.58, 0.33)):
            C.box(bm, (cx1 - cx0 - 0.05, 0.22, 0.02), ((cx0 + cx1) / 2, y, cz1 + 0.006), bevel=0.004)
            for hx in ((cx0 + cx1) / 2 - 0.2, (cx0 + cx1) / 2 + 0.2):
                C.box(bm, (0.08, 0.012, 0.018), (hx, y + 0.06, cz1 + 0.025), bevel=0.003, material=1)
        for fx in (cx0 + 0.04, cx1 - 0.04):
            C.box(bm, (0.04, 0.05, 0.04), (fx, 0.025, cz1 - 0.04), material=0)

    obj("Cabinet", cabinet, [m["wood_dark"], m["steel"]], smooth=40)

    def vhs(bm):
        top = ch + 0.025
        for i in range(5):
            C.box(bm, (0.187, 0.025, 0.103), (1.3, top + 0.0125 + i * 0.0255, Z0 + 0.2), bevel=0.002, rot=(0, (rng.random() - 0.5) * 0.25, 0))
            C.box(bm, (0.002, 0.016, 0.08), (1.3 + 0.094, top + 0.0125 + i * 0.0255, Z0 + 0.2), material=1)
        # Old radio: speaker grilles, dial, handle.
        C.box(bm, (0.34, 0.16, 0.1), (1.82, top + 0.08, Z0 + 0.14), bevel=0.012, segments=2, material=2)
        for gx in (1.72, 1.92):
            C.cylinder(bm, 0.045, 0.006, (gx, top + 0.075, Z0 + 0.19), segments=20, rot=(math.pi / 2, 0, 0), material=3)
        C.box(bm, (0.08, 0.025, 0.004), (1.82, top + 0.12, Z0 + 0.19), material=1)
        C.tube(bm, [(1.68, top + 0.16, Z0 + 0.14), (1.7, top + 0.22, Z0 + 0.14), (1.94, top + 0.22, Z0 + 0.14), (1.96, top + 0.16, Z0 + 0.14)], 0.006, sides=8, material=2)

    obj("Cabinet_Stuff", vhs, [m["black"], m["vhs_label"], m["beige"], m["steel"]], smooth=40)


def pc(m):
    x0, x1, z0, z1, h = 0.76, 0.96, -1.12, -0.68, 0.42

    def tower(bm):
        C.box(bm, (x1 - x0, h, z1 - z0), ((x0 + x1) / 2, h / 2 + 0.01, (z0 + z1) / 2), bevel=0.006)
        zf = z1 + 0.003
        for i in range(2):
            C.box(bm, (0.15, 0.04, 0.006), ((x0 + x1) / 2, h - 0.05 - i * 0.048, zf), bevel=0.002, material=1)
        C.box(bm, (0.1, 0.025, 0.006), ((x0 + x1) / 2, h - 0.15, zf), bevel=0.002, material=1)
        C.box(bm, (0.06, 0.004, 0.003), ((x0 + x1) / 2, h - 0.15, zf + 0.003), material=2)
        C.box(bm, (0.025, 0.025, 0.008), ((x0 + x1) / 2, 0.15, zf), bevel=0.004)
        for i in range(10):
            C.box(bm, (0.13, 0.004, 0.004), ((x0 + x1) / 2, 0.05 + i * 0.008, zf), material=1)
        C.box(bm, (0.06, 0.006, 0.003), ((x0 + x1) / 2 + 0.03, h - 0.2, zf), material=1)

    obj("PC", tower, [m["beige"], m["beige_dark"], m["black"]], smooth=35)


def cables(m):
    top = DESK["top"]
    back = Z0 + 0.03
    runs = [
        # CRT power and VGA: out of the tube housing, over the desk's back edge, down to the floor.
        [(CRT["x"] + 0.05, 0.9, CRT["front"] - CRT["depth"] + 0.02), (0.06, top + 0.02, back + 0.02), (0.08, 0.5, back), (0.12, 0.012, back + 0.05), (0.32, 0.012, -0.98), (0.38, 0.03, -1.03)],
        [(CRT["x"] - 0.03, 0.9, CRT["front"] - CRT["depth"] + 0.02), (-0.02, top + 0.02, back + 0.03), (0.0, 0.45, back + 0.01), (0.15, 0.012, back + 0.08), (0.55, 0.012, -1.05), (0.76, 0.2, -1.1)],
        # Lamp cord.
        [(0.5, top + 0.01, -1.04), (0.5, top + 0.01, back + 0.04), (0.52, 0.4, back + 0.01), (0.45, 0.012, back + 0.1), (0.4, 0.03, -1.0)],
        # Keyboard cable across the desk and behind the monitor.
        [(-0.05, top + 0.035, -0.6), (-0.2, top + 0.006, -0.66), (-0.29, top + 0.006, -0.95), (-0.25, top + 0.006, back + 0.05), (-0.2, 0.5, back), (0.2, 0.012, back + 0.12), (0.76, 0.12, -1.1)],
        # Mouse cable.
        [(0.34, top + 0.012, -0.56), (0.42, top + 0.006, -0.72), (0.62, top + 0.006, -0.9), (0.69, top - 0.02, -1.0), (0.72, 0.4, -1.08), (0.76, 0.15, -1.1)],
        # Power strip to the wall socket, and a loose extension cord on the floor.
        [(0.3, 0.02, -1.0), (0.55, 0.012, -1.12), (0.85, 0.15, Z0 + 0.01), (0.95, 0.3, Z0 + 0.01)],
        [(0.96, 0.012, -0.9), (1.05, 0.012, -0.6), (0.9, 0.012, -0.35), (0.7, 0.012, -0.45), (0.85, 0.012, -0.7)],
    ]

    def build(bm):
        for i, run in enumerate(runs):
            C.tube(bm, catmull(run, 0.012), 0.0035 if i != 1 else 0.0045, sides=7)
        # Power strip with plugs.
        C.box(bm, (0.26, 0.035, 0.055), (0.3, 0.018, -1.0), bevel=0.006, rot=(0, 0.35, 0), material=1)
        for k in range(3):
            C.box(bm, (0.03, 0.04, 0.035), (0.23 + k * 0.065, 0.045, -0.975 + k * 0.024), bevel=0.005, rot=(0, 0.35, 0))

    obj("Cables", build, [m["black"], m["beige"]], smooth=60, props={"lm_scale": 0.6})


def wall_details(m):
    # Poster with a peeling top-right corner and tape on the others.
    px0, px1, py0, py1 = -1.72, -1.22, 1.42, 2.12
    tilt = math.radians(2.0)

    def poster(bm):
        uv = bm.loops.layers.uv.new("UVMap")

        def point(u, v):
            x, y = px0 + (px1 - px0) * u, py0 + (py1 - py0) * v
            x, y = (x - (px0 + px1) / 2) * math.cos(tilt) - (y - (py0 + py1) / 2) * math.sin(tilt) + (px0 + px1) / 2, (x - (px0 + px1) / 2) * math.sin(tilt) + (y - (py0 + py1) / 2) * math.cos(tilt) + (py0 + py1) / 2
            peel = max(0.0, (u - 0.72) / 0.28) * max(0.0, (v - 0.75) / 0.25)
            return (x - 0.03 * peel, y - 0.02 * peel, Z0 + 0.003 + 0.09 * peel ** 1.6)

        rows = [[bm.verts.new(V(*point(i / 10, j / 14))) for i in range(11)] for j in range(15)]
        for j in range(14):
            for i in range(10):
                f = bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
                for loop, (a, b) in zip(f.loops, [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]):
                    loop[uv].uv = (a / 10, b / 14)
        C._mark_all(bm)

    bm = C.new_bmesh()
    poster(bm)
    C.finish("Poster", bm, [m["poster"]], C.collection(STATIC), smooth_angle=60)

    def tape(bm):
        for (x, y, r) in [(px0 + 0.01, py0 + 0.02, 0.6), (px1 - 0.005, py0 + 0.025, -0.5), (px0 + 0.015, py1 - 0.005, -0.7)]:
            C.box(bm, (0.06, 0.018, 0.0008), (x, y, Z0 + 0.0045), rot=(0, 0, r))

    obj("Poster_Tape", tape, [m["paper"]])

    def notes(bm):
        spots = [(0.35, 1.5, 0.1, 0), (0.48, 1.38, -0.15, 1), (0.6, 1.55, 0.05, 2), (-0.62, 1.32, -0.08, 0)]
        for x, y, r, k in spots:
            C.box(bm, (0.075, 0.075, 0.0008), (x, y, Z0 + 0.003), rot=(0, 0, r), material=k)
        # One on the monitor's bezel.
        C.box(bm, (0.06, 0.06, 0.0008), (CRT["x"] - CRT["w"] / 2 + 0.045, DESK["top"] + 0.055 + CRT["h"] - 0.06, CRT["front"] + 0.003), rot=(0, 0, 0.12), material=1)

    bm = C.new_bmesh()
    notes(bm)
    o = C.finish("Notes", bm, [m["note0"], m["note1"], m["note2"]], C.collection(STATIC))
    _flat_uv(o)

    def outlet(bm):
        C.box(bm, (0.08, 0.12, 0.01), (0.95, 0.3, Z0 + 0.005), bevel=0.004)
        for dy in (-0.025, 0.025):
            C.cylinder(bm, 0.015, 0.006, (0.95, 0.3 + dy, Z0 + 0.012), segments=16, rot=(math.pi / 2, 0, 0), material=1)

    obj("Outlet", outlet, [m["beige"], m["black"]], smooth=40)

    def fixture(bm):
        # A dead ceiling light: bare socket on its cord.
        C.cylinder(bm, 0.05, 0.02, (0.2, H - 0.01, 0.7), segments=20)
        C.tube(bm, [(0.2, H - 0.02, 0.7), (0.2, H - 0.3, 0.7)], 0.003, sides=6)
        C.cylinder(bm, 0.02, 0.06, (0.2, H - 0.33, 0.7), segments=16)

    obj("Ceiling_Fixture", fixture, [m["black"]], smooth=40)


def _flat_uv(o):
    """Each face of a flat sticker gets the whole 0..1 image."""
    me = o.data
    layer = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        if abs(poly.normal.y) < 0.5:
            for li in poly.loop_indices:
                layer.data[li].uv = (0.0, 0.0)
            continue
        verts = [me.vertices[me.loops[li].vertex_index].co for li in poly.loop_indices]
        xs, zs = [v.x for v in verts], [v.z for v in verts]
        for li, v in zip(poly.loop_indices, verts):
            layer.data[li].uv = ((v.x - min(xs)) / max(1e-6, max(xs) - min(xs)), (v.z - min(zs)) / max(1e-6, max(zs) - min(zs)))


def cobwebs(m):
    # Material 0 is a triangular web (corners), 1 a web strung across a quad.
    webs = [
        ("Cobweb_Corner", [(X0, 2.3, Z0), (X0 + 0.7, H, Z0), (X0, H, Z0 + 0.65)], 0),
        ("Cobweb_Shelf", [(1.3, 1.4, Z0), (1.8, 1.4, Z0), (1.8, 1.645, Z0 + 0.2), (1.3, 1.645, Z0 + 0.2)], 1),
        ("Cobweb_Window", [(X0 - 0.02, WIN["y1"] - 0.32, WIN["z0"]), (X0 - 0.02, WIN["y1"], WIN["z0"] + 0.3), (X0 - 0.02, WIN["y1"], WIN["z0"])], 0),
        ("Cobweb_Crt", [(-0.25, 1.2, CRT["front"] - CRT["depth"] + 0.06), (0.15, 1.2, CRT["front"] - CRT["depth"] + 0.06), (0.15, 1.5, Z0), (-0.25, 1.5, Z0)], 1),
        ("Cobweb_Right", [(X1, 2.35, Z0), (X1, H, Z0 + 0.55), (X1 - 0.6, H, Z0)], 0),
    ]
    for name, corners, k in webs:
        bm = C.new_bmesh()
        verts = [bm.verts.new(V(*c)) for c in corners]
        face = bm.faces.new(verts)
        uv = bm.loops.layers.uv.new("UVMap")
        coords = [(0.0, 0.0), (1.0, 0.0), (0.0, 1.0)] if len(corners) == 3 else [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
        for loop, c in zip(face.loops, coords):
            loop[uv].uv = c
        C._mark_all(bm)
        C.finish(name, bm, [m[f"web{k}"]], C.collection(STATIC), props={"runtime": "cobweb", "lm_scale": 0.3})


def stains(m):
    patches = [
        # (name, plane, rect, material, flip): rising damp along the walls, a leak under the window.
        ("Stain_Left", "left", (WIN["z0"] - 0.5, 0.0, WIN["z1"] + 0.5, 0.95), 0, False),
        ("Stain_BackLeft", "back", (X0, 0.0, X0 + 1.3, 1.1), 1, False),
        ("Stain_BackRight", "back", (X1 - 1.2, 0.0, X1, 0.9), 0, False),
        ("Stain_Window", "left", (WIN["z0"] + 0.1, WIN["y0"] - 0.85, WIN["z1"] - 0.1, WIN["y0"] - 0.03), 1, True),
    ]
    for name, plane, (a0, b0, a1, b1), k, flip in patches:
        bm = C.new_bmesh()
        if plane == "left":
            corners = [(X0 + 0.004, b0, a1), (X0 + 0.004, b0, a0), (X0 + 0.004, b1, a0), (X0 + 0.004, b1, a1)]
            corners = [(X0 + 0.004, b0, a0), (X0 + 0.004, b0, a1), (X0 + 0.004, b1, a1), (X0 + 0.004, b1, a0)]
        else:
            corners = [(a0, b0, Z0 + 0.004), (a1, b0, Z0 + 0.004), (a1, b1, Z0 + 0.004), (a0, b1, Z0 + 0.004)]
        verts = [bm.verts.new(V(*c)) for c in corners]
        face = bm.faces.new(verts)
        face.normal_update()
        want = V(1, 0, 0) if plane == "left" else V(0, 0, 1)
        uvs = [(0, 0), (1, 0), (1, 1), (0, 1)]
        if face.normal.dot(want) < 0:
            face.normal_flip()
        uv = bm.loops.layers.uv.new("UVMap")
        for loop in face.loops:
            co = loop.vert.co
            if plane == "left":
                u = ((-co.y) - a0) / (a1 - a0)
                if face.normal.x > 0:
                    u = 1 - u
            else:
                u = (co.x - a0) / (a1 - a0)
            v = (co.z - b0) / (b1 - b0)
            loop[uv].uv = (u, 1 - v if flip else v)
        C._mark_all(bm)
        C.finish(name, bm, [m[f"leak{k}"]], C.collection(STATIC), props={"runtime": "decal"})


# ---------------------------------------------------------------------------
# Lights and cameras (used by bake.py and render_preview.py)


def lights():
    coll = C.collection("Lights")
    world = bpy.data.worlds.new("Night")
    bpy.context.scene.world = world
    nodes = world.node_tree.nodes
    nodes["Background"].inputs["Color"].default_value = (0.02, 0.035, 0.06, 1.0)
    nodes["Background"].inputs["Strength"].default_value = 1.0

    # Moonlight falls steeply enough that the blind stripes land beside the chair, in frame.
    # The web scene's window light shaft is drawn along MOON_DIR too.
    moon = bpy.data.lights.new("Moon", "SUN")
    moon.color = (0.56, 0.7, 0.9)
    moon.energy = 4.0
    moon.angle = math.radians(0.6)
    o = bpy.data.objects.new("Moon", moon)
    direction = V(*MOON_DIR).normalized()
    o.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    coll.objects.link(o)

    lamp = bpy.data.lights.new("LampLight", "POINT")
    lamp.color = (1.0, 1.0, 1.0)
    lamp.energy = 12.0
    lamp.shadow_soft_size = 0.012
    o = bpy.data.objects.new("LampLight", lamp)
    o.location = V(*LAMP_BULB)
    coll.objects.link(o)

    screen = bpy.data.lights.new("ScreenLight", "AREA")
    screen.shape = "RECTANGLE"
    screen.size, screen.size_y = CRT["screen"]
    screen.color = (1.0, 1.0, 1.0)
    screen.energy = 4.0
    o = bpy.data.objects.new("ScreenLight", screen)
    o.location = V(CRT["x"], DESK["top"] + 0.055 + CRT["h"] / 2 + 0.01, CRT["front"] + 0.03)
    o.rotation_euler = V(0, 0, 1).to_track_quat("-Z", "Y").to_euler()
    coll.objects.link(o)

    # The bulb's glass and filament must not shadow their own light.
    for name in ("Lamp_Bulb", "Lamp_Filament", "CRT_Screen"):
        bpy.data.objects[name].visible_shadow = False


def cameras():
    coll = C.collection("Cameras")
    data = bpy.data.cameras.new("RoomCam")
    data.sensor_fit = "VERTICAL"
    data.angle_y = math.radians(50)
    data.clip_start = 0.05
    cam = bpy.data.objects.new("RoomCam", data)
    cam.location = V(1.6, 1.75, 2.6)
    cam.rotation_euler = (V(-0.25, 1.0, -1.0) - cam.location).to_track_quat("-Z", "Y").to_euler()
    coll.objects.link(cam)
    scene = bpy.context.scene
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720

    pano = bpy.data.cameras.new("ProbeCam")
    pano.type = "PANO"
    pano.panorama_type = "EQUIRECTANGULAR"
    probe = bpy.data.objects.new("ProbeCam", pano)
    probe.location = V(CRT["x"], 1.05, -0.3)
    # three.js reads equirect maps with +X in the middle: face the camera that way.
    probe.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
    coll.objects.link(probe)


def build():
    C.reset_scene()
    m = build_materials()
    shell(m)
    window(m)
    blinds(m)
    radiator(m)
    desk(m)
    crt(m)
    keyboard_and_mouse(m)
    desk_props(m)
    lamp(m)
    chair(m)
    rug(m)
    floor_clutter(m)
    shelf_and_cabinet(m)
    pc(m)
    cables(m)
    wall_details(m)
    cobwebs(m)
    stains(m)
    lights()
    cameras()
    # The web reads these from the GLB (scene.userData), so both sides use one set of numbers.
    bpy.context.scene["lamp_bulb"] = list(LAMP_BULB)
    bpy.context.scene["moon_dir"] = list(MOON_DIR)
    C.save_blend(C.SOURCE / "room.blend")
    print("room objects:", len(C.collection(STATIC).objects))


if __name__ == "__main__":
    build()
