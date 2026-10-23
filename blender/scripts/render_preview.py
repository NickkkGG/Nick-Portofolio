"""Renders review images of a built .blend from its web camera (spec §10).

    Blender -b blender/source/room.blend -P blender/scripts/render_preview.py -- room [samples]

Writes blender/previews/<name>.png with every light on, as the room looks with the
lamp burning steady.
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import bpy  # noqa: E402

import common as C  # noqa: E402


def main():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    name = args[0] if args else "room"
    samples = int(args[1]) if len(args) > 1 else 128
    C.use_gpu()
    scene = bpy.context.scene
    scene.camera = bpy.data.objects["RoomCam"]
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    scene.render.image_settings.file_format = "PNG"
    # Roughly the web's exposure, so previews read like the site.
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = 0.6
    out = C.PREVIEWS / f"{name}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(out)
    bpy.ops.render.render(write_still=True)
    print("preview:", out)


if __name__ == "__main__":
    main()
