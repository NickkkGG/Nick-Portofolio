import { expect, test } from '@playwright/test';
import { db, tapSpeakers } from './audio';
import { freeze, jumpTo, openExperience } from './helpers';

/** Bare back wall above the desk, at the opening camera (as in room.spec). */
const WALL = { x: 880, y: 120 };

test('the very first knock is a full knock-knock, as loud as the knocks after it', async ({ page }) => {
  await page.addInitScript(tapSpeakers);
  await openExperience(page);
  // A real click on PLAY, as a visitor's: that starts the page's audio, before any knock.
  await page.getByRole('button', { name: /PLAY/ }).click();
  await expect(page.getByTestId('loader')).toHaveCount(0);
  await freeze(page);
  await jumpTo(page, 0.0005);
  // The music off again, to hear the knocks alone.
  await page.getByRole('button', { name: 'Music' }).click();
  await page.waitForTimeout(2000);
  // A visit collects garbage all along, and Safari drops its HRTF data with the last
  // panner that holds it (knock.ts): have that happen before the knocks.
  await page.evaluate(() => {
    const junk: object[][] = [];
    for (let i = 0; i < 40; i++) junk.push(new Array(1_000_000).fill({ i }));
    return junk.length;
  });
  await page.waitForTimeout(400);

  const knockAt = async (sceneTime: number) => {
    await page.evaluate((time) => window.__experience!.setTime(time), sceneTime);
    const audioTime = await page.evaluate(() => window.__audio?.currentTime ?? 0);
    await page.mouse.click(WALL.x, WALL.y);
    await page.waitForTimeout(1200);
    return audioTime;
  };
  const firstAt = await knockAt(100);
  // Well past the cooldown, by the scene clock.
  const laterAt = await knockAt(110);
  const levels = await page.evaluate(() => window.__levels ?? []);
  const loudest = (from: number, to: number) => Math.max(-200, ...levels.filter(([t]) => t >= from && t < to).map(([, rms]) => db(rms)));
  const knuckles = (clickAt: number) => {
    const start = levels.find(([t, rms]) => t >= clickAt && db(rms) > -45)?.[0] ?? Infinity;
    return { first: loudest(start, start + 0.12), second: loudest(start + 0.2, start + 0.36), between: loudest(start + 0.16, start + 0.2) };
  };
  const first = knuckles(firstAt);
  const later = knuckles(laterAt);
  expect(later.first, 'a knock is heard at all').toBeGreaterThan(-20);
  expect(Math.abs(first.first - later.first)).toBeLessThan(4);
  expect(Math.abs(first.second - later.second)).toBeLessThan(4);
  // Two knocks, not one long one: it goes quiet in between.
  expect(first.between).toBeLessThan(Math.min(first.first, first.second) - 8);
});
