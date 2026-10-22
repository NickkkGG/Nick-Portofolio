import { describe, expect, it } from 'vitest';
import { handheldOffset, parallaxOffset } from './handheld';

describe('handheldOffset', () => {
  it('sways a few centimetres, never more, and never stops', () => {
    let maxPosition = 0;
    let maxTarget = 0;
    for (let i = 0; i < 4000; i++) {
      const { position, target } = handheldOffset(i * 0.05);
      maxPosition = Math.max(maxPosition, ...position.map(Math.abs));
      maxTarget = Math.max(maxTarget, ...target.map(Math.abs));
    }
    expect(maxPosition).toBeLessThanOrEqual(0.025);
    expect(maxTarget).toBeLessThanOrEqual(0.04);
    expect(maxPosition).toBeGreaterThan(0.008);
  });

  it('is smooth: a 60 fps frame moves it less than a millimetre', () => {
    for (let i = 0; i < 600; i++) {
      const a = handheldOffset(i / 60);
      const b = handheldOffset((i + 1) / 60);
      for (let k = 0; k < 3; k++) expect(Math.abs(a.position[k] - b.position[k])).toBeLessThan(0.001);
    }
  });

  it('is a pure function of time, so frozen screenshots repeat', () => {
    expect(handheldOffset(1.23)).toEqual(handheldOffset(1.23));
  });
});

describe('parallaxOffset', () => {
  it('centred pointer leaves the camera alone', () => {
    expect(parallaxOffset(0, 0)).toEqual([0, 0, 0]);
  });

  it('moves the camera with the pointer, a little more sideways than up', () => {
    const [x, y, z] = parallaxOffset(1, 1);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
    expect(x).toBeGreaterThan(y);
    expect(x).toBeLessThanOrEqual(0.15);
    expect(z).toBe(0);
  });

  it('clamps pointers outside the window', () => {
    expect(parallaxOffset(5, -5)).toEqual(parallaxOffset(1, -1));
  });
});
