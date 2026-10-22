import { describe, expect, it } from 'vitest';
import { boundarySpike } from './transitions';

describe('boundarySpike', () => {
  it('crossing into the fall gives the biggest tape glitch', () => {
    expect(boundarySpike(0.099, 0.101)).toBe(0.9);
  });

  it('crossing any other chapter boundary, either way, gives a smaller glitch', () => {
    expect(boundarySpike(0.259, 0.261)).toBe(0.35);
    expect(boundarySpike(0.561, 0.559)).toBe(0.35);
    expect(boundarySpike(0.101, 0.099)).toBe(0.35);
  });

  it('a fast scroll over several boundaries still counts the floor break', () => {
    expect(boundarySpike(0.05, 0.3)).toBe(0.9);
  });

  it('no boundary crossed, or a loop wrap, gives nothing', () => {
    expect(boundarySpike(0.3, 0.31)).toBe(0);
    expect(boundarySpike(0.99, 0.01)).toBe(0);
    expect(boundarySpike(0.01, 0.99)).toBe(0);
  });
});
