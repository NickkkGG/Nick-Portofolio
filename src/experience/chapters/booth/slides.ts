import { clamp01, smoothstep } from '@/lib/math';
import { resolve } from '@/timeline/resolve';

/*
 * The booth's slide show, in about-chapter t. The figure crashes in at 0; the projector,
 * jolted on, warms up; the slides take turns on the sheet; after a blank the rope snaps,
 * the sheet falls and the beam goes out of the window to the first monitor, which tunes in.
 * Everything follows the scroll, so scrolling back runs it all backwards.
 */

/** The projector's lamp catches, a moment after the crash. */
export const PROJECTOR_ON_T = 0.015;
/** Where the slides take turns: the first drops in as the lamp is warm, the blank comes after the last. */
export const SLIDES = { from: 0.06, to: 0.82 } as const;
/** The rope snaps and the sheet starts to fall. */
export const SHEET_DROP_T = 0.84;
/** The sheet is down: the beam is out of the window, on the first monitor. */
export const BEAM_OUT_T = 0.88;
/** The figure is on its feet at the window. */
const STOOD_T = 0.95;

/** Within a slide's turn: the gate is dark while the carousel drops it in, then the lens pulls it into focus. */
const GATE = 0.06;
const FOCUSED = 0.16;

/**
 * The slide on the sheet at about-chapter t, and how far into its turn (0..1): -1 before the
 * first one, `count` for the blank after the last.
 */
export function slideAt(t: number, count: number): { index: number; local: number } {
  const span = (SLIDES.to - SLIDES.from) / count;
  if (t < SLIDES.from) return { index: -1, local: 0 };
  if (t >= SLIDES.to) return { index: count, local: clamp01((t - SLIDES.to) / span) };
  const along = (t - SLIDES.from) / span;
  const index = Math.min(count - 1, Math.floor(along));
  return { index, local: along - index };
}

/** The number (1..count) of the slide in the gate at global p, for the on-screen display; null when there is none. */
export function slideNumber(p: number, count: number): number | null {
  const { chapter, t } = resolve(p);
  if (chapter.id !== 'about') return null;
  const { index } = slideAt(t, count);
  return index >= 0 && index < count ? index + 1 : null;
}

/** Light through the gate within a slide's turn: dark while the carousel drops the slide in. */
export const shutter = (local: number) => smoothstep(0, GATE, local);

/** How far the slide still sits above its place in the gate, as a share of the picture's height: it drops in while the gate is dark. */
export const gateDrop = (local: number) => 0.06 * (1 - smoothstep(0, GATE, local));

/** How sharp the slide is within its turn: 0 blurred as it comes up, 1 once the lens has it. */
export const slideFocus = (local: number) => smoothstep(GATE, FOCUSED, local);

/** The projector lamp at about-chapter t: off as the figure lands, warm by the first slide. */
export const lampLevel = (t: number) => smoothstep(PROJECTOR_ON_T, SLIDES.from, t);

/** How far the sheet has fallen, 0..1, faster and faster like anything dropped. */
export function sheetDrop(t: number): number {
  const k = clamp01((t - SHEET_DROP_T) / (BEAM_OUT_T - SHEET_DROP_T));
  return k * k;
}

/** The figure getting up from the crate once the sheet is down, 0 sitting to 1 standing. */
export const standUp = (t: number) => smoothstep(BEAM_OUT_T, STOOD_T, t);

/** The first monitor's power at global p: dark from the fall until the beam finds it, on from then. */
export function firstMonitorPower(p: number): number {
  const { chapter, t } = resolve(p);
  if (chapter.id === 'fall') return 0;
  if (chapter.id === 'about') return smoothstep(BEAM_OUT_T, BEAM_OUT_T + 0.03, t);
  return 1;
}
