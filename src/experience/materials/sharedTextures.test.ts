import { Group, LinearSRGBColorSpace, Mesh, MeshStandardMaterial, SRGBColorSpace, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { shareTextures } from './sharedTextures';

function texture(name: string, size = 2048, colorSpace: string = SRGBColorSpace): Texture {
  const t = new Texture();
  t.name = name;
  t.image = { width: size, height: size };
  t.colorSpace = colorSpace;
  return t;
}

/** A loaded model: one mesh with one material, its own copies of the textures. */
function model(maps: Partial<Pick<MeshStandardMaterial, 'map' | 'normalMap' | 'roughnessMap' | 'aoMap'>>) {
  const scene = new Group();
  const material = new MeshStandardMaterial(maps);
  scene.add(new Mesh(undefined, material));
  return { scene, material };
}

describe('shareTextures', () => {
  it('points every model at the first copy of an image', () => {
    const desk = model({ map: texture('plastic_beige-a'), normalMap: texture('Plastic018B-a', 2048, LinearSRGBColorSpace) });
    const hanging = model({ map: texture('plastic_beige-a'), normalMap: texture('Plastic018B-a', 2048, LinearSRGBColorSpace) });
    shareTextures(desk.scene);
    shareTextures(hanging.scene);
    expect(hanging.material.map).toBe(desk.material.map);
    expect(hanging.material.normalMap).toBe(desk.material.normalMap);
  });

  it('keeps textures apart that only share a name', () => {
    const a = model({ map: texture('wall-b', 2048), roughnessMap: texture('orm-b', 2048, LinearSRGBColorSpace) });
    const b = model({ map: texture('wall-b', 1024), roughnessMap: texture('orm-b', 2048, SRGBColorSpace) });
    shareTextures(a.scene);
    shareTextures(b.scene);
    expect(b.material.map).not.toBe(a.material.map);
    expect(b.material.roughnessMap).not.toBe(a.material.roughnessMap);
  });

  it('never merges unnamed textures, and sharing a model twice changes nothing', () => {
    const a = model({ map: texture('') });
    const b = model({ map: texture('') });
    shareTextures(a.scene);
    shareTextures(b.scene);
    expect(b.material.map).not.toBe(a.material.map);
    const own = b.material.map;
    shareTextures(b.scene);
    expect(b.material.map).toBe(own);
  });

  it('keeps the texture clones its own models make', () => {
    const roof = model({ aoMap: texture('concrete-c', 2048, LinearSRGBColorSpace) });
    const floor = model({ aoMap: texture('concrete-c', 2048, LinearSRGBColorSpace) });
    floor.material.aoMap!.channel = 1;
    shareTextures(roof.scene);
    shareTextures(floor.scene);
    expect(floor.material.aoMap).not.toBe(roof.material.aoMap);
  });
});
