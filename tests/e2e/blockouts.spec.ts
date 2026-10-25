import { expect, test } from '@playwright/test';
import { chapterP, freeze, jumpTo, openExperience, play, shot } from './helpers';
import { brightRatio } from './utils/image';

test('every middle chapter shows something', async ({ page }) => {
  await openExperience(page);
  await play(page);
  await freeze(page);
  for (const id of ['fall', 'about', 'spiral', 'stack', 'contact'] as const) {
    await jumpTo(page, chapterP(id, 0.5));
    const lit = brightRatio(await shot(page, { maskOverlay: true }), 0.15);
    expect(lit, id).toBeGreaterThan(0.005);
  }
});
