"""Builds crt.glb: the hanging CRT reused for every project slot (spec §5.2).

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/scripts/crt.py

The model is the desk monitor (crt_model.py) at true size, screen centred on the origin and
facing +Z, hung from a bracket and a cable that rises 10 m; the web scales it up into the
giants of the project world. Its ambient occlusion is baked into crt-ao.webp on a second UV
map, so the web can darken its creases under any light.
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import bpy  # noqa: E402
import numpy as np  # noqa: E402

import bake  # noqa: E402
import common as C  # noqa: E402
import crt_model  # noqa: E402
import textures as T  # noqa: E402

COLL = "Crt"
AO_SIZE = 1024


def materials():
    plastic = T.ambientcg("Plastic018B")
    black = T.ambientcg("Plastic012B")
    metal = T.polyhaven("green_metal_rust")
    return {
        "beige": C.material("CrtBeige", (0.62, 0.57, 0.45), 0.45, textures=T.with_color(plastic, T.tinted(plastic.get("color"), "plastic_beige", (0.98, 0.88, 0.66))), tile=0.5),
        "black": C.material("CrtBlack", (0.025, 0.025, 0.027), 0.5, textures=black, tile=0.4),
        "metal": C.material("CrtHanger", (0.1, 0.17, 0.12), 0.45, metallic=1.0, textures=metal, tile=0.4),
        "screen": C.material("CrtScreen", (0.02, 0.025, 0.025), 0.1, props={"runtime": "screen"}),
        "led": C.material("PowerLed", (0.1, 0.9, 0.3), 0.3, props={"runtime": "led"}),
    }


def build():
    C.reset_scene()
    m = materials()
    coll = C.collection(COLL)
    h = crt_model.SIZE["h"]
    bottom = -h / 2 - 0.01  # screen centre on the origin
    front = crt_model.SIZE["depth"] / 2

    def make(name, fn, mats, props=None, uv=True):
        bm = C.new_bmesh()
        fn(bm)
        obj = C.finish(name, bm, mats, coll, smooth_angle=35, props=props)
        if uv:
            C.box_uv(obj)
        return obj

    make("CRT_Casing", lambda bm: crt_model.casing(bm, 0.0, bottom, front), [m["beige"], m["black"]])
    make("CRT_Bezel", lambda bm: crt_model.bezel(bm, 0.0, bottom, front), [m["black"]])
    make("CRT_Led", lambda bm: crt_model.led(bm, 0.0, bottom, front), [m["led"]], props={"runtime": "led"})
    make("CRT_Screen", lambda bm: crt_model.glass(bm, 0.0, bottom, front), [m["screen"]], props={"runtime": "screen"}, uv=False)

    top = bottom + h - 0.01

    def hanger(bm):
        # A steel strap over the housing, an eye bolt, and the cable it hangs from.
        C.box(bm, (0.05, 0.006, 0.36), (0.0, top - 0.02, front - 0.24), rot=(0.06, 0, 0))
        C.box(bm, (0.05, 0.16, 0.006), (0.0, top - 0.09, front - 0.06))
        C.box(bm, (0.05, 0.16, 0.006), (0.0, top - 0.1, front - 0.42))
        C.tube(bm, [(0.0, top + 0.01, front - 0.22), (0.0, top + 0.05, front - 0.2), (0.0, top + 0.06, front - 0.24), (0.0, top + 0.01, front - 0.26)], 0.006, sides=6)
        C.tube(bm, [(0.0, top + 0.055, front - 0.23), (0.003, top + 2, front - 0.23), (0.01, top + 6, front - 0.21), (0.0, top + 10, front - 0.2)], 0.013, sides=8, material=1)

    make("CRT_Hanger", hanger, [m["metal"], m["black"]])
    return coll


def bake_ao(coll):
    """Ambient occlusion of casing, bezel and hanger into one atlas on UV map 'Lightmap'."""
    C.use_gpu()
    objects = [o for o in coll.objects if o.name in ("CRT_Casing", "CRT_Bezel", "CRT_Hanger")]
    bake.lightmap_uvs(objects)
    scene = bpy.context.scene
    scene.world = bpy.data.worlds.new("Ao")
    scene.world.light_settings.distance = 0.12
    scene.cycles.samples = 256
    img = bpy.data.images.new("crt_ao", AO_SIZE, AO_SIZE, alpha=True, float_buffer=True)
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
    T.write(out, C.PUBLIC_MODELS / "crt-ao.webp", fmt="WEBP")


def export(coll):
    C.select_only(list(coll.objects))
    out = C.PUBLIC_MODELS / "crt.glb"
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
        export_image_quality=88,
        export_yup=True,
    )
    print("exported:", out, f"{out.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    collection = build()
    bake_ao(collection)
    C.save_blend(C.SOURCE / "crt.blend")
    export(collection)
