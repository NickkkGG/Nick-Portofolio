import { expect, type Page, test } from '@playwright/test';
import { db, tapSpeakers } from './audio';
import { freeze, jumpTo, openExperience, state } from './helpers';

/** The page's loudness over the next `ms`, from its audio clock: the median and the loudest 10 ms, in dB. */
async function listen(page: Page, ms: number): Promise<{ median: number; loudest: number }> {
  const from = await page.evaluate(() => window.__audio?.currentTime ?? 0);
  await page.waitForTimeout(ms);
  const heard = (await page.evaluate(() => window.__levels ?? []))
    .filter(([t]) => t >= from)
    .map(([, rms]) => db(rms))
    .sort((a, b) => a - b);
  return { median: heard[Math.floor(heard.length / 2)] ?? -200, loudest: heard[heard.length - 1] ?? -200 };
}

const names = async (page: Page) => (await state(page)).sounds.map((s) => s.name);

test.describe('the sounds of the scene', () => {
  test.beforeEach(async ({ page }) => {
    // The music off from the start, to hear the scene alone.
    await page.addInitScript(() => window.localStorage.setItem('music', 'off'));
    await page.addInitScript(tapSpeakers);
    await openExperience(page);
  });

  test('PLAY switches the set on with a sound', async ({ page }) => {
    const play = page.getByRole('button', { name: /PLAY/ });
    const start = listen(page, 1500);
    await play.click();
    expect((await start).loudest).toBeGreaterThan(-30);
    expect(await names(page)).toContain('power-on');
  });

  test('static hisses among the projects, well over the hum of the room', async ({ page }) => {
    await page.getByRole('button', { name: /PLAY/ }).click();
    await page.waitForTimeout(2500);
    const room = await listen(page, 1500);
    await jumpTo(page, 0.4);
    await page.waitForTimeout(300);
    const projects = await listen(page, 1500);
    expect(room.median, 'the room hums').toBeGreaterThan(-60);
    expect(projects.median, 'static is heard').toBeGreaterThan(-40);
    expect(projects.median).toBeGreaterThan(room.median + 3);
  });

  test('scrolling down out of the room breaks the floor, loudly', async ({ page }) => {
    await page.getByRole('button', { name: /PLAY/ }).click();
    await page.waitForTimeout(2000);
    await jumpTo(page, 0.09);
    const fall = listen(page, 2000);
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(120);
    }
    expect((await fall).loudest).toBeGreaterThan(-20);
    expect(await names(page)).toContain('floor-break');
  });

  test('the nav switches channel', async ({ page }) => {
    await page.getByRole('button', { name: /PLAY/ }).click();
    await page.waitForTimeout(1500);
    const heard = listen(page, 800);
    await page.getByRole('button', { name: 'ABOUT' }).click();
    expect((await heard).loudest).toBeGreaterThan(-32);
    expect(await names(page)).toContain('channel');
  });
});

test.describe('chapter texts decode off the tape', () => {
  test('a text comes in as tape noise and settles into its words, which the page holds all along', async ({ page }) => {
    await openExperience(page);
    await page.evaluate(() => window.__experience!.play());
    await page.waitForTimeout(1000);
    await jumpTo(page, 0.311);
    const texts = page.getByTestId('chapter-texts');
    await expect(texts).toContainText('Project 01');
    expect(await texts.locator('[data-glyph]').count()).toBeGreaterThan(0);
    await expect(texts.locator('[data-glyph]')).toHaveCount(0);
    await expect(texts).toContainText('Project 01');
  });

  test('freezing the clock mid-decode shows the words at once, so screenshots hold still', async ({ page }) => {
    await openExperience(page);
    await page.evaluate(() => window.__experience!.play());
    await page.waitForTimeout(1000);
    await jumpTo(page, 0.311);
    expect(await page.locator('[data-glyph]').count()).toBeGreaterThan(0);
    await freeze(page);
    await expect(page.locator('[data-glyph]')).toHaveCount(0);
  });

  test("the OSD's chapter name decodes too, and still reads right", async ({ page }) => {
    await openExperience(page);
    await page.evaluate(() => window.__experience!.play());
    await page.waitForTimeout(1000);
    await jumpTo(page, 0.64);
    const label = page.getByTestId('osd-chapter');
    await expect(label).toHaveText('CH-04 / ABOUT');
    expect(await label.locator('[data-glyph]').count()).toBeGreaterThan(0);
    await expect(label.locator('[data-glyph]')).toHaveCount(0);
  });
});
