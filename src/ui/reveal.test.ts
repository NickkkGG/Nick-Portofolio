import { describe, expect, it } from 'vitest';
import { content } from '@/content';
import { buildKeyframes } from '@/experience/camera/paths';
import { localProgress, resolve } from '@/timeline/resolve';
import { isUp, TEXT_WINDOWS, TYPE_IN_S, TYPE_OUT_S, typedCount, typeOn } from './reveal';

/** `seconds` of frames at 60 fps. */
function run(from: number, seconds: number, up: boolean): number {
  let fraction = from;
  for (let i = 0; i < Math.round(seconds * 60); i++) fraction = typeOn(fraction, 1 / 60, up);
  return fraction;
}

/** Spiral-local t ranges over which the camera holds still in front of a monitor (camera/paths.ts). */
function parkedAtMonitors(): [number, number][] {
  const keys = buildKeyframes(content.projects.length);
  const same = (a: readonly number[], b: readonly number[]) => a.every((value, i) => value === b[i]);
  const ranges: [number, number][] = [];
  for (let k = 1; k < keys.length; k++) {
    const [a, b] = [keys[k - 1], keys[k]];
    if (resolve(a.p).chapter.id !== 'spiral' || b.p <= a.p) continue;
    if (same(a.position, b.position) && same(a.target, b.target)) ranges.push([localProgress(a.p, 'spiral'), localProgress(b.p, 'spiral')]);
  }
  return ranges;
}

describe('when a chapter text is up', () => {
  it('the room intro is up from the start, until a little past the middle of the room', () => {
    expect(isUp(0, TEXT_WINDOWS.roomIntro)).toBe(true);
    expect(isUp(0.5, TEXT_WINDOWS.roomIntro)).toBe(true);
    expect(isUp(0.6, TEXT_WINDOWS.roomIntro)).toBe(false);
  });

  it('the WORK text is up as the chapter opens on the first monitor, and the whole time the camera is parked at any of them', () => {
    expect(isUp(0, TEXT_WINDOWS.spiralProject)).toBe(true);
    const parked = parkedAtMonitors();
    expect(parked).toHaveLength(content.projects.length);
    for (const [from, to] of parked) {
      expect(isUp(from, TEXT_WINDOWS.spiralProject), `parked from ${from}`).toBe(true);
      expect(isUp(to, TEXT_WINDOWS.spiralProject), `parked until ${to}`).toBe(true);
    }
    // Down again once the camera drops off the last monitor toward the STACK.
    expect(isUp(0.99, TEXT_WINDOWS.spiralProject)).toBe(false);
  });

  it('the STACK title waits for the wall of tiles, and stays up until the glass', () => {
    expect(isUp(0.55, TEXT_WINDOWS.stackTitle)).toBe(false);
    expect(isUp(0.6, TEXT_WINDOWS.stackTitle)).toBe(true);
    expect(isUp(0.9, TEXT_WINDOWS.stackTitle)).toBe(true);
    expect(isUp(0.95, TEXT_WINDOWS.stackTitle)).toBe(false);
  });

  it('the CONTACT tagline comes up once the tiles are gone, and its hint once the tapes are up', () => {
    expect(isUp(0.1, TEXT_WINDOWS.contactTagline)).toBe(false);
    expect(isUp(0.2, TEXT_WINDOWS.contactTagline)).toBe(true);
    expect(isUp(0.4, TEXT_WINDOWS.contactHint)).toBe(false);
    expect(isUp(0.45, TEXT_WINDOWS.contactHint)).toBe(true);
    expect(isUp(0.95, TEXT_WINDOWS.contactTagline)).toBe(false);
  });
});

describe('typing', () => {
  it('types a text in by itself in about a second, wherever the scroll stops', () => {
    expect(TYPE_IN_S).toBeGreaterThanOrEqual(0.6);
    expect(TYPE_IN_S).toBeLessThanOrEqual(1.2);
    const almost = run(0, TYPE_IN_S - 0.1, true);
    expect(almost).toBeGreaterThan(0.8);
    expect(almost).toBeLessThan(1);
    expect(run(0, TYPE_IN_S + 0.05, true)).toBe(1);
  });

  it('takes it back out faster once its window is down', () => {
    expect(TYPE_OUT_S).toBeLessThan(TYPE_IN_S / 2);
    expect(run(1, TYPE_OUT_S - 0.1, false)).toBeGreaterThan(0);
    expect(run(1, TYPE_OUT_S + 0.05, false)).toBe(0);
  });

  it('turns round from wherever it has got to', () => {
    expect(typeOn(0.5, 0.1, true)).toBeGreaterThan(0.5);
    expect(typeOn(0.5, 0.1, false)).toBeLessThan(0.5);
  });

  it('settles at once for a frozen clock, and never runs backwards', () => {
    expect(typeOn(0, Infinity, true)).toBe(1);
    expect(typeOn(1, Infinity, false)).toBe(0);
    expect(typeOn(0.4, -2, true)).toBe(0.4);
    expect(typeOn(0.4, Number.NaN, true)).toBe(0.4);
  });

  it('typedCount rounds and clamps', () => {
    expect(typedCount(10, 0.55)).toBe(6);
    expect(typedCount(10, 1.2)).toBe(10);
    expect(typedCount(10, -1)).toBe(0);
  });
});
