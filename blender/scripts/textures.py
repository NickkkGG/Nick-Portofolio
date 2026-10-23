"""Finds the downloaded CC0 texture sets and derives the images the room needs.

Derived images (tinted colours, packed occlusion/roughness/metal maps, generated
art) are written to blender/build/textures and rebuilt whenever they are missing.
"""

import pathlib

import bpy
import numpy as np

from common import BUILD, TEXTURES

OUT = BUILD / "textures"


def read(path):
    img = bpy.data.images.load(str(path), check_existing=False)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(h, w, 4)


def write(pixels, path, fmt="JPEG", quality=92):
    """Saves an (h, w, 4) float array in 0..1 as-is (no colour management)."""
    path = pathlib.Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    h, w = pixels.shape[:2]
    img = bpy.data.images.new(path.stem, w, h, alpha=fmt == "PNG")
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(np.ascontiguousarray(pixels, dtype=np.float32).ravel())
    img.filepath_raw = str(path)
    img.file_format = fmt
    scene = bpy.context.scene
    scene.render.image_settings.quality = quality
    img.save()
    bpy.data.images.remove(img)
    return path


def resized(pixels, size):
    h, w = pixels.shape[:2]
    if w == size:
        return pixels
    step = w // size
    return pixels.reshape(size, step, size, step, 4).mean(axis=(1, 3))


def polyhaven(asset_id, size=None):
    """A Poly Haven set; with `size`, copies scaled down to that many pixels across."""
    folder = TEXTURES / "polyhaven" / asset_id
    maps = {
        "color": folder / f"{asset_id}_diff_2k.jpg",
        "normal": folder / f"{asset_id}_nor_gl_2k.jpg",
        "orm": folder / f"{asset_id}_arm_2k.jpg",
    }
    if size is None or not maps["color"].exists():
        return maps
    return {key: tinted(path, f"{asset_id}_{key}_{size}", size=size) for key, path in maps.items()}


def _find(folder, suffix):
    found = sorted(folder.glob(f"*_{suffix}.jpg")) + sorted(folder.glob(f"*_{suffix}.png"))
    return found[0] if found else None


def ambientcg(asset_id):
    """Colour, normal, alpha as shipped; occlusion/roughness/metal packed into one image."""
    folder = TEXTURES / "ambientcg" / asset_id
    color = _find(folder, "Color")
    rough = _find(folder, "Roughness")
    if not color or not rough:
        return {}
    orm_path = OUT / f"{asset_id}_orm.png"
    if not orm_path.exists():
        r = read(rough)
        ao_path = _find(folder, "AmbientOcclusion")
        metal_path = _find(folder, "Metalness")
        orm = np.ones_like(r)
        orm[..., 0] = read(ao_path)[..., 0] if ao_path else 1.0
        orm[..., 1] = r[..., 0]
        orm[..., 2] = read(metal_path)[..., 0] if metal_path else 0.0
        write(orm, orm_path, fmt="PNG")
    return {
        # Re-saved as RGB: some colour maps ship as greyscale, which WebP export rejects.
        "color": tinted(color, f"{asset_id}_color"),
        "normal": _find(folder, "NormalGL"),
        "orm": orm_path,
        "alpha": _find(folder, "Opacity"),
    }


def tinted(source, name, multiply=(1.0, 1.0, 1.0), add=(0.0, 0.0, 0.0), contrast=1.0, size=None):
    """A recoloured copy of a colour map (values in display space)."""
    if not source or not pathlib.Path(source).exists():
        return None
    path = OUT / f"{name}.jpg"
    if path.exists():
        return path
    px = read(source)
    if size:
        px = resized(px, size)
    rgb = px[..., :3]
    mean = rgb.mean(axis=(0, 1), keepdims=True)
    rgb = (rgb - mean) * contrast + mean
    rgb = rgb * np.array(multiply, dtype=np.float32) + np.array(add, dtype=np.float32)
    px[..., :3] = np.clip(rgb, 0.0, 1.0)
    px[..., 3] = 1.0
    return write(px, path)


def with_color(tex_set, color_path):
    if not tex_set:
        return tex_set
    out = dict(tex_set)
    if color_path:
        out["color"] = color_path
    return out
