import type { ChapterId } from './chapters';
import { LOOP_TELEPORT_P } from './loop';
import { wrapProgress } from './resolve';

export type VisibilityGroup = ChapterId | 'depths';

type Range = readonly [start: number, end: number, endInclusive: boolean];

/** When each group of objects is rendered: its chapter plus a margin (spec §4.3). */
const RANGES: Record<VisibilityGroup, readonly Range[]> = {
  room: [
    [0, 0.12, true],
    [LOOP_TELEPORT_P, 1, true],
  ],
  fall: [[0.08, 0.28, true]],
  spiral: [[0.24, 0.58, true]],
  problem: [[0.54, 0.74, true]],
  stack: [[0.7, 0.84, true]],
  contact: [[0.8, 0.94, true]],
  loop: [[0.9, 1, true]],
  depths: [[0.54, LOOP_TELEPORT_P, false]],
};

export function isVisible(group: VisibilityGroup, p: number): boolean {
  const x = wrapProgress(p);
  return RANGES[group].some(([start, end, endInclusive]) => x >= start && (endInclusive ? x <= end : x < end));
}
