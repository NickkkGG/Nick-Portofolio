import { PerspectiveCamera, Vector3 } from 'three';
import { clamp01 } from '@/lib/math';
import { BOOTH } from './layout';

/** Slides are 35 mm film: a 3:2 picture. */
export const SLIDE_ASPECT = 3 / 2;
/** The picture's height on the sheet: cloth shows all round it, and the pegs' scallops stay above it. */
const PICTURE_HEIGHT = 1.3;
/** How far the sheet falls once the rope snaps: its top edge comes down to the floor. */
export const SHEET_FALL = BOOTH.sheet.center[1] + BOOTH.sheet.height / 2 - BOOTH.floorY + 0.02;

/**
 * The projector as a camera at the lens, aimed at the middle of the sheet: its view is the
 * beam. The sheet takes the slide from it, and the beam's light in the dust is traced through it.
 */
export function projectorCamera(): PerspectiveCamera {
  const lens = new Vector3(...BOOTH.lens);
  const sheet = new Vector3(...BOOTH.sheet.center);
  const fov = (2 * Math.atan(PICTURE_HEIGHT / 2 / lens.distanceTo(sheet)) * 180) / Math.PI;
  const camera = new PerspectiveCamera(fov, SLIDE_ASPECT, 0.05, 9);
  camera.position.copy(lens);
  camera.lookAt(sheet);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

/** Where the ray through the picture's point (x, y), each -1..1, meets the plane at depth `z`. */
export function throwOnto(camera: PerspectiveCamera, x: number, y: number, z: number): Vector3 {
  const along = new Vector3(x, y, 0.5).unproject(camera).sub(camera.position).normalize();
  return camera.position.clone().addScaledVector(along, (z - camera.position.z) / along.z);
}

/**
 * How far the sheet has come down at `u` across it (0 left, 1 right), 0..1 of SHEET_FALL, while
 * the drop runs 0..1 (slides.ts sheetDrop): the rope snaps at its left end, which goes first.
 * The sheet's shader runs the same sum on every vertex.
 */
export function sheetFall(drop: number, u: number): number {
  return clamp01(drop * 1.25 - 0.25 * u);
}
