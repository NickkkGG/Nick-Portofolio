import { describe, expect, it } from 'vitest';
import { mulberry32 } from './random';

describe('mulberry32', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const values = Array.from({ length: 100 }, () => a());
    expect(values).toEqual(Array.from({ length: 100 }, () => b()));
    values.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    });
  });

  it('differs between seeds', () => {
    expect(mulberry32(7)()).not.toBe(mulberry32(8)());
  });
});
