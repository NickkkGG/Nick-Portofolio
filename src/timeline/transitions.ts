import { getChapter } from './chapters';
import { resolve } from './resolve';

/** Tape glitch when the floor breaks: the biggest jolt of the story. */
export const FLOOR_BREAK_SPIKE = 0.9;
/** Tape glitch for every other chapter change. */
export const BOUNDARY_SPIKE = 0.35;

/**
 * VHS spike for a scroll step from `prevP` to `p`: a glitch whenever the step changes
 * chapter, strongest when it crosses into the fall. Loop wraps (jumps of more than
 * half a loop) are handled by the loop counter instead and give nothing here.
 */
export function boundarySpike(prevP: number, p: number): number {
  if (Math.abs(p - prevP) > 0.5) return 0;
  if (resolve(prevP).chapter.id === resolve(p).chapter.id) return 0;
  const fallStart = getChapter('fall').start;
  return prevP < fallStart && p >= fallStart ? FLOOR_BREAK_SPIKE : BOUNDARY_SPIKE;
}
