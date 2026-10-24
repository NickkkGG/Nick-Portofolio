"""Builds booth.glb: the projection booth caught in the cables across from the first monitor.

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/scripts/booth.py

The visitor falls through its roof after the room, and the about slides play on its sheet
(src/experience/chapters/booth). It is a shed of old boards with gaps between them, a window
cut toward the first monitor, a corrugated roof the figure has just crashed through, an old
carousel projector on a stack of boxes and the sheet it projects on, pegged to a rope.

The numbers below copy src/experience/chapters/booth/layout.ts. Light comes from the web
(the projector is a realtime light); the booth's ambient occlusion is baked into
booth-ao.webp on a second UV map, so that light falls into dark corners and gaps.
"""

import math
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import bmesh  # noqa: E402
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

import art  # noqa: E402
import bake  # noqa: E402
import common as C  # noqa: E402
import textures as T  # noqa: E402
from common import V  # noqa: E402

COLL = "Booth"
# The AO is baked at twice the size it ships at: four samples averaged into every texel.
AO_SIZE = 2048

# src/experience/chapters/booth/layout.ts
FLOOR_Y = -85.2
CEILING_Y = -82.6
HALF_W = 1.6
FRONT_Z = 11.2
BACK_Z = 14.4
WINDOW_Y = -84.0
WINDOW_W, WINDOW_H = 1.9, 1.3
SHEET_Z = 11.35
SHEET_W, SHEET_H = 2.3, 1.6
LENS = (0.3, -84.0, 13.9)
SEAT = (-0.55, FLOOR_Y, 12.9)
ROOF_HOLE = (-1.1, CEILING_Y, 13.9)

BOARD = 0.03
SEAT_HEIGHT = 0.46
HOLE_RADIUS = 0.55


def materials():
    ph, acg = T.polyhaven, T.ambientcg
    # A thousand pixels across is already finer than the screen shows these surfaces, even up close.
    wood = ph("wood_table_worn", size=1024)
    rust = ph("green_metal_rust", size=1024)
    carpet = ph("dirty_carpet", size=1024)
    cardboard = acg("Cardboard003")
    paper = acg("Paper003")
    plastic = acg("Plastic018B", size=1024)
    black = acg("Plastic012B")
    m = {}
    m["boards"] = C.material("BoothBoards", (0.3, 0.24, 0.17), 0.85, textures=T.with_color(wood, T.tinted(wood["color"], "booth_boards", (0.8, 0.74, 0.66), contrast=1.15, size=1024)), tile=0.9)
    m["boards_grey"] = C.material("BoothBoardsGrey", (0.24, 0.22, 0.2), 0.9, textures=T.with_color(wood, T.tinted(wood["color"], "booth_boards_grey", (0.62, 0.6, 0.57), contrast=1.25, size=1024)), tile=0.9)
    m["beams"] = C.material("BoothBeams", (0.16, 0.12, 0.09), 0.9, textures=T.with_color(wood, T.tinted(wood["color"], "booth_beams", (0.46, 0.4, 0.34), contrast=1.2, size=1024)), tile=0.6)
    m["crate"] = C.material("BoothCrate", (0.42, 0.34, 0.24), 0.8, textures=T.with_color(wood, T.tinted(wood["color"], "booth_crate", (1.0, 0.92, 0.8), size=1024)), tile=0.5)
    m["roof"] = C.material("BoothRoofMetal", (0.18, 0.2, 0.16), 0.6, metallic=1.0, textures=rust, tile=1.4)
    m["mattress"] = C.material(
        "BoothMattress", (0.48, 0.45, 0.38), 0.95, textures=T.with_color(carpet, T.tinted(carpet["color"], "booth_mattress", (1.0, 0.98, 0.9), add=(0.1, 0.09, 0.07), contrast=0.8, size=1024)), tile=0.7
    )
    m["cardboard"] = C.material("BoothCardboard", (0.45, 0.34, 0.2), 0.85, textures=cardboard, tile=0.45)
    m["projector"] = C.material(
        "ProjectorBody", (0.5, 0.48, 0.44), 0.45, textures=T.with_color(plastic, T.tinted(plastic.get("color"), "projector_grey", (0.86, 0.85, 0.82), size=1024)), tile=0.3
    )
    m["dark"] = C.material("ProjectorBlack", (0.03, 0.03, 0.03), 0.45, textures=black, tile=0.2)
    m["lens"] = C.material("ProjectorLens", (0.05, 0.06, 0.07), 0.05, props={"runtime": "booth-lens"})
    m["metal"] = C.material("BoothMetal", (0.3, 0.31, 0.29), 0.45, metallic=1.0, textures=rust, tile=0.3)
    m["sheet"] = C.material("BoothSheet", (0.86, 0.84, 0.8), 0.95, textures={"normal": paper.get("normal")}, props={"runtime": "booth-sheet"})
    m["rope"] = C.material("BoothRope", (0.45, 0.36, 0.24), 0.95, textures=cardboard, tile=0.08)
    m["pin"] = C.material("ClothesPeg", (0.6, 0.5, 0.36), 0.7, textures=T.with_color(wood, T.tinted(wood["color"], "booth_peg", (1.25, 1.12, 0.95), size=512)), tile=0.06)
    m["slide"] = C.material("SlideMount", (0.82, 0.8, 0.75), 0.6, textures=T.with_color(paper, T.tinted(paper.get("color"), "slide_mount", (1.05, 1.03, 0.98), size=512)), tile=0.05)
    m["cable"] = C.material("BoothCable", (0.025, 0.025, 0.027), 0.5, textures=black, tile=0.4)
    m["bulb"] = C.material("DeadBulb", (0.12, 0.11, 0.1), 0.1, alpha_blend=True, alpha=0.6)
    for i, (hub, triangle) in enumerate([((0.3, 0.32), True), ((0.36, 0.3), True), ((0.5, 0.55), False)]):
        m[f"web{i}"] = C.material(
            f"BoothCobweb{i}", (0.8, 0.8, 0.78), 0.6, textures={"alpha": art.cobweb(art.OUT / f"booth_cobweb{i}.png", seed=80 + i, hub=hub, triangle=triangle)}, props={"runtime": "cobweb"}
        )
    return m


# ---------------------------------------------------------------------------
# Boards with their own grain: each plank gets UVs running along it, from a random spot in the texture.


def plank(bm, rng, size, center, rot=(0.0, 0.0, 0.0), material=0, tile=0.9):
    """A board of three.js size (w, h, d): grain along its longest side, a random patch of wood per board."""
    geom = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=C.D(*size), verts=geom["verts"])
    uv = bm.loops.layers.uv.get("UVMap") or bm.loops.layers.uv.new("UVMap")
    long_axis = max(range(3), key=lambda k: size[k])
    ou, ov = rng.random() * 7, rng.random() * 7
    for face in {f for v in geom["verts"] for f in v.link_faces}:
        face.material_index = material
        face.normal_update()
        n = face.normal
        normal_axis = max(range(3), key=lambda k: abs((n.x, n.z, -n.y)[k]))
        in_plane = [k for k in range(3) if k != normal_axis]
        u_axis = long_axis if long_axis in in_plane else in_plane[0]
        v_axis = [k for k in in_plane if k != u_axis][0]
        for loop in face.loops:
            co = loop.vert.co
            local = (co.x, co.z, -co.y)
            loop[uv].uv = (local[u_axis] / tile + ou, local[v_axis] / tile + ov)
    return C._place(bm, center, rot, None)


def wall_of_boards(bm, rng, along, lo, hi, depth_at, around_window=False, mats=(0, 1)):
    """Vertical boards from `lo` to `hi` along x (along='x') or z (along='z'), standing at `depth_at`.

    Gaps of a few millimetres between them, a slight lean on some, now and then one broken
    off short of the roof. around_window leaves the window's hole in the front wall.
    """
    pos = lo
    while pos < hi - 0.02:
        width = min(0.12 + rng.random() * 0.09, hi - pos)
        mid = pos + width / 2
        material = mats[1] if rng.random() < 0.3 else mats[0]
        lean = (rng.random() - 0.5) * 0.012
        top = CEILING_Y + 0.12
        if rng.random() < 0.12:
            top -= 0.06 + rng.random() * 0.2
        spans = [(FLOOR_Y - 0.05, top)]
        if around_window:
            spans = [(FLOOR_Y - 0.05, WINDOW_Y - WINDOW_H / 2), (WINDOW_Y + WINDOW_H / 2, top)]
        for y0, y1 in spans:
            h = y1 - y0
            if along == "x":
                plank(bm, rng, (width - 0.006, h, BOARD), (mid, (y0 + y1) / 2, depth_at), rot=(0.0, 0.0, lean), material=material)
            else:
                plank(bm, rng, (BOARD, h, width - 0.006), (depth_at, (y0 + y1) / 2, mid), rot=(lean, 0.0, 0.0), material=material)
        pos += width + 0.003 + rng.random() * 0.01


def shell(bm, rng):
    """Walls, floor, posts and rails: the shed itself."""
    x_out, z_front, z_back = HALF_W + BOARD, FRONT_Z - BOARD, BACK_Z + BOARD
    hw = WINDOW_W / 2
    # The front wall in three runs, so the boards over and under the window end exactly at its sides.
    wall_of_boards(bm, rng, "x", -x_out, -hw, FRONT_Z - BOARD / 2)
    wall_of_boards(bm, rng, "x", -hw, hw, FRONT_Z - BOARD / 2, around_window=True)
    wall_of_boards(bm, rng, "x", hw, x_out, FRONT_Z - BOARD / 2)
    wall_of_boards(bm, rng, "x", -x_out, x_out, BACK_Z + BOARD / 2)
    wall_of_boards(bm, rng, "z", z_front, z_back, -HALF_W - BOARD / 2)
    wall_of_boards(bm, rng, "z", z_front, z_back, HALF_W + BOARD / 2)
    # Floor boards running front to back, on two joists.
    pos = -HALF_W
    while pos < HALF_W - 0.02:
        width = min(0.14 + rng.random() * 0.06, HALF_W - pos)
        plank(bm, rng, (width - 0.005, BOARD, z_back - z_front), (pos + width / 2, FLOOR_Y - BOARD / 2, (z_front + z_back) / 2), material=2 if rng.random() < 0.4 else 0)
        pos += width + 0.004
    for z in (FRONT_Z + 0.4, BACK_Z - 0.4):
        plank(bm, rng, (2 * x_out + 0.1, 0.12, 0.08), (0.0, FLOOR_Y - BOARD - 0.06, z), material=2, tile=0.6)
    # Corner posts, and the rails the boards are nailed to.
    for x in (-HALF_W + 0.04, HALF_W - 0.04):
        for z in (FRONT_Z + 0.04, BACK_Z - 0.04):
            plank(bm, rng, (0.08, CEILING_Y - FLOOR_Y, 0.08), (x, (CEILING_Y + FLOOR_Y) / 2, z), material=2, tile=0.6)
    for y in (FLOOR_Y + 0.28, CEILING_Y - 0.22):
        for x in (-HALF_W + 0.02, HALF_W - 0.02):
            plank(bm, rng, (0.04, 0.08, BACK_Z - FRONT_Z - 0.16), (x, y, (FRONT_Z + BACK_Z) / 2), material=2, tile=0.6)
        plank(bm, rng, (2 * HALF_W - 0.16, 0.08, 0.04), (0.0, y, BACK_Z - 0.02), material=2, tile=0.6)
        # Both rails pass under and over the window.
        plank(bm, rng, (2 * HALF_W - 0.16, 0.08, 0.04), (0.0, y, FRONT_Z + 0.02), material=2, tile=0.6)
    # The window: a rough frame round the hole sawn in the boards.
    hh = WINDOW_H / 2
    for y in (WINDOW_Y - hh - 0.025, WINDOW_Y + hh + 0.025):
        plank(bm, rng, (WINDOW_W + 0.1, 0.05, 0.09), (0.0, y, FRONT_Z - 0.01), material=0)
    for x in (-hw - 0.025, hw + 0.025):
        plank(bm, rng, (0.05, WINDOW_H, 0.09), (x, WINDOW_Y, FRONT_Z - 0.01), material=0)


def in_hole(x, z, margin=0.0):
    """Whether (x, z) is inside the roof hole, its edge ragged rather than round."""
    dx, dz = x - ROOF_HOLE[0], z - ROOF_HOLE[2]
    a = math.atan2(dz, dx)
    ragged = HOLE_RADIUS * (1 + 0.22 * math.sin(3 * a + 1.3) + 0.12 * math.sin(7 * a + 0.4))
    return math.hypot(dx, dz) < ragged + margin


def roof(bm, rng):
    """Joists, roof boards on them, splintered round the hole the figure fell through."""
    for z in (FRONT_Z + 0.3, 12.1, 12.95, 13.75):
        x = -HALF_W - BOARD
        pieces = [(x, HALF_W + BOARD)]
        if abs(z - ROOF_HOLE[2]) < HOLE_RADIUS:
            # This joist snapped: two stubs, one hanging down into the booth.
            half = math.sqrt(max(0.0, HOLE_RADIUS**2 - (z - ROOF_HOLE[2]) ** 2))
            pieces = [(x, ROOF_HOLE[0] - half), (ROOF_HOLE[0] + half + 0.1, HALF_W + BOARD)]
            plank(bm, rng, (0.5, 0.12, 0.07), (ROOF_HOLE[0] - half + 0.12, CEILING_Y - 0.12, z), rot=(0.0, 0.0, -0.9), material=2, tile=0.6)
        for x0, x1 in pieces:
            plank(bm, rng, (x1 - x0, 0.12, 0.07), ((x0 + x1) / 2, CEILING_Y + 0.06, z), material=2, tile=0.6)
    z0, z1 = FRONT_Z - BOARD - 0.08, BACK_Z + BOARD + 0.08
    pos = -HALF_W - BOARD - 0.06
    while pos < HALF_W + BOARD + 0.04:
        width = 0.15 + rng.random() * 0.05
        x = pos + width / 2
        # Each board runs front to back; where it crosses the hole it is broken off, ragged.
        cuts = [z for z in np.linspace(z0, z1, 120) if in_hole(x, z)]
        segments = [(z0, z1)]
        if cuts:
            segments = [(z0, min(cuts) - rng.random() * 0.06), (max(cuts) + rng.random() * 0.06, z1)]
        for a, b in segments:
            if b - a > 0.05:
                plank(bm, rng, (width - 0.005, BOARD, b - a), (x, CEILING_Y + 0.12 + BOARD / 2, (a + b) / 2), material=0 if rng.random() < 0.6 else 1)
        if cuts and rng.random() < 0.6:
            # A broken end hanging down through the hole.
            plank(bm, rng, (width - 0.01, BOARD, 0.25 + rng.random() * 0.2), (x, CEILING_Y - 0.02, max(cuts) - 0.12), rot=(1.0 + rng.random() * 0.4, 0.0, 0.0), material=0)
        pos += width + 0.004


def corrugated(bm, rng):
    """Two corrugated sheets on top, torn open round the hole."""
    for x0, x1, tilt in ((-HALF_W - 0.12, 0.25, 0.012), (0.1, HALF_W + 0.12, -0.008)):
        def point(u, v, x0=x0, x1=x1, tilt=tilt):
            x = x0 + (x1 - x0) * u
            # v runs toward -Z so the faces point up.
            z = BACK_Z + 0.16 - (BACK_Z - FRONT_Z + 0.32) * v
            return (x, CEILING_Y + 0.17 + 0.012 * math.sin(2 * math.pi * x / 0.076) + tilt * (z - FRONT_Z), z)

        cuts_u, cuts_v = int((x1 - x0) / 0.019), 18
        before = set(bm.faces)
        C.sheet(bm, cuts_u, cuts_v, point)
        torn = []
        for face in set(bm.faces) - before:
            c = face.calc_center_median()
            x, z = c.x, -c.y
            if in_hole(x, z, margin=0.05 + 0.08 * rng.random()):
                torn.append(face)
        bmesh.ops.delete(bm, geom=torn, context="FACES")
    C._mark_all(bm)


# ---------------------------------------------------------------------------
# What is in it


def crate(bm, rng, center, size, material=0):
    """A slatted wooden crate: three slats a side, a slatted lid, blocks in the corners."""
    w, h, d = size
    cx, y0, cz = center
    for k in range(3):
        y = y0 + h * (k + 0.5) / 3
        sh = h / 3 - 0.015
        for side in (-1, 1):
            plank(bm, rng, (w, sh, 0.018), (cx, y, cz + side * (d / 2 - 0.009)), material=material, tile=0.5)
            plank(bm, rng, (0.018, sh, d - 0.036), (cx + side * (w / 2 - 0.009), y, cz), material=material, tile=0.5)
    for k in range(4):
        plank(bm, rng, (w, 0.018, d / 4 - 0.01), (cx, y0 + h - 0.009, cz - d / 2 + d * (k + 0.5) / 4), material=material, tile=0.5)
    for sx in (-1, 1):
        for sz in (-1, 1):
            plank(bm, rng, (0.04, h - 0.02, 0.04), (cx + sx * (w / 2 - 0.038), y0 + h / 2, cz + sz * (d / 2 - 0.038)), material=material, tile=0.5)


def props(bm, rng, m_index):
    """The crate the figure sits on, the projector's stack, the mattresses, a shelf of film, slides on the floor."""
    crate(bm, rng, (SEAT[0], FLOOR_Y, SEAT[2]), (0.5, SEAT_HEIGHT, 0.4), material=m_index["crate"])
    # The projector's stand: a crate and two boxes, its top where the projector's feet go.
    stand_x, stand_z = LENS[0], LENS[2] + 0.2
    crate(bm, rng, (stand_x, FLOOR_Y, stand_z), (0.52, 0.45, 0.5), material=m_index["crate"])
    C.box(bm, (0.48, 0.36, 0.42), (stand_x - 0.01, FLOOR_Y + 0.45 + 0.18, stand_z + 0.02), bevel=0.006, rot=(0.0, 0.05, 0.0), material=m_index["cardboard"])
    C.box(bm, (0.44, 0.32, 0.38), (stand_x + 0.01, FLOOR_Y + 0.81 + 0.16, stand_z), bevel=0.006, rot=(0.0, -0.04, 0.0), material=m_index["cardboard"])
    # Two folded mattresses in the back corner, under the hole: where the figure came down.
    for k, (dy, yaw) in enumerate(((0.0, 0.08), (0.17, -0.12))):
        C.box(bm, (0.95, 0.16, 0.9), (ROOF_HOLE[0] + 0.05 * k, FLOOR_Y + 0.08 + dy, ROOF_HOLE[2] - 0.02), bevel=0.06, segments=3, rot=(0.0, yaw, 0.03 * k), material=m_index["mattress"])
    # Splinters and bits of board on them.
    for _ in range(14):
        size = (0.02 + rng.random() * 0.04, 0.012, 0.1 + rng.random() * 0.3)
        at = (ROOF_HOLE[0] + (rng.random() - 0.5) * 0.8, FLOOR_Y + 0.36, ROOF_HOLE[2] + (rng.random() - 0.5) * 0.8)
        plank(bm, rng, size, at, rot=(rng.random() * 0.3, rng.random() * 3, rng.random() * 0.3), material=m_index["boards"])
    # A shelf on the right wall: film cans, a slide-tray box.
    shelf_y = -83.55
    plank(bm, rng, (0.26, 0.025, 1.2), (HALF_W - 0.13, shelf_y, 12.55), material=m_index["boards"])
    for z in (12.1, 13.0):
        plank(bm, rng, (0.025, 0.2, 0.025), (HALF_W - 0.03, shelf_y - 0.11, z), material=m_index["beams"])
    for k in range(4):
        C.cylinder(bm, 0.17, 0.035, (HALF_W - 0.14, shelf_y + 0.03 + 0.036 * k, 12.3 + 0.01 * k), segments=32, material=m_index["metal"])
    C.box(bm, (0.24, 0.09, 0.26), (HALF_W - 0.14, shelf_y + 0.06, 12.85), bevel=0.004, material=m_index["cardboard"])
    # Reels leaning against the wall below it.
    for k in range(3):
        C.cylinder(bm, 0.19 - 0.02 * k, 0.012, (HALF_W - 0.07 - 0.02 * k, FLOOR_Y + 0.19 - 0.02 * k, 12.0 + 0.32 * k), segments=40, rot=(0.0, 0.0, math.pi / 2 - 0.25), material=m_index["metal"])
    # Slides fallen out of a tray, scattered round the stand.
    for _ in range(16):
        at = (0.4 + (rng.random() - 0.5) * 1.6, FLOOR_Y + 0.002, 13.2 + (rng.random() - 0.5) * 1.6)
        C.box(bm, (0.05, 0.003, 0.05), at, rot=(0.0, rng.random() * math.pi, 0.0), material=m_index["slide"])


def projector(bm, m_index):
    """A carousel slide projector, lens toward the sheet: body, round tray, lens barrel, vents, feet."""
    lx, ly, lz = LENS
    base = ly - 0.07
    front = lz + 0.1
    w, h, d = 0.29, 0.13, 0.27
    cz = front + d / 2
    C.box(bm, (w, h, d), (lx, base + h / 2 + 0.012, cz), bevel=0.02, segments=3, material=m_index["projector"])
    C.box(bm, (w - 0.02, 0.012, d - 0.02), (lx, base + 0.006, cz), bevel=0.004, material=m_index["dark"])
    # Vents along both sides.
    for side in (-1, 1):
        for k in range(7):
            C.box(bm, (0.004, 0.012, 0.11), (lx + side * (w / 2 + 0.001), base + 0.04 + 0.014 * k, cz + 0.02), material=m_index["dark"])
    # The round tray on top, with its slots.
    tray_y = base + h + 0.012
    C.lathe(bm, [(0.05, 0.0), (0.135, 0.0), (0.135, 0.055), (0.125, 0.06), (0.06, 0.06), (0.05, 0.05)], (lx, tray_y, cz + 0.01), segments=48, material=m_index["dark"], close_bottom=True)
    for k in range(40):
        a = 2 * math.pi * k / 40
        C.box(bm, (0.002, 0.05, 0.07), (lx + 0.093 * math.sin(a), tray_y + 0.03, cz + 0.01 + 0.093 * math.cos(a)), rot=(0.0, a, 0.0), material=m_index["dark"])
    C.cylinder(bm, 0.03, 0.02, (lx, tray_y + 0.065, cz + 0.01), segments=24, material=m_index["projector"])
    # The lens barrel, its ridged focus ring and the glass.
    C.cylinder(bm, 0.036, 0.11, (lx, ly, front - 0.055), segments=32, rot=(math.pi / 2, 0.0, 0.0), material=m_index["dark"])
    for k in range(6):
        C.cylinder(bm, 0.039, 0.004, (lx, ly, front - 0.02 - 0.006 * k), segments=32, rot=(math.pi / 2, 0.0, 0.0), material=m_index["dark"])
    C.cylinder(bm, 0.03, 0.004, (lx, ly, front - 0.112), segments=32, rot=(math.pi / 2, 0.0, 0.0), material=m_index["lens"])
    # Buttons, the elevation knob, rubber feet.
    for k in range(2):
        C.box(bm, (0.03, 0.012, 0.02), (lx - 0.08 + 0.04 * k, base + h + 0.012, front + 0.03), bevel=0.003, material=m_index["dark"])
    C.cylinder(bm, 0.012, 0.03, (lx, base + 0.004, front + 0.02), segments=12, material=m_index["dark"])
    for sx in (-1, 1):
        for sz in (-1, 1):
            C.cylinder(bm, 0.012, 0.012, (lx + sx * (w / 2 - 0.03), base, cz + sz * (d / 2 - 0.03)), segments=12, material=m_index["dark"])


def sheet(bm):
    """The sheet on its rope: a cotton bedsheet with soft folds, UVs 0..1 for the slides."""
    cx, cy, cz = 0.0, WINDOW_Y, SHEET_Z

    def point(u, v):
        x = cx + (u - 0.5) * SHEET_W
        y = cy + (v - 0.5) * SHEET_H
        sag = 0.012 * (1 - v)
        folds = 0.012 * math.sin(u * 9.0 + 0.6) * (1.2 - v) + 0.006 * math.sin(u * 23.0 + v * 3.0)
        # Pulled up a little between the pegs along the top.
        scallop = 0.018 * max(0.0, v - 0.9) / 0.1 * (0.5 - 0.5 * math.cos(u * 2 * math.pi * 4))
        return (x, y - scallop, cz + folds + sag)

    C.sheet(bm, 36, 26, point)


def pegs(bm):
    """Clothes pegs along the top of the sheet."""
    top = WINDOW_Y + SHEET_H / 2
    for x in (-1.0, -0.5, 0.0, 0.5, 1.0):
        for side in (-1, 1):
            C.box(bm, (0.012, 0.075, 0.008), (x, top + 0.005, SHEET_Z + side * 0.008), bevel=0.002, rot=(side * 0.08, 0.0, 0.0))
        C.cylinder(bm, 0.006, 0.016, (x, top + 0.015, SHEET_Z), segments=8, rot=(math.pi / 2, 0.0, 0.0), material=1)


def rope_points(x0, x1, sag, n=24):
    top = WINDOW_Y + SHEET_H / 2 + 0.035
    return [(x0 + (x1 - x0) * i / n, top - sag * 4 * (i / n) * (1 - i / n), SHEET_Z) for i in range(n + 1)]


def cables(bm, rng):
    """Cables the booth hangs in: over its roof and up into the dark, and a loop slung under the floor."""
    for x, z, lean in ((-HALF_W, FRONT_Z, (-1, -1)), (HALF_W, FRONT_Z, (1, -1)), (-HALF_W, BACK_Z, (-1, 1)), (HALF_W, BACK_Z, (1, 1)), (0.3, 12.7, (0.2, 0.3))):
        top = CEILING_Y + 0.2
        pts = []
        for i in range(40):
            s = i / 39
            y = top + 45 * s**1.3
            pts.append((x + lean[0] * (0.3 * s + 3 * s * s) + 0.2 * math.sin(s * 9 + x), y, z + lean[1] * (0.3 * s + 2.5 * s * s) + 0.2 * math.cos(s * 7 + z)))
        C.tube(bm, pts, 0.035 + rng.random() * 0.03, sides=7, uv_tile=0.5)
    # Two cables draped across the roof, and one slung under the floor.
    for z0, z1, sag in ((FRONT_Z - 0.6, BACK_Z + 0.7, 0.0), (FRONT_Z + 0.5, BACK_Z - 0.2, 0.0)):
        pts = [(-HALF_W - 1.5 + (2 * HALF_W + 3) * i / 30, CEILING_Y + 0.25 + 1.2 * abs(i / 30 - 0.5) ** 2, z0 + (z1 - z0) * i / 30) for i in range(31)]
        C.tube(bm, pts, 0.04, sides=7, uv_tile=0.5)
    pts = [(-HALF_W - 0.6 + (2 * HALF_W + 1.2) * i / 30, FLOOR_Y - 0.12 - 1.4 * math.sin(math.pi * i / 30), 12.4 + 0.6 * i / 30) for i in range(31)]
    C.tube(bm, pts, 0.05, sides=7, uv_tile=0.5)


def dead_bulb(bm, rng):
    """A bare bulb on its flex from the middle of the ceiling, long dead."""
    C.tube(bm, [(0.0, CEILING_Y, 12.6), (0.01, CEILING_Y - 0.2, 12.6), (0.0, CEILING_Y - 0.42, 12.6)], 0.004, sides=6, material=0)
    C.cylinder(bm, 0.017, 0.05, (0.0, CEILING_Y - 0.45, 12.6), segments=16, material=0)
    C.sphere(bm, 0.03, (0.0, CEILING_Y - 0.5, 12.6), segments=16, rings=10, scale=(1.0, 1.3, 1.0), material=1)


def webs(m):
    """Cobwebs in the corners above the sheet and the shelf: thin quads the web lets sway."""
    places = [
        ("Booth_Web_0", (-HALF_W + 0.01, CEILING_Y - 0.01, FRONT_Z + 0.01), (0.6, 0.0, 0.45), "web0"),
        ("Booth_Web_1", (HALF_W - 0.01, CEILING_Y - 0.01, FRONT_Z + 0.01), (-0.55, 0.0, 0.5), "web1"),
        ("Booth_Web_2", (HALF_W - 0.02, -83.5, 12.0), (0.0, 0.0, 0.7), "web2"),
    ]
    for name, corner, (dx, _, dz), key in places:
        bm = C.new_bmesh()
        a = corner
        b = (corner[0] + dx, corner[1], corner[2])
        c = (corner[0], corner[1] - 0.5, corner[2] + dz)
        d = (corner[0] + dx * 0.4, corner[1] - 0.25, corner[2] + dz * 0.4)
        C.polygon(bm, [a, b, d, c])
        obj = C.finish(name, bm, [m[key]], C.collection(COLL), props={"runtime": "cobweb"})
        layer = obj.data.uv_layers.new(name="UVMap")
        for li, uv in enumerate([(0, 1), (1, 1), (0.6, 0.4), (0, 0)]):
            layer.data[li].uv = uv


# ---------------------------------------------------------------------------


def make(name, fn, mats, props=None, smooth=None, uv="box"):
    bm = C.new_bmesh()
    fn(bm)
    obj = C.finish(name, bm, mats, C.collection(COLL), smooth_angle=smooth, props=props)
    if uv == "box":
        C.box_uv(obj, only_unset=True)
    return obj


def sheet_uv(obj):
    """The sheet takes the whole slide: u across, v up."""
    me = obj.data
    layer = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        for li in poly.loop_indices:
            p = me.vertices[me.loops[li].vertex_index].co
            layer.data[li].uv = ((p.x + SHEET_W / 2) / SHEET_W, (p.z - (WINDOW_Y - SHEET_H / 2)) / SHEET_H)


def build():
    C.reset_scene()
    m = materials()
    rng = C.seeded(303)
    order = ["boards", "boards_grey", "beams", "crate", "roof", "mattress", "cardboard", "projector", "dark", "lens", "metal", "slide"]
    mats = [m[k] for k in order]
    index = {k: i for i, k in enumerate(order)}
    make("Booth_Shell", lambda bm: shell(bm, rng), [m["boards"], m["boards_grey"], m["beams"]], props={"ao": 1}, uv="keep")
    make("Booth_Roof", lambda bm: roof(bm, rng), [m["boards"], m["boards_grey"], m["beams"]], props={"ao": 1}, uv="keep")
    make("Booth_RoofMetal", lambda bm: corrugated(bm, rng), [m["roof"]], props={"ao": 1}, smooth=50)
    make("Booth_Props", lambda bm: props(bm, rng, index), mats, props={"ao": 1}, smooth=40)
    make("Booth_Projector", lambda bm: projector(bm, index), mats, props={"ao": 1}, smooth=40)
    sheet_obj = make("Booth_Sheet", sheet, [m["sheet"]], props={"runtime": "booth-sheet"}, smooth=80, uv="none")
    sheet_uv(sheet_obj)
    make("Booth_Pegs", pegs, [m["pin"], m["metal"]], smooth=40)
    make("Booth_Rope", lambda bm: C.tube(bm, rope_points(-HALF_W + 0.02, HALF_W - 0.02, 0.05), 0.007, sides=6, uv_tile=0.06), [m["rope"]], smooth=60, uv="keep")

    def rope_ends(bm):
        top = WINDOW_Y + SHEET_H / 2 + 0.035
        for x, side, length in ((-HALF_W + 0.02, 1, 0.42), (HALF_W - 0.02, -1, 0.28)):
            pts = [(x + side * 0.03 * math.sin(s * 2.5), top - length * s, SHEET_Z + 0.02 * s) for s in [i / 10 for i in range(11)]]
            C.tube(bm, pts, 0.007, sides=6, uv_tile=0.06)
        for x in (-HALF_W + 0.02, HALF_W - 0.02):
            C.cylinder(bm, 0.004, 0.06, (x, top + 0.01, SHEET_Z), segments=8, rot=(0.0, 0.0, math.pi / 2), material=1)

    make("Booth_RopeEnds", rope_ends, [m["rope"], m["metal"]], props={"runtime": "booth-rope-ends"}, smooth=60, uv="keep")
    make("Booth_Cables", lambda bm: cables(bm, rng), [m["cable"]], smooth=60, uv="keep")
    make("Booth_Bulb", lambda bm: dead_bulb(bm, rng), [m["dark"], m["bulb"]], smooth=40)
    webs(m)
    C.save_blend(C.SOURCE / "booth.blend")
    print("booth objects:", [(o.name, len(o.data.polygons)) for o in C.collection(COLL).objects])


def bake_ao():
    """Ambient occlusion of the shed and its contents into one atlas on UV map 'Lightmap'."""
    C.use_gpu()
    objects = [o for o in C.collection(COLL).objects if o.get("ao")]
    bake.lightmap_uvs(objects)
    scene = bpy.context.scene
    scene.world = bpy.data.worlds.new("Ao")
    scene.world.light_settings.distance = 0.35
    scene.cycles.samples = 256
    img = bpy.data.images.new("booth_ao", AO_SIZE, AO_SIZE, alpha=True, float_buffer=True)
    for o in objects:
        for slot in o.material_slots:
            bake.bake_node(slot.material, img)
    C.select_only(objects)
    bpy.ops.object.bake(type="AO", margin=0, use_clear=True, target="IMAGE_TEXTURES")
    px = np.empty(AO_SIZE * AO_SIZE * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(AO_SIZE, AO_SIZE, 4)
    mask = (px[..., 3] > 0.5).astype(np.float32)
    ao = bake.dilate(bake.denoise(px[..., :3], mask), mask)
    out = np.ones_like(px)
    out[..., :3] = np.clip(ao, 0, 1)
    T.write(T.resized(out, AO_SIZE // 2), C.PUBLIC_MODELS / "booth-ao.webp", fmt="WEBP")


def render_preview(samples=48):
    """A Cycles look from the web's camera in the booth, with the projector lit, to check the build."""
    scene = bpy.context.scene
    world = bpy.data.worlds.new("Teal")
    scene.world = world
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.004, 0.02, 0.02, 1)
    coll = C.collection("Preview")
    direction = V(0.0, WINDOW_Y, SHEET_Z) - V(*LENS)
    spot = bpy.data.lights.new("Beam", "SPOT")
    spot.energy = 1500
    spot.spot_size = math.radians(55)
    spot.spot_blend = 0.25
    spot.color = (1.0, 0.86, 0.68)
    beam = bpy.data.objects.new("Beam", spot)
    # Just in front of the lens, or the barrel shades its own beam.
    beam.location = V(*LENS) + direction.normalized() * 0.15
    beam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    coll.objects.link(beam)
    # What the lit sheet throws back into the booth.
    glow = bpy.data.lights.new("Bounce", "AREA")
    glow.energy = 180
    glow.size = 2.0
    glow.color = (1.0, 0.9, 0.78)
    bounce = bpy.data.objects.new("Bounce", glow)
    bounce.location = V(0.0, WINDOW_Y, SHEET_Z + 0.25)
    bounce.rotation_euler = (V(0.0, WINDOW_Y, 14.0) - bounce.location).to_track_quat("-Z", "Y").to_euler()
    coll.objects.link(bounce)
    cam_data = bpy.data.cameras.new("BoothCam")
    # The web's camera: 50 degrees from top to bottom.
    cam_data.sensor_fit = "VERTICAL"
    cam_data.lens_unit = "FOV"
    cam_data.angle = math.radians(50)
    cam = bpy.data.objects.new("BoothCam", cam_data)
    cam.location = V(0.85, -83.5, 14.15)
    cam.rotation_euler = (V(0.0, WINDOW_Y, SHEET_Z) - cam.location).to_track_quat("-Z", "Y").to_euler()
    coll.objects.link(cam)
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "Filmic" if "Filmic" in [t.identifier for t in scene.view_settings.bl_rna.properties["view_transform"].enum_items] else "AgX"
    scene.render.image_settings.file_format = "PNG"
    # Blender writes the .blend's full path into the PNG; the preview is published, the path stays home.
    scene.render.use_stamp_filename = False
    out = C.PREVIEWS / "booth.png"
    scene.render.filepath = str(out)
    bpy.ops.render.render(write_still=True)
    print("preview:", out)
    for o in list(coll.objects):
        bpy.data.objects.remove(o)


def export():
    objs = list(C.collection(COLL).objects)
    C.select_only(objs)
    out = C.PUBLIC_MODELS / "booth.glb"
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
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_yup=True,
    )
    print("exported:", out, f"{out.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    build()
    bake_ao()
    C.save_blend(C.SOURCE / "booth.blend")
    render_preview()
    export()
