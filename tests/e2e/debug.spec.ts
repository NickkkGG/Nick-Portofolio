import { expect, test } from '@playwright/test';

test('debug tools only exist with ?debug', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.__experience === undefined)).toBe(true);
  await expect(page.getByText('Freeze time')).toHaveCount(0);

  await page.goto('/?debug&quiet');
  await page.waitForFunction(() => !!window.__experience);
  await page.waitForTimeout(500);
  await expect(page.getByText('Freeze time')).toHaveCount(0);

  await page.goto('/?debug');
  await page.waitForFunction(() => !!window.__experience);
  await expect(page.getByText('Freeze time')).toBeVisible();
});
