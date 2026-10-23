import { describe, expect, it } from 'vitest';
import { getChapter } from '@/timeline/chapters';
import { blendedOffset, CLIPS, type ClipMix, depthsMix, looping, roomMix, scrubbed, spiralMix, STEP_FORWARD } from './poses';

const at = (id: Parameters<typeof getChapter>[0], t: number) => {
  const c = getChapter(id);
  return c.start + (c.end - c.start) * t;
};
const total = (mix: ClipMix[]) => mix.reduce((sum, m) => sum + m.weight, 0);
const only = (mix: ClipMix[]) => mix.filter((m) => m.weight > 1e-6).map((m) => m.clip);

describe('the character poses', () => {
  it('loops follow the scene clock and wrap, so a frozen clock freezes the figure', () => {
    expect(looping('SitType', 1.5).time).toBeCloseTo(1.5, 9);
    expect(looping('SitType', CLIPS.SitType + 1.5).time).toBeCloseTo(1.5, 9);
    expect(looping('Fall', -0.5).time).toBeCloseTo(CLIPS.Fall - 0.5, 9);
    expect(roomMix(3.2)).toEqual(roomMix(3.2));
  });

  it('a scrubbed clip never reaches the instant three.js would wrap to its start', () => {
    expect(scrubbed('StandUp', 0).time).toBe(0);
    expect(scrubbed('StandUp', 1).time).toBeLessThan(CLIPS.StandUp);
    expect(scrubbed('StandUp', 1.4).time).toBeLessThan(CLIPS.StandUp);
  });

  it('stands on the pillar through the project world', () => {
    expect(only(spiralMix(2))).toEqual(['Stand']);
    expect(total(spiralMix(7.5))).toBeCloseTo(1, 9);
  });

  it('sits hunched through the problems, gets up with the idea and stands for the tapes', () => {
    expect(only(depthsMix(at('problem', 0.5), 1))).toEqual(['SitHunched']);
    expect(only(depthsMix(at('stack', 0.25), 1))).toEqual(['StandUp']);
    expect(only(depthsMix(at('contact', 0.5), 1))).toEqual(['Stand']);
    expect(only(depthsMix(at('loop', 0.2), 1))).toEqual(['Stand']);
    for (let t = 0; t <= 1; t += 0.01) expect(total(depthsMix(at('stack', t), 2.3)), `stack ${t}`).toBeCloseTo(1, 9);
  });

  it('getting up ends a step forward, and standing carries on from there without a jump', () => {
    // The rise's last frame stands over the feet; the standing clip plays from one step on.
    const before = depthsMix(at('stack', 0.449), 1);
    const after = depthsMix(at('stack', 0.451), 1);
    expect(blendedOffset(before)[2]).toBeLessThan(blendedOffset(after)[2] + 1e-9);
    expect(blendedOffset(depthsMix(at('contact', 0.5), 1))).toEqual(STEP_FORWARD);
    expect(blendedOffset(depthsMix(at('problem', 0.5), 1))).toEqual([0, 0, 0]);
  });
});
