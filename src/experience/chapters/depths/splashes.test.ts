import { describe, expect, it } from 'vitest';
import { MAX_RIPPLES, RIPPLE_LIFE } from './choreography';
import { mergeRipples, Splashes } from './splashes';

describe('splashes on the flooded floor', () => {
  it('ring out from where something broke the water, by the scene clock, so they run on after the scroll stops', () => {
    const splashes = new Splashes();
    splashes.add(0, 1, 10);
    expect(splashes.ripples(10.5)).toEqual([{ x: 0, z: 1, age: 0.5 }]);
    expect(splashes.ripples(11.5)).toEqual([{ x: 0, z: 1, age: 1.5 }]);
  });

  it('die away like the drips, and never ring before they were made', () => {
    const splashes = new Splashes();
    splashes.add(0, 1, 10);
    expect(splashes.ripples(9)).toEqual([]);
    expect(splashes.ripples(10 + RIPPLE_LIFE + 0.01)).toEqual([]);
  });

  it('share the water with the drips, the youngest rings first, as many as the shader holds', () => {
    const drips = [
      { x: 3, z: 3, age: 0.2 },
      { x: -3, z: 2, age: 1.1 },
      { x: 4, z: -2, age: 2 },
      { x: 1, z: 5, age: 2.9 },
    ];
    const splashes = [
      { x: 0, z: 1, age: 0.6 },
      { x: 0, z: 1, age: 0.1 },
    ];
    const merged = mergeRipples(drips, splashes);
    expect(merged).toHaveLength(MAX_RIPPLES);
    expect(merged.map((r) => r.age)).toEqual([0.1, 0.2, 0.6, 1.1]);
  });
});
