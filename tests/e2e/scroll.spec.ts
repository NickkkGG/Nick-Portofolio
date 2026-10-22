import { expect, test } from '@playwright/test';
import { jumpTo, openExperience, play, state, waitForScene, waitFrames } from './helpers';

test.describe('infinite scroll', () => {
  test.beforeEach(async ({ page }) => {
    await openExperience(page);
  });

  test('wheel scrolling moves p after PLAY', async ({ page }) => {
    await play(page);
    await page.mouse.wheel(0, 600);
    await page.mouse.wheel(0, 600);
    await expect.poll(async () => (await state(page)).p).toBeGreaterThan(0);
  });

  test('a forward wrap counts a loop', async ({ page }) => {
    await play(page);
    await jumpTo(page, 0.985);
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(150);
    }
    await expect.poll(async () => (await state(page)).loopIndex).toBe(2);
    expect((await state(page)).p).toBeLessThan(0.5);
  });

  test('a backward wrap from the start stays at loop 1', async ({ page }) => {
    await play(page);
    await jumpTo(page, 0.01);
    await page.mouse.wheel(0, -800);
    await expect.poll(async () => (await state(page)).p).toBeGreaterThan(0.9);
    expect((await state(page)).loopIndex).toBe(1);
  });

  test('resize keeps the story position', async ({ page }) => {
    await play(page);
    await jumpTo(page, 0.41);
    await page.setViewportSize({ width: 1000, height: 640 });
    await waitFrames(page, 5);
    const s = await state(page);
    expect(Math.abs(s.p - 0.41)).toBeLessThan(0.005);
    expect(s.displayChapterId).toBe('spiral');
  });

  test('reload starts at the room', async ({ page }) => {
    await play(page);
    await jumpTo(page, 0.5);
    await page.reload();
    await waitForScene(page);
    const s = await state(page);
    expect(s.p).toBeLessThan(1e-6);
    expect(s.scrollY).toBe(0);
  });

  test('Home and End never fake a loop', async ({ page }) => {
    await play(page);
    await jumpTo(page, 0.41);
    await page.keyboard.press('End');
    await waitFrames(page, 5);
    let s = await state(page);
    expect(Math.abs(s.p - 0.41)).toBeLessThan(0.002);
    expect(s.loopIndex).toBe(1);
    await page.keyboard.press('Home');
    await waitFrames(page, 5);
    s = await state(page);
    expect(s.p).toBeLessThan(0.01);
    expect(s.loopIndex).toBe(1);
  });

  test('input before PLAY does not move the story', async ({ page }) => {
    await page.mouse.wheel(0, 1500);
    await waitFrames(page, 10);
    expect((await state(page)).p).toBe(0);
  });
});
