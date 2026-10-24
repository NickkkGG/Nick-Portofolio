import { expect, test } from '@playwright/test';
import { SLIDES } from '../../src/experience/chapters/booth/slides';
import { chapterP, freeze, jumpTo, openExperience, play } from './helpers';

test.describe('OSD', () => {
  test.beforeEach(async ({ page }) => {
    await openExperience(page);
    await play(page);
  });

  test('the OSD names every chapter', async ({ page }) => {
    await freeze(page);
    const cases: [number, string][] = [
      [chapterP('room', 0.5), 'CH-01 / ROOM'],
      [chapterP('fall', 0.5), 'CH-02 / FALL'],
      [chapterP('about', 0.5), 'CH-03 / ABOUT'],
      [chapterP('spiral', 0.5), 'CH-04 / WORK'],
      [chapterP('problem', 0.5), 'CH-05 / IDEAS'],
      [chapterP('stack', 0.5), 'CH-06 / STACK'],
      [chapterP('contact', 0.5), 'CH-07 / CONTACT'],
      [chapterP('loop', 0.5), 'CH-08 / LOOP'],
      [chapterP('loop', 0.95), 'CH-01 / ROOM'],
    ];
    for (const [p, label] of cases) {
      await jumpTo(page, p);
      await expect(page.getByTestId('osd-chapter'), `p=${p}`).toHaveText(label);
    }
  });

  test('in the booth it counts the slides, and only while one is up', async ({ page }) => {
    await freeze(page);
    const counter = page.getByTestId('slide-counter');
    const slide = (i: number) => chapterP('about', SLIDES.from + ((i + 0.5) * (SLIDES.to - SLIDES.from)) / 6);
    await jumpTo(page, slide(0));
    await expect(counter).toHaveText('SLIDE 01 / 06');
    await jumpTo(page, slide(2));
    await expect(counter).toHaveText('SLIDE 03 / 06');
    for (const p of [chapterP('about', 0.02), chapterP('about', 0.95), chapterP('spiral', 0.5)]) {
      await jumpTo(page, p);
      await expect(counter, `p=${p}`).toHaveCount(0);
    }
  });

  test('the loop counter appears after the first loop', async ({ page }) => {
    await expect(page.getByTestId('osd-loop')).toHaveCount(0);
    await jumpTo(page, 0.985);
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(150);
    }
    await expect(page.getByTestId('osd-loop')).toHaveText('LOOP 02');
  });
});
