import type { Locator, Page } from '@playwright/test';
import type { ExperienceSnapshot } from '../../src/debug/testHook';

/** Waits until the lazily loaded 3D scene exists and has rendered a few frames. */
export async function waitForScene(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const s = window.__experience?.getState();
    return !!s && s.sceneReady && s.frame > 2;
  });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** Opens the site with the test hook only (no leva or stats in screenshots). */
export async function openExperience(page: Page): Promise<void> {
  await page.goto('/?debug&quiet');
  await waitForScene(page);
}

export async function waitFrames(page: Page, n: number): Promise<void> {
  await page.evaluate((count) => window.__experience!.waitFrames(count), n);
}

export async function play(page: Page): Promise<void> {
  await page.evaluate(() => window.__experience!.play());
  await waitFrames(page, 2);
}

export async function freeze(page: Page): Promise<void> {
  await page.evaluate(() => window.__experience!.freezeTime(true));
  await waitFrames(page, 2);
}

export async function jumpTo(page: Page, p: number): Promise<void> {
  await page.evaluate((value) => window.__experience!.jumpTo(value), p);
  await waitFrames(page, 3);
}

export async function state(page: Page): Promise<ExperienceSnapshot> {
  return page.evaluate(() => window.__experience!.getState());
}

/**
 * Screenshot; `maskOverlay` paints every visible UI piece black so only the 3D image
 * counts. It masks the pieces (data-overlay-item), not the full-screen overlay layer.
 */
export async function shot(page: Page, opts: { maskOverlay?: boolean; mask?: Locator[] } = {}): Promise<Buffer> {
  const mask = [...(opts.mask ?? []), ...(opts.maskOverlay ? [page.locator('[data-overlay-item]')] : [])];
  return page.screenshot({ mask, maskColor: '#000000' });
}
