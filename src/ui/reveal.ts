import { clamp01 } from '@/lib/math';

/** Chapter-local t range over which a text types in, and then types back out. */
export interface RevealWindow {
  inStart: number;
  inEnd: number;
  outStart: number;
  outEnd: number;
}

const w = (inStart: number, inEnd: number, outStart: number, outEnd: number): RevealWindow => ({
  inStart,
  inEnd,
  outStart,
  outEnd,
});

export const TEXT_WINDOWS = {
  roomIntro: w(0, 0, 0.55, 0.75),
  spiralProject: w(0.1, 0.16, 0.94, 1),
  // Once the camera is down past the bulb, so its glare is up out of the frame, as the last tiles
  // come into the wall (depths/choreography.ts TILES_UP_T), and up to the end.
  stackTitle: w(0.5, 0.62, 0.93, 1),
  stackHint: w(0.56, 0.66, 0.93, 1),
  contactTagline: w(0.2, 0.45, 0.92, 1),
  contactHint: w(0.3, 0.45, 0.92, 1),
} satisfies Record<string, RevealWindow>;

/** How much of a text is shown at chapter-local t: 0 hidden, 1 fully typed. */
export function revealFraction(t: number, { inStart, inEnd, outStart, outEnd }: RevealWindow): number {
  let typedIn: number;
  if (t < inStart) typedIn = 0;
  else if (inEnd <= inStart) typedIn = 1;
  else typedIn = clamp01((t - inStart) / (inEnd - inStart));
  const typedOut = t < outStart ? 1 : 1 - clamp01((t - outStart) / (outEnd - outStart));
  return Math.min(typedIn, typedOut);
}

/** Number of characters to show; driven by scroll, so typing runs backwards too. */
export function typedCount(length: number, fraction: number): number {
  return Math.round(length * clamp01(fraction));
}
