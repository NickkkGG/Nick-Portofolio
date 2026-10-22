import { describe, expect, it } from 'vitest';
import { clamp01, lerp, smoothstep } from './math';

describe('math', () => {
  it('clamp01 keeps values inside 0..1', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.25)).toBe(0.25);
    expect(clamp01(3)).toBe(1);
  });

  it('smoothstep eases between the edges and clamps outside', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(0, 1, 0.25)).toBeCloseTo(0.15625);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });

  it('lerp interpolates linearly', () => {
    expect(lerp(2, 4, 0.5)).toBe(3);
    expect(lerp(2, 4, 0)).toBe(2);
  });
});
