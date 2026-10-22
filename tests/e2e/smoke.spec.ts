import { expect, test } from '@playwright/test';

test('page loads and WebGL2 is available', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  const hasWebGL2 = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
  expect(hasWebGL2).toBe(true);
});
