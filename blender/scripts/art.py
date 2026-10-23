"""Images the room needs that no texture library has: cobwebs, the poster, notes.

Everything here is generated from code (no downloads), so it is ours to ship.
"""

import math
import pathlib

import bpy
import numpy as np

from common import BUILD, seeded
from textures import read, write

OUT = BUILD / "textures"


class Canvas:
    """Float RGBA canvas with soft, anti-aliased strokes."""

    def __init__(self, width, height, background=(0.0, 0.0, 0.0, 0.0)):
        self.w, self.h = width, height
        self.px = np.zeros((height, width, 4), dtype=np.float32)
        self.px[...] = background

    def stroke(self, points, width_px, color, opacity=1.0):
        """Draws a polyline given in 0..1 canvas coordinates (y up)."""
        if len(points) < 2:
            return
        pts = np.asarray(points, dtype=np.float32) * np.array([self.w - 1, self.h - 1], dtype=np.float32)
        radius = max(0.5, width_px / 2)
        pad = radius + 1.5
        x0, y0 = (np.floor(pts.min(axis=0) - pad)).astype(int)
        x1, y1 = (np.ceil(pts.max(axis=0) + pad)).astype(int)
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, self.w - 1), min(y1, self.h - 1)
        if x1 < x0 or y1 < y0:
            return
        # Coverage = distance from each pixel centre to the nearest segment, inside the stroke's box.
        yy, xx = np.mgrid[y0 : y1 + 1, x0 : x1 + 1].astype(np.float32)
        px, py = xx + 0.5, yy + 0.5
        dist = np.full(xx.shape, np.inf, dtype=np.float32)
        for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
            dx, dy = bx - ax, by - ay
            ll = dx * dx + dy * dy
            t = np.clip(((px - ax) * dx + (py - ay) * dy) / ll, 0.0, 1.0) if ll > 1e-9 else 0.0
            np.minimum(dist, np.hypot(px - (ax + t * dx), py - (ay + t * dy)), out=dist)
        a = np.clip(radius + 0.5 - dist, 0.0, 1.0) * opacity
        region = self.px[y0 : y1 + 1, x0 : x1 + 1]
        rgb = np.array(color[:3], dtype=np.float32)
        region[..., :3] = region[..., :3] * (1 - a[..., None]) + rgb * a[..., None]
        region[..., 3] = np.maximum(region[..., 3], a)

    def save(self, path, fmt="PNG"):
        # Blender stores rows bottom-up, which matches our y-up canvas.
        return write(self.px, path, fmt=fmt)


def _sag(a, b, amount, n=12, wobble=0.0, rng=None):
    """Points of a thread hanging between a and b, drooping by `amount` (canvas units)."""
    pts = []
    for i in range(n + 1):
        t = i / n
        x = a[0] + (b[0] - a[0]) * t
        y = a[1] + (b[1] - a[1]) * t - amount * 4 * t * (1 - t)
        if wobble and rng and 0 < i < n:
            x += (rng.random() - 0.5) * wobble
            y += (rng.random() - 0.5) * wobble
        pts.append((x, y))
    return pts


def _reach(hub, dx, dy, triangle):
    """Distance from the hub along (dx, dy) to the edge of the square, or of the
    lower-left triangle u + v <= 1 that corner webs are mapped onto."""
    hits = []
    if dx > 1e-6:
        hits.append((1 - hub[0]) / dx)
    if dx < -1e-6:
        hits.append(-hub[0] / dx)
    if dy > 1e-6:
        hits.append((1 - hub[1]) / dy)
    if dy < -1e-6:
        hits.append(-hub[1] / dy)
    if triangle and dx + dy > 1e-6:
        hits.append((1 - hub[0] - hub[1]) / (dx + dy))
    return min(hits)


def cobweb(path, seed, hub=(0.32, 0.36), spokes=13, rings=22, tattered=0.25, size=1024, triangle=False):
    """An old orb web, anchored to the card's edges, with broken strands and dust."""
    path = pathlib.Path(path)
    if path.exists():
        return path
    rng = seeded(seed)
    c = Canvas(size, size)
    white = (0.86, 0.85, 0.82)
    angles = sorted(2 * math.pi * (i + rng.random() * 0.5) / spokes for i in range(spokes))
    anchors = []
    for a in angles:
        dx, dy = math.cos(a), math.sin(a)
        t = _reach(hub, dx, dy, triangle) * 0.97
        anchors.append((hub[0] + dx * t, hub[1] + dy * t))
    for end in anchors:
        c.stroke(_sag(hub, end, 0.01 + rng.random() * 0.02, n=16, wobble=0.002, rng=rng), 1.6, white, 0.85)
    # Spiral: thread between neighbouring spokes, ring by ring, slightly sagging.
    for r in range(rings):
        f = 0.06 + 0.9 * (r / rings) ** 1.15
        for i in range(spokes):
            if rng.random() < tattered * (r / rings):
                continue
            a0, a1 = anchors[i], anchors[(i + 1) % spokes]
            p0 = (hub[0] + (a0[0] - hub[0]) * f, hub[1] + (a0[1] - hub[1]) * f)
            p1 = (hub[0] + (a1[0] - hub[0]) * f, hub[1] + (a1[1] - hub[1]) * f)
            c.stroke(_sag(p0, p1, 0.004 + rng.random() * 0.01, n=6), 1.1, white, 0.55 + 0.3 * rng.random())
    # Torn strands that hang loose, and clumps of dust caught in the silk.
    for _ in range(14):
        a = rng.choice(anchors)
        start = (hub[0] + (a[0] - hub[0]) * rng.random(), hub[1] + (a[1] - hub[1]) * rng.random())
        end = (start[0] + (rng.random() - 0.5) * 0.25, start[1] - 0.1 - rng.random() * 0.3)
        c.stroke(_sag(start, end, -0.02, n=10, wobble=0.004, rng=rng), 1.0, white, 0.5)
    for _ in range(90):
        a = rng.choice(anchors)
        f = rng.random()
        x, y = hub[0] + (a[0] - hub[0]) * f, hub[1] + (a[1] - hub[1]) * f
        c.stroke([(x, y), (x + 0.004 * rng.random(), y + 0.004 * rng.random())], 2.5 + 3 * rng.random(), (0.7, 0.68, 0.64), 0.6)
    return c.save(path)


def scribbles(path, seed, lines=4, size=256, paper=(0.93, 0.83, 0.32), ink=(0.12, 0.13, 0.22)):
    """A sticky note with a few hand-written looking lines."""
    path = pathlib.Path(path)
    if path.exists():
        return path
    rng = seeded(seed)
    c = Canvas(size, size, background=(*paper, 1.0))
    for row in range(lines):
        y = 0.78 - row * 0.17
        x = 0.1
        end = 0.45 + rng.random() * 0.45
        pts = []
        while x < end:
            pts.append((x, y + 0.025 * math.sin(x * 70 + rng.random() * 3) * rng.random()))
            x += 0.012 + rng.random() * 0.01
            if rng.random() < 0.08:
                c.stroke(pts, 2.2, ink, 0.85)
                pts = []
                x += 0.04
        c.stroke(pts, 2.2, ink, 0.85)
    # Fold shadow and a coffee ring on one corner.
    c.px[: size // 8, :, :3] *= 0.9
    return c.save(path)


def poster(path, paper_color=None):
    """'DO NOT ADJUST YOUR SET': a test-card poster, rendered with Blender text, then aged."""
    path = pathlib.Path(path)
    if path.exists():
        return path
    width, height = 512, 720
    scene = bpy.data.scenes.new("PosterArt")
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "FLAT"
    scene.display.shading.color_type = "OBJECT"
    scene.view_settings.view_transform = "Standard"
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new("PosterWorld")
    scene.world.color = (0.02, 0.06, 0.06)
    cam_data = bpy.data.cameras.new("PosterCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 1.4
    cam = bpy.data.objects.new("PosterCam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (0, 0, 5)
    scene.camera = cam

    def add(obj, color):
        obj.color = (*color, 1.0)
        scene.collection.objects.link(obj)
        return obj

    bg = bpy.data.meshes.new("bg")
    bg.from_pydata([(-0.5, -0.7, 0), (0.5, -0.7, 0), (0.5, 0.7, 0), (-0.5, 0.7, 0)], [], [(0, 1, 2, 3)])
    add(bpy.data.objects.new("bg", bg), (0.035, 0.11, 0.11))
    # A halftone moon: dots that shrink toward its dark side.
    dots = bpy.data.meshes.new("dots")
    verts, faces = [], []
    step = 0.026
    for iy in range(-12, 13):
        for ix in range(-12, 13):
            x, y = ix * step, 0.17 + iy * step
            d = math.hypot(x, y - 0.17)
            if d > 0.31:
                continue
            light = max(0.0, min(1.0, 0.75 - (x + 0.6 * (y - 0.17)) * 2.2))
            r = step * 0.5 * light
            if r < 0.002:
                continue
            base = len(verts)
            for k in range(10):
                a = 2 * math.pi * k / 10
                verts.append((x + r * math.cos(a), y + r * math.sin(a), 0.01))
            faces.append(tuple(range(base, base + 10)))
    dots.from_pydata(verts, [], faces)
    add(bpy.data.objects.new("dots", dots), (0.86, 0.84, 0.74))

    def text(body, size, y, color, x=0.0, align="CENTER", spacing=1.0, offset=0.0):
        curve = bpy.data.curves.new(body[:12], "FONT")
        curve.body = body
        curve.size = size
        curve.align_x = align
        curve.space_character = spacing
        curve.offset = offset
        obj = bpy.data.objects.new(body[:12], curve)
        obj.location = (x, y, 0.02)
        return add(obj, color)

    cream, red = (0.9, 0.87, 0.76), (0.85, 0.16, 0.12)
    text("DO NOT", 0.17, -0.27, cream, spacing=0.9, offset=0.004)
    text("ADJUST", 0.17, -0.42, cream, spacing=0.9, offset=0.004)
    text("YOUR SET", 0.13, -0.55, red, spacing=0.95, offset=0.003)
    text("BROADCAST ENDS 03:33  ·  CH-03", 0.03, -0.63, cream, spacing=1.1)
    text("WE ARE EXPERIENCING TECHNICAL DIFFICULTIES", 0.022, 0.62, cream, spacing=1.15)
    frame = bpy.data.meshes.new("frame")
    o, i = (0.47, 0.67), (0.455, 0.655)
    frame.from_pydata(
        [(-o[0], -o[1], 0.015), (o[0], -o[1], 0.015), (o[0], o[1], 0.015), (-o[0], o[1], 0.015), (-i[0], -i[1], 0.015), (i[0], -i[1], 0.015), (i[0], i[1], 0.015), (-i[0], i[1], 0.015)],
        [],
        [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)],
    )
    add(bpy.data.objects.new("frame", frame), cream)

    raw = OUT / "poster_raw.png"
    raw.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(raw)
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True, scene=scene.name)
    bpy.data.scenes.remove(scene)

    # Age it: sun-faded, foxed with stains, the ink rubbed off in places.
    art = read(raw)
    rng = np.random.default_rng(7)
    h, w = art.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    blot = np.zeros((h, w), np.float32)
    for _ in range(24):
        cx, cy, r = rng.uniform(0, w), rng.uniform(0, h), rng.uniform(10, 90)
        blot += np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * r * r))) * rng.uniform(0.05, 0.25)
    grain = rng.normal(0.0, 0.035, (h, w)).astype(np.float32)
    rgb = art[..., :3]
    rgb = rgb * 0.82 + 0.06  # fade toward the paper
    rgb *= (1.0 - np.clip(blot, 0, 0.45))[..., None] * np.array([1.0, 0.95, 0.85], np.float32)
    rgb += grain[..., None]
    edge = np.minimum(np.minimum(xx, w - 1 - xx), np.minimum(yy, h - 1 - yy))
    rgb *= (0.75 + 0.25 * np.clip(edge / 40.0, 0, 1))[..., None]
    if paper_color is not None:
        paper = read(paper_color)
        ph, pw = paper.shape[:2]
        tile = paper[np.arange(h) % ph][:, np.arange(w) % pw, :3]
        rgb *= 0.65 + 0.35 * tile / max(tile.mean(), 1e-3)
    art[..., :3] = np.clip(rgb, 0, 1)
    art[..., 3] = 1.0
    return write(art, path)


# Spines on the shelf: titles that fit the story, none of them real books.
BOOKS = [
    ("DEAD AIR", "R. VANCE", (0.32, 0.07, 0.06), "cloth"),
    ("CATHODE", "M. OKAFOR", (0.07, 0.13, 0.22), "cloth"),
    ("SIGNAL / NOISE", "L. HARTMANN", (0.84, 0.8, 0.68), "paperback"),
    ("NIGHT SHIFT", "J. SATO", (0.12, 0.16, 0.1), "cloth"),
    ("THE QUIET ROOM", "E. MORROW", (0.06, 0.06, 0.07), "leather"),
    ("SHADERS", "K. LINDQVIST", (0.62, 0.42, 0.12), "paperback"),
    ("LOW LIGHT", "A. REYES", (0.36, 0.32, 0.26), "cloth"),
    ("OLD TAPES", "D. PRICE", (0.18, 0.1, 0.07), "leather"),
    ("3:33 AM", "N. ADEYEMI", (0.12, 0.26, 0.27), "paperback"),
    ("DEBUGGING", "S. KOVAC", (0.52, 0.12, 0.09), "paperback"),
    ("FIELD NOTES", "H. IBSEN", (0.24, 0.23, 0.17), "cloth"),
    ("ANALOG", "T. MERCER", (0.75, 0.68, 0.48), "cloth"),
    ("LOST FRAMES", "C. DUVAL", (0.09, 0.09, 0.14), "leather"),
    ("STATIC", "P. NOOR", (0.16, 0.3, 0.22), "paperback"),
    ("WHO'S THERE", "UNKNOWN", (0.05, 0.05, 0.05), "cloth"),
    ("HALF-LIFE OF SLEEP", "I. MARSH", (0.42, 0.36, 0.42), "cloth"),
]


def book_atlas(path, paper_color=None):
    """16 book designs, 128 x 1024 px each: the top 3/4 is the spine, the bottom 1/4 a plain cover."""
    path = pathlib.Path(path)
    if path.exists():
        return path
    width, height = 2048, 1024
    scene = bpy.data.scenes.new("BookArt")
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "FLAT"
    scene.display.shading.color_type = "OBJECT"
    scene.view_settings.view_transform = "Standard"
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.world = bpy.data.worlds.new("BookWorld")
    scene.world.color = (0, 0, 0)
    cam_data = bpy.data.cameras.new("BookCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 2.0
    cam = bpy.data.objects.new("BookCam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (0, 0, 5)
    scene.camera = cam
    mono = bpy.data.fonts.load(str(pathlib.Path(bpy.utils.system_resource("DATAFILES")) / "fonts" / "DejaVuSansMono.woff2"), check_existing=True)

    def rect(x0, y0, x1, y1, color, z=0.0):
        me = bpy.data.meshes.new("r")
        me.from_pydata([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], [], [(0, 1, 2, 3)])
        obj = bpy.data.objects.new("r", me)
        obj.color = (*color, 1.0)
        scene.collection.objects.link(obj)

    def text(body, size, x, y, color, font=None, spacing=1.0):
        curve = bpy.data.curves.new("t", "FONT")
        curve.body = body
        curve.size = size
        curve.align_x = "CENTER"
        curve.align_y = "CENTER"
        curve.space_character = spacing
        if font:
            curve.font = font
        obj = bpy.data.objects.new("t", curve)
        obj.location = (x, y, 0.02)
        # English spines read top to bottom.
        obj.rotation_euler = (0, 0, -math.pi / 2)
        obj.color = (*color, 1.0)
        scene.collection.objects.link(obj)

    col = 2.0 / len(BOOKS)
    for k, (title, author, color, kind) in enumerate(BOOKS):
        x0, x1 = -1 + k * col, -1 + (k + 1) * col
        xc = (x0 + x1) / 2
        light = sum(color) / 3 > 0.45
        # Gilt or dark print, whichever shows on this cloth.
        ink = (0.08, 0.07, 0.06) if light else (0.86, 0.78, 0.55)
        author_ink = ink
        rect(x0, -0.5, x1, 0.5, color)
        if kind == "cloth":
            for y in (0.455, 0.44, -0.185, -0.2):
                rect(x0, y - 0.003, x1, y + 0.003, ink, 0.01)
        elif kind == "leather":
            # Raised bands across the spine, and a title label.
            for y in (0.36, 0.2, 0.04, -0.12):
                rect(x0, y - 0.012, x1, y + 0.012, tuple(c * 1.8 + 0.03 for c in color), 0.01)
            rect(x0 + 0.012, 0.23, x1 - 0.012, 0.33, (0.55, 0.12, 0.09), 0.01)
        else:
            # Paperback: a printed band behind the title and a publisher block.
            band = (0.92, 0.9, 0.84) if not light else (0.12, 0.12, 0.13)
            ink = (0.1, 0.09, 0.08) if not light else (0.9, 0.87, 0.78)
            rect(x0, -0.05, x1, 0.4, band, 0.01)
            rect(xc - 0.03, -0.22, xc + 0.03, -0.16, (0.8, 0.25, 0.12), 0.01)
        # Titles fit between the top band and the author line.
        size = min(0.058, 0.44 / (0.62 * len(title)))
        if kind == "leather":
            text(title, min(size, 0.03), xc, 0.28, (0.9, 0.78, 0.45))
        else:
            text(title, size, xc, 0.2, ink)
        text(author, 0.026, xc, -0.1, author_ink, font=mono, spacing=1.1)
        rect(x0, -0.5, x1, -0.25, tuple(c * 0.92 for c in color), 0.005)

    raw = OUT / "book_atlas_raw.png"
    scene.render.filepath = str(raw)
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True, scene=scene.name)
    bpy.data.scenes.remove(scene)

    art = read(raw)
    rng = np.random.default_rng(11)
    h, w = art.shape[:2]
    rgb = art[..., :3]
    xx = np.tile(np.arange(w, dtype=np.float32), (h, 1))
    yy = np.tile(np.arange(h, dtype=np.float32)[:, None], (1, w))
    colw = w / len(BOOKS)
    within = (xx % colw) / colw  # 0..1 across each spine
    # Spines fade in the sun and scuff where hands pull them off the shelf.
    edge = np.minimum(within, 1 - within)
    scuff = np.clip(1 - edge / 0.12, 0, 1) ** 2
    fade = np.repeat(rng.uniform(0.05, 0.3, len(BOOKS)), int(colw))[None, :w]
    # Workbench shows these colours lighter than old cloth looks; deepen them.
    rgb = np.power(np.clip(rgb, 0, 1), 1.35)
    grey = rgb.mean(axis=-1, keepdims=True)
    rgb = rgb * (1 - fade[..., None]) + grey * fade[..., None]
    rgb = rgb + scuff[..., None] * 0.12
    tops = np.clip(1 - np.minimum(yy, h - 1 - yy) / 30.0, 0, 1)
    rgb = rgb * (1 - 0.35 * tops[..., None])
    rgb += rng.normal(0, 0.02, (h, w))[..., None]
    if paper_color is not None:
        paper = read(paper_color)
        ph, pw = paper.shape[:2]
        tile = paper[np.arange(h) % ph][:, np.arange(w) % pw, :3]
        rgb *= 0.75 + 0.25 * tile / max(tile.mean(), 1e-3)
    art[..., :3] = np.clip(rgb, 0, 1)
    art[..., 3] = 1.0
    return write(art, path)


def page_edges(path, size=512):
    """The edge of a page block: hundreds of fine, uneven sheets, grubby where it's handled."""
    path = pathlib.Path(path)
    if path.exists():
        return path
    rng = np.random.default_rng(5)
    rows = 0.9 + 0.1 * rng.random(size)
    rows = np.repeat(rows[:, None], size, axis=1)
    # Every so often a sheet sits proud, catching more light.
    rows += (rng.random((size, 1)) > 0.93) * 0.06
    base = np.array([0.86, 0.81, 0.68], dtype=np.float32)
    px = np.ones((size, size, 4), dtype=np.float32)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    dirt = 0.8 + 0.2 * np.clip(np.minimum(xx, size - 1 - xx) / 60.0, 0, 1)
    spots = np.zeros((size, size), np.float32)
    for _ in range(18):
        cx, cy, r = rng.uniform(0, size), rng.uniform(0, size), rng.uniform(2, 9)
        spots += np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * r * r))) * rng.uniform(0.1, 0.3)
    shade = rows * dirt * (1 - np.clip(spots, 0, 0.4))
    px[..., :3] = base * shade[..., None] * np.array([1.0, 0.97, 0.9], dtype=np.float32)
    return write(px, path)
