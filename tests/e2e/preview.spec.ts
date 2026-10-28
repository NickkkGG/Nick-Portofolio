import { expect, type Page, type Route, test } from '@playwright/test';
import { chapterP, freeze, jumpTo, openExperience, play, waitFrames } from './helpers';
import { diffRatio } from './utils/image';

const PREVIEW = '**/projects/project-01/preview.mp4';
/** The camera parked in front of the first project monitor. */
const FIRST_MONITOR = chapterP('spiral', 0.1);
const SECOND_MONITOR = chapterP('spiral', 0.26);
/** That monitor's screen at 1280×720. */
const SCREEN = { x: 470, y: 240, width: 320, height: 250 };

const screen = (page: Page) => page.screenshot({ clip: SCREEN });

/** Holds the preview's download back until `release`, so a test sees the static first. */
async function holdPreview(page: Page) {
  let outcome: 'continue' | 'abort' | null = null;
  const held: Route[] = [];
  let arrived!: () => void;
  const requested = new Promise<void>((done) => (arrived = done));
  await page.route(PREVIEW, async (route) => {
    if (outcome === 'continue') await route.continue();
    else if (outcome === 'abort') await route.abort();
    else {
      held.push(route);
      arrived();
    }
  });
  return {
    requested,
    release: async (how: 'continue' | 'abort') => {
      outcome = how;
      for (const route of held.splice(0)) await (how === 'continue' ? route.continue() : route.abort());
    },
  };
}

/**
 * Records every media element the page plays, so a test can see whether the preview runs.
 * With `refuseAutoplay`, play() fails the way a browser refuses autoplay until the first touch.
 */
async function watchVideos(page: Page, refuseAutoplay = false) {
  await page.addInitScript((refuse) => {
    const w = window as unknown as { __played: HTMLMediaElement[] };
    w.__played = [];
    let touched = !refuse;
    for (const type of ['pointerdown', 'keydown']) addEventListener(type, () => (touched = true), { capture: true });
    const realPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      if (!w.__played.includes(this)) w.__played.push(this);
      return touched ? realPlay.call(this) : Promise.reject(new DOMException('needs a touch first', 'NotAllowedError'));
    };
  }, refuseAutoplay);
}

/** The preview video's state, or null before anything tried to play it. */
function preview(page: Page) {
  return page.evaluate(() => {
    const played = (window as unknown as { __played: HTMLMediaElement[] }).__played;
    const video = played.find((media) => media.src.endsWith('/projects/project-01/preview.mp4'));
    return video ? { paused: video.paused, time: video.currentTime } : null;
  });
}

function setHidden(page: Page, hidden: boolean) {
  return page.evaluate((on) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => on });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

test.describe('the first project monitor', () => {
  test('tunes in from its static to the preview', async ({ page }) => {
    const held = await holdPreview(page);
    await openExperience(page);
    await play(page);
    await freeze(page);
    await page.evaluate(() => window.__experience!.setTime(4));
    await jumpTo(page, FIRST_MONITOR);
    await held.requested;
    await waitFrames(page, 10);
    const still = await screen(page);
    await held.release('continue');
    await expect.poll(async () => diffRatio(still, await screen(page), 16), { timeout: 10_000 }).toBeGreaterThan(0.4);
  });

  test('keeps its static and title when the preview cannot load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const held = await holdPreview(page);
    await openExperience(page);
    await play(page);
    await freeze(page);
    await page.evaluate(() => window.__experience!.setTime(4));
    await jumpTo(page, FIRST_MONITOR);
    await held.requested;
    await waitFrames(page, 10);
    const still = await screen(page);
    await held.release('abort');
    await page.waitForTimeout(1500);
    await waitFrames(page, 10);
    expect(diffRatio(still, await screen(page), 16)).toBeLessThan(0.02);
    expect(errors).toEqual([]);
  });

  test('downloads its preview only near the end of ABOUT', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().endsWith('/projects/project-01/preview.mp4')) requests.push(request.url());
    });
    await openExperience(page);
    await play(page);
    await jumpTo(page, chapterP('about', 0.5));
    await waitFrames(page, 10);
    expect(requests).toEqual([]);
    await jumpTo(page, chapterP('about', 0.9));
    await expect.poll(() => requests.length).toBeGreaterThan(0);
  });

  test('plays only while the camera is at it, and picks up where it left off', async ({ page }) => {
    await watchVideos(page);
    await openExperience(page);
    await play(page);
    await jumpTo(page, FIRST_MONITOR);
    await expect.poll(() => preview(page)).toMatchObject({ paused: false });
    await page.waitForTimeout(1000);
    await jumpTo(page, SECOND_MONITOR);
    await expect.poll(() => preview(page)).toMatchObject({ paused: true });
    const left = (await preview(page))!.time;
    await page.waitForTimeout(500);
    expect((await preview(page))!.time).toBe(left);
    await jumpTo(page, FIRST_MONITOR);
    await expect.poll(() => preview(page)).toMatchObject({ paused: false });
    expect((await preview(page))!.time).toBeGreaterThanOrEqual(left);
  });

  test('when the browser refuses to autoplay, it waits for the next touch', async ({ page }) => {
    await watchVideos(page, true);
    await openExperience(page);
    await play(page);
    await jumpTo(page, FIRST_MONITOR);
    await expect.poll(() => preview(page)).toMatchObject({ paused: true });
    await page.waitForTimeout(500);
    expect((await preview(page))!.paused).toBe(true);
    await page.mouse.click(640, 650);
    await expect.poll(() => preview(page)).toMatchObject({ paused: false });
  });

  test('rests while the tab is hidden', async ({ page }) => {
    await watchVideos(page);
    await openExperience(page);
    await play(page);
    await jumpTo(page, FIRST_MONITOR);
    await expect.poll(() => preview(page)).toMatchObject({ paused: false });
    await setHidden(page, true);
    await expect.poll(() => preview(page)).toMatchObject({ paused: true });
    await waitFrames(page, 10);
    expect((await preview(page))!.paused).toBe(true);
    await setHidden(page, false);
    await expect.poll(() => preview(page)).toMatchObject({ paused: false });
  });
});
