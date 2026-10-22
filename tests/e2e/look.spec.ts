import { expect, test } from '@playwright/test';
import { freeze, jumpTo, openExperience, play, shot } from './helpers';
import { litBlockRatio } from './utils/image';

test.describe('look', () => {
  test.beforeEach(async ({ page }) => {
    await openExperience(page);
    await play(page);
    await freeze(page);
  });

  test('the room reads clearly instead of a black frame', async ({ page }) => {
    await jumpTo(page, 0.05);
    // Block averages ignore film grain; at least a third of the frame shows lit surfaces.
    expect(litBlockRatio(await shot(page, { maskOverlay: true }), 16, 0.12)).toBeGreaterThanOrEqual(0.35);
  });

  test('the focused project monitor fills a big part of the frame', async ({ page }) => {
    await jumpTo(page, 0.398); // camera parked at monitor 03
    // Share of 16 px blocks that are screen-bright: tiny bright particles never fill a whole block.
    expect(litBlockRatio(await shot(page, { maskOverlay: true }), 16, 0.7)).toBeGreaterThanOrEqual(0.12);
  });
});
