import { wrapProgress } from '@/timeline/resolve';

/** One loop of the story plays as 13 minutes 37 seconds of tape. */
const LOOP_SECONDS = 13 * 60 + 37;

const pad = (n: number) => String(n).padStart(2, '0');

/** Camcorder timecode (HH:MM:SS) for global progress `p`. */
export function formatTimecode(p: number): string {
  const total = Math.floor(wrapProgress(p) * LOOP_SECONDS);
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}
