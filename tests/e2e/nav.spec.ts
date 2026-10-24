import { expect, test } from '@playwright/test';
import { chapterP, jumpTo, openExperience, play, state, waitFrames } from './helpers';

test('nav lands in the right chapter from anywhere', async ({ page }) => {
  await openExperience(page);
  await play(page);
  const targets: [string, string][] = [
    ['ABOUT', 'about'],
    ['WORK', 'spiral'],
    ['CONTACT', 'contact'],
  ];
  for (const start of [chapterP('room', 0.5), chapterP('loop', 0.5)]) {
    for (const [button, chapter] of targets) {
      await jumpTo(page, start);
      await page.getByRole('button', { name: button }).click();
      await waitFrames(page, 3);
      const s = await state(page);
      expect(s.displayChapterId, `${button} from ${start}`).toBe(chapter);
      expect(s.loopIndex, `${button} from ${start}`).toBe(1);
    }
  }
});

test('ABOUT lands on the first slide, not in the dust of the crash', async ({ page }) => {
  await openExperience(page);
  await play(page);
  await page.getByRole('button', { name: 'ABOUT' }).click();
  await waitFrames(page, 3);
  await expect(page.getByTestId('slide-counter')).toHaveText('SLIDE 01 / 06');
});
