/**
 * Text that comes off the tape: each character shows as tape noise for a moment, flickering
 * through these glyphs, before it settles on itself. Pure functions of the scene clock, so a
 * frozen clock freezes the scramble too.
 */
export const GLYPHS = '▓▒░█▌▐▄▀■/\\|<>=+*#%&0123456789';
/** Seconds a character scrambles before it settles. */
export const SETTLE = 0.24;
/** Extra wait per character when a whole line appears at once, so it decodes left to right. */
export const STAGGER = 0.016;
/** Seconds each scramble glyph stays up. */
export const FLICKER = 0.045;

function hash(index: number, step: number): number {
  const s = Math.sin(index * 12.9898 + step * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** A number for a line of text, so each line runs through its own noise. */
export function textSeed(text: string): number {
  let seed = 0;
  for (let i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) % 9973;
  return seed;
}

/** The glyph character `index` (of the line with `seed`) shows at scene time `time` while it scrambles. */
export function glyphAt(index: number, time: number, seed = 0): string {
  return GLYPHS[Math.floor(hash(index + seed * 0.618, Math.floor(time / FLICKER)) * GLYPHS.length)];
}

/** A space of any kind (a tag's words are held together by no-break spaces): never scrambled, never heard. */
export const isBlank = (char: string) => /\s/.test(char);

/** Character `char` at position `index`, `age` seconds after it appeared, at scene time `time`. */
export function decodeChar(char: string, age: number, index: number, time: number, seed = 0): { char: string; settled: boolean } {
  if (isBlank(char) || age >= SETTLE) return { char, settled: true };
  return { char: glyphAt(index, time, seed), settled: false };
}

/**
 * When each character appeared, given the times from before (`prev`), how many show now
 * (`shown`, from the scroll) and the clock (`now`). Newly shown ones get a staggered start;
 * hidden ones forget theirs, so they decode again when they come back.
 */
export function birthTimes(prev: readonly (number | undefined)[], shown: number, length: number, now: number): (number | undefined)[] {
  const born: (number | undefined)[] = [];
  let fresh = 0;
  for (let i = 0; i < length; i++) {
    if (i >= shown) born.push(undefined);
    else born.push(prev[i] ?? now + STAGGER * fresh++);
  }
  return born;
}
