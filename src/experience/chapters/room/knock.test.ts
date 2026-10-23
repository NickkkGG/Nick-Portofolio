import { describe, expect, it } from 'vitest';
import { canKnock, INITIAL_KNOCK, knock, knockTarget, type KnockState, KNUCKLES, knucklePoint, lampNervousness, roomT, tensionAt } from './knock';

function knockAt(...times: number[]): { state: KnockState; whosThere: boolean } {
  let state = INITIAL_KNOCK;
  let whosThere = false;
  for (const t of times) ({ state, whosThere } = knock(state, t));
  return { state, whosThere };
}

describe('ghost knock tension', () => {
  it('each knock raises the tension by one', () => {
    expect(tensionAt(knockAt(0).state, 0)).toBe(1);
    expect(tensionAt(knockAt(0, 1, 2).state, 2)).toBe(3);
  });

  it('drops by one for every ten seconds without a knock, never below zero', () => {
    const { state } = knockAt(0, 1, 2);
    expect(tensionAt(state, 11.9)).toBe(3);
    expect(tensionAt(state, 12)).toBe(2);
    expect(tensionAt(state, 32)).toBe(0);
    expect(tensionAt(state, 500)).toBe(0);
  });

  it('a new knock builds on the tension that is left', () => {
    expect(tensionAt(knockAt(0, 1, 15).state, 15)).toBe(2);
  });

  it('the fifth knock makes the monitor type and lets the tension go', () => {
    const fourth = knockAt(0, 1, 2, 3);
    expect(fourth.whosThere).toBe(false);
    const fifth = knockAt(0, 1, 2, 3, 4);
    expect(fifth.whosThere).toBe(true);
    expect(fifth.state.whosThereAt).toBe(4);
    expect(tensionAt(fifth.state, 4)).toBe(0);
  });

  it('ignores knocks that come too fast, so the lamp never strobes', () => {
    const first = knock(INITIAL_KNOCK, 0);
    const tooSoon = knock(first.state, 0.5);
    expect(tooSoon.accepted).toBe(false);
    expect(tensionAt(tooSoon.state, 0.5)).toBe(1);
    expect(knock(tooSoon.state, 0.95).accepted).toBe(true);
  });

  it('remembers recent knock times for the lamp', () => {
    expect(knockAt(1, 2, 3).state.knocks).toEqual([1, 2, 3]);
  });
});

describe('where and when a knock works', () => {
  it('only in the room, before the floor starts to give', () => {
    expect(canKnock(0)).toBe(true);
    expect(canKnock(0.059)).toBe(true);
    expect(canKnock(0.061)).toBe(false);
    expect(canKnock(0.3)).toBe(false);
    expect(canKnock(0.95)).toBe(false);
    // The end of the loop already shows the room again.
    expect(canKnock(0.9995)).toBe(true);
  });

  it('knocks the wall behind thin things on it, not furniture in front of it', () => {
    const wall = { distance: 4, knockable: true, point: [0, 2, -1.18] as [number, number, number], normal: [0, 0, 1] as [number, number, number] };
    const poster = { distance: 3.997, knockable: false, point: [0, 2, -1.177] as [number, number, number], normal: [0, 0, 1] as [number, number, number] };
    const monitor = { distance: 3.4, knockable: false, point: [0, 1, -0.6] as [number, number, number], normal: [0, 0, 1] as [number, number, number] };
    expect(knockTarget([wall])).toBe(wall);
    expect(knockTarget([poster, wall])).toBe(wall);
    expect(knockTarget([monitor, wall])).toBeNull();
    expect(knockTarget([monitor])).toBeNull();
    expect(knockTarget([])).toBeNull();
  });
});

describe('room clock', () => {
  it('runs with the room chapter and is calm again when the loop lands back', () => {
    expect(roomT(0)).toBe(0);
    expect(roomT(0.05)).toBeCloseTo(0.5);
    expect(roomT(0.11)).toBe(1);
    expect(roomT(0.95)).toBe(0);
    expect(roomT(0.9995)).toBe(0);
  });

  it('the lamp gets nervous only once the visitor scrolls on, so the loop seam matches', () => {
    expect(lampNervousness(0)).toBe(0);
    expect(lampNervousness(0.15)).toBe(0);
    expect(lampNervousness(0.5)).toBeGreaterThan(lampNervousness(0.3));
    expect(lampNervousness(1)).toBe(1);
  });
});

describe('knock-knock', () => {
  it('one click knocks twice, the second a beat later and a little softer', () => {
    expect(KNUCKLES).toHaveLength(2);
    expect(KNUCKLES[0].delay).toBe(0);
    expect(KNUCKLES[1].delay).toBeGreaterThan(0.2);
    expect(KNUCKLES[1].delay).toBeLessThan(0.4);
    expect(KNUCKLES[1].strength).toBeLessThan(KNUCKLES[0].strength);
  });

  it('the second knuckle lands beside the first, on the same wall', () => {
    const back = knucklePoint([0.5, 1.4, -1.18], [0, 0, 1], 1);
    expect(back[2]).toBeCloseTo(-1.18, 6);
    expect(Math.hypot(back[0] - 0.5, back[1] - 1.4)).toBeGreaterThan(0.01);
    expect(Math.hypot(back[0] - 0.5, back[1] - 1.4)).toBeLessThan(0.06);
    const side = knucklePoint([-1.3, 1.2, 0.2], [1, 0, 0], 1);
    expect(side[0]).toBeCloseTo(-1.3, 6);
    expect(knucklePoint([0.5, 1.4, -1.18], [0, 0, 1], 0)).toEqual([0.5, 1.4, -1.18]);
  });
});
