import { describe, expect, it } from 'vitest';
import { DUST, dustFront, dustThreshold, flakeAt } from './dust';

/** Points of the figure at rest (character.glb is in an A-pose): a fingertip, a toe, the crown, the chest. */
const FINGERTIP = [0.52, 0.9, 0.17] as const;
const TOE = [0.18, 0.01, 0.18] as const;
const CROWN = [0, 1.63, 0.05] as const;
const CHEST = [0, 1.15, 0.08] as const;

describe('the figure turning to dust', () => {
  it('stays whole until near the end of the fall, and is all dust before the booth roof', () => {
    expect(dustFront(0.3)).toBe(0);
    expect(dustFront(DUST.start)).toBe(0);
    expect(DUST.start).toBeGreaterThan(0.5);
    expect(dustFront(DUST.end)).toBe(1);
    expect(DUST.end).toBeLessThan(0.93);
    let last = 0;
    for (let t = 0; t <= 1; t += 0.01) {
      expect(dustFront(t), `t=${t}`).toBeGreaterThanOrEqual(last);
      last = dustFront(t);
    }
  });

  it('crumbles from the fingers and toes in, the chest last', () => {
    const fingertip = dustThreshold(FINGERTIP);
    const toe = dustThreshold(TOE);
    expect(fingertip).toBeLessThan(0.25);
    expect(toe).toBeLessThan(0.25);
    expect(dustThreshold(CROWN)).toBeGreaterThan(Math.max(fingertip, toe) + 0.2);
    expect(dustThreshold(CHEST)).toBeGreaterThan(dustThreshold(CROWN));
    expect(dustThreshold(CHEST)).toBeLessThan(1);
  });

  it('lets a flake go where the surface was, then blows it up and away, smaller and smaller', () => {
    expect(flakeAt(-0.01, 0.4, 3).size).toBe(0);
    const off = flakeAt(0, 0.4, 3);
    expect(Math.hypot(...off.offset)).toBeLessThan(0.05);
    expect(off.size).toBe(1);
    expect(off.ash).toBe(0);
    const later = flakeAt(0.06, 0.4, 3);
    // Left behind by the fall: up past the figure, and blown off to the side.
    expect(later.offset[1]).toBeGreaterThan(0.3);
    expect(Math.hypot(later.offset[0], later.offset[2])).toBeGreaterThan(0.1);
    expect(later.size).toBeLessThan(1);
    expect(later.ash).toBe(1);
    expect(flakeAt(DUST.life, 0.4, 3).size).toBe(0);
  });

  it('keeps the dust stirring while the scroll holds still', () => {
    const now = flakeAt(0.05, 0.7, 10).offset;
    const soon = flakeAt(0.05, 0.7, 10.5).offset;
    expect(Math.hypot(now[0] - soon[0], now[1] - soon[1], now[2] - soon[2])).toBeGreaterThan(0.02);
  });
});
