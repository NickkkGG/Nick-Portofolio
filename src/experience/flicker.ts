/**
 * The one place every flicker comes from (spec §9): a failing bulb that stutters in
 * short bursts, never more than three times in any second (WCAG 2.3.1).
 *
 * Everything is a pure function of scene time, so a frozen clock freezes the lamp and
 * the loop seam renders the same frame on both sides.
 */
export interface FlickerOptions {
  /** 0 = calm, 1 = frantic: how often bursts come and how long they last. */
  nervous?: number;
  /** Scene times of ghost knocks; each one makes the lamp stutter right after it. */
  knocks?: readonly number[];
  /** Another seed is another bulb. */
  seed?: number;
}

export const MAX_FLICKERS_PER_SECOND = 3;

/** Each 0.4 s slot holds at most one dip. */
const SLOT = 0.4;
/** Four dips more than this apart need more than a second: 3 per second at most. */
const MIN_GAP = 0.36;
/** Bursts are planned per episode of eight slots (3.2 s). */
const EPISODE = 8;
/** A knock rattles the bulb twice. */
const KNOCK_DIPS = [0.06, 0.5];
/** How far a dip reaches either side of its centre, in seconds. */
const DIP_REACH = 0.075;

/** Integer hash -> [0, 1). */
function hash(a: number, b: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Knock dips, dropping any that would come too soon after the previous one. */
function knockDips(knocks: readonly number[]): number[] {
  const wanted = knocks.flatMap((k) => KNOCK_DIPS.map((offset) => k + offset)).sort((a, b) => a - b);
  const kept: number[] = [];
  for (const d of wanted) if (kept.length === 0 || d - kept[kept.length - 1] > MIN_GAP) kept.push(d);
  return kept;
}

/** The bulb's own stutter: the dip in slot k, if its episode has a burst there. */
function randomDip(k: number, nervous: number, seed: number): number | null {
  const episode = Math.floor(k / EPISODE);
  if (hash(episode, seed) >= 0.1 + 0.55 * nervous) return null;
  const length = Math.min(EPISODE, 1 + Math.floor(hash(episode, seed + 101) * (2 + 3 * nervous)));
  const start = Math.floor(hash(episode, seed + 202) * (EPISODE - length + 1));
  const slot = k - episode * EPISODE;
  if (slot < start || slot >= start + length) return null;
  return k * SLOT + 0.02 + 0.04 * hash(k, seed + 303);
}

/** Centres of every lamp dip in [from, to), in order. */
export function flickerDips(from: number, to: number, options: FlickerOptions = {}): number[] {
  const { nervous = 0, knocks = [], seed = 0 } = options;
  const forced = knockDips(knocks);
  const dips = forced.filter((d) => d >= from && d < to);
  const first = Math.floor((from - MIN_GAP) / SLOT) - 1;
  const last = Math.ceil((to + MIN_GAP) / SLOT) + 1;
  for (let k = first; k <= last; k++) {
    const d = randomDip(k, nervous, seed);
    if (d === null || d < from || d >= to) continue;
    if (forced.some((f) => Math.abs(f - d) <= MIN_GAP)) continue;
    dips.push(d);
  }
  return dips.sort((a, b) => a - b);
}

/** 1 inside a dip's core, easing to 0 at DIP_REACH. */
function bump(x: number): number {
  if (x <= 0.03) return 1;
  if (x >= DIP_REACH) return 0;
  return 0.5 + 0.5 * Math.cos((Math.PI * (x - 0.03)) / (DIP_REACH - 0.03));
}

/** Lamp brightness at scene time `time`: ~1 when burning, down to ~0.1 inside a dip. */
export function lampLevel(time: number, options: FlickerOptions = {}): number {
  const seed = options.seed ?? 0;
  // An old filament never burns quite steady.
  let level = 0.965 + 0.035 * (0.5 + 0.5 * Math.sin(time * 2.3) * Math.sin(time * 0.71 + 1.3));
  for (const d of flickerDips(time - DIP_REACH, time + DIP_REACH, options)) {
    const depth = 0.72 + 0.2 * hash(Math.round(d * 1000), seed + 404);
    level = Math.min(level, 1 - depth * bump(Math.abs(time - d)));
  }
  return level;
}
