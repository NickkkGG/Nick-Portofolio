import { describe, expect, it } from 'vitest';
import type { Vec3 } from '@/experience/camera/types';
import { GLANCE, glanceAt, glanceWeight, headTurn, REACH } from './glance';

const LEFT_WALL: Vec3 = [-2.9, 1.6, 0];
const BACK_WALL: Vec3 = [0.9, 2.2, -1.18];
const LOOKING = GLANCE.react + GLANCE.turn;

describe('a glance at a knock', () => {
  it('reacts after a beat, turns, looks for a while, then goes back to the screen', () => {
    expect(glanceWeight(-1)).toBe(0);
    expect(glanceWeight(0)).toBe(0);
    expect(glanceWeight(GLANCE.react)).toBe(0);
    expect(glanceWeight(LOOKING)).toBe(1);
    expect(glanceWeight(LOOKING + GLANCE.hold)).toBe(1);
    expect(glanceWeight(LOOKING + GLANCE.hold + GLANCE.back)).toBe(0);
  });

  it('is back on the screen within a few seconds', () => {
    const total = LOOKING + GLANCE.hold + GLANCE.back;
    expect(total).toBeGreaterThan(2);
    expect(total).toBeLessThan(4);
  });

  it('looks where the knock came from, and only after it', () => {
    expect(glanceAt([], 5)).toBeNull();
    const heard = [{ at: 10, point: LEFT_WALL }];
    expect(glanceAt(heard, 9)).toBeNull();
    expect(glanceAt(heard, 11)).toEqual({ point: LEFT_WALL, weight: 1 });
    expect(glanceAt(heard, 20)).toBeNull();
  });

  it('a second knock while still looking turns the head across, without a dip back to the screen', () => {
    const heard = [
      { at: 10, point: LEFT_WALL },
      { at: 11.2, point: BACK_WALL },
    ];
    let lowest = 1;
    for (let t = 11.2; t <= 11.2 + LOOKING; t += 0.01) lowest = Math.min(lowest, glanceAt(heard, t)?.weight ?? 0);
    expect(lowest).toBeCloseTo(1, 5);
    expect(glanceAt(heard, 11.2)?.point).toEqual(LEFT_WALL);
    expect(glanceAt(heard, 11.2 + LOOKING + 0.05)?.point).toEqual(BACK_WALL);
  });

  it('a knock long after the last one turns from the screen, straight to it', () => {
    const heard = [
      { at: 0, point: LEFT_WALL },
      { at: 30, point: BACK_WALL },
    ];
    expect(glanceAt(heard, 30)).toBeNull();
    expect(glanceAt(heard, 30 + GLANCE.react + GLANCE.turn / 2)?.point).toEqual(BACK_WALL);
  });
});

describe('head turn', () => {
  const ahead: Vec3 = [0, 0, 1];

  it('needs no turn for what is straight ahead', () => {
    const { yaw, pitch } = headTurn(ahead, ahead, ahead);
    expect(yaw).toBeCloseTo(0);
    expect(pitch).toBeCloseTo(0);
  });

  it('turns toward a point off to the side and up', () => {
    const { yaw, pitch } = headTurn(ahead, [1, 0.5, 1], ahead);
    expect(yaw).toBeCloseTo(Math.PI / 4);
    expect(pitch).toBeCloseTo(Math.asin(0.5 / Math.hypot(1, 0.5, 1)));
  });

  it('only as far as a neck goes', () => {
    expect(headTurn(ahead, [1, 0, -0.2], ahead).yaw).toBeCloseTo(REACH.yaw);
    expect(headTurn(ahead, [-1, 0, -0.2], ahead).yaw).toBeCloseTo(-REACH.yaw);
    expect(headTurn(ahead, [0, 1, 0.1], ahead).pitch).toBeCloseTo(REACH.up);
    expect(headTurn(ahead, [0, -1, 0.1], ahead).pitch).toBeCloseTo(-REACH.down);
  });

  it('measures the reach from the body, not from where the face already points', () => {
    const typing: Vec3 = [0, -0.5, 1];
    expect(headTurn(typing, ahead, ahead).pitch).toBeCloseTo(Math.asin(0.5 / Math.hypot(0.5, 1)));
    const turnedBody: Vec3 = [1, 0, 0];
    expect(headTurn(turnedBody, ahead, turnedBody).yaw).toBeCloseTo(-REACH.yaw);
  });
});
