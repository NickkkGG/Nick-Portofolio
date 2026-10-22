import { expect, test } from '@playwright/test';
import { jumpTo, openExperience, play, state, waitFrames } from './helpers';

test('nav lands in the right chapter from anywhere', async ({ page }) => {
  await openExperience(page);
  await play(page);
  const targets: [string, string][] = [
    ['WORK', 'spiral'],
    ['ABOUT', 'problem'],
    ['CONTACT', 'contact'],
  ];
  for (const start of [0.05, 0.96]) {
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
