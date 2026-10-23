import { describe, expect, it } from 'vitest';
import { hangingSway, surgeLevel } from './motion';

describe('hanging monitors', () => {
  it('swing only a few centimetres at the screen, never still', () => {
    let most = 0;
    let least = Infinity;
    for (let i = 0; i < 6000; i++) {
      const [x, z] = hangingSway(i * 0.05, 3, 45);
      const reach = Math.hypot(x, z) * 45;
      most = Math.max(most, reach);
      least = Math.min(least, reach);
    }
    expect(most).toBeLessThan(0.35);
    expect(most).toBeGreaterThan(0.08);
  });

  it('swing like a pendulum of their cable: a 45 m cable takes about 13.5 s per swing', () => {
    // Count sign changes of the main swing over two minutes.
    let changes = 0;
    let prev = hangingSway(0, 1, 45)[0];
    for (let t = 0.05; t <= 120; t += 0.05) {
      const x = hangingSway(t, 1, 45)[0];
      if (Math.sign(x) !== Math.sign(prev)) changes++;
      prev = x;
    }
    const period = (2 * 120) / changes;
    expect(period).toBeGreaterThan(11);
    expect(period).toBeLessThan(16);
  });

  it('each monitor swings in its own phase, and repeats exactly for a frozen clock', () => {
    expect(hangingSway(10, 1, 45)).not.toEqual(hangingSway(10, 2, 45));
    expect(hangingSway(10, 1, 45)).toEqual(hangingSway(10, 1, 45));
  });
});

describe('power surges', () => {
  it('are rare: the screens show their own picture almost all the time', () => {
    let quiet = 0;
    for (let i = 0; i < 60_000; i++) if (surgeLevel(i / 500) === 0) quiet++;
    expect(quiet / 60_000).toBeGreaterThan(0.9);
  });

  it('happen now and then, and never flash more than three times a second', () => {
    const rises: number[] = [];
    let prev = 0;
    for (let t = 0; t < 300; t += 0.002) {
      const level = surgeLevel(t);
      if (prev < 0.5 && level >= 0.5) rises.push(t);
      prev = level;
    }
    expect(rises.length).toBeGreaterThan(3);
    for (let i = 3; i < rises.length; i++) expect(rises[i] - rises[i - 3]).toBeGreaterThan(1);
  });
});
