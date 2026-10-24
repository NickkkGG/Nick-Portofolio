import { Euler, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { Vec3 } from '@/experience/camera/types';
import { fallingFigure, PELVIS } from './figure';

const TARGET: Vec3 = [-0.4, -30, 5];
const CAMERA: Vec3 = [2.2, -30.9, 7.1];
const TIMES = Array.from({ length: 40 }, (_, i) => i * 0.37);

const axis = (rotation: Vec3, local: Vec3) => new Vector3(...local).applyEuler(new Euler(...rotation, 'YXZ'));

describe('the falling figure', () => {
  it('falls upright, leaning back a little, never lying across the frame', () => {
    for (const time of TIMES) {
      const up = axis(fallingFigure(TARGET, CAMERA, time).rotation, [0, 1, 0]);
      expect(up.y, `time=${time}`).toBeGreaterThan(Math.cos((40 * Math.PI) / 180));
      expect(up.y, `time=${time}`).toBeLessThan(Math.cos((8 * Math.PI) / 180));
    }
  });

  it('keeps its front turned toward the camera', () => {
    const toCamera = new Vector3(CAMERA[0] - TARGET[0], 0, CAMERA[2] - TARGET[2]).normalize();
    for (const time of TIMES) {
      const front = axis(fallingFigure(TARGET, CAMERA, time).rotation, [0, 0, 1]).setY(0).normalize();
      expect(front.dot(toCamera), `time=${time}`).toBeGreaterThan(Math.cos((70 * Math.PI) / 180));
    }
  });

  it('has its pelvis on the point the camera looks at', () => {
    for (const time of [0, 1.3, 7]) {
      const { position, rotation } = fallingFigure(TARGET, CAMERA, time);
      const pelvis = axis(rotation, PELVIS);
      expect(position[0] + pelvis.x).toBeCloseTo(TARGET[0], 9);
      expect(position[1] + pelvis.y).toBeCloseTo(TARGET[1], 9);
      expect(position[2] + pelvis.z).toBeCloseTo(TARGET[2], 9);
    }
  });
});
