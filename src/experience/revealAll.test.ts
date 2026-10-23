import { Group, Mesh, type Object3D, Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { revealAll } from './revealAll';

function snapshot(root: Object3D) {
  const out: [string, boolean, boolean][] = [];
  root.traverse((o) => out.push([o.name, o.visible, o.frustumCulled]));
  return out;
}

describe('revealAll', () => {
  it('shows every object, never culled, except the ones kept hidden, and undo puts everything back', () => {
    const scene = new Scene();
    const spiral = Object.assign(new Group(), { name: 'spiral', visible: false });
    const crt = Object.assign(new Mesh(), { name: 'crt', frustumCulled: true });
    const cap = Object.assign(new Mesh(), { name: 'cap', visible: false });
    const pads = Object.assign(new Group(), { name: 'pads', visible: true });
    spiral.add(crt, cap);
    scene.add(spiral, pads);
    const before = snapshot(scene);

    const undo = revealAll(scene, [pads]);
    for (const object of [scene, spiral, crt, cap]) {
      expect(object.visible, object.name).toBe(true);
      expect(object.frustumCulled, object.name).toBe(false);
    }
    expect(pads.visible).toBe(false);

    undo();
    expect(snapshot(scene)).toEqual(before);
  });
});
