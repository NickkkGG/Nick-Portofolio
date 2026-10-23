import { describe, expect, it } from 'vitest';
import { flickerDips, lampLevel } from './flicker';

/** Times where the level drops through 0.5: one per visible flicker. */
function flickersBetween(from: number, to: number, options: Parameters<typeof lampLevel>[1]): number[] {
  const out: number[] = [];
  let prev = lampLevel(from, options);
  for (let t = from + 0.001; t < to; t += 0.001) {
    const level = lampLevel(t, options);
    if (prev >= 0.5 && level < 0.5) out.push(t);
    prev = level;
  }
  return out;
}

function maxPerSecond(times: number[]): number {
  let most = 0;
  for (let i = 0; i < times.length; i++) {
    let j = i;
    while (j < times.length && times[j] - times[i] <= 1) j++;
    most = Math.max(most, j - i);
  }
  return most;
}

describe('flicker', () => {
  it('is a pure function of time, so frozen screenshots repeat', () => {
    const options = { nervous: 0.7, knocks: [3.2] };
    for (const t of [0, 1.234, 3.27, 99.9]) expect(lampLevel(t, options)).toBe(lampLevel(t, options));
  });

  it('never flickers more than three times in any second, however frantic', () => {
    // Knocks as fast as the cooldown allows, on the most nervous lamp.
    const knocks = Array.from({ length: 40 }, (_, i) => 5 + i * 0.9);
    const options = { nervous: 1, knocks };
    const seen = flickersBetween(0, 60, options);
    expect(seen.length).toBeGreaterThan(20);
    expect(maxPerSecond(seen)).toBeLessThanOrEqual(3);
    const dips = flickerDips(0, 60, options);
    for (let i = 1; i < dips.length; i++) expect(dips[i] - dips[i - 1]).toBeGreaterThan(1 / 3);
  });

  it('keeps the limit even for knocks closer together than any cooldown', () => {
    const options = { nervous: 1, knocks: [1, 1.05, 1.1, 1.3, 1.31, 1.6] };
    expect(maxPerSecond(flickersBetween(0, 5, options))).toBeLessThanOrEqual(3);
  });

  it('a calm lamp burns steady most of the time but still stutters now and then', () => {
    let steady = 0;
    const samples = 120_000;
    for (let i = 0; i < samples; i++) if (lampLevel(i / 1000, { nervous: 0 }) >= 0.9) steady++;
    expect(steady / samples).toBeGreaterThan(0.95);
    expect(flickerDips(0, 120, { nervous: 0 }).length).toBeGreaterThan(0);
  });

  it('a nervous lamp stutters more often than a calm one', () => {
    const calm = flickerDips(0, 600, { nervous: 0 }).length;
    const nervous = flickerDips(0, 600, { nervous: 1 }).length;
    expect(nervous).toBeGreaterThan(calm * 2);
  });

  it('a knock makes the lamp dip right after it', () => {
    expect(lampLevel(10.06, { nervous: 0, knocks: [10] })).toBeLessThan(0.5);
    expect(lampLevel(10.06, { nervous: 0 })).toBeGreaterThan(0.9);
  });

  it('dips stay inside the asked window, in order', () => {
    const dips = flickerDips(20, 40, { nervous: 1 });
    expect(dips.length).toBeGreaterThan(0);
    expect([...dips].sort((a, b) => a - b)).toEqual(dips);
    for (const d of dips) {
      expect(d).toBeGreaterThanOrEqual(20);
      expect(d).toBeLessThan(40);
    }
  });

  it('a different seed is a different bulb', () => {
    expect(flickerDips(0, 300, { nervous: 0.5, seed: 1 })).not.toEqual(flickerDips(0, 300, { nervous: 0.5, seed: 2 }));
  });
});
