"""Renders the character in each of its poses, front and back, and its face (Eevee).

    Blender -b blender/source/character.blend -P blender/scripts/character_preview.py

Writes one sheet, blender/previews/character.png: a column per pose (front above, back
below) and the face on the right.
"""

import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

import common as C  # noqa: E402
import textures as T  # noqa: E402

CELL = (320, 400)

POSES = {"Stand": 0.25, "SitType": 0.3, "Fall": 0.2, "SitHunched": 0.4, "StandUp": 0.45}


def stage():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = CELL
    scene.view_settings.view_transform = "AgX"
    scene.render.fps = 24
    world = bpy.data.worlds.new("Preview")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.3, 0.31, 0.33, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.35
    for name, loc, energy in (("Key", (1.6, -2.2, 2.4), 140), ("Fill", (-2.2, -1.4, 1.4), 45), ("Rim", (0.4, 2.6, 2.2), 110)):
        light = bpy.data.lights.new(name, "AREA")
        light.energy, light.size = energy, 1.5
        obj = bpy.data.objects.new(name, light)
        scene.collection.objects.link(obj)
        obj.location = loc
        obj.rotation_euler = (Vector((0, 0, 1.0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    return scene, cam


def shoot(scene, cam, folder, location, target, lens=50):
    """One render, as an (h, w, 4) array."""
    cam.location = location
    cam.rotation_euler = (Vector(target) - Vector(location)).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = lens
    path = pathlib.Path(folder) / "shot.png"
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    return T.read(path)


def main():
    scene, cam = stage()
    rig = bpy.data.objects["Rig"]
    rig.animation_data_create()
    w, h = CELL
    sheet = np.zeros((2 * h, (len(POSES) + 1) * w, 4), dtype=np.float32)
    with tempfile.TemporaryDirectory() as folder:
        # Rows are stored bottom to top: the front views go in the upper half.
        sheet[h:, -w:] = shoot(scene, cam, folder, (0.22, -0.95, 1.6), (0, 0, 1.56), lens=85)
        for i, (name, t) in enumerate(POSES.items()):
            action = bpy.data.actions[name]
            rig.animation_data.action = action
            if action.slots:
                rig.animation_data.action_slot = action.slots[0]
            scene.frame_set(round(action.frame_start + t * (action.frame_end - action.frame_start)))
            sheet[h:, i * w : (i + 1) * w] = shoot(scene, cam, folder, (1.2, -3.6, 1.2), (0, 0, 0.8))
            sheet[:h, i * w : (i + 1) * w] = shoot(scene, cam, folder, (-1.2, 3.6, 1.3), (0, 0, 0.8))
    # The cell under the face: the backdrop's own colour.
    sheet[:h, -w:] = sheet[0, 0]
    T.write(sheet, C.PREVIEWS / "character.png", fmt="PNG")


if __name__ == "__main__":
    main()
