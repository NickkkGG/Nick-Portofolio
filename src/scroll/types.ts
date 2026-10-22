import type { ChapterId } from '@/timeline/chapters';

/** Scroll controls the ScrollDriver registers in the store. */
export interface ScrollApi {
  start(): void;
  stop(): void;
  jumpTo(p: number): void;
  toChapter(id: ChapterId): void;
}
