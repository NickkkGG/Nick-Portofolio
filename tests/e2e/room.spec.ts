import { expect, test } from '@playwright/test';
import { freeze, jumpTo, openExperience, play, state, waitFrames } from './helpers';

/** Screen spots at the opening camera: bare back wall above the desk, and the monitor. */
const WALL = { x: 880, y: 120 };
const MONITOR = { x: 652, y: 362 };

/** The knocks among the logged sounds (PLAY and the story log theirs too). */
const knocks = <T extends { name: string }>(sounds: T[]) => sounds.filter((s) => s.name === 'knock');

test.describe('room', () => {
  test.beforeEach(async ({ page }) => {
    await openExperience(page);
    await play(page);
    await freeze(page);
    await jumpTo(page, 0.0005);
  });

  test('knocking on a wall is heard where it hit and raises the tension', async ({ page }) => {
    await page.mouse.click(WALL.x, WALL.y);
    await waitFrames(page, 2);
    const { sounds, tension } = await state(page);
    const heard = knocks(sounds);
    expect(heard).toHaveLength(1);
    // The back wall is the plane z = -1.18.
    expect(heard[0].position![2]).toBeCloseTo(-1.18, 2);
    expect(tension).toBe(1);
  });

  test('clicking the monitor does not knock', async ({ page }) => {
    await page.mouse.click(MONITOR.x, MONITOR.y);
    await waitFrames(page, 2);
    expect(knocks((await state(page)).sounds)).toEqual([]);
  });

  test('the walls stop answering once the floor starts to give', async ({ page }) => {
    await jumpTo(page, 0.07);
    await page.mouse.click(WALL.x, WALL.y);
    await waitFrames(page, 2);
    expect(knocks((await state(page)).sounds)).toEqual([]);
  });

  test('the cursor turns into a fist over a wall only', async ({ page }) => {
    const html = page.locator('html');
    await page.mouse.move(WALL.x, WALL.y);
    await expect(html).toHaveAttribute('data-cursor', 'knock');
    await page.mouse.move(MONITOR.x, MONITOR.y);
    await expect(html).not.toHaveAttribute('data-cursor', 'knock');
  });

  test('the knock hint appears after five quiet seconds', async ({ page }) => {
    const hint = page.getByTestId('knock-hint');
    await expect(hint).toHaveCount(0);
    await page.evaluate(() => window.__experience!.freezeTime(false));
    await expect(hint).toBeVisible({ timeout: 9000 });
  });
});
