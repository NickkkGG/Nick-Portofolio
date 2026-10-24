import type { Vec3 } from '@/experience/camera/types';

/**
 * The projection booth: a plank shed caught in the cables across from the first monitor,
 * its window facing that monitor's screen (helix slot 0 hangs at 0, -84, 6). Blender builds
 * it to these numbers (blender/scripts/booth.py keeps a copy); the camera and the scene
 * place everything by them. World metres.
 */
export const BOOTH = {
  floorY: -85.2,
  ceilingY: -82.6,
  /** The inside walls: x from -halfWidth to halfWidth, z from the window wall to the back wall. */
  halfWidth: 1.6,
  frontZ: 11.2,
  backZ: 14.4,
  /** The hole in the window wall, level with the first monitor. */
  window: { center: [0, -84, 11.2] as Vec3, width: 1.9, height: 1.3 },
  /** The sheet on its rope just inside the window, a little bigger than the hole. */
  sheet: { center: [0, -84, 11.35] as Vec3, width: 2.3, height: 1.6 },
  /** The projector's lens, on a stack of boxes by the back wall, aimed at the sheet. */
  lens: [0.3, -84, 13.9] as Vec3,
  /** The crate the figure sits on, left of the beam, facing the sheet: its feet on the floor here. */
  seat: [-0.55, -85.2, 12.9] as Vec3,
  /** The hole the figure crashes through, above the old mattresses. */
  roofHole: [-1.1, -82.6, 13.9] as Vec3,
} as const;
