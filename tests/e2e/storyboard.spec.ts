import { expect, test } from '@playwright/test';
import { freeze, jumpTo, openExperience, play, state, waitFrames } from './helpers';

const FRAMES: [name: string, p: number, chapter: string][] = [
  ['01-room', 0.05, 'room'],
  ['02-fall', 0.18, 'fall'],
  ['03-spiral', 0.41, 'spiral'],
  ['04-problem', 0.64, 'problem'],
  ['04b-problem-bulb', 0.7, 'problem'],
  ['05-stack', 0.77, 'stack'],
  ['06-contact', 0.87, 'contact'],
  ['07-loop', 0.97, 'loop'],
];

test('capture the storyboard', async ({ page }) => {
  await openExperience(page);
  await play(page);
  await freeze(page);
  for (const [name, p, chapter] of FRAMES) {
    await jumpTo(page, p);
    await waitFrames(page, 4);
    expect((await state(page)).displayChapterId, name).toBe(chapter);
    await page.screenshot({ path: `tests/e2e/__storyboard__/${name}.png` });
  }
});
