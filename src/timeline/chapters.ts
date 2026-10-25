export type ChapterId = 'room' | 'fall' | 'about' | 'spiral' | 'stack' | 'contact' | 'loop';

export interface Chapter {
  id: ChapterId;
  code: string;
  label: string;
  start: number;
  end: number;
  /** Chapter-local t where a jump to the chapter lands (the menu, Home); 0 for its start. */
  entry: number;
}

/** One loop of the story, chapter by chapter, with each chapter's length in screens of scroll. */
const STORY: readonly (Omit<Chapter, 'start' | 'end' | 'entry'> & { screens: number; entry?: number })[] = [
  { id: 'room', code: 'CH-01', label: 'ROOM', screens: 1.4 },
  { id: 'fall', code: 'CH-02', label: 'FALL', screens: 1.7 },
  // The booth: who the visitor just fell in with, one slide at a time. The menu lands on the
  // first slide, already sharp, rather than in the dust of the crash (booth/slides.ts).
  { id: 'about', code: 'CH-03', label: 'ABOUT', screens: 4, entry: 0.09 },
  { id: 'spiral', code: 'CH-04', label: 'WORK', screens: 4.2 },
  // Down off the last monitor to the flooded floor, where the tools come together as tiles.
  { id: 'stack', code: 'CH-05', label: 'STACK', screens: 2 },
  { id: 'contact', code: 'CH-06', label: 'CONTACT', screens: 1.4 },
  { id: 'loop', code: 'CH-07', label: 'LOOP', screens: 0.9 },
];

const SCREENS = STORY.reduce((sum, chapter) => sum + chapter.screens, 0);

/** Scroll length of one loop, in viewport-height percent (15.6 screens). */
export const LOOP_LENGTH_VH = Math.round(SCREENS * 100);

/** Where each chapter starts in global progress, each boundary computed once so neighbours share it exactly. */
const BOUNDARIES = STORY.map((_, i) => STORY.slice(0, i).reduce((sum, chapter) => sum + chapter.screens, 0) / SCREENS);

/** One loop of the story, in global progress `p` (spec §3.1). Ranges are end-exclusive. */
export const CHAPTERS: readonly Chapter[] = STORY.map(({ id, code, label, entry = 0 }, i) => ({
  id,
  code,
  label,
  start: BOUNDARIES[i],
  end: i + 1 < STORY.length ? BOUNDARIES[i + 1] : 1,
  entry,
}));

export function getChapter(id: ChapterId): Chapter {
  const chapter = CHAPTERS.find((c) => c.id === id);
  if (!chapter) throw new Error(`unknown chapter: ${id}`);
  return chapter;
}
