import { smoothstep } from '@/lib/math';
import { type ChapterId, getChapter } from './chapters';
import { resolve } from './resolve';

/** Loop-local t where the camera jumps above the room while the screen is black (spec §3.10). */
export const LOOP_TELEPORT_T = 0.3;
/** Loop-local t from which the UI already shows the room, so the seam is invisible. */
export const LOOP_ARRIVE_T = 0.9;

const loopChapter = getChapter('loop');
export const LOOP_TELEPORT_P = loopChapter.start + (loopChapter.end - loopChapter.start) * LOOP_TELEPORT_T;

/**
 * Counts loops from consecutive progress values: a jump of more than half a loop
 * backwards is a forward wrap, forwards is a backward wrap (never below loop 1).
 */
export function nextLoopIndex(prevP: number, p: number, loopIndex: number): number {
  const delta = p - prevP;
  if (delta < -0.5) return loopIndex + 1;
  if (delta > 0.5) return Math.max(1, loopIndex - 1);
  return loopIndex;
}

/** The chapter the UI should present; the end of the loop already shows the room. */
export function displayState(p: number): { chapterId: ChapterId; t: number } {
  const { chapter, t } = resolve(p);
  if (chapter.id === 'loop' && t >= LOOP_ARRIVE_T) return { chapterId: 'room', t: 0 };
  return { chapterId: chapter.id, t };
}

/** Blackout amount (1 = fully black) that hides the loop teleport. */
export function fadeAt(p: number): number {
  const { chapter, t } = resolve(p);
  if (chapter.id !== 'loop') return 0;
  if (t < 0.35) return smoothstep(0.15, 0.25, t);
  return 1 - smoothstep(0.35, 0.5, t);
}
