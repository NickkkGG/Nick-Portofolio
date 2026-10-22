import { describe, expect, it } from 'vitest';
import { focusedIndex, helixSlots, slotKeyframeT } from './helix';

const radiusOf = ([x, , z]: [number, number, number]) => Math.hypot(x, z);

function expectVec(actual: [number, number, number], expected: [number, number, number]) {
  actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i], 6));
}

describe('helix', () => {
  it('six slots run top to bottom at the helix radius', () => {
    const slots = helixSlots(6);
    expect(slots).toHaveLength(6);
    expectVec(slots[0].position, [0, -84, 6]);
    expectVec(slots[1].position, [6, -98.4, 0]);
    expect(slots[5].position[1]).toBeCloseTo(-156);
    slots.forEach((slot) => expect(radiusOf(slot.position)).toBeCloseTo(6));
  });

  it('nine slots keep the same height range', () => {
    const slots = helixSlots(9);
    expect(slots[0].position[1]).toBeCloseTo(-84);
    expect(slots[8].position[1]).toBeCloseTo(-156);
    slots.forEach((slot) => expect(radiusOf(slot.position)).toBeCloseTo(6));
  });

  it('zero and one slot', () => {
    expect(helixSlots(0)).toEqual([]);
    expectVec(helixSlots(1)[0].position, [0, -84, 6]);
  });

  it('focusedIndex follows t', () => {
    expect(focusedIndex(0, 6)).toBe(0);
    expect(focusedIndex(0.1, 6)).toBe(0);
    expect(focusedIndex(1, 6)).toBe(5);
    expect(focusedIndex(0.55, 6)).toBe(3);
    expect(focusedIndex(0.5, 9)).toBe(4);
  });

  it('slotKeyframeT agrees with focusedIndex', () => {
    for (let i = 0; i < 6; i++) {
      expect(focusedIndex(slotKeyframeT(i, 6), 6)).toBe(i);
    }
  });
});
