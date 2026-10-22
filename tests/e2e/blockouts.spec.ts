import { expect, test } from '@playwright/test';
import { freeze, jumpTo, openExperience, play, shot } from './helpers';
import { brightRatio } from './utils/image';

test('every middle chapter shows something', async ({ page }) => {
  await openExperience(page);
  await play(page);
  await freeze(page);
  for (const p of [0.18, 0.41, 0.64, 0.77, 0.87]) {
    await jumpTo(page, p);
    const lit = brightRatio(await shot(page, { maskOverlay: true }), 0.15);
    expect(lit, `p=${p}`).toBeGreaterThan(0.005);
  }
});
