import { expect, test } from '@playwright/test';
import { openExperience, state } from './helpers';

const WARNING = 'WARNING — This tape contains flashing lights and loud sounds. Headphones recommended.';

test('warning and PLAY appear and PLAY starts the tape', async ({ page }) => {
  await openExperience(page);
  await expect(page.getByText(WARNING)).toBeVisible();
  await page.getByRole('button', { name: '▶ PLAY' }).click();
  await expect(page.getByTestId('loader')).toHaveCount(0);
  expect((await state(page)).started).toBe(true);
});

test('touch devices see the desktop note', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByText('Best experienced on a desktop with headphones.')).toBeVisible();
  await context.close();
});
