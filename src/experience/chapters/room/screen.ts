/** What the room's monitor shows (spec §3.3, §3.4): its own source code, until the fifth knock. */
export const WHOS_THERE = "who's there?";

/** The tube tears for a moment before the question starts typing. */
const GLITCH_SECONDS = 0.45;
const TYPE_CPS = 6;
const HOLD_SECONDS = 4;

export type ScreenMode = 'code' | 'glitch' | 'whos-there';

/** The first characters of `text` typed `elapsed` seconds in. */
export function typed(text: string, elapsed: number, charsPerSecond: number): string {
  if (elapsed <= 0) return '';
  return text.slice(0, Math.min(text.length, Math.floor(elapsed * charsPerSecond)));
}

export function screenMode(time: number, whosThereAt: number | null): ScreenMode {
  if (whosThereAt === null || time < whosThereAt) return 'code';
  const elapsed = time - whosThereAt;
  if (elapsed < GLITCH_SECONDS) return 'glitch';
  if (elapsed < GLITCH_SECONDS + WHOS_THERE.length / TYPE_CPS + HOLD_SECONDS) return 'whos-there';
  return 'code';
}

export function whosThereText(time: number, whosThereAt: number): string {
  return typed(WHOS_THERE, time - whosThereAt - GLITCH_SECONDS, TYPE_CPS);
}
