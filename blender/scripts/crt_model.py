"""The beige 19" CRT, shared by the room's desk monitor and the project world's hanging ones.

Positions are three.js metres. The screen faces +Z: its front plane sits at z = front, the
casing's bottom at y = bottom, centred on x. Material indices: casing 0 = beige plastic,
1 = black plastic.
"""

import math

import common as C
from common import V

SIZE = {"w": 0.46, "h": 0.43, "depth": 0.46, "screen": (0.372, 0.286)}
SHELL = 0.11  # depth of the front shell around the tube


def casing(bm, x, bottom, front, foot_top=None):
    """Front shell, funnel-shaped tube housing, vents and controls; a swivel foot when it stands."""
    w, h, depth = SIZE["w"], SIZE["h"], SIZE["depth"]
    yc = bottom + h / 2
    if foot_top is not None:
        C.box(bm, (0.3, 0.022, 0.28), (x, foot_top + 0.011, front - 0.23), bevel=0.01, segments=3)
        C.box(bm, (0.17, 0.035, 0.15), (x, foot_top + 0.035, front - 0.23), bevel=0.012, segments=3)
    C.box(bm, (w, h, SHELL), (x, yc, front - SHELL / 2), bevel=0.02, segments=3)
    verts = C.box(bm, (w * 0.94, h * 0.92, depth - SHELL), (x, yc - 0.005, front - SHELL - (depth - SHELL) / 2 + 0.01), bevel=0.03, segments=3)
    back = front - depth
    for v in verts:
        p = v.co  # Blender coordinates: three.js z = -p.y
        t = max(0.0, min(1.0, ((-p.y) - (front - SHELL)) / (back - (front - SHELL))))
        p.x = x + (p.x - x) * (1.0 - 0.36 * t)
        p.z = (yc - 0.02 * t) + (p.z - yc) * (1.0 - 0.4 * t)
    # Vent slots on top of the housing, following its slope.
    for i in range(9):
        z = front - 0.17 - i * 0.022
        t = (z - (front - SHELL)) / (back - (front - SHELL))
        y_top = yc - 0.005 - 0.02 * t + 0.46 * h * (1.0 - 0.4 * t)
        C.box(bm, (0.2 * (1.0 - 0.36 * t), 0.006, 0.008), (x, y_top - 0.002, z), material=1)
    # Control strip under the screen: power button, four small buttons, a badge.
    C.box(bm, (0.03, 0.016, 0.01), (x + w / 2 - 0.06, bottom + 0.028, front + 0.002), bevel=0.003, material=0)
    for i in range(4):
        C.box(bm, (0.014, 0.008, 0.006), (x - 0.08 + i * 0.024, bottom + 0.028, front + 0.001), bevel=0.002, material=1)
    C.box(bm, (0.07, 0.014, 0.004), (x - w / 2 + 0.07, bottom + 0.03, front + 0.001), material=1)


def led(bm, x, bottom, front):
    C.sphere(bm, 0.0035, (x + SIZE["w"] / 2 - 0.1, bottom + 0.028, front + 0.002), segments=8, rings=4)


def bezel(bm, x, bottom, front, material=0):
    """The dark recessed frame between the shell and the curved glass."""
    sw, sh = SIZE["screen"]
    yc = bottom + SIZE["h"] / 2 + 0.01
    inset = 0.016
    ow, oh = sw + 0.05, sh + 0.05
    z = front + 0.001
    for cx, cy, bw, bh in [
        (x, yc + (oh + sh) / 4, ow, (oh - sh) / 2),
        (x, yc - (oh + sh) / 4, ow, (oh - sh) / 2),
        (x - (ow + sw) / 4, yc, (ow - sw) / 2, sh),
        (x + (ow + sw) / 4, yc, (ow - sw) / 2, sh),
    ]:
        C.box(bm, (bw, bh, inset), (cx, cy, z - inset / 2), bevel=0.002, material=material)


def glass(bm, x, bottom, front, material=0):
    """Curved glass: a cap of a 1.2 m sphere, with UVs 0..1 for the screen shaders."""
    sw, sh = SIZE["screen"]
    y_mid = bottom + SIZE["h"] / 2 + 0.01
    r = 1.2

    def point(u, v):
        dx, dy = (u - 0.5) * sw, (v - 0.5) * sh
        bulge = r - math.sqrt(r * r - dx * dx - dy * dy)
        return (x + dx, y_mid + dy, front - 0.006 - bulge + 0.024)

    rows = [[bm.verts.new(V(*point(i / 16, j / 12))) for i in range(17)] for j in range(13)]
    uv_layer = bm.loops.layers.uv.get("UVMap") or bm.loops.layers.uv.new("UVMap")
    for j in range(12):
        for i in range(16):
            f = bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
            f.material_index = material
            for loop, (u, v) in zip(f.loops, [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]):
                loop[uv_layer].uv = (u / 16, v / 12)
    C._mark_all(bm)
