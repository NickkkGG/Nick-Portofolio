import { describe, expect, it } from 'vitest';
import { getChapter } from '@/timeline/chapters';
import { BEAM_OUT_T } from '@/experience/chapters/booth/slides';
import { blendedOffset, boothMix, CLIPS, type ClipMix, looping, roomMix, scrubbed, STEP_FORWARD } from './poses';

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

  it('in the booth the figure sits hunched on its crate through the slides', () => {
    for (const t of [0, 0.3, 0.8]) expect(only(boothMix(at('about', t), 1.2))).toEqual(['SitHunched']);
  });

  it('getting up blends whole from sitting to standing, and the step forward never jumps back', () => {
    // The rise's last frame stands over the feet; the standing clip plays from one step on.
    let last = 0;
    for (let t = BEAM_OUT_T - 0.02; t <= 1; t += 0.002) {
      const mix = boothMix(at('about', t), 2.3);
      expect(total(mix), `about ${t}`).toBeCloseTo(1, 9);
      expect(blendedOffset(mix)[2], `about ${t}`).toBeGreaterThanOrEqual(last - 1e-9);
      last = blendedOffset(mix)[2];
    }
  });

  it('it gets up once the sheet is down, and ends a step forward at the window', () => {
    const rising = boothMix(at('about', 0.915), 1.2);
    expect(only(rising)).toContain('StandUp');
    expect(total(rising)).toBeCloseTo(1);
    const stood = boothMix(at('about', 0.99), 1.2);
    expect(only(stood)).toEqual(['Stand']);
    expect(blendedOffset(stood)).toEqual(STEP_FORWARD);
    expect(only(boothMix(at('about', BEAM_OUT_T - 0.01), 1.2))).toEqual(['SitHunched']);
  });

  it('it keeps standing at the window while the camera tours the monitors', () => {
    const work = boothMix(at('spiral', 0.1), 2);
    expect(only(work)).toEqual(['Stand']);
    expect(blendedOffset(work)).toEqual(STEP_FORWARD);
  });
});
