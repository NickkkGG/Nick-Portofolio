import type { Object3D } from 'three';

/**
 * Makes every object under `root` visible and never culled, except `keepHidden`, so one
 * render reaches all of it. Returns the undo, which puts every flag back as it was.
 */
export function revealAll(root: Object3D, keepHidden: Object3D[] = []): () => void {
  const saved: [object: Object3D, visible: boolean, frustumCulled: boolean][] = [];
  root.traverse((object) => {
    saved.push([object, object.visible, object.frustumCulled]);
    object.visible = true;
    object.frustumCulled = false;
  });
  for (const object of keepHidden) object.visible = false;
  return () => {
    for (const [object, visible, frustumCulled] of saved) {
      object.visible = visible;
      object.frustumCulled = frustumCulled;
    }
  };
}
