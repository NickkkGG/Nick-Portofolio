import { expect, test } from '@playwright/test';
import { freeze, jumpTo, openExperience } from './helpers';

/** Bare back wall above the desk, at the opening camera (as in room.spec). */
const WALL = { x: 880, y: 120 };

declare global {
  interface Window {
    /** [audio time (s), loudness (RMS)] every 10 ms of what the page sends to its speakers. */
    __levels?: [number, number][];
    /** The page's audio context, once it has one. */
    __audio?: BaseAudioContext;
  }
}

/**
 * Taps everything the page plays: every context's destination becomes a gain node that
 * passes the sound on and feeds an AudioWorklet, which measures it on the audio thread.
 */
function tapSpeakers() {
  const levels: [number, number][] = [];
  window.__levels = levels;
  const speakers = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'destination')?.get;
  if (!speakers) return;
  const taps = new WeakMap<BaseAudioContext, GainNode>();
  const meter = `registerProcessor('meter', class extends AudioWorkletProcessor {
    constructor() { super(); this.sum = 0; this.n = 0; this.from = 0; }
    process(inputs) {
      const [left, right] = inputs[0];
      if (this.n === 0) this.from = currentTime;
      for (let i = 0; i < 128; i++) {
        const l = left ? left[i] : 0, r = right ? right[i] : l;
        this.sum += (l * l + r * r) / 2;
      }
      this.n += 128;
      if (this.n >= 480) { this.port.postMessage([this.from, Math.sqrt(this.sum / this.n)]); this.sum = 0; this.n = 0; }
      return true;
    }
  });`;
  Object.defineProperty(BaseAudioContext.prototype, 'destination', {
    get(this: BaseAudioContext) {
      let tap = taps.get(this);
      if (!tap) {
        window.__audio ??= this;
        const out = speakers.call(this) as AudioDestinationNode;
        const node = this.createGain();
        tap = node;
        taps.set(this, node);
        node.connect(out);
        const url = URL.createObjectURL(new Blob([meter], { type: 'application/javascript' }));
        void this.audioWorklet.addModule(url).then(() => {
          const worklet = new AudioWorkletNode(this, 'meter', { channelCount: 2, channelCountMode: 'explicit' });
          const silent = this.createGain();
          silent.gain.value = 0;
          node.connect(worklet).connect(silent).connect(out);
          worklet.port.onmessage = (event: MessageEvent<[number, number]>) => levels.push(event.data);
        });
      }
      return tap;
    },
  });
}

const db = (rms: number) => 20 * Math.log10(Math.max(rms, 1e-9));

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
