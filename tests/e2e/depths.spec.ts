import { expect, type Page, test } from '@playwright/test';
import { content } from '../../src/content';
import { chapterP, freeze, jumpTo, openExperience, play, waitFrames } from './helpers';

/** Moments: the wall of tiles up in the stack, the tapes up in the contact chapter. */
const WALL = chapterP('stack', 0.8);
const TAPES = chapterP('contact', 0.65);
/** Screen spots at 1280 x 720 at those moments: the GITHUB tape (top right), and empty dark. */
const GITHUB_TAPE = { x: 978, y: 384 };
const EMPTY = { x: 200, y: 140 };
const WALL_HINT = `▸ point at a tile · ${content.stack.length} on the wall`;

/** A spot on a tile around the middle of the screen, where the tapes never come, and the tool it names. */
async function findTile(page: Page): Promise<{ x: number; y: number; name: string }> {
  const hint = page.getByTestId('tile-hint');
  const { width, height } = page.viewportSize()!;
  for (let y = Math.round(height * 0.4); y < height * 0.9; y += 24) {
    for (let x = Math.round(width / 2 - 100); x <= width / 2 + 100; x += 25) {
      await page.mouse.move(x, y);
      const text = (await hint.textContent()) ?? '';
      if (text !== WALL_HINT) return { x, y, name: text.replace('▸ ', '').split(' · ')[0] };
    }
  }
  throw new Error('no tile in the middle of the screen');
}

test.describe('down in the depths', () => {
  test.beforeEach(async ({ page }) => {
    await openExperience(page);
    await play(page);
    await freeze(page);
  });

  test('a tile under the pointer is picked: it names its tool, and the camcorder locks focus on it', async ({ page }) => {
    await jumpTo(page, WALL);
    const html = page.locator('html');
    const hint = page.getByTestId('tile-hint');
    const focus = page.getByTestId('focus-brackets');
    await expect(hint).toHaveText(WALL_HINT);
    await expect(focus).toHaveAttribute('data-state', 'off');
    const tile = await findTile(page);
    expect(content.stack.map((item) => item.name)).toContain(tile.name);
    await expect(html).toHaveAttribute('data-cursor', 'pointer');
    await expect(focus).toHaveAttribute('data-state', 'on');
    await waitFrames(page, 30);
    // The brackets frame the picked tile, the pointer inside them.
    const box = await focus.boundingBox();
    expect(box).not.toBeNull();
    expect(tile.x).toBeGreaterThan(box!.x);
    expect(tile.x).toBeLessThan(box!.x + box!.width);
    expect(tile.y).toBeGreaterThan(box!.y);
    expect(tile.y).toBeLessThan(box!.y + box!.height);
    await page.mouse.move(EMPTY.x, EMPTY.y);
    await expect(hint).toHaveText(WALL_HINT);
    await expect(focus).toHaveAttribute('data-state', 'off');
    await expect(html).not.toHaveAttribute('data-cursor', 'pointer');
  });

  test('clicking a tape opens its link', async ({ page, context }) => {
    await context.route('https://github.com/**', (route) => route.fulfill({ body: 'tape' }));
    await jumpTo(page, TAPES);
    await page.mouse.move(GITHUB_TAPE.x, GITHUB_TAPE.y);
    await expect(page.locator('html')).toHaveAttribute('data-cursor', 'pointer');
    const opened = context.waitForEvent('page');
    await page.mouse.click(GITHUB_TAPE.x, GITHUB_TAPE.y);
    await (await opened).waitForURL('https://github.com/NickkkGG');
  });

  test('a tape under the pointer slides out and names its address', async ({ page }) => {
    await jumpTo(page, TAPES);
    const hint = page.getByTestId('tape-hint');
    await expect(hint).toHaveText('▸ pick a tape · 4 on the shelf');
    await page.mouse.move(GITHUB_TAPE.x, GITHUB_TAPE.y);
    await expect(hint).toHaveText('▸ github.com/NickkkGG');
    await page.mouse.move(EMPTY.x, EMPTY.y);
    await expect(hint).toHaveText('▸ pick a tape · 4 on the shelf');
  });

  test('the camcorder locks focus on the tape under the pointer, and lets go after', async ({ page }) => {
    await jumpTo(page, TAPES);
    const focus = page.getByTestId('focus-brackets');
    await expect(focus).toHaveAttribute('data-state', 'off');
    await page.mouse.move(GITHUB_TAPE.x, GITHUB_TAPE.y);
    await expect(focus).toHaveAttribute('data-state', 'on');
    await waitFrames(page, 30);
    // The brackets frame the picked tape: the pointer is inside them, and they stay on the screen.
    const box = await focus.boundingBox();
    expect(box).not.toBeNull();
    expect(GITHUB_TAPE.x).toBeGreaterThan(box!.x);
    expect(GITHUB_TAPE.x).toBeLessThan(box!.x + box!.width);
    expect(GITHUB_TAPE.y).toBeGreaterThan(box!.y);
    expect(GITHUB_TAPE.y).toBeLessThan(box!.y + box!.height);
    expect(box!.x).toBeGreaterThan(0);
    expect(box!.x + box!.width).toBeLessThan(1280);
    await page.mouse.move(EMPTY.x, EMPTY.y);
    await expect(focus).toHaveAttribute('data-state', 'off');
  });

  test('the tiles are gone once the tapes are up', async ({ page }) => {
    await jumpTo(page, WALL);
    const tile = await findTile(page);
    await page.mouse.move(EMPTY.x, EMPTY.y);
    await jumpTo(page, TAPES);
    await page.mouse.move(tile.x, tile.y);
    await expect(page.locator('html')).not.toHaveAttribute('data-cursor', 'pointer');
  });
});

test.describe('down in the depths, on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test.beforeEach(async ({ page }) => {
    await openExperience(page);
    await play(page);
    await freeze(page);
  });

  test('a tapped tile stays picked once the finger lifts, until a tap somewhere else', async ({ page }) => {
    await jumpTo(page, WALL);
    const hint = page.getByTestId('tile-hint');
    const tile = await findTile(page);
    await page.mouse.move(5, 5);
    await expect(hint).toHaveText(WALL_HINT);
    await page.touchscreen.tap(tile.x, tile.y);
    await expect(hint).toHaveText(`▸ ${tile.name}`);
    await waitFrames(page, 20);
    await expect(hint).toHaveText(`▸ ${tile.name}`);
    await expect(page.getByTestId('focus-brackets')).toHaveAttribute('data-state', 'on');
    await page.touchscreen.tap(30, 700);
    await expect(hint).toHaveText(WALL_HINT);
    await expect(page.getByTestId('focus-brackets')).toHaveAttribute('data-state', 'off');
  });
});
