import { expect, test } from '@playwright/test';
import { freeze, jumpTo, openExperience, play } from './helpers';

test.describe('OSD', () => {
  test.beforeEach(async ({ page }) => {
    await openExperience(page);
    await play(page);
  });

  test('the OSD names every chapter', async ({ page }) => {
    await freeze(page);
    const cases: [number, string][] = [
      [0.05, 'CH-01 / ROOM'],
      [0.18, 'CH-02 / FALL'],
      [0.41, 'CH-03 / WORK'],
      [0.64, 'CH-04 / ABOUT'],
      [0.77, 'CH-05 / STACK'],
      [0.87, 'CH-06 / CONTACT'],
      [0.96, 'CH-07 / LOOP'],
      [0.995, 'CH-01 / ROOM'],
    ];
    for (const [p, label] of cases) {
      await jumpTo(page, p);
      await expect(page.getByTestId('osd-chapter'), `p=${p}`).toHaveText(label);
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
