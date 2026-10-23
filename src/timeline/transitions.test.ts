import { describe, expect, it } from 'vitest';
import { getChapter } from './chapters';
import { boundarySpike, glassAt } from './transitions';

describe('boundarySpike', () => {
  it('crossing into the fall gives the biggest tape glitch', () => {
    expect(boundarySpike(0.099, 0.101)).toBe(0.9);
  });

  it('crossing any other chapter boundary, either way, gives a light skip (the glass does the rest)', () => {
    expect(boundarySpike(0.259, 0.261)).toBe(0.15);
    expect(boundarySpike(0.561, 0.559)).toBe(0.15);
    expect(boundarySpike(0.101, 0.099)).toBe(0.15);
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

describe('glassAt', () => {
  it('is clear glass, nothing at all, away from chapter changes', () => {
    for (const p of [0, 0.0005, 0.05, 0.07, 0.18, 0.311, 0.398, 0.5, 0.64, 0.7, 0.704, 0.77, 0.87, 0.97, 0.9995]) {
      expect(glassAt(p).amount, `p=${p}`).toBe(0);
    }
  });

  it('thickens toward each chapter change and is thickest on it', () => {
    for (const id of ['fall', 'spiral', 'problem', 'stack', 'contact', 'loop'] as const) {
      const b = getChapter(id).start;
      const at = glassAt(b).amount;
      expect(at, id).toBeGreaterThan(0.4);
      expect(glassAt(b - 0.005).amount, id).toBeLessThan(at);
      expect(glassAt(b - 0.005).amount, id).toBeGreaterThan(0);
      expect(glassAt(b + 0.005).amount, id).toBeLessThan(at);
      expect(glassAt(b + 0.005).amount, id).toBeGreaterThan(0);
    }
  });

  it('is the same either side of the change, except where the floor gives way', () => {
    for (const id of ['spiral', 'problem', 'stack', 'contact', 'loop'] as const) {
      const b = getChapter(id).start;
      expect(Math.abs(glassAt(b - 0.004).amount - glassAt(b + 0.004).amount), id).toBeLessThan(1e-9);
    }
  });

  it('creeps in slowly over the end of the room, and clears quickly once the camera drops', () => {
    const b = getChapter('fall').start;
    // Over the last of the room the glass rises a little every step of the scroll, never in a jump.
    let previous = 0;
    for (let p = b - 0.03 + 0.001; p <= b; p += 0.001) {
      const amount = glassAt(p).amount;
      expect(amount, `p=${p}`).toBeGreaterThan(previous);
      expect(amount - previous, `p=${p}`).toBeLessThan(0.06);
      previous = amount;
    }
    expect(glassAt(b - 0.02).amount).toBeGreaterThan(0.05);
    expect(glassAt(b + 0.015).amount).toBe(0);
    expect(glassAt(b - 0.01).amount).toBeGreaterThan(glassAt(b + 0.01).amount);
  });

  it('the big descents go through the thickest glass', () => {
    const at = (id: 'spiral' | 'problem' | 'stack') => glassAt(getChapter(id).start).amount;
    expect(at('spiral')).toBe(1);
    expect(at('problem')).toBe(1);
    expect(at('stack')).toBeLessThan(at('problem'));
  });

  it('each chapter change has its own pane, so no two look the same', () => {
    const seeds = new Set(['fall', 'spiral', 'problem', 'stack', 'contact', 'loop'].map((id) => glassAt(getChapter(id as 'fall').start).seed));
    expect(seeds.size).toBe(6);
  });
});
