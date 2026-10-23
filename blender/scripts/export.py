"""Exports the baked room to public/models/room.glb (spec §5.1).

    Blender -b blender/source/room_baked.blend -P blender/scripts/export.py

Only the "Room" collection goes out: bake lights and cameras stay in Blender.
Textures are re-encoded as WebP. Custom properties travel as glTF extras, which
three.js exposes as userData (knock, runtime, atlas, and the scene's lightmaps).
"""

import pathlib
import shutil
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import bpy  # noqa: E402
import numpy as np  # noqa: E402

import common as C  # noqa: E402
import textures as T  # noqa: E402


def smudge_texture():
    """Fingerprints and dust for the CRT glass, packed for the web: R smudge, G dust."""
    finger = T._find(C.TEXTURES / "ambientcg" / "Fingerprints002", "Opacity")
    dust = T._find(C.TEXTURES / "ambientcg" / "SurfaceImperfections015", "Opacity")
    if not finger or not dust:
        return
    a = T.resized(T.read(finger), 512)
    b = T.resized(T.read(dust), 512)
    out = np.ones_like(a)
    out[..., 0] = a[..., 0]
    out[..., 1] = b[..., 0]
    out[..., 2] = 0.0
    path = C.PUBLIC_MODELS / "crt-smudge.webp"
    img = bpy.data.images.new(path.stem, 512, 512, alpha=False)
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(out.ravel())
    img.filepath_raw = str(path)
    img.file_format = "WEBP"
    bpy.context.scene.render.image_settings.quality = 90
    img.save()


def main():
    room = [o for o in C.collection("Room").objects]
    C.select_only(room)
    out = C.PUBLIC_MODELS / "room.glb"
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(out),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_extras=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_image_format="WEBP",
        export_image_quality=88,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_yup=True,
    )
    smudge_texture()
    print("exported:", out, f"{out.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
