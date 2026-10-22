export type ChapterId = 'room' | 'fall' | 'spiral' | 'problem' | 'stack' | 'contact' | 'loop';

export interface Chapter {
  id: ChapterId;
  code: string;
  label: string;
  start: number;
  end: number;
}

/** One loop of the story, in global progress `p` (spec §3.1). Ranges are end-exclusive. */
export const CHAPTERS: readonly Chapter[] = [
  { id: 'room', code: 'CH-01', label: 'ROOM', start: 0, end: 0.1 },
  { id: 'fall', code: 'CH-02', label: 'FALL', start: 0.1, end: 0.26 },
  { id: 'spiral', code: 'CH-03', label: 'WORK', start: 0.26, end: 0.56 },
  { id: 'problem', code: 'CH-04', label: 'ABOUT', start: 0.56, end: 0.72 },
  { id: 'stack', code: 'CH-05', label: 'STACK', start: 0.72, end: 0.82 },
  { id: 'contact', code: 'CH-06', label: 'CONTACT', start: 0.82, end: 0.92 },
  { id: 'loop', code: 'CH-07', label: 'LOOP', start: 0.92, end: 1 },
];

/** Scroll length of one loop, in viewport-height percent (14 screens). */
export const LOOP_LENGTH_VH = 1400;

export function getChapter(id: ChapterId): Chapter {
  const chapter = CHAPTERS.find((c) => c.id === id);
  if (!chapter) throw new Error(`unknown chapter: ${id}`);
  return chapter;
}
