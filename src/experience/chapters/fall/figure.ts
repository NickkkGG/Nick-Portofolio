import { Euler, Vector3 } from 'three';
import type { Vec3 } from '@/experience/camera/types';

/** The character's pelvis above its feet at rest (the model's origin is between the feet). */
export const PELVIS: Vec3 = [0, 0.86, 0];

/** How far the figure leans back as it falls, reaching up for the hole (radians). */
const LEAN = 0.42;
/** Its front turned this far past the camera, so the camera sees it three quarters on. */
const TURN = 0.55;

const euler = new Euler(0, 0, 0, 'YXZ');
const pelvis = new Vector3();

/**
 * The falling figure: upright, leaning back with its arms up toward the hole, turned three
 * quarters to the camera and swaying a little as the air takes it, its pelvis on `target`,
 * the point the camera looks at. Rotation is in 'YXZ' order.
 */
export function fallingFigure(target: Vec3, camera: Vec3, time: number): { position: Vec3; rotation: Vec3 } {
  const facing = Math.atan2(camera[0] - target[0], camera[2] - target[2]);
  const rotation: Vec3 = [
    -LEAN + 0.07 * Math.sin(time * 1.1),
    facing + TURN + 0.14 * Math.sin(time * 0.7),
    0.09 * Math.sin(time * 0.9 + 1),
  ];
  pelvis.set(...PELVIS).applyEuler(euler.set(...rotation, 'YXZ'));
  return { position: [target[0] - pelvis.x, target[1] - pelvis.y, target[2] - pelvis.z], rotation };
}
