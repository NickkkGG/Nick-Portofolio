import { Group, Object3D, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { Vec3 } from '@/experience/camera/types';
import { REACH } from './glance';
import { Gaze } from './gaze';

/** A neck and head on a model that faces +z, turned round like the room's, so it faces -z in the world. */
function figure() {
  const body = new Group();
  body.rotation.y = Math.PI;
  const model = new Group();
  const neck = new Object3D();
  neck.position.set(0, 1.4, 0);
  const head = new Object3D();
  head.position.set(0, 0.1, 0);
  model.add(neck);
  neck.add(head);
  const gaze = new Gaze(neck, head, model);
  body.add(model);
  body.updateMatrixWorld(true);
  const face = () => new Vector3(0, 0, 1).applyQuaternion(head.getWorldQuaternion(new Quaternion()));
  return { body, neck, head, gaze, face };
}

const HEAD_AT: Vec3 = [0, 1.5, 0];
const offset = (d: Vec3): Vec3 => [HEAD_AT[0] + d[0], HEAD_AT[1] + d[1], HEAD_AT[2] + d[2]];

describe('gaze', () => {
  it('faces ahead (-z here) when nothing calls', () => {
    expect(figure().face().z).toBeCloseTo(-1);
  });

  it('turns to its left for a knock on its left', () => {
    const { body, gaze, face } = figure();
    // Facing -z, the left is -x.
    gaze.apply(offset([-3, 0, 0]), 1, body);
    const f = face();
    expect(f.x).toBeLessThan(-0.9);
    expect(Math.atan2(-f.x, -f.z)).toBeCloseTo(REACH.yaw, 2);
  });

  it('turns to its right for a knock on its right', () => {
    const { body, gaze, face } = figure();
    gaze.apply(offset([1, 0, -1]), 1, body);
    const f = face();
    expect(f.x).toBeCloseTo(Math.SQRT1_2, 2);
    expect(f.z).toBeCloseTo(-Math.SQRT1_2, 2);
  });

  it('looks up at a knock high on the wall ahead, no further than a neck tilts', () => {
    const { body, gaze, face } = figure();
    gaze.apply(offset([0, 3, -1]), 1, body);
    const f = face();
    expect(f.x).toBeCloseTo(0, 5);
    expect(Math.asin(f.y)).toBeCloseTo(REACH.up, 2);
  });

  it('turns part of the way at a part weight, and the neck shares the turn', () => {
    const { body, neck, gaze, face } = figure();
    gaze.apply(offset([1, 0, -1]), 0.5, body);
    const f = face();
    expect(Math.atan2(f.x, -f.z)).toBeCloseTo(Math.PI / 8, 2);
    expect(neck.quaternion.angleTo(new Quaternion())).toBeGreaterThan(0.01);
  });

  it('leaves the pose alone at no weight', () => {
    const { body, neck, head, gaze } = figure();
    gaze.apply(offset([-3, 1, 0]), 0, body);
    expect(neck.quaternion.angleTo(new Quaternion())).toBeCloseTo(0, 6);
    expect(head.quaternion.angleTo(new Quaternion())).toBeCloseTo(0, 6);
  });
});
