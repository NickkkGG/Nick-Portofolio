import { expect, test } from '@playwright/test';
import { LOOP_TELEPORT_P } from '../../src/timeline/loop';
import { freeze, jumpTo, openExperience, play, shot, waitFrames } from './helpers';
import { diffRatio, meanLuminance } from './utils/image';

test.describe('VHS effect', () => {
  test.beforeEach(async ({ page }) => {
    await openExperience(page);
    await play(page);
    await freeze(page);
  });

  test('the loop teleport is fully black', async ({ page }) => {
    await jumpTo(page, LOOP_TELEPORT_P);
    // The bare page background is ~0.023, so this only passes with the blackout.
    expect(meanLuminance(await shot(page, { maskOverlay: true }))).toBeLessThan(0.01);
  });

  test('frozen time renders identical frames', async ({ page }) => {
    await jumpTo(page, 0.41);
    const a = await shot(page, { maskOverlay: true });
    await waitFrames(page, 5);
    const b = await shot(page, { maskOverlay: true });
    expect(diffRatio(a, b, 8)).toBe(0);
  });
});
