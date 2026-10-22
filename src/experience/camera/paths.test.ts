import { describe, expect, it } from 'vitest';
import { helixSlots, slotKeyframeT } from '@/experience/chapters/spiral/helix';
import { LOOP_TELEPORT_P } from '@/timeline/loop';
import { buildKeyframes, cameraPoseAt } from './paths';
import type { Vec3 } from './types';

const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('camera paths', () => {
  it('room start pose', () => {
    expect(cameraPoseAt(0, 6)).toEqual({ position: [0.9, 1.5, 1.6], target: [0, 1.1, -1] });
  });

  it('the loop seam is invisible to the camera', () => {
    const end = cameraPoseAt(0.9999999, 6);
    const start = cameraPoseAt(0, 6);
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(end.position[i] - start.position[i])).toBeLessThan(1e-4);
      expect(Math.abs(end.target[i] - start.target[i])).toBeLessThan(1e-4);
    }
  });

  it('the path is continuous except at the teleport', () => {
    for (const count of [6, 9]) {
      for (const { p } of buildKeyframes(count)) {
        if (p === LOOP_TELEPORT_P) continue;
        const before = cameraPoseAt(p - 1e-7, count);
        const after = cameraPoseAt(p + 1e-7, count);
        expect(distance(before.position, after.position), `count=${count} p=${p}`).toBeLessThan(1e-3);
        expect(distance(before.target, after.target), `count=${count} p=${p}`).toBeLessThan(1e-3);
      }
    }
  });

  it('the teleport jumps from the depths to above the room', () => {
    expect(cameraPoseAt(LOOP_TELEPORT_P - 1e-7, 6).position[1]).toBeLessThan(-200);
    expect(cameraPoseAt(LOOP_TELEPORT_P, 6).position[1]).toBeCloseTo(30);
  });

  it('the camera holds still in front of each monitor', () => {
    const interval = (0.3 * 0.9) / 5; // p between two of six monitors
    for (let i = 0; i < 6; i++) {
      const at = 0.26 + 0.3 * slotKeyframeT(i, 6);
      const parked = cameraPoseAt(at, 6);
      for (const offset of [-0.25 * interval, 0.25 * interval]) {
        const near = cameraPoseAt(at + offset, 6);
        expect(distance(near.position, parked.position), `slot ${i} offset ${offset}`).toBeLessThan(1e-9);
        expect(distance(near.target, parked.target), `slot ${i} offset ${offset}`).toBeLessThan(1e-9);
      }
    }
  });

  it('each slot keyframe looks at its monitor', () => {
    const slots = helixSlots(6);
    slots.forEach((slot, i) => {
      const { target } = cameraPoseAt(0.26 + 0.3 * slotKeyframeT(i, 6), 6);
      target.forEach((value, axis) => expect(value).toBeCloseTo(slot.position[axis], 6));
    });
  });
});
