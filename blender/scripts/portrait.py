"""Renders the character's portrait for the first slide in the booth, until there is a photo.

    Blender -b blender/source/character.blend -P blender/scripts/portrait.py

A head-and-shoulders studio shot against a mottled painted backdrop, the kind an old
portrait studio hung behind its sitters. Writes public/models/portrait.webp (square).
"""

import math
import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import common as C  # noqa: E402
import textures as T  # noqa: E402

SIZE = 768


def backdrop(scene):
    """A painted canvas behind the sitter: blotches of blue-grey, lighter where the light falls."""
    bpy.ops.mesh.primitive_plane_add(size=4.0, location=(0.0, 1.1, 1.3), rotation=(math.radians(90), 0.0, 0.0))
    plane = bpy.context.active_object
    mat = bpy.data.materials.new("Backdrop")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.95
    coord = nodes.new("ShaderNodeTexCoord")
    blotch = nodes.new("ShaderNodeTexNoise")
    blotch.inputs["Scale"].default_value = 2.2
    blotch.inputs["Detail"].default_value = 6.0
    blotch.inputs["Roughness"].default_value = 0.62
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.3
    ramp.color_ramp.elements[0].color = (0.035, 0.05, 0.06, 1)
    ramp.color_ramp.elements[1].position = 0.72
    ramp.color_ramp.elements[1].color = (0.1, 0.13, 0.14, 1)
    grain = nodes.new("ShaderNodeTexNoise")
    grain.inputs["Scale"].default_value = 140.0
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    links.new(coord.outputs["Object"], blotch.inputs["Vector"])
    links.new(blotch.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(coord.outputs["Object"], grain.inputs["Vector"])
    links.new(grain.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    plane.data.materials.append(mat)


def lights(scene):
    """Warm key high on the left, a dim teal fill, and a rim from behind to lift the hair off the backdrop."""
    for name, loc, energy, size, color in (
        ("Key", (-1.5, -1.0, 2.1), 170, 1.0, (1.0, 0.88, 0.74)),
        ("Fill", (1.5, -1.2, 1.3), 12, 1.8, (0.62, 0.86, 0.88)),
        ("Rim", (0.7, 0.9, 2.1), 120, 0.8, (0.9, 0.95, 1.0)),
        ("Wash", (0.0, -0.4, 0.5), 8, 1.5, (0.7, 0.85, 0.9)),
    ):
        light = bpy.data.lights.new(name, "AREA")
        light.energy, light.size, light.color = energy, size, color
        obj = bpy.data.objects.new(name, light)
        scene.collection.objects.link(obj)
        obj.location = loc
        aim = Vector((0.0, 1.1, 1.4)) if name == "Wash" else Vector((0.0, 0.0, 1.5))
        obj.rotation_euler = (aim - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


def main():
    scene = bpy.context.scene
    C.use_gpu()
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 128
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = SIZE
    scene.view_settings.view_transform = "AgX"
    world = bpy.data.worlds.new("Studio")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.02, 0.025, 0.028, 1)
    rig = bpy.data.objects["Rig"]
    rig.animation_data_create()
    action = bpy.data.actions["Stand"]
    rig.animation_data.action = action
    if action.slots:
        rig.animation_data.action_slot = action.slots[0]
    scene.frame_set(round(action.frame_start + 0.25 * (action.frame_end - action.frame_start)))
    backdrop(scene)
    lights(scene)
    cam = bpy.data.objects.new("PortraitCam", bpy.data.cameras.new("PortraitCam"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    # Three quarters from the sitter's right, a little above the eyes, on a long lens.
    cam.location = (0.62, -1.75, 1.62)
    cam.rotation_euler = (Vector((0.0, 0.0, 1.47)) - Vector(cam.location)).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 85
    with tempfile.TemporaryDirectory() as folder:
        path = pathlib.Path(folder) / "portrait.png"
        scene.render.filepath = str(path)
        scene.render.image_settings.file_format = "PNG"
        bpy.ops.render.render(write_still=True)
        T.write(T.read(path), C.PUBLIC_MODELS / "portrait.webp", fmt="WEBP", quality=88)
    print("portrait:", C.PUBLIC_MODELS / "portrait.webp")


if __name__ == "__main__":
    main()
