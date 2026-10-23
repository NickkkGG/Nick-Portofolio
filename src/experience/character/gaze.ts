import { type Object3D, Quaternion, Vector3 } from 'three';
import type { Vec3 } from '@/experience/camera/types';
import { headTurn, pitchOf, wrapAngle, yawOf } from './glance';

/** Share of a glance the neck takes; the head turns the rest of the way. */
const NECK_SHARE = 0.35;
const UP = new Vector3(0, 1, 0);

/**
 * Turns the neck and head toward a point, over whatever the clips posed this frame. The
 * face's direction in the head bone's own frame is read from the rest pose, where the
 * model faces +z.
 */
export class Gaze {
  private readonly forward = new Vector3();
  private readonly turn = new Quaternion();
  private readonly tilt = new Quaternion();
  private readonly world = new Quaternion();
  private readonly parent = new Quaternion();
  private readonly axis = new Vector3();
  private readonly point = new Vector3();
  private readonly scratch = new Vector3();

  constructor(
    private readonly neck: Object3D,
    private readonly head: Object3D,
    figure: Object3D,
  ) {
    figure.updateWorldMatrix(true, true);
    // The head's rest orientation within the model, wherever the model itself stands.
    const rest = figure.getWorldQuaternion(this.parent).invert().multiply(head.getWorldQuaternion(this.world));
    this.forward.set(0, 0, 1).applyQuaternion(rest.invert());
  }

  /** Where the face points in the world, as the head is now. */
  private face(): Vec3 {
    return this.scratch.copy(this.forward).applyQuaternion(this.head.getWorldQuaternion(this.world)).toArray();
  }

  /** Looks `weight` (0..1) of the way at `target`, as far as the neck reaches from `body`'s forward. */
  apply(target: Vec3, weight: number, body: Object3D) {
    const face = this.face();
    const toward = this.point.set(...target).sub(this.head.getWorldPosition(this.scratch)).toArray();
    const forward = this.scratch.set(0, 0, 1).applyQuaternion(body.getWorldQuaternion(this.world)).toArray();
    const { yaw, pitch } = headTurn(face, toward, forward);
    const goalYaw = yawOf(face) + yaw * weight;
    const goalPitch = pitchOf(face) + pitch * weight;
    this.rotate(this.neck, yawOf(face), yaw * weight * NECK_SHARE, pitch * weight * NECK_SHARE);
    // The head takes the rest of the way from wherever the neck left it.
    const now = this.face();
    this.rotate(this.head, yawOf(now), wrapAngle(goalYaw - yawOf(now)), goalPitch - pitchOf(now));
  }

  /** Turns `bone` in the world by `yaw` about the vertical, then by `pitch` about the face's level side axis. */
  private rotate(bone: Object3D, faceYaw: number, yaw: number, pitch: number) {
    if (!bone.parent) return;
    const heading = faceYaw + yaw;
    this.turn.setFromAxisAngle(UP, yaw);
    this.tilt.setFromAxisAngle(this.axis.set(-Math.cos(heading), 0, Math.sin(heading)), pitch);
    const world = bone.getWorldQuaternion(this.world);
    const delta = this.tilt.multiply(this.turn); // the yaw first, then the pitch
    bone.parent.getWorldQuaternion(this.parent);
    bone.quaternion.copy(this.parent.invert().multiply(delta.multiply(world)));
    bone.updateMatrixWorld(true);
  }
}
