import { expect, test } from '@playwright/test';
import { openExperience, play, state } from './helpers';

test('the music switch turns the soundtrack off, and the next visit remembers', async ({ page }) => {
  await openExperience(page);
  await play(page);
  const toggle = page.getByRole('button', { name: 'Music' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect((await state(page)).music).toBe(true);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect((await state(page)).music).toBe(false);

  await openExperience(page);
  await play(page);
  await expect(page.getByRole('button', { name: 'Music' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Music' }).click();
  expect((await state(page)).music).toBe(true);
});
