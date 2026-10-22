import { CHAPTERS, type Chapter, type ChapterId, getChapter } from './chapters';

/** Wraps any number into [0, 1). */
export function wrapProgress(x: number): number {
  // Values already in range pass through untouched so chapter boundaries stay exact.
  if (x >= 0 && x < 1) return x;
  const wrapped = x - Math.floor(x);
  return wrapped >= 1 ? 0 : wrapped;
}

/** The chapter containing `p` (wrapped first) and the local progress `t` inside it. */
export function resolve(p: number): { chapter: Chapter; t: number } {
  const wrapped = wrapProgress(p);
  const chapter = CHAPTERS.find((c) => wrapped >= c.start && wrapped < c.end) ?? CHAPTERS[CHAPTERS.length - 1];
  return { chapter, t: (wrapped - chapter.start) / (chapter.end - chapter.start) };
}

/** Local progress of chapter `id` at global `p`, clamped to 0..1. */
export function localProgress(p: number, id: ChapterId): number {
  const chapter = getChapter(id);
  const t = (wrapProgress(p) - chapter.start) / (chapter.end - chapter.start);
  return Math.min(1, Math.max(0, t));
}

export function chapterStartP(id: ChapterId): number {
  return getChapter(id).start;
}
