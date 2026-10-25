import { expect, test } from '@playwright/test';
import { chapterP, freeze, jumpTo, openExperience, play, state, waitFrames } from './helpers';

const FRAMES: [name: string, p: number, chapter: string][] = [
  ['01-room', chapterP('room', 0.5), 'room'],
  ['02-fall', chapterP('fall', 0.5), 'fall'],
  ['03-about', chapterP('about', 0.3), 'about'],
  ['03b-about-drop', chapterP('about', 0.862), 'about'],
  ['04-spiral', chapterP('spiral', 0.5), 'spiral'],
  ['05-stack-dark', chapterP('stack', 0.08), 'stack'],
  ['05b-stack-wall', chapterP('stack', 0.8), 'stack'],
  ['06-contact', chapterP('contact', 0.5), 'contact'],
  ['07-loop', chapterP('loop', 0.625), 'loop'],
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
