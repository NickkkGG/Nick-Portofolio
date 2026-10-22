import { expect, test } from '@playwright/test';
import { cameraPoseAt } from '../../src/experience/camera/paths';
import { freeze, jumpTo, openExperience, play, shot, state } from './helpers';
import { brightRatio } from './utils/image';

test.describe('canvas', () => {
  test.beforeEach(async ({ page }) => {
    await openExperience(page);
    await play(page);
    await freeze(page);
  });

  test('the camera follows the path', async ({ page }) => {
    await jumpTo(page, 0.41);
    const { camera } = await state(page);
    const expected = cameraPoseAt(0.41, 6).position;
    expect(camera).not.toBeNull();
    camera!.position.forEach((value, i) => expect(Math.abs(value - expected[i])).toBeLessThan(1e-3));
  });

  test('the room renders at the start', async ({ page }) => {
    await jumpTo(page, 0.0005);
    // The page background alone is ~0.023 luma, so require clearly lit pixels instead of a mean.
    expect(brightRatio(await shot(page, { maskOverlay: true }), 0.15)).toBeGreaterThan(0.01);
  });
});
