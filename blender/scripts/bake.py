"""Bakes the room's lightmaps (spec §5.2) and a reflection probe.

    Blender -b blender/source/room.blend -P blender/scripts/bake.py -- [samples]

Every static object gets a second UV map, "Lightmap", packed into one of two atlases
(A: walls, floor and ceiling; B: everything in the room). Each atlas is baked three
times with Cycles, one light at a time, so the web can mix them live:

    base    moonlight and the night sky through the window
    lamp    the desk lamp alone, in white (the web tints it and makes it flicker)
    screen  the monitor's glow alone, in white

The bakes are diffuse light only (no surface colour): the web multiplies them by
each material's own textures. Results land in blender/build/lightmaps as EXR and
in public/models as sRGB WebP, with their scales in the .blend's scene properties,
which the glTF export carries to the web (scene.userData.lightmaps).
"""

import json
import math
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import bpy  # noqa: E402
import numpy as np  # noqa: E402

import common as C  # noqa: E402

ATLAS_SIZE = 2048
ARCHITECTURE = ("Floor", "Ceiling", "Skirting", "Window_Sill")
ARCHITECTURE_PREFIX = ("Wall_", "Stain_")
PASSES = {
    "base": {"Moon": True, "LampLight": False, "ScreenLight": False, "world": 1.0},
    "lamp": {"Moon": False, "LampLight": True, "ScreenLight": False, "world": 0.0},
    "screen": {"Moon": False, "LampLight": False, "ScreenLight": True, "world": 0.0},
}
OUT = C.BUILD / "lightmaps"


def atlas_of(obj):
    return "A" if obj.name in ARCHITECTURE or obj.name.startswith(ARCHITECTURE_PREFIX) else "B"


def static_objects():
    return [o for o in C.collection("Room").objects if o.type == "MESH" and int(o.get("lightmap", 1)) != 0]


# ---------------------------------------------------------------------------
# Lightmap UVs


def lightmap_uvs(objects):
    """Unwraps every object into its own islands, then packs one shared atlas."""
    for o in objects:
        me = o.data
        layer = me.uv_layers.get("Lightmap") or me.uv_layers.new(name="Lightmap")
        me.uv_layers.active = layer
    # Mesh selection drives UV selection, so the UV operators work without a UV editor.
    bpy.context.scene.tool_settings.use_uv_select_sync = True
    C.select_only(objects)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.average_islands_scale()
    bpy.ops.object.mode_set(mode="OBJECT")
    # Texel density per object: important surfaces get more texels, hidden ones fewer.
    for o in objects:
        k = float(o.get("lm_scale", 1.0))
        if k == 1.0:
            continue
        uv = o.data.uv_layers["Lightmap"].data
        coords = np.empty(len(uv) * 2, dtype=np.float32)
        uv.foreach_get("uv", coords)
        coords *= k
        uv.foreach_set("uv", coords)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(udim_source="CLOSEST_UDIM", rotate=True, rotate_method="ANY", scale=True, margin_method="FRACTION", margin=0.004, shape_method="CONCAVE")
    bpy.ops.object.mode_set(mode="OBJECT")


# ---------------------------------------------------------------------------
# Baking


def bake_node(mat, image):
    """The (unconnected) image node Cycles bakes into for this material."""
    nodes = mat.node_tree.nodes
    node = nodes.get("LightmapBake") or nodes.new("ShaderNodeTexImage")
    node.name = node.label = "LightmapBake"
    node.image = image
    uv = nodes.get("LightmapUV") or nodes.new("ShaderNodeUVMap")
    uv.name = "LightmapUV"
    uv.uv_map = "Lightmap"
    mat.node_tree.links.new(uv.outputs["UV"], node.inputs["Vector"])
    for n in nodes:
        n.select = False
    node.select = True
    nodes.active = node


def silence_emitters(objects):
    """Glowing bulb, filament and LED would light every pass; the lights do that job here."""
    for o in objects:
        for slot in o.material_slots:
            bsdf = slot.material.node_tree.nodes.get("Principled BSDF") if slot.material else None
            if bsdf is not None:
                bsdf.inputs["Emission Strength"].default_value = 0.0


def set_pass(name):
    cfg = PASSES[name]
    for light in ("Moon", "LampLight", "ScreenLight"):
        bpy.data.objects[light].hide_render = not cfg[light]
    bpy.context.scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = cfg["world"]


def bake_atlas(atlas, objects, samples):
    images = {}
    for pass_name in PASSES:
        img = bpy.data.images.new(f"lm_{atlas}_{pass_name}", ATLAS_SIZE, ATLAS_SIZE, alpha=True, float_buffer=True)
        img.generated_color = (0.0, 0.0, 0.0, 0.0)
        for o in objects:
            for slot in o.material_slots:
                if slot.material:
                    bake_node(slot.material, img)
        set_pass(pass_name)
        C.select_only(objects)
        scene = bpy.context.scene
        scene.cycles.samples = samples
        scene.render.bake.margin = 0
        print(f"baking atlas {atlas} / {pass_name} ({len(objects)} objects, {samples} spp)", flush=True)
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"}, margin=0, use_clear=True, target="IMAGE_TEXTURES")
        px = np.empty(ATLAS_SIZE * ATLAS_SIZE * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        images[pass_name] = px.reshape(ATLAS_SIZE, ATLAS_SIZE, 4)
        save_exr(images[pass_name], OUT / f"{atlas}_{pass_name}.exr")
    return images


def save_exr(px, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img = bpy.data.images.new(path.stem, px.shape[1], px.shape[0], alpha=True, float_buffer=True)
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = str(path)
    img.file_format = "OPEN_EXR"
    img.save()
    bpy.data.images.remove(img)


# ---------------------------------------------------------------------------
# Clean-up: denoise inside the islands, grow the islands outward, encode


def blur(channel, sigma):
    """Separable Gaussian blur (numpy only)."""
    radius = int(math.ceil(sigma * 3))
    x = np.arange(-radius, radius + 1, dtype=np.float32)
    kernel = np.exp(-(x * x) / (2 * sigma * sigma))
    kernel /= kernel.sum()
    padded = np.pad(channel, ((0, 0), (radius, radius)), mode="edge")
    out = np.zeros_like(channel)
    for i, k in enumerate(kernel):
        out += k * padded[:, i : i + channel.shape[1]]
    padded = np.pad(out, ((radius, radius), (0, 0)), mode="edge")
    out2 = np.zeros_like(channel)
    for i, k in enumerate(kernel):
        out2 += k * padded[i : i + channel.shape[0], :]
    return out2


def denoise(rgb, mask, sigma=1.1):
    """Normalized convolution: smooths sampling noise without pulling in empty texels."""
    weight = blur(mask, sigma)
    out = np.empty_like(rgb)
    for c in range(3):
        out[..., c] = blur(rgb[..., c] * mask, sigma) / np.maximum(weight, 1e-6)
    return np.where(mask[..., None] > 0, out, 0.0)


def dilate(rgb, mask, steps=10):
    """Bleeds island borders outward so filtering never samples black."""
    rgb, mask = rgb.copy(), mask.copy()
    for _ in range(steps):
        acc = np.zeros_like(rgb)
        cnt = np.zeros_like(mask)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)):
            m = np.roll(np.roll(mask, dy, 0), dx, 1)
            acc += np.roll(np.roll(rgb, dy, 0), dx, 1) * m[..., None]
            cnt += m
        grow = (mask == 0) & (cnt > 0)
        rgb[grow] = acc[grow] / cnt[grow][..., None]
        mask = np.where(grow, 1.0, mask)
    return rgb


def encode(px, path):
    """Linear light -> sRGB-encoded WebP; returns the scale the web multiplies back in."""
    mask = (px[..., 3] > 0.5).astype(np.float32)
    rgb = denoise(px[..., :3], mask)
    rgb = dilate(rgb, mask)
    peak = float(np.percentile(rgb.max(axis=-1)[mask > 0], 99.7)) if mask.any() else 1.0
    scale = max(peak, 1e-4)
    v = np.clip(rgb / scale, 0.0, 1.0)
    srgb = np.where(v <= 0.0031308, v * 12.92, 1.055 * np.power(v, 1 / 2.4) - 0.055)
    out = np.ones(px.shape, dtype=np.float32)
    out[..., :3] = srgb
    path.parent.mkdir(parents=True, exist_ok=True)
    img = bpy.data.images.new(path.stem, px.shape[1], px.shape[0], alpha=False)
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(out.ravel())
    img.filepath_raw = str(path)
    img.file_format = "WEBP"
    bpy.context.scene.render.image_settings.quality = 92
    img.save()
    bpy.data.images.remove(img)
    return scale


# ---------------------------------------------------------------------------
# Reflection probe: what the CRT glass, mug and lamp metal reflect


def render_probe(samples):
    scene = bpy.context.scene
    for light in ("Moon", "LampLight", "ScreenLight"):
        bpy.data.objects[light].hide_render = False
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
    scene.camera = bpy.data.objects["ProbeCam"]
    scene.render.resolution_x, scene.render.resolution_y = 1024, 512
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "Standard"
    scene.render.image_settings.file_format = "OPEN_EXR"
    raw = OUT / "probe.exr"
    scene.render.filepath = str(raw)
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(str(raw))
    px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(img.size[1], img.size[0], 4)
    return encode_probe(px, C.PUBLIC_MODELS / "room-probe.webp")


def encode_probe(px, path):
    rgb = px[..., :3]
    scale = max(float(np.percentile(rgb.max(axis=-1), 99.5)), 1e-4)
    v = np.clip(rgb / scale, 0.0, 1.0)
    out = np.ones(px.shape, dtype=np.float32)
    out[..., :3] = np.where(v <= 0.0031308, v * 12.92, 1.055 * np.power(v, 1 / 2.4) - 0.055)
    img = bpy.data.images.new(path.stem, px.shape[1], px.shape[0], alpha=False)
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(out.ravel())
    img.filepath_raw = str(path)
    img.file_format = "WEBP"
    img.save()
    bpy.data.images.remove(img)
    return scale


def main():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    samples = int(args[0]) if args else 1024
    C.use_gpu()
    scene = bpy.context.scene
    scene.cycles.use_denoising = False
    objects = static_objects()
    silence_emitters([o for o in C.collection("Room").objects if o.type == "MESH"])
    scales = {}
    for atlas in ("A", "B"):
        members = [o for o in objects if atlas_of(o) == atlas]
        lightmap_uvs(members)
        images = bake_atlas(atlas, members, samples)
        scales[atlas] = {name: encode(px, C.PUBLIC_MODELS / f"room-lm-{atlas.lower()}-{name}.webp") for name, px in images.items()}
        for o in members:
            o["atlas"] = atlas
    scales["probe"] = render_probe(max(64, samples // 4))
    scene["lightmaps"] = json.dumps(scales)
    print("lightmap scales:", scales)
    bpy.ops.wm.save_as_mainfile(filepath=str(C.SOURCE / "room_baked.blend"), compress=True)


if __name__ == "__main__":
    main()
