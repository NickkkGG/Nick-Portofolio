import { expect, test } from '@playwright/test';
import { freeze, jumpTo, openExperience, play } from './helpers';

/** Screen spots at 1280 x 720: a keycap passing in front at p 0.77, the GITHUB tape (top right) at p 0.885, and empty dark. */
const KEYCAP = { x: 770, y: 222 };
const GITHUB_TAPE = { x: 875, y: 348 };
const EMPTY = { x: 200, y: 140 };

test.describe('down in the depths', () => {
  test.beforeEach(async ({ page }) => {
    await openExperience(page);
    await play(page);
    await freeze(page);
  });

  test('a keycap under the pointer can be pressed', async ({ page }) => {
    await jumpTo(page, 0.77);
    const html = page.locator('html');
    await page.mouse.move(KEYCAP.x, KEYCAP.y);
    await expect(html).toHaveAttribute('data-cursor', 'pointer');
    await page.mouse.move(EMPTY.x, EMPTY.y);
    await expect(html).not.toHaveAttribute('data-cursor', 'pointer');
  });

  test('clicking a tape opens its link', async ({ page, context }) => {
    await context.route('https://github.com/**', (route) => route.fulfill({ body: 'tape' }));
    await jumpTo(page, 0.885);
    await page.mouse.move(GITHUB_TAPE.x, GITHUB_TAPE.y);
    await expect(page.locator('html')).toHaveAttribute('data-cursor', 'pointer');
    const opened = context.waitForEvent('page');
    await page.mouse.click(GITHUB_TAPE.x, GITHUB_TAPE.y);
    await (await opened).waitForURL('https://github.com/example');
  });

  test('a tape under the pointer slides out and names its address', async ({ page }) => {
    await jumpTo(page, 0.885);
    const hint = page.getByTestId('tape-hint');
    await expect(hint).toHaveText('▸ pick a tape · 4 on the shelf');
    await page.mouse.move(GITHUB_TAPE.x, GITHUB_TAPE.y);
    await expect(hint).toHaveText('▸ github.com/example');
    await page.mouse.move(EMPTY.x, EMPTY.y);
    await expect(hint).toHaveText('▸ pick a tape · 4 on the shelf');
  });

  test('the keycaps are gone once the tapes are up', async ({ page }) => {
    await jumpTo(page, 0.885);
    await page.mouse.move(KEYCAP.x, KEYCAP.y);
    await expect(page.locator('html')).not.toHaveAttribute('data-cursor', 'pointer');
  });
});
