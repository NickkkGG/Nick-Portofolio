import { describe, expect, it } from 'vitest';
import { clamp01, damp, lerp, smoothstep } from './math';

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

describe('damp', () => {
  it('eases toward the target, faster with a bigger lambda', () => {
    const slow = damp(0, 1, 2, 0.1);
    const fast = damp(0, 1, 8, 0.1);
    expect(slow).toBeGreaterThan(0);
    expect(fast).toBeGreaterThan(slow);
    expect(fast).toBeLessThan(1);
  });

  it('does not move when no time passed (frozen clock)', () => {
    expect(damp(0.3, 1, 5, 0)).toBe(0.3);
  });

  it('is frame-rate independent', () => {
    const once = damp(0, 1, 4, 0.2);
    const twice = damp(damp(0, 1, 4, 0.1), 1, 4, 0.1);
    expect(twice).toBeCloseTo(once, 10);
  });
});
