import { AmbientLight, DirectionalLight, Group, HemisphereLight, type Light, type Object3D, PointLight, RectAreaLight, Scene, SpotLight } from 'three';
import { describe, expect, it } from 'vitest';
import { LightPads, lightKind } from './lightPads';

/** What the renderer counts: lights it reaches through visible parents, by kind. */
function rendered(scene: Object3D): Record<string, number> {
  const counts: Record<string, number> = {};
  scene.traverseVisible((object) => {
    const kind = (object as Light).isLight ? lightKind(object as Light) : null;
    if (kind) counts[kind] = (counts[kind] ?? 0) + 1;
  });
  return counts;
}

/** Two chapters with their own lights, like the room and the depths. */
function world() {
  const scene = new Scene();
  const room = new Group();
  room.add(new PointLight(), new RectAreaLight(), new DirectionalLight());
  const depths = new Group();
  const lamp = new Group();
  lamp.add(new PointLight());
  depths.add(new HemisphereLight(), new SpotLight(), lamp);
  scene.add(new AmbientLight(), room, depths);
  const pads = new LightPads();
  pads.collect(scene);
  scene.add(pads.root);
  return { scene, room, depths, lamp, pads };
}

describe('LightPads', () => {
  it('keeps the count of every kind of light the same whichever chapters are hidden', () => {
    const { scene, room, depths, lamp, pads } = world();
    const all = { point: 2, rectArea: 1, directional: 1, hemisphere: 1, spot: 1 };
    for (const [r, d, l] of [
      [true, true, true],
      [true, false, true],
      [false, true, true],
      [false, true, false],
      [false, false, false],
    ]) {
      room.visible = r;
      depths.visible = d;
      lamp.visible = l;
      pads.balance();
      expect(rendered(scene), `room ${r}, depths ${d}, lamp ${l}`).toEqual(all);
    }
  });

  it('collecting again never counts its own stand-ins as lights to fill in for', () => {
    const { scene, room, pads } = world();
    pads.collect(scene);
    room.visible = false;
    pads.balance();
    expect(rendered(scene).point).toBe(2);
  });

  it('stand-ins give no light, and sit where none of them can light a surface edge-on', () => {
    const { scene, room, depths, pads } = world();
    room.visible = depths.visible = false;
    pads.balance();
    const standIns: Light[] = [];
    pads.root.traverseVisible((object) => {
      if ((object as Light).isLight) standIns.push(object as Light);
    });
    expect(standIns.length).toBe(6);
    for (const light of standIns) {
      expect(light.intensity).toBe(0);
      expect(light.castShadow).toBe(false);
      // A spot or sun aimed at its own position would give the shader a NaN direction.
      expect(light.position.y).toBeGreaterThan(100);
    }
    expect(rendered(scene)).toEqual({ point: 2, rectArea: 1, directional: 1, hemisphere: 1, spot: 1 });
  });

  it('ambient light is not counted per kind, so it needs no stand-in', () => {
    expect(lightKind(new AmbientLight())).toBeNull();
  });
});
