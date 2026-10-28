import { clamp01 } from '@/lib/math';

/**
 * Chapter-local t range over which a text is up. The scroll only decides that; the typing
 * itself runs on the clock (useTyped.ts), so wherever the scroll stops, the text finishes.
 */
export interface TextWindow {
  from: number;
  to: number;
}

const w = (from: number, to: number): TextWindow => ({ from, to });

export const TEXT_WINDOWS = {
  roomIntro: w(0, 0.55),
  // The chapter opens with the camera already at the first monitor (camera/paths.ts), and the
  // text stays up until it has left the last one.
  spiralProject: w(0, 0.96),
  // Once every tile is in the wall (depths/choreography.ts TILES_UP_T), with the bulb's glare up
  // out of the frame, and up to the end. Its hint follows it in.
  stackTitle: w(0.6, 0.93),
  // Once the tiles have gone up, and the hint once every tape is in its place (TAPES_UP_T).
  contactTagline: w(0.2, 0.92),
  contactHint: w(0.45, 0.92),
} satisfies Record<string, TextWindow>;

/** Whether a text is up at chapter-local t. */
export function isUp(t: number, { from, to }: TextWindow): boolean {
  return t >= from && t < to;
}

/** Seconds to type a whole text in; its lines all keep pace, so they finish together. */
export const TYPE_IN_S = 0.9;
/** Seconds to take it back out. */
export const TYPE_OUT_S = 0.35;

/**
 * How much of a text is typed `dt` seconds on: towards all of it while it is up, back to
 * none otherwise. A frozen clock passes Infinity and settles at once.
 */
export function typeOn(fraction: number, dt: number, up: boolean): number {
  const step = dt > 0 ? dt : 0;
  return up ? Math.min(1, fraction + step / TYPE_IN_S) : Math.max(0, fraction - step / TYPE_OUT_S);
}

/** Number of characters to show of a text `fraction` typed. */
export function typedCount(length: number, fraction: number): number {
  return Math.round(length * clamp01(fraction));
}
