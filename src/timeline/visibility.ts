import { type ChapterId, getChapter } from './chapters';
import { LOOP_TELEPORT_P } from './loop';
import { chapterP, wrapProgress } from './resolve';

export type VisibilityGroup = ChapterId | 'depths';

type Range = readonly [start: number, end: number, endInclusive: boolean];

/** How far past its own chapter a group is still rendered, in p. */
const MARGIN = 0.02;
const around = (id: ChapterId): Range => [Math.max(0, getChapter(id).start - MARGIN), Math.min(1, getChapter(id).end + MARGIN), true];

/** When each group of objects is rendered: its chapter plus a margin (spec §4.3). */
const RANGES: Record<VisibilityGroup, readonly Range[]> = {
  room: [
    [0, getChapter('room').end + MARGIN, true],
    [LOOP_TELEPORT_P, 1, true],
  ],
  fall: [around('fall')],
  // The booth comes up under the end of the fall and stays until the camera is past the first monitor.
  about: [[chapterP('fall', 0.75), chapterP('spiral', 0.15), true]],
  // The pillar: kept out of the fall, which drops through clear air, and hidden behind the
  // booth walls and the sheet until it drops; then it is there through the window.
  spiral: [[chapterP('about', 0.75), getChapter('spiral').end + MARGIN, true]],
  problem: [around('problem')],
  stack: [around('stack')],
  contact: [around('contact')],
  loop: [around('loop')],
  depths: [[getChapter('problem').start - MARGIN, LOOP_TELEPORT_P, false]],
};

export function isVisible(group: VisibilityGroup, p: number): boolean {
  const x = wrapProgress(p);
  return RANGES[group].some(([start, end, endInclusive]) => x >= start && (endInclusive ? x <= end : x < end));
}
