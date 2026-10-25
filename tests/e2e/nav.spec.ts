import { expect, test } from '@playwright/test';
import { chapterP, freeze, jumpTo, openExperience, play, state, waitFrames } from './helpers';

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

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

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('the top bar fits: REC, nav and music clear of each other and of the chapter titles', async ({ page }) => {
    await openExperience(page);
    await play(page);
    await freeze(page);
    // CONTACT's title sits highest of all the chapter texts.
    await jumpTo(page, chapterP('contact', 0.65));
    const names = ['REC', 'name', 'ABOUT', 'WORK', 'CONTACT', 'MUSIC'];
    const pieces = [
      page.getByTestId('osd-rec'),
      page.getByTestId('osd-name'),
      ...(await page.locator('nav button').all()),
      page.getByTestId('music-toggle'),
    ];
    expect(pieces).toHaveLength(names.length);
    for (const width of [320, 360, 375, 390, 430]) {
      await page.setViewportSize({ width, height: 812 });
      await waitFrames(page, 2);
      const boxes = (await Promise.all(pieces.map((piece) => piece.boundingBox()))) as Box[];
      boxes.forEach((box, i) => {
        expect(box.x, `${width}px, ${names[i]}`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${width}px, ${names[i]}`).toBeLessThanOrEqual(width);
        boxes.slice(i + 1).forEach((other, j) => {
          expect(overlaps(box, other), `${width}px, ${names[i]} and ${names[i + 1 + j]}`).toBe(false);
        });
      });
      const barBottom = Math.max(...boxes.map((box) => box.y + box.height));
      const title = await page.getByTestId('chapter-texts').locator('[data-overlay-item]').first().boundingBox();
      expect(title!.y, `${width}px`).toBeGreaterThan(barBottom);
    }
  });
});
