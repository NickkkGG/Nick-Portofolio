import type { Material, Mesh, Object3D, Texture } from 'three';

/** Material slots a glTF texture can end up in. */
const SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap', 'lightMap'] as const;
type Slots = Partial<Record<(typeof SLOTS)[number], Texture | null>>;

/** The first copy of each image, by what makes two textures show it the same way. */
const kept = new Map<string, Texture>();
const shared = new WeakSet<Object3D>();

/** compress_textures.mjs gives every copy of one image the same name; the rest must match too. */
function keyOf(texture: Texture): string {
  const { width = 0, height = 0 } = (texture.image ?? {}) as { width?: number; height?: number };
  return [texture.name, width, height, texture.colorSpace, texture.channel, texture.wrapS, texture.wrapT, texture.flipY].join('|');
}

/**
 * Several models carry the same textures (the CRT's plastic is on the desk monitor, the
 * hanging monitors and the sunken TVs), and each model's loader makes its own copy. This points
 * every material in `scene` at one copy per image, so each is uploaded and kept in memory once.
 */
export function shareTextures(scene: Object3D): void {
  if (shared.has(scene)) return;
  shared.add(scene);
  scene.traverse((object) => {
    const material = (object as Mesh).material as Material | Material[] | undefined;
    if (!material) return;
    for (const one of Array.isArray(material) ? material : [material]) {
      const slots = one as Material & Slots;
      for (const slot of SLOTS) {
        const texture = slots[slot];
        if (!texture?.name) continue;
        const key = keyOf(texture);
        const first = kept.get(key);
        if (!first) kept.set(key, texture);
        else slots[slot] = first;
      }
    }
  });
}
