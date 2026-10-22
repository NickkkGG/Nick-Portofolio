import { expect, type Page, test } from '@playwright/test';
import { freeze, jumpTo, openExperience, play } from './helpers';
import { diffRatio } from './utils/image';

/** Everything the overlay says, minus the timecode (which rolls back like a rewound tape). */
async function overlayText(page: Page): Promise<string> {
  const text = await page.getByTestId('overlay').innerText();
  return text.replace(/\d\d:\d\d:\d\d/g, '').replace(/\s+/g, ' ').trim();
}

test('the loop seam is invisible', async ({ page }) => {
  await openExperience(page);
  await play(page);
  await freeze(page);
  const mask = [page.getByTestId('timecode')];

  await jumpTo(page, 0.0005);
  const start = await page.screenshot({ mask, maskColor: '#000000' });
  const startText = await overlayText(page);

  await jumpTo(page, 0.9995);
  const end = await page.screenshot({ mask, maskColor: '#000000' });
  const endText = await overlayText(page);

  // Pixels catch a camera or scene jump; a few glyphs of wrong UI text stay under 1%
  // of the frame, so the UI is compared as text.
  expect(diffRatio(start, end, 8)).toBeLessThanOrEqual(0.01);
  expect(endText).toBe(startText);
});
