import { smoothstep } from '@/lib/math';
import { CHAPTERS, type ChapterId, LOOP_LENGTH_VH } from './chapters';
import { wrapProgress } from './resolve';

/** Tape glitch when the floor breaks: the biggest jolt of the story. */
export const FLOOR_BREAK_SPIKE = 0.9;
/** Tape glitch when the figure crashes into the booth: hard enough to hide it getting up. */
export const LANDING_SPIKE = 0.6;
/** Out of the booth window into the work the camera never cuts: barely a skip. */
export const WINDOW_SPIKE = 0.05;
/** Tape glitch for every other chapter change: a light skip, the glass does the rest. */
export const BOUNDARY_SPIKE = 0.15;

/** The glitch for crossing into chapter `id` forward, or out of it backward. */
function spikeFor(id: ChapterId, forward: boolean): number {
  if (id === 'spiral') return WINDOW_SPIKE;
  if (forward && id === 'fall') return FLOOR_BREAK_SPIKE;
  if (forward && id === 'about') return LANDING_SPIKE;
  return BOUNDARY_SPIKE;
}

/**
 * VHS spike for a scroll step from `prevP` to `p`: the strongest glitch of the chapter
 * changes it crosses, hardest where the floor breaks. Loop wraps (jumps of more than
 * half a loop) are handled by the loop counter instead and give nothing here.
 */
export function boundarySpike(prevP: number, p: number): number {
  if (Math.abs(p - prevP) > 0.5 || p === prevP) return 0;
  const forward = p > prevP;
  const [from, to] = forward ? [prevP, p] : [p, prevP];
  let spike = 0;
  for (const chapter of CHAPTERS.slice(1)) {
    if (from < chapter.start && chapter.start <= to) spike = Math.max(spike, spikeFor(chapter.id, forward));
  }
  return spike;
}

/** One screen of scroll, in p. */
const SCREEN = 100 / LOOP_LENGTH_VH;

/**
 * The glass between chapters, per chapter that starts there: how thick it gets on the
 * boundary and how far (in screens of scroll) it reaches before and after it. The long
 * descents get the thickest.
 */
const PANES: Partial<Record<ChapterId, { strength: number; before: number; after: number }>> = {
  // The floor giving way: the glass creeps in over the last of the room, then clears as the camera drops.
  fall: { strength: 0.6, before: 0.42, after: 0.21 },
  // The crash through the booth roof: the glass hits at once and clears with the dust.
  about: { strength: 0.75, before: 0.1, after: 0.34 },
  // Out through the booth window the camera never cuts: the glass only brushes the picture.
  spiral: { strength: 0.3, before: 0.2, after: 0.2 },
  // Off the last monitor and all the way down to the flooded floor: the thickest glass.
  stack: { strength: 1, before: 0.28, after: 0.28 },
  contact: { strength: 0.55, before: 0.2, after: 0.2 },
  loop: { strength: 0.7, before: 0.28, after: 0.28 },
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
    const distance = Math.abs(x - start) / ((x < start ? pane.before : pane.after) * SCREEN);
    if (distance < 1) return { amount: pane.strength * (1 - smoothstep(0, 1, distance)), seed: i };
  }
  return { amount: 0, seed: 0 };
}
