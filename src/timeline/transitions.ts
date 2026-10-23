import { smoothstep } from '@/lib/math';
import { CHAPTERS, getChapter } from './chapters';
import { resolve, wrapProgress } from './resolve';

/** Tape glitch when the floor breaks: the biggest jolt of the story. */
export const FLOOR_BREAK_SPIKE = 0.9;
/** Tape glitch for every other chapter change: a light skip, the glass does the rest. */
export const BOUNDARY_SPIKE = 0.15;

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

/**
 * The glass between chapters, per chapter that starts there: how thick it gets on the
 * boundary and how far (in p) it reaches before and after it. The long descents get the thickest.
 */
const PANES: Partial<Record<(typeof CHAPTERS)[number]['id'], { strength: number; before: number; after: number }>> = {
  // The floor giving way: the glass creeps in over the last of the room, then clears as the camera drops.
  fall: { strength: 0.6, before: 0.03, after: 0.015 },
  spiral: { strength: 1, before: 0.02, after: 0.02 },
  problem: { strength: 1, before: 0.02, after: 0.02 },
  stack: { strength: 0.55, before: 0.014, after: 0.014 },
  contact: { strength: 0.55, before: 0.014, after: 0.014 },
  loop: { strength: 0.7, before: 0.02, after: 0.02 },
};

/**
 * How deep the camera is in the glass at `p`: the picture passes through the curved face
 * of a CRT at every chapter change, thickening as the scroll nears the boundary and
 * clearing past it. `seed` tells the panes apart. Zero everywhere else, the seam included.
 */
export function glassAt(p: number): { amount: number; seed: number } {
  const x = wrapProgress(p);
  for (let i = 1; i < CHAPTERS.length; i++) {
    const pane = PANES[CHAPTERS[i].id];
    if (!pane) continue;
    const start = CHAPTERS[i].start;
    const distance = Math.abs(x - start) / (x < start ? pane.before : pane.after);
    if (distance < 1) return { amount: pane.strength * (1 - smoothstep(0, 1, distance)), seed: i };
  }
  return { amount: 0, seed: 0 };
}
